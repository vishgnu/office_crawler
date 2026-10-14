// Quest cheats (R7-0.3, contract section 2.7): setQuestStep and completeQuest. Same state, events and cue as the event path; the character stays a legal save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, config, content } from "../src/core/index.js";
import { setQuestStep, completeQuest } from "../src/core/cheats.js";
import { mainStep } from "../src/core/systems/questview.js";
import { schemaProblem, toSave } from "../src/save/index.js";

const hero = () => newGame(5, { class: "facilities-manager", name: "Cheater", start: "town" });
const types = (s) => s.events.map((e) => e.type);
const legal = (s) => assert.equal(schemaProblem(toSave(s)), null);

test("setQuestStep(main, n) goes forward only, emits one quest.step per change, and keeps the save legal at every step", () => {
  for (let n = 2; n <= 6; n++) {
    const s = hero(); s.events.length = 0;
    assert.deepEqual(setQuestStep(s, "main", n), { ok: true });
    assert.equal(mainStep(s.quests.main.m), n);
    assert.deepEqual(s.events.map((e) => [e.type, e.id, e.step]), [["quest.step", "main", n]], `step ${n}`);
    assert.equal(s.events[0].next, content.quests.main.steps[n - 1].line);
    legal(s);
    assert.deepEqual(setQuestStep(s, "main", n), { ok: true }); assert.equal(s.events.length, 1, "same step again is a no-op");
    assert.equal(setQuestStep(s, "main", n - 1).ok, false, "backwards refused");
  }
  const s = hero();
  for (const bad of [0, 7, 1.5, "3", null, undefined]) assert.equal(setQuestStep(s, "main", bad).ok, false, String(bad));
  assert.equal(setQuestStep(s, "nope", 1).ok, false);
});

test("setQuestStep(main, n) sets the same world flags the real events would (deepest floor, boss flags)", () => {
  const s = hero(); setQuestStep(s, "main", 5);
  assert.equal(s.bossUnlocked, true); assert.ok(s.deepestDepth >= config.bossDepth - 1); assert.equal(s.bossDefeated, false);
  setQuestStep(s, "main", 6);
  assert.equal(s.bossDefeated, true); assert.equal(s.quests.main.m.defeated, true); assert.equal(s.quests.main.m.verdict, false);
});

test("completeQuest(main) ends in one quest.completed; asking again changes nothing", () => {
  const s = hero(); s.events.length = 0;
  assert.deepEqual(completeQuest(s, "main"), { ok: true });
  assert.equal(mainStep(s.quests.main.m), 7);
  assert.deepEqual(types(s), ["quest.step", "quest.completed"]);
  legal(s);
  const n = s.events.length; assert.deepEqual(completeQuest(s, "main"), { ok: true }); assert.equal(s.events.length, n);
});

test("setQuestStep on a side quest: 0 available, 1 active, 2 ready (the badge enters the pouch), refusals for bad input", () => {
  const s = hero(); s.events.length = 0;
  assert.equal(setQuestStep(s, "sq1", 1).ok, true);
  assert.deepEqual(s.quests.sq1, { s: "active", p: 0 }); assert.deepEqual(types(s), ["quest.accepted"]);
  assert.equal(setQuestStep(s, "sq1", 2).ok, true);
  assert.deepEqual(s.quests.sq1, { s: "ready", p: 8 }); assert.deepEqual(s.player.pouch, []);
  assert.equal(setQuestStep(s, "sq2", 2).ok, true);
  assert.deepEqual(s.quests.sq2, { s: "ready", p: 1 }); assert.deepEqual(s.player.pouch, [{ id: "qi-sq2", quest: "sq2" }]);
  assert.ok(types(s).includes("quest.item"));
  assert.equal(setQuestStep(s, "sq3", 2).ok, true); assert.deepEqual(s.quests.sq3, { s: "ready", p: 1 });
  legal(s);
  assert.equal(setQuestStep(s, "sq2", 1).ok, true); assert.deepEqual(s.player.pouch, [], "back to active takes the badge away");
  assert.equal(setQuestStep(s, "sq2", 0).ok, true); assert.deepEqual(s.quests.sq2, { s: "available", p: 0 });
  legal(s);
  for (const bad of [-1, 4, 1.5, "1"]) assert.equal(setQuestStep(s, "sq1", bad).ok, false);
});

test("setQuestStep(side, 3) goes through the hand-in path: reward granted, pin moved, save legal; a full bag is returned as bagFull and changes nothing", () => {
  const s = hero(); s.quests.pinned = "sq1"; setQuestStep(s, "sq1", 2);
  const gold = s.player.gold, bag = s.inventory.items.length; s.events.length = 0;
  assert.deepEqual(setQuestStep(s, "sq1", 3), { ok: true });
  assert.equal(s.quests.sq1.s, "completed"); assert.ok(s.player.gold > gold); assert.equal(s.inventory.items.length, bag + config.quests.sq1.potions);
  assert.equal(s.quests.pinned, "main"); assert.ok(types(s).includes("quest.completed"));
  legal(s);
  const c = hero(); setQuestStep(c, "sq2", 2);
  assert.deepEqual(completeQuest(c, "sq2"), { ok: true }); assert.deepEqual(c.player.pouch, []); legal(c);
  assert.equal(completeQuest(c, "sq2").ok, true, "again is a no-op");
  assert.equal(completeQuest(hero(), "nope").ok, false);
  const full = hero(); setQuestStep(full, "sq3", 2);
  for (let y = 0; y < full.inventory.h; y++) for (let x = 0; x < full.inventory.w; x++) if (!full.inventory.items.some((o) => o.x <= x && x < o.x + o.w && o.y <= y && y < o.y + o.h)) full.inventory.items.push({ id: `f${x}_${y}`, base: "x", name: "x", kind: "consumable", rarity: "normal", w: 1, h: 1, x, y });
  const r = setQuestStep(full, "sq3", 3);
  assert.equal(r.ok, false); assert.equal(r.error, "bagFull"); assert.equal(full.quests.sq3.s, "ready");
});
