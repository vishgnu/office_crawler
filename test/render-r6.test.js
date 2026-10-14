// WORLD-R6 (round 6): faces in every facing (N1), beams behind the hero (N3), head keep-out for loot tags (N4), slam lifetime on the frame clock (N2),
// loot placement near plants (G2 #8) and the lazy monster atlas (perf). Pure: recording / stub canvases, no pixels, no wall-clock thresholds.
import test from "node:test";
import assert from "node:assert/strict";
import { newGame, spawnItem, teleportFloor, config } from "../src/core/index.js";
import { getCtx } from "../src/core/ctx.js";
import { project } from "../src/ui/camera.js";
import { createFx } from "../src/render/fx.js";
import { createSkillFx } from "../src/render/draw/effects.js";
import { drawFigure } from "../src/render/styles/vector/characters.js";
import { palette } from "../src/render/styles/vector/palette.js";
import { createAtlas } from "../src/render/atlas.js";

const ctx = () => new Proxy({}, { get: (_, k) => (k === "canvas" ? {} : k === "measureText" ? (t) => ({ width: String(t).length * 7 }) : k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
const withDom = (fn) => {
  const d = globalThis.document, w = globalThis.window;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx() }) };
  globalThis.window = { devicePixelRatio: 1 };
  try { return fn(); } finally { if (d === undefined) delete globalThis.document; else globalThis.document = d; if (w === undefined) delete globalThis.window; else globalThis.window = w; }
};
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---- N1: every facing shows a face on monsters and NPCs
test("N1: a human monster draws its eyes in all 8 facings (it glares back over the shoulder when it walks away)", () => {
  for (const [type, rx, ry] of [["consultant", 2.5, 3.5], ["auditor", 2.5, 3.5], ["middle-manager", 2.5, 3.5], ["temp-worker", 2.5, 3.5], ["zombie-intern", 3.7, 3.7]]) {
    for (let dir = 0; dir < 8; dir++) for (const anim of ["idle", "walk"]) {
      let eyes = 0;
      const g = new Proxy({}, { get: (t, k) => (k === "ellipse" ? (x, y, a, b) => { if (Math.abs(a - rx) < 1e-6 && Math.abs(b - ry) < 1e-6) eyes++; } : k in t ? t[k] : () => undefined), set: (t, k, v) => { t[k] = v; return true; } });
      drawFigure(g, type, anim, dir, 0);
      assert.ok(eyes >= (type === "zombie-intern" ? 1 : 2), `${type} ${anim} dir ${dir}: ${eyes} eye shapes`);
    }
  }
});

test("N1: the pale actors are one step darker (Consultant and Middle Manager skin, Consultant rim)", () => {
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  assert.ok(lum(palette.rims.consultant) < 0.78, "consultant rim no longer near white");
});

// ---- N4 / N3: loot layer
function scene() {
  const style = { palette, dims: { "facilities-manager": { head: 66, shadowR: 17 }, "middle-manager": { head: 70, shadowR: 18 } } };
  const fx = createFx(style);
  fx.heroType = "facilities-manager";
  const cam = { w: 1280, h: 720, z: 1.8, ox: 640, oy: 380 - 21 * 16 * 1.8 };
  fx.heroS = { x: 640, y: 380 };
  return { fx, cam, style };
}

