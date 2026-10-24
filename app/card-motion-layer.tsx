"use client";
import { useEffect, useRef } from "react";
import { CARDS, type RoomView } from "@/lib/game";
import { createCardMotion, center, type Point } from "@/lib/card-motion";
import { MotionCursor } from "@/lib/motion-cursor";

export default function CardMotionLayer({ room }: { room: RoomView | null }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createCardMotion> | null>(null);
  const cursor = useRef(new MotionCursor());
  const previousCards = useRef(new Map<string, Point>());
  useEffect(() => {
    if (!host.current) return;
    engine.current = createCardMotion(host.current);
    return () => { engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => {
    if (!room) { cursor.current = new MotionCursor(); previousCards.current.clear(); return; }
    const middle = { x: innerWidth / 2, y: innerHeight / 2 };
    const seat = (id: string) => center(document.querySelector(`[data-player-id="${CSS.escape(id)}"]`), middle);
    const hand = center(document.querySelector(".hand"), { x: innerWidth / 2, y: innerHeight - 100 });
    const deck = center(document.querySelector('[data-pile="deck"]'), middle);
    const discard = center(document.querySelector('[data-pile="discard"]'), middle);
    for (const event of cursor.current.take(room.code, room.motions)) {
      for (let i = 0; i < event.count; i++) {
        const card = event.cards[i];
        const source = card ? previousCards.current.get(card.id) : undefined;
        const ownHand = card ? document.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`) : null;
        const placing = event.type === "play" && card && ["shield", "poison", "weak"].includes(card.kind);
        const effect = placing ? document.querySelector(`[data-effect-card-id="${CSS.escape(card.id)}"]`) : null;
        engine.current?.play({ type: placing ? "place" : event.type, from: event.type === "draw" ? deck : source || seat(event.player), to: event.type === "draw" ? event.player === room.me ? center(ownHand, hand) : seat(event.player) : event.type === "discard" ? discard : center(effect, seat(event.target || event.player)), image: card ? `/cards/${card.kind}.png` : undefined, label: card ? CARDS[card.kind].name : undefined, color: card ? CARDS[card.kind].color : undefined, delay: i * 110 });
      }
    }
    previousCards.current = new Map(Array.from(document.querySelectorAll<HTMLElement>("[data-card-id]")).map(el => [el.dataset.cardId!, center(el, hand)]));
  }, [room]);
  return <div className="card-motion-layer" ref={host} aria-hidden="true" />;
}
