# 接手時先讀此更新

原始交接記錄已過時。完整專案已同步到 GitHub main，首次完整同步為 `3c8df107bec987d9c418ceb3c70004bc1155c2c3`；本批百科來源／首頁跑版／150 張圖鑑修正，請以 `docs/release-status.md` 與 GitHub 最新 main 為準。Vercel Git 自動連接仍未完成。以下保留歷史記錄，不代表最新狀態。

# 新對話交接：星杯傳說 Online

使用者於本次要求「由新對話接手處理」，因此已停止功能與同步操作，僅準備此交接資料。請接續，不要重建專案。

## 最新需求與授權

- 出牌、棄牌、抽牌動畫，參考爐石的節奏；立體部分使用 Three.js。
- 重做首頁；站內提供教學、規則、卡牌與角色查詢。
- 手機、iPad（橫／直向）、電腦均可操作；不依賴滑鼠懸停。
- 僅正式本體／擴充，排除社群同人。
- 全程在雲端開發、測試、儲存，使用者不想下載專案到自己的電腦。
- 已明確指定 GitHub https://github.com/virus11456/starcup ，要求同步並讓 Vercel 跟此 repo 的 main 自動部署。
- 已授權部署與合併 main；不用重問。不可把雲端工作環境的 main 說成 GitHub 已同步。
- 使用者非常在意持續進度與誠實狀態。使用繁體中文。

## 程式位置與 Git 狀態

雲端工作路徑：/workspace/scratch/5a6b080f7494/star-grail-online
當前分支：work/card-motion-site-refresh
最新功能 commit：960779f17a2f931b7ee642a8cf9f43af29dfaf4c
工作環境 main：abe2d64（上一批十局測試與結算修正）；本次新功能尚未合併。
origin：https://github.com/virus11456/starcup.git
本壓縮檔是最新功能原始碼與交接文件，不含 node_modules、編譯輸出、.env、引擎下載快取或 .git。
先讀 AGENTS.md；Next.js 本地文件在 node_modules/next/dist/docs，修改相關功能前閱讀適用內容。

## 已完成的本次程式變更（960779f）

- app/lobby.tsx、portal.css、site-header.tsx：綠金配色的大廳、角色卡主視覺、三種模式入口、公開房間與快速練習。
- /learn：五步新手教學；/rules：規則字典；/cards：11 牌型、68 正式角色、150 張實體牌查詢。
- lib/catalog-search.ts：繁簡關鍵字搜尋；角色圖鑑可按擴充篩選與展開技能。
- lib/card-motion.ts：共用 Three.js 厚卡、弧線飛行、抽牌翻面、出牌光圈，無 WebGL 時使用平面動畫；減少動態效果、背景分頁、resize、資源釋放處理。
- lib/game.ts：有限長度的單調遞增動畫事件；publicView 僅向擁有者提供抽牌／超限棄牌的牌名與實體 ID，其他人只拿數量；出牌是公開資料。
- lib/motion-cursor.ts：忽略首次連線歷史、過期事件、重複及亂序輪詢。
- app/card-motion-layer.tsx：從伺服器事件播放，不阻塞規則；牌庫／棄牌定位、手牌與目標位置。
- vendor/noname/overrides/grail-motion.js：包裝原引擎 $draw/$throw，保留原規則回傳與行為，避免 $draw 遞迴重播；隱藏重複的舊飛牌。
- prepare-engine.mjs：將共用 TypeScript 動畫模組轉成引擎可用 ESM。
- CSS 手機、平板與電腦斷點；觸控手牌橫滑、44px 主要按鈕、底部操作列。

## 本次驗證狀態

TypeScript 檢查通過。核心 27 項測試通過（含 100 局離線 AI 保守性測試，以及新增動畫事件隱私／去重測試）；擴充引擎 14 項測試通過。最後兩個小調整：正式派系 ji 的中文標籤，以及完整模式 $draw 遞迴去重；已隨正式部署構建。

**新版瀏覽器視覺、實際三種動畫、手機／iPad 操作尚未完成驗證。** 最後一次 siteTab.reload + screenshot 被使用者中止並要求交接，不能把新版視覺驗收寫為通過。

先前批次已完成 10 局正式核心連線比賽（4／6／8 人，共 1109 動作）與 79 項正式站整合檢查。詳見 docs/game-test-report-2026-10-25.md。這是舊批次，不能據此宣稱新動畫已驗收。

完整擴充仍為單人對 AI，不是完整多人模式。核心連線為簡化規則；68 角色的所有交互技能未逐一驗收。上一批修正了擴充終局 IndexedDB 未初始化錯誤，14 項測試含此回歸，但完整擴充終局瀏覽器重跑仍待完成。

## Vercel：已部署但 Git 自動同步未完成

網站：https://star-grail-online.vercel.app/
擴充：https://star-grail-online.vercel.app/full
team：team_SQDuwfJ6mh6QlhQdBWLfeWiV（virus11456s-projects）
project：prj_hoznhjWKAccjKH3fmWPw5ci4Q97y（star-grail-online）
最新 deployment：dpl_EF121EbcC5uWMiGMipSZQh9bjAsv
URL：https://star-grail-online-99385e3jm-virus11456s-projects.vercel.app
狀態：READY，對應 960779f；直接以 MCP files 部署。
前一版本：dpl_9F7CE3WpBXm4ptFnmTqNWX9P8o6c（7f8f28d，舊首頁）。

