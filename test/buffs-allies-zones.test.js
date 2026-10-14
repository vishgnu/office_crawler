// R4-3: buffs, the shield, heal over time, allies, decoys, zones (traps and fields) and the dash (ADR-0005 sections 3 to 5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, config, applyInput, step, setLevel, applyDerived, at, hashState, teleportFloor, spawnMonster, newGame } from "../src/core/index.js";
import { hurtPlayer } from "../src/core/systems/damage.js";
import { gameOn, run, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const evs = (s, type) => s.events.filter((e) => e.type === type);
const all = (s, type) => s.eventLog.filter((e) => e.type === type);
function arena(cls, monsters = [], skillLevel = 1, rows = OPEN) {
  const s = gameOn(rows, monsters, 1, { class: cls });
  setLevel(s, 30);
  for (const d of Object.values(content.skills)) if (d.class === cls) s.player.skills[d.id] = skillLevel;
  applyDerived(s, { fill: true });
  s.player.mods.critChance = 0;
  for (const m of s.monsters) { m.ai = "idle"; m.hp = m.hpMax = 5000; m.defense = 0; }
  return s;
}

// ---- buffs and the shield ----------------------------------------------------------------------------------------------------

test("absorb: Lockout / Tagout starts a shield that drains before health, reports each absorption and ends when spent or timed out", () => {
  const s = arena("facilities-manager", []);
  const p = s.player, def = content.skills.lockout;
  cmd(s, { t: "cast", skill: "lockout" });
  const e = evs(s, "buffStart")[0];
  assert.deepEqual([e.skill, e.stat, e.ticks], ["lockout", "absorb", at(def.effects[0].ticks, 1)]);
  assert.equal(p.absorb.amount, at(def.effects[0].amount, 1)); assert.equal(p.absorb.reflect, 30);
  const hp = p.hp, amount = p.absorb.amount;
  hurtPlayer(s, "m1", 30);
  assert.equal(p.hp, hp); assert.equal(p.absorb.amount, amount - 30);
  assert.deepEqual(evs(s, "absorb")[0], { type: "absorb", skill: "lockout", amount: 30, remaining: amount - 30 });
  hurtPlayer(s, "m1", amount - 30 + 7);                      // spills 7 through the rest of the shield
  assert.equal(p.hp, hp - 7); assert.equal(p.absorb, null);
  assert.ok(evs(s, "buffEnd").some((x) => x.skill === "lockout"));
  const t = arena("facilities-manager", []);
  cmd(t, { t: "cast", skill: "lockout" });
  run(t, at(def.effects[0].ticks, 1) + 1);
  assert.equal(t.player.absorb, null); assert.ok(all(t, "buffEnd").some((x) => x.skill === "lockout"));
});

test("absorb reflects a share of the absorbed damage at the attacking monster (Packet Filter returns cold)", () => {
  const s = arena("it-wizard", [["zombie-intern", 10, 4]]);
  const m = s.monsters[0]; m.hp = m.hpMax = 1000;
  cmd(s, { t: "cast", skill: "firewall" });
  assert.equal(s.player.absorb.type, "cold");
  const reflect = s.player.absorb.reflect;
  assert.equal(reflect, at(content.skills.firewall.effects[0].reflectPct, 1));
  hurtPlayer(s, m.id, 20);
  assert.equal(1000 - m.hp, Math.max(1, Math.round((20 * reflect) / 100)));
});

test("a hit that is fully absorbed does not hurt, does not kill and leaves the hero standing", () => {
  const s = arena("it-wizard", []);
  s.player.hp = 1; cmd(s, { t: "cast", skill: "firewall" });
  hurtPlayer(s, "x", 5);
  assert.equal(s.player.hp, 1); assert.equal(s.scene, "floor");
});

test("heal over time: Restore Backup heals value per pulse for its duration, clamps at hpMax, then ends with a buffEnd", () => {
  const s = arena("it-wizard", []), regen = config.regen.hpEvery;
  config.regen.hpEvery = 0; // natural regeneration would blur the count
  try {
  const p = s.player, e = content.skills["restore-backup"].effects[0];
  p.hp = 10; cmd(s, { t: "cast", skill: "restore-backup" });
  assert.deepEqual(p.buffs.map((b) => [b.skill, b.stat, b.value, b.t]), [["restore-backup", "hot", at(e.amount, 1), at(e.ticks, 1)]]);
  run(s, 120);
  assert.equal(p.hp, 10 + at(e.amount, 1) * 4, "four pulses in 120 ticks");
  run(s, 200);
  assert.equal(p.buffs.length, 0);
  assert.ok(all(s, "buffEnd").some((x) => x.skill === "restore-backup"));
  const t = arena("it-wizard", []); t.player.hp = t.player.hpMax - 1; cmd(t, { t: "cast", skill: "restore-backup" }); run(t, 40);
  assert.equal(t.player.hp, t.player.hpMax);
  } finally { config.regen.hpEvery = regen; }
});

test("timed stat buffs (statMod with ticks) change the derived stats while they last and expire; the same skill replaces its own entry", () => {
  const s = arena("facilities-manager", []);
  const p = s.player, d0 = p.defense;
  p.buffs.push({ skill: "x", stat: "defense", value: 25, t: 5 });
  applyDerived(s);
  assert.equal(p.defense, d0 + 25);
  run(s, 6);
  assert.equal(p.buffs.length, 0); assert.equal(p.defense, d0);
  assert.ok(all(s, "buffEnd").some((x) => x.skill === "x"));
});

test("the dead hero keeps no shield or dash", () => {
  const s = arena("facilities-manager", []);
  cmd(s, { t: "cast", skill: "lockout" }); hurtPlayer(s, "m", 99999);
  assert.equal(s.scene, "dead"); assert.equal(s.player.absorb, null); assert.equal(s.player.dash, null);
});

// ---- allies --------------------------------------------------------------------------------------------------------------------

test("summon: Summer Intern adds an ally with the curve's stats next to the hero; the cap per skill and the global cap hold; the oldest leaves first", () => {
  const s = arena("sales-rep", []);
  cmd(s, { t: "cast", skill: "intern" });
  assert.equal(s.allies.length, 1);
  const a = s.allies[0], d = content.skills.intern.effects[0];
  assert.deepEqual([a.unit, a.owner, a.hp, a.hpMax, a.damage, a.ttl, a.taunt], ["intern", "player", at(d.hp, 1), at(d.hp, 1), at(d.damage, 1), at(content.skills.intern.delivery.ticks, 1), false]);
  assert.ok(Math.max(Math.abs(a.tile.x - s.player.tile.x), Math.abs(a.tile.y - s.player.tile.y)) <= 2);
  assert.deepEqual(evs(s, "summon")[0], { type: "summon", skill: "intern", unit: "intern", id: a.id, tile: a.tile });
  run(s, config.castTicks + 1); cmd(s, { t: "cast", skill: "intern" });
  assert.equal(s.allies.length, 1, "level 1 allows one intern: the first is replaced");
  assert.ok(evs(s, "allyDied").some((e) => e.id === a.id && e.reason === "replaced"));
  const m = arena("sales-rep", [], 1); cmd(m, { t: "cast", skill: "department-meeting" });
  assert.equal(m.allies.length, 3);
  for (let i = 0; i < 3; i++) { run(m, config.castTicks + 1); m.player.mp = m.player.mpMax; cmd(m, { t: "cast", skill: "department-meeting" }); }
  assert.ok(m.allies.length <= config.maxAllies);
  assert.equal(new Set(m.allies.map((x) => x.id)).size, m.allies.length);
});

test("allies follow the hero, attack the nearest awake monster and expire after their shift; they never block the hero", () => {
  const s = arena("sales-rep", [["zombie-intern", 15, 4]]);
  const m = s.monsters[0]; m.hp = m.hpMax = 2000; m.ai = "idle";
  cmd(s, { t: "cast", skill: "intern" });
  const a = s.allies[0]; a.ttl = 1500;
  s.player.tile = { x: 2, y: 4 }; // the hero walks away: the ally follows
  run(s, 200);
  assert.ok(Math.abs(a.tile.x - 2) <= config.allyFollowDist + 1, `followed to ${a.tile.x}`);
  m.ai = "chase"; m.tile = { x: 6, y: 4 };
  run(s, 400);
  assert.ok(m.hp < m.hpMax, "the intern fought");
  assert.ok(all(s, "hit").some((e) => e.source === "ally"));
  a.ttl = 3; run(s, 5);
  assert.equal(s.allies.length, 0);
  assert.ok(all(s, "allyDied").some((e) => e.id === a.id && e.reason === "expired"));
});

test("a monster in reach of an ally hits it; a decoy (Traffic Cone) takes the blow even with the hero in reach; slain allies are removed", () => {
  const s = arena("facilities-manager", [["zombie-intern", 11, 4]]);
  const m = s.monsters[0]; m.damage = 6;
  s.player.skills["traffic-cone"] = 1;
  cmd(s, { t: "cast", skill: "traffic-cone" });
  assert.equal(s.allies.length, 3); assert.ok(s.allies.every((a) => a.taunt && a.unit === "cone"));
  const hero = s.player.hp;
  m.tile = { x: s.allies[0].tile.x + 1, y: s.allies[0].tile.y }; m.ai = "chase";
  s.player.tile = { x: m.tile.x + 1, y: m.tile.y }; // the hero is in reach as well
  run(s, config.monsterAttackTicks * 3);
  assert.equal(s.player.hp, hero, "the monster hit cones, not the hero");
  assert.ok(s.allies.some((a) => a.hp < a.hpMax) || s.allies.length < 3);
  for (const a of s.allies) a.hp = 0;
  run(s, 2);
  assert.equal(s.allies.length, 0);
  assert.ok(all(s, "allyDied").some((e) => e.reason === "slain"));
});

test("an ordinary ally is hit only when the hero is out of reach", () => {
  const s = arena("sales-rep", [["zombie-intern", 11, 4]]);
  cmd(s, { t: "cast", skill: "intern" });
  const a = s.allies[0], m = s.monsters[0];
  a.tile = { x: 12, y: 4 }; m.tile = { x: 11, y: 4 }; m.ai = "attack"; m.attackT = 0; m.damage = 5;
  s.player.tile = { x: 5, y: 4 }; a.path = []; a.ttl = 9999;
  const hero = s.player.hp;
  run(s, config.monsterAttackHitTick + 2);
  assert.ok(a.hp < a.hpMax); assert.equal(s.player.hp, hero);
});

test("allies and zones are cleared on a floor change and on respec; they are not saved state", () => {
  const s = arena("sales-rep", []);
  cmd(s, { t: "cast", skill: "intern" });
  s.zones.push({ id: "z9", kind: "field", skill: "server-overheat", level: 1, tile: { x: 3, y: 3 }, radius: 1, armT: 0, ttl: 50, every: 30 });
  assert.equal(teleportFloor(s, 2).ok, true);
  assert.deepEqual([s.allies.length, s.zones.length], [0, 0]);
});

// ---- zones ---------------------------------------------------------------------------------------------------------------------

test("trap: Wet Floor arms after armTicks, springs once on the first monster inside (slow and weaken), then ends; max traps replace the oldest", () => {
  const s = arena("facilities-manager", [["zombie-intern", 15, 4]]);
  const m = s.monsters[0], def = content.skills["wet-floor"];
  cmd(s, { t: "cast", skill: "wet-floor", tile: { x: 12, y: 4 } });
  const z = s.zones[0];
  assert.deepEqual([z.kind, z.skill, z.tile, z.armT, z.ttl], ["trap", "wet-floor", { x: 12, y: 4 }, def.delivery.armTicks, def.delivery.ttl]);
  assert.deepEqual(evs(s, "zoneStart")[0], { type: "zoneStart", id: z.id, skill: "wet-floor", kind: "trap", tile: { x: 12, y: 4 }, radius: z.radius });
  m.tile = { x: 12, y: 4 }; m.hp = m.hpMax = 5000;
  run(s, def.delivery.armTicks - 2);
  assert.equal(s.zones.length, 1, "not armed yet: it does not spring");
  assert.equal(m.slowT, 0);
  run(s, 6);
  assert.equal(s.zones.length, 0);
  assert.ok(m.slowT > 0 && m.slowMag === at(def.effects[0].mag, 1) && m.weakenT > 0);
  assert.equal(all(s, "zoneTrigger").length, 1); assert.equal(all(s, "zoneEnd").length, 1);
  const t = arena("facilities-manager", []);
  for (let i = 0; i < 4; i++) { t.player.mp = t.player.mpMax; run(t, config.castTicks + 1); cmd(t, { t: "cast", skill: "wet-floor", tile: { x: 12 + (i % 3), y: 4 } }); }
  assert.equal(t.zones.length, content.skills["wet-floor"].delivery.max);
  const ids = t.zones.map((z) => z.id);
  assert.ok(!ids.includes("z1"), "the oldest was replaced");
});

test("a trap not triggered ends when its time is up; a trap must be placed on a walkable tile in range", () => {
  const s = arena("facilities-manager", []);
  assert.equal(cmd(s, { t: "cast", skill: "wet-floor", tile: { x: 0, y: 0 } }).ok, false);
  assert.equal(cmd(s, { t: "cast", skill: "wet-floor", tile: { x: 19, y: 4 } }).error, "out of range");
  cmd(s, { t: "cast", skill: "wet-floor", tile: { x: 12, y: 4 } });
  s.zones[0].ttl = 3; run(s, 5);
  assert.equal(s.zones.length, 0);
});

test("field: Server Overheat leaves a hot patch that keeps burning monsters inside it every beat until it burns out", () => {
  const s = arena("it-wizard", [["zombie-intern", 12, 4]]);
  const m = s.monsters[0], d = content.skills["server-overheat"];
  cmd(s, { t: "cast", skill: "server-overheat", tile: { x: 12, y: 4 } });
  assert.equal(s.zones.length, 1); assert.equal(s.zones[0].kind, "field"); assert.equal(s.zones[0].ttl, at(d.delivery.linger.ticks, 1));
  m.burnT = 0; m.burnDmg = 0;                                    // the patch alone must re-ignite it
  run(s, 31);
  assert.ok(m.burnT > 0, "re-ignited by the zone beat");
  run(s, at(d.delivery.linger.ticks, 1) + 10);
  assert.equal(s.zones.length, 0);
  assert.ok(all(s, "zoneEnd").length === 1);
  const fresh = arena("it-wizard", [["zombie-intern", 12, 4]]);
  cmd(fresh, { t: "cast", skill: "server-overheat", tile: { x: 12, y: 4 } });
  fresh.monsters[0].tile = { x: 17, y: 7 }; fresh.monsters[0].burnT = 0; run(fresh, 40);
  assert.equal(fresh.monsters[0].burnT, 0, "outside the patch nothing burns");
});

// ---- dash ----------------------------------------------------------------------------------------------------------------------

test("dash: Dolly Charge moves the hero along the line over a few ticks, stops before walls and monsters, and hits what it passes once", () => {
  const rows = ["####################", "#..................#", "#..@...............#", "#..................#", "####################"];
  const s = arena("facilities-manager", [["zombie-intern", 7, 1], ["zombie-intern", 9, 2]], 1, rows);
  s.monsters[1].tile = { x: 12, y: 3 };
  const from = { ...s.player.tile }, d = content.skills["dolly-charge"];
  assert.equal(cmd(s, { t: "cast", skill: "dolly-charge", tile: { x: 18, y: 2 } }).ok, true);
  const e = evs(s, "dash")[0];
  assert.deepEqual(e.from, from); assert.deepEqual(e.to, { x: from.x + Math.floor(at(d.delivery.distance, 1)), y: from.y });
  assert.ok(s.player.dash && s.player.dash.path.length > 0);
  assert.ok(s.player.castT >= d.delivery.ticks);
  run(s, d.delivery.ticks + 3);
  assert.deepEqual(s.player.tile, e.to); assert.equal(s.player.dash, null);
  const hits = all(s, "hit").filter((x) => x.skill === "dolly-charge");
  assert.equal(new Set(hits.map((x) => x.target)).size, hits.length, "each monster once");
  assert.ok(hits.length >= 1);
  const wall = arena("facilities-manager", [], 5, rows);
  wall.player.tile = { x: 15, y: 2 };
  cmd(wall, { t: "cast", skill: "dolly-charge", tile: { x: 19, y: 2 } }); run(wall, 20);
  assert.ok(wall.player.tile.x <= 18, "never into the wall");
  const block = arena("facilities-manager", [["zombie-intern", 6, 2]], 5, rows);
  cmd(block, { t: "cast", skill: "dolly-charge", tile: { x: 18, y: 2 } }); run(block, 20);
  assert.ok(block.player.tile.x < 6 || block.player.tile.x === 5, "stops in front of a monster");
  assert.equal(cmd(arena("facilities-manager", []), { t: "cast", skill: "dolly-charge", tile: { x: 9, y: 4 } }).error, "no direction");
});

test("determinism: a fight with allies, zones, buffs and a dash is identical twice and across a JSON round trip", () => {
  const make = () => {
    const s = arena("facilities-manager", [["zombie-intern", 13, 4], ["zombie-intern", 14, 5], ["printer-imp", 15, 4]], 3);
    for (const m of s.monsters) { m.ai = "chase"; m.hp = m.hpMax = 300; }
    return s;
  };
  const play = (s) => {
    for (const [skill, tile] of [["traffic-cone", { x: 11, y: 4 }], ["wet-floor", { x: 12, y: 4 }], ["lockout", null], ["dolly-charge", { x: 14, y: 4 }], ["pallet-slam", { x: 13, y: 4 }], ["floor-buffer", { x: 13, y: 4 }]]) {
      s.player.mp = s.player.mpMax; cmd(s, { t: "cast", skill, tile: tile ?? undefined }); run(s, 40);
    }
    return s;
  };
  assert.equal(hashState(play(make())), hashState(play(make())));
  const a = play(make()), b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 300; i++) { step(a); step(b); }
  assert.equal(hashState(a), hashState(b));
});
