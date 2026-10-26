import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_ROOM_KEY, normalizeRoomCode, roomInvite, savedRoom, seatKey, shouldResumeRoom, resumeGuestRoom, resumeWaitingHost, trustedHostPresence, replacementRoomSettings } from '../lib/online-session.ts';
import { safeAccessNext } from '../lib/site-access.ts';

const guest = { code: 'ABCDEFGH', name: '朋友的牌局', capacity: 4, nickname: '甲', isHost: false };
const token = 'ab'.repeat(32);
test('invites contain only the normalized room code and survive the password gate', () => {
  const url = new URL(roomInvite('https://game.test/online?secret=private#seat', ' abcdefgh '));
  assert.equal(url.href, 'https://game.test/online?room=ABCDEFGH');
  assert.equal(safeAccessNext(url.pathname + url.search), '/online?room=ABCDEFGH');
  assert.throws(() => roomInvite('https://game.test', '<script>'));
  assert.equal(normalizeRoomCode('ABCDEFGHI'), '');
});
test('saved room requires the original tab credential and tolerates unavailable/corrupt storage', () => {
  const values = new Map([[ACTIVE_ROOM_KEY, JSON.stringify(guest)], [seatKey(guest.code), token]]);
  const storage = { getItem: (key: string) => values.get(key) || null };
  assert.deepEqual(savedRoom(storage), guest);
  values.delete(seatKey(guest.code)); assert.equal(savedRoom(storage), null);
  values.set(ACTIVE_ROOM_KEY, 'bad-json'); assert.equal(savedRoom(storage), null);
  assert.equal(savedRoom({ getItem() { throw new Error('blocked'); } }), null);
});
test('only returning to the same guest room auto-resumes; fresh visits/invites and hosts never do', () => {
  for (const type of ['reload', 'back_forward']) assert.ok(shouldResumeRoom(guest, guest.code, type));
  assert.equal(shouldResumeRoom(guest, guest.code, 'navigate'), false);
  assert.equal(shouldResumeRoom(guest, 'ZYXWVUTS', 'reload'), false);
  assert.equal(shouldResumeRoom(guest, '', 'reload'), false);
  assert.equal(shouldResumeRoom({ ...guest, isHost: true }, guest.code, 'reload'), false);
  assert.equal(shouldResumeRoom(null, guest.code, 'reload'), false);
});
test('guest refresh reuses the authenticated seat instead of creating or leaving a room', async () => {
  const controller = new AbortController();
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, '/api/full-room'); assert.equal(init?.signal, controller.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), { type: 'join', code: guest.code, name: guest.nickname, token });
    return Response.json({ room: guest });
  };
  assert.deepEqual(await resumeGuestRoom(guest, token, controller.signal, request), guest);
  assert.equal(calls, 1);
  await assert.rejects(resumeGuestRoom({ ...guest, isHost: true }, token, undefined, request), /原分頁/);
  assert.equal(calls, 1, 'host reload must not attach a fresh engine or close the current match');
});
test('expired/closed rooms fail visibly and a server-reported host is never resumed as a guest', async () => {
  await assert.rejects(resumeGuestRoom(guest, token, undefined, async () => Response.json({ error: '房間已結束' }, { status: 410 })), /已結束/);
  await assert.rejects(resumeGuestRoom(guest, token, undefined, async () => Response.json({ room: { ...guest, isHost: true } })), /原本的分頁/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(resumeGuestRoom(guest, token, controller.signal, async (_url, init) => {
    init?.signal?.throwIfAborted(); return Response.json({ room: guest });
  }), { name: 'AbortError' });
});
test('a response arriving after cancellation cannot restore a guest even if the transport ignores abort', async () => {
  const controller = new AbortController();
  let deliver!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { deliver = resolve; });
  const pending = resumeGuestRoom(guest, token, controller.signal, () => response);
  controller.abort();
  deliver(Response.json({ room: guest }));
  await assert.rejects(pending, { name: 'AbortError' });
});
test('host recovery checks the server without attaching, leaving or recreating the room', async () => {
  const host = { ...guest, isHost: true };
  let calls = 0;
  const request: typeof fetch = async (_url, init) => {
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)), { type: 'recover-check', code: guest.code, token });
    return Response.json({ room: { ...host, status: 'waiting' } });
  };
  assert.deepEqual(await resumeWaitingHost(host, token, undefined, request), host);
  await assert.rejects(resumeWaitingHost(guest, token, undefined, request));
  await assert.rejects(resumeWaitingHost(host, '', undefined, request));
  assert.equal(calls, 1);
  for (const status of ['playing', 'closed', undefined]) await assert.rejects(resumeWaitingHost(host, token, undefined,
    async () => Response.json({ room: { ...host, status } })), /不能重建/);
  await assert.rejects(resumeWaitingHost(host, token, undefined,
    async () => Response.json({ error: '原分頁仍在線上' }, { status: 409 })), /仍在線上/);
});
test('a cancelled host preflight never launches a replacement lobby', async () => {
  const controller = new AbortController();
  let deliver!: (value: Response) => void;
  const reply = new Promise<Response>(resolve => { deliver = resolve; });
  const pending = resumeWaitingHost({ ...guest, isHost: true }, token, controller.signal, () => reply);
  controller.abort();
  deliver(Response.json({ room: { ...guest, isHost: true, status: 'waiting' } }));
  await assert.rejects(pending, { name: 'AbortError' });
});

test('host absence notices are accepted only from the active same-origin engine frame and same room', () => {
  const frame = {} as MessageEventSource;
  const make = (source: MessageEventSource | null, origin: string, code: string, state: string) => ({
    source, origin, data: { type: 'grail-host-presence', code, state },
  });
  assert.equal(trustedHostPresence(make(frame, 'https://star.test', guest.code, 'absent'), 'https://star.test', frame, guest.code), 'absent');
  assert.equal(trustedHostPresence(make(frame, 'https://star.test', guest.code, 'present'), 'https://star.test', frame, guest.code), 'present');
  assert.equal(trustedHostPresence(make(frame, 'https://attacker.test', guest.code, 'absent'), 'https://star.test', frame, guest.code), null);
  assert.equal(trustedHostPresence(make({} as MessageEventSource, 'https://star.test', guest.code, 'absent'), 'https://star.test', frame, guest.code), null);
  assert.equal(trustedHostPresence(make(frame, 'https://star.test', 'ZZZZZZZZ', 'absent'), 'https://star.test', frame, guest.code), null);
  assert.equal(trustedHostPresence(make(frame, 'https://star.test', guest.code, 'takeover'), 'https://star.test', frame, guest.code), null);
});
test('lost-host fallback is explicitly a new match and cannot silently promote the old seat', () => {
  assert.deepEqual(replacementRoomSettings(guest), { type: 'create', code: '', name: '甲',
    title: '朋友的牌局・重新開局', capacity: 4 });
  for (const capacity of [4, 6, 8]) assert.equal(replacementRoomSettings({ ...guest, capacity }).capacity, capacity);
  assert.throws(() => replacementRoomSettings({ ...guest, isHost: true }), /其他玩家/);
  assert.throws(() => replacementRoomSettings({ ...guest, code: 'bad' }), /其他玩家/);
  assert.ok(replacementRoomSettings({ ...guest, name: '極長房間名稱極長房間名稱極長房間名稱極長房間名稱' }).title.length <= 24);
});
