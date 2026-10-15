// Gear sprite cache (ADR-0008 sections 2-4): one baked hero sprite per frame and equipment signature, built lazily, kept per atlas.
//   gearTick(atlas, core)     once per rendered frame: compares the six worn items by identity (no allocation); on a change switches the table atomically.
//   gearFrame(atlas, t, a, d, f)  the on-demand bake of the frame being shown (at most one a frame by construction: the hero shows one frame).
//   warmGear(atlas, core, ms) idle and walk of the current signature, paused 240 frames after a floor change. WARM_MS (0.7) is an average ceiling: a bake costs more than that
//                             (several ms), so it is paid for from a credit that refills by the budget on each call (a bake runs only while the credit is positive, then the credit goes
//                             negative by its measured cost); a frame that already paid an on-demand bake gets no warm bake. A forced (unbudgeted) warm ignores this.
//   gearPerf(atlas)           fields for perf(): gearCache {frames, bytes, builds, ...} and gearSig.
// Entries have the atlas entry shape ({ img, w, h, ox, oy, sil }) so blit / flash / shade / outline work unchanged. The all-empty signature maps to the
// existing atlas keys (no copy). Render only: nothing here touches game state, RNG or the clock beyond performance.now() for the warm budget.
import { keys, PLAYER_ANIMS, DIRS, HERO_CLASSES, heroType } from "./keys.js";
import { VISIBLE_SLOTS, EMPTY_SIG, gearSignature } from "./gearlooks.js";
import { makeGear } from "./gearparts.js";

export const GEAR_CAP_BYTES = 32 * 1024 * 1024; // floor of the cap on the cached pixel data (width x height x 4 per canvas, base sprite plus its cached flash/shade/outline silhouettes; CR8-03)
// The cap scales with the atlas: 200 sprite-sized canvases = idle+walk (80 frames) with one silhouette each (hit flash) = 160, plus 40 for the attack/cast/death frames on show.
// One sprite is ceil(104 s) x ceil(96 s) x 4: 39,936 B at s=1, 159,744 B at s=2 (cap 31.9 MB, so the 32 MB floor holds), 249,600 B at s=2.5 (cap 49.9 MB; idle+walk alone 20.0 MB, 40.0 MB with every frame flashed).
export const GEAR_CAP_SPRITES = 200;
export const gearCapFor = (scale = 1) => Math.max(GEAR_CAP_BYTES, GEAR_CAP_SPRITES * Math.ceil(104 * scale) * Math.ceil(96 * scale) * 4);
export const PROTECT_FRAMES = 120; // frames of the current signature used within this many frames are never evicted (cap permitting)
export const WARM_PAUSE_FRAMES = 240; // after a floor change no warm work runs (R7-2), same pause as warmAhead
export const WARM_MS = 0.7;
const WARM_ANIMS = ["idle", "walk"]; // attack, cast and death are built on demand only
const PLAN_WARM = new Set(WARM_ANIMS);

const states = new WeakMap();

function stateOf(atlas) {
  let st = states.get(atlas);
  if (!st) {
    st = {
      frame: 0, core: null, refs: new Array(6).fill(undefined), cls: "", sig: EMPTY_SIG, cur: null, prev: null, tables: new Map(), bytes: 0, cap: gearCapFor(atlas.scale), credit: 0, warmMs: 0,
      builds: 0, warmBuilds: 0, evictions: 0, fallbacks: 0, frameBuilds: 0, maxBuildsPerFrame: 0, depth: undefined, pause: 0, warmI: 0, warmWork: 0, errors: [], queue: null,
    };
    states.set(atlas, st);
  }
  return st;
}
/** The state of an atlas's cache (tests and the bench read counters from it). */
export const gearState = stateOf;

function newTable(st, cls, sig) {
  const rows = {};
  for (const [anim, n] of Object.entries(PLAYER_ANIMS)) rows[anim] = Array.from({ length: DIRS }, () => new Array(n));
  const t = { key: cls + "/" + sig, cls, sig, rows, list: [], bytes: 0 };
  t.gear = makeGear(sig, (slot, err) => { st.fallbacks++; if (st.errors.length < 8) st.errors.push(`${t.key} ${slot}: ${err?.message ?? err}`); });
  return t;
}

