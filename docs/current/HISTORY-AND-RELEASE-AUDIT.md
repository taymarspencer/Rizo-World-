# Branch and pull-request history audit

Remote snapshot verified on 2026-10-04 UTC (2026-10-03 in Pittsburgh). Default branch: `main`. The authenticated GitHub branch/PR snapshot was checked against a complete local fetch before changes.

| Reference | Verified starting SHA |
| --- | --- |
| Integrated public foundation | `a5b10db4ae19426e09967025baf543237bebe7c1` |
| `main` / `astra-pack-temp-20260905` | `e5f09048ec472850c44e69cb4f2e98c8006de02b` |
| Defense master / PR #6 | `3be1bd7bb253cfaaeb9812bbe0be8b9161a34771` |
| Arcade quality branch | `4641cbc92166a95100b9b2048b197fecda8f7f80` |
| Origin combination branch | `14fda7cbef88f25532ec4c8c3573761afd7e0411` |
| Shopify event branch | `686271fca553ca1b7bfeee57ab1277dd66ac334a` |
| Core / PR #1 | `788b6c6c42da8117b1396e7d14b41e1a40014cc1` |
| Organizer / PR #2 | `7c859c8f2b7dfbc38ae2cdf32b05e4470124897e` |
| Phase 1 / PR #3 | `ca456d3094faa4d43c488a66c7c88adbcc70e1a3` |
| Phase 2 / PR #4 | `59cea084f2adbce830ee21bd2b4f513def898feb` |
| OZ execution / PR #5 | `68e4e0de20558f6ff264d2eed5700ec3d74b1758` |

## How today's integrated build descended

`main` is a real ancestor of the public foundation: **11 commits ahead, 0 behind**, 260 changed files (39,282 insertions / 5,626 deletions) before this organizational pass. The integrated line is:

| Commit | Contribution |
| --- | --- |
| `e5f0904` | Older v86 candidate on `main`. |
| `3be1bd7` | Defense master integration from the verified v87 baseline and Workers A–J. |
| `4f22458` | Accepted final player-experience pass: compact opening/phone bench and QA. |
| `8ba4b29` | Phase 0 audit, recorded before restructuring. |
| `e79529d` | Save safety, training and game-mode contracts. |
| `0b6553b` | Defense moved onto the mode contract. |
| `440cbd0` | All ten training games moved onto the training contract. |
| `ea26f44` | Dungeon playable-room proof. |
| `6865e7f` | Accepted opening, Threshold journey and homecoming. |
| `8b4f9c2` | Accepted Dungeon art, places and characters. |
| `7a64fe6` | Permanent narrative authority/proposals under `docs/dungeon/story/`. |
| `a5b10db` | Public World/Journal/help/policies, disabled ad boundary, packaging and verification. |

No merge, squash or reconstruction is required to give this line a clear name. **`develop` was created at exactly `a5b10db4...`**, then receives the narrow release-blocking Dungeon input fix and organizational changes described in the verification record. The old integrated branch remains at its checkpoint. `main` is unchanged.

## Every meaningful branch

Counts below are historical branch-only commits / integrated-only commits relative to `a5b10db4...`. Counts prove ancestry, not behavioral equivalence. Every existing branch stays in this pass.

