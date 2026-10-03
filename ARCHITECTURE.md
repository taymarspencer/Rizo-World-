# Rizo.game architecture

Rizo.game is a static vanilla HTML/CSS/JS PWA. **The pet is the hub.** Training builds the pet, and the pet
is what the player brings into game modes.

```
                 ┌──────────────────────────── HUB ────────────────────────────┐
                 │  pet sim · care · House · closet · journal · arcade shelf   │
                 │  owns the save, the wallet, every pet, petMarkup()          │
                 └───────▲──────────────────────────────────────────▲──────────┘
     start(pet) / end(result)                                 host API only
                         │                                          │
   ┌─────────────────────┴──────────┐            ┌──────────────────┴─────────────────┐
   │ TRAINING QUEUE (core/rizo-     │            │ GAME MODES (core/rizo-modes.js)    │
   │ training.js)                   │            │ Rizo Defense → Dungeon → Scroll    │
   │ 25–60 s runs that return a     │            │ Fighter. Own folder, own save      │
   │ score. The hub converts it     │            │ slice. Read pet snapshots, award   │
   │ into pet growth.               │            │ Embers/XP back, exit to the hub.   │
   └────────────────────────────────┘            └────────────────────────────────────┘
```

Neither side ever writes the save, the wallet or a pet directly. The hub is the only writer.

> **Status (Dungeon Gate 1):** both contracts exist, are tested, and carry every game. The ten training games
> live in `training/<id>.js` and play through the hub's training runner (§4); Rizo Defense runs on the
> game-mode contract from `modes/defense/` (§8). Rizo Dungeon (§9) is a one-room **review build** of The
> Threshold on the same contract, plus the host additions it needs (confirmed commit, receipts, care policy).

---

## 1. Files and load order

Order matters. Each file may use only the files above it.

| # | File | Kind | Owns |
|---|---|---|---|
| 1 | `rizo-config.js`, `install-manager.js`, `monetization.js` | browser | Owner config, PWA install, dormant ads. |
| 2 | `core/rizo-save-core.js` | **pure** (browser + Node) | Hub limits, the signed save envelope (v1 frozen, v2 current), mode-slice shape. |
| 3 | `core/rizo-training.js` | **pure** | The training contract: game definitions and score → stat conversion. |
| 4 | `core/rizo-modes.js` | pure rules + browser host | The game-mode contract: registry, slice migration, award limits, host API. |
| 5 | `core/rizo-catalog.js` | **pure** | Shared read-only game data every layer may use: the Rizo variants. |
| 6 | `modes/<id>/…` | browser | One game mode each. Registers with `RizoModes.register`. Today: `modes/defense/defense-core.js` (pure rules), `defense-canvas.js` (canvas presenter), `defense-mode.js` (registration + runtime); `modes/dungeon/dungeon-content.js` (frozen rooms/lines), `dungeon-core.js` (pure rules), `dungeon-input.js` (action state), `dungeon-view.js` (handheld + canvas), `dungeon-mode.js` (registration + runtime). A mode whose scripts are missing simply does not register; the hub still boots. |
| 7 | `training/kit.js`, `training/<id>.js` | browser | The ten training games, one file each, plus a tiny shared DOM kit. Each registers with `RizoTraining.register`. |
| 8 | `game-v79-defense.js` | browser | **The hub**: save I/O, pet simulation, care, House, UI, `petMarkup()`, the training runner, and the host adapter both contracts talk to. (The file keeps its historical name; neither Defense nor any minigame lives in it any more.) |

Stylesheets follow the same split: a mode's own styles live in `modes/<id>/styles/` and resolve `url()`
paths from there (`../../../assets/…`). `launch-v79-defense-alive.css` is still shared: about 40% of it is
Defense rules mixed in with hub rules, and splitting it is left for a later pass.

"Pure" files have no DOM access and are `require()`-able, so their rules are unit-tested in Node.

## 2. Hard rules and what enforces them

| Rule | How it holds |
|---|---|
| One renderer, `petMarkup()`, for every pet surface | Modes get `host.petMarkup(snapshot)`; training games get `run.petMarkup()`. Neither ships its own Rizo art path. Known exceptions are listed in `AUDIT.md` M1. |
| No frameworks, no build step | Plain `<script>` files. Pure modules use a small UMD wrapper so Node tests can `require()` them. |
| Timestamp-based timers only | Training games read time only from the run clock (`run.now()`), which stands still while a run is held, and schedule with `run.after` / `run.every`: deadlines polled each frame, never `setTimeout`. `tests/training-boundaries.test.js` fails if a game reads a wall clock or a raw timer. |
| Defensive save migration; never lose player data | §3. `tests/save-safety.py` replays old saves on every change. |
| Bump the service-worker cache on every delivery | §6. `tests/release-integrity.test.js` fails unless the build marker matches in all four places and every loaded file is in the shell. |

