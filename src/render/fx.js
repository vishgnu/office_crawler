// Render-only effects (floaters, paper bursts, hit flashes, impact stars, hit-stop, camera shake). Never touches
// core state and never feeds back into the simulation; timing uses the render clock. Hit-stop only delays the
// realtime loop (game.js reads fx.hitStopUntil); it never changes what a tick computes.
import { createRng } from "../rng.js";
import { project } from "../ui/camera.js";
import { keys, PLAYER_CLASS } from "./keys.js";
import { content } from "../core/index.js";
import { actorPos } from "./world.js";

const S = content.strings;
const FLOATER_MS = 560;       // drift up-right over about half a second
const HIT_STOP_MS = 55, KILL_STOP_MS = 95;
const SANS = "'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif";
const fonts = [];
const fontFor = (px) => (fonts[px] ??= `900 italic ${px}px ${SANS}`);
const ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

export function createFx(style) {
  const rng = createRng(7), P = style.palette, pos = { x: 0, y: 0 }, shk = { x: 0, y: 0 };
  let hurtCanvas = null, hurtW = 0, hurtH = 0;
  const fx = {
    floaters: [], parts: [], flash: new Map(), slashes: [],
    hurtUntil: 0, lowHp: false, beat: -1, shakeUntil: 0, hitStopUntil: 0, deathAt: null, lowFx: false,
    reset() { fx.floaters.length = 0; fx.parts.length = 0; fx.flash.clear(); fx.slashes.length = 0; fx.hurtUntil = fx.shakeUntil = fx.hitStopUntil = 0; fx.deathAt = null; fx.lowHp = false; fx.beat = -1; },
    handle(ev, core, now) {
      const find = (id) => (id === "player" ? core.player : core.monsters.find((m) => m.id === id));
      if (ev.type === "hit" || ev.type === "miss") {
        const t = find(ev.target);
        if (!t) return;
        const cx = actorPos(t, pos).x + 0.5, cy = pos.y + 0.5, toPlayer = ev.target === "player";
        const head = style.dims[toPlayer ? PLAYER_CLASS : t.type]?.head ?? 50;
        if (fx.floaters.length > 24) fx.floaters.shift();
        // stack: a floater that spawns while another one of the same target is still near its spawn point goes one row higher, and
        // damage numbers to the hero get their own column (left of the hero) so "miss" and damage never share a spot
        let row = 0;
        for (const o of fx.floaters) if (o.target === ev.target && now - o.born < 420) row = Math.max(row, o.row + 1);
        fx.floaters.push({ x: cx, y: cy, head, target: ev.target, row, text: ev.type === "hit" ? String(ev.value) : S.miss, born: now, kind: ev.type === "miss" ? 1 : toPlayer ? 2 : 0 });
        if (ev.type === "hit") {
          fx.flash.set(ev.target, now + (toPlayer ? 220 : 110));
          if (toPlayer) { fx.hurtUntil = now + 260; fx.shakeUntil = now + 140; }
          else { fx.slashes.push({ x: cx, y: cy, head, born: now }); fx.hitStopUntil = Math.max(fx.hitStopUntil, now + HIT_STOP_MS); }
          fx.burst(cx, cy, toPlayer ? 4 : 9, now);
        }
      } else if (ev.type === "kill") {
        const t = find(ev.target);
        if (t) { const c = actorPos(t, pos); fx.burst(c.x + 0.5, c.y + 0.5, 18, now); fx.hitStopUntil = Math.max(fx.hitStopUntil, now + KILL_STOP_MS); }
      } else if (ev.type === "death") {
        fx.deathAt = now; fx.hurtUntil = now + 900;
      }
    },
    burst(x, y, n, now) {
      if (fx.lowFx) n = Math.ceil(n / 3);
      if (fx.parts.length > 120) return;
      for (let i = 0; i < n; i++) {
        fx.parts.push({ x, y, ox: (rng.next() - 0.5) * 10, oy: (rng.next() - 0.5) * 6, vx: (rng.next() - 0.5) * 150, vz: 70 + rng.next() * 100, z: 20 + rng.next() * 12, rot: rng.next() * 6.28, spin: (rng.next() - 0.5) * 14, born: now, life: 480 + rng.next() * 320 });
      }
    },
    shake(now, z) {
      if (now >= fx.shakeUntil) { shk.x = 0; shk.y = 0; return shk; }
      const k = (fx.shakeUntil - now) / 140;
      shk.x = Math.sin(now * 0.09) * 3 * k * z; shk.y = Math.cos(now * 0.11) * 2 * k * z;
      return shk;
    },
    /** Draw floaters, slashes and particles (screen space, above the lit world). */
    draw(g, cam, atlas, now, playerDir) {
      const z = cam.z;
      // expire in place (no per-frame arrays)
      for (let i = fx.parts.length - 1; i >= 0; i--) if (now - fx.parts[i].born >= fx.parts[i].life) { fx.parts[i] = fx.parts[fx.parts.length - 1]; fx.parts.pop(); }
      for (let i = fx.floaters.length - 1; i >= 0; i--) if (now - fx.floaters[i].born >= FLOATER_MS) fx.floaters.splice(i, 1);
      for (let i = fx.slashes.length - 1; i >= 0; i--) if (now - fx.slashes[i].born >= 170) fx.slashes.splice(i, 1);
      if (fx.flash.size > 32) for (const [id, until] of fx.flash) if (until <= now) fx.flash.delete(id);

      const paper = atlas.get(keys.fx("paper"));
      for (let i = 0; i < fx.parts.length; i++) {
        const p = fx.parts[i], t = (now - p.born) / 1000;
        project(cam, p.x, p.y, pos);
        const zz = p.z + p.vz * t - 240 * t * t;
        g.globalAlpha = Math.min(1, (p.life - (now - p.born)) / 200);
        g.save();
        g.translate(pos.x + (p.ox + p.vx * t) * z, pos.y - Math.max(0, zz) * z + p.oy * z);
        g.rotate(p.rot + p.spin * t);
        g.drawImage(paper.img, -paper.ox * z * 0.85, -paper.oy * z * 0.6, paper.w * z * 0.85, paper.h * z * 0.6);
        g.restore();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < fx.slashes.length; i++) {
        const sl = fx.slashes[i], e = atlas.get(keys.slash(playerDir)), k = (now - sl.born) / 170;
        project(cam, sl.x, sl.y, pos);
        g.globalAlpha = 1 - k;
        g.drawImage(e.img, pos.x - e.ox * z, pos.y - (sl.head * 0.55) * z - e.oy * z, e.w * z, e.h * z);
        if (k < 0.6) { // impact star on the first frames of the hit
          const cx = pos.x, cy = pos.y - sl.head * 0.55 * z, R = (7 + 11 * (1 - k / 0.6)) * z;
          g.beginPath();
          for (let a = 0; a < 16; a++) { const r = a & 1 ? R * 0.45 : R, an = a * Math.PI / 8; g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.9); }
          g.closePath(); g.fillStyle = "#fff6c8"; g.fill(); g.strokeStyle = "#ff9a2e"; g.lineWidth = Math.max(1.5, z * 1.2); g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      for (let i = 0; i < fx.floaters.length; i++) {
        const f = fx.floaters[i], t = (now - f.born) / FLOATER_MS, e = ease(t);
        project(cam, f.x, f.y, pos);
        const pop = 1 + 0.9 * Math.max(0, 1 - t / 0.14), miss = f.kind === 1;
                const fs = Math.max(miss ? 15 : 30, Math.round((miss ? 10 : 21) * z * pop));
        // spawns above the head and clear of the nameplate, then drifts up (right for monsters, left for the hero); stacked rows sit higher
        const side = f.kind === 2 ? -1 : 1, x = pos.x + side * Math.max((f.kind === 2 ? 62 : 40) * z, 72) + side * 16 * e * z, y = pos.y - (f.head + 10 + 32 * e + f.row * 24) * z;
        g.globalAlpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
        g.font = fontFor(fs);
        g.lineWidth = Math.max(4, fs * 0.32); g.strokeStyle = P.ink; g.strokeText(f.text, x, y);
        if (!miss) { g.lineWidth = Math.max(2, fs * 0.12); g.strokeStyle = f.kind === 2 ? "#e0363f" : "#ff6a2a"; g.strokeText(f.text, x, y); }
        g.fillStyle = miss ? "#c9c3ec" : f.kind === 2 ? "#ffd0d4" : "#fff3a0"; g.fillText(f.text, x, y);
      }
      g.globalAlpha = 1;
    },
    /**
     * Low-HP warning (below 30%): a pulsing red edge vignette. Returns the pulse 0..1 (0 when healthy); `fx.lowHp` is the state the
     * shell reads to emit the bus hooks "ui:lowhp" (state change) and "ui:heartbeat" (one per pulse peak; audio subscribes in S3).
     */
    drawLowHp(g, w, h, now, ratio, bus) {
      const low = ratio > 0 && ratio < 0.3;
      if (low !== fx.lowHp) { fx.lowHp = low; bus?.emit({ type: "ui:lowhp", low, ratio }); }
      if (!low) { fx.beat = -1; return 0; }
      const period = 700 + 900 * ratio / 0.3 * 0.5, phase = (now % period) / period, beat = Math.floor(now / period);
      if (beat !== fx.beat) { fx.beat = beat; bus?.emit({ type: "ui:heartbeat", ratio, period }); }
      const pulse = Math.max(0, 1 - phase * 2.2) ** 2; // sharp thump then fade
      fx.ensureVignette(w, h);
      g.globalAlpha = Math.min(1, 0.35 + 0.65 * pulse) * (fx.lowFx ? 0.8 : 1);
      g.drawImage(hurtCanvas, 0, 0, w, h);
      g.globalAlpha = 1;
      return pulse;
    },
    ensureVignette(w, h) {
      if (hurtCanvas && hurtW === w && hurtH === h) return;
      hurtCanvas = hurtCanvas ?? document.createElement("canvas");
      hurtW = hurtCanvas.width = Math.ceil(w / 2); hurtH = hurtCanvas.height = Math.ceil(h / 2);
      const v = hurtCanvas.getContext("2d"), grad = v.createRadialGradient(hurtW / 2, hurtH / 2, hurtH * 0.35, hurtW / 2, hurtH / 2, hurtH * 0.85);
      grad.addColorStop(0, "rgba(160,0,10,0)"); grad.addColorStop(1, "rgba(160,0,10,0.5)");
      v.fillStyle = grad; v.fillRect(0, 0, hurtW, hurtH);
      hurtW = w; hurtH = h;
    },
    /** Red edge flash when the hero is hurt: one baked vignette per size, drawn at an alpha. */
    drawHurt(g, w, h, now) {
      if (fx.hurtUntil <= now) return;
      fx.ensureVignette(w, h);
      g.globalAlpha = Math.min(1, (fx.hurtUntil - now) / 260);
      g.drawImage(hurtCanvas, 0, 0, w, h);
      g.globalAlpha = 1;
    },
  };
  return fx;
}
