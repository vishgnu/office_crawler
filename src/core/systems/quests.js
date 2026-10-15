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
import { sellValue } from "../items/price.js";
import { quests, sideIds, mainIds, mainSteps } from "../content/quests.js";
import { npcs } from "../content/npcs.js";
import { classById } from "../content/classes.js";
import { mainStep, mainState, activeMainId, goalOf, nextStep, objCfg } from "./questview.js";

const fail = (error) => ({ ok: false, error });
/** A quest definition by id, own keys only: "constructor", "toString" and "__proto__" are not quests (ADV-R7-07). */
export const questDef = (id) => (typeof id === "string" && Object.hasOwn(quests, id) ? quests[id] : undefined);
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

/** Pure reducer of a side quest: (quest state, event, monster) -> quest state. `mon` is the killed monster for `kill`. The objective block is the quest's own (objCfg). */
export function reduceSide(q, id, ev, mon, depth) {
  if (ev.type !== "kill" || q.s !== "active" || !mon) return q;
  const o = quests[id].objective;
  if (o.type === "kill") {
    const k = objCfg(id);
    if (mon.type !== k.monster || mon.summoned || !k.depths.includes(depth)) return q;
    const p = Math.min(k.count, q.p + 1);
    return { s: p >= k.count ? "ready" : "active", p };
  }
  if (o.type === "elite" && mon.quest === id) return { s: "ready", p: 1 };
  return q;
}

/** The arc reward of a main quest as { gold, xp } (arcs 1 and 2; the last arc pays nothing: null). Pure on config. */
const arcPay = (id) => {
  const c = config.quests.arc?.[id];
  return c ? { gold: c.gold.base + c.gold.perDepth * c.refDepth, xp: c.xp.base + c.xp.perDepth * c.refDepth } : null;
};

/**
 * Where the pin goes when the pinned quest completes: the active main quest, else the first open side quest (not the one that just finished), else the
 * last main quest (it keeps the journal valid). One quest.pinned event when it moves.
 */
function repin(state, finished) {
  const q = state.quests, active = activeMainId(q.main.m), open = sideIds.find((o) => o !== finished && (q[o].s === "active" || q[o].s === "ready"));
  const to = active ?? open ?? mainIds[mainIds.length - 1];
  if (to === q.pinned) return;
  q.pinned = to;
  emit(state, { type: "quest.pinned", id: to });
}

/**
 * Apply a change to the main milestones, then emit the cue events by comparing the derived state before and after (the tap and the cheats share this):
 * for every arc that became complete, in order, the arc reward is paid (gold and experience, once) and one quest.completed is emitted; then, if an arc
 * is still open, one quest.step for it (`unlocked: true` when the active arc changed). A repeated event changes nothing and emits nothing.
 */
export function changeMain(state, change) {
  const qs = state.quests, m0 = qs.main.m, beforeStep = mainStep(m0), before = Object.fromEntries(mainIds.map((id) => [id, mainState(m0, id)])), pinned = qs.pinned;
  qs.main.m = change(m0);
  const m = qs.main.m, after = mainStep(m);
  if (after === beforeStep) return;
  for (const id of mainIds) {
    if (before[id] === "completed" || mainState(m, id) !== "completed") continue;
    const pay = arcPay(id), r = { gold: 0, xp: 0, items: [] };
    if (pay) {
      if (giveGold(state, pay.gold)) r.gold = pay.gold;
      if (pay.xp > 0) { gainXp(state, pay.xp); r.xp = pay.xp; }
    }
    emit(state, { type: "quest.completed", id, title: quests[id].title, rewards: r });
  }
  const now = activeMainId(m);
  if (now) {
    const st = mainSteps[after - 1], ev = { type: "quest.step", id: now, step: st.arcStep, title: quests[now].title, next: st.line };
    if (before[now] !== "active") ev.unlocked = true;
    emit(state, ev);
  }
  if (mainIds.includes(pinned) && mainState(m, pinned) === "completed") repin(state, pinned);
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
  const def = questDef(id);
  if (!def || def.kind !== "side" || !state.quests) return fail("unknown quest");
  const gate = giverGate(state, def);
  if (gate) return fail(gate);
  const q = state.quests[id];
  if (q.s === "completed") return fail("already done");
  if (q.s !== "available") return fail("not available");
  state.quests[id] = { s: "active", p: 0 };
  if (quests[id].objective.type === "kill") reviveKills(state, id);
  emit(state, { type: "quest.accepted", id, title: def.title, next: nextStep(state, id) });
  return OK;
}

/**
 * CR7-01 (per quest since R7-4): floors keep their killed spawns for the whole session, and only kills after Accept count, so a player who cleared the kill
 * floors before accepting could never reach the count. On Accept, if fewer monsters of the quest's kind are alive on its floors than the quest still needs,
 * the killed spawns of that kind come back, floor by floor and in spawn order (no rng, no spawn of anything new; a run that never accepts is untouched).
 * The floors are parked while the hero is in the Lobby; the floor the hero stands on (never the case at the giver) counts its living monsters as they are.
 */
