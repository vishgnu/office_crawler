// Game state construction. State is one plain JSON-serialisable object (AC-R-121-2).
import { rngOn } from "../rng.js";
import { hash32 } from "./hash.js";
import { config } from "./config.js";
import { generateFloor } from "./gen/floor.js";
import { monsters as registry } from "./content/monsters.js";
import { getCtx } from "./ctx.js";
import { classes, defaultClass } from "./content/classes.js";
import { newGrid } from "./items/inventory.js";
import { newEquipment } from "./items/equipment.js";
import { newBelt } from "./items/belt.js";
import { deriveStats } from "./items/derive.js";
import { makeItem } from "./items/roll.js";

const STREAMS = ["world", "combat", "ai", "loot"];

/** A named random stream that lives inside the state (so saves and clones keep it). */
export const stream = (state, name) => rngOn(state.rng[name]);

export const moveTicksFor = (speed) => Math.max(1, Math.round(config.moveTicksPerTile / speed));

// Unseeded games draw their seed from an injectable source (AC-R-042-5). The default is a counter mixed through
// hash32: different on every call, and reproducible per process. Browser code can inject a clock or crypto based source.
let seedCounter = 0;
const defaultSeedSource = () => hash32(0x5eed, ++seedCounter);
let seedSource = defaultSeedSource;
export function setSeedSource(fn) { seedSource = typeof fn === "function" ? fn : defaultSeedSource; }

function newPlayer(entry, cls) {
  const p = {
    id: "player", class: cls.id, tile: { ...entry }, next: null, moveT: 0, moveTotal: 0,
    level: 1, xp: 0, xpNext: config.player.xpNext, attrs: { ...cls.attrs }, gold: config.startGold, resist: {},
    action: "idle", target: null, pickup: null, path: [], goal: null, repathT: 0, blockedT: 0, attackT: 0, swingTarget: null,
  };
  const s = deriveStats(p, {});
  Object.assign(p, { attrsTotal: s.attrs, hpMax: s.hpMax, mpMax: s.mpMax, hp: s.hpMax, mp: s.mpMax, damage: s.damage, defense: s.defense, attackRating: s.attackRating, resist: s.resist });
  return p;
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
export function newGame(seedOrOpts, opts = {}) {
  if (typeof seedOrOpts === "object" && seedOrOpts !== null) { opts = seedOrOpts; seedOrOpts = opts.seed; }
  const seed = (seedOrOpts === undefined || seedOrOpts === null ? (opts.seedSource ?? seedSource)() : Number(seedOrOpts)) >>> 0;
  const cls = classes.find((c) => c.id === (opts.class ?? defaultClass));
  if (!cls) throw new Error(`unknown class ${opts.class}`);
  const floor = opts.floor ?? generateFloor(seed, 1);
  const state = {
    tick: 0, seed, scene: "floor", paused: false, depth: floor.depth, deepestDepth: floor.depth,
    rng: Object.fromEntries(STREAMS.map((n, i) => [n, { s: hash32(seed, 100 + i) }])),
    nextId: 1, nextItemId: 1, floor, player: newPlayer(floor.entry, cls), monsters: [],
    projectiles: [], groundItems: [], floaters: [],
    inventory: newGrid(config.inventory.w, config.inventory.h), equipment: newEquipment(), belt: newBelt(),
    cursorItem: null, stash: newGrid(config.stash.w, config.stash.h), vendor: null, vendorVisits: {}, uniquesFound: [],
    events: [], eventLog: [],
    input: { mouse: { down: false, button: 0, tile: null, mode: null, applied: null } },
    ui: { notice: null }, options: {},
  };
  for (const s of floor.spawns) spawnMonster(state, s.type, s.tile, s.packId);
  giveStartKit(state);
  return state;
}

// Starting kit (QF-06-8): one weapon in the inventory (not worn: the hero starts unarmed) and health potions on the belt.
function giveStartKit(state) {
  const kit = config.startKit, mint = () => `i${state.nextItemId++}`;
  if (kit.weapon) autoplaceStart(state, { ...makeItem(kit.weapon), id: mint() });
  for (let i = 0; i < kit.healthPotions && i < state.belt.length; i++) state.belt[i] = { ...makeItem(kit.healthPotion), id: mint() };
}
const autoplaceStart = (state, item) => { item.x = 0; item.y = 0; state.inventory.items.push(item); };

/** Restart after death: a fresh run of the same seed, written into the same state object. */
export function restartInPlace(state) {
  const fresh = newGame(state.seed, { class: state.player.class });
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
