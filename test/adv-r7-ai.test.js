// ADV-R7 round 7, AI fixes (test-engineer, adversarial mode): the hero's retarget of an adjacent attacker, the hold timeout, the bot watchdog reset.
// Written without reading the implementers' tests. Defects are `{ todo: 'ADV-R7-NN' }`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, step, applyInput } from "../src/core/index.js";
import { runOne } from "../bot/run-headless.mjs";
import { gameOn, OPEN, run } from "./helpers.js";

// A dead-end pocket: the hero stands on (3,4); the only way to it is the corridor (3,5) <- (3,6). Two zombie interns queue in it.
const POCKET = [
  "#######",
  "#.....#",
  "#.###.#",
  "#.#.#.#",
  "#.#@#.#",
  "###.###",
  "#.....#",
  "#######",
];
const pocket = (seed = 3) => gameOn(POCKET, [["zombie-intern", 3, 6], ["zombie-intern", 3, 5]], seed);

test("[R7-ai] a hero holding a target behind its attacker does not strike before retargetTicks, then answers the attacker, then does not oscillate", () => {
  const s = pocket(), p = s.player, far = s.monsters[0].id, nearM = s.monsters[1], near = nearM.id;
  applyInput(s, { t: "attack", id: far });
  const targets = [];
  let firstSwing = null;
  for (let i = 0; i < 600; i++) {
    step(s);
    if (targets.at(-1) !== p.target) targets.push(p.target);
    if (firstSwing === null && p.target === near && p.action === "attack") firstSwing = i;
  }
  assert.ok(firstSwing !== null, "the hero eventually strikes the attacker in reach");
  assert.ok(firstSwing >= config.retargetTicks - 5, `not earlier than retargetTicks (${config.retargetTicks}): first swing at ${firstSwing}`);
  assert.ok(firstSwing <= config.retargetTicks + config.holdMaxTicks, `and not much later: ${firstSwing}`);
  assert.ok(targets.length <= 4, `no oscillation between targets: ${JSON.stringify(targets)}`);
  assert.equal(nearM.ai, "dead", "the attacker is dead");
});

test("[R7-ai] a target that is in reach is never swapped for another monster (both adjacent, 400 ticks)", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4], ["zombie-intern", 8, 4]], 4), p = s.player, first = s.monsters[0];
  applyInput(s, { t: "attack", id: "m1" });
  const seen = new Set();
  for (let i = 0; i < 400 && first.ai !== "dead"; i++) { step(s); if (first.ai !== "dead") seen.add(p.target); }
  assert.deepEqual([...seen], ["m1"], "the hero stays on the clicked target until it dies");
});

test("[R7-ai] a ground click while holding wins at once: the target is dropped, the hero walks, and the retarget rule does not take the order back", () => {
  const s = pocket(), p = s.player;
  applyInput(s, { t: "attack", id: s.monsters[0].id });
  run(s, 90); // standing long enough for the retarget rule to be armed
  const res = applyInput(s, { t: "moveTo", tile: { x: 3, y: 3 } });
  assert.equal(res.ok, true);
  assert.equal(p.target, null);
  run(s, 30);
  assert.deepEqual(p.tile, { x: 3, y: 3 }, "the hero went where the player clicked");
  assert.equal(p.target, null, "and no monster was picked as a target on the way");
});

test("[R7-ai] an explicit click on another monster while holding wins: the new target is kept, not replaced by the nearest attacker", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4], ["zombie-intern", 12, 4], ["zombie-intern", 3, 4]], 5), p = s.player;
  applyInput(s, { t: "attack", id: "m1" });
  run(s, 20);
  applyInput(s, { t: "attack", id: "m3" });
  run(s, 3);
  assert.equal(p.target, "m3");
});

test("[R7-ai] the retarget never picks a dead, sleeping or out-of-reach monster", () => {
  // the target is behind the attacker; a sleeping zombie stands two tiles away and a dead one lies adjacent: only the awake attacker in reach is eligible
  const s = pocket(), p = s.player;
  applyInput(s, { t: "attack", id: s.monsters[0].id });
  run(s, config.retargetTicks + 30);
  assert.equal(p.target, s.monsters[1].id);
});

