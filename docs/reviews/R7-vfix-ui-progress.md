# VFIX-R7-UI progress (2026-10-15)

- start: read R7-visual-review U1-U6, R6 N12/N14/N15, R7-acceptance R8-Q2/Q3. Names confirmed in code: dock `renderHud` (panels.js), tracker `syncTracker`, toast `syncToast`/`game.toast`, NPC window `renderNpc`, tree `renderTree`, select screen `charselect.js`. No new core event or state field (L-026/L-039: nothing for other packages).
- done: U1 dock badge capped to "99+" (aria-label keeps the count), phone dock is a left/right-bounded row with smaller padding below 400 px and 340 px; measured at 390, 360 (buttons 19..354) and 320.
- done: U2 tracker pill hidden while a left panel is open on desktop (phone already hid it with any panel).
- done: U3/U4 toast anchored just above the HUD (bottom, from `--tb`), at most two lines on phone (three on desktop), centred and width-limited to the free gap between the open drawers on desktop; `TOAST_LANE` 40 -> 48 so the two-line toast fits under an open phone drawer.
- done: U5 a toast equal to the tracker line, or to the visible bag-full alert, is hidden (`.toast.dup`), text and live region stay.
- done: U6 the NPC quote is sticky at the top of the window body.
- done: N12 single-chain branches (one node per tier) lay out as one row of three cards with short connectors (desktop); branching branches and the phone keep the old layout.
- done: N14 the wrench now swings in the select-screen overlay (wind-up overhead, whip down, arc trail, stays a beat, then the existing shockwave). Note: under `?test=1` the page has `noanim` so the flourish is off there (that is why the R7 reviewer saw ring and cone only); shots use a normal page with a paused fake clock.
- done: R8-Q2 the Desk Drawer opens with an NPC window only when the play area between the drawers is at least 45% of the width (1280: 36%, so it stays closed; 1920 opens it); phone unchanged.
- done: R8-Q3 a queued "return for your reward" quest line is dropped when that quest completes (`game.toastDrop`), so the second hand-in no longer ends with a stale line that reads like a repeat.
