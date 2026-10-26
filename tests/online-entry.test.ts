import test from 'node:test';
import assert from 'node:assert/strict';
import { enterOnlineRoom, resumeGuestRoom, roomRequestMessage, seatKey, PENDING_CREATION_KEY } from '../lib/online-session.ts';

const guest = { code: 'ABCDEFGH', name: '朋友的牌局', capacity: 4, nickname: '甲', isHost: false };
const input = { type: 'join' as const, code: ' abcdefgh ', name: '甲', title: '牌局', capacity: 4 };
const token = 'ab'.repeat(32);
const signal = () => new AbortController().signal;
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

test('a join retry after a lost reply uses the saved seat, even from a new page instance', async () => {
  const storage = memory();
  const bodies: Record<string, unknown>[] = [];
  const request: typeof fetch = async (url, init) => {
    assert.equal(url, '/api/full-room');
    assert.equal(init?.cache, 'no-store');
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    assert.equal(storage.getItem(seatKey(guest.code)), body.token, 'persist before sending');
    if (bodies.length === 1) throw new TypeError('Failed to fetch');
    return Response.json({ room: guest });
  };
  await assert.rejects(enterOnlineRoom(input, signal(), { storage: () => storage, request, token: () => token }), TypeError);
  assert.deepEqual(await enterOnlineRoom(input, signal(), { storage: () => storage, request,
    token: () => { throw new Error('Must reuse the original seat'); } }), guest);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].token, bodies[1].token);
  assert.equal(bodies[1].code, guest.code);
});

test('blocked or ineffective seat storage stops create/join before a server mutation', async () => {
  let calls = 0;
  const request: typeof fetch = async () => { calls++; return Response.json({ room: guest }); };
  const blocked = () => { throw new DOMException('Access denied', 'SecurityError'); };
  for (const storage of [blocked, () => ({ ...memory(), setItem: blocked }),
    () => ({ ...memory(), setItem() {} }), () => ({ ...memory(), getItem: blocked })]) {
    for (const type of ['create', 'join'] as const) {
      await assert.rejects(enterOnlineRoom({ ...input, type }, signal(), { storage, request, token: () => token }), /瀏覽器無法保存座位/);
    }
  }
  assert.equal(calls, 0, 'do not consume a room creation or add an unreachable member');
});

test('creating a room persists its pending identity first and clears it only after saving the host seat', async () => {
  const storage = memory();
  storage.setItem('existing-preference', 'keep');
  const host = { ...guest, isHost: true };
  const next = await enterOnlineRoom({ ...input, type: 'create', code: '' }, signal(), {
    storage: () => storage, token: () => token, request: async (_url, init) => {
      assert.equal(JSON.parse(storage.getItem(PENDING_CREATION_KEY)!).token, token);
      assert.equal(JSON.parse(String(init?.body)).token, token);
      return Response.json({ room: { ...host, members: ['not navigation metadata'] } });
    },
  });
  assert.deepEqual(next, host);
  assert.equal(storage.getItem(seatKey(guest.code)), token);
  assert.equal(storage.getItem('existing-preference'), 'keep');
  assert.equal(storage.getItem(PENDING_CREATION_KEY), null);
});

test('create retries retain their identity after network, malformed response and host-seat storage failures', async () => {
  const storage = memory(), create = { ...input, type: 'create' as const, code: '' };
  const calls: string[] = [];
  let attempt = 0, failSeat = true;
  const guarded = { ...storage, setItem(key: string, value: string) {
    if (key === seatKey(guest.code) && failSeat) throw new Error('Quota');
    storage.setItem(key, value);
  } };
  const request: typeof fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)).token);
    if (++attempt === 1) throw new TypeError('Lost response');
    if (attempt === 2) return new Response('Bad gateway', { status: 502 });
    return Response.json({ room: { ...guest, isHost: true } });
  };
  for (const expected of [/Lost response/, /回應無法讀取/, /房間已建立/]) {
    await assert.rejects(enterOnlineRoom(create, signal(), { storage: () => guarded, request, token: () => token }), expected);
    assert.equal(JSON.parse(storage.getItem(PENDING_CREATION_KEY)!).token, token);
  }
  failSeat = false;
  await enterOnlineRoom(create, signal(), { storage: () => guarded, request, token: () => assert.fail('must reuse token') });
  assert.deepEqual(calls, Array(4).fill(token));
  assert.equal(storage.getItem(PENDING_CREATION_KEY), null);
  assert.equal(storage.getItem(seatKey(guest.code)), token);
});

