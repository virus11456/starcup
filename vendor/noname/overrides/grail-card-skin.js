/* GPL-3.0: cosmetic attributes on the local hand only. No card copies,
   event handlers, rule fields or opponent hands are modified. */
const elements = new Set(['an', 'shui', 'huo', 'feng', 'lei', 'di', 'guang']);
export function cardElement(card) {
  return elements.has(card?.xiBie) ? card.xiBie : '';
}
// A printed unique-attack stamp matters only to the character who actually
// owns that skill. It must not turn gold in another character's hand.
export function isOwnSpecialAttack(card, player, { lib, get } = {}) {
  if (!card || !player || !lib?.character) return false;
  // Use the actual printed attack type; skill modifications during a turn
  // must not affect a purely decorative hand border.
  const printedType = lib.card?.[card.name]?.type || get?.type?.(card, false) || card.type;
  if (printedType !== 'gongJi') return false;
  if (typeof card.duYou !== 'string' || !card.duYou) return false;
  const owned = new Set([player.name1, player.name2, player.name]
    .flatMap(name => lib.character[name]?.[3] || []));
  // The printed card stamp plus the character's innate skill list is enough.
  // `lib.skill[id].duYou` can be missing during native pack initialization or
  // replaced by a runtime wrapper even though the printed ability is still
  // that character's. Never depend on it for a presentation-only highlight.
  return card.duYou.split(lib.natureSeparator || '|').some(id => owned.has(id));
}
export function createHandSkin(context) {
  let previous = new Set();
  return {
    update(me) {
      const current = new Set(me?.getCards?.('h') || []);
      for (const card of previous) if (!current.has(card) && card.dataset) {
        delete card.dataset.grailElement;
        delete card.dataset.grailOwnSpecial;
      }
      for (const card of current) {
        if (!card.dataset) continue;
        const hidden = card.classList?.contains('infohidden');
        const element = hidden ? '' : cardElement(card);
        if (!element) delete card.dataset.grailElement;
        else if (card.dataset.grailElement !== element) card.dataset.grailElement = element;
        if (!hidden && isOwnSpecialAttack(card, me, context)) card.dataset.grailOwnSpecial = 'true';
        else delete card.dataset.grailOwnSpecial;
      }
      previous = current;
    },
    stop() {
      for (const card of previous) if (card.dataset) {
        delete card.dataset.grailElement;
        delete card.dataset.grailOwnSpecial;
      }
      previous.clear();
    },
  };
}
