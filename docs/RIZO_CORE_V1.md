# Rizo Core v1

Rizo Core is the shared language underneath Rizo.world. It does **not** require the existing v86 runtime to be rewritten before new work can use the foundation.

## The rule

Old and new code may coexist indefinitely behind stable IDs.

- Existing behavior is referenced through a `legacy` source adapter.
- New/rebuilt behavior can use `native` definitions.
- The stable ID stays the same when an implementation changes.
- Systems ask the World for an ID; they should not care where that implementation lives.

This removes the need for a giant migration phase.

## World flow

```text
existing runtime ---- legacy adapter ---\
                                      Rizo World -> stable IDs -> queries/systems/games
new modules -------- native source -----/
```

The current arcade is already registered this way. For example both `defense` and `game.defense` resolve to the same canonical game, and `RizoWorld.launch("defense")` clicks the exact existing Defense launch control.

## Layers

### `src/content/`
Authorable category arrays and world metadata:

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
- `systems.js`

The current eleven arcade games are registered as `source: "legacy"` with stable IDs and aliases. Runtime systems such as `RizoDefenseCore`, `RizoAds`, `RizoCloud`, launch config, boot recovery, build marker, and the existing player save are also addressable through stable system IDs.

### `src/rizo-core/registry.js`
Indexes canonical definitions, normalizes tags/categories, supports aliases, rejects malformed/duplicate IDs and alias collisions, and validates cross-category references.

### `src/rizo-core/selectors.js`
Shared filtering, searching, and sorting. Screens/games should query the World rather than building bespoke sorting logic.

### `src/rizo-core/source-resolver.js`
Chooses the implementation source for a definition. Today that means `native` or `legacy`; more adapters can be added without changing callers.

### `src/rizo-core/legacy-runtime.js`
Safely resolves existing globals, DOM controls, and localStorage-backed values. It is the compatibility membrane around the old runtime.

### `src/rizo-world/world.js`
The public facade. Important calls include:

```js
RizoWorld.get("games", "game.defense")
RizoWorld.canonicalId("games", "defense")
RizoWorld.query("games").tag("arcade")
RizoWorld.launch("defense")
RizoWorld.system("defense_core")
RizoWorld.resolve("systems", "player_save")
```

### `src/rizo-core/state-store.js`
Versioned Core-owned state for systems that move into the new foundation. Existing player state remains referenceable through the legacy bridge until there is a concrete reason to replace it.

### `src/rizo-core/persistence.js`
Ordered persistence boundary with recovery after failed writes and final flushing. Local storage is supported now; another provider can implement the same boundary later.

### `src/rizo-core/event-bus.js`
Shared events so new systems do not need to import one another directly.

### `src/rizo-core/game-contract.js`
Native/rebuilt games can implement:

- `initialize(context, mountPoint)`
- `start()`
- `pause()`
- `resume()`
- `destroy()`
- `getState()`

Legacy games do **not** have to adopt this contract before they can exist in Rizo World.

## Stable IDs and aliases

Use namespaced lowercase IDs for canonical identity:

- `game.defense`
- `rizo.scout`
- `ability.ember_shot`
- `item.bat_hoodie`
- `enemy.runner`
- `event.halloween_2026`

Aliases preserve old vocabulary or convenient names. Example: `defense` -> `game.defense`, `pacman` -> `game.rizo_runaway`, `flappy` -> `game.skybound`.

Display names and implementations may change. Canonical IDs should not change casually.

## Categories vs tags

Category answers **what is it?** Tags answer **what groups/behaviors does it belong to?**

```js
{
  id: "item.bat_hoodie",
  category: "wearable",
  tags: ["hoodie", "halloween", "limited"]
}
```

The same item can then participate in the shop, inventory, Halloween, rewards, and sorting without those systems knowing one another.

## Coexistence rule

Do not migrate code merely to make it look clean.

When old behavior already works, register/reference it. When a piece needs improvement, rebuild that piece behind the **same stable ID**. This means Rizo.world can simultaneously contain old working implementation and new organized implementation without a forced transition period.

Defense can therefore be improved by replacing only the parts we actually touch. The rest can remain legacy until there is a gameplay reason to change it.

## Boot integration

On `rizo-core-v1`, `rizo-config.js` loads the World bootstrap at `DOMContentLoaded`, after the existing synchronous runtime scripts have executed. If the World bridge fails to load, the legacy runtime remains usable and logs a warning instead of blocking startup.

`main` remains untouched until the draft PR is intentionally merged.

## Tests

CI runs both:

- `tests/rizo-core-v1.mjs`
- `tests/rizo-world-bridge.mjs`

They cover Core state/registry/persistence behavior plus aliasing, legacy source resolution, all eleven existing arcade launch paths, system/global references, player-save reference access, native+legacy coexistence, and unavailable-target failure behavior.
