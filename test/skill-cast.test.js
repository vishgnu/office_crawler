// R6-1 (acceptance follow-up F5): every active skill of every class spends exactly its mana cost and shows its effect. Power Surge (a projectile) and
// Packet Filter (a timed shield, not an aura) were "inconclusive" in the R5 play test: Power Surge spends nothing without a direction, Packet Filter is a buff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, applyInput, applyDerived, setLevel, castCost, effLevel } from "../src/core/index.js";
import { gameOn, run } from "./helpers.js";

const ROOM = ["####################", "#@.................#", "#..................#", "#..................#", "####################"];
const skills = content.skills;
const actives = Object.values(skills).filter((s) => s.kind === "active");

function ready(def, level) {
  const st = gameOn(ROOM, [["zombie-intern", 7, 2]], 3, { class: def.class });
  setLevel(st, 20); st.player.skills[def.id] = level; applyDerived(st, { fill: true }); // level 20: a pool big enough for every cost
  st.player.mp = st.player.mpMax;
  return st;
}
const EFFECT = {
  projectile: (st) => st.projectiles.length > 0,
  area: (st) => st.events.some((e) => e.type === "burst"),
  self: (st) => st.events.some((e) => e.type === "heal") || st.player.buffs.length > 0,
  buff: (st) => !!st.player.absorb || st.player.buffs.length > 0,
  summon: (st) => st.allies.length > 0,
  dash: (st) => !!st.player.dash,
  trap: (st) => st.zones.length > 0,
};

test("every active skill of all three classes spends its mana cost once and produces its effect (levels 1 and 5)", () => {
  assert.ok(actives.length >= 20 && actives.every((d) => EFFECT[d.archetype]), "every active archetype has an effect check (a new archetype needs a row in EFFECT)");
  for (const def of actives) for (const level of [1, 5]) {
    const st = ready(def, level), before = st.player.mp, cost = castCost(st, def, effLevel(st, def));
    assert.ok(cost > 0, `${def.id} has a mana cost`);
    const r = applyInput(st, { t: "cast", skill: def.id, tile: { x: 7, y: 2 } });
    assert.equal(r.ok, true, `${def.id} L${level}: ${r.error}`);
    assert.equal(before - st.player.mp, cost, `${def.id} L${level} spends exactly its cost`);
    const ev = st.events.find((e) => e.type === "cast");
    assert.ok(ev && ev.skill === def.id && ev.cost === cost, `${def.id} cast event`);
    assert.ok(EFFECT[def.archetype](st), `${def.id} (${def.archetype}) shows its effect`);
  }
});

test("Power Surge: a cast without a direction is refused before any mana is spent (the R5 play test 'unchanged mana'); with a target it spends and chains", () => {
  const def = skills["power-surge"], st = ready(def, 3);
  const mp = st.player.mp;
  assert.equal(applyInput(st, { t: "cast", skill: def.id, tile: { ...st.player.tile } }).ok, false);
  assert.equal(st.player.mp, mp, "a refused cast costs nothing");
  assert.equal(applyInput(st, { t: "cast", skill: def.id, tile: { x: 7, y: 2 } }).ok, true);
  assert.equal(mp - st.player.mp, castCost(st, def, 3));
  run(st, 120);
  assert.ok(st.eventLog.some((e) => e.type === "hit" && e.skill === def.id), "the bolt hits the monster");
});

test("Packet Filter is a timed shield (kind active, archetype buff), not an aura: it spends mana, sets the absorb pool and takes damage first", () => {
  const def = skills.firewall;
  assert.deepEqual([def.kind, def.archetype], ["active", "buff"]);
  const st = ready(def, 2), mp = st.player.mp;
  assert.equal(applyInput(st, { t: "cast", skill: "firewall", tile: { ...st.player.tile } }).ok, true);
  assert.equal(mp - st.player.mp, castCost(st, def, 2));
  assert.ok(st.player.absorb && st.player.absorb.amount > 0 && st.player.absorb.skill === "firewall");
  assert.equal(st.player.aura, null, "the aura slot is untouched");
});

