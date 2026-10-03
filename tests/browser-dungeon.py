"""Rizo Dungeon Gate 1, through the real hub (index.html over HTTP, real
localStorage, real reloads).

Covers: entry with the actual named/dressed Rizo; keyboard, mouse and touch
driving one action state (and the physical keys); move + act together; the
Draftling, death, rest and retry; lifecycle holds; care policy; persistence
(reload, import, deleted run keys); identity (House swap, release warning);
the QA-only completion fixture (First Knot / story mark, duplicate and
conflicting receipts, failed primary, failed backup); the force-update
handoff; a signed newer-hub save; and the hub booting without Dungeon scripts.

Chromium only. This is not Safari or physical-phone evidence.
"""
import functools, http.server, json, socketserver, subprocess, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
V2, V2_BACKUP = "rizo-save-v2", "rizo-save-v2:backup"

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/index.html"

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
    page.evaluate("RizoRuntimeQA.setViewForQA('arcade')"); page.wait_for_timeout(250)
    # A real player cannot press the shelf through a hub modal.
    assert not page.evaluate("document.getElementById('modalOverlay').classList.contains('show')"), page.evaluate("document.querySelector('#modalOverlay .modal-card')?.className")
    page.evaluate("document.querySelector('[data-mode=\"dungeon\"]').click()"); page.wait_for_timeout(700)
    return page.evaluate(ST)

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
    page.evaluate("RizoRuntimeQA.setViewForQA('arcade')"); page.wait_for_timeout(150)
    meta = page.evaluate("document.querySelector('[data-mode-meta=\"dungeon\"]').innerText")
    check("shelf card describes a free journey, not an ENDLESS energy run", "FREE" in meta and "REVIEW" in meta and "ENDLESS" not in meta and "ENERGY" not in meta, meta)
    before_hunger = page.evaluate("RizoRuntimeQA.snapshot().pet.hunger")
    st = launch(page)
    check("the Dungeon opens from the shelf through RizoModes", page.evaluate("RizoModes.active()") == "dungeon" and st["ui"] == "play", str(st and st["ui"]))
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
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(176,236)")
    # A fresh leg: rest at the hearth brings the Draftling back; then stand in its path.
    hearth = page.evaluate("RizoDungeonContent.ROOMS.clatter.hearth")
    page.evaluate(f"RizoRuntimeQA.dungeonTeleportForQA({hearth['x'] + 20},{hearth['y']})"); page.wait_for_timeout(100)
    prompt = page.evaluate("[document.querySelector('.dungeon-prompt').hidden, document.querySelector('.dungeon-prompt').textContent, document.querySelector('.dungeon-key-primary b').textContent]")
    check("the hearth shows a highlighted KINDLE prompt and the key says so", prompt[0] is False and "KINDLE" in prompt[1] and prompt[2] == "KINDLE", str(prompt))
    page.keyboard.press("z"); page.wait_for_timeout(500)
    page.keyboard.press("x"); page.wait_for_timeout(1000)
    check("Secondary cancels a Kindle safely", page.evaluate(ST)["sim"]["player"]["act"] is None and (page.evaluate(STORED)["slice"]["checkpoint"]["hearthId"] in (None, hearth["id"])))
    page.keyboard.press("z"); page.wait_for_timeout(1500)
    s = page.evaluate(STORED); st = page.evaluate(ST)
    check("Kindle rests: hearth registered, Flame full, checkpoint committed", s["slice"]["checkpoint"]["hearthId"] == hearth["id"] and s["slice"]["continuation"]["resumeKind"] == "hearth" and st["sim"]["player"]["flame"] == 5, str(s["slice"]["checkpoint"]))
    check("rest brings the ordinary Draftling back for a new leg", st["sim"]["enemies"][0]["state"] != "gone" and st["sim"]["enemies"][0]["hp"] == 4)
    check("the rest is reported as a protected semantic event (dormant)", any(e["kind"] == "checkpointRest" and e["tone"] == "protected" and e["mode"] == "dungeon" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")))
    page.evaluate("RizoRuntimeQA.dungeonTeleportForQA(176,240)")
    events = page.evaluate("RizoRuntimeQA.dungeonAdvanceForQA(20000,{})")
    st = page.evaluate(ST); s = page.evaluate(STORED)
    check("standing in the lunge line brings the Rizo down and back at the hearth", "down" in events and "respawn-ready" in events and st["sim"]["player"]["flame"] == 5 and abs(st["sim"]["player"]["x"] - 124) < 0.1, str((events.count("hurt"), st["sim"]["player"])))
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
    check("reload resumes the same campaign at its safe anchor with full Flame", st["data"]["campaign"]["id"] == camp and st["petId"] == pet_id and abs(st["sim"]["player"]["x"] - 124) < 0.1 and st["sim"]["player"]["flame"] == 5, str(st["sim"]["player"]))
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
    check("the hub records returnedToHub and releases the care hold", any(e["kind"] == "returnedToHub" for e in page.evaluate("RizoRuntimeQA.modeEventsForQA()")) and page.evaluate("RizoRuntimeQA.careHoldForQA()") is None)
    fed = page.evaluate("(()=>{const before=RizoRuntimeQA.snapshot().pet.hunger;RizoRuntimeQA.useFoodForQA('crumbs');return [before,RizoRuntimeQA.snapshot().pet.hunger]})()")
    check("feeding works in the Den afterwards; no modal interrupts the return", fed[1] > fed[0] and not page.evaluate("document.getElementById('modalOverlay').classList.contains('show')"), str(fed))
    page.evaluate("RizoRuntimeQA.agePetClockForQA(3*3600e3)")
    pet3 = page.evaluate("RizoRuntimeQA.processElapsedForQA()")
    check("ordinary care resumes after exit", pet3["hunger"] < fed[1] - 2, str((fed[1], pet3["hunger"])))
    meta = page.evaluate("RizoRuntimeQA.setViewForQA('arcade'), document.querySelector('[data-mode-meta=\"dungeon\"]').innerText")
    check("the shelf shows the journey's progress", "ROOM 1/6" in meta, meta)

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

    # ================= DEFENSE REGRESSION: a live run under the Arcade view =================
    ctx, page, errors = boot(browser, seed={})
    page.evaluate(SETUP)
    page.evaluate("RizoRuntimeQA.setViewForQA('arcade')"); page.wait_for_timeout(200)
    page.evaluate("RizoRuntimeQA.startMiniGame('defense',{mapId:'grove'})"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-defense-skip-map-intro]')?.click()"); page.wait_for_timeout(200)
    page.evaluate("RizoRuntimeQA.renderAll()"); page.wait_for_timeout(100)
    check("a live Defense run survives the Arcade shelf refresh", page.evaluate("RizoModes.active()") == "defense" and page.evaluate("Boolean(document.getElementById('miniArena')?.children.length)") and page.evaluate("document.querySelector('button[data-mode=\"defense\"]').textContent") != "")
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
    check("a completed proof opens a small return panel, never replaying the reward", st["ui"] == "blocked" and "REACHED HOME" in page.evaluate("document.querySelector('.dungeon-panel').textContent") and page.evaluate(STORED)["accessories"].count("first-knot") == 1)
    page.evaluate("document.querySelector('[data-dungeon-action=\"leave\"]').click()"); page.wait_for_timeout(700)
    check("fixture flows raise no page errors", not errors, "; ".join(errors[:3]))
    saved_with_knot = page.evaluate("localStorage.getItem('rizo-save-v2')")
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
    check("after the (simulated) update the same campaign resumes", st["data"]["campaign"]["id"] == camp and st["ui"] == "play")
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
    iso = page.evaluate("({modes:RizoModes.list().map(m=>m.id),ok:Boolean(window.__RIZO_BUILD__),acc:RizoRuntimeQA.snapshot().pet.accessory,wear:Boolean(document.querySelector('.wearable-first-knot')),button:(RizoRuntimeQA.setViewForQA('arcade'),document.querySelector('[data-mode=\"dungeon\"]').textContent)})")
    page.evaluate("RizoRuntimeQA.saveForQA()")
    kept = json.loads(page.evaluate("localStorage.getItem('rizo-save-v2')"))
    check("without Dungeon scripts the hub boots, Defense still registers, the card says UNAVAILABLE", iso["modes"] == ["defense"] and iso["button"] == "UNAVAILABLE" and not [e for e in errors if "dungeon" not in e.lower()], str((iso, errors[:2])))
    check("First Knot stays a working hub wearable without the Dungeon", iso["acc"] == "first-knot" and iso["wear"], str(iso))
    check("the unregistered Dungeon slice survives a save untouched", kept["modes"]["dungeon"] == json.loads(saved_with_knot)["modes"]["dungeon"])
    ctx.close()

    # ================= SIGNED NEWER-HUB SAVE =================
    future = subprocess.run(["node", "-e", r"""
const Save=require(process.argv[1]+'/core/rizo-save-core.js');
const s=JSON.parse(process.argv[2]).state;s.version=23;s.inventory.accessories.push('return-coat');s.pet.accessory='return-coat';
const env=Save.createEnvelope({state:s,modes:JSON.parse(process.argv[2]).modes,savedAt:Date.now(),writeId:'W-FUTURE',stateVersion:23});
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
    check("a version-21 save migrates to 22 with empty receipts and story marks, nothing lost", s["version"] == 22 and s["receipts"] == {} and s["marks"] == [] and s["petName"] == "MOSSY" and s["accessory"] == "scarf", str({k: s[k] for k in ("version", "receipts", "marks", "petName")}))
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
