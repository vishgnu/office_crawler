// R5 skill effects (render only): one painter per FX archetype of docs/reviews/R4-contract.md section 5, tinted by damage type.
//   fx:slam fx:ring fx:burst  -> transient ground effects (cast/burst events)        fx:ground  -> lingering field zone (state.zones, kind "field")
//   fx:trap                   -> the wet-floor sign (state.zones, kind "trap")       fx:aura    -> ground ring while state.player.aura is set
//   fx:shield                 -> dome while state.player.absorb is set + hit flash   fx:dash    -> streak + hand truck (event + state.player.dash)
//   fx:bolt / projectileChain -> jagged chain arcs                                   fx:mark    -> seal stamp on the finisher hit
//   fx:summon                 -> paper puff at the spawn tile                        fx:glow    -> rising green motes (existing heal ring) and hot pulses
//   fx:status                 -> overlays on monsters (stun stars, freeze crystals, slow snail, weaken cracks, burn flames; mute keeps its icon)
//   fx:crit                   -> white star flash
// State-backed things (zones, aura, shield, statuses) are drawn from the core state every frame, so a missed event can never leave a stale picture.
// `lights` is the light hook for the lighting rounds: after drawGround() it holds {x, y, r, colour, intensity} (x, y tile centre, r in tiles).
// Everything honours fx.reducedMotion (no pulse, no shake, one frozen frame) and fx.reducedFlash (no white flashes). No core import beyond content.
import { project } from "../../ui/camera.js";
import { content } from "../../core/index.js";
import { INK } from "./shapes.js";

export const TYPE_COL = { physical: ["#f4ecd6", "#b8a77e"], fire: ["#ffd27a", "#ff6a1f"], cold: ["#e4fbff", "#58c8ff"], shock: ["#fffbb0", "#ffd21f"], acid: ["#d8ff9a", "#78c42a"] };
/** Floating-number tint per damage type (physical white, fire orange, cold light blue, shock yellow, acid green; contract section 5). */
export const FLOAT_COL = { physical: "#ffffff", fire: "#ffb060", cold: "#a8e4ff", shock: "#fff07a", acid: "#b6f26a" };
const TAU = Math.PI * 2, RX = 45.25, RY = 22.6;
const ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const hash01 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const curve = (c, lvl = 1) => (Array.isArray(c) ? Math.min(c[2] ?? Infinity, c[0] + (c[1] ?? 0) * (lvl - 1)) : typeof c === "number" ? c : 0);
const pos = { x: 0, y: 0 }, pos2 = { x: 0, y: 0 };
const tileOf = (a, o) => { const f = a.next && a.moveTotal ? a.moveT / a.moveTotal : 0; o.x = a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f + 0.5; o.y = a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f + 0.5; return o; };
const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Fallback visual table for skills whose data carries no `fx.cast` (older cores) and for the damage type. */
const SKILL_LOOK = {
  "pallet-slam": ["fx:slam", "physical"], "demolition-day": ["fx:slam", "physical"], "floor-buffer": ["fx:ring", "physical"], "reply-all": ["fx:ring", "physical"], mute: ["fx:ring", "shock"],
  "blue-screen": ["fx:burst", "shock"], "turn-it-off": ["fx:burst", "shock"], quarantine: ["fx:burst", "cold"], "server-overheat": ["fx:ground", "fire"], "power-surge": ["fx:bolt", "shock"],
  "cold-boot": ["fx:shard", "cold"], lockout: ["fx:shield", "physical"], firewall: ["fx:shield", "cold"], "fire-drill": ["fx:aura", "fire"], "dolly-charge": ["fx:dash", "physical"], "wet-floor": ["fx:trap", "cold"],
  "hard-close": ["fx:mark", "physical"], "coffee-break": ["fx:glow", "physical"], "restore-backup": ["fx:glow", "shock"], intern: ["fx:summon", "physical"], "department-meeting": ["fx:summon", "physical"], "traffic-cone": ["fx:summon", "fire"],
};
const looks = new Map();
/** { fx, type, radius, linger } of a skill id: from the data when it exists, else the fallback table. */
export function skillLook(id, level = 1) {
  let l = looks.get(id);
  if (!l) {
    const d = content.skills?.[id], fb = SKILL_LOOK[id];
    const dmg = d?.effects?.find((e) => e.op === "damage" || e.op === "dot");
    l = { fx: d?.fx?.cast ?? fb?.[0] ?? null, type: dmg?.type ?? d?.tags?.find((t) => TYPE_COL[t]) ?? fb?.[1] ?? "physical", def: d ?? null };
    looks.set(id, l);
  }
  return { fx: l.fx, type: l.type, radius: l.def?.delivery?.radius !== undefined ? curve(l.def.delivery.radius, level) : 0 };
}

/** Status flags of a monster (bit mask), read from the R4 monster fields. */
export const SF = { stun: 1, mute: 2, freeze: 4, slow: 8, weaken: 16, burn: 32 };
export function statusFlags(m) {
  let f = 0;
  if (m.muteT > 0) f |= SF[m.statusKind] ?? SF.mute;
  if (m.slowT > 0) f |= SF.slow;
  if (m.weakenT > 0) f |= SF.weaken;
  if (m.burnT > 0) f |= SF.burn;
  return f;
}

// ---- small shape helpers ----
function star(g, cx, cy, R, r, n, fill, stroke, lw) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i & 1 ? r : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.lineJoin = "round";
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function flame(g, x, y, h, w, outer, inner, lean) { // teardrop flame with an ink outline; (x, y) is the base
  g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 1.1, y - h * 0.45, x + lean, y - h); g.quadraticCurveTo(x + w * 1.1, y - h * 0.45, x + w, y); g.closePath();
  g.fillStyle = outer; g.fill(); g.lineWidth = Math.max(1.2, w * 0.28); g.strokeStyle = INK; g.lineJoin = "round"; g.stroke();
  g.beginPath(); g.moveTo(x - w * 0.5, y); g.quadraticCurveTo(x - w * 0.5, y - h * 0.3, x + lean * 0.6, y - h * 0.62); g.quadraticCurveTo(x + w * 0.5, y - h * 0.3, x + w * 0.5, y); g.closePath(); g.fillStyle = inner; g.fill();
}
function bolt(g, x0, y0, x1, y1, seed, z, jag, widths, cols) { // jagged lightning between two screen points
  const n = 7, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const t = i / n, o = (hash01(seed + i * 3.7) - 0.5) * jag * z; g.lineTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o); }
  g.lineTo(x1, y1);
  g.lineCap = "round"; g.lineJoin = "round";
  for (let p = 0; p < widths.length; p++) { g.lineWidth = widths[p] * z; g.strokeStyle = cols[p]; g.stroke(); }
}

