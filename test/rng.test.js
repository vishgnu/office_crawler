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

import { readFileSync } from "node:fs";

test("AC-R-120-4 createRng(42) matches the golden values", () => {
  const golden = JSON.parse(readFileSync("test/fixtures/rng-42.json", "utf8"));
  const r = createRng(42);
  assert.deepEqual(golden.map(() => r.next()), golden);
});

test("getState/setState resumes the sequence exactly", () => {
  const a = createRng(7);
  for (let i = 0; i < 10; i++) a.next();
  const saved = a.getState();
  const expected = [a.next(), a.next(), a.next()];
  const b = createRng(999);
  b.setState(saved);
  assert.deepEqual([b.next(), b.next(), b.next()], expected);
});
