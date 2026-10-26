import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the pinned engine methods themselves, rather than a replacement
// serializer. The fixture supplies DOM/card boundaries, not a simulated game.
async function method(file, name, parent) {
  const source = await fs.readFile(new URL('../public/engine/' + file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let found;
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name.getText(ast) === name &&
      (!parent || node.parent.parent.name?.getText(ast) === parent)) {
      assert.equal(found, undefined, 'method selector must be unambiguous');
      found = 'function ' + node.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(found, `${file}: ${name}`); return found;
}
const [initSource, arenaSource, playerSource] = await Promise.all([
  method('noname/library/index.js', 'init', 'server'),
  method('noname/get/index.js', 'arenaState'),
  method('noname/library/element/player.js', 'getState'),
]);

for (const capacity of [4, 6, 8]) test(`native ${capacity}-seat guest rejoin keeps the same roles, hands, resources and host event`, () => {
  const roles = ['yongZhe', 'shengNv', 'moJian', 'moFaShaoNv', 'fengYinShi', 'geDouJia', 'tianShi', 'shenGuan'];
  const getState = vm.runInNewContext('(' + playerSource + ')');
  const players = Array.from({ length: capacity }, (_, i) => ({
    playerid: String(i + 1), name: roles[i], name1: roles[i], nickname: `玩家${i + 1}`,
    hp: 4, maxHp: 4, zhiLiao: i % 3, side: i % 2 === 0, phaseNumber: 3, seatNum: i + 1,
    dataset: { position: String(i) }, node: { identity: { innerHTML: '隊伍', dataset: { color: 'red' } } },
    hand: Array.from({ length: 4 }, (_, n) => ({ cardid: `${i}-${n}`, name: 'moDan', gaintag: [] })),
    getCards(zone) { return zone === 'hs' ? this.hand : []; }, getState,
    isDisabledJudge: () => false, isDead: () => false, isLinked: () => false,
    isTurnedOver: () => false, isOut: () => false, isUnseen: () => false, setNickname() {},
  }));
  const guest = players[1], oldSocket = { id: '2', closed: true };
  guest.ws = oldSocket; guest.isAuto = true;
  const event = { name: 'phase', player: players[2], next: [{ name: 'chooseToUse' }] };
  const game = {
    players, phaseNumber: 37, roomId: 'ABCDEFGH', ip: 'local-room',
    shiQiMax: capacity === 8 ? 18 : 15, xingBeiMax: 5, zhanJiMax: 5,
    hongShiQi: 11, lanShiQi: 9, hongXingBei: 2, lanXingBei: 3,
    hongZhanJi: ['baoShi', 'shuiJing'], lanZhanJi: ['baoShi'], moDanFangXiang: true,
    getState: () => ({ pendingModeState: 'unchanged' }), broadcast(callback, player) { callback(player); },
  };
  const lib = {
    config: {}, configOL: { mode: 'xingBei', number: capacity },
    node: { banned: [], clients: [] }, playerOL: Object.fromEntries(players.map(p => [p.playerid, p])),
    inpile: ['moDan', 'huoQiu'], inpile_nature: [],
  };
  const status = { event, currentPhase: players[2], mode: `${capacity / 2}v${capacity / 2}`,
    dying: [], onreconnect: [() => {}, 'retained'], cardtag: {}, postReconnect: {} };
  const context = vm.createContext({ game, lib, _status: status, get: {},
    ui: { arena: { dataset: { number: String(capacity) } } }, window: {} });
  context.get.arenaState = vm.runInContext('(' + arenaSource + ')', context);
  const init = vm.runInContext('(' + initSource + ')', context);
  const sent = [], socket = { id: 'temporary-id', send: (...args) => sent.push(args) };
  init.call(socket, 'same-engine', { id: '2', onlineKey: 'same-player' }, 'local-test');
  assert.equal(sent.length, 1); const [kind, config, state, modeState, ip, observe, reconnect] = sent[0];
  assert.equal(kind, 'reinit'); assert.equal(config, lib.configOL); assert.equal(ip, game.ip);
  assert.equal(observe, null); assert.equal(socket.id, '2'); assert.equal(guest.ws, socket);
  assert.equal(guest.isAuto, false, 'return control to the existing authenticated player');
  assert.equal(game.players.length, capacity); assert.equal(lib.playerOL['2'], guest);
  assert.equal(status.event, event); assert.equal(status.currentPhase, players[2]);
  assert.equal(reconnect, status.onreconnect); assert.equal(modeState.pendingModeState, 'unchanged');
  assert.equal(state.grailTurn, 37); assert.equal(state.grailCurrentPhase, '3');
  assert.deepEqual(Array.from(state.grailLimits), [game.shiQiMax, 5, 5]);
  for (const key of ['hongShiQi', 'lanShiQi', 'hongXingBei', 'lanXingBei', 'hongZhanJi', 'lanZhanJi']) {
    assert.equal(state[key], game[key]);
  }
  assert.equal(Object.keys(state.players).length, capacity);
  for (const player of players) {
    const saved = state.players[player.playerid];
    assert.equal(saved.name1, player.name1); assert.equal(saved.side, player.side);
    assert.equal(saved.seatNum, player.seatNum); assert.equal(saved.handcards, player.hand);
    assert.equal(saved.zhiLiao, player.zhiLiao);
  }
});
