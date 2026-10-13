// Lighting. One baked half-resolution darkness mask (90% dark, toon-banded hero radius, warm tint), drawn centred on
// the hero; up to MAX_LIGHTS coloured pools (warm/cyan monitor, cold green-white fluorescent with a hard banded
// edge, red lamp on the printer imps) drawn additively; flicker only changes one alpha. Actors are tinted from the
// same light model at their feet (sample()). `lowFx` swaps all of it for a flat quarter-resolution darkening.
// The mask is re-baked only when the viewport, zoom or mode changes, never per frame.
export const MAX_LIGHTS = 4;
export const HERO_RADIUS = 5.6; // tiles
const POOL = { monitor: { r: 2.1, lift: 22 }, fluor: { r: 3.6, lift: 0 }, lamp: { r: 2.7, lift: 14 } };

// Band stops from the C2 mock-up: [position, opacity, ...] (toon bands, not a smooth falloff)
const HERO_BANDS = [0, 1, 0.26, 1, 0.29, 0.78, 0.5, 0.78, 0.53, 0.42, 0.74, 0.42, 0.77, 0.15, 0.98, 0.1, 1, 0];
const POOL_BANDS = [0, 0.9, 0.4, 0.9, 0.43, 0.5, 0.7, 0.5, 0.73, 0.2, 0.98, 0.2, 1, 0];
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

export function createLighting(style) {
  const P = style.palette, sprites = new Map();
  const sprite = (colour, bands) => { const k = colour + bands.length; let s = sprites.get(k); if (!s) { s = radialSprite(colour, bands); sprites.set(k, s); } return s; };
  const mask = { canvas: null, w: 0, h: 0, z: 0, mode: "" };
  const L = {
    lights: Array.from({ length: MAX_LIGHTS }, () => ({ kind: "", x: 0, y: 0, a: 0, colour: "", r: 0, d2: 0 })), n: 0,
    hero: { x: 0, y: 0 }, lowFx: false, hc: false, stats: { rebakes: 0 },

    /** (Re)bake the darkness mask if the viewport, zoom or mode changed. */
    ensure(cam, lowFx, hc) {
      const mode = lowFx ? "low" : hc ? "hc" : "full";
      if (mask.canvas && mask.w === cam.w && mask.h === cam.h && mask.z === cam.z && mask.mode === mode) return;
      L.stats.rebakes++;
      const res = lowFx ? 0.25 : 0.5, cw = Math.max(2, Math.ceil(cam.w * 2 * res)), ch = Math.max(2, Math.ceil(cam.h * 2 * res));
      const c = mask.canvas && mask.canvas.width === cw && mask.canvas.height === ch ? mask.canvas : document.createElement("canvas");
      c.width = cw; c.height = ch;
      const g = c.getContext("2d");
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = hc ? "rgba(7,5,24,0.6)" : lowFx ? "rgba(7,5,24,0.62)" : P.dark; g.fillRect(0, 0, cw, ch);
      const rx = HERO_RADIUS * 45.25 * cam.z * res, ry = HERO_RADIUS * 22.6 * cam.z * res;
      g.globalCompositeOperation = "destination-out";
      if (lowFx) { // flat: a smooth, cheap hole
        const grad = g.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, rx);
        grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(0.6, "rgba(0,0,0,0.7)"); grad.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.translate(cw / 2, ch / 2); g.scale(1, ry / rx); g.translate(-cw / 2, -ch / 2); g.fillStyle = grad; g.fillRect(0, 0, cw, ch); g.restore();
      } else {
        g.drawImage(sprite("#ffffff", HERO_BANDS), cw / 2 - rx, ch / 2 - ry, rx * 2, ry * 2);
        g.globalCompositeOperation = "source-over";
        if (!hc) { g.globalAlpha = 0.07; g.drawImage(sprite(P.glow, POOL_BANDS), cw / 2 - rx, ch / 2 - ry, rx * 2, ry * 2); g.globalAlpha = 1; } // warm tint inside the hero radius
      }
      g.globalCompositeOperation = "source-over";
      Object.assign(mask, { canvas: c, w: cam.w, h: cam.h, z: cam.z, mode });
    },

    /** Pick the (at most 4) lights that matter: nearest to the hero, imp lamps first. Allocation-free. */
    select(cam, hero, candidates, monsters, lowFx, hc) {
      L.n = 0; L.hero.x = hero.x; L.hero.y = hero.y; L.lowFx = lowFx; L.hc = hc;
      if (lowFx || hc) return;
      for (let i = 0; i < monsters.length; i++) { const m = monsters[i]; if (m.ai !== "dead" && P.actorLights[m.type]) consider(L, P, P.actorLights[m.type], m.x, m.y, 30); }
      for (let i = 0; i < candidates.length; i++) { const c = candidates[i]; consider(L, P, c.kind, c.x, c.y, 0); }
    },

    /** Draw the mask and the pools (after the world, before plates, floaters and HUD). */
    draw(g, cam, heroScreen, now) {
      if (!mask.canvas) return;
      const hx = heroScreen.x, hy = heroScreen.y - 18 * cam.z;
      g.drawImage(mask.canvas, hx - cam.w, hy - cam.h, cam.w * 2, cam.h * 2);
      if (L.n === 0) return;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < L.n; i++) {
        const l = L.lights[i], pc = POOL[l.kind];
        const sx = cam.ox + (l.x - l.y) * 32 * cam.z, sy = cam.oy + (l.x + l.y) * 16 * cam.z - pc.lift * cam.z;
        const rx = l.r * 45.25 * cam.z, ry = l.r * 22.6 * cam.z;
        g.globalAlpha = l.a * (l.kind === "fluor" ? flicker(now, (l.x * 3 + l.y) | 0) : l.kind === "monitor" ? 0.9 + Math.sin(now / 160 + l.x) * 0.06 : 1);
        g.drawImage(sprite(l.colour, POOL_BANDS), sx - rx, sy - ry, rx * 2, ry * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    },

    /**
     * Light at a tile-space point, for tinting actors: out.shade = darkness 0..0.6 in steps of 0.1, out.tint = the
     * strongest pool colour (or "") with out.tintA 0..0.3 in steps of 0.05. Same banding as the mask.
     */
    sample(wx, wy, out) {
      const hd = Math.hypot(wx - L.hero.x, wy - L.hero.y) / HERO_RADIUS;
      let dark = L.lowFx ? Math.min(1, Math.max(0, (hd - 0.3) / 0.7)) * 0.7 : 1 - bandAt(HERO_BANDS, hd), best = 0, tint = "";
      for (let i = 0; i < L.n; i++) {
        const l = L.lights[i], s = bandAt(POOL_BANDS, Math.hypot(wx - l.x, wy - l.y) / l.r) * (l.a / 0.3);
        if (s > best) { best = s; tint = l.colour; }
        dark = Math.max(0, dark - s * 0.55);
      }
      out.shade = Math.round(Math.min(0.6, dark * 0.62) * 10) / 10;
      out.tint = best > 0.1 ? tint : ""; out.tintA = Math.round(Math.min(0.18, best * 0.18) * 20) / 20;
      return out;
    },
  };
  return L;
}
