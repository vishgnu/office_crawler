// FIX-UI-R8T: (behaviour tests on the pure builders where possible; the CSS-only items stay declaration checks, their pixels are checked by screenshot)
//  Desk Drawer fits or scrolls with a visible footer (R8-A1), the XP hover box takes no pointer events (R8-A2), phone Map button and short map title (U-1/U-5),
// tooltip clears the toast (U-2), whole-figure bust crop (U-4), centred single-chain tree (N12/U-3), restock hint after a death (wish). Source/CSS contracts and pure logic; the pixels are checked by screenshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { messageFor } from "../src/ui/messages.js";
import { T } from "../src/ui/text.js";
import { xpFileHtml, xpTipHtml, tipLimit } from "../src/ui/panels.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/style.css"), panels = read("../src/ui/panels.js"), slots = read("../src/ui/slots.js");

test("R8-A1 CSS contract: the Desk Drawer hint spans the drawer; the body scrolls and its footer sticks at the bottom edge, with scroll padding so a focused cell is not hidden under it", () => {
  assert.match(panels, /<\/div><\/div><\/div><\/div><p class="keyhint">\$\{esc\(T\.dragHint\)\}<\/p>/);
  assert.match(css, /#pright \.footrow\{position:sticky;bottom:0;/);
  assert.match(css, /#pright \.pb\{scroll-padding-bottom:\d+px\}/);
});

const textOf = (html) => html.replace(/<[^>]*>/g, "|").split("|").map((x) => x.trim()).filter(Boolean);
test("R8-A2 / F1 the XP total is visible text in the Employee File, and the HUD box is an image with a label, not a pointer or focus target", () => {
  const xpv = { total: 12345, into: 10, span: 136, pct: 7, capped: false };
  const file = xpFileHtml(xpv, 3);
  assert.ok(textOf(file).includes(`${T.xpTotal}: 12,345`), "visible text, not only title/aria-label");
  assert.match(file, /data-stat="xp-total"/);
  assert.ok(textOf(file).some((x) => x.startsWith("10 / 136")), "within-level label unchanged");
  assert.match(xpFileHtml({ ...xpv, capped: true }, 50), new RegExp(T.xpMax));
  const tip = xpTipHtml({ total: 12345, pct: 7 }, { x: 10, y: 600, w: 200, h: 14 }, 14);
  assert.match(tip, /role="img"/); assert.doesNotMatch(tip, /tabindex/);
  assert.match(tip, /aria-label="[^"]*12,345/); assert.match(tip, /title="[^"]*12,345/);
  assert.match(css, /\.xptip\{[^}]*pointer-events:none!important/);
  assert.doesNotMatch(css, /\.hudui \.xptip\{pointer-events:auto/);
});

test("U-5 / U-1 the phone dock offers the Map button, and the map title is short enough to clear it", () => {
  assert.doesNotMatch(css, /#ui\.phone \.hbtn\[data-open=map\]\{display:none\}/);
  assert.equal(T.mapTitle, "Map");
  assert.ok(`${T.mapTitle}: Floor 4: Open-plan floor`.length <= 30);
});

test("U-2 / F8 the tip ends above the HUD band and above a real toast, but keeps at least ~130 px of room", () => {
  assert.equal(tipLimit(600), 592, "no toast: just above the HUD");
  assert.equal(tipLimit(600, 548), 540, "a toast lowers the limit to above its top");
  assert.equal(tipLimit(600, 700), 592, "a toast below the HUD band changes nothing");
  assert.equal(tipLimit(600, 40), 130, "a tall or high toast cannot squeeze the tip below 130 px");
  assert.equal(tipLimit(100, 40), 92, "a short band is never pushed past its own limit");
  assert.match(panels, /syncToastDup\(\); \/\/ before the re-placement/, "the dup class is current before tipBottom reads it");
});

test("U-4 the bust crops the whole figure at the canvas aspect (boots included)", () => {
  assert.match(slots, /const sh = 280, sw = sh \* \(cw \/ ch\)/);
  assert.doesNotMatch(slots, /drawImage\(src, 140, 262, 200, 200/);
  assert.match(panels, /<canvas width="120" height="144" data-bust/);
});

test("N12 / U-3 a single-chain branch stacks centred (both columns, no elbow)", () => {
  assert.match(css, /\.tree \.tnodes\.chain \.tnode \{ grid-column: 2 \/ span 2; justify-self: center/);
  assert.match(css, /\.tree \.tnodes\.chain \.lk::after \{ display: none/);
});

test("wish: a death with an empty belt says where to restock; with a stocked belt the line is unchanged", () => {
  const empty = messageFor({ type: "respawn" }, { belt: [null, null, null, null] });
  assert.equal(empty, `${T.msgRespawned} ${T.msgRestock}`);
  assert.match(empty, /Break Room Barista/);
  assert.equal(messageFor({ type: "respawn" }, { belt: [null, { id: 1 }, null, null] }), T.msgRespawned);
});
