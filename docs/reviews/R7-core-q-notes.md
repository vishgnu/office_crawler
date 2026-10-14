# R7 CORE-R7Q notes

## R7-0.1 golden re-pin (2026-10-14), done once

Reason: `newGame` now builds `state.quests` (main quest milestones, three side quests, pinned) and `player.pouch = []`, and both are hashed
(ADR-0007 section 11, AC-R-256-3). Nothing else changed for a run that never talks to a giver.

| File | Old (post-AI-R7, kept as `*.pre-quests.*`) | New |
|---|---|---|
| `test/fixtures/run-a.hash` (facilities-manager) | 4a96887c22fea751 | 60a33ace8c544a3c |
| `run-class.json` sales-rep | f8676f7f5ab6bb2b | f498c8fb2837087c |
| `run-class.json` it-wizard | 602769930849f1d4 | 934fb325dd581dd7 |

Proof (`test/quests-hash.test.js`): `hashStateWithout(state, {paths: ["quests", "player.pouch"], eventPrefixes: ["quest."]})` of the replayed
run-a (and of the per-class runs) equals the old value for all three classes. The recorded runs emit no `quest.*` event, so the 256-entry
event-log window is identical with and without the filter (asserted in the same test). If a future recorded run does emit quest events and
fills the log, the filter alone would not reproduce an old hash (events shifted out of the window); not the case here.

If AI-R7 re-records again, redo the two `*.pre-quests.*` copies and the one re-pin (contract risk 1).

## Deviations from the contract (R7-0.1)

- `questHandIn` is not stubbed: the input stays "unknown input" until R7-0.2 (the hook in `itemCommand` has `questAccept` and `questPin` only).
- `config.saveVersion` stays 3 until R7-0.3 (the save schema, migration and version-relative tests move together there).
- `snapshot.quests` exists for states that have quests; states built without `state.quests` still snapshot (no `quests` view, `npcs` and `map.markers` empty).
- `content.quests` also exports `markerLabels` through `content/quests.js` (English labels for map markers) and `newQuestState()`; `content.questIds` and `content.sideIds` are on `content`.
- `mapMarkers` in 0.1 covers the main quest (elevator in the Lobby, stairs down on a floor, only when explored) and the giver NPC of an `available` or `ready` side quest. Item and elite are never listed.
