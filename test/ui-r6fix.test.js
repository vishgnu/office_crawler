// R6 fix round (UI): the attribute hints follow the class's power attribute (CR6-01), the respec dialog is modal (CR6-08),
// nothing-to-respec is a disabled button with a hint (ADV-R6-02), castRefused has a throttled toast (CR6-07), the save v3 notice text exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, setLevel, config, classById, content } from "../src/core/index.js";
import { renderTree } from "../src/ui/tree.js";
import { attrHint } from "../src/ui/panels.js";
import { messageFor } from "../src/ui/messages.js";
import { T } from "../src/ui/text.js";
import { noticeText } from "../src/ui/savestatus.js";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

test("CR6-01 only the class's power attribute is hinted as raising damage, with that class's own numbers", () => {
  for (const c of content.classes) {
    const power = c.derived?.powerAttr ?? config.derived.powerAttr;
    for (const k of ["grit", "agility", "stamina", "focus"]) {
      const h = attrHint(c.id, k);
      assert.equal(/damage/.test(h.text), k === power && /raises damage/.test(h.text) || (k === "grit" && k !== power && /no damage/.test(h.text)), `${c.id} ${k}: ${h.text}`);
      assert.equal(/adds .* damage/.test(h.tip), k === power, `${c.id} ${k} tooltip: ${h.tip}`);
    }
    const d = { ...config.derived, ...c.derived }, per = String(Math.round(d.damagePerGrit.min * 100) / 100);
    assert.ok(attrHint(c.id, power).tip.includes(`${per} damage`) && attrHint(c.id, power).tip.includes(`above ${d.gritFree}`), `${c.id}: numbers come from the class data`);
  }
  assert.match(attrHint("it-wizard", "focus").text, /damage and mana/);
  assert.match(attrHint("sales-rep", "agility").text, /damage and defense/);
  assert.equal(attrHint("facilities-manager", "grit").text, T.raisesDamage);
});

test("CR6-08 the respec dialog is modal and described, the tier labels are readable, nodes name tier and prerequisites", () => {
  const s = newGame(1, { class: "facilities-manager", name: "Tree Tester", start: "town", wearStartKit: true }); setLevel(s, 20);
  const html = renderTree(s, { confirmRespec: true });
  if (/respec-confirm/.test(html)) assert.match(html, /role="alertdialog" aria-modal="true" aria-labelledby="rs-title" aria-describedby="rs-text"/);
  assert.ok(!/class="tl"[^>]*aria-hidden/.test(html));
  assert.match(html, /aria-label="[^"]*Tier 2\.[^"]*Needs: /);
  assert.match(html, /class="tn-req"/);
});

test("ADV-R6-02 gold and once modes: nothing learned means a disabled Respec with the reason as hint", () => {
  const old = config.respec.mode;
  try {
    for (const mode of ["gold", "once"]) {
      config.respec.mode = mode;
      const s = newGame(1, { class: "it-wizard", name: "Tree Tester", start: "town", wearStartKit: true }); setLevel(s, 12); s.player.gold = 9999;
      const html = renderTree(s);
      assert.match(html, /data-respec="1"[^>]*disabled/, mode);
      assert.ok(html.includes(T.trRespecFail["nothing-to-respec"]), mode);
    }
  } finally { config.respec.mode = old; }
});

test("CR6-07 castRefused: a line per reason, throttled when the key is held; unknown reasons stay silent", () => {
  const s = newGame(1, { start: "town" });
  assert.equal(messageFor({ type: "castRefused", skill: "x", reason: "no-direction" }, s), T.castRefused["no-direction"]);
  assert.equal(messageFor({ type: "castRefused", skill: "x", reason: "no-direction" }, s), null, "second one inside the window");
  assert.equal(messageFor({ type: "castRefused", skill: "x", reason: "no-target" }, s), T.castRefused["no-target"], "another reason is its own line");
  assert.equal(messageFor({ type: "castRefused", skill: "x", reason: "bogus" }, s), null);
  for (const r of ["no-direction", "no-mana", "cooldown", "no-target", "silenced"]) assert.ok(T.castRefused[r], r);
});

test("save v3 notice text and the connector / focus rules", () => {
  assert.equal(noticeText({ notice: "attributes-refunded", noticeAttr: "focus" }), "Your attribute points were refunded because your class now scales from Focus. Spend them again in the Employee File.");
  assert.match(noticeText({ notice: "attributes-refunded", noticeAttr: "agility" }), /from Agility\./);
  assert.match(noticeText({ notice: "attributes-refunded" }), /a different attribute/);
  assert.ok(!/marked/.test(noticeText({ notice: "attributes-refunded" })));
  assert.equal(noticeText({ notice: "generic" }), T.notices.generic);
  assert.match(css, /var\(--span\) \* \(100% \+ var\(--gx\) \+ 4px\)/);
});
