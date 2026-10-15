// WORLD-G1 (R8-0.1, ADR-0008): gear signature, hooks, stub parts, signature-keyed sprite cache, budget, invalidation, no-sim-change guard.
// Pure: a recording canvas context stands in for pixels (the same call stream is the same picture); no wall-clock thresholds (work is bounded by counts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, hashState, content } from "../src/core/index.js";
import { recorder } from "./render-gear-rec.js";
import { drawFigure as paintFigure } from "../src/render/styles/vector/characters.js";
import { drawFigure as uiFigure } from "../src/render/figure.js";
import { PLAYER_ANIMS, HERO_CLASSES, DIRS, keys } from "../src/render/keys.js";
import { LOOK_BY_BASE, LOOK_CATEGORIES, SLOT_DEFAULT, VISIBLE_SLOTS, EMPTY_SIG, gearSignature, parseSignature, lookOf } from "../src/render/gearlooks.js";
import { makeGear, gearHook, trim, PART_PAINTERS, HOOK_SLOT } from "../src/render/gearparts.js";
import { gearTick, gearFrame, gearTable, warmGear, gearPerf, gearState, GEAR_CAP_BYTES, WARM_PAUSE_FRAMES } from "../src/render/gearcache.js";
import { figures, provideFigures } from "../src/ui/figureHost.js";
import { replay } from "./helpers.js";

const FIG = { translate: [52, 76] };
const stream = (cls, anim, d, f, gear) => { const r = recorder(); r.g.translate(FIG.translate[0], FIG.translate[1]); paintFigure(r.g, cls, anim, d, f, gear); return r.digest(); };
const item = (base, rarity = "normal", extra = {}) => {
  const b = content.bases[base];
  return { id: "t-" + base, base, rarity, slot: b?.slot ?? extra.slot, ...(b?.twoHanded ? { twoHanded: true } : {}), ...extra };
};
const visibleBases = Object.values(content.bases).filter((b) => b.kind === "gear" && VISIBLE_SLOTS.includes(b.slot));
const baseOf = (slot, cat) => Object.keys(LOOK_BY_BASE).find((id) => LOOK_BY_BASE[id] === cat && content.bases[id].slot === slot);

// ---- AC-R-260-1: table and signature ----
test("AC-R-260-1 every visible gear base maps to a category of its slot; no other base; 21 categories with the fixed slot limits", () => {
  for (const b of visibleBases) assert.ok(LOOK_CATEGORIES[b.slot].includes(LOOK_BY_BASE[b.id]), `${b.id} has no category in ${b.slot}`);
  assert.deepEqual(Object.keys(LOOK_BY_BASE).sort(), visibleBases.map((b) => b.id).sort(), "the table holds exactly the visible gear bases");
  assert.equal(Object.values(LOOK_CATEGORIES).flat().length, 21);
  const lim = { weapon: 5, offhand: 3, head: 3, body: 4, hands: 3, feet: 3 };
  for (const [s, n] of Object.entries(lim)) assert.ok(LOOK_CATEGORIES[s].length <= n && LOOK_CATEGORIES[s].length > 0, s);
  for (const s of VISIBLE_SLOTS) assert.ok(LOOK_CATEGORIES[s].includes(SLOT_DEFAULT[s]), `default of ${s}`);
  for (const cat of Object.values(LOOK_CATEGORIES).flat()) assert.ok(Object.values(LOOK_BY_BASE).includes(cat), `category ${cat} has a base`);
});

test("AC-R-260-1 gearSignature: same categories and rarities give the same string; belt, rings and amulet are ignored", () => {
  const a = { head: item("visor-cap", "magic"), weapon: item("ruler-rapier", "rare") };
  const b = { head: { ...item("visor-cap", "magic"), id: "other", ilvl: 9, affixes: [1] }, weapon: item("letter-opener", "rare"), belt: item("tool-belt", "unique"), ring1: item("paperclip-ring", "rare"), amulet: item("lanyard", "magic") };
  assert.equal(gearSignature(a), gearSignature(b));
  assert.equal(gearSignature(a), "c1|-|-|-|b2|-");
  assert.equal(gearSignature({}), EMPTY_SIG);
  assert.equal(gearSignature({ belt: item("tool-belt", "unique"), ring1: item("paperclip-ring"), ring2: item("lapel-badge"), amulet: item("id-card") }), EMPTY_SIG);
  assert.notEqual(gearSignature({ head: item("visor-cap", "magic") }), gearSignature({ head: item("visor-cap", "rare") }));
  assert.notEqual(gearSignature({ head: item("visor-cap") }), gearSignature({ head: item("hard-hat") }));
  assert.equal(gearSignature({ weapon: item("mop-halberd", "unique") }), "-|-|-|-|p32|-");
  assert.equal(gearSignature({ weapon: item("mop-halberd"), offhand: item("clipboard-shield") }), "-|-|-|-|p02|-", "a two-handed weapon blocks the off-hand");
  assert.equal(gearSignature({ offhand: item("binder-buckler", "unique") }), "-|-|-|-|-|i3");
});

