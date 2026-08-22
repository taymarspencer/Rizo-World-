# Rizo Defense v74 — Smooth Defense Pass

## Focus
This pass is intentionally narrow: make balloon travel visually obey the authored roads and make Defense degrade gracefully when the device is under frame-time pressure.

## Route fidelity
- The road SVG and enemy simulation still come from one canonical curved path per map. There is no second hand-authored movement route that can drift away from the art.
- Removed inherited legacy balloon geometry that was still partially controlling `top`, `bottom`, `width`, `height`, and boss scaling underneath the newer Defense art system.
- Enemy/projectile movers use explicit `left:0; top:0` transform origins.
- Balloon positioning now anchors the visible knot directly to the simulation route with `translate:-50% calc(-100% + 16px)`. The same anchor contract works for normal enemies, scaled variants, and bosses.
- Bosses no longer inherit the old extra `1.65` scale on top of their newer 64x84 authored box.
- Added `tests/browser-v74-route-fidelity.py`. It verifies all six maps, five normal-balloon route samples per map, and a boss sample per map. Result: 19/19 checks pass; worst measured knot-to-route error was 0.066 CSS px in the 390x844 harness.

## Performance governor
- Defense mode disables the global SVG turbulence grain overlay, an expensive full-screen blend with no gameplay value.
- Lean/potato tiers remove moving-element drop-shadow filters and expensive weather blending before lowering gameplay density.
- Full quality can render balloon/projectile positions at 60 Hz; lean drops to 30 Hz; potato drops to 20 Hz.
- Position refresh is separated from class/health/status refresh. Enemy status DOM work runs at 10 Hz full, ~7 Hz lean, and 5 Hz potato while movement can stay visually smooth.
- Bosses no longer force class/health/status reconstruction every animation frame.
- The frame governor now reacts to consecutive slow frames, not only a long moving average, so thermal pressure, screen sharing, or other contention can trigger the low tier earlier.
- Spawn-density checks no longer allocate a filtered enemy array in the combat hot path.
- Existing pooling, packet pacing, target caching, wall-time income batching, and 2x density reduction remain intact.

## Comparative host profile
The included Playwright performance harness is not a physical-iPhone benchmark, but it gives an apples-to-apples regression signal on the same build host.

| Mode | v73 avg / estimated FPS | v74 avg / estimated FPS | Worst frame v73 → v74 |
| --- | --- | --- | --- |
| 1x | 17.154 ms / 58.3 FPS | 16.666 ms / 60.0 FPS | 50.0 ms → 16.8 ms |
| 2x | 27.413 ms / 36.5 FPS | 16.666 ms / 60.0 FPS | 183.4 ms → 16.8 ms |

The 2x run is the strongest signal: v73 entered `performanceLow`/tier 2 in this comparison, while v74 stayed at 60 FPS without runtime errors. Physical iPhone testing is still required before treating those numbers as device guarantees.

Reports:
- `reports/defense-performance-profile-v73-baseline.json`
- `reports/defense-performance-profile-v74.json`
- `reports/browser-v74-route-fidelity.json`

## Architecture direction — the real “V8”
Do not move moment-to-moment tower-defense rendering to the cloud. Network latency makes that the wrong place for touch-response, balloon movement, targeting, and drawing.

The next large engine step should instead use more of the phone locally:
1. Keep menus, touch controls, HUD, accessibility, and Rizo interaction in DOM.
2. Move balloons, projectiles, and transient effects to one battlefield canvas.
3. On iOS 17+ capable browsers, transfer that canvas to an `OffscreenCanvas` worker so battlefield rendering/simulation can stop competing with UI work on the main thread.
4. Keep the current DOM renderer as a compatibility/fallback path until the worker renderer passes the same gameplay and route tests.

That is a deliberate engine migration, not a v74 hotfix, because doing it safely requires parity tests for targeting, collision, effects, pause/resume, save restoration, and touch interaction.