test('late create responses retain the pending identity and terminal replies permit a fresh creation', async () => {
  const storage = memory(), controller = new AbortController(), create = { ...input, type: 'create' as const };
  await assert.rejects(enterOnlineRoom(create, controller.signal, { storage: () => storage, token: () => token,
    request: async () => { controller.abort(); return Response.json({ room: { ...guest, isHost: true } }); } }), { name: 'AbortError' });
  assert.equal(JSON.parse(storage.getItem(PENDING_CREATION_KEY)!).token, token);
  await assert.rejects(enterOnlineRoom(create, signal(), { storage: () => storage,
    request: async () => Response.json({ error: '請回原分頁繼續' }, { status: 410 }) }), /請回原分頁/);
  assert.equal(storage.getItem(PENDING_CREATION_KEY), null);
  const nextToken = 'cd'.repeat(32);
  await enterOnlineRoom(create, signal(), { storage: () => storage, token: () => nextToken,
    request: async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).token, nextToken);
      return Response.json({ room: { ...guest, isHost: true } });
    } });
});

test('changed settings and expired or corrupt pending data cannot reuse a previous creation', async () => {
  const create = { ...input, type: 'create' as const }, storage = memory();
  const settings = JSON.stringify([input.name, input.title, input.capacity]);
  for (const pending of ['invalid-json', JSON.stringify({ settings, token, at: Date.now() - 86_400_001 }),
    JSON.stringify({ settings: 'different-room', token, at: Date.now() })]) {
    storage.setItem(PENDING_CREATION_KEY, pending);
    await enterOnlineRoom(create, signal(), { storage: () => storage, token: () => 'cd'.repeat(32),
      request: async (_url, init) => {
        assert.equal(JSON.parse(String(init?.body)).token, 'cd'.repeat(32));
        return Response.json({ room: { ...guest, isHost: true } });
      } });
  }
});

test('invalid codes and already cancelled entries never allocate credentials or call the service', async () => {
  let calls = 0;
  const options = { storage: () => { calls++; return memory(); }, request: async () => { calls++; return Response.json({ room: guest }); } };
  await assert.rejects(enterOnlineRoom({ ...input, code: 'bad' }, signal(), options), /8 位/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(enterOnlineRoom(input, controller.signal, options), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('late successful join replies after cancellation cannot open a room but retain the retry credential', async () => {
  const storage = memory(), controller = new AbortController();
  let deliver!: (response: Response) => void;
  const pending = enterOnlineRoom(input, controller.signal, { storage: () => storage, token: () => token,
    request: () => new Promise(resolve => { deliver = resolve; }) });
  controller.abort(); deliver(Response.json({ room: guest }));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(storage.getItem(seatKey(guest.code)), token);
});

test('invalid and mismatched room responses never become navigation metadata', async () => {
  for (const room of [null, {}, { ...guest, code: 'ZYXWVUTS' }, { ...guest, capacity: '4' },
    { ...guest, isHost: 'false' }, { ...guest, nickname: '' }, { ...guest, name: {} }]) {
    const storage = memory();
    await assert.rejects(enterOnlineRoom(input, signal(), { storage: () => storage, token: () => token,
      request: async () => Response.json({ room }) }), /房間資料格式有誤/);
    assert.deepEqual([...storage.values.keys()], [seatKey(guest.code)], 'no keys from an invalid response');
  }
});

test('HTML, malformed success and API failures have readable errors and preserve the join identity', async () => {
  const storage = memory();
  for (const [response, expected] of [
    [new Response('<html>Bad gateway</html>', { status: 502 }), /房間服務回應無法讀取/],
    [Response.json(null), /房間資料格式有誤/],
    [Response.json({ error: '房間已滿。' }, { status: 409 }), /房間已滿/],
    [Response.json({ error: {} }, { status: 503 }), /房間服務暫時無法連線/],
  ] as const) {
    await assert.rejects(enterOnlineRoom(input, signal(), { storage: () => storage, token: () => token,
      request: async () => response }), expected);
    assert.equal(storage.getItem(seatKey(guest.code)), token);
  }
});

test('reconnecting rejects absent seats before HTTP and malformed or different rooms after HTTP', async () => {
  let calls = 0;
  await assert.rejects(resumeGuestRoom(guest, '', signal(), async () => { calls++; return Response.json({ room: guest }); }), /找不到原本的座位識別/);
  assert.equal(calls, 0);
  for (const response of [Response.json({}), Response.json({ room: { ...guest, code: 'ZYXWVUTS' } })]) {
    await assert.rejects(resumeGuestRoom(guest, token, signal(), async () => response), /房間資料格式有誤/);
  }
  await assert.rejects(resumeGuestRoom(guest, token, signal(), async () => new Response('Unavailable', { status: 503 })), /房間服務回應無法讀取/);
});

test('network, storage and timeout errors are translated without discarding server explanations', () => {
  assert.match(roomRequestMessage(new TypeError('Failed to fetch')), /網路連線中斷/);
  assert.match(roomRequestMessage(new DOMException('Quota exceeded', 'QuotaExceededError')), /瀏覽器無法保存座位/);
  const controller = new AbortController(); controller.abort();
  assert.match(roomRequestMessage(new SyntaxError('Unexpected token'), controller.signal), /連線逾時/);
  assert.equal(roomRequestMessage(new Error('房間已結束。')), '房間已結束。');
});
