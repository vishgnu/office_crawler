// R7-4.1 the two new side quests (AC-R-258-1..5): sq4 "The Misfiled Ledger" (item, stash keeper, floors 5 and 6) and sq5 "Slide Deck Surplus" (6 Consultants on floors 5 and 6, vendor).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, generateFloor, applyInput, config, content, snapshot, npcMarker, enterFloor, questRng, questSpot, rewardSummary, rewardOf } from "../src/core/index.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import { killMonster } from "../src/core/systems/damage.js";
import { buildGrid, flood } from "../src/core/grid.js";
import { setQuestStep } from "../src/core/cheats.js";
import { classes } from "../src/core/content/classes.js";

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
function accept(s, id) {
  const giver = content.quests[id].giver, n = s.floor.npcs.find((o) => o.id === giver);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  s.ui.dialog = null;
  assert.ok(applyInput(s, { t: "interact", id: giver }).ok);
  assert.ok(applyInput(s, { t: "questAccept", id }).ok);
  s.ui.dialog = null;
}
const lobby = (seed, ids, opts = {}) => { const s = newGame(seed, { start: "town", ...opts }); for (const id of ids) accept(s, id); return s; };
const quest = (s, id) => s.groundItems.filter((g) => g.quest === id);
const consultants = (s) => s.monsters.filter((m) => m.type === "consultant" && !m.summoned && m.ai !== "dead");
const roomOf = (f, t) => f.rooms.findIndex((r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);
function checkTile(s, t) {
  const f = s.floor, grid = buildGrid(f), { dist } = flood(grid, f.entry.x, f.entry.y);
  assert.ok(grid.walkable(t.x, t.y) && dist[t.y * f.w + t.x] >= 0, "walkable and reachable from the stairs");
  assert.ok(Math.max(Math.abs(t.x - f.entry.x), Math.abs(t.y - f.entry.y)) > config.safeRadius, "outside the safe radius");
  assert.ok(!(t.x === f.exit.x && t.y === f.exit.y) && !(t.x === f.entry.x && t.y === f.entry.y) && !f.spawns.some((sp) => sp.tile.x === t.x && sp.tile.y === t.y));
  const r = roomOf(f, t);
  assert.ok(r >= 0 && r !== roomOf(f, f.entry) && r !== roomOf(f, f.exit), "in a valid room (R-042)");
}
const full = (s) => { // a bag with no free cell
  for (let y = 0; y < s.inventory.h; y++) for (let x = 0; x < s.inventory.w; x++) if (!s.inventory.items.some((o) => o.x <= x && x < o.x + o.w && o.y <= y && y < o.y + o.h)) s.inventory.items.push({ id: `f${x}_${y}`, base: "x", name: "x", kind: "consumable", rarity: "normal", w: 1, h: 1, x, y });
};

test("AC-R-258-1 five side quests: sq4 from the stash keeper, sq5 from the vendor, no new NPC; markers loop over every quest of a giver", () => {
  assert.equal(config.quests.sideCount, 5);
  assert.equal(content.quests.sq4.giver, "stash"); assert.equal(content.quests.sq5.giver, "vendor");
  assert.deepEqual(Object.keys(content.npcs).sort(), ["healer", "potions", "stash", "vendor"]);
  const s = newGame(5, { start: "town" });
  s.quests.sq1 = { s: "completed", p: 8 };
  assert.equal(npcMarker(s, "vendor"), "available", "sq5 is still on offer");
  s.quests.sq5 = { s: "active", p: 0 }; assert.equal(npcMarker(s, "vendor"), "none");
  s.quests.sq1 = { s: "ready", p: 8 }; assert.equal(npcMarker(s, "vendor"), "handin");
  assert.equal(npcMarker(s, "stash"), "available");
  s.quests.sq4 = { s: "ready", p: 1 }; assert.equal(npcMarker(s, "stash"), "handin");
  const snap = snapshot(s).npcs; assert.deepEqual(snap.map((n) => [n.id, n.marker]), [["vendor", "handin"], ["healer", "available"], ["potions", "available"], ["stash", "handin"]]);
});

test("AC-R-258-2 sq4 active: exactly one ledger over floors 5 and 6, on the quest-stream floor, in a valid room, 100 seeds; with sq2 accepted too the sq2 draws are those of before R7-4", () => {
  for (const seed of SEEDS) {
    const one = lobby(seed, ["sq4"]), two = lobby(seed, ["sq2", "sq4"]), badge = lobby(seed, ["sq2"]);
    const want = config.quests.sq4.item.floors[questRng(seed, 4, 1, 0).int(0, config.quests.sq4.item.floors.length - 1)];
    assert.equal(itemFloorOf(seed, "sq4"), want);
    for (const s of [one, two]) {
      let found = 0;
      for (const d of [5, 6]) {
        enterFloor(s, d);
        const q = quest(s, "sq4"); found += q.length;
        if (q.length) { assert.equal(d, want); assert.equal(q[0].id, "qi-sq4"); assert.equal(q[0].label, "Misfiled Ledger"); assert.deepEqual(Object.keys(q[0]).sort(), ["border", "color", "id", "keep", "label", "mark", "quest", "rarity", "tile"]); checkTile(s, q[0].tile); }
      }
      assert.equal(found, 1, `seed ${seed}`);
    }
    // the sq2 draws: the same floor (the pre-R7-4 formula) and the same tile as without sq4
    const old = config.quests.item.floors[questRng(seed, 2, 1, 0).int(0, 1)];
    assert.equal(itemFloorOf(seed), old);
    enterFloor(two, old); enterFloor(badge, old);
    assert.deepEqual(quest(two, "sq2")[0].tile, quest(badge, "sq2")[0].tile, `seed ${seed}`);
  }
});

test("AC-R-258-2 no ledger unless sq4 is active; the pouch takes it with a full bag, next to the badge, each readying only its own quest", () => {
  for (const seed of SEEDS.slice(0, 15)) {
    const s = newGame(seed, { start: "town" });
    for (const d of [5, 6]) { enterFloor(s, d); assert.equal(quest(s, "sq4").length, 0); }
    for (const st of ["ready", "completed"]) { s.quests.sq4 = { s: st, p: 1 }; for (const d of [5, 6]) { enterFloor(s, d); assert.equal(quest(s, "sq4").length, 0); } }
  }
  const seed = 7, s = lobby(seed, ["sq2", "sq4"]);
  full(s);
  enterFloor(s, itemFloorOf(seed, "sq2"));
  s.player.tile = { ...quest(s, "sq2")[0].tile }; assert.ok(applyInput(s, { t: "pickup", id: "qi-sq2" }).ok);
  assert.deepEqual([s.quests.sq2.s, s.quests.sq4.s], ["ready", "active"]);
  enterFloor(s, itemFloorOf(seed, "sq4"));
  s.player.tile = { ...quest(s, "sq4")[0].tile }; assert.ok(applyInput(s, { t: "pickup", id: "qi-sq4" }).ok, "a full bag does not block a quest item");
  assert.deepEqual([s.quests.sq2.s, s.quests.sq4.s], ["ready", "ready"]);
  assert.deepEqual(s.player.pouch.map((e) => e.id).sort(), ["qi-sq2", "qi-sq4"]);
  assert.equal(quest(s, "sq4").length, 0);
  const ev = s.eventLog.filter((e) => e.type === "quest.item").map((e) => e.quest); assert.deepEqual(ev, ["sq2", "sq4"]);
});

test("AC-R-258-3 sq5: each Consultant killed on floors 5 and 6 after Accept counts, ready at the count; before Accept, on other floors and summoned ones do not", () => {
  const k = config.quests.sq5.kill;
  assert.deepEqual([k.monster, k.count, k.depths], ["consultant", 6, [5, 6]]);
  const s = newGame(4, { start: "town" });
  enterFloor(s, 5); for (const m of consultants(s).slice(0, 2)) killMonster(s, m); enterFloor(s, 0);
  accept(s, "sq5");
  assert.deepEqual(s.quests.sq5, { s: "active", p: 0 }, "kills before Accept do not count");
  enterFloor(s, 5);
  const [a, b, ...rest] = consultants(s);
  killMonster(s, a); assert.equal(s.quests.sq5.p, 1);
  const summoned = rest[0]; summoned.summoned = true; killMonster(s, summoned); assert.equal(s.quests.sq5.p, 1, "a summoned monster does not count");
  s.monsters.filter((m) => m.type === "zombie-intern" && m.ai !== "dead").slice(0, 1).forEach((m) => killMonster(s, m)); assert.equal(s.quests.sq5.p, 1, "another kind does not count");
  killMonster(s, b); assert.equal(s.quests.sq5.p, 2);
  assert.ok(s.eventLog.some((e) => e.type === "quest.progress" && e.id === "sq5" && e.p === 2 && e.goal === 6));
  enterFloor(s, 6);
  for (const m of consultants(s)) { if (s.quests.sq5.s === "ready") break; killMonster(s, m); }
  assert.equal(s.quests.sq5.s, "ready"); assert.equal(s.quests.sq5.p, 6);
  const last = s.eventLog.filter((e) => e.type === "quest.step" && e.id === "sq5").at(-1);
  assert.ok(last && last.next.startsWith("Return to"));
  const n = s.eventLog.length; for (const m of consultants(s)) killMonster(s, m);
  assert.equal(s.quests.sq5.p, 6, "no counting past the goal"); assert.ok(s.eventLog.length >= n);
});

test("AC-R-258-3 CR7-01 per quest: floors 5 and 6 cleared before the accept, the objective is still satisfiable (the killed Consultants come back, in spawn order, once)", () => {
  for (const seed of [1, 2, 3, 9]) {
    const s = newGame(seed, { start: "town" });
    for (const d of [5, 6]) { enterFloor(s, d); for (const m of s.monsters) if (m.ai !== "dead") killMonster(s, m); }
    enterFloor(s, 0);
    accept(s, "sq5");
    let alive = 0;
    for (const d of [5, 6]) { enterFloor(s, d); alive += consultants(s).length; }
    assert.ok(alive >= config.quests.sq5.kill.count, `seed ${seed}: ${alive} Consultants to kill`);
    for (const d of [5, 6]) { enterFloor(s, d); for (const m of consultants(s)) killMonster(s, m); }
    assert.equal(s.quests.sq5.s, "ready", `seed ${seed}`);
  }
});

test("AC-R-258-3 validity (ADV-R7-10): on 1000 seeds, once sq5 is accepted floors 5 and 6 hold at least `count` Consultants (the missing ones are placed on entry); not accepted, nothing is added", () => {
  let topped = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const gen = [5, 6].reduce((t, d) => t + generateFloor(seed, d).spawns.filter((sp) => sp.type === "consultant").length, 0);
    if (gen >= config.quests.sq5.kill.count && seed > 100) continue; // enough by generation (the 1000 seeds are counted without entering the floors; the first 100 run in full)
    if (gen < config.quests.sq5.kill.count) topped++;
    const s = lobby(seed, ["sq5"]);
    let n = 0;
    for (const d of [5, 6]) { enterFloor(s, d); n += s.monsters.filter((m) => m.type === "consultant" && !m.summoned).length; }
    assert.ok(n >= config.quests.sq5.kill.count, `seed ${seed}: ${n}`);
    if (gen >= config.quests.sq5.kill.count) assert.equal(n, gen, `seed ${seed}: nothing is added when the floors hold enough`);
    if (seed > 100 && seed % 7) continue;
    const u = newGame(seed, { start: "town" });
    let m = 0;
    for (const d of [5, 6]) { enterFloor(u, d); m += u.monsters.filter((x) => x.type === "consultant").length; }
    assert.equal(m, gen, `seed ${seed}: not accepted, the floors are as generated`);
  }
  assert.ok(topped >= 10, `the sample contains short seeds (102, 105, ...): ${topped}`);
});

