# Rizo Dungeon cohesion, readability and world polish

Starting commit: `1ac791db12c81903a38824e55c579cebdc3e9b04`.

Branch: `feat/rizo-dungeon-sol-cohesion-polish`, targeting `develop`.

This pass follows the existing v0.3 opening and threshold-v3 narrative. The
opening beat sheet, full narrative, story spine, Mending Rows direction and
actual room/scene runtime were read before editing. The starting build was
played through the opening, Threshold and Rows and compared with the candidate.

## What needed fixing

- Real Receiving → Dry Table traversal could leave the destination black. The
  destination's entrance scene replaced the walking scene before its reveal.
- Short service rooms floated in empty canvas margins. Many work light pools
  had no painted source, so lighting did little to explain the space.
- Low Run's dark first-pass floor obscured its three solid stacks. Return Stair
  drew treads straight through solid rails, contradicting the playable route.
- Important catches did not visibly belong to the loads they released. Several
  direction signs were too small, and Receiving's table arrow pointed left
  although its table doorway is on the right.
- Rizo's mirrored turn interpolated through a zero-width body. Growing typed
  dialogue could cover him after its placement had been chosen.
- Three wrap choices overflowed narrow phones. An oversized boundary card in
  short landscape was difficult to reach and could not be dragged under the
  game's page lock.
- Nell's support was staged above her head, her ordinary work held nothing,
  and her Dry Table support/departure crossed the solid bench.

## Continuous visual language

The existing material palette remains the source: service green, rubbed wood,
patched plaster/masonry, sodium glass, paper, maroon thread and restrained brass.
Dark walls and foundations frame a lighter kept floor. Repeated riveted mains,
cloth-bound repairs and caged work lamps connect districts without making them
identical. Lamp art and light-pass positions share one source table.

Open doorways use the same jambs, worn sill and short spill at both ends. Closed
hardware still covers its opening. The added architecture stays outside the
collision floor, making the cutaway deeper without offering false walkable
lanes. Broad wear follows actual paths; small seams and tool rolls belong to
specific work. No runes, mystery glyphs, decorative asset packs or new media
were added.

The flame remains the moving visual center. It briefly lights what an active
Flare reaches, while ordinary flame loss still contracts its pool. Reachable
Primary targets get quiet pale brackets; enemy bands and chevrons retain their
distinct danger language. Press House adds a direction tab, an actual carriage
lamp, and visible stop/brake states without changing the encounter rules.

## Rooms and scenes

| Place | Result |
| --- | --- |
| Car / waiting / kidnapping | Preserve the rainy cutaway, YOU's blocking, forced abduction and all timing; fix mirrored posture readability and bubble placement. |
| Sack | Preserve the flame through cloth and limited movement; retain the control hint as a static cue under reduced motion. |
| Van | Preserve escalation, people climbing out and the gap; keep overheard bubbles inside the screen and away from Rizo where space permits. |
| Roadside / drain | Preserve loneliness, beam/shadow rules, phone, passing car and material descent; bound interaction prompts and show the reachable phone. |
| Slip | Deliberately preserve the lonely shaft, awakening darkness, `home?` and LOOK before HOME ↑. |
| Clatter / Hem / Queue | Connect supply architecture and doorway treatment; give work pools visible fixtures and improve floor legibility. |
| Shared Hearth | Preserve the braided rug, kettle, cold bowl, Latch and choices; keep the fire's warm refuge readable against dark edges. |
| Porter | Preserve the runner, lantern, keys, pigeonholes, silhouette and attack geometry; connect the surrounding service masonry and threshold. |
| Receiving | Show the dry space Nell clears; give the light a physical source, make the table sign readable and point it toward the actual door. |
| Dry Table | Keep the table's warmth and low job; persist the repaired corner visually, make Nell's work tangible and route her around the bench. |
| Hanging Row | Keep drying frames and Nell's high/low separation; connect lamps, hardware and a readable LOW arrow. |
| Low Run | Rebuild floor contrast, worn switchbacks, source lighting and the warm pipe patch around all three real stacks. |
| Eyelet Landing | Show the worn crossing over the actual board, Nell's work roll and the connection between grille catch and hatch; enlarge PRESS ↑. |
| Tray Pass | Extend the service cutaway, light the wheel-worn lane and give this short passage a legible back-wall identity. |
| Press House | Preserve the screen/recess and authored passes; connect controls to brake/shutter, show carriage direction and parked state. |
| Upper Landing | Preserve the distant service-window view; lead worn boards to the stair and carry repaired cloth into the landing. |
| Return Stair | Rebuild the flights around the real rail ends; bring table light and maroon cloth to the lower door; preserve the chalk bowl/arrow. |
| Window Hall boundary | Preserve Nell, Latch's memory and the current endpoint; connect the service windows and make the boundary card reachable in landscape. |

