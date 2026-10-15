// Draws the floor, props, walls and actors in painter's order (depth = tx + ty), with interpolated actor
// positions, contact shadows, actors lit from the same light model as the darkness mask, and the
// hero-behind-wall ghost. The per-frame path allocates nothing: scratch objects and arrays are pooled.
import { config, content } from "../core/index.js";
import { statusFlags, drawStatus, SF } from "./draw/effects.js";
import { keys, FLOOR_WEIGHTS, dirIndex, DIR_VEC, PLAYER_CLASS, heroType, ALLY_ANIMS, FLOOR_VARIANTS, WALL_VARIANTS, ANIMS, PLAYER_ANIMS, DIRS, NPC_FRAMES, bossType } from "./keys.js";
import { project } from "../ui/camera.js";
import { WALL, FLOOR, STAIRS_UP, STAIRS_DOWN, DOOR } from "../core/tiles.js";

/** Float tile position of an actor (tile + progress towards `next`). Pass `out` to avoid an allocation. */
export function actorPos(a, out = { x: 0, y: 0 }) {
  const f = a.next && a.moveTotal ? a.moveT / a.moveTotal : 0;
  out.x = a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f;
  out.y = a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f;
  return out;
}

const vhash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
// floor variant weights (keys.js FLOOR_WEIGHTS: 0 plain, 1 inset, 2 seam, 3 scuffs, 4 coffee, 5 blood, 6-11 tone-drifted clean copies), as cumulative percent
const FLOOR_CUM = FLOOR_WEIGHTS.map((_, i) => FLOOR_WEIGHTS.slice(0, i + 1).reduce((a, b) => a + b, 0));
const floorVariant = (h) => { const r = (h >>> 3) % 100; for (let i = 0; i < FLOOR_VARIANTS; i++) if (r < FLOOR_CUM[i]) return i; return 0; };
const execWallVariant = (h) => { const r = (h >>> 5) % 100; return r < 40 ? 0 : r < 82 ? 1 : 2; }; // glass walls dominate the Executive Suite
const wallVariant = (h) => { const r = (h >>> 5) % 100; return r < 64 ? 0 : r < 90 ? 1 % WALL_VARIANTS : 2 % WALL_VARIANTS; };
const WINDOW_THEMES = new Set(["open-plan", "executive"]); // wall variant 1 is a window here (tiles.js)
const caches = new WeakMap(), figTables = new WeakMap();
const GHOST_DELTAS = [1, 0, 0, 1, 1, 1];

function figureTable(atlas) {
  let t = figTables.get(atlas);
  if (t) return t;
  const build = (anims = ANIMS) => { // rows are filled frame by frame the first time a sprite is shown (the atlas draws monster and S1 hero frames lazily)
    const o = {};
    for (const [anim, n] of Object.entries(anims)) o[anim] = Array.from({ length: DIRS }, () => new Array(n));
    return o;
  };
  t = { plr: build(PLAYER_ANIMS), plrBy: {}, ally: {}, mon: {}, npc: {} };
  t.plrBy[PLAYER_CLASS] = t.plr;
  for (const id of Object.keys(content.npcs)) t.npc[id] = Array.from({ length: NPC_FRAMES }, (_, f) => atlas.get(keys.npc(id, f)));
  for (const type of Object.keys(content.monsters)) t.mon[type] = build();
  figTables.set(atlas, t);
  return t;
}

/** Hero sprite table of a class (R5): built on first use because the atlas draws class sprites lazily. An unknown class id uses the old hero. */
export function heroFigs(atlas, cls) {
  const t = figureTable(atlas), type = heroType(cls);
  if (t.plrBy[type]) return t.plrBy[type];
  const o = {};
  for (const [anim, n] of Object.entries(PLAYER_ANIMS)) o[anim] = Array.from({ length: DIRS }, () => new Array(n)); // filled frame by frame (each sprite is drawn the first time it is shown, no hitch)
  return (t.plrBy[type] = o);
}
/** Draw the frames of a class hero ahead of use (the lazy atlas otherwise pays ~0.4 s on the first frame in play). With a budget it returns false until all are drawn, so the shell can spread it over frames on class selection / continue. */
export function warmHero(atlas, cls, budgetMs = Infinity) {
  const t0 = performance.now(), type = heroType(cls);
  for (const [anim, n] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) {
    const k = keys.plr(type, anim, d, f);
    if (atlas.isDrawn?.(k) === false) { atlas.get(k); if (performance.now() - t0 > budgetMs) return false; }
  }
  heroFigs(atlas, cls);
  return true;
}

/**
 * Budgeted warm-up of the lazy monster and hero frames (PERF-R6, CR6-04). Each frame the world pass draws a few more sprites of the monster types on the
 * floor (idle and walk first, every direction, then attack) and of the hero, so the first sight of a new type, facing or frame does not pay
 * its rim bake (about 4 ms a sprite) inside a frame. Drawing a sprite earlier changes nothing on screen. `budgetMs` bounds the work of one call.
 */
const warmState = new WeakMap();
const WARM_ORDER = ["idle", "walk", "attack"]; // death is one sprite per kill, a single 4 ms draw: not worth 32 sprites a type
export function warmFrames(atlas, core, budgetMs = 1.5) {
  let w = warmState.get(atlas);
  if (!w) warmState.set(atlas, (w = { types: new Set(), queue: [], i: 0, hero: "" }));
  const mons = core.monsters;
  for (let i = 0; i < mons.length; i++) {
    const t = mons[i].type;
    if (w.types.has(t) || !content.monsters[t]) continue;
    w.types.add(t);
    for (const anim of WARM_ORDER) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[anim]; f++) w.queue.push(keys.mon(t, anim, d, f));
  }
  // the quest elite's type (sq3) and the sq5 kill type may not be in the floor's spawn set (R7-0.7, R7-4): warm them while their quest is active so the first sight is not a cold draw
  for (const [qid, t] of [["sq3", config.quests?.elite?.type], ["sq5", config.quests?.sq5?.kill?.monster]]) {
    if (t && core.quests?.[qid]?.s === "active" && !w.types.has(t) && content.monsters[t]) {
      w.types.add(t);
      for (const anim of WARM_ORDER) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[anim]; f++) w.queue.push(keys.mon(t, anim, d, f));
    }
  }
  const cls = heroType(core.player.class);
  if (w.hero !== cls) { // the hero's frames go to the front of what is left
    w.hero = cls;
    const hk = [];
    for (const anim of WARM_ORDER) for (let d = 0; d < DIRS; d++) for (let f = 0; f < PLAYER_ANIMS[anim]; f++) hk.push(keys.plr(cls, anim, d, f));
    w.queue.splice(w.i, 0, ...hk);
  }
  if (w.i >= w.queue.length) { if (w.i) { w.queue.length = 0; w.i = 0; } return warmAhead(atlas, core, w); }
  const t0 = performance.now();
  while (w.i < w.queue.length) {
    const k = w.queue[w.i++];
    if (atlas.isDrawn?.(k) === false) { atlas.get(k); if (performance.now() - t0 >= budgetMs) break; }
  }
  if (globalThis.__atlasStats) globalThis.__atlasStats.warmLeft = w.queue.length - w.i + 1;
  return false;
}

/**
 * Warm the next floor ahead (STUTTER-R7). The monster types of a floor are every type whose minDepth is at most the depth (gen/population.js), so the
 * set of floor depth+1 is known while the hero is still on floor depth. Once the current floor's frames are drawn, idle and walk frames of those types
 * (attack after) are drawn at AHEAD_BUDGET_MS a frame, so most first-use draws are done long before the stairs are taken and the new floor opens with a
 * warm atlas. Drawing a sprite earlier changes nothing on screen. Returns true when nothing is left to warm.
 */
