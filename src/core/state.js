// Game state construction. State is one plain JSON-serialisable object (AC-R-121-2).
import { rngOn } from "../rng.js";
import { hash32 } from "./hash.js";
import { config } from "./config.js";
import { generateFloor } from "./gen/floor.js";
import { allMonsters as registry, monsterStats, championMods, championName } from "./content/monsters.js";
import { generateTown } from "./gen/town.js";
import { getCtx } from "./ctx.js";
import { classById, defaultClass } from "./content/classes.js";
import { DEFAULT_NAME, validateName } from "./name.js";
import { newGrid } from "./items/inventory.js";
import { newEquipment } from "./items/equipment.js";
import { newBelt } from "./items/belt.js";
import { deriveStats } from "./items/derive.js";
import { makeItem } from "./items/roll.js";
import { equipItem } from "./items/equipment.js";
import { initFloorMap } from "./systems/explore.js";

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

function newPlayer(entry, cls, name) {
  const p = {
    id: "player", class: cls.id, name, tile: { ...entry }, next: null, moveT: 0, moveTotal: 0,
    level: 1, xp: 0, xpNext: config.player.xpNext, attrs: { ...cls.attrs }, gold: config.startGold, resist: {},
    action: "idle", target: null, pickup: null, path: [], goal: null, repathT: 0, blockedT: 0, attackT: 0, swingTarget: null,
    attrPoints: 0, skillPoints: 0, skills: { [cls.signature]: 1 }, // the signature skill is free at level 1 and never refunded (ADR-0005)
    skillBar: { primary: cls.basic, secondary: cls.signature, hotkeys: [cls.signature, null, null, null], selected: 0 },
    respecsUsed: 0, buffs: [], absorb: null, aura: null, dash: null,
    castT: 0, flashTicks: 0, facing: { x: 0, y: 1 }, stairs: null, interact: null, toPortal: false,
  };
  const s = deriveStats(p, {});
  Object.assign(p, { attrsTotal: s.attrs, hpMax: s.hpMax, mpMax: s.mpMax, hp: s.hpMax, mp: s.mpMax, damage: s.damage, defense: s.defense, attackRating: s.attackRating, resist: s.resist, mods: s.mods, mpReserved: 0 });
  return p;
}

/** The boss's own state: phase 1 until its health falls to config.boss.phase2At, one special attack in progress at a time. */
const newBossState = () => ({ phase: 1, pattern: "p1", engaged: false, cd: config.boss.slam.cd1, windup: null, summonCd: 0, summoned: 0, seq: 0, volleys: 0, slams: 0 });

/** Monster stats at `level` (default: the floor depth), with champion modifiers applied (R-031, R-033). */
function makeMonster(state, type, tile, packId, opts = {}) {
  const def = registry[type], level = opts.level ?? Math.max(1, state.depth), st = monsterStats(type, level);
  const tier = opts.tier ?? "normal", mods = tier === "champion" ? (opts.mods ?? []).filter((k) => championMods[k]) : [];
  let { hp, damage, defense } = st, speed = def.speed;
  let xp = st.xp;
  if (tier === "champion") {
    xp = Math.round(xp * config.tierFactor.champion);
    hp = Math.round(hp * 1.5); // champions are sturdier than their kind, before modifiers
    for (const k of mods) {
      const mod = championMods[k];
      if (mod.hpMult) hp = Math.round(hp * mod.hpMult);
      if (mod.damageMult) damage = Math.round(damage * mod.damageMult);
      if (mod.defenseMult) defense = Math.round(defense * mod.defenseMult);
      if (mod.speedMult) speed = speed * mod.speedMult;
    }
  }
  if (tier === "boss") { // the end boss: sturdier and harder hitting than a normal monster of its level (config.boss)
    hp = Math.round(hp * config.boss.hpMult); damage = Math.round(damage * config.boss.damageMult);
  }
  return {
    id: `m${state.nextId++}`, type, behaviour: def.behaviour, tier, level: st.level,
    ...(tier === "boss" ? { boss: newBossState() } : {}),
    ...(tier === "champion" ? { mods, name: championName(type, mods) } : {}),
    ...(opts.spawn !== undefined ? { spawn: opts.spawn } : {}),
    tile: { ...tile }, next: null, moveT: 0, moveTotal: 0,
    hp, hpMax: hp, damage, defense, attackRating: st.attackRating, xp, speed,
    ai: "idle", aiT: 0, packId,
    path: [], goal: null, repathT: 0, attackT: 0, deathT: 0, flashTicks: 0, staggerT: 0, muteT: 0, fled: false, fleeT: 0,
    burnT: 0, burnDmg: 0, slowT: 0, slowMag: 0, weakenT: 0, weakenMag: 0, statusKind: null, // R4 statuses (not saved: monsters are rebuilt on load)
  };
}

