// The browser shell around the pure core: owns the state, the fixed-step loop, the camera, input
// translation and rendering. Everything the test hook needs goes through this object.
import { newGame, step, applyInput, snapshot, hashState, advance, config, spawnMonster, content, setLevel, setHp, teleportFloor, giveGold, spawnItem, takeGround, canPlace, releaseCursor, closeDialog } from "./core/index.js";
import { setQuestStep, completeQuest } from "./core/cheats.js";
import { makeCamera, easeFollow } from "./ui/camera.js";
import { hudLayout, cameraInset, drawerLayout } from "./ui/layout.js";
import { T } from "./ui/text.js";
import { panelFor } from "./input/keys.js";
import { resolveKey } from "./input/keymap.js";
import { defaultOptions } from "./ui/options.js";
import { messageFor } from "./ui/messages.js";
import { trackerOf } from "./ui/journal.js";
import { drawWorld, actorPos, heroSpriteDigest } from "./render/world.js";
import { gearPerf } from "./render/gearcache.js";
import { createHud, hudState } from "./render/hud.js";
import { createFx } from "./render/fx.js";
import { createLighting } from "./render/light.js";
import { createLabels } from "./render/labels.js";
import { createMap } from "./render/map.js";
import { pick } from "./input/pick.js";
import { createToastQueue } from "./ui/toastqueue.js";
import { requiredKeys } from "./render/keys.js";
import { slotsView } from "./save/session.js";
import { damageMonster } from "./core/systems/damage.js";

const MAX_CATCHUP_TICKS = 8;
const QUEST_LINES = new Set(["quest.accepted", "quest.step", "quest.completed"]); // the toasts that keep the lane (CR7-04)
const PASSIVE_LINES = new Set(["levelup", "floorEnter", "potion", "healed", "skillLearned"]); // world lines that wait behind a quest line instead of replacing it
const URGENT_LINES = new Set(["respawn", "portalOpen", "portalUse"]); // FIX-R8T-3: shown at once, ahead of older queued toasts (see ui/toastqueue.js)

