# Rizo Dungeon — opening beat sheet v0.3

**Version:** 0.3 · 4 October 2026
**Governs:** the opening, from the parked car to Rizo finding HOME ↑ below. Narrative authority: [narrative package v0.3](Rizo-Dungeon-Narrative-Package-v0.3.md).
**Head inspected:** `develop` at `bd578980a2cf80ac00f4118998096e61e12ab048`.
**Status: APPROVED by the owner on 4 October 2026. A timing contract, not code. Nothing is implemented.**

## How to use this sheet

Every number is a target to be checked with a stopwatch before any code is written, then again in a greybox build.

**Columns**
- **Starts when** — the trigger. `+n s` means seconds after the previous beat ends.
- **Seconds** — `min / target / max`. A single number is a fixed duration.
- **Control** — `Full` (move, Flare, Tuck, LOOK), `Limited` (named verbs only), `None` (control removed).
- **Track** — `A` can be done inside RC2's existing rooms (package step 3). `B` needs new rooms, actors or art (package step 5).

**Conventions**
- `[BUILT]` marks RC2 lines, poses, timings or props that already exist. Their wording does not change.
- Overheard talk (van, roadside) plays as **barks**: the existing non-blocking speech bubbles. Duration per bark: 0.8 s + 0.3 s per word, minimum 1.6 s. Rizo keeps his control while they play.
- Lines spoken **to** Rizo by YOU use the existing blocking dialogue box, advanced by the player, auto-advancing after 5 s.
- `<name>` is `campaign.petName`; fallback "Rizo".
- `CALLER_SYMBOL` is the unexplained caller glyph. The owner chooses it.
- Every beat has a sound-off reading. If a beat only works with sound on, it is not finished.

## Totals

| # | Scene | Min | Target | Max | Control removed | Leaves the player feeling |
|---|---|---:|---:|---:|---:|---|
| 1 | Parked | 24 | 39 | 79 | 4 | Warm, ordinary |
| 2 | Be good | 15 | 18 | 22 | 9 | Trusting |
| 3 | Waiting | 60 | 75 | 120 | 0 | Calm, then small |
| 4 | Headlights | 24 | 28 | 40 | 0 | Something is wrong |
| 5 | Taken | 8 | 10 | 12 | 4 | Helpless |
| 6 | The sack | 9 | 12 | 17 | 5 | Blind, trapped |
| 7 | The van | 83 | 88 | 95 | 0 | Laughing, then afraid of someone absent |
| 8 | The gap | 5 | 10 | 21 | 1.3 | Terrified, committed |
| 9 | Taillights | 35 | 45 | 65 | 4.7 | Hunted, then alone |
| 10 | The ringing | 0 | 15 | 45 | 0 | Uneasy curiosity |
| 11 | The walk | 80 | 120 | 160 | 0 | Alone |
| 12 | The drain | 30 | 50 | 90 | 0 | Relief, then pulled into dark |
| 13 | The fall | 10 | 14 | 20 | 6 | Total loss of control |
| 14 | Awakening | 45 | 70 | 120 | 3 | Very far from home |
| | **Opening total** | **7 min 8 s** | **9 min 54 s** | **15 min 6 s** | **≈ 37 s** | |

RC2's opening takes about 2–4 minutes. Control is removed for about 37 seconds of the new opening in total, in short bursts. Everything else is time the player is playing, even when nothing is happening.

---

## Scene 1 · Parked — Track B

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 1.1 | Mode starts | 4 | None | Fade from black. Rain on the windshield; engine ticking as it cools; store's lit window across the lot. YOU in the driver's seat; Rizo on the passenger seat, settled. **No music.** |
| 1.2 | 1.1 ends | 20 / 35 / 75 | Full | Rizo can cross the seats, hop to the dash, press to the side window, approach YOU. YOU reacts once to each, never repeating: approach → "Hi. Yes. Hi." · dash → "Off the dash, please." · Flare → "Okay, show-off." (spark lights the car ceiling) · window → "It's just rain." **Ends** when ≥20 s have passed and Rizo has moved and triggered at least one reaction. If idle 45 s, YOU says "It's just rain." unprompted. Hard cap 75 s. |

Sound-off reading: Rizo bounces between YOU and the windows; YOU's hand moves toward him.

## Scene 2 · Be good — Track B (split line also Track A)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 2.1 | 1.2 ends | 1 | None | YOU takes the keys. |
| 2.2 | +0 | player | None | **YOU:** "Alright `<name>`, I'm gonna go in the store real quick." `[BUILT wording]` |
| 2.3 | line closed | 2 | None | YOU clicks the dome light on; the cabin warms. **YOU:** "There. Light's on." |
| 2.4 | line closed | 2.5 | None | Door opens; rain gets loud. YOU looks back. **YOU:** "Be good." `[BUILT]` Hold 1.5 s after the line closes. |
| 2.5 | +0 | 5 | None | **THUNK.** Rain goes muffled. Camera holds on Rizo through the glass as YOU crosses the lot. Rizo follows with his whole body, nose to the glass. Store door chimes. Control returns 1 s after the chime. |

