/* GPL-3.0: clarify native response choices without changing their results. */
export function updateResponseCancelLabel(control, event, fallback) {
  if (!control) return;
  // Cancelling a selected skill restores the response picker; it does not
  // accept the attack. Nested prompts keep their own native cancellation.
  const acceptsDamage = ['yingZhan', 'moDan'].includes(event?.name)
    && (!event.skill || event.norestore)
    && !event.custom?.replace?.confirm;
  for (const button of control.childNodes) {
    if (button.link !== 'cancel') continue;
    button.textContent = acceptsDamage ? '承受傷害' : fallback;
  }
}
