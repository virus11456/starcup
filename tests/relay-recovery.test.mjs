import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelayLifecycle } from '../vendor/noname/overrides/grail-relay-lifecycle.js';
import { clock, page, deferred, settle, socketHarness, onlineHarness } from './helpers/relay-harness.mjs';

test('cached pages stop transport and resume the same runner, coalescing recovery signals', async () => {
  const time = clock(), p = page();
  let polls = 0, disconnects = 0;
  const runner = createRelayLifecycle({ window: p.win, document: p.doc, setTimer: time.setTimer, clearTimer: time.clearTimer,
    poll: async () => { polls++; return 10_000; }, disconnect: () => disconnects++ });
  runner.wake(); await time.tick(); assert.equal(polls, 1);
  p.doc.visibilityState = 'hidden'; p.emit(p.doc, 'visibilitychange');
  assert.equal(disconnects, 0, 'a running background host must keep its transport');
  p.emit(p.win, 'pagehide', { persisted: true });
  await time.tick(60_000); assert.equal(polls, 1); assert.equal(disconnects, 1);
  p.emit(p.win, 'online'); await time.tick(); assert.equal(polls, 1);
  p.emit(p.win, 'pageshow', { persisted: true });
  p.doc.visibilityState = 'visible'; p.emit(p.doc, 'visibilitychange'); p.emit(p.win, 'online');
  await time.tick(); assert.equal(polls, 2); assert.equal(time.timers.size, 1);
  runner.stop(); assert.equal(time.timers.size, 0);
});

test('returning while the previous poll settles never overlaps two sync requests', async () => {
  const time = clock(), p = page(), pending = deferred();
  let polls = 0, inFlight = 0, maximum = 0;
  const runner = createRelayLifecycle({ window: p.win, document: p.doc, setTimer: time.setTimer, clearTimer: time.clearTimer,
    poll: async () => { polls++; maximum = Math.max(maximum, ++inFlight); if (polls === 1) await pending.promise; inFlight--; return 10_000; }, disconnect() {} });
  runner.wake(); await time.tick();
  p.emit(p.win, 'pagehide', { persisted: true }); p.emit(p.win, 'pageshow', { persisted: true });
  runner.wake(); await time.tick(); assert.equal(polls, 1);
  pending.resolve(); await settle(); await time.tick(80);
  assert.equal(polls, 2); assert.equal(maximum, 1); runner.stop();
});

for (const reason of ['unload', 'fatal']) test(`${reason} stops permanently and cannot resurrect a closed native room`, async () => {
  const time = clock(), p = page(); let polls = 0, disconnects = 0;
  const runner = createRelayLifecycle({ window: p.win, document: p.doc, setTimer: time.setTimer, clearTimer: time.clearTimer,
    poll: async () => { polls++; return reason === 'fatal' ? null : 10_000; }, disconnect: () => disconnects++ });
  runner.wake(); await time.tick();
  if (reason === 'unload') p.emit(p.win, 'pagehide', { persisted: false });
  p.emit(p.win, 'pageshow', { persisted: true }); p.emit(p.win, 'online'); runner.wake();
  await time.tick(60_000); assert.equal(polls, 1); assert.equal(disconnects, 1); assert.equal(runner.inactive, true);
});

test('concurrent socket requests share one authenticated connection and match out-of-order replies', async () => {
  const h = socketHarness(); let wakes = 0;
  const relay = h.createSocket('LOCAL123', 'private-seat', 'same-epoch', () => wakes++);
  const a = relay.request({ ack: 1 }), b = relay.request({ ack: 2 });
  assert.equal(h.sockets.length, 1);
  const socket = h.sockets[0]; socket.open(); await settle();
  assert.equal(socket.url.href, 'wss://local.test/api/full-room/socket?code=LOCAL123');
  assert.deepEqual(Array.from(socket.protocols), ['grail-v1', 'seat-private-seat', 'connection-same-epoch']);
  socket.receive({ wake: true }); socket.reply({ value: 'second' }, 1); socket.reply({ value: 'first' }, 0);
  assert.equal((await a).value, 'first'); assert.equal((await b).value, 'second'); assert.equal(wakes, 1);
  assert.equal(h.time.timers.size, 0); relay.close();
});

test('closing during socket opening rejects immediately and late events cannot break the replacement', async () => {
  const h = socketHarness(), relay = h.createSocket('LOCAL123', 'seat', 'epoch', () => {});
  const first = relay.request({}); const rejected = assert.rejects(first, /連線中斷/);
  const old = h.sockets[0]; relay.close(); await rejected;
  const next = relay.request({ ack: 8 }); const current = h.sockets[1];
  old.closed(); old.fail(); old.open();
  current.open(); await settle();
  assert.equal(current.sent.length, 1); current.reply({ sequence: 8 });
  assert.equal((await next).sequence, 8); assert.equal(h.time.timers.size, 0); relay.close();
});

