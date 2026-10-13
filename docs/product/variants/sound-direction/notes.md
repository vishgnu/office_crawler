# Notes: sound direction

All numbers come from the saved `measure-*.json` (offline render, Chromium, 2026-10-13). Measurements show level, length, brightness and cost; they cannot judge taste, so the pick must be made by ear.

## Measurement summary
| | A Gothic office | B Retro chiptune | C Foley-synth |
|---|---|---|---|
| SFX peak range (target -6..-1) | -2.8 to -2.2 | -5.2 to -2.1 | -5.2 to -2.2 |
| SFX RMS range, spread (target spread at most 12 dB) | -25.8 to -17.0, 8.8 dB | -16.0 to -11.0, 5.0 dB | -24.5 to -16.2, 8.3 dB |
| Ambient RMS (target -30..-20) | -25.0 all three | -25.0 all three | -25.0 all three |
| Clipping samples (SFX / ambient) | 0 / 0 | 0 / 0 | 0 / 0 |
| Longest SFX incl. tail (target at most 1 s) | 0.999 s | 0.906 s | 0.963 s |
| Most nodes in one SFX (target about 12) | 12 | 11 | 12 |
| Slowest offline render, SFX / 10 s ambient | 71 ms / 201 ms | 20 ms / 101 ms | 41 ms / 202 ms |
| All checks pass | yes | yes | yes |

Ambient RMS sits at exactly -25 because the trims were calibrated to it. B is the loudest on average (square waves have a low crest factor, 5.7 to 13.6 dB against 14.2 to 23.6 dB for A and 11 to 22 dB for C), so at equal slider positions B will feel louder than A and C even though the peaks match.

## A Gothic office
- Character: dark and heavy. Sub-bass thumps, saw-through-formant growls for the monsters, minor-key bells and a D minor drone under every floor, all pushed through a feedback-delay room (four parallel combs, RT60 about 0.4 s). Closest to the moody genre classic: impacts feel big and the basement is oppressive; the lobby pad is the only warm place.
- Fit with C2: C2 is a stylised, saturated vector look in indigo and teal with gold trim; the sound is darker and more serious than the picture, so the two pull in different directions (funny office, grim audio). That contrast can read as dry humour, or as a mismatch.
- Risks: reverb tails make the SFX run right up to the 1 s limit (0.999 s, only 1 ms spare), so any change that lengthens a sound needs a re-measure; heavy low end is lost on laptop speakers, so thumps may sound thin; constant reverb in busy fights can smear. Five sounds sit at the 12-node ceiling.
- CPU: shared room is 18 nodes always on; SFX 7 to 12 nodes, one ambient bed roughly 15 to 40 live nodes (estimated from the code). Slowest offline render 71 ms for one SFX including setup; 201 ms for 10 s of ambient.
- Effort: M (voice and room tuning, tails per sound).

## B Retro chiptune
- Character: punchy, dry, playful. Pulse waves at 12.5, 25 and 50 percent duty, triangle bass and a stepped noise channel, with 6-to-10 step decays like a console sound chip. Fanfares are arpeggios, deaths are falling pitch slides; ambient beds are quiet triangle arpeggios and noise hiss.
- Fit with C2: the cheerful, outlined, saturated look suits it, and the office-gone-wrong comedy comes through (coin blips, "pew" skills). It undersells the moody lighting (the dark vignette and flickering fluorescent) and the genre classic's heavy feel; ambient reads as game-music rather than atmosphere.
- Risks: it commits the whole game to a retro-pixel sound identity while the art is smooth vector; square waves are tiring at length and loud for their peak (RMS about 6 dB above the others at equal peak); brightness is high (centroids 1.0 to 10.8 kHz) so it can sound harsh on headphones; ambient stays "musical" instead of spooky.
- CPU: cheapest. SFX 3 to 11 nodes (most 5 to 7), no room, 10 s ambient renders in about 100 ms. Safest for low-end laptops and for many simultaneous voices in a crowded fight.
- Effort: S to M (the toolbox is small and the sounds are short note tables).

## C Foley-synth
- Character: realistic-ish and tactile. Filtered-noise whooshes and slaps, FM clicks and ticks (stapler, UI, equip), inharmonic FM chimes for coins and sparkles, formant voices for monsters, a small room from four short feedback delays (RT60 under 0.3 s) and tonal ambient beds (mains hum with beating, fan noise with a blade tone, drips, soft electric-piano pad in the lobby).
- Fit with C2: sits in between. It supports the office setting (paper, staplers, coffee, plastic clicks) and the comedy of everyday objects turned into weapons, and it keeps the dark-room mood of the C2 lighting without pushing it to gothic. Closest to a real "office as dungeon" soundscape.
- Risks: hardest to make sound convincing and the most likely to sound "cheap synth" next to real recordings; many quiet sounds (hit paper, stapler, equip) are transient-heavy, so their RMS is low and they may feel weak next to growls; eight sounds at the 12-node ceiling (FM voices cost four nodes each). Needs listening time to tune.
- CPU: moderate. SFX 5 to 12 nodes (FM voices use four nodes each); same 18-node room as A; offline render 41 ms worst SFX and 202 ms for 10 s of ambient.
- Effort: M to L (the most tuning, and the sound design is the part the customer will judge).

## Cross-cutting notes
- Loudness consistency is achieved by a per-sound trim table baked into each kit; adding a sound means one calibration run.
- All three kits are lifted unchanged into the game by copying the marked section; the game then calls `kit.play(id)` from its cue events (the cue ids `attack`, `hit`, `death`, `pickup`, `uiClick`, `levelUp`, `potion` of AC-R-080-3 map to `swing`, `hitFlesh`, `deathZombie` and the other death ids, `coin`, `uiClick`, `levelUp`, `potion`).
- A hybrid is possible (for example C's foley for impacts and UI, A's drones and room for the basement), but it costs effort and a decision is cheaper now.
