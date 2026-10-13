# Decision: sound direction

Status: provisional default (PROXY), final pick by the real customer by ear

Picked (provisional default, PROXY, confidence low to medium): **C Foley-synth**. All three kits still ship, selectable in Options (`audio.kit`).

Notes from the human (optional): listen on both headphones and laptop speakers, with an ambient running, and say if a hybrid is wanted.


## Orchestrator note (2026-10-13)
Taste needs ears (learning L-14). The game ships all three kits behind one interface, selectable in Options
(`audio.kit`). The customer-proxy sets the provisional default. **The real customer is asked to listen to
A.html, B.html and C.html (headphones and laptop speakers, with an ambient running) and pick the default.**


## Proxy decision (2026-10-13)
**PROXY** (confidence low to medium): default kit is **C Foley-synth**. The proxy cannot listen; this rests on the customer's words, the frozen C2 style, the notes and measurements, and a read of each kit's synthesis code. A is the close second; B is last.

Reasons
1. "Stay close to the original" (moody genre classic) rules out B as default: chiptune pulse waves and arpeggio ambients read as game music, not atmosphere (notes.md), and B commits an outlined smooth-vector game to a retro-pixel identity. B is also about 6 dB louder at equal sliders and bright (centroids up to 10.8 kHz), tiring on headphones.
2. C keeps the dark-room mood without going gothic: noise whooshes and slaps, FM clicks, a short room (RT60 under 0.3 s), tonal ambients (mains hum with beating, fan blade tone, drips). That matches the dark-graded C2 look and its slightly playful office humour (everyday objects turned weapons), where A's grim sub-bass and D minor drones pull against the picture.
3. Robust on a likely listening setup: the customer plays on a laptop. A's weight sits in sub-bass thumps that laptop speakers lose (notes.md), so it may sound thin exactly where it should impress. C's content is mid and high, with transient-heavy sounds that survive small speakers.
4. Headroom: C's longest SFX is 0.963 s with a short room, so fights stay readable; A runs to 0.999 s with long reverb tails that smear busy fights and leave 1 ms spare. All checks pass for all three, so the numbers do not separate them except on tails and cost.
5. Cost and effort are similar to A (moderate CPU, M to L tuning). Risk accepted: C is the most likely to sound "cheap synth"; its quiet sounds (hit paper, stapler, equip) need a listening pass.

What to keep from the others
- From A: the basement ambient (server drones, oppression) and the heavier monster growls as the first candidates for a hybrid if the customer finds C too light. A hybrid is not planned now; the Options switch covers a full change.
- From B: its sparse, dry punch for UI blips is not needed; keep only its discipline on voice count and CPU.

Switch conditions (for the real customer): if "moody" outranks "readable" when listening, pick A (note that this is the same trade as the art pick). Pick B only if the customer wants a deliberate retro feel, which conflicts with "stay close to the original".

Answers to the prototyper's open questions
- Separate cues vs merged: **separate**. Miss, monster attack (hurt/death per monster) and stairs keep their own ids (QF-08-1 as should, already in all kits, 27 sounds). Merging would cost little in code but lose readable combat feedback, and the per-sound trims already exist. If the budget forces cuts, merge the three monsters' hurt sounds first, not miss or stairs.
- Title-screen ambient (QF-08-2): **yes, soft**. Play the lobby bed (the safe, warm one) at the ambient slider's default, started by the first gesture, fading out when a zone ambient starts. No music track. Consistent with the earlier proxy answer to QF-08-2. Default volumes stay master 0.6, effects 0.8, ambient 0.5 (QF-08-3, low confidence; B would need lower values).

ESCALATE: none. The final kit pick is the real customer's, by ear.
