# Rizo Dungeon: depth, immersion and story

Starting commit: `ebe0ba40adb4c1f648e374bc1f1543f2752e3f2c` (`develop`).

Branch: `feat/rizo-dungeon-depth-immersion-overhaul`, targeting `develop`.

This pass adds no rooms, lines, enemies, choices or saved state. It works on
how the story we already have is staged, heard and led: the same v0.3 opening,
the same Threshold and Mending Rows, the same words in the same order. Every
change is presentation: nothing here is committed to the save, and every
committed beat, flag and choice behaves exactly as before.

## What was weak (played as a new player, opening to the Rows)

- **The van played like a hallway.** It ran under the street's music with no
  van sound, the first line came half a second after landing, and the Boss
  lines went by at the same speed as the jokes. The beat sheet's staging
  (wipers only, nobody answering, the phone freezing everyone, everyone turning
  to him, rain only) existed on paper but not on screen. Rizo did not react to
  who was talking. All four people were the same grey silhouette.
- **Below had one sound.** Every room from the Slip to the Porter's hall played
  the same track; the Shared Hearth, the first warm place, sounded like a
  corridor. Danger had no sound until something hit him.
- **His flame only felt things at a few scripted beats.** Fear, relief and
  warmth were mostly invisible between those beats.
- **Direction relied on painted floor lines.** A player who stopped had nothing
  to look toward except the HUD.
- **Arrivals were cuts.** New rooms appeared in 240 ms. Latch left the Hem
  without a look back; the Rows began talking almost the moment he arrived.

## The van, as a playable cutscene

Track A is unchanged: the same lines, the same order, the same non-blocking
movement, the cooler bump that teaches Tuck, the held push at the gap. The main
suite still pins the exact line order.

| Beat | Staging now |
| --- | --- |
| Landing | Its own sound: a low engine pulse, road rumble under the floor, wipers. He shakes the sack off; one breath before anyone talks. |
| Movement one (idiots doing a job) | “Boss said don't touch it.” is held a little longer; a beat after it. Whoever talks moves (a nod, a turn); the others idle. |
| The number | “You don't say no to him.” is held longer than a joke of its length. Then the music stops: wipers only, four seconds, nobody talks, his flame pulls in. |
| “What's he even want it for?” | Said quietly: same size, italic, greyer bubble. Nobody answers: rain only, three seconds. |
| The phone | The cabin goes the cold colour of that screen; everyone freezes; he recoils; it rings on; then silence. |
| Lost | Everyone moves again; he turns to the beanie. |
| “Both of you. It's listening.” | Rain only. All four turn and stare at him (eyes catch the light); he stares back, held, no breath; three seconds. Then the door comes loose and the road is back under everything. |

Still, he looks at whoever is talking (the talk happens *to* him). Each seated
figure keeps one mark from outside: the tall one's hood, the beanie and its pom,
the backwards cap. While the cabin is quiet no prompt competes with it.

## A few recurring sounds

| State | Where | What it is |
| --- | --- | --- |
| Home / car | car | Nothing (unchanged canon: no music). |
| Unease | headlights, search | One held low tone (unchanged). |
| Van | van | Engine pulse, road, wipers; drops out in steps. |
| Road | roadside walk | Sparse street hum (unchanged). |
| Rain shelter | drain | The road's low note and one warm note answering it. |
| Fall | fall, waking | Silence (unchanged). |
| HOME ↑ | first read of the sign | Its five-note motif (unchanged), which now **comes back**: faintly in the Below music now and then, and as the Shared Hearth's lullaby every fourth phrase. |
| Below | Threshold rooms | The Below track, with a **danger layer** under it that rises when a threat near him is aware or winding up, and falls away after. |
| Hearth | Shared Hearth | A slow, close lullaby. |
| Boss presence | the van phone, the Porter's hall | A cold ring; a tolling semitone. |
| Mending Rows | Rows | The Rows tune (unchanged), heard faintly through the open door after the Porter. |
| Nell | dry patch, the meal | Three warm notes when she makes room for him. |

Nothing here changes volume settings, the hub's music switch, or Defense/Home.

## His flame and body

- **Fear:** the light pulls in and flickers (the van's quiet, the phone, the stare;
  a threat noticing him Below). He pulls in when something sees him.
- **Relief:** when the last threat near him settles, the light swells once, he
  loosens, and breathes out.
- **Warmth:** arriving in the Rows, Nell clearing the dry patch, sitting to eat.
- **Danger:** a threat close and winding up shrinks his light a little; running
  on his last flame, it dims and wavers.
- New poses: **notice** (a small lift toward something) and **stare** (held, no
  breath). Reduced motion keeps the still versions.

## Leading without a map

- **He notices things.** The first time something that matters comes into his
  light (the jammed latch, Latch, a lever, a bowl, the hearth), he turns to it,
  it catches the light once, and there's a small sound. Once per thing.
- **The room points when he stands still.** After about eight seconds of
  standing still Below, with no threat near: air moves from the way on (a few
  specks drifting toward him from the next door, a draft sound) and he looks
  to it. If something needs him instead (the jammed latch, an unregistered
  hearth), it glints. Then it waits fifteen seconds before pointing again.
  Moving resets it. No arrows, no markers, no text.

## Transitions and pauses

- First time into a room Below: a slower reveal and his light opening up, like
  eyes adjusting. Rooms he knows stay quick cuts. Control timing is unchanged.
- Latch, freed, walks to the edge of the dark, looks back at him once, then goes
  to the hearth.
- Arriving in the Rows, he stops and looks up; his light warms before anyone
  speaks.
- After the Porter: the hall goes silent, the gift, then the door opens and the
  Rows are heard through it.

## Not touched

The v0.3 opening's beats and timings that tests pin, YOU, “Be good.”, the
kidnapping, the caller's symbol and the phone, the roadside, the drain and the
fall, `home?`, HOME ↑ by LOOK; Slip, Clatter, Hem, Latch, the Shared Hearth,
the Queue, the Porter, the First Knot; the Mending Rows, Nell, Orr; all choices
and their consequences; threshold-v3 saves, resume and reload; the hardened
mobile controls. No mystery is answered: the Boss is still only “Boss / him /
he”, and the phone is his presence. Home, Train, Go, the economy and other
modes are unchanged.

## Tests

See the PR for the run. New: `tests/browser-dungeon-depth.py` (in release CI).
