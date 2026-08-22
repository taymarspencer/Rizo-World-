# V77 Defense Feel Pass

This pass intentionally stops adding Defense systems and concentrates on the five remaining feel problems reported during real-phone play.

## 1. Pacing
Packet spawn gaps and breaks were lengthened across every wave band. The first enemy also enters later after a wave start, and global enemy travel is reduced by 6%. Rushes remain rushes; bosses receive a stronger pre-entry breath.

## 2. Route fidelity
The simulation and road were already generated from one canonical curve, but the visible balloon was anchored at its knot and portrait fields stretched the coordinate system. v77 keeps the world square, shortens decorative strings, and centers the balloon body on the route coordinate. This is a perceptual correction, not a new hidden path.

## 3. Touch drag
Roster pointer ownership begins on pointerdown instead of after Safari has had time to claim the gesture. Pointer capture is acquired immediately. Bench-axis gestures are scrolled manually; field-directed gestures activate the placement ghost. Tap-to-place remains valid.

## 4. Game-native UI
The Defense display font no longer depends on Arial Black/Impact. Primary controls use rounded system typography, icon plates, tactile depth, press states, and functional accent colors. Status and information surfaces share the same field-equipment visual language.

## 5. Combat feedback
Generic outlined impact rings were replaced by pooled one-element typed FX. Status conditions render inside each balloon body: embers, toxic bubbles, frost rim, and roots. FX duration now obeys the runtime `--impact-life` value and impact origins are clamped slightly inside the field to avoid harsh clipping at viewport edges.

## Verified QA in this pass
- 27/27 Defense core logic
- 4/4 service-worker policy
- 80/80 static architecture checks
- 14/14 fixed-step/rhythm-engine browser checks
- 33/33 v77 feel checks, including all six map routes and synthetic touch drag
- 76/76 phone/tablet/landscape Defense surface checks
- 17/17 Arcade Revival smoke/training checks
- 5/5 launch-recovery checks

Total targeted checks: 256/256.

The route test measures the visible balloon-body center against the canonical simulation path, not the decorative knot. Worst sampled normal-balloon error across all six worlds was 0.400 CSS px; the sampled boss error was 0.482 CSS px.

Physical-device testing on the user's iPhone remains the final authority for subjective pacing, touch feel, Low Power Mode smoothness, and screen-share behavior.
