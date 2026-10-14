// The UI may not import render/ (layering rule N5), so the shell hands the class figure painter and the accent colours over at boot (main.js).
export const figures = { draw: () => false, accent: {} };
export const provideFigures = (p) => { figures.draw = p.draw; figures.accent = p.accent; };
