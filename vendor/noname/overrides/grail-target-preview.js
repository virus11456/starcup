/* GPL-3.0: purely visual preview of the user's NATIVE selected card and
 * NATIVE selected targets. No click handling, selection changes or rule calls.
 * The SVG floats in the existing viewport-aligned HUD, not in scaled #arena. */

export function selectedCardTargetPreview({ ui, game, event, get, lib } = {}) {
  if (!ui?.arena || ui.arena.classList?.contains('choose-character') ||
      !event || !game?.me || event.player !== game.me ||
      typeof event.filterTarget !== 'function') return null;
  const cards = ui.selected?.cards;
  const targets = ui.selected?.targets;
  if (!Array.isArray(cards) || !Array.isArray(targets) ||
      cards.length === 0 || targets.length === 0) return null;
  const owned = game.me.getCards?.('h') || [];
  if (!Array.isArray(owned)) return null;
  const card = cards.find(item => {
    if (!owned.includes(item) || item.classList?.contains('infohidden')) return false;
    const type = item.type || lib?.card?.[item.name]?.type || get?.type?.(item, false);
    return type === 'gongJi' || type === 'faShu';
  });
  if (!card) return null;
  const type = card.type || lib?.card?.[card.name]?.type || get?.type?.(card, false);
  const selected = targets.filter(target =>
    game.players?.includes(target) && target.classList?.contains('selected'));
  if (!selected.length) return null;
  return { card, targets: selected, kind: type === 'gongJi' ? 'attack' : 'spell' };
}

export function cardToTargetLine(cardRect, targetRect) {
  if (!cardRect || !targetRect || cardRect.width <= 0 || cardRect.height <= 0 ||
      targetRect.width <= 0 || targetRect.height <= 0) return null;
  const cx = cardRect.left + cardRect.width / 2;
  const cy = cardRect.top + cardRect.height / 2;
  const tx = targetRect.left + targetRect.width / 2;
  const ty = targetRect.top + targetRect.height / 2;
  const dx = tx - cx, dy = ty - cy;
  if (Math.hypot(dx, dy) < 8) return null;
  const edge = (rect, x, y, vx, vy) => {
    const sx = Math.abs(vx) > 0.001 ? rect.width / (2 * Math.abs(vx)) : Infinity;
    const sy = Math.abs(vy) > 0.001 ? rect.height / (2 * Math.abs(vy)) : Infinity;
    const scale = Math.min(sx, sy);
    return { x: x + vx * scale, y: y + vy * scale };
  };
  const from = edge(cardRect, cx, cy, dx, dy);
  const to = edge(targetRect, tx, ty, -dx, -dy);
  return { from, to };
}

export function createTargetPreview({ hud, ui, game, get, lib, event,
  doc = document, win = window } = {}) {
  const xmlns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(xmlns, 'svg');
  svg.id = 'grail-target-preview';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const nodes = new Map();
  hud.append(svg);
  let stopped = false, queued = false;
  function update() {
    if (stopped) return;
    const current = selectedCardTargetPreview({ ui, game, get, lib, event: event?.() });
    const visible = new Set();
    const width = win.innerWidth, height = win.innerHeight;
    if (current && width > 0 && height > 0) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.dataset.kind = current.kind;
      for (const target of current.targets) {
        const points = cardToTargetLine(current.card.getBoundingClientRect?.(),
          target.getBoundingClientRect?.());
        if (!points) continue;
        const { from, to } = points;
        if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) continue;
        visible.add(target);
        let group = nodes.get(target);
        if (!group) {
          group = doc.createElementNS(xmlns, 'g');
          const under = doc.createElementNS(xmlns, 'line');
          under.setAttribute('class', 'grail-target-line-halo');
          const line = doc.createElementNS(xmlns, 'line');
          line.setAttribute('class', 'grail-target-line-core');
          const dot = doc.createElementNS(xmlns, 'circle');
          dot.setAttribute('class', 'grail-target-line-end');
          dot.setAttribute('r', '6');
          group.append(under, line, dot);
          nodes.set(target, group); svg.append(group);
        }
        const [halo, line, dot] = group.children;
        for (const el of [halo, line]) {
          el.setAttribute('x1', String(from.x));
          el.setAttribute('y1', String(from.y));
          el.setAttribute('x2', String(to.x));
          el.setAttribute('y2', String(to.y));
        }
        dot.setAttribute('cx', String(to.x));
        dot.setAttribute('cy', String(to.y));
      }
    }
    for (const [target, group] of nodes) if (!visible.has(target)) {
      group.remove(); nodes.delete(target);
    }
    svg.hidden = visible.size === 0;
  }
  function refreshAfterInput() {
    if (stopped || queued) return;
    queued = true;
    win.requestAnimationFrame(() => { queued = false; update(); });
  }
  for (const type of ['click', 'pointerup', 'touchend']) doc.addEventListener(type, refreshAfterInput, true);
  win.addEventListener('resize', refreshAfterInput);
  update();
  return { update, stop() {
    if (stopped) return;
    stopped = true;
    for (const type of ['click', 'pointerup', 'touchend']) doc.removeEventListener(type, refreshAfterInput, true);
    win.removeEventListener('resize', refreshAfterInput);
    nodes.clear();
    svg.remove();
  } };
}
