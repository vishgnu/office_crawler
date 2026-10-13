# Brief: sound direction

## Question being decided
Which sonic character should the game's synthesised audio have? The customer asked for "nice sound and graphics" and
"generate what you need" (addendum in `../../00-brief.md`); the proxy answer to Q5 (`../../circles/circle-01.md`) chose procedural
sound effects plus a generative ambient loop per zone with volume sliders (`../../30-spec/08-audio.md`). Nothing may be a recorded file or a third-party sample
(NFR-L01): every sound is built at runtime with Web Audio. The choice fixes the synthesis toolbox, the mixing rules, the CPU budget and the
look-and-feel promise of the audio, so it is cheaper to decide before slice S3.

Reviewers cannot listen, so each board has a measurement mode (below) and the decision should still be made by ear.

## Requirements involved
- R-080 sound effects for core actions (attack, hit, death, pickup, UI click, level up, potion; QF-08-1 asks about miss, monster attacks and stairs, which all boards cover)
- R-081 generative ambient per zone (lobby, open-plan floors, basement)
- R-082 master, effects and ambient sliders plus mute (all three boards have them, wired to `kit.setVolume` and `kit.setMuted`)
- NFR-L01 no third-party assets: no audio files, no samples, no fetches
- NFR performance (CPU-cheap voices; see "Budget")
- QF-08-4 "nice sound" bar: this topic is the listening gate, with the numbers below as a safety net

## What all three variants share
- One file per variant (`A.html`, `B.html`, `C.html`), inline CSS and JS, opened from disk, in the C2 visual style (dark indigo panels, gold trim, teal buttons, cyan highlights).
- The same 27 sound buttons: hero swing (stapler-mace), hit flesh, hit paper, miss; hurt and death for zombie intern, printer imp and middle manager;
  hero hurt, low-health heartbeat (one beat pair; the game repeats it), potion (coffee slurp); gold coins, item pickup, rare sparkle, unique sparkle, level-up fanfare;
  Stapler Throw, Reply-All burst, Coffee Break heal, Mute; UI click, open drawer, equip, stairs, elevator ding.
- Three ambient loops, one at a time: open-plan floors (fluorescent hum, distant printer, HVAC), basement (server fans, drips, low drones), lobby (muffled elevator-music-like pad, safe and warm).
  They are continuous generative beds (sustained oscillators and noise plus seeded random events), so there is no loop seam by construction (AC-R-081-3).
- Master, effects and ambient sliders, a mute switch, and a live waveform and spectrum view. Browsers need a gesture, so the first button press starts audio.
- A liftable `createSoundKit(ctx, destination[, {seed}])` section (marked in each file), pure Web Audio and no DOM:
  `kit.play(id, when)`, `kit.startAmbient(zone, when[, {duration}])`, `kit.setVolume(bus, 0..1)`, `kit.setMuted(bool)`.
  Chain: voice -> effects or ambient bus -> master -> compressor (20:1, -4 dB threshold) -> soft ceiling at 0.97 -> destination. Every sound has a calibrated trim.
- Noise is seeded and generated once per context, so renders are repeatable (AC-R-080-2 style).

## Budget (same rules for all)
Short SFX at most 1 s, at most about 12 Web Audio nodes per SFX, no clipping, peaks between -6 and -1 dBFS, ambient RMS between -30 and -20 dBFS, RMS spread across SFX at most 12 dB.

## How to view and measure
- Open `A.html`, `B.html` or `C.html` and press buttons.
- `?measure=1` renders every SFX (1.7 s window) and 10 s of every ambient through an `OfflineAudioContext` (44.1 kHz stereo, all volumes at 1.0) and writes `window.__report`, then sets `window.__ready`.
  Per sound: duration, peak dBFS, RMS dBFS, crest factor, spectral centroid (2048-point FFT, Hann), clipping count, and for SFX the node count and render time.
  The report also carries a `method` string and a `summary` with the pass checks. The saved runs are `measure-A.json`, `measure-B.json`, `measure-C.json` (Playwright, Chromium).
- Duration is measured to the last sample above -50 dBFS, so it includes any reverb tail. Peak and clipping cover the whole render; SFX RMS and centroid cover the active window; ambient RMS and centroid cover seconds 1 to 10.
- Per-sound trims were set by a calibration pass (target RMS about -16 to -17 dBFS, peak limited to -5.2..-2.2 dBFS) and are stored in the kit; the numbers therefore say the mix is consistent, not that the sounds are pleasant.
