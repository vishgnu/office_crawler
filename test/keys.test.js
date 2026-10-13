import { test } from "node:test";
import assert from "node:assert/strict";
import { content } from "../src/core/index.js";
import { requiredKeys, keys, dirIndex, ANIMS, DIRS, FLOOR_KINDS, WALL_VARIANTS } from "../src/render/keys.js";
import { propsByRoomKind } from "../src/core/content/props.js";

test("AC-R-101-3 sprite keys cover every theme, prop and monster id and are unique", () => {
  const all = requiredKeys(content);
  assert.equal(new Set(all).size, all.length);
  for (const id of Object.keys(content.props)) assert.ok(all.includes(keys.prop(id)), id);
  for (const id of Object.keys(content.monsters)) assert.ok(all.includes(keys.mon(id, "idle", 0, 0)) && all.includes(keys.mon(id, "death", DIRS - 1, ANIMS.death - 1)), id);
  assert.equal(all.filter((k) => k.startsWith("wall:open-plan:")).length, 16 * WALL_VARIANTS);
});

test("floor kinds in the sprite keys match the generator's room kinds plus corridor", () => {
  const kinds = new Set(Object.keys(propsByRoomKind));
  for (const k of content.themes["open-plan"].roomKinds) assert.ok(FLOOR_KINDS.includes(k) && kinds.has(k), k);
  assert.ok(FLOOR_KINDS.includes("corridor"));
});

test("dirIndex maps the eight tile directions to eight distinct indices", () => {
  const seen = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) seen.add(dirIndex(dx, dy));
  assert.equal(seen.size, 8);
  assert.equal(dirIndex(0, 0, 5), 5);
});
