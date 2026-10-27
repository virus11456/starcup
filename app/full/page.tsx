"use client";
import { useEffect, useState } from "react";
import Compendium from "../compendium";
import SiteBrand from '../site-brand';
import SiteHeader from '../site-header';
import { matchesCatalog } from "@/lib/catalog-search";
import "./full.css";
type Skill = {
  id: string;
  name: string;
  description: string;
  implemented: boolean;
  kind: string;
};
type Character = {
  id: string;
  name: string;
  pack: string;
  packName: string;
  portrait: string;
  skills: Skill[];
  issue: string | null;
  source: string;
  aliases?: string[];
  reviewNote?: string;
};
type Catalog = {
  characters: Character[];
  legacyCharacters: Character[];
  deck: unknown[];
  cards: { id: string; name: string; description: string; portrait: string }[];
};
export default function FullGame() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState("");
  const [players, setPlayers] = useState("4"),
    [edition, setEdition] = useState("current"),
    [view, setView] = useState("setup");
  const [query, setQuery] = useState(""),
    [pack, setPack] = useState("all"),
    [selected, setSelected] = useState<Character | null>(null);
  const [running, setRunning] = useState(false),
    [launch, setLaunch] = useState("");
  useEffect(() => {
    const initialView = new URLSearchParams(window.location.search).get("view");
    if (initialView === "characters" || initialView === "cards") setView(initialView);
    const c = new AbortController();
    fetch("/full-engine/catalog.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("角色資料尚未準備完成，請重新整理。");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, []);
  const all = catalog
    ? [
        ...catalog.characters,
        ...(edition === "legacy" ? catalog.legacyCharacters : []),
      ]
    : [];
  const filtered = all.filter(
    (c) =>
      (pack === "all" || c.pack === pack) &&
      matchesCatalog(`${c.name} ${c.aliases?.join(" ") || ""} ${c.skills.map((s) => s.name + " " + s.description).join(" ")}`, query),
  );
  function start() {
    const phoneLayout = new URLSearchParams(window.location.search).get("phone-layout") === "1";
    setLaunch(`/engine/index.html?players=${players}&edition=${edition}${phoneLayout ? "&phone-layout=1" : ""}`);
    setRunning(true);
  }
  function leave() {
    if (confirm("離開會結束目前的本機對局，確定離開？")) setRunning(false);
  }
  return (
    <main className={"full-shell" + (running ? " full-running" : "")}>
      {running ? (
        <header className="full-header">
          <SiteBrand onClick={(event) => {
            if (!confirm("離開會結束目前的本機對局，確定返回大廳？")) event.preventDefault();
          }} />
          <span>角色與擴充對戰 · 本機對電腦</span>
          <nav><button onClick={leave}>結束並返回</button></nav>
        </header>
      ) : <SiteHeader />}
      {running ? (
        <iframe
          key={launch}
          src={launch}
          title="星杯傳說正式擴充對戰"
          className="full-frame"
          allow="fullscreen"
        />
      ) : (
        <>
          <section className="full-intro">
            <div>
              <p className="full-kicker">星杯傳說 · 下一步由你決定</p>
              <span className="full-mode-badge">角色技能模式 · 免下載</span>
              <h1>
                選擇你的角色，
                <br />
                <em>讓技能決定戰局。</em>
              </h1>
              <p>
                攻擊、應戰、治療，掌握每一個回應時機。從十週年與正式擴充角色中選擇夥伴，讓你的下一步改變戰局。
              </p>
              <div className="full-metrics">
                <span>
                  <b>{catalog?.characters.length ?? "—"}</b> 正式角色
                </span>
                <span>
                  <b>{catalog?.deck.length ?? "—"}</b> 基礎牌
                </span>
                <span>
                  <b>5</b> 本體／擴充包
                </span>
              </div>
            </div>
            <div className="full-portrait-fan">
              {catalog?.characters.slice(0, 3).map((c, i) => (
                <figure
                  key={c.id}
                  style={{
                    transform: `rotate(${(i - 1) * 13}deg) translateY(${i === 1 ? 0 : 18}px)`,
                  }}
                >
                  <img src={c.portrait} alt={c.name} />
                  <figcaption><small>{c.packName}</small>{c.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
          {error && (
            <p role="alert" className="full-notice">
              {error}
            </p>
          )}
          <div className="full-tabs" role="tablist" aria-label="正式擴充模式">
            {[
              ["setup", "開始對戰"],
              ["characters", "角色與技能"],
              ["cards", "150 張牌庫"],
            ].map(([id, name]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
              >
                {name}
              </button>
            ))}
          </div>
          {view === "setup" && (
            <section className="full-setup">
              <div className="full-panel full-setup-controls">
                <p className="full-kicker">準備牌局</p>
                <h2>與電腦對戰</h2>
                <fieldset className="full-player-options">
                  <legend>01 · 選擇牌局規模</legend>
                  {["4", "6", "8"].map((count) => <label key={count}>
                    <input type="radio" name="players" value={count} checked={players === count} onChange={() => setPlayers(count)} />
                    <span><b>{Number(count) / 2} <i>對</i> {Number(count) / 2}</b><small>{count} 人牌局</small></span>
                  </label>)}
                </fieldset>
                <label>
                  02 · 選擇角色版本
                  <select
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                  >
                    <option value="current">十週年與正式擴充</option>
                    <option value="legacy">另開放三／四版角色比較</option>
                  </select>
                </label>
                <button
                  className="full-primary"
                  disabled={!catalog}
                  onClick={start}
                >
                  選角並開始對戰 →
                </button>
                <p className="full-muted">
                  你操作 1 名角色，其餘 {Number(players) - 1} 名由電腦控制。進入後可選擇角色與座位；同一場角色不重複，新舊版本視為同一角色。
                </p>
              </div>
              <div className="full-panel full-table-guide">
                <p className="full-kicker">讀懂牌局</p>
                <h2>每一步，都有回應。</h2>
                <ol className="full-flow">
                  <li><span>01</span><div><h3>掌握行動</h3><p>依角色與當前時機，選擇攻擊、法術、特殊行動或技能。</p></div></li>
                  <li><span>02</span><div><h3>等待回應</h3><p>可用的手牌、目標與技能會亮起。應戰與技能回應依牌局提示進行。</p></div></li>
                  <li><span>03</span><div><h3>讀懂戰況</h3><p>留意雙方士氣、戰績與星杯，運用治療、能量與追加行動。</p></div></li>
                </ol>
                <p className="full-notice">
                  本模式目前是本機對
                  電腦。與朋友連線請前往「多人角色對戰」，兩者使用同一套引擎；角色技能的交互裁定仍持續核對中。
                </p>
              </div>
            </section>
          )}
          {view === "characters" && (
            <section>
              <div className="full-filters">
                <input
                  aria-label="搜尋角色或技能"
                  placeholder="搜尋角色、技能或效果…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="角色包"
                  value={pack}
                  onChange={(e) => setPack(e.target.value)}
                >
                  <option value="all">全部正式角色包</option>
                  {Array.from(
                    new Map(all.map((c) => [c.pack, c.packName])),
                  ).map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <span>{filtered.length} 位角色</span>
              </div>
              <div className="full-grid">
                {filtered.map((c) => (
                  <button
                    className="full-character"
                    key={c.id}
                    onClick={() => setSelected(c)}
                  >
                    <img src={c.portrait} alt="" loading="lazy" />
                    <div>
                      <small>{c.packName}</small>
                      <h3>{c.name}</h3>
                      <p>
                        {c.skills.filter((s) => s.description).length}{" "}
                        項技能／標記
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
          {view === "cards" && (
            <section>
              <Compendium initialView="physical" />
            </section>
          )}
          <footer className="full-footer">
            規則引擎整合自{" "}
            <a href="https://github.com/RancherJie/noname_xingbei">
              RancherJie / 無名杯
            </a>
            ，以 GPL-3.0 提供。<a href="/engine/NOTICE.md">來源與修改說明</a> ·{" "}
            <a href="/engine/LICENSE">授權全文</a>
            <br />
            架構與機制對照：<a href="https://github.com/chntujia/CodfiyAsteriatedGrailServer">Codify Asteriated Grail Server</a>（MIT）。
            <br />
            本作為非官方網站。角色圖片與遊戲素材權利歸原權利人；目前角色圖片不是高清印刷原檔。
          </footer>
        </>
      )}
      {selected && (
        <div
          className="full-modal"
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
        >
          <div>
            <button className="full-close" onClick={() => setSelected(null)}>
              關閉 ✕
            </button>
            <img src={selected.portrait} alt={selected.name} />
            <section>
              <small>{selected.packName}</small>
              <h2>{selected.name}</h2>
              <p className="full-notice">{selected.reviewNote || "角色技能交互仍待逐項核對。"}</p>
              {selected.skills
                .filter((s) => s.description)
                .map((s) => (
                  <article key={s.id}>
                    <h3>{s.name}</h3>
                    <small>{s.kind}</small>
                    <p>{s.description}</p>
                  </article>
                ))}
              <a href={selected.source} target="_blank" rel="noreferrer">
                查閱此角色百科與裁定
              </a>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
