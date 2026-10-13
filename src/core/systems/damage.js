// Damage rules shared by melee, skills and projectiles: hit chance, applying damage to monsters and to the hero,
// kills (xp, loot), stagger, knock-back and the state-backed floaters (AC-R-024, AC-R-025).
import { config } from "../config.js";
import { emit } from "../events.js";
import { getCtx, idx } from "../ctx.js";
import { dropLoot, releaseCursor } from "./loot.js";
import { gainXp } from "./progression.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Chance that a swing hits (QF-02-1): 2*A/(A+D) * La/(La+Ld), clamped to the config bounds.
 * attacker: { level, attackRating }, defender: { level, defense }.
 */
export function hitChance(att, def) {
  const a = att.attackRating, d = def.defense;
  const raw = (a + d > 0 ? (2 * a) / (a + d) : 1) * (att.level / (att.level + def.level));
  return clamp(raw, config.hitChanceMin, config.hitChanceMax);
}

/** Roll one swing: { hit, damage }. Damage is an integer in [min + bonus, max + bonus]. */
export function rollSwing(rng, att, def, dmg, bonus = 0) {
  if (rng.next() >= hitChance(att, def)) return { hit: false, damage: 0 };
  return { hit: true, damage: rng.int(dmg.min, dmg.max) + bonus };
}

export function floater(state, value, tile, target, kind = "hit") {
  state.floaters.push({ value, tile: { x: tile.x, y: tile.y }, target, kind, life: config.floaterTicks });
  while (state.floaters.length > 40) state.floaters.shift();
}

export function killMonster(state, m, source = "player") {
  const p = state.player;
  m.hp = 0; m.ai = "dead"; m.deathT = 0; m.path = []; m.next = null; m.moveT = 0; m.attackT = 0; m.staggerT = 0; m.muteT = 0;
  const xp = m.xp;
  emit(state, { type: "kill", source, target: m.id, xp });
  gainXp(state, xp);
  dropLoot(state, m);
  if (p.target === m.id) p.target = null;
}

/** Wake a monster that was hit from afar, and its pack. */
export function alert(state, m) {
  if (m.ai !== "idle") return;
  m.ai = "notice"; m.aiT = 1;
  if (m.packId !== null) for (const o of state.monsters) if (o !== m && o.packId === m.packId && o.ai === "idle") { o.ai = "notice"; o.aiT = 1; }
}

/** Push a monster one tile away from `from` if the tile behind it is free (AC-R-024-2). Returns true if it moved. */
export function knockBack(state, m, from) {
  const ctx = getCtx(state);
  const dx = Math.sign(m.tile.x - from.x), dy = Math.sign(m.tile.y - from.y);
  if (!dx && !dy) return false;
  const nx = m.tile.x + dx, ny = m.tile.y + dy;
  const corner = !dx || !dy || (ctx.grid.walkable(m.tile.x + dx, m.tile.y) && ctx.grid.walkable(m.tile.x, m.tile.y + dy));
  if (!ctx.grid.walkable(nx, ny) || !corner || ctx.occ[idx(ctx, { x: nx, y: ny })] !== 0) return false;
  if (state.player.tile.x === nx && state.player.tile.y === ny) return false;
  ctx.occ[idx(ctx, m.tile)] = 0;
  if (m.next) ctx.occ[idx(ctx, m.next)] = 0;
  m.next = null; m.moveT = 0; m.path = [];
  m.tile = { x: nx, y: ny };
  ctx.occ[idx(ctx, m.tile)] = 1;
  return true;
}

/** Apply `amount` damage to a monster: event, floater, flash, kill or stagger/knock-back. */
export function damageMonster(state, m, amount, { source = "player", from = null, knock = false, skill } = {}) {
  if (m.ai === "dead") return;
  m.hp = Math.max(0, m.hp - amount);
  emit(state, { type: "hit", source, target: m.id, value: amount, ...(skill ? { skill } : {}) });
  floater(state, amount, m.tile, m.id);
  m.flashTicks = config.flashTicks;
  alert(state, m);
  if (m.hp === 0) return killMonster(state, m, source);
  if (amount >= config.hitRecoveryMinDamage && m.tier !== "boss") { m.ai = "stagger"; m.staggerT = config.hitRecoveryTicks; m.attackT = 0; m.path = []; m.goal = null; }
  if (knock && from) knockBack(state, m, from);
}

/** Apply damage to the hero; death sets the scene on the same tick (AC-R-023-1). */
export function hurtPlayer(state, source, amount) {
  const p = state.player;
  p.hp = Math.max(0, p.hp - amount);
  emit(state, { type: "hit", source, target: "player", value: amount });
  floater(state, amount, p.tile, "player");
  p.flashTicks = config.flashTicks;
  if (p.hp === 0) {
    p.action = "dead"; p.path = []; p.target = null; p.next = null; p.stairs = null; p.interact = null; p.toPortal = false;
    releaseCursor(state); // QF-02-3: a held item goes back to the inventory, else to the floor
    state.scene = "dead"; // same tick as the killing blow
    emit(state, { type: "death", target: "player" });
  }
}
