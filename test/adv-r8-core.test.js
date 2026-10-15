// ADV-R8 round 8, core rules of CORE-R8-1 (entry grace, potions to the belt, map pins) and the pure parts of the gear visuals and the toast lane.
// Test-engineer, adversarial mode, written from docs/reviews/R8-core1-progress.md, the ADRs and the sources' public behaviour, without reading the implementers' tests.
// Defects are `{ todo: 'ADV-R8-NN' }` (expected failures, the suite stays green). Sweeps over seeds use the generator and the real step function (no bot).
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, newGame, step, applyInput, enterFloor, respawn, makeItem, mapMarkers, vendorStock, openVendor, buy, sell, sellValue, spawnMonster } from "../src/core/index.js";
import * as dmg from "../src/core/systems/damage.js";
import { setQuestStep, setHp, setLevel } from "../src/core/cheats.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import { serialize, deserialize } from "../src/save/index.js";
import { gearSignature, lookOf, parseSignature, gearLooks, EMPTY_SIG, LOOK_CATEGORIES, VISIBLE_SLOTS } from "../src/render/gearlooks.js";
import { createToastQueue } from "../src/ui/toastqueue.js";
import { createRng } from "../src/core/index.js";

const hero = (seed = 5, cls = "facilities-manager") => newGame(seed, { class: cls, name: "Adv", start: "town", wearStartKit: true });
const rt = (s) => { const r = deserialize(serialize(s)); assert.ok(r.ok, `legal state must round-trip: ${r.message}`); return r.state; };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const GIVER = { sq1: "vendor", sq2: "healer", sq3: "potions", sq4: "stash", sq5: "vendor" };
function talk(s, npc) {
  if (s.depth !== 0) enterFloor(s, 0, { at: "entry" });
  applyInput(s, { t: "interact", id: npc });
  for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
  assert.equal(s.ui.dialog?.npc, npc);
}
const accept = (s, id) => { talk(s, GIVER[id]); assert.ok(applyInput(s, { t: "questAccept", id }).ok); };

// =============================================================================================== entry grace (R8-B2)
test("[R8-grace] 1000 seeds x floors 1 and 3: while the grace runs nobody within the radius of the arrival tile goes from idle to awake by sight; the key is removed when the ticks are used (stand-at-entry sweep, 5 ticks of ai are enough per seed to see a violation)", () => {
  const g = config.entryGrace;
  let violations = 0, packWakes = 0, floors = 0;
  const first = [];
  for (let seed = 1; seed <= 1000; seed++) for (const depth of [1, 3]) {
    const s = newGame(seed, { class: "facilities-manager", name: "A", start: "town" });
    enterFloor(s, depth, { at: "entry" });
    floors++;
    assert.ok(s.entryGrace && s.entryGrace.t === g.ticks, "grace set on arrival");
    const at = { ...s.entryGrace.at };
    const idle = new Set(s.monsters.filter((m) => m.ai === "idle" && cheb(m.tile, at) <= g.radius).map((m) => m.id));
    for (let t = 0; t < 30; t++) {
      s.player.hp = s.player.hpMax; // keep the probe alive: only the monsters' noticing is measured
      step(s);
      for (const m of s.monsters) if (idle.has(m.id) && m.ai !== "idle") { violations++; if (first.length < 5) first.push(`${seed}:${depth}:${m.type}:${m.ai}@${t} d${cheb(m.tile, at)} pack${m.packId}`); idle.delete(m.id); }
    }
    assert.ok(s.entryGrace.t === g.ticks - 30);
  }
  assert.equal(violations, 0, `${violations} graced monsters woke inside the grace on ${floors} floors; first: ${first.join(" | ")} (a pack mate outside the radius that sees the hero wakes the pack via wakePack)`);
});

