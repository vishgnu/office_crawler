// NFR-A04-3 / decision must-fix 7: contrast >= 4.5:1 for every text and background pair the UI uses. Tokens are read from style.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/style.css", "utf8");
const tokens = Object.fromEntries([...css.slice(css.indexOf("S2 UI")).matchAll(/--([\w-]+):(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const t = (k) => tokens[k] ?? k;

test("the colour tokens are in style.css", () => {
  for (const k of ["panel", "panel2", "panel3", "txt", "mut", "gold", "paper", "ink", "inkm", "red", "ok", "bad", "btn", "btn2", "woodD"]) assert.ok(tokens[k], `--${k} missing`);
});

test("text on panel backgrounds is at least 4.5:1", () => {
  const pairs = [
    ["txt", "panel"], ["txt", "panel2"], ["txt", "panel3"], ["mut", "panel"], ["mut", "panel2"], ["mut", "panel3"], ["gold", "panel3"], ["gold", "panel"],
    ["c-normal", "panel3"], ["c-magic", "panel3"], ["c-rare", "panel3"], ["c-unique", "panel3"], ["c-normal", "panel"], ["c-magic", "panel"], ["c-rare", "panel"], ["c-unique", "panel"],
    ["ok", "panel3"], ["bad", "panel3"], ["bad", "panel2"], ["focus", "panel"], ["#ffffff", "btn"], ["#ffffff", "btn2"], ["gold", "btn2"], ["#ffffff", "woodD"], ["#ffffff", "#5a6482"], ["#ffffff", "panel2"],
    ["ol", "gold"], ["ol", "focus"], ["#ffffff", "ol"], ["#ffffff", "rim"], ["#9b93c9", "panel2"],
  ];
  for (const [fg, bg] of pairs) assert.ok(ratio(t(fg), t(bg)) >= 4.5, `${fg} on ${bg}: ${ratio(t(fg), t(bg)).toFixed(2)}`);
});

test("text on the paper Employee File is at least 4.5:1", () => {
  const dark = { normal: "#2a2547", magic: "#0a5c8f", rare: "#6b5d00", unique: "#983300" };
  for (const bg of ["paper", "#e0d6b8"]) {
    for (const fg of ["ink", "inkm", "red"]) assert.ok(ratio(t(fg), t(bg)) >= 4.5, `${fg} on ${bg}: ${ratio(t(fg), t(bg)).toFixed(2)}`);
    for (const [r, c] of Object.entries(dark)) assert.ok(ratio(c, t(bg)) >= 4.5, `${r} ${c} on ${bg}: ${ratio(c, t(bg)).toFixed(2)}`);
  }
  assert.ok(ratio(t("disabled-fg"), t("disabled-bg")) >= 4.5, "disabled + button");
  assert.ok(ratio("#ffe27a", t("btn2")) >= 4.5, "the + glyph on its button");
});

test("the dark-sheet rarity colours in the CSS match the ones tested", () => {
  assert.match(css, /\.sheet \.l-magic\{color:#0a5c8f\}/);
  assert.match(css, /\.sheet \.l-rare\{color:#6b5d00\}/);
  assert.match(css, /\.sheet \.l-unique\{color:#983300\}/);
});
