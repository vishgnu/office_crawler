import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, step } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test("AC-R-032-6 / QF-03-2 a canFlee monster below fleeHpFraction runs away: ai flee, distance grows over the next 10 ticks; others never flee", () => {
  const s = gameOn(OPEN, [["temp-worker", 11, 4], ["zombie-intern", 7, 4], ["middle-manager", 12, 6]]);
  const [t, z, mm] = s.monsters;
  for (const m of s.monsters) { m.ai = "chase"; }
  t.hp = Math.floor(t.hpMax * config.fleeHpFraction) - 1; if (t.hp < 1) t.hp = 1;
  z.hp = 1; mm.hp = 1;
  assert.ok(t.hp / t.hpMax < config.fleeHpFraction);
  step(s);
  assert.equal(t.ai, "flee");
  assert.notEqual(z.ai, "flee"); assert.notEqual(mm.ai, "flee");
  const d0 = dist(t.tile, s.player.tile);
  run(s, 10);
  assert.ok(dist(t.tile, s.player.tile) >= d0);
  run(s, 40);
  assert.ok(dist(t.tile, s.player.tile) > d0, "it got away");
  assert.equal(t.fled, true);
});

test("a fleeing monster returns to the fight after fleeTicks and does not flee a second time", () => {
  const s = gameOn(OPEN, [["temp-worker", 15, 4]]);
  const t = s.monsters[0]; t.ai = "chase"; t.hp = 1;
  step(s);
  assert.equal(t.ai, "flee");
  run(s, config.fleeTicks + 2);
  assert.notEqual(t.ai, "flee");
  run(s, 300);
  assert.notEqual(t.ai, "flee");
});

test("the elite brute hits harder and has far more health than the swarmers, yet moves slower than the hero", () => {
  const m = content.monsters;
  for (const id of ["middle-manager", "vending-machine", "auditor"]) {
    assert.equal(m[id].behaviour, "elite");
    assert.ok(m[id].hpBase >= 3 * m["zombie-intern"].hpBase);
    assert.ok(m[id].damage > m["zombie-intern"].damage);
    assert.ok(m[id].pack[1] === 1, "elites come alone");
  }
  assert.ok(m["middle-manager"].speed < 1);
});