/** Add a monster on a free walkable tile. Returns the monster, or null if the type/tile is invalid. */
export function spawnMonster(state, type, tile, packId = null, opts = {}) {
  if (!registry[type] || !Number.isInteger(tile?.x) || !Number.isInteger(tile?.y)) return null;
  if (state.depth === 0) return null; // no hostile can exist in the Lobby (AC-R-040-5)
  const ctx = getCtx(state);
  if (!ctx.grid.walkable(tile.x, tile.y)) return null;
  if (state.monsters.some((m) => m.ai !== "dead" && m.tile.x === tile.x && m.tile.y === tile.y)) return null;
  if (state.player.tile.x === tile.x && state.player.tile.y === tile.y) return null;
  const m = makeMonster(state, type, tile, packId, opts);
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
  const cls = classById(opts.class ?? defaultClass);
  if (!cls) throw new Error(`unknown class ${opts.class}`);
  const named = opts.name === undefined ? { ok: true, name: DEFAULT_NAME } : validateName(opts.name);
  if (!named.ok) throw new Error(`invalid name ${opts.name}`);
  const town = opts.start === "town"; // the real game starts in the Lobby (R-040); fixtures and the default start on floor 1
  const floor = opts.floor ?? (town ? generateTown(seed) : generateFloor(seed, 1));
  if (opts.floor) floor.custom = true;
  const state = {
    tick: 0, seed, scene: town && !opts.floor ? "town" : "floor", start: town && !opts.floor ? "town" : "floor", paused: false, depth: floor.depth, deepestDepth: Math.max(1, floor.depth), floors: {},
    rng: Object.fromEntries(STREAMS.map((n, i) => [n, { s: hash32(seed, 100 + i) }])),
    nextId: 1, nextItemId: 1, floor, player: newPlayer(floor.entry, cls, named.name), monsters: [], allies: [], zones: [],
    projectiles: [], groundItems: [], floaters: [],
    inventory: newGrid(config.inventory.w, config.inventory.h), equipment: newEquipment(), belt: newBelt(),
    bossUnlocked: false, bossDefeated: false, victory: null,
    stats: { kills: 0, deaths: 0, bossAttempts: 0, playTicks: 0 },
    cursorItem: null, stash: newGrid(config.stash.w, config.stash.h), vendor: null, vendorVisits: {}, uniquesFound: [], vendorStocks: {}, townVisit: 0, portal: null,
    events: [], eventLog: [],
    input: { mouse: { down: false, button: 0, tile: null, mode: null, applied: null } },
    ui: { notice: null, dialog: null }, options: {},
  };
  state.blockedSpawns = [];
  floor.spawns.forEach((s, i) => { if (!spawnMonster(state, s.type, s.tile, s.packId, { ...s, spawn: i })) state.blockedSpawns.push(i); });
  initFloorMap(state);
  giveStartKit(state, cls, !!opts.wearStartKit);
  return state;
}

// Starting kit (QF-06-8, ADR-0005): the class's weapon in the inventory (the unarmed start is the core default: fixtures, golden hash),
// health potions (and mana potions for casters) on the belt. The shell asks for `wearStartKit` so a real first run starts armed.
function giveStartKit(state, cls, wear = false) {
  const kit = cls.startKit ?? config.startKit, mint = () => `i${state.nextItemId++}`;
  if (kit.weapon) {
    const w = { ...makeItem(kit.weapon), id: mint() };
    autoplaceStart(state, w);
    if (wear) equipItem(state, w.id);
  }
  let slot = 0;
  for (let i = 0; i < kit.healthPotions && slot < state.belt.length; i++) state.belt[slot++] = { ...makeItem(config.startKit.healthPotion), id: mint() };
  for (let i = 0; i < (kit.manaPotions ?? 0) && slot < state.belt.length; i++) state.belt[slot++] = { ...makeItem(config.startKit.manaPotion), id: mint() };
}
const autoplaceStart = (state, item) => { item.x = 0; item.y = 0; state.inventory.items.push(item); };

/** Restart after death: a fresh run of the same seed, written into the same state object. */
export function restartInPlace(state) {
  const fresh = newGame(state.seed, { class: state.player.class, name: state.player.name, start: state.start });
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
