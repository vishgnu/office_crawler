// S2 fix round: map data, Emergency Exit, locked floor 8, stash rules, fists, caps, affix tiers, vendor refresh, ground cap, nits.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  config, content, newGame, step, applyInput, teleportFloor, hashState, exploredAt, enterFloor, makeItem, mint, autoplace, createRng,
  rollAffixes, deriveStats, dropItem, dropGold, spawnItem, sellValue, setLevel, learnSkill, cloneState,
} from "../src/core/index.js";
import { killMonster } from "../src/core/systems/damage.js";
import { gameOn, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const until = (s, f, max = 4000) => { for (let i = 0; i < max && !f(); i++) step(s); return f(); };
const give = (s, base, opts) => { const it = mint(s, makeItem(base, opts)); assert.ok(autoplace(s.inventory, it)); return it; };
const lobby = (seed = 3) => newGame({ seed, start: "town" });
const types = (s) => s.events.map((e) => e.type);

// ---- map (R-075) ----
test("AC-R-075-1 floor.explored is a 0/1 array of w*h: only the light radius at first, a strict superset after walking", () => {
  const s = newGame(5); s.monsters.length = 0;
  const f = s.floor, e = f.explored;
  assert.equal(e.length, f.w * f.h);
  assert.ok(e.every((v) => v === 0 || v === 1));
  const r = config.exploreRadius, p = s.player.tile;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const near = (x - p.x) ** 2 + (y - p.y) ** 2 <= r * r;
    assert.equal(exploredAt(s, x, y), near, `tile ${x},${y}`);
  }
  const before = [...e], n0 = before.reduce((a, b) => a + b, 0);
  const far = f.rooms.map((rm) => ({ x: rm.x + (rm.w >> 1), y: rm.y + (rm.h >> 1) })).sort((a, b) => Math.abs(b.x - p.x) + Math.abs(b.y - p.y) - Math.abs(a.x - p.x) - Math.abs(a.y - p.y))[0];
  cmd(s, { t: "moveTo", tile: far });
  until(s, () => Math.max(Math.abs(s.player.tile.x - p.x), Math.abs(s.player.tile.y - p.y)) >= 10, 3000);
  assert.ok(f.explored.every((v, i) => v >= before[i]));
  assert.ok(f.explored.reduce((a, b) => a + b, 0) > n0);
  assert.equal(exploredAt(s, -1, 0), false);
});

test("explored tiles persist when a floor is left and re-entered, and survive a JSON round trip; the Lobby is explored from the start", () => {
  const s = newGame(5); s.monsters.length = 0;
  teleportFloor(s, 2); step(s);
  const seen = s.floor.explored.reduce((a, b) => a + b, 0);
  assert.ok(seen > 0);
  assert.equal(s.floors[2].explored, s.floor.explored);
  teleportFloor(s, 3); teleportFloor(s, 2);
  assert.equal(s.floor.explored.reduce((a, b) => a + b, 0), seen);
  const t = JSON.parse(JSON.stringify(s));
  assert.deepEqual(t.floor.explored, s.floor.explored);
  const l = lobby();
  assert.ok(l.floor.explored.every((v) => v === 1));
  assert.equal(exploredAt(l, 8, 3), true);
});

