// Experience, levels, attribute and skill points, the skill bar (R-013..R-016).
import { config } from "../config.js";
import { emit } from "../events.js";
import { applyDerived } from "../items/derive.js";
import { skills } from "../content/skills.js";

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

/** Learn or upgrade a skill with a skill point (R-014). A newly learned active skill takes the first free hotkey. */
export function learnSkill(state, id) {
  const p = state.player, def = skills[id];
  if (!def || def.kind === "basic") return fail("unknown skill");
  const k = p.skills[id] ?? 0;
  if (p.skillPoints < 1) return fail("no skill points");
  if (k >= Math.min(def.maxLevel, config.skillMaxLevel)) return fail("skill at max level");
  p.skills[id] = k + 1; p.skillPoints--;
  if (def.kind === "active" && k === 0 && !p.skillBar.hotkeys.includes(id)) {
    const free = p.skillBar.hotkeys.indexOf(null);
    if (free >= 0) { p.skillBar.hotkeys[free] = id; syncBar(p.skillBar); }
  }
  applyDerived(state);
  emit(state, { type: "skillLearned", skill: id, level: k + 1 });
  return OK;
}

/** Assign a skill to the primary slot or to hotkey slot 0..3 (R-015). Unlearned skills are rejected; the basic attack always works. */
export function assignSkill(state, slot, id) {
  const bar = state.player.skillBar, def = skills[id];
  if (id !== null && (!def || def.kind === "passive")) return fail("cannot assign");
  if (id !== null && def.kind === "active" && !(state.player.skills[id] > 0)) return fail("skill not learned");
  if (slot === "primary") { if (id !== null && id !== "strike") return fail("primary slot takes the basic attack"); bar.primary = id ?? "strike"; }
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
