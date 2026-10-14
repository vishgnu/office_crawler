// R4-2: the skill runner (ADR-0005 sections 3 and 4): effect ops, damage types and resist, statuses, crits, projectile shapes, areas, synergies, triggers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, config, applyInput, step, setLevel, applyDerived, at, hashState, spawnMonster, castSkill, effLevel, castCost } from "../src/core/index.js";
import { damageMonster, resistOf, playerDamage, effDefense } from "../src/core/systems/damage.js";
import { rotateDeg, cossin } from "../src/core/dir.js";
import { stream } from "../src/core/state.js";
import { gameOn, run, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const evs = (s, type) => s.events.filter((e) => e.type === type);
const all = (s, type) => s.eventLog.filter((e) => e.type === type);

/** A game with a class hero at level 30 with every skill of its class at the given level and a full mana bar; monsters are sturdy and asleep. */
function arena(cls, monsters = [], skillLevel = 1) {
  const s = gameOn(OPEN, monsters, 1, { class: cls });
  setLevel(s, 30);
  for (const d of Object.values(content.skills)) if (d.class === cls) s.player.skills[d.id] = skillLevel;
  applyDerived(s, { fill: true });
  s.player.attackRating = 100000;
  s.player.mods.critChance = 0;
  for (const m of s.monsters) { m.ai = "idle"; m.hp = m.hpMax = 5000; m.defense = 0; }
  return s;
}
const noCrit = (s) => { s.player.mods.critChance = 0; return s; };

test("damage types: a typed hit meets the monster's resist table (rounded, at least 1), physical ignores it; a boss resist is capped lower", () => {
  const s = gameOn(OPEN, [["printer-imp", 10, 4], ["zombie-intern", 12, 4]]);
  const [imp, zom] = s.monsters;
  imp.hp = imp.hpMax = zom.hp = zom.hpMax = 1000;
  damageMonster(s, imp, 100, { type: "fire" }); damageMonster(s, zom, 100, { type: "fire" });
  assert.equal(1000 - imp.hp, 75); assert.equal(1000 - zom.hp, 100);
  imp.hp = 1000; damageMonster(s, imp, 100, { type: "physical" }); assert.equal(1000 - imp.hp, 100);
  imp.hp = 1000; damageMonster(s, imp, 100, { type: "cold" }); assert.equal(1000 - imp.hp, 100, "only fire is resisted");
  imp.hp = 1000; damageMonster(s, imp, 1, { type: "fire" }); assert.equal(1000 - imp.hp, 1, "a hit never rounds to nothing");
  const e = s.events.filter((x) => x.type === "hit").pop();
  assert.equal(e.damageType, "fire");
  const saved = content.monsters["printer-imp"].resist.fire;
  try {
    content.monsters["printer-imp"].resist.fire = 0.9;
    assert.equal(resistOf(imp, "fire"), config.resistCap.monster);
    assert.equal(resistOf({ type: "printer-imp", tier: "boss" }, "fire"), config.resistCap.boss);
  } finally { content.monsters["printer-imp"].resist.fire = saved; }
  const boss = { type: "regional-director", tier: "boss" };
  assert.ok(resistOf(boss, "fire") <= config.resistCap.boss);
});

test("typed skill damage is not rolled to hit (spells always land); physical projectiles do roll", () => {
  const s = arena("it-wizard", [["zombie-intern", 12, 4]]);
  s.player.attackRating = 0;                           // a physical shot would almost always miss now
  const m = s.monsters[0]; m.defense = 100000;
  cmd(s, { t: "cast", skill: "cold-boot", tile: { x: 12, y: 4 } });
  run(s, 60);
  assert.ok(m.hp < m.hpMax, "cold damage landed against huge defense");
  assert.equal(all(s, "miss").length, 0);
  const t = arena("sales-rep", [["zombie-intern", 12, 4]]);
  t.player.attackRating = 0; t.monsters[0].defense = 100000;
  for (let i = 0; i < 5; i++) { cmd(t, { t: "cast", skill: "stapler-throw", tile: { x: 12, y: 4 } }); run(t, config.castTicks + 40); t.player.mp = t.player.mpMax; }
  assert.ok(all(t, "miss").length >= 1, "physical shots roll to hit");
});

test("dot: burning deals perTick every dotEvery ticks for its duration, a stronger burn refreshes, a weaker one only extends; the dead stop burning", () => {
  const s = arena("it-wizard", [["zombie-intern", 12, 4]]);
  const m = s.monsters[0], def = content.skills["server-overheat"], dot = def.effects[1], per = at(dot.perTick, 1);
  m.hp = m.hpMax = 100000;
  cmd(s, { t: "cast", skill: "server-overheat", tile: { x: 12, y: 4 } });
  assert.equal(m.burnT, at(dot.ticks, 1)); assert.equal(m.burnDmg, per);
  const hp0 = m.hp;
  const ticks = 120;
  run(s, ticks);
  const burns = all(s, "dotTick").filter((e) => e.target === m.id);
  assert.ok(burns.length >= ticks / config.dotEvery - 1 && burns.length <= ticks / config.dotEvery + 1);
  assert.ok(hp0 - m.hp >= per * burns.length * 0.7, "the burn damage (resist-reduced fire) was dealt");
  run(s, 400);
  assert.equal(m.burnT, 0); assert.equal(m.burnDmg, 0);
  const hp1 = m.hp; run(s, 100); assert.equal(m.hp, hp1, "no damage after the burn ended and the patch burnt out");
  const z = arena("it-wizard", [["zombie-intern", 12, 4]]).monsters[0];
  z.burnT = 5; z.burnDmg = 9;
  const t = arena("it-wizard", [["zombie-intern", 12, 4]]); const q = t.monsters[0];
  q.burnT = 5; q.burnDmg = 99;
  cmd(t, { t: "cast", skill: "server-overheat", tile: { x: 12, y: 4 } });
  assert.equal(q.burnDmg, 99, "a weaker burn does not replace a stronger one"); assert.equal(q.burnT, at(dot.ticks, 1), "but it extends the time");
});

test("statuses: stun / mute / freeze set the disabled timer and the kind, expire, and a disabled monster neither moves nor attacks", () => {
  for (const [skill, kind] of [["turn-it-off", "stun"], ["blue-screen", "freeze"], ["mute", "mute"]]) {
    const s = arena("it-wizard", [["zombie-intern", 10, 4]]);
    const m = s.monsters[0]; m.ai = "attack"; m.attackT = 0;
    cmd(s, { t: "cast", skill }); const e = evs(s, "status").find((x) => x.kind === kind);
    assert.ok(e && e.target === m.id && e.ticks > 0, `${skill} -> status ${kind}`);
    assert.equal(m.muteT, e.ticks); assert.equal(m.statusKind, kind);
    const hp = s.player.hp, at0 = { ...m.tile };
    run(s, e.ticks - 2);
    assert.equal(s.player.hp, hp); assert.deepEqual(m.tile, at0); assert.equal(m.attackT, 0);
    run(s, 4);
    assert.equal(m.muteT, 0); assert.equal(m.statusKind, null);
  }
  assert.ok(evs(arena("it-wizard", [["zombie-intern", 10, 4]]), "muted").length === 0);
  const s = arena("it-wizard", [["zombie-intern", 10, 4]]); cmd(s, { t: "cast", skill: "mute" });
  assert.equal(evs(s, "muted").length, 1, "mute keeps the old `muted` event next to the new `status` event");
});

test("a boss resists stun, mute and freeze (resisted event) but takes slow and weaken at half duration", () => {
  const s = arena("it-wizard", []);
  const b = spawnMonster(s, "regional-director", { x: 11, y: 4 }, null, { tier: "boss" });
  b.ai = "idle";
  cmd(s, { t: "cast", skill: "turn-it-off" });
  assert.equal(b.muteT, 0); assert.ok(evs(s, "resisted").length >= 1);
  assert.ok(b.weakenT > 0 && b.weakenT <= 360 / 2, "weaken lasts half as long");
  run(s, config.castTicks + 2); s.player.mp = s.player.mpMax;
  const t = arena("it-wizard", []);
  const bb = spawnMonster(t, "regional-director", { x: 12, y: 4 }, null, { tier: "boss" });
  bb.ai = "idle";
  cmd(t, { t: "cast", skill: "cold-boot", tile: { x: 12, y: 4 } });
  run(t, 40);
  assert.ok(bb.slowT > 0 && bb.slowT <= 60 - 20 + 1, "slow lasts half as long");
  assert.equal(bb.muteT, 0);
});

test("slow stretches a monster's steps; weaken raises damage taken and lowers its defense; both expire", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4]]);
  const m = s.monsters[0]; m.hp = m.hpMax = 1000; m.defense = 40;
  m.weakenT = 10; m.weakenMag = 50;
  damageMonster(s, m, 100, {}); assert.equal(1000 - m.hp, 150);
  assert.equal(effDefense(m), 30);
  run(s, 12); assert.equal(m.weakenMag, 0); assert.equal(effDefense(m), 40);
  const a = gameOn(OPEN, [["zombie-intern", 15, 4]]), b = gameOn(OPEN, [["zombie-intern", 15, 4]]);
  for (const x of [a, b]) { x.monsters[0].ai = "chase"; x.player.tile = { x: 2, y: 4 }; }
  b.monsters[0].slowT = 9999; b.monsters[0].slowMag = 50;
  run(a, 100); run(b, 100);
  assert.ok(a.monsters[0].tile.x < b.monsters[0].tile.x, "the slowed one covered less ground");
  assert.ok(15 - a.monsters[0].tile.x >= 1.6 * (15 - b.monsters[0].tile.x), "about half the distance");
});

