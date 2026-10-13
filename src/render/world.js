// Draws the floor, props, walls and actors in painter's order (depth = tx + ty), with interpolated actor
// positions, contact shadows, actors lit from the same light model as the darkness mask, and the
// hero-behind-wall ghost. The per-frame path allocates nothing: scratch objects and arrays are pooled.
import { config, content } from "../core/index.js";
import { keys, dirIndex, PLAYER_CLASS, FLOOR_VARIANTS, WALL_VARIANTS, ANIMS, DIRS } from "./keys.js";
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
const wallVariant = (h) => { const r = (h >>> 5) % 100; return r < 64 ? 0 : r < 90 ? 1 % WALL_VARIANTS : 2 % WALL_VARIANTS; };
const caches = new WeakMap(), figTables = new WeakMap();
const GHOST_DELTAS = [1, 0, 0, 1, 1, 1];

function figureTable(atlas) {
  let t = figTables.get(atlas);
  if (t) return t;
  const build = (fn) => {
    const o = {};
    for (const [anim, n] of Object.entries(ANIMS)) o[anim] = Array.from({ length: DIRS }, (_, d) => Array.from({ length: n }, (_, f) => atlas.get(fn(anim, d, f))));
    return o;
  };
  t = { plr: build((a, d, f) => keys.plr(PLAYER_CLASS, a, d, f)), mon: {} };
  for (const type of Object.keys(content.monsters)) t.mon[type] = build((a, d, f) => keys.mon(type, a, d, f));
  figTables.set(atlas, t);
  return t;
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
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, code = tiles[i];
    if (code === WALL) {
      let open = false;
      for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWall(x + dx, y + dy)) { open = true; break; }
      if (!open) continue;
      const mask = (isWall(x, y - 1) ? 1 : 0) | (isWall(x + 1, y) ? 2 : 0) | (isWall(x, y + 1) ? 4 : 0) | (isWall(x - 1, y) ? 8 : 0);
      wall[i] = atlas.get(keys.wall(theme, mask, wallVariant(vhash(x, y))));
      blocked[i] = 1;
    } else if (code === DOOR) ground[i] = atlas.get(keys.marker(theme, "door"));
    else if (code === STAIRS_UP) ground[i] = atlas.get(keys.marker(theme, "stairs-up"));
    else if (code === STAIRS_DOWN) ground[i] = atlas.get(keys.marker(theme, "stairs-down"));
    else ground[i] = atlas.get(keys.floor(theme, kindAt[i], floorVariant(vhash(x, y))));
  }
  const props = floor.props.map((p) => { if (p.blocks) blocked[p.y * w + p.x] = 1; return { x: p.x, y: p.y, blocks: p.blocks, e: atlas.get(keys.prop(p.type)) }; });
  // light sources: a cyan pool on every monitor (desks), a cold fluorescent over the middle of each room
  const lights = [];
  for (const p of floor.props) if (p.type === "desk") lights.push({ kind: "monitor", x: p.x + 0.5, y: p.y + 0.5 });
  for (const r of floor.rooms) if (r.kind !== "corridor") lights.push({ kind: "fluor", x: r.x + r.w / 2, y: r.y + r.h / 2 });
  c = { atlas, ground, wall, props, blocked, lights };
  caches.set(floor, c);
  return c;
}

function blit(g, e, sx, sy, z) {
  g.drawImage(e.img, Math.round(sx - e.ox * z), Math.round(sy - e.oy * z), Math.round(e.w * z), Math.round(e.h * z));
}

