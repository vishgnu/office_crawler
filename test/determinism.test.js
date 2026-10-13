import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashState, newGame, step } from "../src/core/index.js";
import { replay } from "./helpers.js";

const script = JSON.parse(readFileSync("test/fixtures/run-a.json", "utf8"));

test("AC-R-120-2 the recorded run (500+ ticks, moves, attacks, clicks, pause) replays to the same hash twice", () => {
  assert.ok(script.ticks >= 500);
  const kinds = new Set(script.inputs.map((i) => i.input.t));
  for (const k of ["moveTo", "attack", "click", "key"]) assert.ok(kinds.has(k), `fixture lacks ${k}`);
  const a = replay(script), b = replay(script);
  assert.equal(hashState(a), hashState(b));
  assert.deepEqual(a, b);
  assert.ok(a.eventLog.some((e) => e.type === "hit"), "the run should include real combat");
});

test("AC-R-122-1 / AC-NFR-Q01-2 (Node part) the final hash equals the frozen golden hash", () => {
  const golden = readFileSync("test/fixtures/run-a.hash", "utf8").trim();
  assert.equal(hashState(replay(script)), golden);
});

test("different seeds give different runs", () => {
  assert.notEqual(hashState(replay({ ...script, seed: 2 })), hashState(replay(script)));
});

test("state survives a JSON round trip (AC-R-121-2) and keeps running identically", () => {
  const a = newGame(3);
  for (let i = 0; i < 100; i++) step(a);
  const b = JSON.parse(JSON.stringify(a));
  assert.deepEqual(b, a);
  for (let i = 0; i < 200; i++) { step(a); step(b); }
  assert.equal(hashState(a), hashState(b));
});
