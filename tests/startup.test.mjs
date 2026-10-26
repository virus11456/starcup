import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../public/engine/", import.meta.url);
const launcher = await fs.readFile(new URL("grail-config.js", root), "utf8");
const source = await fs.readFile(new URL("noname/init/index.js", root), "utf8");
const ast = ts.createSourceFile("init.js", source, ts.ScriptTarget.Latest, true);
let touchBranch;
function visit(node) {
  if (ts.isIfStatement(node) && node.expression.getText(ast) === '"ontouchstart" in document') touchBranch = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(touchBranch, "Use the shipped upstream first-touch branch");

for (const device of [
  { name: "iPhone", touch: true, coarse: true, ua: "iphone" },
  { name: "Android", touch: true, coarse: true, ua: "android" },
  { name: "iPad desktop user agent", touch: true, coarse: true, ua: "macintosh" },
  { name: "hybrid laptop with mouse", touch: true, coarse: false, ua: "windows" },
  { name: "desktop", touch: false, coarse: false, ua: "linux" },
  { name: "desktop QA with actual phone stylesheet", touch: false, coarse: false, ua: "linux", phone: true, narrow: true },
]) test(`${device.name}: first launch and repeated launches never prompt or reload`, () => {
  const saved = new Map();
  let config;
  const classes = new Set();
  const context = {
    location: { search: "?players=6&edition=current" + (device.phone ? "&phone-layout=1" : "") }, URLSearchParams,
    window: { config: { all: {} }, matchMedia: query => ({ matches: query.includes("pointer") ? device.coarse : (device.narrow ?? device.coarse) }) },
    localStorage: { setItem: (key, value) => saved.set(key, value) },
    document: { ...(device.touch ? { ontouchstart: null } : {}), documentElement: { classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    } } },
    lib: {}, ua: device.ua,
    config: { get: key => config[key] },
    game: {
      saveConfig: (key, value) => { config[key] = value; },
      reload: () => assert.fail("Unexpected reload loop"),
    },
    confirm: () => assert.fail("Unexpected blocking first-touch prompt"),
  };
  // Mimic the existing broken-session flag too, then reopen three times.
  saved.set("star_grail_full_v1_config", JSON.stringify({ totouched: true, touchscreen: true }));
  for (let launch = 0; launch < 3; launch++) {
    vm.runInNewContext(launcher, context);
    config = context.window.grailLaunchConfig;
    vm.runInNewContext(touchBranch, context);
    assert.equal(config.totouched, true);
    assert.equal(config.touchscreen, device.coarse);
    assert.equal(config.phonelayout, device.coarse || !!device.phone);
    if (device.narrow ?? device.coarse) {
      assert.equal(config.fold_card, false, "Keep the upstream scrollh touch-scroll path enabled for larger phone hands");
      assert.equal(context.window.config.fold_card, false);
    }
    assert.equal(classes.has("grail-phone-layout"), config.phonelayout);
    assert.equal(context.window.config.touchscreen, device.coarse);
    assert.equal(config.auto_popped_config, false);
    assert.equal(config.cardshape, "oblong");
    assert.equal(context.window.config.cardshape, "oblong");
    assert.equal(context.window.config.auto_popped_config, false);
    assert.equal(config.versus_mode_mode_config_xingBei, "three");
  }
});
