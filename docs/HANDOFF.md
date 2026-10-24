# 星杯傳說接手狀態

更新：2026-10-25（UTC 2026-10-24）。這是最新狀態，取代先前未同步 GitHub 的舊交接。

## 最新方向：沿用兩個上游，再做美化

使用者再次指定以 `chntujia/CodfiyAsteriatedGrailServer` 和 `RancherJie/noname_xingbei` 為架構／機制基礎，**不要重寫**，並明確要求完成後重新部署到原 Vercel 專案。具體分工與固定來源見 [architecture.md](architecture.md)。無名杯為實際運行引擎，Codify 為狀態機／共享資源對照，未部署 C++ 服務。

本次把角色與擴充對戰設為首頁主要入口，加入選局人數卡、唯讀戰況與回應提示、選牌輪廓及手機 iframe 高度修正。保留原技能／AI／牌庫、核心連線 API 和原部署專案。30 項核心測試、19 項引擎／顯示測試與 typecheck 通過；本機 Next build 因宿主無法提供 `uv_resident_set_memory` 系統資訊中止，正式 build 結果以 Vercel 為準。

## 授權與來源

使用者已授權雲端開發、合併 main、GitHub 同步與 Vercel 部署。僅官方本體／擴充，不加同人。名稱使用「星杯傳說」，不要「✦ 星杯傳說 Online」。規則、玩法、卡牌效果主要依據 https://xingbeichuanshuobaike.webnode.tw/ 。圖片保留來源和授權，不冒稱高清原檔。

## 專案

- 雲端工作路徑 `/workspace/scratch/5a6b080f7494/star-grail-online`，分支 main，origin `https://github.com/virus11456/starcup.git`。
- GitHub 已有完整原始碼及 19 個專案圖片。功能提交 `6cd2e83334f5afd133758820c65484afe08a91fe`；之後文件提交以遠端最新 main 為準。
- MCP 提交與工作環境提交 SHA 不同，但可 fetch 後檢查 tree 內容一致。一般 git push 缺認證，使用 GitHub create_tree/create_commit/update_ref；expected_sha 必填、force=false，保留新提交。
- 閱讀 AGENTS.md 與相關 node_modules/next/dist/docs 後修改 Next.js 程式。
- 不使用額外 agent，除非使用者或適用技能明確要求。

## 最新功能與驗證

見 [release status](release-status.md) 及 [本次 QA](qa-update-2026-10-25.md)。

- 首頁修復、繁體品牌、完整 150 張實體圖鑑、百科來源對照與 26 則規則摘要。
- 四類卡牌動畫在核心及完整擴充實際觸發完成；Three.js 尚未硬體驗證，雲端瀏覽器只能平面備援。
- `grail-viewport.js` 補償上游 body transform scale，讓完整引擎 HUD、動畫與 Three.js 背景使用視窗座標。後續保留相同座標系，不直接關掉上游縮放，否則引擎點擊換算會錯。
- 10 局正式核心多人全部通過，1,016 個操作；78 項獨立會話整合通過。完整擴充一局第 62 個角色回合出現勝利及結算表，四類動畫開始和完成均為 184。
- 手機首頁與圖鑑不再水平溢出，教學五步和規則搜尋完成。完整引擎手機部分控制仍偏小，需要專項改善。
- 68 角色技能對照狀態全部 pending，不能宣稱全技能驗收；完整擴充仍單人對 AI。

## Vercel 與資料庫

- 網站 https://star-grail-online.vercel.app/ ，擴充 `/full`。
- team `team_SQDuwfJ6mh6QlhQdBWLfeWiV`，slug `virus11456s-projects`。
- project `prj_hoznhjWKAccjKH3fmWPw5ci4Q97y`，star-grail-online。
- 功能部署 `dpl_HM7yaFwNrV9mskhNhwggMK8jWi8t`；MCP files 直接正式部署。確認 readyState 與 alias 後才回報上線。
- 使用者透過 browserAuth 完成 GitHub 與 Vercel 二階段登入後，已在既有專案 Settings → Git 連接 `virus11456/starcup`，Environments 顯示 Production 追蹤 `main`，網域保持原站。GitHub a7fb82d8711aaa50390cca19ca50e0de097dcc60 已自動觸發 dpl_2fAVNk8GRCwv5f53A16vJZe2GHJd；get_deployment 顯示 source=git、target=production、READY，原 alias 指向該部署，build log 也顯示直接 clone virus11456/starcup main。Git 自動連動已完成。
- 雲端瀏覽器 Vercel 已登入；認證只經安全 browserAuth，未讀取或保存帳密／OTP。後續若登入失效仍使用安全流程，不能在聊天索取密碼／token。
- 不建立新專案取代原站。Supabase `avyrgzukvmumthkhgqsv` 已完成核心後端，三個 Production 設定已配置，勿輸出秘密。
- Vercel web_fetch_vercel_url/get_access_to_vercel_url 曾被自動審核拒絕，不重試；測試使用公開 alias。

## 瀏覽器 QA

只使用 CUA 或 browser skill 提供的介面，不從 shell 啟動 Playwright/CDP。evaluate 僅可讀 DOM，不能讀引擎 game/lib/_status 狀態。

`/qa-layout.html` 是不索引的同站尺寸檢查，390×844、768×1024、1024×768、1440×900。公開頁面帶 `layout-test=1` 才允許同源嵌入；一般頁面仍 DENY。這不是實體裝置測試。

證據截圖透過 CUA 的 `/home/oai/share` 同步到 `/workspace/scratch`，遵照 cloud-shared-files 文件，回覆可嵌入。不要將 screenshot 通過當作動畫或全部遊戲規則通過。

## 上游

RancherJie/noname_xingbei 固定 `bd227231b6edeba5b32f906673b9f3cb0091b90c`，GPL-3.0；prepare:engine 校驗重建。68 正式角色、另選 16 舊版，正式爆食少女有獨立覆寫；保留 vendor/noname/NOTICE.md 與 LICENSE。
