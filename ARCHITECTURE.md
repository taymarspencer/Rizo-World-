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

> **Status (Phase 1):** both contracts exist and are tested. Phase 2 moves Rizo Defense onto the game-mode
> contract. Phase 3 moves the ten minigames onto the training contract. Until then they still run through the
> legacy arcade runtime inside `game-v79-defense.js`.

---

## 1. Files and load order

Order matters. Each file may use only the files above it.

| # | File | Kind | Owns |
|---|---|---|---|
| 1 | `rizo-config.js`, `install-manager.js`, `monetization.js` | browser | Owner config, PWA install, dormant ads. |
| 2 | `core/rizo-save-core.js` | **pure** (browser + Node) | Hub limits, the signed save envelope (v1 frozen, v2 current), mode-slice shape. |
| 3 | `core/rizo-training.js` | **pure** | The training contract: game definitions and score → stat conversion. |
| 4 | `core/rizo-modes.js` | pure rules + browser host | The game-mode contract: registry, slice migration, award limits, host API. |
| 5 | `modes/<id>/…` *(Phase 2)* | browser | One game mode each. Registers with `RizoModes.register`. |
| 6 | `training/<id>.js` *(Phase 3)* | browser | One training game each. Registers with `RizoTraining.register`. |
| 7 | `defense-core-v79.js`, `defense-canvas-v79.js` | pure / browser | Rizo Defense rules and canvas presenter. They move under `modes/defense/` in Phase 2. |
| 8 | `game-v79-defense.js` | browser | **The hub**: save I/O, pet simulation, care, House, UI, the legacy arcade runtime, `petMarkup()`, and the host adapter both contracts talk to. |

"Pure" files have no DOM access and are `require()`-able, so their rules are unit-tested in Node.

## 2. Hard rules and what enforces them

| Rule | How it holds |
|---|---|
| One renderer, `petMarkup()`, for every pet surface | Modes get `host.petMarkup(snapshot)`; training games get `run.petMarkup()`. Neither ships its own Rizo art path. Known exceptions are listed in `AUDIT.md` M1. |
| No frameworks, no build step | Plain `<script>` files. Pure modules use a small UMD wrapper so Node tests can `require()` them. |
| Timestamp-based timers only | Run clocks, buffs and deadlines are absolute timestamps credited across pauses. The training runner (Phase 3) schedules with deadlines polled in the frame loop, not `setTimeout`. |
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
| `rizo-life-overhaul-v2:defense-checkpoint-v68` | Defense's in-progress run (moves to `rizo-mode-run:defense` in Phase 2). | Defense |

### Envelope v2

