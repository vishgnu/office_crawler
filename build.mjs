// Bundles src/main.js (+ CSS) into ONE self-contained dist/index.html.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const js = await build({ entryPoints: ["src/main.js"], bundle: true, minify: true, format: "iife", write: false, target: "es2022" });
const css = readFileSync("src/style.css", "utf8");
const shell = readFileSync("src/index.html", "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = shell.replace("/*STYLE*/", () => css).replace("/*SCRIPT*/", () => code);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
console.log(`dist/index.html ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
