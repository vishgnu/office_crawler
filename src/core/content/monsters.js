// Monster registry (data only). Names are original office characters, never from the denylist.
// speed: 1 = player pace; ticks per tile = moveTicksPerTile / speed.
// damage: base value, rolled as base +/- config.monsterDamageSpread. attackRating feeds hitChance.
export const monsters = {
  "zombie-intern": {
    id: "zombie-intern", name: "Zombie Intern", behaviour: "swarmer",
    hpBase: 14, damage: 3, defense: 4, attackRating: 25, xp: 6, speed: 0.75, sightRange: 9,
    minDepth: 1, weight: 3, pack: [2, 4],
  },
  "printer-imp": {
    id: "printer-imp", name: "Printer Imp", behaviour: "swarmer",
    hpBase: 8, damage: 2, defense: 8, attackRating: 30, xp: 5, speed: 1.2, sightRange: 10,
    minDepth: 1, weight: 2, pack: [2, 3],
  },
};

// Drop tables per monster type (S2-1). Multipliers scale the config chances; slotWeights bias which gear slot drops.
// Depth enters through the item level (config.ilvlPerDepth) and the rarity shift, so these tables stay depth-free.
export const drops = {
  "zombie-intern": { goldMult: 1.2, itemMult: 1, potionMult: 1.2, slotWeights: { body: 3, head: 2, feet: 2, belt: 2, weapon: 1, offhand: 1, hands: 1, ring: 1, amulet: 1 } },
  "printer-imp": { goldMult: 0.8, itemMult: 1.1, potionMult: 0.8, slotWeights: { weapon: 3, hands: 2, ring: 2, amulet: 2, offhand: 1, head: 1, body: 1, feet: 1, belt: 1 } },
};
export const defaultDrops = { goldMult: 1, itemMult: 1, potionMult: 1, slotWeights: null };
