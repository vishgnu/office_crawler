// The browser shell around the pure core: owns the state, the fixed-step loop, the camera, input
// translation and rendering. Everything the test hook needs goes through this object.
import { newGame, step, applyInput, snapshot, hashState, advance, config, spawnMonster, content } from "./core/index.js";
import { makeCamera } from "./render/view.js";
import { drawWorld, drawLight, actorPos } from "./render/world.js";
import { drawHud, hudState } from "./render/hud.js";
import { createFx } from "./render/fx.js";
import { pick } from "./input/pick.js";
import { requiredKeys } from "./render/keys.js";

const MAX_CATCHUP_TICKS = 8;

export function createGame({ canvas, atlas, style, bus, testMode, realtime, seed, atlasMs = 0 }) {
  const g = canvas.getContext("2d");
  const fx = createFx();
  const rs = { facing: new Map() };
  const game = {
    core: null, titleSeed: seed >>> 0, backdrop: null, error: null,
    manual: testMode && !realtime, alpha: 1, acc: 0, prev: new Map(), hover: null,
    cam: null, w: 0, h: 0, dpr: 1, frameMs: [], simMs: 0, simTicks: 0, listeners: [],
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
  const resetRender = () => { game.prev.clear(); rs.facing.clear(); fx.reset(); game.acc = 0; game.hover = null; };
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
  const capture = () => {
    game.prev.clear();
    game.prev.set("player", actorPos(game.core.player));
    for (const m of game.core.monsters) game.prev.set(m.id, actorPos(m));
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
  const place = (a) => {
    const cur = actorPos(a), pv = game.prev.get(a.id) ?? cur;
    return { x: pv.x + (cur.x - pv.x) * game.alpha, y: pv.y + (cur.y - pv.y) * game.alpha };
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
    const missing = requiredKeys(content).filter((k) => !atlas.has(k));
    const f = game.frameMs;
    return { frameMs: f.slice(-120), simMsPerTick: game.simTicks ? game.simMs / game.simTicks : 0, samples: f.length, atlasMs, atlasKeys: atlas.keys().length, atlasMissing: missing };
  };

  // ---- sizing, rendering, loop ----
  game.resize = () => {
    game.w = Math.max(1, window.innerWidth); game.h = Math.max(1, window.innerHeight);
    game.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(game.w * game.dpr); canvas.height = Math.round(game.h * game.dpr);
    canvas.style.width = game.w + "px"; canvas.style.height = game.h + "px";
  };
  game.render = (now) => {
    const w = world();
    g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    g.fillStyle = "#07080c"; g.fillRect(0, 0, game.w, game.h);
    if (!w || !atlas) return;
    const p = place(w.player), shake = fx.shake(now, 1);
    const c = makeCamera(game.w, game.h, p.x + 0.5, p.y + 0.5);
    c.ox += shake.x; c.oy += shake.y;
    game.cam = c;
    const out = drawWorld(g, c, atlas, w, game.prev, game.alpha, fx, now, rs);
    fx.draw(g, c, atlas, now, out.heroDir);
    drawLight(g, c, out.heroScreen);
    if (fx.hurtUntil > now) {
      const k = Math.min(1, (fx.hurtUntil - now) / 260);
      const grad = g.createRadialGradient(game.w / 2, game.h / 2, game.h * 0.35, game.w / 2, game.h / 2, game.h * 0.85);
      grad.addColorStop(0, "rgba(160,0,10,0)"); grad.addColorStop(1, `rgba(160,0,10,${0.5 * k})`);
      g.fillStyle = grad; g.fillRect(0, 0, game.w, game.h);
    }
    if (game.core) drawHud(g, game.w, game.h, game.core, atlas, style, now, game.core.player.target ?? game.hover);
  };
  let last = 0, running = false;
  const frame = (t) => {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(250, t - last || 16); last = t;
    try {
      if (game.core && !game.manual && !game.menu()) {
        const r = advance(game.acc, dt, config.tickHz);
        let ticks = r.ticks; game.acc = r.acc;
        if (ticks > MAX_CATCHUP_TICKS) { ticks = MAX_CATCHUP_TICKS; game.acc = 0; }
        for (let i = 0; i < ticks; i++) game.tick();
        game.alpha = game.acc / 1000;
        if (ticks) emitChange();
      } else { game.acc = 0; game.alpha = 1; }
      game.render(t);
    } catch (err) {
      game.error = String(err?.message ?? err); running = false; emitChange();
      console.error(err);
    }
    game.frameMs.push(dt); if (game.frameMs.length > 600) game.frameMs.shift();
  };
  game.start = () => { game.resize(); game.setBackdrop(); running = true; requestAnimationFrame(frame); };
  return game;
}
