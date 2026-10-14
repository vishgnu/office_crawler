// Sprite store: every sprite is pre-rendered once into its own offscreen canvas.
// Entries are in logical units (the canvas is drawn at `scale` x for sharpness on large screens).
// Flash / shade / tint silhouettes (hit flash, lighting actors) are built lazily and cached on the entry,
// so the per-frame lookups allocate nothing.
function silhouette(e, colour, alpha, mode) {
  const cache = (e.sil ??= {}), ck = mode + colour;
  let s = cache[ck];
  if (!s) {
    const img = document.createElement("canvas");
    img.width = e.img.width; img.height = e.img.height;
    const g = img.getContext("2d");
    g.drawImage(e.img, 0, 0);
    g.globalCompositeOperation = mode;
    g.fillStyle = colour; g.globalAlpha = alpha;
    g.fillRect(0, 0, img.width, img.height);
    s = { ...e, img, sil: null };
    cache[ck] = s;
  }
  return s;
}

/**
 * Outline ring of a sprite in `colour`, `px` logical px wide, baked once per sprite and colour (champion outlines: one blit per frame
 * instead of a ring of silhouette stamps). Same size and anchor as the sprite; draw it under the sprite itself.
 */
function outline(e, colour, px) {
  const cache = (e.sil ??= {}), ck = `ol${colour}${px}`;
  let o = cache[ck];
  if (!o) {
    const sil = silhouette(e, colour, 1, "source-in"), img = document.createElement("canvas");
    img.width = e.img.width; img.height = e.img.height;
    const g = img.getContext("2d"), r = px * (e.img.width / e.w);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.drawImage(sil.img, Math.cos(a) * r, Math.sin(a) * r); }
    o = { ...e, img, sil: null };
    cache[ck] = o;
  }
  return o;
}

let atlasCounter = 0;
export function createAtlas(scale = 1, meta = {}) {
  const map = new Map();
  const self = {
    scale, meta: { ...meta, id: ++atlasCounter },
    /** draw(g, scale): g is already scaled to logical units; scale is given for pixel-exact work. */
    add(key, w, h, ox, oy, draw) {
      const img = document.createElement("canvas");
      img.width = Math.ceil(w * scale); img.height = Math.ceil(h * scale);
      const g = img.getContext("2d");
      g.scale(scale, scale);
      draw(g, scale);
      map.set(key, { key, img, w: img.width / scale, h: img.height / scale, ox, oy, sil: null });
    },
    /** Like add(), but the sprite is only drawn on its first get() (boss sprites: large canvases, only the frames a fight shows). */
    addLazy(key, w, h, ox, oy, draw) { map.set(key, { lazy: () => self.add(key, w, h, ox, oy, draw) }); },
    get(key) {
      const e = map.get(key);
      if (e && e.lazy) { e.lazy(); return map.get(key); }
      return e;
    },
    has: (key) => map.has(key),
    keys: () => [...map.keys()],
    /** White silhouette of a sprite entry (hit flash). */
    flash: (e) => silhouette(e, "rgba(255,255,255,0.78)", 1, "source-atop"),
    /** Solid silhouette in `colour`: drawn over an actor at an alpha to dim it where the light mask is dark. */
    shade: (e, colour) => silhouette(e, colour, 1, "source-in"),
    outline,
    /** Same, used for pool-coloured tint (a separate cache slot so shade and tint never collide). */
    tint: (e, colour) => silhouette(e, colour, 1, "source-in"),
  };
  return self;
}
