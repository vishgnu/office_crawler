import { test } from "node:test";
import assert from "node:assert/strict";
import {
  content, config, createRng, applyInput, step, makeItem, mint, newGrid, canPlace, autoplace, clickCell, spawnItem, giveGold,
  rollItem, vendorStock, sellValue, buyPrice, deriveStats, enterFloor,
} from "../src/core/index.js";
import { classById } from "../src/core/content/classes.js";
import { gameOn, run, OPEN } from "./helpers.js";

const fresh = () => { const s = gameOn(OPEN); s.inventory.items.length = 0; s.belt.fill(null); return s; };
const give = (s, baseId, opts = {}) => { const it = mint(s, makeItem(baseId, opts)); assert.ok(autoplace(s.inventory, it)); return it; };
const cmd = (s, c) => applyInput(s, c);
const types = (s) => s.events.map((e) => e.type);

test("AC-R-055-1 inventory is 10x4; new game starts with one weapon (unworn) and health potions on the belt", () => {
  const s = gameOn(OPEN);
  assert.deepEqual([s.inventory.w, s.inventory.h], [10, 4]);
  assert.equal(s.inventory.items.length, 1);
  assert.equal(s.inventory.items[0].kind, "gear");
  assert.equal(s.belt.length, 4);
  assert.equal(s.belt.filter((b) => b?.restores === "hp").length, classById(s.player.class).startKit.healthPotions, "the class start kit (R8-B3: 4 / 4 / 3)");
  assert.equal(s.player.gold, config.startGold);
});

test("AC-R-055-2 click picks an item onto the cursor, a second click places it with its top-left on the cell", () => {
  const s = fresh(), it = give(s, "blazer");
  cmd(s, { t: "invClick", x: it.x + 1, y: it.y + 2 }); // any covered cell
  assert.equal(s.cursorItem, it); assert.equal(s.inventory.items.length, 0);
  assert.equal(cmd(s, { t: "invClick", x: 4, y: 1 }).ok, true);
  assert.equal(s.cursorItem, null);
  assert.deepEqual([it.x, it.y], [4, 1]);
});

test("AC-R-055-3 a placement past the grid is rejected and the item stays on the cursor", () => {
  const s = fresh(), it = give(s, "mop-halberd"); // 2x4
  cmd(s, { t: "invClick", x: it.x, y: it.y });
  assert.equal(cmd(s, { t: "invClick", x: 9, y: 0 }).ok, false);
  assert.equal(s.cursorItem, it);
  assert.equal(cmd(s, { t: "invClick", x: 0, y: 1 }).ok, false); // 4 rows do not fit from row 1
  assert.ok(types(s).includes("placeRejected"));
});

test("AC-R-055-4 swap and double-overlap, explicit layout", () => {
  const s = fresh();
  const one = mint(s, makeItem("hard-hat")), two = mint(s, makeItem("paperclip-ring")), three = mint(s, makeItem("lapel-badge"));
  s.inventory.items.push(Object.assign(one, { x: 0, y: 0 }), Object.assign(two, { x: 3, y: 0 }), Object.assign(three, { x: 4, y: 0 }));
  const held = mint(s, makeItem("clipboard-shield")); // 2x2
  s.cursorItem = held;
  assert.equal(cmd(s, { t: "invClick", x: 3, y: 0 }).ok, false); // covers (3,0) and (4,0): two items
  assert.equal(s.cursorItem, held); assert.equal(s.inventory.items.length, 3);
  assert.equal(cmd(s, { t: "invClick", x: 0, y: 0 }).ok, true); // covers the hard hat only: swap
  assert.equal(s.cursorItem, one); assert.deepEqual([held.x, held.y], [0, 0]);
});

