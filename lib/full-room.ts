import { GameError } from './game.ts';

export const FULL_ENGINE = 'noname-v1';
export type FullMember = { id: string; auth: string; name: string; connection: string; seen: number; ack: number };
export type RelayMessage = { seq: number; from: string; to: string; connection: string; data: string; at: number };
export type FullRoom = {
  engine: typeof FULL_ENGINE; code: string; name: string; capacity: number;
  status: 'waiting' | 'playing' | 'closed'; revision: number; created: number; updated: number;
  members: FullMember[]; sequence: number; messages: RelayMessage[]; received: string[];
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
export function attachFullRoom(room: FullRoom, auth: string, connection: unknown, now = Date.now()) {
  const member = memberFor(room, auth);
  if (typeof connection !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(connection)) roomError('連線識別無效。');
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
  if (member.id === '1' && member.connection && member.connection !== connection) {
    // A browser host owns the native event stack; never silently replace it
    // with a fresh game while other clients are still in the previous match.
    room.status = 'closed';
    room.messages = [];
    return;
  }
  if (member.connection !== connection) {
    room.messages = room.messages.filter(m => m.to !== member.id && m.from !== member.id);
    member.ack = room.sequence;
  }
  member.connection = connection;
  member.seen = now;
}
const GUEST_COMMANDS = new Set(['init', 'inited', 'reinited', 'result', 'tempResult', 'auto', 'unauto', 'chat', 'emotion', 'throwEmotion']);
function safeGuestValue(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (typeof value === 'string') return !value.startsWith('_noname_func:') && !value.startsWith('_noname_event:');
  if (Array.isArray(value)) return value.every(v => safeGuestValue(v, depth + 1));
  if (value && typeof value === 'object') return Object.entries(value).every(([k, v]) =>
    !['__proto__', 'prototype', 'constructor'].includes(k) && safeGuestValue(v, depth + 1));
  return true;
}
export function validateRelayData(data: unknown, member: FullMember) {
  if (typeof data !== 'string' || data.length > 300_000) roomError('同步訊息過大。', 413);
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { roomError('同步訊息無效。'); }
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string') roomError('同步格式無效。');
  if (member.id !== '1') {
    if (!GUEST_COMMANDS.has(parsed[0])) roomError('這項連線指令不允許執行：' + (/^[a-zA-Z]{1,24}$/.test(parsed[0]) ? parsed[0] : '無效指令'), 403);
    if (!safeGuestValue(parsed)) roomError('這項連線資料不允許執行：' + parsed[0] + ' 含動態程式資料。', 403);
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
type Outgoing = { id: string; to: string; data: string };
export function syncFullRoom(room: FullRoom, auth: string, input: { connection?: unknown; ack?: unknown; messages?: unknown; started?: unknown }, now = Date.now()) {
  const member = memberFor(room, auth);
  if (!member.connection || member.connection !== input.connection) roomError('此牌局已在另一個頁面開啟，請重新加入。', 409);
  if (room.status === 'closed') roomError('房間已結束，請建立新牌局。', 410);
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
  let size = 0;
  for (const message of input.messages as Outgoing[]) {
    if (!message || typeof message.id !== 'string' || !/^[\w-]{16,64}$/.test(message.id)) roomError('訊息識別無效。');
    if ((member.id === '1' && message.to === '1') || (member.id !== '1' && message.to !== '1')) roomError('不能傳送到這個玩家。', 403);
    const recipient = room.members.find(m => m.id === message.to);
    const key = member.id + ':' + message.id;
    if (room.received.includes(key)) continue;
    // A departing guest must not abort the host's entire broadcast batch.
    // Their reconnect uses the native reinit snapshot, not this stale inbox.
    if (!recipient?.connection && member.id === '1') { room.received.push(key); changed = true; continue; }
    if (!recipient?.connection) roomError('對方尚未連線。', 409);
    const data = validateRelayData(message.data, member);
    size += data.length;
    if (size > 500_000) roomError('同步批次過大。', 413);
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
  return { room: fullView(room, auth), sequence: room.sequence,
    messages: room.messages.filter(m => m.to === member.id && m.connection === member.connection && m.seq > member.ack)
      .map(({ seq, from, data }) => ({ seq, from, data })),
    peers: member.id === '1' ? room.members.filter(m => m.id !== '1' && m.connection && now - m.seen < 60_000)
      .map(m => ({ id: m.id, name: m.name, connection: m.connection })) : [],
    hostAlive: !!room.members[0]?.connection && now - room.members[0].seen < 60_000 };
}
