// Browser-only room navigation metadata. Bearer credentials stay in the
// existing per-tab seat key, never in an invitation URL or localStorage.
export type OnlineRoom = { code: string; name: string; capacity: number; isHost: boolean; nickname: string };
export const ACTIVE_ROOM_KEY = 'grail-full-active-v1';
export const PENDING_CREATION_KEY = 'grail-full-pending-create-v1';
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

type SeatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const validToken = (token: string | null): token is string => !!token && /^[a-f0-9]{64}$/.test(token);
function newSeatToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function pendingCreation(raw: string | null, settings: string) {
  try {
    const value = JSON.parse(raw || 'null');
    return value && value.settings === settings && validToken(value.token) &&
      Number.isFinite(value.at) && value.at <= Date.now() && Date.now() - value.at < 86_400_000 ? value : null;
  } catch { return null; }
}
export function roomRequestMessage(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return '房間連線逾時，請稍後再試。';
  if (error instanceof Error && ['SecurityError', 'QuotaExceededError'].includes(error.name)) return '瀏覽器無法保存座位，請允許此網站使用儲存空間後再試。';
  if (error instanceof TypeError) return '網路連線中斷，請檢查網路後再試；重新加入會沿用此分頁的座位。';
  return error instanceof Error ? error.message : '房間操作失敗，請稍後再試。';
}
async function roomResponse(response: Response, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let data;
  try { data = await response.json(); }
  catch {
    signal?.throwIfAborted();
    throw new Error('房間服務回應無法讀取，請稍後再試。');
  }
  signal?.throwIfAborted();
  if (!response.ok) throw Object.assign(new Error(typeof data?.error === 'string' ? data.error : '房間服務暫時無法連線。'), { status: response.status });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('房間資料格式有誤，請稍後再試。');
  return data;
}
function onlineRoom(value: unknown, expectedCode?: string): OnlineRoom {
  const room = value as Partial<OnlineRoom> | null;
  if (!room || typeof room.code !== 'string' || normalizeRoomCode(room.code) !== room.code ||
    (expectedCode && room.code !== expectedCode) || typeof room.name !== 'string' || !room.name.trim() ||
    typeof room.nickname !== 'string' || !room.nickname.trim() || typeof room.isHost !== 'boolean' ||
    ![4, 6, 8].includes(room.capacity as number)) throw new Error('房間資料格式有誤，請稍後再試。');
  return { code: room.code, name: room.name, nickname: room.nickname, isHost: room.isHost, capacity: room.capacity! };
}
export async function enterOnlineRoom(input: { type: 'create' | 'join'; code: string; name: string; title: string; capacity: number },
  signal: AbortSignal, options: { storage?: () => SeatStorage; request?: typeof fetch; token?: () => string } = {}): Promise<OnlineRoom> {
  const code = normalizeRoomCode(input.code);
  if (input.type === 'join' && !code) throw new Error('請輸入 8 位英數字房間碼。');
  signal.throwIfAborted();
  let storage: SeatStorage, token: string, creation = '';
  try {
    storage = (options.storage || (() => sessionStorage))();
    const settings = JSON.stringify([input.name.trim(), input.title.trim(), input.capacity]);
    const pending = input.type === 'create' ? pendingCreation(storage.getItem(PENDING_CREATION_KEY), settings) : null;
    const previous = input.type === 'join' ? storage.getItem(seatKey(code)) : pending?.token;
    token = validToken(previous) ? previous : (options.token || newSeatToken)();
    if (!validToken(token)) throw new Error('Invalid seat credential');
    // Persist before HTTP, including creation: a lost reply must retain the
    // identity across retries or a reload of this same browser tab.
    const key = input.type === 'join' ? seatKey(code) : PENDING_CREATION_KEY;
    creation = JSON.stringify(pending || { settings, token, at: Date.now() });
    const value = input.type === 'join' ? token : creation;
    storage.setItem(key, value);
    if (storage.getItem(key) !== value) throw new Error('Storage did not retain seat');
  } catch { throw new Error('瀏覽器無法保存座位，請允許此網站使用儲存空間後再試。'); }
  const response = await (options.request || fetch)('/api/full-room', {
    method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, code, token }),
  });
  let data;
  try { data = await roomResponse(response, signal); }
  catch (error) {
    // Only a definitive terminal response releases an unfinished creation.
    // Network/JSON failures, timeouts and rate limits preserve its identity.
    if (input.type === 'create' && error instanceof Error && 'status' in error && error.status === 410) {
      try { if (storage.getItem(PENDING_CREATION_KEY) === creation) storage.removeItem(PENDING_CREATION_KEY); } catch { /* show original server error */ }
    }
    throw error;
  }
  signal.throwIfAborted();
  const room = onlineRoom(data.room, input.type === 'join' ? code : undefined);
  if (input.type === 'create' && !room.isHost) throw new Error('房主資料有誤，請稍後再試。');
  if (input.type === 'create') {
    try {
      storage.setItem(seatKey(room.code), token);
      if (storage.getItem(seatKey(room.code)) !== token) throw new Error('Storage did not retain seat');
      if (storage.getItem(PENDING_CREATION_KEY) === creation) storage.removeItem(PENDING_CREATION_KEY);
    } catch { throw new Error('房間已建立，但瀏覽器無法保存座位。請允許儲存空間後再試。'); }
  }
  return room;
}
export async function resumeGuestRoom(room: OnlineRoom, token: string, signal?: AbortSignal,
  request: typeof fetch = fetch): Promise<OnlineRoom> {
  if (room.isHost) throw new Error('房主牌局仍由原分頁主持，請回到原分頁。重新整理後尚無法恢復房主牌局。');
  if (!validToken(token)) throw new Error('找不到原本的座位識別，請使用原分頁，或重新加入房間。');
  const response = await request('/api/full-room', { method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'join', code: room.code, name: room.nickname, token }) });
  const data = await roomResponse(response, signal);
  const next = onlineRoom(data.room, room.code);
  if (next.isHost) throw new Error('請回到房主原本的分頁繼續牌局。');
  return next;
}
export async function resumeWaitingHost(room: OnlineRoom, token: string, signal?: AbortSignal,
  request: typeof fetch = fetch): Promise<OnlineRoom> {
  if (!room.isHost) throw new Error('請使用玩家的重新連接牌局功能。');
  if (!validToken(token)) throw new Error('找不到原房主的座位識別，請使用原分頁。');
  signal?.throwIfAborted();
  // Read-only preflight: never close or replace an active host on this page.
  // The engine attach repeats the checks atomically before rebuilding a lobby.
  const response = await request('/api/full-room', { method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recover-check', code: room.code, token }) });
  const data = await roomResponse(response, signal);
  const next = onlineRoom(data.room, room.code);
  if (!next.isHost || (data.room as { status?: string }).status !== 'waiting') throw new Error('牌局已開始，請回到房主原分頁；不能重建進行中的牌局。');
  return next;
}
