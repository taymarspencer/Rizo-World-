# Validation

Baseline: fetched PR #36 head `3142ce144ee0ca0122fd1c5faaa427b06ba3cb17`.

Production art under test: `81c84a0e00b07bd57bda8f66091a0195783d8a8d`. Subsequent changes are capture tooling and review evidence. The target remains `feat/latch-bar-character-art`; no merge or deployment was performed.

## Results

| Check | Result |
| --- | --- |
| All 14 existing JavaScript suites | 266/266 passed |
| Dungeon journey | 390/390 passed |
| Character Lab | 98/98 passed |
| Escape and collector comic continuity | 88/88 passed |
| Depth and van beats | 45/45 passed |
| Phone controls and touch fuzz | 185/185 passed |
| Cast capture, baseline | 30/30 passed |
| Cast capture, candidate | 30/30 passed |
| Exact cast framing/position/pose comparisons | 30/30 matched |
| Normal-motion opening capture, each build | 8/8 passed |
| Collector comic captures, each build | 4/4 passed |

The 266 JavaScript and 806 browser assertions total **1,072 passed**. Capture checks are counted separately. No existing test assertions or thresholds were weakened. The Orr hatch fixture was corrected to include the prerequisite `rows:split` beat, and now explicitly asserts that Orr is present.

The complete production package builds successfully: **166 files**, build `v97-dungeon-collection`, fingerprint `383d317ba289fb7584e860b479069157ae109ddae186af1b2b31497a06f7ae2a`. A fresh package after the evidence changes has the same fingerprint. Review screenshots, reports, tests, tools and the development kit are excluded. `git diff --check` passes.

## Preservation checks

Source comparison against PR #36 confirms these are byte-identical:

- Latch's world-art function and portrait function.
- Van motion, Nell's 13-state arm endpoint table, actor scale table and speech attachment heights.
- `dungeon-content.js`, `dungeon-core.js`, `dungeon-mode.js`, `dungeon-input.js`, `dungeon-view.js`, `dungeon.css` and `dungeon-comic.css`.

Production changes are restricted to `dungeon-art.js`, `dungeon-scenery.js` and `dungeon-comic.js`. Rizo's canonical art, save schema, progression, scene timing, input and movement systems are unchanged. Existing scenarios exercise save/reload, meals and work states, kidnapping beats, capture threats, both escape comics and mobile input.

## Evidence conditions and limits

Cast stills use identical 320×568 and 390×844 mobile Chromium contexts, CSS-size screenshots, scene selections, camera sizes and actor coordinates. A capture-only frame hold redraws the real renderer with zero elapsed time. [Baseline](before/capture.json) and [candidate](after/capture.json) record screen rectangles, visible NPC poses, player coordinates and enemy positions/states; all 30 pairs match for those fields.

The normal-motion opening and collector comic evidence uses the existing game flow. Overall there are **46 pairs of full phone frames**: 15 cast scenes, six opening beats and two collector comics, each at both widths. Separate portrait sheets use the actual 46px and 56px outer frames; 128px studies are clearly labelled and are not mobile-readability evidence.

Tests establish behavior preservation. The [art report](README.md), full-scene comparisons and actual-size portraits establish the visual changes and their limitations. Orr's serving/dry expressions and Driver's emotional range still need attention. Factory occlusion and low light remain visible. Safari and physical phones have not been tested.

## Reproduce

```bash
python tools/build-site.py --out /tmp/rizo-art-build
for test in tests/*.test.js; do node "$test"; done
python tests/browser-dungeon.py --directory /tmp/rizo-art-build
python tests/browser-dungeon-character-lab.py --directory /tmp/rizo-art-build
python tests/browser-dungeon-escape.py --directory /tmp/rizo-art-build
python tests/browser-dungeon-depth.py --directory /tmp/rizo-art-build
python tests/browser-dungeon-controls.py --directory /tmp/rizo-art-build
```

Capture commands and baseline instructions are in the [report](README.md). The browser scripts use the same production build. Chromium is the tested browser; the recorded checks do not substitute for physical-device or Safari coverage.
