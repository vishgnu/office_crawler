// Turns input commands into player intent (a path or an attack target) and keeps that intent
// up to date each tick (held mouse button, chasing a moving target).
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { planPath } from "../nav.js";
import { emit } from "../events.js";
import { createSpatialHash } from "../spatial.js";
import { restartInPlace } from "../state.js";
import { groundAt, takeGround, dropItem, releaseCursor } from "./loot.js";
import { clickCell, findById, remove } from "../items/inventory.js";
import { equipItem, unequipItem, clickSlot } from "../items/equipment.js";
import { useBelt, toBelt, clickBelt, useItem } from "../items/belt.js";
import { moveStash } from "./stash.js";
import { openVendor, closeVendor, buy, sell } from "./vendors.js";
import { castSkill } from "./skills.js";
import { skills } from "../content/skills.js";
import { allocate, learnSkill, assignSkill, selectSkill, respec, toggleAura } from "./progression.js";
import { inBasicReach } from "./basic.js";
import { validateName } from "../name.js";
import { keepPlaying } from "./boss.js";
import { questAccept, questPin, storyRead, questHandIn } from "./quests.js";
import { enterFloor, useStairs, stairsAt, interact, npcAt, closeDialog, heal, respawn, usePortal, portalAt } from "./world.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
const isTile = (t) => Number.isInteger(t?.x) && Number.isInteger(t?.y);

function livingMonsterAt(state, tile) {
  const hash = createSpatialHash();
  for (const m of state.monsters) if (m.ai !== "dead") hash.insert(m, m.tile.x, m.tile.y);
  return hash.query(tile.x, tile.y, 0)[0] ?? null;
}

/** Walk to `tile`; if it is a wall or unreachable, to the nearest reachable tile within clickSnapRadius (QF-01-2). */
function issueMove(state, tile) {
  if (!isTile(tile)) return fail("invalid tile");
  const ctx = getCtx(state), p = state.player;
  if (!ctx.grid.inBounds(tile.x, tile.y)) return fail("tile out of bounds");
  if (p.hp <= 0) return fail("player is dead");
  p.target = null; p.goal = null; p.pickup = null; p.stairs = null; p.interact = null; p.toPortal = false;
  const from = p.next ?? p.tile; // finish the step in progress first
  let path = ctx.grid.walkable(tile.x, tile.y) ? planPath(ctx, from, tile) : null;
  if (!path) {
    const r = config.clickSnapRadius, near = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tile.x + dx, y = tile.y + dy;
      if (ctx.grid.walkable(x, y)) near.push({ x, y, d: dx * dx + dy * dy });
    }
    near.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const c of near) { path = planPath(ctx, from, c); if (path) break; }
  }
  p.blockedT = 0;
  if (!path) { p.path = []; emit(state, { type: "noPath", tile: { x: tile.x, y: tile.y } }); return fail("no path"); }
  p.path = path;
  return OK;
}

