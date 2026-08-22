# Rizo Defense v70 — Phase 7 Battlefield Architecture

## World-space contract
`syncDefenseTowerGeometry()` calculates one bounded world unit scale from rendered battlefield width:

- minimum: 0.86
- nominal: 1.00
- maximum: 1.16

The scale is written to `--def-unit-scale` and shared by tower, enemy, boss, shadow, aura, and related gameplay geometry. This keeps gameplay silhouettes coherent across short phones and tablets without device-specific sprite patches.

## World identity layer
Each map renders one `.defense-world-features` layer containing exactly three inexpensive structural feature nodes. The feature type comes from canonical map identity rather than viewport rules. These nodes are visual/world-space only and do not alter combat math.

## Landmark ownership
Authored landmark classes own their own geometry. `.defense-landmark` now provides only common positioning/filter behavior. It no longer supplies a generic width, height, or background that can erase a map-specific silhouette.

## Contrast contract
The battlefield root exposes semantic variables such as:
- `--play-outline`
- `--play-halo`
- health-bar edge/track colors
- range fill/edge colors
- placement surface colors
- road palette

Map classes specialize those variables. Gameplay entities consume the variables, so atmospheric changes do not require per-entity override chains.

## Road contract
The route remains the canonical SVG combat path. Art direction is now a restrained layered stack:
- shadow: 74
- border: 66
- fill: 58
- edge highlight: 2
- stitch: 1.5

This preserves exact path coordinates while reducing road dominance.

## Placement contract
Legal locations use environmental build pockets plus a transient local placement preview. Validity is communicated at the release point rather than by tinting the entire battlefield.

## Performance contract
Phase 7 adds only three structural feature elements per map. Low-performance states suppress/reduce atmospheric animation/filter cost. Combat scheduler budgets, density caps, pooling, and target cadence from Phase 4 are unchanged.
