"""Dungeon game feel, clarity and testability.

Covers the phone's own text gestures (the iOS "Create Link" / edit-menu bug):
every touch on the game is cancelled at touchstart (pad, keys, screen, HUD,
dialogue), a selection that still appears is cleared at once, selectstart on a
Text node is refused, the context menu stays shut, images cannot be lifted,
and panel and choice buttons keep their native touch; the Hub is untouched
after GO HOME. Then RESTART DUNGEON: asked first (keeping the journey is the
focused answer, MENU backs out), and when confirmed only the Dungeon journey
restarts from the car, the rest of the save (pet, Home, wallet, wardrobe,
receipts, story marks, Defense, settings) byte-for-byte unchanged, it reloads
there, a refused save restarts nothing, and a completed journey can start over
too. Then the feel fixes from playing it through. Chromium only: iOS Safari's
own gesture recognisers cannot run here, so what is asserted is that the page
cancels every touch the OS would otherwise act on.
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
artifact = tempfile.TemporaryDirectory(prefix="rizo-gamefeel-")
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
STORED = "(()=>{const v=JSON.parse(localStorage.getItem('rizo-save-v2')||'null');return v?{state:v.state,modes:v.modes,writeId:v.writeId}:null})()"
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,bond:40,accessory:'scarf'});
s.pet.skills={speed:20,power:30,instinct:10,stamina:25,luck:5};
s.inventory.accessories=['none','scarf'];s.collection.classic=1;s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return s.pet.id;}"""
VIEWPORTS = [(320, 568), (375, 812), (390, 844), (430, 932), (844, 390)]
results = []


def check(name, passed, detail=None):
    results.append({"name": name, "passed": bool(passed), "detail": detail if not passed else None})
    print(("PASS" if passed else "FAIL"), name, "" if passed else detail, flush=True)


# Paths that change on every save by design (time bookkeeping), never content.
CLOCK_PATHS = {".pet.lastTick", ".player.lastActive"}


def diff(a, b, path=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for key in sorted(set(a) | set(b)):
            out += diff(a.get(key, "<missing>"), b.get(key, "<missing>"), f"{path}.{key}")
        return out
    return [] if a == b else [path]


class Phone:
    """A mobile page whose touches are real CDP touch events."""

    def __init__(self, browser, viewport=(390, 844), seed=True):
        self.ctx = browser.new_context(service_workers="block", viewport={"width": viewport[0], "height": viewport[1]}, has_touch=True, is_mobile=True, device_scale_factor=2)
        self.ctx.add_init_script("(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.clear();})()")
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(URL)
        self.page.wait_for_timeout(1200)
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.viewport = viewport
        self.pet_id = self.page.evaluate(SETUP) if seed else None

    def ev(self, js, arg=None):
        return self.page.evaluate(js, arg) if arg is not None else self.page.evaluate(js)

    def wait(self, ms):
        self.page.wait_for_timeout(ms)

    def st(self):
        return self.ev(ST)

    def launch(self):
        self.ev("RizoRuntimeQA.setViewForQA('arcade')")
        self.wait(250)
        self.ev("document.querySelector('[data-mode=\"dungeon\"]').click()")
        self.wait(900)
        return self.st()

    def touch(self, kind, points):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i, "radiusX": 12, "radiusY": 12, "force": 1} for i, (x, y) in points.items()]})

    def center(self, selector):
        return self.ev("(s)=>{const e=document.querySelector(s);if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]}", selector)

    def tap(self, selector, hold=60):
        c = self.center(selector)
        if not c:
            return False
        self.touch("touchStart", {0: tuple(c)})
        self.wait(hold)
        self.touch("touchEnd", {0: tuple(c)})
        self.wait(160)
        return True

    def spy(self):
        self.ev("""(()=>{window.__spy={touch:[],menu:0};
          window.addEventListener('touchstart',e=>__spy.touch.push({t:(e.target.className&&typeof e.target.className==='string'?e.target.className:e.target.tagName).slice(0,40),prevented:e.defaultPrevented}),{passive:false});
          window.addEventListener('contextmenu',e=>{if(!e.defaultPrevented)__spy.menu+=1});})()""")

    def touches(self):
        return self.ev("window.__spy.touch")

    def close(self):
        self.ctx.close()


