// R4-1: character names (R4 contract section 6, AC-R-211-1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateName, suggestName, suggestionCount, NAME_MAX, DEFAULT_NAME } from "../src/core/index.js";

test("AC-R-211-1 validateName: empty, too long, markup and emoji are rejected; spaces are trimmed and collapsed; the 16-character limit is inclusive", () => {
  assert.deepEqual(validateName(""), { ok: false, error: "bad-name" });
  assert.deepEqual(validateName("    "), { ok: false, error: "bad-name" });
  assert.equal(validateName("x".repeat(17)).ok, false);
  assert.deepEqual(validateName("<img src=x>"), { ok: false, error: "bad-name" });
  assert.deepEqual(validateName("  Dana   Lee  "), { ok: true, name: "Dana Lee" });
  assert.equal(validateName("Party \u{1F389}").ok, false);
  assert.deepEqual(validateName("A-b c'D 9 xyz Q"), { ok: true, name: "A-b c'D 9 xyz Q" });
  assert.equal(validateName("1234567890abcdef").ok, true); assert.equal(NAME_MAX, 16);
});

test("names allow Unicode letters and digits, hyphen, apostrophe and space; they reject control characters, markup and other symbols", () => {
  for (const ok of ["Zoë", "Özlem", "山田", "Señor García", "O'Brien", "Anne-Marie", "Мария", "Desk 7", "’n’"]) assert.equal(validateName(ok).ok, true, ok);
  for (const bad of ["a\tb", "a\nb", "a\u0000b", "a<b", "a>b", "a&b", "a\"b", "a/b", "a\\b", "a;b", "a_b", "a.b", "a@b", "{x}", "a​b", "‮abc", 42, null, undefined, {}, ["a"]]) assert.equal(validateName(bad).ok, false, String(bad));
});

test("suggestName: 24 fixed names, deterministic, wrapping, all valid, unique, none a real person or on the denylist", () => {
  assert.equal(suggestionCount, 24);
  const names = Array.from({ length: 24 }, (_, i) => suggestName(i));
  assert.equal(new Set(names).size, 24);
  for (const n of names) assert.deepEqual(validateName(n), { ok: true, name: n });
  assert.equal(suggestName(0), "Sir Stapleton"); assert.equal(suggestName(24), suggestName(0)); assert.equal(suggestName(-1), suggestName(23));
  assert.equal(suggestName(1), suggestName(1));
  assert.ok(names.includes("Desk Pilot 7") && names.includes("Agent Break-Room"));
  const terms = ["docs/product/ip-denylist.txt", "docs/product/ip-denylist-brands.txt"].flatMap((f) => readFileSync(f, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
  for (const n of names) for (const t of terms) assert.ok(!new RegExp(`\\b${t}\\b`).test(n.toLowerCase()), `${n}: ${t}`);
  assert.equal(validateName(DEFAULT_NAME).ok, true);
});