const AHEAD_BUDGET_MS = 0.7, AHEAD_DELAY_FRAMES = 240; // 4 s at 60 fps
function warmAhead(atlas, core, w) {
  const depth = core.depth | 0;
  if (depth < 1 || globalThis.__noAhead) return true;
  if (w.aheadDepth !== depth) {
    w.aheadDepth = depth; w.ahead = []; w.ai = 0; w.wait = AHEAD_DELAY_FRAMES;
    for (const anim of WARM_ORDER) for (const t of Object.keys(content.monsters)) {
      if (!(content.monsters[t].minDepth <= depth + 1)) continue;
      for (let dir = 0; dir < DIRS; dir++) for (let f = 0; f < ANIMS[anim]; f++) w.ahead.push(keys.mon(t, anim, dir, f));
    }
  }
  if (w.wait > 0) { w.wait--; if (globalThis.__atlasStats) globalThis.__atlasStats.warmLeft = w.ahead.length - w.ai; return false; } // the first seconds on a floor stay free of warm-up work
  const q = w.ahead, t0 = performance.now();
  while (w.ai < q.length) {
    const k = q[w.ai++];
    if (atlas.isDrawn?.(k) === false) { atlas.get(k); if (performance.now() - t0 >= AHEAD_BUDGET_MS) break; }
  }
  if (globalThis.__atlasStats) globalThis.__atlasStats.warmLeft = q.length - w.ai;
  return w.ai >= q.length;
}

function allyFigs(atlas, id) {
  const t = figureTable(atlas);
  if (t.ally[id]) return t.ally[id];
  const o = {};
  for (const [anim, n] of Object.entries(ALLY_ANIMS[id] ?? {})) o[anim] = Array.from({ length: id === "cone" ? 1 : DIRS }, (_, d) => Array.from({ length: n }, (_, f) => atlas.get(keys.ally(id, anim, d, f))));
  return (t.ally[id] = o);
}

/**
 * The Executive Suite's dressing (render-only, none of it blocks): a long boardroom table in two wings against the north wall either side of
 * the dais, leather chairs, trophies and the big results screen behind the desks. Positions follow gen/arena.js (room x 4..29, y 4..21; desks x 15..19, y 5).
 */
function addBoardroomDecor(props, atlas) {
  const table = atlas.get(keys.fx("table")), chair = atlas.get(keys.fx("chair")), trophy = atlas.get(keys.fx("trophy")), screen = atlas.get(keys.fx("screen"));
  const add = (x, y, e, o = {}) => props.push({ x, y, blocks: false, e, dy: 0, dd: 0, ...o });
  add(17, 4, screen, { dd: -1.6 });
  for (const wing of [[7, 13], [21, 27]]) {
    for (let x = wing[0]; x <= wing[1]; x++) add(x, 5, table, { dd: -0.2, lamp: x === wing[0] || x === wing[1] });
    for (let x = wing[0] + 1; x <= wing[1]; x += 2) add(x, 6, chair);
  }
  for (const x of [9, 12, 23, 26]) add(x, 5, trophy, { dy: 13, dd: 0.12 });
}

/**
 * Wall dressing (G round, item 11): a few large render-only silhouettes per room (coffee machine, water cooler / barrel, valve wheel, pallet / trophy case, podium),
 * standing against a wall on a free floor tile of a room (never a corridor, a door, stairs or a tile with a prop). They never block. Chosen by tile hash, so a floor always looks the same.
 */
const DECOR = { "open-plan": ["coffee-machine", "water-cooler"], lobby: ["water-cooler", "coffee-machine"], basement: ["barrel", "valve-wheel", "pallet"], executive: ["trophy-case", "podium"] };
function addWallDecor(floor, props, atlas, isWall, blocked, kindAt) {
  const list = DECOR[floor.theme];
  if (!list) return;
  const { w, h, tiles } = floor, placed = props.map((p) => [p.x, p.y]);
  for (const r of floor.rooms) {
    if (r.kind === "corridor" || r.w < 4 || r.h < 4) continue;
    const want = floor.theme === "executive" ? (r.kind === "boardroom" ? 3 : 0) : r.w * r.h >= 48 ? 2 : 1, cands = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * w + x;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || tiles[i] !== FLOOR || blocked[i] || kindAt[i] !== r.kind) continue;
      const side = isWall(x, y - 1) ? "N" : isWall(x - 1, y) ? "W" : "";
      if (!side || (floor.theme === "executive" && floor.arena && y <= 6)) continue;
      if (isWall(x, y - 1) && isWall(x - 1, y)) continue; // not in a corner
      if (isWall(x + 1, y) || isWall(x, y + 1)) continue; // nothing in front of it that would hide it
      cands.push({ x, y, side, k: vhash(x * 7 + 3, y * 13 + 5) });
    }
    cands.sort((a, b) => a.k - b.k);
    let n = 0;
    for (const c of cands) {
      if (n >= want) break;
      if (placed.some(([px, py]) => Math.abs(px - c.x) + Math.abs(py - c.y) < 4)) continue; // spaced out, and clear of other props
      if (floor.entry && Math.abs(floor.entry.x - c.x) + Math.abs(floor.entry.y - c.y) < 4) continue;
      if (floor.exit && Math.abs(floor.exit.x - c.x) + Math.abs(floor.exit.y - c.y) < 4) continue;
      const id = list[(c.k >>> 4) % list.length];
      props.push({ x: c.x, y: c.y, blocks: false, e: atlas.get(keys.fx("decor-" + id)), dy: 0, dd: -0.15, dxs: c.side === "N" ? 14 : -14, dys: -7 }); // shifted onto the wall side of its tile
      placed.push([c.x, c.y]); n++;
    }
  }
}

