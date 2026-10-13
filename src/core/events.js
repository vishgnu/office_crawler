// Events are plain data for audio, FX and tests. `events` holds this tick's, `eventLog` the last 256.
export function emit(state, event) {
  state.events.push(event);
  state.eventLog.push(event);
  if (state.eventLog.length > 256) state.eventLog.shift();
}