---

## 3. The save

### Keys

| Key | Contents | Written by this build? |
|---|---|---|
| `rizo-save-v2` | **Current save.** Envelope v2 (below). | Every save |
| `rizo-save-v2:backup` | Byte-identical mirror of the last good write. | Every save |
| `rizo-life-overhaul-v2` + `:verified-backup-v1` | Pre-v88 envelope v1. | **Never.** Read once to migrate, then kept as the rollback copy. |
| `rizo-life-save-v1` | Pre-v66 raw save. | Never. Read as a migration source. |
| `rizo-save-quarantine:<time>` | A save this build could not load, set aside before anything overwrote it (newest 5 kept). | Only on failure |
| `rizo-mode-run:<modeId>` | A game mode's resumable in-progress run. | By the mode, through `host.run` |
| `rizo-life-overhaul-v2:defense-checkpoint-v68` … `-v42` | Pre-v88 Defense runs. | Never. Copied once into `rizo-mode-run:defense`, removed only after the copy is written. |
| `rizo-defense-map-seen:<mapId>` | Pre-v88 "map intro seen" flags. | Never. Folded into the Defense slice at first boot, then removed. |

### Envelope v2

```json
{
  "app": "RIZO LIFE", "saveVersion": 2, "stateVersion": 20, "savedAt": 1790000000000,
  "writeId": "W-1A2B3C4D5E6F",
  "state":  { "...hub state: player, wallet, pet, farm, scores, settings, meta..." },
  "modes":  { "defense": { "schema": 1, "data": { "...owned by the mode..." } } },
  "signature": "s2.xxxxxx"
}
```

- `signature` covers `state`, `modes` and `savedAt` (stable-key JSON + FNV-1a with a salt). It is a casual-edit
  deterrent, not security. `writeId` is bookkeeping and is not signed.
- v1 signed only a projection of the state, so any change to that projection broke every save. v2 signs
  everything, so new fields never need a new signature version.

### Loading

The loader tries, newest first: v2 → v2 backup → v1 → v1 backup → raw v1. The first copy that verifies (or is
a trusted legacy migration) wins. Then:

- Any v2 copy that failed is written to `rizo-save-quarantine:*` **before** the next save overwrites it.
  Journal → Settings shows a download button for each one.
- v1 keys are never written, so a broken or tampered v1 save keeps its original bytes on its own.
- A copy that fails its signature keeps the pet and cosmetics, but rewards reset (wallet, records, counters).
  The original bytes stay recoverable as above.
