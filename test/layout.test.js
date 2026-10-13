import { test } from "node:test";
import assert from "node:assert/strict";
import { hudLayout, viewScale } from "../src/ui/layout.js";

const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("AC-R-070-5 HUD regions fit every supported viewport and never overlap", () => {
  for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3840, 2160], [800, 600]]) {
    const L = hudLayout(w, h), rects = [L.health.rect, L.mana.rect, ...L.belt, L.target];
    for (const r of rects) assert.ok(inside(r, w, h), `${w}x${h} rect outside: ${JSON.stringify(r)}`);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), `${w}x${h} overlap ${i}/${j}`);
  }
});

test("view scale is 1 at 1280x720, grows with the viewport and is clamped", () => {
  assert.equal(viewScale(1280, 720), 1);
  assert.equal(viewScale(1920, 1080), 1.5);
  assert.equal(viewScale(3840, 2160), 3);
  assert.equal(viewScale(100, 100), 0.6);
  assert.equal(viewScale(10000, 10000), 3);
});
