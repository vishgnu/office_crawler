// Session commands (R4 contract section 2): the shell-level commands that touch storage and start games. They live here as pure functions
// over a slot store and a game factory so the shell (src/game.js) only routes `game.input({t: ...})` to them and keeps `game.slots` in sync
// with `slotsView(store)`. The core never learns about slots. Every command returns { ok, error?, ... } and never throws.
//
// createCharacter {slot, class, name, seed?, confirm?}  -> { ok, state }      (state is the new running game; the slot is active)
// loadSlot {slot}                                       -> { ok, state, notes } (the running game, if any, is saved first)
// continue                                              -> loadSlot of the last used slot
// deleteSlot {slot, confirm}, renameSlot {slot, name}, copySlot {from, to, confirm?}, exportSlot {slot, which?}, importSlot {slot, text, confirm?}
// selectSlot {slot}                                     -> highlight only (no I/O)
// takeOverSaves                                         -> this tab becomes the owner of the saves; dismissSaveNotice -> clears status.notice
import { newGame } from "../core/state.js";
import { classById } from "../core/content/classes.js";
import { validateName } from "../core/name.js";
import { config } from "../core/config.js";

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= config.slotCount;

const isoOf = (ms) => { try { return Number.isFinite(ms) ? new Date(ms).toISOString() : null; } catch { return null; } };

/**
 * What the shell shows as `game.slots`: the index plus the pointers and the last error, `status` ({ storage, owner, notice }, R5 fix contract
 * section 1) and `list`, one summary per slot with `deepest`, `savedAt` (ISO 8601 UTC) and `hasPrev` (an undo copy exists) added.
 */
export function slotsView(store, highlighted = null) {
  const index = store.list(), keys = new Set(store.keys());
  const list = index.slots.map((e) => ({ ...e, deepest: Number.isInteger(e.deepest) ? e.deepest : 0, savedAt: isoOf(e.lastPlayed), hasPrev: store.hasPrev(e.n, keys) }));
  return { index, list, active: index.active, last: index.last, highlighted, usage: store.usage(), lastError: store.lastError, status: store.status() };
}

/** Save the running game into its slot before another game replaces it; a failure aborts the switch and leaves a notice (CR-05). */
function saveBeforeSwitch(store, running) {
  const active = store.activeSlot();
  if (!running || active === null) return null;
  const w = store.write(active, running);
  if (w.ok) return null;
  store.setNotice("pre-switch-save-failed");
  return fail("save-failed-before-switch", { reason: w.error });
}

/**
 * createSession(store, { seedSource }): `seedSource()` supplies a seed when a command has none (the shell injects a clock or crypto based one).
 * Returns the command table; `run(cmd, running)` dispatches a `{t: ...}` object.
 */
export function createSession(store, { seedSource = () => 1 } = {}) {
  const session = { highlighted: null };

  session.createCharacter = ({ slot, class: classId, name, seed, confirm = false } = {}, running = null) => {
    if (!validSlot(slot)) return fail("bad-slot");
    if (!classById(classId)) return fail("bad-class");
    const v = validateName(name);
    if (!v.ok) return fail("bad-name");
    const state = newGame(seed ?? seedSource(), { class: classId, name: v.name, start: "town", wearStartKit: true });
    const e = store.list().slots[slot - 1];
    if (e.state !== "empty" && !confirm) return fail("occupied", { lost: e.name ?? null });
    if (store.activeSlot() !== slot) { const f = saveBeforeSwitch(store, running); if (f) return f; } // leave the old character saved, or stay in it
    const r = store.create(slot, state, { confirm });
    return r.ok ? { ok: true, state, slot } : r;
  };

  session.loadSlot = ({ slot } = {}, running = null) => {
    if (!validSlot(slot)) return fail("bad-slot");
    const e = store.list().slots[slot - 1];
    if (e.state === "empty") return fail("empty-slot");
    const f = saveBeforeSwitch(store, running); // the running game is saved first (also when it is this very slot, so Load never brings back an older copy)
    if (f) return f;
    const r = store.load(slot);
    if (!r.ok) return r;
    const a = store.setActive(slot);
    return a.ok ? { ok: true, state: r.state, notes: r.notes, slot } : a;
  };

  session.continue = (_cmd, running = null) => {
    const n = store.lastUsed();
    return n === null ? fail("empty-slot") : session.loadSlot({ slot: n }, running);
  };
  session.deleteSlot = ({ slot, confirm } = {}) => (confirm === true ? store.remove(slot, { confirm: true }) : validSlot(slot) ? fail("confirm-required", { lost: store.list().slots[slot - 1].name ?? null }) : fail("bad-slot"));
  session.renameSlot = ({ slot, name } = {}) => store.rename(slot, name);
  session.copySlot = ({ from, to, confirm } = {}) => store.copy(from, to, { confirm: confirm === true });
  session.exportSlot = ({ slot, which } = {}) => {
    const r = store.exportText(slot, which === "bad" ? "bad" : "current");
    return r.ok || which === "bad" || !validSlot(slot) ? r : store.exportText(slot, "bad"); // a damaged slot exports its kept text
  };
  session.takeOverSaves = () => store.takeOver();
  session.dismissSaveNotice = () => store.dismissNotice();
  session.importSlot = ({ slot, text, confirm } = {}) => store.importText(slot, text, { confirm: confirm === true });
  session.selectSlot = ({ slot } = {}) => { if (!validSlot(slot)) return fail("bad-slot"); session.highlighted = slot; return { ok: true }; };

  /** Dispatch a `{ t }` command; unknown commands return null so the caller can fall through to the core. */
  session.run = (cmd, running = null) => {
    const fn = { createCharacter: session.createCharacter, loadSlot: session.loadSlot, continue: session.continue, deleteSlot: session.deleteSlot, renameSlot: session.renameSlot,
      copySlot: session.copySlot, exportSlot: session.exportSlot, importSlot: session.importSlot, selectSlot: session.selectSlot,
      takeOverSaves: session.takeOverSaves, dismissSaveNotice: session.dismissSaveNotice }[cmd?.t];
    return fn ? fn(cmd, running) : null;
  };
  return session;
}
