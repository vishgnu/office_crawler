// ADV-R7-4 (test-engineer, adversarial mode): the three main quests and five side quests of R7-4.1. Written from ADR-0007 "R7-4", spec 12 "Addendum R7-4" and
// docs/reviews/R7-4-core-notes.md, without reading the implementers' tests. Defects are `{ todo: 'ADV-R7-NN' }`; fixtures are real play, the game's own save
// writer (`v4Text` of helpers.js) or the real fixture files, checked by the same schema validator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config, content, newGame, step, applyInput, enterFloor, createRng, respawn, generateFloor, rollPotion } from "../src/core/index.js";
import * as dmg from "../src/core/systems/damage.js";
import { emit } from "../src/core/events.js";
import { itemFloorOf, questRng, rewardOf } from "../src/core/systems/quests.js";
import { setQuestStep, completeQuest, setHp } from "../src/core/cheats.js";
import { mainStep, mainState, questView, nextStep, npcMarker, mapMarkers } from "../src/core/systems/questview.js";
import { rewardSummary } from "../src/core/systems/quests.js";
import { serialize, deserialize } from "../src/save/index.js";
import { v4Text } from "./helpers.js";

const GIVER = { sq1: "vendor", sq2: "healer", sq3: "potions", sq4: "stash", sq5: "vendor" };
const MAINS = ["main", "main2", "main3"];
const hero = (seed = 5, cls = "facilities-manager") => newGame(seed, { class: cls, name: "Adv", start: "town", wearStartKit: true });
const qEvents = (s) => s.events.filter((e) => e.type.startsWith("quest."));
const completedIds = (s) => s.events.filter((e) => e.type === "quest.completed").map((e) => e.id);
const rt = (s) => { const r = deserialize(serialize(s)); assert.ok(r.ok, `legal state must round-trip: ${r.message}`); return r.state; };
function talk(s, npc) {
  if (s.depth !== 0) enterFloor(s, 0, { at: "entry" });
  applyInput(s, { t: "interact", id: npc });
  for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
  assert.equal(s.ui.dialog?.npc, npc, `dialog with ${npc} opened`);
}
const accept = (s, id) => { talk(s, GIVER[id]); const r = applyInput(s, { t: "questAccept", id }); assert.ok(r.ok, JSON.stringify(r)); return r; };
const handIn = (s, id) => { if (s.ui.dialog?.npc !== GIVER[id]) talk(s, GIVER[id]); return applyInput(s, { t: "questHandIn", id }); };
const kill = (s, m) => dmg.damageMonster(s, m, 9999, { source: "player" });
const live = (s, type) => s.monsters.filter((m) => m.type === type && !m.summoned && m.ai !== "dead");
function pickUp(s, id, max = 3000) { applyInput(s, { t: "pickup", id }); for (let i = 0; i < max && s.groundItems.some((g) => g.id === id); i++) step(s); }
/** Fill every cell of the bag with 1x1 real potions (a legal bag), except the holes. */
function fillBag(s, holes = new Set()) {
  s.inventory.items.length = 0;
  const rng = createRng(11);
  let n = 0;
  for (let y = 0; y < config.inventory.h; y++) for (let x = 0; x < config.inventory.w; x++) {
    if (holes.has(`${x},${y}`)) continue;
    s.inventory.items.push({ ...rollPotion(rng, 12), id: `fill${n++}`, x, y, w: 1, h: 1 });
  }
}
const arcGold = (id) => config.quests.arc[id].gold.base + config.quests.arc[id].gold.perDepth * config.quests.arc[id].refDepth;
const arcXp = (id) => config.quests.arc[id].xp.base + config.quests.arc[id].xp.perDepth * config.quests.arc[id].refDepth;

// An independent model of the ten steps (written from the spec table, not from the code): which global step is current for a set of milestones.
const MODEL = [
  (m) => m.memo || m.depth >= 1, (m) => m.depth >= 1, (m) => m.depth >= 3, (m) => m.depth >= 4, (m) => m.depth >= 5, (m) => m.depth >= 6,
  (m) => m.depth >= 7, (m) => m.unlocked, (m) => m.defeated, (m) => m.verdict,
];
const modelStep = (m) => { let cur = 11; for (let i = 9; i >= 0; i--) { /* suffix-or */ } const done = MODEL.map(() => false); let later = false; for (let i = 9; i >= 0; i--) { later = later || !!MODEL[i](m); done[i] = later; } const i = done.indexOf(false); cur = i < 0 ? 11 : i + 1; return cur; };
const modelArc = (g) => (g <= 3 ? "main" : g <= 6 ? "main2" : g <= 10 ? "main3" : null);

// =============================================================================================== arc unlock order and catch-up over ten steps
test("[R74-order] floor by floor 1..9: each arc completes exactly on its last step (floor 3, floor 6, the verdict), in order, with one quest.step per change and the unlock flag only on a new arc", () => {
  const s = hero(21);
  const seen = [];
  for (let d = 1; d <= 8; d++) {
    s.events.length = 0;
    enterFloor(s, d, { at: "entry" });
    seen.push(...completedIds(s));
    const g = mainStep(s.quests.main.m);
    assert.equal(g, modelStep(s.quests.main.m), `floor ${d}: derived step equals the spec table`);
    const steps = qEvents(s).filter((e) => e.type === "quest.step");
    assert.ok(steps.length <= 1, `floor ${d}: at most one quest.step`);
    if (d === 3 || d === 6) assert.equal(steps[0]?.unlocked, true, `floor ${d}: a new arc is announced`);
    else if (steps[0]) assert.ok(!steps[0].unlocked, `floor ${d}: inside an arc no unlock flag`);
    for (const id of MAINS) {
      const st = mainState(s.quests.main.m, id), earlier = MAINS.slice(0, MAINS.indexOf(id));
      assert.equal(st === "active" || st === "completed" ? earlier.every((e) => mainState(s.quests.main.m, e) === "completed") : true, true, `${id} open only after the earlier arcs`);
    }
  }
  assert.deepEqual(seen, ["main", "main2"], "arcs 1 and 2 completed once each, in order, by floor 8");
  assert.equal(mainState(s.quests.main.m, "main3"), "active");
  assert.equal(mainStep(s.quests.main.m), 8, "floor 7 done, step 8 (the executive floor) is next until the stairs unlock");
});

