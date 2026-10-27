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

test('permanently stopped adapters discard later engine messages instead of growing an unsendable outbox', async () => {
  for (const isHost of [false, true]) for (const reason of ['native-close', 'unload', 'quota']) {
    const h = await onlineHarness({ isHost });
    await h.time.tick(); h.sockets[0].open(); await settle();
    if (reason === 'quota') h.sockets[0].reply({ error: '今日額度已用完。' }, 0, 429);
    else if (reason === 'unload') h.emit(h.win, 'pagehide', { persisted: false });
    else h.game.ws.close();
    await settle();
    assert.equal(h.game.ws.readyState, 3, `${reason}: native transport must report closed`);
    const before = h.generatedIds();
    const data = '["result",{"bool":true}]';
    for (let i = 0; i < 1000; i++) h.game.ws.send(isHost ? JSON.stringify(['server', 'send', '2', data]) : data);
    assert.equal(h.generatedIds(), before, `${reason}: no new queued message identifiers after permanent stop`);
    h.emit(h.win, 'online'); h.emit(h.doc, 'visibilitychange'); await h.time.tick(60_000);
    assert.equal(h.time.timers.size, 0); assert.equal(h.calls.length, 1); assert.equal(h.sockets.length, 1);
  }
});

for (const transport of ['websocket', 'http']) test(`long guest suspension uses native rejoin without submitting a stale choice (${transport})`, async () => {
  const h = await onlineHarness({ transport });
  await h.time.tick();
  if (transport === 'websocket') { h.sockets[0].open(); await settle(); }
  const initial = { sequence: 4, messages: [{ seq: 4, from: '1', data: '["update","before-pause"]' }], hostAlive: true };
  if (transport === 'websocket') h.sockets[0].reply(initial); else h.calls[1].resolve(initial);
  await settle();
  h.game.ws.send('["result",{"bool":true,"id":"old-choice"}]');
  await h.time.tick(40);
  h.emit(h.win, 'pagehide', { persisted: true }); await settle();
  await h.time.tick(130_000);
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick();
  if (transport === 'websocket') { h.sockets[1].open(); await settle(); }
  const probe = transport === 'websocket' ? h.sockets[1].sent[0] : h.calls.at(-1).body;
  assert.equal(probe.ack, 4, 'do not acknowledge missing updates');
  assert.equal(probe.messages.length, 0, 'do not resend a choice from the old event');
  const ids = h.generatedIds();
  h.game.ws.send('["result",{"bool":false,"id":"another-stale-choice"}]');
  assert.equal(h.generatedIds(), ids, 'stale UI cannot enqueue more choices while recovering');
  const partial = { sequence: 20, messages: [{ seq: 20, from: '1', data: '["update","partial-after-expiry"]' }], hostAlive: true };
  if (transport === 'websocket') h.sockets[1].reply(partial); else h.calls.at(-1).resolve(partial);
  await settle();
  assert.deepEqual(h.received, [['update', 'before-pause']], 'never apply an incomplete inbox to the old arena');
  assert.equal(h.reloads(), 1); assert.equal(h.nativeStatus.reloading, true);
  assert.equal(h.game.ws.readyState, 3); assert.equal(h.time.timers.size, 0);
  assert.equal(h.sessionReads(), 1, 'the same seat stays in sessionStorage for native reinitialization');
  h.emit(h.win, 'online'); h.emit(h.doc, 'visibilitychange'); await h.time.tick(60_000);
  assert.equal(h.reloads(), 1); assert.equal(h.time.timers.size, 0);
});

test('a stale guest waits for the original host and never applies partial replies or enters a reload loop', async () => {
  const h = await onlineHarness(); await h.time.tick(); h.sockets[0].open(); await settle();
  h.sockets[0].reply({ sequence: 0, messages: [], hostAlive: true }); await settle();
  h.emit(h.win, 'pagehide', { persisted: true }); await h.time.tick(95_000);
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick(); h.sockets[1].open(); await settle();
  for (let i = 0; i < 3; i++) {
    h.sockets[1].reply({ sequence: 8, messages: [{ seq: 8, from: '1', data: '["update","stale"]' }], hostAlive: false }); await settle();
    assert.equal(h.reloads(), 0); assert.equal(h.received.length, 0); assert.match(h.status.textContent, /等待房主/);
    await h.time.tick(30_000);
    assert.equal(h.sockets[1].sent.at(-1).ack, 0); assert.equal(h.sockets[1].sent.at(-1).messages.length, 0);
  }
  h.sockets[1].reply({ sequence: 8, messages: [], hostAlive: true }); await settle();
  assert.equal(h.reloads(), 1); assert.equal(h.time.timers.size, 0);
});

