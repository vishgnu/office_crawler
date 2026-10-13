import { test } from "node:test";
import assert from "node:assert/strict";
import { hudLayout, viewScale, fontPx } from "../src/ui/layout.js";

const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("AC-R-070-5 HUD regions fit every supported viewport and never overlap", () => {
  for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3840, 2160], [800, 600], [390, 844], [844, 390]]) {
    const L = hudLayout(w, h), rects = [L.health.rect, L.mana.rect, L.panel, L.beltPanel, L.target];
    for (const r of [...rects, ...L.skills, ...L.belt, L.xp]) assert.ok(inside(r, w, h), `${w}x${h} rect outside: ${JSON.stringify(r)}`);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), `${w}x${h} overlap ${i}/${j}`);
    // slots live inside their panel; skill slots and belt slots never overlap each other
    for (const r of L.skills) assert.ok(r.x >= L.panel.x && r.x + r.w <= L.panel.x + L.panel.w && r.y >= L.panel.y && r.y + r.h <= L.panel.y + L.panel.h, `${w}x${h} skill slot outside its panel`);
    for (const r of L.belt) assert.ok(r.x >= L.beltPanel.x && r.x + r.w <= L.beltPanel.x + L.beltPanel.w && r.y >= L.beltPanel.y && r.y + r.h <= L.beltPanel.y + L.beltPanel.h, `${w}x${h} belt slot outside its panel`);
    for (let i = 0; i < L.skills.length; i++) for (const b of L.belt) assert.ok(!overlap(L.skills[i], b), `${w}x${h} skill/belt overlap`);
    // screen safe area: vessels keep at least 8 px from every edge (checklist: mug and jug inset 8 px)
    for (const r of [L.health.rect, L.mana.rect]) assert.ok(r.x >= 8 && r.y >= 8 && w - (r.x + r.w) >= 8 && h - (r.y + r.h) >= 8, `${w}x${h} vessel closer than 8 px to the edge`);
  }
});

test("slot names appear only when the slots are wide enough to hold them; text sizes have a floor", () => {
  assert.equal(hudLayout(1920, 1080).showNames, true);
  assert.equal(hudLayout(390, 844).showNames, false);
  assert.equal(fontPx(1.5, 10), 15);
  assert.equal(fontPx(0.6, 10), 12);
  assert.equal(fontPx(0.6, 10, 9), 9);
});

test("view scale is 1 at 1280x720, grows with the viewport and is clamped", () => {
  assert.equal(viewScale(1280, 720), 1);
  assert.equal(viewScale(1920, 1080), 1.5);
  assert.equal(viewScale(3840, 2160), 3);
  assert.equal(viewScale(100, 100), 0.6);
  assert.equal(viewScale(10000, 10000), 3);
});
