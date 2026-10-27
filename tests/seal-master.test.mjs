import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

const ids = ['diZhiFengYin','shuiZhiFengYin','huoZhiFengYin','fengZhiFengYin','leiZhiFengYin'];
const source = await readFile(new URL('../public/engine/character/shiZhouNian.js', import.meta.url), 'utf8');
const compiler = ts.createSourceFile('shiZhouNian.js', source, ts.ScriptTarget.ES2022, true);
let skills;
for (const node of compiler.statements) {
  if (!ts.isVariableStatement(node)) continue;
  const declaration = node.declarationList.declarations.find(
    item => item.name.getText(compiler) === 'pack_skills');
  if (declaration?.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
    skills = declaration.initializer;
    break;
  }
}
assert.ok(skills, 'the pinned current-edition character pack must be present');

function loadSkill(id, scope) {
  const node = skills.properties.find(item => item.name?.getText(compiler) === id);
  assert.ok(node, 'missing native skill '+id);
  const code = '({' + node.getText(compiler) + '})';
  return vm.runInNewContext(code, scope, { timeout:1000 })[id];
}

test('all five seal variants use native card/target restrictions and place physical seal cards', () => {
  for (const id of ids) {
    const sent = [];
    const card = { hasDuYou: name => name === id };
    const cards = [card];
    const player = { side:true };
    const enemy = { side:false };
    const target = {
      side:false,
      hasJiChuXiaoGuo:() => false,
      isIn:() => true,
      addFengYin(...args) { sent.push(args); },
    };
    const lib = {skill:{},filter:{targetEnabled:(virtual, owner, target) =>
      virtual.name === id && owner === player && target === enemy}};
    const skill = loadSkill(id,{lib,game:{hasPlayer:fn=>fn(enemy)}, target,cards,player});
    assert.equal(skill.type,'faShu',id);
    assert.equal(skill.enable,'faShu',id);
    assert.equal(skill.position,'h',id);
    assert.equal(skill.filterCard(card),true,id+' native unique card');
    assert.equal(skill.filterCard({hasDuYou:()=>false}),false,id+' nonexclusive cards not accepted');
    assert.equal(skill.filterTarget({}, player, enemy),true,id+' valid enemy');
    assert.equal(skill.filterTarget({}, player, {side:true,hasJiChuXiaoGuo:()=>false}),false,id+' never target ally');
    if(id==='leiZhiFengYin') {
      assert.equal(skill.prepare,'useCard',id+' pinned skill metadata unchanged');
      assert.equal(skill.discard,false,id+' pinned card-movement setting unchanged');
    } else {
      assert.equal(skill.useCard,true,id+' pinned skill metadata unchanged');
      assert.equal(skill.prepare,undefined,id+' has no prepare hook');
    }
    skill.content();
    assert.equal(sent.length,1,id+' should place exactly one seal');
    assert.equal(sent[0][0],id+'_xiaoGuo',id+' must preserve exact persistent seal effect');
    assert.equal(sent[0][1],cards,id+' must preserve the physical card instance');
    assert.equal(sent[0][2],player,id+' must preserve seal source for future retaliation');
  }
});
test('lightning seal preserves the original special-card ownership flow', () => {
  const info = loadSkill('leiZhiFengYin',{});
  assert.equal(info.discard,false, 'do not change the pinned lightning seal card movement');
});
test('invalid upstream prepare useCard would throw, but generated lightning seal cannot throw', async () => {
  const pinnedNativeContent = await readFile(new URL('../public/engine/noname/library/element/content.js',import.meta.url),'utf8');
  assert.match(pinnedNativeContent,/case "useCard":\s*break;\s*default:\s*info\.prepare\(cards,\s*player,\s*targets\)/);
  const emulate = (info, recognized = false) => {
    if (info.prepare) {
      switch(info.prepare) {
        case 'give': case 'give2': case 'throw': case 'throw2': break;
        case 'useCard': if(recognized) break;
        default: info.prepare([],{},[]);
      }
    }
  };
  assert.throws(() => emulate({prepare:'useCard'},false),TypeError,
    'original native dispatcher throws on the sealed card marker');
  for(const id of ids)
    assert.doesNotThrow(()=>emulate(loadSkill(id,{}),true),
      id+' accepted by the patched dispatcher without changing its metadata');
});
test('all seal names and damage triggers stay in the pinned native character pack', () => {
  for(const id of ids) {
    const skill = loadSkill(id,{});
    assert.equal(typeof skill.subSkill.xiaoGuo.filter,'function');
    assert.equal(typeof skill.subSkill.xiaoGuo.content,'function');
    assert.equal(skill.subSkill.xiaoGuo.forced,true);
  }
});
