# Rizo World — Codex Cloud OZ Campaign

## Mission

You are running in Codex Cloud against `taymarspencer/Rizo-World-`.

Your job is to turn this repo into an intuitive, durable, feature-first game project, then continue the gameplay roadmap automatically until the release-candidate gate or a genuine product decision requires the user.

Do the work. Do not merely write a plan.

Hard rules:

- Do not touch `main`.
- Do not merge without explicit user approval.
- Do not rewrite the game from scratch.
- Do not sacrifice working gameplay, saves, mobile behavior, or PWA/offline behavior for folder purity.
- Preserve every previous green checkpoint.
- Never roll back earlier proven work merely because the current slice is hard.
- Never weaken tests just to make CI green.

## Cloud preflight

Before implementing anything:

1. Confirm repo, current branch, HEAD, current PR/branch stack, and latest CI state.
2. Confirm Git operations available in Codex Cloud.
3. Run the smallest existing baseline tests.
4. Confirm Node, Python, Playwright/Chromium, and any other existing test requirements.
5. Install only dependencies already required by the repo/tests.
6. Confirm browser testing works before browser-heavy phases.
7. Do not depend on files from the user's local computer.
8. If Phase 2 combat feedback is red, fix the real Phase 2 failure first and establish a green commit before structural work.

If the cloud environment itself is genuinely incapable of a required workflow, record the blocker in `docs/EXECUTION.md` and stop. Do not redesign the repo around a temporary cloud limitation.

## Operating model: one campaign, disposable context

The repository is memory. Git is memory. Tests are memory. Conversational context is disposable.

Work in small green checkpoints.

At the start of every checkpoint:

1. Read root `AGENTS.md`.
2. Read `docs/EXECUTION.md` if it exists.
3. Read only the relevant feature code/contracts/tests.
4. Inspect HEAD and current diff.
5. Run the smallest relevant baseline test.
6. Define a narrow allowed-change scope internally.
7. Then edit.

At the end of every checkpoint:

1. Update `docs/EXECUTION.md` with current phase, what changed, verification commands, next slice, and blockers.
2. Run relevant tests on the complete checkpoint.
3. Only if green, commit code + tests + docs together.
4. Re-orient from disk before continuing.

Do not create a self-referential "last green SHA" field in a file. Git itself is the source of truth.

If context compacts or memory feels unreliable: stop editing, re-read AGENTS, EXECUTION, HEAD, diff, and the relevant feature before continuing.

## First principle: characterize before moving legacy behavior

Before extracting poorly understood legacy behavior, create characterization/golden-master tests for what the game actually does now.

Good targets include:

- representative save load/migration
- boot/home/arcade entry
- Defense Wave 1
- reward math
- selected Rizo state transitions
- current public runtime IDs
- fresh offline boot
- old service-worker/current-service-worker upgrade behavior

For structural refactors, behavior parity is the default. Do not silently "improve" behavior while moving it unless the active gameplay phase intentionally changes that behavior.

Known bugs may be documented as known-bug characterization rather than frozen forever.

## Architecture answer: feature-first modular monolith

The filesystem should describe Rizo World, not generic JavaScript architecture.

Illustrative shape only — do not pre-create empty folders:

```text
src/
  shell/
    boot/
    config/
    pwa/
    monetization/

  game/
    rizo/
    defense/
    care/
    arcade/
    progression/
    world/
    save/
    catalog/

  shared/

assets/
  rizo/
  defense/
  care/
  arcade/
  world/
  shared/

tests/
  integration/
  e2e/
  compatibility/

tools/
docs/
  ARCHITECTURE.md
  EXECUTION.md
  history/
```

Create only folders backed by real current responsibilities.

Prefer game-domain names over global technical buckets like `controllers/`, `services/`, `managers/`, `systems/`, `utils/`, or `misc/`.

Example Defense ownership:

```text
src/game/defense/
  index.js
  data/
    towers.js
    enemies.js
    waves.js
    maps.js
  simulation/
    combat.js
    targeting.js
    placement.js
    waves.js
    economy.js
  ui/
  presentation/
  tests/
```

If the real code proves a simpler grouping is clearer, choose the simpler grouping.

Game concept first. Technical mechanism second.

## Do not introduce infrastructure for aesthetics

Preserve the current static/browser deployment model unless a concrete requirement proves it insufficient.

Do not introduce Vite, Webpack, Rollup, TypeScript conversion, a framework migration, or a package-heavy build pipeline just because the folder structure changes.

Native ES modules are acceptable.

