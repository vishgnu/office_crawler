// Derived, never stored: the main step (three arcs over ten steps), next-step text, NPC markers and map targets (ADR-0007 sections 4 and 10). Pure functions of the state.
import { config } from "../config.js";
import { quests, sideIds, questIds, mainSteps, markerLabels } from "../content/quests.js";
import { npcs } from "../content/npcs.js";
import { strings } from "../content/strings.js";
import { exploredAt } from "./explore.js";

export const MAIN_STEPS = mainSteps.length;

/** Is the predicate of one main step met by the milestones? (`when` is data: a milestone flag or a floor number.) */
const met = (when, m) => (when.milestone ? !!m[when.milestone] : m.depth >= when.depth);

/** Which of the ten main steps are done, derived from the milestones. A later step implies the earlier ones (suffix-OR: the catch-up rule). */
export function mainDone(m) {
  const d = new Array(MAIN_STEPS);
  let later = false;
  for (let i = MAIN_STEPS - 1; i >= 0; i--) { later = later || met(mainSteps[i].when, m); d[i] = later; }
  return d;
}
/** The current global main step 1..10, or 11 when all are done. */
export const mainStep = (m) => { const d = mainDone(m); const i = d.indexOf(false); return i < 0 ? MAIN_STEPS + 1 : i + 1; };

/** The arc (a main quest id) that holds the first undone step, or null when all three are done. */
export const activeMainId = (m) => { const s = mainStep(m); return s > MAIN_STEPS ? null : mainSteps[s - 1].arcId; };

/** A main quest's state: completed when all its steps are done, active when it holds the first undone step, else unavailable (locked). */
export function mainState(m, id) {
  const s = mainStep(m), steps = quests[id].steps, first = mainSteps.find((x) => x.arcId === id).n, last = first + steps.length - 1;
  return s > last ? "completed" : s >= first ? "active" : "unavailable";
}

/** `config.quests[id][type]` when the quest names its own objective block, else the global block (sq1 to sq3 keep reading `config.quests.kill`, `.item`, `.elite`). */
export const objCfg = (id, type = quests[id]?.objective?.type) => config.quests[id]?.[type] ?? config.quests[type];

export const goalOf = (id) => (quests[id]?.objective?.type === "kill" ? objCfg(id).count : 1);
export const giverName = (id) => { const g = quests[id]?.giver; return g ? strings[npcs[g].nameKey] : null; };

/** The quest's state word: available | active | ready | completed (a main quest: unavailable | active | completed). */
export function stateOf(state, id) {
  if (quests[id]?.kind === "main") return mainState(state.quests.main.m, id);
  return state.quests[id].s;
}

/** The one instruction line for the quest's current state ("" when completed or locked). */
export function nextStep(state, id) {
  const q = quests[id];
  if (!q || !state.quests) return "";
  if (q.kind === "main") {
    const m = state.quests.main.m, s = mainStep(m);
    return s <= MAIN_STEPS && mainSteps[s - 1].arcId === id ? mainSteps[s - 1].line : "";
  }
  const st = state.quests[id].s;
  return st === "completed" ? "" : q.next[st].replace("{giver}", giverName(id));
}

/**
 * Snapshot data: the stored fields plus { id, state, step, stepCount, progress, goal, nextStep, title, giver }; `pinned` stays the stored string.
 * For a main quest `step` is the step inside the arc (1..stepCount, stepCount when completed, 0 while unavailable) and `stepCount` the arc's length.
 */
export function questView(state) {
  const out = {};
  for (const id of questIds) {
    const q = state.quests[id], isMain = quests[id].kind === "main", st = stateOf(state, id);
    let step = 0;
    if (isMain) { const g = mainStep(state.quests.main.m); step = st === "completed" ? quests[id].steps.length : st === "active" ? mainSteps[g - 1].arcStep : 0; }
    out[id] = {
      ...(q ? structuredClone(q) : {}), id, state: st, step, stepCount: isMain ? quests[id].steps.length : 0,
      progress: isMain ? 0 : q.p, goal: isMain ? 0 : goalOf(id), nextStep: nextStep(state, id), title: quests[id].title, giver: isMain ? null : giverName(id),
    };
  }
  out.pinned = state.quests.pinned;
  return out;
}

const MARK = Object.freeze({ none: "none", available: "available", handin: "handin" });
/** Marker above a Lobby NPC: "handin" when one of its quests is ready, else "available" when one is offered, else "none". Allocates nothing. */
export function npcMarker(state, npcId) {
  if (!state.quests) return MARK.none;
  let offer = false;
  for (const id of sideIds) {
    if (quests[id].giver !== npcId) continue;
    const s = state.quests[id].s;
    if (s === "ready") return MARK.handin;
    if (s === "available") offer = true;
  }
  return offer ? MARK.available : MARK.none;
}

/** Targets of the pinned quest's next step that are on this floor and already known. Item and elite positions are never listed. */
export function mapMarkers(state) {
  if (!state.quests) return [];
  const id = state.quests.pinned, q = quests[id], f = state.floor, out = [];
  if (!q) return out;
  const known = (t) => t && exploredAt(state, t.x, t.y);
  const add = (kind, tile, label) => { if (known(tile)) out.push({ quest: id, kind, tile: { x: tile.x, y: tile.y }, label }); };
  if (q.kind === "main") {
    const step = mainStep(state.quests.main.m), target = step > MAIN_STEPS || mainSteps[step - 1].arcId !== id ? null : mainSteps[step - 1].target;
    if (!target) return out;
    if (target.kind === "elevator") { if (state.depth === 0 && f.exit) add("elevator", f.exit, markerLabels.elevator); }
    else if (target.kind === "stairs-down") {
      if (state.depth === 0 && f.exit) add("elevator", f.exit, markerLabels.elevator);
      else if (state.depth > 0 && f.exit) add("stairs-down", f.exit, markerLabels["stairs-down"]);
    }
    return out;
  }
  const st = state.quests[id].s;
  if ((st === "available" || st === "ready") && state.depth === 0) {
    const n = (f.npcs ?? []).find((o) => o.id === q.giver);
    if (n) add("npc", n.tile, giverName(id));
  }
  return out;
}
