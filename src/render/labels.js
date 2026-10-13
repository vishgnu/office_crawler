// Nameplates. Pre-rendered once per (name, size, mode) into small canvases; the HP bar fill is the only live part.
// One placement pass per frame: every plate sits directly above its actor's head, anchored to the actor's logical
// position (not the bobbing sprite) at integer pixels, and avoids other plates, the hero, the HUD and the screen safe
// area (a leader line is drawn when a plate had to move). Only a few plates are shown: the target, the hovered
// monster and the nearest awake ones (label discipline: 50 monsters must not become 50 text boxes).
import { fontPx } from "../ui/layout.js";

export const MAX_PLATES = 5;
const SAFE = 8;
const FONT = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";
const byPriority = (p, q) => p.pr - q.pr;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function createLabels(style) {
  const P = style.palette, cache = new Map();
  const placed = Array.from({ length: MAX_PLATES }, () => ({ x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0, sprite: null, ratio: 0, moved: false, id: "" }));
  const cand = [];
  const heroRect = { x: 0, y: 0, w: 0, h: 0 };
  const L = {
    count: 0, placed,
    /** Plate sprite for a name; geometry in CSS px, canvas at `dpr`. */
    sprite(name, fs, hc, dpr) {
      const key = `${name}|${fs}|${hc ? 1 : 0}|${dpr}`;
      let s = cache.get(key);
      if (s) return s;
      const pal = hc ? P.plateHc : P.plate, probe = document.createElement("canvas").getContext("2d"), font = `800 ${fs}px ${FONT}`;
      probe.font = font;
      const barH = Math.max(5, Math.round(fs * 0.4)), w = Math.ceil(Math.max(probe.measureText(name).width + 16, fs * 5)), h = fs + barH + 11, pad = 3;
      const c = document.createElement("canvas");
      c.width = Math.ceil((w + pad * 2) * dpr); c.height = Math.ceil((h + pad * 2) * dpr);
      const g = c.getContext("2d");
      g.scale(dpr, dpr); g.lineJoin = "round";
      g.beginPath(); g.roundRect(pad, pad, w, h, 5);
      g.fillStyle = pal.bg; g.fill();
      g.lineWidth = hc ? 3 : 3.2; g.strokeStyle = hc ? pal.edge : P.ink; g.stroke();
      if (hc) { g.lineWidth = 1.5; g.strokeStyle = "#000"; g.stroke(); }
      g.font = font; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = pal.text;
      g.fillText(name, pad + w / 2, pad + fs + 2);
      g.fillStyle = pal.hpTrack; g.fillRect(pad + 5, pad + h - barH - 4, w - 10, barH);
      s = { c, w: w + pad * 2, h: h + pad * 2, pad, barX: pad + 5, barY: pad + h - barH - 4, barW: w - 10, barH, hp: pal.hp };
      cache.set(key, s);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
      return s;
    },

    /**
     * Choose and place plates. actors: [{ id, type, name, hp, hpMax, dead, x, y (tile pos + feet on screen: sx, sy), d (tile distance to hero) }].
     * obstacles: [{x,y,w,h}] (HUD rects). Returns the number of plates placed (L.placed[0..n)).
     */
    place(actors, cam, s, targetId, hoverId, heroS, obstacles, hc, dpr) {
      cand.length = 0;
      for (const a of actors) {
        if (a.dead) continue;
        const pr = a.id === targetId ? 0 : a.id === hoverId ? 1 : a.d <= 5 && a.ai !== "idle" ? 2 + a.d / 10 : a.d <= 3 ? 3 + a.d / 10 : -1;
        if (pr < 0 || a.sy - (style.dims[a.type]?.head ?? 50) * cam.z < 6 || a.sy > cam.h + 140 || a.sx < -40 || a.sx > cam.w + 40) continue;
        a.pr = pr; cand.push(a);
      }
      cand.sort(byPriority);
      heroRect.x = heroS.x - 22 * cam.z; heroRect.w = 44 * cam.z; heroRect.h = 56 * cam.z; heroRect.y = heroS.y - heroRect.h;
      const fs = fontPx(s, 9.5, 12);
      let n = 0;
      for (const a of cand) {
        if (n >= MAX_PLATES) break;
        const sp = L.sprite(a.name, fs, hc, dpr), r = placed[n];
        const ax = Math.round(a.sx), ay = Math.round(a.sy - (style.dims[a.type]?.head ?? 50) * cam.z - 5 * s);
        r.w = sp.w; r.h = sp.h; r.sprite = sp; r.ax = ax; r.ay = ay; r.id = a.id; r.ratio = a.hpMax > 0 ? Math.max(0, Math.min(1, a.hp / a.hpMax)) : 0;
        let ok = false;
        for (let k = 0; k < 4 && !ok; k++) {
          r.x = Math.min(cam.w - SAFE - r.w, Math.max(SAFE, ax - Math.round(r.w / 2)));
          r.y = Math.max(SAFE, ay - r.h - k * (r.h + 3));
          ok = !overlap(r, heroRect);
          for (let j = 0; j < n && ok; j++) if (overlap(r, placed[j])) ok = false;
          for (let j = 0; j < obstacles.length && ok; j++) if (overlap(r, obstacles[j])) ok = false;
          r.moved = Math.abs(r.x + r.w / 2 - ax) > 6 || ay - r.h - r.y > 4;
        }
        if (ok || a.pr <= 1) n++; // the target and the hovered monster always get a plate
      }
      L.count = n;
      return n;
    },

    draw(g) {
      for (let i = 0; i < L.count; i++) {
        const r = placed[i], sp = r.sprite;
        if (r.moved) { // leader line from the plate to the head
          g.lineCap = "round"; g.strokeStyle = P.ink; g.lineWidth = 3.4; g.beginPath(); g.moveTo(r.x + r.w / 2, r.y + r.h); g.lineTo(r.ax, r.ay); g.stroke();
          g.strokeStyle = "#f3eefc"; g.lineWidth = 1.4; g.stroke();
        }
        g.drawImage(sp.c, r.x, r.y, sp.w, sp.h);
        const bw = sp.barW * r.ratio;
        g.fillStyle = sp.hp; g.fillRect(r.x + sp.barX, r.y + sp.barY, bw, sp.barH);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(r.x + sp.barX, r.y + sp.barY, bw, sp.barH * 0.38);
      }
    },
  };
  return L;
}
