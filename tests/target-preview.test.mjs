import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectedCardTargetPreview, cardToTargetLine } from '../vendor/noname/overrides/grail-target-preview.js';

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
