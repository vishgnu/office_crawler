# VFIX-R7-WORLD progress

- done: shots script e2e/vfix7-w-shots.mjs (elite on floor 4 via quests.setStep + cheats, NPC phone, map, crowd), before crops taken (the elite "before" is docs/shots/review-r7-elite-crop.jpg, the review's own); next: G1.
- done: G1 labels.js: plate beside the head (4 side spots) before stacking upward, crown mark on champion heads, plate above the crown; fx.js: onChamp keep-out for loot tags (also the relaxed pass), icons and beams on a champion drawn faint; nameplates drawn by fx.draw after the loot layer (game.js sets fx.plateDraw = labels.draw, one line); next: G2.
- done: G2 questmark.js: NPC marker lifted above any claimed plate rect; G3 map.js: solid title band, legend inside the card, card ends above the hotbar; N9 fx.js: hero redrawn over markers that overlap him; N10 world.js: fade 0.5 -> 0.7 and restored over the pool light.
- cannot: G4 elite/badge map pin. core mapMarkers (src/core/systems/questview.js) documents "Item and elite positions are never listed" and only lists NPC givers and main-quest stairs/lift. Render draws every marker the core lists (map.js questMarkers); a pin needs a core change (list the elite/badge tile once seen).
- note: phone map title ("Floor map: ...") sits under the DOM top buttons and the quest tracker pill (UI package); moving it down only moves the clash.
