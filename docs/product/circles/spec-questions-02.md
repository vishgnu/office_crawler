# Spec questions 02: classes, trees, slots (customer-owned questions only)

Date: 2026-10-14. Answerer: `customer-proxy`, under the delegation record in `00-brief.md` and `STATE.md`. Sources: "Questions for the facilitator" in `30-spec/11-classes-trees-slots.md` (QF-11-1..9) and the "Questions for the customer" at the end of `decisions/ADR-0005-classes-and-skill-trees.md` and `decisions/ADR-0006-save-slots.md`.
All answers are PROXY and provisional until the real customer reviews them (`proxy-log.md`). Purely technical questions are marked "owner: architect" and not answered here. No earlier customer answer is changed (third briefing: 3 classes, trees, selection screen, 5 slots; fourth briefing: rounds 7-12).

Format: id | question | owner | PROXY answer (confidence) | basis.

## From spec 11

### QF-11-1 Final class names (and re-scan after renaming)
- Owner: customer (names, brand); the re-scan part is owner: architect.
- **ESCALATE: needs the real customer** for the final class names and game title (brand, not delegated; circle-02 brand line). Working names Facilities Manager, Sales Rep, IT Wizard proceed as strings.
- Re-scan after a rename: owner: architect (the proxy's view: yes, any name change reruns AC-R-233-1 as a matter of course; names are data).

### QF-11-2 Denylists still to be supplied
- Owner: architect (factual error in the question).
- Correction, no customer decision needed: `docs/product/ip-denylist.txt` and `docs/product/ip-denylist-brands.txt` exist, so AC-R-233-1 is not vacuous and must run against both from R4. The denylist itself only reduces risk; closeness to the original stays escalated (circle-01 Q1).

### QF-11-3 Legacy Clerk skills: refund or redistribute?
- Owner: customer.
- **PROXY** (confidence medium): Refund as skill points (R-225). The redistribution proposed in circle-02 Q1 applies to tree content only (the old skills' ideas may reappear as skills in the new trees), never to a player's saved character. The player re-spends freely. Basis: circle-02 Q1/Q3 (respec free in town, so a refund costs the player nothing); no customer words on the old Clerk; protecting saved progress is the conservative choice.

### QF-11-4 Parity band deaths floor
- Owner: architect (balance measurement method; proxy has no objection to an absolute floor of 2 deaths).

### QF-11-5 Resume position after Load or Continue
- Owner: customer (already answered).
- **PROXY** (confidence medium): Same as QF-09-2: `floorEntry` when saved on a floor, `town` when saved in town. Basis: `spec-questions-01.md` QF-09-2; circle-01 Q4.

### QF-11-6 "Last played" stamp vs AC-NFR-D01-1
- Owner: architect (storage and test-rule detail). Customer-visible part: showing last-played on each slot card is wanted (see AC-R-223-1); how it is stored is not a customer matter.

### QF-11-7 Keep attribute points as spent on migration
- Owner: customer.
- **PROXY** (confidence high): Yes, attributes stay exactly as the player had them; only skill points are refunded. Basis: third briefing (5 slots, existing character carried over) and circle-02 Q6 ("migrate old save to slot 1"); attribute respec is out of scope (circle-02 non-goals), so nothing may be taken from the player.

### QF-11-8 Cooldowns for all three classes
- Owner: customer.
- **PROXY** (confidence high): Yes. Mana cost only, no cooldowns, for all three classes (QF-06-5 holds). Basis: `spec-questions-01.md` QF-06-5; brief "stay close to the original" (genre convention).

### QF-11-9 Skill panel key S/K vs other keys
- Owner: customer (UX), details owner: architect.
- **PROXY** (confidence medium): Keep both S and K opening the panel (QF-01-3). No conflict: movement is mouse click, skills are on the right mouse button and F1-F4, potions on 1-4 (QF-01-4), so S is free. If a conflict appears with a later keyboard-movement option, K stays and S yields. Basis: `spec-questions-01.md` QF-01-3, QF-01-4.

## From ADR-0005 (classes and skill trees)

### ADR5-1 Final class names and game title
- Owner: customer. **ESCALATE: needs the real customer** (brand; same as QF-11-1). Working names stay.

### ADR5-2 Respec rule
- Owner: customer.
- **PROXY** (confidence low): Keep the earlier answer: free, unlimited skill-point respec in town, attributes not respecced (circle-02 Q3 A). One config value (`config.respec.mode`) flips it to gold, once or none. Basis: circle-02 Q3 (not changed). Tension stated again: "stay close to the original" could point to no respec; the real customer should decide this one; it is cheap to flip and does not block anything.

### ADR5-3 Signature skill free at level 1, or one open point?
- Owner: customer.
- **PROXY** (confidence medium): Each class starts with its signature skill already learned at level 1 (free, not counted against the point rule; the 29-point rule stays as the architect assumed). The first minute must be playable without opening a tree. Basis: brief "stay close to the original" (the genre classic starts every class with a usable skill); circle-01 Q7 (short sessions); the architect's assumption.

### ADR5-4 Skill synergies this round?
- Owner: customer.
- **PROXY** (confidence medium): No for rounds 4-5; R-208 stays "could" and is done in round 6 only if there is room. Basis: third briefing asks for trees, not synergies; circle-02 non-goals (synergies not a must).

### ADR5-5 Skill names "Firewall" and "Fire Drill"
- Owner: customer (brand/IP closeness).
- The orchestrator's safe default stands: use "Packet Filter" and "Evacuation Drill" (ids unchanged). **ESCALATE: needs the real customer** only to confirm or overturn the names; the denylist already blocks "fire wall" (`ip-denylist.txt`), so the safe names are required in the meantime, never the originals. Basis: brief claim G2 and harness rule 06 (no copying of names), circle-01 Q1 (strict originality).

## From ADR-0006 (save slots)

### ADR6-1 Second browser tab: read-only message
- Owner: customer (UX wording and flow).
- **PROXY** (confidence medium): Accept. The second tab shows a clear read-only message ("open in another tab") and does not write; best effort is enough. Basis: ADR-0006 proposal; third briefing (5 slots) needs no more; protects saves from silent overwrite (NFR-D06 data-loss priority).

### ADR6-2 Delete keeps one undo copy
- Owner: customer (UX wording and flow).
- **PROXY** (confidence medium): Accept. Delete asks for confirmation naming the character; one undo copy is kept until the next write in that slot; the dialog offers "Delete forever" to clear it. Suggested copy: "Delete <name>, level <n> <class>? You can undo this until you save in this slot again." Basis: ADR-0006 proposal; QF-09-4 (delete keeps options); circle-02 Q6 (confirmations on destructive operations).
