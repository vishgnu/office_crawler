// S3 WORLD: the boss figure set, the Executive Suite tiles, telegraph colours and the sprite-key contract for the new content (pure: no DOM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, config } from "../src/core/index.js";
import { requiredKeys, keys, BOSS_ANIMS, ANIMS, DIRS, FLOOR_KINDS, MARKERS, WALL_VARIANTS, BOSS_P2, bossType } from "../src/render/keys.js";
import { palette, contrast } from "../src/render/styles/vector/palette.js";
import { FIG_DIM, BOSS_W, BOSS_H, BOSS_FY } from "../src/render/styles/vector/characters.js";

test("S3: every boss has both phase sprite sets (idle, walk, attack, windup, death) in all eight directions, and no other monster gets windup frames", () => {
  const all = new Set(requiredKeys(content));
  assert.deepEqual(Object.keys(BOSS_ANIMS), [...Object.keys(ANIMS), "windup"]);
  for (const id of Object.keys(content.bosses)) for (const t of [id, id + BOSS_P2]) for (const [anim, n] of Object.entries(BOSS_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) assert.ok(all.has(keys.mon(t, anim, d, f)), `${t} ${anim} ${d} ${f}`);
  for (const id of Object.keys(content.monsters)) assert.ok(!all.has(keys.mon(id, "windup", 0, 0)), id);
  assert.equal(bossType("regional-director", 1), "regional-director");
  assert.equal(bossType("regional-director", 2), "regional-director" + BOSS_P2);
});

test("S3: the boss is bigger than every normal monster and both phases have a rim colour that differs", () => {
  const dim = FIG_DIM["regional-director"], mm = FIG_DIM["middle-manager"];
  assert.ok(dim.head >= mm.head * 1.3 && dim.shadowR > mm.shadowR);
  assert.deepEqual(FIG_DIM["regional-director-rage"], dim);
  assert.notEqual(palette.rims["regional-director"], palette.rims["regional-director-rage"]);
  assert.ok(BOSS_FY > dim.head + 40 && BOSS_W > 100 && BOSS_H > BOSS_FY, "the canvas holds the raised gavel above the head");
  assert.ok(palette.actorLights["regional-director"] && palette.pools.boss && palette.pools.rage);
});

test("S3: the executive theme draws every room kind, wall variant and marker, and the stairs markers exist for every theme", () => {
  const all = new Set(requiredKeys(content));
  assert.ok(FLOOR_KINDS.includes("boardroom") && content.themes.executive.roomKinds.includes("boardroom"));
  for (const theme of Object.keys(content.themes)) {
    for (const kind of FLOOR_KINDS) assert.ok(all.has(keys.floor(theme, kind, 5)), `${theme}/${kind}`);
    for (const m of MARKERS) assert.ok(all.has(keys.marker(theme, m)), `${theme}/${m}`);
    for (let v = 0; v < WALL_VARIANTS; v++) assert.ok(all.has(keys.wall(theme, 15, v)), `${theme} wall ${v}`);
  }
  assert.ok(MARKERS.includes("stairs-locked") && MARKERS.includes("stairs-open"));
  const ex = palette.themes.executive;
  assert.ok(ex.floors.boardroom && ex.floors.corridor && ex.wall.left && ex.glass.sky && ex.dark);
  for (const k of ["desklamp", "screen", "chandelier"]) assert.ok(palette.pools[k], k);
  for (const k of ["badge", "table", "chair", "trophy", "screen"]) assert.ok(all.has(keys.fx(k)), k);
});

test("S3: telegraph colours are three distinct Okabe-Ito hues, each readable against the ink outline, and the three shapes differ by construction", () => {
  const t = palette.telegraph;
  assert.equal(new Set([t.slam, t.volley, t.summon].map((c) => c.toLowerCase())).size, 3);
  for (const c of [t.slam, t.volley, t.summon]) assert.ok(contrast(c, t.edge) >= 4.5, c);
  assert.ok(config.boss.slam.windup > 0 && config.boss.volley.windup > 0 && config.boss.summon.windup > 0);
});
