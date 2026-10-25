import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadPacks } from '../scripts/engine-catalog.mjs';
import { createBattleInspection, readInspection, inspectionPlayers, inspectionText } from '../vendor/noname/overrides/grail-inspection.js';
import { historyHarness } from './helpers/history-harness.mjs';

const root = new URL('../public/engine/', import.meta.url).pathname;
const pin = JSON.parse(await fs.readFile(new URL('../vendor/noname/pin.json', import.meta.url)));
const { packs, lib } = await loadPacks(root, pin);
Object.assign(lib.translate, packs.card.translate);
lib.card = packs.card.card;
lib.natureSeparator = '|';
const catalog = JSON.parse(await fs.readFile(root + 'catalog.json'));
const classes = (...names) => ({ contains: name => names.includes(name) });
function context(role = 'fengZhiJianSheng', cards = []) {
  const me = { name: role, side: true, getSkills: () => lib.character[role][3],
    getCards(area) { assert.equal(area, 'h'); return cards; }, node: {}, disabledSkills: {}, forbiddenSkills: {} };
  const other = { name: 'moDaoShi', side: false, getSkills: () => [], node: {},
    getCards() { throw new Error('Opponent cards must remain private'); },
    get storage() { throw new Error('Do not read private mark storage'); } };
  const game = { me, players: [me, other] };
  const get = { translation: id => lib.translate[id] || id, skillInfoTranslation: id => lib.translate[id + '_info'] };
  return { lib, game, get, me, other };
}

test('all 150 physical cards show their engine effect and separate unique-skill stamps', () => {
  const cards = catalog.deck.map(card => ({ name: card.kind, xiBie: card.element, mingGe: card.faction,
    duYou: card.marks.join('|'), classList: classes('selectable') }));
  const c = context('fengZhiJianSheng', cards);
  const entries = readInspection('hand', c.other, c);
  assert.equal(entries.length, 150, 'hand view always belongs to the local player');
  entries.forEach((entry, i) => {
    assert.ok(entry.title && entry.sections[0].text, catalog.deck[i].id);
    assert.equal(entry.sections.length, 1 + catalog.deck[i].marks.length);
    assert.equal(entry.status, '目前可選');
  });
  const windStamp = entries.flatMap(entry => entry.sections).find(section => section.title.includes('烈風技'));
  assert.equal(windStamp.badge, '本角色獨有技'); assert.equal(windStamp.matching, true);
  const archerStamp = entries.flatMap(entry => entry.sections).find(section => section.title.includes('精準射擊'));
  assert.equal(archerStamp.badge, '其他角色標記'); assert.equal(archerStamp.matching, false);
  assert.ok(entries[0].sections[0].text.includes('\n'), 'preserve separate effect lines');
});

test('all 68 current roles retain complete translated skill descriptions', () => {
  for (const role of catalog.characters) {
    const c = context(role.id);
    const entries = readInspection('roles', c.me, c);
    assert.ok(entries.length > 0, role.id);
    assert.ok(entries.every(entry => entry.title && entry.sections[0].text), role.id);
    assert.equal(entries[0].sections[0].text, inspectionText(lib.translate[lib.character[role.id][3].find(id => lib.translate[id + '_info'] && !lib.skill[id]?.nopop && !lib.skill[id]?.equipSkill) + '_info']));
  }
});

test('public marks show visible counts, limits and related skills without reading hidden card storage', () => {
  const c = context('moDaoShi');
  const marker = { skill: 'yuanSu', info: lib.skill.yuanSu.intro, classList: classes('mark'), markcount: { textContent: '2' } };
  c.other.node.marks = { children: [marker, { ...marker, classList: classes('mark', 'hidden') }] };
  c.other.getSkills = () => ['yuanSuMoFa'];
  c.other.getZhiShiWuLimit = id => id === 'yuanSu' ? 3 : Infinity;
  const entries = readInspection('marks', c.other, c);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, '元素');
  assert.equal(entries[0].count, '2'); assert.equal(entries[0].maximum, 3);
  assert.ok(entries[0].sections[0].text);
  c.other.node.marks2 = { children: [{ skill: 'anYue', info: { content: 'gaiPai' }, classList: classes('mark'), markcount: { textContent: '3' } }] };
  const hiddenCards = readInspection('marks', c.other, c)[1];
  assert.equal(hiddenCards.count, '3'); assert.match(hiddenCards.sections[0].text, /暗月.*專用蓋牌/);
  assert.equal(hiddenCards.maximum, undefined);
});

