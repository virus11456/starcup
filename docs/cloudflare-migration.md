# Cloudflare 搬移進度

目前為搬移準備分支，尚未部署遊戲或切換正式流量。Cloudflare 已建立同名 Worker 部署位置，目前只回應 503「搬遷準備中」。Vercel 原站必須保留到 Cloudflare 驗證完成。

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

## Cloudflare 連線狀態

2026-10-25：重新連結後，MCP 帳號查詢、API 搜尋、文件與執行工具均已恢復。已建立 `star-grail-online` Worker；目前只有不含遊戲內容與密鑰的 503 準備頁。

建立 `virus11456/starcup` 的 GitHub 連線時，Cloudflare 回傳 HTTP 404 / `8000008`：`This project is disconnected from your Git account`。這是 Cloudflare 與 GitHub 間的授權問題，不是 MCP 連線失敗。

依 Cloudflare 官方 [Builds API 文件](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/)，第一次必須在 Cloudflare 儀表板進入此 Worker 的 **Settings → Builds → Connect → GitHub**，安裝或授權 Cloudflare GitHub App 存取此儲存庫。完成這個步驟後，其他建置設定可繼續透過 API 完成。

尚未建立建置憑證或連接 GitHub 自動部署；不要把準備頁視為已完成搬遷。

## 尚未完成

- 目前房間儲存仍沿用 Supabase；Cloudflare 資料儲存與減少輪詢的同步方式尚未實作。
- 現有牌局仍由房主瀏覽器主持。此部署適配不提供房主離線後的伺服器接手。
- 入口密碼與伺服器簽章金鑰必須透過 Cloudflare Secrets 設定，不能寫入 GitHub、Wrangler vars 或建置輸出。
- GitHub 自動部署尚未設定。預計使用 Workers Builds 連接 `virus11456/starcup`，正式分支為 `main`；建置指令需包含上面的測試與建置，部署指令為 `npm run deploy:vinext`。Worker 名稱必須與設定檔中的 `star-grail-online` 相同。

## 切換條件

先在 Cloudflare 驗證未登入頁面、引擎素材、API 均受密碼保護，再驗證登入、單機、4/6/8 人開房與加入、全角色自選、同場角色唯一性、客人重連、手機按鈕與傷害回應。確認 GitHub 更新可自動建置並部署、錯誤建置不取代正常版本後，才移除 Vercel 專案與舊部署。

免費用量必須根據實際請求、CPU、資料讀寫與房間時數量測，不保證朋友遊玩一定不會達到免費上限。
