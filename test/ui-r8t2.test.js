// FIX-R8T-2 source/CSS contracts (pixels and behaviour are checked by e2e/r8t2-fix.mjs): N1 scrolling and compact screens at short heights, N2 death closes panels and returns the held item,
// N3 dock buttons keep 44 px, N4 the Employee File header ellipsises a wide name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/style.css"), game = read("../src/game.js"), panels = read("../src/ui/panels.js");

test("N1: full-screen layers scroll (overflow-y auto, safe centring) and compact below 430 px of height; the create screen goes two-column on short landscape phones", () => {
  assert.match(css, /\.screen \{ overflow-y: auto; justify-content: safe center; \}/);
  assert.match(css, /@media \(max-height: 430px\) \{[^@]*\.screen \.btn \{[^}]*min-height: 44px/);
  assert.match(css, /@media \(max-height: 430px\) and \(min-width: 561px\) \{[^@]*\.cs-foot \{ position: sticky; bottom: 0;/);
});

test("N2 (text part; the behaviour is tested through createGame in test/ui-r11-behaviour.test.js): the dead scene styles", () => {
  assert.match(panels, /classList\.toggle\("scene-dead", c\.scene === "dead"\)/);
  assert.match(css, /#ui\.scene-dead \.dock \{ visibility: hidden; \}/);
});

test("N3: phone dock buttons never shrink below 44 px", () => {
  assert.match(css, /#ui\.phone \.dock \.hbtn \{ flex: 0 0 auto; min-width: 44px; \}/);
  assert.match(css, /#ui\.phone \.dock \{ flex-wrap: wrap;/);
});

test("N4: the Employee File name and class lines ellipsise inside a shrinkable column", () => {
  assert.match(css, /\.fh > div:not\(\.photo\):not\(\.stamp\) \{ min-width: 0;/);
  assert.match(css, /\.fh h2, \.fh p \{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap;/);
});
