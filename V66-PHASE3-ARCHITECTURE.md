# V66 Phase 3 Architecture Summary

## Trust boundary

All storage, imported files, Keeper codes, and Defense checkpoints are treated as untrusted input. The load path follows this order:

1. Parse without executing stored content.
2. Verify the versioned signature when present.
3. Normalize structure and clamp primitive values.
4. Resolve identifiers through canonical registries.
5. Recalculate derived gameplay values.
6. Fall back to a verified mirror or conservative sanitized state when verification fails.
7. Write the migrated/sanitized result back in the current signed format.

No stored functions, HTML, classes, prices, rewards, multipliers, owner source, or calculated combat stats are restored as authority.

## Core module

`defense-core-v64.js` remains the dependency-free source for:

- Shared limits and budgets
- Phase rules
- Density calculation
- Upgrade costs and tower investment
- Golden bonus cap
- Packet planning
- Reward calculations
- Checkpoint signatures
- Whole-save signatures
- Numeric clamp helpers

Its internal version is now `3`. The filename remains unchanged to avoid breaking deployed asset references and old caches; release identity is controlled by index metadata and the service-worker cache key.

## Game runtime

`game-v64-professional-defense.js` owns:

- State migration/normalization
- Signed envelope load/save/import/export
- Verified-backup recovery
- Registry-aware checkpoint canonicalization
- Runtime reconstruction
- QA factory construction and gating
- Local validation-warning telemetry

The state schema is now `18`.

## QA boundary

`createRizoRuntimeQA()` is built as a single frozen object. It is assigned only under the explicit QA condition. Production code does not call it, and no individual helper is attached to `window`.

## Failure behavior

- Parse failure: load defaults and record a warning.
- Primary signature failure with valid backup: restore backup and rewrite current save.
- Primary and backup failure: preserve sanitized pet timeline/known cosmetics where practical, reset reward-bearing progress, and record a warning.
- Checkpoint signature failure: preserve only verified permanent cleared-wave record, canonical starting cash, valid tower ownership/placement, and planning state; discard active reward-bearing combat state.
- Unknown IDs: reject the object/entry or use a documented canonical default.
