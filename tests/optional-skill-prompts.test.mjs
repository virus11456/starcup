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
  ...extra,
});

test('wind and fire follow-up prompts appear only if a playable matching attack exists', async () => {
  const s = await skills('shiZhouNian.js', { hasPlayer: () => false });
  const candidate = player([spell('feng'), attack('lei')]);
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [attack('feng', 'ji')];
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), true);
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: true }, candidate), false);
  candidate.cards[0].disabled = true;
  assert.equal(s.fengNuZhuiJi.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [attack('lei')];
  assert.equal(s.xiuLuoLianZhan.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [attack('huo')];
  assert.equal(s.xiuLuoLianZhan.filter({ yingZhan: false }, candidate), true);
});

test('technique and same-element follow-ups reject unavailable actions', async () => {
  const s = await skills('teDian.js', { hasPlayer: () => false });
  const candidate = player([attack('feng', 'xue')]);
  assert.equal(s.jiZhiJianYi.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [attack('feng', 'ji')];
  assert.equal(s.jiZhiJianYi.filter({ yingZhan: false }, candidate), true);
  const event = { yingZhan: false, gongJiMingZhong: true, card: attack('huo') };
  assert.equal(s.erChongJianYing.filter(event, candidate), false);
  candidate.cards = [attack('huo')];
  assert.equal(s.erChongJianYing.filter(event, candidate), true);
  assert.equal(s.erChongJianYing.filter({ ...event, gongJiMingZhong: false }, candidate), false);
});

test('magic missile follow-up preserves playable virtual conversions', async () => {
  const s = await skills('teDian.js', { hasPlayer: () => false });
  const candidate = player([spell('lei')]);
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [{ name: 'moDan', type: 'faShu' }];
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), true);
  candidate.cards = [spell('di')];
  candidate.hasSkill = id => id === 'xiangSiBing';
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: false }, candidate), true);
  assert.equal(s.xuRongZhangWo.filter({ yingZhan: true }, candidate), false);
});

test('jealous pursuit only offers a choice when both an attack and a valid target exist', async () => {
  const opponent = player([spell('di'), spell('huo')], { side: false });
  const game = { hasPlayer: predicate => [opponent].some(predicate) };
  const s = await skills('teDian.js', game);
  const candidate = player([spell('lei')]);
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), false);
  candidate.cards = [attack('feng')];
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), true);
  opponent.cards = [];
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), false);
  opponent.cards = [spell('di'), spell('huo')];
  candidate.canBiShaShuiJing = () => false;
  assert.equal(s.jiDuZhuiFang.filter({ yingZhan: false }, candidate), false);
});
