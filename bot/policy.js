// Bot policy (pure, no DOM, no clocks, no randomness): explore the floor, fight what it finds, stop when the floor is
// clear or the hero is dead. Shared by the Node headless runner and the Playwright runner (which drives window.__app):
// both call decide(view, mem) with a state-shaped view and execute the returned command through the same input path
// (`applyInput` / `__app.cmd`). Commands: { t: "moveTo", tile } | { t: "attack", id } | null (keep the current order).
import { hasLineOfSight, rayClear } from "../src/core/los.js";
import { skills as SKILLS, manaCost } from "../src/core/content/skills.js";
import { classById, defaultClass } from "../src/core/content/classes.js";
import { config as CORE } from "../src/core/config.js";

export const BOT = {
  decideEvery: 6,       // ticks between decisions (10 Hz at 60 ticks/s)
  engageRange: 9,       // awake monsters this close (Chebyshev tiles) are fought first
  idleHuntRange: 7,     // sleeping monsters this close are attacked too (the bot clears the floor)
  arriveRadius: 2,      // a room counts as explored when the hero is this close to its centre
  stuckTicks: 150,      // no tile change for this long with an order active = a stuck event
  fightStuckTicks: 300, // same, while chasing a target that is not adjacent
  waitRange: 10,        // a monster already chasing the hero from this close is waited for (walking into it makes both circle each other)
  noProgressTicks: 3600, // no xp gained for this long on a floor before the boss: write off the awake monsters that never arrive
  waitTicks: 240,       // give up waiting for a chaser that never arrives (blocked) after this long
  drinkBelow: 0.4,      // drink a health potion (belt) below this share of hpMax
  lootTries: 3,         // pickup orders per ground entry before the bot gives up on it
  throwRange: 9,        // projectile skills at a target at least this close (and farther than 1 tile) with a clear line
  burstCount: 3,        // a tier-1 area skill when this many awake monsters are within its radius
  healBelow: 0.5,       // heal skills below this share of hpMax
  muteBelow: 0.6,       // crowd control (Mute) when two or more attackers are on the hero and health is below this share
  shieldBelow: 0.7,     // shields (Lockout, Packet Filter) when something is hitting the hero and health is below this share
  shopMinGold: 25,      // buy belt potions in town with at least this much gold
  gearShopGold: 400,    // visit the vendor for gear upgrades with at least this much gold
  potionReserve: 150,   // gold kept back for belt potions when buying gear
  sellAbove: 4,         // sell spare gear to the vendor when more than this many gear items are left in the inventory (keeps the bag from filling up)
  // The skill build order, the cast priority and the potion thresholds come from the class (content/classes.js `bot`): one policy, three classes.
  restBelow: 0.95,      // on the cleared last floor, wait until health is at least this share before taking the lift to the boss
  restMaxTicks: 6000,   // ... but not longer than this
  kiteEvery: 45,        // ticks between two kiting steps of a ranged class
  kiteMaxSpeed: 0.95,   // only monsters slower than the hero are kited
  dodgeMargin: 0.9,     // step this far outside a telegraphed circle (tiles); also covers the hero being mid-step
  volleyCos: 0.7,       // a volley is dodged by standing where the angle to its aim line is at least acos(this) (about 45 degrees)
  attrWeights: { stamina: 3, grit: 3, agility: 2, focus: 1 }, // points go where (points spent / weight) is lowest
};

const RANGED = new Set(["printer-demon", "consultant"]); // monsters that shoot: kiting them gains nothing
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** profile: { reckless } - a reckless bot never waits for chasers; it walks into packs (shows how deadly the floor is). */
export function createBotMemory(profile = {}) {
  return { profile, depth: -1, shopped: false, sold: false, rooms: null, goal: null, lastKey: "", lastMoveTick: 0, stuck: 0, decisions: 0, failedMoves: 0, lootTries: {}, lootSkip: new Set(), noEquip: new Set(), waitSince: -1, waitGaveUp: 0, watchdogFired: 0, watchdogQuiet: 0, watchdogLog: [], done: false, skip: new Set() };
}

