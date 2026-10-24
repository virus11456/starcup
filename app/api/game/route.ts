import { NextResponse, type NextRequest } from "next/server";
import {
  applyCommand,
  createRoom,
  joinRoom,
  publicView,
  tick,
  GameError,
} from "@/lib/game";
import {
  hash,
  newToken,
  roomCode,
  configured,
  listRooms,
  getRoom,
  insertRoom,
  saveRoom,
} from "@/lib/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function session(req: NextRequest) {
  const token = req.cookies.get("grail_session")?.value;
  const raw = token && /^[a-f0-9]{64}$/.test(token) ? token : newToken();
  return { raw, auth: hash(raw) };
}
function reply(data: unknown, token: string, status = 200) {
  const res = NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("grail_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
function fail(error: unknown, token: string) {
  if (error instanceof GameError)
    return reply({ error: error.message }, token, error.status);
  console.error(
    "Game request failed:",
    error instanceof Error ? error.name : "unknown",
  );
  return reply({ error: "操作未完成，請重試。" }, token, 500);
}
export async function GET(req: NextRequest) {
  const s = session(req);
  try {
    const code = req.nextUrl.searchParams.get("room");
    if (code) {
      const r = await getRoom(code);
      return reply({ room: publicView(r, s.auth) }, s.raw);
    }
    return reply(
      {
        rooms: configured() ? await listRooms() : [],
        configured: configured(),
      },
      s.raw,
    );
  } catch (e) {
    return fail(e, s.raw);
  }
}
export async function POST(req: NextRequest) {
  const s = session(req);
  try {
    const origin = req.headers.get("origin");
    if (
      req.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== req.headers.get("host"))
    )
      throw Object.assign(new GameError("無法接受跨網站操作"), { status: 403 });
    const text = await req.text();
    if (text.length > 4096) throw new GameError("請求過大");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new GameError("無效的請求格式");
    }
    if (!body || typeof body !== "object") throw new GameError("無效的請求");
    if (body.type === "create") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 16
      )
        throw new GameError("請輸入 1–16 字的暱稱");
      if (body.title !== undefined && typeof body.title !== "string")
        throw new GameError("房間名稱無效");
      const r = createRoom(
        roomCode(),
        s.auth,
        body.name,
        body.title || "",
        Number(body.capacity),
        body.public === true,
      );
      await insertRoom(
        r,
        hash(
          (req.headers.get("x-forwarded-for")?.split(",")[0] || s.auth) +
            process.env.GRAIL_SERVER_SECRET,
        ),
      );
      return reply({ room: publicView(r, s.auth) }, s.raw);
    }
    if (typeof body.code !== "string") throw new GameError("缺少房間代碼");
    const r = await getRoom(body.code.toUpperCase());
    const rev = r.revision;
    if (body.type === "join") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 16
      )
        throw new GameError("請輸入 1–16 字的暱稱");
      const existing = r.players.find((p) => p.auth === s.auth);
      if (!existing) {
        joinRoom(r, s.auth, body.name);
        await saveRoom(r, rev);
      }
      return reply({ room: publicView(r, s.auth) }, s.raw);
    }
    const p = r.players.find((p) => p.auth === s.auth);
    if (!p)
      throw Object.assign(new GameError("你不在這個房間內"), { status: 403 });
    if (body.type === "tick") {
      if (tick(r)) await saveRoom(r, rev);
      return reply({ room: publicView(r, s.auth) }, s.raw);
    }
    if (body.revision !== rev)
      throw Object.assign(new GameError("牌局已更新，請再操作一次。"), {
        status: 409,
      });
    if (!body.command || typeof body.command.type !== "string")
      throw new GameError("缺少行動");
    applyCommand(r, p.id, body.command);
    await saveRoom(r, rev);
    return reply(
      body.command.type === "leave"
        ? { left: true }
        : { room: publicView(r, s.auth) },
      s.raw,
    );
  } catch (e) {
    return fail(e, s.raw);
  }
}
