// Affix tables (AC-R-052). A group is one stat family (QF-05-3): an item never carries two affixes of the same
// group. Each group has tiers; a tier is available from `minIlvl` upwards and has a value range.
// stat: the key deriveStats reads. types: item slot types the affix may roll on.
const ALL = ["weapon", "offhand", "head", "body", "hands", "feet", "belt", "ring", "amulet"];
const T = [1, 6, 12, 20]; // tier item levels

const groups = [
  // prefixes
  { group: "damage", kind: "prefix", stat: "damage", types: ["weapon", "hands", "ring", "amulet"],
    tiers: [["Sharpened", [1, 2]], ["Serrated", [3, 4]], ["Vicious", [5, 7]], ["Merciless", [8, 11]]] },
  { group: "defense", kind: "prefix", stat: "defense", types: ["offhand", "head", "body", "hands", "feet", "belt"],
    tiers: [["Padded", [2, 4]], ["Reinforced", [5, 9]], ["Fortified", [10, 16]], ["Bulwark", [17, 26]]] },
  { group: "health", kind: "prefix", stat: "hpMax", types: ALL,
    tiers: [["Hearty", [5, 10]], ["Robust", [11, 20]], ["Stalwart", [21, 35]], ["Indomitable", [36, 55]]] },
  { group: "mana", kind: "prefix", stat: "mpMax", types: ALL,
    tiers: [["Alert", [3, 6]], ["Lucid", [7, 12]], ["Brilliant", [13, 20]], ["Visionary", [21, 32]]] },
  { group: "accuracy", kind: "prefix", stat: "attackRating", types: ["weapon", "hands", "ring", "amulet", "head"],
    tiers: [["Accurate", [8, 15]], ["Precise", [16, 30]], ["Pinpoint", [31, 50]], ["Unerring", [51, 80]]] },
  // suffixes
  { group: "grit", kind: "suffix", stat: "grit", types: ALL,
    tiers: [["of the Gym Rat", [1, 2]], ["of Heavy Lifting", [3, 4]], ["of the Powerhouse", [5, 6]], ["of the Titan", [7, 9]]] },
  { group: "agility", kind: "suffix", stat: "agility", types: ALL,
    tiers: [["of the Courier", [1, 2]], ["of Quick Errands", [3, 4]], ["of the Sprinter", [5, 6]], ["of the Acrobat", [7, 9]]] },
  { group: "stamina", kind: "suffix", stat: "stamina", types: ALL,
    tiers: [["of the Marathon", [1, 2]], ["of Long Shifts", [3, 4]], ["of the Night Owl", [5, 6]], ["of the Insomniac", [7, 9]]] },
  { group: "focus", kind: "suffix", stat: "focus", types: ALL,
    tiers: [["of the Deadline", [1, 2]], ["of Deep Work", [3, 4]], ["of the Flow State", [5, 6]], ["of the Zen Master", [7, 9]]] },
  { group: "resist-fire", kind: "suffix", stat: "resist.fire", types: ALL,
    tiers: [["of the Sprinkler", [5, 10]], ["of the Fire Drill", [11, 18]], ["of the Fire Door", [19, 26]], ["of the Asbestos Wall", [27, 35]]] },
  { group: "resist-cold", kind: "suffix", stat: "resist.cold", types: ALL,
    tiers: [["of the Thermos", [5, 10]], ["of the Space Heater", [11, 18]], ["of the Thermostat", [19, 26]], ["of the Boiler Room", [27, 35]]] },
  { group: "resist-shock", kind: "suffix", stat: "resist.shock", types: ALL,
    tiers: [["of the Power Strip", [5, 10]], ["of the Surge Guard", [11, 18]], ["of the Fuse Box", [19, 26]], ["of the Lightning Rod", [27, 35]]] },
  { group: "resist-acid", kind: "suffix", stat: "resist.acid", types: ALL,
    tiers: [["of the Hazmat Drill", [5, 10]], ["of the Spill Kit", [11, 18]], ["of the Fume Hood", [19, 26]], ["of the Clean Room", [27, 35]]] },
];

/** Flat list of affix definitions: one per group and tier. */
export const affixes = groups.flatMap((g) => g.tiers.map(([name, range], i) => ({
  id: `${g.group}-t${i + 1}`, group: g.group, kind: g.kind, stat: g.stat, name, tier: i + 1,
  types: g.types, minIlvl: T[i], range,
})));
export const affixById = Object.fromEntries(affixes.map((a) => [a.id, a]));
export const affixGroups = groups.map((g) => g.group);

// Rare items get a generated original name: "<adjective> <noun>".
export const rareNames = {
  adjectives: ["Overdue", "Redundant", "Escalated", "Passive-Aggressive", "Offsite", "Confidential", "Mandatory", "Outsourced", "Pending", "Streamlined", "Cross-Functional", "Hostile", "Final", "Revised"],
  nouns: ["Memo", "Deadline", "Reorg", "Bonus", "Audit", "Agenda", "Fiasco", "Quota", "Mandate", "Standup", "Retreat", "Backlog", "Handoff", "Merger"],
};
