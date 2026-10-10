"""Rizo Dungeon controls, played the way a phone plays them (real Chromium,
real touch events through the DevTools protocol, over HTTP, mobile viewport).

Covers the phone-native control pass: the page never scrolls, zooms or
selects; the D-pad holds a direction and keeps it near a diagonal; one thumb
owns the pad; a release is honoured wherever it lands and a lost release can
never leave movement stuck; touch cancel, backgrounding, rotation and dialogue
do not leave phantom input; a finger on the pad wakes after a dialogue by
sliding; a tap on the dialogue box is NEXT; the keys stay inside the safe
areas, reachable and unblocked, at 320x568, 375x812, 390x844, 430x932 and
844x390; and the keyboard and mouse behave as before.

Chromium only. This is not Safari or physical-phone evidence: iOS's own
rubber-band, edge-swipe and double-tap-zoom behaviour cannot be exercised
here, so the page's declarations for them (touch-action, overscroll, user-select,
safe-area padding) are asserted instead.
"""
import argparse, functools, http.server, json, random, socketserver, subprocess, sys, threading, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory')
parser.add_argument('--fuzz-seeds', default='101,102,103')
args = parser.parse_args()
if args.directory:
    directory = Path(args.directory).resolve()
else:
    _artifact = tempfile.TemporaryDirectory(prefix='rizo-dungeon-controls-')
    directory = Path(_artifact.name) / 'site'
    subprocess.run([sys.executable, str(ROOT / 'tools/build-site.py'), '--out', str(directory)], check=True, stdout=subprocess.DEVNULL)
sys.path.insert(0, str(ROOT / 'tools'))
from static_site import StaticSiteHandler as Quiet
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(directory)))
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/play"

results = []
def check(name, passed, detail=""):
    results.append(bool(passed)); print(("PASS" if passed else "FAIL"), name, detail if not passed else "")

