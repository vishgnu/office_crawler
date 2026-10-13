// The browser shell around the pure core: owns the state, the fixed-step loop, the camera, input
// translation and rendering. Everything the test hook needs goes through this object.
import { newGame, step, applyInput, snapshot, hashState, advance, config, spawnMonster, content, setLevel, setHp, teleportFloor, giveGold, spawnItem, takeGround, canPlace } from "./core/index.js";
import { makeCamera, easeFollow } from "./ui/camera.js";
import { hudLayout, cameraInset } from "./ui/layout.js";
import { T } from "./ui/text.js";
import { panelFor } from "./input/keys.js";
import { messageFor } from "./ui/messages.js";
import { drawWorld, actorPos } from "./render/world.js";
import { createHud, hudState } from "./render/hud.js";
import { createFx } from "./render/fx.js";
import { createLighting } from "./render/light.js";
import { createLabels } from "./render/labels.js";
import { createMap } from "./render/map.js";
import { pick } from "./input/pick.js";
import { requiredKeys } from "./render/keys.js";

const MAX_CATCHUP_TICKS = 8;

export function createGame({ canvas, atlas, style, bus, testMode, realtime, seed, atlasMs = 0, lowFx = false, hc = false }) {
  const g = canvas.getContext("2d");
  const fx = createFx(style), lighting = createLighting(style), labels = createLabels(style), hud = createHud(style), fmap = createMap(style);
  fx.lowFx = lowFx; fx.hc = hc;
  const rs = { facing: new Map() };
  const game = {
    core: null, titleSeed: seed >>> 0, backdrop: null, error: null,
    manual: testMode && !realtime, alpha: 1, acc: 0, prev: new Map(), hover: null,
    cam: null, w: 0, h: 0, dpr: 1, frameMs: [], renderMs: [], simMs: 0, simTicks: 0, listeners: [],
    focus: null, lowFx, hc, atlas, atlasChanges: 0, onResize: null,
    // UI state that is not game state: which drawers are open (left: character | skills | npc), vendor tab, hover tooltip, toast
    ui: { left: null, inventory: false, front: "inventory", vendorTab: "buy", tooltip: null, toast: null, map: false },
    inset: 0, defaultStart: "town",
  };
  const syncUi = () => { // the NPC window follows the core dialog; the drawers go away with the run
    const u = game.ui;
    if (!game.core) { u.left = null; u.inventory = false; u.tooltip = null; u.map = false; return; }
    if (u.left === "npc" && !game.core.ui.dialog) { u.left = null; if (u.inventory) u.front = "inventory"; u.tooltip = null; }
  };
  const emitChange = () => { syncUi(); game.listeners.forEach((fn) => fn()); };
  game.onChange = (fn) => game.listeners.push(fn);

  bus.on("*", (ev) => fx.handle(ev, game.core ?? game.backdrop, performance.now()));
  // a new floor: no interpolation from the old position, the camera snaps
  bus.on("floorEnter", () => { game.prev.clear(); rs.facing.clear(); game.focus = null; });
  let portalToast = false; // the Emergency Exit line is not overwritten by the floor name of the same step
  bus.on("*", (ev) => {
    if (!game.core) return;
    if (ev.type === "floorEnter" && portalToast) return;
    const m = messageFor(ev, game.core);
    if (m) game.toast(m);
    if (ev.type === "portalOpen" || ev.type === "portalUse") portalToast = true;
  });
  bus.on("dialog", () => { game.ui.left = "npc"; game.ui.inventory = true; game.ui.front = "left"; game.ui.vendorTab = "buy"; });
  // run summary for the death screen, derived from the event stream (the core keeps no kill counter)
  game.run = { kills: 0 };
  bus.on("kill", () => { if (game.core) game.run.kills++; });
  /** { kills, seconds, depth } of the current run (shown on the death screen). */
  game.summary = () => (game.core ? { kills: game.run.kills, seconds: Math.floor(game.core.tick / config.tickHz), depth: game.core.depth ?? 1 } : null);

  // ---- state transitions ----
  game.menu = () => {
    if (game.error) return "error";
    if (!game.core) return "title";
    if (game.core.scene === "dead") return "dead";
    if (game.core.paused) return "pause";
    return null;
  };
  const resetUi = () => { Object.assign(game.ui, { left: null, inventory: false, front: "inventory", vendorTab: "buy", tooltip: null, toast: null, map: false }); game.inset = 0; game.heldOrigin = null; };
  const resetRender = () => { game.run.kills = 0; game.prev.clear(); rs.facing.clear(); fx.reset(); game.acc = 0; game.hover = null; game.focus = null; };
  game.setBackdrop = () => { game.backdrop = newGame(game.titleSeed); resetRender(); };
  /** Start a run. opts.start: "town" (default: the Lobby, R-040) or "floor" (fixtures and tests that want floor 1). */
  game.newGame = (s = game.titleSeed, opts = {}) => {
    game.titleSeed = Number(s) >>> 0;
    game.core = newGame(game.titleSeed, { start: opts.start ?? game.defaultStart });
    resetUi(); resetRender(); emitChange();
    return game.core;
  };
  game.toTitle = () => { game.core = null; resetUi(); game.setBackdrop(); emitChange(); };
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
  const dispatchFrom = (from) => { portalToast = false; const ev = game.core.events; for (let i = from; i < ev.length; i++) bus.emit(ev[i]); };
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
    if (cmd?.t === "restart") { game.run.kills = 0; fx.reset(); }
    const res = applyInput(game.core, cmd);
    if (cmd?.t === "restart" && res.ok) { resetUi(); resetRender(); }
    if (cmd?.t === "respawn" && res.ok) { game.ui.left = null; game.ui.tooltip = null; game.prev.clear(); game.focus = null; }
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
    return makeCamera(game.w, game.h, p.x + 0.5, p.y + 0.5, undefined, insetTarget());
  };
  game.pickAt = (sx, sy, cam = game.camera()) => {
    const actors = game.core.monsters.map((m) => ({ id: m.id, tile: m.tile, pos: place(m), dead: m.ai === "dead" }));
    for (const n of game.core.floor.npcs ?? []) actors.push({ id: n.id, tile: n.tile, pos: n.tile, dead: false, npc: true });
    return pick(cam, actors, sx, sy);
  };

  // ---- pointer + keys (DOM events -> input commands) ----
  // Right mouse = the selected skill (QF-01-4); the left button moves/attacks. A held item blocks both: it must be placed first.
  game.pointer = (kind, e) => {
    if (!game.core) return;
    // Release/cancel must always reach the core, even under a menu or while paused (S1 review B1).
    if (kind === "up" || kind === "cancel") { game.input({ t: "mouse", phase: kind, button: e?.button }); return; }
    if (game.menu()) return;
    const rect = canvas.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pk = game.pickAt(sx, sy);
    game.hover = pk.monsterId ?? (pk.npcId ? `npc:${pk.npcId}` : null); // nameplate id of a hovered NPC is "npc:<id>"
    const loot = !pk.monsterId && !pk.npcId ? game.core.groundItems.find((e) => e.tile.x === pk.tile.x && e.tile.y === pk.tile.y) : null;
    fx.hoverLootId = loot?.id ?? null; // the plate of the hovered pile is forced visible
    if (kind === "down") {
      if (e.button !== 0 && e.button !== 2) return;
      if (game.core.cursorItem) { game.toast(T.msgHeldWorld); return; }
      const r = game.input({ t: "mouse", phase: "down", tile: pk.tile, button: e.button });
      if (!r.ok && e.button === 2 && r.error === "no skill selected") game.toast(T.noSkillSelected);
    } else if (kind === "move") game.input({ t: "mouse", phase: "move", tile: pk.tile });
  };

  // ---- panels (UI state, not game state) ----
  const isLeft = (n) => n === "character" || n === "skills" || n === "npc";
  game.panels = () => {
    const c = game.core, u = game.ui, d = c?.ui.dialog;
    return {
      inventory: u.inventory, character: u.left === "character", skills: u.left === "skills", npc: u.left === "npc",
      vendor: u.left === "npc" && d?.kind === "vendor", stash: u.left === "npc" && d?.kind === "stash", healer: u.left === "npc" && d?.kind === "healer", map: !!u.map,
    };
  };
  game.openPanel = (name) => {
    if (!game.core || game.menu()) return { ok: false, error: "no game running" };
    const u = game.ui;
    if (name === "map") { u.map = true; u.tooltip = null; emitChange(); return { ok: true }; }
    if (name === "inventory") { u.inventory = true; u.front = "inventory"; }
    else if (isLeft(name)) {
      if (u.left === "npc" && name !== "npc" && game.core.ui.dialog) game.input({ t: "closeDialog" });
      u.left = name; u.front = "left";
    } else return { ok: false, error: "unknown panel" };
    u.tooltip = null; emitChange();
    return { ok: true };
  };
  game.closePanel = (name) => {
    const u = game.ui;
    if (name === "map") { u.map = false; emitChange(); return { ok: true }; }
    if (name === "inventory") { u.inventory = false; if (u.left) u.front = "left"; }
    else if (isLeft(name) && u.left) { if (u.left === "npc" && game.core?.ui.dialog) game.input({ t: "closeDialog" }); u.left = null; if (u.inventory) u.front = "inventory"; }
    else return { ok: false, error: "unknown panel" };
    u.tooltip = null;
    if (!u.inventory && game.core?.cursorItem) { game.input({ t: "releaseCursor" }); game.heldOrigin = null; }
    emitChange();
    return { ok: true };
  };
  game.togglePanel = (name) => {
    const open = name === "inventory" ? game.ui.inventory : name === "map" ? game.ui.map : game.ui.left === name;
    return open ? game.closePanel(name) : game.openPanel(name);
  };
  /** Where the item in hand came from ({kind:'grid',x,y} | {kind:'slot',k} | {kind:'belt',i}), so it can go back there. */
  game.heldOrigin = null;
  game.returnHeld = () => {
    const c = game.core, it = c?.cursorItem, o = game.heldOrigin;
    game.heldOrigin = null;
    if (!it) return { ok: true };
    if (o?.kind === "grid" && canPlace(c.inventory, it, o.x, o.y)) game.input({ t: "invClick", grid: "inventory", x: o.x, y: o.y });
    else if (o?.kind === "slot") game.input({ t: "slotClick", slot: o.k });
    else if (o?.kind === "belt") game.input({ t: "beltClick", index: o.i });
    return c.cursorItem ? game.input({ t: "releaseCursor" }) : { ok: true };
  };
  game.anyPanel = () => game.ui.inventory || !!game.ui.left;
  const insetTarget = () => (game.core && !game.menu() ? cameraInset(game.w, game.h, { left: !!game.ui.left, right: game.ui.inventory }) : 0);

  /** Short message for the toast line and the live region (the UI layer shows it). */
  game.toast = (text) => { game.ui.toast = { text, id: (game.ui.toast?.id ?? 0) + 1 }; emitChange(); };

  /**
   * One key press. Panel keys (I, C, S/K) toggle drawers; Escape puts a held item back, then closes the drawers, then
   * goes to the core (which closes an open dialog before it pauses); everything else (F1-F4, belt 1-4) goes to the core.
   */
  game.key = (code) => {
    if (!game.core) return { ok: false, error: "no game running" };
    const panel = panelFor(code);
    if (panel) return game.menu() ? { ok: false, error: "menu open" } : game.togglePanel(panel);
    if (code === "Escape" && !game.menu()) {
      if (game.ui.map) return game.closePanel("map");
      if (game.core.cursorItem) { const r = game.returnHeld(); game.ui.tooltip = null; return r; }
      if (game.anyPanel()) {
        if (game.core.ui.dialog) game.input({ t: "closeDialog" });
        game.ui.left = null; game.ui.inventory = false; game.ui.tooltip = null; game.heldOrigin = null; emitChange();
        return { ok: true };
      }
    }
    return game.input({ t: "key", code });
  };

  // ---- hook helpers ----
  game.getState = () => {
    const menu = game.menu();
    const base = game.core ? snapshot(game.core) : { scene: "title", tick: 0, seed: game.titleSeed, paused: false };
    if (game.error) base.scene = "error";
    const cam = game.camera();
    base.ui = {
      ...(game.core ? game.core.ui : { notice: null }), menu,
      panels: game.panels(), tooltip: game.ui.tooltip, toast: game.ui.toast?.text ?? null, inset: game.inset, fx: { gore: false }, // no gore by default (AC-R-103-3)
      hud: game.core ? hudState(game.core, game.w, game.h, style, game.core.player.target ?? game.hover) : null,
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
  // ---- cheats (R-123): the hook exposes these under cheat.* with ?test=1 only ----
  const cheat = (fn) => {
    if (!game.core) return { ok: false, error: "no game running" };
    const from = game.core.events.length;
    const r = fn(game.core);
    dispatchFrom(from); emitChange(); game.render(performance.now());
    return r;
  };
  game.cheat = {
    setLevel: (n) => cheat((c) => setLevel(c, n)),
    setHp: (n) => cheat((c) => setHp(c, n)),
    teleportFloor: (d) => cheat((c) => teleportFloor(c, d)),
    giveGold: (n) => cheat((c) => (giveGold(c, n) ? { ok: true, gold: c.player.gold } : { ok: false, error: "gold must be a positive integer" })),
    /** Drop a rolled item on the ground next to the hero: opts as rollItem ({slot, rarity, base, ilvl} or {potion:true}). */
    spawnItem: (opts = {}, tile) => cheat((c) => { const e = spawnItem(c, opts, tile ?? c.player.tile); return { ok: true, id: e.id, label: e.label }; }),
    /** spawnItem, then pick it up into the inventory. */
    giveItem: (opts = {}) => cheat((c) => {
      const e = spawnItem(c, opts, c.player.tile), r = takeGround(c, e); // straight into the drawer, wherever the pile landed
      return r.ok ? { ok: true, id: e.id, label: e.label } : { ok: false, error: r.error };
    }),
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
  game.setShowLoot = (on) => { fx.showAllLoot = !!on; };
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
    const dt = Math.min(100, Math.max(0, now - lastRender));
    lastRender = now;
    const shake = fx.shake(now, 1);
    const want = insetTarget(); // drawers open: the hero stays centred in the gap that is left
    if (game.manual) game.inset = want; else game.inset += (want - game.inset) * (1 - Math.exp(-dt / 90));
    const c = makeCamera(game.w, game.h, game.focus.x, game.focus.y, undefined, game.inset);
    c.ox += shake.x; c.oy += shake.y;
    game.cam = c;
    env.lowFx = game.lowFx; env.hc = game.hc;
    lighting.ensure(c, game.lowFx, game.hc);
    const out = drawWorld(g, c, atlas, w, game.prev, game.alpha, fx, now, rs, env);
    lighting.draw(g, c, out.heroScreen, now);
    if (game.core) {
      const L = layoutFor(game.w, game.h);
      labels.place(out.actors, c, L.scale, game.core.player.target, game.hover, out.heroScreen, hudRects(L), game.hc, game.dpr);
      labels.collect(fx.avoid, fx.avoidSegs); // loot plates and floaters keep clear of the nameplates, pips and leader lines
      labels.draw(g);
    }
    fx.draw(g, c, atlas, now, out.heroDir);
    fx.drawHurt(g, game.w, game.h, now);
    if (game.core && game.core.scene === "floor") fx.drawLowHp(g, game.w, game.h, now, game.core.player.hp / Math.max(1, game.core.player.hpMax), bus);
    else if (fx.lowHp) fx.drawLowHp(g, game.w, game.h, now, 0, bus);
    if (game.core) {
      hud.draw(g, game.w, game.h, game.core, atlas, now, game.core.player.target ?? game.hover, game.dpr, game.hc);
      if (game.menu() === null || game.menu() === "pause") {
        if (game.ui.map) fmap.drawFull(g, game.core, game.w, game.h, now, game.hc);
        else if (game.core.scene !== "dead") fmap.drawMini(g, game.core, fmap.miniRect(game.w, game.h, layoutFor(game.w, game.h)), now, game.hc);
      }
    }
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
