// Machine-checked harness rules (learning L-07): rules that can be checked should be tests, not only prose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

test("L-06: no wall-clock timing inside unit tests (use bounded work; perf goes to bench/)", () => {
  const hits = files("test").filter((f) => f.endsWith(".js") && !f.endsWith("lint-rules.test.js"))
    .filter((f) => /performance\.now\(\)|Date\.now\(\)/.test(readFileSync(f, "utf8")));
  assert.deepEqual(hits, []);
});

test("determinism: no Math.random or Date.now in src/core (use the seeded RNG)", () => {
  let hits = [];
  try { hits = files("src/core").filter((f) => /Math\.random\(|Date\.now\(/.test(readFileSync(f, "utf8"))); } catch { /* no core dir */ }
  assert.deepEqual(hits, []);
});
