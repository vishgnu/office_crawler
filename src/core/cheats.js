// Debug cheats (R-123). The test hook exposes these only with ?test=1; nothing in normal gameplay calls them.
import { config } from "./config.js";
import { applyDerived } from "./items/derive.js";
import { xpNextFor } from "./systems/progression.js";
import { enterFloor } from "./systems/world.js";
import { spawnMonster } from "./state.js";
import { giveGold } from "./systems/loot.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

/** Set the level (1..levelCap): xp becomes the threshold, points are granted for the levels gained, health and mana refill. */
export function setLevel(state, n) {
  const p = state.player;
  if (!Number.isInteger(n) || n < 1 || n > config.levelCap) return fail("level out of range");
  const d = n - p.level;
  p.level = n; p.xp = config.xpTable[n - 1]; p.xpNext = xpNextFor(n);
  p.attrPoints = Math.max(0, p.attrPoints + d * config.attrPointsPerLevel);
  p.skillPoints = Math.max(0, p.skillPoints + d * config.skillPointsPerLevel);
  applyDerived(state, { fill: true });
  return OK;
}

export function setHp(state, n) {
  if (!Number.isFinite(n)) return fail("invalid hp");
  const p = state.player;
  p.hp = Math.min(p.hpMax, Math.max(0, Math.floor(n)));
  if (p.hp === 0 && state.scene !== "dead") { p.action = "dead"; state.scene = "dead"; }
  return OK;
}

/** Jump to floor 1..maxDepth (0 = the Lobby) and stand on its entry tile (AC-R-123-5). The boss arena (9) is not available yet. */
export function teleportFloor(state, depth) {
  if (!Number.isInteger(depth) || depth < 0 || depth > config.maxDepth) return fail("no such floor");
  if (state.scene === "dead") return fail("player is dead");
  return enterFloor(state, depth, { at: "entry" });
}

export { giveGold, spawnMonster };
