import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { createHostGuard, guardHostInput } from '../vendor/noname/overrides/grail-host-guard.js';
import { clock, onlineHarness, settle } from './helpers/relay-harness.mjs';

function guardAt(time, onChange = () => {}) {
  return createHostGuard({ now: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer, onChange });
}
const response = { hostAlive: true, sequence: 0, messages: [], peers: [] };

test('host guard holds stalled continuations, rejects pre-interruption replies and never releases a stopped host', async () => {
  const time = clock(), changes = [], guard = guardAt(time, held => changes.push(held));
  await guard.wait(); // native lobby setup is not blocked before starting
  guard.arm();
  const oldTicket = guard.ticket();
  await time.tick(25_000);
  assert.equal(guard.blocked, true);
  let continued = 0;
  const waiting = guard.wait().then(() => continued++);
  await settle(); assert.equal(continued, 0);
  assert.equal(guard.confirm(oldTicket), false);
  await settle(); assert.equal(continued, 0);
  assert.equal(guard.confirm(guard.ticket()), true);
  await waiting;
  assert.equal(continued, 1);
  assert.deepEqual(changes, [true, false]);
  guard.stop();
  guard.confirm(guard.ticket()); guard.arm();
  void guard.wait().then(() => continued++);
  await time.tick(60_000);
  assert.equal(continued, 1); assert.equal(time.timers.size, 0);
});

test('fresh heartbeats keep a host running; frozen or backwards clocks require new confirmation', async () => {
  const time = clock(), guard = guardAt(time);
  guard.arm();
  for (let i = 0; i < 5; i++) {
    await time.tick(10_000);
    assert.equal(guard.blocked, false);
    guard.confirm(guard.ticket());
  }
  time.jump(90_000); // timers did not run in the suspended browser
  assert.equal(guard.blocked, true);
  guard.confirm(guard.ticket());
  time.jump(-1000);
  assert.equal(guard.blocked, true);
  guard.stop();
});

test('host input blocks touch, mouse and keyboard only while held', () => {
  const win = new EventTarget(), time = clock(), guard = guardAt(time);
  const remove = guardHostInput(win, guard);
  let choices = 0;
  win.addEventListener('keydown', () => choices++);
  guard.arm();
  win.dispatchEvent(new Event('keydown', { cancelable: true }));
  assert.equal(choices, 1);
  guard.hold();
  for (const type of ['click', 'pointerdown', 'touchstart', 'keydown']) {
    const event = new Event(type, { cancelable: true });
    win.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
  }
  assert.equal(choices, 1);
  guard.confirm(guard.ticket());
  win.dispatchEvent(new Event('keydown', { cancelable: true }));
  assert.equal(choices, 2);
  remove(); guard.stop();
});

test('host HTTP failure holds the native engine and reuses its pending batch until acknowledged', async () => {
  const h = await onlineHarness({ transport: 'http', isHost: true });
  h.game.ws.send(JSON.stringify(['server', 'send', '2', '["update",1]']));
  await h.time.tick(40);
  const sent = h.calls.at(-1).body.messages;
  assert.equal(sent.length, 1);
  h.calls.at(-1).resolve({ error: '暫時無法連線' }, 503);
  await settle();
  let continued = false;
  void h.game.grailWaitForRelay().then(() => { continued = true; });
  await settle();
  assert.equal(continued, false); assert.equal(h.status.classList.contains('recovering'), true);
  await h.time.tick(1200);
  assert.deepEqual(h.calls.at(-1).body.messages, sent);
  h.calls.at(-1).resolve(response);
  await settle();
  assert.equal(continued, true); assert.equal(h.status.classList.contains('recovering'), false);
  assert.equal(h.calls.filter(call => call.body.type === 'attach').length, 1);
  assert.equal(h.reloads(), 0);
  h.emit(h.win, 'pagehide', { persisted: false });
});

test('an offline event fences an already pending reply; only the next synchronization releases play', async () => {
  const h = await onlineHarness({ transport: 'http', isHost: true });
  await h.time.tick(0);
  h.emit(h.win, 'offline');
  let continued = false;
  void h.game.grailWaitForRelay().then(() => { continued = true; });
  h.calls.at(-1).resolve(response);
  await settle();
  assert.equal(continued, false); assert.equal(h.status.classList.contains('recovering'), true);
  await h.time.tick(80);
  h.calls.at(-1).resolve(response);
  await settle();
  assert.equal(continued, true);
  h.emit(h.win, 'pagehide', { persisted: false });
});

