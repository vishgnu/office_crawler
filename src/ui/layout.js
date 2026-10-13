// Pure HUD/view layout from the viewport size (CSS pixels). Used by the renderer, the hook and tests.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** One scale for world zoom and HUD: 1 at 1280x720, 3 at 4K. */
export const viewScale = (w, h) => clamp(Math.min(w / 1280, h / 720), 0.6, 3);

export function hudLayout(w, h) {
  const s = viewScale(w, h), r = 52 * s, m = 16 * s, label = 22 * s;
  const cy = h - m - label - r;
  const globe = (cx) => ({ cx, cy, r, rect: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r + label } });
  const slot = 40 * s, gap = 8 * s, total = 4 * slot + 3 * gap, x0 = (w - total) / 2, y = h - m - slot;
  return {
    scale: s,
    health: globe(m + r),
    mana: globe(w - m - r),
    belt: [0, 1, 2, 3].map((i) => ({ x: x0 + i * (slot + gap), y, w: slot, h: slot })),
    target: { x: w / 2 - 130 * s, y: 18 * s, w: 260 * s, h: 14 * s },
  };
}
