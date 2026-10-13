// Bot policy (pure, no DOM, no clocks, no randomness): explore the floor, fight what it finds, stop when the floor is
// clear or the hero is dead. Shared by the Node headless runner and the Playwright runner (which drives window.__app):
// both call decide(view, mem) with a state-shaped view and execute the returned command through the same input path
// (`applyInput` / `__app.cmd`). Commands: { t: "moveTo", tile } | { t: "attack", id } | null (keep the current order).
export const BOT = {
  decideEvery: 6,       // ticks between decisions (10 Hz at 60 ticks/s)
  engageRange: 9,       // awake monsters this close (Chebyshev tiles) are fought first
  idleHuntRange: 7,     // sleeping monsters this close are attacked too (the bot clears the floor)
  arriveRadius: 2,      // a room counts as explored when the hero is this close to its centre
  stuckTicks: 150,      // no tile change for this long with an order active = a stuck event
  fightStuckTicks: 300, // same, while chasing a target that is not adjacent
  waitRange: 6,         // a monster already chasing the hero from this close is waited for (walking into it makes both circle each other)
  waitTicks: 240,       // give up waiting for a chaser that never arrives (blocked) after this long
  drinkBelow: 0.4,      // drink a health potion (belt) below this share of hpMax
  lootTries: 3,         // pickup orders per ground entry before the bot gives up on it
};

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** profile: { reckless } - a reckless bot never waits for chasers; it walks into packs (shows how deadly the floor is). */
export function createBotMemory(profile = {}) {
  return { profile, rooms: null, goal: null, lastKey: "", lastMoveTick: 0, stuck: 0, decisions: 0, failedMoves: 0, lootTries: {}, lootSkip: new Set(), noEquip: new Set(), waitSince: -1, waitGaveUp: 0, done: false, skip: new Set() };
}

/** Record the outcome of a command the runner executed (a refused move makes the bot try another room). */
export function noteResult(mem, cmd, res) {
  if (cmd?.t === "moveTo" && res && res.ok === false) { mem.failedMoves++; if (mem.goal) mem.goal.done = true; mem.goal = null; }
  if (cmd?.t === "attack" && res && res.ok === false) mem.failedMoves++;
  if (cmd?.t === "pickup") { mem.lootTries[cmd.id] = (mem.lootTries[cmd.id] ?? 0) + 1; if (res && res.ok === false) mem.lootSkip.add(cmd.id); }
  if (cmd?.t === "equip" && res && res.ok === false) mem.noEquip.add(cmd.id);
}

/** Rough value of a gear item for the "is this an upgrade" test (bot only; not game balance). */
function gearScore(item) {
  let v = item.damage ? (item.damage.min + item.damage.max) / 2 : 0;
  v += item.defense ?? 0;
  for (const a of item.affixes ?? []) v += a.stat === "damage" ? a.value * 2 : a.stat === "defense" ? a.value : a.value / 4;
  return v;
}
const reqsMet = (p, item) => Object.entries(item.reqs ?? {}).every(([k, n]) => (k === "level" ? p.level : p.attrs[k] ?? 0) >= n);

/** An equip command for the best usable upgrade in the inventory, or null. One-handed weapons and armour only. */
function upgrade(view, mem) {
  const eq = view.equipment ?? {};
  for (const it of view.inventory?.items ?? []) {
    if (it.kind !== "gear" || it.twoHanded || mem.noEquip.has(it.id) || !reqsMet(view.player, it)) continue;
    const slot = it.slot === "ring" ? (!eq.ring1 ? "ring1" : !eq.ring2 ? "ring2" : null) : it.slot;
    if (!slot) continue;
    const cur = eq[slot];
    if (!cur || (!cur.twoHanded && gearScore(it) > gearScore(cur))) return { t: "equip", id: it.id, slot };
  }
  return null;
}

/** The nearest ground entry the bot has not given up on (gold is always worth it; items only while a spot may exist). */
function nextLoot(view, mem) {
  const from = view.player.tile;
  let best = null, bd = Infinity;
  for (const g of view.groundItems ?? []) {
    if (mem.lootSkip.has(g.id) || (mem.lootTries[g.id] ?? 0) >= BOT.lootTries) continue;
    const d = cheb(g.tile, from);
    if (d < bd) { bd = d; best = g; }
  }
  return best ? { t: "pickup", id: best.id } : null;
}

/** Nearest monster; one that is already hitting the hero ("attack") counts as 2 tiles closer (it is the one to kill). */
function nearest(list, from) {
  let best = null, bd = Infinity, bk = Infinity;
  for (const m of list) { const d = cheb(m.tile, from), k = d - (m.ai === "attack" ? 2 : 0); if (k < bk) { bk = k; bd = d; best = m; } }
  return best ? { m: best, d: bd } : null;
}

