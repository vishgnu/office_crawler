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

test("N5: input and ui code never import from render/ (shared camera maths lives in ui/camera.js)", () => {
  for (const f of [...files("src/input"), ...files("src/ui")].filter((x) => x.endsWith(".js"))) {
    for (const m of strip(readFileSync(f, "utf8")).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolve(dirname(f), m[1]);
      assert.ok(!target.startsWith(resolve("src/render")), `${f} imports from render/: ${m[1]}`);
    }
  }
});

test("the bot policy is pure: no DOM, clocks, timers or Math.random", () => {
  const banned = /\b(window|document|navigator|Date|performance|setTimeout|setInterval|requestAnimationFrame)\b|Math\.random/;
  for (const f of ["bot/policy.js", "bot/report.js"]) assert.ok(!banned.test(strip(readFileSync(f, "utf8"))), `${f} uses a forbidden global`);
});

// CR8-06: the gear signature grammar has one home (src/shared/look.js) and the layers that must not see render/ do not.
test("CR8-06 save/ and ui/ import nothing from render/, and src/shared/ is pure (no imports, no DOM, no clock)", () => {
  for (const f of [...files("src/save"), ...files("src/ui")].filter((x) => x.endsWith(".js"))) {
    for (const m of strip(readFileSync(f, "utf8")).matchAll(/from\s+"([^"]+)"/g)) {
      assert.ok(!resolve(dirname(f), m[1]).startsWith(resolve("src/render")), `${f} imports from render/: ${m[1]}`);
    }
  }
  const shared = files("src/shared").filter((x) => x.endsWith(".js"));
  assert.ok(shared.length > 0);
  for (const f of shared) {
    const src = strip(readFileSync(f, "utf8"));
    assert.ok(!/^\s*import\s|\bfrom\s+"/m.test(src), `${f} has an import`);
    assert.ok(!/\b(window|document|navigator|localStorage|Date|performance|setTimeout|requestAnimationFrame|OffscreenCanvas)\b|Math\.random/.test(src), `${f} uses a forbidden global`);
  }
});

test("CR8-06 the signature regex is written once in src/ (shared/look.js); render, save and ui use that one", () => {
  const re = /\[-a-z0-9\]\{1,4\}\(\\\|\[-a-z0-9\]\{1,4\}\)\{5\}/;
  const hits = files("src").filter((f) => f.endsWith(".js") && re.test(readFileSync(f, "utf8")));
  assert.deepEqual(hits.map((f) => f.replace(/\\/g, "/")), ["src/shared/look.js"]);
  for (const f of ["src/save/slots.js", "src/ui/slots.js", "src/render/gearlooks.js"]) assert.match(readFileSync(f, "utf8"), /shared\/look\.js/, `${f} imports the shared module`);
});
