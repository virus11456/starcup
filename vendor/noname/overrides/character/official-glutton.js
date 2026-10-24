// GPL-3.0. Formal card and FAQ implementation, 2026-10-24.
// Source: https://xingbeichuanshuobaike.webnode.tw/角色詳情-爆食少女/
import { lib, game, get, _status } from "../noname.js";

export function installOfficialGlutton(pack) {
  pack.character.baoShiShaoNv = [
    "moFaShaoNv_name",
    "yongGroup",
    3,
    [
      "official_tianDian",
      "official_heiDong",
      "official_rongHe",
      "official_sanMiao",
      "official_fengBao",
    ],
  ];
  pack.characterSort.teDian.official = ["baoShiShaoNv"];
  Object.assign(pack.translate, {
    baoShiShaoNv: "爆食少女",
    official_tianDian: "[法術]甜點衝擊",
    official_tianDian_info:
      "棄 1 張法術牌並展示，我方戰績區增加 1 寶石。指定 2 名對手各展示棄置 1 張法術牌；每有一人不如此做，對其造成 2 點法術傷害，且你棄 1 張牌。",
    official_heiDong: "[響應]食慾的黑洞",
    official_heiDong_info:
      "我方承受傷害時，展示棄置 1 張魔彈，改由你承受此次傷害；你不因此造成士氣下降。",
    official_rongHe: "[響應]美味融合",
    official_rongHe_info:
      "發動時可將水系或火系牌轉換為魔彈，主動施放或傳遞。未發動時保留原牌用途；牌不能再次轉換。",
    official_sanMiao: "[響應]三秒原則",
    official_sanMiao_info:
      "當目標隊友使用或展示棄置的實體魔彈，在技能或最終傳遞傷害結算後進入棄牌堆時，你可以棄 1 張手牌，回收該隊友本次符合條件的魔彈。暗棄牌、轉換牌及未進入棄牌堆的牌不適用。",
    official_fengBao: "[法術]美食風暴",
    official_fengBao_info: "消耗 1 寶石，對 2 名目標對手各造成 2 點法術傷害。",
  });
  Object.assign(pack.skill, {
    official_tianDian: { inherit: "moBaoChongJi" },
    official_fengBao: { inherit: "huiMieFengBao" },
    official_rongHe: {
      enable: ["faShu", "moDan"],
      position: "h",
      viewAs: { name: "moDan" },
      filterCard(card) {
        return !card.cards && ["shui", "huo"].includes(get.xiBie(card));
      },
      viewAsFilter(player) {
        return player.hasCard((card) =>
          lib.skill.official_rongHe.filterCard(card),
        );
      },
      ai: { order: 3.5 },
    },
    official_heiDong: {
      trigger: { global: "chengShouShangHai" },
      filter(event, player) {
        return (
          event.player.side === player.side &&
          player.hasCard((card) => card.name === "moDan")
        );
      },
      async cost(event, trigger, player) {
        const result = await player
          .chooseToDiscard((card) => card.name === "moDan")
          .set("prompt", "食慾的黑洞：展示棄 1 張魔彈，代為承受傷害")
          .set("showCards", true)
          .set("ai", () => 0)
          .forResult();
        event.result = { bool: result.bool, cards: result.cards };
      },
      content(event, trigger, player) {
        trigger.player = player;
        trigger.shiQiXiaJiang = false;
      },
    },
    official_sanMiao: {
      trigger: { global: ["cardsDiscardEnd", "loseEnd"] },
      direct: true,
      candidates(event, player) {
        const result = [];
        const eligible = (card) =>
          card.name === "moDan" &&
          ["h", "x"].includes(card.original) &&
          get.position(card, true) === "d";
        if (event.name === "lose") {
          const parent = event.getParent();
          if (
            event.player !== player &&
            event.player.side === player.side &&
            event.type === "discard" &&
            (parent.showCards || parent.showHiddenCards)
          ) {
            const cards = event.cards.filter(eligible);
            if (cards.length) result.push({ owner: event.player, cards });
          }
        } else {
          // Used cards reach discard through orderingDiscard after resolution.
          // A physical missile used as a different/converted card cannot return.
          let parent = event.getParent();
          for (let i = 0; parent && i < 24; i++, parent = parent.parent) {
            if (parent.name === "useCard") {
              if (
                parent.card?.name !== "moDan" ||
                lib.skill[parent.skill]?.viewAs
              )
                return [];
              break;
            }
          }
          for (const owner of game.players) {
            if (owner === player || owner.side !== player.side) continue;
            const cards = (event.getd(owner) || []).filter(eligible);
            if (cards.length)
              result.push({ owner, cards: [...new Set(cards)] });
          }
        }
        return result;
      },
      boundary(event) {
        let boundary = null,
          parent = event.getParent();
        for (let i = 0; parent && i < 24; i++, parent = parent.parent) {
          if (parent.name === "phase") break;
          if (
            parent.name === "useSkill" ||
            parent.name === "useCard" ||
            lib.skill[parent.name]
          )
            boundary = parent;
        }
        return boundary;
      },
      filter(event, player) {
        return (
          player.countCards("h") > 0 &&
          lib.skill.official_sanMiao.candidates(event, player).length > 0
        );
      },
      content(event, trigger, player) {
        const candidates = lib.skill.official_sanMiao.candidates(
          trigger,
          player,
        );
        if (!candidates.length) return;
        const next = game.createEvent("officialThreeSeconds", false);
        next.player = player;
        next.grailCandidates = candidates;
        // Public discards made during a skill resolve only after that skill.
        const boundary =
          trigger.name === "lose"
            ? lib.skill.official_sanMiao.boundary(trigger)
            : null;
        if (boundary) {
          event.next.remove(next);
          boundary.after.push(next);
        }
        next.setContent(async function (event, trigger, player) {
          const candidates = event.grailCandidates
            .map((x) => ({
              owner: x.owner,
              cards: x.cards.filter((c) => get.position(c, true) === "d"),
            }))
            .filter((x) => x.cards.length);
          if (!candidates.length || !player.countCards("h")) return;
          const answer = await player
            .chooseBool("三秒原則：棄 1 張牌，回收隊友的魔彈？")
            .set(
              "ai",
              () =>
                _status.event.player.countCards("h") <
                _status.event.player.getHandcardLimit(),
            )
            .forResult();
          if (!answer.bool) return;
          let chosen = candidates[0];
          if (candidates.length > 1) {
            const selection = await player
              .chooseTarget(
                "選擇回收魔彈的來源隊友",
                true,
                (card, player, target) =>
                  _status.event.grailTargets.includes(target),
              )
              .set(
                "grailTargets",
                candidates.map((x) => x.owner),
              )
              .set("ai", () => 1)
              .forResult();
            chosen = candidates.find((x) => x.owner === selection.targets?.[0]);
          }
          if (!chosen) return;
          player.logSkill("official_sanMiao", chosen.owner);
          await player.chooseToDiscard(1, true, "三秒原則：棄 1 張手牌");
          const cards = chosen.cards.filter(
            (c) => get.position(c, true) === "d",
          );
          if (cards.length) await player.gain(cards, "gain2", "log");
        });
      },
    },
  });
  return pack;
}
