# Rizo Dungeon: game feel, clarity and testability

Starting commit: `ae890d534ef6f197cea5c0684c6e7f7b97cd9c1e` (`develop`).

Branch: `feat/dungeon-gamefeel-testability-pass`, targeting `develop`.

This is not a redesign. No room, line, enemy, choice, fact or saved field is
added or reworded, and the order of every scene is unchanged. It fixes a
player-facing iPhone bug, adds a way to replay the Dungeon from the beginning
without touching the rest of the save, and smooths three moments found by
playing it through.

## 1. The “Create Link” bar over the hearts (iPhone)

**What the player saw.** Hammering or holding the D-pad could bring up iOS's
text edit bar (Copy / Look Up / the link item) floating over the flames at the
top of the screen.

**Root cause.** The game never cancelled a touch. The controls listen to
pointer events only, and `preventDefault()` on `pointerdown` does not cancel
iOS's own touch gestures. Only `touchstart` does. On every uncancelled touch,
Safari runs its long-press and multi-tap text-interaction recognisers: text
selection, the loupe, the edit menu. A held D-pad direction is a long press,
and hammering it is a multi-tap. The page relied only on CSS hints
(`user-select:none`, `-webkit-touch-callout:none`), which iOS has applied
unevenly (callout bugs on iOS 15 and 26.1), and the root `<html>` element was
left selectable.

Two safety nets were also open:

- **The `selectstart` guard never fired.** It called `event.target.closest()`,
  but `selectstart` is fired at the Text node, which has no `closest()`. Shown
  in Chromium: the target is `nodeType 3`, so the guard returned false.
- **A selection that got through was never cleared.** The stage also paints
  `::selection` transparent, so the player saw no highlight. All they saw was
  the edit bar, anchored to the first text at the top of the screen: the HUD
  row with the flames and the room name.

Probe on `develop` (390×844, real CDP touch): 53 of 53 touches on the pad,
keys and screen were left uncancelled.

**Fix (game surfaces only).**

- `dungeon-input.js` binds a non-passive `touchstart` on the device. It
  cancels every touch on the pad, keys, screen, HUD and dialogue box. The
  pointer handlers still run (taps, holds, slides and the dialogue tap as
  NEXT all work as before). Panel and choice buttons, and any link or field,
  keep their native touch because they answer to `click`.
- The page lock now:
  - resolves `selectstart` from the Text node's parent element;
  - clears any non-collapsed selection the moment it appears (with it goes
    its edit menu);
  - keeps `contextmenu` shut page-wide while the Dungeon is open;
  - marks `<html>` itself unselectable with no callout;
  - stops images (the Rizo, portraits) from being lifted by a held finger.
- A text field would keep its own selection. All of it is removed on stop,
  and the Hub is untouched after GO HOME.

After the fix: every touch on game surfaces is cancelled at all five phone
sizes; a forced selection is gone within 100 ms; RESUME and SIT/GO still work
by finger.

## 2. RESTART DUNGEON

MENU now has **RESTART DUNGEON**, set apart under RESUME and GO HOME. The
panel of a journey that reached home has it too. It is disabled while the tab
cannot save or a break is running, the same as RESUME.

It asks first: “START OVER FROM THE CAR?”. **KEEP MY JOURNEY** is the focused
answer, and MENU also backs out. Confirmed, it fades straight into the parked
car and the v0.3 opening plays from the start: “Be good.”, the kidnapping, the
van, the roadside, the drain, Below, and on.

**Reset** (the Dungeon slice only, as a new campaign for the same Rizo):

- `campaign`: new id; `status` back to active
- `world`: visited rooms, opened shortcuts, room flags, defeated encounters
- `story`: facts, choices, committed beats, resume scene
- `npcs`: Latch back to unmet
- `inventory` (known local items)
- `checkpoint`: no hearth
- `continuation`: the car seat, opening
- `journal`: HOME ↑ is found again, and its motif plays fresh
- `legProfile`: recomputed from the Rizo
- `proofComplete`, `storyComplete`

**Kept in the slice**:

- the player's Dungeon settings (gentler timing, text speed);
- any reward the hub has not yet confirmed (`pendingRewards`, retried under
  its own receipt).

**Not touched**: the pet, Home, Training, Defense, Embers/wallet, wardrobe
(the First Knot stays), story marks, `modeReceipts` (the old receipt stays).
The new campaign id means the new run can earn its own receipt; the hub's
grants are idempotent, so nothing doubles. Other modes, preferences and the
rest of the save are also untouched.

**Order.** The fresh slice is committed through `host.commit()` before
anything in memory changes. If the save is blocked or fails, nothing restarts,
and the panel says “COULDN'T RESTART … Your journey is unchanged.” A slice
saved by another build is never restarted.

Then the instance drops the old night: scene, line, choice, the sim with its
cleared and defeated enemies, notices, banners, and player-releasable holds.
Reload resumes in the car on the new journey. Restart is the pure function
`Core.restartSlice()` and is Node-tested.

**Measured**: the whole hub save is compared before and after. The only
differences are the two time-bookkeeping stamps every save writes
(`pet.lastTick`, `player.lastActive`).

**Short screens.** The extra row first pushed the pause card past the
screen's edge at 320×568 and 844×390. Menu cards (pause, restart) now tighten
when the screen is short; when it is also wide, the two answers sit side by
side. Both cards fit at every listed phone size. The very smallest landscape
(568×320) and 667×375 keep the existing drag-to-scroll card, as the chapter's
boundary card already does. Action buttons stay at least 44 px tall.

## 3. Playing it through