## Staging and interaction

Nell listens toward nearby Rizo in her existing listening/clearing/fitting
states. Work and fixing have a cloth, seam and needle. Support is at hand
height; lifting keeps its overhead silhouette. At the Dry Table she reaches
the clear side of the bench before supporting it and rounds its end on departure.
Receiving's dry patch and the repaired table corner show the result of her care.
The corner is restored from the committed meeting even when he reloads before
warming the first catch. Her appearances and route remain those of the authored scenes.

Typed speech reserves its final height before the first letter. Each line
chooses the screen end that protects Rizo and the speaking body most effectively;
rotation invalidates that placement. Overheard speech tests bounded nearby
positions against Rizo, dialogue and other bubbles. Offscreen speech does not
draw a misleading tail. These changes preserve every line and speaker.

The room handoff owns its reveal independently of whichever entrance scene
starts next. Ordinary doorway fades remain short; reduced motion shortens the
reveal. The car/waiting/taken/sack/van/road/drain/fall emotional timing remains
authored. No scene was rewritten to solve a presentation problem.

Choices use equal flexible columns with at least 48 px height. Oversized cards
start at an accessible top and support card-only pointer dragging; the page,
screen and physical controls keep their no-scroll/gesture lock. Rizo's mirrored
turns change in discrete steps, so his flame and eyes do not collapse away.
The shortest landscape HUD keeps room labels separate from the flame meter.

## Verification

Fresh verification of the recovered candidate:

| Check | Result |
| --- | --- |
| All current Node suites (`tests/*.test.js`) | 13/13 suites pass. |
| Full opening, Threshold and Rows (`browser-dungeon.py`) | 371/371 checks pass. |
| Real-exit loop, staging, all room/phone inventory (`browser-dungeon-cohesion.py`) | 67/67 checks pass after the final pre-catch reload fix; 164 screenshots captured. |
| Physical phone controls (`browser-dungeon-controls.py`) | 185/185 checks pass, including multitouch, lost releases, rotation and restored Hub scroll. |
| Remaining release browser suites | All 11 pass; individual results below. |
| Source syntax, Python compilation, whitespace and static build | Pass. |

| Other browser release suite | Checks passed |
| --- | --- |
| `browser-home-world.py` | 110/110 |
| `save-safety.py` | 37/37 |
| `browser-defense-integration.py` | 78/78 |
| `mode-contract.py` | 25/25 |
| `training-contract.py` | 22/22 |
| `browser-launch-recovery.py` | 5/5 |
| `browser-v88-training-fixes.py` | 13/13 |
| `browser-v88-authored.py` | 25/25 |
| `browser-v87-arcade-freeze.py` | 66/66 |
| `browser-public-product.py` | 150/150 |
| `browser-world-first.py` | 77/77 |

All 14 browser release programs have passed locally. The full 371-check journey
and 185-check controls replay ran sequentially; the 67-check door-driven loop
was rerun after restoring the repaired corner on a pre-catch resume. All 13
Node suites were also rerun after that final change. The final static artifact's
five changed production files exactly match the working sources. Hosted CI
results belong to the PR's current Actions run, not this local report.

The World-first suite initially could not start because the reconstructed Git
object store lacked its reviewed RC1 fixture. Fetching that historical commit
restored the genuine old-worker/fingerprint test; no product/test change was
needed. The completed run logged two local HTTP client-disconnect BrokenPipe
tracebacks during navigation; all 77 assertions, including no browser runtime
exceptions, passed.

