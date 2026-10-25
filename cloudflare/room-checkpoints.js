import { memberFor, syncFullRoom } from '../lib/full-room.ts';

// An acknowledgement can be recovered from the live hibernating socket. It
// never contains a new game action: those must still commit before responding.
// Losing a closed socket's checkpoint only replays already delivered messages;
// clients filter sequence numbers, and a new epoch uses native reinitialization.
export function syncSocketRoom(room, auth, input, attachments, now = Date.now()) {
  const persistedSeen = memberFor(room, auth).seen;
  const previousStatus = room.status;
  for (const checkpoint of attachments) {
    if (!checkpoint) continue;
    const member = room.members.find(m => m.auth === checkpoint.auth && m.connection && m.connection === checkpoint.connection);
    if (!member) continue;
    if (Number.isSafeInteger(checkpoint.ack) && checkpoint.ack >= 0 && checkpoint.ack <= room.sequence) {
      member.ack = Math.max(member.ack, checkpoint.ack);
    }
    if (Number.isSafeInteger(checkpoint.seen) && checkpoint.seen <= now) member.seen = Math.max(member.seen, checkpoint.seen);
  }
  const acknowledged = new Map(room.members.map(m => [m.id, m.ack]));
  room.messages = room.messages.filter(m => m.seq > (acknowledged.get(m.to) ?? -1));
  syncFullRoom(room, auth, input, now);
  // Consolidate checkpoints with the next action, or the existing heartbeat.
  // HTTP fallback continues to persist each successful change as before.
  return input.messages.length > 0 || room.status !== previousStatus || now - persistedSeen > 8_000;
}

export function socketCheckpoint(room, auth) {
  const member = memberFor(room, auth);
  return { auth, connection: member.connection, ack: member.ack, seen: member.seen };
}
