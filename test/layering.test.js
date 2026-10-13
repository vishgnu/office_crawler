import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
const core = files("src/core").filter((f) => f.endsWith(".js"));

test("core stays pure: no DOM, clocks, timers or Math.random", () => {
  const banned = /\b(window|document|navigator|localStorage|Date|performance|setTimeout|setInterval|requestAnimationFrame|AudioContext)\b|Math\.random/;
  for (const f of core) assert.ok(!banned.test(strip(readFileSync(f, "utf8"))), `${f} uses a forbidden global`);
});

test("core uses no transcendental maths (results can differ per engine)", () => {
  const banned = /Math\.(sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|log2|log10|hypot|cbrt|sinh|cosh|tanh)\b|\*\*/;
  for (const f of core) assert.ok(!banned.test(strip(readFileSync(f, "utf8"))), `${f} uses forbidden maths`);
});

test("core imports only core files and the shared rng", () => {
  const rng = resolve("src/rng.js");
  for (const f of core) {
    for (const m of strip(readFileSync(f, "utf8")).matchAll(/from\s+"([^"]+)"/g)) {
      assert.ok(m[1].startsWith("."), `${f} imports a package: ${m[1]}`);
      const target = resolve(dirname(f), m[1]);
      assert.ok(target === rng || target.startsWith(resolve("src/core")), `${f} imports outside core: ${m[1]}`);
    }
  }
});
