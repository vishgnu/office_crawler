// Equipment rules (AC-R-053, AC-R-054). State fields used: inventory, equipment, cursorItem, player.
import { slotKeys, slotAccepts } from "../content/items.js";
import { autoplace, findById, remove, snapshotGrid, restoreGrid } from "./inventory.js";
import { applyDerived } from "./derive.js";
import { emit } from "../events.js";

export const newEquipment = () => Object.fromEntries(slotKeys.map((k) => [k, null]));

/** Requirement check against the hero's own level and attributes. missing: { level?, grit?, ... } amounts still needed. */
export function checkReqs(player, item) {
  const missing = {};
  for (const [k, need] of Object.entries(item.reqs ?? {})) {
    const have = k === "level" ? player.level : player.attrs[k] ?? 0;
    if (have < need) missing[k] = need - have;
  }
  return { ok: Object.keys(missing).length === 0, missing };
}

const fail = (error) => ({ ok: false, error });

/** The slot key an item would go to: an explicit valid one, else the first empty ring slot, else ring1. */
export function resolveSlot(state, item, wanted) {
  if (item.kind !== "gear") return null;
  if (wanted) return slotAccepts(wanted) === item.slot && slotKeys.includes(wanted) ? wanted : null;
  if (item.slot === "ring") return !state.equipment.ring1 ? "ring1" : !state.equipment.ring2 ? "ring2" : "ring1";
  return item.slot;
}

/** Shared validation. Returns { ok, slotKey } or a failure (events are emitted here). */
function prepare(state, item, wanted) {
  if (!item) return fail("no such item");
  const slotKey = resolveSlot(state, item, wanted);
  if (!slotKey) { emit(state, { type: "wrongSlot", id: item.id }); return fail("wrong slot"); }
  const r = checkReqs(state.player, item);
  if (!r.ok) { emit(state, { type: "reqNotMet", id: item.id, missing: r.missing }); return fail("requirements not met"); }
  if (slotKey === "offhand" && state.equipment.weapon?.twoHanded) { emit(state, { type: "slotBlocked", id: item.id, slot: slotKey }); return fail("two-handed weapon equipped"); }
  return { ok: true, slotKey };
}

/**
 * Equip an item that sits in the inventory or on the cursor. Displaced gear (the old item in the slot, and the
 * off-hand when a two-handed weapon goes in) returns to the inventory; when it does not fit the whole change is
 * undone and `inventoryFull` is emitted. When the item came from the cursor, the displaced item is kept on the cursor instead.
 */
export function equipItem(state, id, wanted) {
  const fromCursor = state.cursorItem?.id === id;
  const item = fromCursor ? state.cursorItem : findById(state.inventory, id);
  const prep = prepare(state, item, wanted);
  if (!prep.ok) return prep;
  const { slotKey } = prep, eq = state.equipment;
  const snap = snapshotGrid(state.inventory), before = { ...eq }, cursorBefore = state.cursorItem;
  if (fromCursor) state.cursorItem = null; else remove(state.inventory, item);
  const displaced = [];
  if (eq[slotKey]) displaced.push(eq[slotKey]);
  if (item.twoHanded && eq.offhand) { displaced.push(eq.offhand); eq.offhand = null; }
  eq[slotKey] = item;
  let ok = true;
  displaced.forEach((d, i) => {
    if (fromCursor && i === 0) state.cursorItem = d; // the cursor now holds what was replaced
    else if (!autoplace(state.inventory, d)) ok = false;
  });
  if (!ok) {
    restoreGrid(state.inventory, snap);
    Object.assign(eq, before); state.cursorItem = cursorBefore;
    emit(state, { type: "inventoryFull", id: item.id });
    return fail("inventory full");
  }
  applyDerived(state);
  emit(state, { type: "equip", id: item.id, name: item.name, slot: slotKey });
  return { ok: true, slot: slotKey };
}

/** Unequip to the inventory; refused (item stays equipped) when the inventory has no room (AC-R-053-5). */
export function unequipItem(state, slotKey) {
  const item = state.equipment[slotKey];
  if (!item) return fail("slot is empty");
  if (!autoplace(state.inventory, item)) { emit(state, { type: "inventoryFull", id: item.id }); return fail("inventory full"); }
  state.equipment[slotKey] = null;
  applyDerived(state);
  emit(state, { type: "unequip", id: item.id, name: item.name, slot: slotKey });
  return { ok: true };
}

/** Click on an equipment slot with the cursor: place the held item (swapping), or pick the worn one up. */
export function clickSlot(state, slotKey) {
  if (!slotKeys.includes(slotKey)) return fail("unknown slot");
  const held = state.cursorItem;
  if (!held) {
    const item = state.equipment[slotKey];
    if (!item) return { ok: true };
    state.equipment[slotKey] = null; state.cursorItem = item;
    applyDerived(state);
    emit(state, { type: "unequip", id: item.id, name: item.name, slot: slotKey });
    return { ok: true };
  }
  return equipItem(state, held.id, slotKey);
}
