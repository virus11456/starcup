"use client";
import { useState } from "react";
import Link from "next/link";
import InstallApp from './install-app';
type LobbyRoom = { code: string; name: string; host: string; count: number; capacity: number };
export default function Lobby({ rooms, connected, create, join, practice, refresh }: { rooms: LobbyRoom[]; connected: boolean; create: () => void; join: (code?: string) => void; practice: () => void; refresh: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = rooms.filter(r => `${r.name} ${r.code}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="portal-home">
    <section className="portal-hero">
      <div className="hero-constellation" aria-hidden="true">✧</div>
      <div className="portal-copy"><span className="portal-kicker"><i /> 新的傳說，等你開啟</span><h1>你的選擇，<br />成就<span>我們的傳說。</span></h1><p>選擇角色，掌握技能與回應時機。<br />在星杯的光芒下，打出你的逆轉一手。</p><div className="portal-actions"><Link className="portal-primary" href="/full">單人對電腦 <span>↗</span></Link><Link className="portal-secondary" href="/online">多人對戰 <span>↗</span></Link></div><div className="hero-footnote"><Link href="/full?view=characters">探索 68 位角色技能</Link><b aria-hidden="true">✦</b><span>4／6／8 人牌局</span></div></div>
      <div className="portal-art" aria-label="星杯傳說角色展示">
        <div className="art-orbit" /><figure className="hero-role role-left"><img src="/engine/image/character/fengYinShi.jpg" alt="封印師" /><figcaption>幻影聯盟 <strong>封印師</strong></figcaption></figure>
        <figure className="hero-role role-center"><img src="/engine/image/character/fengZhiJianSheng.jpg" alt="風之劍聖" fetchPriority="high" /><figcaption>戰技殿堂 <strong>風之劍聖</strong></figcaption></figure>
        <figure className="hero-role role-right"><img src="/engine/image/character/shengNv.jpg" alt="聖女" /><figcaption>神聖教廷 <strong>聖女</strong></figcaption></figure><span className="art-seal">✦<small>命運，由你出牌</small></span>
      </div>
    </section>
    <div className="portal-statbar"><span><b>68</b> 正式角色 <small>完整擴充模式</small></span><span><b>150</b> 張實體牌 <small>完整擴充牌庫</small></span><span><b>2</b> 大陣營 <small>共享士氣，並肩作戰</small></span><Link href="/learn">第一次來？從這裡開始 <span>→</span></Link></div>
    <section className="portal-modes" aria-labelledby="mode-heading"><div className="portal-section-heading"><div><span className="portal-kicker">選擇你的旅程</span><h2 id="mode-heading">選一種方式，踏入星界。</h2></div><p>與好友較量，或先與電腦練習。</p></div><div className="mode-grid">
      <Link className="mode-card expansion-card" href="/full"><span className="mode-icon">✧</span><small>角色對戰</small><h3>角色與擴充對戰</h3><p>角色技能、能量、治療與追加行動，<br />在完整牌局中找到你的戰鬥風格。</p><span className="mode-chip">主要模式 · 68 位角色 · 對電腦</span><b className="mode-arrow">↗</b></Link>
      <Link className="mode-card online-card" href="/online"><span className="mode-icon">⚔</span><small>多人角色對戰</small><h3>多人角色對戰</h3><p>與朋友使用完整角色與技能對戰。<br />與單機共用相同戰鬥引擎與畫面。</p><span className="mode-chip">完整角色技能 · 跨裝置連線</span><b className="mode-arrow">↗</b></Link>
      <Link className="mode-card academy-card" href="/learn"><span className="mode-icon">❖</span><small>認識星杯</small><h3>星杯學院</h3><p>從第一張牌開始，<br />讀懂傷害、應戰與勝利條件。</p><span className="mode-chip">步驟教學 · 規則查詢</span><b className="mode-arrow">↗</b></Link>
    </div></section>
    <section className="portal-room-section"><div className="portal-room-list"><div className="portal-section-heading"><div><span className="portal-kicker">冒險者大廳</span><h2>有人等你，一起出發。</h2></div><button className="portal-text-button" onClick={refresh}>重新整理 ↻</button></div><div className="portal-room-tools"><span className={connected ? "server-online" : "server-offline"}>● {connected ? "多人服務已就緒" : "正在連接服務"}</span><input aria-label="搜尋公開房間" placeholder="搜尋房間名稱或邀請碼" value={query} onChange={e => setQuery(e.target.value)} /></div>{filtered.length ? filtered.map(r => <button key={r.code} className="portal-room" onClick={() => join(r.code)}><span className="room-symbol">✦</span><span><strong>{r.name}</strong><small>{r.host} · {r.capacity / 2} 對 {r.capacity / 2} · 完整角色模式</small></span><span>{r.count} / {r.capacity} 人 →</span></button>) : <div className="portal-empty"><span>☾</span><div><h3>{query ? "還沒有符合的房間" : "戰場靜候，傳說將啟。"}</h3><p>{query ? "換個關鍵字，或直接輸入朋友的邀請碼。" : "目前沒有公開房間。邀請幾位朋友，開啟今晚的第一局。"}</p></div><button className="portal-secondary" onClick={create}>建立房間 ＋</button></div>}</div><aside className="portal-practice"><span className="portal-kicker">暖身練習</span><h3>先試一手？</h3><p>無需等待其他玩家，<br />用完整角色技能熟悉出牌與回應。</p><button onClick={practice}>開始快速練習 <span>→</span></button><small>單人對電腦 · 完整角色技能</small></aside></section>
    <section className="portal-archive"><div><span className="portal-kicker">每張牌，都有一段故事</span><h2>你的下一張王牌，<br />就在星之典。</h2><p>角色技能、卡牌效果與遊戲規則，隨時在站內查詢。</p></div><div className="archive-links"><Link href="/cards"><span>01</span><div><h3>卡牌與角色圖鑑</h3><p>搜尋牌面、角色、技能與正式擴充包</p></div><b>↗</b></Link><Link href="/rules"><span>02</span><div><h3>規則與常見問題</h3><p>查詢應戰、傷害、士氣與各模式差異</p></div><b>↗</b></Link></div></section>
    <InstallApp />
    <footer className="portal-footer"><span>星杯傳說</span><p>非官方同好作品 · 圖片與遊戲素材權利歸原權利人</p><Link href="/rules">版本與規則</Link></footer>
  </div>;
}
