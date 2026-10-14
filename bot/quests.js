// Bot quest paths (R7-0.4, AC-R-256-2). Pure like policy.js: decisions come from the state-shaped view (core state or snapshot) and go out as the public
// input commands (interact, questAccept, questHandIn, sell, stash, useStairs, storyRead). No cheats, no hidden data beyond what the snapshot carries.
//   Lobby (decideTown): talk to each giver whose quest is available (accept) or ready (hand in); on bagFull sell spare gear, else stash an item, then retry.
//   Floors: the quest items (ground entries), the elite, the interns and the consultants are met by the normal explore-and-fight loop (nextLoot takes the ground entry);
//           once the floor of a trip stage (QBOT.trips: floor 4 for sq1..sq3, floor 6 for sq4 and sq5) is clear and a quest of the stage (or any other) is ready,
//           the bot climbs the stairs back to the Lobby once per stage, hands in, and the elevator brings it back down to the deepest floor.
//   Main quests: floor entries complete the arcs' floor steps, the boss kill step 9, `keepPlaying` (run-headless) the verdict. The bot also reports the memo as read.
import { content } from "../src/core/index.js";

export const QBOT = {
  maxTrips: 2,     // trips to the Lobby: one per stage of `trips`
  // Trip stages (R7-4, ADR-0007 A5): the floor after which the bot climbs to the Lobby once, and the quests it expects to hand in there. Any other quest that is ready by then
  // (a badge picked up late, ADV-R7-03) is handed in on the same trip; a stage is skipped when the run does not go below its floor.
  trips: [{ depth: 4, ids: ["sq1", "sq2", "sq3"] }, { depth: 6, ids: ["sq4", "sq5"] }],
  maxTries: 12,    // interact orders per NPC per Lobby visit before the bot leaves it alone
  maxFails: 3,     // refused accept or hand-in commands per quest before the bot gives the quest up
  bagFullRounds: 4 // sell or stash rounds after a bagFull refusal before the bot gives the quest up
};

/** Returned by questTown while an order of the quest part is under way (the rest of the Lobby routine must not start another one). */
export const WAIT = Object.freeze({ t: "wait" });
const SIDE = content.sideIds, giverOf = (id) => content.quests[id].giver;

export const questMemory = () => ({ tries: {}, fail: {}, gaveUp: {}, bagFull: false, bagFullRounds: 0, sells: 0, climb: false, trips: 0, tripStart: 0, tripTicks: 0, stage: -1, stagesDone: [], stageTicks: [], memoRead: false });
const on = (mem) => mem.profile.quests !== false && !!mem.q;

/** New floor (the Lobby included): the per-visit interact counters start again. */
export function questNewFloor(mem) { if (mem.q) mem.q.tries = {}; }

/** Record the outcome of a quest-related command. */
export function noteQuest(mem, cmd, res) {
  const q = mem.q;
  if (!q || !cmd) return;
  if ((cmd.t === "questAccept" || cmd.t === "questHandIn") && res && res.ok === false) {
    if (res.error === "bagFull") { q.bagFull = true; q.sells = 0; if (++q.bagFullRounds > QBOT.bagFullRounds) q.gaveUp[cmd.id] = true; }
    else { q.fail[cmd.id] = (q.fail[cmd.id] ?? 0) + 1; if (q.fail[cmd.id] > QBOT.maxFails) q.gaveUp[cmd.id] = true; }
  }
  if (cmd.t === "storyRead") q.memoRead = true;
  if (cmd.t === "sell" && res?.ok) q.sells++;
  if (cmd.t === "stash" && res?.ok === false) q.bagFull = false; // the stash is full too: retry the hand-in as it is (it ends as a given-up quest after a few rounds)
}

const pending = (view, mem) => SIDE.filter((id) => !mem.q.gaveUp[id] && (view.quests[id].s === "ready" || view.quests[id].s === "available"));

/** Walk to an NPC and open its dialog (or null while on the way or when the NPC is not here / tried too often). */
function talk(view, mem, npc) {
  const p = view.player, q = mem.q;
  if (!(view.floor.npcs ?? []).some((n) => n.id === npc)) return null;
  if (p.interact === npc || p.next || p.path.length) return WAIT;
  if ((q.tries[npc] = (q.tries[npc] ?? 0) + 1) > QBOT.maxTries) return null;
  return { t: "interact", id: npc };
}

/** Lobby: the quest part of decideTown. Returns a command, WAIT (an order is under way) or null (nothing to do for quests). */
export function questTown(view, mem) {
  if (!on(mem) || !view.quests) return null;
  const q = mem.q, dlg = view.ui?.dialog;
  if (!q.memoRead && view.quests.main && !view.quests.main.m?.memo) return { t: "storyRead", id: "start" }; // the memo is read before the first descent
  if (q.bagFull) {
    const gear = view.inventory.items.filter((i) => i.kind === "gear");
    if (gear.length) { // sell all spare gear, then retry the hand-in
      if (dlg?.npc === "vendor" && view.vendor) return { t: "sell", id: gear[0].id };
      return talk(view, mem, "vendor");
    }
    if (q.sells > 0 || !view.inventory.items.length) { q.bagFull = false; } // sold what there was: try again
    else { // no gear at all: stash one item (bags hold the reward as gear plus potions)
      if (dlg?.kind === "stash") return { t: "stash", id: view.inventory.items[0].id, to: "stash" }; // one per decision until the bag is empty (the reward needs a 2x3 hole)
      return talk(view, mem, "stash");
    }
  }
  const todo = pending(view, mem);
  if (!todo.length) {
    if (q.climb) { q.climb = false; q.trips++; q.tripTicks += view.tick - q.tripStart; q.stageTicks[q.stage] = view.tick - q.tripStart; } // the trip is over; the elevator takes the hero back down
    return null;
  }
  const at = todo.find((id) => dlg?.npc === giverOf(id));
  if (at) return { t: view.quests[at].s === "ready" ? "questHandIn" : "questAccept", id: at };
  for (const id of todo) { const c = talk(view, mem, giverOf(id)); if (c) return c; }
  return null;
}

/** On a floor with no awake monster left to fight: climb to the Lobby when a climb is under way. */
export function questClimb(view, mem, live) {
  if (!on(mem) || !mem.q.climb || live.some((m) => m.ai !== "idle" && !mem.skip.has(m.id))) return null;
  const p = view.player;
  return p.stairs || p.next || p.path.length ? null : { t: "useStairs", dir: "up" };
}

/** The stage floor is clear and the loot is taken: start that stage's single trip to the Lobby when one of its quests (or any other) is ready and the run goes on below. */
export function questTrip(view, mem) {
  if (!on(mem) || !view.quests || mem.q.trips >= QBOT.maxTrips || mem.q.climb || (mem.profile.depth ?? 1) <= view.depth) return null;
  const i = QBOT.trips.findIndex((st) => st.depth === view.depth);
  if (i < 0 || mem.q.stagesDone[i]) return null;
  if (!SIDE.some((id) => !mem.q.gaveUp[id] && view.quests[id].s === "ready")) return null;
  mem.q.stagesDone[i] = true; mem.q.stage = i; mem.q.climb = true; mem.q.tripStart = view.tick;
  return { t: "useStairs", dir: "up" };
}
