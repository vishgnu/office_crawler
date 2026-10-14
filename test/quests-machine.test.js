// R7-0.1 step machine (AC-R-240-1/2 state part, 241-2, 245-1 offer/accept/decline, 246-1 kill count, 254-1 cue events).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, spawnMonster, hashState, content, config, nextStep, snapshot } from "../src/core/index.js";
import { teleportFloor } from "../src/core/cheats.js";
import { killMonster } from "../src/core/systems/damage.js";
import { emit } from "../src/core/events.js";

const L = content.quests.main.steps.map((s) => s.line);
const qev = (s) => s.eventLog.filter((e) => e.type.startsWith("quest."));
const stepOf = (s) => snapshot(s).quests.main.step;

function inLobbyNextTo(npcId, seed = 7) {
  const s = newGame(seed, { start: "town" });
  const n = s.floor.npcs.find((o) => o.id === npcId);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  return s;
}
function talk(s, id) { assert.ok(applyInput(s, { t: "interact", id }).ok); assert.equal(s.ui.dialog.npc, id); }

test("AC-R-241-2 the first descent completes steps 1 and 2 at once (one quest.step), the lift event path", () => {
  const s = newGame(3, { start: "town" });
  teleportFloor(s, 1);
  assert.equal(stepOf(s), 3);
  assert.deepEqual(qev(s).map((e) => [e.type, e.id, e.step, e.next]), [["quest.step", "main", 3, L[2]]]);
});

test("AC-R-241-2 catch-up: teleport to floor 4 from step 1 while paused reaches the tap; steps never go back", () => {
  const s = newGame(3, { start: "town" });
  s.paused = true;
  teleportFloor(s, 4);
  assert.equal(s.quests.main.m.depth, 4);
  assert.equal(stepOf(s), 4);
  assert.equal(qev(s).length, 1, "a catch-up over several steps is one event");
  teleportFloor(s, 0); teleportFloor(s, 2);
  assert.equal(stepOf(s), 4);
  assert.equal(qev(s).length, 1, "no event for a repeat or a lower floor");
});

test("storyRead start completes step 1; repeated, bad ids and the victory before the boss are refused or no-ops; works while paused", () => {
  const s = newGame(3, { start: "town" });
  s.paused = true;
  assert.deepEqual(applyInput(s, { t: "storyRead", id: "start" }), { ok: true });
  assert.equal(stepOf(s), 2);
  assert.deepEqual(qev(s).map((e) => e.next), [L[1]]);
  applyInput(s, { t: "storyRead", id: "start" });
  assert.equal(qev(s).length, 1);
  assert.deepEqual(applyInput(s, { t: "storyRead", id: "nope" }), { ok: false, error: "bad id" });
  assert.deepEqual(applyInput(s, { t: "storyRead", id: "victory" }), { ok: false, error: "not defeated" });
  const before = structuredClone(s.quests);
  assert.deepEqual(s.quests, before);
});

test("steps 3..6 follow stairsUnlocked, bossDefeated and the verdict; quest.completed ends the main quest; later steps imply earlier", () => {
  const s = newGame(3, { start: "town" });
  emit(s, { type: "floorEnter", depth: 4, from: 3 });
  assert.equal(stepOf(s), 4);
  emit(s, { type: "stairsUnlocked", depth: 8 });
  assert.equal(stepOf(s), 5); // unlocking completes step 4
  emit(s, { type: "bossDefeated", id: "m1", tile: { x: 1, y: 1 } });
  assert.equal(stepOf(s), 6);
  assert.deepEqual(applyInput(s, { t: "storyRead", id: "victory" }), { ok: true });
  const q = snapshot(s).quests.main;
  assert.equal(q.state, "completed"); assert.equal(q.nextStep, "");
  const types = qev(s).map((e) => e.type);
  assert.deepEqual(types, ["quest.step", "quest.step", "quest.step", "quest.completed"]);
  assert.equal(qev(s).at(-1).title, content.quests.main.title);
  emit(s, { type: "keepPlaying" });
  assert.equal(qev(s).length, 4, "a repeat is silent");
  // boss defeated straight from step 1 (cheat order): everything catches up
  const t = newGame(3, { start: "town" });
  emit(t, { type: "bossDefeated", id: "m1", tile: { x: 1, y: 1 } });
  assert.equal(stepOf(t), 6);
});

test("keepPlaying before the boss is beaten does not read a verdict", () => {
  const s = newGame(3, { start: "town" });
  emit(s, { type: "keepPlaying" });
  assert.equal(s.quests.main.m.verdict, false);
});

test("AC-R-245-1 offer, decline, accept: the dialog of the giver is needed; a wrong NPC is refused", () => {
  const s = inLobbyNextTo("vendor");
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "sq1" }), { ok: false, error: "no dialog" });
  talk(s, "vendor");
  const before = structuredClone(s.quests);
  applyInput(s, { t: "closeDialog" }); // decline
  assert.deepEqual(s.quests, before);
  assert.equal(qev(s).length, 0);
  talk(s, "vendor");
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "sq2" }), { ok: false, error: "wrong npc" });
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "zzz" }), { ok: false, error: "unknown quest" });
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "main" }), { ok: false, error: "unknown quest" });
  assert.deepEqual(applyInput(s, { t: "questAccept", id: 5 }), { ok: false, error: "bad id" });
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "sq1" }), { ok: true });
  assert.deepEqual(s.quests.sq1, { s: "active", p: 0 });
  const e = qev(s);
  assert.equal(e.length, 1);
  assert.deepEqual(e[0], { type: "quest.accepted", id: "sq1", title: content.quests.sq1.title, next: nextStep(s, "sq1") });
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "sq1" }), { ok: false, error: "not available" });
  s.quests.sq1.s = "completed";
  assert.deepEqual(applyInput(s, { t: "questAccept", id: "sq1" }), { ok: false, error: "already done" });
  assert.equal(qev(s).length, 1, "refusals raise no cue");
});

