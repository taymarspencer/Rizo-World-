# V66 Phase 3 Save and Checkpoint Migration

## Whole-save migration

### Phase 2 and older raw saves

A raw save with state version below `18` is accepted once as legacy data, normalized through current registries and clamps, then immediately rewritten as a signed v1 envelope. This preserves existing pets, wallets, worlds, cosmetics, records, and other legitimate progress while establishing the new integrity format.

### Current signed saves

A valid signed envelope loads normally. Every normal save writes the same verified envelope to:

- Primary save key: `rizo-life-overhaul-v2`
- Mirror key: `rizo-life-overhaul-v2:verified-backup-v1`

If the primary fails verification, the mirror is tried before sanitation.

### Invalid current signed saves

When both copies are invalid:

- The game does not crash.
- Reward-bearing state is not trusted.
- Wallet, arcade/Defense records, achievements, contracts, mastery, season rewards, consumables, treasures, expeditions, and reward counters reset to canonical defaults.
- Sanitized pet identity, roster, known accessories, known rooms, settings, and other low-risk continuity data are retained where practical.
- Collection counts are reconstructed from the retained actual pets rather than trusted from storage.
- A local validation warning is recorded.

This fallback is intentionally conservative because invalid data cannot prove which reward fields were legitimate.

## Defense checkpoint migration

### Valid v3 checkpoint

Loads after registry validation, clamps, and derived-value reconstruction.

### Valid v2 checkpoint

The legacy v2 signature is verified with its original salt, then the checkpoint is normalized and rewritten as v3.

### Unsigned v1/legacy checkpoint

Migrates conservatively. It may preserve valid map/tower placement continuity, but reward-bearing active-wave fields are treated as untrusted and rewritten under v3.

### Invalid v2/v3 signature

The active wave is not resumed as earned progress. The migration:

- Restores `clearedWave` only from the already normalized permanent map record.
- Sets `currentWave` to that safe cleared value.
- Returns to planning/wave-complete state.
- Limits cash to canonical opening cash.
- Clears active enemies, packet queue, child queue, kills, damage, bosses, perfect waves, temporary effects, and delayed work.
- Resets tower upgrades and combat counters.
- Rebuilds tower owners from the current real roster.

## Compatibility notes

- Save key remains unchanged so existing installations can migrate.
- Older checkpoint keys are read as migration sources and deleted after successful current-format write.
- Build metadata and service-worker cache are versioned together to avoid loading new saves through stale JavaScript.