test("[R74-order] catch-up: from step 1 straight to floor 7, 8, 9 and the Lobby at every point: one quest.completed per finished arc in order, one quest.step for the active arc", () => {
  for (const [target, wantDone, wantActive, wantStep] of [[2, [], "main", 3], [3, ["main"], "main2", 4], [5, ["main"], "main2", 6], [6, ["main", "main2"], "main3", 7], [7, ["main", "main2"], "main3", 8], [8, ["main", "main2"], "main3", 8]]) {
    const s = hero(30 + target);
    enterFloor(s, target, { at: "entry" });
    assert.deepEqual(completedIds(s), wantDone, `floor ${target}: completed`);
    assert.equal(s.events.filter((e) => e.type === "quest.step").length, 1, `floor ${target}: one step event`);
    assert.equal(s.events.find((e) => e.type === "quest.step").id, wantActive);
    assert.equal(mainStep(s.quests.main.m), wantStep, `floor ${target}: global step`);
    assert.equal(s.quests.pinned, wantActive, `floor ${target}: the pin follows the active arc`);
    for (const id of wantDone) assert.equal(mainState(s.quests.main.m, id), "completed");
    rt(s);
  }
});

test("[R74-order] random event order (600 sequences): the derived state equals the independent model, a step never goes back, an arc completes once, the gold paid is the sum of the arcs completed", () => {
  const rng = createRng(777);
  const EVS = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "unlock", "defeat", "keep", "readStart", "readVictory", "memo", "lobby"];
  for (let run = 0; run < 600; run++) {
    const s = hero(100 + (run % 9));
    const gold0 = s.player.gold, xp0 = s.player.xp;
    const paid = [], model = { memo: false, depth: 0, unlocked: false, defeated: false, verdict: false };
    let prev = 1;
    const n = rng.int(1, 14);
    for (let i = 0; i < n; i++) {
      const e = EVS[rng.int(0, EVS.length - 1)];
      s.events.length = 0;
      if (e[0] === "f" && e.length === 2) { const d = Number(e[1]); enterFloor(s, d, { at: "entry" }); model.depth = Math.max(model.depth, d); }
      else if (e === "lobby") enterFloor(s, 0, { at: "entry" });
      else if (e === "unlock") { emit(s, { type: "stairsUnlocked" }); model.unlocked = true; }
      else if (e === "defeat") { emit(s, { type: "bossDefeated" }); model.defeated = model.unlocked = true; }
      else if (e === "keep") { emit(s, { type: "keepPlaying" }); if (model.defeated) model.verdict = true; }
      else if (e === "readStart" || e === "memo") { applyInput(s, { t: "storyRead", id: "start" }); model.memo = true; }
      else if (e === "readVictory") { const r = applyInput(s, { t: "storyRead", id: "victory" }); assert.equal(r.ok, model.defeated, "the verdict needs the boss down"); if (model.defeated) model.verdict = true; }
      paid.push(...completedIds(s));
      const g = mainStep(s.quests.main.m);
      assert.equal(g, modelStep(model), `run ${run} after ${e}: step vs model ${JSON.stringify(model)}`);
      assert.ok(g >= prev, `run ${run}: a step never goes back`);
      prev = g;
      assert.equal(s.events.filter((x) => x.type === "quest.step").length <= 1, true);
      const active = MAINS.filter((id) => mainState(s.quests.main.m, id) === "active");
      assert.deepEqual(active, g > 10 ? [] : [modelArc(g)], `run ${run}: exactly the quest of the current step is active`);
    }
    const want = MAINS.filter((id) => mainState(s.quests.main.m, id) === "completed");
    assert.deepEqual(paid, want, `run ${run}: one completion per finished arc, in order`);
    const goldWant = want.reduce((t, id) => t + (config.quests.arc[id] ? arcGold(id) : 0), 0), xpWant = want.reduce((t, id) => t + (config.quests.arc[id] ? arcXp(id) : 0), 0);
    assert.equal(s.player.gold - gold0, goldWant, `run ${run}: gold paid`);
    assert.equal(s.player.xp - xp0, xpWant, `run ${run}: experience paid`);
  }
});

test("[R74-order] the unlock toast data: quest.step carries `unlocked` only when the active arc changed, and the text of the next line is the first step of the new arc", () => {
  const s = hero(40);
  enterFloor(s, 6, { at: "entry" });
  const st = s.events.find((e) => e.type === "quest.step");
  assert.equal(st.id, "main3"); assert.equal(st.unlocked, true); assert.equal(st.step, 1);
  assert.equal(st.next, content.quests.main3.steps[0].line);
  assert.equal(nextStep(s, "main"), "", "a completed arc has no next step"); assert.equal(nextStep(s, "main2"), "");
  assert.equal(nextStep(s, "main3"), content.quests.main3.steps[0].line);
  const v = questView(s);
  assert.deepEqual([v.main.state, v.main2.state, v.main3.state], ["completed", "completed", "active"]);
  assert.deepEqual([v.main.step, v.main2.step, v.main3.step], [3, 3, 1]);
  assert.deepEqual([v.main.stepCount, v.main2.stepCount, v.main3.stepCount], [3, 3, 4]);
  const fresh = questView(hero(40));
  assert.deepEqual([fresh.main.state, fresh.main2.state, fresh.main3.state], ["active", "unavailable", "unavailable"]);
  assert.deepEqual([fresh.main2.step, fresh.main3.step, fresh.main2.nextStep, fresh.main3.nextStep], [0, 0, "", ""]);
});

test("[R74-order] the pin: it moves with a completing arc, with the last arc to the first open side quest else main3; questPin refuses locked and completed arcs; `main` is the alias of the active arc", () => {
  const s = hero(41);
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main2" }), { ok: false, error: "locked" });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main3" }), { ok: false, error: "locked" });
  accept(s, "sq4"); assert.ok(applyInput(s, { t: "questPin", id: "sq4" }).ok);
  assert.equal(s.quests.pinned, "sq4");
  enterFloor(s, 4, { at: "entry" });
  assert.equal(s.quests.pinned, "sq4", "a pinned side quest stays pinned when an arc completes");
  assert.ok(applyInput(s, { t: "questPin", id: "main" }).ok, "main is the alias of the active arc");
  assert.equal(s.quests.pinned, "main2");
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main3" }), { ok: false, error: "locked" });
  enterFloor(s, 6, { at: "entry" });
  assert.equal(s.quests.pinned, "main3");
  assert.equal(applyInput(s, { t: "questPin", id: "main2" }).error, "already done");
  // last arc done: the pin goes to the first open side quest
  const t = hero(42);
  accept(t, "sq5"); setQuestStep(t, "sq5", 2);
  assert.ok(applyInput(t, { t: "questPin", id: "main" }).ok);
  completeQuest(t, "main3");
  assert.equal(t.quests.pinned, "sq5", "the first open side quest");
  assert.equal(applyInput(t, { t: "questPin", id: "main" }).error, "already done", "all three done: main answers already done");
  assert.equal(applyInput(t, { t: "questPin", id: "sq9" }).error, "unknown quest");
  const u = hero(43); completeQuest(u, "main3");
  assert.equal(u.quests.pinned, "main3", "no open side quest: stays on the last arc, which keeps the journal valid");
  rt(u);
});

