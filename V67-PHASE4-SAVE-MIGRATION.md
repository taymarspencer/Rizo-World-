# V67 Phase 4 Save Migration

## Checkpoint identity

- New key: `rizo-life-overhaul-v2:defense-checkpoint-v67`
- Legacy inputs checked: v66, v64, v42
- New checkpoint signature schema: 4
- Accepted signed legacy schemas: 2 and 3

## Migration behavior

A valid V66 schema-3 checkpoint is verified with its original salt, canonicalized through the existing Phase 3 trust boundary, loaded, and rewritten as a V67 schema-4 checkpoint. The old key is removed after the successful write.

No permanent progression values are inflated during this migration. `currentWave` and `clearedWave` retain their Phase 2 meanings.

## Runtime-only reset

The following are deliberately rebuilt rather than imported:

- `realClock`
- `retargetAtReal`
- runtime target references
- shared target snapshot and expiry
- next child wall-time release
- child insertion sequence
- pending income aggregation
- last income batch telemetry
- applied visual-speed cache

The saved simulation clock remains canonical for enemy progress and status timing. Runtime controls restart from safe local defaults.

## Failure behavior

Unknown versions are rejected. Invalid signatures follow Phase 3 fail-closed sanitation. The game does not crash and does not reward forged scheduler or checkpoint fields.
