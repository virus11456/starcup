import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullRoom, createFullRoom, fullView, joinFullRoom, relayView, syncFullRoom, validateRelayData } from '../lib/full-room.ts';
const connection = 'connection-123456789';
function ready() {
  const room = createFullRoom('ABCDEFGH', 'host-secret', '房主', '測試牌局', 4, 1000);
  joinFullRoom(room, 'alice-secret', '甲', 'alice', 1000);
  joinFullRoom(room, 'bob-secret', '乙', 'bob', 1000);
  for (const auth of ['host-secret', 'alice-secret', 'bob-secret']) attachFullRoom(room, auth, connection, 1000);
  return room;
}
test('relay returns only the authenticated seat inbox and never member credentials', () => {
  const room = ready();
  syncFullRoom(room, 'host-secret', { connection, ack: 0, messages: [
    { id: 'message-1234567890', to: 'alice', data: '["private-hand","alice-card"]' },
    { id: 'message-1234567891', to: 'bob', data: '["private-hand","bob-card"]' },
  ] }, 1000);
  const alice = relayView(room, 'alice-secret', 1000);
  assert.equal(alice.messages.length, 1);
  assert.match(alice.messages[0].data, /alice-card/);
  assert.doesNotMatch(JSON.stringify(alice), /bob-card|secret/);
  assert.throws(() => relayView(room, 'outsider'), /不在這個房間/);
});
test('guest cannot impersonate another native seat or submit execution commands', () => {
  const room = ready(), member = room.members[1];
  const init = JSON.parse(validateRelayData('["init",1,{"id":"1","nickname":"偽裝","onlineKey":"1"}]', member));
  assert.equal(init[2].id, 'alice'); assert.equal(init[2].nickname, '甲');
  for (const payload of ['["exec","function() {}"]', '["cardPile"]', '["startGame"]', '["log",[]]', '["result",{"x":"_noname_func:alert(1)"}]', '["result",{"__proto__":{}}]'])
    assert.throws(() => validateRelayData(payload, member), /不允許/);
  assert.throws(() => syncFullRoom(room, 'alice-secret', { connection, ack: 0, messages: [{ id: 'message-1234567890', to: 'bob', data: '["result",{}]' }] }), /不能傳送/);
});
test('lost HTTP responses are safe to retry and acknowledged messages are removed', () => {
  const room = ready();
  const batch = { connection, ack: 0, messages: [{ id: 'message-1234567890', to: 'alice', data: '["update",{}]' }] };
  syncFullRoom(room, 'host-secret', batch, 1000);
  syncFullRoom(room, 'host-secret', batch, 1000);
  assert.equal(room.sequence, 1); assert.equal(room.messages.length, 1);
  syncFullRoom(room, 'alice-secret', { connection, ack: 1, messages: [] }, 1000);
  assert.equal(room.messages.length, 0);
});
test('reconnect rotates connection epoch, discards stale choices, rejects old page', () => {
  const room = ready();
  syncFullRoom(room, 'alice-secret', { connection, ack: 0, messages: [{ id: 'message-1234567890', to: '1', data: '["result",{}]' }] }, 1000);
  attachFullRoom(room, 'alice-secret', 'new-connection-123456789', 1100);
  assert.equal(room.messages.length, 0);
  assert.throws(() => syncFullRoom(room, 'alice-secret', { connection, ack: 0, messages: [] }), /另一個頁面/);
  assert.equal(fullView(room, 'alice-secret').me, 'alice');
});
test('host reload closes a match instead of silently replacing its event stack', () => {
  const room = ready();
  attachFullRoom(room, 'host-secret', connection, 1100);
  assert.equal(room.status, 'waiting');
  attachFullRoom(room, 'host-secret', 'new-connection-123456789', 1200);
  assert.equal(room.status, 'closed');
  assert.throws(() => syncFullRoom(room, 'alice-secret', { connection, ack: 0, messages: [] }), /已結束/);
});
test('only host starts, active matches reject late joins, capacity is enforced', () => {
  const room = ready();
  joinFullRoom(room, 'four', '丁', 'four');
  assert.throws(() => joinFullRoom(room, 'five', '戊', 'five'), /已滿/);
  assert.throws(() => syncFullRoom(room, 'alice-secret', { connection, ack: 0, messages: [], started: true }), /只有房主/);
  syncFullRoom(room, 'host-secret', { connection, ack: 0, messages: [], started: true });
  assert.equal(room.status, 'playing');
  assert.throws(() => joinFullRoom(room, 'new', '新', 'new'), /已開始/);
  assert.equal(joinFullRoom(room, 'alice-secret', '甲', 'other').id, 'alice');
});
