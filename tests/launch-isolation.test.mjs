import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../public/engine/', import.meta.url);
const launcher = await fs.readFile(new URL('grail-config.js', root), 'utf8');
const native = await fs.readFile(new URL('noname/init/index.js', root), 'utf8');
const ast = ts.createSourceFile('init.js', native, ts.ScriptTarget.Latest, true);
let loadSource, bootStatements;
const visit = node => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadConfig') loadSource = node.getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadConfigPromise') {
    const statements = Array.from(node.parent.parent.parent.statements);
    const start = statements.findIndex(s => s.getText(ast).startsWith('const loadCssPromise'));
    const end = statements.findIndex(s => ts.isForInStatement(s) && s.expression.getText(ast) === 'config2');
    assert.ok(start >= 0 && end > start);
    bootStatements = statements.slice(start, end + 1).map(s => s.getText(ast)).join('\n');
  }
  ts.forEachChild(node, visit);
};
visit(ast); assert.ok(loadSource && bootStatements);

function page(search, storage, coarse = false) {
  const lib = { configprefix: 'star_grail_full_v1_', mode: { xingBei: { config: {} } } };
  const context = vm.createContext({
    lib, location: { search }, URLSearchParams,
    window: { config: { all: {}, mode_config: { global: {} } }, matchMedia: () => ({ matches: coarse }) },
    document: { documentElement: { classList: { toggle() {} } } }, localStorage: storage,
    loadCss: async () => {}, config: { get: name => lib.config[name], set: (name, value) => { lib.config[name] = value; } },
  });
  vm.runInContext(launcher, context);
  return { context, boot: () => vm.runInContext(`${loadSource}; (async()=>{${bootStatements};return lib.config;})()`, context) };
}
function sharedStorage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('interleaved online, solo and catalog launchers retain their own native mode, roster, capacity and input', async () => {
  for (const reverse of [false, true]) {
    const storage = sharedStorage();
    const cases = [
      { query: '?online=ABCDEFGH', mode: 'connect', count: 'two', legacy: false, coarse: false },
      { query: '?players=8&edition=legacy&phone-layout=1', mode: 'xingBei', count: 'four', legacy: true, coarse: true },
      { query: '?view=catalog&edition=current', mode: 'illustration', count: 'two', legacy: false, coarse: false },
      { query: '?players=6&edition=current', mode: 'xingBei', count: 'three', legacy: false, coarse: false },
    ];
    if (reverse) cases.reverse();
    // All launch scripts finish before the slower native imports load config.
    // This reproduced a real multiplayer iframe incorrectly starting solo.
    const pages = cases.map(c => page(c.query, storage, c.coarse));
    for (let i = 0; i < pages.length; i++) {
      const config = await pages[i].boot(), expected = cases[i];
      assert.equal(config.mode, expected.mode);
      assert.equal(config.mode_config.xingBei.versus_mode, expected.count);
      assert.equal(config.mode_config.xingBei.shiQiMax, expected.count === 'four' ? 18 : 15);
      assert.equal(config.characters.includes('sanBan'), expected.legacy);
      assert.equal(config.characters.includes('siBan'), expected.legacy);
      assert.equal(config.touchscreen, expected.coarse);
      assert.equal(config.phonelayout, expected.coarse);
      assert.equal(config.totouched, true);
      assert.equal(config.cardshape, 'oblong');
    }
  }
});

test('another tab saving mode or preferences during native loading cannot redirect this launch', async () => {
  const storage = sharedStorage();
  const online = page('?online=ABCDEFGH', storage);
  storage.setItem('star_grail_full_v1_config', JSON.stringify({ mode: 'xingBei', characters: ['sanBan'], touchscreen: true }));
  const config = await online.boot();
  assert.equal(config.mode, 'connect'); assert.equal(config.characters.includes('sanBan'), false);
  assert.equal(config.touchscreen, false); assert.equal(config.extensions.length, 0);
  assert.equal(online.context.window.grailLaunchConfig, undefined, 'release the bootstrap-only snapshot');
});
