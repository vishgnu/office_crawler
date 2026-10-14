// Skills (ADR-0005). Data only: the three class trees live in content/skilltrees/*.js and are merged here.
// A numeric value that grows with the skill level is a curve [base, perLevel, cap?]; at(curve, level) evaluates it.
// Mana cost only, no cooldowns (QF-06-5; `cost.cooldown` is always 0). The exports keep the pre-R4 import `skills` working (id lookup).
import { facilities } from "./skilltrees/facilities.js";
import { sales } from "./skilltrees/sales.js";
import { it } from "./skilltrees/it.js";

/** Curve value at a skill level (level 1 = base). A plain number is a constant. */
export function at(curve, level) {
  if (typeof curve === "number") return curve;
  const [base, per = 0, cap] = curve;
  const v = base + per * (Math.max(1, level) - 1);
  return cap === undefined ? v : Math.min(cap, v);
}

/** Mana cost at a level: an integer (rounded). */
export const manaCost = (def, level) => Math.max(0, Math.round(at(def.cost?.mana ?? 0, Math.max(1, level))));

export const basics = {
  strike: { id: "strike", class: null, name: "Strike", textKey: "skillStrikeText", kind: "basic", archetype: "melee", maxLevel: 1, reqLevel: 1, requires: [], tags: ["physical", "melee"],
    cost: { mana: [0, 0], cooldown: 0, reservePct: 0 }, delivery: { range: 1 }, effects: [{ op: "damage", type: "physical", min: [0, 0], max: [0, 0], weaponShare: 1 }], fx: { cast: null, hit: null, icon: "strike" } },
  toss: { id: "toss", class: "sales-rep", name: "Toss", textKey: "skillTossText", kind: "basic", archetype: "projectile", maxLevel: 1, reqLevel: 1, requires: [], tags: ["physical", "projectile"],
    cost: { mana: [0, 0], cooldown: 0, reservePct: 0 }, delivery: { kind: "paper", speed: 0.35, range: 7, count: [1, 0], spreadDeg: 0, pierce: 0, chain: 0 },
    effects: [{ op: "damage", type: "physical", min: [2, 0], max: [4, 0], weaponShare: 0.6 }], fx: { cast: "fx:paper", hit: null, icon: "toss" } },
  zap: { id: "zap", class: "it-wizard", name: "Zap", textKey: "skillZapText", kind: "basic", archetype: "projectile", maxLevel: 1, reqLevel: 1, requires: [], tags: ["shock", "projectile"],
    cost: { mana: [0, 0], cooldown: 0, reservePct: 0 }, delivery: { kind: "zap", speed: 0.5, range: 6, count: [1, 0], spreadDeg: 0, pierce: 0, chain: 0 },
    effects: [{ op: "damage", type: "shock", min: [2, 0], max: [4, 0], weaponShare: 0.5 }], fx: { cast: "fx:bolt", hit: null, icon: "zap" } },
};

const trees = [facilities, sales, it];
/** { [classId]: { branches: [{ id, nameKey, iconKey, skills: [skillId] }], skills: { [id]: SkillDef } } } */
export const skillTrees = Object.fromEntries(trees.map((t) => [t.classId, {
  branches: t.branches.map((b) => ({ ...b, skills: [...b.skills] })),
  skills: Object.fromEntries(t.skills.map((s) => [s.id, s])),
}]));

/** Flat table of every skill, basics included. */
export const skills = { ...basics };
for (const t of Object.values(skillTrees)) Object.assign(skills, t.skills);
// Compatibility accessor for pre-R4 callers (the old HUD and skill panel call def.mana(level)): non-enumerable, so the data stays plain JSON.
for (const def of Object.values(skills)) Object.defineProperty(def, "mana", { value: (level) => manaCost(def, level), enumerable: false });

export const skillList = Object.values(skills);
export const activeSkills = skillList.filter((s) => s.kind === "active");
export const passiveSkills = skillList.filter((s) => s.kind === "passive");
export const auraSkills = skillList.filter((s) => s.kind === "aura");
/** Branch id of a skill (null for basics). */
export const branchOf = (id) => skills[id]?.branch ?? null;
