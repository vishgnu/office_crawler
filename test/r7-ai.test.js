// R7-1 / R7-3 (AI-R7): a held target that cannot be reached must not freeze the hero while another monster hits it; the bot watchdog must not count a trip through the Lobby as a stall.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config } from "../src/core/index.js";
import { createBotMemory, decide } from "../bot/policy.js";
import { gameOn, run } from "./helpers.js";

// The hero stands in a one-tile gap. T is diagonal to it across a wall corner (not in melee reach); the only tile T could attack from is taken by A.
const GAP = [
  "######",
  "#.....",
  "##@###",
  "######",
];

function staged() {
  const s = gameOn(GAP, [["temp-worker", 2, 1], ["temp-worker", 3, 1]]);
  s.player.hp = s.player.hpMax = 100000;
  const [a, t] = s.monsters;
  return { s, a, t };
}

test("R7-3 a standing hero holding an unreachable target strikes the adjacent attacker after retargetTicks", () => {
  const { s, a, t } = staged();
  assert.equal(applyInput(s, { t: "attack", id: t.id }).ok, true);
  run(s, 200); // retargetTicks (60) + notice + a few swings
  assert.notEqual(s.player.target, t.id, "the target moved on to something in reach");
  assert.ok(a.hp < a.hpMax || a.ai === "dead", "the adjacent attacker was hit");
});

test("R7-3 the hero keeps its target while it is still walking towards it (no early retarget)", () => {
  const s = gameOn(["################", "#@.............#", "################"], [["temp-worker", 13, 1]]);
  s.player.hp = s.player.hpMax = 100000;
  const t = s.monsters[0];
  applyInput(s, { t: "attack", id: t.id });
  run(s, 120);
  assert.equal(s.player.target === t.id || t.ai === "dead", true);
});

test("R7-3 floor 1 seed 5 (Facilities Manager, nearest-monster clicker): the hero never idles on a held target for 10 s", () => {
  const s = newGame(5, { class: "facilities-manager" });
  let idle = 0, worst = 0;
  for (let i = 0; i < 2600 && s.scene === "floor"; i++) {
    const p = s.player;
    if (p.hp < p.hpMax * 0.4) applyInput(s, { t: "useBelt", index: 0 });
    if (i % 6 === 0 && !p.target) {
      let b = null, bd = 1e9;
      for (const m of s.monsters) { if (m.ai === "dead") continue; const d = Math.hypot(m.tile.x - p.tile.x, m.tile.y - p.tile.y); if (d < bd) { bd = d; b = m; } }
      if (b) applyInput(s, { t: "click", tile: b.tile, button: 0 });
    }
    step(s);
    idle = s.player.action === "idle" && s.player.target && !s.player.next ? idle + 1 : 0;
    worst = Math.max(worst, idle);
  }
  assert.ok(worst < 200, `idle with a held target for ${worst} ticks`);
});

// CR7-03. A chaser that is slow enough never to arrive (speed 0.01) with nothing else in reach: only holdMaxTicks can end the wait.
const WALLED = ["#######", "#.....#", "#@.#T.#", "#.....#", "#######"];
function slowChaser() {
  const s = gameOn(WALLED, [["temp-worker", 4, 2]]);
  s.player.tile = { x: 2, y: 2 }; s.player.hp = s.player.hpMax = 100000;
  const t = s.monsters[0]; t.speed = 0.01; t.ai = "chase";
  assert.equal(applyInput(s, { t: "attack", id: t.id }).ok, true);
  return { s, t };
}
const adjacent = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;

test("CR7-03 holdMaxTicks alone: with no attacker to answer the hero stops waiting and walks to the target, and the hold does not come back after one step", () => {
  const { s, t } = slowChaser();
  run(s, config.holdMaxTicks - 20);
  assert.deepEqual(s.player.tile, { x: 2, y: 1 }, "still holding, one step from the start");
  run(s, 20 + config.ai.repathTicks + 60); // the wait ends, then a path of three steps; a hold that re-engaged after each step would add 120 ticks per step
  assert.ok(adjacent(s.player.tile, t.tile) || t.ai === "dead", `the hero reached the target (at ${JSON.stringify(s.player.tile)})`);
});

test("CR7-03 the same stage with the wait never ending (holdMaxTicks 1e9) leaves the hero standing: the new test can fail", () => {
  const saved = config.holdMaxTicks;
  try {
    config.holdMaxTicks = 1e9;
    const { s } = slowChaser();
    run(s, 400);
    assert.equal(s.player.tile.x <= 2, true, "never left the holding place");
  } finally { config.holdMaxTicks = saved; }
});

test("CR7-03 / R8-AI1 a fresh click is never replaced on its first tick; a hero that already stands blocked keeps its count across a re-click and answers within retargetEvery planned ticks", () => {
  const { s, a, t } = staged();
  applyInput(s, { t: "attack", id: t.id });
  run(s, config.retargetTicks - 1);
  assert.equal(s.player.target, t.id, "not yet");
  applyInput(s, { t: "attack", id: t.id }); // the player clicks the same target again
  assert.ok(s.player.standT >= config.retargetTicks - 2, "R8-AI1: the stand count is carried, not reset (the hero has not moved)");
  // ADV-R8-03 (fix round): a re-click of the SAME target keeps p.goal (it is not a new order), so the hero that already stands blocked answers within retargetEvery ticks
  // even when the player clicks every tick; a click on a NEW target still starts from goal = null (the first half of this test and the 'new target' test in adv-r8-ai).
  run(s, config.retargetEvery + 2);
  assert.notEqual(s.player.target, t.id, "and the attacker in reach is answered right after");
  assert.ok(a.hp <= a.hpMax);
});

test("CR7-03 a held mouse button is not replaced (the player is still ordering)", () => {
  const { s, t } = staged();
  applyInput(s, { t: "attack", id: t.id });
  s.input.mouse.down = true;
  run(s, config.retargetTicks + 60);
  assert.equal(s.player.target, t.id);
});

test("R7-1 the bot watchdog restarts after a trip through the Lobby (a death and shopping are not a minute without xp)", () => {
  const s = newGame(1, { start: "town" }), mem = createBotMemory();
  Object.assign(mem, { depth: 8, prog: { xp: 5, depth: 8, t: 0 } });
  decide(s, mem);
  assert.equal(mem.prog, null);
});