test("a cast with too little mana is refused with a noMana event and spends nothing", () => {
  for (const id of ["power-surge", "firewall", "pallet-slam", "stapler-throw"]) {
    const def = skills[id], st = ready(def, 1);
    st.player.mp = 0;
    const r = applyInput(st, { t: "cast", skill: id, tile: { x: 7, y: 2 } });
    assert.equal(r.ok, false); assert.equal(st.player.mp, 0);
    assert.ok(st.events.some((e) => e.type === "noMana" && e.skill === id), id);
  }
});

// ---- R6 fix (CR6-06): the skill WORKS, not only "a cast happened" -------------------------------------------------------------------------------
// Every active skill, at levels 1 and 5, must show the effect its kind promises on a monster (damage lowers hp, a status sets its timer, knockback
// moves it, a trap springs, a dash reaches) or on the hero (heal raises hp, a shield absorbs, a summon fights, a hot heals over time).
import { hurtPlayer } from "../src/core/systems/damage.js";

const BIG = 100000;
const ARENA = ["####################", "#@.................#", "#..................#", "#..................#", "#..................#", "####################"];
const ops = (def) => def.effects.map((e) => e.op);
function arena(def, level, at) {
  const st = gameOn(ARENA, [["zombie-intern", at.x, at.y]], 3, { class: def.class });
  setLevel(st, 20); st.player.skills[def.id] = level; applyDerived(st, { fill: true });
  st.player.mp = st.player.mpMax; st.player.attackRating = 1e6; // a physical bolt must not miss: the test is about the effect, not the hit roll
  const m = st.monsters[0]; m.hp = m.hpMax = BIG; m.ai = "idle";
  return { st, m };
}
// where the target stands, and which tile is aimed at, per delivery
function layout(def) {
  const d = def.delivery ?? {};
  if (def.archetype === "area" && d.at !== "target") return { at: { x: 2, y: 1 }, aim: { x: 2, y: 1 } };      // self-centred: next to the hero
  if (def.archetype === "area") return { at: { x: 6, y: 1 }, aim: { x: 6, y: 1 } };                        // aimed: on the monster's tile
  if (def.archetype === "trap") return { at: { x: 4, y: 1 }, aim: { x: 4, y: 1 } };                        // a trap springs under the monster
  return { at: { x: 6, y: 1 }, aim: { x: 6, y: 1 } };                                                      // projectile, dash: in the line of fire
}
const monsterEffects = { damage: (m, before) => assert.ok(m.hp < before.hp, "monster hp drops"), execute: () => {},
  knockback: (m, before) => assert.ok(m.tile.x !== before.tile.x || m.tile.y !== before.tile.y, "monster is pushed to another tile"), dot: (m) => assert.ok(m.burnT > 0, "burning"),
  status: (m, before, e) => {
    if (["stun", "mute", "freeze"].includes(e.kind)) assert.ok(m.muteT > 0 && m.statusKind === e.kind, `${e.kind} sets the timer`);
    else if (e.kind === "slow") assert.ok(m.slowT > 0 && m.slowMag > 0, "slowed");
    else if (e.kind === "weaken") assert.ok(m.weakenT > 0 && m.weakenMag > 0, "weakened");
    else assert.fail(`unknown status kind ${e.kind}`);
  } };

test("every active skill that works on monsters (area, projectile, dash, trap) damages, marks or moves the monster as its effects say, at levels 1 and 5", () => {
  const against = actives.filter((d) => ["area", "projectile", "dash", "trap"].includes(d.archetype));
  assert.ok(against.length >= 15);
  for (const def of against) for (const level of [1, 5]) {
    // the expectation must not come from the effect list alone (an emptied list would then pass): the kind and the damage tags say what has to be there
    assert.ok(def.effects.some((e) => ["damage", "status", "dot", "knockback"].includes(e.op)), `${def.id} acts on monsters`);
    if (def.tags.some((t) => ["physical", "fire", "cold", "shock", "acid"].includes(t))) assert.ok(def.effects.some((e) => e.op === "damage" || e.op === "dot"), `${def.id} is tagged with a damage type and so deals damage`);
    const { at, aim } = layout(def), { st, m } = arena(def, level, at), before = { hp: m.hp, tile: { ...m.tile } }, tag = `${def.id} L${level}`;
    const r = applyInput(st, { t: "cast", skill: def.id, tile: aim });
    assert.equal(r.ok, true, `${tag}: ${r.error}`);
    run(st, def.archetype === "trap" ? 60 : def.archetype === "area" ? 1 : 80);
    assert.ok(m.hp < BIG || def.effects.every((e) => e.op !== "damage" && e.op !== "dot" && e.op !== "execute"), `${tag}: a damaging skill lowers monster hp (${m.hp})`);
    for (const e of def.effects) {
      assert.ok(monsterEffects[e.op], `${tag}: effect ${e.op} has a check (a new op needs a row)`);
      // knockback of a damaging skill and a hit monster that has already walked back are not compared by tile after a long run: knockback uses the area/dash tick only
      if (e.op === "knockback" && def.archetype !== "area") continue;
      monsterEffects[e.op](m, before, e);
    }
  }
});

