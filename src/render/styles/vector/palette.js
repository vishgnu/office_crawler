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
  rims: {
    clerk: "#e6fbff", "zombie-intern": "#a6e65a", "printer-imp": "#ff5a46",
    "temp-worker": "#ffb35a", "printer-demon": "#ff3d6e", "middle-manager": "#ffd2a0", "vending-machine": "#58e0ff", consultant: "#d6c8ff", auditor: "#b8f060",
    "npc-vendor": "#ffe08a", "npc-healer": "#9ff5d8", "npc-potions": "#9fe08a", "npc-stash": "#bcd0ff",
  },
  // Champion outline (distinct from every rim, rarity and the hero ring): reddish purple, Okabe-Ito.
  champion: "#cc79a7",
  // Per-theme tiles and darkness. The open-plan theme uses the base `floors` / `wall` above.
  themes: {
    lobby: {
      floors: { corridor: ["#3d3550", "#463d5c"], reception: ["#4a3f5a", "#5a4d6e"], breakroom: ["#2f4f58", "#386068"] },
      floorEdge: "rgba(255,214,160,0.16)",
      wall: { top: "#4d3d5a", left: "#8b6a7a", right: "#6a4f63", band: "#3c2f48", base: "#2d2238", trim: "#d4a64a", trimDark: "#9a7428", rim: "#ffe3b8" },
      dark: "rgba(14,8,26,0.55)",
    },
    basement: {
      floors: { corridor: ["#1f2a36", "#273542"], server: ["#1b2d3d", "#24404f"], archive: ["#2a2d3a", "#33374a"], boiler: ["#2b2724", "#38322d"], storage: ["#242b36", "#2d3644"] },
      floorEdge: "rgba(120,200,255,0.17)",
      wall: { top: "#34414d", left: "#566878", right: "#3f4e5c", band: "#2b3640", base: "#1d252d", trim: "#6a7886", trimDark: "#47525d", rim: "#bfe4ff" },
      dark: "rgba(3,7,18,0.92)",
    },
  },
  proj: { stapler: "#c9d2e4", toner: "#17131f", tonerGlow: "#ff3d6e", slide: "#fffaf0", slideEdge: "#5b8cff" },
  // Light pools: [colour, additive alpha at the centre]
  pools: {
    monitor: ["#45d9ff", 0.2],
    fluor: ["#9bf5d0", 0.2],
    lamp: ["#ff3a2a", 0.2],
    warm: ["#ffd29a", 0.2],   // lobby: warm lamp
    cold: ["#8fb8ff", 0.22],  // basement: cold flickering tube
    rack: ["#35e0c8", 0.2],   // basement: server rack LEDs
    gen: ["#ff9a3a", 0.2],    // basement: generator work light
  },
  actorLights: { "printer-imp": "lamp", "printer-demon": "lamp" }, // monsters that carry a coloured light
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
