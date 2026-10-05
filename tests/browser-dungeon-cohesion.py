"""Dungeon presentation through real room exits and the complete Rows loop.

Keyboard movement crosses each door (no QA goto at a transition); WARM,
LOOK, choices and reload use the actual UI. The QA clock shortens authored
waits, teleports position work interactions, and enemies can be settled to
isolate traversal. This complements browser-dungeon.py's combat/save/story
coverage and browser-dungeon-controls.py's multitouch/safe-area coverage.
Screenshots are review evidence, not pixel-golden assertions. Chromium only.
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
artifact = tempfile.TemporaryDirectory(prefix="rizo-cohesion-")
directory = Path(args.directory).resolve() if args.directory else Path(artifact.name) / "site"
if not args.directory:
    subprocess.run([sys.executable, str(ROOT / "tools/build-site.py"), "--out", str(directory)], check=True, stdout=subprocess.DEVNULL)
evidence = Path(args.evidence).resolve() if args.evidence else None
if evidence:
    evidence.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "tools"))
from static_site import StaticSiteHandler
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(StaticSiteHandler, directory=str(directory)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_address[1]}/play"
ST = "RizoRuntimeQA.dungeonStateForQA()"
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
Object.assign(s.pet,{name:'MOSSY',stage:'kid',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,accessory:'scarf'});
s.inventory.accessories=['none','scarf'];s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"""
VIEWPORTS = [(320, 568), (375, 812), (390, 844), (430, 932), (844, 390), (568, 320)]
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
    page.wait_for_timeout(70)


def drive(page, pred, limit=180):
    for _ in range(limit):
        st = state(page)
        if pred(st):
            return st
        if st["dialogue"]:
            page.keyboard.press("z")
            page.wait_for_timeout(35)
        elif st["choice"]:
            raise AssertionError("Unexpected choice while driving a scene")
        else:
            clock(page, 300)
            page.wait_for_timeout(12)
    raise AssertionError(f"Scene did not reach its next beat: {state(page)}")


def warm(page, x, y):
    tp(page, x, y)
    check("work presents WARM at reach", "WARM" in page.locator(".dungeon-prompt").inner_text())
    page.keyboard.press("z")
    page.wait_for_timeout(160)


def launch(page):
    page.evaluate("RizoRuntimeQA.setViewForQA('go')")
    page.wait_for_timeout(220)
    page.locator('[data-mode="dungeon"]').click()
    page.wait_for_timeout(750)


def walk_exit(page, exit_id):
    origin = state(page)["sim"]["roomId"]
    g = page.evaluate("r=>RizoDungeonContent.ROOMS[r]", origin)
    ex = next(x for x in g["exits"] if x["id"] == exit_id)
    if ex["h"] > ex["w"]:
        west = ex["x"] < g["w"] / 2
        x, y, key = (26 if west else g["w"] - 26), ex["y"] + ex["h"] / 2, "a" if west else "d"
    else:
        north = ex["y"] < g["h"] / 2
        x, y, key = ex["x"] + ex["w"] / 2, (26 if north else g["h"] - 26), "w" if north else "s"
    tp(page, x, y)
    page.keyboard.down(key)
    try:
        page.wait_for_function("r=>RizoRuntimeQA.dungeonStateForQA().sim.roomId!==r", arg=origin, timeout=4000)
    finally:
        page.keyboard.up(key)
    page.wait_for_timeout(650)
    st = state(page)
    opacity = page.locator(".dungeon-fade").evaluate("e=>Number(getComputedStyle(e).opacity)")
    check(f"walk {origin} → {ex['to']}: destination and reveal survive its entrance scene", st["sim"]["roomId"] == ex["to"] and opacity < 0.05, {"room": st["sim"]["roomId"], "fade": opacity})
    shot(page, f"walk-{origin}-{ex['to']}")


