// Explored map (R-075): floor.explored is a plain 0/1 array (index y * w + x). Tiles within config.exploreRadius of the hero are
// marked each step; the Lobby counts as explored from the start. A floor's explored tiles persist across visits (state.floors[depth]).
import { config } from "../config.js";

/** Make sure the current floor has a correctly sized explored array and mirror it into state.floors[depth]. */
export function initFloorMap(state) {
  const f = state.floor, n = f.w * f.h;
  if (!Array.isArray(f.explored) || f.explored.length !== n) f.explored = new Array(n).fill(state.depth === 0 ? 1 : 0);
  (state.floors[state.depth] ??= { killed: [], groundItems: [] }).explored = f.explored;
  markExplored(state);
  return f.explored;
}

/** Mark the tiles in the hero's light radius. */
export function markExplored(state) {
  const f = state.floor, e = f.explored;
  if (!e || state.depth === 0) return;
  const t = state.player.tile, r = config.exploreRadius, r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    const y = t.y + dy;
    if (y < 0 || y >= f.h) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = t.x + dx;
      if (x >= 0 && x < f.w && dx * dx + dy * dy <= r2) e[y * f.w + x] = 1;
    }
  }
}

/** Has the tile been explored? Out-of-range tiles are not. */
export function exploredAt(state, x, y) {
  const f = state.floor;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= f.w || y >= f.h) return false;
  if (state.depth === 0) return true;
  return f.explored?.[y * f.w + x] === 1;
}

/** Per-tick system. */
export function explore(state) {
  if (state.depth === 0) return;
  if (!state.floor.explored) initFloorMap(state); else markExplored(state);
}
