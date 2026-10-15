// VFIX-R7-UI: the toast lane holds two lines (U3), a single-chain skill branch is one row (N12), the dock badge is capped, the toast and the tracker never repeat a sentence (CSS contract).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, setLevel } from "../src/core/index.js";
import { renderTree } from "../src/ui/tree.js";
import { drawerLayout, TOAST_LANE } from "../src/ui/layout.js";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const panels = readFileSync(new URL("../src/ui/panels.js", import.meta.url), "utf8");

test("U3 phone: the lane under an open drawer holds a two-line toast, so the toast never reaches the potion belt", () => {
  assert.ok(TOAST_LANE >= 48);
  for (const [w, h] of [[390, 844], [360, 740], [320, 640]]) { const D = drawerLayout(w, h); assert.ok(D.bottom <= D.hudTop - 6 - TOAST_LANE, `${w}x${h}`); }
});

test("N12 a branch that is one chain gets the row layout, a branching branch keeps the staircase", () => {
  const c = newGame({ seed: 1, class: "facilities-manager", name: "x" }); setLevel(c, 12);
  const h = renderTree(c).replace("@TABS@", "");
  const lists = h.split('<ul class="tnodes').slice(1).map((s) => s.slice(0, 8));
  assert.ok(lists.some((s) => s.startsWith(" chain")), "maintenance is a chain");
  assert.ok(lists.some((s) => !s.startsWith(" chain")), "safety branches at tier 2");
  const chain = h.slice(h.indexOf('class="tnodes chain"'));
  assert.match(chain, /class="tl ci0" style="--row:1"/);
  assert.match(chain, /class="tnode [^"]*ci1"[^>]*data-tier="2" style="--col:1;--row:2"/);
});

test("U1 the dock badge shows 99+ and keeps the real count for screen readers", () => {
  assert.match(panels, /n > 99 \? "99\+" : n/);
  assert.match(panels, /aria-label="\$\{n\} \$\{esc\(what\)\}"/);
  assert.match(css, /@media \(max-width:340px\)\{#ui\.phone \.dock\{flex-wrap:wrap/);
});

test("U2/U5 the tracker hides while a left panel is open; a toast that repeats the pill or the visible alert is hidden", () => {
  assert.match(panels, /\(D\.phone \? leftOpen \|\| rightOpen : leftOpen\)/);
  assert.match(panels, /el\.tracker\.dataset\.line === tx/);
  assert.match(css, /\.toast\.dup\{visibility:hidden\}/);
});
