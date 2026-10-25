export type LobbyRoom = { code: string; name: string; host: string; count: number; capacity: number };

// Removing an obsolete pointer is optional. A blocked storage getter must not
// prevent invitation navigation or fetching the public lobby.
export function homeInvite(search: string, storage: () => Pick<Storage, 'removeItem'> = () => localStorage) {
  try { storage().removeItem('grail-room-v1'); } catch { /* Keep the rest of startup usable. */ }
  const room = new URLSearchParams(search).get('room');
  return room ? '/online?room=' + encodeURIComponent(room) : null;
}

export async function readLobby(signal: AbortSignal, request: typeof fetch = fetch): Promise<LobbyRoom[]> {
  const response = await request('/api/full-room', { cache: 'no-store', signal });
  let data;
  try { data = await response.json(); }
  catch {
    signal.throwIfAborted();
    throw new Error('房間清單暫時無法讀取，請稍後再試。');
  }
  signal.throwIfAborted();
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '房間服務暫時無法連線。');
  if (data?.configured === false) throw new Error('多人服務尚未就緒，目前仍可進行單人對電腦。');
  if (data?.configured !== true || !Array.isArray(data.rooms)) throw new Error('房間清單格式有誤，請稍後再試。');
  // Do not render malformed summaries or turn them into invitations. Keep
  // only the public display fields, never persist a list or seat credentials.
  return data.rooms.map((room: unknown) => {
    if (!room || typeof room !== 'object') throw new Error('房間清單格式有誤，請稍後再試。');
    const r = room as Record<string, unknown>;
    if (typeof r.code !== 'string' || !/^[A-Z2-9]{8}$/.test(r.code) ||
      typeof r.name !== 'string' || !r.name.trim() || typeof r.host !== 'string' ||
      ![4, 6, 8].includes(Number(r.capacity)) || typeof r.capacity !== 'number' ||
      typeof r.count !== 'number' || !Number.isInteger(r.count) || r.count < 1 || r.count > r.capacity) {
      throw new Error('房間清單格式有誤，請稍後再試。');
    }
    return { code: r.code, name: r.name, host: r.host, count: r.count, capacity: r.capacity };
  });
}