/** Per-floor lookup tables of atlas entries (built once per floor object and atlas). */
function prepare(floor, atlas) {
  let c = caches.get(floor);
  if (c && c.atlas === atlas) return c;
  const { w, h, tiles } = floor, theme = floor.theme;
  const kindAt = new Array(w * h).fill("corridor");
  for (const r of floor.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) kindAt[y * w + x] = r.kind;
  const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y * w + x] === WALL;
  const ground = new Array(w * h).fill(null), wall = new Array(w * h).fill(null), blocked = new Uint8Array(w * h), windowAt = new Array(w * h).fill("");
  let bossStairs = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, code = tiles[i];
    if (code === WALL) {
      let open = false;
      for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWall(x + dx, y + dy)) { open = true; break; }
      if (!open) continue;
      const mask = (isWall(x, y - 1) ? 1 : 0) | (isWall(x + 1, y) ? 2 : 0) | (isWall(x, y + 1) ? 4 : 0) | (isWall(x - 1, y) ? 8 : 0);
      const wvar = theme === "executive" ? execWallVariant(vhash(x, y)) : wallVariant(vhash(x, y));
      wall[i] = atlas.get(keys.wall(theme, mask, wvar));
      if (wvar === 1 && WINDOW_THEMES.has(theme)) windowAt[i] = !(mask & 4) ? "L" : !(mask & 2) ? "R" : ""; // a window faces the room it looks onto: its light shaft falls there
      blocked[i] = 1;
    } else if (code === DOOR) ground[i] = atlas.get(keys.marker(theme, "door"));
    else if (code === STAIRS_UP) ground[i] = atlas.get(keys.marker(theme, "stairs-up"));
    else if (code === STAIRS_DOWN && floor.bossStairs) { ground[i] = atlas.get(keys.marker(theme, "stairs-locked")); bossStairs = { i, x, y, locked: ground[i], open: atlas.get(keys.marker(theme, "stairs-open")) }; }
    else if (code === STAIRS_DOWN) ground[i] = atlas.get(keys.marker(theme, "stairs-down"));
    else ground[i] = atlas.get(keys.floor(theme, kindAt[i], floorVariant(vhash(x, y))));
  }
  const props = floor.props.map((p) => { if (p.blocks) blocked[p.y * w + p.x] = 1; return { x: p.x, y: p.y, blocks: p.blocks, e: atlas.get(keys.prop(p.type)), dy: 0, dd: 0, led: p.type === "server-rack" }; });
  if (theme === "executive" && floor.arena) addBoardroomDecor(props, atlas);
  addWallDecor(floor, props, atlas, isWall, blocked, kindAt);
  // The Lobby elevator is a tall doorframe standing on the exit tile (no tile can show it alone)
  if (theme === "lobby" && floor.exit) props.push({ x: floor.exit.x, y: floor.exit.y, blocks: false, e: atlas.get(keys.fx("elevator")), tall: true, dy: 0, dd: 0 });
  // light sources: a cyan pool on every monitor, rack LEDs and generator lamps in the basement, and a ceiling light over the middle of each room (warm in the Lobby, cold in the basement)
  const lights = [];
  const propLight = { desk: "monitor", "server-rack": "rack", generator: "gen" };
  for (const p of floor.props) if (propLight[p.type]) lights.push({ kind: propLight[p.type], x: p.x + 0.5, y: p.y + 0.5 });
  const roomLight = theme === "lobby" ? "warm" : theme === "basement" ? "cold" : theme === "executive" ? "chandelier" : "fluor";
  if (theme === "executive") for (const p of props) { // the brass desk lamps on the dais and the table ends, and the big screen
    if (p.e === atlas.get(keys.fx("screen"))) lights.push({ kind: "screen", x: p.x + 0.5, y: p.y + 1.4 });
    else if (p.lamp) lights.push({ kind: "desklamp", x: p.x + 0.5, y: p.y + 0.5 });
  }
  for (const r of floor.rooms) if (r.kind !== "corridor") lights.push({ kind: r.kind === "breakroom" ? "fluor" : roomLight, x: r.x + r.w / 2, y: r.y + r.h / 2 });
  // static pools (G round, item 5): a second ceiling fixture in every big room, a green exit-sign pool over the stairs and a window light shaft under every window; constant, never flicker, at most MAX_STATIC of them are drawn
  const statics = [];
  for (const r of floor.rooms) if (r.kind !== "corridor" && r.w >= 5 && r.h >= 5) {
    const k = r.kind === "breakroom" ? "fluor" : roomLight;
    statics.push({ kind: k, x: r.x + r.w * 0.27, y: r.y + r.h * 0.72 });
    if (r.w >= 12) statics.push({ kind: k, x: r.x + r.w * 0.76, y: r.y + r.h * 0.3 });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const code = tiles[y * w + x];
    if (code === STAIRS_UP || code === STAIRS_DOWN) statics.push({ kind: "exit", x: x + 0.5, y: y + 0.5, dim: 1, rs: 1 });
  }
  if (WINDOW_THEMES.has(theme)) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = wall[y * w + x], wv = windowAt[y * w + x];
    if (e && wv) statics.push({ kind: "shaft", x, y, o: wv });
  }
  // the floor-8 lift lights its surroundings once it is unlocked: a second candidate list with that light in it (picked per frame, no allocation)
  const lightsOpen = bossStairs ? lights.concat([{ kind: "warm", x: bossStairs.x + 0.5, y: bossStairs.y + 0.5 }]) : lights;
  c = { atlas, ground, wall, props, blocked, lights, lightsOpen, bossStairs, statics };
  caches.set(floor, c);
  return c;
}

/** Blinking drive-bay LEDs on a server rack (round G fix, secondary motion): 4 rows x 3 lights painted over the baked ones (props.js: front face u -0.18..0.02, v 0.28, z 9 + 8.5 i + 3.2). */
function rackLeds(g, sx, sy, z, now, it) {
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
    const n = i * 3 + k, per = 380 + n * 97, on = ((Math.floor(now / per) + n * 5) % 3) !== 1;
    const u = -0.18 + k * 0.1, x = sx + (u - 0.28) * 32 * z, y = sy + (u + 0.28) * 16 * z - (9 + i * 8.5 + 3.2) * z;
    g.fillStyle = on ? (k === 2 ? "#ffd08a" : "#7dfff0") : "#262e44";
    g.beginPath(); g.arc(x, y, 1.45 * z, 0, 6.2832); g.fill();
    if (on) { g.globalAlpha = 0.28; g.beginPath(); g.arc(x, y, 3 * z, 0, 6.2832); g.fill(); g.globalAlpha = 1; }
  }
}

function blit(g, e, sx, sy, z) {
  g.drawImage(e.img, Math.round(sx - e.ox * z), Math.round(sy - e.oy * z), Math.round(e.w * z), Math.round(e.h * z));
}

// ---- pooled scratch ----
const pt = { x: 0, y: 0 }, AF = { anim: "idle", frame: 0 }, LS = { shade: 0, tint: "", tintA: 0 };
const GOLD_SIZES = ["gold-s", "gold-m", "gold-l"];
const pool = [], items = [], actorOut = [], posA = { x: 0, y: 0 }, posB = { x: 0, y: 0 };
const out = { heroScreen: { x: 0, y: 0 }, heroDir: 0, actors: actorOut, heroItem: null };
let nPool = 0;
const grab = (d, e, x, y) => {
  const it = pool[nPool++] ?? (pool[nPool - 1] = { d: 0, e: null, x: 0, y: 0, a: 1, actor: false, isPlayer: false, alert: false, shade: 0, tint: "", tintA: 0, flash: false, head: 0, hurt: false, dx: 0, dy: 0, icon: 0, champ: false, mute: false, npc: false, boss: false, summoned: false, ghost: false, led: false });
  it.d = d; it.e = e; it.x = x; it.y = y; it.a = 1; it.actor = false; it.isPlayer = false; it.alert = false; it.shade = 0; it.tint = ""; it.tintA = 0; it.flash = false; it.dx = 0; it.dy = 0; it.icon = 0; it.champ = false; it.mute = false; it.npc = false; it.hurt = false; it.boss = false; it.summoned = false; it.sf = 0; it.ghost = false; it.led = false;
  return it;
};
const byDepth = (a, b) => a.d - b.d;
const hp = { x: 0, y: 0 }, F = { blocked: null, fw: 0, fh: 0, g: null, cam: null, atlas: null, prev: null, alpha: 1, fx: null, now: 0, env: null, figs: null, hfigs: null, hero: null, htype: PLAYER_CLASS, shadowE: null, light: null, items };

function lerpPos(a, o) {
  actorPos(a, posA);
  const pv = F.prev.get(a.id);
  o.x = pv ? pv.x + (posA.x - pv.x) * F.alpha : posA.x; o.y = pv ? pv.y + (posA.y - pv.y) * F.alpha : posA.y;
}


const S = content.strings;
const modLines = new Map();
/** "Burly . Vicious" style readout of a champion's modifiers (cached per modifier set). */
function modLine(m) {
  if (!m.mods?.length) return ""; // a named quest elite has no modifiers: an empty line, so its plate is just the name
  const key = m.mods.join(",");
  let t = modLines.get(key);
  if (t === undefined) { t = m.mods.map((k) => content.championMods[k]?.name ?? k).join(" \u00b7 "); modLines.set(key, t); }
  return t;
}

