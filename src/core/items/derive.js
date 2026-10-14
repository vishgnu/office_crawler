// Derived stats (AC-R-012): a pure function of level, attributes, class, learned skills, active buffs / aura and equipped gear.
import { config } from "../config.js";
import { skills, at } from "../content/skills.js";
import { classById, defaultClass } from "../content/classes.js";

const ROUND = { floor: Math.floor, round: Math.round, ceil: Math.ceil };
const ATTRS = ["grit", "agility", "stamina", "focus"];
// Gear stats (and skill statMods) that end up in `mods` rather than in a base stat.
const MOD_KEYS = ["damagePct", "critChance", "critDamage", "moveSpeedPct", "regenHp", "regenMp", "manaCostPct"];

/** Sum of everything gear adds, by stat key (affixes use the same keys; item bases add damage and defense). */
export function gearTotals(equipment = {}) {
  const t = { damageMin: 0, damageMax: 0, defense: 0, hpMax: 0, mpMax: 0, attackRating: 0, grit: 0, agility: 0, stamina: 0, focus: 0, resist: {} };
  for (const type of config.damageTypes) t.resist[type] = 0;
  t.armed = false; // a weapon with base damage is worn: it replaces the unarmed range
  for (const item of Object.values(equipment)) {
    if (!item) continue; // a two-handed weapon sits in the weapon slot only
    if (item.damage) { t.armed = true; t.damageMin += item.damage.min; t.damageMax += item.damage.max; }
    t.defense += item.defense ?? 0;
    for (const a of item.affixes ?? []) {
      if (a.stat === "damage") { t.damageMin += a.value; t.damageMax += a.value; }
      else if (a.stat.startsWith("resist.")) t.resist[a.stat.slice(7)] = (t.resist[a.stat.slice(7)] ?? 0) + a.value;
      else t[a.stat] = (t[a.stat] ?? 0) + a.value;
    }
  }
  return t;
}

/** Bonus levels gear gives to a learned skill (class-tagged affixes: skillLevel.all and skillLevel.branch.<id>). */
export const skillBonus = (g, def) => (g["skillLevel.all"] ?? 0) + (g[`skillLevel.branch.${def.branch}`] ?? 0);

/** The class's derived constants: config.derived with the class overrides merged key by key. */
export function derivedFor(classId) {
  const { unarmed, ...over } = (classById(classId) ?? classById(defaultClass)).derived ?? {};
  return { d: { ...config.derived, ...over }, unarmed: unarmed ?? config.unarmed };
}

/**
 * deriveStats(player, equipment) -> { attrs, hpMax, mpMax, damage, defense, attackRating, resist, mods, reserve }.
 * `attrs` are the totals (own points plus gear). Pure; rounding as config.derived.rounding.
 * `mods`: damagePct, critChance (percent, base included), critDamage (percent, base included), moveSpeedPct, regenHp, regenMp, manaCostPct,
 * skillDamagePct {tag: pct}, skillLevelAll, skillLevelBranch {branch: n}. `reserve`: mana held by the active aura.
 */