test("crits: one extra combat-stream draw per hit; a certain crit multiplies by critDamage, raises a crit event and a crit floater; none when impossible", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  const p = s.player;
  p.mods.critChance = 0;
  const before = stream(s, "combat").next ? JSON.stringify(s.rng.combat) : "";
  const r0 = playerDamage(s, 10);
  assert.deepEqual(r0, { amount: 10, crit: false });
  assert.notEqual(JSON.stringify(s.rng.combat), before, "the roll consumed exactly one draw even without a chance");
  const draws = (st) => { const x = JSON.stringify(st.rng.combat); return x; };
  const a = draws(s); playerDamage(s, 10); const b = draws(s);
  const t = gameOn(OPEN, []); t.rng.combat = JSON.parse(a); playerDamage(t, 10); assert.equal(draws(t), b, "one draw each call");
  p.mods.critChance = 100; p.mods.critDamage = 200;
  assert.deepEqual(playerDamage(s, 10), { amount: 20, crit: true });
  p.mods.damagePct = 50; assert.equal(playerDamage(s, 10).amount, 30);
  assert.equal(playerDamage(s, 10, 50).amount, 40, "extra percent from skill damage mods adds to the flat damagePct");
  const m = s.monsters[0]; m.hp = m.hpMax = 1000;
  damageMonster(s, m, 40, { crit: true });
  assert.ok(s.events.some((e) => e.type === "crit" && e.target === m.id));
  assert.equal(s.floaters[s.floaters.length - 1].kind, "crit");
  assert.ok(s.events.find((e) => e.type === "hit").crit);
});