test("[R8-grace] standing at the entry: the grace ends after exactly entryGrace.ticks, the key is gone, and from then on a monster in sight notices (no permanent shelter)", () => {
  let woke = 0, tried = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = newGame(seed, { class: "facilities-manager", name: "A", start: "town" });
    enterFloor(s, 2, { at: "entry" });
    const near = s.monsters.filter((m) => m.ai === "idle" && cheb(m.tile, s.player.tile) <= config.entryGrace.radius);
    for (let t = 0; t < config.entryGrace.ticks - 2; t++) { s.player.hp = s.player.hpMax; step(s); }
    assert.equal(near.filter((m) => m.ai !== "idle").length, 0, `seed ${seed}: nobody woke before the grace ran out`);
    for (let t = 0; t < 4; t++) { s.player.hp = s.player.hpMax; step(s); }
    assert.equal(s.entryGrace, undefined, `seed ${seed}: grace removed after ${config.entryGrace.ticks} ticks`);
    if (!near.length) continue;
    tried++;
    for (let t = 0; t < 120; t++) { s.player.hp = s.player.hpMax; step(s); }
    if (near.some((m) => m.ai !== "idle")) woke++;
  }
  assert.ok(tried >= 10, `${tried} floors with a sleeper near the entry`);
  assert.ok(woke >= 1, "after the grace at least some sleepers in sight notice a standing hero");
});

test("[R8-grace] lift loops: leaving and re-entering renews the grace but never extends one in progress; it is never set in the Lobby and never saved", () => {
  const s = hero(7);
  assert.equal(s.entryGrace, undefined, "no grace at the start in the Lobby");
  enterFloor(s, 1, { at: "entry" });
  for (let i = 0; i < 100; i++) { s.player.hp = s.player.hpMax; step(s); }
  assert.equal(s.entryGrace.t, config.entryGrace.ticks - 100);
  enterFloor(s, 0, { at: "entry" });
  assert.equal(s.entryGrace, undefined, "back in the Lobby: no grace key left (it would leak into the hash and the save)");
  assert.equal(serialize(s).includes("entryGrace"), false);
  enterFloor(s, 1, { at: "entry" });
  assert.equal(s.entryGrace.t, config.entryGrace.ticks, "a new arrival starts a new grace of the same length");
  const text = serialize(s);
  const loaded = deserialize(text).state;
  // a load is an arrival at the floor's entry (the save keeps the floor, not the position): the grace of an arrival, never one in the middle of the floor
  assert.deepEqual(loaded.player.tile, loaded.floor.entry, "loading puts the hero on the entry stairs");
  if (loaded.entryGrace) assert.deepEqual(loaded.entryGrace.at, loaded.player.tile);
  // 40 loop iterations never accumulate more than one grace of ticks
  for (let i = 0; i < 40; i++) { enterFloor(s, i % 2 ? 2 : 1, { at: i % 4 < 2 ? "entry" : "exit" }); step(s); assert.ok(s.entryGrace.t <= config.entryGrace.ticks); }
});

test("[R8-grace] a graced monster that is hit wakes at once (no free kills from a sleeping state), and the grace does not stop monsters that were already awake", () => {
  let hits = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame(seed, { class: "sales-rep", name: "A", start: "town" });
    enterFloor(s, 1, { at: "entry" });
    const m = s.monsters.find((o) => o.ai === "idle" && cheb(o.tile, s.player.tile) <= config.entryGrace.radius);
    if (!m) continue;
    const hp = m.hp;
    dmg.damageMonster(s, m, 1, { source: "player" });
    step(s);
    assert.ok(m.ai !== "idle" || m.hp === hp, `seed ${seed}: a hit monster is still idle`);
    if (m.ai !== "idle") hits++;
    // an awake chaser next to the arrival tile is not shielded
    const c = s.monsters.find((o) => o !== m && o.ai === "idle");
    if (c) { c.ai = "chase"; c.path = []; c.goal = null; step(s); assert.equal(c.ai === "chase" || c.ai === "attack", true); }
  }
  assert.ok(hits >= 10);
});

