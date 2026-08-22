# V64 Save Migration Notes

## Keys and versions

- Main game key remains `rizo-life-overhaul-v2`.
- New checkpoint key: `rizo-life-overhaul-v2:defense-checkpoint-v64`.
- Recognized legacy checkpoint key: `rizo-life-overhaul-v2:defense-checkpoint-v42`.
- Checkpoint schema version: 2 (`RizoDefenseCore.VERSION`).
- Checkpoints older than seven days, from another Keeper ID, or from an unknown map are rejected.

## Legacy wave mapping

Legacy checkpoints stored one `wave` value.

- A legacy checkpoint actively in `wave` state maps to `currentWave = oldWave` and `clearedWave = max(0, oldWave - 1)`.
- A legacy setup/between-wave checkpoint maps conservatively to its confirmed completed position.
- The migration never assumes an active wave was cleared.
- After successful restoration, the normalized v64 checkpoint is written once and the legacy key is removed.

## Preserved data

The existing whole-game migration continues preserving legitimate:

- Ember and shard wallets
- pets, variants, stages, skills, genes, bonds, cosmetics, and accessories
- unlocked worlds and collection entries
- non-Defense scores and history
- valid Defense map records and mastery data

## Reconstructed checkpoint data

The loader does not trust stored derived fields. It reconstructs:

- enemy max HP, current HP ratio, speed, armor, reward, damage, traits, and boss identity
- tower base/deployment cost, explicit upgrade investment, total spending, target cache, and combat stats
- queue entries, packets, child entries, target modes, doctrines, status IDs, and map references from known registries
- projectile state is intentionally not trusted/restored; combat resumes safely from canonical live entities

## Tamper/corruption response

- Important values are clamped.
- Unknown IDs are removed.
- Impossible derived values are replaced.
- A lightweight salted signature identifies edited/corrupt v64 checkpoints.
- Invalid signatures do not crash the game; the checkpoint is sanitized and a local validation warning is recorded.
- Sanitized values cannot create reward credit because permanent rewards still require `clearedWave` and verified completion.

This is corruption resistance and casual-edit deterrence, not cryptographic security. Server-authoritative competitive records remain a separate future project.
