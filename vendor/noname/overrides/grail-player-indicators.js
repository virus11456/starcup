/* GPL-3.0. A read-only display of each player's PUBLIC marks. */
import { readInspection, inspectionPlayers, inspectionText } from './grail-inspection.js';

const appearance = title => {
  if (/聖盾|圣盾/.test(title)) return ['shield', '🛡'];
  if (/治療|治疗|十字/.test(title)) return ['heal', '✚'];
  if (/水晶/.test(title)) return ['crystal', '◇'];
  if (/寶石|宝石/.test(title)) return ['gem', '◆'];
  if (/中毒|虛弱|虚弱|封印|詛咒|诅咒/.test(title)) return ['danger', '!'];
  return ['mark', '✦'];
};

export function publicPlayerIndicators(player, context) {
  if (!inspectionPlayers(context).some(entry => entry.player === player)) return [];
  const entries = readInspection('marks', player, context);
  const badges = entries.map(entry => {
    const label = inspectionText(entry.title);
    const count = inspectionText(entry.count || '啟用中');
    const [kind, icon] = appearance(label);
    return { id: `${label}:${entry.subtitle || ''}`, label, count, kind, icon };
  }).filter(entry => entry.label);
  // Healing is a visible player counter, but not every upstream theme renders
  // it inside the mark containers. Mirror it when it is not already listed.
  const healing = Number(player.zhiLiao ?? 0);
  if (Number.isFinite(healing) && healing > 0 && !badges.some(entry => entry.kind === 'heal')) {
    badges.unshift({ id: 'heal', label: '治療十字', count: String(healing), kind: 'heal', icon: '✚' });
  }
  // Native themes sometimes omit the corresponding mark element. These three
  // quantities are always public on the battlefield, so show them even when
  // their original icon is missing. Read counts only, never expansion cards.
  for (const [kind, label, icon, value] of [
    ['shield', '聖盾', '🛡', player.countGaiPai?.('_shengDun')],
    ['crystal', '水晶', '◇', player.countNengLiang?.('shuiJing')],
    ['gem', '寶石', '◆', player.countNengLiang?.('baoShi')],
  ]) {
    const count = Number(value ?? 0);
    if (Number.isFinite(count) && count > 0 && !badges.some(entry => entry.kind === kind)) {
      badges.unshift({ id: kind, label, count: String(count), kind, icon });
    }
  }
  return badges;
}


// Actual viewport geometry: only return a visible, collision-free strip.
// Portraits may be enlarged/rotated by the native engine; use their REAL
// getBoundingClientRect() rather than assuming a seat is its original size.
export function placeIndicatorStrip(rect, viewport, size, occupied = [], blockers = []) {
  if (!rect || !viewport || !size) return null;
  const margin = 8, gap = 8;
  const vw = Number(viewport.width), vh = Number(viewport.height);
  if (!(vw > margin * 2 && vh > margin * 2)) return null;
  const width = Math.min(Math.max(1, Number(size.width) || 1), vw - margin * 2);
  const height = Math.min(Math.max(1, Number(size.height) || 1), vh - margin * 2);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const centerX = rect.left + rect.width / 2;
  const alignX = clamp(centerX >= vw * .7 ? rect.right - width
    : centerX <= vw * .3 ? rect.left : centerX - width / 2,
    margin, vw - margin - width);
  const centers = [
    ['below', alignX, rect.bottom + gap],
    ['above', alignX, rect.top - height - gap],
    ['right', rect.right + gap, rect.top + (rect.height - height) / 2],
    ['left', rect.left - width - gap, rect.top + (rect.height - height) / 2],
  ];
  const forbidden = [...occupied, ...blockers].filter(box =>
    box && [box.left, box.top, box.width, box.height].every(Number.isFinite) &&
    box.width > 0 && box.height > 0);
  const overlaps = (a,b) => a.left < b.left + b.width + 4 &&
    a.left + a.width + 4 > b.left && a.top < b.top + b.height + 4 &&
    a.top + a.height + 4 > b.top;
  const clear = candidate => !overlaps(candidate, rect) &&
    !forbidden.some(box => overlaps(candidate, box));
  // Preserve the familiar directly-below/above placement when possible.
  for (const [placement, leftRaw, topRaw] of centers) {
    const candidate = {
      left: clamp(leftRaw, margin, vw - width - margin),
      top: clamp(topRaw, margin, vh - height - margin),
      width, height, placement,
    };
    if (clear(candidate)) return candidate;
  }
  // All four nominal anchors are obstructed. Slide along a row/column
  // rather than dropping a status despite free space a few pixels away.
  // Do not move any original player or clickable target.
  for (const [placement, leftRaw, topRaw] of centers) {
    const horizontal = placement === 'below' || placement === 'above';
    const base = horizontal ? leftRaw : topRaw;
    const low = margin;
    const high = horizontal ? vw - width - margin : vh - height - margin;
    const extent = horizontal ? width : height;
    const alternatives = [];
    for (const blocker of [rect, ...forbidden]) {
      const start = horizontal ? blocker.left : blocker.top;
      const end = start + (horizontal ? blocker.width : blocker.height);
      alternatives.push(clamp(start - extent - 5, low, high));
      alternatives.push(clamp(end + 5, low, high));
    }
    alternatives.sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
    for (const value of new Set(alternatives)) {
      const candidate = {
        left: horizontal ? value : clamp(leftRaw, margin, vw - width - margin),
        top: horizontal ? clamp(topRaw, margin, vh - height - margin) : value,
        width, height, placement,
      };
      if (clear(candidate)) return candidate;
    }
  }
  return null;
}