## Scene 3 · Waiting — Track B (incentive fix also Track A)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 3.1 | 2.5 ends | runs to 3.4 | Full | YOU visible through the store window, drifting between aisles on a loop: visible about 70% of the time, behind a shelf the rest. If Rizo is at the glass when YOU disappears: press-to-glass pose; when YOU reappears: relax. LOOK at the store window: "Inside, between the chips and the cold drinks: YOU." |
| 3.2 | 35 s after THUNK | 3 | Full | **Dome light times out**, fading over 3 s. Rizo's light becomes the only light inside. If he is away from the window: pull-in pose 1.5 s. No line, no cue. |
| 3.3 | throughout | — | Full | Windshield fogs where he breathes near glass; rain trails; ice-machine hum; one shopping cart rattles past at about 50 s. |
| 3.4 | see rule | 60 / 75 / 120 total | Full | **Exit rule:** (≥60 s since THUNK **and** `seenYou`) **or** ≥120 s. `seenYou` = Rizo in the window zone while YOU is visible for ≥1.5 s, or a LOOK at the store window. **Looking never shortens this scene.** |

Track A interim, on RC2's curb until the car exists: the van comes at ≥45 s **and** after at least one LOOK, or at 90 s. Never sooner because of looking.

## Scene 4 · Headlights — Track B

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 4.1 | 3.4 | 4 | Full | A low engine and muffled bass, audio only. **At +1.5 s Rizo reacts first:** flame contracts, head turns to the rear window. |
| 4.2 | 4.1 ends | 3 | Full | Headlights sweep the interior slowly, left to right. Music begins: **one held low tone**, no melody. |
| 4.3 | 4.2 ends | 5 | Full | Van parks behind; lights off. **Nothing happens.** |
| 4.4 | 4.3 ends | 3.5 | Full | Two door thuds. **DRIVER** (bark, muffled): "Two minutes." Shapes in the rain; one turns toward the store window and holds 1.5 s. |
| 4.5 | 4.4 ends | 3 | Full | **SMALL HOOD:** "That him?" — 1.4 s `[BUILT gap]` — **TALL HOOD:** "Obviously." `[BUILT]` |
| 4.6 | 4.5 ends | 6 | Full | A masked face cups its hands on Rizo's window. **SMALL HOOD:** "Bro. It's glowing." **TALL HOOD:** "Don't tap the glass." Tap; Rizo recoils `[BUILT pose]`. |

Throughout: Rizo may hide in the footwell (darkest place in the car) or press toward the store window. Neither changes what happens. Nothing is recorded.

## Scene 5 · Taken — Track B

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 5.1 | 4.6 ends | 1.5 | Full | Door forced: crack, cold air, loud rain. |
| 5.2 | 5.1 ends | up to 6 | Full | Hands reach in. First Flare: hoods flinch; **SMALL HOOD:** "Yo—" `[BUILT]`. Later Flare: "It's hot! It's *hot!*" Grab on contact or at 6 s. |
| 5.3 | grab | 2.5 | None | Through the windshield: YOU in the lit store, back turned, at the counter. YOU does not know. |
| 5.4 | 5.3 ends | 1.5 | None | **TALL HOOD:** "Bag. *Bag.*" Pillowcase over Rizo. Black. |

## Scene 6 · The sack — Track B

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 6.1 | 5.4 ends | 4 | None | Black except Rizo's own glow through fabric, trembling. Muffled: sliding door, engine. |
| 6.2 | 6.1 ends | 4 / 7 / 12 | Limited: Flare, move | Each Flare or move burst shakes the cloth. Three bursts free him; auto-free at 12 s. |
| 6.3 | freed | 1 | None | He tumbles onto the van floor. Room switches to the existing van `[BUILT]`. |

## Scene 7 · The van — Track A (dialogue in RC2's van room)

