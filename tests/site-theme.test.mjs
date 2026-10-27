import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = async name => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('home, knowledge, solo and online setup share one continuous dark homepage backdrop', async () => {
  const global = await file('app/globals.css');
  const portal = await file('app/portal.css');
  const full = await file('app/full/full.css');
  const access = await file('app/access/access.module.css');
  assert.match(global, /--site-backdrop:\s*radial-gradient/);
  assert.match(global, /--site-content-width:\s*1440px/);
  assert.match(portal, /\.portal-mode,\s*\.knowledge-shell\s*\{[\s\S]*?background:\s*var\(--site-backdrop\)/);
  assert.match(full, /\.full-shell:not\(\.full-running\)\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?background:\s*var\(--site-backdrop\)/);
  assert.match(access, /\.page\s*\{[\s\S]*?background:\s*var\(--site-backdrop\)/);
});

test('solo and multiplayer setup use the homepage navigation; matches retain their own safe leave controls', async () => {
  const solo = await file('app/full/page.tsx');
  const online = await file('app/online/page.tsx');
  assert.match(solo, /running \?\s*\([\s\S]*?className="full-header"[\s\S]*?\)\s*:\s*<SiteHeader \/>/);
  assert.match(online, /room \?\s*<header className="full-header">[\s\S]*?<\/header>\s*:\s*<SiteHeader \/>/);
  assert.match(solo, /onClick=\{leave\}/);
  assert.match(online, /void leave\(\)/);
});

test('native match frame and turn decisions remain separate from public site styling', async () => {
  const full = await file('app/full/full.css');
  const solo = await file('app/full/page.tsx');
  const engine = await file('vendor/noname/overrides/grail-response-labels.js');
  assert.match(full, /\.full-running\s*\{[\s\S]*?position:\s*fixed;/);
  assert.match(solo, /<iframe[\s\S]*?src=\{launch\}[\s\S]*?className="full-frame"/);
  assert.match(engine, /button\.link === 'cancel'/);
  assert.match(engine, /const label = acceptsDamage \? '承受傷害'/);
});
