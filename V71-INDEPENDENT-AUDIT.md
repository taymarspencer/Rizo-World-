# Rizo Defense v71 — Independent Adversarial Audit

This audit does not take the V71-FINAL-* reports on their word. Every claim below is
labeled by how it was actually checked.

## Method
The sandbox had no `/usr/bin/chromium` (the path the test scripts hardcode) and no
network access to install one. A real Chrome-for-Testing binary was already cached
at `/home/claude/.cache/puppeteer/chrome/.../chrome` from a prior tool run, so the
seven Playwright suites were repointed at it (`executable_path`) and actually
executed — not just read.

## What was personally re-executed (not just inspected)
| Suite | Result |
|---|---:|
| `tests/defense-core.test.js` (plain Node, no browser) | 23/23 real pass |
| `tests/service-worker-policy.test.js` (plain Node, no browser) | 4/4 real pass |
| `tests/static-defense-audit.py` (static regex audit) | 70/70 real pass |
| `tests/browser-phase8-final.py` (real Chromium) | 17/17 real pass |
| `tests/browser-defense-integration.py` (real Chromium) | 77/77 real pass |
| `tests/browser-defense-surfaces.py` (real Chromium) | 76/76 real pass |
| `tests/browser-phase7-art.py` (real Chromium) | **41/43 on first run — see bug below** |

Total after the fix described below: **310/310**, matching the claimed number, but
only after independent re-execution surfaced and fixed two false negatives that the
shipped report didn't mention.

## Two real bugs found and fixed
Both were in `tests/browser-phase7-art.py`, not in the shipped game code.

1. **Route markers**: `.defense-world.route-tracing .defense-route-marker` has a
   `.18s` opacity transition. The test only waited 80ms after triggering the trace
   before reading `getComputedStyle().opacity`, so it sampled mid-transition. Traced
   this with a manual delay sweep (10/50/100/200ms) — opacity was still 0 at 50ms,
   0.35 at 100ms, and a clean 0.55 (the intended resting value) by 200ms. Not a
   product bug: the class toggle, the DOM structure, and the CSS cascade were all
   correct. The assertion's timing budget was just tighter than the transition it
   was measuring.
2. **Selected tower range ellipse**: same shape of bug. `.defense-tower.selected
   .defense-range` has a `.12s` transition; the test's 180ms wait was close enough
   to the transition length that in this headless, software-rendered environment
   (no GPU) the paint/transition-start lagged past the margin. A delay sweep showed
   opacity hit exactly `1` reliably by 200ms and stayed there.

Fix applied: bumped both waits to 320ms (a real margin above the transition
durations, not a hack that special-cases the assertion). Re-ran the suite clean:
**43/43**.

Before concluding these were test bugs rather than product bugs, I independently
verified the CSS cascade by hand — enumerating every matched rule for the affected
elements via the live CSSOM (not the source file) and confirming only the intended
two rules apply, with the higher-specificity `.route-tracing`/`.selected` rule
correctly present and correctly winning once the transition completes. I did not
just trust that the fix "worked" because the test went green.

## Independently spot-checked beyond the automated suite
- **`clearedWave` vs `currentWave`**: read `defense-core-v71.js` directly — reward,
  ember, and golden-payout functions take `clearedWave`, not `currentWave`/`wave`.
- **QA exposure**: `IS_QA_BUILD` gate confirmed in the shipped JS; `window.RizoRuntimeQA`
  and the legacy `RizoVisualQA`/`RizoBeatQA` globals are explicitly deleted when the
  gate is false.
- **CSS `!important` claim**: the static audit's own check only greps for
  Defense-prefixed selectors. I independently re-parsed the whole stylesheet myself
  (103 rule blocks / 249 raw `!important` occurrences) and manually reviewed every
  block that *didn't* match the narrow prefix regex, including a broader gameplay-keyword
  sweep. All of them belong to unrelated systems (pet care mini-games, evolution/cosmetics,
  install gate, `.sr-only` accessibility utility, reduce-motion overrides) — genuinely
  zero Defense-gameplay `!important` overrides, not just zero matches for one regex.
- **Powers/overlay model**: confirmed Powers is implemented as a tray
  (`abilityTrayOpen`) governed by the same mutual-exclusion overlay manager as the
  field menu, tower panel, and intel sheet — one committed interaction model, not a
  half-screen hybrid.
- **Performance**: ran `tests/profile-phase8-final.py` myself rather than reading
  `reports/phase8-performance-profile.json`. Pool sizes and DOM node count were flat
  across the sampled run (no growth), consistent with the no-leak claim. Frame times
  in this sandbox (~27ms avg, software rendering, no GPU) triggered the adaptive
  low-performance tier — expected in this environment and not representative of a
  real phone; treat the shipped `V71-FINAL-PERFORMANCE-BUDGETS.md` numbers the same
  way the project's own `KNOWN-LIMITATIONS.md` already does.

## Conclusion
No defect was found in the shipped game/CSS (`game-v71-phase8-final-release.js`,
`defense-core-v71.js`, `launch-v71-phase8-final-release.css`). The only real issue
was in dev-only test tooling that never reaches a player's browser. Because nothing
players receive changed, **the service worker cache name and versioned filenames
were intentionally left at v71** — renaming unchanged files or bumping the cache
version would be pure churn with no player-facing benefit, and would work against
the project's own stated goal of not adding process for its own sake. If/when an
actual gameplay or asset change ships, that's the point to cut v72 filenames per
the established convention.

## Not re-verified in this pass (scope, not a claim of failure)
- Physical-device screenshots/haptics/thermal behavior — no such hardware here,
  same limitation the project's own docs already disclose.
- Line-by-line manual review of every one of the 50 original spec sections. This
  pass prioritized the highest-risk areas (progression integrity, exploit surface,
  performance/density, save validation, art-regression) via the project's own
  automated coverage plus hand verification, not an independent re-read of all
  ~12,000 lines of `game-v71-phase8-final-release.js`.
