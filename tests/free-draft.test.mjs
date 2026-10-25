import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { claimCharacter, availableCharacters, uniqueCharacters } from '../vendor/noname/overrides/grail-characters.js';

const catalog = JSON.parse(await fs.readFile(new URL('../public/engine/catalog.json', import.meta.url)));
const pool = catalog.characters.map(c => c.id);
const source = (await fs.readFile(new URL('../public/engine/grail-free-draft.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '').replace('export const freeDraftMethods', 'const freeDraftMethods');
const library = await fs.readFile(new URL('../public/engine/noname/library/index.js', import.meta.url), 'utf8');
const nativeResultSource = library.match(/\t\t\tresult\(result\) \{([\s\S]*?)\n\t\t\t\},/)[1];
test('fresh guest installs shared draft methods before the native init/reinit handshake', async () => {
  const relay = (await fs.readFile(new URL('../vendor/noname/overrides/grail-online.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\s*$/gm, '').replace('export async function', 'async function');
  const game = {}, method = () => {}, family = () => {};
  const context = vm.createContext({
    game, lib: {}, _status: {}, ui: {}, freeDraftMethods: { grailRenderFreeDraft: method },
    characterFamily: family, availableCharacters, URLSearchParams, location: { search: '?online=TEST1234' },
    sessionStorage: { getItem: () => 'test-seat' }, crypto: { randomUUID: () => 'test-connection' },
    document: { createElement: () => ({ setAttribute() {}, classList: { toggle() {} } }), body: { append() {} } },
    AbortSignal: { timeout() {} }, fetch: () => new Promise(() => {}),
  });
  vm.runInContext(relay + '\nstartRelay();', context);
  assert.equal(game.grailRenderFreeDraft, method);
  assert.equal(game.grailCharacterFamily, family);
  assert.equal(game.grailAvailableCharacters, availableCharacters);
});
function harness(count = 4) {
  const sends = [], accepted = [], updates = [];
  const players = Array.from({ length: count }, (_, i) => ({
    playerid: String(i + 1), isOnline: () => i === 1,
    send: (...args) => sends.push({ seat: String(i + 1), args }),
    wait(fn) { this.sendback = fn; },
    unwait(result) { accepted.push(this.playerid); this.sendback?.(result, this); },
    init(role) { this.name1 = role; }, update() {}, hideTimer() {},
  }));
  const lib = { configOL: {}, status: { videoId: 10 }, playerOL: Object.fromEntries(players.map(p => [p.playerid, p])), node: { observing: [] } };
  const game = { players, me: players[0], grailClaimCharacter: claimCharacter,
    grailAvailableCharacters(c, s) { return Object.assign(availableCharacters(c, s), { randomGet() { return this[0]; } }); },
    createEvent: () => ({ setContent(fn) { game.content = fn; } }),
    initSideAndPosition() {}, pause() {}, broadcastAll(fn, view) { fn(view); },
  };
  const context = vm.createContext({ game, lib, _status: {}, claimCharacter, get: { charactersOL: () => pool.slice(), idDialog: () => ({ close() {} }) }, ui: { arena: { classList: { remove() {} } } } });
  const methods = vm.runInContext(source + '\nfreeDraftMethods;', context);
  Object.assign(game, methods);
  game.grailPublishDraft = () => updates.push(game.grailDraftSnapshot());
  game.grailChooseCharacterOLFree();
  const ast = ts.createSourceFile('draft.js', `const fn = ${game.content.toString()}`, ts.ScriptTarget.Latest, true);
  const statements = ast.statements[0].declarationList.declarations[0].initializer.body.statements;
  function step(n) {
    const start = statements.findIndex(s => ts.isExpressionStatement(s) && s.expression.text === `step ${n}`) + 1;
    let end = statements.findIndex((s, i) => i >= start && ts.isExpressionStatement(s) && s.expression.text === `step ${n + 1}`);
    if (end < 0) end = statements.length;
    return vm.runInContext(`(function(){${statements.slice(start, end).map(s => s.getText(ast)).join('\n')}})()`, context);
  }
  step(1);
  const receive = vm.runInContext(`(function(result){${nativeResultSource}})`, context);
  return { game, players, sends, accepted, updates, step, receive };
}
test('simultaneous native confirmations keep the first claim and re-prompt the losing seat', () => {
  for (const order of [['1', '2'], ['2', '1']]) {
    const h = harness();
    const result = { bool: true, links: [pool[0]], grailDraftId: 10 };
    for (const id of order) h.receive.call({ id }, result);
    assert.equal(h.game.grailFreeDraftState.claims[order[0]], pool[0]);
    assert.equal(h.game.grailFreeDraftState.claims[order[1]], undefined);
    assert.deepEqual(h.accepted, [order[0]], 'rejected seat must remain in native wait');
    h.receive.call({ id: order[1] }, { ...result, links: [pool[1]] });
    assert.equal(h.game.grailFreeDraftState.claims[order[1]], pool[1]);
    assert.equal(h.accepted.length, 2);
  }
});
test('invalid, stale, and repeated results cannot overwrite a confirmed role or finish a second wait', () => {
  const h = harness();
  h.receive.call({ id: '2' }, { links: ['not-a-role'], grailDraftId: 10 });
  h.receive.call({ id: '2' }, { links: [pool[0]], grailDraftId: 9 });
  assert.equal(h.accepted.length, 0);
  h.receive.call({ id: '2' }, { links: [pool[0]], grailDraftId: 10 });
  h.receive.call({ id: '2' }, { links: [pool[1]], grailDraftId: 10 });
  assert.equal(h.game.grailFreeDraftState.claims['2'], pool[0]);
  assert.equal(h.accepted.length, 1);
  delete h.game.grailFreeDraftState;
  h.receive.call({ id: '2' }, { links: [pool[1]], grailDraftId: 10 });
  assert.equal(h.accepted.length, 1, 'late selection cannot enter a battle decision');
  h.receive.call({ id: '2' }, { bool: false });
  assert.equal(h.accepted.length, 2, 'ordinary battle results still reach native engine');
});
for (const count of [4, 6, 8]) test(`${count} player free draft exposes the full roster and fills AI from unused families`, () => {
  const h = harness(count);
  assert.deepEqual(Array.from(h.game.grailFreeDraftState.pool), pool);
  assert.equal(pool.length, 68);
  h.receive.call({ id: '1' }, { links: [pool[0]], grailDraftId: 10 });
  h.players[1].unwait('ai');
  h.step(5);
  assert.equal(h.players[0].name1, pool[0]);
  assert.ok(h.players.every(p => pool.includes(p.name1)));
  assert.equal(uniqueCharacters(h.players.map(p => p.name1)), true);
  assert.equal(h.game.grailFreeDraftState, undefined);
});
test('claims exclude role forms and historical editions across both teams', () => {
  const draft = { seats: ['red', 'blue'], pool: ['moGong', 'moGongEX', 'san_moGong', 'shengNv'], claims: {} };
  assert.equal(claimCharacter(draft, 'red', 'moGongEX'), true);
  assert.equal(claimCharacter(draft, 'blue', 'moGong'), false);
  assert.equal(claimCharacter(draft, 'blue', 'san_moGong'), false);
  assert.equal(claimCharacter(draft, 'blue', 'shengNv'), true);
});
test('reconnecting during selection receives the current claims instead of a fresh draft', () => {
  const h = harness();
  h.receive.call({ id: '1' }, { links: [pool[0]], grailDraftId: 10 });
  h.game.grailDraftReconnected('2');
  assert.equal(h.sends.at(-1).args[1].claims['1'], pool[0]);
  assert.equal(h.sends.at(-1).args[1].id, 10);
});
test('native disconnect preserves a pending draft until its existing timeout, but battle still auto-resolves', async () => {
  const h = harness();
  const nativeClient = (await fs.readFile(new URL('../public/engine/noname/library/element/client.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\s*$/gm, '').replace('export class Client', 'class Client');
  const clientLib = { node: { clients: { remove() {} }, observing: { remove() {} } }, playerOL: { '2': h.players[1] } };
  h.players[1].setNickname = () => {};
  h.game.broadcast = () => {};
  const Client = vm.runInNewContext(nativeClient + '\nClient', { lib: clientLib, game: h.game, _status: {}, ui: {}, window: {}, get: {} });
  const connection = new Client({ wsid: '2' }, true);
  connection.close();
  assert.equal(h.accepted.length, 0, 'disconnect must retain the original native wait and timer');
  assert.equal(h.game.grailDraftPending('2'), true);
  h.game.grailDraftReconnected('2');
  h.receive.call({ id: '2' }, { links: [pool[1]], grailDraftId: 10 });
  assert.equal(h.game.grailFreeDraftState.claims['2'], pool[1]);
  delete h.game.grailFreeDraftState;
  connection.close();
  assert.equal(h.accepted.length, 2, 'ordinary battle disconnect still resolves through native AI');
});
