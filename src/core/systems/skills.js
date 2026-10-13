// Casting the hero's active skills (R-014, R-022). Mana cost only; effects are data-driven by `effect` (content/skills.js).
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { hasLineOfSight } from "../los.js";
import { posOf } from "../pos.js";
import { skills } from "../content/skills.js";
import { fireProjectile } from "./projectiles.js";
import { damageMonster, floater, alert } from "./damage.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

/** Mean of the equipped weapon's damage range, scaled by the skill's weapon share (skills grow with gear). */
const weaponBonus = (p, def) => Math.floor(((p.damage.min + p.damage.max) / 2) * (def.weaponShare ?? 0));

export const skillLevel = (state, id) => (id === "strike" ? 1 : state.player.skills[id] ?? 0);

/**
 * Use skill `id` at `tile` (a map tile in view). Rejects unlearned skills and passives without any cost (AC-R-014-7),
 * and a cast without enough mana with a noMana event (AC-R-022-3).
 */
export function castSkill(state, id, tile) {
  const p = state.player, def = skills[id];
  if (!def || def.kind === "passive") return fail("not an active skill");
  if (def.kind === "basic") return fail("basic attack is not cast");
  const level = skillLevel(state, id);
  if (level < 1) return fail("skill not learned");
  if (p.hp <= 0) return fail("player is dead");
  if (p.castT > 0) return fail("busy casting"); // one cast at a time: a double click does not spend mana twice
  const cost = def.mana(level);
  if (p.mp < cost) { emit(state, { type: "noMana", skill: id, cost }); return fail("not enough mana"); }
  const ctx = getCtx(state), from = posOf(p), rng = stream(state, "combat");
  const to = tile && Number.isInteger(tile.x) && Number.isInteger(tile.y) ? tile : null;

  if (def.effect === "projectile") {
    if (!to) return fail("needs a target tile");
    const pr = fireProjectile(state, from, to, {
      owner: "player", kind: def.projectile.kind, speed: def.projectile.speed, range: def.projectile.range,
      dmg: { min: def.dmgMin(level), max: def.dmgMax(level) }, bonus: weaponBonus(p, def), att: p, skill: id,
    });
    if (!pr) return fail("no direction");
    p.facing = { x: pr.dir.x, y: pr.dir.y };
  } else if (to && (to.x !== p.tile.x || to.y !== p.tile.y)) {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy);
    p.facing = { x: dx / len, y: dy / len };
  }

  p.mp -= cost;
  emit(state, { type: "cast", skill: id, level, cost, tile: to ? { ...to } : null });

  if (def.effect === "heal") {
    const before = p.hp;
    p.hp = Math.min(p.hpMax, p.hp + def.heal(level));
    emit(state, { type: "heal", skill: id, value: p.hp - before });
    if (p.hp > before) floater(state, p.hp - before, p.tile, "player", "heal");
  } else if (def.effect === "burst" || def.effect === "crowd-control") {
    const r = def.radius(level), r2 = r * r;
    emit(state, { type: "burst", skill: id, tile: { ...p.tile }, radius: r });
    for (const m of state.monsters) {
      if (m.ai === "dead") continue;
      const q = posOf(m), d2 = (q.x - from.x) * (q.x - from.x) + (q.y - from.y) * (q.y - from.y);
      if (d2 > r2 || !hasLineOfSight(ctx.grid, p.tile.x, p.tile.y, m.tile.x, m.tile.y)) continue;
      if (def.effect === "burst") {
        const dmg = rng.int(def.dmgMin(level), def.dmgMax(level)) + weaponBonus(p, def);
        damageMonster(state, m, dmg, { source: "player", from: p.tile, knock: !!def.knockback, skill: id });
      } else if (m.tier === "boss") {
        emit(state, { type: "resisted", target: m.id, skill: id }); // the boss shrugs off Mute (config: bosses cannot be silenced)
      } else {
        m.muteT = def.duration(level); m.path = []; m.attackT = 0; alert(state, m);
        emit(state, { type: "muted", target: m.id, ticks: m.muteT });
      }
    }
  }
  // The hero stops for the cast: any walking, chasing or pickup order ends (a step in progress is finished).
  p.castT = config.castTicks; p.path = []; p.target = null; p.goal = null; p.pickup = null; p.stairs = null; p.interact = null; p.toPortal = false;
  return OK;
}