// ---- Emergency Exit (R-046) ----
test("AC-R-046-1/-2 Emergency Exit: used on floor 3 it moves the hero to the Lobby; the Lobby door leads back to the same tile, killed monsters stay dead", () => {
  const s = newGame(7); teleportFloor(s, 3);
  const ex = give(s, "emergency-exit");
  const victim = s.monsters.find((m) => m.spawn !== undefined);
  killMonster(s, victim); s.monsters = s.monsters.filter((m) => m !== victim);
  const tile = { ...s.player.tile }, seed = s.floor.seed;
  assert.equal(cmd(s, { t: "useItem", id: ex.id }).ok, true);
  assert.equal(s.depth, 0); assert.equal(s.scene, "town");
  assert.equal(s.inventory.items.some((i) => i.base === "emergency-exit"), false);
  assert.deepEqual(s.portal, { depth: 3, tile, lobbyTile: config.portal.lobbyTile });
  assert.ok(types(s).includes("portalOpen"));
  // the door in the Lobby: click it, walk, step through
  assert.equal(cmd(s, { t: "click", tile: s.portal.lobbyTile }).ok, true);
  assert.ok(until(s, () => s.depth === 3));
  assert.equal(s.floor.seed, seed);
  assert.deepEqual(s.player.tile, tile);
  assert.equal(s.portal, null);
  assert.ok(s.eventLog.some((e) => e.type === "portalUse"));
  assert.equal(s.monsters.some((m) => m.spawn === victim.spawn), false); // still cleared
  assert.ok(s.monsters.length > 0);
});

test("AC-R-046-3 using a missing item id fails and changes nothing; in the Lobby the item is not consumed", () => {
  const s = newGame(7); teleportFloor(s, 2);
  const before = hashState(s);
  assert.equal(cmd(s, { t: "useItem", id: "i9999" }).ok, false);
  assert.equal(hashState(s), before);
  const ex = give(s, "emergency-exit");
  enterFloor(s, 0);
  assert.equal(cmd(s, { t: "useItem", id: ex.id }).ok, false);
  assert.ok(s.inventory.items.includes(ex)); assert.equal(s.portal, null);
});

test("Emergency Exit can sit on the belt and be used from there; one door at a time; vendors sell it", () => {
  const s = newGame(7); teleportFloor(s, 4); s.monsters.length = 0;
  const ex = give(s, "emergency-exit");
  assert.equal(cmd(s, { t: "toBelt", id: ex.id }).ok, true);
  assert.equal(s.belt.some((b) => b?.id === ex.id), true);
  assert.equal(cmd(s, { t: "useItem", id: ex.id }).ok, true);
  assert.equal(s.belt.some((b) => b?.id === ex.id), false);
  assert.equal(s.portal.depth, 4);
  const l = lobby(); l.player.tile = { x: 4, y: 6 };
  assert.equal(cmd(l, { t: "openVendor" }).ok, true);
  const e = l.vendor.stock.find((x) => x.item.base === "emergency-exit");
  assert.ok(e && e.unlimited && e.price > 0);
  l.player.gold = e.price;
  assert.equal(cmd(l, { t: "buy", index: l.vendor.stock.indexOf(e) }).ok, true);
  assert.equal(l.inventory.items.filter((i) => i.base === "emergency-exit").length, 1);
});

test("potions can be drunk with useItem from the inventory", () => {
  const s = gameOn(OPEN); s.player.hp = 5;
  const p = give(s, "lukewarm-coffee");
  assert.equal(cmd(s, { t: "useItem", id: p.id }).ok, true);
  assert.equal(s.player.hp, 5 + p.restore);
  assert.equal(s.inventory.items.includes(p), false);
});

// ---- floor 8 (AC-R-043-2 as amended) ----
test("AC-R-043-2 floor 8 keeps a locked stairs-down tile: it is in the snapshot, taking it fails with stairsLocked, floor 10 does not exist (S3: the arena, depth 9, opens when floor 8 is cleared)", () => {
  const s = newGame(3); teleportFloor(s, config.maxDepth); s.monsters.length = 0;
  assert.ok(s.floor.exit, "the stairs tile exists");
  assert.equal(s.floor.tiles[s.floor.exit.y * s.floor.w + s.floor.exit.x], 5);
  assert.equal(s.floor.bossStairs, true);
  assert.equal(cmd(s, { t: "click", tile: s.floor.exit }).ok, false);
  assert.ok(types(s).includes("stairsLocked"));
  until(s, () => false, 600);
  assert.equal(s.depth, config.maxDepth);
  assert.equal(teleportFloor(s, 10).ok, false);
});