test("[R7-ai] hold timeout: with the retarget switched off, a hero never waits longer than holdMaxTicks for a chaser that does not arrive", () => {
  const keep = { r: config.retargetTicks, h: config.holdMaxTicks };
  try {
    config.retargetTicks = 1e9;
    const s = pocket(), p = s.player;
    applyInput(s, { t: "attack", id: s.monsters[0].id });
    const [a, b] = s.monsters;
    let moved = false;
    for (let i = 0; i < 400 && !moved; i++) { step(s); if (p.next || p.action === "walk" || p.path.length) moved = true; }
    // the pocket has no free tile to walk to: planning fails and the hero drops the target rather than freezing on it for ever
    assert.ok(moved || p.target === null || a.ai === "dead" || b.ai === "dead", "the hold ends by itself");
  } finally { config.retargetTicks = keep.r; config.holdMaxTicks = keep.h; }
});

test("[R7-ai] the retarget cannot be used to make the hero ignore a ranged attacker for ever: stand-still ticks reset when the hero walks", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4]], 6), p = s.player, z = s.monsters[0];
  applyInput(s, { t: "attack", id: "m1" });
  let maxStand = 0;
  for (let i = 0; i < 600; i++) { step(s); maxStand = Math.max(maxStand, p.standT ?? 0); if (z.ai === "dead") break; }
  assert.ok(maxStand < config.holdMaxTicks, `standT stayed below holdMaxTicks in the open: ${maxStand}`);
});

// ---------------------------------------------------------------------------------------------------- bot watchdog reset (R7-1)
test("[R7-bot] the watchdog never writes monsters off across a death and a Lobby trip: the seed that gave up before (IT Wizard 24) and two more, whole runs", () => {
  for (const [cls, seed] of [["it-wizard", 24], ["facilities-manager", 5], ["sales-rep", 9]]) {
    const r = runOne(seed, 400000, { depth: 9, respawn: true, maxDeaths: 12, class: cls });
    assert.equal(r.watchdogFired, 0, `${cls} seed ${seed}: watchdog gave up ${JSON.stringify(r.watchdogLog)}`);
    assert.equal(r.result, "won", `${cls} seed ${seed}: ${r.result}`);
  }
});

// ---------------------------------------------------------------------------------------------------- claims of the AI report
import { readFileSync } from "node:fs";
import { hashState } from "../src/core/index.js";
import { replay } from "./helpers.js";
test("[R7-ai] the recorded golden runs play identically with the new AI rules switched off: the re-pin was only the new standT field (3 classes)", () => {
  const script = JSON.parse(readFileSync(new URL("./fixtures/run-a.json", import.meta.url), "utf8"));
  const keep = { r: config.retargetTicks, h: config.holdMaxTicks };
  try {
    for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) {
      const on = hashState(replay(script, { class: cls }));
      config.retargetTicks = 1e9; config.holdMaxTicks = 1e9;
      const off = hashState(replay(script, { class: cls }));
      config.retargetTicks = keep.r; config.holdMaxTicks = keep.h;
      assert.equal(on, off, `${cls}: the golden run never reaches the new rules`);
    }
  } finally { config.retargetTicks = keep.r; config.holdMaxTicks = keep.h; }
});

// ADV-R7-03 (fixed): the bot leaves the badge (sq2) behind; since R7-4 AC-R-259-3 asks for all eight quests: main, main2, main3 and sq1..sq5.
test("[R7-bot] ADV-R7-03 every run completes all eight quests (AC-R-256-2 and AC-R-259-3 as amended): Sales Rep seed 104 in the runOne setup", () => {
  const r = runOne(104, 400000, { depth: 9, respawn: true, maxDeaths: 12, class: "sales-rep" });
  assert.equal(r.quests.all, true, `quests done: ${r.quests.done.join("+")} (trips ${r.quests.trips})`);
  assert.deepEqual(["main", "main2", "main3", "sq1", "sq2", "sq3", "sq4", "sq5"].filter((id) => !r.quests.done.includes(id)), [], "all eight");
  assert.ok(r.quests.trips <= 2, `at most two Lobby trips: ${r.quests.trips}`);
});

// ADV-R7-10: on 15 of 1000 seeds floors 5 and 6 hold fewer than 6 consultants (seed 102: 3 + 2, seed 105: 0 + 2), so sq5 can never be completed and the bot (and a player) ends the run with it open.
test("[R7-bot] ADV-R7-10 every run completes all eight quests: Sales Rep seed 102 (floors 5 and 6 spawn 5 consultants, sq5 asks for 6)", () => {
  const r = runOne(102, 400000, { depth: 9, respawn: true, maxDeaths: 12, class: "sales-rep" });
  assert.equal(r.quests.all, true, `quests done: ${r.quests.done.join("+")}`);
});
