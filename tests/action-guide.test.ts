import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRoom,
  applyCommand,
  publicView,
  actionOptions,
  type CardKind,
} from "../lib/game.ts";
import { roleFor, skillReminders } from "../lib/roles.ts";

function setup() {
  const r = createRoom("ABCDEFGH", "owner", "主人", "測試", 4, false);
  applyCommand(r, r.host, { type: "bots" });
  applyCommand(r, r.host, { type: "start" });
  return r;
}
function setHand(r: ReturnType<typeof setup>, seat: number, kinds: CardKind[]) {
  r.players[seat].hand = kinds.map((kind, i) => ({
    id: `test-${seat}-${i}`,
    kind,
  }));
}
test("action hints preserve state, restrict attacks to opponents and explain unavailable purchases", () => {
  const r = setup();
  setHand(r, 0, ["fire", "water", "light", "shield"]);
  const before = JSON.stringify(r);
  const options = actionOptions(r, r.host);
  assert.equal(JSON.stringify(r), before);
  assert.deepEqual(options.find((a) => a.cardId === "test-0-0")?.targets, [
    r.players[1].id,
    r.players[3].id,
  ]);
  assert.equal(options.find((a) => a.type === "buy")?.enabled, false);
  assert.match(options.find((a) => a.type === "buy")?.reason || "", /3 張/);
  assert.equal(options.find((a) => a.type === "redraw")?.enabled, false);
  assert.deepEqual(actionOptions(r, r.players[1].id), []);
});
test("dark attacks never offer a counter and own hidden cards never leave via hints", () => {
  const r = setup();
  setHand(r, 0, ["dark"]);
  setHand(r, 1, ["dark", "fire", "light"]);
  applyCommand(r, r.host, {
    type: "play",
    cardId: "test-0-0",
    target: r.players[1].id,
  });
  const options = actionOptions(r, r.players[1].id);
  assert.ok(
    options.filter((a) => a.type === "counter").every((a) => !a.enabled),
  );
  assert.ok(options.find((a) => a.type === "block")?.enabled);
  const view = publicView(r, "owner");
  assert.deepEqual(view.actions, []);
  assert.ok(!JSON.stringify(view).includes("test-1-"));
});
test("overflow and weakness offer only their mandatory resolution choices", () => {
  const r = setup();
  setHand(r, 0, Array(8).fill("fire"));
  r.overflow = { player: r.host, resume: "main" };
  assert.deepEqual(
    actionOptions(r, r.host).map((a) => [a.type, a.count]),
    [["discard", 2]],
  );
  r.overflow = null;
  setHand(r, 0, ["fire"]);
  r.weak = true;
  r.players[0].effects = [{ id: "weak-effect", kind: "weak" }];
  assert.deepEqual(
    actionOptions(r, r.host).map((a) => a.type),
    ["weakSkip", "weakDraw"],
  );
});
test("role reminders require relevant legal card use and disappear outside that phase", () => {
  const r = setup();
  r.players[0].avatar = 2;
  setHand(r, 0, ["water", "light", "fire", "fire"]);
  assert.equal(roleFor(2).id, "saint");
  assert.equal(skillReminders(publicView(r, "owner"), "test-0-0").length, 1);
  assert.equal(skillReminders(publicView(r, "owner"), "test-0-1").length, 0);
  r.overflow = { player: r.host, resume: "main" };
  setHand(r, 0, Array(8).fill("water"));
  assert.equal(skillReminders(publicView(r, "owner"), "test-0-0").length, 0);
});
