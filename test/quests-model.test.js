// R7-0.1 quest model: content, state shape, derived views (AC-R-240-1, 241-1, 242-1, 245-1 data part, 255-1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, snapshot, content, config, nextStep, npcMarker, mapMarkers, questView } from "../src/core/index.js";
import { classes } from "../src/core/content/classes.js";

const LINES = [
  "Take the lift down.",
  "Reach floor 1 and look for what cut the power.",
  "Reach floor 4. Visit the Lobby first: the staff may pay in gear.",
  "Reach floor 8 and find the way up to the Executive Suite.",
  "Defeat the Regional Director.",
  "Read the verdict.",
];

test("AC-R-241-1 the six pre-existing step lines are word for word (steps 1, 2, 4, 8, 9, 10 of the ten); AC-R-257-1 for the whole table", () => {
  assert.deepEqual(content.mainIds, ["main", "main2", "main3"]);
  assert.deepEqual(content.mainIds.map((id) => content.quests[id].steps.length), [3, 3, 4]);
  const steps = content.mainSteps;
  assert.equal(steps.length, 10);
  assert.deepEqual([1, 2, 4, 8, 9, 10].map((n) => steps[n - 1].line), LINES);
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(steps.map((s) => s.id), ["memo", "dark-floor", "cables", "go-deeper", "records", "mail-room", "back-stairs", "executive-floor", "face-director", "report"]);
  assert.deepEqual(steps.map((s) => s.title), ["Read the memo", "Find the dark floor", "Follow the cables", "Go deeper", "Check the records floor", "Find the mail room", "Take the back stairs", "Open the executive floor", "Face the Regional Director", "File the report"]);
  assert.deepEqual(steps.slice(2, 3).concat(steps.slice(4, 7)).map((s) => s.line), ["Follow the power cables down to floor 3.", "Reach floor 5 and look for where the paperwork goes.", "Reach floor 6 and find the mail room.", "Reach floor 7 by the back stairs."]);
  assert.deepEqual(content.mainIds.map((id) => content.quests[id].title), ["Why the Lights Went Out", "The Paper Trail", "Final Notice"]);
  for (const st of steps) { assert.ok(Boolean(st.when.milestone) !== Boolean(st.when.depth), `${st.id} has exactly one predicate`); }
  assert.deepEqual(steps.map((s) => s.when.milestone ?? s.when.depth), ["memo", 1, 3, 4, 5, 6, 7, "unlocked", "defeated", "verdict"]);
  assert.equal(content.quests.main2.unlock, "A new assignment is on your desk: The Paper Trail.");
  assert.equal(content.quests.main3.unlock, "A new assignment is on your desk: Final Notice.");
  assert.equal(content.lockedLine, "Locked. Finish {previous} first.");
});

test("AC-R-245-1 / AC-R-258-1 side quests: sideCount (5) of them, givers vendor/healer/potions/stash/vendor, no new NPC", () => {
  assert.equal(config.quests.sideCount, 5);
  assert.equal(content.sideIds.length, config.quests.sideCount);
  assert.deepEqual(content.sideIds.map((id) => content.quests[id].giver), ["vendor", "healer", "potions", "stash", "vendor"]);
  assert.deepEqual(Object.keys(content.npcs).sort(), ["healer", "potions", "stash", "vendor"]);
  assert.deepEqual(content.questIds, ["main", "main2", "main3", ...content.sideIds]);
  assert.deepEqual(Object.keys(newGame(1).quests), ["main", "sq1", "sq2", "sq3", "sq4", "sq5", "pinned"]);
});