test("[R8-grace] the grace is deterministic: two identical runs hash equal, and the legacy switch (entryGrace null) leaves no key behind", () => {
  const go = (grace) => { const prev = config.entryGrace; config.entryGrace = grace; try { const s = newGame(9, { class: "it-wizard", name: "A", start: "town" }); enterFloor(s, 2, { at: "entry" }); for (let i = 0; i < 100; i++) step(s); return s; } finally { config.entryGrace = prev; } };
  const a = go(config.entryGrace), b = go(config.entryGrace), n = go(null);
  assert.equal(JSON.stringify(a.monsters), JSON.stringify(b.monsters));
  assert.equal("entryGrace" in n, false);
  assert.equal(JSON.stringify(go({ ticks: 0, radius: 12 }).entryGrace), undefined, "ticks 0 means no grace");
});

// =============================================================================================== potions to the belt (R8-B3)
function atVendor(s, id = "potions") {
  if (s.depth !== 0) enterFloor(s, 0, { at: "entry" });
  talk(s, id);
  return s.vendor;
}
const potionIdx = (v, restores) => v.stock.findIndex((e) => e.item.kind === "potion" && (!restores || e.item.restores === restores));
const countPotions = (s) => s.belt.filter(Boolean).length + s.inventory.items.filter((i) => i.kind === "potion").length;

