// Places monster packs and singles on reachable floor tiles, away from the stairs.
import { buildGrid, flood } from "../grid.js";
import { monsters } from "../content/monsters.js";
import { config } from "../config.js";

export function populate(rng, floor) {
  const grid = buildGrid(floor);
  const { dist } = flood(grid, floor.entry.x, floor.entry.y);
  const { w, h } = floor;
  const types = Object.values(monsters).filter((t) => t.minDepth <= floor.depth);
  const weighted = types.flatMap((t) => Array(t.weight).fill(t));
  const used = new Set([floor.entry, floor.exit].map((t) => t.y * w + t.x));
  const spawns = [];
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const free = (x, y) => grid.walkable(x, y) && dist[y * w + x] >= 0 && !used.has(y * w + x) && cheb({ x, y }, floor.entry) > config.safeRadius;
  const anyTile = () => { for (let i = 0; i < 80; i++) { const x = rng.int(1, w - 2), y = rng.int(1, h - 2); if (free(x, y)) return { x, y }; } return null; };

  let packs = 0;
  for (let want = rng.int(3, 5), tries = 0; packs < want && tries < 60; tries++) {
    const type = rng.pick(weighted), first = anyTile();
    if (!first) continue;
    const size = rng.int(type.pack[0], type.pack[1]);
    const members = [first];
    used.add(first.y * w + first.x);
    for (let k = 0; k < 40 && members.length < size; k++) {
      const x = first.x + rng.int(-config.packRadius, config.packRadius), y = first.y + rng.int(-config.packRadius, config.packRadius);
      if (grid.inBounds(x, y) && free(x, y)) { members.push({ x, y }); used.add(y * w + x); }
    }
    if (members.length < 2) { for (const m of members) used.delete(m.y * w + m.x); continue; } // a pack needs 2+
    packs++;
    for (const t of members) spawns.push({ type: type.id, tile: t, packId: `p${packs}` });
  }
  if (config.singlesAllowed) {
    for (let i = rng.int(0, 2); i > 0; i--) {
      const t = anyTile();
      if (!t) break;
      used.add(t.y * w + t.x);
      spawns.push({ type: rng.pick(weighted).id, tile: t, packId: null });
    }
  }
  floor.spawns = spawns;
}
