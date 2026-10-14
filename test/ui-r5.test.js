// R5 UI: pure parts of the class selection, slot manager and skill tree (the DOM parts are covered by e2e/r5ui.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, newGame, treeView, classCards, setLevel, skillTrees } from "../src/core/index.js";
import { skillIcon } from "../src/ui/icons.js";
import { nodeTipHtml, rowsHtml } from "../src/ui/tree.js";
import { fmtPlay, fmtWhen, fmtStamp, errorText, slotSummary } from "../src/ui/slots.js";
import { T } from "../src/ui/text.js";

test("every skill, branch and class of the R4 contract has an icon", () => {
  for (const id of Object.keys(content.skills)) assert.ok(skillIcon(id), `skill icon ${id}`);
  for (const c of classCards()) {
    assert.ok(skillIcon(`class:${c.id}`), `class icon ${c.id}`);
    for (const b of c.branches) assert.ok(skillIcon(b.iconKey), `branch icon ${b.iconKey}`);
  }
});

test("tree tooltips: numbers now and next level, requirements and lock reasons come from the core view", () => {
  const s = newGame(1, { class: "facilities-manager", name: "Tip Tester", start: "town", wearStartKit: true });
  setLevel(s, 20);
  const nodes = treeView(s).branches.flatMap((b) => b.nodes);
  const learned = nodes.find((n) => n.id === "pallet-slam"), locked = newGame(1, { class: "facilities-manager", name: "T", start: "town" });
  const html = nodeTipHtml(learned);
  assert.match(html, /Pallet Slam/); assert.match(html, /Now/); assert.match(html, /Next level/); assert.match(html, /Mana/);
  const lockedNode = treeView(locked).branches.flatMap((b) => b.nodes).find((n) => n.state === "locked-level");
  assert.match(nodeTipHtml(lockedNode), /Needs character level/);
  assert.equal(rowsHtml([{ labelKey: "statDamage", value: "<b>1-2</b>", type: "fire" }]).includes("<b>1-2</b>"), false, "values are escaped");
});

test("each class tree has the shape the panel renders: 3 branches, 10 nodes, tiers 1 to 3, columns 0 to 2", () => {
  for (const [id, tree] of Object.entries(skillTrees)) {
    assert.equal(tree.branches.length, 3, id);
    const n = tree.branches.flatMap((b) => b.skills.map((s) => tree.skills[s]));
    assert.equal(n.length, 10, id);
    for (const d of n) { assert.ok(d.tier >= 1 && d.tier <= 3, `${d.id} tier`); assert.ok(d.col >= 0 && d.col <= 2, `${d.id} col`); }
  }
});

test("slot list formatting: play time h:mm, relative last played, error texts for every session error", () => {
  assert.equal(fmtPlay(0), "0:00"); assert.equal(fmtPlay(3725), "1:02"); assert.equal(fmtPlay(undefined), "0:00");
  const now = 1_000_000_000_000;
  assert.equal(fmtWhen(now - 5000, now), "just now"); assert.equal(fmtWhen(now - 5 * 60000, now), "5 min ago"); assert.equal(fmtWhen(now - 3 * 3600000, now), "3 h ago");
  assert.equal(fmtWhen(NaN, now), "");
  for (const e of ["bad-name", "bad-slot", "empty-slot", "occupied", "confirm-required", "corrupt", "newer", "quota", "too-large", "write-failed", "another-tab", "playing", "no-storage", "bad-class"]) assert.ok(errorText(e).length > 5, e);
  // CR-12: the card shows the DEEPEST floor (contract field `deepest`), not where the character stands, and date plus time of the last save
  assert.match(slotSummary({ class: "it-wizard", level: 9, depth: 0, deepest: 0, playSec: 600 }), /IT Wizard · Level 9 · Deepest: Lobby · 0:10 played/);
  assert.match(slotSummary({ class: "sales-rep", level: 3, depth: 1, deepest: 4, playSec: 0 }), /Deepest floor 4/);
  assert.match(slotSummary({ class: "sales-rep", level: 1, depth: 0, deepest: 1, playSec: 0 }), /Deepest: Lobby/);
  assert.match(slotSummary({ class: "sales-rep", level: 1, depth: 1, deepest: 1, playSec: 0 }), /Deepest floor 1/);
  assert.doesNotMatch(slotSummary({ class: "sales-rep", level: 3, depth: 1, deepest: 4, playSec: 0 }), /Floor 1/);
  const iso = "2026-10-14T09:41:00.000Z", st = fmtStamp({ savedAt: iso });
  assert.match(st, /2026/); assert.match(st, /\d{1,2}[:.]\d{2}/, "has a time");
  assert.equal(fmtStamp({ lastPlayed: Date.parse(iso) }), st, "the older lastPlayed field gives the same stamp");
  assert.equal(fmtStamp({}), ""); assert.equal(fmtStamp({ savedAt: "not a date" }), "");
});

test("R5 UI strings: every respec and learn error code has a message", () => {
  for (const k of ["not-in-town", "dead", "respec-off", "respec-used", "no-gold"]) assert.ok(T.trRespecFail[k], k);
  for (const k of ["level-gate", "prereq", "no-points", "max-level", "basic", "wrong-class"]) assert.ok(T.trLearnFail[k], k);
});
