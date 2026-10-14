// Draws the floor, props, walls and actors in painter's order (depth = tx + ty), with interpolated actor
// positions, contact shadows, actors lit from the same light model as the darkness mask, and the
// hero-behind-wall ghost. The per-frame path allocates nothing: scratch objects and arrays are pooled.
import { config, content } from "../core/index.js";
import { keys, dirIndex, DIR_VEC, PLAYER_CLASS, FLOOR_VARIANTS, WALL_VARIANTS, ANIMS, PLAYER_ANIMS, DIRS, NPC_FRAMES, bossType } from "./keys.js";
import { project } from "../ui/camera.js";
import { WALL, STAIRS_UP, STAIRS_DOWN, DOOR } from "../core/tiles.js";

/** Float tile position of an actor (tile + progress towards `next`). Pass `out` to avoid an allocation. */
export function actorPos(a, out = { x: 0, y: 0 }) {
  const f = a.next && a.moveTotal ? a.moveT / a.moveTotal : 0;
  out.x = a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f;
  out.y = a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f;
  return out;
}

const vhash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
// floor variant weights (percent, cumulative): 0 plain, 1 inset, 2 seam, 3 scuffs, 4 coffee, 5 blood
const FLOOR_CUM = [26, 46, 66, 80, 90, 100];
const floorVariant = (h) => { const r = (h >>> 3) % 100; for (let i = 0; i < FLOOR_VARIANTS; i++) if (r < FLOOR_CUM[i]) return i; return 0; };
const execWallVariant = (h) => { const r = (h >>> 5) % 100; return r < 40 ? 0 : r < 82 ? 1 : 2; }; // glass walls dominate the Executive Suite
const wallVariant = (h) => { const r = (h >>> 5) % 100; return r < 64 ? 0 : r < 90 ? 1 % WALL_VARIANTS : 2 % WALL_VARIANTS; };
const caches = new WeakMap(), figTables = new WeakMap();
const GHOST_DELTAS = [1, 0, 0, 1, 1, 1];

function figureTable(atlas) {
  let t = figTables.get(atlas);
  if (t) return t;
  const build = (fn, anims = ANIMS) => {
    const o = {};
    for (const [anim, n] of Object.entries(anims)) o[anim] = Array.from({ length: DIRS }, (_, d) => Array.from({ length: n }, (_, f) => atlas.get(fn(anim, d, f))));
    return o;
  };
  t = { plr: build((a, d, f) => keys.plr(PLAYER_CLASS, a, d, f), PLAYER_ANIMS), mon: {}, npc: {} };
  for (const id of Object.keys(content.npcs)) t.npc[id] = Array.from({ length: NPC_FRAMES }, (_, f) => atlas.get(keys.npc(id, f)));
  for (const type of Object.keys(content.monsters)) t.mon[type] = build((a, d, f) => keys.mon(type, a, d, f));
  figTables.set(atlas, t);
  return t;
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

/** Per-floor lookup tables of atlas entries (built once per floor object and atlas). */
function prepare(floor, atlas) {
  let c = caches.get(floor);
  if (c && c.atlas === atlas) return c;
  const { w, h, tiles } = floor, theme = floor.theme;
  const kindAt = new Array(w * h).fill("corridor");
  for (const r of floor.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) kindAt[y * w + x] = r.kind;
  const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y * w + x] === WALL;
  const ground = new Array(w * h).fill(null), wall = new Array(w * h).fill(null), blocked = new Uint8Array(w * h);
  let bossStairs = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, code = tiles[i];
    if (code === WALL) {
      let open = false;
      for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWall(x + dx, y + dy)) { open = true; break; }
      if (!open) continue;
      const mask = (isWall(x, y - 1) ? 1 : 0) | (isWall(x + 1, y) ? 2 : 0) | (isWall(x, y + 1) ? 4 : 0) | (isWall(x - 1, y) ? 8 : 0);
      wall[i] = atlas.get(keys.wall(theme, mask, theme === "executive" ? execWallVariant(vhash(x, y)) : wallVariant(vhash(x, y))));
      blocked[i] = 1;
    } else if (code === DOOR) ground[i] = atlas.get(keys.marker(theme, "door"));
    else if (code === STAIRS_UP) ground[i] = atlas.get(keys.marker(theme, "stairs-up"));
    else if (code === STAIRS_DOWN && floor.bossStairs) { ground[i] = atlas.get(keys.marker(theme, "stairs-locked")); bossStairs = { i, x, y, locked: ground[i], open: atlas.get(keys.marker(theme, "stairs-open")) }; }
    else if (code === STAIRS_DOWN) ground[i] = atlas.get(keys.marker(theme, "stairs-down"));
    else ground[i] = atlas.get(keys.floor(theme, kindAt[i], floorVariant(vhash(x, y))));
  }
  const props = floor.props.map((p) => { if (p.blocks) blocked[p.y * w + p.x] = 1; return { x: p.x, y: p.y, blocks: p.blocks, e: atlas.get(keys.prop(p.type)), dy: 0, dd: 0 }; });
  if (theme === "executive" && floor.arena) addBoardroomDecor(props, atlas);
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
  // the floor-8 lift lights its surroundings once it is unlocked: a second candidate list with that light in it (picked per frame, no allocation)
  const lightsOpen = bossStairs ? lights.concat([{ kind: "warm", x: bossStairs.x + 0.5, y: bossStairs.y + 0.5 }]) : lights;
  c = { atlas, ground, wall, props, blocked, lights, lightsOpen, bossStairs };
  caches.set(floor, c);
  return c;
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
  const it = pool[nPool++] ?? (pool[nPool - 1] = { d: 0, e: null, x: 0, y: 0, a: 1, actor: false, isPlayer: false, alert: false, shade: 0, tint: "", tintA: 0, flash: false, head: 0, hurt: false, dx: 0, dy: 0, icon: 0, champ: false, mute: false, npc: false, boss: false, summoned: false });
  it.d = d; it.e = e; it.x = x; it.y = y; it.a = 1; it.actor = false; it.isPlayer = false; it.alert = false; it.shade = 0; it.tint = ""; it.tintA = 0; it.flash = false; it.dx = 0; it.dy = 0; it.icon = 0; it.champ = false; it.mute = false; it.npc = false; it.hurt = false; it.boss = false; it.summoned = false;
  return it;
};
const byDepth = (a, b) => a.d - b.d;
const hp = { x: 0, y: 0 }, F = { g: null, cam: null, atlas: null, prev: null, alpha: 1, fx: null, now: 0, env: null, figs: null, shadowE: null, light: null, items };

