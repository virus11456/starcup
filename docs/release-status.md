# 目前部署狀態

更新日期：2026-10-25（UTC 2026-10-24）。歷史十局紀錄另見 game-test-report-2026-10-25.md；本次驗證見 [本次測試報告](qa-update-2026-10-25.md)。

- 網站：https://star-grail-online.vercel.app/；完整擴充入口 `/full`。
- 完整原始碼及 19 張專案圖片已同步到 https://github.com/virus11456/starcup 的 main。引擎素材在建置時依固定版本重新產生；秘密、依賴及建置產物不提交。
- 功能版本 GitHub main：`6cd2e83334f5afd133758820c65484afe08a91fe`；本報告的提交只更新文件。
- Vercel 正式部署：`dpl_HM7yaFwNrV9mskhNhwggMK8jWi8t`，原功能版本透過 MCP files 部署。既有專案現已連到 GitHub `virus11456/starcup`，Production 追蹤 `main`。已驗證 GitHub main 提交 a7fb82d8711aaa50390cca19ca50e0de097dcc60 自動觸發部署 dpl_2fAVNk8GRCwv5f53A16vJZe2GHJd；來源為 git，狀態 READY，原正式網域已指向該部署。
- Supabase 已提供核心版房間儲存與多人 API；後端設定已放在 Vercel Production，RLS 阻止瀏覽器直接讀取房間狀態。

## 已更新

- 品牌統一「星杯傳說」，修復首頁頂部導覽被擠到左欄與手機裝飾溢出。
- `/cards` 與 `/full` 共用逐張 150 張圖鑑，附屬性、派系、獨有技標記、牌型效果、搜尋篩選與表格。11 種牌型和 150 張實體牌分開標示。
- 百科為規則主要參考，保存 6 類指南、11 種牌型及 68 個角色頁連結；核心新局牌庫數量與應戰目標依百科修正。
- 抽牌、出牌、放置效果牌、棄牌四種動畫；Three.js 及無 WebGL 備援。完整引擎增加 body 縮放補償，避免手機動畫座標漂移。
- 正式站核心 10 局、1,016 個合法操作及 78 項多人整合檢查通過；完整擴充瀏覽器實玩一局至第 62 個角色回合正常結算。詳見測試報告。

## 尚未完成


- 完整擴充跨裝置多人、68 位角色全部交互技能逐項核對。
- 硬體 WebGL 視覺驗證、完整引擎手機觸控版面改善及實體裝置驗證。
- 高清印刷牌面：目前使用上游角色素材與牌型插畫。

## 重跑檢查

`npm test`、`npm run typecheck`、`npm run prepare:engine`、`npm run test:engine`。

正式站使用 `GRAIL_TEST_URL=https://star-grail-online.vercel.app node scripts/check-live-matches.mjs` 跑十局；`scripts/check-multiplayer.mjs` 跑獨立會話整合。測試建立私密房，不能清空其他房間。報告不含 Cookie、手牌或金鑰。
