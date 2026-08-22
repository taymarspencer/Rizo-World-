# Rizo Defense v70 — Phase 7 Changelog

## Battlefield hierarchy
- Reduced the road stack from the inherited heavy treatment to a quieter 74 / 66 / 58 shadow-border-fill hierarchy.
- Lowered repetitive road detail contrast so enemies, towers, and placement affordances win the visual hierarchy.
- Replaced always-visible route arrows with restrained trace-only route markers.

## Tower and enemy grounding
- Added `--def-unit-scale`, clamped from 0.86 to 1.16.
- Standard tower contract: 62 × 76 world pixels before unit scale.
- Standard enemy contract: 36 × 52 world pixels before unit scale.
- Boss contract: 64 × 84 world pixels before unit scale.
- Towers now anchor from their feet (`translate: -50% -88%`) instead of visually floating around their centers.
- Added a soft ground shadow and restrained pedestal beneath towers.
- Added adaptive gameplay outlines/halos to towers, enemies, projectiles, impacts, and health bars.

## Placement language
- Build pockets now use subtle world-specific environmental surfaces rather than a uniform debug ring.
- Added local placement foot marker, footprint/range visualization, valid/invalid treatment, and readable release label.
- Kept tap-to-place behavior and existing placement logic intact.

## World identity
- Grove: roots and vine structures.
- Ember: vents, scorched crack, lava-crater silhouette restored.
- Moon: orbital cue and crater structures; moon basin silhouette restored.
- Storm: charged puddles and directional wind cue; pylon silhouette preserved.
- Blizzard: snowbanks and ice crack; ice shelf silhouette preserved.
- Eclipse: shadow lane and reveal zones; obelisk silhouette preserved.
- World tree/ambient treatment now varies by world instead of using one generic environmental tone.

## Critical cleanup
- Removed the generic landmark styling contract that was flattening every authored landmark into the same width/height/background treatment.
- Removed selected-range dependence on the tower pseudo-element; the dedicated `.defense-range` surface is now authoritative.
- Removed visible ENTRY/GATE development capsules from normal gameplay presentation.
- Removed always-visible route-character text.
- Did not add a new `!important` patch block; the Defense section remains free of `!important` declarations.

## Build reliability
- Renamed active runtime assets to v70-specific filenames.
- Advanced the service-worker release cache to `rizo-game-v70-phase7-battlefield-art`.
- Preserved Phase 6 network-first boot-critical asset behavior and recovery screen.
