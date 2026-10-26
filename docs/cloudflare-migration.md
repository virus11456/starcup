# Cloudflare 搬移進度

Cloudflare 測試站已部署：https://star-grail-online.localhost20000.workers.dev 。目前由 `cloudflare-migration` 分支自動部署，尚未切換 `main`；Vercel 原站保留到完整驗收結束。

## 2026-10-26 最新續作

使用者已取消等待早上八點，要求現在完成開發／本機驗證後集中發布。08:00 自動任務已停用。正式目前仍是 `43c101b2ba900880d41072f427ffbcd1cc6bc26f`；本批改動尚未發布，見 `docs/stage-room-entry-and-role-tags.md`。下方 10 月 25 日資料為歷史紀錄。

- MCP 已核對 Worker 的 ASSETS、兩個 Durable Object 綁定及三個 secret 名稱，未讀取密鑰；沒有 Supabase 綁定。
- 自動建置仍只監看 `cloudflare-migration`；最新既有 build 成功，建置分鐘上限尚未達到。
- UTC 2026-10-26 05:14 查當日 `durableObjectsPeriodicGroups`：有回傳的大廳 namespace 為 14 rowsRead／0 rowsWritten，房間 namespace 未回傳資料。這是分析 API 當時已彙整的資料，不保證即時用量或未來免費額度。
- 修正 API 尾斜線可能落入舊 Next adapter；Cloudflare 的 `/api/game` 明確停用，已認證回傳 410 及 `/online`。
- 本批 `vercel.json` 明確停用 `cloudflare-migration` 的 Vercel 自動部署，避免 Cloudflare 發布同時產生舊平台部署。Vercel 舊站不刪除。

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

2026-10-25：相容性掃描 13 項通過；Cloudflare 建置成功；應用測試 60 項、引擎測試 45 項及型別檢查通過。已實測單人 10 局與多人 6 局，完整紀錄見 `cloudflare-playtest.md`。

此工作環境執行 Wrangler 本機伺服器時發生 `uv_interface_addresses` 系統錯誤，因此本機 Worker HTTP 驗證尚未完成；不能把建置成功視為部署驗證通過。

## Cloudflare 部署狀態

2026-10-25：MCP 與 GitHub App 授權皆已恢復。使用既有建置憑證，未讀取其密鑰。修正 Cloudflare 預設 pnpm 9 與本機版本不一致造成的安裝失敗，將專案固定為 pnpm 11.25.0。GitHub push 已多次觸發成功的建置及部署，含多人後端與實局修復。

- 建置：`npm test && npm run build:vinext && npm run test:engine && npm run typecheck`
- 部署：`npm run deploy:vinext`
- 測試分支：`cloudflare-migration`；驗收後才改成正式 `main`。
- 網站入口密碼及新簽章金鑰已設定為 Cloudflare Secrets，未寫入原始碼或建置變數。
- 已實測未登入轉至密碼入口、登入後首頁顯示、單人選角與出牌。
- 最新已部署版本：`aa32392c8f14b91854745be93c87fbec07729da1`（build `75ac358c-a447-4fd4-9c4c-e52e087ea5ce`）。

## 多人後端

`cloudflare/worker.js` 攔截完整角色模式的房間 API，使用每房一個 SQLite Durable Object，房間資料與有大小上限的訊息批次分列儲存、以交易同步提交。公開大廳僅保存摘要；開房限制仍為每個來源每小時 5 房。Cloudflare 此模式不再需要 Supabase 設定；Vercel 原部署仍使用原本後端。

WebSocket 升級同時驗證網站登入、同來源、玩家席位與連線 epoch；保留原生訊息驗證、去重與重連流程。玩家動作觸發通知，無動作時每 10 秒送心跳；連線故障或過大的批次保留 HTTP fallback。使用 hibernation API，未設伺服器常駐輪詢計時器。

60 項應用／SQLite 測試及 45 項引擎測試通過；建置與型別檢查通過。已實測 Cloudflare 開房、第二位玩家加入、完整角色池，以及同角色被房主鎖定後客人不可重複選取。

## 尚未完成

- 使用者追加要求單人與多人各完成 10 局；逐局驗收進行中，尚不得宣稱完成 20 局。
- 已驗證手機 390×844／390×667 樣式與選角／承傷按鈕、未登入保護路徑、客人進行中重連、4／6／8 人結算；仍待完成多人 M07–M10；M06 已以 8 個真實玩家分頁完成結算。
- 現有牌局仍由房主瀏覽器主持；房主離線後的伺服器接手尚未實作。
- 尚未將搬遷分支合併至 `main`，亦未刪除 Vercel。

## 切換條件

先在 Cloudflare 驗證未登入頁面、引擎素材、API 均受密碼保護，再驗證登入、單機、4/6/8 人開房與加入、全角色自選、同場角色唯一性、客人重連、手機按鈕與傷害回應。確認 GitHub 更新可自動建置並部署、錯誤建置不取代正常版本後，才移除 Vercel 專案與舊部署。

免費用量必須根據實際請求、CPU、資料讀寫與房間時數量測，不保證朋友遊玩一定不會達到免費上限。

## 免費額度阻擋（2026-10-25）

八人完整實局後，Cloudflare 確認 `Exceeded allowed rows written in Durable Objects free tier.`；當日兩個遊戲 namespace 分析寫入合計 101,028 列。M07 無法加入，不能宣稱多人十局完成或免費額度足夠。已完成的單人十局與多人六局結果見逐局紀錄。

進一步將純 ack／seen 存在已認證 WebSocket 的 hibernation attachment，於下一個動作或既有心跳合併提交；新遊戲動作仍然先存 SQLite 才回覆。此修改已部署、離線回歸通過，實際每局用量須於額度重置後重測。下一次重置：2026-10-26 08:00 台灣時間。未升級付費，Vercel 未刪、main 未合併。
