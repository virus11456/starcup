import reference from "../data/wiki-reference.json" with { type: "json" };
export const WIKI = reference;
export type GuideId = keyof typeof reference.guides;
const ruleGuides: Record<string, GuideId[]> = {
  win: ["manual"], start: ["manual"], turn: ["manual", "timeline"],
  damage: ["beginner"], overflow: ["beginner", "terms"], counter: ["faq", "beginner"],
  dark: ["beginner"], light: ["manual"], shield: ["manual"], poison: ["manual", "faq"],
  weak: ["manual", "beginner"], missile: ["manual"], buy: ["manual", "faq"],
  synthesis: ["manual"], stones: ["manual"], refine: ["manual"], healing: ["beginner", "terms"],
  deck: ["deck", "manual"], "no-action": ["manual", "faq"],
  "effect-order": ["faq", "timeline"], "spell-targets": ["faq"],
  "forced-hit": ["faq"], "extra-actions": ["faq"], "skill-types": ["manual"],
};
export const ruleSources = (id: string) => (ruleGuides[id] || []).map(key => reference.guides[key]);
