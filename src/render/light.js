// Lighting. One baked half-resolution darkness mask (90% dark, toon-banded hero radius, warm tint), drawn centred on
// the hero; up to MAX_LIGHTS coloured pools (warm/cyan monitor, cold green-white fluorescent with a hard banded
// edge, red lamp on the printer imps) drawn additively; flicker only changes one alpha. Actors are tinted from the
// same light model at their feet (sample()). `lowFx` swaps all of it for a flat quarter-resolution darkening.
// The mask is re-baked only when the viewport, zoom or mode changes, never per frame.
export const MAX_LIGHTS = 4;
/**
 * Ambient lift (G round, item 8): how much of the dark grade is taken away from the ambient floor and wall mid-tones OUTSIDE the light pools, as a share of
 * the full mask opacity (0.12 = 12 %). 0 restores the old grade exactly. The lift fades out towards the screen corners (the vignette stays dark), the pools and
 * the hero radius are untouched, so pools still read clearly brighter and more saturated than their surroundings.
 */
export const AMBIENT_LIFT = 0.12;
/** Static ("baked") pools: constant, never flickering, drawn in the same additive pass as the dynamic ones; they do not count towards MAX_LIGHTS. */
export const MAX_STATIC = 3;
export const HERO_RADIUS = 5.6; // tiles
const THEME_RADIUS = { executive: 1.5, basement: 1.2 }; // the boss arena is lit more widely: the fight must be readable across the whole boardroom
const POOL = {
  monitor: { r: 2.1, lift: 22 }, fluor: { r: 3.6, lift: 0 }, lamp: { r: 2.7, lift: 14 },
  warm: { r: 4.2, lift: 0 },   // Lobby ceiling lamp
  cold: { r: 3.6, lift: 0 },   // basement tube (flickers harder)
  rack: { r: 2.3, lift: 24 },  // server rack LEDs
  gen: { r: 2.4, lift: 12 },   // generator work light
  desklamp: { r: 2.5, lift: 16 },   // Executive Suite: brass desk lamp
  screen: { r: 4.6, lift: 30 },     // Executive Suite: the quarterly results screen
  chandelier: { r: 4.4, lift: 0 },  // Executive Suite: a dim ceiling light
  exit: { r: 1.9, lift: 8 },        // the green pool of an exit sign over the stairs (static)
  shaft: { r: 3.0, lift: 0 },       // window light falling across the floor (static, drawn as a parallelogram)
  boss: { r: 3.4, lift: 22 },       // the Regional Director's aura
  rage: { r: 3.8, lift: 22 },         // ... in phase 2
};
const FLICKERING = { fluor: 1, cold: 1.6, screen: 0.5 };
const CORE = { fluor: 1, warm: 1, cold: 1, chandelier: 1 }; // a brighter inner band on the big ceiling pools (G round, item 5)

// Band stops from the C2 mock-up: [position, opacity, ...] (toon bands, not a smooth falloff)
const HERO_BANDS = [0, 1, 0.26, 1, 0.29, 0.78, 0.5, 0.78, 0.53, 0.42, 0.74, 0.42, 0.77, 0.15, 0.98, 0.1, 1, 0];
const POOL_BANDS = [0, 0.9, 0.4, 0.9, 0.43, 0.5, 0.7, 0.5, 0.73, 0.2, 0.98, 0.2, 1, 0];
const LIFT_BANDS = [0, 1, 0.45, 1, 0.78, 0.55, 1, 0]; // the ambient lift: full in the middle of the screen, gone at the corners
const bandAt = (bands, d) => { // same banding as the gradient stops, for sampling actor tint
  if (d >= 1) return 0;
  for (let i = 2; i < bands.length; i += 2) if (d <= bands[i]) { const p0 = bands[i - 2], p1 = bands[i], v0 = bands[i - 1], v1 = bands[i + 1]; return p1 === p0 ? v1 : v0 + (v1 - v0) * ((d - p0) / (p1 - p0)); }
  return 0;
};

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function radialSprite(colour, bands, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2), [r, gg, b] = hexRgb(colour);
  for (let i = 0; i < bands.length; i += 2) grad.addColorStop(bands[i], `rgba(${r},${gg},${b},${bands[i + 1]})`);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return c;
}

