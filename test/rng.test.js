import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/rng.js";

test("same seed, same sequence", () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test("int stays in range", () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const n = r.int(3, 7); assert.ok(n >= 3 && n <= 7); }
});
