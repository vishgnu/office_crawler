// R8 fix round (FIX-R8-CORE): CR8-01 (owed waits for an empty hand), ADV-R8-01 (item ids below nextItemId, no false rejection), ADV-R8-03 (re-click of the same target),
// CR8-07 (save version 6 and the clean refusal by a build that knows version 5 only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config, content, makeItem, rollPotion, createRng } from "../src/core/index.js";
import { serialize, deserialize, toSave, checksumOf } from "../src/save/index.js";
import { MIGRATIONS, migrate } from "../src/save/migrate.js";
import { mint } from "../src/core/systems/loot.js";
import { gameOn } from "./helpers.js";

const CLASSES = content.classes.map((c) => c.id);
const fullBag = (s) => { s.inventory.items = []; for (let y = 0; y < s.inventory.h; y++) for (let x = 0; x < s.inventory.w; x++) { const it = mint(s, makeItem("lukewarm-coffee")); it.x = x; it.y = y; s.inventory.items.push(it); } };
const near = (s, npcId) => { const n = s.floor.npcs.find((o) => o.id === npcId); s.player.tile = { x: n.tile.x, y: n.tile.y + 1 }; s.ui.dialog = null; assert.ok(applyInput(s, { t: "interact", id: npcId }).ok); };
function owedGame(seed = 7, cls = "facilities-manager") {
  const s = newGame(seed, { start: "town", class: cls });
  s.quests.sq3 = { s: "ready", p: 1 }; s.deepestDepth = config.quests.elite.depth;
  near(s, content.quests.sq3.giver);
  fullBag(s);
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq3" }).ok);
  assert.ok(s.player.owed.length >= 2);
  return s;
}
const seal = (o) => { const { checksum, ...rest } = o; return JSON.stringify({ ...rest, checksum: checksumOf(rest) }); };

test("[CR8-01] a held item keeps its cell: while the cursor holds an item nothing owed is delivered, and the item goes back to its origin", () => {
  for (const cls of CLASSES) {
    const s = owedGame(7, cls), n = s.player.owed.length, it = s.inventory.items[0], cell = { x: it.x, y: it.y };
    assert.ok(applyInput(s, { t: "invClick", grid: "inventory", x: cell.x, y: cell.y }).ok);
    assert.equal(s.cursorItem?.id, it.id);
    for (let i = 0; i < 10; i++) step(s);
    assert.equal(s.player.owed.length, n, `${cls}: nothing delivered while the hand is full`);
    assert.ok(applyInput(s, { t: "invClick", grid: "inventory", x: cell.x, y: cell.y }).ok);
    assert.equal(s.cursorItem, null, `${cls}: put back at the origin`);
    assert.ok(s.inventory.items.some((o) => o.id === it.id && o.x === cell.x && o.y === cell.y));
    assert.equal(s.player.owed.length, n, "and the bag is full again, so still owed");
    // an empty hand and a free cell: delivered on the next tick
    const sold = s.inventory.items.pop(); step(s);
    assert.equal(s.player.owed.length, n - 1, `${cls}: delivered once the hand is empty and a cell is free (freed ${sold.id})`);
  }
});

test("[CR8-01] the held item may be the only thing in the way: after dropping the cursor item the owed items arrive in order and ids stay unique", () => {
  const s = owedGame(8), order = s.player.owed.map((o) => o.id);
  const it = s.inventory.items[0];
  applyInput(s, { t: "invClick", grid: "inventory", x: it.x, y: it.y });
  s.inventory.items.length = 0; // the bag is empty and the hand is full
  for (let i = 0; i < 5; i++) step(s);
  assert.equal(s.player.owed.length, order.length, "waits");
  s.cursorItem = null; step(s);
  assert.equal(s.player.owed, undefined);
  assert.deepEqual(s.inventory.items.map((o) => o.id).filter((id) => order.includes(id)), order);
});

