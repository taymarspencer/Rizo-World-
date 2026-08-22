# Rizo.game v78 — Canvas Flow Engine

v78 turns Rizo Defense from a DOM-heavy browser battlefield into a hybrid game renderer while preserving the deterministic v76 simulation and the v77 route/drag/feel fixes.

## Player-facing changes

- Rizo Defense breathes more. Early formations arrive slower, standard packets are smaller/clearer, packet breaks are longer, bosses receive a dedicated entrance beat, and the global balloon pace is calmer.
- Wave flow reads as a sequence: preview -> deploy -> start -> first-threat countdown -> packet -> breather -> packet -> clear -> planning.
- The Next Wave preview exposes packet count, threat count, and approximate arrival duration before the player commits.
- Routine wave and packet callouts are compact edge cues instead of large cards covering the battlefield. Bosses, danger, perfect clears, and run-end moments can still own the screen.
- First-time map introductions are shorter and cleaner; repeat visits are almost immediate. Any tap enters the field.
- Manual wave control remains the default. Auto Waves remain optional and use a 2.8 second planning window.

## Hybrid Canvas renderer

Defense now uses one Canvas presentation layer for:

- moving balloon enemies
- representative projectile tracers
- ordinary hit/status impact effects

The following remain DOM/UI:

- the authored map and route artwork
- Rizo towers and direct-manipulation placement
- HUD, menus, upgrade controls, accessibility surfaces
- major cinematic/critical feedback

This is intentional. Canvas is used where hundreds of style/position mutations are wasteful; DOM stays where touch semantics and UI are valuable.

The combat simulation remains the source of truth. Canvas never owns HP, cooldowns, rewards, target selection, path progress, or wave state.

### Mobile performance behavior

- Canvas backing-store DPR is capped at 1.65 in full quality, 1.35 in the middle tier, and 1.0 in the lowest tier.
- The adaptive governor still degrades visual work before gameplay logic.
- Rapid logical fire continues to coalesce into bounded representative tracers.
- Production uses Canvas when available. QA/local regression harnesses remain on the legacy DOM renderer unless Canvas is explicitly requested.
- If Canvas becomes unavailable during a live match, v78 rebuilds the live balloons/projectiles into pooled DOM nodes instead of letting combat disappear.

In the build-host 390x844 stress comparison at 2x, both renderers held approximately 60 fps, but the Canvas path reduced battlefield DOM descendants from 283 to 101 while preserving the same 14-enemy peak. That result is evidence of lower DOM pressure, not a physical-iPhone benchmark.

## Update / refresh workflow

v78 adds two explicit update paths:

- **UPDATE NOW** appears when a new service-worker build is detected.
- **REFRESH LATEST** is always available in Journal -> Settings -> Install + Updates.

When pressed, Rizo.game:

1. verifies the newest network build is reachable before deleting anything,
2. checkpoints an active Defense run automatically,
3. saves persistent state,
4. releases waiting service workers,
5. unregisters old workers and deletes Rizo.game release caches,
6. reloads with a cache-busting build request.

If the network probe fails, the current playable cached game is kept intact.

## Compatibility

- Runtime build marker: `v78-defense-canvas-flow`
- Service-worker cache: `rizo-game-v78-defense-canvas-flow`
- Current runtime files: `game-v78-defense.js`, `defense-core-v78.js`, `defense-canvas-v78.js`, `launch-v78-defense-canvas.css`
- v75 Arcade Revival games and progression are preserved.
- Existing v76/v77 Defense save/checkpoint migration remains supported.

## Deliberately deferred

v78 does **not** move simulation to a Worker/OffscreenCanvas yet. The renderer boundary now exists, so an OffscreenCanvas worker can be evaluated against real iPhone Low Power Mode/screen-sharing data without mixing that migration with the pacing and visual rewrite.

Likewise, the other arcade games are not blindly converted to Canvas. Future finishing passes can reuse the renderer pattern where profiling shows a real benefit.
