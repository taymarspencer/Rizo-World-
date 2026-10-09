# Dungeon opening direction — PR #35

Base: `3c80be629e65683ba31c1b5d861b165b12c47ef8` (remote develop).
Branch: `sol/dungeon-opening-direction`. No merge or manual deployment.

## Completed changes

- YOU: sloped shoulders, shaped coat panels/lapels, bent knees, alternating heel lift and a free arm. Footfalls follow distance travelled so acceleration does not make the legs skate. The doorway beat now moves across the threshold before switching to the interior figure; its duration is unchanged.
- Window: one shopping trip with shelf pauses, two existing checks on the car, occlusion while crossing the aisles, then a stationary checkout. No modulo loop or recurring counter-to-shelf teleport. The wave settles after one restrained gesture. Interior coat/legs match the outside figure; the window mullion and counter occlude the person.
- Decoration: removed the red/white strip and its drips from sidewalk height. Added a shallow canopy and hanging valance fixed below the fascia and above the glass, with a small shadow on the building.
- Grab: sleeves now start at the capped robber's shoulders, bend through elbows and taper to cuffs, palms and thumbs. Reach and carry share the rig; redundant resting arms disappear. The opening comic has four staggered fingers, an opposed thumb, wrist and bent sleeve; other chapters retain their existing comic hands. Both car doors now swing outward rather than across the cabin.
- Existing dialogue, movement/collision rules, choices, reward/save behavior and scene durations retained. No new effects, music, features or dependencies in the shipped game.

## Mending Rows regression

[The failing develop release run](https://github.com/taymarspencer/Rizo-World-/actions/runs/37891831478) first failed the Dry Table WARM: `catchReady` was published before Nell's instruction finished, so Primary dismissed dialogue rather than beginning work. Readiness now follows that dialogue.

This exposed a separate accelerated-clock mismatch at chalk: the previous WARM was still active on the simulation clock after the scene clock skipped ahead and expired its prop. The QA scene clock now completes an already-started Kindle through the existing Core step/events while play is running. Normal gameplay timing is unchanged. No original assertion was removed or weakened.

## Verification

| Suite | Result |
|---|---:|
| All 14 Node suites | 266/266 |
| Full Dungeon release suite | 390/390 |
| Dungeon mobile controls | 185/185 |
| Dungeon cohesion | 69/69 |
| Opening direction and capture | 8/8 |

The full Dungeon result includes all 39 Mending Rows checks, original waiting visibility/reaction checks, all opening scenes, idle/reload paths, saves, reward behavior and mobile layout. Controls cover 320, 375, 390 and 430 pixel portrait viewports plus landscape, desktop and randomized touch/cancel/backgrounding flows. Cohesion covers the door-driven Rows loop and reduced motion. Syntax, Python compilation and git whitespace checks pass.

Logs: [Dungeon](dungeon.log), [controls](controls.log), [cohesion](cohesion.log), [Node](node.log), [capture](capture.log).

## Visual evidence

Full viewport screenshots are captured from the production build through the real game. Sheets keep each phone viewport at its original width; only WebP compression is applied. The comic image shows the first panel before the later panels enter.

- [320 × 568: six changed scenes](opening-320.webp)
- [390 × 844: six changed scenes](opening-390.webp)
- [Walking before/after](walk-comparison.webp)
- [Reach and door geometry before/after](reach-comparison.webp)
- [Comic hand anatomy before/after](comic-comparison.webp)
- Individual images and scene/NPC traces are alongside this report.

Reproduce: `python tests/capture-dungeon-opening-direction.py --evidence /tmp/rizo-opening-direction`.

## Remaining limits

YOU remains a flat cutout character, not a full directional sprite rig. The grip is deliberately small and partly occluded at 320 pixels; the comic carries its close-up. Evidence uses headless Chromium 134; physical iPhone/Safari behavior has not been verified in this pass. These checks cover the affected Dungeon work, not every unrelated browser release suite.