test('a connected guest fences its old choices as soon as the playing host is confirmed absent', async () => {
  const h = await onlineHarness(); await h.time.tick(); h.sockets[0].open(); await settle();
  h.sockets[0].reply({ sequence: 2, messages: [], hostAlive: true }); await settle();
  h.game.ws.send('["result",{"id":"outdated-answer"}]');
  await h.time.tick(40);
  assert.equal(h.sockets[0].sent.at(-1).messages.length, 1);
  h.sockets[0].reply({ sequence: 6, messages: [{ seq: 6, from: '1', data: '["update","partial"]' }], hostAlive: false });
  await settle();
  assert.equal(h.received.length, 0, 'an incomplete inbox cannot update the old native picker');
  assert.match(h.status.textContent, /等待房主/);
  assert.match(h.status.textContent, /關閉分頁.*無法接手/);
  assert.equal(h.status.classList.contains('recovering'), true, 'stale actions must be blocked by the recovery overlay');
  assert.equal(h.reloads(), 0);
  const before = h.generatedIds();
  h.game.ws.send('["result",{"id":"another-outdated-answer"}]');
  assert.equal(h.generatedIds(), before, 'the obsolete choice cannot enter the durable relay');
  await h.time.tick(10_000);
  assert.equal(h.sockets[0].sent.at(-1).messages.length, 1, 'do not retry a stale choice while waiting for the original host');
  await h.time.tick(20_000);
  assert.equal(h.sockets[0].sent.at(-1).messages.length, 0, 'the prior unacknowledged choice is dropped before retry');
  assert.equal(h.sockets[0].sent.at(-1).ack, 2, 'do not acknowledge unread host updates');
  h.sockets[0].reply({ sequence: 6, messages: [], hostAlive: true }); await settle();
  assert.equal(h.reloads(), 1, 'reconnect only after the original host is alive again');
  assert.equal(h.time.timers.size, 0);
});

test('HTTP fallback keeps the guest seat alive without rapid polling while the host is absent', async () => {
  const h = await onlineHarness({ transport: 'http' });
  await h.time.tick();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve({ sequence: 1, messages: [], hostAlive: false });
  await settle();
  assert.equal(h.status.classList.contains('recovering'), true);
  await h.time.tick(29_000);
  assert.equal(h.calls.length, 2, 'do not continue the normal 600ms HTTP polling cadence while the host is gone');
  await h.time.tick(1_000);
  assert.equal(h.calls.length, 3, 'renew the guest lease before its 60s expiration');
  assert.equal(h.calls[2].body.messages.length, 0);
  h.calls[2].resolve({ sequence: 1, messages: [], hostAlive: true });
  await settle();
  assert.equal(h.reloads(), 1, 'resume a clean native guest only when the original host returns');
  assert.equal(h.time.timers.size, 0);
});

test('a guest in an unstarted lobby still waits for its first host without forcing native rejoin', async () => {
  const h = await onlineHarness({ roomStatus: 'waiting' });
  await h.time.tick(); h.sockets[0].open(); await settle();
  h.sockets[0].reply({ sequence: 0, messages: [], hostAlive: false, room: { status: 'waiting' } });
  await settle();
  assert.equal(h.reloads(), 0);
  assert.equal(h.status.classList.contains('recovering'), false);
  assert.match(h.status.textContent, /房主連線中斷/);
  await h.time.tick(10_000);
  h.sockets[0].reply({ sequence: 0, messages: [], hostAlive: true, room: { status: 'waiting' } });
  await settle();
  assert.equal(h.reloads(), 0);
  assert.equal(h.status.hidden, true);
  h.game.ws.close();
});

test('a response delayed by a frozen browser triggers guest rejoin before dispatching native messages', async () => {
  const h = await onlineHarness(); await h.time.tick(); h.sockets[0].open(); await settle();
  h.time.jump(130_000); // no timer callbacks while the browser process is frozen
  h.sockets[0].reply({ sequence: 9, messages: [{ seq: 9, from: '1', data: '["update","partial"]' }], hostAlive: true }); await settle();
  assert.equal(h.received.length, 0); assert.equal(h.reloads(), 1); assert.equal(h.time.timers.size, 0);
});

test('a long-suspended host retains its actual engine and retry batch instead of using guest reload', async () => {
  const h = await onlineHarness({ isHost: true }); await h.time.tick(); h.sockets[0].open(); await settle();
  const peers = [{ id: '2', connection: 'guest-epoch' }];
  h.sockets[0].reply({ sequence: 0, messages: [], peers, hostAlive: true }); await settle();
  const nativeSocket = h.game.ws;
  nativeSocket.send(JSON.stringify(['server', 'send', '2', '["update","host-event"]']));
  await h.time.tick(40); const lost = h.sockets[0].sent.at(-1);
  h.emit(h.win, 'pagehide', { persisted: true }); await settle(); await h.time.tick(130_000);
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick(); h.sockets[1].open(); await settle();
  assert.deepEqual(h.sockets[1].sent[0].messages, lost.messages);
  assert.equal(h.sockets[1].sent[0].connection, lost.connection);
  h.sockets[1].reply({ sequence: 1, messages: [], peers, hostAlive: true }); await settle();
  assert.equal(h.reloads(), 0); assert.equal(h.game.ws, nativeSocket); assert.equal(h.nativeStatus.reloading, undefined);
  h.game.ws.close();
});

for (const status of [401, 409, 410, 429]) test(`long guest suspension preserves terminal ${status} instead of auto-rejoining`, async () => {
  const h = await onlineHarness(); await h.time.tick(); h.sockets[0].open(); await settle();
  h.sockets[0].reply({ sequence: 0, messages: [], hostAlive: true }); await settle();
  h.emit(h.win, 'pagehide', { persisted: true }); await h.time.tick(130_000);
  h.emit(h.win, 'pageshow', { persisted: true }); await h.time.tick(); h.sockets[1].open(); await settle();
  h.sockets[1].reply({ error: '測試終止原因' }, 0, status); await settle();
  assert.equal(h.reloads(), 0); assert.equal(h.game.ws.readyState, 3); assert.equal(h.time.timers.size, 0);
  assert.match(h.status.textContent, /測試終止原因/); assert.equal(h.calls.length, 1);
});
