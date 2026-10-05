"""Static public pages and the existing game at phone widths, over real HTTP.

Uses Playwright's installed Chromium. No Google SDK, live ad or analytics request
is permitted. --directory can point at the packaged production site.
Screenshots/logs are review evidence, not physical Safari or field CWV results.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse, functools, threading, json, sys, subprocess, tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', default=str(ROOT))
parser.add_argument('--evidence', default='/tmp/rizo-public-review')
args = parser.parse_args()
directory = Path(args.directory).resolve()
evidence = Path(args.evidence); evidence.mkdir(parents=True, exist_ok=True)
# Exercise the production route contract, not source filenames.
if directory == ROOT:
    _artifact = tempfile.TemporaryDirectory(prefix='rizo-public-')
    directory = Path(_artifact.name) / 'site'
    subprocess.run([sys.executable,str(ROOT/'tools/build-site.py'),'--out',str(directory)],check=True)
sys.path.insert(0,str(ROOT/'tools'))
from static_site import StaticSiteHandler as Handler
server = ThreadingHTTPServer(('127.0.0.1',0), functools.partial(Handler,directory=str(directory)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin = 'http://127.0.0.1:'+str(server.server_address[1])
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS' if ok else 'FAIL'),name,detail if not ok else '',flush=True)
def geometry(page, selector):
    return page.locator(selector).evaluate_all('''els=>els.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.textContent.trim().slice(0,32),x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}})''')
def contained(items,w,h):
    return bool(items) and all(i['x']>=-1 and i['right']<=w+1 and i['y']>=-1 and i['bottom']<=h+1 for i in items)
SETUP = '''()=>{const s=RizoRuntimeQA.defaultState();s.introSeen=true;
Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:70,mood:90,hygiene:90,health:100,resting:false,sleeping:false,bond:40});
s.collection.classic=1;s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.player.defenseSchool={dismissed:true,completed:['route','placement','targeting','intel','doctrine','abilities'],replay:false};
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];s.settings.music=false;s.settings.sound=false;
const resident=JSON.parse(JSON.stringify(s.pet));Object.assign(resident,{id:'PUBLIC-HOUSE-1',name:'LODGER',homeRoom:0});
s.farm.roster=[resident];s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();RizoRuntimeQA.setViewForQA('home');return s.pet.id}'''
external = []
def local_only(route):
    if route.request.url.startswith(origin+'/'): route.continue_()
    else: external.append(route.request.url); route.abort()
with sync_playwright() as p:
    browser = p.chromium.launch()
    # Meaningful public content, images and navigation exist without JavaScript.
    for width in [320,375,390,430]:
        ctx = browser.new_context(viewport={'width':width,'height':844},has_touch=True,java_script_enabled=False,service_workers='block')
        ctx.route('**/*',local_only)
        page = ctx.new_page()
        for name in ['world','about','journal','support','privacy','terms']:
            response = page.goto(origin+('/' if name=='world' else '/'+name)); page.wait_for_timeout(60)
            size = page.evaluate('({w:innerWidth,doc:document.documentElement.scrollWidth})')
            check(f'{width}px {name}: static content, one H1 and no horizontal overflow',response.status==200 and page.locator('main h1').count()==1 and size['doc']<=width+1 and len(page.locator('main').inner_text())>200,str(size))
            check(f'{width}px {name}: images have loaded and links are named',page.evaluate('''()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&[...document.querySelectorAll('a')].every(a=>Boolean(a.textContent.trim()||a.getAttribute('aria-label')||a.querySelector('img[alt]')))'''))
        page.goto(origin+'/'); page.mouse.wheel(0,650); page.wait_for_timeout(80)
        check(f'{width}px public page scrolls normally and keeps selectable copy',page.evaluate('scrollY>0&&getComputedStyle(document.body).position!=="fixed"&&getComputedStyle(document.querySelector(".lede")).userSelect!=="none"'))
        nav = geometry(page,'.world-header nav a')
        check(f'{width}px public primary navigation has 44px touch height',all(i['h']>=44 for i in nav),str(nav))
        if width in [320,390]:
            page.screenshot(path=str(evidence/f'world-{width}.png'),full_page=True)
        ctx.close()
    # Keyboard entry and reduced motion, independently of a game's canvas.
    ctx=browser.new_context(viewport={'width':320,'height':844},reduced_motion='reduce',service_workers='block')
    ctx.route('**/*',local_only); page=ctx.new_page(); page.goto(origin+'/')
    page.keyboard.press('Tab'); check('public skip link is first and visible on focus',page.locator(':focus').get_attribute('class')=='skip-link')
    page.keyboard.press('Enter'); check('skip link puts keyboard focus on the content',page.locator(':focus').get_attribute('id')=='content')
    check('public reduced-motion view removes decorative rotation',page.locator('.intro-rizo').evaluate('e=>getComputedStyle(e).transform')=='none')
    page.evaluate('document.querySelectorAll("p").forEach(e=>e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*2)+"px")')
    check('public page still has no horizontal overflow with prose doubled in size',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    response=page.goto(origin+'/missing/deep/path'); check('deep missing URL is a real 404 with working root assets',response.status==404 and 'goes nowhere' in page.locator('h1').inner_text() and page.evaluate('document.images[0].naturalWidth>0'))
    response=page.goto(origin+'/ads.txt'); check('unconfigured ads.txt is missing rather than fabricated seller data or game HTML',response.status==404)
    ctx.close()
    for width in [320,375,390,430]:
        ctx=browser.new_context(viewport={'width':width,'height':844},has_touch=True,service_workers='block')
        ctx.route('**/*',local_only); page=ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(origin+'/play'); page.wait_for_function('Boolean(window.RizoRuntimeQA)')
        check(f'{width}px first arrival has an exit to World and no install gate',page.locator('.origin-world-link').is_visible() and not page.locator('#rizoInstallGate').is_visible())
        pet_id=page.evaluate(SETUP); page.wait_for_timeout(160)
        check(f'{width}px Den has no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.locator('[data-action="feed"]').click(); page.wait_for_timeout(80)
        check(f'{width}px food sheet locks background and contains focus',page.evaluate('document.getElementById("gameShell").inert&&document.getElementById("bottomSheet").contains(document.activeElement)'))
        page.keyboard.press('Tab'); check(f'{width}px sheet keyboard stays out of the background',page.evaluate('document.getElementById("bottomSheet").contains(document.activeElement)'))
        page.keyboard.press('Escape'); page.wait_for_timeout(80)
        check(f'{width}px sheet closes and releases the background',page.evaluate('!document.getElementById("gameShell").inert'))
        before=page.evaluate('RizoRuntimeQA.snapshot().pet.hunger'); page.evaluate('RizoRuntimeQA.useFoodForQA("crumbs")'); page.wait_for_timeout(160)
        check(f'{width}px ordinary care works without ads',page.evaluate('RizoRuntimeQA.snapshot().pet.hunger')>before)
        page.evaluate('RizoRuntimeQA.setViewForQA("farm")'); page.wait_for_timeout(180)
        check(f'{width}px House preserves resident and active Rizo identities',page.evaluate('RizoRuntimeQA.houseSnapshot().residents[0].name')=='LODGER' and page.evaluate('RizoRuntimeQA.snapshot().pet.id')==pet_id and page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.evaluate('RizoRuntimeQA.setViewForQA("go")'); page.wait_for_timeout(100)
        page.locator('button[data-mode="dungeon"]').click(); page.wait_for_timeout(600)
        page.evaluate('RizoRuntimeQA.dungeonSkipSceneForQA();RizoRuntimeQA.dungeonGotoForQA("clatter")'); page.wait_for_timeout(250);page.evaluate('RizoRuntimeQA.dungeonSkipSceneForQA()')
        controls=geometry(page,'.dungeon-key,.dungeon-dpad')
        check(f'{width}px Dungeon physical controls remain inside viewport and at least 44px',contained(controls,width,844) and all(i['w']>=44 and i['h']>=44 for i in controls),str(controls))
        check(f'{width}px Dungeon alone holds page scroll and selection',page.evaluate('document.documentElement.classList.contains("dungeon-locked")&&getComputedStyle(document.body).position==="fixed"&&getComputedStyle(document.querySelector(".dungeon-line")).userSelect==="none"'))
        page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(170,330)'); x=page.evaluate('RizoRuntimeQA.dungeonStateForQA().sim.player.x')
        page.keyboard.down('d'); page.wait_for_timeout(160);page.keyboard.down('z');page.wait_for_timeout(80)
        player=page.evaluate('RizoRuntimeQA.dungeonStateForQA().sim.player');page.keyboard.up('z');page.keyboard.up('d')
        check(f'{width}px Dungeon still moves and flares together',player['x']>x+5 and player['attacks']>=1)
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(200)
        landscape=geometry(page,'.dungeon-key,.dungeon-dpad')
        check(f'{width}px Dungeon rotates to landscape with usable controls',contained(landscape,844,390),str(landscape))
        page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(150)
        # Rotation deliberately establishes a manual hold. Resume, then open
        # the ordinary pause using the same physical key as a player.
        page.evaluate('document.querySelector("[data-dungeon-action=resume]")?.click()')
        page.keyboard.press('Escape');page.wait_for_timeout(100)
        check(f'{width}px Dungeon pause opens without quitting',page.evaluate('RizoModes.active()==="dungeon"&&RizoRuntimeQA.dungeonStateForQA().holds.includes("manual")'))
        page.evaluate('RizoModes.quitActive("qa-public-return")');page.wait_for_timeout(350)
        check(f'{width}px Dungeon return releases page and background while retaining pet',page.evaluate('!document.documentElement.classList.contains("dungeon-locked")&&getComputedStyle(document.body).position!=="fixed"&&!document.getElementById("gameShell").inert&&RizoRuntimeQA.snapshot().pet.id')==pet_id)
        page.evaluate('RizoRuntimeQA.startMiniGame("defense",{mapId:"grove"})');page.wait_for_timeout(240)
        page.evaluate('document.querySelector("[data-defense-skip-map-intro]")?.click()');page.wait_for_timeout(100)
        defense_controls=geometry(page,'.defense-action-circle,#defenseWaveButton')
        check(f'{width}px Defense initializes and its primary controls fit',page.evaluate('RizoRuntimeQA.defenseSnapshotForQA().phase')=='planning' and contained(defense_controls,width,844),str(defense_controls))
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(250)
        check(f'{width}px Defense primary controls also fit after rotation',contained(geometry(page,'.defense-action-circle,#defenseWaveButton'),844,390))
        page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(200)
        placed=page.evaluate('RizoRuntimeQA.defensePlaceNextForQA()');page.evaluate('RizoRuntimeQA.defenseStartWaveForQA()')
        check(f'{width}px Defense still places a Rizo and starts combat',placed==1 and page.evaluate('RizoRuntimeQA.defenseSnapshotForQA().currentWave')==1)
        page.locator('#defenseMenuButton').click();page.wait_for_timeout(80)
        page.wait_for_function('RizoRuntimeQA.defenseOverlayForQA().focusInside',timeout=3000)
        check(f'{width}px Defense menu holds its battlefield and keyboard focus',page.evaluate('RizoRuntimeQA.defenseOverlayForQA().stageInert&&RizoRuntimeQA.defenseOverlayForQA().focusInside'))
        page.keyboard.press('Escape');page.evaluate('RizoRuntimeQA.defenseFinishForQA()');page.wait_for_timeout(120)
        # Close any ordinary banked result before testing a different training run.
        page.evaluate('document.querySelector("[data-close-modal]")?.click()');page.wait_for_timeout(100)
        page.evaluate('RizoRuntimeQA.startMiniGame("memory")');page.wait_for_timeout(160)
        check(f'{width}px Arcade still starts and ad lifecycle holds its clock',page.evaluate('RizoRuntimeQA.arcadeClockForQA().mode')=='memory')
        page.evaluate('document.dispatchEvent(new CustomEvent("rizo:ad-start",{detail:{placement:"local-test"}}))');clock=page.evaluate('RizoRuntimeQA.arcadeClockForQA()');page.wait_for_timeout(100)
        check(f'{width}px a local ad lifecycle event mutes/holds without touching Google',clock['frozen'] and 'ad' in clock['sources'] and page.evaluate('document.getElementById("gameShell").inert'))
        page.evaluate('document.dispatchEvent(new CustomEvent("rizo:ad-end",{detail:{requiresResume:true}}))');page.wait_for_timeout(60)
        check(f'{width}px uncertain ad completion requires explicit Resume',page.evaluate('RizoRuntimeQA.arcadeClockForQA().paused'))
        check(f'{width}px play surfaces have no JavaScript exceptions or ad SDK',not errors and page.evaluate('!document.querySelector("script[data-rizo-google-ads]")'),str(errors))
        ctx.close()
    # A worker cannot turn an unknown route into a successful game navigation.
    ctx=browser.new_context(viewport={'width':390,'height':844});ctx.route('**/*',local_only)
    page=ctx.new_page();page.goto(origin+'/play');page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
    page.goto(origin+'/');page.wait_for_timeout(250)
    ctx.unroute('**/*',local_only)
    # Shut down the origin as well: Chromium's worker network context can retain
    # connectivity when only Playwright's page context is toggled offline.
    server.shutdown();server.server_close();ctx.set_offline(True)
    response=page.goto(origin+'/');check('visited public World remains available offline',response.status==200 and page.locator('h1').count()==1)
    response=page.goto(origin+'/unknown/deep/');check('unknown offline navigation does not impersonate the game',response.status==503,str({'status':response.status,'worker':response.from_service_worker,'body':response.text()[:120]}))
    response=page.goto(origin+'/play');check('the actual game still opens offline',response.status==200)
    ctx.close();browser.close()
server.shutdown()
check('default product attempted zero external ad, analytics, font or other requests',external==[],str(external[:8]))
print(f'\n{sum(results)}/{len(results)} public product checks passed; Chromium only; evidence: {evidence}',flush=True)
sys.exit(0 if all(results) else 1)
