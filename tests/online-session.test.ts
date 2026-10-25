import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_ROOM_KEY, normalizeRoomCode, roomInvite, savedRoom, seatKey, shouldResumeRoom, resumeGuestRoom } from '../lib/online-session.ts';
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
