"""Dungeon Character Lab (tools/dungeon-lab/, development only).

The lab is a review tool, not a player feature, so this suite proves three
things. It is isolated: the site build ships none of it and no shipped file
points at it, and the lab never touches storage (the hub it boots for Rizo
runs on in-memory stores). It is complete: every world state, expression and
portrait the game draws is in the lab and renders, and states it lists as
different really paint differently. It is honest about size: the lab's
phone table (screen size per phone, portrait size, Rizo's actor box) is the
size the live game shows on those phones.
"""
import argparse
import functools
import http.server
import re
import socketserver
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--directory", help="an already built site (default: build one)")
parser.add_argument("--evidence")
args = parser.parse_args()
artifact = tempfile.TemporaryDirectory(prefix="rizo-lab-")
site = Path(args.directory).resolve() if args.directory else Path(artifact.name) / "site"
if not args.directory:
    subprocess.run([sys.executable, str(ROOT / "tools/build-site.py"), "--out", str(site)], check=True, stdout=subprocess.DEVNULL)
evidence = Path(args.evidence).resolve() if args.evidence else None
if evidence:
    evidence.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "tools"))
from static_site import StaticSiteHandler

results = []


def check(name, passed, detail=None):
    results.append({"name": name, "passed": bool(passed)})
    print(("PASS" if passed else "FAIL"), name, "" if passed else detail, flush=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(handler, directory):
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(handler, directory=str(directory)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{server.server_address[1]}"


# ---- 1. Isolation: the build ships no lab -------------------------------------------------------
shipped = [p for p in site.rglob("*") if p.is_file()]
check("the site build contains files", len(shipped) > 20, len(shipped))
check("no lab file is in the site build", not [p for p in shipped if "dungeon-lab" in str(p.relative_to(site))],
      [str(p.relative_to(site)) for p in shipped if "dungeon-lab" in str(p)])
check("no tools/ folder is in the site build", not (site / "tools").exists())
mentions = []
for p in shipped:
    if p.suffix in {".html", ".js", ".css", ".json", ".webmanifest", ".txt", ""}:
        text = p.read_text(errors="ignore")
        if re.search(r"dungeon-lab|RizoLabHub|RizoDungeonLab|Character Lab", text):
            mentions.append(str(p.relative_to(site)))
check("no shipped file links to or names the lab", not mentions, mentions)

LAB = serve(Quiet, ROOT) + "/tools/dungeon-lab/"
GAME = serve(StaticSiteHandler, site) + "/play"
art_source = (ROOT / "modes/dungeon/dungeon-art.js").read_text()
nell_arms = re.search(r"const NELL_ARMS = \{(.*?)\n  \};", art_source, re.S).group(1)
NELL_STATES = re.findall(r"^\s{4}([a-z]+):", nell_arms, re.M)

with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ---- 2. The lab itself ------------------------------------------------------------------------
    ctx = browser.new_context(viewport={"width": 1400, "height": 1000}, service_workers="block")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(LAB + "#v=lineup&a=0")
    page.wait_for_function("document.documentElement.dataset.labRizo", timeout=30000)
    check("the hub bridge boots the real Rizo", page.evaluate("document.documentElement.dataset.labRizo") == "ok",
          page.evaluate("document.documentElement.dataset.labRizo"))
    storage = page.evaluate("({local: localStorage.length, session: sessionStorage.length, keys: Object.keys(localStorage)})")
    check("the lab and its hub write nothing to storage", storage["local"] == 0 and storage["session"] == 0, storage)
    bridge = page.evaluate("""(()=>{const f=[...document.querySelectorAll('iframe')].find(f=>f.title.startsWith('hub bridge'));
      return f?{inMemory: !!f.contentWindow.__labStorage, saved: f.contentWindow.__labStorage.length, qa: !!f.contentWindow.RizoRuntimeQA}:null})()""")
    check("the hub runs on in-memory stores only", bool(bridge and bridge["inMemory"] and bridge["qa"]), bridge)
    check("the bridge never registered a service worker", page.evaluate("navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r=>r.length) : 0") == 0)

    lab = page.evaluate("RizoDungeonLab")
    art = page.evaluate("""(()=>({portraits: Object.fromEntries(Object.entries(RizoDungeonArt.PORTRAITS).map(([k,v])=>[k,Object.keys(v)])),
      scale: RizoDungeonArt.RULES.scale}))()""")
    cast = {c["id"]: c for c in lab["CAST"]}
    for want in ["rizo", "latch", "nell", "orr", "porter", "hood-tall", "hood-small", "hood-cap", "keeper", "you-seated", "van-crew", "draftling", "needle"]:
        check(f"the lab has {want}", want in cast)
    check("every Nell state the art draws is in the lab", cast["nell"]["states"] == NELL_STATES, (cast["nell"]["states"], NELL_STATES))
    check("every Latch portrait expression is a world expression too", sorted(cast["latch"]["exprs"]) == sorted(art["portraits"]["latch"]),
          (cast["latch"]["exprs"], art["portraits"]["latch"]))
    used = {c["portraits"] for c in lab["CAST"] if c["portraits"]}
    check("every portrait set in the game is reachable from a character", used == set(art["portraits"]), (used, set(art["portraits"])))
    check("every speaker with a portrait appears in the portraits view", page.evaluate("""(()=>{location.hash='v=portraits&a=0';return new Promise(r=>setTimeout(()=>r(document.querySelectorAll('.lab-portrait-block').length),300))})()""") == len(art["portraits"]))
    portrait_total = sum(len(v) for v in art["portraits"].values())
    shown = page.evaluate("document.querySelectorAll('.lab-portrait-grid .lab-figure').length")
    check("every portrait expression is shown", shown == portrait_total, (shown, portrait_total))
    sizes = page.evaluate("[...new Set([...document.querySelectorAll('.lab-portrait-grid .dungeon-portrait')].map(n=>Math.round(n.getBoundingClientRect().width)))].sort((a,b)=>a-b)")
    check("portraits are shown at 46, 56 and 128 px", sizes == [46, 56, 128], sizes)
    blank = page.evaluate("[...document.querySelectorAll('.lab-portrait-grid .dungeon-portrait')].filter(n=>!n.querySelector('svg,img')).length")
    check("no portrait is blank", blank == 0, blank)

    # Every world state paints, and the states the lab lists as different paint differently.
    for c in lab["CAST"]:
        if c["id"] == "rizo":
            continue
        sigs, empty = {}, []
        for state in c["states"]:
            m = page.evaluate("([id,s])=>RizoDungeonLab.measure(id,s,1)", [c["id"], state])
            if not m or m["h"] < 3:
                empty.append(state)
            else:
                sigs[state] = m["sig"]
        check(f"{c['id']}: every state paints ({len(c['states'])})", not empty, empty)
        # Walking differs from standing only by the stride's bob in motion; the lab
        # declares any pair the art itself draws alike (shown as such in the sheet).
        twins = {b for a, b in c["alike"]}
        distinct = {s: v for s, v in sigs.items() if not s.startswith("walking") and s not in twins}
        dupes = len(distinct) - len(set(distinct.values()))
        check(f"{c['id']}: listed states are visibly different", dupes == 0, distinct)
        if c["facing"]:
            left = page.evaluate("([id,s])=>RizoDungeonLab.measure(id,s,-1)", [c["id"], c["states"][0]])
            check(f"{c['id']}: facing left paints a mirror", left and left["sig"] != sigs.get(c["states"][0]), c["id"])
        if c["exprs"]:
            e = {x: page.evaluate("([id,s,x])=>RizoDungeonLab.measure(id,s,1,x)['sig']", [c["id"], c["states"][0], x]) for x in c["exprs"]}
            check(f"{c['id']}: every world expression is different", len(set(e.values())) == len(e), e)

    # Every view renders, every Rizo pose loads the hub sprite.
    for view in ["inspect", "sheet", "lineup", "phones", "portraits"]:
        page.evaluate(f"location.hash='v={view}&c=nell&a=0'")
        page.wait_for_timeout(500)
        stages = page.evaluate("document.querySelectorAll('.lab-stage canvas').length")
        check(f"view {view} renders", page.evaluate("document.querySelector('.lab-main').dataset.view") == view and (stages > 0 or view == "portraits"), stages)
        if evidence:
            page.screenshot(path=str(evidence / f"lab-{view}.png"), full_page=True)
    page.evaluate("location.hash='v=sheet&c=rizo&a=0&z=2'")
    page.wait_for_timeout(2500)
    rizo = page.evaluate("""[...document.querySelectorAll('iframe.lab-rizo')].map(f=>{const d=f.contentDocument;const img=d&&d.querySelector('.mini-pet img');
      const pose=d&&d.querySelector('.dungeon-pose');return {ok:!!(img&&img.complete&&img.naturalWidth), pose: pose?pose.className:''}})""")
    check(f"every Rizo pose loads the hub's sprite ({len(rizo)})", rizo and all(r["ok"] for r in rizo) and len(rizo) == len(cast["rizo"]["states"]), [r for r in rizo if not r["ok"]][:3])
    check("Rizo poses carry the game's pose classes", all(r["pose"].startswith("dungeon-pose") for r in rizo))
    check("the lab raised no page errors", not errors, errors[:5])
    check("still nothing in storage after every view", page.evaluate("localStorage.length + sessionStorage.length") == 0)
    lab_phones = lab["PHONES"]

    def lab_actor(phone):
        page.evaluate(f"location.hash='v=inspect&c=rizo&p={phone}&z=1&rs=kid&a=0'")
        page.wait_for_timeout(1200)
        return page.evaluate("(()=>{const f=document.querySelector('iframe.lab-rizo');const a=f&&f.contentDocument.querySelector('.dungeon-actor');return a?a.getBoundingClientRect().width:null})()")

    lab_actors = {phone: lab_actor(phone) for phone in lab_phones}
    ctx.close()

    # ---- 3. The phone table is the live game's -----------------------------------------------------
    SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
      Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false});
      s.collection.classic=1;s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
      RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"""
    M = """(()=>{const s=document.querySelector('.dungeon-screen').getBoundingClientRect(),a=document.querySelector('.dungeon-actor').getBoundingClientRect(),
      p=document.querySelector('.dungeon-portrait');return {w:Math.round(s.width),h:Math.round(s.height),actor:a.width,portrait:p?parseFloat(getComputedStyle(p).width):null}})()"""
    for phone, spec in lab_phones.items():
        height = int(spec["label"].split("×")[1])
        game = browser.new_context(viewport={"width": int(phone), "height": height}, has_touch=True, is_mobile=True, device_scale_factor=2, service_workers="block")
        gp = game.new_page()
        gp.goto(GAME)
        gp.wait_for_timeout(1200)
        gp.evaluate(SETUP)
        gp.evaluate("RizoRuntimeQA.setViewForQA('arcade')")
        gp.wait_for_timeout(250)
        gp.evaluate("document.querySelector('[data-mode=\"dungeon\"]').click()")
        gp.wait_for_timeout(1200)
        outside = gp.evaluate(M)
        for _ in range(3):
            gp.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA()")
            gp.wait_for_timeout(60)
        gp.evaluate("RizoRuntimeQA.dungeonGotoForQA('clatter',null,{})")
        gp.wait_for_timeout(900)
        below = gp.evaluate(M)
        if evidence:
            gp.screenshot(path=str(evidence / f"game-below-{phone}.png"))
        check(f"{spec['label']}: outside screen is the lab's ({spec['open']['w']}×{spec['open']['h']})",
              abs(outside["w"] - spec["open"]["w"]) <= 1 and abs(outside["h"] - spec["open"]["h"]) <= 1, outside)
        check(f"{spec['label']}: BELOW screen is the lab's ({spec['locked']['w']}×{spec['locked']['h']})",
              abs(below["w"] - spec["locked"]["w"]) <= 1 and abs(below["h"] - spec["locked"]["h"]) <= 1, below)
        check(f"{spec['label']}: Rizo's actor box in the lab matches the game ({below['actor']:.1f} px)",
              lab_actors[phone] is not None and abs(lab_actors[phone] - below["actor"]) <= 0.6, (lab_actors[phone], below["actor"]))
        check(f"{spec['label']}: dialogue portrait is {spec['portrait']} px in the game", below["portrait"] == spec["portrait"], below["portrait"])
        game.close()
    browser.close()

failed = [r for r in results if not r["passed"]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