export function decide(view, mem) {
  if (view.scene !== "floor" || view.paused) return null;
  const p = view.player, t = view.tick;
  mem.decisions++;
  if (!mem.rooms) mem.rooms = view.floor.rooms.map((r, i) => ({ i, x: r.x + (r.w >> 1), y: r.y + (r.h >> 1), done: false }));
  const key = `${p.tile.x},${p.tile.y}`;
  if (key !== mem.lastKey || p.action === "attack" || p.next) { mem.lastKey = key; mem.lastMoveTick = t; } // progress = moving or swinging
  const live = view.monsters.filter((m) => m.ai !== "dead");
  const busy = !!(p.next || p.path.length || p.target || p.pickup);
  // potions: drink coffee from the belt when health is low
  if (view.belt && p.hp > 0 && p.hp < p.hpMax * BOT.drinkBelow) {
    const i = view.belt.findIndex((b) => b && b.restores === "hp");
    if (i >= 0) return { t: "useBelt", index: i };
  }
  if (live.length === 0) {
    const c = upgrade(view, mem) ?? nextLoot(view, mem);
    if (c) return c.t === "pickup" && p.pickup === c.id ? null : c;
    if (busy) return null; // still walking to the last pile
    mem.done = true;
    return null;
  }
  const target = p.target ? live.find((m) => m.id === p.target) : null;

  // stuck: an order is active but the hero has neither moved nor swung for a long time
  if (busy && t - mem.lastMoveTick > (target ? BOT.fightStuckTicks : BOT.stuckTicks) && !(target && cheb(target.tile, p.tile) <= 1)) {
    mem.stuck++; mem.lastMoveTick = t;
    if (mem.goal) { mem.goal.done = true; mem.goal = null; }
    if (target) mem.skip.add(target.id);
  }
  // rooms the hero has walked into are explored
  for (const r of mem.rooms) if (!r.done && cheb(r, p.tile) <= BOT.arriveRadius) r.done = true;
  if (mem.goal?.done) mem.goal = null;

  // 1. awake monsters nearby: fight the nearest
  const awake = live.filter((m) => m.ai !== "idle" && !mem.skip.has(m.id)), a = nearest(awake, p.tile);
  // a chaser on its way: stand still and let it come (the hero holds position; a moveTo on the own tile cancels walking)
  if (!mem.profile.reckless && a && (a.m.ai === "chase" || a.m.ai === "notice") && a.d >= 2 && a.d <= BOT.waitRange && !live.some((m) => m.ai === "attack")) {
    if (mem.waitSince < 0) mem.waitSince = t;
    if (t - mem.waitSince <= BOT.waitTicks) return busy ? { t: "moveTo", tile: { x: p.tile.x, y: p.tile.y } } : null;
    mem.skip.add(a.m.id); mem.waitGaveUp++; mem.waitSince = -1; // it is not coming: carry on without it
  } else mem.waitSince = -1;
  if (a && a.d <= BOT.engageRange) {
    // hysteresis: only switch targets when the new one is clearly closer (two monsters at similar range made the hero dither)
    if (target && target.id !== a.m.id && target.ai !== "chase" && cheb(target.tile, p.tile) <= a.d + 1) return null;
    return p.target === a.m.id ? null : { t: "attack", id: a.m.id };
  }
  if (target) return null; // keep chasing / fighting the current target
  // 2. sleeping monsters close by: wake and clear them
  const idle = live.filter((m) => !mem.skip.has(m.id)), s = nearest(idle, p.tile);
  if (s && s.d <= BOT.idleHuntRange) return { t: "attack", id: s.m.id };
  if (busy) return null; // already walking somewhere
  // 3. gear and loot lying around, then explore
  const spare = upgrade(view, mem) ?? nextLoot(view, mem);
  if (spare) return spare;
  // 4. explore: nearest unexplored room centre
  let best = null, bd = Infinity;
  for (const r of mem.rooms) if (!r.done) { const d = cheb(r, p.tile); if (d < bd) { bd = d; best = r; } }
  if (best) { mem.goal = best; return { t: "moveTo", tile: { x: best.x, y: best.y } }; }
  // 5. everything explored: hunt whatever is left
  if (s) return { t: "attack", id: s.m.id };
  const any = nearest(live, p.tile);
  if (any) { mem.skip.clear(); return { t: "attack", id: any.m.id }; }
  return null;
}
