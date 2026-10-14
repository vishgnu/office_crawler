// Item generation (AC-R-050..052). Pure: everything random comes from the rng passed in.
// rollItem(rng, { ilvl, depth, rarity, minRarity, maxRarity, slot, base, taken }) -> item (no id; state.js mints ids).
import { config } from "../config.js";
import { bases, gearBases, potionBases, rarityOrder } from "../content/items.js";
import { affixes } from "../content/affixes.js";
import { rareNames } from "../content/affixes.js";
import { uniques, uniqueById } from "../content/uniques.js";

const decayPow = (k) => { let w = 1; for (let i = 0; i < k; i++) w *= config.affixTierDecay; return w; }; // no ** in core (determinism lint)
const rank = (r) => rarityOrder.indexOf(r);

function weightedPick(rng, entries) { // entries: [[value, weight], ...]
  let total = 0;
  for (const [, w] of entries) total += w;
  if (total <= 0) return entries.length ? entries[0][0] : null;
  let roll = rng.next() * total;
  for (const [v, w] of entries) { roll -= w; if (roll < 0) return v; }
  return entries[entries.length - 1][0];
}

/** Rarity weights shift towards better rarities with depth. Always consumes exactly one random number. */
export function rarityWeights(depth = 1, minRarity = "normal", maxRarity = "unique") {
  const base = config.rarityWeights, shift = config.rarityDepthShift * Math.max(0, depth - 1);
  const w = {
    normal: Math.max(1, base.normal - shift), magic: base.magic + shift * 0.6,
    rare: base.rare + shift * 0.3, unique: base.unique + shift * 0.1,
  };
  for (const r of rarityOrder) if (rank(r) < rank(minRarity) || rank(r) > rank(maxRarity)) w[r] = 0;
  return w;
}

export function rollRarity(rng, depth = 1, minRarity = "normal", maxRarity = "unique") {
  const w = rarityWeights(depth, minRarity, maxRarity);
  return weightedPick(rng, rarityOrder.map((r) => [r, w[r]]));
}

/** One affix value: an integer within the range, both ends reachable (AC-R-052-2). */
export const rollAffixValue = (rng, def) => rng.int(def.range[0], def.range[1]);

const affixRecord = (def, value) => ({ id: def.id, group: def.group, kind: def.kind, stat: def.stat, name: def.name, tier: def.tier, value, range: [def.range[0], def.range[1]], ...(def.class ? { class: def.class } : {}) });

/**
 * Random affixes for an item type and level: unique ids, one per stat group, at most maxPrefixes/maxSuffixes.
 * The group is picked first (every open group equally likely), then its tier: only tiers unlocked at `ilvl` are candidates and
 * the highest unlocked tier weighs 1, each lower one config.affixTierDecay times the next one up (level-weighted, S2 review).
 */
export function rollAffixes(rng, type, ilvl, count, affixTag = null) {
  const pool = affixes.filter((a) => a.types.includes(type) && a.minIlvl <= ilvl && (!a.class || a.class === affixTag)); // class-tagged groups only for their class
  const out = [], groups = new Set(), kinds = { prefix: 0, suffix: 0 };
  const cap = { prefix: config.maxPrefixes, suffix: config.maxSuffixes };
  for (let i = 0; i < count; i++) {
    const open = pool.filter((a) => !groups.has(a.group) && kinds[a.kind] < cap[a.kind]);
    if (open.length === 0) break;
    const names = [...new Set(open.map((a) => a.group))];
    const group = rng.pick(names);
    const tiers = open.filter((a) => a.group === group).sort((a, b) => b.tier - a.tier); // best unlocked tier first
    const def = weightedPick(rng, tiers.map((a, k) => [a, decayPow(k)]));
    groups.add(def.group); kinds[def.kind]++;
    out.push(affixRecord(def, rollAffixValue(rng, def)));
  }
  return out;
}