test("ADV-R7-10 the top-up is deterministic, stable across re-entry and kills, and the quest finishes on short seeds (102, 105)", () => {
  for (const seed of [102, 105, 173]) {
    const a = lobby(seed, ["sq5"]), b = lobby(seed, ["sq5"]);
    for (const d of [5, 6]) { enterFloor(a, d); enterFloor(b, d); }
    assert.deepEqual(a.monsters.map((m) => [m.type, m.tile]), b.monsters.map((m) => [m.type, m.tile]), `seed ${seed}: same placement`);
    enterFloor(a, 5); enterFloor(a, 6); enterFloor(a, 6);
    assert.equal(consultants(a).length, consultants(b).length, `seed ${seed}: re-entry adds nothing more`);
    // play it out: kill everything on 5 and 6, leave and come back; the quest reaches ready
    for (const d of [5, 6, 5, 6]) { enterFloor(a, d); for (const m of consultants(a)) { if (a.quests.sq5.s === "ready") break; killMonster(a, m); } }
    assert.equal(a.quests.sq5.s, "ready", `seed ${seed}: ${a.quests.sq5.p}/6`);
  }
});

test("ADV-R7-10 every other kill quest of the content table (sq1 interns) is winnable on 1000 seeds without a top-up: the generator holds at least `count`", () => {
  for (const id of content.sideIds.filter((x) => x !== "sq5" && content.quests[x].objective.type === "kill")) {
    const k = config.quests[id]?.kill ?? config.quests.kill;
    for (let seed = 1; seed <= 1000; seed++) {
      const n = k.depths.reduce((t, d) => t + generateFloor(seed, d).spawns.filter((sp) => sp.type === k.monster).length, 0);
      assert.ok(n >= k.count, `${id} seed ${seed}: ${n}`);
    }
  }
});

