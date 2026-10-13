// The "vector" style: dark-toned, bold ink outlines, flat colours with one shade level, rim light.
// Everything is drawn procedurally into the atlas at load. Swap this folder to change the art.
import { createAtlas } from "../../atlas.js";
import { keys, FLOOR_KINDS, FLOOR_VARIANTS, MARKERS, ANIMS, DIRS, DIR_VEC, FX_IDS, PLAYER_CLASS } from "../../keys.js";
import { content } from "../../../core/index.js";
import { palette } from "./palette.js";
import { drawFloor, drawMarker, drawWall, WALL_W, WALL_CANVAS_H, WALL_CY } from "./tiles.js";
import { drawProp, PROP_W, PROP_H, PROP_CX, PROP_CY } from "./props.js";
import { drawFigure, FIG_W, FIG_H, FIG_FX, FIG_FY } from "./characters.js";
import { GLOBE_REF, drawGlobe, drawGlobeFrame, GLOBE_FRAME, GLOBE_SHAPES, drawBeltSlot, drawAlert, drawPaper, drawSlash } from "./ui.js";

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export const vector = {
  id: "vector",
  logicalTile: { w: 64, h: 32 },
  palette,
  ui: { drawGlobe, shapes: GLOBE_SHAPES, globeRef: GLOBE_REF },
  /** Draw every sprite into an atlas. `scale` supersamples for large screens. */
  async build(onProgress = () => {}, { scale = 1 } = {}) {
    const atlas = createAtlas(scale);
    const steps = [];
    for (const theme of Object.keys(content.themes)) {
      steps.push(() => {
        for (const kind of FLOOR_KINDS) for (let v = 0; v < FLOOR_VARIANTS; v++) atlas.add(keys.floor(theme, kind, v), 66, 34, 33, 17, (g) => drawFloor(g, kind, v));
        for (const m of MARKERS) atlas.add(keys.marker(theme, m), 66, 34, 33, 17, (g) => drawMarker(g, m));
        for (let mask = 0; mask < 16; mask++) atlas.add(keys.wall(theme, mask), WALL_W, WALL_CANVAS_H, WALL_W / 2, WALL_CY, (g) => drawWall(g, mask));
      });
    }
    steps.push(() => { for (const id of Object.keys(content.props)) atlas.add(keys.prop(id), PROP_W, PROP_H, PROP_CX, PROP_CY, (g) => drawProp(g, id)); });
    const figure = (type, build) => steps.push(() => {
      for (const [anim, n] of Object.entries(ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) {
        atlas.add(build(anim, d, f), FIG_W, FIG_H, FIG_FX, FIG_FY, (g) => { g.translate(FIG_FX, FIG_FY); drawFigure(g, type, anim, d, f); });
      }
    });
    figure(PLAYER_CLASS, (a, d, f) => keys.plr(PLAYER_CLASS, a, d, f));
    for (const type of Object.keys(content.monsters)) figure(type, (a, d, f) => keys.mon(type, a, d, f));
    steps.push(() => {
      for (let d = 0; d < DIRS; d++) atlas.add(keys.slash(d), 48, 48, 24, 24, (g) => drawSlash(g, d, DIR_VEC[d]));
      atlas.add(keys.fx("alert"), 18, 24, 9, 24, drawAlert);
      atlas.add(keys.fx("paper"), 9, 9, 4, 4, drawPaper);
      atlas.add(keys.ui("globe-health"), GLOBE_FRAME.w, GLOBE_FRAME.h, GLOBE_FRAME.ox, GLOBE_FRAME.oy, (g) => drawGlobeFrame(g, "health"));
      atlas.add(keys.ui("globe-mana"), GLOBE_FRAME.w, GLOBE_FRAME.h, GLOBE_FRAME.ox, GLOBE_FRAME.oy, (g) => drawGlobeFrame(g, "mana"));
      atlas.add(keys.ui("belt-slot"), 40, 40, 0, 0, drawBeltSlot);
    });
    for (let i = 0; i < steps.length; i++) { steps[i](); onProgress((i + 1) / steps.length); await yieldFrame(); }
    return atlas;
  },
};
