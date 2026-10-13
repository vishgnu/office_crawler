// Game state construction. State is one plain JSON-serialisable object (AC-R-121-2).
import { rngOn } from "../rng.js";
import { hash32 } from "./hash.js";
import { config } from "./config.js";
import { generateFloor } from "./gen/floor.js";
import { monsters as registry } from "./content/monsters.js";
import { getCtx } from "./ctx.js";

const STREAMS = ["world", "combat", "ai", "loot"];

/** A named random stream that lives inside the state (so saves and clones keep it). */
export const stream = (state, name) => rngOn(state.rng[name]);

export const moveTicksFor = (speed) => Math.max(1, Math.round(config.moveTicksPerTile / speed));

function newPlayer(entry) {
  const c = config.player;
  return {
    id: "player", class: "clerk", tile: { ...entry }, next: null, moveT: 0, moveTotal: 0,
    hp: c.hpMax, hpMax: c.hpMax, mp: c.mpMax, mpMax: c.mpMax, level: 1, xp: 0, xpNext: c.xpNext,
    attrs: { ...c.attrs }, gold: 0, damage: { ...c.damage }, defense: c.defense,
    attackRating: c.baseAttackRating + c.attrs.agility * config.ar.perAgility, resist: {},
    action: "idle", target: null, path: [], goal: null, repathT: 0, blockedT: 0, attackT: 0, swingTarget: null,
  };
}

function makeMonster(state, type, tile, packId) {
  const def = registry[type];
  return {
    id: `m${state.nextId++}`, type, behaviour: def.behaviour, tier: "normal", level: state.depth,
    tile: { ...tile }, next: null, moveT: 0, moveTotal: 0,
    hp: def.hpBase, hpMax: def.hpBase, ai: "idle", aiT: 0, packId,
    path: [], goal: null, repathT: 0, attackT: 0, deathT: 0,
  };
}

/** Add a monster on a free walkable tile. Returns the monster, or null if the type/tile is invalid. */
export function spawnMonster(state, type, tile, packId = null) {
  if (!registry[type] || !Number.isInteger(tile?.x) || !Number.isInteger(tile?.y)) return null;
  const ctx = getCtx(state);
  if (!ctx.grid.walkable(tile.x, tile.y)) return null;
  if (state.monsters.some((m) => m.ai !== "dead" && m.tile.x === tile.x && m.tile.y === tile.y)) return null;
  if (state.player.tile.x === tile.x && state.player.tile.y === tile.y) return null;
  const m = makeMonster(state, type, tile, packId);
  state.monsters.push(m);
  return m;
}

/**
 * newGame(seed, opts) or newGame({ seed, ...opts }).
 * opts.floor: use a prepared floor instead of generating one (fixtures); its spawns are used as given.
 */
export function newGame(seedOrOpts = 1, opts = {}) {
  if (typeof seedOrOpts === "object" && seedOrOpts !== null) { opts = seedOrOpts; seedOrOpts = opts.seed ?? 1; }
  const seed = Number(seedOrOpts) >>> 0;
  const floor = opts.floor ?? generateFloor(seed, 1);
  const state = {
    tick: 0, seed, scene: "floor", paused: false, depth: floor.depth, deepestDepth: floor.depth,
    rng: Object.fromEntries(STREAMS.map((n, i) => [n, { s: hash32(seed, 100 + i) }])),
    nextId: 1, floor, player: newPlayer(floor.entry), monsters: [],
    projectiles: [], groundItems: [], floaters: [],
    events: [], eventLog: [],
    input: { mouse: { down: false, button: 0, tile: null, mode: null, applied: null } },
    ui: { notice: null }, options: {},
  };
  for (const s of floor.spawns) spawnMonster(state, s.type, s.tile, s.packId);
  return state;
}

/** Restart after death: a fresh run of the same seed, written into the same state object. */
export function restartInPlace(state) {
  const fresh = newGame(state.seed);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
