// R7-0.6: quest section of the NPC window, reward text, quest toasts through messageFor, the slot card quest line (AC-R-247-4, AC-R-249-2, AC-R-254-2, AC-R-252-1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, snapshot, applyInput, content, config } from "../src/core/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { T } from "../src/ui/text.js";
import { messageFor } from "../src/ui/messages.js";
import { rewardLines } from "../src/ui/journal.js";
import { questDialogModel, questDialogHtml } from "../src/ui/questdialog.js";
import { slotQuestText } from "../src/ui/slots.js";

const town = () => newGame(1, { start: "town" });
const qv = (s) => snapshot(s).quests;

test("AC-R-247-4 reward text: gold, experience, gear kind with its minimum rarity, potions; none for main", () => {
  const sq1 = rewardLines("sq1"), sq2 = rewardLines("sq2"), sq3 = rewardLines("sq3");
  assert.ok(sq1.some((l) => /gold/.test(l)) && sq1.some((l) => /experience/.test(l)) && sq1.some((l) => /potions/.test(l)) && !sq1.some((l) => /magic/i.test(l)));
  assert.ok(sq2.some((l) => /armour piece.*magic/i.test(l)) && !sq2.some((l) => /potions/.test(l)));
  assert.ok(sq3.some((l) => /weapon.*magic/i.test(l)) && sq3.some((l) => /potions/.test(l)));
  assert.ok(sq1[0].includes(String(config.quests.sq1.gold.base + config.quests.sq1.gold.perDepth * config.quests.sq1.refDepth)));
  const sq4 = rewardLines("sq4"), sq5 = rewardLines("sq5");
  assert.ok(sq4.some((l) => /gold/.test(l)) && sq4.some((l) => /experience/.test(l)) && sq4.some((l) => /potions/.test(l)) && !sq4.some((l) => /magic|armour|weapon|ring/i.test(l)));
  assert.ok(sq5.some((l) => /a ring, amulet or belt \(magic\)/i.test(l)) && !sq5.some((l) => /potions/.test(l)), sq5.join("|"));
  assert.ok(rewardLines("main").length === 2 && rewardLines("main2").length === 2 && rewardLines("main3").length === 0, "the arcs pay gold and experience, the last pays nothing");
});

test("AC-R-249-2 / AC-R-258-1 the dialog model lists every non-completed quest of a giver in id order and follows the state", () => {
  const s = town();
  assert.deepEqual(questDialogModel(qv(s), "vendor").map((e) => e.id), ["sq1", "sq5"], "the vendor gives two");
  assert.deepEqual(questDialogModel(qv(s), "healer").map((e) => e.id), ["sq2"]);
  assert.deepEqual(questDialogModel(qv(s), "potions").map((e) => e.id), ["sq3"]);
  assert.deepEqual(questDialogModel(qv(s), "stash").map((e) => e.id), ["sq4"], "the stash keeper gives sq4");
  assert.ok(questDialogHtml(questDialogModel(qv(s), "stash")).includes('data-qaccept="sq4"'));
  const two = questDialogHtml(questDialogModel(qv(s), "vendor"));
  assert.ok(two.includes('data-qaccept="sq1"') && two.includes('data-qdecline="sq1"') && two.includes('data-qaccept="sq5"') && two.includes('data-qdecline="sq5"') && two.indexOf("sq1") < two.indexOf("sq5"));
  const off = questDialogModel(qv(s), "vendor")[0];
  assert.equal(off.text, content.quests.sq1.text.offer); assert.ok(off.accept && !off.handIn && off.rewards.length >= 3);
  const html = questDialogHtml([off]);
  assert.ok(html.includes('data-qaccept="sq1"') && html.includes('data-qdecline="sq1"') && !html.includes("data-qhandin"));
  assert.ok(html.includes(content.quests.sq1.text.offer) && html.includes(T.rewardLabel));
  setQuestStep(s, "sq1", 1);
  const act = questDialogModel(qv(s), "vendor")[0];
  assert.equal(act.text, content.quests.sq1.text.progress); assert.match(act.progress, /^0\/\d+$/);
  assert.ok(!questDialogHtml([act]).includes("data-qaccept") && !questDialogHtml([act]).includes("data-qhandin"));
  setQuestStep(s, "sq1", 2);
  const rdy = questDialogModel(qv(s), "vendor")[0];
  assert.ok(rdy.handIn && rdy.text === content.quests.sq1.text.ready);
  assert.ok(questDialogHtml([rdy]).includes('data-qhandin="sq1"'));
  assert.ok(!questDialogHtml([rdy]).includes("quest-bagfull") && !questDialogHtml([rdy]).includes("nq-warn"), "the bag-full refusal UI is gone (R8-Q1)");
  assert.ok(!questDialogHtml([rdy], 0).includes("quest-owed"), "nothing owed: no line");
  assert.ok(questDialogHtml([rdy], 2).includes('data-testid="quest-owed"') && questDialogHtml([rdy], 2).includes("2 items wait until your bag has room"));
  assert.ok(questDialogHtml([rdy], 1).includes("1 item waits until your bag has room"));
  setQuestStep(s, "sq1", 3);
  assert.deepEqual(questDialogModel(qv(s), "vendor").map((e) => e.id), ["sq5"], "with sq1 completed the vendor shows only sq5");
  setQuestStep(s, "sq5", 3);
  const done = questDialogModel(qv(s), "vendor");
  assert.deepEqual(done.map((e) => e.id), ["sq1", "sq5"], "when nothing is left the done lines show");
  assert.equal(done[0].text, content.quests.sq1.text.done); assert.deepEqual(done[0].rewards, []);
  assert.ok(!/<button/.test(questDialogHtml(done)));
});

