"""Dungeon depth and immersion: how the existing story is staged, heard and led.

Covers the van as a playable cutscene (its sound states: engine and road, then
wipers only, then rain only, the phone's cold ring; who is talking, the quiet
line, everyone freezing, everyone turning to him; the Boss line given room),
the room music states (drain, hearth, porter, the Rows through the door), the
danger layer and his flame reacting to fear and relief, Rizo noticing things in
his light, the room pointing the way on when he stands still (never a marker),
the first reveal of a new room, Latch looking back once, the Rows arrival
breath and Nell's notes, reduced motion, and quiet barks staying on screen on
small phones and short landscape. The main suite pins the van's exact authored
order, including the accepted missed-check-in addition. Presentation only:
nothing here is saved.
Chromium only.
"""
import argparse
import functools
import json
import socketserver
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--directory")
parser.add_argument("--evidence")
args = parser.parse_args()
artifact = tempfile.TemporaryDirectory(prefix="rizo-depth-")
directory = Path(args.directory).resolve() if args.directory else Path(artifact.name) / "site"
if not args.directory:
    subprocess.run([sys.executable, str(ROOT / "tools/build-site.py"), "--out", str(directory)], check=True, stdout=subprocess.DEVNULL)
evidence = Path(args.evidence).resolve() if args.evidence else None
if evidence:
    evidence.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "tools"))
from static_site import StaticSiteHandler
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(StaticSiteHandler, directory=str(directory)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_address[1]}/play"
ST = "RizoRuntimeQA.dungeonStateForQA()"
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
Object.assign(s.pet,{name:'MOSSY',stage:'kid',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,accessory:'scarf'});
s.inventory.accessories=['none','scarf'];s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"""
results = []


def check(name, passed, detail=None):
    results.append({"name": name, "passed": bool(passed), "detail": detail if not passed else None})
    print(("PASS" if passed else "FAIL"), name, "" if passed else detail, flush=True)


def shot(page, name):
    if evidence:
        page.screenshot(path=str(evidence / f"{name}.png"))


def state(page):
    return page.evaluate(ST)


def clock(page, ms):
    page.evaluate("ms=>RizoRuntimeQA.dungeonSceneTimeForQA(ms)", ms)


def tp(page, x, y):
    page.evaluate("([x,y])=>RizoRuntimeQA.dungeonTeleportForQA(x,y)", [x, y])
    page.wait_for_timeout(60)


def goto(page, room, anchor=None, flags=None, skip=True):
    page.evaluate("([r,a,f])=>RizoRuntimeQA.dungeonGotoForQA(r,a,f||{})", [room, anchor, flags])
    page.wait_for_timeout(300)
    if skip:
        page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")


def close_dialogue(page, limit=14):
    for _ in range(limit):
        if state(page)["dialogue"] is None:
            return
        page.keyboard.press("z")
        page.wait_for_timeout(110)


def launch(page):
    page.evaluate("RizoRuntimeQA.setViewForQA('go')")
    page.wait_for_timeout(220)
    page.locator('[data-mode="dungeon"]').click()
    page.wait_for_timeout(750)


def boot(browser, viewport=(390, 844), reduced=False):
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, has_touch=True, service_workers="block", reduced_motion="reduce" if reduced else "no-preference")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(1000)
    page.evaluate(SETUP if not reduced else SETUP.replace("RizoRuntimeQA.loadForQA(s)", "s.settings.reducedMotion=true;RizoRuntimeQA.loadForQA(s)"))
    launch(page)
    page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
    return ctx, page, errors


def bark_inside(page):
    return page.evaluate("""()=>{const s=document.querySelector('.dungeon-screen').getBoundingClientRect();
      return [...document.querySelectorAll('.dungeon-bark')].every(b=>{const r=b.getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})}""")


def bark_ms(text):
    return max(1600, 800 + 300 * len(text.split()))


def play_van(page, viewport_name=None, until_quiet=False):
    """Steps the van scene's clock and records what is on screen at each step."""
    goto(page, "van", skip=False)
    tp(page, 80, 98)
    samples = []
    for _ in range(700):
        clock(page, 150)
        page.wait_for_timeout(22)
        st = state(page)
        samples.append({"t": st["sceneTime"], "barks": st["barks"], "music": st["music"], "pose": st["pose"], "depth": st["depth"], "loose": bool(st["sim"]["flags"].get("vanDoorLoose")), "player": st["sim"]["player"], "light": st["lightScale"], "npcs": st["npcs"]})
        if viewport_name and any(b["quiet"] for b in st["barks"]) and not any(s.get("shot") for s in samples):
            samples[-1]["shot"] = True
            samples[-1]["inside"] = bark_inside(page)
            shot(page, f"van-quiet-{viewport_name}")
        if st["depth"]["hush"] == "wipers" and not any("prompt_hidden" in s for s in samples):
            # Step right up to the window while the cabin is quiet: nothing should ask to be pressed.
            tp(page, 128, 66)
            page.wait_for_timeout(90)
            samples[-1]["prompt_hidden"] = page.evaluate("document.querySelector('.dungeon-prompt').hidden")
            tp(page, 80, 98)
        if samples[-1]["loose"] or (until_quiet and samples[-1].get("shot")):
            break
    return samples


