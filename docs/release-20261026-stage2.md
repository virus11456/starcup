# 2026-10-26 第二階段集中發布與啟動競爭修補

## 已發布整合批次

- 使用者要求繼續；本輪將已完成的連線、角色分類／星等、共用 Logo、公開紀錄、Cloudflare 路由與快取修補合為一個階段發布。沿用先本機、後集中部署的要求，沒有等待排程。
- `cloudflare-migration` 從 `43c101b2ba900880d41072f427ffbcd1cc6bc26f` 快轉至 `bcb3df3819d541a6efa097ab644ea98c0e77a78f`；比對為 ahead 5／behind 0，無覆蓋他人修改。
- Cloudflare 自動建置 `d2fd18be-2172-4345-9347-7b0abd896476`，2026-10-26 06:06:47 UTC 完成 success。Deployment `b7ee6b21-790e-4f66-a467-9eb880f9030b`；version `d663c067-e80b-4d37-a129-af1771232c73`，100% 流量。
- 發布前本機 218 項測試及 64 項 HTTP 檢查通過。建置額度未達上限，自動建置只監看 `cloudflare-migration`。Vercel 查此 commit 的 deployments 為空；main 與 Vercel 未改動。
- 正式站 https://star-grail-online.localhost20000.workers.dev/ ，既有密碼登入有效。

## 正式驗收發現與本機修復

06:07 UTC 建立四人測試房 `Q3EN253Q`，同時在另一個分頁進入單人選角。多人 iframe 的 URL 正確帶 online 房號，實際卻出現單人 5 選 1 與座位面板，沒有中繼狀態節點。這不是已完成對局；立即透過外層離開／確認關房，不操縱勝負或計入 M07。

原因是 launcher 將 URL 決定的模式、人數、版本、輸入樣式寫入共用 localStorage，原生程式非同步載入後才讀取；另一分頁在期間覆寫，即會啟動錯誤模式。原有單分頁測試未涵蓋這個競爭。

修正讓啟動條件保留在當前 document 的 `window.grailLaunchConfig`，原生 loadConfig 完成後只取本頁的快照，再清除此啟動用暫存。沿用原先每次啟動都由 launcher 決定的設定語意，不以其他頁面保存的模式覆寫。原生引擎技能、選角、UI 設定儲存方式及多人中繼協定不重寫。

- 新回歸測試執行實際產物中的 loadConfig 與設定套用區塊。單人 6／8 人、多人、圖鑑交錯載入，分別保留 mode／角色包／人數／士氣上限／觸控樣式；另一頁中途寫入舊模式也不影響。
- 修復前兩項新測試確實失敗：預期 connect、實際 xingBei。修復後通過。
- `npm run verify:local` 完整通過：102 應用＋109 引擎＋9 runtime＝**220 項**；正式建置、型別檢查及 **64 項 HTTP** 成功。輸出：`outputs/launch-isolation-before.log`、`outputs/launch-isolation-after.log`、`outputs/launch-isolation-verify.log`。
- 此修補是正式驗收發現的阻擋，需再發布一次修正版後重測同時啟動，不能只把未修好的開房算成功。

## 已觀察的畫面與用量

- 正式 390×844 phone.css：單人頁與對戰頁共用首頁 Logo，五張角色卡顯示定位與原引擎難度，含 3.5／4.5 半星。
- 320×740 phone.css：實際選女武神後確認鈕可見；原生角色面板底 589.7px、控制列頂 615.1px，相隔約 25.4px；角色標籤 44px 高、牌寬 76px。未宣稱實體 iPhone Safari 驗收。
- 06:05 UTC 前置分析只回傳大廳 16 reads／0 writes。06:14 UTC 房間 12 reads／8 writes，大廳 27 reads／16 writes；包含上述未開局房間的建立／離開，分析有延遲，不能當完整一局成本或免費額度保證。

剩餘多人自然結算仍為 M07–M10，完成數單人 10/10、多人 6/10。需補 390 短屏／844／1024 與完整角色池、客人重連、紀錄保留的正式 UI 驗收。房主真正關頁／重載後的規則事件接手仍未完成，保留 Vercel。
