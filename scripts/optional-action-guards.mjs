// This function is serialized into the pinned character pack at build time.
// Keep it self-contained: inside the engine only event/player/get/lib exist.
export function canOfferExtraAttackForCrystal(event, player, get, lib) {
  // `xingDong` deducts the current action *after* gongJiAfter has resolved.
  // Count that in-flight action as already spent or the very last normal
  // attack always looks like an unused action at the skill's trigger time.
  const stage = event.getParent?.('xingDong');
  const currentUsesNormalAction = stage && !stage.extraXingDong &&
    (stage.xingDong === 'gongJiOrFaShu' || stage.xingDong === 'gongJi' || stage.xingDong === 'faShu');
  const normalActionsLeft = (player.storage?.gongJiOrFaShu ?? 0) +
    (player.storage?.gongJi ?? 0) + (player.storage?.faShu ?? 0) -
    (currentUsesNormalAction ? 1 : 0);
  if (normalActionsLeft > 0 || (player.storage?.extraXingDong?.length ?? 0) > 0) return false;

  // Energy must not be offered for a bonus action that cannot use any of
  // the player's hand cards. An available card also needs a legal target.
  return player.countCards('h', card =>
    get.type(card) === 'gongJi' &&
    lib.filter.cardEnabled(card, player, 'forceEnable') &&
    player.hasUseTarget(card)
  ) > 0;
}
