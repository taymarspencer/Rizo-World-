# V65 Phase 2 Changelog — Progression Integrity

## Completion authority

- Preserved separate active and completed wave values.
- Verified that only `completeDefenseWave()` advances live `clearedWave` outside isolated QA setup.
- Completion remains blocked by packet work, flat spawn work, child spawns, active enemies, and projectile resolution.

## Banking

- Bank & Leave now passes an explicit `banked` outcome into finalization.
- Active unfinished waves remain excluded from completion credit.
- Reached-wave analytics remain available in run history.
- A run with zero cleared waves can create an analytics history entry but cannot grant Embers, training, mastery, records, contracts, or milestones.

## Death

- Gate failure now passes an explicit `gate` outcome into finalization.
- Death records the unfinished wave only as `reachedWave`.
- High scores, map records, and permanent progression continue using `clearedWave`.

## Mastery exploit fix

- Fixed a hidden path where placing a Rizo, starting Wave 1, and banking immediately could increment permanent mastery `runs` despite clearing nothing.
- Mastery updates now require `clearedWave > 0`.
- Legacy/imported mastery entries with zero completed waves are removed.
- Imported mastery run count is constrained by completed mastery-wave count.

## Save migration

- Run history now preserves:
  - `wave` as the compatibility alias for cleared wave
  - `clearedWave`
  - `reachedWave`
  - `perfectWaveCount`
- Legacy history no longer loses reached-wave analytics after save normalization.
- Contract `completed` and `perfect` flags are reconstructed from `bestWave` rather than blindly trusted.
- Defense global and per-map records are clamped to `MAX_SUPPORTED_WAVE`.
- Save schema advanced from 16 to 17.

## Deployment safety

- Build ID advanced to `v65-phase2-progression-integrity`.
- Service-worker cache advanced to `rizo-game-v65-phase2-progression-integrity` to invalidate the prior cached runtime.