export function createSkillFx(fx) {
  const efx = [], lights = [], zoneCache = new Map(), allyCache = new Map(), last = { fx: null, skill: null, at: -1e9, e: null, type: "physical" };
  let nL = 0, fizzAt = -1e9, absorbMax = 1, absorbRef = null, shieldSkill = "firewall", chain = null, dashDir = { x: 1, y: 1 };
  const M = () => fx.reducedMotion, FL = () => !(fx.reducedFlash || fx.reducedMotion); // reduced motion also drops white flashes (there is no separate option yet)
  const light = (x, y, r, colour, intensity) => { const o = lights[nL] ?? (lights[nL] = { x: 0, y: 0, r: 0, colour: "#fff", intensity: 0 }); o.x = x; o.y = y; o.r = r; o.colour = colour; o.intensity = intensity; nL++; };
  const push = (o) => { if (efx.length > 80) efx.shift(); efx.push(o); return o; };
  const monster = (core, id) => (id === "player" ? core.player : core.monsters.find((m) => m.id === id));

  const api = {
    efx, lights, zoneCache,
    /** Debris chip colour for the last typed cast (physical dust, cold ice, shock sparks). */
    chipColour: () => (TYPE_COL[last.type] ?? TYPE_COL.physical)[last.type === "physical" ? 1 : 0],
    reset() { fizzAt = -1e9; efx.length = 0; zoneCache.clear(); allyCache.clear(); chain = null; absorbMax = 1; absorbRef = null; nL = 0; lights.length = 0; last.at = -1e9; },

    /** Called from fx.handle for every event; returns true when it consumed the old orange burst ring (a typed ring replaces it). */
    handle(ev, core, now) {
      const hero = tileOf(core.player, pos2), hx = hero.x, hy = hero.y;
      switch (ev.type) {
        case "cast": {
          const look = skillLook(ev.skill, ev.level), key = ev.fx ?? look.fx, self = look.def?.delivery?.at === "self" || !ev.tile, to = !self ? { x: ev.tile.x + 0.5, y: ev.tile.y + 0.5 } : { x: hx, y: hy };
          last.fx = key; last.skill = ev.skill; last.at = now; last.type = look.type; last.e = null;
          if (key === "fx:slam") { last.e = push({ k: "slam", x: to.x, y: to.y, r: look.radius || 1.8, born: now, life: 900, type: look.type, seed: hash01(now) * 6 }); if (!M()) fx.shakeUntil = Math.max(fx.shakeUntil, now + 170); }
          else if (key === "fx:ring") last.e = push({ k: "ring", x: to.x, y: to.y, r: look.radius || 2.5, born: now, life: 560, type: look.type });
          else if (key === "fx:burst") last.e = push({ k: "burst", x: to.x, y: to.y, r: look.radius || 3, born: now, life: 640, type: look.type, seed: hash01(now) * 9 });
          else if (key === "fx:glow") { push({ k: "glow", x: hx, y: hy, born: now, life: 800, type: look.type }); fx.burst(hx, hy, 8, now, { sprite: "plus", rise: true }); }
          else if (key === "fx:shield") { shieldSkill = ev.skill; push({ k: "shieldFlash", x: hx, y: hy, born: now, life: 420, skill: ev.skill }); }
          else if (key === "fx:bolt") chain = { skill: ev.skill, born: now, from: { x: hx, y: hy }, pts: [] };
          else if (key === "fx:trap") push({ k: "ring", x: to.x, y: to.y, r: 0.9, born: now, life: 360, type: "cold" });
          break;
        }
        case "burst": {
          const e = last.e;
          if (e && now - last.at < 120 && (e.k === "slam" || e.k === "ring" || e.k === "burst")) { e.x = ev.tile.x + 0.5; e.y = ev.tile.y + 0.5; e.r = ev.radius; return true; }
          return false;
        }
        case "hit": if (chain && ev.skill === chain.skill && now - chain.born < 700) { const m = monster(core, ev.target); if (m) { chain.pts.push(tileOf(m, { x: 0, y: 0 })); chain.end = now; } } break;
        case "projectileChain": push({ k: "arc", x: ev.from.x + 0.5, y: ev.from.y + 0.5, x2: ev.to.x + 0.5, y2: ev.to.y + 0.5, born: now, life: 340, seed: hash01(now) * 50 }); break;
        case "projectileEnd":
          if (ev.reason === "hit" && fx.proj.get?.(ev.id)?.kind === "sealed") { const l = fx.proj.get(ev.id); push({ k: "stamp", x: l.x + 0.5, y: l.y + 0.5, born: now, life: 620 }); }
          break;
        case "crit": { const m = monster(core, ev.target); if (m) { const c = tileOf(m, { x: 0, y: 0 }); push({ k: "crit", x: c.x, y: c.y, head: 36, born: now, life: 380 }); } break; }
        case "status": {
          const m = monster(core, ev.target);
          if (m) { const c = tileOf(m, { x: 0, y: 0 }); push({ k: "statusPop", x: c.x, y: c.y, born: now, life: 420, kind: ev.kind }); }
          break;
        }
        case "dotTick": {
          const m = monster(core, ev.target);
          if (m && ev.kind !== "hot") { const c = tileOf(m, { x: 0, y: 0 }); fx.burst(c.x, c.y, 2, now, { sprite: "spark", rise: true }); }
          else if (ev.kind === "hot") fx.burst(hx, hy, 2, now, { sprite: "plus", rise: true });
          break;
        }
        case "absorb": push({ k: "shieldFlash", x: hx, y: hy, born: now, life: 300, skill: ev.skill ?? shieldSkill, hit: true }); break;
        case "buffStart": if (ev.stat !== "absorb") push({ k: "buff", x: hx, y: hy, born: now, life: 800, stat: ev.stat }); break;
        case "aura": push({ k: "ring", x: hx, y: hy, r: ev.on ? 2.6 : 1.2, born: now, life: 520, type: ev.on ? "acid" : "physical" }); break;
        case "summon": {
          const c = { x: ev.tile.x + 0.5, y: ev.tile.y + 0.5 }, cone = ev.unit === "cone";
          push({ k: "puff", x: c.x, y: c.y, born: now, life: 620, cone });
          fx.burst(c.x, c.y, cone ? 6 : 10, now, { sprite: cone ? "spark" : "paper", rise: true });
          break;
        }
        case "allyDied": { const a = allyCache.get(ev.id); if (a) { push({ k: "puff", x: a.x, y: a.y, born: now, life: 480, grey: true }); allyCache.delete(ev.id); } break; }
        case "zoneStart": zoneCache.set(ev.id, { x: ev.tile.x + 0.5, y: ev.tile.y + 0.5, skill: ev.skill, kind: ev.kind, r: ev.radius }); push({ k: ev.kind === "trap" ? "thump" : "ignite", x: ev.tile.x + 0.5, y: ev.tile.y + 0.5, r: ev.radius, born: now, life: 480, skill: ev.skill }); break;
        case "zoneTrigger": { const z = zoneCache.get(ev.id); if (z && z.kind === "trap") { push({ k: "splash", x: z.x, y: z.y, r: z.r, born: now, life: 560 }); if (FL()) push({ k: "ring", x: z.x, y: z.y, r: z.r, born: now, life: 420, type: "cold" }); } break; }
        case "zoneEnd": { const z = zoneCache.get(ev.id); if (z && z.kind === "field") push({ k: "puff", x: z.x, y: z.y, born: now, life: 520, grey: true, r: z.r }); zoneCache.delete(ev.id); break; }
        case "dash": push({ k: "dash", x: ev.from.x + 0.5, y: ev.from.y + 0.5, x2: ev.to.x + 0.5, y2: ev.to.y + 0.5, born: now, life: 620 }); dashDir = { x: ev.to.x - ev.from.x || 1, y: ev.to.y - ev.from.y }; break;
        case "noMana": case "castRefused": // R11 M-4: a cast that does not go off (mana short, no target, out of range) gets a short dim ring at the feet, so the key press is not silent; at most one per 250 ms
          if (now - fizzAt > 250) { fizzAt = now; push({ k: "puff", x: hx, y: hy, born: now, life: 320, grey: true, r: 0.5, fizz: ev.type === "noMana" }); }
          break;
        case "floorEnter": api.reset(); break;
        default: break;
      }
      return false;
    },

    /** Flat effects under the actors: typed rings, slam cracks, field zones, traps, aura ring, shield back panel, dash streaks. Also fills `lights`. */
    drawGround(g, cam, now) {
      const core = fx.core, z = cam.z, m = M();
      nL = 0;
      for (let i = efx.length - 1; i >= 0; i--) if (now - efx[i].born >= efx[i].life) efx.splice(i, 1);
      for (let i = 0; i < efx.length; i++) {
        const e = efx[i], k0 = (now - e.born) / e.life;
        if (k0 < 0) continue;
        const k = m ? Math.min(k0, 0.5) : k0, fade = Math.max(0, 1 - k0 * k0 * k0), col = TYPE_COL[e.type] ?? TYPE_COL.physical;
        project(cam, e.x, e.y, pos);
        const cx = pos.x, cy = pos.y;
        g.save(); g.lineJoin = "round"; g.lineCap = "round";
        if (e.k === "slam") {
          const rr = e.r * RX * z * (0.45 + 0.55 * ease(k)), ry = rr * 0.5;
          // round G3: the slam has to read at 1x: a bright flash on impact, a thick shock ring with an ink edge, and dust clouds thrown up at the rim
          g.globalAlpha = fade; ell(g, cx, cy, rr * 1.05, ry * 1.05); g.fillStyle = "rgba(214,194,150,0.4)"; g.fill();
          if (k0 < 0.3) { g.globalAlpha = (1 - k0 / 0.3) * 0.85; ell(g, cx, cy, rr * 0.7, rr * 0.35); g.fillStyle = "#fffbe8"; g.fill(); }
          g.globalAlpha = fade; ell(g, cx, cy, rr * 1.05, ry * 1.05); g.lineWidth = Math.max(5, 6.5 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(3, 3.8 * z * 0.7); g.strokeStyle = "#fff4d6"; g.stroke();
          for (let a = 0; a < 9; a++) { // jagged cracks
            const an = a * 0.698 + e.seed, len = rr * (0.5 + 0.5 * hash01(a + e.seed)), mx = Math.cos(an + 0.18) * len * 0.5, my = Math.sin(an + 0.18) * len * 0.25, ex = Math.cos(an) * len, ey = Math.sin(an) * len * 0.5;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + mx, cy + my); g.lineTo(cx + ex, cy + ey);
            g.lineWidth = Math.max(3, 4.4 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.4, 1.8 * z * 0.7); g.strokeStyle = col[0]; g.stroke();
          }
          ell(g, cx, cy, rr * 0.28, rr * 0.14); g.fillStyle = "#1a1530"; g.fill();
          if (!m) for (let d = 0; d < 10; d++) { // dust clouds: round puffs that rise off the rim and grow
            const an = d * 0.628 + e.seed, rise = Math.min(1, k * 1.5), px = cx + Math.cos(an) * rr * 0.95, py = cy + Math.sin(an) * ry * 0.95 - rise * 22 * z * (0.6 + hash01(d + e.seed)), pr = (4 + 7 * rise) * z * (0.7 + 0.5 * hash01(d + 7));
            g.globalAlpha = fade * (1 - rise * 0.5) * 0.9; ell(g, px, py, pr, pr * 0.85); g.fillStyle = d & 1 ? "#e9dcc0" : "#cdbb98"; g.fill(); g.lineWidth = Math.max(1.4, 1.8 * z * 0.7); g.strokeStyle = "rgba(26,21,48,0.55)"; g.stroke();
          }
          if (k0 < 0.4) light(e.x, e.y, e.r * 1.2, "#ffd8a0", 0.5 * (1 - k0 / 0.4));
        } else if (e.k === "ring") {
          const rr = e.r * RX * z * (0.2 + 0.8 * ease(k)), ry = e.r * RY * z * (0.2 + 0.8 * ease(k));
          g.globalAlpha = fade; ell(g, cx, cy, rr, ry); g.fillStyle = rgba(col[1], 0.12); g.fill();
          g.lineWidth = Math.max(3.6, 5 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.8, 2.6 * z * 0.7); g.strokeStyle = col[0]; g.stroke();
          ell(g, cx, cy, rr * 0.8, ry * 0.8); g.lineWidth = Math.max(1, 1.2 * z * 0.7); g.strokeStyle = col[1]; g.stroke();
          for (let t = 0; t < 12; t++) { const a = (t / 12) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * rr * 0.92, cy + Math.sin(a) * ry * 0.92); g.lineTo(cx + Math.cos(a) * rr * 1.07, cy + Math.sin(a) * ry * 1.07); g.lineWidth = Math.max(1.6, 2 * z * 0.7); g.strokeStyle = col[0]; g.stroke(); }
          if (k0 < 0.5) light(e.x, e.y, e.r * 0.9, col[1], 0.45 * (1 - k0 * 2));
        } else if (e.k === "burst") {
          const rr = e.r * RX * z * (0.3 + 0.7 * ease(Math.min(1, k * 1.6))), ry = rr * 0.5;
          g.globalAlpha = fade * 0.95; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, rgba(col[0], 0.75)); gr.addColorStop(0.7, rgba(col[1], 0.4)); gr.addColorStop(1, rgba(col[1], 0.08));
          g.save(); g.translate(cx, cy); g.scale(1, 0.5); g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fillStyle = gr; g.fill(); g.restore();
          burstPattern(g, e.type, cx, cy, rr, ry, z, now, e.seed, m, col);
          ell(g, cx, cy, rr, ry); g.lineWidth = Math.max(3.6, 5 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.8, 2.6 * z * 0.7); g.strokeStyle = col[0]; g.stroke();
          light(e.x, e.y, e.r * 1.1, col[1], 0.7 * fade);
        } else if (e.k === "glow") {
          const rr = (0.4 + 0.9 * ease(k)) * RX * z * 0.9; g.globalAlpha = fade; ell(g, cx, cy, rr, rr * 0.5); g.fillStyle = "rgba(111,224,138,0.16)"; g.fill(); g.lineWidth = Math.max(2, 2.4 * z * 0.7); g.strokeStyle = "#7dff9a"; g.stroke();
          light(e.x, e.y, 1.6, "#7dff9a", 0.4 * fade);
        } else if (e.k === "shieldFlash") {
          const rr = (0.7 + 0.8 * ease(k)) * RX * z * 0.8; g.globalAlpha = fade * 0.9; ell(g, cx, cy, rr, rr * 0.5); g.lineWidth = Math.max(2.4, 3 * z * 0.7); g.strokeStyle = e.skill === "lockout" ? "#ffd24a" : "#7fd8ff"; g.stroke();
        } else if (e.k === "buff") {
          const rr = 0.9 * RX * z * 0.8; g.globalAlpha = fade * 0.8; ell(g, cx, cy, rr, rr * 0.5); g.lineWidth = Math.max(2, 2.4 * z * 0.7); g.strokeStyle = "#ffd24a"; g.setLineDash([5 * z, 4 * z]); g.stroke(); g.setLineDash([]);
          for (let c = 0; c < 3; c++) { const ph = (k + c / 3) % 1, y = cy - ph * 46 * z, x = cx + (c - 1) * 10 * z; g.globalAlpha = fade * Math.sin(ph * Math.PI); g.beginPath(); g.moveTo(x - 5 * z, y + 2 * z); g.lineTo(x, y - 3 * z); g.lineTo(x + 5 * z, y + 2 * z); g.lineWidth = Math.max(3, 3.4 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.6, 1.8 * z * 0.7); g.strokeStyle = "#ffe27a"; g.stroke(); }
        } else if (e.k === "thump") { // trap placed: the sign lands with a small ring
          const rr = (0.3 + 0.7 * ease(k)) * e.r * RX * z; g.globalAlpha = fade; ell(g, cx, cy, rr, rr * 0.5); g.lineWidth = Math.max(2, 2.4 * z * 0.7); g.strokeStyle = "#8fd8ff"; g.stroke();
        } else if (e.k === "ignite") {
          const rr = (0.3 + 0.8 * ease(k)) * e.r * RX * z; g.globalAlpha = fade; ell(g, cx, cy, rr, rr * 0.5); g.fillStyle = "rgba(255,120,40,0.25)"; g.fill(); g.lineWidth = Math.max(2.6, 3.2 * z * 0.7); g.strokeStyle = "#ffb060"; g.stroke();
          light(e.x, e.y, e.r * 1.4, "#ff7a2a", 0.8 * fade);
        } else if (e.k === "splash") {
          g.globalAlpha = fade; for (let d = 0; d < 9; d++) { const a = d * 0.7 + 0.3, rr = (6 + 26 * ease(k)) * z * (0.5 + hash01(d)), h = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 20 * z * (0.5 + hash01(d + 3)); ell(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5 - h, 2.6 * z, 3.6 * z); g.fillStyle = "#bfe9ff"; g.fill(); g.lineWidth = Math.max(1, z * 0.7); g.strokeStyle = INK; g.stroke(); }
        } else if (e.k === "dash") {
          project(cam, e.x2, e.y2, pos2); const x2 = pos2.x, y2 = pos2.y, p = ease(Math.min(1, k * 2)); g.globalAlpha = fade * 0.85;
          for (let l = -1; l <= 1; l++) { g.beginPath(); g.moveTo(cx + l * 4 * z, cy + l * 2 * z - 4 * z); g.lineTo(cx + (x2 - cx) * p + l * 4 * z, cy + (y2 - cy) * p + l * 2 * z - 4 * z); g.lineWidth = Math.max(2, (l ? 2 : 4) * z * 0.7); g.strokeStyle = l ? "rgba(255,255,255,0.7)" : "rgba(255,226,150,0.85)"; g.stroke(); }
          for (let d = 0; d < 6; d++) { const t = (d + 0.5) / 6 * p; ell(g, cx + (x2 - cx) * t, cy + (y2 - cy) * t, (5 + 6 * k) * z, (2.4 + 3 * k) * z); g.fillStyle = "rgba(205,190,160,0.28)"; g.fill(); }
          light(e.x + (e.x2 - e.x) * p, e.y + (e.y2 - e.y) * p, 1.6, "#ffe9b0", 0.35 * fade);
        } else if (e.k === "puff") {
          const rr = (0.3 + 0.9 * ease(k)) * RX * z * (e.r ?? 0.9) * 0.9; g.globalAlpha = fade; ell(g, cx, cy, rr, rr * 0.5); g.fillStyle = e.grey ? "rgba(190,190,205,0.26)" : e.cone ? "rgba(255,150,60,0.24)" : "rgba(255,255,255,0.22)"; g.fill();
          g.lineWidth = Math.max(2, 2.4 * z * 0.7); g.strokeStyle = e.fizz ? "#7f9cff" : e.grey ? "#c9c9dd" : e.cone ? "#ffb070" : "#ffffff"; g.setLineDash([4 * z, 4 * z]); g.stroke(); g.setLineDash([]);
        }
        g.restore();
      }
      if (!core) return;
      const zs = core.zones;
      if (zs) for (let i = 0; i < zs.length; i++) {
        const zn = zs[i]; if (!zoneCache.has(zn.id)) zoneCache.set(zn.id, { x: zn.tile.x + 0.5, y: zn.tile.y + 0.5, skill: zn.skill, kind: zn.kind, r: zn.radius });
        project(cam, zn.tile.x + 0.5, zn.tile.y + 0.5, pos);
        if (pos.x < -200 || pos.x > cam.w + 200 || pos.y < -100 || pos.y > cam.h + 150) continue;
        if (zn.kind === "trap") drawTrap(g, pos.x, pos.y, zn, z, now, m); else drawField(g, pos.x, pos.y, zn, z, now, m);
        if (zn.kind === "field") light(zn.tile.x + 0.5, zn.tile.y + 0.5, zn.radius * 1.3, "#ff7a2a", m ? 0.7 : 0.6 + 0.2 * Math.sin(now / 130 + zn.id));
        else light(zn.tile.x + 0.5, zn.tile.y + 0.5, 0.9, "#8fd8ff", zn.armT > 0 ? 0.1 : 0.2);
      }
      const p = core.player, hero = tileOf(p, pos2), hx = hero.x, hy = hero.y;
      if (p.aura) {
        const lvl = p.skills?.[p.aura] ?? 1, r = skillLook(p.aura, lvl).radius || 3;
        project(cam, hx, hy, pos); drawAura(g, pos.x, pos.y, r, z, now, m);
        light(hx, hy, r * 0.8, "#7dff9a", 0.3);
      }
      if (p.absorb) {
        if (absorbRef !== p.absorb) { absorbRef = p.absorb; absorbMax = Math.max(absorbMax, p.absorb.amount, 1); }
        absorbMax = Math.max(absorbMax, p.absorb.amount);
        project(cam, hx, hy, pos); drawDome(g, pos.x, pos.y, z, now, p.absorb.amount / absorbMax, shieldSkill, false, m);
        light(hx, hy, 1.8, shieldSkill === "lockout" ? "#ffd24a" : "#7fd8ff", 0.35);
      } else { absorbRef = null; absorbMax = 1; }
      // lights that follow state: projectiles, burning / frozen monsters
      if (core.projectiles) for (let i = 0; i < core.projectiles.length; i++) { const pr = core.projectiles[i]; if (!pr.hostile) light(pr.pos.x + 0.5, pr.pos.y + 0.5, pr.kind === "bolt" ? 2.2 : 1.3, PROJ_LIGHT[pr.kind] ?? "#ffe9b0", pr.kind === "bolt" || pr.kind === "shard" || pr.kind === "zap" ? 0.7 : 0.35); }
      for (let i = 0; i < core.monsters.length; i++) { const mo = core.monsters[i]; if (mo.ai === "dead") continue; if (mo.burnT > 0) light(mo.tile.x + 0.5, mo.tile.y + 0.5, 1.4, "#ff7a2a", 0.5); else if (mo.muteT > 0 && mo.statusKind === "freeze") light(mo.tile.x + 0.5, mo.tile.y + 0.5, 1.1, "#8fe4ff", 0.3); }
      for (const a of core.allies ?? []) { tileOf(a, pos); allyCache.set(a.id, { x: pos.x, y: pos.y }); }
      lights.length = nL;
    },

    /** Screen-space effects above the actors: dome front, hand truck, chain arcs, stamps, flashes, stars. */
    drawAir(g, cam, now, playerDir) {
      const core = fx.core, z = cam.z, m = M(), flash = FL();
      for (let i = 0; i < efx.length; i++) {
        const e = efx[i], k0 = (now - e.born) / e.life;
        if (k0 < 0 || k0 >= 1) continue;
        const k = m ? Math.min(k0, 0.5) : k0, fade = Math.max(0, 1 - k0 * k0);
        project(cam, e.x, e.y, pos);
        g.save(); g.lineJoin = "round"; g.lineCap = "round";
        if (e.k === "arc") {
          project(cam, e.x2, e.y2, pos2); const seed = e.seed + (m || !flash ? 0 : Math.floor(now / 55));
          g.globalAlpha = fade; bolt(g, pos.x, pos.y - 18 * z, pos2.x, pos2.y - 18 * z, seed, z, 14, [7, 3.6, 1.6], [INK, "#6fe8ff", "#ffffff"]);
        } else if (e.k === "stamp") {
          const sc = k < 0.18 ? 0.5 + k / 0.18 * 0.7 : 1.2 - (k - 0.18) * 0.2, cy = pos.y - 20 * z;
          g.globalAlpha = k0 > 0.75 ? (1 - k0) * 4 : 1; g.translate(pos.x, cy); g.rotate(-0.25); g.scale(sc * z * 0.9, sc * z * 0.9);
          g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = "#e0363f"; g.stroke();
          g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.lineWidth = 2; g.stroke();
          g.beginPath(); g.moveTo(-5, 0); g.lineTo(-1.5, 4); g.lineTo(6, -5); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = "#e0363f"; g.stroke();
          if (flash && k0 < 0.22) { g.globalAlpha = 1 - k0 / 0.22; star(g, 0, 0, 24, 8, 8, "#ffffff", null, 0); }
        } else if (e.k === "crit") {
          const R = (9 + 13 * ease(Math.min(1, k * 2.2))) * z * (flash ? 1 : 0.7), cy = pos.y - e.head * 0.7 * z; g.globalAlpha = fade;
          star(g, pos.x, cy, R, R * 0.36, 8, flash ? "#ffffff" : "rgba(255,246,200,0.5)", "#ffb347", Math.max(2, 2.6 * z * 0.7));
        } else if (e.k === "statusPop") {
          const R = (6 + 12 * ease(k)) * z; g.globalAlpha = fade; ell(g, pos.x, pos.y - 24 * z, R, R * 0.8); g.lineWidth = Math.max(2, 2.4 * z * 0.7); g.strokeStyle = e.kind === "freeze" ? "#bfeaff" : e.kind === "burn" ? "#ffb060" : e.kind === "stun" ? "#ffe45a" : "#d2c4ff"; g.stroke();
        } else if (e.k === "shieldFlash" && e.hit) {
          const rx = 26 * z, ry = 38 * z; g.globalAlpha = fade * 0.6; ell(g, pos.x, pos.y - 24 * z, rx, ry);
          if (flash) { g.fillStyle = "#ffffff"; g.fill(); } else { g.lineWidth = Math.max(3, 4 * z * 0.7); g.strokeStyle = "#bfe9ff"; g.stroke(); } // reduced flash: an outline pulse instead of a white fill
        } else if (e.k === "shieldFlash") {
          g.globalAlpha = fade * 0.5; ell(g, pos.x, pos.y - 24 * z, 26 * z * (1 + k * 0.2), 38 * z * (1 + k * 0.2)); g.lineWidth = Math.max(2, 3 * z * 0.7); g.strokeStyle = e.skill === "lockout" ? "#ffd24a" : "#7fd8ff"; g.stroke();
        }
        g.restore();
      }
      if (chain && now - chain.born < 560) {
        const k = (now - chain.born) / 560, pts = chain.pts;
        g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.lineJoin = "round";
        let px = chain.from.x, py = chain.from.y;
        for (let i = 0; i < pts.length; i++) {
          project(cam, px, py, pos); project(cam, pts[i].x, pts[i].y, pos2);
          bolt(g, pos.x, pos.y - 26 * z, pos2.x, pos2.y - 22 * z, i * 11 + (m || !flash ? 0 : Math.floor(now / 55)), z, 16, [7, 3.6, 1.6], [INK, "#6fe8ff", "#ffffff"]);
          px = pts[i].x; py = pts[i].y;
        }
        g.restore();
        for (let i = 0; i < pts.length; i++) light(pts[i].x, pts[i].y, 2.2, "#6fe8ff", 0.8 * (1 - k));
      }
      if (!core) return;
      const p = core.player, hero = tileOf(p, pos2); project(cam, hero.x, hero.y, pos);
      if (p.absorb) drawDome(g, pos.x, pos.y, z, now, p.absorb.amount / absorbMax, shieldSkill, true, m);
      if (p.dash) drawHandTruck(g, pos.x, pos.y, z, now, playerDir ?? 0, m);
    },
  };
  return api;
}

