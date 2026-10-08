# Rizo Dungeon — implementation contracts v0.4

Companion to [Story Spine v0.4](Rizo-Dungeon-Story-Spine-v0.4.md).

## 1. Comic API — `modes/dungeon/dungeon-comic.js` + `styles/dungeon-comic.css`

```js
RizoDungeonComic.create({ mount, reducedMotion, petMarkup, lines, speakers, onPanel })  // one per Dungeon instance
comic.play(sceneId, { onDone }) → Promise<{ id, skipped }>   // never rejects; unknown id resolves at once; onDone fires synchronously first
comic.tick(ms)        // advanced by the mode's scene clock (frozen under any pause hold)
comic.skip()          // tap/click/Primary/MENU-free key: resolves now
comic.playing()       // → sceneId | null
comic.destroy()
RizoDungeonComic.SCENES  // { [id]: { ms, panels } }
```

- The mode plays a comic through the scene step `S.comic(id)`: control off, simulation paused, scene clock waits for the promise.
- A comic never plays twice: the mode commits beat `comic:<id>` **before** showing it and skips it on resume.
- Reduced motion: no slams, flips, shakes or speed-line motion; panels fade in; same length.
- Layer: inside `.dungeon-screen`, above dialogue and choices (`z-index: 7`, later in the DOM), below the pause panel (8).
- Input: `pointerdown` on the page (a touch on the game is cancelled at touchstart, so click never arrives), or Primary on the keys. A tap in the first 280 ms does not count.
- Sound: `onPanel` lets the mode play one of its own sounds per panel (`COMIC_HITS` in dungeon-mode.js).
- QA: `qaSceneTime` advances comics; `qaSkipScene` skips them.

## 2. Comic scene ids

| id | Trigger (mode) | Beat |
|---|---|---|
| `grab` | car: the hands close on Rizo | SNATCH. Rizo's eyes. A gloved hand leaves a black card with the mark on the empty seat. |
| `sack` | sack: third burst frees him | THRASH. RIP. He tumbles out onto the van floor. |
| `van-leap` | van: he goes through the gap | KRAK. The door swings; he leaps into rain; SPLASH. |
| `taillights` | roadside: the van stops and comes back | SKREEE. Brake red. Doors. A flashlight clicks on. |
| `fall` | drain: the second slip | His flame streaks down past pipe, cloth and a far window. |
| `boss-hands` | first exit from the Slip | MEANWHILE… hands, cufflinks with the mark, the tie, a phone. He sends the collectors down. |
| `boss-glass` | Window Hall boundary | A silhouette behind frosted glass with the mark. "Be at the window when it opens." |

## 3. Speakers

- `boss` → `{ name: "THE BOSS", portrait: "boss" }`. Portrait expressions: `calm`, `cold`. His portrait is only his caller ID: the mark on a dark phone screen. No face, no text.
- `hood-cap` → `{ name: "CAPPED HOOD", portrait: "hood-cap" }`, expressions `neutral`.
- Existing hood portraits gain `scared`.
- Collectors never speak in the game. Their radios carry The Boss's voice (`boss`). The one exception is a radio report inside the `boss-glass` comic, shown as RADIO (`LINES.comicBossGlass[0]`, speaker `collector`, no portrait).

## 4. Objectives

`Content.OBJECTIVES[key] = "TEXT"`; the mode shows one at each chapter/area start (`view.setObjective(text)`), keeps it on the HUD and in the pause card, and replaces it as steps complete. No objective while a thought, comic or the opening's first minute is on screen.

## 5. Collectors (core)

Enemy kind `collector` (`ENEMIES.collector`, `Core.spawnCollector`, `Core.collectorSees`, `Core.hiddenIn`): walks `patrol` waypoints, carries a cold lamp (cone: `range`, `halfAngle`, line of sight). Rizo is **seen** when inside the cone and not hidden (inside a room `hides` rect and not Flaring; Flaring is seen from twice the range). Seen → `spot` (lamp locks, `spotMs`) → if still seen at the end, **catch**: `sim.phase = "down"` with `downReason: "caught"`. Breaking sight during `spot` → `search` → resumes patrol. Collectors cannot be hurt. Rooms may mark a collector `soft: true` (seen only stops the lamp; never catches) — Clatter's is soft, and is spawned by the mode as a room event after the `boss-hands` comic. Live collectors: `queue-collector` (Cold Queue) and `row-collector` (Hanging Row). The Queue's Draftling and Needle are gone; the Needle cover rule is tested on the Low Run's Needle.

Caught → the same respawn as a flame-out (last hearth), banner `CAUGHT IN THE LAMP`. Nothing durable is lost.

## 6. Flags and save

**Exactly one save revision bump:** `CONTENT_REVISION` `threshold-v3` → **`threshold-v4`**; `threshold-v3` joins `CARRIED_REVISIONS` (carried forward unchanged; nothing moves).

New durable flags (allowlisted in `FLAGS`; room flags also in `ROOM_FLAGS`):

