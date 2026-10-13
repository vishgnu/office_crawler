// Pure HUD/view layout from the viewport size (CSS pixels). Used by the renderer, the hook and tests.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** View settings. zoom = world camera zoom on top of the HUD scale (the hero is ~50 logical px tall). */
export const viewConfig = {
  zoom: 1.8,          // 1080p: hero ~135 px tall, ~11 tiles across; `?zoom=` overrides
  easeTauMs: 140,     // camera follow time constant (realtime only)
  maxLagTiles: 2.5,   // the camera never trails the hero by more than this
};

/** One scale for HUD (and, times viewConfig.zoom, the world): 1 at 1280x720, 3 at 4K. */
export const viewScale = (w, h) => clamp(Math.min(w / 1280, h / 720), 0.6, 3);

/** Skill bar slots (F1-F4 selector keys) and potion belt slots (keys 1-4). */
export const SKILL_SLOTS = 4;
export const BELT_SLOTS = 4;

/** Font size in px for a design size at HUD scale s, never below a readable minimum. */
export const fontPx = (s, base, min = 12) => Math.max(min, Math.round(base * s));

export function hudLayout(w, h) {
  const s = viewScale(w, h), m = Math.max(8, Math.round(8 * s)), gap = Math.round(6 * s);
  const mugW = 108 * s, mugH = 100 * s, jugW = 84 * s, jugH = 116 * s;
  const health = { x: m, y: h - m - mugH, w: mugW, h: mugH };
  const mana = { x: w - m - jugW, y: h - m - jugH, w: jugW, h: jugH };
  const nameH = fontPx(s, 10, 12) + 4, pad = 6 * s, xpH = Math.max(8, 9 * s), textH = fontPx(s, 10, 12) + 2;
  const availW = mana.x - (health.x + health.w) - 24 * s;
  const row = (n, sz) => n * sz + (n - 1) * gap;
  let slot = 44 * s, belt = 34 * s;
  const sideBySide = availW >= row(SKILL_SLOTS, slot) + 2 * pad + 14 * s + row(BELT_SLOTS, belt) + 2 * pad;
  if (!sideBySide) { slot = Math.min(slot, Math.max(24, (availW - 2 * pad - (SKILL_SLOTS - 1) * gap) / SKILL_SLOTS)); belt = Math.min(belt, slot * 0.8); }
  const skillW = row(SKILL_SLOTS, slot), beltW = row(BELT_SLOTS, belt);
  const panelW = skillW + 2 * pad, panelH = pad + textH + 3 + xpH + 6 * s + slot + nameH + pad * 0.5;
  const groupW = sideBySide ? panelW + 14 * s + beltW + 2 * pad : panelW;
  const x0 = (w - groupW) / 2, panelY = h - m - panelH;
  const panel = { x: x0, y: panelY, w: panelW, h: panelH };
  const xp = { x: x0 + pad, y: panelY + pad + textH + 3, w: skillW, h: xpH };
  const slotY = xp.y + xpH + 6 * s;
  const skills = Array.from({ length: SKILL_SLOTS }, (_, i) => ({ x: x0 + pad + i * (slot + gap), y: slotY, w: slot, h: slot }));
  let beltY, beltX0, beltPanel;
  if (sideBySide) {
    beltX0 = x0 + panelW + 14 * s + pad; beltY = h - m - pad - belt - nameH * 0.4;
    beltPanel = { x: beltX0 - pad, y: beltY - pad, w: beltW + 2 * pad, h: belt + 2 * pad };
  } else {
    beltX0 = (w - beltW) / 2; beltY = panelY - 8 * s - belt - pad;
    beltPanel = { x: beltX0 - pad, y: beltY - pad, w: beltW + 2 * pad, h: belt + 2 * pad };
  }
  return {
    scale: s, margin: m, stacked: !sideBySide, showNames: slot >= 38, compactXp: skillW < 170,
    health: { rect: health }, mana: { rect: mana },
    panel, beltPanel, xp, textH, nameH, pad,
    skills, belt: Array.from({ length: BELT_SLOTS }, (_, i) => ({ x: beltX0 + i * (belt + gap), y: beltY, w: belt, h: belt })),
    target: { x: w / 2 - 130 * s, y: w < 900 ? 36 : 18 * s, w: 260 * s, h: 14 * s },
    floorName: { x: 16 * s, y: 26 * s },
  };
}
