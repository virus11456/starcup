export type Team = "red" | "blue";
export type CardKind =
  | "fire"
  | "water"
  | "wind"
  | "earth"
  | "thunder"
  | "dark"
  | "light"
  | "poison"
  | "weak"
  | "shield"
  | "missile";
export type Card = { id: string; kind: CardKind };
export type CardMotionEvent = {
  id: number;
  at: number;
  type: "draw" | "play" | "discard";
  player: string;
  target?: string;
  cards: Card[];
};
export const CARDS: Record<
  CardKind,
  {
    name: string;
    type: string;
    symbol: string;
    color: string;
    description: string;
  }
> = {
  fire: {
    name: "火焰斬",
    type: "攻擊",
    symbol: "焰",
    color: "#d78a72",
    description: "造成 2 點攻擊傷害。可用火系或暗滅應戰。",
  },
  water: {
    name: "水漣斬",
    type: "攻擊",
    symbol: "漣",
    color: "#7eafce",
    description: "造成 2 點攻擊傷害。可用水系或暗滅應戰。",
  },
  wind: {
    name: "風神斬",
    type: "攻擊",
    symbol: "風",
    color: "#8ab8a1",
    description: "造成 2 點攻擊傷害。可用風系或暗滅應戰。",
  },
  earth: {
    name: "地裂斬",
    type: "攻擊",
    symbol: "岩",
    color: "#c2a37b",
    description: "造成 2 點攻擊傷害。可用地系或暗滅應戰。",
  },
  thunder: {
    name: "雷光斬",
    type: "攻擊",
    symbol: "雷",
    color: "#b4a2d2",
    description: "造成 2 點攻擊傷害。可用雷系或暗滅應戰。",
  },
  dark: {
    name: "暗滅",
    type: "攻擊",
    symbol: "暗",
    color: "#a493ba",
    description: "造成 2 點傷害；不可被應戰。可應戰其他五系攻擊。",
  },
  light: {
    name: "聖光",
    type: "防禦",
    symbol: "光",
    color: "#dfca90",
    description: "回應時抵擋一次攻擊或魔彈。不能主動使用。",
  },
  poison: {
    name: "中毒",
    type: "法術",
    symbol: "毒",
    color: "#9fb57f",
    description: "目標下次行動前承受 1 點法術傷害，可疊加。",
  },
  weak: {
    name: "虛弱",
    type: "法術",
    symbol: "虛",
    color: "#aaa0c2",
    description: "目標下次行動前選擇跳過行動或摸 3 張牌。",
  },
  shield: {
    name: "聖盾",
    type: "法術",
    symbol: "盾",
    color: "#c8bc8f",
    description: "放在任一玩家面前。未應戰或使用聖光時，抵擋下一次攻擊或魔彈。",
  },
  missile: {
    name: "魔彈",
    type: "法術",
    symbol: "彈",
    color: "#b88ac0",
    description: "對下個敵方座位造成 2 點法術傷害；每次傳遞加 1。",
  },
};
export type Player = {
  id: string;
  auth: string;
  name: string;
  team: Team;
  avatar: number;
  bot: boolean;
  ready: boolean;
  hand: Card[];
  effects: Card[];
};
export type Pending = {
  type: "attack" | "missile";
  from: string;
  to: string;
  kind: CardKind;
  damage: number;
  counter: boolean;
  visited: string[];
};
export type Room = {
  code: string;
  name: string;
  capacity: number;
  public: boolean;
  host: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  revision: number;
  teams: Record<
    Team,
    { morale: number; stones: ("gem" | "crystal")[]; grails: number }
  >;
  deck: Card[];
  discard: Card[];
  turn: number;
  round: number;
  pending: Pending | null;
  overflow: { player: string; resume: "next" | "main" } | null;
  weak: boolean;
  deadline: number;
  winner: Team | null;
  logs: { id: number; text: string }[];
  chat: { name: string; text: string; id: number }[];
  created: number;
  updated: number;
  motionSequence?: number;
  motions?: CardMotionEvent[];
};
export type Command = {
  type: string;
  cardId?: string;
  target?: string;
  cards?: string[];
  text?: string;
  ready?: boolean;
  avatar?: number;
};
export class GameError extends Error {
  status = 400;
}
function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new GameError(message);
}
export const opponent = (t: Team): Team => (t === "red" ? "blue" : "red");
export const isAttack = (k: CardKind) => CARDS[k].type === "攻擊";
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    const j = n[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function makeDeck() {
  let n = 0;
  return shuffle(
    (Object.keys(CARDS) as CardKind[]).flatMap((kind) =>
      Array.from(
        {
          length: ["fire", "water", "wind", "earth", "thunder"].includes(kind)
            ? 18
            : 10,
        },
        () => ({ id: `c${++n}`, kind }),
      ),
    ),
  );
}
export function makePlayer(
  auth: string,
  name: string,
  seat: number,
  bot = false,
): Player {
  return {
    id: crypto.randomUUID(),
    auth,
    name: name.trim().slice(0, 16) || "星之旅人",
    team: seat % 2 ? "blue" : "red",
    avatar: seat % 6,
    bot,
    ready: bot,
    hand: [],
    effects: [],
  };
}
export function createRoom(
  code: string,
  auth: string,
  name: string,
  title: string,
  capacity: number,
  isPublic: boolean,
): Room {
  ensure([4, 6, 8].includes(capacity), "人數須為 4、6 或 8 人");
  const p = makePlayer(auth, name, 0);
  p.ready = true;
  const morale = capacity === 8 ? 18 : 15;
  const now = Date.now();
  return {
    code,
    name: title.trim().slice(0, 30) || `${p.name}的星杯之約`,
    capacity,
    public: isPublic,
    host: p.id,
    players: [p],
    status: "waiting",
    revision: 0,
    teams: {
      red: { morale, stones: [], grails: 0 },
      blue: { morale, stones: [], grails: 0 },
    },
    deck: [],
    discard: [],
    turn: 0,
    round: 1,
    pending: null,
    overflow: null,
    weak: false,
    deadline: 0,
    winner: null,
    logs: [{ id: 1, text: `${p.name} 建立了房間` }],
    chat: [],
    created: now,
    updated: now,
  };
}
function log(r: Room, text: string) {
  r.logs.push({ id: (r.logs.at(-1)?.id || 0) + 1, text });
  r.logs = r.logs.slice(-80);
}
function motion(r: Room, p: Player, type: CardMotionEvent["type"], cards: Card[], target?: string) {
  if (!cards.length) return;
  r.motionSequence = (r.motionSequence || 0) + 1;
  r.motions = [...(r.motions || []), { id: r.motionSequence, at: Date.now(), type, player: p.id, target, cards: cards.map(c => ({ ...c })) }].slice(-48);
}
function draw(r: Room, p: Player, count: number) {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (!r.deck.length) {
      r.deck = shuffle(r.discard.splice(0));
      log(r, "棄牌已重新洗入牌庫");
    }
    const card = r.deck.pop();
    if (card) { p.hand.push(card); drawn.push(card); }
  }
  motion(r, p, "draw", drawn);
}
function win(r: Room) {
  for (const t of ["red", "blue"] as Team[])
    if (r.teams[t].grails >= 5 || r.teams[opponent(t)].morale <= 0) {
      r.status = "finished";
      r.winner = t;
      r.pending = null;
      r.overflow = null;
      log(r, `${t === "red" ? "緋紅" : "蒼藍"}陣營獲勝！`);
      return true;
    }
  return false;
}
export function actingPlayer(r: Room) {
  return (
    r.players.find((p) => p.id === (r.overflow?.player || r.pending?.to)) ||
    r.players[r.turn]
  );
}
function timer(r: Room) {
  r.deadline = Date.now() + (actingPlayer(r)?.bot ? 1200 : 90000);
}
function overflow(r: Room, p: Player, resume: "next" | "main") {
  if (p.hand.length <= 6) return false;
  r.overflow = { player: p.id, resume };
  log(r, `${p.name} 超過手牌上限，請棄 ${p.hand.length - 6} 張牌`);
  return true;
}
function begin(r: Room) {
  const p = r.players[r.turn];
  const poison = p.effects.filter((c) => c.kind === "poison");
  p.effects = p.effects.filter((c) => c.kind !== "poison");
  r.discard.push(...poison);
  r.weak = p.effects.some((c) => c.kind === "weak");
  if (poison.length) {
    draw(r, p, poison.length);
    log(r, `${p.name} 中毒，摸 ${poison.length} 張牌`);
    overflow(r, p, "main");
  }
  timer(r);
}
function next(r: Room) {
  r.pending = null;
  r.overflow = null;
  r.weak = false;
  if (win(r)) return;
  r.turn = (r.turn + 1) % r.players.length;
  if (!r.turn) r.round++;
  begin(r);
}
function stone(r: Room, t: Team, s: "gem" | "crystal") {
  if (r.teams[t].stones.length < 5) r.teams[t].stones.push(s);
}
function resolveShield(r: Room) {
  const q = r.pending;
  if (!q) return;
  const p = r.players.find((p) => p.id === q.to)!;
  const i = p.effects.findIndex((c) => c.kind === "shield");
  if (i >= 0) {
    r.discard.push(...p.effects.splice(i, 1));
    log(r, `${p.name} 的聖盾抵擋了這次攻勢`);
    next(r);
  }
}
function discardCard(r: Room, p: Player, id: string) {
  const i = p.hand.findIndex((c) => c.id === id);
  ensure(i >= 0, "這張牌不在你的手中");
  return p.hand.splice(i, 1)[0];
}
function targets(r: Room, p: Player, visited: string[] = []) {
  return r.players.filter((t) => t.team !== p.team && !visited.includes(t.id));
}
function missileTarget(r: Room, p: Player, visited: string[]) {
  const start = r.players.indexOf(p);
  return Array.from(
    { length: r.players.length },
    (_, i) => r.players[(start + i + 1) % r.players.length],
  ).find((t) => t.team !== p.team && !visited.includes(t.id));
}
export function joinRoom(r: Room, auth: string, name: string) {
  const old = r.players.find((p) => p.auth === auth);
  if (old) return old;
  ensure(r.status === "waiting", "對戰已開始，不能加入");
  ensure(r.players.length < r.capacity, "房間已滿");
  const p = makePlayer(auth, name, r.players.length);
  r.players.push(p);
  log(r, `${p.name} 加入了房間`);
  return p;
}
export function applyCommand(r: Room, pid: string, c: Command) {
  const p = r.players.find((p) => p.id === pid);
  ensure(p, "你不在這個房間內");
  if (c.type === "chat") {
    ensure(
      typeof c.text === "string" &&
        c.text.trim().length > 0 &&
        c.text.length <= 120,
      "訊息長度須為 1–120 字",
    );
    r.chat.push({ name: p.name, text: c.text.trim(), id: Date.now() });
    r.chat = r.chat.slice(-40);
    return;
  }
  if (c.type === "ready") {
    ensure(r.status === "waiting", "對戰已開始");
    p.ready = !!c.ready;
    return;
  }
  if (c.type === "avatar") {
    ensure(
      r.status === "waiting" &&
        Number.isInteger(c.avatar) &&
        c.avatar! >= 0 &&
        c.avatar! < 6,
      "目前無法變更參考角色",
    );
    p.avatar = c.avatar!;
    return;
  }
  if (c.type === "bots") {
    ensure(r.host === pid && r.status === "waiting", "只有房主能補入電腦");
    while (r.players.length < r.capacity) {
      const n = r.players.length;
      r.players.push(
        makePlayer(
          `bot-${crypto.randomUUID()}`,
          ["星塵", "夜航", "霧月", "白晝", "流火", "深藍", "晨曦", "微光"][n],
          n,
          true,
        ),
      );
    }
    log(r, "空位已由電腦旅人加入");
    return;
  }
  if (c.type === "removeBot") {
    ensure(r.host === pid && r.status === "waiting", "只有房主能移除電腦");
    r.players = r.players.filter((x) => !(x.id === c.target && x.bot));
    r.players.forEach((x, i) => (x.team = i % 2 ? "blue" : "red"));
    return;
  }
  if (c.type === "leave") {
    ensure(r.status !== "playing", "對戰中請使用暫離，逾時由電腦代打");
    r.players = r.players.filter((x) => x.id !== pid);
    if (r.host === pid) r.host = r.players.find((x) => !x.bot)?.id || "";
    r.players.forEach((x, i) => (x.team = i % 2 ? "blue" : "red"));
    return;
  }
  if (c.type === "rematch") {
    ensure(r.host === pid && r.status === "finished", "只有房主能再開一局");
    r.status = "waiting";
    r.players.forEach((p) => {
      p.hand = [];
      p.effects = [];
      p.ready = p.bot || p.id === r.host;
    });
    r.winner = null;
    r.pending = null;
    r.overflow = null;
    log(r, "準備開始下一場對戰");
    return;
  }
  if (c.type === "start") {
    ensure(r.host === pid && r.status === "waiting", "只有房主能開始");
    ensure(r.players.length === r.capacity, "請等待滿員或補入電腦");
    ensure(
      r.players.every((p) => p.ready),
      "還有玩家尚未準備",
    );
    r.deck = makeDeck();
    r.discard = [];
    r.motions = [];
    r.teams = {
      red: { morale: r.capacity === 8 ? 18 : 15, stones: [], grails: 0 },
      blue: { morale: r.capacity === 8 ? 18 : 15, stones: [], grails: 0 },
    };
    r.players.forEach((p, i) => {
      p.team = i % 2 ? "blue" : "red";
      p.hand = [];
      p.effects = [];
      draw(r, p, 4);
    });
    r.turn = 0;
    r.round = 1;
    r.status = "playing";
    log(r, "星杯之戰開始，雙方各摸 4 張起始手牌");
    begin(r);
    return;
  }
  ensure(r.status === "playing", "目前不在對戰中");
  ensure(actingPlayer(r).id === pid, "還沒輪到你行動");
  if (r.overflow) {
    ensure(c.type === "discard", "請先處理超額手牌");
    const ids = c.cards || [];
    ensure(
      Array.isArray(ids) &&
        ids.length === p.hand.length - 6 &&
        new Set(ids).size === ids.length &&
        ids.every((id) => p.hand.some((c) => c.id === id)),
      "請選擇正確數量的手牌",
    );
    const resume = r.overflow.resume;
    const discarded = ids.map(id => discardCard(r, p, id));
    r.discard.push(...discarded);
    motion(r, p, "discard", discarded);
    r.teams[p.team].morale = Math.max(0, r.teams[p.team].morale - ids.length);
    log(r, `${p.name} 棄 ${ids.length} 張牌，己方士氣 −${ids.length}`);
    r.overflow = null;
    if (!win(r)) {
      if (resume === "next") next(r);
      else timer(r);
    }
    return;
  }
  if (r.pending) {
    const q = r.pending;
    if (
      c.type === "shield" ||
      (c.type === "take" && p.effects.some((e) => e.kind === "shield"))
    ) {
      ensure(
        p.effects.some((e) => e.kind === "shield"),
        "你沒有聖盾",
      );
      resolveShield(r);
      return;
    }
    if (c.type === "take") {
      draw(r, p, q.damage);
      log(
        r,
        `${p.name} 承受 ${q.damage} 點${q.type === "attack" ? "攻擊" : "法術"}傷害`,
      );
      if (q.type === "attack") {
        const source = r.players.find((p) => p.id === q.from)!;
        stone(r, source.team, q.counter ? "crystal" : "gem");
      }
      r.pending = null;
      if (!overflow(r, p, "next")) next(r);
      else timer(r);
      return;
    }
    const card = p.hand.find((x) => x.id === c.cardId);
    ensure(card, "請選擇回應牌");
    if (c.type === "block") {
      ensure(card.kind === "light", "需要聖光才能抵擋");
      r.discard.push(discardCard(r, p, card.id));
      motion(r, p, "play", [card], p.id);
      log(r, `${p.name} 使用聖光抵擋`);
      next(r);
      return;
    }
    ensure(c.type === "counter", "請選擇應戰、聖光或承受傷害");
    if (q.type === "attack") {
      ensure(
        q.kind !== "dark" &&
          isAttack(card.kind) &&
          (card.kind === q.kind || card.kind === "dark"),
        "這張牌無法應戰",
      );
      const target = targets(r, p, q.visited).find((t) => t.id === c.target);
      ensure(target, "請選擇尚未參與這次攻擊的敵方玩家");
      r.discard.push(discardCard(r, p, card.id));
      motion(r, p, "play", [card], target.id);
      r.pending = {
        ...q,
        kind: card.kind,
        from: p.id,
        to: target.id,
        counter: true,
        visited: [...q.visited, p.id],
      };
      log(r, `${p.name} 以${CARDS[card.kind].name}應戰，轉向 ${target.name}`);
    } else {
      ensure(card.kind === "missile", "需要魔彈才能傳遞");
      let visited = [...q.visited, p.id];
      let target = missileTarget(r, p, visited);
      if (!target) {
        visited = [p.id];
        target = missileTarget(r, p, visited);
      }
      ensure(target, "沒有可傳遞的目標");
      r.discard.push(discardCard(r, p, card.id));
      motion(r, p, "play", [card], target.id);
      r.pending = {
        ...q,
        from: p.id,
        to: target.id,
        damage: q.damage + 1,
        visited,
      };
      log(r, `${p.name} 傳遞魔彈，傷害增至 ${q.damage + 1}`);
    }
    timer(r);
    return;
  }
  if (r.weak) {
    ensure(["weakSkip", "weakDraw"].includes(c.type), "請先處理虛弱效果");
    const i = p.effects.findIndex((x) => x.kind === "weak");
    if (i >= 0) r.discard.push(...p.effects.splice(i, 1));
    r.weak = false;
    if (c.type === "weakSkip") {
      log(r, `${p.name} 因虛弱跳過行動`);
      next(r);
    } else {
      draw(r, p, 3);
      log(r, `${p.name} 因虛弱摸 3 張牌，繼續行動`);
      overflow(r, p, "main");
      timer(r);
    }
    return;
  }
  if (c.type === "buy" || c.type === "synthesize") {
    ensure(p.hand.length <= 3, "手牌最多 3 張才能執行此行動");
    if (c.type === "synthesize") {
      ensure(r.teams[p.team].stones.length >= 3, "需要 3 顆星石");
      r.teams[p.team].stones.splice(0, 3);
      r.teams[p.team].grails++;
      r.teams[opponent(p.team)].morale--;
      log(r, `${p.name} 合成星杯，敵方士氣 −1`);
    } else {
      stone(r, p.team, "gem");
      stone(r, p.team, "crystal");
      log(r, `${p.name} 購買星石並摸 3 張牌`);
    }
    draw(r, p, 3);
    next(r);
    return;
  }
  if (c.type === "redraw") {
    ensure(
      p.hand.length > 3 &&
        p.hand.every(
          (c) =>
            c.kind === "light" ||
            (c.kind === "weak" &&
              r.players.every((t) =>
                t.effects.some((e) => e.kind === "weak"),
              )) ||
            (c.kind === "shield" &&
              r.players.every((t) =>
                t.effects.some((e) => e.kind === "shield"),
              )),
        ),
      "仍有可以執行的行動",
    );
    const n = p.hand.length;
    const discarded = p.hand.splice(0);
    r.discard.push(...discarded);
    motion(r, p, "discard", discarded);
    draw(r, p, n);
    log(r, `${p.name} 無法行動，重新抽取 ${n} 張牌`);
    timer(r);
    return;
  }
  ensure(c.type === "play", "未知的行動");
  const card = p.hand.find((x) => x.id === c.cardId);
  ensure(card && card.kind !== "light", "請選擇可使用的手牌");
  let target = r.players.find((t) => t.id === c.target);
  if (card.kind === "missile") target = missileTarget(r, p, [p.id]);
  ensure(target, "請選擇目標");
  if (isAttack(card.kind)) ensure(target.team !== p.team, "只能攻擊敵方");
  if (card.kind === "weak" || card.kind === "shield")
    ensure(
      !target.effects.some((e) => e.kind === card.kind),
      "目標已有同種效果",
    );
  const played = discardCard(r, p, card.id);
  motion(r, p, "play", [played], target.id);
  log(r, `${p.name} 對 ${target.name} 使用${CARDS[card.kind].name}`);
  if (["poison", "weak", "shield"].includes(card.kind)) {
    target.effects.push(played);
    next(r);
  } else {
    r.discard.push(played);
    r.pending = {
      type: card.kind === "missile" ? "missile" : "attack",
      from: p.id,
      to: target.id,
      kind: card.kind,
      damage: 2,
      counter: false,
      visited: [p.id],
    };
    timer(r);
  }
}
export function chooseBot(r: Room): Command {
  const p = actingPlayer(r);
  if (r.overflow)
    return {
      type: "discard",
      cards: [...p.hand]
        .sort(
          (a, b) =>
            (a.kind === "light" ? -1 : 0) - (b.kind === "light" ? -1 : 0),
        )
        .slice(0, p.hand.length - 6)
        .map((c) => c.id),
    };
  if (r.pending) {
    const q = r.pending;
    if (p.effects.some((c) => c.kind === "shield")) return { type: "shield" };
    const light = p.hand.find((c) => c.kind === "light");
    if (light) return { type: "block", cardId: light.id };
    const target = targets(r, p, q.visited)[0];
    const counter = p.hand.find((c) =>
      q.type === "missile"
        ? c.kind === "missile"
        : q.kind !== "dark" &&
          isAttack(c.kind) &&
          (c.kind === q.kind || c.kind === "dark"),
    );
    if (counter && (q.type === "missile" || target))
      return { type: "counter", cardId: counter.id, target: target?.id };
    return { type: "take" };
  }
  if (r.weak) return { type: p.hand.length <= 3 ? "weakDraw" : "weakSkip" };
  if (p.hand.length <= 3)
    return { type: r.teams[p.team].stones.length >= 3 ? "synthesize" : "buy" };
  const enemies = targets(r, p).sort((a, b) => b.hand.length - a.hand.length);
  for (const card of p.hand) {
    let target = enemies[0];
    if (card.kind === "light") continue;
    if (card.kind === "shield")
      target =
        r.players.find(
          (t) =>
            t.team === p.team && !t.effects.some((c) => c.kind === "shield"),
        ) ||
        r.players.find((t) => !t.effects.some((c) => c.kind === "shield"))!;
    if (card.kind === "weak")
      target =
        enemies.find((t) => !t.effects.some((c) => c.kind === "weak")) ||
        r.players.find((t) => !t.effects.some((c) => c.kind === "weak"))!;
    if (target) return { type: "play", cardId: card.id, target: target.id };
  }
  return { type: "redraw" };
}
export function tick(r: Room, now = Date.now()) {
  if (r.status !== "playing" || now < r.deadline) return false;
  const p = actingPlayer(r);
  if (!p.bot) log(r, `${p.name} 行動逾時，由電腦代打`);
  applyCommand(r, p.id, chooseBot(r));
  return true;
}
export type ActionOption = {
  id: string;
  label: string;
  type: string;
  enabled: boolean;
  reason?: string;
  cardId?: string;
  targets: string[];
  count?: number;
};

