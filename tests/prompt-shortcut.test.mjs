import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadPacks } from '../scripts/engine-catalog.mjs';
import { createPursuitShortcut, pendingEmptyPursuit, createPursuitPreference } from '../vendor/noname/overrides/grail-prompt-shortcut.js';

const pin = JSON.parse(await readFile(new URL('../vendor/noname/pin.json', import.meta.url), 'utf8'));
const native = await loadPacks(fileURLToPath(new URL('../public/engine/', import.meta.url)), pin);
const card = (type = 'gongJi', xiBie = 'feng', mingGe = 'ji') => ({ type, xiBie, mingGe });
function harness(id = 'fengNuZhuiJi', cards = [card('gongJi', 'huo')]) {
  const body = {}, clicks = [];
  const classes = { contains: () => false };
  const bar = { children: [], parentNode: body, classList: classes };
  const button = { link: 'cancel', parentNode: bar, isConnected: true, classList: classes, getClientRects: () => [{}] };
  bar.children.push(button);
  let ownSkills = [id];
  const me = { getSkills: () => ownSkills, getCards: zone => zone === 's' ? [] : cards };
  const parent = { name: 'trigger', skill: id, player: me };
  const event = { name: 'chooseBool', player: me, choosing: true,
    isMine: () => true, getParent: () => parent, getTrigger: () => ({ card: card('gongJi', 'lei') }) };
  const context = {
    game: { me }, lib: { skill: { ...native.lib.skill, global: [] } },
    get: { type: card => card.type, xiBie: card => card.xiBie, mingGe: card => card.mingGe },
    ui: { confirm: bar, click: { control() {
      clicks.push({ button: this, event: context.status.event });
      context.status.event.result = this.link === 'cancel2' ? { control: 'cancel2' } : { bool: false, confirm: 'cancel' };
    } } },
    status: { event, currentPhase: me, paused: true },
    document: { visibilityState: 'visible', body },
  };
  return { context, cards, me, parent, event, button, bar, clicks,
    ownSkills: ids => { ownSkills = ids; },
    batch(ids) {
      event.name = 'chooseControl'; event.arrangeSkill = true;
      event.controls = [...ids, 'cancel2']; event.controlbar = bar;
      button.link = 'cancel2';
    },
  };
}

test('shortcut is off by default, only delegates native Cancel after opt-in, and handles each event once', () => {
  const h = harness(), controller = createPursuitShortcut(h.context);
  assert.equal(controller.enabled, false);
  assert.equal(controller.update(), null);
  assert.equal(h.clicks.length, 0);
  controller.setEnabled(true);
  assert.deepEqual(controller.update(), ['風怒追擊']);
  assert.equal(h.clicks[0].button, h.button);
  assert.equal(h.clicks[0].event, h.event);
  assert.deepEqual(h.event.result, { bool: false, confirm: 'cancel' }, 'only the native click adapter writes the result');
  assert.equal(controller.update(), null);
  assert.equal(h.clicks.length, 1);
  controller.stop();
  assert.equal(controller.enabled, false);
});

test('physical wind/fire/fate/same-element requirements use the actual current hand; even disabled matching cards keep the question', () => {
  for (const [id, missing, matching] of [
    ['fengNuZhuiJi', card('faShu', 'feng'), card()],
    ['xiuLuoLianZhan', card(), card('gongJi', 'huo')],
    ['jiZhiJianYi', card('gongJi', 'feng', 'xue'), card()],
    ['erChongJianYing', card(), card('gongJi', 'lei')],
    ['jianYing', card('faShu'), card()],
  ]) {
    const h = harness(id, [missing]);
    assert.ok(pendingEmptyPursuit(h.context), id);
    h.cards[0] = { ...matching, disabled: true };
    assert.equal(pendingEmptyPursuit(h.context), null, id + ' matching card keeps native choice authoritative');
  }
});

