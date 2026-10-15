// R11 fix round (UI): behaviour tests (L-056). createGame runs in node with a recording canvas context and no DOM, so the shell's real event path is driven here:
// R11-02 / R11-03 (the toast lane on an urgent line), R11-04 / R11-06 (death with a held item: bag room and bag full), R11-05 (the points nudge rule).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";
import { createBus } from "../src/bus.js";
import { getStyle, defaultStyleId } from "../src/render/style.js";
import { createToastQueue } from "../src/ui/toastqueue.js";
import { hurtPlayer } from "../src/core/systems/damage.js";
import { autoplace } from "../src/core/items/inventory.js";
import { T } from "../src/ui/text.js";

const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({})), set: (t, k, v) => { t[k] = v; return true; } });
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
/** A running shell on a fresh game (floor 1 unless `start` says otherwise); `shown` records every toast that went on screen, in order. */
function shell({ story = true, start = "floor", seed = 3 } = {}) {
  const game = createGame({ canvas, atlas: null, style: getStyle(defaultStyleId), bus: createBus(), testMode: true, seed, story });
  game.newGame(seed, { start });
  game.dismissStory();
  const shown = []; let lastId = 0;
  game.onChange(() => { const t = game.ui.toast; if (t && t.id !== lastId) { lastId = t.id; shown.push(t.text); } });
  return { game, shown, hint: () => shown.filter((x) => x === T.pointsHint).length + game.toastWaiting().filter((x) => x === T.pointsHint).length };
}
const copies = (c, id) => [...c.inventory.items, ...c.groundItems.map((e) => e.item).filter(Boolean), c.cursorItem, ...Object.values(c.equipment), ...c.belt].filter((i) => i && i.id === id).length;

// ---- toast queue (pure, fake clock)
function lane() {
  let t = 1000; const timers = [], shown = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: () => t, setT: (fn, ms) => { timers.push({ at: t + ms, fn }); return timers.length; }, clearT: (id) => { if (id && timers[id - 1]) timers[id - 1].fn = null; } });
  const advance = (ms) => { t += ms; for (const x of timers) if (x.fn && x.at <= t) { const f = x.fn; x.fn = null; f(); } };
  return { q, shown, advance };
}
const quest = { quest: true, kind: "quest.step", qid: "q1" }, passive = (kind) => ({ passive: true, kind }), urgent = (kind) => ({ urgent: true, kind });

test("R11-02 an urgent line keeps the waiting level-up and skill-learned lines and drops only the stale ones (floor name, potion, healed)", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest A", 4000, quest);
  q.offer("Level 3!", undefined, passive("levelup"));
  q.offer("Learned Fire Drill", undefined, passive("skillLearned"));
  q.offer("Floor 2", undefined, passive("floorEnter"));
  q.offer("Drank coffee", undefined, passive("potion"));
  q.offer("Patched up", undefined, passive("healed"));
  q.offer("Back in the Lobby.", undefined, urgent("respawn"));
  assert.equal(shown.at(-1), "Back in the Lobby.");
  assert.deepEqual(q.waiting(), ["Quest A", "Level 3!", "Learned Fire Drill"], "level-up and skill lines survive, in order, behind the urgent line");
  advance(3200); advance(4000); advance(3200); advance(3200);
  assert.deepEqual(shown.slice(-4), ["Back in the Lobby.", "Quest A", "Level 3!", "Learned Fire Drill"], "and every one of them is shown (so the live region announces it)");
});

test("R11-03 the held quest line on screen goes back into the queue (ahead of other quest lines, behind direct ones) and is shown again after the urgent line", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest A", 4000, quest);
  q.offer("Quest B", 4000, { ...quest, qid: "q2" });
  q.offer("Your bag is full", undefined, {});
  q.offer("Exit door opens", undefined, urgent("portalOpen"));
  assert.equal(shown.at(-1), "Exit door opens");
  assert.deepEqual(q.waiting(), ["Your bag is full", "Quest A", "Quest B"]);
  advance(3200); advance(700); advance(4000); advance(4000);
  assert.deepEqual(shown.slice(1), ["Exit door opens", "Your bag is full", "Quest A", "Quest B"]);
});

