import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { traditionalText, localizeJavaScript } from "../scripts/localize-engine.mjs";
import { loadPacks } from "../scripts/engine-catalog.mjs";

test("localization preserves URLs, asset names, HTML attributes and template expressions", () => {
  const original = 'const cardID = "fengZhiJianSheng"; const url = "https://example.com/游戏/规则"; const asset = "image/角色.png"; const html = `<a href="/游戏/规则" class="规则">选择${cardID}，伤害+2</a>`;';
  const { source } = localizeJavaScript(original);
  const result = vm.runInNewContext(`${source}; ({cardID,url,asset,html})`);
  assert.equal(result.cardID, "fengZhiJianSheng");
  assert.equal(result.url, "https://example.com/游戏/规则");
  assert.equal(result.asset, "image/角色.png");
  assert.equal(result.html, '<a href="/游戏/规则" class="规则">選擇fengZhiJianSheng，傷害+2</a>');
});

test("Chinese menu keys and selection comparisons stay in sync", () => {
  const code = 'const menu = {游戏规则:"选择角色"}; const chosen="选项一"; const ok = chosen === "选项一"; const label = menu["游戏规则"]; ({ok,label})';
  const result = vm.runInNewContext(localizeJavaScript(code).source);
  assert.equal(result.ok, true);
  assert.equal(result.label, "選擇角色");
});

test("morale is converted as a game term without turning 的士氣 into taxi wording", () => {
  const original = '本次的士气下降值恒定为1；对方的士气最少为1。搭的士回家。';
  const expected = '本次的士氣下降值恆定為1；對方的士氣最少為1。搭計程車回家。';
  assert.equal(traditionalText(original), expected);
  assert.equal(traditionalText(expected), expected);
  const { source } = localizeJavaScript('const role="勇者"; `'+original+' ${role}`;');
  assert.equal(vm.runInNewContext(source), expected + ' 勇者');
  assert.equal(traditionalText('<a href="/的士气" data-name="的士气">造成的士气下降</a>'),
    '<a href="/的士气" data-name="的士气">造成的士氣下降</a>');
});

const root = fileURLToPath(new URL("../public/engine/", import.meta.url));
const pin = JSON.parse(await fs.readFile(new URL("../vendor/noname/pin.json", import.meta.url)));
const { lib } = await loadPacks(root, pin);
test("shipped morale skills retain their game meaning after localization", () => {
  for (const id of ['shenZhiBiHu', 'siDou', 'diaoLing']) {
    assert.ok(lib.translate[id + '_info'].includes('的士氣'), id);
    assert.ok(!lib.translate[id + '_info'].includes('計程車'), id);
  }
});
test("real localized 判決天平 choices still execute their original skill branches", () => {
  const code = `const skill = ${lib.skill.panJueTianPing.content.toString()};`;
  const ast = ts.createSourceFile("skill.js", code, ts.ScriptTarget.Latest, true);
  const body = ast.statements[0].declarationList.declarations[0].initializer.body.statements;
  const step = body.findIndex(s => ts.isExpressionStatement(s) && s.expression.text === "step 2");
  assert.ok(step > 0);
  const branch = body.slice(step + 1).map(s => s.getText(ast)).join("\n");
  for (const [choice, expected] of [["選項一", ["discard"]], ["選項二", ["draw:7", "baoShi:1"]]]) {
    const calls = [];
    vm.runInNewContext(branch, {
      result: { control: choice }, player: {
        getCards: () => ["original-card-id"],
        discard: () => calls.push("discard"),
        getHandcardLimit: () => 7,
        drawTo: n => calls.push(`draw:${n}`),
        addZhanJi: (kind, n) => calls.push(`${kind}:${n}`),
      },
    });
    assert.deepEqual(calls, expected);
  }
});

test("all catalog character, skill, card and mark descriptions are Traditional Chinese", async () => {
  const catalog = JSON.parse(await fs.readFile(root + "catalog.json"));
  const records = [...catalog.characters, ...catalog.legacyCharacters, ...catalog.cards, ...Object.values(catalog.skillMarks)];
  for (const record of records) {
    for (const item of [record, ...(record.skills || [])]) {
      for (const key of ["name", "description"]) {
        if (item[key]) assert.equal(item[key], traditionalText(item[key]), `${item.id}: ${key}`);
      }
    }
  }
});