The new cohesion suite drives the complete Rows loop using real keyboard
exits and actual WARM/LOOK/choice buttons, including GO at the meal, the wrap,
pre-catch reload, worn-wrap reload and the Window Hall boundary. QA clock advancement shortens authored
waits; teleports place work interactions and enemies are settled to isolate
traversal. It walks Low Run's three stacks and Return Stair's rail ends.

All 21 rooms are reviewed at **320×568, 375×812, 390×844, 430×932** and two
landscapes, **844×390 and 568×320**. Screenshots complement bounds, target-size,
no-scroll, stable typewriter height and real touch-drag checks. These are
Chromium emulations, not Safari or physical-device measurements.

The release workflow now runs the existing controls suite and new cohesion
suite. Its QA artifact includes the room/phone screenshots; production ships
no QA screenshot media or browser dependencies. The job allows 30 minutes
instead of 20 for the longer sequential replay and browser installation.

Two existing test observations were made independent of incidental timing:
the grab check waits for both detection and the scene's control handoff, and the
idle sack check anchors its observation to the actual limited-control beat.
The scroll-restoration fixture supplies a known page height because the
unified Go shelf can only scroll 48 px by itself. The underlying production
opening/input/page-lock behavior is unchanged by those fixture adjustments.

## Performance and scope

The service surround, fixtures and floor wear use the existing cached canvas
room layer. Door hardware and small state feedback use the existing live layer.
The lamp table is shared rather than allocated per frame. No framework,
dependency, image/video asset or additional animation loop was introduced. The
five changed production files grow by 18,462 bytes of source (5,949 bytes when
separately gzip-compressed locally; actual transfer encoding depends on hosting).
Reduced motion retains static cues and the existing restrained fall presentation.

A baseline/candidate Chromium render comparison at 390×844, DPR 2 and 4× CPU
throttling sampled three seconds per settled room, serially, with no other
browser suite running. It measures the view's render call, not total frame
time, cache construction, GPU work, battery use or old-phone performance.

| Room | Baseline median / p95, ms | Candidate median / p95, ms |
| --- | --- | --- |
| Clatter | 1.8 / 2.5 | 2.3 / 3.5 |
| Receiving | 4.0 / 5.7 | 3.7 / 5.8 |
| Dry Table | 2.6 / 4.5 | 3.1 / 5.8 |
| Hanging Row | 3.0 / 5.5 | 3.1 / 5.6 |
| Low Run | 1.9 / 2.6 | 2.4 / 4.3 |
| Return Stair | 1.8 / 2.9 | 2.0 / 3.0 |

This bounded sample shows a modest extra render cost in several rooms, rather
than proving identical performance. The highest candidate p95 is 5.8 ms; the
cached room strategy, canvas dimensions and asset count remain unchanged.

Production edits are confined to Dungeon art, scenery, view, mode presentation
and Dungeon CSS. Room geometry, core combat, content revision, narrative text,
facts, choices, migrations and save schema are unchanged. The only shared edit
is adding the Dungeon browser suites/evidence and time allowance to release verification. Home,
Training, Den, economy and unrelated minigame product code are untouched.

## Recovery

The execution workspace became unavailable during the pass. The surviving
older repositories were inspected and left untouched. Recorded patches were
restored into the empty original location from the exact starting SHA, without
reset, revert, checkout, stash or discarding another working tree. The scenery
and character-art blob hashes match the recorded pre-interruption versions.
The recovered changes were checkpointed on the requested remote branch before
rerunning verification. The results above refer to the recovered candidate.
The Defense integration harness was run from a source copy because it writes
a tracked JSON report; that generated result is preserved in QA scratch while
the repository's existing report remains untouched.

## Deliberately retained limits

- The caller symbol remains the existing neutral placeholder, pending the
  owner's authored choice. No OPEN mystery is answered.
- Window Hall remains the current chapter boundary; no future district or NPC
  story is invented.
- The awakening and outside night retain deliberate darkness and their emotional
  contrast. This pass improves service-floor visibility without flattening them.
- The shortest landscape screen cannot show the full endpoint card at once; the
  card now scrolls by touch with reachable actions. Portrait remains the primary
  game composition.
- Physical low-end phones and Safari still need device QA. The cached canvas
  strategy and throttled comparison provide bounded evidence, not a hardware
  performance guarantee.