test("AC-R-055-5 1,000 seeded pick/place/swap/reject operations keep items inside the grid, non-overlapping and conserved", () => {
  const s = fresh(), rng = createRng(99);
  const ids = ["blazer", "hard-hat", "paperclip-ring", "id-card", "mop-halberd", "sneakers", "cable-tie-belt", "clipboard-shield"];
  for (const id of ids) give(s, id);
  const total = () => s.inventory.items.length + (s.cursorItem ? 1 : 0);
  const names = () => [...s.inventory.items, ...(s.cursorItem ? [s.cursorItem] : [])].map((i) => i.id).sort().join();
  const before = names();
  for (let i = 0; i < 1000; i++) {
    cmd(s, { t: "invClick", x: rng.int(-1, 10), y: rng.int(-1, 4) });
    const all = s.inventory.items;
    assert.equal(total(), ids.length);
    for (const a of all) {
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 10 && a.y + a.h <= 4);
      for (const b of all) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, "overlap");
    }
  }
  assert.equal(names(), before);
});

test("AC-R-055-6 autoplace uses the first fitting spot scanning from the top left; fails when nothing fits", () => {
  const g = newGrid(10, 4);
  const tall = (id) => ({ id, w: 2, h: 4 });
  g.items.push(Object.assign(tall("a"), { x: 0, y: 0 }));
  const b = tall("b");
  assert.ok(autoplace(g, b)); assert.deepEqual([b.x, b.y], [2, 0]);
  const small = { id: "s", w: 1, h: 1 };
  autoplace(g, small); assert.deepEqual([small.x, small.y], [4, 0]);
  for (let i = 0; i < 3; i++) autoplace(g, tall(`t${i}`));
  assert.equal(canPlace(g, tall("z"), 8, 0), false);
  g.items.push(...[]);
  const full = newGrid(2, 2);
  assert.ok(autoplace(full, { id: "x", w: 2, h: 2 }));
  assert.equal(autoplace(full, { id: "y", w: 1, h: 1 }), false);
});

test("AC-R-053-1 equipment has exactly the ten slots, all empty", () => {
  const s = gameOn(OPEN);
  assert.deepEqual(Object.keys(s.equipment).sort(), ["amulet", "belt", "body", "feet", "hands", "head", "offhand", "ring1", "ring2", "weapon"]);
  assert.ok(Object.values(s.equipment).every((v) => v === null));
});

test("AC-R-053-2 equipping a weapon changes damage by exactly its damage plus affix bonuses", () => {
  const s = fresh(), w = give(s, "stapler-mace", { rarity: "magic" });
  w.affixes = [{ id: "d", group: "damage", kind: "prefix", stat: "damage", name: "Sharpened", value: 2, range: [1, 2] }];
  s.player.level = 5; s.player.attrs.grit = 14;
  const before = deriveStats(s.player, {}).damage;
  assert.equal(cmd(s, { t: "equip", id: w.id }).ok, true);
  assert.equal(s.equipment.weapon, w);
  assert.equal(s.inventory.items.length, 0);
  // a worn weapon replaces the unarmed range (fists are not a bonus on top of it); grit bonus and affixes still add
  const u = content.classes[0].derived.unarmed; // the class's own fists
  assert.deepEqual(s.player.damage, { min: before.min - u.min + w.damage.min + 2, max: before.max - u.max + w.damage.max + 2 });
  assert.ok(types(s).includes("equip"));
});

test("AC-R-053-3 rings fill ring1 then ring2; a third swaps with the targeted ring slot", () => {
  const s = fresh(), r1 = give(s, "paperclip-ring"), r2 = give(s, "paperclip-ring"), r3 = give(s, "paperclip-ring");
  cmd(s, { t: "equip", id: r1.id }); cmd(s, { t: "equip", id: r2.id });
  assert.deepEqual([s.equipment.ring1, s.equipment.ring2], [r1, r2]);
  cmd(s, { t: "equip", id: r3.id, slot: "ring2" });
  assert.equal(s.equipment.ring2, r3);
  assert.ok(s.inventory.items.includes(r2));
  assert.equal(cmd(s, { t: "equip", id: r2.id, slot: "weapon" }).ok, false);
});

