"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../full/full.css';
import './online.css';
type Room = { code: string; name: string; capacity: number; isHost: boolean; nickname: string };
function seatToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''); }
export default function OnlineGame() {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('星杯之約');
  const [capacity, setCapacity] = useState('4');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [launch, setLaunch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setName(localStorage.getItem('grail-name-v1') || '');
    setCode((new URLSearchParams(location.search).get('room') || '').toUpperCase());
  }, []);
  async function enter(type: 'create' | 'join') {
    setBusy(true); setError('');
    try {
      const token = type === 'join' ? sessionStorage.getItem('grail-full-seat-' + code) || seatToken() : seatToken();
      const response = await fetch('/api/full-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, token, code: code.trim().toUpperCase(), name, title, capacity: Number(capacity) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法進入房間。');
      sessionStorage.setItem('grail-full-seat-' + data.room.code, token);
      localStorage.setItem('grail-name-v1', name.trim());
      const phone = new URLSearchParams(location.search).get('phone-layout') === '1';
      setLaunch('/engine/index.html?online=' + data.room.code + (phone ? '&phone-layout=1' : ''));
      setRoom(data.room);
    } catch (error) { setError(error instanceof Error ? error.message : '無法進入房間。'); }
    finally { setBusy(false); }
  }
  async function leave() {
    if (!room || !confirm(room.isHost ? '離開會結束所有玩家的牌局，確定返回？' : '確定離開牌局並返回？')) return;
    try {
      const response = await fetch('/api/full-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'leave', code: room.code, token: sessionStorage.getItem('grail-full-seat-' + room.code) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      setRoom(null); setLaunch(''); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : '離開失敗，請再試一次。'); }
  }
  async function copyInvite() {
    if (!room) return;
    try { await navigator.clipboard.writeText(location.origin + '/online?room=' + room.code); setCopied(true); }
    catch { setError('無法自動複製，請將上方的 8 位房間碼傳給朋友。'); }
  }
  return <main className={'full-shell online-shell' + (room ? ' full-running' : '')}>
    <header className="full-header"><Link href="/" onClick={event => { if (room) { event.preventDefault(); void leave(); } }}>星杯傳說</Link>
      <span>{room ? (room.isHost ? '房主請保持頁面開啟' : '多人角色對戰') : '與單機共用完整角色引擎'}</span>
      <nav>{room ? <><button onClick={copyInvite} aria-label="複製房間邀請">{copied ? '已複製' : room.code}</button><button onClick={leave}>離開</button></> : <Link href="/">返回大廳</Link>}</nav>
    </header>
    {error && <p role="alert" className="full-notice online-error">{error}</p>}
    {room ? <iframe src={launch} className="full-frame" title="星杯傳說多人完整角色對戰" allow="fullscreen" /> : <>
      <section className="online-intro"><p className="full-kicker">星杯之約 · 與夥伴共寫戰局</p><h1>多人角色對戰</h1><p>與單機使用相同的角色技能、牌庫與戰鬥畫面。建立房間，再將邀請碼分享給朋友。</p></section>
      <div className="online-forms"><section className="full-panel"><h2>準備加入</h2><label>你的暱稱<input value={name} onChange={event => setName(event.target.value)} maxLength={16} autoComplete="nickname" placeholder="請輸入暱稱" /></label>
        <form onSubmit={event => { event.preventDefault(); void enter('join'); }}><label>朋友的房間碼<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} placeholder="8 位英數字" autoCapitalize="characters" /></label><button className="full-primary" disabled={busy || !name.trim() || code.trim().length !== 8}>加入房間 →</button></form></section>
      <form className="full-panel" onSubmit={event => { event.preventDefault(); void enter('create'); }}><h2>建立新牌局</h2><label>房間名稱<input value={title} onChange={event => setTitle(event.target.value)} maxLength={24} /></label><label>牌局人數<select value={capacity} onChange={event => setCapacity(event.target.value)}><option value="4">4 人 · 2 對 2</option><option value="6">6 人 · 3 對 3</option><option value="8">8 人 · 4 對 4</option></select></label><button className="full-primary" disabled={busy || !name.trim() || !title.trim()}>建立房間 →</button></form></div>
      <aside className="full-panel online-notice"><h2>開始前的小提醒</h2><p>朋友入座後，由房主按「開始遊戲」，空位由電腦補上。每人隨機取得 5 名候選角色，同場角色不重複。</p><p>房主的頁面負責主持牌局，請保持開啟；房主重新整理或離開會結束牌局。其他玩家可用同一分頁的房間碼重新加入。手機切到背景可能暫停同步。</p><p>舊核心房間不會自動恢復，請在這裡建立新的完整角色房間。</p></aside>
    </>}
  </main>;
}