| Branch | Purpose / classification | Relationship | Unique work remaining? | Superseded? | PR / keep open? | Archive/delete later? / proof |
| --- | --- | --- | --- | --- | --- | --- |
| `main` | Production gate; **ACTIVE** | 0 / 11; ancestor | No newer code | Older candidate, still release authority | Release PR targets it | Keep permanently. Its exact head is the merge base. |
| `develop` | Canonical integrated next version; **ACTIVE** | Created at exact integrated head; then organizational changes | Current complete product | No | Draft release PR to `main`; keep draft | Keep permanently; no history rewrite. |
| `claude/rizo-codebase-audit-yuqlns` | Public-foundation trace; **CONTAINED IN CURRENT** | 0 / 0 at creation | No work beyond the starting product | Canonical role moves to `develop` | No historical PR | Keep as checkpoint. Any eventual removal needs rechecked containment. |
| `claude/rtd-master-integration-c2g0r8` | Defense A–J integration; **CONTAINED IN CURRENT** | 0 / 10; exact ancestor | No branch-only commits | Its standalone release gate is superseded | #6: safe to close with context after release gate exists | Branch stays. Ancestry proves every original commit remains reachable. |
| `astra-pack-temp-20260905` | Historical packaging name; **CONTAINED IN CURRENT** | 0 / 11; exact same head as `main` | None at this branch head | Yes as a development path | None | Can eventually archive after recheck; unchanged here. Old packaging Actions runs are historical evidence, not current QA. |
| `claude/rizo-arcade-quality-pass-o17io9` | Shared arcade/pause work; **SUPERSEDED** for current runtime | 7 / 11; diverged at `main` | Original commit provenance remains; current contracts replace the old scheduler | Yes in the integrated gameplay path; not a byte-identical branch | None | Keep. 49 changed-path blobs match current exactly; scheduler behavior is carried by the run clock/jobs and freeze regression suite. Do not replace new modules with its old monolith. |
| `rizo-core-v1` | Registry/selectors/event bus and World coexistence; **UNIQUE HISTORY — PRESERVE** | 56 / 11; diverged at `main` | Yes: `src/rizo-core/`, `src/content/`, `src/rizo-world/`, Core docs/tests | Some ownership goals are met by different current contracts; equivalence not proven | #1: stays open | Do not delete. Those source trees are absent from current, not renamed copies of `core/`. |
| `codex/rizo-world-organizer` | World facade/player boundary/execution plan; **UNIQUE HISTORY — PRESERVE** | 75 / 11; same merge base | Yes: hardened facade/resolver, plans and organizer browser test | The current hub-only writer serves a related goal, with a different API | #2: stays open | Do not delete. Compare `src/rizo-world/world.js` with current mode/training host, not directory names alone. |
| `phase-1/defense-first-120` | Explicit choose/place/pop/upgrade coach; **UNIQUE HISTORY — PRESERVE** | 96 / 11; same merge base | Yes: `defense-onboarding-v1.js` and first-120 test | The accepted Captain/bench opening takes a different approach; exact walkthrough is not present | #3: stays open | Do not delete or auto-merge. Its `.75/.36` authored target and coach are unique; current four-tool bench and contextual choice rail must not be overwritten. |
| `phase-2/defense-combat-feedback` | Standalone recoil/impact/pop presentation; **UNIQUE HISTORY — PRESERVE** | 104 / 11; same merge base | Yes: `defense-combat-feedback-v1.css`, browser gate and OZ plan | Current Worker I/E and canvas FX cover related intent, not the identical stylesheet | #4: stays open | Do not delete. `rizo-combat-*` animation implementation is absent; no blanket containment claim. |
| `codex/execute-autonomous-campaign-based-on-guidelines` | Historical cloud execution evidence; **UNIQUE HISTORY — PRESERVE** | 106 / 11; 2 commits beyond Phase 2 | Yes: `docs/EXECUTION.md`, `docs/ARCHITECTURE.md` | Its old campaign is not the active release workflow | #5: stays open | Preserve. These two documentation commits add no product runtime; current absence does not erase their evidence. |
| `claude/rizo-combination-game-8neuy3` | Separate RIZO ORIGIN game; **UNIQUE HISTORY — PRESERVE** | 2 / 11; diverged at `main` | Yes: standalone `rizo-origin/` and `rizo-origin-v11/` (139 v11 files) | No proven replacement | None | Keep separate. These products are absent from today's playable companion; do not silently add them to this release. |
| `claude/rizo-halloween-event-layer-u4vat0` | Separate Shopify Store theme/event layer; **UNIQUE HISTORY — PRESERVE** | 4 / 11; diverged at `main` | Yes: 127 files under `shopify/` | No proven replacement within this repo | None | Keep separate. Store history belongs to another product and is absent from this artifact. |

## PRs #1–#6

The old PRs are **stacked**, not six independent patches for `main`:

| PR | Head → base | Classification / action |
| --- | --- | --- |
| #1 | `rizo-core-v1` → `main` | **UNIQUE HISTORY — PRESERVE**. Remains open/draft, head unchanged. |
| #2 | `codex/rizo-world-organizer` → `rizo-core-v1` | **UNIQUE HISTORY — PRESERVE**. Remains open/draft, no retargeting. |
| #3 | `phase-1/defense-first-120` → organizer | **UNIQUE HISTORY — PRESERVE**. Remains open/draft; alternative walkthrough requires an owner-directed comparison. |
| #4 | `phase-2/defense-combat-feedback` → Phase 1 | **UNIQUE HISTORY — PRESERVE**. Remains open/draft; exact FX implementation not contained. |
| #5 | OZ execution → Phase 2 | **UNIQUE HISTORY — PRESERVE**. Remains open; documentation/provenance only beyond #4. |
| #6 | Defense master → `main` | **CONTAINED IN CURRENT**. Its complete head is an ancestor of the new release; archival comment and closure are safe without merging/deleting its branch. |

No old PR is retargeted to `develop`: doing so could propose the entire divergent older product against the new architecture. A valuable historical idea should become a narrowly reviewed feature from today's `develop`, with attribution and its old branch retained. Closing #6 means its separate review gate is redundant; it does **not** mean its work was separately merged into `main`.

## Source evidence, beyond branch names

- `MASTER_INTEGRATION_MANIFEST.md` records baseline recovery, all ten workers and resolved seams. PR #6's head is a real ancestor, so its manifest and integration commit cannot be lost by creating `develop`.
- `git diff --name-status -M 3be1bd7 a5b10db -- defense-core-v79.js defense-canvas-v79.js modes/defense core/rizo-save-core.js` detects the canvas as **R100** and rules as **R084**. Save rules moved to the save contract; the Defense runtime lives in `modes/defense/defense-mode.js`. The new placement/checkpoint/economy suites verify behavior, not merely filenames.
- Arcade's `PACKAGE_MANIFEST.txt` still records `c4879d5` and the old pause fix. It is historical packaging guidance. The current `game-v79-defense.js` implements `runClockNow`, `trainingSchedule`, `pollTrainingJobs` and stacked holds; `tests/browser-v87-arcade-freeze.py` now exercises the new run-clock ownership. Current build tooling is authoritative.
- Core/organizer files were actually read: `createRizoCore` composes registry, state, event bus and game host; `createRizoWorld` provides canonical IDs, source resolution, launch/invoke and a read-only legacy player snapshot. Current `core/rizo-modes.js`, `core/rizo-training.js` and hub ownership replace some goals but do not implement that whole facade. They are not proof of complete containment.
- The Phase 1 source and Phase 2 stylesheet were read and compared with current Defense's Captain flow, Worker H phone layout and Worker I/E effects. Similar player intent is recorded separately from exact preserved code.
- Dungeon art/runtime and `docs/dungeon/story/` are already descendants in the accepted line. This release pass changes only Dungeon's resize/input guard, preserving all its art and content. The full-story proposals and ten owner decisions remain unadopted.
- For precision: from `7a64fe6` to `a5b10db`, `modes/defense/` is unchanged, but **`game-v79-defense.js` changed** for release/UI/ad-hold integration. This pass does not claim all Defense-related source stayed byte-for-byte unchanged during the earlier product pass.

## Rechecking the claims

```sh
git fetch origin
git merge-base --is-ancestor origin/main a5b10db4ae19426e09967025baf543237bebe7c1
git merge-base --is-ancestor 3be1bd7bb253cfaaeb9812bbe0be8b9161a34771 a5b10db4ae19426e09967025baf543237bebe7c1
git rev-list --left-right --count origin/main...a5b10db4ae19426e09967025baf543237bebe7c1
git rev-list --left-right --count origin/claude/rtd-master-integration-c2g0r8...a5b10db4ae19426e09967025baf543237bebe7c1
git diff --name-status origin/main origin/phase-2/defense-combat-feedback
git show origin/codex/execute-autonomous-campaign-based-on-guidelines:docs/EXECUTION.md
```

Expected ancestry commands exit 0; counts are `0 11` and `0 10` at the recorded snapshot. Future branches may move; recheck before deletion, merge or release. [Verification](../verification/RELEASE-ENGINEERING-VERIFICATION.md) records the tested source and release gates.