/** Record the outcome of a command the runner executed (a refused move makes the bot try another room). */
export function noteResult(mem, cmd, res) {
  if (cmd?.t === "moveTo" && res && res.ok === false) { mem.failedMoves++; if (mem.goal) mem.goal.done = true; mem.goal = null; }
  if (cmd?.t === "attack" && res && res.ok === false) mem.failedMoves++;
  if (cmd?.t === "pickup") { mem.lootTries[cmd.id] = (mem.lootTries[cmd.id] ?? 0) + 1; if (res && res.ok === false) mem.lootSkip.add(cmd.id); }
  if (cmd?.t === "equip" && res && res.ok === false) mem.noEquip.add(cmd.id);
  if (cmd?.t === "learnSkill" && res && res.ok === false) mem.noLearn = true;
  if (cmd?.t === "toggleAura" && res && res.ok === false) mem.auraFail = (mem.auraFail ?? 0) + 1;
  if (cmd?.t === "toBelt" && res && res.ok === false) mem.beltFail = true;
  if (cmd?.t === "useStairs" && res && res.ok === false) mem.failedMoves++;
  if (cmd?.t === "buy" && res && res.ok === false) { if (cmd.gear) { mem.noBuy ??= new Set(); mem.noBuy.add(cmd.id); } else mem.shopped = true; }
  if (cmd?.t === "sell" && res && res.ok === false) mem.sold = true;
}

/**
 * Kiting for the ranged classes (class `bot.kite` = how close a slower melee monster may get): step to the free tile that is farthest from
 * every awake monster, at most once per `kiteEvery` ticks so the hero shoots in between. Returns a moveTo or null.
 */
function kiteMove(view, mem, live) {
  const p = view.player, cls = classOf(p), r = cls.bot.kite ?? 0;
  if (!r || view.tick - (mem.lastKite ?? -999) < BOT.kiteEvery || p.next) return null;
  const threats = live.filter((m) => (m.ai === "chase" || m.ai === "attack") && m.speed <= BOT.kiteMaxSpeed && cheb(m.tile, p.tile) <= r && !RANGED.has(m.type));
  if (!threats.length) return null;
  const ok = walkableIn(view), awake = live.filter((m) => m.ai !== "idle");
  const nearestD = (x, y) => Math.min(...awake.map((m) => Math.max(Math.abs(m.tile.x - x), Math.abs(m.tile.y - y))));
  const here = nearestD(p.tile.x, p.tile.y);
  let best = null, bk = -Infinity;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = p.tile.x + dx, y = p.tile.y + dy;
    if ((!dx && !dy) || !ok(x, y) || live.some((m) => m.tile.x === x && m.tile.y === y)) continue;
    const d = nearestD(x, y);
    const k = d * 10 - Math.max(Math.abs(dx), Math.abs(dy)); // far from the monsters, but not a long walk
    if (d >= here + 2 && k > bk && hasLineOfSight(gridOf(view), x, y, threats[0].tile.x, threats[0].tile.y)) { bk = k; best = { x, y }; }
  }
  if (!best) return null;
  mem.lastKite = view.tick;
  return { t: "moveTo", tile: best };
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

const classOf = (p) => classById(p.class) ?? classById(defaultClass);

/** Can the hero learn (or raise) this skill right now? Mirrors the core rules: class, level gate, prerequisites, maximum, points. */
function learnable(p, def) {
  if (!def || def.kind === "basic" || def.class !== p.class) return false;
  const lv = p.skills?.[def.id] ?? 0;
  if (lv >= Math.min(def.maxLevel, CORE.skillMaxLevel) || p.level < (def.reqLevel ?? 1)) return false;
  return (def.requires ?? []).every((r) => (p.skills?.[r.id] ?? 0) >= r.level);
}

/** Spend attribute and skill points (free actions). Returns a command or null. */
function spendPoints(view, mem) {
  const p = view.player;
  if (p.attrPoints > 0) {
    let best = null, bv = Infinity;
    const cls = classOf(p);
    for (const [a, w] of Object.entries(cls.bot.attrWeights ?? BOT.attrWeights)) { const v = ((p.attrs[a] ?? 10) - (cls.attrs[a] ?? 10)) / w; if (v < bv) { bv = v; best = a; } } // points spent so far / weight
    return { t: "allocate", attr: best };
  }
  if (p.skillPoints > 0 && !mem.noLearn) {
    const cls = classOf(p), lvl = (id) => p.skills?.[id] ?? 0;
    for (const [id, want] of cls.bot.buildOrder) if (lvl(id) < want && learnable(p, SKILLS[id])) return { t: "learnSkill", id };
    for (const def of Object.values(SKILLS)) if (def.class === p.class && learnable(p, def)) return { t: "learnSkill", id: def.id }; // nothing on the list: raise whatever is open
  }
  return null;
}

