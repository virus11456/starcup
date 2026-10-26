import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectedCardTargetPreview, cardToTargetLine, createTargetPreview } from '../vendor/noname/overrides/grail-target-preview.js';

const cls = (...active) => ({ contains: key => active.includes(key) });
function gameFixture(type = 'gongJi') {
  const card = { name: 'huoYanZhan', type, classList: cls('selected') };
  const target = { name: 'shenGuan', classList: cls('selected') };
  const other = { name: 'fengYinShi', classList: cls() };
  const me = { getCards: () => [card], name: 'fengZhiJianSheng' };
  const game = { me, players: [me, target, other] };
  const ui = { arena: { classList: cls() }, selected: { cards: [card], targets: [target] } };
  const event = { name: 'chooseToUse', player: me, filterTarget: () => true };
  const context = { ui, game, event, lib: { card: { huoYanZhan: { type } } }, get: { type: item => item.type } };
  return { context, card, target, other, me };
}
test('attack preview connects only the selected local card to actual native selected target', () => {
  const { context, target, card } = gameFixture();
  assert.deepEqual(selectedCardTargetPreview(context), { card, targets: [target], kind: 'attack' });
  context.ui.selected.targets = [];
  assert.equal(selectedCardTargetPreview(context), null, 'removing native target hides line');
});
test('spell uses distinct target color and ignores unrelated target selection', () => {
  const { context, card, target } = gameFixture('faShu');
  assert.deepEqual(selectedCardTargetPreview(context), { card, targets: [target], kind: 'spell' });
  context.ui.selected.cards = [];
  assert.equal(selectedCardTargetPreview(context), null);
  context.ui.selected.cards = [card];
  context.event.filterTarget = undefined;
  assert.equal(selectedCardTargetPreview(context), null, 'not an active native targeting stage');
});
test('no preview for opponent cards, hidden hands, draft, finished selection or unrelated skills', () => {
  const { context, card, target, me } = gameFixture();
  context.ui.selected.cards = [{ ...card }];
  assert.equal(selectedCardTargetPreview(context), null, 'not in own physical hand');
  context.ui.selected.cards = [card];
  card.classList = cls('infohidden');
  assert.equal(selectedCardTargetPreview(context), null, 'hidden cards are not exposed');
  card.classList = cls();
  context.event.player = target;
  assert.equal(selectedCardTargetPreview(context), null, 'other players cannot show our selection');
  context.event.player = me;
  card.type = 'zhuangBei';
  assert.equal(selectedCardTargetPreview(context), null, 'equipment and effects do not show attack link');
  card.type = 'gongJi';
  context.ui.arena.classList = cls('choose-character');
  assert.equal(selectedCardTargetPreview(context), null);
});
test('each selected target has a line ending at the near card edge, not through portrait text', () => {
  const card = { left: 140, top: 600, width: 100, height: 150 };
  const target = { left: 340, top: 210, width: 90, height: 120 };
  const points = cardToTargetLine(card, target);
  assert.ok(points.from.x > 140 && points.from.x < 240);
  assert.ok(points.from.y >= 600 && points.from.y <= 750);
  assert.ok(points.to.x >= 340 && points.to.x <= 430);
  assert.ok(points.to.y >= 210 && points.to.y <= 330);
  assert.equal(cardToTargetLine(card, { ...target, width: 0 }), null);
});
test('preview overlay is click-through, respects reduced motion, and shows attack/spell distinctions', async () => {
  const css = await readFile(new URL('../vendor/noname/overrides/grail.css', import.meta.url), 'utf8');
  assert.match(css, /#grail-target-preview[\s\S]*?pointer-events:\s*none !important/);
  assert.match(css, /data-kind="spell"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('battle end clears an otherwise selected attack or spell target line', async () => {
  const { context, target, card } = gameFixture('gongJi');
  assert.deepEqual(selectedCardTargetPreview(context), { card, targets: [target], kind: 'attack' });
  context.over = true;
  assert.equal(selectedCardTargetPreview(context), null, 'game-over must not keep battle target beams');
  context.over = false;
  assert.ok(selectedCardTargetPreview(context), 'normal combat selection still works');
  const bridge = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /isOver:\s*\(\) => _status\.over/);
});

test('inspector and backgrounded Safari tab hide target lines without changing native selections', () => {
  const { context, card, target } = gameFixture();
  assert.equal(selectedCardTargetPreview({ ...context, modalOpen: true }), null);
  assert.equal(selectedCardTargetPreview({ ...context, documentHidden: true }), null);
  assert.deepEqual(context.ui.selected.cards, [card]);
  assert.deepEqual(context.ui.selected.targets, [target]);
  assert.ok(selectedCardTargetPreview(context));
});

test('rotation, scrolling hand and Safari visual viewport resize realign existing selection', () => {
  const { context, card, target } = gameFixture('faShu');
  let from = { left: 100, top: 620, width: 95, height: 120 };
  let to = { left: 300, top: 210, width: 72, height: 100 };
  card.getBoundingClientRect = () => from;
  target.getBoundingClientRect = () => to;
  function emitter() {
    const listeners = new Map();
    return { listeners, addEventListener(k,v) { listeners.set(k,v); },
      removeEventListener(k,v) { if (listeners.get(k) === v) listeners.delete(k); },
      fire(k) { listeners.get(k)?.(); } };
  }
  const docEvents = emitter(), winEvents = emitter(), vpEvents = emitter();
  const elements = [];
  function element() {
    const attrs = new Map();
    const el = { children: [], dataset: {}, hidden: false, removed: false,
      setAttribute(k,v) { attrs.set(k,v); }, getAttribute(k) { return attrs.get(k); },
      append(...children) { this.children.push(...children); }, remove() { this.removed = true; } };
    elements.push(el); return el;
  }
  let modal = { hidden: true }, visibility = 'visible';
  const doc = { ...docEvents, get visibilityState() { return visibility; },
    createElementNS: () => element(), getElementById: () => modal };
  const frames = [];
  const win = { ...winEvents, visualViewport: vpEvents, innerWidth: 390, innerHeight: 844,
    requestAnimationFrame: fn => frames.push(fn) };
  const hud = { children: [], append(el) { this.children.push(el); } };
  const controller = createTargetPreview({ hud, ...context, event: () => context.event,
    isOver: () => false, doc, win });
  const svg = hud.children[0];
  assert.equal(svg.hidden, false);
  assert.equal(svg.getAttribute('viewBox'), '0 0 390 844');
  const beam = svg.children[0].children[1], oldX = beam.getAttribute('x1');
  from = { left: 10, top: 280, width: 100, height: 80 };
  to = { left: 690, top: 90, width: 70, height: 90 };
  win.innerWidth = 844; win.innerHeight = 390;
  vpEvents.fire('resize'); vpEvents.fire('scroll'); winEvents.fire('orientationchange');
  assert.equal(frames.length, 1, 'repeated mobile resize events are coalesced');
  frames.shift()();
  assert.equal(svg.getAttribute('viewBox'), '0 0 844 390');
  assert.notEqual(beam.getAttribute('x1'), oldX);
  docEvents.fire('scroll'); frames.shift()();
  modal.hidden = false;
  docEvents.fire('visibilitychange'); frames.shift()();
  assert.equal(svg.hidden, true);
  modal.hidden = true; visibility = 'hidden';
  docEvents.fire('visibilitychange'); frames.shift()();
  assert.equal(svg.hidden, true);
  visibility = 'visible'; winEvents.fire('pageshow'); frames.shift()();
  assert.equal(svg.hidden, false, 'returning to foreground recomputes original native target');
  controller.stop();
  assert.ok(svg.removed);
  assert.equal(docEvents.listeners.size, 0);
  assert.equal(winEvents.listeners.size, 0);
  assert.equal(vpEvents.listeners.size, 0);
});
