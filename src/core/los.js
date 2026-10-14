// Integer Bresenham line of sight between tile centres. Start and end tiles do not block.
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== x1 || y !== y1) && grid.opaque(x, y)) return false;
  }
  return true;
}

/**
 * Is the straight flight of a projectile from tile `a` to tile `b` free of walls? Samples the ray every quarter tile with the rounding the
 * projectile system uses (a shot ends in the first opaque tile it rounds into), so "clear" here means a shot really arrives.
 */
export function rayClear(grid, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(len / 0.25);
  for (let i = 1; i < n; i++) {
    const x = Math.round(a.x + (dx * i) / n), y = Math.round(a.y + (dy * i) / n);
    if ((x !== b.x || y !== b.y) && grid.opaque(x, y)) return false;
  }
  return true;
}