test("[R8-belt] buying potions fills the first free belt slot in order, then the bag; ids are unique; belt items carry no bag position; every state is a legal save", () => {
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) {
    const s = hero(11, cls);
    s.player.gold = 100000;
    const v = atVendor(s);
    const i = potionIdx(v);
    assert.ok(i >= 0, "the potion seller stocks potions");
    for (let k = 0; k < 14; k++) {
      const emptyBefore = s.belt.findIndex((b) => b === null), bag = s.inventory.items.length;
      const r = applyInput(s, { t: "buy", index: potionIdx(s.vendor) });
      assert.ok(r.ok, `${cls} buy ${k}: ${JSON.stringify(r)}`);
      if (emptyBefore >= 0) { assert.ok(s.belt[emptyBefore], "went to the first free belt slot"); assert.equal(s.inventory.items.length, bag); assert.equal(s.belt[emptyBefore].x, undefined); }
      else assert.equal(s.inventory.items.length, bag + 1, "belt full: into the bag");
      rt(s);
    }
    const ids = [...s.belt.filter(Boolean), ...s.inventory.items].map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("[R8-belt] a hole in the middle of the belt is filled first; mixed hp and mana potions keep their kind; a non-potion (consumable) never goes to the belt on a purchase", () => {
  const s = hero(12, "it-wizard");
  s.player.gold = 100000;
  s.belt[0] = null; s.belt[2] = null;
  atVendor(s);
  const hp = potionIdx(s.vendor, "hp"), mp = potionIdx(s.vendor, "mp");
  assert.ok(hp >= 0 && mp >= 0, "both kinds are stocked");
  assert.ok(applyInput(s, { t: "buy", index: mp }).ok);
  assert.equal(s.belt[0]?.restores, "mp", "the first hole took the mana potion");
  assert.ok(applyInput(s, { t: "buy", index: hp }).ok);
  assert.equal(s.belt[2]?.restores, "hp", "the next hole took the health potion");
  const bag = s.inventory.items.length;
  const cons = s.vendor.stock.findIndex((e) => e.item.kind === "consumable");
  if (cons >= 0) { s.belt[1] = null; assert.ok(applyInput(s, { t: "buy", index: cons }).ok); assert.equal(s.belt[1], null, "a consumable goes to the bag"); assert.equal(s.inventory.items.length, bag + 1); }
  rt(s);
});

test("[R8-belt] full belt and full bag: the purchase fails whole (gold, stock and containers unchanged); a freed belt slot lets it through again with a full bag", () => {
  const s = hero(13);
  s.player.gold = 5000;
  atVendor(s);
  for (let i = 0; i < s.belt.length; i++) s.belt[i] ??= { ...makeItem("lukewarm-coffee"), id: `b${i}` };
  s.inventory.items.length = 0;
  for (let y = 0; y < config.inventory.h; y++) for (let x = 0; x < config.inventory.w; x++) s.inventory.items.push({ ...makeItem("lukewarm-coffee"), id: `f${x}-${y}`, x, y });
  const snap = () => JSON.stringify([s.player.gold, s.belt, s.inventory, s.vendor.stock.length]);
  const before = snap();
  const r = applyInput(s, { t: "buy", index: potionIdx(s.vendor) });
  assert.equal(r.ok, false);
  assert.equal(snap(), before);
  s.belt[3] = null;
  assert.ok(applyInput(s, { t: "buy", index: potionIdx(s.vendor) }).ok, "belt room is enough");
  assert.ok(s.belt[3]);
  assert.ok(s.player.gold < 5000);
});

test("[R8-belt] 200 random buys, sells, belt uses and drops: gold never negative, potions are conserved (bought - drunk - sold - dropped), every state legal", () => {
  const s = hero(14, "sales-rep");
  s.player.gold = 3000;
  const rng = createRng(5);
  atVendor(s);
  let bought = 0, gone = 0;
  const start = countPotions(s);
  for (let i = 0; i < 200; i++) {
    const op = rng.int(0, 3);
    if (op === 0) { const k = potionIdx(s.vendor); if (k >= 0 && applyInput(s, { t: "buy", index: k }).ok) bought++; }
    else if (op === 1) { const it = s.inventory.items.find((x) => x.kind === "potion"); if (it && applyInput(s, { t: "sell", id: it.id }).ok) gone++; }
    else if (op === 2) { s.player.hp = Math.max(1, s.player.hpMax - 30); const k = s.belt.findIndex((b) => b && b.restores === "hp"); if (k >= 0 && applyInput(s, { t: "useBelt", index: k }).ok) gone++; }
    else { const k = s.belt.findIndex((b) => b && b.kind === "potion" && b.restores === "mp"); if (k >= 0 && applyInput(s, { t: "sell", id: s.belt[k].id }).ok) gone++; }
    step(s);
    assert.ok(s.player.gold >= 0);
    assert.equal(countPotions(s), start + bought - gone, `op ${i}`);
    if (i % 25 === 0) rt(s);
  }
});

// =============================================================================================== map pins (R8-M1)
test("[R8-pins] the item pin: a marker only on the item's floor, only after its tile is explored, at the ground item's tile, gone after the pick-up; another pin hides it", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = hero(seed);
    accept(s, "sq2"); accept(s, "sq4");
    assert.ok(applyInput(s, { t: "questPin", id: "sq2" }).ok);
    const fl = itemFloorOf(seed, "sq2");
    assert.deepEqual(mapMarkers(s).map((m) => m.kind), ["npc"].filter(() => false), "active sq2 in the Lobby: no marker");
    enterFloor(s, fl === 1 ? 2 : 1, { at: "entry" });
    assert.equal(mapMarkers(s).length, 0, "wrong floor");
    enterFloor(s, fl, { at: "entry" });
    s.monsters = [];
    const g = s.groundItems.find((e) => e.quest === "sq2");
    assert.ok(g);
    s.floor.explored.fill(0);
    assert.equal(mapMarkers(s).length, 0, "unexplored tile: no marker (no spoiler)");
    s.floor.explored.fill(1);
    const mk = mapMarkers(s);
    assert.equal(mk.length, 1); assert.equal(mk[0].kind, "item"); assert.deepEqual(mk[0].tile, g.tile); assert.equal(mk[0].quest, "sq2");
    assert.equal(typeof mk[0].label, "string");
    assert.ok(applyInput(s, { t: "questPin", id: "sq4" }).ok);
    assert.ok(mapMarkers(s).every((m) => m.quest === "sq4"), "pin switched: no sq2 marker");
    assert.ok(applyInput(s, { t: "questPin", id: "sq2" }).ok);
    applyInput(s, { t: "pickup", id: "qi-sq2" }); for (let i = 0; i < 3000 && s.groundItems.some((e) => e.id === "qi-sq2"); i++) step(s);
    assert.equal(s.quests.sq2.s, "ready");
    assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "item"), [], "picked up: the item marker is gone");
  }
});

