/* GPL-3.0: clarify native response choices without changing their results. */
export function updateResponseCancelLabel(control, event, fallback) {
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
  for (const button of control.childNodes) {
    if (button.dataset) {
      const action = button.link === 'ok' ? 'confirm' : button.link === 'cancel' ? acceptsDamage ? 'damage' : 'cancel' : '';
      if (action) button.dataset.grailAction = action;
      else delete button.dataset.grailAction;
    }
    if (button.link !== 'cancel') continue;
    button.textContent = acceptsDamage ? '承受傷害' : fallback;
  }
}
