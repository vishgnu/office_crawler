// Save format migrations. A migration takes the parsed save of version n and returns the parsed save of version n + 1.
// Until a second real format exists, version 0 is a synthetic legacy shape used to test the mechanism (QF-09-5): the hero lived
// under `hero` (gold inside it), and the stats, explored maps, options and random streams did not exist yet.
import { hash32 } from "../core/hash.js";

const maxItemId = (data) => {
  let n = 0;
  const grids = [data.inventory, data.stash].filter(Boolean);
  const all = [...grids.flatMap((g) => g.items ?? []), ...Object.values(data.equipment ?? {}), ...(data.belt ?? [])];
  for (const it of all) { const m = /^i(\d+)$/.exec(it?.id ?? ""); if (m) n = Math.max(n, Number(m[1])); }
  return n + 1;
};

export const MIGRATIONS = {
  0(d) {
    const { hero, gold, ...rest } = d;
    const seed = rest.seed >>> 0;
    return {
      ...rest, version: 1, format: "office-crawler-save",
      savedAtTick: 0, resume: { depth: 0 }, bossUnlocked: false, townVisit: 0, cursorItem: null, uniquesFound: [],
      nextItemId: maxItemId(rest), stats: { kills: 0, deaths: 0, bossAttempts: 0 }, explored: {}, options: rest.options ?? {},
      rng: Object.fromEntries(["world", "combat", "ai", "loot"].map((n, i) => [n, { s: hash32(seed, 100 + i) }])),
      player: { ...hero, gold: hero?.gold ?? gold ?? 0 },
    };
  },
};

/** Bring a parsed save up to `target`. Returns { ok: true, data } or { ok: false, reason: "no-migration", from }. */
export function migrate(data, target) {
  let d = data, v = d.version;
  while (v < target) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: "no-migration", from: v };
    d = step(structuredClone(d));
    if (d.version !== v + 1) return { ok: false, reason: "no-migration", from: v };
    v = d.version;
  }
  return { ok: true, data: d };
}