const PROJ_LIGHT = { bolt: "#6fe8ff", shard: "#8fe4ff", zap: "#6fe8ff", stapler: "#e8eef8", pen: "#8fb0ff", card: "#ffd0e4", paper: "#f4ecd6", sealed: "#ff7a7a" };

function burstPattern(g, type, cx, cy, rr, ry, z, now, seed, m, col) {
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  const frame = m ? 0 : Math.floor(now / 90);
  if (type === "shock") { // static: jagged lines from the centre and noise speckle
    for (let a = 0; a < 6; a++) { const an = (a / 6) * TAU + seed + frame * 0.35; bolt(g, cx, cy, cx + Math.cos(an) * rr * 0.95, cy + Math.sin(an) * ry * 0.95, a * 9 + frame, z, 10, [Math.max(2.4, 3 * z * 0.7), Math.max(1, 1.2 * z * 0.7)], [INK, col[0]]); }
    for (let s = 0; s < 26; s++) { const an = hash01(s + frame * 7) * TAU, d = Math.sqrt(hash01(s * 3 + 1 + frame * 5)); g.fillStyle = s & 1 ? "#ffffff" : col[1]; g.fillRect(cx + Math.cos(an) * rr * d, cy + Math.sin(an) * ry * d, Math.max(1.5, 2 * z * 0.7), Math.max(1.5, 2 * z * 0.7)); }
  } else if (type === "cold") { // frost: six spokes with branches and a hex outline
    for (let a = 0; a < 6; a++) {
      const an = (a / 6) * TAU + seed * 0.1, ex = Math.cos(an) * rr * 0.9, ey = Math.sin(an) * ry * 0.9;
      for (const pass of [0, 1]) {
        g.strokeStyle = pass ? "#ffffff" : INK; g.lineWidth = pass ? Math.max(1.4, 1.8 * z * 0.7) : Math.max(3, 4 * z * 0.7); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + ex, cy + ey);
        for (const t of [0.45, 0.7]) { const bx = cx + ex * t, by = cy + ey * t, bl = rr * 0.18 * (1.2 - t); for (const s of [-1, 1]) { g.moveTo(bx, by); g.lineTo(bx + Math.cos(an + s * 0.8) * bl, by + Math.sin(an + s * 0.8) * bl * 0.5); } }
        g.stroke();
      }
    }
  } else if (type === "fire") { // flame spikes ringing the edge
    for (let a = 0; a < 14; a++) { const an = (a / 14) * TAU, x = cx + Math.cos(an) * rr * 0.92, y = cy + Math.sin(an) * ry * 0.92; flame(g, x, y, (10 + 6 * hash01(a + seed)) * z * (m ? 1 : 0.8 + 0.3 * Math.sin(now / 90 + a)), 3.4 * z, "#ff8a1f", "#ffe27a", 0); }
  } else if (type === "acid") {
    for (let b = 0; b < 12; b++) { const an = hash01(b + seed) * TAU, d = Math.sqrt(hash01(b * 5 + 2)); ell(g, cx + Math.cos(an) * rr * d * 0.9, cy + Math.sin(an) * ry * d * 0.9, (3 + 4 * hash01(b + 9)) * z, (3 + 4 * hash01(b + 9)) * z * 0.8); g.fillStyle = "rgba(216,255,154,0.6)"; g.fill(); g.lineWidth = Math.max(1, z * 0.7); g.strokeStyle = INK; g.stroke(); }
  } else {
    star(g, cx, cy, rr * 0.7, rr * 0.35, 10, "rgba(255,255,255,0.35)", null, 0);
  }
  g.restore();
}

