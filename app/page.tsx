"use client";
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Lobby from './lobby';
import SiteHeader from './site-header';
type Room = { code: string; name: string; host: string; count: number; capacity: number };
export default function Home() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/full-room', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '暫時無法取得房間。');
      setRooms(data.rooms); setConnected(data.configured); setError('');
    } catch (error) { setConnected(false); setError(error instanceof Error ? error.message : '暫時無法取得房間。'); }
  }, []);
  useEffect(() => {
    // Retire only the legacy automatic-resume pointer, not user preferences.
    localStorage.removeItem('grail-room-v1');
    const invite = new URLSearchParams(location.search).get('room');
    if (invite) { router.replace('/online?room=' + encodeURIComponent(invite)); return; }
    void refresh();
  }, [refresh, router]);
  return <div className="portal-mode">
    <SiteHeader />
    <main className="portal-content">
      {error && <p className="portal-notice" role="alert">{error}</p>}
      <Lobby rooms={rooms} connected={connected}
        create={() => router.push('/online')} join={code => router.push('/online' + (code ? '?room=' + encodeURIComponent(code) : ''))}
        practice={() => router.push('/full')} refresh={refresh} />
    </main>
  </div>;
}