test("AC-R-258-4 sq4 pays its gold, experience and potions and no gear; sq5 pays gold, experience and exactly one magic ring, amulet or belt; the same seed gives the same piece; summaries equal the payout", () => {
  const a = lobby(11, []); setQuestStep(a, "sq4", 2);
  const g = a.player.gold, x = a.player.xp, n = a.inventory.items.length, sp = a.player.skillPoints, ap = a.player.attrPoints;
  assert.deepEqual(setQuestStep(a, "sq4", 3), { ok: true });
  const sum4 = rewardSummary("sq4");
  assert.deepEqual([a.player.gold - g, a.player.xp - x, a.inventory.items.length - n], [105, 105, 2]);
  assert.deepEqual(sum4, { gold: 105, xp: 105, potions: 2, gear: null });
  assert.ok(a.inventory.items.slice(n).every((i) => i.kind === "potion"), "no gear");
  assert.deepEqual([a.player.skillPoints, a.player.attrPoints], [sp, ap], "no skill or attribute point");
  for (const cls of classes) for (const seed of [1, 5, 9, 30]) {
    const s = newGame(seed, { class: cls.id, start: "town" }); setQuestStep(s, "sq5", 2);
    const n0 = s.inventory.items.length, g0 = s.player.gold, x0 = s.player.xp, sp = s.player.skillPoints, ap = s.player.attrPoints, lv = s.player.level;
    assert.deepEqual(setQuestStep(s, "sq5", 3), { ok: true });
    assert.equal(s.inventory.items.length - n0, 1, "exactly one item");
    const it = s.inventory.items.at(-1), sum = rewardSummary("sq5");
    assert.equal(it.rarity, "magic"); assert.ok(config.quests.sq5.slots.includes(it.slot), it.slot); assert.ok(!["weapon", "body", "head", "hands", "feet"].includes(it.slot));
    assert.equal(it.ilvl, config.quests.sq5.gearFloor * config.ilvlPerDepth);
    assert.deepEqual([s.player.gold - g0, s.player.xp - x0], [sum.gold, sum.xp]); assert.deepEqual([sum.gold, sum.xp, sum.potions], [120, 120, 0]);
    assert.equal(s.player.level, lv); assert.equal(s.player.skillPoints, sp); assert.equal(s.player.attrPoints, ap, "no skill or attribute point");
    const again = rewardOf(newGame(seed, { class: cls.id, start: "town" }), "sq5");
    assert.equal(again.gear.name, it.name, "the same seed and class give the same piece (CR7-06)");
  }
});

