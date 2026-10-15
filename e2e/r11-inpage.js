// R11-3: in-page planner for the real-mouse player. It reuses the bot policy for WHAT to do and translates each command into what a human does:
// a real mouse click on a tile, a right-click for a skill, a key for the belt / skill slot. Commands with no mouse path (equip, sell, buy ...) stay on the public input.
import { createBotMemory, decide, noteResult } from "../bot/policy.js";

let coveredHits = 0, dlgSteps = 0, mem = null, pickMiss = 0, fallbacks = {};
const A = () => window.__app;
const scr = (cam, x, y) => ({ x: cam.ox + (x - y) * 32 * cam.z, y: cam.oy + (x + y + 1) * 16 * cam.z });
const safe = (p, W, H) => p.x > 40 && p.x < W - 40 && p.y > 70 && p.y < H - 150;
const walk = (v, x, y) => { const f = v.floor; if (x < 0 || y < 0 || x >= f.w || y >= f.h) return false; const c = f.tiles[y * f.w + x]; return (c === 1 || c === 3 || c === 4 || c === 5) && !f.props.some((p) => p.blocks && p.x === x && p.y === y); };
const fb = (k) => { fallbacks[k] = (fallbacks[k] ?? 0) + 1; };

/** A point on screen that selects tile (x, y); for monsters it verifies with pick() and tries a few offsets. */
function aim(v, tile, monsterId) {
  const mo = monsterId ? v.monsters.find((m) => m.id === monsterId) : null;
  if (mo?.pos) tile = { x: mo.pos.x, y: mo.pos.y }; // aim at the sprite (interpolated position), as a person does
  const cam = v.ui.camera, W = cam.w ?? innerWidth, H = cam.h ?? innerHeight;
  const base = scr(cam, tile.x, tile.y);
  for (const dy of monsterId ? [0, -14, -26, 10] : [0]) {
    const p = { x: Math.round(base.x), y: Math.round(base.y + dy) };
    if (!safe(p, W, H)) continue;
    const el = document.elementFromPoint(p.x, p.y); if (!el || el.tagName !== "CANVAS") { coveredHits++; continue; } // something (dock, tracker, toast) is on top: a person aims elsewhere
    const pk = A().pick(p.x, p.y);
    if (monsterId ? pk.monsterId === monsterId : (pk.tile.x === tile.x && pk.tile.y === tile.y)) return p;
  }
  if (monsterId) pickMiss++;
  return null;
}
/** The real route (BFS over walkable tiles) to (tx, ty), then the farthest tile on it that is on screen and clickable: how a person walks to something off screen. */
function towards(v, tx, ty) {
  const f = v.floor, p = v.player.tile, W = f.w, key = (x, y) => y * W + x;
  const ok = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= f.h) return false; const c = f.tiles[key(x, y)]; return (c === 1 || c === 3 || c === 4 || c === 5) && !f.props.some((q) => q.blocks && q.x === x && q.y === y) && !(f.npcs ?? []).some((n) => n.tile.x === x && n.tile.y === y && !(n.tile.x === tx && n.tile.y === ty)); };
  const prev = new Map([[key(p.x, p.y), -1]]), q = [[p.x, p.y]];
  for (let h = 0; h < q.length && !prev.has(key(tx, ty)); h++) { const [x, y] = q[h]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!prev.has(k) && (ok(nx, ny) || (nx === tx && ny === ty && ok(nx, ny)))) { prev.set(k, key(x, y)); q.push([nx, ny]); } } }
  if (!prev.has(key(tx, ty))) { fb("noRoute"); return null; }
  const path = []; for (let k = key(tx, ty); k !== -1; k = prev.get(k)) path.push({ x: k % W, y: Math.floor(k / W) });
  path.reverse(); // from the hero to the target
  for (let i = path.length - 1; i >= 1; i--) {
    const t = path[i]; if ((v.groundItems ?? []).some((g) => g.tile.x === t.x && g.tile.y === t.y) && !(t.x === tx && t.y === ty)) continue;
    const a = aim(v, t, null); if (a) return { tile: t, pt: a };
  }
  return null;
}
const hotIdx = (v, skill) => v.player.skillBar.hotkeys.indexOf(skill);