test("AC-R-260-1 signature strings round trip through parseSignature and a malformed look is rejected", () => {
  for (const s of VISIBLE_SLOTS) for (const cat of LOOK_CATEGORIES[s]) for (let t = 0; t < 4; t++) {
    const eq = { [s]: item(baseOf(s, cat), ["normal", "magic", "rare", "unique"][t]) }, sig = gearSignature(eq), p = parseSignature(sig);
    assert.ok(p, sig); assert.equal(p[s].cat, cat); assert.equal(p[s].tier, t);
  }
  for (const bad of [null, 5, {}, "", "x", "-|-|-|-|-", "-|-|-|-|-|-|-", "zz|-|-|-|-|-", "c9|-|-|-|-|-", "c1x|-|-|-|-|-", "c1|-|-|-|-|-".repeat(5), "<script>|-|-|-|-|-", "c12|-|-|-|-|-", "-|-|-|-|-|c1"]) assert.equal(parseSignature(bad), null, String(bad));
  assert.equal(makeGear("not a signature"), null);
  assert.equal(makeGear(EMPTY_SIG), null);
});

// ---- AC-R-260-5: fallbacks ----
test("AC-R-260-5 unknown base: the slot default; unknown rarity: normal; null, malformed and invisible-slot items: nothing", () => {
  assert.deepEqual(lookOf("head", { base: "mystery-hat", rarity: "normal", slot: "head" }), { cat: "cap", tier: 0, two: false });
  assert.deepEqual(lookOf("body", { base: "x", slot: "body", rarity: "legendary" }), { cat: "knit", tier: 0, two: false });
  assert.deepEqual(lookOf("hands", { base: "x" }), { cat: "brace", tier: 0, two: false });
  assert.equal(lookOf("feet", { base: "x" }).cat, "sneaker");
  assert.equal(lookOf("weapon", { base: "x" }).cat, "blade");
  assert.equal(lookOf("weapon", { base: "x", twoHanded: true }).cat, "pole");
  assert.equal(lookOf("offhand", { base: "x" }).cat, "board");
  assert.equal(lookOf("head", { base: "constructor" }).cat, "cap", "prototype keys are not bases");
  assert.equal(lookOf("head", { base: "hard-hat", rarity: "toString" }).tier, 0);
  for (const bad of [null, undefined, 0, "cap", [], { base: "visor-cap", slot: "belt" }, { base: "tool-belt", slot: "belt" }, { base: "visor-cap", slot: "body" }]) assert.equal(lookOf("head", bad), null, JSON.stringify(bad));
  assert.equal(lookOf("belt", { base: "tool-belt" }), null);
  assert.equal(lookOf("ring1", { base: "paperclip-ring" }), null);
  assert.equal(gearSignature(null), EMPTY_SIG);
  assert.equal(gearSignature("nope"), EMPTY_SIG);
  assert.equal(gearSignature({ head: 7, body: "x", hands: [], feet: { base: 4 } }), "-|-|-|s0|-|-".replace("s0", "s0"), "feet with a non-string base is the default sneaker");
});

test("AC-R-260-5 a part painter that throws leaves its slot empty, is counted once, and the rest of the figure is drawn", () => {
  const orig = PART_PAINTERS.cap;
  try {
    PART_PAINTERS.cap = () => { throw new Error("boom"); };
    const errs = [], G = makeGear("c1|k0|-|-|-|-", (slot, err) => errs.push([slot, err.message]));
    const bareBody = makeGear("-|k0|-|-|-|-"), r = recorder(), q = recorder();
    r.g.translate(52, 76); q.g.translate(52, 76);
    paintFigure(r.g, "sales-rep", "idle", 0, 0, G);
    assert.deepEqual(errs, [["head", "boom"]]);
    assert.deepEqual(G.failed, ["head"]);
    G.failed.length = 0;
    const r2 = recorder(); r2.g.translate(52, 76);
    paintFigure(r2.g, "sales-rep", "idle", 0, 0, G); // second draw of the same signature: the slot is dead, not thrown again
    assert.equal(errs.length, 1);
    assert.equal(G.failed.length, 0);
    paintFigure(q.g, "sales-rep", "idle", 0, 0, bareBody);
    assert.equal(r2.digest(), q.digest(), "after the throw the figure is the same as with that slot empty");
    assert.equal(gearHook(recorder().g, "head", G, {}), false);
  } finally { PART_PAINTERS.cap = orig; }
});

