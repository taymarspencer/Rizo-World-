# Phase 6 Save Migration Notes

Phase 6 does not change the serialized Defense checkpoint schema or economy-derived checkpoint signature. `defense-core-v70.js` therefore remains checkpoint version 5 and preserves v68/v67 legacy verification paths.

Existing local wallets, worlds, pets, cosmetics, records, mastery, contracts, current/cleared wave migration, and validated checkpoints continue through the Phase 3–5 sanitizer/migration path.

The new boot recovery cache reset deliberately does **not** clear localStorage or player saves. It unregisters service workers and deletes only cache names beginning with `rizo-game-` before reloading.
