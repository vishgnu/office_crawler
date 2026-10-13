// Uniform-grid spatial hash. Rebuilt on demand (cheap for a few hundred entities); queries return
// items in insertion order so results never depend on bucket layout.
export function createSpatialHash(cell = 8) {
  const buckets = new Map();
  let n = 0;
  const key = (cx, cy) => cy * 65536 + cx;
  return {
    insert(item, x, y) {
      const k = key(Math.floor(x / cell), Math.floor(y / cell));
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push({ item, x, y, n: n++ });
    },
    /** Items within Chebyshev distance r of (x, y). */
    query(x, y, r) {
      const out = [];
      for (let cy = Math.floor((y - r) / cell); cy <= Math.floor((y + r) / cell); cy++)
        for (let cx = Math.floor((x - r) / cell); cx <= Math.floor((x + r) / cell); cx++)
          for (const e of buckets.get(key(cx, cy)) ?? [])
            if (Math.abs(e.x - x) <= r && Math.abs(e.y - y) <= r) out.push(e);
      return out.sort((a, b) => a.n - b.n).map((e) => e.item);
    },
  };
}
