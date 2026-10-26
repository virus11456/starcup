// Browsers may expose the install result through prompt() and/or userChoice.
// Always call prompt() once, synchronously from the user's button interaction.
export type InstallOutcome = 'accepted' | 'dismissed' | 'unknown';
type Choice = { outcome: 'accepted' | 'dismissed'; platform?: string };
export type InstallPrompt = Event & {
  prompt(): Promise<Choice | void>;
  userChoice?: Promise<Choice>;
};
export async function requestPwaInstall(event: InstallPrompt): Promise<InstallOutcome> {
  const result = await event.prompt();
  const choice = event.userChoice ? await event.userChoice : result;
  return choice?.outcome === 'accepted' || choice?.outcome === 'dismissed'
    ? choice.outcome : 'unknown';
}