const canvasBytes = (e) => (e.img?.width ?? 0) * (e.img?.height ?? 0) * 4;
// The entry's pixel data: the base canvas plus every silhouette cached on it (atlas.js: sil[mode][colour] and sil.ol[colour][px]), counted wherever they are in the tree.
function silBytes(o) { let b = 0; if (o) for (const v of Object.values(o)) b += v && v.img ? canvasBytes(v) : v && typeof v === "object" ? silBytes(v) : 0; return b; }
const bytesOf = (e) => canvasBytes(e) + silBytes(e.sil);
/** Silhouettes appear after the entry was cached (a hit flash): re-measure the resident entries so st.bytes is the real figure. */
function recount(st) {
  let total = 0;
  for (const t of st.tables.values()) { let tb = 0; for (const it of t.list) { const b = (it.e.cb = bytesOf(it.e)); tb += b; } t.bytes = tb; total += tb; }
  st.bytes = total;
}

function drop(st, t) {
  st.tables.delete(t.key); st.bytes -= t.bytes; t.bytes = 0; t.list.length = 0;
  for (const anim of Object.keys(t.rows)) for (const row of t.rows[anim]) row.fill(undefined);
}

function evictOne(st, forT) {
  let best = null, bi = -1, bt = null, bscore = Infinity;
  for (const t of st.tables.values()) {
    for (let i = 0; i < t.list.length; i++) {
      const it = t.list[i], use = it.e.use ?? 0;
      // rank: other signatures first, then stale frames of the current one, then (hard cap) the oldest of the current one
      // a build for another table (a stale caller) never takes a frame of the current signature while anything else is left
      const score = (t === st.cur ? (forT !== st.cur ? 3e12 : use >= st.frame - PROTECT_FRAMES ? 2e12 : 1e12) : 0) + use;
      if (score < bscore) { bscore = score; best = it; bi = i; bt = t; }
    }
  }
  if (!best) return false;
  if (bt === st.cur && PLAN_WARM.has(best.anim)) st.queue = null; // an idle/walk frame of the current table went: warmGear walks its queue again
  bt.list[bi] = bt.list[bt.list.length - 1]; bt.list.pop();
  best.row[best.f] = undefined;
  const b = best.e.cb ?? bytesOf(best.e); bt.bytes -= b; st.bytes -= b; st.evictions++;
  return true;
}

function build(atlas, st, t, anim, d, f, onDemand) {
  const row = t.rows[anim][d];
  if (row[f]) return row[f];
  let e = null;
  try { e = atlas.bakeHero ? atlas.bakeHero(t.cls, anim, d, f, t.gear) : null; } catch (err) { st.fallbacks++; if (st.errors.length < 8) st.errors.push(`${t.key} bake: ${err?.message ?? err}`); e = null; }
  if (!e) { // no baker (a test atlas) or the bake failed: show the bare sprite of the class, shared with the atlas, not counted in the cache
    e = atlas.get(keys.plr(t.cls, anim, d, f));
    row[f] = e;
    return e;
  }
  e.use = st.frame;
  row[f] = e;
  const b = (e.cb = bytesOf(e)); st.lastB = b;
  t.list.push({ row, f, e, anim }); t.bytes += b; st.bytes += b; st.builds++;
  if (onDemand) { st.frameBuilds++; if (st.frameBuilds > st.maxBuildsPerFrame) st.maxBuildsPerFrame = st.frameBuilds; } else st.warmBuilds++;
  if (st.bytes > st.cap) recount(st);
  while (st.bytes > st.cap && evictOne(st, t)) { /* LRU by bytes */ }
  return e;
}

/** The current gear table ({ rows, ... }) or null while the six slots are empty (the world then uses the atlas keys). */
export const gearTable = (atlas) => states.get(atlas)?.cur ?? null;

/** On-demand bake of the hero frame being shown. The row slot is filled; later frames of the same signature are plain lookups. */
export function gearFrame(atlas, t, anim, d, f) { return build(atlas, stateOf(atlas), t, anim, d, f, true); }

function switchTo(atlas, st, cls, sig) {
  st.prev = st.cur;
  if (sig === EMPTY_SIG) st.cur = null;
  else { const key = cls + "/" + sig; let t = st.tables.get(key); if (!t) st.tables.set(key, (t = newTable(st, cls, sig))); st.cur = t; }
  st.cls = cls; st.sig = sig; st.queue = null; st.warmI = 0;
  for (const t of [...st.tables.values()]) if (t !== st.cur && t !== st.prev) drop(st, t); // the current signature plus at most one previous stay resident
}