- A save written by a **newer** build is never loaded or rewritten: either a newer envelope (`saveVersion` above
  this build's) or a verified v2 envelope from a newer hub (`stateVersion` or `state.version` above `VERSION`).
  The second check runs before normalization, so a newer field or an unknown wearable is not silently dropped.
  The tab shows "THIS SAVE BELONGS TO A NEWER RIZO.GAME" and offers an update. Limitation: builds before
  state version 22 do not have this check, so rolling the whole site back past v89 lets an old hub normalize a
  v22 save (it keeps the pet and cosmetics it knows, and drops `modeReceipts`/`storyMarks`). Removing only the
  Dungeon scripts is safe: First Knot is a hub wearable and the unregistered slice is kept untouched.

### Writing

- Every write checks the stored `writeId`. If another tab or the installed app saved since this tab last loaded
  or saved, this tab stops saving and shows "RIZO IS OPEN SOMEWHERE ELSE" with a reload button. The `storage`
  event triggers the same thing immediately.
- A failed write (storage full or blocked) toasts once instead of failing silently.
- One function, `persistStateNow()`, writes the envelope for both `saveState()` and a mode's `host.commit()`.
  It reports `committed` only when the primary copy holds this exact state; a failed mirror write is still
  `committed` with `backupSynced: false` (the primary is the record).
- Reset blocks every later write (including the unload save) before deleting keys.

### Changing the schema

| Change | Do this |
|---|---|
| Add or rename a hub state field | Bump `VERSION` (state version), normalise it defensively in `normalizeState()`, add an old-save case to `tests/save-safety.py`. No signature change is needed. State version 22 is the latest example: `modeReceipts` (per-mode reward receipts, never pruned) and `pet.storyMarks` (≤ 16 small positive marks a mode left on a pet), both absent → empty. |
| Change the envelope layout | Add `saveVersion: 3` in `core/rizo-save-core.js`. Keep the v2 verifier and the v1 block exactly as they are. |
| Change a mode's data | Bump the mode's `schema` and extend its `migrate()`. The hub never inspects slice contents. |
| Move hub fields into a mode | List them in `LEGACY_MODE_FIELDS` (hub). `normalizeState()` moves them out of the hub state into `state.modeInbox[<id>]`; the mode's first `migrate(…, 0, legacy)` receives them; the hub clears that inbox entry only after the slice exists. Bump `VERSION`. Defense (state version 20) is the worked example. |
| **Never** | Edit the frozen `SAVE VERSION 1` block in `core/rizo-save-core.js`, write to a v1 key, or delete a save key outside an explicit player reset. |

---

## 4. Training-game contract

A training game is a short run that turns into pet growth. It **only produces a result**: it never writes the
save, the wallet or the pet.

### Definition (`RizoTraining.register(def)`, validated at load)

| Field | Type | Meaning |
|---|---|---|
| `id` | lowercase word | Stable id, and the file name (`training/<id>.js`). It keys best scores and care history. |
| `name`, `kicker`, `hint`, `art`, `button` | strings | Cabinet, shelf button and run-header copy. |
| `duration` | 10–120 s | Run length on the run clock. A game may extend its own deadline (Ember Beat's lead-in). |
| `energy` | 1–40 | Energy a credited run costs. It also sets the reward budget. |
| `lives` | integer ≥ 0 | Hearts, if the game uses them. |
| `par` | number > 0 | **The score of a solid, competent run.** All reward scaling hangs on this (table below). |
| `trains` | `{skill: weight}` | Which of `speed · power · instinct · stamina · luck` the game builds. Normalised to sum to 1. |
| `care` | `{bond, mood, hype, hunger}` | `bond`/`mood`/`hype` weights 0–1. `hunger` is the change for a par run: negative for exertion, positive for food games. |
| `alignment` | −3…3 | Nudge toward kind (+) or wild (−) per credited run. |
| `sounds` | `{win, fail}` | The game's sound family, played through `run.cue()`. |
| `music` | track or `false` | A hub music track `{tempo, lead, bass, wave}`, or `false` when the game plays its own (Ember Beat). |
| `quest`, `counter`, `signal`, `finds` | optional | Hub extras the game may ask for: a daily-quest type it advances, a meta counter (`totalWalks`), whether it feeds the Retro arcade signal, and which finds it may report (`{treasure, variants:[ids]}`). Anything not declared is ignored. |

Hooks (functions; any other function on the definition is rejected at load, so a typo can't silently never run):

| Hook | Called |
|---|---|
| `start(pet, run)` | Once. `pet` is a frozen snapshot. Draw into `run.arena`; add the game's own fields to `run.state`. |
| `frame(dt)` | Every frame, in slices of at most 40 ms (a slow device plays at the right speed, not in slow motion). |
| `input(event)`, `move(event)`, `release(event)`, `key(event)` | Pointer down / move / up in the arena, and keys. `key` returns `true` if it used the key. |
| `header()` | Optional override for the header (`{timer, score}`), e.g. Ember Beat's READY. |
| `pause()`, `resume()` | The run was held / released (the clock already stopped; Ember Beat stops and reschedules its audio). |
| `settle(reason)` | The run is ending: last chance to settle state (Spark Stash banks on quit, spills at the buzzer). |
| `qualified(board)` | Did real play happen? A run that doesn't qualify is a warm-up: it costs nothing and earns nothing. |
| `result(board, reason)` | `{ stats:[{label,value}] ×≤4, voice:{headline,line,art}, subtitle, finds, rewardScore }`. `rewardScore` replaces the points for conversion when they differ (Ember Beat measures quality × song played). |
| `stop()` | Once, after the result: release everything. The runner removes `board.entities` nodes and clears jobs. |
| `qa*` | QA builds only: `qa()` (extra hooks), `qaSnapshot`, `qaAuthored`, `qaMini`, `qaBuffs`, `qaQualify`. |

### Lifecycle

```
hub:  energy check → frozen pet snapshot → stage → game.start(pet, run)
game: plays on run.state with run.now(), run.after(); the clock runs out, or the game calls run.end()
hub:  game.settle() → qualified? → game.result() → game.stop() → convert() → growth → results screen
```

`run` — the only way a game reaches anything outside itself:

| Member | Purpose |
|---|---|
| `run.arena` | The element the game draws into. Emptied before and after. |
| `run.pet`, `run.petMarkup(extraClass)` | The snapshot, and the one pet renderer for it. |
| `run.state` | The run's board: `score, hits, playerInputs, lives, maxLives, endReason, endAt, entities`. The header, pause panel and results read it; the game adds its own fields. Never saved. |
| `run.now()` | Run clock (epoch-like ms). It stands still while the run is paused, in an ad, backgrounded, or the save is blocked. |
| `run.after(ms, fn)`, `run.every(ms, fn)`, `run.cancel(id)`, `run.clearJobs()` | Deadlines on the run clock, polled each frame. Held runs fire nothing. |
| `run.end(reason)` | End now: `"death"` or `"cleared"` (a game reports cleared itself; the runner never infers it). |
| `run.loseLife()`, `run.renderLives(id)` | Hearts. Losing the last sets `endReason = "death"`. |
| `run.sfx(name)`, `run.cue("win"\|"fail")`, `run.haptic(p)`, `run.burst(...)`, `run.toast(text)` | Hub sound, haptics and flourish, respecting the player's settings. |
| `run.settings()`, `run.audio` | Read-only settings; Web Audio context and helpers for a game that plays its own music. |
| `run.best`, `run.memory()`, `run.remember(data)` | The game's best score, and a small persistent memory (≤ 4 KB, `state.trainingMemory[id]`). |

What the hub adds on top of `convert()` for every credited run: the best score, games played and care history,
+10 Heat and the daily "play" quest, the game's declared `quest` / `counter`, the Retro signal for `signal`
games, and only the `finds` the definition declares (an undeclared rare find is refused even at 100% odds).

### Pars (first calibration, Phase 3)

Set at about 45% of a full-run score by a bot that never misjudges and reacts in 330–650 ms
(`tests/calibrate-training-pars.py`; Skybound is estimated from its scoring). They are first estimates: tune
them with real play, and change the par, never a reward formula.

| Game | Energy | Par | Game | Energy | Par |
|---|---|---|---|---|---|
| Power Tape | 15 | 100 | Ember Beat | 12 | 45 *(quality)* |
| Spark Stash | 10 | 220 | Lost Signal | 7 | 50 |
| Forest Lunch | 11 | 70 | Skybound | 10 | 40 |
| Rizo Courier | 15 | 60 | Ember Forge | 11 | 35 |
| Rain Walk | 8 | 60 | Rizo Runaway | 10 | 150 |

### Score → stat conversion (`RizoTraining.convert`)

```
qualified    = the game's qualified(board), and score > 0 with at least one input
performance  = min(score / par, 1.5)          0 when not qualified
skill points = performance × energy × 0.5     split by `trains` weights, capped by the pet's genes
XP           = performance × energy × 3.5
Embers       = max(4, round(performance × energy × 5))
Bond         = performance × care.bond × 4
Mood         = performance × care.mood × 10
Hype         = performance × care.hype × 15
Hunger       = care.hunger                    (exertion, paid in full)
             = performance × care.hunger      (food games)
Energy       = −energy                        (only for a qualified run)
```

Because performance is measured against `par`, a game's raw score scale doesn't matter: a 40-point game and a
600-point game pay the same for the same effort. The 1.5 cap means no run can pay more than 1.5× a solid run.
The budget scales with the Energy the run costs, so long, demanding games pay more than short, light ones.

A par run for a 10-Energy game pays 5 skill points, 35 XP, 50 Embers, and up to 4 Bond. The ceiling for any
run of that game is 7.5 skill points, 52.5 XP, 75 Embers, and 6 Bond. A run that does not qualify (warm-up)
costs nothing and earns nothing.

---

## 5. Game-mode contract

A game mode is a deep, persistent game the player enters from the hub with their Rizo.

### Folder

```
modes/<id>/
  <id>-mode.js        registration: RizoModes.register({...}); host glue
  <id>-core.js        pure rules (Node-testable), if any
  <id>-*.js / *.css   presentation, assets
```

A mode may depend on `core/*`. It may not depend on another mode, or on the hub's internals (`state`, `mini`,
`el`).

### Definition (`RizoModes.register(def)`)

| Field | Meaning |
|---|---|
| `id` | Lowercase word. It also keys the save slice. |
| `name` | Display name. |
| `schema` | Integer. The version of the mode's slice format. |
| `migrate(data, fromSchema, legacy)` | Returns slice data at `schema`. Called with `fromSchema` 0 (no slice yet) and `legacy`: a frozen, read-only view of any pre-contract hub fields the mode used to own. Called again whenever `schema` grows. Must return a plain object. |
| `create(host)` | Returns the instance (below). Called on every launch; the instance lives until `host.exit()`. |
| `entry` | Optional `{ energy }`: what the shelf checks before launching (the mode charges it itself through `award`). |
| `settings` | Optional player settings: `[{ key, kind: "toggle" \| "choice", title, copy, default, choices: [[value, label]] }]`. The hub draws them in Journal → Settings and stores them in the slice under `data.settings`. |
| `summary(data)` | Optional. Small public facts for hub surfaces: `{ best, bestLabel, unit, milestones, badge: { text, title } }`, and optionally `entryLabel` / `lengthLabel` (replace the shelf's ENERGY / ENDLESS cells) and `journey: { petId, petName, status, complete }` (drives the release/rebirth warning). The hub reads nothing else from a slice. |
| `carePolicy` | Optional, `"normal"` (default) or `"foreground-hold"`. See *Care policy* below. |
| `qa(hubQA)` | Optional, QA builds only. Returns hooks merged into `window.RizoRuntimeQA`; may wrap the hub's own. |

Instance hooks (all optional except `start` and `stop`): `start(options)`, `stop()`, `suspend(reason)` /
`resume(reason)` (app backgrounded, ad, save blocked), `key(event)` → `true` if the mode handled the key,
`resize(reason)`, `quit(reason)` (the hub needs the player back: bank or checkpoint, then `host.exit()`).

The hub calls `ensureSlice()` for every registered mode at boot, so migrations run once, before first play. A
slice written by a newer build (higher `schema`) is preserved untouched, and that mode refuses to launch.

### Host API (the only way a mode reaches the hub)

| Member | Does |
|---|---|
| `host.pet()` | Frozen snapshot of the active pet: identity, stage, form, level, needs, `skills`, `genes`. Take it at run start; it does not change under you. |
| `host.roster()` | Frozen snapshots of every pet the player can bring (active + House, hatched and alive). |
| `host.petMarkup(snapshot, options)` | The one pet renderer. |
| `host.slice.read()` / `host.slice.write(data)` | The mode's durable data (plain object, ≤ 400 KB). Saved inside the signed envelope. |
| `host.run.read()` / `.write(value)` / `.clear()` | Resumable in-progress run (checkpoint). Its own key; writes are refused while the save is blocked. |
| `host.award(award)` | Grants rewards back to the hub (below). Returns what was actually applied. |
| `host.settings()` | Read-only player settings (sound, music, haptics, reduced motion). |
| `host.modeSettings()` | The mode's own declared settings, resolved against their defaults. |
| `host.keeperId()`, `host.build`, `host.debug` | The player's keeper id (to bind a checkpoint to its owner), the build marker, and whether this is a QA build. |
| `host.report(kind, details)` | Records a validation warning in the hub's log (e.g. a rejected checkpoint). |
| `host.audio` | `sfx(name)`, `tone(…)`, `noise(…)`, `haptic(pattern)`, `duck(ms, level)`, `music(track)`: a built-in scene name, an adaptive track `{ id, tempo, lead, bass, beat(step, play) }`, or `null` to hand music back. |
| `host.ui` | `toast(text)`, `modal(markup, { onClose })`, `closeModal({ silent })`, `modalOpen()`, `cutscene(options)`, `celebrate()`. `onClose` runs only when the **player** closes the modal, never on a silent close or a replacement. |
| `host.mount(header)` | Shows the shared stage and returns a frozen `stage`: `root` (add classes), `arena` (draw here), `panel` (pause panel), `header({ kicker, title, timer, score, hint, quit })`, and `close()` (hide the stage but stay open, e.g. for a results modal). Everything is reset on exit. |
| `host.exit(summary)` | Stops the mode and returns to the hub. Idempotent. `summary.destination: "home"` also opens the Den (only the hub calls `changeView`); without it the old behavior is unchanged. |
| `host.commit({ data, reward? })` | A **confirmed**, synchronous save of the slice in one hub envelope, optionally with a reward (below). Returns `{ status: "committed" \| "blocked" \| "failed", rewardApplied, duplicateReward, backupSynced, reason }`. Never infer durability from `slice.write()`. |
| `host.event(kind, detail)` | A semantic boundary: `checkpointRest`, `chapterComplete`, `sceneCommitted`, `encounterResolved`, `sessionEnded`, with `{ boundaryId, campaignId, tone: "quiet" \| "protected", interruption: "none" \| "candidate" }`. Dormant: the hub keeps a small diagnostic ring and never calls ads or install/store surfaces from it. The hub itself records `returnedToHub`. |

`commit` and `event` work only for the active instance: after `exit()` (or from a superseded instance) they
are refused without reaching the hub. A hub without the optional adapter capability makes `commit` throw
rather than pretend to save.

The hub draws a mode's shelf from markup alone: `button[data-mode="<id>"]` launches it (after the `entry`
check), `[data-mode-best]`, `[data-mode-meta]` and `[data-mode-card]` show its `summary()`. While a mode is
open the shared stage carries `data-active-mode="<id>"`, never `data-mode` (the shelf refresh rewrites
`data-mode` buttons, and before v89 it rewrote the open stage too).

### Rewards through receipts (`host.commit({ reward })`)

```js
host.commit({ data, reward: { receiptId: "threshold-x1y2:threshold-complete", petId, entitlements: ["first-knot", "shared-hearth"] } })
```

The hub keeps a static allowlist per mode (`MODE_ENTITLEMENTS` in the hub): `dungeon/first-knot` adds the
wardrobe item `first-knot`; `dungeon/shared-hearth` adds one story mark to that owned pet. Nothing else
(no currency, XP or pet patch) can be granted this way. Before anything changes, the hub refuses an unknown
entitlement, an unowned pet, or a different payload under an existing receipt. An identical repeat commits
the data and grants nothing (`duplicateReward`). Receipts live in `state.modeReceipts[mode][receiptId]` and
are never pruned. The slice, the grant and the receipt go into one envelope, written once under the
`writeId` policy; if the primary write fails, the in-memory slice, wardrobe, marks and receipts are restored
exactly. This is one-envelope atomicity in one tab, not a cross-tab lock.

### Care policy

`carePolicy: "foreground-hold"` (the Dungeon) means visible time in the mode is time spent with the pet: no
needs decay and no passive XP/skill/bond growth. The hub settles ordinary time before entry, settles the held
interval when the app is hidden and lets the hidden time count as ordinary time away, accounts that time
**before** the mode resumes, and settles again on exit. Calendar age still runs; elder/recovery modals that
would have appeared are deferred until the Den. If time away sends the pet into recovery, the hub asks the
mode to save and quit (`quit("recovery")`) and the Den's recovery flow takes over. Core calls the optional
adapter hooks `sessionStart` / `sessionEnd` around the mode's life.

### Updates

`forceReleaseRefresh()` calls `suspendActive("force-update")` first. A mode may return its `host.commit`
outcome; if it is `blocked` or `failed` the hub keeps the current build and save and says why. Modes that
return nothing keep the old behavior.

### Awards

```js
host.award({
  reason: "run",            // label for logs
  embers: 120,              // ≤ 50,000 per call
  heat: 25,                 // season XP, ≤ 200 per call
  run: true,                // counts as a completed game (lifetime games, daily "play" quest)
  pets: { [petId]: { xp: 40, bond: 2, skills: { power: 3 }, played: true } },   // ≤ 2,000 XP, 25 per skill, 10 bond
  active: { energy: -8, hunger: -3, mood: 6 }                                    // the active pet's needs, ±40/25/25
});
```

The hub clamps every value, drops pets the player doesn't own, applies skills through the pet's gene caps,
and re-checks growth stage and form. Award once per run, at the end. A mode that pays per wave should total
the run up and award it when the run ends or is banked.

### What a mode must never do

- Read or write `localStorage` save keys, `state`, `mini`, `el`, or any hub function other than through `host`.
- Mutate a pet. Snapshots are frozen. Growth happens only through `host.award`.
- Expire or silently delete a player's run. Unfinished progress is either resumable or banked by the mode.

---

## 6. Release process

Every delivery that changes a runtime file:

1. Pick a new build marker, e.g. `v88-p2-defense-mode`.
2. Put it in all four places: `index.html` (`<meta name="rizo-build">` and the boot shell's `expected`),
   `RIZO_RUNTIME_BUILD` in `game-v79-defense.js`, and `CACHE` in `sw.js` as `rizo-game-<marker>`.
3. Any new script or stylesheet goes in `index.html` **and** in `sw.js` `REQUIRED_SHELL` (network-first) and
   `SHELL`.
4. `node tests/release-integrity.test.js` checks all of the above.

## 7. Tests

| Suite | Run | Covers |
|---|---|---|
| `tests/core-contracts.test.js` | `node` | Save core (v1 frozen signature, v2), training conversion, mode rules, and all ten real game definitions and their reward ceilings. |
| `tests/release-integrity.test.js` | `node` | Build marker and service-worker shell. |
| `tests/save-safety.py` | `python3` | Old-save migration and every save-loss path from the audit, in a real browser. |
| `tests/mode-contract.py` | `python3` | A probe mode through the real hub: snapshots, stage, modal `onClose`, settings, summary, slices, awards, exit, reload. |
| `tests/training-contract.py` | `python3` | A probe training game through the real runner: snapshot, board, clock and jobs under pause, warm-up costs nothing, growth equals `convert()`, finds whitelist, memory, a game that fails to start. |
| `tests/training-boundaries.test.js` | `node` | No training game touches storage, hub state, a wall clock, a raw timer or a global listener. |
| `tests/browser-v88-training-fixes.py` | `python3` | The Phase 3 game fixes in the real runner: Spark's buzzer, TIME UP vs CLEARED, Lost Signal's payout, Ember Beat's short runs, Skybound on rotation, par and ceiling budgets. |
| `tests/defense-core.test.js`, `worker-*.test.js`, `service-worker-policy.test.js` | `node` | Defense rules and the service worker. |
| `tests/mode-host.test.js` | `node` | The host additions: commit/reward validation and outcomes, late callbacks, events, exit destination, care-session hooks, force-update outcome. |
| `tests/dungeon-core.test.js` | `node` | Dungeon rules: profile caps, movement/collision, Flare/Tuck/Kindle timing, buffering and priority, the Draftling, death/rest, pause holds, slice validation and repair. |
| `tests/browser-dungeon.py` | `python3` | The Dungeon through the real hub over HTTP: real pet, keyboard/touch/mouse, combat/death/rest, lifecycle holds, care policy, reload/import, identity, the QA completion fixture (receipts, failed primary/backup), force update, save-blocked tab, isolation, newer-hub save, v21 migration, Defense under the shelf refresh. |
| `tests/browser-*.py`, `static-defense-audit.py`, `worker-j-integration-risk-audit.py` | `python3` | Inherited browser and static suites. |

The browser suites need Playwright for Python and Chromium at `/usr/bin/chromium`. Some write JSON into the
tracked `reports/` folder; restore it with `git checkout -- reports/` before committing.

---

## 8. Rizo Defense, the reference mode

`modes/defense/` is the blueprint for Dungeon and Scroll Fighter.

| Piece | Where |
|---|---|
| Rules (waves, economy, checkpoint signature) | `defense-core.js`, pure and Node-tested. It no longer knows about the whole save. |
| Canvas presenter | `defense-canvas.js` |
| Registration, runtime, UI, QA hooks | `defense-mode.js` |
| Styles | `styles/*.css` (seven Defense-only sheets) |

Its slice (`schema: 1`):

```json
{ "records":  { "best": 23, "maps": {}, "milestones": [], "perfectMaps": [], "history": [], "mastery": {}, "contracts": [] },
  "settings": { "signatures": true, "autoStart": false, "fx": "auto", "uiScale": "standard", "waveIntel": "simple" },
  "crew": { "ids": [], "configured": false }, "school": { "dismissed": false, "completed": [], "replay": false },
  "introSeen": false, "mapIntrosSeen": [] }
```

How it follows the contract:

- **Reads** the captain and House crew only as frozen snapshots (`host.pet()`, `host.roster()`), drawn with
  `host.petMarkup()`.
- **Awards once per run**, when it ends or is banked: Embers, season heat, the run count, per-pet XP/skills for
  the Rizos that fought, and the captain's energy/hunger cost. Discarding a saved run banks it instead of deleting
  it.
- **Checkpoints** through `host.run` (signed by `defense-core.js`, bound to `host.keeperId()`); runs never
  expire.
- **Owns its loop and timers**: a `requestAnimationFrame` frame loop and a deadline job queue polled each frame
  and held while paused or backgrounded.
- **Migrated from v87** without loss: records, settings, school and crew (from `state.modeInbox`), map-intro
  flags (loose keys) and the in-progress checkpoint (old keys). `tests/save-safety.py` replays a v87 save.

---

## 9. Rizo Dungeon (Gate 1 review build)

`modes/dungeon/` runs one room of **The Threshold** (Clatter Passage) on the game-mode contract. It is a
foundation review, not the episode: there is no Latch, no boss and no player-facing reward yet.

| Piece | Where |
|---|---|
| Rooms, anchors, props, lines (frozen) | `dungeon-content.js` |
| Rules: fixed 60 Hz step, movement/collision, Flare/Tuck/Kindle, Draftling, pause holds, slice validation | `dungeon-core.js` (pure, Node-tested) |
| One action state from keyboard, mouse and touch | `dungeon-input.js` |
| The handheld, canvas room/enemies, DOM actor plane | `dungeon-view.js`, `styles/dungeon.css` |
| Registration, binding, loop, lifecycle, persistence, QA hooks | `dungeon-mode.js` |

- **The real pet.** The campaign binds `host.pet().id` at first launch. A House swap or a released pet shows
  why the journey cannot continue; it is never rebound or cleared. The Rizo on screen is
  `host.petMarkup(snapshot, { context: "dungeon" })` inside a pose wrapper; snapshots refresh only at entry and
  at the hearth.
- **One clock.** Every deadline is on the simulation clock (`sim.t`), advanced in fixed steps with interpolated
  rendering. Catch-up stops at eight steps; leftover debt during danger pauses with a `performance` hold.
- **Holds.** A set: `manual`, `background`, `ad`, `save-blocked`, `update`, `performance`. Lifecycle aliases
  normalize (hidden/pagehide/freeze/unload → background; visible/pageshow/resume release it). Any external
  hold also adds `manual`, so a fresh Resume is needed; `save-blocked` is never released by a resume.
- **Saving.** Everything goes through `host.commit`. Hearth registration, rest, death and GO HOME commit at
  once; a dirty safe continuation commits at most every 5 s; nothing saves per frame. A reload resumes at the
  last safe anchor with that anchor's Flame. A failed save is shown ("COULDN'T SAVE THIS MOMENT") with Retry
  and an explained way home; a blocked tab uses the hub's own notice.
- **Rewards.** Only the QA completion fixture (`dungeonCompleteFixtureForQA`, QA builds only) requests First
  Knot and the shared-hearth mark, to prove the receipt transaction. Ordinary play awards nothing.

Its slice (`schema: 1`, about 1.5 KB):

```json
{ "settings": { "assist": false, "textSpeed": "normal" },
  "campaign": { "id": "threshold-…", "kind": "proof", "contentRevision": "threshold-gate1", "petId": "…", "petName": "MOSSY", "status": "active", "chapterId": "threshold" },
  "world": { "visitedRooms": ["clatter"], "openedShortcuts": [], "durableRoomFlags": {}, "defeatedEncounters": [] },
  "story": { "facts": {}, "choices": {}, "committedSceneBeats": [], "resumeScene": null },
  "npcs": { "latch": { "state": "unmet", "locationAnchor": null, "evidence": [] } },
  "inventory": { "knownLocalItems": [] },
  "checkpoint": { "hearthId": "clatter-review-hearth", "roomId": "clatter", "spawnAnchorId": "clatter-hearth-side" },
  "continuation": { "roomId": "clatter", "safeAnchorId": "clatter-hearth-side", "roomEntryFlame": 5, "resumeKind": "hearth" },
  "legProfile": { "edges": { "speed": 1.023, "power": 1.045, "instinct": 1.017, "stamina": 0.95 }, "bondBand": "familiar", "cues": { "favoriteFoodId": "crumbs", "favoriteGameId": "rush" } },
  "journal": { "discoveredEntryIds": [] }, "pendingRewards": [], "proofComplete": false, "storyComplete": false }
```

A campaign with any other `contentRevision` (including the full episode's `threshold-v1`) is preserved
untouched by this build. The next build must migrate `threshold-gate1` review campaigns explicitly.

