// Walkability grid built from a floor (tiles + blocking props). Pure; cached in ctx.js.
import { isWalkableTile, isOpaqueTile } from "./tiles.js";

export function buildGrid(floor) {
  const { w, h, tiles } = floor;
  const walk = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) walk[i] = isWalkableTile(tiles[i]) ? 1 : 0;
  for (const p of floor.props) if (p.blocks) walk[p.y * w + p.x] = 0;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  return {
    width: w, height: h, walk, inBounds,
    walkable: (x, y) => inBounds(x, y) && walk[y * w + x] === 1,
    // Only walls (and the void) stop sight; props do not.
    opaque: (x, y) => !inBounds(x, y) || isOpaqueTile(tiles[y * w + x]),
  };
}

// Fixed neighbour order keeps every search deterministic.
export const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

// Can an actor on (x, y) step by (dx, dy)? Diagonals may not cut a blocked corner.
export function canStep(grid, x, y, dx, dy) {
  if (!grid.walkable(x + dx, y + dy)) return false;
  return !dx || !dy || (grid.walkable(x + dx, y) && grid.walkable(x, y + dy));
}

// Melee adjacency: one step apart under the same corner rule as movement.
export function isAdjacent(grid, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
  return !dx || !dy || (grid.walkable(a.x + dx, a.y) && grid.walkable(a.x, a.y + dy));
}

// Breadth-first flood from (sx, sy) with the movement rules. dist is -1 where unreachable.
export function flood(grid, sx, sy) {
  const { width: w, height: h } = grid;
  const dist = new Int32Array(w * h).fill(-1);
  if (!grid.walkable(sx, sy)) return { dist, count: 0 };
  const queue = [sx + sy * w];
  dist[sx + sy * w] = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], x = i % w, y = (i - x) / w;
    for (const [dx, dy] of DIRS8) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const j = x + dx + (y + dy) * w;
      if (dist[j] === -1) { dist[j] = dist[i] + 1; queue.push(j); }
    }
  }
  return { dist, count: queue.length };
}
