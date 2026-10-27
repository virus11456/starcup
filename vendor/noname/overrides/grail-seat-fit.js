/* GPL-3.0: presentation-only responsive size cap for ORIGINAL native roles.
 * Never edit player positions, transforms, click handlers or game state.
 * In a compact iPhone portrait match, Noname keeps the same seat centers even
 * when grail.css enlarges the artwork. Fit width to the real neighboring seats. */

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function physicalSeatGeometry(rect, currentScale = 1, origin = 'center center') {
  if (!rect || ![rect.left, rect.right, rect.top, rect.bottom, rect.width, rect.height]
    .every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const scale = currentScale > 0 && Number.isFinite(currentScale) ? currentScale : 1;
  const width = rect.width / scale;
  const height = rect.height / scale;
  // Native position and CSS 'scale' are separate. Recover the pre-scale
  // visual seat center; left/right zoom origins anchor a seat at screen edges.
  const x = origin.startsWith('left') ? rect.left + width / 2
    : origin.startsWith('right') ? rect.right - width / 2
      : (rect.left + rect.right) / 2;
  const y = (rect.top + rect.bottom) / 2;
  return { x, y, width, height };
}

export function fitPortraitSeatScale(seats, {
  desired = 1.38, minimum = 0.58, gap = 8,
} = {}) {
  const valid = (seats || []).filter(seat => seat && [seat.x, seat.y, seat.width, seat.height]
    .every(Number.isFinite) && seat.width > 0 && seat.height > 0);
  if (valid.length <= 1) return desired;
  let fitted = desired;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j];
      const dx = Math.abs(a.x - b.x);
      // Seats in separate upper/lower bands must not shrink one another.
      // Potential y-overlap at the requested zoom is the only reason to
      // consider their horizontal spacing.
      const dy = Math.abs(a.y - b.y);
      const halfHeights = (a.height + b.height) * desired / 2;
      if (dy >= halfHeights * 0.78) continue;
      const halfWidths = (a.width + b.width) / 2;
      if (dx > 0 && halfWidths > 0) {
        fitted = Math.min(fitted, (dx - gap) / halfWidths);
      }
    }
  }
  return Math.round(clamp(fitted, minimum, desired) * 1000) / 1000;
}

export function updatePortraitSeatFit(players, viewport, {
  styleOf = element => getComputedStyle(element),
} = {}) {
  const width = viewport?.width, height = viewport?.height;
  const portrait = Number.isFinite(width) && Number.isFinite(height) &&
    width <= 600 && width > 0 && height > width;
  const visible = (players || []).filter(player =>
    player?.style && player?.dataset &&
    String(player.dataset.position) !== '0' &&
    !player.classList?.contains?.('dead') &&
    !player.classList?.contains?.('hidden'));
  if (!portrait) {
    for (const player of visible) player.style.removeProperty('--grail-portrait-seat-scale');
    return null;
  }
  const measured = [];
  for (const player of visible) {
    const rect = player.getBoundingClientRect?.();
    const raw = styleOf(player)?.scale;
    const nativeScale = raw && raw !== 'none' ? Number.parseFloat(raw) : 1;
    const center = physicalSeatGeometry(
      rect, Number.isFinite(nativeScale) ? nativeScale : 1,
      player.dataset.grailRoleOrigin || 'center center');
    if (center) measured.push(center);
  }
  const next = fitPortraitSeatScale(measured);
  const setting = String(next);
  for (const player of visible) {
    if (player.style.getPropertyValue('--grail-portrait-seat-scale') !== setting)
      player.style.setProperty('--grail-portrait-seat-scale', setting);
  }
  return next;
}