test('batch Cancel is forbidden if any other skill or any useful pursuit remains', () => {
  const h = harness('fengNuZhuiJi', []);
  h.batch(['fengNuZhuiJi', 'jianYing']);
  assert.ok(pendingEmptyPursuit(h.context));
  h.cards.push(card('gongJi', 'huo'));
  assert.equal(pendingEmptyPursuit(h.context), null, 'sword shadow still has a usable attack');
  h.cards.length = 0;
  for (const other of ['buQuYiZhi', 'shenShengZhuiJi', 'jianYingDuanNian', 'faLiChaoXi', 'shun', 'unknown']) {
    h.batch(['fengNuZhuiJi', other]);
    assert.equal(pendingEmptyPursuit(h.context), null, other + ' must never be swept into Cancel');
  }
});

test('virtual cards, hidden cards, nested/global helpers, unknown inheritance and special-zone cards preserve manual choice', () => {
  for (const info of [
    { viewAs: { name: 'fengShenZhan' } }, { hiddenCard() {} }, { viewAsFilter() {} },
    { mod: { cardXiBie() {} } }, { mod: { cardMingGe() {} } }, { inherit: 'unknown' },
  ]) {
    const h = harness(); h.context.lib.skill.converter = info; h.ownSkills(['fengNuZhuiJi', 'converter']);
    assert.equal(pendingEmptyPursuit(h.context), null);
  }
  const h = harness();
  Object.assign(h.context.lib.skill, { outer: { group: 'inner' }, inner: { group: 'converter' }, converter: { viewAs: { name: 'fengShenZhan' } } });
  h.context.lib.skill.global = ['outer'];
  assert.equal(pendingEmptyPursuit(h.context), null, 'grandchild conversion cannot be missed');
  h.context.lib.skill.global = [];
  h.me.getCards = zone => zone === 's' ? [card()] : h.cards;
  assert.equal(pendingEmptyPursuit(h.context), null, 'native attack supports the special zone too');
});

test('the real fairy sword-dance conversion keeps same-element pursuit manual', () => {
  const h = harness('erChongJianYing', [card('gongJi', 'huo')]);
  h.ownSkills(['erChongJianYing', 'jingLingDeJianWu']);
  assert.equal(pendingEmptyPursuit(h.context), null);
});

test('resources, draws, healing and paid card choices are excluded even with an empty hand', () => {
  for (const id of ['buQuYiZhi', 'shenShengZhuiJi', 'liRuQuanYong', 'yiJiWuNian', 'touXi', 'shuiYing', 'guanChuanSheJi', 'xuRongZhangWo']) {
    const h = harness(id, []);
    assert.equal(pendingEmptyPursuit(h.context), null, id);
  }
});

test('online play, manual pauses, hidden/backgrounded pages, AI, game-over and other players never get an automated response', () => {
  const changes = [
    h => { h.context.game.grailEmbeddedRoom = true; }, h => { h.context.game.online = true; },
    h => { h.context.status.connectMode = true; }, h => { h.context.status.paused2 = true; },
    h => { h.context.status.paused = false; }, h => { h.context.status.over = true; },
    h => { h.context.status.auto = true; }, h => { h.context.status.dragged = true; },
    h => { h.context.document.visibilityState = 'hidden'; }, h => { h.context.status.currentPhase = {}; },
    h => { h.event.player = {}; }, h => { h.event.isMine = () => false; },
    h => { h.event.choosing = false; }, h => { h.event.result = { bool: true }; },
    h => { h.button.isConnected = false; }, h => { h.button.getClientRects = () => []; },
    h => { h.bar.custom = () => {}; }, h => { h.event.forced = true; },
    h => { h.event.custom = { replace: { confirm() {} } }; },
  ];
  for (const change of changes) {
    const h = harness(); change(h);
    assert.equal(pendingEmptyPursuit(h.context), null, String(change));
  }
});

