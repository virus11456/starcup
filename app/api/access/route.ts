import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE, ACCESS_MAX_AGE, PRIVATE_CACHE, accessConfig,
  correctPassword, createAccessToken, safeAccessNext, sameOriginPost,
} from "@/lib/site-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per-instance throttling; authentication never depends on this map.
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60 * 1000;
function throttled(key: string) {
  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
  const entry = attempts.get(key);
  if (entry) return ++entry.count > 10;
  if (attempts.size >= 2048) return true;
  attempts.set(key, { count: 1, until: now + WINDOW });
  return false;
}
function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303, headers: { "Cache-Control": PRIVATE_CACHE },
  });
}
function problem(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": PRIVATE_CACHE } });
}

export async function POST(request: NextRequest) {
  if (!sameOriginPost(request)) return problem("無法接受跨網站操作。", 403);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return problem("無效的請求格式。", 415);
  }
  // Bound the body even when Content-Length is absent or forged.
  const reader = request.body?.getReader();
  if (!reader) return problem("請輸入網站密碼。", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return problem("請求過大。", 413); }
      chunks.push(value);
    }
  } catch { return problem("無效的請求格式。", 400); }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  if (form.get("action") === "lock") {
    const response = redirect(request, "/access");
    response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    return response;
  }
  const config = accessConfig();
  if (!config) return problem("網站入口暫時無法使用，請稍後再試。", 503);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const next = safeAccessNext(form.get("next"));
  const failure = new URL("/access", request.url);
  failure.searchParams.set("next", next);
  if (throttled(key)) {
    failure.searchParams.set("error", "rate");
    return redirect(request, failure.pathname + failure.search);
  }
  if (!correctPassword(form.get("password") || "", config)) {
    failure.searchParams.set("error", "password");
    return redirect(request, failure.pathname + failure.search);
  }
  attempts.delete(key);
  const response = redirect(request, next);
  response.cookies.set(ACCESS_COOKIE, createAccessToken(config), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ACCESS_MAX_AGE, path: "/",
  });
  return response;
}