// ---- stash (R-059) ----
test("stash needs the Lobby, the stash dialog and the NPC within reach; a failed move leaves the item in its original cell", () => {
  const s = newGame(2);
  const it = give(s, "blazer");
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "stash" }).ok, false); // on a floor
  enterFloor(s, 0);
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "stash" }).ok, false); // no dialog
  s.player.tile = { x: 24, y: 9 };
  assert.equal(cmd(s, { t: "interact", id: "stash" }).ok, true);
  s.player.tile = { x: 8, y: 9 }; // walked away without the dialog closing yet (raw state edit)
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "stash" }).ok, false);
  assert.equal(s.stash.items.length, 0); assert.ok(s.inventory.items.includes(it));
  s.player.tile = { x: 24, y: 9 };
  // fill the stash so the move fails, and put the item away from the first free cell
  const spot = { x: it.x, y: it.y };
  s.stash.items.length = 0;
  for (let i = 0; i < 80; i++) autoplace(s.stash, mint(s, makeItem("paperclip-ring")));
  const other = give(s, "paperclip-ring"); // takes the first free cell next to the blazer
  const r = cmd(s, { t: "stash", id: it.id, to: "stash" });
  assert.equal(r.ok, false);
  assert.deepEqual({ x: it.x, y: it.y }, spot);
  assert.ok(s.inventory.items.includes(it) && s.inventory.items.includes(other));
  // and a real move works
  s.stash.items.length = 0;
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "stash" }).ok, true);
  assert.ok(s.stash.items.includes(it));
});

// ---- character ----
test("fists do not add to a worn weapon: unarmed range only without a weapon", () => {
  const p = { level: 1, attrs: { grit: config.derived.gritFree, agility: 1, stamina: 1, focus: 1 }, skills: {} };
  const bare = deriveStats(p, {}).damage, w = makeItem("letter-opener");
  const armed = deriveStats(p, { weapon: w }).damage;
  assert.deepEqual(armed, { min: w.damage.min, max: w.damage.max });
  assert.deepEqual(bare, { ...config.unarmed });
  // a flat damage affix on a non-weapon does not count as a weapon
  const ring = { ...makeItem("paperclip-ring"), affixes: [{ stat: "damage", value: 2 }] };
  assert.deepEqual(deriveStats(p, { ring1: ring }).damage, { min: config.unarmed.min + 2, max: config.unarmed.max + 2 });
});

test("resistances, defense and attack rating are capped (config.caps)", () => {
  const p = { level: 1, attrs: { grit: 10, agility: 10, stamina: 10, focus: 10 }, skills: {} };
  const big = { ...makeItem("blazer"), defense: 9999, affixes: [{ stat: "resist.fire", value: 500 }, { stat: "attackRating", value: 9999 }] };
  const s = deriveStats(p, { body: big });
  assert.equal(s.resist.fire, config.caps.resist);
  assert.equal(s.defense, config.caps.defense);
  assert.equal(s.attackRating, config.caps.attackRating);
});

// ---- affix tiers ----
test("affix tiers are level-weighted: at a high item level the top tier is the most common, not one in four", () => {
  const rng = createRng(11), count = {};
  for (let i = 0; i < 4000; i++) for (const a of rollAffixes(rng, "weapon", 30, 1)) count[a.tier] = (count[a.tier] ?? 0) + 1;
  assert.ok(count[4] > count[3] && count[3] > count[2] && count[2] > count[1], JSON.stringify(count));
  const low = {};
  for (let i = 0; i < 2000; i++) for (const a of rollAffixes(rng, "weapon", 3, 1)) low[a.tier] = (low[a.tier] ?? 0) + 1;
  assert.deepEqual(Object.keys(low), ["1"]);
});

