# Production deployment workflow

Updated 2026-10-27 following the user's instruction to use `main` for automatic Cloudflare deployments.

## Making and combining changes

1. Start work from current `main` on a work branch. Other tasks may use separate work branches.
2. Preserve original card rules; do not restore the seven removed optional-skill preconditions. Keep incomplete work off `main`.
3. Run `npm run verify:local` and the browser checks appropriate to the change before merging. If combining several ready branches, verify the combined result, including conflict resolutions.
4. Merge the completed result into `main`. Cloudflare automatically runs its verification/build pipeline and publishes only after success.
5. Check the Cloudflare build result, deployed version and live health. A successful GitHub merge alone is not proof that publication succeeded.

Suggested request to another coding task: 「完成修改後，先同步最新 main、解決衝突並跑完整驗證；通過後合併到 main，確認 Cloudflare 自動部署成功及線上健康。原始卡牌規則不可修改。」

## Cloudflare settings

- Repository: `virus11456/starcup`.
- Worker: `star-grail-online`.
- Production branch: `main`; the old `cloudflare-migration` branch no longer triggers production builds.
- Build command: `npm run verify:local` (pinned engine preparation, application/engine tests, vinext build, workerd/SQLite/WebSocket tests, typecheck and built-Worker HTTP/password/invitation tests).
- Deploy command: `npm run deploy:vinext`.
- Root directory: `/`; existing dependency/build caching remains enabled.
- Build watch exclusions: `*.md`, `**/*.md`, so Markdown-only changes do not publish a new Cloudflare version.
- Existing production secrets, asset routing and Durable Object namespaces remain in place. Preview builds remain disabled.

Cloudflare configuration was changed and read back through MCP. A first validation build was started for the already-verified `main` commit `9f0cf39edad05051e0866c5ddffc87ddcd8c35ab`, build UUID `6dbd9e6d-0891-4a5c-b134-cfe8f5ba6f59`.

Vercel is still connected to the same repository and can run its existing deployments. Keep it until migration acceptance and an explicit retirement instruction; it does not replace the Cloudflare build/version checks above.