function drawField(g, x, y, zn, z, now, m) { // fx:ground, Server Overheat: heat shimmer, a scorched disc and licking flames inside the radius
  const rx = zn.radius * RX * z, ry = rx * 0.5, a = Math.min(1, (zn.ttl ?? 99) / 24);
  g.save(); g.globalAlpha = a; g.lineJoin = "round";
  ell(g, x, y, rx, ry); const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, "rgba(255,120,30,0.32)"); gr.addColorStop(0.75, "rgba(255,90,20,0.2)"); gr.addColorStop(1, "rgba(255,90,20,0.05)");
  g.save(); g.translate(x, y); g.scale(1, 0.5); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fillStyle = gr; g.fill(); g.restore();
  ell(g, x, y, rx, ry); g.lineWidth = Math.max(3, 4 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.6, 2.2 * z * 0.7); g.strokeStyle = "#ff9a3a"; g.setLineDash([6 * z, 4 * z]); g.lineDashOffset = m ? 0 : -now / 50; g.stroke(); g.setLineDash([]);
  const n = Math.min(16, 5 + Math.round(zn.radius * 3)), id = zn.id ?? 1, items = [];
  for (let i = 0; i < n; i++) { const an = hash01(id * 13 + i) * TAU, d = Math.sqrt(hash01(id * 7 + i * 3 + 1)) * 0.86; items.push([x + Math.cos(an) * rx * d, y + Math.sin(an) * ry * d, i]); }
  items.sort((p, q) => p[1] - q[1]);
  for (const [fx0, fy0, i] of items) { const f = m ? 1 : 0.75 + 0.25 * Math.sin(now / 110 + i * 1.7), lean = m ? 0 : Math.sin(now / 230 + i) * 2 * z; flame(g, fx0, fy0, (12 + 8 * hash01(i + id)) * z * f, 4 * z, "#ff7a1f", "#ffe27a", lean); }
  if (!m) { g.strokeStyle = "rgba(255,210,150,0.4)"; g.lineWidth = Math.max(1.2, 1.4 * z * 0.7); for (let s = 0; s < 3; s++) { g.beginPath(); for (let t = 0; t <= 8; t++) { const xx = x - rx * 0.6 + (t / 8) * rx * 1.2, yy = y - (14 + s * 9) * z + Math.sin(now / 160 + t * 1.2 + s * 2) * 3 * z; t ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); } }
  g.restore();
}

