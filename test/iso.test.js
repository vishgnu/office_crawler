import { test } from "node:test";
import assert from "node:assert/strict";
import { tileToScreen, screenToTile } from "../src/core/iso.js";

test("AC-R-112-3 (unit part) tile centres survive the screen round trip, 2:1 geometry", () => {
  for (let x = 0; x < 56; x += 5) for (let y = 0; y < 56; y += 7) {
    const s = tileToScreen(x, y), t = screenToTile(s.x, s.y);
    assert.equal(Math.floor(t.x + 1e-9), x); assert.equal(Math.floor(t.y + 1e-9), y);
  }
  const a = tileToScreen(0, 0), b = tileToScreen(1, 0);
  assert.equal((b.x - a.x) / (b.y - a.y), 2);
});