Any new build system must solve a demonstrated problem and preserve Cloudflare/static deployment plus PWA/offline behavior.

## Data model: definition → index → instance → save

Static first-party game content should be authored as simple JS arrays/objects unless another format proves materially better.

Example:

```js
export const TOWERS = [
  {
    id: "tower.defense.classic",
    rizoId: "rizo.classic",
    role: "balanced",
    attack: { damage: 8, cooldown: .8, range: .21 }
  }
];
```

The array/object module is the human authoring format.

At startup/validation time:

`definitions → validation → derived immutable indexes/Maps → catalog/query/UI/simulation`

One definition, many derived views.

Do not hand-maintain definition array + registry copy + UI copy + runtime copy + save copy.

Keep distinct:

1. Definition: immutable static meaning.
2. Index/catalog: derived lookup, not separately authored.
3. Runtime instance: mutable current-game state.
4. Save state: serialized mutable state + stable references needed to reconstruct runtime instances.

Do not store copied static stats/descriptions in saves unless a real historical rule requires snapshotting.

Arrays are an authoring primitive, not permission to create a new 8,000-line content god file. Split large families only when real cohesion/volume justifies it.

## One-owner rule

Every important gameplay definition has one authoritative owner.

Example: Defense tower definitions live under Defense. Defense UI reads them, Defense simulation reads them, catalog indexes them, tests inspect them, and legacy compatibility adapts them.

No second manually maintained tower-stat table.

Before creating a new production source file, search filenames, symbols, canonical IDs, imports, nearby feature directories, and legacy equivalents. Improve/move an existing owner instead of creating a parallel one.

Do not maintain a second permanent handwritten ownership database. Generate ownership reports from real exports/manifests/imports where practical.

## Public entry points without manifest religion

Each major feature should have one obvious public entry point, usually `index.js`.

Use a separate `manifest.js` only if the feature genuinely contributes enough catalog metadata/content to justify one.

Prefer explicit composition over magical side-effect self-registration.

## Behavior references without a service locator

Use direct function imports/references when that is simpler.

Use stable behavior IDs only when they create real value: shared reusable content behavior, serialization, external data, save/network boundaries, or future content packs.

If behavior IDs are used, keep mappings feature-local and validate them. Do not create a global service locator or home-grown scripting language.

## Calls and events

Inside one feature, prefer direct calls/imports/explicit references.

Use cross-feature events only for real facts such as:

- `game.completed`
- `reward.earned`
- `player.saved`
- `rizo.evolved`
- `care.completed`

Do not use a global EventBus for ordinary internal calls like button clicks, targeting, projectile motion, or panel updates.

## Do not ECS the whole game

Use normal feature modules/plain data for most of Rizo World.

Defense may use data-oriented storage/loops only in proven hot paths such as enemies, projectiles, target scans, towers, or particles, and only after profiling/reproducible performance evidence.

Hybrid is preferred: intuitive feature architecture outside, efficient data-oriented simulation where it pays.

## Shared means actually shared

Code enters `shared/` only when at least two real features need the same semantics.

Defense-only code stays in Defense. Care-only code stays in Care.

No `utils.js`, `misc.js`, `helpers.js`, or `common.js` dumping grounds.

Do not pre-create elaborate shared taxonomies.

## Giant legacy runtime: strangler extraction

Do not rewrite the giant legacy runtime from scratch.

Extract in this default order:

1. static data/constants
2. pure functions
3. feature-local presentation helpers
4. feature-local UI
5. simulation subsystems
6. mutation domains
7. save/migration last

For every extraction:

1. characterize current behavior,
2. move one coherent responsibility,
3. update consumers,
4. remove the superseded internal implementation in the same checkpoint,
5. run parity tests,
6. cold review,
7. commit green.

Compatibility wrappers are allowed only for real external boundaries such as save compatibility, public URL/import compatibility, boot paths, stable public APIs, service-worker update windows, or deliberate legacy fallback.

Do not preserve an AI-created mistake with another wrapper.

Track remaining responsibilities and duplicate owners. Approximate LOC is only a smell, not a goal. Do not game LOC by splitting files without reducing coupling.

## Structural drift protection

For every checkpoint, internally define allowed files/directories and expected moves/new files.

Before committing, inspect changed-file list and `git diff --stat`.

If unrelated files changed, investigate and revert those unrelated edits before declaring green.

A refactor that materially grows production code without new behavior must justify what concrete complexity/duplication was removed.

## Test integrity

When a test fails, inspect production behavior first.

