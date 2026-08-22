# Rizo Core v1 Audit

Date: 2026-08-22

## Scope

Audited and executed the Rizo Core v1 infrastructure before any runtime integration with `index.html` or Defense.

## Release-blocking defect found and fixed

### `StateStore.update()` could destroy the entire state

The original implementation treated a callback return value as replacement state. Normal mutation code such as:

```js
state.update(current => current.player.ownedRizos.push("rizo.scout"));
```

returns the new array length (`1`). The store then normalized that primitive and collapsed the save to effectively `{ version: 1 }`.

`update()` is now deliberately mutation-style and ignores callback return values. Full replacement must use `replace()`.

## Additional defects found and fixed

1. Content category keys were normalized inside the registry but not before Core assembled categories, so `Items` could collide with the built-in `items` category.
2. `services.events` could shadow the authoritative Core event bus and split communication into two buses.
3. One rejected persistence save left the promise chain rejected, preventing all later saves from running.
4. A game that partially initialized and then threw was not asked to destroy its partial resources.
5. Registry deep-freezing could freeze nested arrays/objects owned by the source content pack. Definitions are now cloned before canonical freezing.
6. Hydrating persisted state could immediately schedule an unnecessary echo-save of the same payload.
7. Primitive state replacement is now rejected instead of silently degrading to a minimal version object.

## Executed tests

The executable suite covers:

- stable ID lookup
- category normalization
- caller-owned content isolation
- duplicate ID rejection
- ID format rejection
- broken cross-reference rejection
- tag normalization/filtering
- any/all tag queries
- search/sort/clone/limit query behavior
- Array.push-safe state updates
- defensive state cloning
- chained state migrations
- future-version rejection
- primitive-state rejection
- event bus on/off/once behavior
- authoritative event bus injection
- full game lifecycle
- cleanup after initialization failure
- player/per-game context updates
- ordered persistence writes
- final flush on destroy
- recovery after a transient save failure
- hydration without immediate echo-save
- normalized content-pack merging

Local adversarial execution after fixes: all tested cases pass.

## Remaining limitations before real save migration

These are not blockers for keeping the skeleton branch, but should be addressed before real player saves become dependent on Core:

- Player-state shape is not yet schema-validated beyond being an object and carrying a supported version.
- Event listeners are synchronous; a throwing listener can interrupt later listeners.
- Game IDs are not yet required to exist in the `games` registry, which is useful for legacy migration but should eventually become stricter.
- The content arrays are intentionally mostly empty. Real Defense data has not been migrated yet.
- Rizo Core is not loaded by the current runtime, so this audit tests infrastructure behavior, not game integration.

## Current recommendation

Keep `rizo-core-v1` isolated until CI passes. Then use Defense as the first migration consumer in this order: abilities, enemies, towers, upgrades, waves, rewards/state, game lifecycle, renderer/performance cleanup.
