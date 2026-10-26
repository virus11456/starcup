import { GameError } from './game.ts';

export const FULL_ENGINE = 'noname-v1';
export type FullMember = { id: string; auth: string; name: string; connection: string; seen: number; ack: number; hostGeneration?: number };
export type RelayMessage = { seq: number; from: string; to: string; connection: string; data: string; at: number };
export type FullRoom = {
  engine: typeof FULL_ENGINE; code: string; name: string; capacity: number;
  status: 'waiting' | 'playing' | 'closed'; revision: number; created: number; updated: number;
  members: FullMember[]; sequence: number; messages: RelayMessage[]; received: string[];
  hostGeneration?: number; lobbyRecovery?: boolean;
};
export function roomError(message: string, status = 400): never {
  throw Object.assign(new GameError(message), { status });
}
export function cleanName(value: unknown, max = 24) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[<>&\x00-\x1f]/.test(value))
    roomError(`請輸入 1–${max} 字的名稱，不含特殊標記。`);
  return value.trim();
}
export function createFullRoom(code: string, auth: string, name: unknown, title: unknown, capacity: unknown, now = Date.now()): FullRoom {
  if (![4, 6, 8].includes(Number(capacity))) roomError('請選擇 4、6 或 8 人牌局。');
  return { engine: FULL_ENGINE, code, name: cleanName(title), capacity: Number(capacity), status: 'waiting', revision: 0,
    created: now, updated: now, members: [{ id: '1', auth, name: cleanName(name, 16), connection: '', seen: now, ack: 0 }],
    sequence: 0, messages: [], received: [] };
}
export function memberFor(room: FullRoom, auth: string) {
  const member = room.members.find(m => m.auth === auth);
  if (!member) roomError('你不在這個房間內，請從邀請連結加入。', 403);
  return member;
}
export function fullSummary(room: FullRoom) {
  return { engine: FULL_ENGINE, code: room.code, name: room.name, capacity: room.capacity, count: room.members.length,
    status: room.status, public: true, host: room.members[0]?.name || '', created: room.created };
}
export function joinFullRoom(room: FullRoom, auth: string, name: unknown, id: string, now = Date.now()) {
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  const existing = room.members.find(m => m.auth === auth);
  if (existing) return existing;
  if (room.status !== 'waiting') roomError('牌局已開始或結束，請加入其他房間。', 409);
  if (room.members.length >= room.capacity) roomError('房間已滿。', 409);
  const member = { id, auth, name: cleanName(name, 16), connection: '', seen: now, ack: room.sequence };
  room.members.push(member);
  return member;
}
export function fullView(room: FullRoom, auth: string) {
  const member = memberFor(room, auth);
  return { ...fullSummary(room), me: member.id, nickname: member.name, isHost: member.id === '1' };
}
export function checkWaitingHostRecovery(room: FullRoom, auth: string, now = Date.now()) {
  const member = memberFor(room, auth);
  if (member.id !== '1') roomError('只有原房主可以恢復等待中的房間。', 403);
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  if (room.status !== 'waiting') roomError('牌局已開始，請回到房主原分頁；目前無法恢復已關閉分頁的進行中牌局。', 409);
  if (member.connection && !room.lobbyRecovery) roomError('這個舊版房間不支援等待室恢復，請回到原分頁。', 409);
  if (member.connection && now - member.seen < 60_000) roomError('原房主分頁仍在線上，請回到原分頁；若已關閉，請在離線滿 60 秒後再試。', 409);
}
export function startFullRoom(room: FullRoom, auth: string, connection: unknown) {
  const member = memberFor(room, auth);
  if (member.id !== '1') roomError('只有房主可以開始牌局。', 403);
  if (!member.connection || member.connection !== connection) roomError('此牌局已在另一個頁面開啟，請回到目前的房主分頁。', 409);
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  if (room.status === 'playing') return false; // lost start reply: safe to retry
  room.status = 'playing';
  return true;
}
export function attachFullRoom(room: FullRoom, auth: string, connection: unknown, now = Date.now(),
  options: { protocol?: unknown; recover?: unknown } = {}) {
  const member = memberFor(room, auth);
  if (typeof connection !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(connection)) roomError('連線識別無效。');
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  if (member.id === '1' && member.connection && member.connection !== connection) {
    // A second page must never close a surviving host's native event stack.
    // Only a gated, not-yet-started lobby can be rebuilt after the host expires.
    if (options.recover !== true || options.protocol !== 2) roomError('房主已有原分頁，請回到原分頁；尚未開局可從大廳恢復等待房間。', 409);
    checkWaitingHostRecovery(room, auth, now);
    room.hostGeneration = (room.hostGeneration || 0) + 1;
    room.messages = [];
    room.received = [];
    for (const seat of room.members) seat.ack = room.sequence;
  }
  if (member.id === '1' && !member.connection) room.lobbyRecovery = options.protocol === 2;
  if (member.connection !== connection) {
    room.messages = room.messages.filter(m => m.to !== member.id && m.from !== member.id);
    member.ack = room.sequence;
  }
  member.connection = connection;
  member.hostGeneration = room.hostGeneration || 0;
  member.seen = now;
}
const GUEST_COMMANDS = new Set(['init', 'inited', 'reinited', 'result', 'tempResult', 'auto', 'unauto', 'chat', 'emotion', 'throwEmotion']);
function safeGuestValue(value: unknown, depth = 0, nativeBackup = false): boolean {
  if (depth > 30) return false;
  if (typeof value === 'string') return (nativeBackup || !value.startsWith('_noname_func:')) && !value.startsWith('_noname_event:');
  if (Array.isArray(value)) return value.every(v => safeGuestValue(v, depth + 1, nativeBackup));
  if (value && typeof value === 'object') return Object.entries(value).every(([k, v]) =>
    !['__proto__', 'prototype', 'constructor'].includes(k) && safeGuestValue(v, depth + 1, nativeBackup));
  return true;
}
export function validateRelayData(data: unknown, member: FullMember) {
  if (typeof data !== 'string' || data.length > 300_000) roomError('同步訊息過大。', 413);
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { roomError('同步訊息無效。'); }
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string') roomError('同步格式無效。');
  if (member.id !== '1') {
    if (!GUEST_COMMANDS.has(parsed[0])) roomError('這項連線指令不允許執行：' + (/^[a-zA-Z]{1,24}$/.test(parsed[0]) ? parsed[0] : '無效指令'), 403);
    // Native chooseButton skills send a temporary "*_backup" definition in
    // result._sendskill. Preserve that protocol and its per-client sandbox;
    // rejecting every serialized function breaks real role skills. Functions
    // elsewhere, arbitrary exec/log and event injection remain disallowed.
    const result = parsed[0] === 'result' ? parsed[1] : null;
    const backup = result?._sendskill;
    let safe = safeGuestValue(parsed);
    if (backup !== undefined) {
      safe = Array.isArray(backup) && backup.length === 2 && /^[a-zA-Z0-9_]+_backup$/.test(backup[0]) &&
        backup[1] && typeof backup[1] === 'object' && !Array.isArray(backup[1]) &&
        safeGuestValue(backup[1], 0, true) && safeGuestValue([parsed[0], { ...result, _sendskill: null }, ...parsed.slice(2)]);
    }
    if (!safe) roomError('這項連線資料不允許執行：' + parsed[0] + ' 含動態程式資料。', 403);
    if (parsed[0] === 'chat') { parsed[1] = member.id; parsed[2] = cleanName(parsed[2], 200); }
    if (parsed[0] === 'emotion') {
      parsed[1] = member.id;
      if (!/^[a-zA-Z0-9_-]{1,30}$/.test(String(parsed[2])) || !/^\d{1,2}$/.test(String(parsed[3]))) roomError('表情無效。');
    }
    if (parsed[0] === 'throwEmotion' && !['flower', 'egg', 'wine', 'shoe', 'yuxisx', 'jiasuo'].includes(parsed[2])) roomError('表情無效。');
    if (parsed[0] === 'init') {
      if (!parsed[2] || typeof parsed[2] !== 'object' || Array.isArray(parsed[2])) roomError('初始化資料無效。');
      parsed[2].id = member.id;
      parsed[2].nickname = member.name;
      parsed[2].onlineKey = member.id;
      parsed[2].avatar = 'fengYinShi';
      parsed[2].extension = false;
    }
  }
  return JSON.stringify(parsed);
}
type Outgoing = { id: string; to: string; data: string; connection?: string };
export function syncFullRoom(room: FullRoom, auth: string, input: { connection?: unknown; ack?: unknown; messages?: unknown; started?: unknown }, now = Date.now()) {
  const member = memberFor(room, auth);
  if (!member.connection || member.connection !== input.connection) roomError('此牌局已在另一個頁面開啟，請重新加入。', 409);
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  // A guest from the old lobby receives only the restart notice. Its pending
  // choices/acks must not reach the replacement host before native init.
  if ((member.hostGeneration || 0) !== (room.hostGeneration || 0)) return false;
  let changed = false;
  if (now - member.seen > 8_000) { member.seen = now; changed = true; }
  const ack = input.ack;
  if (!Number.isSafeInteger(ack) || Number(ack) < 0 || Number(ack) > room.sequence) roomError('同步位置無效。');
  if (Number(ack) > member.ack) { member.ack = Number(ack); changed = true; }
  const retained = room.messages.filter(m => !(m.to === member.id && m.seq <= member.ack) && now - m.at < 120_000);
  if (retained.length !== room.messages.length) { room.messages = retained; changed = true; }
  if (input.started === true && member.id !== '1') roomError('只有房主可以開始牌局。', 403);
  if (input.started === true && room.status === 'waiting') { room.status = 'playing'; changed = true; }
  if (!Array.isArray(input.messages) || input.messages.length > 100) roomError('同步訊息數量無效。');
  // The original host is the only owner of native turn/skill continuations.
  // A guest may have submitted an action just as the host disappeared; never
  // leave that stale choice queued for a host that wakes after its timeout.
  // Preserve normal waiting-room handshakes and validate every command first.
  const absentPlayingHost = member.id !== '1' && room.status === 'playing'
    && (!room.members[0]?.connection || now - room.members[0].seen >= 60_000);
  let size = 0;
  for (const message of input.messages as Outgoing[]) {
    if (!message || typeof message.id !== 'string' || !/^[\w-]{16,64}$/.test(message.id)) roomError('訊息識別無效。');
    if ((member.id === '1' && message.to === '1') || (member.id !== '1' && message.to !== '1')) roomError('不能傳送到這個玩家。', 403);
    const recipient = room.members.find(m => m.id === message.to);
    const key = member.id + ':' + message.id;
    if (room.received.includes(key)) continue;
    // A departing guest must not abort the host's entire broadcast batch.
    // Their reconnect uses the native reinit snapshot, not this stale inbox.
    if ((!recipient?.connection || (recipient.hostGeneration || 0) !== (room.hostGeneration || 0)) && member.id === '1') { room.received.push(key); changed = true; continue; }
    if (!recipient?.connection) roomError('對方尚未連線。', 409);
    if (member.id === '1' && message.connection && message.connection !== recipient.connection) {
      room.received.push(key); changed = true; continue;
    }
    const data = validateRelayData(message.data, member);
    size += data.length;
    if (size > 500_000) roomError('同步批次過大。', 413);
    if (absentPlayingHost) {
      room.received.push(key);
      changed = true;
      continue;
    }
    room.messages.push({ seq: ++room.sequence, from: member.id, to: recipient.id, connection: recipient.connection, data, at: now });
    room.received.push(key);
    changed = true;
  }
  room.received = room.received.slice(-2000);
  if (room.messages.reduce((total, m) => total + m.data.length, 0) > 4_000_000) roomError('對方暫時離線，請稍候同步。', 503);
  return changed;
}
export function relayView(room: FullRoom, auth: string, now = Date.now()) {
  const member = memberFor(room, auth);
  const rejoinLobby = (member.hostGeneration || 0) !== (room.hostGeneration || 0);
  return { room: fullView(room, auth), sequence: room.sequence, rejoinLobby,
    messages: room.messages.filter(m => m.to === member.id && m.connection === member.connection && m.seq > member.ack)
      .map(({ seq, from, data }) => ({ seq, from, data })),
    peers: member.id === '1' ? room.members.filter(m => m.id !== '1' && m.connection && !rejoinLobby && (m.hostGeneration || 0) === (room.hostGeneration || 0) && now - m.seen < 60_000)
      .map(m => ({ id: m.id, name: m.name, connection: m.connection })) : [],
    hostAlive: !!room.members[0]?.connection && now - room.members[0].seen < 60_000 };
}
