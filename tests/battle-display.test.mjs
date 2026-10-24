import { test } from "node:test";
import assert from "node:assert/strict";
import { describeStage, teamSummary } from "../vendor/noname/overrides/grail-battle-state.js";

test("nested response and healing windows take precedence over the enclosing action", () => {
  const action = Object.freeze({ name: "xingDong" });
  const response = Object.freeze({ name: "yingZhan", parent: action });
  assert.deepEqual(describeStage({ name: "chooseControl", parent: response }, { started: true }), { id: "response", label: "應戰回應" });
  const healing = Object.freeze({ name: "zhiLiao", parent: { name: "damage", parent: action } });
  assert.deepEqual(describeStage({ name: "chooseBool", parent: healing }, { started: true }), { id: "response", label: "治療回應" });
});

test("discard during damage remains a discard choice, and extra actions stay in the action phase", () => {
  assert.equal(describeStage({ name: "chooseToDiscard", parent: { name: "damage" } }, { started: true }).id, "discard");
  assert.equal(describeStage({ name: "xingDong", extraXingDong: true }, { started: true }).label, "追加行動");
});

test("setup, final settlement, unknown skills and cyclic event chains are safe", () => {
  assert.equal(describeStage({ name: "chooseButton" }).id, "setup");
  assert.equal(describeStage({ name: "yingZhan" }, { started: true, over: true }).id, "over");
  const event = { name: "unknownSkill" };
  event.parent = event;
  assert.equal(describeStage(event, { started: true }).label, "技能與時機結算");
  assert.equal(describeStage(undefined, { started: true }).id, "settlement");
});

test("public team totals preserve zero morale and current grail goal without accessing private state", () => {
  const game = Object.freeze({
    hongShiQi: 0, lanShiQi: 12, hongXingBei: 2, lanXingBei: 4, xingBeiMax: 5,
    hongZhanJi: Object.freeze(["baoShi", "shuiJing", "baoShi"]), lanZhanJi: Object.freeze([]),
    get players() { throw new Error("must not read player hands"); },
    get deck() { throw new Error("must not read deck order"); },
  });
  assert.deepEqual(teamSummary(game), [
    { id: "red", name: "紅隊", morale: 0, grails: 2, goal: 5, gems: 2, crystals: 1 },
    { id: "blue", name: "藍隊", morale: 12, grails: 4, goal: 5, gems: 0, crystals: 0 },
  ]);
  assert.equal(teamSummary({})[0].morale, 0);
  const settled = Object.freeze({ hongShiQi: -1, lanShiQi: 9 });
  assert.equal(teamSummary(settled)[0].morale, 0);
  assert.equal(settled.hongShiQi, -1, "display does not change rule settlement");
});
