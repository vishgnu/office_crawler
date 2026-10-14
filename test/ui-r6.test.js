// R6 UI: skill tree connectors from the tree data, the respec confirmation text, and the stylesheet rules that keep the N5 / N6 fixes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, treeView, setLevel, skillTrees, learnSkill, classCards } from "../src/core/index.js";
import { renderTree } from "../src/ui/tree.js";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const town = (cls) => { const s = newGame(1, { class: cls, name: "Tree Tester", start: "town", wearStartKit: true }); setLevel(s, 20); return s; };
const count = (h, re) => (h.match(re) ?? []).length;

test("tree: one connector per prerequisite edge target, one stub per node that has dependants, for every class", () => {
  for (const cls of Object.keys(skillTrees)) {
    const s = town(cls), v = treeView(s), html = renderTree(s);
    const edges = v.branches.flatMap((b) => b.edges), targets = new Set(edges.map((e) => e.to)), sources = new Set(edges.map((e) => e.from));
    assert.equal(count(html, /class="lk /g), targets.size, `${cls}: connectors`);
    assert.equal(count(html, /class="kd/g), sources.size, `${cls}: stubs`);
    assert.ok(targets.size > 0);
  }
});

test("tree: every node sits on the fixed grid (tier row, column 0 to 2) and tiers are grid rows", () => {
  const s = town("it-wizard"), html = renderTree(s);
  for (const b of treeView(s).branches) for (const n of b.nodes) assert.match(html, new RegExp(`data-testid="skill-${n.id}"[^>]*style="--col:${n.col};--row:\\d"`));
  assert.ok(/\.tree \.tnodes \{[^}]*grid-template-columns: 20px repeat\(3, minmax\(0, 1fr\)\)/.test(css));
});

test("tree: the connector turns green only when the prerequisites are met", () => {
  const s = town("facilities-manager"), lk = (id) => renderTree(s).match(new RegExp(`data-testid="skill-${id}"[^>]*><i class="(lk [^"]*)"`))?.[1];
  assert.equal(lk("floor-buffer"), "lk l ok", "the signature is learned: its dependant is connected");
  assert.equal(lk("coffee-break"), "lk l", "Dress Code is not learned yet");
  assert.ok(learnSkill(s, "dress-code").ok);
  assert.equal(lk("coffee-break"), "lk l ok");
  assert.match(lk("fire-drill"), /^lk l ok$|^lk r ok$/);
});

test("respec confirmation names the points it refunds and is only drawn on request", () => {
  const s = town("facilities-manager");
  assert.ok(learnSkill(s, "floor-buffer").ok); assert.ok(learnSkill(s, "floor-buffer").ok); assert.ok(learnSkill(s, "dress-code").ok);
  assert.equal(renderTree(s).includes('data-testid="respec-confirm"'), false);
  const html = renderTree(s, { confirmRespec: true });
  assert.match(html, /data-testid="respec-confirm"/);
  assert.match(html, /You get 3 skill points back/);
  assert.match(html, /Reset, get 3 back/);
  const one = town("facilities-manager"); assert.ok(learnSkill(one, "floor-buffer").ok);
  assert.match(renderTree(one, { confirmRespec: true }), /You get 1 skill point back/);
  assert.equal(renderTree(town("it-wizard"), { confirmRespec: true }).includes("respec-confirm"), false, "nothing to refund: no dialog");
});

test("stylesheet keeps the R6 layout rules (N5 sticky Close row, N6 pause starts at the top and scrolls)", () => {
  assert.match(css, /\.sl-foot \{[^}]*position: sticky/);
  assert.match(css, /\.screen\.pause \{[^}]*justify-content: safe center[^}]*overflow-y: auto/);
  assert.match(css, /\.sv-status\.confirming \.sv-text \{ display: none/);
});

test("character select: unchosen figures are drawn larger than in R5 and every class still has a card", () => {
  const src = readFileSync(new URL("../src/ui/charselect.js", import.meta.url), "utf8");
  assert.match(src, /FIG_SHARE = 0\.6\d?/);
  assert.equal(classCards().length, 3);
});