test('unknown or changed event/card data keeps the prompt instead of guessing or sending a stale result', () => {
  for (const change of [
    h => { h.cards[0].type = 'unsure'; }, h => { h.cards[0].xiBie = 'unsure'; },
    h => { h.cards[0].cards = []; }, h => { h.parent.name = 'xingDong'; },
    h => { h.event.name = 'chooseCard'; }, h => { h.context.get.type = () => { throw new Error('not ready'); }; },
    h => { h.context.lib.skill.fengNuZhuiJi = { ...native.lib.skill.fengNuZhuiJi, oncancel() {} }; },
  ]) {
    const h = harness(); change(h);
    assert.equal(pendingEmptyPursuit(h.context), null);
  }
  const h = harness('erChongJianYing'); h.event.getTrigger = () => ({});
  assert.equal(pendingEmptyPursuit(h.context), null, 'unknown original element is not a missing-card judgment');
});

test('opening the help panel suspends the shortcut and one-shot manual override survives every tick of that choice', () => {
  const h = harness(); let open = true;
  const controller = createPursuitShortcut({ ...h.context, panelOpen: () => open });
  controller.setEnabled(true);
  assert.equal(controller.update(), null);
  controller.keepNextManual(); open = false;
  for (let i = 0; i < 3; i++) assert.equal(controller.update(), null);
  assert.equal(h.clicks.length, 0);
  h.context.status.event = { ...h.event };
  assert.deepEqual(controller.update(), ['風怒追擊']);
  controller.setEnabled(false);
  h.context.status.event = { ...h.event };
  assert.equal(controller.update(), null);
});

test('a native double-click guard that ignores a click never creates a false skipped notification', () => {
  const h = harness(), controller = createPursuitShortcut(h.context);
  const native = h.context.ui.click.control;
  h.context.ui.click.control = () => {};
  controller.setEnabled(true);
  assert.equal(controller.update(), null);
  assert.equal(h.event.result, undefined);
  h.context.ui.click.control = native;
  assert.deepEqual(controller.update(), ['風怒追擊']);
});

test('a card obtained while the panel is open prevents a previously possible skip', () => {
  const h = harness(); let open = true;
  const controller = createPursuitShortcut({ ...h.context, panelOpen: () => open });
  controller.setEnabled(true); assert.equal(controller.update(), null);
  h.cards.push(card()); open = false;
  assert.equal(controller.update(), null);
  assert.equal(h.clicks.length, 0);
});

test('a replaced current event and duplicate cancel controls cannot receive a stale shortcut', () => {
  const h = harness();
  const readCards = h.me.getCards;
  h.me.getCards = zone => {
    if (zone === 'h') h.context.status.event = { ...h.event };
    return readCards(zone);
  };
  const controller = createPursuitShortcut(h.context); controller.setEnabled(true);
  assert.equal(controller.update(), null);
  assert.equal(h.clicks.length, 0);
  const duplicate = harness(); duplicate.bar.children.push({ ...duplicate.button });
  assert.equal(pendingEmptyPursuit(duplicate.context), null);
});

test('preference UI starts unchecked, supports keyboard-native controls, and disables itself on entering online mode', () => {
  const h = harness();
  class Node {
    children = []; attributes = {}; listeners = {}; checked = false;
    constructor(tag) { this.tagName = tag; }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    remove() { this.removed = true; }
  }
  h.context.document.createElement = tag => new Node(tag);
  h.context.document.createTextNode = text => ({ textContent: text });
  const body = new Node('div'); let open = true;
  const panel = { querySelector: selector => selector === '#grail-help-body' ? body : { getAttribute: () => String(open) } };
  const preference = createPursuitPreference({ ...h.context, panel });
  const details = body.children[0], [summary, label, , manual, state] = details.children, input = label.children[0];
  assert.equal(input.checked, false); assert.equal(input.type, 'checkbox'); assert.equal(manual.disabled, true);
  input.checked = true; input.listeners.change();
  assert.match(summary.textContent, /已開啟/);
  preference.update(); assert.equal(h.clicks.length, 0);
  open = false; preference.update(); assert.equal(h.clicks.length, 1);
  assert.match(state.textContent, /已略過風怒追擊/);
  h.context.game.grailEmbeddedRoom = true; preference.update();
  assert.equal(input.disabled, true); assert.equal(input.checked, false);
  assert.match(summary.textContent, /關閉/);
  preference.stop(); assert.equal(details.removed, true);
});