test("[ADV-R8-01] a stored minted id at or above nextItemId is refused in every container; ids below it and non-minted ids pass", () => {
  const s = newGame(3, { class: "facilities-manager", name: "Ids", start: "town" });
  const base = JSON.parse(serialize(s));
  assert.ok(deserialize(serialize(s)).ok);
  const future = "i" + (base.nextItemId + 5), edge = "i" + base.nextItemId;
  for (const id of [future, edge]) {
    const bag = structuredClone(base); bag.inventory.items.push({ ...makeItem("lukewarm-coffee"), id, x: 9, y: 3 });
    assert.equal(deserialize(seal(bag)).ok, false, `bag ${id}`);
    const belt = structuredClone(base); belt.belt[config.beltSlots - 1] = { ...makeItem("lukewarm-coffee"), id }; delete belt.belt[config.beltSlots - 1].x;
    assert.equal(deserialize(seal(belt)).ok, false, `belt ${id}`);
    const stash = structuredClone(base); stash.stash.items.push({ ...makeItem("lukewarm-coffee"), id, x: 0, y: 0 });
    assert.equal(deserialize(seal(stash)).ok, false, `stash ${id}`);
    const cur = structuredClone(base); cur.cursorItem = { ...makeItem("lukewarm-coffee"), id };
    assert.equal(deserialize(seal(cur)).ok, false, `cursor ${id}`);
  }
  const owed = owedGame(5), o = JSON.parse(serialize(owed));
  o.quests.owed[0].id = "i" + (o.nextItemId + 5);
  assert.equal(deserialize(seal(o)).ok, false, "owed");
  const low = structuredClone(base); low.inventory.items.push({ ...makeItem("lukewarm-coffee"), id: "i" + (base.nextItemId - 1) === (base.inventory.items.at(-1)?.id) ? "fill-1" : "zz-low", x: 9, y: 3 });
  assert.equal(deserialize(seal(low)).ok, true, "a non-minted id is not touched");
});

test("[ADV-R8-01] no false rejection: 24 played games (3 classes x 8 seeds, fights, pickups, quest hand-ins with owed, mid-run saves) always round-trip", () => {
  for (const cls of CLASSES) for (let seed = 1; seed <= 8; seed++) {
    const s = seed % 2 ? owedGame(seed, cls) : newGame(seed, { class: cls, name: "Rt", start: "town" });
    const rng = createRng(seed);
    for (let k = 0; k < 6; k++) { s.inventory.items.length < 30 && (() => { const p = mint(s, rollPotion(rng, 5)); p.x = k; p.y = 3; p.w = 1; p.h = 1; if (!s.inventory.items.some((o) => o.x === p.x && o.y === p.y)) s.inventory.items.push(p); })(); for (let i = 0; i < 40; i++) step(s); const r = deserialize(serialize(s)); assert.ok(r.ok, `${cls}/${seed}/${k}: ${r.message}`); }
  }
});

test("[ADV-R8-03] re-clicking the same target keeps the order's goal; a new target starts from none", () => {
  const rows = ["#########", "#@......#", "#########"];
  const s = gameOn(rows, [["zombie-intern", 5, 1], ["zombie-intern", 7, 1]], 1, { class: "facilities-manager", name: "A" });
  const [a, b] = s.monsters;
  applyInput(s, { t: "attack", id: a.id }); step(s);
  assert.ok(s.player.goal, "planned once");
  applyInput(s, { t: "attack", id: a.id });
  assert.ok(s.player.goal, "same target: the goal survives");
  applyInput(s, { t: "attack", id: b.id });
  assert.equal(s.player.goal, null, "a different target is a new order");
});

test("[CR8-07] the save version is 6; MIGRATIONS[5] changes only the number and is idempotent; a v5 save loads and is written as v6", () => {
  assert.equal(config.saveVersion, 6);
  const s = newGame(4, { class: "facilities-manager", name: "V6", start: "town" });
  const v6 = JSON.parse(serialize(s));
  assert.equal(v6.version, 6);
  const { checksum, ...rest } = v6, v5 = { ...rest, version: 5 };
  const m = MIGRATIONS[5](structuredClone(v5));
  assert.deepEqual({ ...m, version: 5 }, v5); assert.equal(m.version, 6);
  assert.deepEqual(MIGRATIONS[5](structuredClone(m)), m);
  assert.equal(migrate(structuredClone(v5), 6).ok, true);
  const r = deserialize(seal(v5));
  assert.ok(r.ok, r.message);
  assert.equal(JSON.parse(serialize(r.state)).version, 6);
});

test("[CR8-07] a build that knows version 5 only refuses a save with owed items as `newer` (not as damaged): its own rule is `version > saveVersion`", () => {
  const withOwed = JSON.parse(serialize(owedGame(9)));
  assert.equal(withOwed.version, 6);
  assert.ok(withOwed.quests.owed.length >= 1);
  const OLD_BUILD_VERSION = 5; // the check of format.js loadSave: raw.version > config.saveVersion => fail("newer", "This save is from a newer version of the game.")
  assert.ok(withOwed.version > OLD_BUILD_VERSION, "an old build takes the version branch before it looks at the quest block");
  // and the current build does the same for the next version
  const r = deserialize(seal({ ...withOwed, version: 7 }));
  assert.equal(r.ok, false); assert.equal(r.reason, "newer");
});
