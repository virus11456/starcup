"use client";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Search, Sparkles } from "lucide-react";
import { RULES, searchRules } from "@/lib/rules";
import { WIKI, ruleSources } from "@/lib/wiki-reference";
export default function RulesDictionary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const results = searchRules(query, category);
  return (
    <section className="dictionary">
      <div className="dictionary-intro">
        <div className="eyebrow">星之典</div>
        <h2>有疑問，就問星之典。</h2>
        <p>以{WIKI.name}為主要依據，搜尋規則問答並對照本版實作範圍。</p>
      </div>
      <div className="dictionary-search">
        <Search size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：暗滅能不能應戰？魔彈怎麼傳？"
          aria-label="詢問星杯規則"
        />
        <span>{RULES.length} 則問答</span>
      </div>
      <div className="suggested-questions">
        {["暗滅能不能應戰", "魔彈怎麼傳", "手牌超過六張", "治療能擋虛弱嗎"].map(
          (q) => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                setCategory("全部");
              }}
            >
              <Sparkles size={11} />
              {q}
            </button>
          ),
        )}
      </div>
      <div className="dictionary-categories">
        {["全部", "基礎", "卡牌", "行動", "回應", "資源", "版本"].map((c) => (
          <button
            className={category === c ? "active" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="dictionary-count">
        {query
          ? `找到 ${results.length} 則相關規則`
          : `瀏覽 ${results.length} 則規則`}
        <span>來源整理 · 非生成式裁定</span>
      </p>
      <div className="rule-results">
        {results.length ? (
          results.map((r, i) => (
            <details
              className="rule-entry"
              key={r.id}
              open={query ? i < 2 : undefined}
            >
              <summary>
                <span className="rule-category">{r.category}</span>
                <strong>{r.title}</strong>
                <span className="rule-plus">＋</span>
              </summary>
              <div className="rule-answer">
                <p>{r.answer}</p>
                <div className="implementation-note">
                  <BookOpen size={14} />
                  <p>
                    <b>本版狀態：</b>
                    {r.scope}
                  </p>
                </div>
                {ruleSources(r.id).map(source => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    參考：星杯傳說百科 · {source.title}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="dictionary-empty">
            <BookOpen size={27} />
            <h3>這個問題還沒有收錄</h3>
            <p>
              試試卡名或關鍵字。角色專屬技能與擴充交互尚未收錄，不會自動猜測答案。
            </p>
            <a
              href="https://xingbeichuanshuobaike.webnode.tw/遊戲指南-規則說明書/"
              target="_blank"
              rel="noreferrer"
            >
              查閱完整規則說明書
              <ArrowUpRight size={13} />
            </a>
          </div>
        )}
      </div>
      <p className="field-note">
        字典是可搜尋的來源摘要，不是人工智慧
        裁判；未收錄的裁定仍需查閱對應版本的角色卡與官方說明。
      </p>
    </section>
  );
}
