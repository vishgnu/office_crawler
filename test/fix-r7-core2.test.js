// FIX-R7-CORE-2: ADV-R7-07 (own-property quest ids), ADV-R7-08/09 (kill quest progress against depth and the shared kill counter, legal states still load).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput } from "../src/core/index.js";
import { checksumOf, deserialize, serialize } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { setQuestStep, completeQuest } from "../src/core/cheats.js";

const hero = (seed = 5) => newGame(seed, { class: "facilities-manager", name: "Fix", start: "town", wearStartKit: true });
const seal = (o) => { const { checksum, ...rest } = o; return canonical({ ...rest, checksum: checksumOf(rest) }); };
const forge = (mut, { depth = 6, kills } = {}) => {
  const o = JSON.parse(serialize(hero()));
  o.deepestDepth = depth; o.quests.main.m.depth = depth; o.quests.main.m.memo = true; o.quests.pinned = depth >= 6 ? "main3" : depth >= 3 ? "main2" : "main";
  if (kills !== undefined) o.stats.kills = kills;
  mut(o);
  return deserialize(seal(o));
};

test("ADV-R7-07 prototype keys are not quests: no input or cheat takes them, nothing is pinned, the state still saves and loads", () => {
  for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    const s = hero(), before = JSON.stringify(s.quests);
    for (const t of ["questPin", "questAccept", "questHandIn"]) assert.equal(applyInput(s, { t, id }).ok, false, `${t} ${id}`);
    assert.equal(setQuestStep(s, id, 1).ok, false, `setQuestStep ${id}`);
    assert.equal(completeQuest(s, id).ok, false, `completeQuest ${id}`);
    assert.equal(JSON.stringify(s.quests), before, id);
    assert.equal(deserialize(serialize(s)).ok, true, id);
  }
});

test("ADV-R7-08 a partial kill quest progress needs the kill floors reached (sq5 p 3: floor 5; sq1 p 3: floor 1); with them it loads", () => {
  assert.equal(forge((o) => { o.quests.sq5 = { s: "active", p: 3 }; }, { depth: 4, kills: 9 }).ok, false);
  assert.equal(forge((o) => { o.quests.sq5 = { s: "active", p: 3 }; }, { depth: 5, kills: 9 }).ok, true);
  assert.equal(forge((o) => { o.quests.sq5 = { s: "active", p: 0 }; }, { depth: 1 }).ok, true, "no progress, no floor needed");
  assert.equal(forge((o) => { o.quests.sq1 = { s: "active", p: 3 }; }, { depth: 1, kills: 3 }).ok, true);
});

test("ADV-R7-09 finished kill quests share the counter: sq1 (8) and sq5 (6) ready need 14 kills; 13 is refused, 14 and a single finished quest load", () => {
  const both = (o) => { o.quests.sq1 = { s: "ready", p: 8 }; o.quests.sq5 = { s: "ready", p: 6 }; };
  assert.equal(forge(both, { kills: 8 }).ok, false);
  assert.equal(forge(both, { kills: 13 }).ok, false);
  assert.equal(forge(both, { kills: 14 }).ok, true);
  assert.equal(forge((o) => { o.quests.sq1 = { s: "completed", p: 8 }; o.quests.sq5 = { s: "ready", p: 6 }; }, { kills: 14 }).ok, true);
  assert.equal(forge((o) => { o.quests.sq5 = { s: "ready", p: 6 }; }, { kills: 6 }).ok, true);
});

test("ADV-R7-09 the quest cheats keep the pair legal: sq1 and sq5 made ready or completed (either order) save and load", () => {
  for (const order of [["sq1", "sq5"], ["sq5", "sq1"]]) {
    for (const finish of [setQuestStep, completeQuest]) {
      const s = hero();
      for (const id of order) assert.ok((finish === setQuestStep ? setQuestStep(s, id, 2) : completeQuest(s, id)).ok, id);
      const r = deserialize(serialize(s));
      assert.equal(r.ok, true, `${order} ${finish.name}: ${r.message}`);
    }
  }
});
