/* GPL-3.0: observe the engine's existing public log; no rules or server writes. */
export function createHistoryBuffer(limit = 1000) {
  const entries = [];
  let sequence = 0;
  return {
    append(text, turn = 0) {
      text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 8000);
      if (!text) return null;
      const entry = { id: ++sequence, text, turn: Number(turn) || 0 };
      entries.push(entry);
      if (entries.length > limit) entries.splice(0, entries.length - limit);
      return entry;
    },
    search(query = '') {
      const needle = query.trim().toLocaleLowerCase();
      return entries.filter(entry => entry.text.toLocaleLowerCase().includes(needle));
    },
    get latest() { return entries.at(-1); },
    get size() { return entries.length; },
  };
}

export function observeNativeHistory(sidebar, append, getTurn, Observer = MutationObserver) {
  const seen = new WeakSet();
  function capture(node) {
    if (node.nodeType !== 1 || seen.has(node)) return;
    seen.add(node);
    append(node.textContent, getTurn());
  }
  // Native logs are inserted newest-first. Seed oldest-first, then preserve
  // the chronological order of mutation records (including repeated actions).
  Array.from(sidebar.children).reverse().forEach(capture);
  const observer = new Observer(records => {
    for (const record of records) for (const node of record.addedNodes) capture(node);
  });
  observer.observe(sidebar, { childList: true });
  return () => observer.disconnect();
}

export function createBattleHistory(parent, getTurn) {
  const buffer = createHistoryBuffer();
  const node = (tag, text, className = '') => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    if (tag === 'button') el.type = 'button';
    return el;
  };
  const toggle = node('button', '紀錄');
  toggle.id = 'grail-history-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'grail-history');
  const panel = node('section');
  panel.id = 'grail-history';
  panel.hidden = true;
  panel.setAttribute('aria-label', '對戰紀錄');
  const header = node('header');
  const close = node('button', '關閉');
  const title = node('h2', '對戰紀錄');
  header.append(title, close);
  const search = node('input');
  search.type = 'search';
  search.placeholder = '搜尋角色、牌名或動作…';
  search.setAttribute('aria-label', '搜尋對戰紀錄');
  const fresh = node('button', '', 'grail-history-new');
  fresh.hidden = true;
  const summary = node('p', '', 'grail-history-summary');
  const list = node('ol');
  list.tabIndex = 0;
  list.setAttribute('aria-label', '對戰紀錄，由新到舊');
  const more = node('button', '顯示較早紀錄');
  const note = node('p', '顯示原引擎已公開的紀錄，最多保留本頁最近 1,000 筆；重新整理後重新累積。', 'grail-history-note');
  panel.append(header, search, fresh, summary, list, more, note);
  parent.append(toggle, panel);
  let shown = 100, seenId = 0, source, stop = () => {};
  function announce() {
    const unread = Math.max(0, (buffer.latest?.id || 0) - seenId);
    toggle.textContent = unread ? `紀錄 ${unread > 99 ? '99+' : unread}` : '紀錄';
    toggle.setAttribute('aria-label', `對戰紀錄${unread ? `，${unread} 筆新紀錄` : ''}`);
    toggle.title = buffer.latest?.text || '查看本場玩家動作與結算';
    fresh.hidden = !unread;
    fresh.textContent = `有 ${unread} 筆新紀錄，點此更新`;
  }
  function render(refresh = true) {
    if (refresh) seenId = buffer.latest?.id || 0;
    const matches = buffer.search(search.value).filter(entry => entry.id <= seenId);
    const entries = matches.slice(-shown).reverse();
    list.replaceChildren();
    for (const entry of entries) {
      const item = node('li');
      item.append(node('small', `#${entry.id}${entry.turn ? ` · 第 ${entry.turn} 回合` : ' · 準備'}`), node('p', entry.text));
      list.append(item);
    }
    summary.textContent = entries.length
      ? `顯示 ${entries.length}／${matches.length} 筆 · 由新到舊`
      : search.value ? '找不到符合的紀錄。' : '牌局開始後，動作與結算紀錄會出現在這裡。';
    more.hidden = matches.length <= shown;
    announce();
  }
  function hide() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (!panel.hidden) { hide(); return; }
    shown = 100;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    render();
    list.scrollTop = 0;
    close.focus();
  });
  close.addEventListener('click', hide);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); hide(); }
  });
  search.addEventListener('input', () => { shown = 100; render(); list.scrollTop = 0; });
  more.addEventListener('click', () => { const top = list.scrollTop; shown += 100; render(false); list.scrollTop = top; });
  fresh.addEventListener('click', () => { shown = 100; render(); list.scrollTop = 0; });
  announce();
  return {
    attach(sidebar) {
      if (!sidebar || sidebar === source) return;
      stop();
      source = sidebar;
      stop = observeNativeHistory(sidebar, (text, turn) => {
        if (buffer.append(text, turn)) announce();
      }, getTurn);
    },
    stop() { stop(); },
  };
}
