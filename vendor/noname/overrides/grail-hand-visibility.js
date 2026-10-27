/* Presentation-only safeguard for the pinned Noname hand renderer.
 * Do not move/remove/recreate cards or change the engine's hand/rule state. */
export function createHandVisibilityRecovery({
  game, ui, now = () => Date.now(),
  styleOf = card => getComputedStyle(card),
  settleMs = 1200,
} = {}) {
  const firstHiddenAt = new WeakMap();
  const tried = new WeakSet();

  function update() {
    const me = game?.me;
    if (!me?.getCards || !ui?.handcards1 || !ui?.handcards2 ||
        !ui?.handcards1Container || !ui?.handcards2Container ||
        typeof ui.updatehl !== 'function' ||
        ui.arena?.classList?.contains('choose-character') ||
        ui.arena?.classList?.contains('hidden_handcard')) return false;

    // The game engine's getCards('h') is the authoritative current hand.
    // Check ONLY those native nodes in its two hand containers, not thrown,
    // ghost, or private opponent cards. No card content is inspected.
    const actualHand = me.getCards('h') || [];
    const mounted = new Set([
      ...ui.handcards1.children, ...ui.handcards2.children,
    ]);
    const instant = now();
    let stale = false;
    for (const card of actualHand) {
      if (!mounted.has(card) || !card?.classList ||
          card.classList.contains('removing') ||
          card.classList.contains('infohidden')) continue;
      const drawHidden = card.classList.contains('drawinghidden');
      const style = drawHidden ? null : styleOf(card);
      const invisible = drawHidden || style?.display === 'none' ||
        style?.visibility === 'hidden' ||
        (style?.opacity != null && Number(style.opacity) <= 0.01);
      if (!invisible) {
        firstHiddenAt.delete(card);
        tried.delete(card);
        continue;
      }
      if (!firstHiddenAt.has(card)) firstHiddenAt.set(card, instant);
      if (instant - firstHiddenAt.get(card) >= settleMs && !tried.has(card)) {
        tried.add(card);
        stale = true;
      }
    }
    if (!stale) return false;
    // ui.updatehl() only recalculates native hand transforms/width and
    // clears stale drawinghidden. It does not draw, discard or resolve skills.
    ui.updatehl();
    return true;
  }
  return { update };
}