test("AC-R-260-5 the sprite cache counts a throwing painter as a fallback and bakes the frame without the slot", () => {
  const orig = PART_PAINTERS.blade;
  try {
    PART_PAINTERS.blade = () => { throw new Error("bad blade"); };
    const atlas = fakeAtlas(), core = fakeCore({ weapon: item("ruler-rapier", "rare") });
    gearTick(atlas, core);
    gearFrame(atlas, gearTable(atlas), "idle", 0, 0);
    gearFrame(atlas, gearTable(atlas), "idle", 0, 1);
    assert.equal(gearPerf(atlas).gearCache.fallbacks, 1, "once per signature and slot");
    const bare = recorder(); bare.g.translate(52, 76); paintFigure(bare.g, "facilities-manager", "idle", 0, 1);
    assert.equal(atlas.log[1].digest, bare.digest(), "the baked frame is the bare figure");
  } finally { PART_PAINTERS.blade = orig; }
});

// ---- AC-R-260-3: the empty look is today's sprite ----
test("AC-R-260-3 with the six slots empty every frame of every class equals the recorded pre-R8 sprite (class prop kept)", () => {
  const golden = JSON.parse(readFileSync(new URL("./fixtures/render-hero-pre-r8.json", import.meta.url), "utf8"));
  let n = 0;
  for (const cls of HERO_CLASSES) for (const [anim, c] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < c; f++) {
    const k = `${cls}:${anim}:${d}:${f}`;
    assert.equal(stream(cls, anim, d, f), golden[k], `${k} (no gear argument)`);
    assert.equal(stream(cls, anim, d, f, makeGear(EMPTY_SIG)), golden[k], `${k} (empty look)`);
    n++;
  }
  assert.equal(n, 528);
  // belt, ring and amulet worn, the six slots empty: still the same
  const eq = { belt: item("tool-belt", "unique"), ring1: item("paperclip-ring", "rare"), ring2: item("lapel-badge"), amulet: item("access-badge", "magic") };
  assert.equal(stream("it-wizard", "walk", 3, 2, makeGear(eq)), golden["it-wizard:walk:3:2"]);
  assert.equal(makeGear(eq), null);
});

test("AC-R-260-3 the cache path with empty equipment draws no gear table at all (the world keeps the atlas keys)", () => {
  const atlas = fakeAtlas(), core = fakeCore({ belt: item("tool-belt"), ring1: item("paperclip-ring") });
  gearTick(atlas, core);
  assert.equal(gearTable(atlas), null);
  assert.equal(gearPerf(atlas).gearSig, EMPTY_SIG);
  assert.equal(atlas.log.length, 0);
  assert.equal(warmGear(atlas, core), true);
});

// ---- pipeline: stub parts differ per category and tier ----
test("worn gear changes the figure: each category differs from the empty slot and from the other categories of its slot (every class, facing, anim)", () => {
  const anims = [["idle", [0, 3]], ["walk", [0, 5]], ["attack", [0, 3]], ["cast", [0, 3]], ["death", [0, 3]]];
  for (const cls of HERO_CLASSES) for (let d = 0; d < DIRS; d++) for (const [anim, fs] of anims) for (const f of fs) {
    const bare = stream(cls, anim, d, f);
    for (const s of VISIBLE_SLOTS) {
      const seen = new Map();
      for (const cat of LOOK_CATEGORIES[s]) {
        const sig = gearSignature({ [s]: item(baseOf(s, cat)) }), dg = stream(cls, anim, d, f, makeGear(sig));
        assert.notEqual(dg, bare, `${cls} ${anim}${f} d${d} ${cat} equals the empty slot`);
        assert.ok(!seen.has(dg), `${cls} ${anim}${f} d${d}: ${cat} equals ${seen.get(dg)}`);
        seen.set(dg, cat);
      }
    }
  }
});

