// Nameplates. Pre-rendered once per (name, size, mode) into small canvases; the HP bar fill is the only live part.
// One placement pass per frame: every plate sits directly above its actor's head, anchored to the actor's logical
// position (not the bobbing sprite) at integer pixels, and avoids other plates, the hero, the HUD and the screen safe
// area (a leader line is drawn when a plate had to move). Only a few plates are shown: the target, the hovered
// monster and the nearest awake ones (label discipline: 50 monsters must not become 50 text boxes).
import { fontPx } from "../ui/layout.js";

export const MAX_PLATES = 5;
const MAX_PIPS = 16;
const SAFE = 8;
const FONT = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";
const byPriority = (p, q) => p.pr - q.pr;
/** True when the plate rect covers the body of another actor (its sprite spans about 40 px across, from the feet to the head). */
function onSprite(r, actors, self, cam, style) {
  const z = cam.z;
  for (const o of actors) {
    if (o === self || o.dead || o.sx < r.x - 30 * z || o.sx > r.x + r.w + 30 * z) continue;
    const head = (style.dims[o.type]?.head ?? 50) * z, b = { x: o.sx - 18 * z, y: o.sy - head, w: 36 * z, h: head * 0.92 };
    if (overlap(r, b)) return true;
  }
  return false;
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function createLabels(style) {
  const P = style.palette, cache = new Map();
  const placed = Array.from({ length: MAX_PLATES }, () => ({ x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0, sprite: null, ratio: 0, moved: false, id: "", name: "" }));
  const cand = [], pips = Array.from({ length: MAX_PIPS }, () => ({ x: 0, y: 0, w: 0, h: 0, ratio: 0, id: "" }));
  let pipN = 0;
  const heroRect = { x: 0, y: 0, w: 0, h: 0 };
  const L = {
    count: 0, placed,
    /** Plate sprite for a name; geometry in CSS px, canvas at `dpr`. */
    sprite(name, fs, hc, dpr, bar = true, sub = "", champ = false) {
      const key = `${name}|${fs}|${hc ? 1 : 0}|${dpr}|${bar ? 1 : 0}|${sub}|${champ ? 1 : 0}`;
      let s = cache.get(key);
      if (s) return s;
      const pal = hc ? P.plateHc : P.plate, probe = document.createElement("canvas").getContext("2d"), font = `800 ${fs}px ${FONT}`;
      probe.font = font;
      const barH = bar ? Math.max(5, Math.round(fs * 0.4)) : 0, subFs = Math.max(10, Math.round(fs * 0.82)), subFont = `700 ${subFs}px ${FONT}`;
      let subW = 0;
      if (sub) { probe.font = subFont; subW = probe.measureText(sub).width; probe.font = font; }
      const w = Math.ceil(Math.max(probe.measureText(name).width + 16, subW + 16, bar ? fs * 5 : fs * 3)), h = fs + (bar ? barH + 11 : 9) + (sub ? subFs + 3 : 0), pad = 3;
      const c = document.createElement("canvas");
      c.width = Math.ceil((w + pad * 2) * dpr); c.height = Math.ceil((h + pad * 2) * dpr);
      const g = c.getContext("2d");
      g.scale(dpr, dpr); g.lineJoin = "round";
      g.beginPath(); g.roundRect(pad, pad, w, h, 5);
      g.fillStyle = pal.bg; g.fill();
      g.lineWidth = hc ? 3 : 3.2; g.strokeStyle = hc ? pal.edge : P.ink; g.stroke();
      if (champ) { g.lineWidth = 2; g.strokeStyle = P.champion; g.stroke(); }
      if (hc) { g.lineWidth = 1.5; g.strokeStyle = "#000"; g.stroke(); }
      g.font = font; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = pal.text;
      g.fillText(name, pad + w / 2, pad + fs + 2);
      if (sub) { g.font = subFont; g.fillStyle = champ && !hc ? "#f0b6d6" : pal.text; g.fillText(sub, pad + w / 2, pad + fs + 2 + subFs + 1); }
      if (bar) { g.fillStyle = pal.hpTrack; g.fillRect(pad + 5, pad + h - barH - 4, w - 10, barH); }
      s = { c, w: w + pad * 2, h: h + pad * 2, pad, barX: pad + 5, barY: pad + h - barH - 4, barW: w - 10, barH, hp: pal.hp, bar };
      cache.set(key, s);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
      return s;
    },

    /**
     * Choose and place plates. actors: [{ id, type, name, hp, hpMax, dead, x, y (tile pos + feet on screen: sx, sy), d (tile distance to hero) }].
     * obstacles: [{x,y,w,h}] (HUD rects). Returns the number of plates placed (L.placed[0..n)).
     */
    place(actors, cam, s, targetId, hoverId, heroS, obstacles, hc, dpr) {
      cand.length = 0; pipN = 0;
      const z = cam.z;
      // 1. visible, live candidates; full plates go to the target, the hovered monster and the nearest 2 others (plate discipline)
      for (const a of actors) {
        if (a.dead || a.hid) continue;
        const head = style.dims[a.type]?.head ?? 50;
        if (a.npc && a.d > 8) continue;
        if ((!a.npc && a.d > 7) || a.sy - head * z < 6 || a.sy > cam.h + 140 || a.sx < -40 || a.sx > cam.w + 40) continue;
        if (a.npc) { if (a.d > 8) continue; a.pr = a.d <= 4 ? 1.5 : 2.5 + a.d / 10; cand.push(a); continue; }
        a.pr = a.id === targetId ? 0 : a.id === hoverId ? 1 : a.d <= 5 && a.ai !== "idle" ? 2 + a.d / 10 : a.d <= 3 ? 3 + a.d / 10 : 9 + a.d / 10;
        if (a.champ && a.pr > 1.8) a.pr = 1.8; // champions always keep their plate (name and modifiers)
        cand.push(a);
      }
      cand.sort(byPriority);
      heroRect.x = heroS.x - 22 * z; heroRect.w = 44 * z; heroRect.h = 56 * z; heroRect.y = heroS.y - heroRect.h;
      const fs = fontPx(s, 9.5, 12);
      let n = 0, others = 0;
      for (const a of cand) {
        // S2 fix: full plates only for the target, the hovered monster, champions and NPCs; the rest of a pack gets a health pip.
        // A second plate with the same name near an existing one is never stacked (it would read as a duplicate on one leader line).
        const forced = a.pr <= 1 || a.npc || a.champ, full = forced || (n === 0 && a.pr < 9 && !a.npc); // nobody targeted: the nearest awake enemy keeps one plate
        if (!full || n >= MAX_PLATES) continue;
        let dup = false;
        for (let j = 0; j < n && !dup; j++) if (placed[j].name === a.name && !a.npc && a.pr > 0 && Math.abs(placed[j].ax - a.sx) < placed[j].w * 1.2) dup = true;
        if (dup) continue;
        const head = style.dims[a.type]?.head ?? 50;
        const sp = L.sprite(a.name, fs, hc, dpr, !a.npc, a.sub, a.champ), r = placed[n];
        const ax = Math.round(a.sx), ay = Math.round(a.sy - head * z - 5 * s);
        r.w = sp.w; r.h = sp.h; r.sprite = sp; r.ax = ax; r.ay = ay; r.id = a.id; r.name = a.name; r.ratio = a.hpMax > 0 ? Math.max(0, Math.min(1, a.hp / a.hpMax)) : 0;
        let ok = false;
        for (let k = 0; k < 5 && !ok; k++) {
          r.x = Math.min(cam.w - SAFE - r.w, Math.max(SAFE, ax - Math.round(r.w / 2)));
          r.y = Math.max(SAFE, ay - r.h - k * (r.h + 3));
          ok = !overlap(r, heroRect) && !onSprite(r, actors, a, cam, style);
          for (let j = 0; j < n && ok; j++) if (overlap(r, placed[j])) ok = false;
          for (let j = 0; j < obstacles.length && ok; j++) if (overlap(r, obstacles[j])) ok = false;
          r.moved = Math.abs(r.x + r.w / 2 - ax) > 6 || ay - r.h - r.y > 4;
        }
        if (ok || forced) { n++; if (!forced) others++; a.pr = -1; }
      }
      L.count = n;
      // 2. everyone else in the light gets a mini health pip right above the head (skipped when a plate already sits there)
      const pw = Math.round(26 * s), ph = Math.max(4, Math.round(4.5 * s));
      for (const a of cand) {
        if (a.pr < 0 || a.npc || pipN >= MAX_PIPS) continue;
        const head = style.dims[a.type]?.head ?? 50, pp = pips[pipN];
        pp.w = pw; pp.h = ph; pp.x = Math.round(a.sx - pw / 2); pp.y = Math.round(a.sy - head * z - 4 * s - ph);
        pp.ratio = a.hpMax > 0 ? Math.max(0, Math.min(1, a.hp / a.hpMax)) : 0; pp.id = a.id;
        let ok = pp.x > SAFE && pp.x + pw < cam.w - SAFE && pp.y > SAFE;
        for (let j = 0; j < n && ok; j++) if (overlap(pp, placed[j])) ok = false;
        for (let j = 0; j < obstacles.length && ok; j++) if (overlap(pp, obstacles[j])) ok = false;
        if (ok) pipN++;
      }
      return n;
    },

    /**
     * The space the placement pass has claimed this frame, for the other label layers (ground-loot plates, floaters): plate and pip
     * rectangles go to `rects`, leader lines to `segs` ([x1, y1, x2, y2] each). Both arrays are cleared first.
     */
    collect(rects, segs) {
      rects.length = 0; segs.length = 0;
      for (let i = 0; i < L.count; i++) {
        const r = placed[i];
        rects.push({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4, plate: true });
        if (r.moved) segs.push([r.x + r.w / 2, r.y + r.h, r.ax, r.ay]);
      }
      for (let i = 0; i < pipN; i++) { const p = pips[i]; rects.push({ x: p.x - 2, y: p.y - 2, w: p.w + 4, h: p.h + 4, plate: false }); }
    },

    draw(g) {
      for (let i = 0; i < pipN; i++) { // mini health pips for the rest of the pack
        const p = pips[i];
        g.fillStyle = P.ink; g.fillRect(p.x - 1.5, p.y - 1.5, p.w + 3, p.h + 3);
        g.fillStyle = P.plate.hpTrack; g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = P.plate.hp; g.fillRect(p.x, p.y, p.w * p.ratio, p.h);
      }
      for (let i = 0; i < L.count; i++) {
        const r = placed[i], sp = r.sprite;
        if (r.moved) { // leader line from the plate to the head
          g.lineCap = "round"; g.strokeStyle = P.ink; g.lineWidth = 3.4; g.beginPath(); g.moveTo(r.x + r.w / 2, r.y + r.h); g.lineTo(r.ax, r.ay); g.stroke();
          g.strokeStyle = "#f3eefc"; g.lineWidth = 1.4; g.stroke();
        }
        g.drawImage(sp.c, r.x, r.y, sp.w, sp.h);
        if (!sp.bar) continue;
        const bw = sp.barW * r.ratio;
        g.fillStyle = sp.hp; g.fillRect(r.x + sp.barX, r.y + sp.barY, bw, sp.barH);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(r.x + sp.barX, r.y + sp.barY, bw, sp.barH * 0.38);
      }
    },
  };
  return L;
}
