// FIX-R7-CORE (code review R7 and ADV-R7): CR7-01 the kill quest stays finishable, CR7-02 the golden proof for a run with stairs and loot and the
// event log window, CR7-05 one rewardSummary, CR7-06 the gear reward is a function of seed and class only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { newGame, step, applyInput, config, content, hashState, hashStateWithout, enterFloor, rewardSummary, rewardOf, checkReqs } from "../src/core/index.js";
import { killMonster } from "../src/core/systems/damage.js";
import { emit } from "../src/core/events.js";
import { replay } from "./helpers.js";

const near = (s, npcId) => {
  const n = s.floor.npcs.find((o) => o.id === npcId);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  s.ui.dialog = null;
  assert.ok(applyInput(s, { t: "interact", id: npcId }).ok);
};
const interns = (s) => s.monsters.filter((m) => m.type === config.quests.kill.monster && m.ai !== "dead" && !m.summoned);
const clearFloor = (s, d) => { enterFloor(s, d); for (const m of s.monsters) if (m.ai !== "dead") killMonster(s, m); enterFloor(s, 0); };

// ---------------------------------------------------------------------------------------------------- CR7-01
for (const seed of [3, 5, 11]) {
  test(`CR7-01 seed ${seed}: floors 1 and 2 cleared before Accept: the interns are back and sq1 can be finished`, () => {
    const s = newGame(seed, { start: "town" });
    for (const d of config.quests.kill.depths) clearFloor(s, d);
    near(s, content.quests.sq1.giver);
    assert.ok(applyInput(s, { t: "questAccept", id: "sq1" }).ok);
    enterFloor(s, 0);
    let alive = 0;
    for (const d of config.quests.kill.depths) { enterFloor(s, d); alive += interns(s).length; if (d !== config.quests.kill.depths.at(-1)) enterFloor(s, 0); }
    assert.ok(alive >= config.quests.kill.count, `${alive} interns for a count of ${config.quests.kill.count}`);
    // kill what is there on the two floors: the quest becomes ready
    for (const d of config.quests.kill.depths) { enterFloor(s, d); for (const m of interns(s)) if (s.quests.sq1.s === "active") killMonster(s, m); }
    assert.deepEqual(s.quests.sq1, { s: "ready", p: config.quests.kill.count });
  });
}

test("CR7-01 the top-up is deterministic (same state twice), never touches state.rng and spawns nothing for a quest that is not accepted", () => {
  const mk = () => { const s = newGame(3, { start: "town" }); for (const d of config.quests.kill.depths) clearFloor(s, d); return s; };
  const a = mk(), b = mk(), none = mk();
  const rng0 = JSON.stringify(a.rng);
  near(a, content.quests.sq1.giver); near(b, content.quests.sq1.giver);
  applyInput(a, { t: "questAccept", id: "sq1" }); applyInput(b, { t: "questAccept", id: "sq1" });
  assert.deepEqual(a.floors, b.floors);
  assert.equal(JSON.stringify(a.rng), rng0);
  assert.notDeepEqual(a.floors, none.floors, "Accept brought some interns back");
  enterFloor(none, 1);
  assert.equal(interns(none).length, 0, "no accepted quest: the cleared floor stays cleared");
});

test("CR7-01 only as many interns come back as the quest needs (a floor with plenty is not touched)", () => {
  const s = newGame(3, { start: "town" });
  enterFloor(s, 1); enterFloor(s, 0);
  const before = JSON.stringify(s.floors);
  near(s, content.quests.sq1.giver);
  applyInput(s, { t: "questAccept", id: "sq1" });
  assert.equal(JSON.stringify(s.floors), before, "nothing killed, nothing revived");
});

// ---------------------------------------------------------------------------------------------------- CR7-02
const STRIP = { paths: ["quests", "player.pouch"], eventPrefixes: ["quest."] };

test("CR7-02 the event log window ignores quest.* entries: the stripped log is the same 256 other events for any run length", () => {
  const withQ = newGame(1), without = newGame(1);
  for (let i = 0; i < 700; i++) {
    emit(without, { type: "hit", n: i });
    emit(withQ, { type: "hit", n: i });
    if (i % 7 === 0) emit(withQ, { type: "quest.progress", id: "sq1", p: i });
  }
  const strip = (s) => s.eventLog.filter((e) => !e.type.startsWith("quest."));
  assert.deepEqual(strip(withQ), without.eventLog);
  assert.equal(without.eventLog.length, 256);
  assert.ok(withQ.eventLog.length <= 256 + 64);
  for (let i = 0; i < 400; i++) emit(withQ, { type: "quest.progress", id: "sq1", p: i }); // quest events alone are capped
  assert.ok(withQ.eventLog.length <= 256 + 64);
  assert.ok(withQ.eventLog.filter((e) => e.type === "hit").length === 256);
});

const runB = JSON.parse(readFileSync("test/fixtures/run-b.json", "utf8"));

