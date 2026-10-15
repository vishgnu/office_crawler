// A naive eager player for the first-minutes checks (R8-B1/B2): every 30 ticks it drinks a health potion below 40 % health, attacks the nearest monster
// (awake within 12 tiles or any within 7), and otherwise walks to the nearest living monster. It never retreats, never kites and uses no skill but a left click.
// Not a test file (no tests in it).
import { step, applyInput } from "../src/core/index.js";

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** One decision of the clicker. Returns an input or null. */
export function clickerDecide(s) {
  const p = s.player;
  if (p.hp < p.hpMax * 0.4) {
    const i = s.belt.findIndex((b) => b && b.kind === "potion" && b.restores === "hp");
    if (i >= 0) return { t: "useBelt", index: i };
    const inv = s.inventory.items.find((b) => b.kind === "potion" && b.restores === "hp");
    if (inv) return { t: "useItem", id: inv.id };
  }
  const live = s.monsters.filter((m) => m.ai !== "dead" && !m.summoned);
  if (!live.length) return null;
  const by = (m) => dist(m.tile, p.tile);
  const near = live.filter((m) => (m.ai !== "sleep" && by(m) <= 12) || by(m) <= 7).sort((a, b) => by(a) - by(b) || (a.id < b.id ? -1 : 1))[0];
  if (near) return p.target === near.id ? null : { t: "attack", id: near.id };
  if (p.path.length || p.next) return null;
  const far = live.sort((a, b) => by(a) - by(b))[0];
  return { t: "moveTo", tile: { ...far.tile } };
}

/** Play `ticks` ticks from `s` with the clicker. Returns { dead, deathTick, minHp (share), kills, firstDamage }. */
export function playClicker(s, ticks, { every = 30 } = {}) {
  let minHp = 1, deathTick = null, firstDamage = null;
  for (let i = 0; i < ticks; i++) {
    if (s.scene === "dead") { deathTick = i; break; }
    if (i % every === 0) { const cmd = clickerDecide(s); if (cmd) applyInput(s, cmd); }
    step(s);
    const f = s.player.hp / s.player.hpMax;
    if (f < 1 && firstDamage === null) firstDamage = i;
    minHp = Math.min(minHp, f);
  }
  if (s.scene === "dead" && deathTick === null) deathTick = ticks;
  return { dead: deathTick !== null, deathTick, minHp, kills: s.stats.kills, firstDamage };
}
