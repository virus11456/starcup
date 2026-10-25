/* GPL-3.0: read-only, legible views of our hand and public character/mark data.
   Never inspect another player's hand, expansion cards or private storage. */
export const inspectionText = value => String(value ?? '')
  .replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const safeImage = path => typeof path === 'string' && /^image\/(?:card|character)\/[\w/.-]+\.(?:png|jpg|webp)$/.test(path) && !path.includes('..') ? path : '';

function publicSkills(player, { lib, get }) {
  const ids = [...new Set(player?.getSkills?.(null, false, false) || [])];
  return ids.filter(id => lib.translate[id + '_info'] && !lib.skill[id]?.nopop && !lib.skill[id]?.equipSkill).map(id => ({
    id, title: inspectionText(lib.translate[id] || id),
    text: inspectionText(get.skillInfoTranslation?.(id, player) || lib.translate[id + '_info']),
    disabled: Boolean(player.disabledSkills?.[id]?.length || player.forbiddenSkills?.[id]),
  }));
}
export function inspectionPlayers({ game, get }) {
  return (game.players || []).filter(player => player.name && !player.isUnseen?.()).map(player => ({
    player, label: `${player === game.me ? '你 · ' : ''}${get.translation(player.name)}${typeof player.side === 'boolean' ? player.side ? ' · 紅隊' : ' · 藍隊' : ''}`,
  }));
}
export function readInspection(kind, player, context) {
  const { lib, game, get } = context;
  const label = id => inspectionText(lib.translate[id] || get.translation(id) || id);
  if (kind === 'hand') {
    const mine = new Set(publicSkills(game.me, context).map(skill => skill.id));
    return (game.me?.getCards?.('h') || []).map((card, index) => {
      const info = lib.card[card.name] || {};
      const stamps = typeof card.duYou === 'string' ? card.duYou.split(lib.natureSeparator || '|').filter(Boolean) : [];
      return {
        title: label(card.name), subtitle: [`第 ${index + 1} 張`, card.xiBie && label(card.xiBie) + '系', card.mingGe && label(card.mingGe) + '命格', info.type && label(info.type)].filter(Boolean).join(' · '),
        image: safeImage(`image/card/${card.name}.png`),
        status: card.classList?.contains('selected') ? '已選取' : card.classList?.contains('selectable') ? '目前可選' : '目前未開放選取',
        sections: [{ title: '基本效果', text: inspectionText(info.cardPrompt?.(card, game.me) || lib.translate[card.name + '_info']) || '請依本回合提示與原牌面說明操作。' },
          ...stamps.map(id => ({ title: label(id), badge: mine.has(id) ? '本角色獨有技' : '其他角色標記',
            text: inspectionText(lib.translate[id + '_info']) || '此為牌上的角色技能標記，請參考對應角色的技能說明。', matching: mine.has(id) }))],
      };
    });
  }
  // A stale selection must not reveal an unrevealed or departed character.
  if (!inspectionPlayers(context).some(entry => entry.player === player)) return [];
  const skills = publicSkills(player, context);
  if (kind === 'roles') return skills.map(skill => ({ title: skill.title, status: skill.disabled ? '目前停用' : '角色技能', sections: [{ text: skill.text }] }));
  if (kind !== 'marks') return [];
  // Only marks actually present on the public player node. Counts come from
  // the rendered badge, not storage values that may contain hidden cards.
  const marks = [...(player.node?.marks?.children || []), ...(player.node?.marks2?.children || [])];
  return marks.filter(mark => mark.classList?.contains('mark') && !mark.classList.contains('removing') && !mark.classList.contains('hidden') && !mark.hidden).map(mark => {
    const id = mark.skill || mark.name, info = mark.info || lib.skill[id]?.intro || {};
    const title = typeof info.name === 'string' ? inspectionText(info.name) : label(id);
    const count = inspectionText(mark.markcount?.textContent || mark.querySelector?.('.markcount')?.textContent);
    const limit = lib.skill[id] && player.getZhiShiWuLimit ? player.getZhiShiWuLimit(id) : info.max;
    const maximum = Number.isFinite(limit) ? limit : undefined;
    const sections = [];
    const translated = lib.translate[id + '_info'];
    const content = typeof info.content === 'string' && !['mark', 'zhiShiWu', 'gaiPai', 'expansion', 'cards', 'card', 'info', 'cardCount', 'jiChuXiaoGuo', 'turn', 'time', 'limited', 'player', 'players', 'character', 'characters'].includes(info.content) ? info.content : '';
    const description = inspectionText(translated || content.replace(/#/g, count || '—').replace(/[&$]/g, count || '—'));
    if (description) sections.push({ title: '效果說明', text: description });
    const related = skills.filter(skill => title && (skill.title.includes(title) || skill.text.includes(title)));
    for (const skill of related) sections.push({ title: skill.title, text: skill.text });
    if (!sections.length) sections.push({ title: '用途', text: info.content === 'gaiPai'
      ? '角色專有蓋牌。此處顯示公開數量；牌面請依原遊戲允許的方式查看。'
      : '取得、消耗與移除時機請切換「角色」，查看該角色的完整技能說明。' });
    return { title, count: count || '啟用中', maximum,
      subtitle: info.content === 'gaiPai' ? '蓋牌數量' : '公開指示物',
      image: safeImage(lib.skill[id]?.markimage || lib.skill[id]?.markimage2), sections };
  });
}

export function createBattleInspection({ panel, toggle, help, context, document: doc = document }) {
  const node = (tag, text = '', className = '') => {
    const el = doc.createElement(tag); el.className = className;
    if (text) el.textContent = text;
    if (tag === 'button') el.type = 'button';
    return el;
  };
  const body = node('div'); body.id = 'grail-help-body'; body.hidden = true;
  const tabs = node('nav'); tabs.className = 'grail-inspect-tabs'; tabs.setAttribute('aria-label', '說明分類');
  const inspection = node('section'); inspection.id = 'grail-inspection'; inspection.hidden = true;
  const tools = node('div', '', 'grail-inspect-tools');
  const selectLabel = node('label', '查看角色');
  const select = node('select'); select.setAttribute('aria-label', '選擇要查看的角色'); selectLabel.append(select);
  const refresh = node('button', '更新資訊');
  tools.append(selectLabel, refresh);
  const note = node('p', '', 'grail-inspect-note');
  const list = node('div', '', 'grail-inspect-list');
  inspection.append(tools, note, list);
  body.append(tabs, help, inspection); panel.append(body);
  let active = 'hand', player = context.game.me, signature = '', players = [], listSignature = '';
  const buttons = new Map();
  for (const [key, title] of [['turn', '本回合'], ['hand', '手牌'], ['roles', '角色'], ['marks', '指示物']]) {
    const button = node('button', title);
    button.addEventListener('click', () => { active = key; render(); });
    tabs.append(button); buttons.set(key, button);
  }
  function syncPlayers() {
    const next = inspectionPlayers(context);
    if (!next.some(entry => entry.player === player)) player = context.game.me;
    const nextSignature = next.map(entry => entry.label).join('|');
    if (nextSignature !== listSignature || next.some((entry, i) => entry.player !== players[i]?.player)) {
      select.replaceChildren();
      next.forEach((entry, i) => { const option = node('option', inspectionText(entry.label)); option.value = String(i); select.append(option); });
      listSignature = nextSignature;
    }
    players = next;
    select.value = String(players.findIndex(entry => entry.player === player));
  }
  function render() {
    syncPlayers();
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(active === key));
    help.hidden = active !== 'turn'; inspection.hidden = active === 'turn';
    selectLabel.hidden = active === 'hand';
    if (active === 'turn') return;
    const entries = readInspection(active, player, context);
    signature = JSON.stringify(entries); refresh.textContent = '更新資訊';
    note.textContent = active === 'hand' ? '查看不會出牌或暫停牌局。獨有技仍須符合發動條件；請回牌桌操作。'
      : active === 'roles' ? '查看不會暫停牌局。能否發動仍以本回合的原操作列與條件為準。'
      : '只列公開指示物，查看不會暫停牌局。有變動時可按「更新」查看。';
    list.replaceChildren(); list.scrollTop = 0;
    if (!entries.length) list.append(node('p', active === 'hand' ? '目前沒有手牌；發牌後可在這裡查看。' : active === 'roles' ? '角色選定後會顯示技能說明。' : '此角色目前沒有公開指示物。', 'grail-inspect-empty'));
    for (const entry of entries) {
      const article = node('article');
      const header = node('header');
      if (entry.image) {
        const image = node('img'); image.src = entry.image; image.alt = ''; image.loading = 'lazy';
        image.addEventListener('error', () => { image.hidden = true; }); header.append(image);
      }
      const heading = node('div');
      heading.append(node('h3', entry.title));
      if (entry.subtitle) heading.append(node('p', entry.subtitle));
      header.append(heading);
      if (entry.count) header.append(node('strong', entry.count + (entry.maximum !== undefined ? ` / ${entry.maximum}` : ''), 'grail-inspect-count'));
      article.append(header);
      if (entry.status) article.append(node('p', entry.status, 'grail-inspect-status'));
      for (const section of entry.sections) {
        const block = node('section', '', section.matching ? 'grail-inspect-matching' : '');
        if (section.badge) block.append(node('small', section.badge));
        if (section.title) block.append(node('h4', section.title));
        block.append(node('p', section.text)); article.append(block);
      }
      list.append(article);
    }
  }
  function close() {
    body.hidden = true; toggle.textContent = '說明 ▸'; toggle.setAttribute('aria-expanded', 'false');
    list.replaceChildren(); signature = ''; toggle.focus();
  }
  toggle.textContent = '說明 ▸'; toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', '查看手牌、角色技能、指示物與本回合提示');
  toggle.setAttribute('aria-controls', body.id);
  toggle.addEventListener('click', () => {
    if (!body.hidden) { close(); return; }
    body.hidden = false; toggle.textContent = '關閉說明 ×'; toggle.setAttribute('aria-expanded', 'true'); render();
  });
  select.addEventListener('change', () => { player = players[Number(select.value)]?.player || context.game.me; render(); });
  refresh.addEventListener('click', render);
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !body.hidden) { event.preventDefault(); close(); }
  });
  // Only intercept events inside this read-only panel, never the actual card,
  // character or skill controls. Native shortcuts must not trigger on Space/A.
  for (const type of ['click', 'touchend', 'pointerdown']) panel.addEventListener(type, event => event.stopPropagation());
  return {
    update() {
      if (body.hidden || active === 'turn') return;
      const current = JSON.stringify(readInspection(active, player, context));
      if (current !== signature) refresh.textContent = '資訊已變動 · 更新';
    },
    close,
    stop() { list.replaceChildren(); },
  };
}
