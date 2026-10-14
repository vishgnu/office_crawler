// Save format migrations. A migration takes the parsed save of version n and returns the parsed save of version n + 1.
// Until a second real format exists, version 0 is a synthetic legacy shape used to test the mechanism (QF-09-5): the hero lived
// under `hero` (gold inside it), and the stats, explored maps, options and random streams did not exist yet.
import { hash32 } from "../core/hash.js";
import { classById, retiredClasses } from "../core/content/classes.js";
import { DEFAULT_NAME } from "../core/name.js";

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
  /**
   * Version 1 to 2 (ADR-0005 section 9, R-225): the retired Clerk becomes a Facilities Manager. Every spent skill point is refunded
   * (the old skills live on under new owners), the free signature is granted, the skill bar is reset; attributes, items, stash, gold,
   * level, xp, depth, boss flags, explored maps and random streams are kept. New: `name`, `stats.playTicks`, `player.respecsUsed`.
   * Pure; a version 2 input is returned unchanged. An unknown class id is left as it is (the schema check then fails it).
   */
  1(d) {
    if (d.version >= 2) return d;
    const target = retiredClasses[d.class]?.migrateTo ?? d.class, cls = classById(target), p = d.player && typeof d.player === "object" ? d.player : null;
    const out = { ...d, version: 2, class: target, name: DEFAULT_NAME, stats: { ...(d.stats && typeof d.stats === "object" ? d.stats : {}), playTicks: 0 } };
    if (!cls || !p) return out;
    const spent = p.skills && typeof p.skills === "object" && !Array.isArray(p.skills) ? Object.values(p.skills).reduce((n, l) => n + (Number.isInteger(l) && l > 0 ? l : 0), 0) : 0;
    out.player = { ...p, skillPoints: (Number.isInteger(p.skillPoints) ? p.skillPoints : 0) + spent, skills: { [cls.signature]: 1 },
      skillBar: { primary: cls.basic, secondary: cls.signature, hotkeys: [cls.signature, null, null, null], selected: 0 }, respecsUsed: 0 };
    return out;
  },
};

/**
 * Bring a parsed save up to `target`. Returns { ok: true, data, notes } or { ok: false, reason: "no-migration", from }.
 * `notes` lists what the player should be told once: { from: 1, refundedPoints: n } for the Clerk migration.
 */
export function migrate(data, target) {
  let d = data, v = d.version;
  const notes = [];
  while (v < target) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: "no-migration", from: v };
    const before = d;
    d = step(structuredClone(d));
    if (d.version !== v + 1) return { ok: false, reason: "no-migration", from: v };
    if (v === 1) notes.push({ from: 1, refundedPoints: (d.player?.skillPoints ?? 0) - (before.player?.skillPoints ?? 0) });
    v = d.version;
  }
  return { ok: true, data: d, notes };
}
