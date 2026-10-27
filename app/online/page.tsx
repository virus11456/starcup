"use client";
import { useEffect, useRef, useState } from 'react';
import SiteBrand from '../site-brand';
import SiteHeader from '../site-header';
import { ACTIVE_ROOM_KEY, normalizeRoomCode, savedRoom, seatKey, shouldResumeRoom, roomInvite, resumeGuestRoom, resumeWaitingHost, enterOnlineRoom, roomRequestMessage, trustedHostPresence, replacementRoomSettings, type OnlineRoom as Room } from '@/lib/online-session';
import { createRoomRequests } from '@/lib/room-request';
import '../full/full.css';
import './online.css';
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
  const [hostAbsent, setHostAbsent] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const inviteDialog = useRef<HTMLDialogElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const [requests] = useState(() => createRoomRequests());
  function openRoom(next: Room, recoverWaiting = false) {
    setHostAbsent(false);
    sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(next));
    const url = new URL(location.href);
    url.searchParams.set('room', next.code);
    history.replaceState(history.state, '', url.pathname + url.search);
    const phone = url.searchParams.get('phone-layout') === '1';
    setLaunch('/engine/index.html?online=' + next.code + (phone ? '&phone-layout=1' : '') + (recoverWaiting ? '&recover=lobby' : ''));
    setInvite(roomInvite(location.origin, next.code));
    setRoom(next); setResume(null); setCopied(false); setShareMessage('');
  }
  useEffect(() => {
    try {
      try { setName(localStorage.getItem('grail-name-v1') || ''); } catch { /* Remembering a nickname is optional. */ }
      const raw = new URLSearchParams(location.search).get('room') || '';
      const invited = normalizeRoomCode(raw);
      setCode(invited);
      if (raw && !invited) setError('邀請連結的房間碼無效，請朋友重新分享。');
      const previous = savedRoom(sessionStorage);
      if (previous && (!raw || invited === previous.code)) {
        setResume(previous);
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (shouldResumeRoom(previous, invited, navigation?.type || 'navigate')) {
          void reconnect(previous);
        }
      }
    } catch { setError('瀏覽器無法保存座位，請允許此網站使用儲存空間後再試。'); }
    return () => requests.cancel();
  }, []);
  useEffect(() => {
    if (!room || room.isHost) return;
    const onPresence = (event: MessageEvent) => {
      const presence = trustedHostPresence(event, location.origin, frameRef.current?.contentWindow || null, room.code);
      if (presence !== null) setHostAbsent(presence === 'absent');
    };
    window.addEventListener('message', onPresence);
    return () => window.removeEventListener('message', onPresence);
  }, [room?.code, room?.isHost]);
  async function createAfterLostHost() {
    if (!room || room.isHost || busy || !hostAbsent) return;
    if (!confirm('這會建立另一個全新房間，沿用房間人數及你的暱稱，但無法保留舊局的角色、手牌、牌庫、回合或其他玩家座位。舊房間不會自動刪除，朋友需要新的邀請碼。確定重新開局？')) return;
    const original = room;
    const operation = requests.begin();
    if (!operation) return;
    setBusy(true); setError('');
    try {
      const next = await enterOnlineRoom(replacementRoomSettings(original), operation.signal);
      if (operation.current()) openRoom(next);
    } catch (error) { if (operation.current()) setError(roomRequestMessage(error, operation.signal)); }
    finally { if (operation.finish()) setBusy(false); }
  }
  useEffect(() => {
    if (!room?.isHost) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [room?.isHost]);
  async function reconnect(previous = resume) {
    if (!previous) return;
    const operation = requests.begin();
    if (!operation) return;
    setBusy(true); setError('');
    try {
      const restore = previous.isHost ? resumeWaitingHost : resumeGuestRoom;
      const next = await restore(previous, sessionStorage.getItem(seatKey(previous.code)) || '', operation.signal);
      if (operation.current()) openRoom(next, previous.isHost);
    }
    catch (error) { if (operation.current()) setError(roomRequestMessage(error, operation.signal)); }
    finally { if (operation.finish()) setBusy(false); }
  }
  async function enter(type: 'create' | 'join') {
    if (busy) return;
    if (!name.trim()) {
      setNameError('請先填寫你的暱稱，才能建立或加入房間。');
      nameInput.current?.focus();
      return;
    }
    const operation = requests.begin();
    if (!operation) return;
    setBusy(true); setError('');
    try {
      const next = await enterOnlineRoom({ type, code, name, title, capacity: Number(capacity) }, operation.signal);
      if (!operation.current()) return;
      try { localStorage.setItem('grail-name-v1', name.trim()); } catch { /* The seat credential is already saved in sessionStorage. */ }
      if (type === 'join' && next.isHost) {
        setResume(next);
        throw new Error('這是你主持的房間，請回到原本的分頁；若尚未開局，可使用「恢復等待房間」。');
      }
      openRoom(next);
    } catch (error) { if (operation.current()) setError(roomRequestMessage(error, operation.signal)); }
    finally { if (operation.finish()) setBusy(false); }
  }
  async function leave(target = room) {
    if (!target || !confirm(target.isHost ? '離開會結束所有玩家的牌局，確定返回？' : '確定離開牌局並返回？')) return;
    requests.cancel();
    const operation = requests.begin()!;
    // A service outage must not trap the player inside a retrying iframe.
    setRoom(null); setLaunch(''); setError(''); setResume(null); setCode(''); setHostAbsent(false); setBusy(true);
    try {
      const url = new URL(location.href); url.searchParams.delete('room');
      history.replaceState(history.state, '', url.pathname + url.search);
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      const response = await fetch('/api/full-room', { method: 'POST', signal: operation.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'leave', code: target.code, token: sessionStorage.getItem(seatKey(target.code)) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
    } catch (error) { if (operation.current()) setError('已返回；伺服器尚未確認離開操作。' + (error instanceof Error ? error.message : '請稍後再試。')); }
    finally { if (operation.finish()) setBusy(false); }
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
    {room ? <header className="full-header">
      <SiteBrand onClick={event => { event.preventDefault(); void leave(); }} />
      <span>{room.isHost ? '房主請保持頁面開啟' : '多人角色對戰'}</span>
      <nav><button onClick={() => inviteDialog.current?.showModal()}>邀請朋友</button><button onClick={() => void leave()}>離開</button></nav>
    </header> : <SiteHeader />}
    {error && <p role="alert" className="full-notice online-error">{error}</p>}
    {room ? <>
      {hostAbsent && !room.isHost && <section className="online-host-absent" aria-live="polite" aria-label="房主離線後的安全選項">
        <strong>房主已失聯，原局暫停</strong>
        <p>如果房主只是斷網，請等他回到原分頁。若分頁永久關閉，目前無法無損接手舊局。</p>
        <button type="button" disabled={busy} onClick={() => void createAfterLostHost()}>
          {busy ? '正在建立新房間…' : '另開新房間（從頭開始）'}
        </button>
      </section>}
      <iframe ref={frameRef} src={launch} className="full-frame" title="星杯傳說多人完整角色對戰" allow="fullscreen" />
      <dialog ref={inviteDialog} className="online-invite" aria-labelledby="online-invite-title">
        <h2 id="online-invite-title">邀請朋友加入</h2><p>{room.name} · 房間碼 <strong>{room.code}</strong></p>
        <p>朋友開啟連結後，先輸入網站密碼，再填暱稱並按「加入房間」。請在開局前邀請入座。</p>
        <label>房間連結<input ref={inviteInput} value={invite} readOnly onFocus={event => event.currentTarget.select()} /></label>
        <p role="status">{shareMessage}</p>
        <div><button onClick={() => void shareInvite()}>分享給朋友</button><button onClick={() => void copyInvite()}>{copied ? '已複製' : '複製連結'}</button><button onClick={() => inviteDialog.current?.close()}>關閉</button></div>
      </dialog></> : <>
      <section className="online-intro"><p className="full-kicker">星杯之約 · 與夥伴共寫戰局</p><h1>多人角色對戰</h1><p>與單機使用相同的角色技能、牌庫與戰鬥畫面。建立房間，再將邀請碼分享給朋友。</p></section>
      {resume && <section className="full-panel online-resume" aria-label="原房間連線">
        <h2>{resume.isHost ? '回到你主持的房間' : '回到原本的牌局'}</h2><p>{resume.name} · {resume.code}</p>
        <p>{resume.isHost ? '原分頁還在時請回原分頁。若尚未開始選角，原分頁離線滿 60 秒後可恢復等待房間，保留房間碼與已加入的玩家。已開始選角或對戰的牌局，仍需原房主分頁。' : '保留你原本的座位與角色；房主仍在線上時可以重新連接。'}</p>
        <button disabled={busy} onClick={() => void reconnect()}>{busy ? '正在恢復連線…' : resume.isHost ? '恢復等待房間' : '重新連接牌局'}</button>
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
