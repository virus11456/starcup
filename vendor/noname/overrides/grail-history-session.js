/* GPL-3.0: one bounded, per-tab copy of already-public match history. */
const KEY = 'grail-public-history-v1';
const MAX_CHARS = 180_000;
const DAY = 86_400_000;

export function createHistorySession(code, { storage = () => sessionStorage,
  now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!/^[A-Z2-9]{8}$/.test(code || '')) return null;
  let target, available = true, pending, timer;
  const fail = () => { available = false; pending = undefined; };
  try { target = storage(); } catch { fail(); }
  return {
    get available() { return available; },
    load() {
      if (!available) return [];
      let raw;
      try { raw = target.getItem(KEY); } catch { fail(); return []; }
      if (!raw || raw.length > MAX_CHARS) return [];
      try {
        const value = JSON.parse(raw);
        return value?.version === 1 && value.code === code && Number.isFinite(value.at) &&
          value.at <= now() && now() - value.at < DAY && Array.isArray(value.entries) && value.entries.length <= 1000
          ? value.entries : [];
      } catch { return []; }
    },
    save(entries) {
      if (!available) return;
      pending = entries;
      if (timer === undefined) timer = setTimer(() => this.flush(), 500);
    },
    flush() {
      clearTimer(timer); timer = undefined;
      if (!available || !pending) return;
      const entries = pending; pending = undefined;
      try {
        const envelope = { version: 1, code, at: now(), entries: [] };
        let size = JSON.stringify(envelope).length;
        const recent = [];
        // Bound the serialized text, including escaping, rather than trusting
        // a count of entries. Preserve whole recent entries and original IDs.
        for (let i = entries.length - 1; i >= 0 && recent.length < 1000; i--) {
          const entry = entries[i];
          const length = JSON.stringify(entry).length + (recent.length ? 1 : 0);
          if (size + length > MAX_CHARS) break;
          size += length; recent.push(entry);
        }
        envelope.entries = recent.reverse();
        target.setItem(KEY, JSON.stringify(envelope));
      } catch { fail(); }
    },
    stop() { this.flush(); },
  };
}
