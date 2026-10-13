// Isometric 2:1 projection. Tile (tx, ty) → screen (sx, sy) relative to the camera origin.
export const TILE_W = 64;
export const TILE_H = 32;

export function tileToScreen(tx, ty) {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

export function screenToTile(sx, sy) {
  const a = sx / (TILE_W / 2), b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Painter's order key: draw lower (larger tx+ty) later. */
export const depth = (tx, ty) => tx + ty;
