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
