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
};

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** profile: { reckless } - a reckless bot never waits for chasers; it walks into packs (shows how deadly the floor is). */
export function createBotMemory(profile = {}) {
  return { profile, rooms: null, goal: null, lastKey: "", lastMoveTick: 0, stuck: 0, decisions: 0, failedMoves: 0, waitSince: -1, waitGaveUp: 0, done: false, skip: new Set() };
}

/** Record the outcome of a command the runner executed (a refused move makes the bot try another room). */
export function noteResult(mem, cmd, res) {
  if (cmd?.t === "moveTo" && res && res.ok === false) { mem.failedMoves++; if (mem.goal) mem.goal.done = true; mem.goal = null; }
  if (cmd?.t === "attack" && res && res.ok === false) mem.failedMoves++;
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
  if (live.length === 0) { mem.done = true; return null; }
  const busy = !!(p.next || p.path.length || p.target);
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
  // 3. explore: nearest unexplored room centre
  let best = null, bd = Infinity;
  for (const r of mem.rooms) if (!r.done) { const d = cheb(r, p.tile); if (d < bd) { bd = d; best = r; } }
  if (best) { mem.goal = best; return { t: "moveTo", tile: { x: best.x, y: best.y } }; }
  // 4. everything explored: hunt whatever is left
  if (s) return { t: "attack", id: s.m.id };
  const any = nearest(live, p.tile);
  if (any) { mem.skip.clear(); return { t: "attack", id: any.m.id }; }
  return null;
}
