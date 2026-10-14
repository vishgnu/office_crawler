// CR6-05: the bot's no-xp watchdog has its own counter, the parity report shows every give-up and goes red above the limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parity, print, WATCHDOG_MAX } from "../bot/parity.mjs";
import { createBotMemory } from "../bot/policy.js";
import { summarise } from "../bot/report.js";

const run = (seed, watchdogFired) => ({ seed, result: "won", ticks: 90000, dmg: { zap: 10, "server-overheat": 10 }, deathDepths: [], deaths: 1, level: 20, watchdogFired, waitGaveUp: 5 });

test("memory has a watchdogFired counter apart from waitGaveUp, both start at 0", () => {
  const mem = createBotMemory({ id: "careful" });
  
  assert.equal(mem.watchdogFired, 0); assert.equal(mem.waitGaveUp, 0);
});

test("parity counts watchdog give-ups per class and seed, does not mix them with waitGaveUp, and is red above WATCHDOG_MAX", () => {
  const ok = parity({ a: [run(1, 0), run(2, WATCHDOG_MAX)], b: [run(1, 0)] });
  assert.equal(ok.watchdog, WATCHDOG_MAX); assert.equal(ok.watchdogOk, true);
  const bad = parity({ a: [run(1, 1), run(2, 2)], b: [run(11, 1)] });
  assert.equal(bad.watchdog, 4); assert.equal(bad.watchdogOk, false);
  assert.deepEqual(bad.rows.a.watchdogSeeds, ["1", "2x2"]);
  const text = print(bad, {});
  assert.match(text, /watchdog give-ups[^\n]*: 4 \(OVER THE LIMIT/); assert.match(text, /- a: 3 \(seeds 1, 2x2\)/);
  assert.equal(summarise([{ ...run(1, 2), ttk: [], kills: 1, stuck: 0, failedMoves: 0 }]).watchdogFired, 2);
});