def selection_now(phone):
    return phone.ev("({type:getSelection().type,text:String(getSelection())})")


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ================= THE PHONE'S OWN TEXT GESTURES (the "Create Link" bug) =================
    for vp in VIEWPORTS:
        tag = f"{vp[0]}×{vp[1]}"
        ph = Phone(browser, vp)
        ph.launch()
        ph.spy()
        dx, dy = ph.center(".dungeon-dpad")
        size = ph.ev("document.querySelector('.dungeon-dpad').getBoundingClientRect().width")
        arm = size * 0.32
        # Hammer the pad: quick taps on every arm, then held thumbs that slide.
        for i in range(32):
            ox, oy = [(-arm, 0), (arm, 0), (0, -arm), (0, arm)][i % 4]
            ph.touch("touchStart", {0: (dx + ox, dy + oy)})
            ph.wait(25)
            ph.touch("touchEnd", {0: (dx + ox, dy + oy)})
            ph.wait(30)
        ph.touch("touchStart", {0: (dx + arm, dy)})
        ph.wait(900)
        ph.touch("touchMove", {0: (dx + arm * 0.8, dy - arm * 0.6)})
        ph.wait(500)
        ph.touch("touchEnd", {0: (dx + arm * 0.8, dy - arm * 0.6)})
        # A thumb that lands just off the pad, on the deck.
        ph.touch("touchStart", {0: (dx + size * 0.62, dy + size * 0.4)})
        ph.wait(700)
        ph.touch("touchEnd", {0: (dx + size * 0.62, dy + size * 0.4)})
        for sel in [".dungeon-key-primary", ".dungeon-key-secondary", ".dungeon-hud", ".dungeon-flame", ".dungeon-room-name", ".dungeon-screen"]:
            ph.tap(sel, hold=600)
        touches = ph.touches()
        open_touches = [t for t in touches if not t["prevented"]]
        check(f"{tag}: every touch on the pad, keys, HUD and screen is the game's (touchstart cancelled: no OS selection, loupe or edit menu)",
              len(touches) >= 40 and not open_touches, (len(touches), open_touches[:4]))
        check(f"{tag}: hammering the pad leaves no selection and opens no context menu",
              selection_now(ph)["type"] != "Range" and ph.ev("window.__spy.menu") == 0, (selection_now(ph), ph.ev("window.__spy.menu")))
        # The menu cards fit the screen: RESTART DUNGEON is never pushed off its edge.
        FITS = "(()=>{const p=document.querySelector('.dungeon-panel'),b=[...p.querySelectorAll('.dungeon-card-actions button')];return {kind:RizoRuntimeQA.dungeonStateForQA().panelKind,fits:p.scrollHeight<=p.clientHeight+1,buttons:Math.min(...b.map(x=>x.getBoundingClientRect().height))}})()"
        ph.page.keyboard.press("Escape")
        ph.wait(200)
        fits = [ph.ev(FITS)]
        ph.ev("document.querySelector('[data-dungeon-action=\"restart-ask\"]').click()")
        ph.wait(150)
        fits.append(ph.ev(FITS))
        ph.ev("document.querySelector('[data-dungeon-action=\"restart-cancel\"]').click()")
        ph.wait(100)
        ph.ev("document.querySelector('[data-dungeon-action=\"resume\"]').click()")
        ph.wait(150)
        check(f"{tag}: the pause and restart cards fit the screen, answers still finger-sized",
              [f["kind"] for f in fits] == ["pause", "restart"] and all(f["fits"] and f["buttons"] >= 44 for f in fits) and ph.st()["panelKind"] == "", fits)
        if vp == (390, 844):
            # The dialogue box (a tap there is NEXT) is the game's as well.
            ph.ev("RizoRuntimeQA.dungeonTeleportForQA(190,250)")
            ph.page.keyboard.down("ArrowLeft"); ph.wait(260); ph.page.keyboard.up("ArrowLeft"); ph.wait(150)
            if ph.st()["ui"] != "dialogue":
                ph.wait(4500)
                ph.ev("RizoRuntimeQA.dungeonTeleportForQA(190,250)")
                ph.page.keyboard.down("ArrowLeft"); ph.wait(260); ph.page.keyboard.up("ArrowLeft"); ph.wait(150)
            before = len(ph.touches())
            had_line = ph.st()["ui"] == "dialogue"
            ph.tap(".dungeon-dialogue", hold=500)
            after = ph.touches()[before:]
            check("the dialogue box: a long tap is NEXT and still no OS gesture", had_line and after and all(t["prevented"] for t in after) and ph.st()["dialogue"] is None, (had_line, after, ph.st()["dialogue"]))
            # A selection made anyway (an OS path nobody foresaw) is cleared at once.
            ph.ev("(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('.dungeon-room-name'));getSelection().removeAllRanges();getSelection().addRange(r);})()")
            ph.wait(120)
            check("a selection that appears anyway is cleared at once (its edit menu goes with it)", selection_now(ph)["type"] != "Range", selection_now(ph))
            refused = ph.ev("(()=>{const n=document.querySelector('.dungeon-room-name').firstChild;const e=new Event('selectstart',{bubbles:true,cancelable:true});n.dispatchEvent(e);return n.nodeType===3&&e.defaultPrevented})()")
            check("selectstart fired at a Text node (how WebKit fires it) is refused", refused)
            menu = ph.ev("(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('.dungeon-flame').dispatchEvent(e);return e.defaultPrevented})()")
            styles = ph.ev("({root:getComputedStyle(document.documentElement).webkitUserSelect,callout:getComputedStyle(document.documentElement).webkitTouchCallout||'none',drag:getComputedStyle(document.querySelector('.dungeon-pose img')).webkitUserDrag})")
            check("the context menu stays shut; the page root is unselectable and the Rizo's image cannot be lifted", menu and styles["root"] == "none" and styles["drag"] == "none", (menu, styles))
            # Panel buttons keep their native touch (they answer to click).
            ph.tap(".dungeon-key-system")
            before = len(ph.touches())
            opened = ph.st()["panelKind"] == "pause"
            ph.tap('[data-dungeon-action="resume"]')
            panel_touch = ph.touches()[before:]
            check("panel buttons keep their native touch: RESUME by finger works", opened and ph.st()["ui"] != "panel" and panel_touch and not any(t["prevented"] for t in panel_touch), (opened, ph.st()["ui"], panel_touch))
            # GO HOME releases everything: the Hub's own touches are its own again.
            ph.tap(".dungeon-key-system")
            ph.tap('[data-dungeon-action="home"]')
            ph.wait(1200)
            hub = ph.ev("(()=>{const e=new Event('selectstart',{bubbles:true,cancelable:true});document.body.dispatchEvent(e);const t=new Event('touchstart',{bubbles:true,cancelable:true});document.body.dispatchEvent(t);return {locked:document.documentElement.classList.contains('dungeon-locked'),select:e.defaultPrevented,touch:t.defaultPrevented,root:getComputedStyle(document.documentElement).webkitUserSelect}})()")
            check("after GO HOME the Hub is untouched: no lock, its selection and touches are its own", not hub["locked"] and not hub["select"] and not hub["touch"] and hub["root"] != "none", hub)
        check(f"{tag}: no page errors", not ph.errors, ph.errors[:3])
        ph.close()

    # A choice keeps its native touch (SIT / GO by finger).
    ph = Phone(browser, (390, 844))
    ph.launch()
    for _ in range(3):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    ph.ev("RizoRuntimeQA.dungeonGotoForQA('hearth','hearth-west',{latchFreed:true})")
    ph.wait(500)
    ph.ev("RizoRuntimeQA.dungeonTeleportForQA(150,200)")
    ph.page.keyboard.down("ArrowRight"); ph.wait(120); ph.page.keyboard.up("ArrowRight")
    for _ in range(40):
        st = ph.st()
        if st["ui"] == "choice":
            break
        if st["ui"] == "dialogue":
            ph.page.keyboard.press("z")
        ph.wait(150)
    ph.spy()
    choice_up = ph.st()["ui"] == "choice"
    ph.tap('.dungeon-choice [data-choice-index="1"]')
    picked = ph.st()["data"]["story"]["choices"].get("hearth-seat")
    check("choice buttons keep their native touch: GO by finger is picked", choice_up and picked == "go" and not any(t["prevented"] for t in ph.touches()), (choice_up, picked, ph.touches()))
    ph.close()

    # ================= RESTART DUNGEON =================
    ph = Phone(browser, (390, 844))
    ph.launch()
    for _ in range(3):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    # Deep in: below, Latch freed, the hearth, the knot and its mark earned, the Rows.
    ph.ev("RizoRuntimeQA.dungeonGotoForQA('hearth',null,{latchFreed:true,hearthArrived:true,seatChosen:true})")
    ph.wait(300)
    for _ in range(4):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    fixture = ph.ev("RizoRuntimeQA.dungeonCompleteFixtureForQA({sharedRest:true})")
    ph.ev("RizoRuntimeQA.dungeonGotoForQA('drytable',null,{porterDown:true,porterHelp:true})")
    ph.wait(400)
    for _ in range(6):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    old = ph.st()["data"]
    before = ph.ev(STORED)
    check("(fixture) a deep journey: below, the Rows, the knot, its mark and receipt",
          fixture["status"] == "committed" and old["proofComplete"] and "opening:below" in old["story"]["committedSceneBeats"] and "first-knot" in before["state"]["inventory"]["accessories"],
          (fixture, old["story"]["committedSceneBeats"][:4]))
    ph.tap(".dungeon-key-system")
    tool = ph.ev("(()=>{const b=document.querySelector('.dungeon-card-tools [data-dungeon-action=\"restart-ask\"]');const r=document.querySelector('[data-dungeon-action=\"resume\"]');return b?{text:b.textContent,disabled:b.disabled,below:b.getBoundingClientRect().top>r.getBoundingClientRect().bottom,h:b.getBoundingClientRect().height}:null})()")
    check("MENU offers RESTART DUNGEON, set apart below RESUME and GO HOME, finger-sized", tool and tool["text"] == "RESTART DUNGEON" and not tool["disabled"] and tool["below"] and tool["h"] >= 44, tool)
    ph.tap('[data-dungeon-action="restart-ask"]')
    st = ph.st()
    card = ph.ev("document.querySelector('.dungeon-panel').innerText")
    focus = ph.ev("document.activeElement.dataset.dungeonAction")
    check("it asks first; KEEP MY JOURNEY is the focused answer and the card says what stays", st["panelKind"] == "restart" and focus == "restart-cancel" and "KEEP MY JOURNEY" in card and "Embers" in card and "wardrobe" in card, (st["panelKind"], focus, card[:160]))
    ph.tap('[data-dungeon-action="restart-cancel"]')
    st = ph.st()
    kept = [p for p in diff(before, ph.ev(STORED)) if p not in {".state.pet.lastTick", ".state.player.lastActive", ".writeId"}]
    check("KEEP MY JOURNEY changes nothing and returns to the pause menu", st["panelKind"] == "pause" and st["data"] == old and not kept, (st["panelKind"], kept[:6]))
    ph.tap('[data-dungeon-action="restart-ask"]')
    ph.tap(".dungeon-key-system")
    check("MENU on the question is also “keep my journey”", ph.st()["panelKind"] == "pause" and ph.st()["data"] == old)
    ph.tap('[data-dungeon-action="restart-ask"]')
    ph.tap('[data-dungeon-action="restart"]')
    ph.wait(200)
    st = ph.st()
    data = st["data"]
    after = ph.ev(STORED)
    check("confirmed: back in the parked car, the opening fading in from black, silent, shell open, no panel",
          st["sim"]["roomId"] == "car" and st["scene"]["id"] == "opening:parked" and st["panelKind"] == "" and not st["holds"] and st["shell"] == "open" and st["music"] == "dungeon-silence" and st["fade"] > 0.5,
          (st["sim"]["roomId"], st["scene"], st["panelKind"], st["holds"], st["shell"], st["music"], st["fade"]))
    check("a new campaign for the same Rizo: story, rooms, Latch, hearths, journal and completion all fresh",
          data["campaign"]["id"] != old["campaign"]["id"] and data["campaign"]["petId"] == old["campaign"]["petId"] and data["campaign"]["status"] == "active"
          and data["world"] == {"visitedRooms": ["car"], "openedShortcuts": [], "durableRoomFlags": {}, "defeatedEncounters": []}
          and data["story"] == {"facts": {}, "choices": {}, "committedSceneBeats": [], "resumeScene": None}
          and data["npcs"]["latch"]["state"] == "unmet" and data["checkpoint"]["hearthId"] is None and data["journal"]["discoveredEntryIds"] == []
          and not data["proofComplete"] and data["continuation"]["roomId"] == "car",
          {k: data[k] for k in ("campaign", "world", "story", "checkpoint", "proofComplete")})
    check("the player's Dungeon settings are kept", data["settings"] == old["settings"], (data["settings"], old["settings"]))
    state_diff = [p for p in diff(before["state"], after["state"]) if p not in CLOCK_PATHS]
    modes_diff = diff({k: v for k, v in before["modes"].items() if k != "dungeon"}, {k: v for k, v in after["modes"].items() if k != "dungeon"})
    check("nothing else in the save changes: pet, Home, wallet, training, wardrobe, receipts, story marks, other modes",
          not state_diff and not modes_diff, (state_diff[:8], modes_diff[:4]))
    check("what was earned stays earned: the First Knot, the shared-hearth mark and the old receipt",
          "first-knot" in after["state"]["inventory"]["accessories"] and any(m["id"] == "shared-hearth" for m in after["state"]["pet"]["storyMarks"]) and f'{old["campaign"]["id"]}:threshold-complete' in after["state"]["modeReceipts"]["dungeon"],
          after["state"]["pet"]["storyMarks"])
    check("the stored journey is exactly the one being played", after["modes"]["dungeon"]["data"] == data)
    ph.wait(4600)
    st = ph.st()
    check("the opening plays from the start: control in the parked car with YOU beside him", st["ui"] == "play" and st["scene"]["id"] == "opening:parked" and any(n["id"] == "you-seat" for n in st["npcs"]), (st["ui"], st["scene"], st["npcs"]))
    summary = ph.ev("RizoRuntimeQA.dungeonSummaryForQA()")
    check("the shelf reads OUTSIDE again, no badge", summary["bestLabel"] == "OUTSIDE" and summary["badge"] is None, summary)
    # Reload: it resumes there, fresh.
    ph.page.reload()
    ph.wait(1500)
    st = ph.launch()
    check("after a reload it resumes in the car on the new journey (nothing old comes back)",
          st["sim"]["roomId"] == "car" and st["data"]["campaign"]["id"] == data["campaign"]["id"] and st["data"]["story"]["committedSceneBeats"] == [], (st["sim"]["roomId"], st["data"]["story"]))
    # A refused save restarts nothing.
    ph.tap(".dungeon-key-system")
    ph.tap('[data-dungeon-action="restart-ask"]')
    ph.ev("(()=>{const v=JSON.parse(localStorage.getItem('rizo-save-v2'));v.writeId='W-OTHER-TAB';localStorage.setItem('rizo-save-v2',JSON.stringify(v))})()")
    current = ph.st()["data"]
    ph.tap('[data-dungeon-action="restart"]')
    st = ph.st()
    card = ph.ev("document.querySelector('.dungeon-panel').innerText")
    check("a refused save restarts nothing: it says so, the journey and the other tab's save are untouched",
          st["panelKind"] == "restart-failed" and "COULDN'T RESTART" in card and st["data"] == current and json.loads(ph.ev("localStorage.getItem('rizo-save-v2')"))["writeId"] == "W-OTHER-TAB",
          (st["panelKind"], card[:120]))
    # The hub's own "open somewhere else" notice now covers the screen; BACK is pressed for it.
    ph.ev("document.querySelector('[data-dungeon-action=\"restart-cancel\"]').click()")
    ph.wait(150)
    restart_disabled = ph.ev("document.querySelector('[data-dungeon-action=\"restart-ask\"]')?.disabled")
    check("while this tab is not saving, RESTART DUNGEON waits (disabled) like RESUME", ph.st()["panelKind"] == "pause" and restart_disabled is True, (ph.st()["panelKind"], restart_disabled))
    check("no page errors around restarting", not ph.errors, ph.errors[:3])
    ph.close()

    # A journey that came home (proof edition) can start over from its panel.
    ph = Phone(browser, (390, 844))
    ph.launch()
    for _ in range(3):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    ph.ev("RizoRuntimeQA.dungeonGotoForQA('porter',null,{latchFreed:true})")
    ph.wait(300)
    ph.ev("RizoRuntimeQA.dungeonCompleteFixtureForQA({})")
    ph.ev("RizoRuntimeQA.dungeonProofHomeForQA()")
    ph.tap(".dungeon-key-system")
    ph.tap('[data-dungeon-action="home"]')
    ph.wait(1200)
    st = ph.launch()
    panel = ph.ev("document.querySelector('.dungeon-panel').innerText")
    has_tool = ph.ev("Boolean(document.querySelector('.dungeon-card-tools [data-dungeon-action=\"restart-ask\"]'))")
    check("a journey that reached home offers RESTART DUNGEON beside GO THROUGH THE DOOR", st["ui"] == "blocked" and "REACHED HOME" in panel and has_tool, (st["ui"], panel[:100]))
    ph.tap('[data-dungeon-action="restart-ask"]')
    ph.tap('[data-dungeon-action="restart-cancel"]')
    back = ph.ev("document.querySelector('.dungeon-panel').innerText")
    check("keeping it returns to that same panel", "REACHED HOME" in back and ph.st()["ui"] == "blocked", back[:80])
    ph.tap('[data-dungeon-action="restart-ask"]')
    ph.tap('[data-dungeon-action="restart"]')
    ph.wait(200)
    st = ph.st()
    check("restarting it begins the opening in the car, journey active again",
          st["ui"] in ("scene", "play") and st["sim"]["roomId"] == "car" and st["data"]["campaign"]["status"] == "active" and not st["data"]["proofComplete"], (st["ui"], st["sim"]["roomId"], st["data"]["campaign"]))
    check("no page errors restarting a completed journey", not ph.errors, ph.errors[:3])
    ph.close()

    # ================= FEEL: what playing it through turned up =================
    # The Shared Hearth, walked into from the Hem door the way a player arrives.
    for vp in [(390, 844), (320, 568), (844, 390)]:
        tag = f"{vp[0]}×{vp[1]}"
        ph = Phone(browser, vp)
        ph.launch()
        for _ in range(3):
            ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
            ph.wait(80)
        ph.ev("RizoRuntimeQA.dungeonGotoForQA('hem','hem-east',{latchFreed:true})")
        ph.wait(400)
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        # Through the Hem's east door; the hand-off takes the key, so press again inside.
        ph.page.keyboard.down("ArrowRight")
        for _ in range(80):
            if ph.st()["sim"]["roomId"] == "hearth":
                break
            ph.wait(50)
        ph.page.keyboard.up("ArrowRight")
        for _ in range(40):
            if ph.st()["ui"] == "play":
                break
            ph.wait(50)
        ph.page.keyboard.down("ArrowRight")
        for _ in range(60):
            st = ph.st()
            if st["dialogue"]:
                break
            ph.wait(40)
        ph.page.keyboard.up("ArrowRight")
        banner_under_line = ph.ev("!document.querySelector('.dungeon-banner').hidden")
        stored = ph.ev(STORED)["modes"]["dungeon"]["data"]
        if vp == (390, 844):
            check("arriving at the hearth: it registers at once, but its banner does not play under Latch's line",
                  st["dialogue"] and st["dialogue"]["text"] == "Cold since they took our fire. You lit it just walking in." and stored["checkpoint"]["hearthId"] == "threshold-hearth" and not banner_under_line,
                  (st["dialogue"], stored["checkpoint"], banner_under_line))
        for _ in range(40):
            st = ph.st()
            if st["ui"] == "choice":
                break
            if st["dialogue"] and st["dialogue"]["shown"] >= len(st["dialogue"]["text"]):
                ph.page.keyboard.press("z")
            ph.wait(120)
        layout = ph.ev("""(()=>{const c=document.querySelector('.dungeon-choice'),line=c.querySelector('.dungeon-choice-line'),s=document.querySelector('.dungeon-screen').getBoundingClientRect(),hud=document.querySelector('.dungeon-hud').getBoundingClientRect();
          const r=c.getBoundingClientRect(),b=[...c.querySelectorAll('button')].map(x=>x.getBoundingClientRect());
          return {line:line?line.innerText.replace(/\\n+/g,' | '):null,label:c.getAttribute('aria-label'),inside:r.top>=s.top-1&&r.bottom<=s.bottom+1&&r.left>=s.left-1&&r.right<=s.right+1,
            clearOfHud:r.top>=hud.bottom,buttonsBelow:line?b.every(x=>x.top>=line.getBoundingClientRect().bottom-1):false,dialogue:!document.querySelector('.dungeon-dialogue').hidden,minH:Math.min(...b.map(x=>x.height))}})()""")
        check(f"{tag}: SIT / GO keeps Latch's question with it (“Seat's dry.”), inside the screen, buttons under it, finger-sized",
              st["ui"] == "choice" and st["choice"]["line"] == "Seat's dry." and layout["line"] == "LATCH | Seat's dry." and layout["label"] == "LATCH: Seat's dry."
              and layout["inside"] and layout["clearOfHud"] and layout["buttonsBelow"] and not layout["dialogue"] and layout["minH"] >= 44,
              (st["ui"], st["choice"], layout))
        if vp == (390, 844):
            ph.page.keyboard.press("ArrowRight")
            ph.wait(120)
            moved = ph.ev("document.querySelector('.dungeon-choice-line')?.innerText||''")
            check("moving between answers keeps the question in place", ph.st()["choice"]["index"] == 1 and "Seat's dry." in moved, (ph.st()["choice"], moved))
            ph.page.keyboard.press("ArrowLeft")
            ph.wait(120)
            waiting = ph.ev("(()=>({ui:RizoRuntimeQA.dungeonStateForQA().ui,banner:!document.querySelector('.dungeon-banner').hidden}))()")
            check("while SIT / GO waits, the banner still waits too", waiting["ui"] == "choice" and not waiting["banner"], waiting)
            start = ph.st()["sim"]["player"]
            ph.page.keyboard.press("z")
            samples = []
            SAMPLE = "(()=>{const s=RizoRuntimeQA.dungeonStateForQA(),b=document.querySelector('.dungeon-banner');return {t:s.sceneTime,x:s.sim.player.x,ui:s.ui,moving:document.querySelector('.dungeon-pose').className.includes('is-moving'),banner:b.hidden?'':b.textContent}})()"
            for _ in range(30):
                samples.append(ph.ev(SAMPLE))
                s = {"sim": {"player": {"x": samples[-1]["x"]}}}
                if abs(s["sim"]["player"]["x"] - 156) < 0.5 and samples[-1]["t"] - samples[0]["t"] > 200:
                    break
                ph.wait(60)
            walk_ms = samples[-1]["t"] - samples[0]["t"]
            dist = ((156 - start["x"]) ** 2 + (200 - start["y"]) ** 2) ** 0.5
            check("SIT: he walks to the bench at about his own pace (walking pose), not a glide across the room",
                  dist > 60 and walk_ms >= dist / 90 * 1000 * 0.8 and any(s["moving"] for s in samples[1:-1]) and abs(samples[-1]["x"] - 156) < 1,
                  (round(dist), walk_ms, [s["moving"] for s in samples][:6]))
            shown = [s for s in samples if s["banner"]]
            check("the hearth's banner plays once the line and choice have closed (on the walk to the seat)", shown and shown[0]["banner"] == "THE HEARTH KNOWS YOU NOW" and shown[0]["ui"] == "scene", samples[:4])
            ph.wait(1800)
            check("SIT still settles him on the bench beside Latch", abs(ph.st()["sim"]["player"]["x"] - 156) < 2)
        check(f"{tag}: no page errors at the hearth", not ph.errors, ph.errors[:3])
        ph.close()

    # The wrap: Nell's question stays with WEAR IT / FOLDED / LEAVE IT.
    ph = Phone(browser, (390, 844))
    ph.launch()
    for _ in range(3):
        ph.ev("RizoRuntimeQA.dungeonSkipSceneForQA()")
        ph.wait(80)
    data = ph.st()["data"]
    beats = ["opening:left", "opening:taken", "opening:fell", "opening:below", "latch-rescue:freed", "hearth-seat:sit", "knot-gift:granted", "rows:arrived", "rows:met", "rows:split", "rows:eyelet", "rows:orr", "rows:meal", "rows:screen", "rows:upper"]
    data["story"]["committedSceneBeats"] = beats
    data["story"]["facts"].update({"latchFreed": True, "seatChosen": True, "sharedRest": True, "porterHelp": True})
    data["story"]["choices"] = {"hearth-seat": "sit", "rows-meal": "sit"}
    data["world"]["durableRoomFlags"] = {"latchFreed": True, "porterDown": True, "rowsCatch": True, "rowsLowRoute": True, "rowsGrille": True, "rowsPressOpen": True, "rowsPressStop": True, "rowsBrake": True, "rowsShutter": True, "rowsStair": True}
    data["world"]["visitedRooms"] = ["car", "sack", "van", "roadside", "drain", "slip", "clatter", "hem", "hearth", "queue", "porter", "receiving", "drytable", "hangrow", "lowrun", "eyelet", "traypass", "press", "upper", "stair"]
    data["proofComplete"] = True
    data["campaign"]["status"] = "homecoming-ready"
    data["continuation"] = {"roomId": "drytable", "safeAnchorId": "drytable-stair", "roomEntryFlame": 5, "resumeKind": "room-entry"}
    # Seeded through the hub with the Dungeon closed (a running journey saves itself on the way out).
    committed = ph.ev("(d)=>{const s=RizoRuntimeQA.snapshot();s.qaModes.dungeon={schema:1,data:d};RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return {status:RizoRuntimeQA.modeSliceForQA('dungeon').data.story.committedSceneBeats.includes('rows:upper')?'committed':'missing'}}", data)
    ph.wait(600)
    ph.launch()
    st = ph.st()
    for _ in range(200):
        st = ph.st()
        if st["ui"] == "choice":
            break
        if st["dialogue"] and st["dialogue"]["shown"] >= len(st["dialogue"]["text"]):
            ph.page.keyboard.press("z")
        elif st["ui"] == "play":
            ph.ev("RizoRuntimeQA.dungeonSceneTimeForQA(600)")
        ph.wait(60)
    line = ph.ev("document.querySelector('.dungeon-choice-line')?.innerText.replace(/\\n+/g,' | ')||''")
    check("the wrap's three answers keep Nell's question with them (“Wear it, or take it folded.”)",
          committed["status"] == "committed" and st["ui"] == "choice" and st["choice"]["options"] == ["worn", "folded", "peg"] and line == "NELL | Wear it, or take it folded.", (committed, st["ui"], st["choice"], line))
    ph.page.keyboard.press("z")
    ph.wait(300)
    check("picking still commits the choice and closes the question with it", ph.st()["data"]["story"]["choices"].get("rows-wrap") == "worn" and ph.ev("document.querySelector('.dungeon-choice').hidden"))
    # The meal's SIT / GO is asked by the table itself (the food set down): no line is borrowed for it.
    check("no page errors in the Rows", not ph.errors, ph.errors[:3])
    ph.close()

    browser.close()

server.shutdown()
if evidence:
    (evidence / "results.json").write_text(json.dumps(results, indent=2))
print(f"\n{sum(r['passed'] for r in results)}/{len(results)} game-feel checks passed", flush=True)
sys.exit(0 if all(r["passed"] for r in results) else 1)
