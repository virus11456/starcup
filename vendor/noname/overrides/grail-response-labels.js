/* GPL-3.0: clarify native response choices without changing their results. */
function isFinalOptionalTurnAction(event) {
  // xingDong consumes one action after each chooseToUse result, including a
  // cancelled one. The active action is normally still counted; the last
  // extra action is already popped from its queue when the picker opens.
  // A selected skill's cancel button instead returns to action selection.
  if (!event?.action || !['gongJiOrFaShu', 'gongJi', 'faShu'].includes(event.name)
    || event.forced || event.skill || event._backup || event.custom?.replace?.confirm) return false;
  const actions = event.player?.storage;
  if (!actions || !Array.isArray(actions.extraXingDong)
    || !['gongJiOrFaShu', 'gongJi', 'faShu'].every(key => Number.isFinite(Number(actions[key])))) return false;
  const pending = ['gongJiOrFaShu', 'gongJi', 'faShu']
    .reduce((count, key) => count + Math.max(0, Number(actions[key]) || 0), 0);
  const extras = Array.isArray(actions.extraXingDong) ? actions.extraXingDong.length : 0;
  return pending <= 1 && extras === 0;
}

export function updateResponseCancelLabel(control, event, fallback, recenter) {
  if (!control) return;
  // Cancelling a selected skill restores the response picker; it does not
  // accept the attack. Magic Burst's optional discard is also an explicit
  // damage-or-discard choice; its later forced caster discard is not.
  const magicBurstDamage = event?.name === 'chooseToDiscard' && !event.forced
    && typeof event.prompt === 'string'
    && /^(?:棄置1張法術牌，否則|弃置1张法术牌，否则).*(?:對你造成2點法術傷害|对你造成2点法术伤害)/.test(event.prompt);
  const acceptsDamage = (['yingZhan', 'moDan'].includes(event?.name) || magicBurstDamage)
    && (!event.skill || event.norestore)
    && !event.custom?.replace?.confirm;
  const endsTurn = !acceptsDamage && isFinalOptionalTurnAction(event);
  const pending = event?.player?.storage;
  const knownActions = pending && Array.isArray(pending.extraXingDong) &&
    ['gongJiOrFaShu', 'gongJi', 'faShu'].every(key =>
      Number.isFinite(Number(pending[key])));
  const skipsAction = !acceptsDamage && !endsTurn && event?.action && knownActions &&
    ['gongJiOrFaShu', 'gongJi', 'faShu'].includes(event.name) &&
    !event.forced && !event.skill && !event._backup &&
    !event.custom?.replace?.confirm;
  let changed = false;
  for (const button of control.childNodes) {
    if (button.dataset) {
      const action = button.link === 'ok' ? 'confirm' : button.link === 'cancel'
        ? acceptsDamage ? 'damage' : endsTurn ? 'end-turn' : 'cancel' : '';
      if (action) button.dataset.grailAction = action;
      else delete button.dataset.grailAction;
    }
    if (button.link !== 'cancel') continue;
    const label = acceptsDamage ? '承受傷害' : endsTurn ? '結束回合'
      : skipsAction ? '略過本次行動' : fallback;
    if (button.textContent !== label) {
      button.textContent = label;
      changed = true;
    }
  }
  if (!changed) return;
  // Native Control.replace() measures its old 「取消」 text and fixes the
  // parent's inline width before our label changes. Without recalculation,
  // the longer damage label is physically clipped by overflow:hidden.
  // Read only the existing button sizes; never rebuild nodes or handlers.
  const width = Array.from(control.childNodes).reduce((total, button) =>
    total + (Number(button.offsetWidth) || 0), 0);
  if (width > 0 && control.style) control.style.width = width + 'px';
  if (typeof recenter === 'function') recenter();
}
