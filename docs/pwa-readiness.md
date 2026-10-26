# 星杯 PWA 第一階段（已實作，待集中部署與裝置驗收）

使用者在 PWA 建議後要求繼續。第一階段已加入可安裝的線上版，保留現有無名杯與 Codify 整合；沒有因安裝功能重寫遊戲。先存 GitHub 備份分支，沿用 2026-10-27 08:00 Asia/Taipei 的集中發布安排，未提前部署。

## 第一階段：可安裝、仍需連網

- `app/manifest.ts`：固定 `id`、`start_url`、`scope` 為 `/`，名稱「星杯傳說」、`zh-Hant`、`standalone`。從主畫面開啟大廳；邀請碼、座位 token 與密碼不寫入 manifest。
- 沿用原本星杯 SVG 圖示，提供 192／512px PNG、具裁切安全範圍的 512px maskable 圖示及 180px Apple touch 圖示。全部約 34 KB；產生腳本 `node scripts/generate-app-icons.mjs` 使用 Next 已有的 sharp，不增加依賴或在部署時重產圖片。
- `app/install-app.tsx` 只在大廳提供安裝說明，涵蓋 iPhone／iPad、Android、電腦。瀏覽器送出 `beforeinstallprompt` 才顯示安裝按鈕；只在玩家點擊時呼叫一次 prompt，取消／拒絕時保留選單說明，已安裝獨立視窗隱藏此區。
- 外層版型使用 `viewport-fit=cover` 與四側安全區，遊戲 iframe 只取得扣除安全區後的剩餘高度。密碼頁、一般頁面與浮動對話框也處理安全區，保持頁面可縮放。尚待實機視覺驗收，不能只憑 CSS 宣稱沒有跑版。
- 沿用正常網路載入，**沒有註冊 Service Worker、離線包或預先快取**。目前完整引擎生成目錄約 129 MiB，不直接全量下載到每位朋友手機；此功能不會掃描或清除裝置既有快取。
- 密碼 gate 只新增精確檔案白名單：`/manifest.webmanifest` 和四張 `/app-icons/` PNG，僅 GET／HEAD 公開；原 favicon 仍可讀。未放行整個目錄、`/engine` 或 `/api`，私有內容仍為 no-store。Cloudflare 一般頁面與素材本來就經同一個 Proxy，不需要另外繞過 Worker 驗證。
- iOS 主畫面應用與原瀏覽器分頁的儲存、登入及邀請導向必須實測，不能假設目前 per-tab sessionStorage 座位自動跨容器共用。
- Cloudflare 繼續提供網站及既有 GitHub 部署流程；PWA 本身不改變後端主持架構。

## 本機驗證與待驗項目

- `npm run verify:local` exit 0：78 項應用、68 項引擎、5 項本機 Cloudflare runtime，共 **151 項**，Vinext 建置與型別檢查成功。紀錄 `outputs/pwa-verify-clean.log`。
- 新增四項測試：穩定安裝入口與 PNG 真實尺寸、精確圖示白名單、保護引擎／API／寫入與邀請回跳、安裝後仍需有效簽章 Cookie。執行實際 Proxy 與 Next Request／Response，而非複製一份規則。
- 使用 Wrangler `unstable_dev` 在本機啟動**實際 dist/server 套件與 assets**，使用測試憑證、禁止遠端資源、不持久化。確認 manifest 200 與 application/manifest+json；密碼頁真的輸出 manifest／Apple 圖示／viewport 標籤；四張圖示 200、image/png 且內容與檔案一致；引擎／房間 API 未登入受保護；manifest POST 為 401；邀請回跳保留房間碼；簽章登入後的大廳安裝說明、邀請頁及原生引擎皆 200。沒有建立正式房間或寫入正式資料庫。
- 第一次完整流程在準備引擎時偵測到生成物重複修補，已保留失敗紀錄 `outputs/pwa-verify.log`。固定版本壓縮包校驗正常；單獨重建成功後，再完整執行上述流程成功，沒有略過或放寬修補驗證，也沒有因此更改規則引擎來源。
- **未完成裝置驗收**：目前測試瀏覽器無法連到工作區本機伺服器。部署後在 iPhone Safari 加入主畫面、Android 安裝，以及 320／390px 直向、844×390 橫向檢查瀏海／底部手勢區、提煉／合成按鈕、手牌與紀錄；測試未登入安裝、重開需密碼時正常回大廳、邀請碼加入及瀏覽器與獨立視窗的座位隔離。
- 不增加自然結算局數：單人 10/10、多人 6/10；剩餘 4 局多人與手動合成依既有用量預算驗收。

## 第二階段：有限素材快取

先量測實際常用角色圖片、牌面與字型，再設定容量／筆數上限及淘汰機制；提供只清素材、不刪登入與座位憑證的操作。不得快取房間 API 回應、出牌請求、密碼驗證結果、私人手牌或舊戰鬥頁面來冒充重連成功。若要離線單機，應另行界定密碼與素材的離線存取規則。

快取會占用裝置儲存空間；能減少重複下載，但不會自動降低多人資料庫寫入或讓房主關頁續局。更新版本時只在大廳提示，不能強制重載正在玩的引擎。

## 多人斷線是另一項工作

Service Worker 由瀏覽器啟停，不是可常駐的牌局伺服器。原生 GameEvent、閉包與計時器仍在房主頁面；房主重新整理、關頁或被系統回收後，真正續局仍需要伺服器可持久化並繼續執行規則狀態。不可把 PWA 安裝或背景同步宣稱為此問題的解法。

參考：

- [MDN：Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)（安裝、manifest、standalone；離線 Service Worker 不是安裝必要條件）
- [web.dev：Service workers](https://web.dev/learn/pwa/service-workers)（生命週期、快取與背景程序可能終止）
- [WebKit：Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)（iOS 主畫面網頁應用能力；仍需對實際裝置版本驗收）

## 2026-10-27 PWA 安裝可見性與可讀性
- 先前安裝說明卡位於首頁圖鑑／頁尾之後，用戶很難發現。現在首頁英雄區提供「加入手機主畫面」站內跳轉，安裝說明搬到資料列之後，並加上捲動定位點；已安裝的獨立視窗隱藏快捷連結。
- 安裝卡標題 20px，說明、列表、展開摘要 16px，按鈕高度至少 48px，有焦點輪廓。iPhone／iPad 使用 Safari 分享選單手動加入，Android／桌面在有 `beforeinstallprompt` 時顯示原生安裝按鈕。
- 原生事件不同實作可能透過 `prompt()` 回傳或 `userChoice` 回傳接受／取消；缺乏明確結果時顯示中性提示，不會錯誤宣稱用戶取消或已安裝。新增流程與版面規則測試。
- **仍然不新增 Service Worker 或離線遊戲快取**，不碰已開始牌局、私人登入、Seat token 或任何多人儲存架構。
