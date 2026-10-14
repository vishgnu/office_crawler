// Allies (ADR-0005 section 3, archetype `summon`): they follow the hero, fight the nearest awake monster, and leave when their shift ends.
// Iterated in array order (= creation order); allies never block the hero or monsters (they only avoid occupied tiles themselves).
import { config } from "../config.js";
import { getCtx, idx } from "../ctx.js";
import { emit } from "../events.js";
import { isAdjacent, canStep } from "../grid.js";
import { planPath } from "../nav.js";
import { allyUnits } from "../content/allies.js";
import { damageMonster } from "./damage.js";

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function nearestMonster(state, a, range) {
  let best = null, bd = Infinity;
  for (const m of state.monsters) {
    if (m.ai === "dead" || m.ai === "idle") continue;
    const d = cheb(a.tile, m.tile);
    if (d <= range && d < bd) { bd = d; best = m; }
  }
  return best;
}

const tileFree = (state, ctx, a, t) => ctx.grid.walkable(t.x, t.y) && ctx.occ[idx(ctx, t)] === 0 && !state.allies.some((o) => o !== a && ((o.tile.x === t.x && o.tile.y === t.y) || (o.next && o.next.x === t.x && o.next.y === t.y)));

export function allies(state) {
  if (state.allies.length === 0) return;
  const ctx = getCtx(state), p = state.player, keep = [];
  for (const a of state.allies) {
    const unit = allyUnits[a.unit];
    if (a.flashTicks > 0) a.flashTicks--;
    if (--a.ttl <= 0) { emit(state, { type: "allyDied", id: a.id, reason: "expired" }); continue; }
    if (a.hp <= 0) { emit(state, { type: "allyDied", id: a.id, reason: "slain" }); continue; }
    keep.push(a);
    if (unit.speed === 0) continue; // a cone stays where it was put
    // movement in progress
    if (a.next) {
      if (++a.moveT < a.moveTotal) continue;
      a.tile = a.next; a.next = null; a.moveT = 0;
    }
    const target = nearestMonster(state, a, unit.sight);
    if (target && isAdjacent(ctx.grid, a.tile, target.tile)) { // fight
      a.attackT++;
      if (a.attackT === unit.hitTick) damageMonster(state, target, Math.max(1, a.damage), { source: "ally", from: a.tile });
      if (a.attackT >= unit.attackTicks) a.attackT = 0;
      continue;
    }
    a.attackT = 0;
    let goal = null, adjacent = false;
    if (target) { goal = target.tile; adjacent = true; }
    else if (cheb(a.tile, p.tile) > config.allyFollowDist) { goal = p.tile; adjacent = true; }
    if (!goal) continue;
    if (!a.path.length || !a.goal || a.goal.x !== goal.x || a.goal.y !== goal.y) {
      a.path = planPath(ctx, a.tile, goal, { adjacent, maxNodes: config.ai.maxPathNodes }) ?? [];
      a.goal = { x: goal.x, y: goal.y };
    }
    const t = a.path[0];
    if (!t) continue;
    const dx = t.x - a.tile.x, dy = t.y - a.tile.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !canStep(ctx.grid, a.tile.x, a.tile.y, dx, dy)) { a.path = []; continue; }
    if (!tileFree(state, ctx, a, t) || (p.tile.x === t.x && p.tile.y === t.y)) { a.path = []; continue; }
    a.path.shift(); a.next = { x: t.x, y: t.y }; a.moveT = 0; a.moveTotal = config.moveTicksPerTile;
  }
  state.allies = keep;
}

/** Hurt an ally (a monster hit it). */
export function hurtAlly(state, a, amount) {
  a.hp = Math.max(0, a.hp - amount); a.flashTicks = config.flashTicks;
  emit(state, { type: "allyHurt", id: a.id, value: amount });
}

/** A living ally within melee reach of monster `m` (a decoy wins the choice), or null. */
export function allyInReach(state, ctx, m) {
  let pick = null;
  for (const a of state.allies) {
    if (a.hp <= 0 || !isAdjacent(ctx.grid, m.tile, a.tile)) continue;
    if (a.taunt) return a;
    pick ??= a;
  }
  return pick;
}
