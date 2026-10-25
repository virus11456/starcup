"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import '../full/full.css';
import './online.css';
type Room = { code: string; name: string; capacity: number; isHost: boolean; nickname: string };
function seatToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''); }
export default function OnlineGame() {
  const [name, setName] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const [nameError, setNameError] = useState('');
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
    if (busy) return;
    if (!name.trim()) {
      setNameError('請先填寫你的暱稱，才能建立或加入房間。');
      nameInput.current?.focus();
      return;
    }
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
      <section className="full-panel online-player" aria-labelledby="online-player-heading">
        <div><h2 id="online-player-heading">先設定你的暱稱</h2><p id="online-name-help">建立房間和加入朋友房間，都會使用這個暱稱。</p></div>
        <div><label>你的暱稱<input ref={nameInput} value={name} onChange={event => { setName(event.target.value); setNameError(''); }} maxLength={16} autoComplete="nickname" placeholder="請輸入暱稱（必填）" aria-required="true" aria-invalid={!!nameError} aria-describedby={nameError ? 'online-name-help online-name-error' : 'online-name-help'} /></label>
          {nameError && <p id="online-name-error" className="online-field-error" role="alert">{nameError}</p>}</div>
      </section>
      <div className="online-forms">
        <form className="full-panel" onSubmit={event => { event.preventDefault(); void enter('create'); }}><h2>建立新牌局</h2><p className="online-form-help">自己開房邀請朋友，不需要填寫房間碼。</p><label>房間名稱<input value={title} onChange={event => setTitle(event.target.value)} maxLength={24} required pattern=".*\S.*" title="請填寫房間名稱" /></label><label>牌局人數<select value={capacity} onChange={event => setCapacity(event.target.value)}><option value="4">4 人 · 2 對 2</option><option value="6">6 人 · 3 對 3</option><option value="8">8 人 · 4 對 4</option></select></label><button className="full-primary" disabled={busy}>{busy ? '正在連線…' : '建立房間 →'}</button></form>
        <form className="full-panel" onSubmit={event => { event.preventDefault(); void enter('join'); }}><h2>加入朋友房間</h2><p className="online-form-help">已有邀請碼？填入朋友分享的房間碼。</p><label>朋友的房間碼<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} required pattern="[A-Z2-9]{8}" title="請輸入 8 位英數字房間碼" placeholder="8 位英數字" autoCapitalize="characters" /></label><button className="full-primary" disabled={busy}>{busy ? '正在連線…' : '加入房間 →'}</button></form>
      </div>
      <aside className="full-panel online-notice"><h2>開始前的小提醒</h2><p>朋友入座後，由房主按「開始遊戲」。所有玩家都能從完整角色池自由選擇；先確認的玩家保留角色，其他玩家不能重複選取。空位由電腦選擇剩餘角色補上。</p><p>房主的頁面負責主持牌局，請保持開啟；房主重新整理或離開會結束牌局。其他玩家可用同一分頁的房間碼重新加入。手機切到背景可能暫停同步。</p><p>舊核心房間不會自動恢復，請在這裡建立新的完整角色房間。</p></aside>
    </>}
  </main>;
}
