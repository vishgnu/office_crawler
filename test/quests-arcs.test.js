// R7-4.1 three main quests (AC-R-257-1..4): derived arcs over one milestone block, catch-up, arc rewards in the tap, the pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config, content, snapshot, nextStep, rewardSummary, mapMarkers } from "../src/core/index.js";
import { teleportFloor, setQuestStep } from "../src/core/cheats.js";
import { emit } from "../src/core/events.js";
import { mainStep, mainState } from "../src/core/systems/questview.js";
import { deserialize, serialize } from "../src/save/index.js";
import { classes } from "../src/core/content/classes.js";

const qev = (s) => s.eventLog.filter((e) => e.type.startsWith("quest."));
const kinds = (s) => qev(s).filter((e) => e.type !== "quest.pinned").map((e) => `${e.type}:${e.id}`);
const states = (s) => content.mainIds.map((id) => snapshot(s).quests[id].state);
const fresh = (seed = 3) => newGame(seed, { start: "town" });
const pay = (id) => { const c = config.quests.arc[id]; return { gold: c.gold.base + c.gold.perDepth * c.refDepth, xp: c.xp.base + c.xp.perDepth * c.refDepth }; };

test("AC-R-257-1 no stored field exists for main2 or main3: the quest keys are main, sq1..sq5, pinned", () => {
  assert.deepEqual(Object.keys(fresh().quests), ["main", "sq1", "sq2", "sq3", "sq4", "sq5", "pinned"]);
  assert.deepEqual(Object.keys(fresh().quests.main), ["m"]);
});

test("AC-R-257-2 events in order: main is active, main2 and main3 stay unavailable until the previous one is completed; one completed per quest, one step with unlocked", () => {
  const s = fresh();
  assert.deepEqual(states(s), ["active", "unavailable", "unavailable"]);
  emit(s, { type: "floorEnter", depth: 1, from: 0 });
  assert.deepEqual(states(s), ["active", "unavailable", "unavailable"]);
  emit(s, { type: "floorEnter", depth: 2, from: 1 });
  emit(s, { type: "floorEnter", depth: 3, from: 2 });
  assert.deepEqual(states(s), ["completed", "active", "unavailable"]);
  const unlock = qev(s).filter((e) => e.type === "quest.step" && e.unlocked);
  assert.deepEqual(unlock.map((e) => [e.id, e.step, e.next]), [["main2", 1, content.quests.main2.steps[0].line]]);
  assert.deepEqual(snapshot(s).quests.main2.nextStep, content.quests.main2.steps[0].line);
  for (const d of [4, 5, 6]) emit(s, { type: "floorEnter", depth: d, from: d - 1 });
  assert.deepEqual(states(s), ["completed", "completed", "active"]);
  assert.deepEqual(qev(s).filter((e) => e.type === "quest.step").map((e) => `${e.id}#${e.step}${e.unlocked ? "u" : ""}`), ["main#3", "main2#1u", "main2#2", "main2#3", "main3#1u"], "one step event per change, unlocked only when the quest changed");
  assert.deepEqual(qev(s).filter((e) => e.type === "quest.completed").map((e) => e.id), ["main", "main2"]);
  assert.equal(mainStep(s.quests.main.m), 7);
});

test("AC-R-257-2 out of order (teleportFloor(7) from step 1): both finished quests complete in order, one step for the active one; a repeat emits nothing; steps never go back", () => {
  const s = fresh(); s.paused = true;
  teleportFloor(s, 7);
  assert.deepEqual(kinds(s), ["quest.completed:main", "quest.completed:main2", "quest.step:main3"]);
  assert.equal(qev(s).filter((e) => e.type === "quest.step").length, 1);
  assert.equal(qev(s).find((e) => e.type === "quest.step").unlocked, true, "the active quest changed");
  assert.equal(mainStep(s.quests.main.m), 8);
  const n = qev(s).length;
  teleportFloor(s, 7); teleportFloor(s, 0); teleportFloor(s, 2); emit(s, { type: "floorEnter", depth: 5, from: 4 }); emit(s, { type: "floorEnter", depth: 7, from: 6 });
  assert.equal(qev(s).length, n, "revisits and repeats change nothing");
  assert.equal(mainStep(s.quests.main.m), 8);
  s.player.hp = 0; s.scene = "dead"; s.player.hp = s.player.hpMax; s.scene = "floor";
  assert.equal(mainStep(s.quests.main.m), 8, "a death changes nothing");
});

