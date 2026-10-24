"use client";

import { useState } from "react";
import { CARDS, type CardKind } from "@/lib/game";

/** Original reference faces, kept intact so printed text is never cropped. */
export default function CardArt({
  kind,
  eager = false,
}: {
  kind: CardKind;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="card-art-missing">
        <span>{CARDS[kind].symbol}</span>牌面圖片暫時無法載入
      </span>
    );
  }
  return (
    <img
      className="card-art"
      src={`/cards/${kind}.png`}
      alt={`${CARDS[kind].name}參考牌面`}
      width={355}
      height={491}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
