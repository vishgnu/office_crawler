// Monster registry (data only). Names are original office characters, never from the denylist.
// Values are for depth 1; monsterStats(type, depth) scales them (R-031). behaviour: swarmer | ranged | elite (R-030).
// speed: 1 = player pace; ticks per tile = moveTicksPerTile / speed.
// damage: base value, rolled as base +/- config.monsterDamageSpread. attackRating feeds hitChance.
// cost: share of the floor population budget (R-034). pack: [min, max]; a type with max 1 is placed as a single.
// ranged types: range (tiles) and projectile { kind, speed (tiles per tick) }. canFlee: weak swarmers flee once at low health.
import { config } from "../config.js";

export const monsters = {
  "zombie-intern": {
    id: "zombie-intern", name: "Zombie Intern", behaviour: "swarmer",
    hpBase: 14, damage: 3, defense: 4, attackRating: 25, xp: 6, speed: 0.75, sightRange: 9,
    minDepth: 1, weight: 3, pack: [2, 4], cost: 2,
  },
  "printer-imp": {
    id: "printer-imp", name: "Printer Imp", behaviour: "swarmer",
    hpBase: 8, damage: 2, defense: 8, attackRating: 30, xp: 5, speed: 1.2, sightRange: 10,
    minDepth: 1, weight: 2, pack: [2, 3], cost: 1.5,
  },
  "temp-worker": {
    id: "temp-worker", name: "Temp Worker", behaviour: "swarmer", canFlee: true,
    hpBase: 10, damage: 2, defense: 3, attackRating: 24, xp: 5, speed: 1, sightRange: 9,
    minDepth: 1, weight: 2, pack: [2, 3], cost: 1.5,
  },
  "printer-demon": {
    id: "printer-demon", name: "Printer Demon", behaviour: "ranged", range: 7,
    projectile: { kind: "toner", speed: 0.22 },
    hpBase: 12, damage: 4, defense: 5, attackRating: 32, xp: 9, speed: 0.8, sightRange: 11,
    minDepth: 2, weight: 2, pack: [2, 2], cost: 3,
  },
  "middle-manager": {
    id: "middle-manager", name: "Middle Manager", behaviour: "elite",
    hpBase: 60, damage: 8, defense: 12, attackRating: 40, xp: 30, speed: 0.85, sightRange: 10,
    minDepth: 3, weight: 1, pack: [1, 1], cost: 8,
  },
  "vending-machine": {
    id: "vending-machine", name: "Vending Machine", behaviour: "elite",
    hpBase: 90, damage: 10, defense: 25, attackRating: 35, xp: 40, speed: 0.5, sightRange: 8,
    minDepth: 4, weight: 1, pack: [1, 1], cost: 10,
  },
  consultant: {
    id: "consultant", name: "Consultant", behaviour: "ranged", range: 8,
    projectile: { kind: "slide", speed: 0.26 },
    hpBase: 22, damage: 7, defense: 8, attackRating: 40, xp: 18, speed: 0.9, sightRange: 12,
    minDepth: 5, weight: 2, pack: [2, 3], cost: 4,
  },
  auditor: {
    id: "auditor", name: "Auditor", behaviour: "elite",
    hpBase: 70, damage: 11, defense: 20, attackRating: 50, xp: 45, speed: 1, sightRange: 10,
    minDepth: 5, weight: 1, pack: [1, 1], cost: 10,
  },
};

const scale = (base, pct, depth) => Math.round((base * (100 + pct * (Math.max(1, depth) - 1))) / 100);

/** Stats of a normal monster of `type` at `depth` (R-031): non-decreasing in depth, depth 1 equals the registry values. */
export function monsterStats(type, depth) {
  const d = monsters[type], k = config.scaling;
  return {
    level: Math.max(1, depth),
    hp: scale(d.hpBase, k.hpPct, depth), damage: scale(d.damage, k.damagePct, depth), defense: scale(d.defense, k.defensePct, depth),
    attackRating: scale(d.attackRating, k.attackRatingPct, depth), xp: scale(d.xp, k.xpPct, depth),
  };
}

// Champion modifiers (R-033). Multipliers apply on top of the depth-scaled stats.
export const championMods = {
  caffeinated: { id: "caffeinated", name: "Caffeinated", speedMult: 1.3 },
  burly: { id: "burly", name: "Burly", hpMult: 1.8 },
  vicious: { id: "vicious", name: "Vicious", damageMult: 1.4 },
  armored: { id: "armored", name: "Armored", defenseMult: 1.6 },
  regenerating: { id: "regenerating", name: "Regenerating", regen: true },
};
export const championModIds = Object.keys(championMods);

/** Generated champion name: the modifier names in order, then the type name ("Burly Vicious Zombie Intern"). */
export const championName = (type, mods) => [...mods.map((m) => championMods[m].name), monsters[type].name].join(" ");

// Drop tables per monster type (S2-1). Multipliers scale the config chances; slotWeights bias which gear slot drops.
// Depth enters through the item level (config.ilvlPerDepth) and the rarity shift, so these tables stay depth-free.
export const drops = {
  "zombie-intern": { goldMult: 1.2, itemMult: 1, potionMult: 1.2, slotWeights: { body: 3, head: 2, feet: 2, belt: 2, weapon: 1, offhand: 1, hands: 1, ring: 1, amulet: 1 } },
  "printer-imp": { goldMult: 0.8, itemMult: 1.1, potionMult: 0.8, slotWeights: { weapon: 3, hands: 2, ring: 2, amulet: 2, offhand: 1, head: 1, body: 1, feet: 1, belt: 1 } },
};
Object.assign(drops, {
  "middle-manager": { goldMult: 2, itemMult: 2, potionMult: 1.5, slotWeights: { body: 3, weapon: 3, head: 2, belt: 2, offhand: 2, hands: 1, feet: 1, ring: 1, amulet: 1 } },
  "vending-machine": { goldMult: 3, itemMult: 1.5, potionMult: 3, slotWeights: null },
  auditor: { goldMult: 2, itemMult: 2, potionMult: 1.2, slotWeights: { ring: 3, amulet: 3, weapon: 2, hands: 2, head: 1, body: 1, feet: 1, belt: 1, offhand: 1 } },
});
export const defaultDrops = { goldMult: 1, itemMult: 1, potionMult: 1, slotWeights: null };
