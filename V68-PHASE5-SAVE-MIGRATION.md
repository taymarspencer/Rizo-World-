# Rizo Defense v68 — Save Migration

## Version

- Current defense checkpoint key: `defense-checkpoint-v68`
- Current defense checkpoint signature version: 5
- Accepted legacy defense checkpoint versions: 1, 2, 3, 4
- v67 (`defense-checkpoint-v67`) remains a migration source.

## v67 → v68 economy migration

1. Verify the legacy v4 signature before trusting checkpoint progression.
2. Clamp current/cleared wave, cash, counters, hearts, and other trusted scalar fields.
3. Reject unknown tower/pet/enemy/queue IDs.
4. Reconstruct tower cost/investment from canonical identity and upgrade level.
5. Because v67 did not sign `openingPerkApplied`, conservatively infer **at most one** legitimate first-upgrade world discount when an eligible upgraded tower exists.
6. Set `worldPerkUsed` from canonicalized tower state rather than trusting an unsigned boolean.
7. Loaded towers receive no new placement-undo clock.
8. Recalculate enemy reward from canonical enemy type/wave.
9. Save the normalized checkpoint under v68 after successful validation.

## v68 signature additions

The signature now covers:

- top-level `worldPerkUsed`
- per-tower `openingPerkApplied`

This prevents casual editing from manufacturing repeated 20% opening discounts or inflating sell investment.

## Player-progress intent

Wallets, unlocked worlds, pets, cosmetics, records, and legitimate checkpoint progress are preserved through the existing signed-save migration. No migration rule grants unfinished-wave completion credit.
