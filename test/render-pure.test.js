// Pure parts of the render layer (no DOM): camera and easing, light model helpers, palette contrast, style contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { easeFollow, makeCamera, worldToScreen, project, screenToWorld, worldScale } from "../src/ui/camera.js";
import { viewConfig } from "../src/ui/layout.js";
import { flicker, MAX_LIGHTS } from "../src/render/light.js";
import { palette, contrast } from "../src/render/styles/vector/palette.js";
import { FIG_DIM } from "../src/render/styles/vector/characters.js";
import { content } from "../src/core/index.js";
import { PLAYER_CLASS } from "../src/render/keys.js";

test("zoom is a config value: the hero is about 130 px tall at 1080p and the camera scale follows viewConfig.zoom", () => {
  const z = worldScale(1920, 1080);
  assert.equal(z, 1.5 * viewConfig.zoom);
  assert.ok(FIG_DIM[PLAYER_CLASS].head * z >= 120 && FIG_DIM[PLAYER_CLASS].head * z <= 220, `hero head at ${FIG_DIM[PLAYER_CLASS].head * z} px`);
  assert.equal(makeCamera(1920, 1080, 10, 10, 2).z, 3);
});

test("camera easing keeps the click mapping exact: world -> screen -> world round trip holds for any follow position", () => {
  const focus = { x: 20.5, y: 20.5 };
  for (const [fx, fy] of [[20.5, 20.5], [21.3, 19.1], [18.25, 22.75]]) {
    focus.x = fx; focus.y = fy;
    const c = makeCamera(1920, 1080, focus.x, focus.y);
    for (const [x, y] of [[20.5, 20.5], [23.5, 18.5], [15.5, 22.5]]) {
      const s = worldToScreen(c, x, y), t = screenToWorld(c, s.x, s.y), o = project(c, x, y, { x: 0, y: 0 });
      assert.ok(Math.abs(t.x - x) < 1e-9 && Math.abs(t.y - y) < 1e-9);
      assert.ok(Math.abs(o.x - s.x) < 1e-9 && Math.abs(o.y - s.y) < 1e-9);
    }
  }
});

test("easeFollow converges, is frame-rate independent and never lags more than maxLag", () => {
  const target = { x: 10, y: 4 };
  let a = { x: 0, y: 0 };
  for (let i = 0; i < 400; i++) a = easeFollow(a, target, 16, 140, 100);
  assert.ok(Math.hypot(a.x - 10, a.y - 4) < 0.01);
  const one = easeFollow({ x: 0, y: 0 }, target, 100, 140, 100);
  let two = easeFollow({ x: 0, y: 0 }, target, 50, 140, 100); two = easeFollow(two, target, 50, 140, 100);
  assert.ok(Math.abs(one.x - two.x) < 1e-9 && Math.abs(one.y - two.y) < 1e-9);
  const far = easeFollow({ x: 0, y: 0 }, { x: 50, y: 0 }, 1, 140, 2.5);
  assert.ok(Math.abs(Math.hypot(far.x - 50, far.y)) <= 2.5 + 1e-9);
  assert.deepEqual(easeFollow({ x: 1, y: 1 }, { x: 5, y: 5 }, 0, 140, 100), { x: 1, y: 1 });
  assert.deepEqual(easeFollow({ x: 1, y: 1 }, { x: 5, y: 5 }, 16, 0, 100), { x: 5, y: 5 }); // tau 0 = snap
});

test("fluorescent flicker is a pure function of time within [0, 1] and actually dips", () => {
  let dips = 0;
  for (let t = 0; t < 60000; t += 37) {
    const v = flicker(t, 2);
    assert.ok(v >= 0 && v <= 1);
    assert.equal(v, flicker(t, 2));
    if (v < 0.6) dips++;
  }
  assert.ok(dips > 5);
  assert.equal(MAX_LIGHTS, 4);
});

test("NFR-A04: nameplate text meets 4.5:1 on its plate in normal and high-contrast mode; the empty-slot label too", () => {
  assert.ok(contrast(palette.plate.text, palette.plate.bg) >= 4.5);
  assert.ok(contrast(palette.plateHc.text, palette.plateHc.bg) >= 4.5);
  assert.ok(contrast(palette.ui.empty, palette.ui.panel) >= 4.5);
  assert.ok(contrast(palette.ui.text, palette.ui.panel) >= 4.5);
  assert.ok(contrast(palette.ui.xp, palette.ui.panel) >= 4.5);
  assert.ok(contrast("#ffffff", "#000000") > 20);
});

test("every actor type has rim colour, head height and shadow size in the style", () => {
  for (const type of [PLAYER_CLASS, ...Object.keys(content.monsters)]) {
    assert.match(palette.rims[type], /^#[0-9a-f]{6}$/i, type);
    assert.ok(FIG_DIM[type].head > 30 && FIG_DIM[type].shadowR > 5, type);
  }
  for (const k of Object.values(palette.rarity)) assert.match(k, /^#[0-9a-f]{6}$/i);
  assert.equal(new Set(Object.values(palette.rarity)).size, 3);
});

import { attackFrame, pruneFacing } from "../src/render/world.js";
import { config } from "../src/core/index.js";

test("feel pass: the strike frame (2) is showing on the tick the damage lands, for the hero and for monsters", () => {
  for (const [total, hit] of [[config.attackTicks, config.attackHitTick], [config.monsterAttackTicks, config.monsterAttackHitTick]]) {
    assert.equal(attackFrame(hit, total, hit), 2);
    assert.equal(attackFrame(0, total, hit), 0);
    assert.ok(attackFrame(hit - 1, total, hit) <= 2);
    assert.equal(attackFrame(total - 1, total, hit), 3);
    let last = 0;
    for (let t = 0; t < total; t++) { const f = attackFrame(t, total, hit); assert.ok(f >= last && f <= 3); last = f; } // monotone
  }
});

test("N3: facing memory is pruned for monsters that no longer exist (and never for the hero)", () => {
  const rs = { facing: new Map([["player", 3]]) };
  const core = { monsters: [{ id: "m1" }, { id: "m2" }] };
  for (let i = 0; i < 100; i++) rs.facing.set(`gone${i}`, i % 8);
  rs.facing.set("m1", 5);
  pruneFacing(core, rs);
  assert.deepEqual([...rs.facing.keys()].sort(), ["m1", "player"]);
  pruneFacing(core, rs); // nothing to prune: untouched
  assert.equal(rs.facing.get("m1"), 5);
});
