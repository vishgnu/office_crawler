// R11 fix round (render): M-2 two-hand pose, M-3 attack poses and hit nudge, M-4 failed-cast feedback, M-5 floater range, M-6 hero depth ties, R11-10.
// Pure: a recording canvas stands in for pixels; no wall-clock thresholds.
import test from "node:test";
import assert from "node:assert/strict";
import { recorder } from "./render-gear-rec.js";
import { drawFigure as paintFigure } from "../src/render/styles/vector/characters.js";
import { makeGear, PART_PAINTERS } from "../src/render/gearparts.js";
import { actorDepth, hitNudge } from "../src/render/world.js";
import { createFx } from "../src/render/fx.js";
import { getStyle } from "../src/render/style.js";
import { project } from "../src/ui/camera.js";
import { config } from "../src/core/index.js";

const stream = (cls, anim, d, f, gear) => { const r = recorder(); r.g.translate(52, 76); paintFigure(r.g, cls, anim, d, f, gear); return r.digest(); };
const SR = "sales-rep", IT = "it-wizard", FM = "facilities-manager";

// ---- M-3: attack and cast poses of an armed card or laptop class change from frame to frame ----
test("R11 M-3: with a weapon worn, the four attack frames and the four cast frames of the sales rep and the IT wizard are all different (wind-up, cocked, strike, recover)", () => {
  for (const cls of [SR, IT]) for (const sig of ["-|-|-|-|b0|-", "-|-|-|-|s0|-"]) for (const dir of [1, 2, 6, 7]) for (const anim of ["attack", "cast"]) { // (facing straight at or away from the camera has no forward axis for the cast thrust)
    const set = new Set([0, 1, 2, 3].map((f) => stream(cls, anim, dir, f, makeGear(sig))));
    assert.equal(set.size, 4, `${cls} ${sig} d${dir} ${anim}`);
  }
});

test("R11 M-3: the wind-up frame pulls the weapon back: its direction points away from the facing, the strike frame points along it", () => {
  const seen = [];
  const orig = PART_PAINTERS.staff;
  try {
    PART_PAINTERS.staff = (g, slot, cat, tier, A) => { seen.push({ anim: A.anim, f: A.f, wx: A.wdir[0], fx: A.fx }); };
    for (const f of [0, 1, 2, 3]) stream(IT, "attack", 2, f, makeGear("-|-|-|-|s0|-"));
  } finally { PART_PAINTERS.staff = orig; }
  const at = (f) => seen.find((s) => s.f === f);
  assert.ok(at(0).wx * at(0).fx <= 0, "wind-up: not forward");
  assert.ok(at(1).wx * at(1).fx < 0, "cocked: back");
  assert.ok(at(2).wx * at(2).fx > 0.5, "strike: forward");
});

// ---- M-2: a two-handed weapon is carried slanted across the body, in both hands ----
test("R11 M-2: a two-handed weapon at rest and walking points forward-up (a diagonal shaft) and the second hand is drawn on it", () => {
  for (const [cat, sig] of [["pole", "-|-|-|-|p22|-"], ["heavy", "-|-|-|-|h22|-"]]) for (const cls of [FM, SR, IT]) for (const anim of ["idle", "walk"]) for (const dir of [1, 2, 6, 7]) {
    const got = [], orig = PART_PAINTERS[cat];
    try { PART_PAINTERS[cat] = (g, slot, c, tier, A) => { got.push({ wdir: A.wdir, fx: A.fx, two: A.two, far: A.far, near: A.near }); }; stream(cls, anim, dir, 1, makeGear(sig)); } finally { PART_PAINTERS[cat] = orig; }
    const a = got.find((x) => x.two);
    assert.ok(a, `${cat} ${cls} ${anim} d${dir} reaches the painter as two-handed`);
    assert.ok(Math.abs(a.wdir[0]) > 0.35 && a.wdir[1] < -0.5, `${cat} ${cls} ${anim} d${dir} slanted: ${a.wdir}`);
    assert.ok(Math.hypot(a.far[0] - a.near[0], a.far[1] - a.near[1]) > 4, "the far hand is on the shaft, away from the near hand");
  }
});

// ---- M-3 / M-6: pure helpers of the world pass ----
test("R11 M-3: the hit nudge pushes a monster away from the hero, decays with the flash, and is off for reduced motion and for no flash", () => {
  const out = { dx: 0, dy: 0 };
  hitNudge(config.flashTicks, 1, 0, 2, false, out);
  assert.ok(out.dx > 6.9 && out.dx <= 7.01, `full strength at the hit (3.5 px x zoom 2): ${out.dx}`);
  assert.ok(Math.abs(out.dy) < 1e-9);
  const half = hitNudge(config.flashTicks / 2, 0, 1, 1, false, { dx: 0, dy: 0 });
  assert.ok(half.dy > 0 && half.dy < 3.5 * 0.6, "half the flash left: half the push, further down the screen for a monster below the hero");
  assert.deepEqual(hitNudge(config.flashTicks, 1, 1, 1, true, { dx: 9, dy: 9 }), { dx: 0, dy: 0 }, "reduced motion: no offset");
  assert.deepEqual(hitNudge(0, 1, 1, 1, false, { dx: 9, dy: 9 }), { dx: 0, dy: 0 }, "no flash, no offset");
  assert.deepEqual(hitNudge(5, 0, 0, 1, false, { dx: 0, dy: 0 }).dx, 0, "same spot: no NaN");
  // the push is bounded: never more than the 3.5 px per zoom unit, so the sprite stays inside its footprint
  for (let t = 0; t <= config.flashTicks + 3; t++) { const o = hitNudge(t, 3, -2, 1.5, false, { dx: 0, dy: 0 }); assert.ok(Math.hypot(o.dx, o.dy) <= 3.5 * 1.5 + 1e-9); }
});

