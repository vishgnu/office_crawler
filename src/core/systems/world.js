// Moving between the Lobby and the floors, floor persistence within a session, respawn, and town NPC interaction
// (R-040, R-041, R-043, R-044). A floor is regenerated from the seed on re-entry (same layout); what persists is which
// monsters were killed (they stay dead, the rest return to their start tiles) and the items on the ground (QF-04-6).
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { emit } from "../events.js";
import { generateFloor } from "../gen/floor.js";
import { spawnMonster } from "../state.js";
import { applyDerived } from "../items/derive.js";
import { npcs } from "../content/npcs.js";
import { STAIRS_UP } from "../tiles.js";
import { closeVendor, openVendor } from "./vendors.js";
import { initFloorMap } from "./explore.js";
export { vendorInReach } from "./vendors.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const inTown = (state) => state.depth === 0;

/** Remember what must persist of the current floor (killed spawns, ground items; a prepared test floor is kept whole). */
function parkFloor(state) {
  // A spawn that was blocked on entry (its tile was taken) never existed: it is not a kill and returns next time.
  const alive = new Set([...state.monsters.filter((m) => m.ai !== "dead" && m.spawn !== undefined).map((m) => m.spawn), ...(state.blockedSpawns ?? [])]);
  const killed = [];
  state.floor.spawns.forEach((_, i) => { if (!alive.has(i)) killed.push(i); });
  state.floors[state.depth] = { killed, groundItems: state.groundItems, explored: state.floor.explored, ...(state.floor.custom ? { floor: state.floor } : {}) };
}

/** A free walkable tile next to `tile`, not a monster start (nearest first, smaller y then x on ties). */
function tileBeside(floor, grid, tile) {
  const starts = new Set(floor.spawns.map((s) => `${s.tile.x},${s.tile.y}`));
  const c = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = tile.x + dx, y = tile.y + dy;
    if ((dx || dy) && grid.walkable(x, y) && !starts.has(`${x},${y}`)) c.push({ x, y, d: Math.max(Math.abs(dx), Math.abs(dy)) * 10 + Math.abs(dx) + Math.abs(dy) });
  }
  c.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  return c.length ? { x: c[0].x, y: c[0].y } : { ...tile };
}

/**
 * Leave the current floor and arrive on `depth` (0 = Lobby). `at`: "entry" (from above: the entry tile), "exit"
 * (from below: beside the way down) or "tile" (a given tile, for the Emergency Exit door). Updates deepestDepth, parks and restores floors.
 */
export function enterFloor(state, depth, { at = "entry", from = state.depth, tile = null } = {}) {
  parkFloor(state);
  const parked = state.floors[depth];
  const floor = parked?.floor ?? generateFloor(state.seed, depth);
  if (parked?.explored && !floor.explored) floor.explored = parked.explored;
  state.floor = floor; state.depth = depth;
  if (depth === 0 && from > 0) { state.townVisit = (state.townVisit ?? 0) + 1; state.vendorStocks = {}; } // a new Lobby visit: fresh vendor stock
  state.scene = depth === 0 ? "town" : "floor";
  state.deepestDepth = Math.max(state.deepestDepth, depth);
  state.monsters = []; state.projectiles = []; state.floaters = [];
  state.groundItems = parked?.groundItems ?? [];
  state.vendor = null; state.ui.dialog = null;
  state.input.mouse = { down: false, button: 0, tile: null, mode: null, applied: null };
  const p = state.player, ctx = getCtx(state);
  p.tile = at === "exit" && floor.exit ? tileBeside(floor, ctx.grid, floor.exit)
    : at === "tile" && tile ? (ctx.grid.walkable(tile.x, tile.y) ? { x: tile.x, y: tile.y } : tileBeside(floor, ctx.grid, tile)) : { ...floor.entry };
  Object.assign(p, { next: null, moveT: 0, moveTotal: 0, path: [], goal: null, target: null, pickup: null, stairs: null, interact: null, toPortal: false, castT: 0, blockedT: 0, attackT: 0, swingTarget: null, repathT: 0, action: "idle" });
  const killed = new Set(parked?.killed ?? []);
  state.blockedSpawns = [];
  floor.spawns.forEach((s, i) => { if (s.tier === "boss" && state.bossDefeated) killed.add(i); }); // a defeated boss stays dead (also after a reload)
  floor.spawns.forEach((s, i) => { if (!killed.has(i) && !spawnMonster(state, s.type, s.tile, s.packId, { ...s, spawn: i })) state.blockedSpawns.push(i); });
  initFloorMap(state);
  emit(state, { type: "floorEnter", depth, from });
  emit(state, { type: "autosave", reason: depth === 0 ? "town" : "floor", depth }); // the shell writes the save (src/save)
  return OK;
}

