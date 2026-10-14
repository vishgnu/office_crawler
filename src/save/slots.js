// The five-slot store (ADR-0006, R-220..R-227, NFR-D05/D06). Pure apart from the storage adapter and the injected clock: the core never
// sees slots, and wall-clock time lives only in the index (`lastPlayed`), never inside a save text.
//
// Keys: office-crawler.slot.N (save text), office-crawler.slots (the index), .slot.N.bad (kept damaged text), .slot.N.prev (one undo copy),
// office-crawler.options (global). Legacy single-slot keys are read only by migrateLegacy().
// Every call returns plain data ({ ok, ... } / { ok: false, error }) and never throws.
import { config } from "../core/config.js";
import { canonical } from "../core/hash.js";
import { validateName } from "../core/name.js";
import { serialize, deserialize, check, checksumOf } from "./format.js";
import { createAdapter } from "./storage.js";

const PREFIX = "office-crawler.";
const slotKey = (n) => `${config.slotKeyPrefix}${n}`;
const badKey = (n) => `${slotKey(n)}.bad`;
const prevKey = (n) => `${slotKey(n)}.prev`;
const LEGACY_BACKUPS = [config.saveBackupKey, `${config.saveBackupKey}.1`, `${config.saveBackupKey}.2`];
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= config.slotCount;
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const NOTICES = ["no-active-slot", "pre-switch-save-failed", "migration-failed", "attributes-refunded"]; // status.notice keys (ui/text.js)
const REASONS = { parse: "parse", checksum: "checksum", schema: "schema", size: "size", format: "schema", "no-migration": "schema" };

/** 32-bit checksum over the slot text (cheap: a 400 KB text hashes in a few ms). Detects that index and slot disagree. */
export function textSum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

export const OWNER_STALE_MS = config.ownerStaleMs;
export const OWNER_BEAT_MS = config.ownerBeatMs;

export const emptyIndex = () => ({ v: 2, active: null, last: null, owner: null, slots: Array.from({ length: config.slotCount }, (_, i) => ({ n: i + 1, state: "empty" })) });

function validIndex(x) {
  if (!x || typeof x !== "object" || x.v !== 2 || !Array.isArray(x.slots) || x.slots.length !== config.slotCount) return false;
  for (let i = 0; i < x.slots.length; i++) { const e = x.slots[i]; if (!e || e.n !== i + 1 || !["empty", "ok", "bad", "newer"].includes(e.state)) return false; }
  for (const k of ["active", "last"]) if (x[k] !== null && !validSlot(x[k])) return false;
  const o = x.owner; // null | { id, beat } | a bare id string (written before the heartbeat existed; read as a stale owner)
  if (o !== null && o !== undefined && typeof o !== "string" && !(typeof o === "object" && typeof o.id === "string" && Number.isFinite(o.beat))) return false;
  return true;
}

/** The index entry for a running state (metadata only; lastPlayed comes from the injected clock). */
function entryFromState(n, state, text, now) {
  return {
    n, state: "ok", name: state.player.name, class: state.player.class, level: state.player.level,
    depth: state.scene === "floor" ? state.depth : 0, deepest: state.deepestDepth, playSec: Math.floor((state.stats?.playTicks ?? 0) / config.tickHz),
    lastPlayed: now, bytes: text.length, sum: textSum(text), boss: !!state.bossDefeated,
  };
}
/** The index entry for a stored text (parse, migrate, validate). */
function entryFromText(n, text, now, prev) {
  const bytes = text.length, sum = textSum(text);
  if (bytes > config.slotMaxBytes) return { n, state: "bad", reason: "size", lastPlayed: prev?.lastPlayed ?? now, bytes };
  let raw;
  try { raw = JSON.parse(text); } catch { return { n, state: "bad", reason: "parse", lastPlayed: prev?.lastPlayed ?? now, bytes }; }
  const r = check(raw);
  if (!r.ok) return r.reason === "newer" ? { n, state: "newer" } : { n, state: "bad", reason: REASONS[r.reason] ?? "schema", lastPlayed: prev?.lastPlayed ?? now, bytes };
  const s = r.save;
  return { n, state: "ok", name: s.name, class: s.class, level: s.player.level, depth: s.resume.depth, deepest: s.deepestDepth, playSec: Math.floor((s.stats.playTicks ?? 0) / config.tickHz), lastPlayed: prev?.state === "ok" ? prev.lastPlayed : now, bytes, sum, boss: s.bossDefeated };
}