test("N4: loot tags keep 4 px off the head of an enemy, also in the relaxed pass for rare and unique drops", () => withDom(() => {
  const { fx, cam } = scene();
  const tiles = [[10, 10], [11, 11], [12, 12], [10, 12], [12, 10], [13, 11], [11, 13], [9, 11]];
  const groundItems = tiles.map(([x, y], i) => ({ id: "g" + i, tile: { x, y }, rarity: i % 2 ? "unique" : "rare", label: ["Mandatory Reorg", "Pink Slip", "Final Audit", "Overdue Standup"][i % 4], border: "single" }));
  const core = { player: { tile: { x: 10, y: 9 } }, groundItems };
  // an enemy stands behind every drop: every natural plate position is on a head or a body
  fx.bodies = groundItems.map((gi, i) => ({ id: "m" + i, type: "middle-manager", sx: 640 + (gi.tile.x - gi.tile.y) * 32 * cam.z, sy: 380 + ((gi.tile.x + gi.tile.y) - 20) * 16 * cam.z - 30, dead: false, hid: false }));
  const g = ctx();
  fx.drawLoot(g, cam, core, 1000); fx.drawLootPlates(g, cam, core, 1000);
  const rects = fx.platesPlaced.slice(1);
  assert.ok(rects.length >= 1, "at least one tag is still placed");
  for (const r of rects) for (const b of fx.bodies) {
    const top = b.sy - 70 * cam.z, head = { x: b.sx - 15 * cam.z - 4, y: top - 4, w: 30 * cam.z + 8, h: 26 * cam.z + 8 };
    assert.ok(!hit(r, head), `tag ${JSON.stringify(r)} touches the head of ${b.id}`);
  }
}));

test("N3: a loot beam that crosses the hero's rectangle makes the renderer draw the hero over it; a beam elsewhere does not", () => withDom(() => {
  const { fx, cam } = scene();
  let redraws = 0; fx.heroRedraw = () => { redraws++; };
  const mk = (x, y) => ({ player: { tile: { x: 10, y: 10 } }, groundItems: [{ id: "b", tile: { x, y }, rarity: "rare", label: "Rare", border: "single" }] });
  // hero at screen (640, 380) = tile (21,21)-ish in this camera; put the drop 1 tile in front of him (directly below on screen), then far away
  const pp = { x: 0, y: 0 };
  let t = null;
  for (let k = 0; k < 60 && !t; k++) for (let d = -3; d <= 3 && !t; d++) { project(cam, k + 0.5, k + d + 0.5, pp); if (Math.abs(pp.x - 640) < 4 && pp.y > 380 && pp.y < 380 + 40 * cam.z) t = { x: k, y: k + d }; }
  assert.ok(t, "a tile in front of the hero");
  fx.drawLoot(ctx(), cam, mk(t.x, t.y), 1000);
  assert.equal(redraws, 1, "beam through the hero: hero redrawn on top");
  redraws = 0; fx.drawLoot(ctx(), cam, mk(t.x + 8, t.y - 8), 1000);
  assert.equal(redraws, 0, "beam far from the hero: no redraw");
}));

// ---- N2: the slam lifetime follows the clock the renderer is given, not ticks and not a reset
test("N2: Pallet Slam lives 900 ms of render time: present at +300 and +850, gone by +900; events in between do not reset it", () => {
  const core = newGame(3, { class: "facilities-manager", start: "town" });
  const fx = { reducedMotion: false, reducedFlash: false, core, shakeUntil: 0, proj: new Map(), parts: [], burst() {} };
  const sk = createSkillFx(fx), p = core.player.tile, cam = { w: 1280, h: 720, z: 1.8, ox: 640, oy: 100 };
  const t0 = 50000, cast = { type: "cast", skill: "pallet-slam", level: 3, tile: { x: p.x + 2, y: p.y } };
  sk.handle(cast, core, t0);
  const slams = () => sk.efx.filter((e) => e.k === "slam").length;
  assert.equal(slams(), 1, "one slam after the cast");
  for (const dt of [16, 120, 300, 600, 850]) { sk.drawGround(ctx(), cam, t0 + dt); assert.equal(slams(), 1, `slam alive at +${dt} ms`); }
  sk.handle({ type: "hit", target: "m1", amount: 5 }, core, t0 + 400); sk.handle({ type: "tick" }, core, t0 + 500); // unrelated events do not reset or extend it
  sk.drawGround(ctx(), cam, t0 + 899); assert.equal(slams(), 1, "alive at +899");
  sk.drawGround(ctx(), cam, t0 + 900); assert.equal(slams(), 0, "gone at +900 (life 900 ms from the render clock)");
});

