// HUD: coffee-mug health and water-cooler-jug mana vessels (glyph + numbers inside), an XP bar with level text,
// a skill bar (F1-F4 key badges, names under the icons), the potion belt (keys 1-4), the target bar and the floor
// name. The static parts are baked into three small layers (rebuilt only when the size, level or XP percent changes);
// only the liquid, the XP fill, the numbers and the target bar are drawn per frame.
import { content } from "../core/index.js";
import { hudLayout, fontPx, SKILL_SLOTS, BELT_SLOTS } from "../ui/layout.js";
import { keys } from "./keys.js";

const S = content.strings;
const ratio = (v, max) => (max > 0 ? Math.min(1, Math.max(0, v / max)) : 0);
const FONT = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";

const xpPercent = (p) => Math.floor(ratio(p.xp, p.xpNext) * 100);

/** HUD values + rects for the hook and tests (pure). */
export function hudState(core, w, h, style) {
  const L = hudLayout(w, h), p = core.player;
  const gauge = (kind, value, max, geo) => ({
    value, max, ratio: ratio(value, max), shape: style.ui.shapes[kind], label: `${value} / ${max}`,
    rect: { ...geo.rect },
  });
  return {
    health: gauge("health", p.hp, p.hpMax, L.health), mana: gauge("mana", p.mp, p.mpMax, L.mana),
    xp: { value: p.xp, next: p.xpNext, ratio: ratio(p.xp, p.xpNext), level: p.level, percent: xpPercent(p), rect: { ...L.xp } },
    skills: Array.from({ length: SKILL_SLOTS }, (_, i) => ({ key: `${S.keyF}${i + 1}`, name: i === 0 ? S.skillStrike : S.skillEmpty, empty: i !== 0, rect: { ...L.skills[i] } })),
    belt: L.belt.map((r, i) => ({ key: String(i + 1), empty: true, rect: { ...r } })),
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
  const panel = (g, r, hc, s) => {
    g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 8 * s);
    g.fillStyle = hc ? "#000000" : U.panel; g.fill();
    g.lineWidth = hc ? 3 : 3.4; g.strokeStyle = hc ? "#ffffff" : U.panelEdge; g.stroke();
    if (!hc) { g.beginPath(); g.roundRect(r.x + 2.2, r.y + 2.2, r.w - 4.4, r.h - 4.4, 6 * s); g.lineWidth = 1.4; g.strokeStyle = U.slotEdge; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1; }
  };
  const badge = (g, str, cx, cy, s, hc) => {
    const fs = fontPx(s, 8, 10), w = Math.max(fs * 1.7, g.measureText(str).width + 6), h = fs * 1.35;
    g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    g.fillStyle = hc ? "#ffffff" : "#3a2f78"; g.fill(); g.lineWidth = 2; g.strokeStyle = hc ? "#000" : U.panelEdge; g.stroke();
    g.font = `800 ${fs}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = hc ? "#000000" : U.text; g.fillText(str, cx, cy + 0.5);
  };

  const H = {
    /** Draw the whole HUD. */
    draw(g, w, h, core, atlas, now, targetId, dpr, hc) {
      const { L, cr } = layoutFor(w, h), s = L.scale, p = core.player, ref = style.ui.vesselRef, pad = style.ui.vesselPad;
      // live liquid first (the baked frame is drawn over it)
      style.ui.drawVesselLive(g, "health", L.health.rect.x, L.health.rect.y, L.health.rect.w, L.health.rect.h, ratio(p.hp, p.hpMax), now);
      style.ui.drawVesselLive(g, "mana", L.mana.rect.x, L.mana.rect.y, L.mana.rect.w, L.mana.rect.h, ratio(p.mp, p.mpMax), now);
      // baked frames
      const pct = xpPercent(p), base = `${w}|${h}|${dpr}|${hc ? 1 : 0}|${atlas.meta.id}`;
      this.frame(g, "health", L.health.rect, ref, pad, atlas, dpr, base);
      this.frame(g, "mana", L.mana.rect, ref, pad, atlas, dpr, base);
      const cl = layer("centre", `${base}|${p.level}|${pct}`, cr, dpr, (bg) => this.bakeCentre(bg, L, atlas, p, pct, hc));
      g.drawImage(cl.c, cl.x, cl.y, cl.w, cl.h);
      // dynamic: XP fill, numbers
      const xp = L.xp, xr = ratio(p.xp, p.xpNext);
      if (xr > 0) {
        g.beginPath(); g.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * xr), xp.h, xp.h / 2); g.fillStyle = U.xp; g.fill();
        g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(xp.x + xp.h / 2, xp.y + 1, Math.max(0, xp.w * xr - xp.h), xp.h * 0.3);
      }
      const nfs = fontPx(s, 12.5, 13);
      if (labels.hpV !== p.hp || labels.hpM !== p.hpMax) { labels.hpV = p.hp; labels.hpM = p.hpMax; labels.hp = `${p.hp}/${p.hpMax}`; }
      if (labels.mpV !== p.mp || labels.mpM !== p.mpMax) { labels.mpV = p.mp; labels.mpM = p.mpMax; labels.mp = `${p.mp}/${p.mpMax}`; }
      const hr = L.health.rect, mr = L.mana.rect, hk = hr.w / ref.health.w, mk = mr.w / ref.mana.w;
      text(g, labels.hp, hr.x + 42 * hk, hr.y + 82 * hk, nfs, "#ffffff");
      text(g, labels.mp, mr.x + 42 * mk, mr.y + 100 * mk, nfs, "#ffffff");
      // floor name (top left)
      text(g, S.floorName, L.floorName.x, L.floorName.y, fontPx(s, 13, 14), U.subtle, "left", 600);

      const m = targetId && core.monsters.find((o) => o.id === targetId && o.ai !== "dead");
      if (m) {
        const t = L.target, def = content.monsters[m.type];
        g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, t.h / 2); g.fillStyle = hc ? "#2a2a2a" : P.plate.hpTrack; g.fill();
        g.save(); g.clip();
        g.fillStyle = hc ? P.plateHc.hp : P.plate.hp; g.fillRect(t.x, t.y, t.w * ratio(m.hp, m.hpMax), t.h);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(t.x, t.y, t.w * ratio(m.hp, m.hpMax), t.h * 0.38);
        g.restore();
        g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, t.h / 2); g.lineWidth = 3 * s; g.strokeStyle = hc ? "#fff" : P.ink; g.stroke();
        text(g, def.name, w / 2, t.y + t.h + fontPx(s, 13, 14) + 4, fontPx(s, 13, 14), "#ffffff");
      }
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
      if (L.beltPanel.x >= L.panel.x + L.panel.w - 1 || L.stacked) panel(g, L.beltPanel, hc, s);
      // level text and XP track
      const tfs = fontPx(s, 10, 12), ty = L.xp.y - 4 * s;
      text(g, `${S.level} ${p.level}`, L.xp.x, ty, tfs, hc ? "#fff" : U.xp, "left", 800, null);
      text(g, L.compactXp ? `${pct}%` : `${pct}% ${S.toLevel} ${p.level + 1}`, L.xp.x + L.xp.w, ty, tfs, hc ? "#fff" : U.subtle, "right", 700, null);
      g.beginPath(); g.roundRect(L.xp.x, L.xp.y, L.xp.w, L.xp.h, L.xp.h / 2); g.fillStyle = hc ? "#2a2a2a" : "#0d0a1c"; g.fill(); g.lineWidth = 2; g.strokeStyle = hc ? "#fff" : U.panelEdge; g.stroke();
      // skill slots
      const slotE = atlas.get(keys.ui("skill-slot")), icon = atlas.get(keys.ui("skill-icon-strike")), plus = atlas.get(keys.ui("icon-plus")), beltE = atlas.get(keys.ui("belt-slot"));
      L.skills.forEach((r, i) => {
        g.drawImage(slotE.img, r.x, r.y, r.w, r.h);
        if (i === 0) { g.drawImage(icon.img, r.x, r.y, r.w, r.h); g.beginPath(); g.roundRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, r.w * 0.2); g.lineWidth = 2.6; g.strokeStyle = U.xp; g.stroke(); }
        else { g.globalAlpha = 0.6; g.drawImage(plus.img, r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
        if (L.showNames) text(g, i === 0 ? S.skillStrike : S.skillEmpty, r.x + r.w / 2, r.y + r.h + fontPx(s, 10, 12) + 1, fontPx(s, 10, 12), i === 0 ? U.text : U.empty, "center", 700, null);
        badge(g, `${S.keyF}${i + 1}`, r.x + r.w * 0.2, r.y, s, hc);
      });
      L.belt.forEach((r, i) => {
        g.drawImage(beltE.img, r.x, r.y, r.w, r.h);
        badge(g, String(i + 1), r.x + r.w * 0.2, r.y, s, hc);
      });
    },
  };
  return H;
}

function unionRect(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y: y - 8, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y + 8 };
}
