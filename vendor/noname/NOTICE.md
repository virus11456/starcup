# 星杯傳說：完整規則引擎整合

本目錄使用 RancherJie/noname_xingbei（農杰／上杉隱月及貢獻者）的 GPL-3.0 開源程式，底層來自無名殺。原始碼固定於 bd227231b6edeba5b32f906673b9f3cb0091b90c。

原始碼：https://github.com/RancherJie/noname_xingbei/tree/bd227231b6edeba5b32f906673b9f3cb0091b90c

授權全文：[LICENSE](./LICENSE)。圖片、音樂、字型及《星杯傳說》的相關權利仍歸各自權利人；程式授權不代表美術重新授權。

2026-10-24 修改：以固定 SHA-256 驗證上游來源；增加本機啟動、版本篩選、角色技能圖鑑、操作提示與 Three.js 桌面；移除上游戰績上傳與預設公共連線大廳。修改程式亦依 GPL-3.0 提供。

可由本專案的 scripts/prepare-engine.mjs、scripts/engine-catalog.mjs、vendor/noname/overrides 重建完整修改版；npm run prepare:engine 會取得上述固定版本。網站中的原版引擎不是本專案重新撰寫的角色技能。

完整規則模式目前為本機對 AI；原核心版多人 API 不相容此引擎。請勿將此模式視為已完成跨裝置連線。導入全部技能定義不等於逐項正式 FAQ 驗收通過；圖鑑保留已知差異。

2026-10-25 修改：沿用同一固定引擎，調整主要入口、選局及牌桌外觀，加入公開隊伍資源與事件時機的唯讀顯示。架構對照 chntujia/CodfiyAsteriatedGrailServer（MIT，f2f210aeff062fd5ff27fb099629edcde82eb366）的 TeamArea／GrailState 分工；未複製或部署其 C++ 伺服器。細節見 docs/architecture.md。

手機啟動與繁體中文修正：啟動前設定觸控／滑鼠模式及首次觸控旗標，避免重新載入反覆詢問。使用 opencc-js 1.4.2（MIT 與 Apache-2.0；https://github.com/nk2028/opencc-js）於建置時轉換遊戲文字與相應選項字串，保留資源路徑、連結、技能代碼與數值。轉換工具不在玩家瀏覽器執行；原始圖片不經改繪。

同場選角增加角色家族互斥（含三／四版、紅衣主教與鑄律者、魔弓與魔弓 EX），沿用原本選角與電腦決策流程。士氣最低顯示 0，保留原始結算數值與勝負規則。手機工具列補償縮放至至少 44px，關閉可能蓋住設定按鈕的懸停快速切換選單；一般設定選單仍可點擊開啟。

隊伍與戰況美化：加入 grail-scoreboard.js，以同一份公開隊伍數值顯示士氣、星杯進度及星石；新計分板就緒後隱藏原表格。角色紅藍文字改為小型徽章，手機與平板使用並排戰況。此修改僅涉及顯示與版面。

手機選角修正：置中可捲動選角面板、候選換行、座位觸控尺寸及獨立控制列；保留原 body 縮放與所有選角／戰鬥規則。

真實手機樣式修正：新增 grail-phone-controls.css，覆寫上游 phone.css 的 40px 固定控制外框、隱藏工具列位移及停用點擊規則；原節點、事件與引擎座標保留。

手機手牌放大：新增 grail-handcards.css，600px 以下將原手牌節點以 72px 正方形橫向捲動排列，牌面文字與操作列間距同步調整。保留原卡牌點擊與規則，選牌以原 selected 狀態顯示抬升。

2026-10-25 多人整合：新增 mode/connect.js 與 grail-online.js，沿用固定版本的原生 online message／Client／NodeWS／sandbox，僅以本站 HTTP 中繼取代公共聯機服務；單機與多人共用原角色技能及牌庫。候選角色先按家族去重。連線啟動完成呼叫原生 onfree；網頁版不嘗試讀桌面客戶端設定檔。