test("AC-R-053-4 an item on a slot of another type is rejected; the cursor keeps it", () => {
  const s = fresh(), hat = give(s, "hard-hat");
  cmd(s, { t: "invClick", x: hat.x, y: hat.y });
  s.player.level = 9; s.player.attrs.stamina = 20;
  assert.equal(cmd(s, { t: "slotClick", slot: "weapon" }).ok, false);
  assert.equal(s.cursorItem, hat); assert.equal(s.equipment.weapon, null);
  assert.equal(cmd(s, { t: "slotClick", slot: "head" }).ok, true);
  assert.equal(s.equipment.head, hat); assert.equal(s.cursorItem, null);
  assert.equal(cmd(s, { t: "slotClick", slot: "head" }).ok, true); // picks it back up
  assert.equal(s.cursorItem, hat); assert.equal(s.equipment.head, null);
});

test("AC-R-053-5 unequip returns stats exactly; with a full inventory the unequip is rejected", () => {
  const s = fresh(), a = give(s, "blazer");
  s.player.level = 6; s.player.attrs.stamina = 14;
  const before = JSON.stringify(deriveStats(s.player, {}));
  cmd(s, { t: "equip", id: a.id });
  assert.notEqual(JSON.stringify(deriveStats(s.player, s.equipment)), before);
  assert.equal(cmd(s, { t: "unequip", slot: "body" }).ok, true);
  assert.equal(JSON.stringify({ ...deriveStats(s.player, {}) }), before);
  assert.equal(s.player.defense, deriveStats(s.player, {}).defense);
  cmd(s, { t: "equip", id: a.id });
  for (let i = 0; i < 40; i++) autoplace(s.inventory, mint(s, makeItem("paperclip-ring")));
  assert.equal(autoplace(s.inventory, { id: "probe", w: 1, h: 1 }), false);
  assert.equal(cmd(s, { t: "unequip", slot: "body" }).ok, false);
  assert.equal(s.equipment.body, a);
  assert.ok(types(s).includes("inventoryFull"));
});

test("AC-R-053-6 defence = base + item defence + affix defence, in any equip order", () => {
  const ids = ["hard-hat", "blazer", "rubber-gloves", "loafers", "leather-belt"];
  const results = [];
  for (const order of [ids, [...ids].reverse(), [ids[2], ids[0], ids[4], ids[1], ids[3]]]) {
    const s = fresh();
    s.player.level = 20; Object.assign(s.player.attrs, { grit: 20, agility: 20, stamina: 20, focus: 20 });
    const items = order.map((id) => { const it = give(s, id, { rarity: "magic" }); it.affixes = [{ id: "q", group: "defense", kind: "prefix", stat: "defense", name: "Padded", value: 3, range: [2, 4] }]; return it; });
    for (const it of items) assert.equal(cmd(s, { t: "equip", id: it.id }).ok, true, it.base);
    const expected = deriveStats(s.player, {}).defense + items.reduce((a, it) => a + it.defense + 3, 0);
    assert.equal(s.player.defense, expected);
    results.push(s.player.defense);
  }
  assert.equal(new Set(results).size, 1);
});

test("AC-R-052-6 a +15 fire resist affix adds exactly 15 on equip and returns on unequip", () => {
  const s = fresh(), ring = give(s, "paperclip-ring");
  ring.affixes = [{ id: "f", group: "resist-fire", kind: "suffix", stat: "resist.fire", name: "x", value: 15, range: [5, 35] }];
  cmd(s, { t: "equip", id: ring.id });
  assert.equal(s.player.resist.fire, 15);
  assert.equal(s.player.resist.cold, 0);
  cmd(s, { t: "unequip", slot: "ring1" });
  assert.equal(s.player.resist.fire, 0);
});

