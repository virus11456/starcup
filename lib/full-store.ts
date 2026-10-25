import { roomRest } from './store.ts';
import { FULL_ENGINE, fullSummary, roomError, type FullRoom } from './full-room.ts';
type Row = { state: FullRoom; summary: ReturnType<typeof fullSummary>; revision: number; updated_at: string };
export async function listFullRooms() {
  const since = new Date(Date.now() - 60_000).toISOString();
  const rows = await roomRest<Row>(`select=summary&summary->>engine=eq.${FULL_ENGINE}&summary->>status=eq.waiting&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc&limit=40`);
  return rows.map(row => row.summary);
}
export async function insertFullRoom(room: FullRoom, creator: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const rows = await roomRest(`select=code&creator_hash=eq.${creator}&created_at=gte.${encodeURIComponent(since)}&limit=6`);
  if (rows.length >= 5) roomError('每小時最多建立 5 個房間，請稍後再試。', 429);
  await roomRest('', 'POST', { code: room.code, revision: 0, state: room, summary: fullSummary(room), creator_hash: creator });
}
export async function changeFullRoom<T>(code: unknown, change: (room: FullRoom) => { changed: boolean; result: T }): Promise<T> {
  if (typeof code !== 'string' || !/^[A-Z2-9]{8}$/.test(code)) roomError('邀請碼為 8 位英數字。');
  for (let attempt = 0; attempt < 8; attempt++) {
    const rows = await roomRest<Row>(`code=eq.${code}&select=state,revision,updated_at`);
    const row = rows[0];
    if (!row || Date.now() - Date.parse(row.updated_at) > 24 * 3600_000) roomError('找不到房間，或房間已過期。', 404);
    if (row.state.engine !== FULL_ENGINE) roomError('這是舊版核心對局，已停止從大廳載入。請建立新的完整角色房間。', 410);
    const { changed, result } = change(row.state);
    if (!changed) return result;
    row.state.revision = row.revision + 1;
    row.state.updated = Date.now();
    const saved = await roomRest(`code=eq.${code}&revision=eq.${row.revision}`, 'PATCH', {
      state: row.state, revision: row.state.revision, summary: fullSummary(row.state), updated_at: new Date().toISOString(),
    });
    if (saved.length) return result;
  }
  roomError('牌局正在同步，請稍候重試。', 503);
}
