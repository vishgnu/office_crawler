// Semantic sprite keys (pure, style-neutral). The renderer and every style agree on these only.
// Key shapes follow ADR-0002 section 7 (simplified: a state-independent frame count per anim).
export const ANIMS = { idle: 4, walk: 6, attack: 4, death: 4 };
// The hero also has a cast pose (S2): arms thrust forward while a skill fires. Monsters have no cast frames.
export const PLAYER_ANIMS = { ...ANIMS, cast: 4 };
export const DIRS = 8;
// Room kinds of every theme (open-plan, lobby, basement). Each theme draws all of them (kinds it does not use fall back to its corridor look).
export const FLOOR_KINDS = ["corridor", "cubicle", "conference", "copy", "storage", "reception", "breakroom", "server", "archive", "boiler"];
// Floor variants 0-2 are clean (plain, inset panel, seam); 3-5 carry baked grime (scuffs, coffee stain, blood).
export const FLOOR_VARIANTS = 6;
// Wall variants: 0 clean, 1 smear, 2 splatter.
export const WALL_VARIANTS = 3;
export const MARKERS = ["door", "stairs-up", "stairs-down"];
export const FX_IDS = ["alert", "paper", "shadow", "muted", "flee", "spark", "plus", "elevator", "portal"];
export const PROJECTILES = ["stapler", "toner", "slide"];
export const LOOT_IDS = ["item", "gold-s", "gold-m", "gold-l"];
export const NPC_FRAMES = 4;
export const UI_IDS = ["vessel-health", "vessel-mana", "skill-slot", "belt-slot", "skill-icon-strike", "icon-plus"];
export const PLAYER_CLASS = "clerk";

// Direction index from a tile delta; 0 = towards the viewer, then clockwise on screen.
const DIR_BY_DELTA = { "1,1": 0, "0,1": 1, "-1,1": 2, "-1,0": 3, "-1,-1": 4, "0,-1": 5, "1,-1": 6, "1,0": 7 };
export const DIR_VEC = [[0, 1], [-0.89, 0.45], [-1, 0], [-0.89, -0.45], [0, -1], [0.89, -0.45], [1, 0], [0.89, 0.45]];
export const dirIndex = (dx, dy, fallback = 0) => DIR_BY_DELTA[`${Math.sign(dx)},${Math.sign(dy)}`] ?? fallback;

export const keys = {
  floor: (theme, kind, v) => `tile:${theme}:floor-${kind}:${v}`,
  marker: (theme, id) => `tile:${theme}:${id}`,
  wall: (theme, mask, v = 0) => `wall:${theme}:${mask}:${v}`,
  prop: (id) => `prop:${id}`,
  mon: (type, anim, dir, frame) => `mon:${type}:${anim}:${dir}:${frame}`,
  plr: (cls, anim, dir, frame) => `plr:${cls}:${anim}:${dir}:${frame}`,
  npc: (id, frame) => `npc:${id}:${frame}`,
  proj: (kind) => `proj:${kind}`,
  loot: (id) => `loot:${id}`,
  slash: (dir) => `fx:slash:${dir}`,
  fx: (id) => `fx:${id}`,
  ui: (id) => `ui:${id}`,
};

/** Every key a style must provide for the given content registries. */
export function requiredKeys({ themes, props, monsters, npcs = {} }) {
  const out = [];
  for (const theme of Object.keys(themes)) {
    for (const kind of FLOOR_KINDS) for (let v = 0; v < FLOOR_VARIANTS; v++) out.push(keys.floor(theme, kind, v));
    for (const m of MARKERS) out.push(keys.marker(theme, m));
    for (let mask = 0; mask < 16; mask++) for (let v = 0; v < WALL_VARIANTS; v++) out.push(keys.wall(theme, mask, v));
  }
  for (const id of Object.keys(props)) out.push(keys.prop(id));
  const figure = (build) => { for (const [anim, n] of Object.entries(ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) out.push(build(anim, d, f)); };
  for (const type of Object.keys(monsters)) figure((a, d, f) => keys.mon(type, a, d, f));
  for (const [anim, n] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) out.push(keys.plr(PLAYER_CLASS, anim, d, f));
  for (const id of Object.keys(npcs)) for (let f = 0; f < NPC_FRAMES; f++) out.push(keys.npc(id, f));
  for (const k of PROJECTILES) out.push(keys.proj(k));
  for (const id of LOOT_IDS) out.push(keys.loot(id));
  for (let d = 0; d < DIRS; d++) out.push(keys.slash(d));
  for (const id of FX_IDS) out.push(keys.fx(id));
  for (const id of UI_IDS) out.push(keys.ui(id));
  return out;
}
