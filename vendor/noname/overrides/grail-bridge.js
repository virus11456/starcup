/* GPL-3.0: connects the self-hosted engine to the 3D table and action guide. */
import { lib, game, ui, get, _status } from "./noname.js";
import { startTable } from "./grail-table.js";
import { startCardMotion } from "./grail-motion.js";
import { anchorToViewport } from "./grail-viewport.js";
import { describeStage, teamSummary } from "./grail-battle-state.js";
const hud = document.createElement("div");
hud.id = "grail-hud";
document.body.append(hud);
hud.append(document.getElementById("grail-help"));
const stopHud = anchorToViewport(hud, (scale) => {
  document.documentElement.style.setProperty("--grail-touch-scale", String(scale > 0 ? 1 / scale : 1));
});
const stopMotion = startCardMotion();
const help = document.getElementById("grail-help-content");
const toggle = document.getElementById("grail-help-toggle");
// On phones, keep the guide available without covering a selectable player.
if (matchMedia("(max-width: 600px)").matches) {
  help.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "本回合提示 ▸";
}
toggle.addEventListener("click", () => {
  help.hidden = !help.hidden;
  toggle.setAttribute("aria-expanded", String(!help.hidden));
  toggle.textContent = help.hidden ? "本回合提示 ▸" : "本回合提示 ▾";
});
const text = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");
let last = "";
function update() {
  if (ui.arena) document.getElementById("grail-loading")?.remove();
  const me = game.me;
  if (!me?.name) return;
  const stage = describeStage(_status.event, { started: game.phaseNumber > 0, over: _status.over });
  const teams = teamSummary(game);
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
  if (game.phaseNumber > 0) {
    const scoreboard = document.createElement("section");
    scoreboard.className = "grail-team-board";
    scoreboard.setAttribute("aria-label", "雙方戰況");
    for (const team of teams) {
      const panel = document.createElement("div");
      panel.className = "grail-team " + team.id;
      const name = document.createElement("h3");
      const mine = typeof me.side === "boolean" && me.side === (team.id === "red");
      name.textContent = team.name + (mine ? " · 我方" : "");
      const morale = document.createElement("p");
      morale.className = "grail-morale";
      const value = document.createElement("b");
      value.textContent = String(team.morale);
      morale.append(value, " 士氣");
      const grails = document.createElement("p");
      grails.textContent = `星杯 ${team.grails} / ${team.goal}`;
      const stones = document.createElement("p");
      stones.className = "grail-stones";
      stones.textContent = `寶石 ${team.gems} · 水晶 ${team.crystals}`;
      panel.append(name, morale, grails, stones);
      scoreboard.append(panel);
    }
    help.append(scoreboard);
  }
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
    (_status.over ? "對局已結束，請查看結算畫面；可使用上方「結束並返回」準備下一局。" : prompt) ||
    "可選的手牌、目標與技能會亮起；回應窗口出現時，請先處理畫面中的選擇。";
  help.append(p);
  const legend = document.createElement("p");
  legend.className = "grail-selection-legend";
  legend.textContent = "金框可選 · 青框已選 · 依畫面按鈕確認";
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
  () => {
    clearInterval(handle);
    clearInterval(ready);
    stop();
    stopMotion();
    stopHud();
    hud.remove();
  },
  { once: true },
);
// Self-hosted build has no upstream online hall, account or telemetry.
const ready = setInterval(() => {
  if (!ui.arena) return;
  clearInterval(ready);
  game.submitMatchData = async () => {};
  game.connect = () => {
    alert("正式擴充模式的多人連線尚未接通；目前可與電腦對戰。");
  };
}, 100);