const gridOf = (view) => {
  const { w, h, tiles } = view.floor;
  return { opaque: (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y * w + x] === 0 || tiles[y * w + x] === 2 };
};
const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

/**
 * A skill to cast now, or null. Generic over the class: heal when hurt, a shield when something hits the hero, Mute when mobbed, then the class
 * priority list by archetype (area on a crowd, projectile and ground bursts at the target, summons while enemies are near, a trap in the way).
 */
function castSkill(view, mem, live, target) {
  const p = view.player;
  if (p.castT > 0 || !p.skills) return null;
  const cls = classOf(p), lvl = (id) => p.skills[id] ?? 0;
  const can = (id) => lvl(id) > 0 && p.mp >= manaCost(SKILLS[id], lvl(id));
  const awake = live.filter((m) => m.ai !== "idle");
  const near = (c, r) => awake.filter((m) => dist(m.tile, c) <= r);
  const attackers = awake.filter((m) => m.ai === "attack" && cheb(m.tile, p.tile) <= 1);
  const learned = Object.keys(p.skills).filter((id) => SKILLS[id] && p.skills[id] > 0);
  // the aura (switched on once the mana is there)
  for (const id of learned) if (SKILLS[id].kind === "aura" && p.aura !== id && (mem.auraFail ?? 0) < 3 && awake.length) return { t: "toggleAura", id };
  const hurt = p.hp < p.hpMax * BOT.healBelow;
  const order = [...cls.bot.priority.filter((id) => learned.includes(id)), ...learned.filter((id) => !cls.bot.priority.includes(id))];
  const tgt = target && dist(target.tile, p.tile) <= BOT.throwRange ? target : null;
  const los = (t) => hasLineOfSight(gridOf(view), p.tile.x, p.tile.y, t.x, t.y), flies = (t) => rayClear(gridOf(view), p.tile, t); // shots follow the straight ray
  // heals and shields first
  for (const id of learned) {
    const def = SKILLS[id];
    if (def.archetype === "self" && def.effects.some((e) => e.op === "heal" || e.op === "hot") && hurt && awake.length && can(id) && !(def.effects[0].op === "hot" && p.buffs?.some((b) => b.skill === id))) return { t: "cast", skill: id, tile: { ...p.tile } };
    if (def.archetype === "buff" && !p.absorb && attackers.length && p.hp < p.hpMax * BOT.shieldBelow && can(id)) return { t: "cast", skill: id, tile: { ...p.tile } };
  }
  if (attackers.length >= 2 && p.hp < p.hpMax * BOT.muteBelow && can("mute") && near(p.tile, SKILLS.mute.delivery.radius[0] + (lvl("mute") - 1) * SKILLS.mute.delivery.radius[1]).length >= 2) return { t: "cast", skill: "mute", tile: { ...p.tile } };
  for (const id of order) {
    const def = SKILLS[id];
    if (def.kind !== "active" || !can(id) || id === "mute" || def.archetype === "self" || def.archetype === "buff" || def.archetype === "dash") continue;
    const lv = lvl(id), d = def.delivery;
    if (def.archetype === "area" && d.at !== "target") {
      const r = d.radius[0] + (d.radius[1] ?? 0) * (lv - 1), n = near(p.tile, r).length;
      if (def.effects.some((e) => e.op === "status" && e.kind !== "slow") && !def.effects.some((e) => e.op === "damage")) continue; // pure crowd control is handled above
      if (n >= (def.tier >= 2 ? 2 : 1) && (def.tier >= 2 || n >= 2 || attackers.length)) return { t: "cast", skill: id, tile: { ...p.tile } };
    } else if (def.archetype === "area") { // a burst at the target
      if (tgt && dist(tgt.tile, p.tile) <= (d.range ?? 9) && los(tgt.tile) && (def.tier < 3 || near(tgt.tile, 3).length >= 2)) return { t: "cast", skill: id, tile: { ...tgt.tile } };
    } else if (def.archetype === "projectile") {
      if (tgt) { const dd = dist(tgt.tile, p.tile); if (dd > 1.5 && dd <= Math.min(BOT.throwRange, d.range) && flies(tgt.tile)) return { t: "cast", skill: id, tile: { ...tgt.tile } }; }
    } else if (def.archetype === "summon") {
      const have = (view.allies ?? []).filter((a) => a.skill === id).length;
      if (awake.length && have < Math.floor(d.count[0]) + Math.floor((d.max?.[1] ?? 0) * (lv - 1)) && near(p.tile, 9).length) return { t: "cast", skill: id, tile: { ...p.tile } };
    } else if (def.archetype === "trap") {
      if (tgt && !(view.zones ?? []).some((z) => z.skill === id && dist(z.tile, tgt.tile) < 3)) { const dd = dist(tgt.tile, p.tile); if (dd >= 2 && dd <= 7 && los(tgt.tile)) return { t: "cast", skill: id, tile: { ...tgt.tile } }; }
    }
  }
  return null;
}