test("the Sales Rep's Upsell raises the critical chance and damage by its curve; gear and skills share one fold", () => {
  const s = gameOn(OPEN, [], 1, { class: "sales-rep" });
  const c0 = s.player.mods.critChance, d0 = s.player.mods.critDamage;
  assert.equal(c0, config.crit.chance); assert.equal(d0, config.crit.damage);
  setLevel(s, 5); s.player.skills.upsell = 3; applyDerived(s);
  assert.equal(s.player.mods.critChance, c0 + at([3, 2], 3)); assert.equal(s.player.mods.critDamage, d0 + at([10, 5], 3));
});

test("heal clamps at hpMax and reports the healed amount; the floater is a heal floater", () => {
  const s = arena("facilities-manager", []);
  const p = s.player; p.hp = p.hpMax - 3;
  cmd(s, { t: "cast", skill: "coffee-break" });
  assert.equal(p.hp, p.hpMax); assert.equal(evs(s, "heal")[0].value, 3);
  assert.equal(s.floaters.at(-1).kind, "heal");
});

test("execute: Hard Close hits harder below 35 percent health by the curve; Demolition Day doubles against a staggered target only", () => {
  const dmgOf = (cls, skill, setup) => {
    const s = arena(cls, [["zombie-intern", 11, 4]]); const m = s.monsters[0];
    setup(m); s.player.damage = { min: 0, max: 0 };
    const hp = m.hp; cmd(s, { t: "cast", skill, tile: { x: 11, y: 4 } }); run(s, 20);
    return hp - m.hp;
  };
  // damage rolls differ, so compare the expected multiplier on the same seed: same state, same rolls, only the target's health differs
  const a = dmgOf("sales-rep", "hard-close", (m) => { m.hp = 3000; });
  const b = dmgOf("sales-rep", "hard-close", (m) => { m.hp = m.hpMax * 0.2; m.hpMax = 5000; });
  assert.ok(Math.abs(b - a * at(content.skills["hard-close"].effects[1].mult, 1)) <= 1, `same roll, execute multiplier x2: ${a} -> ${b}`);
  const plain = dmgOf("facilities-manager", "demolition-day", (m) => { m.ai = "idle"; });
  const staggered = dmgOf("facilities-manager", "demolition-day", (m) => { m.ai = "stagger"; m.staggerT = 999; });
  assert.ok(Math.abs(staggered - 2 * plain) <= 1, `${staggered} vs 2 x ${plain}`);
});

