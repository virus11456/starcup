import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { homeInvite, readLobby } from '../lib/lobby.ts';

const room = { code: 'ABCD2345', name: '朋友的牌局', host: '甲', count: 2, capacity: 4 };
const signal = () => new AbortController().signal;

test('blocked optional storage cleanup never prevents an invitation or lobby startup', () => {
  const removed: string[] = [];
  const storage = () => ({ removeItem(key: string) { removed.push(key); } });
  assert.equal(homeInvite('?room=ABCD2345', storage), '/online?room=ABCD2345');
  assert.deepEqual(removed, ['grail-room-v1'], 'do not clear current seats or user preferences');
  const blockedGetter = () => { throw new Error('SecurityError'); };
  const blockedWrite = () => ({ removeItem() { throw new Error('SecurityError'); } });
  for (const blocked of [blockedGetter, blockedWrite]) {
    assert.equal(homeInvite('?room=ABCD2345', blocked), '/online?room=ABCD2345');
    assert.equal(homeInvite('', blocked), null);
  }
  assert.equal(homeInvite('?room=ABCD2345%26extra%3Dvalue', storage), '/online?room=ABCD2345%26extra%3Dvalue');
});

test('lobby reads are abortable, uncached and return only public display fields', async () => {
  const s = signal();
  const result = await readLobby(s, async (url, options) => {
    assert.equal(url, '/api/full-room');
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.signal, s);
    assert.equal(options?.body, undefined);
    return Response.json({ configured: true, rooms: [{ ...room, extra: 'not-a-display-field' }] });
  });
  assert.deepEqual(result, [room]);
  assert.deepEqual(await readLobby(signal(), async () => Response.json({ configured: true, rooms: [] })), []);
});

test('quota, sign-in and unavailable services are errors, not empty successful lobbies', async () => {
  for (const [status, error] of [[503, '多人服務今日的免費資料庫額度已用完。'], [401, '請先輸入網站密碼。']] as const) {
    await assert.rejects(readLobby(signal(), async () => Response.json({ error }, { status })), { message: error });
  }
  await assert.rejects(readLobby(signal(), async () => Response.json({ configured: false, rooms: [] })), /多人服務尚未就緒/);
  await assert.rejects(readLobby(signal(), async () => new Response('<html>Service unavailable</html>', { status: 503 })), /房間清單暫時無法讀取/);
});

test('malformed summaries fail visibly instead of breaking search or rendering stale invitations', async () => {
  for (const data of [null, {}, { configured: true, rooms: null }, ...[
    null, { ...room, name: null }, { ...room, host: [] }, { ...room, code: '../bad' },
    { ...room, capacity: 5 }, { ...room, count: -1 }, { ...room, count: 7 }, { ...room, count: '2' },
  ].map(r => ({ configured: true, rooms: [r] }))]) {
    await assert.rejects(readLobby(signal(), async () => Response.json(data)), /房間清單格式有誤/);
  }
});

test('a response arriving after cancellation cannot restore a stale lobby', async () => {
  const controller = new AbortController();
  let deliver!: (response: Response) => void;
  const pending = readLobby(controller.signal, () => new Promise(resolve => { deliver = resolve; }));
  controller.abort(new Error('讀取逾時'));
  deliver(Response.json({ configured: true, rooms: [room] }));
  await assert.rejects(pending, /讀取逾時/);
});

// Render the actual lobby with React/Next Link. Only the unrelated install
// guide is stubbed because plain Node cannot import its CSS module.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/lobby.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const exports: { default?: ComponentType<Record<string, unknown>> } = {};
new Function('require', 'exports', compiled)((id: string) => id === './install-app' ? () => null : require(id), exports);
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(exports.default!, {
  rooms: [], connected: false, create() {}, join() {}, practice() {}, refresh() {}, ...props,
}));

test('loading UI cannot claim that no rooms exist or allow duplicate refresh clicks', () => {
  const html = render({ loading: true, rooms: [room], connected: true });
  assert.match(html, /正在讀取房間清單/);
  assert.match(html, /<button\b[^>]*disabled=""[^>]*>讀取中…<\/button>/);
  assert.doesNotMatch(html, /目前沒有公開房間|朋友的牌局|多人服務已就緒/);
  assert.match(html, /輸入邀請碼/);
});

test('unavailable UI clears stale rooms and offers retry, invitations and solo play', () => {
  const html = render({ rooms: [room], connected: false });
  assert.match(html, /暫時無法取得房間/);
  assert.match(html, /房間清單暫時無法顯示/);
  assert.doesNotMatch(html, /正在讀取|讀取中|目前沒有公開房間|朋友的牌局/);
  assert.match(html, /重新整理 ↻/);
  assert.match(html, /單人對電腦/);
  assert.match(html, /href="\/online"/);
});

test('ready UI distinguishes an empty lobby from available rooms', () => {
  assert.match(render({ connected: true }), /目前沒有公開房間/);
  const html = render({ connected: true, rooms: [room] });
  assert.match(html, /多人服務已就緒/);
  assert.match(html, /朋友的牌局/);
  assert.doesNotMatch(html, /目前沒有公開房間|暫時無法取得房間|正在讀取/);
});
