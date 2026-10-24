import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { choosePublicCommand } from "./qa-policy.mjs";

const base = new URL(process.env.GRAIL_TEST_URL || "http://127.0.0.1:3107");
const report = { scope: "core-mode-production-api", url: base.origin, startedAt: new Date().toISOString(), rooms: [], matches: [], errors: [] };
let saving = Promise.resolve();
function save() {
  if (!process.env.GRAIL_TEST_REPORT) return Promise.resolve();
  const contents = JSON.stringify(report, null, 2);
  saving = saving.then(() => writeFile(process.env.GRAIL_TEST_REPORT, contents));
  return saving;
}
async function request(client, body, code) {
  const response = await fetch(new URL(code ? `/api/game?room=${code}` : "/api/game", base), {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", Origin: base.origin, ...(client.cookie ? { Cookie: client.cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie) client.cookie = cookie.split(";")[0];
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || "request failed"}`);
  return data.room || data;
}
function verifyView(room) {
  assert.equal(room.players.reduce((n, p) => n + p.handCount + p.effects.length, room.deckCount + room.discardCount), 150, "150 physical cards conserved");
  assert.ok(room.players.filter(p => p.id !== room.me).every(p => p.hand.length === 0), "Opponent/ally hand remains hidden");
  assert.ok(room.players.every(p => !("auth" in p)) && !("deck" in room) && !("discard" in room), "Secrets and deck order remain hidden");
}
async function create(capacity) {
  const clients = Array.from({ length: capacity }, () => ({ cookie: "" }));
  let room = await request(clients[0], { type: "create", name: `QA房主${capacity}`, title: `QA十輪測試 ${capacity}人`, capacity, public: false });
  const code = room.code;
  for (let i = 1; i < capacity; i++) room = await request(clients[i], { type: "join", code, name: `QA玩家${i + 1}` });
  const views = await Promise.all(clients.map(c => request(c, undefined, code)));
  const seats = new Map(views.map((v, i) => [v.me, clients[i]]));
  report.rooms.push({ code, capacity });
  await save();
  console.log(`Prepared ${capacity}-player private room ${code}`);
  return { capacity, clients, seats, code };
}
async function series(group, matchNumbers) {
  const { clients, seats, code, capacity } = group;
  for (const number of matchNumbers) {
    const start = Date.now();
    let view = await request(clients[0], undefined, code);
    if (view.status === "finished") view = await request(clients[0], { type: "command", code, revision: view.revision, command: { type: "rematch" } });
    for (let i = 1; i < capacity; i++) view = await request(clients[i], { type: "command", code, revision: view.revision, command: { type: "ready", ready: true } });
    view = await request(clients[0], { type: "command", code, revision: view.revision, command: { type: "start" } });
    let commands = 0;
    const actions = {};
    while (view.status !== "finished") {
      assert.ok(commands < 1500, "Match must terminate within the action limit");
      const client = seats.get(view.actor);
      assert.ok(client, "Active player is a known session");
      if (view.me !== view.actor) view = await request(client, undefined, code);
      verifyView(view);
      const command = choosePublicCommand(view);
      const revision = view.revision;
      view = await request(client, { type: "command", code, revision, command });
      assert.equal(view.revision, revision + 1, "Each action commits once");
      verifyView(view);
      actions[command.type] = (actions[command.type] || 0) + 1;
      commands++;
      if (commands % 30 === 0) {
        const other = await request(clients.find(c => c !== client), undefined, code);
        verifyView(other);
        assert.deepEqual([other.revision, other.turn, other.pending, other.teams], [view.revision, view.turn, view.pending, view.teams], "Independent clients agree");
        console.log(`Match ${number}/10 (${capacity}p): ${commands} actions, game round ${view.round}`);
      }
    }
    const final = await Promise.all(clients.map(c => request(c, undefined, code)));
    for (const other of final) {
      verifyView(other);
      assert.equal(other.status, "finished");
      assert.equal(other.winner, view.winner);
      assert.equal(other.revision, view.revision);
    }
    assert.ok(view.teams[view.winner].grails >= 5 || view.teams[view.winner === "red" ? "blue" : "red"].morale === 0);
    report.matches.push({ number, capacity, code, commands, rounds: view.round, winner: view.winner, actions, durationSeconds: Math.round((Date.now() - start) / 1000), passed: true });
    await save();
    console.log(`PASS match ${number}/10: ${capacity} players, ${commands} commands, winner ${view.winner}`);
  }
}
const groups = [];
for (const capacity of [4, 6, 8]) groups.push(await create(capacity));
// Each independent room is sequential; three rooms exercise different instances.
const outcomes = await Promise.allSettled(groups.map((g, i) => series(g, [1, 4, 7, 10].map(n => n + i).filter(n => n <= 10))));
for (let i = 0; i < outcomes.length; i++) if (outcomes[i].status === "rejected") report.errors.push({ capacity: groups[i].capacity, message: String(outcomes[i].reason?.message || outcomes[i].reason) });
report.completedAt = new Date().toISOString();
report.matches.sort((a, b) => a.number - b.number);
await save();
assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
assert.equal(report.matches.length, 10, "Ten complete games must finish successfully");
console.log("PASS: 10 complete production API matches across 4/6/8 players.");
