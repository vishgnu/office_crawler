// HUD: coffee-mug health and water-cooler-jug mana vessels (glyph + numbers inside), an XP bar with level text,
// the skill bar and potion belt frames, the target bar and the floor name. The static parts are baked into small layers
// (rebuilt only when the size, level or XP percent changes); only the liquid, the XP fill, the numbers and the target
// bar are drawn per frame. The slot contents (skill icons, F1-F4 and 1-4 badges, potion icons, the selected-slot
// highlight, the panel buttons with point badges) are DOM buttons placed on the rects below (src/ui/panels.js), so
// they are focusable, labelled and clickable; hudState() is the single description of both.
import { content, config } from "../core/index.js";
import { hudLayout, fontPx, SKILL_SLOTS, BELT_SLOTS } from "../ui/layout.js";
import { xpRatio, xpProgress } from "../ui/itemview.js";
import { T } from "../ui/text.js";
import { keys } from "./keys.js";
import { keyLabel } from "../input/keymap.js";
import { drawPanelChrome, snapRect } from "./hudchrome.js";

const S = content.strings;
const ratio = (v, max) => (max > 0 ? Math.min(1, Math.max(0, v / max)) : 0);
const FONT = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";

const xpPercent = (p) => Math.floor(xpRatio(p) * 100); // progress inside the current level (AC-R-077-2)
const floorLabel = (core) => (core.depth > 0 ? `${T.floorWord} ${core.depth}: ${core.floor.name}` : core.floor.name);

const num = (n) => Number(n).toLocaleString("en-US");
/** Within-level numbers for the label ("320 / 1,280 (25%)"); the total XP goes in the tooltip (S2 fix contract). */
function xpLabelParts(p) {
  const v = xpProgress(p);
  return { into: v.into, span: v.span, total: v.total, label: v.capped ? T.xpMax : `${num(v.into)} / ${num(v.span)} (${v.pct}%)`, tip: `${T.xpTotal}: ${num(v.total)}` };
}

/** The engaged boss, if any (shown in the top bar while it fights: AC-R-045). */
export const engagedBoss = (core) => core.scene === "floor" ? core.monsters.find((o) => o.tier === "boss" && o.boss?.engaged && o.ai !== "dead") ?? null : null;
const bossInfo = (core) => {
  const m = engagedBoss(core);
  return m ? { id: m.id, name: m.name ?? content.bosses?.[m.type]?.name ?? S.bossName, hp: m.hp, hpMax: m.hpMax, ratio: ratio(m.hp, m.hpMax), phase: m.boss.phase, markAt: config.boss.phase2At, windup: m.boss.windup ? m.boss.windup.kind : null } : null;
};
/** Badge text of a key bound in options (F1 / 1 / ...), falling back to the default label. */
const badge = (core, action, fallback) => keyLabel(core.options?.keys?.[action]) || fallback;

