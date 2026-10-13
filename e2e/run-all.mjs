// Runs every e2e script in sequence; non-zero exit if any fails. `npm run e2e` builds first.
import { spawnSync } from "node:child_process";
const scripts = ["smoke", "hook", "render", "combat", "input", "replay", "realtime", "ui"];
let bad = 0;
for (const s of scripts) {
  console.log(`\n=== e2e/${s}.mjs ===`);
  const r = spawnSync(process.execPath, [`e2e/${s}.mjs`], { stdio: "inherit" });
  if (r.status !== 0) bad++;
}
console.log(bad ? `\nE2E FAILED: ${bad} script(s)` : "\nE2E OK: all scripts passed");
process.exit(bad ? 1 : 0);