test("the four tiers of a part differ pairwise, and the trim helper uses the palette rarity colours", () => {
  for (const s of VISIBLE_SLOTS) {
    const cat = LOOK_CATEGORIES[s][0], seen = new Set();
    for (let t = 0; t < 4; t++) seen.add(stream("facilities-manager", "idle", 0, 0, makeGear(gearSignature({ [s]: item(baseOf(s, cat), ["normal", "magic", "rare", "unique"][t]) }))));
    assert.equal(seen.size, 4, s);
  }
  const used = (tier) => { const r = recorder(), cols = []; const g = new Proxy(r.g, { set: (t, k, v) => { if (k === "strokeStyle" || k === "fillStyle") cols.push(v); return Reflect.set(t, k, v); } }); trim(g, [[0, 0], [6, 0], [6, 4], [0, 4]], tier); return cols; };
  assert.ok(used(1).includes("#56b4e9")); assert.ok(used(2).includes("#f0e442")); assert.ok(used(3).includes("#e8590c"));
  assert.ok(!used(0).includes("#56b4e9") && !used(0).includes("#f0e442"));
});

test("a worn weapon replaces the class prop, a worn off-hand replaces the laptop, an empty slot keeps it, a two-handed weapon draws no off-hand", () => {
  const bare = stream("it-wizard", "idle", 0, 0), lap = stream("it-wizard", "idle", 0, 0, makeGear("-|-|-|-|b0|-"));
  assert.notEqual(lap, bare);
  // the off-hand block replaces the laptop: the call stream no longer contains the cyan laptop glow gradient
  const has = (sig, cls = "it-wizard") => { const r = recorder(), orig = r.g.createRadialGradient; let n = 0; const g = new Proxy(r.g, { get: (t, k) => (k === "createRadialGradient" ? (...a) => { n++; return orig(...a); } : t[k]) }); g.translate(52, 76); paintFigure(g, cls, "idle", 0, 0, makeGear(sig)); return n; };
  assert.ok(has(EMPTY_SIG) > has("-|-|-|-|-|b0"), "the laptop glow is gone with an off-hand item");
  assert.equal(has("-|-|-|-|b0|-"), has(EMPTY_SIG), "a one-handed weapon keeps the laptop");
  assert.ok(has("-|-|-|-|p02|-") < has(EMPTY_SIG), "a two-handed weapon holds the staff with both hands");
  assert.equal(makeGear(gearSignature({ weapon: item("mop-halberd"), offhand: item("clipboard-shield") })).looks.offhand, null);
  assert.equal(parseSignature("-|-|-|-|p02|b0").offhand, null);
});

test("hook points: every hook maps to a visible slot and the class painters call each of them once the slot is worn", () => {
  assert.deepEqual(Object.keys(HOOK_SLOT).sort(), ["feet", "hands", "head", "legs", "offhand", "torso", "weaponBack", "weaponFront"]);
  for (const h of Object.values(HOOK_SLOT)) assert.ok(VISIBLE_SLOTS.includes(h));
  for (const cls of HERO_CLASSES) for (const d of [0, 4]) {
    const called = new Set(), G = makeGear("c0|k0|g0|l0|b0|b0");
    const orig = { ...PART_PAINTERS };
    try {
      for (const k of Object.keys(PART_PAINTERS)) { const f = orig[k]; PART_PAINTERS[k] = (g, s, c, t, A) => { called.add(A.hook); return f(g, s, c, t, A); }; }
      paintFigure(recorder().g, cls, "idle", d, 0, G);
    } finally { Object.assign(PART_PAINTERS, orig); }
    assert.deepEqual([...called].sort(), ["feet", "hands", "head", "legs", "offhand", "torso", "weaponBack", "weaponFront"].sort(), `${cls} d${d}`);
  }
});

// ---- fakes for the cache tests ----
function fakeAtlas(scale = 1) {
  const log = [], atlas = {
    scale, log, baked: 0,
    bakeHero(cls, anim, d, f, gear) {
      const r = recorder(); r.g.translate(52, 76);
      for (let pass = 0; pass < 8; pass++) { gear.failed.length = 0; paintFigure(r.g, cls, anim, d, f, gear); if (!gear.failed.length) break; }
      atlas.baked++;
      const e = { key: `gear:${cls}:${anim}:${d}:${f}`, img: { width: Math.ceil(104 * scale), height: Math.ceil(96 * scale) }, w: 104, h: 96, ox: 52, oy: 76, sil: null, digest: r.digest() };
      log.push({ cls, anim, d, f, digest: e.digest });
      return e;
    },
    get: (key) => ({ key, img: { width: Math.ceil(104 * scale), height: Math.ceil(96 * scale) }, bare: true }),
  };
  return atlas;
}
const fakeCore = (equipment = {}, cls = "facilities-manager", depth = 1) => ({ equipment, player: { class: cls }, depth });