/** Status icon above a monster's head: ! (noticed), speaker slash (muted), sweat (fleeing), orbiting sparks (staggered). */
function drawIcon(g, atlas, it, x, y, z, now) {
  const top = y - (it.head + 2) * z;
  if (it.icon === ICON_ALERT) blit(g, atlas.get("fx:alert"), x, top, z);
  else if (it.icon === ICON_MUTED) blit(g, atlas.get("fx:muted"), x, top - Math.sin(now / 300) * z, z);
  else if (it.icon === ICON_FLEE) blit(g, atlas.get("fx:flee"), x + 8 * z, top + 4 * z + Math.sin(now / 90) * z, z);
  else if (it.icon === ICON_STAGGER) {
    const sp = atlas.get("fx:spark");
    for (let k = 0; k < 3; k++) { const an = now / 140 + k * 2.09; blit(g, sp, x + Math.cos(an) * 9 * z, top + 8 * z + Math.sin(an) * 3 * z, z * 0.9); }
  }
}

/** A Lobby NPC: idle loop facing the viewer, a faint "talk to me" ring, always visible (the Lobby is a safe, lit place). */
function addNpc(n, o, margin, yMax) {
  const { g, cam, atlas, now, env, light } = F, z = cam.z;
  if (o.sx < -margin || o.sx > cam.w + margin || o.sy < -margin || o.sy > yMax) return;
  const e = F.figs.npc[n.id][Math.floor(now / 260 + n.tile.x) % NPC_FRAMES], dm = env.style.dims[o.type];
  const rx = dm.shadowR * 1.5 * z, ry = rx * 0.5;
  g.beginPath(); g.ellipse(o.sx, o.sy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.07)"; g.fill(); g.lineWidth = Math.max(1.2, 1.2 * z); g.strokeStyle = `rgba(143,243,255,${0.4 + 0.1 * Math.sin(now / 500 + n.tile.x)})`; g.stroke();
  const k = (dm.shadowR * 2.25) / 62, sh = F.shadowE;
  g.globalAlpha = 0.85;
  g.drawImage(sh.img, Math.round(o.sx - sh.ox * k * z), Math.round(o.sy - sh.oy * k * z), Math.round(sh.w * k * z), Math.round(sh.h * k * z));
  g.globalAlpha = 1;
  const it = grab(n.tile.x + n.tile.y + 1.02, e, o.sx, o.sy);
  it.actor = true; it.head = dm.head; it.npc = true;
  light.sample(n.tile.x + 0.5, n.tile.y + 0.5, LS);
  it.shade = Math.min(LS.shade, 0.3); if (!env.lowFx) { it.tint = LS.mul; it.tintA = Math.min(LS.tintA, 0.2); }
  items.push(it);
}

/** A summoned ally (R5): a small actor with the hero's shadow treatment and a green friend ring (shape, not only colour: dashed). A decoy cone shows a taunt ring. */
function addAlly(al, core, rs, margin, yMax) {
  const { g, cam, atlas, now, env, light } = F, z = cam.z, id = (al.unit ?? al.id ?? "intern").replace(/^ally\./, "");
  const dm = env.style.dims["ally." + id];
  if (!dm || !ALLY_ANIMS[id]) return;
  actorPos(al, posA); project(cam, posA.x + 0.5, posA.y + 0.5, pt);
  if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) return;
  const figs = allyFigs(atlas, id), cone = id === "cone", key = "ally:" + al.id;
  let dir = rs.facing.get(key) ?? 0;
  if (!cone) {
    if (al.next) dir = dirIndex(al.next.x - al.tile.x, al.next.y - al.tile.y, dir);
    else { let best = null, bd = 64; for (const m of core.monsters) { if (m.ai === "dead") continue; const d = (m.tile.x - al.tile.x) ** 2 + (m.tile.y - al.tile.y) ** 2; if (d < bd) { bd = d; best = m; } } if (best) dir = dirIndex(best.tile.x - al.tile.x, best.tile.y - al.tile.y, dir); }
    rs.facing.set(key, dir);
  }
  const anim = cone ? "idle" : al.hp <= 0 ? "death" : (al.attackT ?? 0) > 0 ? "attack" : al.next ? "walk" : "idle", frames = figs[anim];
  const nF = frames[0].length, fr = anim === "attack" ? Math.min(nF - 1, Math.floor((1 - al.attackT / Math.max(1, al.attackTicks ?? 40)) * nF)) : anim === "death" ? nF - 1 : cone ? 0 : Math.floor(now / (anim === "walk" ? 110 : 220)) % nF;
  const e = frames[cone ? 0 : dir][fr];
  const rx = dm.shadowR * 1.5 * z, ry = rx * 0.5, pulse = 0.5 + 0.1 * Math.sin(now / 400);
  g.beginPath(); g.ellipse(pt.x, pt.y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = cone && al.taunt ? "rgba(255,150,60,0.14)" : "rgba(120,230,150,0.12)"; g.fill();
  g.setLineDash([4 * z, 3 * z]); g.lineWidth = Math.max(1.4, 1.5 * z); g.strokeStyle = cone ? `rgba(255,170,90,${0.6 + pulse * 0.3})` : `rgba(130,240,160,${0.6 + pulse * 0.3})`; g.stroke(); g.setLineDash([]);
  const k = (dm.shadowR * 2.25) / 62, sh = F.shadowE;
  g.globalAlpha = 0.8; g.drawImage(sh.img, Math.round(pt.x - sh.ox * k * z), Math.round(pt.y - sh.oy * k * z), Math.round(sh.w * k * z), Math.round(sh.h * k * z)); g.globalAlpha = 1;
  const it = grab(posA.x + posA.y + 1.02, e, pt.x, pt.y);
  it.actor = true; it.head = dm.head; it.npc = true;
  light.sample(posA.x + 0.5, posA.y + 0.5, LS);
  it.shade = Math.min(LS.shade, 0.3); if (!env.lowFx) { it.tint = LS.mul; it.tintA = Math.min(LS.tintA, 0.2); }
  if (anim === "death") it.a = 0.6;
  items.push(it);
}

/** A subtle ground ring (and faint pool) under the hero so he is findable in a pile. */
function heroRing(g, sx, sy, r, z, now) {
  const rx = r * 1.0 * z, ry = rx * 0.5, pulse = 0.5 + 0.08 * Math.sin(now / 420);
  g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.10)"; g.fill();
  g.lineWidth = Math.max(1.5, 1.6 * z); g.strokeStyle = `rgba(255,255,255,${pulse})`; g.stroke();
  g.beginPath(); g.ellipse(sx, sy, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
  g.lineWidth = Math.max(1, 0.9 * z); g.strokeStyle = "rgba(13,10,28,0.55)"; g.stroke();
}

const ICON_ALERT = 1, ICON_MUTED = 2, ICON_FLEE = 3, ICON_STAGGER = 4;

/** Distinct ground ring for champions: double ring in the champion colour (the hero's ring is white, loot rings are rarity colours). */
function champRing(g, sx, sy, r, z, now, colour) {
  const rx = r * z, ry = rx * 0.5, pulse = 0.55 + 0.15 * Math.sin(now / 260);
  g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = "rgba(204,121,167,0.14)"; g.fill();
  g.lineWidth = Math.max(2, 2 * z); g.strokeStyle = colour; g.globalAlpha = pulse + 0.3; g.stroke();
  g.beginPath(); g.ellipse(sx, sy, rx * 1.2, ry * 1.2, 0, 0, Math.PI * 2);
  g.lineWidth = Math.max(1, 0.9 * z); g.setLineDash([5 * z, 4 * z]); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 1;
}

