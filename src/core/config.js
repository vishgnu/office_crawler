// Every balance and timing constant of the simulation lives here (tests refer to these names).
// Times are in simulation ticks (tickHz per second). No timed-input values: AC-NFR-A02-4.
// XP curve constants (see xpTable below)
const xpCurve = { quad: 36, lin: 110 };
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
  holdRadius: 2,       // a hero whose target is already chasing it waits once the target is this close (no mutual-pursuit orbits)

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
  ai: { maxPathNodes: 1500, repathTicks: 15, detourSlack: 6 }, // detourSlack: longest detour (tiles) taken to walk round other actors

  // Natural regeneration (QF-02-4 is open; small default, easy to set to 0)
  regen: { hpEvery: 40, mpEvery: 30 },

  // Character (S2-2). Derived stats are a pure function of level, attributes and gear (items/derive.js).
  startGold: 50,
  damageTypes: ["fire", "cold", "shock", "acid"],
  unarmed: { min: 1, max: 2 },       // used only when no weapon is worn (a weapon replaces it, it is not added to it)
  // Sanity caps on derived stats (S2 review). Resistances are percentages (75 is the usual ceiling); defense and attack rating
  // are already bounded in effect by hitChanceMin/Max, so their caps only stop display and affix stacking from running away.
  caps: { resist: 75, defense: 400, attackRating: 600 },
  derived: {
    rounding: "floor",               // "floor" | "round" | "ceil", applied to every derived stat
    hpBase: 10, hpPerLevel: 10, hpPerStamina: 3,
    mpBase: 5, mpPerLevel: 5, mpPerFocus: 1,
    gritFree: 8,                     // damage bonus counts grit points above this value ...
    damagePerGrit: { min: 1, max: 1 }, // ... times this
    defenseBase: 0, defensePerAgility: 1,
    attackRatingBase: 10, attackRatingPerAgility: 3,
  },
  levelCap: 30,
  // xpTable[i] = total xp needed for level i+1 (level 1 at 0, strictly increasing, levelCap entries): xpCurve.quad * i^2 + xpCurve.lin * i.
  xpCurve,                           // balance pass 2026-10-13 (was 20 / 60): the careful bot is level 13-14 on floor 8
  xpTable: Array.from({ length: 30 }, (_, i) => xpCurve.quad * i * i + xpCurve.lin * i),
  xpPastCap: 99999999,               // QF-06-2: xp keeps counting for display up to this value at the level cap
  attrPointsPerLevel: 5,
  skillPointsPerLevel: 1,
  skillMaxLevel: 5,
  player: {
    attrs: { grit: 10, agility: 10, stamina: 10, focus: 10 },
    xpNext: 80,
  },
  startKit: { weapon: "ruler-rapier", healthPotions: 2, healthPotion: "lukewarm-coffee" },

  // Items and loot (S2-1). All balance numbers for drops, prices and potions live here (QF-05-7).
  ilvlPerDepth: 3,                   // item level of a drop = depth * this (+ monster bonus)
  dropChance: 0.35,                  // chance that a normal kill drops a gear item; strictly between 0 and 1
  potionDropChance: 0.08,
  goldDropChance: 0.55,
  gold: { base: 3, perDepth: 2, spread: 2 }, // pile = (base + perDepth * depth) * goldMult +/- spread
  rarityWeights: { normal: 700, magic: 250, rare: 45, unique: 5 },
  rarityDepthShift: 3,               // per depth, this much weight moves from normal to magic/rare/unique
  magicAffixes: [1, 2],
  rareAffixes: [3, 5],
  maxPrefixes: 3, maxSuffixes: 3,
  uniqueOncePerGame: true,           // QF-05-2: a taken unique falls back to a rare of the same base
  tierMinRarity: { normal: "normal", champion: "magic", boss: "rare" }, // QF-03-4 and QF-04-7
  bossDrops: 3,
  dropRadius: 3,                     // loot lands on the kill tile or the nearest free tile within this radius
  pickupRange: 1,                    // Chebyshev tiles
  consumePotionAtFull: true,         // QF-05-5
  inventory: { w: 10, h: 4 },
  stash: { w: 10, h: 8 },
  beltSlots: 4,
  groundItemCap: 60,                 // beyond this, gold then the cheapest normal items go first; uniques, the released cursor item and the new entry never do
  affixTierDecay: 0.5,               // affix tiers: the highest tier unlocked at the item level has weight 1, each lower one this factor less
  rarityValue: { normal: 1, magic: 2, rare: 4, unique: 8 },
  affixWorth: 0.5,                   // share of the base value an affix at its range maximum adds
  ilvlValue: 0.1,                    // base value grows by this per item level
  consumableValueMult: 2,            // scales the sell value (and so the price) of potions and other consumables
  buyOverSell: 4,                    // vendor price = sell value * this (at least sell value + 1)
  vendor: { gearSlots: 8, potionTiers: { 1: 1, 2: 5, 3: 12 } }, // potion tier -> minimum player level; stock is re-rolled on each return to the Lobby, not on each window open
  exploreRadius: 6,                  // R-075: tiles within this distance of the hero count as explored (the Lobby is explored from the start)
  portal: { lobbyTile: { x: 10, y: 9 } }, // R-046: where the Emergency Exit door stands in the Lobby

  // Skills and projectiles (S2-3). Mana cost only, no cooldowns (QF-06-5).
  castTicks: 12,                     // the hero is busy (action "cast") for this long after a skill
  hitRecoveryMinDamage: 5,           // AC-R-024-1: a hit of at least this much staggers a monster ...
  hitRecoveryTicks: 14,              // ... for this many ticks (no attack, no move)
  flashTicks: 8,                     // AC-R-025-2: hit flash on monsters and the hero
  floaterTicks: 50,                  // AC-R-025-1: lifetime of a state-backed damage floater
  projectileHitRadius: 0.6,          // tiles
  fleeHpFraction: 0.25,              // QF-03-2: weak swarmers flee below this health share, once per life
  fleeTicks: 150,
  championMaxMods: 3,
  championChance: 0.3,               // chance that a populated floor from depth 2 on carries a champion pack
  championPackSize: [3, 4],
  tierFactor: { normal: 1, champion: 3, boss: 10 },

  // Depth scaling of monster stats, percent per depth beyond the first (depth 1 = registry values).
  scaling: { hpPct: 80, damagePct: 14, defensePct: 16, attackRatingPct: 12, xpPct: 20 },
  // Floor population budget (AC-R-034-3): sum of cost * tierFactor stays within it.
  budgetBase: 120, budgetPerDepth: 32,
  population: { packsWanted: [12, 16], maxPacks: 50, tries: 400, stopAtBudget: 0.6 }, // how many packs a floor tries to place before it stops

  // World (S2-4)
  maxDepth: 8,                       // floors 1-8; the boss arena (depth 9, S3) hangs off floor 8
  bossDepth: 9,
  townStairsTarget: "deepest",       // QF-01-1
  zoneSplit: 4,                      // depths 1-4 open-plan, 5-8 basement
  interactRange: 2,                  // Chebyshev tiles to talk to an NPC
  townHealerFree: true,
};
