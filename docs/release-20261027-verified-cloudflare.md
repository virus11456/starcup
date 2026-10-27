# 2026-10-27 Cloudflare consolidated release

## Source selection and original rules

- The supplied workspace initially contained no checkout. Cloned `virus11456/starcup` into `starcup/`; there was no previous local uncommitted state to recover or compare. The referenced conversation's available messages contained content-reference placeholders, so Git history and the existing rule-integrity audit were used as the concrete evidence.
- Remote `main`: `098c5d183f57e9784e3d91168c08554e6414f1c3`.
- Remote `cloudflare-migration`: `789b70bca2139da6684c1072c0a90af8590a62d5` (38 commits ahead of main; 67 changed files).
- Remote `work/gold-breath-hud-20261027`: `2eb222be95d42c692666481e07cb82a9dec33ecd` (17 commits ahead of migration; 10 changed files). This was the release base.
- The migration branch still contained six extra skill guards. The latest backup branch already contained the seven-guard reverts; its earlier history must not be used as the release source. `scripts/optional-action-guards.mjs` and its obsolete test had already been removed in that branch.
- Preserved the original filters for 劍影、風怒追擊、修羅連斬、技之劍意、二重劍影、虛榮掌握、嫉妒追放. No card rules, skill costs, action counts, targets or win conditions were changed for this release.
- Added `tests/pinned-rule-parity.test.mjs`: compares every original skill definition in all seven enabled role packs against the freshly generated engine after the existing localization transform. Explicit assertions cover the seven reverted guards. This is source parity, not a claim that every character has completed a live game.
- Engine pin: `RancherJie/noname_xingbei@bd227231b6edeba5b32f906673b9f3cb0091b90c`; archive SHA-256 `4ef10b804f6de7664212557d1c87d89e68c685bfdb8c3841654c1aa61210a127`.

## Confirmed fixes and preserved UI

- Corrected test fixture URL handling with `fileURLToPath`; URL `.pathname` broke tests in the Chinese workspace path.
- Fixed native Options menu scaling at narrow viewports. The engine's body scaling had reduced the menu and its text excessively. Menu tabs now fit the viewport; the native start button stays inside the shorter landscape panel.
- Preserved gold border breathing, tutorial overlay stacking, hidden floating hamburger, and the visible Options button from the release base.
- Added `.pnpm-store/` to ignored local artifacts. Dependencies and lockfile were not changed.

## Validation

- Full final `npm run verify:local`: exit 0; 115 application tests, 208 engine tests, 10 real workerd/SQLite/WebSocket tests, typecheck, vinext build and 64 built-Worker HTTP checks passed. It reran pinned engine preparation. `outputs/verify-local-final.log` records the run.
- Next webpack build also passed (`outputs/build-next.log`). The final CSS-only button-position adjustment was subsequently rebuilt and checked by the full vinext/Worker release pipeline.
- Wrangler dry-run packaged the final Worker with 123 additional modules plus its entry point. Direct API asset manifest contains 1,021 files, using Wrangler's BLAKE3 hash algorithm and `.assetsignore` exclusions. Two changed asset hashes required upload; existing hashes were reused by Cloudflare.
- Actual macOS in-app browser validation: 390×844, 844×390, 768×1024 and 1440×900 layouts; Options menu above HUD, native start control visible, floating hamburger hidden. This is responsive desktop-browser testing, not physical iPhone/iPad testing.
- Local real gameplay: choose Wind Sword Saint; inspect and select gold cards; observe breathing opacity vary; select card/target and confirm attacks; cancel optional wind pursuit even without a matching remaining wind attack; refine a gem; reach 劍影 and cancel. The gem remained before confirmation and after cancel. No synthetic game-state injection was used.
- Final landscape and portrait menu screenshots: `outputs/qa-menu-landscape-final.jpg`, `outputs/qa-menu-390-final.jpg`. Skill cancellation evidence: `outputs/qa-jianying-before-cancel.jpg`, `outputs/qa-jianying-after-cancel.jpg`.

## Production release

- Published through the connected Cloudflare MCP and official direct asset upload flow. Local Wrangler authentication was not required. The temporary upload JWT was used only for its scoped Cloudflare asset endpoint.
- Worker: `star-grail-online`; URL: https://star-grail-online.localhost20000.workers.dev/.
- Version: `f7ace0aa-7f94-4c43-9d9a-1215d9f7822c` (number 54, tag `verified-rules-20261027`).
- Deployment: `08ef6188-e367-4d33-9d59-e2288b381039`, created `2026-10-27T07:09:17.526808Z` (15:09 Taipei), 100% traffic. Read-back confirmed the version and percentage.
- Previous production version for rollback: `d2b2a539-7868-4aaf-9fa9-751fa3740f53`.
- Preserved migration tag `v1`, both existing Durable Object namespace IDs, all three existing secret bindings, compatibility date `2026-10-25`, `nodejs_compat`, and asset routing. No secret values were read or changed. Vercel and the deployment branches were not changed.
- Live HTTP checks: `/access` 200 with private/no-store and noindex; `/` and `/engine/index.html` redirect to access; unauthenticated room and socket endpoints 401; manifest and favicon 200. The user completed the existing website-password login; homepage showed multiplayer service ready and no public rooms; the 68-role/150-card launcher loaded.
- Authenticated production browser acceptance continued through engine load, Options / 新手嚮導 panel, free character selection, Wind Sword Saint confirmation and a running four-player local-against-AI game. The owned 地技 / 烈風技 card had `grail-special-gold-breathe` active (observed opacity 0.969609); browser warning/error log was empty. Screenshot: `outputs/production-game.jpg`. This solo game runs in the browser and does not create a production multiplayer room.
- Cloudflare analytics returned `Rate limiter budget depleted` on the first GraphQL query. Additional production room-writing tests were withheld until live SQL usage can be measured against the repository's 50,000-row test-stop budget. Local real workerd WebSocket tests passed; no new natural online game completions are claimed.

Generated logs, screenshots, deploy payloads and temporary upload credentials are ignored under `outputs/`. Do not commit those payloads or credentials.