/** HUD values + rects for the hook, the DOM slot layer and tests (pure). */
export function hudState(core, w, h, style, hoverId = null) {
  const L = hudLayout(w, h), p = core.player, bar = p.skillBar;
  const gauge = (kind, value, max, geo) => ({
    value, max, ratio: ratio(value, max), shape: style.ui.shapes[kind], label: `${value} / ${max}`,
    rect: { ...geo.rect },
  });
  const slotOf = (i) => {
    const id = bar.hotkeys[i], def = id ? content.skills[id] : null, level = id === "strike" ? 1 : id ? p.skills[id] ?? 0 : 0;
    const cost = def?.mana ? def.mana(Math.max(1, level)) : 0;
    return {
      index: i, key: badge(core, `skill${i + 1}`, `${S.keyF}${i + 1}`), skill: id ?? null, name: def ? def.name : S.skillEmpty, empty: !def, level, cost,
      disabled: !!def && (level < 1 || p.mp < cost), selected: bar.selected === i, rect: { ...L.skills[i] },
    };
  };
  const slots = Array.from({ length: SKILL_SLOTS }, (_, i) => slotOf(i));
  const m = hoverId ? core.monsters.find((o) => o.id === hoverId && o.ai !== "dead") : null;
  const prev = config.xpTable[p.level - 1] ?? 0;
  return {
    health: gauge("health", p.hp, p.hpMax, L.health), mana: gauge("mana", p.mp, p.mpMax, L.mana),
    xp: { value: p.xp, next: p.xpNext, ratio: ratio(p.xp, p.xpNext), level: p.level, percent: xpPercent(p), ...xpLabelParts(p), rect: { ...L.xp } },
    xpBar: { value: p.xp - prev, span: Math.max(0, p.xpNext - prev), ratio: xpRatio(p), level: p.level, percent: xpPercent(p) },
    level: p.level, points: { attr: p.attrPoints, skill: p.skillPoints },
    skills: slots, skillBar: { primary: bar.primary, secondary: bar.secondary, selected: bar.selected, hotkeys: [...bar.hotkeys], slots },
    belt: L.belt.map((r, i) => {
      const it = core.belt[i];
      return { index: i, key: badge(core, `belt${i + 1}`, String(i + 1)), empty: !it, item: it ? { id: it.id, name: it.name, restores: it.restores, restore: it.restore, base: it.base, w: 1, h: 1 } : null, rect: { ...r } };
    }),
    target: m ? { id: m.id, name: m.name ?? (content.monsters[m.type] ?? content.bosses[m.type]).name, hp: m.hp, hpMax: m.hpMax, ratio: ratio(m.hp, m.hpMax) } : null,
    boss: bossInfo(core),
    floor: { depth: core.depth, name: core.floor.name, label: floorLabel(core) },
  };
}