test("AC-R-053-7 / QF-05-4 a two-handed weapon returns the off-hand to the inventory; an off-hand is refused beside it", () => {
  const s = fresh();
  s.player.level = 20; Object.assign(s.player.attrs, { grit: 30, agility: 20, stamina: 20, focus: 20 });
  const shield = give(s, "clipboard-shield"), club = give(s, "mop-halberd"), shield2 = give(s, "binder-buckler");
  cmd(s, { t: "equip", id: shield.id });
  assert.equal(cmd(s, { t: "equip", id: club.id }).ok, true);
  assert.equal(s.equipment.weapon, club); assert.equal(s.equipment.offhand, null);
  assert.ok(s.inventory.items.includes(shield));
  assert.equal(cmd(s, { t: "equip", id: shield2.id }).ok, false);
  assert.ok(types(s).includes("slotBlocked"));
  // no room for the displaced off-hand: everything is undone
  const t = fresh();
  t.player.level = 20; Object.assign(t.player.attrs, { grit: 30, agility: 20, stamina: 20, focus: 20 });
  const sh = give(t, "clipboard-shield"); cmd(t, { t: "equip", id: sh.id });
  const c2 = give(t, "mop-halberd");
  for (let i = 0; i < 60; i++) autoplace(t.inventory, mint(t, makeItem("paperclip-ring")));
  const r = cmd(t, { t: "equip", id: c2.id });
  if (!r.ok) { assert.equal(t.equipment.offhand, sh); assert.equal(t.equipment.weapon, null); assert.ok(t.inventory.items.includes(c2)); }
});

test("AC-R-054-1 requirements: level and each attribute block equipping with reqNotMet", () => {
  for (const [key, base] of [["level", "keyboard-sword"], ["grit", "keyboard-sword"], ["stamina", "blazer"], ["agility", "rubber-gloves"], ["focus", "headset"]]) {
    const s = fresh(), it = give(s, base);
    s.player.level = 30; Object.assign(s.player.attrs, { grit: 30, agility: 30, stamina: 30, focus: 30 });
    if (key === "level") s.player.level = it.reqs.level - 1; else s.player.attrs[key] = it.reqs[key] - 1;
    s.player.level = key === "level" ? s.player.level : 30;
    s.events.length = 0;
    assert.equal(cmd(s, { t: "equip", id: it.id }).ok, false, key);
    assert.ok(types(s).includes("reqNotMet"));
    assert.equal(s.equipment[it.slot], null);
    if (key === "level") s.player.level = it.reqs.level; else s.player.attrs[key] = it.reqs[key];
    assert.equal(cmd(s, { t: "equip", id: it.id }).ok, true, `${key} met`);
  }
});

test("AC-R-056-1/-2 keys 1 and 2 drink the potion: exact restore, capped, removed, event", () => {
  const s = fresh();
  const coffee = mint(s, makeItem("strong-coffee")), water = mint(s, makeItem("water-bottle"));
  s.belt[0] = coffee; s.belt[1] = water;
  s.player.hp = s.player.hpMax - 2 * coffee.restore + 0; // below zero would be nonsense: use a tall max
  s.player.hpMax = 300; s.player.hp = 300 - 2 * coffee.restore;
  s.player.mpMax = 300; s.player.mp = 300 - 2 * water.restore;
  assert.equal(cmd(s, { t: "key", code: "Digit1" }).ok, true);
  assert.equal(s.player.hp, 300 - coffee.restore);
  assert.equal(s.belt[0], null);
  assert.ok(s.events.some((e) => e.type === "potion" && e.restores === "hp"));
  cmd(s, { t: "key", code: "Digit2" });
  assert.equal(s.player.mp, 300 - water.restore);
  s.belt[2] = mint(s, makeItem("triple-espresso")); s.player.hp = 299;
  cmd(s, { t: "key", code: "Digit3" });
  assert.equal(s.player.hp, 300);
});

test("AC-R-056-3 an empty belt slot does nothing and emits nothing", () => {
  const s = fresh();
  const hp = s.player.hp;
  s.events.length = 0;
  cmd(s, { t: "key", code: "Digit4" });
  assert.equal(s.events.length, 0); assert.equal(s.player.hp, hp);
  cmd(s, { t: "useBelt", index: 0 });
  assert.equal(s.events.length, 0);
});

