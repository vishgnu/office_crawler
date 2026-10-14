// R4-4: the careful bot plays every class (R-230 tooling half, R-234): floor 3 on fixed seeds within a tick budget, the boss on one seed,
// per-class summary lines, and a policy that stays pure and deterministic. Balance numbers are R6; here nothing may be unwinnable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "../src/core/index.js";
import { runOne, classLine } from "../bot/run-headless.mjs";

test("each class clears floors 1 to 3 on fixed seeds within the tick budget with no stuck events, and the run is deterministic", () => {
  for (const c of content.classes) for (const seed of [2, 5]) {
    const a = runOne(seed, 60000, { depth: 3, respawn: true, class: c.id });
    assert.equal(a.result, "cleared", `${c.id} seed ${seed}: ${a.result}`);
    assert.equal(a.depth, 3); assert.ok(a.level >= 2); assert.equal(a.stuck, 0, `${c.id} stuck`);
    if (seed === 2) assert.deepEqual(runOne(seed, 60000, { depth: 3, respawn: true, class: c.id }), a, `${c.id} is deterministic`);
  }
});

test("each class reaches the boss and wins on seed 1 (nothing is unwinnable); the per-class line reports wins, median minutes and deaths", () => {
  const lines = {};
  for (const c of content.classes) {
    const r = runOne(1, 200000, { depth: 9, respawn: true, maxDeaths: 12, class: c.id });
    assert.equal(r.result, "won", `${c.id}: ${r.result} at depth ${r.depth}, level ${r.level}`);
    lines[c.id] = classLine([r]);
    assert.equal(lines[c.id].won, 1);
    assert.ok(lines[c.id].medianWinMin > 5 && lines[c.id].medianWinMin < 120, `${c.id}: ${lines[c.id].medianWinMin} minutes`);
  }
  assert.equal(Object.keys(lines).length, 3);
});

test("classLine: wins, median clear time (minutes of game time), median deaths and level over a set of runs", () => {
  const runs = [{ result: "won", ticks: 3600 * 20, deaths: 1, level: 14 }, { result: "won", ticks: 3600 * 30, deaths: 3, level: 15 }, { result: "died", ticks: 100, deaths: 5, level: 9 }];
  assert.deepEqual(classLine(runs), { runs: 3, won: 2, medianWinMin: 25, medianDeaths: 3, medianLevel: 14 });
  assert.deepEqual(classLine([]), { runs: 0, won: 0, medianWinMin: null, medianDeaths: null, medianLevel: null });
});
