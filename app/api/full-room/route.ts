import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, PRIVATE_CACHE, validAccessToken } from '@/lib/site-access';
import { GameError } from '@/lib/game';
import { hash, newToken, configured } from '@/lib/store';
import { creationCode } from '@/lib/room-creation';
import { attachFullRoom, createFullRoom, fullView, joinFullRoom, memberFor, relayView, roomError, syncFullRoom } from '@/lib/full-room';
import { changeFullRoom, insertFullRoom, listFullRooms } from '@/lib/full-store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': PRIVATE_CACHE } });
}
function allowed(req: NextRequest) { return validAccessToken(req.cookies.get(ACCESS_COOKIE)?.value); }
export async function GET(req: NextRequest) {
  if (!allowed(req)) return respond({ error: '請先輸入網站密碼。' }, 401);
  try { return respond({ rooms: configured() ? await listFullRooms() : [], configured: configured() }); }
  catch { return respond({ error: '房間服務暫時無法連線。' }, 503); }
}
export async function POST(req: NextRequest) {
  if (!allowed(req)) return respond({ error: '請先輸入網站密碼。' }, 401);
  try {
    const origin = req.headers.get('origin');
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== req.headers.get('host'))) roomError('無法接受跨網站操作。', 403);
    const text = await req.text();
    if (text.length > 650_000) roomError('請求過大。', 413);
    let body;
    try { body = JSON.parse(text); } catch { roomError('請求格式無效。'); }
    if (!body || typeof body !== 'object' || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) roomError('玩家識別無效，請重新加入房間。', 403);
    // A random per-tab bearer credential lets a shared device hold distinct
    // seats, without exposing any database key or putting credentials in URLs.
    const auth = hash(body.token);
    if (body.type === 'create') {
      const room = createFullRoom(creationCode(auth, process.env.GRAIL_SERVER_SECRET), auth, body.name, body.title, body.capacity);
      const creator = hash((req.headers.get('x-forwarded-for')?.split(',')[0] || auth) + process.env.GRAIL_SERVER_SECRET);
      const created = await insertFullRoom(room, creator);
      return respond({ room: fullView(created, auth) });
    }
    const result = await changeFullRoom<unknown>(body.code, room => {
      if (body.type === 'join') { joinFullRoom(room, auth, body.name, newToken().slice(0, 16)); return { changed: true, result: { room: fullView(room, auth) } }; }
      if (body.type === 'attach') { attachFullRoom(room, auth, body.connection); return { changed: true, result: relayView(room, auth) }; }
      if (body.type === 'sync') { const changed = syncFullRoom(room, auth, body); return { changed, result: relayView(room, auth) }; }
      if (body.type === 'leave') {
        const member = memberFor(room, auth);
        if (member.id === '1') { room.status = 'closed'; room.messages = []; }
        else { member.connection = ''; member.seen = 0; if (room.status === 'waiting') room.members = room.members.filter(m => m !== member); }
        return { changed: true, result: { left: true } };
      }
      roomError('未知的房間操作。');
    });
    return respond(result);
  } catch (error) {
    if (error instanceof GameError) return respond({ error: error.message }, error.status);
    console.error('Full room request failed:', error instanceof Error ? error.name : 'unknown');
    return respond({ error: '房間同步失敗，請稍後重試。' }, 500);
  }
}