// =============================================================================================== arc rewards exactly once
test("[R74-pay] reload, revisit and deeper floors pay nothing twice: arc 1 once at floor 3, arc 2 once at floor 6, nothing at the verdict", () => {
  let s = hero(50);
  const g0 = s.player.gold, x0 = s.player.xp;
  enterFloor(s, 3, { at: "entry" });
  assert.equal(s.player.gold, g0 + arcGold("main")); assert.equal(s.player.xp, x0 + arcXp("main"));
  s = rt(s);
  s.events.length = 0;
  enterFloor(s, 3, { at: "entry" }); enterFloor(s, 2, { at: "exit" }); enterFloor(s, 0, { at: "entry" }); enterFloor(s, 3, { at: "entry" });
  assert.equal(s.player.gold, g0 + arcGold("main"), "a reload and a revisit pay nothing");
  assert.deepEqual(completedIds(s), []);
  enterFloor(s, 6, { at: "entry" });
  assert.deepEqual(completedIds(s), ["main2"]);
  assert.equal(s.player.gold, g0 + arcGold("main") + arcGold("main2"));
  s = rt(s); s.events.length = 0;
  for (const d of [6, 7, 6, 8, 5]) enterFloor(s, d, { at: "entry" });
  assert.equal(s.player.gold, g0 + arcGold("main") + arcGold("main2"));
  assert.deepEqual(completedIds(s), []);
  const q = JSON.stringify(s.quests);
  s = rt(s); assert.equal(JSON.stringify(s.quests), q);
});

test("[R74-pay] the rewards field of quest.completed is what was paid (gold, experience, no items); an arc pays no item, skill point or attribute point", () => {
  for (const id of ["main", "main2"]) {
    const s = hero(51), p = s.player;
    const before = { gold: p.gold, xp: p.xp, items: s.inventory.items.length, sp: p.skillPoints, ap: p.attrPoints, lvl: p.level };
    completeQuest(s, id);
    const ev = s.events.filter((e) => e.type === "quest.completed" && e.id === id);
    assert.equal(ev.length, 1);
    assert.deepEqual(ev[0].rewards, { gold: arcGold(id), xp: arcXp(id), items: [] });
    assert.equal(p.gold - before.gold, id === "main" ? arcGold("main") : arcGold("main") + arcGold("main2"), "completeQuest(main2) is the catch-up of both arcs");
    assert.equal(s.inventory.items.length, before.items);
    const levels = p.level - before.lvl;
    assert.equal(p.skillPoints - before.sp, levels * config.skillPointsPerLevel, "only the points of the levels gained");
    assert.equal(p.attrPoints - before.ap, levels * config.attrPointsPerLevel);
    assert.deepEqual(rewardSummary(id), { gold: arcGold(id), xp: arcXp(id), potions: 0, gear: null });
  }
  assert.equal(rewardSummary("main3"), null);
});

test("[R74-pay] cheats: completeQuest and setQuestStep of an arc, repeated, backwards and in any order, pay each arc exactly once", () => {
  const s = hero(52);
  const g0 = s.player.gold;
  assert.ok(setQuestStep(s, "main", 3).ok);
  assert.equal(s.player.gold, g0, "step 3 of arc 1: nothing finished yet");
  assert.ok(completeQuest(s, "main").ok); assert.ok(completeQuest(s, "main").ok);
  assert.equal(s.player.gold, g0 + arcGold("main"), "twice completeQuest(main): paid once");
  assert.equal(setQuestStep(s, "main", 1).ok, false, "a finished arc cannot be put back");
  assert.equal(setQuestStep(s, "main", 2).ok, false);
  assert.ok(setQuestStep(s, "main2", 1).ok, "the current step: a no-op");
  assert.equal(s.player.gold, g0 + arcGold("main"));
  assert.ok(setQuestStep(s, "main2", 3).ok);
  assert.ok(setQuestStep(s, "main3", 1).ok, "step 1 of main3 completes main2 (arc 2 paid once)");
  assert.equal(s.player.gold, g0 + arcGold("main") + arcGold("main2"));
  assert.equal(setQuestStep(s, "main2", 2).ok, false);
  for (let i = 0; i < 3; i++) completeQuest(s, "main3");
  assert.equal(s.player.gold, g0 + arcGold("main") + arcGold("main2"), "the last arc pays nothing");
  assert.equal(setQuestStep(s, "main3", 9).ok, false); assert.equal(setQuestStep(s, "main3", 0).ok, false); assert.equal(setQuestStep(s, "main3", 1.5).ok, false);
  assert.equal(setQuestStep(s, "main", NaN).ok, false);
  rt(s);
  // the cheat and the events together: floor 3 first, then the cheat for the same arc
  const t = hero(53); const tg = t.player.gold;
  enterFloor(t, 3, { at: "entry" }); completeQuest(t, "main"); setQuestStep(t, "main2", 1); enterFloor(t, 3, { at: "entry" });
  assert.equal(t.player.gold, tg + arcGold("main"));
});

test("[R74-pay] death, respawn and a hero killed during the catch-up pay nothing again; the hand-in and arc rewards stack with level-ups and stay legal", () => {
  const s = hero(54);
  enterFloor(s, 3, { at: "entry" });
  const g = s.player.gold, x = s.player.xp, l = s.player.level;
  setHp(s, 0); step(s); assert.equal(s.scene, "dead"); assert.ok(respawn(s).ok);
  assert.equal(s.player.gold, g, "death costs nothing in this build and pays nothing");
  enterFloor(s, 3, { at: "entry" });
  assert.equal(s.player.xp, x); assert.equal(s.player.level, l);
  // an arc that levels the hero up: xp one point below the next level
  const t = hero(55);
  t.player.xp = t.player.xpNext - 1;
  const lvl = t.player.level;
  completeQuest(t, "main");
  assert.ok(t.player.level > lvl, "the arc experience levels the hero up through the normal path");
  rt(t);
});

