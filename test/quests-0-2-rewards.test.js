// R7-0.2 pouch, atomic hand-in and rewards (AC-R-246-3 core half, 247-1/2/3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, config, content, hashStateWithout, enterFloor, makeItem, findSpot, checkReqs, snapshot, step } from "../src/core/index.js";
import { itemFloorOf, rewardOf } from "../src/core/systems/quests.js";
import { mint } from "../src/core/systems/loot.js";

const ARMOUR = ["body", "head", "hands", "feet"];
const STRIP = { paths: ["events", "eventLog"] };

function near(s, npcId) {
  const n = s.floor.npcs.find((o) => o.id === npcId);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  s.ui.dialog = null;
  assert.ok(applyInput(s, { t: "interact", id: npcId }).ok);
}
function ready(seed, id, opts = {}) {
  const s = newGame(seed, { start: "town", ...opts });
  s.quests[id] = { s: "ready", p: id === "sq1" ? config.quests.kill.count : 1 };
  if (id === "sq2") s.player.pouch.push({ id: "qi-sq2", quest: "sq2" });
  near(s, content.quests[id].giver);
  return s;
}
const fillBag = (s, holes = 0) => {
  s.inventory.items = [];
  for (let y = 0; y < s.inventory.h; y++) for (let x = 0; x < s.inventory.w; x++) { const it = mint(s, makeItem("lukewarm-coffee")); it.x = x; it.y = y; s.inventory.items.push(it); }
  for (let i = 0; i < holes; i++) s.inventory.items.pop();
};
const potions = (s) => s.inventory.items.filter((i) => i.kind === "potion");
const gear = (s) => s.inventory.items.filter((i) => i.kind !== "potion" && i.rarity !== "normal");

test("AC-R-247-1 sq1 hand-in: floor-scaled gold and xp, one stack of potions, completed; quest.completed carries the rewards", () => {
  const s = ready(3, "sq1"), g0 = s.player.gold, x0 = s.player.xp, n0 = s.inventory.items.length;
  const c = config.quests.sq1;
  const r = applyInput(s, { t: "questHandIn", id: "sq1" });
  assert.ok(r.ok);
  assert.equal(s.player.gold - g0, c.gold.base + c.gold.perDepth * c.refDepth);
  assert.equal(s.player.xp - x0, c.xp.base + c.xp.perDepth * c.refDepth);
  assert.equal(potions(s).length, c.potions);
  assert.equal(s.inventory.items.length - n0, c.potions);
  assert.equal(s.quests.sq1.s, "completed");
  const ev = s.eventLog.find((e) => e.type === "quest.completed");
  assert.deepEqual([ev.id, ev.rewards.gold, ev.rewards.xp, ev.rewards.items.length], ["sq1", c.gold.base + c.gold.perDepth * c.refDepth, c.xp.base + c.xp.perDepth * c.refDepth, c.potions]);
  assert.ok(new Set(s.inventory.items.map((i) => i.id)).size === s.inventory.items.length, "fresh unique ids");
});

for (const [id, slots, nPot] of [["sq2", ARMOUR, 0], ["sq3", ["weapon"], config.quests.sq3.potions]]) {
  test(`AC-R-247-2 ${id}: exactly one ${slots.join("/")} piece, magic or rare, ilvl of floor ${config.quests.gearFloor}, never unique, ${nPot} potions`, () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = ready(seed, id), sp = s.player.skillPoints, at = JSON.stringify(s.player.attrs);
      s.player.level = 10; s.player.xp = 0; // no level-up: points only come from the normal xp path
      assert.ok(applyInput(s, { t: "questHandIn", id }).ok);
      const gs = gear(s);
      assert.equal(gs.length, 1);
      assert.ok(slots.includes(gs[0].slot), gs[0].slot);
      assert.ok(["magic", "rare"].includes(gs[0].rarity));
      assert.ok(!gs[0].unique && !s.uniquesFound.length);
      assert.equal(gs[0].ilvl, config.quests.gearFloor * config.ilvlPerDepth);
      assert.equal(potions(s).length, nPot);
      assert.equal(s.player.skillPoints, sp); assert.equal(JSON.stringify(s.player.attrs), at); assert.equal(s.player.attrPoints, 0);
    }
  });
}

test("AC-R-247-2 the gear is identical for the same seed, class and hero level; reroll until the hero meets the requirements", () => {
  const a = rewardOf(ready(4, "sq3"), "sq3"), b = rewardOf(ready(4, "sq3"), "sq3");
  assert.deepEqual(a, b);
  assert.notDeepEqual(rewardOf(ready(5, "sq3"), "sq3").gear, a.gear);
  let met = 0;
  for (let seed = 1; seed <= 40; seed++) for (const id of ["sq2", "sq3"]) {
    const s = ready(seed, id), g = rewardOf(s, id).gear;
    if (checkReqs(s.player, g).ok) met++;
  }
  assert.ok(met >= 70, `most rewards are wearable by the hero (${met}/80)`);
  // a stronger hero is allowed to get different gear (the reroll depends on checkReqs)
  const s = ready(4, "sq3"); s.player.level = 30; s.player.attrs = { grit: 99, agility: 99, stamina: 99, focus: 99 };
  assert.ok(checkReqs(s.player, rewardOf(s, "sq3").gear).ok);
});

