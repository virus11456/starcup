/* GPL-3.0: connects the self-hosted engine to the 3D table and action guide. */
import { lib, game, ui, get, _status } from "./noname.js";
import { startTable } from "./grail-table.js";
import { startCardMotion } from "./grail-motion.js";
import { anchorToViewport } from "./grail-viewport.js";
import { describeStage, teamSummary } from "./grail-battle-state.js";
import { createScoreboard } from "./grail-scoreboard.js";
import { createBattleHistory } from "./grail-history.js";
import { createHistorySession } from './grail-history-session.js';
import { createBattleInspection } from "./grail-inspection.js";
import { createQuickDetailView } from './grail-detail-view.js';
import { createPlayerIndicators } from "./grail-player-indicators.js";
import { createHandSkin } from "./grail-card-skin.js";
import { addRoleLegend } from './grail-role-tags.js';
import { updateActionHints, positionActionHint } from './grail-action-hints.js';
import { createTargetPreview } from './grail-target-preview.js';
const hud = document.createElement("div");
hud.id = "grail-hud";
document.body.append(hud);
hud.append(document.getElementById("grail-help"));
const updateScoreboard = createScoreboard(hud);
// The passive instruction belongs BELOW the battle, not over the scoreboard
// or its morale counters. Reuse the already inverse-scaled, pointer-free HUD.
const scoreboardNode = hud.querySelector('#grail-scoreboard');
const phaseHint = document.createElement('span');
phaseHint.id = 'grail-phase-hint';
phaseHint.setAttribute('role', 'status');
phaseHint.hidden = true;
hud.append(phaseHint);
const history = createBattleHistory(hud, () => game.phaseNumber || 0, {
  journal: createHistorySession(new URLSearchParams(location.search).get('online')),
});
const flushHistory = () => { if (document.visibilityState === 'hidden') history.flush(); };
document.addEventListener('visibilitychange', flushHistory);
const stopHud = anchorToViewport(hud, (scale) => {
  document.documentElement.style.setProperty("--grail-touch-scale", String(scale > 0 ? 1 / scale : 1));
});
const stopMotion = startCardMotion();
const help = document.getElementById("grail-help-content");
const toggle = document.getElementById("grail-help-toggle");
const inspection = createBattleInspection({ panel: document.getElementById('grail-help'), toggle, help, context: { lib, game, get } });
const quickDetail = createQuickDetailView({
  hud, context: { lib, game, get },
  cancelNativeLongPress(card) { ui.click?.longpresscancel?.call(card); },
});
const indicators = createPlayerIndicators(hud, { lib, game, get, ui });
const handSkin = createHandSkin({ lib, get });
const targetPreview = createTargetPreview({ hud, ui, game, get, lib, event: () => _status.event });
const text = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");
let last = "";
function update() {
  // The pinned engine leaves #roundmenu on the battle table while displaying
  // the game-over result dialog. Hide its visual surface only once over=true.
  document.documentElement.classList.toggle('grail-match-ended', Boolean(_status.over));
  addRoleLegend(ui.arena);
  updateActionHints(ui.arena, phaseHint, !!scoreboardNode && !scoreboardNode.hidden && !_status.over);
  positionActionHint(phaseHint, {
    width: window.innerWidth, height: window.innerHeight,
    scoreboard: scoreboardNode?.getBoundingClientRect?.(),
    players: (game.players || []).map(p => p.getBoundingClientRect?.()).filter(Boolean),
    controls: ui.control?.getBoundingClientRect?.() || ui.arena?.querySelector?.('#control')?.getBoundingClientRect?.(),
    hand: ui.me?.getBoundingClientRect?.(),
  });
  history.attach(ui.sidebar);
  inspection.update();
  indicators.update();
  handSkin.update(game.me);
  targetPreview.update();
  // Preserve the native deck button and click handler; CSS-only finish.
  ui.cardPileButton?.classList?.add('grail-top-pile-tool');
  if (ui.arena) document.getElementById("grail-loading")?.remove();
  // The native hall's restart/exit reloads only the iframe. Embedded rooms
  // return through the parent page so its authenticated leave flow runs.
  if (game.grailEmbeddedRoom && _status.over) {
    for (const control of [ui.restart, ui.exit]) {
      control?.style.setProperty("display", "none", "important");
    }
  }
  for (const player of game.players || []) {
    // Presentation only: preserve native seat order and target nodes when the
    // short landscape viewport lays opponents in one horizontal row.
    const seat = Number(player.dataset.position);
    if (seat > 0 && game.players.length > 2) {
      const fraction = String(1 - (seat - 1) / (game.players.length - 2));
      if (player.style.getPropertyValue("--grail-seat-fraction") !== fraction) {
        player.style.setProperty("--grail-seat-fraction", fraction);
      }
    }
    if (typeof player.side !== "boolean") continue;
    const team = player.side ? "red" : "blue";
    if (player.dataset.grailTeam !== team) {
      player.dataset.grailTeam = team;
      player.node?.identity?.setAttribute("aria-label", player.side ? "紅隊" : "藍隊");
    }
  }
  const me = game.me;
  if (!me?.name) return;
  const stage = describeStage(_status.event, { started: game.phaseNumber > 0, over: _status.over });
  const teams = teamSummary(game);
  updateScoreboard(teams, { side: me.side, turn: game.phaseNumber, over: Boolean(_status.over) });
  const prompt = [
    ...(ui.arena?.querySelectorAll(".dialog .prompt, .dialog .caption") || []),
  ]
    .map((x) => x.textContent)
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);
  const cards = (me.getCards?.("h") || [])
    .filter(
      (c) =>
        c.classList.contains("selectable") || c.classList.contains("selected"),
    )
    .map((c) => text(get.translation(c.name)));
  const targets = (game.players || [])
    .filter((p) => p.classList.contains("selectable"))
    .map((p) => text(get.translation(p.name)));
  const skills = (me.getSkills?.() || []).filter(
    (id) => lib.translate[id + "_info"],
  );
  const available = [
    ...(ui.skills?.childNodes || []),
    ...(ui.skills2?.childNodes || []),
    ...(ui.skills3?.childNodes || []),
  ]
    .filter((x) => x.nodeType === 1 && !x.classList.contains("disabled"))
    .map((x) => x.textContent)
    .filter(Boolean);
  const current =
    game.phaseNumber +
    "|" +
    me.name +
    "|" +
    prompt +
    "|" +
    available.join() +
    "|" +
    skills.join() +
    "|" +
    (_status.event?.name || "") +
    "|" +
    cards.join() +
    "|" +
    targets.join() + "|" + JSON.stringify({ stage, teams, actor: _status.currentPhase?.name, side: me.side });
  if (last === current) return;
  last = current;
  const skillsExpanded = help.querySelector("details")?.open || false;
  help.replaceChildren();
  const badge = document.createElement("p");
  badge.className = "grail-stage";
  badge.dataset.stage = stage.id;
  badge.textContent = stage.label;
  help.append(badge);
  const title = document.createElement("strong");
  title.textContent = text(get.translation(me.name));
  help.append(title);
  const progress = document.createElement("p");
  progress.className = "grail-turn-progress";
  const active = _status.currentPhase;
  progress.textContent = game.phaseNumber
    ? `第 ${game.phaseNumber} 個角色回合${active?.name ? " · " + text(get.translation(active.name)) : ""}`
    : "準備開始對戰";
  help.append(progress);
  const p = document.createElement("p");
  p.textContent =
    (_status.over ? `對局已結束，請查看結算畫面；可使用上方「${game.grailEmbeddedRoom ? "離開" : "結束並返回"}」準備下一局。` : prompt) ||
    "可選的手牌、目標與技能會亮起；回應窗口出現時，請先處理畫面中的選擇。";
  help.append(p);
  const legend = document.createElement("p");
  legend.className = "grail-selection-legend";
  legend.textContent = "牌桌金框可選 · 青框已選 · 依畫面按鈕確認。「手牌」可讀完整效果與獨有技；「角色」與「指示物」可切換查看各玩家。戰況圖示：盾牌＝士氣、杯＝星杯、粉色寶石與青色水晶＝隊伍戰績。「本場紀錄」可查閱玩家動作。";
  help.append(legend);
  for (const [label, values] of [
    ["可用手牌", cards],
    ["可選目標", targets],
  ]) {
    if (!values.length) continue;
    const line = document.createElement("p");
    line.textContent = label + "：" + [...new Set(values)].join("、");
    help.append(line);
  }
  if (available.length) {
    const alert = document.createElement("p");
    alert.className = "grail-skill-alert";
    alert.textContent = "可選技能：" + available.join("、");
    help.append(alert);
  }
  const details = document.createElement("details");
  details.open = skillsExpanded;
  const summary = document.createElement("summary");
  summary.textContent = "角色技能與觸發條件";
  details.append(summary);
  for (const id of skills) {
    const name = document.createElement("h4");
    name.textContent = text(lib.translate[id] || id);
    const rule = document.createElement("p");
    rule.textContent = text(lib.translate[id + "_info"]);
    details.append(name, rule);
  }
  help.append(details);
}
const handle = setInterval(update, 400);
let stop = () => {};
try {
  stop = startTable(() => ({
    turn: game.phaseNumber || 0,
    red: game.hongShiQi,
    blue: game.lanShiQi,
    grails: [game.hongXingBei || 0, game.lanXingBei || 0],
    playerCount: game.players?.length || 0,
  }));
} catch {
  const p = document.createElement("span");
  p.className = "grail-render-note";
  p.textContent = "目前使用平面桌面";
  hud.append(p);
}
window.addEventListener(
  "pagehide",
  (event) => {
    history.flush();
    if (event.persisted) return;
    clearInterval(handle);
    clearInterval(ready);
    stop();
    stopMotion();
    targetPreview.stop();
    stopHud();
    indicators.stop();
    history.stop();
    document.removeEventListener('visibilitychange', flushHistory);
    inspection.stop();
    quickDetail.stop();
    handSkin.stop();
    hud.remove();
  },
);
// Self-hosted build has no upstream online hall, account or telemetry.
const ready = setInterval(() => {
  if (!ui.arena) return;
  clearInterval(ready);
  game.submitMatchData = async () => {};
  game.connect = () => {
    alert("與朋友連線請返回大廳，選擇「多人角色對戰」，再建立或加入本站房間。");
  };
}, 100);