const BLOCKING = new Set(["desk", "partition", "plant", "conference-table", "copier", "filing-cabinet", "box-stack", "server-rack", "generator", "reception-desk"]);
function walkableIn(view) {
  const { w, h, tiles, props = [], npcs = [] } = view.floor, blocked = new Set(props.filter((q) => q.blocks ?? BLOCKING.has(q.type)).map((q) => q.y * w + q.x));
  for (const n of npcs) blocked.add(n.tile.y * w + n.tile.x);
  return (x, y) => x >= 0 && y >= 0 && x < w && y < h && [1, 3, 4, 5].includes(tiles[y * w + x]) && !blocked.has(y * w + x);
}

/**
 * Dodge the boss's telegraphed attacks (the boss exposes its wind-up as state: kind, centre and radius, or aim direction).
 * Returns a moveTo to the nearest safe tile, or null when the hero is safe / there is nothing to dodge.
 */
const HOLD = { t: "hold" };
function dodge(view, mem, live) {
  const b = live.find((m) => m.boss?.windup && !m.boss.windup.resolved);
  if (!b) { mem.dodge = null; return null; }
  const w = b.boss.windup, p = view.player, at = p.next ?? p.tile, ok = walkableIn(view);
  const key = `${b.id}:${w.kind}:${w.tile?.x ?? w.dir?.x}:${w.tile?.y ?? w.dir?.y}`;
  if (mem.dodge?.key === key) return HOLD; // already on the way (or safe): do not walk back into the telegraph
  let safe, danger;
  if (w.kind === "slam") {
    const r = w.radius + BOT.dodgeMargin;
    danger = (x, y) => (x - w.tile.x) * (x - w.tile.x) + (y - w.tile.y) * (y - w.tile.y) <= r * r;
    safe = (x, y) => !danger(x, y);
  } else if (w.kind === "volley") {
    const cosTo = (x, y) => { const dx = x - b.tile.x, dy = y - b.tile.y, l = Math.sqrt(dx * dx + dy * dy) || 1; return (dx * w.dir.x + dy * w.dir.y) / l; };
    danger = (x, y) => cosTo(x, y) > BOT.volleyCos;
    safe = (x, y) => !danger(x, y);
  } else return null;
  if (!danger(at.x, at.y)) return HOLD;
  let best = null, bk = Infinity;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = at.x + dx, y = at.y + dy;
    if (!ok(x, y) || !safe(x, y) || (x === b.tile.x && y === b.tile.y)) continue;
    const k = Math.max(Math.abs(dx), Math.abs(dy)) * 10 + Math.abs(x - b.tile.x) + Math.abs(y - b.tile.y);
    if (k < bk) { bk = k; best = { x, y }; }
  }
  if (!best) return null;
  mem.dodge = { key };
  return { t: "moveTo", tile: best };
}

/** The vendor stock entry that raises the hero's gear score most and still leaves `reserve` gold for potions, as { index }, or null. */
function bestBuy(view, mem) {
  const eq = view.equipment ?? {}, p = view.player;
  let best = null, bv = 0;
  (view.vendor?.stock ?? []).forEach((e, index) => {
    const it = e.item;
    if (e.unlimited || it.kind !== "gear" || it.twoHanded || !reqsMet(p, it) || e.price > p.gold - BOT.potionReserve || mem.noBuy?.has(it.id)) return;
    const slot = it.slot === "ring" ? (!eq.ring1 ? "ring1" : !eq.ring2 ? "ring2" : "ring1") : it.slot, cur = eq[slot];
    if (cur?.twoHanded) return;
    const gain = gearScore(it) - (cur ? gearScore(cur) : 0);
    if (gain > bv) { bv = gain; best = { index, id: it.id }; }
  });
  return best;
}