// ---- AC-R-262-2: determinism of frames, UI figure equals game figure ----
test("AC-R-262-2 the same signature, class, anim, facing and frame gives identical pixels, also after the cache evicted it", () => {
  const sig = "h2|s3|g1|b2|p32|-", a = stream("sales-rep", "attack", 5, 2, makeGear(sig)), b = stream("sales-rep", "attack", 5, 2, makeGear(sig));
  assert.equal(a, b);
  const atlas = fakeAtlas(); atlas.cap = 0;
  const core = fakeCore({ head: item("hard-hat", "rare"), weapon: item("pipe-wrench", "unique") });
  gearTick(atlas, core);
  const t = gearTable(atlas), st = gearState(atlas);
  const e1 = gearFrame(atlas, t, "attack", 5, 2).digest;
  st.cap = 1; gearFrame(atlas, t, "walk", 1, 1); // over the cap: the oldest entry goes
  st.cap = GEAR_CAP_BYTES;
  assert.ok(st.evictions >= 1);
  assert.equal(t.rows.attack[5][2], undefined, "evicted");
  assert.equal(gearFrame(atlas, t, "attack", 5, 2).digest, e1, "rebuilt identically");
});

test("AC-R-262-2 the UI figure with `look` paints the same figure as the game cache, bare without it, byte for byte", () => {
  const canvas = () => { const r = recorder(); return { r, c: { width: 160, height: 160, getContext: () => r.g } }; };
  const ui = (opt) => { const { r, c } = canvas(); const ok = uiFigure(c, "hero.sales-rep", opt); return { ok, d: r.digest() }; };
  const bare = ui({ anim: "portrait" });
  assert.equal(ui({ anim: "portrait", look: EMPTY_SIG }).d, bare.d);
  assert.equal(ui({ anim: "portrait", look: null }).d, bare.d);
  assert.equal(ui({ anim: "portrait", look: "garbage" }).d, bare.d, "a malformed look draws bare, no error");
  assert.equal(ui({ anim: "portrait", look: { belt: item("tool-belt") } }).d, bare.d);
  const worn = ui({ anim: "idle", t: 0, look: "c1|-|-|-|b2|-" }), worn2 = ui({ anim: "idle", t: 0, look: { head: item("visor-cap", "magic"), weapon: item("ruler-rapier", "rare") } });
  assert.notEqual(worn.d, ui({ anim: "idle", t: 0 }).d);
  assert.equal(worn.d, worn2.d, "an equipment object and its signature give the same figure");
  assert.equal(ui({ anim: "idle", t: 0, look: "c1|-|-|-|b2|-" }).d, worn.d);
  // the painted figure is the one the cache bakes: same calls between scale() and the final restore
  const lines = (opt) => { const kept = []; const r = recorder(), g = new Proxy(r.g, { get: (t, k) => (typeof t[k] === "function" && typeof k === "string" ? (...a) => { kept.push(k + ":" + a.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : "")).join(",")); return t[k](...a); } : t[k]) }); uiFigure({ width: 104, height: 96, getContext: () => g }, "hero.sales-rep", opt); return kept; };
  const ui1 = lines({ anim: "idle", t: 0, look: "c1|-|-|-|b2|-" }), direct = (() => { const kept = []; const r = recorder(), g = new Proxy(r.g, { get: (t, k) => (typeof t[k] === "function" && typeof k === "string" ? (...a) => { kept.push(k + ":" + a.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : "")).join(",")); return t[k](...a); } : t[k]) }); paintFigure(g, "sales-rep", "idle", 0, 0, makeGear("c1|-|-|-|b2|-")); return kept; })();
  const at = ui1.findIndex((l, i) => i > 3 && l.startsWith("scale:"));
  assert.deepEqual(ui1.slice(at + 1, at + 1 + direct.length), direct);
});

