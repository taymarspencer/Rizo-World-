"""Phone-scale presentation contracts for HOME / TRAIN / GO.

Exercises the real controls. Station art follows focus without changing the
save, every filtered drill stays reachable, bed and toy visuals retain their
hit areas, and reduced motion also applies to the new object reactions.
Run with --evidence DIR to capture one focused sheet per phone plus the yard
stations. This is development-only; tools/build-site.py excludes tests.
"""
import argparse, functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--evidence', type=Path)
args = parser.parse_args()
if args.evidence: args.evidence.mkdir(parents=True, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/index.html'
results=[]
def check(name, ok, detail=None):
    results.append(bool(ok));print(('PASS' if ok else 'FAIL'),name,'' if ok else detail,flush=True)
def shot(page, name, selector=None):
    page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    page.wait_for_timeout(120)
    if args.evidence:
        if selector: page.locator(selector).screenshot(path=str(args.evidence / (name+'.png')))
        else: page.screenshot(path=str(args.evidence / (name+'.png')))
SETUP = """()=>{const q=RizoRuntimeQA,s=q.defaultState();s.introSeen=true;
s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.player.keeperGuideSeen=true;
s.settings.sound=false;s.settings.music=false;s.meta.totalHatched=1;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];s.wallet.embers=176;
s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
Object.assign(s.pet,{name:'RIZO',stage:'kid',variant:'classic',hiddenVariant:'classic',xp:50,bond:10,hunger:95,energy:95,hygiene:80,mood:80});
s.collection.classic=1;q.loadForQA(s);q.saveForQA();}"""
BOXES = """sel=>[...document.querySelectorAll(sel)].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {name:n.textContent.trim()||n.getAttribute('aria-label'),x:r.x,right:r.right,w:r.width,h:r.height};})"""
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in [(320,568),(375,812),(390,844),(430,932)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,service_workers='block')
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL);page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready');page.evaluate(SETUP);page.wait_for_timeout(200)
        shot(page,f'home-{width}','#habitatCard')
        for tier in range(4):
            page.evaluate('(tier)=>{const s=RizoRuntimeQA.snapshot();s.home.tier=tier;RizoRuntimeQA.loadForQA(s)}',tier)
            page.locator('#denBed').tap();page.wait_for_timeout(900)
            v=page.evaluate("""()=>{const b=document.querySelector('#denBed').getBoundingClientRect(),r=document.querySelector('#petSprite').getBoundingClientRect();return {sleep:RizoRuntimeQA.snapshot().pet.sleeping,inBed:r.x+r.width/2>b.x&&r.x+r.width/2<b.right,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id==='denBed'};}""")
            check(f'{width}: tier {tier} sleeps inside a tappable bed',all(v.values()),v)
            if width==320 and tier==1:shot(page,'sleep-320','#habitatCard')
            page.locator('#denBed').tap();page.wait_for_timeout(100)
        page.locator('.bottom-nav [data-nav="arcade"]').tap();page.wait_for_timeout(100)
        before=page.evaluate('JSON.stringify({home:RizoRuntimeQA.snapshot().home,wallet:RizoRuntimeQA.snapshot().wallet,skills:RizoRuntimeQA.snapshot().pet.skills})')
        for focus in ['speed','instinct','power']:
            page.locator(f'[data-training-focus="{focus}"]').tap();page.wait_for_timeout(100)
            station=page.locator('#trainingFeatured').get_attribute('data-station')
            check(f'{width}: {focus} selection stages its practice equipment',station==focus,station)
            if width==390:shot(page,f'station-{focus}','#trainingFeatured')
        after=page.evaluate('JSON.stringify({home:RizoRuntimeQA.snapshot().home,wallet:RizoRuntimeQA.snapshot().wallet,skills:RizoRuntimeQA.snapshot().pet.skills})')
        check(f'{width}: changing station never spends or awards anything',before==after)
        page.locator('[data-training-focus="all"]').tap();page.wait_for_timeout(100)
        check(f'{width}: ten empty practice marks for an untrained Rizo',page.locator('.yard-patches i:not(.earned)').count()==10)
        page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.home.trained=['power','rhythm'];RizoRuntimeQA.loadForQA(s)}")
        check(f'{width}: yard marks reflect the two earned Home patches',page.locator('.yard-patches i.earned').count()==2)
        shot(page,f'train-{width}')
        if width==320:
            ready=page.evaluate("""()=>{const b=document.querySelector('#trainingFeatured button').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return b.bottom<=n.top&&b.top>0}""")
            check('320: first drill starts above the fixed navigation',ready)
        page.locator('#trainingLibrary>summary').tap();page.wait_for_timeout(100)
        boxes=page.evaluate(BOXES,'#trainingLibrary [data-minigame],#trainingFeatured button,.training-focus button')
        check(f'{width}: all ten drills and focus controls retain 44px targets',len(boxes)==15 and all(b['w']>=44 and b['h']>=44 for b in boxes),boxes)
        check(f'{width}: expanded training board has no sideways overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
        page.locator('#trainingLibrary>summary').tap()
        page.locator('.bottom-nav [data-nav="go"]').tap();page.wait_for_timeout(120)
        check(f'{width}: GO keeps both valid destinations',page.locator('#viewGo [data-mode="dungeon"],#viewGo [data-mode="defense"]').count()==2)
        boxes=page.evaluate(BOXES,'#viewGo [data-mode]')
        check(f'{width}: destination tap targets fit the phone',all(b['x']>=0 and b['right']<=width and b['h']>=44 for b in boxes),boxes)
        check(f'{width}: GO has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
        shot(page,f'go-{width}')
        if width==320:
            ready=page.evaluate("""()=>{const b=document.querySelector('#viewGo [data-mode="dungeon"]').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return b.bottom<=n.top&&b.top>0}""")
            check('320: first departure is above the fixed navigation',ready)
        if width==320:shot(page,'go-destinations-320','#viewGo')
        check(f'{width}: no browser exceptions',not errors,errors)
        ctx.close()
    for reduced in ['os','setting']:
        ctx=browser.new_context(viewport={'width':320,'height':568},has_touch=True,is_mobile=True,service_workers='block',reduced_motion='reduce' if reduced=='os' else 'no-preference')
        page=ctx.new_page();page.goto(URL);page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready');page.evaluate(SETUP)
        if reduced=='setting':page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.settings.reducedMotion=true;RizoRuntimeQA.loadForQA(s)}")
        page.locator('.toy-ball').tap();page.wait_for_timeout(80)
        animation=page.locator('.toy-ball').evaluate('(n)=>getComputedStyle(n).animationName')
        check(f'{reduced} reduced motion: ball reaction stays still',animation=='none',animation)
        page.wait_for_timeout(2300);page.locator('.toy-puddle').tap();page.wait_for_timeout(80)
        animation=page.locator('.toy-ripple').evaluate('(n)=>getComputedStyle(n).animationName')
        check(f'{reduced} reduced motion: ripple stays still',animation=='none',animation)
        check(f'{reduced}: toy gestures cannot select text',page.locator('.toy-ball').evaluate('(n)=>getComputedStyle(n).userSelect')=='none')
        ctx.close()
    browser.close()
server.shutdown()
print(f'\n{sum(results)}/{len(results)} visual uphaul checks passed')
sys.exit(0 if all(results) else 1)
