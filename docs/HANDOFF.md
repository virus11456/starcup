# 星杯傳說接手狀態

> 本機續作：已完成「重複房主連線不誤關原牌局」、開局前等待室恢復與持久化開局確認；231 項測試及 64 項建置後 HTTP 通過。僅備份 `fix/relay-recovery-20261026`，尚未部署，詳見 [等待室恢復階段](stage-host-lobby-recovery.md)。進行中房主關頁接手仍未完成。

> 2026-10-26 最新正式版為 Cloudflare `e639f6a`，直式卡牌與短橫向修補已部署，220 項測試與 64 項 HTTP 通過；實際視覺／手動出牌、提煉、合成及多人 M08–M10 自然結算詳見 [直式卡牌階段](stage-portrait-cards.md)。累計單人 10/10、多人 10/10。備份使用 `fix/relay-recovery-20261026`。房主關頁接手未完成，Vercel 保留。以下為歷史紀錄。

更新：2026-10-25（UTC 2026-10-24）。這是最新狀態，取代先前未同步 GitHub 的舊交接。

## 最新：手機手牌放大

- 600px 以下手牌由實測 41.6×41.6px 放大為 72×72px，牌面文字同步放大，採橫向捲動並保留原卡牌節點與點擊事件。選取抬升 8px，控制列與手牌留空。
- 手機停用原 fan（fold_card=false），保留引擎 scrollh 觸控捲動路徑；覆寫 nova 高優先級的手牌寬度與捲動列 top:60px，避免牌面裁切。
- 功能提交 `17b2b3180106ad8edef36de9f4c2cf98a1a0a2ad`，Production `dpl_7NEx41jdfWvh7YC3AFfFGae4vdLw` READY，原 alias 生效。33 項引擎測試與 diff 檢查通過。
- 390×844 驗證放大手牌的選牌／目標／出牌；最終版 390×667 手機 CSS 驗證原生 scrollh、306.3px 手牌容器、72px 牌面、末張捲動可見、8px 選取抬升，勇者打出地裂斬後手牌 4→3。Chromium 樣式驗證，非實體 Safari。
- 開局預設 5 選 1 為正常設定；「自由選角」可切換全部目前版本可用角色，本輪沒有更改選角規則。

![放大手牌與出牌確認](qa-larger-hand-2026-10-25.jpg)

## 前次：修正 phone.css 的工具列與按鈕裁切

使用者第二張實機截圖證實前次只改善了選角面板，頂部與底部按鈕仍裁切。查明桌面瀏覽器即使縮至 390px，`pointer: coarse` 仍為 false，因此前次測試沒有載入真正的 `layout/default/phone.css`。

- 上游手機樣式將 `#control > div` 外框固定 40 個引擎邏輯 px，內層則被我們放大到 44 個視窗 px；搭配 overflow:hidden，造成按鈕文字被切掉。新覆寫清除外框固定高度，內外尺寸一致並避免裁切。
- 上游 `#system > div:not(.shown)` 向上平移 80px 並停用其子項點擊。新覆寫保留可見工具列、恢復點擊與暫停／託管，移除不再需要的浮動展開按鈕；設定面板起點置於工具列下方。
- `grail-phone-layout` 由實際輸入設定決定；所有原按鈕節點、事件處理、遊戲規則與 body 縮放保留。
- 尺寸 QA 新增「手機樣式」選擇，明確傳遞 `phone-layout=1` 載入手機 CSS，同時保留滑鼠操作。後續不能把「縮小桌面」當作手機專用樣式已驗證。
- prepare:engine、33 項引擎測試、typecheck、diff 檢查通過。新增桌面載入手機樣式但保留滑鼠的啟動回歸。實體 iOS Safari 仍需區別於桌面尺寸或樣式模擬，不得宣稱已實機驗收。
- 功能提交 `5851c4aaa81ae0b75be4cb0ab3873126e998832b`，Production `dpl_A1viGgHDDC6LUWCC5a3QcyJDXQzK` READY。登入正式站後確認同時載入原生 `phone.css` 與新覆寫；390×844、390×667 工具列 44px 高，底部外框約 44.8px、內容 44px，文字完整。實際更換角色、開關設定、神官選角確認開局；8 人短屏另驗自由選角開關、第八座位與確認按鈕。詳細記錄見 [手機樣式驗證](qa-native-phone-controls-2026-10-25.md)。

![手機樣式按鈕修正](qa-native-phone-controls-2026-10-25.jpg)

## 前次：網站密碼入口與手機選角修正

- 全站共用密碼入口，驗證資料僅存 Vercel Production sensitive 環境變數；首頁、引擎直連、JSON、圖片及遊戲 API 均驗證伺服器簽章 cookie。7 天到期，可在 `/access` 重新鎖定。設定與測試見 [網站入口](site-access.md)。
- 手機選角改成置中且可捲動的面板，角色候選換行，座位 44×44px，控制列獨立留空；選角時隱藏裝飾牌堆。外層遊戲改用固定可視高度，消除 `min-height:100vh` 大於 Safari `100dvh` 的衝突，原引擎縮放與座標保留。
- 正式站版面修正 `ebb3b8000dd760b6977b3b1acedd5e6d58d2cd24` 已驗證：390×844、390×667、844×390；選祈禱師、切第四座位後確定開局。短屏面板底部約 507px、控制列頂部 544px，兩者不重疊；橫向內容可獨立捲動。這是 Chromium 尺寸檢查，不是實體 iOS Safari 測試。
- 37 項核心／入口單元測試、32 項引擎測試、typecheck 與獨立路由整合測試通過。正式站 37 項 HTTP 驗證通過，涵蓋錯誤／正確密碼、簽章 Cookie、未登入頁面／API／引擎／圖片轉換攔截、私有快取、重新鎖定與外站回跳。功能提交 `695ffa0b2d3bf5fa3a0bb86fb91e700fa74058ce`，Vercel `dpl_G7AbvviiiXYLHKdSHDhimwN7BHs9` READY，原 alias 已生效。結果不含密碼或 cookie。本機 Next dev 因宿主 `uv_resident_set_memory` 無法服務，正式建置以 Vercel 結果為準。

