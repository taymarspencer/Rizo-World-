# V64 Architecture Summary

## Layer 1 — `defense-core-v64.js`

A DOM-free, Node-testable rules module. It owns:

- phase names and action permissions
- hard limits and performance budgets
- density calculations
- explicit upgrade costs and tower investment
- Golden diminishing returns
- wave/Ember formulas
- planned enemy-count curve
- packet splitting and queue flattening
- numeric clamps and registry ID validation
- deterministic lightweight save signatures

The browser runtime consumes this module instead of re-declaring formulas in UI handlers.

## Layer 2 — `game-v64-professional-defense.js`

The integration layer owns:

- canonical game registries and map/enemy/tower definitions
- live Defense state and the legacy `wave` compatibility alias
- state transitions and allowed actions
- packet/child scheduling
- combat simulation and target caches
- DOM pools and visual throttling
- income batching
- checkpoint migration, sanitation, restoration, and warning logs
- progression consumers and run recaps
- QA factory and browser-only test hooks

## Layer 3 — `launch-v64-professional-defense.css`

One active Defense visual contract with:

- tokens for spacing, radius, borders, shadows, semantic colors, typography, safe areas, and named layers
- one shell containing HUD, field, controls, roster, and overlay surfaces
- four intentional layout modes: portrait, short portrait, landscape, and tablet/large
- shared buttons, cards, sheets, state treatments, and roster cards
- no Defense `!important` declarations

## Runtime data flow

1. A wave plan is generated once.
2. The plan is divided into packets.
3. The scheduler releases enemies only when timing and density budgets permit.
4. Splits/boss adds enter `childSpawnQueue` rather than spawning directly.
5. Towers retain targets and scan only on invalidation or timer expiry.
6. Kills add exact income to `pendingIncome`; controlled flushes update cash/HUD.
7. `isWaveFullyResolved()` verifies every queue and live object source.
8. Only then does `completeDefenseWave()` advance `clearedWave`.
9. Permanent progression consumes `clearedWave`; analytics may retain `currentWave`.

## Compatibility boundary

The whole-game save key remains unchanged. Defense checkpoints move to a v64 key and migrate the prior v42 checkpoint format conservatively. Existing pets, collection, wallets, cosmetics, worlds, and non-Defense progress continue through the existing full-game normalizer.