export function deriveStats(player, equipment = player.equipment ?? {}) {
  const { d, unarmed } = derivedFor(player.class), r = ROUND[d.rounding] ?? Math.floor, g = gearTotals(equipment);
  const attrs = {};
  for (const k of ATTRS) attrs[k] = (player.attrs?.[k] ?? 0) + g[k];
  const gritBonus = Math.max(0, attrs.grit - d.gritFree);
  const flat = { defense: 0, attackRating: 0, hpMax: 0, mpMax: 0 }, resistAdd = {};
  const mods = { damagePct: 0, critChance: 0, critDamage: 0, moveSpeedPct: 0, regenHp: 0, regenMp: 0, manaCostPct: 0, skillDamagePct: {}, skillLevelAll: g["skillLevel.all"] ?? 0, skillLevelBranch: {} };
  for (const k of MOD_KEYS) mods[k] += g[k] ?? 0;
  for (const [k, v] of Object.entries(g)) {
    if (k.startsWith("skillDamagePct.")) mods.skillDamagePct[k.slice(15)] = (mods.skillDamagePct[k.slice(15)] ?? 0) + v;
    else if (k.startsWith("skillLevel.branch.")) mods.skillLevelBranch[k.slice(18)] = v;
  }
  const add = (stat, v) => {
    if (stat in flat) flat[stat] += v;
    else if (stat.startsWith("resist.")) resistAdd[stat.slice(7)] = (resistAdd[stat.slice(7)] ?? 0) + v;
    else if (stat.startsWith("skillDamagePct.")) mods.skillDamagePct[stat.slice(15)] = (mods.skillDamagePct[stat.slice(15)] ?? 0) + v;
    else if (stat in mods && typeof mods[stat] === "number") mods[stat] += v;
  };
  const fold = (def, eff) => { for (const e of def.effects ?? []) if (e.op === "statMod") add(e.stat, Math.round(at(e.value, eff))); };
  // Learned passives and the active aura add their statMods at the effective level (learned + gear bonus).
  for (const [id, learned] of Object.entries(player.skills ?? {})) {
    const def = skills[id];
    if (!def || !(learned > 0)) continue;
    if (def.kind === "passive" || (def.kind === "aura" && player.aura === id)) fold(def, learned + skillBonus(g, def));
  }
  for (const b of player.buffs ?? []) if (b.stat !== "hot") add(b.stat, b.value);
  const un = g.armed ? { min: 0, max: 0 } : unarmed, cap = config.caps;
  const resist = {};
  for (const type of new Set([...Object.keys(g.resist), ...Object.keys(resistAdd)])) resist[type] = Math.min(cap.resist, (g.resist[type] ?? 0) + (resistAdd[type] ?? 0));
  const hpMax = r(d.hpBase + player.level * d.hpPerLevel + attrs.stamina * d.hpPerStamina) + g.hpMax + flat.hpMax;
  const mpMax = r(d.mpBase + player.level * d.mpPerLevel + attrs.focus * d.mpPerFocus) + g.mpMax + flat.mpMax;
  const aura = player.aura && skills[player.aura]?.kind === "aura" && player.skills?.[player.aura] > 0 ? skills[player.aura] : null;
  mods.critChance = Math.min(75, config.crit.chance + mods.critChance);
  mods.critDamage = config.crit.damage + mods.critDamage;
  return {
    attrs, hpMax, mpMax,
    damage: {
      min: r(un.min + gritBonus * d.damagePerGrit.min) + g.damageMin,
      max: r(un.max + gritBonus * d.damagePerGrit.max) + g.damageMax,
    },
    defense: Math.min(cap.defense, r(d.defenseBase + attrs.agility * d.defensePerAgility) + g.defense + flat.defense),
    attackRating: Math.min(cap.attackRating, r(d.attackRatingBase + attrs.agility * d.attackRatingPerAgility) + g.attackRating + flat.attackRating),
    resist, mods,
    reserve: aura ? Math.floor((mpMax * (aura.cost?.reservePct ?? 0)) / 100) : 0,
  };
}

/** Write derived stats onto the player. hp/mp are clamped, not refilled, unless `fill` (level-up, AC-R-012-3). Mana held by an aura is not usable. */
export function applyDerived(state, { fill = false } = {}) {
  const p = state.player, s = deriveStats(p, state.equipment);
  p.attrsTotal = s.attrs; p.hpMax = s.hpMax; p.mpMax = s.mpMax; p.damage = s.damage;
  p.defense = s.defense; p.attackRating = s.attackRating; p.resist = s.resist; p.mods = s.mods; p.mpReserved = s.reserve;
  if (fill) { p.hp = p.hpMax; p.mp = p.mpMax - p.mpReserved; }
  else { p.hp = Math.min(p.hp, p.hpMax); p.mp = Math.min(p.mp, p.mpMax - p.mpReserved); }
}
