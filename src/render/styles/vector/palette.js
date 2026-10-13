// Style "C2": stylised vector, graded dark. Bold ink outlines, flat colour with one shade level,
// rim-lit actors. Values come from docs/product/variants/art-direction/C2.html (frozen, decision.md).
export const palette = {
  ink: "#0d0a1c",
  rim: "#9fb6e8",
  // Floors stay indigo; the darkness mask does the moody part. Edge lines keep the floor readable beyond the light.
  floors: {
    corridor: ["#2b3263", "#323a72"],
    cubicle: ["#343d73", "#3c467f"],
    conference: ["#2b4a78", "#335584"],
    copy: ["#4b3a62", "#554170"],
    storage: ["#3a3f68", "#434974"],
  },
  floorEdge: "rgba(150,165,255,0.2)",
  wall: { top: "#1d5662", left: "#2d8a92", right: "#237681", band: "#18505a", base: "#143c48", trim: "#b89040", trimDark: "#8a6a28", rim: "#9ff0ee" },
  decal: { stain: "#1c1838", coffee: "#3a2530", blood: "#6a1530" },
  glow: "#ffb36b",
  hp: "#e0363f", mp: "#3f8cf0",
  skin: "#f6c49c", zombie: "#6cae6c", paper: "#ece4cf",
  // Rarity colours (Okabe-Ito): blue Magic, yellow Rare, vermillion Unique. Used from S2 (loot); kept here so the palette is one file.
  rarity: { magic: "#56b4e9", rare: "#f0e442", unique: "#e8590c" },
  // Per-actor rim colours (2 px silhouette ring baked into the atlas sprite).
  rims: { clerk: "#e6fbff", "zombie-intern": "#a6e65a", "printer-imp": "#ff5a46" },
  // Light pools: [colour, additive alpha at the centre]
  pools: {
    monitor: ["#45d9ff", 0.2],
    fluor: ["#9bf5d0", 0.2],
    lamp: ["#ff3a2a", 0.2],
  },
  actorLights: { "printer-imp": "lamp" }, // monsters that carry a coloured light
  dark: "rgba(7,5,24,0.86)",
  // Plates: background and text colours; contrast of text on plate is unit-tested (>= 4.5:1).
  plate: { bg: "#1a1436", text: "#f3eefc", edge: "#0d0a1c", hp: "#ff4a52", hpTrack: "#3a1226" },
  plateHc: { bg: "#000000", text: "#ffffff", edge: "#ffffff", hp: "#ff6b73", hpTrack: "#2a2a2a" },
  ui: { panel: "#1a1436", panelEdge: "#0d0a1c", slot: "#251d4a", slotEdge: "#8a7fd0", empty: "#c9c3ec", text: "#f3eefc", subtle: "#c9c3ec", xp: "#ffc93a" },
};

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
export function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
