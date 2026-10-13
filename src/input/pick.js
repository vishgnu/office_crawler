// Screen point -> what the player means (pure). Monsters win over the floor tile (sprite box test).
import { screenToWorld, worldToScreen } from "../render/view.js";

/**
 * actors: [{ id, tile:{x,y}, pos:{x,y} (float), dead }]. Returns { tile:{x,y}, monsterId|null }.
 * A monster is hit when the point is inside a box around its sprite; the lowest on screen wins.
 */
export function pick(cam, actors, sx, sy) {
  let best = null, bestY = -Infinity;
  for (const a of actors) {
    if (a.dead) continue;
    const f = worldToScreen(cam, a.pos.x + 0.5, a.pos.y + 0.5);
    const dx = sx - f.x, dy = sy - f.y;
    if (Math.abs(dx) <= 20 * cam.z && dy >= -46 * cam.z && dy <= 8 * cam.z && f.y > bestY) { best = a; bestY = f.y; }
  }
  if (best) return { tile: { x: best.tile.x, y: best.tile.y }, monsterId: best.id };
  const t = screenToWorld(cam, sx, sy);
  return { tile: { x: Math.floor(t.x + 1e-9), y: Math.floor(t.y + 1e-9) }, monsterId: null };
}
