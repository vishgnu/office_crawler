// Damage rules shared by melee, skills and projectiles: hit chance, applying damage to monsters and to the hero,
// kills (xp, loot), stagger, knock-back and the state-backed floaters (AC-R-024, AC-R-025).
import { config } from "../config.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { allMonsters as registry } from "../content/monsters.js";
import { onKill } from "./triggers.js";
import { getCtx, idx } from "../ctx.js";
import { dropLoot, releaseCursor } from "./loot.js";
import { gainXp } from "./progression.js";
import { onBossKilled, onMonsterKilled } from "./boss.js";

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
  m.burnT = 0; m.slowT = 0; m.weakenT = 0; m.statusKind = null;
  const xpm = config.xpMult, xp = m.summoned ? 0 : Math.round(m.xp * (m.tier === "boss" || !xpm ? 1 : xpm[Math.min(Math.max(1, state.depth), xpm.length) - 1])); // R8-BAL: config.xpMult is paid at the kill (monsterStats stays non-decreasing, AC-R-031-1); // staff called by the boss give nothing (no farming)
  emit(state, { type: "kill", source, target: m.id, xp });
  gainXp(state, xp);
  if (!m.summoned) dropLoot(state, m);
  if (p.target === m.id) p.target = null;
  if (state.stats) state.stats.kills++;
  if (source === "player") onKill(state, m);
  if (m.tier === "boss") onBossKilled(state, m); else onMonsterKilled(state);
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

/** Fraction of `type` damage a monster ignores (optional `resist` table in the registry; capped, bosses lower). */
export function resistOf(m, type) {
  const r = registry[m.type]?.resist?.[type] ?? 0;
  return Math.min(r, m.tier === "boss" ? config.resistCap.boss : config.resistCap.monster);
}

/** A monster's defense with the weaken debuff applied (defense falls by half the weaken percentage). */
export const effDefense = (m) => (m.weakenT > 0 ? Math.round((m.defense * (200 - m.weakenMag)) / 200) : m.defense);

/**
 * The hero's damage on its way to a monster: the flat damagePct (skills and gear) and one critical roll from the combat stream.
 * Returns { amount, crit }. Without hero modifiers (a bare fixture) the amount is unchanged.
 */
export function playerDamage(state, amount, extraPct = 0) {
  const m = state.player.mods;
  if (!m) return { amount, crit: false };
  let v = Math.round((amount * (100 + m.damagePct + extraPct)) / 100);
  const crit = stream(state, "combat").next() * 100 < m.critChance;
  if (crit) v = Math.round((v * m.critDamage) / 100);
  return { amount: Math.max(1, v), crit };
}

/**
 * Apply `amount` damage to a monster: event, floater, flash, kill or stagger/knock-back.
 * opts: source, from, knock, skill, type (damage type; non-physical types meet the monster's resist), crit, dot (a tick of burn: no stagger).
 */
export function damageMonster(state, m, amount, { source = "player", from = null, knock = false, skill, type, crit = false, dot = false } = {}) {
  if (m.ai === "dead") return;
  const raw = amount;
  if (type && type !== "physical") amount = Math.round(amount * (1 - resistOf(m, type)));
  if (m.weakenT > 0) amount = Math.round((amount * (100 + m.weakenMag)) / 100);
  amount = Math.max(raw > 0 ? 1 : 0, amount);
  m.hp = Math.max(0, m.hp - amount);
  emit(state, { type: "hit", source, target: m.id, value: amount, ...(skill ? { skill } : {}), ...(type ? { damageType: type } : {}), ...(crit ? { crit: true } : {}) });
  if (crit) emit(state, { type: "crit", target: m.id });
  floater(state, amount, m.tile, m.id, crit ? "crit" : "hit");
  if (type && type !== "physical") state.floaters[state.floaters.length - 1].dtype = type;
  m.flashTicks = config.flashTicks;
  alert(state, m);
  if (m.hp === 0) return killMonster(state, m, source);
  if (!dot && amount >= config.hitRecoveryMinDamage && m.tier !== "boss") { m.ai = "stagger"; m.staggerT = config.hitRecoveryTicks; m.attackT = 0; m.path = []; m.goal = null; }
  if (knock && from && m.tier !== "boss") knockBack(state, m, from); // the boss cannot be pushed around
}

/** Apply damage to the hero; death sets the scene on the same tick (AC-R-023-1). A shield (player.absorb) takes the damage first. */
export function hurtPlayer(state, source, amount) {
  const p = state.player;
  if (p.absorb && p.absorb.amount > 0 && amount > 0) {
    const a = p.absorb, take = Math.min(a.amount, amount);
    a.amount -= take; amount -= take;
    emit(state, { type: "absorb", skill: a.skill, amount: take, remaining: a.amount });
    const attacker = a.reflect > 0 ? state.monsters.find((o) => o.id === source) : null;
    if (attacker) damageMonster(state, attacker, Math.max(1, Math.round((take * a.reflect) / 100)), { source: "player", type: a.type ?? "physical", dot: true });
    if (a.amount <= 0) { emit(state, { type: "buffEnd", skill: a.skill }); p.absorb = null; }
    if (amount <= 0) { p.flashTicks = config.flashTicks; return; }
  }
  p.hp = Math.max(0, p.hp - amount);
  emit(state, { type: "hit", source, target: "player", value: amount });
  floater(state, amount, p.tile, "player");
  p.flashTicks = config.flashTicks;
  if (p.hp === 0) {
    p.action = "dead"; p.path = []; p.target = null; p.next = null; p.stairs = null; p.interact = null; p.toPortal = false;
    p.dash = null; p.absorb = null;
    releaseCursor(state); // QF-02-3: a held item goes back to the inventory, else to the floor
    state.scene = "dead"; // same tick as the killing blow
    if (state.stats) state.stats.deaths++;
    emit(state, { type: "death", target: "player" });
  }
}
