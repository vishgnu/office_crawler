import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFloor } from "../src/core/gen/floor.js";
import { fallbackFloor } from "../src/core/gen/floor.js";
import { validateFloor } from "../src/core/gen/validate.js";
import { buildGrid, flood } from "../src/core/grid.js";
import { config, content, hashState } from "../src/core/index.js";
import { STAIRS_UP, STAIRS_DOWN, WALL } from "../src/core/tiles.js";

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const floors = seeds.map((s) => generateFloor(s, 1)); // generated once, shared by the tests below

test("AC-R-042-1 size, exactly one entry and one exit, walls outside the playable area", () => {
  for (const f of floors) {
    assert.ok(f.w <= config.floorSize.w && f.h <= config.floorSize.h);
    assert.equal(f.tiles.length, f.w * f.h);
    assert.equal(f.tiles.filter((t) => t === STAIRS_UP).length, 1);
    assert.equal(f.tiles.filter((t) => t === STAIRS_DOWN).length, 1);
    assert.equal(f.tiles[f.entry.y * f.w + f.entry.x], STAIRS_UP);
    assert.equal(f.tiles[f.exit.y * f.w + f.exit.x], STAIRS_DOWN);
    for (let i = 0; i < f.w; i++) assert.equal(f.tiles[i], WALL), assert.equal(f.tiles[(f.h - 1) * f.w + i], WALL);
    for (let i = 0; i < f.h; i++) assert.equal(f.tiles[i * f.w], WALL), assert.equal(f.tiles[i * f.w + f.w - 1], WALL);
  }
});

test("AC-R-042-2 exit and everything placed on the floor is reachable from the entry", () => {
  for (const f of floors) {
    const grid = buildGrid(f), { dist } = flood(grid, f.entry.x, f.entry.y);
    assert.ok(dist[f.exit.y * f.w + f.exit.x] >= 0, "exit");
    for (let i = 0; i < f.w * f.h; i++) if (grid.walk[i]) assert.ok(dist[i] >= 0, "walkable tile cut off");
    for (const s of f.spawns) assert.ok(dist[s.tile.y * f.w + s.tile.x] >= 0, "spawn");
    assert.ok(validateFloor(f).ok);
  }
});

test("AC-R-042-3 / AC-R-120-3 same seed is identical, 200 seeds give 200 distinct layouts", () => {
  assert.deepEqual(generateFloor(7, 1), generateFloor(7, 1));
  assert.notDeepEqual(generateFloor(7, 1).tiles, generateFloor(8, 1).tiles);
  const hashes = new Set(floors.map((f) => hashState({ t: f.tiles, r: f.rooms, p: f.props })));
  assert.equal(hashes.size, 200);
});

test("AC-R-042-4 generation takes well under 500 ms per floor", () => {
  for (let i = 0; i < 50; i++) {
    const t = performance.now();
    generateFloor(1000 + i, 1);
    assert.ok(performance.now() - t < 500);
  }
});

test("AC-R-042-6 enough rooms, no overlap, every room connected to the entry", () => {
  for (const f of floors) {
    assert.ok(f.rooms.length >= config.minRooms);
    for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) {
      const a = f.rooms[i], b = f.rooms[j];
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, "rooms overlap");
    }
    const { dist } = flood(buildGrid(f), f.entry.x, f.entry.y);
    for (const r of f.rooms) {
      let reached = false;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (dist[y * f.w + x] >= 0) reached = true;
      assert.ok(reached, "room not connected");
    }
  }
});

test("AC-R-003-1 floor theme is a registered office theme", () => {
  for (const f of floors) assert.ok(f.theme in content.themes);
  assert.equal(floors[0].theme, "open-plan");
});

test("AC-R-101-1 room kinds come from the allowed set and vary", () => {
  const allowed = new Set(["cubicle", "conference", "copy", "storage", "server"]);
  const seen = new Set();
  for (const f of floors.slice(0, 50)) for (const r of f.rooms) { assert.ok(allowed.has(r.kind)); seen.add(r.kind); }
  assert.ok(seen.size >= 2);
});

test("blocking props never sit on the stairs or cut the floor in two", () => {
  for (const f of floors) {
    const keys = new Set(f.props.map((p) => `${p.x},${p.y}`));
    assert.equal(keys.size, f.props.length, "two props on one tile");
    assert.ok(!keys.has(`${f.entry.x},${f.entry.y}`) && !keys.has(`${f.exit.x},${f.exit.y}`));
  }
});

test("the fixed fallback layout is itself a valid floor", () => {
  const f = fallbackFloor(1, 1);
  assert.deepEqual(validateFloor(f), { ok: true, errors: [] });
  assert.ok(f.spawns.length >= 2);
});

test("validateFloor reports a floor whose exit is walled off", () => {
  const f = generateFloor(3, 1);
  const bad = structuredClone(f);
  for (let y = 0; y < bad.h; y++) for (let x = 0; x < bad.w; x++) {
    if (Math.max(Math.abs(x - bad.exit.x), Math.abs(y - bad.exit.y)) === 1) bad.tiles[y * bad.w + x] = WALL;
  }
  assert.equal(validateFloor(bad).ok, false);
});