window.__r11 = {
  init(profile) { mem = createBotMemory(profile); pickMiss = 0; fallbacks = {}; },
  stats() { return { coveredHits, pickMiss, fallbacks, failedMoves: mem.failedMoves, stuck: mem.stuck, watchdog: mem.watchdogFired }; },
  /** mask: { points: true } hides unspent points from the policy (the player does not spend them). */
  plan(mask) {
    const real = A().getState();
    const v = mask?.points ? { ...real, player: { ...real.player, attrPoints: 0, skillPoints: 0 } } : real;
    if (real.scene === "dead") return { kind: "dead" };
    if (real.scene === "victory") return { kind: "done", why: "victory" };
    if (mem.done) return { kind: "done", why: "policy done" };
    if (real.ui?.dialog) { if (++dlgSteps > 30) { A().input({ t: "closeDialog" }); dlgSteps = 0; } } else dlgSteps = 0; // a person closes a dialog that did what they wanted
    const cmd = decide(v, mem);
    if (!cmd) return { kind: "none" };
    const note = (r) => noteResult(mem, cmd, r);
    const viaInput = (why) => { fb(cmd.t + (why ? ":" + why : "")); const r = A().input(cmd); note(r); return { kind: "input", cmd: cmd.t, ok: r?.ok }; };
    switch (cmd.t) {
      case "attack": {
        const m = real.monsters.find((x) => x.id === cmd.id); if (!m) return viaInput("gone");
        const pt = aim(real, m.tile, m.id);
        if (pt) { note({ ok: true }); return { kind: "click", button: 0, ...pt, cmd: "attack" }; }
        const tw = towards(real, m.tile.x, m.tile.y); if (tw) { note({ ok: true }); return { kind: "click", button: 0, ...tw.pt, cmd: "attack>walk" }; }
        return viaInput("offscreen");
      }
      case "pickup": {
        const g = (real.groundItems ?? []).find((x) => x.id === cmd.id); if (!g) return viaInput("gone");
        const pt = aim(real, g.tile, null);
        if (pt) { note({ ok: true }); return { kind: "click", button: 0, ...pt, cmd: "pickup" }; }
        const tw = towards(real, g.tile.x, g.tile.y); if (tw) { note({ ok: true }); return { kind: "click", button: 0, ...tw.pt, cmd: "pickup>walk" }; }
        return viaInput("offscreen");
      }
      case "moveTo": {
        const pt = aim(real, cmd.tile, null);
        if (pt && walk(real, cmd.tile.x, cmd.tile.y)) { note({ ok: true }); return { kind: "click", button: 0, ...pt, cmd: "moveTo" }; }
        const tw = towards(real, cmd.tile.x, cmd.tile.y); if (tw) { note({ ok: true }); return { kind: "click", button: 0, ...tw.pt, cmd: "moveTo>part" }; }
        return viaInput("offscreen");
      }
      case "useStairs": {
        if (real.scene === "floor" || real.scene === "town") {
          const t = cmd.dir === "up" ? real.floor.entry : real.floor.exit;
          if (t) { const pt = aim(real, t, null); if (pt) { note({ ok: true }); return { kind: "click", button: 0, ...pt, cmd: "stairs" }; } const tw = towards(real, t.x, t.y); if (tw) { note({ ok: true }); return { kind: "click", button: 0, ...tw.pt, cmd: "stairs>walk" }; } }
        }
        return viaInput("offscreen");
      }
      case "interact": {
        const n = (real.floor.npcs ?? []).find((x) => x.id === cmd.id);
        if (n) { const pt = aim(real, n.tile, null); if (pt) { note({ ok: true }); return { kind: "click", button: 0, ...pt, cmd: "interact" }; } }
        return viaInput("npc");
      }
      case "cast": {
        const idx = hotIdx(real, cmd.skill), tile = cmd.tile;
        const pt = aim(real, tile, (real.monsters.find((m) => m.tile.x === tile.x && m.tile.y === tile.y && m.ai !== "dead") ?? {}).id ?? null) ?? aim(real, tile, null);
        if (idx >= 0 && pt) { note({ ok: true }); return { kind: "cast", key: "F" + (idx + 1), selected: real.player.skillBar.selected === idx, ...pt, skill: cmd.skill }; }
        if (real.player.skillBar.secondary === cmd.skill && pt) { note({ ok: true }); return { kind: "cast", key: null, ...pt, skill: cmd.skill }; }
        return viaInput(idx < 0 ? "unbound" : "offscreen");
      }
      case "useBelt": { note({ ok: true }); return { kind: "key", code: "Digit" + (cmd.index + 1), cmd: "belt" }; }
      case "allocate": return { kind: "alloc", attr: cmd.attr, cmd, };
      case "learnSkill": return { kind: "learn", id: cmd.id, cmd };
      case "respawn": return { kind: "dead" };
      default: return viaInput("");
    }
  },
  noteUi(cmd, ok) { if (mem) noteResult(mem, cmd, { ok }); },
  obs() {
    const s = A().getState(), p = s.player, t = document.querySelector('[data-testid="toast"]');
    return { tx: p.tile.x, ty: p.tile.y, tick: s.tick, scene: s.scene, depth: s.depth, hp: p.hp, hpMax: p.hpMax, mp: p.mp, level: p.level, ap: p.attrPoints, sp: p.skillPoints, xp: p.xp, gold: p.gold, belt: (s.belt ?? []).filter(Boolean).length, mons: s.monsters.filter((m) => m.ai !== "dead").length, awake: s.monsters.filter((m) => m.ai !== "dead" && m.ai !== "idle").length, toast: t && !t.hidden && !t.classList.contains("dup") ? t.textContent : null, story: !!document.querySelector('[data-testid="story"], .story'), paused: s.paused };
  },
};