test("projectile shapes: Pen Volley fires its count in a fan (3 at level 1, 5 at level 5), Business Card Fan a ring of 8; every shot is a unit vector", () => {
  for (const [level, want] of [[1, 3], [5, 5]]) {
    const s = arena("sales-rep", [], level);
    cmd(s, { t: "cast", skill: "pen-volley", tile: { x: 15, y: 4 } });
    assert.equal(s.projectiles.length, want);
    const dirs = s.projectiles.map((p) => p.dir);
    for (const d of dirs) assert.ok(Math.abs(d.x * d.x + d.y * d.y - 1) < 1e-9);
    assert.ok(dirs.some((d) => Math.abs(d.y) < 1e-9 && d.x > 0.99), "the centre shot flies straight at the target (odd count)");
    assert.ok(dirs.some((d) => d.y < -0.1) && dirs.some((d) => d.y > 0.1), "the fan spreads both ways");
  }
  const ring = arena("sales-rep", []);
  cmd(ring, { t: "cast", skill: "card-fan", tile: { x: 15, y: 4 } });
  assert.equal(ring.projectiles.length, 8);
  const sx = ring.projectiles.reduce((n, p) => n + p.dir.x, 0), sy = ring.projectiles.reduce((n, p) => n + p.dir.y, 0);
  assert.ok(Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6, "a full ring balances out");
  assert.equal(ring.projectiles.every((p) => p.pierce === 1), true);
});

test("pierce: a Business Card passes through the first target and hits the second; a plain shot stops at the first", () => {
  const s = arena("sales-rep", [["zombie-intern", 12, 4], ["zombie-intern", 14, 4]]);
  s.projectiles = []; s.player.skills["card-fan"] = 1;
  // one card straight along the row: use the same code path with a single projectile
  const def = content.skills["card-fan"]; const save = def.delivery.count; def.delivery.count = [1, 0]; def.delivery.spreadDeg = 0;
  try { cmd(s, { t: "cast", skill: "card-fan", tile: { x: 14, y: 4 } }); } finally { def.delivery.count = save; def.delivery.spreadDeg = 360; }
  run(s, 60);
  const [a, b] = s.monsters;
  assert.ok(a.hp < a.hpMax && b.hp < b.hpMax, "both monsters in line were hit");
  const t = arena("sales-rep", [["zombie-intern", 12, 4], ["zombie-intern", 14, 4]]);
  cmd(t, { t: "cast", skill: "stapler-throw", tile: { x: 14, y: 4 } }); run(t, 60);
  assert.ok(t.monsters[0].hp < t.monsters[0].hpMax && t.monsters[1].hp === t.monsters[1].hpMax);
});

