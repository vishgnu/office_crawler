// FIX-R8T-3-RENDER: G-R1 rare trim keeps the part fill, G-R2 unique body (rim all round, rounded, collar diamond on every class), L-4 brace band. Behavioural: draws into a recording context.
import test from "node:test";
import assert from "node:assert/strict";
import { trimOver } from "../src/render/gearkit.js";
import { PART_PAINTERS } from "../src/render/gearparts.js";

const rec = () => {
  const ev = [], t = {};
  const g = new Proxy(t, { get: (o, k) => (k in o ? o[k] : (...a) => { ev.push({ k, a, lw: o.lineWidth, ss: o.strokeStyle, fs: o.fillStyle }); }), set: (o, k, v) => { o[k] = v; return true; } });
  return { g, ev };
};
const SQ = [[0, 0], [20, 0], [20, 20], [0, 20]];
const CLASSES = { fm: { hw: 9, taper: 2 }, sr: { hw: 7, taper: 3 }, it: { hw: 6.5, taper: 1 } };
const A = (c) => ({ ...CLASSES[c], lx: 0, ly: 0, shY: 10, hipY: 40, cx0: 0, front: true, fx: 0, fy: 1, hook: "torso" });

test("G-R1: a rare trim is one thin yellow line plus two studs: no filled polygon, one stroked edge, no second inner line", () => {
  const { g, ev } = rec();
  trimOver(g, SQ, 2);
  const strokes = ev.filter((e) => e.k === "stroke" && e.ss === "#f0e442" && e.lw >= 1 && e.lw <= 1.2);
  assert.equal(ev.filter((e) => e.k === "stroke" && e.ss === "#f0e442").length, 1, "the edge is the only yellow stroke");
  assert.equal(strokes.filter((e) => e.lw === 1).length, 1, "exactly one yellow edge line");
  assert.equal(ev.filter((e) => e.k === "fill" && e.fs === "#f0e442").length, 2, "only the two studs are yellow fills");
});

for (const cls of Object.keys(CLASSES)) {
  test(`G-R2: unique body on ${cls}: light-orange rim all round (rounded corners, clipped fill), vermillion lines, collar diamond; clip released`, () => {
    for (const cat of ["knit", "jacket", "vest", "suit"]) {
      const { g, ev } = rec();
      PART_PAINTERS[cat](g, "body", cat, 3, A(cls));
      const rim = ev.filter((e) => e.k === "stroke" && e.ss === "#e69f00");
      assert.ok(rim.length >= 1 && rim[0].lw >= 4, `${cat}: rim stroke`);
      assert.ok(ev.filter((e) => e.k === "arcTo").length >= 8, `${cat}: rounded corners (arcTo)`);
      assert.ok(ev.filter((e) => e.k === "clip").length >= 1, `${cat}: rim shape clips the fill`);
      const saves = ev.filter((e) => e.k === "save").length, restores = ev.filter((e) => e.k === "restore").length;
      assert.equal(saves, restores, `${cat}: save/restore balanced (clip never leaks)`);
      assert.ok(ev.some((e) => e.k === "stroke" && e.ss === "#e8590c"), `${cat}: vermillion line`);
      const dia = ev.filter((e) => e.k === "fill" && e.fs === "#fff2c0");
      assert.ok(dia.length >= 1, `${cat}: collar diamond`);
    }
  });
}

test("G-R2: tiers 0-2 of a body part do not clip or round", () => {
  for (const tier of [0, 1, 2]) { const { g, ev } = rec(); PART_PAINTERS.jacket(g, "body", "jacket", tier, A("fm")); assert.equal(ev.filter((e) => e.k === "clip" || e.k === "arcTo").length, 0); }
});

test("L-4: normal brace is a 3 px band with a dark outline, light blue body", () => {
  const Ah = { hw: 8, lx: 0, ly: 0, shY: 10, hipY: 40, taper: 2, cx0: 0, front: true, fx: 0, fy: 1, hook: "hands", near: [-20, 30], ns: [-20, 15], far: [20, 30], fs: [20, 15] };
  const { g, ev } = rec();
  PART_PAINTERS.brace(g, "hands", "brace", 0, Ah);
  const band = ev.find((e) => e.k === "fill" && e.fs === "#3f6ad0");
  assert.ok(band, "band fill");
  const outline = ev.find((e) => e.k === "stroke" && e.ss === "#1b1530" || e.k === "stroke" && e.lw >= 1.7);
  assert.ok(outline && outline.lw >= 1.7, "dark outline at least 1.7 px");
});
