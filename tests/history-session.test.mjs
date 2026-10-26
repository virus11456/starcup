import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistorySession } from '../vendor/noname/overrides/grail-history-session.js';
import { createHistoryBuffer } from '../vendor/noname/overrides/grail-history.js';
import { historyHarness } from './helpers/history-harness.mjs';
import { clock } from './helpers/relay-harness.mjs';

function fixture() {
  const values = new Map(), time = clock();
  let writes = 0;
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes++; values.set(key, value); } };
  const options = { storage: () => storage, now: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer };
  return { values, time, storage, options, writes: () => writes,
    journal: code => createHistorySession(code ?? 'ABCDEFGH', options) };
}
const row = (id, text = '甲 對乙 使用 魔彈') => ({ id, text, turn: 2 });

test('public history coalesces local writes and restores the same IDs across a guest reload', async () => {
  const f = fixture(), journal = f.journal();
  assert.deepEqual(journal.load(), []);
  const buffer = createHistoryBuffer();
  for (let i = 0; i < 20; i++) { buffer.append('甲 使用 魔彈', 2); journal.save(buffer.search()); }
  assert.equal(f.writes(), 0); assert.equal(f.time.timers.size, 1);
  await f.time.tick(499); assert.equal(f.writes(), 0);
  await f.time.tick(1); assert.equal(f.writes(), 1); assert.equal(f.time.timers.size, 0);
  const restored = createHistoryBuffer(1000, f.journal().load());
  assert.equal(restored.size, 20); assert.equal(restored.latest.id, 20);
  assert.equal(restored.append('乙 承受傷害', 2).id, 21);
  journal.flush(); assert.equal(f.writes(), 1, 'no dirty entries means no repeated write');
});

test('pagehide or stop flushes pending history once without leaving a background timer', async () => {
  const f = fixture(), journal = f.journal();
  journal.save([row(7)]); journal.flush();
  assert.equal(f.writes(), 1); assert.equal(f.time.timers.size, 0);
  journal.save([row(7), row(8)]); journal.stop();
  assert.equal(f.writes(), 2); assert.equal(f.time.timers.size, 0);
  await f.time.tick(1000); assert.equal(f.writes(), 2);
});

test('room scope, expiry and corrupt snapshots never restore another match', async () => {
  const f = fixture(), first = f.journal();
  first.save([row(3)]); first.flush();
  assert.deepEqual(f.journal('JKLMNPQR').load(), []);
  assert.equal(f.journal().load().length, 1);
  await f.time.tick(86_400_000); assert.deepEqual(f.journal().load(), []);
  const key = [...f.values.keys()][0];
  for (const invalid of ['{bad-json', 'x'.repeat(180001), JSON.stringify({ version: 1, code: 'ABCDEFGH', at: f.time.now() + 1, entries: [row(1)] })]) {
    f.values.set(key, invalid); const journal = f.journal();
    assert.deepEqual(journal.load(), []); assert.equal(journal.available, true);
    journal.save([row(9)]); journal.flush(); assert.equal(f.journal().load()[0].id, 9);
  }
  const other = f.journal('JKLMNPQR'); other.save([row(1, '另一局')]); other.flush();
  assert.equal(f.values.size, 1, 'do not accumulate one storage key per old room');
  assert.deepEqual(f.journal().load(), []);
});

test('serialized history is bounded by both count and character size, retaining complete recent records', () => {
  const f = fixture(), journal = f.journal();
  const entries = Array.from({ length: 1200 }, (_, i) => row(i + 1, '"中\\'.repeat(2000)));
  journal.save(entries); journal.flush();
  const raw = [...f.values.values()][0]; assert.ok(raw.length <= 180000);
  const loaded = journal.load(); assert.ok(loaded.length < 1000); assert.ok(loaded.length > 0);
  assert.equal(loaded.at(-1).id, 1200);
  assert.ok(loaded.every(entry => entry.text === entries[0].text), 'never truncate an individual retained record');
  journal.save(Array.from({ length: 1200 }, (_, i) => row(i + 1))); journal.flush();
  assert.equal(journal.load().length, 1000); assert.equal(journal.load()[0].id, 201);
});

test('blocked or full browser storage leaves history usable without repeated writes or throwing', async () => {
  const blocked = createHistorySession('ABCDEFGH', { storage() { throw new Error('blocked'); } });
  assert.deepEqual(blocked.load(), []); blocked.save([row(1)]); blocked.flush(); assert.equal(blocked.available, false);
  const f = fixture(); let attempts = 0;
  f.storage.setItem = () => { attempts++; throw new Error('full'); };
  const journal = f.journal(); journal.save([row(1)]); await f.time.tick(500);
  assert.equal(journal.available, false); assert.equal(attempts, 1);
  journal.save([row(2)]); journal.flush(); await f.time.tick(1000);
  assert.equal(attempts, 1); assert.equal(f.time.timers.size, 0);
  const panel = historyHarness({ journal }); panel.append('儲存被阻擋仍可閱讀'); panel.toggle.emit('click');
  assert.match(panel.list.textContent, /仍可閱讀/); assert.match(panel.note.textContent, /無法暫存/); panel.history.stop();
});

test('solo or invalid room URLs never access the session journal', () => {
  for (const code of [null, '', 'abcdefgh', 'invalid-room']) {
    assert.equal(createHistorySession(code, { storage() { throw new Error('must not be called'); } }), null);
  }
});

test('restored history validates records and renders saved text without parsing HTML', () => {
  const initial = [row(12, '<img onerror=unsafe> 魔彈'), row(11), { ...row(13), text: 'x'.repeat(8001) },
    { ...row(14), id: Infinity }, { ...row(15), turn: -1 }, null, row(16, '乙 承受傷害')];
  const buffer = createHistoryBuffer(1000, initial);
  assert.deepEqual(buffer.search().map(entry => entry.id), [12, 16]);
  assert.equal(buffer.append('新的事件', 3).id, 17);
  const f = fixture(), journal = f.journal(); journal.save(buffer.search()); journal.flush();
  const h = historyHarness({ journal: f.journal() }); h.toggle.emit('click');
  assert.equal(h.list.children.length, 3); assert.equal(h.list.children[2].children[1].textContent, '<img onerror=unsafe> 魔彈');
  assert.equal(h.list.children[2].children[1].children.length, 0);
  h.append('甲 完成提煉', 4); h.history.flush();
  assert.equal(f.journal().load().at(-1).id, 18);
  assert.match(h.note.textContent, /同一分頁/); assert.match(h.note.textContent, /缺漏/);
  h.history.stop();
});
