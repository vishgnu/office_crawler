import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, config, hitChance, step, applyInput, cloneState, content } from "../src/core/index.js";
import { rollSwing } from "../src/core/systems/combat.js";
import { gameOn, run, OPEN } from "./helpers.js";

const IN_REACH = [["zombie-intern", 10, 4]]; // right next to the player start at 9,4

// Make a fixture fight long and survivable so timing can be observed.
function arena(monsters = IN_REACH) {
  const s = gameOn(OPEN, monsters);
  s.player.hp = s.player.hpMax = 100000;
  for (const m of s.monsters) m.hp = m.hpMax = 100000;
  return s;
}
const playerSwings = (s) => s.events.filter((e) => e.source === "player" && (e.type === "hit" || e.type === "miss"));

test("AC-R-021-2 hit rate matches hitChance within 2 percentage points over 10,000 swings", () => {
  const att = { level: 3, attackRating: 40 }, def = { level: 2, defense: 15 };
  const rng = createRng(5);
  let hits = 0;
  for (let i = 0; i < 10000; i++) if (rollSwing(rng, att, def, { min: 1, max: 2 }).hit) hits++;
  assert.ok(Math.abs(hits / 10000 - hitChance(att, def)) < 0.02);
});

test("AC-R-021-3 hit chance is monotonic and stays inside the config bounds", () => {
  let last = 0;
  for (let ar = 1; ar < 300; ar += 7) {
    const c = hitChance({ level: 1, attackRating: ar }, { level: 1, defense: 20 });
    assert.ok(c >= last); last = c;
  }
  last = 0;
  for (let level = 1; level < 40; level++) {
    const c = hitChance({ level, attackRating: 30 }, { level: 5, defense: 20 });
    assert.ok(c >= last); last = c;
  }
  last = 1;
  for (let d = 0; d < 300; d += 7) {
    const c = hitChance({ level: 1, attackRating: 30 }, { level: 1, defense: d });
    assert.ok(c <= last); last = c;
  }
  for (const [a, d] of [[0, 0], [1, 1000], [1000, 1], [1000, 0]]) {
    const c = hitChance({ level: 1, attackRating: a }, { level: 1, defense: d });
    assert.ok(c >= config.hitChanceMin && c <= config.hitChanceMax);
  }
});

test("AC-R-021-4 damage is an integer in [lo+b, hi+b], both ends reached", () => {
  const rng = createRng(11), seen = new Set();
  for (let i = 0; i < 10000; i++) {
    const r = rollSwing(rng, { level: 1, attackRating: 500 }, { level: 1, defense: 0 }, { min: 3, max: 6 }, 2);
    if (!r.hit) continue;
    assert.ok(Number.isInteger(r.damage) && r.damage >= 5 && r.damage <= 8);
    seen.add(r.damage);
  }
  assert.ok(seen.has(5) && seen.has(8));
});

test("AC-R-021-4 the monster loses exactly the damage of each hit, never below 0", () => {
  const s = arena();
  const m = s.monsters[0];
  applyInput(s, { t: "attack", id: m.id });
  let hits = 0;
  for (let i = 0; i < 600; i++) {
    const before = m.hp;
    step(s);
    for (const e of s.events) if (e.type === "hit" && e.source === "player") { hits++; assert.equal(before - m.hp, e.value); assert.ok(e.value >= s.player.damage.min && e.value <= Math.ceil(s.player.damage.max * (e.crit ? s.player.mods.critDamage / 100 : 1))); }
  }
  assert.ok(hits > 5);
});

test("AC-R-021-1 a swing lasts attackTicks, resolves once on attackHitTick, then returns to idle", () => {
  const s = arena();
  applyInput(s, { t: "attack", id: s.monsters[0].id });
  let guard = 0;
  while (s.player.action !== "attack" && guard++ < 50) step(s);
  assert.equal(s.player.action, "attack");
  let ticksInAttack = 1, resolved = [];
  if (playerSwings(s).length) resolved.push(1);
  for (;;) {
    step(s);
    if (s.player.action !== "attack") break;
    ticksInAttack++;
    if (playerSwings(s).length) resolved.push(ticksInAttack);
  }
  assert.equal(ticksInAttack, config.attackTicks);
  assert.deepEqual(resolved, [config.attackHitTick]);
  assert.equal(s.player.action, "idle");
});

test("AC-R-021-5 a lethal hit leaves hp 0, ai dead, one kill event, target cleared next tick", () => {
  const s = arena();
  const m = s.monsters[0];
  m.hp = 1;
  applyInput(s, { t: "attack", id: m.id });
  let kills = 0, killTick = -1;
  for (let i = 0; i < 400 && killTick < 0; i++) {
    step(s);
    const k = s.events.filter((e) => e.type === "kill");
    kills += k.length;
    if (k.length) { killTick = s.tick; assert.equal(k[0].target, m.id); }
  }
  assert.ok(killTick > 0, "never killed");
  assert.equal(m.hp, 0);
  assert.equal(m.ai, "dead");
  step(s);
  assert.equal(s.player.target, null);
  run(s, 200);
  assert.equal(s.eventLog.filter((e) => e.type === "kill").length, 1);
  assert.equal(kills, 1);
  assert.equal(s.player.xp, Math.round(content.monsters["zombie-intern"].xp * (config.xpMult?.[s.depth - 1] ?? 1))); // R8-BAL: floor xp multiplier
});