// ---- pooled scratch ----
const pt = { x: 0, y: 0 }, AF = { anim: "idle", frame: 0 }, LS = { shade: 0, tint: "", tintA: 0 };
const pool = [], items = [], actorOut = [], posA = { x: 0, y: 0 }, posB = { x: 0, y: 0 };
const out = { heroScreen: { x: 0, y: 0 }, heroDir: 0, actors: actorOut, heroItem: null };
let nPool = 0;
const grab = (d, e, x, y) => {
  const it = pool[nPool++] ?? (pool[nPool - 1] = { d: 0, e: null, x: 0, y: 0, a: 1, actor: false, isPlayer: false, alert: false, shade: 0, tint: "", tintA: 0, flash: false, head: 0 });
  it.d = d; it.e = e; it.x = x; it.y = y; it.a = 1; it.actor = false; it.isPlayer = false; it.alert = false; it.shade = 0; it.tint = ""; it.tintA = 0; it.flash = false;
  return it;
};
const byDepth = (a, b) => a.d - b.d;
const hp = { x: 0, y: 0 }, F = { g: null, cam: null, atlas: null, prev: null, alpha: 1, fx: null, now: 0, env: null, figs: null, shadowE: null, light: null, items };

function lerpPos(a, o) {
  actorPos(a, posA);
  const pv = F.prev.get(a.id);
  o.x = pv ? pv.x + (posA.x - pv.x) * F.alpha : posA.x; o.y = pv ? pv.y + (posA.y - pv.y) * F.alpha : posA.y;
}

