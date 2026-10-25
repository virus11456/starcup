"use client";
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Lobby from './lobby';
import SiteHeader from './site-header';
import { homeInvite, readLobby, type LobbyRoom } from '@/lib/lobby';
import { createRoomRequests } from '@/lib/room-request';
export default function Home() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests] = useState(() => createRoomRequests());
  const refresh = useCallback(async () => {
    const operation = requests.begin();
    if (!operation) return;
    setLoading(true); setError(''); setRooms([]); setConnected(false);
    try {
      const next = await readLobby(operation.signal);
      if (operation.current()) { setRooms(next); setConnected(true); }
    } catch (error) {
      if (operation.current()) setError(operation.signal.aborted
        ? '讀取房間清單逾時，請稍後重新整理。'
        : error instanceof Error && !(error instanceof TypeError) ? error.message : '暫時無法取得房間，請檢查網路後再試。');
    } finally { if (operation.finish()) setLoading(false); }
  }, [requests]);
  useEffect(() => {
    const invite = homeInvite(location.search);
    if (invite) router.replace(invite);
    else void refresh();
    return () => requests.cancel();
  }, [refresh, router, requests]);
  return <div className="portal-mode">
    <SiteHeader />
    <main className="portal-content">
      {error && <p className="portal-notice" role="alert">{error}</p>}
      <Lobby rooms={rooms} connected={connected} loading={loading}
        create={() => router.push('/online')} join={code => router.push('/online' + (code ? '?room=' + encodeURIComponent(code) : ''))}
        practice={() => router.push('/full')} refresh={refresh} />
    </main>
  </div>;
}
