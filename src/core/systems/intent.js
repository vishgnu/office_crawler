// Turns input commands into player intent (a path or an attack target) and keeps that intent
// up to date each tick (held mouse button, chasing a moving target).
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { planPath } from "../nav.js";
import { emit } from "../events.js";
import { createSpatialHash } from "../spatial.js";
import { restartInPlace } from "../state.js";

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
  p.target = null; p.goal = null;
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
  p.target = id; p.path = []; p.goal = null; p.repathT = 0;
  return OK;
}

function mouseDown(state, tile, button, hold) {
  if (button !== 0) return fail("no secondary skill in S1");
  if (!isTile(tile)) return fail("invalid tile");
  const m = getCtx(state).grid.inBounds(tile.x, tile.y) ? livingMonsterAt(state, tile) : null;
  const res = m ? issueAttack(state, m.id) : issueMove(state, tile);
  Object.assign(state.input.mouse, { down: hold, button, tile: { ...tile }, mode: m ? "attack" : "move", applied: { ...tile } });
  return res;
}

/**
 * Apply one input command now (no time passes). Returns { ok, error? }.
 * Commands: click {tile, button, hold}, mouse {phase: down|move|up|cancel, tile, button}, moveTo {tile},
 * attack {id}, pause, key {code}, restart.
 */
export function applyInput(state, input) {
  const live = state.scene === "floor";
  switch (input?.t) {
    case "pause": case "key": {
      if (input.t === "key" && input.code !== "Escape") return OK;
      if (!live) return fail("not in a running game");
      state.paused = !state.paused;
      return OK;
    }
    case "restart":
      if (state.scene !== "dead") return fail("not dead");
      restartInPlace(state);
      return OK;
  }
  // Releasing the button must always register (also while paused or dead), or the core keeps
  // following the cursor with no button down (S1 review B1).
  if (input.t === "mouse" && (input.phase === "up" || input.phase === "cancel")) { state.input.mouse.down = false; return OK; }
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
    default: return fail("unknown input");
  }
}

/** Per-tick intent upkeep. */
export function playerIntent(state) {
  const ctx = getCtx(state), p = state.player;
  if (p.hp <= 0) return;

  // Held button on the floor: the destination follows the cursor.
  const mouse = state.input.mouse;
  if (mouse.down && mouse.mode === "move" && mouse.tile &&
      (mouse.tile.x !== mouse.applied.x || mouse.tile.y !== mouse.applied.y)) {
    mouse.applied = { ...mouse.tile };
    issueMove(state, mouse.tile);
  }

  if (!p.target) return;
  const m = state.monsters.find((o) => o.id === p.target);
  if (!m || m.ai === "dead") { p.target = null; return; }
  if (p.repathT > 0) p.repathT--;
  if (!p.next && isAdjacent(ctx.grid, p.tile, m.tile)) { p.path = []; return; } // in reach: stand and fight
  if (p.next && isAdjacent(ctx.grid, p.next, m.tile)) { p.path = []; return; }   // will be in reach after this step
  // S1 hardening (bot run): a monster that is already coming for us and ends up within holdRadius tiles of where we stand is
  // waited for (the step in progress is finished, the rest of the path dropped). Two actors that both path to where the
  // other WAS orbit each other forever, round a ring of corridors or a prop cluster (the faster Printer Imp did this).
  const at = p.next ?? p.tile;
  if (m.ai === "chase" && (m.next || m.path.length > 0) && Math.max(Math.abs(m.tile.x - at.x), Math.abs(m.tile.y - at.y)) <= config.holdRadius) { p.path = []; return; }
  const stale = !p.goal || p.goal.x !== m.tile.x || p.goal.y !== m.tile.y;
  if ((p.path.length === 0 || stale) && p.repathT === 0) {
    const path = planPath(ctx, p.next ?? p.tile, m.tile, { adjacent: true });
    p.goal = { ...m.tile };
    p.repathT = config.ai.repathTicks;
    if (!path) { p.target = null; p.path = []; emit(state, { type: "noPath", tile: { ...m.tile } }); }
    else p.path = path;
  }
}
