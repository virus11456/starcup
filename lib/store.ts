import { createHash, randomBytes } from "node:crypto";
import { GameError, type Room } from "./game.ts";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function roomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (n) => letters[n % letters.length]).join(
    "",
  );
}
export function configured() {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.GRAIL_SERVER_SECRET
  );
}
type Stored = {
  code: string;
  revision: number;
  state: Room;
  summary: Record<string, unknown>;
  updated_at: string;
};
export async function roomRest<T = Stored>(
  query: string,
  method = "GET",
  body?: unknown,
): Promise<T[]> {
  if (!configured())
    throw Object.assign(
      new GameError("連線服務尚未完成設定，請先使用本機練習模式。"),
      { status: 503 },
    );
  let res: Response;
  try {
    res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/grail_rooms?${query}`,
      {
        method,
        cache: "no-store",
        headers: {
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
          "x-grail-key": process.env.GRAIL_SERVER_SECRET!,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw Object.assign(new GameError("遊戲資料庫暫時無法連線，請稍後再試。"), {
      status: 503,
    });
  }
  if (!res.ok) {
    if (res.status === 409)
      throw Object.assign(new GameError("房間代碼重複，請重試"), {
        status: 409,
      });
    throw Object.assign(new GameError("遊戲資料庫暫時無法連線，請稍後再試。"), {
      status: 503,
    });
  }
  return res.json();
}
const rest = roomRest;
export function summary(r: Room) {
  return {
    code: r.code,
    name: r.name,
    capacity: r.capacity,
    count: r.players.length,
    status: r.status,
    public: r.public,
    host: r.players.find((p) => p.id === r.host)?.name || "",
    created: r.created,
  };
}
export async function listRooms() {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const rows = await rest(
    `select=summary&summary->>public=eq.true&summary->>status=eq.waiting&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc&limit=60`,
  );
  return rows
    .map((r) => r.summary)
    .filter((r) => r.public && r.status === "waiting" && Number(r.count) > 0);
}
export async function getRoom(code: string) {
  if (!/^[A-Z2-9]{8}$/.test(code)) throw new GameError("邀請碼為 8 位英數字");
  const rows = await rest(
    `code=eq.${code}&select=code,revision,state,updated_at`,
  );
  const row = rows[0];
  if (row && (row.state as unknown as { engine?: string }).engine)
    throw new GameError("請從完整角色對戰入口加入此房間。");
  if (!row || Date.now() - Date.parse(row.updated_at) > 24 * 3600000)
    throw Object.assign(
      new GameError("找不到房間，或房間已超過 24 小時未活動。"),
      { status: 404 },
    );
  return row.state;
}
export async function insertRoom(r: Room, creator: string) {
  const since = new Date(Date.now() - 3600000).toISOString();
  const rows = await rest(
    `select=code&creator_hash=eq.${creator}&created_at=gte.${encodeURIComponent(since)}&limit=6`,
  );
  if (rows.length >= 5)
    throw Object.assign(
      new GameError("每小時最多建立 5 個房間，請沿用現有房間。"),
      { status: 429 },
    );
  await rest("", "POST", {
    code: r.code,
    revision: r.revision,
    state: r,
    summary: summary(r),
    creator_hash: creator,
  });
}
export async function saveRoom(r: Room, previousRevision: number) {
  r.revision = previousRevision + 1;
  r.updated = Date.now();
  const rows = await rest(
    `code=eq.${r.code}&revision=eq.${previousRevision}`,
    "PATCH",
    {
      revision: r.revision,
      state: r,
      summary: summary(r),
      updated_at: new Date().toISOString(),
    },
  );
  if (!rows.length)
    throw Object.assign(
      new GameError("房間有新動作，已為你重新同步，請再操作一次。"),
      { status: 409 },
    );
}
