// R7-0.5: journal and tracker view models, the key table and the text keys of the contract (section 2.5, 2.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../src/core/index.js";
import { newGame, applyInput, snapshot, content } from "../src/core/index.js";
import { setQuestStep, completeQuest } from "../src/core/cheats.js";
import { T } from "../src/ui/text.js";
import { journalModel, journalHtml, trackerOf, progressText, rewardLines } from "../src/ui/journal.js";
import { DEFAULT_KEYS, ACTIONS, bindKey, defaultKeys, resolveKey } from "../src/input/keymap.js";
import { panelFor } from "../src/input/keys.js";

const qv = (s) => snapshot(s).quests;
const closeBtn = (n, l) => `<button data-close="${n}">${l}</button>`;

test("AC-R-243-3 key table: journal is KeyJ, listed in ACTIONS, remappable, conflicts rejected, J is a panel key", () => {
  assert.equal(DEFAULT_KEYS.journal, "KeyJ"); assert.ok(ACTIONS.includes("journal")); assert.equal(panelFor("KeyJ"), "journal");
  const r = bindKey(defaultKeys(), "journal", "KeyH");
  assert.ok(r.ok); assert.equal(resolveKey("KeyH", r.keys), "KeyJ"); assert.equal(resolveKey("KeyJ", r.keys), null, "the old key does nothing");
  assert.deepEqual(bindKey(defaultKeys(), "journal", "KeyI"), { ok: false, reason: "conflict", with: "inventory" });
});

test("contract 2.5: every UI text key of the quest package exists in T (no new S.* key)", () => {
  const keys = ["journalTitle", "openJournal", "journalClose", "journalActive", "journalCompleted", "journalEmpty", "journalPouch", "journalPouchEmpty", "nextStepLabel", "giverLabel", "progressLabel", "pinAction", "unpinAction", "pinnedMark", "stateAvailable", "stateActive", "stateReady", "stateCompleted", "mainQuestLabel", "sideQuestLabel", "questAccept", "questDecline", "questHandIn", "rewardLabel", "rewardGold", "rewardXp", "rewardGear", "rewardPotions", "bagFullNotice", "readVerdict", "trackerLabel", "mapMarkerStairsDown", "mapMarkerStairsUp", "mapMarkerNpc", "mapMarkerElevator", "stateLocked", "rewardGearAccessory", "rewardGearExact", "slotQuestLine", "toastQuest", "keyJournal", "pauseJournal"];
  for (const k of keys) assert.ok(typeof T[k] === "string" && T[k].length > 0, k);
  assert.ok(T.progressLabel.includes("{n}") && T.progressLabel.includes("{goal}"));
});

test("AC-R-243-2 / AC-R-257-5 journal model: active main first, then the sides in order, the locked main quest last, completed list, next step equals the snapshot, progress, pin state", () => {
  const s = newGame(1, { start: "town" });
  setQuestStep(s, "main2", 2); setQuestStep(s, "sq2", 1); setQuestStep(s, "sq1", 3); setQuestStep(s, "sq4", 1); // main done, main2 at step 2, main3 locked
  const q = qv(s), m = journalModel(q, s.player.pouch, s.scene);
  assert.deepEqual(m.active.map((e) => e.id), ["main2", "sq2", "sq3", "sq4", "sq5"]);
  assert.deepEqual(m.locked.map((e) => e.id), ["main3"]);
  assert.deepEqual(m.completed.map((e) => e.id), ["main", "sq1"]);
  for (const e of [...m.active, ...m.completed]) { assert.equal(e.nextStep, q[e.id].nextStep); assert.equal(e.title, q[e.id].title); }
  assert.equal(m.completed[0].nextStep, ""); assert.equal(m.completed[0].stateText, T.stateCompleted);
  assert.equal(m.active[0].progress, `${T.stepLabel} 2/3`); assert.equal(m.active[0].blurb, content.quests.main2.blurb); assert.ok(m.active[0].nextStep);
  assert.equal(m.active[1].progress, "0/1");
  assert.equal(m.active[2].stateText, T.stateAvailable); assert.equal(m.active[2].giver, q.sq3.giver);
  const lk = m.locked[0];
  assert.equal(lk.lockedText, "Locked. Finish The Paper Trail first."); assert.equal(lk.nextStep, ""); assert.equal(lk.stateText, T.stateLocked);
  assert.ok(!lk.canPin && !lk.canUnpin && !lk.verdict && lk.rewards.length === 0 && lk.progress === "", "no pin on a locked arc");
  assert.ok(m.active[0].pinned && !m.active[0].canPin && !m.active[0].canUnpin, "the active main quest is the pin");
  assert.ok(m.active[1].canPin && !m.active[1].pinned);
  assert.ok([...m.active, ...m.locked].every((e) => e.label.includes(e.stateText)), "the state is in the accessible name as text");
  const html = journalHtml(m, closeBtn);
  assert.ok(html.includes('data-testid="journal-quest-main2"') && html.includes('data-testid="journal-completed"') && html.includes(T.journalPouchEmpty) && html.includes("Locked. Finish The Paper Trail first."));
  assert.ok(html.indexOf('data-quest="sq5"') < html.indexOf('data-quest="main3"'), "the locked row follows the open ones");
  assert.ok(!html.includes('data-testid="journal-next-main3"') && !html.includes('data-testid="journal-pin-main3"'));
  assert.deepEqual(m.active[0].rewards, [`${core.rewardSummary("main2").gold} gold`, `${core.rewardSummary("main2").xp} experience`], "the arc reward text comes from rewardSummary");
  assert.ok(rewardLines("main").length === 2 && rewardLines("main3").length === 0);
  assert.ok(rewardLines("sq5").some((l) => /ring, amulet or belt.*magic/i.test(l)) && !rewardLines("sq5").some((l) => /at least/.test(l)));
  assert.ok(rewardLines("sq4").some((l) => /potions/.test(l)) && !rewardLines("sq4").some((l) => /magic/i.test(l)));
});