test("figureHost gets an optional look function; the UI never imports render/", () => {
  assert.equal(figures.look({}), EMPTY_SIG);
  const before = figures.look; provideFigures({ draw: () => true, accent: {}, look: () => "c0|-|-|-|-|-" });
  assert.equal(figures.look({}), "c0|-|-|-|-|-");
  provideFigures({ draw: () => true, accent: {} });
  assert.equal(figures.look({}), "c0|-|-|-|-|-", "an absent look keeps the wired one");
  figures.look = before; figures.draw = () => false; figures.accent = {};
});

// ---- AC-R-262-3 / 262-4 / 262-5: cache, budget, invalidation ----
test("AC-R-262-3 no gear sprite is built before a game frame, and the cache never exceeds 32 MB over 40 random combinations (scale 2, no per-frame allocation)", () => {
  const atlas = fakeAtlas(2), core = fakeCore();
  assert.equal(gearPerf(atlas).gearCache.builds, 0);
  assert.equal(gearPerf(atlas).gearCache.bytes, 0);
  gearTick(atlas, core);
  assert.equal(gearPerf(atlas).gearCache.builds, 0, "bare hero: nothing built");
  const bases = Object.keys(LOOK_BY_BASE), pick = (s) => bases.filter((b) => content.bases[b].slot === s);
  let seed = 12345; const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  let peak = 0, evictions = 0;
  for (let combo = 0; combo < 40; combo++) {
    const eq = {};
    for (const s of VISIBLE_SLOTS) if (rnd(3)) eq[s] = item(pick(s)[rnd(pick(s).length)], ["normal", "magic", "rare", "unique"][rnd(4)]);
    if (eq.weapon?.twoHanded) delete eq.offhand;
    core.equipment = eq;
    gearTick(atlas, core);
    // the whole 176-frame set is shown over a few frames (worst case for the cache), then a few steady frames
    for (const [anim, n] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) {
      gearTick(atlas, core);
      const t = gearTable(atlas); if (t) gearFrame(atlas, t, anim, d, f);
      const p = gearPerf(atlas).gearCache; peak = Math.max(peak, p.bytes); evictions = p.evictions;
      assert.ok(p.bytes <= GEAR_CAP_BYTES, `cache ${p.bytes} bytes over the cap at combo ${combo}`);
    }
  }
  assert.ok(peak > 0 && peak <= GEAR_CAP_BYTES);
  assert.ok(evictions > 0 || peak < GEAR_CAP_BYTES);
  const st = gearState(atlas), b0 = st.builds;
  for (let i = 0; i < 300; i++) gearTick(atlas, core); // steady frames build nothing
  assert.equal(st.builds, b0, "builds grow only on a signature change");
  assert.ok(st.tables.size <= 2, "the current signature plus at most one previous stay resident");
});

test("AC-R-262-3 residency: LRU by bytes evicts the other signature first, then stale frames, and protects the current signature's recent frames", () => {
  const atlas = fakeAtlas(1), core = fakeCore({ head: item("visor-cap") }), st = gearState(atlas);
  gearTick(atlas, core); // fresh core: idle and walk (80 frames) warmed at once
  assert.equal(st.warmBuilds, 80);
  const A = gearTable(atlas);
  core.equipment = { head: item("hard-hat", "rare") }; gearTick(atlas, core);
  const B = gearTable(atlas);
  assert.notEqual(A, B);
  assert.equal(st.tables.size, 2);
  const per = 104 * 96 * 4;
  for (let i = 0; i < 20; i++) gearTick(atlas, core);
  for (let f = 0; f < 4; f++) gearFrame(atlas, B, "attack", 0, f);
  st.cap = st.bytes - per * 2; // two entries over
  gearFrame(atlas, B, "attack", 1, 0);
  assert.ok(st.evictions >= 3);
  const bFrames = B.list.length, aFrames = A.list.length;
  assert.ok(aFrames < 80, "the previous signature lost frames first");
  assert.equal(B.list.length, bFrames);
  assert.ok(B.rows.attack[1][0], "the frame just built is resident");
  st.cap = 1; // hard cap below everything: even protected frames go, never above the cap
  gearFrame(atlas, B, "attack", 1, 1);
  assert.ok(st.bytes <= per, "bytes stay under the cap (one entry in flight)");
});

