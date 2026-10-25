# Cloudflare 搬移進度

Cloudflare 測試站已部署：https://star-grail-online.localhost20000.workers.dev 。目前由 `cloudflare-migration` 分支自動部署，尚未切換 `main`；Vercel 原站保留到完整驗收結束。

## 已準備

- 以 vinext / Cloudflare Workers 建置現有 Next.js 16 應用，保留原本 Next.js 指令。
- `npm run build:vinext` 會先準備同一套固定版本的遊戲引擎、繁體中文與美術素材，再建置網站。
- `wrangler.jsonc` 使用 Worker 優先處理路由，讓網站密碼驗證也保護遊戲素材與 API。
- `/dist/`、`.wrangler/`、`.dev.vars*` 不進入版本控制。
- 只允許已檢查的 esbuild / workerd 安裝腳本。
- 被攻擊或魔彈回應時，原本放棄回應的「取消」顯示為「承受傷害」；取消技能選取仍顯示「取消」。原始指令與規則結果不變。

## 建置與驗證

```sh
pnpm install --frozen-lockfile
npm test
npm run build:vinext
npm run test:engine
npm run typecheck
```

`typecheck` 會重新產生 Next.js 路由型別，避免 vinext 與 Next.js 共用 `.next/types` 時留下不相容的產生檔。它排除部署產物中的第三方引擎 TypeScript 原始碼。

2026-10-25：相容性掃描 13 項通過；Cloudflare 建置成功；應用測試 48 項、引擎測試 45 項及型別檢查通過。尚未進行 Cloudflare 線上遊戲測試。

此工作環境執行 Wrangler 本機伺服器時發生 `uv_interface_addresses` 系統錯誤，因此本機 Worker HTTP 驗證尚未完成；不能把建置成功視為部署驗證通過。

## Cloudflare 部署狀態

2026-10-25：MCP 與 GitHub App 授權皆已恢復。使用既有建置憑證，未讀取其密鑰。修正 Cloudflare 預設 pnpm 9 與本機版本不一致造成的安裝失敗，將專案固定為 pnpm 11.25.0。GitHub push 已兩次觸發成功的建置及部署。

- 建置：`npm test && npm run build:vinext && npm run test:engine && npm run typecheck`
- 部署：`npm run deploy:vinext`
- 測試分支：`cloudflare-migration`；驗收後才改成正式 `main`。
- 網站入口密碼及新簽章金鑰已設定為 Cloudflare Secrets，未寫入原始碼或建置變數。
- 已實測未登入轉至密碼入口、登入後首頁顯示、單人選角與出牌。
- 最新已部署版本：`1faf399561eb9e887c9414ee304d14028751f028`；Workers version `e1d570c5-b4b7-4826-b518-d7209685562a`。

## 多人後端

`cloudflare/worker.js` 攔截完整角色模式的房間 API，使用每房一個 SQLite Durable Object，房間資料與各玩家訊息分列儲存、以交易同步提交。公開大廳僅保存摘要；開房限制仍為每個來源每小時 5 房。Cloudflare 此模式不再需要 Supabase 設定；Vercel 原部署仍使用原本後端。

WebSocket 升級同時驗證網站登入、同來源、玩家席位與連線 epoch；保留原生訊息驗證、去重與重連流程。玩家動作觸發通知，無動作時每 10 秒送心跳；連線故障或過大的批次保留 HTTP fallback。使用 hibernation API，未設伺服器常駐輪詢計時器。

51 項應用／SQLite 測試及 45 項引擎測試通過；建置與型別檢查通過。已實測 Cloudflare 開房、第二位玩家加入、完整角色池，以及同角色被房主鎖定後客人不可重複選取。

## 尚未完成

- 使用者追加要求單人與多人各完成 10 局；逐局驗收進行中，尚不得宣稱完成 20 局。
- 手機版、新站各保護路徑、多人重連及完整結算仍須驗證。
- 現有牌局仍由房主瀏覽器主持；房主離線後的伺服器接手尚未實作。
- 尚未將搬遷分支合併至 `main`，亦未刪除 Vercel。

## 切換條件

先在 Cloudflare 驗證未登入頁面、引擎素材、API 均受密碼保護，再驗證登入、單機、4/6/8 人開房與加入、全角色自選、同場角色唯一性、客人重連、手機按鈕與傷害回應。確認 GitHub 更新可自動建置並部署、錯誤建置不取代正常版本後，才移除 Vercel 專案與舊部署。

免費用量必須根據實際請求、CPU、資料讀寫與房間時數量測，不保證朋友遊玩一定不會達到免費上限。
