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
  const s = viewScale(w, h), m = Math.max(8, Math.round(8 * s)), gap = Math.max(8, Math.round(6 * s));
  const mugW = 108 * s, mugH = 100 * s, jugW = 84 * s, jugH = 116 * s;
  const health = { x: m, y: h - m - mugH, w: mugW, h: mugH };
  const mana = { x: w - m - jugW, y: h - m - jugH, w: jugW, h: jugH };
  const pad = 6 * s, xpH = Math.max(8, 9 * s), textH = fontPx(s, 10, 12) + 2;
  const availW = mana.x - (health.x + health.w) - 24 * s;
  const row = (n, sz) => n * sz + (n - 1) * gap;
  // S2 fix: slots are at least 44 CSS px on every layout (the HUD never shrinks below the touch/click target size); they only grow with the scale
  const MIN = 44;
  let slot = Math.max(MIN, 44 * s), belt = Math.max(MIN, 40 * s);
  const sideBySide = availW >= row(SKILL_SLOTS, slot) + 2 * pad + 14 * s + row(BELT_SLOTS, belt) + 2 * pad;
  if (!sideBySide) { slot = Math.max(MIN, Math.min(slot, (availW - 2 * pad - (SKILL_SLOTS - 1) * gap) / SKILL_SLOTS)); belt = slot; }
  const showNames = sideBySide && slot >= 38, nameH = showNames ? fontPx(s, 10, 12) * 2 + 4 : 6; // names wrap to two lines under the slots; none on a stacked (phone) HUD
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
    scale: s, margin: m, stacked: !sideBySide, showNames, slotPx: slot, beltPx: belt, compactXp: skillW < 170,
    health: { rect: health }, mana: { rect: mana },
    panel, beltPanel, xp, textH, nameH, pad,
    skills, belt: Array.from({ length: BELT_SLOTS }, (_, i) => ({ x: beltX0 + i * (belt + gap), y: beltY, w: belt, h: belt })),
    target: { x: w / 2 - 130 * s, y: w < 900 ? 82 : 18 * s, w: 260 * s, h: 14 * s },
    floorName: w <= PHONE_MAX_W || h <= PHONE_MAX_H ? { x: 10, y: 66 } : { x: 16 * s, y: 26 * s },
  };
}

/** Phone layout (one panel at a time, tabs) below this width or height. Desktop minimum width is 1024 (NFR-B02). */
export const PHONE_MAX_W = 899, PHONE_MAX_H = 519;
export const isPhone = (w, h) => w <= PHONE_MAX_W || h <= PHONE_MAX_H;

/**
 * Side drawers (S2): the Employee File / Skills / NPC window on the left, the Desk Drawer on the right. Both stop above the
 * health mug and mana jug so the vessels stay visible; the world camera re-centres the hero in the gap that stays free.
 * Cells are 44 px from 1024 px up (the decision's minimum), 40 px on the narrow desktop band; on a phone the grid fits the width.
 */
export const SHORT_MAX_H = 430, SHORT_LANE = 36, SHORT_CELL = 34; // short landscape phone (667x375, 740x360, 844x390): a 36 px toast strip under the panel, 34 px cells
export const TOAST_LANE = 48; // phone: a strip under an open drawer where the toast (at most two lines) sits, so it never covers the panel's action buttons or the potion belt
export function drawerLayout(w, h) {
  const L = hudLayout(w, h), phone = isPhone(w, h);
  const vesselTop = Math.min(L.health.rect.y, L.mana.rect.y), hudTop = Math.min(L.panel.y, L.beltPanel.y, vesselTop);
  if (phone) {
    // FIX-R8T-3 L-1: on a short landscape phone the panel runs down to a one-line toast strip at the bottom (the hotbar, belt and dock hide while it is open), the grid cells stay small
    // and the bag sits beside the equipment; without this the hotbar left only ~100-140 px of body
    if (h <= SHORT_MAX_H && w > h) return { phone, short: true, top: 6, bottom: h - 6 - SHORT_LANE, left: 6, right: 6, leftW: w - 12, rightW: w - 12, cell: SHORT_CELL, hudTop, lane: SHORT_LANE };
    const cell = Math.max(24, Math.floor((w - 36) / 10)); // the grid is the one part that cannot reach 44 px on a 390 px phone (10 columns)
    return { phone, short: false, top: 6, bottom: Math.floor(hudTop - 6 - TOAST_LANE), left: 6, right: 6, leftW: w - 12, rightW: w - 12, cell, hudTop };
  }
  const cell = w >= 1024 ? 44 : 40;
  const leftW = w >= 1024 ? 340 : 320, rightW = cell * 10 + 44;
  return { phone, short: false, top: 8, bottom: Math.floor(Math.min(vesselTop, hudTop) - 8), left: 0, right: 0, leftW, rightW, cell, hudTop };
}

