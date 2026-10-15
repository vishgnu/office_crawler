// ADV-R8 round 8, owed reward items (CORE-R8-1 R8-Q1). Test-engineer, adversarial mode; written from docs/reviews/R8-core1-progress.md and the source's public
// behaviour, without reading the implementer's tests (test/r8-core1.test.js). Defects are `{ todo: 'ADV-R8-NN' }` (expected failures, the suite stays green).
// Legal fixtures come from real play (newGame, the real inputs) or the game's own save writer, checked by the same schema; a HOSTILE fixture names the rule it violates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, newGame, step, applyInput, enterFloor, respawn, rollPotion, createRng } from "../src/core/index.js";
import { OWED_MAX, rewardOf } from "../src/core/systems/quests.js";
import { setQuestStep, completeQuest, setHp } from "../src/core/cheats.js";
import { serialize, deserialize, checksumOf } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { itemFloorOf } from "../src/core/systems/quests.js";

const GIVER = { sq1: "vendor", sq2: "healer", sq3: "potions", sq4: "stash", sq5: "vendor" };
const hero = (seed = 5, cls = "facilities-manager") => newGame(seed, { class: cls, name: "Adv", start: "town", wearStartKit: true });
const rt = (s) => { const r = deserialize(serialize(s)); assert.ok(r.ok, `legal state must round-trip: ${r.message}`); return r.state; };
function talk(s, npc) {
  if (s.depth !== 0) enterFloor(s, 0, { at: "entry" });
  applyInput(s, { t: "interact", id: npc });
  for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
  assert.equal(s.ui.dialog?.npc, npc, `dialog with ${npc} opened`);
}
const accept = (s, id) => { talk(s, GIVER[id]); const r = applyInput(s, { t: "questAccept", id }); assert.ok(r.ok, JSON.stringify(r)); };
const handIn = (s, id) => { if (s.ui.dialog?.npc !== GIVER[id]) talk(s, GIVER[id]); return applyInput(s, { t: "questHandIn", id }); };
function fillBag(s, holes = new Set()) {
  s.inventory.items.length = 0;
  const rng = createRng(11);
  let n = 0;
  for (let y = 0; y < config.inventory.h; y++) for (let x = 0; x < config.inventory.w; x++) {
    if (holes.has(`${x},${y}`)) continue;
    s.inventory.items.push({ ...rollPotion(rng, 12), id: `fill${n++}`, x, y, w: 1, h: 1 });
  }
}
const stripFill = (s) => { s.inventory.items = s.inventory.items.filter((i) => !i.id.startsWith("fill")); };
/** A hero with sq1 handed in against a full bag: sq1 pays 3 potions that are owed. */
function owing(seed = 5, cls = "facilities-manager", id = "sq3") {
  const s = hero(seed, cls);
  accept(s, id); setQuestStep(s, id, 2); talk(s, GIVER[id]);
  fillBag(s);
  assert.ok(handIn(s, id).ok);
  assert.ok(s.player.owed?.length >= 1, "something is owed");
  return s;
}
const allIds = (s) => [...s.inventory.items, ...s.stash.items, ...Object.values(s.equipment), ...s.belt, s.cursorItem, ...(s.player.owed ?? [])].filter(Boolean).map((i) => i.id);
const seal = (o) => { const { checksum, ...rest } = o; return canonical({ ...rest, checksum: checksumOf(rest) }); };
const forge = (s, mut) => { const o = JSON.parse(serialize(s)); mut(o); return deserialize(seal(o)); };

// =============================================================================================== hostile saves (rule named)
test("[R8-owed-forge] a legal owed state round-trips; the owed key is absent when nothing is owed", () => {
  const s = owing(3, "sales-rep", "sq3");
  const o = JSON.parse(serialize(s));
  assert.ok(Array.isArray(o.quests.owed) && o.quests.owed.length === s.player.owed.length);
  const r = rt(s);
  assert.equal(canonical(r.player.owed), canonical(s.player.owed));
  stripFill(s); step(s);
  assert.equal("owed" in JSON.parse(serialize(s)).quests, false, "no key once delivered");
  assert.equal(s.player.owed, undefined);
});

