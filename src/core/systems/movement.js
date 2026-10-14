// Tile-to-tile movement for the player and chasing monsters. An actor stands on an integer tile and
// takes `moveTotal` ticks to reach the next one; both tiles are held in the occupancy map meanwhile.
import { config } from "../config.js";
import { getCtx, idx } from "../ctx.js";
import { canStep } from "../grid.js";
import { moveTicksFor } from "../state.js";

/** Advance an in-progress step; returns true when the actor is free to start another. */
function progress(ctx, a) {
  if (!a.next) return true;
  if (++a.moveT < a.moveTotal) return false;
  ctx.occ[idx(ctx, a.tile)] = 0;
  a.tile = a.next; a.next = null; a.moveT = 0;
  return true;
}

/** Try to begin the next step of a.path. Returns "moved", "blocked" or "none". */
function begin(ctx, a, ticksPerTile, mark) {
  if (a.path.length === 0) return "none";
  const t = a.path[0], dx = t.x - a.tile.x, dy = t.y - a.tile.y;
  const legal = Math.max(Math.abs(dx), Math.abs(dy)) === 1 && canStep(ctx.grid, a.tile.x, a.tile.y, dx, dy);
  if (!legal) { a.path = []; return "none"; }
  if (ctx.occ[idx(ctx, t)] !== 0) return "blocked";
  a.path.shift();
  a.next = t; a.moveT = 0;
  a.moveTotal = dx && dy ? Math.round(ticksPerTile * config.diagonalFactor) : ticksPerTile;
  ctx.occ[idx(ctx, t)] = mark;
  return "moved";
}

export function movement(state) {
  const ctx = getCtx(state), p = state.player;
  if (p.hp > 0) {
    if (progress(ctx, p) && p.action !== "attack" && !(p.castT > 0)) {
      const mv = p.mods?.moveSpeedPct ? Math.max(4, Math.round((config.moveTicksPerTile * 100) / Math.max(25, 100 + p.mods.moveSpeedPct))) : config.moveTicksPerTile;
      const r = begin(ctx, p, mv, 2);
      if (r === "blocked") { if (++p.blockedT >= 10) { p.path = []; p.blockedT = 0; } } // give up if the way stays blocked
      else p.blockedT = 0;
    }
    if (p.action !== "attack") p.action = p.castT > 0 ? "cast" : p.next ? "move" : "idle";
  }
  for (const m of state.monsters) {
    if (m.ai === "dead" || m.ai === "stagger" || m.muteT > 0) continue; // staggered and muted monsters stand still
    if (progress(ctx, m) && (m.ai === "chase" || m.ai === "flee")) {
      if (begin(ctx, m, moveTicksFor(m.slowT > 0 ? (m.speed * (100 - m.slowMag)) / 100 : m.speed), 1) === "blocked") { m.path = []; m.repathT = 0; }
    }
  }
}
