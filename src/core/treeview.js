// Everything the skill-tree panel and the class selection screen need, computed (R4 contract section 3): the UI renders this
// and never reads SkillDef for rules. Pure: a function of the state, the content tables and the strings table.
import { config } from "./config.js";
import { strings } from "./content/strings.js";
import { skills, skillTrees, at, manaCost } from "./content/skills.js";
import { classes, classById } from "./content/classes.js";
import { deriveStats } from "./items/derive.js";
import { makeItem } from "./items/roll.js";
import { respecCheck, respecCost } from "./systems/progression.js";

const round = Math.round;
const sec = (ticks) => `${+(ticks / config.tickHz).toFixed(1)} s`;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const STATUS_LABEL = { stun: "statStun", mute: "statMute", freeze: "statFreeze", slow: "statSlow", weaken: "statWeaken" };
const STAT_LABEL = { defense: "statDefense", attackRating: "statAttackRating", critChance: "statCrit", critDamage: "statCritDamage", manaCostPct: "statManaUp", hpMax: "statHeal", mpMax: "statMana" };

/** The generic "what does it do at this level" rows, pre-formatted: [{ labelKey, value, type? }]. */
export function effectRows(def, level) {
  const L = Math.max(1, level), rows = [], d = def.delivery ?? {};
  for (const e of def.effects ?? []) {
    switch (e.op) {
      case "damage": rows.push({ labelKey: "statDamage", value: `${round(at(e.min, L))}-${round(at(e.max, L))}`, type: e.type }); break;
      case "dot": rows.push({ labelKey: "statBurn", value: `${round(at(e.perTick, L) * (config.tickHz / (e.every ?? config.dotEvery)))} / ${sec(round(at(e.ticks, L)))}`, type: e.type }); break;
      case "heal": rows.push({ labelKey: "statHeal", value: `${round(at(e.amount, L))}` }); break;
      case "hot": rows.push({ labelKey: "statHealOverTime", value: `${round(at(e.amount, L))} / ${sec(e.every ?? config.dotEvery)}, ${sec(round(at(e.ticks, L)))}` }); break;
      case "status": rows.push({ labelKey: STATUS_LABEL[e.kind], value: e.mag ? `${round(at(e.mag, L))}%, ${sec(round(at(e.ticks, L)))}` : sec(round(at(e.ticks, L))) }); break;
      case "absorb": rows.push({ labelKey: "statAbsorb", value: `${round(at(e.amount, L))}, ${sec(round(at(e.ticks, L)))}` }); if (e.reflectPct) rows.push({ labelKey: "statReflect", value: `${round(at(e.reflectPct, L))}%` }); break;
      case "statMod": {
        const v = round(at(e.value, L));
        if (e.stat.startsWith("resist.")) rows.push({ labelKey: "statResist", value: `+${v}%`, type: e.stat.slice(7) });
        else if (e.stat.startsWith("skillDamagePct.")) rows.push({ labelKey: "statDamageUp", value: `+${v}%`, type: e.stat.slice(15) });
        else rows.push({ labelKey: STAT_LABEL[e.stat] ?? "statDefense", value: e.stat === "critChance" || e.stat === "critDamage" || e.stat === "manaCostPct" ? `+${v}%` : `+${v}` });
        break;
      }
      case "summon": rows.push({ labelKey: "statAllyHealth", value: `${round(at(e.hp, L))}` }); if (e.damage && at(e.damage, L) > 0) rows.push({ labelKey: "statAllyDamage", value: `${round(at(e.damage, L))}` }); break;
      case "execute": rows.push({ labelKey: e.vs === "stagger" ? "statStagger" : "statExecute", value: `x${+at(e.mult, L).toFixed(2)}${e.below ? ` < ${round(e.below * 100)}%` : ""}` }); break;
      case "trigger": for (const t of e.then) rows.push({ labelKey: t.op === "mana" ? "statMana" : "statGold", value: `+${round(at(t.amount, L))}${t.perDepth ? ` +${t.perDepth} / floor` : ""}` }); break;
      default: break;
    }
  }
  if (d.radius !== undefined) rows.push({ labelKey: "statRadius", value: `${+at(d.radius, L).toFixed(1)}` });
  if (d.distance !== undefined) rows.push({ labelKey: "statDistance", value: `${+at(d.distance, L).toFixed(1)}` });
  if (d.count !== undefined && at(d.count, L) > 1 && def.archetype !== "summon") rows.push({ labelKey: "statCount", value: `${Math.floor(at(d.count, L))}` });
  if (d.chain) rows.push({ labelKey: "statChain", value: `${Math.floor(at(d.chain, L))}` });
  if (def.archetype === "summon") rows.push({ labelKey: "statAllies", value: `${Math.floor(at(d.count ?? 1, L))} / ${sec(round(at(d.ticks, L)))}` });
  if (def.cost?.reservePct) rows.push({ labelKey: "statReserve", value: `${def.cost.reservePct}%` });
  return rows;
}