/** Town: spend points, wear upgrades, sell spare gear and buy upgrades at the vendor, buy belt potions, then take the elevator. */
function decideTown(view, mem) {
  const p = view.player;
  const pts = spendPoints(view, mem) ?? upgrade(view, mem);
  if (pts) return pts;
  const free = view.belt ? view.belt.findIndex((b) => b === null) : -1;
  const dlg = view.ui?.dialog;
  // vendor round: spare gear (everything the bot would not wear) is sold so the bag never fills up, then upgrades are bought
  const spare = view.inventory.items.filter((i) => i.kind === "gear");
  if (!mem.sold) {
    if (dlg?.npc === "vendor" && view.vendor) {
      if (spare.length > BOT.sellAbove) return { t: "sell", id: spare[0].id };
      const buy = bestBuy(view, mem);
      if (buy && spare.length < BOT.sellAbove) return { t: "buy", index: buy.index, gear: true, id: buy.id };
      mem.sold = true;
      return { t: "closeDialog" };
    }
    if (spare.length > BOT.sellAbove || p.gold >= BOT.gearShopGold) {
      if (p.interact === "vendor" || p.next || p.path.length) return null;
      return { t: "interact", id: "vendor" };
    }
  }
  if (dlg?.npc === "potions" && view.vendor) {
    const potion = view.inventory.items.find((i) => i.kind === "potion" && i.restores === "hp");
    if (potion && free >= 0) return { t: "toBelt", id: potion.id, index: free };
    const best = view.vendor.stock.map((e, i) => ({ e, i })).filter(({ e }) => e.unlimited && e.item.restores === "hp" && e.price <= p.gold).sort((a, b) => b.e.item.restore - a.e.item.restore)[0];
    if (!mem.shopped && free >= 0 && best) return { t: "buy", index: best.i };
    mem.shopped = true;
    return { t: "closeDialog" };
  }
  if (!mem.shopped && free >= 0 && p.gold >= BOT.shopMinGold) {
    if (p.interact === "potions" || p.next || p.path.length) return null;
    return { t: "interact", id: "potions" };
  }
  if (p.stairs || p.next || p.path.length) return null;
  return { t: "useStairs", dir: "down" };
}

