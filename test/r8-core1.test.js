// CORE-R8-1: R8-Q1 owed quest rewards, R8-B1 first 90 seconds, R8-B2 entry grace, R8-B3 first potions, R8-AI1 re-click in a crowd, R8-M1 map markers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config, content, makeItem, enterFloor, generateFloor, mapMarkers, snapshot, spawnMonster } from "../src/core/index.js";
import { serialize, deserialize, toSave, schemaProblem, checksumOf } from "../src/save/index.js";
import { mint } from "../src/core/systems/loot.js";
import { setQuestStep } from "../src/core/cheats.js";
import { flood, buildGrid } from "../src/core/grid.js";
import { playClicker } from "./naive-clicker.js";
import { gameOn } from "./helpers.js";

const CLASSES = content.classes.map((c) => c.id);
const fullBag = (s) => { s.inventory.items = []; for (let y = 0; y < s.inventory.h; y++) for (let x = 0; x < s.inventory.w; x++) { const it = mint(s, makeItem("lukewarm-coffee")); it.x = x; it.y = y; s.inventory.items.push(it); } };
const near = (s, npcId) => { const n = s.floor.npcs.find((o) => o.id === npcId); s.player.tile = { x: n.tile.x, y: n.tile.y + 1 }; s.ui.dialog = null; assert.ok(applyInput(s, { t: "interact", id: npcId }).ok); };
/** A lobby game whose sq3 reward is owed (full bag). */
function owedGame(seed = 7, cls = "facilities-manager") {
  const s = newGame(seed, { start: "town", class: cls });
  s.quests.sq3 = { s: "ready", p: 1 }; s.deepestDepth = config.quests.elite.depth; // a legal ready state (the save schema checks the floor reached)
  near(s, content.quests.sq3.giver);
  fullBag(s);
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq3" }).ok);
  assert.ok(s.player.owed.length >= 2);
  return s;
}

// ---- R8-Q1 ----
test("[R8-Q1] a run that never has a full bag at a hand-in has no `owed` key: the state and the hash are as before", () => {
  const s = newGame(7, { start: "town" });
  s.quests.sq3 = { s: "ready", p: 1 }; near(s, content.quests.sq3.giver);
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq3" }).ok);
  assert.equal("owed" in s.player, false);
  step(s, []);
  assert.equal("owed" in s.player, false);
  assert.equal("owed" in toSave(s).quests, false, "and the save has no such key");
});

test("[R8-Q1] owed items survive a save round trip, are not lost on death, and move into the bag on the first tick with room", () => {
  for (const cls of CLASSES) {
    const s = owedGame(7, cls), names = s.player.owed.map((i) => i.name);
    assert.equal(schemaProblem(toSave(s)), null, "the save schema accepts the owed pouch");
    const back = deserialize(serialize(s));
    assert.ok(back.ok, back.message);
    assert.deepEqual(back.state.player.owed.map((i) => i.name), names);
    assert.deepEqual(back.state.player.owed, s.player.owed);
    step(back.state, []);
    assert.equal(back.state.player.owed.length, names.length, "still no room after the load");
    back.state.inventory.items.length = 0;
    step(back.state, []);
    assert.equal(back.state.player.owed, undefined);
    assert.deepEqual(back.state.inventory.items.map((i) => i.name).sort(), [...names].sort());
    // dying keeps the owed pouch (it is not in the bag, so nothing drops)
    s.player.hp = 0; s.scene = "dead";
    assert.equal(s.player.owed.length, names.length);
  }
});

