// Boot: build the sprite atlas, create the game shell, wire DOM events, optionally install the test hook.
import { content } from "./core/index.js";
import { createBus } from "./bus.js";
import { getStyle, defaultStyleId } from "./render/style.js";
import { viewScale } from "./ui/layout.js";
import { createGame } from "./game.js";
import { createScreens } from "./ui/screens.js";
import { installTestHook } from "./testhook/index.js";

const S = content.strings;
const params = new URLSearchParams(location.search);
const testMode = params.get("test") === "1";
// `?seed=` is honoured in every mode on purpose: it lets players share a run. Without it the seed comes from the clock.
const seedParam = Number(params.get("seed"));
const seed = Number.isFinite(seedParam) && params.get("seed") !== null && params.get("seed") !== "" ? seedParam : testMode ? 1 : Date.now() % 2147483647;

async function boot() {
  document.title = S.gameTitle;
  const overlay = document.getElementById("overlay");
  overlay.textContent = S.loading;
  overlay.className = "loading";

  const style = getStyle(testMode ? params.get("style") ?? defaultStyleId : defaultStyleId);
  const t0 = performance.now();
  const scale = Math.min(2, Math.max(1, Math.ceil(viewScale(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) - 0.01)));
  const atlas = await style.build((p) => { overlay.dataset.progress = String(Math.round(p * 100)); }, { scale });
  const atlasMs = performance.now() - t0;
  overlay.className = ""; overlay.textContent = "";

  const canvas = document.getElementById("game");
  const bus = createBus();
  const game = createGame({ canvas, atlas, style, bus, testMode, realtime: params.get("realtime") === "1", seed, atlasMs });

  const screens = createScreens(overlay, {
    newGame: () => game.newGame(game.titleSeed),
    resume: () => game.key("Escape"),
    restart: () => game.input({ t: "restart" }),
    quit: () => game.toTitle(),
  });
  const sync = () => screens.show(game.menu(), { seed: game.titleSeed, error: game.error });
  game.onChange(sync);

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture?.(e.pointerId); game.pointer("down", e); });
  canvas.addEventListener("pointermove", (e) => game.pointer("move", e));
  canvas.addEventListener("pointerup", (e) => game.pointer("up", e));
  canvas.addEventListener("pointercancel", (e) => game.pointer("cancel", e));
  window.addEventListener("resize", () => game.resize());
  window.addEventListener("keydown", (e) => {
    // Skill selector keys arrive in S2. Tab is only captured while playing, so menu buttons stay reachable.
    if (/^F[1-4]$/.test(e.code) || (e.code === "Tab" && game.menu() === null)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Escape") { e.preventDefault(); game.key("Escape"); }
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
