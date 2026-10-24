// Select only from server-provided legal actions and the requesting player's view.
export function choosePublicCommand(room) {
  const me = room.players.find(p => p.id === room.me);
  const legal = room.actions.filter(a => a.enabled);
  const byType = type => legal.find(a => a.type === type);
  let action;
  if (room.overflow) {
    action = byType("discard");
    return { type: "discard", cards: me.hand.slice(0, action.count).map(c => c.id) };
  }
  if (room.pending) action = byType("shield") || byType("block") || byType("counter") || byType("take");
  else if (room.weak) action = me.hand.length <= 3 ? byType("weakDraw") : byType("weakSkip");
  else if (me.hand.length <= 3) action = byType("synthesize") || byType("buy");
  action ||= legal.find(a => a.type === "play") || legal[0];
  if (!action) throw new Error("No legal action offered to the active player");
  const card = me.hand.find(c => c.id === action.cardId);
  const targets = room.players.filter(p => action.targets.includes(p.id));
  targets.sort((a, b) => {
    const prefer = p => Number(card?.kind === "shield" ? p.team === me.team : p.team !== me.team);
    return prefer(b) - prefer(a) || b.handCount - a.handCount;
  });
  return { type: action.type, cardId: action.cardId, target: targets[0]?.id };
}
