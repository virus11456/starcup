import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { ACCESS_COOKIE, createAccessToken } from '../../lib/site-access.ts';
import { enterOnlineRoom, seatKey, PENDING_CREATION_KEY } from '../../lib/online-session.ts';

// Use the same workerd/Miniflare toolchain already installed by Wrangler.
// These bindings and credentials exist only in this in-memory local runtime.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const { build } = wranglerRequire('esbuild');
const root = new URL('../../', import.meta.url).pathname;

test('local Cloudflare runtime: real HTTP, WebSockets, SQLite and hibernation', { timeout: 120_000 }, async t => {
  const bundle = await build({
    absWorkingDir: root, entryPoints: ['cloudflare/worker.js'], bundle: true,
    write: false, format: 'esm', platform: 'node', target: 'es2022',
    external: ['cloudflare:workers', 'node:*'],
    plugins: [{ name: 'exclude-page-renderer-from-room-test', setup(builder) {
      builder.onResolve({ filter: /^vinext\/server\/fetch-handler$/ }, () => ({ path: 'pages', namespace: 'local-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'local-test' }, () => ({ contents: 'export default { fetch() { return new Response("Pages are tested separately", {status:404}); } };' }));
    } }],
  });
  const config = { password: randomBytes(12).toString('hex'), secret: randomBytes(32).toString('hex') };
  const cookie = `${ACCESS_COOKIE}=${createAccessToken(config)}`;
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'starcup-local-acceptance', modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-10-25', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { GRAIL_ROOMS: { className: 'GrailRoom', useSQLite: true }, GRAIL_DIRECTORY: { className: 'GrailDirectory', useSQLite: true } },
    bindings: { SITE_ACCESS_PASSWORD: config.password, SITE_ACCESS_SESSION_SECRET: config.secret, GRAIL_SERVER_SECRET: randomBytes(32).toString('hex') },
  }));
  const sockets = [];
  const origin = 'https://starcup-local.test';
  async function request(body, headers = {}) {
    const response = await mf.dispatchFetch(origin + '/api/full-room', {
      method: 'POST', headers: { cookie, origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  async function openSocket(code, seat) {
    const response = await mf.dispatchFetch(origin + '/api/full-room/socket?code=' + code, {
      headers: { cookie, origin, Upgrade: 'websocket', 'Sec-WebSocket-Protocol': ['grail-v1', 'seat-' + seat.token, 'connection-' + seat.connection].join(',') },
    });
    assert.equal(response.status, 101);
    const socket = response.webSocket;
    assert.ok(socket);
    socket.accept(); sockets.push(socket);
    return socket;
  }
  function sync(socket, code, seat, extra = {}) {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.removeEventListener('message', onMessage); reject(new Error('Local socket response timeout')); }, 5000);
      function onMessage(event) {
        const packet = JSON.parse(event.data);
        if (packet.id !== id) return;
        clearTimeout(timer); socket.removeEventListener('message', onMessage); resolve(packet);
      }
      socket.addEventListener('message', onMessage);
      socket.send(JSON.stringify({ type: 'sync', id, code, token: seat.token, connection: seat.connection, ack: 0, messages: [], ...extra }));
    });
  }
  try {
    await t.test('the deployed room boundary rejects missing authentication and cross-origin calls', async () => {
      const unauthenticated = await mf.dispatchFetch(origin + '/api/full-room');
      assert.equal(unauthenticated.status, 401);
      assert.match(unauthenticated.headers.get('cache-control'), /no-store/);
      assert.equal((await request({ type: 'create' }, { origin: 'https://untrusted.test' })).status, 403);
    });
    await t.test('Cloudflare handles trailing-slash room URLs and retires the legacy API without the page adapter', async () => {
      for (const path of ['/api/full-room', '/api/full-room/']) {
        const denied = await mf.dispatchFetch(origin + path);
        assert.equal(denied.status, 401);
        const listed = await mf.dispatchFetch(origin + path, { headers: { cookie, origin } });
        assert.equal(listed.status, 200);
        assert.deepEqual(await listed.json(), { rooms: [], configured: true });
        const invalid = await mf.dispatchFetch(origin + path, {
          method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}',
        });
        assert.equal(invalid.status, 403, 'room validation, not the excluded renderer, handles POST');
      }
      for (const path of ['/api/full-room/socket', '/api/full-room/socket/']) {
        const denied = await mf.dispatchFetch(origin + path);
        assert.equal(denied.status, 401);
        const invalid = await mf.dispatchFetch(origin + path + '?code=bad', { headers: { cookie, origin } });
        assert.equal(invalid.status, 400);
      }
      for (const path of ['/api/game', '/api/game/']) for (const method of ['GET', 'POST']) {
        const denied = await mf.dispatchFetch(origin + path, { method });
        assert.equal(denied.status, 401);
        const retired = await mf.dispatchFetch(origin + path, { method, headers: { cookie, origin } });
        assert.equal(retired.status, 410);
        assert.match(retired.headers.get('cache-control'), /no-store/);
        assert.equal((await retired.json()).next, '/online');
      }
    });
    for (const capacity of [4, 6, 8]) await t.test(`${capacity} sockets preserve private inboxes, survive eviction and reject stale epochs`, async () => {
      const seats = Array.from({ length: capacity }, (_, n) => ({ token: randomBytes(32).toString('hex'), connection: randomUUID(), name: `測試${n + 1}` }));
      const created = await request({ type: 'create', token: seats[0].token, name: seats[0].name, title: `本機${capacity}人`, capacity });
      assert.equal(created.status, 200);
      const code = created.data.room.code;
      seats[0].id = created.data.room.me;
      for (const seat of seats.slice(1)) {
        const joined = await request({ type: 'join', code, token: seat.token, name: seat.name });
        assert.equal(joined.status, 200); seat.id = joined.data.room.me;
      }
      for (const seat of seats) {
        assert.equal((await request({ type: 'attach', code, token: seat.token, connection: seat.connection })).status, 200);
        seat.socket = await openSocket(code, seat);
      }
      const host = seats[0];
      const messages = seats.slice(1).map(seat => ({ id: randomUUID(), to: seat.id, connection: seat.connection, data: JSON.stringify(['private-hand', seat.name]) }));
      const sent = await sync(host.socket, code, host, { messages, started: true });
      assert.equal(sent.status, 200); assert.equal(sent.data.room.status, 'playing');
      assert.equal(sent.data.sequence, capacity - 1);
      const retried = await sync(host.socket, code, host, { messages });
      assert.equal(retried.data.sequence, sent.data.sequence);
      for (const seat of seats.slice(1)) {
        const inbox = await sync(seat.socket, code, seat);
        assert.equal(inbox.status, 200); assert.equal(inbox.data.messages.length, 1);
        assert.deepEqual(JSON.parse(inbox.data.messages[0].data), ['private-hand', seat.name]);
        seat.ack = inbox.data.sequence;
        assert.equal((await sync(seat.socket, code, seat, { ack: seat.ack })).data.messages.length, 0);
      }
      await mf.unsafeEvictDurableObject('starcup-local-acceptance', 'GrailRoom', { name: code, webSockets: 'hibernate' });
      const guest = seats[1];
      const next = await sync(host.socket, code, host, { messages: [{ id: randomUUID(), to: guest.id, connection: guest.connection, data: '["update","after-hibernation"]' }] });
      assert.equal(next.status, 200);
      const inbox = await sync(guest.socket, code, guest, { ack: guest.ack });
      assert.equal(inbox.data.messages.length, 1);
      assert.deepEqual(JSON.parse(inbox.data.messages[0].data), ['update', 'after-hibernation']);
      const old = { ...guest };
      guest.connection = randomUUID();
      assert.equal((await request({ type: 'attach', code, token: guest.token, connection: guest.connection })).status, 200);
      assert.equal((await request({ type: 'sync', code, token: old.token, connection: old.connection, ack: 0, messages: [] })).status, 409);
      guest.socket = await openSocket(code, guest);
      const rejoined = await sync(guest.socket, code, guest, { ack: next.data.sequence });
      assert.equal(rejoined.status, 200); assert.equal(rejoined.data.messages.length, 0);
      const privateResult = await sync(guest.socket, code, guest, { ack: next.data.sequence,
        messages: [{ id: randomUUID(), to: host.id, data: '["result",{"bool":true}]' }] });
      assert.equal(privateResult.status, 200);
      // A cached host page retains its engine and epoch. Reopen transport only:
      // do not attach a new session or discard an unacknowledged guest result.
      host.socket.close();
      host.socket = await openSocket(code, host);
      const hostInbox = await sync(host.socket, code, host);
      assert.equal(hostInbox.data.messages.length, 1);
      assert.equal(hostInbox.data.room.status, 'playing');
      assert.deepEqual(JSON.parse(hostInbox.data.messages[0].data), ['result', { bool: true }]);
      assert.equal((await sync(host.socket, code, host, { ack: hostInbox.data.sequence })).data.messages.length, 0);
      assert.equal((await request({ type: 'leave', code, token: host.token })).status, 200);
      assert.equal((await sync(guest.socket, code, guest)).status, 410);
      assert.equal((await request({ type: 'join', code, token: guest.token, name: guest.name })).status, 410);
    });
    await t.test('a waiting host recovers only after expiry; SQLite survives eviction and guests rejoin the same room', async () => {
      const host = { token: randomBytes(32).toString('hex'), connection: randomUUID() };
      const guest = { token: randomBytes(32).toString('hex'), connection: randomUUID() };
      const created = await request({ type: 'create', token: host.token, name: '房主', title: '等待室恢復', capacity: 4 });
      const code = created.data.room.code;
      const joined = await request({ type: 'join', code, token: guest.token, name: '原玩家' });
      const seatId = joined.data.room.me;
      assert.equal((await request({ type: 'attach', code, ...host, protocol: 2 })).status, 200);
      assert.equal((await request({ type: 'attach', code, ...guest, protocol: 2 })).status, 200);
      guest.socket = await openSocket(code, guest);
      const replacement = { token: host.token, connection: randomUUID() };
      assert.equal((await request({ type: 'attach', code, ...replacement })).status, 409);
      assert.equal((await request({ type: 'recover-check', code, token: host.token })).status, 409);
      assert.equal((await request({ type: 'recover-check', code, token: guest.token })).status, 403);
      assert.equal((await request({ type: 'sync', code, ...host, ack: 0, messages: [] })).data.room.status, 'waiting');
      // Real local expiry, with no production traffic or injected match state.
      // Split the wait so individual waits remain under one minute.
      await new Promise(resolve => setTimeout(resolve, 30_500));
      await new Promise(resolve => setTimeout(resolve, 30_500));
      // The idle object may already have hibernated on its own. Wake it with
      // a read-only check before explicitly exercising another eviction.
      assert.equal((await request({ type: 'recover-check', code, token: host.token })).status, 200);
      await mf.unsafeEvictDurableObject('starcup-local-acceptance', 'GrailRoom', { name: code, webSockets: 'hibernate' });
      assert.equal((await request({ type: 'recover-check', code, token: host.token })).status, 200);
      const restored = await request({ type: 'attach', code, ...replacement, protocol: 2, recover: true });
      assert.equal(restored.status, 200);
      assert.equal(restored.data.room.code, code); assert.equal(restored.data.room.count, 2);
      assert.equal(restored.data.peers.length, 0);
      const stale = await sync(guest.socket, code, guest, { messages: [{ id: randomUUID(), to: '1', data: '["result",{"old":true}]' }] });
      assert.equal(stale.status, 200); assert.equal(stale.data.rejoinLobby, true);
      assert.equal(stale.data.sequence, 0, 'old choices were not forwarded');
      guest.connection = randomUUID();
      const rejoined = await request({ type: 'attach', code, token: guest.token, connection: guest.connection, protocol: 2 });
      assert.equal(rejoined.data.room.me, seatId); assert.equal(rejoined.data.rejoinLobby, false);
      assert.equal((await request({ type: 'start', code, ...host })).status, 409);
      assert.equal((await request({ type: 'start', code, token: guest.token, connection: guest.connection })).status, 403);
      assert.equal((await request({ type: 'start', code, ...replacement })).status, 200);
      await mf.unsafeEvictDurableObject('starcup-local-acceptance', 'GrailRoom', { name: code, webSockets: 'hibernate' });
      assert.equal((await request({ type: 'start', code, ...replacement })).data.room.status, 'playing', 'lost reply retries retain started boundary');
      assert.equal((await request({ type: 'attach', code, token: host.token, connection: randomUUID(), protocol: 2, recover: true })).status, 409);
      assert.equal((await request({ type: 'recover-check', code, token: host.token })).status, 409);
      assert.equal((await request({ type: 'sync', code, ...replacement, ack: 0, messages: [] })).data.room.status, 'playing');
      assert.equal((await request({ type: 'leave', code, token: host.token })).status, 200);
    });
    await t.test('a lost join reply can be retried after start without consuming a second seat', async () => {
      const hostToken = randomBytes(32).toString('hex');
      const created = await request({ type: 'create', token: hostToken, name: '房主', title: '加入回覆遺失', capacity: 4 });
      assert.equal(created.status, 200);
      const code = created.data.room.code;
      const values = new Map();
      const storage = { getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
      const guestInput = { type: 'join', code, name: '重試玩家', title: '', capacity: 4 };
      let replies = 0;
      const clientRequest = async (_url, init) => {
        const body = JSON.parse(init.body);
        const response = await mf.dispatchFetch(origin + '/api/full-room', {
          ...init, headers: { cookie, origin, 'content-type': 'application/json' },
        });
        assert.equal(response.status, 200);
        assert.equal(body.token, storage.getItem(seatKey(code)));
        if (++replies === 1) {
          // Persist the first join, start the room, then lose only its HTTP
          // reply. This is a local transport fixture, not a completed game.
          await response.arrayBuffer();
          const connection = randomUUID();
          assert.equal((await request({ type: 'attach', code, token: hostToken, connection })).status, 200);
          assert.equal((await request({ type: 'sync', code, token: hostToken, connection, ack: 0, messages: [], started: true })).status, 200);
          throw new TypeError('Simulated lost reply');
        }
        return response;
      };
      const options = { storage: () => storage, request: clientRequest };
      await assert.rejects(enterOnlineRoom(guestInput, new AbortController().signal, options), TypeError);
      const retainedToken = storage.getItem(seatKey(code));
      assert.match(retainedToken, /^[a-f0-9]{64}$/);
      const joined = await enterOnlineRoom(guestInput, new AbortController().signal, options);
      assert.equal(joined.nickname, '重試玩家');
      assert.equal(joined.isHost, false);
      assert.equal(storage.getItem(seatKey(code)), retainedToken);
      const view = await request({ type: 'join', code, token: hostToken, name: '房主' });
      assert.equal(view.data.room.status, 'playing');
      assert.equal(view.data.room.count, 2, 'retry must not consume another seat');
      assert.equal((await request({ type: 'leave', code, token: hostToken })).status, 200);
    });
    await t.test('a lost create reply survives eviction and an IP change, while launched rooms cannot be reset', async () => {
      const values = new Map();
      const storage = { getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
      const input = { type: 'create', code: '', name: '重試房主', title: '開房回覆遺失', capacity: 4 };
      let first, body, replies = 0;
      const clientRequest = async (_url, init) => {
        body = JSON.parse(init.body);
        const result = await request(body, { 'cf-connecting-ip': ++replies === 1 ? '198.51.100.71' : '198.51.100.72' });
        assert.equal(result.status, 200);
        if (replies === 1) { first = result.data.room; throw new TypeError('Lost create response'); }
        assert.equal(result.data.room.count, 2);
        return Response.json(result.data);
      };
      const options = { storage: () => storage, request: clientRequest };
      await assert.rejects(enterOnlineRoom(input, new AbortController().signal, options), TypeError);
      const token = JSON.parse(storage.getItem(PENDING_CREATION_KEY)).token;
      const code = first.code;
      assert.equal((await request({ type: 'join', code, token: randomBytes(32).toString('hex'), name: '朋友' })).status, 200);
      await mf.unsafeEvictDurableObject('starcup-local-acceptance', 'GrailRoom', { name: code });
      const room = await enterOnlineRoom(input, new AbortController().signal, options);
      assert.equal(room.code, code); assert.equal(storage.getItem(seatKey(code)), token);
      assert.equal(storage.getItem(PENDING_CREATION_KEY), null);
      const connection = randomUUID();
      assert.equal((await request({ type: 'attach', code, token, connection })).status, 200);
      assert.equal((await request(body)).status, 410);
      const continuing = await request({ type: 'sync', code, token, connection, ack: 0, messages: [], started: true });
      assert.equal(continuing.status, 200); assert.equal(continuing.data.room.count, 2);
      assert.equal(continuing.data.room.status, 'playing');
      assert.equal((await request(body)).status, 410);
      assert.equal((await request({ type: 'leave', code, token })).status, 200);
      assert.equal((await request(body)).status, 410);
    });
    await t.test('concurrent create retries share one reservation; distinct rooms still obey the five-room limit', async () => {
      const headers = { 'cf-connecting-ip': '198.51.100.81' };
      const body = { type: 'create', token: randomBytes(32).toString('hex'), name: '房主', title: '併發重試', capacity: 4 };
      for (let i = 0; i < 6; i++) assert.equal((await request({ ...body, capacity: 5 }, headers)).status, 400);
      const replies = await Promise.all(Array.from({ length: 8 }, () => request(body, headers)));
      assert.ok(replies.every(reply => reply.status === 200));
      const codes = new Set(replies.map(reply => reply.data.room.code));
      assert.equal(codes.size, 1);
      for (let i = 0; i < 4; i++) {
        const result = await request({ ...body, token: randomBytes(32).toString('hex') }, headers);
        assert.equal(result.status, 200); codes.add(result.data.room.code);
      }
      assert.equal(codes.size, 5);
      assert.equal((await request({ ...body, token: randomBytes(32).toString('hex') }, headers)).status, 429);
      assert.equal((await request(body, headers)).status, 200, 'existing creation recovers even at the rate limit');
    });
  } finally {
    for (const socket of sockets) try { socket.close(); } catch {}
    await mf.dispose();
  }
});
