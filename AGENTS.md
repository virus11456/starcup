<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development and consolidated deployment

- Latest user instruction (2026-10-27): `main` is the production source. Implement changes on a work branch, finish local verification and relevant browser acceptance, then merge completed changes into `main`. Cloudflare Workers Builds now watches only `main`, runs `npm run verify:local`, and deploys with `npm run deploy:vinext` only when verification succeeds. Do not merge unfinished work merely to trigger a deployment. Multiple ready changes can be integrated and verified together before one merge. This supersedes older instructions to release from `cloudflare-migration` or to back up only a particular historical branch. See `docs/deployment-workflow.md`.
- Current released implementation is recorded in `docs/release-20261027-verified-cloudflare.md`; `main` contains the deployed UI fixes and all seven optional-skill guard reverts. Preserve the pinned original card rules. The historical stage notes below describe earlier checkpoints, not the current release branch or current deployment state.

- Latest local work: `docs/stage-host-transport-guard.md` adds an independent native pause/input guard for temporary host transport failure, stale-reply fencing and safe choice-timeout continuation. 239 tests plus 64 built-Worker HTTP checks pass. It builds on `docs/stage-host-lobby-recovery.md` (duplicate-host protection, unstarted-lobby recovery and durable start). Both stages are not deployed; back up only `fix/relay-recovery-20261026`, then consolidate further work before release. In-progress host-close takeover is still unfinished. These stages add no natural-game completions or production SQL traffic. Do not enable hosted Browser Run as an assumed-free workaround; the latest stage documents its verified limits and the native snapshot gaps.

- Read `docs/stage-portrait-cards.md` for the deployed portrait-card stage (`e639f6a`), short-landscape visual fix, manual refinement/synthesis verification and M08–M10 natural completion (solo 10/10, multiplayer 10/10). `docs/release-20261026-stage2.md` records the earlier launcher isolation fix and M07. Backup branch is `fix/relay-recovery-20261026`, not the remote branch sharing the local checkout's name. Documentation-only updates must not trigger deployments. Older handoffs contain historical deployment and scheduling instructions. Host-close takeover remains unfinished.

- Latest instruction supersedes the old schedule: continue development now, finish local implementation and verification, then deploy one consolidated Cloudflare release. The 08:00 automation was disabled on 2026-10-26. Do not wait for or recreate it. Notify the user when Vercel retirement is safe; do not delete it before migration acceptance.
- Latest user instruction (2026-10-26): work in stages and deploy once per completed major stage. Stage work can be backed up on the non-deploying GitHub branch. Do not turn an individual fix or documentation update into its own deployment; see `docs/stage-room-entry-and-role-tags.md` for current acceptance criteria.
- User preference (2026-10-26): finish and test changes locally, then publish one integrated release. Do not use the production Cloudflare deployment for repeated development iterations or push deployment branches for unfinished changes.
- Run `npm run verify:local` before release. It prepares the pinned engine, builds the Cloudflare bundle, runs application/engine/runtime tests, checks types and exercises the built Worker HTTP/password/invitation boundary. Do not run engine preparation/build commands concurrently: they share generated files.
- Use local SQLite and relay fixtures for repetitive storage/connection checks. Local simulations and unit tests do not count toward the requested naturally completed online game totals.
- Do the necessary deployed WebSocket/platform checks only after local checks pass. Record Durable Objects SQL rows written before and after each game and preserve quota for users; stop tests at the documented budget.
- Keep visual verification separate from logic tests. If the available browser cannot reach the local server, record the missing viewport/UI checks rather than claiming that automated logic tests prove the layout.
- Keep Vercel until Cloudflare migration acceptance is complete. A required follow-up fix after live acceptance failure should be developed/tested locally before another release.