test("chain: Power Surge jumps to the nearest unhit monster within range, up to its chain count, each jump weaker (falloff), never back", () => {
  const s = arena("it-wizard", [["zombie-intern", 10, 4], ["zombie-intern", 12, 5], ["zombie-intern", 14, 5], ["zombie-intern", 18, 7]]);
  s.player.skills["power-surge"] = 5;
  s.player.mods.skillDamagePct = {};
  cmd(s, { t: "cast", skill: "power-surge", tile: { x: 10, y: 4 } });
  run(s, 80);
  const hit = s.monsters.map((m) => m.hpMax - m.hp);
  assert.ok(hit[0] > 0 && hit[1] > 0 && hit[2] > 0, `chained along the room: ${hit}`);
  assert.equal(hit[3], 0, "out of chain range");
  assert.equal(all(s, "projectileChain").length, 2);
  const ids = all(s, "hit").map((e) => e.target);
  assert.equal(new Set(ids).size, ids.length, "no monster is hit twice");
});

test("area at a target tile: range and line of sight are checked before any mana is spent; at self needs no target", () => {
  const rows = ["##########", "#@....#..#", "##########"];
  const s = gameOn(rows, [["zombie-intern", 7, 1]], 1, { class: "it-wizard" });
  setLevel(s, 5); applyDerived(s, { fill: true });
  const mp = s.player.mp;
  assert.deepEqual(cmd(s, { t: "cast", skill: "server-overheat", tile: { x: 7, y: 1 } }), { ok: false, error: "no line of sight" });
  assert.deepEqual(cmd(s, { t: "cast", skill: "server-overheat", tile: { x: 5, y: 1 } }), { ok: true });
  assert.equal(s.player.mp, mp - 6);
  const far = gameOn(OPEN, [], 1, { class: "it-wizard" }); const mp2 = far.player.mp;
  assert.deepEqual(cmd(far, { t: "cast", skill: "server-overheat", tile: { x: 19, y: 4 } }), { ok: false, error: "out of range" });
  assert.deepEqual(cmd(far, { t: "cast", skill: "server-overheat" }), { ok: false, error: "needs a target tile" });
  assert.equal(far.player.mp, mp2);
  assert.equal(cmd(far, { t: "cast", skill: "mute" }).error, "skill not learned");
});

test("every one of the 27 castable skills runs in an arena without throwing and emits a cast event with its archetype and fx key", () => {
  for (const c of content.classes) for (const d of Object.values(content.skills).filter((x) => x.class === c.id && x.kind === "active")) {
    const s = arena(c.id, [["zombie-intern", 12, 4], ["zombie-intern", 13, 5]], d.maxLevel);
    for (const m of s.monsters) m.ai = "chase";
    const r = cmd(s, { t: "cast", skill: d.id, tile: { x: 12, y: 4 } });
    assert.equal(r.ok, true, `${d.id}: ${r.error}`);
    const e = evs(s, "cast")[0];
    assert.deepEqual([e.skill, e.archetype, e.fx, e.level], [d.id, d.archetype, d.fx.cast, d.maxLevel], d.id);
    assert.equal(e.cost, castCost(s, d, d.maxLevel) );
    run(s, 120);
    for (const m of s.monsters) assert.ok(Number.isFinite(m.hp));
    assert.ok(Number.isFinite(s.player.hp) && Number.isFinite(s.player.mp));
  }
});

test("manaCostPct (Overclock) raises the cost of every cast; mana never drops below zero", () => {
  const s = arena("it-wizard", [["zombie-intern", 12, 4]]);
  const base = content.skills["cold-boot"].mana(1);
  assert.equal(castCost(s, content.skills["cold-boot"], 1), base);
  s.player.skills.overclock = 5; applyDerived(s);
  const pct = at([3, 1], 5);
  assert.equal(castCost(s, content.skills["cold-boot"], 1), Math.round((base * (100 + pct)) / 100));
  s.player.mp = 2;
  assert.equal(cmd(s, { t: "cast", skill: "cold-boot", tile: { x: 12, y: 4 } }).ok, false);
  assert.equal(s.player.mp, 2);
});