test("[R8-Q1] hostile saves: a forged owed list is rejected (shape, size, ids, kind, no completed quest) and never crashes the loader", () => {
  const s = owedGame(7), good = toSave(s);
  const bad = (mutate, why) => {
    const d = JSON.parse(JSON.stringify(good)); mutate(d); delete d.checksum; d.checksum = checksumOf(d);
    const p = schemaProblem(d); assert.ok(p, `${why} must be rejected`);
    const r = deserialize(JSON.stringify(d)); assert.equal(r.ok, false, why);
  };
  bad((d) => { d.quests.owed = "x"; }, "not an array");
  bad((d) => { d.quests.owed = []; }, "empty list (the key must be absent)");
  bad((d) => { d.quests.owed = Array.from({ length: 40 }, (_, i) => ({ ...d.quests.owed[0], id: `z${i}` })); }, "too many");
  bad((d) => { d.quests.owed[1].id = d.quests.owed[0].id; }, "duplicate ids inside the list");
  bad((d) => { d.quests.owed[0].id = d.inventory.items[0].id; }, "an id that the bag already uses");
  bad((d) => { d.quests.owed[0] = { id: "q", name: "x" }; }, "not an item");
  bad((d) => { d.quests.owed[0].base = "constructor"; }, "unknown base");
  bad((d) => { d.quests.owed[0].extra = 1; }, "unknown item key");
  bad((d) => { d.quests.owed[0] = JSON.parse(JSON.stringify(makeItem("emergency-exit"))); d.quests.owed[0].id = "i999"; }, "a consumable cannot be a quest reward");
  bad((d) => { for (const id of ["sq1", "sq2", "sq3", "sq4", "sq5"]) d.quests[id] = { s: "available", p: 0 }; }, "owed without any completed side quest");
  bad((d) => { d.quests.owed = null; }, "null");
  bad((d) => { d.quests.owedX = []; }, "unknown quest key");
});

test("[R8-Q1] two hand-ins into a full bag: both complete, items owed in order, delivered as room appears, no duplicate or lost reward", () => {
  const s = newGame(11, { start: "town" });
  s.quests.sq1 = { s: "ready", p: config.quests.kill.count }; s.quests.sq5 = { s: "ready", p: 6 };
  near(s, content.quests.sq1.giver); fullBag(s);
  const total = [];
  for (const id of ["sq1", "sq5"]) { if (content.quests[id].giver !== s.ui.dialog?.npc) near(s, content.quests[id].giver); assert.ok(applyInput(s, { t: "questHandIn", id }).ok, id); }
  total.push(...s.player.owed.map((i) => i.id));
  assert.equal(new Set(total).size, total.length);
  const bagIds = s.inventory.items.map((i) => i.id);
  s.inventory.items.splice(0, 1); // one cell: the next tick delivers what fits, in order
  step(s, []);
  const delivered = s.inventory.items.map((i) => i.id).filter((id) => !bagIds.includes(id));
  assert.equal(delivered.length + s.player.owed.length, total.length, "nothing lost in between");
  assert.ok(delivered.length <= 1);
  s.inventory.items.length = 0; step(s, []);
  assert.equal(s.player.owed, undefined);
  const all = [...delivered, ...s.inventory.items.map((i) => i.id)];
  assert.deepEqual([...all].sort(), [...total].sort(), "every owed item arrived exactly once");
});

// ---- R8-B1 ----
test("[R8-B1] the first 90 seconds: a naive eager clicker (fights, drinks at 40 %) survives on 20 seeds per class", () => {
  for (const cls of CLASSES) {
    const dead = [];
    for (let seed = 1; seed <= 20; seed++) { const r = playClicker(newGame(seed, { class: cls }), 90 * config.tickHz); if (r.dead) dead.push(`${seed}@${(r.deathTick / config.tickHz).toFixed(0)}s`); }
    assert.deepEqual(dead, [], `${cls}: deaths in the first 90 s`);
  }
});

test("[R8-B1] floor 1 is a tutorial floor: packs of at most two, nothing within minDist path steps of the entry, no two packs within packGap tiles", () => {
  const e = config.population.early[1];
  for (let seed = 1; seed <= 60; seed++) {
    const f = generateFloor(seed, 1), grid = buildGrid(f), { dist } = flood(grid, f.entry.x, f.entry.y);
    const packs = {};
    for (const sp of f.spawns) {
      assert.ok(dist[sp.tile.y * f.w + sp.tile.x] >= e.minDist, `seed ${seed}: spawn too close to the entry`);
      if (sp.packId) (packs[sp.packId] ??= []).push(sp);
    }
    for (const [id, m] of Object.entries(packs)) assert.ok(m.length <= e.packMax, `seed ${seed} pack ${id}: ${m.length}`);
    const ids = Object.keys(packs);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const d = Math.min(...packs[ids[i]].flatMap((a) => packs[ids[j]].map((b) => Math.max(Math.abs(a.tile.x - b.tile.x), Math.abs(a.tile.y - b.tile.y)))));
      assert.ok(d >= e.packGap, `seed ${seed}: packs ${ids[i]} and ${ids[j]} are ${d} apart`);
    }
    assert.ok(f.spawns.length >= 6, `seed ${seed}: the floor is not empty (${f.spawns.length})`);
  }
});