export function createHud(style) {
  const P = style.palette, U = P.ui, layers = {}; // name -> { key, c, x, y, w, h }
  const labels = { hp: "", hpV: -1, hpM: -1, mp: "", mpV: -1, mpM: -1 };

  /** Bake `draw(g)` (in screen CSS px) for the rect (x, y, w, h) into a canvas at dpr; rebuilt when `key` changes. */
  function layer(name, key, rect, dpr, draw) {
    let l = layers[name];
    if (!l || l.key !== key) {
      const c = l?.c ?? document.createElement("canvas"), x = Math.floor(rect.x), y = Math.floor(rect.y), w = Math.ceil(rect.w + (rect.x - x)) + 1, h = Math.ceil(rect.h + (rect.y - y)) + 1;
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr);
      draw(g);
      l = layers[name] = { key, c, x, y, w, h };
    }
    return l;
  }
  const fonts = new Map();
  const fontStr = (weight, size) => { const k = weight * 1000 + size; let f = fonts.get(k); if (!f) { f = `${weight} ${size}px ${FONT}`; fonts.set(k, f); } return f; };
  let lay = null;
  const layoutFor = (w, h) => (lay && lay.w === w && lay.h === h ? lay : (lay = { w, h, L: hudLayout(w, h) }, lay.cr = unionRect(lay.L.panel, lay.L.beltPanel), lay));
  const text = (g, str, x, y, size, fill, align = "center", weight = 800, stroke = P.ink) => {
    g.font = fontStr(weight, size); g.textAlign = align; g.textBaseline = "alphabetic"; g.lineJoin = "round";
    if (stroke) { g.lineWidth = Math.max(3, size * 0.28); g.strokeStyle = stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  };
  // HUD chrome (G round, item 4): sheen, inner shadow, bevel, stitched border and rivets come from render/hudchrome.js (baked into the centre layer)
  const panel = (g, r, hc, s) => {
    g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 8 * s);
    g.fillStyle = hc ? "#000000" : U.panel; g.fill();
    g.lineWidth = hc ? 3 : 3.4; g.strokeStyle = hc ? "#ffffff" : U.panelEdge; g.stroke();
    if (!hc) drawPanelChrome(g, r, s);
  };
  const H = {
    /** Draw the whole HUD. */
    draw(g, w, h, core, atlas, now, targetId, dpr, hc) {
      const { L, cr } = layoutFor(w, h), s = L.scale, p = core.player, ref = style.ui.vesselRef, pad = style.ui.vesselPad;
      const hr0 = ratio(p.hp, p.hpMax), low = hr0 > 0 && hr0 < 0.3; // low-HP state: the mug shakes and cracks
      if (low) { g.save(); g.translate(Math.sin(now * 0.05) * 1.6 * s, Math.cos(now * 0.07) * 1.1 * s); }
      // live liquid first (the baked frame is drawn over it)
      style.ui.drawVesselLive(g, "health", L.health.rect.x, L.health.rect.y, L.health.rect.w, L.health.rect.h, hr0, now);
      style.ui.drawVesselLive(g, "mana", L.mana.rect.x, L.mana.rect.y, L.mana.rect.w, L.mana.rect.h, ratio(p.mp, p.mpMax), now);
      // baked frames
      const pct = xpPercent(p), base = `${w}|${h}|${dpr}|${hc ? 1 : 0}|${atlas.meta.id}`;
      this.frame(g, "health", L.health.rect, ref, pad, atlas, dpr, base);
      if (low) this.crack(g, L.health.rect, s);
      this.frame(g, "mana", L.mana.rect, ref, pad, atlas, dpr, base);
      const cl = layer("centre", `${base}|${p.level}|${p.xp}|${p.xpNext}`, cr, dpr, (bg) => this.bakeCentre(bg, L, atlas, p, pct, hc));
      g.drawImage(cl.c, cl.x, cl.y, cl.w, cl.h);
      // dynamic: XP fill, numbers
      const xp = L.xp, xr = xpRatio(p);
      if (xr > 0) {
        g.beginPath(); g.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * xr), xp.h, xp.h / 2); g.fillStyle = U.xp; g.fill();
        g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(xp.x + xp.h / 2, xp.y + 1, Math.max(0, xp.w * xr - xp.h), xp.h * 0.3);
      }
      const nfs = fontPx(s, 12.5, 13);
      if (labels.hpV !== p.hp || labels.hpM !== p.hpMax) { labels.hpV = p.hp; labels.hpM = p.hpMax; labels.hp = `${p.hp}/${p.hpMax}`; }
      if (labels.mpV !== p.mp || labels.mpM !== p.mpMax) { labels.mpV = p.mp; labels.mpM = p.mpMax; labels.mp = `${p.mp}/${p.mpMax}`; }
      const hr = L.health.rect, mr = L.mana.rect, hk = hr.w / ref.health.w, mk = mr.w / ref.mana.w;
      text(g, labels.hp, hr.x + 42 * hk, hr.y + 82 * hk, nfs, "#ffffff");
      if (low) g.restore();
      text(g, labels.mp, mr.x + 42 * mk, mr.y + 100 * mk, nfs, "#ffffff");
      // floor name (top left)
      text(g, floorLabel(core), L.floorName.x, L.floorName.y, fontPx(s, 13, 14), U.subtle, "left", 600);

      const boss = engagedBoss(core);
      if (boss) this.bossBar(g, w, L, s, boss, hc);
      const m = targetId && targetId !== boss?.id && core.monsters.find((o) => o.id === targetId && o.ai !== "dead");
      if (m) {
        const t = L.target, def = content.monsters[m.type] ?? content.bosses[m.type];
        g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, t.h / 2); g.fillStyle = hc ? "#2a2a2a" : P.plate.hpTrack; g.fill();
        g.save(); g.clip();
        g.fillStyle = hc ? P.plateHc.hp : P.plate.hp; g.fillRect(t.x, t.y, t.w * ratio(m.hp, m.hpMax), t.h);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(t.x, t.y, t.w * ratio(m.hp, m.hpMax), t.h * 0.38);
        g.restore();
        g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, t.h / 2); g.lineWidth = 3 * s; g.strokeStyle = hc ? "#fff" : P.ink; g.stroke();
        text(g, m.name ?? def.name, w / 2, t.y + t.h + fontPx(s, 13, 14) + 4, fontPx(s, 13, 14), "#ffffff");
      }
    },

    /** Boss health bar across the top while the boss fights: name, fill, a marker where phase 2 starts, the phase when it has begun. */
    bossBar(g, w, L, s, m, hc) {
      const bw = Math.min(w - 32, 560 * s), bh = Math.max(16, 20 * s), x = (w - bw) / 2, y = w < 900 ? L.target.y : 34 * s, r = ratio(m.hp, m.hpMax), fs = fontPx(s, 14, 14);
      g.beginPath(); g.roundRect(x, y, bw, bh, bh / 2); g.fillStyle = hc ? "#2a2a2a" : P.plate.hpTrack; g.fill();
      g.save(); g.clip();
      g.fillStyle = m.boss.phase >= 2 ? (hc ? "#ffffff" : "#e0523c") : (hc ? P.plateHc.hp : P.plate.hp); g.fillRect(x, y, bw * r, bh);
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x, y, bw * r, bh * 0.38);
      g.restore();
      const mx = x + bw * config.boss.phase2At;
      g.fillStyle = "#ffffff"; g.fillRect(mx - 1.5, y - 2, 3, bh + 4); // phase marker
      g.beginPath(); g.roundRect(x, y, bw, bh, bh / 2); g.lineWidth = 3 * s; g.strokeStyle = hc ? "#fff" : P.ink; g.stroke();
      text(g, m.name ?? content.bosses?.[m.type]?.name ?? S.bossName, w / 2, y - 6, fs, "#ffffff");
      if (m.boss.phase >= 2) text(g, `${T.bossPhaseLabel} 2`, x + bw, y + bh + fs + 2, fontPx(s, 12, 13), "#ffd0c8", "right", 700);
    },

    /** A crack across the mug body (drawn only in the low-HP state). */
    crack(g, r, s) {
      const x = r.x, y = r.y, w = r.w, h = r.h;
      g.save(); g.lineCap = "round"; g.lineJoin = "round";
      const path = () => { g.beginPath(); g.moveTo(x + w * 0.46, y + h * 0.2); g.lineTo(x + w * 0.38, y + h * 0.36); g.lineTo(x + w * 0.5, y + h * 0.46); g.lineTo(x + w * 0.4, y + h * 0.62); g.lineTo(x + w * 0.46, y + h * 0.72); g.moveTo(x + w * 0.5, y + h * 0.46); g.lineTo(x + w * 0.62, y + h * 0.52); };
      path(); g.lineWidth = Math.max(3, 3.4 * s); g.strokeStyle = P.ink; g.stroke();
      path(); g.lineWidth = Math.max(1.4, 1.5 * s); g.strokeStyle = "#ffe9ee"; g.stroke();
      g.restore();
    },

    frame(g, kind, r, ref, pad, atlas, dpr, base) {
      const k = r.w / ref[kind].w, l = layers[kind];
      if (!l || l.key !== base) {
        const e = atlas.get(keys.ui(`vessel-${kind}`)), box = { x: r.x - pad * k, y: r.y - pad * k, w: e.w * k, h: e.h * k };
        layer(kind, base, box, dpr, (bg) => bg.drawImage(e.img, box.x, box.y, box.w, box.h));
      }
      const c = layers[kind];
      g.drawImage(c.c, c.x, c.y, c.w, c.h);
    },

    bakeCentre(g, L, atlas, p, pct, hc) {
      const s = L.scale;
      panel(g, L.panel, hc, s);
      panel(g, L.beltPanel, hc, s);
      // level text and XP track
      const tfs = fontPx(s, 10, 12), ty = L.xp.y - 4 * s;
      text(g, `${S.level} ${p.level}`, L.xp.x, ty, tfs, hc ? "#fff" : U.xp, "left", 800, null);
      const xl = xpLabelParts(p).label;
      text(g, L.compactXp ? `${pct}%` : xl, L.xp.x + L.xp.w, ty, tfs, hc ? "#fff" : U.subtle, "right", 700, null);
      g.beginPath(); g.roundRect(L.xp.x, L.xp.y, L.xp.w, L.xp.h, L.xp.h / 2); g.fillStyle = hc ? "#2a2a2a" : "#0d0a1c"; g.fill(); g.lineWidth = 2; g.strokeStyle = hc ? "#fff" : U.panelEdge; g.stroke();
      // empty slot wells; the DOM slot layer puts icons, badges and the selection ring on top of them
      const slotE = atlas.get(keys.ui("skill-slot")), beltE = atlas.get(keys.ui("belt-slot"));
      const draw = (img, r) => { const q = snapRect(r); g.drawImage(img, q.x, q.y, q.w, q.h); }; // snapped to whole pixels: crisp edges, same rects as the DOM slots
      L.skills.forEach((r) => draw(slotE.img, r));
      L.belt.forEach((r) => draw(beltE.img, r));
    },
  };
  return H;
}

function unionRect(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y: y - 8, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y + 8 };
}
