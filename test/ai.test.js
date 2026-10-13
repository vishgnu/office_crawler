import { test } from "node:test";
import assert from "node:assert/strict";
import { config, step, applyInput } from "../src/core/index.js";
import { buildGrid } from "../src/core/grid.js";
import { gameOn, run, bfsSteps, floorFromRows, OPEN } from "./helpers.js";

const tough = (s) => { s.player.hp = s.player.hpMax = 100000; };

test("AC-R-032-1 a monster in sight goes idle -> notice -> chase within noticeTicks", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4]]);
  const m = s.monsters[0];
  step(s);
  assert.equal(m.ai, "notice");
  for (let i = 1; i < config.noticeTicks; i++) step(s);
  assert.ok(m.ai === "chase" || m.ai === "attack");
});

test("AC-R-032-2 a wall that blocks the line of sight keeps the monster idle", () => {
  const rows = [
    "##########",
    "#@.#.....#",
    "#..#.....#",
    "#..#.....#",
    "#........#", // the only link is out of sight of both
    "##########",
  ];
  const s = gameOn(rows, [["printer-imp", 6, 2]]);
  run(s, 100);
  assert.equal(s.monsters[0].ai, "idle");
});

test("AC-R-032-3 a chasing monster follows a shortest walkable path and ends next to the player", () => {
  const rows = [
    "####################",
    "#@.....#...........#",
    "#......#...........#",
    "#......#...........#",
    "#......#...........#",
    "#..................#",
    "#######.############",
    "####################",
  ];
  const s = gameOn(rows, [["zombie-intern", 17, 1]]);
  tough(s);
  const m = s.monsters[0], grid = buildGrid(s.floor);
  m.ai = "chase"; // start straight in the chase: the player is far outside its sight range
  const ref = bfsSteps(rows, m.tile, s.player.tile);
  let planned = null, last = { ...m.tile };
  for (let i = 0; i < 2000 && m.ai !== "attack"; i++) {
    step(s);
    if (planned === null && m.ai === "chase" && m.path.length) planned = m.path.length + (m.next ? 1 : 0); // plus the step already begun this tick
    assert.ok(grid.walkable(m.tile.x, m.tile.y));
    assert.ok(Math.abs(m.tile.x - last.x) <= 1 && Math.abs(m.tile.y - last.y) <= 1);
    last = { ...m.tile };
  }
  assert.equal(m.ai, "attack");
  assert.equal(planned, ref - 1, "path to a tile next to the player is one step shorter than the path to the player");
  assert.ok(Math.max(Math.abs(m.tile.x - s.player.tile.x), Math.abs(m.tile.y - s.player.tile.y)) === 1);
});

test("AC-R-032-4 an adjacent monster attacks exactly once per monsterAttackTicks", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  tough(s);
  const m = s.monsters[0], ticks = [];
  for (let i = 0; i < 400; i++) {
    step(s);
    assert.ok(m.ai !== "dead");
    if (s.events.some((e) => e.source === m.id)) ticks.push(s.tick);
  }
  assert.equal(m.ai, "attack");
  assert.ok(ticks.length >= 5);
  for (let i = 1; i < ticks.length; i++) assert.equal(ticks[i] - ticks[i - 1], config.monsterAttackTicks);
});

test("AC-R-032-5 crowded monsters never share a tile or enter a wall", () => {
  const rows = [
    "###########",
    "#.........#",
    "#.........#",
    "#....@....#",
    "#.........#",
    "#.........#",
    "###########",
  ];
  const mons = [["zombie-intern", 1, 1], ["zombie-intern", 9, 1], ["printer-imp", 1, 5], ["printer-imp", 9, 5], ["zombie-intern", 5, 1], ["printer-imp", 5, 5], ["zombie-intern", 1, 3], ["printer-imp", 9, 3]];
  const s = gameOn(rows, mons);
  tough(s);
  const grid = buildGrid(s.floor);
  for (let i = 0; i < 500; i++) {
    if (i % 100 === 0) applyInput(s, { t: "moveTo", tile: { x: 2 + ((i / 100) * 2) % 7, y: 1 + (i / 100) % 4 } });
    step(s);
    const seen = new Set();
    for (const m of s.monsters.filter((o) => o.ai !== "dead")) {
      const k = `${m.tile.x},${m.tile.y}`;
      assert.ok(!seen.has(k), `two monsters on ${k} at tick ${s.tick}`);
      seen.add(k);
      assert.ok(grid.walkable(m.tile.x, m.tile.y));
      assert.notEqual(k, `${s.player.tile.x},${s.player.tile.y}`);
    }
  }
});

test("AC-R-032-7 a woken pack follows its leader; other packs stay idle", () => {
  const rows = [
    "####################",
    "#@.......#.........#",
    "#........#.........#",
    "#........#.........#",
    "#........#.........#",
    "#..................#",
    "####################",
  ];
  // p1: one member sees the player, one stands behind the wall. p2: out of sight behind the wall.
  const s = gameOn(rows, [["zombie-intern", 6, 1, "p1"], ["zombie-intern", 12, 1, "p1"], ["printer-imp", 15, 2, "p2"], ["printer-imp", 16, 2, "p2"]]);
  const [a, b, c, d] = s.monsters;
  run(s, config.packWakeTicks + 1);
  assert.ok(["notice", "chase"].includes(a.ai));
  assert.ok(["notice", "chase"].includes(b.ai));
  assert.equal(c.ai, "idle");
  assert.equal(d.ai, "idle");
});

test("AC-R-032-9 when the player dies, no monster acts any more", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4], ["printer-imp", 8, 4]]);
  s.player.hp = 1;
  while (s.scene !== "dead") step(s);
  const tick = s.tick, tiles = s.monsters.map((m) => ({ ...m.tile }));
  for (let i = 0; i < 100; i++) { step(s); assert.equal(s.events.length, 0); }
  assert.equal(s.tick, tick);
  assert.deepEqual(s.monsters.map((m) => m.tile), tiles);
});

test("AC-R-032-10 an unreachable player: no throw, monster stays on walkable ground, others keep working", () => {
  const rows = [
    "####################",
    "#........#.........#",
    "#........#.........#",
    "#........#....@....#",
    "#........#.........#",
    "####################",
  ];
  // The left monster is chasing but has no way to the player; the right one shares the player's room.
  const s = gameOn(rows, [["zombie-intern", 3, 2], ["printer-imp", 16, 3]]);
  tough(s);
  const [stuck, near] = s.monsters;
  stuck.ai = "chase";
  const grid = buildGrid(s.floor);
  for (let i = 0; i < 200; i++) { step(s); assert.ok(grid.walkable(stuck.tile.x, stuck.tile.y)); }
  assert.equal(stuck.ai, "chase");
  assert.ok(s.eventLog.some((e) => e.source === near.id), "the other monster still attacks");
});
