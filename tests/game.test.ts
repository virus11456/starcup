import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRoom,
  joinRoom,
  applyCommand,
  actingPlayer,
  chooseBot,
  publicView,
  tick,
  makeDeck,
  type Room,
  type CardKind,
  GameError,
} from "../lib/game.ts";
function game(n = 4) {
  const r = createRoom("ABCDEFGH", "owner", "房主", "測試房", n, false);
  applyCommand(r, r.host, { type: "bots" });
  applyCommand(r, r.host, { type: "start" });
  return r;
}
function card(r: Room, index: number, kind: CardKind) {
  const p = r.players[index];
  let old = p.hand.find((c) => c.kind === kind);
  if (old) return old;
  const i = r.deck.findIndex((c) => c.kind === kind);
  assert.ok(i >= 0);
  const c = r.deck.splice(i, 1)[0];
  r.discard.push(...p.hand.splice(0, 1));
  p.hand.push(c);
  return c;
}
function total(r: Room) {
  return (
    r.deck.length +
    r.discard.length +
    r.players.reduce((n, p) => n + p.hand.length + p.effects.length, 0)
  );
}
test("bot shields an available opponent when every ally already has a shield", () => {
  for (const allShielded of [false, true]) {
    const r = game();
    const p = r.players[0];
    // Keep the fixture independent of the randomized initial deal: otherwise
    // other players can hold the shields needed to construct this state.
    for (const t of r.players) r.deck.push(...t.hand.splice(0));
    for (let i = r.deck.length - 1; i >= 0 && p.hand.length < 4; i--)
      if (r.deck[i].kind === "shield") p.hand.push(...r.deck.splice(i, 1));
    for (const t of r.players)
      if (allShielded || t.team === p.team) {
        const i = r.deck.findIndex((c) => c.kind === "shield");
        assert.ok(i >= 0);
        t.effects.push(...r.deck.splice(i, 1));
      }
    const command = chooseBot(r);
    assert.equal(command.type, allShielded ? "redraw" : "play");
    assert.doesNotThrow(() => applyCommand(r, p.id, command));
    assert.equal(total(r), 150);
  }
});
test("malformed discard payload is a rule error and does not mutate the room", () => {
  const r = game();
  r.players[0].hand.push(...r.deck.splice(0, 3));
  r.overflow = { player: r.host, resume: "next" };
  const snapshot = JSON.stringify(r);
  for (const cards of ["abc", { length: 1 }, 7]) {
    assert.throws(
      () =>
        applyCommand(r, r.host, {
          type: "discard",
          cards: cards as unknown as string[],
        }),
      GameError,
    );
    assert.equal(JSON.stringify(r), snapshot);
  }
});
test("4/6/8 players start with balanced teams and conserved 150-card deck", () => {
  for (const n of [4, 6, 8]) {
    const r = game(n);
    assert.equal(r.players.length, n);
    assert.equal(r.players.filter((p) => p.team === "red").length, n / 2);
    assert.ok(r.players.every((p) => p.hand.length === 4));
    assert.equal(r.teams.red.morale, n === 8 ? 18 : 15);
    assert.equal(total(r), 150);
  }
  assert.equal(makeDeck().length, 150);
});
test("only host starts, readiness and room capacity enforced", () => {
  const r = createRoom("ABCDEFGH", "a", "A", "", 4, false);
  const b = joinRoom(r, "b", "B");
  assert.throws(() => applyCommand(r, b.id, { type: "start" }));
  applyCommand(r, r.host, { type: "bots" });
  assert.throws(() => joinRoom(r, "c", "C"));
  assert.throws(() => applyCommand(r, r.host, { type: "start" }));
  applyCommand(r, b.id, { type: "ready", ready: true });
  applyCommand(r, r.host, { type: "start" });
  assert.equal(r.status, "playing");
  assert.throws(() => joinRoom(r, "c", "C"));
});
test("public payload contains only requesting player hand and no auth/deck/discard", () => {
  const r = game();
  const view = publicView(r, "owner");
  assert.equal(view.players[0].hand.length, 4);
  assert.ok(
    view.players
      .slice(1)
      .every((p) => p.hand.length === 0 && p.handCount === 4),
  );
  const json = JSON.stringify(view);
  assert.ok(!json.includes('"auth"'));
  assert.ok(!json.includes('"deck":'));
  assert.ok(!json.includes('"discard":'));
  assert.throws(() => publicView(r, "outsider"));
  assert.equal(view.me, r.host);
});
test("off-turn, friendly attack, foreign card and insufficient purchase rejected", () => {
  const r = game();
  const c = card(r, 0, "fire");
  assert.throws(() =>
    applyCommand(r, r.players[1].id, {
      type: "play",
      cardId: c.id,
      target: r.players[0].id,
    }),
  );
  assert.throws(() =>
    applyCommand(r, r.host, {
      type: "play",
      cardId: c.id,
      target: r.players[2].id,
    }),
  );
  assert.throws(() =>
    applyCommand(r, r.host, {
      type: "play",
      cardId: "invalid",
      target: r.players[1].id,
    }),
  );
  assert.throws(() => applyCommand(r, r.host, { type: "buy" }));
  assert.equal(total(r), 150);
});
test("damage draws cards, overflow is chosen privately and reduces morale", () => {
  const r = game();
  const c = card(r, 0, "fire");
  r.players[1].hand.push(...r.deck.splice(0, 2));
  applyCommand(r, r.host, {
    type: "play",
    cardId: c.id,
    target: r.players[1].id,
  });
  applyCommand(r, r.players[1].id, { type: "take" });
  assert.equal(r.players[1].hand.length, 8);
  assert.equal(r.teams.red.stones[0], "gem");
  assert.equal(r.overflow?.player, r.players[1].id);
  const ids = r.players[1].hand.slice(0, 2).map((c) => c.id);
  assert.throws(() =>
    applyCommand(r, r.players[1].id, {
      type: "discard",
      cards: [ids[0], ids[0]],
    }),
  );
  applyCommand(r, r.players[1].id, { type: "discard", cards: ids });
  assert.equal(r.teams.blue.morale, 13);
  assert.equal(r.turn, 1);
  assert.equal(total(r), 150);
});
test("counter changes target and awards crystal, dark cannot be countered", () => {
  const r = game();
  const fire = card(r, 0, "fire");
  const dark = card(r, 1, "dark");
  const defenderFire = card(r, 2, "fire");
  applyCommand(r, r.host, {
    type: "play",
    cardId: fire.id,
    target: r.players[1].id,
  });
  assert.throws(() =>
    applyCommand(r, r.players[1].id, {
      type: "counter",
      cardId: dark.id,
      target: r.host,
    }),
  );
  applyCommand(r, r.players[1].id, {
    type: "counter",
    cardId: dark.id,
    target: r.players[2].id,
  });
  assert.throws(() =>
    applyCommand(r, r.players[2].id, {
      type: "counter",
      cardId: defenderFire.id,
      target: r.players[3].id,
    }),
  );
  applyCommand(r, r.players[2].id, { type: "take" });
  assert.deepEqual(r.teams.blue.stones, ["crystal"]);
  assert.equal(total(r), 150);
});
test("holy light prevents damage and yields no stone", () => {
  const r = game();
  const fire = card(r, 0, "fire");
  const light = card(r, 1, "light");
  applyCommand(r, r.host, {
    type: "play",
    cardId: fire.id,
    target: r.players[1].id,
  });
  applyCommand(r, r.players[1].id, { type: "block", cardId: light.id });
  assert.equal(r.players[1].hand.length, 3);
  assert.equal(r.teams.red.stones.length, 0);
  assert.equal(r.turn, 1);
});
test("shield allows counter choice, but must be consumed instead of taking damage", () => {
  const r = game();
  const shield = card(r, 1, "shield");
  r.players[1].effects.push(
    ...r.players[1].hand.splice(r.players[1].hand.indexOf(shield), 1),
  );
  const fire = card(r, 0, "fire");
  applyCommand(r, r.host, {
    type: "play",
    cardId: fire.id,
    target: r.players[1].id,
  });
  assert.ok(r.pending);
  assert.equal(r.players[1].effects.length, 1);
  const count = r.players[1].hand.length;
  applyCommand(r, r.players[1].id, { type: "take" });
  assert.equal(r.players[1].hand.length, count);
  assert.equal(r.players[1].effects.length, 0);
  assert.equal(r.teams.red.stones.length, 0);
  assert.equal(total(r), 150);
});
test("missile transfers to next eligible enemy and adds damage without stones", () => {
  const r = game();
  const a = card(r, 0, "missile"),
    b = card(r, 1, "missile");
  applyCommand(r, r.host, { type: "play", cardId: a.id });
  assert.equal(r.pending?.to, r.players[1].id);
  applyCommand(r, r.players[1].id, { type: "counter", cardId: b.id });
  assert.equal(r.pending?.damage, 3);
  assert.equal(r.pending?.to, r.players[2].id);
  applyCommand(r, r.players[2].id, { type: "take" });
  assert.equal(r.players[2].hand.length, 7);
  assert.equal(r.teams.blue.stones.length, 0);
  assert.equal(total(r), 150);
});
test("weakness offers draw-or-skip; poison resolves before action", () => {
  const r = game();
  const weak = card(r, 0, "weak");
  applyCommand(r, r.host, {
    type: "play",
    cardId: weak.id,
    target: r.players[1].id,
  });
  assert.ok(r.weak);
  applyCommand(r, r.players[1].id, { type: "weakSkip" });
  assert.equal(r.turn, 2);
  const poison = card(r, 2, "poison");
  applyCommand(r, r.players[2].id, {
    type: "play",
    cardId: poison.id,
    target: r.players[3].id,
  });
  assert.equal(r.players[3].hand.length, 5);
  assert.equal(r.players[3].effects.length, 0);
  assert.equal(total(r), 150);
});
test("purchase caps stones at five; fifth grail ends match", () => {
  const r = game();
  r.discard.push(r.players[0].hand.pop()!);
  r.teams.red.stones = ["gem", "gem", "gem", "gem"];
  applyCommand(r, r.host, { type: "buy" });
  assert.equal(r.teams.red.stones.length, 5);
  r.turn = 0;
  r.pending = null;
  r.overflow = null;
  r.discard.push(...r.players[0].hand.splice(3));
  r.teams.red.grails = 4;
  applyCommand(r, r.host, { type: "synthesize" });
  assert.equal(r.status, "finished");
  assert.equal(r.winner, "red");
  assert.equal(r.teams.blue.morale, 14);
  assert.equal(total(r), 150);
});
test("zero morale immediately wins", () => {
  const r = game();
  r.teams.blue.morale = 1;
  r.players[1].hand.push(...r.deck.splice(0, 3));
  r.overflow = { player: r.players[1].id, resume: "next" };
  applyCommand(r, r.players[1].id, {
    type: "discard",
    cards: [r.players[1].hand[0].id],
  });
  assert.equal(r.status, "finished");
  assert.equal(r.winner, "red");
});
test("tick cannot skip ahead before deadline and performs only one legal action", () => {
  const r = game();
  const before = structuredClone(r);
  assert.equal(tick(r, r.deadline - 1), false);
  assert.deepEqual(r, before);
  assert.equal(tick(r, r.deadline + 1), true);
  assert.ok(r.logs.some((l) => l.text.includes("逾時")));
  assert.equal(total(r), 150);
});
test("100 complete AI matches preserve cards and finish across all player counts", () => {
  for (let n = 0; n < 100; n++) {
    const r = game([4, 6, 8][n % 3]);
    let moves = 0;
    while (r.status === "playing" && moves < 3000) {
      applyCommand(r, actingPlayer(r).id, chooseBot(r));
      assert.equal(total(r), 150);
      assert.ok(
        r.teams.red.stones.length <= 5 && r.teams.blue.stones.length <= 5,
      );
      moves++;
    }
    assert.equal(
      r.status,
      "finished",
      `match ${n} did not finish after ${moves} moves`,
    );
    assert.ok(r.winner);
  }
});