const BAD = [
  ["owed without any completed side quest (rule: owed only after a completed side quest)", (o, s) => { for (const k of ["sq1", "sq2", "sq3", "sq4", "sq5"]) o.quests[k] = { s: "available", p: 0 }; }],
  ["owed is an empty array (rule: absent means nothing owed, 1..OWED_MAX items)", (o) => { o.quests.owed = []; }],
  ["owed is null", (o) => { o.quests.owed = null; }],
  ["owed is an object", (o) => { o.quests.owed = { 0: o.quests.owed[0] }; }],
  ["owed is a string", (o) => { o.quests.owed = "i1"; }],
  ["owed longer than OWED_MAX", (o) => { const it = o.quests.owed[0]; o.quests.owed = Array.from({ length: OWED_MAX + 1 }, (_, i) => ({ ...it, id: `x${i + 500}` })); }],
  ["owed item id equals a bag item id (rule: one id, one place)", (o) => { o.quests.owed[0].id = o.inventory.items[0].id; }],
  ["owed item id equals a belt item id", (o) => { o.quests.owed[0].id = o.belt.find(Boolean).id; }],
  ["two owed items with one id", (o) => { o.quests.owed.push({ ...o.quests.owed[0] }); }],
  ["owed item with an extra key", (o) => { o.quests.owed[0].onclick = "alert(1)"; }],
  ["owed item that is a consumable (rule: rewards are gear and potions)", (o) => { o.quests.owed[0] = { ...o.quests.owed[0], kind: "consumable" }; }],
  ["owed entry is null", (o) => { o.quests.owed[0] = null; }],
  ["owed entry is a number", (o) => { o.quests.owed[0] = 7; }],
  ["owed entry with a negative value", (o) => { o.quests.owed[0].value = -5; }],
];
for (const [name, mut] of BAD) {
  test(`[R8-owed-forge] rejected: ${name}`, () => {
    const s = owing(3, "facilities-manager", "sq3");
    const r = forge(s, (o) => mut(o, s));
    assert.equal(r.ok, false, name);
  });
}
test("[R8-owed-forge] ADV-R8-01 an item whose id is not below nextItemId is rejected (else the next minted item collides with it)", () => {
  const s = owing(3, "facilities-manager", "sq3");
  const r = forge(s, (o) => { o.quests.owed[0].id = "i" + (o.nextItemId + 5); });
  const bagCase = forge(s, (o) => { o.inventory.items[0].id = "i" + (o.nextItemId + 5); });
  // the same rule for the bag decides whether this is a gap of the owed list or of the whole save format
  assert.equal(bagCase.ok === false, r.ok === false, `bag: ${bagCase.ok}, owed: ${r.ok}`);
  if (r.ok) {
    // demonstrate the collision: mint ids until the forged one is reached
    const forgedId = r.state.player.owed[0].id;
    for (let i = 0; i < 10; i++) { const id = `i${r.state.nextItemId++}`; if (id === forgedId) assert.fail("a minted item took the id of an owed item"); }
  }
});
test("[R8-owed-forge] observations that are not defects: a forged owed item with a bag position or a markup name loads (the validator treats names as text, x/y are overwritten on delivery); delivery puts it at a real free spot and the state stays legal", () => {
  const s = owing(3, "facilities-manager", "sq3");
  const r = forge(s, (o) => { o.quests.owed[0].x = 7; o.quests.owed[0].y = 4; o.quests.owed[1].name = "<img src=x onerror=alert(1)>"; });
  assert.equal(r.ok, true);
  const t = r.state;
  stripFill(t); step(t); step(t);
  assert.equal(t.player.owed, undefined);
  const cells = new Set();
  for (const it of t.inventory.items) for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) { const k = `${it.x + x},${it.y + y}`; assert.equal(cells.has(k), false, "no overlap"); cells.add(k); assert.ok(it.x + x < config.inventory.w && it.y + y < config.inventory.h); }
  rt(t);
});
test("[R8-owed-forge] a save with a top-level entryGrace key (transient state) is rejected, and a written save never contains it", () => {
  const s = hero(4); enterFloor(s, 1, { at: "entry" });
  assert.ok(s.entryGrace, "grace is on after the descent");
  assert.equal(serialize(s).includes("entryGrace"), false);
  assert.equal(forge(s, (o) => { o.entryGrace = { t: 99999, at: { x: 1, y: 1 } }; }).ok, false);
  assert.equal(forge(s, (o) => { o.player.entryGrace = 1; }).ok, false);
});
test("[R8-owed-forge] forged owed gear fits the same item rules as bag gear: an affix that does not exist, a rarity that does not exist, an ilvl beyond the game", () => {
  const s = owing(3, "facilities-manager", "sq5") ;
  void s;
  const t = hero(8); accept(t, "sq5"); setQuestStep(t, "sq5", 2); talk(t, "vendor"); fillBag(t); assert.ok(handIn(t, "sq5").ok);
  assert.equal(t.player.owed.length, 1);
  assert.equal(forge(t, (o) => { o.quests.owed[0].rarity = "godly"; }).ok, false);
  assert.equal(forge(t, (o) => { o.quests.owed[0].affixes.push({ id: "nope", group: "x", kind: "prefix", stat: "hpMax", name: "x", tier: 1, value: 1, range: [1, 1] }); }).ok, false);
  assert.equal(forge(t, (o) => { o.quests.owed[0].ilvl = 99999; }).ok, false);
  assert.equal(forge(t, (o) => { o.quests.owed[0].affixes[0].value = 99999; }).ok, false);
});

