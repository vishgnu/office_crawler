// Runs every e2e script in sequence; non-zero exit if any fails or times out. `npm run e2e` builds first.
// L-022: every script has a timeout (default 240 s, override per script below or with E2E_TIMEOUT_S); a hung child is killed, "TIMEOUT <script>"
// is printed and the run fails. The summary line of each script is repeated as soon as it finishes, so a hang never looks like "no output".
import { spawn } from "node:child_process";
const scripts = ["audio", "smoke", "hook", "render", "combat", "input", "replay", "realtime", "ui", "s3ui", "r5ui", "adv-r5", "adv-r6", "r7journal", "polish"];
const DEFAULT_S = Number(process.env.E2E_TIMEOUT_S) || 240;
const TIMEOUT_S = { replay: 480, polish: 360, "adv-r5": 420, "adv-r6": 600 }; // per-script overrides (seconds)
const results = [];

function run(name) {
  return new Promise((resolve) => {
    const t0 = Date.now(), limit = (TIMEOUT_S[name] ?? DEFAULT_S) * 1000;
    const child = spawn(process.execPath, [`e2e/${name}.mjs`], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "", timedOut = false;
    child.stdout.on("data", (d) => { process.stdout.write(d); out += d; if (out.length > 200000) out = out.slice(-100000); });
    const timer = setTimeout(() => { timedOut = true; console.log(`\nTIMEOUT ${name} (${limit / 1000} s)`); child.kill("SIGKILL"); }, limit);
    child.on("close", (code) => {
      clearTimeout(timer);
      const summary = out.split("\n").reverse().find((l) => /checks passed|passed/.test(l) && !l.startsWith("PASS")) ?? "(no summary line)";
      const ok = code === 0 && !timedOut;
      results.push({ name, ok, timedOut, summary: summary.trim(), s: Math.round((Date.now() - t0) / 1000) });
      console.log(`--- ${ok ? "ok" : timedOut ? "TIMEOUT" : "FAILED"} e2e/${name}.mjs (${results.at(-1).s} s): ${results.at(-1).summary}`);
      resolve();
    });
  });
}

for (const s of scripts) {
  console.log(`\n=== e2e/${s}.mjs ===`);
  await run(s);
}
const bad = results.filter((r) => !r.ok);
console.log("\nSummary:");
for (const r of results) console.log(`  ${r.ok ? "ok    " : r.timedOut ? "TIMEOUT" : "FAILED "} ${r.name}: ${r.summary}`);
console.log(bad.length ? `\nE2E FAILED: ${bad.map((r) => r.name).join(", ")}` : "\nE2E OK: all scripts passed");
process.exit(bad.length ? 1 : 0);