test("AC-R-258-4 a full bag refuses both hand-ins atomically (nothing paid, quest stays ready) and a retry after room pays the same piece", () => {
  for (const id of ["sq4", "sq5"]) {
    const s = newGame(3, { start: "town" }); setQuestStep(s, id, 2); full(s);
    const snap = JSON.stringify({ g: s.player.gold, x: s.player.xp, inv: s.inventory, q: s.quests, p: s.player.pouch });
    const r = setQuestStep(s, id, 3);
    assert.deepEqual([r.ok, r.error], [false, "bagFull"]);
    assert.equal(JSON.stringify({ g: s.player.gold, x: s.player.xp, inv: s.inventory, q: s.quests, p: s.player.pouch }), snap, `${id}: nothing changed`);
    assert.equal(s.quests[id].s, "ready");
    if (id === "sq4") assert.equal(s.player.pouch.length, 1, "the ledger stays in the pouch");
    s.inventory.items = [];
    assert.deepEqual(setQuestStep(s, id, 3), { ok: true });
  }
});

test("AC-R-258-4 over 200 seeds the mean affix count of the sq5 reward is below that of the sq2 and sq3 rewards", () => {
  const mean = (id) => { let t = 0; for (let seed = 1; seed <= 200; seed++) t += rewardOf(newGame(seed, { start: "town" }), id).gear.affixes.length; return t / 200; };
  const m5 = mean("sq5");
  assert.ok(m5 < mean("sq2") && m5 < mean("sq3"), `sq5 ${m5}`);
  for (let seed = 1; seed <= 200; seed++) assert.equal(rewardOf(newGame(seed, { start: "town" }), "sq5").gear.rarity, "magic");
});

