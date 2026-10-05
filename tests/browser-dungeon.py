"""Rizo Dungeon Gate 1, through the real hub (/play over HTTP, real
localStorage, real reloads).

Covers: entry with the actual named/dressed Rizo; keyboard, mouse and touch
driving one action state (and the physical keys); move + act together; the
Draftling, death, rest and retry; lifecycle holds; care policy; persistence
(reload, import, deleted run keys); identity (House swap, release warning);
the QA-only completion fixture (First Knot / story mark, duplicate and
conflicting receipts, failed primary, failed backup); the force-update
handoff; a signed newer-hub save; and the hub booting without Dungeon scripts.

Run 2 adds: the page lock, the opening ("Be good." → van → roadside →
drain → the fall into the handheld), the Threshold story path (Latch, SIT
and GO, the cold bowl, the shortcut, the Porter's help, the First Knot gift,
the homecoming), an interrupted committed beat, and a Gate 1 save carried
forward.

v0.3 (full opening) covers all fourteen scenes in order: the parked car and
YOU's once-only answers, "Be good." with the pet's own name, the waiting
rule (60 s and seeing YOU, or 120 s; looking never shortens it), the dome
light, headlights, the abduction nobody can prevent, the sack, the van's
non-blocking talk, the held push at the gap, the roadside search (beam,
shadow, Flare; seen never means caught), the ringing phone touched and
ignored, the passing car, the drain into rock, the staged fall, the
awakening, "home?" once, and HOME ↑ found by LOOK. Plus: reload at every
point in the opening (no committed beat replays), RC2 threshold-v1 saves
carried into threshold-v2, callerConnected persistence, the Act I locked
staging, reduced motion, and 320–430 px phones.

Chapter 1 (threshold-v3) covers the Mending Rows: the Porter's door opening
onward instead of home, Latch and Nell in Receiving, every work-gated route
(catch, low route, grille, meal, press stop/brake/test/shutter, stair, the
sheets moved aside), SIT/GO at the meal, the chalk, the wrap worn and still
worn after a reload, Latch remembering help, the Window Hall boundary, reloads
throughout, a completed proof going on through the door, and phones.

Chromium only. This is not Safari or physical-phone evidence.
"""
import argparse, functools, http.server, json, re, socketserver, subprocess, sys, threading, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
V2, V2_BACKUP = "rizo-save-v2", "rizo-save-v2:backup"

parser = argparse.ArgumentParser()
parser.add_argument('--directory')
args = parser.parse_args()
if args.directory:
    directory = Path(args.directory).resolve()
else:
    _artifact = tempfile.TemporaryDirectory(prefix='rizo-dungeon-')
    directory = Path(_artifact.name) / 'site'
    subprocess.run([sys.executable,str(ROOT/'tools/build-site.py'),'--out',str(directory)],check=True)