test("AC-R-247-2 a hand-in never rolls a unique, over many seeds and both gear quests", () => {
  for (let seed = 1; seed <= 100; seed++) for (const id of ["sq2", "sq3"]) {
    const g = rewardOf(ready(seed, id), id).gear;
    assert.notEqual(g.rarity, "unique"); assert.ok(!g.unique);
  }
});

test("AC-R-247-3 hand-in twice grants once; the second call is refused with no effect", () => {
  const s = ready(6, "sq3");
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq3" }).ok);
  const gold = s.player.gold, h = hashStateWithout(s, STRIP);
  const r = applyInput(s, { t: "questHandIn", id: "sq3" });
  assert.deepEqual([r.ok, r.error], [false, "already done"]);
  assert.equal(hashStateWithout(s, STRIP), h); assert.equal(s.player.gold, gold);
});

test("AC-R-247-3 / R8-Q1 full bag: the hand-in completes, gold and xp are paid, the items wait in the owed pouch and move into the bag when there is room", () => {
  const s = ready(7, "sq3");
  fillBag(s);
  const g0 = s.player.gold, n = s.eventLog.length, bag = s.inventory.items.length;
  const r = applyInput(s, { t: "questHandIn", id: "sq3" });
  assert.ok(r.ok, "a full bag does not block the hand-in");
  assert.equal(s.quests.sq3.s, "completed");
  assert.ok(s.player.gold > g0, "gold paid at once");
  assert.equal(s.inventory.items.length, bag, "the bag is untouched");
  assert.equal(s.groundItems.length, 0, "nothing dropped on the floor");
  const owed = s.player.owed, want = 1 + config.quests.sq3.potions;
  assert.equal(owed.length, want, "the weapon and the potions are owed");
  assert.equal(new Set([...owed.map((i) => i.id), ...s.inventory.items.map((i) => i.id)]).size, bag + want, "ids are unique");
  const done = s.eventLog.slice(n).find((e) => e.type === "quest.completed");
  assert.equal(done.rewards.owed, want);
  assert.ok(!s.eventLog.slice(n).some((e) => e.type === "quest.handInRefused"));
  step(s, []);
  assert.equal(s.player.owed.length, want, "still no room: still owed");
  s.inventory.items.length = 0; // space freed
  step(s, []);
  assert.equal(s.player.owed, undefined, "the key is gone once everything is delivered");
  assert.equal(s.inventory.items.length, want);
  assert.ok(s.inventory.items.every((i) => Number.isInteger(i.x) && Number.isInteger(i.y)));
  assert.equal(s.eventLog.filter((e) => e.type === "pickup").length, want, "one pickup event per delivered item");
});

test("AC-R-247-3 / R8-Q1 a bag with only 1x1 holes: the potions that fit go in, the weapon waits for a 2-high gap; nothing is lost or duplicated", () => {
  let s = ready(7, "sq3");
  fillBag(s, 2); // two 1x1 holes: the potions fit, the weapon (taller than 1x1) does not
  const gearItem = rewardOf(s, "sq3").gear;
  assert.ok(!findSpot(s.inventory, { w: gearItem.w, h: gearItem.h }));
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq3" }).ok);
  assert.equal(s.player.owed.length, 1, "only the weapon is owed");
  assert.equal(s.player.owed[0].kind, "gear");
  assert.equal(potions(s).length, 40, "the two potions took the two holes");
  s.inventory.items = s.inventory.items.filter((i) => i.kind !== "potion"); // clear the bag
  step(s, []);
  assert.equal(s.player.owed, undefined);
  assert.equal(gear(s).length, 1);
  s = ready(7, "sq1");
  fillBag(s, 2); // sq1: three potions, two holes
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq1" }).ok);
  assert.equal(s.player.owed.length, 1);
  s.inventory.items.pop();
  step(s, []);
  assert.equal(s.player.owed, undefined);
  assert.equal(potions(s).length, 40);
});

test("hand-in gate: wrong NPC, no dialog, not ready, unknown and bad ids are refused with no change", () => {
  const s = ready(8, "sq1");
  const h = () => hashStateWithout(s, STRIP), h0 = h();
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq2" }).error, "wrong npc", "sq2 is the healer's: the vendor dialog is open");
  assert.equal(applyInput(s, { t: "questHandIn", id: "nope" }).error, "unknown quest");
  assert.equal(applyInput(s, { t: "questHandIn", id: 3 }).error, "bad id");
  assert.equal(applyInput(s, { t: "questHandIn" }).error, "bad id");
  s.quests.sq1 = { s: "active", p: 2 };
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq1" }).error, "not ready");
  s.quests.sq1 = { s: "ready", p: 8 };
  s.ui.dialog = null;
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq1" }).error, "no dialog");
  assert.equal(s.quests.sq1.s, "ready");
  assert.notEqual(h(), h0, "(dialog and quest state were edited by this test)");
});

