// Baked material textures (G round, items 7 and 8): 11 procedural 64x64 overlays (alpha only, light and dark flecks), drawn once per atlas build at the atlas
// resolution and skewed onto isometric faces with pattern transforms. Ported from docs/product/variants/art-direction/C3.html (TEXG).
// Nothing here runs per frame: sprites that carry a material call fillTex() while they are drawn into the atlas.
const TAU = Math.PI * 2;
/** Texture contrast gain: the reviewers asked for about 1.5x so the material still reads at 1x inside the light pools. */
export const TEX_GAIN = 1.5;

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const A = (a) => Math.min(0.9, a * TEX_GAIN).toFixed(3);
function speck(c, r, n, a = 1) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = r() < 0.5 ? `rgba(0,0,0,${A((0.07 + r() * 0.1) * a)})` : `rgba(255,255,255,${A((0.04 + r() * 0.07) * a)})`;
    c.fillRect((r() * 64) | 0, (r() * 64) | 0, 1 + ((r() * 2) | 0), 1);
  }
}

const GEN = {
  weaveA(c, r) { for (let y = 0; y < 64; y += 4) { c.fillStyle = `rgba(0,0,0,${A(0.2)})`; c.fillRect(0, y, 64, 1.6); c.fillStyle = `rgba(255,255,255,${A(0.07)})`; c.fillRect(0, y + 2, 64, 1); } for (let x = 0; x < 64; x += 4) { c.fillStyle = `rgba(255,255,255,${A(0.09)})`; c.fillRect(x, 0, 1, 64); } speck(c, r, 200, 1.6); },
  weaveB(c, r) { c.lineWidth = 1.5; for (let k = -64; k < 64; k += 5) { c.strokeStyle = `rgba(0,0,0,${A(0.2)})`; c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 64, 64); c.stroke(); } for (let k = -64; k < 64; k += 10) { c.strokeStyle = `rgba(255,255,255,${A(0.1)})`; c.beginPath(); c.moveTo(k + 2, 0); c.lineTo(k + 66, 64); c.stroke(); } speck(c, r, 170, 1.5); },
  weaveC(c, r) {
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      if ((bx + by) & 1) for (let x = 0; x < 8; x += 2) { c.fillStyle = `rgba(0,0,0,${A(0.2)})`; c.fillRect(bx * 8 + x, by * 8, 1.2, 8); c.fillStyle = `rgba(255,255,255,${A(0.07)})`; c.fillRect(bx * 8 + x + 1.2, by * 8, 0.8, 8); }
      else for (let y = 0; y < 8; y += 2) { c.fillStyle = `rgba(0,0,0,${A(0.2)})`; c.fillRect(bx * 8, by * 8 + y, 8, 1.2); c.fillStyle = `rgba(255,255,255,${A(0.07)})`; c.fillRect(bx * 8, by * 8 + y + 1.2, 8, 0.8); }
    }
    speck(c, r, 140, 1.4);
  },
  wood(c, r) {
    for (let i = 0; i < 22; i++) {
      const y = r() * 64, a = r() * 0.12 + 0.06, dk = r() < 0.7, ph = r() * 6, am = r() * 1.6 + 0.4;
      c.strokeStyle = dk ? `rgba(30,12,4,${A(a * 1.7)})` : `rgba(255,220,170,${A(a)})`; c.lineWidth = 0.6 + r() * 1.2; c.beginPath();
      for (let x = 0; x <= 64; x += 4) { const yy = y + Math.sin((x * TAU) / 64 * 2 + ph) * am; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); }
      c.stroke();
    }
    const kx = r() * 44 + 10, ky = r() * 44 + 10; c.strokeStyle = `rgba(30,12,4,${A(0.28)})`; c.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(kx, ky, k * 2.8, k * 1.3, 0, 0, TAU); c.stroke(); }
  },
  metal(c, r) { for (let i = 0; i < 300; i++) { const y = r() * 64, x = r() * 64, l = 8 + r() * 40; c.fillStyle = r() < 0.5 ? `rgba(255,255,255,${A(0.04 + r() * 0.09)})` : `rgba(0,0,0,${A(0.05 + r() * 0.09)})`; c.fillRect(x, y, l, 1); if (x + l > 64) c.fillRect(x - 64, y, l, 1); } },
  concrete(c, r) {
    for (let i = 0; i < 34; i++) { c.fillStyle = r() < 0.5 ? `rgba(0,0,0,${A(0.03 + r() * 0.05)})` : `rgba(255,255,255,${A(0.02 + r() * 0.035)})`; c.beginPath(); c.ellipse(r() * 64, r() * 64, 4 + r() * 9, 3 + r() * 6, r() * 3, 0, TAU); c.fill(); }
    speck(c, r, 360, 1.2);
    c.strokeStyle = `rgba(0,0,0,${A(0.18)})`; c.lineWidth = 0.8; c.beginPath(); let x = r() * 20, y = r() * 64; c.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += 6 + r() * 8; y += (r() - 0.5) * 10; c.lineTo(x, y); }
    c.stroke();
  },
  plaster(c, r) { speck(c, r, 120, 0.7); for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(0,0,0,${A(0.025)})`; c.fillRect(r() * 64, 0, 2 + r() * 6, 64); } },
  paper(c, r) { for (let i = 0; i < 70; i++) { c.strokeStyle = r() < 0.5 ? `rgba(120,100,70,${A(0.16)})` : `rgba(255,255,255,${A(0.28)})`; c.lineWidth = 0.6; const x = r() * 64, y = r() * 64, a = r() * TAU, l = 1.5 + r() * 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } },
  cardboard(c, r) { for (let x = 0; x < 64; x += 3) { c.fillStyle = `rgba(60,30,8,${A(0.16)})`; c.fillRect(x, 0, 1, 64); c.fillStyle = `rgba(255,230,180,${A(0.08)})`; c.fillRect(x + 1, 0, 1, 64); } speck(c, r, 160); },
  panel(c, r) {
    for (let x = 0; x < 64; x += 16) { c.fillStyle = `rgba(0,0,0,${A(0.22)})`; c.fillRect(x, 0, 1.4, 64); c.fillStyle = `rgba(255,230,190,${A(0.08)})`; c.fillRect(x + 1.4, 0, 1, 64); }
    for (let i = 0; i < 14; i++) { c.strokeStyle = `rgba(20,6,10,${A(0.06 + r() * 0.08)})`; c.lineWidth = 0.6; const x = r() * 64; c.beginPath(); c.moveTo(x, 0); for (let y = 0; y <= 64; y += 8) c.lineTo(x + Math.sin(y * 0.2 + i) * 1.2, y); c.stroke(); }
  },
  marble(c, r) { // soft veins on a polished stone (the Lobby reception floor)
    for (let i = 0; i < 9; i++) { c.strokeStyle = r() < 0.6 ? `rgba(255,255,255,${A(0.1 + r() * 0.08)})` : `rgba(20,10,30,${A(0.1 + r() * 0.08)})`; c.lineWidth = 0.7 + r() * 1.1; c.beginPath(); let x = r() * 64, y = 0; c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.35) * 14; y += 8; c.lineTo(x, y); } c.stroke(); }
    speck(c, r, 90, 0.9);
  },
};
/** The 11 material names. */
export const TEXTURES = Object.keys(GEN);

let res = 1;
const canv = new Map(), pats = new Map();
let pctx = null;
/** Set the texture resolution (the atlas scale); clears the caches when it changes. */
export function setTexRes(r) { const rr = Math.max(1, Math.min(3, Math.round(r * 2) / 2)); if (rr !== res) { res = rr; canv.clear(); pats.clear(); } }

function texCanvas(name) {
  let c = canv.get(name);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = Math.round(64 * res);
    const g = c.getContext("2d"); g.scale(res, res);
    let seed = 977; for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i) * (i + 7)) >>> 0;
    GEN[name](g, rng(seed));
    canv.set(name, c);
  }
  return c;
}

// pattern matrices that skew a texture (64 texels = one tile) onto the iso planes: top (T), mirrored top (Ts), left face (L), right face (R), flat (F)
const M = { T: [0.5, 0.25, -0.5, 0.25], Ts: [-0.5, 0.25, 0.5, 0.25], L: [0.5, 0.25, 0, 1], R: [-0.5, 0.25, 0, 1], F: [1, 0, 0, 1] };
function pattern(name, kind) {
  const k = name + kind;
  let p = pats.get(k);
  if (!p) { pctx ??= document.createElement("canvas").getContext("2d"); p = pctx.createPattern(texCanvas(name), "repeat"); pats.set(k, p); }
  return p;
}

/**
 * Fill the current path with texture `name` skewed onto plane `kind` ('T' | 'Ts' | 'L' | 'R' | 'F'), the texture origin at (ox, oy) in the current user space
 * (pass a polygon vertex shared by neighbouring tiles so the pattern runs on across the seams), at `alpha`.
 */
export function fillTex(g, name, kind, ox, oy, alpha = 1) {
  if (!GEN[name]) return;
  const p = pattern(name, kind), m = M[kind], k = 1 / res;
  p.setTransform(new DOMMatrix([m[0] * k, m[1] * k, m[2] * k, m[3] * k, ox, oy]));
  const keep = g.globalAlpha;
  g.globalAlpha = keep * alpha; g.fillStyle = p; g.fill(); g.globalAlpha = keep;
}