/** Horizontal camera shift (px) that keeps the hero centred in the gap left by the open drawers. */
export function cameraInset(w, h, { left = false, right = false } = {}) {
  const D = drawerLayout(w, h);
  if (D.phone) return 0;
  return ((left ? D.leftW : 0) - (right ? D.rightW : 0)) / 2;
}

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const area = (a, b) => (hit(a, b) ? (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);

/**
 * Tooltip position (pure). Rules (inventory decision, must-fix 1): beside the item toward the drawer's inner edge, flipped to stay
 * on screen, never over the bottom bar (bounds.bottom), never over the hero (`hero` rect), and not over the drawer it belongs to.
 * Covering the other drawer is the last resort before covering the hero.
 * in: { w, h, anchor, panel (the anchor's drawer rect or null), side ("left"|"right"|null), drawers: [rect], hero, bounds: {left, top, right, bottom}, keepClear: [rect] }.
 */
export function placeTip({ w, h, anchor, panel, side = null, drawers = [], hero, bounds, keepClear = [] }) {
  const gap = 8, maxH = Math.max(80, bounds.bottom - bounds.top);
  h = Math.min(h, maxH);
  const clampY = (y) => Math.min(Math.max(bounds.top, y), bounds.bottom - h);
  const clampX = (x) => Math.min(Math.max(bounds.left, x), bounds.right - w);
  const xs = [];
  if (panel) {
    const inner = side === "left" ? panel.x + panel.w + gap : panel.x - w - gap, outer = side === "left" ? panel.x - w - gap : panel.x + panel.w + gap;
    xs.push(inner, outer, bounds.left + gap, bounds.right - w - gap);
  } else xs.push(anchor.x + anchor.w / 2 - w / 2, anchor.x - w - gap, anchor.x + anchor.w + gap);
  const ys = panel ? [anchor.y - 20, bounds.top, bounds.bottom - h, (bounds.top + bounds.bottom - h) / 2] : [anchor.y - h - gap, anchor.y + anchor.h + gap, bounds.top];
  const cands = [];
  for (const x of xs) for (const y of ys) cands.push({ x: clampX(x), y: clampY(y), w, h });
  const clear = (r) => !keepClear.some((k) => hit(r, k)); // the + buttons (and the like) are never covered while any candidate avoids them
  const ok = (r, passes) => !hit(r, hero) && clear(r) && !(panel && hit(r, panel)) && (!passes.drawers || !drawers.some((d) => d !== panel && hit(r, d)));
  const pick = cands.find((r) => ok(r, { drawers: true })) ?? cands.find((r) => ok(r, { drawers: false }));
  if (pick) return { x: Math.round(pick.x), y: Math.round(pick.y), h };
  const free = cands.filter(clear);
  if (free.length) { const b2 = free.reduce((a, r) => (area(r, hero) < area(a, hero) ? r : a), free[0]); return { x: Math.round(b2.x), y: Math.round(b2.y), h }; }
  const best = cands.reduce((a, r) => (area(r, hero) < area(a, hero) ? r : a), cands[0]);
  return { x: Math.round(best.x), y: Math.round(best.y), h };
}
