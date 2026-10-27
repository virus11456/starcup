import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function skills(file, game) {
  const source = (await readFile(new URL(`../public/engine/character/${file}`, import.meta.url), 'utf8'))
    .replace(/^import .*?;\s*$/gm, '');
  const lib = { filter: { cardEnabled: card => !card.disabled } };
  const get = {
    xiBie: card => card.element,
    mingGe: card => card.category,
    type: card => card.type,
    name: card => card.name,
  };
  let pack;
  game.import = (_type, factory) => { pack = factory(lib, game, {}, get, {}, {}); };
  vm.runInNewContext(source, { lib, game, get, ui: {}, ai: {}, _status: {}, installOfficialGlutton: value => value }, { timeout: 2000 });
  assert.ok(pack?.skill, `${file} registered character skills`);
  return pack.skill;
}

const attack = (element, category = 'ji') => ({ element, category, type: 'gongJi' });
const spell = element => ({ element, type: 'faShu' });
const player = (cards, extra = {}) => ({
  side: true,
  cards,
  countCards(area, predicate) {
    assert.equal(area, 'h');
    return predicate ? this.cards.filter(predicate).length : this.cards.length;
  },
  hasSkill: () => false,
  canBiShaShuiJing: () => true,
  storage: { gongJiOrFaShu: 1, gongJi: 0 },
  hasUseTarget: card => !card.noTarget,
  ...extra,
});

test('wind sword saint crystal bonus follows its printed timing even before other actions are exhausted', async () => {
  const s = await skills('shiZhouNian.js', { hasPlayer: () => false });
  const trigger = { yingZhan: false, getParent: () => ({ xingDong: 'gongJiOrFaShu' }) };
  const candidate = player([]);
  assert.equal(s.jianYing.filter(trigger, candidate), true);
  candidate.storage.gongJiOrFaShu = 2;
  assert.equal(s.jianYing.filter(trigger, candidate), true);
  candidate.storage.gongJiOrFaShu = 1;
  candidate.cards = [spell('feng')];
  assert.equal(s.jianYing.filter(trigger, candidate), true);
  candidate.cards = [attack('feng', 'ji')];
  candidate.cards[0].noTarget = true;
  assert.equal(s.jianYing.filter(trigger, candidate), true);
  candidate.cards[0].noTarget = false;
  assert.equal(s.jianYing.filter({ ...trigger, yingZhan: true }, candidate), false);
  candidate.canBiShaShuiJing = () => false;
  assert.equal(s.jianYing.filter(trigger, candidate), false);
});

test('wind and fire follow-ups remain optional under the original timing even with no matching hand card', async () => {
  const s = await skills('shiZhouNian.js', { hasPlayer: () => false });
  const candidate = player([spell('feng'), attack('lei')]);
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [attack('feng', 'ji')];
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), true);
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: true }, candidate), false);
  candidate.cards[0].disabled = true;
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [attack('lei')];
  assert.equal(s.xiuLuoLianZhan.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [attack('huo')];
  assert.equal(s.xiuLuoLianZhan.filter({ yingZhan: false }, candidate), true);
});

test('technique and same-element follow-ups preserve legal trigger timing without added card gates', async () => {
  const s = await skills('teDian.js', { hasPlayer: () => false });
  const candidate = player([attack('feng', 'xue')]);
  assert.equal(s.jiZhiJianYi.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [attack('feng', 'ji')];
  assert.equal(s.jiZhiJianYi.filter({ yingZhan: false }, candidate), true);
  const event = { yingZhan: false, gongJiMingZhong: true, card: attack('huo') };
  assert.equal(s.erChongJianYing.filter(event, candidate), true);
  candidate.cards = [attack('huo')];
  assert.equal(s.erChongJianYing.filter(event, candidate), true);
  assert.equal(s.erChongJianYing.filter({ ...event, gongJiMingZhong: false }, candidate), false);
});

test('magic missile follow-up can still be offered before the player holds a magic missile', async () => {
  const s = await skills('teDian.js', { hasPlayer: () => false });
  const candidate = player([spell('lei')]);
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [{ name: 'moDan', type: 'faShu' }];
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [spell('di')];
  candidate.hasSkill = id => id === 'xiangSiBing';
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), true);
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: true }, candidate), false);
});

test('jealous pursuit uses printed crystal and response conditions, not current hand or targets', async () => {
  const opponent = player([spell('di'), spell('huo')], { side: false });
  const game = { hasPlayer: predicate => [opponent].some(predicate) };
  const s = await skills('teDian.js', game);
  const candidate = player([spell('lei')]);
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [attack('feng')];
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), true);
  opponent.cards = [];
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), true);
  opponent.cards = [spell('di'), spell('huo')];
  candidate.canBiShaShuiJing = () => false;
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), false);
});
