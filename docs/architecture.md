# 沿用既有引擎的開發邊界

更新：2026-10-25。依使用者要求，以以下兩個專案為架構與遊戲機制依據，在 starcup 現有整合上做介面美化，不重寫遊戲。

## 兩個來源的分工

| 來源 | 固定版本 | 在本專案的用途 |
| --- | --- | --- |
| [RancherJie/noname_xingbei](https://github.com/RancherJie/noname_xingbei/tree/bd227231b6edeba5b32f906673b9f3cb0091b90c) | `bd227231b6edeba5b32f906673b9f3cb0091b90c` | 實際執行的瀏覽器事件引擎：牌庫、技能、AI、行動及回應流程。GPL-3.0，保留既有 SHA-256 重建與官方角色篩選。 |
| [chntujia/CodfiyAsteriatedGrailServer](https://github.com/chntujia/CodfiyAsteriatedGrailServer/tree/f2f210aeff062fd5ff27fb099629edcde82eb366) | `f2f210aeff062fd5ff27fb099629edcde82eb366` | C++ 伺服器架構及機制對照：狀態機、隊伍共享資源、回應與傷害時間線。MIT；本次未移植或啟動 C++ 伺服器。 |

Codify 與無名杯不是可直接混接的兩個服務。Vercel 仍提供既有 Next.js 網站；完整角色模式仍由自架的無名杯在瀏覽器執行。本次沒有把 C++ TCP／執行緒服務搬進 Vercel Function，也沒有把簡化核心 API 當作完整引擎後端。

## 對照與實作位置

以下為概念對照，並非宣稱兩套引擎所有時機一一等價；版本、技能與 FAQ 差異須另行驗證。

| 遊戲概念 | Codify 來源 | 無名杯來源 | starcup 呈現層 |
| --- | --- | --- | --- |
| 隊伍士氣／寶石／水晶／星杯 | `DiceGameServer/GameGrail.h` 的 `TeamArea` | `noname/game/index.js` 的 `hong/lanShiQi`、`hong/lanZhanJi`、`hong/lanXingBei` | `grail-battle-state.js` 只複製公開總數；`grail-bridge.js` 顯示紅藍戰況。 |
| 行動與追加行動 | `GrailState.h` 的 `STATE_ACTION_PHASE`、`STATE_ADDITIONAL_ACTION` | `noname/library/element/content.js` 的 `xingDong`；`player.js` 的 `gongJiOrFaShu`、`gongJi`、`faShu` | 顯示最接近的已知事件名稱；行動合法性仍由原引擎決定。 |
| 應戰與回應 | `STATE_ATTACKED`、`STATE_MISSILED` | `player.js` 的 `yingZhan` 與 `content.js` 的 `chooseToRespond` | 提示當前回應窗口，沿用原控制按鈕。 |
| 傷害、治療、抽牌與棄牌 | `STATE_TIMELINE_*`、`STATE_ASK_FOR_CROSS`、`STATE_REQUEST_HAND` | `content.js` 的 `damage`、`zhiLiao` 事件、`draw`、`chooseToDiscard` | 巢狀選擇優先顯示；不計算、預測或提前套用結果。 |
| 角色技能 | `DiceGameServer/role/*` | `character/*` 的技能定義及事件觸發器 | 既有官方角色篩選及爆食少女覆寫維持原狀。 |

`grail-battle-state.js` 是沒有 DOM、網路或狀態寫入的顯示轉接器。未辨識的技能時機只顯示「技能與時機結算」。原事件堆疊、傷害處理、勝負判斷與手牌內容皆不由此層修改。操作提示仍讀原引擎的可選標記，不另寫合法出牌規則。

## 本次介面調整

- 首頁單機入口導向 `/full`，多人入口導向 `/online`，兩者共用完整引擎。舊核心來源保留在未路由的 `app/legacy-core.tsx`；不再自動讀取 `grail-room-v1` 恢復舊局。舊邀請碼顯示版本提示，要求建立新房間。
- 沿用原選角與座位流程，外層提供 4／6／8 人設定、版本選擇與角色圖鑑入口。
- 戰況提示加入雙方士氣、星杯及戰績。金框表示可選、青框表示已選，實際選擇及確認仍交給上游 UI。
- 延續現有綠金視覺及角色圖片；保留 `grail-viewport.js` 的縮放補償，不改原引擎的點擊座標系。
- 修正手機 iframe 強制最小高度造成的底部裁切，以剩餘可視高度呈現牌桌。

## 後續修改規則

1. 美術、版面、提示改在 `app/full/` 及 `vendor/noname/overrides/`；不要重寫 `lib/game.ts` 來追趕全部角色技能。
2. 上游修正放入可重建、可核對的 patch／override，保留來源版本、授權與原因。不可直接提交 `public/engine/` 建置產物。
3. 修改規則時須有具體角色／時機／FAQ 依據與回歸案例；無名杯與 Codify 不同時，先記錄版本差異，不默認混用。
4. 完整擴充多人沿用原生連線協定，以本站 HTTP 中繼取代上游公共大廳；68 位角色的交互技能未全部驗收。
5. 發布沿用 `virus11456/starcup` → 既有 `star-grail-online` Vercel 專案，Production 分支 `main`。

驗證：`npm test`、`npm run typecheck`、`npm run build`、`npm run test:engine`；瀏覽器另檢查選角、實際行動及桌面／手機版面。

## 多人傳輸與生命週期

- `/api/full-room` 驗證網站登入及隨機席位憑證，只回傳該席位的訊息；房主依原生協定掌握全局，須為可信任玩家。
- `grail-online.js` 僅替換傳輸，沿用原生沙盒、初始化、選角、技能結算、客端重連。客端禁止 `exec`、讀牌庫、修改房間及冒用席位；只有原生 `result._sendskill` 的臨時 `*_backup` 技能定義可攜帶序列化函式，仍由原生沙盒處理。
- 同房多人寫入以 revision 樂觀鎖重試，不覆蓋其他人的選擇；訊息有唯一識別、確認位置及連線代次，失去 HTTP 回應可以安全重試。
- 4／6／8 人房一律自由選角，每位玩家可見完整已啟用角色池。房主按收到確認的順序保留角色；同角色家族（含舊版及 EX）只能分配一次。衝突結果不解除原生等待，而是提示重新選擇；重連保留既有選角。所有真人確認後，原生 AI 從剩餘角色補位。
- 房主必須讓原分頁的引擎保持運作；裝置暫停該分頁時，牌局也可能暫停。未提供伺服器接手或房主遷移。房主重新整理關閉房間，避免舊事件與新牌局混在一起；客端可由同一分頁重新加入。
- 不會升級或回放舊核心資料。資料表與原 RLS 保持不變，以 `engine=noname-v1` 分隔新房間。
- 中繼只回傳各席位的收件匣，但上游協定可能在快照／廣播中攜帶其他玩家的牌。這是可信任朋友間的瀏覽器房主模式，並非具備手牌保密與防作弊保證的權威伺服器。

### 快取分頁恢復（本機已驗證，尚未發布）

`grail-relay-lifecycle.js` 區分瀏覽器 bfcache 暫存和真正離開。`pagehide.persisted` 只暫停同步、關閉傳輸及中止 HTTP；`pageshow.persisted`、網路恢復及回到可見頁面喚醒同一個同步器。原生引擎物件、座位 epoch、ack 與待送批次不重建。普通切到背景不主動關閉正在運作的房主傳輸。

WebSocket 的 opening promise、請求及 timeout 綁定各自連線，舊連線遲到的 close/error/message 不得終止或完成新連線的請求。真實離開、原生 close 或 409/410 等終止回應會移除恢復監聽器，不重新開啟舊局。

這只處理原分頁仍保留的短暫中斷。中繼訊息仍有 120 秒保留期限；不可宣稱長時間離線、分頁被系統回收或房主關頁後都能無損續玩。真正伺服器接手需要可持久化的原生事件／選擇狀態及 AI 執行環境，現有收件匣與玩家快照不包含完整事件續行狀態。