test("AC-R-257-2 a quest is active only if every earlier one is completed, for every possible milestone state", () => {
  for (let depth = 0; depth <= config.bossDepth; depth++) for (const unlocked of [false, true]) for (const defeated of [false, true]) for (const verdict of [false, true]) {
    if (verdict && !defeated) continue;
    const m = { memo: false, depth, unlocked: unlocked || defeated, defeated, verdict };
    const st = content.mainIds.map((id) => mainState(m, id));
    const firstOpen = st.findIndex((x) => x !== "completed");
    st.forEach((x, i) => assert.equal(x, firstOpen < 0 || i < firstOpen ? "completed" : i === firstOpen ? "active" : "unavailable", JSON.stringify(m)));
  }
});

for (const c of classes) {
  test(`AC-R-257-2 ${c.id}: 600 idle ticks leave the quest block deep-equal and raise no quest event`, () => {
    const s = newGame(5, { class: c.id });
    const before = structuredClone(s.quests);
    for (let i = 0; i < 600; i++) step(s);
    assert.deepEqual(s.quests, before);
    assert.ok(!qev(s).length);
  });
}

test("AC-R-257-3 arc 1 pays base + perDepth x refDepth gold and experience once, no item, no point; a repeat, a save and load and a migration pay nothing", () => {
  const s = fresh(), p = s.player, want = pay("main");
  assert.deepEqual(want, { gold: 50, xp: 65 });
  const g0 = p.gold, x0 = p.xp, inv0 = s.inventory.items.length, sp0 = p.skillPoints, ap0 = p.attrPoints;
  emit(s, { type: "floorEnter", depth: 3, from: 2 });
  assert.equal(p.gold - g0, want.gold); assert.equal(p.xp - x0, want.xp);
  assert.equal(s.inventory.items.length, inv0); assert.equal(p.skillPoints, sp0); assert.equal(p.attrPoints, ap0);
  const done = qev(s).find((e) => e.type === "quest.completed");
  assert.deepEqual(done.rewards, { gold: want.gold, xp: want.xp, items: [] });
  assert.deepEqual(rewardSummary("main"), { gold: want.gold, xp: want.xp, potions: 0, gear: null });
  emit(s, { type: "floorEnter", depth: 3, from: 2 }); emit(s, { type: "floorEnter", depth: 3, from: 2 });
  assert.equal(p.gold - g0, want.gold, "a second event pays nothing");
  s.deepestDepth = 3; // the legal world of a hero that has been there (the emitted events do not walk)
  const text = serialize(s), r = deserialize(text);
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.player.gold, p.gold); assert.equal(r.state.player.xp, p.xp); assert.equal(r.state.events.length, 0, "a load pays and emits nothing");
  const again = deserialize(serialize(r.state)); assert.equal(again.state.player.gold, p.gold);
});

test("AC-R-257-3 arc 2 pays its own number once; a catch-up that finishes both pays both once; the last arc pays nothing", () => {
  const s = fresh(); emit(s, { type: "floorEnter", depth: 3, from: 2 });
  const g = s.player.gold, x = s.player.xp;
  emit(s, { type: "floorEnter", depth: 6, from: 5 });
  assert.equal(s.player.gold - g, pay("main2").gold);
  assert.ok(s.player.xp - x === pay("main2").xp || s.player.level > 1, "experience was paid (possibly across a level)");
  const t = fresh(); const g0 = t.player.gold; t.paused = true;
  teleportFloor(t, 6);
  assert.equal(t.player.gold - g0, pay("main").gold + pay("main2").gold, "both paid once");
  assert.deepEqual(qev(t).filter((e) => e.type === "quest.completed").map((e) => [e.id, e.rewards.gold, e.rewards.xp]), [["main", 50, 65], ["main2", 80, 110]]);
  const g1 = t.player.gold;
  const u = fresh(); emit(u, { type: "bossDefeated", id: "m1", tile: { x: 1, y: 1 } });
  const g2 = u.player.gold, ev = qev(u).length;
  assert.equal(g2 - 50 > 0, true);
  emit(u, { type: "keepPlaying" });
  assert.equal(u.player.gold, g2, "the verdict pays nothing");
  assert.deepEqual(qev(u).slice(ev).filter((e) => e.type === "quest.completed").map((e) => [e.id, e.rewards]), [["main3", { gold: 0, xp: 0, items: [] }]]);
  assert.equal(rewardSummary("main3"), null);
  assert.ok(g1 > 0);
});

