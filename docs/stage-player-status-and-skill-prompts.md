# Player status badges and unusable optional prompts

## Scope

- Show each seat's public status markers directly next to its native portrait without intercepting clicks or touch interactions. Color-coded, labelled chips show current counts for Holy Shield, healing crosses, crystals, gems, and any other visible native mark. If a theme omits the native mark, public shield/energy counters still render a chip.
- Preserve private information: opponent hands and storage are never inspected, and face-down shield cards are counted rather than read.
- Skip an optional trigger before prompting either a human or AI seat when no playable qualifying card exists for Wind Fury Pursuit, Fire Follow-up, Technique Sword Intent, Double Sword Shadow, Vanity Mastery (including its Earth/Wind-to-missile conversion), or Jealous Pursuit (also requires a legal target). Other effects with useful card-independent outcomes are intentionally unchanged.

## Verification

- `tests/player-indicators.test.mjs` exercises named/count badges, fallback public counts, hidden markers, and opponent information boundaries.
- `tests/optional-skill-prompts.test.mjs` executes filters extracted from the pinned engine for allowed/blocked cards, response timing, view-as conversion, and target availability.
- Run `npm run verify:local` after the final changes; it prepares the pinned engine, builds the Cloudflare Worker bundle, and tests core rules, the prepared engine, transport/SQLite/runtime boundaries, types, and protected HTTP routes.
- Native phone/desktop visual acceptance still requires an actual game viewport; passing logic tests alone does not establish its appearance.

## Release cautions

This stage does not complete automatic takeover when the host permanently closes the tab. Keep Vercel available until Cloudflare migration acceptance finishes. A merge into GitHub `main` is distinct from deploying the Cloudflare Worker.
