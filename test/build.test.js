// AC-NFR-S01-2 (no server files, CSP meta present) and AC-NFR-L05-1 / AC-NFR-L03-1 (brand + IP scans of
// the built page, which includes every visible string).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const terms = (f) => readFileSync(f, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("build output: one self-contained page with a CSP and no server files", () => {
  execFileSync(process.execPath, ["build.mjs"], { stdio: "ignore" });
  assert.deepEqual(readdirSync("dist"), ["index.html"]);
  const html = readFileSync("dist/index.html", "utf8");
  assert.match(html, /<meta http-equiv="Content-Security-Policy"/i);
  assert.ok(!/<script[^>]+src=|<link[^>]+href=/i.test(html), "no external scripts or styles");
  for (const f of ["server.js", "src/server.js", "api"]) assert.ok(!existsSync(f), `unexpected server file ${f}`);
});

test("built page contains no denylisted IP terms or real brands", () => {
  if (!existsSync("dist/index.html")) execFileSync(process.execPath, ["build.mjs"], { stdio: "ignore" });
  const html = readFileSync("dist/index.html", "utf8").toLowerCase();
  const hits = [...terms("docs/product/ip-denylist.txt"), ...terms("docs/product/ip-denylist-brands.txt")]
    .filter((t) => new RegExp(`(^|[^a-z])${esc(t)}([^a-z]|$)`).test(html));
  assert.deepEqual(hits, []);
});
