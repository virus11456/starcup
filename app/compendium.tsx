"use client";
import { useEffect, useState } from "react";
import { matchesCatalog } from "@/lib/catalog-search";
import { WIKI } from "@/lib/wiki-reference";
type Skill = { id: string; name: string; description: string };
type Source = { title: string; url: string };
type Role = { id: string; name: string; aliases?: string[]; portrait: string; pack: string; packName: string; skills: Skill[]; source: string; reviewNote?: string };
type Card = { id: string; name: string; type: string; portrait: string; description: string; sources?: Source[] };
type Physical = { id: string; kind: string; faction: string; element: string; marks: string[] };
type Catalog = { characters: Role[]; cards: Card[]; deck: Physical[]; packs: Record<string, string>; skillMarks?: Record<string, Skill> };
const labels: Record<string, string> = { an: "暗", guang: "光", shui: "水", huo: "火", feng: "風", lei: "雷", di: "地", sheng: "神聖教廷", xue: "鮮血議會", ji: "戰技殿堂", huan: "幻影聯盟", yong: "詠歌城" };
type View = "cards" | "roles" | "physical";
export default function Compendium({ initialView = "physical" }: { initialView?: View }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [view, setView] = useState<View>(initialView), [pack, setPack] = useState("all");
  const [element, setElement] = useState("all"), [faction, setFaction] = useState("all"), [presentation, setPresentation] = useState("grid");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/full-engine/catalog.json", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("圖鑑載入失敗，請重新整理。"); return r.json(); }).then(setCatalog).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert" className="scope-banner">{error}</p>;
  if (!catalog) return <p role="status" className="scope-banner">正在打開星之典…</p>;
  const cardMap = new Map(catalog.cards.map(c => [c.id, c]));
  const skills = new Map(catalog.characters.flatMap(c => c.skills.map(s => [s.id, s] as const)));
  const mark = (id: string) => catalog.skillMarks?.[id] || skills.get(id);
  const roles = catalog.characters.filter(c => (pack === "all" || c.pack === pack) && matchesCatalog(`${c.name} ${c.aliases?.join(" ") || ""} ${c.packName} ${c.skills.map(s => s.name + " " + s.description).join(" ")}`, query));
  const cards = catalog.cards.filter(c => matchesCatalog(c.name + " " + c.description, query));
  const physicalText = (c: Physical) => `${c.id.replace("full-", "")} ${cardMap.get(c.kind)?.name} ${cardMap.get(c.kind)?.description} ${labels[c.element] || c.element} ${labels[c.faction] || c.faction} ${c.marks.map(m => mark(m)?.name || m).join(" ")}`;
  const physical = catalog.deck.filter(c => (element === "all" || c.element === element) && (faction === "all" || c.faction === faction) && matchesCatalog(physicalText(c), query));
  const count = view === "roles" ? roles.length : view === "physical" ? physical.length : cards.length;
  const clear = () => { setQuery(""); setPack("all"); setElement("all"); setFaction("all"); };
  const sourceLinks = (sources: Source[] = []) => <div className="catalog-sources">{sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">百科 · {s.title} ↗</a>)}</div>;
  return <>
    <div className="catalog-explanation"><strong>150 張實體牌，11 種基礎牌型。</strong><p>相同牌名會出現多張；每張的屬性、派系與獨有技標記可能不同。下方逐張列出完整牌庫。角色卡與角色專屬效果另列於角色圖鑑，不計入這 150 張。</p><a href={WIKI.guides.deck.url} target="_blank" rel="noreferrer">主要依據：{WIKI.name} · 牌庫構造 ↗</a></div>
    <div className="compendium-tabs" aria-label="圖鑑類別">{([["physical", `${catalog.deck.length} 張逐張查詢`], ["cards", `${catalog.cards.length} 種牌型總覽`], ["roles", `${catalog.characters.length} 位角色與技能`]] as [View, string][]).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); clear(); }}>{label}</button>)}</div>
    <div className="compendium-toolbar">
      <input aria-label="搜尋卡牌與角色" placeholder={view === "roles" ? "搜尋角色、技能或觸發條件…" : "搜尋牌名、效果、派系或技能標記…"} value={query} onChange={e => setQuery(e.target.value)} />
      {view === "roles" && <select aria-label="篩選正式擴充包" value={pack} onChange={e => setPack(e.target.value)}><option value="all">全部正式擴充</option>{Array.from(new Set(catalog.characters.map(c => c.pack))).map(p => <option key={p} value={p}>{catalog.packs[p]}</option>)}</select>}
      {view === "physical" && <><select aria-label="篩選卡牌屬性" value={element} onChange={e => setElement(e.target.value)}><option value="all">全部屬性</option>{["huo", "shui", "feng", "di", "lei", "an", "guang"].map(id => <option key={id} value={id}>{labels[id]}系</option>)}</select><select aria-label="篩選卡牌派系" value={faction} onChange={e => setFaction(e.target.value)}><option value="all">全部派系</option>{["xue", "yong", "ji", "sheng", "huan"].map(id => <option key={id} value={id}>{labels[id]}</option>)}</select></>}
    </div>
    <div className="catalog-result-bar"><p className="compendium-count" role="status">顯示 {count} / {view === "roles" ? catalog.characters.length : view === "physical" ? catalog.deck.length : catalog.cards.length} {view === "roles" ? "位角色" : view === "physical" ? "張實體牌" : "種牌型"}</p>{view === "physical" && <div className="catalog-view-switch"><button aria-pressed={presentation === "grid"} onClick={() => setPresentation("grid")}>卡片</button><button aria-pressed={presentation === "table"} onClick={() => setPresentation("table")}>表格</button></div>}</div>
    {view === "physical" && presentation === "table" ? <div className="physical-table"><table><thead><tr><th>編號</th><th>牌名</th><th>屬性</th><th>派系</th><th>技能標記</th></tr></thead><tbody>{physical.map(c => <tr key={c.id}><td>{c.id.replace("full-", "")}</td><td>{cardMap.get(c.kind)?.name}</td><td>{labels[c.element] || c.element}</td><td>{labels[c.faction] || c.faction}</td><td>{c.marks.map(m => mark(m)?.name || m).join("、") || "無"}</td></tr>)}</tbody></table></div> : <div className="compendium-grid">
      {view === "roles" ? roles.map(c => <article key={c.id} className="compendium-card"><img src={c.portrait} alt={c.name} loading="lazy" /><h2>{c.name}</h2><small>{c.packName} · {c.skills.length} 項技能</small><details><summary>查看技能與觸發條件</summary><p className="catalog-review-note">{c.reviewNote || "技能交互仍待逐項核對。"}</p>{c.skills.map(s => <div key={s.id}><h3>{s.name}</h3><p>{s.description}</p></div>)}</details><a className="catalog-source" href={c.source} target="_blank" rel="noreferrer">百科角色詳情與裁定 ↗</a></article>)
      : view === "cards" ? cards.map(c => <article key={c.id} className="compendium-card"><img src={c.portrait} alt={c.name} loading="lazy" /><h2>{c.name}</h2><small>{c.type === "gongJi" ? "攻擊" : "法術／回應"} · 牌庫中 {catalog.deck.filter(d => d.kind === c.id).length} 張</small><p>{c.description}</p>{sourceLinks(c.sources)}</article>)
      : physical.map(c => { const type = cardMap.get(c.kind)!; return <article key={c.id} className="compendium-card physical-card" data-card-entry={c.id}>
        <div className="physical-card-art"><img src={type.portrait} alt={`${type.name} · ${labels[c.element]}系 · ${labels[c.faction]}`} loading="lazy" /><span className="physical-number">#{c.id.replace("full-", "").padStart(3, "0")}</span><span className={`physical-element element-${c.element}`}>{labels[c.element]}</span></div>
        <h2>{type.name}</h2><small>{labels[c.faction]} · {labels[c.element]}系</small><div className="physical-marks">{c.marks.length ? c.marks.map(m => <span key={m}>{mark(m)?.name || m}</span>) : <span>無獨有技標記</span>}</div>
        <details><summary>查看效果與技能標記</summary><p>{type.description}</p>{c.marks.map(m => <div key={m}><h3>{mark(m)?.name || m}</h3><p>{mark(m)?.description || "請查閱對應角色技能。"}</p></div>)}{sourceLinks(type.sources)}</details>
      </article>; })}
    </div>}
    {!count && <div className="portal-empty"><p>沒有符合的項目。試試較短的牌名或技能關鍵字。</p><button className="portal-secondary" onClick={clear}>清除篩選</button></div>}
    <div className="scope-banner">規則、玩法與卡牌效果以{WIKI.name}為主要參考；角色技能摘要仍包含參考引擎文字，未核對項目已標示。單人與多人對戰皆可使用角色技能；尚未核對全部角色交互裁定。圖片為牌型插畫，屬性與標記另行列出，並非 150 張不同印刷掃描。</div>
  </>;
}
