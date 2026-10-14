// S3-4: options defaults and sanitising, colour-blind safety of the rarity colours, text-size table, new strings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultOptions, normalizeOptions, TEXT_SCALES } from "../src/ui/options.js";
import { DEFAULT_KEYS } from "../src/input/keymap.js";
import { audioConfig } from "../src/audio/config.js";
import { MARK_IDS, rarityMark } from "../src/ui/icons.js";
import { messageFor } from "../src/ui/messages.js";
import { content, newGame } from "../src/core/index.js";
import { hudState, engagedBoss } from "../src/render/hud.js";
import { getStyle, defaultStyleId } from "../src/render/style.js";

test("defaults follow the sound decision (master 0.6, effects 0.8, ambient 0.5, kit foley, unmuted) and the default keys (AC-R-082-5)", () => {
  const o = defaultOptions();
  assert.deepEqual(o.volume, { master: 0.6, sfx: 0.8, ambient: 0.5 });
  assert.equal(o.kit, "foley"); assert.equal(o.muted, false); assert.equal(audioConfig.defaultKit, "foley");
  assert.deepEqual(o.keys, DEFAULT_KEYS);
  assert.equal(o.textScale, 1); assert.equal(o.reducedMotion, false); assert.equal(o.highContrast, false); assert.equal(o.screenShake, true);
});

test("normalizeOptions keeps valid values, clamps volume to [0,1] and replaces bad ones (AC-R-082-4)", () => {
  const o = normalizeOptions({ volume: { master: 3, sfx: -0.5, ambient: "x" }, muted: true, kit: "gothic", textScale: 1.25, reducedMotion: true, keys: { inventory: "KeyB" } });
  assert.deepEqual(o.volume, { master: 1, sfx: 0, ambient: 0.5 });
  assert.equal(o.muted, true); assert.equal(o.kit, "gothic"); assert.equal(o.textScale, 1.25); assert.equal(o.reducedMotion, true); assert.equal(o.keys.inventory, "KeyB");
  const bad = normalizeOptions({ kit: "polka", textScale: 7, volume: 5, muted: "yes", highContrast: 1 });
  assert.equal(bad.kit, "foley"); assert.equal(bad.textScale, 1); assert.equal(bad.muted, false); assert.equal(bad.highContrast, false);
  assert.deepEqual(normalizeOptions(undefined), defaultOptions());
  assert.deepEqual(normalizeOptions(JSON.parse(JSON.stringify(o))), o, "round-trips through JSON");
  assert.ok(TEXT_SCALES.includes(1) && TEXT_SCALES.every((s) => s >= 1));
});

// Colour-blind check (S3-6 list): the four rarity colours are told apart by colour under protan, deutan and tritan simulation
// (Machado 2009, severity 1.0, linear RGB, CIE76 distance), and by shape and border style as well, so colour is never the only cue.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const SIM = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lab = ([r, g, b]) => {
  const c = [r, g, b].map((x) => Math.min(1, Math.max(0, x))), X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const css = readFileSync("src/style.css", "utf8");
const rarityColours = () => Object.fromEntries(["normal", "magic", "rare", "unique"].map((r) => [r, css.match(new RegExp(`--c-${r}:(#[0-9a-fA-F]{6})`))[1]]));

test("rarity colours stay distinguishable under colour-vision simulation (every pair at least 12 CIE76 units apart)", () => {
  const cols = rarityColours(), names = Object.keys(cols);
  for (const [kind, m] of Object.entries(SIM)) {
    const sim = Object.fromEntries(names.map((n) => [n, lab(m.map((row) => row[0] * lin(hex(cols[n])[0]) + row[1] * lin(hex(cols[n])[1]) + row[2] * lin(hex(cols[n])[2])))]));
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const d = Math.hypot(...sim[names[i]].map((x, k) => x - sim[names[j]][k]));
      assert.ok(d >= 12, `${kind}: ${names[i]} vs ${names[j]} only ${d.toFixed(1)} apart`);
    }
  }
});

test("rarity is also told by shape and border style, never by colour alone", () => {
  const marks = ["normal", "magic", "rare", "unique"].map((r) => rarityMark(r, 12));
  assert.equal(new Set(marks).size, 4);
  assert.ok(MARK_IDS.length >= 4);
  const borders = ["normal", "magic", "rare", "unique"].map((r) => css.match(new RegExp(`\\.r-${r}\\.item\\{border:([^;]+);`))[1]);
  assert.equal(new Set(borders).size, 4, borders.join(" | "));
});

test("messages: the boss telegraph reaches the toast and the live region; phase, summon and stairs lines exist", () => {
  const s = newGame(1, { start: "town" });
  assert.equal(messageFor({ type: "bossTelegraph", kind: "slam", id: "m1" }, s), content.strings.bossTelegraphSlam);
  assert.equal(messageFor({ type: "bossTelegraph", kind: "volley", id: "m1" }, s), content.strings.bossTelegraphVolley);
  assert.equal(messageFor({ type: "bossPhase", phase: 2 }, s), content.strings.bossPhase2);
  assert.equal(messageFor({ type: "bossSummon", adds: [] }, s), content.strings.bossSummon);
  assert.equal(messageFor({ type: "stairsUnlocked", depth: 8 }, s), content.strings.bossStairsUnlocked);
  assert.equal(messageFor({ type: "autosave", reason: "floor" }, s), null, "autosave is silent");
});

test("hudState: boss bar data while the boss is engaged, key badges follow options.keys", () => {
  const s = newGame(1, { start: "floor", floor: undefined });
  const style = getStyle(defaultStyleId);
  assert.equal(hudState(s, 1280, 720, style).boss, null);
  const m = { id: "mb", type: "regional-director", tier: "boss", ai: "chase", hp: 1500, hpMax: 3000, tile: { x: 1, y: 1 }, boss: { phase: 1, engaged: true, windup: null } };
  s.monsters.push(m);
  s.scene = "victory";
  assert.equal(engagedBoss(s), null, "only on a floor scene with an engaged boss");
  s.scene = "floor";
  const h = hudState(s, 1280, 720, style);
  assert.equal(engagedBoss(s).id, "mb");
  assert.equal(h.boss.ratio, 0.5); assert.equal(h.boss.markAt, 0.5); assert.equal(h.boss.phase, 1); assert.equal(h.boss.name, content.bosses["regional-director"].name);
  s.options = { keys: { ...DEFAULT_KEYS, skill1: "KeyZ", belt1: "KeyQ" } };
  const h2 = hudState(s, 1280, 720, style);
  assert.equal(h2.skills[0].key, "Z"); assert.equal(h2.belt[0].key, "Q"); assert.equal(h2.skills[1].key, "F2");
  m.ai = "dead";
  assert.equal(engagedBoss(s), null);
});
