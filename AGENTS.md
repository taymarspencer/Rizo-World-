# Rizo.world Working Architecture

- Active runtime: `index.html` → `rizo-config.js` → the existing v86 runtime files. `rizo-config.js` boots `src/rizo-world/bootstrap.js` non-fatally after the legacy runtime exists.
- `src/content/index.js` is authoritative for World identity and metadata. Legacy gameplay values remain authoritative in `game-v79-defense.js` until a component is deliberately rebuilt as native.
- `src/rizo-core/` owns the only registry, selectors, Core state store, event bus, persistence boundary, source resolver, and native game contract. `src/rizo-world/` owns the public `RizoWorld` facade. Never create parallel infrastructure.
- Canonical IDs and aliases share one global namespace. Use lowercase namespaced IDs and fix collisions before merge. Registry category is the bucket (`items`); subtype is metadata (`wearable`).
- `source: "legacy"` bindings must point to a real exposed implementation or immutable definition snapshot. Keep private closure behavior private; do not fake-index it.
- `RizoWorld.get()` returns identity metadata. `resolve()` returns an available runtime binding or `null`; `available()` is the capability check. No native runtime is registered yet, so native invocation must fail explicitly.
- The current player authority is the live legacy save. Read it with `RizoWorld.player()` / `playerState.snapshot()`. It is read-only from World/Core; `GameContext.updatePlayer()` must fail until safe legacy write-through exists. Core state is isolated future/native state, not the visible player wallet.
- Add content by editing the relevant plain array in `src/content/`, giving it a truthful ID, and binding existing behavior where safe. Preserve stable IDs when an implementation later becomes native.
- `README-V*.md`, `V*-*.md`, `reports/`, `BUILD-MANIFEST-SHA256.txt`, and the short audit/status history notes are historical artifacts, not active architecture or integrity inputs.

Preserve working gameplay, visuals, saves, balance, and legacy fallback unless a task explicitly changes them.
