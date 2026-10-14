import { questEvent } from "./systems/quests.js"; // cycle with systems/quests.js is benign: both sides only call each other inside functions
// Events are plain data for audio, FX and tests. `events` holds this tick's, `eventLog` the last 256.
// quest.* events (R7) do not count towards the 256: the window of every other event is exactly the window a build without quests keeps, so
// stripping the quest.* entries from `eventLog` gives the pre-quest log for any run length (CR7-02). Quest entries older than the oldest kept
// other event are dropped with it, and at most MAX_QUEST_LOG of them are kept.
const WINDOW = 256, MAX_QUEST_LOG = 64;
const isQuest = (e) => typeof e.type === "string" && e.type.charCodeAt(0) === 113 && e.type.startsWith("quest."); // 113 = "q": a cheap first test, this runs for every entry on a full log

export function emit(state, event) {
  state.events.push(event);
  const log = state.eventLog;
  log.push(event);
  if (log.length > WINDOW) trimLog(log, isQuest(event));
  questEvent(state, event); // the quest step machine (ADR-0007): every event, also from cheats and loaders
}

/** Keep the last WINDOW non-quest events (and the quest entries after the oldest of them); cap the quest entries alone. */
function trimLog(log, pushedQuest) {
  let others = 0, quest = 0;
  for (const e of log) isQuest(e) ? quest++ : others++;
  if (pushedQuest) { // only the quest cap can be exceeded
    for (let i = 0; quest > MAX_QUEST_LOG && i < log.length; i++) if (isQuest(log[i])) { log.splice(i, 1); quest--; i--; }
    return;
  }
  while (others > WINDOW) { const e = log.shift(); if (isQuest(e)) quest--; else others--; }
  while (log.length && isQuest(log[0])) log.shift(); // a quest entry before the oldest kept event has no place in the window
  for (let i = 0; quest > MAX_QUEST_LOG && i < log.length; i++) if (isQuest(log[i])) { log.splice(i, 1); quest--; i--; }
}
