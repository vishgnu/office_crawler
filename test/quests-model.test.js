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

test("AC-R-241-1 the main quest has six steps in order with the pinned next-step lines", () => {
  const m = content.quests.main;
  assert.equal(m.steps.length, 6);
  assert.deepEqual(m.steps.map((s) => s.line), LINES);
});

test("AC-R-245-1 side quests: sideCount of them, givers vendor/healer/potions, none from the stash keeper, no new NPC", () => {
  assert.equal(content.sideIds.length, config.quests.sideCount);
  assert.deepEqual(content.sideIds.map((id) => content.quests[id].giver), ["vendor", "healer", "potions"]);
  assert.deepEqual(Object.keys(content.npcs).sort(), ["healer", "potions", "stash", "vendor"]);
  assert.deepEqual(content.questIds, ["main", ...content.sideIds]);
});

for (const c of classes) {
  test(`AC-R-240-1 ${c.id}: newGame starts main at step 1, sides available, and 600 idle ticks change nothing`, () => {
    const s = newGame(5, { class: c.id });
    const q = snapshot(s).quests;
    assert.equal(q.main.state, "active"); assert.equal(q.main.step, 1); assert.equal(q.main.stepCount, 6);
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
  assert.deepEqual(snap.npcs.map((n) => [n.id, n.marker]), [["vendor", "available"], ["healer", "available"], ["potions", "available"], ["stash", "none"]]);
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
  assert.ok(strings.length > 40);
  for (const file of ["ip-denylist.txt", "ip-denylist-brands.txt"]) {
    const words = readFileSync(`docs/product/${file}`, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
    for (const s of strings) for (const w of words) assert.ok(!s.toLowerCase().includes(w), `"${s}" contains "${w}" (${file})`);
  }
});
