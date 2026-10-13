# Decision: inventory panel layout

Status: decided (PROXY)
Date: 2026-10-13
Picked: **C Side drawer**
Confidence: medium (high that A/C beat B on "close to the original"; medium on C over A on looks alone)
Decided by: `customer-proxy` under the delegation in `00-brief.md`. Provisional: the real customer said they want to go over screens and confirm details, so this stays open to overruling (see `proxy-log.md`).

Variants: A Classic split, B Briefcase, C Side drawer (see `brief.md`, `notes.md`, `review-r1.md`, `shots/*-1280x800-compare.jpg`, all looked at).

## Reasons
1. Customer words: "stay close to the original" (mechanics and feel). The genre convention is a character sheet on the left, inventory on the right, both open at once, with the game world still visible behind. C is the only variant that does all three; A has the two panels but blanks the game; B departs from the convention with tabs (hides the sheet while managing gear).
2. The game is real-time and does not pause (see answers). Hiding the arena (A, B) while up to 50 monsters may act is a gameplay hazard. In the C shot the hero and the room stay visible and lit.
3. Customer words: "nice graphics". All three share the C2 art direction and look good in the shots. B has the strongest theme but loses on usability (review score 3 readability, 2 composition). C ties B on total (31) and has the best composition (5). The look gap to B is closed by borrowing B's leather header, see below.
4. Seeing the sheet change live while equipping (Damage, Health in the C shots) is the most useful feedback in the loop. B hides it.
5. Basis is conventions plus the two quotes; nothing in the customer's words ranks "moody theme" above "see the fight". If they do, B is the alternative, not A.

## Not chosen
- A: readable and complete, but fills the screen and its tooltip covers the stats it compares (A shot: tooltip over Derived Stats).
- B: best theme, but tabs, tooltip covers neighbouring items, game hidden.

## Borrow (concrete rules)
- From A: Employee File layout. Attributes next to derived stats, "+" targets reachable without scrolling, stat-preview note, unmet-gear list. Cells 44 px minimum. Inline rarity key with word next to the mark (mark shape + border + word + colour, NFR-A03).
- From B: leather and stitching skin on the Desk Drawer header strip (brown strip with stitching, already echoed in the C shot); 50 px cells on phone; phone layout = one panel at a time with tabs Gear / Employee File (C's stacked phone layout hides the sheet below the fold).
- From all: compare block with green up / red down numbers and the verdict line ("Upgrade: better in every changed stat"); "(you have 7, need 1 more)" wording; paper Employee File with the probation stamp.

## Must-fix list for the implementation
1. Tooltip never covers the bottom bar (skill slots, belt) and not the hero. Anchor beside the item toward the drawer's inner edge, cap height, flip to stay on screen.
2. Employee File fits at 1280x800 without scrolling for attributes, derived stats and "Gear you cannot use yet" (put the unmet list above the derived stats if space is short; stats may scroll, the "+" buttons may not).
3. Fix HUD bar badge collisions: F1-F4 and belt 1-4 badges overlap icon corners and the rarity mark of belt potions. Move badges outside or inset icons (art-direction must-fix 10).
4. Cells at least 44 px on desktop. Check the 1024 px minimum width (NFR-B02): drawers narrow or overlap the centre, and the centre gap stays usable (at least the hero visible).
5. Drag/drop feedback: green or red outline on the target slot with a one-line reason (e.g. "Needs Level 8"); equipped item stays visible as a dimmed ghost while dragging; held item clearly styled as "in hand"; changed derived stats flash on the sheet.
6. Real game scene behind the drawers (the mock grey scene was a placeholder); real HUD, C2 grade, no dimming of the centre, screen edges dimmed only.
7. Keep shared behaviour: keyboard access (tab stops, arrows in the grid), live region, focus ring, contrast >= 4.5:1, I and C toggle, Esc puts held item back.
8. Phone: tabs as described above, targets >= 44 px.
9. Keep all names original (R-102, R-103); no genre names introduced.

## Answers to the prototyper's open questions
See the "Answers" below. Basis: genre convention where the customer is silent (stated explicitly).

- **Does the game pause while panels are open?** **PROXY** (confidence medium): No. Real-time stays running, as in the genre; this is why C is picked. Basis: "stay close to the original"; genre convention (no pause for inventory).
- **May an item with unmet requirements be dragged onto its slot?** **PROXY** (confidence medium): It may be picked up and hovered over the slot (the slot outline turns red with the reason, "Needs Level 8"), but the drop is rejected and the item returns to where it came from. It is never equipped. It stays in the drawer with the "!" mark. Basis: genre convention (unmet requirements block equipping, items can still be carried); R-054, brief.md interaction list ("rejection with a message").
- **Tooltip comparison for items not equippable?** **PROXY** (confidence medium): Still shown, with the unmet line in warning style. It helps planning the next stat point. Basis: R-061, R-016.
- **Which stat point unlocks Fingerless Gloves (Agility 10)?** **PROXY** (confidence high): Spending a point should make the "!" disappear live, and the item becomes equippable at once. Basis: R-016, QF-06-6 (requirements preview).
- **Swap on drop onto an occupied slot/overlap with one item?** **PROXY** (confidence high): Yes, swap; old item goes to the cursor. Overlap with two items is rejected with a message. Basis: brief.md interaction, genre convention.
- **Two-handed item vs off-hand?** Already decided QF-05-4: occupies the off-hand slot.
- **Real customer:** "wants to go over screens and confirm details". Keep the compare shots and this decision linked in the review pack; nothing here is irreversible.

No ESCALATE items: no names, assets or legal matters were involved.
