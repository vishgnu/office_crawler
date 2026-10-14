// Render-only effects (paper bursts, impact stars, skill rings, projectile impacts, loot beams and plates, state-backed floaters,
// hit-stop, camera shake). Never touches core state and never feeds back into the simulation; timing uses the render clock.
// Hit-stop only delays the realtime loop (game.js reads fx.hitStopUntil); it never changes what a tick computes.
//
// Two entry points are called from the world pass: lootRing() and drawGround() draw flat things on the floor before the actors
// (they are lit by the darkness mask); draw() is the screen-space pass above the lit world (beams, markers, projectiles, plates,
// floaters). drawWorld() sets fx.core / fx.alpha each frame so draw() can read the state (floaters are state-backed, S2-3).
import { createRng } from "../rng.js";
import { project } from "../ui/camera.js";
import { keys, PLAYER_CLASS } from "./keys.js";
import { config, content } from "../core/index.js";
import { actorPos } from "./world.js";
import { drawQuestSign, drawNpcMarkers } from "./questmark.js";
import { createSkillFx, FLOAT_COL } from "./draw/effects.js";

const S = content.strings;
const TICK_MS = 1000 / config.tickHz;
const FLOATER_MS = config.floaterTicks * TICK_MS; // the state decides how long a floater lives
const STACK_MS = 420;                            // floaters of one target spawned within this window stack upward (S1 polish rule)
const HIT_STOP_MS = 55, KILL_STOP_MS = 95;
const SANS = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman','Liberation Serif',serif";
const fonts = [];
const fontFor = (px) => (fonts[px] ??= `900 italic ${px}px ${SANS}`);
const ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const RUNE = { "stapler-throw": "#c9d2e4", "reply-all": "#ffb35a", "coffee-break": "#6fe08a", mute: "#c9a0ff" };
const IMPACT_MS = 380;
const TRAIL = { shard: "#bff2ff", bolt: "#6fe8ff", zap: "#6fe8ff", sealed: "#ff8a8a", pen: "#8fb0ff" }; // projectile kinds that leave a trail
const MUZZLE = { toner: null, slide: "#5b8cff", pen: "#8fb0ff", card: "#ffd0e4", paper: "#f4ecd6", sealed: "#ff7a7a", shard: "#bff2ff", bolt: "#6fe8ff", zap: "#6fe8ff" };
/** AC-NFR-A05-2: nothing flashes more than 3 times a second. The boss telegraph "hot" edge toggles every FLASH_HALF_MS (a flash is one on/off cycle). */
export const FLASH_HALF_MS = 170;
/** Low-HP pulse period in ms for a health ratio (below 0.3): 700 to 1150 ms. */
export const lowHpPeriod = (ratio) => 700 + 900 * ratio / 0.3 * 0.5;
const CONFETTI = ["#ffd24a", "#e0363f", "#56b4e9", "#6fe08a", "#ffffff", "#ff9acb", "#f0e442"];
const INK_FX = "#0d0a1c";
const ell0 = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
const hash01 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// ---- loot visuals ----
const MAX_PLATES = 6; // visible loot labels at once (Alt shows up to 2x)
const LOOT_GAP = 5; // minimum gap between stacked loot labels, px
const RARITY_RANK = { unique: 4, rare: 3, magic: 2 };
const PLATE_NEAR = 5, PLATE_FAR = 10;
const CROWD_LOOT = 6, CROWD_CAP = 4, CROWD_R = 6; // round G fix: more than CROWD_LOOT drops within CROWD_R tiles of the hero -> only the nearest CROWD_CAP get a tag
const plateCache = new Map();
const rarityColour = (P, gi) => (gi.rarity && P.rarity[gi.rarity]) || gi.color || "#d6d3cb";

/** Loot plate canvas: text on a dark plate, border style per rarity (plain, single, double, notched-ornate), serif for uniques. */
function plateSprite(P, label, rarity, border, colour, fs, hc, dpr) {
  const key = `${label}|${border}|${colour}|${fs}|${hc ? 1 : 0}|${dpr}`;
  let s = plateCache.get(key);
  if (s) return s;
  const pal = hc ? P.plateHc : P.plate, font = `${rarity === "unique" ? "italic 700" : "800"} ${fs}px ${rarity === "unique" ? SERIF : SANS}`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const padX = border === "ornate" ? 11 : 7, w = Math.ceil(probe.measureText(label).width + padX * 2), h = fs + 8, m = 3;
  const c = document.createElement("canvas");
  c.width = Math.ceil((w + m * 2) * dpr); c.height = Math.ceil((h + m * 2) * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr); g.lineJoin = "round";
  const path = (inset) => {
    const x = m + inset, y = m + inset, ww = w - inset * 2, hh = h - inset * 2;
    g.beginPath();
    if (border === "ornate") { const n = Math.min(7, hh * 0.4) - inset * 0.5; g.moveTo(x + n, y); g.lineTo(x + ww - n, y); g.lineTo(x + ww, y + n); g.lineTo(x + ww, y + hh - n); g.lineTo(x + ww - n, y + hh); g.lineTo(x + n, y + hh); g.lineTo(x, y + hh - n); g.lineTo(x, y + n); g.closePath(); }
    else g.roundRect(x, y, ww, hh, 4);
  };
  path(0); g.fillStyle = pal.bg; g.fill();
  g.lineWidth = 3; g.strokeStyle = hc ? "#ffffff" : P.ink; g.stroke();
  if (border === "single" || border === "double" || border === "ornate") { path(1.4); g.lineWidth = 1.6; g.strokeStyle = colour; g.stroke(); }
  if (border === "double") { path(3.6); g.lineWidth = 1; g.strokeStyle = colour; g.stroke(); }
  if (border === "ornate") { path(3.4); g.lineWidth = 1; g.strokeStyle = "#ffffff"; g.stroke(); }
  g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = hc ? pal.text : colour;
  g.fillText(label, m + w / 2, m + h / 2 + 0.5);
  s = { c, w: w + m * 2, h: h + m * 2 };
  plateCache.set(key, s);
  if (plateCache.size > 80) plateCache.delete(plateCache.keys().next().value);
  return s;
}

