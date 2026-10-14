// Office props. Each prop is drawn on a 64x72 canvas with the tile centre (ground) at (32, 56).
import { palette as P } from "./palette.js";
import { box, fillPoly, ellipse, line, shade, INK } from "../../draw/shapes.js";

export const PROP_W = 64, PROP_H = 72, PROP_CX = 32, PROP_CY = 56;
const CX = PROP_CX, CY = PROP_CY;
const mat = (base, rim = P.rim, tex = null) => ({ top: shade(base, 0.18), left: base, right: shade(base, -0.28), rim, tex });
/** Soft contact shadow (G round, item 2): four stacked footprints, growing and fading, offset away from the upper-left light. */
const shadow = (g, rx = 26, ry = 12) => { for (let k = 0; k < 4; k++) ellipse(g, CX + 2, CY + 2, rx * (1.04 - k * 0.07), ry * (1.1 - k * 0.08), "rgba(5,3,18,0.13)"); };

const draw = {
  desk(g) {
    shadow(g);
    const wood = mat("#8a5230", P.rim, ["wood", 0.9]);
    box(g, CX, CY, { u0: -0.44, u1: 0.44, v0: -0.32, v1: 0.4, h: 15 }, wood);
    // monitor at the back, screen glowing on its lower-left face
    const m = box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.28, v1: -0.2, z0: 15, h: 13 }, mat("#363a5e"));
    fillPoly(g, [m.P(-0.17, -0.2, 17), m.P(0.17, -0.2, 17), m.P(0.17, -0.2, 26), m.P(-0.17, -0.2, 26)], "#8ff3ff");
    fillPoly(g, [m.P(-0.17, -0.2, 17), m.P(0.0, -0.2, 17), m.P(0.0, -0.2, 26), m.P(-0.17, -0.2, 26)], shade("#8ff3ff", -0.22));
    box(g, CX, CY, { u0: -0.22, u1: 0.22, v0: 0.02, v1: 0.14, z0: 15, h: 1.6 }, mat("#aab4cc"));
  },
  partition(g) {
    shadow(g, 28, 10);
    box(g, CX, CY, { u0: -0.5, u1: 0.5, v0: -0.07, v1: 0.07, h: 34 }, { top: "#3a9aa2", left: "#2d8a92", right: "#237681", rim: P.wall.rim });
    box(g, CX, CY, { u0: -0.5, u1: 0.5, v0: -0.075, v1: 0.075, z0: 28, h: 6 }, { top: "#d3a64a", left: "#b89040", right: "#8a6a28", rim: "#ffe9a8" });
  },
  plant(g) {
    shadow(g, 16, 8);
    box(g, CX, CY, { u0: -0.17, u1: 0.17, v0: -0.17, v1: 0.17, h: 10 }, mat("#a4553a"));
    const leaf = (x, y, rx, ry, rot, c) => { g.save(); g.translate(x, y); g.rotate(rot); ellipse(g, 0, 0, rx, ry, c, INK, 1.5); g.restore(); };
    leaf(CX - 7, CY - 24, 4.5, 11, -0.6, "#2f6b3b"); leaf(CX + 7, CY - 25, 4.5, 11, 0.6, "#2f6b3b");
    leaf(CX, CY - 29, 5, 13, 0, "#3c8749"); leaf(CX - 3, CY - 20, 4, 8, -0.3, "#3c8749");
  },
  "conference-table"(g) {
    shadow(g);
    box(g, CX, CY, { u0: -0.48, u1: 0.48, v0: -0.4, v1: 0.4, h: 12 }, mat("#7a4a2e", P.rim, ["wood", 0.9]));
    box(g, CX, CY, { u0: -0.1, u1: 0.08, v0: -0.16, v1: 0.02, z0: 12, h: 1 }, mat(P.paper));
    box(g, CX, CY, { u0: 0.14, u1: 0.3, v0: 0.1, v1: 0.26, z0: 12, h: 4 }, mat("#363a5e"));
  },
  copier(g) {
    shadow(g);
    const c = box(g, CX, CY, { u0: -0.4, u1: 0.4, v0: -0.3, v1: 0.3, h: 24 }, mat("#a4aec6", P.rim, ["metal", 0.8]));
    box(g, CX, CY, { u0: -0.42, u1: 0.42, v0: -0.32, v1: 0.32, z0: 24, h: 3 }, mat("#6c7596"));
    fillPoly(g, [c.P(-0.3, 0.3, 14), c.P(0.1, 0.3, 14), c.P(0.1, 0.3, 19), c.P(-0.3, 0.3, 19)], "#2c3342", INK, 1);
    ellipse(g, c.P(0.25, 0.3, 17)[0], c.P(0.25, 0.3, 17)[1], 1.8, 1.8, "#6fe08a", INK, 1);
  },
  "filing-cabinet"(g) {
    shadow(g, 22, 10);
    const c = box(g, CX, CY, { u0: -0.3, u1: 0.3, v0: -0.28, v1: 0.28, h: 36 }, mat("#8793ae", P.rim, ["metal", 0.8]));
    for (let i = 0; i < 3; i++) {
      const z = 3 + i * 11;
      fillPoly(g, [c.P(-0.26, 0.28, z), c.P(0.26, 0.28, z), c.P(0.26, 0.28, z + 9), c.P(-0.26, 0.28, z + 9)], shade("#8793ae", 0.08), INK, 1);
      line(g, c.P(-0.06, 0.28, z + 5)[0], c.P(-0.06, 0.28, z + 5)[1], c.P(0.06, 0.28, z + 5)[0], c.P(0.06, 0.28, z + 5)[1], "#cdd3de", 2);
    }
  },
  "box-stack"(g) {
    shadow(g);
    const card = mat("#9a7648", P.rim, ["cardboard", 0.9]);
    box(g, CX, CY, { u0: -0.42, u1: 0.1, v0: -0.3, v1: 0.3, h: 15 }, card);
    box(g, CX, CY, { u0: 0.02, u1: 0.44, v0: -0.1, v1: 0.4, h: 12 }, mat("#8a683f"));
    box(g, CX, CY, { u0: -0.34, u1: 0.02, v0: -0.2, v1: 0.2, z0: 15, h: 11 }, mat("#a98354"));
    fillPoly(g, [[CX - 14, CY - 14], [CX - 4, CY - 9], [CX - 4, CY - 6], [CX - 14, CY - 11]], "#c9b48a");
  },
  "server-rack"(g) {
    shadow(g, 24, 11);
    const r = box(g, CX, CY, { u0: -0.3, u1: 0.3, v0: -0.28, v1: 0.28, h: 44 }, { top: "#3e4a60", left: "#2a3348", right: "#1c2336", rim: "#9fe8ff" });
    // front (lower-left face): three rows of drive bays with blinking LEDs, a vent at the bottom
    for (let i = 0; i < 4; i++) {
      const z = 9 + i * 8.5;
      fillPoly(g, [r.P(-0.25, 0.28, z), r.P(0.25, 0.28, z), r.P(0.25, 0.28, z + 6.5), r.P(-0.25, 0.28, z + 6.5)], "#121827", INK, 1);
      for (let k = 0; k < 3; k++) {
        const p = r.P(-0.18 + k * 0.1, 0.28, z + 3.2), on = (i * 3 + k) % 3 !== 1;
        ellipse(g, p[0], p[1], 1.25, 1.25, on ? (k === 2 ? "#ffb35a" : "#35e0c8") : "#46506a");
      }
      const s0 = r.P(0.1, 0.28, z + 3.2), s1 = r.P(0.22, 0.28, z + 3.2);
      line(g, s0[0], s0[1], s1[0], s1[1], "#6a768f", 1.4);
    }
    for (let k = 0; k < 4; k++) { const a = r.P(-0.22, 0.28, 2 + k * 1.5), b = r.P(0.22, 0.28, 2 + k * 1.5); line(g, a[0], a[1], b[0], b[1], "#0b0f1a", 0.9); }
  },
  generator(g) {
    shadow(g, 25, 11);
    const body = box(g, CX, CY, { u0: -0.38, u1: 0.38, v0: -0.3, v1: 0.3, h: 22 }, mat("#6f8a4a", "#d3f0a0", ["metal", 0.7]));
    box(g, CX, CY, { u0: -0.42, u1: 0.42, v0: -0.33, v1: 0.33, h: 4 }, mat("#2c3342"));
    // hazard stripe on the front, a dial and a vent
    for (let i = 0; i < 6; i++) {
      const u = -0.34 + i * 0.12;
      fillPoly(g, [body.P(u, 0.3, 5), body.P(u + 0.06, 0.3, 5), body.P(u + 0.1, 0.3, 11), body.P(u + 0.04, 0.3, 11)], i % 2 ? "#161425" : "#ffc93a");
    }
    const d = body.P(-0.2, 0.3, 17); ellipse(g, d[0], d[1], 3, 3, "#ece4cf", INK, 1); line(g, d[0], d[1], d[0] + 1.5, d[1] - 2, INK, 1);
    ellipse(g, body.P(0.2, 0.3, 17)[0], body.P(0.2, 0.3, 17)[1], 1.8, 1.8, "#ff9a3a", INK, 1);
    // exhaust stack
    box(g, CX, CY, { u0: 0.2, u1: 0.3, v0: -0.25, v1: -0.15, z0: 22, h: 14 }, mat("#2c3342"));
  },
  "cable-bundle"(g) {
    ellipse(g, CX, CY + 2, 20, 8, "rgba(0,0,0,0.28)");
    const snake = (pts, col, w) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = INK; g.lineWidth = w + 3; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
    };
    snake([[CX - 20, CY - 4], [CX - 8, CY - 14], [CX + 2, CY - 2], [CX + 12, CY + 8], [CX + 22, CY]], "#23283c", 4.4);
    snake([[CX - 18, CY + 4], [CX - 6, CY + 12], [CX + 4, CY + 4], [CX + 14, CY - 4], [CX + 20, CY + 6]], "#ff9a3a", 3);
    snake([[CX - 12, CY - 8], [CX - 2, CY - 12], [CX + 8, CY - 6], [CX + 16, CY - 8], [CX + 20, CY - 12]], "#35a0e0", 2.6);
    for (const x of [-10, 6]) line(g, CX + x, CY - 3 + (x > 0 ? 0 : -1), CX + x + 1, CY + 1, "#d0d6e4", 2.4);
  },
  "reception-desk"(g) {
    shadow(g, 30, 11);
    const d = box(g, CX, CY, { u0: -0.5, u1: 0.5, v0: -0.34, v1: 0.34, h: 22 }, { top: "#c9a766", left: "#6a4a63", right: "#4a3346", rim: "#ffe3b8", tex: ["wood", 0.7] });
    // front panel: brass band and a glowing logo plate
    fillPoly(g, [d.P(-0.5, 0.34, 15), d.P(0.5, 0.34, 15), d.P(0.5, 0.34, 17), d.P(-0.5, 0.34, 17)], "#d4a64a");
    fillPoly(g, [d.P(-0.2, 0.34, 6), d.P(0.2, 0.34, 6), d.P(0.2, 0.34, 12), d.P(-0.2, 0.34, 12)], "#1a1436", INK, 1);
    line(g, d.P(-0.12, 0.34, 9)[0], d.P(-0.12, 0.34, 9)[1], d.P(0.12, 0.34, 9)[0], d.P(0.12, 0.34, 9)[1], "#5af0d4", 1.6);
    // a bell and a guest book on top
    const bell = d.P(0.15, -0.05, 22); ellipse(g, bell[0], bell[1] - 2, 3.4, 2.6, "#e8c25a", INK, 1); line(g, bell[0], bell[1] - 5, bell[0], bell[1] - 7, INK, 1.4);
    box(g, CX, CY, { u0: -0.3, u1: -0.05, v0: -0.12, v1: 0.1, z0: 22, h: 2 }, mat(P.paper, "#ffffff"));
  },
  chair(g) {
    ellipse(g, CX, CY + 1, 13, 6, "rgba(0,0,0,0.3)");
    for (const [x, y] of [[-8, 2], [8, 2], [0, 7], [0, -4]]) line(g, CX, CY - 5, CX + x, CY + y, INK, 3);
    box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.2, v1: 0.2, z0: 9, h: 5 }, mat("#c83f38"));
    box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.24, v1: -0.16, z0: 14, h: 15 }, mat("#c83f38"));
  },
  "paper-stack"(g) {
    ellipse(g, CX, CY + 1, 11, 5, "rgba(0,0,0,0.25)");
    box(g, CX, CY, { u0: -0.16, u1: 0.12, v0: -0.12, v1: 0.14, h: 3 }, mat(P.paper, "#ffffff"));
    box(g, CX, CY, { u0: -0.05, u1: 0.2, v0: 0.0, v1: 0.24, z0: 3, h: 2 }, mat("#d7d3c4", "#ffffff"));
  },
};

