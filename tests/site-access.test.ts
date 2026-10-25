import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_MAX_AGE, accessConfig, correctPassword, createAccessToken,
  safeAccessNext, sameOriginPost, validAccessToken,
} from "../lib/site-access.ts";

const config = { password: "test-password-only", secret: "ab".repeat(32) };
const now = 1_792_000_000_000;

test("password requires an exact, bounded match", () => {
  assert.ok(correctPassword(config.password, config));
  for (const value of ["", "wrong", config.password + " ", config.password.toUpperCase(), "x".repeat(257)]) {
    assert.equal(correctPassword(value, config), false);
  }
});
test("signed access session lasts seven days and expires at the boundary", () => {
  const token = createAccessToken(config, now);
  assert.ok(validAccessToken(token, config, now));
  assert.ok(validAccessToken(token, config, now + ACCESS_MAX_AGE * 1000 - 1));
  assert.equal(validAccessToken(token, config, now + ACCESS_MAX_AGE * 1000), false);
  assert.notEqual(token, createAccessToken(config, now));
  assert.equal(token.includes(config.password), false);
});
test("forged, malformed and implausibly future tokens never unlock", () => {
  const token = createAccessToken(config, now);
  for (const invalid of [undefined, "true", "", token + ".extra", token.slice(0, -2) + "xx", token.replace("v1.", "v2."), token.replace(/\.[a-f0-9]{64}$/, "." + "0".repeat(64)), createAccessToken(config, now + 60000)]) {
    assert.equal(validAccessToken(invalid, config, now), false);
  }
});
test("password or signing-key rotation invalidates prior sessions", () => {
  const token = createAccessToken(config, now);
  assert.equal(validAccessToken(token, { ...config, password: "changed" }, now), false);
  assert.equal(validAccessToken(token, { ...config, secret: "cd".repeat(32) }, now), false);
  assert.equal(validAccessToken(token, null, now), false);
});
test("missing or malformed environment configuration fails closed", () => {
  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SESSION_SECRET;
  try {
    delete process.env.SITE_ACCESS_PASSWORD;
    delete process.env.SITE_ACCESS_SESSION_SECRET;
    assert.equal(accessConfig(), null);
    process.env.SITE_ACCESS_PASSWORD = "test-only";
    process.env.SITE_ACCESS_SESSION_SECRET = "short";
    assert.equal(accessConfig(), null);
  } finally {
    if (password === undefined) delete process.env.SITE_ACCESS_PASSWORD; else process.env.SITE_ACCESS_PASSWORD = password;
    if (secret === undefined) delete process.env.SITE_ACCESS_SESSION_SECRET; else process.env.SITE_ACCESS_SESSION_SECRET = secret;
  }
});
test("return URLs preserve local destinations and reject external redirects", () => {
  assert.equal(safeAccessNext("/full?players=4"), "/full?players=4");
  for (const url of [null, ["/full"], "https://evil.test", "//evil.test", "/\\evil.test", "/%2Fevil.test", "/%5Cevil.test", "/%0aevil.test", "/access", "/api/access?x=1", "/%", "/" + "x".repeat(2049)]) {
    assert.equal(safeAccessNext(url), "/");
  }
});
test("login and lock require a same-origin form submission", () => {
  const req = (headers: Record<string, string>) => new Request("https://site.test/api/access", { method: "POST", headers });
  assert.ok(sameOriginPost(req({ origin: "https://site.test", host: "site.test" })));
  assert.equal(sameOriginPost(req({})), false);
  assert.equal(sameOriginPost(req({ origin: "null" })), false);
  assert.equal(sameOriginPost(req({ origin: "https://evil.test" })), false);
  assert.equal(sameOriginPost(req({ origin: "https://site.test", "sec-fetch-site": "cross-site" })), false);
});
