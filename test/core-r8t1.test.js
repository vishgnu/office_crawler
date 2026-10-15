// CORE-R8T-1: R8-A4 re-click at 1 Hz, R8-M1 map markers (snapshot side), G-5 testhook unique, ADV-R7-10 the guarantee that sq5 can be finished on every seed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config, content, enterFloor, generateFloor, snapshot } from "../src/core/index.js";
import { installTestHook } from "../src/testhook/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { gameOn } from "./helpers.js";

// ---- R8-A4 ----
const ROWS = [
  "###########",
  "#@........#",
  "#.........#",
  "#.........#",
  "#.........#",
  "#.........#",
  "###########",
];
/** Hero in a corner, three adjacent attackers, two far monsters; `clicks(t)` gives the target of the re-click of tick t (or null). Returns the tick of the first player swing at an adjacent attacker and the swing count. */
function clickRun(cls, period, pickFar, ticks = 480) {
  const s = gameOn(ROWS, [["zombie-intern", 2, 1], ["zombie-intern", 1, 2], ["zombie-intern", 2, 2], ["zombie-intern", 8, 4], ["zombie-intern", 9, 5]], 1, { class: cls });
  s.player.hp = s.player.hpMax = 1e6;
  const [a, b, c, f1, f2] = s.monsters, far = [f1, f2];
  for (const m of s.monsters) { m.ai = "chase"; m.damage = 1; }
  for (const m of far) m.hp = m.hpMax = 1e6;
  const adj = new Set([a.id, b.id, c.id]);
  let first = -1, swings = 0;
  for (let t = 0; t < ticks; t++) {
    const n = s.eventLog.length;
    step(s, t % period === 0 ? [{ t: "attack", id: far[pickFar(t / period)].id }] : []);
    for (const e of s.eventLog.slice(n)) if ((e.type === "hit" || e.type === "miss") && e.source === "player" && adj.has(e.target)) { swings++; if (first < 0) first = t; }
  }
  return { first, swings };
}
for (const cls of content.classes.map((c) => c.id)) {
  test(`[R8-A4] ${cls}: re-clicking a far monster once a second (60 ticks) still gets an adjacent attacker hit within 1.5 s, same target or alternating`, () => {
    for (const [name, pick] of [["same target", () => 0], ["alternating targets", (i) => i % 2]]) {
      const { first, swings } = clickRun(cls, 60, pick);
      assert.ok(first >= 0 && first <= 90, `${name}: the first swing at an adjacent attacker lands at tick ${first} (limit 90 = 1.5 s)`);
      assert.ok(swings >= 3, `${name}: the hero keeps answering (${swings} swings in 8 s)`);
    }
  });
}

// ---- R8-M1 ----
test("[R8-M1] the snapshot's map.markers carries the quest elite once its tile is seen, and the pinned quest's markers only", () => {
  const e = newGame(13, { start: "town" });
  setQuestStep(e, "sq3", 1); e.quests.pinned = "sq3";
  enterFloor(e, config.quests.elite.depth, { at: "entry" });
  const m = e.monsters.find((o) => o.quest === "sq3");
  assert.ok(m);
  assert.equal(snapshot(e).map.markers.filter((x) => x.kind === "elite").length, 0, "unseen");
  e.floor.explored ??= new Array(e.floor.w * e.floor.h).fill(0); e.floor.explored[m.tile.y * e.floor.w + m.tile.x] = 1;
  const mk = snapshot(e).map.markers.filter((x) => x.kind === "elite");
  assert.equal(mk.length, 1); assert.deepEqual(mk[0].tile, m.tile);
});

