// Debug cheats (R-123). The test hook exposes these only with ?test=1; nothing in normal gameplay calls them.
import { config } from "./config.js";
import { applyDerived } from "./items/derive.js";
import { xpNextFor } from "./systems/progression.js";
import { enterFloor } from "./systems/world.js";
import { spawnMonster } from "./state.js";
import { giveGold } from "./systems/loot.js";
import { emit } from "./events.js";
import { quests } from "./content/quests.js";
import { mainStep, MAIN_STEPS, goalOf, nextStep } from "./systems/questview.js";
import * as questSystem from "./systems/quests.js"; // `questHandIn` arrives with R7-0.2: looked up by name so this file works before and after it

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

/** Change the main milestones and emit the one cue event the event path would (quest.step, or quest.completed after the last step). */
function bumpMain(state, change) {
  const m = state.quests.main.m, before = mainStep(m);
  change(m);
  const after = mainStep(m), q = quests.main;
  if (after === before) return;
  if (after > MAIN_STEPS) emit(state, { type: "quest.completed", id: "main", title: q.title, rewards: { gold: 0, xp: 0, items: [] } });
  else emit(state, { type: "quest.step", id: "main", step: after, title: q.title, next: q.steps[after - 1].line });
}
/** The world flags a milestone needs so the character stays a legal save (the schema ties them: depth <= deepestDepth, unlocked and defeated to the boss flags). */
const reach = (state, depth) => { state.deepestDepth = Math.max(state.deepestDepth, depth); };

/**
 * Put the main quest at step n (1..6, forward only; the step is the first one not done). Sets the same milestones the events would, keeps the world flags
 * consistent, and emits the same quest.step cue. The same step is a no-op, an earlier one is refused.
 */
function setMainStep(state, n) {
  if (!Number.isInteger(n) || n < 1 || n > MAIN_STEPS) return fail("step out of range");
  const cur = mainStep(state.quests.main.m);
  if (n < cur) return fail("steps only go forward");
  if (n === cur) return OK;
  bumpMain(state, (m) => {
    if (n >= 2) m.memo = true;
    if (n >= 3) m.depth = Math.max(m.depth, 1);
    if (n >= 4) { m.depth = Math.max(m.depth, 4); reach(state, 4); }
    if (n >= 5) { m.depth = Math.max(m.depth, config.bossDepth - 1); m.unlocked = true; state.bossUnlocked = true; reach(state, config.bossDepth - 1); }
    if (n >= 6) { m.depth = Math.max(m.depth, config.bossDepth); m.defeated = true; state.bossDefeated = true; reach(state, config.bossDepth); }
  });
  return OK;
}

/**
 * Quest cheat (R7): main quest step 1..6, or a side quest state 0 available, 1 active, 2 ready (the item goes into the pouch for an item quest),
 * 3 completed (the reward goes through the hand-in path; a refusal such as bagFull is returned, not hidden). Returns { ok } or { ok: false, error }.
 */
export function setQuestStep(state, id, n) {
  if (!state.quests || !quests[id]) return fail("unknown quest");
  if (id === "main") return setMainStep(state, n);
  if (!Number.isInteger(n) || n < 0 || n > 3) return fail("state out of range");
  const q = state.quests[id], def = quests[id], pouch = state.player.pouch;
  const drop = () => { const i = pouch.findIndex((e) => e.quest === id); if (i >= 0) pouch.splice(i, 1); };
  if (n === 0) { state.quests[id] = { s: "available", p: 0 }; drop(); return OK; }
  if (n === 1) {
    if (q.s === "active") return OK;
    state.quests[id] = { s: "active", p: 0 }; drop();
    emit(state, { type: "quest.accepted", id, title: def.title, next: nextStep(state, id) });
    return OK;
  }
  if (n === 2 && q.s === "ready") return OK;
  if (n === 3 && q.s === "completed") return OK;
  if (q.s !== "ready") {
    state.quests[id] = { s: "ready", p: goalOf(id) };
    if (def.objective.type === "item" && !pouch.some((e) => e.quest === id)) {
      pouch.push({ id: pouchId(id), quest: id });
      emit(state, { type: "quest.item", id: pouchId(id), quest: id, name: def.item.name });
    }
    emit(state, { type: "quest.step", id, title: def.title, next: nextStep(state, id) });
  }
  if (n === 2) return OK;
  if (typeof questSystem.questHandIn !== "function") return fail("hand-in not available");
  const r = questSystem.questHandIn(state, id, { force: true }); // force: skip the giver's dialog gate (a cheat stands anywhere)
  if (r?.ok && state.quests.pinned === id) state.quests.pinned = "main";
  return r ?? fail("hand-in failed");
}

/** Finish a quest: the main quest (all six milestones, one quest.completed) or a side quest (ready, then handed in). */
export function completeQuest(state, id) {
  if (!state.quests || !quests[id]) return fail("unknown quest");
  if (id === "main") {
    if (mainStep(state.quests.main.m) > MAIN_STEPS) return OK;
    const r = setMainStep(state, MAIN_STEPS);
    if (!r.ok) return r;
    bumpMain(state, (m) => { m.verdict = true; });
    return OK;
  }
  return setQuestStep(state, id, 3);
}

export { giveGold, spawnMonster };
