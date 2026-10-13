// Camera and projection helpers (pure). Tile coordinates are floats; a tile centre is (x + 0.5, y + 0.5).
import { tileToScreen, screenToTile } from "../core/iso.js";
import { viewScale } from "../ui/layout.js";

/** Camera centred on tile-space point (cx, cy) (already a centre point, e.g. actor pos + 0.5). */
export function makeCamera(w, h, cx, cy) {
  const z = viewScale(w, h), c = tileToScreen(cx, cy);
  return { w, h, z, ox: w / 2 - c.x * z, oy: h / 2 - (c.y - 12) * z, cx, cy };
}

export function worldToScreen(cam, wx, wy) {
  const p = tileToScreen(wx, wy);
  return { x: cam.ox + p.x * cam.z, y: cam.oy + p.y * cam.z };
}

/** Float tile coordinates under a screen point. */
export const screenToWorld = (cam, sx, sy) => screenToTile((sx - cam.ox) / cam.z, (sy - cam.oy) / cam.z);