function drawTrap(g, x, y, zn, z, now, m) { // fx:trap, Wet Floor: a puddle and the yellow A-frame sign; dashed and faint until armed
  const armed = !(zn.armT > 0), a = armed ? 1 : 0.7, pulse = armed && !m ? 0.5 + 0.5 * Math.sin(now / 320) : 0.5, rx = zn.radius * RX * z, ry = rx * 0.5;
  g.save(); g.lineJoin = "round"; g.globalAlpha = a;
  ell(g, x, y, rx, ry); g.fillStyle = `rgba(120,200,255,${0.14 + 0.08 * pulse})`; g.fill(); g.lineWidth = Math.max(2, 2.2 * z * 0.7); g.strokeStyle = `rgba(160,226,255,${0.55 + 0.3 * pulse})`; if (!armed) g.setLineDash([4 * z, 4 * z]); g.stroke(); g.setLineDash([]);
  ell(g, x + 6 * z, y + 2 * z, 7 * z, 3 * z); g.fillStyle = "rgba(160,226,255,0.55)"; g.fill();
  const s = z * 1.5; // A-frame sign
  g.beginPath(); g.moveTo(x - 7 * s, y + 3 * s); g.lineTo(x - 4.2 * s, y - 15 * s); g.lineTo(x + 4.2 * s, y - 15 * s); g.lineTo(x + 7 * s, y + 3 * s); g.closePath(); g.fillStyle = "#ffd23a"; g.fill(); g.lineWidth = Math.max(1.6, 1.8 * s); g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(x - 5.6 * s, y - 3 * s); g.lineTo(x - 4.6 * s, y - 9 * s); g.lineTo(x + 4.6 * s, y - 9 * s); g.lineTo(x + 5.6 * s, y - 3 * s); g.closePath(); g.fillStyle = "#f4a51a"; g.fill();
  g.lineWidth = Math.max(1.6, 2 * s); g.strokeStyle = INK; g.beginPath(); g.moveTo(x - 2 * s, y - 12.6 * s); g.lineTo(x + 0.4 * s, y - 9 * s); g.lineTo(x - 0.6 * s, y - 5.4 * s); g.lineTo(x + 2.2 * s, y - 3 * s); g.stroke(); // a slipping stroke figure
  ell(g, x - 2.6 * s, y - 13.6 * s, 1.1 * s, 1.1 * s); g.fillStyle = INK; g.fill();
  g.restore();
}