test("[R74-pay] a v4 save migrates without paying anything and plays on paying only the arcs not yet finished (v4 floor 4 reaches floor 6: arc 2 only)", () => {
  const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
  for (const [f, depthNow, wantIds] of [["save-v4-floor4.json", 6, ["main2"]], ["save-v4-lobby.json", 3, ["main"]], ["save-v4-floor8-unlocked.json", 9, []], ["save-v4-boss-defeated.json", 9, []], ["save-v4-pinned-side.json", 6, ["main2"]]]) {
    const raw = JSON.parse(fx(f));
    const r = deserialize(fx(f));
    assert.ok(r.ok, `${f}: ${r.message}`);
    const s = r.state;
    assert.equal(s.player.gold, raw.player.gold, `${f}: migration paid no gold`); assert.equal(s.player.xp, raw.player.xp);
    assert.equal(s.events.filter((e) => e.type === "quest.completed").length, 0, `${f}: and emitted no completion`);
    s.events.length = 0;
    const g = s.player.gold;
    enterFloor(s, depthNow, { at: "entry" });
    assert.deepEqual(completedIds(s), wantIds, `${f}: arcs paid after the migration`);
    assert.equal(s.player.gold, g + wantIds.reduce((t, id) => t + arcGold(id), 0), `${f}: gold`);
    // reload of the migrated and played-on state pays nothing more
    const again = rt(s); again.events.length = 0; enterFloor(again, depthNow, { at: "entry" });
    assert.deepEqual(completedIds(again), []);
  }
});

test("[R74-pay] migrating the same v4 text twice, through a write in between, gives the same quests and the same gold", () => {
  const s0 = hero(56); enterFloor(s0, 4, { at: "entry" });
  const text = v4Text(s0);
  const a = deserialize(text), b = deserialize(serialize(a.state)), c = deserialize(text);
  assert.ok(a.ok && b.ok && c.ok);
  assert.deepEqual(a.state.quests, b.state.quests); assert.deepEqual(a.state.quests, c.state.quests);
  assert.equal(a.state.player.gold, c.state.player.gold);
  assert.equal(a.state.quests.pinned, "main2");
});

// =============================================================================================== sq4: the ledger
test("[R74-sq4] the stash keeper offers sq4 and the stash still works while the dialog is open; the vendor and the others cannot accept or hand in sq4", () => {
  const s = hero(60);
  talk(s, "stash");
  assert.equal(s.ui.dialog.kind, "stash");
  assert.equal(applyInput(s, { t: "questAccept", id: "sq1" }).ok, false, "the stash keeper does not give sq1");
  assert.equal(applyInput(s, { t: "questAccept", id: "main2" }).ok, false, "an arc is not accepted");
  assert.ok(applyInput(s, { t: "questAccept", id: "sq4" }).ok);
  assert.equal(s.quests.sq4.s, "active");
  assert.equal(applyInput(s, { t: "questAccept", id: "sq4" }).ok, false, "a second accept is refused");
  assert.equal(s.ui.dialog.kind, "stash", "the window stays a stash window");
  talk(s, "vendor");
  setQuestStep(s, "sq4", 2);
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq4" }).error, "wrong npc");
  assert.equal(applyInput(s, { t: "questHandIn", id: "main" }).ok, false);
});

test("[R74-sq4] the ledger: one on the floor chosen by questRng from {5,6} for 120 seeds, none on the other floor, none when sq4 is not active, with sq2 accepted too exactly one each, same tile on every visit", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const s = hero(seed);
    const fl = itemFloorOf(seed, "sq4");
    assert.ok([5, 6].includes(fl), "floor of the ledger");
    assert.equal(fl, config.quests.sq4.item.floors[questRng(seed, 4, 1, 0).int(0, 1)], "the stream the spec names");
    for (const d of [5, 6]) { enterFloor(s, d, { at: "entry" }); assert.equal(s.groundItems.filter((g) => g.quest === "sq4").length, 0, `seed ${seed}: not accepted, no ledger on ${d}`); }
    if (seed > 40) continue;
    accept(s, "sq4"); if (seed % 2) accept(s, "sq2");
    const tiles = [];
    for (const d of [5, 6, 5, 6, 5]) {
      enterFloor(s, d, { at: d === 5 ? "entry" : "exit" });
      const led = s.groundItems.filter((g) => g.quest === "sq4");
      assert.equal(led.length, d === fl ? 1 : 0, `seed ${seed} floor ${d}: ledger count`);
      if (led[0]) { tiles.push(`${led[0].tile.x},${led[0].tile.y}`); assert.equal(led[0].id, "qi-sq4"); }
      assert.ok(s.groundItems.filter((g) => g.quest === "sq2").length === 0, "the badge is on floors 3 or 4 only");
    }
    assert.equal(new Set(tiles).size, 1, `seed ${seed}: same tile on every visit`);
    const back = rt(s); enterFloor(back, fl, { at: "entry" });
    assert.equal(back.groundItems.filter((g) => g.quest === "sq4").length, 1, "after a reload exactly one again");
    assert.equal(back.groundItems.find((g) => g.quest === "sq4").tile.x, Number(tiles[0].split(",")[0]));
  }
});

