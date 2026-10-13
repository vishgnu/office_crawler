import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "../src/core/pathfind.js";
import { config } from "../src/core/index.js";
import { bfsSteps } from "./helpers.js";

const gridFrom = (rows) => ({ width: rows[0].length, height: rows.length,
  walkable: (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] !== "#" });

test("AC-R-005-8 path through the gap of a wall line is walkable, contiguous and as short as BFS", () => {
  const rows = [
    "..........",
    "..........",
    "#########.",
    "..........",
    ".#######..",
    "..........",
  ];
  const g = gridFrom(rows), start = { x: 0, y: 0 }, goal = { x: 0, y: 5 };
  const path = findPath(g, start.x, start.y, goal.x, goal.y, 4000, config.pathDiagCost);
  assert.ok(path);
  assert.deepEqual(path.at(-1), goal);
  let prev = start;
  for (const n of path) {
    assert.ok(g.walkable(n.x, n.y));
    const dx = n.x - prev.x, dy = n.y - prev.y;
    assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, "not a neighbour");
    if (dx && dy) assert.ok(g.walkable(prev.x + dx, prev.y) && g.walkable(prev.x, prev.y + dy), "cuts a corner");
    prev = n;
  }
  assert.equal(path.length, bfsSteps(rows, start, goal));
});

test("AC-R-005-8 equals BFS on random maps", () => {
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let n = 0; n < 40; n++) {
    const rows = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => (rnd() < 0.28 ? "#" : ".")).join(""));
    const a = { x: 0, y: 0 }, b = { x: 11, y: 11 };
    const g = gridFrom(rows.map((r, y) => (y === 0 ? "." + r.slice(1) : y === 11 ? r.slice(0, 11) + "." : r)));
    const fixed = rows.map((r, y) => (y === 0 ? "." + r.slice(1) : y === 11 ? r.slice(0, 11) + "." : r));
    const ref = bfsSteps(fixed, a, b), p = findPath(g, 0, 0, 11, 11, 4000, config.pathDiagCost);
    if (ref < 0) assert.equal(p, null); else assert.equal(p.length, ref);
  }
});

test("AC-R-005-9 an enclosed goal returns null quickly on a 100x100 grid", () => {
  const g = { width: 100, height: 100, walkable: (x, y) => x >= 0 && y >= 0 && x < 100 && y < 100 && !(Math.abs(x - 50) === 2 && Math.abs(y - 50) <= 2 || Math.abs(y - 50) === 2 && Math.abs(x - 50) <= 2) };
  // "Quickly" is asserted as a bounded search (deterministic), not wall-clock time, which flaked under
  // parallel test load (harness learning L-06). The grid has 10,000 tiles, so the search must give up within that.
  assert.equal(findPath(g, 0, 0, 50, 50, 10000, config.pathDiagCost), null);
  const t = performance.now();
  findPath(g, 0, 0, 50, 50, 10000, config.pathDiagCost);
  assert.ok(performance.now() - t < 1000, `took ${performance.now() - t} ms (sanity bound only)`);
});