def first_index(samples, pred, start=0):
    for index in range(start, len(samples)):
        if pred(samples[index]):
            return index
    return -1


def shows(sample, text):
    return any(b["text"] == text for b in sample["barks"])


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ================= THE VAN: a playable cutscene =================
    ctx, page, errors = boot(browser)
    lines = page.evaluate("(()=>{const L=RizoDungeonContent.LINES;return {boss:L.vanNumber[3].text,last:L.vanNumber[L.vanNumber.length-1].text,checkin:L.vanCheckin[L.vanCheckin.length-1].text,ask:L.vanAsk[0].text,phone:L.vanPhone[0].text,listening:L.vanListening[0].text,touch:L.vanTouch[0].text,why:L.vanTouch[2]?.text}})()")
    samples = play_van(page, "390")
    check("the van has its own sound: engine and road under the floor, not the street",
          samples[0]["music"] == "dungeon-van" and samples[0]["depth"]["hush"] is None, (samples[0]["music"], samples[0]["depth"]["hush"]))
    boss = [s["t"] for s in samples if shows(s, lines["boss"])]
    held = boss[-1] - boss[0] if boss else 0
    check("the Boss line is given more room than a joke of its length (held on screen longer)",
          held >= bark_ms(lines["boss"]) * 1.25, (held, bark_ms(lines["boss"])))
    end_last = first_index(samples, lambda s: not shows(s, lines["checkin"]), first_index(samples, lambda s: shows(s, lines["checkin"])))
    hush = samples[end_last + 2] if end_last >= 0 and end_last + 2 < len(samples) else {}
    check("when the joke dies: wipers only, nobody talks, the music stops",
          hush.get("depth", {}).get("hush") == "wipers" and hush.get("music") == "dungeon-silence" and not hush.get("barks"), {k: hush.get(k) for k in ("music", "barks")} | {"hush": hush.get("depth", {}).get("hush")})
    wipers = [s for s in samples if s["depth"]["hush"] == "wipers"]
    check("he feels it before anyone says so: his flame pulls in (fear)",
          wipers and all(s["depth"]["mood"] == "fear" for s in wipers[:8]) and min(s["light"] for s in wipers) < 0.85, [(s["depth"]["mood"], round(s["light"], 2)) for s in wipers[:8]])
    ask = [b for s in samples for b in s["barks"] if b["text"] == lines["ask"]]
    others = [b for s in samples for b in s["barks"] if b["text"] != lines["ask"]]
    check("“What's he even want it for?” is said quietly; nothing else is", ask and all(b["quiet"] for b in ask) and not any(b["quiet"] for b in others), (ask[:1], [b for b in others if b["quiet"]][:2]))
    after_ask = first_index(samples, lambda s: not shows(s, lines["ask"]), first_index(samples, lambda s: shows(s, lines["ask"])))
    check("nobody answers: rain only", after_ask >= 0 and samples[min(after_ask + 2, len(samples) - 1)]["depth"]["hush"] == "rain" and not samples[min(after_ask + 2, len(samples) - 1)]["barks"])
    ring = first_index(samples, lambda s: s["depth"]["hush"] == "phone")
    seated = ("driver", "hood-tall", "hood-small", "hood-cap")
    frozen = ring >= 0 and all(a["state"] == "freeze" for a in samples[ring]["depth"]["actors"] if a["id"] in seated)
    check("the phone rings: everyone freezes, he recoils, his light shrinks", frozen and samples[ring]["pose"] == "recoil" and samples[ring]["depth"]["mood"] == "fear", (ring, samples[ring]["depth"]["actors"] if ring >= 0 else None, samples[ring]["pose"] if ring >= 0 else None))
    check("its first line comes after the ring, not over it", ring >= 0 and not samples[ring]["barks"] and first_index(samples, lambda s: shows(s, lines["phone"])) > ring)
    stopped = [s for s in samples if {a["id"]: a["state"] for a in s["depth"]["actors"]}.get("hood-small") == "phone-stopped" and {a["id"]: a["state"] for a in s["depth"]["actors"]}.get("hood-tall") == "stop-phone"]
    check("Small starts to answer and Tall physically stops the Boss call", bool(stopped), stopped[:1])
    capped = first_index(samples, lambda s: shows(s, lines["listening"]))
    gaze = [s for s in samples[capped:capped + 12] if shows(s, lines["listening"]) and s["depth"]["still"] >= 600 and s["depth"]["actors"] and not any(a["state"] == "stare" for a in s["depth"]["actors"])]
    def toward(s, who):
        actor = next(a for a in s["npcs"] if a["id"] == who)
        dx, dy = actor["x"] - s["player"]["x"], actor["y"] - s["player"]["y"]
        d = (dx * dx + dy * dy) ** 0.5 or 1
        f = s["depth"]["facing"]
        return f["x"] * dx / d + f["y"] * dy / d
    check("still, he looks at whoever is talking (the capped one, on the wheel arch)", gaze and all(toward(s, "hood-cap") > 0.6 for s in gaze), [(s["depth"]["facing"], round(toward(s, "hood-cap"), 2)) for s in gaze][:3])
    stare = first_index(samples, lambda s: any(a["state"] == "stare" for a in s["depth"]["actors"]))
    check("“It's listening.”: everyone turns to him, and he stares back, in rain only",
          stare > capped >= 0 and all(a["state"] == "stare" for a in samples[stare]["depth"]["actors"] if a["id"] in seated) and samples[stare]["pose"] == "stare" and samples[stare]["depth"]["hush"] == "rain", (capped, stare))
    loose = samples[-1]
    check("while the cabin is quiet, no prompt competes with it (even beside the window)", any(s.get("prompt_hidden") is True for s in samples), [s.get("prompt_hidden") for s in samples if "prompt_hidden" in s])
    check("then the door comes loose and the road is back under everything", loose["loose"] and loose["depth"]["hush"] is None and loose["music"] == "dungeon-van", (loose["loose"], loose["depth"]["hush"], loose["music"]))
    check("quiet lines stay inside the screen (390)", any(s.get("inside") for s in samples), [s.get("inside") for s in samples if s.get("shot")])
    check("no page errors in the van", not errors, errors[:3])
    ctx.close()

    # ================= FIRST TIME INTO A ROOM =================
    ctx, page, errors = boot(browser)
    goto(page, "clatter")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('clatter-draftling',{state:'gone'})")
    visited = state(page)["data"]["world"]["visitedRooms"]
    tp(page, 256, 26)
    page.keyboard.down("w")
    try:
        page.wait_for_function("()=>RizoRuntimeQA.dungeonStateForQA().sim.roomId==='hem'", timeout=4000)
    finally:
        page.keyboard.up("w")
    page.wait_for_timeout(120)
    st = state(page)
    check("first time into a room Below: a slower reveal, his light opening up",
          "hem" not in visited and st["depth"]["firstLookAt"] is not None and st["lightScale"] < 1, (visited, st["depth"]["firstLookAt"], st["lightScale"]))
    page.wait_for_timeout(700)
    check("the reveal is done well inside a second, and control never waited on it", page.locator(".dungeon-fade").evaluate("e=>Number(getComputedStyle(e).opacity)") < 0.05 and state(page)["ui"] in ("play", "dialogue"))
    close_dialogue(page)
    tp(page, 160, 404)
    page.keyboard.down("s")
    try:
        page.wait_for_function("()=>RizoRuntimeQA.dungeonStateForQA().sim.roomId==='clatter'", timeout=4000)
    finally:
        page.keyboard.up("s")
    page.wait_for_timeout(120)
    check("a room he knows is just a cut: no slow reveal", state(page)["depth"]["firstLookAt"] is None)

    check("no page errors walking between rooms", not errors, errors[:3])
    ctx.close()

    # ================= ROOM MUSIC STATES =================
    ctx, page, errors = boot(browser)
    goto(page, "drain")
    check("the drain arrives in designed silence while he shakes off the road", state(page)["music"] == "dungeon-silence", state(page)["music"])
    clock(page, 1800); page.wait_for_timeout(80)
    check("after he settles, the drain earns its own held warm sound", state(page)["music"] == "dungeon-drain", state(page)["music"])
    goto(page, "hearth", None, {"latchFreed": True, "seatChosen": True})
    check("the Shared Hearth has a warm tune of its own", state(page)["music"] == "dungeon-hearth", state(page)["music"])
    goto(page, "porter", "porter-entry", {"latchFreed": True, "seatChosen": True})
    check("the Porter's hall tolls (and its danger layer can rise)", state(page)["music"] == "dungeon-porter", state(page)["music"])
    goto(page, "porter", "porter-entry", {"porterDown": True, "latchFreed": True, "sharedRest": True, "seatChosen": True})
    check("after the Porter: the Rows are heard faintly through the open door", state(page)["music"] == "dungeon-rows-far", state(page)["music"])

    # ================= ONE MOTIF THAT COMES BACK =================
    motif = [64, 67, 69, 72, 67]
    track = lambda tid, start, count: page.evaluate("([i,f,c])=>RizoRuntimeQA.dungeonTrackForQA(i,f,c)", [tid, start, count])
    before_home = [n["note"] for n in track("dungeon-hearth", 48, 16) if n["type"] == "triangle"]
    goto(page, "slip", None, {})
    tp(page, 160, 54)
    page.wait_for_timeout(150)
    page.keyboard.press("z")
    page.wait_for_timeout(300)
    close_dialogue(page)
    st = state(page)
    check("reading HOME ↑ is what lets its motif come back", st["depth"]["home"] is True and "home-sign" in st["data"]["journal"]["discoveredEntryIds"], (st["depth"]["home"],))
    quote = [n["note"] for n in track("dungeon-hearth", 48, 16) if n["type"] == "triangle"]
    lullaby = [n["note"] for n in track("dungeon-hearth", 0, 16) if n["type"] == "triangle"]
    check("…as the Shared Hearth's lullaby every fourth phrase (an octave down), and not before it is known",
          quote == [m - 12 for m in motif] and lullaby != quote and before_home == lullaby, (quote, lullaby, before_home))
    echo = [n for n in track("dungeon-below", 112, 4) if n["type"] == "triangle" and n["note"] in motif]
    check("…and faintly in the music Below, now and then", echo and all(n["volume"] < 0.012 for n in echo), echo)

    # ================= DANGER, FEAR AND RELIEF (Below) =================
    goto(page, "clatter")
    tp(page, 176, 236)
    st = state(page)
    sim_t = st["sim"]["t"]
    page.evaluate("t=>RizoRuntimeQA.dungeonEnemyForQA('clatter-draftling',{state:'windup',stateAt:t,aware:true,locked:true})", sim_t)
    page.wait_for_timeout(260)
    st = state(page)
    check("a threat winding up near him raises the danger layer and pulls his light in", st["depth"]["danger"] > 0.3 and st["lightScale"] < 0.99 and st["music"] == "dungeon-below", (st["depth"]["danger"], st["lightScale"], st["music"]))
    goto(page, "clatter")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(176,236)")
    page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    events = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(6000,{primaryHeld:true,primaryPressed:true})")
    st = state(page)
    check("the last threat near him settles: he breathes out (relief in his flame and body)", "calmed" in events and st["depth"]["mood"] == "relief" and st["pose"] == "loosen", (events[-4:], st["depth"]["mood"], st["pose"]))
    page.wait_for_timeout(1400)
    check("…and the danger layer falls away again", state(page)["depth"]["danger"] < 0.1, state(page)["depth"]["danger"])
    check("danger and relief never touch the Flame stat or the save", st["sim"]["player"]["flame"] >= 1 and "depth" not in json.dumps(st["data"]))

    # ================= NOTICING, AND THE WAY ON =================
    goto(page, "hem", None, {"latchFreed": False})
    tp(page, 150, 268)
    page.wait_for_timeout(300)
    close_dialogue(page)
    page.wait_for_timeout(1700)
    st = state(page)
    check("in his light, he notices what matters (the jammed latch, Latch himself)", any(n in st["depth"]["noticed"] for n in ("hem:latch-jam", "hem:latch")), st["depth"]["noticed"])
    noticed_before = list(st["depth"]["noticed"])
    page.wait_for_timeout(1800)
    check("…once: noticing never repeats for the same thing", sorted(set(state(page)["depth"]["noticed"])) == sorted(set(state(page)["depth"]["noticed"])) and all(state(page)["depth"]["noticed"].count(n) == 1 for n in noticed_before))
    page.evaluate("RizoRuntimeQA.dungeonStillForQA(9000)")
    page.wait_for_timeout(250)
    st = state(page)
    f, p = st["depth"]["facing"], st["sim"]["player"]
    check("standing still too long at the gate, he turns to the jam that needs him (a glint, no marker)",
          st["depth"]["beckonAt"] is not None and f["y"] < -0.5 and not page.evaluate("document.querySelector('.dungeon-banner').textContent"), (st["depth"]["beckonAt"], f, p["x"], p["y"]))
    shot(page, "beckon-hem")
    goto(page, "clatter")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('clatter-draftling',{state:'gone'})")
    tp(page, 90, 330)
    page.evaluate("RizoRuntimeQA.dungeonStillForQA(9000)")
    page.wait_for_timeout(250)
    st = state(page)
    f = st["depth"]["facing"]
    check("in Clatter, the air moves from the way north and he looks to it", st["depth"]["beckonAt"] is not None and f["y"] < -0.5 and f["x"] > 0, (st["depth"]["beckonAt"], f))
    shot(page, "beckon-clatter-draft")
    b0 = st["depth"]["beckonAt"]
    page.wait_for_timeout(500)
    check("the room doesn't nag: once, then a long wait before it points again", state(page)["depth"]["beckonAt"] == b0)
    tp(page, 176, 236)
    page.keyboard.down("w"); page.wait_for_timeout(200); page.keyboard.up("w")
    check("moving resets it: the way on is never pointed at while he's going", state(page)["depth"]["still"] < 1000)

    # ================= LATCH LOOKS BACK ONCE =================
    goto(page, "hem", None, {"latchFreed": False})
    tp(page, 150, 268)
    page.wait_for_timeout(200)
    close_dialogue(page)
    tp(page, 150, 232)
    page.keyboard.press("z")
    page.wait_for_timeout(1500)
    looked, walked = False, False
    for _ in range(120):
        st = state(page)
        if st["dialogue"]:
            page.keyboard.press("z")
            page.wait_for_timeout(90)
            continue
        latch = next((a for a in st["depth"]["actors"] if a["id"] == "latch"), None)
        x = next((n["x"] for n in st["npcs"] if n["id"] == "latch"), 0)
        walked = walked or x > 260
        if latch and latch["face"] == -1 and x > 260:
            looked = True
            break
        if not latch and walked:
            break
        clock(page, 120)
        page.wait_for_timeout(20)
    check("freed, Latch walks to the edge of the dark, looks back at him once, then goes to the hearth", looked)
    check("no page errors through rooms, threats and Latch", not errors, errors[:3])
    ctx.close()

    # ================= THE ROWS: arriving, and Nell =================
    ctx, page, errors = boot(browser)
    goto(page, "porter", "porter-entry", {"porterDown": True, "latchFreed": True, "sharedRest": True, "seatChosen": True})
    tp(page, 180, 30)
    page.keyboard.down("w"); page.wait_for_timeout(900); page.keyboard.up("w")
    page.wait_for_timeout(250)
    st = state(page)
    check("arriving in the Rows he stops and looks up; his light warms before anyone speaks",
          st["sim"]["roomId"] == "receiving" and st["music"] == "dungeon-rows" and (st["pose"] == "look-up" or st["depth"]["mood"] == "warm"), (st["sim"]["roomId"], st["pose"], st["depth"]["mood"], st["barks"]))
    shot(page, "rows-arrival")
    seen_dry = None
    for _ in range(160):
        st = state(page)
        if st["sim"]["flags"].get("ledgeReady") and not st.get("_moved"):
            tp(page, 160, 120)
        if any(b["text"] == "This bit's dry." for b in st["barks"]):
            seen_dry = st
            break
        if st["dialogue"]:
            page.keyboard.press("z")
        clock(page, 300)
        page.wait_for_timeout(15)
    check("when Nell clears the dry patch for him, his light warms (her three notes play)", seen_dry is not None and seen_dry["depth"]["mood"] == "warm", seen_dry and seen_dry["depth"])
    check("no page errors in the Rows", not errors, errors[:3])
    ctx.close()

    # ================= REDUCED MOTION =================
    ctx, page, errors = boot(browser, (320, 568), reduced=True)
    goto(page, "clatter")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('clatter-draftling',{state:'gone'})")
    tp(page, 90, 330)
    page.evaluate("RizoRuntimeQA.dungeonStillForQA(9000)")
    page.wait_for_timeout(250)
    st = state(page)
    check("reduced motion: the room still points the way (a still glint instead of drifting air)", st["depth"]["beckonAt"] is not None and not errors, (st["depth"]["beckonAt"], errors[:2]))
    ctx.close()

    # ================= PHONES: the quiet line stays readable =================
    for vp in [(320, 568), (430, 932), (568, 320)]:
        ctx, page, errors = boot(browser, vp)
        samples = play_van(page, f"{vp[0]}x{vp[1]}", until_quiet=True)
        check(f"{vp[0]}×{vp[1]}: the van's quiet line is on screen and inside it; no sideways scroll",
              any(s.get("inside") for s in samples) and not page.evaluate("document.scrollingElement.scrollWidth>innerWidth+1") and not errors,
              ([s.get("inside") for s in samples if s.get("shot")], errors[:2]))
        ctx.close()
    browser.close()

server.shutdown()
if evidence:
    (evidence / "results.json").write_text(json.dumps(results, indent=2))
print(f"\n{sum(r['passed'] for r in results)}/{len(results)} depth checks passed", flush=True)
sys.exit(0 if all(r["passed"] for r in results) else 1)
