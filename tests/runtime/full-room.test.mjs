import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { ACCESS_COOKIE, createAccessToken } from '../../lib/site-access.ts';

// Use the same workerd/Miniflare toolchain already installed by Wrangler.
// These bindings and credentials exist only in this in-memory local runtime.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const { build } = wranglerRequire('esbuild');
const root = new URL('../../', import.meta.url).pathname;

test('local Cloudflare runtime: real HTTP, WebSockets, SQLite and hibernation', { timeout: 60_000 }, async t => {
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
      const hostInbox = await sync(host.socket, code, host);
      assert.equal(hostInbox.data.messages.length, 1);
      assert.deepEqual(JSON.parse(hostInbox.data.messages[0].data), ['result', { bool: true }]);
      assert.equal((await request({ type: 'leave', code, token: host.token })).status, 200);
      assert.equal((await sync(guest.socket, code, guest)).status, 410);
      assert.equal((await request({ type: 'join', code, token: guest.token, name: guest.name })).status, 410);
    });
  } finally {
    for (const socket of sockets) try { socket.close(); } catch {}
    await mf.dispose();
  }
});
