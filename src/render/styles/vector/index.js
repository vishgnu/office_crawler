// The "vector" style (C2): stylised vector, graded dark, bold ink outlines, flat colours with one shade level,
// rim-lit actors. Everything is drawn procedurally into the atlas at load. Swap this folder to change the art.
import { createAtlas } from "../../atlas.js";
import { keys, FLOOR_KINDS, FLOOR_VARIANTS, WALL_VARIANTS, MARKERS, ANIMS, PLAYER_ANIMS, DIRS, DIR_VEC, PLAYER_CLASS, PROJECTILES, NPC_FRAMES } from "../../keys.js";
import { content } from "../../../core/index.js";
import { palette } from "./palette.js";
import { drawFloor, drawMarker, drawWall, WALL_W, WALL_CANVAS_H, WALL_CY } from "./tiles.js";
import { drawProp, drawElevator, drawPortal, PORTAL_W, PORTAL_H, PORTAL_CX, PORTAL_CY, PROP_W, PROP_H, PROP_CX, PROP_CY } from "./props.js";
import { drawFigure, FIG_W, FIG_H, FIG_FX, FIG_FY, FIG_DIM } from "./characters.js";
import { drawProjectile, drawLootItem, drawGold, drawMuted, drawFlee, drawSpark, drawPlus, PROJ_W, PROJ_H } from "./sprites.js";
import { VESSEL_REF, VESSEL_SHAPES, VESSEL_PAD, drawVesselFrame, drawVesselLive, vesselFrameSize, drawSlot, drawIconStrike, drawIconPlus, drawAlert, drawPaper, drawShadow, drawSlash } from "./ui.js";

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

// Scratch canvases for the rim bake (reused for every figure sprite).
const scratch = { a: null, b: null };
function scratchCanvas(slot, w, h) {
  let c = scratch[slot];
  if (!c || c.width !== w || c.height !== h) { c = document.createElement("canvas"); c.width = w; c.height = h; scratch[slot] = c; }
  return c;
}

/**
 * Draw a figure and bake its rim ring into the same sprite: the figure is drawn once to a scratch canvas, a
 * rim-coloured silhouette of it is stamped in a ring of offsets (rimPx logical px), then the figure on top.
 * One atlas entry per frame, so the renderer needs a single blit per actor.
 */
function figureWithRim(g, scale, w, h, rimPx, rim, draw) {
  const pw = Math.ceil(w * scale), ph = Math.ceil(h * scale);
  const t = scratchCanvas("a", pw, ph), tg = t.getContext("2d");
  tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, pw, ph); tg.setTransform(scale, 0, 0, scale, 0, 0); draw(tg);
  const s = scratchCanvas("b", pw, ph), sg = s.getContext("2d");
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = "source-over"; sg.clearRect(0, 0, pw, ph);
  sg.drawImage(t, 0, 0); sg.globalCompositeOperation = "source-in"; sg.fillStyle = rim; sg.fillRect(0, 0, pw, ph);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const r = rimPx * scale;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.4; g.drawImage(s, Math.cos(a) * r, Math.sin(a) * r); } // outer ring: 8 stamps
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 1.2; g.drawImage(s, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); } // inner ring fills the gaps
  g.drawImage(t, 0, 0);
  g.restore();
}

