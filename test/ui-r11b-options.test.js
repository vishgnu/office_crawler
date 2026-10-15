// R11-FIX2-UI F-04: options are one global object; a stale tab writes only what it changed (behaviour: two stores on one shared adapter).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { normalizeOptions } from "../src/ui/options.js";

const tab = (adapter, id) => {
  const store = createSlotStore(adapter, { now: () => 1000, tabId: id, onNotice: () => {} });
  const options = normalizeOptions(store.loadOptions());
  store.optionsBaseline(options);
  return { store, options };
};

test("[F-04] a stale tab changing one option does not revert another option set in a second tab", () => {
  const adapter = createMemoryAdapter(), a = tab(adapter, "A"), b = tab(adapter, "B");
  b.options.textScale = 1.5; b.options.highContrast = true; b.store.saveOptions(b.options);
  a.options.textScale = 1.25; a.store.saveOptions(a.options);   // A is stale: it never saw B's high contrast
  const c = tab(adapter, "C");
  assert.equal(c.options.textScale, 1.25, "A's own change wins for its own key");
  assert.equal(c.options.highContrast, true, "B's change survives");
});

test("[F-04] volume channels and key bindings merge per entry; a second write from the same tab does not re-send old values", () => {
  const adapter = createMemoryAdapter(), a = tab(adapter, "A"), b = tab(adapter, "B");
  b.options.volume.sfx = 0.2; b.options.keys = { ...b.options.keys, skill1: "KeyZ" }; b.store.saveOptions(b.options);
  a.options.volume.master = 0.3; a.store.saveOptions(a.options);
  let c = tab(adapter, "C");
  assert.equal(c.options.volume.master, 0.3); assert.equal(c.options.volume.sfx, 0.2); assert.equal(c.options.keys.skill1, "KeyZ");
  b.options.muted = true; b.store.saveOptions(b.options);       // B writes again: only muted changed since its last write
  a.options.volume.master = 0.4; a.store.saveOptions(a.options);
  c = tab(adapter, "C2");
  assert.equal(c.options.muted, true); assert.equal(c.options.volume.master, 0.4); assert.equal(c.options.volume.sfx, 0.2);
});

test("[F-04] without a baseline the object is written whole (first run, nothing stored)", () => {
  const adapter = createMemoryAdapter(), store = createSlotStore(adapter, { now: () => 1, tabId: "A", onNotice: () => {} });
  const o = normalizeOptions({}); o.textScale = 1.25; store.saveOptions(o);
  assert.equal(normalizeOptions(store.loadOptions()).textScale, 1.25);
});
