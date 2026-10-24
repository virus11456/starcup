"use client";
import type { ActionOption, RoomView } from "@/lib/game";

export default function ActionGuide({
  room,
  busy,
  selectedCard,
  choose,
}: {
  room: RoomView;
  busy: boolean;
  selectedCard?: string;
  choose: (action: ActionOption) => void;
}) {
  if (room.status !== "playing") return null;
  const actions = room.actions || [];
  const available = actions.filter((a) => a.enabled);
  const blocked = actions.filter((a) => !a.enabled);
  return (
    <section className="action-guide" aria-label="目前可執行的行動">
      <div className="action-guide-heading">
        <h3>現在可以做的事</h3>
        <span>
          {room.actor === room.me
            ? `${available.length} 個選項`
            : "等待其他玩家"}
        </span>
      </div>
      {room.actor !== room.me ? (
        <p className="action-wait">
          現在由 {room.players.find((p) => p.id === room.actor)?.name}{" "}
          處理行動。你仍可查看手牌與角色技能。
        </p>
      ) : (
        <>
          <div className="action-options">
            {available.map((a) => (
              <button
                type="button"
                key={a.id}
                disabled={busy}
                className={
                  a.cardId && a.cardId === selectedCard ? "active" : ""
                }
                onClick={() => choose(a)}
              >
                <strong>{a.label}</strong>
                <small>
                  {a.cardId
                    ? a.targets.length
                      ? `合法目標：${a.targets.map((id) => room.players.find((p) => p.id === id)?.name).join("、")}`
                      : "選取此牌，再按下方按鈕確認"
                    : a.type === "discard"
                      ? "在手牌區選滿指定張數後確認"
                      : "點擊執行"}
                </small>
              </button>
            ))}
          </div>
          {blocked.length > 0 && (
            <details className="blocked-actions">
              <summary>目前不能做的事（{blocked.length}）</summary>
              {blocked.map((a) => (
                <p key={a.id}>
                  <strong>{a.label}</strong>
                  <span>{a.reason}</span>
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
