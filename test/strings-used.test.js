import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { content } from "../src/core/index.js";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

test("AC-NFR-A06-1 every string id used by UI/render code exists in the string table", () => {
  const ui = files("src").filter((f) => /^src\/(ui|render|testhook)\/|^src\/(game|main)\.js$/.test(f.replaceAll("\\", "/")) && f.endsWith(".js"));
  assert.ok(ui.length > 5);
  for (const f of ui) for (const m of readFileSync(f, "utf8").matchAll(/\bS\.(\w+)/g)) assert.ok(m[1] in content.strings, `${f}: strings.${m[1]} is missing`);
});

test("AC-R-102-2 screens and HUD take visible text from the string table only", () => {
  for (const f of ["src/ui/screens.js", "src/render/hud.js"]) {
    const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    // text-producing calls must not receive a literal containing letters
    for (const m of code.matchAll(/(?:el\([^,)]+,[^,)]*,|fillText\(|strokeText\(|button\()\s*"([^"]*[A-Za-z]{3}[^"]*)"/g)) assert.fail(`${f}: literal text "${m[1]}"`);
  }
});
