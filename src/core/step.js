// One fixed simulation tick. Mutates the state in place and returns the same reference
// (use cloneState first when the previous state is needed).
import { getCtx, rebuildOccupancy } from "./ctx.js";
import { applyInput, playerIntent } from "./systems/intent.js";
import { ai } from "./systems/ai.js";
import { boss } from "./systems/boss.js";
import { movement } from "./systems/movement.js";
import { pickups } from "./systems/loot.js";
import { settleOwed } from "./systems/quests.js";
import { combat } from "./systems/combat.js";
import { status } from "./systems/status.js";
import { cleanup } from "./systems/cleanup.js";
import { scene } from "./systems/scene.js";
import { projectiles } from "./systems/projectiles.js";
import { world } from "./systems/world.js";
import { explore } from "./systems/explore.js";
import { allies } from "./systems/allies.js";
import { zones } from "./systems/zones.js";
import { monsterStatuses, playerStatuses, dash } from "./systems/statuses.js";

export function step(state, inputs = []) {
  state.events.length = 0;
  for (const input of inputs) applyInput(state, input);
  // Paused, dead or not on a floor (or in the Lobby): nothing in the world moves and the tick counter stays put.
  if (state.paused || (state.scene !== "floor" && state.scene !== "town")) return state;

  rebuildOccupancy(state, getCtx(state));
  playerIntent(state);
  dash(state);
  ai(state);
  boss(state);
  allies(state);
  movement(state);
  pickups(state);
  settleOwed(state);
  projectiles(state);
  combat(state);
  status(state);
  monsterStatuses(state);
  playerStatuses(state);
  zones(state);
  cleanup(state);
  scene(state);
  world(state);
  explore(state);
  state.tick++;
  state.stats.playTicks = (state.stats.playTicks ?? 0) + 1;
  return state;
}
