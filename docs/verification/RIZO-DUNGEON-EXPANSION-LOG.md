# Rizo Dungeon — director's expansion: record of changes

Companion to [RIZO-DUNGEON-STORY-OVERHAUL.md](RIZO-DUNGEON-STORY-OVERHAUL.md). Same branch (`claude/dungeon-story-overhaul`) and PR (#33). Story canon: [spine](../dungeon/story/Rizo-Dungeon-Story-Spine-v0.4.md) §Chapter 3; rules: [contracts](../dungeon/story/Rizo-Dungeon-Contracts-v0.4.md) §7.

## 1. The failed Cloudflare check

| Check on PR #33 | Result | What it is |
|---|---|---|
| Cloudflare Pages | **success**, preview deployed | The real preview. It builds the production package and serves it on `pages.dev`. |
| Workers Builds: rizo-world | **failure** in 0 seconds | A second Cloudflare integration: a Worker named `rizo-world` connected to this repo in the Cloudflare dashboard. |

Evidence that the Workers failure is not this branch:
- It failed in exactly the same way (started and completed in the same second, no output) on PRs #27, #31 and #32. None of those contain this branch's code.
- The repo has no `wrangler.toml` / `wrangler.json[c]`, and no Worker entry point. A build that fails before it starts, with no config to read, is a project-configuration failure, not a code one.
- Pages deployed the same commit successfully.
- Its logs are behind the Cloudflare dashboard login. I have no access, so I cannot read the exact message.

The fix is in the Cloudflare dashboard, not the code: disconnect the Workers Builds integration if Pages is the deployment, or give that Worker a real configuration. I did not add a Wrangler config. That would create a second deployment target, and the brief says not to change deployment infrastructure without need.

What I verified on the Pages preview (`claude-dungeon-story-overhau.rizo-world.pages.dev`), in Chromium through the proxy:
- `/play` loads.
- The service worker is active with one cache, `rizo-game-v96-dungeon-story`. It holds 161 entries, includes the comic files, and has no kit.
- `modes/dungeon/kit/`, `tools/`, `tests/` and `docs/` all return 404: dev assets are not in the package.
- The Dungeon launches on `threshold-v4` with the comic API present and no page errors.
- Production (`rizo-world.pages.dev`) still serves `v95`. Nothing here touched it.

After the Chapter 3 push, the same failure repeated for `242bf30`: Workers Builds failed in 0 s and Pages succeeded. Preview `43b37e81.rizo-world.pages.dev`:
- the service worker is active, with one cache, `rizo-game-v97-dungeon-collection`, holding 161 entries and no kit;
- the meta marker is `v97-dungeon-collection`;
- kit, tools, tests and docs all return 404;
- on `threshold-v4`, all five new rooms (the hall, Intake, the collection, the vents, the factory) load with their goal lines, all nine comics are present, and there are no page errors.

## 2. Built: Chapter 3, The Collection

The arc the owner set (chase → cage → building → room of Rizos → escape alone → vents with grate views → factory) is now playable. It is built from the kit's prototypes, rewritten as live rules in `dungeon-core.js` with real art, sound, goals, retries, saves and tests. The dev kit itself is unchanged and still excluded from the package.

| Room | Verb (all different) | Success / failure (tested) |
|---|---|---|
| Window Hall (after the card) | **Ring** the counter bell | The window opens on a collector (comic); Nell holds it with her board. |
| The Long Hall | **Run** (TUCK dashes) from a collector on his trail; time the window lamps; get under the night gate | **Success:** the chute. **Caught:** back to the hall door, or to the gate once he has passed it. |
| Intake | **Rattle** only while the guard looks away; then **freeze** when he looks | **Success:** out the east door. **Rattle under his eye:** −2 notches. **Seen moving:** put back, keeping two notches. |
| The Collection | **Wake** jars (warmth); three together thaw the grate | **Success:** the grate opens. **Too cold alone:** the goal explains why. |
| The Vents | **Look** (stand still on a grate); **freeze** when light comes up under him | **Success:** the hatch. **Heard:** back to the start of that duct. |
| The Factory Floor | **Ride** belts; **hide** behind crates (not jar trays) from walkway lamps | **Success:** the loading door and the chapter card. **Caught:** back to the vent landing. |
| Hanging Row (Rows) | **Lure**: Nell's tin bell sends the lamp to look | A new verb in an old room. The Boss on the radio: "Bells don't glow." |

Boss pressure, without a face:
- radio in the hall;
- a speaker in Intake: "Tag it. Then bring it up.";
- a ledger whose last line is tonight;
- a jar already tagged with the player's own pet's name;
- his hands, cufflinks and list seen through a grate: "Then find the one who said it was fine.";
- his voice in every factory speaker;
- empty jars by the hundred.

Characters remember: the hoods know Rizo from the van, the small one remembers the phone that was answered (or the ditch), and they notice Nell's wrap ("…Somebody loves it.").

## 3. Autonomous improvements (what, and why)

| Change | Why |
|---|---|
| Save bounds widened: rooms 16→48, beats 64→128, journal 32→96, flags 32→64 per map | **A real bug.** A full journey visits 21 rooms (now 26). On reload only the first 16 were kept, so the last five Rows rooms fell out of the save (the shelf said at most ROWS 5/10, and "first visit" reveals replayed). Tested in `dungeon-core.test.js`. |
| Build marker v96 → `v97-dungeon-collection` | It names the build the preview and the release tests check, and a new cache name makes the service worker replace its offline copy in one step. It was not needed to refresh the scripts: the Dungeon files are in `sw.js` `REQUIRED_SHELL`, which is fetched network-first. (Corrected: this row first said they were cache-first.) |
| The Rows chapter card is now a chapter break ("the bell on the counter calls the window") | It said "End of what's built so far", which is no longer true. Its title, STAY and GO HOME are unchanged, so the existing assertions hold. |
| A journey past the Porter resumes in place in the Rows **or** the building | Without this, a save in the new rooms would have been sent back to the Porter. |
| Runner: rubber-banding (slower than him close, quicker far), hall shortened, the gate becomes a checkpoint, the side door moved off his path | Measured with a bot (30 runs per style). Before: a player pausing 0.4 s now and then escaped 10/30, and a catch cost a 28 s replay. After: clean runs and a single 1.5 s stop always escape, the pausing player escapes about 3 times in 4, and a catch after the gate replays only the last stretch. |
| Vent light walks **down** the duct toward him | Walking up, he could simply follow behind a light moving the same way. Now a straight walk is caught most of the time (a "?" warns first). Freezing always works, from every start time (tested). |
| Collection jar lights drawn above the dark | Under the light pass they read as grey blobs; now each is a small cold light, breathing very slowly. |
| A front canvas above Rizo | Rizo is a DOM element above the game canvas, so nothing could ever stand in front of him. Cage bars and the crate he hides behind now do. |
| Window comic lettering moved; factory goal shortened | Clipped "KRRANG!"; a two-line goal at 390 px. |

## 4. What remains

- **Workers Builds** stays red until someone with dashboard access disconnects it or configures it (§1).
- There is no Safari or physical-phone evidence. Chromium with touch emulation only.
- The chase difficulty is tuned against a bot and my own runs, not real children.
- Open story questions (why he collects, the factory, "holding at four", No. 31, Nell after the window) are listed in the spine and answered nowhere.
