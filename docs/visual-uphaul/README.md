# ASTRA visual uphaul

Branch: `feat/astra-adhd-visual-uphaul`
Verified develop starting point: `8c90028286b67b89ccf187ce9f022ead51d53c56`.

## Required targets

- **Nell:** load-bearing work stances, bent knees, clearer palms and repair tools, worn work clothes, grey hair and tired facial cues. Live dialogue expressions now reach her world face. Support, lift, brace and fit change the body silhouette.
- **Orr:** planted asymmetric stance, supported tray grip, hanging towel and apron folds, distinct hands-free posture and dry/irritated expressions. His existing entrances and room anchors remain intact.
- **Kidnappers:** lanky hood, small padded jacket/beanie, wide capped track jacket and belted driver have separate silhouettes, hands and reactions. Existing van orientation, seat anchors, wheel, road, doors, phone staging and cooler logic are preserved.
- **Ball:** stitched color panels, rounded lighting and contact shadow; physical bounce inside its retained touch target.
- **Toys:** wood grain and cloth repair on the stump, low water surface with ripples, quieter leaves and pot on the moon bush. Their existing actions stay intact.
- **Bed:** a low, patched cloth nest with pillow, uneven quilt edge, stitches and depth; early cardboard tier retained. Rizo settles behind the quilt.
- **GO:** destination environments with an entrance, steps, lamps and field approach; Rizo occupies each departure scene. Existing destinations and routing remain intact, with readable full-width actions.
- **TRAIN:** practice yard, floor marks, bench, bag/ladder/target, Rizo at the station and earned patch marks. Focus selection changes the staged equipment; existing drill and reward contracts remain intact.

## Nearby fixes made during the pass

| Noticed | Change | Reason |
| --- | --- | --- |
| Mixed-skill drills could stage the wrong equipment | ANYTHING uses the featured drill's strongest skill | The station should match the practice |
| Dungeon entry read as an abstract symbol | Built a door, masonry, steps and lamplight | Make the destination a place |
| Navigation ignored OS reduced motion | Reused the existing combined reduced-motion helper | Respect both system and saved preferences |
| Toy bounce could compete with dragging | Drag positioning takes precedence | Keep the ball attached to the gesture |
| First actions fell behind fixed navigation at 320×568 | Compact headings and scene spacing at the smallest viewport | Keep departure and practice immediately usable |
| Global idle animation overrode the tucked sleeping pose | Sleeping shell explicitly disables idle animation | Let Rizo rest in the bed |
| Lab omitted useful Nell/Orr expressions | Added existing expression choices to their sheets | Review expressions alongside poses at phone scale |
| Drill rows needed clearer touch/focus feedback | Improved spacing, focus and pressed treatment while restaging TRAIN | Keep the practice list readable and usable |

## Focused evidence

Download and open [the self-contained evidence gallery](gallery.html) to view the captures.

Captured from the final production artifact (HOME/TRAIN/GO/van), plus the existing Character Lab (cast). No game code changed during finalization.

- [Smallest phone: HOME / TRAIN / GO](gallery.html#phone-320)
- [Belongings and tucked sleeping pose](gallery.html#belongings)
- [Three practice stations](gallery.html#practice-stations)
- [Van in play at 390px](gallery.html#van-390)
- [Nell poses and expressions](gallery.html#sheet-nell)
- [Orr poses and expressions](gallery.html#sheet-orr)
- [Van crew reactions](gallery.html#sheet-van-crew)
- [320px cast, values and silhouettes](gallery.html#lineup-320)

## Verification

The interrupted run had already passed the checks below. They were retained rather than rerun without a code change. Temporary logs from that phase were lost during the interruption; the Defense result was recovered from its generated report.

| Established check | Result |
| --- | --- |
| Node suites | All 13 passed |
| HOME / TRAIN / GO | 110/110 |
| Den interactions | 57/57 |
| Visual uphaul phone contracts | 72/72 (including final two 320px action checks) |
| Character Lab, earlier pass | 89/89; final expanded lab rerun below |
| Dungeon controls | 185/185 |
| Dungeon cohesion | Passed; 21 rooms |
| Dungeon depth | Passed |
| Defense integration | 78/78 recovered |
| Public product on production build | 150/150 |

Final resumed verification is recorded in `verification.json`. Source syntax and `git diff --check` pass. The production artifact contains 164 files; fingerprint `65470a84ac77f7333184a13f1be4acc757e7d417443f22994904399b2cb9b5cd`. A focused final production capture of HOME, TRAIN, GO, sleep, equipment and the van raised no browser errors.

Phone widths checked: **320×568, 375×812, 390×844, 430×932**, including touch targets, horizontal overflow and OS/saved reduced motion. Browser checks use Chromium emulation, not physical iPhone Safari.

## Deliberately left alone

- Existing caller-symbol placeholder needs an owner/art decision; no lore or dialogue was invented.
- Existing global header/navigation styling remains; a wider shell redesign is outside this pass.
- Rizo's sleeping pose uses the existing sprite, whose eyes are not newly redrawn. Dedicated sleeping face art is a possible later asset pass.
- Small seam/tool details soften at 320px; silhouette and posture carry identity there.

No save schema, progression, economy, authored dialogue, story chronology, Defense mechanics, deployment or service-worker changes.
