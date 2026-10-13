import { test } from "node:test";
import assert from "node:assert/strict";
import { tileToScreen, screenToTile } from "../src/core/iso.js";
import { findPath } from "../src/core/pathfind.js";

test("iso projection round-trips", () => {
  for (const [x, y] of [[0, 0], [3, 7], [12.5, 4.25]]) {
    const s = tileToScreen(x, y), t = screenToTile(s.x, s.y);
    assert.ok(Math.abs(t.x - x) < 1e-9 && Math.abs(t.y - y) < 1e-9);
  }
});

const gridFrom = (rows) => ({ width: rows[0].length, height: rows.length,
  walkable: (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] === "." });

test("A* finds a path around a wall and refuses corner cutting", () => {
  const g = gridFrom(["....", ".##.", "....", "...."]);
  const p = findPath(g, 0, 1, 3, 1);
  assert.ok(p && p.at(-1).x === 3 && p.at(-1).y === 1);
  for (let i = 1; i < p.length; i++) assert.ok(Math.abs(p[i].x - p[i - 1].x) <= 1 && Math.abs(p[i].y - p[i - 1].y) <= 1);
  assert.ok(p.every((n) => g.walkable(n.x, n.y)));
});

test("A* returns null for unreachable or blocked goals", () => {
  const g = gridFrom(["..#..", "..#..", "..#.."]);
  assert.equal(findPath(g, 0, 0, 4, 0), null);
  assert.equal(findPath(g, 0, 0, 2, 0), null);
});
