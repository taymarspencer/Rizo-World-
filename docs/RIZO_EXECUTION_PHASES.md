# Rizo.world Execution Phases

This is the active delivery sequence after the organizer pass. The point is to keep architecture, gameplay, performance, care, progression, and release work moving toward one coherent game instead of splitting into disconnected projects.

## Working rule

When the current phase gate is green, move to the next phase. Do not reopen architecture unless a real blocker requires it. Preserve stable IDs and working legacy behavior while replacing weak pieces behind the same identities.

## Phase 0 — Foundation Lock

Goal: make the organizer branch a trustworthy baseline.

Work:
- Get PR-scoped Rizo Core CI green.
- Fix actual failing tests/workflow issues, not symptoms.
- Keep player/save/progression mutation behind explicit boundaries.
- Keep Core state separate from the live legacy player.
- Add a tiny shipped-ID/alias baseline only if needed to prevent accidental renames after this phase.
- Verify Chromium browser smoke, offline reload, legacy fallback, and build identity.

Gate:
- Node suites green.
- Browser smoke green.
- No uncaught startup errors.
- No shadow player state.
- No fake runtime bindings.
- Organizer PR is mergeable into `rizo-core-v1`.

After gate: architecture is frozen as infrastructure, not treated as a feature project.

## Phase 1 — Defense First 120 Seconds

Goal: a new player understands and enjoys Rizo Defense without explanation.

Work:
- Make the first placement nearly impossible to misunderstand.
- Reduce first-screen choice load.
- Make valid placement, invalid placement, range, cost, and selection obvious.
- Start threat quickly after placement.
- Make the first kill feel consequential.
- Make the first upgrade obvious and affordable enough to teach the loop.
- Shorten early-wave dead time.
- Preserve Rizo personality while removing childish/corny presentation.

Gate:
- Friend can place a Rizo within 30 seconds with no explanation.
- Player understands why the first enemy died.
- Player can identify the first meaningful upgrade.
- Player voluntarily starts/continues the next wave.

## Phase 2 — Defense Performance + Combat Feel

Goal: Defense feels alive and smooth instead of like calculations happening behind a UI.

Work:
- Profile enemy×tower scanning, targeting, projectile creation, particles, DOM/layout work, and canvas work.
- Cap or pool expensive entities where needed.
- Use cheaper visual techniques when they preserve feel.
- Give Rizos readable combat states: idle, acquire, windup, attack, recoil/recovery, ability; add hurt/celebrate only if useful.
- Strengthen hit feedback, kill payoff, lane pressure, and threat readability.
- Make tower roles clearly different: fast single-target, heavy/armor-break, area/control, utility/weird.
- Keep battlefield visually dominant over UI.

Gate:
- No obvious lag spikes in normal early/mid play on mobile target hardware.
- Attack cadence visually matches gameplay cadence.
- Four broad tower roles are distinguishable without reading a wiki.
- Fail → retry loop feels immediate.

## Phase 3 — Defense Depth Without Bloat

Goal: make Defense replayable before adding more game modes or systems.

Work:
- Tune wave rhythm: quiet → threat → attack → payoff → escalation → break.
- Rebalance only after Phase 1/2 clarity and feel are correct.
- Make upgrades create strategy, not stat clutter.
- Remove or defer mechanics that do not produce decisions.
- Make bosses/mechanical threats readable rather than merely tanky.
- Verify progression/reward hooks through World IDs without migrating the whole runtime.

Gate:
- Early, mid, and late play feel meaningfully different.
- Difficulty comes from mechanics/pressure, not only HP inflation.
- Player can explain at least two different build strategies.

## Phase 4 — Arcade Quality Pass

Goal: fewer games that feel intentional instead of many weak games.

Priority order:
1. Rizo Runaway
2. Rizo Courier / Emberrun
3. Ember Beat
4. Skybound
5. Power Tape
6. Remaining arcade modes only if worth saving

