// Draws the floor, props, walls and actors in painter's order (depth = tx + ty), with
// interpolated actor positions, a light vignette around the hero, and the hero-behind-wall ghost.
import { config } from "../core/index.js";
import { keys, dirIndex, PLAYER_CLASS, FLOOR_VARIANTS } from "./keys.js";
import { worldToScreen, screenToWorld } from "./view.js";
import { WALL, STAIRS_UP, STAIRS_DOWN, DOOR } from "../core/tiles.js";

/** Float tile position of an actor (tile + progress towards `next`). */
export function actorPos(a) {
  const f = a.next && a.moveTotal ? a.moveT / a.moveTotal : 0;
  return { x: a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f, y: a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f };
}

const vhash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
const caches = new WeakMap();

/** Per-floor lookup tables of atlas entries (built once per floor object). */
function prepare(floor, atlas) {
  let c = caches.get(floor);
  if (c && c.atlas === atlas) return c;
  const { w, h, tiles } = floor, theme = floor.theme;
  const kindAt = new Array(w * h).fill("corridor");
  for (const r of floor.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) kindAt[y * w + x] = r.kind;
  const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y * w + x] === WALL;
  const ground = new Array(w * h).fill(null), wall = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, code = tiles[i];
    if (code === WALL) {
      let open = false;
      for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWall(x + dx, y + dy)) { open = true; break; }
      if (!open) continue;
      const mask = (isWall(x, y - 1) ? 1 : 0) | (isWall(x + 1, y) ? 2 : 0) | (isWall(x, y + 1) ? 4 : 0) | (isWall(x - 1, y) ? 8 : 0);
      wall[i] = atlas.get(keys.wall(theme, mask));
    } else if (code === DOOR) ground[i] = atlas.get(keys.marker(theme, "door"));
    else if (code === STAIRS_UP) ground[i] = atlas.get(keys.marker(theme, "stairs-up"));
    else if (code === STAIRS_DOWN) ground[i] = atlas.get(keys.marker(theme, "stairs-down"));
    else ground[i] = atlas.get(keys.floor(theme, kindAt[i], vhash(x, y) % FLOOR_VARIANTS));
  }
  const props = floor.props.map((p) => ({ x: p.x, y: p.y, blocks: p.blocks, e: atlas.get(keys.prop(p.type)) }));
  c = { atlas, ground, wall, props, isWall };
  caches.set(floor, c);
  return c;
}

function blit(g, e, sx, sy, z) {
  g.drawImage(e.img, Math.round(sx - e.ox * z), Math.round(sy - e.oy * z), Math.round(e.w * z), Math.round(e.h * z));
}

/** Choose anim + frame for an actor. */
function animFor(a, isPlayer, now) {
  if (isPlayer) {
    if (a.action === "dead") return { anim: "death", frame: 3 };
    if (a.action === "attack") return { anim: "attack", frame: Math.min(3, Math.floor((a.attackT / config.attackTicks) * 4)) };
    if (a.next) return { anim: "walk", frame: Math.floor(now / 90) % 6 };
    return { anim: "idle", frame: Math.floor(now / 200) % 4 };
  }
  if (a.ai === "dead") return { anim: "death", frame: Math.min(3, Math.floor((a.deathT / config.deathTicks) * 4)) };
  if (a.ai === "attack" && a.attackT > 0) return { anim: "attack", frame: Math.min(3, Math.floor((a.attackT / config.monsterAttackTicks) * 4)) };
  if (a.next) return { anim: "walk", frame: Math.floor(now / 110) % 6 };
  return { anim: "idle", frame: Math.floor(now / 220) % 4 };
}

function faceFor(a, isPlayer, core, rs) {
  const prev = rs.facing.get(a.id) ?? 0;
  let d = prev;
  if (a.next) d = dirIndex(a.next.x - a.tile.x, a.next.y - a.tile.y, prev);
  else if (isPlayer) {
    const t = a.target && core.monsters.find((m) => m.id === a.target);
    if (t) d = dirIndex(t.tile.x - a.tile.x, t.tile.y - a.tile.y, prev);
  } else if (a.ai !== "idle" && a.ai !== "dead") d = dirIndex(core.player.tile.x - a.tile.x, core.player.tile.y - a.tile.y, prev);
  rs.facing.set(a.id, d);
  return d;
}

/**
 * Draw one frame of the world. prev: Map id -> previous-tick float pos; alpha in [0,1].
 * rs: { facing: Map } render-side memory. Returns { heroScreen, hover } for the caller.
 */
