# 房主傳輸中斷保護

2026-10-26，本機待整合階段。沿用上一批 [等待室恢復](stage-host-lobby-recovery.md)，只備份 `fix/relay-recovery-20261026`，沒有部署或正式站 SQL 寫入。正式仍為 Cloudflare 直式卡牌版 `e639f6a`，Vercel 保留。

## 修改後的行為

- 房主開始選角／對戰後，明確 offline、同步失敗、分頁進入 bfcache，或 25 秒沒有新的同步確認時，顯示暫停提示並阻擋觸控、滑鼠、鍵盤操作。一般切到背景不主動停止傳輸；回到分頁後如果已超時，同樣先同步確認。
- 原生 PauseManager 等待點保留當前事件堆疊，不重新呼叫 phaseLoop，不重抽牌、不重開回合。已經執行的同步程式碼不會倒轉；暫停生效於原生下一個等待點。原始 `game.pause/resume` 與手動暫停維持各自狀態，網路恢復不會解除玩家自己按下的暫停。
- 同步失敗保留未確認批次及原識別，成功時先套用收件匣再解除等待。中斷前已發出的舊回覆不能解除新一次等待，必須取得中斷後發出的同步回覆。
- 原生選擇逾時不在房主傳輸停擺時繼續觸發 AI。連回後若已收到該次真人選擇，過期 timeout 不會再覆寫結果。沒有收到答案的有效逾時仍依原 AI 路徑處理；不宣稱倒數計時器的視覺數字會凍結，也不重新給滿 120 秒。
- 409／410 等終止回應永久封住該房主頁面的續行，online、visibilitychange 或遲到回覆不能讓它復活。返回網站的外層按鈕仍在 iframe 外，不受輸入攔截影響。
- 新增的是本機傳輸保護；正常心跳頻率與 Cloudflare 儲存格式不變。僅在舊回覆跨越中斷時加做新同步確認，不新增定期存檔或額外輪詢服務。

## 驗證

針對傳輸、bfcache、開局與新保護的 34 項測試通過。完整 `npm run verify:local` exit 0：**239 項測試通過**（108 應用、121 引擎／adapter、10 本機 workerd runtime），另 **64 項建置後 HTTP 檢查通過**，Vinext 建置及 TypeScript 成功；`git diff --check` 通過。紀錄在 `outputs/host-guard-focused.log` 與 `outputs/host-guard-verify.log`。

新回歸實際執行生成的 PauseManager 與 Player.wait：手動暫停在網路等待期間開始，恢復網路仍須等手動暫停與原選擇暫停都解除；逾時 callback 在網路恢復前不呼叫 AI，真人答案先到時不能再呼叫失效 callback。另涵蓋時鐘停擺／倒退、HTTP 失敗重送同批次、舊回覆、輸入攔截、bfcache 返回及終止連線。既有 WebSocket 暫存恢復測試一併通過。

本輪沒有新自然對局或實體手機 UI 驗收；累計維持單人 10/10、多人 10/10。下一次集中發布後仍需驗證手機斷網提示、外層返回、手動暫停，以及實際選擇中的斷線恢復。

## 房主真正關頁接手的限制

本次分析固定引擎後，確認 `get.arenaState()` 與 `Player.getState()` 是客人畫面／牌面重連資料，沒有完整牌庫順序、原生事件堆疊及所有歷史；`GameEvent` 另持有私有 Promise／執行狀態，`AsyncCompiler` 中的技能也會在任意 await 保留區域變數。重新執行 phaseLoop 的 step 0 還會重設隊伍資源。不能把這些快照當成可安全接手的權威存檔。

保留原引擎的雲端瀏覽器主持是一個可能方向，但不是目前的免費方案：2026-10-26 查 Cloudflare 官方 [Browser Run 價格](https://developers.cloudflare.com/browser-run/pricing/) 與 [限制](https://developers.cloudflare.com/browser-run/limits/)，Workers Free 每日僅 10 分鐘瀏覽器時間，並行上限 3；不能拿這個額度承諾朋友可以持續開房。此次未新增 Browser binding、未升級方案、未啟用計費服務。

完整關頁接手仍需要可驗證的事件續行／確定性重播方案，或常駐運行原引擎的服務；只補寫一般 JSON 快照不足以完成。後續需涵蓋回應中斷、魔彈鏈、插入回合、動態技能、失去確認回覆及雙房主互斥，不得以本次暫停保護宣稱已完成。

在上述接手與遷移驗收完成前不刪除 Vercel；本批與等待室修正先保留在非部署分支，依使用者要求集中發布。
