# Rizo Core v1

Rizo Core is the shared skeleton for Rizo.world. It is intentionally additive: the current v86 runtime is not modified by this branch yet.

## Rule of the system

Content is declared once, identified by stable IDs, indexed by a registry, selected through shared query helpers, and consumed by systems/games through references. Do not duplicate canonical definitions inside gameplay code.

## Layers

### `src/content/`
Authorable content arrays. Each category owns one kind of definition:

- `games.js`
- `rizos.js`
- `traits.js`
- `items.js`
- `abilities.js`
- `enemies.js`
- `towers.js`
- `upgrades.js`
- `waves.js`
- `events.js`
- `rewards.js`

`src/content/index.js` combines these arrays into the default content pack and declares cross-category reference rules.

### `src/rizo-core/registry.js`
Loads arrays into indexed Maps, normalizes tags, rejects malformed/duplicate IDs, supports ID/tag/field lookup, and validates cross-references.

### `src/rizo-core/selectors.js`
Shared filtering, searching, and sorting. New screens and games should use selectors rather than inventing category-specific sorting code.

### `src/rizo-core/state-store.js`
Versioned mutable player/game state with subscriptions, serialization, hydration, and migration support. Saves should store references such as `item.bat_hoodie`, not copied item definitions.

### `src/rizo-core/persistence.js`
Persistence boundary. Includes memory and localStorage adapters now; Firebase/Firestore can implement the same `load/save/clear` shape later without changing game code.

### `src/rizo-core/event-bus.js`
Small shared event channel so gameplay, rewards, UI, care, seasonal systems, etc. can react without importing one another directly.

### `src/rizo-core/game-contract.js`
All future/migrated games expose:

- `initialize(context, mountPoint)`
- `start()`
- `pause()`
- `resume()`
- `destroy()`
- `getState()`

The supplied context provides registry/selectors/state/services instead of each game owning its own global infrastructure.

## ID convention

Use namespaced, lowercase stable IDs:

- `rizo.scout`
- `ability.ember_shot`
- `item.bat_hoodie`
- `enemy.runner`
- `event.halloween_2026`

IDs are data contracts. Display names may change; IDs should not change casually.

## Categories vs tags

Use a category for what a thing *is*. Use tags for reusable traits and group membership.

Example:

```js
{
  id: "item.bat_hoodie",
  category: "wearable",
  tags: ["hoodie", "halloween", "limited"]
}
```

Then different systems can query the same content without knowing each other's implementation.

## Migration rule

Do not rewrite the current game all at once. Migrate one seam at a time:

1. Define existing content in the appropriate arrays without changing behavior.
2. Replace duplicated/hardcoded lookups with registry references.
3. Move sorting/filtering to selectors.
4. Route player ownership/progression through shared state.
5. Only then extract or simplify game-specific logic.

Defense should be the first major consumer. Recommended order: abilities/enemies/towers/upgrades/waves, then rewards/state, then the game contract, then renderer/performance cleanup.

## Safety

`main` remains the current playable build. `rizo-core-v1` currently adds infrastructure only and does not load Rizo Core from `index.html`, so it cannot change live gameplay until integration is deliberately performed.

## Test

Serve the branch and open `tests/rizo-core-v1.html`. It checks stable-ID lookup, tag filtering, sorting, state references, duplicate-ID rejection, and missing-reference rejection.