function fromBase(base, rarity, ilvl) {
  const item = {
    base: base.id, name: base.name, baseName: base.name, kind: base.kind, rarity, ilvl, slot: base.slot,
    w: base.w, h: base.h, reqs: { ...base.reqs }, affixes: [],
  };
  if (base.damage) item.damage = { ...base.damage };
  if (base.defense) item.defense = base.defense;
  if (base.twoHanded) item.twoHanded = true;
  if (base.kind === "potion") { item.restores = base.restores; item.restore = base.restore; }
  if (base.kind === "consumable") item.effect = base.effect;
  return item;
}

/** A plain item of the given base (starting kit, vendor potions). */
export function makeItem(baseId, { rarity = "normal", ilvl } = {}) {
  const base = bases[baseId];
  if (!base) throw new Error(`unknown item base ${baseId}`);
  return fromBase(base, rarity, ilvl ?? base.minIlvl);
}

function fromUnique(def, ilvl) {
  const item = fromBase(bases[def.base], "unique", Math.max(ilvl, def.minIlvl));
  item.name = def.name; item.unique = def.id; item.flavour = def.flavour;
  item.affixes = def.affixes.map((a) => ({ id: a.id, group: a.stat, kind: a.kind, stat: a.stat, name: def.name, tier: 0, value: a.value, range: [a.value, a.value] }));
  return item;
}

const nameWith = (base, affs) => {
  const pre = affs.find((a) => a.kind === "prefix"), suf = affs.find((a) => a.kind === "suffix");
  return [pre?.name, base, suf?.name].filter(Boolean).join(" ");
};

/**
 * Roll one gear item. `taken` lists unique ids already found this game (QF-05-2: a taken unique becomes a rare of the same base).
 * `affixTag`: the class tag of the character the item is for (ADR-0005 section 7); class-tagged affixes roll only for a matching tag.
 */
export function rollItem(rng, opts = {}) {
  const depth = opts.depth ?? 1, ilvl = opts.ilvl ?? depth * config.ilvlPerDepth;
  let rarity = opts.rarity ?? rollRarity(rng, depth, opts.minRarity, opts.maxRarity);
  const taken = new Set(opts.taken ?? []);
  let base = opts.base ? bases[opts.base] : null;

  if (rarity === "unique") {
    const pool = uniques.filter((u) => u.minIlvl <= ilvl && (!opts.slot || bases[u.base].slot === opts.slot) && (!opts.base || u.base === opts.base));
    if (pool.length === 0) rarity = "rare";
    else {
      const def = rng.pick(pool);
      if (!(config.uniqueOncePerGame && taken.has(def.id))) return fromUnique(def, ilvl);
      rarity = "rare"; base = bases[def.base];
    }
  }
  if (!base) {
    const pool = gearBases.filter((b) => b.minIlvl <= ilvl && (!opts.slot || b.slot === opts.slot));
    base = rng.pick(pool.length ? pool : gearBases.filter((b) => !opts.slot || b.slot === opts.slot));
  }
  const item = fromBase(base, rarity, ilvl);
  if (rarity === "magic") {
    const [lo, hi] = config.magicAffixes;
    item.affixes = rollAffixes(rng, base.slot, ilvl, rng.int(lo, hi), opts.affixTag);
    item.name = nameWith(base.name, item.affixes);
  } else if (rarity === "rare") {
    const [lo, hi] = config.rareAffixes;
    item.affixes = rollAffixes(rng, base.slot, ilvl, rng.int(lo, hi), opts.affixTag);
    item.name = `${rng.pick(rareNames.adjectives)} ${rng.pick(rareNames.nouns)}`;
  }
  return item;
}

/** A potion of the best strength unlocked at ilvl, optionally one tier lower; kind "hp" (coffee) or "mp" (water). */
export function rollPotion(rng, ilvl, kind) {
  const k = kind ?? (rng.next() < 0.6 ? "hp" : "mp");
  const pool = potionBases.filter((b) => b.restores === k && b.minIlvl <= ilvl);
  const best = pool.length ? pool : potionBases.filter((b) => b.restores === k).slice(0, 1);
  return fromBase(rng.pick(best), "normal", ilvl);
}

export { uniqueById };