/** Where the town's way down leads (QF-01-1). */
export const townTarget = (state) => Math.min(config.maxDepth, Math.max(1, config.townStairsTarget === "deepest" ? state.deepestDepth : 1));

function takeStairs(state, dir) {
  const d = state.depth;
  if (dir === "down") {
    if (d === 0) return enterFloor(state, townTarget(state), { at: "entry" });
    if (d >= config.bossDepth) return fail("no way down");
    if (d >= config.maxDepth && !state.bossUnlocked) { emit(state, { type: "stairsLocked", depth: d }); return fail("locked"); } // clear the floor to open the way to the boss arena
    return enterFloor(state, d + 1, { at: "entry" });
  }
  if (d === 0) return fail("no way up from the Lobby");
  return enterFloor(state, d - 1, { at: "exit" });
}

/** The stairs tile for a direction on the current floor, or null (the Lobby has no way up). */
export function stairsTile(state, dir) {
  const f = state.floor;
  if (dir === "down") return f.exit ?? null;
  return state.depth > 0 && f.tiles[f.entry.y * f.w + f.entry.x] === STAIRS_UP ? f.entry : null;
}

/** Which stairs (if any) a tile is. */
export function stairsAt(state, tile) {
  for (const dir of ["down", "up"]) { const t = stairsTile(state, dir); if (t && t.x === tile.x && t.y === tile.y) return dir; }
  return null;
}

/** Walk to the stairs and take them on arrival. `issueMove` is passed in to avoid an import cycle with intent.js. */
export function useStairs(state, dir, issueMove) {
  const p = state.player, t = stairsTile(state, dir);
  if (dir !== "up" && dir !== "down") return fail("unknown direction");
  if (p.hp <= 0) return fail("player is dead");
  if (!t) return fail("no stairs there");
  if (dir === "down" && state.depth >= config.maxDepth && !(state.bossUnlocked && state.depth < config.bossDepth)) { emit(state, { type: "stairsLocked", depth: state.depth }); return fail("locked"); }
  if (!p.next && p.tile.x === t.x && p.tile.y === t.y) return takeStairs(state, dir);
  const r = issueMove(state, t);
  if (r.ok) p.stairs = dir;
  return r;
}

// Emergency Exit (R-046): using the item on a floor leaves a door open at the hero's tile and moves the hero to the Lobby; the
// Lobby door (config.portal.lobbyTile) leads back to that tile and closes. One door at a time: a new one replaces the old.
export const portalAt = (state, tile) => !!state.portal && state.depth === 0 && state.portal.lobbyTile.x === tile.x && state.portal.lobbyTile.y === tile.y;

export function openPortal(state) {
  const p = state.player;
  if (state.depth === 0) return fail("not on a floor");
  if (p.hp <= 0) return fail("player is dead");
  const depth = state.depth;
  state.portal = { depth, tile: { x: p.tile.x, y: p.tile.y }, lobbyTile: { ...config.portal.lobbyTile } };
  emit(state, { type: "portalOpen", depth, tile: { ...state.portal.tile }, lobbyTile: { ...state.portal.lobbyTile } });
  enterFloor(state, 0, { at: "entry", from: depth });
  return OK;
}

function takePortal(state) {
  const door = state.portal;
  if (!door) return fail("no portal");
  state.portal = null;
  emit(state, { type: "portalUse", depth: door.depth, tile: { ...door.tile } });
  return enterFloor(state, door.depth, { at: "tile", tile: door.tile, from: 0 });
}