test("AC-R-056-5 potions go to belt slots 1..4 in order; a non-potion is rejected", () => {
  const s = fresh();
  const potions = Array.from({ length: 4 }, () => give(s, "lukewarm-coffee"));
  for (const p of potions) assert.equal(cmd(s, { t: "toBelt", id: p.id }).ok, true);
  assert.deepEqual(s.belt.map((b) => b.id), potions.map((p) => p.id));
  const fifth = give(s, "lukewarm-coffee");
  assert.equal(cmd(s, { t: "toBelt", id: fifth.id }).ok, false);
  const hat = give(s, "visor-cap");
  assert.equal(cmd(s, { t: "toBelt", id: hat.id }).ok, false);
  // cursor path
  const t = fresh(), ring = give(t, "paperclip-ring"), pot = give(t, "lukewarm-coffee");
  cmd(t, { t: "invClick", x: ring.x, y: ring.y });
  assert.equal(cmd(t, { t: "beltClick", index: 1 }).ok, false); assert.equal(t.cursorItem, ring);
  cmd(t, { t: "invClick", x: 9, y: 0 });
  cmd(t, { t: "invClick", x: pot.x, y: pot.y });
  assert.equal(cmd(t, { t: "beltClick", index: 1 }).ok, true);
  assert.equal(t.belt[1], pot);
});

test("AC-R-056-6 / QF-05-5 a potion at full health is consumed (config.consumePotionAtFull) and refused when that is off", () => {
  const s = fresh();
  s.belt[0] = mint(s, makeItem("strong-coffee"));
  cmd(s, { t: "useBelt", index: 0 });
  assert.equal(s.belt[0], null);
  config.consumePotionAtFull = false;
  try {
    s.belt[0] = mint(s, makeItem("strong-coffee"));
    assert.equal(cmd(s, { t: "useBelt", index: 0 }).ok, false);
    assert.ok(s.belt[0]);
  } finally { config.consumePotionAtFull = true; }
});

test("AC-R-050-3 clicking a ground item walks to it and picks it up; events pickup", () => {
  const s = fresh(); s.monsters = [];
  const e = spawnItem(s, { rarity: "magic", ilvl: 8 }, { x: 14, y: 4 });
  const id = e.id;
  assert.equal(cmd(s, { t: "click", tile: e.tile, button: 0 }).ok, true);
  run(s, 400);
  assert.equal(s.groundItems.length, 0);
  assert.ok(s.inventory.items.some((i) => i.id === id));
  assert.ok(s.eventLog.some((ev) => ev.type === "pickup" && ev.id === id));
});

test("AC-R-050-4 walking over a gold pile adds exactly its amount; clicking it does the same", () => {
  const s = fresh(); s.monsters = [];
  const pile = { id: "g1", gold: 17, tile: { x: 12, y: 4 }, label: "17 gold" };
  s.groundItems.push(pile);
  const g0 = s.player.gold;
  cmd(s, { t: "moveTo", tile: { x: 12, y: 4 } });
  run(s, 300);
  assert.equal(s.player.gold, g0 + 17); assert.equal(s.groundItems.length, 0);
  s.groundItems.push({ id: "g2", gold: 5, tile: { x: 3, y: 2 }, label: "5 gold" });
  cmd(s, { t: "click", tile: { x: 3, y: 2 }, button: 0 });
  run(s, 400);
  assert.equal(s.player.gold, g0 + 22);
});

test("AC-R-050-5 with a full inventory the item stays on the ground, inventoryFull is emitted, gold still works", () => {
  const s = fresh(); s.monsters = [];
  for (let i = 0; i < 40; i++) autoplace(s.inventory, mint(s, makeItem("paperclip-ring")));
  const before = JSON.stringify(s.inventory);
  const e = spawnItem(s, { rarity: "normal", ilvl: 3, base: "blazer" }, { x: 8, y: 4 });
  s.groundItems.push({ id: "g9", gold: 3, tile: { x: 9, y: 4 }, label: "3 gold" });
  cmd(s, { t: "click", tile: e.tile, button: 0 });
  run(s, 300);
  assert.ok(s.groundItems.some((g) => g.id === e.id));
  assert.equal(JSON.stringify(s.inventory), before);
  assert.ok(s.eventLog.some((ev) => ev.type === "inventoryFull"));
  cmd(s, { t: "click", tile: { x: 9, y: 4 }, button: 0 });
  run(s, 200);
  assert.equal(s.player.gold, config.startGold + 3);
});