![手機短屏選角修正](qa-mobile-draft-2026-10-25.jpg)

## 前次：紅藍隊徽章與戰況計分板美化

- 角色隊伍文字改成珊瑚紅／霧藍色小型徽章；獨立戰況板呈現大字士氣、星杯數字與金色進度條、寶石／水晶及我方標記。
- 桌面右側顯示，手機／平板雙隊並排置於頂部；提示可獨立收合。保留原引擎縮放、選角唯一限制與所有規則。
- 最終功能提交 `071965b9e3ce15e49f8a3712f036458da13da7a2`，Vercel `dpl_AcdkJKNL3L2hSdZ2hwPFeCR5Zrvr` 已 READY 且原網域生效。後續文件提交不改程式。
- 32 項引擎測試、prepare:engine、語法與 diff 檢查通過。正式站手動出牌、分數更新及桌面／390px 手機／768px 平板尺寸回歸完成；截圖及限制見 [美化驗收](qa-scoreboard-2026-10-25.md)。不是實體 iOS 裝置測試。

## 開發方向：沿用兩個上游，再做美化

使用者再次指定以 `chntujia/CodfiyAsteriatedGrailServer` 和 `RancherJie/noname_xingbei` 為架構／機制基礎，**不要重寫**，並明確要求完成後重新部署到原 Vercel 專案。具體分工與固定來源見 [architecture.md](architecture.md)。無名杯為實際運行引擎，Codify 為狀態機／共享資源對照，未部署 C++ 服務。

前次修復 iPhone 首次觸控提示反覆 reload、完成建置時繁體中文轉換，並在原選角流程排除同角色的三／四版及 EX。實玩發現負士氣顯示、魔弓 EX 重複與手機設定選單遮擋後逐一修正。該輪功能提交 `21eafc0f10e0bc52f8571e7e1fce88a38a7cf968`，部署 `dpl_7uTFdiA6UTdyE88jb4vA6B36NQWn` 已 READY 並套用原網域。共完成 11 場完整擴充對局、735 個角色回合（含發現缺陷及重測），並補驗最後的手機選單位置修正。詳細場次、操作方式與限制見 [完整擴充實玩報告](qa-mobile-zh-hant-2026-10-25.md)。30 項核心、32 項引擎測試及 typecheck 通過；Vercel 正式建置成功。

手機控制尺寸使用 `--grail-touch-scale` 補償原引擎 body scale，不能直接移除原縮放。`body > #window { overflow: clip }` 的 specificity 必須高於較晚載入的上游 `#window { overflow: hidden }`，否則選牌取得焦點會讓整張牌桌水平捲出畫面。

## 授權與來源

使用者已授權雲端開發、合併 main、GitHub 同步與 Vercel 部署。僅官方本體／擴充，不加同人。名稱使用「星杯傳說」，不要「✦ 星杯傳說 Online」。規則、玩法、卡牌效果主要依據 https://xingbeichuanshuobaike.webnode.tw/ 。圖片保留來源和授權，不冒稱高清原檔。

## 專案

- 本輪雲端工作路徑 `/workspace/scratch/4aea9189c7ec/starcup`，分支 main，origin `https://github.com/virus11456/starcup.git`。
- GitHub 已有完整原始碼及 19 個專案圖片。功能提交 `6cd2e83334f5afd133758820c65484afe08a91fe`；之後文件提交以遠端最新 main 為準。
- MCP 提交與工作環境提交 SHA 不同，但可 fetch 後檢查 tree 內容一致。一般 git push 缺認證，使用 GitHub create_tree/create_commit/update_ref；expected_sha 必填、force=false，保留新提交。
- 閱讀 AGENTS.md 與相關 node_modules/next/dist/docs 後修改 Next.js 程式。
- 不使用額外 agent，除非使用者或適用技能明確要求。

## 最新功能與驗證

見 [release status](release-status.md) 及 [本輪完整擴充 QA](qa-mobile-zh-hant-2026-10-25.md)；qa-update-2026-10-25.md 保留上一輪驗收。

- 首頁修復、繁體品牌、完整 150 張實體圖鑑、百科來源對照與 26 則規則摘要。
- 四類卡牌動畫在核心及完整擴充實際觸發完成；Three.js 尚未硬體驗證，雲端瀏覽器只能平面備援。
- `grail-viewport.js` 補償上游 body transform scale，讓完整引擎 HUD、動畫與 Three.js 背景使用視窗座標。後續保留相同座標系，不直接關掉上游縮放，否則引擎點擊換算會錯。
- 10 局正式核心多人全部通過，1,016 個操作；78 項獨立會話整合通過。完整擴充一局第 62 個角色回合出現勝利及結算表，四類動畫開始和完成均為 184。
- 手機首頁與圖鑑不再水平溢出，教學五步和規則搜尋完成。完整引擎手機頂部工具列與出牌控制已補至至少 44px；上游完整設定選單仍較小，實體裝置體驗尚待驗證。
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