export function reviveKills(state, id) {
  const k = objCfg(id), need = k.count - state.quests[id].p;
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
/** The sq1 form of reviveKills (the name FIX-R7-CORE gave it). */
export const reviveInterns = (state, id = "sq1") => reviveKills(state, id);

/**
 * Input questPin { id }: a main quest that is open, or a side quest that is not completed. "main" means the active main quest and is stored as its id.
 * A locked main quest is refused (`locked`), a completed one or a completed side quest too (`already done`). Pinning the pinned quest again is a no-op.
 */
export function questPin(state, id) {
  if (typeof id !== "string") return fail("bad id");
  if (!questDef(id) || !state.quests) return fail("unknown quest");
  if (id === "main") id = activeMainId(state.quests.main.m) ?? "main";
  if (quests[id].kind === "main") {
    const st = mainState(state.quests.main.m, id);
    if (st === "unavailable") return fail("locked");
    if (st === "completed") return fail("already done");
  } else if (state.quests[id].s === "completed") return fail("already done");
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

/** The floor that holds the quest item of this game (sq2: 3 or 4, sq4: 5 or 6): stateless, the same on every visit and after a reload. */
export const itemFloorOf = (seed, id = "sq2") => { const f = objCfg(id, "item").floors; return f[questRng(seed, quests[id].salt, 1, 0).int(0, f.length - 1)]; };

/**
 * Called once from enterFloor after the floor and its monsters exist: puts the quest items (an item quest active, not yet found) and the named elites
 * (an elite quest active, not yet killed) of this floor on it. Does nothing, draws nothing and spawns nothing unless such a quest is active, and never
 * touches state.rng, so a run that never accepts a quest is bit-identical. Each quest draws from its own stateless stream (salt of the quest).
 */
export function placeQuestObjects(state) {
  const qs = state.quests, f = state.floor;
  if (!qs || state.depth <= 0 || state.depth >= config.bossDepth || f.custom) return;
  const items = [], elites = [];
  for (const id of sideIds) {
    const q = qs[id], type = quests[id].objective.type;
    if (type === "item" && q.s === "active" && q.p === 0 && !state.player.pouch.some((e) => e.quest === id) && state.depth === itemFloorOf(state.seed, id) && !state.groundItems.some((g) => g.quest === id)) items.push(id);
    if (type === "elite" && q.s === "active" && state.depth === objCfg(id, "elite").depth && !state.monsters.some((m) => m.quest === id && m.ai !== "dead")) elites.push(id);
  }
  const kills = sideIds.filter((id) => quests[id].objective.type === "kill" && qs[id].s === "active" && state.depth === Math.max(...objCfg(id, "kill").depths));
  if (!items.length && !elites.length && !kills.length) return;
  const used = [...f.spawns.map((s) => s.tile), state.player.tile, ...state.groundItems.map((g) => g.tile), ...state.monsters.map((m) => m.tile)];
  for (const id of items) {
    const tile = questSpot(f, questRng(state.seed, quests[id].salt, 2, state.depth), used);
    if (tile) {
      state.groundItems.push({ id: `qi-${id}`, quest: id, label: quests[id].item.name, rarity: "normal", mark: "!", border: "none", color: "#f0e442", keep: true, tile });
      used.push(tile);
    }
  }
  for (const id of kills) topUpKills(state, id, used);
  for (const id of elites) {
    const e = objCfg(id, "elite"), rng = questRng(state.seed, quests[id].salt, 3, state.depth), avoid = [...used];
    for (let i = 0; i < 12; i++) {
      const tile = questSpot(f, rng, avoid);
      if (!tile) break;
      if (spawnMonster(state, e.type, tile, null, { tier: "champion", mods: [], level: e.level, name: quests[id].elite.name, hpMult: e.hpMult, quest: id })) break;
      avoid.push(tile);
    }
  }
}

/**
 * ADV-R7-10: a kill quest must be winnable on every seed. On the last floor of its kill range, while the quest is active, the monsters of its kind that are
 * still alive on the kill floors (this floor as it stands, the others as their spawns minus their killed ones) plus the extras placed here must reach what
 * the quest still needs; the missing ones are placed now on questSpot tiles from the quest's own stream (purpose 6), as plain monsters of that kind that
 * count like any spawn. They are not in floor.spawns, so a floor entry rebuilds them from the same rule (kills lower the need as they raise the progress).
 * Nothing is drawn or spawned when the quest is not active or the floors already hold enough (reviveKills has brought killed spawns back by then).
 */
function topUpKills(state, id, used) {
  const k = objCfg(id, "kill"), need = k.count - state.quests[id].p;
  let alive = state.monsters.filter((m) => m.type === k.monster && !m.summoned && m.ai !== "dead").length;
  for (const d of k.depths) {
    if (d === state.depth) continue;
    const parked = state.floors[d], floor = parked?.floor ?? generateFloor(state.seed, d), killed = new Set(parked?.killed ?? []);
    floor.spawns.forEach((s, i) => { if (s.type === k.monster && !killed.has(i)) alive++; });
  }
  const rng = questRng(state.seed, quests[id].salt, 6, state.depth), avoid = [...used];
  for (let missing = need - alive, tries = 0; missing > 0 && tries < 60; tries++) {
    const tile = questSpot(state.floor, rng, avoid);
    if (!tile) break;
    avoid.push(tile);
    if (spawnMonster(state, k.monster, tile)) { used.push(tile); missing--; }
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
/** The rarity range of a quest's gear reward (`config.quests[id].rarity`, default magic to rare) and its item level floor (`gearFloor`, default `config.quests.gearFloor`). */
const rarityOf = (id) => ({ min: config.quests[id]?.rarity?.min ?? MIN_RARITY, max: config.quests[id]?.rarity?.max ?? MAX_RARITY });
const JEWELLERY = ["ring", "amulet", "belt"]; // slots that read as "accessory" in the summary
const gearFloorOf = (id) => config.quests[id]?.gearFloor ?? config.quests.gearFloor;

/**
 * The one source of the reward numbers (CR7-05): the payout (rewardOf), the NPC window and the journal all read this. Pure on config and content.
 * { gold, xp, potions (a count), gear: { slot, slots, minRarity, maxRarity } | null }: `slots` are the slots the gear can come from, `slot` is that slot when
 * there is only one (weapon), "accessory" when all of them are ring, amulet or belt, and "armour" otherwise. Arcs 1 and 2 pay gold and experience (what the tap pays); the last arc has no reward (null).
 */
export function rewardSummary(id) {
  const def = quests[id];
  if (def?.kind === "main") { const p = arcPay(id); return p ? { gold: p.gold, xp: p.xp, potions: 0, gear: null } : null; }
  if (!def || def.kind !== "side") return null;
  const c = config.quests, qc = c[id], ref = qc.refDepth, r = rarityOf(id);
  return {
    gold: def.reward.gold ? qc.gold.base + qc.gold.perDepth * ref : 0,
    xp: def.reward.xp ? qc.xp.base + qc.xp.perDepth * ref : 0,
    potions: def.reward.potions && qc.potions ? qc.potions : 0,
    gear: def.reward.gear ? { slot: qc.slots.length === 1 ? qc.slots[0] : qc.slots.every((x) => JEWELLERY.includes(x)) ? "accessory" : "armour", slots: [...qc.slots], minRarity: r.min, maxRarity: r.max } : null,
  };
}

/** The hero level a quest's gear reward is measured against (never the hero's own): `config.quests[id].refLevel`, else the gear floor plus `config.quests.refLevelOffset`. */
const refLevelOf = (id) => config.quests[id]?.refLevel ?? gearFloorOf(id) + config.quests.refLevelOffset;

/**
 * Can the reference hero of this quest wear `item`? CR7L-06: a hero of level `refLevelOf(id)` of the state's class with its start attributes and every point it
 * has earned in its power attribute (the build the class plays). Never reads the real hero's level or attributes, so a respec or a level-up cannot fish for a reward.
 */
export function refHeroWears(state, id, item) {
  const ref = refLevelOf(id), cls = classById(state.player.class), attrs = { ...(cls?.attrs ?? config.player.attrs) }, pow = cls?.derived?.powerAttr ?? config.derived.powerAttr;
  attrs[pow] = (attrs[pow] ?? 0) + (ref - 1) * config.attrPointsPerLevel;
  return Object.entries(item.reqs ?? {}).every(([k, v]) => (k === "level" ? ref : attrs[k] ?? 0) >= v);
}

/** What wearing an item takes, as one number (level first, then the attribute points): the tie-break of the reward roll. */
const reqCost = (it) => Object.entries(it.reqs ?? {}).reduce((n, [k, v]) => n + (k === "level" ? v * 100 : v), 0);

/**
 * The reward of a side quest as data: gold, xp, gear (rolled, 0 or 1 item) and potions. No state is touched (the gear stream is derived).
 * CR7-06: the gear depends on the seed and the hero's class (affix tag) only, never on level, attributes or inventory: rewardRerolls candidates are
 * rolled from the seed stream at the quest's fixed item level and the best one a hero of the quest's reference level can wear is paid (refLevelOf; CR7L-06), so a respec or a level-up cannot fish for another reward and a refused-then-retried hand-in pays the same item.
 */
export function rewardOf(state, id) {
  const def = quests[id], c = config.quests, qc = c[id], gf = gearFloorOf(id), ilvl = gf * config.ilvlPerDepth, sum = rewardSummary(id);
  const out = { gold: sum.gold, xp: sum.xp, gear: null, potions: [] };
  if (sum.gear) {
    const rng = questRng(state.seed, def.salt, 4, 0), tries = Math.max(1, c.rewardRerolls), cands = [];
    for (let i = 0; i < tries; i++) cands.push(rollItem(rng, { depth: gf, ilvl, minRarity: sum.gear.minRarity, maxRarity: sum.gear.maxRarity, slot: rng.pick(qc.slots), affixTag: affixTagOf(state) }));
    // CR7L-06: the best candidate a hero of the reference level can wear (highest requirement cost among those the reference hero wears, see refHeroWears; the first of equals); if none qualifies, the one that asks the least. Seed-pure: the reference level is a number of the quest, not of the hero.
    const fit = cands.filter((it) => refHeroWears(state, id, it));
    // ties (typical for classes whose weapons all ask level 1) go to the more valuable piece (rarity and affixes), then to the first
    const better = (x, y) => { const a = reqCost(x), b = reqCost(y); return (fit.length ? a > b : a < b) || (a === b && sellValue(x) > sellValue(y)); };
    out.gear = (fit.length ? fit : cands).reduce((best, it) => (!best || better(it, best) ? it : best), null);
  }
  if (sum.potions) {
    const rng = questRng(state.seed, def.salt, 5, 0);
    for (let i = 0; i < sum.potions; i++) out.potions.push(rollPotion(rng, ilvl));
  }
  return out;
}

/** Hand a ready quest in, atomically (no dialog gate; the input command and the completeQuest cheat share it). */
export function handInQuest(state, id) {
  const def = questDef(id), q = def ? state.quests?.[id] : undefined;
  if (!def || def.kind !== "side" || !q) return fail("unknown quest");
  if (q.s === "completed") return fail("already done");
  if (q.s !== "ready") return fail("not ready");
  const pouchEntry = def.objective.type === "item" ? state.player.pouch.find((e) => e.quest === id) : null;
  if (def.objective.type === "item" && !pouchEntry) return fail("not ready");
  const r = rewardOf(state, id), items = [...(r.gear ? [r.gear] : []), ...r.potions];
  // R8-Q1: a full bag never blocks the hand-in. Gold and experience are paid at once; every item that does not fit goes to the owed pouch
  // (state.player.owed) and moves into the bag as soon as there is room (settleOwed, every tick). Nothing is refused, nothing is lost.
  giveGold(state, r.gold);
  gainXp(state, r.xp);
  let owed = 0;
  for (const it of items) { mint(state, it); if (!autoplace(state.inventory, it)) { (state.player.owed ??= []).push(it); owed++; } }
  state.player.pouch = state.player.pouch.filter((e) => e.quest !== id);
  state.quests[id] = { s: "completed", p: q.p };
  emit(state, { type: "quest.completed", id, title: def.title, rewards: { gold: r.gold, xp: r.xp, items: items.map((it) => it.name), ...(owed ? { owed } : {}) } });
  if (state.quests.pinned === id) repin(state, id);
  return OK;
}

/** Upper bound of the owed pouch: one gear piece and a few potions per side quest (the save schema uses it too). */
export const OWED_MAX = 4 * sideIds.length;

/**
 * R8-Q1: move owed reward items into the bag, in order, as far as they fit. Called every tick (cheap when nothing is owed) and after a load.
 * The key `player.owed` exists only while something is owed, so a run that never has a full bag at a hand-in hashes as before.
 * Each delivered item emits a `pickup` event (no new event type).
 */
export function settleOwed(state) {
  const owed = state.player.owed;
  if (!owed) return;
  if (state.cursorItem) return; // CR8-01: the hero holds an item (it left a cell on purpose); owed waits until the hand is empty so it cannot take that cell
  for (let i = 0; i < owed.length;) {
    if (!autoplace(state.inventory, owed[i])) { i++; continue; }
    const [it] = owed.splice(i, 1);
    emit(state, { type: "pickup", id: it.id, name: it.name, rarity: it.rarity }); // the same event as a pickup from the ground: toast and cue exist
  }
  if (!owed.length) delete state.player.owed;
}

/** Input questHandIn { id }: needs the giver's dialog open (same gate as accept). Never refused for a full bag (R8-Q1): what does not fit waits in the owed pouch. */
export function questHandIn(state, id) {
  if (typeof id !== "string") return fail("bad id");
  const def = questDef(id);
  if (!def || def.kind !== "side" || !state.quests) return fail("unknown quest");
  const gate = giverGate(state, def);
  return gate ? fail(gate) : handInQuest(state, id);
}
