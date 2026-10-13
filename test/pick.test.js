import { test } from "node:test";
import assert from "node:assert/strict";
import { pick } from "../src/input/pick.js";
import { makeCamera, worldToScreen, screenToWorld } from "../src/ui/camera.js";

const cam = makeCamera(1280, 720, 10.5, 10.5);

test("AC-R-112-3 world -> screen -> tile round trip for tile centres at several scales", () => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
    const c = makeCamera(w, h, 20.5, 20.5);
    for (const [x, y] of [[20, 20], [23, 18], [17, 22], [25, 25], [15, 12]]) {
      const s = worldToScreen(c, x + 0.5, y + 0.5), t = screenToWorld(c, s.x, s.y);
      assert.equal(Math.floor(t.x + 1e-9), x); assert.equal(Math.floor(t.y + 1e-9), y);
    }
  }
});

test("clicking the body of a monster picks it; the floor tile otherwise", () => {
  const m = { id: "m1", tile: { x: 12, y: 10 }, pos: { x: 12, y: 10 }, dead: false };
  const f = worldToScreen(cam, 12.5, 10.5);
  assert.equal(pick(cam, [m], f.x, f.y - 24).monsterId, "m1");
  assert.deepEqual(pick(cam, [m], f.x, f.y - 24).tile, { x: 12, y: 10 });
  assert.equal(pick(cam, [m], f.x + 60, f.y).monsterId, null);
  assert.equal(pick(cam, [m], f.x, f.y - 90).monsterId, null);
  const s = worldToScreen(cam, 8.5, 9.5);
  assert.deepEqual(pick(cam, [m], s.x, s.y).tile, { x: 8, y: 9 });
});

test("dead monsters are not pickable; the lower one on screen wins when two overlap", () => {
  const a = { id: "a", tile: { x: 12, y: 10 }, pos: { x: 12, y: 10 }, dead: false };
  const b = { id: "b", tile: { x: 12, y: 11 }, pos: { x: 12, y: 11 }, dead: false };
  const fb = worldToScreen(cam, 12.5, 11.5);
  assert.equal(pick(cam, [a, b], fb.x, fb.y - 20).monsterId, "b");
  assert.equal(pick(cam, [a, { ...b, dead: true }], fb.x, fb.y - 20).monsterId === "b", false);
});