export const propIds = Object.keys(draw);
export const drawProp = (g, id) => (draw[id] ?? draw["box-stack"])(g);

/** The Lobby elevator (drawn at floor.exit): a steel doorframe on the tile's back-left edge, sliding doors a little open, a floor display above. 64x72 canvas like props. */
export function drawElevator(g) {
  const bl = [CX - 31, CY - 1], br = [CX, CY - 17], z = 46;
  const at = (t, h) => [bl[0] + (br[0] - bl[0]) * t, bl[1] + (br[1] - bl[1]) * t - h];
  const quad = (t0, t1, h0, h1, fill, st = INK, lw = 1.2) => fillPoly(g, [at(t0, h0), at(t1, h0), at(t1, h1), at(t0, h1)], fill, st, lw);
  quad(0, 1, 0, z, "#0e1424", INK, 1.6);                      // dark cabin interior
  quad(0.06, 0.34, 0, z - 4, "#9aa7c2");                       // left door, slid aside
  quad(0.66, 0.94, 0, z - 4, "#7f8cab");                       // right door, slid aside
  quad(0.06, 0.34, z * 0.55, z * 0.58, "rgba(255,255,255,0.35)", null);
  quad(0.46, 0.54, 0, z - 4, "rgba(90,240,160,0.18)", null);   // light from inside
  quad(-0.04, 0.06, 0, z + 6, "#d4a64a");                      // posts
  quad(0.94, 1.04, 0, z + 6, "#b88e3a");
  quad(-0.04, 1.04, z, z + 7, "#d4a64a");                      // lintel
  const c = at(0.5, z + 3.5);
  fillPoly(g, [[c[0] - 8, c[1] - 3], [c[0] + 8, c[1] - 3 - 4], [c[0] + 8, c[1] + 1 - 4], [c[0] - 8, c[1] + 2]], "#0b0f1a", INK, 1);
  fillPoly(g, [[c[0] - 2.4, c[1] - 1.2], [c[0] + 2.4, c[1] - 3.2], [c[0], c[1] + 1]], "#5af0a0");
}