const safeName = (name) => (String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "character");

/**
 * createSlotStore(adapter, { now, tabId, onNotice }).
 * `now()` is the shell's clock (epoch ms); `tabId` (a fresh id per page load) makes writes refuse while another live tab owns the index.
 * The owner is `{ id, beat }`: the playing tab refreshes `beat` on every write and from a timer (`heartbeat()`); an owner whose beat is
 * older than OWNER_STALE_MS is stale and a tab that started after that beat takes over by itself, any other tab with `takeOver()`.
 * `onNotice(key)` gets string-table keys (slotSaved, slotDeleted, slotImported, slotMigrated, slotCorrupt, saveTooNewSlot, saveFailed,
 * storageFull, anotherTab). `status()` is the persistent state the UI shows: { storage, owner, notice, noticeAttr }.
 */
export function createSlotStore(adapter = createAdapter(), { now = () => Date.now(), tabId = null, onNotice = () => {} } = {}) {
  const store = { adapter, lastError: null, lastSaveTick: null };
  const startedAt = now();
  let notice = null, noticeAttr = null, full = false;
  const setNotice = (key, attr = null) => { if (NOTICES.includes(key)) { notice = key; noticeAttr = key === "attributes-refunded" ? attr : null; } }; // noticeAttr: the power attribute a refund notice names
  const clearNotice = (...keys) => { if (notice !== null && keys.includes(notice)) { notice = null; noticeAttr = null; } };
  const refundNote = (notes) => { const n = (notes ?? []).find((x) => x.from === 2); if (n) setNotice("attributes-refunded", n.attr ?? null); };
  const tell = (key, extra) => { try { onNotice(key, extra); } catch { /* a broken listener must not break saving */ } };
  const get = (k) => adapter.getItem(k);
  // Running total of the characters held by the own keys (CR-13): one full scan the first time, then every put and del adjusts it, so a write
  // never reads all keys. Another writer is noticed when the number of own keys differs from the tracked one (one cheap key listing, no
  // getItem); `usage({ exact: true })` and a failed write rescan.
  let total = null, tracked = 0;
  const countKeys = () => adapter.keys?.().reduce((n, k) => n + (k.startsWith(PREFIX) ? 1 : 0), 0) ?? 0;
  const scan = () => { total = 0; tracked = 0; for (const k of adapter.keys?.() ?? []) if (k.startsWith(PREFIX)) { total += k.length + (adapter.getItem(k)?.length ?? 0); tracked++; } return total; };
  const used = () => (total === null || countKeys() !== tracked ? scan() : total);
  const put = (k, v) => {
    const own = k.startsWith(PREFIX), old = own && total !== null ? get(k) : null;
    try { adapter.setItem(k, v); } catch (e) { total = null; return { ok: false, error: String(e?.message ?? e) }; }
    if (own && total !== null) { total += k.length + v.length - (old === null ? 0 : k.length + old.length); if (old === null) tracked++; }
    return { ok: true };
  };
  const del = (k) => {
    if (k.startsWith(PREFIX) && total !== null) { const old = get(k); if (old !== null) { total -= k.length + old.length; tracked--; } }
    adapter.removeItem(k);
  };

  // ---- space and quota (ADR-0006 section 7) ----------------------------------------------------------------------------------
  const ownKeys = () => adapter.keys?.().filter((k) => k.startsWith(PREFIX)) ?? [];
  const usageChars = () => used();
  /** Free space in the fixed order, one step per call; returns false when nothing is left to give up. */
  function recoverStep(idx, stage) {
    if (stage === 0) { let any = false; for (const k of LEGACY_BACKUPS) if (get(k) !== null) { del(k); any = true; } return any; }
    if (stage === 1) { let any = false; for (let n = 1; n <= config.slotCount; n++) if (idx.slots[n - 1].state !== "bad" && get(badKey(n)) !== null) { del(badKey(n)); any = true; } return any; }
    if (stage === 2) { let any = false; for (let n = 1; n <= config.slotCount; n++) if (idx.active !== n && get(prevKey(n)) !== null) { del(prevKey(n)); any = true; } return any; }
    if (stage === 3) { if (get(config.saveKey) !== null && idx.slots[0].state === "ok") { del(config.saveKey); return true; } return false; }
    return false;
  }
  /** setItem with the recovery ladder: soft ceiling first, then the real error. */
  function putRoom(key, text, idx) {
    const grow = () => used() - (get(key)?.length ?? 0) + key.length + text.length > config.storageSoftCeiling;
    let stage = 0, r = { ok: false };
    for (;;) {
      if (!grow()) { r = put(key, text); if (r.ok) { full = false; return r; } }
      if (stage > 3) { full = true; return { ok: false, error: r.error ?? "quota", quota: true }; }
      recoverStep(idx, stage++);
    }
  }

  // ---- the index -------------------------------------------------------------------------------------------------------------
  function readIndex() {
    const t = get(config.slotIndexKey);
    if (t === null) return null;
    try {
      const x = JSON.parse(t);
      if (!validIndex(x)) return null;
      x.owner = typeof x.owner === "string" ? { id: x.owner, beat: 0 } : x.owner ?? null;
      return x;
    } catch { return null; }
  }
  /** Rebuild the index by scanning the five slot keys (repair rule a). */
  function rebuild(prev) {
    const idx = emptyIndex();
    for (let n = 1; n <= config.slotCount; n++) {
      const t = get(slotKey(n));
      if (t !== null) idx.slots[n - 1] = entryFromText(n, t, now(), prev?.slots?.[n - 1]);
      else if (get(badKey(n)) !== null) idx.slots[n - 1] = { n, state: "bad", reason: prev?.slots?.[n - 1]?.reason ?? "schema", bytes: get(badKey(n)).length };
    }
    idx.active = prev?.active && idx.slots[prev.active - 1].state !== "empty" ? prev.active : null;
    idx.last = prev?.last && idx.slots[prev.last - 1].state !== "empty" ? prev.last : null;
    idx.owner = prev?.owner ?? null;
    if (prev?.pendingMigration) idx.pendingMigration = true;
    return idx;
  }
  const writeIndex = (idx) => { const r = put(config.slotIndexKey, JSON.stringify(idx)); if (!r.ok) store.lastError = r.error; return r; };
  /** The current index; rebuilt and stored when missing or damaged. Never null. */
  function index() {
    let idx = readIndex();
    if (!idx) { idx = rebuild(null); writeIndex(idx); }
    return idx;
  }
  const mostRecent = (idx) => idx.slots.filter((e) => e.state === "ok").sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || a.n - b.n)[0]?.n ?? null;
  /** "none" | "self" | "other" (a live owner) | "stale" (its heartbeat is older than OWNER_STALE_MS). */
  function ownerState(idx) {
    const o = idx.owner;
    if (!tabId || !o) return "none";
    if (o.id === tabId) return "self";
    return Math.abs(now() - o.beat) > OWNER_STALE_MS ? "stale" : "other"; // a beat from the future (clock set back, tampered index) is stale too
  }
  /** May this tab write? Yes when nobody or itself owns the index, or when the owner went stale before this tab started. */
  const ownerOk = (idx) => { const s = ownerState(idx); return s === "none" || s === "self" || (s === "stale" && (startedAt > idx.owner.beat || idx.owner.beat > now())); };
  const claim = (idx) => { if (tabId) idx.owner = { id: tabId, beat: now() }; };
  const refuseOwner = () => { tell("anotherTab"); return fail("another-tab"); };

  Object.assign(store, {
    /** The index (always five entries). One getItem and one small parse; no slot text is read. */
    list: () => index(),
    /** The persistent state the UI shows: where saves go, who owns them, and the notice to show until dismissed. */
    status: () => ({ storage: adapter.fallback ? "memory" : full ? "full" : "ok", owner: ownerState(index()), notice, noticeAttr }),
    setNotice, dismissNotice() { notice = null; noticeAttr = null; return { ok: true }; },
    /** Refresh this tab's owner beat (called from a timer while a game runs). Never creates an owner. */
    heartbeat() {
      const idx = readIndex();
      if (!idx || !tabId) return { ok: true, skipped: true };
      if (idx.owner?.id !== tabId) return idx.owner && ownerState(idx) === "other" ? fail("another-tab") : { ok: true, skipped: true };
      claim(idx);
      return writeIndex(idx).ok ? { ok: true } : fail("write-failed");
    },
    /** This tab becomes the owner (the player confirmed "play here"). */
    takeOver() { if (!tabId) return { ok: true }; const idx = index(); claim(idx); const w = writeIndex(idx); if (w.ok) clearNotice("no-active-slot"); return w.ok ? { ok: true } : fail("write-failed"); },
    hasPrev: (n, keys = null) => validSlot(n) && (keys ? keys.has(prevKey(n)) : adapter.keys ? adapter.keys().includes(prevKey(n)) : get(prevKey(n)) !== null),
    /** Raw stored text of a slot, or null. */
    raw: (n) => (validSlot(n) ? get(slotKey(n)) : null),
    keys: () => ownKeys(),
    /** Slot the running game writes to, and the one Continue opens. */
    activeSlot: () => index().active,
    lastUsed() { const idx = index(); return idx.last && idx.slots[idx.last - 1].state === "ok" ? idx.last : mostRecent(idx); },

    /** Make `n` the active (and last used) slot and take ownership for this tab. */
    setActive(n) {
      if (!validSlot(n)) return fail("bad-slot");
      const idx = index();
      if (idx.slots[n - 1].state !== "ok") return fail("empty-slot");
      if (!ownerOk(idx)) return refuseOwner();
      idx.active = n; idx.last = n; claim(idx);
      store.lastSaveTick = null;
      writeIndex(idx);
      return { ok: true };
    },
    clearActive() { const idx = index(); if (idx.active !== null && ownerOk(idx)) { idx.active = null; if (tabId && idx.owner?.id === tabId) idx.owner = null; writeIndex(idx); } return { ok: true }; },

    /**
     * Write the running game into slot `n` (ADR-0006 section 6: size check, optional undo copy, slot text, then the index).
     * opts: { keepPrev (copy the old text to .prev first: overwrite and import), setActive }. A failed write changes nothing else.
     */
    write(n, state, opts = {}) {
      if (!validSlot(n)) return fail("bad-slot");
      const idx = index();
      if (!ownerOk(idx)) return refuseOwner();
      if (idx.slots[n - 1].state === "newer") { tell("saveTooNewSlot"); return fail("newer"); } // written by a newer build: never overwritten
      let text;
      try { text = serialize(state); } catch (e) { store.lastError = String(e?.message ?? e); tell("saveFailed"); return fail("save-failed"); }
      if (text.length > config.slotMaxBytes) { store.lastError = "too-large"; tell("saveFailed"); return fail("too-large"); }
      const old = get(slotKey(n));
      if (opts.keepPrev && old !== null) { const k = putRoom(prevKey(n), old, idx); if (!k.ok) { store.lastError = k.error; tell(k.quota ? "storageFull" : "saveFailed"); return fail(k.quota ? "quota" : "write-failed"); } }
      const w = putRoom(slotKey(n), text, idx);
      if (!w.ok) { store.lastError = w.error; tell(w.quota ? "storageFull" : "saveFailed"); return fail(w.quota ? "quota" : "write-failed"); }
      idx.slots[n - 1] = entryFromState(n, state, text, now());
      if (opts.setActive) { idx.active = n; idx.last = n; claim(idx); }
      else if (idx.active === n) { idx.last = n; if (ownerState(idx) !== "other") claim(idx); } // every write of the playing tab is a heartbeat
      const wi = writeIndex(idx); // a failure here is repaired on the next read (bytes/sum differ)
      store.lastError = null; full = false;
      clearNotice("no-active-slot", "pre-switch-save-failed");
      return { ok: true, bytes: text.length, sum: idx.slots[n - 1].sum, indexed: wi.ok };
    },

    /** Autosave: the active slot only, writes closer together than config.autosaveMinTicks (game ticks) are coalesced unless `force`. */
    autosave(state, event = {}, { force = false } = {}) {
      const idx = index(), n = idx.active;
      if (n === null) { if (notice !== "no-active-slot") { setNotice("no-active-slot"); tell("saveFailed"); } return fail("no-active-slot"); } // nothing is being saved: say so once, then keep the banner
      force = force || event.reason === "victory";
      if (!force && store.lastSaveTick !== null && state.tick >= store.lastSaveTick && state.tick - store.lastSaveTick < config.autosaveMinTicks) return { ok: true, skipped: true };
      const r = store.write(n, state);
      if (r.ok) store.lastSaveTick = state.tick;
      return r;
    },

    /** Create a character in `n`. An occupied slot needs `confirm` and keeps one undo copy. A slot from a newer build is never overwritten. */
    create(n, state, { confirm = false } = {}) {
      if (!validSlot(n)) return fail("bad-slot");
      const e = index().slots[n - 1];
      if (e.state === "newer") return fail("newer");
      if (e.state !== "empty" && !confirm) return fail("occupied", { lost: e.name ?? null });
      if (e.state === "bad" && get(badKey(n)) === null) { // a damaged text still under the slot key: keep it exportable before it is overwritten (CR-09)
        const t = get(slotKey(n));
        if (t !== null && !putRoom(badKey(n), t, index()).ok) return fail("quota");
      }
      const r = store.write(n, state, { keepPrev: e.state === "ok", setActive: true });
      if (r.ok) store.lastSaveTick = state.tick; // an old `.bad` text stays: Export damaged still works, and space recovery drops it first when needed
      return r;
    },

    /**
     * Load a character: { ok: true, state, notes } or a failure. A damaged slot becomes `bad` (text kept for export, key cleared) and
     * the other slots are unaffected (R-227); a slot from a newer build is left alone.
     */
    load(n) {
      if (!validSlot(n)) return fail("bad-slot");
      const idx = index(), e = idx.slots[n - 1], text = get(slotKey(n));
      if (text === null) {
        if (e.state === "bad") return fail("corrupt", { reason: e.reason });
        if (e.state === "empty") return fail("empty-slot");
        idx.slots[n - 1] = { n, state: "empty" }; writeIndex(idx); // the index was stale: the slot text is gone
        return fail("empty-slot");
      }
      if (e.state === "ok" && (e.bytes !== text.length || e.sum !== textSum(text))) { idx.slots[n - 1] = entryFromText(n, text, now(), e); writeIndex(idx); } // repair rule b
      const r = deserialize(text);
      if (r.ok) { refundNote(r.notes); return { ok: true, state: r.state, notes: r.notes ?? [], slot: n }; }
      if (r.reason === "newer") { idx.slots[n - 1] = { n, state: "newer" }; writeIndex(idx); tell("saveTooNewSlot"); return fail("newer"); }
      // damaged: keep the text for export, clear the slot, mark it bad
      const kept = putRoom(badKey(n), text, idx);
      if (kept.ok) del(slotKey(n));
      idx.slots[n - 1] = { n, state: "bad", reason: REASONS[r.reason] ?? "schema", lastPlayed: e.lastPlayed, bytes: text.length };
      if (idx.active === n) idx.active = null;
      if (idx.last === n) idx.last = mostRecent(idx);
      writeIndex(idx);
      tell("slotCorrupt");
      return fail("corrupt", { reason: idx.slots[n - 1].reason });
    },

    /** Delete a character (confirm required; options and other slots stay). The undo copy stays unless `forever`. */
    remove(n, { confirm = false, forever = false } = {}) {
      if (!validSlot(n)) return fail("bad-slot");
      const idx = index(), e = idx.slots[n - 1];
      if (e.state === "empty") return fail("empty-slot");
      if (!confirm) return fail("confirm-required", { lost: e.name ?? null });
      if (!ownerOk(idx)) return refuseOwner();
      const old = get(slotKey(n));
      if (forever) del(prevKey(n));
      else if (old !== null) putRoom(prevKey(n), old, idx);
      del(slotKey(n)); del(badKey(n));
      idx.slots[n - 1] = { n, state: "empty" };
      if (idx.active === n) { idx.active = null; if (tabId && idx.owner?.id === tabId) idx.owner = null; }
      if (idx.last === n) idx.last = mostRecent(idx);
      writeIndex(idx);
      store.lastSaveTick = null;
      tell("slotDeleted");
      return { ok: true };
    },

    /** Undo the last overwrite or delete of a slot (the single .prev copy). */
    restorePrev(n, { confirm = false } = {}) {
      if (!validSlot(n)) return fail("bad-slot");
      const idx = index(), prev = get(prevKey(n));
      if (prev === null) return fail("empty-slot");
      if (idx.slots[n - 1].state === "newer") return fail("newer"); // a save from a newer build is never overwritten (ADV-R5-03)
      const e = idx.slots[n - 1];
      if (e.state !== "empty" && !confirm) return fail("occupied", { lost: e.name ?? null });
      if (!ownerOk(idx)) return refuseOwner();
      const cur = e.state === "empty" ? null : get(slotKey(n)); // undo of a replace: the replaced text swaps places with the undo copy
      const w = putRoom(slotKey(n), prev, idx);
      if (!w.ok) return fail("quota");
      if (cur !== null) {
        const k = putRoom(prevKey(n), cur, idx);
        if (!k.ok) { put(slotKey(n), cur); return fail("quota"); }
      }
      idx.slots[n - 1] = entryFromText(n, prev, now(), idx.slots[n - 1]);
      writeIndex(idx);
      return { ok: true };
    },

    /** Rename the stored character (name, nothing else; level, items and skills are untouched). */
    rename(n, name) {
      if (!validSlot(n)) return fail("bad-slot");
      const v = validateName(name);
      if (!v.ok) return fail("bad-name");
      const idx = index(), text = get(slotKey(n));
      if (text === null || idx.slots[n - 1].state !== "ok") return fail("empty-slot");
      if (!ownerOk(idx)) return refuseOwner(); // another live tab owns the saves: its next autosave would undo the rename (ADV-R5-09)
      let r;
      try { r = check(JSON.parse(text)); } catch { r = { ok: false }; }
      if (!r.ok) return fail("corrupt");
      const save = { ...r.save, name: v.name }, out = canonical({ ...save, checksum: checksumOf(save) });
      const w = putRoom(slotKey(n), out, idx);
      if (!w.ok) return fail(w.quota ? "quota" : "write-failed");
      idx.slots[n - 1] = { ...idx.slots[n - 1], name: v.name, bytes: out.length, sum: textSum(out) };
      writeIndex(idx);
      return { ok: true, name: v.name };
    },

    /** Copy a character to another slot (could, R-221). */
    copy(from, to, { confirm = false } = {}) {
      if (!validSlot(from) || !validSlot(to) || from === to) return fail("bad-slot");
      const text = get(slotKey(from));
      if (text === null || index().slots[from - 1].state !== "ok") return fail("empty-slot");
      return store.importText(to, text, { confirm });
    },

    /** The text to download: the slot ("current") or its kept damaged text ("bad"). */
    exportText(n, which = "current") {
      if (!validSlot(n)) return fail("bad-slot");
      const text = get(which === "bad" ? badKey(n) : slotKey(n));
      if (text === null) return fail("empty-slot");
      const e = index().slots[n - 1], filename = `office-crawler-slot-${n}-${safeName(which === "bad" ? "damaged" : e.name)}.json`;
      return { ok: true, text, filename, fileName: filename };
    },

    /**
     * Import a character file into slot `n` (full validation incl. the v1 to v2 migration). An occupied slot needs `confirm` (the old text
     * becomes the undo copy). Nothing changes on any failure. The imported character is not made active.
     */
    importText(n, text, { confirm = false } = {}) {
      if (!validSlot(n)) return fail("bad-slot");
      if (typeof text !== "string" || text.length > config.saveMaxBytes) return fail("too-large");
      let r;
      try { r = check(JSON.parse(text)); } catch { return fail("corrupt"); }
      if (!r.ok) return fail(r.reason === "newer" ? "newer" : "corrupt");
      const idx = index(), e = idx.slots[n - 1];
      if (e.state === "newer") return fail("newer");
      if (e.state !== "empty" && !confirm) return fail("occupied", { lost: e.name ?? null });
      const out = canonical({ ...r.save, checksum: checksumOf(r.save) });
      if (out.length > config.slotMaxBytes) return fail("too-large");
      if (!ownerOk(idx)) return refuseOwner();
      const old = get(slotKey(n));
      if (old !== null && e.state === "ok") { const k = putRoom(prevKey(n), old, idx); if (!k.ok) return fail("quota"); }
      const w = putRoom(slotKey(n), out, idx);
      if (!w.ok) { tell(w.quota ? "storageFull" : "saveFailed"); return fail(w.quota ? "quota" : "write-failed"); }
      if (e.state === "bad" && get(badKey(n)) === null && old !== null) putRoom(badKey(n), old, idx); // keep the damaged text exportable (CR-09)
      idx.slots[n - 1] = entryFromText(n, out, now(), null);
      writeIndex(idx);
      tell("slotImported");
      refundNote(r.notes);
      return { ok: true, notes: r.notes ?? [] };
    },

    /**
     * Boot-time migration of the single-slot save into slot 1 (ADR-0006 section 5). Runs when the index key is absent or flagged
     * `pendingMigration` (a write failed last boot). A missing index is first rebuilt from the slot keys, so existing characters stay visible, and
     * slot 1 is only filled when it is empty: a played character is never replaced by the legacy backup. The legacy keys stay in place. If the
     * slot write fails, the index is stored with the flag (slots 2 to 5 stay visible), `status.notice` says "migration-failed", and the next
     * boot tries again.
     */
    migrateLegacy() {
      const stored = readIndex();
      if (get(config.slotIndexKey) !== null && !stored?.pendingMigration) return { ok: true, skipped: true };
      const idx = stored ?? rebuild(null), legacy = get(config.saveKey);
      delete idx.pendingMigration;
      let migrated = null, failed = false;
      if (legacy !== null && idx.slots[0].state === "empty") {
        let r;
        try { r = legacy.length > config.saveMaxBytes ? { ok: false, reason: "size" } : check(JSON.parse(legacy)); } catch { r = { ok: false, reason: "parse" }; }
        if (r.ok) {
          const out = canonical({ ...r.save, checksum: checksumOf(r.save) });
          const w = putRoom(slotKey(1), out, idx);
          if (!w.ok) { store.lastError = w.error; failed = true; }
          else {
            idx.slots[0] = entryFromText(1, out, now(), null); idx.last = idx.last ?? 1;
            const n = (r.notes ?? []).find((x) => x.from === 1);
            if (n) { migrated = { from: 1, refundedPoints: n.refundedPoints }; tell("slotMigrated", migrated); }
            refundNote(r.notes);
          }
        } else if (r.reason === "newer") { idx.slots[0] = { n: 1, state: "newer" }; tell("saveTooNewSlot"); }
        else {
          putRoom(badKey(1), legacy, idx);
          idx.slots[0] = { n: 1, state: "bad", reason: REASONS[r.reason] ?? "schema", lastPlayed: now(), bytes: legacy.length };
          tell("slotCorrupt");
        }
      }
      if (failed) { idx.pendingMigration = true; setNotice("migration-failed"); tell("saveFailed"); }
      const wi = writeIndex(idx);

      return { ok: wi.ok && !failed, migrated, index: idx, ...(failed ? { error: "migration-failed" } : {}) };
    },

    /** Characters used by the own keys against the soft ceiling. */
    usage: ({ exact = false } = {}) => { if (exact) total = null; return { chars: used(), keys: ownKeys().length, ceiling: config.storageSoftCeiling }; },

    /** Options live apart from every slot and are never touched by slot operations. */
    loadOptions() { try { const v = JSON.parse(get(config.optionsKey) ?? "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; } },
    saveOptions: (options) => put(config.optionsKey, JSON.stringify(options ?? {})),
  });
  return store;
}
