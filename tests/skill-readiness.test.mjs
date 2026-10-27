import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOptionalSkillReadiness,
  optionalSkillReadinessNotes,
  offeredOptionalSkillChoices,
  updateOptionalSkillChoiceHints,
} from '../vendor/noname/overrides/grail-skill-readiness.js';

const get = {
  xiBie: card => card.element,
  mingGe: card => card.fate,
  type: card => card.kind,
  name: card => card.name,
};
let cards = [];
const player = {
  side: true,
  getCards(zone) { assert.equal(zone, 'h'); return cards; },
  countCards(zone) { assert.equal(zone, 'h'); return cards.length; },
};
function check(skill, input, context) {
  cards = input;
  return getOptionalSkillReadiness(skill, player, get, context);
}
function card(kind, element = 'shui', fate = 'yong', name = 'card') {
  return { kind, element, fate, name };
}
function node(link, textContent, { disabled = false } = {}) {
  const dataset = {};
  const attrs = {};
  const cls = new Set(disabled ? ['disabled'] : []);
  return {
    link, textContent, dataset, title: '', children: [],
    style: {}, classList: { contains: s => cls.has(s) },
    getAttribute(name) { return attrs[name] ?? null; },
    removeAttribute(name) { delete attrs[name]; if (name === 'title') this.title = ''; },
    get offsetWidth() { return 70 + textContent.length * 8 + (dataset.grailReadiness ? 48 : 0); },
  };
}
function nativeUi(options) {
  const wrapper = node(null, '');
  const buttons = options.map(o => node(o.link, o.text, { disabled: o.disabled }));
  wrapper.children = buttons;
  wrapper.classList = { contains: cls => cls === 'control' };
  wrapper.style = { width: '100px' };
  for (const button of buttons) button.parentNode = wrapper;
  const container = node(null, '');
  container.children = [wrapper];
  let updated = 0;
  return { ui: { control: container, updatec() { updated++; } },
    wrapper, buttons, calls: () => updated };
}
test('restricted wind/fire/fate follow-ups each detect matching attack category', () => {
  assert.match(check('fengNuZhuiJi', [card('gongJi','huo')]).message, /風系攻擊牌/);
  assert.match(check('xiuLuoLianZhan', [card('gongJi','feng')]).message, /火系攻擊牌/);
  assert.match(check('jiZhiJianYi', [card('gongJi','feng','yong')]).message, /技類攻擊牌/);
  assert.equal(check('fengNuZhuiJi',[card('gongJi','feng')]), null);
  assert.equal(check('xiuLuoLianZhan',[card('gongJi','huo')]), null);
  assert.equal(check('jiZhiJianYi',[card('gongJi','lei','ji')]), null);
});
test('same-element chase checks the triggering attack when known, otherwise warns only about its condition', () => {
  const context = { triggerCard: card('gongJi','lei') };
  assert.match(check('erChongJianYing',[card('gongJi','shui')], context).message, /同系攻擊牌/);
  assert.equal(check('erChongJianYing',[card('gongJi','lei')], context), null);
  const unknown = check('erChongJianYing',[card('gongJi','lei')]);
  assert.match(unknown.message, /須使用與本次攻擊同系/);
  assert.equal(unknown.short, '需同系');
});
test('magic missile note never falsely treats all spells as a usable missile', () => {
  assert.match(check('xuRongZhangWo', [card('faShu','lei','yong','qita')]).message, /魔彈牌/);
  assert.equal(check('xuRongZhangWo', [card('faShu','lei','yong','moDan')]), null);
});
test('virtual magic missile from 相思病 avoids a false缺牌 warning', () => {
  const converter = {
    getCards: () => [card('gongJi','feng')],
    getSkills: () => ['xiangSiBing'],
  };
  assert.equal(getOptionalSkillReadiness('xuRongZhangWo',converter,get),null);
  assert.match(getOptionalSkillReadiness('xuRongZhangWo',{
    getCards: () => [card('gongJi','huo')], getSkills: () => ['xiangSiBing'],
  },get).message,/魔彈/);
});
test('target-only and other special extra attack responses retain options and only show informational lack-of-card text', () => {
  for (const id of ['jianCanYing','yaoJingMiShu']) {
    assert.match(check(id,[]).message,/依原規則仍可發動/);
    assert.equal(check(id,[card('gongJi')]),null);
  }
});
test('pursuit with a more-cards enemy checks public target count without changing legality', () => {
  cards=[card('gongJi')];
  const opponent = { side: false, countCards: () => 1 };
  const note = getOptionalSkillReadiness('jiDuZhuiFang',player,get,{players:[player,opponent]});
  assert.match(note.message, /手牌數比你多/);
  assert.equal(getOptionalSkillReadiness('jiDuZhuiFang',player,get,{
    players:[player,{side:false,countCards:()=>2}]}),null);
  assert.match(check('jiDuZhuiFang',[]).message, /攻擊/);
});
test('unrestricted extra attacks and spells receive factual current-hand advisories', () => {
  for(const id of ['jianYing','shenShengZhuiJi','shun','liRuQuanYong','yiJiWuNian'])
    assert.match(check(id,[]).message, /目前手上沒有攻擊牌/);
  for(const id of ['faLiChaoXi','fuMoDaJi'])
    assert.match(check(id,[]).message, /目前手上沒有法術牌/);
  assert.equal(check('faLiChaoXi',[card('faShu')]),null);
  assert.equal(check('jianYing',[card('gongJi')]),null);
});
test('unknown or unoffered skills and missing game information get no speculative missing-card judgment', () => {
  cards=[];
  assert.equal(getOptionalSkillReadiness('nonexistent',player,get),null);
  assert.deepEqual(optionalSkillReadinessNotes([],player,get),[]);
  assert.deepEqual(optionalSkillReadinessNotes(['fengNuZhuiJi'],null,get),[]);
  assert.deepEqual(optionalSkillReadinessNotes(['fengNuZhuiJi'],player,{}),[]);
  assert.match(optionalSkillReadinessNotes(['fengNuZhuiJi','fengNuZhuiJi'],player,get)[0], /依原規則仍可發動/);
});
test('native multi-skill control options are recognized by source links and translated text', () => {
  const input=nativeUi([
    {link:'fengNuZhuiJi',text:'[響應]風怒追擊[回合限定]'},
    {link:'translated-skill',text:'[響應]修羅連斬[回合限定]'},
    {link:'cancel',text:'取消'},
  ]);
  const result=offeredOptionalSkillChoices(input.ui,{translate:{xiuLuoLianZhan:'[響應]修羅連斬[回合限定]'}});
  assert.deepEqual(result.map(x=>x.id),['fengNuZhuiJi','xiuLuoLianZhan']);
});
test('native option badge is informative and reversible; click links/nodes remain untouched', () => {
  cards=[card('gongJi','huo')];
  const input=nativeUi([{link:'fengNuZhuiJi',text:'風怒追擊'},{link:'cancel',text:'取消'}]);
  const {ui,buttons,wrapper}=input;
  const action=buttons[0];
  action.title='技能規則';
  const nativeLink=action.link;
  const nativeText=action.textContent;
  assert.equal(updateOptionalSkillChoiceHints(ui,{},player,get).length,1);
  assert.equal(action.dataset.grailReadiness,'缺風攻');
  assert.equal(action.link,nativeLink);
  assert.equal(action.textContent,nativeText);
  assert.match(action.title,/風系攻擊牌/);
  assert.ok(Number.parseInt(wrapper.style.width)>100);
  assert.equal(input.calls(),1);
  updateOptionalSkillChoiceHints(ui,{},player,get);
  assert.equal(input.calls(),1,'repeated HUD ticks do not repeatedly relayout native controls');
  cards=[card('gongJi','feng')];
  assert.deepEqual(updateOptionalSkillChoiceHints(ui,{},player,get),[]);
  assert.equal(action.dataset.grailReadiness,undefined);
  assert.equal(action.title,'技能規則','original native tooltip is restored');
  assert.equal(input.calls(),2);
});
test('disabled or hidden native response choices are excluded', () => {
  const input=nativeUi([{link:'fengNuZhuiJi',text:'風怒追擊',disabled:true}]);
  cards=[];
  assert.deepEqual(updateOptionalSkillChoiceHints(input.ui,{},player,get),[]);
  assert.equal(input.calls(),0);
});
test('bridge checks native skill choices; marker stays click-through and engine content is unchanged', async () => {
  const { readFile } = await import('node:fs/promises');
  const bridge = await readFile(new URL('../vendor/noname/overrides/grail-bridge.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../vendor/noname/overrides/grail-polish.css', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../scripts/prepare-engine.mjs', import.meta.url), 'utf8');
  assert.match(bridge,/updateOptionalSkillChoiceHints\(ui, lib, me, get/);
  assert.match(bridge,/符合發動時機的技能/);
  assert.match(bridge,/help\.append\(note\)/);
  assert.match(css, /#window #control > \.control > div\[data-grail-readiness\]::after/);
  assert.doesNotMatch(engine, /requireOptionalSkillCards|canOfferExtraAttackForCrystal/);
});
