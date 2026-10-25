import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import manifest from '../app/manifest.ts';
import * as access from '../lib/site-access.ts';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
// Execute the real proxy with Next's Request/Response classes. Transpile only
// to accommodate the extensionless Next import in Node's strip-types runner.
const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports: { proxy?: (request: Request) => Response } = {};
new Function('require', 'exports', compiled)((id: string) => id === './lib/site-access' ? access : require(id), exports);
const proxy = exports.proxy!;
const request = (path: string, method = 'GET', cookie = '') => proxy(new NextRequest('https://starcup.test' + path, { method, headers: { cookie } }));
const install = manifest();
const publicPaths = ['/manifest.webmanifest', '/favicon.svg', '/app-icons/apple-touch-icon.png', ...install.icons!.map(icon => icon.src)];

test('installation opens a stable lobby identity and ships valid sized PNG icons', () => {
  assert.equal(install.id, '/');
  assert.equal(install.start_url, '/');
  assert.equal(install.scope, '/');
  assert.equal(install.display, 'standalone');
  assert.equal(install.lang, 'zh-Hant');
  assert.ok(install.icons!.some(icon => icon.purpose === 'maskable'));
  const icons = [...install.icons!, { src: '/app-icons/apple-touch-icon.png', sizes: '180x180' }];
  for (const icon of icons) {
    assert.equal(new URL(icon.src, 'https://starcup.test').search, '');
    const png = readFileSync(new URL('../public' + icon.src, import.meta.url));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
    assert.ok(png.length < 100_000, 'Small install icons, not a bundled engine download');
  }
});

test('install metadata and exact icon URLs are readable without an access cookie', () => {
  for (const path of publicPaths) for (const method of ['GET', 'HEAD']) {
    const response = request(path, method);
    assert.equal(response.headers.get('x-middleware-next'), '1', method + ' ' + path);
    assert.equal(response.headers.get('location'), null);
  }
});

test('installation exceptions do not expose protected pages, files, APIs or writes', () => {
  for (const path of ['/engine/index.html', '/engine/grail-config.js', '/engine/catalog.json',
    '/app-icons/private.json', '/app-icons/icon-192.png/extra', '/manifest.webmanifest/extra',
    '/online?room=ABCD2345', '/full', '/_next/image?url=%2Fengine%2Fimage%2Fcard.jpg&w=64&q=75']) {
    const response = request(path);
    assert.equal(response.status, 307, path);
    const target = new URL(response.headers.get('location')!);
    assert.equal(target.pathname, '/access');
    assert.equal(target.searchParams.get('next'), path);
    assert.match(response.headers.get('cache-control')!, /no-store/);
  }
  for (const path of ['/api/full-room', '/api/full-room/socket', '/api/game']) {
    assert.equal(request(path).status, 401);
  }
  for (const path of publicPaths) assert.equal(request(path, 'POST').status, 401);
});

test('an installed app still uses the signed site session for private content', () => {
  const previous = { password: process.env.SITE_ACCESS_PASSWORD, secret: process.env.SITE_ACCESS_SESSION_SECRET };
  const config = { password: 'local-pwa-test-only', secret: 'ab'.repeat(32) };
  process.env.SITE_ACCESS_PASSWORD = config.password;
  process.env.SITE_ACCESS_SESSION_SECRET = config.secret;
  try {
    const cookie = `${access.ACCESS_COOKIE}=${access.createAccessToken(config)}`;
    for (const path of ['/', '/online?room=ABCD2345', '/engine/index.html', '/api/full-room']) {
      const response = request(path, 'GET', cookie);
      assert.equal(response.headers.get('x-middleware-next'), '1', path);
      assert.match(response.headers.get('cache-control')!, /private, no-store/);
    }
    assert.equal(request('/full', 'GET', cookie + 'bad').status, 307);
  } finally {
    if (previous.password === undefined) delete process.env.SITE_ACCESS_PASSWORD; else process.env.SITE_ACCESS_PASSWORD = previous.password;
    if (previous.secret === undefined) delete process.env.SITE_ACCESS_SESSION_SECRET; else process.env.SITE_ACCESS_SESSION_SECRET = previous.secret;
  }
});