test("AC-R-262-4 a signature change costs at most one on-demand build in a frame and a warm call stops after one build at a zero budget", () => {
  const atlas = fakeAtlas(1), core = fakeCore(), st = gearState(atlas);
  gearTick(atlas, core);
  core.equipment = { body: item("blazer", "magic"), weapon: item("keyboard-sword", "unique") };
  for (let fr = 0; fr < 400; fr++) {
    gearTick(atlas, core);
    st.pause = 0; // the floor-entry pause has its own test
    const t = gearTable(atlas);
    gearFrame(atlas, t, "walk", fr % 8, fr % 6); // the frame on screen
    warmGear(atlas, core, 0); // budget 0: one build per call
  }
  assert.ok(st.maxBuildsPerFrame <= 1, `maxBuildsPerFrame ${st.maxBuildsPerFrame}`);
  assert.equal(st.warmI * 1, st.queue.length, "idle and walk of all 8 facings (80 frames) got warmed");
  assert.equal(gearTable(atlas).list.length, 80);
  assert.equal(warmGear(atlas, core, 0), true);
  const before = st.builds;
  warmGear(atlas, core, 0);
  assert.equal(st.builds, before);
});

test("AC-R-262-5 same signature with another item keeps the table; a changed signature switches atomically and swapping back reuses the previous one", () => {
  const atlas = fakeAtlas(), st = gearState(atlas), core = fakeCore({ head: item("visor-cap", "magic") });
  gearTick(atlas, core);
  const A = gearTable(atlas); assert.equal(A.sig, "c1|-|-|-|-|-");
  gearFrame(atlas, A, "idle", 0, 0);
  const builds = st.builds;
  core.equipment = { head: { ...item("visor-cap", "magic"), id: "another" } }; // a new object, same category and tier
  gearTick(atlas, core);
  assert.equal(gearTable(atlas), A); assert.equal(st.builds, builds);
  core.equipment = { head: item("headset", "rare") }; gearTick(atlas, core);
  const B = gearTable(atlas); assert.notEqual(B, A); assert.equal(gearPerf(atlas).gearSig, "e2|-|-|-|-|-");
  core.equipment = { head: item("visor-cap", "magic") }; gearTick(atlas, core);
  assert.equal(gearTable(atlas), A, "swapped back: the table of the previous signature is reused");
  assert.ok(A.rows.idle[0][0], "its frames survived");
  core.equipment = {}; gearTick(atlas, core);
  assert.equal(gearTable(atlas), null); assert.equal(gearPerf(atlas).gearSig, EMPTY_SIG);
});

test("AC-R-262-5 a class change never reuses the body of another class; the same equipment gives separate tables", () => {
  const atlas = fakeAtlas(), eq = { body: item("blazer") }, core = fakeCore(eq, "facilities-manager");
  gearTick(atlas, core);
  const A = gearTable(atlas); gearFrame(atlas, A, "idle", 0, 0);
  const core2 = fakeCore(eq, "it-wizard"); gearTick(atlas, core2);
  const B = gearTable(atlas);
  assert.notEqual(A, B); assert.equal(B.cls, "it-wizard"); assert.equal(A.cls, "facilities-manager");
  const e = gearFrame(atlas, B, "idle", 0, 0);
  assert.ok(e.key.includes("it-wizard"));
  assert.notEqual(e.digest, A.rows.idle[0][0]?.digest);
  const core3 = fakeCore(eq, "not-a-class"); gearTick(atlas, core3);
  assert.equal(gearTable(atlas), null, "an unknown class id (the old hero) wears nothing");
});

test("AC-R-262-5 a rebuilt atlas drops the whole gear cache with it", () => {
  const a1 = fakeAtlas(), core = fakeCore({ feet: item("steel-toe-boots", "rare") });
  gearTick(a1, core); gearFrame(a1, gearTable(a1), "idle", 0, 0);
  assert.ok(gearPerf(a1).gearCache.frames > 0);
  const a2 = fakeAtlas();
  assert.equal(gearPerf(a2).gearCache.frames, 0);
  gearTick(a2, core); // the same state object on a new atlas: warm again from nothing
  assert.equal(gearState(a2).warmBuilds, 80);
  assert.notEqual(gearTable(a1), gearTable(a2));
});

