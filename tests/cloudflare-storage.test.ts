import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { RoomStorage } from '../cloudflare/room-storage.js';
import { attachFullRoom, createFullRoom, joinFullRoom, relayView, syncFullRoom } from '../lib/full-room.ts';

function fixture() {
  const db = new DatabaseSync(':memory:');
  const storage = {
    sql: { exec(query: string, ...params: (string | number)[]) {
      const rows = db.prepare(query).all(...params);
      return { toArray: () => rows };
    } },
    transactionSync(fn: () => void) {
      db.exec('BEGIN');
      try { fn(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const rooms = new RoomStorage(storage);
  const room = createFullRoom('ABCDEFGH', 'host', '房主', '持久化測試', 4);
  joinFullRoom(room, 'guest', '客人', 'guest-id');
  attachFullRoom(room, 'host', 'connection-host-123456');
  attachFullRoom(room, 'guest', 'connection-guest-12345');
  return { db, storage, rooms, room };
}

test('SQLite room survives reload, deduplicates retries and retains only recipient inbox', () => {
  const { db, storage, rooms, room } = fixture();
  const input = { connection: 'connection-host-123456', ack: 0, messages: [{ id: 'message-1234567890', to: 'guest-id', data: '["private-hand","secret-card"]' }] };
  syncFullRoom(room, 'host', input); rooms.save(room);
  const restored = new RoomStorage(storage).load();
  syncFullRoom(restored, 'host', input); rooms.save(restored);
  assert.equal(rooms.load().messages.length, 1);
  assert.equal(relayView(rooms.load(), 'guest').messages.length, 1);
  assert.equal(relayView(rooms.load(), 'host').messages.length, 0);
  syncFullRoom(restored, 'guest', { connection: 'connection-guest-12345', ack: 1, messages: [] });
  rooms.save(restored);
  assert.equal(rooms.load().messages.length, 0);
  db.close();
});

test('SQLite state and messages roll back together on a storage failure', () => {
  const { db, rooms, room } = fixture();
  rooms.save(room);
  db.exec("CREATE TRIGGER fail_inbox BEFORE INSERT ON inbox BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  room.revision = 10;
  syncFullRoom(room, 'host', { connection: 'connection-host-123456', ack: 0, messages: [{ id: 'message-1234567890', to: 'guest-id', data: '["update",{}]' }] });
  assert.throws(() => rooms.save(room), /test failure/);
  assert.equal(rooms.load().revision, 0);
  assert.equal(rooms.load().sequence, 0);
  assert.equal(rooms.load().messages.length, 0);
  db.close();
});

test('large native reinitialization inboxes use separate rows and reconnect removes stale data', () => {
  const { db, rooms, room } = fixture();
  for (let i = 0; i < 10; i++) {
    syncFullRoom(room, 'host', { connection: 'connection-host-123456', ack: 0,
      messages: [{ id: 'large-message-123456-' + i, to: 'guest-id', data: JSON.stringify(['reinit', 'x'.repeat(250_000)]) }] });
  }
  rooms.save(room);
  assert.ok(JSON.stringify(rooms.load()).length > 2_000_000);
  assert.ok(Number(db.prepare('SELECT max(length(data)) AS n FROM inbox').get()?.n) < 300_000);
  const restored = rooms.load();
  attachFullRoom(restored, 'guest', 'replacement-connection-1234');
  rooms.save(restored);
  assert.equal(rooms.load().messages.length, 0);
  db.close();
});
