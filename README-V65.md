# Rizo Defense v65 — Phase 2 Progression Integrity

Build date: 2026-07-31  
Build ID: `v65-phase2-progression-integrity`

This build advances the professional rebuild through Phase 2: progression integrity.

## Integrity contract

- `currentWave` is the wave currently being attempted.
- `clearedWave` is the last wave verified as fully resolved.
- `clearedWave` advances only through `completeDefenseWave()` after all packet, child-spawn, enemy, projectile, and delayed work is empty.
- Banking and death preserve `currentWave` only as reached-wave analytics.
- Permanent rewards, map records, high scores, contracts, milestones, training, and mastery require completed progress.

## Phase 2 corrections beyond v64

- Zero-clear banks no longer create or increment permanent Rizo mastery.
- Banked and gate-failure outcomes are passed explicitly rather than inferred from hearts after cleanup.
- Whole-save migration now preserves `clearedWave` and `reachedWave` separately.
- Legacy run history stores `wave` as the cleared-wave compatibility field.
- Imported zero-wave mastery entries are removed.
- Imported mastery runs cannot exceed completed mastery waves.
- Imported contract completion is derived from verified `bestWave`, not a stored boolean.
- Defense best scores and map records are clamped to the supported wave ceiling.
- Service-worker cache identity was advanced so deployment cannot serve the prior runtime.

## Verification

- Pure core: **8/8 passed**
- Static architecture/integrity: **21/21 passed**
- Browser integration: **38/38 passed**
- Browser surface/device suite: **76/76 passed**

See `V65-PHASE2-CHANGELOG.md`, `V65-PHASE2-TEST-REPORT.md`, and `V65-PHASE2-DELIVERY-STATUS.md`.
