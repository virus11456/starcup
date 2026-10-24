"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import CardArt from "./card-art";
import Lobby from "./lobby";
import SiteHeader from "./site-header";
import ActionGuide from "./action-guide";
import RolePanel, { Portrait } from "./role-panel";
import { ROLES, roleFor, roleSource } from "@/lib/roles";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Diamond,
  DoorOpen,
  Flame,
  Globe2,
  LayoutGrid,
  Link2,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  CARDS,
  applyCommand,
  createRoom,
  publicView,
  tick,
  type CardKind,
  type Command,
  type Room,
  type RoomView,
  type Team,
} from "@/lib/game";

const ThreeScene = dynamic(() => import("./three-scene"), {
  ssr: false,
  loading: () => <div className="three-loading">✦</div>,
});
const CardMotionLayer = dynamic(() => import("./card-motion-layer"), { ssr: false });
const RulesDictionary = dynamic(() => import("./rules-dictionary"));
type RoomSummary = {
  code: string;
  name: string;
  count: number;
  capacity: number;
  status: string;
  host: string;
};
const GUIDE = "https://xingbeichuanshuobaike.webnode.tw/遊戲指南-新手攻略/";
function Grail({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "grail-small" : "grail-art"}
      viewBox="0 0 400 380"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={small ? "gold-small" : "gold"}
          x1="120"
          y1="50"
          x2="270"
          y2="310"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f0db9f" />
          <stop offset=".45" stopColor="#c49c57" />
          <stop offset="1" stopColor="#775c37" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${small ? "gold-small" : "gold"})`}>
        <circle cx="200" cy="180" r="133" strokeOpacity=".25" />
        <circle
          cx="200"
          cy="180"
          r="113"
          strokeOpacity=".18"
          strokeDasharray="2 9"
        />
        <path
          d="m200 15 7 15-7 15-7-15zM200 320l7 15-7 15-7-15zM39 180l15-7 15 7-15 7zM331 180l15-7 15 7-15 7z"
          fill="#c7a969"
          strokeWidth="1"
        />
        <path
          d="M135 113h130l-12 65c-5 29-25 50-53 50s-48-21-53-50z"
          fill="#1d2027"
          strokeWidth="3"
        />
        <path
          d="M135 125h-24l7 40c4 24 19 31 37 32M265 125h24l-7 40c-4 24-19 31-37 32M190 229v38l-27 18v9h74v-9l-27-18v-38"
          strokeWidth="3"
        />
        <path
          d="M148 125h104M153 143h94M160 294h80M153 304h94"
          strokeWidth="2"
        />
        <path d="m200 146 18 22-18 28-18-28z" fill="#c8a86a" />
        <path d="m200 153 10 15-10 17-10-17z" fill="#262529" />
        <path d="m200 49 5 15 15 5-15 5-5 15-5-15-15-5 15-5z" fill="#e5c88c" />
        <path d="M114 75 124 85M276 275l10 10M82 250l9-4M312 96l-9 4" />
        <circle cx="90" cy="105" r="2" fill="#d2b97e" />
        <circle cx="299" cy="233" r="2" fill="#d2b97e" />
      </g>
    </svg>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="關閉" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function TeamScore({
  team,
  data,
}: {
  team: Team;
  data: RoomView["teams"][Team];
}) {
  return (
    <div className={`score ${team}`}>
      <div className="score-name">
        <span className="team-dot" />
        {team === "red" ? "緋紅陣營" : "蒼藍陣營"}
      </div>
      <div className="morale">
        {data.morale}
        <span>士氣</span>
      </div>
      <div className="score-detail">
        <span>
          <Trophy size={15} />
          {data.grails}
          <small>/ 5</small>
        </span>
        <span>
          <Diamond size={15} />
          {data.stones.length}
          <small>/ 5</small>
        </span>
      </div>
      <div className="stone-row">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={data.stones[i] || "empty-stone"}>
            ◆
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState("lobby");
  const [previewCard, setPreviewCard] = useState<CardKind | null>(null);
  const [previewRole, setPreviewRole] = useState<number | null>(null);
  const [practiceRole, setPracticeRole] = useState(0);
  const [modal, setModal] = useState<
    "create" | "join" | "rules" | "dictionary" | null
  >(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [isPublic, setPublic] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [chat, setChat] = useState("");
  const [tab, setTab] = useState("log");
  const [seconds, setSeconds] = useState(0);
  const [search, setSearch] = useState("");
  const roomRef = useRef<RoomView | null>(null);
  const local = useRef<Room | null>(null);
  const mutating = useRef(false);
  const me = room?.players.find((p) => p.id === room.me);
  const myTurn = room?.actor === room?.me;
  const card = me?.hand.find((c) => c.id === selected[0]);
  const accept = useCallback((r: RoomView) => {
    if (
      roomRef.current &&
      r.code === roomRef.current.code &&
      r.revision < roomRef.current.revision
    )
      return;
    roomRef.current = r;
    setRoom(r);
    setSelected((ids) =>
      ids.filter((id) =>
        r.players.find((p) => p.id === r.me)?.hand.some((c) => c.id === id),
      ),
    );
    setConnected(true);
  }, []);
  const request = useCallback(async (data?: unknown, code?: string) => {
    const res = await fetch(code ? `/api/game?room=${code}` : "/api/game", {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    if (!res.ok)
      throw Object.assign(new Error(json.error || "連線失敗"), {
        status: res.status,
      });
    return json;
  }, []);
  const loadLobby = useCallback(async () => {
    try {
      const d = await request();
      setRooms(d.rooms);
      setReady(d.configured);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [request]);
  useEffect(() => {
    const stored = localStorage.getItem("grail-name-v1");
    if (stored) setName(stored);
    const invite = new URLSearchParams(location.search).get("room");
    if (invite) {
      setJoinCode(invite.toUpperCase());
      setModal("join");
    }
    const saved = localStorage.getItem("grail-room-v1");
    if (saved && !invite)
      request(undefined, saved)
        .then((d) => {
          accept(d.room);
          setPage("room");
        })
        .catch(() => localStorage.removeItem("grail-room-v1"));
    loadLobby();
  }, [accept, request, loadLobby]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 7000);
    return () => clearTimeout(t);
  }, [error]);
  useEffect(() => {
    if (page !== "room" || !room) return;
    let active = true;
    let handle: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!active) return;
      try {
        const current = roomRef.current;
        if (current && !mutating.current) {
          if (practice && local.current) {
            if (tick(local.current)) {
              local.current.revision++;
              accept(publicView(local.current, "practice"));
            }
          } else if (!practice) {
            const d =
              current.status === "playing" && Date.now() >= current.deadline
                ? await request({ type: "tick", code: current.code })
                : await request(undefined, current.code);
            if (active) accept(d.room);
          }
        }
      } catch {
        if (active) setConnected(false);
      }
      if (active) handle = setTimeout(poll, practice ? 600 : 1800);
    };
    handle = setTimeout(poll, practice ? 600 : 1800);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [page, room?.code, practice, accept, request]);
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    const update = () =>
      setSeconds(
        Math.max(
          0,
          Math.ceil(((roomRef.current?.deadline || 0) - Date.now()) / 1000),
        ),
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [room?.status]);
  async function run(command: Command) {
    if (mutating.current || !roomRef.current) return;
    mutating.current = true;
    setBusy(true);
    setError("");
    try {
      if (practice && local.current) {
        const draft = structuredClone(local.current);
        applyCommand(draft, roomRef.current.me, command);
        draft.revision++;
        local.current = draft;
        if (command.type === "leave") {
          back();
          return;
        }
        accept(publicView(draft, "practice"));
      } else {
        const d = await request({
          type: "action",
          code: roomRef.current.code,
          revision: roomRef.current.revision,
          command,
        });
        if (d.left) {
          localStorage.removeItem("grail-room-v1");
          back();
          return;
        }
        accept(d.room);
      }
      if (!["chat", "avatar", "ready"].includes(command.type)) {
        setSelected([]);
        setTarget("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      if (!practice && roomRef.current)
        request(undefined, roomRef.current.code)
          .then((d) => accept(d.room))
          .catch(() => setConnected(false));
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  function back() {
    setPage("lobby");
    setRoom(null);
    roomRef.current = null;
    local.current = null;
    setPractice(false);
    setSelected([]);
    setTarget("");
    loadLobby();
  }
  async function enter(type: "create" | "join") {
    if (!name.trim()) {
      setError("先為自己取個名字吧");
      return;
    }
    setBusy(true);
    try {
      const d = await request(
        type === "create"
          ? { type, name, title, capacity, public: isPublic }
          : { type, name, code: joinCode.trim().toUpperCase() },
      );
      setPractice(false);
      accept(d.room);
      setPage("room");
      setModal(null);
      localStorage.setItem("grail-name-v1", name);
      localStorage.setItem("grail-room-v1", d.room.code);
      history.replaceState(null, "", location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }
  function training() {
    const r = createRoom(
      "PRACTICE",
      "practice",
      name || "星之旅人",
      "星之試煉",
      4,
      false,
    );
    applyCommand(r, r.host, { type: "bots" });
    applyCommand(r, r.host, { type: "avatar", avatar: practiceRole });
    applyCommand(r, r.host, { type: "start" });
    local.current = r;
    setPractice(true);
    accept(publicView(r, "practice"));
    setPage("room");
    setSelected([]);
    setTarget("");
  }
  async function invite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${room.code}`,
      );
      setNotice("邀請連結已複製");
    } catch {
      setNotice(`邀請碼：${room.code}`);
    }
  }
  function chooseCard(id: string) {
    if (room?.overflow && myTurn)
      setSelected((old) =>
        old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
      );
    else setSelected((old) => (old[0] === id ? [] : [id]));
    setTarget("");
  }
  const selection =
    target || (card?.kind === "shield" ? me?.id : undefined) || "";
  const currentOption = room?.actions?.find(
    (a) => a.cardId === card?.id && a.cardId,
  );
  const selectedLegal =
    !!currentOption?.enabled &&
    (!currentOption.targets.length ||
      currentOption.targets.includes(selection));
  const canSelectTarget = (id: string) =>
    !card || !currentOption?.targets.length || currentOption.targets.includes(id);
  function selectTarget(id: string) {
    if (canSelectTarget(id)) setTarget(id);
  }
  const permitted = (type: string) =>
    !!room?.actions?.some((a) => a.type === type && a.enabled);
  const displayed = rooms.filter(
    (r) => r.name.includes(search) || r.code.includes(search.toUpperCase()),
  );
  const mainAction = room?.overflow
    ? "棄牌階段"
    : room?.pending
      ? "回應階段"
      : room?.weak
        ? "虛弱結算"
        : "行動階段";
  return (
    <div
      className={`app-shell ${page !== "room" ? "portal-mode" : ""} ${page === "room" && room?.status !== "waiting" ? "battle-mode" : ""}`}
    >
      {page !== "room" && <SiteHeader />}
      {room && <CardMotionLayer room={room} />}
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => {
            if (page === "room") setError("請使用左上角返回或暫離按鈕");
            else setPage("lobby");
          }}
        >
          <div className="brand-icon">
            <Trophy size={24} />
          </div>
          <div>
            <strong>星杯傳說</strong>
            <span>ASTERIATED GRAIL</span>
          </div>
        </button>
        <div className="side-rule" />
        <p className="nav-label">探索星界</p>
        <nav>
          <a className="nav-item" href="/full">
            <Swords size={18} />
            正式擴充對戰
          </a>
          <button
            className={page === "lobby" ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (room) setError("目前仍在房間內，請先暫離或離開");
              else setPage("lobby");
            }}
          >
            <LayoutGrid size={18} />
            對戰大廳
          </button>
          <button
            className={page === "cards" ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (room) setModal("rules");
              else setPage("cards");
            }}
          >
            <BookOpen size={18} />
            卡牌圖鑑<span>11</span>
          </button>
          <button
            className={page === "dictionary" ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (room) setModal("dictionary");
              else setPage("dictionary");
            }}
          >
            <BookOpen size={18} />
            規則字典
          </button>
          <button className="nav-item" onClick={() => setModal("rules")}>
            <Sparkles size={18} />
            新手指南
            <ChevronRight size={15} />
          </button>
        </nav>
        <div className="side-note">
          <span className="small-star">✦</span>
          <h4>
            每一次出牌，
            <br />
            都是命運的轉折。
          </h4>
          <p>
            與夥伴並肩，
            <br />
            讓星杯見證你們的傳說。
          </p>
        </div>
        <div className="side-bottom">
          <span className="beta-badge">CORE BETA</span>
          <p>
            非官方核心規則測試版
            <br />
            v0.1 · 為同好而生
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            星杯傳說 <ChevronRight size={12} />{" "}
            <span>
              {page === "room"
                ? "對戰房間"
                : page === "cards"
                  ? "卡牌圖鑑"
                  : page === "dictionary"
                    ? "規則字典"
                    : "對戰大廳"}
            </span>
          </div>
          <div className="top-actions">
            <span className={`connection ${connected ? "" : "offline"}`}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>
                {practice
                  ? "本機練習"
                  : connected
                    ? ready
                      ? "連線已就緒"
                      : "多人服務待設定"
                    : "重新連線中"}
              </span>
            </span>
            <span className="top-separator" />
            <div className="user-dot">
              {me ? <Portrait avatar={me.avatar} /> : "✦"}
            </div>
            <span>{name || "星之旅人"}</span>
          </div>
        </header>
        {error && (
          <div className="toast error" role="alert">
            <Shield size={18} />
            {error}
            <button onClick={() => setError("")} aria-label="關閉訊息">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        <main>
          {page === "lobby" && <Lobby rooms={rooms} connected={connected && ready} create={() => setModal("create")} join={(code) => { if (code) setJoinCode(code); setModal("join"); }} practice={training} refresh={loadLobby} />}
          {page === "dictionary" && <RulesDictionary />}
          {page === "cards" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">THE ARCANA</div>
                  <h1>
                    卡牌圖鑑<span>✦</span>
                  </h1>
                  <p>認識核心牌組，讓每一次出牌都更有把握。</p>
                </div>
                <button className="secondary" onClick={() => setModal("rules")}>
                  規則與版本差異
                </button>
              </div>
              <div className="scope-note">
                <BookOpen size={18} />
                每類展示一張原作參考牌面，可點擊放大。牌面下方的角色獨有技與完整牌組配比尚未加入；本版依文字摘要結算。
              </div>
              <div className="catalog">
                {(Object.keys(CARDS) as CardKind[]).map((k) => (
                  <article
                    className="catalog-card"
                    style={
                      { "--card-color": CARDS[k].color } as React.CSSProperties
                    }
                    key={k}
                  >
                    <span className="card-type">{CARDS[k].type}</span>
                    <button
                      className="catalog-art-button"
                      onClick={() => setPreviewCard(k)}
                      aria-label={`放大${CARDS[k].name}牌面`}
                    >
                      <CardArt kind={k} />
                      <span>放大牌面 ↗</span>
                    </button>
                    <h3>{CARDS[k].name}</h3>
                    <p>{CARDS[k].description}</p>
                    <span className="card-footer">
                      原作參考牌面 · 核心版摘要
                    </span>
                  </article>
                ))}
              </div>
              <p className="art-credit">
                牌面圖片來源：
                <a href={GUIDE} target="_blank" rel="noreferrer">
                  星杯傳說百科 · 新手攻略
                </a>
                。圖片權利歸原權利人。
              </p>
            </>
          )}
          {page === "room" && room && (
            <>
              <div className="room-heading">
                <div>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (room.status === "playing") {
                        back();
                      } else run({ type: "leave" });
                    }}
                  >
                    <ArrowLeft size={16} />
                    {room.status === "playing" ? "暫離至大廳" : "離開房間"}
                  </button>
                  <h1>
                    {room.name}
                    <span className="beta-badge">
                      {practice
                        ? "本機練習"
                        : `${room.capacity / 2} vs ${room.capacity / 2}`}
                    </span>
                  </h1>
                </div>
                <div className="room-header-actions">
                  {!practice && (
                    <button className="secondary" onClick={invite}>
                      <Copy size={15} />
                      {room.code}
                      <span>邀請好友</span>
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label="遊戲規則"
                    onClick={() => setModal("rules")}
                  >
                    <BookOpen size={19} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setModal("dictionary")}
                  >
                    問規則
                  </button>
                </div>
              </div>
              {practice && (
                <div className="practice-banner">
                  <Sparkles size={15} />
                  本機練習模式 · 其他座位為電腦玩家 · 返回大廳會結束練習
                </div>
              )}
              {room.status === "waiting" ? (
                <section className="waiting-room">
                  <div className="waiting-title">
                    <div className="eyebrow">GATHER YOUR PARTY</div>
                    <h2>讓星辰，連結彼此。</h2>
                    <p>
                      {room.players.length} / {room.capacity} 位旅人已就位 ·
                      玩家依座位交錯分為紅藍陣營
                    </p>
                  </div>
                  <div className="seat-grid">
                    {Array.from({ length: room.capacity }, (_, i) => {
                      const p = room.players[i];
                      return (
                        <div
                          className={`seat ${i % 2 ? "blue" : "red"} ${p ? "occupied" : ""}`}
                          key={i}
                        >
                          {p ? (
                            <>
                              <div className="seat-avatar">
                                <Portrait avatar={p.avatar} />
                              </div>
                              <strong>
                                {p.name}
                                {p.id === room.me && <small>你</small>}
                              </strong>
                              <span className="seat-type">
                                {roleFor(p.avatar).name} ·{" "}
                                {p.bot
                                  ? "電腦旅人"
                                  : p.id === room.host
                                    ? "房主"
                                    : "冒險者"}
                                {p.id === room.host && <Crown size={12} />}
                              </span>
                              <span
                                className={`ready-label ${p.ready ? "yes" : ""}`}
                              >
                                {p.ready ? (
                                  <>
                                    <Check size={13} />
                                    已準備
                                  </>
                                ) : (
                                  "準備中"
                                )}
                              </span>
                              {p.bot && room.host === room.me && (
                                <button
                                  className="remove-bot"
                                  onClick={() =>
                                    run({ type: "removeBot", target: p.id })
                                  }
                                  aria-label={`移除${p.name}`}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="seat-avatar empty">
                                <Plus size={22} />
                              </div>
                              <strong>等待旅人加入</strong>
                              <span className="seat-type">
                                {i % 2 ? "蒼藍陣營" : "緋紅陣營"}
                              </span>
                              <span className="waiting-line" />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="waiting-settings">
                    <span>選擇參考角色</span>
                    <div className="role-picker">
                      {ROLES.map((role, i) => (
                        <button
                          key={role.id}
                          aria-label={`選擇${role.name}`}
                          aria-pressed={me?.avatar === i}
                          className={me?.avatar === i ? "selected" : ""}
                          onClick={() => run({ type: "avatar", avatar: i })}
                        >
                          <Portrait avatar={i} />
                          <strong>{role.name}</strong>
                        </button>
                      ))}
                    </div>
                    <small>
                      角色圖片與技能教學提醒；本版尚未套用角色技能效果。
                    </small>
                  </div>
                  <div className="waiting-footer">
                    <span>
                      <Shield size={15} />
                      核心規則 · 每回合 90 秒 · 逾時代打
                    </span>
                    <div>
                      {room.host === room.me ? (
                        <>
                          <button
                            className="secondary"
                            disabled={
                              busy || room.players.length === room.capacity
                            }
                            onClick={() => run({ type: "bots" })}
                          >
                            <Users size={16} />
                            電腦補位
                          </button>
                          <button
                            className="primary"
                            disabled={
                              busy ||
                              room.players.length !== room.capacity ||
                              !room.players.every((p) => p.ready)
                            }
                            onClick={() => run({ type: "start" })}
                          >
                            <Swords size={17} />
                            開始對戰
                          </button>
                        </>
                      ) : (
                        <button
                          className={me?.ready ? "secondary" : "primary"}
                          disabled={busy}
                          onClick={() =>
                            run({ type: "ready", ready: !me?.ready })
                          }
                        >
                          {me?.ready ? "取消準備" : "準備好了"}
                          <Check size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <div className="battle-layout">
                    <div className="arena-panel">
                      <div className="battle-scoreboard">
                        <TeamScore team="red" data={room.teams.red} />
                        <div className="round-info">
                          <span>ROUND</span>
                          <strong>{String(room.round).padStart(2, "0")}</strong>
                          <div className="vs">VS</div>
                          <small>
                            牌庫 {room.deckCount} · 棄牌 {room.discardCount}
                          </small>
                        </div>
                        <TeamScore team="blue" data={room.teams.blue} />
                      </div>
                      <div className="table-stage"><div className="motion-piles" aria-label="牌堆"><div className="motion-pile" data-pile="deck">✦<small>牌庫</small><b>{room.deckCount}</b></div><div className="motion-pile discard-pile" data-pile="discard">◇<small>棄牌堆</small><b>{room.discardCount}</b></div></div>
                        <ThreeScene
                          mode="table"
                          room={room}
                          target={selection}
                          onSelect={selectTarget}
                        />
                        <div className="battlefield">
                          <div className="table-ring" />
                          <div className="arena-sigil">✧</div>
                          <div
                            className="combatants"
                            data-count={room.players.length}
                          >
                            {room.players.map((p) => (
                              <button
                                key={p.id}
                                data-player-id={p.id}
                                className={`combatant ${p.team} ${p.id === room.actor ? "acting" : ""} ${selection === p.id ? "targeted" : ""}`}
                                onClick={() => selectTarget(p.id)}
                                aria-label={`選擇目標 ${p.name}`}
                                disabled={!canSelectTarget(p.id)}
                              >
                                <span className="combatant-avatar">
                                  <Portrait avatar={p.avatar} />
                                  {p.id === room.actor && <i />}
                                </span>
                                <strong>
                                  {p.name}
                                  {p.id === room.me && <small>你</small>}
                                </strong>
                                <span>
                                  {roleFor(p.avatar).name} · 手牌 {p.handCount}
                                </span>
                                <div className="effects">
                                  {p.effects.map((e) => (
                                    <b
                                      key={e.id}
                                      data-effect-card-id={e.id}
                                      style={{ color: CARDS[e.kind].color }}
                                      title={CARDS[e.kind].name}
                                    >
                                      {CARDS[e.kind].symbol}
                                    </b>
                                  ))}
                                </div>
                                {selection === p.id && (
                                  <span className="target-tag">已選目標</span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="turn-banner">
                            {room.status === "finished" ? (
                              <>
                                <Trophy size={20} />
                                {room.winner === "red" ? "緋紅" : "蒼藍"}
                                陣營贏得了這場傳說
                              </>
                            ) : (
                              <>
                                <span className="live-dot" />
                                <strong>
                                  {myTurn
                                    ? "輪到你了"
                                    : `等待 ${room.players.find((p) => p.id === room.actor)?.name}`}
                                </strong>
                                <span>{mainAction}</span>
                                <span className="timer">{seconds}s</span>
                              </>
                            )}
                          </div>
                          {room.pending && (
                            <div className="pending-info">
                              {
                                room.players.find(
                                  (p) => p.id === room.pending?.from,
                                )?.name
                              }{" "}
                              的 {CARDS[room.pending.kind].name} →{" "}
                              {
                                room.players.find(
                                  (p) => p.id === room.pending?.to,
                                )?.name
                              }{" "}
                              · {room.pending.damage} 點傷害
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="hand-area">
                        {me && (
                          <div className="hand-hero">
                            <button
                              onClick={() => setPreviewRole(me.avatar)}
                              aria-label="查看我的角色技能"
                            >
                              <Portrait avatar={me.avatar} />
                            </button>
                            <div>
                              <strong>{roleFor(me.avatar).name}</strong>
                              <span>{me.name} · 你的手牌</span>
                            </div>
                          </div>
                        )}
                        <div className="hand-heading">
                          <h3>
                            你的手牌 <span>{me?.handCount} / 6</span>
                          </h3>
                          <span>
                            {room.overflow && myTurn
                              ? `選擇 ${(me?.handCount || 6) - 6} 張牌棄置`
                              : "點選卡牌，再選擇場上的目標"}
                          </span>
                        </div>
                        <div className="hand">
                          {me?.hand.map((c, handIndex) => (
                            <button
                              key={c.id}
                              data-card-id={c.id}
                              className={`playing-card ${selected.includes(c.id) ? "chosen" : ""}`}
                              style={
                                {
                                  "--card-color": CARDS[c.kind].color,
                                  "--tilt": `${(handIndex - (me.hand.length - 1) / 2) * 3}deg`,
                                } as React.CSSProperties
                              }
                              onClick={() => chooseCard(c.id)}
                              aria-pressed={selected.includes(c.id)}
                              aria-label={`${CARDS[c.kind].name}：${CARDS[c.kind].description}`}
                              disabled={room.status === "finished"}
                            >
                              <span className="card-type">
                                {CARDS[c.kind].type}
                              </span>
                              <CardArt kind={c.kind} eager />
                              <strong>{CARDS[c.kind].name}</strong>
                              {selected.includes(c.id) && (
                                <span className="selected-check">
                                  <Check size={12} />
                                </span>
                              )}
                            </button>
                          ))}
                          {!me?.hand.length && (
                            <div className="empty-hand">
                              手中沒有牌，可以購買星石並補充手牌。
                            </div>
                          )}
                        </div>
                        {card && (
                          <div className="selected-card-info">
                            <p>
                              <strong>{CARDS[card.kind].name}</strong> ·{" "}
                              {CARDS[card.kind].description}
                            </p>
                            <button
                              className="text-button"
                              onClick={() => setPreviewCard(card.kind)}
                            >
                              放大牌面 ↗
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="action-bar">
                        {room.status === "finished" ? (
                          <>
                            <span>星杯已定，新的旅程即將開始。</span>
                            {room.host === room.me && (
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() => run({ type: "rematch" })}
                              >
                                <RefreshCw size={16} />
                                再來一局
                              </button>
                            )}
                          </>
                        ) : !myTurn ? (
                          <>
                            <span>
                              <LoaderCircle size={16} className="slow-spin" />
                              其他旅人正在行動
                            </span>
                            <button
                              className="subtle-button"
                              onClick={() => setModal("rules")}
                            >
                              查看規則
                              <BookOpen size={16} />
                            </button>
                          </>
                        ) : room.overflow ? (
                          <>
                            <span>超額手牌將使己方士氣下降。</span>
                            <button
                              className="primary"
                              disabled={
                                busy ||
                                selected.length !== (me?.handCount || 0) - 6
                              }
                              onClick={() =>
                                run({ type: "discard", cards: selected })
                              }
                            >
                              棄置 {selected.length} 張牌
                            </button>
                          </>
                        ) : room.pending ? (
                          <>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => run({ type: "take" })}
                            >
                              {me?.effects.some((c) => c.kind === "shield")
                                ? "聖盾抵擋（必須消耗）"
                                : `承受 ${room.pending.damage} 點傷害`}
                            </button>
                            {me?.effects.some((c) => c.kind === "shield") && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => run({ type: "shield" })}
                              >
                                <Shield size={16} />
                                聖盾抵擋
                              </button>
                            )}
                            <button
                              className="primary"
                              disabled={busy || !selectedLegal}
                              onClick={() =>
                                run({
                                  type:
                                    card?.kind === "light"
                                      ? "block"
                                      : "counter",
                                  cardId: card?.id,
                                  target: selection,
                                })
                              }
                            >
                              {card?.kind === "light"
                                ? "聖光抵擋"
                                : room.pending.type === "missile"
                                  ? "傳遞魔彈"
                                  : "應戰轉移"}
                              <Swords size={16} />
                            </button>
                          </>
                        ) : room.weak ? (
                          <>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => run({ type: "weakSkip" })}
                            >
                              跳過行動
                            </button>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => run({ type: "weakDraw" })}
                            >
                              摸 3 張牌並行動
                            </button>
                          </>
                        ) : (
                          <>
                            <div>
                              <button
                                className="secondary"
                                disabled={busy || !permitted("buy")}
                                onClick={() => run({ type: "buy" })}
                              >
                                <Diamond size={15} />
                                購買
                              </button>
                              <button
                                className="secondary"
                                disabled={busy || !permitted("synthesize")}
                                onClick={() => run({ type: "synthesize" })}
                              >
                                <Trophy size={15} />
                                合成星杯
                              </button>
                              <button
                                className="subtle-button"
                                disabled={busy || !permitted("redraw")}
                                onClick={() => run({ type: "redraw" })}
                                title="只有沒有合法行動時才能換牌"
                              >
                                無法行動
                              </button>
                            </div>
                            <button
                              className="primary"
                              disabled={busy || !selectedLegal}
                              onClick={() =>
                                run({
                                  type: "play",
                                  cardId: card?.id,
                                  target: selection,
                                })
                              }
                            >
                              {card
                                ? `使用${CARDS[card.kind].name}`
                                : "請先選擇手牌"}
                              <ArrowRight size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <aside className="battle-log">
                      <RolePanel
                        room={room}
                        cardId={card?.id}
                        inspect={setPreviewRole}
                      />
                      <ActionGuide
                        room={room}
                        busy={busy}
                        selectedCard={card?.id}
                        choose={(option) => {
                          if (option.cardId) {
                            setSelected([option.cardId]);
                            setTarget(
                              option.targets.length === 1
                                ? option.targets[0]
                                : "",
                            );
                          } else if (option.type === "discard")
                            setNotice(
                              `請選擇 ${option.count} 張手牌，再按棄置確認。`,
                            );
                          else run({ type: option.type });
                        }}
                      />
                      <div className="log-tabs">
                        <button
                          className={tab === "log" ? "active" : ""}
                          onClick={() => setTab("log")}
                        >
                          對戰紀錄
                        </button>
                        <button
                          className={tab === "chat" ? "active" : ""}
                          onClick={() => setTab("chat")}
                        >
                          <MessageCircle size={14} />
                          房間聊天
                        </button>
                      </div>
                      {tab === "log" ? (
                        <div className="log-content">
                          {[...room.logs].reverse().map((l, i) => (
                            <div
                              className={`log-item ${i === 0 ? "latest" : ""}`}
                              key={l.id}
                            >
                              <span>✧</span>
                              <p>{l.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="chat-content">
                            {room.chat.length ? (
                              room.chat.map((m, i) => (
                                <div className="chat-item" key={`${m.id}-${i}`}>
                                  <strong>{m.name}</strong>
                                  <p>{m.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="muted">向夥伴打個招呼吧。</p>
                            )}
                          </div>
                          <form
                            className="chat-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (chat.trim()) {
                                run({ type: "chat", text: chat });
                                setChat("");
                              }
                            }}
                          >
                            <input
                              value={chat}
                              onChange={(e) => setChat(e.target.value)}
                              maxLength={120}
                              placeholder="傳送訊息…"
                              aria-label="聊天訊息"
                            />
                            <button
                              disabled={busy || !chat.trim()}
                              aria-label="傳送"
                            >
                              <Send size={16} />
                            </button>
                          </form>
                        </>
                      )}
                      <div className="log-tip">
                        <BookOpen size={16} />
                        <p>
                          傷害會轉為摸牌。超過 6
                          張手牌時，棄牌數會扣除隊伍士氣。
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {previewRole !== null && (
        <Modal
          title={`${roleFor(previewRole).name} · 角色與技能卡`}
          close={() => setPreviewRole(null)}
        >
          <div className="role-reference">
            <img
              src={`/roles/${roleFor(previewRole).id}.png`}
              alt={`${roleFor(previewRole).name}角色卡`}
              width={355}
              height={491}
            />
            <img
              src={`/roles/${roleFor(previewRole).id}-skills.png`}
              alt={`${roleFor(previewRole).name}完整技能說明卡`}
              width={655}
              height={473}
            />
          </div>
          <p className="field-note">
            目前為角色圖片與技能教學提醒模式。角色技能尚未加入對戰結算，不會因選擇角色而自動改變傷害或資源。
          </p>
          <p className="art-credit">
            圖片與技能參考：
            <a href={roleSource(previewRole)} target="_blank" rel="noreferrer">
              星杯傳說百科 · {roleFor(previewRole).name}
            </a>
          </p>
        </Modal>
      )}
      {previewCard && (
        <Modal
          title={`${CARDS[previewCard].name} · 參考牌面`}
          close={() => setPreviewCard(null)}
        >
          <div className="card-preview">
            <CardArt key={previewCard} kind={previewCard} eager />
          </div>
          <p className="card-preview-rule">
            <strong>本版效果</strong>
            <br />
            {CARDS[previewCard].description}
          </p>
          <p className="field-note">
            此圖為該類卡牌的其中一張參考牌面。角色獨有技與技能標記尚未實作，遊戲依上方「本版效果」結算。
          </p>
          <p className="art-credit">
            圖片來源：
            <a href={GUIDE} target="_blank" rel="noreferrer">
              星杯傳說百科
            </a>
          </p>
        </Modal>
      )}
      {modal === "create" && (
        <Modal title="建立你的星杯之約" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enter("create");
            }}
          >
            <p className="modal-description">
              分享邀請碼，與朋友一起踏入星之戰場。
            </p>
            <label>
              你的暱稱
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="星之旅人"
                required
              />
            </label>
            <label>
              房間名稱
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={30}
                placeholder="今晚，一起奪取星杯"
              />
            </label>
            <label>對戰人數</label>
            <div className="capacity-options">
              {[4, 6, 8].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={capacity === n ? "selected" : ""}
                  onClick={() => setCapacity(n)}
                >
                  <Users size={18} />
                  <strong>{n} 人</strong>
                  <span>
                    {n / 2} vs {n / 2}
                  </span>
                </button>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setPublic(e.target.checked)}
              />
              顯示於公開大廳，讓其他旅人加入
            </label>
            <p className="field-note">預設為邀請房，知道邀請碼的人才能加入。</p>
            <button className="primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="slow-spin" size={17} />
              ) : (
                <Plus size={17} />
              )}
              建立房間
            </button>
            {!ready && (
              <p className="field-note">
                多人服務尚未設定完成；可先返回大廳進行本機練習。
              </p>
            )}
          </form>
        </Modal>
      )}
      {modal === "join" && (
        <Modal title="赴一場星杯之約" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enter("join");
            }}
          >
            <p className="modal-description">
              輸入朋友分享的 8 位邀請碼，即可加入房間。
            </p>
            <label>
              你的暱稱
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="星之旅人"
                required
              />
            </label>
            <label>
              房間邀請碼
              <input
                className="code-input"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(
                    e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                  )
                }
                minLength={8}
                maxLength={8}
                placeholder="XXXXXXXX"
                required
              />
            </label>
            <button
              className="primary full"
              disabled={busy || joinCode.length !== 8}
            >
              <DoorOpen size={17} />
              加入房間
            </button>
          </form>
        </Modal>
      )}
      {modal === "dictionary" && (
        <Modal title="星杯規則字典" close={() => setModal(null)}>
          <div className="rules-scroll">
            <RulesDictionary />
          </div>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal title="冒險者指南" close={() => setModal(null)}>
          <div className="rules-scroll">
            <div className="rules-intro">
              <Trophy size={25} />
              <p>
                取得 <b>5 個星杯</b>，或讓敵方<b>士氣歸零</b>，即可贏得勝利。
              </p>
            </div>
            <h3>01 · 輪到你時</h3>
            <p>
              選擇一次攻擊、法術、購買或合成。購買與合成會摸 3
              張牌，必須在不超過 6 張手牌的情況下使用。沒有每回合自動補牌。
            </p>
            <h3>02 · 遭到攻擊時</h3>
            <p>
              可用同系攻擊牌或暗滅應戰，轉向本次攻擊來源以外的敵方；也可用聖光抵擋。暗滅不能被應戰。有聖盾時，未應戰或使用聖光便會消耗聖盾抵擋。
            </p>
            <h3>03 · 傷害與星石</h3>
            <p>
              每點傷害摸 1 張牌。超過 6 張時自行棄牌，每棄 1 張扣 1
              士氣。主動攻擊命中獲寶石，應戰命中獲水晶；法術命中不獲星石。戰績區上限
              5 顆。
            </p>
            <h3>04 · 通往星杯</h3>
            <p>
              購買獲 1 寶石與 1 水晶。合成消耗 3 顆星石換 1 星杯，並扣敵方 1
              士氣。4／6 人開局 15 士氣，8 人開局 18 士氣。每人起手 4 張。
            </p>
            <div className="scope-note">
              <Shield size={18} />
              <div>
                <b>核心測試版的範圍</b>
                <p>
                  已實作 6 種攻擊與 5
                  種法術、應戰鏈、魔彈傳遞、手動棄牌與回合結算。尚未實作角色技能、治療、提煉能量、BP
                  與擴充裁定。
                </p>
                <p>
                  新牌局採百科配比 150 張：五系攻擊各 21 張、暗滅 6、聖光 11、聖盾 10，中毒、虛弱與魔彈各 6 張。
                  核心版尚未結算法術屬性及技能標記；角色選擇目前只影響圖片與教學提醒。合成優先消耗最早取得的星石。座位採紅藍交錯。
                </p>
              </div>
            </div>
            <h3>連線與暫離</h3>
            <p>
              房間約每 2 秒同步一次。每次行動限時 90
              秒，逾時由電腦代打；用原瀏覽器重新整理或返回邀請連結可重連原座位。清除瀏覽器
              Cookie 會失去原座位身分。房間閒置 24 小時後過期。
            </p>
            <h3>規則參考</h3>
            <a
              className="source-link"
              href={GUIDE}
              target="_blank"
              rel="noreferrer"
            >
              星杯傳說百科 · 新手攻略 <ArrowRight size={15} />
            </a>
            <a
              className="source-link"
              href="https://xingbeichuanshuobaike.webnode.tw/遊戲指南-規則說明書/"
              target="_blank"
              rel="noreferrer"
            >
              星杯傳說百科 · 規則說明書 <ArrowRight size={15} />
            </a>
            <a
              className="source-link"
              href="https://xingbeichuanshuobaike.webnode.tw/無名杯下載/"
              target="_blank"
              rel="noreferrer"
            >
              無名杯下載與既有網頁版 <ArrowRight size={15} />
            </a>
            <p className="field-note">
              本作為非官方同好實作，與原作及上述網站無隸屬關係。11
              張參考牌面及角色圖片來自星杯傳說百科，圖片權利歸原權利人；3D
              場景為本專案建立。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
