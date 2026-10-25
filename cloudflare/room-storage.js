// Keep individual relay messages in separate SQLite rows: a full room can
// exceed SQLite's per-row limit. Commit state and inboxes atomically.
export class RoomStorage {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS inbox (seq INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  }
  load() {
    const row = this.sql.exec('SELECT state FROM room WHERE id = 1').toArray()[0];
    if (!row) return null;
    const room = JSON.parse(row.state);
    room.messages = this.sql.exec('SELECT data FROM inbox ORDER BY seq').toArray().map(row => JSON.parse(row.data));
    return room;
  }
  save(room) {
    this.storage.transactionSync(() => {
      this.sql.exec('INSERT OR REPLACE INTO room (id, state) VALUES (1, ?)', JSON.stringify({ ...room, messages: [] }));
      const retained = new Set(room.messages.map(message => message.seq));
      const existing = this.sql.exec('SELECT seq FROM inbox').toArray();
      for (const { seq } of existing) if (!retained.has(seq)) this.sql.exec('DELETE FROM inbox WHERE seq = ?', seq);
      const known = new Set(existing.map(row => row.seq));
      for (const message of room.messages) if (!known.has(message.seq))
        this.sql.exec('INSERT INTO inbox (seq, data) VALUES (?, ?)', message.seq, JSON.stringify(message));
    });
  }
}