/** The Regional Director's aura: a pulsing ground glow, two counter-rotating dashed rings and eight rays. Gold in phase 1, red and faster in phase 2. */
function bossAura(g, sx, sy, r, z, now, rage) {
  const col = rage ? "255,74,58" : "255,210,74", rx = r * z, ry = rx * 0.5, sp = rage ? 1.7 : 1, pulse = 0.5 + 0.5 * Math.sin(now / (rage ? 170 : 340));
  g.save(); g.lineCap = "round";
  g.beginPath(); g.ellipse(sx, sy, rx * (1.15 + 0.08 * pulse), ry * (1.15 + 0.08 * pulse), 0, 0, Math.PI * 2);
  g.fillStyle = `rgba(${col},${0.12 + 0.07 * pulse})`; g.fill();
  g.lineWidth = Math.max(3, 3.2 * z); g.strokeStyle = "rgba(13,10,28,0.7)"; g.stroke();
  g.lineWidth = Math.max(1.6, 1.8 * z); g.strokeStyle = `rgba(${col},${0.7 + 0.25 * pulse})`; g.stroke();
  g.setLineDash([7 * z, 5 * z]); g.lineDashOffset = -now * 0.012 * sp * z;
  g.beginPath(); g.ellipse(sx, sy, rx * 1.38, ry * 1.38, 0, 0, Math.PI * 2); g.lineWidth = Math.max(1.2, 1.3 * z); g.strokeStyle = `rgba(${col},0.55)`; g.stroke();
  g.lineDashOffset = now * 0.016 * sp * z; g.beginPath(); g.ellipse(sx, sy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.lineWidth = Math.max(1.6, 1.8 * z); g.strokeStyle = `rgba(${col},0.75)`;
  for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + now / 2400 * sp, c = Math.cos(an), n = Math.sin(an); g.beginPath(); g.moveTo(sx + c * rx * 1.5, sy + n * ry * 1.5); g.lineTo(sx + c * rx * (1.72 + 0.12 * pulse), sy + n * ry * (1.72 + 0.12 * pulse)); g.stroke(); }
  g.restore();
}

/** Staff the boss called: a thin dashed grey-white ring (the "temp badge" itself is drawn on the body). */
function tempRing(g, sx, sy, r, z) {
  g.save(); g.beginPath(); g.ellipse(sx, sy, r * z, r * z * 0.5, 0, 0, Math.PI * 2);
  g.setLineDash([3 * z, 3 * z]); g.lineWidth = Math.max(1, 1.1 * z); g.strokeStyle = "rgba(235,232,220,0.6)"; g.stroke(); g.restore();
}

const monFrame = (atlas, type, anim, dir, f) => { const row = F.figs.mon[type][anim][dir]; return row[f] ?? (row[f] = atlas.get(keys.mon(type, anim, dir, f))); };
const heroFrame = (atlas, anim, dir, f) => { const row = F.hfigs[anim][dir]; return row[f] ?? (row[f] = atlas.get(keys.plr(F.htype, anim, dir, f))); };

/**
 * The hero's body drawn again over the screen-space loot beams (WORLD-R6, N3): beams belong to the ground, so they pass behind the hero, never through him.
 * Called by fx.drawLoot right after the beam pass, only when a beam overlaps the hero's rectangle. Same layers as the world pass: sprite, hurt wash, pool tint.
 */
function redrawHero(g) {
  const hi = F.hero, atlas = F.atlas, z = F.cam.z;
  if (!hi || !hi.e || hi.a <= 0.02) return;
  const x = hi.x + hi.dx, y = hi.y + hi.dy;
  g.globalAlpha = hi.a;
  blit(g, hi.flash ? atlas.flash(hi.e) : hi.e, x, y, z);
  if (hi.tintA > 0) { g.globalCompositeOperation = "multiply"; g.globalAlpha = hi.tintA * hi.a; blit(g, atlas.tint(hi.e, hi.tint), x, y, z); g.globalCompositeOperation = "source-over"; }
  if (hi.hurt) { g.globalAlpha = 0.14; blit(g, atlas.tint(hi.e, "#ff1f2e"), x, y, z); }
  g.globalAlpha = 1;
}

/** Share of an actor's own (shaded, tinted) body that is drawn back over the additive pool light: the wash on actors is clamped to the remaining 1 - this (round G3, F2). */
const RESTORE_A = 0.72;
const restore = [];
/**
 * Called by the lighting pass right after the additive pools: every actor standing in a pool gets its own sprite drawn again over the wash, so pale
 * actors stop washing out and dark suits stay darker than the floor around them. The multiply tint (pool colour) is part of the redraw, so the cast stays.
 */
function restoreActors(g) {
  const { cam, atlas } = F, z = cam.z;
  for (let i = 0; i < restore.length; i++) {
    const it = restore[i], x = it.x + it.dx, y = it.y + it.dy;
    const ra = it.ghost ? RESTORE_A * 0.85 : RESTORE_A; // an actor beside a wall or prop is restored a little less: it is already shown through the wall (ghost copy)
    g.globalAlpha = ra * it.a;
    blit(g, it.flash ? atlas.flash(it.e) : it.e, x, y, z);
    if (it.shade > 0) { g.globalAlpha = it.shade * it.a * ra; blit(g, atlas.shade(it.e, "#070518"), x, y, z); }
    g.globalCompositeOperation = "multiply"; g.globalAlpha = it.tintA * it.a; blit(g, atlas.tint(it.e, it.tint), x, y, z); g.globalCompositeOperation = "source-over";
  }
  g.globalAlpha = 1;
}