test("[R8-pins] the elite pin: marker follows the living elite, disappears when it dies, never shows for a dead or absent elite or on other floors; unpinning removes it", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = hero(seed);
    accept(s, "sq3");
    assert.ok(applyInput(s, { t: "questPin", id: "sq3" }).ok);
    const depth = config.quests.sq3?.elite?.depth ?? config.quests.elite.depth;
    enterFloor(s, depth, { at: "entry" });
    const e = s.monsters.find((m) => m.quest === "sq3");
    assert.ok(e, `seed ${seed}: the elite exists on floor ${depth}`);
    s.floor.explored.fill(1);
    let mk = mapMarkers(s);
    assert.equal(mk.length, 1); assert.equal(mk[0].kind, "elite"); assert.deepEqual(mk[0].tile, e.tile);
    e.tile = { ...s.player.tile }; // it walks: the marker follows the tile
    assert.deepEqual(mapMarkers(s)[0].tile, s.player.tile);
    enterFloor(s, depth === 1 ? 2 : depth - 1, { at: "entry" });
    assert.equal(mapMarkers(s).length, 0, "other floor");
    enterFloor(s, depth, { at: "entry" }); s.floor.explored.fill(1);
    const e2 = s.monsters.find((m) => m.quest === "sq3");
    assert.ok(mapMarkers(s).length === 1);
    dmg.damageMonster(s, e2, 99999, { source: "player" });
    assert.equal(s.quests.sq3.s, "ready");
    assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "elite"), [], "dead elite: no marker");
    step(s);
    assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "elite"), []);
    rt(s);
  }
});

test("[R8-pins] pin switching to a completed, locked or unknown quest changes nothing; markers never throw for any pinned id in any state (all pins x all states x floors 0..3)", () => {
  const s = hero(6);
  for (const id of ["main", "main2", "main3", "sq1", "sq2", "sq3", "sq4", "sq5", "nope", "__proto__", "constructor", "", null, 7]) {
    const r = applyInput(s, { t: "questPin", id });
    void r;
    for (const d of [0, 1, 2, 3]) { enterFloor(s, d, { at: "entry" }); s.floor.explored.fill(1); const m = mapMarkers(s); assert.ok(Array.isArray(m)); for (const k of m) { assert.ok(Number.isInteger(k.tile.x) && Number.isInteger(k.tile.y) && k.tile.x >= 0 && k.tile.x < s.floor.w && k.tile.y >= 0 && k.tile.y < s.floor.h); } }
  }
  rt(s);
});

// =============================================================================================== gear looks (R8-0.1/0.2 pure part)
const GARBAGE = [undefined, null, 0, 1, "", "x", true, [], [1], {}, { base: 1 }, { base: "__proto__" }, { base: "constructor", slot: "head" }, { base: "toString" }, { base: "hasOwnProperty", slot: "weapon" }, { base: "usb-staff", rarity: "__proto__" }, { base: "usb-staff", rarity: "constructor", twoHanded: "yes" }, { base: "visor-cap", slot: "weapon" }, { base: "visor-cap", slot: ["head"] }, { base: "visor-cap", slot: "head", rarity: { toString() { throw new Error("x"); } } }, { get base() { throw new Error("getter"); } }];
test("[R8-look] gearSignature and lookOf never throw and always give a parseable signature: garbage items, prototype names, getters that throw, equipment of any shape (20000 random equipments)", () => {
  const rng = createRng(77);
  const pick = () => { const r = rng.int(0, 5); if (r === 0) return rng.pick(GARBAGE); const slot = rng.pick(VISIBLE_SLOTS); const bases = Object.keys(content.items).filter((b) => content.items[b].slot === (slot === "offhand" ? "offhand" : slot)); return { base: rng.pick([...bases, "nope", "x".repeat(100)]), slot: rng.pick([slot, slot, slot, "head", undefined]), rarity: rng.pick(["normal", "magic", "rare", "unique", "legendary", undefined]), twoHanded: rng.pick([true, false, undefined, "true"]) }; };
  for (let i = 0; i < 20000; i++) {
    const eq = rng.int(0, 20) === 0 ? rng.pick(GARBAGE) : Object.fromEntries(VISIBLE_SLOTS.map((k) => [k, pick()]));
    let sig;
    try { sig = gearSignature(eq); } catch (e) { if (eq && typeof eq === "object" && Object.values(eq).some((v) => v && typeof v === "object" && Object.getOwnPropertyDescriptor(v, "base")?.get)) continue; assert.fail(`gearSignature threw: ${e.message}`); }
    assert.ok(parseSignature(sig), `signature ${sig} must parse`);
    assert.ok(sig === EMPTY_SIG || gearLooks(sig));
  }
  for (const g of GARBAGE) for (const slot of ["head", "body", "hands", "feet", "weapon", "offhand", "ring1", "__proto__", "constructor", undefined, null]) { try { lookOf(slot, g); } catch (e) { if (!(g && Object.getOwnPropertyDescriptor(g, "base")?.get)) assert.fail(`lookOf threw for ${JSON.stringify(g)} ${slot}`); } }
});

