import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { loadPacks } from './engine-catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const actionMethods = new Set(['addExtraXingDong', 'addGongJi', 'addFaShu', 'addGongJiOrFaShu']);
const grantMethods = new Set(['addSkill', 'addTempSkill', 'addAdditionalSkill']);
const effectMethods = new Set([
  'draw', 'damage', 'faShuDamage', 'discard', 'chooseToDiscard', 'chooseToGive',
  'changeZhiLiao', 'addZhiShiWu', 'removeZhiShiWu', 'addGaiPai', 'removeGaiPai',
  'removeBiShaShuiJing', 'removeBiShaBaoShi', 'changeNengLiang',
  ...grantMethods,
]);

const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const strings = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];

// Parse actual calls, rather than matching comments, display text or AI hints.
function callsIn(fn) {
  if (typeof fn !== 'function') return [];
  const source = fn.toString();
  let ast = ts.createSourceFile('skill.js', `const value = (${source});`, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) {
    ast = ts.createSourceFile('skill.js', `const value = ({${source}});`, ts.ScriptTarget.Latest, true);
  }
  if (ast.parseDiagnostics.length) throw new Error('Cannot parse skill function: ' + source.slice(0, 80));
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const expression = node.expression;
      calls.push({
        method: expression.name.text,
        receiver: expression.expression.getText(ast),
        arguments: node.arguments.map(arg => arg.getText(ast)),
        literalArguments: node.arguments.flatMap(arg => {
          if (ts.isStringLiteralLike(arg)) return [arg.text];
          if (ts.isArrayLiteralExpression(arg)) return arg.elements.filter(ts.isStringLiteralLike).map(x => x.text);
          return [];
        }),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return calls;
}

export async function auditCharacterPrompts(projectRoot = root) {
  const pin = JSON.parse(await readFile(path.join(projectRoot, 'vendor/noname/pin.json'), 'utf8'));
  const catalog = JSON.parse(await readFile(path.join(projectRoot, 'public/full-engine/catalog.json'), 'utf8'));
  if (catalog.commit !== pin.commit) throw new Error('Catalog does not match the pinned engine; run prepare:engine first');
  const { packs, lib } = await loadPacks(path.join(projectRoot, 'public/engine'), pin);
  const definitions = new Map();
  function register(id, info, pack, parent = null) {
    if (definitions.has(id)) throw new Error('Duplicate skill definition: ' + id);
    definitions.set(id, { id, info, pack, parent });
    for (const [key, child] of Object.entries(info.subSkill || {})) register(id + '_' + key, child, pack, id);
  }
  for (const pack of [...pin.packs, ...pin.legacyPacks]) {
    for (const [id, info] of Object.entries(packs[pack].skill)) register(id, info, pack);
  }
  function effective(id, chain = []) {
    const item = definitions.get(id);
    if (!item) throw new Error('Unresolved inherited skill: ' + id);
    if (chain.includes(id)) throw new Error('Cyclic inherited skill: ' + [...chain, id].join(' -> '));
    return item.info.inherit ? { ...effective(item.info.inherit, [...chain, id]), ...item.info } : item.info;
  }
  const skills = [...definitions.values()].map(item => {
    const info = effective(item.id);
    const calls = Object.entries(info).flatMap(([field, value]) =>
      callsIn(value).map(call => ({ field, ...call })));
    const effects = calls.filter(call => !['filter', 'filterCard', 'filterTarget', 'viewAsFilter', 'check'].includes(call.field));
    const grants = effects.filter(call => actionMethods.has(call.method) ||
      (['push', 'unshift'].includes(call.method) && call.receiver.endsWith('.extraXingDong')));
    const links = new Set([
      ...strings(info.group),
      ...strings(item.info.inherit),
      ...[...definitions.values()].filter(child => child.parent === item.id).map(child => child.id),
      ...effects.filter(call => grantMethods.has(call.method)).flatMap(call => call.literalArguments).filter(id => definitions.has(id)),
    ]);
    return {
      id: item.id, name: plain(lib.translate[item.id] || item.id), pack: item.pack,
      parent: item.parent, inherit: item.info.inherit || null,
      trigger: info.trigger || null, enable: info.enable || null, forced: info.forced === true,
      cost: typeof info.cost === 'function',
      checks: ['filter', 'filterCard', 'filterTarget', 'viewAsFilter'].filter(key => typeof info[key] === 'function'),
      actionGrants: grants.map(({ field, method, arguments: args }) => ({ field, method, arguments: args })),
      otherEffectMethods: [...new Set(effects.filter(call => effectMethods.has(call.method)).map(call => call.method))],
      links: [...links],
    };
  });
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const roles = [...catalog.characters, ...catalog.legacyCharacters].map(role => {
    const inspected = new Set();
    const unresolved = new Set();
    function inspect(id) {
      if (inspected.has(id)) return;
      const skill = byId.get(id);
      if (!skill) { unresolved.add(id); return; }
      inspected.add(id);
      for (const link of skill.links) inspect(link);
    }
    for (const skill of role.skills) {
      if (!byId.has(skill.id)) throw new Error('Unresolved registered skill: ' + role.id + '/' + skill.id);
      inspect(skill.id);
    }
    const related = [...inspected].map(id => byId.get(id));
    return {
      id: role.id, name: role.name, pack: role.pack, legacy: pin.legacyPacks.includes(role.pack),
      registered: role.skills.map(skill => ({ id: skill.id, name: skill.name })),
      inspected: [...inspected],
      costSkills: related.filter(skill => skill.cost).map(skill => skill.id),
      actionSkills: related.filter(skill => skill.actionGrants.length).map(skill => skill.id),
      unresolvedLinks: [...unresolved],
    };
  });
  return { commit: pin.commit, packs: [...pin.packs, ...pin.legacyPacks], roles, skills };
}

export function renderPromptInventory(audit) {
  const current = audit.roles.filter(role => !role.legacy);
  const legacy = audit.roles.filter(role => role.legacy);
  const reachable = new Set(audit.roles.flatMap(role => role.inspected));
  const byId = new Map(audit.skills.map(skill => [skill.id, skill]));
  const label = id => plain(byId.get(id)?.name || id).replaceAll('|', '\\|');
  const lines = [
    '# 全角色技能詢問：可重跑的靜態清單', '',
    `釘選版本：\`${audit.commit}\`。現行 **${current.length}** 位，舊版 **${legacy.length}** 位；現行直接登記 **${current.reduce((sum, role) => sum + role.registered.length, 0)}** 項技能／標記。`, '',
    `七包載入後共 ${audit.skills.length} 個技能及子技能定義（含未開放角色留下的定義）；由可選角色的登記、inherit、group、宣告子技能及字面值 addSkill 關聯覆蓋 ${reachable.size} 個定義。`, '',
    '這是來源掃描及風險盤點，並非逐角色自然對局或所有 FAQ 裁定已通過。關聯欄包含宣告子技能，不表示每條路徑都會在同一對局啟用；動態技能名稱、when/step 事件、mod 及共通行動／選擇流程仍需人工核對。未解析關聯不算通過。', '',
    '「有 cost」表示存在原生付款／選牌階段；「追加行動」以實際 AST 呼叫判定，排除 check/AI、註解和翻譯文字。沒有追加行動不代表沒有其他缺牌詢問。未將這些結果寫入技能 filter。', '',
    '重建：`npm run prepare:engine` 後，執行 `node scripts/audit-character-prompts.mjs --markdown`。完整機器可讀結果：`node scripts/audit-character-prompts.mjs`。', '',
  ];
  for (const [title, rows] of [['現行角色', current], ['舊版變體', legacy]]) {
    lines.push('## ' + title, '', '| 角色 | 直接登記技能／標記 | 有 cost 的關聯技能 | 追加行動的關聯技能 |', '|---|---|---|---|');
    for (const role of rows) lines.push(`| ${role.name} | ${role.registered.map(skill => label(skill.id)).join('、')} | ${role.costSkills.map(label).join('、') || '—'} | ${role.actionSkills.map(label).join('、') || '—'} |`);
    lines.push('');
  }
  const unresolved = audit.roles.filter(role => role.unresolvedLinks.length);
  lines.push('## 未解析的靜態關聯', '');
  lines.push(...(unresolved.length ? unresolved.map(role => `- ${role.name}：${role.unresolvedLinks.map(id => '\u0060' + id + '\u0060').join('、')}`) : ['無；動態關聯限制仍如上所述。']));
  return lines.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = await auditCharacterPrompts();
  process.stdout.write(process.argv.includes('--markdown') ? renderPromptInventory(audit) : JSON.stringify(audit, null, 2) + '\n');
}
