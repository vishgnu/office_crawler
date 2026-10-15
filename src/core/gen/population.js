// Places monster packs, singles and champion packs on reachable floor tiles, away from the stairs.
// The population spends a depth-scaled budget (R-034): sum of cost * tierFactor over all spawns stays within floor.budget.
import { buildGrid, flood } from "../grid.js";
import { monsters, championModIds } from "../content/monsters.js";
import { config } from "../config.js";

export const floorBudget = (depth) => config.budgetBase + config.budgetPerDepth * (Math.max(1, depth) - 1);

export function populate(rng, floor) {
  const grid = buildGrid(floor);
  const { dist } = flood(grid, floor.entry.x, floor.entry.y);
  const { w, h } = floor;
  floor.budget = floorBudget(floor.depth);
  const types = Object.values(monsters).filter((t) => t.minDepth <= floor.depth);
  const weighted = types.flatMap((t) => Array(t.weight).fill(t));
  const used = new Set([floor.entry, floor.exit].map((t) => t.y * w + t.x));
  const spawns = [];
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const free = (x, y) => grid.walkable(x, y) && dist[y * w + x] >= 0 && !used.has(y * w + x) && cheb({ x, y }, floor.entry) > config.safeRadius && dist[y * w + x] >= (config.population.early?.[floor.depth]?.minDist ?? 0);
  const anyTile = () => { for (let i = 0; i < 80; i++) { const x = rng.int(1, w - 2), y = rng.int(1, h - 2); if (free(x, y)) return { x, y }; } return null; };
  let spent = 0;
  const early = config.population.early?.[floor.depth] ?? null, gap = early ? early.packGap : 0; // R8-B1: no two packs of the tutorial floor within this many tiles
  const apart = (x, y, own = []) => !gap || spawns.every((sp) => own.includes(sp.tile) || Math.max(Math.abs(sp.tile.x - x), Math.abs(sp.tile.y - y)) >= gap);

  // Champion modifiers: 1 to championMaxMods distinct ones (more of them deeper down).
  const rollMods = () => {
    const max = Math.min(config.championMaxMods, 1 + Math.floor((floor.depth - 1) / 3));
    const n = rng.int(1, max), pool = [...championModIds], mods = [];
    while (mods.length < n && pool.length) mods.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return mods;
  };

  // A champion pack comes first so the budget cannot starve it: its leader is a champion, the rest are normal.
  let packs = 0;
  const champPack = floor.depth >= 2 && rng.next() < config.championChance;
  const [wantLo, wantHi] = config.population.packsWanted;
  for (let tries = 0, want = wantLo + rng.int(0, wantHi - wantLo); tries < config.population.tries && spent < floor.budget && packs < config.population.maxPacks; tries++) {
    const champ = champPack && packs === 0;
    const type = rng.pick(champ ? weighted.filter((t) => t.pack[1] > 1) : weighted), first = anyTile();
    if (!first || !type || !apart(first.x, first.y)) continue;
    if (type.pack[1] === 1) { // elites come alone
      const cost = type.cost * config.tierFactor[champ ? "champion" : "normal"];
      if (spent + cost > floor.budget) continue;
      used.add(first.y * w + first.x); spent += cost;
      spawns.push({ type: type.id, tile: first, packId: null, ...(champ ? { tier: "champion", mods: rollMods() } : {}) });
      continue;
    }
    let size = champ ? rng.int(config.championPackSize[0], config.championPackSize[1]) : rng.int(type.pack[0], type.pack[1]);
    // R8-B1: floor 1 is the tutorial. Packs are pairs, no spawn within `minDist` path steps of the way in, and no two packs within `packGap` tiles (a level-1 hero meets two monsters at a time, not six).
    if (early) size = Math.min(size, early.packMax);
    const members = [first];
    used.add(first.y * w + first.x);
    for (let k = 0; k < 40 && members.length < size; k++) {
      const x = first.x + rng.int(-config.packRadius, config.packRadius), y = first.y + rng.int(-config.packRadius, config.packRadius);
      if (grid.inBounds(x, y) && free(x, y) && apart(x, y, [])) { members.push({ x, y }); used.add(y * w + x); }
    }
    const cost = type.cost * (members.length - 1 + config.tierFactor[champ ? "champion" : "normal"]);
    if (members.length < 2 || spent + cost > floor.budget) { for (const m of members) used.delete(m.y * w + m.x); continue; } // a pack needs 2+ and must be affordable
    packs++; spent += cost;
    const mods = champ ? rollMods() : null;
    members.forEach((t, i) => spawns.push({ type: type.id, tile: t, packId: `p${packs}`, ...(champ && i === 0 ? { tier: "champion", mods } : {}) }));
    if (packs >= want && spent >= floor.budget * config.population.stopAtBudget) break;
  }
  floor.spawns = spawns;
}
