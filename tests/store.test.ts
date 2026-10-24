import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getRoom, listRooms, saveRoom } from "../lib/store.ts";
import { createRoom, GameError } from "../lib/game.ts";

function configure(t: TestContext) {
  for (const [key, value] of Object.entries({
    SUPABASE_URL: "https://database.invalid",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    GRAIL_SERVER_SECRET: "test-backend-secret",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test("database connection failure returns retryable 503 without leaking transport details", async t => {
  configure(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("socket: test-backend-secret"); });
  await assert.rejects(getRoom("ABCDEFGH"), (e: unknown) =>
    e instanceof GameError && e.status === 503 && !e.message.includes("test-backend-secret"));
});

test("lobby filtering happens before the database limit, so private rooms do not hide public rooms", async t => {
  configure(t);
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const query = new URL(input).searchParams;
    assert.equal(query.get("summary->>public"), "eq.true");
    assert.equal(query.get("summary->>status"), "eq.waiting");
    assert.equal(query.get("limit"), "60");
    return Response.json([{ summary: { code: "ABCDEFGH", public: true, status: "waiting", count: 1 } }]);
  });
  assert.equal((await listRooms())[0].code, "ABCDEFGH");
});

test("a database revision conflict never overwrites a newer room", async t => {
  configure(t);
  t.mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    assert.equal(new URL(input).searchParams.get("revision"), "eq.4");
    assert.equal(options.method, "PATCH");
    assert.equal(JSON.parse(String(options.body)).revision, 5);
    return Response.json([]);
  });
  const room = createRoom("ABCDEFGH", "owner", "Owner", "Test", 4, false);
  await assert.rejects(saveRoom(room, 4), (e: unknown) => e instanceof GameError && e.status === 409);
});
