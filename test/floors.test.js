import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, newGame, step, applyInput, teleportFloor, hashState, generateFloor, spawnItem, enterFloor, setLevel, giveGold } from "../src/core/index.js";
import { killMonster } from "../src/core/systems/damage.js";
import { STAIRS_DOWN, STAIRS_UP } from "../src/core/tiles.js";
import { gameOn, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const until = (s, f, max = 4000) => { for (let i = 0; i < max && !f(); i++) step(s); return f(); };
const calm = (s) => { s.monsters.length = 0; return s; }; // walking tests: nobody in the way
const start = (seed = 4) => newGame({ seed, start: "town" });

test("AC-R-043-4 / AC-R-043-3 clicking the exit goes one floor down, the entry stairs one floor up; floor 1 up leads to the Lobby; deepestDepth tracks", () => {
  const s = start(); cmd(s, { t: "useStairs", dir: "down" }); until(s, () => s.depth === 1);
  for (let d = 1; d <= 7; d++) {
    assert.equal(s.depth, d); assert.equal(s.deepestDepth, d);
    calm(s);
    assert.equal(cmd(s, { t: "click", tile: s.floor.exit }).ok, true);
    assert.ok(until(s, () => s.depth !== d), `floor ${d} -> ${d + 1}`);
    assert.equal(s.depth, d + 1); assert.equal(s.deepestDepth, d + 1);
    assert.deepEqual(s.player.tile, s.floor.entry);
  }
  // up again: arrive beside the way down of the floor above
  calm(s);
  assert.equal(cmd(s, { t: "click", tile: s.floor.entry }).ok, true);
  assert.ok(until(s, () => s.depth !== 8));
  assert.equal(s.depth, 7); assert.equal(s.deepestDepth, 8);
  assert.ok(Math.max(Math.abs(s.player.tile.x - s.floor.exit.x), Math.abs(s.player.tile.y - s.floor.exit.y)) <= 2);
  assert.notDeepEqual(s.player.tile, s.floor.exit);
  const s1 = newGame(2); calm(s1);
  cmd(s1, { t: "useStairs", dir: "up" });
  assert.ok(until(s1, () => s1.depth === 0)); assert.equal(s1.scene, "town");
});

test("walking over stairs does not take them; only a click or useStairs order does", () => {
  const s = newGame(6); calm(s);
  cmd(s, { t: "moveTo", tile: s.floor.exit });
  until(s, () => !s.player.next && s.player.path.length === 0, 3000);
  assert.deepEqual(s.player.tile, s.floor.exit);
  for (let i = 0; i < 100; i++) step(s);
  assert.equal(s.depth, 1);
});

test("AC-R-043-2 the last floor's way down is locked until the boss arena exists; teleportFloor(9) fails", () => {
  const s = newGame(3); teleportFloor(s, config.maxDepth); calm(s);
  assert.equal(s.floor.bossStairs, true);
  const r = cmd(s, { t: "useStairs", dir: "down" });
  assert.equal(r.ok, false);
  assert.ok(s.events.some((e) => e.type === "stairsLocked"));
  assert.equal(teleportFloor(s, 9).ok, false);
  assert.equal(teleportFloor(s, -1).ok, false);
  assert.equal(s.depth, 8);
});

test("AC-R-123-5 teleportFloor(5): depth 5, hero on the entry tile, basement theme; floors 1-4 are open-plan", () => {
  const s = newGame(8);
  assert.equal(teleportFloor(s, 5).ok, true);
  assert.equal(s.depth, 5); assert.deepEqual(s.player.tile, s.floor.entry); assert.equal(s.floor.theme, "basement");
  assert.equal(s.deepestDepth, 5);
  teleportFloor(s, 3); assert.equal(s.floor.theme, "open-plan"); assert.equal(s.deepestDepth, 5);
  assert.equal(s.floor.tiles[s.floor.entry.y * s.floor.w + s.floor.entry.x], STAIRS_UP);
  assert.equal(s.floor.tiles[s.floor.exit.y * s.floor.w + s.floor.exit.x], STAIRS_DOWN);
});

test("AC-R-044-1 a re-entered floor has the same seed and layout; killed monsters stay dead, the rest are back on their start tiles", () => {
  const s = newGame(11); teleportFloor(s, 2);
  const seed = s.floor.seed, tiles = [...s.floor.tiles], starts = s.floor.spawns.map((sp) => ({ ...sp.tile }));
  const n = s.monsters.length;
  assert.ok(n >= 6);
  const dead = s.monsters.slice(0, 3);
  for (const m of dead) killMonster(s, m);
  s.monsters[5].tile = { ...s.monsters[5].tile, x: s.monsters[5].tile.x }; // (moved monsters return home)
  const wanderer = s.monsters[4]; wanderer.hp = 1; wanderer.ai = "chase";
  teleportFloor(s, 3); teleportFloor(s, 2);
  assert.equal(s.floor.seed, seed); assert.deepEqual(s.floor.tiles, tiles);
  assert.equal(s.monsters.length, n - 3);
  const alive = s.monsters.map((m) => `${m.tile.x},${m.tile.y}`).sort();
  const expect = starts.filter((_, i) => i >= 3).map((t) => `${t.x},${t.y}`).sort();
  assert.deepEqual(alive, expect);
  assert.ok(s.monsters.every((m) => m.ai === "idle" && m.hp === m.hpMax));
});

test("AC-R-044-2 (QF-04-6) ground items persist on a floor within the session", () => {
  const s = newGame(12); teleportFloor(s, 2);
  const e = spawnItem(s, { base: "blazer", rarity: "magic" }, s.floor.entry);
  const gold = s.groundItems.length;
  teleportFloor(s, 4); assert.equal(s.groundItems.length, 0);
  teleportFloor(s, 2);
  assert.equal(s.groundItems.length, gold);
  assert.ok(s.groundItems.some((g) => g.id === e.id));
  enterFloor(s, 0); enterFloor(s, 2);
  assert.ok(s.groundItems.some((g) => g.id === e.id));
});

test("AC-R-023-4 / QF-02-2 death on floor n: respawn in the Lobby with full health and mana, gold, level, xp, items unchanged", () => {
  const s = newGame(13); teleportFloor(s, 3); setLevel(s, 4); giveGold(s, 77);
  const p = s.player, snap = { gold: p.gold, level: p.level, xp: p.xp, inv: JSON.stringify(s.inventory), eq: JSON.stringify(s.equipment), deepest: s.deepestDepth };
  p.mp = 0;
  const m = s.monsters.find((x) => x.ai !== "dead"); m.ai = "attack"; m.tile = { x: p.tile.x + 1, y: p.tile.y };
  p.hp = 1; m.attackT = config.monsterAttackHitTick - 1; m.attackRating = 100000; m.damage = 50;
  assert.ok(until(s, () => s.scene === "dead", 400));
  assert.equal(cmd(s, { t: "respawn" }).ok, true);
  assert.equal(s.scene, "town"); assert.equal(s.depth, 0);
  assert.equal(p.hp, p.hpMax); assert.equal(p.mp, p.mpMax);
  assert.equal(p.gold, snap.gold); assert.equal(p.level, snap.level); assert.equal(p.xp, snap.xp);
  assert.equal(JSON.stringify(s.inventory), snap.inv); assert.equal(JSON.stringify(s.equipment), snap.eq);
  assert.equal(s.deepestDepth, snap.deepest);
  assert.deepEqual(s.monsters, []);
  assert.equal(p.action, "idle");
  assert.equal(cmd(s, { t: "respawn" }).ok, false); // alive
  // the way back: the elevator goes to the deepest floor reached, whose cleared monsters stay cleared
  cmd(s, { t: "useStairs", dir: "down" });
  assert.ok(until(s, () => s.depth !== 0));
  assert.equal(s.depth, 3);
});

test("restart after death still starts a fresh game (in the Lobby if the run began there)", () => {
  const s = start(5); s.player.hp = 0; s.scene = "dead";
  assert.equal(cmd(s, { t: "restart" }).ok, true);
  assert.equal(s.scene, "town"); assert.equal(s.depth, 0);
  const f = newGame(5); f.player.hp = 0; f.scene = "dead";
  cmd(f, { t: "restart" });
  assert.equal(f.scene, "floor"); assert.equal(f.depth, 1);
});

test("AC-R-101-3-ish: floor objects carry a name and the theme; the Lobby has no stairs up", () => {
  const f = generateFloor(1, 6);
  assert.equal(f.name, content.strings.basementName);
  assert.equal(generateFloor(1, 2).name, content.strings.floorName);
  const t = generateFloor(1, 0);
  assert.equal(t.town, true);
  assert.ok(!t.tiles.includes(STAIRS_UP));
});

test("a whole trip (down, fight, up, respawn cycle) is deterministic and JSON-safe", () => {
  const trip = () => {
    const s = start(21);
    cmd(s, { t: "useStairs", dir: "down" });
    for (let i = 0; i < 1500; i++) step(s);
    teleportFloor(s, 4);
    for (let i = 0; i < 800; i++) step(s);
    return s;
  };
  const a = trip(), b = trip();
  assert.equal(hashState(a), hashState(b));
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
});
