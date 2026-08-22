# V64 Known Limitations

## Structurally improved but still tunable

- Exact economy values need real-player telemetry across early, mid, and endless runs.
- Enemy composition and packet rhythm are safe/capped but still content-balance knobs.
- World routes, weather, landmarks, placement pockets, and opening perks are structurally distinct; additional unique art/audio/mechanical events can deepen each world further.
- Adaptive performance thresholds were measured in headless Chromium and should be calibrated on the minimum supported iPhone.
- The game remains a DOM simulation. Pooling and budgets make it viable, but a future canvas renderer could raise the visual ceiling.

## Unable to verify in this environment

- sustained frame time, thermal behavior, and memory pressure on physical iPhones/iPads
- real Safari haptic behavior
- speaker/headphone audio mix and latency
- VoiceOver gesture quality on physical iOS
- installed-PWA service-worker update behavior against the production host; file/cache references are statically aligned, but local HTTP navigation was blocked in the test environment
- production analytics delivery because no external backend was exercised

## Security limitation

Local signatures are not secure against a determined user who can read and rewrite the game code. They are intended for corruption detection and casual tamper resistance only.
