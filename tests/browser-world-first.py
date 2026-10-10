"""RC2 route/PWA regression: packaged HTTP, fresh phones, real RC1 worker upgrade.

Chromium emulation only. No live legacy site, ads, production host or DNS access.
"""
import argparse, functools, hashlib, io, json, subprocess, sys, tarfile, tempfile, threading
from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RC1 = '77c3582017e41921a9495fb4afb26eee8801e497'
parser = argparse.ArgumentParser()
parser.add_argument('--directory')
args = parser.parse_args()
work = tempfile.TemporaryDirectory(prefix='rizo-world-first-')
scratch = Path(work.name)
if args.directory:
    candidate = Path(args.directory).resolve()
else:
    candidate = scratch / 'candidate'
    subprocess.run([sys.executable,str(ROOT/'tools/build-site.py'),'--out',str(candidate)],check=True)

# Preserve the actual reviewed RC1 bytes. This is a genuine old-worker fixture,
# not a fabricated worker with a similar cache name. CI fetches full ancestry.
baseline_source = scratch / 'rc1-source'; baseline_source.mkdir()
archive = subprocess.check_output(['git','archive',RC1],cwd=ROOT)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(baseline_source,filter='data')
baseline = scratch / 'rc1-site'
subprocess.run([sys.executable,str(baseline_source/'tools/build-site.py'),'--out',str(baseline)],check=True)
fingerprints = {str(p.relative_to(baseline)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(baseline.rglob('*')) if p.is_file()}
assert len(fingerprints)==160
assert hashlib.sha256(json.dumps(fingerprints,sort_keys=True).encode()).hexdigest()=='e13f2a53197ed6f77ab8d16fb2485d8dbbd88f587810355156a2cc205c05bfc9'
sys.path.insert(0,str(ROOT/'tools'))
from static_site import StaticSiteHandler

phase = {'directory':candidate,'missing_play':False}
class Handler(StaticSiteHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(phase['directory']),**kwargs)
    def do_GET(self):
        if phase['missing_play'] and urlsplit(self.path).path=='/play':
            self.send_error(503,'Required Play shell deliberately unavailable')
        else:
            super().do_GET()

server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin = 'http://127.0.0.1:'+str(server.server_address[1])
results=[];external=[]
def check(name,ok,detail=''):
    results.append(bool(ok));print(('PASS' if ok else 'FAIL'),name,detail if not ok else '',flush=True)
def local_only(route):
    if route.request.url.startswith(origin+'/'):route.continue_()
    else:external.append(route.request.url);route.abort()
def ready(page):
    page.wait_for_function('window.RizoBoot?.status().ready&&window.RizoRuntimeQA',timeout=30000)
def seed(page):
    return page.evaluate('''()=>{const s=RizoRuntimeQA.defaultState();s.introSeen=true;
      Object.assign(s.pet,{name:'ROUTE KEEP',stage:'kid',variant:'classic',hiddenVariant:'classic',health:100,hunger:80,energy:90,mood:90,hygiene:90,resting:false,sleeping:false});
      s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.settings.music=false;s.settings.sound=false;
      RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return s.pet.id}''')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [320,375,390,430]:
        ctx=browser.new_context(viewport={'width':width,'height':844},has_touch=True,reduced_motion='reduce')
        ctx.route('**/*',local_only);page=ctx.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        response=page.goto(origin+'/');page.wait_for_timeout(200)
        check(f'{width}px fresh / is static World with no overflow',response.status==200 and page.locator('.world-intro').count()==1 and page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        check(f'{width}px fresh World loads no game runtime or worker',page.evaluate('typeof RizoRuntimeQA==="undefined"&&typeof RizoBoot==="undefined"') and not any(any(part in u for part in ['/game-v79-defense.js','/core/','/training/','/modes/','/monetization.js','/install-manager.js']) for u in requests) and page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)')==0,str(requests))
        check(f'{width}px World canonical and Play anchor are explicit',page.locator('link[rel=canonical]').get_attribute('href')=='https://rizo.world/' and page.locator('.primary-link').first.get_attribute('href')=='/play' and page.locator('.primary-link').first.inner_text().startswith('Play'))
        check(f'{width}px primary Play is an unclipped 44px tap target',page.locator('.primary-link').first.evaluate('e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.x>=0&&r.right<=innerWidth}'))
        page.keyboard.press('Tab');page.keyboard.press('Enter')
        check(f'{width}px skip link moves keyboard focus into main',page.evaluate('document.activeElement.id==="content"'))
        page.locator('.primary-link').first.focus()
        check(f'{width}px keyboard Play has visible focus',page.locator('.primary-link').first.evaluate('e=>e===document.activeElement&&parseFloat(getComputedStyle(e).outlineWidth)>=2'))
        page.keyboard.press('Enter');ready(page)
        check(f'{width}px keyboard Play enters the existing game at /play',page.url==origin+'/play' and page.evaluate('RizoBoot.expected')=='v97-dungeon-collection')
        pet=seed(page);page.reload();ready(page)
        check(f'{width}px direct Play refresh retains the signed pet',page.evaluate('RizoRuntimeQA.snapshot().pet.id')==pet and page.locator('link[rel=canonical]').get_attribute('href')=='https://rizo.world/play')
        page.goto(origin+'/');page.goto(origin+'/play');ready(page)
        check(f'{width}px World return and shared Play keep the same pet',page.evaluate('RizoRuntimeQA.snapshot().pet.id')==pet)
        check(f'{width}px transition has no runtime exceptions or ad SDK',not errors and page.evaluate('!document.querySelector("script[data-rizo-google-ads]")'),str(errors))
        ctx.close()

    ctx=browser.new_context();ctx.route('**/*',local_only)
    for alias,target in [('/index.html','/play'),('/index','/play'),('/game','/play'),('/play.html','/play'),('/play/','/play'),('/world.html','/'),('/world','/'),('/world/','/')]:
        response=ctx.request.get(origin+alias+'?source=pwa',max_redirects=0)
        check('HTTP '+alias+' converges once and retains query',response.status==301 and response.headers.get('location')==target+'?source=pwa',str(response.headers))
    for route in ['/','/play','/about','/journal','/support','/privacy','/terms']:
        response=ctx.request.get(origin+route)
        check('canonical '+route+' is a real static 200',response.status==200 and 'https://rizo.world'+route in response.text())
    response=ctx.request.get(origin+'/missing/deep/route')
    check('missing online route has authored real 404',response.status==404 and 'That door' in response.text())
    for path in ['/docs/ARCHITECTURE.md','/tests/browser-world-first.py','/_headers','/_redirects','/ads.txt']:
        check('non-public '+path+' is absent',ctx.request.get(origin+path).status==404)
    ctx.close()

    phase['directory']=baseline
    ctx=browser.new_context(viewport={'width':390,'height':844});ctx.route('**/*',local_only)
    page=ctx.new_page();page.goto(origin+'/');ready(page)
    page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
    pet=seed(page)
    check('upgrade starts with exact RC1 runtime and its real worker cache',page.evaluate('RizoBoot.expected')=='v92-release-candidate-1' and page.evaluate('caches.keys().then(k=>k.includes("rizo-game-v92-release-candidate-1"))'))
    page.evaluate('window.__rc2ControllerChanges=0;navigator.serviceWorker.addEventListener("controllerchange",()=>window.__rc2ControllerChanges++)')
    phase['directory']=candidate;phase['missing_play']=True
    page.evaluate('navigator.serviceWorker.getRegistration().then(async r=>{await r.update();const w=r.installing;if(w&&w.state!=="redundant")await new Promise(resolve=>w.addEventListener("statechange",()=>{if(w.state==="redundant")resolve()}));})')
    check('missing required Play rejects RC2 takeover and preserves RC1 cache',page.evaluate('window.__rc2ControllerChanges===0') and page.evaluate('caches.keys().then(k=>k.includes("rizo-game-v92-release-candidate-1"))'))
    phase['missing_play']=False
    page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
    page.wait_for_function('window.__rc2ControllerChanges>0',timeout=30000)
    # wait_for_function polls synchronous truthiness; a Promise would appear
    # ready before caches.keys() completes. Await the actual activation state.
    keys=page.evaluate('''async()=>{const until=Date.now()+30000;while(Date.now()<until){
      const k=await caches.keys();if(k.includes("rizo-game-v97-dungeon-collection")&&!k.includes("rizo-game-v92-release-candidate-1"))return k;
      await new Promise(resolve=>setTimeout(resolve,100));}return await caches.keys()}''')
    check('complete RC2 takes over and retires the old game-root cache','rizo-game-v97-dungeon-collection' in keys and 'rizo-game-v92-release-candidate-1' not in keys,str(keys))
    page.goto(origin+'/')
    check('upgraded / is World, never the cached RC1 game',page.locator('.world-intro').count()==1 and page.evaluate('typeof RizoRuntimeQA==="undefined"'))
    page.goto(origin+'/play?source=pwa');ready(page)
    check('upgraded PWA start enters RC2 with existing pet and save keys',page.evaluate('RizoBoot.expected')=='v97-dungeon-collection' and page.evaluate('RizoRuntimeQA.snapshot().pet.id')==pet and page.evaluate('JSON.parse(localStorage.getItem("rizo-save-v2")).state.pet.name')=='ROUTE KEEP')
    manifest=ctx.request.get(origin+'/manifest.webmanifest').json()
    check('PWA identity and root scope stay stable; start deliberately opens Play',manifest['id']=='./' and manifest['scope']=='./' and manifest['start_url']=='./play?source=pwa')
    ctx.unroute('**/*',local_only)
    server.shutdown();server.server_close();ctx.set_offline(True)
    for route,world in [('/?entry=cold-world',True),('/play?source=pwa',False),('/index.html?source=pwa',False),('/play/',False),('/world.html',True)]:
        response=page.goto(origin+route)
        if not world:ready(page)
        check('offline '+route+' serves the intended current shell',response.status==200 and response.from_service_worker and (page.locator('.world-intro').count()==1 if world else page.evaluate('RizoBoot.expected')=='v97-dungeon-collection'))
    response=page.goto(origin+'/about?entry=cold-policy')
    check('offline public policy query uses its own cached page',response.status==200 and 'little face behind' in ' '.join(page.locator('h1').inner_text().lower().split()))
    for route in ['/unknown/deep/','/unknown/index.html','/ads.txt']:
        response=page.goto(origin+route)
        check('unknown offline '+route+' stays 503 without either shell',response.status==503 and page.locator('.world-intro').count()==0 and page.evaluate('typeof RizoRuntimeQA==="undefined"'))
    ctx.close();browser.close()
check('World-first pass makes zero third-party requests',not external,str(external))
print(f'\n{sum(results)}/{len(results)} World-first routing checks passed; Chromium only',flush=True)
sys.exit(0 if all(results) else 1)
