// Boot: build the sprite atlas, create the game shell, wire DOM events, optionally install the test hook.
import { content } from "./core/index.js";
import { createBus } from "./bus.js";
import { getStyle, defaultStyleId } from "./render/style.js";
import { viewConfig } from "./ui/layout.js";
import { worldScale } from "./ui/camera.js";
import { createGame } from "./game.js";
import { createScreens } from "./ui/screens.js";
import { createPanels } from "./ui/panels.js";
import { preventsDefault } from "./input/keys.js";
import { installTestHook } from "./testhook/index.js";
import { createAudio } from "./audio/index.js";
import { createSlotStore, createSession, createAdapter } from "./save/index.js";
import { normalizeOptions } from "./ui/options.js";
import { errorText } from "./ui/slots.js";
import { bindKey, defaultKeys } from "./input/keymap.js";
import { T } from "./ui/text.js";

const S = content.strings;
const params = new URLSearchParams(location.search);
const testMode = params.get("test") === "1";
if (testMode) document.documentElement.classList.add("noanim"); // no panel slide in tests: states are asserted at once
// `?seed=` is honoured in every mode on purpose: it lets players share a run. Without it the seed comes from the clock.
// Render options: ?hc=1 high-contrast (solid plates, no light tint, thick rims), ?lowfx=1 flat cheap lighting, ?zoom=N camera zoom.
let hc = params.get("hc") === "1", lowFx = params.get("lowfx") === "1";
const zoomParam = Number(params.get("zoom"));
if (params.get("zoom") && Number.isFinite(zoomParam) && zoomParam >= 0.4 && zoomParam <= 4) viewConfig.zoom = zoomParam;
const seedParam = Number(params.get("seed"));
const seedFixed = testMode || (params.get("seed") !== null && params.get("seed") !== "");
const seed = Number.isFinite(seedParam) && params.get("seed") !== null && params.get("seed") !== "" ? seedParam : testMode ? 1 : Date.now() % 2147483647;