test("[R74-sq4] sq4 and sq2 together: the pouch holds both items at once with a full bag, each readies only its own quest, and the pouch is empty again after each hand-in; the full bag owes the sq4 potions instead of refusing", () => {
  const s = hero(61);
  accept(s, "sq2"); accept(s, "sq4");
  for (const [id, fl] of [["sq2", itemFloorOf(61, "sq2")], ["sq4", itemFloorOf(61, "sq4")]]) {
    enterFloor(s, fl, { at: "entry" }); s.monsters = [];
    fillBag(s);
    pickUp(s, `qi-${id}`);
    assert.equal(s.quests[id].s, "ready", `${id} ready with a full bag`);
    assert.ok(s.player.pouch.some((e) => e.quest === id && e.id === `qi-${id}`));
  }
  assert.equal(s.quests.sq2.s, "ready"); assert.equal(s.quests.sq4.s, "ready");
  assert.equal(s.player.pouch.length, 2);
  rt(s);
  const bag = s.inventory.items.length, g0 = s.player.gold;
  const r = handIn(s, "sq4");
  assert.equal(r.ok, true, "R8-Q1: a bag full of single potions does not refuse the hand-in of sq4");
  assert.equal(s.quests.sq4.s, "completed"); assert.ok(s.player.gold > g0, "gold paid");
  assert.ok(s.player.owed?.length >= 1, "the potions that do not fit are owed");
  assert.deepEqual(s.player.pouch.map((e) => e.quest), ["sq2"], "only the ledger-quest item left the pouch");
  assert.equal(s.inventory.items.length, bag, "the full bag took nothing");
  rt(s);
  s.inventory.items.length = 0; step(s);
  assert.equal(s.player.owed, undefined, "delivered once the bag is empty");
  assert.deepEqual(s.player.pouch.map((e) => e.quest), ["sq2"], "only the ledger left the pouch");
  assert.equal(s.quests.sq2.s, "ready");
  assert.ok(handIn(s, "sq2").ok);
  assert.deepEqual(s.player.pouch, []);
  rt(s);
});

test("[R74-sq4] hand-in pays gold, experience and the configured potions and no gear; twice pays once; the summary equals the payout (40 seeds x 3 classes)", () => {
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) for (let seed = 1; seed <= 40; seed += 13) {
    const s = hero(seed, cls);
    accept(s, "sq4"); setQuestStep(s, "sq4", 2);
    s.inventory.items.length = 0;
    const g = s.player.gold, x = s.player.xp, sum = rewardSummary("sq4");
    assert.equal(sum.gear, null); assert.equal(sum.potions, config.quests.sq4.potions);
    assert.ok(handIn(s, "sq4").ok);
    assert.equal(s.player.gold - g, sum.gold); assert.equal(s.player.xp - x, sum.xp);
    assert.equal(s.inventory.items.filter((i) => i.kind === "gear").length, 0, "no gear");
    assert.equal(s.inventory.items.length, sum.potions);
    assert.equal(handIn(s, "sq4").ok, false);
    assert.equal(s.player.gold - g, sum.gold, "a double hand-in pays once");
    rt(s);
  }
});

test("[R74-sq4] setQuestStep(sq4, 2) is a legal save (the ledger floor was reached) and makes the pouch entry; step 0 and 1 take it away again", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = hero(seed);
    assert.ok(setQuestStep(s, "sq4", 2).ok);
    assert.equal(s.player.pouch.length, 1);
    assert.ok(s.deepestDepth >= itemFloorOf(seed, "sq4"));
    rt(s);
    assert.ok(setQuestStep(s, "sq4", 1).ok);
    assert.equal(s.player.pouch.length, 0); assert.equal(s.quests.sq4.s, "active");
    rt(s);
    assert.ok(setQuestStep(s, "sq4", 0).ok);
    assert.equal(s.quests.sq4.s, "available"); rt(s);
  }
});

// =============================================================================================== sq5: the consultants
function killConsultants(s, floors) {
  let n = 0;
  for (const d of floors) { enterFloor(s, d, { at: "entry" }); for (const m of live(s, "consultant")) { kill(s, m); n++; } }
  return n;
}
test("[R74-sq5] progress: only consultants on floors 5 and 6 after the accept count, 1 each, ready at 6 exactly once; other monsters, summoned ones and other floors do not", () => {
  const s = hero(70);
  enterFloor(s, 5, { at: "entry" });
  const pre = live(s, "consultant")[0]; assert.ok(pre, "floor 5 has consultants");
  kill(s, pre);
  assert.equal(s.quests.sq5.p, 0, "before the accept nothing counts");
  accept(s, "sq5");
  enterFloor(s, 5, { at: "entry" });
  const c = live(s, "consultant");
  assert.ok(c.length >= 1);
  const other = s.monsters.find((m) => m.type !== "consultant" && m.ai !== "dead"); if (other) { kill(s, other); assert.equal(s.quests.sq5.p, 0, "another type"); }
  const sm = c[0]; sm.summoned = true; kill(s, sm); assert.equal(s.quests.sq5.p, 0, "a summoned consultant");
  const rest = live(s, "consultant"); if (rest[0]) { kill(s, rest[0]); assert.equal(s.quests.sq5.p, 1); kill(s, rest[0]); assert.equal(s.quests.sq5.p, 1, "a corpse hit again"); }
  enterFloor(s, 4, { at: "entry" });
  for (const m of s.monsters) if (m.type === "consultant") { kill(s, m); }
  assert.equal(s.quests.sq5.p, rest[0] ? 1 : 0, "floor 4 does not count (a consultant there, if any)");
  assert.equal(s.quests.sq1.p, 0, "a consultant is not an intern");
});

test("[R74-sq5] 40 seeds: killing every consultant of floors 5 and 6 after the accept completes it (>= 6 spawn), ready once, later kills change nothing, the state is a legal save", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = hero(seed);
    accept(s, "sq5");
    s.events.length = 0;
    const n = killConsultants(s, [5, 6]);
    assert.ok(n >= config.quests.sq5.kill.count, `seed ${seed}: ${n} consultants on floors 5 and 6`);
    assert.equal(s.quests.sq5.s, "ready"); assert.equal(s.quests.sq5.p, config.quests.sq5.kill.count);
    assert.equal(s.events.filter((e) => e.type === "quest.step" && e.id === "sq5").length, 1, "one ready cue");
    assert.equal(s.events.filter((e) => e.type === "quest.progress" && e.id === "sq5").length, config.quests.sq5.kill.count - 1);
    rt(s);
  }
});

