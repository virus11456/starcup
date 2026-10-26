import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { onlineHarness, deferred, settle } from './helpers/relay-harness.mjs';

test('host start waits for durable acknowledgement and can retry a rejected reply', async () => {
  const h = await onlineHarness({ isHost: true, transport: 'http', roomStatus: 'waiting' });
  assert.equal(h.calls[0].body.protocol, 2);
  let completed = false;
  const first = h.game.grailRequestStart().then(result => { completed = true; return result; });
  await settle();
  assert.equal(completed, false);
  assert.equal(h.calls.at(-1).body.type, 'start');
  const connection = h.calls.at(-1).body.connection;
  h.calls.at(-1).resolve({ error: '連線暫時中斷' }, 503);
  assert.equal(await first, false);
  const second = h.game.grailRequestStart();
  assert.equal(h.calls.at(-1).body.connection, connection);
  h.calls.at(-1).resolve({ room: { status: 'playing' } });
  assert.equal(await second, true);
  h.emit(h.win, 'pagehide', { persisted: false });
});
test('leaving during a start aborts concurrent requests and never resumes the dead host', async () => {
  const h = await onlineHarness({ isHost: true, transport: 'http', roomStatus: 'waiting' });
  await h.time.tick(0); // pending heartbeat
  const start = h.game.grailRequestStart();
  h.emit(h.win, 'pagehide', { persisted: false });
  assert.equal(await start, false);
  assert.ok(h.calls.filter(call => call.body.type !== 'attach').every(call => call.signal.aborted));
  assert.equal(await h.game.grailRequestStart(), false);
});
test('guest discards old choices and reloads its native seat when the lobby generation changes', async () => {
  const h = await onlineHarness({ transport: 'http', roomStatus: 'waiting' });
  h.game.ws.send('["result",{"old":true}]');
  await h.time.tick(40);
  h.calls.at(-1).resolve({ rejoinLobby: true, hostAlive: true, sequence: 20,
    messages: [{ seq: 20, data: '["exec","stale-lobby"]' }], peers: [] });
  await settle();
  assert.equal(h.reloads(), 1);
  assert.equal(h.received.length, 0);
  assert.equal(h.game.ws.readyState, 3);
  assert.equal(h.nativeStatus.reloading, true);
});
test('the actual pinned start button keeps the lobby intact until approval and prevents double starts', async () => {
  const source = await fs.readFile(new URL('../public/engine/noname/ui/create/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('var button = ui.create.div(".menubutton.large.highlight.connectbutton.connectbutton1');
  assert.ok(start > 0);
  const section = source.slice(start, source.indexOf('var shareButton', start));
  const callback = section.slice(section.indexOf('async function'), section.lastIndexOf(');'));
  let resumes = 0, deletions = 0, requests = 0;
  const reply = deferred();
  const node = () => ({ delete() { deletions++; } });
  const button = node(), bar = node(), shareButton = node();
  const game = { online: false, resume() { resumes++; }, grailRequestStart() { requests++; return reply.promise; } };
  const click = vm.runInNewContext('(' + callback + ')', { game, button, bar, shareButton, ui: {} });
  const pending = click();
  await click();
  assert.equal(requests, 1); assert.equal(resumes, 0); assert.equal(deletions, 0);
  reply.resolve(false); await pending;
  assert.equal(button.grailStarting, false); assert.equal(resumes, 0);
  game.grailRequestStart = async () => true;
  await click();
  assert.equal(resumes, 1); assert.equal(deletions, 3); assert.equal(button.clicked, true);
});
