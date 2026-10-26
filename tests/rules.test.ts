import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, searchRules } from "../lib/rules.ts";
import { WIKI, ruleSources } from "../lib/wiki-reference.ts";
test("natural questions find the relevant core rules", () => {
  assert.equal(searchRules("暗滅可以應戰嗎")[0].id, "dark");
  assert.equal(searchRules("魔彈怎麼傳")[0].id, "missile");
  assert.equal(searchRules("治疗能抵御虚弱吗")[0].id, "healing");
  assert.ok(searchRules("手牌上限").some((r) => r.id === "overflow"));
});
test("rule citations identify the relevant encyclopedia sections", () => {
  for (const r of RULES.filter(r => r.category !== "版本")) {
    assert.ok(ruleSources(r.id).length, r.id);
    assert.ok(ruleSources(r.id).every(s => s.url.startsWith(WIKI.url)));
  }
  assert.ok(ruleSources("deck").some(s => s.title === "牌庫構造"));
  assert.ok(ruleSources("counter").some(s => s.title === "常見問題"));
  assert.deepEqual(ruleSources("connection"), []);
});
test("unknown questions return no invented answer and categories constrain results", () => {
  assert.equal(searchRules("龍騎士與時空法師互相換位時如何結算").length, 0);
  assert.ok(searchRules("", "卡牌").every((r) => r.category === "卡牌"));
  assert.match(searchRules("提煉")[0].scope, /隊伍星石.*角色能量/);
});