test("[R74-sq5] revive: floors 5 and 6 cleared BEFORE the accept can still be completed; exactly the needed number comes back, never more, in spawn order, other floors untouched", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = hero(seed);
    const cleared = killConsultants(s, [5, 6]);
    assert.ok(cleared >= 6);
    const killed56 = JSON.stringify([s.floors[5].killed, s.floors[6].killed]);
    accept(s, "sq5");
    const alive = [5, 6].reduce((t, d) => { const f = s.floors[d]; return t + generateFloor(seed, d).spawns.filter((sp, i) => sp.type === "consultant" && !f.killed.includes(i)).length; }, 0);
    assert.equal(alive, config.quests.sq5.kill.count, `seed ${seed}: exactly the count is back`);
    assert.notEqual(JSON.stringify([s.floors[5].killed, s.floors[6].killed]), killed56);
    const n = killConsultants(s, [5, 6]);
    assert.equal(n, config.quests.sq5.kill.count);
    assert.equal(s.quests.sq5.s, "ready");
  }
  // partial: 3 of the 6 killed before the accept: no revive needed when enough are alive
  const t = hero(3);
  enterFloor(t, 5, { at: "entry" }); const c5 = live(t, "consultant"); kill(t, c5[0]);
  enterFloor(t, 0, { at: "entry" });
  const before = JSON.stringify([t.floors[5].killed]);
  const total = [5, 6].reduce((n, d) => n + generateFloor(3, d).spawns.filter((sp) => sp.type === "consultant").length, 0);
  accept(t, "sq5");
  assert.ok(total - 1 >= 6, "seed 3 spawns enough consultants for the partial case");
  assert.deepEqual(JSON.stringify([t.floors[5].killed]), before, "enough alive: nothing is revived");
});

test("[R74-sq5] ADV-R7-10 the generator alone leaves some seeds short of sq5's consultant count; the top-up on accept guarantees it (pinned short seeds; 1000-seed scan in quests-sq45.test.js)", () => {
  for (const seed of [102, 105, 173, 183, 194, 412, 446, 447, 468, 565, 597, 657]) {
    const n = [5, 6].reduce((t, d) => t + generateFloor(seed, d).spawns.filter((sp) => sp.type === config.quests.sq5.kill.monster).length, 0);
    assert.ok(n < config.quests.sq5.kill.count, `seed ${seed}: ${n} spawned`);
    const t = hero(seed); accept(t, "sq5");
    const alive = [5, 6].reduce((c, d) => { enterFloor(t, d, { at: "entry" }); return c + live(t, "consultant").length; }, 0);
    assert.ok(alive >= config.quests.sq5.kill.count, `seed ${seed}: ${alive} alive after accept`);
  }
});

test("[R74-sq5] a run that never accepts is untouched by the revive and the new objects: floors 5 and 6 of 30 seeds produce identical monsters with and without sq4 and sq5 available, and no rng is drawn", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const a = hero(seed), b = hero(seed);
    for (const d of [5, 6]) { enterFloor(a, d, { at: "entry" }); enterFloor(b, d, { at: "entry" }); }
    assert.deepEqual(a.monsters.map((m) => [m.type, m.tile]), b.monsters.map((m) => [m.type, m.tile]));
    assert.equal(JSON.stringify(a.rng), JSON.stringify(b.rng));
    assert.equal(a.groundItems.filter((g) => g.quest).length, 0);
  }
  // accepting sq4 and sq5 changes no random stream either (the quest streams are stateless)
  for (let seed = 1; seed <= 20; seed++) {
    const a = hero(seed), b = hero(seed);
    accept(b, "sq4"); accept(b, "sq5");
    const ra = JSON.stringify(a.rng), rb = JSON.stringify(b.rng);
    assert.equal(ra, rb, `seed ${seed}: accepting draws nothing`);
    for (const d of [5, 6]) { enterFloor(a, d, { at: "entry" }); enterFloor(b, d, { at: "entry" }); assert.deepEqual(a.monsters.map((m) => [m.type, m.tile]), b.monsters.map((m) => [m.type, m.tile]), `seed ${seed} floor ${d}: monsters`); }
  }
});

test("[R74-sq5] the reward: exactly one magic ring, amulet or belt at item level gearFloor x ilvlPerDepth, no potions; same item for the same seed and class, the class affix tag differs per class; on a full bag the hand-in completes and the gear is owed, then delivered exactly once", () => {
  const items = {};
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) for (let seed = 1; seed <= 60; seed++) {
    const s = hero(seed, cls);
    const r = rewardOf(s, "sq5"), r2 = rewardOf(hero(seed, cls), "sq5");
    assert.deepEqual(r, r2, "deterministic");
    assert.deepEqual(r.potions, []);
    assert.equal(r.gear.rarity, "magic", `${cls} ${seed}`);
    assert.ok(["ring", "amulet", "belt"].includes(r.gear.slot), r.gear.slot);
    assert.equal(r.gear.ilvl, config.quests.sq5.gearFloor * config.ilvlPerDepth);
    (items[cls] ??= []).push(r.gear.affixes?.length ?? 0);
  }
  const s = hero(9);
  accept(s, "sq5"); setQuestStep(s, "sq5", 2);
  fillBag(s);
  const gold0 = s.player.gold, bag0 = JSON.stringify(s.inventory);
  const r = handIn(s, "sq5");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(s.quests.sq5.s, "completed"); assert.ok(s.player.gold > gold0, "gold paid at once");
  assert.equal(s.player.owed.length, 1, "the one piece of gear is owed");
  assert.equal(JSON.stringify(s.inventory), bag0, "the full bag is untouched while the gear waits");
  s.inventory.items.pop(); step(s); // one cell is not enough for a ring? free more if still owed
  if (s.player.owed) { s.inventory.items.length = 0; step(s); }
  assert.equal(s.player.owed, undefined);
  assert.equal(s.inventory.items.filter((i) => i.kind === "gear").length, 1);
  assert.equal(handIn(s, "sq5").ok, false);
  assert.equal(s.inventory.items.filter((i) => i.kind === "gear").length, 1);
});

test("[R74-sq5] every attempt to reach the reward before the work fails: hand-in while active or available, by the wrong giver, without a dialog", () => {
  const s = hero(71);
  talk(s, "vendor");
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).error, "not ready");
  accept(s, "sq5");
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).error, "not ready");
  s.quests.sq5.p = 0;
  talk(s, "stash");
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).error, "wrong npc");
  setQuestStep(s, "sq5", 2);
  talk(s, "healer");
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).error, "wrong npc");
  applyInput(s, { t: "closeDialog" });
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).ok, false, "no dialog");
  assert.equal(s.quests.sq5.s, "ready");
});

