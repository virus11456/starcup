// Browser-only room navigation metadata. Bearer credentials stay in the
// existing per-tab seat key, never in an invitation URL or localStorage.
export type OnlineRoom = { code: string; name: string; capacity: number; isHost: boolean; nickname: string };
export const ACTIVE_ROOM_KEY = 'grail-full-active-v1';
export const seatKey = (code: string) => 'grail-full-seat-' + code;
export function normalizeRoomCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z2-9]{8}$/.test(code) ? code : '';
}
export function savedRoom(storage: Pick<Storage, 'getItem'>): OnlineRoom | null {
  try {
    const room = JSON.parse(storage.getItem(ACTIVE_ROOM_KEY) || 'null');
    return room && normalizeRoomCode(room.code || '') === room.code &&
      typeof room.isHost === 'boolean' && typeof room.nickname === 'string' &&
      typeof room.name === 'string' && [4, 6, 8].includes(room.capacity) &&
      /^[a-f0-9]{64}$/.test(storage.getItem(seatKey(room.code)) || '') ? room : null;
  } catch { return null; }
}
export function shouldResumeRoom(room: OnlineRoom | null, invitedCode: string, navigationType: string) {
  return !!room && !room.isHost && invitedCode === room.code &&
    ['reload', 'back_forward'].includes(navigationType);
}
export function roomInvite(origin: string, code: string) {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('房間碼無效。');
  const url = new URL('/online', origin);
  url.searchParams.set('room', normalized);
  return url.href;
}
export async function resumeGuestRoom(room: OnlineRoom, token: string, signal?: AbortSignal,
  request: typeof fetch = fetch): Promise<OnlineRoom> {
  if (room.isHost) throw new Error('房主牌局仍由原分頁主持，請回到原分頁。重新整理後尚無法恢復房主牌局。');
  const response = await request('/api/full-room', { method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'join', code: room.code, name: room.nickname, token }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '無法恢復房間，請稍後再試。');
  if (data.room.isHost) throw new Error('請回到房主原本的分頁繼續牌局。');
  return data.room;
}
