# Decision: character selection screen

Status: decided (PROXY)
Date: 2026-10-14
Picked: A "Lobby lineup"
Confidence: high for A over B and C; medium for the borrow list
Decided by: customer-proxy, provisional until the real customer reviews. Logged in `../../proxy-log.md`.

Basis: customer words "a visually appealing character selection screen" and "stay close to the original" (`../../00-brief.md`); `review-r1.md` (A 34/40, ship-range; C 30; B 28); I looked at all six screenshots in `shots/`.

## Reasons
- Most appealing on sight: a lit lobby with three full-length characters, the chosen one stepping into a light cone and ring. The unchosen classes stay visible, so the player can compare.
- Same dark look and selection ring as the game, so the figures can become in-world sprites. B's cream paper screen breaks the dark UI and its folders cut off the names. C hides two of the three classes and clips the best flourish.
- Best phone layout (fits at 390x844 without scroll) and lowest effort and risk (one canvas).

## Answers to the open questions
1. Variant: A, with borrowings below.
2. Unchosen classes: visible.
3. Look: dark game look. Paper only as accents.
4. Class, stat and difficulty names stay working names. **ESCALATE: needs the real customer** for final names (R-233).

## Borrow rules
- From C: the three-column stats row below the stage as the layout for short or landscape-phone windows; a short "ding" pulse on the selection ring when switching class; the elevator doors as the transition after Start (figure walks in, doors close). Optional, only if room.
- From B: the SELECTED stamp as the confirmation beat after Start; the ID-badge bust as the class card in the Load dialog and a future File screen; the "CONFIDENTIAL, FLOOR 0" micro-copy.
- From all: keep the shared 5-slot Load dialog and the text-plus-number stat bars. Do not borrow B's paper theme or C's blind doors.

## Must-fix list (before this screen is accepted)
Reviewer's top 5 for A:
1. Re-space the stage (about 22 / 50 / 78 percent of the width) so the forward-stepped figure, ring and cone are never cut at the edge; keep the cone inside the stage.
2. Make the unchosen two readable: dim no lower than about 70 percent brightness, keep a 1 px rim light and their props (stapler, laptop edge), add a hover lift; move class chips closer to the feet and enlarge them.
3. Fill the info panel's dead zone (emblem or portrait plus a one-line playstyle quote) or enlarge the name field and make Start the brightest object.
4. Fix Start's disabled state: class accent at about 40 percent, a visible hint "Type a name to start", text contrast at least 4.5:1.
5. Keyboard and phone: restore focus to "Load game" on Esc or Close; sticky header and Close in the phone dialog; phone class chips at least 44 px high; a "most recent" tag in the slot list.

Also from the review: readable stapler against the floor, legible keycap labels (or no labels at small sizes), simpler Facilities face at bust size.

Figures feedback (customer-facing priority): the in-world hero is currently a plain blue-shirted worker, so players would not recognise their class when the game starts. The in-world class sprites must carry each class's identity from the selection screen:
- Facilities Manager: yellow hard hat and hi-vis vest (orange accent), wrench.
- Sales Rep: suit and headset (pink accent), business cards or stapler.
- IT Wizard: hoodie and laptop (cyan accent), keycap or glow accent.
Keep the C2 style, silhouettes and palette from `figures.js`; draw isometric or three-quarter variants at in-world size; add a check that the three sprites are distinguishable at about 60 px.

## Escalations
- Final class names, stat names and game title (brand, R-233). Working names proceed.
