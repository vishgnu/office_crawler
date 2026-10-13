import { test } from "node:test";
import assert from "node:assert/strict";
import { hashState, hash32 } from "../src/core/hash.js";

test("state hash does not depend on key order and ignores UI caches", () => {
  const a = { x: 1, y: { p: [1, 2], q: "z" }, ui: { tooltip: "a", hud: 1, notice: null }, perf: 5 };
  const b = { perf: 9, ui: { notice: null, hud: 2, tooltip: "b" }, y: { q: "z", p: [1, 2] }, x: 1 };
  assert.equal(hashState(a), hashState(b));
});

test("state hash reacts to every real change", () => {
  const base = { a: [1, 2, 3], b: { c: 1 } };
  const h = hashState(base);
  assert.notEqual(hashState({ ...base, a: [1, 2, 4] }), h);
  assert.notEqual(hashState({ ...base, b: { c: 2 } }), h);
  assert.notEqual(hashState({ ...base, d: 0 }), h);
  assert.match(h, /^[0-9a-f]{16}$/);
});

test("hash32 is stable and spreads small inputs", () => {
  assert.equal(hash32(1, 2), hash32(1, 2));
  assert.notEqual(hash32(1, 2), hash32(2, 1));
  assert.equal(new Set(Array.from({ length: 1000 }, (_, i) => hash32(i, 1))).size, 1000);
});