for (const c of classes) {
  test(`AC-R-240-1 ${c.id}: newGame starts main at step 1 (main2 and main3 unavailable), sides available, and 600 idle ticks change nothing`, () => {
    const s = newGame(5, { class: c.id });
    const q = snapshot(s).quests;
    assert.equal(q.main.state, "active"); assert.equal(q.main.step, 1); assert.equal(q.main.stepCount, 3);
    for (const id of ["main2", "main3"]) { assert.equal(q[id].state, "unavailable"); assert.equal(q[id].step, 0); assert.equal(q[id].nextStep, ""); }
    for (const id of content.sideIds) { assert.equal(q[id].state, "available"); assert.equal(q[id].progress, 0); }
    assert.equal(q.pinned, "main");
    assert.deepEqual(s.player.pouch, []);
    const before = structuredClone(s.quests);
    for (let i = 0; i < 600; i++) step(s);
    assert.deepEqual(s.quests, before);
    assert.ok(!s.eventLog.some((e) => e.type.startsWith("quest.")), "no quest event on an idle run");
  });
}

test("AC-R-242-1 nextStep: active = the step line, available = Talk to <giver>, ready = Return to <giver>, completed = empty", () => {
  const s = newGame(5, { start: "town" });
  assert.equal(nextStep(s, "main"), LINES[0]);
  for (const id of content.sideIds) {
    const giver = content.strings[content.npcs[content.quests[id].giver].nameKey];
    assert.ok(nextStep(s, id).startsWith("Talk to") && nextStep(s, id).includes(giver), id);
    s.quests[id] = { s: "active", p: 0 };
    assert.ok(nextStep(s, id).length > 0 && !nextStep(s, id).includes("{"));
    s.quests[id] = { s: "ready", p: 1 };
    assert.ok(nextStep(s, id).startsWith("Return to") && nextStep(s, id).includes(giver), id);
    s.quests[id] = { s: "completed", p: 1 };
    assert.equal(nextStep(s, id), "");
    assert.equal(snapshot(s).quests[id].nextStep, "");
  }
});

test("snapshot adds quests, npcs and map; fixtures without quests still snapshot", () => {
  const s = newGame(5, { start: "town" });
  const snap = snapshot(s);
  assert.deepEqual(snap.npcs.map((n) => [n.id, n.marker]), [["vendor", "available"], ["healer", "available"], ["potions", "available"], ["stash", "available"]]);
  assert.equal(npcMarker(s, "stash"), "available");
  s.quests.sq4 = { s: "active", p: 0 };
  assert.equal(npcMarker(s, "stash"), "none");
  s.quests.sq2 = { s: "ready", p: 1 };
  assert.equal(npcMarker(s, "healer"), "handin");
  assert.deepEqual(snapshot(newGame(5)).npcs, []);
  const bare = newGame(5); delete bare.quests;
  assert.doesNotThrow(() => snapshot(bare));
  assert.deepEqual(mapMarkers(bare), []);
  assert.equal(questView(s).pinned, "main");
});

test("mapMarkers: only the pinned quest, only known targets, with a text label", () => {
  const s = newGame(5, { start: "town" });
  let mk = mapMarkers(s);
  assert.equal(mk.length, 1); assert.equal(mk[0].kind, "elevator"); assert.ok(mk[0].label.length > 0);
  s.quests.pinned = "sq1";
  mk = mapMarkers(s);
  assert.deepEqual(mk.map((m) => [m.quest, m.kind]), [["sq1", "npc"]]);
  s.quests.sq1 = { s: "active", p: 0 };
  assert.deepEqual(mapMarkers(s), []);
  const f = newGame(5); // floor 1, nothing explored yet at the exit
  assert.deepEqual(mapMarkers(f), []);
});

test("AC-R-255-1 every string of content.quests is scanned against both denylists", () => {
  const strings = [];
  (function walk(v) { if (typeof v === "string") strings.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(content.quests);
  assert.ok(strings.length > 70);
  for (const file of ["ip-denylist.txt", "ip-denylist-brands.txt"]) {
    const words = readFileSync(`docs/product/${file}`, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
    for (const s of strings) for (const w of words) assert.ok(!s.toLowerCase().includes(w), `"${s}" contains "${w}" (${file})`);
  }
});