/** Marker glyph centred at (x, y), size px across: shape differs per rarity so colour is never the only cue. */
function marker(g, P, gi, x, y, size, colour) {
  const r = size / 2, rarity = gi.rarity;
  g.lineJoin = "round"; g.lineWidth = Math.max(2, size * 0.14); g.strokeStyle = P.ink; g.fillStyle = colour;
  g.beginPath();
  if (gi.gold) { g.arc(x, y, r * 0.92, 0, Math.PI * 2); }
  else if (rarity === "magic") { g.arc(x, y, r * 0.9, 0, Math.PI * 2); }
  else if (rarity === "rare") { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k & 1 ? r * 0.46 : r * 1.08; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
  else if (rarity === "unique") { const n = r * 1.05; g.moveTo(x, y - n); g.lineTo(x + n * 0.34, y - n * 0.34); g.lineTo(x + n, y); g.lineTo(x + n * 0.34, y + n * 0.34); g.lineTo(x, y + n); g.lineTo(x - n * 0.34, y + n * 0.34); g.lineTo(x - n, y); g.lineTo(x - n * 0.34, y - n * 0.34); g.closePath(); }
  else { g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); }
  g.stroke(); g.fill();
  g.strokeStyle = P.ink; g.fillStyle = P.ink; g.lineWidth = Math.max(1.6, size * 0.12); g.lineCap = "round";
  if (gi.gold) { g.font = `900 ${Math.round(size * 0.82)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", x, y + size * 0.05); }
  else if (rarity === "magic") { g.beginPath(); g.moveTo(x - r * 0.5, y); g.lineTo(x + r * 0.5, y); g.moveTo(x, y - r * 0.5); g.lineTo(x, y + r * 0.5); g.stroke(); }
  else if (rarity === "rare") { g.beginPath(); g.arc(x, y + r * 0.04, r * 0.16, 0, Math.PI * 2); g.fill(); }
  else if (rarity === "unique") { g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(1.4, size * 0.1); g.beginPath(); g.moveTo(x, y - r * 0.55); g.lineTo(x + r * 0.55, y); g.lineTo(x, y + r * 0.55); g.lineTo(x - r * 0.55, y); g.closePath(); g.stroke(); }
  else { g.beginPath(); g.moveTo(x - r * 0.4, y); g.lineTo(x + r * 0.4, y); g.stroke(); }
}

/** Light beam above an item: thin (magic), wide trapezoid with a bright core (rare), wide double beam with a diamond top (unique). */
function beam(g, rarity, colour, x, y, z, now) {
  if (rarity !== "magic" && rarity !== "rare" && rarity !== "unique") return;
  const w = (rarity === "magic" ? 4 : rarity === "rare" ? 9 : 14) * z, hgt = (rarity === "magic" ? 52 : rarity === "rare" ? 80 : 110) * z;
  const grad = g.createLinearGradient(0, y, 0, y - hgt);
  grad.addColorStop(0, colour); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.save(); g.globalAlpha = (rarity === "unique" ? 0.62 : 0.72) + 0.1 * Math.sin(now / 300 + x);
  g.fillStyle = grad;
  g.beginPath();
  if (rarity === "magic") g.rect(x - w / 2, y - hgt, w, hgt);
  else { g.moveTo(x - w / 2, y); g.lineTo(x - w * (rarity === "rare" ? 0.22 : 0.4), y - hgt); g.lineTo(x + w * (rarity === "rare" ? 0.22 : 0.4), y - hgt); g.lineTo(x + w / 2, y); g.closePath(); }
  g.fill();
  if (rarity !== "magic") { g.globalAlpha = 0.7; g.fillStyle = grad; g.fillRect(x - w * 0.12, y - hgt * 0.8, w * 0.24, hgt * 0.8); }
  if (rarity === "unique") { // diamond sparkle riding the top, and a second thin beam
    g.globalAlpha = 0.9; g.fillStyle = "#ffffff";
    const ty = y - hgt * 0.78 - Math.sin(now / 260) * 4 * z, d = 5 * z;
    g.beginPath(); g.moveTo(x, ty - d); g.lineTo(x + d * 0.6, ty); g.lineTo(x, ty + d); g.lineTo(x - d * 0.6, ty); g.closePath(); g.fill();
  }
  g.restore();
}

/**
 * Stack rows of state floaters (S1 polish rule, kept): a floater that spawns while another one of the same target is still near its
 * spawn point (within STACK_MS) goes one row higher. `life` counts down, so a smaller life is an older floater. Writes rows[i]; pure.
 */
export function stackRows(list, rows = [], tickMs = TICK_MS) {
  for (let i = 0; i < list.length; i++) {
    let row = 0;
    for (let j = 0; j < i; j++) {
      if (list[j].target !== list[i].target) continue;
      const gap = (list[i].life - list[j].life) * tickMs; // how much later i spawned than j
      if (gap >= 0 && gap < STACK_MS) row = Math.max(row, rows[j] + 1);
    }
    rows[i] = row;
  }
  return rows;
}

const SAFE_ = 8; // loot plates keep this far from the screen edge, px
const byDist = (a, b) => a.d - b.d;
const byPrio = (a, b) => b.rank - a.rank || a.d - b.d;
/** Reusable state of the loot layer (CR-14): one record per ground item, the two sort orders, scratch rects. */
function newLootState() { return { src: [], pool: [], order: [], prio: [], pp: [], hx: NaN, hy: NaN, vis: 0, size: 16, fs: 11, dpr: 1, hc: false, r: { x: 0, y: 0, w: 0, h: 0 }, hero: { x: 0, y: 0, w: 0, h: 0 } }; }
/** Rebuild the per-item records and both orders (by distance for beams / markers / crowd choice, by value for plates) only when the set or the hero tile changed. */
function lootSync(lt, P, list, hx, hy) {
  const n = list.length, src = lt.src;
  let same = lt.hx === hx && lt.hy === hy && src.length === n;
  for (let i = 0; same && i < n; i++) if (src[i] !== list[i]) same = false;
  if (same) return;
  lt.hx = hx; lt.hy = hy; src.length = n; lt.order.length = n; lt.prio.length = n;
  for (let i = 0; i < n; i++) {
    const gi = list[i], e = lt.pool[i] ?? (lt.pool[i] = { gi: null, d: 0, rank: 0, x: 0, my: 0, colour: "", on: false, near: false, sp: null, sfs: 0, shc: false, sdpr: 0 });
    src[i] = gi; e.gi = gi; e.d = Math.hypot(gi.tile.x - hx, gi.tile.y - hy); e.rank = gi.quest ? 3 : RARITY_RANK[gi.rarity] ?? 0; e.sp = null; // a quest entry (no item, no gold) always gets its plate in sight
    e.colour = gi.gold ? (gi.color ?? "#e6c84a") : gi.quest ? (gi.color ?? "#f0e442") : P.rarity[gi.rarity] ?? gi.color ?? "#d6d3cb";
    lt.order[i] = e; lt.prio[i] = e;
  }
  lt.order.sort(byDist); lt.prio.sort(byPrio);
}
/** rect a with a LOOT_GAP margin touches rect b */
const hitGap = (a, b) => a.x - LOOT_GAP < b.x + b.w && b.x < a.x + a.w + LOOT_GAP && a.y - LOOT_GAP < b.y + b.h && b.y < a.y + a.h + LOOT_GAP;
/** 0 = the plate (R.w x R.h at x, y) is free; j + 1 = it touches placed[j] (slidable); -1 = off screen, on a claimed label / leader line or (bodies) an enemy body. */
function plateFree(fx, placed, R, x, y, bodies, cam) {
  R.x = x; R.y = y;
  if (!(y > SAFE_ && y + R.h < cam.h - SAFE_ && x >= SAFE_ && x + R.w <= cam.w - SAFE_)) return -1;
  for (let j = 0; j < placed.length; j++) if (hitGap(R, placed[j])) return j + 1;
  if (fx.blocked(R) || fx.onHead(R, cam.z) || (bodies && fx.onBody(R, cam.z))) return -1; // a head is a keep-out in every pass, relaxed or not (N4)
  return 0;
}
const rectHit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Does the segment (x1,y1)-(x2,y2) touch rect r? (sampled; leader lines are short) */
export function segHitsRect(sg, r, pad = 2) {
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, x = sg[0] + (sg[2] - sg[0]) * t, y = sg[1] + (sg[3] - sg[1]) * t;
    if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return true;
  }
  return false;
}

export function createFx(style) {
  const rng = createRng(7), P = style.palette, pos = { x: 0, y: 0 }, shk = { x: 0, y: 0 }, pos2 = { x: 0, y: 0 };
  let hurtCanvas = null, hurtW = 0, hurtH = 0;
  const rows = [], fl = [], fr0 = { x: 0, y: 0, w: 0, h: 0 };
  let sk = null;
  const fx = {
    parts: [], slashes: [], rings: [], impacts: [], pillars: [], proj: new Map(), flash: new Map(), // `flash` is unused (flashTicks is state-backed) and kept so older callers do not break
    core: null, alpha: 1, hc: false, showAllLoot: false, hoverLootId: null, // the shell may set these three (high contrast, Alt held, hovered ground entry)
    avoid: [], avoidSegs: [], // plate / pip rectangles and leader lines claimed by the nameplate pass this frame (set by the shell); loot plates and floaters keep clear of them
    reducedMotion: false, reducedFlash: false, heroType: PLAYER_CLASS, lights: [], hurtUntil: 0, lowHp: false, beat: -1, shakeUntil: 0, hitStopUntil: 0, deathAt: null, lowFx: false, victoryAt: -1e9,
    reset() {
      fx.parts.length = 0; fx.slashes.length = 0; fx.rings.length = 0; fx.impacts.length = 0; fx.pillars.length = 0; fx.proj.clear(); fx.flash.clear();
      fx.hurtUntil = fx.shakeUntil = fx.hitStopUntil = 0; fx.deathAt = null; fx.victoryAt = -1e9; fx.lowHp = false; fx.beat = -1; sk.reset();
    },
    handle(ev, core, now) {
      const consumed = sk.handle(ev, core, now); // R5 skill effects (draw/effects.js); true when a typed ring replaces the old burst ring
      const find = (id) => (id === "player" ? core.player : core.monsters.find((m) => m.id === id));
      const at = (a) => { actorPos(a, pos); return pos; };
      if (ev.type === "hit") {
        const t = find(ev.target);
        if (!t) return;
        const cx = at(t).x + 0.5, cy = pos.y + 0.5, toPlayer = ev.target === "player";
        const head = style.dims[toPlayer ? fx.heroType : t.type]?.head ?? 50;
        if (toPlayer) { fx.hurtUntil = now + 260; fx.shakeUntil = now + 140; }
        else { fx.slashes.push({ x: cx, y: cy, head, born: now, skill: !!ev.skill }); fx.hitStopUntil = Math.max(fx.hitStopUntil, now + HIT_STOP_MS); }
        fx.burst(cx, cy, toPlayer ? 4 : 9, now);
      } else if (ev.type === "kill") {
        const t = find(ev.target);
        if (t) { const c = at(t); fx.burst(c.x + 0.5, c.y + 0.5, 18, now); fx.hitStopUntil = Math.max(fx.hitStopUntil, now + KILL_STOP_MS); }
      } else if (ev.type === "death") {
        fx.deathAt = now; fx.hurtUntil = now + 900;
      } else if (ev.type === "cast") {
        const c = at(core.player);
        fx.rings.push({ kind: "rune", x: c.x + 0.5, y: c.y + 0.5, r0: 1.5, r1: 0.7, born: now, life: 420, colour: RUNE[ev.skill] ?? "#8ff3ff" });
      } else if (ev.type === "burst") {
        const x = ev.tile.x + 0.5, y = ev.tile.y + 0.5;
        if (!consumed) fx.rings.push({ kind: "burst", x, y, r0: Math.max(0.5, ev.radius * 0.25), r1: ev.radius, born: now, life: 480, colour: "#ffb35a" });
        fx.burst(x, y, consumed ? 12 : 16, now, consumed ? { outward: ev.radius, chip: sk.chipColour() } : { outward: ev.radius }); // typed bursts throw debris chips, not paper
        fx.shakeUntil = Math.max(fx.shakeUntil, now + 90);
      } else if (ev.type === "heal" || ev.type === "healed") {
        const c = at(core.player);
        fx.rings.push({ kind: "heal", x: c.x + 0.5, y: c.y + 0.5, r0: 0.3, r1: 1.3, born: now, life: 700, colour: "#6fe08a" });
        fx.burst(c.x + 0.5, c.y + 0.5, ev.type === "healed" ? 12 : 8, now, { sprite: "plus", rise: true });
      } else if (ev.type === "levelup") {
        const c = at(core.player);
        fx.pillars.push({ x: c.x + 0.5, y: c.y + 0.5, born: now, life: 1100 });
        fx.rings.push({ kind: "levelup", x: c.x + 0.5, y: c.y + 0.5, r0: 0.4, r1: 2.2, born: now, life: 900, colour: "#ffd24d" });
        fx.rings.push({ kind: "levelup", x: c.x + 0.5, y: c.y + 0.5, r0: 0.2, r1: 1.4, born: now + 160, life: 800, colour: "#ffffff" });
        fx.burst(c.x + 0.5, c.y + 0.5, 16, now, { sprite: "spark", rise: true });
      } else if (ev.type === "projectile") {
        const pr = core.projectiles.find((p) => p.id === ev.id);
        if (pr) { fx.impacts.push({ kind: ev.kind, mode: "muzzle", x: pr.pos.x + 0.5, y: pr.pos.y + 0.5, z: 18, born: now, life: 150 }); fx.proj.set(pr.id, { x: pr.pos.x, y: pr.pos.y, kind: ev.kind }); }
      } else if (ev.type === "projectileEnd") {
        const last = fx.proj.get(ev.id);
        fx.proj.delete(ev.id);
        const kind = last?.kind ?? "stapler";
        const x = ev.tile ? ev.tile.x : last ? last.x : null, y = ev.tile ? ev.tile.y : last ? last.y : null;
        if (x === null) return;
        const hit = ev.reason === "hit";
        fx.impacts.push({ kind, mode: hit ? "hit" : ev.reason, x: x + 0.5, y: y + 0.5, z: hit ? 22 : 12, born: now, life: IMPACT_MS });
        if (kind === "slide") fx.burst(x + 0.5, y + 0.5, 8, now);
      } else if (ev.type === "bossSlam") { // the slam lands: a shock ring the size of the circle, paper kicked outward, a short shake
        const x = ev.tile.x + 0.5, y = ev.tile.y + 0.5;
        fx.rings.push({ kind: "burst", x, y, r0: ev.radius * 0.5, r1: ev.radius * 1.05, born: now, life: 420, colour: P.telegraph.slam });
        fx.burst(x, y, ev.hit ? 22 : 14, now, { outward: ev.radius });
        fx.shakeUntil = Math.max(fx.shakeUntil, now + 170);
      } else if (ev.type === "bossVolley") {
        const b = find(ev.id);
        if (b) { const c = at(b); fx.rings.push({ kind: "burst", x: c.x + 0.5, y: c.y + 0.5, r0: 0.6, r1: 1.8, born: now, life: 300, colour: P.telegraph.volley }); fx.burst(c.x + 0.5, c.y + 0.5, 10, now); }
      } else if (ev.type === "bossSummon") {
        for (const id of ev.adds ?? []) { const m = find(id); if (m) { const c = at(m); fx.rings.push({ kind: "burst", x: c.x + 0.5, y: c.y + 0.5, r0: 0.3, r1: 1.4, born: now, life: 520, colour: P.telegraph.summon }); fx.burst(c.x + 0.5, c.y + 0.5, 4, now, { sprite: "spark", rise: true }); } }
      } else if (ev.type === "bossPhase") { // the roar: two red rings sweep out of the boss and the screen shudders
        const b = find(ev.id);
        if (b) {
          const c = at(b);
          fx.rings.push({ kind: "levelup", x: c.x + 0.5, y: c.y + 0.5, r0: 0.6, r1: 5.5, born: now, life: 900, colour: "#ff4a3a" });
          fx.rings.push({ kind: "levelup", x: c.x + 0.5, y: c.y + 0.5, r0: 0.4, r1: 4, born: now + 180, life: 800, colour: "#ffd24a" });
          fx.burst(c.x + 0.5, c.y + 0.5, 24, now, { outward: 3 });
          fx.pillars.push({ x: c.x + 0.5, y: c.y + 0.5, born: now, life: 900 });
        }
        fx.shakeUntil = Math.max(fx.shakeUntil, now + 280);
      } else if (ev.type === "bossDefeated") { // the finale: paper rain from the ceiling for a few seconds, a golden ring and a burst where it fell
        const x = ev.tile.x + 0.5, y = ev.tile.y + 0.5;
        fx.victoryAt = now;
        fx.rings.push({ kind: "levelup", x, y, r0: 0.5, r1: 6, born: now, life: 1100, colour: "#ffd24d" });
        fx.rings.push({ kind: "levelup", x, y, r0: 0.3, r1: 4, born: now + 200, life: 900, colour: "#ffffff" });
        fx.burst(x, y, 30, now, { outward: 3 });
        fx.shakeUntil = Math.max(fx.shakeUntil, now + 200);
      } else if (ev.type === "floorEnter") {
        fx.victoryAt = -1e9;
        fx.parts.length = 0; fx.slashes.length = 0; fx.rings.length = 0; fx.impacts.length = 0; fx.pillars.length = 0; fx.proj.clear();
      }
    },
    /** Paper (or plus / spark) particles. opts: { outward: radius in tiles, sprite, rise }. */
    burst(x, y, n, now, opts = {}) {
      if (fx.lowFx) n = Math.ceil(n / 3);
      if (fx.parts.length > 160) return;
      for (let i = 0; i < n; i++) {
        const a = rng.next() * Math.PI * 2, out = opts.outward ? 60 + opts.outward * 50 : 0;
        fx.parts.push({
          x, y, ox: (rng.next() - 0.5) * 10, oy: (rng.next() - 0.5) * 6,
          vx: opts.outward ? Math.cos(a) * out * (0.6 + rng.next() * 0.5) : (rng.next() - 0.5) * 150,
          vy: opts.outward ? Math.sin(a) * out * 0.5 * (0.6 + rng.next() * 0.5) : 0,
          vz: opts.rise ? 40 + rng.next() * 50 : 70 + rng.next() * 100, z: opts.rise ? 4 + rng.next() * 14 : 20 + rng.next() * 12, grav: opts.rise ? -12 : 240,
          rot: rng.next() * 6.28, spin: opts.rise ? 0 : (rng.next() - 0.5) * 14, sprite: opts.chip ? "chip" : opts.sprite ?? "paper", col: opts.chip, born: now, life: opts.rise ? 700 + rng.next() * 300 : 480 + rng.next() * 320,
        });
      }
    },
    shake(now, z) {
      if (now >= fx.shakeUntil) { shk.x = 0; shk.y = 0; return shk; }
      const k = (fx.shakeUntil - now) / 140;
      shk.x = Math.sin(now * 0.09) * 3 * k * z; shk.y = Math.cos(now * 0.11) * 2 * k * z;
      return shk;
    },

    /** Rarity ring under a ground item (world pass, lit): none for normal, thin for magic, double for rare, notched with a white core for unique. */
    lootRing(g, gi, sx, sy, z, now) {
      const rarity = gi.rarity;
      if (gi.quest) { // quest item: a steady (reduced motion) or slowly pulsing yellow ring, dashed so it is not only a colour
        const rx = 15 * z, pulse = fx.reducedMotion ? 0.8 : 0.65 + 0.2 * Math.sin(now / 380 + sx);
        g.save(); g.lineJoin = "round"; g.beginPath(); g.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2);
        g.globalAlpha = 0.18; g.fillStyle = gi.color ?? "#f0e442"; g.fill();
        g.globalAlpha = pulse; g.lineWidth = Math.max(2, 2.2 * z * 0.6); g.strokeStyle = P.ink; g.stroke();
        g.setLineDash([5 * z, 3 * z]); g.lineWidth = Math.max(1.4, 1.4 * z * 0.6); g.strokeStyle = gi.color ?? "#f0e442"; g.stroke();
        g.restore();
        return;
      }
      if (gi.gold || !rarity || rarity === "normal") return;
      const col = P.rarity[rarity] ?? "#ffffff", rx = (rarity === "unique" ? 17 : rarity === "rare" ? 15 : 13) * z, ry = rx * 0.5, pulse = 0.65 + 0.2 * Math.sin(now / 380 + sx);
      g.save(); g.lineJoin = "round";
      g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      g.globalAlpha = 0.16; g.fillStyle = col; g.fill();
      g.globalAlpha = pulse; g.lineWidth = Math.max(1.6, (rarity === "unique" ? 2.6 : 1.8) * z * 0.6); g.strokeStyle = P.ink; g.stroke();
      g.lineWidth = Math.max(1.2, (rarity === "unique" ? 1.8 : 1.2) * z * 0.6); g.strokeStyle = col; g.stroke();
      if (rarity === "rare" || rarity === "unique") { g.beginPath(); g.ellipse(sx, sy, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2); g.lineWidth = Math.max(1, z * 0.6); g.stroke(); }
      if (rarity === "unique") { g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(1, 0.8 * z); g.beginPath(); g.ellipse(sx, sy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2); g.setLineDash([3 * z, 5 * z]); g.stroke(); g.setLineDash([]); }
      g.restore();
    },

    /** Flat effects on the floor: cast runes, Reply-All burst rings, heal rings, level-up rings. Called by the world pass before the actors. */
    drawGround(g, cam, atlas, now) {
      const z = cam.z;
      for (let i = fx.rings.length - 1; i >= 0; i--) if (now - fx.rings[i].born >= fx.rings[i].life) { fx.rings.splice(i, 1); }
      for (let i = 0; i < fx.rings.length; i++) {
        const r = fx.rings[i], k = (now - r.born) / r.life;
        if (k < 0) continue;
        const e = ease(Math.min(1, k)), rad = r.r0 + (r.r1 - r.r0) * e;
        project(cam, r.x, r.y, pos);
        const rx = rad * 45.25 * z, ry = rad * 22.6 * z;
        g.save();
        g.globalAlpha = Math.max(0, 1 - k * k);
        g.beginPath(); g.ellipse(pos.x, pos.y, rx, ry, 0, 0, Math.PI * 2);
        if (r.kind === "burst") { g.fillStyle = "rgba(255,179,107,0.18)"; g.fill(); }
        g.lineWidth = Math.max(3, (r.kind === "burst" ? 5 : 3) * z * 0.7); g.strokeStyle = P.ink; g.stroke();
        g.lineWidth = Math.max(1.6, (r.kind === "burst" ? 2.6 : 1.8) * z * 0.7); g.strokeStyle = r.colour;
        if (r.kind === "rune") g.setLineDash([6 * z, 4 * z]);
        g.lineDashOffset = -now / 40; g.stroke(); g.setLineDash([]);
        if (r.kind === "rune") { // inner ring and four ticks
          g.beginPath(); g.ellipse(pos.x, pos.y, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2); g.lineWidth = Math.max(1, z * 0.7); g.stroke();
          for (let t = 0; t < 4; t++) { const a = now / 200 + t * Math.PI / 2; g.beginPath(); g.moveTo(pos.x + Math.cos(a) * rx * 0.6, pos.y + Math.sin(a) * ry * 0.6); g.lineTo(pos.x + Math.cos(a) * rx * 1.1, pos.y + Math.sin(a) * ry * 1.1); g.stroke(); }
        }
        g.restore();
      }
      sk.drawGround(g, cam, now); // R5: zones, aura, shield back, typed rings; also refreshes fx.lights
    },

    /** Draw floaters, projectiles, loot beams / markers / plates, slashes, impacts and particles (screen space, above the lit world). */
    draw(g, cam, atlas, now, playerDir) {
      const z = cam.z, core = fx.core;
      // expire in place (no per-frame arrays)
      for (let i = fx.parts.length - 1; i >= 0; i--) if (now - fx.parts[i].born >= fx.parts[i].life) { fx.parts[i] = fx.parts[fx.parts.length - 1]; fx.parts.pop(); }
      for (let i = fx.slashes.length - 1; i >= 0; i--) if (now - fx.slashes[i].born >= 170) fx.slashes.splice(i, 1);
      for (let i = fx.impacts.length - 1; i >= 0; i--) if (now - fx.impacts[i].born >= fx.impacts[i].life) fx.impacts.splice(i, 1);
      for (let i = fx.pillars.length - 1; i >= 0; i--) if (now - fx.pillars[i].born >= fx.pillars[i].life) fx.pillars.splice(i, 1);

      if (core) { fx.drawLoot(g, cam, core, now); fx.drawProjectiles(g, cam, atlas, core, now); }

      const sprites = { paper: atlas.get(keys.fx("paper")), plus: atlas.get(keys.fx("plus")), spark: atlas.get(keys.fx("spark")) };
      for (let i = 0; i < fx.parts.length; i++) {
        const p = fx.parts[i], t = (now - p.born) / 1000, sp = sprites[p.sprite];
        project(cam, p.x, p.y, pos);
        const zz = p.z + p.vz * t - p.grav * t * t;
        g.globalAlpha = Math.max(0, Math.min(1, (p.life - (now - p.born)) / 200));
        g.save();
        g.translate(pos.x + (p.ox + p.vx * t) * z, pos.y - Math.max(0, zz) * z + (p.oy + p.vy * t) * z);
        g.rotate(p.rot + p.spin * t);
        if (p.sprite === "chip") { const cs = 3.2 * z; g.fillStyle = p.col; g.fillRect(-cs / 2, -cs / 2, cs, cs * 0.7); g.lineWidth = Math.max(1, z * 0.6); g.strokeStyle = "#0d0a1c"; g.strokeRect(-cs / 2, -cs / 2, cs, cs * 0.7); g.restore(); continue; }
        const k = p.sprite === "paper" ? 0.85 : 1.1;
        g.drawImage(sp.img, -sp.ox * z * k, -sp.oy * z * (p.sprite === "paper" ? 0.6 : k), sp.w * z * k, sp.h * z * (p.sprite === "paper" ? 0.6 : k));
        g.restore();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < fx.slashes.length; i++) {
        const sl = fx.slashes[i], e = atlas.get(keys.slash(playerDir)), k = Math.min(1, Math.max(0, (now - sl.born) / 170));
        project(cam, sl.x, sl.y, pos);
        if (!sl.skill) {
          g.globalAlpha = 1 - k;
          g.drawImage(e.img, pos.x - e.ox * z, pos.y - (sl.head * 0.55) * z - e.oy * z, e.w * z, e.h * z);
        }
        g.globalAlpha = 1 - k;
        if (k < 0.6) { // impact star on the first frames of the hit
          const cx = pos.x, cy = pos.y - sl.head * 0.55 * z, R = (7 + 11 * (1 - k / 0.6)) * z;
          g.beginPath();
          for (let a = 0; a < 16; a++) { const r = a & 1 ? R * 0.45 : R, an = a * Math.PI / 8; g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.9); }
          g.closePath(); g.fillStyle = "#fff6c8"; g.fill(); g.strokeStyle = "#ff9a2e"; g.lineWidth = Math.max(1.5, z * 1.2); g.stroke();
        }
      }
      g.globalAlpha = 1;
      for (let i = 0; i < fx.impacts.length; i++) fx.drawImpact(g, cam, fx.impacts[i], now);
      for (let i = 0; i < fx.pillars.length; i++) fx.drawPillar(g, cam, fx.pillars[i], now);
      sk.drawAir(g, cam, now, playerDir);
      if (core) fx.drawBossTelegraphs(g, cam, core, now);
      fx.drawConfetti(g, cam, now);
      if (core) { fx.drawLootPlates(g, cam, core, now); fx.drawFloaters(g, cam, core, now); } // ground labels sit above bursts and impacts, floaters above everything
    },


    /**
     * Boss telegraphs, read from state (m.boss.windup, progress t / total, smoothed with the frame alpha). Drawn in the screen pass, so the darkness mask
     * never hides them. Three shapes, so they read without colour: slam = a ground circle with diagonal hatching that FILLS from the centre;
     * volley = a fan of five dashed lanes with arrow heads and a wedge that fills outward from the boss; summon = a ring on the floor with a
     * shell of rising chevrons (a cylinder that grows upward). The colours are Okabe-Ito vermillion, yellow and sky blue on an ink outline.
     */
    drawBossTelegraphs(g, cam, core, now) {
      const mons = core.monsters, z = cam.z;
      for (let i = 0; i < mons.length; i++) {
        const m = mons[i], w = m.boss?.windup;
        if (!w || m.ai === "dead") continue;
        const live = w.t < w.total, after = w.t - w.total; // after: ticks since it landed
        if (!live && (w.kind !== "slam" || after > 8)) continue;
        const p = live ? Math.min(1, (w.t + fx.alpha) / w.total) : 1, fade = live ? 1 : 1 - after / 8, hot = live && p > 0.8 && (fx.reducedMotion || Math.floor(now / FLASH_HALF_MS) % 2 === 0);
        g.save(); g.globalAlpha = fade; g.lineJoin = "round"; g.lineCap = "round";
        if (w.kind === "slam") fx.telegraphSlam(g, cam, w, p, hot, now, z);
        else if (w.kind === "volley") fx.telegraphVolley(g, cam, m, w, p, hot, now, z);
        else fx.telegraphSummon(g, cam, m, w, p, hot, now, z);
        g.restore();
      }
    },
    telegraphSlam(g, cam, w, p, hot, now, z) {
      const col = P.telegraph.slam, ink = P.telegraph.edge;
      project(cam, w.tile.x + 0.5, w.tile.y + 0.5, pos);
      const cx = pos.x, cy = pos.y, rx = w.radius * 45.25 * z, ry = w.radius * 22.6 * z;
      // the filled part: grows from the centre to the edge; hatched so it is not only a colour
      const fr = Math.max(0.04, p);
      g.beginPath(); g.ellipse(cx, cy, rx * fr, ry * fr, 0, 0, Math.PI * 2);
      const a0 = g.globalAlpha;
      g.fillStyle = col; g.globalAlpha = a0 * (0.26 + 0.3 * p); g.fill(); g.globalAlpha = a0;
      g.save(); g.clip();
      g.strokeStyle = ink; g.lineWidth = Math.max(1.4, 1.5 * z); g.globalAlpha = a0 * 0.55;
      const step = 9 * z;
      for (let x = cx - rx - ry * 2; x < cx + rx + ry * 2; x += step) { g.beginPath(); g.moveTo(x, cy + ry * 1.1); g.lineTo(x + ry * 2.2, cy - ry * 1.1); g.stroke(); }
      g.restore();
      // the final extent: ink under colour; solid and white-edged in the last moments, dashed before
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.lineWidth = Math.max(4, 4.4 * z); g.strokeStyle = ink; g.setLineDash(p > 0.8 ? [] : [10 * z, 6 * z]); g.stroke();
      g.lineWidth = Math.max(2.2, 2.4 * z); g.strokeStyle = hot ? "#ffffff" : col; g.stroke(); g.setLineDash([]);
      // the leading edge of the fill and a crosshair on the point of impact
      g.beginPath(); g.ellipse(cx, cy, rx * fr, ry * fr, 0, 0, Math.PI * 2); g.lineWidth = Math.max(1.6, 1.8 * z); g.strokeStyle = "#fff6e0"; g.stroke();
      g.lineWidth = Math.max(3, 3 * z); g.strokeStyle = ink;
      for (const pass of [0, 1]) { g.strokeStyle = pass ? "#fff6e0" : ink; g.lineWidth = pass ? Math.max(1.4, 1.5 * z) : Math.max(3, 3.2 * z); g.beginPath(); g.moveTo(cx - 9 * z, cy - 4.5 * z); g.lineTo(cx + 9 * z, cy + 4.5 * z); g.moveTo(cx - 9 * z, cy + 4.5 * z); g.lineTo(cx + 9 * z, cy - 4.5 * z); g.stroke(); }
    },
    telegraphVolley(g, cam, m, w, p, hot, now, z) {
      const cfg = config.boss.volley, col = P.telegraph.volley, ink = P.telegraph.edge, n = cfg.shots, half = (n - 1) / 2, R = Math.min(cfg.range, 9);
      actorPos(m, pos2); project(cam, pos2.x + 0.5, pos2.y + 0.5, pos);
      const ox = pos.x, oy = pos.y - 18 * z, cs = Math.sqrt(1 - cfg.spread * cfg.spread);
      const tip = (k, r) => { // the end of lane k at distance r (tiles): rotate the aim by k steps, then project
        let dx = w.dir.x, dy = w.dir.y;
        for (let s = 0; s < Math.abs(k); s++) { const sn = cfg.spread * Math.sign(k), nx = dx * cs - dy * sn, ny = dx * sn + dy * cs; dx = nx; dy = ny; }
        project(cam, pos2.x + 0.5 + dx * r, pos2.y + 0.5 + dy * r, pos); return pos;
      };
      const tx0 = tip(-half, R).x, ty0 = tip(-half, R).y, tx1 = tip(half, R).x, ty1 = tip(half, R).y;
      // wedge: fills outward from the boss to p * R along every lane
      const ex0 = ox + (tx0 - ox) * p, ey0 = oy + (ty0 - oy) * p, ex1 = ox + (tx1 - ox) * p, ey1 = oy + (ty1 - oy) * p;
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex0, ey0); g.lineTo(ex1, ey1); g.closePath();
      g.fillStyle = col; const a0 = g.globalAlpha; g.globalAlpha = a0 * (0.16 + 0.22 * p); g.fill(); g.globalAlpha = a0;
      // outline of the full fan
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx0, ty0); g.lineTo(tx1, ty1); g.closePath(); g.lineWidth = Math.max(1.5, 1.6 * z); g.strokeStyle = ink; g.globalAlpha = a0 * 0.6; g.stroke(); g.globalAlpha = a0;
      for (let k = -half; k <= half; k++) {
        const t = tip(k, R), lx = t.x, ly = t.y;
        g.setLineDash([12 * z, 8 * z]); g.lineDashOffset = fx.reducedMotion ? 0 : -now * 0.05 * z;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(lx, ly); g.lineWidth = Math.max(4, 4.4 * z); g.strokeStyle = ink; g.stroke();
        g.lineWidth = Math.max(2, 2.2 * z); g.strokeStyle = hot ? "#ffffff" : col; g.stroke(); g.setLineDash([]);
        // arrow head at the lane's end (shape cue)
        const ang = Math.atan2(ly - oy, lx - ox), ah = 10 * z;
        g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx - Math.cos(ang - 0.45) * ah, ly - Math.sin(ang - 0.45) * ah); g.lineTo(lx - Math.cos(ang + 0.45) * ah, ly - Math.sin(ang + 0.45) * ah); g.closePath();
        g.fillStyle = col; g.fill(); g.lineWidth = Math.max(1.4, 1.5 * z); g.strokeStyle = ink; g.stroke();
      }
    },
    telegraphSummon(g, cam, m, w, p, hot, now, z) {
      const col = P.telegraph.summon, ink = P.telegraph.edge, R = 3;
      actorPos(m, pos2); project(cam, pos2.x + 0.5, pos2.y + 0.5, pos);
      const cx = pos.x, cy = pos.y, rx = R * 45.25 * z, ry = R * 22.6 * z, H = 54 * z * p;
      // floor ring (dotted) and the filled disc under it
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); const a0 = g.globalAlpha; g.fillStyle = col; g.globalAlpha = a0 * (0.1 + 0.14 * p); g.fill(); g.globalAlpha = a0;
      g.setLineDash([2 * z, 7 * z]); g.lineWidth = Math.max(4, 4.4 * z); g.strokeStyle = ink; g.stroke(); g.lineWidth = Math.max(2.4, 2.6 * z); g.strokeStyle = hot ? "#ffffff" : col; g.stroke(); g.setLineDash([]);
      // the shell: eight uprights from the floor ring to the rising top ring, and the top ring
      for (let k = 0; k < 12; k++) { const an = (k / 12) * Math.PI * 2 + now / 3000, x = cx + Math.cos(an) * rx, y = cy + Math.sin(an) * ry; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - H); g.lineWidth = Math.max(3, 3 * z); g.strokeStyle = ink; g.stroke(); g.lineWidth = Math.max(1.4, 1.4 * z); g.strokeStyle = col; g.stroke(); }
      g.beginPath(); g.ellipse(cx, cy - H, rx, ry, 0, 0, Math.PI * 2); g.lineWidth = Math.max(3.4, 3.6 * z); g.strokeStyle = ink; g.stroke(); g.lineWidth = Math.max(2, 2.2 * z); g.strokeStyle = col; g.stroke();
      // up-chevrons stacked in the middle: "something is coming up"
      for (let k = 0; k < 3; k++) {
        const ph = ((now / 700) + k / 3) % 1, y = cy - ph * H * 1.1, al = Math.sin(ph * Math.PI);
        g.globalAlpha = a0 * al; g.beginPath(); g.moveTo(cx - 12 * z, y + 4 * z); g.lineTo(cx, y - 4 * z); g.lineTo(cx + 12 * z, y + 4 * z);
        g.lineWidth = Math.max(4, 4 * z); g.strokeStyle = ink; g.stroke(); g.lineWidth = Math.max(2, 2.2 * z); g.strokeStyle = "#ffffff"; g.stroke();
      }
      g.globalAlpha = a0;
    },

    /** Paper rain from the ceiling after the boss falls: ~8 s of confetti and loose pages (screen space, above the world, under the labels). */
    drawConfetti(g, cam, now) {
      const t0 = now - fx.victoryAt;
      if (t0 < 0 || t0 > 9200) return;
      if (fx.reducedMotion) return; // no golden flash and no falling confetti: the victory screen carries the news
      const n = fx.lowFx ? 70 : 230, W = cam.w, H = cam.h, COL = CONFETTI;
      if (t0 < 420) { g.fillStyle = `rgba(255,226,150,${0.22 * (1 - t0 / 420)})`; g.fillRect(0, 0, W, H); } // a brief golden flash as the boss falls
      for (let i = 0; i < n; i++) {
        const h1 = hash01(i * 3 + 1), h2 = hash01(i * 3 + 2), h3 = hash01(i * 3 + 3);
        const delay = h1 * h1 * 4200, life = 3000 + h2 * 1800, age = t0 - delay;
        if (age < 0 || age > life) continue;
        const k = age / life, x = h3 * W + Math.sin(age / 520 + i) * 26 * cam.z, y = -24 + k * (H + 70), spin = age / 180 + i, flat = Math.abs(Math.cos(spin * 0.9));
        const paper = i % 5 === 0, sz = (paper ? 18 : 11 + h2 * 6) * Math.max(1, cam.z * 0.8);
        g.save(); g.globalAlpha = Math.min(1, age / 200, (life - age) / 350 + 0.1);
        g.translate(x, y); g.rotate(spin * 0.6);
        if (paper) { g.fillStyle = "#f4efe0"; g.fillRect(-sz * 0.5, -sz * 0.65 * flat, sz, sz * 1.3 * flat); g.fillStyle = "rgba(13,10,28,0.45)"; for (let l = 0; l < 3; l++) g.fillRect(-sz * 0.36, (-0.4 + l * 0.32) * sz * flat, sz * 0.72, Math.max(1, sz * 0.06)); }
        else { g.fillStyle = COL[i % COL.length]; g.fillRect(-sz * 0.5, -sz * 0.28 * flat - 0.5, sz, sz * 0.56 * flat + 1); }
        g.restore();
      }
    },

    /** Does this rectangle cover the body of a live enemy or NPC (sprite spans ~34 px across, feet to head)? Loot tags keep off bodies. */
    onBody(r, z) {
      const list = fx.bodies;
      if (!list) return false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead || a.hid || a.sx < r.x - 20 * z || a.sx > r.x + r.w + 20 * z) continue;
        const head = (style.dims[a.type]?.head ?? 50) * z;
        if (r.x < a.sx + 16 * z && a.sx - 16 * z < r.x + r.w && r.y < a.sy && a.sy - head < r.y + r.h) return true;
      }
      return false;
    },

    /** Does this rectangle touch the head of a live enemy or NPC, with 4 px of padding? Never relaxed: a loot tag may cover a body for a rare item, but not a face. */
    onHead(r, z) {
      const list = fx.bodies;
      if (!list) return false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead || a.hid || a.sx < r.x - 20 * z - 4 || a.sx > r.x + r.w + 20 * z + 4) continue;
        const top = a.sy - (style.dims[a.type]?.head ?? 50) * z; // head top; the head is about 26 logical px tall
        if (r.x < a.sx + 15 * z + 4 && a.sx - 15 * z - 4 < r.x + r.w && r.y < top + 26 * z + 4 && top - 4 < r.y + r.h) return true;
      }
      return false;
    },

    /** Is this rectangle on a claimed label (plates, pips, loot plates) or leader line? Used by the loot-plate and floater placement. */
    blocked(r) {
      const av = fx.avoid, sg = fx.avoidSegs, pl = fx.platesPlaced;
      for (let i = 0; i < av.length; i++) if (rectHit(r, av[i])) return true;
      for (let i = 0; i < sg.length; i++) if (segHitsRect(sg[i], r)) return true;
      if (pl) for (let i = 1; i < pl.length; i++) if (rectHit(r, pl[i])) return true; // [0] is the hero rect
      return false;
    },

    /** Floaters come from state.floaters only. Position/age/stack rows are derived each frame, so there is nothing to keep in sync. */
    drawFloaters(g, cam, core, now) {
      const list = core.floaters, z = cam.z;
      if (!list || list.length === 0) return;
      stackRows(list, rows);
      let nf = 0;
      const frHit = (r) => { for (let j = 0; j < nf; j++) if (rectHit(r, fl[j])) return true; return false; };
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      for (let i = 0; i < list.length; i++) {
        const f = list[i], age = (config.floaterTicks - f.life + fx.alpha) * TICK_MS, t = Math.min(1, Math.max(0, age / FLOATER_MS));
        if (f.life <= 0) continue;
        const toPlayer = f.target === "player", miss = f.kind === "miss", heal = f.kind === "heal", e = ease(t);
        const mon = toPlayer ? null : core.monsters.find((m) => m.id === f.target);
        const head = style.dims[toPlayer ? fx.heroType : mon?.type]?.head ?? 50;
        project(cam, f.tile.x + 0.5, f.tile.y + 0.5, pos);
        const pop = (1 + 0.9 * Math.max(0, 1 - t / 0.14)) * (f.kind === "crit" ? 1.35 : 1);
        const fs = Math.max(miss ? 15 : 30, Math.round((miss ? 10 : 21) * z * pop));
        // spawns above the head and clear of the nameplate, then drifts up (right for monsters, left for the hero); stacked rows sit higher
        const side = toPlayer ? -1 : 1, x = pos.x + side * Math.max((toPlayer ? 62 : 40) * z, 88) + side * 16 * e * z, y = pos.y - (head + 10 + 32 * e + rows[i] * 24) * z;
        const text = miss ? S.miss : heal ? `+${f.value}` : f.kind === "crit" ? `${f.value}!` : String(f.value); // crit: a "!" so it never relies on size or colour alone
        g.font = fontFor(fs);
        // own lane: never on a nameplate, health pip, ground-item label or leader line; lift in steps, then try the other side
        const tw = g.measureText(text).width + 8, th = fs * 1.15, fr = fr0;
        let fy = y, fxx = x;
        for (let tries = 0; tries < 9; tries++) {
          fr.x = fxx - tw / 2; fr.y = fy - th / 2; fr.w = tw; fr.h = th;
          if (!fx.blocked(fr) && !frHit(fr)) break;
          if (tries === 5) { fxx = pos.x - side * Math.max((toPlayer ? 62 : 40) * z, 88) - side * 16 * e * z; fy = y; } else fy -= th * 0.7;
        }
        const done = fl[nf] ?? (fl[nf] = { x: 0, y: 0, w: 0, h: 0 }); done.x = fr.x; done.y = fr.y; done.w = fr.w; done.h = fr.h; nf++;
        g.globalAlpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
        g.lineWidth = Math.max(4, fs * 0.32); g.strokeStyle = P.ink; g.strokeText(text, fxx, fy);
        if (!miss) { g.lineWidth = Math.max(2, fs * 0.12); g.strokeStyle = heal ? "#1f8a4a" : toPlayer ? "#e0363f" : "#ff6a2a"; g.strokeText(text, fxx, fy); }
        const tc = !miss && !heal && !toPlayer ? FLOAT_COL[f.dmgType ?? f.damageType ?? f.type] : null; // per damage type (R5); undefined types keep the classic yellow
        g.fillStyle = miss ? "#c9c3ec" : heal ? "#c8ffd4" : toPlayer ? "#ffd0d4" : tc ?? "#fff3a0"; g.fillText(text, fxx, fy);
      }
      g.globalAlpha = 1;
    },

    /** Projectiles in flight: a ground shadow and the sprite at 16 px height, rotated along the flight (screen) direction. */
    drawProjectiles(g, cam, atlas, core, now) {
      const list = core.projectiles, z = cam.z;
      if (!list || list.length === 0) return;
      for (let i = 0; i < list.length; i++) {
        const pr = list[i], back = 1 - fx.alpha;
        const wx = pr.pos.x - pr.dir.x * pr.speed * back, wy = pr.pos.y - pr.dir.y * pr.speed * back;
        let last = fx.proj.get(pr.id);
        if (!last) fx.proj.set(pr.id, last = { x: 0, y: 0, kind: pr.kind });
        last.x = wx; last.y = wy;
        project(cam, wx + 0.5, wy + 0.5, pos);
        if (pos.x < -80 || pos.x > cam.w + 80 || pos.y < -80 || pos.y > cam.h + 80) continue;
        const e = atlas.get(keys.proj(pr.kind));
        if (!e) continue;
        const lift = (pr.kind === "toner" ? 18 : 16) * z;
        if (TRAIL[pr.kind] && !pr.hostile) { // a fading trail of the last few steps behind the shot (screen space, follows the flight line)
          const tc = TRAIL[pr.kind], step = Math.min(1.6, pr.speed * 3);
          g.save(); g.lineCap = "round";
          for (let s2 = 4; s2 >= 1; s2--) {
            project(cam, wx - pr.dir.x * step * s2 + 0.5, wy - pr.dir.y * step * s2 + 0.5, pos2); project(cam, wx - pr.dir.x * step * (s2 - 1) + 0.5, wy - pr.dir.y * step * (s2 - 1) + 0.5, pos);
            g.globalAlpha = 0.5 - s2 * 0.1; g.lineWidth = (7 - s2) * z * 0.8; g.strokeStyle = tc; g.beginPath(); g.moveTo(pos2.x, pos2.y - lift); g.lineTo(pos.x, pos.y - lift); g.stroke();
          }
          g.restore(); project(cam, wx + 0.5, wy + 0.5, pos);
        }
        g.globalAlpha = 0.5; g.fillStyle = "#000"; g.beginPath(); g.ellipse(pos.x, pos.y, 8 * z, 3.6 * z, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        const ang = Math.atan2((pr.dir.x + pr.dir.y) * 16, (pr.dir.x - pr.dir.y) * 32);
        g.save(); g.translate(pos.x, pos.y - lift);
        if (pr.kind === "stapler") g.rotate(ang + Math.sin(now / 50) * 0.45);                 // tumbles
        else if (pr.kind === "slide") { g.rotate(ang); g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(now / 70 + pr.pos.x))); } // flutters
        else if (pr.kind === "card") g.rotate(fx.reducedMotion ? ang : now / 55 + pr.pos.x * 3);                 // spins like a thrown card
        else if (pr.kind === "paper") g.rotate(fx.reducedMotion ? ang : ang + now / 90);                           // a tumbling ball
        else if (pr.kind === "bolt" || pr.kind === "zap" || pr.kind === "shard") { g.rotate(ang); if (!fx.reducedFlash && pr.kind !== "shard") g.scale(1 + 0.12 * Math.sin(now / 38), 1 + 0.12 * Math.sin(now / 31)); }
        else { g.rotate(ang); if (pr.hostile) { g.globalAlpha = 0.4 + 0.2 * Math.sin(now / 90); g.fillStyle = P.proj.tonerGlow; g.beginPath(); g.arc(0, 0, 11 * z, 0, 6.3); g.fill(); g.globalAlpha = 1; } }
        g.drawImage(e.img, -e.ox * z, -e.oy * z, e.w * z, e.h * z);
        g.restore();
      }
      if (fx.proj.size > 64) fx.proj.clear();
    },

    /** Muzzle flashes and impact splats for projectiles (toner splat, stapler sparks; slide impact shows as paper particles). */
    drawImpact(g, cam, im, now) {
      const z = cam.z, k = Math.min(1, Math.max(0, (now - im.born) / im.life)); // stepped ticks can draw an effect before its birth time
      project(cam, im.x, im.y, pos);
      const cx = pos.x, cy = pos.y - im.z * z;
      g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.lineJoin = "round"; g.lineCap = "round";
      if (im.mode === "muzzle") {
        const newKind = MUZZLE[im.kind] && im.kind !== "slide", R = (newKind ? 4 + 4 * k : 5 + 5 * k) * z;
        if (newKind) g.globalAlpha *= 0.5; // R5 shots: a light flash, so the caster's body stays readable
        g.fillStyle = im.kind === "toner" ? P.proj.tonerGlow : MUZZLE[im.kind] ?? "#e8eef8";
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, R * 0.45, 0, Math.PI * 2); g.fill();
      } else if (im.kind === "toner") { // black ink splat with magenta rim and flying droplets
        const R = (6 + 8 * ease(Math.min(1, k * 2))) * z;
        g.fillStyle = P.proj.toner; g.strokeStyle = P.proj.tonerGlow; g.lineWidth = Math.max(1.5, 1.4 * z * 0.6);
        g.beginPath();
        for (let a = 0; a < 14; a++) { const an = (a / 14) * Math.PI * 2, rr = R * (a & 1 ? 0.62 : 1.0 + ((a * 37) % 5) * 0.06); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.75); }
        g.closePath(); g.fill(); g.stroke();
        for (let a = 0; a < 7; a++) { const an = a * 0.9 + 0.3, d = R * (1.3 + k * 1.4); g.beginPath(); g.arc(cx + Math.cos(an) * d, cy + Math.sin(an) * d * 0.75 + k * 10 * z, (2.2 - k) * z, 0, Math.PI * 2); g.fill(); }
        if (im.mode === "wall" || im.mode === "range") { g.globalAlpha *= 0.5; g.beginPath(); g.ellipse(cx, cy + im.z * z, R * 1.3, R * 0.55, 0, 0, Math.PI * 2); g.fill(); }
      } else if (im.kind === "shard" || im.kind === "bolt" || im.kind === "zap") { // ice burst / electric spark star
        const ice = im.kind === "shard", n = ice ? 7 : 9, R0 = (4 + 5 * k) * z, R1 = (10 + 18 * ease(Math.min(1, k * 1.4))) * z;
        for (let a = 0; a < n; a++) {
          const an = a * (Math.PI * 2 / n) + 0.3, rr = R1 * (a & 1 ? 0.65 : 1);
          if (ice) { g.beginPath(); g.moveTo(cx + Math.cos(an - 0.18) * R0, cy + Math.sin(an - 0.18) * R0 * 0.8); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.8); g.lineTo(cx + Math.cos(an + 0.18) * R0, cy + Math.sin(an + 0.18) * R0 * 0.8); g.closePath(); g.fillStyle = "#d8f8ff"; g.fill(); g.lineWidth = Math.max(1.2, 1.3 * z * 0.7); g.strokeStyle = INK_FX; g.stroke(); }
          else { g.beginPath(); g.moveTo(cx + Math.cos(an) * R0, cy + Math.sin(an) * R0 * 0.8); g.lineTo(cx + Math.cos(an + 0.3) * (R0 + rr) * 0.5, cy + Math.sin(an + 0.3) * (R0 + rr) * 0.4); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.8); g.lineWidth = Math.max(1.6, 2 * z * 0.7); g.strokeStyle = a & 1 ? "#6fe8ff" : "#ffffff"; g.stroke(); }
        }
        if (ice) { ell0(g, cx, cy, R1 * 0.8, R1 * 0.45); g.lineWidth = Math.max(1.4, 1.6 * z * 0.7); g.strokeStyle = "#e4fbff"; g.stroke(); }
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy, (4 - 3 * k) * z, 0, Math.PI * 2); g.fill();
      } else if (im.kind === "pen" || im.kind === "card" || im.kind === "paper" || im.kind === "sealed") { // a few paper flecks
        for (let a = 0; a < 6; a++) { const an = a * 1.05 + 0.2, d = (4 + 14 * ease(Math.min(1, k * 1.3))) * z; g.save(); g.translate(cx + Math.cos(an) * d, cy + Math.sin(an) * d * 0.7 + k * 8 * z); g.rotate(an * 3 + k * 6); g.fillStyle = im.kind === "pen" ? "#8fb0ff" : im.kind === "sealed" ? "#ff9a9a" : "#fdf6e4"; g.fillRect(-2.2 * z, -1.5 * z, 4.4 * z, 3 * z); g.restore(); }
      } else if (im.kind === "stapler") { // metal sparks
        for (let a = 0; a < 9; a++) {
          const an = a * 0.7 + 0.2, d0 = (3 + 5 * k) * z, d1 = (8 + 16 * ease(Math.min(1, k * 1.4))) * z;
          g.strokeStyle = a % 3 ? "#e8eef8" : "#ffd24d"; g.lineWidth = Math.max(1.4, 1.5 * z * 0.6);
          g.beginPath(); g.moveTo(cx + Math.cos(an) * d0, cy + Math.sin(an) * d0 * 0.8); g.lineTo(cx + Math.cos(an) * d1, cy + Math.sin(an) * d1 * 0.8 + k * 8 * z); g.stroke();
        }
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy, (4 - 3 * k) * z, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    },

    /** Level-up pillar of light with rising edges. */
    drawPillar(g, cam, pl, now) {
      const z = cam.z, k = Math.min(1, Math.max(0, (now - pl.born) / pl.life));
      project(cam, pl.x, pl.y, pos);
      const w = (26 + 10 * Math.sin(k * 6)) * z * (1 - k * 0.5), h = 190 * z * Math.min(1, k * 4);
      const grad = g.createLinearGradient(0, pos.y, 0, pos.y - h);
      grad.addColorStop(0, "rgba(255,226,120,0.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
      g.save(); g.globalAlpha = Math.max(0, 1 - k) * 0.8; g.fillStyle = grad;
      g.fillRect(pos.x - w / 2, pos.y - h, w, h);
      g.globalAlpha = Math.max(0, 1 - k) * 0.45; g.fillStyle = "#fff6c8"; g.fillRect(pos.x - w * 0.08, pos.y - h * 0.9, w * 0.16, h * 0.9);
      g.restore();
    },

    /**
     * Ground items above the darkness: a beam (magic and up), a marker of at least 16 px with a rarity shape and a plate. Plates are shown for
     * items near the hero (any rarity) and for rare / unique items in sight, at most MAX_PLATES, never overlapping each other, the hero, an
     * enemy body or the screen edge. CR-14: the per-item records, both sort orders and the plate rects are reused between frames; the orders
     * are rebuilt only when the item set or the hero tile changes, so a steady frame allocates nothing here.
     */
    drawLoot(g, cam, core, now) {
      const lt = fx.lt ?? (fx.lt = newLootState());
      const placed = fx.platesPlaced ?? (fx.platesPlaced = []);
      placed.length = 0; lt.vis = 0;
      drawNpcMarkers(g, cam, core, fx.bodies, fx.npcMarkers ?? (fx.npcMarkers = []), style, fx.reducedMotion, now); // R7-0.7 quest markers over the Lobby NPCs
      const list = core.groundItems, z = cam.z;
      if (!list || list.length === 0) return;
      const hero = core.player, hx = hero.tile.x, hy = hero.tile.y, size = Math.max(16, Math.round(6.5 * z)), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fs = Math.max(11, Math.min(14, Math.round(z * 3.4)));
      lootSync(lt, P, list, hx, hy);
      // keep plates off the hero's body (placed first, so every plate shifts around it): the drawn (interpolated) hero position, not the logical tile
      const hs = fx.heroS, hr = lt.hero, hh = ((style.dims[fx.heroType]?.head ?? 54) + 6) * z;
      if (hs) { hr.x = hs.x; hr.y = hs.y; } else { project(cam, hx + 0.5, hy + 0.5, pos2); hr.x = pos2.x; hr.y = pos2.y; }
      hr.x -= 27 * z; hr.y -= hh; hr.w = 54 * z; hr.h = hh + 5 * z;
      placed.push(hr);
      const order = lt.order, n = order.length;
      // pass 1: beams (under everything else of the loot layer), pass 2: markers, pass 3 (drawLootPlates): plates
      let overHero = false;
      for (let i = 0; i < n; i++) {
        const e = order[i], gi = e.gi;
        project(cam, gi.tile.x + 0.5, gi.tile.y + 0.5, pos);
        e.on = !(pos.x < -60 || pos.x > cam.w + 60 || pos.y < -140 * z || pos.y > cam.h + 60);
        e.x = pos.x; e.my = pos.y - 14 * z - (gi.rarity === "unique" ? Math.sin(now / 400) * 1.5 * z : 0);
        if (e.on) {
          lt.vis++;
          if (gi.quest) beam(g, "magic", e.colour, pos.x, pos.y - 4 * z, z, now); // a thin beam so the item is found from across the room
          else if (gi.rarity) {
            beam(g, gi.rarity, e.colour, pos.x, pos.y - 4 * z, z, now);
            const bw = (gi.rarity === "magic" ? 2 : gi.rarity === "rare" ? 4.5 : 7) * z, bh = (gi.rarity === "magic" ? 52 : gi.rarity === "rare" ? 80 : 110) * z;
            if (pos.x + bw > hr.x && pos.x - bw < hr.x + hr.w && pos.y - 4 * z > hr.y && pos.y - 4 * z - bh < hr.y + hr.h) overHero = true;
          }
        }
      }
      if (overHero && fx.heroRedraw) fx.heroRedraw(g); // N3: a beam never crosses the hero's body: he is drawn over it
      for (let i = 0; i < n; i++) {
        const e = order[i];
        if (e.on) { if (e.gi.quest) drawQuestSign(g, e.x, e.my, size * 1.1, e.colour, P.ink); else marker(g, P, e.gi, e.x, e.my, size * (e.gi.rarity === "unique" ? 1.15 : 1), e.colour); }
      }
      lt.size = size; lt.fs = fs; lt.dpr = dpr; lt.hc = !!fx.hc;
    },

    /** Ground-item plates (after the burst / impact layer): kept off nameplates, health pips, leader lines, the hero, enemy bodies and each other. */
    drawLootPlates(g, cam, core, now) {
      const lt = fx.lt;
      if (!lt || lt.vis === 0 || !core.groundItems?.length) return;
      const placed = fx.platesPlaced, size = lt.size, fs = lt.fs, dpr = lt.dpr, hc = lt.hc, order = lt.order, prio = lt.prio, R = lt.r, hover = fx.hoverLootId;
      let plates = 0, crowd = 0, hov = null;
      for (let i = 0; i < order.length; i++) { const e = order[i]; e.near = false; if (e.on && e.d <= CROWD_R) crowd++; if (e.on && e.gi.id === hover) hov = e; }
      let nearN = 0;
      if (crowd > CROWD_LOOT && !fx.showAllLoot) { // a pile: tags for the nearest few only (the rest show on hover or Alt); `order` is sorted by distance, so no sort is needed
        for (let i = 0; i < order.length && nearN < CROWD_CAP; i++) { const e = order[i]; if (e.on && (e === hov || (!e.gi.gold && ((e.rank === 2 && e.d <= PLATE_NEAR) || (e.rank >= 3 && e.d <= PLATE_FAR))))) { e.near = true; nearN++; } }
      }
      const cap = fx.showAllLoot ? 2 * MAX_PLATES : nearN ? CROWD_CAP : MAX_PLATES;
      // most valuable first (the hovered entry before all), so the cap never drops a rare for a pile of commons
      for (let i = -1; i < prio.length; i++) {
        const e = i < 0 ? hov : prio[i];
        if (!e || !e.on || (i >= 0 && e === hov)) continue;
        // labels: common items (and gold) only on hover or while Alt is held (genre convention); magic near the hero; rare / unique in sight
        const show = fx.showAllLoot || e === hov || (!e.gi.gold && ((e.rank === 2 && e.d <= PLATE_NEAR) || (e.rank >= 3 && e.d <= PLATE_FAR)));
        if (!show || plates >= cap) continue;
        if (nearN && !e.near && e !== hov) continue;
        let sp = e.sp;
        if (!sp || e.sfs !== fs || e.shc !== hc || e.sdpr !== dpr) { const gi = e.gi; sp = e.sp = plateSprite(P, gi.label, gi.rarity ?? "normal", gi.border === "none" ? "plain" : gi.border ?? "plain", e.colour, fs, hc, dpr); e.sfs = fs; e.shc = hc; e.sdpr = dpr; }
        R.w = sp.w; R.h = sp.h;
        const bx = Math.round(Math.min(cam.w - SAFE_ - sp.w, Math.max(SAFE_, e.x - sp.w / 2))), by = Math.round(e.my - size / 2 - 4 - sp.h);
        const relax = e === hov || e.rank >= 3; // pass 1 (no free spot found) may cover an enemy body, but only for a rare, a unique or the hovered item; never the hero or another label
        let ok = false, py = by;
        for (let pass = 0; pass < 2 && !ok; pass++) {
          if (pass === 1 && !relax) break;
          py = by;
          for (let k = 0; k < 7 && !ok; k++) {
            const y = k < 4 ? by - k * (sp.h + LOOT_GAP) : k === 4 ? Math.round(e.my + size / 2 + 4) : py + sp.h + LOOT_GAP;
            py = y;
            let x = bx, hit = plateFree(fx, placed, R, x, y, pass === 0, cam);
            if (hit === 0) { ok = true; }
            else if (hit > 0) { // blocked by another label (or the hero): slide sideways past it by the smallest step, at most the plate's own width + 6 px
              const b = placed[hit - 1], xr = Math.round(b.x + b.w + LOOT_GAP + 1), xl = Math.round(b.x - sp.w - LOOT_GAP - 1), first = Math.abs(xr - bx) <= Math.abs(xl - bx) ? xr : xl, second = first === xr ? xl : xr;
              if (Math.abs(first - bx) <= sp.w + 6 && plateFree(fx, placed, R, first, y, pass === 0, cam) === 0) { ok = true; x = first; }
              else if (Math.abs(second - bx) <= sp.w + 6 && plateFree(fx, placed, R, second, y, pass === 0, cam) === 0) { ok = true; x = second; }
            }
            if (ok) { R.x = x; R.y = y; }
          }
        }
        if (!ok) continue;
        const pr = lt.pp[plates] ?? (lt.pp[plates] = { x: 0, y: 0, w: 0, h: 0 });
        pr.x = R.x; pr.y = R.y; pr.w = R.w; pr.h = R.h;
        placed.push(pr);
        plates++;
        g.drawImage(sp.c, R.x, R.y, sp.w, sp.h);
      }
    },

    /**
     * Low-HP warning (below 30%): a pulsing red edge vignette. Returns the pulse 0..1 (0 when healthy); `fx.lowHp` is the state the
     * shell reads to emit the bus hooks "ui:lowhp" (state change) and "ui:heartbeat" (one per pulse peak; audio subscribes in S3).
     */
    drawLowHp(g, w, h, now, ratio, bus) {
      const low = ratio > 0 && ratio < 0.3;
      if (low !== fx.lowHp) { fx.lowHp = low; bus?.emit({ type: "ui:lowhp", low, ratio }); }
      if (!low) { fx.beat = -1; return 0; }
      const period = lowHpPeriod(ratio), phase = (now % period) / period, beat = Math.floor(now / period);
      if (beat !== fx.beat) { fx.beat = beat; bus?.emit({ type: "ui:heartbeat", ratio, period }); }
      const pulse = Math.max(0, 1 - phase * 2.2) ** 2; // sharp thump then fade
      fx.ensureVignette(w, h);
      g.globalAlpha = (fx.reducedMotion ? 0.5 : Math.min(1, 0.35 + 0.65 * pulse)) * (fx.lowFx ? 0.8 : 1); // reduced motion: a steady edge, no pulse
      g.drawImage(hurtCanvas, 0, 0, w, h);
      g.globalAlpha = 1;
      return pulse;
    },
    ensureVignette(w, h) {
      if (hurtCanvas && hurtW === w && hurtH === h) return;
      hurtCanvas = hurtCanvas ?? document.createElement("canvas");
      hurtW = hurtCanvas.width = Math.ceil(w / 2); hurtH = hurtCanvas.height = Math.ceil(h / 2);
      const v = hurtCanvas.getContext("2d"), grad = v.createRadialGradient(hurtW / 2, hurtH / 2, hurtH * 0.35, hurtW / 2, hurtH / 2, hurtH * 0.85);
      grad.addColorStop(0, "rgba(160,0,10,0)"); grad.addColorStop(1, "rgba(160,0,10,0.5)");
      v.fillStyle = grad; v.fillRect(0, 0, hurtW, hurtH);
      hurtW = w; hurtH = h;
    },
    /** Red edge flash when the hero is hurt: one baked vignette per size, drawn at an alpha. */
    drawHurt(g, w, h, now) {
      if (fx.hurtUntil <= now) return;
      fx.ensureVignette(w, h);
      g.globalAlpha = Math.min(1, (fx.hurtUntil - now) / 260);
      g.drawImage(hurtCanvas, 0, 0, w, h);
      g.globalAlpha = 1;
    },
  };
  sk = createSkillFx(fx);
  fx.sk = sk;
  fx.lights = sk.lights; // light hook: [{ x, y, r, colour, intensity }] in tile units, refreshed by drawGround every frame (lighting rounds 9-10)
  return fx;
}
