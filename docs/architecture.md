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

- 首頁主要入口導向 `/full` 的角色與擴充模式；保留核心多人與其既有房間，不影響邀請連結。核心連線明確標為不含角色技能的測試模式。
- 沿用原選角與座位流程，外層提供 4／6／8 人設定、版本選擇與角色圖鑑入口。
- 戰況提示加入雙方士氣、星杯及戰績。金框表示可選、青框表示已選，實際選擇及確認仍交給上游 UI。
- 延續現有綠金視覺及角色圖片；保留 `grail-viewport.js` 的縮放補償，不改原引擎的點擊座標系。
- 修正手機 iframe 強制最小高度造成的底部裁切，以剩餘可視高度呈現牌桌。

## 後續修改規則

1. 美術、版面、提示改在 `app/full/` 及 `vendor/noname/overrides/`；不要重寫 `lib/game.ts` 來追趕全部角色技能。
2. 上游修正放入可重建、可核對的 patch／override，保留來源版本、授權與原因。不可直接提交 `public/engine/` 建置產物。
3. 修改規則時須有具體角色／時機／FAQ 依據與回歸案例；無名杯與 Codify 不同時，先記錄版本差異，不默認混用。
4. 完整擴充多人連線是獨立整合工作，尚未完成；68 位角色的交互技能也未全部驗收。
5. 發布沿用 `virus11456/starcup` → 既有 `star-grail-online` Vercel 專案，Production 分支 `main`。

驗證：`npm test`、`npm run typecheck`、`npm run build`、`npm run test:engine`；瀏覽器另檢查選角、實際行動及桌面／手機版面。
