// Protocol regression for the gate. Credentials are supplied by the caller;
// never print passwords, session cookies, response bodies or environment values.
import assert from "node:assert/strict";

const base = process.env.ACCESS_TEST_URL || "http://localhost:3100";
const password = process.env.ACCESS_TEST_PASSWORD;
if (!password) throw new Error("ACCESS_TEST_PASSWORD is required");
const results = [];
const request = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", ...options });
const check = (name, condition) => { assert.ok(condition, name); results.push(name); };
const post = (fields, extra = {}) => request("/api/access", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: base, ...extra },
  body: new URLSearchParams(fields),
});
for (const path of ["/", "/full", "/cards", "/qa-layout.html", "/engine/index.html", "/engine/grail-bridge.js", "/full-engine/catalog.json", "/_next/image?url=%2Ffavicon.svg&w=64&q=75"]) {
  const res = await request(path);
  check(`anonymous ${path.split("?")[0]} blocked`, res.status === 307 && new URL(res.headers.get("location")).pathname === "/access");
  check(`private cache ${path.split("?")[0]}`, /no-store/.test(res.headers.get("cache-control") || ""));
}
for (const method of ["GET", "POST"]) {
  const res = await request("/api/game", { method });
  check(`anonymous game ${method} blocked`, res.status === 401);
}
const forged = await request("/full", { headers: { Cookie: "grail_access=true", "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" } });
check("forged cookie and internal-looking header do not unlock", forged.status === 307);
const access = await request("/access");
const html = await access.text();
check("Traditional Chinese password page available", access.status === 200 && html.includes('name="password"') && html.includes("網站密碼"));
check("password absent from rendered page", !html.includes(password));
const cross = await post({ password }, { Origin: "https://unrelated.invalid", "Sec-Fetch-Site": "cross-site" });
check("cross-site login rejected", cross.status === 403 && !cross.headers.has("set-cookie"));
const wrong = await post({ password: "deliberately-wrong-test", next: "/full" });
check("wrong password denied without a cookie", wrong.status === 303 && new URL(wrong.headers.get("location")).searchParams.get("error") === "password" && !wrong.headers.has("set-cookie"));
const good = await post({ password, next: "/full" });
const setCookie = good.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0];
check("correct password returns to requested page", good.status === 303 && new URL(good.headers.get("location")).pathname === "/full");
check("session cookie is HttpOnly and SameSite=Lax", cookie.startsWith("grail_access=v1.") && /httponly/i.test(setCookie) && /samesite=lax/i.test(setCookie));
if (base.startsWith("https:")) check("HTTPS session cookie is Secure", /;\s*secure/i.test(setCookie));
for (const path of ["/full", "/engine/index.html", "/full-engine/catalog.json", "/api/game"]) {
  const res = await request(path, { headers: { Cookie: cookie } });
  check(`authenticated ${path} available`, res.status === 200);
  check(`authenticated ${path} not publicly cached`, /(?:private|no-store)/.test(res.headers.get("cache-control") || ""));
}
const outside = await post({ password, next: "//unrelated.invalid" });
check("external return URL is rejected", new URL(outside.headers.get("location")).origin === new URL(base).origin);
const lock = await post({ action: "lock" }, { Cookie: cookie });
check("lock clears access cookie", lock.status === 303 && /max-age=0/i.test(lock.headers.get("set-cookie") || ""));
const locked = await request("/full");
check("next visit without session is locked", locked.status === 307);
console.log(JSON.stringify({ checks: results.length, passed: results }, null, 2));
