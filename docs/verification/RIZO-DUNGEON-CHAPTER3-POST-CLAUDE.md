# Chapter 3 — post-Claude visual completion pass

**Base:** `a363e7a` (PR #33's last published head; the previous agent's uncommitted workspace was not accessible).  
**Scope:** Presentation/rendering only; no changes to DungeonCore, hitboxes, detection rules, save contracts, chapter content or service worker.

## What was actually implemented

The earlier survey listed desired improvements but did not commit its proposed art changes. This pass implements concrete replacements in the actual game code rather than another list of ideas.

| Area | Changes |
| --- | --- |
| Intake small hood | Arm and gaze shift between watching, reading the phone, and the tell before looking back; pose state tracks the existing core guard timing. The torch still originates from its old gameplay location. |
| Long Hall runner | Separate moving legs and planted boots for the run cycle; dedicated reach/grab silhouette when caught; arms braced against the gate on the slam. |
| Six trapped souls | Moth, Pip, Bean, Spark, Wick and the old unnamed one have distinct **internal** creature silhouettes while their glass jars remain identical. |
| Factory props | A tall, opaque strapped crate clearly differs from a low, open rack of empty jars. |
| Long Hall architecture | A framed overhead roller-gate housing with guide tracks; service shutters expose a rimmed lamp head. |
| Intake / Factory LOOK props | A physical tag roll at the stamp desk, a clipboard at the factory rail. |
| Collection | Racks now have shelf rails, side uprights, bolts and small catalog tags. |
| Factory | The three machines are visually linked by a floor-level utility supply run. The loading bay is framed as a raised shutter over visible rain rather than a solid wall. |
| Vents | Obstructing geometry reads as sheet-metal ducts with seams and rivets; the scale grate view gets receding shelf supports and glints; the Boss's desk adds a paperweight/phone without showing his face. |
| Character Lab | New selectable guard, runner grab and runner slam poses for review. |

## Safety boundaries

- Game rules, checkpoints, saving and time-based detection logic are unchanged.
- The guard's visual pose is selected using existing `guard.state`, `stateAt`, `awayMs` and `tellMs`; it does not write back to the sim.
- Draw-time positioning and the factory's actual belt cover types are untouched.
- Light/brightness warning signals still use the existing world-space and timing functions.
- The Boss remains faceless. Warmth remains principally Rizo and awakened jars.
- All modified playable JS modules belong to the already network-first service-worker shell. No service-worker marker was changed in this pass.

## Verification performed and not performed

**Performed against this pass:**

1. Parsed all six affected JavaScript modules via V8 `Function` syntax compilation: `dungeon-art.js`, `dungeon-scenery.js`, `dungeon-mode.js`, `dungeon-view.js`, `tools/dungeon-lab/lab.js`, plus `dungeon-content.js` for compatibility inspection.
2. Invoked `Art.collector`, `Art.hood`, `Art.jar`, `Art.beltCrate` and `Art.jarTray` using an instrumented canvas-like context without exceptions.
3. Checked that distinct draw-call signatures result for hood watch/away/tell, collector patrol/run/grab/slam, and all six soul variants at the same sample time.

**Still required before merge/release:** the actual release workflow and a mobile Chromium + iPhone Safari gameplay pass. Syntax and stub-canvas calls do **not** verify visual quality, collisions in rendered frames, touch layout or real audio. In particular inspect Intake's phone alignment across watch/tell, Long Hall boots and gate slam, and the factory crate-vs-tray test in motion. The old 390/390 Dungeon and 88/88 escape results belong to **Claude's prior code**, not to the commits in this pass.

## Final Chapter 3 art queue cleanup (October 8)

After the first eight completion commits, four remaining visual items were implemented in-place:

- Factory catwalk sentries now have a lowered lamp arm and downward-looking silhouette while patrolling. This selects a render state in `dungeon-view.js`, without changing collector AI or spotlight collisions.
- The Long Hall's closed service windows now have metal sills and bracket supports. The previously implemented shutter movement and physically rimmed lamps remain.
- Factory machines now include press-guide columns and a small output chute, complementing the already-connected utility line. The timed press strokes are unchanged.
- `pose-curl` is smaller, slightly lower and has a slow held-breath squash; the existing reduced-motion rule disables that animation. This remains CSS posing, not hand-authored Rizo frame art.

**Release check history:** GitHub's complete `Current release suites` check passed on commit `3fe76e2` (the eight-commit art pass). The four follow-up commits above were added **after that success** and require a new release-suite run. Cloudflare Pages had deployed `3fe76e2`; the separate Cloudflare Workers Builds check continued to fail independently. This note does not claim that the follow-up commits passed the full suite.

**Integrity:** `BUILD-MANIFEST-SHA256.txt` is refreshed separately after this note and all code changes settle; the manifest tracks repository source files and is not part of the published 166-file package.

## Previously open owner decisions

- FLARE can still be spammed during the chase; prior bot runs found no measurable advantage so no gameplay rule was changed.
- Factory checkpoint and the number/name of the collection's trapped souls were not altered.
- The CSS-only Rizo curl pose is not fully hand-drawn and still merits an authored character-art pass.
- The external Cloudflare **Workers Builds** red check is a separate integration/configuration problem reported by PR #33. Cloudflare Pages deployment had worked; this pass does not add a Worker target.

**Merge sequence:** review this completion pass, run the release workflow, then merge PR #33 into `develop` only if all relevant tests and phone playthroughs pass. Do not treat an earlier green test count as evidence for these new art commits.