/** The Emergency Exit door (R-046), drawn at state.portal.tile / lobbyTile: a freestanding doorframe with a green EXIT sign, the door swung open on a violet swirl. 64x72 canvas like props. */
export const PORTAL_W = 64, PORTAL_H = 96, PORTAL_CX = 32, PORTAL_CY = 80; // 24 px taller than a prop: the frame and its sign stand above the tile
export function drawPortal(g) {
  g.translate(0, PORTAL_CY - CY);
  const bl = [CX - 24, CY + 3], br = [CX + 6, CY - 12], z = 50;
  const at = (t, h) => [bl[0] + (br[0] - bl[0]) * t, bl[1] + (br[1] - bl[1]) * t - h];
  const quad = (t0, t1, h0, h1, fill, st = INK, lw = 1.2) => fillPoly(g, [at(t0, h0), at(t1, h0), at(t1, h1), at(t0, h1)], fill, st, lw);
  ellipse(g, CX - 6, CY + 2, 24, 10, "rgba(0,0,0,0.32)");
  ellipse(g, CX - 9, CY - 2, 17, 7, "rgba(180,140,255,0.38)");           // glow spilling onto the floor
  quad(0.0, 1.0, 0, z, "#2a1458", INK, 1.6);                              // the opening: deep violet
  quad(0.08, 0.92, 0, z - 4, "#6a3fc8", null);
  quad(0.2, 0.8, 4, z - 12, "#a47cff", null);
  quad(0.34, 0.66, 10, z - 20, "#e6d8ff", null);                          // bright core
  for (let k = 0; k < 3; k++) quad(0.1, 0.9, 8 + k * 13, 10 + k * 13, "rgba(255,255,255,0.28)", null); // swirl streaks
  quad(-0.07, 0.05, 0, z + 5, "#c8d0e4");                                 // steel posts
  quad(0.95, 1.07, 0, z + 5, "#8f9ab6");
  quad(-0.07, 1.07, z, z + 6, "#c8d0e4");                                 // lintel
  const c = at(0.5, z + 12);                                              // EXIT sign above the frame
  fillPoly(g, [[c[0] - 11, c[1] - 1], [c[0] + 11, c[1] - 12], [c[0] + 11, c[1] - 4], [c[0] - 11, c[1] + 7]], "#0b2a1c", INK, 1.2);
  line(g, c[0] - 8, c[1] + 2, c[0] - 4, c[1] + 0.4, "#5af0a0", 2); line(g, c[0] - 2, c[1] - 0.6, c[0] + 2, c[1] - 2.2, "#5af0a0", 2); line(g, c[0] + 4, c[1] - 3, c[0] + 8, c[1] - 4.6, "#5af0a0", 2);
}

