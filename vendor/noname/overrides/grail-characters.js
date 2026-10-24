/* GPL-3.0: roster uniqueness, including historical editions and role forms. */
export function characterFamily(id) {
  const base = String(id || "").replace(/^(san|si)_/, "");
  // These are the two interchangeable forms declared by the upstream pack.
  if (base === "hongYiZhuJiao") return "zhuLvZhe";
  if (base === "moGongEX") return "moGong";
  return base;
}

export function availableCharacters(candidates, selected) {
  const occupied = new Set(selected.filter(Boolean).map(characterFamily));
  return candidates.filter(id => !occupied.has(characterFamily(id)));
}

export function uniqueCharacters(selected) {
  const families = selected.filter(Boolean).map(characterFamily);
  return new Set(families).size === families.length;
}