test('late close, error, wake and replies from an old socket never reject or resolve a new request', async () => {
  const h = socketHarness(); let wakes = 0;
  const relay = h.createSocket('LOCAL123', 'seat', 'epoch', () => wakes++);
  const first = relay.request({}), rejected = assert.rejects(first, /連線中斷/);
  const old = h.sockets[0]; old.open(); await settle(); relay.close(); await rejected;
  let settled = false;
  const next = relay.request({}).finally(() => { settled = true; });
  const current = h.sockets[1]; current.open(); await settle();
  old.closed(); old.fail(); old.receive({ wake: true });
  old.receive({ id: current.sent[0].id, status: 200, data: { wrong: true } });
  await settle(); assert.equal(settled, false); assert.equal(wakes, 0);
  current.reply({ right: true }); assert.equal((await next).right, true); relay.close();
});

test('connection and response timeouts release the transport for a fresh retry', async () => {
  const h = socketHarness(), relay = h.createSocket('LOCAL123', 'seat', 'epoch', () => {});
  const opening = assert.rejects(relay.request({}), /連線逾時/);
  await h.time.tick(5000); await opening;
  const timedOut = assert.rejects(relay.request({}), /同步逾時/);
  h.sockets[1].open(); await settle(); await h.time.tick(15_000); await timedOut;
  const recovered = relay.request({}); h.sockets[2].open(); await settle();
  h.sockets[0].closed(); h.sockets[1].closed(); h.sockets[2].reply({ ok: true });
  assert.equal((await recovered).ok, true); assert.equal(h.time.timers.size, 0); relay.close();
});

for (const isHost of [false, true]) test(`real ${isHost ? 'host' : 'guest'} adapter resumes its epoch, ack and unsent operation without HTTP fallback or message replay`, async () => {
  const h = await onlineHarness({ isHost });
  const nativeSocket = h.game.ws;
  await h.time.tick(); const first = h.sockets[0]; first.open(); await settle();
  const message = { seq: 4, from: isHost ? '2' : '1', data: '["result",{"bool":true}]' };
  const peers = isHost ? [{ id: '2', connection: 'guest-epoch' }] : [];
  first.reply({ sequence: 4, messages: [message], peers, hostAlive: true }); await settle();
  const result = '["result",{"bool":false}]';
  nativeSocket.send(isHost ? JSON.stringify(['server', 'send', '2', result]) : result);
  await h.time.tick(40); const lost = first.sent.at(-1);
  assert.equal(lost.ack, 4); assert.equal(lost.messages.length, 1);
  h.emit(h.win, 'pagehide', { persisted: true }); await settle();
  await h.time.tick(30_000);
  assert.equal(h.calls.length, 1, 'suspension must not start an HTTP fallback');
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick();
  const restored = h.sockets[1]; restored.open(); await settle();
  first.closed(); first.fail();
  const retry = restored.sent[0];
  assert.equal(retry.connection, lost.connection); assert.equal(retry.ack, 4);
  assert.deepEqual(retry.messages, lost.messages, 'preserve the server deduplication ID');
  restored.reply({ sequence: 5, messages: [message, { ...message, seq: 5, data: '["result",{"next":true}]' }], peers, hostAlive: true });
  await settle();
  assert.deepEqual(h.received, [['result', { bool: true }], ['result', { next: true }]]);
  assert.equal(h.game.ws, nativeSocket); assert.equal(h.calls.length, 1); assert.equal(h.sessionReads(), 1);
  assert.equal(h.warnings.length, 0); assert.equal(h.status.hidden, true);
  h.game.ws.close(); assert.equal(h.time.timers.size, 0);
});

test('real HTTP adapter aborts a cached request and resumes the same seat without reattaching', async () => {
  const h = await onlineHarness({ transport: 'http' });
  await h.time.tick(); assert.equal(h.calls.length, 2);
  const original = h.calls[1]; h.emit(h.win, 'pagehide', { persisted: true }); await settle();
  assert.equal(original.signal.aborted, true); await h.time.tick(30_000); assert.equal(h.calls.length, 2);
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick();
  assert.equal(h.calls.length, 3); assert.equal(h.calls[2].body.connection, original.body.connection);
  h.calls[2].resolve({ sequence: 0, messages: [], hostAlive: true }); await settle();
  assert.equal(h.warnings.length, 0); assert.equal(h.status.hidden, true); h.game.ws.close();
});

test('real adapter stops on a stale epoch and does not retry via HTTP or visibility changes', async () => {
  const h = await onlineHarness(); await h.time.tick(); h.sockets[0].open(); await settle();
  h.sockets[0].reply({ error: '此座位已由另一個分頁連接。' }, 0, 409); await settle();
  assert.match(h.status.textContent, /另一個分頁/); assert.equal(h.time.timers.size, 0);
  h.emit(h.win, 'online'); h.emit(h.doc, 'visibilitychange'); await h.time.tick(60_000);
  assert.equal(h.calls.length, 1); assert.equal(h.sockets.length, 1);
});
