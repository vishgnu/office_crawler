import { questEvent } from "./systems/quests.js"; // cycle with systems/quests.js is benign: both sides only call each other inside functions
// Events are plain data for audio, FX and tests. `events` holds this tick's, `eventLog` the last 256.
export function emit(state, event) {
  state.events.push(event);
  state.eventLog.push(event);
  if (state.eventLog.length > 256) state.eventLog.shift();
  questEvent(state, event); // the quest step machine (ADR-0007): every event, also from cheats and loaders
}
