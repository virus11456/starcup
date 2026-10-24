/* GPL-3.0. Read-only presentation adapter; never decides legal moves or outcomes.
 * Codify's TeamArea / GrailState separation informs this display boundary.
 * See docs/architecture.md for the pinned sources and correspondence.
 */
const stages = new Map([
  ["yingZhan", ["response", "應戰回應"]],
  ["chooseToRespond", ["response", "回應選擇"]],
  ["zhiLiao", ["response", "治療回應"]],
  ["chooseToDiscard", ["discard", "棄牌選擇"]],
  ["damage", ["settlement", "傷害結算"]],
  ["changeShiQi", ["settlement", "士氣結算"]],
  ["changeXingBei", ["settlement", "星杯結算"]],
  ["draw", ["settlement", "抽牌結算"]],
  ["discard", ["settlement", "棄牌結算"]],
  ["useCard", ["settlement", "卡牌結算"]],
  ["useSkill", ["settlement", "技能結算"]],
  ["gongJiOrFaShu", ["action", "選擇行動"]],
  ["gongJi", ["action", "攻擊行動"]],
  ["faShu", ["action", "法術行動"]],
  ["xingDong", ["action", "行動階段"]],
]);

export function describeStage(event, { started = false, over = false } = {}) {
  if (over) return { id: "over", label: "對局結束" };
  if (!started) return { id: "setup", label: "選角與準備" };
  const seen = new Set();
  for (let current = event; current && !seen.has(current) && seen.size < 32; current = current.parent) {
    seen.add(current);
    const stage = stages.get(current.name);
    if (stage) {
      const extra = current.name === "xingDong" && current.extraXingDong;
      return { id: stage[0], label: extra ? "追加行動" : stage[1] };
    }
  }
  return { id: "settlement", label: "技能與時機結算" };
}

// Copy only public team totals. Do not traverse players or hand/deck contents.
export function teamSummary(game) {
  const number = (value) => Number.isFinite(value) ? value : 0;
  return ["hong", "lan"].map((prefix, index) => {
    const trophies = Array.isArray(game[prefix + "ZhanJi"]) ? game[prefix + "ZhanJi"] : [];
    return {
      id: index === 0 ? "red" : "blue",
      name: index === 0 ? "紅隊" : "藍隊",
      morale: Math.max(0, number(game[prefix + "ShiQi"])),
      grails: number(game[prefix + "XingBei"]),
      goal: number(game.xingBeiMax),
      gems: trophies.filter((stone) => stone === "baoShi").length,
      crystals: trophies.filter((stone) => stone === "shuiJing").length,
    };
  });
}
