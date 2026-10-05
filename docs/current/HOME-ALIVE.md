# Rizo World: Home, Alive

Starting remote `develop`: `1ac791db12c81903a38824e55c579cebdc3e9b04`.
Branch: `feat/rizo-world-claude-alive-pass`. Runtime: `v94-alive`. Hub state: v23 (unchanged).

This pass keeps Sol's Home / Train / Go structure, Embers, tier prices, and saves exactly as they
were. It changes what the player sees and feels: the Den is a place that changes as you build it,
Rizo answers touch and play physically, and leaving and coming home are moments.
No save schema, economy, Dungeon internals, or Defense mechanics changed.

## Where it lives

| Concern | File |
| --- | --- |
| Den architecture per tier, light, bed, keepsakes, toy floor plan, build ceremony, Training yard, result patch, Go doors, doorway | `home-alive.css` (loads after `home-world.css`) |
| Tier/light/bed/blanket/keepsake markup; care panel order; play prompt under the room | `index.html` |
| Tap zones, toy anticipation and answers, walking lean, bed lines, build ceremony, arrival, doorway, plans preview, result patch, drill colours | `game-v79-defense.js` |
| Regression coverage for all of the above | `tests/browser-home-alive.py` (in release CI) |

## The room

Stacking inside `#habitatScene`, back to front: wall material (1) · window, shelf, roofline (2–4) ·
furniture (3–4) · keepsakes (6) · light (7) · Rizo (8) · bed front and blanket (9) · toys (10) ·
labels (12) · speech (16). The light layer's wrapper has no `z-index`: a stacking context there would
isolate the multiply/screen blend from the room it lights. Light never sits on Rizo.

Overlays shade the player's purchased room theme rather than replacing it (the old `space` theme's
stars still show through every tier).

| Tier | Identity |
| --- | --- |
| Rain Shelter | Blue tarp roof with grommets, corrugated sheet wall with a taped patch, crate with a jar candle (the one warm light), a leak dripping into a tin. Cool and dim. Cardboard-box bed with a towel. |
| Warm Den | Ceiling beam, wood wainscot, curtains, a framed drawing of the two of them, the lamp left on, rug, a proper bed with a headboard and quilt. Warm everywhere, soft corners. |
| Open Room | The archway opens into a lit second room (the lamp is in there now), pendant light over Rizo's spot, books, daylight shafts, an orderly wall: arch, shelf, window. |
| Rooftop Home | Outside: night sky with stars and a moon, skyline with lit windows, parapet with a potted plant, string lights, telescope at the edge, the door inside left open and glowing. Deck floor, cushion bed. |

## Floor plan (matches where Rizo actually goes)

`ball → x32` (test-locked) · `bush → x27,y7` (back) · `puddle → x30,y-1` · `stump → x75,y-4` (front) ·
`bed → x72,y0` (test-locked). Previously the bush sent Rizo to the opposite side of the room and the
bed was smaller than he is and drawn over him.

## Rizo

- **Touch:** a first touch after 15 s is *noticed* (a hop, sometimes "OH. HI."); then the head gets a
  pat squash, the belly a giggle, the sides a lean away; a quick run of taps stays a snappy boing;
  low energy gets a sleepy sway. The sprite's own box decides the zone, not the 292 px hit area.
- **Toys:** he looks at the toy, crouches (anticipation), then walks while leaning into the
  direction of travel; the toy answers when he gets there (ball kicked and rolls back, stump shakes,
  bush rustles leaves, puddle splashes). Position is saved immediately; only the body waits 180 ms.
- **Bed:** he sleeps tucked behind the bed front and blanket; tapping the bed wakes him (his large
  invisible hit box used to cover it). Shelter nights: "THE TIN WILL CATCH IT. NIGHT."
- **Coming home:** a return from a drill, Defense or Dungeon plays a short arrival (a hop in, a
  source-specific line, the matching keepsake glows, the return note animates). Never on reload.

## Ceremonies

- **Build:** lights down, a "WE BUILT …" stamp, the new room drops in, lights up, then Rizo's line.
  `renderHome()` used to overwrite the scene's class list on every redraw, which cancelled the old
  `home-built` animation almost immediately; transient classes are now re-applied after redraws.
  The purchase is committed before any of this runs.
- **Plans:** the sheet shows the room now and next, a list of what changes, the Embers still needed,
  and the build button next to the preview.
- **Doorway:** going to Dungeon or Defense shows "RIZO IS HEADING OUT" over the first frames while the
  mode is already launching underneath (launch timing unchanged). Returning shows a brief "HOME".

## Keepsakes

Training is a stitched patch board (one patch per drill tried, in that drill's colour; the same
colour marks the drill on Training's drill board and on the result). Defense is a pennant with the
best wave. Latch's First Knot hangs on a nail. The Shared Hearth is a small kept lantern. Keeper
trophies on the shelf are little jars of kept sparks. All are read from existing records.

## Deliberately left

- Landscape phones: the room keeps its fixed height and the page scrolls; the fixed nav covers the
  floor until you scroll (unchanged from before this pass).
- Orbit stays a visible, unpurchasable horizon.
- The ten drills, Rizo Runaway's scope, Dungeon story/art, and Defense mechanics are untouched.
- Physical iOS/Android and installed-PWA feel are device-review work; automated results are Chromium.
