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


// Pure viewport geometry: a strip can never extend beyond the visible screen.
// Prefer directly below the portrait, then above it. Already placed strips
// are avoided when there is room, so multiple marks don't stack on a neighbor.
export function placeIndicatorStrip(rect, viewport, size, occupied = []) {
  const margin = 8, gap = 8;
  const width = Math.min(Math.max(1, size.width), Math.max(1, viewport.width - margin * 2));
  const height = Math.min(Math.max(1, size.height), Math.max(1, viewport.height - margin * 2));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const center = rect.left + rect.width / 2;
  const left = clamp(
    center >= viewport.width * .7 ? rect.right - width
      : center <= viewport.width * .3 ? rect.left
        : center - width / 2,
    margin, Math.max(margin, viewport.width - width - margin));
  const below = { left, top: clamp(rect.bottom + gap, margin, Math.max(margin, viewport.height - height - margin)), width, height, placement: 'below' };
  const above = { left, top: clamp(rect.top - height - gap, margin, Math.max(margin, viewport.height - height - margin)), width, height, placement: 'above' };
  const clashes = (a,b) => a.left < b.left + b.width + 4 && a.left + a.width + 4 > b.left
    && a.top < b.top + b.height + 4 && a.top + a.height + 4 > b.top;
  const preferred = rect.bottom + height + gap <= viewport.height - margin ? [below, above] : [above, below];
  return preferred.find(item => !occupied.some(used => clashes(item, used))) || preferred[0];
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
      const active = new Set();
      const occupied = [];
      for (const player of players) {
        const handCount = publicHandCountBadge(player);
        if (player.dataset) player.dataset.grailHandCountMirror = String(Boolean(handCount));
        const badges = [...(handCount ? [handCount] : []), ...publicPlayerIndicators(player, context)];
        const rect = player.getBoundingClientRect?.();
        if (!badges.length || !rect || rect.width <= 0 || rect.height <= 0) continue;
        active.add(player);
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
        const signature = JSON.stringify(badges);
        if (strip.dataset.signature !== signature) {
          strip.dataset.signature = signature;
          strip.replaceChildren();
          for (const badge of badges) {
            const item = doc.createElement('span');
            item.className = 'grail-indicator grail-indicator-' + badge.kind;
            item.title = `${label}：${badge.label}，${badge.count}`;
            const icon = doc.createElement('span'); icon.className = 'grail-indicator-icon'; icon.textContent = badge.icon; icon.setAttribute('aria-hidden', 'true');
            const name = doc.createElement('span'); name.className = 'grail-indicator-name'; name.textContent = badge.label;
            const count = doc.createElement('b'); count.textContent = badge.count === '啟用中' ? '✓' : badge.count;
            item.append(icon, name, count);
            strip.append(item);
          }
        }
        // Statuses are outside the native player hit box; native markers and
        // the portrait retain their existing click / touch handlers.
        const width = doc.defaultView?.innerWidth ?? innerWidth;
        const height = doc.defaultView?.innerHeight ?? innerHeight;
        const portrait = height > width;
        const maxWidth = portrait && width <= 600 ? Math.min(158, width * .44)
          : width <= 1049 ? Math.min(210, width * .30) : Math.min(240, width * .22);
        strip.style.maxWidth = `${maxWidth}px`;
        const panelWidth = Math.min(maxWidth, strip.offsetWidth || maxWidth);
        const panelHeight = Math.max(27, strip.offsetHeight || Math.ceil(badges.length / (portrait ? 1 : 2)) * 29);
        const position = placeIndicatorStrip(rect, { width, height }, { width: panelWidth, height: panelHeight }, occupied);
        strip.style.transform = 'none';
        strip.style.left = `${position.left}px`;
        strip.style.top = `${position.top}px`;
        strip.dataset.placement = position.placement;
        occupied.push(position);
      }
      for (const [player, strip] of strips) {
        if (active.has(player)) continue;
        strip.remove(); strips.delete(player);
      }
      layer.hidden = strips.size === 0;
    },
    stop() { layer.remove(); strips.clear(); },
  };
}
