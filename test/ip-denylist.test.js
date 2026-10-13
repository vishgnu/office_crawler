import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const terms = readFileSync("docs/product/ip-denylist.txt", "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));

function files(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
}

test("no denylisted third-party terms in game source", () => {
  const hits = [];
  for (const f of files("src")) {
    const text = readFileSync(f, "utf8").toLowerCase();
    for (const t of terms) if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) hits.push(`${f}: ${t}`);
  }
  assert.deepEqual(hits, []);
});
