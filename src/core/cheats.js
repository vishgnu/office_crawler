// Debug cheats (R-123). The test hook exposes these only with ?test=1; nothing in normal gameplay calls them.
import { config } from "./config.js";
import { applyDerived } from "./items/derive.js";
import { xpNextFor } from "./systems/progression.js";
import { enterFloor } from "./systems/world.js";
import { spawnMonster } from "./state.js";
import { giveGold } from "./systems/loot.js";
import { emit } from "./events.js";
import { quests, mainSteps } from "./content/quests.js";
import { mainStep, goalOf, nextStep, objCfg } from "./systems/questview.js";
import * as questSystem from "./systems/quests.js"; // `handInQuest` arrives with R7-0.2: looked up by name so this file works before and after it

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

/** Jump to floor 1..maxDepth, the boss arena (config.bossDepth) or the Lobby (0) and stand on its entry tile (AC-R-123-5, AC-R-045-1). */
export function teleportFloor(state, depth) {
  if (!Number.isInteger(depth) || depth < 0 || depth > config.bossDepth) return fail("no such floor");
  if (state.scene === "dead") return fail("player is dead");
  return enterFloor(state, depth, { at: "entry" });
}

const pouchId = (id) => `qi-${id}`;

/** The world flags a milestone needs so the character stays a legal save (the schema ties them: depth <= deepestDepth, unlocked and defeated to the boss flags). */
const reach = (state, depth) => { state.deepestDepth = Math.max(state.deepestDepth, depth); };

/** Make one main step's predicate true: the same milestones the events set, with the world flags a legal save needs. Pure on `m` plus the flags of `state`. */
function satisfy(state, m, step) {
  const w = step.when;
  if (w.depth) { m.depth = Math.max(m.depth, w.depth); reach(state, w.depth); return; }
  if (w.milestone === "memo") m.memo = true;
  else if (w.milestone === "unlocked") { m.depth = Math.max(m.depth, config.bossDepth - 1); m.unlocked = true; state.bossUnlocked = true; reach(state, config.bossDepth - 1); }
  else if (w.milestone === "defeated") { m.depth = Math.max(m.depth, config.bossDepth); m.unlocked = true; m.defeated = true; state.bossUnlocked = true; state.bossDefeated = true; reach(state, config.bossDepth); }
  else if (w.milestone === "verdict") { satisfy(state, m, { when: { milestone: "defeated" } }); m.verdict = true; } // a verdict needs the boss down in a legal save
}

/**
 * Put a main quest at step n of its own steps (1..its length, forward only; the step is the first one not done). Every step before it, in this and in the
 * earlier quests, is done: same milestones, same cues and the same arc rewards as the event path (one quest.completed per finished arc, one quest.step).
 * The same step is a no-op, an earlier one is refused.
 */
function setMainStep(state, id, n) {
  const def = quests[id];
  if (!Number.isInteger(n) || n < 1 || n > def.steps.length) return fail("step out of range");
  const target = mainSteps.find((s) => s.arcId === id).n + n - 1, cur = mainStep(state.quests.main.m);
  if (target < cur) return fail("steps only go forward");
  if (target === cur) return OK;
  questSystem.changeMain(state, (m0) => { const m = { ...m0 }; satisfy(state, m, mainSteps[target - 2]); return m; });
  return OK;
}

/**
 * Quest cheat (R7): a main quest at step n of its own steps (main 1..3, main2 1..3, main3 1..4; "main" with n up to 3), or a side quest state 0 available,
 * 1 active, 2 ready (the item goes into the pouch for an item quest), 3 completed (the reward goes through the hand-in path; a refusal such as bagFull is
 * returned, not hidden). Returns { ok } or { ok: false, error }.
 */
export function setQuestStep(state, id, n) {
  if (!state.quests || !quests[id]) return fail("unknown quest");
  if (quests[id].kind === "main") return setMainStep(state, id, n);
  if (!Number.isInteger(n) || n < 0 || n > 3) return fail("state out of range");
  const q = state.quests[id], def = quests[id], pouch = state.player.pouch;
  const drop = () => { const i = pouch.findIndex((e) => e.quest === id); if (i >= 0) pouch.splice(i, 1); };
  if (n === 0) { state.quests[id] = { s: "available", p: 0 }; drop(); return OK; }
  if (n === 1) {
    if (q.s === "active") return OK;
    state.quests[id] = { s: "active", p: 0 }; drop();
    if (def.objective.type === "kill") questSystem.reviveKills(state, id); // the monsters of the kill floors must still be there to kill (CR7-01)
    emit(state, { type: "quest.accepted", id, title: def.title, next: nextStep(state, id) });
    return OK;
  }
  if (n === 2 && (q.s === "ready" || q.s === "completed")) return OK; // a completed quest is not made ready again (CR7-08)
  if (n === 3 && q.s === "completed") return OK;
  if (q.s !== "ready") {
    // the world a legal save has when this quest is ready (ADV-R7-01: the schema ties the state to the play it needs)
    const type = def.objective.type;
    if (type === "kill") { state.stats.kills = Math.max(state.stats.kills, goalOf(id)); reach(state, Math.min(...objCfg(id, "kill").depths)); }
    else reach(state, type === "item" ? questSystem.itemFloorOf(state.seed, id) : objCfg(id, "elite").depth);
    state.quests[id] = { s: "ready", p: goalOf(id) };
    if (type === "item" && !pouch.some((e) => e.quest === id)) {
      pouch.push({ id: pouchId(id), quest: id });
      emit(state, { type: "quest.item", id: pouchId(id), quest: id, name: def.item.name });
    }
    emit(state, { type: "quest.step", id, title: def.title, next: nextStep(state, id) });
  }
  if (n === 2) return OK;
  if (typeof questSystem.handInQuest !== "function") return fail("hand-in not available");
  return questSystem.handInQuest(state, id); // the ungated hand-in the input command also uses: pin, pouch, reward and events as in play
}

/** Finish a quest: a main quest (every step up to its last, so "main3" completes all three; one quest.completed per finished arc) or a side quest (ready, then handed in). */
export function completeQuest(state, id) {
  if (!state.quests || !quests[id]) return fail("unknown quest");
  if (quests[id].kind === "main") {
    const last = mainSteps.filter((s) => s.arcId === id).pop().n;
    if (mainStep(state.quests.main.m) > last) return OK;
    questSystem.changeMain(state, (m0) => { const m = { ...m0 }; satisfy(state, m, mainSteps[last - 1]); return m; });
    return OK;
  }
  return setQuestStep(state, id, 3);
}

export { giveGold, spawnMonster };