sys.path.insert(0,str(ROOT/'tools'))
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
STORED = """()=>{const v=JSON.parse(localStorage.getItem('rizo-save-v2')||'null');const s=v&&v.state;
  return {slice:v?.modes?.dungeon?.data||null,schema:v?.modes?.dungeon?.schema||0,accessories:s?.inventory?.accessories||[],accessory:s?.pet?.accessory,
  petId:s?.pet?.id,petName:s?.pet?.name,marks:s?.pet?.storyMarks||null,receipts:s?.modeReceipts||null,version:s?.version,writeId:v?.writeId,
  backup:localStorage.getItem('rizo-save-v2:backup')}}"""
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
  Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false,bond:40,accessory:'scarf'});
  s.pet.skills={speed:20,power:30,instinct:10,stamina:25,luck:5};s.pet.careProfile.foods={crumbs:4,bites:2};s.pet.careProfile.games={rush:3};
  s.inventory.accessories=['none','scarf'];s.collection.classic=1;s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
  const h=JSON.parse(JSON.stringify(s.pet));Object.assign(h,{id:'PET-HOUSE-1',number:2,name:'LODGER',variant:'ember',hiddenVariant:'ember',stage:'teen',accessory:'none',homeRoom:0,lastTick:Date.now()});
  s.farm.roster=[h];s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
  RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return s.pet.id;}"""

def boot(browser, seed=None, block_dungeon=False, viewport=(390, 844), wait=1200):
    ctx = browser.new_context(service_workers="block", viewport={"width": viewport[0], "height": viewport[1]}, has_touch=True)
    if seed is not None:
        ctx.add_init_script("(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.clear();const seed=%s;for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);})()" % json.dumps(seed))
    if block_dungeon:
        ctx.route("**/modes/dungeon/**", lambda route: route.abort())
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_timeout(wait)
    return ctx, page, errors

def launch(page):
    page.evaluate("RizoRuntimeQA.setViewForQA('go')"); page.wait_for_timeout(250)
    # A real player cannot press the shelf through a hub modal.
    assert not page.evaluate("document.getElementById('modalOverlay').classList.contains('show')"), page.evaluate("document.querySelector('#modalOverlay .modal-card')?.className")
    page.evaluate("document.querySelector('[data-mode=\"dungeon\"]').click()"); page.wait_for_timeout(700)
    return page.evaluate(ST)

def skip(page):
    return page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
def goto(page, room, anchor=None, flags=None):
    page.evaluate("([r,a,f])=>RizoRuntimeQA.dungeonGotoForQA(r,a,f||{})", [room, anchor, flags]); page.wait_for_timeout(350); skip(page)
def press_until_closed(page, limit=12):
    for _ in range(limit):
        if page.evaluate(ST)["dialogue"] is None: return True
        page.keyboard.press("z"); page.wait_for_timeout(120)
    return page.evaluate(ST)["dialogue"] is None

def pointer(page, selector, kind, pid, dx=0, dy=0, ptype="touch", button=0):
    """Dispatch a pointer event at an element's centre (+dx, +dy)."""
    return page.evaluate("""([sel,kind,pid,dx,dy,ptype,button])=>{const el=document.querySelector(sel);const r=el.getBoundingClientRect();
      const ev=new PointerEvent(kind,{bubbles:true,cancelable:true,pointerId:pid,pointerType:ptype,isPrimary:pid===1,button:kind==='pointermove'?-1:button,buttons:kind==='pointerup'?0:1,clientX:r.left+r.width/2+dx,clientY:r.top+r.height/2+dy});
      return el.dispatchEvent(ev);}""", [selector, kind, pid, dx, dy, ptype, button])

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ================= ENTRY AND IDENTITY =================
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    saved_with_knot_seed = page.evaluate("localStorage.getItem('rizo-save-v2')")
    page.evaluate("RizoRuntimeQA.setViewForQA('go')"); page.wait_for_timeout(150)
    meta = page.evaluate("document.querySelector('[data-mode-meta=\"dungeon\"]').innerText")
    check("Go describes a free saved story, not an ENDLESS energy run", "FREE" in meta and "SAVED STORY" in meta and "ENDLESS" not in meta and "ENERGY" not in meta, meta)
    before_hunger = page.evaluate("RizoRuntimeQA.snapshot().pet.hunger")
    st = launch(page)
    check("the Dungeon opens from the shelf through RizoModes, in the Keeper's car, shell open", page.evaluate("RizoModes.active()") == "dungeon" and st["sim"]["roomId"] == "car" and st["shell"] == "open", str(st and (st["ui"], st["sim"]["roomId"], st["shell"])))
    actor = page.evaluate("""(()=>{const a=document.querySelectorAll('.dungeon-actor .mini-pet');const m=a[0];return {count:a.length,variant:m?.dataset.rizoVariant,context:m?.dataset.rizoContext,alt:m?.querySelector('img')?.alt||'',wear:Boolean(m?.querySelector('.wearable-scarf'))}})()""")
    check("the actual named, dressed Rizo is the actor (canonical markup, one renderer)", actor["count"] == 1 and actor["variant"] == "classic" and actor["context"] == "dungeon" and "MOSSY" in actor["alt"] and actor["wear"], str(actor))
    s = page.evaluate(STORED)
    check("a proof campaign is created, bound to the active pet and saved in the signed envelope", s["slice"] and s["slice"]["campaign"]["petId"] == pet_id and s["slice"]["campaign"]["kind"] == "proof" and s["schema"] == 1, str(s["slice"] and s["slice"]["campaign"]))
    check("the Dungeon slice stays small", len(json.dumps(s["slice"])) < 50000, str(len(json.dumps(s["slice"]))))
    check("the care summary reaches the profile as recognition cues only", s["slice"]["legProfile"]["cues"] == {"favoriteFoodId": "crumbs", "favoriteGameId": "rush"} and s["slice"]["legProfile"]["bondBand"] == "familiar", str(s["slice"]["legProfile"]))
    check("a foreground care hold is active while the Dungeon is open", (page.evaluate("RizoRuntimeQA.careHoldForQA()") or {}).get("modeId") == "dungeon")
    page.evaluate("RizoRuntimeQA.renderAll()"); page.wait_for_timeout(100)
    check("the Arcade shelf refresh never rewrites the open stage (data-mode collision)", page.evaluate("Boolean(document.querySelector('#miniArena .dungeon-screen'))") and page.evaluate("document.getElementById('miniGameOverlay').dataset.activeMode") == "dungeon")
    check("the inherited arcade timer and actions are hidden", page.evaluate("getComputedStyle(document.querySelector('.mini-actions')).display") == "none" and page.evaluate("document.getElementById('miniGameOverlay').classList.contains('dungeon-active')"))
    lock = page.evaluate("""(()=>{const touch=new Event('touchmove',{bubbles:true,cancelable:true});document.querySelector('.dungeon-screen').dispatchEvent(touch);
      const sel=new Event('selectstart',{bubbles:true,cancelable:true});document.querySelector('.dungeon-line').dispatchEvent(sel);
      const bodySel=new Event('selectstart',{bubbles:true,cancelable:true});document.body.dispatchEvent(bodySel);
      return {html:document.documentElement.classList.contains('dungeon-locked'),body:getComputedStyle(document.body).position,overflow:getComputedStyle(document.documentElement).overflow,
        touch:touch.defaultPrevented,select:sel.defaultPrevented,bodySelect:bodySel.defaultPrevented,userSelect:getComputedStyle(document.querySelector('.dungeon-line')).userSelect||getComputedStyle(document.querySelector('.dungeon-line')).webkitUserSelect}})()""")
    check("while open, the page cannot scroll, rubber-band or select text (Dungeon-scoped)", lock["html"] and lock["body"] == "fixed" and lock["overflow"] == "hidden" and lock["touch"] and lock["select"] and lock["bodySelect"] and lock["userSelect"] == "none", str(lock))
    skip(page); goto(page, "clatter")

    # The first Draftling: seen at the edge of his light before it notices him.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(60,360)"); page.wait_for_timeout(200)
    far = page.evaluate(ST)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(110,270)"); page.wait_for_timeout(200)
    near = page.evaluate(ST)
    check("Act I: the first Draftling is seen at the edge of his light before it notices him (he pulls in)", not far["opening"].get("sighted") and near["opening"].get("sighted") and near["pose"] == "pull-in" and not near["sim"]["enemies"][0]["aware"], str((near["pose"], near["sim"]["enemies"][0])))
    goto(page, "clatter")

    # ================= INPUTS =================
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(170,330)")
    x0 = page.evaluate(ST)["sim"]["player"]["x"]
    page.keyboard.down("d"); page.wait_for_timeout(300)
    dpad_dir = page.evaluate("document.querySelector('.dungeon-dpad').dataset.dir")
    page.keyboard.down("z"); page.wait_for_timeout(60)
    mid = page.evaluate(ST)["sim"]["player"]
    primary_down = page.evaluate("document.querySelector('.dungeon-key-primary').classList.contains('is-down')")
    page.wait_for_timeout(200)
    after = page.evaluate(ST)["sim"]["player"]
    page.keyboard.up("z"); page.keyboard.up("d"); page.wait_for_timeout(80)
    check("keyboard: holding D moves and the D-pad visibly presses right", mid["x"] > x0 + 15 and dpad_dir == "right", f"{x0}->{mid['x']} dir={dpad_dir}")
    check("keyboard: Z flares while D keeps moving (move + act together)", mid["attacks"] >= 1 and after["x"] > mid["x"] + 3, str((mid, after["x"])))
    check("keyboard: the physical Flare key depresses while Z is held", primary_down)
    released = page.evaluate("[document.querySelector('.dungeon-dpad').dataset.dir, document.querySelector('.dungeon-key-primary').classList.contains('is-down')]")
    check("keys rise again on release", released == ["none", False], str(released))

    # Touch: D-pad and Flare under separate pointer ids, at the same time.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(170,330)"); page.wait_for_timeout(50)
    t0 = page.evaluate(ST)["sim"]["player"]
    pointer(page, ".dungeon-dpad", "pointerdown", 21, dx=50)
    page.wait_for_timeout(200)
    pointer(page, ".dungeon-key-primary", "pointerdown", 22)
    page.wait_for_timeout(120)
    keys = page.evaluate("[document.querySelector('.dungeon-dpad').dataset.dir, document.querySelector('.dungeon-key-primary').classList.contains('is-down')]")
    t1 = page.evaluate(ST)["sim"]["player"]
    pointer(page, ".dungeon-dpad", "pointermove", 21, dy=-50)
    page.wait_for_timeout(200)
    slid = page.evaluate("document.querySelector('.dungeon-dpad').dataset.dir")
    t2 = page.evaluate(ST)["sim"]["player"]
    pointer(page, ".dungeon-key-primary", "pointerup", 22); pointer(page, ".dungeon-dpad", "pointerup", 21, dy=-50)
    page.wait_for_timeout(60)
    check("touch: D-pad and Flare work together on separate pointers", t1["x"] > t0["x"] + 10 and t1["attacks"] > t0["attacks"] and keys == ["right", True], str((t0["x"], t1["x"], t1["attacks"], keys)))
    check("touch: sliding across the D-pad changes direction without lifting", slid == "up" and t2["y"] < t1["y"] - 5, str((slid, t1["y"], t2["y"])))
    pointer(page, ".dungeon-dpad", "pointerdown", 23, dx=50); page.wait_for_timeout(60)
    pointer(page, ".dungeon-dpad", "pointercancel", 23); page.wait_for_timeout(80)
    c0 = page.evaluate(ST)["sim"]["player"]["x"]; page.wait_for_timeout(150); c1 = page.evaluate(ST)["sim"]["player"]["x"]
    check("touch: pointercancel releases the D-pad", abs(c1 - c0) < 0.01 and page.evaluate("document.querySelector('.dungeon-dpad').dataset.dir") == "none")

    # Mouse: right button over the screen tucks; no page context menu.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(170,330)"); page.wait_for_timeout(700)
    r0 = page.evaluate(ST)["sim"]["player"]
    pointer(page, ".dungeon-screen", "pointerdown", 1, ptype="mouse", button=2); page.wait_for_timeout(40)
    tucking = page.evaluate(ST)["sim"]["player"]
    pointer(page, ".dungeon-screen", "pointerup", 1, ptype="mouse", button=2)
    menu_allowed = page.evaluate("document.querySelector('.dungeon-screen').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))")
    check("mouse: right button over the screen is Tuck", tucking["act"] == "tuck" or tucking["tuckReadyAt"] > 0, str(tucking))
    check("mouse: the page context menu is suppressed inside the handheld", menu_allowed is False)
    page.wait_for_timeout(400)
    a0 = page.evaluate(ST)["sim"]["player"]["attacks"]
    pointer(page, ".dungeon-key-primary", "pointerdown", 1, ptype="mouse"); page.wait_for_timeout(50); pointer(page, ".dungeon-key-primary", "pointerup", 1, ptype="mouse")
    page.wait_for_timeout(80)
    check("clicking a rendered key fires that key once, not also a screen attack", page.evaluate(ST)["sim"]["player"]["attacks"] - a0 == 1)
    page.wait_for_timeout(400)
    pointer(page, ".dungeon-screen", "pointerdown", 1, ptype="mouse", button=0); page.wait_for_timeout(50); pointer(page, ".dungeon-screen", "pointerup", 1, ptype="mouse", button=0)
    page.wait_for_timeout(80)
    check("mouse: left button over the screen is Flare", page.evaluate(ST)["sim"]["player"]["attacks"] - a0 == 2)

    # Cancellation: blur, keyup elsewhere, browser repeat, typing targets.
    page.keyboard.down("d"); page.wait_for_timeout(100)
    page.evaluate("window.dispatchEvent(new Event('blur'))"); page.wait_for_timeout(50)
    b0 = page.evaluate(ST)["sim"]["player"]["x"]
    page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',code:'KeyD',repeat:true,bubbles:true}))"); page.wait_for_timeout(150)
    b1 = page.evaluate(ST)["sim"]["player"]["x"]
    check("blur clears held input and a browser repeat cannot restart it", abs(b1 - b0) < 0.01, f"{b0}->{b1}")
    page.keyboard.up("d")
    page.evaluate("document.body.focus()")
    page.keyboard.down("a"); page.wait_for_timeout(80)
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'a',code:'KeyA',bubbles:true}))"); page.wait_for_timeout(60)
    k0 = page.evaluate(ST)["sim"]["player"]["x"]; page.wait_for_timeout(120); k1 = page.evaluate(ST)["sim"]["player"]["x"]
    check("a keyup outside the device still releases the key", abs(k1 - k0) < 0.01)
    claimed = page.evaluate("(()=>{const i=document.createElement('input');document.body.appendChild(i);const e=new KeyboardEvent('keydown',{key:'z',bubbles:true,cancelable:true});Object.defineProperty(e,'target',{value:i});const r=RizoModes.keyActive(e);i.remove();return r})()")
    check("typing targets and shortcuts are never game input", claimed is False and page.evaluate("RizoModes.keyActive(new KeyboardEvent('keydown',{key:'z',ctrlKey:true}))") is False)

    # Dialogue: the press that closes the last line never fires a Flare.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(285,382)"); page.wait_for_timeout(150)
    d0 = page.evaluate(ST)["sim"]["player"]["attacks"]
    page.keyboard.press("z"); page.wait_for_timeout(120)
    opened = page.evaluate(ST)["dialogue"]
    page.keyboard.down("z"); page.wait_for_timeout(60)
    for _ in range(3): page.keyboard.up("z"); page.wait_for_timeout(60); page.keyboard.down("z"); page.wait_for_timeout(60)  # reveal, next, reveal, close
    page.wait_for_timeout(400)
    closed = page.evaluate(ST)
    page.keyboard.up("z"); page.wait_for_timeout(100)
    check("inspecting opens a dialogue; a fresh press reveals, another advances", opened is not None and opened["lines"] == 2 and closed["dialogue"] is None, str((opened, closed["dialogue"])))
    check("the press that closes a line (and a key still held) never fires a Flare", closed["sim"]["player"]["attacks"] == d0 and page.evaluate(ST)["sim"]["player"]["attacks"] == d0, str((d0, closed["sim"]["player"]["attacks"])))
    check("Journal settings offer Gentler timing and text speed", "Gentler timing" in page.evaluate("RizoRuntimeQA.modeSettingsMarkupForQA()") and "Dungeon text speed" in page.evaluate("RizoRuntimeQA.modeSettingsMarkupForQA()"))

    # ================= COMBAT, DEATH, REST =================
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(176,236)")
    page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")  # face it: Flare goes where the Rizo faces
    events = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(6000,{primaryHeld:true,primaryPressed:true})")
    st = page.evaluate(ST)
    check("a held Flare reads the Draftling's draw-back and calms it", "lunge" in events and "calmed" in events and st["sim"]["enemies"][0]["state"] == "gone", str(events[:12]))
    check("no reward or story claim comes from ordinary play", page.evaluate(STORED)["accessories"] == ["none", "scarf"] and not st["data"]["proofComplete"])
    # The hearth is its own room now: rest there, and the Draftling returns to Clatter.
    goto(page, "hearth", None, {"latchFreed": True, "seatChosen": True})
    hearth = page.evaluate("RizoDungeonContent.ROOMS.hearth.hearth")
    page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({hearth['x'] + 20},{hearth['y']})"); page.wait_for_timeout(100)
    prompt = page.evaluate("[document.querySelector('.dungeon-prompt').hidden, document.querySelector('.dungeon-prompt').textContent, document.querySelector('.dungeon-key-primary b').textContent]")
    check("the hearth shows a highlighted KINDLE prompt and the key says so", prompt[0] is False and "KINDLE" in prompt[1] and prompt[2] == "KINDLE", str(prompt))
    page.keyboard.press("z"); page.wait_for_timeout(500)
    page.keyboard.press("x"); page.wait_for_timeout(1000)
    check("Secondary cancels a Kindle safely", page.evaluate(ST)["sim"]["player"]["act"] is None and (page.evaluate(STORED)["slice"]["checkpoint"]["hearthId"] in (None, hearth["id"])))
    page.keyboard.press("z"); page.wait_for_timeout(1500)
    s = page.evaluate(STORED); st = page.evaluate(ST)
    check("Kindle rests: hearth registered, Flame full, checkpoint committed", s["slice"]["checkpoint"]["hearthId"] == hearth["id"] and s["slice"]["continuation"]["resumeKind"] == "hearth" and st["sim"]["player"]["flame"] == 5, str(s["slice"]["checkpoint"]))
    goto(page, "clatter")
    st = page.evaluate(ST)
    check("rest brings the ordinary Draftling back for a new leg", st["sim"]["enemies"][0]["state"] != "gone" and st["sim"]["enemies"][0]["hp"] == 4)
    check("the rest is reported as a protected semantic event (dormant)", any(e["kind"] == "checkpointRest" and e["tone"] == "protected" and e["mode"] == "dungeon" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(176,240)")
    hurt = page.evaluate("(RizoRuntimeQA.dungeonAdvanceForQA(3000,{}), [RizoRuntimeQA.dungeonStateForQA().sim.player.flame, RizoRuntimeQA.dungeonStateForQA().lightScale])")
    check("Act I: a hit is the first time his light circle shrinks (flame down, the light dips)", hurt[0] < 5 and hurt[1] < 1, str(hurt))
    events = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(20000,{})")
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("standing in the lunge line brings the Rizo down and back at the hearth", "down" in events and "respawn-ready" in events and st["sim"]["roomId"] == "hearth" and st["sim"]["player"]["flame"] == 5 and abs(st["sim"]["player"]["x"] - 200) < 0.1, str((events.count("hurt"), st["sim"]["roomId"], st["sim"]["player"])))
    check("death keeps the pet, the hearth and the campaign; it is committed", s["petId"] == pet_id and s["slice"]["checkpoint"]["hearthId"] == hearth["id"] and s["slice"]["continuation"]["resumeKind"] == "respawn" and s["accessories"] == ["none", "scarf"])

    # ================= LIFECYCLE =================
    page.evaluate("RizoRuntimeQA.suspendRuntimeForQA('background')")
    h1 = page.evaluate(ST)["holds"]; t_a = page.evaluate(ST)["sim"]["t"]
    page.evaluate("document.dispatchEvent(new Event('rizo:ad-start'))")
    page.evaluate("RizoRuntimeQA.resumeRuntimeForQA('visible')")
    h2 = page.evaluate(ST)["holds"]
    page.evaluate("document.dispatchEvent(new Event('rizo:ad-end'))"); page.wait_for_timeout(250)
    h3 = page.evaluate(ST)["holds"]; t_b = page.evaluate(ST)["sim"]["t"]
    check("background → ad → visible → ad-end leaves only a manual hold", h1 == ["background", "manual"] and h2 == ["ad", "manual"] and h3 == ["manual"], str((h1, h2, h3)))
    check("nothing advances under a hold", t_a == t_b)
    resume_visible = page.evaluate("!document.querySelector('.dungeon-panel').hidden && Boolean(document.querySelector('[data-dungeon-action=\"resume\"]'))")
    page.evaluate("document.querySelector('[data-dungeon-action=\"resume\"]').click()"); page.wait_for_timeout(200)
    check("a fresh Resume is required, and it restarts play", resume_visible and page.evaluate(ST)["holds"] == [] and page.evaluate(ST)["sim"]["t"] > t_b)
    page.keyboard.press("Escape"); page.wait_for_timeout(80)
    paused = page.evaluate(ST)
    page.keyboard.press("Escape"); page.wait_for_timeout(80)
    check("Escape opens and closes the device's own pause panel", paused["holds"] == ["manual"] and paused["panelKind"] == "pause" and page.evaluate(ST)["holds"] == [])
    page.keyboard.down("d"); page.wait_for_timeout(80)
    page.set_viewport_size({"width": 430, "height": 932}); page.wait_for_timeout(400)
    r0 = page.evaluate(ST)["sim"]["player"]["x"]; page.wait_for_timeout(150); r1 = page.evaluate(ST)["sim"]["player"]["x"]
    page.keyboard.up("d")
    room = page.evaluate("RizoDungeonCore.room('clatter')")
    check("resize clears held input and leaves the world unchanged", abs(r1 - r0) < 0.01 and room["w"] == 336 and room["h"] == 432 and page.evaluate(ST)["sim"]["phase"] == "play")
    no_overflow = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    check("no horizontal overflow at 430×932", no_overflow)

    # ================= CARE POLICY =================
    pet0 = page.evaluate("RizoRuntimeQA.processElapsedForQA()")
    page.evaluate("RizoRuntimeQA.agePetClockForQA(3*3600e3)")
    pet1 = page.evaluate("RizoRuntimeQA.processElapsedForQA()")
    check("visible Dungeon time neither decays needs nor grows the pet", pet1["hunger"] == pet0["hunger"] and pet1["xp"] == pet0["xp"] and pet1["bond"] == pet0["bond"], str((pet0, pet1)))
    page.evaluate("RizoRuntimeQA.suspendRuntimeForQA('background')")
    page.evaluate("RizoRuntimeQA.agePetClockForQA(3*3600e3)")
    page.evaluate("RizoRuntimeQA.resumeRuntimeForQA('visible')")
    pet2 = page.evaluate("RizoRuntimeQA.processElapsedForQA()")
    check("hidden absence still counts as ordinary time away", pet2["hunger"] < pet1["hunger"] - 2, str((pet1["hunger"], pet2["hunger"])))
    page.evaluate("document.querySelector('[data-dungeon-action=\"resume\"]')?.click()"); page.wait_for_timeout(100)

    # ================= PERSISTENCE =================
    camp = page.evaluate(STORED)["slice"]["campaign"]["id"]
    page.reload(); page.wait_for_timeout(1300)
    st = launch(page)
    check("reload resumes the same campaign at its safe anchor with full Flame", st["data"]["campaign"]["id"] == camp and st["petId"] == pet_id and st["sim"]["roomId"] == "hearth" and abs(st["sim"]["player"]["x"] - 200) < 0.1 and st["sim"]["player"]["flame"] == 5 and st["shell"] == "locked", str((st["sim"]["roomId"], st["sim"]["player"])))
    for key in page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('rizo-mode-run:'))"): page.evaluate(f"localStorage.removeItem('{key}')")
    page.evaluate("localStorage.removeItem('rizo-mode-run:dungeon')")
    page.reload(); page.wait_for_timeout(1300)
    check("deleted mode-run keys do not touch the journey (it never uses one)", page.evaluate(STORED)["slice"]["campaign"]["id"] == camp)

    # Exit: system key → GO HOME → the real Den.
    st = launch(page)
    page.keyboard.press("Escape"); page.wait_for_timeout(80)
    page.evaluate("document.querySelector('[data-dungeon-action=\"home\"]').click()"); page.wait_for_timeout(900)
    view = page.evaluate("RizoRuntimeQA.currentViewForQA()")
    toasts = page.evaluate("document.getElementById('toastStack').textContent")
    check("GO HOME saves and returns to the real Den with JOURNEY SAVED", page.evaluate("RizoModes.active()") is None and view == "home" and "JOURNEY SAVED" in toasts, str((view, toasts[:80])))
    unlocked = page.evaluate("({html:document.documentElement.classList.contains('dungeon-locked'),body:getComputedStyle(document.body).position,select:getComputedStyle(document.body).userSelect||getComputedStyle(document.body).webkitUserSelect})")
    check("leaving restores normal Hub scrolling and selection", not unlocked["html"] and unlocked["body"] != "fixed" and unlocked["select"] != "none", str(unlocked))
    check("the hub records returnedToHub and releases the care hold", any(e["kind"] == "returnedToHub" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")) and page.evaluate("RizoRuntimeQA.careHoldForQA()") is None)
    fed = page.evaluate("(()=>{const before=RizoRuntimeQA.snapshot().pet.hunger;RizoRuntimeQA.useFoodForQA('crumbs');return [before,RizoRuntimeQA.snapshot().pet.hunger]})()")
    check("feeding works in the Den afterwards; no modal interrupts the return", fed[1] > fed[0] and not page.evaluate("document.getElementById('modalOverlay').classList.contains('show')"), str(fed))
    page.evaluate("RizoRuntimeQA.agePetClockForQA(3*3600e3)")
    pet3 = page.evaluate("RizoRuntimeQA.processElapsedForQA()")
    check("ordinary care resumes after exit", pet3["hunger"] < fed[1] - 2, str((fed[1], pet3["hunger"])))
    meta = page.evaluate("RizoRuntimeQA.setViewForQA('go'), document.querySelector('[data-mode-meta=\"dungeon\"]').innerText")
    check("the shelf shows the journey's progress", re.search(r"ROOM [1-6]/6", meta) is not None, meta)

    # Export → import keeps the journey.
    text = page.evaluate("localStorage.getItem('rizo-save-v2')")
    imp = Path("/tmp/rizo-dungeon-import.json"); imp.write_text(text)
    page.evaluate("RizoModes.launch('dungeon',{})"); page.wait_for_timeout(300)
    page.evaluate("RizoRuntimeQA.loadForQA(RizoRuntimeQA.defaultState())"); page.wait_for_timeout(200)
    page.set_input_files("#importSaveInput", str(imp)); page.wait_for_timeout(700)
    s = page.evaluate(STORED)
    check("export/import keeps the journey, bound to the same pet", s["slice"] and s["slice"]["campaign"]["id"] == camp and s["petId"] == pet_id, str(s["slice"] and s["slice"]["campaign"]))
    check("the replaced timeline stays restorable from Keeper Recovery", page.evaluate("RizoRuntimeQA.preRecoveryForQA()") is not None)

    # ================= IDENTITY =================
    page.evaluate("RizoRuntimeQA.setViewForQA('farm')"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-house-pet-detail=\"0\"]')?.click()"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-farm-swap=\"0\"]')?.click()"); page.wait_for_timeout(400)
    swapped = page.evaluate("RizoRuntimeQA.snapshot().pet.name")
    st = launch(page)
    panel = page.evaluate("document.querySelector('.dungeon-panel').textContent")
    check("a House swap cannot rebind the journey: the player is told to activate MOSSY", swapped == "LODGER" and st["ui"] == "blocked" and "MOSSY IS IN THE HOUSE" in panel and page.evaluate(STORED)["slice"]["campaign"]["petId"] == pet_id, str((swapped, panel[:80])))
    page.evaluate("document.querySelector('[data-dungeon-action=\"leave\"]').click()"); page.wait_for_timeout(800)
    idx = page.evaluate(f"RizoRuntimeQA.snapshot().farm.roster.findIndex(p=>p.id==='{pet_id}')")
    note = page.evaluate(f"RizoRuntimeQA.releaseFarmPetForQA({idx})")
    check("releasing the journey's pet shows a warning first", "RIZO DUNGEON" in note and "MOSSY" in note, note[-200:])
    page.evaluate(f"document.querySelector('[data-confirm-release=\"{idx}\"]').click()"); page.wait_for_timeout(300)
    st = launch(page)
    panel = page.evaluate("document.querySelector('.dungeon-panel').textContent")
    check("after release the journey is kept, explained, and never moves to another Rizo", st["ui"] == "blocked" and "isn't with you" in panel and page.evaluate(STORED)["slice"]["campaign"]["petId"] == pet_id)
    page.evaluate("document.querySelector('[data-dungeon-action=\"leave\"]').click()"); page.wait_for_timeout(800)
    check("entry and identity flows raise no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ================= THE v0.3 OPENING: fourteen scenes, car to HOME ↑ =================
    def jump(page, ms):
        page.evaluate(f"RizoRuntimeQA.dungeonSceneTimeForQA({ms})")
    def op(page):
        return page.evaluate(ST)["opening"]
    def sid(page):
        s = page.evaluate(ST)
        return s["scene"]["id"] if s["scene"] else None
    def hoods(page):
        return sum(n["id"].startswith("hood") for n in page.evaluate(ST)["npcs"])
    def wait_for_dialogue(page, limit=60):
        for _ in range(limit):
            if page.evaluate(ST)["dialogue"]: return True
            page.wait_for_timeout(100)
        return False
    def to_scene(page, scene_id, step=500, limit=600, press=True):
        """Fast-forward the scene clock (pressing through lines) until a scene starts."""
        for _ in range(limit):
            s = page.evaluate(ST)
            if s["scene"] and s["scene"]["id"] == scene_id: return s
            if s["dialogue"] and press: page.keyboard.press("z")
            jump(page, step); page.wait_for_timeout(20)
        return page.evaluate(ST)
    def to_room(page, room_id, step=500, limit=600):
        for _ in range(limit):
            s = page.evaluate(ST)
            if s["sim"]["roomId"] == room_id: return s
            if s["dialogue"]: page.keyboard.press("z")
            for e in s["sim"]["enemies"]:
                if e["kind"] == "cargo" and e["state"] == "windup": page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:1,secondaryPressed:true})")
            jump(page, step); page.wait_for_timeout(20)
        return page.evaluate(ST)
    def to_pred(page, limit=60):
        """Run the scene clock forward until the scene waits on the player."""
        for _ in range(limit):
            s = page.evaluate(ST)
            if s["scene"] and s["scene"]["waiting"] == "pred": return s
            jump(page, 300); page.wait_for_timeout(20)
        return page.evaluate(ST)
    def pose_class(page):
        return page.evaluate("document.querySelector('.dungeon-pose').className")
    def hold(page, key, ms):
        page.keyboard.down(key); page.wait_for_timeout(ms); page.keyboard.up(key); page.wait_for_timeout(60)
    def beats(page):
        return page.evaluate(STORED)["slice"]["story"]["committedSceneBeats"]
    def end_parked(page):
        """Scene 1, the quick way: greet YOU, then let 20 s pass."""
        page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(190,250)"); hold(page, "a", 250)
        for _ in range(80):
            if page.evaluate(ST)["dialogue"] is None: break
            page.keyboard.press("z"); page.wait_for_timeout(60)
        jump(page, 21000); page.wait_for_timeout(100)
    def to_waiting(page):
        end_parked(page)
        return to_scene(page, "opening:waiting", step=400)

    # ---- Scene 1 · Parked
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    st = launch(page)
    st = page.evaluate(ST)
    check("Scene 1: a new journey opens in the Keeper's parked car, shell open, no music", st["sim"]["roomId"] == "car" and st["shell"] == "open" and st["music"] == "dungeon-silence" and st["scene"]["id"] == "opening:parked", str((st["sim"]["roomId"], st["shell"], st["music"])))
    check("1.1: it fades in from black with control removed, YOU in the driver's seat", st["ui"] == "scene" and st["fade"] > 0.3 and any(n["id"] == "you-seat" and n["visible"] for n in st["npcs"]) and st["dialogue"] is None, str((st["ui"], st["fade"])))
    page.wait_for_timeout(4300)
    st = page.evaluate(ST)
    check("1.2: after the 4 s fade-in, control is his (full: move, Flare, LOOK)", st["ui"] == "play" and st["scene"]["control"] and abs(st["sim"]["player"]["x"] - 203) < 1, str((st["ui"], st["scene"])))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(195,250)"); hold(page, "a", 300)
    st = page.evaluate(ST)
    check("approaching YOU: “Hi. Yes. Hi.” in YOU's dialogue box", st["dialogue"] and st["dialogue"]["text"] == "Hi. Yes. Hi." and st["dialogue"]["speaker"] == "you", str(st["dialogue"]))
    page.wait_for_timeout(5900)
    check("a line to Rizo closes itself about 5 s after it is shown (no press needed)", page.evaluate(ST)["dialogue"] is None)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(203,252)"); page.wait_for_timeout(150)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(190,250)"); hold(page, "a", 300)
    check("YOU never repeats: approaching again says nothing", page.evaluate(ST)["dialogue"] is None and op(page)["reactions"] == ["approach"])
    check("…and YOU's LOOK prompt goes once YOU has answered", page.evaluate("document.querySelector('.dungeon-prompt').hidden"))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(200,214)"); hold(page, "w", 250)
    st = page.evaluate(ST)
    check("the dash: “Off the dash, please.”", st["dialogue"] and st["dialogue"]["text"] == "Off the dash, please.", str(st["dialogue"]))
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(203,290)"); page.wait_for_timeout(120)
    page.keyboard.press("z"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("a Flare: “Okay, show-off.” (the spark lights the car's ceiling)", st["dialogue"] and st["dialogue"]["text"] == "Okay, show-off.", str(st["dialogue"]))
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(206,262)"); hold(page, "d", 300)
    st = page.evaluate(ST)
    check("the side window: “It's just rain.”", st["dialogue"] and st["dialogue"]["text"] == "It's just rain.", str(st["dialogue"]))
    press_until_closed(page)
    check("each reaction once, in the order he found them", op(page)["reactions"] == ["approach", "dash", "flare", "window"], str(op(page)["reactions"]))
    check("Scene 1 holds until 20 s have passed even after every reaction", sid(page) == "opening:parked")
    parked_at = op(page)["parkedAt"]
    jump(page, max(0, 20500 - (page.evaluate(ST)["sceneTime"] - parked_at))); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("Scene 2 begins at ≥ 20 s: control removed, YOU takes the keys", st["ui"] in ("scene", "dialogue") and st["opening"]["phase"] == "leaving", str((st["ui"], st["opening"].get("phase"))))
    wait_for_dialogue(page)
    st = page.evaluate(ST)
    check("2.2: the accepted line, with the pet's own name (MOSSY → “Mossy”)", st["dialogue"] and st["dialogue"]["text"] == "Alright Mossy, I'm gonna go in the store real quick." and st["dialogue"]["lines"] == 1, str(st["dialogue"]))
    press_until_closed(page); page.wait_for_timeout(300)
    wait_for_dialogue(page)
    st = page.evaluate(ST)
    check("2.3: the dome light clicks on before “There. Light's on.”", st["opening"]["dome"] > 0.5, str(st["opening"].get("dome")))
    check("2.3: “There. Light's on.”", (page.evaluate(ST)["dialogue"] or {}).get("text") == "There. Light's on.")
    press_until_closed(page); page.wait_for_timeout(200)
    wait_for_dialogue(page)
    st = page.evaluate(ST)
    check("2.4: the door opens and “Be good.” lands alone, YOU still in the car", st["dialogue"] and st["dialogue"]["text"] == "Be good." and st["dialogue"]["lines"] == 1 and any(n["id"] == "you-seat" and n["visible"] for n in st["npcs"]), str(st["dialogue"]))
    press_until_closed(page); page.wait_for_timeout(700)
    st = page.evaluate(ST)
    check("then a held silence: no line, no control, YOU not gone yet", st["dialogue"] is None and st["ui"] == "scene" and not st["transient"].get("youGone"), str((st["ui"], st["transient"])))
    page.wait_for_timeout(1100)
    st = page.evaluate(ST)
    check("2.5 THUNK: YOU is outside, crossing the lot; he follows with his whole body at the glass", st["transient"].get("youGone") and any(n["id"] == "keeper" and n["visible"] for n in st["npcs"]) and st["pose"] == "press-glass" and st["ui"] == "scene", str((st["transient"], st["pose"])))
    thunk_t = page.evaluate(ST)["sceneTime"]
    for _ in range(80):
        if page.evaluate(ST)["ui"] == "play": break
        page.wait_for_timeout(100)
    st = page.evaluate(ST)
    check("control returns about 5 s after THUNK (1 s after the store's chime)", st["ui"] == "play" and 4000 <= st["sceneTime"] - thunk_t <= 6200 and "opening:left" in beats(page), str(st["sceneTime"] - thunk_t))
    check("the keeper is inside the store, not on the lot", not any(n["id"] == "keeper" and n["visible"] for n in st["npcs"]) and st["scene"]["id"] == "opening:waiting")

    # ---- Scene 3 · Waiting
    vis = []
    t0 = page.evaluate(ST)["opening"]["waitStart"]
    for _ in range(20):
        jump(page, 1000); vis.append(op(page)["you"]["visible"])
    check("YOU drifts between the aisles, in sight about 70% of the time", 13 <= sum(vis) <= 15, str(sum(vis)))
    check("looking around brings nothing: 20 s in, still only waiting", sid(page) == "opening:waiting" and hoods(page) == 0)
    # At the glass: YOU goes out of sight and back.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(190,208)"); page.wait_for_timeout(100)
    t = page.evaluate(ST)["sceneTime"] - t0
    k = (t / 1000) % 20
    jump(page, int((7.2 - k) * 1000) if k < 7 else int((27.2 - k) * 1000)); page.wait_for_timeout(120)
    check("at the glass when YOU goes out of sight: he presses to it", page.evaluate(ST)["pose"] == "press-glass" and not op(page)["you"]["visible"], str((page.evaluate(ST)["pose"], op(page).get("you"))))
    jump(page, 2000); page.wait_for_timeout(120)
    check("…and eases when YOU comes back", page.evaluate(ST)["pose"] == "settle" and op(page)["you"]["visible"], str((page.evaluate(ST)["pose"], op(page).get("you"))))
    jump(page, 1700); page.wait_for_timeout(80)
    check("seeing YOU through the glass for 1.5 s counts (seenYou)", op(page)["seenYou"] is True)
    t = page.evaluate(ST)["sceneTime"] - t0
    jump(page, int(max(0, 34000 - t))); page.wait_for_timeout(100)
    check("the dome light is still on before 35 s", op(page)["dome"] > 0.9, str(op(page)["dome"]))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(203,290)"); page.wait_for_timeout(120)
    jump(page, 1500); page.wait_for_timeout(80)
    check("3.2: at 35 s the dome light times out; away from the glass he pulls in", op(page)["domeOut"] and page.evaluate(ST)["pose"] == "pull-in", str((op(page).get("domeOut"), page.evaluate(ST)["pose"])))
    jump(page, 3200); page.wait_for_timeout(80)
    check("…fading over 3 s: he is the only light inside now", op(page)["dome"] < 0.02)
    jump(page, 12500); page.wait_for_timeout(80)
    check("3.3: a shopping cart rattles past at about 50 s", any(n["id"] == "cart" for n in page.evaluate(ST)["npcs"]) and op(page)["cartDone"])
    check("3.4: seenYou never shortens the wait below 60 s", sid(page) == "opening:waiting" and hoods(page) == 0 and page.evaluate(ST)["sceneTime"] - t0 < 60000)
    jump(page, max(0, 60500 - (page.evaluate(ST)["sceneTime"] - t0))); page.wait_for_timeout(120)
    check("…and at 60 s with YOU seen, the headlights begin", op(page)["phase"] == "headlights", str(op(page).get("phase")))

    # ---- Scene 4 · Headlights (nothing he does changes it)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(204,222)")
    jump(page, 1600); page.wait_for_timeout(80)
    st = page.evaluate(ST)
    check("4.1: he senses it first: the flame pulls in before anything is seen", st["pose"] == "pull-in" and st["lightScale"] < 0.9 and not any(n["id"] == "van" for n in st["npcs"]), str((st["pose"], st["lightScale"])))
    jump(page, 2600); page.wait_for_timeout(80)
    st = page.evaluate(ST)
    check("4.2: headlights sweep the cabin and one held low tone begins", st["opening"].get("sweepAt") is not None and st["music"] == "dungeon-dread" and any(n["id"] == "van" for n in st["npcs"]), str(st["music"]))
    jump(page, 3100); page.wait_for_timeout(80)
    check("4.3: the van parks behind; lights off; nothing happens (no one yet)", op(page).get("vanParked") is not None and hoods(page) == 0 and page.evaluate(ST)["ui"] == "play")
    page.wait_for_timeout(300)
    # He hides in the footwell for all of it. Nothing is recorded.
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(206,222)"); page.wait_for_timeout(250)
    st = page.evaluate(ST)
    check("the footwell is the darkest place: he curls small there", st["opening"]["hiding"] and "pose-curl" in pose_class(page) and st["lightScale"] <= 0.6, str((st["opening"].get("hiding"), st["lightScale"])))
    facts_before = page.evaluate(STORED)["slice"]["story"]
    order = []
    for _ in range(60):
        jump(page, 400); page.wait_for_timeout(20)
        st = page.evaluate(ST)
        for b in st["barks"]:
            if b["text"] not in order: order.append(b["text"])
        if st["opening"].get("passengerDoor"): break
    check("4.4–4.6 play as overheard barks, in order, word for word", order[:5] == ["Two minutes.", "That him?", "Obviously.", "Bro. It's glowing.", "Don't tap the glass."], str(order))
    check("the barks never take control from him", st["ui"] == "play")
    check("hiding records nothing", page.evaluate(STORED)["slice"]["story"] == facts_before)
    check("the window LOOK is gone once they come (no line can cover the abduction)", page.evaluate("document.querySelector('.dungeon-prompt').hidden"))

    # ---- Scene 5 · Taken
    jump(page, 1600); page.wait_for_timeout(80)
    check("5.1: the door is forced", op(page).get("passengerDoor") is not None and op(page)["phase"] == "taken")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(150,300)"); page.wait_for_timeout(60)
    page.keyboard.press("z"); page.wait_for_timeout(150)
    b1 = [b["text"] for b in page.evaluate(ST)["barks"]]
    page.wait_for_timeout(400); page.keyboard.press("z"); page.wait_for_timeout(150)
    b2 = [b["text"] for b in page.evaluate(ST)["barks"]]
    check("5.2: a first Flare makes them flinch (“Yo—”); a later one: “It's hot! It's hot!”", "Yo—" in b1 and "It's hot! It's hot!" in b2, str((b1, b2)))
    for _ in range(40):
        hold(page, "s", 120)
        if op(page).get("grabbed"): break
    st = page.evaluate(ST)
    check("he cannot get away: the hands have him within 6 s", st["opening"].get("grabbed") is True and st["ui"] == "scene", str(st["opening"].get("hands")))
    page.wait_for_timeout(300)
    check("5.3: through the windshield, YOU at the counter, back turned", op(page).get("youCounter") is True)
    jump(page, 2500); page.wait_for_timeout(100)
    check("5.4: “Bag. Bag.” and the pillowcase", "Bag. Bag." in [b["text"] for b in page.evaluate(ST)["barks"]] and op(page).get("bagAt") is not None)
    st = to_room(page, "sack", step=300)
    check("taken is committed once, and he is in the dark", st["sim"]["roomId"] == "sack" and beats(page).count("opening:taken") == 1 and "in-sack" in pose_class(page))

    # ---- Scene 6 · The sack
    page.wait_for_timeout(300)
    st = page.evaluate(ST)
    check("6.1: in the sack, no control for 4 s, the HUD names no room", st["ui"] == "scene" and page.evaluate("document.querySelector('.dungeon-room-name').textContent") == "", str(st["ui"]))
    page.wait_for_timeout(4200)
    check("6.2: then limited control: he can push", page.evaluate(ST)["ui"] == "play")
    for key in ["a", "d", "w"]:
        hold(page, key, 160); page.wait_for_timeout(200)
    check("three bursts shake him free", op(page)["bursts"] >= 3, str(op(page).get("bursts")))
    st = to_room(page, "van", step=200, limit=60)
    check("6.3: he tumbles onto the van floor", st["sim"]["roomId"] == "van" and st["scene"]["id"] == "opening:van")

    # ---- Scene 7 · The van (Track A, unchanged)
    page.wait_for_timeout(2200)
    st = page.evaluate(ST)
    check("7.1: the front seats argue in bubbles; nothing to press through", st["dialogue"] is None and st["ui"] == "play" and any(b["text"] in ("I thought you said he didn't do that fire shit.", "I said probably.") for b in st["barks"]), str((st["ui"], st["barks"])))
    x0 = st["sim"]["player"]["x"]
    hold(page, "d", 400)
    st = page.evaluate(ST)
    check("the talk never blocks him: he moves while they speak", st["sim"]["player"]["x"] > x0 + 4 and st["ui"] == "play", str((x0, st["sim"]["player"]["x"])))
    for _ in range(30):
        if page.evaluate(ST)["barks"]: break
        page.wait_for_timeout(80)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(128,70)"); page.wait_for_timeout(100); page.keyboard.press("z"); page.wait_for_timeout(150)
    st = page.evaluate(ST)
    held = [b["text"] for b in st["barks"]]
    jump(page, 6000); page.wait_for_timeout(120)
    after = [b["text"] for b in page.evaluate(ST)["barks"]]
    check("a LOOK pauses the talk: the line on screen waits under the box, nothing is skipped", st["dialogue"] is not None and held and after == held, str((held, after)))
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(80,98)")
    order, saw_bump, van_start = [], False, page.evaluate(ST)["sceneTime"]
    for _ in range(500):
        jump(page, 300); page.wait_for_timeout(25)
        st = page.evaluate(ST)
        for b in st["barks"]:
            if b["text"] not in order: order.append(b["text"])
        if not saw_bump and any(e["kind"] == "cargo" and e["state"] == "windup" for e in st["sim"]["enemies"]):
            saw_bump = True
            check("a bump sends a loose cooler down a shown line; the TUCK key wakes once", page.evaluate("document.querySelector('.dungeon-key-secondary').classList.contains('is-pulsing')"))
            page.keyboard.down("s"); page.keyboard.press("x"); page.wait_for_timeout(250); page.keyboard.up("s")
            page.wait_for_timeout(900)
            check("Tuck curls him out of the way; a miss would only bump, never burn", page.evaluate(ST)["sim"]["player"]["flame"] == 5)
        if st["sim"]["flags"].get("vanDoorLoose"): break
    expected = page.evaluate("(()=>{const L=RizoDungeonContent.LINES;return [...L.vanArgue,...L.vanTouch,...L.vanFilm,...L.bump,...L.vanCooler,...L.vanNumber,...L.vanAsk,...L.vanPhone,...L.vanLost,...L.vanListening].map(l=>l.text)})()")
    check("the van plays its three movements in order, overheard, nothing added or skipped", order == expected, str(order))
    check("every accepted RC2 van line survives word for word", all(x in order for x in ["I thought you said he didn't do that fire shit.", "I said probably.", "My bad. Pothole."]))
    check("nobody is named and nothing is explained in the van", not any(w in " ".join(order).lower() for w in ["because", "boss is", "company", "symbol"]), " | ".join(order))

    # ---- Scene 8 · The gap (held push; never persisted)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(204,96)"); page.wait_for_timeout(300)
    st = page.evaluate(ST)
    check("8.1: the door works loose after the talk; at the gap, black and rain", st["sim"]["flags"].get("vanDoorLoose") and "van-door-zone" in st["sim"]["zones"] and st["opening"].get("gapAt") is not None)
    check("8.2: he leans back from the dark, his flame pulled tight", "pose-lean-back" in pose_class(page) and st["lightScale"] <= 0.8, str((pose_class(page), st["lightScale"])))
    page.keyboard.down("d"); page.wait_for_timeout(700)
    x_before = page.evaluate(ST)["sim"]["player"]["x"]
    page.keyboard.up("d"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("letting go before 1.5 s: he retreats one step, and the push starts over", st["opening"]["retreats"] == 1 and st["opening"]["push"] == 0 and st["sim"]["player"]["x"] < x_before - 5 and st["scene"]["id"] == "opening:van", str((st["opening"], x_before, st["sim"]["player"]["x"])))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(204,96)"); page.wait_for_timeout(100)
    hold(page, "d", 1750)
    st = page.evaluate(ST)
    check("a continuous 1.5 s push carries him through", st["opening"].get("through") == "push" and st["ui"] == "scene", str(st["opening"].get("through")))
    st = to_room(page, "roadside", step=300, limit=40)
    s = page.evaluate(STORED)
    check("8.3: he falls; the fell beat is committed, and the gap is not (no jumpedGap)", st["sim"]["roomId"] == "roadside" and "opening:fell" in s["slice"]["story"]["committedSceneBeats"] and "jumpedGap" not in json.dumps(s["slice"]), str(s["slice"]["story"]))

    # ---- Scene 9 · Taillights and the search (being seen never costs anything)
    to_pred(page); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("9.1: alone by the road he lies still until the player asks him to move", st["pose"] == "lying" and st["ui"] == "scene", str((st["pose"], st["ui"])))
    hold(page, "w", 300); page.wait_for_timeout(1500)
    check("one press and he gets up", page.evaluate(ST)["ui"] == "play")
    jump(page, 2200); page.wait_for_timeout(80)
    check("9.2: far up the road the taillights stop: brake red", op(page).get("brake") is True)
    jump(page, 2200); page.wait_for_timeout(100)
    st = page.evaluate(ST)
    check("9.3: a phone flashlight comes back along the shoulder, two of them", st["opening"].get("beam") is not None and {"hood-tall", "hood-small"} <= {n["id"] for n in st["npcs"]} and st["music"] == "dungeon-dread", str(st["opening"].get("beam")))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(36,1250)"); page.wait_for_timeout(300)
    seen0 = op(page)["seenCount"]
    page.wait_for_timeout(1500)
    st = page.evaluate(ST)
    check("in the ditch's shadow, not Flaring, he is hidden: curled small, the beam passes", st["opening"]["hidden"] and not st["opening"]["inBeam"] and "pose-curl" in pose_class(page) and st["opening"]["seenCount"] == seen0, str(st["opening"]))
    page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{primaryPressed:true})"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("a Flare gives him away even in shadow: the beam stops on him", st["opening"]["seenCount"] == seen0 + 1, str(st["opening"]))
    check("…and a voice: “Yo— was that—” (no capture, no failure)", any(b["text"] == "Yo— was that—" for b in st["barks"]) and st["ui"] == "play" and st["sim"]["roomId"] == "roadside" and st["sim"]["phase"] == "play", str(st["barks"]))
    page.wait_for_timeout(3000)
    seen1 = op(page)["seenCount"]
    page.evaluate("""(()=>{const s=RizoRuntimeQA.dungeonStateForQA();const b=s.opening.beam;const x=b.x+Math.cos(b.angle)*70,y=b.y+Math.sin(b.angle)*70;RizoRuntimeQA.dungeonTeleportForQA(Math.max(60,Math.min(176,x)),y);})()"""); page.wait_for_timeout(150)
    st = page.evaluate(ST)
    check("standing in the beam out of shadow is seen too, and still nothing happens to him", st["opening"]["seenCount"] >= seen1 + 1 and st["sim"]["phase"] == "play" and st["ui"] == "play", str(st["opening"]))
    hood = next(n for n in st["npcs"] if n["id"] == "hood-tall")
    check("the searchers keep to their walk; nobody comes for him", abs(hood["x"] - 178) < 20, str(hood))
    order = []
    for _ in range(80):
        jump(page, 400); page.wait_for_timeout(20)
        st = page.evaluate(ST)
        for b in st["barks"]:
            if b["text"] not in order: order.append(b["text"])
        if st["opening"].get("searchOver"): break
    check("their talk, word for word, then another car and they go", [x for x in order if x != "Yo— was that—"] == ["It went off right here.", "It's dark as hell.", "It's a flame. Look for the light.", "I don't see no light.", "Car! Somebody's coming!", "We can't go back without it.", "We can't go back at all if we get pulled over.", "You said probably."] or [x for x in order if x != "Yo— was that—"][-4:] == ["Car! Somebody's coming!", "We can't go back without it.", "We can't go back at all if we get pulled over.", "You said probably."], str(order))
    st = page.evaluate(ST)
    check("9.5: they are gone; music off, rain only; the search is committed", st["opening"]["searchOver"] and st["music"] == "dungeon-silence" and "opening:searched" in beats(page) and not any(n["id"].startswith("hood") for n in st["npcs"]))
    check("nothing in the search names anyone or says why", not any(w in " ".join(order).lower() for w in ["boss", "because", "company", "symbol"]))

    # ---- Scene 10 · The ringing (touched)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(150,1300)")
    jump(page, 8200); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    ph = st["opening"].get("phone") or {}
    check("10.1: a dropped phone lights up in the grass about 40 units away", ph.get("state") == "ringing" and 30 <= ((ph["x"] - 150) ** 2 + (ph["y"] - 1300) ** 2) ** 0.5 <= 50, str(ph))
    inset = page.evaluate("(()=>{const e=document.querySelector('.dungeon-phone');return {hidden:e.hidden,text:e.innerText.trim(),symbol:Boolean(e.querySelector('[data-caller-symbol=\"CALLER_SYMBOL\"]'))}})()")
    check("its screen shows only CALLER_SYMBOL (a placeholder), no words", not inset["hidden"] and inset["symbol"] and inset["text"] == "", str(inset))
    page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({ph['x'] + 12},{ph['y']})"); page.wait_for_timeout(150)
    prompt = page.evaluate("[document.querySelector('.dungeon-prompt').hidden, document.querySelector('.dungeon-prompt').textContent]")
    a0 = page.evaluate(ST)["sim"]["player"]["attacks"]
    page.keyboard.press("z"); page.wait_for_timeout(300)
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("10.2: touching it connects the call: committed first (callerConnected)", st["opening"]["phone"]["state"] == "connected" and s["slice"]["story"]["facts"].get("callerConnected") is True and "opening:phone" in s["slice"]["story"]["committedSceneBeats"] and prompt[0] is False, str((prompt, s["slice"]["story"]["facts"])))
    check("touching is not a Flare", st["sim"]["player"]["attacks"] == a0)
    page.wait_for_timeout(2300)
    inset = page.evaluate("document.querySelector('.dungeon-phone').innerText.trim()")
    check("the screen: the symbol and a running call timer, nothing else; no narration", re.fullmatch(r"00:0[1-4]", inset) is not None and page.evaluate(ST)["dialogue"] is None, inset)
    jump(page, 3000); page.wait_for_timeout(150)
    check("after 5 s the screen goes dark", op(page)["phone"]["state"] == "dark" and page.evaluate("document.querySelector('.dungeon-phone').hidden"))
    check("callerConnected stays the only new opening fact", set(page.evaluate(STORED)["slice"]["story"]["facts"]) <= {"callerConnected"} and page.evaluate(STORED)["slice"]["story"]["choices"] == {})

    # ---- Scene 11 · The walk, one car that is not YOU
    jump(page, 3200); page.wait_for_timeout(100)
    check("the walk's sparse music comes back after the phone", page.evaluate(ST)["music"] == "dungeon-street")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(140,1030)"); hold(page, "w", 500)
    check("RC2's bowl: he approaches and stops (no text forced)", page.evaluate(ST)["pose"] == "approach-stop" and page.evaluate(ST)["dialogue"] is None)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,770)"); hold(page, "w", 400)
    check("11.2: at the midpoint, one car passes from behind", (op(page).get("pass") or {}).get("kind") == "walk")
    page.wait_for_timeout(1800)
    p1 = page.evaluate(ST)["pose"]
    page.wait_for_timeout(900)
    p2 = page.evaluate(ST)["pose"]
    check("its light washes over him: he flinches, then turns and watches it go", p1 in ("recoil", "watch") and p2 == "watch", str((p1, p2)))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,800)"); hold(page, "w", 500)
    check("only one car passes", op(page)["passedOnce"] and (op(page).get("pass") is None or op(page)["pass"]["kind"] == "walk"))

    # ---- Scene 12 · The drain
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(100,70)"); hold(page, "w", 700); page.wait_for_timeout(500)
    st = page.evaluate(ST)
    check("12.1: shelter: the drain is quieter and he shakes off the rain", st["sim"]["roomId"] == "drain" and st["pose"] in ("shake", "settle"), str((st["sim"]["roomId"], st["pose"])))
    page.wait_for_timeout(1500)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(78,690)"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(150)
    check("the dry glove is still there", (page.evaluate(ST)["dialogue"] or {}).get("text") == "A glove. Dry. Somebody waited here once.")
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,700)"); page.wait_for_timeout(100)
    jump(page, int(max(0, 29000 - op(page).get("mouthFor", 0)))); page.wait_for_timeout(80)
    check("12.3 waits: no headlights before 30 s near the mouth", not op(page).get("headlightsDone"))
    jump(page, 1500); page.wait_for_timeout(80)
    check("…at 30 s, once: headlights sweep in and he flinches deeper", op(page).get("headlightsDone") and page.evaluate(ST)["pose"] == "recoil")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,128)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})"); page.wait_for_timeout(100)
    page.keyboard.press("z"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(120)
    check("at the black back: “Warm air. From down there.”", (page.evaluate(ST)["dialogue"] or {}).get("text") == "Warm air. From down there.")
    press_until_closed(page)
    check("no objective marker tells him to go deeper", page.evaluate("document.querySelector('.dungeon-banner').hidden && document.querySelector('.dungeon-cue').hidden"))

    # ---- Scene 13 · The fall: a recoverable slip, then the irreversible one
    page.keyboard.down("w")
    for _ in range(80):
        if op(page).get("slope"): break
        page.wait_for_timeout(30)
    page.keyboard.up("w")
    check("13.1: on the slope he slips (pose), control still his", op(page).get("slope") == "slip" and page.evaluate(ST)["pose"] == "slip" and page.evaluate(ST)["ui"] == "play")
    page.wait_for_timeout(700)
    hold(page, "s", 200)
    check("any move inside the 1.2 s window scrambles him back up", op(page).get("slope") in ("recovered", "armed"), str(op(page).get("slope")))

    def watch_fall(page, hold_ms=0):
        """Record the fall frame by frame until he is seen below."""
        import time as _t
        rows, silent_open, lock_rows, banner_seen = [], False, [], False
        t0 = _t.time()
        if hold_ms: page.keyboard.down("w")
        released = not hold_ms
        for _ in range(500):
            st = page.evaluate(ST)
            now_ms = (_t.time() - t0) * 1000
            if not released and (now_ms > hold_ms or (st["scene"] and st["scene"]["id"] == "opening:fall")):
                page.keyboard.up("w"); released = True
            sid_ = st["scene"] and st["scene"]["id"]
            if sid_ == "opening:fall" and st["silent"] and st["shell"] == "open" and st["fade"] >= 0.99: silent_open = True
            if st["shell"] == "locking": lock_rows.append((now_ms, st["impactAt"] is not None, st["sim"]["roomId"]))
            if not page.evaluate("document.querySelector('.dungeon-banner').hidden"): banner_seen = True
            fx = page.evaluate("Boolean(document.querySelector('.dungeon-fallfx').dataset.on)")
            rows.append((now_ms, st["sim"]["roomId"], st["shell"], sid_, st["fade"], st["actorLight"], fx, st["silent"]))
            if st["sim"]["roomId"] == "slip" and sid_ is None: break
            if st["sim"]["roomId"] == "slip" and len([r for r in rows if r[1] == "slip"]) > 40: break
            page.wait_for_timeout(30)
        if not released: page.keyboard.up("w")
        return rows, silent_open, lock_rows, banner_seen

    rows, silent_open, lock_rows, banner_seen = watch_fall(page)
    fall_rows = [r for r in rows if r[3] == "opening:fall"]
    check("13.2: three seconds after recovering, the second slip: irreversible", fall_rows and rows[0][3] in (None, "opening:fall"), str(rows[:3]))
    check("13.3: falling in the black, his flame streaking (fall effects drawn above the dark)", any(r[6] for r in fall_rows))
    check("13.4: every sound stops just before impact, the screen already black", silent_open)
    first_lock = lock_rows[0] if lock_rows else None
    slip_at = next((r[0] for r in rows if r[1] == "slip"), None)
    check("13.5: the handheld stays open through the fall and locks on impact, not before", first_lock and first_lock[1] and first_lock[2] == "drain" and all(r[2] == "open" for r in fall_rows if not r[7] and r[0] < first_lock[0] - 50), str(first_lock))
    check("the lock keeps its ~560 ms", first_lock and slip_at and 400 <= slip_at - first_lock[0] <= 1100, str((first_lock, slip_at)))
    fall_start = fall_rows[0][0] if fall_rows else 0
    check("the fall runs about 0.3 s crack + 2.5 s in the black before impact", first_lock and 2300 <= first_lock[0] - fall_start <= 3900, str(first_lock and first_lock[0] - fall_start))
    landed = [r for r in rows if r[3] == "opening:landed"]
    check("a held black after impact: nothing seen for about 2 s", landed and all(r[4] >= 0.99 for r in landed if slip_at and r[0] - slip_at <= 1800), str([(round(r[0]), r[4]) for r in landed][:5]))
    check("no HOME banner appears on its own, not in the fall or the black", not banner_seen)

    # ---- Scene 14 · Awakening
    for _ in range(200):
        if op(page).get("wakeAt") is not None: break
        page.wait_for_timeout(50)
    st = page.evaluate(ST)
    t_wake = st["sceneTime"] - st["opening"]["wakeAt"]
    expected = 0 if t_wake < 1000 else 0.12 + 0.88 * (1 - (1 - min(1, (t_wake - 1000) / 10000)) ** 2)
    check("14.1: total black first, then a pinprick of his flame (presentation only: Flame stays full)", abs(st["actorLight"] - expected) < 0.06 and st["actorLight"] < 0.5 and st["sim"]["player"]["flame"] == 5 and st["shell"] == "locked", str((t_wake, st["actorLight"], st["sim"]["player"]["flame"])))
    hold(page, "a", 150); page.wait_for_timeout(200)
    check("input before 4 s does not wake him", page.evaluate(ST)["pose"] == "lying")
    page.wait_for_timeout(3800)
    st = page.evaluate(ST)
    check("the light keeps growing back over 10 s", 0.2 < st["lightScale"] < 1, str(st["lightScale"]))
    check("6 s in, the move key pulses once (the only hint)", page.evaluate("document.querySelector('.dungeon-dpad').classList.contains('is-pulsing')") or op(page).get("wakeAt") is not None)
    hold(page, "a", 150); page.wait_for_timeout(1200)
    st = page.evaluate(ST)
    check("14.2: he wakes when the player moves", st["ui"] == "play" and st["scene"] is None and op(page).get("awakeAt") is not None, str((st["ui"], st["scene"])))
    page.wait_for_timeout(1300)
    st = page.evaluate(ST)
    thought = page.evaluate("(()=>{const t=document.querySelector('.dungeon-thought');return {hidden:t.hidden,text:t.textContent,box:getComputedStyle(t).borderStyle,bg:getComputedStyle(t).backgroundColor,size:parseFloat(getComputedStyle(t).fontSize)}})()")
    check("14.4: standing still near the landing he looks up, and the thought “home?” appears", st["thought"] and st["thought"]["text"] == "home?" and st["pose"] == "look-up" and not thought["hidden"] and thought["text"] == "home?", str((st["thought"], st["pose"], thought)))
    check("the thought is its own thing: lowercase, small, no box, no portrait, no name", thought["text"].islower() and thought["size"] <= 14 and thought["box"] == "none" and thought["bg"] in ("rgba(0, 0, 0, 0)", "transparent") and page.evaluate("document.querySelector('.dungeon-dialogue').hidden"), str(thought))
    check("…committed once ever (thought:home) before it shows", beats(page).count("thought:home") == 1)
    check("nothing else talks over the thought (no prompt)", page.evaluate("document.querySelector('.dungeon-prompt').hidden"))
    page.wait_for_timeout(4200)
    check("the thought fades on its own", page.evaluate(ST)["thought"] is None and page.evaluate("document.querySelector('.dungeon-thought').hidden"))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(160,260)"); page.wait_for_timeout(1500)
    check("it never comes back, even standing still at the landing again", page.evaluate(ST)["thought"] is None)
    check("14.5: no HOME ↑ banner; below is silent until it is found", page.evaluate("document.querySelector('.dungeon-banner').hidden") and page.evaluate(ST)["music"] == "dungeon-silence")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(160,56)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})"); page.wait_for_timeout(100)
    page.keyboard.press("z"); page.wait_for_timeout(150); page.keyboard.press("z"); page.wait_for_timeout(120)
    st = page.evaluate(ST)
    check("the scratched sign is found by LOOK: the accepted line", st["dialogue"] and st["dialogue"]["text"] == "Someone scratched it with a key: HOME, and an arrow. Up.", str(st["dialogue"]))
    check("on that first read a new motif enters and the music returns", st["music"] == "dungeon-home")
    press_until_closed(page)
    s = page.evaluate(STORED)
    check("the opening's beats, in order, each once", [b for b in s["slice"]["story"]["committedSceneBeats"]] == ["opening:left", "opening:taken", "opening:fell", "opening:searched", "opening:phone", "opening:below", "thought:home"], str(s["slice"]["story"]["committedSceneBeats"]))
    check("the opening awards nothing and claims nothing", s["accessories"] == ["none", "scarf"] and not s["slice"]["proofComplete"] and s["slice"]["campaign"]["contentRevision"] == "threshold-v3")
    page.reload(); page.wait_for_timeout(1300)
    st = launch(page); page.wait_for_timeout(600)
    check("a reload below resumes in the locked handheld; no landing, no thought replayed", st["sim"]["roomId"] == "slip" and st["shell"] == "locked" and page.evaluate(ST)["scene"] is None and op(page).get("thoughtArmed") is False)
    page.wait_for_timeout(1200)
    check("…and the sign already found keeps the music below playing", page.evaluate(ST)["music"] == "dungeon-below")
    check("the opening raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ---- Idle / lingering: every cap and fallback, with nobody pressing anything
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); launch(page)
    # A journey whose save carries no pet name (YOU must still say a name).
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(300)
    unnamed = json.loads(page.evaluate("localStorage.getItem('rizo-save-v2')"))["modes"]["dungeon"]["data"]
    unnamed["campaign"]["petName"] = ""
    env = subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');const v=JSON.parse(process.argv[2]);