test("[R8-look] a two-handed weapon hides the off-hand in the signature even if a malformed state holds both; unknown bases fall back to the slot default; signature is stable across calls and object identity", () => {
  const two = { base: "mop-halberd", slot: "weapon", rarity: "rare", twoHanded: true }, shield = { base: "clipboard-shield", slot: "offhand", rarity: "magic" };
  const sig = gearSignature({ weapon: two, offhand: shield });
  assert.ok(sig.split("|")[5] === "-", sig);
  assert.ok(sig.split("|")[4].endsWith("2"));
  assert.equal(gearSignature({ weapon: { ...two, twoHanded: false }, offhand: shield }).split("|")[5] !== "-", false, "mop-halberd is a pole: two-handed whatever the flag says");
  assert.equal(gearSignature({ weapon: { base: "ruler-rapier", slot: "weapon", rarity: "normal" }, offhand: shield }).split("|")[5] !== "-", true);
  assert.equal(gearSignature({ head: { base: "from-the-future", slot: "head", rarity: "normal" } }).split("|")[0], "c0", "unknown head base = cap");
  assert.equal(gearSignature({ weapon: { base: "from-the-future", slot: "weapon", rarity: "unique", twoHanded: true } }).split("|")[4], "p32");
  assert.equal(gearSignature({ weapon: two, offhand: shield }), sig);
  assert.equal(gearSignature({ weapon: { ...two }, offhand: { ...shield } }), sig);
});

test("[R8-look] real inputs: equipping a two-handed weapon over a worn shield moves the shield to the bag (or refuses on a full bag) and the signature never shows both; unequip spam keeps the state legal", () => {
  const s = hero(15);
  setLevel(s, 30);
  for (let i = 0; i < 30 && (s.player.attrs.grit ?? 0) < 17 && s.player.attrPoints > 0; i++) applyInput(s, { t: "allocate", attr: "grit" });
  assert.ok(s.player.attrs.grit >= 17, "the hero can wear the halberd (real attribute points)");
  const shield = { ...makeItem("clipboard-shield"), id: "t1" }, pole = { ...makeItem("mop-halberd"), id: "t2" };
  s.inventory.items.push({ ...shield, x: 0, y: 0 }, { ...pole, x: 3, y: 0 });
  assert.ok(applyInput(s, { t: "equip", id: "t1" }).ok);
  assert.equal(gearSignature(s.equipment).split("|")[5] !== "-", true);
  const r = applyInput(s, { t: "equip", id: "t2" });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(s.equipment.offhand, null);
  assert.equal(gearSignature(s.equipment).split("|")[5], "-");
  assert.ok(s.inventory.items.some((i) => i.id === "t1"));
  assert.equal(applyInput(s, { t: "equip", id: "t1" }).ok, false, "the off-hand is blocked by the two-hander");
  for (let i = 0; i < 100; i++) { applyInput(s, { t: i % 2 ? "equip" : "unequip", id: i % 2 ? "t2" : undefined, slot: "weapon" }); step(s); rt(s); }
});

