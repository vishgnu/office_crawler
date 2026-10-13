// Style contract and loader (ADR-0002 section 7).
// Style = {
//   id, logicalTile: {w:64, h:32}, palette,
//   ui: { drawVesselLive(g, kind, x, y, w, h, ratio, timeMs), shapes: { health, mana }, vesselRef, vesselPad },
//   dims: { [actorType]: { head, shadowR } }  (logical px: head top above the feet, contact shadow half-width)
//   build(onProgress, {scale, rim, hc}): Promise<Atlas>   // draws every key from render/keys.js requiredKeys()
// }
// Atlas.get(key) -> { img, w, h, ox, oy } (ox, oy = anchor: the ground point for tiles/props, the feet for figures).
import { vector } from "./styles/vector/index.js";

const styles = { vector };
export const defaultStyleId = "vector";
export const getStyle = (id) => styles[id] ?? styles[defaultStyleId];
export const styleIds = () => Object.keys(styles);
