import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullRoom, checkWaitingHostRecovery, createFullRoom, fullView, joinFullRoom, relayView, startFullRoom, syncFullRoom } from '../lib/full-room.ts';
const oldHost = 'original-host-connection';
const nextHost = 'replacement-host-connection';
const guest = 'original-guest-connection';
function lobby(protocol = 2) {
  const room = createFullRoom('ABCDEFGH', 'owner', '房主', '保留邀請碼', 4, 1000);
  joinFullRoom(room, 'friend', '朋友', 'friend-seat', 1000);
  attachFullRoom(room, 'owner', oldHost, 1000, { protocol });
  attachFullRoom(room, 'friend', guest, 1000);
  return room;
}
const recover = { protocol: 2, recover: true };
test('live, legacy and playing hosts cannot be replaced, and rejection never mutates the room', () => {
  for (const kind of ['live', 'legacy', 'playing']) {
    const room = lobby(kind === 'legacy' ? 1 : 2);
    if (kind === 'playing') startFullRoom(room, 'owner', oldHost);
    const before = structuredClone(room);
    assert.throws(() => attachFullRoom(room, 'owner', nextHost, kind === 'live' ? 60_999 : 61_000, recover), { status: 409 });
    assert.deepEqual(room, before);
  }
});
test('expired waiting host recovery retains identities and drops old inboxes without sequence reuse', () => {
  const room = lobby();
  syncFullRoom(room, 'friend', { connection: guest, ack: 0, messages: [{ id: 'old-message-12345678', to: '1', data: '["init",1,{}]' }] }, 1000);
  const before = structuredClone(room);
  assert.doesNotThrow(() => checkWaitingHostRecovery(room, 'owner', 61_000));
  assert.deepEqual(room, before, 'preflight is read-only');
  attachFullRoom(room, 'owner', nextHost, 61_000, recover);
  assert.equal(room.hostGeneration, 1);
  assert.equal(room.code, before.code);
  assert.deepEqual(room.members.map(({ id, auth, name }) => ({ id, auth, name })), before.members.map(({ id, auth, name }) => ({ id, auth, name })));
  assert.equal(room.sequence, 1); assert.equal(room.messages.length, 0);
  assert.deepEqual(relayView(room, 'owner', 61_000).peers, []);
  assert.equal(relayView(room, 'friend', 61_000).rejoinLobby, true);
  const unchanged = structuredClone(room);
  assert.equal(syncFullRoom(room, 'friend', { connection: guest, ack: 999, messages: [{ id: 'stale-choice-1234567', to: '1', data: '["result",{}]' }] }, 61_001), false);
  assert.deepEqual(room, unchanged, 'old lobby results and acknowledgements are ignored');
  attachFullRoom(room, 'owner', nextHost, 61_002, recover);
  assert.equal(room.hostGeneration, 1, 'lost attach response retries do not reset twice');
  attachFullRoom(room, 'friend', 'fresh-guest-connection', 61_003);
  assert.equal(fullView(room, 'friend').me, 'friend-seat');
  assert.equal(relayView(room, 'friend', 61_003).rejoinLobby, false);
  assert.equal(relayView(room, 'owner', 61_003).peers.length, 1);
  assert.throws(() => syncFullRoom(room, 'owner', { connection: oldHost, ack: 1, messages: [], started: true }, 61_004), { status: 409 });
  assert.equal(room.status, 'waiting');
});
test('durable start and host recovery fence each other in both race orders', () => {
  const begun = lobby();
  assert.equal(startFullRoom(begun, 'owner', oldHost), true);
  assert.equal(startFullRoom(begun, 'owner', oldHost), false, 'retry after lost reply');
  assert.throws(() => attachFullRoom(begun, 'owner', nextHost, 120_000, recover), { status: 409 });
  assert.equal(begun.status, 'playing');
  const restored = lobby();
  attachFullRoom(restored, 'owner', nextHost, 61_000, recover);
  assert.throws(() => startFullRoom(restored, 'owner', oldHost), { status: 409 });
  assert.equal(startFullRoom(restored, 'owner', nextHost), true);
});
test('only the original authenticated owner can check recovery or start; closed rooms remain closed', () => {
  const room = lobby();
  assert.throws(() => checkWaitingHostRecovery(room, 'friend', 61_000), { status: 403 });
  assert.throws(() => checkWaitingHostRecovery(room, 'outsider', 61_000), { status: 403 });
  assert.throws(() => startFullRoom(room, 'friend', guest), { status: 403 });
  room.status = 'closed';
  assert.throws(() => checkWaitingHostRecovery(room, 'owner', 61_000), { status: 410 });
  assert.throws(() => startFullRoom(room, 'owner', oldHost), { status: 410 });
});