/** Fluorescent tube flicker: a pure function of time, mostly 1 with buzzing dips. */
export function flicker(nowMs, seed = 0) {
  const t = nowMs / 1000, k = Math.floor(t * 26) + seed * 7;
  const h = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  let v = 1;
  if (h(k * 3.7) > 0.955) v = 0.3 + h(k) * 0.4;
  const b = ((t + seed) % 4.3) / 4.3;
  if (b > 0.86 && b < 0.95 && h(k * 1.9 + 4) > 0.35) v = 0.15 + h(k * 2.3) * 0.5;
  return Math.min(1, Math.max(0, v + Math.sin(t * 50) * 0.025));
}

/** Offer a light to the (at most MAX_LIGHTS) active set: it replaces the farthest one when the set is full. Allocation-free. */
function consider(L, P, kind, x, y, bias) {
  const hero = L.hero, d2 = (x - hero.x) ** 2 + (y - hero.y) ** 2 - bias, reach = (POOL[kind].r + HERO_RADIUS + 2) ** 2;
  if (d2 > reach) return;
  let slot = -1;
  if (L.n < MAX_LIGHTS) slot = L.n++;
  else { let worst = -1, wd = d2; for (let i = 0; i < MAX_LIGHTS; i++) if (L.lights[i].d2 > wd) { wd = L.lights[i].d2; worst = i; } slot = worst; }
  if (slot < 0) return;
  const l = L.lights[slot], p = P.pools[kind];
  l.kind = kind; l.x = x; l.y = y; l.d2 = d2; l.colour = p[0]; l.a = p[1]; l.r = POOL[kind].r;
}

const NONE = [];
const lightCache = new Map();
const darkCache = new Map();
/** A pool colour mixed 80 % towards the shadow ink: the soft coloured ground shadow under actors standing in a pool. */
function darkColour(hex) {
  let c = darkCache.get(hex);
  if (!c) { const [r, g, b] = hexRgb(hex).map((v, i) => Math.round([6, 4, 26][i] + (v - [6, 4, 26][i]) * 0.42)); c = `rgb(${r},${g},${b})`; darkCache.set(hex, c); }
  return c;
}
/** A pool colour mixed 8 % towards white: the multiply tint of actors (a hue shift without darkening them). */
function lightColour(hex) {
  let c = lightCache.get(hex);
  if (!c) { const [r, g, b] = hexRgb(hex).map((v) => Math.round(v + (255 - v) * 0.08)); c = `rgb(${r},${g},${b})`; lightCache.set(hex, c); }
  return c;
}
/** Offer a static pool (second fixture, exit sign, window shaft) to the nearest-MAX_STATIC set. Allocation-free. */
function considerStatic(L, P, c) {
  const hero = L.hero, d2 = (c.x - hero.x) ** 2 + (c.y - hero.y) ** 2, reach = (POOL[c.kind].r + HERO_RADIUS + 2) ** 2;
  if (d2 > reach) return;
  let slot = -1;
  if (L.ns < MAX_STATIC) slot = L.ns++;
  else { let wd = d2; for (let i = 0; i < MAX_STATIC; i++) if (L.statics[i].d2 > wd) { wd = L.statics[i].d2; slot = i; } }
  if (slot < 0) return;
  const l = L.statics[slot], p = P.pools[c.kind];
  l.kind = c.kind; l.x = c.x; l.y = c.y; l.d2 = d2; l.colour = p[0]; l.a = p[1] * (c.dim ?? 0.8); l.r = POOL[c.kind].r * (c.rs ?? 0.85); l.o = c.o ?? "";
}

