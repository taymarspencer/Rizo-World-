# v78 Engineering Note — Defense Canvas + Flow Engine

## Objective

Finish the Rizo Defense experience rather than stack another cosmetic patch. v78 combines game-flow pacing, a lower-overhead combat presentation path, failure-safe renderer fallback, and an explicit update/reload workflow.

## 1. Flow authored as phrases

The wave generator now treats each round as a sentence instead of an enemy faucet.

Typical grammar:

`preview -> deployment -> player start -> arrival beat -> packet -> breath -> packet/twist -> cleanup -> clear -> planning`

Pacing bands were widened toward clarity:

- Waves 1–5: roughly 4–8 enemies per packet, 0.52–0.72 s ordinary spawn gaps, 1.65–2.30 s breaths.
- Waves 6–15: roughly 6–10 per packet, 0.34–0.48 s gaps, 1.40–2.05 s breaths.
- Later standard waves: roughly 7–12 per packet, 0.24–0.36 s gaps, 1.20–1.85 s breaths.
- Rushes remain intentionally compressed rather than making every wave fast.
- Bosses receive a dedicated pre-entry breath and slower entrance grammar.
- Global movement pace is 0.88 of the prior authored base before class/map modifiers.

Difficulty remains composition-led; device quality never changes authored density.

## 2. Simulation/render separation

The deterministic 30 Hz fixed simulation from v76 is preserved.

Simulation owns:

- path progress
- HP/status
- tower cooldowns
- targeting
- projectile collision
- child spawning
- wave resolution/rewards

Presentation reads snapshots and interpolates them. A phone may present at 60 or 30 fps without changing combat math.

## 3. Hybrid Canvas contract

`defense-canvas-v78.js` receives immutable-ish presentation records from the current runtime frame and paints them to one 2D canvas.

Canvas draws:

- balloon bodies and state markers
- boss/armor/camo/phase visual state
- clipped burn/poison/frost/root status art
- representative projectile tracers
- ordinary impact effects

DOM retains towers and interaction/UI. This avoids rewriting drag/upgrade/accessibility semantics merely to claim "Canvas".

No gameplay reads are performed from Canvas. Renderer failure can never become the authoritative game state.

### Context-loss/failure recovery

If the Canvas renderer stops being enabled or returns failure:

- renderer mode switches to DOM,
- live enemies receive pooled DOM balloon nodes,
- representative live shots receive pooled DOM projectile nodes,
- current visual state is regenerated from simulation records,
- combat continues from the same simulation state.

This prevents a GPU/context problem from turning into invisible enemies.

## 4. Quality governor

Canvas pixel density follows quality state:

- Q3: DPR <= 1.65
- Q2: DPR <= 1.35
- Q1: DPR = 1.0

The existing governor still prioritizes input/simulation correctness over weather, particles, shadows, and visual emission. Gameplay density remains invariant.

## 5. Routine cinematic restraint

Routine `wave-start` and `packet` cues were converted into small top-edge pills and shortened. They communicate rhythm without covering the road.

Large cinematic ownership is reserved for moments that deserve it:

- boss entrance
- gate danger
- perfect wave
- defeat
- banked run

## 6. Map-entry flow

The first visit gets a short orientation card that teaches the immediate action rather than repeating map lore. Any tap enters the field. Repeat visits collapse to a quick identity flash.

The long-form lore/strategy still exists elsewhere in Defense UI; it no longer blocks getting into play.

## 7. Immediate update workflow

The service-worker update UX now supports an intentional destructive refresh without risking the only offline copy.

`forceReleaseRefresh()`:

- makes a no-store network probe first,
- checkpoints active Defense,
- persists Rizo state,
- requests waiting-worker activation,
- unregisters release workers,
- clears versioned `rizo-game-*` caches,
- reloads with a cache-busting request.

Failure before cleanup is safe and leaves the current release playable.

## 8. QA gates

v78 adds a dedicated Canvas/flow suite covering:

- production Canvas activation
- high-DPR backing-store cap
- zero moving enemy DOM nodes under Canvas
- representative rapid-fire visuals
- Canvas presentation frames
- packet/threat/arrival preview
- explicit START WAVE language
- adaptive-quality downshift without gameplay-density change
- update controls
- runtime errors
- Canvas failure -> DOM rehydration

Legacy DOM geometry remains independently testable by making QA default to DOM unless Canvas is explicitly forced.

## 9. Build-host comparison

390x844, 2x, same 14-enemy peak:

| Renderer | Avg frame | Estimated FPS | Battlefield DOM descendants | Moving enemy DOM nodes |
|---|---:|---:|---:|---:|
| DOM | 16.771 ms | 59.6 | 283 | 14 |
| Canvas | 16.718 ms | 59.8 | 101 | 0 |

Both saturate the headless display cadence, so this benchmark does not prove a phone-FPS gain. It does prove that Canvas substantially reduces DOM object/layout pressure while preserving the same gameplay load.

## Next engineering decision

Test v78 on a physical iPhone under:

- normal power
- Low Power Mode
- screen recording/share
- long warm session
- 1x and 2x

If presentation still hitches while simulation telemetry is healthy, the next justified step is moving the Canvas renderer (and possibly selected simulation hot paths) to Worker/OffscreenCanvas. That is now an isolated migration instead of a rewrite of the whole app.
