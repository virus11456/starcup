// Batch native relay traffic into bounded rows. A message-per-row inbox costs
// two writes for every animation/choice message (insert plus acknowledgement).
// Stable sequence buckets let acknowledgements update just the affected rows.
const BUCKET_SIZE = 64;
const BATCH_BYTES = 512_000;
const encoder = new TextEncoder();
function messageBatches(messages) {
  const batches = new Map();
  let bucket = -1, part = 0, items = [], bytes = 2;
  const flush = () => {
    if (items.length) batches.set(bucket * BUCKET_SIZE + part++, '[' + items.join(',') + ']');
    items = []; bytes = 2;
  };
  for (const message of [...messages].sort((a, b) => a.seq - b.seq)) {
    const nextBucket = Math.floor((message.seq - 1) / BUCKET_SIZE);
    if (nextBucket !== bucket) { flush(); bucket = nextBucket; part = 0; }
    const json = JSON.stringify(message), size = encoder.encode(json).byteLength;
    if (items.length && bytes + size + 1 > BATCH_BYTES) flush();
    items.push(json); bytes += size + 1;
  }
  flush();
  return batches;
}

export class RoomStorage {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS inbox (seq INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS inbox_batches (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  }
  load() {
    const row = this.sql.exec('SELECT state FROM room WHERE id = 1').toArray()[0];
    if (!row) return null;
    const room = JSON.parse(row.state);
    // Old deployments can have an unacknowledged inbox. Read it until the
    // first successful atomic save migrates those exact messages to batches.
    const legacy = this.sql.exec('SELECT data FROM inbox ORDER BY seq').toArray().map(row => JSON.parse(row.data));
    const batched = this.sql.exec('SELECT data FROM inbox_batches ORDER BY id').toArray().flatMap(row => JSON.parse(row.data));
    room.messages = [...legacy, ...batched].sort((a, b) => a.seq - b.seq);
    return room;
  }
  save(room) {
    this.storage.transactionSync(() => {
      this.sql.exec('INSERT INTO room (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state WHERE room.state != excluded.state', JSON.stringify({ ...room, messages: [] }));
      const batches = messageBatches(room.messages);
      const existing = new Map(this.sql.exec('SELECT id, data FROM inbox_batches').toArray().map(row => [row.id, row.data]));
      for (const id of existing.keys()) if (!batches.has(id)) this.sql.exec('DELETE FROM inbox_batches WHERE id = ?', id);
      for (const [id, data] of batches) if (existing.get(id) !== data)
        this.sql.exec('INSERT INTO inbox_batches (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', id, data);
      this.sql.exec('DELETE FROM inbox');
    });
  }
}
