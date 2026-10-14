// Experience, levels, attribute and skill points, the skill bar (R-013..R-016).
import { config } from "../config.js";
import { emit } from "../events.js";
import { applyDerived } from "../items/derive.js";
import { skills } from "../content/skills.js";
import { classById } from "../content/classes.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
export const ATTRS = ["grit", "agility", "stamina", "focus"];

export const xpNextFor = (level) => config.xpTable[Math.min(level, config.levelCap - 1)];

/** Add xp (once per kill). Crossing thresholds raises the level, grants points and refills health and mana (AC-R-013-3/-4). */
export function gainXp(state, amount) {
  const p = state.player;
  if (!(amount > 0)) return 0;
  p.xp = Math.min(config.xpPastCap, p.xp + amount); // at the cap xp keeps counting for display (QF-06-2)
  let gained = 0;
  while (p.level < config.levelCap && p.xp >= config.xpTable[p.level]) { p.level++; gained++; }
  if (gained) {
    p.attrPoints += config.attrPointsPerLevel * gained;
    p.skillPoints += config.skillPointsPerLevel * gained;
    applyDerived(state, { fill: true });
    emit(state, { type: "levelup", level: p.level, levels: gained });
  }
  p.xpNext = xpNextFor(p.level);
  return gained;
}

/** Spend one attribute point (R-016). */
export function allocate(state, attr) {
  const p = state.player;
  if (!ATTRS.includes(attr)) return fail("unknown attribute");
  if (p.attrPoints < 1) return fail("no attribute points");
  p.attrs[attr]++; p.attrPoints--;
  applyDerived(state);
  emit(state, { type: "allocate", attr });
  return OK;
}

/** The skill bar's secondary slot follows the selected hotkey (QF-01-4). */
export const syncBar = (bar) => { bar.secondary = bar.hotkeys[bar.selected] ?? null; };

const isCastable = (def) => def.kind === "active" || def.kind === "aura";

/**
 * Learn or upgrade a skill with a skill point (R-014, ADR-0005 section 2). Rejections spend nothing and return a stable code:
 * unknown-skill, basic, wrong-class, level-gate, prereq, no-points, max-level. A newly learned active skill takes the first free hotkey.
 */
export function learnSkill(state, id) {
  const p = state.player, def = Object.hasOwn(skills, id) ? skills[id] : null;
  if (!def) return fail("unknown-skill");
  if (def.kind === "basic") return fail("basic");
  if (def.class !== p.class) return fail("wrong-class");
  if ((def.reqLevel ?? 1) > p.level) return fail("level-gate");
  for (const r of def.requires ?? []) if ((p.skills[r.id] ?? 0) < r.level) return fail("prereq");
  const k = p.skills[id] ?? 0;
  if (p.skillPoints < 1) return fail("no-points");
  if (k >= Math.min(def.maxLevel, config.skillMaxLevel)) return fail("max-level");
  p.skills[id] = k + 1; p.skillPoints--;
  if (isCastable(def) && k === 0 && !p.skillBar.hotkeys.includes(id)) {
    const free = p.skillBar.hotkeys.indexOf(null);
    if (free >= 0) { p.skillBar.hotkeys[free] = id; syncBar(p.skillBar); }
  }
  applyDerived(state);
  emit(state, { type: "skillLearned", skill: id, level: k + 1 });
  return OK;
}

/** Assign a skill to the primary slot or to hotkey slot 0..3 (R-015). Unlearned skills are rejected; the class's basic attack always works. */
export function assignSkill(state, slot, id) {
  const p = state.player, bar = p.skillBar, def = id === null ? null : Object.hasOwn(skills, id) ? skills[id] : null;
  const basic = classById(p.class)?.basic ?? "strike";
  if (id !== null && (!def || def.kind === "passive")) return fail("cannot assign");
  if (id !== null && def.kind === "basic" && id !== basic) return fail("cannot assign");
  if (id !== null && isCastable(def) && !(p.skills[id] > 0)) return fail("skill not learned");
  if (slot === "primary") { if (id !== null && id !== basic) return fail("primary slot takes the basic attack"); bar.primary = basic; }
  else if (Number.isInteger(slot) && slot >= 0 && slot < bar.hotkeys.length) { bar.hotkeys[slot] = id; syncBar(bar); }
  else return fail("unknown slot");
  return OK;
}