function addActor(a, isPlayer, pos, dir, sx, sy) {
  const { g, cam, atlas, fx, now, env, light } = F, z = cam.z;
  const af = animFor(a, isPlayer, now), table = isPlayer ? F.figs.plr : F.figs.mon[a.type];
  const e = table[af.anim][dir][af.frame];
  let alphaV = 1, flash = false;
  if (af.anim === "death") {
    const t = isPlayer ? Math.min(1, (now - (fx.deathAt ?? now)) / 900) : a.deathT / config.deathTicks;
    alphaV = isPlayer ? 1 : Math.max(0, Math.min(1, (1 - t) * 3));
  } else if ((fx.flash.get(a.id) ?? 0) > now) flash = true;
  const dm = env.style.dims[isPlayer ? PLAYER_CLASS : a.type];
  // contact shadow on the ground, under everything that stands there
  const k = (dm.shadowR * 2) / 62, sh = F.shadowE;
  g.globalAlpha = 0.5 * alphaV;
  g.drawImage(sh.img, Math.round(sx - sh.ox * k * z), Math.round(sy - sh.oy * k * z), Math.round(sh.w * k * z), Math.round(sh.h * k * z));
  g.globalAlpha = 1;
  const it = grab(pos.x + pos.y + 1.02, e, sx, sy);
  it.actor = true; it.isPlayer = isPlayer; it.a = alphaV; it.flash = flash; it.head = dm.head;
  it.alert = !isPlayer && a.ai === "notice";
  if (!isPlayer) { // tint from the light model at the feet (lowFx: darkness only)
    light.sample(pos.x + 0.5, pos.y + 0.5, LS);
    it.shade = LS.shade;
    if (!env.lowFx) { it.tint = LS.tint; it.tintA = LS.tintA; }
  }
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
    else if (a.next) { AF.anim = "walk"; AF.frame = Math.floor(now / 90) % 6; }
    else { AF.anim = "idle"; AF.frame = Math.floor(now / 200) % 4; }
  } else if (a.ai === "dead") { AF.anim = "death"; AF.frame = Math.min(3, Math.floor((a.deathT / config.deathTicks) * 4)); }
  else if (a.ai === "attack" && a.attackT > 0) { AF.anim = "attack"; AF.frame = attackFrame(a.attackT, config.monsterAttackTicks, config.monsterAttackHitTick); }
  else if (a.next) { AF.anim = "walk"; AF.frame = Math.floor(now / 110) % 6; }
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
    const i = ty * fw + tx, gE = c.ground[i], wE = c.wall[i];
    if (!gE && !wE) continue;
    project(cam, tx + 0.5, ty + 0.5, pt);
    if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) continue;
    if (gE) blit(g, gE, pt.x, pt.y, z);
    else items.push(grab(tx + ty + 1, wE, pt.x, pt.y));
  }
  const props = c.props;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    project(cam, p.x + 0.5, p.y + 0.5, pt);
    if (pt.x < -margin || pt.x > cam.w + margin || pt.y < -margin || pt.y > yMax) continue;
    items.push(grab(p.x + p.y + 1 - (p.blocks ? 0 : 0.3), p.e, pt.x, pt.y));
  }

  // ---- actors: positions first (lights need them), then lit sprites ----
  const hero = core.player, light = env.lighting;
  F.g = g; F.cam = cam; F.atlas = atlas; F.prev = prev; F.alpha = alpha; F.fx = fx; F.now = now; F.env = env; F.light = light;
  F.figs = figureTable(atlas); F.shadowE = atlas.get(keys.fx("shadow"));
  lerpPos(hero, hp);
  const mons = core.monsters, na = mons.length;
  for (let i = 0; i < na; i++) {
    const m = mons[i], o = actorOut[i] ?? (actorOut[i] = { id: "", type: "", name: "", ai: "", hp: 0, hpMax: 0, dead: false, x: 0, y: 0, sx: 0, sy: 0, d: 0, pr: 0 });
    lerpPos(m, posB);
    o.id = m.id; o.type = m.type; o.name = content.monsters[m.type].name; o.ai = m.ai; o.hp = m.hp; o.hpMax = m.hpMax; o.dead = m.ai === "dead";
    o.x = posB.x; o.y = posB.y; o.d = Math.hypot(posB.x - hp.x, posB.y - hp.y);
    project(cam, o.x + 0.5, o.y + 0.5, pt); o.sx = pt.x; o.sy = pt.y;
  }
  actorOut.length = na;
  light.select(cam, hp, c.lights, actorOut, env.lowFx, env.hc);

  const heroDir = faceFor(hero, true, core, rs);
  project(cam, hp.x + 0.5, hp.y + 0.5, pt);
  out.heroScreen.x = pt.x; out.heroScreen.y = pt.y; out.heroDir = heroDir;
  out.heroItem = addActor(hero, true, hp, heroDir, pt.x, pt.y);
  for (let i = 0; i < na; i++) {
    const m = mons[i], o = actorOut[i];
    if (o.sx < -margin || o.sx > cam.w + margin || o.sy < -margin || o.sy > yMax) continue;
    addActor(m, false, o, faceFor(m, false, core, rs), o.sx, o.sy);
  }

  items.sort(byDepth);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.actor) { blit(g, it.e, it.x, it.y, z); continue; }
    if (it.a < 1) g.globalAlpha = it.a;
    blit(g, it.flash ? atlas.flash(it.e) : it.e, it.x, it.y, z);
    if (it.shade > 0) { g.globalAlpha = it.shade * it.a; blit(g, atlas.shade(it.e, "#070518"), it.x, it.y, z); }
    if (it.tintA > 0) { g.globalAlpha = it.tintA * it.a; blit(g, atlas.tint(it.e, it.tint), it.x, it.y, z); }
    g.globalAlpha = 1;
    if (it.alert) blit(g, atlas.get("fx:alert"), it.x, it.y - (it.head + 2) * z, z);
  }

  // hero ghost when a wall or tall prop in front may hide the hero
  if (hero.action !== "dead") {
    let hidden = false;
    for (let k = 0; k < GHOST_DELTAS.length && !hidden; k += 2) {
      const x = hero.tile.x + GHOST_DELTAS[k], y = hero.tile.y + GHOST_DELTAS[k + 1];
      if (x < fw && y < fh && c.blocked[y * fw + x]) hidden = true;
    }
    if (hidden) { const hi = out.heroItem; g.globalAlpha = 0.35; blit(g, hi.e, hi.x, hi.y, z); g.globalAlpha = 1; }
  }
  pruneFacing(core, rs);
  return out;
}