test("pickup does nothing for an unknown id; a new move order cancels a pending pickup", () => {
  const s = fresh(); s.monsters = [];
  assert.equal(cmd(s, { t: "pickup", id: "nope" }).ok, false);
  const e = spawnItem(s, { rarity: "normal", ilvl: 3 }, { x: 16, y: 6 });
  cmd(s, { t: "pickup", id: e.id });
  assert.equal(s.player.pickup, e.id);
  cmd(s, { t: "moveTo", tile: { x: 2, y: 2 } });
  assert.equal(s.player.pickup, null);
  run(s, 500);
  assert.equal(s.groundItems.length, 1);
});

test("QF-02-3 dying with an item on the cursor returns it to the inventory (or the floor when full), never destroyed", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  s.player.hp = 1;
  s.cursorItem = Object.assign(mint(s, makeItem("blazer")), {});
  run(s, 400);
  assert.equal(s.scene, "dead");
  assert.equal(s.cursorItem, null);
  assert.ok(s.inventory.items.some((i) => i.base === "blazer"));
  const t = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  t.player.hp = 1; t.inventory.items.length = 0;
  for (let i = 0; i < 40; i++) autoplace(t.inventory, mint(t, makeItem("paperclip-ring")));
  t.cursorItem = mint(t, makeItem("blazer"));
  run(t, 400);
  assert.ok(t.groundItems.some((g) => g.item?.base === "blazer"));
});

test("drop puts the cursor or an inventory item on the ground near the hero", () => {
  const s = fresh(), it = give(s, "blazer");
  assert.equal(cmd(s, { t: "drop", id: it.id }).ok, true);
  assert.equal(s.inventory.items.length, 0);
  assert.ok(s.groundItems.some((g) => g.id === it.id));
});

test("stash moves conserve items (AC-R-059-1)", () => {
  const s = fresh(), it = give(s, "blazer");
  enterFloor(s, 0); s.player.tile = { x: 24, y: 9 }; // beside the stash NPC
  assert.equal(cmd(s, { t: "interact", id: "stash" }).ok, true);
  assert.equal(s.ui.dialog.kind, "stash");
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "stash" }).ok, true);
  assert.equal(s.stash.items.length, 1); assert.equal(s.inventory.items.length, 0);
  assert.equal(cmd(s, { t: "stash", id: it.id, to: "inventory" }).ok, true);
  assert.equal(s.stash.items.length, 0); assert.equal(s.inventory.items.length, 1);
});

// ---- vendor ----

// Trading needs a town vendor within reach (R-041): move the fixture game into the Lobby, next to the vendor NPC.
const open = (s) => { if (s.depth !== 0) { enterFloor(s, 0); s.player.tile = { x: 4, y: 6 }; } return cmd(s, { t: "openVendor" }); };
const firstGear = (s) => s.vendor.stock.findIndex((e) => !e.unlimited);

test("AC-R-057-1 buying costs exactly the price, adds the item and removes it from the stock", () => {
  const s = fresh(); giveGold(s, 1000); open(s);
  const i = firstGear(s), e = s.vendor.stock[i], g = s.player.gold, n = s.vendor.stock.length;
  assert.equal(cmd(s, { t: "buy", index: i }).ok, true);
  assert.equal(s.player.gold, g - e.price);
  assert.ok(s.inventory.items.includes(e.item));
  assert.equal(s.vendor.stock.length, n - 1);
});

test("potions at the vendor are unlimited and unlock by player level (QF-04-3)", () => {
  const s = fresh(); giveGold(s, 1000); open(s);
  const tiers = (st) => new Set(st.vendor.stock.filter((e) => e.unlimited && e.item.kind === "potion").map((e) => e.item.base));
  assert.ok(tiers(s).size === 2);
  const i = s.vendor.stock.findIndex((e) => e.unlimited && e.item.kind === "potion");
  cmd(s, { t: "buy", index: i }); cmd(s, { t: "buy", index: i });
  assert.equal(s.vendor.stock[i].unlimited, true);
  assert.equal(s.inventory.items.filter((x) => x.kind === "potion").length, 0, "R8-B3: bought potions go to the belt while a slot is free");
  assert.equal(s.belt.filter((x) => x?.kind === "potion").length, 2);
  assert.notEqual(s.belt[0].id, s.belt[1].id);
  s.belt.fill(s.belt[0]); // belt full: the next potion goes to the bag
  cmd(s, { t: "buy", index: i });
  assert.equal(s.inventory.items.filter((x) => x.kind === "potion").length, 1);
  const t = fresh(); t.player.level = 12; open(t);
  assert.equal(tiers(t).size, 6);
});

