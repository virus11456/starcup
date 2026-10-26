import vm from 'node:vm';
import fs from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createRelayLifecycle } from '../../vendor/noname/overrides/grail-relay-lifecycle.js';

const socketSource = (await fs.readFile(new URL('../../vendor/noname/overrides/grail-relay-socket.js', import.meta.url), 'utf8'))
  .replace('export function', 'function');
const onlineSource = (await fs.readFile(new URL('../../vendor/noname/overrides/grail-online.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '').replace('export async function', 'async function');

export async function settle() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function clock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    timers,
    now: () => now,
    jump(ms) { now += ms; },
    setTimer(fn, delay = 0) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimer(key) { timers.delete(key); },
    async tick(ms = 0) {
      const end = now + ms;
      let iterations = 0;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        if (++iterations > 100) throw new Error('Unexpected timer loop');
        timers.delete(next[0]); now = next[1].at; next[1].fn(); await settle();
      }
      now = end; await settle();
    },
  };
}
export function page() {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  return { win, doc, emit(target, type, properties = {}) {
    target.dispatchEvent(Object.assign(new Event(type), properties));
  } };
}
export function socketHarness(time = clock()) {
  const sockets = [];
  class WebSocket {
    static OPEN = 1;
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(payload) { if (this.readyState !== 1) throw new Error('Socket not open'); this.sent.push(JSON.parse(payload)); }
    close() { this.readyState = 2; }
    open() { this.readyState = 1; this.onopen?.(); }
    closed() { this.readyState = 3; this.onclose?.(); }
    fail() { this.onerror?.(); }
    receive(packet) { this.onmessage?.({ data: JSON.stringify(packet) }); }
    reply(data, index = this.sent.length - 1, status = 200) { this.receive({ id: this.sent[index].id, status, data }); }
  }
  const createSocket = vm.runInNewContext(socketSource + '\ncreateRelaySocket;', {
    WebSocket, URL, TextEncoder, crypto: webcrypto,
    location: { href: 'https://local.test/engine/?online=LOCAL123', protocol: 'https:' },
    setTimeout: time.setTimer, clearTimeout: time.clearTimer,
  });
  return { sockets, createSocket, time };
}

// Execute the real browser adapter with a minimal native-engine boundary. No
// production credentials, network calls, deck manipulation or simulated wins.
export async function onlineHarness({ transport = 'websocket', isHost = false } = {}) {
  const time = clock(), surface = page(), wire = socketHarness(time);
  const calls = [], received = [], warnings = [];
  const status = { setAttribute() {}, classList: { toggle() {} } };
  const doc = Object.assign(surface.doc, { createElement: () => status, body: { append() {} }, getElementById: () => null });
  const game = { online: true, requireSandboxOn() {}, switchMode() {} };
  const nativeStatus = {};
  const lib = { config: {}, wsOL: [], mode: { xingBei: { connect: {} } }, message: { client: {
    onmessage: (from, data) => received.push(JSON.parse(data)), onclose() {}, onconnection() {},
  } }, element: { ws: { onmessage: event => received.push(JSON.parse(event.data)) } } };
  let sessionReads = 0, generatedIds = 0, reloads = 0;
  const start = vm.runInNewContext(onlineSource + '\nstartRelay;', {
    game, lib, ui: {}, _status: nativeStatus, freeDraftMethods: {}, characterFamily() {}, availableCharacters() {},
    security: { createSandbox() {} }, URLSearchParams, crypto: { randomUUID() { generatedIds++; return webcrypto.randomUUID(); } }, AbortController,
    location: { search: '?online=LOCAL123', reload() { reloads++; } }, window: surface.win, document: doc,
    Date: { now: time.now },
    sessionStorage: { getItem() { sessionReads++; return 'local-seat'; } }, matchMedia: () => ({ matches: false }),
    console: { warn: (...args) => warnings.push(args) }, setTimeout: time.setTimer, clearTimeout: time.clearTimer,
    createRelaySocket: wire.createSocket,
    createRelayLifecycle: options => createRelayLifecycle({ ...options, window: surface.win, document: doc, setTimer: time.setTimer, clearTimer: time.clearTimer }),
    fetch: async (url, options) => {
      const body = JSON.parse(options.body), pending = deferred();
      calls.push({ body, signal: options.signal, resolve: data => pending.resolve({ ok: true, json: async () => data }) });
      if (body.type === 'attach') return { ok: true, json: async () => ({ transport, sequence: 0,
        room: { code: body.code, me: isHost ? '1' : '2', nickname: '本機測試', isHost, status: 'playing', capacity: 4 } }) };
      options.signal.addEventListener('abort', () => pending.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true });
      return pending.promise;
    },
  });
  await start();
  return { ...surface, ...wire, game, lib, calls, received, warnings, status, nativeStatus,
    reloads: () => reloads, sessionReads: () => sessionReads, generatedIds: () => generatedIds };
}