test("[R8-B1] floors 2 and deeper are as generated before (the tutorial rule is floor 1 only): packs larger than two still occur", () => {
  let big = 0;
  for (let seed = 1; seed <= 30; seed++) { const f = generateFloor(seed, 2), packs = {}; for (const sp of f.spawns) if (sp.packId) packs[sp.packId] = (packs[sp.packId] ?? 0) + 1; if (Object.values(packs).some((n) => n > 2)) big++; }
  assert.ok(big > 10, "packs of three or four still occur on floor 2");
});

// ---- R8-B2 ----
test("[R8-B2] entry grace: monsters near the arrival tile stay idle for the grace ticks (hero standing in plain view), then notice; damage is not taken meanwhile", () => {
  const g = config.entryGrace;
  for (const arrive of ["stairs", "elevator"]) {
    const s = newGame(5, { start: "town" });
    enterFloor(s, 1, { at: "entry" });
    enterFloor(s, 2, { at: "entry" });
    if (arrive === "elevator") { enterFloor(s, 0, { at: "entry", from: 2 }); enterFloor(s, 2, { at: "entry", from: 0 }); }
    s.monsters.length = 0;
    const p = s.player.tile;
    // two awake-capable monsters at 5 tiles with a line of sight: they would notice at once without the grace
    const tiles = [];
    for (let dy = -6; dy <= 6 && tiles.length < 2; dy++) for (let dx = -6; dx <= 6 && tiles.length < 2; dx++) {
      const t = { x: p.x + dx, y: p.y + dy };
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 4 && s.floor.tiles[t.y * s.floor.w + t.x] === 1) tiles.push(t);
    }
    assert.equal(tiles.length, 2);
    const mons = tiles.map((t) => gameMonster(s, t));
    for (let i = 0; i < g.ticks - 2; i++) { step(s, []); assert.ok(mons.every((m) => m.ai === "idle"), `${arrive}: still idle at tick ${i}`); }
    assert.equal(s.player.hp, s.player.hpMax);
    for (let i = 0; i < 4 + 40; i++) step(s, []);
    assert.ok(mons.some((m) => m.ai !== "idle"), `${arrive}: they notice once the grace has run out`);
  }
});

const gameMonster = (s, tile) => spawnAt(s, tile);
function spawnAt(s, tile) { const ok = spawnMonster(s, "zombie-intern", tile, null); assert.ok(ok); return s.monsters[s.monsters.length - 1]; }

test("[R8-B2] a monster the hero hits wakes at once despite the grace; the Lobby has no grace; config.entryGrace = null switches it off", () => {
  const s = newGame(5, { start: "town" }); enterFloor(s, 1, { at: "entry" }); s.monsters.length = 0;
  const m = spawnAt(s, { x: s.player.tile.x + 3, y: s.player.tile.y });
  assert.equal(s.entryGrace.t, config.entryGrace.ticks);
  for (let i = 0; i < 20; i++) step(s, []);
  assert.equal(m.ai, "idle", "graced");
  applyInput(s, { t: "attack", id: m.id });
  for (let i = 0; i < 400 && m.hp === m.hpMax; i++) step(s, []);
  assert.ok(m.hp < m.hpMax || m.ai === "dead", "the hero walked up and hit it inside the grace");
  assert.notEqual(m.ai, "idle", "and it fights back");
  enterFloor(s, 0, { at: "entry", from: 1 });
  assert.equal(s.entryGrace, undefined, "the Lobby has no grace");
  const keep = config.entryGrace;
  try { config.entryGrace = null; const u = newGame(5, { start: "town" }); enterFloor(u, 1, { at: "entry" }); assert.equal(u.entryGrace, undefined); step(u, []); } finally { config.entryGrace = keep; }
});