// ---- vendor refresh ----
test("vendor stock is rolled once per Lobby visit: reopening keeps it (purchases stay gone), a trip downstairs re-rolls it", () => {
  const s = lobby(4); s.player.tile = { x: 4, y: 6 }; s.player.gold = 5000;
  cmd(s, { t: "openVendor" });
  const gear = s.vendor.stock.findIndex((e) => !e.unlimited);
  const bought = s.vendor.stock[gear].item.id;
  assert.equal(cmd(s, { t: "buy", index: gear }).ok, true);
  cmd(s, { t: "closeVendor" }); cmd(s, { t: "openVendor" });
  assert.equal(s.vendor.visit, 1);
  assert.equal(s.vendor.stock.some((e) => e.item.id === bought), false);
  const first = s.vendor.stock.map((e) => e.item.id).join();
  enterFloor(s, 1); enterFloor(s, 0); s.player.tile = { x: 4, y: 6 };
  cmd(s, { t: "openVendor" });
  assert.equal(s.vendor.visit, 2);
  assert.notEqual(s.vendor.stock.map((e) => e.item.id).join(), first);
});

test("selling needs the vendor in reach", () => {
  const s = lobby(4); s.player.tile = { x: 4, y: 6 };
  const it = give(s, "blazer");
  cmd(s, { t: "openVendor" });
  s.player.tile = { x: 20, y: 9 };
  assert.equal(cmd(s, { t: "sell", id: it.id }).ok, false);
  assert.ok(s.inventory.items.includes(it));
});

// ---- ground cap ----
test("at the ground cap gold and the cheapest normal items go first; uniques, the released cursor item and the new entry stay", () => {
  const s = gameOn(OPEN); s.monsters.length = 0;
  const unique = mint(s, makeItem("blazer", { rarity: "unique" }));
  dropItem(s, unique, s.player.tile);
  const rare = mint(s, makeItem("blazer", { rarity: "rare" }));
  dropItem(s, rare, s.player.tile);
  for (let i = 0; i < config.groundItemCap + 20; i++) {
    if (i % 3 === 0) dropGold(s, 5, s.player.tile);
    else dropItem(s, makeItem("visor-cap"), s.player.tile);
  }
  assert.ok(s.groundItems.length <= config.groundItemCap);
  assert.ok(s.groundItems.some((g) => g.id === unique.id), "unique kept");
  assert.ok(s.groundItems.some((g) => g.id === rare.id), "rare kept while cheaper entries exist");
  // the held item released on death is never destroyed
  s.groundItems.length = 0;
  const held = mint(s, makeItem("paperclip-ring"));
  for (let i = 0; i < 60; i++) autoplace(s.inventory, mint(s, makeItem("paperclip-ring")));
  s.cursorItem = held;
  cmd(s, { t: "releaseCursor" });
  assert.ok(s.groundItems.some((g) => g.id === held.id));
  for (let i = 0; i < config.groundItemCap + 30; i++) dropItem(s, makeItem("hard-hat"), s.player.tile);
  assert.ok(s.groundItems.some((g) => g.id === held.id), "released item survives the cap");
  assert.ok(s.groundItems.length <= config.groundItemCap + 1);
});

// ---- nits ----
test("a cast while the hero is still casting is rejected and spends no mana", () => {
  const s = gameOn(OPEN); setLevel(s, 3); learnSkill(s, "coffee-break");
  s.player.hp = 1;
  assert.equal(cmd(s, { t: "cast", skill: "coffee-break" }).ok, true);
  const mp = s.player.mp;
  assert.equal(cmd(s, { t: "cast", skill: "coffee-break" }).ok, false);
  assert.equal(s.player.mp, mp);
});

test("a spawn blocked on re-entry is not recorded as killed", () => {
  const s = newGame(9); s.monsters.length = 0;
  teleportFloor(s, 2);
  const n = s.monsters.length, spawn = s.floor.spawns[0];
  enterFloor(s, 1);
  enterFloor(s, 2, { at: "tile", tile: spawn.tile }); // the hero lands on a monster start: that spawn is blocked
  assert.equal(s.monsters.length, n - 1);
  assert.deepEqual(s.blockedSpawns, [0]);
  enterFloor(s, 1); enterFloor(s, 2);
  assert.equal(s.monsters.length, n); // it came back
});
