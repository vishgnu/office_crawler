// The UI may not import render/ (layering rule N5), so the shell hands the class figure painter and the accent colours over at boot (main.js).
export const figures = { draw: () => false, accent: {}, look: () => "-|-|-|-|-|-" };
// R8 (ADR-0008): `look(equipment)` returns the gear signature the figure painter takes as its `look` option (render/gearlooks.js gearSignature); the shell wires it.
export const provideFigures = (p) => { figures.draw = p.draw; figures.accent = p.accent; if (typeof p.look === "function") figures.look = p.look; };
