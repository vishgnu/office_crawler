// The quest step machine (ADR-0007 section 3). `questEvent` is a tap on emit(): every core event, from the simulation, a cheat or a
// loader, reaches it, so no event is lost while paused. Quest changes are pure reducers over the stored milestones; the tap then compares
// the derived state before and after and emits the cue events. Events whose type starts with "quest." are ignored (no re-entrancy).
import { config } from "../config.js";
import { emit } from "../events.js";
import { createRng } from "../../rng.js";
import { hash32 } from "../hash.js";
import { buildGrid } from "../grid.js";
import { generateFloor } from "../gen/floor.js";
import { spawnMonster } from "../state.js";
import { rollItem, rollPotion } from "../items/roll.js";
import { autoplace } from "../items/inventory.js";
import { mint, giveGold, affixTagOf } from "./loot.js";
import { gainXp } from "./progression.js";
import { quests, sideIds } from "../content/quests.js";
import { npcs } from "../content/npcs.js";
import { mainStep, MAIN_STEPS, goalOf, nextStep, stateOf } from "./questview.js";

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

/** The dialog gate of accept and hand-in: the giver's dialog is open and the hero is in reach. Returns an error string or null. */
function giverGate(state, def) {
  const d = state.ui.dialog;
  if (!d || state.depth !== 0) return "no dialog";
  if (d.npc !== def.giver || !npcs[d.npc]) return "wrong npc";
  const npc = (state.floor.npcs ?? []).find((n) => n.id === d.npc);
  return !npc || cheb(state.player.tile, npc.tile) > config.interactRange ? "no dialog" : null;
}

/** Input questAccept { id }: needs the giver's dialog open. Decline is closeDialog (no state change). */
export function questAccept(state, id) {
  if (typeof id !== "string") return fail("bad id");
  const def = quests[id];
  if (!def || def.kind !== "side" || !state.quests) return fail("unknown quest");
  const gate = giverGate(state, def);
  if (gate) return fail(gate);
  const q = state.quests[id];
  if (q.s === "completed") return fail("already done");
  if (q.s !== "available") return fail("not available");
  state.quests[id] = { s: "active", p: 0 };
  if (quests[id].objective.type === "kill") reviveInterns(state);
  emit(state, { type: "quest.accepted", id, title: def.title, next: nextStep(state, id) });
  return OK;
}

/**
 * CR7-01: floors keep their killed spawns for the whole session, and only kills after Accept count, so a player who cleared floors 1 and 2 before
 * accepting sq1 could never reach the count. On Accept, if fewer zombie interns are alive on the kill floors than the quest still needs, the killed
 * intern spawns come back, floor by floor and in spawn order (no rng, no spawn of anything new; a run that never accepts is untouched). The floors
 * are parked while the hero is in the Lobby; the floor the hero stands on (never the case at the giver) counts its living interns as they are.
 */