/**
 * Once per rendered frame, before the actors are placed. Six identity compares; the signature is recomputed only when a reference (or the class, or the
 * game state object) changed. A load, a new game or a class change arrives as a new core object: the idle and walk frames are then warmed at once, unbudgeted
 * (the shell is behind its transition), so the first game frame is warm.
 */
export function gearTick(atlas, core) {
  const st = stateOf(atlas);
  st.frame++; st.frameBuilds = 0;
  if (st.pause > 0) st.pause--;
  const eq = core.equipment, cls = heroType(core.player?.class), fresh = core !== st.core;
  let changed = fresh || cls !== st.cls;
  if (eq) for (let i = 0; i < 6; i++) { const it = eq[VISIBLE_SLOTS[i]] ?? null; if (it !== st.refs[i]) { st.refs[i] = it; changed = true; } }
  else for (let i = 0; i < 6; i++) if (st.refs[i] !== null) { st.refs[i] = null; changed = true; }
  if (core.depth !== st.depth) { st.depth = core.depth; st.pause = WARM_PAUSE_FRAMES; }
  if (!changed) return st;
  st.core = core;
  const sig = HERO_CLASSES.includes(cls) ? gearSignature(eq) : EMPTY_SIG; // only the three class heroes wear gear
  if (cls !== st.cls || sig !== st.sig) switchTo(atlas, st, cls, sig);
  if (fresh && st.cur) warmGear(atlas, core, Infinity, true);
  return st;
}

/** Idle and walk frames of the current signature, `budgetMs` of work a call (at least one frame). Returns true when nothing is left to warm. */
export function warmGear(atlas, core, budgetMs = WARM_MS, force = false) {
  const st = stateOf(atlas), t = st.cur;
  if (!t) return true;
  if (!st.queue) {
    st.queue = [];
    for (const anim of WARM_ANIMS) for (let d = 0; d < DIRS; d++) for (let f = 0; f < PLAYER_ANIMS[anim]; f++) st.queue.push(anim, d, f);
    st.warmI = 0;
  }
  if (st.warmI >= st.queue.length) return true;
  if (!force && st.pause > 0) return false; // a floor was just loaded: nothing new may draw
  if (!force) {
    if (st.frameBuilds > 0) return false; // this frame already paid an on-demand bake: no warm bake on top of it
    st.credit = Number.isFinite(budgetMs) ? Math.min(st.credit + budgetMs, budgetMs) : Infinity;
  }
  const t0 = performance.now();
  while (st.warmI < st.queue.length) {
    if (!force && st.credit <= 0) return false; // the budget is spent (a bake costs more than one call's budget: the debt is repaid over the next calls)
    const anim = st.queue[st.warmI], d = st.queue[st.warmI + 1], f = st.queue[st.warmI + 2];
    if (!t.rows[anim][d][f]) {
      if (st.lastB && t.bytes + st.lastB > st.cap) { st.warmI = st.queue.length; return true; } // no room: do not rebuild what the cap would evict again
      st.warmI += 3;
      const w0 = st.warmBuilds, b0 = performance.now();
      build(atlas, st, t, anim, d, f, false); st.warmWork += st.warmBuilds - w0;
      const c = performance.now() - b0; st.warmMs += c;
      if (!force) { st.credit -= c; if (performance.now() - t0 >= budgetMs) break; }
    } else st.warmI += 3;
  }
  return st.warmI >= st.queue.length;
}

/** Fields for perf() (AC-R-262-3, 262-4). */
export function gearPerf(atlas) {
  const st = atlas ? states.get(atlas) : null;
  let frames = 0;
  if (st) recount(st);
  if (st) for (const t of st.tables.values()) frames += t.list.length;
  return {
    gearSig: st ? st.sig : EMPTY_SIG,
    gearCache: st
      ? { frames, bytes: st.bytes, builds: st.builds, warmBuilds: st.warmBuilds, evictions: st.evictions, fallbacks: st.fallbacks, maxBuildsPerFrame: st.maxBuildsPerFrame, tables: st.tables.size, cap: st.cap, pause: st.pause }
      : { frames: 0, bytes: 0, builds: 0, warmBuilds: 0, evictions: 0, fallbacks: 0, maxBuildsPerFrame: 0, tables: 0, cap: gearCapFor(atlas?.scale), pause: 0 },
  };
}