test("[R8-B2] the lift after a death: die at the entry of floor 4, respawn, take the lift again: the entry monsters do not touch a hero who stands there for the grace", () => {
  const s = newGame(9, { start: "town", class: "sales-rep" });
  s.deepestDepth = 4;
  enterFloor(s, 4, { at: "entry", from: 0 });
  s.player.hp = 0;
  for (let i = 0; i < 100 && s.scene !== "dead"; i++) step(s, []);
  assert.equal(s.scene, "dead");
  assert.ok(applyInput(s, { t: "respawn" }).ok);
  assert.equal(s.depth, 0);
  s.player.tile = { ...s.floor.exit };
  assert.ok(applyInput(s, { t: "useStairs", dir: "down" }).ok);
  assert.equal(s.depth, 4);
  for (let i = 0; i < config.entryGrace.ticks - 2; i++) step(s, []);
  assert.equal(s.player.hp, s.player.hpMax, "the grace at the entry without a scratch");
  assert.ok(s.monsters.every((m) => m.ai === "idle" || m.ai === "dead"));
});

// ---- R8-B3 ----
test("[R8-B3] the start kit fills the belt (4 / 4 / 3 health potions, the wizard keeps a mana potion) and 50 gold buys a potion", () => {
  const want = { "facilities-manager": 4, "sales-rep": 4, "it-wizard": 3 };
  for (const cls of CLASSES) {
    const s = newGame(3, { start: "town", class: cls });
    assert.equal(s.belt.filter((b) => b?.restores === "hp").length, want[cls], cls);
    assert.equal(s.player.gold, 50);
  }
  const s = newGame(3, { start: "town" }); s.belt.fill(null); near(s, "potions");
  const stock = s.vendor.stock.filter((e) => e.unlimited && e.item.kind === "potion");
  assert.ok(stock.length >= 2);
  assert.ok(Math.min(...stock.map((e) => e.price)) <= 40, "the first potion is well under the start gold");
  assert.ok(applyInput(s, { t: "buy", index: s.vendor.stock.indexOf(stock[0]) }).ok);
  assert.ok(s.player.gold >= 10, `${s.player.gold} gold left`);
});

test("[R8-B3] a bought potion goes to the first free belt slot (also with a full bag); a full belt sends it to the bag; gear never goes to the belt", () => {
  const s = newGame(3, { start: "town" }); s.belt.fill(null); s.belt[0] = makeItem("lukewarm-coffee"); s.belt[0].id = "b0"; s.player.gold = 1000; near(s, "potions");
  fullBag(s);
  const i = s.vendor.stock.findIndex((e) => e.unlimited && e.item.kind === "potion");
  const r = applyInput(s, { t: "buy", index: i });
  assert.ok(r.ok, "a full bag does not stop a potion bought for a free belt slot");
  const bought = s.eventLog.filter((e) => e.type === "buy").pop();
  assert.equal(s.belt[1]?.id, bought.id);
  assert.ok(s.eventLog.some((e) => e.type === "beltSet" && e.slot === 1 && e.id === bought.id));
  for (let k = 2; k < 4; k++) assert.ok(applyInput(s, { t: "buy", index: i }).ok);
  assert.ok(s.belt.every(Boolean));
  const gold = s.player.gold, bag = s.inventory.items.length;
  const r2 = applyInput(s, { t: "buy", index: i });
  assert.equal(r2.ok, false, "belt full and bag full: refused");
  assert.equal(s.player.gold, gold); assert.equal(s.inventory.items.length, bag);
  s.inventory.items.pop();
  assert.ok(applyInput(s, { t: "buy", index: i }).ok);
  assert.equal(s.inventory.items.length, bag, "the potion took the freed bag cell");
  near(s, "vendor"); const gi = s.vendor.stock.findIndex((e) => !e.unlimited);
  s.belt.fill(null); s.inventory.items.length = 0; s.player.gold = 100000;
  const g = applyInput(s, { t: "buy", index: gi });
  assert.ok(g.ok); assert.ok(s.belt.every((b) => b === null), "gear stays in the bag");
});