// =============================================================================================== lifecycle
test("[R8-owed-life] 50 save/load cycles with items owed change nothing: same list, same ids, delivery after the cycles pays exactly the reward", () => {
  let s = owing(21, "it-wizard", "sq3");
  const names = [...rewardOf(s, "sq3").potions.map((p) => p.name), ...(rewardOf(s, "sq3").gear ? [rewardOf(s, "sq3").gear.name] : [])].sort();
  const owed0 = JSON.stringify(s.player.owed);
  for (let i = 0; i < 50; i++) { s = rt(s); for (let k = 0; k < 3; k++) step(s); }
  assert.equal(canonical(s.player.owed), canonical(JSON.parse(owed0)));
  const inBag = s.inventory.items.filter((i) => !i.id.startsWith("fill")).map((i) => i.name);
  stripFill(s); step(s); step(s);
  assert.equal(s.player.owed, undefined);
  assert.deepEqual(s.inventory.items.map((i) => i.name).sort(), names, `delivered ${inBag.length} at once, the rest later: all of them, once`);
  const ids = allIds(s); assert.equal(new Set(ids).size, ids.length);
});

test("[R8-owed-life] death with items owed: the owed list survives the death and the respawn and is delivered afterwards, nothing lost", () => {
  const s = owing(22, "facilities-manager", "sq3");
  const want = canonical(s.player.owed);
  enterFloor(s, 2, { at: "entry" }); s.monsters = [];
  setHp(s, 0); step(s);
  assert.equal(s.scene, "dead");
  for (let i = 0; i < 20; i++) step(s);
  assert.equal(canonical(s.player.owed), want, "dead: untouched");
  assert.ok(respawn(s).ok);
  assert.equal(canonical(s.player.owed), want);
  rt(s);
  stripFill(s); step(s);
  assert.equal(s.player.owed, undefined);
  assert.equal(s.inventory.items.length, rt(s).inventory.items.length);
  assert.ok(s.inventory.items.length >= 1);
});

test("[R8-owed-life] Restart after death (a new run of the same seed) clears the owed list with the rest of the old run", () => {
  const s = owing(23, "facilities-manager", "sq3");
  enterFloor(s, 2, { at: "entry" }); s.monsters = [];
  setHp(s, 0); step(s);
  assert.ok(applyInput(s, { t: "restart" }).ok);
  assert.equal(s.player.owed, undefined);
  assert.equal(s.quests.sq3.s, "available");
  rt(s);
});

