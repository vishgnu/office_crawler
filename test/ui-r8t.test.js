// FIX-UI-R8T: Desk Drawer fits or scrolls with a visible footer (R8-A1), the XP hover box takes no pointer events (R8-A2), phone Map button and short map title (U-1/U-5),
// tooltip clears the toast (U-2), whole-figure bust crop (U-4), centred single-chain tree (N12/U-3), restock hint after a death (wish). Source/CSS contracts and pure logic; the pixels are checked by screenshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { messageFor } from "../src/ui/messages.js";
import { T } from "../src/ui/text.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/style.css"), panels = read("../src/ui/panels.js"), slots = read("../src/ui/slots.js");

test("R8-A1 the Desk Drawer hint spans the drawer (not the narrow side column) and the footer stays in view while the body scrolls", () => {
  assert.match(panels, /<\/div><\/div><\/div><\/div><p class="keyhint">\$\{esc\(T\.dragHint\)\}<\/p>/);
  assert.match(css, /#pright \.footrow\{position:sticky;bottom:-10px/);
  assert.match(css, /\.pb\{overflow:auto/);
});

test("R8-A2 the XP hover box never takes a pointer event; the title and label stay for assistive tech", () => {
  assert.match(css, /\.xptip\{[^}]*pointer-events:none!important/);
  assert.doesNotMatch(css, /\.hudui \.xptip\{pointer-events:auto/);
  assert.match(panels, /data-testid="hud-xp"[^>]*title="[^"]*"[^>]*aria-label=/);
});

test("U-5 / U-1 the phone dock offers the Map button, and the map title is short enough to clear it", () => {
  assert.doesNotMatch(css, /#ui\.phone \.hbtn\[data-open=map\]\{display:none\}/);
  assert.match(css, /#ui\.phone\.map-open \.dock \.hbtn\[data-open=map\]\{display:flex\}/);
  assert.equal(T.mapTitle, "Map");
  assert.ok(`${T.mapTitle}: Floor 4: Open-plan floor`.length <= 30);
});

test("U-2 a tip is placed above the measured toast and re-placed when a toast appears", () => {
  assert.match(panels, /const tipBottom = \(D\) =>/);
  assert.equal((panels.match(/bottom: tipBottom\(D\)/g) ?? []).length, 2);
  assert.doesNotMatch(panels, /el\.toast\.hidden \? 0 : 52/);
  assert.match(panels, /showTip\(view\.hoverKey, view\.hoverEl\)/);
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