test("R11-03 a quest line whose time is over is not put back, and an urgent line over an idle lane puts nothing back", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest A", 4000, quest); advance(4100);
  q.offer("Back in the Lobby.", undefined, urgent("respawn"));
  assert.deepEqual(q.waiting(), []);
  const l2 = lane(); l2.q.offer("Back in the Lobby.", undefined, urgent("respawn")); assert.deepEqual(l2.q.waiting(), []); assert.deepEqual(l2.shown, ["Back in the Lobby."]);
  assert.equal(shown.at(-1), "Back in the Lobby.");
});

// ---- the shell's event path
test("R11-02/03 through the shell: death and Respawn (the real urgent event) show the respawn line first; the level-up and the quest line are shown after it", () => {
  const { game, shown } = shell();
  game.toast("Quest A", 4000, { quest: true, kind: "quest.step", qid: "q1" });
  game.toast("Level 3!", undefined, { passive: true, kind: "levelup" });
  game.toast("Floor 2: Archives", undefined, { passive: true, kind: "floorEnter" });
  hurtPlayer(game.core, "test", 99999); game.step(1);
  assert.equal(game.core.scene, "dead");
  const r = game.input({ t: "respawn" });
  assert.ok(r.ok, JSON.stringify(r));
  assert.match(game.ui.toast.text, /Back in the Lobby/, "the urgent respawn line is on screen");
  const w = game.toastWaiting();
  assert.ok(w.indexOf("Quest A") >= 0 && w.indexOf("Quest A") < w.indexOf("Level 3!"), "the quest line and then the level-up wait: " + JSON.stringify(w));
  assert.ok(!w.includes("Floor 2: Archives"), "the stale floor name is gone");
  assert.ok(game.core.scene === "town", "respawned in the Lobby");
  assert.ok(shown.length > 0 && shown.at(-1) !== "Level 3!");
});

// ---- death with a held item
function holdFromBag(game, slot = "body") {
  const g = game.cheat.giveItem({ slot, rarity: "normal" });
  assert.ok(g.ok, JSON.stringify(g));
  const it = game.core.inventory.items.find((i) => i.id === g.id);
  assert.ok(game.input({ t: "invClick", grid: "inventory", x: it.x, y: it.y }).ok);
  assert.equal(game.core.cursorItem?.id, g.id);
  game.heldOrigin = { kind: "grid", x: it.x, y: it.y };
  return g.id;
}
const openAll = (game) => { game.openPanel("inventory"); game.openPanel("character"); game.openPanel("map"); assert.ok(game.ui.inventory && game.ui.left === "character" && game.ui.map); };

test("R11-04/06 death on a route that does not release the cursor (setHp cheat) with room in the bag: the held item is in the bag exactly once, panels closed, no dim origin", () => {
  const { game } = shell();
  const id = holdFromBag(game); openAll(game);
  game.cheat.setHp(0);
  const c = game.core;
  assert.equal(c.scene, "dead");
  assert.equal(c.cursorItem, null);
  assert.equal(copies(c, id), 1);
  assert.ok(c.inventory.items.some((i) => i.id === id), "back in the bag");
  assert.equal(game.ui.left, null); assert.equal(game.ui.inventory, false); assert.equal(game.ui.map, false); assert.equal(game.ui.tooltip, null);
  assert.equal(game.heldOrigin, null);
});

test("R11-04/06 same with the bag full: the item lies on the floor at the hero, exactly one copy, kept on the floor; panels closed", () => {
  const { game } = shell();
  const id = holdFromBag(game);
  for (let i = 0; i < 80; i++) { const r = game.cheat.giveItem({ potion: true }); if (!r.ok) break; } // small items fill the hole the held item left
  assert.equal(autoplace(structuredClone(game.core.inventory), game.core.cursorItem), false, "precondition: the held item no longer fits");
  openAll(game);
  game.cheat.setHp(0);
  const c = game.core;
  assert.equal(c.scene, "dead");
  assert.equal(c.cursorItem, null);
  assert.equal(copies(c, id), 1);
  const e = c.groundItems.find((g) => g.item?.id === id);
  assert.ok(e, "on the floor");
  assert.ok(Math.max(Math.abs(e.tile.x - c.player.tile.x), Math.abs(e.tile.y - c.player.tile.y)) <= 1, "on or next to the hero's tile"); assert.equal(e.keep, true);
  assert.equal(game.ui.left, null); assert.equal(game.ui.inventory, false); assert.equal(game.ui.map, false);
  assert.equal(game.heldOrigin, null);
});