test("AC-R-258-5 the new experience stays below the cap (newXpShare of the level-up cost at balanceLevel); the rewards are class independent except the sq5 piece's affix tag", () => {
  const c = config.quests, xp = (id) => rewardSummary(id).xp;
  const sum = xp("main") + xp("main2") + xp("sq4") + xp("sq5");
  assert.equal(sum, 400);
  assert.ok(sum <= c.newXpShare * config.xpTable[c.balanceLevel - 1], `${sum} of ${config.xpTable[c.balanceLevel - 1]}`);
  assert.deepEqual([c.newXpShare, c.balanceLevel], [0.10, 12]);
  for (const seed of [1, 2, 3, 4]) {
    const by = classes.map((k) => { const s = newGame(seed, { class: k.id, start: "town" }); return ["sq4", "sq5"].map((id) => { const r = rewardOf(s, id); return [r.gold, r.xp, JSON.stringify(r.potions)]; }); });
    assert.deepEqual(by[1], by[0]); assert.deepEqual(by[2], by[0]);
    for (const k of classes) { const r = rewardOf(newGame(seed, { class: k.id, start: "town" }), "sq5"); assert.deepEqual([r.gear.rarity, config.quests.sq5.slots.includes(r.gear.slot)], ["magic", true]); }
  }
});