export function drawWorld(g, cam, atlas, core, prev, alpha, fx, now, rs) {
  const floor = core.floor, c = prepare(floor, atlas), { w: fw, h: fh } = floor, z = cam.z;
  // visible tile range from the four canvas corners
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [sx, sy] of [[0, 0], [cam.w, 0], [0, cam.h], [cam.w, cam.h]]) {
    const t = screenToWorld(cam, sx, sy);
    minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
  }
  minX = Math.max(0, Math.floor(minX) - 3); maxX = Math.min(fw - 1, Math.ceil(maxX) + 3);
  minY = Math.max(0, Math.floor(minY) - 3); maxY = Math.min(fh - 1, Math.ceil(maxY) + 3);

  const items = [];
  const margin = 70 * z;
  for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
    const i = ty * fw + tx, gE = c.ground[i], wE = c.wall[i];
    if (!gE && !wE) continue;
    const s = worldToScreen(cam, tx + 0.5, ty + 0.5);
    if (s.x < -margin || s.x > cam.w + margin || s.y < -margin || s.y > cam.h + margin * 1.4) continue;
    if (gE) blit(g, gE, s.x, s.y, z);
    else items.push({ d: tx + ty + 1, e: wE, x: s.x, y: s.y });
  }
  for (const p of c.props) {
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    const s = worldToScreen(cam, p.x + 0.5, p.y + 0.5);
    if (s.x < -margin || s.x > cam.w + margin || s.y < -margin || s.y > cam.h + margin * 1.4) continue;
    items.push({ d: p.x + p.y + 1 - (p.blocks ? 0 : 0.3), e: p.e, x: s.x, y: s.y });
  }

  // actors
  const lerp = (a, b) => a + (b - a) * alpha;
  const place = (a) => {
    const cur = actorPos(a), pv = prev.get(a.id) ?? cur;
    return { x: lerp(pv.x, cur.x), y: lerp(pv.y, cur.y) };
  };
  const hero = core.player, hp = place(hero);
  const heroDir = faceFor(hero, true, core, rs);
  const actorItem = (a, isPlayer) => {
    const pos = isPlayer ? hp : place(a), dir = isPlayer ? heroDir : faceFor(a, false, core, rs);
    const { anim, frame } = animFor(a, isPlayer, now);
    const key = isPlayer ? keys.plr(PLAYER_CLASS, anim, dir, frame) : keys.mon(a.type, anim, dir, frame);
    const s = worldToScreen(cam, pos.x + 0.5, pos.y + 0.5);
    let e = atlas.get(key), alphaV = 1;
    if (anim === "death") {
      const t = isPlayer ? Math.min(1, (now - (fx.deathAt ?? now)) / 900) : a.deathT / config.deathTicks;
      alphaV = isPlayer ? 1 : Math.max(0, Math.min(1, (1 - t) * 3));
    } else if ((fx.flash.get(a.id) ?? 0) > now) e = atlas.flash(key);
    items.push({ d: pos.x + pos.y + 1.02, e, x: s.x, y: s.y, a: alphaV, actor: a, isPlayer, alert: !isPlayer && a.ai === "notice" });
    return { pos, s };
  };
  const hs = actorItem(hero, true);
  const monsterScreens = [];
  for (const m of core.monsters) {
    const r = actorItem(m, false);
    monsterScreens.push({ id: m.id, tile: m.tile, pos: r.pos, dead: m.ai === "dead", s: r.s });
  }

  items.sort((a, b) => a.d - b.d);
  for (const it of items) {
    if (it.a !== undefined && it.a < 1) g.globalAlpha = it.a;
    blit(g, it.e, it.x, it.y, z);
    g.globalAlpha = 1;
    if (it.alert) blit(g, atlas.get(keys.fx("alert")), it.x, it.y - 52 * z, z);
  }

  // hero ghost when a wall or tall prop in front may hide the hero
  const ht = { x: hero.tile.x, y: hero.tile.y }, blocked = (x, y) => c.wall[y * fw + x] || c.props.some((p) => p.blocks && p.x === x && p.y === y);
  if (hero.action !== "dead" && [[1, 0], [0, 1], [1, 1]].some(([dx, dy]) => ht.x + dx < fw && ht.y + dy < fh && blocked(ht.x + dx, ht.y + dy))) {
    const heroItem = items.find((i) => i.isPlayer);
    g.globalAlpha = 0.35; blit(g, heroItem.e, heroItem.x, heroItem.y, z); g.globalAlpha = 1;
  }
  return { heroScreen: hs.s, heroDir, actors: monsterScreens };
}

/** Darkness around the hero (cached per size) so only a lit area around them is readable. */
const vig = { w: 0, h: 0, z: 0, canvas: null };
export function drawLight(g, cam, hero) {
  if (!vig.canvas || vig.w !== cam.w || vig.h !== cam.h || vig.z !== cam.z) {
    const cv = document.createElement("canvas");
    cv.width = cam.w; cv.height = cam.h;
    const v = cv.getContext("2d"), cx = cam.w / 2, cy = cam.h / 2 - 8 * cam.z;
    const grad = v.createRadialGradient(cx, cy, 150 * cam.z, cx, cy, 540 * cam.z);
    grad.addColorStop(0, "rgba(6,7,12,0)"); grad.addColorStop(0.55, "rgba(6,7,12,0.55)"); grad.addColorStop(1, "rgba(4,5,9,0.95)");
    v.fillStyle = grad; v.fillRect(0, 0, cam.w, cam.h);
    Object.assign(vig, { w: cam.w, h: cam.h, z: cam.z, canvas: cv });
  }
  g.drawImage(vig.canvas, 0, 0);
  // warm pool of light under the hero
  const cx = cam.w / 2, cy = cam.h / 2 + 12 * cam.z;
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 170 * cam.z);
  glow.addColorStop(0, "rgba(255,217,160,0.10)"); glow.addColorStop(1, "rgba(255,217,160,0)");
  g.globalCompositeOperation = "lighter"; g.fillStyle = glow; g.fillRect(cx - 180 * cam.z, cy - 180 * cam.z, 360 * cam.z, 360 * cam.z);
  g.globalCompositeOperation = "source-over";
}
