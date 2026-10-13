// window.__app (ADR-0003, S1 subset). Installed only with ?test=1. A thin adapter: no game logic here.

const isObj = (v) => v !== null && typeof v === "object";
const fail = (error) => ({ ok: false, error });

export function installTestHook(game, win = window) {
  const tileArg = (t) => (isObj(t) && Number.isInteger(t.x) && Number.isInteger(t.y) ? { x: t.x, y: t.y } : null);

  /** Resolve {tile} or {screen} to a tile the way a real mouse event would. */
  const target = (spec) => {
    if (!game.core) return { error: "no game running" };
    if (spec?.tile !== undefined) { const t = tileArg(spec.tile); return t ? { tile: t } : { error: "invalid tile" }; }
    if (isObj(spec?.screen) && Number.isFinite(spec.screen.x) && Number.isFinite(spec.screen.y)) {
      return { tile: game.pickAt(spec.screen.x, spec.screen.y).tile };
    }
    return { error: "click needs { tile } or { screen }" };
  };
  const click = (spec, opts = {}) => {
    const t = target(spec);
    if (t.error) return fail(t.error);
    return game.input({ t: "click", tile: t.tile, button: opts.button ?? 0, hold: !!opts.hold });
  };

  const api = {
    describe: () => describe(),
    getState: () => game.getState(),
    newGame: (opts = {}) => {
      game.newGame(Number.isFinite(opts?.seed) ? opts.seed : game.titleSeed);
      game.render(performance.now());
      return game.getState();
    },
    setSeed: (n) => api.newGame({ seed: n }),
    step: (n = 1) => {
      const k = Number.isInteger(n) && n >= 0 ? n : 0;
      game.step(k);
      return game.getState();
    },
    click,
    clickTile: (x, y, opts) => click({ tile: { x, y } }, opts),
    clickScreen: (x, y, opts) => click({ screen: { x, y } }, opts),
    mouseMove: (spec) => {
      const t = target(spec);
      return t.error ? fail(t.error) : game.input({ t: "mouse", phase: "move", tile: t.tile });
    },
    mouseUp: () => game.input({ t: "mouse", phase: "up" }),
    key: (code, phase = "press") => {
      if (typeof code !== "string" || !code) return fail("key needs a KeyboardEvent.code string");
      if (phase === "up") return { ok: true };
      return game.key(code);
    },
    pause: () => { game.key("Escape"); return !!game.core?.paused; },
    // Raw input command, exactly what the DOM handlers produce (used by replay checks).
    input: (cmd) => game.input(cmd),
    cmd: {
      moveTo: (tile) => (tileArg(tile) ? game.input({ t: "moveTo", tile: tileArg(tile) }) : fail("invalid tile")),
      attack: (id) => (typeof id === "string" && id ? game.input({ t: "attack", id }) : fail("invalid monster id")),
    },
    cheat: {
      spawnMonster: (type, tile) => (tileArg(tile) ? game.spawnMonster(type, tileArg(tile)) : fail("invalid tile")),
    },
    perf: () => game.perf(),
  };
  const docs = {
    describe: "List every member of this hook.",
    getState: "Snapshot of core state plus ui (menu, hud, camera) and hash.",
    newGame: "Start a run: newGame({seed}). Returns the snapshot.",
    setSeed: "Alias for newGame({seed}).",
    step: "Run exactly n ticks (manual clock in test mode).",
    click: "click({tile}|{screen}, {button, hold}) like a mouse press.",
    clickTile: "click({tile:{x,y}}).",
    clickScreen: "click({screen:{x,y}}) in CSS pixels of the canvas.",
    mouseMove: "Move the held cursor to a tile or screen point.",
    mouseUp: "Release the held button.",
    key: "key(code, phase) with KeyboardEvent.code semantics.",
    pause: "Toggle pause like Escape; returns paused.",
    input: "Apply a raw input command (what DOM handlers emit).",
    cmd: "Agent commands: moveTo(tile), attack(id).",
    cheat: "Debug cheats: spawnMonster(type, tile).",
    perf: "Frame and simulation timing, atlas completeness.",
  };
  function describe() {
    return Object.keys(api).map((name) => ({ name, kind: typeof api[name] === "function" ? "fn" : "obj", doc: docs[name] }));
  }
  win.__app = api;
  return api;
}
