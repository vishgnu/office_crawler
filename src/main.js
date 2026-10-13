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

const S = content.strings;
const params = new URLSearchParams(location.search);
const testMode = params.get("test") === "1";
if (testMode) document.documentElement.classList.add("noanim"); // no panel slide in tests: states are asserted at once
// `?seed=` is honoured in every mode on purpose: it lets players share a run. Without it the seed comes from the clock.
// Render options: ?hc=1 high-contrast (solid plates, no light tint, thick rims), ?lowfx=1 flat cheap lighting, ?zoom=N camera zoom.
const hc = params.get("hc") === "1", lowFx = params.get("lowfx") === "1";
const zoomParam = Number(params.get("zoom"));
if (params.get("zoom") && Number.isFinite(zoomParam) && zoomParam >= 0.4 && zoomParam <= 4) viewConfig.zoom = zoomParam;
const seedParam = Number(params.get("seed"));
const seed = Number.isFinite(seedParam) && params.get("seed") !== null && params.get("seed") !== "" ? seedParam : testMode ? 1 : Date.now() % 2147483647;

async function boot() {
  document.title = S.gameTitle;
  const overlay = document.getElementById("overlay");
  overlay.textContent = S.loading;
  overlay.className = "loading";

  const style = getStyle(testMode ? params.get("style") ?? defaultStyleId : defaultStyleId);
  const t0 = performance.now();
  // Atlas sharpness follows the on-screen size of a logical px (zoom x HUD scale x devicePixelRatio); the rim ring is 2 screen px
  // wide (3.5 in high-contrast mode). Both are bucketed so a resize does not rebuild the atlas for every pixel.
  const atlasParams = (w, h, dpr) => {
    const z = worldScale(w, h), d = Math.min(dpr || 1, 2);
    return { scale: Math.min(2.5, Math.max(1, Math.ceil(z * d * 2 - 0.01) / 2)), rim: Math.min(3, Math.max(0.5, Math.round(((hc ? 3.5 : 2) / z) * 4) / 4)), hc };
  };
  const keyOf = (a) => `${a.scale}|${a.rim}`;
  let current = atlasParams(innerWidth, innerHeight, devicePixelRatio);
  let atlas = await style.build((p) => { overlay.dataset.progress = String(Math.round(p * 100)); }, current);
  const atlasMs = performance.now() - t0;
  overlay.className = ""; overlay.textContent = "";

  const canvas = document.getElementById("game");
  const bus = createBus();
  const game = createGame({ canvas, atlas, style, bus, testMode, realtime: params.get("realtime") === "1", seed, atlasMs, lowFx, hc });

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

  const screens = createScreens(overlay, {
    newGame: () => game.newGame(game.titleSeed),
    resume: () => game.key("Escape"),
    restart: () => game.input({ t: "restart" }),
    respawn: () => game.input({ t: "respawn" }),
    quit: () => game.toTitle(),
  });
  const sync = () => screens.show(game.menu(), { seed: game.titleSeed, error: game.error, summary: game.menu() === "dead" ? game.summary() : null });
  game.onChange(sync);
  createPanels(document.getElementById("ui"), game);

  // Right mouse is a game button (the selected skill): the browser menu never opens in the page (R-005, AC-R-015-2).
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture?.(e.pointerId); document.activeElement?.blur?.(); game.pointer("down", e); });
  canvas.addEventListener("pointermove", (e) => game.pointer("move", e));
  canvas.addEventListener("pointerup", (e) => game.pointer("up", e));
  canvas.addEventListener("pointercancel", (e) => game.pointer("cancel", e));
  window.addEventListener("resize", () => game.resize());
  window.addEventListener("keydown", (e) => {
    // F1-F4 select the right-mouse skill (the browser's own function keys must not fire). Tab stays free: panels and buttons are keyboard-reachable.
    if (preventsDefault(e.code) || (e.code === "Tab" && game.menu() === null && !game.anyPanel())) e.preventDefault(); // Tab is reserved for the map while no panel is open
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !game.core) return;
    if (/^(F[1-4]|Digit[1-4]|Numpad[1-4]|Key[ICSK]|Escape)$/.test(e.code)) {
      // a focused button keeps Enter/Space; letters and digits still reach the game
      if (e.code === "Escape") e.preventDefault();
      game.key(e.code);
    }
  });

  game.start();
  sync();
  if (testMode) installTestHook(game);
}

boot().catch((err) => {
  console.error(err);
  const o = document.getElementById("overlay");
  if (o) { o.className = ""; o.textContent = `${S.errorTitle} ${err?.message ?? err}`; }
});
