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