Do not:

- skip tests
- add xfail/expected-failure to hide regressions
- leave test.only
- comment out assertions
- lower thresholds without product reason
- add blanket suppressions
- swallow exceptions
- replace real browser tests with static checks
- make tutorial/test-only gameplay stronger just to satisfy onboarding

A test may change only when the intended product contract changed, and equivalent or stronger coverage must remain.

Passing tests are necessary, not sufficient for game-feel work.

## PWA/service-worker migration is a two-version problem

Do not test only fresh install → offline reload.

Also test:

`current deployed version → service-worker update → new candidate → reload → offline reload`

Moving modules/assets may break users who still have old cached HTML/service-worker state.

Before removing old public paths, inspect current production/main, preserve temporary compatibility only where needed, bump cache/build identity coherently, and test update behavior.

Temporary shims must have a removal condition. Do not create permanent shims for temporary deployment problems.

## Save architecture

Preserve `SAVE_KEY` and real migration compatibility.

Build representative historical save fixtures from actual repo migration/schema history, not invented fake old schemas.

Test:

`old fixture → load → migrate → play → save → reload`

No intentional player-data loss without explicit user approval.

## Stable IDs: do not fossilize provisional IDs

Classify IDs as:

- provisional/internal
- public/stable

Use evidence such as deployed usage, persisted save references, shipped content IDs, and public APIs.

Only public/stable IDs go into a hard compatibility lock.

Provisional IDs may be corrected before they become deployed contracts.

After the new baseline ships, CI may allow additive stable IDs while rejecting accidental removal/rename unless an explicit migration/alias exists.

## Validation: few tools, high value

Do not build an architecture-tooling product.

Prefer one small project validator plus only additional tools that solve proven separate jobs.

Useful deterministic checks may include:

- duplicate canonical IDs
- alias collisions
- broken content references
- unresolved behavior IDs where used
- invalid numeric ranges
- missing required fields
- prohibited new root production files
- accidental stable-ID removal
- obvious test-disable patterns
- obvious new god files
- temporary compatibility shims past removal conditions

Rules should protect correctness/navigation, not enforce arbitrary aesthetics.

## Assets and CSS follow settled ownership

Do not start by moving every image and stylesheet.

First establish feature ownership. Then move assets/presentation alongside settled features.

Preserve CSS cascade/order and every public/offline path.

Do not redesign just because CSS moved.

## Root/history cleanup

The repo root should eventually contain only genuine entry/host/config surfaces.

Move retired version archaeology, superseded audits/status docs, and old reports into `docs/history/` when safe.

Do not delete useful history unnecessarily.

Preserve deployed/public paths with temporary thin shims only when required.

## Seasonal/update extensibility

Seasonal content should behave like first-party content packs/data overlays rather than hardcoded branches across the repo.

Where appropriate, a seasonal pack should be able to declare activation rules, items, cosmetics, maps/waves, rewards, text/art references, and optional behavior references.

Do not build a full mod loader now.

The goal is to prove Halloween/holiday content does not require cross-repo surgery.

## Adding content must become boring

Prove workflows for:

- new Rizo
- Defense enemy
- tower
- wave
- map
- item
- arcade game
- care action
- seasonal event

Ordinary content should touch the smallest obvious set of feature-owned files.

If a normal tower requires editing a data file, registry table, UI table, save table, switch statement, and another manifest, the architecture failed.

## Cold review

After every significant green checkpoint, perform an adversarial cold review.

If a fresh read-only worker/subagent is available, give it acceptance criteria, current diff, relevant tests, and architecture rules. Let it inspect relevant surrounding code but avoid feeding it the implementation's self-justification.

Review for:

1. duplicate ownership
2. wrapper/adapter accumulation
3. wrong feature location
4. dead old implementation
5. accidental behavior change
6. weakened tests
7. suppressions/ignores
8. PWA/public-path regression
9. save regression
10. hidden new globals
11. new god files
12. unnecessary abstractions
13. normal content addition becoming harder
14. a simpler design now visible after implementation

Fix material findings before continuing.

## Parallelism

Parallel work only for truly isolated scopes.

Safe examples: read-only research, independent arcade inspection, independent test analysis, asset inventory.

Unsafe examples: two writers on catalog, save schema, the same feature simulation, or overlapping public contracts.

Individually green branches are not assumed to compose. Test the combined result after integration.

## Migration checkpoints

### A — Real inventory

Map active entry points, feature responsibilities, historical files, duplicate authorities, save/offline/public-path surfaces, giant-runtime responsibilities.

