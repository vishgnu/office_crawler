// window.__app (ADR-0003, S1 subset). Installed only with ?test=1. A thin adapter: no game logic here.
import { slotsHook, characterHook, treeHook } from "../save/hook.js";
import { setQuestStep, completeQuest } from "../core/cheats.js";

const isObj = (v) => v !== null && typeof v === "object";
const fail = (error) => ({ ok: false, error });

export function installTestHook(game, extras = {}, win = window) {
  const { audio = null, save = null, options = null, store = null, session = null } = extras;
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

  const tree = treeHook(() => game.core);
  // Quest cheats run on the core state. With game.cheat.setQuestStep / completeQuest present (the shell's wrapper dispatches the new events to audio and UI) they are used;
  // otherwise the core function runs directly and the state is right but the cue events are not dispatched.
  const questCheat = (name, ...args) => {
    if (!game.core) return fail("no game running");
    if (typeof game.cheat?.[name] === "function") return game.cheat[name](...args);
    const r = (name === "setQuestStep" ? setQuestStep : completeQuest)(game.core, ...args);
    game.render(performance.now());
    return r;
  };
  const questId = (id) => typeof id === "string" && id.length > 0;
  const questInput = (t, id) => (!game.core ? fail("no game running") : !questId(id) ? fail("bad id") : game.input({ t, id }));
  const quests = {
    state: () => (game.core ? game.getState().quests ?? null : null),
    talk: (npcId) => (!game.core ? fail("no game running") : questId(npcId) ? game.input({ t: "interact", id: npcId }) : fail("bad id")),
    accept: (id) => questInput("questAccept", id),
    // the hand-in input arrives with the core's R7-0.2; until then the core answers "unknown input"
    handIn: (id) => questInput("questHandIn", id),
    pin: (id) => questInput("questPin", id),
    setStep: (id, n) => (questId(id) ? questCheat("setQuestStep", id, n) : fail("bad id")),
    readVerdict: () => (game.core ? game.input({ t: "storyRead", id: "victory" }) : fail("no game running")),
  };
  const api = {
    describe: () => describe(),
    getState: () => game.getState(),
    newGame: (opts = {}) => {
      // start: "town" (default, the Lobby; `?start=floor` changes the default) or "floor" (floor 1, for tests that want monsters at once)
      game.newGame(Number.isFinite(opts?.seed) ? opts.seed : game.titleSeed, { start: opts?.start === "floor" || opts?.start === "town" ? opts.start : undefined });
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
      setLevel: (n) => game.cheat.setLevel(n),
      setHp: (n) => game.cheat.setHp(n),
      damageMonster: (id, n) => (typeof id === "string" && Number.isFinite(n) ? game.cheat.damageMonster(id, n) : fail("damageMonster needs a monster id and an amount")),
      teleportFloor: (depth) => game.cheat.teleportFloor(depth),
      giveGold: (n) => game.cheat.giveGold(n),
      spawnItem: (opts, tile) => game.cheat.spawnItem(isObj(opts) ? opts : {}, tileArg(tile) ?? undefined),
      giveItem: (opts) => game.cheat.giveItem(isObj(opts) ? opts : {}),
      completeQuest: (id) => (questId(id) ? questCheat("completeQuest", id) : fail("bad id")),
    },
    quests,
    ui: {
      open: (name) => game.openPanel(name),
      close: (name) => game.closePanel(name),
      toggle: (name) => game.togglePanel(name),
    },
    pick: (x, y) => (game.core && Number.isFinite(x) && Number.isFinite(y) ? game.pickAt(x, y) : fail("pick needs a running game and finite screen coordinates")),
    perf: () => game.perf(),
    // S3: sound, save slot and options (what the Options screen and the title buttons use underneath)
    audio: audio && { getState: () => audio.getState(), clearCueLog: () => audio.clearCueLog(), setVolume: (c, v) => audio.setVolume(c, v), setMuted: (b) => audio.setMuted(b), setKit: (k) => audio.setKit(k) },
    save: save && { ...save },
    // R4/R5: slots, character creation and the skill tree (thin forwards to src/save/hook.js)
    slots: store && { ...slotsHook(store), view: () => game.slots, open: () => game.openSlots(), close: () => game.closeSlots(), run: (cmd) => game.session(cmd) },
    character: session && { ...characterHook({ createCharacter: (a) => game.session({ t: "createCharacter", ...a }) }, { start: () => {} }), openCreate: (o) => game.openCreate(o), closeCreate: () => game.closeCreate() },
    tree: { get: () => (game.core ? tree.get() : fail("no game running")), learn: (id) => { const r = game.input({ t: "learnSkill", id }); return r; }, respec: () => game.input({ t: "respec" }) },
    options: options && {
      get: () => structuredClone(game.options),
      setKey: (action, code) => options.setKey(action, code),
      restoreKeys: () => options.restoreKeys(),
      setFlag: (name, on) => options.setFlag(name, on),
      setTextScale: (n) => options.setTextScale(n),
      open: () => game.openOptions(),
      close: () => game.closeOptions(),
    },
  };
  const docs = {
    describe: "List every member of this hook.",
    getState: "Snapshot of core state plus ui (menu, hud, camera) and hash.",
    newGame: "Start a run: newGame({seed, start}); start is town (default) or floor. Returns the snapshot.",
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
    cheat: "Debug cheats: spawnMonster(type, tile), setLevel(n), setHp(n), damageMonster(id, n) (class-independent true damage), teleportFloor(depth), giveGold(n), spawnItem(opts, tile), giveItem(opts) (spawn + pick up), completeQuest(id).",
    ui: "Panels: open(name), close(name), toggle(name) with name inventory | character | skills (same as the I, C, S keys).",
    pick: "pick(x, y): what a click at this canvas point means ({ tile, monsterId }), through the camera that is on screen.",
    audio: "audio.getState() -> {kit, unlocked, ctxState, master, sfx, ambient, muted, effectiveGain, ambientId, cueLog[]}; clearCueLog(), setVolume(channel, v), setMuted(b), setKit(id).",
    save: "Active slot: has(), write() (forced save into the active slot), read(n?) (parsed save or null), raw(n?), export(n, 'current'|'bad') -> text, import(n, text, confirm) -> {ok}, remove(n).",
    options: "Options: get(), setKey(action, code) -> {ok, reason}, restoreKeys(), setFlag(name, bool), setTextScale(n), open(), close().",
    slots: "Slots: list() index, raw(n), keys(), fail(on), view() = game.slots, open(), close(), run({t:'deleteSlot'|'renameSlot'|'importSlot'|'exportSlot'|'loadSlot'|'continue'|...}).",
    character: "Character: create({slot, class, name}) starts a new character in a slot, cards() class cards, openCreate({slot}), closeCreate().",
    tree: "Skill tree: get() treeView of the running game, learn(id), respec().",
    quests: "Quests: state() = snapshot.quests, talk(npcId) (interact), accept(id), handIn(id), pin(id), setStep(id, n) (main 1..6 forward only; side 0 available, 1 active, 2 ready, 3 completed via hand-in), readVerdict(); cheat.completeQuest(id).",
    perf: "Frame and simulation timing, atlas completeness, fx flags, nameplate rects.",
  };
  function describe() {
    return Object.keys(api).filter((k) => api[k]).map((name) => ({ name, kind: typeof api[name] === "function" ? "fn" : "obj", doc: docs[name] }));
  }
  win.__app = api;
  return api;
}