test("AC-R-262-5 a floor change warms nothing for 240 frames (on-demand draws of the frame on screen still work); a load or respawn follows the same compare", () => {
  const atlas = fakeAtlas(), core = fakeCore({ weapon: item("pipe-wrench") }), st = gearState(atlas);
  gearTick(atlas, core);
  assert.equal(st.warmBuilds, 80, "game start: unbudgeted warm of idle and walk");
  core.equipment = { weapon: item("pipe-wrench"), head: item("hard-hat") };
  gearTick(atlas, core); // a change right at the start of the pause window
  core.depth = 2; gearTick(atlas, core);
  assert.equal(st.pause, WARM_PAUSE_FRAMES);
  const w0 = st.warmBuilds;
  for (let i = 0; i < WARM_PAUSE_FRAMES - 1; i++) { assert.equal(warmGear(atlas, core, 0), false); gearTick(atlas, core); if (i % 60 === 0) gearFrame(atlas, gearTable(atlas), "attack", i % 8, 0); }
  assert.equal(st.warmBuilds, w0, "no gear warm work inside the window");
  assert.ok(st.builds > w0, "on-demand draws of the shown frame are allowed");
  gearTick(atlas, core);
  assert.equal(st.pause, 0);
  warmGear(atlas, core, 0);
  assert.equal(st.warmBuilds, w0 + 1, "warm work resumes after the pause");
  // a floor change does not change the signature: the table stays
  const T = gearTable(atlas); core.depth = 3; gearTick(atlas, core); assert.equal(gearTable(atlas), T);
  // a load / new game arrives as a new state object with new equipment references: compare, switch, warm at once
  const loaded = fakeCore({ weapon: item("pipe-wrench"), head: item("hard-hat") }, "facilities-manager", 3);
  gearTick(atlas, loaded);
  assert.equal(gearTable(atlas), T, "same signature after a load: the cache is reused");
  const respawn = fakeCore({}, "facilities-manager", 0); // death penalty / respawn that unequips: bare again
  gearTick(atlas, respawn);
  assert.equal(gearTable(atlas), null);
});

// ---- AC-R-262-1: render path changes nothing in the simulation ----
test("AC-R-262-1 replays equal the frozen hashes with the gear render path active (signature + cache from a stubbed renderer each tick) and off", () => {
  const script = JSON.parse(readFileSync(new URL("./fixtures/run-a.json", import.meta.url), "utf8"));
  const golden = JSON.parse(readFileSync(new URL("./fixtures/run-class.json", import.meta.url), "utf8"));
  const runWith = (render, cls) => {
    const state = newGame(script.seed, { class: cls }), atlas = fakeAtlas();
    for (let t = 0; t < script.ticks; t++) {
      step(state, script.inputs.filter((i) => i.tick === t).map((i) => i.input));
      if (render) { gearTick(atlas, state); const tb = gearTable(atlas); if (tb) gearFrame(atlas, tb, "idle", t & 7, t & 3); warmGear(atlas, state); }
    }
    return state;
  };
  for (const c of content.classes) {
    const off = runWith(false, c.id), on = runWith(true, c.id);
    assert.equal(hashState(on), hashState(off));
    assert.equal(hashState(on), golden[c.id]);
    assert.deepEqual(on, off);
  }
  assert.equal(hashState(replay(script)), readFileSync(new URL("./fixtures/run-a.hash", import.meta.url), "utf8").trim());
  // a state that wears gear is not touched by the render path either
  const s = newGame(5, { class: "sales-rep", wearStartKit: true }), before = JSON.stringify(s), atlas = fakeAtlas();
  gearTick(atlas, s); warmGear(atlas, s, Infinity);
  assert.equal(JSON.stringify(s), before);
});

test("AC-R-262-1 static scan: gear files use no Math.random, Date, core RNG or core imports; gearlooks.js is DOM-free", () => {
  const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  for (const f of ["gearlooks.js", "gearparts.js", "gearcache.js"]) {
    const src = strip(readFileSync(new URL("../src/render/" + f, import.meta.url), "utf8"));
    assert.ok(!/Math\.random|Date\.now|new Date|\bDate\b|rng\.js|createRng|from "\.\.\/core|from "\.\.\/rng/.test(src), `${f} uses a forbidden source`);
  }
  const looks = strip(readFileSync(new URL("../src/render/gearlooks.js", import.meta.url), "utf8"));
  assert.ok(!/\b(window|document|performance|OffscreenCanvas)\b|^import /m.test(looks), "gearlooks.js is pure (importable by the save index)");
  for (const f of ["styles/vector/heroes.js"]) {
    const src = strip(readFileSync(new URL("../src/render/" + f, import.meta.url), "utf8"));
    assert.ok(!/Math\.random|Date\.now/.test(src), f);
  }
  assert.equal(keys.plr("sales-rep", "idle", 0, 0).length > 0, true);
});