test('unknown, unseen and departed roles cannot be inspected, and dynamic descriptions retain disabled status', () => {
  const c = context();
  c.other.isUnseen = () => true;
  assert.equal(inspectionPlayers(c).length, 1);
  assert.deepEqual(readInspection('roles', c.other, c), []);
  assert.deepEqual(readInspection('marks', { name: 'not-a-player' }, c), []);
  c.me.disabledSkills.fengNuZhuiJi = ['disabled'];
  c.get.skillInfoTranslation = () => '目前狀態的完整說明<br>仍保留條件';
  const entry = readInspection('roles', c.me, c)[0];
  assert.equal(entry.status, '目前停用');
  assert.equal(entry.sections[0].text, '目前狀態的完整說明\n仍保留條件');
});

function panelHarness() {
  const h = historyHarness(), c = context();
  const panel = h.doc.createElement('aside'), toggle = h.doc.createElement('button'), help = h.doc.createElement('div');
  panel.append(toggle);
  const viewer = createBattleInspection({ panel, toggle, help, context: c, document: h.doc });
  const body = panel.children[1], [tabs, , inspection] = body.children;
  const [tools, note, list] = inspection.children;
  return { ...h, c, panel, toggle, help, viewer, body, tabs, inspection, select: tools.children[0].children[0], refresh: tools.children[1], note, list };
}

test('the actual viewer opens read-only tabs and preserves reading position when the hand changes', () => {
  const h = panelHarness();
  let cards = [{ name: 'anMie', duYou: '', classList: classes('selected') }];
  h.c.me.getCards = area => { assert.equal(area, 'h'); return cards; };
  assert.equal(h.body.hidden, true); h.toggle.emit('click');
  assert.equal(h.body.hidden, false); assert.equal(h.help.hidden, true);
  assert.equal(h.list.children.length, 1); assert.match(h.list.textContent, /已選取/);
  h.list.scrollTop = 77; const original = h.list.children[0];
  cards = []; h.viewer.update();
  assert.equal(h.list.children[0], original); assert.equal(h.list.scrollTop, 77);
  assert.equal(h.refresh.textContent, '資訊已變動 · 更新');
  h.refresh.emit('click'); assert.match(h.list.textContent, /目前沒有手牌/);
  h.tabs.children[2].emit('click'); assert.match(h.list.textContent, /風怒追擊/);
  h.tabs.children[0].emit('click'); assert.equal(h.help.hidden, false); assert.equal(h.inspection.hidden, true);
  assert.deepEqual(h.calls, { auto: 0, pause: 0, reload: 0 });
});

test('viewer keyboard input cannot trigger native auto/pause; Escape closes and clears hand details', () => {
  const h = panelHarness(); h.toggle.emit('click');
  for (const control of [h.toggle, h.refresh, h.select, ...h.tabs.children]) {
    for (const [key, keyCode] of [['a', 65], [' ', 32]]) {
      const event = control.emit('keydown', { key, keyCode });
      assert.equal(event.cancelBubble, true); assert.equal(event.defaultPrevented, false);
    }
  }
  assert.deepEqual(h.calls, { auto: 0, pause: 0, reload: 0 });
  h.refresh.emit('keydown', { key: 'Escape', keyCode: 27 });
  assert.equal(h.body.hidden, true); assert.equal(h.doc.activeElement, h.toggle);
  assert.equal(h.list.children.length, 0);
  h.c.me.getCards = () => { throw new Error('closed viewer must not poll hand contents'); };
  assert.doesNotThrow(() => h.viewer.update());
});

test('viewer outputs text and blocks unavailable artwork instead of inserting source HTML', () => {
  const h = panelHarness();
  h.c.me.getCards = () => [{ name: 'anMie', classList: classes() }];
  h.toggle.emit('click');
  const image = h.list.children[0].children[0].children[0];
  image.emit('error'); assert.equal(image.hidden, true);
  h.c.get.skillInfoTranslation = () => '<img src=x onerror=unsafe>完整技能<br>下一行';
  h.tabs.children[2].emit('click');
  const paragraph = h.list.children[0].children.at(-1).children.at(-1);
  assert.equal(paragraph.textContent, '完整技能\n下一行'); assert.equal(paragraph.children.length, 0);
  assert.equal(inspectionText('<p>第一段</p><p>第二段</p>'), '第一段\n第二段');
});
