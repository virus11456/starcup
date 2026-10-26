import { createHmac } from 'node:crypto';
import { FULL_ENGINE, roomError, type FullRoom } from './full-room.ts';

// One opaque seat credential identifies one creation attempt. Do not derive
// a public invitation code directly from the credential or accept a client code.
export function creationCode(auth: string, secret: string | undefined) {
  if (!secret) roomError('房間服務尚未完成設定，請稍後再試。', 503);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = createHmac('sha256', secret).update('full-room-create-v1:' + auth).digest();
  return Array.from(bytes.subarray(0, 8), n => letters[n % letters.length]).join('');
}

// Recover only an unlaunched room. Retrying must never replace a host's native
// event stack, refresh a closed game, change its settings or discard members.
export function recoverCreation(room: FullRoom, candidate: FullRoom, now = Date.now()) {
  if (room.engine !== FULL_ENGINE || room.code !== candidate.code)
    roomError('房間代碼重複，請重新建立房間。', 410);
  const host = room.members.find(member => member.id === '1');
  if (host?.auth !== candidate.members[0].auth)
    roomError('房間代碼重複，請重新建立房間。', 410);
  if (room.status !== 'waiting' || host.connection || now - room.created >= 86_400_000)
    roomError('上次開房已進入牌局、結束或過期。請回原分頁繼續，或再按建立房間開新牌局。', 410);
  if (room.name !== candidate.name || room.capacity !== candidate.capacity || host.name !== candidate.members[0].name)
    roomError('上次開房設定不同，請重新建立房間。', 410);
  return room;
}