test("an item quest without its pouch entry is not ready; the pouch entry goes with the hand-in", () => {
  const s = ready(2, "sq2");
  s.player.pouch = [];
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq2" }).error, "not ready");
  s.player.pouch.push({ id: "qi-sq2", quest: "sq2" });
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq2" }).ok);
  assert.deepEqual(s.player.pouch, []);
});

test("hand-in moves the pin off a completed quest (to main while the main quest is open)", () => {
  const s = ready(2, "sq1");
  s.quests.pinned = "sq1";
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq1" }).ok);
  assert.equal(s.quests.pinned, "main");
  assert.ok(s.eventLog.some((e) => e.type === "quest.pinned" && e.id === "main"));
});

test("hand-in works through the step loop (recorded input) and levels the hero up through the normal xp path", () => {
  const s = ready(3, "sq3");
  step(s, [{ t: "questHandIn", id: "sq3" }]);
  assert.equal(s.quests.sq3.s, "completed");
  assert.equal(snapshot(s).quests.sq3.state, "completed");
  const lv = s.player.level;
  assert.ok(lv >= 2 && s.player.attrPoints === (lv - 1) * config.attrPointsPerLevel, "points only from the level-up of the xp");
});

// ---- pouch pickup (AC-R-246-3 core half) ----
function onItemFloor(seed, bagFull = true) {
  const s = newGame(seed, { start: "town" });
  near(s, "healer"); assert.ok(applyInput(s, { t: "questAccept", id: "sq2" }).ok); s.ui.dialog = null;
  if (bagFull) fillBag(s);
  enterFloor(s, itemFloorOf(seed));
  return s;
}
test("AC-R-246-3 walking to the quest item with a full bag: it enters the pouch, the bag is unchanged, sq2 is ready", () => {
  const s = onItemFloor(5), e = s.groundItems.find((g) => g.quest === "sq2"), bag = JSON.stringify(s.inventory);
  s.player.tile = { x: e.tile.x - 1, y: e.tile.y };
  const r = applyInput(s, { t: "pickup", id: "qi-sq2" });
  assert.ok(r.ok);
  for (let i = 0; i < 200 && s.groundItems.some((g) => g.quest); i++) step(s, []);
  assert.deepEqual(s.player.pouch, [{ id: "qi-sq2", quest: "sq2" }]);
  assert.equal(JSON.stringify(s.inventory), bag);
  assert.equal(s.quests.sq2.s, "ready");
  const ev = s.eventLog.filter((x) => x.type.startsWith("quest.")).slice(-2).map((x) => x.type);
  assert.deepEqual(ev, ["quest.item", "quest.step"]);
  assert.ok(!s.eventLog.some((x) => x.type === "inventoryFull"));
  // survives a floor change and a reload (state round trip)
  enterFloor(s, 0); enterFloor(s, itemFloorOf(5));
  assert.equal(s.player.pouch.length, 1);
  assert.equal(structuredClone(s).player.pouch.length, 1);
  assert.equal(s.groundItems.filter((g) => g.quest).length, 0);
});

test("pickup by a click-order: the hero walks to the item and takes it; standing on it takes it too", () => {
  const s = onItemFloor(6, false), e = s.groundItems.find((g) => g.quest === "sq2");
  s.monsters = []; // an empty floor: the walk is not interrupted (the hero is level 1 and unarmed)
  assert.ok(applyInput(s, { t: "pickup", id: e.id }).ok);
  for (let i = 0; i < 600 && s.groundItems.some((g) => g.quest); i++) step(s, []);
  assert.equal(s.quests.sq2.s, "ready");
  const t = onItemFloor(7, false); t.monsters = []; const f = t.groundItems.find((g) => g.quest);
  t.player.tile = { ...f.tile };
  step(t, []);
  assert.equal(t.quests.sq2.s, "ready", "walking over it picks it up");
});

test("the pouch item cannot be sold, dropped, stashed or equipped, and is not a bag item", () => {
  const s = ready(2, "sq2");
  for (const cmd of [{ t: "drop", id: "qi-sq2" }, { t: "sell", id: "qi-sq2" }, { t: "stash", id: "qi-sq2", to: "stash" }, { t: "equip", id: "qi-sq2" }, { t: "toBelt", id: "qi-sq2", index: 0 }]) {
    const r = applyInput(s, cmd);
    assert.equal(r.ok, false, cmd.t);
  }
  assert.equal(s.player.pouch.length, 1); assert.equal(s.groundItems.length, 0);
});
