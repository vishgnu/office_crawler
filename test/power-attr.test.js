// CR6-15: a typo in a class's powerAttr would make the weapon damage NaN; every class and the config default name a real attribute.
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content } from "../src/core/index.js";

test("config.derived.powerAttr and every class's derived.powerAttr are one of the four attributes", () => {
  const A = ["grit", "agility", "stamina", "focus"];
  assert.ok(A.includes(config.derived.powerAttr));
  for (const c of content.classes) assert.ok(A.includes(c.derived?.powerAttr ?? config.derived.powerAttr), `${c.id}: ${c.derived?.powerAttr}`);
});
