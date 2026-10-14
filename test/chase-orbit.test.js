// Core chase fix (R7-3 not_done): two actors of equal speed that each take the shorter way round a block used to orbit it for ever
// (found by the bot parity run, facilities-manager seed 6, ~85 000 ticks). The hero now waits for a chaser that comes round a block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { step, applyInput, config, createRng } from "../src/core/index.js";
import { gameOn, bfsSteps } from "./helpers.js";

const RING = [
  "####################",
  "#....@.............#",
  "#.......######.....#",
  "#.......######.....#",
  "#.......########...#",
  "#.......########...#",
  "#.......######.....#",
  "#.......######.....#",
  "#..................#",
  "####################",
];

/** Ticks until the pair is in contact (the monster attacks or the hero swings), or -1 within `max`. Damage is off: only the geometry is tested. */
function contact(rows, type, mon, cls, max = 3000) {
  const s = gameOn(rows, [[type, mon.x, mon.y]], 1, { class: cls });
  const m = s.monsters[0];
  m.damage = 0; s.player.hp = s.player.hpMax = 1e6; m.ai = "chase";
  applyInput(s, { t: "attack", id: m.id });
  for (let t = 0; t < max; t++) { step(s); if (m.ai === "attack" || s.player.action === "attack") return t; }
  return -1;
}

test("[chase-orbit] staged ring: a hero and an equal-speed auditor half a ring apart meet (every class), within 400 ticks", () => {
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) {
    const t = contact(RING, "auditor", { x: 15, y: 7 }, cls);
    assert.ok(t >= 0 && t < 400, `${cls}: ${t}`);
  }
});

test("[chase-orbit] the staged ring really orbited without the rule (holdFarTicks off)", () => {
  const keep = config.holdFarTicks;
  try {
    config.holdFarTicks = 0;
    assert.equal(contact(RING, "auditor", { x: 15, y: 7 }, "it-wizard", 1500), -1, "the pattern is reproduced when the rule is switched off");
  } finally { config.holdFarTicks = keep; }
});

test("[chase-orbit] 600 random block maps, hero and chaser of five kinds at random reachable tiles: contact in every one (bounded at 3000 ticks)", () => {
  const rng = createRng(4242), kinds = ["auditor", "consultant", "middle-manager", "printer-imp", "zombie-intern"], classes = ["facilities-manager", "sales-rep", "it-wizard"];
  let tested = 0;
  for (let n = 0; tested < 600 && n < 3000; n++) {
    const W = rng.int(9, 20), H = rng.int(9, 16);
    const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? "#" : ".")));
    for (let b = rng.int(1, 4); b > 0; b--) {
      const bw = rng.int(2, 7), bh = rng.int(2, 6), bx = rng.int(2, W - bw - 2), by = rng.int(2, H - bh - 2);
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) g[y][x] = "#";
    }
    const free = []; g.forEach((r, y) => r.forEach((c, x) => { if (c === ".") free.push({ x, y }); }));
    if (free.length < 2) continue;
    const a = free[rng.int(0, free.length - 1)], b = free[rng.int(0, free.length - 1)];
    if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) < 4 || bfsSteps(g.map((r) => r.join("")), a, b) < 0) continue;
    g[a.y][a.x] = "@";
    tested++;
    const t = contact(g.map((r) => r.join("")), kinds[n % 5], b, classes[(n >> 1) % 3]);
    assert.ok(t >= 0, `map ${n} (${W}x${H}) ${kinds[n % 5]} vs ${classes[(n >> 1) % 3]}: no contact in 3000 ticks\n${g.map((r) => r.join("")).join("\n")}\nhero ${a.x},${a.y} monster ${b.x},${b.y}`);
  }
  assert.equal(tested, 600);
});