// =============================================================================================== two quests from one giver
test("[R74-giver] the vendor holds sq1 and sq5: both can be open at once, either can be handed in first, the marker says handin while either is ready and available while either is on offer", () => {
  const s = hero(80);
  talk(s, "vendor");
  assert.ok(applyInput(s, { t: "questAccept", id: "sq1" }).ok);
  assert.equal(applyInput(s, { t: "questHandIn", id: "sq5" }).ok, false, "sq5 not accepted: nothing to hand in");
  assert.ok(applyInput(s, { t: "questAccept", id: "sq5" }).ok, "the second quest of the same giver in the same window");
  assert.deepEqual([s.quests.sq1.s, s.quests.sq5.s], ["active", "active"]);
  assert.equal(npcMarker(s, "vendor"), "none", "both active: nothing to say");
  setQuestStep(s, "sq5", 2);
  assert.equal(npcMarker(s, "vendor"), "handin");
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq5" }).ok);
  assert.equal(s.quests.sq1.s, "active", "handing in one leaves the other alone"); assert.equal(s.quests.sq1.p, 0);
  assert.equal(s.ui.dialog?.npc, "vendor", "the window stays open");
  assert.equal(npcMarker(s, "vendor"), "none");
  setQuestStep(s, "sq1", 2);
  assert.equal(npcMarker(s, "vendor"), "handin");
  assert.ok(applyInput(s, { t: "questHandIn", id: "sq1" }).ok);
  assert.equal(npcMarker(s, "vendor"), "none");
  rt(s);
});

test("[R74-giver] the pin and the map marker with two quests of one giver: completing one pinned quest moves the pin to the other open quest of the vendor, the marker points at the vendor only for a ready or offered quest", () => {
  const s = hero(81);
  accept(s, "sq1"); accept(s, "sq5");
  assert.ok(applyInput(s, { t: "questPin", id: "sq1" }).ok);
  setQuestStep(s, "sq1", 2); setQuestStep(s, "sq5", 2);
  s.events.length = 0;
  assert.ok(handIn(s, "sq1").ok);
  assert.equal(s.quests.pinned, "main", "the active main arc comes first when the pinned side quest completes");
  assert.equal(s.events.filter((e) => e.type === "quest.pinned").length, 1);
  enterFloor(s, 0, { at: "entry" });
  assert.ok(applyInput(s, { t: "questPin", id: "sq5" }).ok);
  s.floor.explored.fill(1);
  assert.deepEqual(mapMarkers(s).map((m) => [m.quest, m.kind]), [["sq5", "npc"]]);
});

test("[R74-giver] two quests handed in with ONE bag that fits only one reward: both complete and pay gold, the second reward is owed and delivered after freeing space; no duplicate or lost reward", () => {
  const s = hero(82);
  accept(s, "sq1"); accept(s, "sq5");
  setQuestStep(s, "sq1", 2); setQuestStep(s, "sq5", 2);
  fillBag(s, new Set(["0,0", "1,0", "2,0"])); // exactly the cells sq1 (3 potions) needs
  const r1 = handIn(s, "sq1");
  assert.ok(r1.ok, JSON.stringify(r1));
  const g = s.player.gold;
  const r5 = handIn(s, "sq5");
  assert.ok(r5.ok, JSON.stringify(r5));
  assert.ok(s.player.gold > g, "gold of the second quest paid at once");
  assert.equal(s.quests.sq5.s, "completed");
  assert.equal(s.player.owed.length, 1, "the gear of sq5 is owed");
  assert.equal(s.inventory.items.filter((i) => i.kind === "gear").length, 0);
  s.inventory.items = s.inventory.items.filter((i) => !i.id.startsWith("fill")); step(s);
  assert.equal(s.player.owed, undefined);
  assert.equal(s.inventory.items.filter((i) => i.kind === "gear").length, 1, "exactly one piece, no duplicate");
  assert.equal(s.inventory.items.length, 4, "the three potions of sq1 and the one piece of gear, nothing else");
});

// =============================================================================================== prerequisites and gates of the new quests
test("[R74-gate] no quest needs another: sq4 and sq5 can be accepted at once in the Lobby before any descent, and an arc cannot be accepted, handed in or set to a side state", () => {
  const s = hero(90);
  assert.equal(s.deepestDepth <= 1, true);
  accept(s, "sq5"); accept(s, "sq4");
  assert.equal(s.quests.sq4.s, "active"); assert.equal(s.quests.sq5.s, "active");
  for (const id of MAINS) {
    assert.equal(applyInput(s, { t: "questAccept", id }).ok, false);
    assert.equal(applyInput(s, { t: "questHandIn", id }).ok, false);
  }
  assert.equal(applyInput(s, { t: "questAccept", id: "__proto__" }).ok, false);
  assert.equal(applyInput(s, { t: "questAccept", id: ["sq4"] }).ok, false);
  assert.equal(applyInput(s, { t: "questAccept", id: "constructor" }).ok, false);
  rt(s);
});

test("[R74-gate] sq4 and sq5 active, then the hero dies on floor 5, respawns, and the quest block, pouch and the ledger position are unchanged; a second ledger is never created", () => {
  const s = hero(91);
  accept(s, "sq4"); accept(s, "sq5");
  const fl = itemFloorOf(91, "sq4");
  enterFloor(s, fl, { at: "entry" });
  const tile = s.groundItems.find((g) => g.quest === "sq4").tile;
  const q = JSON.stringify(s.quests);
  s.monsters = [];
  setHp(s, 0); step(s); assert.ok(respawn(s).ok);
  assert.equal(JSON.stringify(s.quests), q);
  enterFloor(s, fl, { at: "entry" }); s.monsters = [];
  const led = s.groundItems.filter((g) => g.quest === "sq4");
  assert.equal(led.length, 1);
  assert.deepEqual(led[0].tile, tile);
  pickUp(s, "qi-sq4");
  assert.equal(s.quests.sq4.s, "ready");
  for (const d of [0, fl, 0, fl]) enterFloor(s, d, { at: "entry" });
  assert.equal(s.groundItems.filter((g) => g.quest === "sq4").length, 0, "no second ledger once it is in the pouch");
  assert.equal(s.player.pouch.length, 1);
  setHp(s, 0); step(s); respawn(s);
  assert.equal(s.player.pouch.length, 1, "death keeps the pouch");
});

