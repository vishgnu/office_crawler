import { createRng } from "./rng.js";

const seed = Number(new URLSearchParams(location.search).get("seed")) || Date.now();
const rng = createRng(seed);
const state = { seed, roll: rng.int(1, 6) };
document.getElementById("app").textContent = `Hello from a static app. Seed ${seed}, roll ${state.roll}.`;
// Test hook for agents (see CLAUDE.md)
window.__app = { state: () => structuredClone(state) };