console.log(JSON.stringify(Save.createEnvelope({state:v.state,modes:{dungeon:{schema:1,data:JSON.parse(process.argv[3])}},savedAt:Date.now(),writeId:'W-UNNAMED',stateVersion:v.state.version})));""", str(ROOT), page.evaluate("localStorage.getItem('rizo-save-v2')"), json.dumps(unnamed)], capture_output=True, text=True, check=True).stdout.strip()
    ctx.close()
    ctx, page, errors = boot(browser, seed={V2: env, V2_BACKUP: env})
    launch(page)
    page.wait_for_timeout(4500)
    jump(page, 42000); page.wait_for_timeout(100)
    check("idle in the car: nothing at 42 s", page.evaluate(ST)["dialogue"] is None)
    jump(page, 3500); page.wait_for_timeout(150)
    check("idle 45 s: YOU says “It's just rain.” unprompted", (page.evaluate(ST)["dialogue"] or {}).get("text") == "It's just rain.")
    page.wait_for_timeout(5800)
    jump(page, 28000); page.wait_for_timeout(200)
    check("the 75 s cap ends Scene 1 even for a player who never moves", op(page)["phase"] == "leaving")
    wait_for_dialogue(page)
    check("a save without a pet name hears the fallback: “Alright Rizo, …”", (page.evaluate(ST)["dialogue"] or {}).get("text") == "Alright Rizo, I'm gonna go in the store real quick.", str(page.evaluate(ST)["dialogue"]))
    t_line = page.evaluate(ST)["sceneTime"]
    for _ in range(320):
        if page.evaluate(ST)["ui"] == "play": break
        page.wait_for_timeout(100)
    check("with no presses at all, YOU's lines close themselves and the scene goes on", page.evaluate(ST)["ui"] == "play" and sid(page) == "opening:waiting", str(page.evaluate(ST)["sceneTime"] - t_line))
    jump(page, 119000); page.wait_for_timeout(150)
    check("never looking out: still waiting at 119 s", op(page)["phase"] == "waiting" and not op(page)["seenYou"])
    jump(page, 1500); page.wait_for_timeout(150)
    check("…and the headlights at 120 s regardless", op(page)["phase"] == "headlights")
    st = to_room(page, "sack", step=500)
    check("without any input the abduction still happens (the hands come to him)", st["sim"]["roomId"] == "sack")
    page.wait_for_timeout(300)
    jump(page, 4100); page.wait_for_timeout(100); jump(page, 11500); page.wait_for_timeout(150)
    check("6.2: without a push he is not freed early", page.evaluate(ST)["sim"]["roomId"] == "sack")
    st = to_room(page, "van", step=300, limit=30)
    check("…but at 12 s the sack lets him go anyway", st["sim"]["roomId"] == "van")
    for _ in range(400):
        s_ = page.evaluate(ST)
        if s_["sim"]["flags"].get("vanDoorLoose"): break
        jump(page, 400); page.wait_for_timeout(15)
    jump(page, 9300); page.wait_for_timeout(150)
    check("8.1: not walking to the gap, he is moved there at 9 s", "van-door-zone" in page.evaluate(ST)["sim"]["zones"] and op(page).get("gapAt") is not None)
    jump(page, 9000); page.wait_for_timeout(100)
    check("no push, no jolt yet at 9 s at the gap", op(page).get("through") is None)
    jump(page, 1200); page.wait_for_timeout(100)
    check("8.2: at 10 s the van jolts and throws him regardless", op(page).get("through") == "jolt")
    st = to_room(page, "roadside", step=300, limit=30)
    to_pred(page); hold(page, "w", 200); page.wait_for_timeout(1500)
    for _ in range(80):
        if op(page).get("searchOver"): break
        jump(page, 500); page.wait_for_timeout(15)
    jump(page, 8200); page.wait_for_timeout(150)
    check("the phone rings whether or not he goes near it", op(page)["phone"]["state"] == "ringing")
    jump(page, 39000); page.wait_for_timeout(100)
    check("still ringing at 39 s", op(page)["phone"]["state"] == "ringing")
    jump(page, 1500); page.wait_for_timeout(150)
    s = page.evaluate(STORED)
    check("10.3: ignored, it rings out and goes dark; resolved, but no callerConnected", op(page)["phone"]["state"] == "dark" and "opening:phone" in s["slice"]["story"]["committedSceneBeats"] and "callerConnected" not in s["slice"]["story"]["facts"], str(s["slice"]["story"]))
    page.evaluate("RizoRuntimeQA.dungeonGotoForQA('drain')"); page.wait_for_timeout(1800)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,100)"); hold(page, "w", 350)
    for _ in range(40):
        if op(page).get("slope") != "slip": break
        page.wait_for_timeout(50)
    check("13.1: on the slope with no input in the window…", op(page).get("slope") in ("window", "gone"))
    page.wait_for_timeout(1400)
    check("…the second slip follows at once", sid(page) == "opening:fall" or page.evaluate(ST)["sim"]["roomId"] == "slip")
    check("the idle paths raise no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ---- Reload throughout the opening: committed beats never replay
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); launch(page); page.wait_for_timeout(4400)
    page.reload(); page.wait_for_timeout(1300); st = launch(page)
    check("reload in Scene 1 (nothing committed): the car again, from the start", st["sim"]["roomId"] == "car" and sid(page) == "opening:parked")
    to_waiting(page)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(700)
    st = page.evaluate(ST)
    check("reload while waiting: back in the car, YOU already in the store; “Be good.” is not replayed", st["sim"]["roomId"] == "car" and sid(page) == "opening:waiting" and st["transient"].get("youGone") and st["dialogue"] is None and not any(n["id"] == "you-seat" and n["visible"] for n in st["npcs"]), str((sid(page), st["transient"])))
    jump(page, 121000); page.wait_for_timeout(150)
    st = to_room(page, "sack", step=500)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500)
    check("reload in the sack: he resumes in the van; the abduction is not replayed", st["sim"]["roomId"] == "van" and beats(page).count("opening:taken") == 1)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500)
    check("reload in the van: the van again; still one abduction", st["sim"]["roomId"] == "van" and beats(page).count("opening:taken") == 1)
    st = to_room(page, "roadside", step=500)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500)
    check("reload during the search (fell, not searched): the roadside from where he fell", st["sim"]["roomId"] == "roadside" and sid(page) == "opening:separation" and beats(page).count("opening:fell") == 1)
    to_pred(page); hold(page, "w", 200); page.wait_for_timeout(1500)
    for _ in range(80):
        if op(page).get("searchOver"): break
        jump(page, 500); page.wait_for_timeout(15)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(300)
    jump(page, 2600); page.wait_for_timeout(150)
    st = page.evaluate(ST)
    check("reload after the search: no second search; the phone is still ringing", st["sim"]["roomId"] == "roadside" and not st["opening"].get("beam") and (st["opening"].get("phone") or {}).get("state") == "ringing" and beats(page).count("opening:searched") == 1, str(st["opening"]))
    ph = st["opening"]["phone"]
    page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({ph['x'] + 12},{ph['y']})"); page.wait_for_timeout(150); page.keyboard.press("z"); page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500); jump(page, 3000); page.wait_for_timeout(150)
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("reload after the call: the walk, no phone again; callerConnected kept", st["sim"]["roomId"] == "roadside" and st["opening"].get("phone") is None and st["opening"].get("walkMode") and s["slice"]["story"]["facts"].get("callerConnected") is True and st["music"] == "dungeon-street")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(100,70)"); hold(page, "w", 700); page.wait_for_timeout(500)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500)
    check("reload in the drain: the drain's mouth", st["sim"]["roomId"] == "drain")
    page.wait_for_timeout(1600)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,100)"); hold(page, "w", 350)
    st = to_room(page, "slip", step=400, limit=60)
    page.wait_for_timeout(400)
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(500)
    check("reload in the black hold after impact: below, the fall not replayed", st["sim"]["roomId"] == "slip" and beats(page).count("opening:below") == 1 and sid(page) is None)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(160,280)"); page.wait_for_timeout(1700)
    check("a reload before the thought still lets it come once, near the landing", page.evaluate(ST)["thought"] is not None or beats(page).count("thought:home") == 1)
    check("the reload paths raise no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ---- RC2 (threshold-v1) saves carried into the car: nobody is trapped in the deleted curb
    def rc2_envelope(slice_data):
        return subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');
const env=JSON.parse(process.argv[2]);const s=env.state;const data=JSON.parse(process.argv[3]);data.campaign.petId=s.pet.id;data.campaign.petName=s.pet.name;
console.log(JSON.stringify(Save.createEnvelope({state:s,modes:{dungeon:{schema:1,data}},savedAt:Date.now()-60000,writeId:'W-RC2',stateVersion:s.version})));""", str(ROOT), saved_with_knot_seed, json.dumps(slice_data)], capture_output=True, text=True, check=True).stdout.strip()
    def rc2_slice(room, anchor, beats_, visited, extra=None):
        data = {"settings": {"assist": False, "textSpeed": "normal"}, "campaign": {"id": "threshold-rc2save", "kind": "proof", "contentRevision": "threshold-v1", "petId": "", "petName": "", "status": "active", "chapterId": "threshold"},
                "world": {"visitedRooms": visited, "openedShortcuts": [], "durableRoomFlags": {}, "defeatedEncounters": []}, "story": {"facts": {}, "choices": {}, "committedSceneBeats": beats_, "resumeScene": None},
                "npcs": {"latch": {"state": "unmet", "locationAnchor": None, "evidence": []}}, "inventory": {"knownLocalItems": []}, "checkpoint": {"hearthId": None, "roomId": None, "spawnAnchorId": None},
                "continuation": {"roomId": room, "safeAnchorId": anchor, "roomEntryFlame": 5, "resumeKind": "opening"}, "legProfile": {"edges": {"speed": 1, "power": 1, "instinct": 1, "stamina": 1}, "bondBand": "new", "cues": {"favoriteFoodId": None, "favoriteGameId": None}},
                "journal": {"discoveredEntryIds": ["puddle"]}, "pendingRewards": [], "proofComplete": False, "storyComplete": False}
        if extra: extra(data)
        return data
    for label, slice_, room, scene_ in [
        ("at the curb", rc2_slice("curb", "start", [], ["curb"]), "car", "opening:parked"),
        ("taken, in the van", rc2_slice("van", "start", ["opening:taken"], ["curb", "van"]), "van", "opening:van"),
        ("fallen, by the road", rc2_slice("roadside", "fallen", ["opening:taken", "opening:fell"], ["curb", "van", "roadside"]), "roadside", "opening:separation"),
        ("in the drain", rc2_slice("drain", "mouth", ["opening:taken", "opening:fell"], ["curb", "van", "roadside", "drain"]), "drain", "opening:shelter")]:
        env = rc2_envelope(slice_)
        ctx, page, errors = boot(browser, seed={V2: env, V2_BACKUP: env})
        st = launch(page); page.wait_for_timeout(300)
        s = page.evaluate(STORED)
        check(f"an RC2 journey {label} resumes sensibly in v3 ({room})", st["sim"]["roomId"] == room and sid(page) == scene_ and s["slice"]["campaign"]["id"] == "threshold-rc2save" and s["slice"]["campaign"]["contentRevision"] == "threshold-v3", str((st["sim"]["roomId"], sid(page), s["slice"]["campaign"])))
        check(f"…its committed beats are kept, none replayed or duplicated ({label})", s["slice"]["story"]["committedSceneBeats"] == slice_["story"]["committedSceneBeats"] and "curb" not in s["slice"]["world"]["visitedRooms"] and s["slice"]["journal"]["discoveredEntryIds"] == ["puddle"], str(s["slice"]["story"]))
        check(f"…without page errors ({label})", not errors, "; ".join(errors[:2]))
        ctx.close()
    below = rc2_slice("queue", "queue-entry", ["opening:taken", "opening:fell", "opening:below", "latch-rescue:freed", "hearth-seat:sit"], ["curb", "van", "roadside", "drain", "slip", "clatter", "hem", "hearth", "queue"], lambda d: (d["story"].update({"facts": {"jamInspected": True, "seatChosen": True, "sharedRest": True, "hearthArrived": True}, "choices": {"hearth-seat": "sit"}}), d["world"].update({"durableRoomFlags": {"latchFreed": True}}), d["checkpoint"].update({"hearthId": "threshold-hearth", "roomId": "hearth", "spawnAnchorId": "hearth-side"}), d["npcs"].update({"latch": {"state": "waiting-hearth", "locationAnchor": "hearth-latch", "evidence": ["rescue"]}}), d["continuation"].update({"resumeKind": "room-entry"})))
    env = rc2_envelope(below)
    ctx, page, errors = boot(browser, seed={V2: env, V2_BACKUP: env})
    st = launch(page); page.wait_for_timeout(300)
    s = page.evaluate(STORED)
    check("an RC2 journey below resumes where it was, every fact, choice and hearth intact", st["sim"]["roomId"] == "queue" and st["shell"] == "locked" and s["slice"]["story"]["choices"] == {"hearth-seat": "sit"} and s["slice"]["story"]["facts"].get("sharedRest") and s["slice"]["checkpoint"]["hearthId"] == "threshold-hearth" and s["slice"]["world"]["durableRoomFlags"] == {"latchFreed": True} and s["slice"]["npcs"]["latch"]["state"] == "waiting-hearth", str(s["slice"]["story"]))
    check("…no thought comes to a journey already past the Slip", "thought:home" not in s["slice"]["story"]["committedSceneBeats"])
    goto(page, "slip"); page.wait_for_timeout(1500)
    check("…even standing at the landing", page.evaluate(ST)["thought"] is None)
    check("the migrated below-journey raises no page errors", not errors, "; ".join(errors[:2]))
    ctx.close()

    # ---- Reduced motion: every new sweep, fall and camera treatment has a still version
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP.replace("RizoRuntimeQA.loadForQA(s)", "s.settings.reducedMotion=true;RizoRuntimeQA.loadForQA(s)"))
    launch(page); page.wait_for_timeout(600)
    check("reduced motion: the stage carries the reduced-motion class", page.evaluate("document.getElementById('miniGameOverlay').classList.contains('dungeon-reduced-motion')"))
    to_waiting(page)
    jump(page, 121000); page.wait_for_timeout(100); jump(page, 4100); page.wait_for_timeout(80)
    xs = []
    for _ in range(4):
        jump(page, 700); page.wait_for_timeout(60)
        xs.append(page.evaluate("RizoDungeonScenery.lights(RizoDungeonCore.room('car'),{sim:RizoRuntimeQA.dungeonStateForQA().sim,time:0,extras:{room:RizoRuntimeQA.dungeonStateForQA().opening,sceneTime:RizoRuntimeQA.dungeonStateForQA().sceneTime,npcs:[]},view:{x:0,y:0,w:320,h:480},reduced:true}).list.filter(l=>l.r===150).map(l=>l.x)"))
    check("reduced motion: the headlights brighten and fade in place instead of sweeping", all(x == [180] for x in xs[:3] if x), str(xs))
    page.evaluate("RizoRuntimeQA.dungeonGotoForQA('roadside')"); page.wait_for_timeout(500)
    page.evaluate("RizoRuntimeQA.dungeonGotoForQA('drain')"); page.wait_for_timeout(1500)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(120,100)")
    rows, silent_open, lock_rows, banner_seen = watch_fall(page, hold_ms=3000)
    first_lock = lock_rows[0] if lock_rows else None
    slip_at = next((r[0] for r in rows if r[1] == "slip"), None)
    fall_rows = [r for r in rows if r[3] == "opening:fall"]
    early = [r[4] for r in fall_rows if r[0] - fall_rows[0][0] < 700] if fall_rows else []
    check("reduced motion: no cut to black and no flashes, a slow dim fade instead", early and max(early) < 0.8, str(early[:6]))
    check("reduced motion: the handheld still locks on impact, quickly (~160 ms)", first_lock and first_lock[1] and slip_at and slip_at - first_lock[0] < 450, str((first_lock, slip_at)))
    check("reduced motion: the fall still goes silent first and lands without a banner", silent_open and not banner_seen and page.evaluate(ST)["sim"]["roomId"] == "slip")
    check("reduced motion raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ---- Phones first: 320, 375, 390, 430 wide
    for w, h in [(320, 568), (375, 667), (390, 844), (430, 932)]:
        ctx, page, errors = boot(browser, seed={}, viewport=(w, h))
        page.evaluate(SETUP); launch(page); page.wait_for_timeout(4500)
        layout = page.evaluate("""(()=>{const r=e=>document.querySelector(e).getBoundingClientRect();const screen=r('.dungeon-screen'),pad=r('.dungeon-dpad'),keys=r('.dungeon-key-primary');
          return {overflowX:document.documentElement.scrollWidth>innerWidth,overflowY:document.documentElement.scrollHeight>innerHeight+1,screenBottom:screen.bottom,padTop:pad.top,keysTop:keys.top,screenW:screen.width,screenLeft:screen.left,screenRight:screen.right}})()""")
        cam = page.evaluate("RizoRuntimeQA.dungeonStateForQA() && (()=>{const v=document.querySelector('.dungeon-screen').getBoundingClientRect();return v.height/(v.width/320)})()")
        check(f"{w}×{h}: no page scroll, the screen sits above the controls", not layout["overflowX"] and not layout["overflowY"] and layout["screenBottom"] <= min(layout["padTop"], layout["keysTop"]) + 1 and layout["screenLeft"] >= 0 and layout["screenRight"] <= w, str(layout))
        check(f"{w}×{h}: the store window and the whole cabin fit on screen together", cam >= 330, str(cam))
        page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(190,250)"); hold(page, "a", 250)
        box = page.evaluate("(()=>{const d=document.querySelector('.dungeon-dialogue').getBoundingClientRect(),s=document.querySelector('.dungeon-screen').getBoundingClientRect();return [d.left>=s.left-1,d.right<=s.right+1,d.bottom<=s.bottom+1,d.top>=s.top]})()")
        check(f"{w}×{h}: YOU's line fits inside the screen, never under the controls", all(box), str(box))
        check(f"{w}×{h}: no page errors", not errors, "; ".join(errors[:2]))
        ctx.close()

    # ================= THE THRESHOLD: SIT path, through to the Den =================
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    launch(page); skip(page)
    goto(page, "hem")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(160,300)"); page.keyboard.down("w"); page.wait_for_timeout(450); page.keyboard.up("w"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("Latch, trapped behind a frozen latch: “NO OPEN FLAMES.” (startled)", st["dialogue"] and st["dialogue"]["speaker"] == "latch" and st["dialogue"]["expr"] == "startled" and page.evaluate("document.querySelector('.dungeon-portrait').dataset.expr") == "startled", str(st["dialogue"]))
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(184,252)"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(150)
    check("optional: looking at Latch first (“Different problem.”) is remembered", page.evaluate(STORED)["slice"]["story"]["facts"].get("jamInspected") is True)
    press_until_closed(page)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(150,232)"); page.wait_for_timeout(120)
    prompt = page.evaluate("document.querySelector('.dungeon-prompt').textContent")
    page.keyboard.press("z"); page.wait_for_timeout(1500)
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("Primary warms the jammed latch (a Kindle), committed before Latch reacts", "WARM" in prompt and s["slice"]["world"]["durableRoomFlags"].get("latchFreed") and "latch-rescue:freed" in s["slice"]["story"]["committedSceneBeats"] and s["slice"]["story"]["resumeScene"] == {"id": "latch-rescue", "beatId": "lines"}, str((prompt, s["slice"]["world"]["durableRoomFlags"])))
    press_until_closed(page); page.wait_for_timeout(900)
    check("the rescue happens exactly once and the route opens", page.evaluate(ST)["sim"]["flags"].get("latchFreed") and page.evaluate(STORED)["slice"]["npcs"]["latch"]["state"] == "waiting-hearth")
    goto(page, "hearth"); page.wait_for_timeout(200)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(90,170)"); page.wait_for_timeout(300)
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("the hearth registers on safe arrival and restores Flame", s["slice"]["checkpoint"]["hearthId"] == "threshold-hearth" and st["sim"]["player"]["flame"] == 5)
    check("entering the Shared Hearth he visibly loosens: the pose, and his light swells a little", st["opening"].get("loosenAt") is not None and (st["pose"] == "loosen" or "pose-loosen" in page.evaluate("document.querySelector('.dungeon-pose').className")), str((st["pose"], st["opening"].get("loosenAt"))))
    press_until_closed(page); page.wait_for_timeout(150)
    st = page.evaluate(ST)
    check("Latch offers the seat; SIT / GO waits for the player, no timer", st["choice"] and st["choice"]["options"] == ["sit", "go"] and not page.evaluate("document.querySelector('.dungeon-choice').hidden"))
    page.wait_for_timeout(1500)
    check("the choice is still waiting after time passes", page.evaluate(ST)["choice"] is not None)
    page.keyboard.press("z"); page.wait_for_timeout(250)
    s = page.evaluate(STORED)
    check("SIT is committed (sharedRest) before Latch's answer is shown", s["slice"]["story"]["choices"].get("hearth-seat") == "sit" and s["slice"]["story"]["facts"].get("sharedRest") and page.evaluate(ST)["dialogue"] is None)
    page.wait_for_timeout(1400)
    st = page.evaluate(ST)
    check("SIT: Rizo settles on the bench beside Latch (a quiet proximity beat)", abs(st["sim"]["player"]["x"] - 156) < 2 and st["pose"] == "settle", str((st["sim"]["player"]["x"], st["pose"])))
    press_until_closed(page); page.wait_for_timeout(1500)
    st = page.evaluate(ST)
    check("SIT's quiet aftermath: after Latch's line, nothing is said for a while", st["dialogue"] is None and st["scene"] and st["scene"]["id"] == "hearth-seat" and st["opening"].get("quietAt") is not None, str((st["dialogue"], st["scene"])))
    for _ in range(8):
        skip(page); page.wait_for_timeout(100)
    check("Latch's warning before the Porter is said", page.evaluate(STORED)["slice"]["story"]["facts"].get("beforePorterSaid") is True)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(255,288)"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(1700)
    st = page.evaluate(ST)
    check("the cold bowl: narration only (no Rizo speech), bowlSeen kept", st["dialogue"] and st["dialogue"]["speaker"] is None and page.evaluate(STORED)["slice"]["story"]["facts"].get("bowlSeen") and page.evaluate("document.querySelector('.dungeon-dialogue').classList.contains('is-narration')"), str(st["dialogue"]))
    press_until_closed(page); skip(page)
    goto(page, "queue")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(48,300)"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(300)
    s = page.evaluate(STORED)
    check("the queue lever opens a real shortcut to the hearth (durable)", s["slice"]["world"]["durableRoomFlags"].get("shortcutOpen") and "hearth-queue" in s["slice"]["world"]["openedShortcuts"])
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(30,350)"); page.keyboard.down("a"); page.wait_for_timeout(500); page.keyboard.up("a"); page.wait_for_timeout(500)
    check("…and walking through it arrives at the hearth", page.evaluate(ST)["sim"]["roomId"] == "hearth")
    goto(page, "queue")
    # One evaluate: a live frame between teleport and advance could see the lane first.
    ev = page.evaluate("(RizoRuntimeQA.dungeonTeleportForQA(160,220), RizoRuntimeQA.dungeonAdvanceForQA(1400,{}))")
    check("the Needle shows its lane, then pulses it", "lane" in ev and "pulse" in ev, str(ev))
    goto(page, "porter")
    s = page.evaluate(STORED)
    check("the Porter's room records a pre-fight continuation", s["slice"]["continuation"]["roomId"] == "porter" and s["slice"]["continuation"]["resumeKind"] == "boss")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,124)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    page.evaluate('RizoRuntimeQA.dungeonEnemyForQA("night-porter",{hp:15,state:"open",x:180,y:96})')
    ev = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(400,{primaryPressed:true})")
    s = page.evaluate(STORED)
    check("at half health the help beat is committed first (alcove open, Latch helping)", "porter-half" in ev and s["slice"]["story"]["facts"].get("porterHelp") and s["slice"]["world"]["durableRoomFlags"].get("alcoveOpen") and s["slice"]["npcs"]["latch"]["state"] == "helping", str(ev))
    page.wait_for_timeout(300)
    st = page.evaluate(ST)
    check("the Porter climax: his light at its smallest, a look back, nobody there yet", st["lightScale"] <= 0.55 and st["pose"] == "look-back" and not any(n["id"] == "latch" and n["visible"] for n in st["npcs"]) and st["dialogue"] is None, str((st["lightScale"], st["pose"], st["npcs"])))
    page.wait_for_timeout(1800)
    st = page.evaluate(ST)
    check("…then silence, still nobody", not any(n["id"] == "latch" and n["visible"] for n in st["npcs"]) and st["dialogue"] is None)
    page.wait_for_timeout(1700)
    check("…then the alcove clunks open and Latch is there", any(n["id"] == "latch" and n["visible"] for n in page.evaluate(ST)["npcs"]) and page.evaluate(ST)["opening"].get("smallestDone") is True)
    st = page.evaluate(ST)
    check("Latch: “Here. I found a door that still does doors.” (urgent)", st["dialogue"] and st["dialogue"]["expr"] == "urgent", str(st["dialogue"]))
    # Interrupt the help beat with a reload: the boss restarts, the help is never granted twice.
    page.reload(); page.wait_for_timeout(1300)
    st = launch(page); skip(page); page.wait_for_timeout(200)
    s = page.evaluate(STORED)
    check("reload mid-help: the alcove starts open, the Porter at full HP, the beat acknowledged not repeated", st["sim"]["roomId"] == "porter" and st["sim"]["flags"].get("alcoveOpen") and st["sim"]["enemies"][0]["hp"] == 28 and s["slice"]["story"]["resumeScene"] is None, str((st["sim"]["roomId"], st["sim"]["enemies"][:1])))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,124)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    page.evaluate('RizoRuntimeQA.dungeonEnemyForQA("night-porter",{hp:15,state:"open",x:180,y:96})')
    ev = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(400,{primaryPressed:true})")
    check("…and dropping below half again asks for no second help", "porter-half" not in ev and "hit" in ev, str(ev))
    page.evaluate('RizoRuntimeQA.dungeonEnemyForQA("night-porter",{hp:2,state:"open",x:180,y:96})')
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,124)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    ev = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(400,{primaryPressed:true})")
    s = page.evaluate(STORED)
    check("the Porter settles; the First Knot and shared-hearth mark are committed with the proof", "porter-down" in ev and "first-knot" in s["accessories"] and any(m["id"] == "shared-hearth" for m in (s["marks"] or [])) and s["slice"]["proofComplete"] and not s["slice"]["storyComplete"] and s["slice"]["campaign"]["status"] == "homecoming-ready", str(ev))
    check("the reward is never auto-equipped", s["accessory"] == "scarf")
    page.wait_for_timeout(1200)
    check("a held quiet after the Porter, before anything is given", page.evaluate(ST)["dialogue"] is None and page.evaluate(ST)["scene"]["id"] == "knot-gift")
    page.wait_for_timeout(2200)
    check("Latch's gift lines: “Keeps the draft off.”", (page.evaluate(ST)["dialogue"] or {}).get("speaker") == "latch")
    press_until_closed(page, 30); page.wait_for_timeout(1300); press_until_closed(page, 30); page.wait_for_timeout(900); press_until_closed(page, 30)
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,30)"); page.keyboard.down("w"); page.wait_for_timeout(500); page.keyboard.up("w"); page.wait_for_timeout(1600)
    s = page.evaluate(STORED); st = page.evaluate(ST)
    check("the open door leads on: the Mending Rows' Receiving, the journey still going and the proof kept", st["sim"]["roomId"] == "receiving" and page.evaluate("RizoModes.active()") == "dungeon" and s["slice"]["campaign"]["status"] == "homecoming-ready" and s["slice"]["proofComplete"] and "receiving" in s["slice"]["world"]["visitedRooms"], str((st["sim"]["roomId"], s["slice"]["campaign"]["status"])))
    check("Latch got there first, and Nell is at work", {"latch", "nell"} <= {n["id"] for n in st["npcs"]} and st["music"] == "dungeon-rows", str(st["npcs"]))
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(900)
    fed = page.evaluate("(()=>{const before=RizoRuntimeQA.snapshot().pet.hunger;RizoRuntimeQA.useFoodForQA('crumbs');return [before,RizoRuntimeQA.snapshot().pet.hunger]})()")
    check("ordinary feeding works after leaving the Rows", fed[1] > fed[0], str(fed))
    check("the story path raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ================= GO path: help still comes; no shared-hearth mark =================
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    launch(page); skip(page)
    goto(page, "hearth", None, {"latchFreed": True})
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(90,170)"); page.wait_for_timeout(300)
    press_until_closed(page); page.wait_for_timeout(150)
    page.keyboard.press("d"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(300)
    s = page.evaluate(STORED)
    check("GO is committed too; it keeps the checkpoint and records no sharedRest", s["slice"]["story"]["choices"].get("hearth-seat") == "go" and not s["slice"]["story"]["facts"].get("sharedRest") and s["slice"]["checkpoint"]["hearthId"] == "threshold-hearth")
    press_until_closed(page, 20); skip(page)
    goto(page, "porter")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,124)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    page.evaluate('RizoRuntimeQA.dungeonEnemyForQA("night-porter",{hp:15,state:"open",x:180,y:96})')
    ev = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(400,{primaryPressed:true})")
    check("GO: Latch still helps at half health", "porter-half" in ev and page.evaluate(STORED)["slice"]["story"]["facts"].get("porterHelp"))
    skip(page)
    page.evaluate('RizoRuntimeQA.dungeonEnemyForQA("night-porter",{hp:2,state:"open",x:180,y:96})')
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,124)"); page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(17,{moveY:-1})")
    page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(400,{primaryPressed:true})")
    s = page.evaluate(STORED)
    receipt = s["receipts"]["dungeon"][f'{s["slice"]["campaign"]["id"]}:threshold-complete']
    check("GO: the First Knot alone (no shared-hearth mark)", "first-knot" in s["accessories"] and receipt["entitlements"] == ["first-knot"] and not any(m["id"] == "shared-hearth" for m in (s["marks"] or [])), str(receipt))
    check("the GO path raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ================= INTERRUPTED RESCUE: committed, then the tab is gone =================
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    launch(page); skip(page)
    goto(page, "hem")
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(150,232)"); page.wait_for_timeout(200)
    press_until_closed(page)
    page.keyboard.press("z"); page.wait_for_timeout(1750)
    check("(the rescue was committed before the reload)", page.evaluate(STORED)["slice"]["world"]["durableRoomFlags"].get("latchFreed") is True)
    page.reload(); page.wait_for_timeout(1300)
    st = launch(page); page.wait_for_timeout(300)
    s = page.evaluate(STORED)
    check("an interrupted rescue is not re-run: the gate is open, Latch has gone ahead", st["sim"]["roomId"] == "hem" and st["sim"]["flags"].get("latchFreed") and not any(n["id"] == "latch" for n in st["npcs"]) and s["slice"]["story"]["resumeScene"] is None, str((st["npcs"], s["slice"]["story"]["resumeScene"])))
    ctx.close()

    # ================= A GATE 1 REVIEW SAVE IS CARRIED FORWARD =================
    gate1 = subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');
const env=JSON.parse(process.argv[2]);const s=env.state;s.version=22;s.inventory.accessories=['none','scarf'];s.pet.accessory='scarf';s.modeReceipts={};s.pet.storyMarks=[];
const slice={schema:1,data:{settings:{assist:true,textSpeed:'instant'},campaign:{id:'threshold-gate1abc',kind:'proof',contentRevision:'threshold-gate1',petId:s.pet.id,petName:s.pet.name,status:'active',chapterId:'threshold'},world:{visitedRooms:['clatter'],openedShortcuts:[],durableRoomFlags:{},defeatedEncounters:[]},checkpoint:{hearthId:'clatter-review-hearth',roomId:'clatter',spawnAnchorId:'clatter-hearth-side'},continuation:{roomId:'clatter',safeAnchorId:'clatter-hearth-side',roomEntryFlame:5,resumeKind:'hearth'},journal:{discoveredEntryIds:['ticket-stub']},pendingRewards:[],proofComplete:false,storyComplete:false}};
console.log(JSON.stringify(Save.createEnvelope({state:s,modes:{dungeon:slice},savedAt:Date.now()-60000,writeId:'W-G1',stateVersion:22})));""", str(ROOT), saved_with_knot_seed], capture_output=True, text=True, check=True).stdout.strip()
    ctx, page, errors = boot(browser, seed={V2: gate1, V2_BACKUP: gate1})
    st = launch(page)
    s = page.evaluate(STORED)
    check("a Gate 1 review campaign keeps its id, pet and settings and starts The Threshold's opening", s["slice"]["campaign"]["id"] == "threshold-gate1abc" and s["slice"]["campaign"]["contentRevision"] == "threshold-v3" and s["slice"]["settings"] == {"assist": True, "textSpeed": "instant"} and st["sim"]["roomId"] == "car", str(s["slice"]["campaign"]))
    check("the migration boots without page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ================= DEFENSE REGRESSION: a live run under the Arcade view =================
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP)
    page.evaluate("RizoRuntimeQA.setViewForQA('go')"); page.wait_for_timeout(200)
    page.evaluate("RizoRuntimeQA.startMiniGame('defense',{mapId:'grove'})"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-defense-skip-map-intro]')?.click()"); page.wait_for_timeout(200)
    page.evaluate("RizoRuntimeQA.renderAll()"); page.wait_for_timeout(100)
    check("a live Defense run survives the Go refresh", page.evaluate("RizoModes.active()") == "defense" and page.evaluate("Boolean(document.getElementById('miniArena')?.children.length)") and page.evaluate("document.querySelector('button[data-mode=\"defense\"]').textContent") != "")
    ctx.close()

    # ================= QA-ONLY COMPLETION FIXTURE (throwaway save) =================
    ctx, page, errors = boot(browser, seed={})
    pet_id = page.evaluate(SETUP)
    st = launch(page)
    camp = st["data"]["campaign"]["id"]
    receipt = f"{camp}:threshold-complete"
    shop0 = page.evaluate("(()=>{RizoRuntimeQA.setViewForQA('closet');return [...document.querySelectorAll('[data-buy-accessory]')].map(b=>b.dataset.buyAccessory)})()")
    check("First Knot is not in the shop before it is earned", "first-knot" not in shop0)
    # Failed primary write: nothing is granted and nothing half-applies.
    page.evaluate("(()=>{window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rizo-save-v2')throw new Error('QuotaExceededError');return window.__realSet.call(this,k,v)}})()")
    out = page.evaluate("RizoRuntimeQA.dungeonCompleteFixtureForQA({sharedRest:true})")
    page.evaluate("(()=>{Storage.prototype.setItem=window.__realSet;return true})()")
    s = page.evaluate(STORED); snap = page.evaluate("RizoRuntimeQA.snapshot()")
    check("failed primary write: reported failed, in-memory hub state restored", out["status"] == "failed" and "first-knot" not in snap["inventory"]["accessories"] and snap["pet"]["storyMarks"] == [] and snap.get("modeReceipts") == {} and not (snap["qaModes"]["dungeon"]["data"].get("proofComplete")), str(out))
    check("failed primary write: storage untouched, reward kept pending in the journey", "first-knot" not in s["accessories"] and not s["slice"]["proofComplete"] and len(page.evaluate(ST)["data"]["pendingRewards"]) == 1)
    check("no completion event is emitted before a confirmed save", not any(e["kind"] == "chapterComplete" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")))
    out = page.evaluate("RizoRuntimeQA.dungeonRetryPendingForQA()")
    s = page.evaluate(STORED)
    check("the pending reward is retried and commits once storage works", out["status"] == "committed" and out["rewardApplied"] and "first-knot" in s["accessories"] and s["slice"]["pendingRewards"] == [], str(out))
    check("First Knot and the shared-hearth mark are written with a receipt", any(m["id"] == "shared-hearth" and m["mode"] == "dungeon" for m in s["marks"]) and s["receipts"]["dungeon"][receipt]["entitlements"] == ["first-knot", "shared-hearth"] and s["receipts"]["dungeon"][receipt]["petId"] == pet_id, str(s["receipts"]))
    check("the proof completes without claiming the full story", s["slice"]["proofComplete"] is True and s["slice"]["storyComplete"] is False and s["slice"]["campaign"]["status"] == "homecoming-ready")
    check("the garment is not equipped without the player's choice", s["accessory"] == "scarf")
    data = page.evaluate(ST)["data"]
    dup = page.evaluate("([d,r,p])=>RizoRuntimeQA.dungeonCommitForQA({data:d,reward:{receiptId:r,petId:p,entitlements:['shared-hearth','first-knot']}})", [data, receipt, pet_id])
    s2 = page.evaluate(STORED)
    check("a repeated identical receipt commits data but grants nothing again", dup["status"] == "committed" and dup["duplicateReward"] and not dup["rewardApplied"] and s2["accessories"].count("first-knot") == 1 and len(s2["marks"]) == len(s["marks"]), str(dup))
    conflict = page.evaluate("([d,r,p])=>RizoRuntimeQA.dungeonCommitForQA({data:{...d,poisoned:true},reward:{receiptId:r,petId:p,entitlements:['first-knot']}})", [data, receipt, pet_id])
    s3 = page.evaluate(STORED)
    check("a conflicting payload under an existing receipt is refused before anything applies", conflict["status"] == "failed" and conflict["reason"] == "conflicting-receipt" and "poisoned" not in s3["slice"] and s3["writeId"] == s2["writeId"], str(conflict))
    unknown = page.evaluate("([d,c,p])=>RizoRuntimeQA.dungeonCommitForQA({data:d,reward:{receiptId:c+':coat',petId:p,entitlements:['return-coat']}})", [data, camp, pet_id])
    unowned = page.evaluate("([d,c])=>RizoRuntimeQA.dungeonCommitForQA({data:d,reward:{receiptId:c+':other',petId:'PET-NOPE',entitlements:['first-knot']}})", [data, camp])
    check("unknown entitlements and unowned pets are refused", unknown["reason"] == "unknown-entitlement" and unowned["reason"] == "unowned-pet" and page.evaluate(STORED)["writeId"] == s2["writeId"], str((unknown, unowned)))
    # Primary succeeds, backup fails: still committed; no rollback; never repeated.
    page.evaluate("(()=>{window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rizo-save-v2:backup')throw new Error('QuotaExceededError');return window.__realSet.call(this,k,v)}})()")
    bk = page.evaluate("([d,c,p])=>RizoRuntimeQA.dungeonCommitForQA({data:{...d,note:1},reward:{receiptId:c+':backup-probe',petId:p,entitlements:['first-knot']}})", [data, camp, pet_id])
    page.evaluate("(()=>{Storage.prototype.setItem=window.__realSet;return true})()")
    s4 = page.evaluate(STORED)
    back = json.loads(s4["backup"])
    check("primary saved but backup failed: committed, backupSynced false, primary is the record", bk["status"] == "committed" and bk["rewardApplied"] and bk["backupSynced"] is False and (c := f"{camp}:backup-probe") in s4["receipts"]["dungeon"] and c not in (back["state"].get("modeReceipts") or {}).get("dungeon", {}), str(bk))
    again = page.evaluate("([d,c,p])=>RizoRuntimeQA.dungeonCommitForQA({data:d,reward:{receiptId:c+':backup-probe',petId:p,entitlements:['first-knot']}})", [data, camp, pet_id])
    check("that reward is never repeated afterwards", again["duplicateReward"] and not again["rewardApplied"])
    check("the completion event fires only after the confirmed commit", any(e["kind"] == "chapterComplete" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")))
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(200)
    shop1 = page.evaluate("(()=>{RizoRuntimeQA.setViewForQA('closet');return [...document.querySelectorAll('[data-buy-accessory]')].map(b=>b.dataset.buyAccessory)})()")
    check("the Closet shows First Knot once earned", "first-knot" in shop1)
    page.evaluate("document.querySelector('[data-buy-accessory=\"first-knot\"]').click()"); page.wait_for_timeout(500)
    page.evaluate("RizoRuntimeQA.setViewForQA('home')"); page.wait_for_timeout(300)
    worn = page.evaluate("[RizoRuntimeQA.snapshot().pet.accessory, Boolean(document.querySelector('#petActor .wearable-first-knot, .pet-actor .wearable-first-knot')), RizoRuntimeQA.snapshot().wallet.embers]")
    check("choosing it uses the existing wardrobe path and the Den renders it", worn[0] == "first-knot" and worn[1], str(worn))
    page.screenshot(path="/tmp/rizo-first-knot-den.png")
    st = launch(page)
    check("an interrupted homecoming resumes at the open door, never re-awarding", st["sim"]["roomId"] == "porter" and st["sim"]["flags"].get("porterDown") and page.evaluate(STORED)["accessories"].count("first-knot") == 1, str((st["sim"]["roomId"], st["sim"]["flags"])))
    skip(page)
    # The ordinary five-second save/chrome refresh must not drop a held key.
    # The defeated Porter's room is safe; its side wall contains this movement.
    page.keyboard.down("d"); page.evaluate("RizoRuntimeQA.renderAll()"); page.wait_for_timeout(5300)
    held_dir = page.locator(".dungeon-dpad").get_attribute("data-dir")
    page.keyboard.up("d")
    check("a held control survives hub refresh and the real autosave tick", held_dir == "right", str(held_dir))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,30)"); page.keyboard.down("w"); page.wait_for_timeout(500); page.keyboard.up("w"); page.wait_for_timeout(1200)
    check("walking out the open door goes on into the Rows; the proof stays complete", page.evaluate(ST)["sim"]["roomId"] == "receiving" and page.evaluate(STORED)["slice"]["proofComplete"] and page.evaluate(STORED)["accessories"].count("first-knot") == 1)
    # A journey that came home under the proof edition (status complete) is still home, and may go on.
    page.evaluate("RizoRuntimeQA.dungeonProofHomeForQA()"); page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(700)
    st = launch(page)
    panel = page.evaluate("document.querySelector('.dungeon-panel').textContent")
    check("a completed proof still says it reached home, never replaying the reward, and offers the open door", st["ui"] == "blocked" and "REACHED HOME" in panel and "GO THROUGH THE DOOR" in panel and page.evaluate(STORED)["accessories"].count("first-knot") == 1, panel[:160])
    page.evaluate("document.querySelector('[data-dungeon-action=\"onward\"]').click()"); page.wait_for_timeout(500)
    st = page.evaluate(ST)
    check("going on resumes in the Porter's room with the door open, still complete", st["ui"] == "play" and st["sim"]["roomId"] == "porter" and st["sim"]["flags"].get("porterDown") and page.evaluate(STORED)["slice"]["campaign"]["status"] == "complete", str((st["ui"], st["sim"]["roomId"])))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(180,30)"); page.keyboard.down("w"); page.wait_for_timeout(500); page.keyboard.up("w"); page.wait_for_timeout(1200)
    check("…and through it into the Rows; next launch resumes there, not at the panel", page.evaluate(ST)["sim"]["roomId"] == "receiving", page.evaluate(ST)["sim"]["roomId"])
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(700)
    st = launch(page)
    check("(a completed journey that went on resumes in the Rows; the summary shows how far)", st["ui"] != "blocked" and st["sim"]["roomId"] == "receiving" and page.evaluate("RizoRuntimeQA.dungeonSummaryForQA()")["bestLabel"].startswith("ROWS"), str((st["ui"], st["sim"]["roomId"])))
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(700)
    check("fixture flows raise no page errors", not errors, "; ".join(errors[:3]))
    saved_with_knot = page.evaluate("localStorage.getItem('rizo-save-v2')")
    ctx.close()

    # ================= CHAPTER 1 · THE MENDING ROWS (threshold-v3) =================
    # Played through in order with the real keys for every WARM and LOOK; scene
    # time is advanced with the QA clock. Enemies are settled with the QA hook.
    def rgo(page, room, anchor=None, flags=None):
        page.evaluate("([r,a,f])=>RizoRuntimeQA.dungeonGotoForQA(r,a,f||{})", [room, anchor, flags]); page.wait_for_timeout(250)
    def tp(page, x, y): page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({x},{y})"); page.wait_for_timeout(60)
    def clock(page, ms): page.evaluate(f"RizoRuntimeQA.dungeonSceneTimeForQA({ms})")
    def drive(page, pred, limit=140, step=300):
        for _ in range(limit):
            st = page.evaluate(ST)
            if pred(st): return st
            if st["choice"] or st["dialogue"]: page.keyboard.press("z"); page.wait_for_timeout(50); continue
            clock(page, step); page.wait_for_timeout(12)
        return page.evaluate(ST)
    def warm(page, x, y):
        tp(page, x, y); page.wait_for_timeout(80)
        prompt = page.evaluate("document.querySelector('.dungeon-prompt')?.textContent||''")
        page.keyboard.press("z"); page.wait_for_timeout(160)
        return prompt
    def said(st, text): return any(text in b["text"] for b in st["barks"])
    rbeats = lambda: page.evaluate(STORED)["slice"]["story"]["committedSceneBeats"]
    rflags = lambda: page.evaluate(STORED)["slice"]["world"]["durableRoomFlags"]

    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); launch(page); skip(page)
    rgo(page, "porter", "porter-entry", {"porterDown": True, "latchFreed": True, "sharedRest": True, "seatChosen": True}); skip(page)
    tp(page, 180, 30); page.keyboard.down("w"); page.wait_for_timeout(900); page.keyboard.up("w"); page.wait_for_timeout(700)
    st = page.evaluate(ST)
    check("Rows: the Porter's open door walks into Receiving; Latch got there first, Nell is mending", st["sim"]["roomId"] == "receiving" and {"latch", "nell"} <= {n["id"] for n in st["npcs"]} and "rows:arrived" in rbeats(), str((st["sim"]["roomId"], st["npcs"])))
    seen = []
    st = drive(page, lambda st: (seen.extend(b["text"] for b in st["barks"]) or st["sim"]["flags"].get("ledgeReady")))
    check("Rows: Latch's greeting remembers the shared rest; the satchel dispute is overheard, not a dialogue box", any("chair survived" in t for t in seen) and any("It needs to be empty." in t for t in seen) and st["dialogue"] is None, str(seen[:6]))
    tp(page, 160, 120)
    st = drive(page, lambda st: said(st, "This bit's dry."))
    check("Rows: when he comes close, Nell clears a dry patch for him first", said(st, "This bit's dry.") and any(n["id"] == "nell" and n["state"] == "clear" for n in st["npcs"]), str(st["npcs"]))
    prompt = warm(page, 236, 72)
    st = drive(page, lambda st: st["scene"] is None)
    check("Rows: warming the ledge catch is optional help, and it is remembered", "WARM" in prompt and page.evaluate(STORED)["slice"]["story"]["facts"].get("rowsLatchHelped") is True, prompt)
    rgo(page, "drytable", "drytable-west"); clock(page, 2600)
    tp(page, 150, 60)
    st = drive(page, lambda st: st["sim"]["flags"].get("catchReady"))
    check("Rows: at the Dry Table she misreads him (the warm room), then follows his look up: “Further up.”", "rows:met" in rbeats() and st["sim"]["flags"].get("catchReady"), str(rbeats()[-3:]))
    check("Rows: the way into the rows is shut until the work is done", not st["sim"]["flags"].get("rowsCatch"))
    prompt = warm(page, 200, 186)
    st = drive(page, lambda st: st["scene"] is None and st["sim"]["flags"].get("rowsCatch"))
    check("Rows: the first small job holds (“Holds.”) and opens the door north", "WARM" in prompt and rflags().get("rowsCatch") is True, prompt)
    tp(page, 252, 196); page.wait_for_timeout(700)
    check("Rows: the table's stove is a dry place to come back to (a checkpoint)", page.evaluate(STORED)["slice"]["checkpoint"]["hearthId"] == "rows-stove", str(page.evaluate(STORED)["slice"]["checkpoint"]))
    page.reload(); page.wait_for_timeout(1300); st = launch(page); page.wait_for_timeout(300)
    check("Rows: reload at the table resumes there; the meeting never replays", st["sim"]["roomId"] == "drytable" and st["scene"] is None and st["sim"]["flags"].get("rowsCatch"), str((st["sim"]["roomId"], st["scene"])))
    rgo(page, "hangrow", "hangrow-entry"); clock(page, 3000)
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('row-draftling',{state:'gone'})")
    tp(page, 240, 150)
    st = drive(page, lambda st: st["sim"]["flags"].get("lowReady"))
    prompt = warm(page, 278, 106)
    st = drive(page, lambda st: st["scene"] is None and st["sim"]["flags"].get("rowsLowRoute")); clock(page, 1200); st = page.evaluate(ST)
    check("Rows: Hanging Row splits by size: he takes the low route, she names where they'll meet", "WARM" in prompt and rflags().get("rowsLowRoute") and "rows:split" in rbeats() and not any(n["id"] == "nell" and n["visible"] for n in st["npcs"]), str(st["npcs"]))
    rgo(page, "eyelet", "eyelet-low"); clock(page, 400); tp(page, 160, 120)
    st = drive(page, lambda st: st["sim"]["flags"].get("grilleReady"))
    check("Rows: she kept the appointment at Eyelet Landing, and Orr arrives with a tray too big for the hatch", "rows:eyelet" in rbeats() and any(n["id"] == "orr" for n in st["npcs"]), str(st["npcs"]))
    prompt = warm(page, 36, 130)
    st = drive(page, lambda st: st["scene"] is None and st["sim"]["flags"].get("rowsGrille"))
    check("Rows: the grille opens for the tray; the way back to the table is open", rflags().get("rowsGrille") and "rows:orr" in rbeats())
    rgo(page, "drytable", "drytable-east"); clock(page, 400); tp(page, 150, 210)
    st = drive(page, lambda st: st["choice"] is not None)
    check("Rows: the meal: Nell loses a small argument, then SIT or GO", st["choice"] and st["choice"]["options"] == ["sit", "go"], str(st["choice"]))
    page.keyboard.press("d"); page.wait_for_timeout(120); page.keyboard.press("z"); page.wait_for_timeout(200)
    st = drive(page, lambda st: st["scene"] is None)
    s = page.evaluate(STORED)["slice"]
    check("Rows: GO is honoured (no pressure); the press door opens either way", s["story"]["choices"].get("rows-meal") == "go" and s["world"]["durableRoomFlags"].get("rowsPressOpen"), str(s["story"]["choices"]))
    rgo(page, "press", "press-entry"); clock(page, 400); tp(page, 160, 400)
    st = drive(page, lambda st: "rows:screen" in st["data"]["story"]["committedSceneBeats"])
    check("Rows: Press House: she braces a screen while the carriage passes once", "rows:screen" in rbeats())
    tp(page, 160, 250); clock(page, 800); page.wait_for_timeout(100)
    st = page.evaluate(ST)
    check("Rows: caught on the running track he is knocked clear, never hurt", st["sim"]["player"]["flame"] == 5, str(st["sim"]["player"]))
    page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('press-needle',{state:'gone'})"); tp(page, 160, 160)
    st = drive(page, lambda st: st["sim"]["flags"].get("brakeReady"))
    prompt = warm(page, 284, 196); tp(page, 160, 160)
    st = drive(page, lambda st: st["sim"]["flags"].get("shutterReady"))
    check("Rows: stop, brake (his side), one test with him off the track, parked", rflags().get("rowsPressStop") and rflags().get("rowsBrake"), str(rflags()))
    prompt = warm(page, 196, 56)
    st = drive(page, lambda st: st["scene"] is None and st["sim"]["flags"].get("rowsShutter"))
    check("Rows: the shutter: he warms it, she lifts", rflags().get("rowsShutter") is True)
    rgo(page, "upper", "upper-entry")
    st = drive(page, lambda st: "rows:upper" in st["data"]["story"]["committedSceneBeats"])
    check("Rows: the upper landing: the stair opens, and she names the next appointment (the table)", rflags().get("rowsStair") and "rows:upper" in rbeats())
    page.reload(); page.wait_for_timeout(1300); st = launch(page)
    check("Rows: reload on the landing resumes there with nothing replayed", st["sim"]["roomId"] == "upper" and st["scene"] is None, str((st["sim"]["roomId"], st["scene"])))
    rgo(page, "drytable", "drytable-stair"); clock(page, 400); tp(page, 150, 196)
    st = drive(page, lambda st: st["sim"]["flags"].get("boardReady"))
    check("Rows: she kept the table appointment: a low board set at his height", "rows:return" in rbeats() and st["sim"]["flags"].get("boardReady"))
    warm(page, 150, 188)
    st = drive(page, lambda st: st["sim"]["flags"].get("chalkOut"))
    tp(page, 196, 186); page.wait_for_timeout(80); page.keyboard.press("z"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    check("Rows: he finds her chalk (“I was keeping it warm.”), and it is remembered", said(st, "keeping it warm") and page.evaluate(STORED)["slice"]["story"]["facts"].get("rowsChalk") is True, str(st["barks"]))
    st = drive(page, lambda st: st["choice"] is not None)
    check("Rows: the wrap is offered, never put on him: WEAR IT, FOLDED or LEAVE IT", st["choice"] and st["choice"]["options"] == ["worn", "folded", "peg"], str(st["choice"]))
    page.keyboard.press("z"); page.wait_for_timeout(200)
    st = drive(page, lambda st: st["scene"] is None)
    wear = page.evaluate("Boolean(document.querySelector('.dungeon-pose .dungeon-wear-wrap'))")
    check("Rows: WEAR IT is committed and shows on him; she moves the wet sheets off the way on", page.evaluate(STORED)["slice"]["story"]["choices"].get("rows-wrap") == "worn" and wear and rflags().get("rowsOnward"), str((wear, rflags())))
    page.reload(); page.wait_for_timeout(1300); st = launch(page)
    wear = page.evaluate("Boolean(document.querySelector('.dungeon-pose .dungeon-wear-wrap'))")
    check("Rows: after a reload he is still wearing it", wear and st["sim"]["roomId"] == "drytable", str((wear, st["sim"]["roomId"])))
    tp(page, 260, 30); page.keyboard.down("w"); page.wait_for_timeout(900); page.keyboard.up("w"); page.wait_for_timeout(700)
    st = page.evaluate(ST)
    check("Rows: through the doorway the sheets hid: Window Hall", st["sim"]["roomId"] == "windowgate", st["sim"]["roomId"])
    seen = []
    st = drive(page, lambda st: (seen.extend(b["text"] for b in st["barks"]) or "rows:boundary" in st["data"]["story"]["committedSceneBeats"]), limit=200, step=250)
    check("Rows: CLOSED, BACK SOON; Latch remembers the catch he warmed", any("They'll open." in t for t in seen) and any("Your catch held." in t for t in seen), str(seen[-6:]))
    panel = page.evaluate("document.querySelector('.dungeon-panel')?.textContent||''")
    check("Rows: the boundary is said plainly: WINDOW HALL IS NEXT, saved here", "WINDOW HALL IS NEXT" in panel and "STAY A WHILE" in panel and "GO HOME" in panel, panel[:120])
    check("Rows: the shelf summary shows how far the journey went (rooms visited in the Rows)", page.evaluate("RizoRuntimeQA.dungeonSummaryForQA()")["bestLabel"] == f"ROWS {len([r for r in page.evaluate(STORED)['slice']['world']['visitedRooms'] if r in ('receiving','drytable','hangrow','lowrun','eyelet','traypass','press','upper','stair','windowgate')])}/10", str(page.evaluate("RizoRuntimeQA.dungeonSummaryForQA()")))
    page.click("[data-dungeon-action='stay']"); page.wait_for_timeout(300)
    check("Rows: STAY A WHILE closes the card and play goes on", page.evaluate(ST)["ui"] == "play")
    tp(page, 270, 200); clock(page, 400)
    check("Rows: the first time he drifts toward the rest of the hall, she keeps him close", said(page.evaluate(ST), "Stay where I can see you."), str(page.evaluate(ST)["barks"]))
    for width in (320, 375, 430):
        page.set_viewport_size({"width": width, "height": 760}); page.wait_for_timeout(250)
        page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(150,120)"); clock(page, 200); page.wait_for_timeout(120)
        metrics = page.evaluate("""(()=>{const se=document.scrollingElement;const scr=document.querySelector('.dungeon-screen').getBoundingClientRect();
          const out=[...document.querySelectorAll('.dungeon-bark')].some(b=>{const r=b.getBoundingClientRect();return r.left<scr.left-1||r.right>scr.right+1});
          return {scroll:se.scrollHeight>innerHeight+1||se.scrollWidth>innerWidth+1,out,sel:getSelection().toString().length}})()""")
        check(f"Rows: {width} px: no page scroll, barks inside the screen, nothing selected", not metrics["scroll"] and not metrics["out"] and not metrics["sel"], str(metrics))
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(200)
    page.evaluate("RizoModes.quitActive('qa')"); page.wait_for_timeout(700)
    st = launch(page); page.wait_for_timeout(300)
    check("Rows: the next launch resumes at the closed window: Nell waiting, no card replayed, still wearing the wrap", st["sim"]["roomId"] == "windowgate" and st["panelKind"] != "boundary" and any(n["id"] == "nell" and n["state"] == "sit" for n in st["npcs"]) and page.evaluate("Boolean(document.querySelector('.dungeon-wear-wrap'))"), str((st["sim"]["roomId"], st["panelKind"], st["npcs"])))
    check("Rows: the chapter raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # Without the help at Receiving, Latch's line is different (nothing is lost). Reduced motion here.
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP.replace("RizoRuntimeQA.loadForQA(s)", "s.settings.reducedMotion=true;RizoRuntimeQA.loadForQA(s)")); launch(page); skip(page)
    rgo(page, "windowgate", "gate-entry")
    check("Rows: reduced motion is honoured in the Rows", page.evaluate("Boolean(document.querySelector('.dungeon-reduced-motion'))"))
    seen = []
    drive(page, lambda st: (seen.extend(b["text"] for b in st["barks"]) or any(n["id"] == "latch" for n in st["npcs"]) and any("It shows." in t for t in seen)), limit=80, step=250)
    check("Rows: without the ledge help Latch says something else, and nothing is closed off", any("You two opened the rows. It shows." in t for t in seen) and not any("catch held" in t for t in seen), str(seen[-4:]))
    check("Rows (reduced-motion variant) raises no page errors", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ================= FORCE-UPDATE HANDOFF =================
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); st = launch(page); camp = st["data"]["campaign"]["id"]
    page.evaluate("(()=>{window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rizo-save-v2')throw new Error('QuotaExceededError');return window.__realSet.call(this,k,v)}})()")
    held = page.evaluate("RizoRuntimeQA.modeUpdateHandoffForQA()")
    page.evaluate("(()=>{Storage.prototype.setItem=window.__realSet;return true})()")
    st = page.evaluate(ST)
    check("a forced update aborts when the Dungeon cannot commit", held == {"ok": False, "status": "failed"} and page.evaluate("RizoModes.active()") == "dungeon", str(held))
    check("the held update is explained and a fresh Resume clears it", "update" in st["holds"] and "update waited" in page.evaluate("document.querySelector('.dungeon-panel').textContent"))
    page.evaluate("document.querySelector('[data-dungeon-action=\"resume\"]').click()"); page.wait_for_timeout(100)
    check("…after which play continues", page.evaluate(ST)["holds"] == [])
    ok = page.evaluate("RizoRuntimeQA.modeUpdateHandoffForQA()")
    check("a confirmed commit lets the update proceed and stops simulation", ok == {"ok": True, "status": "committed"} and "update" in page.evaluate(ST)["holds"], str(ok))
    page.reload(); page.wait_for_timeout(1300)
    st = launch(page)
    check("after the (simulated) update the same campaign resumes", st["data"]["campaign"]["id"] == camp and st["sim"]["roomId"] == "car")
    ctx.close()

    # ================= SAVE-BLOCKED TAB =================
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); st = launch(page)
    page.evaluate("(()=>{const v=JSON.parse(localStorage.getItem('rizo-save-v2'));v.writeId='W-OTHER-TAB';localStorage.setItem('rizo-save-v2',JSON.stringify(v))})()")
    page.keyboard.press("Escape"); page.wait_for_timeout(60)
    page.evaluate("document.querySelector('[data-dungeon-action=\"home\"]').click()"); page.wait_for_timeout(200)
    st = page.evaluate(ST)
    page.evaluate("RizoRuntimeQA.suspendRuntimeForQA('background')"); page.evaluate("RizoRuntimeQA.resumeRuntimeForQA('visible')")
    st2 = page.evaluate(ST)
    check("a stale tab's commit is blocked and the hub's save-protected notice shows", st["lastOutcome"]["status"] == "blocked" and page.evaluate("Boolean(document.querySelector('#rizoSaveBlocked:not([hidden])'))"), str(st["lastOutcome"]))
    check("save-blocked survives resume notifications and the player's Resume", "save-blocked" in st2["holds"] and page.evaluate("document.querySelector('[data-dungeon-action=\"resume\"]')?.disabled ?? true"))
    check("the other tab's newer save is untouched", json.loads(page.evaluate("localStorage.getItem('rizo-save-v2')"))["writeId"] == "W-OTHER-TAB")
    ctx.close()

    # ================= ISOLATION: no Dungeon scripts =================
    ctx, page, errors = boot(browser, seed={V2: saved_with_knot, V2_BACKUP: saved_with_knot}, block_dungeon=True)
    iso = page.evaluate("({modes:RizoModes.list().map(m=>m.id),ok:Boolean(window.__RIZO_BUILD__),acc:RizoRuntimeQA.snapshot().pet.accessory,wear:Boolean(document.querySelector('.wearable-first-knot')),button:(RizoRuntimeQA.setViewForQA('go'),document.querySelector('[data-mode=\"dungeon\"]').textContent)})")
    page.evaluate("RizoRuntimeQA.saveForQA()")
    kept = json.loads(page.evaluate("localStorage.getItem('rizo-save-v2')"))
    check("without Dungeon scripts the hub boots, Defense still registers, the card says UNAVAILABLE", iso["modes"] == ["defense"] and iso["button"] == "UNAVAILABLE" and not [e for e in errors if "dungeon" not in e.lower()], str((iso, errors[:2])))
    check("First Knot stays a working hub wearable without the Dungeon", iso["acc"] == "first-knot" and iso["wear"], str(iso))
    check("the unregistered Dungeon slice survives a save untouched", kept["modes"]["dungeon"] == json.loads(saved_with_knot)["modes"]["dungeon"])
    ctx.close()

    # ================= A FAILED START NEVER LEAVES THE HUB LOCKED =================
    ctx = browser.new_context(service_workers="block", viewport={"width": 390, "height": 844}, has_touch=True)
    def broken_view(route):
        body = route.fetch().text().replace("return Object.freeze({ create,", "return Object.freeze({ create: () => { throw new Error('qa: view failed'); }, unused: create,")
        route.fulfill(body=body, content_type="application/javascript")
    ctx.route("**/modes/dungeon/dungeon-view.js*", broken_view)
    page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_timeout(1200)
    page.evaluate(SETUP); page.evaluate("RizoRuntimeQA.setViewForQA('go')"); page.wait_for_timeout(250)
    page.evaluate("try{document.querySelector('[data-mode=\"dungeon\"]').click()}catch(e){}"); page.wait_for_timeout(700)
    after = page.evaluate("({active:RizoModes.active(),locked:document.documentElement.classList.contains('dungeon-locked')||document.body.classList.contains('dungeon-locked'),body:getComputedStyle(document.body).position,select:getComputedStyle(document.body).userSelect||getComputedStyle(document.body).webkitUserSelect})")
    check("a Dungeon start that throws releases the page lock (Hub scroll and selection intact)", after["active"] is None and not after["locked"] and after["body"] != "fixed" and after["select"] != "none", str((after, errors[:2])))
    ctx.close()

    # ================= SIGNED NEWER-HUB SAVE =================
    future = subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');
const s=JSON.parse(process.argv[2]).state;s.version=24;s.inventory.accessories.push('return-coat');s.pet.accessory='return-coat';
const env=Save.createEnvelope({state:s,modes:JSON.parse(process.argv[2]).modes,savedAt:Date.now(),writeId:'W-FUTURE',stateVersion:24});
console.log(JSON.stringify(env));""", str(ROOT), saved_with_knot], capture_output=True, text=True, check=True).stdout.strip()
    ctx, page, errors = boot(browser, seed={V2: future, V2_BACKUP: future})
    blocked = page.evaluate("document.querySelector('#rizoSaveBlocked h2')?.textContent||''")
    check("a signed save from a newer hub (unknown wearable) is protected, not normalized", "NEWER RIZO.GAME" in blocked, blocked)
    page.evaluate("RizoRuntimeQA.saveForQA()")
    check("its original bytes are preserved", page.evaluate("localStorage.getItem('rizo-save-v2')") == future)
    ctx.close()

    # ================= OLDER SAVE MIGRATES (state v21 → v22) =================
    old = subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');
