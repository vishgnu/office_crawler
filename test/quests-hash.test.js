// R7-3: the goldens are re-pinned a third time because the balance numbers changed (monster hp and damage per depth, xp curve, champion chance, vending machine depth, Emergency Exit price). The proof: under `withLegacyBalance` (the old numbers) the stripped hashes still equal the pre-quest baselines.
// R7-4.1 (AC-R-259-4): the goldens are re-pinned once more because the state gains quests.sq4 and quests.sq5; the proof is unchanged (same baselines).
// Guard: from floor 3 on an arc pays gold and experience, so a recorded run that reaches floor 3 can only be proven with the arc rewards zeroed (see run-b in quests-fix-r7).
// R7-0.1 golden proof (ADR-0007 section 11, AC-R-256-3): the state gains `quests` and `player.pouch`; with those and the quest.* events
// stripped, the recorded runs hash to the goldens as they were before quests (copies in test/fixtures/*.pre-quests.*).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashState, hashStateWithout, content } from "../src/core/index.js";
import { replay } from "./helpers.js";
import { withLegacyBalance } from "./balance-legacy.js";

const script = JSON.parse(readFileSync("test/fixtures/run-a.json", "utf8"));
// R8: the population of floor 1, the start kit and the entry grace changed the sim on purpose, so run-a.json was re-recorded; the pre-quest proof replays the previous recording (run-a.legacy.json, byte-identical to the old run-a.json) under withLegacyBalance.
// CR8-04, what this proves and what it does not: withLegacyBalance restores the balance NUMBERS (hp/damage scaling, xp curve, champion chance, vendor depth, start kit, floor-1 population, entry grace), nothing else.
// The R8 AI changes (holdFarTicks 480->180, the re-click / retarget guard in issueAttack, rewardOf, the vendor belt-first buy) are NOT switched back; the proof passes because the legacy run-a recording does not reach them in a way that changes its hash.
// So it shows: "run-a.legacy, with the quest state and events stripped, hashes to the pre-quest baseline", which is evidence that the quest system adds no gameplay effect on that recording, not that every R8 code path is inert.
// run-c: its R7-3 recording was replaced (R8) and no legacy copy exists in the tree (it cannot be reconstructed without the old file), so run-c has no legacy proof; its protection is the current golden plus the 'no quest system at all' test in quests-fix-r7.test.js.
const legacy = JSON.parse(readFileSync("test/fixtures/run-a.legacy.json", "utf8"));
const pre = readFileSync("test/fixtures/run-a.pre-quests.hash", "utf8").trim();
const preClass = JSON.parse(readFileSync("test/fixtures/run-class.pre-quests.json", "utf8"));
const STRIP = { paths: ["quests", "player.pouch"], eventPrefixes: ["quest."] };

const noArcs = (s) => assert.ok(s.quests.main.m.depth < 3, "this recorded run reaches floor 3: an arc pays, so the proof must zero config.quests.arc.* (as the run-b proof does)");

test("AC-R-259-4 run-a never reaches floor 3 (no arc reward is paid in it) and the stripped proof holds for every class", () => {
  for (const id of [undefined, ...content.classes.map((c) => c.id)]) noArcs(replay(script, id ? { class: id } : {}));
});

test("AC-R-256-3 run-a with the quest state and quest events stripped equals the pre-quest golden", () => {
  const s = replay(script);
  assert.equal(withLegacyBalance(() => hashStateWithout(replay(legacy), STRIP)), pre, "old balance numbers: the pre-quest golden");
  assert.notEqual(hashState(s), pre, "the full hash differs: the state gained quests");
  assert.equal(hashState(s), readFileSync("test/fixtures/run-a.hash", "utf8").trim(), "and equals the re-pinned golden");
});

for (const c of content.classes) {
  test(`AC-R-256-3 ${c.id}: stripped hash equals the pre-quest class golden`, () => {
    const s = replay(script, { class: c.id });
    assert.equal(withLegacyBalance(() => hashStateWithout(replay(legacy, { class: c.id }), STRIP)), preClass[c.id], "old balance numbers: the pre-quest class golden");
    assert.equal(hashState(s), JSON.parse(readFileSync("test/fixtures/run-class.json", "utf8"))[c.id]);
  });
}

test("the recorded runs never touch a quest (they never talk to a giver)", () => {
  const s = replay(script);
  assert.deepEqual(s.player.pouch, []);
  assert.ok(content.sideIds.every((id) => s.quests[id].s === "available"));
  assert.ok(!s.eventLog.some((e) => e.type.startsWith("quest.")), "no quest event: the 256-entry event log window is unchanged by stripping");
});