test("AC-R-254-2 quest toasts through messageFor: accepted, step, completed; hand-in refusal; quest.item and pinned stay silent", () => {
  const s = town();
  assert.equal(messageFor({ type: "quest.accepted", id: "sq1", title: "Intern Overflow", next: "Defeat zombie interns on floors 1 and 2." }, s), "Intern Overflow: Defeat zombie interns on floors 1 and 2.");
  assert.equal(messageFor({ type: "quest.step", id: "main", title: "Why the Lights Went Out", next: "Go deeper." }, s), "Why the Lights Went Out: Go deeper.");
  const done = messageFor({ type: "quest.completed", id: "sq1", title: "Intern Overflow", rewards: { gold: 60, xp: 90, items: ["Health Potion"] } }, s);
  assert.ok(done.startsWith("Intern Overflow: completed") && done.includes("60 gold") && done.includes("90 experience") && done.includes("Health Potion"), done);
  assert.equal(messageFor({ type: "quest.step", id: "main2", step: 1, title: "The Paper Trail", next: "Reach floor 4.", unlocked: true }, s), "A new assignment is on your desk: The Paper Trail.", "an unlock toast names the new assignment");
  assert.equal(messageFor({ type: "quest.step", id: "main3", step: 1, title: "Final Notice", next: "Reach floor 7 by the back stairs.", unlocked: true }, s), "A new assignment is on your desk: Final Notice.");
  const arc = messageFor({ type: "quest.completed", id: "main", title: "Why the Lights Went Out", rewards: { gold: 50, xp: 65, items: [] } }, s);
  assert.ok(arc.includes("completed") && arc.includes("50 gold") && arc.includes("65 experience"), arc);
  assert.equal(messageFor({ type: "quest.completed", id: "main", title: "Why", rewards: { gold: 0, xp: 0, items: [] } }, s), "Why: completed");
  assert.equal(messageFor({ type: "quest.handInRefused", id: "sq2", reason: "bagFull" }, s), null, "the refusal no longer exists in the core: no line");
  const owed = messageFor({ type: "quest.completed", id: "sq2", title: "Cold Case", rewards: { gold: 10, xp: 20, items: ["Hard Hat"], owed: 1 } }, s);
  assert.ok(owed.includes("Hard Hat") && owed.endsWith("1 item waits until your bag has room."), owed);
  assert.ok(messageFor({ type: "quest.completed", id: "sq2", title: "Cold Case", rewards: { gold: 10, xp: 20, items: ["a", "b"], owed: 2 } }, s).endsWith("2 items wait until your bag has room."));
  assert.equal(messageFor({ type: "quest.item", id: "qi-sq2", quest: "sq2", name: "x" }, s), null);
  assert.equal(messageFor({ type: "quest.pinned", id: "sq2" }, s), null);
});

test("AC-R-252-1 / AC-R-259-2 slot card quest line: the title of the global step (1..10) and N/5; none for entries without quest fields", () => {
  const base = { state: "ok", qv: 5, mainStep: 3, mainDone: false, sidesDone: 1 };
  assert.equal(config.quests.sideCount, 5);
  assert.equal(slotQuestText(base), `${content.mainSteps[2].title} · 1/5`);
  assert.equal(slotQuestText({ ...base, mainStep: 4, sidesDone: 0 }), "Go deeper · 0/5", "step 4 is the first step of The Paper Trail");
  assert.equal(slotQuestText({ ...base, mainStep: 10, sidesDone: 4 }), `${content.mainSteps[9].title} · 4/5`);
  assert.equal(slotQuestText({ ...base, mainStep: 10, mainDone: true, sidesDone: 5 }), `${T.slotMainDone} · 5/5`);
  assert.equal(slotQuestText({ state: "empty" }), ""); assert.equal(slotQuestText({ state: "bad" }), ""); assert.equal(slotQuestText({ state: "newer" }), "");
  assert.equal(slotQuestText({ state: "ok" }), "");
});

test("the hand-in needs the giver window: without it the core refuses with no dialog (the UI sends it only from the window)", () => {
  const s = town();
  setQuestStep(s, "sq1", 2);
  assert.equal(qv(s).sq1.state, "ready");
  const r = applyInput(s, { t: "questHandIn", id: "sq1" });
  assert.equal(r.ok, false); assert.equal(r.error, "no dialog"); // the gate needs the giver's window; the UI only sends it from there
});