function addActor(a, isPlayer, pos, dir, sx, sy) {
  const { g, cam, atlas, fx, now, env, light } = F, z = cam.z;
  const af = animFor(a, isPlayer, now), boss = !isPlayer && a.tier === "boss";
  const e = boss ? atlas.get(keys.mon(bossType(a.type, a.boss?.phase ?? 1), af.anim, dir, af.frame)) : (isPlayer ? heroFrame(atlas, af.anim, dir, af.frame) : monFrame(atlas, a.type, af.anim, dir, af.frame));
  let alphaV = 1, flash = false;
  const dying = af.anim === "death";
  if (dying) {
    const t = isPlayer ? Math.min(1, (now - (fx.deathAt ?? now)) / 900) : a.deathT / config.deathTicks;
    alphaV = isPlayer ? 1 : Math.max(0, Math.min(1, (1 - t) * 3));
  } else if (a.flashTicks > 0) flash = true; // hit flash is state-backed (flashTicks), not an event timer
  const dm = env.style.dims[isPlayer ? F.htype : a.type];
  // lit state first: an actor deep in the dark (outside every light) is not drawn at all, so no ghost silhouettes at the screen edge
  let shade = 0, tint = "", tintA = 0, shTint = "", sdx = 0, sdy = 0;
  const champ = !isPlayer && a.tier === "champion" && !dying;
  light.sample(pos.x + 0.5, pos.y + 0.5, LS);
  if (!env.lowFx && LS.tint) { tint = LS.mul; tintA = LS.tintA; shTint = LS.sh; sdx = LS.dx; sdy = LS.dy; } // G round, item 9: every actor takes the colour of the pool it stands in (15-25 % multiply) and casts a coloured shadow
  if (!isPlayer) {
    shade = LS.shade;
    // Final polish: a monster inside a reasonable radius of the hero, or one that is awake and hunting, is never dimmed or hidden by the dark.
    const hd = Math.hypot(pos.x - light.hero.x, pos.y - light.hero.y), hr = light.radius(), hunting = a.ai === "chase" || a.ai === "attack" || a.ai === "notice" || a.ai === "stagger" || a.ai === "flee" || a.ai === "windup";
    const near = hd <= hr * 0.85 || (hunting && hd <= hr * 1.1); // inside the lit disc (the mask itself fades beyond it, so no black blobs at the edge)
    if (near) shade = Math.min(shade, 0.12);
    else if (shade >= 0.6 && !tint && !dying && !champ && !boss) return null;
    if (boss) { shade = Math.min(shade, 0.12); tint = ""; tintA = 0; shTint = ""; } // the boss is never lost in the dark and keeps its own colours (its aura is the light)
  }
  // contact shadow on the ground, under everything that stands there
  const k = (dm.shadowR * 2.25) / 62, sh = F.shadowE;
  if (isPlayer && !dying) heroRing(g, sx, sy, dm.shadowR * 1.7, z, now);
  if (champ) champRing(g, sx, sy, dm.shadowR * 1.6, z, now, env.style.palette.champion);
  if (boss && !dying) bossAura(g, sx, sy, dm.shadowR * 1.7, z, now, a.boss?.phase >= 2);
  if (!isPlayer && a.summoned && !dying) tempRing(g, sx, sy, dm.shadowR * 1.5, z);
  g.globalAlpha = 0.85 * alphaV;
  let sox = 0, soy = 0;
  if (shTint) { // soft coloured ground shadow, cast a little away from the pool's light
    const ax = sdx - sdy, ay = (sdx + sdy) * 0.5, nn = Math.hypot(ax, ay) || 1, off = 3.4 * z * Math.min(1, tintA / 0.15);
    sox = (ax / nn) * off; soy = (ay / nn) * off * 0.7;
  }
  const she = shTint ? atlas.shade(sh, shTint) : sh;
  g.drawImage(she.img, Math.round(sx + sox - sh.ox * k * z), Math.round(sy + soy - sh.oy * k * z), Math.round(sh.w * k * z), Math.round(sh.h * k * z));
  g.globalAlpha = 1;
  const it = grab(pos.x + pos.y + 1.02, e, sx, sy);
  it.actor = true; it.isPlayer = isPlayer; it.a = alphaV; it.flash = flash; it.head = dm.head;
  it.shade = shade; it.tint = tint; it.tintA = tintA; it.champ = champ; it.boss = boss; it.summoned = !isPlayer && !!a.summoned && !dying;
  if (!isPlayer && !dying) {
    const sf = statusFlags(a); it.sf = sf; // R5 statuses: stun / mute / freeze share muteT and differ by statusKind
    it.icon = sf & SF.mute ? ICON_MUTED : a.ai === "stagger" ? ICON_STAGGER : a.ai === "flee" ? ICON_FLEE : a.ai === "notice" ? ICON_ALERT : 0;
    it.mute = !!(sf & SF.mute);
    if (a.ai === "stagger") { // recoil away from the facing direction and shiver, easing out over the recovery
      const kk = Math.min(1, a.staggerT / config.hitRecoveryTicks), v = DIR_VEC[dir];
      it.dx = (-v[0] * 4 * kk + Math.sin(now * 0.075) * 1.8 * kk) * z; it.dy = -v[1] * 2 * kk * z;
    }
  }
  if (!isPlayer && !dying && a.tile && F.blocked) { // beside a wall or a tall prop that is drawn in front of it: the actor is shown through it, like the hero (round G fix)
    for (let k = 0; k < GHOST_DELTAS.length && !it.ghost; k += 2) {
      const x = a.tile.x + GHOST_DELTAS[k], y = a.tile.y + GHOST_DELTAS[k + 1];
      if (x < F.fw && y < F.fh && F.blocked[y * F.fw + x]) it.ghost = true;
    }
  }
  it.hurt = isPlayer && !dying && flash; // hero hurt flash: red wash over the sprite
  if (it.hurt) it.flash = false;
  items.push(it);
  return it;
}

/**
 * Attack frame (0 wind-up, 1 raise, 2 strike, 3 recover) for tick t of a swing of `total` ticks whose damage lands on
 * tick `hit`: the strike frame is on screen when the hit lands (feel pass: the sprite used to strike 2-4 ticks late).
 */
export function attackFrame(t, total, hit) {
  if (t < hit * 0.4) return 0;
  if (t < hit * 0.85) return 1;
  if (t < hit + (total - hit) * 0.35) return 2;
  return 3;
}

/** Choose anim + frame for an actor (writes AF). */
function animFor(a, isPlayer, now) {
  if (isPlayer) {
    if (a.action === "dead") { AF.anim = "death"; AF.frame = 3; }
    else if (a.action === "attack") { AF.anim = "attack"; AF.frame = attackFrame(a.attackT, config.attackTicks, config.attackHitTick); }
    else if (a.action === "cast" || a.castT > 0) { AF.anim = "cast"; AF.frame = Math.max(0, Math.min(3, Math.floor((1 - a.castT / config.castTicks) * 4))); }
    else if (a.next) { AF.anim = "walk"; AF.frame = Math.floor(now / 90) % 6; }
    else { AF.anim = "idle"; AF.frame = Math.floor(now / 200) % 4; }
  } else if (a.ai === "dead") { AF.anim = "death"; AF.frame = Math.min(3, Math.floor((a.deathT / config.deathTicks) * 4)); }
  else if (a.boss?.windup) { // the gavel goes up over the wind-up, a slam strikes on the tick it lands, then the arm stays up (volley, summon) or recovers
    const w = a.boss.windup;
    if (w.t < w.total) { AF.anim = "windup"; AF.frame = Math.min(3, Math.floor((w.t / w.total) * 4)); }
    else if (w.kind === "slam") { AF.anim = "attack"; AF.frame = w.t - w.total < 8 ? 2 : 3; }
    else { AF.anim = "windup"; AF.frame = 3; }
  }
  else if (a.ai === "attack" && a.attackT > 0) { AF.anim = "attack"; AF.frame = attackFrame(a.attackT, config.monsterAttackTicks, config.monsterAttackHitTick); }
  else if (a.next) { AF.anim = "walk"; AF.frame = Math.floor(now / (a.ai === "flee" ? 70 : 110)) % 6; }
  else { AF.anim = "idle"; AF.frame = Math.floor(now / 220) % 4; }
  return AF;
}

function faceFor(a, isPlayer, core, rs) {
  const prev = rs.facing.get(a.id) ?? 0;
  let d = prev;
  if (a.next) d = dirIndex(a.next.x - a.tile.x, a.next.y - a.tile.y, prev);
  else if (isPlayer) {
    const t = a.target && core.monsters.find((m) => m.id === a.target);
    if (t) d = dirIndex(t.tile.x - a.tile.x, t.tile.y - a.tile.y, prev);
  } else if (a.ai !== "idle" && a.ai !== "dead") d = dirIndex(core.player.tile.x - a.tile.x, core.player.tile.y - a.tile.y, prev);
  if (d !== prev || !rs.facing.has(a.id)) rs.facing.set(a.id, d);
  return d;
}

/** N3: drop facing memory of monsters that no longer exist (it would grow for the whole run). */
export function pruneFacing(core, rs) {
  if (rs.facing.size <= core.monsters.length + 16) return;
  const live = new Set(["player"]);
  for (const m of core.monsters) live.add(m.id);
  for (const id of rs.facing.keys()) if (!live.has(id)) rs.facing.delete(id);
}

/**
 * Draw one frame of the world. prev: Map id -> previous-tick float pos; alpha in [0,1].
 * rs: { facing: Map } render-side memory. env: { lighting, style, lowFx, hc }.
 * Returns the shared `out`: { heroScreen, heroDir, actors } (valid until the next call).
 */
