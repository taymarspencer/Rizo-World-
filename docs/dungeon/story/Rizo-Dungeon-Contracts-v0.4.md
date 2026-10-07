# Rizo Dungeon — implementation contracts v0.4

Companion to [Story Spine v0.4](Rizo-Dungeon-Story-Spine-v0.4.md).

## 1. Comic API — `modes/dungeon/dungeon-comic.js` + `styles/dungeon-comic.css`

```js
RizoDungeonComic.create({ mount, reducedMotion, petMarkup, lines })  // one per Dungeon instance
comic.play(sceneId, { petName }) → Promise<{ id, skipped }>   // rejects never; unknown id resolves at once
comic.tick(ms)        // advanced by the mode's scene clock (frozen under any pause hold)
comic.skip()          // tap/click/Primary/MENU-free key: resolves now
comic.playing()       // → sceneId | null
comic.destroy()
RizoDungeonComic.SCENES  // { [id]: { ms, panels } }
```

- The mode plays a comic through the scene step `S.comic(id)`: control off, simulation paused, scene clock waits for the promise.
- A comic never plays twice: the mode commits beat `comic:<id>` **before** showing it and skips it on resume.
- Reduced motion: no slams, flips, shakes or speed-line motion; panels fade in; same length.
- Layer: inside `.dungeon-screen`, above dialogue (z 7.5 → `z-index: 7`), below the pause panel (8).
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

- `boss` → `{ name: "THE BOSS", portrait: "boss" }`. Portrait expressions: `calm`, `cold`. Faceless: his mark on a dark screen with a sliver of collar and tie.
- `hood-cap` → `{ name: "CAPPED HOOD", portrait: "hood-cap" }`, expressions `neutral`.
- Existing hood portraits gain `scared`.
- Collectors never speak. Their radios carry The Boss's voice (`boss`).

## 4. Objectives

`Content.OBJECTIVES[key] = "TEXT"`; the mode shows one at each chapter/area start (`view.setObjective(text)`), keeps it on the HUD and in the pause card, and replaces it as steps complete. No objective while a thought, comic or the opening's first minute is on screen.

## 5. Collectors (core)

Enemy kind `collector` (`ENEMIES.collector`): walks `patrol` waypoints, carries a cold lamp (cone: `range`, `halfAngle`, line of sight). Rizo is **seen** when inside the cone and not hidden (inside a room `hides` rect and not Flaring; Flaring is seen from twice the range). Seen → `spot` (lamp locks, `spotMs`) → if still seen at the end, **catch**: `sim.phase = "down"` with `downReason: "caught"`. Breaking sight during `spot` → `search` → resumes patrol. Collectors cannot be hurt. Rooms may mark a collector `soft: true` (seen only stops the lamp; never catches) — Clatter's is soft.

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
