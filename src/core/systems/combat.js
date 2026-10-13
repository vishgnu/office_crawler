// Hit resolution and the swing timers of the player and monsters.
import { config } from "../config.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { monsters as registry } from "../content/monsters.js";

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

const monsterAttacker = (m) => ({ level: m.level, attackRating: registry[m.type].attackRating });
const monsterDamage = (m) => {
  const base = registry[m.type].damage, s = config.monsterDamageSpread;
  return { min: Math.max(1, base - s), max: base + s };
};

function killMonster(state, m) {
  const p = state.player;
  m.hp = 0; m.ai = "dead"; m.deathT = 0; m.path = []; m.next = null; m.moveT = 0; m.attackT = 0;
  const xp = registry[m.type].xp;
  p.xp += xp;
  emit(state, { type: "kill", source: "player", target: m.id, xp });
  if (p.target === m.id) p.target = null;
}

function playerSwing(state, ctx) {
  const p = state.player;
  const m = state.monsters.find((o) => o.id === p.swingTarget);
  if (!m || m.ai === "dead" || !isAdjacent(ctx.grid, p.tile, m.tile)) return; // target gone or out of reach: whiff
  const r = rollSwing(stream(state, "combat"), p, { level: m.level, defense: registry[m.type].defense }, p.damage);
  if (!r.hit) return emit(state, { type: "miss", source: "player", target: m.id });
  m.hp = Math.max(0, m.hp - r.damage);
  emit(state, { type: "hit", source: "player", target: m.id, value: r.damage });
  if (m.hp === 0) killMonster(state, m);
}

function monsterSwing(state, ctx, m) {
  const p = state.player;
  if (!isAdjacent(ctx.grid, m.tile, p.tile)) return;
  const r = rollSwing(stream(state, "combat"), monsterAttacker(m), p, monsterDamage(m));
  if (!r.hit) return emit(state, { type: "miss", source: m.id, target: "player" });
  p.hp = Math.max(0, p.hp - r.damage);
  emit(state, { type: "hit", source: m.id, target: "player", value: r.damage });
  if (p.hp === 0) {
    p.action = "dead"; p.path = []; p.target = null; p.next = null;
    state.scene = "dead"; // same tick as the killing blow (AC-R-023-1)
    emit(state, { type: "death", target: "player" });
  }
}

export function combat(state) {
  const ctx = getCtx(state), p = state.player;
  if (p.hp <= 0) return;

  // Player swing: `attackTicks` ticks in action 'attack', then one idle tick before the next swing.
  if (p.action === "attack" && p.attackT >= config.attackTicks) { p.action = "idle"; p.attackT = 0; }
  else {
    if (p.action !== "attack" && p.target && !p.next) {
      const m = state.monsters.find((o) => o.id === p.target);
      if (m && m.ai !== "dead" && isAdjacent(ctx.grid, p.tile, m.tile)) { p.action = "attack"; p.attackT = 0; p.swingTarget = m.id; }
    }
    if (p.action === "attack") {
      p.attackT++;
      if (p.attackT === config.attackHitTick) playerSwing(state, ctx);
    }
  }

  // Monster swings: one full cycle is exactly `monsterAttackTicks`, and a new one starts at once while adjacent.
  for (const m of state.monsters) {
    if (m.ai !== "attack" || state.player.hp <= 0) continue;
    m.attackT++;
    if (m.attackT === config.monsterAttackHitTick) monsterSwing(state, ctx, m);
    if (m.attackT >= config.monsterAttackTicks) m.attackT = 0;
  }
}