test("CR7-02 run-b (the bot from the Lobby to floor 3: stairs, loot, 95 kills, no quest accepted): re-pinned golden and the stripped proof", () => {
  const s = replay(runB, { start: "town" });
  assert.ok(s.deepestDepth >= 3 && s.stats.kills > 50, "the run uses stairs and fights");
  assert.equal(hashState(s), readFileSync("test/fixtures/run-b.hash", "utf8").trim());
  assert.ok(s.eventLog.length === 256, "the log window is full: the strip is exact only because quest entries do not count towards it");
  assert.deepEqual(s.player.pouch, []);
  assert.ok(content.sideIds.every((id) => s.quests[id].s === "available"));
});

test("CR7-02 run-b without any quest system (state.quests removed before the first tick) hashes the same as the full run once the quest subtree and events are stripped", () => {
  const full = replay(runB, { start: "town" });
  const bare = newGame(runB.seed, { start: "town" });
  delete bare.quests; // the quest tap and the floor hooks do nothing without it
  for (let t = 0; t < runB.ticks; t++) step(bare, runB.inputs.filter((i) => i.tick === t).map((i) => i.input));
  assert.equal(hashStateWithout(full, STRIP), hashStateWithout(bare, STRIP), "quests never touched gameplay: spawn order, ids, loot, rng and the event log are identical");
});

test("CR7-02 run-b plays identically with the R7 retarget and hold rules off (they never act in the recorded run)", () => {
  const keep = { r: config.retargetTicks, h: config.holdMaxTicks };
  try {
    const on = hashState(replay(runB, { start: "town" }));
    config.retargetTicks = 1e9; config.holdMaxTicks = 1e9;
    assert.equal(hashState(replay(runB, { start: "town" })), on);
  } finally { config.retargetTicks = keep.r; config.holdMaxTicks = keep.h; }
});

// The pre-quest golden of run-b has to come from the commit before the quests (the orchestrator records it, no git here). Recording: in a worktree of that commit
// copy test/fixtures/run-b.json there and run
//   node --input-type=module -e 'import fs from "fs"; import {replay} from "./test/helpers.js"; import {hashState} from "./src/core/index.js"; console.log(hashState(replay(JSON.parse(fs.readFileSync("test/fixtures/run-b.json")),{start:"town"})))' > test/fixtures/run-b.pre-quests.hash
// then copy that file back here: the test below starts to run by itself.
const preB = "test/fixtures/run-b.pre-quests.hash";
test("CR7-02 run-b: the stripped hash equals the golden recorded before the quests existed", { todo: existsSync(preB) ? false : "needs test/fixtures/run-b.pre-quests.hash from the pre-quest commit (orchestrator)" }, () => {
  assert.ok(existsSync(preB), "no pre-quest golden for run-b yet");
  assert.equal(hashStateWithout(replay(runB, { start: "town" }), STRIP), readFileSync(preB, "utf8").trim());
});

// ---------------------------------------------------------------------------------------------------- CR7-05 / CR7-06
test("CR7-05 rewardSummary is the one source: hard numbers for each side quest, and the payout of rewardOf equals it", () => {
  assert.deepEqual(rewardSummary("sq1"), { gold: 60, xp: 90, potions: 3, gear: null });
  assert.deepEqual(rewardSummary("sq2"), { gold: 90, xp: 140, potions: 0, gear: { slot: "armour", slots: ["body", "head", "hands", "feet"], minRarity: "magic" } });
  assert.deepEqual(rewardSummary("sq3"), { gold: 90, xp: 140, potions: 2, gear: { slot: "weapon", slots: ["weapon"], minRarity: "magic" } });
  assert.equal(rewardSummary("main"), null);
  assert.equal(rewardSummary("nope"), null);
  const s = newGame(4, { start: "town" });
  for (const id of content.sideIds) {
    const r = rewardOf(s, id), sum = rewardSummary(id);
    assert.deepEqual([r.gold, r.xp, r.potions.length, !!r.gear], [sum.gold, sum.xp, sum.potions, !!sum.gear]);
    if (r.gear) assert.ok(sum.gear.slots.includes(r.gear.slot));
  }
});

test("CR7-06 the gear reward depends on seed and class only: level, attributes and bag change nothing", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const id of ["sq2", "sq3"]) {
    const a = newGame(seed, { start: "town" }), b = newGame(seed, { start: "town" });
    b.player.level = 30; b.player.attrs = { grit: 99, agility: 99, stamina: 99, focus: 99 }; b.inventory.items = [];
    assert.deepEqual(rewardOf(a, id), rewardOf(b, id), `${id} seed ${seed}`);
    assert.deepEqual(rewardOf(a, id), rewardOf(a, id));
  }
  assert.notDeepEqual(rewardOf(newGame(4, { start: "town" }), "sq3").gear, rewardOf(newGame(5, { start: "town" }), "sq3").gear);
});

test("CR7-06 the pick is the least demanding of the candidates, so most rewards are wearable by a fresh hero", () => {
  let met = 0, n = 0;
  for (let seed = 1; seed <= 60; seed++) for (const cls of content.classes) for (const id of ["sq2", "sq3"]) {
    const s = newGame(seed, { start: "town", class: cls.id });
    n++; if (checkReqs(s.player, rewardOf(s, id).gear).ok) met++;
  }
  assert.ok(met / n >= 0.9, `${met}/${n} wearable by a level 1 hero`);
});
