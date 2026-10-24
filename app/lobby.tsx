"use client";
import { useState } from "react";
import Link from "next/link";
type LobbyRoom = { code: string; name: string; host: string; count: number; capacity: number };
export default function Lobby({ rooms, connected, create, join, practice, refresh }: { rooms: LobbyRoom[]; connected: boolean; create: () => void; join: (code?: string) => void; practice: () => void; refresh: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = rooms.filter(r => `${r.name} ${r.code}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="portal-home">
    <section className="portal-hero">
      <div className="hero-constellation" aria-hidden="true">✧</div>
      <div className="portal-copy"><span className="portal-kicker"><i /> A NEW CHAPTER AWAITS</span><h1>你的選擇，<br />成就<span>我們的傳說。</span></h1><p>一張卡牌，一次逆轉。<br />與夥伴並肩，在星杯的光芒下展開對決。</p><div className="portal-actions"><button className="portal-primary" onClick={create}>建立多人房間 <span>↗</span></button><button className="portal-secondary" onClick={() => join()}>輸入邀請碼</button></div><div className="hero-footnote"><span>4／6／8 人組隊</span><b>✦</b><span>免下載 · 瀏覽器遊玩</span></div></div>
      <div className="portal-art" aria-label="星杯傳說角色展示">
        <div className="art-orbit" /><figure className="hero-role role-left"><img src="/engine/image/character/fengYinShi.jpg" alt="封印師" /><figcaption>幻影聯盟 <strong>封印師</strong></figcaption></figure>
        <figure className="hero-role role-center"><img src="/engine/image/character/fengZhiJianSheng.jpg" alt="風之劍聖" fetchPriority="high" /><figcaption>戰技殿堂 <strong>風之劍聖</strong></figcaption></figure>
        <figure className="hero-role role-right"><img src="/engine/image/character/shengNv.jpg" alt="聖女" /><figcaption>神聖教廷 <strong>聖女</strong></figcaption></figure><span className="art-seal">✦<small>命運，由你出牌</small></span>
      </div>
    </section>
    <div className="portal-statbar"><span><b>68</b> 正式角色 <small>完整擴充模式</small></span><span><b>150</b> 張實體牌 <small>完整擴充牌庫</small></span><span><b>2</b> 大陣營 <small>共享士氣，並肩作戰</small></span><Link href="/learn">第一次來？從這裡開始 <span>→</span></Link></div>
    <section className="portal-modes" aria-labelledby="mode-heading"><div className="portal-section-heading"><div><span className="portal-kicker">CHOOSE YOUR JOURNEY</span><h2 id="mode-heading">選一種方式，踏入星界。</h2></div><p>與好友較量，或先與電腦練習。</p></div><div className="mode-grid">
      <button className="mode-card online-card" onClick={create}><span className="mode-icon">⚔</span><small>PLAY TOGETHER</small><h3>好友連線對戰</h3><p>建立房間、分享邀請碼，<br />讓下一次應戰成為團隊的轉機。</p><span className="mode-chip">核心規則 · 跨裝置連線</span><b className="mode-arrow">↗</b></button>
      <Link className="mode-card expansion-card" href="/full"><span className="mode-icon">✧</span><small>MEET YOUR HERO</small><h3>完整擴充試煉</h3><p>選擇正式角色，探索專屬技能，<br />找到屬於你的戰鬥風格。</p><span className="mode-chip">68 位角色 · 單人對 AI</span><b className="mode-arrow">↗</b></Link>
      <Link className="mode-card academy-card" href="/learn"><span className="mode-icon">❖</span><small>LEARN THE GAME</small><h3>星杯學院</h3><p>從第一張牌開始，<br />讀懂傷害、應戰與勝利條件。</p><span className="mode-chip">步驟教學 · 規則查詢</span><b className="mode-arrow">↗</b></Link>
    </div></section>
    <section className="portal-room-section"><div className="portal-room-list"><div className="portal-section-heading"><div><span className="portal-kicker">THE TAVERN</span><h2>有人等你，一起出發。</h2></div><button className="portal-text-button" onClick={refresh}>重新整理 ↻</button></div><div className="portal-room-tools"><span className={connected ? "server-online" : "server-offline"}>● {connected ? "多人服務已就緒" : "正在連接服務"}</span><input aria-label="搜尋公開房間" placeholder="搜尋房間名稱或邀請碼" value={query} onChange={e => setQuery(e.target.value)} /></div>{filtered.length ? filtered.map(r => <button key={r.code} className="portal-room" onClick={() => join(r.code)}><span className="room-symbol">✦</span><span><strong>{r.name}</strong><small>{r.host} · {r.capacity / 2} 對 {r.capacity / 2} · 核心模式</small></span><span>{r.count} / {r.capacity} 人 →</span></button>) : <div className="portal-empty"><span>☾</span><div><h3>{query ? "還沒有符合的房間" : "戰場靜候，傳說將啟。"}</h3><p>{query ? "換個關鍵字，或直接輸入朋友的邀請碼。" : "目前沒有公開房間。邀請幾位朋友，開啟今晚的第一局。"}</p></div><button className="portal-secondary" onClick={create}>建立房間 ＋</button></div>}</div><aside className="portal-practice"><span className="portal-kicker">WARM UP</span><h3>先試一手？</h3><p>無需等待其他玩家，<br />用核心規則熟悉出牌與回應。</p><button onClick={practice}>開始快速練習 <span>→</span></button><small>單人對 AI · 角色技能不參與核心結算</small></aside></section>
    <section className="portal-archive"><div><span className="portal-kicker">EVERY CARD TELLS A STORY</span><h2>你的下一張王牌，<br />就在星之典。</h2><p>角色技能、卡牌效果與遊戲規則，隨時在站內查詢。</p></div><div className="archive-links"><Link href="/cards"><span>01</span><div><h3>卡牌與角色圖鑑</h3><p>搜尋牌面、角色、技能與正式擴充包</p></div><b>↗</b></Link><Link href="/rules"><span>02</span><div><h3>規則與常見問題</h3><p>查詢應戰、傷害、士氣與各模式差異</p></div><b>↗</b></Link></div></section>
    <footer className="portal-footer"><span>✦ 星杯傳說 Online</span><p>非官方同好作品 · 圖片與遊戲素材權利歸原權利人</p><Link href="/rules">版本與規則</Link></footer>
  </div>;
}
