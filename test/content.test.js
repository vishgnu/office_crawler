import { test } from "node:test";
import assert from "node:assert/strict";
import { content, config } from "../src/core/index.js";

test("AC-R-030-1 S1 registry: 2+ types, a swarmer, positive stats, unique names", () => {
  const list = Object.values(content.monsters);
  assert.ok(list.length >= 2);
  assert.ok(list.some((m) => m.behaviour === "swarmer"));
  for (const m of list) {
    for (const k of ["hpBase", "damage", "defense", "xp", "speed", "sightRange"]) assert.ok(m[k] > 0, `${m.id}.${k}`);
    assert.ok(typeof m.name === "string" && m.name.length > 0);
  }
  assert.equal(new Set(list.map((m) => m.name)).size, list.length);
});

test("AC-NFR-A02-4 no time-limited input anywhere in config", () => {
  const keys = [];
  (function walk(o, path) { for (const [k, v] of Object.entries(o)) { keys.push(path + k); if (v && typeof v === "object") walk(v, path + k + "."); } })(config, "");
  assert.deepEqual(keys.filter((k) => /timeout/i.test(k)), []);
});