| Flag | Kind | Set when |
|---|---|---|
| `hearthKindled` | fact | Rizo first brings the Shared Hearth back |
| `queueCrossed` | fact | Rizo reaches the Porter's door unseen at least once |
| `rowsLedge` | room | the frozen receiving load is lowered (by Rizo or Nell) |
| `hangrowCrossed` | fact | Rizo gets past the Hanging Row collector |

New beats (free-form, no schema change): `comic:<id>`, `boss:phone`, `objective:<key>` are presentation and are **not** persisted unless listed above; `comic:<id>` is.

No new rooms in the live flow. The late-game kit's greybox rooms live in its own table (`modes/dungeon/kit/`), are never in `BUILT_ROOMS`, never saved, and never loaded by `index.html`.

## 7. Chapter 3, The Collection (v0.5)

Same revision (`threshold-v4`): rooms and facts only added. `Content.BUILDING_ROOMS = ["longhall", "intake", "collection", "vents", "factory"]`, theme `building` (cold tile, steel, his mark) and `vents`.

| Rule (core) | Data | Events |
|---|---|---|
| **Runner** (`kind: "runner"`, `Core.spawnRunner`) follows his crumbs a little slower than he runs; inside `catchRadius` he is caught (`downReason: "caught"`). A shut gate between them sends it round by a side door (`detourMs`). | `ENEMIES.runner` | `runner-in`, `runner-blocked`, `runner-round`, `caught` |
| **Window lamps** (`room.lampWindows`): off → tell → on, pure time (`Core.lampWindowState`). In an "on" band he is dazzled (`dazzleMs`, `dazzleFactor`). | `longhall.lampWindows` | `dazzled` |
| **Drop gate** (`room.dropGate`): starts down when he crosses `trigger`, a wall `closeMs` later (`Core.gateRect`). | `longhall.dropGate` | `gate-start`, `gate-shut {ahead}` |
| **Cage + guard** (`room.cage`, `kind: "guard"`): Primary inside the cage rattles (never Flares). Away → +1 notch; watching → −2 and he looks `noticedMs` longer. `notches` opens it (`sim.flags.cageOpen`, transient). Out of the cage, moving while he watches (after `graceMs`) and not hidden → `downReason: "put-back"`. | `ENEMIES.guard` | `loosened`, `noticed`, `cage-open`, `guard-away/tell/back`, `seen` |
| **Belts** (`room.belts`): carry whoever stands on them (`player.carried`; riding is not `moving`). `Core.beltItems` places crates (cover) and jar trays (no cover). | `factory.belts` | — |
| **Watchers**: collectors with `look`, `sweep`, `sweepMs`, `range` keep their lamp on the floor below their walkway and never step off it. | `factory.encounters` | as collectors |
| **Listening grates** (`room.listens`, `room.listen`): one lit at a time, walking from `listens[0]`; moving on a lit grate fills `sim.heard`; at `hearMs` → `downReason: "heard"`. | `vents` | `heard`, `caught` |
| **Lure** (`Core.lure(sim, x, y)`): collectors not already on him walk over to a sound and look at it `lureStayMs`. | `hangrow` `row-bell` (`kind: "bell"`, `lure`) | `lured`, `resume` |

Mode: a catch in a building room restarts that trial in place (`buildingRetry`): hall door, the crate (two notches kept), the start of the listening duct, the vent landing. Never back to the Rows. Comics `window-opens` and `chute` (committed once). Chapter card at the loading door (`esc:boundary`), continuation `factory/fac-door`. New beats: `hall:started`, `intake:arrived`, `coll:in`, `coll:promise`, `esc:pa`, `esc:boundary`. New facts/room flags: `windowOpen`, `hallEscaped`, `intakeOut`, `jarMoth…jarOld`, `ventGrate`, `ventsOut`, `factoryOut`, `promised`.

Save bounds widened (a whole journey no longer fits the old ones): visited rooms 48, beats 128, journal 96, flags 64 per map. Shelf label `ESCAPE n/5`. A journey past the Porter resumes in place in the Rows **or** the building.

View: a `.dungeon-front` canvas above the DOM Rizo draws what stands in front of him (cage bars, the crate he is pressed behind). `Scenery.bodies()` lets belt goods sort by depth with everyone else.

Presentation (director's polish; no rule changed): every danger is shown before it lands, as light. The intake guard's phone is a torch on Rizo while he `watch`es, a screen on his own face while `away`, and it stutters on during the tell. A hall window's light creeps across exactly its band during `tell`. The runner's real reach (`catchRadius` + Rizo's radius) is a ring at its feet. The next listening grate glows `LISTEN_WARN_MS` before it lights. The factory machines strike in turn on `factory.machineBeat` (data; sound and light only). The six reachable jars each have a soul (`JAR_SOULS` in art: colour and motion from their tags), watch Rizo, and press to the glass at the promise. QA: `dungeonLightForQA(x, y, r)` reads the drawn frame's brightness, so tests assert what is shown.
