import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

/* This is a full source-level inventory of current and bundled legacy packs,
   not a blanket change to skill filters. Optional trigger checks must remain
   identical to the pinned engine; a hand can change via another effect before
   the extra action resolves. */
const packs=['shiZhouNian','yiDuanYeHuo','shenZiChuangLin','zhongMoDaoZhu','teDian','sanBan','siBan'];
const specified=new Set([
  'fengNuZhuiJi','xiuLuoLianZhan','jiZhiJianYi','erChongJianYing',
  'xuRongZhangWo','jiDuZhuiFang','jianYing','shenShengZhuiJi',
  'shun','liRuQuanYong','yiJiWuNian','faLiChaoXi','fuMoDaJi',
  'yaoJingMiShu','jianCanYing',
]);
const method=/(?:addExtraXingDong\s*\(|(?:\.storage\.)?extraXingDong\.(?:push|unshift)\s*\(|(?:player|target)\.add(?:GongJiOrFaShu|GongJi|FaShu)\s*\()/;
function lookup(node, key) {
  return node?.properties?.find(prop=>ts.isPropertyAssignment(prop) &&
    String(prop.name?.text ?? prop.name?.getText?.()).replace(/^['"]|['"]$/g,'')===key)
    ?.initializer;
}
function skillsObject(file) {
  const variables=[];
  function visit(node) {
    if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='pack_skills')
      variables.push(node.initializer);
    if(ts.isPropertyAssignment(node)&&node.name?.getText(file)==='skill'&&
       ts.isObjectLiteralExpression(node.initializer))
      variables.push(node.initializer);
    ts.forEachChild(node,visit);
  }
  visit(file);
  return variables.find(node=>ts.isObjectLiteralExpression(node));
}
test('every bundled character pack is scanned for follow-up action opportunities',async()=>{
  const inventory=[];
  for(const pack of packs) {
    const text=await readFile(new URL('../public/engine/character/'+pack+'.js',import.meta.url),'utf8');
    const ast=ts.createSourceFile(pack+'.js',text,ts.ScriptTarget.ES2022,true);
    const skills=skillsObject(ast);
    assert.ok(skills,'missing character skill source '+pack);
    let count=0;
    for(const skill of skills.properties) {
      if(!ts.isPropertyAssignment(skill)) continue;
      const id=skill.name?.text ?? skill.name?.getText(ast);
      const body=skill.initializer?.getText(ast)??'';
      if(!method.test(body)) continue;
      count++;
      const triggered=/(?:\btrigger\s*:|\bglobal\s*:)/.test(body);
      const additions=/\b(?:draw|damage|faShuDamage|addZhiShiWu|changeZhiLiao|addGaiPai|addSkill|addTempSkill|removeZhiShiWu|chooseToDiscard|removeBiShaShuiJing)\s*\(/.test(body);
      inventory.push({pack,id,triggered,multiEffect:additions});
    }
    if(['shiZhouNian','yiDuanYeHuo','shenZiChuangLin','zhongMoDaoZhu','teDian'].includes(pack))
      assert.ok(count>0,'current pack missing action candidate inventory '+pack);
  }
  const ids=new Set(inventory.map(skill=>skill.id));
  for(const id of specified) assert.ok(ids.has(id),'missing targeted optional-skill inventory '+id);
  assert.ok(inventory.length>=45,'fewer action-grant skills than the baseline pinned edition');
  const multi=inventory.filter(x=>x.multiEffect).length;
  assert.ok(multi>12,'multiple-effect action skills must not be blanket gated by hand');
  console.log('Optional-action audit: '+inventory.length+' candidate skill objects across '+
    packs.length+' packs, '+multi+' with other detectable costs/effects; '+specified.size+
    ' hand-readiness advisories. Source-only; no rule filters rewritten.');
});
test('audit advisory is never interpreted as an engine skill filter gate',async()=>{
  const engine=await readFile(new URL('../scripts/prepare-engine.mjs',import.meta.url),'utf8');
  const view=await readFile(new URL('../vendor/noname/overrides/grail-skill-readiness.js',import.meta.url),'utf8');
  assert.doesNotMatch(engine,/requireOptionalSkillCards|canOfferExtraAttackForCrystal/);
  assert.match(view,/original trigger may legally grant the action/);
  assert.match(view,/offer/i);
});
