# Character rescue — recoverable checkpoints

Branch: `astra/dungeon-character-rescue`, based on PR #44 at
`68d414426b8d9e3790cce154521818c40524c253`. Never merge without approval.
One worker. PR #45 inspected, not imported. Rizo and Latch art unchanged.

## Checkpoint 1 — Keeper figure and ground contact

This commit establishes the first working slice. Find its exact SHA with
`git log -1 --format=%H -- modes/dungeon/dungeon-art.js`.

- Keeper has a shorter single raincoat silhouette, compact curls/beard,
  calmer eyes, short scarf, and one hand/umbrella attachment.
- World and shop window now call the same figure; portraits reuse its head
  and coat; seated car uses its back-of-head geometry.
- Feet use distance and the actual two-dimensional movement vector, with
  a planted stance and lifted return. Ease at route endpoints is in distance.
- No generated atlas, external asset, framework, story/save/collision change.
- Cache, shell and runtime marker: `v99-character-rescue`. Build output now
  reads the actual shell marker rather than reporting a hardcoded old one.

Checks: all 17 Node test scripts passed (including 20 new ground-contact
combinations); production build passed. Live opening captures at
320/390/430: 12/12 passed on initial figure revision. Final small head/eye
and mirrored-hip corrections still require the next capture pass.
Character Lab and browser regression gates are running, not claimed passed.

Evidence: `character-rescue/keeper-before-390.png` and
`character-rescue/keeper-after-390.png`, actual opening renderer.
These show initial figure revision, not every later correction.
Preview: pending first push / Pages build. PR: pending creation.

Known limitations: first slice is reviewable, not artistically approved.
Door interaction and shortened legs need movement-sequence inspection.
Robbers and supporting cast have not yet been changed in this checkpoint.
Physical iOS/Safari not tested.

## Research / pipeline choice

Kenney's official support page confirms asset-page assets are CC0:
https://kenney.nl/support . No external art was imported; the repo already
has shared Canvas/SVG head and garment primitives compatible with Latch.

Developer discussion prompted a measurable ground-contact test rather than
subjective animation-speed tweaks:
https://www.reddit.com/r/gamedev/comments/wofi7p/ . The implementation is
independently verified: actor displacement plus stance-foot displacement
must be zero in world space, including diagonal movement and both facings.

## Recovery

Fetch this branch and compare local/remote HEAD before continuing. Preserve
newer changes. Read this document, PR checks, and latest preview status.
Next: finish Keeper movement evidence, then fix Cap's duplicated grabbing
arms and evaluate the crew/supporting cast at actual gameplay scale. Keep
one draft PR targeting `feat/dungeon-complete-cast-rebirth`.