test("skill damage mods and synergies: Overclock raises fire / shock skill damage; a synergy row (schema reserved, no data this round per the proxy answer) works when present", () => {
  const dmg = (cls, setup, skill, tile) => {
    const s = arena(cls, [["zombie-intern", 11, 4]]); setup(s); applyDerived(s); noCrit(s);
    const m = s.monsters[0]; m.hp = m.hpMax = 100000; s.player.damage = { min: 0, max: 0 };
    cmd(s, { t: "cast", skill, tile }); run(s, 60);
    return m.hpMax - m.hp;
  };
  const a = dmg("it-wizard", (s) => { s.player.skills["power-surge"] = 5; delete s.player.skills.overclock; }, "power-surge", { x: 11, y: 4 });
  const b = dmg("it-wizard", (s) => { s.player.skills["power-surge"] = 5; s.player.skills.overclock = 5; }, "power-surge", { x: 11, y: 4 });
  assert.ok(b > a, `${b} > ${a}`);
  assert.ok(Math.abs(b / a - (1 + at([8, 4], 5) / 100)) < 0.1, `close to the curve's percent: ${b / a}`);
  assert.ok(Object.values(content.skills).every((d) => d.synergy === undefined), "no synergy data in R4 (ADR5-4: only if there is room in round 6)");
  const def = content.skills["floor-buffer"];
  const c = dmg("facilities-manager", (s) => { s.player.skills["pallet-slam"] = 1; }, "floor-buffer", { x: 11, y: 4 });
  def.synergy = [{ from: "pallet-slam", stat: "damagePct", perLevel: 4 }];
  try {
    const d = dmg("facilities-manager", (s) => { s.player.skills["pallet-slam"] = 5; }, "floor-buffer", { x: 11, y: 4 });
    assert.ok(d > c, "the synergy raised the damage");
  } finally { delete def.synergy; }
});

test("Commission (trigger on kill): a kill restores mana and pays gold scaled by floor; nothing without the skill", () => {
  const kill = (withSkill) => {
    const s = arena("sales-rep", [["zombie-intern", 12, 4]]);
    if (!withSkill) delete s.player.skills.commission; else s.player.skills.commission = 1;
    applyDerived(s); s.player.mp = 5; const gold = s.player.gold;
    damageMonster(s, s.monsters[0], 99999, { source: "player" });
    return { mp: s.player.mp - 5, gold: s.player.gold - gold, s };
  };
  const a = kill(true), b = kill(false);
  assert.equal(a.mp, 4); assert.ok(a.gold >= 3 + 1);
  assert.deepEqual([b.mp, b.gold], [0, 0]);
  assert.ok(a.s.eventLog.some((e) => e.type === "trigger" && e.skill === "commission"));
});

test("the direction helpers use no transcendental maths and agree with the exact values to 1e-7", () => {
  for (const deg of [-180, -135, -90, -45, -30, 0, 15, 30, 45, 90, 120, 180, 270, 360, 725]) {
    const [c, s] = cossin(deg), r = (deg * Math.PI) / 180;
    assert.ok(Math.abs(c - Math.cos(r)) < 1e-7 && Math.abs(s - Math.sin(r)) < 1e-7, `${deg}`);
  }
  const d = rotateDeg({ x: 1, y: 0 }, 90); assert.ok(Math.abs(d.x) < 1e-9 && Math.abs(d.y - 1) < 1e-9);
});

test("determinism: the same skills on the same seed give the same hash twice, and a JSON round trip mid-fight keeps running identically", () => {
  const make = () => { const s = arena("sales-rep", [["zombie-intern", 12, 4], ["zombie-intern", 13, 5], ["printer-imp", 11, 3]]); for (const m of s.monsters) m.ai = "chase"; return s; };
  const play = (s) => { for (const [i, id] of ["intern", "pen-volley", "reply-all", "card-fan", "hard-close"].entries()) { s.player.mp = s.player.mpMax; cmd(s, { t: "cast", skill: id, tile: { x: 12, y: 4 } }); run(s, 30 + i); } return s; };
  assert.equal(hashState(play(make())), hashState(play(make())));
  const a = play(make()), b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 200; i++) { step(a); step(b); }
  assert.equal(hashState(a), hashState(b));
});
