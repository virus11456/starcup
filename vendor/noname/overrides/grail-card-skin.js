/* GPL-3.0: cosmetic attributes on the local hand only. No card copies,
   event handlers, rule fields or opponent hands are modified. */
const elements = new Set(['an', 'shui', 'huo', 'feng', 'lei', 'di', 'guang']);
export function cardElement(card) {
  return elements.has(card?.xiBie) ? card.xiBie : '';
}
// A printed unique-attack stamp matters only to the character who actually
// owns that skill. It must not turn gold in another character's hand.
export function isOwnSpecialAttack(card, player, { lib, get } = {}) {
  if (!card || !player || !lib?.character || !lib?.skill || !get?.type || get.type(card) !== 'gongJi') return false;
  if (typeof card.duYou !== 'string' || !card.duYou) return false;
  const owned = new Set([player.name1, player.name2, player.name]
    .flatMap(name => lib.character[name]?.[3] || []));
  return card.duYou.split(lib.natureSeparator || '|').some(id =>
    owned.has(id) && lib.skill[id]?.duYou === id);
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
