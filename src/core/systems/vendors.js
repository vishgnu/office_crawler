// Vendor stock and trading (AC-R-057). Prices come from items/price.js; stock is a pure function of seed and visit.
import { config } from "../config.js";
import { createRng } from "../../rng.js";
import { hash32 } from "../hash.js";
import { rollItem, makeItem } from "../items/roll.js";
import { potionBases, consumableBases } from "../content/items.js";
import { buyPrice, sellValue } from "../items/price.js";
import { autoplace, findById, remove } from "../items/inventory.js";
import { mint } from "./loot.js";
import { emit } from "../events.js";
import { npcs } from "../content/npcs.js";

const fail = (error) => ({ ok: false, error });
const idHash = (id) => hash32(...[...String(id)].map((c) => c.charCodeAt(0)));

/**
 * Stock for one visit: unlimited potions of every strength unlocked at `level` (QF-04-3), plus a few gear items
 * of normal or magic rarity. Entries: { item, price, unlimited }. Items have no id until the vendor window opens.
 */
export function vendorStock(seed, visit, { vendorId = "supplies", level = 1, ilvl, potionsOnly = false } = {}) {
  const rng = createRng(hash32(seed, idHash(vendorId), visit));
  const itemLevel = ilvl ?? Math.max(1, level) * config.ilvlPerDepth;
  const stock = [];
  for (const b of potionBases) {
    if (config.vendor.potionTiers[b.tier] <= level) { const item = makeItem(b.id); stock.push({ item, price: buyPrice(item), unlimited: true }); }
  }
  for (const b of consumableBases) { const item = makeItem(b.id); stock.push({ item, price: buyPrice(item), unlimited: true }); } // Emergency Exit
  for (let i = 0; i < (potionsOnly ? 0 : config.vendor.gearSlots); i++) {
    const item = rollItem(rng, { ilvl: itemLevel, maxRarity: "magic" });
    stock.push({ item, price: buyPrice(item), unlimited: false });
  }
  return stock;
}

/** Is a town NPC that sells under this vendor id within interactRange of the hero? Trading needs one (R-041). */
export function vendorInReach(state, vendorId) {
  if (state.depth !== 0) return false;
  const p = state.player;
  return (state.floor.npcs ?? []).some((n) => npcs[n.id]?.vendorId === vendorId && Math.max(Math.abs(p.tile.x - n.tile.x), Math.abs(p.tile.y - n.tile.y)) <= config.interactRange);
}

export function openVendor(state, vendorId = "supplies") {
  if (!vendorInReach(state, vendorId)) return fail("no vendor within reach");
  // Stock is rolled once per Lobby visit (enterFloor clears vendorStocks on a return from a floor), so walking away and back,
  // or reopening the window, shows the same stock with purchases still removed. Fishing for a new roll needs a trip downstairs.
  state.vendorStocks ??= {};
  let kept = state.vendorStocks[vendorId];
  if (!kept) {
    const visit = (state.vendorVisits[vendorId] = (state.vendorVisits[vendorId] ?? 0) + 1);
    const potionsOnly = Object.values(npcs).some((n) => n.vendorId === vendorId && n.potionsOnly);
    const stock = vendorStock(state.seed, visit, { vendorId, level: state.player.level, ilvl: state.deepestDepth * config.ilvlPerDepth, potionsOnly });
    for (const e of stock) mint(state, e.item);
    kept = state.vendorStocks[vendorId] = { id: vendorId, visit, stock };
  }
  state.vendor = { id: vendorId, visit: kept.visit, stock: kept.stock };
  emit(state, { type: "vendorOpen", id: vendorId, visit: kept.visit });
  return { ok: true };
}

export function closeVendor(state) {
  state.vendor = null;
  return { ok: true };
}

export function buy(state, index) {
  const v = state.vendor, entry = v?.stock[index];
  if (!entry) return fail("no such stock entry");
  if (state.player.gold < entry.price) { emit(state, { type: "cannotAfford", price: entry.price }); return fail("cannot afford"); }
  const item = entry.unlimited ? mint(state, makeItem(entry.item.base)) : entry.item;
  if (!autoplace(state.inventory, item)) { emit(state, { type: "inventoryFull", id: item.id }); return fail("inventory full"); }
  state.player.gold -= entry.price;
  if (!entry.unlimited) {
    v.stock.splice(index, 1);
    const kept = state.vendorStocks?.[v.id]?.stock; // same array in memory; after a JSON round trip they are separate copies
    if (kept && kept !== v.stock) { const k = kept.findIndex((e) => e.item.id === item.id); if (k >= 0) kept.splice(k, 1); }
  }
  emit(state, { type: "buy", id: item.id, name: item.name, price: entry.price });
  return { ok: true, id: item.id };
}

/** Sell an inventory item (QF-05-6: equipped or held items cannot be sold). */
export function sell(state, id) {
  if (!state.vendor) return fail("no vendor open");
  if (!vendorInReach(state, state.vendor.id)) return fail("no vendor within reach");
  const item = findById(state.inventory, id);
  if (!item) return fail("only inventory items can be sold");
  const value = sellValue(item);
  remove(state.inventory, item);
  state.player.gold += value;
  emit(state, { type: "sell", id, name: item.name, value });
  return { ok: true, value };
}
