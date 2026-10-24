import type { RoomView } from "./game.ts";

export type RoleSkill = {
  name: string;
  type: string;
  timing: string;
  requirement: string;
  description: string;
};
export const ROLES = [
  {
    id: "swordmaster",
    name: "風之劍聖",
    person: "威斯特姆",
    faction: "戰技殿堂",
    skills: [
      {
        name: "風怒追擊",
        type: "響應",
        timing: "攻擊結束",
        requirement: "回合限定；後續需要風系攻擊牌",
        description: "追加一次風系攻擊行動。",
      },
      {
        name: "聖劍",
        type: "被動",
        timing: "同一行動階段第 3 次主動攻擊",
        requirement: "追蹤本次行動階段的攻擊次數",
        description: "該攻擊強制命中，結束後可摸棄等量牌（最多 3 張）。",
      },
      {
        name: "烈風技",
        type: "獨有技",
        timing: "攻擊時",
        requirement: "對應獨有技牌；目標有聖盾",
        description: "對手不能應戰，這次攻擊忽略聖盾。",
      },
      {
        name: "疾風技",
        type: "獨有技",
        timing: "作為主動攻擊打出",
        requirement: "對應獨有技牌",
        description: "追加一次攻擊行動。",
      },
      {
        name: "劍影",
        type: "響應",
        timing: "攻擊結束",
        requirement: "回合限定；消耗能量，見技能卡",
        description: "追加一次攻擊行動。",
      },
    ],
  },
  {
    id: "berserker",
    name: "狂戰士",
    person: "阿基特",
    faction: "鮮血議會",
    skills: [
      {
        name: "狂化",
        type: "被動",
        timing: "主動攻擊或應戰",
        requirement: "攻擊命中時檢查自己的手牌數",
        description:
          "攻擊傷害 +1；命中時若自身手牌多於 3 張，再 +1。法術不適用。",
      },
      {
        name: "血影狂刀",
        type: "獨有技",
        timing: "作為主動攻擊打出",
        requirement: "對應獨有技牌；命中時目標手牌為 2 或 3 張",
        description: "目標 2 張手牌時傷害 +2，3 張時 +1。",
      },
      {
        name: "血腥咆哮",
        type: "獨有技",
        timing: "作為主動攻擊打出",
        requirement: "對應獨有技牌；目標恰有 2 點治療",
        description: "本次攻擊強制命中。",
      },
      {
        name: "撕裂",
        type: "響應",
        timing: "攻擊命中後",
        requirement: "消耗能量，見技能卡",
        description: "本次攻擊傷害 +2。",
      },
    ],
  },
  {
    id: "saint",
    name: "聖女",
    person: "艾麗卡",
    faction: "神聖教廷",
    skills: [
      {
        name: "冰霜禱言",
        type: "被動",
        timing: "使用水系牌或聖光",
        requirement: "使用牌才觸發；單純棄牌不觸發",
        description: "選擇一名角色，給予 1 點治療。",
      },
      {
        name: "治療術",
        type: "獨有技／法術",
        timing: "行動階段",
        requirement: "對應獨有技牌",
        description: "給予目標 2 點治療。",
      },
      {
        name: "治癒之光",
        type: "獨有技／法術",
        timing: "行動階段",
        requirement: "對應獨有技牌；最多 3 名不同目標",
        description: "每名目標各獲得 1 點治療。",
      },
      {
        name: "憐憫",
        type: "啟動",
        timing: "行動階段開始",
        requirement: "消耗能量，見技能卡",
        description: "手牌上限固定為 7，自己獲得 1 點治療。",
      },
      {
        name: "聖療",
        type: "法術",
        timing: "行動階段",
        requirement: "消耗能量，見技能卡",
        description: "把 3 點治療分配給 1–3 人，追加一次攻擊或法術行動。",
      },
    ],
  },
  {
    id: "archer",
    name: "神射手",
    person: "安娜",
    faction: "戰技殿堂",
    skills: [
      {
        name: "閃電箭",
        type: "被動",
        timing: "雷系攻擊或應戰",
        requirement: "打出雷系攻擊牌",
        description: "對手不能應戰這次雷系攻擊。",
      },
      {
        name: "貫穿射擊",
        type: "響應",
        timing: "主動攻擊未命中",
        requirement: "棄置 1 張法術牌",
        description: "對原攻擊目標造成 2 點法術傷害。",
      },
      {
        name: "閃光陷阱",
        type: "獨有技／法術",
        timing: "行動階段",
        requirement: "對應獨有技牌",
        description: "對目標造成 2 點法術傷害。",
      },
      {
        name: "精準射擊",
        type: "獨有技／響應",
        timing: "主動攻擊或應戰",
        requirement: "對應獨有技牌",
        description: "本次攻擊強制命中，傷害減少 1。",
      },
      {
        name: "狙擊",
        type: "法術",
        timing: "行動階段",
        requirement: "消耗能量，見技能卡",
        description: "目標直接補手牌至 5 張，自己追加一次攻擊行動。",
      },
    ],
  },
] as const;

export function roleFor(avatar: number) {
  return ROLES[(((avatar || 0) % ROLES.length) + ROLES.length) % ROLES.length];
}
export function roleSource(avatar: number) {
  return (
    "https://xingbeichuanshuobaike.webnode.tw/" +
    encodeURIComponent("角色詳情-" + roleFor(avatar).name) +
    "/"
  );
}
export function skillReminders(room: RoomView, cardId?: string) {
  const me = room.players.find((p) => p.id === room.me);
  if (!me || room.status !== "playing") return [];
  const role = roleFor(me.avatar);
  const card = me.hand.find((c) => c.id === cardId);
  const usable =
    card &&
    room.actor === room.me &&
    room.actions.some((a) => a.cardId === card.id && a.enabled);
  const attack =
    usable &&
    ["fire", "water", "wind", "earth", "thunder", "dark"].includes(card.kind);
  const reminders: string[] = [];
  if (role.id === "berserker" && attack)
    reminders.push(
      "狂化：原作在攻擊與應戰時計算傷害加成；命中時還要檢查自己的手牌數。",
    );
  if (role.id === "archer" && attack && card.kind === "thunder")
    reminders.push("閃電箭：原作雷系攻擊會限制對手應戰。");
  if (role.id === "saint" && usable && ["water", "light"].includes(card.kind))
    reminders.push("冰霜禱言：原作使用這張牌時，需要選擇獲得治療的角色。");
  if (
    role.id === "swordmaster" &&
    room.pending?.from === me.id &&
    !room.pending.counter &&
    room.pending.type === "attack" &&
    me.hand.some((c) => c.kind === "wind")
  )
    reminders.push(
      "攻擊結束前留意風怒追擊：原作可檢查追加風系攻擊的條件與回合使用次數。",
    );
  return reminders;
}
