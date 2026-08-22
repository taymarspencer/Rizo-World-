# Rizo Defense v71 — Final Rebuild Changelog

## Phase 1 — Audit and safety baseline
- Inventoried progression consumers, save boundaries, QA surfaces, UI override debt, and combat state.
- Established automated checks before behavioral changes.

## Phase 2 — Progression integrity
- Split `currentWave` from `clearedWave`.
- Corrected completion, banking, defeat, records, mastery, contracts, training, perfect waves, and run history.
- Added conservative history/save migration semantics.

## Phase 3 — Production hardening
- Moved QA behind the single gated `window.RizoRuntimeQA` namespace.
- Added signed save envelopes/checkpoints, clamps, known-ID validation, fail-closed sanitation, verified backup recovery, and canonical derived-value reconstruction.

## Phase 4 — Performance scheduler
- Rebuilt waves around controlled packets, packet breaks, and paced child-spawn release.
- Added explicit mobile density/visual budgets.
- Separated simulation time from wall/control time.
- Added target caching/shared snapshots and batched income/HUD writes.

## Phase 5 — Economy and flow
- Standardized starting cash at 220.
- Removed map-based general reward inflation.
- Added explicit deployment escalation and upgrade costs `110 / 180 / 280 / 420`.
- Added five-second full planning undo, 70% normal planning refund, phase-aware build permissions, capped Golden stacking, diminishing Golden active payouts, one-shot world opening discounts, and completed-accomplishment permanent rewards.

## Phase 6 — UI foundation and launch reliability
- Added explicit Defense phase state machine and contextual overlay manager.
- Rebuilt portrait/short-phone/landscape layout contracts and HUD hierarchy.
- Fixed the credible new-HTML/old-runtime cache mismatch path by versioning boot assets and changing service-worker policy.
- Disabled automatic install gating and added visible clean-reload/cache-recovery controls.

## Phase 7 — Battlefield art cohesion
- Restored authored per-world landmark silhouettes previously flattened by a generic rule.
- Grounded towers at their feet, normalized bounded unit scale, quieted roads, improved placement pockets/ranges, removed development labels, added adaptive gameplay contrast, and strengthened six world identities.

## Phase 8 — Final polish and verification
- Added one reusable cinematic hierarchy for wave start, packet arrival, boss entrance, danger/gate damage, upgrades, ability unlocks, perfect waves, normal clears, successful banking, and defeat.
- Added priority arbitration so low-priority packet moments cannot overwrite boss/terminal moments.
- Added reduced-motion behavior that keeps information while removing cinematic movement.
- Bank/defeat enter terminal `run-complete` state before recap teardown, preventing continued combat beneath a terminal moment.
- Added dedicated Phase 8 browser regressions, 100-event cinematic DOM stress, 50-wave soak, and fresh release screenshot gallery.
- Advanced all boot-critical filenames/cache identity to v71 together so final polish does not regress the Phase 6 launch fix.
