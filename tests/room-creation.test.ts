import test from 'node:test';
import assert from 'node:assert/strict';
import { creationCode, recoverCreation } from '../lib/room-creation.ts';
import { attachFullRoom, createFullRoom, joinFullRoom } from '../lib/full-room.ts';

test('creation codes are stable, server-keyed and isolated between identities', () => {
  const code = creationCode('host-auth', 'server-secret');
  assert.match(code, /^[A-Z2-9]{8}$/);
  assert.equal(creationCode('host-auth', 'server-secret'), code);
  assert.notEqual(creationCode('other-auth', 'server-secret'), code);
  assert.notEqual(creationCode('host-auth', 'other-secret'), code);
  assert.throws(() => creationCode('host-auth', undefined), /尚未完成設定/);
});

test('creation recovery preserves guests and rejects mismatched or already launched games without mutation', () => {
  const candidate = createFullRoom('ABCDEFGH', 'host', '房主', '重試牌局', 4);
  const original = structuredClone(candidate);
  joinFullRoom(original, 'guest', '朋友', 'guest-id');
  const before = JSON.stringify(original);
  assert.equal(recoverCreation(original, candidate), original);
  assert.equal(JSON.stringify(original), before);
  for (const change of [
    (room: typeof original) => { room.members[0].auth = 'other'; },
    (room: typeof original) => { room.name = '不同牌局'; },
    (room: typeof original) => { room.capacity = 6; },
    (room: typeof original) => { room.status = 'playing'; },
    (room: typeof original) => { room.status = 'closed'; },
    (room: typeof original) => { room.created -= 86_400_000; },
    (room: typeof original) => { attachFullRoom(room, 'host', 'host-connection-123456'); },
  ]) {
    const room = structuredClone(original); change(room);
    const snapshot = JSON.stringify(room);
    assert.throws(() => recoverCreation(room, candidate), { status: 410 });
    assert.equal(JSON.stringify(room), snapshot);
  }
});
