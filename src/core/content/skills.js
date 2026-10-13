// Skills of the one class (S2-3). Data-driven: `effect` picks the code path in systems/skills.js.
// Mana cost only, no cooldowns (QF-06-5). Values grow with the skill level (AC-R-014-5): level 1 is the base.
// mana(level) -> integer; value(level) -> the effect number the `perLevel` text describes (damage range, heal, radius ...).
const lin = (base, per) => (level) => base + per * (level - 1);

export const skills = {
  strike: { id: "strike", name: "Strike", kind: "basic", maxLevel: 1, effect: "melee", mana: () => 0, text: "skillStrikeText" },

  "stapler-throw": {
    id: "stapler-throw", name: "Stapler Throw", kind: "active", effect: "projectile", maxLevel: 5, text: "skillStaplerText",
    mana: lin(3, 1), dmgMin: lin(4, 2), dmgMax: lin(8, 3), weaponShare: 0.5,
    projectile: { kind: "stapler", speed: 0.35, range: 12 },
    perLevel: "damage",
  },
  "reply-all": {
    id: "reply-all", name: "Reply-All", kind: "active", effect: "burst", maxLevel: 5, text: "skillReplyAllText",
    mana: lin(8, 2), dmgMin: lin(5, 2), dmgMax: lin(10, 3), weaponShare: 0.25, radius: lin(2.5, 0.5), knockback: true,
    perLevel: "area",
  },
  "coffee-break": {
    id: "coffee-break", name: "Coffee Break", kind: "active", effect: "heal", maxLevel: 5, text: "skillCoffeeText",
    mana: lin(8, 1), heal: lin(20, 10),
    perLevel: "heal",
  },
  mute: {
    id: "mute", name: "Mute", kind: "active", effect: "crowd-control", maxLevel: 5, text: "skillMuteText",
    mana: lin(7, 1), radius: lin(4.5, 0.5), duration: lin(90, 30),
    perLevel: "duration",
  },

  "dress-code": { id: "dress-code", name: "Dress Code", kind: "passive", maxLevel: 5, stat: "defense", perLevel: 4, text: "skillDressCodeText" },
  hustle: { id: "hustle", name: "Hustle", kind: "passive", maxLevel: 5, stat: "attackRating", perLevel: 6, text: "skillHustleText" },
};

export const skillList = Object.values(skills);
export const activeSkills = skillList.filter((s) => s.kind === "active");
export const passiveSkills = skillList.filter((s) => s.kind === "passive");