function issueAttack(state, id) {
  const m = state.monsters.find((o) => o.id === id);
  if (!m || m.ai === "dead") return fail("no such living monster");
  if (state.player.hp <= 0) return fail("player is dead");
  const p = state.player;
  p.target = id; p.path = []; p.goal = null; p.repathT = 0; p.standT = 0; p.pickup = null; p.stairs = null; p.interact = null; p.toPortal = false;
  return OK;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Pick up a ground entry: at once when in reach, else walk to it first (QF: the order completes in loot.js pickups). */
function issuePickup(state, id) {
  const entry = state.groundItems.find((g) => g.id === id);
  if (!entry) return fail("no such ground item");
  const p = state.player;
  if (p.hp <= 0) return fail("player is dead");
  if (cheb(p.tile, entry.tile) <= config.pickupRange && !p.next) { p.pickup = null; return takeGround(state, entry).ok ? OK : fail("inventory full"); }
  const r = issueMove(state, entry.tile);
  if (r.ok) p.pickup = id;
  return r;
}

const inGrid = (state, name) => (name === "stash" ? state.stash : name === undefined || name === "inventory" ? state.inventory : null);

/** Drop an inventory item or the cursor item onto the floor next to the hero. */
function dropCommand(state, id) {
  const item = id === undefined || state.cursorItem?.id === id ? state.cursorItem : findById(state.inventory, id);
  if (!item) return fail("nothing to drop");
  if (item === state.cursorItem) state.cursorItem = null; else remove(state.inventory, item);
  dropItem(state, item, state.player.tile);
  emit(state, { type: "dropped", id: item.id });
  return OK;
}

const BELT_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

/** Inventory, equipment, belt and vendor commands (S2-2). */
function itemCommand(state, input) {
  const done = (r) => (r.ok ? OK : fail(r.error ?? "rejected"));
  switch (input.t) {
    case "pickup": return issuePickup(state, input.id);
    case "invClick": {
      const grid = inGrid(state, input.grid);
      if (!grid) return fail("unknown grid");
      const r = clickCell(grid, state, input.x, input.y);
      if (!r.ok) emit(state, { type: "placeRejected", grid: input.grid ?? "inventory", reason: r.error });
      return done(r);
    }
    case "slotClick": return done(clickSlot(state, input.slot));
    case "beltClick": return done(clickBelt(state, input.index));
    case "equip": return done(equipItem(state, input.id, input.slot));
    case "unequip": return done(unequipItem(state, input.slot));
    case "useBelt": return done(useBelt(state, input.index));
    case "toBelt": return done(toBelt(state, input.id, input.index));
    case "drop": return dropCommand(state, input.id);
    case "stash": return done(moveStash(state, input.id, input.to));
    case "useItem": return done(useItem(state, input.id));
    case "usePortal": return done(usePortal(state, issueMove));
    case "openVendor": return done(openVendor(state, input.id));
    case "closeVendor": return done(closeVendor(state));
    case "buy": return done(buy(state, input.index));
    case "sell": return done(sell(state, input.id));
    case "releaseCursor": releaseCursor(state); return OK;
    // progression, skills and the world (S2-3, S2-4)
    case "allocate": return done(allocate(state, input.attr));
    case "learnSkill": return done(learnSkill(state, input.id));
    case "assignSkill": return done(assignSkill(state, input.slot, input.id ?? null));
    case "selectSkill": return done(selectSkill(state, input.index));
    case "respec": return done(respec(state));
    case "toggleAura": return done(toggleAura(state, input.id));
    case "cast": return done(castSkill(state, input.skill ?? state.player.skillBar.secondary, input.tile));
    case "useStairs": return done(useStairs(state, input.dir, issueMove));
    case "interact": return done(interact(state, input.id, issueMove));
    case "heal": return done(heal(state));
    case "closeDialog": closeDialog(state); return OK;
    case "questAccept": return done(questAccept(state, input.id));
    case "questPin": return done(questPin(state, input.id));
    case "questHandIn": return questHandIn(state, input.id);
    default: return null;
  }
}

/** Right mouse button: use the selected skill (QF-01-4). On a monster the basic attack just attacks. */
function secondary(state, tile) {
  if (!isTile(tile)) return fail("invalid tile");
  const id = state.player.skillBar.secondary;
  if (!id) return fail("no skill selected");
  if (skills[id]?.kind === "basic") { const m = livingMonsterAt(state, tile); return m ? issueAttack(state, m.id) : fail("nothing to strike"); }
  return castSkill(state, id, tile);
}

function mouseDown(state, tile, button, hold) {
  if (button === 2) return secondary(state, tile);
  if (button !== 0) return fail("unknown mouse button");
  if (!isTile(tile)) return fail("invalid tile");
  const inb = getCtx(state).grid.inBounds(tile.x, tile.y);
  const npc = inb ? npcAt(state, tile) : null;
  if (npc) { Object.assign(state.input.mouse, { down: false, button, tile: { ...tile }, mode: "interact", applied: { ...tile } }); return interact(state, npc.id, issueMove); }
  if (inb && portalAt(state, tile)) { Object.assign(state.input.mouse, { down: false, button, tile: { ...tile }, mode: "portal", applied: { ...tile } }); return usePortal(state, issueMove); }
  const dir = inb ? stairsAt(state, tile) : null;
  if (dir) { Object.assign(state.input.mouse, { down: false, button, tile: { ...tile }, mode: "stairs", applied: { ...tile } }); return useStairs(state, dir, issueMove); }
  const m = inb ? livingMonsterAt(state, tile) : null;
  const ground = !m && inb ? groundAt(state, tile) : null;
  if (ground) {
    const r = issuePickup(state, ground.id);
    Object.assign(state.input.mouse, { down: false, button, tile: { ...tile }, mode: "pickup", applied: { ...tile } });
    return r;
  }
  const res = m ? issueAttack(state, m.id) : issueMove(state, tile);
  Object.assign(state.input.mouse, { down: hold, button, tile: { ...tile }, mode: m ? "attack" : "move", applied: { ...tile } });
  return res;
}

function setName(state, name) {
  const n = validateName(name);
  if (!n.ok) return fail("bad-name");
  state.player.name = n.name; emit(state, { type: "renamed", name: n.name });
  return OK;
}

/**
 * Apply one input command now (no time passes). Returns { ok, error? }.
 * Commands: click {tile, button, hold}, mouse {phase: down|move|up|cancel, tile, button}, moveTo {tile},
 * attack {id}, pause, key {code}, restart. Items (S2-2): pickup {id}, invClick {grid, x, y}, slotClick {slot}, beltClick {index},
 * equip {id, slot?}, unequip {slot}, useBelt {index}, toBelt {id, index?}, drop {id?}, stash {id, to}, openVendor {id?}, closeVendor,
 * buy {index}, sell {id}, releaseCursor, useItem {id} (potions, Emergency Exit), usePortal (walk to the Lobby door and step through).
 */
export function applyInput(state, input) {
  const live = state.scene === "floor" || state.scene === "town";
  switch (input?.t) {
    case "pause": case "key": {
      if (input.t === "key" && /^F[1-4]$/.test(input.code ?? "")) { // skill selector (QF-01-4)
        if (!live || state.paused) return fail("not in a running game");
        return selectSkill(state, Number(input.code[1]) - 1).ok ? OK : fail("unknown hotkey");
      }
      if (input.t === "key" && input.code === "Escape" && live && state.ui.dialog) { closeDialog(state); return OK; }
      if (input.t === "key" && input.code in BELT_KEYS) { // potions on keys 1-4 (QF-01-4)
        if (!live || state.paused) return fail("not in a running game");
        return useBelt(state, BELT_KEYS[input.code]).ok ? OK : fail("nothing to drink");
      }
      if (input.t === "key" && input.code !== "Escape") return OK;
      if (!live) return fail("not in a running game");
      state.paused = !state.paused;
      return OK;
    }
    case "restart":
      if (state.scene !== "dead") return fail("not dead");
      restartInPlace(state);
      return OK;
    case "keepPlaying": return keepPlaying(state, enterFloor).ok ? OK : fail("not at the victory screen"); // back to the Lobby after the finale
    case "respawn": return respawn(state).ok ? OK : fail("not dead"); // back to the Lobby, nothing lost (AC-R-023-4)
  }
  // Releasing the button must always register (also while paused or dead), or the core keeps
  // following the cursor with no button down (S1 review B1).
  if (input.t === "mouse" && (input.phase === "up" || input.phase === "cancel")) { if (input.button !== 2) state.input.mouse.down = false; return OK; }
  // setName is a whitelisted exception to the paused / not-live gates (the slot manager renames from the pause menu and the death screen).
  if (input.t === "setName") return setName(state, input.name);
  // storyRead likewise: the memo and the victory screen are not live scenes (ADR-0007 section 5).
  if (input.t === "storyRead") return storyRead(state, input.id);
  if (!live) return fail("not in a running game");
  if (state.paused) return fail("paused");
  switch (input.t) {
    case "click": return mouseDown(state, input.tile, input.button ?? 0, !!input.hold);
    case "mouse": {
      const mouse = state.input.mouse;
      if (input.phase === "down") return mouseDown(state, input.tile, input.button ?? 0, true);
      if (input.phase === "move") { if (mouse.down && isTile(input.tile)) mouse.tile = { ...input.tile }; return OK; }
      return fail("unknown mouse phase");
    }
    case "moveTo": return issueMove(state, input.tile);
    case "attack": return issueAttack(state, input.id);
    default: {
      const r = itemCommand(state, input);
      return r ?? fail("unknown input");
    }
  }
}

/** The living monster in basic reach of the hero that is hitting it (or the nearest one in reach), other than `skip`; null when none. */
function reachableAttacker(state, ctx, p, skip) {
  let best = null, bestKey = null;
  for (const o of state.monsters) {
    if (o === skip || o.ai === "dead" || o.ai === "idle" || !inBasicReach(state, ctx, p.tile, o.tile)) continue;
    const key = (o.ai === "attack" ? 0 : 1) * 1e6 + cheb(p.tile, o.tile) * 1e3 + o.hp / 1e3; // attackers first, then the nearest, then the weakest; ids break ties by list order
    if (bestKey === null || key < bestKey) { best = o; bestKey = key; }
  }
  return best;
}

/** Per-tick intent upkeep. */
export function playerIntent(state) {
  const ctx = getCtx(state), p = state.player;
  if (p.hp <= 0) return;
  if (p.castT > 0) return; // busy casting

  // Held button on the floor: the destination follows the cursor.
  const mouse = state.input.mouse;
  if (mouse.down && mouse.mode === "move" && mouse.tile &&
      (mouse.tile.x !== mouse.applied.x || mouse.tile.y !== mouse.applied.y)) {
    mouse.applied = { ...mouse.tile };
    issueMove(state, mouse.tile);
  }

  if (!p.target) { p.standT = 0; return; } // no order, no stand count (CR7-14: a stale count must not make the next order retarget at once)
  const m = state.monsters.find((o) => o.id === p.target);
  if (!m || m.ai === "dead") { p.target = null; p.standT = 0; return; }
  if (p.repathT > 0) p.repathT--;
  if (!p.next && inBasicReach(state, ctx, p.tile, m.tile)) { p.path = []; p.standT = 0; return; } // in reach: stand and fight (melee: adjacent; toss / zap: in range with a clear line)
  if (p.next && inBasicReach(state, ctx, p.next, m.tile)) { p.path = []; return; }   // will be in reach after this step
  // S1 hardening (bot run): a monster that is already coming for us and ends up within holdRadius tiles of where we stand is
  // waited for (the step in progress is finished, the rest of the path dropped). Two actors that both path to where the
  // other WAS orbit each other forever, round a ring of corridors or a prop cluster (the faster Printer Imp did this).
  const at = p.next ?? p.tile;
  // R7-3 (stall seen on floor 1): a hero that stands holding a target it cannot reach (the chaser's approach tiles are taken by others, or it
  // stays on the far side of a corner) answers an attacker in reach after retargetTicks, as a player would by clicking it; after holdMaxTicks it stops waiting.
  // A click is never replaced while it can still be carried out: the counter only runs while the hero stands (a step in progress resets it), a new order
  // (issueAttack) starts it at 0, and nothing is replaced while the player holds the button down on the floor.
  // Once the hold has run out (standT >= holdMaxTicks) the counter is kept through the steps that follow, so the hold does not come back after one step;
  // it starts again with a new target or when the target is in reach.
  if (p.next) { if (p.standT < config.holdMaxTicks) p.standT = 0; } else p.standT = (p.standT ?? 0) + 1; // a path that stays blocked (movement.js) is still standing
  // The search costs a reach test per monster: it runs once when retargetTicks is reached and then every retargetEvery ticks while the hero stays blocked.
  if (!p.next && p.standT >= config.retargetTicks && (p.standT - config.retargetTicks) % config.retargetEvery === 0 && !mouse.down) {
    const a = reachableAttacker(state, ctx, p, m);
    if (a) { p.target = a.id; p.goal = null; p.path = []; p.repathT = 0; p.standT = 0; return; }
  }
  if (p.standT < config.holdMaxTicks && m.ai === "chase" && (m.next || m.path.length > 0) && Math.max(Math.abs(m.tile.x - at.x), Math.abs(m.tile.y - at.y)) <= config.holdRadius) { p.path = []; return; }
  const stale = !p.goal || p.goal.x !== m.tile.x || p.goal.y !== m.tile.y;
  if ((p.path.length === 0 || stale) && p.repathT === 0) {
    const path = planPath(ctx, p.next ?? p.tile, m.tile, { adjacent: true });
    p.goal = { ...m.tile };
    p.repathT = config.ai.repathTicks;
    if (!path) { p.target = null; p.path = []; emit(state, { type: "noPath", tile: { ...m.tile } }); }
    else p.path = path;
  }
}
