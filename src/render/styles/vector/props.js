// Office props. Each prop is drawn on a 64x72 canvas with the tile centre (ground) at (32, 56).
import { palette as P } from "./palette.js";
import { box, fillPoly, ellipse, line, shade, INK } from "../../draw/shapes.js";

export const PROP_W = 64, PROP_H = 72, PROP_CX = 32, PROP_CY = 56;
const CX = PROP_CX, CY = PROP_CY;
const mat = (base, rim = P.rim) => ({ top: shade(base, 0.18), left: base, right: shade(base, -0.28), rim });
const shadow = (g, rx = 26, ry = 12) => ellipse(g, CX, CY + 1, rx, ry, "rgba(0,0,0,0.32)");

const draw = {
  desk(g) {
    shadow(g);
    const wood = mat("#6e4e33");
    box(g, CX, CY, { u0: -0.44, u1: 0.44, v0: -0.32, v1: 0.4, h: 15 }, wood);
    // monitor at the back, screen glowing on its lower-left face
    const m = box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.28, v1: -0.2, z0: 15, h: 13 }, mat("#2a2f3a"));
    fillPoly(g, [m.P(-0.17, -0.2, 17), m.P(0.17, -0.2, 17), m.P(0.17, -0.2, 26), m.P(-0.17, -0.2, 26)], "#58cfe6");
    fillPoly(g, [m.P(-0.17, -0.2, 17), m.P(0.0, -0.2, 17), m.P(0.0, -0.2, 26), m.P(-0.17, -0.2, 26)], shade("#58cfe6", -0.22));
    box(g, CX, CY, { u0: -0.22, u1: 0.22, v0: 0.02, v1: 0.14, z0: 15, h: 1.6 }, mat("#9aa3b2"));
  },
  partition(g) {
    shadow(g, 28, 10);
    box(g, CX, CY, { u0: -0.5, u1: 0.5, v0: -0.07, v1: 0.07, h: 34 }, { top: "#7886a6", left: "#56658a", right: "#3d4968", rim: P.rim });
    box(g, CX, CY, { u0: -0.5, u1: 0.5, v0: -0.075, v1: 0.075, z0: 28, h: 6 }, { top: "#8c9ab8", left: "#69789c", right: "#4a5778", rim: P.rim });
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
    box(g, CX, CY, { u0: -0.48, u1: 0.48, v0: -0.4, v1: 0.4, h: 12 }, mat("#5a3b2a"));
    box(g, CX, CY, { u0: -0.1, u1: 0.08, v0: -0.16, v1: 0.02, z0: 12, h: 1 }, mat(P.paper));
    box(g, CX, CY, { u0: 0.14, u1: 0.3, v0: 0.1, v1: 0.26, z0: 12, h: 4 }, mat("#2a2f3a"));
  },
  copier(g) {
    shadow(g);
    const c = box(g, CX, CY, { u0: -0.4, u1: 0.4, v0: -0.3, v1: 0.3, h: 24 }, mat("#8791a3"));
    box(g, CX, CY, { u0: -0.42, u1: 0.42, v0: -0.32, v1: 0.32, z0: 24, h: 3 }, mat("#586174"));
    fillPoly(g, [c.P(-0.3, 0.3, 14), c.P(0.1, 0.3, 14), c.P(0.1, 0.3, 19), c.P(-0.3, 0.3, 19)], "#2c3342", INK, 1);
    ellipse(g, c.P(0.25, 0.3, 17)[0], c.P(0.25, 0.3, 17)[1], 1.8, 1.8, "#6fe08a", INK, 1);
  },
  "filing-cabinet"(g) {
    shadow(g, 22, 10);
    const c = box(g, CX, CY, { u0: -0.3, u1: 0.3, v0: -0.28, v1: 0.28, h: 36 }, mat("#6b778c"));
    for (let i = 0; i < 3; i++) {
      const z = 3 + i * 11;
      fillPoly(g, [c.P(-0.26, 0.28, z), c.P(0.26, 0.28, z), c.P(0.26, 0.28, z + 9), c.P(-0.26, 0.28, z + 9)], shade("#6b778c", 0.08), INK, 1);
      line(g, c.P(-0.06, 0.28, z + 5)[0], c.P(-0.06, 0.28, z + 5)[1], c.P(0.06, 0.28, z + 5)[0], c.P(0.06, 0.28, z + 5)[1], "#cdd3de", 2);
    }
  },
  "box-stack"(g) {
    shadow(g);
    const card = mat("#9a7648");
    box(g, CX, CY, { u0: -0.42, u1: 0.1, v0: -0.3, v1: 0.3, h: 15 }, card);
    box(g, CX, CY, { u0: 0.02, u1: 0.44, v0: -0.1, v1: 0.4, h: 12 }, mat("#8a683f"));
    box(g, CX, CY, { u0: -0.34, u1: 0.02, v0: -0.2, v1: 0.2, z0: 15, h: 11 }, mat("#a98354"));
    fillPoly(g, [[CX - 14, CY - 14], [CX - 4, CY - 9], [CX - 4, CY - 6], [CX - 14, CY - 11]], "#c9b48a");
  },
  chair(g) {
    ellipse(g, CX, CY + 1, 13, 6, "rgba(0,0,0,0.3)");
    for (const [x, y] of [[-8, 2], [8, 2], [0, 7], [0, -4]]) line(g, CX, CY - 5, CX + x, CY + y, INK, 3);
    box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.2, v1: 0.2, z0: 9, h: 5 }, mat("#2e3a55"));
    box(g, CX, CY, { u0: -0.2, u1: 0.2, v0: -0.24, v1: -0.16, z0: 14, h: 15 }, mat("#2e3a55"));
  },
  "paper-stack"(g) {
    ellipse(g, CX, CY + 1, 11, 5, "rgba(0,0,0,0.25)");
    box(g, CX, CY, { u0: -0.16, u1: 0.12, v0: -0.12, v1: 0.14, h: 3 }, mat(P.paper, "#ffffff"));
    box(g, CX, CY, { u0: -0.05, u1: 0.2, v0: 0.0, v1: 0.24, z0: 3, h: 2 }, mat("#d7d3c4", "#ffffff"));
  },
};

export const propIds = Object.keys(draw);
export const drawProp = (g, id) => (draw[id] ?? draw["box-stack"])(g);