The opening, Below and the Mending Rows were played on a 390×844 phone with
real keys and touch. Long authored waits were jumped on the scene clock;
everything else ran in real time. A frame recorder logged every prompt, line,
bubble, banner, cue, choice and panel, and any overlap between them. Most of
it already plays well:

- The van's staging holds: the talk order, the hush, the phone, the stare,
  the door. No prompt appears during the quiet.
- The roadside search and its banter, the phone, the bowl.
- The first Draftling's telegraph and the brief FLARE/TUCK key cue.
- Latch's rescue, the hearth, the cold bowl, the lever, the Porter's help.
- Rows bubbles sit over the speaker; the HUD never collided.

Fixed (presentation only):

| What felt wrong | Now |
| --- | --- |
| **A choice with no question.** SIT / GO at the hearth appeared after Latch's offer had closed. The wrap's WEAR IT / FOLDED / LEAVE IT appeared after Nell's question had gone. | The line that asked stays above its answers, with the speaker's name: “Seat's dry.” (Latch); “Wear it, or take it folded.” (Nell). The button group is labelled with it for screen readers. The meal's SIT / GO is asked by the food itself, so no line is borrowed for it. |
| **A banner spent under a line.** Stepping into the Shared Hearth registers it (“THE HEARTH KNOWS YOU NOW”) in the same frame Latch says “Seat's dry.”. The banner ran out while the player was reading. | A banner raised while a line or choice is open waits for it to close, then gets its full time. Here it lands on the walk to the seat. The checkpoint itself still commits at once. Story beats that show a banner inside a scene (the FIRST KNOT) are unchanged. |
| **SIT glided across the room.** From the doorway the Rizo slid about 100 units to the bench in 0.7 s, roughly twice his walking speed, without walking. | He walks there at about his own pace (never faster than before for a short distance), facing where he goes, with the walking pose and footsteps, then turns to the seat. The same applies at the Rows meal. |

Looked at and left alone, with reasons:

- **The “device fell behind” pause.** It appeared once, but only because a
  screenshot stalled the renderer mid-fight. With the CPU throttled 4× and 6×
  and no screenshots, no frame exceeded 150 ms and the pause never fired. The
  guard stays.
- **A movement stall on the roadside.** Not reproducible on the identical
  sequence; it was the harness.
- **Prompt flicker.** Prompt changes were walking past props, not oscillation
  at the edge of reach, so no hysteresis was added.
- **The pulled lever offering LOOK at once.** Its line confirms the shortcut;
  a double tap only repeats it.
- **YOU's lines (5 s) and Latch's offer at the hearth door.** Both are canon
  timings and staging.

## The build marker (develop was red)

`develop` at the starting commit failed its own release workflow in the Node
step, so no browser suite ran for it. The Nell/Orr integration merge moved
the service worker cache and the build script to `v95-dungeon-depth`, but the
page meta, the boot shell, the runtime and the World-first suite still said
`v94-alive`. That failed `release-integrity` and `service-worker-policy`.

This branch finishes that same bump in the three places it missed. It uses
the integration's own name; no new release name is invented. The page and
runtime always agreed, so players never saw the mixed-build recovery screen.
Dungeon files are network-first in the worker either way, so a phone online
fetches this pass without the bump.

## Tests

New: `tests/browser-dungeon-gamefeel.py`, added to release CI. It covers:

- the touch and selection guard at 320×568, 375×812, 390×844, 430×932 and
  844×390;
- every restart path;
- the three feel fixes at 390×844, 320×568 and 844×390.

`tests/dungeon-core.test.js` gains four `restartSlice` checks.
`tests/dungeon-input.test.js` gains one check of the `touchstart` rule.

Local mirror of the release workflow:

- `git diff --check`, the syntax of every shipped script, and the site build.
- **13 Node suites, 242 checks**, all passing. `release-integrity` and
  `service-worker-policy` failed on `develop` and pass here.
- **17 browser suites, 1,395 checks**, all passing:

| Suite | Checks |
| --- | --- |
| Home/Train/Go | 110 |
| Home alive | 57 |
| Dungeon | 371 |
| Dungeon controls | 185 |
| Dungeon cohesion | 67 |
| Dungeon depth | 44 |
| **Dungeon game feel** | **63** |
| Save safety | 37 |
| Defense integration | 78 |
| Mode contract | 25 |
| Training contract | 22 |
| Launch recovery | 5 |
| Training fixes | 13 |
| Authored arcade | 25 |
| Arcade freeze | 66 |
| Public product | 150 |
| World-first | 77 |

One Defense integration check ("split children release gradually") failed
once in the full run and passed 78/78 on two isolated re-runs. It measures
Defense's child scheduler while the page's own animation loop keeps running,
and this branch does not touch Defense.

Dungeon controls first flagged the new RESTART DUNGEON button at 40 px against
its 44 px rule for every pause-panel button. The button was raised to 44 px,
and the suite then passed 185/185.

Main Dungeon suite coverage still pins the van's exact line order, every
opening beat and timing, saves, reloads and the Rows.

Phones covered: 320×568, 375×812, 390×844, 430×932 and 844×390 (touch guard
and card fit), plus 320×568 and 844×390 for the choice caption. Card heights
were also measured at 375×667, 667×375 and 568×320.

## Not covered

- **Physical iPhone.** Chromium cannot run Safari's gesture recognisers. What
  is verified is that every touch the OS could act on is cancelled by the
  page, plus the CSS and selection-clearing fallbacks. A tap and hold on a
  real iPhone remains the final confirmation.
- **The Mending Rows still don't point the way when he stops.** The depth
  pass deferred this (Nell leads there), and it stays deferred.