export function decide(view, mem) {
  if (view.scene === "dead") return mem.profile.respawn ? { t: "respawn" } : null;
  if (view.paused) return null;
  if (view.depth !== mem.depth) { // a new floor: forget the old floor's exploration state
    Object.assign(mem, { depth: view.depth, rooms: null, goal: null, skip: new Set(), waitSince: -1, shopped: false, sold: false, lootTries: {}, lootSkip: new Set(), lastKey: "", lastMoveTick: view.tick, beltFail: false, dodge: null });
  }
  if (view.scene === "town") return decideTown(view, mem);
  if (view.scene !== "floor") return null;
  const p = view.player, t = view.tick;
  mem.decisions++;
  if (!mem.rooms) mem.rooms = view.floor.rooms.map((r, i) => ({ i, x: r.x + (r.w >> 1), y: r.y + (r.h >> 1), done: false }));
  const key = `${p.tile.x},${p.tile.y}`;
  if (key !== mem.lastKey || p.action === "attack" || p.action === "cast" || p.next) { mem.lastKey = key; mem.lastMoveTick = t; } // progress = moving, swinging or casting
  const live = view.monsters.filter((m) => m.ai !== "dead");
  // watchdog (R6): a hero that keeps changing tile but gains no xp for a minute (a chaser that never arrives next to a sleeper it wants to hunt made it dither forever) writes the awake monsters off
  if (!mem.prog || mem.prog.xp !== p.xp || mem.prog.depth !== view.depth) mem.prog = { xp: p.xp, depth: view.depth, t };
  else if (view.depth < CORE.bossDepth && t - mem.prog.t > BOT.noProgressTicks) {
    const awake = live.filter((m) => m.ai !== "idle"); // own counters (CR6-05): `watchdogFired` = it really wrote off awake monsters that never arrived (parity report lists every one, the balance gate caps it, it must not hide a chase bug); `watchdogQuiet` = a minute without xp with nothing awake (exploring a cleared floor), reported only
    if (awake.length) { for (const m of awake) mem.skip.add(m.id); mem.waitSince = -1; mem.watchdogFired++; if (mem.watchdogLog.length < 20) mem.watchdogLog.push({ depth: view.depth, tick: t, awake: awake.map((m) => `${m.type}@${m.tile.x},${m.tile.y}:${m.ai}`).slice(0, 4), hero: `${p.tile.x},${p.tile.y}` }); }
    else mem.watchdogQuiet++;
    mem.prog.t = t;
  }
  const busy = !!(p.next || p.path.length || p.target || p.pickup);
  // potions: drink coffee from the belt when health is low
  if (view.belt && p.hp > 0 && p.hp < p.hpMax * (classOf(p).bot.potionHp ?? BOT.drinkBelow)) {
    const i = view.belt.findIndex((b) => b && b.restores === "hp");
    if (i >= 0) return { t: "useBelt", index: i };
  }
  if (view.belt && p.hp > 0 && classOf(p).role !== "melee" && p.mp < p.mpMax * 0.15 && live.some((m) => m.ai !== "idle")) { // casters and throwers drink water when dry
    const i = view.belt.findIndex((b) => b && b.restores === "mp");
    if (i >= 0) return { t: "useBelt", index: i };
  }
  if (!mem.profile.noDodge) { const d = dodge(view, mem, live); if (d) return d === HOLD ? null : d; }
  // keep the belt stocked from the bag (a free action): spare health potions picked up on the way go to empty belt slots
  if (view.belt && p.hp > 0 && !mem.beltFail) {
    const free = view.belt.findIndex((b) => b === null), spare = view.inventory.items.filter((i) => i.kind === "potion" && i.restores === "hp").sort((a, b) => b.restore - a.restore)[0];
    if (free >= 0 && spare) return { t: "toBelt", id: spare.id, index: free };
  }
  // a monster standing on the next tile of the path (asleep in a corridor, say) blocks the walk for good: kill it
  if (!p.next && p.path.length && live.length) {
    const b = live.find((m) => m.tile.x === p.path[0].x && m.tile.y === p.path[0].y);
    if (b && b.id !== p.target) return { t: "attack", id: b.id };
  }
  if (live.length === 0) {
    const c = spendPoints(view, mem) ?? upgrade(view, mem) ?? nextLoot(view, mem);
    if (c) return c.t === "pickup" && p.pickup === c.id ? null : c;
    if (busy) return null; // still walking to the last pile
    // before the boss arena: rest on the cleared floor until nearly healthy (natural regeneration), then go down
    if (view.depth === (mem.profile.depth ?? 1) - 1 && view.depth >= 8 && p.hp < p.hpMax * BOT.restBelow && (mem.restTicks = (mem.restTicks ?? 0) + BOT.decideEvery) < BOT.restMaxTicks) return null;
    if (view.depth < (mem.profile.depth ?? 1)) return p.stairs ? null : { t: "useStairs", dir: "down" }; // floor clear: on to the next one
    mem.done = true;
    return null;
  }
  const target = p.target ? live.find((m) => m.id === p.target) : null;
  const spend = spendPoints(view, mem);
  if (spend) return spend;
  const cast = castSkill(view, mem, live, target ?? nearest(live.filter((m) => m.ai !== "idle"), p.tile)?.m ?? null);
  if (cast) return cast;

  // stuck: an order is active but the hero has neither moved nor swung for a long time
  if (busy && t - mem.lastMoveTick > (target ? BOT.fightStuckTicks : BOT.stuckTicks) && !(target && cheb(target.tile, p.tile) <= 1)) {
    mem.stuck++; mem.lastMoveTick = t;
    if (mem.goal) { mem.goal.done = true; mem.goal = null; }
    if (target) mem.skip.add(target.id);
  }
  // rooms the hero has walked into are explored
  for (const r of mem.rooms) if (!r.done && cheb(r, p.tile) <= BOT.arriveRadius) r.done = true;
  if (mem.goal?.done) mem.goal = null;

  const kite = kiteMove(view, mem, live);
  if (kite) return kite;
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
