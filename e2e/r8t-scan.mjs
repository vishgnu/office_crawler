// R8-T static scans of the built file: size budget, IP denylist (both lists), external references, network-capable APIs, licence statement, play/ copy. Usage: node e2e/r8t-scan.mjs (run `node build.mjs` first).
import { readFileSync, statSync, existsSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { check, finish } from "./helpers.mjs";

const html = readFileSync("dist/index.html", "utf8"), buf = readFileSync("dist/index.html");
const kb = buf.length / 1024, gz = gzipSync(buf).length / 1024, br = brotliCompressSync(buf).length / 1024;
console.log(`INFO dist/index.html ${kb.toFixed(0)} KB raw, ${gz.toFixed(0)} KB gzip, ${br.toFixed(0)} KB brotli`);
check("[R8T-size] dist is at most 10 MB (NFR-P total download)", kb <= 10 * 1024, kb);
check("[R8T-size] dist is within the 3 MB stretch target", kb <= 3 * 1024, kb);
check("[R8T-size] dist/index.html is a single self-contained file (one script, no src/href to other files)", !/<script[^>]+src=|<link[^>]+href=|<img[^>]+src="(?!data:)/i.test(html), null);
const terms = (f) => readFileSync(f, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
const low = html.toLowerCase();
for (const f of ["docs/product/ip-denylist.txt", "docs/product/ip-denylist-brands.txt"]) {
  const hits = terms(f).filter((t) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(low));
  const subs = terms(f).filter((t) => low.includes(t) && !hits.includes(t));
  check(`[R8T-legal] dist contains no term of ${f.split("/").pop()} (whole word)`, hits.length === 0, hits);
  console.log(`INFO ${f.split("/").pop()}: substring-only matches (inside longer words): ${JSON.stringify(subs)}`);
}
const urls = [...new Set(html.match(/https?:\/\/[^\s"'<>)\\]+/g) ?? [])];
console.log("INFO URLs in dist:", JSON.stringify(urls));
check("[R8T-legal] no external URL other than namespace declarations in dist", urls.every((u) => /^http:\/\/www\.w3\.org\//.test(u)), urls.filter((u) => !/^http:\/\/www\.w3\.org\//.test(u)));
const net = ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "importScripts", "navigator.serviceWorker", "EventSource", "eval(", "new Function("].filter((k) => html.includes(k));
check("[R8T-legal] dist uses no network or dynamic-code API (fetch, XHR, WebSocket, beacon, eval, Function)", net.length === 0, net);
check("[R8T-legal] CSP meta present and denies connect/frames (default-src 'none')", /Content-Security-Policy[^>]+default-src 'none'/.test(html), null);
check("[R8T-legal] robots noindex meta present", /name="robots"[^>]+noindex/.test(html), null);
check("[R8T-legal] licence statement file exists (docs/ASSET-LICENCES.md, added by CORE-R8T-1)", existsSync("docs/ASSET-LICENCES.md"), "docs/ASSET-LICENCES.md missing");
check("[R8T-legal] play/index.html equals dist/index.html (CI check)", existsSync("play/index.html") && readFileSync("play/index.html", "utf8") === html, existsSync("play/index.html") ? "differs (expected until the orchestrator copies the new build)" : "missing");
const files = ["package.json"]; const pj = JSON.parse(readFileSync("package.json", "utf8"));
check("[R8T-legal] no runtime dependencies (only dev: esbuild, playwright)", !pj.dependencies || Object.keys(pj.dependencies).length === 0, pj.dependencies);
// personal data / dev paths in the build
const leaks = [/\/home\/\w+/, /\/tmp\//, /C:\\Users/i, /@gmail\.com/i, /localhost:\d+/].filter((r) => r.test(html)).map(String);
check("[R8T-legal] no local paths, mail addresses or localhost URLs in dist", leaks.length === 0, leaks);
check("[R8T-size] no source map reference", !/sourceMappingURL/.test(html), null);
finish("r8t-scan");
