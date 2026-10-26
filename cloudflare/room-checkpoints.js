import { memberFor, syncFullRoom } from '../lib/full-room.ts';

// An acknowledgement can be recovered from the live hibernating socket. It
// never contains a new game action: those must still commit before responding.
// Losing a closed socket's checkpoint only replays already delivered messages;
// clients filter sequence numbers, and a new epoch uses native reinitialization.
export function syncSocketRoom(room, auth, input, attachments, now = Date.now()) {
  const caller = memberFor(room, auth);
  if ((caller.hostGeneration || 0) !== (room.hostGeneration || 0)) return syncFullRoom(room, auth, input, now);
  const persistedAt = room.updated;
  const previousStatus = room.status;
  const previousSequence = room.sequence;
  const previousReceived = room.received.at(-1);
  for (const checkpoint of attachments) {
    if (!checkpoint) continue;
    const member = room.members.find(m => m.auth === checkpoint.auth && m.connection && m.connection === checkpoint.connection);
    if (!member || (member.hostGeneration || 0) !== (room.hostGeneration || 0)) continue;
    if (Number.isSafeInteger(checkpoint.ack) && checkpoint.ack >= 0 && checkpoint.ack <= room.sequence) {
      member.ack = Math.max(member.ack, checkpoint.ack);
    }
    if (Number.isSafeInteger(checkpoint.seen) && checkpoint.seen <= now) member.seen = Math.max(member.seen, checkpoint.seen);
  }
  const acknowledged = new Map(room.members.map(m => [m.id, m.ack]));
  room.messages = room.messages.filter(m => m.seq > (acknowledged.get(m.to) ?? -1));
  syncFullRoom(room, auth, input, now);
  // Any accepted new action commits immediately, including a host message
  // intentionally discarded for an offline/old-epoch recipient. Repeated
  // delivery of the same batch does not need another database transaction.
  // Consolidate all seats' presence checkpoints once per room heartbeat;
  // per-seat timers otherwise multiply idle writes by the number of players.
  // HTTP fallback continues to persist each successful change as before.
  return room.sequence !== previousSequence || room.received.at(-1) !== previousReceived ||
    room.status !== previousStatus || now - persistedAt > 8_000;
}

export function socketCheckpoint(room, auth) {
  const member = memberFor(room, auth);
  return { auth, connection: member.connection, ack: member.ack, seen: member.seen };
}
