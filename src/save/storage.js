// Storage adapters and the save store (S3-3). The core never touches storage: the shell calls the store when the core emits an
// `autosave` event (town entry, floor change, victory) and on page exit. Adapters have the three calls of Web Storage and never
// throw: localStorage in the browser (falling back to memory when it is blocked), a plain map in Node and in tests.
//
// One slot (config.saveKey), up to BACKUPS rotating backups of damaged / replaced saves (config.saveBackupKey, then `.1`, `.2`; the
// newest is under the plain key), options apart (config.optionsKey). The keys hold
// only the save text: no user id, no wall-clock time (NFR-D01-1).
import { config } from "../core/config.js";
import { strings } from "../core/content/strings.js";
import { canonical } from "../core/hash.js";
import { serialize, deserialize, check, checksumOf } from "./format.js";

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

export const BACKUPS = 3;
const backupKeys = () => Array.from({ length: BACKUPS }, (_, i) => (i === 0 ? config.saveBackupKey : `${config.saveBackupKey}.${i}`));

const noticeFor = (state, key) => { if (state?.ui) state.ui.notice = { kind: "save", key, text: strings[key] }; };

/**
 * The save store: save(state), load(), has(), remove(), exportText(), importText(text), options.
 * Every call returns plain data ({ ok, ... }) and never throws. `onNotice(key)` is called with a string-table key
 * (saveFailed, importFailed, saveTooNew, saveCorrupt, ...) when the player should be told something; when a state is passed to save()
 * its `ui.notice` is set too.
 */
export function createSaveStore(adapter = createAdapter(), { onNotice = () => {} } = {}) {
  const store = { adapter, lastSaveTick: null, lastError: null };
  const tell = (state, key) => { noticeFor(state, key); try { onNotice(key); } catch { /* a broken listener must not break saving */ } };

  const put = (key, text) => { try { adapter.setItem(key, text); return { ok: true }; } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

  /** Keep `text` as the newest backup, rotating older ones down (the oldest is dropped). Nothing is dropped unless the move succeeds. */
  const stash = (text) => {
    const keys = backupKeys(), have = keys.map((k) => adapter.getItem(k));
    if (have[0] === text) return { ok: true }; // already kept
    for (let i = BACKUPS - 1; i >= 1; i--) if (have[i - 1] !== null) { const r = put(keys[i], have[i - 1]); if (!r.ok) return r; }
    return put(keys[0], text);
  };
  const versionOf = (text) => { try { const v = JSON.parse(text)?.version; return Number.isInteger(v) ? v : 0; } catch { return 0; } };

  Object.assign(store, {
    /** Raw save text, or null. */
    read: () => adapter.getItem(config.saveKey),
    has: () => adapter.getItem(config.saveKey) !== null,

    /** Write text to the slot. The previous save stays when the write fails. */
    write(text) {
      if (typeof text !== "string" || text.length > config.saveMaxBytes) return { ok: false, error: "too large" };
      return put(config.saveKey, text);
    },

    /**
     * Save a game now. Writes closer together than config.autosaveMinTicks (by game tick) are skipped unless `force`
     * (page exit) is set, so a burst of triggers cannot hammer storage. A failed write keeps the old save and tells the player.
     */
    save(state, { force = false } = {}) {
      if (!force && store.lastSaveTick !== null && state.tick >= store.lastSaveTick && state.tick - store.lastSaveTick < config.autosaveMinTicks) return { ok: true, skipped: true };
      const old = adapter.getItem(config.saveKey); // a save from a newer build is never overwritten without a copy
      if (old !== null && versionOf(old) > config.saveVersion) {
        const k = stash(old);
        if (!k.ok) { store.lastError = k.error; tell(state, "saveFailed"); return k; }
      }
      let text;
      try { text = serialize(state); } catch (e) { store.lastError = String(e?.message ?? e); tell(state, "saveFailed"); return { ok: false, error: store.lastError }; }
      const r = store.write(text);
      if (!r.ok) { store.lastError = r.error; tell(state, "saveFailed"); return r; }
      store.lastSaveTick = state.tick; store.lastError = null;
      return { ok: true, bytes: text.length };
    },

    /** Save in answer to a core `autosave` event ({ type: "autosave", reason }). Victory and floor changes always write. */
    autosave: (state, event = {}) => store.save(state, { force: event.reason === "victory" }),

    /**
     * Load the slot. On a damaged save the text is kept once under the backup key, the slot is cleared (so "Continue" disappears)
     * and { ok: false, reason: "corrupt" } is returned; a save from a newer version is left untouched (reason "newer").
     */
    load() {
      const text = store.read();
      if (text === null) return { ok: false, reason: "empty" };
      const r = deserialize(text);
      if (r.ok) return r;
      if (r.reason === "newer") { try { onNotice("saveTooNew"); } catch { /* ignore */ } return r; }
      const k = stash(text); // clear the slot only when the copy is safe; otherwise the damaged text stays where it is
      if (k.ok) adapter.removeItem(config.saveKey);
      try { onNotice("saveCorrupt"); } catch { /* ignore */ }
      return { ...r, reason: r.reason, corrupt: true };
    },

    /** Delete the character (options stay, QF-09-4). */
    remove() { adapter.removeItem(config.saveKey); store.lastSaveTick = null; },

    /** The text to download: the current save ("current") or the kept damaged one ("corrupt"). Null when there is none. */
    exportText: (which = "current") => adapter.getItem(which === "corrupt" ? config.saveBackupKey : config.saveKey),
    exportName: () => config.saveFileName,

    /** Would this text import? (No write, no notice.) */
    canImport: (text) => { try { return typeof text === "string" && text.length <= config.saveMaxBytes && check(JSON.parse(text)).ok; } catch { return false; } },

    /** Import a save file: it must pass every check before it replaces the slot. The old save is untouched on failure. */
    importText(text) {
      const r = typeof text === "string" && text.length <= config.saveMaxBytes ? (() => { try { return check(JSON.parse(text)); } catch { return { ok: false, reason: "parse" }; } })() : { ok: false, reason: "parse" };
      if (!r.ok) { try { onNotice(r.reason === "newer" ? "saveTooNew" : "importFailed"); } catch { /* ignore */ } return { ok: false, reason: r.reason }; }
      const old = adapter.getItem(config.saveKey); // the replaced character is kept as a backup
      if (old !== null) { const k = stash(old); if (!k.ok) { try { onNotice("saveFailed"); } catch { /* ignore */ } return { ok: false, reason: "write", error: k.error }; } }
      const w = store.write(canonical({ ...r.save, checksum: checksumOf(r.save) })); // stored in the current version's canonical form
      if (!w.ok) { try { onNotice("saveFailed"); } catch { /* ignore */ } return { ok: false, reason: "write", error: w.error }; }
      store.lastSaveTick = null;
      try { onNotice("importDone"); } catch { /* ignore */ }
      return { ok: true };
    },

    /** Options live under their own key, apart from the save. */
    loadOptions() { try { const v = JSON.parse(adapter.getItem(config.optionsKey) ?? "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; } },
    saveOptions: (options) => put(config.optionsKey, JSON.stringify(options ?? {})),
  });
  return store;
}
