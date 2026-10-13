import { test } from "node:test";
import assert from "node:assert/strict";
import { advance } from "../src/core/clock.js";
import { config } from "../src/core/index.js";

const feed = (deltas) => deltas.reduce((s, dt) => { const r = advance(s.acc, dt, config.tickHz); return { acc: r.acc, ticks: s.ticks + r.ticks }; }, { acc: 0, ticks: 0 });

test("AC-R-113-1 any chunking of the same elapsed time gives the same tick count", () => {
  const a = [16, 17, 33, 100, 5, 16, 16, 17, 250, 3, 1, 1000, 7];
  const T = a.reduce((x, y) => x + y, 0);
  const b = [T]; // one big frame
  const c = Array(T).fill(1); // T one-millisecond frames
  const expected = Math.floor((T * config.tickHz) / 1000);
  assert.equal(feed(a).ticks, expected);
  assert.equal(feed(b).ticks, expected);
  assert.equal(feed(c).ticks, expected);
  assert.equal(feed(a).acc, feed(c).acc);
});