const s=JSON.parse(process.argv[2]).state;s.version=21;delete s.modeReceipts;delete s.pet.storyMarks;s.inventory.accessories=['none','scarf'];s.pet.accessory='scarf';
const env=Save.createEnvelope({state:s,modes:{},savedAt:Date.now()-3600e3,writeId:'W-V21',stateVersion:21});console.log(JSON.stringify(env));""", str(ROOT), saved_with_knot], capture_output=True, text=True, check=True).stdout.strip()
    ctx, page, errors = boot(browser, seed={V2: old, V2_BACKUP: old})
    s = page.evaluate(STORED)
    check("a version-21 save migrates to 23 with empty receipts and story marks, nothing lost", s["version"] == 23 and s["receipts"] == {} and s["marks"] == [] and s["petName"] == "MOSSY" and s["accessory"] == "scarf", str({k: s[k] for k in ("version", "receipts", "marks", "petName")}))
    check("migration boots without page errors", not errors, "; ".join(errors[:2]))
    ctx.close()

    # ================= RECOVERY DURING HIDDEN TIME =================
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP); st = launch(page); camp = st["data"]["campaign"]["id"]
    page.evaluate("RizoRuntimeQA.suspendRuntimeForQA('background')")
    page.evaluate("(()=>{const s=RizoRuntimeQA.snapshot();})()")
    page.evaluate("RizoRuntimeQA.agePetClockForQA(72*3600e3)")
    page.evaluate("RizoRuntimeQA.resumeRuntimeForQA('visible')"); page.wait_for_timeout(400)
    rec = page.evaluate("({active:RizoModes.active(),resting:RizoRuntimeQA.snapshot().pet.resting,modal:document.querySelector('#modalOverlay.show .recovery-card')!==null})")
    check("if time away sends the pet into recovery, the journey is saved and the Den's recovery flow takes over", rec["active"] is None and rec["resting"] and rec["modal"] and page.evaluate(STORED)["slice"]["campaign"]["id"] == camp, str(rec))
    ctx.close()

    browser.close()
server.shutdown()
print(f"\n{sum(results)}/{len(results)} dungeon checks passed")
sys.exit(0 if all(results) else 1)
