// Potion belt (AC-R-056): state.belt is an array of belt slots holding a potion or null; keys 1-4 drink.
import { config } from "../config.js";
import { emit } from "../events.js";
import { findById, remove } from "./inventory.js";

export const newBelt = () => Array.from({ length: config.beltSlots }, () => null);
const fail = (error) => ({ ok: false, error });

/** Drink the potion in belt slot `index` (0-based). Empty slot: nothing happens. Full resource: config.consumePotionAtFull. */
export function useBelt(state, index) {
  const potion = state.belt[index];
  if (!potion) return fail("empty slot");
  const p = state.player, key = potion.restores === "hp" ? "hp" : "mp", max = key === "hp" ? p.hpMax : p.mpMax;
  if (p[key] >= max && !config.consumePotionAtFull) return fail("already full");
  const gained = Math.min(potion.restore, max - p[key]);
  p[key] += gained;
  state.belt[index] = null;
  emit(state, { type: "potion", slot: index, id: potion.id, name: potion.name, restores: potion.restores, value: gained });
  return { ok: true, gained };
}

/** Move a potion from the inventory to the belt: the given slot (swaps back into the inventory) or the first empty one. */
export function toBelt(state, id, index) {
  const potion = findById(state.inventory, id);
  if (!potion) return fail("no such item");
  if (potion.kind !== "potion") { emit(state, { type: "wrongSlot", id }); return fail("not a potion"); }
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
  if (held.kind !== "potion") { emit(state, { type: "wrongSlot", id: held.id }); return fail("not a potion"); }
  state.belt[index] = held; state.cursorItem = cur;
  emit(state, { type: "beltSet", slot: index, id: held.id });
  return { ok: true };
}