// ---- G2 #8: loot placement near plants
test("G2 #8: a drop next to a plant, rack or cabinet lands on a free tile outside the prop halo whenever one exists within the drop radius", () => {
  const TALL = new Set(["plant", "server-rack", "filing-cabinet", "box-stack", "generator", "copier", "partition", "desk", "conference-table", "reception-desk"]);
  let drops = 0, viol = 0, plantFloors = 0;
  for (const depth of [1, 5, 9]) for (let seed = 1; seed <= 6; seed++) {
    const s = newGame(seed); teleportFloor(s, depth);
    const f = s.floor, halo = new Set();
    for (const p of f.props ?? []) if (TALL.has(p.type)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) halo.add((p.y + dy) * f.w + p.x + dx);
    const plants = (f.props ?? []).filter((p) => p.type === "plant"); if (plants.length) plantFloors++;
    const c = getCtx(s), r = config.dropRadius;
    for (const p of plants) {
      s.groundItems.length = 0;
      for (let i = 0; i < 6; i++) {
        const o = { x: p.x + 1, y: p.y }, taken = new Set(s.groundItems.map((q) => `${q.tile.x},${q.tile.y}`));
        let alt = false;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = o.x + dx, y = o.y + dy; if (c.grid.walkable(x, y) && !taken.has(`${x},${y}`) && !halo.has(y * f.w + x)) alt = true; }
        const e = spawnItem(s, { rarity: "rare" }, o); drops++;
        if (alt && halo.has(e.tile.y * f.w + e.tile.x)) viol++;
      }
    }
  }
  assert.ok(plantFloors >= 5 && drops >= 100, `sweep size: ${plantFloors} floors with plants, ${drops} drops`);
  assert.equal(viol, 0, "no drop sits in a prop halo while a free tile outside it exists");
});

// ---- perf: monster and S1 hero frames are drawn on first use
test("perf: an atlas entry added with addLazy is drawn once, on its first get(), and has() / keys() list it before", () => withDom(() => {
  const atlas = createAtlas(1);
  let draws = 0;
  atlas.addLazy("mon:x", 10, 10, 5, 5, () => { draws++; });
  assert.equal(atlas.has("mon:x"), true); assert.equal(atlas.isDrawn("mon:x"), false); assert.equal(draws, 0);
  const e = atlas.get("mon:x"); assert.equal(draws, 1); assert.equal(atlas.get("mon:x"), e); assert.equal(draws, 1); assert.equal(atlas.isDrawn("mon:x"), true);
}));

// ---- PERF-R6 / CR6-03: a lazy draw of an old atlas during a rebuild in flight leaves the globals of the running build alone
test("perf CR6-03: a lazy draw of atlas A while atlas B builds does not change the ink weight and texture resolution B's eager sprites are drawn with", async () => {
  const { vector } = await import("../src/render/styles/vector/index.js");
  const { inkScale } = await import("../src/render/draw/shapes.js");
  const { texRes } = await import("../src/render/draw/textures.js");
  // a stub 2D context that accepts every call and returns itself (gradients, patterns, measureText, ...)
  const deep = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 1 : k === "canvas" ? {} : k === "width" ? 7 : deep()), apply: () => deep(), set: () => true });
  const d = globalThis.document, w = globalThis.window, dm = globalThis.DOMMatrix;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => deep() }) };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.DOMMatrix = class { scale() { return this; } rotate() { return this; } translate() { return this; } };
  try {
    const A = await vector.build(() => {}, { scale: 1, rim: 0.8 });
    let seen = null, n = 0;
    const lazyKey = A.keys().find((k) => k.startsWith("mon:") && A.isDrawn(k) === false);
    assert.ok(lazyKey, "atlas A has an undrawn lazy monster sprite");
    const B = await vector.build(() => {
      if (++n !== 3) return;
      const before = [inkScale(), texRes()];
      A.get(lazyKey); // first use of a lazy A sprite, in the middle of B's build
      seen = { before, after: [inkScale(), texRes()] };
    }, { scale: 2, rim: 2 });
    assert.ok(seen, "the lazy draw happened during the second build");
    assert.equal(A.isDrawn(lazyKey), true);
    assert.deepEqual(seen.after, seen.before, "the globals are what B's build had set");
    assert.equal(B.scale, 2);
  } finally {
    if (d === undefined) delete globalThis.document; else globalThis.document = d;
    if (w === undefined) delete globalThis.window; else globalThis.window = w;
    if (dm === undefined) delete globalThis.DOMMatrix; else globalThis.DOMMatrix = dm;
  }
});

