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
test('native temporary skill backups retain their sandboxed protocol without enabling exec', () => {
  const member = ready().members[1];
  const payload = JSON.stringify(['result', { skill: 'example_backup', _sendskill: ['example_backup', { filterCard: '_noname_func:function(card) { return true; }' }] }]);
  assert.deepEqual(JSON.parse(validateRelayData(payload, member)), JSON.parse(payload));
  assert.throws(() => validateRelayData(payload.replace('example_backup', 'anything').replace('example_backup', 'anything'), member), /不允許/);
  const chat = JSON.parse(validateRelayData('["chat","1","測試訊息"]', member));
  assert.equal(chat[1], 'alice');
  assert.throws(() => validateRelayData('["chat","1","<script>"]', member), /特殊標記/);
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
test('closed rooms reject former seats at join instead of launching a broken iframe', () => {
  const room = ready();
  attachFullRoom(room, 'host-secret', 'new-connection-123456789', 1200);
  const before = JSON.stringify(room);
  for (const auth of ['host-secret', 'alice-secret', 'new-player']) {
    assert.throws(() => joinFullRoom(room, auth, '測試', 'other'),
      (error: Error & { status?: number }) => error.status === 410 && /已結束/.test(error.message));
  }
  assert.equal(JSON.stringify(room), before);
});
test('in-flight broadcasts cannot enter a replacement connection before its handshake', () => {
  const room = ready();
  attachFullRoom(room, 'alice-secret', 'replacement-connection-123', 1100);
  syncFullRoom(room, 'host-secret', { connection, ack: 0, messages: [
    { id: 'stale-message-123456', to: 'alice', connection, data: '["exec","old-player-reference"]' },
    { id: 'fresh-message-123456', to: 'alice', connection: 'replacement-connection-123', data: '["opened"]' },
  ] }, 1200);
  assert.deepEqual(relayView(room, 'alice-secret', 1200).messages.map(m => JSON.parse(m.data)[0]), ['opened']);
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
test('a guest leaving during broadcast does not disconnect the remaining table', () => {
  const room = ready();
  room.members[1].connection = '';
  syncFullRoom(room, 'host-secret', { connection, ack: 0, messages: [
    { id: 'message-1234567890', to: 'alice', data: '["update",{}]' },
    { id: 'message-1234567891', to: 'bob', data: '["update",{}]' },
  ] }, 1000);
  assert.equal(room.messages.length, 1);
  assert.equal(relayView(room, 'bob-secret').messages.length, 1);
});
