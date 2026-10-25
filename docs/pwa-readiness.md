# 星杯 PWA 建議（尚未實作）

使用者詢問是否適合做成 PWA。建議先加可安裝的線上版，保留現有無名杯與 Codify 整合；不要因安裝功能重寫遊戲。這次僅完成評估，尚未加入 manifest 或 Service Worker，也不改動部署安排。

## 第一階段：可安裝、仍需連網

- 固定應用識別與首頁 start URL、繁體中文名稱、應用圖示、standalone 顯示，補手機安全區域與安裝說明。邀請 URL 不得成為應用識別；也不能把座位 token／密碼放進 manifest。
- 安裝與離線支援分開。先沿用正常網路載入，不加入整包素材預先下載；目前完整引擎生成目錄約 129 MiB，不能直接全量快取到每位朋友手機。
- 保留網站密碼、多人 API 與引擎的既有驗證。需要公開的 manifest／圖示僅限不含秘密的安裝中繼資料，不能擴大成放行 `/engine` 或 `/api`。
- iOS 主畫面應用與原瀏覽器分頁的儲存、登入及邀請導向必須實測，不能假設目前 per-tab sessionStorage 座位自動跨容器共用。
- Cloudflare 繼續提供網站及既有 GitHub 部署流程；PWA 本身不改變後端主持架構。

## 第二階段：有限素材快取

先量測實際常用角色圖片、牌面與字型，再設定容量／筆數上限及淘汰機制；提供只清素材、不刪登入與座位憑證的操作。不得快取房間 API 回應、出牌請求、密碼驗證結果、私人手牌或舊戰鬥頁面來冒充重連成功。若要離線單機，應另行界定密碼與素材的離線存取規則。

快取會占用裝置儲存空間；能減少重複下載，但不會自動降低多人資料庫寫入或讓房主關頁續局。更新版本時只在大廳提示，不能強制重載正在玩的引擎。

## 多人斷線是另一項工作

Service Worker 由瀏覽器啟停，不是可常駐的牌局伺服器。原生 GameEvent、閉包與計時器仍在房主頁面；房主重新整理、關頁或被系統回收後，真正續局仍需要伺服器可持久化並繼續執行規則狀態。不可把 PWA 安裝或背景同步宣稱為此問題的解法。

參考：

- [MDN：Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)（安裝、manifest、standalone；離線 Service Worker 不是安裝必要條件）
- [web.dev：Service workers](https://web.dev/learn/pwa/service-workers)（生命週期、快取與背景程序可能終止）
- [WebKit：Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)（iOS 主畫面網頁應用能力；仍需對實際裝置版本驗收）