### B — Characterization

Capture important current behavior, old saves, first Defense loop, boot/arcade, fresh PWA, PWA update path, and public identities.

### C — Minimal target skeleton

Create only real feature folders and minimal architecture docs. No empty architecture cosplay. No behavior change.

### D — Static content ownership

Move coherent authoritative definition families, derive indexes, delete duplicate tables, point legacy consumers at the new owner, validate references.

### E — Feature extraction

Extract one feature at a time: Rizo, Defense, Care, Arcade, Progression, World. Data/pure logic first; presentation/UI next; simulation next; mutation-heavy code later.

### F — Save

Consolidate save ownership only after feature boundaries stabilize. Run historical save fixtures.

### G — Assets/presentation/root cleanup

Move settled assets/CSS, preserve public paths during update window, archive root archaeology, test PWA update behavior.

### H — Authoring ergonomics

Add the smallest useful validator/stable-ID protection, prove add-X workflows, prove seasonal extension, remove expired migration shims/inventories.

Every checkpoint must be green before the next.

## Architecture must not swallow gameplay

Architecture is infrastructure for the game, not the product.

Do not refactor untouched code for aesthetics.

Refactor when the current or next real gameplay feature is blocked by structure.

Once organization is green enough to make gameplay cheaper, continue the actual game roadmap automatically.

## Automatic gameplay campaign

Continue through:

Defense combat/performance
→ Defense depth
→ arcade quality triage/rebuild
→ care vertical slice
→ unified progression
→ Rizo identity / long-term systems
→ breeding/genetics only when the underlying Rizo/content/state model is ready
→ seasonal/update workflow proof
→ mobile/PWA reliability
→ release candidate

At every phase:

1. define measurable acceptance criteria
2. preserve previous gates
3. implement small coherent slices
4. use real browser/mobile play tests
5. cold review
6. fix
7. commit green
8. update `docs/EXECUTION.md`
9. re-orient from disk
10. continue

Static tests do not prove fun. Actually test the real browser/mobile flow for pacing, feedback, first-use intuitiveness, touch behavior, and performance.

Do not auto-approve subjective game feel merely because CI is green. Record uncertain creative findings for final user review unless they genuinely block engineering.

## Stop conditions

Stop and ask the user only when:

- two legitimate product directions conflict and code/tests cannot decide
- a save migration would intentionally alter/lose player data
- a major visual/creative choice changes Rizo identity
- account/payment/legal credentials are required
- the only path forward requires touching `main` or merging
- a genuine product ambiguity blocks engineering

Do not stop merely because a test failed, context compacted, a file is large, or the next checkpoint is tedious.

## Final definition of done

The campaign is complete when:

1. the filesystem describes the game
2. the giant legacy runtime is substantially decomposed or a thin compatibility shell
3. static definitions have one owner
4. indexes are derived
5. definition/runtime/save concepts are distinct
6. public stable IDs are protected without fossilizing provisional ones
7. historical saves load correctly
8. service-worker update from current production works
9. fresh offline works
10. mobile gameplay works
11. local feature calls are explicit
12. cross-feature events are deliberate and few
13. ordinary content addition is localized
14. seasonal content is not cross-repo surgery
15. root archaeology is archived
16. structural rules are executable where valuable
17. no parallel duplicate architecture was introduced
18. previous green checkpoints remain intact
19. cold review finds no unresolved material defect
20. humans and fresh AI sessions can navigate without tribal memory
21. gameplay development resumed and benefited from the new structure

## Final report

At release-candidate stop, report:

- final folder tree
- top-level ownership
- before/after giant legacy runtime responsibilities and approximate LOC
- authoritative content ownership
- exact workflow to add Rizo, tower, enemy, wave, map, item, arcade game, care action, seasonal event
- stable vs provisional ID policy
- save compatibility results
- PWA fresh-install and old-version-upgrade results
- full test results
- consciously retained legacy seams and why
- gameplay phases completed
- remaining release blockers
- final green branch/HEAD

Do not substitute an architecture essay for implementation.

Make the filesystem explain Rizo.
Make data easy to author.
Let the machine derive indexes.
Keep one owner.
Characterize before moving legacy behavior.
Do not build empty architecture.
Do not add a build system without a real reason.
Do not fossilize provisional IDs.
Test the PWA upgrade path, not just fresh offline.
Use checkpoint commits as memory.
Delete superseded implementation.
Do not cheat tests.
Do not roll back proven work.
Then finish the game.
