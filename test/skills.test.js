import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, applyInput, step, setLevel, learnSkill, deriveStats } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const evs = (s, type) => s.events.filter((e) => e.type === type);
const learn = (s, ...ids) => { setLevel(s, 10); for (const id of ids) learnSkill(s, id); return s; };

test("Coffee Break heals the hero (capped at hpMax) for the skill's heal value", () => {
  const s = learn(gameOn(OPEN), "coffee-break"), p = s.player;
  p.hp = 5;
  cmd(s, { t: "cast", skill: "coffee-break" });
  assert.equal(p.hp, 5 + content.skills["coffee-break"].heal(1));
  assert.equal(evs(s, "heal")[0].value, content.skills["coffee-break"].heal(1));
  p.hp = p.hpMax - 1; p.mp = p.mpMax;
  run(s, config.castTicks + 1);
  cmd(s, { t: "cast", skill: "coffee-break" });
  assert.equal(p.hp, p.hpMax);
});

test("Reply-All hits every monster in its radius in sight and none outside it; it pushes them back (AC-R-024-2)", () => {
  const s = learn(gameOn(OPEN, [["zombie-intern", 10, 4], ["zombie-intern", 9, 5], ["zombie-intern", 18, 4]]), "reply-all");
  for (const m of s.monsters) { m.ai = "idle"; m.hp = m.hpMax = 400; }
  const [a, b, far] = s.monsters;
  cmd(s, { t: "cast", skill: "reply-all", tile: { x: 9, y: 4 } });
  assert.ok(a.hp < 400 && b.hp < 400);
  assert.equal(far.hp, 400);
  assert.deepEqual(a.tile, { x: 11, y: 4 }); // one tile further from the hero
  assert.deepEqual(b.tile, { x: 9, y: 6 });
  assert.equal(evs(s, "burst").length, 1);
});

test("AC-R-024-2 knock-back into a wall does not move the monster", () => {
  const s = learn(gameOn(["#####", "#@..#", "#####"].map((r) => r.padEnd(5, "#")), [["zombie-intern", 2, 1]]), "reply-all");
  s.monsters[0].hp = s.monsters[0].hpMax = 400;
  s.monsters[0].tile = { x: 3, y: 1 };
  cmd(s, { t: "cast", skill: "reply-all", tile: { x: 3, y: 1 } });
  assert.deepEqual(s.monsters[0].tile, { x: 3, y: 1 });
});

test("Reply-All does not reach through walls", () => {
  const rows = ["##########", "#@.#.....#", "##########"];
  const s = learn(gameOn(rows, [["zombie-intern", 4, 1]]), "reply-all");
  const m = s.monsters[0]; m.hp = m.hpMax = 400; m.ai = "idle";
  cmd(s, { t: "cast", skill: "reply-all", tile: { x: 4, y: 1 } });
  assert.equal(m.hp, 400);
});

test("Mute silences monsters in range: no move, no attack, then they carry on", () => {
  const s = learn(gameOn(OPEN, [["zombie-intern", 10, 4]]), "mute");
  const m = s.monsters[0]; m.ai = "attack"; m.attackT = 0;
  const hp = s.player.hp, d = content.skills.mute.duration(1);
  cmd(s, { t: "cast", skill: "mute" });
  assert.equal(m.muteT, d);
  run(s, d - 1);
  assert.equal(s.player.hp, hp);
  assert.equal(m.attackT, 0);
  run(s, 3);
  assert.equal(m.muteT, 0);
  run(s, config.monsterAttackTicks + 2);
  assert.ok(m.attackT > 0 || s.eventLog.some((e) => e.source === m.id));
});

test("AC-R-024-1 a big hit staggers a monster: no attack and no move for hitRecoveryTicks", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  const m = s.monsters[0]; m.hp = m.hpMax = 100; m.ai = "attack"; m.attackT = 5;
  // a hit of exactly the threshold
  learn(s, "reply-all");
  s.player.damage = { min: 50, max: 50 };
  cmd(s, { t: "cast", skill: "reply-all" });
  assert.equal(m.ai, "stagger");
  const hp = s.player.hp, at = { ...m.tile };
  for (let i = 0; i < config.hitRecoveryTicks - 2; i++) { step(s); assert.equal(m.ai, "stagger"); }
  assert.equal(s.player.hp, hp);
  run(s, 3);
  assert.notEqual(m.ai, "stagger");
});

test("a small hit does not stagger", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  const m = s.monsters[0]; m.hp = m.hpMax = 100; m.ai = "attack";
  s.player.damage = { min: 1, max: 1 }; s.player.attackRating = 100000;
  cmd(s, { t: "attack", id: m.id });
  run(s, 60);
  assert.equal(m.ai, "attack");
});

test("AC-R-025-1/-2 a hit leaves a state floater with config.floaterTicks of life and flashes the monster; the dead body stays deathTicks", () => {
  const s = learn(gameOn(OPEN, [["zombie-intern", 10, 4]]), "reply-all");
  const m = s.monsters[0]; m.hp = m.hpMax = 400; m.ai = "idle";
  cmd(s, { t: "cast", skill: "reply-all" });
  const hit = evs(s, "hit")[0];
  assert.deepEqual(s.floaters.map((f) => [f.value, f.life]), [[hit.value, config.floaterTicks]]);
  assert.equal(m.flashTicks, config.flashTicks);
  run(s, config.floaterTicks);
  assert.equal(s.floaters.length, 0);
  m.hp = 1; s.player.mp = s.player.mpMax;
  cmd(s, { t: "cast", skill: "reply-all" });
  assert.equal(m.ai, "dead");
  run(s, config.deathTicks - 2);
  assert.ok(s.monsters.includes(m));
  run(s, 4);
  assert.ok(!s.monsters.includes(m));
});

test("casting stops walking and chasing and blocks movement for castTicks", () => {
  const s = learn(gameOn(OPEN), "coffee-break");
  cmd(s, { t: "moveTo", tile: { x: 15, y: 4 } });
  run(s, 3);
  cmd(s, { t: "cast", skill: "coffee-break" });
  const at = { ...s.player.tile };
  assert.equal(s.player.path.length, 0);
  run(s, 2);
  assert.equal(s.player.action, "cast");
  run(s, config.castTicks + 14);
  assert.equal(s.player.action, "idle");
});

test("right mouse with the basic attack selected attacks the monster under the cursor", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  cmd(s, { t: "assignSkill", slot: 0, id: "strike" });
  assert.equal(cmd(s, { t: "mouse", phase: "down", tile: { x: 12, y: 4 }, button: 2 }).ok, true);
  assert.equal(s.player.target, s.monsters[0].id);
  cmd(s, { t: "mouse", phase: "up", button: 2 });
});