export function drawWorld(g, cam, atlas, core, prev, alpha, fx, now, rs, env) {
  const floor = core.floor, c = prepare(floor, atlas), fw = floor.w, fh = floor.h, z = cam.z;
  // visible tile range from the four canvas corners (inverse projection, inlined to avoid allocations)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < 4; k++) {
    const a = ((k & 1 ? cam.w : 0) - cam.ox) / z / 32, b = ((k & 2 ? cam.h : 0) - cam.oy) / z / 16, tx = (a + b) / 2, ty = (b - a) / 2;
    if (tx < minX) minX = tx; if (tx > maxX) maxX = tx; if (ty < minY) minY = ty; if (ty > maxY) maxY = ty;
  }
  minX = Math.max(0, Math.floor(minX) - 3); maxX = Math.min(fw - 1, Math.ceil(maxX) + 3);
  minY = Math.max(0, Math.floor(minY) - 3); maxY = Math.min(fh - 1, Math.ceil(maxY) + 3);

  nPool = 0; items.length = 0;
  const margin = 70 * z, yMax = cam.h + margin * 1.4;
  for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
    const i = ty * fw + tx, wE = c.wall[i];
    let gE = c.ground[i];
    if (c.bossStairs && i === c.bossStairs.i && core.bossUnlocked) gE = c.bossStairs.open; // the lift: barrier tape until floor 8 is cleared, then lit
    if (!gE && !wE) continue;
    project(cam, tx + 0.5, ty + 0.5, pt);
    if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) continue;
    if (gE) blit(g, gE, pt.x, pt.y, z);
    else items.push(grab(tx + ty + 1, wE, pt.x, pt.y));
  }
  const bs = c.bossStairs;
  if (bs && core.bossUnlocked && bs.x >= minX && bs.x <= maxX && bs.y >= minY && bs.y <= maxY) { // pulsing gold rings rising off the unlocked lift
    project(cam, bs.x + 0.5, bs.y + 0.5, pt);
    g.save(); g.globalCompositeOperation = "lighter"; g.lineWidth = Math.max(1.5, 2 * z);
    for (let k = 0; k < 3; k++) {
      const ph = ((now / 1400) + k / 3) % 1, rx = (14 + ph * 16) * z;
      g.globalAlpha = (1 - ph) * 0.7; g.strokeStyle = "#ffd36a";
      g.beginPath(); g.ellipse(pt.x, pt.y - ph * 22 * z, rx, rx * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
  const props = c.props;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    project(cam, p.x + 0.5, p.y + 0.5, pt);
    if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) continue;
    const pit = grab(p.x + p.y + 1 - (p.blocks ? 0 : 0.3) + p.dd, p.e, pt.x + (p.dxs ?? 0) * z, pt.y - p.dy * z + (p.dys ?? 0) * z);
    pit.led = p.led === true && !env.lowFx && !fx.reducedMotion;
    items.push(pit);
  }

  // the Emergency Exit door: a lit prop standing on its tile (the floor it was opened on, and the Lobby spot)
  const door = core.portal ? (core.depth === 0 ? core.portal.lobbyTile : core.depth === core.portal.depth ? core.portal.tile : null) : null;
  if (door && door.x >= minX && door.x <= maxX && door.y >= minY && door.y <= maxY) {
    project(cam, door.x + 0.5, door.y + 0.5, pt);
    if (pt.x > -margin && pt.x < cam.w + margin && pt.y > -margin && pt.y < yMax) {
      const it = grab(door.x + door.y + 1.04, atlas.get(keys.fx("portal")), pt.x, pt.y);
      items.push(it);
    }
  }
  const hero = core.player, light = env.lighting;
  fx.core = core; fx.alpha = alpha; fx.bodies = actorOut; // the screen-space pass (floaters, projectiles, loot plates) reads the state through these
  // ---- ground loot: rarity ring underneath, a small box or a gold pile on top (the marker, beam and plate come in fx.draw) ----
  const ground = core.groundItems;
  if (ground) for (let i = 0; i < ground.length; i++) {
    const gi = ground[i];
    if (gi.tile.x < minX || gi.tile.x > maxX || gi.tile.y < minY || gi.tile.y > maxY) continue;
    project(cam, gi.tile.x + 0.5, gi.tile.y + 0.5, pt);
    if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) continue;
    fx.lootRing(g, gi, pt.x, pt.y, z, now);
    const e = gi.gold ? atlas.get(keys.loot(GOLD_SIZES[gi.gold < 25 ? 0 : gi.gold < 80 ? 1 : 2])) : atlas.get(keys.loot("item"));
    items.push(grab(gi.tile.x + gi.tile.y + 1 - 0.25, e, pt.x, pt.y));
  }
  warmFrames(atlas, core);
  F.prev = prev; F.alpha = alpha; fx.heroType = heroType(core.player.class);
  fx.drawGround(g, cam, atlas, now); out.lights = fx.lights; // light hook: [{x, y, r, colour, intensity}] for the lighting rounds
  // cast runes, burst and heal rings: flat on the floor, under every actor

  // ---- actors: positions first (lights need them), then lit sprites ----
  F.g = g; F.cam = cam; F.atlas = atlas; F.prev = prev; F.alpha = alpha; F.fx = fx; F.now = now; F.env = env; F.light = light;
  F.blocked = c.blocked; F.fw = fw; F.fh = fh;
  F.figs = figureTable(atlas); F.htype = heroType(core.player.class); F.hfigs = heroFigs(atlas, core.player.class); F.shadowE = atlas.get(keys.fx("shadow"));
  lerpPos(hero, hp);
  const mons = core.monsters, nm = mons.length, npcs = core.floor.npcs ?? [], na = nm + npcs.length;
  const slot = (i) => actorOut[i] ?? (actorOut[i] = { id: "", type: "", name: "", sub: "", ai: "", hp: 0, hpMax: 0, dead: false, champ: false, npc: false, boss: false, hid: false, lit: "", x: 0, y: 0, sx: 0, sy: 0, d: 0, pr: 0 });
  for (let i = 0; i < nm; i++) {
    const m = mons[i], o = slot(i);
    lerpPos(m, posB);
    o.id = m.id; o.type = m.type; o.name = m.name ?? (content.monsters[m.type] ?? content.bosses?.[m.type])?.name ?? m.type; o.ai = m.ai; o.hp = m.hp; o.hpMax = m.hpMax; o.dead = m.ai === "dead";
    o.champ = m.tier === "champion"; o.sub = o.champ ? modLine(m) : ""; o.npc = false;
    o.boss = m.tier === "boss"; o.lit = o.boss ? (m.boss?.phase >= 2 ? "rage" : "boss") : "";
    o.x = posB.x; o.y = posB.y; o.d = Math.hypot(posB.x - hp.x, posB.y - hp.y);
    project(cam, o.x + 0.5, o.y + 0.5, pt); o.sx = pt.x; o.sy = pt.y;
  }
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i], o = slot(nm + i);
    o.id = `npc:${n.id}`; o.type = `npc-${n.id}`; o.name = S[content.npcs[n.id]?.nameKey] ?? n.id; o.sub = ""; o.ai = "idle"; o.hp = 0; o.hpMax = 0; o.dead = false; o.champ = false; o.npc = true; o.boss = false; o.lit = "";
    o.x = n.tile.x; o.y = n.tile.y; o.d = Math.hypot(o.x - hp.x, o.y - hp.y);
    project(cam, o.x + 0.5, o.y + 0.5, pt); o.sx = pt.x; o.sy = pt.y;
  }
  actorOut.length = na;
  light.select(cam, hp, core.bossUnlocked ? c.lightsOpen : c.lights, actorOut, env.lowFx, env.hc, floor.theme, c.statics);

  const heroDir = faceFor(hero, true, core, rs);
  project(cam, hp.x + 0.5, hp.y + 0.5, pt);
  out.heroScreen.x = pt.x; out.heroScreen.y = pt.y; out.heroDir = heroDir; fx.heroS = out.heroScreen; // the drawn hero position: the loot-plate keep-out follows the sprite, not the logical tile
  out.heroItem = F.hero = addActor(hero, true, hp, heroDir, pt.x, pt.y); fx.heroRedraw = redrawHero;
  for (let i = 0; i < nm; i++) {
    const m = mons[i], o = actorOut[i];
    o.hid = false;
    if (o.sx < -margin || o.sx > cam.w + margin || o.sy < -margin || o.sy > yMax) continue;
    if (!addActor(m, false, o, faceFor(m, false, core, rs), o.sx, o.sy)) o.hid = true; // lost in the dark: no sprite, so no plate or pip floating alone
  }
  for (let i = 0; i < npcs.length; i++) addNpc(npcs[i], actorOut[nm + i], margin, yMax);
  if (core.allies) for (let i = 0; i < core.allies.length; i++) addAlly(core.allies[i], core, rs, margin, yMax);

  // enemies standing in front of the hero (and overlapping his sprite) fade, so he never disappears behind a pile
  const hi = out.heroItem;
  let buried = false;
  if (hi) for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.actor || it.isPlayer || it.d <= hi.d) continue;
    const dx = Math.abs(it.x - hi.x), dy = it.y - hi.y;
    if (dx < 30 * z && dy > -8 * z && dy < 60 * z) { if (it.a > 0.7) it.a = 0.7; buried = true; } // VFIX-R7 N10: 0.7 (was 0.5), restored over the pool light (a > 0.6): a readable body, not a pale ghost
  }
  items.sort(byDepth);
  restore.length = 0;
  light.after = restoreActors;
  const champColour = env.style.palette.champion;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.actor) { blit(g, it.e, it.x, it.y, z); if (it.led) rackLeds(g, it.x, it.y, z, now, it); continue; }
    const x = it.x + it.dx, y = it.y + it.dy;
    if (it.a < 1) g.globalAlpha = it.a;
    if (it.champ) { // outline: a baked ring of the sprite's silhouette in the champion colour, under the sprite
      g.globalAlpha = 0.95 * it.a;
      blit(g, atlas.outline(it.e, champColour, 1.6), x, y, z);
      g.globalAlpha = it.a;
    }
    if (it.hurt) { g.globalAlpha = 0.9 * it.a; blit(g, atlas.outline(it.e, "#ff2b3a", 2.2), x, y, z); g.globalAlpha = it.a; } // hurt: a red rim, the body stays readable
    blit(g, it.flash ? atlas.flash(it.e) : it.e, x, y, z);
    if (it.mute) { g.globalAlpha = 0.34 * it.a; blit(g, atlas.tint(it.e, "#7c88b8"), x, y, z); }
    if (it.sf & SF.freeze) { g.globalAlpha = 0.5 * it.a; blit(g, atlas.tint(it.e, "#9fe4ff"), x, y, z); }
    if (it.sf & SF.burn) { g.globalAlpha = (fx.reducedMotion ? 0.2 : 0.14 + 0.1 * Math.sin(now / 90 + x)) * it.a; blit(g, atlas.tint(it.e, "#ff7a1f"), x, y, z); }
    if (it.shade > 0) { g.globalAlpha = it.shade * it.a; blit(g, atlas.shade(it.e, "#070518"), x, y, z); }
    if (it.tintA > 0) { // pool colour on the actor (round G fix): multiply at 15-25 % plus a half-strength colour wash, so the cast survives the additive pool on top of it
      g.globalCompositeOperation = "multiply"; g.globalAlpha = it.tintA * it.a; blit(g, atlas.tint(it.e, it.tint), x, y, z); g.globalCompositeOperation = "source-over";
      g.globalAlpha = it.tintA * 0.8 * it.a; blit(g, atlas.tint(it.e, it.tint), x, y, z);
    }
    if (it.hurt) { g.globalAlpha = 0.14; blit(g, atlas.tint(it.e, "#ff1f2e"), x, y, z); }
    g.globalAlpha = 1;
    if (it.tintA > 0 && !it.hurt && it.a > 0.6) restore.push(it); // (an actor faded because it stands in front of the hero is not restored: the hero must stay readable) // lit by a pool: its body is drawn again over the additive pass (restoreActors)
    if (it.summoned) blit(g, atlas.get(keys.fx("badge")), x + 5 * z, y - 30 * z, z * 0.9); // temp badge pinned to the chest
    if (it.sf) drawStatus(g, it.sf, x, y, it.head, z, now, fx.reducedMotion);
    if (it.icon) drawIcon(g, atlas, it, x, y, z, now);
  }

  for (let i = 0; i < items.length; i++) { // actors beside a wall top: a see-through copy drawn only where a wall or prop in front covers the sprite (nothing is clipped away)
    const it = items[i];
    if (!it.ghost || it.shade >= 0.6) continue;
    const ax = it.x + it.dx, ay = it.y + it.dy, ex = it.e;
    for (let j = i + 1; j < items.length; j++) {
      const w = items[j];
      if (w.actor || w.e.h < 36) continue; // walls and tall props only
      const wx = w.x - w.e.ox * z, wy = w.y - w.e.oy * z, ww = w.e.w * z, wh = w.e.h * z;
      const x0 = Math.max(wx, ax - ex.ox * z), y0 = Math.max(wy, ay - ex.oy * z), x1 = Math.min(wx + ww, ax - ex.ox * z + ex.w * z), y1 = Math.min(wy + wh, ay - ex.oy * z + ex.h * z);
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;
      g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
      g.globalAlpha = 0.6 * it.a; blit(g, it.e, ax, ay, z);
      if (it.shade > 0) { g.globalAlpha = it.shade * it.a * 0.6; blit(g, atlas.shade(it.e, "#070518"), ax, ay, z); }
      if (it.tintA > 0) { g.globalCompositeOperation = "multiply"; g.globalAlpha = it.tintA * it.a; blit(g, atlas.tint(it.e, it.tint), ax, ay, z); }
      g.restore();
    }
    g.globalAlpha = 1;
  }
  // pack readability: when enemies stand in front of the hero he is drawn again above them, half transparent, with his ring's front arc
  if (buried && hi && hero.action !== "dead") {
    const rx = env.style.dims[F.htype].shadowR * 1.7 * z, ry = rx * 0.5;
    g.beginPath(); g.ellipse(hi.x, hi.y, rx, ry, 0, 0.15, Math.PI - 0.15);
    g.lineWidth = Math.max(2, 2 * z); g.strokeStyle = "rgba(255,255,255,0.8)"; g.stroke();
    g.globalAlpha = 0.5; blit(g, hi.e, hi.x, hi.y, z); g.globalAlpha = 1;
  }
  // hero ghost when a wall or tall prop in front may hide the hero
  if (hero.action !== "dead") {
    let hidden = false;
    for (let k = 0; k < GHOST_DELTAS.length && !hidden; k += 2) {
      const x = hero.tile.x + GHOST_DELTAS[k], y = hero.tile.y + GHOST_DELTAS[k + 1];
      if (x < fw && y < fh && c.blocked[y * fw + x]) hidden = true;
    }
    if (hidden) { const hi = out.heroItem; g.globalAlpha = 0.55; blit(g, hi.e, hi.x, hi.y, z); g.globalAlpha = 1; }
  }
  pruneFacing(core, rs);
  return out;
}