All lines are barks. Rizo keeps limited control: move within the van, LOOK, Tuck.

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 7.1 | 6.3 | 5 | Limited | Rumble; recoil `[BUILT]`. **DRIVER:** "I thought you said he didn't do that fire shit." **TALL HOOD:** "I said probably." `[BUILT]` |
| 7.2 | +1 s | 18 | Limited | **SMALL:** "Boss said don't touch it." **TALL:** "I'm not touching it." **SMALL:** "Then why you keep looking at it?" **TALL:** "'Cause it's looking at me." → Rizo stares, one slow blink (1.5 s, no bark). **SMALL** (filming, phone light on Rizo): "Say hi." **TALL:** "Put that away." **SMALL:** "It's for me. It's not for nobody." |
| 7.3 | +1 s | 6 / 9 / 15 | Limited | **DRIVER:** "My bad. Pothole." `[BUILT]` Cooler slides; Tuck key pulses `[BUILT]`. Second bump only if the first was not dodged `[BUILT]`. |
| 7.4 | cooler resolved | 6 | Limited | **SMALL:** "Why do we even got a cooler." **DRIVER:** "In case." **SMALL:** "In case of what?" **DRIVER:** "…In case." |
| 7.5 | +1 s | 17 | Limited | **SMALL:** "How much we getting for it?" **TALL:** "Enough." **SMALL:** "That's not a number." **DRIVER:** "It ain't about the number. You don't say no to him." **SMALL:** "I'd say no." **DRIVER:** "Nah. You wouldn't." → wipers only, 4 s → **SMALL** (quieter): "What's he even want it for?" → nobody answers, 3 s. |
| 7.6 | 7.5 ends | 15 | Limited | A phone buzzes; **cold light fills the van**; everyone freezes. Screen faces the cabin, not the player. **SMALL:** "…It's him." **DRIVER:** "Don't." **SMALL:** "If I don't pick up—" **TALL:** "Then don't pick up." Rings 4 s more; goes dark. Silence 3 s. |
| 7.7 | 7.6 ends | 11 | Limited | **SMALL:** "You know what happened to the last dude who lost one." **TALL:** "Shut up." **SMALL:** "I'm just saying." **TALL:** "I said shut the f—" **CAPPED HOOD** (first and only words; points at Rizo): "Both of you. It's listening." Everyone turns to Rizo. Rizo looks back. Hold 3 s, rain only. |
| 7.8 | 7.7 ends | 2 | Limited | Back door rattles loose `[BUILT]`: "The door isn't shut right. Rain comes through the gap." on LOOK `[BUILT]`. |

Scene total: 83 / 88 / 95 s. Almost all of it is fixed bark time; only the cooler varies.

## Scene 8 · The gap — Track B (hold rule); fall Track A

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 8.1 | 7.8 | 0 / 3 / 9 | Full | Rizo reaches the door zone; auto-move at 9 s `[BUILT cap]`. Outside the gap: only black and rushing rain. |
| 8.2 | in zone | 1.5 / 4 / 10 | Hold | Rizo leans back, flame pulled tight. **Continuous push toward the gap for 1.5 s carries him through.** Releasing makes him retreat one step. At 10 s the van jolts and throws him regardless. Not persisted; nothing is recorded either way. |
| 8.3 | through | 1.3 | None | Crack, fall pose `[BUILT]` 1 s, fade 0.3 s. |

## Scene 9 · Taillights — Track B (RC2 opening beat kept)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 9.1 | 8.3 | 4.7 + player | None, then player | Black rain 1.3 s; taillights recede 3.4 s; Rizo lies still **until the player moves**; get-up 0.7 s `[BUILT]`. |
| 9.2 | +2 s | 2 | Full | Far up the road, the taillights stop. Brake red. Two doors. |
| 9.3 | 9.2 ends | 12 | Full | A phone flashlight comes back along the shoulder. Barks: **TALL:** "It went off right here." **SMALL:** "It's dark as hell." **TALL:** "It's a flame. Look for the light." **SMALL:** "I don't see no light." **Hide rule:** in ditch shadow or behind a guardrail post, not Flaring → the beam passes. Seen (in beam outside shadow, or Flaring) → the beam stops on him for 1.2 s and **SMALL:** "Yo— was that—" *(proposed line)*. Being seen never causes capture. |
| 9.4 | 9.3 ends | 9 | Full | A different car's headlights approach on the road. **DRIVER** (horn): "Car! Somebody's coming!" **TALL:** "We can't go back without it." **DRIVER:** "We can't go back at all if we get pulled over." **SMALL** (walking away, quiet): "You said probably." Doors; taillights gone. |
| 9.5 | 9.4 ends | 6 | Full | **Music off. Rain only.** Nothing scripted. |

## Scene 10 · The ringing — Track B, optional

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 10.1 | 9.5 + 2 s | up to 40 | Full | A dropped phone lights up in the grass about 40 units away, showing only `CALLER_SYMBOL`. Rings in 4-second cycles. Its glow is the only light nearby. |
| 10.2 | Rizo uses primary or LOOK on it | 5 | Full | Call connects. Screen: `CALLER_SYMBOL` and a running call timer, no text. Rain and Rizo's small breath. Then the screen goes dark. No narration. (Later fact: `callerConnected`, proposal only.) |
| 10.3 | 40 s with no touch | 1 | Full | Rings out; dark. |

