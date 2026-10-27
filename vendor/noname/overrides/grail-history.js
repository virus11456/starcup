/* GPL-3.0: observe the engine's existing public log; no rules or server writes. */
export function createHistoryBuffer(limit = 1000, initial = []) {
  const entries = [];
  let sequence = 0;
  for (const entry of Array.isArray(initial) ? initial.slice(-limit) : []) {
    if (!entry || !Number.isSafeInteger(entry.id) || entry.id <= sequence || entry.id >= Number.MAX_SAFE_INTEGER ||
      typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 8000 ||
      !Number.isFinite(entry.turn) || entry.turn < 0) continue;
    entries.push({ id: entry.id, text: entry.text, turn: entry.turn });
    sequence = entry.id;
  }
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

export function createBattleHistory(parent, getTurn, { journal } = {}) {
  const buffer = createHistoryBuffer(1000, journal?.load());
  const node = (tag, text, className = '') => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    if (tag === 'button') el.type = 'button';
    return el;
  };
  const toggle = node('button', '本場紀錄');
  toggle.id = 'grail-history-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'grail-history');
  const panel = node('section');
  panel.id = 'grail-history';
  panel.hidden = true;
  panel.setAttribute('aria-label', '對戰紀錄');
  const header = node('header');
  const close = node('button', '關閉');
  const title = node('h2', '本場紀錄');
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
  const note = node('p', '', 'grail-history-note');
  panel.append(header, search, fresh, summary, list, more, note);
  parent.append(toggle, panel);
  let shown = 100, seenId = buffer.latest?.id || 0, source, stop = () => {};
  function announce() {
    note.textContent = journal?.available
      ? '本場公開紀錄暫存於同一分頁，重連後保留最多 1,000 筆；文字過多時保留較新的紀錄。離線期間未收到的事件可能缺漏。'
      : journal ? '瀏覽器無法暫存紀錄，目前僅保留本頁最近 1,000 筆；重新整理後重新累積。'
        : '顯示原引擎已公開的紀錄，最多保留本頁最近 1,000 筆；重新整理後重新累積。';
    const unread = Math.max(0, (buffer.latest?.id || 0) - seenId);
    toggle.textContent = unread ? `本場紀錄 ${unread > 99 ? '99+' : unread}` : '本場紀錄';
    // Short label only affects phone visuals. The original text, unread
    // count, accessible name and click/keyboard handlers remain intact.
    toggle.dataset.mobileLabel = unread ? `紀錄 ${unread > 99 ? '99+' : unread}` : '紀錄';
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
  // Native window.onkeydown treats A and Space as auto/pause regardless of
  // focus. Keep history typing and keyboard controls out of that handler;
  // retain normal input, scrolling, browser shortcuts and button defaults.
  toggle.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); hide(); }
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
        if (buffer.append(text, turn)) { journal?.save(buffer.search()); announce(); }
      }, getTurn);
    },
    flush() { journal?.flush(); },
    stop() { stop(); journal?.stop(); },
  };
}
