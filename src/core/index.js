// Public API of the pure simulation core. Nothing here touches the DOM, clocks or Math.random.
import { hashState } from "./hash.js";
import { config } from "./config.js";
import { monsters } from "./content/monsters.js";
import { themes } from "./content/themes.js";
import { props } from "./content/props.js";
import { strings } from "./content/strings.js";

export { createRng } from "../rng.js";
export { config };
export { newGame, spawnMonster, restartInPlace } from "./state.js";
export { step } from "./step.js";
export { applyInput } from "./systems/intent.js";
export { hitChance } from "./systems/combat.js";
export { generateFloor } from "./gen/floor.js";
export { findPath } from "./pathfind.js";
export { advance } from "./clock.js";
export { hashState };

export const content = { monsters, themes, props, strings };

export const cloneState = (state) => structuredClone(state);

/** JSON snapshot for tests, bots and the renderer: a deep copy plus derived float positions. */
export function snapshot(state) {
  const s = cloneState(state);
  const pos = (a) => {
    const f = a.next ? a.moveT / a.moveTotal : 0;
    return { x: a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f, y: a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f };
  };
  s.player.pos = pos(s.player);
  for (const m of s.monsters) m.pos = pos(m);
  s.config = cloneState(config);
  return s;
}
