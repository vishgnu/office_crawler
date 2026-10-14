// The quest step machine (ADR-0007 section 3). `questEvent` is a tap on emit(): every core event, from the simulation, a cheat or a
// loader, reaches it, so no event is lost while paused. Quest changes are pure reducers over the stored milestones; the tap then compares
// the derived state before and after and emits the cue events. Events whose type starts with "quest." are ignored (no re-entrancy).
import { config } from "../config.js";
import { emit } from "../events.js";
import { quests, sideIds } from "../content/quests.js";
import { npcs } from "../content/npcs.js";
import { mainStep, MAIN_STEPS, goalOf, nextStep } from "./questview.js";

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Pure reducer of the main quest's milestones: (m, event) -> m. Milestones only grow. */
export function reduceMain(m, ev) {
  switch (ev.type) {
    case "floorEnter": return ev.depth > m.depth ? { ...m, depth: ev.depth } : m;
    case "stairsUnlocked": return m.unlocked ? m : { ...m, unlocked: true };
    case "bossDefeated": return m.defeated && m.unlocked ? m : { ...m, defeated: true, unlocked: true };
    case "keepPlaying": return m.defeated && !m.verdict ? { ...m, verdict: true } : m;
    case "storyRead": return ev.id === "start" ? (m.memo ? m : { ...m, memo: true }) : ev.id === "victory" && m.defeated && !m.verdict ? { ...m, verdict: true } : m;
    default: return m;
  }
}

/** Pure reducer of a side quest: (quest state, event, monster) -> quest state. `mon` is the killed monster for `kill`. */
export function reduceSide(q, id, ev, mon, depth) {
  if (ev.type !== "kill" || q.s !== "active" || !mon) return q;
  const o = quests[id].objective;
  if (o.type === "kill") {
    const k = config.quests.kill;
    if (mon.type !== k.monster || mon.summoned || !k.depths.includes(depth)) return q;
    const p = Math.min(k.count, q.p + 1);
    return { s: p >= k.count ? "ready" : "active", p };
  }
  if (o.type === "elite" && mon.quest === id) return { s: "ready", p: 1 };
  return q;
}

/** Apply a change to the main milestones, then emit one quest.step (catch-up over several steps gives one) or quest.completed. */
function changeMain(state, change) {
  const qs = state.quests, before = mainStep(qs.main.m);
  qs.main.m = change(qs.main.m);
  const after = mainStep(qs.main.m);
  if (after === before) return;
  const q = quests.main;
  if (after > MAIN_STEPS) emit(state, { type: "quest.completed", id: "main", title: q.title, rewards: { gold: 0, xp: 0, items: [] } });
  else emit(state, { type: "quest.step", id: "main", step: after, title: q.title, next: q.steps[after - 1].line });
}

/** The tap. Called by emit() after the event is pushed. */
export function questEvent(state, ev) {
  const qs = state.quests;
  if (!qs || typeof ev.type !== "string" || ev.type.startsWith("quest.")) return;
  if (ev.type === "floorEnter" || ev.type === "stairsUnlocked" || ev.type === "bossDefeated" || ev.type === "keepPlaying") changeMain(state, (m) => reduceMain(m, ev));
  if (ev.type !== "kill") return;
  const mon = state.monsters.find((m) => m.id === ev.target);
  for (const id of sideIds) {
    const before = qs[id], after = reduceSide(before, id, ev, mon, state.depth);
    if (after === before) continue;
    qs[id] = after;
    if (after.s === "ready") emit(state, { type: "quest.step", id, title: quests[id].title, next: nextStep(state, id) });
    else emit(state, { type: "quest.progress", id, p: after.p, goal: goalOf(id) });
  }
}

/** Input storyRead { id: "start" | "victory" }: the shell reports the memo read, or the verdict read from the journal. No event of its own. */
export function storyRead(state, id) {
  if (!state.quests) return fail("no quests");
  if (id !== "start" && id !== "victory") return fail("bad id");
  if (id === "victory" && !state.quests.main.m.defeated) return fail("not defeated");
  changeMain(state, (m) => reduceMain(m, { type: "storyRead", id }));
  return OK;
}

/** Input questAccept { id }: needs the giver's dialog open. Decline is closeDialog (no state change). */
export function questAccept(state, id) {
  if (typeof id !== "string") return fail("bad id");
  const def = quests[id];
  if (!def || def.kind !== "side" || !state.quests) return fail("unknown quest");
  const d = state.ui.dialog;
  if (!d || state.depth !== 0) return fail("no dialog");
  if (d.npc !== def.giver || !npcs[d.npc]) return fail("wrong npc");
  const npc = (state.floor.npcs ?? []).find((n) => n.id === d.npc);
  if (!npc || cheb(state.player.tile, npc.tile) > config.interactRange) return fail("no dialog");
  const q = state.quests[id];
  if (q.s === "completed") return fail("already done");
  if (q.s !== "available") return fail("not available");
  state.quests[id] = { s: "active", p: 0 };
  emit(state, { type: "quest.accepted", id, title: def.title, next: nextStep(state, id) });
  return OK;
}

/** Input questPin { id }: "main" or a side quest that is not completed. Pinning the pinned quest again is a no-op. */
export function questPin(state, id) {
  if (typeof id !== "string") return fail("bad id");
  if (!quests[id] || !state.quests) return fail("unknown quest");
  if (id !== "main" && state.quests[id].s === "completed") return fail("already done");
  if (state.quests.pinned === id) return OK;
  state.quests.pinned = id;
  emit(state, { type: "quest.pinned", id });
  return OK;
}
