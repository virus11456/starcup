/* GPL-3.0: cosmetic classification only. Native dialog elements, input
   handlers and visibility are owned by the engine. This is called from the
   existing 400ms HUD tick; an empty caption can become visible next tick. */
const readable = value => String(value ?? '').replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ').trim();
const activeChoices = '.buttons .button, .buttons .card, .buttons .tdnode, .buttons .tdnodes, button, input, textarea, select, [contenteditable="true"]';
export function updateActionHints(arena) {
  if (!arena || arena.classList?.contains('choose-character')) return;
  for (const dialog of arena.querySelectorAll(':scope > .dialog:not(.popped)')) {
    const labels = [...dialog.querySelectorAll('.caption, .prompt')];
    // Never restyle a dialog that owns a native skill/target/card choice.
    const isHint = labels.length > 0 && !dialog.querySelector(activeChoices);
    dialog.classList.toggle('grail-action-hint', isHint);
    dialog.classList.toggle('grail-empty-action-hint',
      isHint && !labels.some(label => readable(label.textContent)));
  }
}