// ---- Render-only dressing (G round, item 11): 3-4 large silhouettes per room kind, 40-70 px on screen. They stand against walls and never block (world.js addWallDecor). ----
const lerp = (a, b, t) => a + (b - a) * t;
const decor = {
  "coffee-machine"(g) { // a counter with a big espresso machine, a steaming pot and a stack of cups
    shadow(g, 24, 11);
    box(g, CX, CY, { u0: -0.4, u1: 0.4, v0: -0.28, v1: 0.28, h: 17 }, mat("#8a5a3a", P.rim, ["wood", 0.9]));
    const m = box(g, CX, CY, { u0: -0.3, u1: 0.12, v0: -0.2, v1: 0.2, z0: 17, h: 24 }, mat("#3b4166", "#bfcaff"));
    fillPoly(g, [m.P(-0.26, 0.2, 24), m.P(0.08, 0.2, 24), m.P(0.08, 0.2, 34), m.P(-0.26, 0.2, 34)], "#0f1424", INK, 1);
    ellipse(g, m.P(-0.16, 0.2, 30)[0], m.P(-0.16, 0.2, 30)[1], 2.2, 2.2, "#ff4a3a", INK, 0.9); ellipse(g, m.P(-0.04, 0.2, 30)[0], m.P(-0.04, 0.2, 30)[1], 2.2, 2.2, "#6fe08a", INK, 0.9);
    const pot = m.P(0.0, 0.1, 17); fillPoly(g, [[pot[0] - 5, pot[1]], [pot[0] + 5, pot[1]], [pot[0] + 4, pot[1] - 11], [pot[0] - 4, pot[1] - 11]], "rgba(210,230,255,0.85)", INK, 1.2); fillPoly(g, [[pot[0] - 4.4, pot[1] - 1], [pot[0] + 4.4, pot[1] - 1], [pot[0] + 3.8, pot[1] - 6], [pot[0] - 3.8, pot[1] - 6]], "#5a2c1a");
    for (const [i, c] of [[0, "#ffffff"], [1, "#e8e4d6"]]) ellipse(g, CX + 16 + i * 2, CY - 10 - i * 5, 3.6, 2.2, c, INK, 1);
    for (const k of [0, 1]) { g.beginPath(); g.moveTo(pot[0] - 2 + k * 4, pot[1] - 13); g.bezierCurveTo(pot[0] - 6 + k * 4, pot[1] - 17, pot[0] + 2 + k * 4, pot[1] - 20, pot[0] - 1 + k * 4, pot[1] - 24); g.lineWidth = 1.8; g.lineCap = "round"; g.strokeStyle = "rgba(235,240,255,0.7)"; g.stroke(); }
  },
  "water-cooler"(g) { // white body, an upturned blue bottle, a cup holder
    shadow(g, 16, 8);
    const c = box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.2, v1: 0.2, h: 30 }, mat("#e8ecf6", "#ffffff"));
    fillPoly(g, [c.P(-0.14, 0.2, 14), c.P(0.14, 0.2, 14), c.P(0.14, 0.2, 22), c.P(-0.14, 0.2, 22)], "#3a4a7a", INK, 1);
    ellipse(g, c.P(-0.05, 0.2, 18)[0], c.P(-0.05, 0.2, 18)[1], 1.6, 1.6, "#35a0e0", INK, 0.8); ellipse(g, c.P(0.06, 0.2, 18)[0], c.P(0.06, 0.2, 18)[1], 1.6, 1.6, "#ff5a46", INK, 0.8);
    const t = [CX, CY - 30];
    fillPoly(g, [[t[0] - 9, t[1]], [t[0] + 9, t[1]], [t[0] + 11, t[1] - 18], [t[0] + 5, t[1] - 24], [t[0] - 5, t[1] - 24], [t[0] - 11, t[1] - 18]], "rgba(110,190,255,0.8)", INK, 1.4);
    fillPoly(g, [[t[0] - 9, t[1] - 1], [t[0] + 9, t[1] - 1], [t[0] + 10, t[1] - 10], [t[0] - 10, t[1] - 10]], "rgba(60,140,230,0.9)");
    line(g, t[0] - 7, t[1] - 6, t[0] - 8, t[1] - 17, "rgba(255,255,255,0.6)", 1.6);
  },
  barrel(g) { // a rusty oil drum with two hoops and a hazard diamond
    shadow(g, 18, 9);
    const r = 12, h = 30;
    g.beginPath(); g.ellipse(CX, CY - 3, r, r * 0.5, 0, 0, Math.PI); g.lineTo(CX - r, CY - 3 - h); g.ellipse(CX, CY - 3 - h, r, r * 0.5, 0, Math.PI, 0, true); g.closePath(); // body
    g.fillStyle = "#a6502a"; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
    fillPoly(g, [[CX + 3, CY - 3 + 4.6], [CX + r, CY - 3], [CX + r, CY - 3 - h], [CX + 3, CY - 3 - h + 6]], "rgba(20,6,10,0.3)");
    for (const z of [8, 21]) { g.beginPath(); g.ellipse(CX, CY - 3 - z, r, r * 0.5, 0, 0, Math.PI); g.lineWidth = 2.2; g.strokeStyle = "#5a2a18"; g.stroke(); }
    ellipse(g, CX, CY - 3 - h, r, r * 0.5, "#c2683a", INK, 1.6); ellipse(g, CX, CY - 3 - h, r * 0.62, r * 0.31, "#7a3a1c", INK, 1); ellipse(g, CX - 4, CY - 3 - h - 1, 2, 1, "rgba(255,255,255,0.4)");
    fillPoly(g, [[CX - 4, CY - 14], [CX, CY - 19], [CX + 4, CY - 14], [CX, CY - 9]], "#ffc93a", INK, 1); line(g, CX, CY - 16.5, CX, CY - 13.5, INK, 1.3);
    ellipse(g, CX - 7, CY - 3 - h + 3, 1.6, 6, "rgba(255,200,150,0.22)");
  },
  "valve-wheel"(g) { // a vertical pipe on a flange with a big red valve wheel
    shadow(g, 14, 7);
    box(g, CX, CY, { u0: -0.16, u1: 0.16, v0: -0.16, v1: 0.16, h: 4 }, mat("#4a5468", "#bfe4ff", ["metal", 0.8]));
    const pipe = box(g, CX, CY, { u0: -0.09, u1: 0.09, v0: -0.09, v1: 0.09, z0: 4, h: 42 }, mat("#7a5a3c", "#e0b080"));
    box(g, CX, CY, { u0: -0.12, u1: 0.12, v0: -0.12, v1: 0.12, z0: 26, h: 6 }, mat("#3a4256", "#bfe4ff"));
    const wc = [CX, CY - 40]; g.save(); g.translate(wc[0], wc[1]); g.scale(1, 0.6);
    g.beginPath(); g.arc(0, 0, 14, 0, TAU2); g.lineWidth = 6.5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.8; g.strokeStyle = "#e0363f"; g.stroke();
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; line(g, Math.cos(a) * -14, Math.sin(a) * -14, Math.cos(a) * 14, Math.sin(a) * 14, INK, 4.6); line(g, Math.cos(a) * -14, Math.sin(a) * -14, Math.cos(a) * 14, Math.sin(a) * 14, "#e0363f", 2.4); }
    g.beginPath(); g.arc(0, 0, 3.4, 0, TAU2); g.fillStyle = "#c4ccd8"; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke(); g.restore();
  },
  pallet(g) { // a wooden pallet with two stacked sacks (low, flat: the safe silhouette in the middle of a loot spill)
    shadow(g, 26, 12);
    box(g, CX, CY, { u0: -0.44, u1: 0.44, v0: -0.36, v1: 0.36, h: 5 }, mat("#8a683f", P.rim, ["wood", 1]));
    for (const u of [-0.3, 0, 0.3]) box(g, CX, CY, { u0: u - 0.05, u1: u + 0.05, v0: -0.4, v1: 0.4, z0: 0, h: 5 }, mat("#6a4a2a", P.rim));
    box(g, CX, CY, { u0: -0.34, u1: 0.04, v0: -0.26, v1: 0.26, z0: 5, h: 9 }, mat("#c8b894", "#fff4d8", ["paper", 0.9]));
    box(g, CX, CY, { u0: -0.2, u1: 0.22, v0: -0.2, v1: 0.2, z0: 14, h: 8 }, mat("#b8a884", "#fff4d8", ["paper", 0.9]));
  },
  podium(g) { // a mahogany lectern with a gold plate and a microphone
    shadow(g, 18, 9);
    const b = box(g, CX, CY, { u0: -0.22, u1: 0.22, v0: -0.2, v1: 0.2, h: 38 }, mat("#6a3426", "#e8a070", ["wood", 1]));
    box(g, CX, CY, { u0: -0.28, u1: 0.28, v0: -0.26, v1: 0.26, z0: 38, h: 4 }, mat("#7a4030", "#ffc090"));
    fillPoly(g, [b.P(-0.14, 0.2, 22), b.P(0.14, 0.2, 22), b.P(0.14, 0.2, 31), b.P(-0.14, 0.2, 31)], "#e0b04a", INK, 1.1);
    fillPoly(g, [b.P(-0.09, 0.2, 25), b.P(0.09, 0.2, 25), b.P(0.09, 0.2, 28), b.P(-0.09, 0.2, 28)], "#8a1f34");
    line(g, CX, CY - 42, CX + 3, CY - 52, INK, 3.4); line(g, CX, CY - 42, CX + 3, CY - 52, "#c4ccd8", 1.6); ellipse(g, CX + 3.4, CY - 53, 2.4, 2.4, "#2c3342", INK, 1);
  },
  "trophy-case"(g) { // a glass cabinet on a plinth with three gilt trophies
    shadow(g, 22, 10);
    const b = box(g, CX, CY, { u0: -0.3, u1: 0.3, v0: -0.2, v1: 0.2, h: 6 }, mat("#4a2418", "#e8a070", ["wood", 1]));
    const c = box(g, CX, CY, { u0: -0.28, u1: 0.28, v0: -0.18, v1: 0.18, z0: 6, h: 44 }, { top: "rgba(200,225,255,0.5)", left: "rgba(150,190,240,0.32)", right: "rgba(90,130,200,0.38)", rim: "#e8f4ff" });
    for (const z of [6, 24, 50]) fillPoly(g, [c.P(-0.28, 0.18, z), c.P(0.28, 0.18, z), c.P(0.28, 0.18, z + 2), c.P(-0.28, 0.18, z + 2)], "#8a5a3a", INK, 1);
    [[-0.17, 8, 11], [0.0, 8, 15], [0.16, 8, 9], [-0.08, 26, 12], [0.1, 26, 14]].forEach(([u, z, hh]) => {
      const p = c.P(u, 0.1, z + 2); fillPoly(g, [[p[0] - 3, p[1]], [p[0] + 3, p[1]], [p[0] + 2, p[1] - 3], [p[0] - 2, p[1] - 3]], "#c9a03a", INK, 0.8);
      fillPoly(g, [[p[0] - 4, p[1] - hh], [p[0] + 4, p[1] - hh], [p[0] + 2.4, p[1] - 3], [p[0] - 2.4, p[1] - 3]], "#f0c24a", INK, 1); line(g, p[0] - 2, p[1] - hh + 2, p[0] - 1.4, p[1] - 5, "rgba(255,255,255,0.7)", 1);
    });
  },
};
const TAU2 = Math.PI * 2;
export const DECOR_IDS = Object.keys(decor);
export const drawDecor = (g, id) => decor[id](g);