// Try the complete PUBLIC indicator set first. A single crowded status
// should not erase the important readable hand count if only that smaller
// badge fits. The callback measures the actual DOM variant before placing.
export function chooseIndicatorVariant(badges, handBadge, measure, compactFirst = false) {
  const compact = handBadge && badges.length > 1 ? [handBadge] : null;
  const variants = compactFirst && compact ? [compact, badges] : [badges, compact];
  for (const variant of variants) {
    if (!variant) continue;
    const position = measure(variant);
    if (position) return { badges: variant, position, compact: variant === compact };
  }
  return null;
}

// Render only Noname's native PUBLIC hand count/limit; never read opponent cards.
export function publicHandCountBadge(player) {
  const counter = player?.node?.count;
  if (!counter || counter.classList?.contains?.('hidden')) return null;
  const raw = inspectionText(counter.textContent).replace(/\s+/g, '');
  const match = /^(\d{1,3})\/(\d{1,3}|∞)$/.exec(raw);
  if (!match) return null;
  return { id: 'public-hand-count', label: '手牌',
    count: match[1] + '/' + match[2], kind: 'hand', icon: '▣' };
}

// Read layout from *visible* native UI. The player's own portrait is not
// the handcard fan, and neither pile buttons nor the action hint should be
// obscured by a read-only mark or hand-count chip.
export function visibleIndicatorObstacle(node) {
  if (!node || node.hidden || node.classList?.contains?.('hidden') ||
      node.style?.display === 'none' || node.style?.visibility === 'hidden' ||
      node.getAttribute?.('aria-hidden') === 'true') return null;
  if (node.getClientRects && node.getClientRects().length === 0) return null;
  const rect = node.getBoundingClientRect?.();
  if (!rect || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) ||
      rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

export function publicIndicatorUiObstacles(context, doc) {
  const ui = context.ui || {};
  const handFan = doc.querySelector?.('#arena #handcards1 .handcards') || ui.handcards1;
  const nodes = [
    ui.control,
    handFan,
    doc.getElementById?.('grail-phase-hint'),
    doc.querySelector?.('.grail-motion-piles'),
    ui.cardPileButton,
    ui.discardPileButton,
    doc.getElementById?.('grail-history-toggle'),
    doc.getElementById?.('grail-help'),
    doc.querySelector?.('#window #roundmenu'),
  ];
  // Do not count repeated references to the same native element as separate
  // obstacles; all positioning calculations still use viewport CSS pixels.
  return [...new Set(nodes.filter(Boolean))].map(visibleIndicatorObstacle).filter(Boolean);
}

export function createPlayerIndicators(parent, context, doc = document) {
  const layer = doc.createElement('section');
  layer.id = 'grail-player-indicators';
  layer.setAttribute('aria-label', '各玩家目前指示物');
  parent.append(layer);
  const strips = new Map();
  return {
    update() {
      const visible = !context.ui?.arena?.classList.contains('choose-character');
      const players = visible ? inspectionPlayers(context).map(entry => entry.player) : [];
      // The preceding draft/empty update may have hidden this entire layer.
      // Measuring a child of display:none returns zero on Safari, which
      // made the first battle HUD placement rely on guessed widths/heights.
      // Re-enable it synchronously for measurement, then restore the final
      // visibility after all safe placements have been resolved below.
      if (players.length) layer.hidden = false;
      const active = new Set();
      const occupied = [];
      for (const player of players) {
        const handCount = publicHandCountBadge(player);
        const badges = [...(handCount ? [handCount] : []), ...publicPlayerIndicators(player, context)];
        const rect = player.getBoundingClientRect?.();
        if (!badges.length || !rect || rect.width <= 0 || rect.height <= 0) {
          if (player.dataset) player.dataset.grailHandCountMirror = 'false';
          continue;
        }
        let strip = strips.get(player);
        if (!strip) {
          strip = doc.createElement('div');
          strip.className = 'grail-player-indicator-strip';
          strip.setAttribute('role', 'group');
          strips.set(player, strip);
          layer.append(strip);
        }
        const label = inspectionText(context.get.translation(player.name));
        strip.setAttribute('aria-label', label + '的狀態');
        const width = doc.defaultView?.innerWidth ?? innerWidth;
        const height = doc.defaultView?.innerHeight ?? innerHeight;
        const portrait = height > width;
        const maxWidth = portrait && width <= 600 ? Math.min(158, width * .44)
          : width <= 1049 ? Math.min(210, width * .30) : Math.min(240, width * .22);
        strip.style.maxWidth = `${maxWidth}px`;
        const otherPortraits = players.filter(other => other !== player)
          .map(other => other.getBoundingClientRect?.()).filter(Boolean);
        const scoreNode = doc.getElementById?.('grail-scoreboard');
        const scoreRect = scoreNode && !scoreNode.hidden
          ? scoreNode.getBoundingClientRect?.() : null;
        const blockers = [
          ...otherPortraits, scoreRect, ...publicIndicatorUiObstacles(context, doc),
        ].filter(box => box && box.width > 0 && box.height > 0);
        const geometryKey = JSON.stringify([width, height,
          ...[rect, ...blockers, ...occupied].map(box =>
            [box.left, box.top, box.width, box.height].map(value => Math.round(value / 8))),
          badges.map(badge => [badge.id, badge.count])]);
        const previousCompact = strip.dataset.compact === 'true';
        const unchanged = strip.dataset.geometryKey === geometryKey;
        const now = Date.now();
        // Once compact, avoid rebuilding the whole badge DOM every 400ms.
        // Retry the full set when geometry changes or after 3 seconds.
        const compactFirst = previousCompact && unchanged &&
          now - Number(strip.dataset.lastFullAttempt || 0) < 3000;
        function paint(displayed) {
          const signature = JSON.stringify(displayed);
          if (strip.dataset.signature === signature) return;
          strip.dataset.signature = signature;
          strip.replaceChildren();
          for (const badge of displayed) {
            const item = doc.createElement('span');
            item.className = 'grail-indicator grail-indicator-' + badge.kind;
            item.title = `${label}：${badge.label}，${badge.count}`;
            const icon = doc.createElement('span'); icon.className = 'grail-indicator-icon';
            icon.textContent = badge.icon; icon.setAttribute('aria-hidden', 'true');
            const name = doc.createElement('span'); name.className = 'grail-indicator-name';
            name.textContent = badge.label;
            const count = doc.createElement('b');
            count.textContent = badge.count === '啟用中' ? '✓' : badge.count;
            item.append(icon, name, count);
            strip.append(item);
          }
        }
        const candidate = chooseIndicatorVariant(badges, handCount, displayed => {
          paint(displayed);
          // Measure the actual visible size AFTER switching full/compact mode.
          const panelWidth = Math.min(maxWidth, strip.offsetWidth || maxWidth);
          const panelHeight = Math.max(27, strip.offsetHeight ||
            Math.ceil(displayed.length / (portrait ? 1 : 2)) * 29);
          return placeIndicatorStrip(rect, { width, height },
            { width: panelWidth, height: panelHeight }, occupied, blockers);
        }, compactFirst);
        if (!compactFirst) strip.dataset.lastFullAttempt = String(now);
        strip.dataset.geometryKey = geometryKey;
        if (!candidate) {
          // Keep the native hand count instead of hiding it for an invisible
          // mirror when a compact badge cannot fit either.
          if (player.dataset) player.dataset.grailHandCountMirror = 'false';
          continue;
        }
        active.add(player);
        strip.dataset.compact = String(candidate.compact);
        if (player.dataset) player.dataset.grailHandCountMirror = String(
          Boolean(handCount) && candidate.badges.includes(handCount));
        strip.style.transform = 'none';
        strip.style.left = `${candidate.position.left}px`;
        strip.style.top = `${candidate.position.top}px`;
        strip.dataset.placement = candidate.position.placement;
        occupied.push(candidate.position);
      }
      for (const [player, strip] of strips) {
        if (active.has(player)) continue;
        if (player.dataset) player.dataset.grailHandCountMirror = 'false';
        strip.remove(); strips.delete(player);
      }
      layer.hidden = strips.size === 0;
    },
    stop() {
      for (const player of strips.keys()) {
        if (player.dataset) player.dataset.grailHandCountMirror = 'false';
      }
      layer.remove(); strips.clear();
    },
  };
}
