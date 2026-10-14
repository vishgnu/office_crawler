// WORLD-FIX (round G3): loot tags keep off the hero and bodies and off each other (F1, F4), the loot layer reuses its records (CR-14),
// and a nameplate leader line never runs through a body (F3). Pure: stubbed canvas, no pixels, no timing.
import test from "node:test";
import assert from "node:assert/strict";
import { createFx } from "../src/render/fx.js";
import { lineCrossesBody } from "../src/render/labels.js";
import { palette } from "../src/render/styles/vector/palette.js";

const ctx = () => new Proxy({}, { get: (_, k) => (k === "canvas" ? {} : k === "measureText" ? (t) => ({ width: String(t).length * 7 }) : k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
const withDom = (fn) => {
  const d = globalThis.document, w = globalThis.window;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx() }) };
  globalThis.window = { devicePixelRatio: 1 };
  try { return fn(); } finally { if (d === undefined) delete globalThis.document; else globalThis.document = d; if (w === undefined) delete globalThis.window; else globalThis.window = w; }
};
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function scene() {
  const style = { palette, dims: { "facilities-manager": { head: 66, shadowR: 17 }, "zombie-intern": { head: 50 } } };
  const fx = createFx(style);
  fx.heroType = "facilities-manager";
  const cam = { w: 1280, h: 720, z: 1.8, ox: 640, oy: 380 - 21 * 16 * 1.8 };
  fx.heroS = { x: 640, y: 380 };
  const tiles = [[10, 10], [11, 10], [10, 11], [9, 10], [11, 11], [12, 10], [10, 12], [9, 9]];
  const rar = ["unique", "rare", "rare", "magic", "magic", "rare", "unique", "magic"];
  const groundItems = tiles.map(([x, y], i) => ({ id: "g" + i, tile: { x, y }, rarity: rar[i], label: ["Mandatory Reorg", "Padded Cardigan of the Hazmat Drill", "Alert Visor Cap of the Gym Rat", "Hard Hat of the Sprinkler", "Pink Slip", "Final Audit", "Offsite Quota", "Visor Cap of the Marathon"][i], border: "single" }));
  const core = { player: { tile: { x: 10, y: 10 } }, groundItems };
  fx.bodies = [{ id: "m1", type: "zombie-intern", sx: 700, sy: 360, dead: false, hid: false }, { id: "m2", type: "zombie-intern", sx: 560, sy: 400, dead: false, hid: false }];
  const frame = () => { const g = ctx(); fx.drawLoot(g, cam, core, 1000); fx.drawLootPlates(g, cam, core, 1000); return fx.platesPlaced.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })); };
  return { fx, cam, core, frame };
}

test("F1 / F4: loot tags never touch the hero's drawn body, an enemy body, or each other", () => withDom(() => {
  const { fx, cam, frame } = scene();
  const hero = fx.heroS, hh = (66 + 6) * cam.z, heroRect = { x: hero.x - 27 * cam.z, y: hero.y - hh, w: 54 * cam.z, h: hh + 5 * cam.z };
  const rects = frame().slice(1);
  assert.ok(rects.length >= 3, "several tags are placed in a pile of eight drops");
  for (const r of rects) assert.ok(!hit(r, heroRect), `tag ${JSON.stringify(r)} covers the hero`);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j], gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    assert.ok(Math.max(gx, gy) >= 5, `tags ${i} and ${j} abut (gap ${Math.max(gx, gy)})`);
  }
}));

test("F1: the hero keep-out follows the drawn hero position, not the logical tile", () => withDom(() => {
  const { fx, cam, frame } = scene();
  fx.heroS = { x: 760, y: 380 }; // the drawn hero is one step to the right of the tile
  const hh = (66 + 6) * cam.z, heroRect = { x: 760 - 27 * cam.z, y: 380 - hh, w: 54 * cam.z, h: hh + 5 * cam.z };
  for (const r of frame().slice(1)) assert.ok(!hit(r, heroRect), "tag on the moved hero");
}));

test("CR-14: a steady frame reuses the loot records, both orders and the plate rects (no re-sort, no new objects)", () => withDom(() => {
  const { fx, frame } = scene();
  frame();
  const lt = fx.lt, order = lt.order, prio = lt.prio, e0 = lt.order[0], pool = lt.pool.slice(), pp = lt.pp.slice(), placed0 = fx.platesPlaced.slice(1);
  let sorts = 0; const sort = Array.prototype.sort; Array.prototype.sort = function (...a) { sorts++; return sort.apply(this, a); };
  try { frame(); frame(); } finally { Array.prototype.sort = sort; }
  assert.equal(sorts, 0, "no sort while the set and the hero tile are unchanged");
  assert.equal(lt.order, order); assert.equal(lt.prio, prio); assert.equal(lt.order[0], e0);
  assert.deepEqual(lt.pool, pool); assert.deepEqual(lt.pp, pp);
  fx.platesPlaced.slice(1).forEach((r, i) => assert.equal(r, placed0[i], "plate rect objects are reused"));
}));

test("CR-14: a new drop or a hero step rebuilds the orders once; a pick-up shrinks them", () => withDom(() => {
  const { fx, core, frame } = scene();
  frame();
  const n = core.groundItems.length;
  core.groundItems.push({ id: "extra", tile: { x: 13, y: 13 }, rarity: "rare", label: "Extra", border: "single" });
  frame(); assert.equal(fx.lt.order.length, n + 1);
  core.player.tile = { x: 11, y: 11 }; frame();
  assert.equal(fx.lt.order[0].d, Math.min(...fx.lt.order.map((e) => e.d)), "nearest first after the hero moved");
  core.groundItems.length = 2; frame(); assert.equal(fx.lt.order.length, 2); assert.equal(fx.lt.prio.length, 2);
}));

test("F3: a leader line through another actor's body (or the hero) is detected; a clear line and the owner's own body are not", () => {
  const style = { dims: { x: { head: 50 } } }, cam = { z: 1 };
  const actors = [{ id: "a", type: "x", sx: 100, sy: 200, dead: false }, { id: "b", type: "x", sx: 300, sy: 200, dead: false }];
  const hero = { x: 500, y: 150, w: 50, h: 64 };
  assert.equal(lineCrossesBody(100, 100, 100, 190, actors, actors[1], cam, style, hero), true, "line down through a");
  assert.equal(lineCrossesBody(100, 100, 100, 190, actors, actors[0], cam, style, hero), false, "a's own body is skipped");
  assert.equal(lineCrossesBody(200, 100, 200, 190, actors, actors[0], cam, style, hero), false, "clear between the two");
  assert.equal(lineCrossesBody(520, 100, 520, 180, actors, actors[0], cam, style, hero), true, "through the hero");
  assert.equal(lineCrossesBody(300, 100, 300, 190, [{ ...actors[1], dead: true }], null, cam, style, hero), false, "dead bodies do not count");
});
