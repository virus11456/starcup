import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryBuffer, observeNativeHistory } from '../vendor/noname/overrides/grail-history.js';

test('history preserves identical repeated actions and bounded searchable chronological records', () => {
  const buffer = createHistoryBuffer(3);
  assert.equal(buffer.append('   '), null);
  buffer.append('甲 使用  火球', 1);
  buffer.append('甲 使用 火球', 1);
  buffer.append('乙 承受傷害', 1);
  assert.deepEqual(buffer.search('火球').map(entry => entry.id), [1, 2]);
  buffer.append('甲 發動 EX技能', 2);
  assert.equal(buffer.size, 3);
  assert.deepEqual(buffer.search().map(entry => entry.id), [2, 3, 4]);
  assert.equal(buffer.search('ex技能')[0].turn, 2);
  assert.equal(buffer.search('[.*]').length, 0, 'search is literal, not a regexp');
  assert.equal(buffer.latest.id, 4);
});
test('native sidebar seeds oldest-first and records insertions once per node, not per matching text', () => {
  const buffer = createHistoryBuffer(), nodes = ['第三筆', '第二筆', '第一筆'].map(textContent => ({ nodeType: 1, textContent }));
  let callback, disconnected = false, turn = 3;
  const sidebar = { children: nodes };
  class Observer {
    constructor(cb) { callback = cb; }
    observe(target, options) { assert.equal(target, sidebar); assert.deepEqual(options, { childList: true }); }
    disconnect() { disconnected = true; }
  }
  const stop = observeNativeHistory(sidebar, (text, current) => buffer.append(text, current), () => turn, Observer);
  assert.deepEqual(buffer.search().map(entry => entry.text), ['第一筆', '第二筆', '第三筆']);
  turn = 4;
  const action = { nodeType: 1, textContent: '甲 提煉 寶石', get innerHTML() { throw new Error('do not copy HTML'); } };
  callback([{ addedNodes: [action] }, { addedNodes: [action, { nodeType: 3, textContent: 'ignored' }] }, { addedNodes: [{ nodeType: 1, textContent: action.textContent }] }]);
  assert.equal(buffer.search('提煉').length, 2);
  assert.equal(buffer.latest.turn, 4);
  stop(); assert.ok(disconnected);
});