test('bfcache holds the host until its resumed poll succeeds and terminal replies cannot revive it', async () => {
  const h = await onlineHarness({ transport: 'http', isHost: true });
  await h.time.tick(0);
  h.emit(h.win, 'pagehide', { persisted: true });
  await settle();
  let continued = 0;
  void h.game.grailWaitForRelay().then(() => continued++);
  h.emit(h.win, 'pageshow', { persisted: true });
  await h.time.tick(0);
  assert.equal(continued, 0);
  h.calls.at(-1).resolve(response); await settle();
  assert.equal(continued, 1);
  await h.time.tick(600);
  h.calls.at(-1).resolve({ error: '此連線已過期' }, 409); await settle();
  assert.match(h.status.textContent, /此連線已過期/);
  void h.game.grailWaitForRelay().then(() => continued++);
  const count = h.calls.length;
  h.emit(h.win, 'online'); h.emit(h.doc, 'visibilitychange');
  await h.time.tick(60_000);
  assert.equal(continued, 1); assert.equal(h.calls.length, count);
  assert.equal(h.reloads(), 0);
});

test('native PauseManager keeps manual and choice pauses independent of transport recovery', async () => {
  const source = (await fs.readFile(new URL('../public/engine/noname/game/PauseManager.js', import.meta.url), 'utf8'))
    .replace(/^import .*$/m, '').replace('export default class', 'class');
  const time = clock(), guard = guardAt(time);
  const game = { grailWaitForRelay: () => guard.wait() };
  const lib = { status: {} };
  const PauseManager = vm.runInNewContext(source + '\nPauseManager;', { game, lib, _status: {}, Date, Promise });
  const manager = new PauseManager();
  guard.arm(); guard.hold();
  let continued = 0;
  const waiting = manager.waitPause().then(() => continued++);
  await settle();
  manager.pause2.start(); // user pause begins while transport is already held
  guard.confirm(guard.ticket());
  await settle(); assert.equal(continued, 0);
  manager.pause.start(); // a native choice independently owns pause
  manager.pause2.resolve();
  await settle(); assert.equal(continued, 0);
  manager.pause.resolve();
  await waiting; assert.equal(continued, 1);
  guard.stop();
  // Unmodified solo flow has no transport hook and still waits for pause2.
  delete game.grailWaitForRelay;
  manager.pause2.start();
  const solo = manager.waitPause().then(() => continued++);
  await settle(); assert.equal(continued, 1);
  manager.pause2.resolve(); await solo;
  assert.equal(continued, 2);
});

test('native choice timeout cannot select AI while transport is held or overwrite a received result', async () => {
  const source = await fs.readFile(new URL('../public/engine/noname/library/element/player.js', import.meta.url), 'utf8');
  const start = source.indexOf('\n\twait(callback) {');
  assert.ok(start > 0);
  const method = source.slice(start, source.indexOf('\n\tunwait(result) {', start));
  const time = clock(), guard = guardAt(time), results = [];
  let closed = 0;
  const game = { grailWaitForRelay: () => guard.wait(), players: [] };
  const lib = { node: { torespond: {}, torespondtimeout: {} }, configOL: { choose_timeout: 1 } };
  const wait = vm.runInNewContext('({' + method + '}).wait', {
    game, lib, _status: { event: { getParent: () => ({}) } },
    setTimeout: time.setTimer, clearTimeout: time.clearTimer,
  });
  const player = { playerid: 'friend', showTimer() {},
    ws: { closed: false, ws: { close() { closed++; } } },
    unwait(result) { results.push(result); delete lib.node.torespondtimeout[this.playerid]; } };
  guard.arm(); wait.call(player); guard.hold();
  await time.tick(6000);
  assert.deepEqual(results, []); assert.equal(closed, 0);
  // The resumed poll applies the actual reply before releasing the barrier.
  player.unwait({ bool: true });
  guard.confirm(guard.ticket()); await settle();
  assert.deepEqual(results, [{ bool: true }]); assert.equal(closed, 0);
  wait.call(player); await time.tick(6000);
  assert.deepEqual(results, [{ bool: true }, 'ai']); assert.equal(closed, 1);
  guard.stop();
  delete game.grailWaitForRelay;
  wait.call(player); await time.tick(6000);
  assert.equal(results.at(-1), 'ai'); assert.equal(closed, 2);
});
