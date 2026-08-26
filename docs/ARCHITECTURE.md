# Rizo World Architecture

This document describes the active runtime at the current migration boundary. It is
an inventory, not a second ownership manifest; executable content remains composed
by `src/content/index.js`.

## Active boot path

`index.html` loads `rizo-config.js`, the install/monetization surfaces, Defense core
and canvas helpers, and `game-v79-defense.js`. After the legacy runtime publishes
`window.RizoLegacyRuntime`, `rizo-config.js` non-fatally imports
`src/rizo-world/bootstrap.js`. The service worker treats this complete graph as the
required offline shell.

## Current ownership

| Area | Authoritative owner | Migration status |
| --- | --- | --- |
| World identity and metadata | `src/content/index.js` and its plain-array modules | Native catalog/index composition; legacy bindings are explicit |
| Registry, selectors, state, events, persistence, game contract | `src/rizo-core/` | Native and tested; Core state intentionally excludes the live player |
| Public `RizoWorld` API | `src/rizo-world/` | Native facade over Core and the exposed legacy boundary |
| Live player/save/migrations | `game-v79-defense.js` | Legacy authority; preserve `rizo-life-overhaul-v2` and migration behavior |
| Defense simulation/economy | `defense-core-v79.js` plus legacy orchestration | Pure/core rules are separated; mutable run orchestration remains legacy |
| Defense canvas presentation | `defense-canvas-v79.js` | Extracted legacy helper |
| Defense UI, Care, Arcade, progression, Rizo lifecycle, world UI | `game-v79-defense.js` | Still coupled inside the legacy runtime |
| Offline/update policy | `sw.js`, boot recovery in `index.html`, registration in the legacy runtime | Public compatibility boundary; move only with two-version tests |

## Definition, index, instance, save boundary

1. Content modules under `src/content/` author identity metadata as arrays.
2. `src/content/index.js` composes those definitions and reference rules.
3. Rizo Core validates and derives registry/index views; callers do not maintain a
   second lookup table.
4. The active mutable game instances and player save still belong to the legacy
   runtime. World reads the exposed snapshot and does not copy or mutate it.

Several catalog records currently bind to immutable definition snapshots exposed by
the legacy runtime. Those bindings describe real current behavior but do not transfer
gameplay authority. A future feature extraction must first characterize the behavior,
move one owner, update the legacy consumer, and remove the superseded definition in
the same green checkpoint.

## Public compatibility surfaces

- Root HTML, CSS, JavaScript, manifest, legal pages, and asset URLs are deployed
  paths and offline-cache inputs.
- `window.RizoLegacyRuntime`, `window.RizoRuntimeQA`, and `window.RizoWorld` are
  tested runtime boundaries.
- `rizo-life-overhaul-v2` and its backup/checkpoint keys are save boundaries.
- Canonical IDs that appear in shipped content, runtime APIs, or saves are stable;
  aliases share the same global namespace. Unshipped internal IDs remain provisional.
- Service-worker changes require both a fresh offline test and an old-worker to
  candidate-worker update test before an old public path can be removed.

## Known structural debt and extraction order

`game-v79-defense.js` is approximately 8,145 lines and still owns most mutable game
domains. The next extractions should follow observed cohesion rather than line-count
splitting:

1. characterize historical saves and the first playable loops;
2. move Defense static definitions and pure calculations to a feature-owned entry
   point, without creating a second catalog;
3. extract feature-local presentation and UI only after parity coverage exists;
4. leave player/save mutation until feature boundaries stabilize;
5. archive historical root reports only after confirming no deployed path consumes
   them.

Do not create empty feature folders, generic manager/service layers, a second event
bus, or wrappers that merely preserve newly introduced duplication.
