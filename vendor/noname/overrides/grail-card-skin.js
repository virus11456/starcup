/* GPL-3.0: cosmetic attributes on the local hand only. No card copies,
   event handlers, rule fields or opponent hands are modified. */
const elements = new Set(['an', 'shui', 'huo', 'feng', 'lei', 'di', 'guang']);
export function cardElement(card) {
  return elements.has(card?.xiBie) ? card.xiBie : '';
}
export function createHandSkin() {
  let previous = new Set();
  return {
    update(me) {
      const current = new Set(me?.getCards?.('h') || []);
      for (const card of previous) if (!current.has(card) && card.dataset) delete card.dataset.grailElement;
      for (const card of current) {
        if (!card.dataset) continue;
        const element = card.classList?.contains('infohidden') ? '' : cardElement(card);
        if (!element) delete card.dataset.grailElement;
        else if (card.dataset.grailElement !== element) card.dataset.grailElement = element;
      }
      previous = current;
    },
    stop() {
      for (const card of previous) if (card.dataset) delete card.dataset.grailElement;
      previous.clear();
    },
  };
}