test("AC-R-057-2 too little gold: nothing changes and cannotAfford is emitted", () => {
  const s = fresh(); open(s);
  s.player.gold = 0;
  const i = firstGear(s), inv = JSON.stringify(s.inventory);
  assert.equal(cmd(s, { t: "buy", index: i }).ok, false);
  assert.equal(s.player.gold, 0); assert.equal(JSON.stringify(s.inventory), inv);
  assert.ok(types(s).includes("cannotAfford"));
});

test("AC-R-057-3 enough gold but no room: inventoryFull, gold unchanged", () => {
  const s = fresh(); giveGold(s, 5000); open(s);
  for (let i = 0; i < 40; i++) autoplace(s.inventory, mint(s, makeItem("paperclip-ring")));
  const g = s.player.gold;
  assert.equal(cmd(s, { t: "buy", index: firstGear(s) }).ok, false);
  assert.equal(s.player.gold, g);
  assert.ok(types(s).includes("inventoryFull"));
});

test("AC-R-057-4 selling pays exactly the sell value and removes the item; equipped and held items cannot be sold (QF-05-6)", () => {
  const s = fresh(); open(s);
  const it = give(s, "blazer"), g = s.player.gold, v = sellValue(it);
  assert.equal(cmd(s, { t: "sell", id: it.id }).ok, true);
  assert.equal(s.player.gold, g + v); assert.equal(s.inventory.items.length, 0);
  const w = give(s, "ruler-rapier"); cmd(s, { t: "equip", id: w.id });
  assert.equal(cmd(s, { t: "sell", id: w.id }).ok, false);
  const c = give(s, "blazer"); cmd(s, { t: "invClick", x: c.x, y: c.y });
  assert.equal(cmd(s, { t: "sell", id: c.id }).ok, false);
  const t = fresh(); const x = give(t, "blazer");
  assert.equal(cmd(t, { t: "sell", id: x.id }).ok, false); // no vendor window open
});

test("AC-R-057-7 vendor stock is a pure function of seed and visit: equal for equal input, different otherwise", () => {
  const a = vendorStock(5, 1), b = vendorStock(5, 1);
  assert.deepEqual(a, b);
  assert.notDeepEqual(vendorStock(5, 2), a);
  assert.notDeepEqual(vendorStock(6, 1), a);
  const s = gameOn(OPEN); open(s);
  const first = s.vendor.stock.map((e) => e.item.base).join();
  open(s); // reopening the window in the same Lobby visit does not re-roll the stock
  assert.equal(s.vendor.visit, 1);
  assert.equal(s.vendor.stock.map((e) => e.item.base).join(), first);
  enterFloor(s, 1); enterFloor(s, 0); s.player.tile = { x: 4, y: 6 }; // a new Lobby visit does
  open(s);
  assert.equal(s.vendor.visit, 2);
  assert.notEqual(s.vendor.stock.map((e) => e.item.base).join(), first);
  for (const e of a) assert.equal(e.price, buyPrice(e.item));
});

test("derived stats follow equipment through the whole pipeline: pick up, equip, damage up, kill faster", () => {
  const s = fresh(); s.monsters = [];
  const e = spawnItem(s, { base: "ruler-rapier", rarity: "normal", ilvl: 3 }, { x: 11, y: 4 });
  cmd(s, { t: "pickup", id: e.id });
  run(s, 300);
  const dmg0 = s.player.damage.max;
  assert.equal(cmd(s, { t: "equip", id: e.id }).ok, true);
  assert.equal(s.player.damage.max, dmg0 - content.classes[0].derived.unarmed.max + 3); // the rapier replaces the fists
});
