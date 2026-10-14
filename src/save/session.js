// Session commands (R4 contract section 2): the shell-level commands that touch storage and start games. They live here as pure functions
// over a slot store and a game factory so the shell (src/game.js) only routes `game.input({t: ...})` to them and keeps `game.slots` in sync
// with `slotsView(store)`. The core never learns about slots. Every command returns { ok, error?, ... } and never throws.
//
// createCharacter {slot, class, name, seed?, confirm?}  -> { ok, state }      (state is the new running game; the slot is active)
// loadSlot {slot}                                       -> { ok, state, notes } (the running game, if any, is saved first)
// continue                                              -> loadSlot of the last used slot
// deleteSlot {slot, confirm}, renameSlot {slot, name}, copySlot {from, to, confirm?}, exportSlot {slot, which?}, importSlot {slot, text, confirm?}
// selectSlot {slot}                                     -> highlight only (no I/O)
import { newGame } from "../core/state.js";
import { classById } from "../core/content/classes.js";
import { validateName } from "../core/name.js";
import { config } from "../core/config.js";

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= config.slotCount;

/** What the shell shows as `game.slots`: the index plus the pointers and the last error. */
export function slotsView(store, highlighted = null) {
  const index = store.list();
  return { index, active: index.active, last: index.last, highlighted, usage: store.usage(), lastError: store.lastError };
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
    if (running && store.activeSlot() && store.activeSlot() !== slot) store.write(store.activeSlot(), running); // leave the old character saved
    const r = store.create(slot, state, { confirm });
    return r.ok ? { ok: true, state, slot } : r;
  };

  session.loadSlot = ({ slot } = {}, running = null) => {
    if (!validSlot(slot)) return fail("bad-slot");
    const e = store.list().slots[slot - 1];
    if (e.state === "empty") return fail("empty-slot");
    if (running && store.activeSlot() && store.activeSlot() !== slot) store.write(store.activeSlot(), running); // the running game is saved first
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
  session.exportSlot = ({ slot, which } = {}) => store.exportText(slot, which === "bad" ? "bad" : "current");
  session.importSlot = ({ slot, text, confirm } = {}) => store.importText(slot, text, { confirm: confirm === true });
  session.selectSlot = ({ slot } = {}) => { if (!validSlot(slot)) return fail("bad-slot"); session.highlighted = slot; return { ok: true }; };

  /** Dispatch a `{ t }` command; unknown commands return null so the caller can fall through to the core. */
  session.run = (cmd, running = null) => {
    const fn = { createCharacter: session.createCharacter, loadSlot: session.loadSlot, continue: session.continue, deleteSlot: session.deleteSlot, renameSlot: session.renameSlot,
      copySlot: session.copySlot, exportSlot: session.exportSlot, importSlot: session.importSlot, selectSlot: session.selectSlot }[cmd?.t];
    return fn ? fn(cmd, running) : null;
  };
  return session;
}
