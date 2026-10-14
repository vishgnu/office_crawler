// Public API of the pure simulation core. Nothing here touches the DOM, clocks or Math.random.
import { hashState } from "./hash.js";
import { config } from "./config.js";
import { monsters, bosses, monsterStats, championMods } from "./content/monsters.js";
import { skills, skillTrees, at, manaCost } from "./content/skills.js";
import { npcs } from "./content/npcs.js";
import { themes } from "./content/themes.js";
import { props } from "./content/props.js";
import { strings } from "./content/strings.js";
import { story } from "./content/story.js";
import { classes, defaultClass, classById, retiredClasses } from "./content/classes.js";
import { bases, slotKeys, rarities, rarityOrder } from "./content/items.js";
import { affixes, affixGroups } from "./content/affixes.js";
import { uniques } from "./content/uniques.js";
import { drops } from "./content/monsters.js";

export { createRng } from "../rng.js";
export { config };
export { newGame, spawnMonster, restartInPlace, setSeedSource } from "./state.js";
export { deriveStats, applyDerived } from "./items/derive.js";
export { rollItem, rollPotion, rollRarity, rarityWeights, rollAffixes, rollAffixValue, makeItem } from "./items/roll.js";
export { sellValue, buyPrice } from "./items/price.js";
export { newGrid, canPlace, findSpot, autoplace, clickCell, itemAt } from "./items/inventory.js";
export { checkReqs, equipItem, unequipItem, clickSlot } from "./items/equipment.js";
export { useBelt, toBelt, clickBelt, useItem } from "./items/belt.js";
export { moveStash, stashInReach } from "./systems/stash.js";
export { exploredAt, initFloorMap } from "./systems/explore.js";
export { vendorStock, openVendor, closeVendor, buy, sell } from "./systems/vendors.js";
export { dropLoot, dropItem, dropGold, spawnItem, giveGold, takeGround, releaseCursor, mint } from "./systems/loot.js";
export { step } from "./step.js";
export { applyInput } from "./systems/intent.js";
export { hitChance } from "./systems/combat.js";
export { monsterStats };
export { gainXp, allocate, learnSkill, assignSkill, selectSkill, xpNextFor, respec, respecCheck, toggleAura } from "./systems/progression.js";
export { classes, classById, defaultClass, retiredClasses, skillTrees, at, manaCost };
export { skillView, treeView, classCards, effectRows } from "./treeview.js";
export { validateName, suggestName, DEFAULT_NAME, NAME_MAX } from "./name.js";
export { allyUnits } from "./content/allies.js";
export { castSkill, skillLevel, effLevel, castCost } from "./systems/skills.js";
export { fireProjectile } from "./systems/projectiles.js";
export { enterFloor, useStairs, interact, respawn, townTarget, stairsTile, stairsAt, npcAt, openPortal, usePortal, portalAt, closeDialog, heal } from "./systems/world.js";
export { vendorInReach } from "./systems/vendors.js";
import { keepPlaying as keepPlayingBase, runStats } from "./systems/boss.js";
import { enterFloor as enterFloorBase } from "./systems/world.js";
/** Victory screen -> Lobby, character unchanged (AC-R-045-5). Also available as the input command { t: "keepPlaying" }. */
export const keepPlaying = (state) => keepPlayingBase(state, enterFloorBase);
export { runStats };
export { setLevel, setHp, teleportFloor } from "./cheats.js";
export { generateTown } from "./gen/town.js";
export { generateFloor } from "./gen/floor.js";
export { findPath } from "./pathfind.js";
export { advance } from "./clock.js";
export { hashState };

export const content = { monsters, bosses, championMods, skills, skillTrees, npcs, themes, props, strings, story, classes, defaultClass, items: bases, slots: slotKeys, rarities, rarityOrder, affixes, affixGroups, uniques, drops };

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
