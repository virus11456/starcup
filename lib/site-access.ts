// Server-side only: imported by Proxy, route handlers and the access page.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "grail_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;
export const PRIVATE_CACHE = "private, no-store, max-age=0";

export function accessConfig() {
  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SESSION_SECRET;
  return password && secret && /^[a-f0-9]{64}$/.test(secret)
    ? { password, secret }
    : null;
}

type AccessConfig = NonNullable<ReturnType<typeof accessConfig>>;
const digest = (value: string) => createHash("sha256").update(value).digest();

export function correctPassword(value: string, config: AccessConfig) {
  return value.length > 0 && value.length <= 256 &&
    timingSafeEqual(digest(value), digest(config.password));
}

function signature(payload: string, config: AccessConfig) {
  // Changing either secret or password invalidates all previous sessions.
  return createHmac("sha256", Buffer.from(config.secret, "hex"))
    .update(digest(config.password)).update(payload).digest("hex");
}

export function createAccessToken(config: AccessConfig, now = Date.now()) {
  const expiry = Math.floor(now / 1000) + ACCESS_MAX_AGE;
  const payload = `v1.${expiry}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload, config)}`;
}

export function validAccessToken(token: string | undefined, config = accessConfig(), now = Date.now()) {
  if (!config || !token || !/^v1\.\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;
  const parts = token.split(".");
  const expiry = Number(parts[1]);
  const seconds = Math.floor(now / 1000);
  if (expiry <= seconds || expiry > seconds + ACCESS_MAX_AGE) return false;
  return timingSafeEqual(
    Buffer.from(parts[3], "hex"),
    Buffer.from(signature(parts.slice(0, 3).join("."), config), "hex"),
  );
}

export function safeAccessNext(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (!value.startsWith("/") || decoded.startsWith("//") || /[\\\x00-\x20]/.test(decoded)) return "/";
    const url = new URL(value, "https://site.invalid");
    if (url.origin !== "https://site.invalid" || /^\/(?:access|api\/access)(?:\/|$)/.test(url.pathname)) return "/";
    return url.pathname + url.search;
  } catch { return "/"; }
}

export function sameOriginPost(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const origin = request.headers.get("origin");
    return !!origin && new URL(origin).host === (request.headers.get("host") || new URL(request.url).host);
  } catch { return false; }
}
