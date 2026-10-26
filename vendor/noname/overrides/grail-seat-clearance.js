/* Presentation-only seat clearance: native player nodes keep their
 * transforms and target handlers. Return a physical CSS-pixel shift that
 * can be applied through an independent CSS 'translate' property. */
export function scoreboardSeatShift(score, seat, previous = 0, { gap = 14, max = 68 } = {}) {
  if (!score || !seat || ![score.left, score.right, score.bottom, seat.left,
    seat.right, seat.top].every(Number.isFinite)) return 0;
  // A left/right outer seat that never touches the scoreboard must not move.
  if (seat.right <= score.left + 2 || seat.left >= score.right - 2) return 0;
  // getBoundingClientRect includes the previous CSS translate. Subtract the
  // shift before measuring, or the position will oscillate every HUD tick.
  const baseTop = seat.top - Math.max(0, Number(previous) || 0);
  return Math.min(max, Math.max(0, Math.ceil(score.bottom + gap - baseTop)));
}
export function updateScoreboardSeatClearance(players, scoreboard, width, height,
  { enabled = true, isChoosing = false } = {}) {
  const portraitTouch = width <= 1049 && height > width;
  const score = enabled && portraitTouch && !isChoosing
    ? scoreboard?.getBoundingClientRect?.() : null;
  for (const player of players || []) {
    if (!player?.style || !player.dataset || String(player.dataset.position) === '0') continue;
    const previous = Number(player.dataset.grailScoreShift) || 0;
    const next = scoreboardSeatShift(score, player.getBoundingClientRect?.(), previous);
    if (next !== previous) {
      player.dataset.grailScoreShift = String(next);
      player.style.setProperty('--grail-score-shift', `${next}px`);
    }
  }
}