test("R11-04/06 a real death (hurtPlayer) with a held item: exactly one copy as well, and Respawn afterwards keeps it", () => {
  const { game } = shell();
  const id = holdFromBag(game); openAll(game);
  hurtPlayer(game.core, "test", 99999); game.step(1);
  assert.equal(game.core.scene, "dead"); assert.equal(copies(game.core, id), 1);
  assert.equal(game.ui.inventory, false);
  game.input({ t: "respawn" });
  assert.equal(copies(game.core, id), 1, "still one copy after Respawn");
});

test("R11-04 the dead scene closes an open NPC dialog (core closeDialog called directly; the input path refuses commands once dead)", () => {
  const { game } = shell({ start: "town" });
  const npc = (game.core.floor.npcs ?? []).find((n) => n.kind === "vendor") ?? game.core.floor.npcs?.[0];
  assert.ok(npc, "the Lobby has an NPC");
  game.core.player.tile = { x: npc.tile.x, y: npc.tile.y + 1 };
  game.input({ t: "interact", id: npc.id }); game.step(1);
  assert.ok(game.core.ui.dialog, "precondition: a dialog is open");
  assert.equal(game.ui.left, "npc");
  game.cheat.setHp(0);
  assert.equal(game.core.scene, "dead");
  assert.equal(game.core.ui.dialog, null, "closed on the death screen, not only at Respawn");
  assert.equal(game.ui.left, null);
});

// ---- the points nudge (R11-05): once per run, only in the real game (story on), never twice with the level-up hint, also after an Emergency Exit arrival
test("R11-05 the nudge is shown once per run: the level-up hint and the floor 2 arrival do not both fire, and a later arrival does not repeat it", () => {
  const { game, hint } = shell();
  game.cheat.setLevel(4); assert.ok(game.core.player.attrPoints > 0);
  assert.equal(hint(), 1, "the level-up hint");
  game.cheat.teleportFloor(2); game.cheat.teleportFloor(1); game.cheat.teleportFloor(2);
  assert.equal(hint(), 1, "floor 2 arrivals add nothing");
});

test("R11-05 first arrival on floor 2 with unspent points and no level-up before: one nudge, after the floor name; later arrivals: none", () => {
  const { game, shown, hint } = shell();
  game.core.player.attrPoints = 2; // as after a load or a quest reward: no levelup event
  game.cheat.teleportFloor(2);
  assert.equal(hint(), 1);
  const all = [...shown, ...game.toastWaiting()];
  assert.ok(all.findIndex((x) => /Floor 2/.test(x)) < all.indexOf(T.pointsHint), JSON.stringify(all));
  game.cheat.teleportFloor(1); game.cheat.teleportFloor(2); game.cheat.teleportFloor(1); game.cheat.teleportFloor(2);
  assert.equal(hint(), 1);
});

test("R11-05 no nudge without the story (test and bot mode keep their old toasts) and none without unspent points", () => {
  const a = shell({ story: false }); a.game.core.player.attrPoints = 2; a.game.cheat.teleportFloor(2);
  assert.equal(a.hint(), 0);
  const b = shell(); assert.equal(b.game.core.player.attrPoints + b.game.core.player.skillPoints, 0); b.game.cheat.teleportFloor(2);
  assert.equal(b.hint(), 0);
});

test("R11-05 an arrival on floor 2 through the Emergency Exit door (floor name suppressed) still gets the nudge", () => {
  const { game, hint } = shell();
  game.cheat.teleportFloor(2); game.core.player.attrPoints = 0; // the first arrival found nothing to spend
  const ex = game.cheat.giveItem({ base: "emergency-exit" });
  assert.ok(ex.ok, JSON.stringify(ex));
  game.core.player.attrPoints = 2;
  assert.ok(game.input({ t: "useItem", id: ex.id }).ok);
  assert.equal(game.core.depth, 0); assert.ok(game.core.portal);
  assert.equal(hint(), 0, "the Lobby is not floor 2");
  game.core.player.tile = { ...game.core.portal.lobbyTile };
  assert.ok(game.input({ t: "usePortal" }).ok);
  assert.equal(game.core.depth, 2, "back on floor 2 by the door");
  assert.equal(hint(), 1);
});
