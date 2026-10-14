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
    clerk: "#e6fbff", "facilities-manager": "#ffe9a8", "sales-rep": "#ffd0e4", "it-wizard": "#b8f6ff", "ally.intern": "#cfe8ff", "ally.cone": "#ffd0a0", "zombie-intern": "#a6e65a", "printer-imp": "#ff5a46",
    "temp-worker": "#ffb35a", "printer-demon": "#ff3d6e", "middle-manager": "#fff0d0", "vending-machine": "#58e0ff", consultant: "#e4dcff", auditor: "#d4ff7a",
    "regional-director": "#ffd24a", "regional-director-rage": "#ff4a3a",
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
      dark: "rgba(34,12,22,0.55)",
    },
    basement: {
      floors: { corridor: ["#2b3a49", "#354757"], server: ["#243b50", "#2e5066"], archive: ["#363a4c", "#41465c"], boiler: ["#38322d", "#473f38"], storage: ["#303a48", "#3b4859"] },
      floorEdge: "rgba(120,200,255,0.17)",
      wall: { top: "#34414d", left: "#566878", right: "#3f4e5c", band: "#2b3640", base: "#1d252d", trim: "#6a7886", trimDark: "#47525d", rim: "#bfe4ff" },
      dark: "rgba(8,14,32,0.88)",
    },
    // The Executive Suite (S3): plush wine carpet, mahogany panelling with gold trim, glass walls onto a city at night. Moody, the climactic room.
    executive: {
      floors: { corridor: ["#2c1a2e", "#35203a"], boardroom: ["#3a1b30", "#47233b"], storage: ["#2c1a2e", "#35203a"] },
      floorEdge: "rgba(255,190,120,0.16)",
      wall: { top: "#2a1612", left: "#6a3426", right: "#4a2219", band: "#351a14", base: "#24110e", trim: "#e0b04a", trimDark: "#9a7428", rim: "#ffd9a0" },
      glass: { sky: "#0b1230", sky2: "#1c2a5c", frame: "#c9a050", light: "#ffd98a", light2: "#7fe0ff", moon: "#f4f0ff" },
      dark: "rgba(8,4,14,0.8)",
    },
  },
  // Scene tables (G round, item 6): per theme, which material each floor kind and wall carries, the wall-base glow colour and the tile joint. The four themes share one engine
  // (tiles.js / props.js / light.js); changing a scene is a change in this table. Texture entries are [name, alpha] (textures.js).
  scenes: {
    "open-plan": { // teal fluorescent office
      glow: "#2ad6c8", joint: "rgba(8,6,20,0.55)",
      floorTex: { default: ["weaveB", 0.95], cubicle: ["weaveA", 1], conference: ["weaveC", 0.95], copy: ["weaveB", 0.9], storage: ["concrete", 0.9] },
      wallTex: ["plaster", 0.9], panelTex: ["panel", 0.7],
    },
    lobby: { // warm brass and marble
      glow: "#e0a050", joint: "rgba(10,6,22,0.5)",
      floorTex: { default: ["weaveC", 0.8], reception: ["marble", 1], breakroom: ["concrete", 0.55] },
      wallTex: ["plaster", 0.9], panelTex: ["wood", 0.55],
    },
    basement: { // cold concrete, rust and steel
      glow: "#e0703a", joint: "rgba(4,8,20,0.7)",
      floorTex: { default: ["concrete", 1], boiler: ["metal", 0.9], server: ["metal", 0.8], archive: ["paper", 0.8], storage: ["concrete", 1] },
      wallTex: ["concrete", 1], panelTex: ["metal", 0.7],
    },
    executive: { // burgundy carpet and mahogany
      glow: "#c0305a", joint: "rgba(10,2,14,0.55)",
      floorTex: { default: ["weaveB", 1], boardroom: ["weaveA", 1], storage: ["weaveB", 1] },
      wallTex: ["panel", 1], panelTex: ["wood", 0.8],
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
    desklamp: ["#ffb347", 0.22], // executive: brass desk lamp
    screen: ["#7fd0ff", 0.17],   // executive: the quarterly results screen
    chandelier: ["#ffcf8a", 0.16], // executive: a dim ceiling light over the middle of the room
    exit: ["#4dff9a", 0.2],     // the green pool of an exit sign over the stairs (static)
    shaft: ["#a8c8ff", 0.2],    // window light falling across the floor (static)
    boss: ["#ffeccc", 0.1],     // the Regional Director's aura (phase 1)
    rage: ["#ff3a2a", 0.18],      // phase 2: red
  },
  actorLights: { "printer-imp": "lamp", "printer-demon": "lamp", "regional-director": "boss" }, // monsters that carry a coloured light
  dark: "rgba(24,9,20,0.86)", // round G fix: a warm plum shift of the far half (hue, not lift)
  // Boss telegraphs (colour-blind safe: each kind also has its own shape and a fill that grows; the colours are Okabe-Ito vermillion, yellow and sky blue)
  telegraph: { slam: "#ff6a1f", volley: "#f0e442", summon: "#56b4e9", edge: "#0d0a1c" },
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
