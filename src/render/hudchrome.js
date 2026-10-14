// HUD chrome (G round, item 4): pure draw functions for the panel sheen, inner shadow, stitched border, rivets, slot wells and the mug glaze / jug ribs.
// hud.js (owned by UI-R5) calls them while it bakes its static layers; nothing here runs per frame. All coordinates are CSS px in the target context.
import { INK } from "./draw/shapes.js";

const TAU = Math.PI * 2;
export function rivet(g, x, y, rad) {
  g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fillStyle = "#e6ecfa"; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.35, 0, TAU); g.fillStyle = "rgba(255,255,255,0.9)"; g.fill();
}

/**
 * Chrome of a rounded panel, drawn AFTER its fill and outline: sheen, blurred inner shadow, top bevel, stitched border, corner rivets.
 * r = {x,y,w,h}; s = HUD scale. Skip it in high-contrast mode.
 */
export function drawPanelChrome(g, r, s) {
  const rad = 8 * s;
  g.save(); g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, rad); g.clip();
  const sheen = g.createLinearGradient(0, r.y, 0, r.y + r.h);
  sheen.addColorStop(0, "rgba(255,255,255,0.12)"); sheen.addColorStop(0.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = sheen; g.fillRect(r.x, r.y, r.w, r.h);
  g.shadowColor = "rgba(0,0,0,0.65)"; g.shadowBlur = 10 * s; g.fillStyle = "#000";
  g.beginPath(); g.rect(r.x - 30, r.y - 30, r.w + 60, r.h + 60); g.roundRect(r.x + 3 * s, r.y + 3 * s, r.w - 6 * s, r.h - 3 * s, rad); g.fill("evenodd");
  g.shadowBlur = 0; g.shadowColor = "transparent";
  g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(r.x + rad, r.y + 1.4); g.lineTo(r.x + r.w - rad, r.y + 1.4); g.stroke();
  const inset = 5.5 * s;
  g.setLineDash([5 * s, 4 * s]);
  g.strokeStyle = "rgba(8,4,30,0.7)"; g.lineWidth = 1.6; g.beginPath(); g.roundRect(r.x + inset, r.y + inset + 1, r.w - 2 * inset, r.h - 2 * inset, rad * 0.7); g.stroke();
  g.strokeStyle = "rgba(190,175,255,0.6)"; g.lineWidth = 1.3; g.beginPath(); g.roundRect(r.x + inset, r.y + inset, r.w - 2 * inset, r.h - 2 * inset, rad * 0.7); g.stroke();
  g.setLineDash([]); g.restore();
  const rv = Math.max(2.2, 2.6 * s), o = 3.2 * s + rv;
  for (const [x, y] of [[r.x + o, r.y + o], [r.x + r.w - o, r.y + o], [r.x + o, r.y + r.h - o], [r.x + r.w - o, r.y + r.h - o]]) rivet(g, x, y, rv);
}

/** Pixel-snapped copy of a rect, for slot wells and icons (crisp edges, identical to the DOM slots). */
export const snapRect = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

/** Shading of an empty slot well in a w x h box (call after the well fill): dark inner top, lit lip, four corner studs. */
export function drawSlotChrome(g, w, h, active, radius) {
  g.save(); g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, radius); g.clip();
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0.45)"); gr.addColorStop(0.35, "rgba(0,0,0,0)"); gr.addColorStop(0.8, "rgba(255,255,255,0)"); gr.addColorStop(1, active ? "rgba(255,230,120,0.3)" : "rgba(190,180,255,0.16)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore();
  g.fillStyle = active ? "#ffe9a0" : "#a89cf0";
  for (const [qx, qy] of [[0.17, 0.17], [0.83, 0.17], [0.17, 0.83], [0.83, 0.83]]) { g.beginPath(); g.arc(Math.round(w * qx), Math.round(h * qy), Math.max(1, w * 0.024), 0, TAU); g.fill(); }
}

/**
 * Glaze (kind "health": ceramic mug, stitched bands and speckle) or ribbed plastic ("mana": jug) inside the vessel outline, plus four rivets.
 * Draws in vessel reference coordinates (VESSEL_REF, after the frame's translate); `clipPath(g)` must build the vessel interior path. Used by ui.js drawVesselFrame.
 */
export function drawGlobeChrome(g, kind, clipPath) {
  g.save(); clipPath(g); g.clip();
  let gr = g.createLinearGradient(8, 0, 76, 0);
  gr.addColorStop(0, "rgba(255,255,255,0.24)"); gr.addColorStop(0.3, "rgba(255,255,255,0.02)"); gr.addColorStop(0.75, "rgba(0,0,20,0.1)"); gr.addColorStop(1, "rgba(0,0,20,0.32)");
  g.fillStyle = gr; g.fillRect(0, 0, 90, 120);
  gr = g.createLinearGradient(0, 14, 0, 40); gr.addColorStop(0, "rgba(0,0,20,0.35)"); gr.addColorStop(1, "rgba(0,0,20,0)"); g.fillStyle = gr; g.fillRect(0, 14, 90, 26);
  if (kind === "health") {
    g.setLineDash([5, 4]); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(8, 28); g.lineTo(76, 28); g.moveTo(8, 84); g.lineTo(76, 84); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(255,255,255,0.28)"; let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) g.fillRect(14 + rnd() * 54, 34 + rnd() * 44, 1.6, 1.6);
  } else {
    for (let k = 0; k < 7; k++) { const y = 44 + k * 10; g.fillStyle = "rgba(0,0,30,0.22)"; g.fillRect(8, y, 68, 2); g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(8, y + 2, 68, 1.4); }
  }
  g.restore();
  const pts = kind === "health" ? [[14, 20], [70, 20], [14, 88], [70, 88]] : [[15, 62], [69, 62], [15, 106], [69, 106]];
  for (const [x, y] of pts) rivet(g, x, y, 2.4);
}

/** Bake the panel chrome of a rect into its own canvas (for callers that composite layers): returns a canvas of the rect's size at dpr. */
export function bakeHudChrome(rect, s, dpr = 1) {
  const c = document.createElement("canvas"); c.width = Math.ceil(rect.w * dpr); c.height = Math.ceil(rect.h * dpr);
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPanelChrome(g, { x: 0, y: 0, w: rect.w, h: rect.h }, s);
  return c;
}
