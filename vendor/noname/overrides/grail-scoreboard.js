/* GPL-3.0: presentation only; public scores come from the existing engine. */
const shapes = {
  morale: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z',
  grails: 'M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v6m-4 1h8',
  gems: 'M7 3h10l5 7-10 11L2 10Zm-5 7h20M7 3l5 18 5-18',
  crystals: 'm12 2 7 8-7 12-7-12Zm0 0v20m-7-12h14',
};
export function scoreIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', shapes[kind]);
  svg.append(path);
  return svg;
}
export function createScoreboard(parent) {
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const board = node('section', 'grail-scoreboard');
  board.id = 'grail-scoreboard';
  board.setAttribute('aria-label', '雙方戰況；盾牌為士氣、杯為星杯、粉色寶石與青色水晶為戰績');
  board.hidden = true;
  const header = node('header', 'grail-score-heading');
  const round = node('span', 'grail-score-round');
  header.append(node('span', '', '雙方戰況'), round);
  // Mobile progressive disclosure: keep morale/star cups visible, let players
  // open the same live score nodes for gems/crystals. No game data is hidden
  // from the engine and no match actions are replaced.
  const toggle = node('button', 'grail-score-toggle', '展開');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '展開完整雙方戰況');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'grail-score-teams');
  board.dataset.expanded = 'false';
  header.append(toggle);
  toggle.addEventListener('click', () => {
    const expanded = board.dataset.expanded !== 'true';
    board.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? '收合雙方戰況' : '展開完整雙方戰況');
    toggle.textContent = expanded ? '收合' : '展開';
  });
  const grid = node('div', 'grail-score-teams');
  grid.id = 'grail-score-teams';
  const labels = { morale: '士氣', grails: '星杯', gems: '寶石', crystals: '水晶' };
  const panels = ['red', 'blue'].map(id => {
    const panel = node('article', 'grail-score-team');
    panel.dataset.team = id;
    const heading = node('div', 'grail-score-team-heading');
    const mine = node('span', 'grail-score-mine', '我方');
    heading.append(node('h3', '', id === 'red' ? '紅隊' : '藍隊'), mine);
    const stats = node('div', 'grail-score-stats');
    const values = {};
    for (const kind of Object.keys(labels)) {
      const metric = node('span', 'grail-score-metric');
      metric.dataset.kind = kind;
      const value = node('b', '', '0');
      metric.append(scoreIcon(kind), value);
      stats.append(metric);
      values[kind] = { metric, value };
    }
    panel.append(heading, stats);
    grid.append(panel);
    return { panel, mine, values };
  });
  board.append(header, grid);
  parent.append(board);
  let previous = '';
  return (teams, { side, turn, over }) => {
    const key = JSON.stringify([teams, side, turn, over]);
    if (key === previous || !turn) return;
    previous = key;
    round.textContent = over ? '對局結束' : `第 ${turn} 回合`;
    teams.forEach((team, i) => {
      const refs = panels[i];
      refs.mine.hidden = typeof side !== 'boolean' || side !== (team.id === 'red');
      refs.panel.setAttribute('aria-label', team.name + (refs.mine.hidden ? '' : '，我方'));
      refs.panel.dataset.lowMorale = String(team.morale <= 3);
      for (const [kind, { metric, value }] of Object.entries(refs.values)) {
        value.textContent = kind === 'grails' ? `${team[kind]}/${team.goal}` : String(team[kind]);
        const label = `${labels[kind]} ${team[kind]}${kind === 'grails' ? `，目標 ${team.goal}` : ''}`;
        metric.setAttribute('aria-label', label);
        metric.title = label;
      }
    });
    board.hidden = false;
    document.documentElement.classList.add('grail-scoreboard-ready');
  };
}
