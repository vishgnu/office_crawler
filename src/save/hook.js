// Thin test-hook surfaces for window.__app (ADR-0003 extended, R4 contract section 4). No logic: each function forwards to the slot store, the
// session or the core views, so src/testhook/index.js only has to mount the three objects. `getGame()` returns the running core state.
import { treeView, classCards, learnSkill, respec } from "../core/index.js";
import { slotsView } from "./session.js";

/** __app.slots: list() the index, raw(n) the stored text, keys() the office-crawler.* keys, fail(on) make the adapter reject writes. */
export const slotsHook = (store) => ({
  list: () => store.list(),
  raw: (n) => store.raw(n),
  keys: () => store.keys(),
  fail(on) { store.adapter.failWrites = !!on; return { ok: true }; },
  view: () => slotsView(store),
});

/** __app.character: create({slot, class, name}) through the session (the shell starts the returned game), cards() for the selection screen. */
export const characterHook = (session, { start = () => {} } = {}) => ({
  create(args) { const r = session.createCharacter(args); if (r.ok) start(r.state, r.slot); return r.ok ? { ok: true, slot: r.slot } : r; },
  cards: () => classCards(),
});

/** __app.tree: get() the panel data, learn(id), respec() on the running game. */
export const treeHook = (getGame) => ({
  get: () => treeView(getGame()),
  learn: (id) => learnSkill(getGame(), id),
  respec: () => respec(getGame()),
});