```json
{
  "app": "RIZO LIFE", "saveVersion": 2, "stateVersion": 19, "savedAt": 1790000000000,
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
- A save written by a **newer** build (`saveVersion` above this build's) is never loaded or rewritten. The tab
  shows "THIS SAVE BELONGS TO A NEWER RIZO.GAME" and offers an update.

### Writing

- Every write checks the stored `writeId`. If another tab or the installed app saved since this tab last loaded
  or saved, this tab stops saving and shows "RIZO IS OPEN SOMEWHERE ELSE" with a reload button. The `storage`
  event triggers the same thing immediately.
- A failed write (storage full or blocked) toasts once instead of failing silently.
- Reset blocks every later write (including the unload save) before deleting keys.

### Changing the schema

| Change | Do this |
|---|---|
| Add or rename a hub state field | Bump `VERSION` (state version), normalise it defensively in `normalizeState()`, add an old-save case to `tests/save-safety.py`. No signature change is needed. |
| Change the envelope layout | Add `saveVersion: 3` in `core/rizo-save-core.js`. Keep the v2 verifier and the v1 block exactly as they are. |
| Change a mode's data | Bump the mode's `schema` and extend its `migrate()`. The hub never inspects slice contents. |
| **Never** | Edit the frozen `SAVE VERSION 1` block in `core/rizo-save-core.js`, write to a v1 key, or delete a save key outside an explicit player reset. |

---

## 4. Training-game contract

A training game is a short run that turns into pet growth. It **only produces a result**: it never writes the
save, the wallet or the pet.

### Definition (`RizoTraining.register(def)`, validated at load)

| Field | Type | Meaning |
|---|---|---|
| `id` | lowercase word | Stable id. It is the key for best scores and care history. |
| `name`, `kicker`, `hint`, `art` | strings | Cabinet and run-header copy. |
| `duration` | 10–120 s | Run length. The hub runs the clock. |
| `energy` | 1–40 | Energy a credited run costs. It also sets the reward budget. |
| `lives` | integer ≥ 0 | Hearts, if the game uses them. |
| `par` | number > 0 | **The score of a solid, competent run.** All reward scaling hangs on this. |
| `trains` | `{skill: weight}` | Which of `speed · power · instinct · stamina · luck` the game builds. Normalised to sum to 1. |
| `care` | `{bond, mood, hunger}` | `bond`/`mood` weights 0–1. `hunger` is the change for a par run: negative for exertion, positive for food games. |
| `alignment` | −3…3 | Nudge toward kind (+) or wild (−) per credited run. |
| `start(pet, run)` | function | Begin the run. `pet` is a frozen snapshot. |
| `frame(dt)`, `input(event)` | optional | Per-frame update and player input. |
| `stop()` | function | Remove everything the run created. |

### Lifecycle

```
hub: energy check → snapshot pet → clear arena → game.start(pet, run)
game: …play… → run.end({ score, reason, qualified, stats, inputs })
hub: game.stop() → convert(def, result) → apply gains through pet rules → results screen
```

`run` (provided by the hub runner, Phase 3):

| Member | Purpose |
|---|---|
| `run.arena` | The element the game draws into. Emptied before and after. |
| `run.pet`, `run.petMarkup(options)` | The snapshot, and the one pet renderer for it. |
| `run.now()` | Run clock in ms. It stops while the run is paused or the app is backgrounded. |
| `run.after(ms, fn)`, `run.every(ms, fn)` | Deadline-based scheduling, polled each frame and credited across pauses. |
| `run.lives` | `{ max, left, lose() }` when `lives > 0`. |
| `run.score(points)` | Add to the live score shown in the header. |
| `run.sfx(name)`, `run.haptic(pattern)` | Hub audio and haptics, respecting the player's settings. |
| `run.end(result)` | Finish. `reason` is `timeup`, `death`, `cleared` or `quit`. |

### Score → stat conversion (`RizoTraining.convert`)

```
qualified    = score > 0 and the player made at least one input, unless the game says otherwise
performance  = min(score / par, 1.5)          0 when not qualified
skill points = performance × energy × 0.5     split by `trains` weights, capped by the pet's genes
XP           = performance × energy × 3.5
Embers       = max(4, round(performance × energy × 5))
Bond         = performance × care.bond × 4
Mood         = performance × care.mood × 10
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
| `create(host)` | Returns the instance: `{ start(options), suspend(reason), resume(reason), stop() }`. |

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
| `host.audio` | `sfx(name)`, `haptic(pattern)`, `music(scene)`. |
| `host.ui` | `toast(text)`, `modal(markup)`, `closeModal()`. |
| `host.mount()` | Shows the shared stage and returns its element. |
| `host.exit(summary)` | Stops the mode and returns to the hub. Idempotent. |

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
| `tests/core-contracts.test.js` | `node` | Save core (v1 frozen signature, v2), training conversion, mode rules. |
| `tests/release-integrity.test.js` | `node` | Build marker and service-worker shell. |
| `tests/save-safety.py` | `python3` | Old-save migration and every save-loss path from the audit, in a real browser. |
| `tests/mode-contract.py` | `python3` | A probe mode through the real hub: snapshots, slices, awards, exit, reload. |
| `tests/defense-core.test.js`, `worker-*.test.js`, `service-worker-policy.test.js` | `node` | Defense rules and the service worker. |
| `tests/browser-*.py`, `static-defense-audit.py`, `worker-j-integration-risk-audit.py` | `python3` | Inherited browser and static suites. |

The browser suites need Playwright for Python and Chromium at `/usr/bin/chromium`. Some write JSON into the
tracked `reports/` folder; restore it with `git checkout -- reports/` before committing.
