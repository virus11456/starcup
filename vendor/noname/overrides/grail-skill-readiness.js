/* UI-only notes for legal optional response skills. Never alter a trigger,
 * costs, action queue, selection controls, or the pinned game's filters. */
export function optionalSkillReadinessNotes(skillIds, player, get) {
  if (!skillIds?.includes?.('fengNuZhuiJi') ||
      typeof player?.getCards !== 'function' ||
      typeof get?.xiBie !== 'function' ||
      typeof get?.type !== 'function') return [];
  const cards = player.getCards('h');
  if (!Array.isArray(cards)) return [];
  const windAttack = cards.some(card =>
    get.xiBie(card) === 'feng' && get.type(card) === 'gongJi');
  return windAttack ? [] : [
    '風怒追擊：目前手上沒有風系攻擊牌。依原規則仍可發動技能，但額外攻擊可能無牌可用。',
  ];
}
