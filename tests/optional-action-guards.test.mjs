import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { canOfferExtraAttackForCrystal } from '../scripts/optional-action-guards.mjs';

const get = { type: card => card.type };
const lib = { filter: { cardEnabled: card => !card.disabled } };
const attack = (extra = {}) => ({ type: 'gongJi', ...extra });
const candidate = (cards, storage = { gongJiOrFaShu: 1, gongJi: 0 }) => ({
  storage,
  cards,
  countCards(area, predicate) {
    assert.equal(area, 'h');
    return this.cards.filter(predicate).length;
  },
  hasUseTarget(card) { return !card.noTarget; },
});
const ongoingAttack = (extra = {}) => ({
  getParent: name => {
    assert.equal(name, 'xingDong');
    return { xingDong: 'gongJiOrFaShu', extraXingDong: false, ...extra };
  },
});
const allowed = (event, player, fn = canOfferExtraAttackForCrystal) => fn(event, player, get, lib);

test('crystal bonus waits until current, normal and queued bonus actions finish', () => {
  assert.equal(allowed(ongoingAttack(), candidate([attack()], { gongJiOrFaShu: 2, gongJi: 0 })), false);
  assert.equal(allowed(ongoingAttack(), candidate([attack()], { gongJiOrFaShu: 1, gongJi: 1 })), false);
  assert.equal(allowed(ongoingAttack(), candidate([attack()], { gongJiOrFaShu: 1, gongJi: 0, faShu: 1 })), false);
  assert.equal(allowed(ongoingAttack(), candidate([attack()], { gongJiOrFaShu: 1, gongJi: 0, extraXingDong: [{ xingDong: 'gongJi' }] })), false);
  assert.equal(allowed(ongoingAttack(), candidate([attack()])), true);
  assert.equal(allowed(ongoingAttack({ xingDong: 'gongJi' }), candidate([attack()], { gongJiOrFaShu: 0, gongJi: 1 })), true);
  assert.equal(allowed(ongoingAttack({ extraXingDong: true }), candidate([attack()], { gongJiOrFaShu: 1, gongJi: 0 })), false);
});

test('no crystal prompt without a playable attack card and legal target', () => {
  const stage = ongoingAttack();
  assert.equal(allowed(stage, candidate([])), false);
  assert.equal(allowed(stage, candidate([{ type: 'faShu' }])), false);
  assert.equal(allowed(stage, candidate([attack({ disabled: true })])), false);
  assert.equal(allowed(stage, candidate([attack({ noTarget: true })])), false);
  assert.equal(allowed(stage, candidate([attack({ disabled: true }), attack()])), true);
});

test('the guard serializes into the upstream character filter without external imports', () => {
  const inline = vm.runInNewContext(`(${canOfferExtraAttackForCrystal.toString()})`);
  assert.equal(allowed(ongoingAttack(), candidate([attack()]), inline), true);
  assert.equal(allowed(ongoingAttack(), candidate([]), inline), false);
});
