import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { auditCharacterPrompts, renderPromptInventory } from '../scripts/audit-character-prompts.mjs';

const audit = await auditCharacterPrompts();
const catalog = JSON.parse(await readFile(new URL('../public/full-engine/catalog.json', import.meta.url), 'utf8'));

test('prompt inventory covers every selectable current and legacy character, including all registered skills', () => {
  assert.equal(audit.roles.filter(role => !role.legacy).length, 68);
  assert.equal(audit.roles.filter(role => role.legacy).length, 16);
  assert.deepEqual(audit.roles.map(role => role.id), [...catalog.characters, ...catalog.legacyCharacters].map(role => role.id));
  for (const role of audit.roles) {
    for (const skill of role.registered) assert.ok(role.inspected.includes(skill.id), role.id + '/' + skill.id);
  }
  assert.equal(audit.roles.filter(role => !role.legacy).reduce((n, role) => n + role.registered.length, 0), 455);
  assert.equal(audit.roles.some(role => role.id === 'nong_baoShiShaoNv'), false);
});

test('inheritance and nested action grants stay in the audit instead of disappearing behind top-level regex counts', () => {
  const role = id => audit.roles.find(item => item.id === id);
  assert.ok(role('moGongEX').costSkills.includes('jiFengZhuiShe'), 'EX magic archer inherits the real card-payment selection');
  assert.ok(role('baoShiShaoNv').costSkills.includes('official_heiDong'), 'formal glutton override is included');
  assert.ok(role('san_fengZhiJianSheng').actionSkills.includes('fengNuZhuiJi'), 'legacy shared skills are not missed');
  assert.ok(role('jianXiZhiPian').actionSkills.includes('yuanSuXueTu_fengRen'), 'inherited subskill content is inspected');
  assert.ok(role('maoXianJia').actionSkills.includes('touTianHuanRi_tou'), 'nested follow-up is inspected');
  assert.ok(role('qiDaoShi').actionSkills.includes('xunJieCiFu_xiaoGuo'));
  const unresolved = role('luoLiFanZhang').unresolvedLinks;
  assert.ok(unresolved.includes('xueYingKuangDao_gongJiMingZhong'), 'unresolved upstream group must be reported, not silently marked complete');
});

test('checked-in per-character inventory matches the generated report', async () => {
  const report = await readFile(new URL('../docs/character-prompt-inventory-20261028.md', import.meta.url), 'utf8');
  assert.equal(report, renderPromptInventory(audit));
});

async function nativeSkills() {
  const get = {
    type: card => card.type, xiBie: card => card.element, name: card => card.name,
    prompt: id => id,
  };
  const targets = [];
  const lib = { skill: {}, translate: {}, filter: { cardEnabled: card => !card.disabled } };
  const game = { log() {}, hasPlayer: predicate => targets.some(predicate) };
  game.import = (_type, factory) => {
    const pack = factory(lib, game, {}, get, {}, {});
    Object.assign(lib.skill, pack.skill);
    Object.assign(lib.translate, pack.translate);
  };
  const source = (await readFile(new URL('../public/engine/character/shiZhouNian.js', import.meta.url), 'utf8'))
    .replace(/^import .*?;\s*$/gm, '');
  const scope = { lib, game, get };
  vm.runInNewContext(source, scope, { timeout: 2000 });
  return { skills: lib.skill, targets, scope };
}
const attack = element => ({ type: 'gongJi', element });
const spell = element => ({ type: 'faShu', element });
const chain = result => ({ set() { return this; }, forResult: async () => result });
function hand(cards) {
  return {
    countCards: (_zone, predicate) => predicate ? cards.filter(predicate).length : cards.length,
    hasCard: predicate => cards.some(predicate),
  };
}

test('wind pursuit separates human eligibility, AI advice and the subsequent attack-card restriction', async () => {
  const { skills } = await nativeSkills();
  const skill = skills.fengNuZhuiJi;
  const trigger = { yingZhan: false };
  const noWind = hand([attack('huo'), spell('feng')]);
  assert.equal(skill.filter(trigger, noWind), true);
  assert.equal(skill.check(trigger, noWind), false);
  assert.equal(skill.filter(trigger, hand([])), true);
  assert.equal(skill.filter({ yingZhan: true }, noWind), false);
  const granted = [];
  await skill.content({}, trigger, { addExtraXingDong: (...args) => granted.push(args) });
  assert.equal(granted.length, 1);
  const filter = granted[0].find(arg => typeof arg === 'function');
  assert.equal(filter(attack('feng'), noWind), true);
  assert.equal(filter(attack('huo'), noWind), false);
  assert.equal(filter(spell('feng'), noWind), false);
  assert.equal(filter({ ...attack('feng'), disabled: true }, noWind), false);
  // No payment API is provided: a new fee would fail this native content test.
});