test("AC-R-257-4 / AC-R-248-2 pin: pinning a side quest changes the tracker, unpin returns to the active main quest, a completed pinned quest reverts, a locked arc cannot be pinned", () => {
  const s = newGame(1, { start: "town" });
  setQuestStep(s, "sq1", 1);
  assert.equal(trackerOf(qv(s)).id, "main");
  assert.ok(applyInput(s, { t: "questPin", id: "sq1" }).ok);
  let t = trackerOf(qv(s)); assert.equal(t.id, "sq1"); assert.equal(t.text, qv(s).sq1.nextStep); assert.equal(t.title, qv(s).sq1.title);
  const m = journalModel(qv(s), [], "town"); assert.ok(m.active.find((e) => e.id === "sq1").canUnpin);
  assert.ok(m.active.find((e) => e.id === "main").canPin, "an active arc can be pinned while a side quest is");
  assert.equal(applyInput(s, { t: "questPin", id: "main2" }).ok, false, "main2 is locked");
  assert.ok(applyInput(s, { t: "questPin", id: "main" }).ok); assert.equal(trackerOf(qv(s)).id, "main");
  applyInput(s, { t: "questPin", id: "sq1" }); completeQuest(s, "sq1");
  assert.equal(trackerOf(qv(s)).id, "main", "a completed pinned quest reverts to the active main quest");
  setQuestStep(s, "main2", 1); // step 1 of main2 = main completed, main2 open: the pin follows
  assert.equal(qv(s).pinned, "main2"); assert.equal(trackerOf(qv(s)).id, "main2");
});

test("AC-R-248-1 tracker: absent only when no quest is active; text is the next step", () => {
  const s = newGame(1, { start: "town" });
  assert.equal(trackerOf(qv(s)).text, "Take the lift down.");
  completeQuest(s, "main3"); // all three main quests
  assert.equal(trackerOf(qv(s)), null, "main done, the side quests only available: nothing active");
  setQuestStep(s, "sq3", 1);
  assert.equal(trackerOf(qv(s)).id, "sq3");
  assert.equal(trackerOf(undefined), null);
});

test("journal: the Read the verdict action appears on the last step of main3 only, and not on the victory screen", () => {
  const s = newGame(1, { start: "town" });
  const any = (sc) => { const m = journalModel(qv(s), [], sc); return [...m.active, ...m.locked].some((e) => e.verdict); };
  assert.ok(!any("town"));
  setQuestStep(s, "main3", 3); assert.ok(!any("town"), "step 3 of main3 is not the last");
  setQuestStep(s, "main3", 4);
  assert.equal(journalModel(qv(s), [], "floor").active.find((e) => e.id === "main3").verdict, true);
  assert.equal(journalModel(qv(s), [], "victory").active.find((e) => e.id === "main3").verdict, false);
  assert.ok(journalHtml(journalModel(qv(s), [], "floor"), closeBtn).includes('data-testid="journal-verdict"'));
  assert.equal(journalModel(qv(s), [], "floor").completed.map((e) => e.id).join(), "main,main2");
});

test("journal: the pouch lists the quest item by name; hostile text is escaped", () => {
  const s = newGame(1, { start: "town" });
  setQuestStep(s, "sq2", 2);
  const m = journalModel(qv(s), s.player.pouch, "floor");
  assert.deepEqual(m.pouch.map((p) => p.name), [content.quests.sq2.item.name]);
  const evil = { ...qv(s), main: { ...qv(s).main, title: '<img src=x onerror=alert(1)>' } };
  assert.ok(!journalHtml(journalModel(evil, [], "floor"), closeBtn).includes("<img"));
  assert.equal(progressText({ id: "sq1", state: "available", goal: 8, progress: 0 }), "");
});
