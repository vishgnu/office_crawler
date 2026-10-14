// R6-1 balance gate (circle-02 Q7 option A, short horizon): the careful bot on three fixed seeds per class must clear floor 4 and reach level 6 within
// 45 000 ticks (12.5 game minutes) with at most 3 deaths, and the three classes' median times must sit within 25 % of their common median. The whole-run
// parity table (8+ seeds, boss, damage share per skill) is `node bot/parity.mjs`; its numbers are in docs/reviews/R6-balance.md. Bounded by ticks, not wall clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "../src/core/index.js";
import { runOne } from "../bot/run-headless.mjs";

const SEEDS = [1, 2, 3], DEPTH = 4, LEVEL = 6, TICKS = 45000, DEATHS = 3, BAND = 0.25;
const median = (a) => [...a].sort((x, y) => x - y)[(a.length - 1) >> 1];

test(`each class clears floor ${DEPTH} and reaches level ${LEVEL} within ${TICKS} ticks on seeds ${SEEDS}, and the classes stay within ${BAND * 100} % of each other`, () => {
  const med = {};
  for (const c of content.classes) {
    const times = [];
    for (const seed of SEEDS) {
      const r = runOne(seed, TICKS, { depth: DEPTH, respawn: true, maxDeaths: DEATHS, class: c.id });
      assert.equal(r.result, "cleared", `${c.id} seed ${seed}: ${r.result} at depth ${r.depth}, level ${r.level}, tick ${r.ticks}`);
      assert.ok(r.depth >= DEPTH && r.level >= LEVEL, `${c.id} seed ${seed}: depth ${r.depth}, level ${r.level}`);
      assert.ok(r.deaths <= DEATHS, `${c.id} seed ${seed}: ${r.deaths} deaths`);
      assert.equal(r.stuck, 0, `${c.id} seed ${seed}: stuck events`);
      times.push(r.ticks);
    }
    med[c.id] = median(times);
  }
  const all = median(Object.values(med));
  for (const [id, m] of Object.entries(med)) assert.ok(Math.abs(m - all) / all <= BAND, `${id}: median ${m} ticks vs three-class median ${all}`);
});
