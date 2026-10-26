/* Origin for native scaled role cards near viewport edges. Pure geometry;
 * the original CSS transform/hit handlers remain owned by Noname. */
export function playerZoomOrigin(rect, viewportWidth, margin = 34) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.right)
      || !(viewportWidth > 0)) return 'center center';
  if (rect.left <= margin) return 'left center';
  if (rect.right >= viewportWidth - margin) return 'right center';
  return 'center center';
}
export function updatePlayerZoomOrigins(players, width) {
  for (const player of players || []) {
    if (!player?.style || !player.dataset || String(player.dataset.position) === '0') continue;
    const origin = playerZoomOrigin(player.getBoundingClientRect?.(), width);
    if (player.dataset.grailRoleOrigin === origin) continue;
    player.dataset.grailRoleOrigin = origin;
    player.style.setProperty('--grail-role-origin', origin);
  }
}
