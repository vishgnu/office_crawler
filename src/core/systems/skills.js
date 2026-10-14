// Casting the hero's active skills (R-014, R-022). Mana cost only; the effect is data-driven (content/skilltrees, systems/skillfx.js).
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { emit } from "../events.js";
import { posOf } from "../pos.js";
import { skills, manaCost } from "../content/skills.js";
import { runSkill, precheck, effLevel } from "./skillfx.js";
import { toggleAura } from "./progression.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

export const skillLevel = (state, id) => (skills[id]?.kind === "basic" ? 1 : state.player.skills[id] ?? 0);
export { effLevel };

/** Mana a cast costs the hero now: the skill's cost at its effective level, plus the manaCostPct from skills and gear. */
export function castCost(state, def, level) {
  const pct = state.player.mods?.manaCostPct ?? 0;
  return Math.max(0, Math.round((manaCost(def, level) * (100 + pct)) / 100));
}

/**
 * Use skill `id` at `tile` (a map tile in view). Rejects unlearned skills and passives without any cost (AC-R-014-7),
 * and a cast without enough mana with a noMana event (AC-R-022-3). An aura skill is switched on or off instead.
 */
export function castSkill(state, id, tile) {
  const p = state.player, def = Object.hasOwn(skills, id) ? skills[id] : null;
  if (!def || def.kind === "passive") return fail("not an active skill");
  if (def.kind === "basic") return fail("basic attack is not cast");
  const learned = p.skills[id] ?? 0;
  if (learned < 1) return fail("skill not learned");
  if (p.hp <= 0) return fail("player is dead");
  if (def.kind === "aura") { const r = toggleAura(state, id); return r.ok ? OK : fail(r.error); }
  if (p.castT > 0) return fail("busy casting"); // one cast at a time: a double click does not spend mana twice
  const level = effLevel(state, def), cost = castCost(state, def, level);
  if (p.mp < cost) { emit(state, { type: "noMana", skill: id, cost }); return fail("not enough mana"); }
  const to = tile && Number.isInteger(tile.x) && Number.isInteger(tile.y) ? tile : null;
  const bad = precheck(state, def, to);
  if (bad) return fail(bad);

  if (def.archetype !== "projectile" && to && (to.x !== p.tile.x || to.y !== p.tile.y)) {
    const from = posOf(p), dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy);
    p.facing = { x: dx / len, y: dy / len };
  }
  p.mp -= cost;
  emit(state, { type: "cast", skill: id, level, cost, tile: to ? { ...to } : null, archetype: def.archetype, fx: def.fx?.cast ?? null });
  const extra = runSkill(state, def, level, to);
  // The hero stops for the cast: any walking, chasing or pickup order ends (a step in progress is finished).
  p.castT = Math.max(config.castTicks, extra); p.path = []; p.target = null; p.goal = null; p.pickup = null; p.stairs = null; p.interact = null; p.toPortal = false;
  return OK;
}
