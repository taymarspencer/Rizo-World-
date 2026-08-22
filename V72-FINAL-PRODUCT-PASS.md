# Rizo Defense v72 — Final Product Pass

## Release intent

v72 is a targeted product pass on the verified v71 architecture. It does not reopen the eight-phase rebuild or replace working systems. The shipped changes address three player-facing weaknesses found by inspecting and exercising the actual v71 build: late-run cash inflation, weak boss-arrival rhythm, and battlefield information clutter at a full field.

Build marker: `v72-final-product`  
Playable entry: `index.html`

## Player-facing changes

### 1. Late-run money stays relevant longer

The opening economy is deliberately preserved. Wave 10 rewards and the first three paid deployment prices are unchanged from v71.

After the early game:

- Enemy bounty growth stops compounding indefinitely with both wave number and larger wave size. After Wave 10, per-pop income is normalized against the planned size of a normal wave.
- Wave-clear income ramps strongly through Wave 20, grows gently through Wave 50, then stops growing linearly forever.
- Later field slots become real commitments while the first three paid deployments keep the v71 prices.
- Upgrade tiers 3 and 4 now cost 320 and 640 instead of 280 and 420. Tiers 1 and 2 remain 110 and 180.
- Golden income remains capped at the existing 1.22 multiplier; no Golden rewrite was added.

Modeled perfect Grove cash, including deterministic split children but excluding optional boss summons:

| Cleared through | v71 | v72 |
|---:|---:|---:|
| Wave 10 | 3,763 | 3,763 |
| Wave 20 | 13,982 | 11,590 |
| Wave 30 | 32,529 | 21,176 |
| Wave 50 | 92,581 | 42,550 |
| Wave 100 | 326,334 | 95,994 |
| Wave 150 | 683,371 | 149,702 |

For a ten-Rizo field with one free active Rizo, nine distinct paid deployments, and all ten towers fully upgraded, the modeled finite spend rises from 15,920 to 25,080. This keeps the early learning curve intact while delaying the point where cash ceases to drive decisions.

The detailed model is saved in `reports/v72-economy-model.json`.

### 2. Bosses now receive an actual entrance

Boss waves were safely packetized in v71, but the boss could share the final escort packet. That made the existing cinematic boss treatment arrive without enough gameplay breathing room.

v72 makes the packet contract explicit:

- a boss is isolated into the final packet;
- the preceding packet gets at least a 1.35-second break;
- the dedicated boss packet uses a 1.05-second spawn gap;
- enemy count and density budgets do not increase.

This is pacing, not difficulty inflation.

### 3. Full fields are quieter

At seven or more deployed towers, the Defense shell enters a state-driven `crowded` field-density mode. Persistent level/mastery badges and non-selected aura intensity yield to enemies and projectiles. Selecting a tower restores its decision-relevant information.

A valid 10/10 field was exercised at 390×844. The field reached the real cap, large cash compacted to `985K`, the page had no horizontal overflow, the selected level remained visible, non-selected level badges were suppressed, and the sample produced no runtime errors.

## Architecture / maintainability changes

- Added late deployment growth and reward normalization to the existing centralized `DefenseCore` economy rather than duplicating formulas in runtime UI code.
- Boss entrance behavior lives in the canonical packet splitter, not a one-off runtime timer.
- Removed the obsolete runtime `defenseSpawnGap()` and `defenseSpawnClearance()` functions; packet timing already comes from `DefenseCore.splitIntoPackets()`.
- Crowded-field styling is driven by one shell state attribute (`data-field-density`) rather than viewport-specific CSS patches.
- No Defense `!important` declarations were introduced.
- No new overlay system, targeting system, placement system, save format, or world-art subsystem was created.

## Bugs / weaknesses discovered

### Shipped behavior

1. **Late-run cash inflation.** v71 rewarded both larger waves and increasing wave number strongly enough that money outran the finite purchase surface. Fixed with a preserved early curve plus late normalization and stronger late sinks.
2. **Boss packet arrival lacked a deliberate breath.** The boss could ride inside the last escort packet. Fixed in the canonical packet builder.
3. **Crowded tower metadata could compete with combat readability.** Fixed with field-density state styling.
4. **Mixed release fallback found during packaging.** The renamed v72 boot file still had a v71 fallback build string after the first versioning pass. This was caught before packaging and corrected to `v72-final-product`.

### Test-harness findings, not shipped bugs

- One core expectation still encoded the old tier-3 investment after the upgrade table changed.
- One integration assertion expected the old max derived tower investment of 990; the v72 canonical value is 1,250. The game correctly recalculated 1,250, so the stale assertion was updated and the complete suite rerun.

## Exploit review

No new player-facing duplication or reward exploit was found in this pass. The v71 hardening remained intact under v72:

- unfinished waves do not earn clear credit;
- `clearedWave` remains the permanent-reward authority;
- zero-clear banking cannot create mastery;
- death/bank during an active next wave excludes that unfinished wave;
- signed checkpoint/state corruption is clamped or rejected;
- derived tower investment is recalculated from canonical upgrade state;
- pending income flushes before checkpoint writes;
- combat blocks placement/selling/ordinary upgrades;
- split children cannot bypass density caps;
- the five-second placement undo refunds actual investment without creating profit, then falls back to the 70% planning refund.

## Performance / longevity

v72 does not replace the existing pooling or scheduler architecture.

A targeted 50-cycle queue/clear stress after pool warmup produced:

- enemy nodes created: 14 → 14;
- projectile nodes created: 26 → 26;
- impact nodes created: 8 → 8;
- active enemy DOM after clear: 0;
- active projectile DOM after clear: 0;
- battlefield DOM: 237 → 214 nodes;
- measured heap delta: +426,273 bytes;
- runtime errors: none.

This targeted run checks bounded allocation/release behavior; it is **not** a physical-device FPS benchmark.

The integration suite also reconfirmed that normal 2× mode lowers density from 14 to 9 and visual budgets from 26→17 visible projectiles and 8→5 impact effects. Low-performance 2× falls further to density 7, 10 projectiles, and 3 impacts. Controlled scheduler samples did not double target scans at 2×.

Detailed targeted stress data is in `reports/v72-longevity-targeted.json`.

## UI / art findings

- The six worlds already have distinct structural terrain identities, road palettes, route shapes, landmarks, build pockets, weather, HP/speed pressure, and strategic lessons. A broad world-art rewrite was not justified.
- All 14 inspected battlefield Rizo PNG variants use the same 520×670 canvas and the same normalized alpha footprint. The existing shared foot-anchor/shadow contract is therefore the correct system; per-variant screenshot offsets would have introduced debt.
- Blizzard and Eclipse retain adaptive active-unit outlines/health edges, keeping gameplay objects above atmosphere.
- Large cash presentation, Wave 99+ structure, portrait/landscape bounds, field priority, and contextual overlay behavior remained covered by browser regression tests.

## Verification personally executed in this pass

### Targeted v71 establishment

- Core logic: 23/23.
- Service worker policy: 4/4.
- Static architecture: 70/70.
- Cinematic/exploit browser checks: 17/17.
- Viewport/surface matrix: 76/76.
- The v71 full integration harness was attempted but exceeded the run time available for that baseline check; its previously supplied 77/77 report was therefore treated only as historical context until v72 was run directly.

### v72 final verification

- Core logic: **25/25**.
- Service worker policy: **4/4**.
- Static architecture: **73/73**.
- Gameplay/economy browser integration: **77/77** after correcting one stale test expectation.
- Battlefield art regression: **43/43**.
- Cinematic/exploit browser suite: **17/17**.
- Viewport/surface matrix: **76/76**.
- Syntax: `node --check` clean for boot, Defense core, and runtime game JS.
- Valid full-cap placement: 10/10 towers at 390×844 with no horizontal overflow or runtime error.
- Targeted longevity: 50 repeated queue/clear cycles with bounded prewarmed pools and no runtime error.
- Static local-asset verification: all active local references found; no missing active asset.

## Verification boundary

Browser testing used headless Chromium with CSS viewport emulation. It was **not** physical iPhone/iPad testing. The general performance profiler was also attempted, but its full multi-page benchmark exceeded the sandbox time ceiling; no fabricated FPS number is reported. The focused allocation/longevity test above was run successfully instead.

## Remaining balance-tunable items

- Cash will eventually become surplus after a player has fully bought and maxed the finite field. v72 delays that point substantially without inventing a new repeatable sink during a final polish pass. A future telemetry-backed system could add an intentional endless-mode sink if actual players regularly continue far beyond a maxed field.
- Golden-at-cap late runs remain richer by design; the modeled capped-Golden Grove total is about 50,581 by Wave 50 and 114,105 by Wave 100. The 1.22 cap was preserved because the support identity is already coherent and tested.
- Boss/add difficulty and packet timing should still be tuned from real-player completion/death telemetry rather than by adding more enemies.

## Intentionally deferred

- No new art asset pipeline or replacement world system.
- No new repeatable late-game currency sink without player telemetry.
- No targeting rewrite; profiling and integration evidence did not justify one.
- No save-schema bump; the save/checkpoint structure did not change.
- No physical-device performance claims.

## Release conclusion

v72 is intentionally smaller than the rebuild that produced v71. The architecture was already strong. This pass corrects the places where “technically correct” still leaked into player feel: money now takes longer to become irrelevant, bosses arrive with readable drama, and a full field gives visual priority back to combat. The proven reward, save, overlay, placement, targeting, pooling, world, and mobile systems remain intact.
