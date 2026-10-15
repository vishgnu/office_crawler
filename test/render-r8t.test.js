// FIX-WORLD-R8T: pure checks of the R8-T render polish (G-1 magic highlight, G-2 unique body rim, G-3 brace size, N17 elite scale). Bounded work, no timings.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trimOver } from "../src/render/gearkit.js";
import { PART_PAINTERS } from "../src/render/gearparts.js";

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

test("G-3 / N17: wrist brace is a slim band; the quest elite is scaled in world.js", () => {
  assert.match(readFileSync(new URL("../src/render/gearparts-armour.js", import.meta.url), "utf8"), /\[\[-4\.6, -3\], \[-2, -3\]/);
  const w = readFileSync(new URL("../src/render/world.js", import.meta.url), "utf8");
  assert.match(w, /QUEST_ELITE_K = 1\.1\d?/);
  assert.match(w, /it\.k = champ && a\.quest/);
});
