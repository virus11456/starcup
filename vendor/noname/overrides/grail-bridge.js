/* GPL-3.0: connects the self-hosted engine to the 3D table and action guide. */
import { lib, game, ui, get, _status } from "./noname.js";
import { startTable } from "./grail-table.js";
import { startCardMotion } from "./grail-motion.js";
import { anchorToViewport } from "./grail-viewport.js";
const hud = document.createElement("div");
hud.id = "grail-hud";
document.body.append(hud);
hud.append(document.getElementById("grail-help"));
const stopHud = anchorToViewport(hud);
const stopMotion = startCardMotion();
const help = document.getElementById("grail-help-content");
const toggle = document.getElementById("grail-help-toggle");
toggle.addEventListener("click", () => {
  help.hidden = !help.hidden;
  toggle.setAttribute("aria-expanded", String(!help.hidden));
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
    targets.join();
  if (last === current) return;
  last = current;
  const skillsExpanded = help.querySelector("details")?.open || false;
  help.replaceChildren();
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
    prompt ||
    "可選的手牌、目標與技能會亮起；回應窗口出現時，請先處理畫面中的選擇。";
  help.append(p);
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