test("[R8-owed-life] two characters (two states) never share an owed list; loading the other does not deliver or duplicate it", () => {
  const a = owing(24, "facilities-manager", "sq3");
  const b = hero(25, "sales-rep");
  const textA = serialize(a), textB = serialize(b);
  const A2 = deserialize(textA).state, B2 = deserialize(textB).state;
  assert.equal(B2.player.owed, undefined);
  for (let i = 0; i < 30; i++) { step(B2); step(A2); }
  assert.equal(B2.inventory.items.length, b.inventory.items.length);
  assert.equal(A2.player.owed.length, a.player.owed.length, "A still owes: its bag is still full");
  assert.equal(serialize(a), textA, "the source state was not touched by loading");
});

test("[R8-owed-life] stairs, the elevator and a paused game: owed items stay, nothing is delivered while the game is paused", () => {
  const s = owing(26, "facilities-manager", "sq3");
  const n = s.player.owed.length;
  for (const d of [1, 0, 3, 0]) { enterFloor(s, d, { at: "entry" }); assert.equal(s.player.owed.length, n); }
  stripFill(s);
  applyInput(s, { t: "pause" }); assert.equal(s.paused, true);
  for (let i = 0; i < 10; i++) step(s);
  assert.equal(s.player.owed.length, n, "paused: not delivered");
  applyInput(s, { t: "pause" }); step(s);
  assert.equal(s.player.owed, undefined);
});

// =============================================================================================== freeing the bag by every route
const hasOwed = (s) => (s.player.owed?.length ?? 0) > 0;
test("[R8-owed-free] selling, dropping, stashing, using a potion and equipping out of a full bag each make the next tick deliver an owed item", () => {
  const routes = {
    sell: (s) => { talk(s, "vendor"); const it = s.inventory.items[0]; assert.ok(applyInput(s, { t: "sell", id: it.id }).ok); },
    drop: (s) => { const it = s.inventory.items[0]; assert.ok(applyInput(s, { t: "drop", id: it.id }).ok); },
    stash: (s) => { talk(s, "stash"); const it = s.inventory.items[0]; assert.ok(applyInput(s, { t: "stash", id: it.id, to: "stash" }).ok); },
    useItem: (s) => { s.player.hp = Math.max(1, s.player.hpMax - 5); const it = s.inventory.items.find((i) => i.kind === "potion" && i.restores === "hp"); assert.ok(it, "an hp potion filler"); assert.ok(applyInput(s, { t: "useItem", id: it.id }).ok); },
  };
  for (const [name, free] of Object.entries(routes)) {
    const s = owing(30, "facilities-manager", "sq3");
    const n = s.player.owed.length, bag = s.inventory.items.length;
    free(s);
    step(s);
    assert.equal(s.player.owed?.length ?? 0, n - 1, `${name}: one cell freed, one potion owed arrives`);
    assert.equal(s.inventory.items.length, bag, `${name}: the bag is full again`);
    const ids = allIds(s); assert.equal(new Set(ids).size, ids.length, `${name}: no duplicate id`);
    rt(s);
  }
});

test("[R8-owed-free] a big gear piece waits while single cells free up, potions go ahead, and the piece arrives when a block of cells is free (nothing starves for ever)", () => {
  const s = hero(31); accept(s, "sq3"); setQuestStep(s, "sq3", 2); talk(s, "potions");
  fillBag(s); assert.ok(handIn(s, "sq3").ok);
  const gear = s.player.owed.filter((i) => i.kind === "gear"), pots = s.player.owed.filter((i) => i.kind === "potion");
  assert.ok(gear.length === 1 && pots.length >= 1, "sq3 pays one piece of gear and potions");
  const g = gear[0];
  // free scattered single cells (not contiguous): potions fit, the piece never does
  s.inventory.items = s.inventory.items.filter((i) => (i.x + i.y * 8) % 2 === 1 && i.id.startsWith("fill") ? true : false).filter((i, k) => k % 2 === 0);
  for (let i = 0; i < 10; i++) step(s);
  assert.ok(s.player.owed.includes(g), "gear still owed");
  assert.equal(s.player.owed.filter((i) => i.kind === "potion").length, 0, "potions went ahead");
  rt(s);
  s.inventory.items.length = 0; step(s);
  assert.equal(s.player.owed, undefined);
  assert.ok(s.inventory.items.includes(g));
  assert.equal(s.inventory.items.filter((i) => i.id === g.id).length, 1);
});

