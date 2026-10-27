import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { localizeJavaScript } from '../scripts/localize-engine.mjs';

const pin = JSON.parse(await readFile(new URL('../vendor/noname/pin.json', import.meta.url), 'utf8'));
const printer = ts.createPrinter({ removeComments: true });

function definitions(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const skills = new Map();
  function visit(node) {
    if ((ts.isVariableDeclaration(node) && node.name.getText(ast) === 'pack_skills') ||
        (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'skill')) {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const skill of node.initializer.properties) {
          const name = skill.name?.getText(ast);
          if (!name) continue;
          assert.equal(skills.has(name), false, `ambiguous skill ${filename}/${name}`);
          skills.set(name, printer.printNode(ts.EmitHint.Unspecified, skill, ast));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(skills.size > 0, `no skill definitions found in ${filename}`);
  return skills;
}

for (const pack of [...pin.packs, ...pin.legacyPacks]) {
  test(`${pack}: prepared original skills retain pinned triggers, filters, costs and effects`, async () => {
    const filename = `${pack}.js`;
    const original = await readFile(new URL(`../.engine-cache/${pin.commit}/character/${filename}`, import.meta.url), 'utf8');
    const expected = definitions(localizeJavaScript(original, filename).source, filename);
    const actual = definitions(await readFile(new URL(`../public/engine/character/${filename}`, import.meta.url), 'utf8'), filename);
    assert.deepEqual([...actual.keys()], [...expected.keys()]);
    for (const [name, definition] of expected) {
      assert.equal(actual.get(name), definition, `${pack}/${name} changed a pinned rule`);
    }
    // Explicitly anchor all seven previously restricted skills in this check.
    const guarded = pack === 'shiZhouNian' ? ['jianYing', 'fengNuZhuiJi', 'xiuLuoLianZhan'] :
      pack === 'teDian' ? ['jiZhiJianYi', 'erChongJianYing', 'xuRongZhangWo', 'jiDuZhuiFang'] : [];
    for (const name of guarded) assert.ok(actual.has(name), `${name} must remain covered`);
  });
}
