// Seeded PRNG (mulberry32). All randomness goes through this so runs are reproducible.
// `rngOn(box)` runs the generator on a `{ s }` holder, so the simulation can keep its
// named streams inside the (serialisable) game state. `createRng(seed)` owns its own box.
export function rngOn(box) {
  const next = () => {
    box.s = (box.s + 0x6d2b79f5) >>> 0;
    let t = box.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    getState: () => box.s,
    setState: (s) => { box.s = s >>> 0; },
  };
}

// No wall-clock default: callers always pass a seed (main.js does, using Date.now()).
export function createRng(seed = 1) {
  return rngOn({ s: seed >>> 0 });
}
