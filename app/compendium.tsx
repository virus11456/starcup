"use client";
import { useEffect, useState } from "react";
import { matchesCatalog } from "@/lib/catalog-search";
type Skill = { id: string; name: string; description: string };
type Role = { id: string; name: string; portrait: string; pack: string; packName: string; skills: Skill[] };
type Card = { id: string; name: string; type: string; portrait: string; description: string };
type Physical = { id: string; kind: string; faction: string; element: string; marks: string[] };
type Catalog = { characters: Role[]; cards: Card[]; deck: Physical[]; packs: Record<string, string> };
const labels: Record<string, string> = { an: "暗", guang: "光", shui: "水", huo: "火", feng: "風", lei: "雷", di: "地", sheng: "神聖教廷", xue: "鮮血議會", ji: "戰技殿堂", huan: "幻影聯盟", yong: "詠歌城" };
export default function Compendium() {
  const [catalog, setCatalog] = useState<Catalog | null>(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [view, setView] = useState("cards"), [pack, setPack] = useState("all");
  useEffect(() => { const controller = new AbortController(); fetch("/full-engine/catalog.json", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("圖鑑載入失敗，請重新整理。"); return r.json(); }).then(setCatalog).catch(e => { if (e.name !== "AbortError") setError(e.message); }); return () => controller.abort(); }, []);
  if (error) return <p role="alert" className="scope-banner">{error}</p>;
  if (!catalog) return <p role="status" className="scope-banner">正在打開星之典…</p>;
  const cardMap = new Map(catalog.cards.map(c => [c.id, c]));
  const skills = new Map(catalog.characters.flatMap(c => c.skills.map(s => [s.id, s.name] as const)));
  const roles = catalog.characters.filter(c => (pack === "all" || c.pack === pack) && matchesCatalog(`${c.name} ${c.packName} ${c.skills.map(s => s.name + " " + s.description).join(" ")}`, query));
  const cards = catalog.cards.filter(c => matchesCatalog(c.name + " " + c.description, query));
  const physicalText = (c: Physical) => `${cardMap.get(c.kind)?.name} ${labels[c.element] || c.element} ${labels[c.faction] || c.faction} ${c.marks.map(m => skills.get(m) || m).join(" ")}`;
  const physical = catalog.deck.filter(c => matchesCatalog(physicalText(c), query));
  return <><div className="compendium-tabs" aria-label="圖鑑類別">{[["cards", "11 種牌型"], ["roles", "68 位角色"], ["physical", "150 張牌庫"]].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); setQuery(""); }}>{label}</button>)}</div><div className="compendium-toolbar"><input aria-label="搜尋卡牌與角色" placeholder={view === "roles" ? "搜尋角色、技能或觸發條件…" : "搜尋牌名、效果、屬性…"} value={query} onChange={e => setQuery(e.target.value)} />{view === "roles" && <select aria-label="篩選正式擴充包" value={pack} onChange={e => setPack(e.target.value)}><option value="all">全部正式擴充</option>{Array.from(new Set(catalog.characters.map(c => c.pack))).map(p => <option key={p} value={p}>{catalog.packs[p]}</option>)}</select>}</div><p className="compendium-count">找到 {view === "roles" ? roles.length : view === "physical" ? physical.length : cards.length} 筆 · 正式擴充資料，排除社群同人</p>{view === "physical" ? <div className="physical-table"><table><thead><tr><th>編號</th><th>牌名</th><th>屬性</th><th>派系</th><th>技能標記</th></tr></thead><tbody>{physical.map(c => <tr key={c.id}><td>{c.id.replace("full-", "")}</td><td>{cardMap.get(c.kind)?.name}</td><td>{labels[c.element] || c.element}</td><td>{labels[c.faction] || c.faction}</td><td>{c.marks.map(m => skills.get(m) || m).join("、") || "—"}</td></tr>)}</tbody></table></div> : <div className="compendium-grid">{view === "roles" ? roles.map(c => <article key={c.id} className="compendium-card"><img src={c.portrait} alt={c.name} loading="lazy" /><h2>{c.name}</h2><small>{c.packName} · {c.skills.length} 項技能</small><details><summary>查看技能與觸發條件</summary>{c.skills.map(s => <div key={s.id}><h3>{s.name}</h3><p>{s.description}</p></div>)}</details></article>) : cards.map(c => <article key={c.id} className="compendium-card"><img src={c.portrait} alt={c.name} loading="lazy" /><h2>{c.name}</h2><small>{c.type === "gongJi" ? "攻擊" : "法術／回應"} · 牌庫中 {catalog.deck.filter(d => d.kind === c.id).length} 張</small><p>{c.description}</p></article>)}</div>}{!(view === "roles" ? roles.length : view === "physical" ? physical.length : cards.length) && <div className="portal-empty"><p>沒有符合的項目。試試較短的牌名或技能關鍵字。</p><button className="portal-secondary" onClick={() => { setQuery(""); setPack("all"); }}>清除篩選</button></div>}<div className="scope-banner">這裡顯示正式擴充的牌型、角色與技能摘要。核心多人模式的牌庫配比與角色功能不同，請搭配「遊戲規則」中的本版狀態閱讀。圖片為目前可取得素材，並非高清印刷原檔。</div></>;
}
