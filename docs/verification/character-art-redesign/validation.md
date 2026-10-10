# Validation results

Production art/render source verified at `cad251cb131ca4b1a9fdc90371cbc061c3027bce`. Final evidence-only commit also corrects the capture selector to the live runner ID and its existing `run` state and rechecks both phone sizes.

| Suite | Result | Command |
| --- | --- | --- |
| JavaScript contracts/rules (all 14 suites) | **266/266 passed** | `all tests/*.test.js` |
| Dungeon journey | **390/390 passed** | `python3 tests/browser-dungeon.py` |
| Character Lab | **98/98 passed** | `python3 tests/browser-dungeon-character-lab.py` |
| Escape, collectors and comic continuity | **88/88 passed** | `python3 tests/browser-dungeon-escape.py` |
| Depth, van quiet beats, lighting and facing | **45/45 passed** | `python3 tests/browser-dungeon-depth.py` |
| Phone controls, rotation and touch fuzz | **185/185 passed** | `python3 tests/browser-dungeon-controls.py` |
| Character phone captures | **30/30 passed** | `python3 tests/capture-dungeon-character-art.py --evidence /tmp/rizo-character-art` |
| Opening phone captures/checks | **8/8 passed** | `python3 tests/capture-dungeon-opening-direction.py --evidence /tmp/rizo-opening-art` |

The JavaScript suites are ads-boundary, core-contracts, defense-core, dungeon-core, dungeon-input, dungeon-kit, home-core, mode-host, public-product, release-integrity, service-worker-policy, training-boundaries, worker-b-economy and worker-j-defense-guard. Together they pass 266 checks. The five browser suites pass 806 checks.

The final production build also succeeds and excludes `docs/`, `tools/`, `tests/` and all review images.

The cast captures pass at both 320×568 and 390×844. Baseline and final capture JSON record the same scene names, viewport sizes and screen bounds for all 30 pairs. The additional opening run passes all 8 checks in both versions and supplies 12 more phone pairs. Targeted runner recaptures pass 2/2 in both builds, with the valid running state.

Visual review covered all four crew members seated and standing, YOU in the car/lot/store/portrait, Nell and Orr with dialogue, all collector profiles, comic close-ups, Latch in gameplay, and the Night Porter. All lab states, mirrors and expressions paint; the lab and evidence remain excluded from the shipped site. No existing test assertion was removed or weakened.

Latch's world-art function, `vanRide` and `NELL_ARMS` were also compared against develop and remain byte-for-byte identical. Rizo's canonical sprite source, dungeon content, mode/story controller, core, input and progression code are unchanged. `git diff --check` passes.

Evidence uses Chromium, not Safari or physical-device testing. No merge or deployment was performed.
