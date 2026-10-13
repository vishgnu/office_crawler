import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFloor } from "../src/core/gen/floor.js";
import { buildGrid, flood } from "../src/core/grid.js";
import { config, content } from "../src/core/index.js";

const floors = Array.from({ length: 200 }, (_, i) => generateFloor(i + 1, 1));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test("AC-R-034-1 monsters exist, stand on reachable tiles, not on stairs, no two share a tile", () => {
  for (const f of floors) {
    assert.ok(f.spawns.length > 0);
    const { dist } = flood(buildGrid(f), f.entry.x, f.entry.y);
    const grid = buildGrid(f), seen = new Set();
    for (const s of f.spawns) {
      assert.ok(grid.walkable(s.tile.x, s.tile.y) && dist[s.tile.y * f.w + s.tile.x] >= 0);
      assert.notDeepEqual(s.tile, f.entry);
      assert.notDeepEqual(s.tile, f.exit);
      assert.ok(cheb(s.tile, f.entry) > config.safeRadius, "inside the safe radius");
      assert.ok(content.monsters[s.type]);
      const k = `${s.tile.x},${s.tile.y}`;
      assert.ok(!seen.has(k)); seen.add(k);
    }
  }
});

test("AC-R-034-2 at least one pack of 2+, members stay within packRadius of the first", () => {
  for (const f of floors) {
    const packs = new Map();
    for (const s of f.spawns) if (s.packId) packs.set(s.packId, [...(packs.get(s.packId) ?? []), s]);
    assert.ok([...packs.values()].some((p) => p.length >= 2));
    for (const members of packs.values()) {
      assert.ok(members.length >= 2);
      for (const m of members) assert.ok(cheb(m.tile, members[0].tile) <= config.packRadius);
    }
  }
});

test("AC-R-034-4 population is deterministic per seed and differs between seeds", () => {
  assert.deepEqual(generateFloor(9, 1).spawns, generateFloor(9, 1).spawns);
  assert.notDeepEqual(generateFloor(9, 1).spawns, generateFloor(10, 1).spawns);
});