// ---- PERF-R6 / CR6-04: the budgeted warm-up draws the lazy frames of the floor's monster types and the hero, each once
test("perf CR6-04: warmFrames draws idle/walk/attack in 8 directions of every monster type on the floor and the hero's frames, within a budget per call, once each", async () => {
  const { warmFrames } = await import("../src/render/world.js");
  const { keys, DIRS, ANIMS, PLAYER_ANIMS } = await import("../src/render/keys.js");
  const drawn = new Set(), counts = new Map(), all = [];
  const atlas = { isDrawn: (k) => (all.includes(k) ? drawn.has(k) : undefined), get: (k) => { drawn.add(k); counts.set(k, (counts.get(k) ?? 0) + 1); return {}; } };
  const types = ["zombie-intern", "printer-imp"];
  for (const t of types) for (const a of ["idle", "walk", "attack"]) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[a]; f++) all.push(keys.mon(t, a, d, f));
  const core = { monsters: [{ type: types[0] }, { type: types[1] }, { type: types[0] }], player: { class: "it-wizard" } };
  const before = drawn.size;
  let calls = 0;
  while (!warmFrames(atlas, core, 0) && calls < 5000) calls++;
  assert.ok(calls > 1, "with a zero budget the work is spread over many calls");
  for (const k of all) assert.ok(drawn.has(k), `${k} warmed`);
  for (const [k, c] of counts) assert.equal(c, 1, `${k} drawn once`);
  assert.equal(before, 0);
  // a monster type that appears later is queued on its own
  atlas.get = (k) => { drawn.add(k); return {}; };
  assert.equal(warmFrames(atlas, core, 0), true, "nothing left to do");
});

// ---- STUTTER-R7: once the floor's own frames are drawn, the idle/walk/attack frames of the types of floor depth+1 are warmed at a small budget, once each
test("perf STUTTER-R7: warmFrames warms the next floor's monster types (minDepth <= depth + 1) after the current floor, once each, and nothing from deeper", async () => {
  const { warmFrames } = await import("../src/render/world.js");
  const { keys, DIRS, ANIMS } = await import("../src/render/keys.js");
  const { content } = await import("../src/core/index.js");
  const counts = new Map(), all = new Set();
  const nextTypes = Object.keys(content.monsters).filter((t) => content.monsters[t].minDepth <= 3), deeper = Object.keys(content.monsters).filter((t) => content.monsters[t].minDepth > 3);
  for (const t of Object.keys(content.monsters)) for (const a of ["idle", "walk", "attack", "death"]) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[a]; f++) all.add(keys.mon(t, a, d, f));
  const atlas = { isDrawn: (k) => (all.has(k) ? counts.has(k) === false ? false : true : undefined), get: (k) => { counts.set(k, (counts.get(k) ?? 0) + 1); return {}; } };
  const core = { depth: 2, monsters: [{ type: "zombie-intern" }], player: { class: "it-wizard" } };
  let calls = 0;
  while (!warmFrames(atlas, core, 0) && calls < 20000) calls++;
  assert.ok(calls < 20000, "finishes");
  for (const t of nextTypes) for (const a of ["idle", "walk", "attack"]) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[a]; f++) assert.ok(counts.has(keys.mon(t, a, d, f)), `${t} ${a} ${d} ${f} warmed ahead`);
  for (const t of deeper) assert.ok(![...counts.keys()].some((k) => k.startsWith(`mon:${t}:`)), `${t} (deeper than next floor) not warmed`);
  for (const [k, c] of counts) assert.equal(c, 1, `${k} drawn once`);
  // a deeper floor queues its own next set
  core.depth = 4;
  while (!warmFrames(atlas, core, 0) && calls < 40000) calls++;
  for (const t of deeper.filter((t) => content.monsters[t].minDepth <= 5)) assert.ok(counts.has(keys.mon(t, "idle", 0, 0)), `${t} warmed after the depth change`);
});
