// R7-0.4 bot quest paths: AC-R-256-2 (the headless bot finishes main + three side quests on fixed seeds, inside the 20-40 minute window, public inputs only),
// AC-R-241-2 (steps 1..6 complete in order on the normal path), AC-R-246-3 (quest item through the pouch), AC-R-247-3 (bagFull: sell or stash, retry).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, content, makeItem, config } from "../src/core/index.js";
import { mint } from "../src/core/systems/loot.js";
import { autoplace } from "../src/core/items/inventory.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { runOne } from "../bot/run-headless.mjs";
import { parity } from "../bot/parity.mjs";

const drive = (s, mem, ticks, until) => {
  for (let i = 0; i < ticks && !until(s); i++) {
    if (i % BOT.decideEvery === 0) { const c = decide(s, mem); if (c) noteResult(mem, c, applyInput(s, c)); }
    step(s);
  }
  return s;
};
const SEEDS = [1, 2, 3];

test("AC-R-256-2 Lobby: before the first descent the bot has accepted all three side quests by talking to their givers", () => {
  const s = newGame(1, { start: "town" }), mem = createBotMemory({ depth: 9 });
  drive(s, mem, 6000, (x) => x.depth > 0);
  assert.ok(s.depth > 0, "the bot took the elevator");
  for (const id of content.sideIds) assert.equal(s.quests[id].s, "active", id);
  assert.ok(s.quests.main.m.memo, "the memo is reported as read");
});

test("AC-R-247-3 bagFull: a bag full of gear is sold, the hand-in is retried and completes", () => {
  const s = newGame(2, { start: "town" }), mem = createBotMemory({ depth: 9 });
  s.quests.sq2 = { s: "ready", p: 1 }; s.player.pouch.push({ id: "qi-sq2", quest: "sq2" });
  s.quests.sq1 = { s: "completed", p: 8 }; s.quests.sq3 = { s: "completed", p: 1 };
  s.inventory.items = [];
  for (let i = 0; i < 40; i++) { const it = mint(s, makeItem("hole-punch-hammer")); if (!autoplace(s.inventory, it)) break; mem.noEquip.add(it.id); }
  assert.ok(s.inventory.items.length > 3);
  drive(s, mem, 6000, (x) => x.quests.sq2.s === "completed" || x.depth > 0);
  assert.ok(mem.q.bagFullRounds >= 1, "the first hand-in was refused with bagFull");
  assert.equal(s.quests.sq2.s, "completed");
  assert.equal(s.player.pouch.length, 0);
});

test("AC-R-247-3 bagFull: a bag with no gear in it is emptied into the stash, then the hand-in completes", () => {
  const s = newGame(3, { start: "town" }), mem = createBotMemory({ depth: 9 });
  s.quests.sq1 = { s: "completed", p: 8 }; s.quests.sq2 = { s: "completed", p: 1 }; s.quests.sq3 = { s: "ready", p: 1 };
  s.inventory.items = [];
  for (let i = 0; i < 80; i++) { if (!autoplace(s.inventory, mint(s, makeItem("lukewarm-coffee")))) break; }
  s.belt = s.belt.map(() => null);
  drive(s, mem, 9000, (x) => x.quests.sq3.s === "completed" || x.depth > 0);
  assert.ok(mem.q.bagFullRounds >= 1, "the first hand-in was refused with bagFull");
  assert.equal(s.quests.sq3.s, "completed");
  assert.ok(s.stash.items.length > 0, "something went to the stash");
});

for (const cls of content.classes.map((c) => c.id)) {
  test(`AC-R-256-2 AC-R-241-2 ${cls}: seeds ${SEEDS} finish main and sq1..sq3 headlessly, steps in order, 20-40 min, no watchdog give-up`, () => {
    const runs = SEEDS.map((seed) => runOne(seed, 150000, { depth: 9, respawn: true, maxDeaths: 12, class: cls }));
    for (const r of runs) {
      assert.equal(r.result, "won", `${cls} seed ${r.seed}: ${r.result}`);
      assert.ok(r.quests.all, `${cls} seed ${r.seed}: completed ${r.quests.done}, gave up ${r.quests.gaveUp}`);
      assert.deepEqual(r.quests.mainSteps, [2, 3, 4, 5, 6, 7], `${cls} seed ${r.seed}: main steps ${r.quests.mainSteps}`);
      const min = r.ticks / (config.tickHz ?? 60) / 60;
      assert.ok(min >= 20 && min <= 40, `${cls} seed ${r.seed}: ${min.toFixed(1)} min`);
      assert.equal(r.watchdogFired, 0, `${cls} seed ${r.seed}: watchdog`);
    }
    const p = parity({ [cls]: runs });
    assert.equal(p.rows[cls].quests.all, SEEDS.length);
    assert.ok(p.rows[cls].quests.medianTripMin > 0 || runs.every((r) => r.quests.trips === 0));
  });
}