async function boot() {
  document.title = S.gameTitle;
  const overlay = document.getElementById("overlay");
  overlay.textContent = S.loading;
  overlay.className = "loading";

  // Saved data and options come first: the options decide the sound kit, the key bindings and the render flags.
  let shellSync = () => {};
  let tabId = null; // survives a reload of the same tab (sessionStorage), differs between tabs
  try { tabId = sessionStorage.getItem("oc.tab") ?? (crypto.randomUUID?.() ?? `t${Date.now()}${Math.floor(Math.random() * 1e9)}`); sessionStorage.setItem("oc.tab", tabId); } catch { tabId = `t${Date.now()}`; }
  const store = createSlotStore(createAdapter(), { now: () => Date.now(), tabId, onNotice: (key, extra) => notify(key, extra) });
  const options = normalizeOptions(store.loadOptions());
  if (hc) options.highContrast = true; // ?hc=1 / ?lowfx=1 switch the option on for this session
  if (lowFx) options.lowFx = true;
  hc = options.highContrast; lowFx = options.lowFx;
  let game = null;
  function notify(key, extra) { // a save problem or result: toast while playing, a line on the title screen otherwise
    let text = content.strings[key];
    if (!text) return;
    if (key === "slotMigrated") text = text.replace("{n}", String(extra?.refundedPoints ?? 0));
    if (game?.core) { game.core.ui.notice = { kind: "save", key, text }; game.toast(text); } else if (game) { game.titleNotice = text; shellSync(); }
  }
  const style = getStyle(testMode ? params.get("style") ?? defaultStyleId : defaultStyleId);
  const t0 = performance.now();
  // Atlas sharpness follows the on-screen size of a logical px (zoom x HUD scale x devicePixelRatio); the rim ring is 2 screen px
  // wide (3.5 in high-contrast mode). Both are bucketed so a resize does not rebuild the atlas for every pixel.
  const atlasParams = (w, h, dpr) => {
    const z = worldScale(w, h), d = Math.min(dpr || 1, 2);
    return { scale: Math.min(2.5, Math.max(1, Math.ceil(z * d * 2 - 0.01) / 2)), rim: Math.min(3, Math.max(0.5, Math.round(((hc ? 3.5 : 2) / z) * 4) / 4)), hc };
  };
  const keyOf = (a) => `${a.scale}|${a.rim}|${a.hc ? 1 : 0}`;
  let current = atlasParams(innerWidth, innerHeight, devicePixelRatio);
  let atlas = await style.build((p) => { overlay.dataset.progress = String(Math.round(p * 100)); }, current);
  const atlasMs = performance.now() - t0;
  overlay.className = ""; overlay.textContent = "";

  const canvas = document.getElementById("game");
  const bus = createBus();
  game = createGame({ canvas, atlas, style, bus, testMode, realtime: params.get("realtime") === "1", seed, atlasMs, lowFx, hc, story: !testMode || params.get("story") === "1" });

  game.options = options; game.commitOptions();
  const audio = createAudio({ bus, getState: () => game.core ?? null, options }); // writes volume / mute / kit back into `options`
  const unlock = () => { if (audio.unlock()) { removeEventListener("pointerdown", unlock, true); removeEventListener("keydown", unlock, true); } };
  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);

  if (testMode && params.get("start") === "floor") game.defaultStart = "floor"; // legacy fixtures: New game lands on floor 1

  // S5: rebuild the atlas when the zoom / devicePixelRatio bucket changes (debounced; the old atlas stays in use until the new one is ready).
  let pending = null, building = false;
  game.onResize = (w, h, dpr) => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      const want = atlasParams(w, h, dpr);
      if (building || keyOf(want) === keyOf(current)) return;
      building = true;
      try { game.setAtlas(await style.build(() => {}, want)); current = want; } finally { building = false; }
      if (keyOf(atlasParams(game.w, game.h, game.dpr)) !== keyOf(current)) game.onResize(game.w, game.h, game.dpr);
    }, 250);
  };

  // ---- options: one place that persists and applies them ----
  const applyOptions = () => {
    const root = document.documentElement, o = game.options;
    root.classList.toggle("hc", !!o.highContrast);
    root.classList.toggle("noanim", testMode || !!o.reducedMotion);
    root.style.setProperty("--ts", String(o.textScale));
    game.setLowFx(!!o.lowFx);
    if (hc !== !!o.highContrast) { hc = !!o.highContrast; game.setHc(hc); game.onResize?.(game.w, game.h, game.dpr); } // the atlas has a high-contrast variant
  };
  const commit = () => { game.commitOptions(); store.saveOptions(game.options); applyOptions(); };
  applyOptions();
  const optionsCtl = {
    get: () => game.options,
    setVolume: (ch, v) => { audio.setVolume(ch, v); commit(); },
    setMuted: (b) => { audio.setMuted(b); commit(); },
    setKit: (id) => { audio.setKit(id); commit(); },
    previewKit: () => { // a short phrase in the selected kit: click, pickup, level-up
      audio.unlock();
      audio.handleEvent({ type: "ui:click" });
      setTimeout(() => audio.handleEvent({ type: "pickup", rarity: "rare" }), 200);
      setTimeout(() => audio.handleEvent({ type: "levelup" }), 520);
    },
    setFlag: (name, on) => { game.options[name] = !!on; commit(); },
    setTextScale: (n) => { game.options.textScale = n; commit(); },
    setKey: (action, code) => {
      const r = bindKey(game.options.keys, action, code);
      if (r.ok) { game.options.keys = r.keys; commit(); return r; }
      const key = r.reason === "conflict" ? "optKeysConflict" : r.reason === "reserved" ? "optKeysReserved" : "optKeysInvalid"; // a rejected binding leaves the keys alone and says why
      if (game.core) game.core.ui.notice = { kind: "options", key, text: T[key] };
      return r;
    },
    restoreKeys: () => { game.options.keys = defaultKeys(); commit(); },
    capture: (on) => { game.capturing = !!on; },
    click: () => bus.emit({ type: "ui:click" }),
  };

  // ---- save slots ----
  const session = createSession(store, { seedSource: () => (seedFixed ? game.titleSeed : (Date.now() ^ Math.floor(Math.random() * 1e9)) % 2147483647) });
  game.attachSaves({ store, session });
  const mig = store.migrateLegacy(); // before the title: an old single-slot save becomes slot 1 (the old keys stay as a backup)
  game.refreshSlots();
  const download = (name, text) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" })), a = document.createElement("a");
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const anyOk = () => game.slots?.index.slots.some((e) => e.state === "ok");
  const saveApi = {
    has: () => anyOk(),
    /** Forced save of the running game into its active slot. */
    write: () => { if (!game.core) return { ok: false, error: "no game running" }; const r = store.autosave(game.core, {}, { force: true }); game.refreshSlots(); shellSync(); return r; },
    read: (n) => { const t = store.raw(n ?? store.activeSlot() ?? store.lastUsed()); try { return t === null ? null : JSON.parse(t); } catch { return null; } },
    raw: (n) => store.raw(n ?? store.activeSlot() ?? store.lastUsed()),
    export: (n, which = "current") => { const r = store.exportText(n, which); return r.ok ? r.text : null; },
    import: (n, text, confirm = true) => { const r = store.importText(n, text, { confirm }); game.refreshSlots(); shellSync(); return r; },
    remove: (n) => { const r = store.remove(n ?? store.activeSlot(), { confirm: true }); game.refreshSlots(); shellSync(); return r; },
  };
  if (mig.migrated) notify("slotMigrated", mig.migrated);
  bus.on("autosave", (ev) => { if (game.core) { const r = store.autosave(game.core, ev); if (r.ok && !r.skipped) game.refreshSlots(); } });
  const flush = () => { if (game.core && !game.error && game.core.scene !== "error") { store.autosave(game.core, {}, { force: true }); game.refreshSlots(); } };
  addEventListener("pagehide", () => { flush(); store.clearActive(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); audio.setVisible(document.visibilityState !== "hidden"); });
  // Leaving a session (Quit to title, game over, victory) saves first: Continue must show what the player just did.
  const saveAndQuit = () => { flush(); store.clearActive(); game.toTitle(); };
  const shell = { download, session: (cmd) => game.session(cmd), slots: () => game.slots, active: () => store.activeSlot(), adapter: store.adapter, playing: () => !!game.core };

  const screens = createScreens(overlay, {
    ...shell,
    openSlots: () => game.openSlots(), closeSlots: () => game.closeSlots(), openCreate: (o) => game.openCreate(o), closeCreate: () => game.closeCreate(),
    titleMessage: (r) => { game.titleNotice = errorText(r.error); shellSync(); },
    resume: () => game.key("Escape"),
    restart: () => game.input({ t: "restart" }),
    respawn: () => game.input({ t: "respawn" }),
    keepPlaying: () => game.keepPlaying(),
    quit: saveAndQuit,
    dismissStory: () => game.dismissStory(),
    openOptions: () => game.openOptions(),
    closeOptions: () => game.closeOptions(),
    optionsCtl, // the Options panel embeds the slot manager and talks to the shell through h.session / h.slots
    emit: (type) => bus.emit({ type }),
  });
  const sync = () => screens.show(game.menu(), {
    seed: game.titleSeed, error: game.error, summary: game.menu() === "dead" ? game.summary() : null,
    slots: game.slots, create: game.ui.create, playing: !!game.core, story: game.ui.story, notice: game.core ? null : game.titleNotice, victory: game.core?.victory?.stats ?? null,
  });
  shellSync = sync;
  game.onChange(sync);
  createPanels(document.getElementById("ui"), game);

  // Right mouse is a game button (the selected skill): the browser menu never opens in the page (R-005, AC-R-015-2).
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture?.(e.pointerId); document.activeElement?.blur?.(); game.pointer("down", e); });
  canvas.addEventListener("pointermove", (e) => game.pointer("move", e));
  canvas.addEventListener("pointerup", (e) => game.pointer("up", e));
  canvas.addEventListener("pointercancel", (e) => game.pointer("cancel", e));
  window.addEventListener("resize", () => game.resize());
  window.addEventListener("keyup", (e) => { if (e.code === "AltLeft" || e.code === "AltRight") game.setShowLoot(false); });
  window.addEventListener("blur", () => game.setShowLoot(false));
  window.addEventListener("keydown", (e) => {
    if (game.capturing) return; // the Options screen is waiting for a key to bind
    // F1-F4 select the right-mouse skill (the browser's own function keys must not fire). Tab stays free: panels and buttons are keyboard-reachable.
    if (preventsDefault(e.code) || (e.code === "Tab" && game.menu() === null && !game.anyPanel())) e.preventDefault(); // Tab is reserved for the map while no panel is open
    if (e.code === "AltLeft" || e.code === "AltRight") game.setShowLoot(true); // Alt held: every loot plate on the floor
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (!game.core && !game.ui.options && !game.ui.slots && !game.ui.create)) return;
    if (e.code === "Tab" && (game.menu() !== null || game.anyPanel())) return; // Tab is the map key only while playing with no drawer open; elsewhere it moves focus
    if (e.target?.closest?.("textarea,input[type=text]")) return;
    if (e.code === "Escape") e.preventDefault();
    game.key(e.code); // game.key maps the code through the key bindings; unknown keys do nothing
  });

  game.start();
  sync();
  if (testMode) installTestHook(game, { audio, save: saveApi, options: optionsCtl, store, session });
}

boot().catch((err) => {
  console.error(err);
  const o = document.getElementById("overlay");
  if (o) { o.className = ""; o.textContent = `${S.errorTitle} ${err?.message ?? err}`; }
});