export function reviveInterns(state) {
  const k = config.quests.kill, need = k.count - state.quests.sq1.p;
  const rows = [];
  let alive = 0;
  for (const d of k.depths) {
    if (d === state.depth) { alive += state.monsters.filter((m) => m.type === k.monster && !m.summoned && m.ai !== "dead").length; continue; }
    const parked = state.floors[d], floor = parked?.floor ?? generateFloor(state.seed, d), killed = new Set(parked?.killed ?? []);
    floor.spawns.forEach((s, i) => { if (s.type !== k.monster) return; if (killed.has(i)) rows.push({ parked, i }); else alive++; });
  }
  for (const r of rows) {
    if (alive >= need) break;
    r.parked.killed = r.parked.killed.filter((x) => x !== r.i);
    alive++;
  }
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

// ---- R7-0.2: stateless quest stream, generator hooks, pouch, atomic hand-in, rewards (ADR-0007 sections 6 to 8) ----

/** Derived random stream of a quest: no state, no cursor (ADR-0007 section 6). purpose: 1 item floor, 2 item tile, 3 elite tile, 4 reward gear, 5 reward potions. */
export const questRng = (seed, salt, purpose, depth) => createRng(hash32(seed, 0x51535400 + salt, purpose, depth));

const tkey = (t) => `${t.x},${t.y}`;

/**
 * A walkable tile for a quest object: not an avoided tile, not the entry or exit, farther than config.safeRadius from the entry, in a room
 * that is neither the entry room nor the exit room (30 random tries, then a scan of those rooms, then any walkable tile that passes the same
 * tests). Pure on the floor; every walkable tile of a generated floor is reachable from the stairs (validateFloor). null only if nothing fits.
 */
export function questSpot(floor, rng, avoid = []) {
  const grid = buildGrid(floor), bad = new Set(avoid.map(tkey));
  if (floor.entry) bad.add(tkey(floor.entry));
  if (floor.exit) bad.add(tkey(floor.exit));
  const inRoom = (r, t) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h;
  const rooms = (floor.rooms ?? []).filter((r) => !(floor.entry && inRoom(r, floor.entry)) && !(floor.exit && inRoom(r, floor.exit)));
  const far = (t) => !floor.entry || Math.max(Math.abs(t.x - floor.entry.x), Math.abs(t.y - floor.entry.y)) > config.safeRadius;
  const ok = (t) => grid.walkable(t.x, t.y) && !bad.has(tkey(t)) && far(t);
  if (rooms.length) {
    for (let i = 0; i < 30; i++) {
      const r = rooms[rng.int(0, rooms.length - 1)], t = { x: rng.int(r.x, r.x + r.w - 1), y: rng.int(r.y, r.y + r.h - 1) };
      if (ok(t)) return t;
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok({ x, y })) return { x, y };
  }
  for (let y = 0; y < floor.h; y++) for (let x = 0; x < floor.w; x++) if (ok({ x, y })) return { x, y };
  return null;
}

/** The floor (3 or 4) that holds the quest item of this game: stateless, the same on every visit and after a reload. */
export const itemFloorOf = (seed) => config.quests.item.floors[questRng(seed, quests.sq2.salt, 1, 0).int(0, config.quests.item.floors.length - 1)];

/**
 * Called once from enterFloor after the floor and its monsters exist: puts the quest item (sq2 active, not yet found) and the named elite
 * (sq3 active, not yet killed) on the floor. Does nothing, draws nothing and spawns nothing unless a quest is active, and never touches
 * state.rng, so a run that never accepts a quest is bit-identical.
 */
export function placeQuestObjects(state) {
  const qs = state.quests, f = state.floor;
  if (!qs || state.depth <= 0 || state.depth >= config.bossDepth || f.custom) return;
  const sq2 = qs.sq2, sq3 = qs.sq3;
  const wantItem = sq2.s === "active" && sq2.p === 0 && !state.player.pouch.some((e) => e.quest === "sq2") && state.depth === itemFloorOf(state.seed) && !state.groundItems.some((g) => g.quest === "sq2");
  const wantElite = sq3.s === "active" && state.depth === config.quests.elite.depth && !state.monsters.some((m) => m.quest === "sq3" && m.ai !== "dead");
  if (!wantItem && !wantElite) return;
  const used = [...f.spawns.map((s) => s.tile), state.player.tile, ...state.groundItems.map((g) => g.tile), ...state.monsters.map((m) => m.tile)];
  if (wantItem) {
    const tile = questSpot(f, questRng(state.seed, quests.sq2.salt, 2, state.depth), used);
    if (tile) {
      state.groundItems.push({ id: "qi-sq2", quest: "sq2", label: quests.sq2.item.name, rarity: "normal", mark: "!", border: "none", color: "#f0e442", keep: true, tile });
      used.push(tile);
    }
  }
  if (wantElite) {
    const e = config.quests.elite, rng = questRng(state.seed, quests.sq3.salt, 3, state.depth), avoid = [...used];
    for (let i = 0; i < 12; i++) {
      const tile = questSpot(f, rng, avoid);
      if (!tile) break;
      if (spawnMonster(state, e.type, tile, null, { tier: "champion", mods: [], level: e.level, name: quests.sq3.elite.name, hpMult: e.hpMult, quest: "sq3" })) break;
      avoid.push(tile);
    }
  }
}

/** takeGround's quest branch: the item goes to the pouch, never the bag, so a full bag cannot block it. */
export function takeQuestEntry(state, entry) {
  const id = entry.quest, q = state.quests?.[id], i = state.groundItems.indexOf(entry);
  state.groundItems.splice(i, 1);
  if (!q || q.s !== "active" || state.player.pouch.some((e) => e.quest === id)) return { ok: true }; // a stale entry just disappears
  state.player.pouch.push({ id: entry.id, quest: id });
  state.quests[id] = { s: "ready", p: 1 };
  emit(state, { type: "quest.item", id: entry.id, quest: id, name: entry.label });
  emit(state, { type: "quest.step", id, title: quests[id].title, next: nextStep(state, id) });
  return { ok: true };
}

const MIN_RARITY = "magic", MAX_RARITY = "rare";

/**
 * The one source of the reward numbers (CR7-05): the payout (rewardOf), the NPC window and the journal all read this. Pure on config and content.
 * { gold, xp, potions (a count), gear: { slot, slots, minRarity } | null }: `slots` are the slots the gear can come from, `slot` is that slot when
 * there is only one (weapon) and the kind "armour" otherwise. The main quest has no reward (null).
 */
export function rewardSummary(id) {
  const def = quests[id];
  if (!def || def.kind !== "side") return null;
  const c = config.quests, qc = c[id], ref = qc.refDepth;
  return {
    gold: def.reward.gold ? qc.gold.base + qc.gold.perDepth * ref : 0,
    xp: def.reward.xp ? qc.xp.base + qc.xp.perDepth * ref : 0,
    potions: def.reward.potions && qc.potions ? qc.potions : 0,
    gear: def.reward.gear ? { slot: qc.slots.length === 1 ? qc.slots[0] : "armour", slots: [...qc.slots], minRarity: MIN_RARITY } : null,
  };
}

/** What wearing an item takes, as one number (level first, then the attribute points): the tie-break of the reward roll. */
const reqCost = (it) => Object.entries(it.reqs ?? {}).reduce((n, [k, v]) => n + (k === "level" ? v * 100 : v), 0);

/**
 * The reward of a side quest as data: gold, xp, gear (rolled, 0 or 1 item) and potions. No state is touched (the gear stream is derived).
 * CR7-06: the gear depends on the seed and the hero's class (affix tag) only, never on level, attributes or inventory: rewardRerolls candidates are
 * rolled from the seed stream at the quest's fixed item level and the one that asks the least of its wearer is paid (level first, then attribute
 * points; the first of equals), so a respec or a level-up cannot fish for another reward and a refused-then-retried hand-in pays the same item.
 */
export function rewardOf(state, id) {
  const def = quests[id], c = config.quests, qc = c[id], ilvl = c.gearFloor * config.ilvlPerDepth, sum = rewardSummary(id);
  const out = { gold: sum.gold, xp: sum.xp, gear: null, potions: [] };
  if (sum.gear) {
    const rng = questRng(state.seed, def.salt, 4, 0), tries = Math.max(1, c.rewardRerolls);
    for (let i = 0; i < tries; i++) {
      const it = rollItem(rng, { depth: c.gearFloor, ilvl, minRarity: sum.gear.minRarity, maxRarity: MAX_RARITY, slot: rng.pick(qc.slots), affixTag: affixTagOf(state) });
      if (!out.gear || reqCost(it) < reqCost(out.gear)) out.gear = it;
    }
  }
  if (sum.potions) {
    const rng = questRng(state.seed, def.salt, 5, 0);
    for (let i = 0; i < sum.potions; i++) out.potions.push(rollPotion(rng, ilvl));
  }
  return out;
}

/** Hand a ready quest in, atomically (no dialog gate; the input command and the completeQuest cheat share it). */
export function handInQuest(state, id) {
  const def = quests[id], q = state.quests?.[id];
  if (!def || def.kind !== "side" || !q) return fail("unknown quest");
  if (q.s === "completed") return fail("already done");
  if (q.s !== "ready") return fail("not ready");
  const pouchEntry = def.objective.type === "item" ? state.player.pouch.find((e) => e.quest === id) : null;
  if (def.objective.type === "item" && !pouchEntry) return fail("not ready");
  const r = rewardOf(state, id), items = [...(r.gear ? [r.gear] : []), ...r.potions];
  const dry = structuredClone(state.inventory); // dry run on a copy of the bag with the real autoplace order (gear first, then potions)
  if (!items.every((it) => autoplace(dry, structuredClone(it)))) {
    emit(state, { type: "quest.handInRefused", id, reason: "bagFull" });
    return { ok: false, error: "bagFull", reason: "bagFull" };
  }
  giveGold(state, r.gold);
  gainXp(state, r.xp);
  for (const it of items) { mint(state, it); autoplace(state.inventory, it); }
  state.player.pouch = state.player.pouch.filter((e) => e.quest !== id);
  state.quests[id] = { s: "completed", p: q.p };
  emit(state, { type: "quest.completed", id, title: def.title, rewards: { gold: r.gold, xp: r.xp, items: items.map((it) => it.name) } });
  if (state.quests.pinned === id) {
    const open = sideIds.find((o) => o !== id && (state.quests[o].s === "active" || state.quests[o].s === "ready"));
    state.quests.pinned = stateOf(state, "main") === "active" || !open ? "main" : open;
    emit(state, { type: "quest.pinned", id: state.quests.pinned });
  }
  return OK;
}

/** Input questHandIn { id }: needs the giver's dialog open (same gate as accept). Refused with bagFull when the whole reward does not fit. */
export function questHandIn(state, id) {
  if (typeof id !== "string") return fail("bad id");
  const def = quests[id];
  if (!def || def.kind !== "side" || !state.quests) return fail("unknown quest");
  const gate = giverGate(state, def);
  return gate ? fail(gate) : handInQuest(state, id);
}
