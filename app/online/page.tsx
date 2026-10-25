"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ACTIVE_ROOM_KEY, normalizeRoomCode, savedRoom, seatKey, shouldResumeRoom, roomInvite, resumeGuestRoom, type OnlineRoom as Room } from '@/lib/online-session';
import '../full/full.css';
import './online.css';
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
  const [resume, setResume] = useState<Room | null>(null);
  const [invite, setInvite] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const inviteDialog = useRef<HTMLDialogElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  function openRoom(next: Room) {
    sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(next));
    const url = new URL(location.href);
    url.searchParams.set('room', next.code);
    history.replaceState(history.state, '', url.pathname + url.search);
    const phone = url.searchParams.get('phone-layout') === '1';
    setLaunch('/engine/index.html?online=' + next.code + (phone ? '&phone-layout=1' : ''));
    setInvite(roomInvite(location.origin, next.code));
    setRoom(next); setResume(null); setCopied(false); setShareMessage('');
  }
  useEffect(() => {
    const controller = new AbortController();
    try {
      setName(localStorage.getItem('grail-name-v1') || '');
      const raw = new URLSearchParams(location.search).get('room') || '';
      const invited = normalizeRoomCode(raw);
      setCode(invited);
      if (raw && !invited) setError('邀請連結的房間碼無效，請朋友重新分享。');
      const previous = savedRoom(sessionStorage);
      if (previous && (!raw || invited === previous.code)) {
        setResume(previous);
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (shouldResumeRoom(previous, invited, navigation?.type || 'navigate')) {
          setBusy(true);
          resumeGuestRoom(previous, sessionStorage.getItem(seatKey(previous.code))!,
            AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
            .then(next => { if (!controller.signal.aborted) openRoom(next); })
            .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '重連失敗，請再試一次。'); })
            .finally(() => { if (!controller.signal.aborted) setBusy(false); });
        }
      }
    } catch { setError('瀏覽器無法保存座位，請允許此網站使用儲存空間後再試。'); }
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!room?.isHost) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [room?.isHost]);
  async function reconnect() {
    if (!resume || busy) return;
    setBusy(true); setError('');
    try { openRoom(await resumeGuestRoom(resume, sessionStorage.getItem(seatKey(resume.code)) || '', AbortSignal.timeout(15_000))); }
    catch (error) { setError(error instanceof Error ? error.message : '重連失敗，請再試一次。'); }
    finally { setBusy(false); }
  }
  async function enter(type: 'create' | 'join') {
    if (busy) return;
    if (!name.trim()) {
      setNameError('請先填寫你的暱稱，才能建立或加入房間。');
      nameInput.current?.focus();
      return;
    }
    setBusy(true); setError('');
    try {
      const normalized = normalizeRoomCode(code);
      if (type === 'join' && !normalized) throw new Error('請輸入 8 位英數字房間碼。');
      const token = type === 'join' ? sessionStorage.getItem(seatKey(normalized)) || seatToken() : seatToken();
      const response = await fetch('/api/full-room', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, token, code: normalized, name, title, capacity: Number(capacity) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法進入房間。');
      sessionStorage.setItem(seatKey(data.room.code), token);
      localStorage.setItem('grail-name-v1', name.trim());
      if (type === 'join' && data.room.isHost) {
        setResume(data.room);
        throw new Error('這是你主持的房間，請回到原本的分頁。房主重新整理後尚無法恢復牌局；可結束舊房間後重新開房。');
      }
      openRoom(data.room);
    } catch (error) { setError(error instanceof Error ? error.message : '無法進入房間。'); }
    finally { setBusy(false); }
  }
  async function leave(target = room) {
    if (!target || !confirm(target.isHost ? '離開會結束所有玩家的牌局，確定返回？' : '確定離開牌局並返回？')) return;
    // A service outage must not trap the player inside a retrying iframe.
    setRoom(null); setLaunch(''); setError(''); setResume(null); setCode('');
    sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    const url = new URL(location.href); url.searchParams.delete('room');
    history.replaceState(history.state, '', url.pathname + url.search);
    try {
      const response = await fetch('/api/full-room', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'leave', code: target.code, token: sessionStorage.getItem(seatKey(target.code)) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
    } catch (error) { setError('已返回；伺服器尚未確認離開操作。' + (error instanceof Error ? error.message : '請稍後再試。')); }
  }
  async function copyInvite() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); setCopied(true); setShareMessage('連結已複製，貼給朋友即可。'); }
    catch { inviteInput.current?.focus(); inviteInput.current?.select(); setShareMessage('請長按下方連結，選擇「複製」，再貼給朋友。'); }
  }
  async function shareInvite() {
    if (!room || !invite) return;
    if (!navigator.share) { await copyInvite(); return; }
    try { await navigator.share({ title: '星杯傳說・' + room.name, text: '一起加入星杯牌局，房間碼：' + room.code, url: invite }); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setShareMessage('無法開啟分享選單，請使用「複製連結」或長按連結複製。'); }
  }
  return <main className={'full-shell online-shell' + (room ? ' full-running' : '')}>
    <header className="full-header"><Link href="/" onClick={event => { if (room) { event.preventDefault(); void leave(); } }}>星杯傳說</Link>
      <span>{room ? (room.isHost ? '房主請保持頁面開啟' : '多人角色對戰') : '與單機共用完整角色引擎'}</span>
      <nav>{room ? <><button onClick={() => inviteDialog.current?.showModal()}>邀請朋友</button><button onClick={() => void leave()}>離開</button></> : <Link href="/">返回大廳</Link>}</nav>
    </header>
    {error && <p role="alert" className="full-notice online-error">{error}</p>}
    {room ? <><iframe src={launch} className="full-frame" title="星杯傳說多人完整角色對戰" allow="fullscreen" />
      <dialog ref={inviteDialog} className="online-invite" aria-labelledby="online-invite-title">
        <h2 id="online-invite-title">邀請朋友加入</h2><p>{room.name} · 房間碼 <strong>{room.code}</strong></p>
        <p>朋友開啟連結後，先輸入網站密碼，再填暱稱並按「加入房間」。請在開局前邀請入座。</p>
        <label>房間連結<input ref={inviteInput} value={invite} readOnly onFocus={event => event.currentTarget.select()} /></label>
        <p role="status">{shareMessage}</p>
        <div><button onClick={() => void shareInvite()}>分享給朋友</button><button onClick={() => void copyInvite()}>{copied ? '已複製' : '複製連結'}</button><button onClick={() => inviteDialog.current?.close()}>關閉</button></div>
      </dialog></> : <>
      <section className="online-intro"><p className="full-kicker">星杯之約 · 與夥伴共寫戰局</p><h1>多人角色對戰</h1><p>與單機使用相同的角色技能、牌庫與戰鬥畫面。建立房間，再將邀請碼分享給朋友。</p></section>
      {resume && <section className="full-panel online-resume" aria-label="原房間連線">
        <h2>{resume.isHost ? '房主牌局需要原分頁' : '回到原本的牌局'}</h2><p>{resume.name} · {resume.code}</p>
        <p>{resume.isHost ? '暫時切換分頁後，請回到原分頁繼續。若已重新整理或關閉分頁，目前無法恢復房主的牌局狀態。' : '保留你原本的座位與角色；房主仍在線上時可以重新連接。'}</p>
        {!resume.isHost && <button disabled={busy} onClick={() => void reconnect()}>{busy ? '正在恢復連線…' : '重新連接牌局'}</button>}
        <button disabled={busy} onClick={() => void leave(resume)}>{resume.isHost ? '結束舊房間' : '離開原房間'}</button>
      </section>}
      <section className="full-panel online-player" aria-labelledby="online-player-heading">
        <div><h2 id="online-player-heading">先設定你的暱稱</h2><p id="online-name-help">建立房間和加入朋友房間，都會使用這個暱稱。</p></div>
        <div><label>你的暱稱<input ref={nameInput} value={name} onChange={event => { setName(event.target.value); setNameError(''); }} maxLength={16} autoComplete="nickname" placeholder="請輸入暱稱（必填）" aria-required="true" aria-invalid={!!nameError} aria-describedby={nameError ? 'online-name-help online-name-error' : 'online-name-help'} /></label>
          {nameError && <p id="online-name-error" className="online-field-error" role="alert">{nameError}</p>}</div>
      </section>
      <div className="online-forms">
        <form className="full-panel" onSubmit={event => { event.preventDefault(); void enter('create'); }}><h2>建立新牌局</h2><p className="online-form-help">自己開房邀請朋友，不需要填寫房間碼。</p><label>房間名稱<input value={title} onChange={event => setTitle(event.target.value)} maxLength={24} required pattern=".*\S.*" title="請填寫房間名稱" /></label><label>牌局人數<select value={capacity} onChange={event => setCapacity(event.target.value)}><option value="4">4 人 · 2 對 2</option><option value="6">6 人 · 3 對 3</option><option value="8">8 人 · 4 對 4</option></select></label><button className="full-primary" disabled={busy}>{busy ? '正在連線…' : '建立房間 →'}</button></form>
        <form className="full-panel" onSubmit={event => { event.preventDefault(); void enter('join'); }}><h2>加入朋友房間</h2><p className="online-form-help">{code ? '已帶入房間碼，填好暱稱後按下方按鈕加入。' : '已有邀請碼？填入朋友分享的房間碼。'}</p><label>朋友的房間碼<input value={code} onChange={event => setCode(event.target.value.toUpperCase().trim())} maxLength={8} required pattern="[A-Z2-9]{8}" title="請輸入 8 位英數字房間碼" placeholder="8 位英數字" autoCapitalize="characters" /></label><button className="full-primary" disabled={busy}>{busy ? '正在連線…' : '加入房間 →'}</button></form>
      </div>
      <aside className="full-panel online-notice"><h2>開始前的小提醒</h2><p>朋友入座後，由房主按「開始遊戲」。所有玩家都能從完整角色池自由選擇；先確認的玩家保留角色，其他玩家不能重複選取。空位由電腦選擇剩餘角色補上。</p><p>房主的頁面負責主持牌局，請保持開啟，避免重新整理。其他玩家在同一分頁重新整理時會嘗試恢復原座位；回到此頁也可按「重新連接牌局」。手機切到背景可能暫停同步，回到原分頁會重試連線；分頁被系統回收後無法恢復房主狀態。</p><p>舊核心房間不會自動恢復，請在這裡建立新的完整角色房間。</p></aside>
    </>}
  </main>;
}
