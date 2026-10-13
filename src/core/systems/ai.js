// Monster behaviour: idle -> notice -> chase -> attack. Movement itself happens in movement.js.
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { hasLineOfSight } from "../los.js";
import { planPath } from "../nav.js";
import { allMonsters as registry } from "../content/monsters.js";

function canSee(ctx, m, p) {
  const r = registry[m.type].sightRange, dx = p.tile.x - m.tile.x, dy = p.tile.y - m.tile.y;
  return dx * dx + dy * dy <= r * r && hasLineOfSight(ctx.grid, m.tile.x, m.tile.y, p.tile.x, p.tile.y);
}

/** A ranged monster shoots from where it stands when the hero is in range with a clear line (AC-R-032-8). */
export function canShoot(ctx, m, p) {
  const r = registry[m.type].range, dx = p.tile.x - m.tile.x, dy = p.tile.y - m.tile.y;
  return dx * dx + dy * dy <= r * r && hasLineOfSight(ctx.grid, m.tile.x, m.tile.y, p.tile.x, p.tile.y);
}

/** In position to attack: adjacent for melee types, in range with a clear line for ranged ones. */
const inPosition = (ctx, m, p) => (registry[m.type].behaviour === "ranged" ? canShoot(ctx, m, p) : isAdjacent(ctx.grid, m.tile, p.tile));

/** Pick a reachable tile far from the hero and path there, preferring a way that never passes closer to the hero than the monster is now. */
function startFlee(state, ctx, m, p) {
  const cands = [], cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  for (let dy = -10; dy <= 10; dy += 2) for (let dx = -10; dx <= 10; dx += 2) {
    const x = m.tile.x + dx, y = m.tile.y + dy;
    if (ctx.grid.walkable(x, y)) cands.push({ x, y, d: (x - p.tile.x) * (x - p.tile.x) + (y - p.tile.y) * (y - p.tile.y) });
  }
  cands.sort((a, b) => b.d - a.d || a.y - b.y || a.x - b.x);
  const d0 = cheb(m.tile, p.tile);
  let best = null, bestMin = -1;
  for (const c of cands.slice(0, 12)) {
    const path = planPath(ctx, m.next ?? m.tile, c, { maxNodes: config.ai.maxPathNodes });
    if (!path || !path.length) continue;
    const near = Math.min(...path.slice(0, 6).map((t) => cheb(t, p.tile)));
    if (near >= d0) { best = { path, c }; break; }
    if (near > bestMin) { bestMin = near; best = { path, c }; }
  }
  if (best) { m.path = best.path; m.goal = { x: best.c.x, y: best.c.y }; } else m.path = [];
}

function wakePack(state, m) {
  if (m.packId === null) return;
  for (const o of state.monsters) if (o !== m && o.packId === m.packId && o.ai === "idle") { o.ai = "notice"; o.aiT = 1; }
}

function chase(ctx, m, p) {
  if (m.repathT > 0) m.repathT--;
  const stale = !m.goal || m.goal.x !== p.tile.x || m.goal.y !== p.tile.y;
  if ((m.path.length === 0 || stale) && m.repathT === 0) {
    m.path = planPath(ctx, m.next ?? m.tile, p.tile, { adjacent: true, maxNodes: config.ai.maxPathNodes }) ?? [];
    m.goal = { ...p.tile };
    m.repathT = config.ai.repathTicks; // also rate-limits searches towards an unreachable player
  }
}

export function ai(state) {
  const ctx = getCtx(state), p = state.player;
  for (const m of state.monsters) {
    if (m.ai === "dead" || m.muteT > 0) continue; // muted monsters do nothing (the Mute skill)
    const still = !m.next;
    // Weak swarmers run away once, below fleeHpFraction of their health (QF-03-2).
    if (registry[m.type].canFlee && !m.fled && m.ai !== "stagger" && m.ai !== "flee" && m.hp / m.hpMax < config.fleeHpFraction) {
      m.fled = true; m.ai = "flee"; m.fleeT = config.fleeTicks; m.attackT = 0; m.repathT = 0; startFlee(state, ctx, m, p);
    }
    switch (m.ai) {
      case "idle":
        if (canSee(ctx, m, p)) { m.ai = "notice"; m.aiT = 1; wakePack(state, m); }
        break;
      case "notice":
        if (++m.aiT >= config.noticeTicks) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        break;
      case "chase":
        if (still && inPosition(ctx, m, p)) { m.ai = "attack"; m.attackT = 0; m.path = []; }
        else chase(ctx, m, p);
        break;
      case "attack":
        // Between swings, close the distance again if the player has moved away.
        if (m.attackT === 0 && !(still && inPosition(ctx, m, p))) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        break;
      case "stagger": // hit recovery: no attack, no move (AC-R-024-1)
        if (--m.staggerT <= 0) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        break;
      case "flee":
        if (--m.fleeT <= 0) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        else if (still && m.path.length === 0 && m.repathT-- <= 0) { startFlee(state, ctx, m, p); m.repathT = config.ai.repathTicks; }
        break;
    }
  }
}
