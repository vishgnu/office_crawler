// Derived, never stored: the main step, next-step text, NPC markers and map targets (ADR-0007 sections 4 and 10). Pure functions of the state.
import { config } from "../config.js";
import { quests, sideIds, questIds, markerLabels } from "../content/quests.js";
import { npcs } from "../content/npcs.js";
import { strings } from "../content/strings.js";
import { exploredAt } from "./explore.js";

export const MAIN_STEPS = quests.main.steps.length;

/** Which of the six main steps are done, derived from the milestones. A later milestone implies the earlier steps (catch-up). */
export function mainDone(m) {
  const d6 = !!m.verdict, d5 = !!m.defeated || d6, d4 = !!m.unlocked || d5, d3 = m.depth >= 4 || d4, d2 = m.depth >= 1 || d3, d1 = !!m.memo || d2;
  return [d1, d2, d3, d4, d5, d6];
}
/** The current main step 1..6, or 7 when all six are done. */
export const mainStep = (m) => { const d = mainDone(m); const i = d.indexOf(false); return i < 0 ? MAIN_STEPS + 1 : i + 1; };

export const goalOf = (id) => (quests[id]?.objective?.type === "kill" ? config.quests.kill.count : 1);
export const giverName = (id) => { const g = quests[id]?.giver; return g ? strings[npcs[g].nameKey] : null; };

/** The quest's state word: available | active | ready | completed (the main quest: active | completed). */
export function stateOf(state, id) {
  if (id === "main") return mainStep(state.quests.main.m) > MAIN_STEPS ? "completed" : "active";
  return state.quests[id].s;
}

/** The one instruction line for the quest's current state ("" when completed). */
export function nextStep(state, id) {
  const q = quests[id];
  if (!q || !state.quests) return "";
  if (id === "main") { const s = mainStep(state.quests.main.m); return s > MAIN_STEPS ? "" : q.steps[s - 1].line; }
  const st = state.quests[id].s;
  return st === "completed" ? "" : q.next[st].replace("{giver}", giverName(id));
}

/** Snapshot data: the stored fields plus { id, state, step, stepCount, progress, goal, nextStep, title, giver }; `pinned` stays the stored string. */
export function questView(state) {
  const out = {};
  for (const id of questIds) {
    const q = state.quests[id], isMain = id === "main", step = isMain ? mainStep(q.m) : 0;
    out[id] = {
      ...structuredClone(q), id, state: stateOf(state, id), step: isMain ? Math.min(step, MAIN_STEPS) : 0, stepCount: isMain ? MAIN_STEPS : 0,
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
  if (id === "main") {
    const step = mainStep(state.quests.main.m);
    const target = step > MAIN_STEPS ? null : q.steps[step - 1].target;
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
