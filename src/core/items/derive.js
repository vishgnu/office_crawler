// Derived stats (AC-R-012): a pure function of level, attributes and equipped gear.
import { config } from "../config.js";
import { passiveSkills } from "../content/skills.js";

const ROUND = { floor: Math.floor, round: Math.round, ceil: Math.ceil };
const ATTRS = ["grit", "agility", "stamina", "focus"];

/** Sum of everything gear adds, by stat key (affixes use the same keys; item bases add damage and defense). */
export function gearTotals(equipment = {}) {
  const t = { damageMin: 0, damageMax: 0, defense: 0, hpMax: 0, mpMax: 0, attackRating: 0, grit: 0, agility: 0, stamina: 0, focus: 0, resist: {} };
  for (const type of config.damageTypes) t.resist[type] = 0;
  const seen = new Set();
  for (const item of Object.values(equipment)) {
    if (!item || seen.has(item)) continue; // a two-handed weapon is listed once
    seen.add(item);
    if (item.damage) { t.damageMin += item.damage.min; t.damageMax += item.damage.max; }
    t.defense += item.defense ?? 0;
    for (const a of item.affixes ?? []) {
      if (a.stat === "damage") { t.damageMin += a.value; t.damageMax += a.value; }
      else if (a.stat.startsWith("resist.")) t.resist[a.stat.slice(7)] = (t.resist[a.stat.slice(7)] ?? 0) + a.value;
      else t[a.stat] = (t[a.stat] ?? 0) + a.value;
    }
  }
  return t;
}

/**
 * deriveStats(player, equipment) -> { attrs, hpMax, mpMax, damage, defense, attackRating, resist }.
 * `attrs` are the totals (own points plus gear). Pure; rounding as config.derived.rounding.
 */
export function deriveStats(player, equipment = player.equipment ?? {}) {
  const d = config.derived, r = ROUND[d.rounding] ?? Math.floor, g = gearTotals(equipment);
  const attrs = {};
  for (const k of ATTRS) attrs[k] = (player.attrs?.[k] ?? 0) + g[k];
  const gritBonus = Math.max(0, attrs.grit - d.gritFree);
  // Passive skills add their stat per level (AC-R-014-6).
  const passive = { defense: 0, attackRating: 0, hpMax: 0, mpMax: 0 };
  for (const s of passiveSkills) passive[s.stat] += s.perLevel * (player.skills?.[s.id] ?? 0);
  return {
    attrs,
    hpMax: r(d.hpBase + player.level * d.hpPerLevel + attrs.stamina * d.hpPerStamina) + g.hpMax + passive.hpMax,
    mpMax: r(d.mpBase + player.level * d.mpPerLevel + attrs.focus * d.mpPerFocus) + g.mpMax + passive.mpMax,
    damage: {
      min: r(config.unarmed.min + gritBonus * d.damagePerGrit.min) + g.damageMin,
      max: r(config.unarmed.max + gritBonus * d.damagePerGrit.max) + g.damageMax,
    },
    defense: r(d.defenseBase + attrs.agility * d.defensePerAgility) + g.defense + passive.defense,
    attackRating: r(d.attackRatingBase + attrs.agility * d.attackRatingPerAgility) + g.attackRating + passive.attackRating,
    resist: g.resist,
  };
}

/** Write derived stats onto the player. hp/mp are clamped, not refilled, unless `fill` (level-up, AC-R-012-3). */
export function applyDerived(state, { fill = false } = {}) {
  const p = state.player, s = deriveStats(p, state.equipment);
  p.attrsTotal = s.attrs; p.hpMax = s.hpMax; p.mpMax = s.mpMax; p.damage = s.damage;
  p.defense = s.defense; p.attackRating = s.attackRating; p.resist = s.resist;
  if (fill) { p.hp = p.hpMax; p.mp = p.mpMax; }
  else { p.hp = Math.min(p.hp, p.hpMax); p.mp = Math.min(p.mp, p.mpMax); }
}
