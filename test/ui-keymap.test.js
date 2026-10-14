// S3-4: key bindings (collisions rejected, defaults restored, remapped keys resolve, stored data is sanitised).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KEYS, ACTIONS, RESERVED, defaultKeys, normalizeKeys, bindKey, resolveKey, actionOf, keyLabel, sameKeys } from "../src/input/keymap.js";
import { panelFor } from "../src/input/keys.js";

test("defaults: 13 actions, every default code distinct, inventory is I", () => {
  assert.equal(ACTIONS.length, 13);
  assert.equal(new Set(Object.values(DEFAULT_KEYS)).size, 13);
  assert.equal(DEFAULT_KEYS.inventory, "KeyI");
  assert.ok(Object.isFrozen(DEFAULT_KEYS));
  assert.deepEqual(defaultKeys(), DEFAULT_KEYS);
});

test("bindKey: a free key binds, the table is not mutated", () => {
  const k = defaultKeys(), r = bindKey(k, "inventory", "KeyB");
  assert.equal(r.ok, true);
  assert.equal(r.keys.inventory, "KeyB");
  assert.equal(k.inventory, "KeyI");
});

test("bindKey: a key used by another action is a conflict and names it (AC-NFR-A01-3)", () => {
  const r = bindKey(defaultKeys(), "inventory", "KeyC");
  assert.deepEqual(r, { ok: false, reason: "conflict", with: "character" });
  assert.equal(bindKey(defaultKeys(), "inventory", "KeyI").ok, true, "re-binding an action to its own key is fine");
});

test("bindKey: reserved, invalid and unknown inputs are rejected", () => {
  for (const code of RESERVED) assert.equal(bindKey(defaultKeys(), "map", code).reason, "reserved", code);
  assert.equal(bindKey(defaultKeys(), "map", "Pause").reason, "invalid");
  assert.equal(bindKey(defaultKeys(), "nope", "KeyB").reason, "unknown");
  assert.equal(bindKey(defaultKeys(), "map", 5).reason, "reserved");
});

test("resolveKey: the default table passes through; a remapped key becomes the action's canonical code; the old key is dead (AC-NFR-A01-1)", () => {
  assert.equal(resolveKey("KeyI", DEFAULT_KEYS), "KeyI");
  const k = bindKey(defaultKeys(), "inventory", "KeyB").keys;
  assert.equal(resolveKey("KeyB", k), "KeyI");
  assert.equal(panelFor(resolveKey("KeyB", k)), "inventory");
  assert.equal(resolveKey("KeyI", k), null);
  assert.equal(resolveKey("Escape", k), "Escape");
  assert.equal(resolveKey("KeyK", k), "KeyK", "aliases keep working");
  assert.equal(resolveKey("Digit1", bindKey(defaultKeys(), "belt1", "KeyQ").keys), null, "AC-R-056-7: the old belt key does nothing");
  assert.equal(resolveKey("KeyQ", bindKey(defaultKeys(), "belt1", "KeyQ").keys), "Digit1");
});

test("normalizeKeys: garbage, unknown actions and duplicate codes fall back to the defaults (AC-NFR-A01-4)", () => {
  assert.deepEqual(normalizeKeys(null), DEFAULT_KEYS);
  assert.deepEqual(normalizeKeys({ inventory: "KeyB", map: 7, extra: "KeyZ" }), { ...DEFAULT_KEYS, inventory: "KeyB" });
  assert.deepEqual(normalizeKeys({ inventory: "KeyC" }), DEFAULT_KEYS, "two actions on one key reset everything");
  assert.deepEqual(normalizeKeys({ inventory: "Escape" }), DEFAULT_KEYS);
  assert.ok(sameKeys(normalizeKeys({ skills: "KeyH" }), { ...DEFAULT_KEYS, skills: "KeyH" }));
});

test("actionOf and keyLabel", () => {
  assert.equal(actionOf(DEFAULT_KEYS, "F2"), "skill2");
  assert.equal(actionOf(DEFAULT_KEYS, "KeyZ"), null);
  assert.equal([["KeyB", "B"], ["Digit1", "1"], ["F3", "F3"], ["ArrowUp", "Up"], ["Numpad2", "Num 2"]].every(([c, l]) => keyLabel(c) === l), true);
});