ST = "RizoRuntimeQA.dungeonStateForQA()"
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
  Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,bond:40,accessory:'scarf'});
  s.pet.skills={speed:20,power:30,instinct:10,stamina:25,luck:5};s.pet.careProfile.foods={crumbs:4,bites:2};s.pet.careProfile.games={rush:3};
  s.inventory.accessories=['none','scarf'];s.collection.classic=1;s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
  RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return s.pet.id;}"""
PORTRAIT, LANDSCAPE = None, None
VIEWPORTS = [(320, 568), (375, 812), (390, 844), (430, 932), (844, 390)]
# Notch / home-indicator insets a real phone of that shape reports.
INSETS = {(320, 568): dict(top=0, bottom=0, left=0, right=0), (375, 812): dict(top=47, bottom=34, left=0, right=0), (390, 844): dict(top=47, bottom=34, left=0, right=0),
          (430, 932): dict(top=59, bottom=34, left=0, right=0), (844, 390): dict(top=0, bottom=21, left=47, right=47)}


class Phone:
    """One mobile context + page + a touch screen that speaks real touch events."""
    def __init__(self, browser, viewport=(390, 844), insets=None):
        self.ctx = browser.new_context(service_workers="block", viewport={"width": viewport[0], "height": viewport[1]}, has_touch=True, is_mobile=True, device_scale_factor=2)
        self.ctx.add_init_script("(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.clear();})()")
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(URL); self.page.wait_for_timeout(1200)
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.insets_applied = None
        if insets:
            try: self.cdp.send("Emulation.setSafeAreaInsetsOverride", {"insets": insets}); self.insets_applied = insets
            except Exception: self.insets_applied = None
        self.active = {}
        self.viewport = viewport

    # --- touch (CDP: touchEnd lists the points being released)
    def _send(self, kind, pts):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i, "radiusX": 12, "radiusY": 12, "force": 1} for i, (x, y) in pts.items()]})
    def down(self, i, x, y): self.active[i] = (x, y); self._send("touchStart", self.active)
    def move(self, i, x, y): self.active[i] = (x, y); self._send("touchMove", self.active)
    def up(self, i): self._send("touchEnd", {i: self.active[i]}); self.active.pop(i, None)
    def cancel(self): self.cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []}); self.active = {}
    def tap(self, i, x, y, hold=60):
        self.down(i, x, y); self.page.wait_for_timeout(hold); self.up(i)
    def center(self, sel):
        r = self.page.evaluate("(s)=>{const b=document.querySelector(s).getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]}", sel)
        return r[0], r[1]

    # --- game state
    def wait(self, ms): self.page.wait_for_timeout(ms)
    def state(self): return self.page.evaluate(ST)
    def pos(self):
        s = self.state()["sim"]["player"]; return (round(s["x"], 1), round(s["y"], 1))
    def dir(self): return self.page.evaluate("document.querySelector('.dungeon-dpad').dataset.dir")
    def keys_down(self): return self.page.evaluate("[...document.querySelectorAll('.dungeon-key')].filter(k=>k.classList.contains('is-down')).map(k=>k.dataset.dungeonKey)")
    def attacks(self): return self.state()["sim"]["player"]["attacks"]
    def teleport(self, x, y): self.page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({x},{y})"); self.wait(80)
    def skip(self): return self.page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
    def resume_if_paused(self): self.page.evaluate("document.querySelector('[data-dungeon-action=\"resume\"]')?.click()"); self.wait(150)
    def still_after(self, settle=300, look=400):
        self.wait(settle); a = self.pos(); self.wait(look); b = self.pos(); return a == b

    def enter(self, room="clatter"):
        """Launch the Dungeon and stand in a below-room in free play (no scene running)."""
        p = self.page
        p.evaluate(SETUP)
        p.evaluate("RizoRuntimeQA.setViewForQA('arcade')"); self.wait(250)
        p.evaluate("document.querySelector('[data-mode=\"dungeon\"]').click()"); self.wait(800)
        for _ in range(3): self.skip(); self.wait(120)
        p.evaluate("([r])=>RizoRuntimeQA.dungeonGotoForQA(r,null,{})", [room]); self.wait(500)
        for _ in range(3): self.skip(); self.wait(120)
        self.teleport(60, 380)
        return self
    def close(self): self.ctx.close()


def fresh(browser, viewport=(390, 844), insets=None, room="clatter"):
    return Phone(browser, viewport, insets).enter(room)


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ================= EVERY PRIMARY PHONE: layout, reach, safe areas =================
    def section_layout(ph, viewport):
        w, h = viewport
        tag = f"{w}x{h}"
        page = ph.page
        ins = ph.insets_applied or dict(top=0, bottom=0, left=0, right=0)
        geo = page.evaluate("""(ins)=>{const vw=innerWidth,vh=innerHeight,out={};
          for(const [k,s] of Object.entries({dpad:'.dungeon-dpad',primary:'.dungeon-key-primary',secondary:'.dungeon-key-secondary',system:'.dungeon-key-system'})){
            const e=document.querySelector(s),b=e.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2,hit=document.elementFromPoint(cx,cy);
            const out2={left:b.left-ins.left,right:vw-ins.right-b.right,top:b.top-ins.top,bottom:vh-ins.bottom-b.bottom,w:b.width,h:b.height,hit:Boolean(hit&&(hit===e||e.contains(hit))),
              // the touchable area is larger than the drawn control
              reachOut:(()=>{const x=k==='dpad'?b.left-9:b.right+5,y=cy,t=document.elementFromPoint(x,y);return Boolean(t&&(t===e||e.contains(t)))})()};
            out[k]=out2;}
          const rects=Object.fromEntries(['dpad','primary','secondary','system'].map(k=>[k,document.querySelector({dpad:'.dungeon-dpad',primary:'.dungeon-key-primary',secondary:'.dungeon-key-secondary',system:'.dungeon-key-system'}[k]).getBoundingClientRect()]));
          const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
          out.overlaps=[['dpad','system'],['primary','secondary'],['primary','system'],['secondary','system'],['dpad','primary'],['dpad','secondary']].map(([a,b])=>[a+'/'+b,Math.round(overlap(rects[a],rects[b]))]).filter(x=>x[1]>0);
          out.scroll={y:scrollY,x:scrollX,docH:document.documentElement.scrollHeight,vh,bodyPos:getComputedStyle(document.body).position,overflowX:document.documentElement.scrollWidth>innerWidth};
          return out}""", ins)
        margins = {k: min(v["left"], v["right"], v["top"], v["bottom"]) for k, v in geo.items() if k in ("dpad", "primary", "secondary", "system")}
        check(f"{tag}: the pad and all three keys are inside the safe area with room for a thumb ({'notch insets emulated' if ph.insets_applied else 'no inset emulation here'})", min(margins.values()) >= 12, str(margins))
        check(f"{tag}: every control is at least 44 px each way (a thumb-sized target)", all(min(geo[k]["w"], geo[k]["h"]) >= 44 for k in ("dpad", "primary", "secondary", "system")), str({k: (round(geo[k]["w"]), round(geo[k]["h"])) for k in ("dpad", "primary", "secondary", "system")}))
        check(f"{tag}: each control answers at its centre and a little outside its drawn edge", all(geo[k]["hit"] and geo[k]["reachOut"] for k in ("dpad", "primary", "secondary", "system")), str({k: (geo[k]["hit"], geo[k]["reachOut"]) for k in ("dpad", "primary", "secondary", "system")}))
        check(f"{tag}: the controls do not overlap each other (≤ 2 px at most, never a key over a key)", all(area <= 2 * 60 for _, area in geo["overlaps"]) and not any(name in ("primary/secondary", "primary/system", "secondary/system") for name, _ in geo["overlaps"]), str(geo["overlaps"]))
        check(f"{tag}: the page is locked: no scroll offset, body fixed, no sideways overflow", geo["scroll"]["y"] == 0 and geo["scroll"]["x"] == 0 and geo["scroll"]["bodyPos"] == "fixed" and not geo["scroll"]["overflowX"] and geo["scroll"]["docH"] <= geo["scroll"]["vh"] + 1, str(geo["scroll"]))
        # a dialogue open and the pause panel open must not cover any control
        px, py = ph.center(".dungeon-key-primary")
        ph.teleport(285, 382); ph.tap(1, px, py); ph.wait(900)
        covered = page.evaluate("""()=>['.dungeon-dpad','.dungeon-key-primary','.dungeon-key-secondary','.dungeon-key-system'].filter(s=>{const e=document.querySelector(s),b=e.getBoundingClientRect(),t=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return !(t&&(t===e||e.contains(t)))})""")
        ph2 = ph.state()
        check(f"{tag}: with a dialogue open no control is covered", ph2["ui"] == "dialogue" and not covered, str((ph2["ui"], covered)))
        box = page.evaluate("(()=>{const d=document.querySelector('.dungeon-dialogue').getBoundingClientRect(),s=document.querySelector('.dungeon-screen').getBoundingClientRect();return d.top>=s.top-0.5&&d.bottom<=s.bottom+0.5&&d.left>=s.left-0.5&&d.right<=s.right+0.5})()")
        check(f"{tag}: the dialogue box fits inside the screen", box)
        for _ in range(8):
            if ph.state()["ui"] != "dialogue": break
            ph.tap(2, px, py); ph.wait(180)
        mx, my = ph.center(".dungeon-key-system"); ph.tap(3, mx, my); ph.wait(350)
        panel = page.evaluate("""()=>{const s=document.querySelector('.dungeon-screen').getBoundingClientRect();const c=document.querySelector('.dungeon-panel .dungeon-card');if(!c)return null;
          return [...c.querySelectorAll('button')].map(x=>{const r=x.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {inside:r.top>=s.top-0.5&&r.bottom<=s.bottom+0.5&&r.left>=s.left&&r.right<=s.right,h:r.height,hit:Boolean(t&&(t===x||x.contains(t)))}})}""")
        check(f"{tag}: every button of the pause panel is inside the screen, at least 44 px tall, and tappable", panel and len(panel) >= 2 and all(b["inside"] and b["h"] >= 44 and b["hit"] for b in panel), str(panel))
        ph.resume_if_paused()

    # ================= THE PAGE NEVER SCROLLS, ZOOMS OR SELECTS =================
    def section_page(ph, viewport):
        w, h = viewport; tag = f"{w}x{h}"
        page = ph.page
        page.evaluate("""(()=>{window.__ev=[];for(const t of ['touchmove','contextmenu','selectstart','dblclick','gesturestart'])
          window.addEventListener(t,e=>window.__ev.push([t,e.defaultPrevented,e.cancelable]),{capture:false,passive:true});})()""")
        scrolled = []
        for name, sel in {"screen": ".dungeon-screen", "brand": ".dungeon-brand", "deck": ".dungeon-deck", "hud": ".dungeon-room-name", "bezel": ".dungeon-bezel", "shell": ".dungeon-shell"}.items():
            x, y = ph.center(sel)
            if name == "shell": x, y = 6, h / 2
            for step in (0, -70, -170, -300, -120, 80, 240):
                if step == 0: ph.down(1, x, y)
                else: ph.move(1, x, y + step)
                ph.wait(16)
            ph.up(1); ph.wait(40)
            scrolled.append((name, page.evaluate("scrollY"), page.evaluate("visualViewport.pageTop")))
        moves = page.evaluate("window.__ev.filter(e=>e[0]==='touchmove')")
        check(f"{tag}: swiping from the screen, frame, controls bar and edge never scrolls the page and every touchmove is cancelled", all(y == 0 and t == 0 for _, y, t in scrolled) and moves and all(m[1] for m in moves if m[2]), str((scrolled, len(moves), sum(1 for m in moves if m[1]))))
        page.mouse.move(w / 2, h / 2); page.mouse.wheel(0, 900)
        for key in ("PageDown", "End", "ArrowDown", "Home"): page.keyboard.press(key)
        ph.wait(80)
        check(f"{tag}: wheel and scroll keys do nothing", page.evaluate("scrollY") == 0 and page.evaluate("document.scrollingElement.scrollTop") == 0)
        touch = page.evaluate("""()=>{const bad=[];for(const e of document.querySelectorAll('.minigame-overlay, .minigame-overlay *')){const cs=getComputedStyle(e);
          if(cs.touchAction!=='none')bad.push(['touch-action',e.className&&String(e.className.baseVal??e.className).slice(0,30),cs.touchAction]);
          const us=cs.userSelect||cs.webkitUserSelect;if(us!=='none')bad.push(['user-select',String(e.className.baseVal??e.className).slice(0,30),us]);
          if(cs.webkitTouchCallout&&cs.webkitTouchCallout!=='none')bad.push(['callout',String(e.className).slice(0,30),cs.webkitTouchCallout]);}
          const html=getComputedStyle(document.documentElement),body=getComputedStyle(document.body);
          return {bad:bad.slice(0,6),count:bad.length,htmlOverscroll:html.overscrollBehaviorY,bodyOverscroll:body.overscrollBehaviorY,htmlOverflow:html.overflow,textAdjust:getComputedStyle(document.querySelector('.dungeon-device')).webkitTextSizeAdjust||getComputedStyle(document.querySelector('.dungeon-device')).textSizeAdjust}}""")
        check(f"{tag}: every element of the handheld declares touch-action none, user-select none and no callout; overscroll and overflow are locked", touch["count"] == 0 and touch["htmlOverscroll"] == "none" and touch["bodyOverscroll"] == "none" and touch["htmlOverflow"] == "hidden", str(touch))
        check(f"{tag}: the handheld does not re-flow its text when the phone rotates (text-size-adjust 100%)", touch["textAdjust"] in ("100%",), str(touch["textAdjust"]))
        # open a dialogue, then long-press and triple-tap every kind of text
        px, py = ph.center(".dungeon-key-primary"); ph.teleport(285, 382); ph.tap(1, px, py); ph.wait(900)
        selected = []
        for name, sel in {"line": ".dungeon-line", "speaker": ".dungeon-speaker", "room": ".dungeon-room-name", "brand": ".dungeon-brand", "key": ".dungeon-key-primary b", "portrait": ".dungeon-portrait"}.items():
            try: x, y = ph.center(sel)
            except Exception: continue
            ph.down(1, x, y); ph.wait(700); ph.up(1); ph.wait(80)
            for _ in range(3): ph.tap(1, x, y, hold=20); ph.wait(50)
            selected.append((name, page.evaluate("String(getSelection())"), page.evaluate("getSelection().rangeCount")))
            page.evaluate("getSelection().removeAllRanges()")
            if ph.state()["ui"] == "play": ph.teleport(285, 382); ph.tap(2, px, py); ph.wait(700)
        ev = page.evaluate("window.__ev")
        check(f"{tag}: long-press and triple-tap on text, portrait and keys select nothing", all(t == "" and r == 0 for _, t, r in selected) and selected, str(selected))
        check(f"{tag}: the browser's context menu and double-click never get through", all(e[1] for e in ev if e[0] in ("contextmenu", "dblclick")), str([e for e in ev if e[0] in ("contextmenu", "dblclick") and not e[1]]))
        check(f"{tag}: a text selection started by script or by Select All is cancelled", page.evaluate("""()=>{document.dispatchEvent(new Event('selectstart',{cancelable:true}));
          const e=new Event('selectstart',{bubbles:true,cancelable:true});document.querySelector('.dungeon-line').dispatchEvent(e);return e.defaultPrevented}"""))
        for _ in range(8):
            if ph.state()["ui"] != "dialogue": break
            ph.tap(2, px, py); ph.wait(180)

    # ================= HOLD, RELEASE, DRAG OFF, CANCEL, ORDER OF RELEASE (every phone) =================
    def section_touch(ph, viewport):
        w, h = viewport; tag = f"{w}x{h}"
        page = ph.page
        dx, dy = ph.center(".dungeon-dpad"); fx, fy = ph.center(".dungeon-key-primary"); tx, ty = ph.center(".dungeon-key-secondary")
        ph.teleport(60, 380); x0 = ph.pos()[0]; ph.down(1, dx + 40, dy); ph.wait(450); x1 = ph.pos()[0]; d_held = ph.dir()
        ph.wait(300); x2 = ph.pos()[0]
        check(f"{tag}: a held thumb moves continuously (about the same distance each 300 ms) and lights the right arm", d_held == "right" and x1 - x0 > 25 and (x2 - x1) > 0.6 * (x1 - x0) * 300 / 450, str((x0, x1, x2, d_held)))
        ph.up(1)
        check(f"{tag}: lifting the thumb stops the Rizo and the pad shows no direction", ph.still_after() and ph.dir() == "none")
        # drag off the pad (far away, up and over) and release there
        ph.teleport(60, 380); ph.down(1, dx + 40, dy); ph.wait(150); ph.move(1, dx + 220, dy - 380); ph.wait(150); steering = ph.dir()
        ph.up(1)
        check(f"{tag}: dragging the thumb far off the pad keeps steering by angle, and releasing out there stops it", steering == "up-right" and ph.still_after() and ph.dir() == "none", str(steering))
        # play at the very edges of the glass: the thumb runs out of screen and keeps steering
        import math
        def expected(vx, vy, prev=(1, 0)):
            """The 8-way direction a thumb at (vx, vy) from the pad centre should give, holding `prev` until 31.5° past its sector."""
            step = math.pi / 4; ang = math.atan2(vy, vx); sector = round(ang / step)
            kept = round(math.atan2(prev[1], prev[0]) / step); away = abs(ang - kept * step); away = 2 * math.pi - away if away > math.pi else away
            if away < step / 2 + math.radians(9): sector = kept
            x, y = round(math.cos(sector * step)), round(math.sin(sector * step))
            return ("up" if y < 0 else "down" if y > 0 else "") + ("-" if x and y else "") + ("left" if x < 0 else "right" if x > 0 else "") or "none"
        for corner, (ex, ey) in {"bottom-left corner": (1, h - 1), "top-right corner": (w - 1, 1), "left edge": (1, dy), "right edge": (w - 1, dy)}.items():
            want = expected(ex - dx, ey - dy)
            ph.teleport(160, 300); ph.down(1, dx + 40, dy); ph.wait(80); ph.move(1, ex, ey); ph.wait(180); got = ph.dir()
            ph.up(1); ph.wait(60)
            check(f"{tag}: a thumb dragged to the {corner} of the screen keeps steering ({want}) and lets go cleanly", got == want and ph.dir() == "none", f"{got} (wanted {want})")
        check(f"{tag}: nothing is left moving after the edge drags", ph.still_after(200, 300) and ph.dir() == "none")
        # slide from the pad onto Flare: the key must not fire
        ph.teleport(60, 380); a0 = ph.attacks(); ph.down(1, dx + 40, dy); ph.wait(120); ph.move(1, (dx + fx) / 2, (dy + fy) / 2); ph.move(1, fx, fy); ph.wait(200)
        flared = ph.attacks() - a0; keys = ph.keys_down(); ph.up(1)
        check(f"{tag}: sliding from the pad onto the Flare key does not press it", flared == 0 and "primary" not in keys, str((flared, keys)))
        # touch cancel while holding
        ph.teleport(60, 380); ph.down(1, dx + 40, dy); ph.wait(250); ph.cancel()
        check(f"{tag}: a cancelled touch (system gesture) stops the Rizo and clears the pad", ph.still_after() and ph.dir() == "none" and not ph.keys_down())
        # a key held, finger dragged off and released away from it
        a0 = ph.attacks(); ph.down(1, fx, fy); ph.wait(80); ph.move(1, fx - 150, fy - 250); ph.wait(80); ph.up(1); ph.wait(300)
        check(f"{tag}: a key finger dragged off and released elsewhere leaves the key up", not ph.keys_down() and ph.attacks() - a0 == 1, str((ph.keys_down(), ph.attacks() - a0)))
        # every release order of pad + Flare + Tuck
        import itertools
        stuck = []
        orders = list(itertools.permutations((1, 2, 3)))
        for order in (orders if viewport == (390, 844) else (orders[0], orders[-1])):
            ph.teleport(60, 380); ph.down(1, dx + 40, dy); ph.down(2, fx, fy); ph.down(3, tx, ty); ph.wait(180)
            for i in order: ph.up(i); ph.wait(25)
            if not (ph.still_after(200, 300) and ph.dir() == "none" and not ph.keys_down()): stuck.append(order)
        check(f"{tag}: pad + Flare + Tuck released in {'all six' if viewport == (390, 844) else 'the first and last'} orders leaves nothing held or moving", not stuck, str(stuck))

    for viewport in VIEWPORTS:
        ph = fresh(browser, viewport, INSETS[viewport])
        for section in (section_layout, section_page, section_touch):
            ph.resume_if_paused()
            if ph.state()["ui"] == "dialogue":
                for _ in range(8):
                    if ph.state()["ui"] != "dialogue": break
                    ph.page.keyboard.press("z"); ph.wait(150)
            section(ph, viewport)
        check(f"{viewport[0]}x{viewport[1]}: no page error across layout, page-lock and touch checks", not ph.errors, str(ph.errors[:2]))
        ph.close()

    # ================= LOST RELEASES: the control is told nothing =================
    ph = fresh(browser); page = ph.page
    dx, dy = ph.center(".dungeon-dpad"); fx, fy = ph.center(".dungeon-key-primary")
    SYN = """([sel,kind,pid,dx,dy,target,primary])=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();
      const ev=new PointerEvent(kind,{bubbles:true,cancelable:true,pointerId:pid,pointerType:'touch',isPrimary:primary,button:kind==='pointermove'?-1:0,buttons:kind==='pointerup'?0:1,clientX:r.left+r.width/2+dx,clientY:r.top+r.height/2+dy});
      return (target?document.querySelector(target):el).dispatchEvent(ev)}"""
    page.evaluate(SYN, [".dungeon-dpad", "pointerdown", 81, 40, 0, None, True]); ph.wait(200)
    page.evaluate(SYN, [".dungeon-dpad", "pointerup", 81, 40, 0, ".dungeon-screen", True])
    check("the release is delivered to a different element (pointer capture lost): movement still stops", ph.still_after() and ph.dir() == "none")
    ph.teleport(60, 380)
    page.evaluate(SYN, [".dungeon-dpad", "pointerdown", 82, 40, 0, None, True]); ph.wait(200)   # and no release ever arrives
    moving = not ph.still_after(0, 250)
    ph.tap(1, dx - 40, dy, hold=120); ph.wait(150)   # the next real finger: the browser says it is the first one
    check("a pointerup that never arrives: the next real touch heals it, movement stops, the pad is free", moving and ph.still_after() and ph.dir() == "none")
    ph.down(1, dx + 40, dy); ph.wait(250); moved_after = ph.pos()[0] > 62; ph.up(1)
    check("…and the pad answers the next touch normally", moved_after)
    page.evaluate(SYN, [".dungeon-key-primary", "pointerdown", 83, 0, 0, None, True]); ph.wait(100)
    page.evaluate(SYN, [".dungeon-key-primary", "pointerup", 83, 0, 0, "body", True]); ph.wait(150)
    check("a Flare release delivered to the page body still lets the key up", not ph.keys_down())
    ph.close()

    # ================= SANE MULTI-TOUCH =================
    ph = fresh(browser); page = ph.page
    dx, dy = ph.center(".dungeon-dpad"); fx, fy = ph.center(".dungeon-key-primary"); tx, ty = ph.center(".dungeon-key-secondary")
    ph.teleport(160, 300); a0 = ph.attacks(); x0 = ph.pos()[0]
    ph.down(1, dx + 40, dy); ph.wait(200); ph.down(2, fx, fy); ph.wait(300)
    state = (ph.dir(), ph.keys_down(), ph.pos()[0] - x0, ph.attacks() - a0)
    ph.up(2); ph.wait(150); still_moving = not ph.still_after(0, 250); ph.up(1)
    check("hold the pad and tap Flare: it moves and flares at once, and moving goes on after Flare lifts", state[0] == "right" and "primary" in state[1] and state[2] > 15 and state[3] >= 1 and still_moving, str(state))
    ph.teleport(160, 300); x0 = ph.pos()[0]
    ph.down(1, dx + 40, dy); ph.down(2, dx - 40, dy); ph.wait(350)
    both = (ph.dir(), ph.pos()[0] - x0); ph.down(3, tx, ty); ph.wait(150); tuck_keys = ph.keys_down()
    ph.up(3); ph.up(2); ph.wait(150); keeps = ph.dir()
    ph.up(1)
    check("two fingers on the pad, left and right: the first thumb steers, they do not cancel to standing still", both[0] == "right" and both[1] > 15, str(both))
    check("…a third finger on Tuck still works, and the ignored finger lifting changes nothing", "secondary" in tuck_keys and keeps == "right", str((tuck_keys, keeps)))
    check("…and after all lift nothing is held", ph.still_after() and ph.dir() == "none" and not ph.keys_down())
    # direction does not flicker on a wobbling thumb near a diagonal
    ph.teleport(160, 300); ph.down(1, dx + 40, dy + 16); ph.wait(100)
    seen = []
    rnd = random.Random(5)
    for _ in range(60):
        ph.move(1, dx + 40 + rnd.uniform(-3, 3), dy + 16 + rnd.uniform(-5, 5)); ph.wait(18); seen.append(ph.dir())
    ph.up(1)
    flips = sum(1 for a, b in zip(seen, seen[1:]) if a != b)
    check("a thumb resting near a diagonal edge and wobbling holds one direction (it used to flip constantly)", flips <= 2, f"{flips} flips: {sorted(set(seen))}")
    # mashing
    ph.teleport(160, 300)
    for i in range(40):
        ph.down(1, dx + (40 if i % 2 else -40), dy); ph.wait(18); ph.up(1); ph.wait(12)
    check("mashing left/right 40 times leaves nothing held", ph.still_after() and ph.dir() == "none")
    a0 = ph.attacks()
    for i in range(8): ph.tap(2, fx, fy, hold=25); ph.wait(430)
    check("eight spaced Flare taps are eight Flares (no tap is lost)", ph.attacks() - a0 == 8, str(ph.attacks() - a0))
    ph.close()

    # ================= DIALOGUE AND PAUSE DURING MOVEMENT =================
    ph = fresh(browser); page = ph.page
    dx, dy = ph.center(".dungeon-dpad"); fx, fy = ph.center(".dungeon-key-primary"); sx, sy = ph.center(".dungeon-key-system")
    ph.teleport(262, 382); ph.down(1, dx + 40, dy); ph.wait(250)
    ph.tap(2, fx, fy); ph.wait(350)
    opened = ph.state()["ui"]
    check("pressing LOOK with a thumb still on the pad opens the dialogue", opened == "dialogue", opened)
    # tap the dialogue box itself to advance
    box = page.evaluate("(()=>{const b=document.querySelector('.dungeon-dialogue').getBoundingClientRect();return [b.left+b.width*0.4,b.top+b.height*0.5]})()")
    for _ in range(8):
        if ph.state()["ui"] != "dialogue": break
        ph.tap(2, box[0], box[1], hold=40); ph.wait(220)
    after = ph.state()["ui"]
    check("tapping the dialogue box itself advances and closes it, like NEXT", after == "play", after)
    p1 = ph.pos(); ph.wait(450); p2 = ph.pos()
    check("with the thumb still held in the same place nothing moves by itself (a held direction is never counted again on its own)", abs(p2[0] - p1[0]) < 0.5 and abs(p2[1] - p1[1]) < 0.5, str((p1, p2)))
    ph.move(1, dx, dy - 40); ph.wait(350); p3 = ph.pos()
    check("…and sliding the thumb to a new direction wakes the pad at once (it used to stay dead until lifted)", p3[1] < p2[1] - 8, str((p2, p3)))
    ph.up(1)
    check("…and releasing stops it", ph.still_after() and ph.dir() == "none")
    # rapid LOOK
    ph.teleport(285, 382); opened = 0; last = "play"
    for _ in range(24):
        ph.tap(2, fx, fy, hold=25); ph.wait(45)
        u = ph.state()["ui"]
        if u == "dialogue" and last != "dialogue": opened += 1
        last = u
    for _ in range(12):
        if ph.state()["ui"] != "dialogue": break
        ph.tap(2, box[0], box[1], hold=40); ph.wait(200)
    check("24 rapid LOOK taps: the dialogue cycles open and closed, nothing sticks, nothing Flares", opened >= 2 and ph.state()["ui"] == "play" and not ph.keys_down() and ph.attacks() == 0, str((opened, ph.state()["ui"], ph.keys_down(), ph.attacks())))
    # pause while moving
    ph.teleport(60, 380); ph.down(1, dx + 40, dy); ph.wait(200); ph.tap(2, sx, sy); ph.wait(350)
    paused = ph.state()["ui"]; q0 = ph.pos(); ph.wait(300); q1 = ph.pos()
    check("MENU while moving pauses: the Rizo holds still behind the panel", paused == "panel" and q0 == q1, str((paused, q0, q1)))
    ph.up(1); ph.resume_if_paused(); ph.wait(300)
    check("…resume with the thumb already lifted leaves no phantom movement", ph.state()["ui"] == "play" and ph.still_after() and ph.dir() == "none")
    ph.down(1, dx + 40, dy); ph.wait(300); moved = ph.pos()[0] > q1[0] + 8; ph.up(1)
    check("…and a fresh touch moves again", moved)
    ph.close()

    # ================= ROTATING AND BACKGROUNDING DURING MOVEMENT =================
    ph = fresh(browser); page = ph.page
    dx, dy = ph.center(".dungeon-dpad")
    ph.down(1, dx + 40, dy); ph.wait(250)
    page.set_viewport_size({"width": 844, "height": 390}); ph.wait(800)
    check("rotating to landscape with the thumb down stops the Rizo and clears the pad (the pad moved under the finger)", ph.still_after() and ph.dir() == "none")
    ph.up(1); ph.wait(100)
    lx, ly = ph.center(".dungeon-dpad"); inside = page.evaluate("(()=>{const b=document.querySelector('.dungeon-dpad').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight})()")
    x0 = ph.pos()[0]; ph.down(1, lx + 40, ly); ph.wait(300); moved = ph.pos()[0] > x0 + 8; ph.up(1)
    check("…the pad is on screen in landscape and answers a fresh touch", inside and moved)
    ph.down(1, lx + 40, ly); ph.wait(200)
    page.set_viewport_size({"width": 390, "height": 844}); ph.wait(800)
    check("rotating back with the thumb down is just as safe", ph.still_after() and ph.dir() == "none")
    ph.up(1); ph.wait(100)
    dx, dy = ph.center(".dungeon-dpad"); x0 = ph.pos()[0]; ph.down(1, dx + 40, dy); ph.wait(300); moved = ph.pos()[0] > x0 + 8; ph.up(1)
    check("…and portrait works again", moved)
    HIDE = """(v)=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>v});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>v?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))}"""
    ph.teleport(60, 380); ph.down(1, dx + 40, dy); ph.wait(250)
    page.evaluate(HIDE, True); ph.wait(300)
    h0 = ph.pos(); ph.wait(300); h1 = ph.pos()
    check("backgrounding the tab while holding movement freezes the game", h0 == h1 and "background" in ph.state()["holds"], str((h0, h1, ph.state()["holds"])))
    ph.up(1)   # the finger lifted while the page was away
    page.evaluate(HIDE, False); ph.wait(500); ph.resume_if_paused(); ph.wait(300)
    check("coming back after the finger lifted: no phantom movement, no stuck pad", ph.state()["ui"] == "play" and ph.still_after() and ph.dir() == "none" and not ph.keys_down())
    ph.down(1, dx + 40, dy); ph.wait(250); page.evaluate(HIDE, True); ph.wait(200); page.evaluate(HIDE, False); ph.wait(400); ph.resume_if_paused()
    check("coming back with the finger still down: the old hold is not trusted (the pad waits for a fresh touch)", ph.still_after(300, 400) and ph.dir() == "none")
    ph.up(1); ph.wait(100); x0 = ph.pos()[0]; ph.down(1, dx + 40, dy); ph.wait(300); moved = ph.pos()[0] > x0 + 8; ph.up(1)
    check("…and then works", moved)
    # keyboard: window loses focus with a key down (its keyup is lost), then the player presses it again
    ph.teleport(60, 380); page.keyboard.down("d"); ph.wait(150)
    page.evaluate("window.dispatchEvent(new Event('blur'))"); ph.wait(80); a = ph.pos()
    page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',code:'KeyD',repeat:true,bubbles:true,cancelable:true}))"); ph.wait(250)
    repeat_moved = ph.pos()[0] - a[0]
    page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',code:'KeyD',repeat:false,bubbles:true,cancelable:true}))"); ph.wait(300)
    fresh_moved = ph.pos()[0] - a[0]
    page.keyboard.up("d"); ph.wait(100)
    check("a browser repeat of a key held through a blur cannot restart it, but the next fresh press of that key works (it was swallowed before)", abs(repeat_moved) < 0.5 and fresh_moved > 8, str((repeat_moved, fresh_moved)))
    ph.close()

    # ================= KEYBOARD AND MOUSE STAY INTACT =================
    ph = fresh(browser, (1280, 800)); page = ph.page
    for key, axis, sign in (("d", 0, 1), ("ArrowLeft", 0, -1), ("w", 1, -1), ("ArrowDown", 1, 1)):
        ph.teleport(160, 300); a = ph.pos(); page.keyboard.down(key); ph.wait(300); b = ph.pos(); page.keyboard.up(key); ph.wait(80)
        check(f"desktop: {key} moves the Rizo", (b[axis] - a[axis]) * sign > 8, str((a, b)))
    for key, label in (("z", "Flare"), ("Space", "Flare"), ("j", "Flare")):
        ph.wait(450); a0 = ph.attacks(); page.keyboard.press(key); ph.wait(150)
        check(f"desktop: {key} is {label}", ph.attacks() - a0 == 1, str(ph.attacks() - a0))
    ph.wait(450); page.keyboard.press("x"); ph.wait(120)
    check("desktop: X is Tuck", ph.state()["sim"]["player"]["act"] == "tuck" or ph.state()["sim"]["player"]["tuckReadyAt"] > 0)
    ph.wait(500); a0 = ph.attacks(); page.mouse.click(640, 300); ph.wait(150)
    check("desktop: a left click on the screen is Flare", ph.attacks() - a0 == 1)
    check("desktop: the page context menu is suppressed inside the handheld", page.evaluate("document.querySelector('.dungeon-screen').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))") is False)
    page.keyboard.press("Escape"); ph.wait(300); paused = ph.state()["ui"]
    page.keyboard.press("Escape"); ph.wait(300)
    check("desktop: Escape pauses and Escape resumes", paused == "panel" and ph.state()["ui"] == "play", paused)
    check("desktop: the page is still locked", page.evaluate("scrollY") == 0 and page.evaluate("getComputedStyle(document.body).position") == "fixed")
    ph.close()

    # ================= LEAVING THE DUNGEON GIVES THE PAGE BACK =================
    ph = Phone(browser, (390, 844)); page = ph.page
    page.evaluate(SETUP); page.evaluate("RizoRuntimeQA.setViewForQA('arcade')"); ph.wait(250)
    # Go's compact shelf may only scroll 48 px. Give the page a known scroll
    # range so this tests the Dungeon's lock/restore, independent of hub layout.
    page.evaluate("()=>{const probe=document.createElement('div');probe.style.height='800px';probe.dataset.qaScrollProbe='true';document.body.appendChild(probe)}")
    page.evaluate("window.scrollTo(0,200)"); ph.wait(100); before = page.evaluate("scrollY")
    page.evaluate("document.querySelector('[data-mode=\"dungeon\"]').click()"); ph.wait(900)
    during = page.evaluate("scrollY"); locked = page.evaluate("document.documentElement.classList.contains('dungeon-locked')")
    page.evaluate("RizoModes.quitActive('qa')"); ph.wait(600)
    after = (page.evaluate("scrollY"), page.evaluate("document.documentElement.classList.contains('dungeon-locked')"), page.evaluate("getComputedStyle(document.body).position"), page.evaluate("getComputedStyle(document.body).userSelect||getComputedStyle(document.body).webkitUserSelect"))
    page.mouse.wheel(0, 100); ph.wait(150)
    check("leaving the Dungeon restores the Hub exactly: scroll position, scrolling and selection", before == 200 and locked and during == 0 and after[0] == 200 and not after[1] and after[2] != "fixed" and after[3] != "none" and page.evaluate("scrollY") > 200, str((before, during, after)))
    ph.close()

    # ================= A SEEDED FUZZ: nothing may be left pressed or moving =================
    def fuzz(seed, steps=60):
        rnd = random.Random(seed); ph = fresh(browser); page = ph.page
        t = {k: ph.center(s) for k, s in (("dpad", ".dungeon-dpad"), ("flare", ".dungeon-key-primary"), ("tuck", ".dungeon-key-secondary"), ("menu", ".dungeon-key-system"))}
        for _ in range(steps):
            op = rnd.choice(["down", "down", "move", "up", "up", "cancel", "wait", "hide", "look"]); ids = list(ph.active)
            if op == "down" and len(ph.active) < 4:
                i = rnd.choice([x for x in range(1, 6) if x not in ph.active]); k = rnd.choice(["dpad", "dpad", "flare", "tuck", "menu"]); x, y = t[k]
                span = 45 if k == "dpad" else 14
                ph.down(i, x + rnd.uniform(-span, span), y + rnd.uniform(-span, span))
            elif op == "move" and ids: i = rnd.choice(ids); x, y = ph.active[i]; ph.move(i, x + rnd.uniform(-160, 160), y + rnd.uniform(-160, 160))
            elif op == "up" and ids: ph.up(rnd.choice(ids))
            elif op == "cancel" and ids: ph.cancel()
            elif op == "hide" and rnd.random() < 0.3:
                page.evaluate("""(()=>{const set=v=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>v});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>v?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))};set(true);setTimeout(()=>set(false),60)})()""")
                ph.wait(200); ph.resume_if_paused()
            elif op == "look": ph.teleport(285, 382)
            ph.wait(rnd.choice([0, 8, 16, 30, 80, 140]))
            if ph.state()["ui"] == "panel": ph.resume_if_paused()
        for i in rnd.sample(list(ph.active), len(ph.active)): ph.up(i); ph.wait(rnd.choice([0, 20, 90]))
        for _ in range(10):
            if ph.state()["ui"] in ("dialogue", "choice", "panel"): page.keyboard.press("z"); ph.wait(120)
        ph.resume_if_paused(); ph.wait(400)
        ok = ph.still_after(300, 500) and ph.dir() == "none" and not ph.keys_down() and not ph.errors
        detail = str((ph.state()["ui"], ph.dir(), ph.keys_down(), ph.errors[:1]))
        ph.close()
        return ok, detail
    for seed in [int(s) for s in args.fuzz_seeds.split(",") if s]:
        ok, detail = fuzz(seed)
        check(f"fuzz seed {seed}: ~60 random touches, cancels and backgroundings, then everyone lets go: nothing stays pressed or moving", ok, detail)

    browser.close()
server.shutdown()
print(f"\n{sum(results)}/{len(results)} dungeon controls checks passed")
sys.exit(0 if all(results) else 1)
