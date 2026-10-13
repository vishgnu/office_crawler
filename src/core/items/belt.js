// Potion belt (AC-R-056): state.belt is an array of belt slots holding a potion or null; keys 1-4 drink.
import { config } from "../config.js";
import { emit } from "../events.js";
import { findById, remove } from "./inventory.js";
import { openPortal } from "../systems/world.js";

export const newBelt = () => Array.from({ length: config.beltSlots }, () => null);
const fail = (error) => ({ ok: false, error });
const beltable = (item) => item.kind === "potion" || item.kind === "consumable"; // the belt holds potions and one-use consumables

/** Drink a potion item (wherever it came from). Full resource: config.consumePotionAtFull. The caller removes the item on success. */
function drink(state, potion) {
  const p = state.player, key = potion.restores === "hp" ? "hp" : "mp", max = key === "hp" ? p.hpMax : p.mpMax;
  if (p[key] >= max && !config.consumePotionAtFull) return fail("already full");
  const gained = Math.min(potion.restore, max - p[key]);
  p[key] += gained;
  return { ok: true, gained };
}

/** Apply a consumable's effect (not potions). The caller removes the item on success. */
function applyConsumable(state, item) {
  if (item.effect === "portal") return openPortal(state);
  return fail("nothing happens");
}

/** Use an item from a slot: potions restore, consumables run their effect. On success `remove` takes the item out. */
function useOne(state, item, remove) {
  if (state.player.hp <= 0) return fail("player is dead");
  if (item.kind === "potion") {
    const r = drink(state, item);
    if (!r.ok) return r;
    const slot = state.belt.indexOf(item);
    remove();
    emit(state, { type: "potion", slot, id: item.id, name: item.name, restores: item.restores, value: r.gained });
    return r;
  }
  if (item.kind === "consumable") {
    const r = applyConsumable(state, item);
    if (r.ok) remove();
    return r;
  }
  return fail("not usable");
}

/** Use the item in belt slot `index` (0-based). Empty slot: nothing happens. */
export function useBelt(state, index) {
  const item = state.belt[index];
  if (!item) return fail("empty slot");
  return useOne(state, item, () => { state.belt[index] = null; });
}

/** `useItem {id}`: use an item by id from the inventory or the belt (right-click). Unknown id: { ok: false } and no change. */
export function useItem(state, id) {
  const inv = findById(state.inventory, id);
  if (inv) return useOne(state, inv, () => remove(state.inventory, inv));
  const slot = state.belt.findIndex((b) => b && b.id === id);
  if (slot >= 0) return useBelt(state, slot);
  return fail("no such item");
}

/** Move a potion from the inventory to the belt: the given slot (swaps back into the inventory) or the first empty one. */
export function toBelt(state, id, index) {
  const potion = findById(state.inventory, id);
  if (!potion) return fail("no such item");
  if (!beltable(potion)) { emit(state, { type: "wrongSlot", id }); return fail("not a potion"); }
  const slot = index ?? state.belt.findIndex((b) => b === null);
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.belt.length) { emit(state, { type: "beltFull", id }); return fail("belt full"); }
  if (state.belt[slot]) return fail("slot taken");
  remove(state.inventory, potion);
  state.belt[slot] = potion;
  emit(state, { type: "beltSet", slot, id });
  return { ok: true, slot };
}

/** Cursor click on a belt slot: a held potion goes in (swapping), a non-potion is rejected, an empty cursor picks up. */
export function clickBelt(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.belt.length) return fail("no such slot");
  const held = state.cursorItem, cur = state.belt[index];
  if (!held) { state.belt[index] = null; state.cursorItem = cur; return { ok: true }; }
  if (!beltable(held)) { emit(state, { type: "wrongSlot", id: held.id }); return fail("not a potion"); }
  state.belt[index] = held; state.cursorItem = cur;
  emit(state, { type: "beltSet", slot: index, id: held.id });
  return { ok: true };
}