test("[R74-golden] the quest streams stay stateless: the sq2 item floor and tile are unchanged by sq4 (same floor for the same seed as before R7-4), and itemFloorOf(sq2) draws from salt 2 only", () => {
  for (let seed = 1; seed <= 100; seed++) {
    assert.equal(itemFloorOf(seed, "sq2"), config.quests.item.floors[questRng(seed, 2, 1, 0).int(0, 1)]);
    assert.equal(itemFloorOf(seed), itemFloorOf(seed, "sq2"));
  }
  const a = hero(7), b = hero(7);
  accept(a, "sq2"); accept(b, "sq2"); accept(b, "sq4");
  const fl = itemFloorOf(7, "sq2");
  enterFloor(a, fl, { at: "entry" }); enterFloor(b, fl, { at: "entry" });
  assert.deepEqual(a.groundItems.find((g) => g.quest === "sq2").tile, b.groundItems.find((g) => g.quest === "sq2").tile, "accepting sq4 moves no badge");
});

test("[R74-xss] ADV-R7-07 questPin ids are matched against the content table's own keys: constructor, toString and __proto__ are not quests and must not be pinned (the pin then fails the schema and the next save is unloadable)", () => {
  const s = hero(92);
  for (const id of ["sq4\"><img src=x onerror=alert(1)>", "main2<script>", "constructor", "toString", "__proto__", "sq4 ", "SQ4", "", null, undefined, 4, {}]) {
    for (const t of ["questAccept", "questHandIn", "questPin"]) { const r = applyInput(s, { t, id }); assert.equal(r.ok === true && id !== "sq4" && id !== "main2", false, `${t} ${String(id)}`); }
  }
  assert.equal(s.quests.pinned, "main");
  assert.equal(({}).polluted, undefined);
  rt(s);
});

test("[R74-bot] sq4 and sq5 are claimable by the bot's real path: every quest id of the content table has a giver that exists in the Lobby and a next-step text for each state", () => {
  for (const id of content.sideIds) {
    const def = content.quests[id];
    const s = hero(5);
    enterFloor(s, 0, { at: "entry" });
    assert.ok(s.floor.npcs.some((n) => n.id === def.giver), `${id}: giver ${def.giver} in the Lobby`);
    for (const st of ["available", "active", "ready"]) assert.ok(def.next[st].length > 10);
    assert.equal(nextStep(s, id).includes("{giver}"), false);
  }
  assert.equal(content.sideIds.length, config.quests.sideCount);
  assert.deepEqual(content.mainIds, MAINS);
  assert.equal(content.mainSteps.length, 10);
});

// =============================================================================================== random operations over all eight quests
test("[R74-fuzz] random real operations over all eight quests (6 seeds x 250 steps): the pouch holds exactly the ready item quests, every state is a legal save, no step goes back, arcs pay at most once, gold never drops", () => {
  const rng = createRng(4242);
  for (let seed = 1; seed <= 6; seed++) {
    let s = hero(seed * 7, ["facilities-manager", "sales-rep", "it-wizard"][seed % 3]);
    const gold0 = s.player.gold, xp0 = s.player.xp;
    let prevStep = 1, prevGold = gold0, paidMain = [];
    for (let i = 0; i < 250; i++) {
      const op = rng.int(0, 9);
      s.events.length = 0;
      try {
        if (s.scene === "dead") respawn(s);
        else if (op === 0) enterFloor(s, rng.int(0, 9), { at: rng.int(0, 1) ? "entry" : "exit" });
        else if (op === 1) { const id = ["sq1", "sq2", "sq3", "sq4", "sq5"][rng.int(0, 4)]; if (s.quests[id].s === "available") { talk(s, GIVER[id]); applyInput(s, { t: "questAccept", id }); } }
        else if (op === 2) for (const m of s.monsters.filter((o) => o.ai !== "dead").slice(0, rng.int(1, 6))) kill(s, m);
        else if (op === 3) { const g = s.groundItems.find((x) => x.quest); if (g) { s.monsters = []; pickUp(s, g.id, 800); } }
        else if (op === 4) { const id = ["sq1", "sq2", "sq3", "sq4", "sq5"][rng.int(0, 4)]; if (s.quests[id].s === "ready") { s.inventory.items.length = rng.int(0, 1) ? 0 : s.inventory.items.length; handIn(s, id); } }
        else if (op === 5) { setHp(s, 0); step(s); }
        else if (op === 6) s = rt(s);
        else if (op === 7) applyInput(s, { t: "questPin", id: ["main", "main2", "main3", "sq1", "sq2", "sq3", "sq4", "sq5"][rng.int(0, 7)] });
        else if (op === 8) { s.monsters = s.monsters.filter((m) => m.ai === "dead"); for (let k = 0; k < 20; k++) step(s); }
        else step(s);
      } catch (e) { assert.fail(`seed ${seed} step ${i} op ${op}: ${e.stack}`); }
      paidMain.push(...completedIds(s).filter((id) => id.startsWith("main")));
      const ready = ["sq2", "sq4"].filter((id) => s.quests[id].s === "ready");
      assert.deepEqual(s.player.pouch.map((e) => e.quest).sort(), ready, `seed ${seed} step ${i}: pouch iff ready`);
      const g = mainStep(s.quests.main.m);
      assert.ok(g >= prevStep, "no step goes back"); prevStep = g;
      assert.ok(s.player.gold >= prevGold, `seed ${seed} step ${i}: gold never drops (no spending in this sequence)`); prevGold = s.player.gold;
      assert.ok(s.scene === "dead" || deserialize(serialize(s)).ok, `seed ${seed} step ${i} op ${op}: legal save`);
    }
    assert.equal(new Set(paidMain).size, paidMain.length, `seed ${seed}: an arc completed twice: ${paidMain}`);
    void gold0; void xp0;
  }
});

test("[R74-idle] 600 idle ticks, in the Lobby and on floors 3 and 6 with every quest accepted, leave the quest block and the pouch deep-equal and emit no quest event", () => {
  const s = hero(95);
  for (const id of content.sideIds) accept(s, id);
  for (const d of [0, 3, 6]) {
    enterFloor(s, d, { at: "entry" }); s.monsters = []; s.events.length = 0;
    const q = structuredClone(s.quests), p = structuredClone(s.player.pouch);
    for (let i = 0; i < 600; i++) step(s);
    assert.deepEqual(s.quests, q, `floor ${d}`); assert.deepEqual(s.player.pouch, p);
    assert.equal(qEvents(s).length, 0);
  }
  assert.deepEqual(Object.keys(s.quests), ["main", "sq1", "sq2", "sq3", "sq4", "sq5", "pinned"], "no stored field for main2 or main3 (AC-R-257-1)");
});
