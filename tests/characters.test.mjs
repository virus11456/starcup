import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { characterFamily, availableCharacters, uniqueCharacters, distinctCharacters } from "../vendor/noname/overrides/grail-characters.js";

test("a claimed role excludes the same role, historical editions and alternate forms", () => {
  assert.deepEqual(availableCharacters(["fengZhiJianSheng", "san_fengZhiJianSheng", "moFaShaoNv", "si_moFaShaoNv"], ["san_fengZhiJianSheng"]), ["moFaShaoNv", "si_moFaShaoNv"]);
  assert.deepEqual(availableCharacters(["hongYiZhuJiao", "zhuLvZhe", "shengNv"], ["hongYiZhuJiao"]), ["shengNv"]);
  assert.equal(uniqueCharacters(["shengNv", "san_shengNv"]), false);
  assert.equal(uniqueCharacters(["shengNv", "tianShi"]), true);
  assert.equal(uniqueCharacters(["moGong", "moGongEX"]), false);
  assert.deepEqual(availableCharacters(["moGong", "moGongEX", "fengYinShi"], ["moGongEX"]), ["fengYinShi"]);
});

const root = new URL("../public/engine/", import.meta.url);
const source = (await fs.readFile(new URL("mode/xingBei.js", root), "utf8"))
  .replace(/^import .*?;\s*$/gm, "")
  .replace('export const type = "mode";', "")
  .replace("export default () =>", "const getMode = () =>");
const catalog = JSON.parse(await fs.readFile(new URL("catalog.json", root)));
// Run the real shipped draft step, including its AI randomRemove path.
for (const count of [4, 6, 8]) test(`${count}-player shipped draft never duplicates a role after a legacy/free pick`, () => {
  for (const chosen of ["san_fengZhiJianSheng", "si_moFaShaoNv", "hongYiZhuJiao", "moGongEX"]) {
    const game = { addRecentCharacter() {}, grailCharacterFamily: characterFamily, grailAvailableCharacters: availableCharacters };
    let content;
    game.createEvent = () => ({ setContent(fn) { content = fn; } });
    const mode = vm.runInNewContext(source + "\ngetMode();", { game, characterFamily, availableCharacters, distinctCharacters, freeDraftMethods: {} });
    mode.game.chooseCharacterDuoXuanYi();
    const text = `const fn = ${content.toString()};`;
    const ast = ts.createSourceFile("draft.js", text, ts.ScriptTarget.Latest, true);
    const statements = ast.statements[0].declarationList.declarations[0].initializer.body.statements;
    const marker = n => statements.findIndex(s => ts.isExpressionStatement(s) && s.expression.text === `step ${n}`);
    const step = statements.slice(marker(1) + 1, marker(2)).map(s => s.getText(ast)).join("\n");
    game.players = Array.from({ length: count }, () => ({ init(id) { assert.ok(id); this.name1 = id; } }));
    game.me = game.players[0];
    const context = vm.createContext({ game, ui: {}, _status: {}, result: { links: [chosen] } });
    vm.runInContext(`
      Array.prototype.remove = function(v) { const i=this.indexOf(v); if(i>=0) this.splice(i,1); return this; };
      Array.prototype.removeArray = function(a) { for(const v of a) this.remove(v); return this; };
      Array.prototype.randomRemove = function() { return this.shift(); };
      Array.prototype.randomGet = function() { return this[0]; };
      var lib = { characterReplace: {hongYiZhuJiao:['hongYiZhuJiao','zhuLvZhe'], zhuLvZhe:['zhuLvZhe','hongYiZhuJiao']} };
      var event = { list: ${JSON.stringify(["fengZhiJianSheng", "san_fengZhiJianSheng", "moFaShaoNv", "si_moFaShaoNv", "hongYiZhuJiao", "zhuLvZhe", ...catalog.characters.map(c => c.id)])} };
    `, context);
    // Helpers return a normal Array from the VM's candidate array.
    vm.runInContext(step, context);
    assert.equal(game.me.name1, chosen, "preserve the player's explicit selection");
    assert.equal(uniqueCharacters(game.players.map(p => p.name1)), true);
  }
});

for (const count of [4, 6, 8]) test(`${count}-player online candidates are disjoint by role family`, () => {
  const pool = distinctCharacters([...catalog.characters, ...catalog.legacyCharacters].map(c => c.id));
  assert.ok(pool.length >= count * 5);
  const hands = Array.from({ length: count }, (_, i) => pool.slice(i * 5, i * 5 + 5));
  assert.equal(uniqueCharacters(hands.flat()), true);
});
