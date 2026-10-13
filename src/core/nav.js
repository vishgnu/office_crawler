// Path planning on top of A*: avoids tiles held by other actors, and falls back to terrain only
// (callers then wait for the blocker to move).
import { findPath } from "./pathfind.js";
import { config } from "./config.js";
import { idx } from "./ctx.js";

/**
 * @param goal  target tile. With `adjacent` the goal is an actor's tile and the returned path stops
 *              on a tile next to it (the goal itself is dropped).
 * @returns tile[] (excluding `from`) or null when unreachable.
 */
export function planPath(ctx, from, goal, { adjacent = false, maxNodes = 6000 } = {}) {
  const base = ctx.grid;
  const free = {
    width: base.width, height: base.height,
    walkable: (x, y) => base.walkable(x, y) && (ctx.occ[idx(ctx, { x, y })] === 0 || (adjacent && x === goal.x && y === goal.y)),
  };
  let path = findPath(free, from.x, from.y, goal.x, goal.y, maxNodes, config.pathDiagCost)
    ?? findPath(base, from.x, from.y, goal.x, goal.y, maxNodes, config.pathDiagCost);
  if (path && adjacent) path = path.slice(0, -1);
  return path;
}
