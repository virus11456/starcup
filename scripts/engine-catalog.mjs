import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
const reference = JSON.parse(await fs.readFile(new URL("../data/wiki-reference.json", import.meta.url), "utf8"));

const packNames = {
  shiZhouNian: "十週年",
  yiDuanYeHuo: "異端業火",
  shenZiChuangLin: "神子創臨",
  zhongMoDaoZhu: "終末禱鑄",
  teDian: "特典",
  sanBan: "三版",
  siBan: "四版",
};
const plain = (text) =>
  String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
export async function loadPacks(root, pin) {
  const packs = {};
  const lib = { config: {}, skill: {}, character: {}, translate: {} };
  for (const id of [...pin.packs, ...pin.legacyPacks]) {
    const code = (
      await fs.readFile(path.join(root, "character", `${id}.js`), "utf8")
    ).replace(/^import .*?;\s*$/gm, "");
    const game = {
      import: (type, fn) => {
        packs[id] = fn(lib, game, {}, {}, {}, {});
        Object.assign(lib.skill, packs[id].skill);
        Object.assign(lib.translate, packs[id].translate);
        Object.assign(lib.character, packs[id].character);
      },
      saveConfig: () => {},
    };
    const context = vm.createContext({ lib, game });
    if (id === "teDian") {
      const official = (
        await fs.readFile(
          path.join(root, "character/official-glutton.js"),
          "utf8",
        )
      )
        .replace(/^import .*?;\s*$/gm, "")
        .replace("export function", "function");
      vm.runInContext(official, context, { timeout: 3000 });
    }
    vm.runInContext(code, context, { timeout: 3000 });
  }
  const game = {
    import: (type, fn) => {
      packs.card = fn(lib, game, {}, {}, {}, {});
    },
  };
  vm.runInNewContext(
    await fs.readFile(path.join(root, "card/xingBei.js"), "utf8"),
    { lib, game },
    { timeout: 3000 },
  );
  return { packs, lib };
}
export async function createCatalog(root, pin) {
  const { packs, lib } = await loadPacks(root, pin);
  const characters = [],
    legacyCharacters = [];
  for (const pack of [...pin.packs, ...pin.legacyPacks]) {
    const data = packs[pack];
    for (const [id, entry] of Object.entries(data.character)) {
      if (pin.excludedSpecialCharacters.includes(id)) continue;
      let art = id;
      const alias = entry[4]?.find((x) => x.startsWith("character:"));
      if (alias) art = alias.slice(10);
      const portrait = `image/character/${art}.jpg`;
      await fs.access(path.join(root, portrait));
      const skills = entry[3].map((skill) => ({
        id: skill,
        name: plain(lib.translate[skill] || skill),
        description: plain(lib.translate[skill + "_info"]),
        implemented: !!lib.skill[skill],
        kind: lib.skill[skill]?.enable
          ? "主動／回應"
          : lib.skill[skill]?.trigger
            ? "時機觸發"
            : "被動／標記",
      }));
      const issue =
        id === "nong_baoShiShaoNv"
          ? "參考引擎的三秒原則尚有 FAQ 差異，未列為正式規則驗收通過。"
          : null;
      const item = {
        id,
        name: reference.roles[id]?.name || plain(data.translate[id] || id),
        aliases: [plain(data.translate[id] || id)],
        pack,
        packName: packNames[pack],
        portrait: "/engine/" + portrait,
        skills,
        issue,
        source: reference.roles[id]?.url || pin.sourceUrl + "/character/" + pack + ".js",
        sourceName: reference.roles[id] ? reference.name : "參考引擎舊版角色",
        reviewStatus: reference.roles[id]?.reviewStatus || "legacy",
        reviewNote: reference.roles[id]?.note || "舊版對照，請勿與現行牌面混用。",
        engineSource: pin.sourceUrl + "/character/" + pack + ".js",
      };
      (pin.legacyPacks.includes(pack) ? legacyCharacters : characters).push(
        item,
      );
    }
  }
  const cards = Object.entries(packs.card.card).map(([id, card]) => ({
    id,
    name: reference.cards[id]?.name || plain(packs.card.translate[id] || id),
    type: card.type,
    description: reference.cards[id]?.description || plain(
      typeof card.cardPrompt === "function"
        ? card.cardPrompt({})
        : packs.card.translate[id + "_info"],
    ),
    portrait: `/engine/image/card/${id}.png`,
    sources: (reference.cards[id]?.sourceIds || []).map(key => reference.guides[key]),
  }));
  const deck = packs.card.list.map((entry, index) => ({
    id: `full-${index + 1}`,
    element: entry[0],
    faction: entry[1],
    kind: entry[2],
    marks: (entry[3] || "").split("|").filter(Boolean),
  }));
  for (const [id, card] of Object.entries(reference.cards)) {
    if (deck.filter(c => c.kind === id).length !== card.count) throw new Error(`百科牌庫配比不符：${id}`);
  }
  return {
    source: reference.url,
    sourceName: reference.name,
    engineSource: pin.sourceUrl,
    commit: pin.commit,
    packs: packNames,
    characters,
    legacyCharacters,
    cards,
    deck,
    skillMarks: Object.fromEntries([...new Set(deck.flatMap(c => c.marks))].map(id => [id, {
      id, name: plain(lib.translate[id] || id), description: plain(lib.translate[id + "_info"]),
    }])),
  };
}