test("R11 M-6: the hero wins depth ties and touching tiles; a monster a whole tile in front still covers him", () => {
  const hero = (x, y) => actorDepth(x, y, true), mon = (x, y) => actorDepth(x, y, false);
  assert.ok(hero(5, 5) > mon(5, 5), "same tile");
  assert.ok(hero(5, 5) > mon(6, 4) && hero(5, 5) > mon(4, 6), "same tile sum (the diagonal neighbours)");
  assert.ok(hero(5.4, 5.4) > mon(5.5, 5.5) || hero(5.4, 5.4) > mon(5.3, 5.5), "inside the footprint, sub-tile steps");
  assert.ok(mon(6, 5) > hero(5, 5), "a monster one tile in front (tile sum + 1) is drawn over him");
  assert.ok(mon(5, 4) < hero(5, 5), "a monster one tile behind stays behind");
});

// ---- M-5: floaters stay near the target ----
test("R11 M-5: damage floaters stay within about 50 px sideways and 45 px (a stack of three: 60 px) above the head of a monster, through the whole life, stacked or not", () => {
  const style = getStyle("vector");
  for (const z of [1, 1.5]) for (const stack of [1, 3]) {
    const fx = createFx(style), cam = { w: 1280, h: 720, z, ox: 640, oy: 100 };
    const head = style.dims["zombie-intern"].head;
    const tile = { x: 6, y: 6 }, pos = { x: 0, y: 0 }; project(cam, tile.x + 0.5, tile.y + 0.5, pos);
    for (const age of [2, 10, 20, 30, 40, 48]) {
      const texts = [];
      const g = new Proxy({}, { get: (t, k) => (k === "measureText" ? (s) => ({ width: String(s).length * 12 }) : k === "fillText" ? (s, x, y) => texts.push({ s, x, y }) : k in t ? t[k] : () => undefined), set: (t, k, v) => { t[k] = v; return true; } });
      const floaters = []; for (let i = 0; i < stack; i++) floaters.push({ target: "m1", tile, value: 10 + i, kind: "hit", life: config.floaterTicks - age - i * 6 });
      fx.alpha = 0;
      fx.drawFloaters(g, cam, { floaters, monsters: [{ id: "m1", type: "zombie-intern" }] }, 0);
      assert.equal(texts.length, floaters.filter((f) => f.life > 0).length);
      for (const t of texts) {
        assert.ok(Math.abs(t.x - pos.x) <= 52 * z, `z${z} stack${stack} age${age}: dx ${t.x - pos.x}`);
        assert.ok(t.y >= pos.y - (head + (stack > 1 ? 60 : 46)) * z, `z${z} stack${stack} age${age}: too high ${pos.y - t.y} > ${(head + 60) * z}`);
        assert.ok(t.y <= pos.y - head * 0.5 * z, "above the middle of the body, not on the feet");
      }
    }
  }
});

// ---- M-4: a cast that does not go off is visible ----
test("R11 M-4: noMana and castRefused add one short dim ring at the hero's feet (at most one per 250 ms); floorEnter clears it", () => {
  const fx = createFx(getStyle("vector"));
  const core = { player: { tile: { x: 5, y: 5 }, next: null }, monsters: [], projectiles: [] };
  const n = () => fx.sk.efx.filter((e) => e.k === "puff" && e.grey).length;
  assert.equal(n(), 0);
  fx.handle({ type: "noMana", skill: "pallet-slam", cost: 8 }, core, 1000);
  assert.equal(n(), 1);
  fx.handle({ type: "castRefused", skill: "pallet-slam", reason: "no-target" }, core, 1100);
  assert.equal(n(), 1, "throttled inside 250 ms");
  fx.handle({ type: "castRefused", skill: "pallet-slam", reason: "no-target" }, core, 1300);
  assert.equal(n(), 2);
  const e = fx.sk.efx.find((x) => x.k === "puff");
  assert.ok(e.fizz === true && e.life <= 400, "mana: blue ring, short");
  assert.equal(fx.sk.efx.at(-1).fizz, false, "refused for another reason: neutral grey ring");
  fx.handle({ type: "floorEnter" }, core, 2000);
  assert.equal(n(), 0);
});