/** Validate suggestions with the same authoritative engine used for execution.
 * Only this player's cards and public target IDs leave the server.
 * Simulation never mutates the live room or exposes the simulated draw pile.
 */
export function actionOptions(r: Room, pid: string): ActionOption[] {
  const p = r.players.find((x) => x.id === pid);
  if (!p || r.status !== "playing" || actingPlayer(r).id !== pid) return [];
  if (r.overflow)
    return [
      {
        id: "discard",
        label: `選擇 ${p.hand.length - 6} 張手牌棄置`,
        type: "discard",
        enabled: true,
        targets: [],
        count: p.hand.length - 6,
      },
    ];
  const check = (command: Command): string | undefined => {
    try {
      applyCommand(structuredClone(r), pid, command);
      return undefined;
    } catch (error) {
      return error instanceof GameError ? error.message : "此行動暫時無法使用";
    }
  };
  const simple = (type: string, label: string): ActionOption => {
    const reason = check({ type });
    return { id: type, type, label, enabled: !reason, reason, targets: [] };
  };
  if (r.weak && !r.pending)
    return [
      simple("weakSkip", "跳過行動"),
      simple("weakDraw", "摸 3 張牌後行動"),
    ];
  const options = r.pending
    ? [
        simple(
          "take",
          p.effects.some((c) => c.kind === "shield")
            ? "聖盾必須抵擋，不能直接承傷"
            : `承受 ${r.pending.damage} 點傷害`,
        ),
        simple("shield", "聖盾抵擋"),
      ]
    : [
        simple("buy", "購買星石，摸 3 張牌"),
        simple("synthesize", "消耗 3 星石合成星杯"),
        simple("redraw", "宣告無法行動並換牌"),
      ];
  for (const card of p.hand) {
    const type = r.pending
      ? card.kind === "light"
        ? "block"
        : "counter"
      : "play";
    const needsTarget =
      type === "play"
        ? card.kind !== "missile"
        : type === "counter" && r.pending?.type === "attack";
    const possible = needsTarget ? r.players.map((t) => t.id) : [undefined];
    let firstReason: string | undefined;
    let enabled = false;
    const validTargets: string[] = [];
    for (const target of possible) {
      const reason = check({ type, cardId: card.id, target });
      firstReason ||= reason;
      if (!reason) {
        enabled = true;
        if (target) validTargets.push(target);
      }
    }
    options.push({
      id: `${type}:${card.id}`,
      type,
      cardId: card.id,
      label: `${r.pending ? (type === "block" ? "抵擋" : r.pending.type === "missile" ? "傳遞" : "應戰") : "使用"} · ${CARDS[card.kind].name}`,
      enabled,
      targets: validTargets,
      reason: enabled ? undefined : firstReason,
    });
  }
  return options;
}
export function publicView(r: Room, auth: string) {
  const me = r.players.find((p) => p.auth === auth);
  ensure(me, "你不是這個房間的玩家");
  return {
    ...r,
    deck: undefined,
    discard: undefined,
    // Draws and overflow discards are private, including physical card IDs.
    motions: (r.motions || []).map(({ cards, ...event }) => ({
      ...event,
      count: cards.length,
      cards: event.type === "play" || event.player === me.id ? cards : [],
    })),
    deckCount: r.deck.length,
    discardCount: r.discard.length,
    players: r.players.map(({ auth: _, hand, ...p }) => ({
      ...p,
      hand: p.id === me.id ? hand : [],
      handCount: hand.length,
    })),
    me: me.id,
    actor: r.status === "playing" ? actingPlayer(r).id : null,
    actions: actionOptions(r, me.id),
  };
}
export type RoomView = ReturnType<typeof publicView>;