export function createGame({ canvas, atlas, style, bus, testMode, realtime, seed, atlasMs = 0, lowFx = false, hc = false, story = false }) {
  const g = canvas.getContext("2d");
  const fx = createFx(style), lighting = createLighting(style), labels = createLabels(style), hud = createHud(style), fmap = createMap(style);
  fx.lowFx = lowFx; fx.hc = hc;
  const rs = { facing: new Map() };
  const game = {
    core: null, titleSeed: seed >>> 0, backdrop: null, error: null,
    manual: testMode && !realtime, alpha: 1, acc: 0, prev: new Map(), hover: null,
    cam: null, w: 0, h: 0, dpr: 1, frameMs: [], renderMs: [], simMs: 0, simTicks: 0, listeners: [],
    focus: null, lowFx, hc, atlas, atlasChanges: 0, onResize: null,
    // persisted options (volume, keys, accessibility; main.js replaces this with the stored object) and a frozen copy the core state points at
    options: defaultOptions(), optSnap: null, titleNotice: null, capturing: false,
    // UI state that is not game state: which drawers are open (left: character | skills | npc), vendor tab, hover tooltip, toast
    ui: { left: null, inventory: false, front: "inventory", vendorTab: "buy", tooltip: null, toast: null, map: false, options: null, story: null, slots: false, create: null, badge: { journal: false } },
    // the real game (story on) starts armed; test fixtures keep the unarmed core default
    storyOn: !!story, wearStartKit: !!story, inset: 0, defaultStart: "town",
  };
  const syncUi = () => { // the NPC window follows the core dialog; the drawers go away with the run
    const u = game.ui;
    if (!game.core) { u.left = null; u.inventory = false; u.tooltip = null; u.map = false; return; }
    if (game.core.scene === "dead") { // R8-T N2: the death screen stands alone: drawers, map and tooltip close, and a held item goes back to the bag (else the floor) so none is lost or duplicated
      game.heldOrigin = null; u.left = null; u.inventory = false; u.invByDialog = false; u.map = false; u.tooltip = null;
      // both are core functions called directly: the input path (intent.js `live`) refuses every command once the scene is dead, so game.input({ t: "closeDialog" }) would do nothing here. Neither emits, so no guard against re-entry is needed
      if (game.core.cursorItem) releaseCursor(game.core); // the real death already did this in the core; this covers any other route to the death scene (bag, else the hero's tile with keep: no loss, no duplicate)
      if (game.core.ui.dialog) closeDialog(game.core); // the core dialog (and an open vendor) is closed now instead of lingering until Respawn
      return;
    }
    if (u.left === "npc" && !game.core.ui.dialog) { u.left = null; if (u.inventory && u.invByDialog && !game.core.cursorItem) u.inventory = false; /* R8-Q2: the bag the dialog opened closes with it */ u.invByDialog = false; if (u.inventory) u.front = "inventory"; u.tooltip = null; }
  };
  const emitChange = () => {
    syncUi();
    if (game.core && game.optSnap && game.core.options !== game.optSnap) game.core.options = game.optSnap; // the options travel with the state (saved, shown by the hook)
    game.listeners.forEach((fn) => fn());
  };
  /** Call after game.options changed: refreshes the copy the core state carries. Persisting and side effects are main.js's job. */
  game.commitOptions = () => { game.optSnap = structuredClone(game.options); emitChange(); };
  game.commitOptions();
  game.onChange = (fn) => game.listeners.push(fn);

  bus.on("*", (ev) => fx.handle(ev, game.core ?? game.backdrop, performance.now()));
  // a new floor: no interpolation from the old position, the camera snaps
  bus.on("floorEnter", () => { game.prev.clear(); rs.facing.clear(); game.focus = null; });
  let portalToast = false; // the Emergency Exit line is not overwritten by the floor name of the same step
  bus.on("*", (ev) => {
    if (!game.core) return;
    // R11-05, the points nudge rule: ONE low line per run ("You have points to spend"), shared with the level-up hint through pointsHintSeen. Only in the real game (storyOn),
    // only when points are unspent, on the first arrival on floor 2 (a passive line: it waits behind the floor name and any quest line) or at the first level-up, whichever comes first.
    // It is also offered when the Emergency Exit check below suppresses the floor name, so an arrival on floor 2 through the portal (whose floor name is suppressed) still gets it.
    const nudge = () => { if (ev.type === "floorEnter" && ev.depth === 2) pointsHint({ passive: true, kind: "pointsHint" }); };
    if (ev.type === "floorEnter" && portalToast) { nudge(); return; }
    const m = messageFor(ev, game.core);
    if (ev.type === "quest.completed") game.toastDrop(ev.id); // R8-Q3: a "return for your reward" line still waiting for this quest would show after it is handed in and look like a repeat
    if (m) game.toast(m, ev.type.startsWith("quest.") ? config.quests.toastMs : undefined, { quest: QUEST_LINES.has(ev.type), passive: PASSIVE_LINES.has(ev.type), urgent: URGENT_LINES.has(ev.type), kind: ev.type, qid: ev.type.startsWith("quest.") ? ev.id : undefined }); // a quest line stays for config.quests.toastMs (AC-R-254-2)
    if (ev.type === "portalOpen" || ev.type === "portalUse") portalToast = true;
    nudge(); // after the floor name of the same step, so it is the second line
  });
  // R7: a new, advanced or completed quest lights the journal badge (cleared when the journal opens); the open journal and the tracker redraw on every change
  bus.on("*", (ev) => {
    if (!game.core || (ev.type !== "quest.accepted" && ev.type !== "quest.step" && ev.type !== "quest.completed")) return;
    if (game.ui.left !== "journal") game.ui.badge.journal = true;
  });
  // R8-Q2: the Desk Drawer opens with a trading NPC window (vendor, stash: AC-R-073-3) only while the play area between the two drawers stays at least 35% of the width (1280 px: 36%); a healer needs no bag, so it never opens it; on a phone one panel shows at a time, so it stays as before
  bus.on("dialog", () => { const D = drawerLayout(game.w, game.h), kind = game.core?.ui.dialog?.kind, had = game.ui.inventory; game.ui.left = "npc"; game.ui.inventory = D.phone || (kind !== "healer" && game.w - D.leftW - D.rightW >= 0.35 * game.w); game.ui.invByDialog = !had && !D.phone && game.ui.inventory; game.ui.front = "left"; game.ui.vendorTab = "buy"; });
  // run summary for the death screen, derived from the event stream (the core keeps no kill counter)
  game.run = { kills: 0 };
  bus.on("kill", () => { if (game.core) game.run.kills++; });
  /** { kills, seconds, depth } of the current run (shown on the death screen). */
  game.summary = () => (game.core ? { kills: game.run.kills, seconds: Math.floor(game.core.tick / config.tickHz), depth: game.core.depth ?? 1 } : null);

  // ---- state transitions ----
  game.menu = () => {
    if (game.error) return "error";
    if (game.ui.options) return "options";
    if (game.ui.slots) return "slots";
    if (game.ui.create) return "create";
    if (!game.core) return "title";
    if (game.core.scene === "dead") return "dead";
    if (game.core.scene === "victory") return "victory";
    if (game.ui.story) return "story";
    if (game.core.paused) return "pause";
    return null;
  };
  let storyBossSeen = false, pointsHintSeen = false;
  /** One-time prompt per run when attribute or skill points are waiting to be spent (at the first level-up, on loading a save, or on the first arrival on floor 2: see the rule above). */
  const pointsHint = (opt) => {
    const p = game.core?.player;
    if (!game.storyOn || pointsHintSeen || !p || !(p.attrPoints > 0 || p.skillPoints > 0)) return;
    pointsHintSeen = true; game.toast(T.pointsHint, undefined, opt);
  };
  bus.on("levelup", () => pointsHint());
  const resetUi = () => { Object.assign(game.ui, { left: null, inventory: false, front: "inventory", vendorTab: "buy", tooltip: null, toast: null, map: false, options: null, story: null, slots: false, create: null, badge: { journal: false } }); game.inset = 0; storyBossSeen = false; pointsHintSeen = false; game.heldOrigin = null; game.toastReset?.(); };
  const resetRender = () => { game.run.kills = 0; game.prev.clear(); rs.facing.clear(); fx.reset(); game.acc = 0; game.hover = null; game.focus = null; };
  game.setBackdrop = () => { game.backdrop = newGame(game.titleSeed, { start: "town" }); resetRender(); };
  /** Start a run. opts.start: "town" (default: the Lobby, R-040) or "floor" (fixtures and tests that want floor 1). */
  game.newGame = (s = game.titleSeed, opts = {}) => {
    game.titleSeed = Number(s) >>> 0;
    game.core = newGame(game.titleSeed, { start: opts.start ?? game.defaultStart, wearStartKit: game.wearStartKit });
    resetUi(); resetRender();
    if (game.storyOn) game.ui.story = "start"; // R-104: the start text, dismissed by click or key
    emitChange();
    return game.core;
  };
  /** Swap in a state built by the save package (Continue). */
  game.loadState = (state) => { game.core = state; resetUi(); resetRender(); emitChange(); pointsHint(); return state; };
  game.dismissStory = () => {
    if (!game.ui.story) return { ok: true };
    if (game.ui.story === "start" && game.core) game.input({ t: "storyRead", id: "start" }); // R7: reading the memo completes main step 1 (refused or repeated is harmless)
    game.ui.story = null; bus.emit({ type: "ui:close" }); emitChange(); return { ok: true };
  };
  /** The journal action "Read the verdict" (main step 6): the core records it, the shell shows the closing text once. */
  game.readVerdict = () => {
    const r = game.input({ t: "storyRead", id: "victory" });
    if (r.ok && game.core?.scene !== "victory") { game.ui.story = "victory"; bus.emit({ type: "ui:open" }); emitChange(); } else if (!r.ok) game.toast(T.verdictRefused);
    return r;
  };
  bus.on("floorEnter", (ev) => { // R-104: the boss text, once per run, the first time the Executive Suite is entered
    if (game.storyOn && game.core && ev.depth === config.bossDepth && !game.core.bossDefeated && !storyBossSeen) { storyBossSeen = true; game.ui.story = "boss"; emitChange(); }
  });
  game.openOptions = () => { if (game.ui.options) return { ok: true }; game.ui.options = game.core ? "pause" : "title"; bus.emit({ type: "ui:open" }); emitChange(); return { ok: true }; };
  game.closeOptions = () => { if (!game.ui.options) return { ok: true }; game.ui.options = null; game.capturing = false; bus.emit({ type: "ui:close" }); emitChange(); return { ok: true }; };
  game.toTitle = () => { game.core = null; fx.plateDraw = null; game.titleNotice = null; slotsCache = null; resetUi(); game.setBackdrop(); emitChange(); };
  game.keepPlaying = () => game.input({ t: "keepPlaying" });
  game.setSeed = (s) => { game.titleSeed = Number(s) >>> 0; if (!game.core) game.setBackdrop(); };

  // ---- saves: slots, characters (R4 contract section 2; the store and the session come from main.js) ----
  let saves = null, slotsCache = null;
  const SESSION_CMDS = new Set(["createCharacter", "selectSlot", "loadSlot", "continue", "deleteSlot", "renameSlot", "copySlot", "exportSlot", "importSlot", "restoreSlot", "takeOverSaves", "dismissSaveNotice"]);
  /** main.js hands over the slot store and the session once the game exists. */
  game.attachSaves = (s) => { saves = s; slotsCache = null; };
  game.refreshSlots = () => { slotsCache = null; };
  /** { index, list, active, last, highlighted, usage, lastError, status } (computed on demand, cached until a command or an autosave changes it). */
  Object.defineProperty(game, "slots", { enumerable: true, get: () => (saves ? (slotsCache ??= slotsView(saves.store, saves.session.highlighted)) : null) });
  /** Begin play with a state the save package built (new character or loaded slot). */
  game.startState = (state, { fresh = false } = {}) => {
    game.titleNotice = null;
    game.core = state; resetUi(); resetRender();
    if (fresh && game.defaultStart === "floor") teleportFloor(state, 1); // legacy fixtures (?start=floor) land on floor 1
    if (fresh && game.storyOn) game.ui.story = "start";
    if (saves?.store.status().storage === "memory") { const text = content.strings.errNoStorage; state.ui.notice = { kind: "save", key: "errNoStorage", text }; } // ADV-R5-06: nothing will be kept
    emitChange();
    if (!fresh) pointsHint();
    return state;
  };
  const noticeText = (notes) => {
    const n = (notes ?? []).find((x) => x.from === 1);
    return n ? content.strings.slotMigrated.replace("{n}", String(n.refundedPoints ?? 0)) : null;
  };
  /** Run a session command (create, load, delete, rename, import, export ...). Always returns { ok, error?, ... }. */
  game.session = (cmd) => {
    if (!saves) return { ok: false, error: "no-storage" };
    const running = game.core && !game.error && game.core.scene !== "error" ? game.core : null, active = saves.store.activeSlot();
    if (running && active !== null && cmd.slot === active && ["deleteSlot", "importSlot"].includes(cmd.t)) return { ok: false, error: "playing" };
    if (running && active !== null && cmd.slot === active && cmd.t === "restoreSlot") return { ok: false, error: "playing" };
    if (running && active !== null && cmd.t === "copySlot" && cmd.to === active) return { ok: false, error: "playing" };
    const r = cmd.t === "restoreSlot" ? saves.store.restorePrev(cmd.slot, { confirm: cmd.confirm !== false }) : // the Undo button is the confirmation; pass confirm:false to get "occupied"
    saves.session.run(cmd, running);
    slotsCache = null;
    if (cmd.t === "createCharacter" && r.ok) { game.startState(r.state, { fresh: true }); }
    else if ((cmd.t === "loadSlot" || cmd.t === "continue") && r.ok) { game.startState(r.state); const m = noticeText(r.notes); if (m) game.toast(m); }
    else if (cmd.t === "renameSlot" && r.ok && running && cmd.slot === active) game.input({ t: "setName", name: r.name }); // the core accepts setName while paused or dead (CR-10)
    if (r.ok && ["createCharacter", "loadSlot", "continue"].includes(cmd.t)) { game.ui.slots = false; game.ui.create = null; game.ui.options = null; game.capturing = false; }
    emitChange();
    return r;
  };
  game.openSlots = () => { if (game.ui.slots) return { ok: true }; game.ui.slots = true; bus.emit({ type: "ui:open" }); emitChange(); return { ok: true }; };
  game.closeSlots = () => { if (!game.ui.slots) return { ok: true }; game.ui.slots = false; bus.emit({ type: "ui:close" }); emitChange(); return { ok: true }; };
  /** The class selection screen. slot: preset target slot (an empty one, or one to overwrite) or null for "the first free slot". */
  game.openCreate = ({ slot = null } = {}) => { game.ui.create = { slot }; game.ui.slots = false; bus.emit({ type: "ui:open" }); emitChange(); return { ok: true }; };
  game.closeCreate = () => { if (!game.ui.create) return { ok: true }; game.ui.create = null; bus.emit({ type: "ui:close" }); emitChange(); return { ok: true }; };

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
  const dispatchFrom = (from) => { portalToast = false; const ev = game.core.events; toastQ.begin(); try { for (let i = from; i < ev.length; i++) bus.emit(ev[i]); } finally { toastQ.end(); } }; // CR7L-01: the lines of one dispatch are ordered, then shown one after the other
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
    if (SESSION_CMDS.has(cmd?.t)) return game.session(cmd);
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
  const isOpen = (n) => (n === "inventory" ? game.ui.inventory : n === "map" ? !!game.ui.map : game.ui.left === n);
  const isLeft = (n) => n === "character" || n === "skills" || n === "npc" || n === "journal";
  game.panels = () => {
    const c = game.core, u = game.ui, d = c?.ui.dialog;
    return {
      inventory: u.inventory, character: u.left === "character", skills: u.left === "skills", journal: u.left === "journal", npc: u.left === "npc",
      vendor: u.left === "npc" && d?.kind === "vendor", stash: u.left === "npc" && d?.kind === "stash", healer: u.left === "npc" && d?.kind === "healer", map: !!u.map,
    };
  };
  game.openPanel = (name) => {
    if (!game.core || game.menu()) return { ok: false, error: "no game running" };
    const u = game.ui;
    const was = isOpen(name);
    if (name === "map") { u.map = true; u.tooltip = null; if (!was) bus.emit({ type: "ui:open" }); emitChange(); return { ok: true }; }
    if (name === "inventory") { u.inventory = true; u.invByDialog = false; u.front = "inventory"; }
    else if (isLeft(name)) {
      if (u.left === "npc" && name !== "npc" && game.core.ui.dialog) game.input({ t: "closeDialog" });
      u.left = name; u.front = "left";
    } else return { ok: false, error: "unknown panel" };
    u.tooltip = null;
    if (name === "journal") u.badge.journal = false;
    if (!was) bus.emit({ type: "ui:open" });
    emitChange();
    return { ok: true };
  };
  game.closePanel = (name) => {
    const u = game.ui, was = isOpen(name);
    if (name === "map") { u.map = false; if (was) bus.emit({ type: "ui:close" }); emitChange(); return { ok: true }; }
    if (name === "inventory") { u.inventory = false; u.invByDialog = false; if (u.left) u.front = "left"; }
    else if (isLeft(name) && u.left) { if (u.left === "npc" && game.core?.ui.dialog) game.input({ t: "closeDialog" }); u.left = null; if (u.inventory) u.front = "inventory"; }
    else return { ok: false, error: "unknown panel" };
    u.tooltip = null;
    if (was) bus.emit({ type: "ui:close" });
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
  // CR7-04 / ADV-R7-02: a quest line keeps the lane for its whole time (config.quests.toastMs). The passive lines of the same tick or the seconds after it (level-up,
  // floor name, potion, healed: they come from the world, not from what the player just did) wait behind it and are then shown, and announced by the live region,
  // one after the other. Direct feedback (a refusal, a hint, a stairs lock) and quest lines still show at once, as before. The wait list is short on purpose: only the
  // latest passive line of a kind waits, so a backlog of stale floor names never builds up.
  // R7-4: the quest lines of one burst (an arc completes: its reward line, then the "new assignment" line of the next arc, in one tick) queue behind each other and show one
  // after the other; a quest line that comes later than QUEST_BURST_MS after the shown one still replaces it at once.
  const toastQ = createToastQueue({ show: (n) => { game.ui.toast = { text: n.text, id: (game.ui.toast?.id ?? 0) + 1, ...(n.ms ? { ms: n.ms } : {}) }; emitChange(); } });
  game.toastDrop = (qid) => toastQ.drop(qid);
  game.toastReset = () => toastQ.reset();
  game.toastWaiting = () => toastQ.waiting();
  /** `opt.quest`: a quest line (holds the lane). `opt.passive`: a world event line (waits behind a held line). Neither: direct feedback (queues behind a held quest line, ahead of passive lines). See ui/toastqueue.js. */
  game.toast = (text, ms, opt = {}) => toastQ.offer(text, ms, opt);

  /**
   * One key press. Panel keys (I, C, S/K) toggle drawers; Escape puts a held item back, then closes the drawers, then
   * goes to the core (which closes an open dialog before it pauses); everything else (F1-F4, belt 1-4) goes to the core.
   */
  game.key = (raw) => {
    if (game.ui.options) { // the Options screen is open: only Escape does something (back); the rest belongs to the panel
      if (raw === "Escape" && !game.capturing) return game.closeOptions();
      return { ok: false, error: "options open" };
    }
    if (game.ui.slots) return raw === "Escape" ? game.closeSlots() : { ok: false, error: "slots open" };
    if (game.ui.create) return raw === "Escape" ? game.closeCreate() : { ok: false, error: "create open" };
    if (!game.core) return { ok: false, error: "no game running" };
    if (game.menu() === "victory") return { ok: false, error: "victory screen" };
    if (game.menu() === "story") return raw === "Escape" ? game.dismissStory() : { ok: false, error: "story open" }; // Enter / Space press the focused button
    const code = resolveKey(raw, game.options.keys); // remapped keys become the action's default code; a moved action's old key is dead
    if (code === null) return { ok: false, error: "key not bound" };
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
    const base = game.core ? snapshot(game.core) : { scene: "title", tick: 0, seed: game.titleSeed, paused: false, options: structuredClone(game.options) };
    if (game.error) base.scene = "error";
    const cam = game.camera();
    base.ui = {
      ...(game.core ? game.core.ui : { notice: game.titleNotice }), menu,
      panels: game.panels(), tracker: trackerOf(base.quests), badge: { journal: !!game.ui.badge.journal }, tooltip: game.ui.tooltip, toast: game.ui.toast?.text ?? null, inset: game.inset, fx: { gore: false, shake: game.shakeOn() ? 1 : 0, flash: game.reduced() ? 0 : 1 }, // no gore by default, none at all (AC-R-103-3)
      hud: game.core ? hudState(game.core, game.w, game.h, style, game.core.player.target ?? game.hover) : null,
      camera: cam ? { ox: cam.ox, oy: cam.oy, z: cam.z, w: cam.w, h: cam.h } : null,
      hover: game.hover,
    };
    base.hash = game.core ? hashState({ ...game.core, options: {} }) : null; // the hash covers the simulation, not the player's settings
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
    setLevel: (n) => { const r = cheat((c) => setLevel(c, n)); pointsHint(); return r; },
    setHp: (n) => cheat((c) => setHp(c, n)),
    /** Class-independent damage for scripted fights (bosses resist fire and cold, so a skill kill depends on the class): true damage through the normal death path. */
    damageMonster: (id, n) => cheat((c) => { const m = c.monsters.find((o) => o.id === id); if (!m || m.ai === "dead") return { ok: false, error: "no such monster" }; damageMonster(c, m, Math.max(1, Math.floor(n)), { source: "player" }); return { ok: true, hp: m.hp }; }),
    teleportFloor: (d) => cheat((c) => teleportFloor(c, d)),
    giveGold: (n) => cheat((c) => (giveGold(c, n) ? { ok: true, gold: c.player.gold } : { ok: false, error: "gold must be a positive integer" })),
    /** Drop a rolled item on the ground next to the hero: opts as rollItem ({slot, rarity, base, ilvl} or {potion:true}). */
    spawnItem: (opts = {}, tile) => cheat((c) => { const e = spawnItem(c, opts, tile ?? c.player.tile); return { ok: true, id: e.id, label: e.label }; }),
    /** spawnItem, then pick it up into the inventory. */
    /** Quest cheats (R7): main step 1..6 or a side state 0..3 / finish a quest; the events go to audio and the UI like the real path. */
    setQuestStep: (id, n) => cheat((c) => setQuestStep(c, id, n)),
    completeQuest: (id) => cheat((c) => completeQuest(c, id)),
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
      fx: { lowFx: game.lowFx, hc: game.hc }, labels: game.labels(), atlasScale: atlas.scale, atlasRim: atlas.meta.rim, atlasChanges: game.atlasChanges, dpr: game.dpr, lootPlates: Math.max(0, (fx.platesPlaced?.length ?? 1) - 1), npcMarkers: fx.npcMarkers ?? [],
      heroDigest: heroSpriteDigest(), platesDrawn: !!fx.plateDraw, ...gearPerf(atlas), // R8: gearSig, gearCache {frames, bytes, builds, warmBuilds, evictions, fallbacks, maxBuildsPerFrame, ...}
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
  // ADV-R7-05: reduced motion is the option OR the OS setting (AC-R-254-3); the query is live, so a change of the OS setting applies at once
  const osMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  game.reduced = () => !!game.options.reducedMotion || !!osMotion?.matches;
  game.shakeOn = () => !game.reduced() && game.options.screenShake !== false;
  game.setHc = (on) => { game.hc = !!on; fx.hc = game.hc; };
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
    const shake = game.shakeOn() ? fx.shake(now, 1) : { x: 0, y: 0 };
    const want = insetTarget(); // drawers open: the hero stays centred in the gap that is left
    if (game.manual) game.inset = want; else game.inset += (want - game.inset) * (1 - Math.exp(-dt / 90));
    const c = makeCamera(game.w, game.h, game.focus.x, game.focus.y, undefined, game.inset);
    c.ox += shake.x; c.oy += shake.y;
    game.cam = c;
    env.lowFx = game.lowFx; env.hc = game.hc; env.reducedMotion = fx.reducedMotion = game.reduced();
    lighting.ensure(c, game.lowFx, game.hc);
    const out = drawWorld(g, c, atlas, w, game.prev, game.alpha, fx, now, rs, env);
    lighting.draw(g, c, out.heroScreen, now);
    if (game.core) {
      const L = layoutFor(game.w, game.h);
      labels.place(out.actors, c, L.scale, game.core.player.target, game.hover, out.heroScreen, hudRects(L), game.hc, game.dpr);
      labels.collect(fx.avoid, fx.avoidSegs); // loot plates and floaters keep clear of the nameplates, pips and leader lines
      fx.plateDraw = labels.draw; // nameplates are drawn by fx.draw, after the loot icons (VFIX-R7)
    } else fx.plateDraw = null; // CR7L-03: no run (the title backdrop): labels.draw would replay the last frame's plates, hp bars and pips
    fx.draw(g, c, atlas, now, out.heroDir);
    if (!game.reduced()) fx.drawHurt(g, game.w, game.h, now);
    if (game.core && game.core.scene === "floor") fx.drawLowHp(g, game.w, game.h, now, game.core.player.hp / Math.max(1, game.core.player.hpMax), bus);
    else if (fx.lowHp) fx.drawLowHp(g, game.w, game.h, now, 0, bus);
    if (game.core) {
      if (game.ui.map) fmap.drawFull(g, game.core, game.w, game.h, now, game.hc); // the automap dims the world; the HUD stays crisp on top
      const stripOnly = (game.ui.left || game.ui.inventory) && drawerLayout(game.w, game.h).short; // R11 U-2: a short landscape phone's panel runs down to the toast strip; the mug, jug, hotbar, belt and minimap would peek out under its edge, so they are not drawn while it is open (the DOM buttons hide the same way: #ui.short-panel .hudui)
      if (!stripOnly) hud.draw(g, game.w, game.h, game.core, atlas, now, game.core.player.target ?? game.hover, game.dpr, game.hc);
      if (!stripOnly && !game.ui.map && game.core.scene !== "dead") fmap.drawMini(g, game.core, fmap.miniRect(game.w, game.h, layoutFor(game.w, game.h)), now, game.hc);
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