function drawAura(g, x, y, r, z, now, m) { // fx:aura, Evacuation Drill: slow pulsing ring with outward chevrons (shape cue: the arrows)
  const rx = r * RX * z, ry = rx * 0.5, pulse = m ? 0.5 : 0.5 + 0.5 * Math.sin(now / 520);
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  ell(g, x, y, rx, ry); g.fillStyle = `rgba(110,240,150,${0.07 + 0.05 * pulse})`; g.fill();
  g.lineWidth = Math.max(3.4, 4.6 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.8, 2.4 * z * 0.7); g.strokeStyle = `rgba(125,255,154,${0.6 + 0.3 * pulse})`; g.stroke();
  g.setLineDash([7 * z, 6 * z]); g.lineDashOffset = m ? 0 : now / 60; ell(g, x, y, rx * 0.86, ry * 0.86); g.lineWidth = Math.max(1, 1.3 * z * 0.7); g.strokeStyle = "rgba(255,255,255,0.55)"; g.stroke(); g.setLineDash([]);
  for (let k = 0; k < 8; k++) {
    const an = (k / 8) * TAU + (m ? 0 : now / 3200), c = Math.cos(an), s = Math.sin(an), d = 0.9 + (m ? 0 : 0.04 * Math.sin(now / 400 + k)), px = x + c * rx * d, py = y + s * ry * d, ang = Math.atan2(s * 0.5, c);
    g.save(); g.translate(px, py); g.rotate(ang); g.scale(1, 0.55);
    g.beginPath(); g.moveTo(-3.4 * z, -3.4 * z); g.lineTo(1.4 * z, 0); g.lineTo(-3.4 * z, 3.4 * z); g.lineWidth = Math.max(3.4, 4 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(1.8, 2 * z * 0.7); g.strokeStyle = "#ffffff"; g.stroke(); g.restore();
  }
  g.restore();
}

function drawDome(g, x, y, z, now, frac, skill, front, m) { // fx:shield: a dome wrapped around the hero; back half under the actors, front half above
  const cx = x, cy = y - 22 * z, rx = 25 * z, ry = 37 * z, lock = skill === "lockout", col = lock ? "255,210,74" : "127,216,255", f = Math.max(0.25, Math.min(1, frac)), pulse = m ? 0.5 : 0.5 + 0.5 * Math.sin(now / 380);
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  if (!front) {
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); g.closePath(); g.fillStyle = `rgba(${col},${0.07 + 0.05 * f})`; g.fill();
    ell(g, x, y, rx * 0.95, rx * 0.5 * 0.95); g.lineWidth = Math.max(2, 2.6 * z * 0.7); g.strokeStyle = `rgba(${col},${0.5 + 0.2 * pulse})`; g.stroke();
  } else {
    ell(g, cx, cy, rx, ry); const gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 0, cx, cy, ry); gr.addColorStop(0, `rgba(255,255,255,${0.1 + 0.06 * f})`); gr.addColorStop(1, `rgba(${col},${0.1 + 0.12 * f})`); g.fillStyle = gr; g.fill();
    g.lineWidth = Math.max(3, 4 * z * 0.7); g.strokeStyle = INK; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    g.lineWidth = Math.max(1.8, 2.4 * z * 0.7); g.strokeStyle = `rgba(${col},${0.7 + 0.2 * pulse})`; g.stroke();
    g.save(); ell(g, cx, cy, rx, ry); g.clip(); g.strokeStyle = `rgba(${col},0.5)`; g.lineWidth = Math.max(1, 1.3 * z * 0.7);
    if (lock) for (let k = -6; k < 7; k++) { g.beginPath(); g.moveTo(cx + k * 9 * z - ry, cy + ry); g.lineTo(cx + k * 9 * z + ry, cy - ry); g.stroke(); } // hazard hatching
    else for (let r = 0; r < 6; r++) { const yy = cy - ry + (r + 0.5) * (ry * 2 / 6); g.beginPath(); g.moveTo(cx - rx, yy); g.lineTo(cx + rx, yy); g.stroke(); for (let c = -3; c < 4; c++) { const xx = cx + (c + (r & 1 ? 0.5 : 0)) * 11 * z; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + ry * 2 / 6); g.stroke(); } } // brick wall
    g.restore();
    g.beginPath(); g.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, Math.PI * 1.15, Math.PI * 1.6); g.lineWidth = Math.max(2, 3 * z * 0.7); g.strokeStyle = "rgba(255,255,255,0.7)"; g.stroke();
    if (lock) { const s = z; fillLock(g, cx, cy - ry - 8 * s, s); }
  }
  g.restore();
}
function fillLock(g, x, y, s) {
  g.beginPath(); g.arc(x, y - 2 * s, 3.4 * s, Math.PI, 0); g.lineWidth = 3.6 * s; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.6 * s; g.strokeStyle = "#ffd24a"; g.stroke();
  g.fillStyle = "#ffd24a"; g.lineWidth = 1.6 * s; g.strokeStyle = INK; g.beginPath(); g.rect(x - 5 * s, y - 2 * s, 10 * s, 7.5 * s); g.fill(); g.stroke();
}