test("AC-R-021-6 a dead monster does nothing and cannot be targeted", () => {
  const s = arena();
  const m = s.monsters[0];
  m.hp = 1;
  applyInput(s, { t: "attack", id: m.id });
  while (m.ai !== "dead") step(s);
  const tile = { ...m.tile };
  const hpBefore = s.player.hp;
  for (let i = 0; i < 100; i++) {
    step(s);
    assert.ok(!s.events.some((e) => e.source === m.id));
  }
  assert.deepEqual(m.tile, tile); // it may already have been removed from the list; the tile object is unchanged
  assert.equal(s.player.hp >= hpBefore, true);
  assert.equal(applyInput(s, { t: "attack", id: m.id }).ok, false);
});

test("AC-R-021-7 a miss leaves the monster's hp unchanged", () => {
  const s = arena();
  const m = s.monsters[0];
  applyInput(s, { t: "attack", id: m.id });
  let misses = 0;
  for (let i = 0; i < 3000; i++) {
    const before = m.hp;
    step(s);
    if (s.events.some((e) => e.type === "miss" && e.source === "player")) {
      misses++;
      assert.equal(m.hp, before);
      assert.ok(!s.events.some((e) => e.type === "hit" && e.source === "player"));
    }
  }
  assert.ok(misses > 0, "no miss seen");
});

test("AC-R-021-8 no hit resolution while the target is out of melee range", () => {
  const s = gameOn(OPEN, [["zombie-intern", 1, 1]]);
  s.player.hp = s.player.hpMax = 100000;
  s.monsters[0].hp = s.monsters[0].hpMax = 100000;
  s.monsters[0].ai = "idle"; // far from the player; let the player come to it
  applyInput(s, { t: "attack", id: s.monsters[0].id });
  const m = s.monsters[0];
  for (let i = 0; i < 300; i++) {
    step(s);
    if (playerSwings(s).length) {
      assert.ok(Math.max(Math.abs(s.player.tile.x - m.tile.x), Math.abs(s.player.tile.y - m.tile.y)) <= config.meleeRange);
    }
    if (i < 20) assert.equal(playerSwings(s).length, 0);
  }
});

test("AC-R-020-1 an adjacent monster attacks without any player input", () => {
  const s = gameOn(OPEN, IN_REACH);
  const id = s.monsters[0].id;
  let attacked = false;
  for (let i = 0; i < config.attackTicks + config.monsterAttackTicks; i++) {
    step(s);
    if (s.events.some((e) => e.source === id && (e.type === "hit" || e.type === "miss"))) attacked = true;
  }
  assert.ok(attacked);
});

test("AC-R-020-2 two monsters act in a fixed order: two runs agree event for event", () => {
  const a = gameOn(OPEN, [["zombie-intern", 10, 4], ["printer-imp", 8, 4]]);
  const b = gameOn(OPEN, [["zombie-intern", 10, 4], ["printer-imp", 8, 4]]);
  run(a, 400); run(b, 400);
  assert.deepEqual(a.eventLog, b.eventLog);
  assert.ok(a.eventLog.length > 0);
  const order = a.eventLog.filter((e) => e.source?.startsWith("m")).map((e) => e.source);
  assert.ok(order.length > 0);
});

test("AC-R-023-1 a lethal blow sets hp 0, action dead and scene dead on the same tick", () => {
  const s = gameOn(OPEN, IN_REACH);
  s.player.hp = 1;
  let died = false;
  for (let i = 0; i < 400 && !died; i++) {
    step(s);
    assert.ok(s.player.hp >= 0 && s.player.hp <= s.player.hpMax);
    if (s.events.some((e) => e.type === "hit" && e.target === "player")) {
      died = true;
      assert.equal(s.player.hp, 0);
      assert.equal(s.player.action, "dead");
      assert.equal(s.scene, "dead");
    }
  }
  assert.ok(died);
});

test("AC-R-005-2 clicking a monster targets it and damages or kills it within 200 ticks", () => {
  const s = gameOn(OPEN, [["printer-imp", 15, 6]]);
  const m = s.monsters[0], hp = m.hp;
  applyInput(s, { t: "click", tile: m.tile, button: 0 });
  assert.equal(s.player.target, m.id);
  run(s, 200);
  assert.ok(m.hp < hp || m.ai === "dead");
});

test("cloneState keeps the fight reproducible", () => {
  const s = arena();
  run(s, 50);
  const c = cloneState(s);
  run(s, 200); run(c, 200);
  assert.deepEqual(s, c);
});