// ---- G-5 ----
function rig() {
  const game = { core: newGame(5, { class: "facilities-manager", name: "Hook", start: "town" }), render() {}, getState() { return snapshot(this.core); }, input() { return { ok: true }; }, cheat: {} };
  const roll = (o) => { game.last = o; if (o.rarity === "unique") game.core.uniquesFound.push("stub-" + game.core.uniquesFound.length); return { ok: true, id: "x" }; };
  game.cheat.giveItem = roll; game.cheat.spawnItem = roll;
  return { api: installTestHook(game, {}, {}), game };
}
test("[G-5] testhook giveItem/spawnItem with rarity unique: a base with a unique passes, a base without one fails loudly, and a nothing-fits roll never reaches the cheat", () => {
  const withU = new Set(content.uniques.map((u) => u.base)), without = Object.keys(content.items).filter((b) => content.items[b].slot && !withU.has(b));
  assert.ok(without.length > 0);
  const { api, game } = rig();
  const ok = api.cheat.giveItem({ base: "blazer", rarity: "unique", ilvl: 20 });
  assert.equal(ok.ok, true);
  for (const fn of ["giveItem", "spawnItem"]) {
    game.last = null;
    const r = api.cheat[fn]({ base: without[0], rarity: "unique", ilvl: 20 });
    assert.equal(r.ok, false); assert.match(r.error, /no unique/); assert.equal(game.last, null, "refused before rolling");
  }
  assert.equal(api.cheat.giveItem({ base: "blazer", rarity: "unique", ilvl: 1 }).ok, false, "below the unique's item level");
  assert.equal(api.cheat.giveItem({ base: without[0], rarity: "rare", ilvl: 20 }).ok, true, "other rarities are untouched");
  game.core.uniquesFound.push(...content.uniques.filter((u) => u.base === "blazer").map((u) => u.id));
  const t = api.cheat.giveItem({ base: "blazer", rarity: "unique", ilvl: 20 });
  assert.equal(t.ok, false); assert.match(t.error, /already found/);
});
test("[G-5] partly taken: with some matching uniques already found, the hook narrows the request to an untaken one before rolling (no stray rare, ok:true)", () => {
  const slot = "weapon", inSlot = content.uniques.filter((u) => content.items[u.base].slot === slot && u.minIlvl <= 20);
  assert.ok(inSlot.length >= 2, "the slot has at least two uniques");
  for (const fn of ["giveItem", "spawnItem"]) {
    const { api, game } = rig();
    game.core.uniquesFound.push(inSlot[0].id);
    const r = api.cheat[fn]({ slot, rarity: "unique", ilvl: 20 });
    assert.equal(r.ok, true, fn); assert.equal(r.fellback, undefined);
    assert.notEqual(game.last.base, inSlot[0].base, "the taken unique's base is not requested");
    assert.ok(inSlot.slice(1).some((u) => u.base === game.last.base));
  }
});
test("[R11-08] one-unique-per-base assumption: the narrowing above holds because every base has exactly one unique; with a second unique on a base and one of them found the hook refuses instead of risking a stray rare", () => {
  const perBase = {}; for (const u of content.uniques) perBase[u.base] = (perBase[u.base] ?? 0) + 1;
  assert.ok(Object.values(perBase).every((n) => n === 1), "ASSUMPTION of the narrowing test: one unique per base (if this fails, review the uniqueGuard narrowing)");
  const first = content.uniques.find((u) => u.base === "blazer"), twin = { ...first, id: `${first.id}-r11twin` };
  content.uniques.push(twin);
  try {
    for (const fn of ["giveItem", "spawnItem"]) {
      const { api, game } = rig();
      game.core.uniquesFound.push(first.id);
      game.last = null;
      const r = api.cheat[fn]({ base: "blazer", rarity: "unique", ilvl: 20 });
      assert.equal(r.ok, false, fn); assert.match(r.error, /already found/); assert.equal(game.last, null, "refused before rolling");
    }
  } finally { content.uniques.splice(content.uniques.indexOf(twin), 1); }
});
test("[G-5] on the real game: a unique request gives a unique (item and uniquesFound), a base without one gives nothing", async () => {
  const { spawnItem, takeGround } = await import("../src/core/index.js");
  const s = newGame(9, { class: "facilities-manager", start: "town" });
  const game = { core: s, render() {}, getState: () => snapshot(s), input: () => ({ ok: true }), cheat: { giveItem: (o) => { const e = spawnItem(s, o, s.player.tile); return takeGround(s, e).ok ? { ok: true, id: e.id } : { ok: false, error: "full" }; }, spawnItem: (o) => { const e = spawnItem(s, o, s.player.tile); return { ok: true, id: e.id }; } } };
  const api = installTestHook(game, {}, {});
  const r = api.cheat.giveItem({ base: "blazer", rarity: "unique", ilvl: 20 });
  assert.equal(r.ok, true); assert.equal(s.inventory.items.at(-1).rarity, "unique"); assert.equal(s.uniquesFound.length, 1);
  const withU = new Set(content.uniques.map((u) => u.base)), bad = Object.keys(content.items).find((b) => content.items[b].slot && !withU.has(b));
  const n = s.inventory.items.length;
  assert.equal(api.cheat.giveItem({ base: bad, rarity: "unique", ilvl: 20 }).ok, false);
  assert.equal(s.inventory.items.length, n);
});

// ---- ADV-R7-10 ----
// Seeds below 700 where floors 5 and 6 alone spawn fewer consultants than sq5 needs (computed once; the full 1000-seed scan of topUpKills is in quests-sq45.test.js).
const SQ5_SHORT_SEEDS = [102, 105, 173, 183, 194, 412, 446, 447, 468, 565, 597, 657];
test("[ADV-R7-10] sq5 can be finished on the known short seeds: the generator alone leaves them short, accepting tops them up", () => {
  const k = config.quests.sq5.kill;
  for (const seed of SQ5_SHORT_SEEDS) {
    const n = k.depths.reduce((t, d) => t + generateFloor(seed, d).spawns.filter((sp) => sp.type === k.monster).length, 0);
    assert.ok(n < k.count, `seed ${seed} is still short without the top-up (${n})`);
    const s = newGame(seed, { class: "facilities-manager", name: "Adv", start: "town", wearStartKit: true });
    s.quests.sq5 = { s: "active", p: 0 };
    let alive = 0;
    for (const d of k.depths) { enterFloor(s, d, { at: "entry" }); alive += s.monsters.filter((m) => m.type === k.monster && !m.summoned && m.ai !== "dead").length; }
    assert.ok(alive >= k.count, `seed ${seed}: ${alive} consultants alive on floors ${k.depths}`);
  }
});
