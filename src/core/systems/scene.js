// Scene transitions. S1 has floor <-> dead; the killing blow already sets the scene (combat.js),
// this is the safety net that keeps the invariants.
export function scene(state) {
  const p = state.player;
  p.hp = Math.min(p.hpMax, Math.max(0, p.hp));
  if (p.hp === 0 && (state.scene === "floor" || state.scene === "town")) { p.action = "dead"; state.scene = "dead"; }
}
