// FIX-R8T-3-UI: pure logic and source/CSS contracts (the pixels are checked by e2e/r8t3-fix.mjs and screenshots).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createToastQueue } from "../src/ui/toastqueue.js";
import { drawerLayout, hudLayout, SHORT_MAX_H } from "../src/ui/layout.js";
import { effCol } from "../src/ui/tree.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/style.css"), game = read("../src/game.js"), panels = read("../src/ui/panels.js");

function lane() {
  let t = 1000; const timers = [], shown = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: () => t, setT: (fn, ms) => { timers.push({ at: t + ms, fn }); return timers.length; }, clearT: (id) => { if (id && timers[id - 1]) timers[id - 1].fn = null; } });
  const advance = (ms) => { t += ms; for (const x of timers) if (x.fn && x.at <= t) { const f = x.fn; x.fn = null; f(); } };
  return { q, shown, advance };
}
const quest = { quest: true, kind: "quest.step", qid: "q1" }, passive = (kind) => ({ passive: true, kind }), urgent = (kind) => ({ urgent: true, kind });

test("L-6 an urgent line (respawn, Emergency Exit) shows at once over a held quest line and clears stale passive lines; the quest line that waits is kept", () => {
  const { q, shown } = lane();
  q.offer("Quest A", 4000, quest);
  q.offer("Quest B waiting", 4000, { ...quest, qid: "q2" });
  q.offer("Drank coffee", undefined, passive("potion"));
  q.offer("Floor 1", undefined, passive("floorEnter"));
  q.offer("Back in the Lobby.", undefined, urgent("respawn"));
  assert.equal(shown.at(-1), "Back in the Lobby.");
  assert.ok(!q.waiting().includes("Drank coffee") && !q.waiting().includes("Floor 1"), q.waiting().join("|"));
  assert.ok(q.waiting().includes("Quest B waiting"), "a quest line is never dropped");
});

test("L-6 one dispatch: the urgent line is first and keeps the lane, the floor name of the same dispatch waits behind it", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest A", 4000, quest);
  q.begin(); q.offer("Lobby", undefined, passive("floorEnter")); q.offer("Back in the Lobby.", undefined, urgent("respawn")); q.end();
  assert.deepEqual(shown, ["Quest A", "Back in the Lobby."]);
  assert.deepEqual(q.waiting(), ["Quest A", "Lobby"], "R11-03: the quest line that was on screen is put back, ahead of the passive line");
  advance(3200); assert.equal(shown.at(-1), "Quest A");
  advance(4000); assert.equal(shown.at(-1), "Lobby");
});

test("L-6 an urgent line with an idle lane shows and later passive lines wait behind it for its time; the same text twice is shown once", () => {
  const { q, shown, advance } = lane();
  q.offer("Emergency Exit: a door opens.", undefined, urgent("portalOpen"));
  q.offer("Level 3!", undefined, passive("levelup"));
  assert.deepEqual(shown, ["Emergency Exit: a door opens."]);
  q.offer("Emergency Exit: a door opens.", undefined, urgent("portalOpen"));
  assert.equal(shown.length, 1);
  advance(3200); assert.deepEqual(shown, ["Emergency Exit: a door opens.", "Level 3!"]);
});

test("L-6 game.js: respawn and the Emergency Exit lines are urgent, not passive (the event path and the nudge rule run in test/ui-r11-behaviour.test.js)", () => {
  assert.match(game, /URGENT_LINES = new Set\(\["respawn", "portalOpen", "portalUse"\]\)/);
  assert.doesNotMatch(game, /PASSIVE_LINES = new Set\([^)]*"respawn"/);
});

test("L-1 drawerLayout: a short landscape phone gets one full-height panel (bottom near the viewport edge); portrait and desktop keep the HUD band", () => {
  for (const [w, h] of [[667, 375], [740, 360], [844, 390]]) {
    const D = drawerLayout(w, h);
    assert.equal(D.short, true, `${w}x${h}`); assert.ok(h - D.bottom <= 44 && D.bottom - D.top >= h - 60, `${w}x${h} ${D.top}..${D.bottom}`);
    assert.ok(D.cell <= 36, "small cells so the bag fits beside the equipment");
    const old = Math.floor(hudLayout(w, h).panel.y - 6 - 48); assert.ok(D.bottom > old + 100, "much taller than the old band above the hotbar");
  }
  for (const [w, h] of [[390, 844], [360, 640], [1280, 720], [1366, 768], [1920, 1080]]) assert.equal(drawerLayout(w, h).short, false, `${w}x${h}`);
  assert.equal(SHORT_MAX_H, 430);
});

test("L-1 contracts: the tabs move into the header, the hotbar hides under the panel, bag beside the equipment (CSS and source)", () => {
  assert.match(panels, /ph\.insertBefore\(tabs, x\)/);
  assert.match(panels, /root\.classList\.toggle\("short-panel"/);
  assert.match(css, /#ui\.short-panel \.hudui \{ visibility: hidden; \}/);
  assert.match(css, /#ui\.short \.dollrow \{ display: contents; \}/);
  assert.match(css, /#ui\.short \.gridwrap \{ grid-column: 2; grid-row: 2;/);
});

test("L-2 contract: on the portrait phone the belt sits beside the equipment at the bag's cell size", () => {
  assert.match(css, /#ui\.phone:not\(\.short\) \.dollrow \{ flex-direction: row;/);
  assert.match(css, /#ui\.phone:not\(\.short\) \.bgrid \{ grid-template-columns: repeat\(2, var\(--cw\)\)/);
});

test("L-3 contract: the quest pill, the toast and the tooltip are hidden behind the death screen", () => {
  assert.match(css, /#ui\.scene-dead \.tracker, #ui\.scene-dead \.toast, #ui\.scene-dead \.tip \{ visibility: hidden; \}/);
});

test("L-5 effCol: a lone tier-1 card with two children in adjacent columns sits between them; chains, pairs in one tier and other shapes do not move", () => {
  const b = { nodes: [{ id: "a", tier: 1, col: 0 }, { id: "b", tier: 2, col: 1 }, { id: "c", tier: 2, col: 2 }, { id: "d", tier: 3, col: 1 }], edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }] };
  const tc = new Map([[1, 1], [2, 2], [3, 1]]);
  assert.equal(effCol(b.nodes[0], b, tc), 1.5);
  assert.equal(effCol(b.nodes[1], b, tc), 1, "a card with one child stays");
  assert.equal(effCol(b.nodes[3], b, tc), 1);
  const pair = { nodes: [{ id: "a", tier: 1, col: 0 }, { id: "h", tier: 1, col: 1 }, { id: "p", tier: 2, col: 0 }], edges: [{ from: "a", to: "p" }] };
  assert.equal(effCol(pair.nodes[0], pair, new Map([[1, 2], [2, 1]])), 0, "two cards in the tier: no move");
  assert.match(css, /#ui:not\(\.phone\) \.tree \.tnode\.ctr-a1 \{ grid-column: 3 \/ span 2; \}/);
  assert.match(css, /\.tree \.lk\[data-ctr="r"\]::after/);
});

test("acceptance: the held-item footer is two rows (the In hand line on its own row, gold and the buttons together)", () => {
  assert.match(css, /\.footrow \.notice \{ display: contents; \}/);
  assert.match(css, /\.footrow \.heldline \{ order: -1; flex: 1 0 100%;/);
});
