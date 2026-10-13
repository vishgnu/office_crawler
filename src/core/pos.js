// Float position of an actor: its tile plus the progress of the step in progress.
export function posOf(a) {
  const f = a.next ? a.moveT / a.moveTotal : 0;
  return { x: a.tile.x + ((a.next?.x ?? a.tile.x) - a.tile.x) * f, y: a.tile.y + ((a.next?.y ?? a.tile.y) - a.tile.y) * f };
}