def walk_to(page, x, y):
    # Walk the authored switchbacks rather than teleporting over their rails.
    for axis, goal, negative, positive in [("x", x, "a", "d"), ("y", y, "w", "s")]:
        start = state(page)["sim"]["player"][axis]
        if abs(start - goal) < 4:
            continue
        key = negative if goal < start else positive
        try:
            for _ in range(8):
                page.keyboard.down(key)
                page.wait_for_function("([axis,goal,sign])=>{const s=RizoRuntimeQA.dungeonStateForQA();return s.dialogue||(s.sim.player[axis]-goal)*sign>=-3}", arg=[axis, goal, 1 if goal > start else -1], timeout=5000)
                page.keyboard.up(key)
                if not state(page)["dialogue"]:
                    break
                # Nell's greeting deliberately pauses the first crossing.
                # Read it, then resume with a fresh movement press.
                while state(page)["dialogue"]:
                    page.keyboard.press("z")
                    page.wait_for_timeout(45)
        except Exception:
            shot(page, f"blocked-{state(page)['sim']['roomId']}-{x}-{y}-{axis}")
            print("Blocked traversal", (x, y, axis), state(page), flush=True)
            raise
        finally:
            page.keyboard.up(key)


def overlay_bounds(page):
    return page.evaluate("""()=>{const s=document.querySelector('.dungeon-screen').getBoundingClientRect();
    const bad=[];for(const selector of ['.dungeon-room-name','.dungeon-dialogue','.dungeon-portrait','.dungeon-prompt','.dungeon-bark','.dungeon-choice button','.dungeon-card-actions button']){
      for(const n of document.querySelectorAll(selector)){if(!n.getClientRects().length)continue;const r=n.getBoundingClientRect();
        if(r.left<s.left-1||r.right>s.right+1||r.top<s.top-1||r.bottom>s.bottom+1)bad.push(selector);
      }}const name=document.querySelector('.dungeon-room-name'),meter=document.querySelector('.dungeon-flame');
      if(name.textContent&&name.getBoundingClientRect().left<meter.getBoundingClientRect().right-1)bad.push('HUD overlap');
      return {bad,scroll:document.scrollingElement.scrollWidth>innerWidth+1||document.scrollingElement.scrollHeight>innerHeight+1,offset:scrollY};}""")


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, service_workers="block")
    page = ctx.new_page()
    errors, warnings = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda msg: warnings.append(msg.text) if msg.type == "warning" and "dungeon" in msg.text.lower() else None)
    page.goto(URL)
    page.wait_for_timeout(1000)
    page.evaluate(SETUP)
    launch(page)
    page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
    page.evaluate("RizoRuntimeQA.dungeonGotoForQA('porter','porter-entry',{porterDown:true,latchFreed:true,sharedRest:true,seatChosen:true})")
    page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
    walk_exit(page, "porter-to-rows")
    drive(page, lambda s: s["sim"]["flags"].get("ledgeReady"))
    tp(page, 160, 120)
    drive(page, lambda s: any("This bit's dry." in b["text"] for b in s["barks"]))
    shot(page, "nell-clears-space")
    warm(page, 236, 72)
    drive(page, lambda s: s["scene"] is None)
    walk_exit(page, "receiving-to-table")
    tp(page, 150, 60)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("catchReady"))
    shot(page, "nell-supports-table")
    warm(page, 200, 186)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("rowsCatch"))
    clock(page, 1400)
    walk_exit(page, "table-to-rows")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('row-draftling',{state:'gone'})")
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("lowReady"))
    warm(page, 278, 106)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("rowsLowRoute"))
    clock(page, 1200)
    walk_exit(page, "rows-to-lowrun")
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('low-needle',{state:'gone'})")
    for x, y in [(62, 160), (142, 160), (142, 68), (224, 68), (224, 178), (284, 190)]:
        walk_to(page, x, y)
    check("Low Run's worn route passes all three solid stacks", state(page)["sim"]["player"]["x"] > 278)
    walk_exit(page, "lowrun-to-eyelet")
    walk_to(page, 76, 230)
    walk_to(page, 76, 154)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("grilleReady"))
    shot(page, "nell-orr-at-grille")
    warm(page, 36, 130)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("rowsGrille"))
    walk_exit(page, "eyelet-to-tray")
    walk_exit(page, "tray-to-table")
    tp(page, 150, 210)
    drive(page, lambda s: s["choice"] is not None)
    page.locator('[data-choice-index="1"]').click()
    drive(page, lambda s: s["scene"] is None)
    walk_exit(page, "table-to-tray")
    walk_exit(page, "tray-to-eyelet")
    walk_exit(page, "eyelet-to-press")
    tp(page, 160, 400)
    drive(page, lambda s: s["scene"] is None and "rows:screen" in s["data"]["story"]["committedSceneBeats"])
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('press-needle',{state:'gone'})")
    tp(page, 160, 160)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("brakeReady"))
    shot(page, "press-stop")
    warm(page, 284, 196)
    tp(page, 160, 160)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("shutterReady"))
    warm(page, 196, 56)
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("rowsShutter"))
    walk_exit(page, "press-to-upper")
    drive(page, lambda s: s["scene"] is None and s["sim"]["flags"].get("rowsStair"))
    walk_exit(page, "upper-to-stair")
    for x, y in [(194, 154), (46, 154), (46, 278)]:
        walk_to(page, x, y)
    check("Return Stair is walkable around both rail ends", state(page)["sim"]["player"]["y"] > 272)
    walk_exit(page, "stair-to-table")
    tp(page, 150, 196)
    drive(page, lambda s: s["sim"]["flags"].get("boardReady") and not s["dialogue"])
    warm(page, 150, 188)
    drive(page, lambda s: s["sim"]["flags"].get("chalkOut"))
    tp(page, 196, 186)
    page.keyboard.press("z")
    page.wait_for_timeout(160)
    drive(page, lambda s: s["choice"] is not None)
    for w, h in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(160)
        metrics = overlay_bounds(page)
        check(f"{w}×{h}: all three wrap choices stay in the screen without page scroll", not metrics["bad"] and not metrics["scroll"], metrics)
        targets = page.locator(".dungeon-choice button").evaluate_all("ns=>ns.map(e=>e.getBoundingClientRect().height)")
        check(f"{w}×{h}: all wrap targets remain ≥44 px high", len(targets) == 3 and min(targets) >= 44, targets)
        shot(page, f"wrap-{w}x{h}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator('[data-choice-index="0"]').click()
    drive(page, lambda s: s["scene"] is None)
    before = state(page)["data"]["story"]
    check("the wrap is worn and the onward doorway is physically open", page.locator(".dungeon-wear-wrap").count() == 1 and state(page)["sim"]["flags"].get("rowsOnward"))
    page.reload()
    page.wait_for_timeout(1200)
    launch(page)
    after = state(page)["data"]["story"]
    check("reload retains Rows choices/facts and the worn wrap without replay", before["facts"] == after["facts"] and before["choices"] == after["choices"] and page.locator(".dungeon-wear-wrap").count() == 1 and state(page)["scene"] is None)
    walk_exit(page, "table-to-window")
    drive(page, lambda s: s["ui"] == "panel")
    for w, h in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(160)
        accessible = True
        for button in page.locator(".dungeon-card-actions button").all():
            button.scroll_into_view_if_needed()
            accessible &= button.evaluate("e=>{const r=e.getBoundingClientRect();return r.height>=44&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e}")
        check(f"{w}×{h}: boundary actions remain reachable", accessible)
        if (w, h) == (568, 320):
            panel = page.locator(".dungeon-panel")
            panel.evaluate("e=>e.scrollTop=0")
            bounds = panel.bounding_box()
            x, y = bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] - 30
            cdp = ctx.new_cdp_session(page)
            def touch(kind, ty):
                points = [] if kind == "touchEnd" else [{"id": 1, "x": x, "y": ty, "radiusX": 10, "radiusY": 10}]
                cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})
            touch("touchStart", y)
            page.wait_for_timeout(40)
            touch("touchMove", y - 60)
            page.wait_for_timeout(40)
            touch("touchMove", y - 120)
            page.wait_for_timeout(40)
            touch("touchEnd", y - 120)
            page.wait_for_timeout(100)
            scroll = panel.evaluate("e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})")
            check("short landscape: a real touch drag scrolls the card while the page stays locked", scroll["top"] > 60 and page.evaluate("scrollY") == 0, scroll)
            cdp.detach()
        shot(page, f"boundary-{w}x{h}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator('[data-dungeon-action="stay"]').click()
    walk_exit(page, "gate-to-table")
    check("the chapter returns through the same working doorway", state(page)["sim"]["roomId"] == "drytable")
    # A long actual inspect line must reserve its final size before it types.
    # This used to grow into Rizo after the initial one-character placement.
    for w, h in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(200)  # Let the orientation/resize input clear settle.
        page.evaluate("RizoRuntimeQA.dungeonGotoForQA('lowrun',null,{})")
        page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('low-needle',{state:'gone'})")
        tp(page, 140, 190)
        page.wait_for_function("RizoRuntimeQA.dungeonStateForQA().ui==='play' && document.querySelector('.dungeon-prompt').textContent.includes('LOOK')")
        page.keyboard.down("z")
        try:
            page.wait_for_function("Boolean(RizoRuntimeQA.dungeonStateForQA().dialogue)")
        finally:
            page.keyboard.up("z")
        initial = page.locator(".dungeon-dialogue").bounding_box()
        page.keyboard.down("z")
        try:
            page.wait_for_function("()=>{const d=RizoRuntimeQA.dungeonStateForQA().dialogue;return d&&d.shown===d.text.length}")
        finally:
            page.keyboard.up("z")
        final = page.locator(".dungeon-dialogue").bounding_box()
        check(f"{w}×{h}: typing a long line keeps its reserved height", initial and final and abs(initial["height"] - final["height"]) < 1, [initial, final])
        metrics = overlay_bounds(page)
        check(f"{w}×{h}: the full line stays inside the screen without scroll", not metrics["bad"] and not metrics["scroll"], metrics)
        shot(page, f"long-line-{w}x{h}")
        page.keyboard.press("z")
    # Goto is only for the visual inventory; the story loop uses real exits.
    flags = {"latchFreed": True, "sharedRest": True, "seatChosen": True, "porterDown": True, "porterHelp": True,
             "alcoveOpen": True, "shortcutOpen": True, "rowsCatch": True, "rowsLowRoute": True, "rowsGrille": True,
             "rowsPressOpen": True, "rowsShutter": True, "rowsStair": True, "rowsOnward": True}
    rooms = page.evaluate("RizoDungeonContent.BUILT_ROOMS")
    for w, h in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        bad = []
        for room in rooms:
            page.evaluate("([r,f])=>RizoRuntimeQA.dungeonGotoForQA(r,null,f)", [room, flags])
            page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
            page.wait_for_timeout(120)
            metrics = overlay_bounds(page)
            if metrics["bad"] or metrics["scroll"] or metrics["offset"]:
                bad.append([room, metrics])
            shot(page, f"room-{w}x{h}-{room}")
        check(f"{w}×{h}: all 21 rooms keep text inside the screen and the page locked", not bad, bad)
    check("the complete door-driven Rows loop has no runtime/scenery errors", not errors and not warnings, errors + warnings)
    ctx.close()
    ctx = browser.new_context(viewport={"width": 320, "height": 568}, has_touch=True, service_workers="block", reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_timeout(1000)
    page.evaluate(SETUP.replace("RizoRuntimeQA.loadForQA(s)", "s.settings.reducedMotion=true;RizoRuntimeQA.loadForQA(s)"))
    launch(page)
    page.evaluate("RizoRuntimeQA.dungeonGotoForQA('sack',null,{})")
    clock(page, 7000)
    page.wait_for_timeout(80)
    hint = page.locator(".dungeon-dpad").evaluate("e=>({hinted:e.classList.contains('is-hinted'),animated:getComputedStyle(e.querySelector('.arm')).animationName})")
    check("reduced motion still presents the movement affordance, without a pulse", hint["hinted"] and hint["animated"] == "none", hint)
    ctx.close()
    browser.close()

server.shutdown()
if evidence:
    (evidence / "results.json").write_text(json.dumps(results, indent=2))
print(f"\n{sum(r['passed'] for r in results)}/{len(results)} cohesion checks passed", flush=True)
sys.exit(0 if all(r["passed"] for r in results) else 1)
