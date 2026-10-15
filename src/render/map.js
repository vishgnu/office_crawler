// Floor map (R-075): a minimap in a corner and a full automap overlay, drawn from floor.explored in the C2 style (ink outlines,
// indigo floors, teal walls). Render-only: it reads the state and never writes it. The explored tiles are baked once into a small
// canvas (one cell per tile) and re-baked only when the hero changes tile or floor; the markers (hero, stairs, people, exit door)
// are drawn live on top. Phone mode: no minimap (the automap overlay still works on M / Tab).
import { WALL, DOOR, STAIRS_UP, STAIRS_DOWN, FLOOR, VOID } from "../core/tiles.js";
import { T } from "../ui/text.js";
import { isPhone } from "../ui/layout.js";
import { mapMarkers } from "../core/index.js";
import { drawMapPin } from "./questmark.js";

const CELL = 6;                                   // baked pixels per tile
const FONT = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";

/** The explored array of the current floor, or null when the core does not provide one. */
export const exploredOf = (core) => core?.floor?.explored ?? core?.floors?.[core?.depth]?.explored ?? null;

export function createMap(style) {
  const P = style.palette;
  let baked = null; // { key, c, w, h }
  // R7-0.7: the pinned quest's known targets (core.mapMarkers), recomputed only when what they depend on changes (depth, pin, quest states, hero tile), so a steady frame allocates nothing
  const qm = { depth: -1, pin: "", sig: -1, hx: -1, hy: -1, list: [] };
  const questMarkers = (core) => {
    const qs = core.quests;
    if (!qs) return qm.list.length ? (qm.list = []) : qm.list;
    const t = core.player.tile, pin = qs.pinned ?? "";
    let sig = 0;
    for (const id of ["sq1", "sq2", "sq3", "sq4", "sq5"]) sig = sig * 4 + (qs[id]?.s === "available" ? 1 : qs[id]?.s === "active" ? 2 : qs[id]?.s === "ready" ? 3 : 0);
    const m = qs.main?.m;
    if (m) sig = (sig * 16 + Math.min(15, m.depth | 0)) * 16 + (m.memo ? 1 : 0) + (m.unlocked ? 2 : 0) + (m.defeated ? 4 : 0) + (m.verdict ? 8 : 0); // ten steps over three arcs: the depth itself moves the active arc's target
    if (qm.depth !== core.depth || qm.pin !== pin || qm.sig !== sig || qm.hx !== t.x || qm.hy !== t.y) {
      qm.depth = core.depth; qm.pin = pin; qm.sig = sig; qm.hx = t.x; qm.hy = t.y;
      qm.list = mapMarkers(core);
    }
    return qm.list;
  };

  function bake(core, ex) {
    const f = core.floor, { w, h, tiles } = f, t = core.player.tile;
    const key = `${core.depth}|${f.theme}|${t.x},${t.y}|${w}x${h}`;
    if (baked && baked.key === key) return baked;
    const th = (f.theme && P.themes?.[f.theme]) || P, fl = Object.values(th.floors ?? P.floors)[0], wl = th.wall ?? P.wall;
    const c = baked?.c && baked.c.width === w * CELL && baked.c.height === h * CELL ? baked.c : document.createElement("canvas");
    c.width = w * CELL; c.height = h * CELL;
    const g = c.getContext("2d");
    const seen = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ex[y * w + x] === 1;
    const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] !== WALL && tiles[y * w + x] !== VOID;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const code = tiles[y * w + x];
      if (!seen(x, y) || code === VOID) continue;
      const px = x * CELL, py = y * CELL;
      if (code === WALL) {
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open(x + dx, y + dy)) { edge = true; break; }
        if (!edge) continue;
        g.fillStyle = wl.base; g.fillRect(px, py, CELL, CELL);
        g.fillStyle = wl.left; g.fillRect(px, py, CELL, 2);
      } else {
        g.fillStyle = code === DOOR ? wl.trim : ((x + y) & 1 ? fl[0] : fl[1]); g.fillRect(px, py, CELL, CELL);
        if (code === DOOR) { g.fillStyle = P.ink; g.fillRect(px + 2, py + 1, 2, CELL - 2); }
      }
    }
    // ink outline: a dark edge on every wall tile side that faces an explored open tile
    g.fillStyle = P.ink;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!seen(x, y) || tiles[y * w + x] !== WALL) continue;
      if (open(x, y + 1) && seen(x, y + 1)) g.fillRect(x * CELL, (y + 1) * CELL - 1, CELL, 1);
      if (open(x + 1, y) && seen(x + 1, y)) g.fillRect((x + 1) * CELL - 1, y * CELL, 1, CELL);
    }
    baked = { key, c, w, h };
    return baked;
  }

  const poly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = P.ink; g.stroke(); };

  /** Markers on top of the baked map. at(tx, ty) -> screen {x,y} of the tile centre; u = marker size in px. */
  function markers(g, core, ex, at, u, now, clip, labelsOn) {
    const f = core.floor, w = f.w, seen = (t) => !!t && (core.depth === 0 || ex[t.y * w + t.x] === 1), pt = { x: 0, y: 0 };
    const place = (t) => { const p = at(t.x + 0.5, t.y + 0.5); pt.x = p.x; pt.y = p.y; return pt.x >= clip.x && pt.y >= clip.y && pt.x <= clip.x + clip.w && pt.y <= clip.y + clip.h; };
    g.save(); g.beginPath(); g.rect(clip.x, clip.y, clip.w, clip.h); g.clip();
    if (f.entry && seen(f.entry) && place(f.entry)) { const { x, y } = pt; poly(g, [[x, y - u], [x + u * 0.85, y + u * 0.6], [x - u * 0.85, y + u * 0.6]], "#e8ecf8"); }
    if (f.exit && seen(f.exit) && place(f.exit)) { const { x, y } = pt; poly(g, [[x, y + u], [x + u * 0.85, y - u * 0.6], [x - u * 0.85, y - u * 0.6]], "#ffd24d"); }
    for (const n of f.npcs ?? []) if (seen(n.tile) && place(n.tile)) { g.beginPath(); g.arc(pt.x, pt.y, u * 0.62, 0, Math.PI * 2); g.fillStyle = "#8ff3ff"; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke(); }
    const door = core.portal ? (core.depth === 0 ? core.portal.lobbyTile : core.depth === core.portal.depth ? core.portal.tile : null) : null;
    if (door && place(door)) {
      const { x, y } = pt, pulse = 0.85 + 0.15 * Math.sin(now / 260);
      g.beginPath(); g.ellipse(x, y, u * 0.62 * pulse, u * 0.95 * pulse, 0, 0, Math.PI * 2); g.fillStyle = "#b48cff"; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
      g.beginPath(); g.ellipse(x, y, u * 0.28, u * 0.5, 0, 0, Math.PI * 2); g.fillStyle = "#f3eefc"; g.fill();
    }
    const qlist = questMarkers(core);
    for (let i = 0; i < qlist.length; i++) if (place(qlist[i].tile)) drawMapPin(g, pt.x, pt.y - u * 1.2, u, P.ink);
    const hp = core.player.tile;
    if (place(hp)) {
      const { x, y } = pt, pulse = 0.5 + 0.5 * Math.sin(now / 300);
      g.beginPath(); g.arc(x, y, u * (1.1 + 0.35 * pulse), 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${0.7 - 0.4 * pulse})`; g.stroke();
      g.beginPath(); g.arc(x, y, u * 0.9, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
      g.beginPath(); g.arc(x, y, u * 0.32, 0, Math.PI * 2); g.fillStyle = "#e0363f"; g.fill();
    }
    g.restore();
    if (labelsOn) for (let i = 0; i < qlist.length; i++) { // the text label next to the pin (not colour only), kept inside the canvas
      const p = at(qlist[i].tile.x + 0.5, qlist[i].tile.y + 0.5), txt = qlist[i].label, fs = Math.max(12, Math.min(15, u * 1.9));
      g.font = `800 ${fs}px ${FONT}`; g.textBaseline = "middle"; g.lineWidth = 4; g.lineJoin = "round"; g.strokeStyle = P.ink; g.fillStyle = "#f0e442";
      const tw = g.measureText(txt).width, left = p.x + u * 1.6 + tw + 8 < labelsOn.w;
      g.textAlign = left ? "left" : "right";
      const x = left ? p.x + u * 1.6 : p.x - u * 1.6, y = p.y - u * 1.2;
      g.strokeText(txt, x, y); g.fillText(txt, x, y);
    }
  }

  const frame = (g, r, hc, a = 0.82) => {
    g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 8);
    g.fillStyle = hc ? "#000" : `rgba(10,8,28,${a})`; g.fill();
    g.lineWidth = 3.4; g.strokeStyle = hc ? "#fff" : P.ui?.panelEdge ?? P.ink; g.stroke();
  };

  const M = {
    /** Minimap rectangle (CSS px), top-left under the floor name; null in phone mode. */
    miniRect(w, h, L) {
      if (isPhone(w, h)) return null;
      const s = Math.max(1, Math.min(1.4, L.scale)), mw = Math.round(176 * s), mh = Math.round(124 * s);
      return { x: Math.round(12 * s), y: Math.round(L.floorName.y + 12 * s), w: mw, h: mh };
    },
    /** Does anything need drawing (the core provides an explored array)? */
    available: (core) => !!core && !!exploredOf(core),

    drawMini(g, core, rect, now, hc) {
      const ex = exploredOf(core);
      if (!ex || !rect) return;
      const b = bake(core, ex), px = 6, vw = rect.w / px, vh = rect.h / px, t = core.player.tile;
      frame(g, rect, hc);
      g.save(); g.beginPath(); g.roundRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, 6); g.clip();
      g.imageSmoothingEnabled = false;
      const sx = t.x + 0.5 - vw / 2, sy = t.y + 0.5 - vh / 2; // top-left tile (float) of the window
      // source rect clipped to the map; the destination follows
      const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(b.w, sx + vw), y1 = Math.min(b.h, sy + vh);
      if (x1 > x0 && y1 > y0) g.drawImage(b.c, x0 * CELL, y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL, rect.x + (x0 - sx) * px, rect.y + (y0 - sy) * px, (x1 - x0) * px, (y1 - y0) * px);
      g.imageSmoothingEnabled = true;
      g.restore();
      markers(g, core, ex, (tx, ty) => ({ x: rect.x + (tx - sx) * px, y: rect.y + (ty - sy) * px }), 4.6, now, { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6 });
    },

    /** Full automap: dims the world, centres the whole floor at the largest whole-pixel scale that fits. */
    drawFull(g, core, w, h, now, hc) {
      const ex = exploredOf(core);
      g.fillStyle = "rgba(7,5,24,0.74)"; g.fillRect(0, 0, w, h);
      const phone = isPhone(w, h), titleH = phone ? 40 : 52, legH = 30, footH = (phone ? 96 : Math.max(140, Math.round(h * 0.2))) + legH - 38, pad = phone ? 8 : 24; // VFIX-R7 G3: the card (map + legend) ends above the hotbar
      const f = core.floor;
      const title = core.depth > 0 ? `${T.floorWord} ${core.depth}: ${f.name}` : f.name;
      g.fillStyle = hc ? "#000" : "rgba(7,5,24,0.97)"; g.fillRect(0, 0, w, titleH + 4); // VFIX-R7 G3: a solid band behind the title, so an NPC marker of the world never shows through it
      g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
      g.font = `800 ${phone ? 17 : 22}px ${FONT}`; g.lineWidth = 5; g.strokeStyle = P.ink; g.strokeText(`${T.mapTitle}: ${title}`, w / 2, titleH - 14); g.fillStyle = "#f3eefc"; g.fillText(`${T.mapTitle}: ${title}`, w / 2, titleH - 14);
      if (!ex) { g.font = `700 16px ${FONT}`; g.fillStyle = "#c9c3ec"; g.fillText(T.mapUnexplored, w / 2, h / 2); return; }
      const b = bake(core, ex);
      // crop to the explored area (plus a margin): a floor is large and a mostly empty frame would waste the screen
      let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (ex[y * f.w + x] === 1) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pt = core.player.tile;
      x0 = Math.max(0, Math.min(x0, pt.x) - 2); y0 = Math.max(0, Math.min(y0, pt.y) - 2); x1 = Math.min(f.w - 1, Math.max(x1, pt.x) + 2); y1 = Math.min(f.h - 1, Math.max(y1, pt.y) + 2);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, availW = w - pad * 2 - 16, availH = h - titleH - footH - pad - 16;
      const sc = Math.max(2, Math.min(14, availW / bw, availH / bh)), mw = bw * sc, mh = bh * sc;
      const rect = { x: Math.round((w - mw) / 2), y: Math.round(titleH + (availH - mh) / 2 + 8), w: Math.round(mw), h: Math.round(mh) };
      frame(g, { x: rect.x - 8, y: rect.y - 8, w: rect.w + 16, h: rect.h + 16 + legH }, hc, 0.95);
      g.save(); g.beginPath(); g.roundRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, 5); g.clip();
      g.imageSmoothingEnabled = false; g.drawImage(b.c, x0 * CELL, y0 * CELL, bw * CELL, bh * CELL, rect.x, rect.y, rect.w, rect.h); g.imageSmoothingEnabled = true;
      g.restore();
      markers(g, core, ex, (tx, ty) => ({ x: rect.x + (tx - x0) * sc, y: rect.y + (ty - y0) * sc }), Math.max(3.5, Math.min(8, sc * 0.9)), now, { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + 12 }, { w });
      g.font = `700 ${phone ? 12 : 14}px ${FONT}`; g.lineWidth = 4; g.strokeStyle = P.ink;
      const ly = rect.y + rect.h + 8 + legH - 12; // inside the card, under the map
      g.strokeText(T.mapLegend, w / 2, ly); g.fillStyle = "#c9c3ec"; g.fillText(T.mapLegend, w / 2, ly);
    },
  };
  return M;
}
