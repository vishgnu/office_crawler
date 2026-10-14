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
