<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development and consolidated deployment

- Latest user instruction (2026-10-26): work in stages and deploy once per completed major stage. Stage work can be backed up on the non-deploying GitHub branch. Do not turn an individual fix or documentation update into its own deployment; see `docs/stage-room-entry-and-role-tags.md` for current acceptance criteria.
- User preference (2026-10-26): finish and test changes locally, then publish one integrated release. Do not use the production Cloudflare deployment for repeated development iterations or push deployment branches for unfinished changes.
- Run `npm run verify:local` before release. It prepares the pinned engine, builds the Cloudflare bundle, runs application/engine tests and checks types. Do not run engine preparation/build commands concurrently: they share generated files.
- Use local SQLite and relay fixtures for repetitive storage/connection checks. Local simulations and unit tests do not count toward the requested naturally completed online game totals.
- Do the necessary deployed WebSocket/platform checks only after local checks pass. Record Durable Objects SQL rows written before and after each game and preserve quota for users; stop tests at the documented budget.
- Keep visual verification separate from logic tests. If the available browser cannot reach the local server, record the missing viewport/UI checks rather than claiming that automated logic tests prove the layout.
- Keep Vercel until Cloudflare migration acceptance is complete. A required follow-up fix after live acceptance failure should be developed/tested locally before another release.
