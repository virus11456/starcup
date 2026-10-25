import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the prepared native skill, including its unmodified transfer code.
const source = await fs.readFile(new URL('../public/engine/noname/library/index.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('library.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let skillSource;
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === '_tiLian') skillSource = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(skillSource, 'prepared native refining skill must exist');

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
  const skill = vm.runInNewContext(`(${skillSource})`, context);
  return { skill, context, player, stock, personal, dialogs };
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
