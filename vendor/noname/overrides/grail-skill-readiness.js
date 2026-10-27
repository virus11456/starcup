/* GPL-3.0: informational readiness only. Trigger timing, cost, skill/cancel
 * buttons, card filters, target legality and game effects remain native. */
const followUps = Object.freeze({
  fengNuZhuiJi: { type: 'element', value: 'feng', label: '風系攻擊牌', short: '缺風攻' },
  xiuLuoLianZhan: { type: 'element', value: 'huo', label: '火系攻擊牌', short: '缺火攻' },
  jiZhiJianYi: { type: 'fate', value: 'ji', label: '技類攻擊牌', short: '缺技攻' },
  erChongJianYing: { type: 'same', label: '同系攻擊牌', short: '缺同系' },
  xuRongZhangWo: { type: 'cardName', value: 'moDan', label: '魔彈牌', short: '缺魔彈' },
  jiDuZhuiFang: { type: 'attackTarget', label: '符合目標條件的攻擊', short: '缺目標' },
  jianYing: { type: 'attack', label: '攻擊牌', short: '暫無攻牌' },
  shenShengZhuiJi: { type: 'attack', label: '攻擊牌', short: '暫無攻牌' },
  shun: { type: 'attack', label: '攻擊牌', short: '暫無攻牌' },
  liRuQuanYong: { type: 'attack', label: '攻擊牌', short: '暫無攻牌' },
  yiJiWuNian: { type: 'attack', label: '攻擊牌', short: '暫無攻牌' },
  faLiChaoXi: { type: 'spell', label: '法術牌', short: '暫無法術' },
  fuMoDaJi: { type: 'spell', label: '法術牌', short: '暫無法術' },
});

function isKnown(value) {
  return typeof value === 'string' && value.length > 0;
}
function hasCard(cards, get, type, extra = () => true) {
  if (typeof get?.type !== 'function') return null;
  return cards.some(card => get.type(card) === type && extra(card));
}
export function getOptionalSkillReadiness(id, player, get, { triggerCard, players } = {}) {
  const spec = followUps[id];
  if (!spec || typeof player?.getCards !== 'function') return null;
  const cards = player.getCards('h');
  if (!Array.isArray(cards)) return null;
  let present = null;
  if (spec.type === 'attack' || spec.type === 'attackTarget') {
    present = hasCard(cards, get, 'gongJi');
  } else if (spec.type === 'spell') {
    present = hasCard(cards, get, 'faShu');
  } else if (spec.type === 'element') {
    if (typeof get?.xiBie === 'function') present = hasCard(cards, get, 'gongJi', card => get.xiBie(card) === spec.value);
  } else if (spec.type === 'fate') {
    if (typeof get?.mingGe === 'function') present = hasCard(cards, get, 'gongJi', card => get.mingGe(card) === spec.value);
  } else if (spec.type === 'cardName') {
    if (typeof get?.name === 'function') present = cards.some(card => get.name(card) === spec.value);
  } else if (spec.type === 'same') {
    if (triggerCard && typeof get?.xiBie === 'function') {
      const element = get.xiBie(triggerCard);
      if (isKnown(element)) present = hasCard(cards, get, 'gongJi', card => get.xiBie(card) === element);
    }
  }
  if (present === null) return null; // Never infer missing cards from unknown data.
  let reason = present ? '' : '目前手上沒有' + spec.label;
  let short = present ? '' : spec.short;
  if (spec.type === 'attackTarget' && present && Array.isArray(players) &&
      typeof player.countCards === 'function') {
    const myCount = player.countCards('h');
    const legalOpponent = players.some(target => target && target !== player &&
      target.side !== player.side && typeof target.countCards === 'function' &&
      target.countCards('h') > myCount);
    if (!legalOpponent) {
      reason = '目前沒有手牌數比你多的敵方角色';
      short = '缺目標';
    }
  }
  if (!reason) return null;
  // The original trigger may legally grant the action even if the follow-up
  // cannot use a card right now; transformations or later state may change.
  return { id, short, message: `${id}：${reason}；依原規則仍可發動，後續能否出牌由引擎判定。` };
}
export function optionalSkillReadinessNotes(ids, player, get, context) {
  return [...new Set(ids || [])].map(id => getOptionalSkillReadiness(id, player, get, context))
    .filter(Boolean).map(note => note.message);
}

// Native skill choices can be in ui.skills* or, for a triggered batch like
// 風怒追擊／劍影, in ui.control > .control > div (not in ui.skills).
function visible(node) {
  return node && !node.hidden && node.style?.display !== 'none' &&
    !['hidden', 'removing', 'disabled'].some(cls => node.classList?.contains?.(cls));
}
function choiceNodes(ui) {
  const nodes = [];
  for (const panel of [ui?.skills, ui?.skills2, ui?.skills3, ui?.control]) {
    if (!visible(panel)) continue;
    for (const candidate of panel.children || panel.childNodes || []) {
      if (!visible(candidate)) continue;
      if (isKnown(candidate.link)) nodes.push({ button: candidate, control: candidate.parentNode });
      for (const child of candidate.children || candidate.childNodes || []) {
        if (visible(child) && isKnown(child.link)) nodes.push({ button: child, control: candidate });
      }
    }
  }
  return nodes;
}
export function offeredOptionalSkillChoices(ui, lib) {
  const result = [];
  for (const { button, control } of choiceNodes(ui)) {
    const displayed = String(button.textContent || '').replace(/\s+/g, '');
    const id = Object.keys(followUps).find(skill => {
      if (button.link === skill) return true;
      const label = String(lib?.translate?.[skill] || '')
        .replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, '');
      return label.length >= 2 && displayed.includes(label);
    });
    if (id) result.push({ id, button, control });
  }
  return result;
}
export function updateOptionalSkillChoiceHints(ui, lib, player, get, context) {
  const choices = offeredOptionalSkillChoices(ui, lib);
  const messages = [];
  let updated = false;
  const controls = new Set();
  for (const { id, button, control } of choices) {
    const note = getOptionalSkillReadiness(id, player, get, context);
    if (note) messages.push(note.message);
    if (!button.dataset) continue;
    const next = note?.short || '';
    if ((button.dataset.grailReadiness || '') === next) continue;
    if (next) {
      button.dataset.grailReadiness = next;
      button.title = note.message;
    } else {
      delete button.dataset.grailReadiness;
      button.removeAttribute?.('title');
    }
    updated = true;
    if (control?.classList?.contains?.('control')) controls.add(control);
  }
  if (updated) {
    // Preserve the native links/listeners; the extra label may widen a control.
    for (const control of controls) {
      const width = Array.from(control.children || []).reduce(
        (total, child) => total + (Number(child.offsetWidth) || 0), 0);
      if (width > 0 && control.style) control.style.width = width + 'px';
    }
    ui?.updatec?.();
  }
  return [...new Set(messages)];
}