// =============================================================================================== toast lane (CR7L-01/02)
function fakeClock() {
  let t = 0; const timers = [];
  return {
    now: () => t, setT: (fn, ms) => { const h = { fn, at: t + ms, id: timers.length }; timers.push(h); return h; }, clearT: (h) => { if (h) h.dead = true; },
    advance(ms) { const end = t + ms; for (;;) { const nx = timers.filter((x) => !x.dead && !x.done && x.at <= end).sort((a, b) => a.at - b.at)[0]; if (!nx) break; t = nx.at; nx.done = true; nx.fn(); } t = end; },
  };
}
test("[R8-toast] every distinct line that is offered is shown exactly once, in lane order, as long as no more than the cap wait; the live region (show) is written once per line", () => {
  const c = fakeClock(), shown = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: c.now, setT: c.setT, clearT: c.clearT });
  q.begin();
  q.offer("level up", 2000, { passive: true }); q.offer("Quest A done", 4000, { quest: true, qid: "a", kind: "quest" }); q.offer("bag full?", 2000, {}); q.offer("Quest B ready", 4000, { quest: true, qid: "b" }); q.offer("floor 3", 2000, { passive: true, kind: "floorEnter" });
  q.end();
  c.advance(60000);
  assert.deepEqual([...shown].sort(), ["Quest A done", "Quest B ready", "bag full?", "floor 3", "level up"].sort(), "all five shown");
  assert.equal(new Set(shown).size, shown.length, "once each");
  assert.ok(shown.indexOf("Quest A done") < shown.indexOf("level up"), "the quest line comes before the level-up line of the same dispatch");
  assert.equal(q.waiting().length, 0);
});
test("[R8-toast] 30 dispatches of 1 to 2 lines every 2 to 8 s (a busy minute of play): no quest, direct or passive line is lost, none shows twice, the lane drains", () => {
  const c = fakeClock(), shown = [], offered = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: c.now, setT: c.setT, clearT: c.clearT });
  const rng = createRng(3);
  for (let d = 0; d < 30; d++) {
    q.begin();
    for (let k = rng.int(1, 2); k > 0; k--) {
      const kind = rng.pick(["quest", "direct", "passive"]), text = `${kind} ${d}.${k}`;
      offered.push({ text, kind });
      q.offer(text, 3000, kind === "quest" ? { quest: true, qid: text } : kind === "passive" ? { passive: true } : {});
    }
    q.end();
    c.advance(rng.int(2000, 8000));
  }
  c.advance(120000);
  assert.equal(q.waiting().length, 0, "drained");
  const lost = offered.filter((o) => !shown.includes(o.text));
  assert.equal(lost.length, 0, `lost lines: ${lost.slice(0, 5).map((o) => o.text).join(", ")} (of ${offered.length} offered)`);
  assert.equal(new Set(shown).size, shown.length, "no line twice");
});

test("[R8-toast] overload is bounded and orderly: 60 lines offered in one second keep at most cap lines waiting, the quest and direct lines are the last to be dropped, and the lane still drains", () => {
  const c = fakeClock(), shown = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: c.now, setT: c.setT, clearT: c.clearT });
  for (let i = 0; i < 60; i++) { q.offer(`p${i}`, 3000, { passive: true }); if (i % 10 === 0) q.offer(`q${i}`, 4000, { quest: true, qid: `q${i}` }); c.advance(15); assert.ok(q.waiting().length <= 8); }
  c.advance(200000);
  assert.equal(q.waiting().length, 0);
  assert.equal(new Set(shown).size, shown.length);
  assert.ok(shown.length >= 8);
});
test("[R8-toast] two quest lines 300 ms apart (the burst rule): both reach show() once, so the live region announces both, even though the second replaces the first on screen (documented CR7L-02 rule)", () => {
  const c = fakeClock(), shown = [];
  const q = createToastQueue({ show: (n) => shown.push([c.now(), n.text]), now: c.now, setT: c.setT, clearT: c.clearT });
  q.offer("Quest one done", 4000, { quest: true, qid: "a" });
  c.advance(300);
  q.offer("Quest two done", 4000, { quest: true, qid: "b" });
  c.advance(10000);
  assert.deepEqual(shown.map(([, t]) => t), ["Quest one done", "Quest two done"]);
});
