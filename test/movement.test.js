import { test } from "node:test";
import assert from "node:assert/strict";
import { config, step, applyInput, generateFloor, newGame } from "../src/core/index.js";
import { buildGrid } from "../src/core/grid.js";
import { gameOn, run, bfsSteps, OPEN } from "./helpers.js";

const DETOUR = [
  "####################",
  "#@.......#.........#",
  "#........#.........#",
  "#........#.........#",
  "#..................#",
  "####################",
];

test("AC-R-005-1 clicking a reachable tile walks there and ends idle with an empty path", () => {
  const s = gameOn(DETOUR);
  const B = { x: 18, y: 1 }, len = bfsSteps(DETOUR, s.player.tile, B);
  assert.deepEqual(applyInput(s, { t: "click", tile: B, button: 0 }), { ok: true });
  run(s, len * config.moveTicksPerTile + 5);
  assert.deepEqual(s.player.tile, B);
  assert.equal(s.player.action, "idle");
  assert.deepEqual(s.player.path, []);
});

test("movement takes moveTicksPerTile per tile, diagonals included", () => {
  const s = gameOn(OPEN);
  applyInput(s, { t: "moveTo", tile: { x: 12, y: 7 } }); // 3 diagonal steps
  run(s, 3 * config.moveTicksPerTile - 1);
  assert.notDeepEqual(s.player.tile, { x: 12, y: 7 });
  run(s, 2);
  assert.deepEqual(s.player.tile, { x: 12, y: 7 });
});

test("AC-R-005-7 clicking a wall never puts the player on a non-walkable tile; a noPath event or a nearby stop results", () => {
  const s = gameOn(OPEN);
  const grid = buildGrid(s.floor);
  const solid = gameOn(["##############", "#@..##########", "#...##########", "##############"]);
  assert.equal(applyInput(solid, { t: "click", tile: { x: 12, y: 2 }, button: 0 }).ok, false); // nothing walkable within 3
  assert.ok(solid.events.some((e) => e.type === "noPath"));
  run(solid, 20);
  assert.deepEqual(solid.player.tile, { x: 1, y: 1 });
  const r2 = applyInput(s, { t: "click", tile: { x: 19, y: 4 }, button: 0 }); // wall next to the floor: snaps
  assert.equal(r2.ok, true);
  for (let i = 0; i < 130; i++) { step(s); assert.ok(grid.walkable(s.player.tile.x, s.player.tile.y)); }
  assert.deepEqual(s.player.tile, { x: 18, y: 4 });
});

test("AC-R-005-7 random clicks over a generated floor never leave walkable ground", () => {
  const s = newGame(21);
  const grid = buildGrid(s.floor);
  for (let i = 0; i < 400; i++) {
    if (i % 10 === 0) applyInput(s, { t: "click", tile: { x: (i * 7) % s.floor.w, y: (i * 13) % s.floor.h }, button: 0 });
    step(s);
    assert.ok(grid.walkable(s.player.tile.x, s.player.tile.y));
  }
});

test("AC-R-005-6 a held button follows the cursor; held on a monster keeps attacking until it dies", () => {
  const s = gameOn(OPEN);
  applyInput(s, { t: "click", tile: { x: 3, y: 2 }, button: 0, hold: true });
  applyInput(s, { t: "mouse", phase: "move", tile: { x: 17, y: 6 } });
  run(s, 10);
  assert.deepEqual(s.player.path.at(-1), { x: 17, y: 6 });
  applyInput(s, { t: "mouse", phase: "up" });
  assert.equal(s.input.mouse.down, false);

  const f = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  const m = f.monsters[0];
  m.hp = m.hpMax = 40;
  f.player.hp = f.player.hpMax = 100000;
  applyInput(f, { t: "click", tile: m.tile, button: 0, hold: true });
  run(f, 1500);
  assert.equal(m.ai === "dead" || !f.monsters.includes(m), true);
});

test("invalid commands return ok:false with an error and change nothing", () => {
  const s = gameOn(OPEN);
  const before = JSON.stringify(s);
  for (const input of [{ t: "moveTo", tile: { x: -5, y: -5 } }, { t: "attack", id: "nope" }, { t: "moveTo", tile: null }, { t: "bogus" }]) {
    const r = applyInput(s, input);
    assert.equal(r.ok, false);
    assert.ok(r.error);
  }
  assert.equal(JSON.stringify(s), before);
});

test("a click on a blocked tile with a monster in the way does not walk through it", () => {
  const rows = ["#####", "#@..#", "#####"];
  const s = gameOn(rows, [["zombie-intern", 2, 1]]);
  s.monsters[0].ai = "idle";
  applyInput(s, { t: "moveTo", tile: { x: 3, y: 1 } });
  run(s, 200);
  assert.notDeepEqual(s.player.tile, { x: 2, y: 1 });
});

test("floors from the generator can be walked end to end", () => {
  const s = newGame(5);
  s.monsters = []; // just walking
  const { exit } = s.floor;
  assert.equal(applyInput(s, { t: "moveTo", tile: exit }).ok, true);
  run(s, 3000);
  assert.deepEqual(s.player.tile, exit);
  void generateFloor;
});
