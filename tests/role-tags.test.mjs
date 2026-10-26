import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { roleProfile, roleDifficulty, decorateRoleButton } from '../vendor/noname/overrides/grail-role-tags.js';
import { loadPacks } from '../scripts/engine-catalog.mjs';

test('all current and legacy selectable roles have explicit, readable playstyle hints', async () => {
  const catalog = JSON.parse(await fs.readFile(new URL('../public/engine/catalog.json', import.meta.url), 'utf8'));
  const labels = new Set(['戰鬥', '法師', '輔助', '控場', '守護', '資源']);
  for (const role of [...catalog.characters, ...catalog.legacyCharacters]) {
    const profile = roleProfile(role.id);
    assert.ok(profile, role.id);
    assert.ok(profile.labels.length >= 1 && profile.labels.length <= 2, role.id);
    assert.ok(profile.labels.every(label => labels.has(label)), role.id);
  }
  assert.deepEqual(roleProfile('moJianShi').labels, ['戰鬥'], 'name is not a caster classifier');
  assert.deepEqual(roleProfile('shengNv').labels, ['輔助', '守護']);
  assert.deepEqual(roleProfile('zhanDouFaShi').labels, ['戰鬥', '法師']);
  assert.notDeepEqual(roleProfile('zhuLvZhe'), roleProfile('hongYiZhuJiao'), 'forms can have distinct playstyles');
  assert.deepEqual(roleProfile('si_fengZhiJianSheng'), roleProfile('fengZhiJianSheng'));
  assert.equal(roleProfile('unknown-role'), null);
});

function element() {
  const node = { style: { setProperty(key, value) { this[key] = value; } }, dataset: {}, childNodes: [], className: '',
    classList: { add() {} }, setBackground(id) { this.portrait = id; },
    append(...children) { children.forEach(child => { this.childNodes.push(child); child.parent = this; }); },
    replaceChildren(...children) { this.childNodes = []; this.ownText = ''; this.append(...children); },
    set textContent(value) { this.ownText = value; this.childNodes = []; },
    get textContent() { return (this.ownText || '') + this.childNodes.map(child => child.textContent).join(''); },
    setAttribute(key, value) { this[key] = value; },
    remove() { this.parent.childNodes = this.parent.childNodes.filter(child => child !== this); },
    querySelector(selector) { return this.childNodes.find(child => '.' + child.className === selector) || null; },
    querySelectorAll() { return []; }, ownerDocument: { createElement: () => element() } };
  return node;
}

test('role tags update reused native character buttons without replacing controls or double badges', async () => {
  const source = await fs.readFile(new URL('../public/engine/noname/ui/create/index.js', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('create.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let native;
  const visit = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'character' &&
      ts.isArrowFunction(node.initializer) && node.initializer.getText(ast).includes('node.refresh = func')) native = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }; visit(ast);
  assert.ok(native, 'run the actual generated character button constructor');
  const click = () => {};
  const lib = { config: { buttoncharacter_style: 'default', intro: '?' }, setIntro(node) { node.introHandler = click; } };
  const ui = { create: { div(selector, textOrParent, parent) {
    const node = element(); node.className = typeof selector === 'string' ? selector.replaceAll('.', ' ').trim() : '';
    const target = parent || (typeof textOrParent === 'object' ? textOrParent : null) || (typeof selector === 'object' ? selector : null);
    target?.append(node); return node;
  } } };
  const get = { is: { double: () => false }, character: () => ({ hp: 4, maxHp: 5, zhiLiao: 0 }),
    slimName: id => id, groupnature: () => '', bordergroup: () => '', numStr: n => String(n) };
  const create = vm.runInNewContext('(' + native + ')', { ui, lib, get, _status: {}, decorateRoleButton });
  const node = create('zhuLvZhe', 'character', null, false);
  const badge = node.querySelector('.grail-role-tag');
  assert.equal(badge.querySelector('.grail-role-label').textContent, '戰鬥／控場');
  assert.equal(node.dataset.grailDifficulty, '4.5');
  assert.equal(badge.querySelector('.grail-role-difficulty')['aria-label'], '上手難度 4.5 星，滿分 5 星');
  assert.equal(badge.querySelector('.grail-role-difficulty').querySelector('.grail-role-stars').style['--grail-star-fill'], '90%');
  assert.equal(node.link, 'zhuLvZhe'); assert.equal(node.introHandler, click);
  node.link = 'hongYiZhuJiao'; node.refresh(node, node.link);
  assert.equal(node.querySelector('.grail-role-tag'), badge);
  assert.equal(badge.querySelector('.grail-role-label').textContent, '輔助／守護');
  assert.equal(node.portrait, 'hongYiZhuJiao'); assert.equal(node.introHandler, click);
  node.link = 'unknown-role'; node.refresh(node, node.link);
  assert.equal(node.querySelector('.grail-role-tag'), null);
  assert.equal(node.dataset.grailRole, undefined);
  assert.equal(node.dataset.grailDifficulty, undefined);
});

test('difficulty preserves every pinned role rating, including explicit half-star categories', async () => {
  const pin = JSON.parse(await fs.readFile(new URL('../vendor/noname/pin.json', import.meta.url), 'utf8'));
  const { packs } = await loadPacks(new URL('../public/engine/', import.meta.url).pathname, pin);
  let checked = 0;
  for (const pack of [...pin.packs, ...pin.legacyPacks]) {
    for (const [id, character] of Object.entries(packs[pack].character)) {
      if (pin.excludedSpecialCharacters.includes(id)) continue;
      const [low, high = low] = String(character[2]).split('/').map(Number);
      const stars = roleDifficulty({ hp: low, maxHp: high });
      assert.ok(stars !== null && stars >= 3 && stars <= 5, id);
      const category = Object.entries(packs[pack].characterSort[pack]).find(([key, ids]) => /^\d(?:\.5)?xing$/.test(key) && ids.includes(id));
      if (category) assert.equal(stars, Number.parseFloat(category[0]), id);
      checked++;
    }
  }
  assert.equal(checked, 84);
  assert.equal(roleDifficulty({ hp: 3, maxHp: 4 }), 3.5);
  for (const info of [null, {}, { hp: 6, maxHp: 6 }, { hp: 5, maxHp: 3 }]) assert.equal(roleDifficulty(info), null);
});
