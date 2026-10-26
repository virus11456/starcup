/* GPL-3.0: cosmetic classification only. Native dialog elements, input
   handlers and visibility are owned by the engine. This is called from the
   existing 400ms HUD tick; an empty caption can become visible next tick. */
const readable = value => String(value ?? '').replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ').trim();
// Noname uses div-based .button/.pointerspan/.pointerdiv nodes for actual
// choices, including skill dialogs whose controls do not live in .buttons.
// Do not reposition or disable pointer events on ANY actionable dialog.
const activeChoices = [
  '.buttons', '.button', '.card', '.tdnode', '.tdnodes',
  '.pointerdiv', '.pointerspan', '.clickable', '.popup',
  '.row-container', '.item-container', 'img', 'video', 'canvas', 'svg',
  '[role="button"]', '[role="link"]', 'a[href]', 'label[for]',
  '[tabindex]:not([tabindex="-1"])',
  'button', 'input', 'textarea', 'select', 'details', 'summary',
  '[contenteditable="true"]',
].join(', ');
export function updateActionHints(arena, hudLabel = null, scoreboardVisible = false) {
  if (!arena || arena.classList?.contains('choose-character')) {
    if (hudLabel) { hudLabel.hidden = true; hudLabel.textContent = ''; }
    return;
  }
  let phaseText = '';
  for (const dialog of arena.querySelectorAll(':scope > .dialog:not(.popped)')) {
    // The pinned noname Dialog.addText() writes <div class="text center">
    // directly inside .content rather than creating a .caption. Include
    // this actual native text shape or Safari can still show a blank bar.
    const labels = [...dialog.querySelectorAll('.caption, .prompt, .content > .text')];
    // Never restyle a dialog that owns a native skill/target/card choice.
    const isHint = labels.length > 0 && !dialog.querySelector(activeChoices);
    dialog.classList.toggle('grail-action-hint', isHint);
    const visible = labels.map(label => readable(label.textContent)).filter(Boolean);
    dialog.classList.toggle('grail-empty-action-hint', isHint && visible.length === 0);
    // Do not move the engine's live DOM into our HUD. Mirror ONLY passive
    // printed text, never private values, event handlers or selectable nodes.
    const inline = isHint && visible.length > 0 && scoreboardVisible && !!hudLabel;
    dialog.classList.toggle('grail-inline-action-hint', inline);
    if (inline) phaseText = visible.join(' ').slice(0, 100);
  }
  if (hudLabel) {
    if (hudLabel.textContent !== phaseText) hudLabel.textContent = phaseText;
    hudLabel.hidden = !phaseText;
  }
}

// Position a passive text-only instruction in a clear lower-middle HUD lane.
// Geometry comes from visible PUBLIC player portraits and controls; this is
// cosmetic and never calls native target/skill handlers.
export function chooseActionHintTop({ width, height, scoreboard, players = [], controls, hand },
  hintSize = { width: 320, height: 52 }) {
  if (!(width > 0 && height > 0)) return null;
  const margin = 12, gap = 12, hintHeight = Math.max(24, hintSize.height || 52);
  const hintWidth = Math.min(width - margin * 2, Math.max(80, hintSize.width || 320));
  const left = (width - hintWidth) / 2;
  const scoreboardBottom = Number.isFinite(scoreboard?.bottom) ? scoreboard.bottom : height * .15;
  const min = Math.max(margin, scoreboardBottom + gap);
  const controlsTop = Number.isFinite(controls?.top) && controls.top > min
    ? controls.top : height - 24;
  const handTop = Number.isFinite(hand?.top) && hand.top > min
    ? hand.top : height - 24;
  const max = Math.max(min, Math.min(height - hintHeight - margin, controlsTop - hintHeight - gap, handTop - hintHeight - gap));
  const clamp = value => Math.max(min, Math.min(max, value));
  const ideal = clamp(height * (height > width ? .565 : .61));
  const items = [controls, hand, ...players].filter(rect =>
    rect && Number.isFinite(rect.left) && Number.isFinite(rect.right) &&
    Number.isFinite(rect.top) && Number.isFinite(rect.bottom));
  const overlaps = top => items.some(rect =>
    left < rect.right + 6 && left + hintWidth > rect.left - 6 &&
    top < rect.bottom + 6 && top + hintHeight > rect.top - 6);
  const candidates = [ideal];
  // Look for the closest safe interval without ever changing native nodes.
  for (const rect of items) {
    candidates.push(clamp(rect.top - hintHeight - gap), clamp(rect.bottom + gap));
  }
  candidates.push(min, max);
  const safe = candidates.filter(top => top >= min && top <= max && !overlaps(top));
  return safe.length ? safe.sort((a,b) => Math.abs(a-ideal) - Math.abs(b-ideal))[0] : ideal;
}
export function positionActionHint(hint, layout) {
  if (!hint || hint.hidden || !layout || !(layout.width > 0)) return;
  const preferredWidth = Math.min(540, layout.width - 28);
  const top = chooseActionHintTop(layout, {
    width: Math.min(preferredWidth, hint.offsetWidth || preferredWidth),
    height: hint.offsetHeight || 60,
  });
  if (top !== null) hint.style.top = `${Math.round(top)}px`;
}
