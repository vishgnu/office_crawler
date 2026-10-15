// FIX-WORLD-R8T: pure checks of the R8-T render polish (G-1 magic highlight, G-2 unique body rim, G-3 brace size, N17 elite scale). Bounded work, no timings.
import test from "node:test";
import assert from "node:assert/strict";
import { trimOver } from "../src/render/gearkit.js";
import { PART_PAINTERS } from "../src/render/gearparts.js";
import { actorScale } from "../src/render/world.js";

const styles = (draw) => { const set = []; const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { if (k === "strokeStyle") set.push(v); t[k] = v; return true; } }); draw(g); return set; };
const SQ = [[0, 0], [10, 0], [10, 10], [0, 10]];

test("G-1: magic trim carries a hue-free bright line, normal does not, rare/unique keep their own", () => {
  assert.ok(styles((g) => trimOver(g, SQ, 1)).includes("#ffffff"));
  assert.equal(styles((g) => trimOver(g, SQ, 0)).length, 0);
  assert.ok(!styles((g) => trimOver(g, SQ, 2)).includes("#ffffff"));
});

test("G-2: unique body trim strokes shoulders and hem only (2 rim segments), not the whole torso", () => {
  const A = { hw: 8, lx: 0, ly: 0, shY: 10, hipY: 40, taper: 2, cx0: 0, front: true, fx: 0, fy: 1, hook: "torso" };
  let strokes = 0;
  const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { if (k === "stroke" && t.lineWidth === 4.2) strokes++; }), set: (t, k, v) => { t[k] = v; return true; } });
  PART_PAINTERS.jacket(g, "body", "jacket", 3, A);
  assert.equal(strokes, 2);
});

// A recording 2D context: every moveTo/lineTo point and every ellipse extent is kept, so the painted size of a part can be asserted.
const recorder = () => { const pts = []; const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === "moveTo" || k === "lineTo" ? (x, y) => pts.push([x, y]) : k === "ellipse" ? (x, y, rx, ry) => pts.push([x - rx, y - ry], [x + rx, y + ry]) : () => {}), set: (t, k, v) => { t[k] = v; return true; } }); return { g, pts }; };
const extent = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };

test("G-3: the wrist brace is a slim band (each hand at most about 8 x 9 px painted, no big box)", () => {
  const A = { hw: 8, lx: 0, ly: 0, shY: 10, hipY: 40, taper: 2, cx0: 0, front: true, fx: 0, fy: 1, hook: "hands", near: [-20, 30], ns: [-18, 15], far: [20, 30], fs: [18, 15] };
  const { g, pts } = recorder();
  PART_PAINTERS.brace(g, "hands", "brace", 0, A);
  assert.ok(pts.length >= 8, "the painter drew something");
  const half = (list) => extent(list);
  // the two hands are far apart: split by x around the middle and take the larger extent of the two
  const mid = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const L = pts.filter((p) => p[0] <= mid), R = pts.filter((p) => p[0] > mid);
  for (const side of [L, R]) if (side.length) { const e = half(side); assert.ok(e.w <= 9 && e.h <= 9, `brace side ${e.w.toFixed(1)} x ${e.h.toFixed(1)}`); }
});

test("N17: actorScale is above 1 for the quest elite only", () => {
  assert.ok(actorScale({ tier: "champion", quest: "sq3" }) > 1);
  assert.equal(actorScale({ tier: "champion" }), 1);
  assert.equal(actorScale({ tier: "boss", quest: "sq3" }), 1);
  assert.equal(actorScale({ tier: "minion" }), 1);
  assert.equal(actorScale(null), 1);
  assert.ok(actorScale({ tier: "champion", quest: "sq3" }) <= 1.2);
});
