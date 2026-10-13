import { test } from "node:test";
import assert from "node:assert/strict";
import { drawerLayout, cameraInset, placeTip, isPhone, hudLayout } from "../src/ui/layout.js";
import { makeCamera } from "../src/ui/camera.js";

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("drawers: desktop from 1024 px up has 44 px cells; both drawers leave a centre gap; they stop above the vessels", () => {
  for (const [w, h] of [[1024, 768], [1280, 720], [1280, 800], [1366, 768], [1920, 1080]]) {
    const D = drawerLayout(w, h), L = hudLayout(w, h);
    assert.equal(D.phone, false, `${w}x${h}`);
    assert.equal(D.cell, 44, `${w}x${h} cell size`);
    assert.ok(D.leftW + D.rightW < w - 180, `${w}x${h}: both drawers open must leave a gap for the hero (${D.leftW + D.rightW} of ${w})`);
    assert.ok(D.bottom <= Math.min(L.health.rect.y, L.mana.rect.y) - 8 + 1, `${w}x${h} drawers stay above the mug and jug`);
    assert.ok(D.bottom - D.top >= 560 || h < 760, `${w}x${h} drawer height ${D.bottom - D.top}`);
    assert.equal(D.rightW, 44 * 10 + 44, "the drawer is as wide as the 10-cell grid plus its chrome");
  }
});

test("phone layout (<= 899 px wide or <= 519 px tall): one full-width panel, grid fits the width", () => {
  for (const [w, h] of [[390, 844], [844, 390], [800, 600]]) {
    assert.equal(isPhone(w, h), true, `${w}x${h}`);
    const D = drawerLayout(w, h);
    assert.equal(D.leftW, w - 12);
    assert.ok(D.cell * 10 + 36 <= w, `${w}x${h}: 10 columns of ${D.cell} px fit`);
  }
  assert.equal(isPhone(900, 700), false);
});

test("camera inset re-centres the hero in the gap the open drawers leave", () => {
  const D = drawerLayout(1280, 800);
  assert.equal(cameraInset(1280, 800, {}), 0);
  assert.equal(cameraInset(1280, 800, { left: true, right: true }), (D.leftW - D.rightW) / 2);
  assert.equal(cameraInset(1280, 800, { right: true }), -D.rightW / 2);
  assert.equal(cameraInset(390, 844, { left: true, right: true }), 0, "no shift on a phone");
  const free = (w, inset, left, right) => w / 2 + inset;
  const c = free(1280, cameraInset(1280, 800, { left: true, right: true }));
  assert.ok(c > D.leftW && c < 1280 - D.rightW, "the hero stays inside the free gap");
  assert.equal(makeCamera(1280, 800, 5, 5, undefined, -100).ox, makeCamera(1280, 800, 5, 5).ox - 100);
});

const bounds = { left: 8, top: 8, right: 1272, bottom: 680 };
const hero = { x: 520, y: 300, w: 96, h: 130 };
const left = { x: 0, y: 8, w: 340, h: 600 }, right = { x: 796, y: 8, w: 484, h: 600 };

test("placeTip: beside the item toward the inner edge, above the bottom bar, never over the hero or its own drawer", () => {
  for (const h of [180, 300, 420]) for (const ay of [60, 250, 420]) {
    const anchor = { x: 900, y: ay, w: 44, h: 66 };
    const t = placeTip({ w: 292, h, anchor, panel: right, side: "right", drawers: [left, right], hero, bounds });
    const r = { x: t.x, y: t.y, w: 292, h: t.h };
    assert.ok(!hit(r, hero), `tip h${h} anchor@${ay} covers the hero: ${JSON.stringify(t)}`);
    assert.ok(!hit(r, right), `tip h${h} anchor@${ay} covers its own drawer`);
    assert.ok(r.y >= bounds.top && r.y + r.h <= bounds.bottom, `tip h${h} anchor@${ay} leaves the screen area or covers the bottom bar`);
    assert.ok(r.x >= bounds.left && r.x + r.w <= bounds.right);
  }
});

test("placeTip: a short tip sits in the gap beside the drawer; a tall one moves above the hero or over the other drawer, never over the hero", () => {
  const anchor = { x: 900, y: 120, w: 44, h: 44 };
  const short = placeTip({ w: 292, h: 240, anchor, panel: right, side: "right", drawers: [left, right], hero, bounds });
  assert.ok(short.x + 292 <= right.x - 8 + 1 && short.x >= left.x + left.w, `fits between the drawers: ${JSON.stringify(short)}`);
  const tall = placeTip({ w: 292, h: 420, anchor, panel: right, side: "right", drawers: [left, right], hero, bounds });
  assert.ok(!hit({ x: tall.x, y: tall.y, w: 292, h: tall.h }, hero));
});

test("placeTip without a drawer (HUD slot) goes above the anchor and stays on screen", () => {
  const anchor = { x: 700, y: 650, w: 40, h: 40 };
  const t = placeTip({ w: 260, h: 150, anchor, panel: null, drawers: [], hero: { x: 0, y: 0, w: 0, h: 0 }, bounds: { left: 8, top: 8, right: 1272, bottom: 680 } });
  assert.ok(t.y + 150 <= anchor.y, "above the slot");
  assert.ok(t.x >= 8 && t.x + 260 <= 1272);
});
