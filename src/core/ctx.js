// Non-serialised helpers derived from state (walk grid, occupancy). Cached per floor object, so a
// cloned or loaded state simply rebuilds them on first use.
import { buildGrid } from "./grid.js";

const cache = new WeakMap();

export function getCtx(state) {
  let c = cache.get(state.floor);
  if (!c) {
    const grid = buildGrid(state.floor);
    c = { grid, occ: new Uint8Array(grid.width * grid.height) };
    cache.set(state.floor, c);
  }
  return c;
}

export const idx = (ctx, t) => t.y * ctx.grid.width + t.x;

// Occupancy: 1 = monster, 2 = player. A moving actor holds both its tile and the tile it moves to.
export function rebuildOccupancy(state, ctx) {
  ctx.occ.fill(0);
  for (const m of state.monsters) {
    if (m.ai === "dead") continue;
    ctx.occ[idx(ctx, m.tile)] = 1;
    if (m.next) ctx.occ[idx(ctx, m.next)] = 1;
  }
  const p = state.player;
  ctx.occ[idx(ctx, p.tile)] = 2;
  if (p.next) ctx.occ[idx(ctx, p.next)] = 2;
}