The walk continues normally whether or not Rizo goes near the phone.

## Scene 11 · The walk — RC2 room `[BUILT]`, one Track B addition

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 11.1 | free | 80 / 120 / 160 | Full | RC2's walk unchanged: light-pole pools `[BUILT]`, bus stop "A bus stop. No bus." `[BUILT]`, bowl "A bowl in the rain. Somebody's, once." / "Not his." with approach-stop `[BUILT]`, rain heavier near the drain `[BUILT]`. |
| 11.2 | midpoint zone | 6 | Full | One car passes from behind: headlights wash over Rizo; he flinches, then turns and watches it go. It is not YOU. |

## Scene 12 · The drain — Track B (RC2 shelter kept)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 12.1 | enter drain | 1.6 | Full | Shake 0.9 s, settle 0.7 s `[BUILT]`. "A glove. Dry. Somebody waited here once." on LOOK `[BUILT]`. |
| 12.2 | moving inward | 30 / 45 / 80 | Full | His light shows the drain going back too far: concrete, then old brick, then rock. At the black back: LOOK → "Warm air. From down there." A faint warm shimmer at the edge of his light. |
| 12.3 | 30 s near the mouth | 6 | Full | Once only: headlights pass on the road behind, sweeping into the drain. Rizo flinches deeper. |

## Scene 13 · The fall — Track B (black hold and lock timing also Track A)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 13.1 | slope zone | 0.6 + 1.2 | Full | Inward trickle `[BUILT detail]`. Slip 1 (0.6 s). **Recovery window 1.2 s:** any move input scrambles him back up. |
| 13.2 | 3 s later, or at once if not recovered | — | None | Slip 2. Irreversible. |
| 13.3 | +0 | 2.8 | None | Crack 0.3 s. Falling in black for 2.5 s: his flame streaking; three brief flashes of the deep (pipe, stitched cloth, a far-off lit window). Reduced motion: no flashes; a slow dim fade. |
| 13.4 | 0.5 s before impact | 0.5 | None | **All sound cuts.** |
| 13.5 | impact | 2.6 | None | Impact. **Handheld locks on impact** (0.56 s `[BUILT duration]`). Black 2 s. |

## Scene 14 · Awakening — Track B (no-banner fix also Track A)

| ID | Starts when | Seconds | Control | Beat |
|---|---|---|---|---|
| 14.1 | 13.5 ends | 1 + 10 | None, then player | A pinprick of flame appears in total black, then regrows over 10 s. **Presentation only:** flame stat is full. |
| 14.2 | 4 s into 14.1 | player | Player | Rizo wakes **when the player moves**. Movement key pulses at 6 s. No cap. Get-up 0.7 s. |
| 14.3 | awake | — | Full | Rubble behind: "The way down filled in behind him." / "Up is the only way left." on LOOK `[BUILT]`. Faint grey far above where the rain light was. |
| 14.4 | first time Rizo stands still near the landing | 3 + 3.5 | Full | Look-up pose `[BUILT]` held 3 s. **Thought:** `home?` appears 1 s into the look, holds 2.5 s, fades 1 s. **Once ever.** |
| 14.5 | free | 30 / 50 / 100 | Full | The Slip is dark; he explores by his own light. **No HOME ↑ banner.** LOOK on the scratched sign: "Someone scratched it with a key: HOME, and an arrow. Up." `[BUILT]`. On that first read a **new motif** enters and music returns. |

---

## Stopwatch read-through (package step 2)

Do this twice before any code: once at the target pace, once as a player who lingers.

1. **Two people.** One reads every line and narration aloud at speaking pace. The other performs Rizo's beats in words ("he presses to the glass") and runs the stopwatch.
2. **Describe only what can be seen.** No sound effects spoken aloud. If a beat cannot be understood this way, it fails the sound-off rule.
3. **Record actual seconds per scene** next to the target column.
4. **Cut rule.** A beat more than 30% over target that does not change what the listener feels gets cut or shortened. Holds are cut last; holds are where the feeling lands.
5. **Confusion rule.** If the listener asks "what's happening?", stage it more clearly. Never add an explanation line.
6. **Meaning check.** At the end the listener should be able to say: Rizo was taken on purpose, for someone the crew is afraid of, and nobody said why. If they claim to know *why*, a line has leaked an answer.

## Track A at a glance (cheapest first, RC2 rooms only)

1. Waiting incentive fix on the curb (Scene 3 interim rule).
2. "Be good." split onto its own beat (2.2–2.4, without the car).
3. Van dialogue as barks in the existing van room (Scene 7).
4. Black hold and handheld lock on impact (13.4–13.5).
5. No HOME ↑ banner; the sign found by LOOK (14.5).

Track A touches scripted timing and text only. It needs updated expectations in the Dungeon browser suite and **no save changes**.
