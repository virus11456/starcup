import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { loadPacks } from "../scripts/engine-catalog.mjs";
const pin = JSON.parse(
  await fs.readFile(new URL("../vendor/noname/pin.json", import.meta.url)),
);
const catalog = JSON.parse(
  await fs.readFile(new URL("../public/engine/catalog.json", import.meta.url)),
);
const root = new URL("../public/engine/", import.meta.url).pathname;
const { packs, lib } = await loadPacks(root, pin);
test("catalog maps every current role to the requested encyclopedia without claiming skill verification", () => {
  for (const role of catalog.characters) {
    assert.ok(role.source.startsWith("https://xingbeichuanshuobaike.webnode.tw/"), role.id);
    assert.equal(role.reviewStatus, "pending");
    assert.ok(role.engineSource.includes(pin.commit));
  }
  assert.ok(catalog.characters.find(c => c.id === "shenMiXueZhe").source.includes("矜貴之女2"));
  assert.ok(catalog.characters.find(c => c.id === "jiLuZhe").source.includes("朵拉貢幻"));
  for (const card of catalog.deck) {
    assert.ok(catalog.cards.some(c => c.id === card.kind));
    for (const mark of card.marks) assert.ok(catalog.skillMarks[mark]?.name, mark);
  }
  assert.ok(catalog.cards.every(c => c.sources.length > 0));
});
test("victory replay saving skips unopened databases even when IndexedDB is available", async () => {
  const source = await fs.readFile(root + "noname/game/index.js", "utf8");
  const ast = ts.createSourceFile("game.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const blocks = [];
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(ast).includes("game.getVideoName") && node.thenStatement.getText(ast).includes('lib.db.transaction(["video"]')) blocks.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(blocks.length, 1);
  const context = { _status: { video: false, videoInited: true }, vinum: 20, game: { getVideoName() {} }, window: { indexedDB: {} }, lib: {} };
  // Execute the actual shipped settlement branch, not a duplicate condition.
  assert.doesNotThrow(() => vm.runInNewContext(`(function(){${blocks[0]}})()`, context));
  const sentinel = new Error("replay transaction reached");
  context.lib.db = { transaction() { throw sentinel; } };
  assert.throws(() => vm.runInNewContext(`(function(){${blocks[0]}})()`, context), error => error === sentinel);
});
test("local-storage integration disables replay persistence in both config layers", async () => {
  const source = await fs.readFile(root + "grail-config.js", "utf8");
  const values = new Map();
  const context = { location: { search: "?players=4&edition=current" }, URLSearchParams, window: { config: { all: {} } }, localStorage: { setItem(key, value) { values.set(key, value); } } };
  context.document = { documentElement: { classList: { toggle() {} } } };
  vm.runInNewContext(source, context);
  assert.equal(context.window.nodb, true);
  assert.equal(context.window.config.video, 0);
  assert.equal(JSON.parse(values.get("star_grail_full_v1_config")).video, 0);
});
test("physical deck matches official quantities, seven elements, factions and unique identities", () => {
  assert.equal(catalog.deck.length, 150);
  assert.equal(new Set(catalog.deck.map((c) => c.id)).size, 150);
  const counts = catalog.deck.reduce(
    (m, c) => ((m[c.kind] = (m[c.kind] || 0) + 1), m),
    {},
  );
  assert.deepEqual(counts, {
    anMie: 6,
    shuiLianZhan: 21,
    huoYanZhan: 21,
    fengShenZhan: 21,
    leiGuangZhan: 21,
    diLieZhan: 21,
    shengGuang: 11,
    xuRuo: 6,
    zhongDu: 6,
    shengDun: 10,
    moDan: 6,
  });
  assert.equal(new Set(catalog.deck.map((c) => c.element)).size, 7);
  assert.equal(new Set(catalog.deck.map((c) => c.faction)).size, 5);
  assert.ok(catalog.deck.some((c) => c.marks.length === 2));
});
test("all enabled official roles have executable skill definitions and portraits", async () => {
  assert.equal(catalog.characters.length, 68);
  for (const c of catalog.characters) {
    assert.ok(pin.packs.includes(c.pack));
    await fs.access(
      new URL(
        ".." + c.portrait.replace("/engine", "/public/engine"),
        import.meta.url,
      ),
    );
    for (const skill of c.skills)
      assert.ok(lib.skill[skill.id], c.id + ":" + skill.id);
  }
});
test("community characters are absent from the engine registration, not only the catalog", async () => {
  for (const id of pin.excludedSpecialCharacters) {
    assert.equal(lib.character[id], undefined, id);
    assert.ok(!catalog.characters.some((c) => c.id === id));
  }
  for (const name of ["poXiao", "boss"])
    await assert.rejects(fs.access(root + "character/" + name + ".js"));
});
test("legacy roles stay in a separate namespace and catalog", () => {
  assert.equal(catalog.legacyCharacters.length, 16);
  assert.ok(catalog.characters.every((c) => !pin.legacyPacks.includes(c.pack)));
  assert.ok(
    catalog.legacyCharacters.every(
      (c) => c.id.startsWith("san_") || c.id.startsWith("si_"),
    ),
  );
});
test("offensive cards reject allies; real executable elemental responses and skill costs remain", () => {
  for (const id of [
    "huoYanZhan",
    "shuiLianZhan",
    "fengShenZhan",
    "leiGuangZhan",
    "diLieZhan",
    "anMie",
  ]) {
    const card = packs.card.card[id];
    assert.equal(card.filterTarget({}, { side: true }, { side: true }), false);
    assert.equal(card.filterTarget({}, { side: true }, { side: false }), true);
    assert.equal(typeof card.content, "function");
  }
  assert.equal(typeof lib.skill.meiWeiRongHe.filterCard, "function");
  assert.equal(typeof lib.skill.huiMieFengBao.content, "function");
});
test("self-hosted match mode contains no upstream submission credentials or hall", async () => {
  const mode = await fs.readFile(root + "mode/xingBei.js", "utf8");
  assert.ok(!mode.includes("Authorization"));
  assert.ok(!mode.includes("/v1/matches"));
  const library = await fs.readFile(root + "noname/library/index.js", "utf8");
  assert.ok(library.includes('hallURL = ""'));
  assert.ok(library.includes("dbURL = ''"));
});
