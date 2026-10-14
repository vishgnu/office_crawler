// WORLD-G (graphics detail round): pure checks of the constants and tables the round added. No pixels, no timing.
import test from "node:test";
import assert from "node:assert/strict";
import { AMBIENT_LIFT, MAX_LIGHTS, MAX_STATIC } from "../src/render/light.js";
import { FLOOR_VARIANTS, FLOOR_WEIGHTS, FX_IDS, requiredKeys } from "../src/render/keys.js";
import { TEXTURES, TEX_GAIN } from "../src/render/draw/textures.js";
import { inkWidth } from "../src/render/draw/shapes.js";
import { palette } from "../src/render/styles/vector/palette.js";
import { FLOOR_VARIANT_DEF } from "../src/render/styles/vector/tiles.js";
import { content } from "../src/core/index.js";

test("AMBIENT_LIFT is one named constant in the 10-15 % band; the dynamic light cap is unchanged", () => {
  assert.equal(AMBIENT_LIFT, 0.12);
  assert.equal(MAX_LIGHTS, 4);
  assert.ok(MAX_STATIC >= 1 && MAX_STATIC <= 4);
});
test("floor variants: weights sum to 100 and every variant has a definition", () => {
  assert.equal(FLOOR_WEIGHTS.length, FLOOR_VARIANTS);
  assert.equal(FLOOR_WEIGHTS.reduce((a, b) => a + b, 0), 100);
  assert.equal(FLOOR_VARIANT_DEF.length, FLOOR_VARIANTS);
});
test("11 baked material textures, gain 1.5", () => { assert.equal(TEXTURES.length, 11); assert.equal(TEX_GAIN, 1.5); });
test("outline width is clamp(2.0 * zoom, 1.6, 4.2)", () => {
  assert.equal(inkWidth(0.5), 1.6); assert.equal(inkWidth(1.8), 3.6); assert.equal(inkWidth(2.7), 4.2);
});
test("every theme has a scene table with textures for its floor and walls", () => {
  for (const t of Object.keys(content.themes)) { const s = palette.scenes[t]; assert.ok(s, t); assert.ok(s.floorTex.default && s.wallTex && s.panelTex && s.glow, t); for (const [n] of [...Object.values(s.floorTex), s.wallTex, s.panelTex]) assert.ok(TEXTURES.includes(n), n); }
});
test("decor sprites are required keys", () => {
  const keys = requiredKeys(content);
  for (const id of FX_IDS.filter((i) => i.startsWith("decor-"))) assert.ok(keys.includes("fx:" + id));
  assert.equal(FX_IDS.filter((i) => i.startsWith("decor-")).length, 7);
});
