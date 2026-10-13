import { test } from "node:test";
import assert from "node:assert/strict";
import { hasLineOfSight } from "../src/core/los.js";
import { buildGrid } from "../src/core/grid.js";
import { floorFromRows } from "./helpers.js";

const grid = buildGrid(floorFromRows([
  "##########",
  "#@.......#",
  "#...#....#",
  "#...#....#",
  "#........#",
  "##########",
]));

test("line of sight is clear in the open and blocked by a wall", () => {
  assert.equal(hasLineOfSight(grid, 1, 1, 8, 1), true);
  assert.equal(hasLineOfSight(grid, 2, 2, 7, 2), false);
  assert.equal(hasLineOfSight(grid, 3, 3, 3, 3), true);
});

test("line of sight is symmetric on straight and diagonal lines", () => {
  for (const [a, b] of [[[1, 1], [8, 4]], [[2, 4], [7, 1]], [[1, 2], [8, 2]], [[2, 3], [6, 3]]]) {
    assert.equal(hasLineOfSight(grid, ...a, ...b), hasLineOfSight(grid, ...b, ...a));
  }
});