test("a Mute-only skill (status without damage) still marks the monster and costs mana, and a status skill does not damage unless it says so", () => {
  const def = skills.mute, { st, m } = arena(def, 3, { x: 2, y: 1 });
  assert.deepEqual(ops(def), ["status"]);
  applyInput(st, { t: "cast", skill: "mute", tile: { x: 2, y: 1 } }); run(st, 1);
  assert.ok(m.muteT > 0 && m.statusKind === "mute"); assert.equal(m.hp, BIG);
});

test("self skills heal or heal over time: a wounded hero gets hp back (coffee-break at once, restore-backup over time, more than natural regeneration)", () => {
  for (const [id, klass, ticks] of [["coffee-break", "facilities-manager", 1], ["restore-backup", "it-wizard", 120]]) for (const level of [1, 5]) {
    const def = skills[id], mk = () => { const s = arena(def, level, { x: 15, y: 4 }).st; s.player.hp = Math.floor(s.player.hpMax / 3); return s; };
    const st = mk(), control = mk(), start = st.player.hp;
    assert.equal(applyInput(st, { t: "cast", skill: id, tile: { ...st.player.tile } }).ok, true);
    run(st, ticks); run(control, ticks);
    assert.ok(st.player.hp > start, `${id} L${level}: hp rose from ${start} to ${st.player.hp}`);
    assert.ok(st.player.hp > control.player.hp, `${id} L${level}: more than regeneration alone (${st.player.hp} vs ${control.player.hp})`);
  }
});

test("shields absorb: Lockout and Packet Filter take damage before hp, and the pool shrinks by what they took", () => {
  for (const id of ["lockout", "firewall"]) {
    const def = skills[id], { st } = arena(def, 3, { x: 15, y: 4 });
    applyInput(st, { t: "cast", skill: id, tile: { ...st.player.tile } });
    const pool = st.player.absorb.amount, hp = st.player.hp;
    assert.ok(pool > 0);
    hurtPlayer(st, { id: "m1" }, Math.min(10, pool - 1));
    assert.equal(st.player.hp, hp, `${id}: hp untouched while the shield holds`);
    assert.ok(st.player.absorb.amount < pool, `${id}: the pool shrank`);
  }
});

test("summons fight: every summon skill puts allies on the map that have hp (and damage, unless it is a decoy) and engage a nearby monster", () => {
  for (const def of actives.filter((d) => d.archetype === "summon")) for (const level of [1, 5]) {
    const { st, m } = arena(def, level, { x: 4, y: 1 }), tag = `${def.id} L${level}`;
    applyInput(st, { t: "cast", skill: def.id, tile: { ...st.player.tile } });
    const decoy = def.effects.some((e) => e.op === "summon" && e.taunt); // the Traffic Cone Wall only holds the line: hp, no damage
    assert.ok(st.allies.length > 0 && st.allies.every((a) => a.hp > 0 && (decoy || a.damage > 0)), tag);
    if (decoy) continue;
    m.ai = "chase"; run(st, 200);
    assert.ok(m.hp < BIG || st.player.hp < st.player.hpMax || st.allies.some((a) => a.hp < a.hpMax) || st.eventLog.some((e) => e.type === "allyHit" || e.type === "hit"), `${tag}: the allies engaged`);
  }
});
