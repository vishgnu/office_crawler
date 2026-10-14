// R7-0.5: journal and tracker view models, the key table and the text keys of the contract (section 2.5, 2.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, snapshot, content } from "../src/core/index.js";
import { setQuestStep, completeQuest } from "../src/core/cheats.js";
import { T } from "../src/ui/text.js";
import { journalModel, journalHtml, trackerOf, progressText } from "../src/ui/journal.js";
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
  const keys = ["journalTitle", "openJournal", "journalClose", "journalActive", "journalCompleted", "journalEmpty", "journalPouch", "journalPouchEmpty", "nextStepLabel", "giverLabel", "progressLabel", "pinAction", "unpinAction", "pinnedMark", "stateAvailable", "stateActive", "stateReady", "stateCompleted", "mainQuestLabel", "sideQuestLabel", "questAccept", "questDecline", "questHandIn", "rewardLabel", "rewardGold", "rewardXp", "rewardGear", "rewardPotions", "bagFullNotice", "readVerdict", "trackerLabel", "mapMarkerStairsDown", "mapMarkerStairsUp", "mapMarkerNpc", "mapMarkerElevator", "slotQuestLine", "toastQuest", "keyJournal", "pauseJournal"];
  for (const k of keys) assert.ok(typeof T[k] === "string" && T[k].length > 0, k);
  assert.ok(T.progressLabel.includes("{n}") && T.progressLabel.includes("{goal}"));
});

test("AC-R-243-2 journal model: main first, side quests in order, completed list, next step equals the snapshot, progress, pin state", () => {
  const s = newGame(1, { start: "town" });
  setQuestStep(s, "main", 3); setQuestStep(s, "sq2", 1); setQuestStep(s, "sq1", 3); // sq1 completed through the hand-in path
  const q = qv(s), m = journalModel(q, s.player.pouch, s.scene);
  assert.deepEqual(m.active.map((e) => e.id), ["main", "sq2", "sq3"]);
  assert.deepEqual(m.completed.map((e) => e.id), ["sq1"]);
  for (const e of [...m.active, ...m.completed]) { assert.equal(e.nextStep, q[e.id].nextStep); assert.equal(e.title, q[e.id].title); }
  assert.equal(m.completed[0].nextStep, ""); assert.equal(m.completed[0].stateText, T.stateCompleted);
  assert.equal(m.active[0].progress, `${T.stepLabel} 3/6`); assert.equal(m.active[1].progress, "0/1");
  assert.equal(m.active[2].stateText, T.stateAvailable); assert.equal(m.active[2].giver, q.sq3.giver);
  assert.ok(m.active[0].pinned && !m.active[0].canPin && !m.active[0].canUnpin, "main is the default pin");
  assert.ok(m.active[1].canPin && !m.active[1].pinned);
  assert.ok(m.active.every((e) => e.label.includes(e.stateText)), "the state is in the accessible name as text");
  const html = journalHtml(m, closeBtn);
  assert.ok(html.includes('data-testid="journal-quest-main"') && html.includes('data-testid="journal-completed"') && html.includes(T.journalPouchEmpty));
});

test("AC-R-248-2 pin: pinning a side quest changes the tracker, unpin returns to main, a completed pinned quest reverts", () => {
  const s = newGame(1, { start: "town" });
  setQuestStep(s, "sq1", 1);
  assert.equal(trackerOf(qv(s)).id, "main");
  assert.ok(applyInput(s, { t: "questPin", id: "sq1" }).ok);
  let t = trackerOf(qv(s)); assert.equal(t.id, "sq1"); assert.equal(t.text, qv(s).sq1.nextStep); assert.equal(t.title, qv(s).sq1.title);
  const m = journalModel(qv(s), [], "town"); assert.ok(m.active.find((e) => e.id === "sq1").canUnpin);
  assert.ok(applyInput(s, { t: "questPin", id: "main" }).ok); assert.equal(trackerOf(qv(s)).id, "main");
  applyInput(s, { t: "questPin", id: "sq1" }); completeQuest(s, "sq1");
  assert.equal(trackerOf(qv(s)).id, "main", "a completed pinned quest reverts to main");
});

test("AC-R-248-1 tracker: absent only when no quest is active; text is the next step", () => {
  const s = newGame(1, { start: "town" });
  assert.equal(trackerOf(qv(s)).text, "Take the lift down.");
  completeQuest(s, "main");
  assert.equal(trackerOf(qv(s)), null, "main done, the side quests only available: nothing active");
  setQuestStep(s, "sq3", 1);
  assert.equal(trackerOf(qv(s)).id, "sq3");
  assert.equal(trackerOf(undefined), null);
});

test("journal: the Read the verdict action appears on step 6 only, and not on the victory screen", () => {
  const s = newGame(1, { start: "town" });
  assert.ok(journalModel(qv(s), [], "town").active.every((e) => !e.verdict));
  setQuestStep(s, "main", 5); assert.ok(journalModel(qv(s), [], "town").active.every((e) => !e.verdict));
  setQuestStep(s, "main", 6);
  assert.equal(journalModel(qv(s), [], "floor").active[0].verdict, true);
  assert.equal(journalModel(qv(s), [], "victory").active[0].verdict, false);
  assert.ok(journalHtml(journalModel(qv(s), [], "floor"), closeBtn).includes('data-testid="journal-verdict"'));
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
