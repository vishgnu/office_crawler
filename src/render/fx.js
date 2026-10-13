// Render-only effects (floaters, paper bursts, hit flashes, camera shake). Never touches core state
// and never feeds back into the simulation; timing uses the render clock.
import { createRng } from "../rng.js";
import { worldToScreen } from "./view.js";
import { keys } from "./keys.js";
import { content } from "../core/index.js";

const S = content.strings;

export function createFx() {
  const rng = createRng(7);
  const fx = {
    floaters: [], parts: [], flash: new Map(), slashes: [],
    hurtUntil: 0, shakeUntil: 0, deathAt: null,
    reset() { fx.floaters.length = 0; fx.parts.length = 0; fx.flash.clear(); fx.slashes.length = 0; fx.hurtUntil = fx.shakeUntil = 0; fx.deathAt = null; },
    handle(ev, core, now) {
      const find = (id) => (id === "player" ? core.player : core.monsters.find((m) => m.id === id));
      const centre = (a) => ({ x: a.tile.x + 0.5 + ((a.next?.x ?? a.tile.x) - a.tile.x) * (a.next ? a.moveT / a.moveTotal : 0), y: a.tile.y + 0.5 + ((a.next?.y ?? a.tile.y) - a.tile.y) * (a.next ? a.moveT / a.moveTotal : 0) });
      if (ev.type === "hit" || ev.type === "miss") {
        const t = find(ev.target);
        if (!t) return;
        const c = centre(t), toPlayer = ev.target === "player";
        if (fx.floaters.length > 24) fx.floaters.shift();
        fx.floaters.push({ x: c.x, y: c.y, text: ev.type === "hit" ? String(ev.value) : S.miss, born: now, color: ev.type === "miss" ? "#aab2c2" : toPlayer ? "#ff6b6b" : "#ffe27a" });
        if (ev.type === "hit") {
          fx.flash.set(ev.target, now + 110);
          if (toPlayer) { fx.hurtUntil = now + 260; fx.shakeUntil = now + 140; }
          else fx.slashes.push({ x: c.x, y: c.y, born: now });
          fx.burst(c.x, c.y, toPlayer ? 4 : 6, now);
        }
      } else if (ev.type === "kill") {
        const t = find(ev.target);
        if (t) { const c = centre(t); fx.burst(c.x, c.y, 14, now); }
      } else if (ev.type === "death") {
        fx.deathAt = now; fx.hurtUntil = now + 900;
      }
    },
    burst(x, y, n, now) {
      if (fx.parts.length > 160) return;
      for (let i = 0; i < n; i++) {
        fx.parts.push({ x, y, ox: (rng.next() - 0.5) * 10, oy: (rng.next() - 0.5) * 6, vx: (rng.next() - 0.5) * 120, vz: 60 + rng.next() * 90, z: 18 + rng.next() * 10, born: now, life: 500 + rng.next() * 300 });
      }
    },
    shake(now, z) {
      if (now >= fx.shakeUntil) return { x: 0, y: 0 };
      const k = (fx.shakeUntil - now) / 140;
      return { x: Math.sin(now * 0.09) * 3 * k * z, y: Math.cos(now * 0.11) * 2 * k * z };
    },
    /** Draw floaters, slashes and particles (screen space, above the world). */
    draw(g, cam, atlas, now, playerDir) {
      fx.parts = fx.parts.filter((p) => now - p.born < p.life);
      fx.floaters = fx.floaters.filter((f) => now - f.born < 950);
      fx.slashes = fx.slashes.filter((s) => now - s.born < 160);
      const paper = atlas.get(keys.fx("paper"));
      for (const p of fx.parts) {
        const t = (now - p.born) / 1000, s = worldToScreen(cam, p.x, p.y);
        const z = p.z + p.vz * t - 220 * t * t;
        g.globalAlpha = Math.min(1, (p.life - (now - p.born)) / 200);
        g.drawImage(paper.img, s.x + (p.ox + p.vx * t) * cam.z - 4 * cam.z, s.y - Math.max(0, z) * cam.z + p.oy * cam.z, paper.w * cam.z, paper.h * cam.z);
      }
      g.globalAlpha = 1;
      for (const sl of fx.slashes) {
        const e = atlas.get(keys.slash(playerDir)), s = worldToScreen(cam, sl.x, sl.y);
        g.globalAlpha = 1 - (now - sl.born) / 160;
        g.drawImage(e.img, s.x - e.ox * cam.z, s.y - 28 * cam.z - e.oy * cam.z, e.w * cam.z, e.h * cam.z);
      }
      g.globalAlpha = 1;
      g.textAlign = "center"; g.lineJoin = "round";
      for (const f of fx.floaters) {
        const t = (now - f.born) / 950, s = worldToScreen(cam, f.x, f.y);
        g.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        g.font = `bold ${Math.round(17 * cam.z)}px system-ui, sans-serif`;
        const y = s.y - (50 + 34 * t) * cam.z;
        g.lineWidth = 4 * cam.z; g.strokeStyle = "#0a0c12"; g.strokeText(f.text, s.x, y);
        g.fillStyle = f.color; g.fillText(f.text, s.x, y);
      }
      g.globalAlpha = 1;
    },
  };
  return fx;
}
