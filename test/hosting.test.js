// Hosting guard (customer request 2026-10-14): the page asks search engines not to index it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("index.html carries robots noindex, nofollow", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
