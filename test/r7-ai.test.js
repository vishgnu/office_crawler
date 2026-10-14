// R7-1 / R7-3 (AI-R7): a held target that cannot be reached must not freeze the hero while another monster hits it; the bot watchdog must not count a trip through the Lobby as a stall.
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, newGame, step, applyInput } from "../src/core/index.js";
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
  run(s, config.retargetTicks + config.noticeTicks + 120);
  assert.notEqual(s.player.target, t.id, "the target moved on to something in reach");
  assert.ok(a.hp < a.hpMax || a.ai === "dead", "the adjacent attacker was hit");
});

test("R7-3 the hero keeps its target while it is still walking towards it (no early retarget)", () => {
  const s = gameOn(["################", "#@.............#", "################"], [["temp-worker", 13, 1]]);
  s.player.hp = s.player.hpMax = 100000;
  const t = s.monsters[0];
  applyInput(s, { t: "attack", id: t.id });
  run(s, config.retargetTicks * 2);
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
  assert.ok(worst < 600, `idle with a held target for ${worst} ticks`);
});

test("R7-1 the bot watchdog restarts after a trip through the Lobby (a death and shopping are not a minute without xp)", () => {
  const s = newGame(1, { start: "town" }), mem = createBotMemory();
  Object.assign(mem, { depth: 8, prog: { xp: 5, depth: 8, t: 0 } });
  decide(s, mem);
  assert.equal(mem.prog, null);
});
