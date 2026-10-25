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
  db.exec("CREATE TRIGGER fail_inbox BEFORE INSERT ON inbox_batches BEGIN SELECT RAISE(ABORT, 'test failure'); END");
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
  assert.ok(Number(db.prepare('SELECT max(length(CAST(data AS BLOB))) AS n FROM inbox_batches').get()?.n) <= 512_000);
  const restored = rooms.load();
  attachFullRoom(restored, 'guest', 'replacement-connection-1234');
  rooms.save(restored);
  assert.equal(rooms.load().messages.length, 0);
  db.close();
});

test('burst messages and acknowledgements use bounded batches without rewriting unchanged inboxes', () => {
  const { db, rooms, room } = fixture();
  const changes = () => Number(db.prepare('SELECT total_changes() AS n').get()?.n);
  const before = changes();
  syncFullRoom(room, 'host', { connection: 'connection-host-123456', ack: 0,
    messages: Array.from({ length: 64 }, (_, i) => ({ id: 'burst-message-12345-' + i, to: 'guest-id', data: JSON.stringify(['update', i]) })) });
  rooms.save(room);
  assert.equal(changes() - before, 2); // one state row and one inbox batch
  assert.deepEqual(rooms.load().messages.map((m: {seq: number}) => m.seq), Array.from({ length: 64 }, (_, i) => i + 1));
  const saved = changes();
  rooms.save(rooms.load());
  assert.equal(changes() - saved, 1); // no inbox write for identical data
  const restored = rooms.load();
  syncFullRoom(restored, 'guest', { connection: 'connection-guest-12345', ack: 64, messages: [] });
  rooms.save(restored);
  assert.equal(changes() - saved, 3);
  assert.equal(rooms.load().messages.length, 0);
  db.close();
});

test('legacy inbox migrates atomically and partial acknowledgements preserve remaining order', () => {
  const { db, rooms, room } = fixture();
  syncFullRoom(room, 'host', { connection: 'connection-host-123456', ack: 0, messages: Array.from({ length: 3 }, (_, i) => ({ id: 'legacy-message-12345-' + i, to: 'guest-id', data: '["update",{}]' })) });
  db.prepare('INSERT INTO room VALUES (1, ?)').run(JSON.stringify({ ...room, messages: [] }));
  for (const m of room.messages) db.prepare('INSERT INTO inbox VALUES (?, ?)').run(m.seq, JSON.stringify(m));
  const restored = rooms.load();
  assert.equal(restored.messages.length, 3);
  syncFullRoom(restored, 'guest', { connection: 'connection-guest-12345', ack: 1, messages: [] });
  rooms.save(restored);
  assert.deepEqual(rooms.load().messages.map((m: {seq: number}) => m.seq), [2, 3]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inbox').get()?.n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inbox_batches').get()?.n, 1);
  db.close();
});

test('UTF-8 heavy native snapshots stay below SQLite row limits and retain all payloads', () => {
  const { db, rooms, room } = fixture();
  for (let i = 0; i < 4; i++) syncFullRoom(room, 'host', { connection: 'connection-host-123456', ack: 0,
    messages: [{ id: 'unicode-message-12345-' + i, to: 'guest-id', data: JSON.stringify(['reinit', '星'.repeat(250_000)]) }] });
  rooms.save(room);
  assert.ok(Number(db.prepare('SELECT max(length(CAST(data AS BLOB))) AS n FROM inbox_batches').get()?.n) < 1_048_576);
  assert.deepEqual(rooms.load().messages, room.messages);
  db.close();
});