For each game:
- Identify the one-sentence fantasy.
- Fix control clarity first.
- Fix responsiveness/feel second.
- Add only enough progression/reward linkage to make the game matter in Rizo World.
- Preserve the existing stable `game.*` ID even if implementation changes.
- Cut, hide, or defer games that remain weak instead of polishing all eleven equally.

Gate:
- Each retained game is understandable within seconds.
- Each retained game has a reason to replay.
- No retained game feels like filler beside Defense.

## Phase 5 — Care Vertical Slice

Goal: make “this is my Rizo” emotionally real through interaction, not chores.

Work:
- Build one complete tactile care loop before a large care system.
- Use localized grime and visible state, not a global dirt filter.
- Water softens/changes dirt state.
- Soap + rubbing loosens dirt.
- Rinse removes loosened dirt/soap.
- Untouched visibly dirty areas must not disappear because a completion threshold fired.
- Give Rizo selective reactions with personality.
- Preserve evidence of previous care where useful.
- Avoid constant needs timers/chore-sim pressure.

Gate:
- Player has to actually interact with the dirty area.
- Water/soap/rub/rinse each have a distinct purpose.
- Completion matches what the player sees.
- Rizo feels alive rather than like a progress bar.

## Phase 6 — One Progression Loop Across World

Goal: Defense, arcade, care, collecting, and rewards feel like parts of one game.

Work:
- Define the live player write boundary before native/new systems grant rewards.
- Route rewards through one explicit path.
- Make Embers/shards/heat/unlocks mean something consistent.
- Connect game completion and care actions to progression without farming exploits.
- Preserve existing saves and migration logic.
- Use World IDs for identity; do not duplicate gameplay data into the registry.

Gate:
- A player can play a game, earn something, return home, and clearly see why it matters.
- No reward can silently land in Core shadow state.
- Save/reload preserves the result.

## Phase 7 — Rizo Identity + Long-Term Systems

Goal: deepen attachment only after the core loops are fun.

Possible work, added only when justified:
- Traits/personality expression.
- Meaningful Rizo differences outside cosmetic color.
- Breeding/genetics only after traits/stat inheritance has gameplay value.
- Unique children via appearance/stat/personality inheritance.
- Persistent memories/events that reinforce continuity.

Gate:
- New systems create new decisions or attachment, not database complexity.
- Stable IDs let legacy and native pieces coexist without migration theater.

## Phase 8 — Mobile/PWA Reliability

Goal: the game survives real phones, refreshes, installs, offline transitions, and long sessions.

Work:
- iPhone/Safari viewport and touch QA.
- Android/Chromium smoke.
- Service-worker old-build → new-build upgrade test.
- Offline boot/reload.
- Save corruption/recovery checks.
- Background/resume behavior.
- Memory/performance soak.
- Prevent UI trapping, accidental page scroll, and orientation breakage.

Gate:
- Install/update/reload does not strand players on mixed builds.
- Save recovery is proven.
- Core loops remain playable on target mobile viewports.

## Phase 9 — Release Candidate

Goal: ship the best coherent Rizo World we actually have, not an endless internal project.

Work:
- Freeze scope.
- Run full CI and browser/mobile smoke.
- Resolve P0/P1 gameplay bugs.
- Verify legal/about/support/install surfaces.
- Verify monetization is disabled or intentionally configured for release.
- Verify analytics/diagnostics decisions.
- Create release build identity.
- Merge through the established branch path only after green gates.

Gate:
- No release-blocking save, boot, control, progression, or performance issue.
- Main remains the known-good release branch until the release candidate passes.

## Continue protocol

When the user says `continue`:
1. Read this file and the current branch/CI state.
2. Determine the current unfinished phase.
3. Execute that phase's next concrete work directly.
4. Run/check its relevant tests.
5. Report what changed, what remains, and whether the phase gate is green.
6. Do not jump ahead unless the current phase is gated or the user explicitly redirects.

The aim is one continuous build toward a playable, alive Rizo World — not separate architecture, gameplay, care, and progression projects.