Vercel MCP create_git_project 不能把同名既有未連結專案重新接上 GitHub。update_project schema 也沒有 repo link 欄位。不要用這兩者假裝已連接。
已準備透過 Vercel 設定 UI fallback。雲端瀏覽器 tab 8 在 https://vercel.com/ ，顯示 Log In，未登入；已閱讀 browserAuth 文件，但**尚未開始登入或提出安全登入請求**。必須遵守 browserAuth 流程，勿要求聊天貼密碼／token。若 UI 無法登入，完成其餘工作後說明此具體阻礙。
不要建立新 Vercel 專案替代現有專案，除非確認必要與環境／網域遷移；現有三個後端變數已配置在 Production，值不能出現在 GitHub 或訊息。
Vercel web_fetch_vercel_url/get_access_to_vercel_url 會建立認證分享連結，之前自動審核曾拒絕；不要重試。正式 alias 是公開可用，正常瀏覽器或 HTTP 即可測試。

## GitHub：只完成初始化與部分 blob 上傳，尚未同步整個專案

repo：virus11456/starcup，id 1432440133，public，push/admin 權限 true。
建立時為空 repo；已透過 MCP create_file 寫入 README.md 初始化。
**GitHub main 目前已知 head：a6a9b252a1a6b33499635d3b94ff1eb0e91adaa2**，只有初始化 README。開始下一步前重新讀取，避免覆寫使用者的新提交。
一般 git push 失敗：could not read Username for https://github.com。不要找出或輸出帳號金鑰，改用已驗證可用的 GitHub MCP。
已上傳 12 個二進位 Git blob，但未建立 tree／commit／更新 branch。SHA 清單在 docs/github-uploaded-blobs.json，可重用。
剩餘 7 個圖片：public/roles/archer.png、berserker-skills.png、berserker.png、saint-skills.png、saint.png、swordmaster-skills.png、swordmaster.png。

建議接續：
1. 上傳剩餘圖片 Git blob（GitHub create_blob encoding base64）。
2. GitHub create_tree：所有 tracked 文字檔用 content，圖片用已建立 blob sha。包括 .gitignore/.env.example；排除任何 .env.local、node_modules、public/engine、.engine-cache。
3. create_commit 以重新確認的 GitHub head 為 parent；update_ref main，expected_sha=該 head，force=false。保留既有 repo 內容／歷史；若已有新內容先檢查合併，不盲覆寫。
4. 確認遠端 head 與關鍵檔案真的存在；回報確切 GitHub commit。工作環境的 commit 不等於 GitHub MCP 產生的 commit。
5. 完成 Vercel Git 連接並驗證 production branch=main；需觀察真正 Git source 的部署才可宣稱自動同步完成。

圖片上傳已成功的做法：functions.exec 內以 exec_command 讀檔分段 base64，每段原始 90000 bytes（可被 3 整除），max_output_tokens 180000；Promise.allSettled 讀取各段，檢查 exit_code 與 truncation，拼接後直接傳 tools.mcp__codex_apps__github_create_blob，勿 text 印 base64。逐個執行寫入，紀錄回傳 sha。每 4–8 張一批，定期回報進度。
Vercel files 部署：text {file,data,encoding:"utf-8"}，二進位 {file,sha:檔案原始 bytes SHA1,size}，可重用同帳號既有 deployment asset（與 Git blob SHA 不同）。

## 資料庫與安全

Supabase project avyrgzukvmumthkhgqsv。grail_rooms 已設 RLS + 後端自訂 header hash。公開 publishable key 不能直接讀房間狀態。
Production 已配置 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、GRAIL_SERVER_SECRET，使用者已明確授權三值傳至既有 Vercel 專案。不要再問同一件事，不要印出值。
若新雲端環境沒有 .env.local，可對正式站使用已存在測試腳本，不必先取得秘密。

## 下一步優先順序

1. 檢查最新部署的首頁、/learn 五步導覽、/rules 搜尋、/cards 繁簡搜尋／擴充篩選／無結果狀態／150 張表格。
2. 瀏覽器實玩核心與完整擴充，分別確認出牌、抽牌、棄牌的軌跡與牌背保護。確保動畫不遮擋互動、不阻塞流程、不重複。
3. 手機 390×844、iPad 768×1024 與 1024×768、桌面 1440×900 版面；CUA 沒有直接 viewport API 時，可用自己網站的 QA 受控 iframe 展示多尺寸，勿用未授權 browser automation/CDP/Playwright。
4. 原瀏覽器 WebGL 不可用，已知只能測平面 fallback；Three.js 實際畫面需支援 WebGL 裝置驗證，不誇大測試。
5. 修正後跑適當測試、更新交接／release status，合併工作分支至 main，再完成 GitHub 與 Vercel 同步。
6. UI 最終 screenshot 應保存至共享路徑並在回覆嵌入。先讀 cloud-shared-files 文件。

不要擅自派 sub-agent；現行規則禁止除非使用者或適用技能明確要求。

## 可用來源與授權

GPL-3.0 引擎 RancherJie/noname_xingbei pinned bd227231b6edeba5b32f906673b9f3cb0091b90c，prepare:engine 建置時下載 checksum 驗證。官方角色 68、選用舊版 16。正式爆食少女自訂覆寫保留。素材不是高清印刷原檔。
上游來源、授權在 vendor/noname/NOTICE.md、LICENSE。不要刪除或改為自有原創遊戲素材。

