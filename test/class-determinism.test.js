// R4 (AC-R-234-2, R-120, NFR-Q01): every class replays the recorded input script to its own frozen hash, twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashState, content } from "../src/core/index.js";
import { replay } from "./helpers.js";

const script = JSON.parse(readFileSync("test/fixtures/run-a.json", "utf8"));
const golden = JSON.parse(readFileSync("test/fixtures/run-class.json", "utf8"));

test("the frozen per-class replay hashes cover every class and the default class equals the main golden hash", () => {
  assert.deepEqual(Object.keys(golden).sort(), content.classes.map((c) => c.id).sort());
  assert.equal(golden["facilities-manager"], readFileSync("test/fixtures/run-a.hash", "utf8").trim());
  assert.equal(new Set(Object.values(golden)).size, 3, "three classes, three different games");
});

for (const c of content.classes) {
  test(`AC-R-234-2 ${c.id}: the recorded run replays to the same hash twice and equals the frozen hash`, () => {
    const a = replay(script, { class: c.id }), b = replay(script, { class: c.id });
    assert.equal(hashState(a), hashState(b));
    assert.deepEqual(a, b);
    assert.equal(hashState(a), golden[c.id]);
    assert.ok(a.eventLog.some((e) => e.type === "hit"), "the run includes real combat");
  });
}