/** One skill node, fully computed for the player's current state. */
export function skillView(state, id) {
  const def = Object.hasOwn(skills, id) ? skills[id] : null;
  if (!def) return null;
  const p = state.player, learned = def.kind === "basic" ? 1 : p.skills[id] ?? 0, cap = Math.min(def.maxLevel, config.skillMaxLevel);
  const bonus = learned > 0 && def.kind !== "basic" ? (p.mods?.skillLevelAll ?? 0) + (p.mods?.skillLevelBranch?.[def.branch] ?? 0) : 0;
  const requires = (def.requires ?? []).map((r) => ({ id: r.id, level: r.level, name: skills[r.id].name, met: (p.skills[r.id] ?? 0) >= r.level }));
  const unmet = requires.find((r) => !r.met);
  let state_ = "available", lockReason = null;
  if (learned >= cap) state_ = "maxed";
  else if (learned > 0) state_ = "learned";
  else if ((def.reqLevel ?? 1) > p.level) { state_ = "locked-level"; lockReason = fill(strings.lockLevel, { n: def.reqLevel }); }
  else if (unmet) { state_ = "locked-prereq"; lockReason = fill(strings.lockPrereq, { name: unmet.name, n: unmet.level }); }
  else if (p.skillPoints < 1) state_ = "no-points";
  const eff = learned + bonus, shown = Math.max(1, eff);
  const sig = classById(def.class)?.signature === id;
  const hot = p.skillBar.hotkeys.indexOf(id);
  return {
    id, name: def.name, textKey: def.textKey, iconKey: def.fx?.icon ?? id, tier: def.tier ?? 0, col: def.col ?? 0, kind: def.kind, archetype: def.archetype, tags: [...(def.tags ?? [])],
    level: learned, bonus, maxLevel: cap, reqLevel: def.reqLevel ?? 1, signature: !!sig, requires, state: state_, lockReason,
    canLearn: def.kind !== "basic" && learned < cap && (learned > 0 || (!unmet && (def.reqLevel ?? 1) <= p.level)) && p.skillPoints >= 1 && def.class === p.class,
    cost: { mana: manaCost(def, shown), cooldown: def.cost?.cooldown ?? 0, reserve: def.cost?.reservePct ?? 0 },
    now: learned > 0 ? effectRows(def, eff) : [],
    next: learned < cap ? effectRows(def, learned + 1 + bonus) : [],
    assigned: hot >= 0 ? hot : null, fx: def.fx ?? null,
  };
}

/** The whole panel for the player's class. */
export function treeView(state) {
  const p = state.player, tree = skillTrees[p.class], cfg = config.respec;
  const reason = respecCheck(state);
  const sig = classById(p.class)?.signature;
  return {
    classId: p.class, points: p.skillPoints, level: p.level,
    respec: { available: reason === null, mode: cfg.mode, cost: respecCost(p), reason },
    branches: (tree?.branches ?? []).map((b) => {
      const nodes = b.skills.map((id) => skillView(state, id));
      const edges = [];
      for (const id of b.skills) for (const r of skills[id].requires ?? []) edges.push({ from: r.id, to: id });
      return { id: b.id, nameKey: b.nameKey, name: strings[b.nameKey], iconKey: b.iconKey, spent: b.skills.reduce((n, id) => n + Math.max(0, (p.skills[id] ?? 0) - (id === sig ? 1 : 0)), 0), nodes, edges };
    }),
  };
}

/** Class selection data (no state needed). */
export function classCards() {
  return classes.map((c) => {
    const eq = c.startKit?.weapon ? { weapon: makeItem(c.startKit.weapon) } : {};
    const s = deriveStats({ class: c.id, level: 1, attrs: { ...c.attrs }, skills: {} }, eq);
    return {
      id: c.id, name: c.name, role: c.role, roleKey: c.role === "melee" ? "classFacilitiesRole" : c.role === "ranged" ? "classSalesRole" : "classItRole", blurbKey: c.blurbKey, figureKey: c.figureKey, attrs: { ...c.attrs },
      derivedPreview: { hp: s.hpMax, mp: s.mpMax, damage: { ...s.damage } },
      branches: skillTrees[c.id].branches.map((b) => ({ id: b.id, nameKey: b.nameKey, name: strings[b.nameKey], iconKey: b.iconKey, skills: b.skills.map((id) => ({ id, iconKey: skills[id].fx.icon, name: skills[id].name })) })),
      signature: c.signature, basic: c.basic, affixTag: c.affixTag,
    };
  });
}