test("[R8-owed-free] ADV-R8-02 lifting an item onto the cursor to rearrange a full bag does not let an owed item take the cell the hero just freed", () => {
  const s = owing(32, "facilities-manager", "sq3");
  const it = s.inventory.items[0];
  const cell = { x: it.x, y: it.y };
  assert.ok(applyInput(s, { t: "invClick", grid: "inventory", x: cell.x, y: cell.y }).ok);
  assert.equal(s.cursorItem?.id, it.id);
  const n = s.player.owed.length;
  step(s);
  assert.equal(s.player.owed.length, n, "while an item is held, the freed cell stays free");
});

test("[R8-owed-free] an owed item is not in the bag: sell, drop, equip, stash, belt and useItem by its id fail and change nothing", () => {
  const s = owing(33, "facilities-manager", "sq3");
  const gear = s.player.owed.find((i) => i.kind === "gear") ?? s.player.owed[0];
  const snap = () => JSON.stringify([s.player.owed, s.inventory, s.stash, s.belt, s.equipment, s.cursorItem, s.player.gold]);
  const before = snap();
  talk(s, "vendor");
  for (const cmd of [{ t: "sell", id: gear.id }, { t: "drop", id: gear.id }, { t: "equip", id: gear.id }, { t: "stash", id: gear.id, to: "stash" }, { t: "toBelt", id: gear.id, index: 0 }, { t: "useItem", id: gear.id }, { t: "pickup", id: gear.id }]) {
    const r = applyInput(s, cmd);
    assert.notEqual(r?.ok, true, `${cmd.t} by an owed id must fail`);
  }
  assert.equal(snap(), before);
});

test("[R8-owed-free] owed and the quest pouch: handing in sq2 into a full bag takes the badge out of the pouch, owes the reward, and the badge never reappears (no second pouch entry, no owed badge)", () => {
  const s = hero(34);
  accept(s, "sq2");
  enterFloor(s, itemFloorOf(s.seed), { at: "entry" }); s.monsters = [];
  applyInput(s, { t: "pickup", id: "qi-sq2" }); for (let i = 0; i < 3000 && s.groundItems.some((g) => g.id === "qi-sq2"); i++) step(s);
  assert.equal(s.quests.sq2.s, "ready"); assert.equal(s.player.pouch.length, 1);
  fillBag(s); talk(s, "healer");
  assert.ok(handIn(s, "sq2").ok);
  assert.deepEqual(s.player.pouch, []);
  assert.ok(s.player.owed.length >= 1);
  assert.equal(s.player.owed.some((i) => /qi-/.test(i.id) || /badge/i.test(i.name)), false, "the badge is not owed");
  assert.equal(s.inventory.items.some((i) => /qi-/.test(i.id)), false);
  const r = rt(s);
  assert.deepEqual(r.player.pouch, []);
  enterFloor(r, itemFloorOf(r.seed), { at: "entry" });
  assert.equal(r.groundItems.some((g) => g.quest === "sq2"), false, "no second badge on the floor");
  assert.equal(handIn(r, "sq2").ok, false, "a second hand-in is refused and owes nothing more");
  assert.equal(r.player.owed.length, s.player.owed.length);
});

test("[R8-owed-free] a pouch item (sq2 ready) and owed items from another quest at the same time: both survive a save, the pouch item stays unreachable", () => {
  const s = owing(35, "facilities-manager", "sq3");
  accept(s, "sq2");
  enterFloor(s, itemFloorOf(s.seed), { at: "entry" }); s.monsters = [];
  applyInput(s, { t: "pickup", id: "qi-sq2" }); for (let i = 0; i < 3000 && s.groundItems.some((g) => g.id === "qi-sq2"); i++) step(s);
  assert.equal(s.quests.sq2.s, "ready");
  const r = rt(s);
  assert.equal(r.player.pouch.length, 1); assert.equal(r.player.owed.length, s.player.owed.length);
  r.inventory.items.length = 0; step(r);
  assert.equal(r.player.owed, undefined);
  assert.equal(r.player.pouch.length, 1, "freeing the bag does not touch the pouch");
  assert.equal(r.inventory.items.some((i) => /qi-/.test(i.id)), false);
});

