// Hit resolution and the swing timers of the player and monsters.
import { config } from "../config.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { allMonsters as registry } from "../content/monsters.js";
import { hurtPlayer, damageMonster, rollSwing, floater } from "./damage.js";
import { fireProjectile } from "./projectiles.js";
import { canShoot } from "./ai.js";
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
  if (!m || m.ai === "dead" || !isAdjacent(ctx.grid, p.tile, m.tile)) return; // target gone or out of reach: whiff
  const r = rollSwing(stream(state, "combat"), p, { level: m.level, defense: m.defense }, p.damage);
  if (!r.hit) { floater(state, 0, m.tile, m.id, "miss"); return emit(state, { type: "miss", source: "player", target: m.id }); }
  damageMonster(state, m, r.damage, { source: "player" });
}

function monsterSwing(state, ctx, m) {
  const p = state.player, def = registry[m.type];
  if (def.behaviour === "ranged") { // a projectile through the shared projectile code (AC-R-022-4)
    if (!canShoot(ctx, m, p)) return;
    const d = monsterDamage(m);
    fireProjectile(state, posOf(m), posOf(p), { owner: m.id, kind: def.projectile.kind, speed: def.projectile.speed, range: def.range + 3, dmg: d, att: monsterAttacker(m) });
    return;
  }
  if (!isAdjacent(ctx.grid, m.tile, p.tile)) return;
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
      if (m && m.ai !== "dead" && isAdjacent(ctx.grid, p.tile, m.tile)) { p.action = "attack"; p.attackT = 0; p.swingTarget = m.id; }
    }
    if (p.action === "attack") {
      p.attackT++;
      if (p.attackT === config.attackHitTick) playerSwing(state, ctx);
    }
  }

  // Monster swings: one full cycle is exactly `monsterAttackTicks`, and a new one starts at once while adjacent.
  for (const m of state.monsters) {
    if (m.ai !== "attack" || state.player.hp <= 0 || m.muteT > 0) continue;
    m.attackT++;
    if (m.attackT === config.monsterAttackHitTick) monsterSwing(state, ctx, m);
    if (m.attackT >= config.monsterAttackTicks) m.attackT = 0;
  }
}
