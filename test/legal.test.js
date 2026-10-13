import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { content } from "../src/core/index.js";

const terms = readFileSync("docs/product/ip-denylist.txt", "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
const hit = (text) => terms.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text.toLowerCase()));
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

test("AC-NFR-L01-1 no denylisted term in strings, registry names or source file names", () => {
  const strings = [];
  (function walk(o) { for (const v of Object.values(o)) typeof v === "string" ? strings.push(v) : v && typeof v === "object" && walk(v); })(content);
  const names = [...Object.values(content.monsters).map((m) => m.name), ...Object.keys(content.props), ...Object.keys(content.themes)];
  assert.deepEqual([...strings, ...names, ...files("src").map((f) => basename(f))].flatMap((s) => hit(s)), []);
});

test("AC-NFR-L01-2 the source tree holds nothing but code (no images, audio, fonts)", () => {
  const odd = files("src").filter((f) => ![".js", ".css", ".html"].includes(extname(f)));
  assert.deepEqual(odd, []);
});

test("AC-NFR-L04-1 build dependencies use permissive licences", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const ok = ["MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "ISC"];
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const p = `node_modules/${name}/package.json`;
    if (!existsSync(p)) continue; // not installed here; the lockfile check belongs to CI
    assert.ok(ok.includes(JSON.parse(readFileSync(p, "utf8")).license), `${name} licence`);
  }
});