function drawHandTruck(g, x, y, z, now, dir, m) { // fx:dash: the hand truck the hero pushes while the dash lasts
  const v = [[0, 1], [-0.89, 0.45], [-1, 0], [-0.89, -0.45], [0, -1], [0.89, -0.45], [1, 0], [0.89, 0.45]][dir] ?? [0, 1], bx = x + v[0] * 18 * z, by = y + v[1] * 9 * z + 2 * z, s = z;
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  for (const pass of [0, 1]) {
    g.strokeStyle = pass ? "#7fb0ff" : INK; g.lineWidth = (pass ? 2.4 : 5) * s;
    g.beginPath(); g.moveTo(bx - 4 * s, by - 2 * s); g.lineTo(bx - 4 * s, by - 28 * s); g.moveTo(bx + 4 * s, by - 2 * s); g.lineTo(bx + 4 * s, by - 28 * s); g.moveTo(bx - 4 * s, by - 28 * s); g.lineTo(bx + 4 * s, by - 28 * s); g.moveTo(bx - 4 * s, by - 14 * s); g.lineTo(bx + 4 * s, by - 14 * s); g.stroke();
  }
  g.beginPath(); g.moveTo(bx - 6 * s, by - 3 * s); g.lineTo(bx + 6 * s, by - 3 * s); g.lineTo(bx + 6 * s, by + 1 * s); g.lineTo(bx - 6 * s, by + 1 * s); g.closePath(); g.fillStyle = "#aeb8cf"; g.fill(); g.lineWidth = 1.6 * s; g.strokeStyle = INK; g.stroke();
  ell(g, bx, by + 1 * s, 5.4 * s, 5.4 * s); g.fillStyle = "#2a2a38"; g.fill(); g.stroke(); ell(g, bx, by + 1 * s, 2 * s, 2 * s); g.fillStyle = "#c9d2e4"; g.fill();
  g.restore();
}

