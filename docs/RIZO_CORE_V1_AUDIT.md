# Rizo Core v1 Audit

Date: 2026-08-22

## Scope

Audited and executed the Rizo Core / Rizo World infrastructure before merging it into `main`. The branch now includes both the original data-driven Core and a coexistence bridge that can reference the current v86 runtime without forcing a rewrite.

## Release-blocking defect found and fixed

### `StateStore.update()` could destroy the entire state

The original implementation treated a callback return value as replacement state. Normal mutation code such as:

```js
state.update(current => current.player.ownedRizos.push("rizo.scout"));
```

returns the new array length (`1`). The store then normalized that primitive and collapsed the save to effectively `{ version: 1 }`.

`update()` is now deliberately mutation-style and ignores callback return values. Full replacement must use `replace()`.

## Additional Core defects found and fixed

1. Content category keys were normalized inside the registry but not before Core assembled categories, so `Items` could collide with the built-in `items` category.
2. `services.events` could shadow the authoritative Core event bus and split communication into two buses.
3. One rejected persistence save left the promise chain rejected, preventing all later saves from running.
4. A game that partially initialized and then threw was not asked to destroy its partial resources.
5. Registry deep-freezing could freeze nested arrays/objects owned by the source content pack. Definitions are now cloned before canonical freezing.
6. Hydrating persisted state could immediately schedule an unnecessary echo-save of the same payload.
7. Primitive state replacement is now rejected instead of silently degrading to a minimal version object.

## Coexistence architecture added

The architecture no longer assumes existing gameplay must be migrated into new files before it can participate in Rizo World.

- Definitions can declare a source (`native` or `legacy`).
- Stable aliases resolve to one canonical ID.
- Alias/canonical collisions are rejected.
- A source resolver hides implementation location from callers.
- The legacy adapter can safely reference existing globals, DOM launch controls, and localStorage values.
- Blocked/throwing browser storage access is treated as unavailable rather than crashing the bridge.
- Existing code can later be replaced by a native implementation behind the same stable ID.

## Existing runtime now indexed through public seams

All eleven current `data-minigame` launch modes have canonical game IDs and legacy bindings. Examples:

- `defense` -> `game.defense`
- `pacman` / `maze` -> `game.rizo_runaway`
- `flappy` / `glide` -> `game.skybound`
- `emberrun` / `rush` -> `game.rizo_courier`

Existing public runtime systems are also addressable through stable system IDs, including Defense Core, ads, cloud, launch config, boot recovery, runtime build marker, and the existing player-save record.

Private variables buried inside the monolithic legacy IIFE are intentionally **not** fake-indexed. They remain legacy implementation details until a real public seam or a gameplay-driven replacement is introduced.

## Runtime boot integration

`rizo-config.js` now starts the World bridge at `DOMContentLoaded`, after the existing synchronous runtime scripts execute. The import is non-fatal: if the bridge fails, the legacy runtime remains playable and logs a warning.

The service worker cache was versioned to `rizo-game-v86-rizo-world-core-v1` and the entire World/Core/content import graph was added to the required offline shell. This prevents online and installed/offline sessions from silently running different architectural layers.

## Executed tests

Core suite covers registry/reference validation, selectors, state mutation and migrations, events, game lifecycle, persistence ordering/recovery, and content-pack merging.

World bridge suite covers canonical aliases, alias collision rejection, all eleven current arcade launch bindings, public runtime-system resolution, existing save referencing, legacy availability/error handling, and native+legacy coexistence.

Static/offline suite validates DOM-ready bootstrap wiring, cache versioning, inclusion of the actual module import graph in the service-worker shell, and existence of cached module files.

CI is the source of truth for the final branch head. Do not merge if the latest workflow is not green.

## Remaining boundaries (not migration chores)

- Core-owned player state still needs a domain schema before real saves depend on it.
- Event listeners are synchronous; one throwing listener can interrupt later listeners.
- Native GameHost does not yet require the game ID to exist in the registry, which keeps legacy/prototype work flexible.
- Most canonical content arrays other than games/systems remain intentionally empty because the current monolithic runtime does not expose those private definitions publicly.
- Browser/device gameplay still needs a preview smoke test before production merge; Node/CI proves contracts and wiring, not visual interaction or device performance.

## Recommendation

Do not perform a bulk migration. Keep the stable World layer as the shared language. Existing working behavior remains legacy behind references; anything new or meaningfully rebuilt enters as native content behind stable IDs. Defense can now be worked on directly without paying a separate architecture-transition cost first.