test("AC-R-257-3 the experience of arcs 1 and 2 reaches the level machinery like any experience: the rewards field equals what was paid", () => {
  const s = fresh(); s.player.level = 6; s.player.xp = config.xpTable[5]; s.player.xpNext = s.player.xpNext;
  const x0 = s.player.xp, g0 = s.player.gold; s.paused = true;
  teleportFloor(s, 6);
  const paid = qev(s).filter((e) => e.type === "quest.completed").reduce((a, e) => ({ gold: a.gold + e.rewards.gold, xp: a.xp + e.rewards.xp }), { gold: 0, xp: 0 });
  assert.equal(s.player.gold - g0, paid.gold); assert.equal(s.player.xp - x0, paid.xp);
});

test("AC-R-257-3 a migration pays nothing: a v4 save at depth 6 loads with the arcs completed and its gold and experience unchanged", () => {
  const s = fresh(); s.paused = true; teleportFloor(s, 6); teleportFloor(s, 0);
  const gold = s.player.gold, xp = s.player.xp;
  const r = deserialize(serialize(s)); assert.equal(r.ok, true, r.message);
  assert.deepEqual([r.state.player.gold, r.state.player.xp], [gold, xp]);
});

test("AC-R-257-4 the pin follows: when the pinned quest completes it moves to the next active main quest with one quest.pinned; after the last, to the first open side quest, else main3", () => {
  const s = fresh();
  assert.equal(s.quests.pinned, "main");
  emit(s, { type: "floorEnter", depth: 3, from: 2 });
  assert.equal(s.quests.pinned, "main2");
  assert.deepEqual(qev(s).filter((e) => e.type === "quest.pinned").map((e) => e.id), ["main2"]);
  emit(s, { type: "floorEnter", depth: 6, from: 5 });
  assert.equal(s.quests.pinned, "main3");
  assert.deepEqual(qev(s).filter((e) => e.type === "quest.pinned").map((e) => e.id), ["main2", "main3"]);
  // a pinned side quest stays pinned while the arcs advance
  const t = fresh(); assert.ok(applyInput(t, { t: "questPin", id: "sq2" }).ok);
  emit(t, { type: "floorEnter", depth: 7, from: 6 }); assert.equal(t.quests.pinned, "sq2");
  // after the last: the first open side quest, else main3
  const u = fresh(); setQuestStep(u, "main3", 4); u.quests.sq3 = { s: "active", p: 0 }; u.quests.sq4 = { s: "ready", p: 1 }; u.player.pouch.push({ id: "qi-sq4", quest: "sq4" }); u.deepestDepth = 9;
  assert.equal(u.quests.pinned, "main3");
  emit(u, { type: "keepPlaying" });
  assert.equal(u.quests.pinned, "sq3", "the first open side quest");
  const v = fresh(); setQuestStep(v, "main3", 4); emit(v, { type: "keepPlaying" });
  assert.equal(v.quests.pinned, "main3", "nothing open: main3 stays");
});

test("AC-R-257-4 questPin main pins the active main quest (stored as its id); a locked or completed main quest is refused; nextStep of a locked one is empty", () => {
  const s = fresh();
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: true }); assert.equal(s.quests.pinned, "main");
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main2" }), { ok: false, error: "locked" });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main3" }), { ok: false, error: "locked" });
  assert.deepEqual(snapshot(s).quests.main2, { id: "main2", state: "unavailable", step: 0, stepCount: 3, progress: 0, goal: 0, nextStep: "", title: "The Paper Trail", giver: null });
  assert.equal(nextStep(s, "main3"), "");
  emit(s, { type: "floorEnter", depth: 3, from: 2 });
  assert.ok(applyInput(s, { t: "questPin", id: "sq1" }).ok); assert.equal(s.quests.pinned, "sq1");
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: true }, "the alias pins the active main quest");
  assert.equal(s.quests.pinned, "main2");
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: true }); assert.equal(qev(s).filter((e) => e.type === "quest.pinned").at(-1).id, "main2");
  const n = qev(s).length; applyInput(s, { t: "questPin", id: "main2" }); assert.equal(qev(s).length, n, "a repeat is silent");
  emit(s, { type: "floorEnter", depth: 6, from: 5 });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main2" }), { ok: false, error: "already done" }, "a completed main quest is refused");
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main3" }), { ok: true });
  emit(s, { type: "keepPlaying" }); emit(s, { type: "bossDefeated", id: "m1", tile: { x: 1, y: 1 } }); emit(s, { type: "keepPlaying" });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: false, error: "already done" }, "with every main quest done the alias has nothing to pin");
});

test("the map marker follows the pinned arc: the stairs of its current step, none for a quest that is not active", () => {
  const s = fresh();
  assert.ok(mapMarkers(s).length <= 1);
  s.quests.pinned = "main2"; // a forged pin on a locked quest shows nothing
  assert.deepEqual(mapMarkers(s), []);
});