export const vector = {
  id: "vector",
  logicalTile: { w: 64, h: 32 },
  palette,
  dims: FIG_DIM,
  ui: { shapes: VESSEL_SHAPES, vesselRef: VESSEL_REF, vesselPad: VESSEL_PAD, drawVesselLive },
  /**
   * Draw every sprite into an atlas. `scale` supersamples for large screens; `rim` is the rim ring width in
   * logical px (2 screen px at the game's zoom; wider in high-contrast mode).
   */
  async build(onProgress = () => {}, { scale = 1, rim = 0.8, hc = false } = {}) {
    const atlas = createAtlas(scale, { rim, hc });
    const steps = [];
    for (const theme of Object.keys(content.themes)) {
      steps.push(() => {
        for (const kind of FLOOR_KINDS) for (let v = 0; v < FLOOR_VARIANTS; v++) atlas.add(keys.floor(theme, kind, v), 66, 34, 33, 17, (g) => drawFloor(g, kind, v, theme));
        for (const m of MARKERS) atlas.add(keys.marker(theme, m), 66, 34, 33, 17, (g) => drawMarker(g, m, theme));
        for (let mask = 0; mask < 16; mask++) for (let v = 0; v < WALL_VARIANTS; v++) atlas.add(keys.wall(theme, mask, v), WALL_W, WALL_CANVAS_H, WALL_W / 2, WALL_CY, (g) => drawWall(g, mask, v, theme));
      });
    }
    steps.push(() => { for (const id of Object.keys(content.props)) atlas.add(keys.prop(id), PROP_W, PROP_H, PROP_CX, PROP_CY, (g) => drawProp(g, id)); });
    const figure = (type, build, anims = ANIMS) => steps.push(() => {
      const rimColour = palette.rims[type];
      for (const [anim, n] of Object.entries(anims)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) {
        atlas.add(build(anim, d, f), FIG_W, FIG_H, FIG_FX, FIG_FY, (g, sc) => figureWithRim(g, sc, FIG_W, FIG_H, rim, rimColour, (tg) => { tg.translate(FIG_FX, FIG_FY); drawFigure(tg, type, anim, d, f); }));
      }
    });
    figure(PLAYER_CLASS, (a, d, f) => keys.plr(PLAYER_CLASS, a, d, f), PLAYER_ANIMS);
    // Lobby NPCs: an idle loop facing the viewer (direction 0)
    steps.push(() => {
      for (const id of Object.keys(content.npcs)) {
        const type = `npc-${id}`;
        for (let f = 0; f < NPC_FRAMES; f++) atlas.add(keys.npc(id, f), FIG_W, FIG_H, FIG_FX, FIG_FY, (g, sc) => figureWithRim(g, sc, FIG_W, FIG_H, rim, palette.rims[type], (tg) => { tg.translate(FIG_FX, FIG_FY); drawFigure(tg, type, "idle", 0, f); }));
      }
    });
    for (const type of Object.keys(content.monsters)) figure(type, (a, d, f) => keys.mon(type, a, d, f));
    steps.push(() => {
      for (let d = 0; d < DIRS; d++) atlas.add(keys.slash(d), 48, 48, 24, 24, (g) => drawSlash(g, d, DIR_VEC[d]));
      atlas.add(keys.fx("alert"), 18, 24, 9, 24, drawAlert);
      atlas.add(keys.fx("paper"), 9, 9, 4.5, 4.5, drawPaper);
      atlas.add(keys.fx("shadow"), 64, 32, 32, 16, drawShadow);
      atlas.add(keys.fx("muted"), 24, 26, 12, 26, drawMuted);
      atlas.add(keys.fx("flee"), 22, 22, 11, 22, drawFlee);
      atlas.add(keys.fx("spark"), 12, 12, 6, 6, drawSpark);
      atlas.add(keys.fx("plus"), 12, 12, 6, 6, drawPlus);
      atlas.add(keys.fx("elevator"), PROP_W, PROP_H, PROP_CX, PROP_CY, drawElevator);
      atlas.add(keys.fx("portal"), PORTAL_W, PORTAL_H, PORTAL_CX, PORTAL_CY, drawPortal);
      for (const k of PROJECTILES) atlas.add(keys.proj(k), PROJ_W, PROJ_H, PROJ_W / 2, PROJ_H / 2, (g) => drawProjectile(g, k));
      atlas.add(keys.loot("item"), 24, 22, 12, 16, drawLootItem);
      for (const sz of ["s", "m", "l"]) atlas.add(keys.loot(`gold-${sz}`), 36, 26, 18, 18, (g) => drawGold(g, sz));
      for (const kind of ["health", "mana"]) { const f = vesselFrameSize(kind); atlas.add(keys.ui(`vessel-${kind}`), f.w, f.h, f.ox, f.oy, (g) => drawVesselFrame(g, kind)); }
      atlas.add(keys.ui("skill-slot"), 48, 48, 0, 0, (g) => drawSlot(g, 48, 48, false));
      atlas.add(keys.ui("belt-slot"), 48, 48, 0, 0, (g) => drawSlot(g, 48, 48, false));
      atlas.add(keys.ui("skill-icon-strike"), 48, 48, 0, 0, drawIconStrike);
      atlas.add(keys.ui("icon-plus"), 48, 48, 0, 0, drawIconPlus);
    });
    for (let i = 0; i < steps.length; i++) { steps[i](); onProgress((i + 1) / steps.length); await yieldFrame(); }
    return atlas;
  },
};
