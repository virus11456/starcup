/* GPL-3.0 integration: visual hooks only; original methods retain rule/video behavior. */
import { lib, game, ui, get } from "./noname.js";
import { createCardMotion, center } from "./card-motion.js";
import { anchorToViewport } from "./grail-viewport.js";
export function startCardMotion() {
  const host = document.createElement("div");
  host.className = "card-motion-layer";
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  const stopViewport = anchorToViewport(host);
  const motion = createCardMotion(host);
  document.body.classList.add("grail-motion-enabled");
  const piles = document.createElement("div");
  piles.className = "grail-motion-piles";
  for (const [kind, title] of [["deck", "✦ 牌庫"], ["discard", "◇ 棄牌"]]) {
    const p = document.createElement("div"); p.dataset.pile = kind; p.textContent = title; piles.append(p);
  }
  (document.getElementById("grail-hud") || document.body).append(piles);
  const proto = lib.element.Player.prototype;
  const originals = { $draw: proto.$draw, $throw: proto.$throw };
  let nesting = 0;
  for (const method of ["$draw", "$throw"]) {
    proto[method] = function (...args) {
      const outer = nesting === 0 && (method !== "$draw" || args[1] !== false);
      const input = args[0];
      const cards = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
      const count = typeof input === "number" ? input : cards.length;
      let type = method === "$draw" ? "draw" : "discard";
      let event = get.event(), target;
      for (let i = 0; event && i < 6; i++, event = event.parent) {
        if (["discard", "chooseToDiscard"].includes(event.name)) break;
        if (["useCard", "respond"].includes(event.name)) { if (type !== "draw") type = "play"; target = event.targets?.[0]; break; }
      }
      if (type === "play" && cards.some(card => ["shengDun", "zhongDu", "xuRuo"].includes(card.name))) type = "place";
      const fallback = { x: innerWidth / 2, y: innerHeight / 2 };
      const from = type === "draw" ? center(piles.querySelector('[data-pile="deck"]'), fallback) : center(cards[0]?.isConnected ? cards[0] : this, fallback);
      const to = type === "draw" ? center(this === game.me ? ui.handcards1?.parentElement : this, center(this, fallback)) : type === "place" ? center(target?.node?.judges, center(target, fallback)) : type === "play" ? center(target, fallback) : center(piles.querySelector('[data-pile="discard"]'), fallback);
      nesting++;
      let result;
      try { result = originals[method].apply(this, args); } finally { nesting--; }
      if (outer && count > 0) for (let i = 0; i < Math.min(count, 12); i++) {
        const card = cards[i];
        const reveal = card?.name && !card.classList?.contains("infohidden") && (this === game.me || type === "play" || type === "place");
        try { motion.play({ type, from, to, image: reveal ? `image/card/${card.name}.png` : undefined, label: reveal ? get.translation(card.name) : undefined, delay: i * 105 }); } catch { /* A visual failure must not interrupt a legal move. */ }
      }
      return result;
    };
  }
  return () => { Object.assign(proto, originals); stopViewport(); motion.dispose(); host.remove(); piles.remove(); document.body.classList.remove("grail-motion-enabled"); };
}
