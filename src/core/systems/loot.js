// Loot: kill drops (AC-R-050), ground placement, pickup and cheats. Randomness: the "loot" stream only.
import { config } from "../config.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { getCtx } from "../ctx.js";
import { rollItem, rollPotion } from "../items/roll.js";
import { autoplace } from "../items/inventory.js";
import { sellValue } from "../items/price.js";
import { rarities } from "../content/items.js";
import { drops, defaultDrops } from "../content/monsters.js";

const mintId = (state) => `i${state.nextItemId++}`;

/** Give a rolled item its id (items from rollItem/makeItem have none). */
export function mint(state, item) {
  item.id = mintId(state);
  return item;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The kill tile, or the nearest walkable tile without a ground entry (ties: smaller y, then smaller x). */
export function freeGroundTile(state, origin) {
  const ctx = getCtx(state), taken = new Set(state.groundItems.map((g) => `${g.tile.x},${g.tile.y}`));
  const r = config.dropRadius, cand = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = origin.x + dx, y = origin.y + dy;
    if (ctx.grid.walkable(x, y) && !taken.has(`${x},${y}`)) cand.push({ x, y, d: Math.max(Math.abs(dx), Math.abs(dy)) * 10 + Math.abs(dx) + Math.abs(dy) });
  }
  cand.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  return cand.length ? { x: cand[0].x, y: cand[0].y } : { x: origin.x, y: origin.y };
}

/** Eviction order at the ground cap: gold piles, then normal, magic, rare items; cheapest first, oldest first on ties. Never the new entry, a unique or a kept entry. */
function evictOne(state, keep) {
  const rankOf = (e) => (e.gold ? 0 : 1 + rarityRank[e.item?.rarity ?? "normal"]);
  const valueOf = (e) => (e.gold ? e.gold : sellValue(e.item));
  let best = -1, bk = null;
  state.groundItems.forEach((e, i) => {
    if (e === keep || e.keep || e.item?.rarity === "unique") return;
    const k = [rankOf(e), valueOf(e), i];
    if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && k[2] < bk[2])))) { best = i; bk = k; }
  });
  if (best < 0) return false;
  state.groundItems.splice(best, 1);
  return true;
}
const rarityRank = { normal: 0, magic: 1, rare: 2, unique: 3 };

function addGround(state, entry, origin) {
  entry.tile = freeGroundTile(state, origin);
  state.groundItems.push(entry);
  while (state.groundItems.length > config.groundItemCap && evictOne(state, entry)) { /* evicting */ }
  return entry;
}

/** Put an item on the ground near `origin`. The entry's label equals the item name; mark/border/color follow rarity (AC-R-051-3). */
export function dropItem(state, item, origin, { keep = false } = {}) {
  if (!item.id) mint(state, item);
  const r = rarities[item.rarity];
  return addGround(state, { id: item.id, item, label: item.name, rarity: item.rarity, mark: r.mark, border: r.border, color: r.color, ...(keep ? { keep: true } : {}) }, origin);
}

export function dropGold(state, amount, origin) {
  return addGround(state, { id: mintId(state), gold: amount, label: `${amount} gold`, mark: "$", border: "none", color: "#e6c84a" }, origin);
}

const pickSlot = (rng, weights) => {
  if (!weights) return undefined;
  const entries = Object.entries(weights);
  let roll = rng.next() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [slot, w] of entries) { roll -= w; if (roll < 0) return slot; }
  return entries[entries.length - 1][0];
};

/**
 * Roll the drops of a dead monster and put them on the ground. Same state and monster give the same drops.
 * Fixed order of random draws: gold, item, potion. Champions drop at least magic, bosses `bossDrops` items of rare or better.
 */