// ---- status overlays on monsters: called from the world pass with the sprite's screen anchor (x, y) ----
/** Draw the status marks of one monster. sf: bit mask (statusFlags). `head`: head height above the feet in logical px. */
export function drawStatus(g, sf, x, y, head, z, now, m) {
  if (!sf) return;
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  const top = y - (head + 6) * z, t = m ? 0 : now;
  if (sf & SF.burn) { // flames at the feet, licking up the legs
    for (let i = 0; i < 4; i++) { const f = m ? 1 : 0.7 + 0.3 * Math.sin(t / 95 + i * 2), fx0 = x + (i - 1.5) * 6 * z; flame(g, fx0, y - (2 + (i & 1) * 3) * z, (11 + (i & 1) * 5) * z * f, 3.6 * z, "#ff7a1f", "#ffe27a", m ? 0 : Math.sin(t / 150 + i) * 1.6 * z); }
  }
  if (sf & SF.freeze) { // ice crystals around the feet and a crystal over the head
    for (let i = 0; i < 4; i++) { const cx = x + (i - 1.5) * 7.5 * z, h = (9 + (i & 1) * 6) * z; g.beginPath(); g.moveTo(cx - 3 * z, y); g.lineTo(cx, y - h); g.lineTo(cx + 3 * z, y); g.closePath(); g.fillStyle = "rgba(200,244,255,0.85)"; g.fill(); g.lineWidth = Math.max(1.4, 1.6 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(cx - 1 * z, y - 1 * z); g.lineTo(cx, y - h * 0.8); g.strokeStyle = "#ffffff"; g.stroke(); }
    const ix = x - (sf & (SF.stun | SF.slow | SF.weaken) ? 10 : 0) * z, iy = top - 8 * z; g.beginPath(); g.moveTo(ix, iy - 8 * z); g.lineTo(ix + 5 * z, iy); g.lineTo(ix, iy + 8 * z); g.lineTo(ix - 5 * z, iy); g.closePath(); g.fillStyle = "#bfeaff"; g.fill(); g.lineWidth = Math.max(1.6, 1.8 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(ix, iy - 5 * z); g.lineTo(ix, iy + 5 * z); g.moveTo(ix - 3 * z, iy); g.lineTo(ix + 3 * z, iy); g.strokeStyle = "#ffffff"; g.stroke();
  }
  if (sf & SF.stun) { // three stars orbiting the head
    for (let i = 0; i < 3; i++) { const an = t / 260 + (i * TAU) / 3, sx = x + Math.cos(an) * 11 * z, sy = top + 2 * z + Math.sin(an) * 3.4 * z, back = Math.sin(an) < 0; g.globalAlpha = back ? 0.7 : 1; star(g, sx, sy, 5 * z, 2.2 * z, 5, "#ffe45a", INK, Math.max(1.4, 1.6 * z * 0.7)); }
    g.globalAlpha = 1;
  }
  if (sf & SF.slow) { // a snail over the head and dots trailing behind
    const sx = x + 9 * z, sy = top - 4 * z;
    ell(g, sx, sy + 3 * z, 6.5 * z, 2.4 * z); g.fillStyle = "#9fb0d8"; g.fill(); g.lineWidth = Math.max(1.2, 1.4 * z * 0.7); g.strokeStyle = INK; g.stroke();
    ell(g, sx - 1 * z, sy - 1 * z, 4 * z, 4 * z); g.fillStyle = "#6a7ac0"; g.fill(); g.stroke(); g.beginPath(); g.arc(sx - 1 * z, sy - 1 * z, 1.8 * z, 0, Math.PI * 1.6); g.strokeStyle = "#d6defa"; g.stroke();
    g.beginPath(); g.moveTo(sx + 5 * z, sy + 1 * z); g.lineTo(sx + 7 * z, sy - 3 * z); g.moveTo(sx + 6.4 * z, sy + 1 * z); g.lineTo(sx + 9 * z, sy - 2 * z); g.strokeStyle = INK; g.stroke();
    for (let i = 0; i < 3; i++) { ell(g, x - (8 + i * 6) * z, y - (2 + i) * z, (3 - i * 0.7) * z, (1.4 - i * 0.3) * z); g.fillStyle = "rgba(160,180,255,0.7)"; g.fill(); }
  }
  if (sf & SF.weaken) { // cracks across the body and a broken shield mark
    const wy = y - head * 0.45 * z;
    for (const pass of [0, 1]) { g.strokeStyle = pass ? "#ffe27a" : INK; g.lineWidth = (pass ? 1.6 : 3.8) * z * 0.7 + (pass ? 0.4 : 0); g.beginPath(); g.moveTo(x - 7 * z, wy - 9 * z); g.lineTo(x - 2 * z, wy - 3 * z); g.lineTo(x - 5 * z, wy + 1 * z); g.lineTo(x + 1 * z, wy + 8 * z); g.moveTo(x + 6 * z, wy - 6 * z); g.lineTo(x + 3 * z, wy - 1 * z); g.lineTo(x + 7 * z, wy + 3 * z); g.stroke(); }
    const ix = x + (sf & SF.freeze ? 10 : 0) * z, iy = top - 8 * z; g.beginPath(); g.moveTo(ix - 5 * z, iy - 6 * z); g.lineTo(ix + 5 * z, iy - 6 * z); g.lineTo(ix + 5 * z, iy + 1 * z); g.lineTo(ix, iy + 7 * z); g.lineTo(ix - 5 * z, iy + 1 * z); g.closePath(); g.fillStyle = "#ffb060"; g.fill(); g.lineWidth = Math.max(1.4, 1.6 * z * 0.7); g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(ix + 1 * z, iy - 6 * z); g.lineTo(ix - 1 * z, iy - 1 * z); g.lineTo(ix + 2 * z, iy + 2 * z); g.strokeStyle = INK; g.stroke();
  }
  g.restore();
}
