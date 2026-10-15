// L-042 / R11-0: e2e, bench and bot scripts must not write into the committed docs/shots by default.
// Source-text rules (they are about text): no script but e2e/shots-dir.mjs names docs/shots in code; every script that writes
// an image takes its directory from shots-dir.mjs (shotsDir) or helpers.mjs (SHOTS). A behaviour test of the resolver follows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { shotsDir, DEFAULT_SHOTS, PUBLISHED_SHOTS } from "../e2e/shots-dir.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DIRS = ["e2e", "bench", "bot"];
const files = DIRS.flatMap((d) => readdirSync(join(ROOT, d), { recursive: true }).filter((f) => /\.(m?js)$/.test(f) && !f.split(/[\\/]/).includes("shots")).map((f) => `${d}/${f}`));
const code = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n"); // drop comment lines and trailing comments
const WRITES_IMAGE = /\.screenshot\(|\.(jpe?g|png)\b/;
const USES_HELPER = /from ["']\.\/shots-dir\.mjs["']|\bSHOTS\b[^=\n]*\}? from ["']\.\/helpers\.mjs["']|from ["']\.\/helpers\.mjs["'][^\n]*\bSHOTS\b/;

test("lint scans a real set of scripts", () => {
  assert.ok(files.length > 40, `only ${files.length} files found`);
  assert.ok(files.includes("e2e/shots-dir.mjs") && files.includes("e2e/helpers.mjs"));
});

test("no script names docs/shots in code (only shots-dir.mjs does)", () => {
  const bad = files.filter((f) => f !== "e2e/shots-dir.mjs" && /docs[\\/]shots/.test(code(readFileSync(join(ROOT, f), "utf8"))));
  assert.deepEqual(bad, [], "write through shotsDir()/SHOTS; docs/shots is opt-in via E2E_SHOTS=docs/shots or --publish");
});

test("scripts that write images get the directory from shots-dir.mjs or helpers.mjs SHOTS", () => {
  const bad = files.filter((f) => {
    if (f === "e2e/shots-dir.mjs") return false;
    const src = code(readFileSync(join(ROOT, f), "utf8"));
    return /\.screenshot\(|writeFileSync\([^)]*\.(jpe?g|png)/.test(src) && !USES_HELPER.test(src);
  });
  assert.deepEqual(bad, []);
});

test("scripts that write images never hard-code an absolute or relative image path outside the helper", () => {
  const bad = [];
  for (const f of files) {
    if (f === "e2e/shots-dir.mjs") continue;
    for (const l of code(readFileSync(join(ROOT, f), "utf8")).split("\n")) {
      if (/(path|writeFileSync\()\s*[:(]?\s*["'`](?!\$\{)[^"'`]*\.(jpe?g|png)["'`]/.test(l) && /screenshot|writeFileSync/.test(l)) bad.push(`${f}: ${l.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("shotsDir: explicit dir, then E2E_SHOTS, then --publish, else a temp dir outside the repo", () => {
  const t = join(tmpdir(), "oc-shots-lint-" + process.pid);
  assert.equal(shotsDir(t + "-a", { env: {}, argv: [] }), t + "-a");
  assert.equal(shotsDir(undefined, { env: { E2E_SHOTS: t + "-b" }, argv: ["--publish"] }), t + "-b");
  assert.equal(shotsDir("--publish", { env: {}, argv: ["--publish"] }), PUBLISHED_SHOTS);
  const dflt = shotsDir(undefined, { env: {}, argv: [] });
  assert.equal(dflt, DEFAULT_SHOTS);
  assert.ok(!dflt.startsWith(ROOT), "default must be outside the repo");
  for (const x of ["-a", "-b"]) rmSync(t + x, { recursive: true, force: true });
});
