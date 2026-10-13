// Cheap positional audio: distance gain plus stereo pan from the hero's tile. Pure, Node-testable.
import { audioConfig as C } from "./config.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Level 1 within fullTiles, falling linearly to minDistGain at hearTiles, 0 (cull) beyond. */
export function distanceGain(dist, cfg = C) {
  if (!(dist >= 0)) return 1;
  if (dist <= cfg.fullTiles) return 1;
  if (dist > cfg.hearTiles) return 0;
  const t = (dist - cfg.fullTiles) / (cfg.hearTiles - cfg.fullTiles);
  return 1 - t * (1 - cfg.minDistGain);
}

/** Isometric view: screen x follows (dx - dy). Returns -maxPan..maxPan. */
export function panFor(hero, tile, cfg = C) {
  const sx = (tile.x - hero.x) - (tile.y - hero.y);
  return clamp(sx / cfg.panTiles, -1, 1) * cfg.maxPan;
}

/** {gain, pan} for a sound at `tile` heard from `hero`; null tile or hero = not positional ({gain:1, pan:0}). gain 0 = cull. */
export function place(hero, tile, cfg = C) {
  if (!hero || !tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return { gain: 1, pan: 0 };
  const dist = Math.hypot(tile.x - hero.x, tile.y - hero.y);
  return { gain: distanceGain(dist, cfg), pan: panFor(hero, tile, cfg), dist };
}