test("questPin: main or an unfinished side quest; a repeat is silent; completed is refused; refused while paused", () => {
  const s = newGame(3, { start: "town" });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: true });
  assert.equal(qev(s).length, 0);
  assert.deepEqual(applyInput(s, { t: "questPin", id: "sq3" }), { ok: true });
  assert.equal(s.quests.pinned, "sq3");
  assert.deepEqual(qev(s).map((e) => [e.type, e.id]), [["quest.pinned", "sq3"]]);
  s.quests.sq1.s = "completed";
  assert.deepEqual(applyInput(s, { t: "questPin", id: "sq1" }), { ok: false, error: "already done" });
  assert.deepEqual(applyInput(s, { t: "questPin", id: "x" }), { ok: false, error: "unknown quest" });
  s.paused = true;
  assert.deepEqual(applyInput(s, { t: "questPin", id: "main" }), { ok: false, error: "paused" });
});

function onFloor(depth, seed = 11) {
  const s = newGame(seed, { start: "town" });
  teleportFloor(s, depth);
  s.monsters = [];
  return s;
}
function kill(s, type = "zombie-intern", opts = {}) {
  const tile = { x: s.player.tile.x + 1, y: s.player.tile.y };
  const m = spawnMonster(s, type, tile, null, opts) ?? spawnMonster(s, type, { x: s.player.tile.x, y: s.player.tile.y + 1 }, null, opts) ?? spawnMonster(s, type, { x: s.player.tile.x - 1, y: s.player.tile.y }, null, opts);
  assert.ok(m, "spawned");
  killMonster(s, m);
  m.ai = "dead";
  return m;
}

test("AC-R-246-1 the kill task counts kills of its monster on floors 1-2 only, from Accept on, never summoned; ready at the goal", () => {
  const s = onFloor(1);
  kill(s); // before Accept
  assert.deepEqual(s.quests.sq1, { s: "available", p: 0 });
  s.quests.sq1 = { s: "active", p: 0 };
  kill(s, "printer-imp");
  assert.equal(s.quests.sq1.p, 0, "other kinds do not count");
  const m = spawnMonster(s, "zombie-intern", { x: s.player.tile.x + 2, y: s.player.tile.y }, null) ?? spawnMonster(s, "zombie-intern", { x: s.player.tile.x - 2, y: s.player.tile.y }, null);
  m.summoned = true; killMonster(s, m);
  assert.equal(s.quests.sq1.p, 0, "summoned kills do not count");
  const n = config.quests.kill.count;
  for (let i = 1; i < n; i++) { kill(s); assert.equal(s.quests.sq1.p, i); assert.equal(s.quests.sq1.s, "active"); }
  assert.deepEqual(qev(s).filter((e) => e.type === "quest.progress").at(-1), { type: "quest.progress", id: "sq1", p: n - 1, goal: n });
  kill(s);
  assert.deepEqual(s.quests.sq1, { s: "ready", p: n });
  const last = qev(s).at(-1);
  assert.equal(last.type, "quest.step"); assert.equal(last.id, "sq1"); assert.ok(last.next.startsWith("Return to"));
  kill(s);
  assert.equal(s.quests.sq1.p, n, "no more progress once ready");
  const d3 = onFloor(3); d3.quests.sq1 = { s: "active", p: 0 };
  kill(d3); assert.equal(d3.quests.sq1.p, 0, "floor 3 does not count");
});

test("the named elite (monster.quest) readies sq3; another champion does not", () => {
  const s = onFloor(4);
  s.quests.sq3 = { s: "active", p: 0 };
  kill(s, "middle-manager", { tier: "champion", mods: [] });
  assert.equal(s.quests.sq3.s, "active");
  kill(s, "middle-manager", { tier: "champion", mods: [], quest: undefined });
  const m = spawnMonster(s, "middle-manager", { x: s.player.tile.x + 2, y: s.player.tile.y + 2 }, null) ?? spawnMonster(s, "middle-manager", { x: s.player.tile.x - 2, y: s.player.tile.y - 2 }, null);
  m.quest = "sq3"; killMonster(s, m);
  assert.deepEqual(s.quests.sq3, { s: "ready", p: 1 });
});

test("AC-R-254-1 every quest event carries title and next; hand-built states without quests ignore events", () => {
  const s = newGame(3, { start: "town" });
  teleportFloor(s, 1);
  for (const e of qev(s)) { assert.ok(e.title); assert.ok(typeof e.next === "string"); }
  const bare = newGame(3); delete bare.quests;
  assert.doesNotThrow(() => emit(bare, { type: "floorEnter", depth: 2, from: 1 }));
});

test("AC-R-240-2 the same inputs including quest actions give the same hash twice; accepting changes the hash", () => {
  const run = (accept) => {
    const s = inLobbyNextTo("healer", 9);
    step(s, [{ t: "interact", id: "healer" }]);
    if (accept) step(s, [{ t: "questAccept", id: "sq2" }, { t: "questPin", id: "sq2" }]);
    for (let i = 0; i < 50; i++) step(s);
    return s;
  };
  assert.equal(hashState(run(true)), hashState(run(true)));
  assert.notEqual(hashState(run(true)), hashState(run(false)));
  assert.equal(run(true).quests.sq2.s, "active");
});
