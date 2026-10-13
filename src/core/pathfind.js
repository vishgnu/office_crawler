// A* on a tile grid with 8-way movement (no corner cutting). grid.walkable(x, y) → boolean.
export function findPath(grid, sx, sy, gx, gy, maxNodes = 4000) {
  sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
  if (!grid.walkable(gx, gy)) return null;
  const key = (x, y) => y * grid.width + x;
  const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
  const open = new MinHeap();
  const g = new Map([[key(sx, sy), 0]]);
  const came = new Map();
  open.push(h(sx, sy), sx, sy);
  let expanded = 0;
  while (open.size) {
    const [, x, y] = open.pop();
    if (x === gx && y === gy) {
      const path = [{ x, y }];
      let k = key(x, y);
      while (came.has(k)) { const p = came.get(k); path.push(p); k = key(p.x, p.y); }
      return path.reverse().slice(1);
    }
    if (++expanded > maxNodes) return null;
    const gc = g.get(key(x, y));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!grid.walkable(nx, ny)) continue;
      if (dx && dy && (!grid.walkable(x + dx, y) || !grid.walkable(x, y + dy))) continue;
      const ng = gc + (dx && dy ? Math.SQRT2 : 1);
      const nk = key(nx, ny);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, { x, y }); open.push(ng + h(nx, ny), nx, ny); }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(p, x, y) {
    const a = this.a; a.push([p, x, y]);
    let i = a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}
