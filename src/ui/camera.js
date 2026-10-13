// Camera and projection helpers (pure; shared by the renderer, input picking and the game shell).
// Tile coordinates are floats; a tile centre is (x + 0.5, y + 0.5).
import { tileToScreen, screenToTile } from "../core/iso.js";
import { viewScale, viewConfig } from "./layout.js";

/** Pixels per logical unit: HUD scale times the world zoom (a config value, `?zoom=` overrides it). */
export const worldScale = (w, h, zoom = viewConfig.zoom) => viewScale(w, h) * zoom;

/** Camera centred on tile-space point (cx, cy) (already a centre point, e.g. actor pos + 0.5). */
export function makeCamera(w, h, cx, cy, zoom = viewConfig.zoom, shiftX = 0) {
  const z = worldScale(w, h, zoom), c = tileToScreen(cx, cy);
  return { w, h, z, ox: w / 2 + shiftX - c.x * z, oy: h / 2 - (c.y - 12) * z, cx, cy };
}

export function worldToScreen(cam, wx, wy) {
  const p = tileToScreen(wx, wy);
  return { x: cam.ox + p.x * cam.z, y: cam.oy + p.y * cam.z };
}

/** Allocation-free variant for hot loops: writes into `out` and returns it. */
export function project(cam, wx, wy, out) {
  out.x = cam.ox + (wx - wy) * 32 * cam.z;
  out.y = cam.oy + (wx + wy) * 16 * cam.z;
  return out;
}

/** Float tile coordinates under a screen point. */
export const screenToWorld = (cam, sx, sy) => screenToTile((sx - cam.ox) / cam.z, (sy - cam.oy) / cam.z);

/**
 * Frame-rate independent follow: moves `cur` towards `target` (exponential, time constant tauMs) and never
 * lets it lag further than maxLag tiles. Pure; writes into `out` (default: a new object).
 */
export function easeFollow(cur, target, dtMs, tauMs = viewConfig.easeTauMs, maxLag = viewConfig.maxLagTiles, out = {}) {
  const k = tauMs > 0 ? 1 - Math.exp(-Math.max(0, dtMs) / tauMs) : 1;
  let x = cur.x + (target.x - cur.x) * k, y = cur.y + (target.y - cur.y) * k;
  const dx = x - target.x, dy = y - target.y, d = Math.hypot(dx, dy);
  if (d > maxLag) { x = target.x + (dx / d) * maxLag; y = target.y + (dy / d) * maxLag; }
  out.x = x; out.y = y;
  return out;
}
