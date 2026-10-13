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

// ---- loot visuals ----
const MAX_PLATES = 10;
const PLATE_NEAR = 5, PLATE_FAR = 10;
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
  const rows = [], fr0 = { x: 0, y: 0, w: 0, h: 0 };
  const fx = {
    parts: [], slashes: [], rings: [], impacts: [], pillars: [], proj: new Map(), flash: new Map(), // `flash` is unused (flashTicks is state-backed) and kept so older callers do not break
    core: null, alpha: 1, hc: false, showAllLoot: false, hoverLootId: null, // the shell may set these three (high contrast, Alt held, hovered ground entry)
    avoid: [], avoidSegs: [], // plate / pip rectangles and leader lines claimed by the nameplate pass this frame (set by the shell); loot plates and floaters keep clear of them
    hurtUntil: 0, lowHp: false, beat: -1, shakeUntil: 0, hitStopUntil: 0, deathAt: null, lowFx: false,
    reset() {
      fx.parts.length = 0; fx.slashes.length = 0; fx.rings.length = 0; fx.impacts.length = 0; fx.pillars.length = 0; fx.proj.clear(); fx.flash.clear();
      fx.hurtUntil = fx.shakeUntil = fx.hitStopUntil = 0; fx.deathAt = null; fx.lowHp = false; fx.beat = -1;
    },
    handle(ev, core, now) {
      const find = (id) => (id === "player" ? core.player : core.monsters.find((m) => m.id === id));
      const at = (a) => { actorPos(a, pos); return pos; };
      if (ev.type === "hit") {
        const t = find(ev.target);
        if (!t) return;
        const cx = at(t).x + 0.5, cy = pos.y + 0.5, toPlayer = ev.target === "player";
        const head = style.dims[toPlayer ? PLAYER_CLASS : t.type]?.head ?? 50;
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
        fx.rings.push({ kind: "burst", x, y, r0: Math.max(0.5, ev.radius * 0.25), r1: ev.radius, born: now, life: 480, colour: "#ffb35a" });
        fx.burst(x, y, 16, now, { outward: ev.radius });
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
      } else if (ev.type === "floorEnter") {
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
          rot: rng.next() * 6.28, spin: opts.rise ? 0 : (rng.next() - 0.5) * 14, sprite: opts.sprite ?? "paper", born: now, life: opts.rise ? 700 + rng.next() * 300 : 480 + rng.next() * 320,
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
        const k = p.sprite === "paper" ? 0.85 : 1.1;
        g.drawImage(sp.img, -sp.ox * z * k, -sp.oy * z * (p.sprite === "paper" ? 0.6 : k), sp.w * z * k, sp.h * z * (p.sprite === "paper" ? 0.6 : k));
        g.restore();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < fx.slashes.length; i++) {
        const sl = fx.slashes[i], e = atlas.get(keys.slash(playerDir)), k = (now - sl.born) / 170;
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
      if (core) { fx.drawLootPlates(g, cam, core, now); fx.drawFloaters(g, cam, core, now); } // ground labels sit above bursts and impacts, floaters above everything
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
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      for (let i = 0; i < list.length; i++) {
        const f = list[i], age = (config.floaterTicks - f.life + fx.alpha) * TICK_MS, t = Math.min(1, Math.max(0, age / FLOATER_MS));
        if (f.life <= 0) continue;
        const toPlayer = f.target === "player", miss = f.kind === "miss", heal = f.kind === "heal", e = ease(t);
        const mon = toPlayer ? null : core.monsters.find((m) => m.id === f.target);
        const head = style.dims[toPlayer ? PLAYER_CLASS : mon?.type]?.head ?? 50;
        project(cam, f.tile.x + 0.5, f.tile.y + 0.5, pos);
        const pop = 1 + 0.9 * Math.max(0, 1 - t / 0.14);
        const fs = Math.max(miss ? 15 : 30, Math.round((miss ? 10 : 21) * z * pop));
        // spawns above the head and clear of the nameplate, then drifts up (right for monsters, left for the hero); stacked rows sit higher
        const side = toPlayer ? -1 : 1, x = pos.x + side * Math.max((toPlayer ? 62 : 40) * z, 88) + side * 16 * e * z, y = pos.y - (head + 10 + 32 * e + rows[i] * 24) * z;
        const text = miss ? S.miss : heal ? `+${f.value}` : String(f.value);
        g.font = fontFor(fs);
        // own lane: never on a nameplate, health pip, ground-item label or leader line; lift in steps, then try the other side
        const tw = g.measureText(text).width + 8, th = fs * 1.15, fr = fr0;
        let fy = y, fxx = x;
        for (let tries = 0; tries < 9; tries++) {
          fr.x = fxx - tw / 2; fr.y = fy - th / 2; fr.w = tw; fr.h = th;
          if (!fx.blocked(fr)) break;
          if (tries === 5) { fxx = pos.x - side * Math.max((toPlayer ? 62 : 40) * z, 88) - side * 16 * e * z; fy = y; } else fy -= th * 0.7;
        }
        g.globalAlpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
        g.lineWidth = Math.max(4, fs * 0.32); g.strokeStyle = P.ink; g.strokeText(text, fxx, fy);
        if (!miss) { g.lineWidth = Math.max(2, fs * 0.12); g.strokeStyle = heal ? "#1f8a4a" : toPlayer ? "#e0363f" : "#ff6a2a"; g.strokeText(text, fxx, fy); }
        g.fillStyle = miss ? "#c9c3ec" : heal ? "#c8ffd4" : toPlayer ? "#ffd0d4" : "#fff3a0"; g.fillText(text, fxx, fy);
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
        g.globalAlpha = 0.5; g.fillStyle = "#000"; g.beginPath(); g.ellipse(pos.x, pos.y, 8 * z, 3.6 * z, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        const ang = Math.atan2((pr.dir.x + pr.dir.y) * 16, (pr.dir.x - pr.dir.y) * 32);
        g.save(); g.translate(pos.x, pos.y - lift);
        if (pr.kind === "stapler") g.rotate(ang + Math.sin(now / 50) * 0.45);                 // tumbles
        else if (pr.kind === "slide") { g.rotate(ang); g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(now / 70 + pr.pos.x))); } // flutters
        else { g.rotate(ang); if (pr.hostile) { g.globalAlpha = 0.4 + 0.2 * Math.sin(now / 90); g.fillStyle = P.proj.tonerGlow; g.beginPath(); g.arc(0, 0, 11 * z, 0, 6.3); g.fill(); g.globalAlpha = 1; } }
        g.drawImage(e.img, -e.ox * z, -e.oy * z, e.w * z, e.h * z);
        g.restore();
      }
      if (fx.proj.size > 64) fx.proj.clear();
    },

    /** Muzzle flashes and impact splats for projectiles (toner splat, stapler sparks; slide impact shows as paper particles). */
    drawImpact(g, cam, im, now) {
      const z = cam.z, k = (now - im.born) / im.life;
      project(cam, im.x, im.y, pos);
      const cx = pos.x, cy = pos.y - im.z * z;
      g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.lineJoin = "round"; g.lineCap = "round";
      if (im.mode === "muzzle") {
        const R = (5 + 5 * k) * z;
        g.fillStyle = im.kind === "toner" ? P.proj.tonerGlow : im.kind === "slide" ? "#5b8cff" : "#e8eef8";
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
      const z = cam.z, k = (now - pl.born) / pl.life;
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
     * items near the hero (any rarity) and for rare / unique items in sight, at most MAX_PLATES, never overlapping each other or the screen edge.
     */
    drawLoot(g, cam, core, now) {
      const list = core.groundItems, z = cam.z;
      if (!list || list.length === 0) return;
      const hero = core.player, hx = hero.tile.x, hy = hero.tile.y, size = Math.max(16, Math.round(6.5 * z)), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const hc = !!fx.hc, fs = Math.max(11, Math.min(14, Math.round(z * 3.4))), SAFE = 8;
      let plates = 0;
      const placed = fx.platesPlaced ?? (fx.platesPlaced = []);
      placed.length = 0;
      project(cam, hx + 0.5, hy + 0.5, pos2); // keep plates off the hero's body (placed first, so every plate shifts around it)
      const heroRect = { x: pos2.x - 24 * z, y: pos2.y - 58 * z, w: 48 * z, h: 60 * z };
      placed.push(heroRect);
      // nearest first so close plates win the space
      const order = fx.lootOrder ?? (fx.lootOrder = []);
      order.length = 0;
      for (let i = 0; i < list.length; i++) order.push(list[i]);
      order.sort((a, b) => Math.hypot(a.tile.x - hx, a.tile.y - hy) - Math.hypot(b.tile.x - hx, b.tile.y - hy));
      // pass 1: beams (under everything else of the loot layer), pass 2: markers, pass 3: plates (nearest first, so close plates win the space)
      for (let i = 0; i < order.length; i++) {
        const gi = order[i];
        project(cam, gi.tile.x + 0.5, gi.tile.y + 0.5, pos);
        if (pos.x < -60 || pos.x > cam.w + 60 || pos.y < -140 * z || pos.y > cam.h + 60 || !gi.rarity) continue;
        beam(g, gi.rarity, P.rarity[gi.rarity] ?? gi.color ?? "#d6d3cb", pos.x, pos.y - 4 * z, z, now);
      }
      const vis = fx.lootVis ?? (fx.lootVis = []);
      vis.length = 0;
      for (let i = 0; i < order.length; i++) {
        const gi = order[i];
        project(cam, gi.tile.x + 0.5, gi.tile.y + 0.5, pos);
        if (pos.x < -60 || pos.x > cam.w + 60 || pos.y < -140 * z || pos.y > cam.h + 60) continue;
        const colour = gi.gold ? (gi.color ?? "#e6c84a") : P.rarity[gi.rarity] ?? gi.color ?? "#d6d3cb";
        const my = pos.y - 14 * z - (gi.rarity === "unique" ? Math.sin(now / 400) * 1.5 * z : 0);
        marker(g, P, gi, pos.x, my, size * (gi.rarity === "unique" ? 1.15 : 1), colour);
        vis.push({ gi, x: pos.x, my, colour, d: Math.hypot(gi.tile.x - hx, gi.tile.y - hy) });
      }
      fx.lootHero = heroRect; fx.lootSize = size; fx.lootFs = fs; fx.lootDpr = dpr; fx.lootHc = hc;
    },

    /** Ground-item plates (after the burst / impact layer): kept off nameplates, health pips, leader lines, the hero and each other. */
    drawLootPlates(g, cam, core, now) {
      const vis = fx.lootVis, heroRect = fx.lootHero;
      if (!vis || vis.length === 0 || !heroRect || !core.groundItems?.length) return;
      const placed = fx.platesPlaced, size = fx.lootSize, fs = fx.lootFs, dpr = fx.lootDpr, hc = fx.lootHc, SAFE = 8;
      let plates = 0;
      for (let i = 0; i < vis.length; i++) {
        const { gi, x, my, colour, d } = vis[i];
        // full plates: near the hero, rare+ in sight, the hovered entry (fx.hoverLootId) and everything while Alt is held (fx.showAllLoot, set by the shell)
        const show = fx.showAllLoot || gi.id === fx.hoverLootId || d <= PLATE_NEAR || ((gi.rarity === "rare" || gi.rarity === "unique") && d <= PLATE_FAR);
        if (!show || plates >= (fx.showAllLoot ? 3 * MAX_PLATES : MAX_PLATES)) continue;
        const sp = plateSprite(P, gi.label, gi.rarity ?? "normal", gi.border === "none" ? "plain" : gi.border ?? "plain", colour, fs, hc, dpr);
        const r = { x: Math.round(Math.min(cam.w - SAFE - sp.w, Math.max(SAFE, x - sp.w / 2))), y: Math.round(my - size / 2 - 4 - sp.h), w: sp.w, h: sp.h };
        if (r.x < heroRect.x + heroRect.w && heroRect.x < r.x + r.w && r.y < heroRect.y + heroRect.h && heroRect.y < r.y + r.h) r.y = Math.round(heroRect.y - r.h - 2);
        let ok = false;
        const y0 = r.y;
        for (let k = 0; k < 7 && !ok; k++) {
          ok = r.y > SAFE && r.y + r.h < cam.h - SAFE;
          for (let j = 0; j < placed.length && ok; j++) if (rectHit(r, placed[j])) ok = false;
          if (ok && fx.blocked(r)) ok = false;
          if (!ok) r.y = k === 3 ? Math.round(my + size / 2 + 4) : k > 3 ? r.y + r.h + 2 : r.y - (r.h + 2); // up three times, then below the marker, then further down
        }
        if (!ok) { r.y = y0; continue; }
        placed.push({ x: r.x, y: r.y, w: r.w, h: r.h });
        plates++;
        g.drawImage(sp.c, r.x, r.y, sp.w, sp.h);
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
      const period = 700 + 900 * ratio / 0.3 * 0.5, phase = (now % period) / period, beat = Math.floor(now / period);
      if (beat !== fx.beat) { fx.beat = beat; bus?.emit({ type: "ui:heartbeat", ratio, period }); }
      const pulse = Math.max(0, 1 - phase * 2.2) ** 2; // sharp thump then fade
      fx.ensureVignette(w, h);
      g.globalAlpha = Math.min(1, 0.35 + 0.65 * pulse) * (fx.lowFx ? 0.8 : 1);
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
  return fx;
}