function lerpPos(a, o) {
  actorPos(a, posA);
  const pv = F.prev.get(a.id);
  o.x = pv ? pv.x + (posA.x - pv.x) * F.alpha : posA.x; o.y = pv ? pv.y + (posA.y - pv.y) * F.alpha : posA.y;
}


const S = content.strings;
const modLines = new Map();
/** "Burly . Vicious" style readout of a champion's modifiers (cached per modifier set). */
function modLine(m) {
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
  it.shade = Math.min(LS.shade, 0.3); if (!env.lowFx) { it.tint = LS.tint; it.tintA = Math.min(LS.tintA, 0.1); }
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

function addActor(a, isPlayer, pos, dir, sx, sy) {
  const { g, cam, atlas, fx, now, env, light } = F, z = cam.z;
  const af = animFor(a, isPlayer, now), boss = !isPlayer && a.tier === "boss";
  const e = boss ? atlas.get(keys.mon(bossType(a.type, a.boss?.phase ?? 1), af.anim, dir, af.frame)) : (isPlayer ? F.figs.plr : F.figs.mon[a.type])[af.anim][dir][af.frame];
  let alphaV = 1, flash = false;
  const dying = af.anim === "death";
  if (dying) {
    const t = isPlayer ? Math.min(1, (now - (fx.deathAt ?? now)) / 900) : a.deathT / config.deathTicks;
    alphaV = isPlayer ? 1 : Math.max(0, Math.min(1, (1 - t) * 3));
  } else if (a.flashTicks > 0) flash = true; // hit flash is state-backed (flashTicks), not an event timer
  const dm = env.style.dims[isPlayer ? PLAYER_CLASS : a.type];
  // lit state first: an actor deep in the dark (outside every light) is not drawn at all, so no ghost silhouettes at the screen edge
  let shade = 0, tint = "", tintA = 0;
  const champ = !isPlayer && a.tier === "champion" && !dying;
  if (!isPlayer) {
    light.sample(pos.x + 0.5, pos.y + 0.5, LS);
    shade = LS.shade;
    if (!env.lowFx) { tint = LS.tint; tintA = Math.min(LS.tintA, 0.1); } // capped so the imp's red eyes and rim stay saturated
    // Final polish: a monster inside a reasonable radius of the hero, or one that is awake and hunting, is never dimmed or hidden by the dark.
    const hd = Math.hypot(pos.x - light.hero.x, pos.y - light.hero.y), hr = light.radius(), hunting = a.ai === "chase" || a.ai === "attack" || a.ai === "notice" || a.ai === "stagger" || a.ai === "flee" || a.ai === "windup";
    const near = hd <= hr * 0.85 || (hunting && hd <= hr * 1.1); // inside the lit disc (the mask itself fades beyond it, so no black blobs at the edge)
    if (near) { shade = Math.min(shade, 0.12); tintA = Math.min(tintA, 0.04); }
    else if (shade >= 0.6 && !tint && !dying && !champ && !boss) return null;
    if (boss) { shade = Math.min(shade, 0.12); tint = ""; tintA = 0; } // the boss is never lost in the dark and keeps its own colours (its aura is the light)
  }
  // contact shadow on the ground, under everything that stands there
  const k = (dm.shadowR * 2.25) / 62, sh = F.shadowE;
  if (isPlayer && !dying) heroRing(g, sx, sy, dm.shadowR * 1.7, z, now);
  if (champ) champRing(g, sx, sy, dm.shadowR * 1.6, z, now, env.style.palette.champion);
  if (boss && !dying) bossAura(g, sx, sy, dm.shadowR * 1.7, z, now, a.boss?.phase >= 2);
  if (!isPlayer && a.summoned && !dying) tempRing(g, sx, sy, dm.shadowR * 1.5, z);
  g.globalAlpha = 0.85 * alphaV;
  g.drawImage(sh.img, Math.round(sx - sh.ox * k * z), Math.round(sy - sh.oy * k * z), Math.round(sh.w * k * z), Math.round(sh.h * k * z));
  g.globalAlpha = 1;
  const it = grab(pos.x + pos.y + 1.02, e, sx, sy);
  it.actor = true; it.isPlayer = isPlayer; it.a = alphaV; it.flash = flash; it.head = dm.head;
  it.shade = shade; it.tint = tint; it.tintA = tintA; it.champ = champ; it.boss = boss; it.summoned = !isPlayer && !!a.summoned && !dying;
  if (!isPlayer && !dying) {
    it.icon = a.muteT > 0 ? ICON_MUTED : a.ai === "stagger" ? ICON_STAGGER : a.ai === "flee" ? ICON_FLEE : a.ai === "notice" ? ICON_ALERT : 0;
    it.mute = a.muteT > 0;
    if (a.ai === "stagger") { // recoil away from the facing direction and shiver, easing out over the recovery
      const kk = Math.min(1, a.staggerT / config.hitRecoveryTicks), v = DIR_VEC[dir];
      it.dx = (-v[0] * 4 * kk + Math.sin(now * 0.075) * 1.8 * kk) * z; it.dy = -v[1] * 2 * kk * z;
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
    items.push(grab(p.x + p.y + 1 - (p.blocks ? 0 : 0.3) + p.dd, p.e, pt.x, pt.y - p.dy * z));
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
  fx.core = core; fx.alpha = alpha; // the screen-space pass (floaters, projectiles, loot plates) reads the state through these
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
  fx.drawGround(g, cam, atlas, now); // cast runes, burst and heal rings: flat on the floor, under every actor

  // ---- actors: positions first (lights need them), then lit sprites ----
  F.g = g; F.cam = cam; F.atlas = atlas; F.prev = prev; F.alpha = alpha; F.fx = fx; F.now = now; F.env = env; F.light = light;
  F.figs = figureTable(atlas); F.shadowE = atlas.get(keys.fx("shadow"));
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
  light.select(cam, hp, core.bossUnlocked ? c.lightsOpen : c.lights, actorOut, env.lowFx, env.hc, floor.theme);

  const heroDir = faceFor(hero, true, core, rs);
  project(cam, hp.x + 0.5, hp.y + 0.5, pt);
  out.heroScreen.x = pt.x; out.heroScreen.y = pt.y; out.heroDir = heroDir;
  out.heroItem = addActor(hero, true, hp, heroDir, pt.x, pt.y);
  for (let i = 0; i < nm; i++) {
    const m = mons[i], o = actorOut[i];
    o.hid = false;
    if (o.sx < -margin || o.sx > cam.w + margin || o.sy < -margin || o.sy > yMax) continue;
    if (!addActor(m, false, o, faceFor(m, false, core, rs), o.sx, o.sy)) o.hid = true; // lost in the dark: no sprite, so no plate or pip floating alone
  }
  for (let i = 0; i < npcs.length; i++) addNpc(npcs[i], actorOut[nm + i], margin, yMax);

  // enemies standing in front of the hero (and overlapping his sprite) fade, so he never disappears behind a pile
  const hi = out.heroItem;
  let buried = false;
  if (hi) for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.actor || it.isPlayer || it.d <= hi.d) continue;
    const dx = Math.abs(it.x - hi.x), dy = it.y - hi.y;
    if (dx < 30 * z && dy > -8 * z && dy < 60 * z) { if (it.a > 0.5) it.a = 0.5; buried = true; }
  }
  items.sort(byDepth);
  const champColour = env.style.palette.champion;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.actor) { blit(g, it.e, it.x, it.y, z); continue; }
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
    if (it.shade > 0) { g.globalAlpha = it.shade * it.a; blit(g, atlas.shade(it.e, "#070518"), x, y, z); }
    if (it.tintA > 0) { g.globalAlpha = it.tintA * it.a; blit(g, atlas.tint(it.e, it.tint), x, y, z); }
    if (it.hurt) { g.globalAlpha = 0.14; blit(g, atlas.tint(it.e, "#ff1f2e"), x, y, z); }
    g.globalAlpha = 1;
    if (it.summoned) blit(g, atlas.get(keys.fx("badge")), x + 5 * z, y - 30 * z, z * 0.9); // temp badge pinned to the chest
    if (it.icon) drawIcon(g, atlas, it, x, y, z, now);
  }

  // pack readability: when enemies stand in front of the hero he is drawn again above them, half transparent, with his ring's front arc
  if (buried && hi && hero.action !== "dead") {
    const rx = env.style.dims[PLAYER_CLASS].shadowR * 1.7 * z, ry = rx * 0.5;
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
