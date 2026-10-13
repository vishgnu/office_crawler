import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step } from "../src/core/index.js";

test("AC-R-113-2 the core runs in Node with no window, document or AudioContext", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
  assert.equal(typeof AudioContext, "undefined");
  const s = newGame(1);
  for (let i = 0; i < 100; i++) step(s);
  assert.equal(s.tick, 100);
});

test("AC-R-122-2 10,000 idle ticks take well under 10 s", () => {
  const s = newGame(1), t = performance.now();
  for (let i = 0; i < 10000; i++) step(s);
  assert.equal(s.tick, 10000);
  assert.ok(performance.now() - t < 10000);
});

test("newGame accepts a number or an options object, and unseeded calls are the caller's job", () => {
  assert.equal(newGame(5).seed, 5);
  assert.equal(newGame({ seed: 6 }).seed, 6);
  assert.deepEqual(newGame(5).floor, newGame({ seed: 5 }).floor);
});
