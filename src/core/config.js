// Every balance and timing constant of the simulation lives here (tests refer to these names).
// Times are in simulation ticks (tickHz per second). No timed-input values: AC-NFR-A02-4.
export const config = {
  tickHz: 60,

  // Floor generation
  floorSize: { w: 56, h: 56 },
  minRooms: 6,
  maxGenAttempts: 8,
  safeRadius: 6,       // no monsters within this many tiles of the entry stairs
  packRadius: 4,       // pack members stand within this many tiles of the first member
  singlesAllowed: true,

  // Movement. All eight directions take the same time: with the 2:1 projection a (1,1) step is
  // shorter on screen than a (1,0) step, and AC-R-005-1 sizes its wait as length x moveTicksPerTile.
  moveTicksPerTile: 12,
  diagonalFactor: 1,
  pathDiagCost: 1,     // A* diagonal cost; 1 makes path length equal the BFS step count (AC-R-005-8)
  clickSnapRadius: 3,  // QF-01-2: click on a wall walks to the nearest reachable tile within this radius
  meleeRange: 1,

  // Combat
  attackTicks: 20,
  attackHitTick: 8,
  monsterAttackTicks: 45,
  monsterAttackHitTick: 18,
  hitChanceMin: 0.05,
  hitChanceMax: 0.95,
  ar: { perAgility: 3 },
  monsterDamageSpread: 1, // monster damage = base +/- spread
  deathTicks: 40,

  // Monster AI
  noticeTicks: 15,
  packWakeTicks: 5,
  ai: { maxPathNodes: 1500, repathTicks: 15 },

  // Natural regeneration (QF-02-4 is open; small default, easy to set to 0)
  regen: { hpEvery: 120, mpEvery: 60 },

  player: {
    hpMax: 50,
    mpMax: 20,
    damage: { min: 3, max: 6 },
    defense: 10,
    baseAttackRating: 10,
    attrs: { grit: 10, agility: 10, stamina: 10, focus: 10 },
    xpNext: 100,
  },
};
