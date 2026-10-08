"""Chapter 3, The Collection (story spine v0.5): the window opens on collectors.

Plays every room of the new chapter with real keys, through success and
failure: the bell that calls the window (Nell, the comic, the staff door),
the Long Hall chase (window lamps that dazzle, the night gate shutting on the
runner, caught = back to the hall door, the chute comic), Intake's cage
(rattles only count while the small hood looks away; under his eye they cost;
out of the cage, moving while he looks gets him put back), the collection
(the grate too cold for one light, waking jars and their tags, the promise,
the jar with his own name), the vents (grate views of the Boss's rooms, the
light walking down the duct: move on it and he is heard), the factory floor
(belts carry him, crates hide him, a catwalk lamp catches him, the loading
door and the chapter card), Nell's tin bell in the Hanging Row, reloads that
keep what was done, phone widths and reduced motion.
Chromium only.
"""
import argparse
import functools
import json
import math
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
artifact = tempfile.TemporaryDirectory(prefix="rizo-escape-")
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
# What is really on disk (the persisted save), not the mode's memory.
STORED = """()=>{const v=JSON.parse(localStorage.getItem('rizo-save-v2')||'null');return {slice:v?.modes?.dungeon?.data||null}}"""
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
Object.assign(s.pet,{name:'MOSSY',stage:'kid',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,accessory:'scarf'});
s.inventory.accessories=['none','scarf'];s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"""
# Everything Mending Rows leaves done, so the chapter starts where it really would.
ROWS_FLAGS = {k: True for k in ["latchFreed", "porterDown", "porterHelp", "rowsLedge", "rowsCatch", "rowsLowRoute", "rowsGrille", "rowsPressOpen", "rowsPressStop", "rowsBrake", "rowsShutter", "rowsStair", "rowsOnward", "rowsLatchHelped"]}
ROWS_BEATS = ["rows:arrived", "rows:met", "rows:split", "rows:eyelet", "rows:orr", "rows:meal", "rows:job", "rows:upper", "rows:return", "rows:wrap", "rows:screen"]
results = []


def check(name, passed, detail=None):
    results.append({"name": name, "passed": bool(passed), "detail": detail if not passed else None})
    print(("PASS" if passed else "FAIL"), name, "" if passed else detail, flush=True)


def shot(page, name):
    if evidence:
        page.screenshot(path=str(evidence / f"{name}.png"))


def state(page):
    return page.evaluate(ST)


def stored(page):
    return page.evaluate(STORED)["slice"]


def clock(page, ms):
    page.evaluate("ms=>RizoRuntimeQA.dungeonSceneTimeForQA(ms)", ms)


def tp(page, x, y):
    page.evaluate("([x,y])=>RizoRuntimeQA.dungeonTeleportForQA(x,y)", [x, y])
    page.wait_for_timeout(60)


def goto(page, room, anchor=None, flags=None, beats=None):
    page.evaluate("([r,a,f,b])=>RizoRuntimeQA.dungeonGotoForQA(r,a,f||{},b||[])", [room, anchor, flags, beats])
    page.wait_for_timeout(300)


def close_dialogue(page, limit=14):
    for _ in range(limit):
        if state(page)["dialogue"] is None:
            return
        page.keyboard.press("z")
        page.wait_for_timeout(110)


def drive(page, pred, limit=80, step=400):
    """Runs the scene clock (and any comic) until pred(state) holds."""
    for _ in range(limit):
        st = state(page)
        if pred(st):
            return st
        clock(page, step)
        page.wait_for_timeout(25)
    return state(page)


def launch(page):
    page.evaluate("RizoRuntimeQA.setViewForQA('go')")
    page.wait_for_timeout(220)
    page.locator('[data-mode="dungeon"]').click()
    page.wait_for_timeout(750)
    return state(page)


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


def steer(page, points, timeout=20000, stop=None, tol=6):
    """Holds real arrow keys toward each waypoint in turn (two keys on a diagonal).
    Reached waypoints are taken off `points`, so a caller can resume the route."""
    held, t = set(), 0
    try:
        while t < timeout and points:
            st = state(page)
            if stop and stop(st):
                break
            if st["sim"]["phase"] != "play" or st["ui"] != "play":
                for key in list(held):
                    page.keyboard.up(key)
                    held.discard(key)
                if st["sim"]["phase"] != "play":
                    return st
                page.wait_for_timeout(50)
                t += 50
                continue
            p = st["sim"]["player"]
            dx, dy = points[0][0] - p["x"], points[0][1] - p["y"]
            if math.hypot(dx, dy) < tol:
                points.pop(0)
                continue
            want = set()
            if abs(dx) > 3:
                want.add("ArrowRight" if dx > 0 else "ArrowLeft")
            if abs(dy) > 3:
                want.add("ArrowDown" if dy > 0 else "ArrowUp")
            for key in list(held - want):
                page.keyboard.up(key)
                held.discard(key)
            for key in want - held:
                page.keyboard.down(key)
                held.add(key)
            page.wait_for_timeout(40)
            t += 40
    finally:
        for key in list(held):
            page.keyboard.up(key)
    return state(page)


def warm_until(page, x, y, done, ms=4000):
    """Stands at x,y, presses Primary (a Kindle) and waits in real time until done(state)."""
    tp(page, x, y)
    page.keyboard.down("z")
    page.wait_for_timeout(120)
    page.keyboard.up("z")
    for _ in range(ms // 100):
        st = state(page)
        if done(st):
            return st
        page.wait_for_timeout(100)
    return state(page)


def read_until(page, text, presses=8):
    """Advances a dialogue until a line containing text is fully shown."""
    for _ in range(presses):
        st = state(page)
        if st["dialogue"] and text in st["dialogue"]["text"]:
            page.wait_for_timeout(120)
            return state(page)
        page.keyboard.press("z")
        page.wait_for_timeout(260)
    return state(page)


def said(st, text):
    return any(text in b["text"] for b in st["barks"]) or (st["dialogue"] and text in st["dialogue"]["text"])


def no_scroll(page):
    return not page.evaluate("document.scrollingElement.scrollWidth>innerWidth+1||document.scrollingElement.scrollHeight>innerHeight+1")


HALL = [[270, 1050], [270, 912], [52, 912], [52, 810], [160, 780], [160, 470], [160, 420], [250, 392], [250, 320], [70, 320], [70, 250], [160, 200], [160, 40]]
AFTER_GATE = [[250, 392], [250, 320], [70, 320], [70, 250], [160, 200], [160, 40]]

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ================= WINDOW HALL: the bell calls the window =================
    ctx, page, errors = boot(browser)
    goto(page, "windowgate", "gate-entry", ROWS_FLAGS, ROWS_BEATS)
    tp(page, 160, 90)
    st = drive(page, lambda s: s["panelKind"] == "boundary", 120)
    panel = page.evaluate("document.querySelector('.dungeon-panel')?.textContent||''")
    check("the Rows card is now a chapter break: WINDOW HALL IS NEXT, and the bell calls the window", "WINDOW HALL IS NEXT" in panel and "bell on the counter" in panel and "End of what's built" not in panel, panel[:200])
    page.click("[data-dungeon-action='stay']")
    page.wait_for_timeout(250)
    st = state(page)
    check("after the card the goal is the bell: the way up goes past the counter", st["objective"] == "THE WAY UP IS PAST THE COUNTER. RING THE BELL.", st["objective"])
    tp(page, 206, 86)
    clock(page, 300)
    page.wait_for_timeout(150)
    st = state(page)
    prompt = page.evaluate("document.querySelector('.dungeon-prompt')?.textContent||''")
    check("at the counter the bell says RING, and Nell would rather wait her turn", "RING" in prompt and said(st, "They call in order."), (prompt, st["barks"]))
    shot(page, "escape-bell")
    page.keyboard.press("z")
    page.wait_for_timeout(150)
    st = state(page)
    check("he rings it; Nell, dry: “…Or that.”", said(st, "…Or that.") and st["scene"] and st["scene"]["id"] == "window:open", (st["barks"], st["scene"]))
    st = drive(page, lambda s: s["comic"] == "window-opens", 20, 300)
    check("the window opens on a collector: an action comic (the bell, KRRANG, Nell's board)", st["comic"] == "window-opens" and page.evaluate("document.querySelectorAll('.dungeon-comic[data-comic=\"window-opens\"] .comic-panel').length") == 3)
    clock(page, 1400)
    page.wait_for_timeout(120)
    balloon = page.evaluate("[...document.querySelectorAll('.dungeon-comic .comic-balloon')].map(b=>b.textContent).join('|')")
    check("Nell in the comic: “Run. I've got the heavy bit.” (the table's heavy bit)", "Run. I've got the heavy bit." in balloon, balloon)
    shot(page, "escape-window-comic")
    st = drive(page, lambda s: s["scene"] is None and s["comic"] is None, 30, 400)
    flags = stored(page)["world"]["durableRoomFlags"]
    beats = stored(page)["story"]["committedSceneBeats"]
    check("the window stays open (a durable room flag) and its comic is committed once", flags.get("windowOpen") is True and beats.count("comic:window-opens") == 1, (flags.get("windowOpen"), beats[-4:]))
    check("Nell holds the collector at the counter; the goal says RUN, east", any(n["id"] == "nell" and n["state"] == "brace" for n in st["npcs"]) and any(n["id"] == "held" for n in st["npcs"]) and st["objective"] == "RUN! THE STAFF DOOR, EAST!", (st["npcs"], st["objective"]))
    shot(page, "escape-window-open")
    page.reload()
    page.wait_for_timeout(1200)
    st = launch(page)
    check("a reload keeps the window open: Nell still bracing, no comic replayed", st["sim"]["roomId"] == "windowgate" and any(n["id"] == "held" for n in st["npcs"]) and st["comic"] is None and stored(page)["story"]["committedSceneBeats"].count("comic:window-opens") == 1, (st["sim"]["roomId"], st["comic"]))
    tp(page, 284, 190)
    page.keyboard.down("ArrowRight")
    page.wait_for_timeout(700)
    page.keyboard.up("ArrowRight")
    page.wait_for_timeout(700)
    st = state(page)
    check("through the staff door: the Long Hall, with the chase goal", st["sim"]["roomId"] == "longhall" and st["objective"] == "RUN! DON'T LET IT CATCH YOU. TUCK TO DASH.", (st["sim"]["roomId"], st["objective"]))
    check("no page errors at Window Hall", not errors, errors[:3])
    ctx.close()

    # ================= THE LONG HALL: caught, then away =================
    ctx, page, errors = boot(browser)
    goto(page, "longhall", "hall-entry", {**ROWS_FLAGS, "windowOpen": True})
    st = state(page)
    check("it comes through the door behind him a moment later (it is not in the room yet)", st["escape"]["runner"]["state"] == "waiting", st["escape"])
    for _ in range(80):
        page.wait_for_timeout(60)
        st = state(page)
        if st["sim"]["phase"] != "play":
            break
    check("standing still, it catches him", st["sim"]["phase"] in ("down", "await-respawn") and st["escape"]["runner"]["state"] == "caught", st["escape"])
    page.wait_for_timeout(1700)
    st = state(page)
    banner = page.evaluate("document.querySelector('.dungeon-banner')?.textContent||''")
    check("caught: back at the hall door with a fresh chase (never sent back to the Rows)", st["sim"]["roomId"] == "longhall" and abs(st["sim"]["player"]["x"] - 44) < 2 and st["escape"]["runner"]["state"] == "waiting" and "RUN AGAIN" in banner, (st["sim"]["roomId"], st["escape"], banner))
    check("the save says so: continuation at the hall door", stored(page)["continuation"]["roomId"] == "longhall" and stored(page)["continuation"]["safeAnchorId"] == "hall-entry", stored(page)["continuation"])
    dazzled = blocked = False
    seen_runner = []
    held, t = set(), 0
    points = [list(p) for p in HALL]
    # Run it for real up to the night gate and under it, watching the lamps and the runner.
    points = points[:points.index([250, 392]) + 1]
    while points and t < 40000:
        st = state(page)
        esc = st.get("escape") or {}
        if esc.get("dazzled") and not dazzled:
            shot(page, "escape-hall-dazzled")
        dazzled = dazzled or esc.get("dazzled")
        if esc.get("runner"):
            seen_runner.append(esc["runner"]["state"])
        if st["sim"]["roomId"] != "longhall" or st["sim"]["phase"] != "play" or st["ui"] != "play":
            break
        pl = st["sim"]["player"]
        dx, dy = points[0][0] - pl["x"], points[0][1] - pl["y"]
        if math.hypot(dx, dy) < 6:
            points.pop(0)
            continue
        want = set()
        if abs(dx) > 3:
            want.add("ArrowRight" if dx > 0 else "ArrowLeft")
        if abs(dy) > 3:
            want.add("ArrowDown" if dy > 0 else "ArrowUp")
        for key in list(held - want):
            page.keyboard.up(key)
            held.discard(key)
        for key in want - held:
            page.keyboard.down(key)
            held.add(key)
        page.wait_for_timeout(40)
        t += 40
    for key in list(held):
        page.keyboard.up(key)
    check("the service-window lamps dazzled him at least once on the way", dazzled, dazzled)
    check("the night gate shut behind him and the runner had to go round", "detour" in seen_runner, sorted(set(seen_runner)))
    shot(page, "escape-hall-gate")
    # Past the gate, a catch costs only the last stretch.
    for _ in range(120):
        page.wait_for_timeout(60)
        if state(page)["sim"]["phase"] != "play":
            break
    page.wait_for_timeout(1700)
    st = state(page)
    banner = page.evaluate("document.querySelector('.dungeon-banner')?.textContent||''")
    check("caught after the gate: back to the gate, not the hall door (the gate stays down behind him)", st["sim"]["roomId"] == "longhall" and abs(st["sim"]["player"]["y"] - 414) < 2 and st["escape"]["gate"]["closed"] and "BACK TO THE GATE" in banner, (st["sim"]["player"], st["escape"], banner))
    steer(page, AFTER_GATE, timeout=20000, stop=lambda s: s["comic"] == "chute" or s["sim"]["roomId"] != "longhall")
    st = drive(page, lambda s: s["comic"] == "chute", 30, 200)
    check("he reached RETURNS: the chute comic", st["comic"] == "chute", (st["sim"]["roomId"], st["comic"]))
    clock(page, 4000)
    page.wait_for_timeout(150)
    balloon = page.evaluate("[...document.querySelectorAll('.dungeon-comic .comic-balloon')].map(b=>b.textContent).join('|')")
    check("the Boss on the radio: “Good. Then it's already here.”", "It took the chute." in balloon and "Then it's already here." in balloon, balloon)
    shot(page, "escape-chute-comic")
    st = drive(page, lambda s: s["sim"]["roomId"] == "intake", 30, 400)
    check("down the chute into Intake, the escape remembered", st["sim"]["roomId"] == "intake" and stored(page)["story"]["facts"].get("hallEscaped") is True, (st["sim"]["roomId"], stored(page)["story"]["facts"]))
    check("no page errors in the Long Hall", not errors, errors[:3])
    ctx.close()

    # ================= INTAKE: the cage, and out =================
    ctx, page, errors = boot(browser)
    # He answered the hoods' phone at the roadside: they remember.
    goto(page, "intake", "intake-cage", {**ROWS_FLAGS, "windowOpen": True, "hallEscaped": True, "callerConnected": True})
    seen = []
    st = drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or s["scene"] is None), 120, 300)
    check("the hoods know him: “It's IT. It's the one from the van!”", any("one from the van" in t for t in seen), seen[:4])
    check("the small one remembers the phone he answered", any("HE was on my phone" in t for t in seen) and not any("ditch" in t for t in seen), [t for t in seen if "phone" in t or "ditch" in t])
    check("the Boss on the speaker: “Tag it. Then bring it up.”", any("Tag it. Then bring it up." in t for t in seen) and any("He hung up on you." in t for t in seen), seen)
    label = page.evaluate("document.querySelector('[data-dungeon-key=\"primary\"] b')?.textContent||''")
    check("in the crate the action key says RATTLE", label == "RATTLE", label)
    check("the goal: rattle while he looks away", st["objective"] == "RATTLE THE DOOR WHILE HE LOOKS AWAY", st["objective"])
    shot(page, "escape-intake")
    # Under his eye: it costs.
    st = state(page)
    if st["escape"]["guard"] == "watch":
        page.keyboard.press("z")
        page.wait_for_timeout(200)
        st = state(page)
        check("a rattle under his eye: “HEY. No. Stay.” and no notch", st["escape"]["cage"]["loose"] == 0 and (said(st, "Stay.") or said(st, "He'll do a thing to me.")), (st["escape"], st["barks"]))
    rattles = 0
    for _ in range(300):
        st = state(page)
        if st["escape"]["cage"]["open"]:
            break
        if st["escape"]["guard"] == "away":
            page.keyboard.press("z")
            rattles += 1
            page.wait_for_timeout(280)
        else:
            page.wait_for_timeout(100)
    st = state(page)
    check("five rattles while he looks away open the door", st["escape"]["cage"]["open"] and rattles <= 7 and st["objective"] == "OUT THE EAST DOOR. FREEZE WHEN HE LOOKS.", (st["escape"]["cage"], rattles, st["objective"]))
    # Failure: walk out in the open while he is looking.
    for _ in range(120):
        if state(page)["escape"]["guard"] == "watch":
            break
        page.wait_for_timeout(80)
    page.keyboard.down("ArrowRight")
    page.wait_for_timeout(700)
    page.keyboard.up("ArrowRight")
    page.wait_for_timeout(1700)
    st = state(page)
    banner = page.evaluate("document.querySelector('.dungeon-banner')?.textContent||''")
    check("moving while he looks: put back in the crate, keeping a little of the loosening", st["sim"]["roomId"] == "intake" and not st["escape"]["cage"]["open"] and st["escape"]["cage"]["loose"] == 2 and "PUT BACK" in banner, (st["escape"], banner))
    for _ in range(300):
        st = state(page)
        if st["escape"]["cage"]["open"]:
            break
        if st["escape"]["guard"] == "away":
            page.keyboard.press("z")
            page.wait_for_timeout(280)
        else:
            page.wait_for_timeout(100)
    route = [[110, 136], [110, 200], [110, 250], [180, 252], [240, 230], [270, 230], [314, 260]]
    for _ in range(500):
        st = state(page)
        if st["sim"]["roomId"] != "intake" or st["sim"]["phase"] != "play":
            break
        if st["escape"]["guard"] == "away":
            steer(page, route, timeout=300, stop=lambda s: s["sim"]["roomId"] != "intake" or (s.get("escape") or {}).get("guard") != "away")
            route = route if route else [[314, 260]]
        else:
            page.wait_for_timeout(60)
        if not route:
            route = [[314, 260]]
    page.wait_for_timeout(600)
    st = state(page)
    check("freezing when he looks, he gets out the east door", st["sim"]["roomId"] == "collection", st["sim"]["roomId"])
    check("no page errors in Intake", not errors, errors[:3])
    ctx.close()

    # ================= THE COLLECTION =================
    ctx, page, errors = boot(browser)
    goto(page, "collection", "coll-entry", {**ROWS_FLAGS, "windowOpen": True, "hallEscaped": True})
    seen = []
    st = drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or (s["dialogue"] and "Jars." in s["dialogue"]["text"])), 60, 300)
    check("through the door behind him, the small hood lies: “It's tagged. It's fine.”", any("It's tagged. It's fine." in t for t in seen), seen)
    check("then the room, quietly: jars, a small light in each", st["dialogue"] and "In every one, a small light" in st["dialogue"]["text"], st["dialogue"])
    close_dialogue(page)
    shot(page, "escape-collection")
    st = warm_until(page, 270, 50, lambda s: s["dialogue"] is not None)
    check("the grate is too cold for one small light", st["dialogue"] and "won't turn for one small light" in st["dialogue"]["text"], st["dialogue"])
    close_dialogue(page)
    check("so the goal says: wake the jars, together you're warm enough", state(page)["objective"] == "WAKE THE JARS. TOGETHER YOU'RE WARM ENOUGH.", state(page)["objective"])
    tags = []
    for x, y, woke in [(70, 466, 1), (186, 466, 2), (160, 366, 3)]:
        st = warm_until(page, x, y, lambda s, n=woke: s["escape"]["woken"] >= n)
        page.wait_for_timeout(150)
        tags.extend(b["text"] for b in state(page)["barks"])
    flags = stored(page)["world"]["durableRoomFlags"]
    check("each jar he warms wakes, and its tag says where it was taken", flags.get("jarMoth") and flags.get("jarPip") and flags.get("jarBean") and any("PIP. Taken from a bus stop" in t for t in tags), (flags, tags))
    check("three awake: the goal points at the grate", state(page)["objective"] == "WARM THE GRATE (NORTH-EAST CORNER)", state(page)["objective"])
    shot(page, "escape-jars")
    page.reload()
    page.wait_for_timeout(1200)
    st = launch(page)
    check("a reload keeps the jars he woke awake", st["sim"]["roomId"] == "collection" and st["escape"]["woken"] == 3, st["escape"])
    tp(page, 112, 70)
    page.keyboard.press("z")
    page.wait_for_timeout(300)
    st = read_until(page, "1,204.")
    check("a clean jar with HIS name already on its tag", st["dialogue"] and "1,204. MOSSY." in st["dialogue"]["text"], st["dialogue"])
    close_dialogue(page)
    warm_until(page, 270, 50, lambda s: s["scene"] is not None or s["dialogue"] is not None)
    seen = []
    for _ in range(30):
        st = state(page)
        if st["dialogue"]:
            seen.append(st["dialogue"]["text"])
            page.keyboard.press("z")
            page.wait_for_timeout(150)
        else:
            clock(page, 500)
            page.wait_for_timeout(40)
        if st["scene"] is None and not st["dialogue"] and seen:
            break
    facts = stored(page)["story"]["facts"]
    check("with theirs it's warm enough; he looks back once, so they know (the promise is kept in the save)", any("With theirs" in t for t in seen) and any("so they know" in t for t in seen) and facts.get("promised") is True and stored(page)["world"]["durableRoomFlags"].get("ventGrate"), (seen, facts))
    check("the goal now: COME BACK FOR THEM", state(page)["objective"] == "COME BACK FOR THEM", state(page)["objective"])
    tp(page, 270, 30)
    page.keyboard.down("ArrowUp")
    page.wait_for_timeout(600)
    page.keyboard.up("ArrowUp")
    page.wait_for_timeout(700)
    check("up through the grate into the vents", state(page)["sim"]["roomId"] == "vents", state(page)["sim"]["roomId"])
    check("no page errors in the collection", not errors, errors[:3])
    ctx.close()

    # ================= THE VENTS =================
    ctx, page, errors = boot(browser)
    goto(page, "vents", "vent-start", {**ROWS_FLAGS, "windowOpen": True, "hallEscaped": True, "ventGrate": True})
    tp(page, 120, 480)
    page.wait_for_timeout(900)
    st = state(page)
    check("still on a grate, the room below shows: the collection goes back further than his light", st["escape"]["ventView"] == "scale" and said(st, "More jars than he can count"), (st["escape"], st["barks"]))
    shot(page, "escape-vent-scale")
    page.keyboard.down("ArrowRight")
    page.wait_for_timeout(600)
    page.keyboard.up("ArrowRight")
    page.wait_for_timeout(100)
    st = state(page)
    check("moving off the grate, the view closes", st["escape"]["ventView"] is None and st["sim"]["player"]["x"] > 150, (st["escape"]["ventView"], st["sim"]["player"]))
    tp(page, 140, 300)
    page.wait_for_timeout(900)
    seen = []
    st = drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or len(seen) > 2 and any("He'll ask" in t for t in seen)), 30, 300)
    check("the lab: white coats, a jar, “Write it down. He'll ask.”", state(page)["escape"]["ventView"] == "lab" and any("Holding at four." in t for t in seen) and any("He'll ask." in t for t in seen), seen)
    # Heard: walk straight up the duct with the light coming down.
    tp(page, 220, 300)
    page.keyboard.down("ArrowUp")
    caught = False
    for _ in range(60):
        page.wait_for_timeout(80)
        st = state(page)
        if st["sim"]["phase"] != "play":
            caught = st["sim"]["roomId"] == "vents"
            break
        if st["sim"]["player"]["y"] < 110:
            break
    page.keyboard.up("ArrowUp")
    if not caught:
        # The rhythm can let a straight walk through; then he walks back down and up again.
        for attempt in range(4):
            tp(page, 220, 300)
            page.keyboard.down("ArrowUp")
            for _ in range(60):
                page.wait_for_timeout(80)
                st = state(page)
                if st["sim"]["phase"] != "play" or st["sim"]["player"]["y"] < 110:
                    break
            page.keyboard.up("ArrowUp")
            if state(page)["sim"]["phase"] != "play":
                caught = True
                break
    shot(page, "escape-vent-heard")
    check("moving on a lit grate he is heard (“?”), and caught", caught, state(page)["escape"])
    page.wait_for_timeout(1700)
    st = state(page)
    banner = page.evaluate("document.querySelector('.dungeon-banner')?.textContent||''")
    check("heard: back to the start of that duct, not the start of the vents", st["sim"]["roomId"] == "vents" and abs(st["sim"]["player"]["x"] - 220) < 2 and abs(st["sim"]["player"]["y"] - 300) < 2 and "HEARD" in banner, (st["sim"]["player"], banner))
    # Freeze whenever a grate under him or just ahead is lit.
    for _ in range(400):
        st = state(page)
        pl = st["sim"]["player"]
        if pl["y"] < 104 or st["sim"]["phase"] != "play":
            break
        lit = page.evaluate("""([x,y])=>{const g=RizoDungeonContent.ROOMS.vents;const t=RizoRuntimeQA.dungeonStateForQA().sim.t;
          return g.listens.some((r,i)=>RizoDungeonCore.listenLit(g,i,t)&&y+9>=r.y&&y-9<=r.y+r.h)}""", [pl["x"], pl["y"]])
        if lit:
            page.keyboard.up("ArrowUp")
            page.wait_for_timeout(50)
        else:
            page.keyboard.down("ArrowUp")
            page.wait_for_timeout(40)
    page.keyboard.up("ArrowUp")
    st = state(page)
    check("freezing for the light, he gets past the guard post", st["sim"]["phase"] == "play" and st["sim"]["player"]["y"] < 110, st["sim"]["player"])
    tp(page, 140, 80)
    seen = []
    st = drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or any("said it was fine" in t for t in seen)), 40, 300)
    check("over his office: hands, a list, and the Boss: “One short. Count them again.”", state(page)["escape"]["ventView"] == "office" and any("One short." in t for t in seen) and any("said it was fine" in t for t in seen), seen)
    shot(page, "escape-vent-office")
    tp(page, 96, 80)
    page.keyboard.press("z")
    page.wait_for_timeout(400)
    st = state(page)
    check("HOME, scratched with a key, and an arrow: someone came this way before", st["dialogue"] and "HOME, and an arrow. This way." in st["dialogue"]["text"], st["dialogue"])
    close_dialogue(page)
    tp(page, 60, 80)
    page.wait_for_timeout(900)
    check("down the hatch to the factory floor", state(page)["sim"]["roomId"] == "factory", state(page)["sim"]["roomId"])
    check("no page errors in the vents", not errors, errors[:3])
    ctx.close()

    # ================= THE FACTORY FLOOR =================
    ctx, page, errors = boot(browser)
    goto(page, "factory", "fac-top", {**ROWS_FLAGS, "windowOpen": True, "hallEscaped": True, "ventGrate": True, "ventsOut": True})
    seen = []
    st = drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or any("Find it." in t for t in seen)), 40, 300)
    check("his voice in every speaker: “It's small, and it's warm. Find it.”", any("Lamps up." in t for t in seen) and any("Find it." in t for t in seen), seen)
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('fac-w1',{x:300,y:120})")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('fac-w2',{x:300,y:280})")
    tp(page, 100, 173)
    x0 = state(page)["sim"]["player"]["x"]
    page.wait_for_timeout(1000)
    x1 = state(page)["sim"]["player"]["x"]
    check("a belt carries him while he stands still", x1 - x0 > 8, (x0, x1))
    crate = page.evaluate("""()=>{const g=RizoDungeonContent.ROOMS.factory;const t=RizoRuntimeQA.dungeonStateForQA().sim.t;
      return RizoDungeonCore.beltItems(g.belts[0],t,g.w).find(i=>i.kind==='crate'&&i.x>60&&i.x<260)}""")
    if crate:
        tp(page, crate["x"], crate["y"])
        page.wait_for_timeout(120)
        check("pressed to a crate on the belt, he is hidden", state(page)["escape"]["hidden"], state(page)["escape"])
        shot(page, "escape-factory-crate")
    else:
        check("pressed to a crate on the belt, he is hidden", False, "no crate in reach")
    # Failure: stand in the open under a catwalk lamp.
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('fac-w2',{x:160,y:280})")
    tp(page, 160, 340)
    for _ in range(40):
        page.wait_for_timeout(80)
        if state(page)["sim"]["phase"] != "play":
            break
    page.wait_for_timeout(1700)
    st = state(page)
    banner = page.evaluate("document.querySelector('.dungeon-banner')?.textContent||''")
    check("caught in a catwalk lamp: back to the vent landing", st["sim"]["roomId"] == "factory" and abs(st["sim"]["player"]["y"] - 50) < 2 and "BACK TO THE VENT" in banner, (st["sim"]["player"], banner))
    tp(page, 160, 640)
    for name in ["fac-w1", "fac-w2", "fac-w3"]:
        page.evaluate(f"RizoRuntimeQA.dungeonEnemyForQA('{name}',{{x:300,y:20}})")
    tp(page, 160, 676)
    narration = None
    for _ in range(60):
        st = state(page)
        if st["panelKind"] == "boundary":
            break
        if st["dialogue"]:
            narration = narration or st["dialogue"]["text"]
            page.keyboard.press("z")
        page.wait_for_timeout(200)
    check("at the loading door: “Under the loading door: rain. Real rain, from the real sky.”", narration and "Real rain, from the real sky." in narration, narration)
    panel = page.evaluate("document.querySelector('.dungeon-panel')?.textContent||''")
    check("the loading door: rain, real rain; the chapter card THE NIGHT IS NEXT", "THE NIGHT IS NEXT" in panel and "STAY A WHILE" in panel and "GO HOME" in panel and "jar with his name" in panel, panel[:200])
    data = stored(page)
    check("saved at the door: continuation, the escape fact, ESCAPE 5/5 on the shelf", data["continuation"]["roomId"] == "factory" and data["continuation"]["safeAnchorId"] == "fac-door" and data["story"]["facts"].get("factoryOut") is True and page.evaluate("RizoRuntimeQA.dungeonSummaryForQA()")["bestLabel"].startswith("ESCAPE"), (data["continuation"], page.evaluate("RizoRuntimeQA.dungeonSummaryForQA()")))
    shot(page, "escape-card")
    page.click("[data-dungeon-action='stay']")
    page.wait_for_timeout(250)
    check("STAY A WHILE: play goes on at the door; the goal is the promise", state(page)["ui"] == "play" and state(page)["objective"] == "COME BACK FOR THEM", (state(page)["ui"], state(page)["objective"]))
    page.reload()
    page.wait_for_timeout(1200)
    st = launch(page)
    check("the next launch resumes at the loading door, the card not replayed", st["sim"]["roomId"] == "factory" and abs(st["sim"]["player"]["y"] - 676) < 2 and st["panelKind"] != "boundary", (st["sim"]["roomId"], st["sim"]["player"], st["panelKind"]))
    check("no page errors on the factory floor", not errors, errors[:3])
    ctx.close()

    # ================= THE HANGING ROW: Nell's tin bell =================
    ctx, page, errors = boot(browser)
    goto(page, "hangrow", "hangrow-entry", {"latchFreed": True, "porterDown": True, "rowsLedge": True, "rowsCatch": True}, ["rows:arrived", "rows:met"])
    seen = []
    drive(page, lambda s: (seen.extend(b["text"] for b in s["barks"]) or any("tin bell" in t for t in seen)), 60, 400)
    check("Nell: “Or ring my tin bell on the post. He'll go and look.”", any("tin bell" in t for t in seen), seen[-4:])
    tp(page, 34, 300)
    page.wait_for_timeout(150)
    prompt = page.evaluate("document.querySelector('.dungeon-prompt')?.textContent||''")
    page.keyboard.press("z")
    page.wait_for_timeout(200)
    st = state(page)
    lamp = next(e for e in st["sim"]["enemies"] if e["id"] == "row-collector")
    check("RING: the collector turns to go and look at the bell", "RING" in prompt and lamp["state"] == "search", (prompt, lamp))
    check("and the voice on his radio: “That's a bell. Bells don't glow.”", said(st, "Bells don't glow."), st["barks"])
    check("no page errors in the Hanging Row", not errors, errors[:3])
    ctx.close()

    # ================= PHONES AND REDUCED MOTION =================
    for vp in [(320, 568), (375, 667), (430, 932)]:
        ctx, page, errors = boot(browser, vp, reduced=vp[0] == 320)
        goto(page, "intake", "intake-cage", {**ROWS_FLAGS, "windowOpen": True, "hallEscaped": True})
        drive(page, lambda s: s["scene"] is None, 120, 300)
        objective_lines = page.evaluate("(()=>{const o=document.querySelector('.dungeon-objective span');if(!o)return 0;const r=o.getBoundingClientRect();return Math.round(r.height/parseFloat(getComputedStyle(o).lineHeight||16))})()")
        label = page.evaluate("document.querySelector('[data-dungeon-key=\"primary\"] b')?.textContent||''")
        check(f"{vp[0]}×{vp[1]}: Intake fits (no page scroll), the key says RATTLE, the goal is readable", no_scroll(page) and label == "RATTLE" and objective_lines <= 2, (no_scroll(page), label, objective_lines))
        goto(page, "longhall", "hall-entry", {**ROWS_FLAGS, "windowOpen": True})
        page.keyboard.down("ArrowRight")
        page.wait_for_timeout(600)
        page.keyboard.up("ArrowRight")
        st = state(page)
        check(f"{vp[0]}×{vp[1]}: the chase answers the keys at once", st["sim"]["player"]["x"] > 60 and no_scroll(page), st["sim"]["player"])
        if vp[0] == 320:
            check("reduced motion is honoured in his building", page.evaluate("Boolean(document.querySelector('.dungeon-reduced-motion'))"))
        shot(page, f"escape-{vp[0]}x{vp[1]}")
        check(f"{vp[0]}×{vp[1]}: no page errors", not errors, errors[:3])
        ctx.close()
    browser.close()

server.shutdown()
if evidence:
    (evidence / "results.json").write_text(json.dumps(results, indent=2))
print(f"\n{sum(r['passed'] for r in results)}/{len(results)} escape checks passed", flush=True)
sys.exit(0 if all(r["passed"] for r in results) else 1)
