import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the prepared native skill, including its unmodified transfer code.
const source = await fs.readFile(new URL('../public/engine/noname/library/index.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('library.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const skillSources = {};
function visit(node) {
  if (ts.isPropertyAssignment(node) && ['_tiLian', '_heCheng'].includes(node.name.getText(ast)) && ts.isObjectLiteralExpression(node.initializer)) {
    skillSources[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(skillSources._tiLian, 'prepared native refining skill must exist');
assert.ok(skillSources._heCheng, 'prepared native synthesis skill must exist');

function fixture(stones, energy, limit = 3) {
  const stock = [...stones], personal = { ...energy }, dialogs = [];
  const player = {
    side: true,
    countNengLiangAll: () => personal.baoShi + personal.shuiJing,
    getNengLiangLimit: () => limit,
    removeZhanJi(kind, count) { for (let n = 0; n < count; n++) stock.splice(stock.indexOf(kind), 1); },
    addNengLiang(kind, count) { personal[kind] += count; },
  };
  const context = {
    player, event: { trigger() {} }, _status: { event: { player } },
    lib: { config: { background_audio: false }, skill: {} },
    game: { broadcastAll(fn) { fn(); } },
    get: { zhanJi: () => stock, translation: value => ({ baoShi: '寶石', shuiJing: '水晶' })[value] },
    ui: { create: {
      dialog(title) {
        const dialog = { title, classes: [], content: [], buttons: [], classList: { add(value) { dialog.classes.push(value); } },
          add([items]) { dialog.buttons.push(...items); } };
        dialogs.push(dialog);
        return dialog;
      },
      div(className, content) { const node = { className, textContent: '' }; content.push(node); return node; },
    } },
  };
  const skill = vm.runInNewContext(`(${skillSources._tiLian})`, context);
  const synthesis = vm.runInNewContext(`(${skillSources._heCheng})`, context);
  return { skill, synthesis, context, player, stock, personal, dialogs };
}

test('refining availability requires team stones and remaining personal capacity', () => {
  for (const [stones, energy, expected] of [
    [[], { baoShi: 0, shuiJing: 0 }, false],
    [['baoShi'], { baoShi: 2, shuiJing: 1 }, false],
    [['baoShi'], { baoShi: 1, shuiJing: 1 }, true],
  ]) {
    const h = fixture(stones, energy);
    assert.equal(h.skill.filter({}, h.player), expected);
  }
});

test('refining picker keeps each native stone and displays the actual allowed count', () => {
  const h = fixture(['baoShi', 'baoShi', 'shuiJing'], { baoShi: 0, shuiJing: 0 });
  const d = h.skill.chooseButton.dialog({}, h.player);
  assert.ok(d.classes.includes('grail-resource-dialog'));
  assert.deepEqual(Array.from(d.buttons, item => item[0]), h.stock);
  assert.match(d.content[0].textContent, /1～2/);
  assert.deepEqual(Array.from(h.skill.chooseButton.select()), [1, 2]);
  const oneSlot = fixture(['baoShi', 'shuiJing'], { baoShi: 1, shuiJing: 1 });
  assert.match(oneSlot.skill.chooseButton.dialog({}, oneSlot.player).content[0].textContent, /點選 1 顆/);
  assert.deepEqual(Array.from(oneSlot.skill.chooseButton.select()), [1, 1]);
  const oneStone = fixture(['shuiJing'], { baoShi: 0, shuiJing: 0 });
  assert.match(oneStone.skill.chooseButton.dialog({}, oneStone.player).content[0].textContent, /點選 1 顆/);
  assert.deepEqual(h.stock, ['baoShi', 'baoShi', 'shuiJing'], 'opening the picker cannot consume team stones');
  assert.deepEqual(h.personal, { baoShi: 0, shuiJing: 0 });
});

test('native confirmation transfers precisely the selected stone types', () => {
  for (const links of [['baoShi'], ['shuiJing'], ['baoShi', 'shuiJing'], ['baoShi', 'baoShi']]) {
    const h = fixture(['baoShi', 'baoShi', 'shuiJing'], { baoShi: 0, shuiJing: 0 });
    h.context.lib.skill._tiLian_backup = h.skill.chooseButton.backup(links, h.player);
    const prompt = h.skill.chooseButton.prompt(links, h.player);
    assert.match(prompt, /按「確定」完成提煉/);
    for (const kind of links) assert.ok(prompt.includes(h.context.get.translation(kind)));
    h.context.lib.skill._tiLian_backup.content();
    const gems = links.filter(kind => kind === 'baoShi').length;
    const crystals = links.length - gems;
    assert.deepEqual(h.personal, { baoShi: gems, shuiJing: crystals });
    assert.equal(h.stock.filter(kind => kind === 'baoShi').length, 2 - gems);
    assert.equal(h.stock.filter(kind => kind === 'shuiJing').length, 1 - crystals);
  }
});

test('synthesis requires three team stones and room for all three drawn cards', () => {
  for (const [stones, hand, limit, expected] of [
    [['baoShi', 'shuiJing'], 0, 6, false],
    [['baoShi', 'shuiJing', 'shuiJing'], 3, 6, true],
    [['baoShi', 'shuiJing', 'shuiJing'], 4, 6, false],
    [['baoShi', 'shuiJing', 'shuiJing'], 4, 7, true],
    [['baoShi', 'shuiJing', 'shuiJing'], 0, 2, false],
  ]) {
    const h = fixture(stones, { baoShi: 0, shuiJing: 0 });
    h.player.countCards = area => { assert.equal(area, 'h'); return hand; };
    h.player.getHandcardLimit = () => limit;
    assert.equal(h.synthesis.filter({}, h.player), expected);
  }
});

test('synthesis picker and final prompt do not consume stones before native confirmation', () => {
  const stones = ['baoShi', 'baoShi', 'shuiJing', 'shuiJing'];
  const h = fixture(stones, { baoShi: 1, shuiJing: 1 });
  const dialog = h.synthesis.chooseButton.dialog({}, h.player);
  assert.equal(dialog.title, '合成：選擇星石');
  assert.ok(dialog.classes.includes('grail-resource-dialog'));
  assert.match(dialog.content[0].textContent, /點選 3 顆星石/);
  assert.equal(h.synthesis.chooseButton.select, 3);
  assert.deepEqual(Array.from(dialog.buttons, item => item[0]), stones);
  const links = ['baoShi', 'shuiJing', 'shuiJing'];
  h.synthesis.chooseButton.backup(links, h.player);
  assert.equal(h.synthesis.chooseButton.prompt(links, h.player), '已選擇：寶石、水晶、水晶。按「確定」完成合成。');
  assert.deepEqual(h.stock, stones);
  assert.deepEqual(h.personal, { baoShi: 1, shuiJing: 1 });
});

test('native synthesis consumes selected team stones, draws three, adds a cup and reduces opposing morale', () => {
  for (const links of [
    ['baoShi', 'baoShi', 'baoShi'], ['shuiJing', 'shuiJing', 'shuiJing'],
    ['baoShi', 'baoShi', 'shuiJing'], ['baoShi', 'shuiJing', 'shuiJing'],
  ]) {
    const h = fixture([...links, 'baoShi', 'shuiJing'], { baoShi: 1, shuiJing: 1 });
    const effects = [];
    h.player.draw = count => { effects.push(['draw', count]); return { set: (...args) => effects.push(['draw-context', ...args]) }; };
    h.player.changeXingBei = count => effects.push(['cup', count]);
    h.player.changeShiQi = (count, side) => effects.push(['morale', count, side]);
    h.context.lib.skill._heCheng_backup = h.synthesis.chooseButton.backup(links, h.player);
    // This verifies the native effect body at the engine boundary. Browser
    // acceptance separately checks the asynchronous UI and event progression.
    h.context.lib.skill._heCheng_backup.content();
    assert.deepEqual(h.stock, ['baoShi', 'shuiJing']);
    assert.deepEqual(h.personal, { baoShi: 1, shuiJing: 1 }, 'synthesis spends team stock, not personal energy');
    assert.deepEqual(effects, [['draw', 3], ['draw-context', 'cause', 'teShuXingDong'], ['cup', 1], ['morale', -1, false]]);
  }
});
