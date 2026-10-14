// Hit resolution and the swing timers of the player and monsters.
import { config } from "../config.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { allMonsters as registry } from "../content/monsters.js";
import { hurtPlayer, damageMonster, rollSwing, floater, playerDamage, effDefense } from "./damage.js";
import { fireProjectile } from "./projectiles.js";
import { canShoot } from "./ai.js";
import { inBasicReach, isRangedBasic } from "./basic.js";
import { fireBasic } from "./skillfx.js";
import { allyInReach, hurtAlly } from "./allies.js";
import { posOf } from "../pos.js";

export { hitChance, rollSwing } from "./damage.js";

const monsterAttacker = (m) => ({ level: m.level, attackRating: m.attackRating });
const monsterDamage = (m) => {
  const base = m.damage, s = config.monsterDamageSpread;
  return { min: Math.max(1, base - s), max: base + s };
};

function playerSwing(state, ctx) {
  const p = state.player;
  const m = state.monsters.find((o) => o.id === p.swingTarget);
  if (!m || m.ai === "dead" || !inBasicReach(state, ctx, p.tile, m.tile)) return; // target gone or out of reach: whiff
  if (isRangedBasic(state)) { p.facing = faceTo(p.tile, m.tile); fireBasic(state, m); return; } // toss and zap shoot (free, short range)
  const r = rollSwing(stream(state, "combat"), p, { level: m.level, defense: effDefense(m) }, p.damage);
  if (!r.hit) { floater(state, 0, m.tile, m.id, "miss"); return emit(state, { type: "miss", source: "player", target: m.id }); }
  const d = playerDamage(state, r.damage);
  damageMonster(state, m, d.amount, { source: "player", crit: d.crit });
}

const faceTo = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1; return { x: dx / l, y: dy / l }; };

function monsterSwing(state, ctx, m) {
  const p = state.player, def = registry[m.type];
  if (def.behaviour === "ranged") { // a projectile through the shared projectile code (AC-R-022-4)
    if (!canShoot(ctx, m, p)) return;
    const d = monsterDamage(m);
    fireProjectile(state, posOf(m), posOf(p), { owner: m.id, kind: def.projectile.kind, speed: def.projectile.speed, range: def.range + 3, dmg: d, att: monsterAttacker(m) });
    return;
  }
  // melee: a decoy (taunt) in reach takes the blow instead of the hero, any other ally only when the hero is out of reach
  const ally = state.allies.length ? allyInReach(state, ctx, m) : null, near = isAdjacent(ctx.grid, m.tile, p.tile);
  if (ally && (ally.taunt || !near)) { hurtAlly(state, ally, monsterDamage(m).min + Math.floor((monsterDamage(m).max - monsterDamage(m).min) / 2)); return; }
  if (!near) return;
  const r = rollSwing(stream(state, "combat"), monsterAttacker(m), p, monsterDamage(m));
  if (!r.hit) return emit(state, { type: "miss", source: m.id, target: "player" });
  hurtPlayer(state, m.id, r.damage);
}

export function combat(state) {
  const ctx = getCtx(state), p = state.player;
  if (p.hp <= 0) return;

  // Player swing: `attackTicks` ticks in action 'attack', then one idle tick before the next swing.
  if (p.action === "attack" && p.attackT >= config.attackTicks) { p.action = "idle"; p.attackT = 0; }
  else {
    if (p.action !== "attack" && p.target && !p.next && !(p.castT > 0)) {
      const m = state.monsters.find((o) => o.id === p.target);
      if (m && m.ai !== "dead" && inBasicReach(state, ctx, p.tile, m.tile)) { p.action = "attack"; p.attackT = 0; p.swingTarget = m.id; }
    }
    if (p.action === "attack") {
      p.attackT++;
      if (p.attackT === config.attackHitTick) playerSwing(state, ctx);
    }
  }

  // Monster swings: one full cycle is exactly `monsterAttackTicks`, and a new one starts at once while adjacent.
  for (const m of state.monsters) {
    if (m.ai !== "attack" || state.player.hp <= 0 || m.muteT > 0) continue;
    if (m.slowT > 0 && (state.tick * 7) % 100 < m.slowMag) continue; // slowed: a share of the ticks does not advance the swing
    m.attackT++;
    if (m.attackT === config.monsterAttackHitTick) monsterSwing(state, ctx, m);
    if (m.attackT >= config.monsterAttackTicks) m.attackT = 0;
  }
}
