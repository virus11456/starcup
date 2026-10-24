/* GPL-3.0: presentation only; public scores come from the existing engine. */
export function createScoreboard(parent) {
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const board = node("section", "grail-scoreboard");
  board.id = "grail-scoreboard";
  board.setAttribute("aria-label", "雙方戰況");
  board.hidden = true;
  const header = node("header", "grail-score-heading");
  const round = node("span", "grail-score-round");
  header.append(node("span", "", "雙方戰況"), round);
  const grid = node("div", "grail-score-teams");
  const panels = ["red", "blue"].map((id) => {
    const panel = node("article", "grail-score-team");
    panel.dataset.team = id;
    const heading = node("div", "grail-score-team-heading");
    const name = node("h3", "", id === "red" ? "紅隊" : "藍隊");
    const mine = node("span", "grail-score-mine", "我方");
    heading.append(name, mine);
    const stats = node("div", "grail-score-stats");
    const morale = node("div", "grail-score-morale");
    const value = node("strong", "", "0");
    morale.append(value, node("span", "", "士氣"));
    const cups = node("div", "grail-score-cups");
    const cupLabel = node("span", "grail-score-cup-label", "星杯");
    const cupValue = node("b", "", "0");
    const goal = node("span", "grail-score-goal", "/ 5");
    cups.append(cupLabel, cupValue, goal);
    stats.append(morale, cups);
    const track = node("div", "grail-score-track");
    track.setAttribute("aria-hidden", "true");
    const fill = node("span", "");
    track.append(fill);
    const resources = node("div", "grail-score-resources");
    const gems = node("b", "", "0");
    const crystals = node("b", "", "0");
    for (const [label, kind, amount] of [["寶石", "gem", gems], ["水晶", "crystal", crystals]]) {
      const resource = node("span", "grail-score-resource");
      const icon = node("i", "grail-stone " + kind);
      icon.setAttribute("aria-hidden", "true");
      resource.append(icon, node("span", "grail-resource-label", label), amount);
      resources.append(resource);
    }
    panel.append(heading, stats, track, resources);
    grid.append(panel);
    return { panel, mine, value, cupValue, goal, fill, gems, crystals };
  });
  board.append(header, grid);
  parent.append(board);
  let previous = "";
  return (teams, { side, turn, over }) => {
    const key = JSON.stringify([teams, side, turn, over]);
    if (key === previous || !turn) return;
    previous = key;
    round.textContent = over ? "對局結束" : `第 ${turn} 回合`;
    teams.forEach((team, i) => {
      const refs = panels[i];
      refs.mine.hidden = typeof side !== "boolean" || side !== (team.id === "red");
      refs.panel.setAttribute("aria-label", team.name + (refs.mine.hidden ? "" : "，我方"));
      refs.value.textContent = String(team.morale);
      refs.panel.dataset.lowMorale = String(team.morale <= 3);
      refs.cupValue.textContent = String(team.grails);
      refs.goal.textContent = `/ ${team.goal}`;
      refs.fill.style.width = `${team.goal > 0 ? Math.min(100, Math.max(0, team.grails / team.goal * 100)) : 0}%`;
      refs.gems.textContent = String(team.gems);
      refs.crystals.textContent = String(team.crystals);
    });
    board.hidden = false;
    // Keep the upstream table as a fallback until the new board has data.
    document.documentElement.classList.add("grail-scoreboard-ready");
  };
}