export function dropLoot(state, m) {
  const rng = stream(state, "loot"), table = drops[m.type] ?? defaultDrops, depth = Math.max(1, m.level ?? state.depth);
  const ilvl = depth * config.ilvlPerDepth, tier = m.tier ?? "normal";
  const out = [];

  const g = config.gold;
  const goldRoll = rng.next(), spread = rng.int(-g.spread, g.spread);
  if (goldRoll < config.goldDropChance * table.goldMult || tier !== "normal") {
    const amount = Math.max(1, Math.round((g.base + g.perDepth * depth) * table.goldMult) + spread);
    out.push(dropGold(state, amount, m.tile));
  }

  const minRarity = config.tierMinRarity[tier] ?? "normal";
  const itemRoll = rng.next();
  const count = tier === "boss" ? config.bossDrops : (tier !== "normal" || itemRoll < config.dropChance * table.itemMult ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const item = rollItem(rng, { depth, ilvl, minRarity, slot: pickSlot(rng, table.slotWeights), taken: state.uniquesFound });
    if (item.unique) state.uniquesFound.push(item.unique);
    out.push(dropItem(state, item, m.tile));
  }

  const potionRoll = rng.next();
  if (potionRoll < config.potionDropChance * table.potionMult) out.push(dropItem(state, rollPotion(rng, ilvl), m.tile));
  for (const e of out) emit(state, { type: "drop", id: e.id, label: e.label, tile: { ...e.tile }, gold: e.gold ?? 0 });
  return out;
}

/** Cheat/test helper: roll an item with explicit options and drop it near a tile. */
export function spawnItem(state, opts = {}, tile = state.player.tile) {
  const rng = stream(state, "loot"), depth = opts.depth ?? state.depth;
  const item = opts.potion ? rollPotion(rng, (opts.ilvl ?? depth * config.ilvlPerDepth), opts.restores) : rollItem(rng, { depth, taken: state.uniquesFound, ...opts });
  if (item.unique) state.uniquesFound.push(item.unique);
  return dropItem(state, item, tile);
}

export function giveGold(state, n) {
  if (!Number.isInteger(n) || n <= 0) return false;
  state.player.gold += n;
  return true;
}

/** Take a ground entry: gold goes to the purse, items into the first free inventory spot (else `inventoryFull`). */
export function takeGround(state, entry) {
  const i = state.groundItems.indexOf(entry);
  if (i < 0) return { ok: false, error: "gone" };
  if (entry.gold) {
    state.groundItems.splice(i, 1);
    state.player.gold += entry.gold;
    emit(state, { type: "gold", value: entry.gold });
    return { ok: true };
  }
  if (!autoplace(state.inventory, entry.item)) { emit(state, { type: "inventoryFull", id: entry.id }); return { ok: false, error: "inventory full" }; }
  state.groundItems.splice(i, 1);
  emit(state, { type: "pickup", id: entry.id, name: entry.item.name, rarity: entry.item.rarity });
  return { ok: true };
}

export const groundAt = (state, tile) => state.groundItems.find((g) => g.tile.x === tile.x && g.tile.y === tile.y) ?? null;

/** Release the cursor item (death, closing a window): back into the inventory, else onto the ground (QF-02-3). Never destroyed. */
export function releaseCursor(state) {
  const item = state.cursorItem;
  if (!item) return;
  state.cursorItem = null;
  if (!autoplace(state.inventory, item)) dropItem(state, item, state.player.tile, { keep: true }); // keep: never evicted at the ground cap
}

/** Per-tick pickup: gold on the hero's tile is collected; a pending pickup order completes when the hero is in reach. */
export function pickups(state) {
  const p = state.player;
  if (p.hp <= 0) return;
  for (const g of state.groundItems.filter((e) => e.gold && e.tile.x === p.tile.x && e.tile.y === p.tile.y)) takeGround(state, g);
  if (!p.pickup) return;
  const entry = state.groundItems.find((e) => e.id === p.pickup);
  if (!entry) { p.pickup = null; return; }
  if (!p.next && cheb(p.tile, entry.tile) <= config.pickupRange) {
    p.pickup = null; p.path = [];
    takeGround(state, entry);
  } else if (!p.next && p.path.length === 0) p.pickup = null; // arrived elsewhere or blocked: give up
}
