# 08 Audio

Areas: H Audio (R-080..R-083). Contract: `10-tech-and-testability.md`. Per the PROXY answer to Q5 (provisional, based on the real customer's addendum "nice sound"): procedural sound effects (Web Audio synthesis) plus a simple generative ambient loop per zone, three volume sliders (master, effects, ambient) and mute. No audio files (NFR-L01). Everything here is slice S3.

Browsers start audio only after a user gesture; the specs assume the first click on the title screen is that gesture.

### R-080 Sound effects for core actions (should · MVP)

- **AC-R-080-1** `S3` `Unit` — Given `renderSfx(id, 44100)` for each id in `attack, hit, death, pickup, uiClick, levelUp, potion`, When rendered, Then the result is a non-empty Float32Array of length at most `config.audio.maxSfxSeconds * 44100`, RMS above 0.001, peak at most 1.0 (no clipping), and no NaN.
- **AC-R-080-2** `S3` `Unit` — Given `renderSfx(id, 44100)` called twice for the same id, When compared, Then the arrays are equal (deterministic synthesis) and the seven ids produce seven pairwise different arrays.
- **AC-R-080-3** `S3` `E2E` — Given `audio.getState().cueLog` cleared, When the player swings (`events` `attack`), a monster is hit, a monster dies, an item is picked up, a UI button is clicked, a level-up occurs, a potion is used, Then `cueLog` receives, in each case, the cue id `attack`, `hit`, `death`, `pickup`, `uiClick`, `levelUp`, `potion` with the tick of the event.
- **AC-R-080-4** `S3` `E2E` — Given a miss, When it occurs, Then the `hit` cue is not played (QF-08-1: whether a miss has its own sound).
- **AC-R-080-5** `S3` `E2E` — Given 20 hits in one tick (stress), When `cueLog` is read, Then at most `config.audio.maxVoices` voices play (polyphony cap) and no exception is thrown.
- **AC-R-080-6** `S3` `E2E` — Given the town scene, When it is entered, Then the ambience cue `ambient:lobby` starts (town ambience, R-080 list).
- **AC-R-080-7** `S3` `E2E` — Given 60 s of play, When network requests are listed, Then no audio file is requested (AC-NFR-L01-3).

### R-081 Background music: generative ambient per zone (could · MVP, raised by Q5)

- **AC-R-081-1** `S3` `Unit` — Given `renderAmbient(zone, seed, 10, 22050)` for zones `lobby`, `open-plan`, `basement`, When rendered, Then each result is non-silent (RMS above 0.001, peak at most 1.0), deterministic for a fixed seed, and any two zones differ.
- **AC-R-081-2** `S3` `E2E` — Given the player enters a floor in zone Z, When `audio.getState()` is read, Then the active ambient id is `ambient:Z`; on moving to a floor in another zone it switches to that zone's ambient.
- **AC-R-081-3** `S3` `E2E` — Given an ambient loop, When played for `config.audio.loopSeconds` seconds, Then it loops without a gap longer than 50 ms (loop point continuity, measured from the rendered buffer's first and last samples differing by at most 0.1).
- **AC-R-081-4** `S3` `E2E` — Given `scene === 'dead'` or `'title'`, When read, Then no zone ambient plays (or the title ambient, QF-08-2).

### R-082 Volume controls and mute (must · MVP)

- **AC-R-082-1** `S3` `E2E` — Given the options screen, When the master, effects and ambient sliders are set to 0.3, 0.5 and 0.8, Then `audio.getState()` returns `master 0.3, sfx 0.5, ambient 0.8`, and the gain nodes' values (`effectiveGain`) equal master x bus value (0.15 for effects, 0.24 for ambient) within 0.001.
- **AC-R-082-2** `S3` `E2E` — Given sliders at any value, When `muted` is toggled on, Then `effectiveGain` is 0 for all buses, the slider values are unchanged, and toggling off restores the previous gains exactly.
- **AC-R-082-3** `S3` `E2E` — Given volume and mute settings changed, When the page is reloaded, Then `options.volume` and `audio.getState()` have the same values (persisted in options).
- **AC-R-082-4** `S3` `Unit` — Given slider input outside [0, 1] (for example -0.5 or 3), When applied, Then the value is clamped to [0, 1].
- **AC-R-082-5** `S3` `E2E` — Given no saved options, When the game first starts, Then the defaults are master `config.audio.defaultMaster` (greater than 0, QF-08-3), effects and ambient equal `config.audio.defaultBus`, and `muted === false`.
- **AC-R-082-6** `S3` `E2E` — Given pause (AC-NFR-A02-2), When the options screen is opened from the pause menu and a slider changed, Then the change applies immediately and persists on resume.

### R-083 Positional/stereo audio, voice lines (could · LATER)

LATER, no AC.

## Not covered by an AC here

- Perceived quality of the synthesised sound ("nice sound", addendum) is a listening review and cannot be asserted in state. AC-R-080-1 and AC-R-081-1 check only that sounds exist, are loud enough, bounded and distinct (QF-08-4).
- R-083 (LATER).

## Questions for the facilitator

- **QF-08-1** Is there a separate sound for a miss, for monster attacks and for stairs? R-080 lists only attack, hit, death, pickup, UI click, level up, potion, town ambience.
- **QF-08-2** Does the title screen play ambient or music?
- **QF-08-3** Default volumes are not specified.
- **QF-08-4** How is the "nice sound" bar assessed? Proposal: the independent reviewer listens through a rendered WAV of each cue (offline render in the build) and approves or rejects; this is a gate outside the automated suite.
- **QF-08-5** R-081 is "could" in the requirements but the Q5 PROXY answer chose generative ambient; ACs are written for it. Confirm priority.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-080 Sound effects for core actions (should · MVP) | R-080-1, R-080-2, R-080-3, R-080-4, R-080-5, R-080-6, R-080-7 | S3 | E2E, Unit |
| R-081 Background music: generative ambient per zone (could · MVP, raised by Q5) | R-081-1, R-081-2, R-081-3, R-081-4 | S3 | E2E, Unit |
| R-082 Volume controls and mute (must · MVP) | R-082-1, R-082-2, R-082-3, R-082-4, R-082-5, R-082-6 | S3 | E2E, Unit |
| R-083 Positional/stereo audio, voice lines (could · LATER) | none (see below) | - | - |

Total ACs in this file: 17 (S1 0, S2 0, S3 17).
