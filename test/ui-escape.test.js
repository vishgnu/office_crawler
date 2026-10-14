// CR-02 (blocking): every id and name that can come from a save file or an imported character must reach markup escaped.
// The builders are pure strings, so the test feeds them hostile values and parses the result attribute by attribute.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itemBoxHtml, rowItemHtml, nameLineHtml } from "../src/ui/panels.js";
import { nodeTipHtml, rowsHtml } from "../src/ui/tree.js";
import { T } from "../src/ui/text.js";

const HOSTILE = [`x" onmouseover="alert(1)`, `x' onfocus='alert(1)`, `"><img src=x onerror=alert(1)>`, `</li><script>alert(1)</script>`, `a&quot;b`];

/** Tokenise every start tag; returns [{tag, attrs: Map}] and fails when a tag does not parse cleanly (a breakout shows up as an odd attribute). */
function tags(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    const attrs = new Map();
    for (const a of m[2].matchAll(/\s+([\w:-]+)(?:="([^"]*)")?/g)) attrs.set(a[1], a[2] ?? "");
    out.push({ tag: m[1], attrs });
  }
  // any "<" that is not the start of a tag we parsed (or a closing tag) means the markup was broken open
  const stray = html.replace(/<\/[a-zA-Z][\w-]*>/g, "").replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>/g, "").match(/<[^<>]*$|<(?![^<>]*>)/);
  assert.equal(stray, null, `stray markup in ${html.slice(0, 200)}`);
  return out;
}
const decode = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const noHandlers = (html) => { for (const t of tags(html)) for (const k of t.attrs.keys()) assert.ok(!/^on/i.test(k), `event attribute ${k} in <${t.tag}>`); assert.ok(!/<script/i.test(html)); assert.ok(!/<img/i.test(html)); };

test("a hostile item id cannot leave its attribute (data-tip, data-item, sell and stash buttons)", () => {
  for (const id of HOSTILE) {
    const it = { id, name: `Name ${id}`, rarity: "magic", base: "stapler", w: 1, h: 2 };
    const row = rowItemHtml(it, `inv:${id}`, "", `main ${id}`);
    const rowTags = tags(row);
    const li = rowTags.find((t) => t.tag === "li");
    assert.equal(decode(li.attrs.get("data-tip")), `inv:${id}`, "the tip key round-trips as one attribute value");
    assert.deepEqual([...li.attrs.keys()], ["class", "data-tip"], "no extra attributes on the row");
    noHandlers(row);
    const box = itemBoxHtml(it, { pos: { x: 1, y: 2 }, cls: "dim origin" });
    noHandlers(box);
    assert.equal(decode(tags(box).find((t) => t.tag === "span").attrs.get("data-item")), id);
    noHandlers(nameLineHtml(it));
  }
});

test("hostile rarity and numbers are neutralised too (they come from the same save file)", () => {
  const it = { id: "ok", name: "n", rarity: `rare" onmouseover="alert(1)`, base: "stapler", w: `1" onclick="x`, h: "2;background:url(x)" };
  const html = rowItemHtml(it, "stash:ok", "", "") + itemBoxHtml(it, { pos: { x: `1" onclick="x`, y: 0 } });
  noHandlers(html);
});

test("skill tree tooltips escape values and names", () => {
  const n = { name: `<b onmouseover=alert(1)>N</b>`, kind: "active", tier: 1, level: 1, maxLevel: 5, bonus: 0, signature: false, textKey: "x", cost: { mana: 3 }, now: [{ labelKey: "statDamage", value: `<i>1</i>` }], next: [], requires: [{ met: false, name: `"><script>`, level: 1 }], reqLevel: 1, lockReason: `<u>locked</u>` };
  const html = nodeTipHtml(n);
  assert.ok(!/<b onmouse|<i>|<script|<u>/.test(html), html);
  assert.ok(!rowsHtml([{ labelKey: "statDamage", value: "<i>1</i>", type: `x" onmouseover="y` }]).includes('" onmouseover="'));
});

test("static audit: every id interpolated into panels.js and tree.js markup goes through esc()", () => {
  for (const f of ["panels.js", "tree.js"]) {
    const src = readFileSync(new URL(`../src/ui/${f}`, import.meta.url), "utf8");
    const bare = [...src.matchAll(/(?<!inv:|stash:)\$\{(?!esc\()([A-Za-z_.]*\.(?:id|name|base|rarity|class))\}/g)].map((m) => m[1]);
    // `inv:${it.id}` and `stash:${it.id}` are tip keys handed to rowItemHtml, which escapes them (tested above). `${it.name}` is allowed in aria-label strings that are passed through esc() as a whole (itemLabel) and in plain-text template literals
    const risky = bare.filter((x) => /\.id$/.test(x));
    assert.deepEqual(risky, [], `${f}: unescaped id interpolations`);
  }
});

test("every save notice key of the contract has a text", () => {
  for (const k of ["no-active-slot", "pre-switch-save-failed", "migration-failed", "generic"]) assert.ok(T.notices[k]?.length > 10, k);
  for (const k of ["svMemory", "svTakeOver", "svTakeTitle", "svTakeYes", "svDismiss", "slLoadTitle", "slLoadText"]) assert.ok(T[k]?.length > 3, k);
  assert.equal(T.svMemory, "Saving is off in this browser");
});
