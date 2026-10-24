// Integration check for the core-mode HTTP API against a real database.
// Creates one private room. Prints its code so the owner can remove test data.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const base = new URL(process.env.GRAIL_TEST_URL || "http://127.0.0.1:3107");
if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid test URL");
const clients = Array.from({ length: 5 }, () => ({ cookie: "" }));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
async function request(client, body, code, headers = {}) {
  const response = await fetch(new URL(code ? `/api/game?room=${code}` : "/api/game", base), {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Origin: base.origin,
      ...(client.cookie ? { Cookie: client.cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie) client.cookie = cookie.split(";")[0];
  return { status: response.status, data: await response.json() };
}
const lobby = await request(clients[0]);
check(lobby.status === 200 && lobby.data.configured, "Database-backed API must be configured");
const made = await request(clients[0], {
  type: "create", name: "整合測試房主", title: "API 私密整合測試", capacity: 4, public: false,
});
check(made.status === 200, `Room creation: ${made.data.error || made.status}`);
const code = made.data.room.code;
console.log(`Created private integration room: ${code}`);
const report = { scope: "core-mode", url: base.origin, roomCode: code, createdAt: new Date().toISOString() };
if (process.env.GRAIL_TEST_REPORT) await writeFile(process.env.GRAIL_TEST_REPORT, JSON.stringify(report, null, 2));

const outsider = await request(clients[4], undefined, code);
check(outsider.status >= 400 && !outsider.data.room, "Outsider must not read room state");
const listed = await request(clients[4]);
check(!listed.data.rooms.some(r => r.code === code), "Private room must not appear in lobby");
for (let i = 1; i < 4; i++) {
  const joined = await request(clients[i], { type: "join", code, name: `測試玩家${i + 1}` });
  check(joined.status === 200 && joined.data.room.players.length === i + 1, "Independent player joins");
}
const full = await request(clients[4], { type: "join", code, name: "超額玩家" });
check(full.status === 400, "Full room rejects a fifth player");
let view = (await request(clients[0], undefined, code)).data.room;
const revision = view.revision;
const races = await Promise.all([1, 2].map(i => request(clients[i], {
  type: "command", code, revision, command: { type: "ready", ready: true },
})));
check(races.filter(r => r.status === 200).length === 1 && races.filter(r => r.status === 409).length === 1,
  "Concurrent commands must commit once and return a conflict for the stale revision");
for (let i = 1; i < 4; i++) {
  view = (await request(clients[i], undefined, code)).data.room;
  const ready = await request(clients[i], { type: "command", code, revision: view.revision,
    command: { type: "ready", ready: true } });
  check(ready.status === 200, "Ready after refreshing current revision");
}
view = (await request(clients[0], undefined, code)).data.room;
const started = await request(clients[0], { type: "command", code, revision: view.revision, command: { type: "start" } });
check(started.status === 200 && started.data.room.status === "playing", "Four human seats can start a match");
const views = await Promise.all(clients.slice(0, 4).map(c => request(c, undefined, code)));
check(new Set(views.map(r => r.data.room.me)).size === 4, "Cookies identify four separate seats");
for (const { data: { room } } of views) {
  check(room.players.find(p => p.id === room.me).hand.length === 4, "Each player can see own hand");
  check(room.players.filter(p => p.id !== room.me).every(p => p.hand.length === 0 && p.handCount === 4),
    "No other player's hand is disclosed");
  check(!("deck" in room) && !("discard" in room) && room.players.every(p => !("auth" in p)),
    "Deck order and session hashes stay server-side");
}
view = views[0].data.room;
const foreignId = views[1].data.room.players.find(p => p.id === views[1].data.room.me).hand[0].id;
const forged = await request(clients[0], { type: "command", code, revision: view.revision,
  command: { type: "play", cardId: foreignId, target: views[1].data.room.me } });
check(forged.status === 400, "Cannot play a card from another player's hand");
const cross = await request(clients[0], { type: "command", code, revision: view.revision,
  command: { type: "chat", text: "must not be committed" } }, undefined, { Origin: "https://unrelated.example" });
check(cross.status === 403, "Cross-site mutations are rejected");
const refreshed = await request({ cookie: clients[0].cookie }, undefined, code);
check(refreshed.data.room.me === view.me && refreshed.data.room.revision === view.revision,
  "Existing session restores the seat and rejected commands do not mutate state");

// Execute legal actions through the public API, including response/discard
// windows. Never inject a state or read the hidden database hand/deck.
const seats = new Map(views.map((r, i) => [r.data.room.me, clients[i]]));
const acted = new Set();
let current = refreshed.data.room;
for (let step = 0; step < 8; step++) {
  const client = seats.get(current.actor);
  check(!!client, "The active seat belongs to one of the four connected players");
  current = (await request(client, undefined, code)).data.room;
  const option = current.actions.find(a => a.enabled && a.type === "play") || current.actions.find(a => a.enabled);
  check(!!option, "The active player receives a legal action or response");
  const command = { type: option.type, cardId: option.cardId, target: option.targets[0] };
  if (option.type === "discard") command.cards = current.players.find(p => p.id === current.me).hand.slice(0, option.count).map(c => c.id);
  acted.add(current.me);
  const before = current.revision;
  const done = await request(client, { type: "command", code, revision: before, command });
  check(done.status === 200 && done.data.room.revision === before + 1, "Legal action commits one new revision");
  const synced = await Promise.all(clients.slice(0, 4).map(c => request(c, undefined, code)));
  check(synced.every(r => r.status === 200 && r.data.room.revision === before + 1), "All four clients observe the committed action");
  const publicState = r => JSON.stringify([r.turn, r.actor, r.pending, r.overflow, r.teams]);
  check(new Set(synced.map(r => publicState(r.data.room))).size === 1, "Turn, response and team state stay synchronized");
  check(synced.every(r => r.data.room.players.filter(p => p.id !== r.data.room.me).every(p => p.hand.length === 0)), "Hand privacy survives game actions");
  current = synced[0].data.room;
}
check(acted.size > 1, "Play advances between independently authenticated players");

// Read the known, nonempty test room using only the publishable key.
if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
  const direct = await fetch(`${process.env.SUPABASE_URL}/rest/v1/grail_rooms?code=eq.${code}&select=code`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000),
  });
  check(direct.ok && (await direct.json()).length === 0, "RLS hides the stored room without the backend secret");
}
Object.assign(report, { passed: checks, completedAt: new Date().toISOString() });
if (process.env.GRAIL_TEST_REPORT) await writeFile(process.env.GRAIL_TEST_REPORT, JSON.stringify(report, null, 2));
console.log(`PASS: ${checks} integration assertions (core mode; four independent sessions).`);