/** Walk to the Lobby door and step through on arrival. */
export function usePortal(state, issueMove) {
  const p = state.player, door = state.portal;
  if (p.hp <= 0) return fail("player is dead");
  if (!door || state.depth !== 0) return fail("no portal here");
  if (!p.next && p.tile.x === door.lobbyTile.x && p.tile.y === door.lobbyTile.y) return takePortal(state);
  const r = issueMove(state, door.lobbyTile);
  if (r.ok) p.toPortal = true;
  return r;
}

export const npcAt = (state, tile) => (state.floor.npcs ?? []).find((n) => n.tile.x === tile.x && n.tile.y === tile.y) ?? null;
const npcById = (state, id) => (state.floor.npcs ?? []).find((n) => n.id === id) ?? null;

/** Open the NPC's dialog (and its window): the dialog is plain state the UI draws (AC-R-041-1). */
function openDialog(state, npc) {
  const def = npcs[npc.id];
  state.ui.dialog = { npc: npc.id, kind: def.kind, nameKey: def.nameKey, lines: [def.dialogKey] };
  if (def.kind === "vendor") openVendor(state, def.vendorId);
  emit(state, { type: "dialog", npc: npc.id });
}

export function closeDialog(state) {
  if (state.ui.dialog) { state.ui.dialog = null; closeVendor(state); return true; }
  return false;
}

/** Talk to an NPC: at once when within interactRange, else walk there first. */
export function interact(state, id, issueMove) {
  const p = state.player, npc = npcById(state, id);
  if (!npc || !inTown(state)) return fail("no such NPC here");
  if (p.hp <= 0) return fail("player is dead");
  if (cheb(p.tile, npc.tile) <= config.interactRange && !p.next) { p.path = []; p.target = null; openDialog(state, npc); return OK; }
  const r = issueMove(state, npc.tile);
  if (r.ok) p.interact = id;
  return r;
}

/** The healer's action: full health, free, health only (QF-04-2). */
export function heal(state) {
  const p = state.player;
  if (state.ui.dialog?.npc !== "healer") return fail("no healer");
  if (p.hp >= p.hpMax) return fail("already healthy");
  p.hp = p.hpMax;
  emit(state, { type: "healed", value: p.hpMax });
  return OK;
}

/** After death: back to the Lobby with full health and mana, nothing lost (QF-02-2, AC-R-023-4). */
export function respawn(state) {
  if (state.scene !== "dead") return fail("not dead");
  const p = state.player;
  enterFloor(state, 0, { at: "entry", from: state.depth });
  applyDerived(state, { fill: true });
  p.action = "idle";
  emit(state, { type: "respawn" });
  return OK;
}

/** Per-tick: complete a walking-to-stairs or walking-to-NPC order, and close dialogs the hero walked away from. */
export function world(state) {
  const p = state.player;
  if (p.hp <= 0) return;
  if (state.ui.dialog) {
    const n = npcById(state, state.ui.dialog.npc);
    if (!n || cheb(p.tile, n.tile) > config.interactRange) closeDialog(state);
  }
  if (p.interact) {
    const n = npcById(state, p.interact);
    if (!n) p.interact = null;
    else if (!p.next && cheb(p.tile, n.tile) <= config.interactRange) { p.interact = null; p.path = []; openDialog(state, n); }
    else if (!p.next && p.path.length === 0) p.interact = null;
  }
  if (p.toPortal) {
    const d = state.portal;
    if (!d || state.depth !== 0) p.toPortal = false;
    else if (!p.next && p.tile.x === d.lobbyTile.x && p.tile.y === d.lobbyTile.y) { p.toPortal = false; takePortal(state); return; }
    else if (!p.next && p.path.length === 0) p.toPortal = false;
  }
  if (p.stairs) {
    const t = stairsTile(state, p.stairs);
    if (!t) p.stairs = null;
    else if (!p.next && p.tile.x === t.x && p.tile.y === t.y) { const dir = p.stairs; p.stairs = null; takeStairs(state, dir); }
    else if (!p.next && p.path.length === 0) p.stairs = null;
  }
}
