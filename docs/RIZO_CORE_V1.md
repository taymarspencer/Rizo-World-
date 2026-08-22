# Rizo World Architecture

The active `codex/rizo-world-organizer` runtime keeps the existing game intact behind a thin compatibility seam:

```text
legacy runtime → immutable definitions / explicit services → stable IDs → RizoWorld
future native modules → registered implementation (none today) ────────┘
```

`src/content/index.js` is authoritative only for World identities, relationships, and metadata. The legacy runtime remains authoritative for gameplay numbers, live player state, saves, and private behavior. `RizoWorld.get(category, id)` reads metadata; `resolve(id)` reads a real exposed binding and may return `null` when no runtime is exposed; `available(id)` reports that distinction.

The registry buckets are games, rizos, traits, items, abilities, enemies, towers, upgrades, waves, events, rewards, systems, achievements, and maps. Item subtypes such as `wearable` remain the `type`, never the category. Canonical IDs and aliases occupy one global namespace.

Legacy content is exposed as immutable snapshots through `RizoLegacyRuntime.content`. Service functions remain deliberate live seams. Defense tower profiles are the exact table used by `defenseTowerStats()`; placement and tower instance state remain private.

The live legacy save is the sole current player authority. `RizoWorld.player()` returns its immutable current snapshot. Core’s state store is isolated future/native state and cannot write the visible player; `GameContext.updatePlayer()` fails until an explicit write-through adapter exists.

Native definitions are metadata, not implied capability. No native runtime implementation is currently registered, so native `available()` is false and invocation throws. The existing `GameHost` is only the contract for a future explicit registration path.

Boot uses build identity `v86-world-organizer` in the page, runtime, and service-worker cache. Failure to import World is non-fatal, and the required World module graph is cached for installed/offline use.

See [RIZO_CORE_V1_TESTING.md](./RIZO_CORE_V1_TESTING.md) for the current gate.