/** Window light shaft sprites (a pale parallelogram fading away from the wall), one per wall side, baked on first use. Tile-space origin = the wall tile's top-left corner. */
const SHAFT_LEN = 2.8, SHAFT_SLANT = 1.1;
const shaftCache = {};
function shaftSprite(o) {
  let s = shaftCache[o];
  if (s) return s;
  const pts = o === "L" ? [[0.1, 1], [0.9, 1], [0.9 + SHAFT_SLANT, 1 + SHAFT_LEN], [0.1 + SHAFT_SLANT, 1 + SHAFT_LEN]] : [[1, 0.1], [1, 0.9], [1 + SHAFT_LEN, 0.9 + SHAFT_SLANT], [1 + SHAFT_LEN, 0.1 + SHAFT_SLANT]];
  const sc = (x, y) => [(x - y) * 32, (x + y) * 16], q = pts.map(([x, y]) => sc(x, y));
  const x0 = Math.min(...q.map((p) => p[0])), x1 = Math.max(...q.map((p) => p[0])), y0 = Math.min(...q.map((p) => p[1])), y1 = Math.max(...q.map((p) => p[1]));
  const c = document.createElement("canvas"); c.width = Math.ceil(x1 - x0); c.height = Math.ceil(y1 - y0);
  const g = c.getContext("2d"), a = sc(...(o === "L" ? [0.5, 1] : [1, 0.5])), b = sc(...(o === "L" ? [0.5 + SHAFT_SLANT, 1 + SHAFT_LEN] : [1 + SHAFT_LEN, 0.5 + SHAFT_SLANT]));
  const gr = g.createLinearGradient(a[0] - x0, a[1] - y0, b[0] - x0, b[1] - y0);
  gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(0.55, "rgba(255,255,255,0.3)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0] - x0, p[1] - y0) : g.moveTo(p[0] - x0, p[1] - y0))); g.closePath(); g.fill();
  return (shaftCache[o] = { c, x0, y0, tint: new Map() });
}

export function createLighting(style) {
  const P = style.palette, sprites = new Map();
  const sprite = (colour, bands) => { const k = colour + bands.length; let s = sprites.get(k); if (!s) { s = radialSprite(colour, bands); sprites.set(k, s); } return s; };
  const mask = { canvas: null, w: 0, h: 0, z: 0, mode: "" };
  const last = { cam: null, lowFx: false, hc: false };
  const L = {
    lights: Array.from({ length: MAX_LIGHTS }, () => ({ kind: "", x: 0, y: 0, a: 0, colour: "", r: 0, d2: 0, o: "" })), n: 0,
    statics: Array.from({ length: MAX_STATIC }, () => ({ kind: "", x: 0, y: 0, a: 0, colour: "", r: 0, d2: 0, o: "" })), ns: 0,
    hero: { x: 0, y: 0 }, lowFx: false, hc: false, theme: "open-plan", stats: { rebakes: 0 },

    /** The hero's light radius in tiles for the current theme. */
    radius() { return HERO_RADIUS * (THEME_RADIUS[L.theme] ?? 1); },

    /** (Re)bake the darkness mask if the viewport, zoom or mode changed. */
    ensure(cam, lowFx, hc) {
      const mode = (lowFx ? "low" : hc ? "hc" : "full") + L.theme;
      last.cam = cam; last.lowFx = lowFx; last.hc = hc;
      if (mask.canvas && mask.w === cam.w && mask.h === cam.h && mask.z === cam.z && mask.mode === mode) return;
      L.stats.rebakes++;
      const res = lowFx ? 0.25 : 0.5, cw = Math.max(2, Math.ceil(cam.w * 2 * res)), ch = Math.max(2, Math.ceil(cam.h * 2 * res));
      const c = mask.canvas && mask.canvas.width === cw && mask.canvas.height === ch ? mask.canvas : document.createElement("canvas");
      c.width = cw; c.height = ch;
      const g = c.getContext("2d");
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = hc ? "rgba(7,5,24,0.6)" : lowFx ? "rgba(7,5,24,0.62)" : P.themes[L.theme]?.dark ?? P.dark; g.fillRect(0, 0, cw, ch);
      const hr = HERO_RADIUS * (THEME_RADIUS[L.theme] ?? 1), rx = hr * 45.25 * cam.z * res, ry = hr * 22.6 * cam.z * res;
      g.globalCompositeOperation = "destination-out";
      if (lowFx) { // flat: a smooth, cheap hole
        const grad = g.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, rx);
        grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(0.6, "rgba(0,0,0,0.7)"); grad.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.translate(cw / 2, ch / 2); g.scale(1, ry / rx); g.translate(-cw / 2, -ch / 2); g.fillStyle = grad; g.fillRect(0, 0, cw, ch); g.restore();
      } else {
        g.drawImage(sprite("#ffffff", HERO_BANDS), cw / 2 - rx, ch / 2 - ry, rx * 2, ry * 2);
        if (AMBIENT_LIFT > 0 && !hc) { // lift the ambient mid-tones: remove a share of the dark everywhere except the screen corners (a wide soft ellipse)
          const base = parseFloat((P.themes[L.theme]?.dark ?? P.dark).match(/[\d.]+\)$/)?.[0] ?? "0.86"), p = Math.min(0.5, AMBIENT_LIFT / Math.max(0.3, base)), lx = cam.w * 0.64 * res, ly = cam.h * 0.74 * res;
          g.globalAlpha = p; g.drawImage(sprite("#ffffff", LIFT_BANDS), cw / 2 - lx, ch / 2 - ly, lx * 2, ly * 2); g.globalAlpha = 1;
        }
        g.globalCompositeOperation = "source-over";
        if (!hc) { g.globalAlpha = 0.07; g.drawImage(sprite(P.glow, POOL_BANDS), cw / 2 - rx, ch / 2 - ry, rx * 2, ry * 2); g.globalAlpha = 1; } // warm tint inside the hero radius
      }
      g.globalCompositeOperation = "source-over";
      Object.assign(mask, { canvas: c, w: cam.w, h: cam.h, z: cam.z, mode });
    },

    /** Pick the (at most 4) lights that matter: nearest to the hero, imp lamps first. Allocation-free. */
    select(cam, hero, candidates, monsters, lowFx, hc, theme = "open-plan", statics = NONE) {
      if (theme !== L.theme) { L.theme = theme; if (last.cam) L.ensure(last.cam, last.lowFx, last.hc); } // a new floor theme re-bakes the mask once
      L.n = 0; L.ns = 0; L.hero.x = hero.x; L.hero.y = hero.y; L.lowFx = lowFx; L.hc = hc;
      if (lowFx || hc) return;
      for (let i = 0; i < statics.length; i++) considerStatic(L, P, statics[i]);
      for (let i = 0; i < monsters.length; i++) { const m = monsters[i]; if (m.ai !== "dead" && (m.lit || P.actorLights[m.type])) { const k = m.lit || P.actorLights[m.type]; if (k) consider(L, P, k, m.x, m.y, m.lit ? 60 : 30); } }
      for (let i = 0; i < candidates.length; i++) { const c = candidates[i]; consider(L, P, c.kind, c.x, c.y, 0); }
    },

    /** Draw the mask and the pools (after the world, before plates, floaters and HUD). */
    draw(g, cam, heroScreen, now) {
      L.drawLights(g, cam, heroScreen, now);
      if (L.after) L.after(g); // the world's actor pass: bodies drawn back over the additive wash (round G3, F2)
    },
    drawLights(g, cam, heroScreen, now) {
      if (!mask.canvas) return;
      const hx = heroScreen.x, hy = heroScreen.y - 18 * cam.z;
      g.drawImage(mask.canvas, hx - cam.w, hy - cam.h, cam.w * 2, cam.h * 2);
      if (L.n === 0) { L.drawStatic(g, cam); return; }
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < L.n; i++) {
        const l = L.lights[i], pc = POOL[l.kind];
        const sx = cam.ox + (l.x - l.y) * 32 * cam.z, sy = cam.oy + (l.x + l.y) * 16 * cam.z - pc.lift * cam.z;
        const rx = l.r * 45.25 * cam.z, ry = l.r * 22.6 * cam.z;
        const fa = l.a * (FLICKERING[l.kind] ? flicker(now, (l.x * 3 + l.y) | 0) ** FLICKERING[l.kind] : l.kind === "monitor" ? 0.9 + Math.sin(now / 160 + l.x) * 0.06 : 1);
        g.globalAlpha = fa;
        g.drawImage(sprite(l.colour, POOL_BANDS), sx - rx, sy - ry, rx * 2, ry * 2);
        if (CORE[l.kind]) { g.globalAlpha = fa * 0.55; g.drawImage(sprite(l.colour, POOL_BANDS), sx - rx * 0.5, sy - ry * 0.5, rx, ry); } // brighter inner band
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      L.drawStatic(g, cam);
    },

    /** Draw the static pools (second fixtures, exit signs, window shafts) in one additive pass; draw() calls it after the dynamic pools. */
    drawStatic(g, cam) {
      if (L.ns === 0) return;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < L.ns; i++) {
        const l = L.statics[i], pc = POOL[l.kind];
        if (l.kind === "shaft") {
          const sh = shaftSprite(l.o), t = sh.tint.get(l.colour) ?? (() => { const c = document.createElement("canvas"); c.width = sh.c.width; c.height = sh.c.height; const k = c.getContext("2d"); k.drawImage(sh.c, 0, 0); k.globalCompositeOperation = "source-in"; k.fillStyle = l.colour; k.fillRect(0, 0, c.width, c.height); sh.tint.set(l.colour, c); return c; })();
          const ox = cam.ox + (l.x - l.y) * 32 * cam.z, oy = cam.oy + (l.x + l.y) * 16 * cam.z; // (l.x, l.y) = the wall tile's top-left corner in tile space
          g.globalAlpha = l.a; g.drawImage(t, ox + sh.x0 * cam.z, oy + sh.y0 * cam.z, sh.c.width * cam.z, sh.c.height * cam.z);
          continue;
        }
        const sx = cam.ox + (l.x - l.y) * 32 * cam.z, sy = cam.oy + (l.x + l.y) * 16 * cam.z - pc.lift * cam.z, rx = l.r * 45.25 * cam.z, ry = l.r * 22.6 * cam.z;
        g.globalAlpha = l.a; g.drawImage(sprite(l.colour, POOL_BANDS), sx - rx, sy - ry, rx * 2, ry * 2);
        if (CORE[l.kind]) { g.globalAlpha = l.a * 0.55; g.drawImage(sprite(l.colour, POOL_BANDS), sx - rx * 0.5, sy - ry * 0.5, rx, ry); }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    },

    /**
     * Light at a tile-space point, for tinting actors: out.shade = darkness 0..0.6 in steps of 0.1, out.tint = the strongest pool colour (or "") with
     * out.tintA 0..0.25 in steps of 0.05 (G round: the actor is multiplied by a light version of that colour, 15 to 25 % inside a pool), out.mul = that light colour,
     * out.dx / out.dy = unit vector from the pool to the point (the ground shadow is cast away from it). Same banding as the mask.
     */
    sample(wx, wy, out) {
      const hd = Math.hypot(wx - L.hero.x, wy - L.hero.y) / (HERO_RADIUS * (THEME_RADIUS[L.theme] ?? 1));
      let dark = L.lowFx ? Math.min(1, Math.max(0, (hd - 0.3) / 0.7)) * 0.7 : 1 - bandAt(HERO_BANDS, hd), best = 0, tint = "", bx = 0, by = 0;
      for (let i = 0; i < L.n + L.ns; i++) {
        const l = i < L.n ? L.lights[i] : L.statics[i - L.n];
        if (l.kind === "shaft") continue;
        const dx = wx - l.x, dy = wy - l.y, d = Math.hypot(dx, dy), s = bandAt(POOL_BANDS, d / l.r) * (l.a / 0.3);
        if (s > best) { best = s; tint = l.colour; bx = dx / (d || 1); by = dy / (d || 1); }
        dark = Math.max(0, dark - s * 0.55);
      }
      out.shade = Math.round(Math.min(0.6, dark * 0.62) * 10) / 10;
      out.tint = best > 0.1 ? tint : ""; out.tintA = out.tint ? Math.round((0.15 + Math.min(1, best) * 0.1) * 20) / 20 : 0; // 15-25 % inside any pool
      out.mul = out.tint ? lightColour(out.tint) : ""; out.sh = out.tint ? darkColour(out.tint) : ""; out.dx = bx; out.dy = by;
      return out;
    },
  };
  return L;
}
