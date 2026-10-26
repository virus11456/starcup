import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryBuffer, observeNativeHistory } from '../vendor/noname/overrides/grail-history.js';
import { historyHarness } from './helpers/history-harness.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

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
test('typing in history and operating its buttons never triggers native auto or pause hotkeys', () => {
  const h = historyHarness();
  h.keyOnTable({ key: 'a', keyCode: 65 });
  h.keyOnTable({ key: ' ', keyCode: 32 });
  assert.deepEqual(h.calls, { auto: 1, pause: 1, reload: 0 }, 'execute the actual upstream handler as a baseline');
  h.toggle.emit('click'); assert.equal(h.panel.hidden, false);
  for (const target of [h.search, h.toggle, h.more, h.fresh, h.close, h.list]) {
    for (const [key, keyCode] of [['a', 65], [' ', 32], ['r', 82]]) {
      const event = target.emit('keydown', { key, keyCode, ctrlKey: key === 'r' });
      assert.equal(event.cancelBubble, true);
      assert.equal(event.defaultPrevented, false, 'retain typing, scrolling and browser defaults');
    }
  }
  assert.deepEqual(h.calls, { auto: 1, pause: 1, reload: 0 });
  const escape = h.search.emit('keydown', { key: 'Escape', keyCode: 27 });
  assert.equal(h.panel.hidden, true); assert.equal(escape.defaultPrevented, true);
  assert.equal(h.doc.activeElement, h.toggle);
});
test('the real history panel keeps the reading position while new events arrive and older records are loaded', () => {
  const h = historyHarness();
  for (let i = 1; i <= 220; i++) h.append(`甲 行動 ${i}`, i);
  h.toggle.emit('click');
  assert.equal(h.list.children.length, 100);
  assert.match(h.list.children[0].textContent, /行動 220/);
  h.list.scrollTop = 90;
  h.append('乙 <img onerror=unsafe> 發動 EX技能', 221);
  assert.equal(h.list.scrollTop, 90); assert.match(h.list.children[0].textContent, /行動 220/);
  assert.equal(h.fresh.hidden, false);
  h.more.emit('click');
  assert.equal(h.list.children.length, 200); assert.equal(h.list.scrollTop, 90);
  assert.match(h.list.children[0].textContent, /行動 220/);
  h.fresh.emit('click');
  assert.equal(h.list.scrollTop, 0);
  assert.equal(h.list.children[0].children[1].textContent, '乙 <img onerror=unsafe> 發動 EX技能');
  assert.equal(h.list.children[0].children[1].children.length, 0, 'log content is text, never parsed HTML');
  h.search.value = 'ex技能'; h.search.emit('input');
  assert.equal(h.list.children.length, 1);
  h.close.emit('click'); assert.equal(h.panel.hidden, true);
  h.history.stop(); h.append('斷開監聽後不再擷取');
  assert.equal(h.toggle.textContent, '本場紀錄');
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

test('actual native public logs preserve actor, target, card and result in both host and guest history', async () => {
  const source = await fs.readFile(new URL('../public/engine/noname/game/index.js', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('game.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let native;
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'log') native = node.getText(ast).replace(/^log\(/, 'function log(');
    ts.forEachChild(node, visit);
  }; visit(ast); assert.ok(native);
  function client() {
    const buffer = createHistoryBuffer(); let observe;
    const sidebar = { children: [], insertBefore(node) { this.children.unshift(node); observe([{ addedNodes: [node] }]); } };
    class Observer { constructor(callback) { observe = callback; } observe() {} disconnect() {} }
    observeNativeHistory(sidebar, (text, turn) => buffer.append(text, turn), () => 2, Observer);
    const context = vm.createContext({
      lib: { config: { log_highlight: true, show_log: 'off' } }, _status: { video: true },
      get: { itemtype: value => value?.kind || '', translation: value => typeof value === 'object' ? value.name : String(value) },
      ui: { sidebar, create: { div: () => ({ nodeType: 1,
        set innerHTML(html) { this.textContent = html.replace(/<[^>]*>/g, ''); } }) } },
      game: { addVideo() {}, broadcast() {} },
    });
    context.game.log = vm.runInContext('(' + native + ')', context);
    return { context, buffer };
  }
  const host = client(), guest = client();
  host.context.game.broadcast = (callback, ...args) => {
    guest.context.args = args;
    vm.runInContext('(' + callback.toString() + ')(...args)', guest.context);
  };
  const actor = { kind: 'player', name: '魔法少女', side: true };
  const target = { kind: 'player', name: '聖女', side: false };
  host.context.game.log(actor, '對', target, '使用了', { kind: 'card', name: '魔彈' });
  host.context.game.log(target, '承受了', 2, '點法術傷害');
  host.context.game.log('紅隊士氣減少', 1);
  for (const { buffer } of [host, guest]) {
    assert.deepEqual(buffer.search().map(row => row.text), ['魔法少女對聖女使用了魔彈', '聖女承受了2點法術傷害', '紅隊士氣減少1']);
    assert.equal(buffer.search('魔彈').length, 1);
    assert.ok(buffer.search().every(row => row.turn === 2));
  }
});
