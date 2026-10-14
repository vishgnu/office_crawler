// Storage adapters. The core never touches storage: the shell calls the slot store (slots.js) when the core emits an `autosave` event (town
// entry, floor change, victory) and on page exit. Adapters have the calls of Web Storage and never throw: localStorage in the browser
// (falling back to memory, flagged `fallback`, when it is blocked), a plain map in Node and in tests. The keys hold only save text: no user
// id, no wall-clock time inside a save (NFR-D01-1).
/** In-memory adapter (Node, tests, and the browser when localStorage is unavailable). `failWrites` simulates quota errors. */
export function createMemoryAdapter(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    kind: "memory", failWrites: false, failKeys: null, // failKeys: (key) => boolean, a write to such a key throws (a bad slot, R-227)
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) { if (this.failWrites || this.failKeys?.(k)) throw new Error("QuotaExceededError"); map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    keys: () => [...map.keys()],
  };
}

/** Wrap a Web Storage object. Returns null when it is missing or does not work (private mode, blocked site data). */
export function createWebStorageAdapter(storage) {
  try {
    if (!storage) return null;
    const probe = "office-crawler.probe";
    storage.setItem(probe, "1"); storage.removeItem(probe);
  } catch { return null; }
  return {
    kind: "localStorage", failWrites: false, // failWrites: the test hook makes writes reject (R-227 e2e)
    getItem: (k) => { try { return storage.getItem(k); } catch { return null; } },
    setItem(k, v) { if (this.failWrites) throw new Error("QuotaExceededError"); storage.setItem(k, v); }, // may throw (quota): the stores catch it
    removeItem: (k) => { try { storage.removeItem(k); } catch { /* nothing to do */ } },
    keys: () => { try { return Object.keys(storage); } catch { return []; } },
  };
}

/** The best adapter for the environment: localStorage when it works, else memory (flagged `fallback`). */
export function createAdapter(scope = globalThis) {
  let ls = null;
  try { ls = scope.localStorage; } catch { ls = null; }
  return createWebStorageAdapter(ls) ?? Object.assign(createMemoryAdapter(), { fallback: true });
}
