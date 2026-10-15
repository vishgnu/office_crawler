// Save format migrations. A migration takes the parsed save of version n and returns the parsed save of version n + 1.
// Until a second real format exists, version 0 is a synthetic legacy shape used to test the mechanism (QF-09-5): the hero lived
// under `hero` (gold inside it), and the stats, explored maps, options and random streams did not exist yet.
import { hash32 } from "../core/hash.js";
import { classById, retiredClasses } from "../core/content/classes.js";
import { DEFAULT_NAME } from "../core/name.js";
import { activeMainId } from "../core/systems/questview.js";
import { mainIds } from "../core/content/quests.js";

const maxItemId = (data) => {
  let n = 0;
  const grids = [data.inventory, data.stash].filter(Boolean);
  const all = [...grids.flatMap((g) => g.items ?? []), ...Object.values(data.equipment ?? {}), ...(data.belt ?? [])];
  for (const it of all) { const m = /^i(\d+)$/.exec(it?.id ?? ""); if (m) n = Math.max(n, Number(m[1])); }
  return n + 1;
};

/** The six skills the retired Clerk could learn (version 1 saves hold nothing else). */
const CLERK_SKILLS = ["stapler-throw", "reply-all", "coffee-break", "mute", "dress-code", "hustle"];

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
    // Only a well-formed skill table is refunded; anything else is left as it is so the schema check rejects the save.
    const sk = p.skills, wellFormed = sk && typeof sk === "object" && !Array.isArray(sk) && Object.entries(sk).every(([id, l]) => CLERK_SKILLS.includes(id) && Number.isInteger(l) && l >= 0 && l <= 5);
    if (!wellFormed || !Number.isInteger(p.skillPoints)) return out;
    const spent = Object.values(sk).reduce((n, l) => n + l, 0);
    out.player = { ...p, skillPoints: p.skillPoints + spent, skills: { [cls.signature]: 1 },
      skillBar: { primary: cls.basic, secondary: cls.signature, hotkeys: [cls.signature, null, null, null], selected: 0 }, respecsUsed: 0 };
    return out;
  },
  /**
   * Version 2 to 3 (ADR-0006 amendment, R6 ADV-R6-05): in R5 Grit was the only damage attribute of every class; since R6 a class names its own power
   * attribute (Sales Rep Agility, IT Wizard Focus). For a class whose power attribute is not Grit, every attribute point allocated beyond the class's
   * start values goes back into `attrPoints` and the attributes return to the start values (the player re-spends them; nothing else changes).
   * The Facilities Manager (power attribute Grit) is only re-stamped. A malformed attribute table is left as it is (the schema check rejects it).
   */
  2(d) {
    if (d.version >= 3) return d;
    const out = { ...d, version: 3 }, cls = classById(d.class), p = d.player && typeof d.player === "object" ? d.player : null;
    if (!cls || !p || !(cls.derived?.powerAttr && cls.derived.powerAttr !== "grit")) return out;
    const a = p.attrs, names = ["grit", "agility", "stamina", "focus"];
    if (!a || typeof a !== "object" || Array.isArray(a) || !names.every((k) => Number.isInteger(a[k]) && a[k] >= 0) || !Number.isInteger(p.attrPoints)) return out;
    let refund = 0; const attrs = { ...a };
    for (const k of names) { const extra = Math.max(0, a[k] - (cls.attrs[k] ?? 0)); refund += extra; attrs[k] = a[k] - extra; }
    if (refund > 0) out.player = { ...p, attrs, attrPoints: p.attrPoints + refund };
    return out;
  },
  /**
   * Version 3 to 4 (ADR-0006 amendment "R7 quests", ADR-0007): adds the `quests` block derived from fields every v3 save has. No reward is granted
   * and nothing else is read or changed. `deepestDepth` is 1 from the first tick, so "has left the Lobby" is read from `explored[1]`, `resume.depth` or
   * `stats.kills`. Pure; a version 4 input is returned unchanged; malformed input yields a block the schema check then judges (never throws).
   */
  3(d) {
    if (d.version >= 4) return d;
    const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    const deepest = Number.isInteger(d.deepestDepth) ? d.deepestDepth : 1;
    const left = isObj(d.explored) && d.explored[1] !== undefined || (Number.isInteger(d.resume?.depth) && d.resume.depth >= 1) || (typeof d.stats?.kills === "number" && d.stats.kills > 0);
    const depth = deepest >= 2 ? deepest : left ? 1 : 0, defeated = d.bossDefeated === true;
    return {
      ...d, version: 4,
      quests: {
        main: { m: { memo: depth >= 1, depth, unlocked: d.bossUnlocked === true || defeated, defeated, verdict: false } },
        sq1: { s: "available", p: 0 }, sq2: { s: "available", p: 0 }, sq3: { s: "available", p: 0 }, pinned: "main", pouch: [],
      },
    };
  },
  /**
   * Version 4 to 5 (ADR-0007 amendment "R7-4", ADR-0006 amendment): two new side quests, `sq4` and `sq5`, start `available`; the main quest is now three arcs over the
   * same milestones, so a pin on "main" becomes the arc that is active for them (`main` while arc 1 is open, then `main2`, `main3`, and `main3` when all are done);
   * a pinned side quest stays. No reward is paid and nothing else is read or changed (`m`, `sq1..sq3`, `pouch` and every other field are returned as they are).
   * Pure; a version 5 input is returned unchanged; malformed input is left for the schema check (never throws).
   */
  4(d) {
    if (d.version >= 5) return d;
    const q = d.quests;
    if (q === null || typeof q !== "object" || Array.isArray(q)) return { ...d, version: 5 };
    const quests = { ...q, sq4: { s: "available", p: 0 }, sq5: { s: "available", p: 0 } }, m = q.main?.m;
    if (q.pinned === "main" && m !== null && typeof m === "object" && !Array.isArray(m)) quests.pinned = activeMainId(m) ?? mainIds[mainIds.length - 1];
    return { ...d, version: 5, quests };
  },
  /**
   * Version 5 to 6 (ADR-0006 amendment "R8", CR8-07): the quest block may now hold `owed` (reward items that did not fit the bag). A v5 save never has the key, so
   * nothing but the version changes; the bump exists so that an older build refuses a save with `owed` as "newer" instead of treating the unknown key as damage.
   * Pure; a version 6 input is returned unchanged.
   */
  5(d) {
    if (d.version >= 6) return d;
    return { ...d, version: 6 };
  },
};

/**
 * Bring a parsed save up to `target`. Returns { ok: true, data, notes } or { ok: false, reason: "no-migration", from }.
 * `notes` lists what the player should be told once: { from: 1, refundedPoints: n } for the Clerk migration and { from: 2, attributePointsRefunded: n, attr: the class's power attribute } (only when n > 0) for the power-attribute migration.
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
    if (v === 2) { const n = (d.player?.attrPoints ?? 0) - (before.player?.attrPoints ?? 0); if (n > 0) notes.push({ from: 2, attributePointsRefunded: n, attr: classById(d.class)?.derived?.powerAttr ?? null }); }
    v = d.version;
  }
  return { ok: true, data: d, notes };
}
