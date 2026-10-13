import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpatialHash } from "../src/core/spatial.js";

test("spatial hash returns items within Chebyshev radius in insertion order", () => {
  const h = createSpatialHash(8);
  const pts = [["a", 1, 1], ["b", 9, 1], ["c", 20, 20], ["d", 8, 8], ["e", 7, 7]];
  for (const [id, x, y] of pts) h.insert(id, x, y);
  assert.deepEqual(h.query(8, 8, 1), ["d", "e"]);
  assert.deepEqual(h.query(5, 1, 5), ["a", "b"]);
  assert.deepEqual(h.query(20, 20, 0), ["c"]);
  assert.deepEqual(h.query(50, 50, 3), []);
});
