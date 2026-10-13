// The browser shell around the pure core: owns the state, the fixed-step loop, the camera, input
// translation and rendering. Everything the test hook needs goes through this object.
import { newGame, step, applyInput, snapshot, hashState, advance, config, spawnMonster, content } from "./core/index.js";
import { makeCamera, easeFollow } from "./ui/camera.js";
import { hudLayout } from "./ui/layout.js";
import { drawWorld, actorPos } from "./render/world.js";
import { createHud, hudState } from "./render/hud.js";
import { createFx } from "./render/fx.js";
import { createLighting } from "./render/light.js";
import { createLabels } from "./render/labels.js";
import { pick } from "./input/pick.js";
import { requiredKeys } from "./render/keys.js";

const MAX_CATCHUP_TICKS = 8;

export function createGame({ canvas, atlas, style, bus, testMode, realtime, seed, atlasMs = 0, lowFx = false, hc = false }) {
  const g = canvas.getContext("2d");
  const fx = createFx(style), lighting = createLighting(style), labels = createLabels(style), hud = createHud(style);
  fx.lowFx = lowFx;
  const rs = { facing: new Map() };
  const game = {
    core: null, titleSeed: seed >>> 0, backdrop: null, error: null,
    manual: testMode && !realtime, alpha: 1, acc: 0, prev: new Map(), hover: null,
    cam: null, w: 0, h: 0, dpr: 1, frameMs: [], renderMs: [], simMs: 0, simTicks: 0, listeners: [],
    focus: null, lowFx, hc, atlas, atlasChanges: 0, onResize: null,
  };
  const emitChange = () => game.listeners.forEach((fn) => fn());
  game.onChange = (fn) => game.listeners.push(fn);

  bus.on("*", (ev) => fx.handle(ev, game.core ?? game.backdrop, performance.now()));

  // ---- state transitions ----
  game.menu = () => {
    if (game.error) return "error";
    if (!game.core) return "title";
    if (game.core.scene === "dead") return "dead";
    if (game.core.paused) return "pause";
    return null;
  };
  const resetRender = () => { game.prev.clear(); rs.facing.clear(); fx.reset(); game.acc = 0; game.hover = null; game.focus = null; };
  game.setBackdrop = () => { game.backdrop = newGame(game.titleSeed); resetRender(); };
  game.newGame = (s = game.titleSeed) => {
    game.titleSeed = Number(s) >>> 0;
    game.core = newGame(game.titleSeed);
    resetRender(); emitChange();
    return game.core;
  };
  game.toTitle = () => { game.core = null; game.setBackdrop(); emitChange(); };
  game.setSeed = (s) => { game.titleSeed = Number(s) >>> 0; if (!game.core) game.setBackdrop(); };

  // ---- simulation ----
  const capture = () => { // previous-tick positions, written into reused objects
    const set = (a) => { let o = game.prev.get(a.id); if (!o) game.prev.set(a.id, o = { x: 0, y: 0 }); actorPos(a, o); };
    set(game.core.player);
    for (const m of game.core.monsters) set(m);
    if (game.prev.size > game.core.monsters.length + 24) { // forget monsters that are gone
      const live = new Set(["player"]);
      for (const m of game.core.monsters) live.add(m.id);
      for (const id of game.prev.keys()) if (!live.has(id)) game.prev.delete(id);
    }
  };
  const dispatchFrom = (from) => { const ev = game.core.events; for (let i = from; i < ev.length; i++) bus.emit(ev[i]); };
  game.tick = () => {
    capture();
    const t0 = performance.now();
    step(game.core);
    game.simMs += performance.now() - t0; game.simTicks++;
    dispatchFrom(0);
  };
  game.step = (n) => {
    if (!game.core) return;
    const before = game.core.scene;
    for (let i = 0; i < n; i++) { game.tick(); if (game.core.scene !== before) break; }
    game.alpha = 1;
    emitChange(); game.render(performance.now());
  };
  /** Apply one input command now (no time passes). */
  game.input = (cmd) => {
    if (!game.core) return { ok: false, error: "no game running" };
    const from = game.core.events.length;
    const res = applyInput(game.core, cmd);
    dispatchFrom(from);
    emitChange();
    return res;
  };

  // ---- camera, picking ----
  const cur = { x: 0, y: 0 };
  const place = (a, out = { x: 0, y: 0 }) => {
    actorPos(a, cur);
    const pv = game.prev.get(a.id) ?? cur;
    out.x = pv.x + (cur.x - pv.x) * game.alpha; out.y = pv.y + (cur.y - pv.y) * game.alpha;
    return out;
  };
  const world = () => game.core ?? game.backdrop;
  game.camera = () => {
    const w = world();
    if (!w) return null;
    if (!game.manual && game.cam) return game.cam;
    const p = place(w.player);
    return makeCamera(game.w, game.h, p.x + 0.5, p.y + 0.5);
  };
  game.pickAt = (sx, sy, cam = game.camera()) => {
    const actors = game.core.monsters.map((m) => ({ id: m.id, tile: m.tile, pos: place(m), dead: m.ai === "dead" }));
    return pick(cam, actors, sx, sy);
  };

  // ---- pointer + keys (DOM events -> input commands) ----
  game.pointer = (kind, e) => {
    if (!game.core) return;
    // Release/cancel must always reach the core, even under a menu or while paused (S1 review B1).
    if (kind === "up" || kind === "cancel") { game.input({ t: "mouse", phase: kind }); return; }
    if (game.menu()) return;
    const rect = canvas.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pk = game.pickAt(sx, sy);
    game.hover = pk.monsterId;
    if (kind === "down") { if (e.button === 0) game.input({ t: "mouse", phase: "down", tile: pk.tile, button: 0 }); }
    else if (kind === "move") game.input({ t: "mouse", phase: "move", tile: pk.tile });
  };
  game.key = (code) => game.input({ t: "key", code });

  // ---- hook helpers ----
  game.getState = () => {
    const menu = game.menu();
    const base = game.core ? snapshot(game.core) : { scene: "title", tick: 0, seed: game.titleSeed, paused: false };
    if (game.error) base.scene = "error";
    const cam = game.camera();
    base.ui = {
      ...(game.core ? game.core.ui : { notice: null }), menu,
      hud: game.core ? hudState(game.core, game.w, game.h, style) : null,
      camera: cam ? { ox: cam.ox, oy: cam.oy, z: cam.z, w: cam.w, h: cam.h } : null,
      hover: game.hover,
    };
    base.hash = game.core ? hashState(game.core) : null;
    return base;
  };
  game.spawnMonster = (type, tile) => {
    if (!game.core || game.core.scene !== "floor") return { ok: false, error: "no running floor" };
    if (!content.monsters[type]) return { ok: false, error: `unknown monster type: ${type}` };
    const m = spawnMonster(game.core, type, tile);
    if (!m) return { ok: false, error: "tile is not free or not walkable" };
    emitChange();
    return { ok: true, id: m.id };
  };
  game.perf = () => {
    const atlas = game.atlas, missing = requiredKeys(content).filter((k) => !atlas.has(k));
    const f = game.frameMs, r = game.renderMs, avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const sorted = [...r].sort((a, b) => a - b);
    return {
      frameMs: f.slice(-120), simMsPerTick: game.simTicks ? game.simMs / game.simTicks : 0, samples: f.length, atlasMs, atlasKeys: atlas.keys().length, atlasMissing: missing,
      fps: avg(f) ? 1000 / avg(f) : 0, renderMsAvg: avg(r), renderMsP95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0,
      fx: { lowFx: game.lowFx, hc: game.hc }, labels: game.labels(), atlasScale: atlas.scale, atlasRim: atlas.meta.rim, atlasChanges: game.atlasChanges, dpr: game.dpr,
    };
  };
  game.clearPerf = () => { game.frameMs.length = 0; game.renderMs.length = 0; };

  // ---- sizing, rendering, loop ----
  game.resize = () => {
    game.w = Math.max(1, window.innerWidth); game.h = Math.max(1, window.innerHeight);
    game.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(game.w * game.dpr); canvas.height = Math.round(game.h * game.dpr);
    canvas.style.width = game.w + "px"; canvas.style.height = game.h + "px";
    game.onResize?.(game.w, game.h, game.dpr); // main.js rebuilds the atlas when the zoom / devicePixelRatio bucket changes (S5)
  };
  /** Swap in a freshly built atlas (after a resize or devicePixelRatio change). */
  game.setAtlas = (a) => { game.atlas = a; game.atlasChanges++; };
  game.setLowFx = (on) => { game.lowFx = !!on; fx.lowFx = game.lowFx; };
  const focus = { x: 0, y: 0 }, target = { x: 0, y: 0 }, env = { lighting, style, lowFx: false, hc: false };
  let lastRender = 0;
  game.render = (now) => {
    const w = world(), atlas = game.atlas;
    g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    g.fillStyle = "#07080c"; g.fillRect(0, 0, game.w, game.h);
    if (!w || !atlas) return;
    place(w.player, target);
    target.x += 0.5; target.y += 0.5;
    // Camera: eased follow in real time (frame-rate independent, bounded lag); exact snap in the manual test clock.
    if (game.manual || !game.focus) { game.focus = game.focus ?? focus; game.focus.x = target.x; game.focus.y = target.y; }
    else easeFollow(game.focus, target, Math.min(100, now - lastRender), undefined, undefined, game.focus);
    lastRender = now;
    const shake = fx.shake(now, 1);
    const c = makeCamera(game.w, game.h, game.focus.x, game.focus.y);
    c.ox += shake.x; c.oy += shake.y;
    game.cam = c;
    env.lowFx = game.lowFx; env.hc = game.hc;
    lighting.ensure(c, game.lowFx, game.hc);
    const out = drawWorld(g, c, atlas, w, game.prev, game.alpha, fx, now, rs, env);
    lighting.draw(g, c, out.heroScreen, now);
    if (game.core) {
      const L = layoutFor(game.w, game.h);
      labels.place(out.actors, c, L.scale, game.core.player.target, game.hover, out.heroScreen, hudRects(L), game.hc, game.dpr);
      labels.draw(g);
    }
    fx.draw(g, c, atlas, now, out.heroDir);
    fx.drawHurt(g, game.w, game.h, now);
    if (game.core) hud.draw(g, game.w, game.h, game.core, atlas, now, game.core.player.target ?? game.hover, game.dpr, game.hc);
  };
  let lay = null, rectsFor = null, rectsL = null;
  const layoutFor = (w, h) => (lay && lay.w === w && lay.h === h ? lay.L : (lay = { w, h, L: hudLayout(w, h) }).L);
  const hudRects = (L) => (rectsFor === L ? rectsL : (rectsFor = L, rectsL = [L.health.rect, L.mana.rect, L.panel, L.beltPanel]));
  game.labels = () => labels.placed.slice(0, labels.count).map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, moved: r.moved }));
  let last = 0, running = false;
  const frame = (t) => {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(250, t - last || 16); last = t;
    try {
      if (game.core && !game.manual && !game.menu() && t < fx.hitStopUntil) {
        // hit-stop: a few frames of frozen simulation on impact (render keeps running; the time is not banked)
        game.alpha = game.acc / 1000;
      } else if (game.core && !game.manual && !game.menu()) {
        const r = advance(game.acc, dt, config.tickHz);
        let ticks = r.ticks; game.acc = r.acc;
        if (ticks > MAX_CATCHUP_TICKS) { ticks = MAX_CATCHUP_TICKS; game.acc = 0; }
        for (let i = 0; i < ticks; i++) game.tick();
        game.alpha = game.acc / 1000;
        if (ticks) emitChange();
      } else { game.acc = 0; game.alpha = 1; }
      const r0 = performance.now();
      game.render(t);
      game.renderMs.push(performance.now() - r0); if (game.renderMs.length > 600) game.renderMs.shift();
    } catch (err) {
      game.error = String(err?.message ?? err); running = false; emitChange();
      console.error(err);
    }
    game.frameMs.push(dt); if (game.frameMs.length > 600) game.frameMs.shift();
  };
  game.start = () => { game.resize(); game.setBackdrop(); running = true; requestAnimationFrame(frame); };
  return game;
}
