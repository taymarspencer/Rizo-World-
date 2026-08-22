# Rizo.world Working Architecture

## Current runtime

- `index.html` loads `rizo-config.js`, install/monetization bridges, `defense-core-v79.js`, `defense-canvas-v79.js`, then `game-v79-defense.js`.
- `rizo-config.js` imports `src/rizo-world/bootstrap.js` at DOM ready, after the legacy runtime exists.
- `src/rizo-core/` owns the single registry, query, state, event, persistence, game-contract, and source-resolution primitives.
- `src/rizo-world/` owns the public `window.RizoWorld` facade.
- `src/content/index.js` is the authoritative machine-readable world manifest; category arrays live beside it in `src/content/`.

## Stable IDs and bindings

- Use lowercase namespaced IDs: `game.*`, `rizo.*`, `item.*`, `ability.*`, `event.*`, `reward.*`, `system.*`, `trait.*`, `enemy.*`, `tower.*`, `upgrade.*`, or `wave.*`.
- Never rename a shipped stable ID. Add an alias when an old runtime name must keep working.
- `source: "legacy"` means the implementation remains in the established runtime. Bind it through the read-only `RizoLegacyRuntime` surface or an existing public global/DOM control.
- `source: "native"` means Core owns the definition. A legacy entry can become native later without changing its ID.
- Private closure state stays private. Register only a real, traceable binding; do not invent a migrated implementation.

## Adding content

1. Add one plain definition to the appropriate `src/content/*.js` array.
2. Give it a globally unique stable ID, name, type, tags, source, and real binding where legacy.
3. Add ID relationships and a reference rule in `src/content/index.js` when appropriate.
4. Add/adjust focused Core/World tests and keep the service-worker module graph current.

Do not create another registry, state store, event bus, game manager, content list, or launch map. Preserve working behavior, saves, visuals, and game feel unless a task explicitly asks for a redesign. `README-V*.md`, `V*-*.md`, `reports/`, and older test/report artifacts are historical context, not the active architecture.
