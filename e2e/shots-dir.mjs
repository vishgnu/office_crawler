// Single place that decides where e2e / shot scripts write images (L-042: runs must not rewrite committed docs/shots).
// Order: explicit directory argument (e.g. `node e2e/ui-shots.mjs docs/shots`), then E2E_SHOTS, then the `--publish` flag
// (= docs/shots, the committed screenshots), else a temp dir OUTSIDE the repo: <os tmpdir>/office-crawler-shots.
// Writing into docs/shots therefore always needs an explicit opt-in: E2E_SHOTS=docs/shots, `--publish`, or a directory argument.
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

/** The committed screenshot directory. Read from here (comparison pairs); never write to it without the opt-in. */
export const PUBLISHED_SHOTS = resolve("docs/shots");
export const DEFAULT_SHOTS = join(tmpdir(), "office-crawler-shots");

/** Resolve (and create) the screenshot directory. `explicit` is an optional directory argument; "--flags" are ignored there. */
export function shotsDir(explicit, { env = process.env, argv = process.argv } = {}) {
  let dir;
  if (explicit && !String(explicit).startsWith("--")) dir = resolve(explicit);
  else if (env.E2E_SHOTS) dir = resolve(env.E2E_SHOTS);
  else if (argv.includes("--publish")) dir = PUBLISHED_SHOTS;
  else dir = DEFAULT_SHOTS;
  mkdirSync(dir, { recursive: true });
  return dir;
}
