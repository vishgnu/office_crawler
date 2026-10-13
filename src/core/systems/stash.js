// The Lobby stash (R-059): items move between the inventory and the stash only while the stash NPC's dialog is open, in the
// Lobby, with the hero within interactRange of the NPC. A move that finds no room puts the item back where it was.
import { config } from "../config.js";
import { emit } from "../events.js";
import { findById, remove, autoplace, snapshotGrid, restoreGrid } from "../items/inventory.js";
import { npcs } from "../content/npcs.js";

const fail = (error) => ({ ok: false, error });

export function stashInReach(state) {
  if (state.depth !== 0 || state.ui.dialog?.kind !== "stash") return false;
  const p = state.player;
  return (state.floor.npcs ?? []).some((n) => npcs[n.id]?.kind === "stash" && Math.max(Math.abs(p.tile.x - n.tile.x), Math.abs(p.tile.y - n.tile.y)) <= config.interactRange);
}

/** Move an item: `to` is "stash" (from the inventory) or anything else (from the stash back to the inventory). */
export function moveStash(state, id, to) {
  if (!stashInReach(state)) return fail("stash not in reach");
  const [from, dest] = to === "stash" ? [state.inventory, state.stash] : [state.stash, state.inventory];
  const item = findById(from, id);
  if (!item) return fail("no such item");
  const snap = snapshotGrid(from);
  remove(from, item);
  if (!autoplace(dest, item)) {
    restoreGrid(from, snap); // back into its original cell, not the first free one
    emit(state, { type: "inventoryFull", id: item.id });
    return fail("no room");
  }
  return { ok: true };
}
