// Unique items: fixed names, fixed bases, fixed affix values (AC-R-051-4). flavour is a key into the string table.
// stat uses the same keys as affixes; every unique is independent of the random affix tables.
const u = (id, name, base, minIlvl, affixes, extra = {}) => ({ id, name, base, minIlvl, affixes, flavour: `flavour_${id.replaceAll("-", "_")}`, ...extra });
const a = (stat, value, kind = "prefix") => ({ id: `unique-${stat}`, stat, value, kind });

export const uniques = [
  u("paper-cut", "Paper Cut", "ruler-rapier", 3, [a("damage", 3), a("attackRating", 25), a("agility", 2, "suffix")]),
  u("staple-diet", "Staple Diet", "stapler-mace", 6, [a("damage", 5), a("hpMax", 15), a("grit", 4, "suffix")]),
  u("ctrl-alt-defeat", "Ctrl Alt Defeat", "keyboard-sword", 10, [a("damage", 8), a("attackRating", 40), a("focus", 4, "suffix"), a("resist.shock", 20, "suffix")]),
  u("redundancy-package", "Redundancy Package", "extinguisher-club", 16, [a("damage", 14), a("hpMax", 30), a("resist.fire", 30, "suffix")]),
  u("golden-parachute", "Golden Parachute", "blazer", 9, [a("defense", 14), a("hpMax", 40), a("stamina", 5, "suffix")]),
  u("glass-ceiling", "Glass Ceiling", "hard-hat", 7, [a("defense", 9), a("mpMax", 15), a("resist.cold", 20, "suffix")]),
  u("casual-friday", "Casual Friday", "sneakers", 5, [a("defense", 5), a("agility", 6, "suffix"), a("hpMax", 10)]),
  u("open-door-policy", "Open Door Policy", "clipboard-shield", 8, [a("defense", 12), a("resist.acid", 25, "suffix"), a("resist.fire", 15, "suffix")]),
  u("employee-of-the-month", "Employee of the Month", "id-card", 12, [a("grit", 3, "suffix"), a("agility", 3, "suffix"), a("stamina", 3, "suffix"), a("focus", 3, "suffix"), a("hpMax", 20)]),
  u("pink-slip", "Pink Slip", "rubber-band-ring", 10, [a("damage", 4), a("attackRating", 30), a("mpMax", 10)]),
];
export const uniqueById = Object.fromEntries(uniques.map((x) => [x.id, x]));
