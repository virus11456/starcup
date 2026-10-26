import site from 'vinext/server/fetch-handler';
import { DurableObject } from 'cloudflare:workers';
import { createHash, randomBytes } from 'node:crypto';
import { ACCESS_COOKIE, PRIVATE_CACHE, validAccessToken } from '../lib/site-access.ts';
import { attachFullRoom, createFullRoom, fullSummary, fullView, joinFullRoom, memberFor, relayView, roomError, syncFullRoom } from '../lib/full-room.ts';
import { RoomStorage } from './room-storage.js';
import { creationCode, recoverCreation } from '../lib/room-creation.ts';
import { socketCheckpoint, syncSocketRoom } from './room-checkpoints.js';
import { roomFailure as failure } from './service-errors.js';

const DAY = 86_400_000;
const hash = value => createHash('sha256').update(value).digest('hex');
const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': PRIVATE_CACHE, 'X-Robots-Tag': 'noindex, nofollow' } });
function seatToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) roomError('玩家識別無效，請重新加入房間。', 403);
  return hash(token);
}
function codeFor(value) {
  if (typeof value !== 'string' || !/^[A-Z2-9]{8}$/.test(value)) roomError('邀請碼為 8 位英數字。');
  return value;
}

// Directory contains only public summaries. Each actual match has its own DO.
// Creator rate limits use separate directory instances, never the lobby instance.
export class GrailDirectory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS entries (code TEXT PRIMARY KEY, data TEXT NOT NULL, seen INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS attempts (at INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS reservations (auth TEXT PRIMARY KEY, at INTEGER NOT NULL)');
  }
  list() {
    return this.sql.exec('SELECT data FROM entries WHERE seen > ? ORDER BY seen DESC LIMIT 40', Date.now() - 60_000).toArray().map(row => JSON.parse(row.data));
  }
  async update(summary) {
    if (summary.status === 'waiting') this.sql.exec('INSERT OR REPLACE INTO entries VALUES (?, ?, ?)', summary.code, JSON.stringify(summary), Date.now());
    else this.sql.exec('DELETE FROM entries WHERE code = ?', summary.code);
    if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
  async reserve(auth) {
    const allowed = this.ctx.storage.transactionSync(() => {
      const since = Date.now() - 3_600_000;
      this.sql.exec('DELETE FROM attempts WHERE at < ?', since);
      this.sql.exec('DELETE FROM reservations WHERE at < ?', since);
      if (this.sql.exec('SELECT auth FROM reservations WHERE auth = ?', auth).toArray().length) return true;
      // Include reservations from the previous deployment until they expire.
      if (this.sql.exec('SELECT (SELECT COUNT(*) FROM attempts) + (SELECT COUNT(*) FROM reservations) AS n').one().n >= 5) return false;
      this.sql.exec('INSERT INTO reservations VALUES (?, ?)', auth, Date.now());
      return true;
    });
    if (!allowed) return false;
    if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + DAY);
    return true;
  }
  async alarm() {
    this.sql.exec('DELETE FROM entries WHERE seen < ?', Date.now() - 60_000);
    this.sql.exec('DELETE FROM attempts WHERE at < ?', Date.now() - 3_600_000);
    this.sql.exec('DELETE FROM reservations WHERE at < ?', Date.now() - 3_600_000);
    const count = this.sql.exec('SELECT (SELECT COUNT(*) FROM entries) + (SELECT COUNT(*) FROM attempts) + (SELECT COUNT(*) FROM reservations) AS n').one().n;
    if (count) await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
}

export class GrailRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rooms = new RoomStorage(ctx.storage);
    this.lastListed = 0;
  }
  async command(auth, body, sender = null, creator = null) {
    try {
      let room = this.rooms.load();
      const wasPlaying = room?.status === 'playing';
      let changed = true, data;
      if (body.type === 'create') {
        const candidate = createFullRoom(body.code, auth, body.name, body.title, body.capacity);
        if (room) return { status: 200, data: { room: fullView(recoverCreation(room, candidate), auth) } };
        if (!creator || !await this.env.GRAIL_DIRECTORY.getByName('creator:' + creator).reserve(auth))
          roomError('每小時最多建立 5 個房間，請稍後再試。', 429);
        // RPC allows interleaving. Another identical request may have saved
        // the room while the rate reservation was in flight; never overwrite it.
        room = this.rooms.load();
        if (room) return { status: 200, data: { room: fullView(recoverCreation(room, candidate), auth) } };
        room = candidate;
        data = { room: fullView(room, auth) };
      } else {
        if (!room || Date.now() - room.updated > DAY) roomError('找不到房間，或房間已過期。', 404);
        if (body.type === 'join') {
          joinFullRoom(room, auth, body.name, randomBytes(8).toString('hex'));
          data = { room: fullView(room, auth) };
        } else if (body.type === 'attach') {
          attachFullRoom(room, auth, body.connection);
          data = { ...relayView(room, auth), transport: 'websocket' };
        } else if (body.type === 'sync') {
          changed = sender
            ? syncSocketRoom(room, auth, body, this.ctx.getWebSockets().map(ws => ws.deserializeAttachment()))
            : syncFullRoom(room, auth, body);
          data = relayView(room, auth);
        } else if (body.type === 'leave') {
          const member = memberFor(room, auth);
          if (member.id === '1') { room.status = 'closed'; room.messages = []; }
          else { member.connection = ''; member.seen = 0; if (room.status === 'waiting') room.members = room.members.filter(m => m !== member); }
          data = { left: true };
        } else roomError('未知的房間操作。');
      }
      if (changed) {
        room.revision++;
        room.updated = Date.now();
        this.rooms.save(room);
      }
      if (sender) sender.serializeAttachment(socketCheckpoint(room, auth));
      // Notify only for gameplay/membership changes, not heartbeat/ack traffic.
      if (body.type !== 'sync' || body.messages?.length || body.started && room.status === 'playing' && !wasPlaying) {
        for (const ws of this.ctx.getWebSockets()) if (ws !== sender && ws.deserializeAttachment()?.auth) {
          try { ws.send('{"wake":true}'); } catch { /* reconnect uses durable inbox */ }
        }
      }
      if (body.type === 'create') await this.ctx.storage.setAlarm(Date.now() + DAY);
      if (body.type !== 'sync' || Date.now() - this.lastListed > 30_000) {
        this.lastListed = Date.now();
        // Directory availability must not roll back an already persisted action.
        this.ctx.waitUntil(this.env.GRAIL_DIRECTORY.getByName('lobby').update(fullSummary(room)).catch(() => { this.lastListed = 0; }));
      }
      return { status: 200, data };
    } catch (error) { const f = failure(error); return { status: f.status, data: { error: f.error } }; }
  }
  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return response({ error: '需要即時連線。' }, 426);
    // Authenticate the seat before allocating a persistent connection. Only
    // the public protocol name is echoed; credentials never enter the URL.
    let auth, connection;
    try {
      const protocols = (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map(x => x.trim());
      if (!protocols.includes('grail-v1')) roomError('連線格式無效。');
      auth = seatToken(protocols.find(x => x.startsWith('seat-'))?.slice(5));
      connection = protocols.find(x => x.startsWith('connection-'))?.slice(11);
      const room = this.rooms.load();
      if (!room || room.status === 'closed' || Date.now() - room.updated > DAY) roomError('房間已結束或過期。', 410);
      const member = memberFor(room, auth);
      if (!member.connection || member.connection !== connection) roomError('連線識別無效。', 409);
      for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.auth === auth) ws.close(1000, '連線已恢復');
    } catch (error) { const f = failure(error); return response({ error: f.error }, f.status); }
    if (this.ctx.getWebSockets().length >= 24) return response({ error: '房間連線數已滿。' }, 429);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ auth, connection });
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'grail-v1' } });
  }
  async webSocketMessage(ws, message) {
    let id = '';
    try {
      if (typeof message !== 'string' || message.length > 650_000) roomError('同步訊息過大。', 413);
      const body = JSON.parse(message);
      if (typeof body.id !== 'string' || !/^[\w-]{16,64}$/.test(body.id) || body.type !== 'sync') roomError('同步格式無效。');
      id = body.id;
      const auth = seatToken(body.token);
      const attached = ws.deserializeAttachment();
      if (attached && (attached.auth !== auth || attached.connection !== body.connection)) roomError('連線識別無效。', 403);
      const result = await this.command(auth, body, ws);
      ws.send(JSON.stringify({ id, ...result }));
      if (result.status === 403 || result.status === 409 || result.status === 410) ws.close(1008, '請重新加入房間');
    } catch (error) {
      const f = failure(error);
      ws.send(JSON.stringify({ id, status: f.status, data: { error: f.error } }));
      ws.close(1008, '同步資料無效');
    }
  }
  webSocketClose(ws) { try { ws.close(1000, '連線結束'); } catch {} }
  webSocketError(ws) { try { ws.close(1011, '連線中斷'); } catch {} }
  async alarm() {
    const room = this.rooms.load();
    if (!room || Date.now() - room.updated >= DAY) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, '房間已過期');
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec('DELETE FROM room');
        this.ctx.storage.sql.exec('DELETE FROM inbox');
        this.ctx.storage.sql.exec('DELETE FROM inbox_batches');
      });
    } else await this.ctx.storage.setAlarm(room.updated + DAY);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!['/api/full-room', '/api/full-room/socket'].includes(url.pathname)) {
      const result = await site.fetch(request, env, ctx);
      if (!url.pathname.startsWith('/engine/')) return result;
      // Safari does not consistently include wss in connect-src 'self'.
      // Permit only this deployment's own WebSocket endpoint.
      const headers = new Headers(result.headers);
      const policy = headers.get('Content-Security-Policy');
      if (policy) headers.set('Content-Security-Policy', policy.replace("connect-src 'self'", "connect-src 'self' wss://" + url.host));
      return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
    }
    const cookie = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(ACCESS_COOKIE + '='))?.slice(ACCESS_COOKIE.length + 1);
    const config = { password: env.SITE_ACCESS_PASSWORD, secret: env.SITE_ACCESS_SESSION_SECRET };
    if (!config.password || !/^[a-f0-9]{64}$/.test(config.secret || '') || !validAccessToken(cookie, config)) return response({ error: '請先輸入網站密碼。' }, 401);
    try {
      if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('origin') && new URL(request.headers.get('origin')).origin !== url.origin) roomError('無法接受跨網站操作。', 403);
      if (url.pathname.endsWith('/socket')) return await env.GRAIL_ROOMS.getByName(codeFor(url.searchParams.get('code'))).fetch(request);
      if (request.method === 'GET') return response({ rooms: await env.GRAIL_DIRECTORY.getByName('lobby').list(), configured: true });
      if (request.method !== 'POST') return response({ error: '不支援此操作。' }, 405);
      const text = await request.text();
      if (text.length > 650_000) roomError('請求過大。', 413);
      let body;
      try { body = JSON.parse(text); } catch { roomError('請求格式無效。'); }
      const auth = seatToken(body?.token);
      let creator = null;
      if (body.type === 'create') {
        creator = hash((request.headers.get('cf-connecting-ip') || auth) + env.GRAIL_SERVER_SECRET);
        body.code = creationCode(auth, env.GRAIL_SERVER_SECRET);
      }
      const result = await env.GRAIL_ROOMS.getByName(codeFor(body.code)).command(auth, body, null, creator);
      return response(result.data, result.status);
    } catch (error) { const f = failure(error); return response({ error: f.error }, f.status); }
  },
};
