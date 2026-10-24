"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
      `${c.name} ${c.skills.map((s) => s.name + " " + s.description).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function start() {
    setLaunch(`/engine/index.html?players=${players}&edition=${edition}`);
    setRunning(true);
  }
  return (
    <main className={"full-shell" + (running ? " full-running" : "")}>
      <header className="full-header">
        <Link href="/">✦ 星杯傳說</Link>
        <span>正式擴充 · 規則引擎整合版</span>
        <nav>
          {running && (
            <button
              onClick={() => {
                if (confirm("離開會結束目前的本機對局，確定離開？"))
                  setRunning(false);
              }}
            >
              結束並返回
            </button>
          )}
          <Link href="/">返回大廳</Link>
        </nav>
      </header>
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
              <p className="full-kicker">AST GRAIL · OFFICIAL EXPANSIONS</p>
              <h1>
                選擇你的角色，
                <br />
                <em>讓技能決定戰局。</em>
              </h1>
              <p>
                角色技能、能量、治療、追加行動與回應時機，接入同一個事件結算引擎。只開放正式來源角色，同人包不加入牌局。
              </p>
              <div className="full-metrics">
                <span>
                  <b>{catalog?.characters.length ?? "—"}</b> 已接入角色
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
                <img
                  key={c.id}
                  src={c.portrait}
                  alt={c.name}
                  style={{
                    transform: `rotate(${(i - 1) * 13}deg) translateY(${i === 1 ? 0 : 18}px)`,
                  }}
                />
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
              <div className="full-panel">
                <p className="full-kicker">準備牌局</p>
                <h2>與電腦對戰</h2>
                <label>
                  對戰人數
                  <select
                    value={players}
                    onChange={(e) => setPlayers(e.target.value)}
                  >
                    <option value="4">4 人 · 2 對 2</option>
                    <option value="6">6 人 · 3 對 3</option>
                    <option value="8">8 人 · 4 對 4</option>
                  </select>
                </label>
                <label>
                  角色版本
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
                  本機牌局由你操作一名角色，其餘由電腦控制。
                </p>
              </div>
              <div className="full-panel">
                <h2>這裡可以做什麼</h2>
                <ul>
                  <li>從已接入的正式角色中選角，使用主動與回應技能。</li>
                  <li>依提示出牌、應戰、治療、提煉能量與合成星杯。</li>
                  <li>查看卡牌屬性、派系、技能標記與角色專屬資源。</li>
                  <li>在回應時機選擇技能；右側面板列出技能和條件。</li>
                  <li>查看全部牌型及角色規則，切換舊版比較。</li>
                </ul>
                <p className="full-notice">
                  本模式目前是本機對
                  AI，尚未接通跨裝置多人連線。正式爆食少女依牌面與 FAQ
                  另行實作； 全部角色的交互技能仍需逐項驗收。
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
              <p className="full-muted">
                每張實體牌保存屬性、派系和技能標記；圖片為牌型插畫，印刷標記由引擎疊加顯示。
              </p>
              <div className="full-card-grid">
                {catalog?.cards.map((c) => (
                  <article key={c.id}>
                    <img src={c.portrait} alt={c.name} loading="lazy" />
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                  </article>
                ))}
              </div>
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
                查看此版來源
              </a>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