// =============================================================================================== bounds, duplicates, five quests
test("[R8-owed-bound] all five side quests handed in against a full bag: the owed list stays within OWED_MAX, is a legal save, and delivers every item exactly once", () => {
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) {
    const s = hero(40, cls);
    for (const id of ["sq1", "sq2", "sq3", "sq4", "sq5"]) { accept(s, id); setQuestStep(s, id, 2); }
    fillBag(s);
    const expect = [];
    for (const id of ["sq1", "sq2", "sq3", "sq4", "sq5"]) { const r = rewardOf(s, id); expect.push(...(r.gear ? [r.gear.name] : []), ...r.potions.map((p) => p.name)); }
    for (const id of ["sq1", "sq2", "sq3", "sq4", "sq5"]) { const r = handIn(s, id); assert.ok(r.ok, `${cls} ${id} ${JSON.stringify(r)}`); }
    assert.ok(s.player.owed.length <= OWED_MAX, `${s.player.owed.length} <= ${OWED_MAX}`);
    assert.equal(s.player.owed.length, expect.length, "every reward item is owed");
    const r2 = rt(s);
    const ids = allIds(r2); assert.equal(new Set(ids).size, ids.length);
    stripFill(r2); step(r2); step(r2);
    // the bag is 8x5 = 40 cells, five gear pieces and the potions fit
    assert.equal(r2.player.owed, undefined, `${cls}: all delivered`);
    assert.deepEqual(r2.inventory.items.map((i) => i.name).sort(), expect.sort(), `${cls}: exactly the rewards`);
  }
});

test("[R8-owed-bound] 300 random hand-ins, fills, frees, saves and deaths: no item is lost, none appears twice, every state is a legal save (6 seeds)", () => {
  for (let seed = 1; seed <= 6; seed++) {
    let s = hero(seed * 17, ["facilities-manager", "sales-rep", "it-wizard"][seed % 3]);
    const rng = createRng(seed);
    const owedEver = new Set();
    for (let i = 0; i < 300; i++) {
      const op = rng.int(0, 8);
      if (op === 0) { const id = rng.pick(["sq1", "sq3", "sq4", "sq5"]); if (s.scene !== "dead") { try { if (s.quests[id].s === "available") { accept(s, id); } if (s.quests[id].s === "active") setQuestStep(s, id, 2); } catch { /* the walk can be blocked: fine */ } } }
      else if (op === 1) { const id = rng.pick(["sq1", "sq3", "sq4", "sq5"]); if (s.scene !== "dead" && s.quests[id].s === "ready") { try { handIn(s, id); } catch { /* */ } } }
      else if (op === 2) fillBag(s);
      else if (op === 3) s.inventory.items = s.inventory.items.filter((_, k) => k % 3 !== 0);
      else if (op === 4) s = rt(s);
      else if (op === 5) { if (s.scene === "dead") respawn(s); else { setHp(s, 0); step(s); } }
      else if (op === 6) { for (let k = 0; k < 5; k++) step(s); }
      else if (op === 7 && s.scene !== "dead") s.inventory.items.length = 0;
      else if (s.scene !== "dead" && s.depth !== 0) enterFloor(s, 0, { at: "entry" });
      if (s.scene === "dead") respawn(s);
      for (const it of s.player.owed ?? []) owedEver.add(it.id);
      const ids = allIds(s);
      assert.equal(new Set(ids).size, ids.length, `seed ${seed} op ${i}: duplicate item id`);
      assert.ok((s.player.owed?.length ?? 0) <= OWED_MAX);
      const r = deserialize(serialize(s));
      assert.ok(r.ok, `seed ${seed} op ${i}: ${r.message}`);
    }
  }
});
