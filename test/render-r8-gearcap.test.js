// CR8-03: the gear cache counts the cached flash / outline silhouettes, the cap follows the atlas scale, the current signature's idle+walk fit at the top scale (2.5),
// and the warm budget is a ceiling. The atlas is the real createAtlas(2.5) (its own silhouette() / outline() code) on a stub canvas; only the pixels are fake.
import test from "node:test";
import assert from "node:assert/strict";
import { createAtlas } from "../src/render/atlas.js";
import { gearTick, gearFrame, gearTable, warmGear, gearPerf, gearState, gearCapFor, GEAR_CAP_BYTES } from "../src/render/gearcache.js";
import { PLAYER_ANIMS, DIRS } from "../src/render/keys.js";
import { content } from "../src/core/index.js";

const item = (base, rarity = "normal") => ({ id: "t-" + base, base, rarity, slot: content.items[base].slot });
const SCALE = 2.5, SPRITE = Math.ceil(104 * SCALE) * Math.ceil(96 * SCALE) * 4; // 260 x 240 x 4 = 249,600
function withDom(fn) {
  const d = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) }) };
  try { return fn(); } finally { if (d === undefined) delete globalThis.document; else globalThis.document = d; }
}
function realAtlas() {
  const atlas = createAtlas(SCALE);
  atlas.bakeHero = (cls, anim, d, f) => { // same size / anchor / entry shape as render/styles/vector/index.js
    const img = document.createElement("canvas"); img.width = Math.ceil(104 * SCALE); img.height = Math.ceil(96 * SCALE);
    return { key: `gear:${cls}:${anim}:${d}:${f}`, img, w: img.width / SCALE, h: img.height / SCALE, ox: 52, oy: 76, sil: null };
  };
  atlas.get = (key) => ({ key, img: { width: 260, height: 240 }, bare: true });
  return atlas;
}
const core = (equipment) => ({ equipment, player: { class: "facilities-manager" }, depth: 1 });
const WARM = 80; // idle + walk, 8 facings
const flashAll = (atlas, t) => { for (const it of t.list) atlas.flash(it.e); };
const showAll = (atlas) => { const t = gearTable(atlas); for (const [anim, n] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) gearFrame(atlas, t, anim, d, f); return t; };

test("CR8-03 the cap follows the atlas scale: 32 MB floor, 49.9 MB at scale 2.5", () => {
  assert.equal(gearCapFor(1), GEAR_CAP_BYTES);
  assert.equal(gearCapFor(2), GEAR_CAP_BYTES);
  assert.equal(gearCapFor(SCALE), 200 * SPRITE);
  assert.ok(gearCapFor(SCALE) >= 2 * WARM * SPRITE, "idle+walk with a flash silhouette on every frame fits");
});

test("CR8-03 scale 2.5: silhouettes count, one signature's idle+walk (flashed) fits, nothing is evicted", () => withDom(() => {
  const atlas = realAtlas(), c = core({ head: item("visor-cap", "magic") }), st = gearState(atlas);
  assert.equal(st.cap, gearCapFor(SCALE));
  gearTick(atlas, c); // fresh core: idle and walk warmed at once
  assert.equal(st.warmBuilds, WARM);
  const t = gearTable(atlas);
  assert.equal(gearPerf(atlas).gearCache.bytes, WARM * SPRITE, "base canvases only: 80 x 249,600 = 19,968,000");
  flashAll(atlas, t);
  assert.equal(gearPerf(atlas).gearCache.bytes, 2 * WARM * SPRITE, "the flash silhouettes are counted (39,936,000)");
  atlas.outline(t.list[0].e, "#fff", 2); // outline = a source-in silhouette + the ring canvas
  assert.equal(gearPerf(atlas).gearCache.bytes, 2 * WARM * SPRITE + 2 * SPRITE, "an outline adds its shade silhouette and its ring (the flash of that frame was already counted)");
  assert.equal(st.evictions, 0);
  assert.ok(gearPerf(atlas).gearCache.bytes <= st.cap);
  // the other poses on demand: the full set (176 frames) with a flash on each is over the cap, and the cap holds
  showAll(atlas); flashAll(atlas, gearTable(atlas));
  showAll(atlas);
  const p = gearPerf(atlas).gearCache;
  assert.ok(p.bytes <= st.cap, `bytes ${p.bytes} over the cap ${st.cap}`);
  assert.ok(p.evictions > 0, "176 flashed frames (87.9 MB) do not fit 49.9 MB");
}));

test("CR8-03 scale 2.5: a gear change with the previous signature resident keeps every idle and walk frame of the new one", () => withDom(() => {
  const atlas = realAtlas(), c = core({ head: item("visor-cap", "magic") }), st = gearState(atlas);
  gearTick(atlas, c); const A = gearTable(atlas); showAll(atlas); flashAll(atlas, A);
  c.equipment = { head: item("hard-hat", "rare"), weapon: item("pipe-wrench") }; gearTick(atlas, c);
  const B = gearTable(atlas);
  assert.notEqual(A, B); assert.equal(st.tables.size, 2);
  for (let i = 0; i < 400; i++) { gearTick(atlas, c); warmGear(atlas, c, Infinity, true); if (i < 3) flashAll(atlas, B); }
  const idleWalk = ["idle", "walk"].flatMap((a) => B.rows[a].flatMap((row) => row.filter(Boolean)));
  assert.equal(idleWalk.length, WARM, "the new signature's idle+walk are all resident");
  assert.ok(st.bytes <= st.cap);
  const per = (tb) => tb.bytes;
  console.log(`# CR8-03 bytes at scale 2.5: sprite ${SPRITE}; idle+walk ${WARM * SPRITE}; with flash ${2 * WARM * SPRITE}; full 176 frames ${176 * SPRITE}; cap ${st.cap}; resident now A=${per(A)} B=${per(B)}`);
}));

test("CR8-03 the warm budget is a ceiling: a zero budget bakes nothing, and a bake is paid for over the next calls", () => withDom(() => {
  const atlas = realAtlas(), c = core({ head: item("visor-cap") }), st = gearState(atlas);
  gearTick(atlas, c); st.pause = 0;
  // drop the warmed set to test the budgeted path
  for (const tb of st.tables.values()) for (const a of Object.keys(tb.rows)) for (const row of tb.rows[a]) row.fill(undefined);
  st.queue = null; st.warmI = 0;
  const b0 = st.builds;
  warmGear(atlas, c, 0); assert.equal(st.builds, b0);
  st.frameBuilds = 1; warmGear(atlas, c, 5); assert.equal(st.builds, b0, "no warm bake in a frame that already baked");
  st.frameBuilds = 0; st.credit = -1e9; warmGear(atlas, c, 0.7); assert.equal(st.builds, b0, "a spent credit blocks the bake");
}));