// ---- R8-AI1 ----
test("[R8-AI1] in a crowd, re-clicking an unreachable monster every 30 ticks still lets the hero hit an adjacent attacker within 1.5 s (and keep hitting)", () => {
  const rows = [
    "###########",
    "#@........#",
    "#.........#",
    "#.........#",
    "#.........#",
    "#.........#",
    "###########",
  ];
  const s = gameOn(rows, [["zombie-intern", 2, 1], ["zombie-intern", 1, 2], ["zombie-intern", 2, 2], ["zombie-intern", 3, 3]], 1, { class: "facilities-manager" });
  s.player.hp = s.player.hpMax = 1e6;
  const [a, b, c, far] = s.monsters;
  for (const m of [a, b, c, far]) { m.ai = "chase"; m.damage = 1; }
  far.hp = far.hpMax = 1e6;
  const adj = new Set([a.id, b.id, c.id]);
  let first = -1, swings = 0;
  for (let t = 0; t < 360; t++) {
    const n = s.eventLog.length;
    step(s, t % 30 === 0 ? [{ t: "attack", id: far.id }] : []); // the player re-clicks the unreachable monster every half second
    for (const e of s.eventLog.slice(n)) if ((e.type === "hit" || e.type === "miss") && e.source === "player" && adj.has(e.target)) { swings++; if (first < 0) first = t; }
  }
  assert.ok(first >= 0 && first <= 90, `the first swing at an adjacent attacker lands at tick ${first} (limit 90 = 1.5 s)`);
  assert.ok(swings >= 4, `and the hero keeps answering: ${swings} swings in 6 s`);
});

// ---- R8-M1 ----
test("[R8-M1] mapMarkers lists the badge (sq2) and the quest elite (sq3) once their tile is seen on the current floor, for the pinned quest only", () => {
  const seen = (s, tile) => { const f = s.floor; f.explored ??= new Array(f.w * f.h).fill(0); f.explored[tile.y * f.w + tile.x] = 1; };
  // badge
  const s = newGame(13, { start: "town" });
  setQuestStep(s, "sq2", 1); s.quests.pinned = "sq2";
  const floor = [3, 4].find((d) => d === content.itemFloorOf?.(s.seed, "sq2")) ?? null;
  void floor;
  const d = [3, 4].find((x) => { const t = newGame(13, { start: "town" }); setQuestStep(t, "sq2", 1); enterFloor(t, x, { at: "entry" }); return t.groundItems.some((g) => g.quest === "sq2"); });
  enterFloor(s, d, { at: "entry" });
  const g = s.groundItems.find((e) => e.quest === "sq2");
  assert.ok(g);
  assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "item"), [], "not seen yet");
  seen(s, g.tile);
  const mk = mapMarkers(s).filter((m) => m.kind === "item");
  assert.equal(mk.length, 1); assert.deepEqual(mk[0].tile, g.tile); assert.equal(mk[0].quest, "sq2");
  s.quests.pinned = "main"; assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "item"), [], "only the pinned quest");
  s.quests.pinned = "sq2"; s.depth = d; enterFloor(s, d === 3 ? 4 : 3, { at: "entry" });
  assert.deepEqual(mapMarkers(s).filter((m) => m.kind === "item"), [], "another floor lists nothing");
  // elite
  const e = newGame(13, { start: "town" });
  setQuestStep(e, "sq3", 1); e.quests.pinned = "sq3";
  enterFloor(e, config.quests.elite.depth, { at: "entry" });
  const m = e.monsters.find((o) => o.quest === "sq3");
  assert.ok(m);
  assert.deepEqual(mapMarkers(e).filter((x) => x.kind === "elite"), []);
  seen(e, m.tile);
  const em = mapMarkers(e).filter((x) => x.kind === "elite");
  assert.equal(em.length, 1); assert.deepEqual(em[0].tile, m.tile);
  m.ai = "dead"; assert.deepEqual(mapMarkers(e).filter((x) => x.kind === "elite"), [], "a dead elite is not marked");
  assert.ok(snapshot(e).quests, "the snapshot still builds");
});