/** F1-F4: select the skill the right mouse button uses. */
export function selectSkill(state, index) {
  const bar = state.player.skillBar;
  if (!Number.isInteger(index) || index < 0 || index >= bar.hotkeys.length) return fail("unknown hotkey");
  bar.selected = index; syncBar(bar);
  emit(state, { type: "skillSelected", index, skill: bar.secondary });
  return OK;
}

/** Points a respec would give back: every learned level except the free signature level. */
export function refundable(p) {
  const sig = classById(p.class)?.signature;
  let n = 0;
  for (const [id, lv] of Object.entries(p.skills)) n += id === sig ? Math.max(0, lv - 1) : lv;
  return n;
}

/** Cost of a respec in gold under config.respec (0 in mode free and once). */
export const respecCost = (p) => (config.respec.mode === "gold" ? config.respec.goldBase + config.respec.goldPerLevel * p.level : 0);

/**
 * Respec (ADR-0005 section 8): lobby only, hero alive. Every skill but the signature goes back as points; hotkeys of removed actives
 * empty; buffs, aura, allies and zones clear. Errors: respec-off, not-in-town, dead, respec-used, nothing-to-respec (modes once and gold), no-gold.
 */
export function respecCheck(state) {
  const p = state.player, cfg = config.respec;
  if (cfg.mode === "off") return "respec-off";
  if (state.scene === "dead" || p.hp <= 0) return "dead";
  if (cfg.townOnly && state.scene !== "town") return "not-in-town";
  if (cfg.mode === "once" && p.respecsUsed >= 1) return "respec-used";
  if ((cfg.mode === "once" || cfg.mode === "gold") && refundable(p) === 0) return "nothing-to-respec"; // ADV-R6-02: nothing to give back costs nothing and uses up nothing
  if (p.gold < respecCost(p)) return "no-gold";
  return null;
}

export function respec(state) {
  const p = state.player, bad = respecCheck(state);
  if (bad) return bad === "nothing-to-respec" ? { ok: false, error: bad, reason: bad } : fail(bad);
  const cost = respecCost(p), sig = classById(p.class)?.signature, refunded = refundable(p);
  p.gold -= cost;
  p.skills = sig ? { [sig]: 1 } : {};
  p.skillPoints += refunded;
  const bar = p.skillBar;
  bar.hotkeys = bar.hotkeys.map((id) => (id === sig ? id : null));
  syncBar(bar);
  p.buffs = []; p.absorb = null; p.aura = null; p.dash = null;
  state.allies = []; state.zones = [];
  p.respecsUsed++;
  applyDerived(state);
  emit(state, { type: "respec", refunded });
  return OK;
}

/** Switch an aura skill on (reserving its share of mana) or off. One aura at a time. Errors: not-aura, not-learned, no-mana, dead. */
export function toggleAura(state, id) {
  const p = state.player, def = Object.hasOwn(skills, id) ? skills[id] : null;
  if (!def || def.kind !== "aura") return fail("not-aura");
  if (!(p.skills[id] > 0)) return fail("not-learned");
  if (p.hp <= 0) return fail("dead");
  if (p.aura === id) { p.aura = null; applyDerived(state); emit(state, { type: "aura", skill: id, on: false }); return OK; }
  const reserve = Math.floor((p.mpMax * (def.cost?.reservePct ?? 0)) / 100);
  if (p.mp < Math.max(reserve, config.auraMinCost)) return fail("no-mana");
  const before = p.aura;
  p.aura = id; applyDerived(state);
  if (before) emit(state, { type: "aura", skill: before, on: false });
  emit(state, { type: "aura", skill: id, on: true });
  return OK;
}
