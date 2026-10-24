import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const source = (
  await fs.readFile(
    new URL(
      "../vendor/noname/overrides/character/official-glutton.js",
      import.meta.url,
    ),
    "utf8",
  )
)
  .replace(/^import .*?;\s*$/gm, "")
  .replace("export function", "function");
function setup() {
  const lib = { skill: {} },
    game = { players: [] },
    get = { position: (c) => c.position, xiBie: (c) => c.element };
  const ctx = vm.createContext({ lib, game, get, _status: {} });
  vm.runInContext(source, ctx);
  const pack = {
    character: {},
    characterSort: { teDian: {} },
    skill: {},
    translate: {},
  };
  ctx.installOfficialGlutton(pack);
  Object.assign(lib.skill, pack.skill);
  return { lib, game, pack, skill: lib.skill.official_sanMiao };
}
const missile = (id, extra = {}) => ({
  id,
  name: "moDan",
  original: "h",
  position: "d",
  ...extra,
});
test("formal glutton has independent registration and five card-backed skills", () => {
  const { pack } = setup();
  assert.equal(pack.character.baoShiShaoNv[3].length, 5);
  assert.equal(pack.character.nong_baoShiShaoNv, undefined);
  assert.equal(pack.translate.baoShiShaoNv, "爆食少女");
});
test("fusion accepts physical water/fire cards, rejects other elements and virtual conversions", () => {
  const s = setup().pack.skill.official_rongHe;
  assert.ok(s.filterCard({ element: "shui" }));
  assert.ok(s.filterCard({ element: "huo" }));
  assert.ok(!s.filterCard({ element: "lei" }));
  assert.ok(!s.filterCard({ element: "shui", cards: [{}] }));
});
test("three seconds only recovers publicly discarded allied missiles already in the discard pile", () => {
  const { skill } = setup(),
    player = { side: true },
    ally = { side: true };
  const a = missile("a"),
    b = missile("b", { original: "x" }),
    hidden = missile("hidden", { original: "s" }),
    kept = missile("kept", { position: "x" });
  const event = {
    name: "lose",
    player: ally,
    type: "discard",
    cards: [a, b, hidden, kept],
    getParent: () => ({ showCards: true }),
  };
  assert.equal(
    skill
      .candidates(event, player)[0]
      .cards.map((c) => c.id)
      .join(","),
    "a,b",
  );
  assert.equal(
    skill.candidates({ ...event, getParent: () => ({}) }, player).length,
    0,
  );
  assert.equal(skill.candidates({ ...event, player }, player).length, 0);
  assert.equal(
    skill.candidates({ ...event, player: { side: false } }, player).length,
    0,
  );
});
test("missile chain recovery excludes conversions and combines physical missiles from the same ally", () => {
  const { skill, game, lib } = setup(),
    player = { side: true },
    ally = { side: true };
  game.players = [player, ally];
  const a = missile("a"),
    b = missile("b");
  let root = { name: "useCard", card: { name: "moDan" } };
  const event = {
    name: "cardsDiscard",
    getParent: () => ({ name: "orderingDiscard", parent: root }),
    getd: (p) => (p === ally ? [a, b, a] : []),
  };
  assert.equal(skill.candidates(event, player)[0].cards.length, 2);
  root.card.name = "huoYanZhan";
  assert.equal(skill.candidates(event, player).length, 0);
  root.card.name = "moDan";
  root.skill = "converted";
  lib.skill.converted = { viewAs: { name: "moDan" } };
  assert.equal(skill.candidates(event, player).length, 0);
});
test("shown skill discards are deferred to the end of the enclosing skill, with cost before recovery", async () => {
  const { skill, game } = setup(),
    trace = [];
  const player = {
    side: true,
    countCards: () => 2,
    getHandcardLimit: () => 6,
    logSkill: () => {},
    chooseBool: () => ({
      set() {
        return this;
      },
      async forResult() {
        return { bool: true };
      },
    }),
    async chooseToDiscard() {
      trace.push("cost");
    },
    async gain(cards) {
      trace.push("gain:" + cards.map((c) => c.id).join(","));
    },
  };
  const ally = { side: true },
    root = { name: "useSkill", after: [], parent: { name: "phase" } };
  const next = [];
  next.remove = function (x) {
    this.splice(this.indexOf(x), 1);
  };
  const event = { next };
  game.createEvent = () => {
    const q = {
      setContent(fn) {
        this.content = fn;
      },
    };
    next.push(q);
    return q;
  };
  const trigger = {
    name: "lose",
    player: ally,
    type: "discard",
    cards: [missile("a"), missile("b")],
    getParent: () => ({ name: "discard", showCards: true, parent: root }),
  };
  skill.content(event, trigger, player);
  assert.equal(next.length, 0);
  assert.equal(root.after.length, 1);
  assert.deepEqual(trace, []);
  const q = root.after[0];
  await q.content(q, undefined, player);
  assert.deepEqual(trace, ["cost", "gain:a,b"]);
});
test("recovery does not retrieve a card that moved out of discard while the skill finished", async () => {
  const { skill, game } = setup();
  const card = missile("a");
  let prompted = false;
  const player = {
    side: true,
    countCards: () => 1,
    chooseBool() {
      prompted = true;
      throw new Error("must not prompt");
    },
  };
  const next = [];
  next.remove = function (x) {
    this.splice(this.indexOf(x), 1);
  };
  game.createEvent = () => {
    const q = {
      setContent(fn) {
        this.content = fn;
      },
    };
    next.push(q);
    return q;
  };
  const root = { name: "useSkill", after: [] };
  const trigger = {
    name: "lose",
    player: { side: true },
    type: "discard",
    cards: [card],
    getParent: () => ({ showCards: true, parent: root }),
  };
  skill.content({ next }, trigger, player);
  card.position = "x";
  const q = root.after[0];
  await q.content(q, undefined, player);
  assert.equal(prompted, false);
});
