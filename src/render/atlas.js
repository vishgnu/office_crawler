// Sprite store: every sprite is pre-rendered once into its own offscreen canvas.
// Entries are in logical units (the canvas is drawn at `scale` x for sharpness on large screens).
export function createAtlas(scale = 1) {
  const map = new Map(), flashes = new Map();
  return {
    scale,
    add(key, w, h, ox, oy, draw) {
      const img = document.createElement("canvas");
      img.width = Math.ceil(w * scale); img.height = Math.ceil(h * scale);
      const g = img.getContext("2d");
      g.scale(scale, scale);
      draw(g);
      map.set(key, { img, w: img.width / scale, h: img.height / scale, ox, oy });
    },
    get: (key) => map.get(key),
    has: (key) => map.has(key),
    keys: () => [...map.keys()],
    /** White silhouette of a sprite (hit flash), built on first use. */
    flash(key) {
      let e = flashes.get(key);
      if (!e) {
        const s = map.get(key);
        if (!s) return null;
        const img = document.createElement("canvas");
        img.width = s.img.width; img.height = s.img.height;
        const g = img.getContext("2d");
        g.drawImage(s.img, 0, 0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgba(255,255,255,0.78)";
        g.fillRect(0, 0, img.width, img.height);
        e = { ...s, img };
        flashes.set(key, e);
      }
      return e;
    },
  };
}