test('a missing wind card and an unpaid crystal are different eligibility conditions', async () => {
  const { skills } = await nativeSkills();
  for (const cards of [[], [spell('feng')], [attack('huo')]]) {
    const candidate = { ...hand(cards), canBiShaShuiJing: () => false };
    assert.equal(skills.fengNuZhuiJi.filter({ yingZhan: false }, candidate), true);
    assert.equal(skills.jianYing.filter({ yingZhan: false }, candidate), false);
    candidate.canBiShaShuiJing = () => true;
    assert.equal(skills.jianYing.filter({ yingZhan: false }, candidate), true);
  }
});

test('broad prompt filters never substitute for water/spell payment selection', async () => {
  const { skills } = await nativeSkills();
  for (const [id, cards, trigger] of [
    ['shuiYing', [attack('huo')], { cause: 'damage' }],
    ['guanChuanSheJi', [attack('feng')], { yingZhan: false }],
    ['tiShenWanOu', [attack('huo')], { faShu: false }],
    ['moNengFanZhuan', [attack('huo'), attack('feng')], { faShu: true }],
  ]) {
    let selected = false;
    const candidate = {
      ...hand(cards), canBiShaShuiJing: () => true,
      chooseCard(...args) {
        selected = true;
        const predicate = args.find(arg => typeof arg === 'function');
        assert.equal(cards.some(predicate), false, id + ' has no payable card');
        return chain({ bool: false, cards: [] });
      },
      chooseCardTarget(options) {
        selected = true;
        assert.equal(cards.some(options.filterCard), false, id + ' has no payable card');
        return chain({ bool: false, cards: [], targets: [] });
      },
    };
    assert.equal(skills[id].filter(trigger, candidate), true, id + ' broad pinned filter');
    const event = { skill: id };
    await skills[id].cost(event, trigger, candidate);
    assert.equal(selected, true);
    assert.equal(event.result.bool, false, id + ' cannot successfully pay');
    assert.equal(event.result.cards.length, 0);
  }
});

test('missing legitimate targets are rejected by the native targeted spell filters', async () => {
  const { skills, targets } = await nativeSkills();
  const candidate = { ...hand([spell('feng')]), side: true };
  assert.equal(skills.fengZhiJieJing.filter({}, candidate), false);
  targets.push({ hasJiChuXiaoGuo: () => true });
  assert.equal(skills.fengZhiJieJing.filter({}, candidate), true);
  targets.length = 0;
  assert.equal(skills.chengJie.filter({}, candidate), false);
  targets.push({ zhiLiao: 0 });
  assert.equal(skills.chengJie.filter({}, candidate), false);
  targets[0].zhiLiao = 1;
  assert.equal(skills.chengJie.filter({}, candidate), true);
});

test('holy domain really resolves with zero/one cards rather than requiring two cards as an activation fee', async () => {
  const { skills } = await nativeSkills();
  for (const count of [0, 1, 2]) {
    let discarded = 0, paid = 0, ownHealing = 0, allyHealing = 0;
    const ally = { changeZhiLiao: value => { allyHealing += value; } };
    const candidate = {
      ...hand(Array.from({ length: count }, () => spell('feng'))),
      canBiShaShuiJing: () => true, zhiLiao: 0,
      removeBiShaShuiJing() { paid++; },
      chooseToDiscard(amount, forced, zone) {
        assert.equal(forced, true);
        assert.equal(zone, 'h');
        discarded = Math.min(count, amount);
      },
      chooseControl() { return { set() { return this; }, forResultControl: async () => '選項二' }; },
      chooseTarget() { return { set() { return this; }, forResultTargets: async () => [ally] }; },
      changeZhiLiao(value) { ownHealing += value; },
    };
    assert.equal(skills.shenShengLingYu.filter({}, candidate), true);
    await skills.shenShengLingYu.content({}, {}, candidate);
    assert.equal(paid, 1);
    assert.equal(discarded, Math.min(count, 2));
    assert.equal(ownHealing, 2);
    assert.equal(allyHealing, 1);
  }
});

test('indomitable will draws before the additional attack and retains its marker effect with an initially empty hand', async () => {
  const { skills, scope } = await nativeSkills();
  const order = [];
  const candidate = {
    ...hand([]), canBiShaShuiJing: () => true,
    removeBiShaShuiJing() { order.push('pay'); },
    draw() { order.push('draw'); },
    addZhiShiWu(id, count) { assert.equal(id, 'jianQi'); assert.equal(count, 1); order.push('marker'); },
    addGongJi() { order.push('attack'); },
  };
  assert.equal(skills.buQuYiZhi.filter({ yingZhan: false }, candidate), true);
  scope.player = candidate; // Native legacy step content receives this binding from its compiler.
  skills.buQuYiZhi.content();
  assert.deepEqual(order, ['pay', 'draw', 'marker', 'attack']);
});
