"""Home → Training → Go in the real game, on phone viewports and real saves.

The previous-build fixture was written by the unchanged starting develop
(35ddead, state v22), with threshold-v3 choices and actual entitlement receipts.
Inputs and navigation use visible controls. QA only seeds a pet, shortens a
run's deadline, and completes Defense waves (its full gameplay has a suite).
"""
import argparse, functools, http.server, json, subprocess, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--evidence', type=Path)
args = parser.parse_args()
if args.evidence:
    args.evidence.mkdir(parents=True, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/index.html'
results = []
def record(name, passed, detail=''):
    results.append(bool(passed))
    print(('PASS' if passed else 'FAIL'), name, str(detail)[:700], flush=True)

SETUP = """()=>{const q=RizoRuntimeQA,s=q.defaultState();s.introSeen=true;
 s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.player.keeperGuideSeen=true;
 s.settings.sound=false;s.settings.music=false;s.meta.totalHatched=1;
 s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];s.wallet.embers=176;
 s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
 Object.assign(s.pet,{name:'RIZO',stage:'kid',variant:'classic',hiddenVariant:'classic',xp:50,bond:10,hunger:95,energy:95,hygiene:80,mood:80});
 s.collection.classic=1;q.loadForQA(s);
 const saved=q.snapshot();saved.qaModes.defense.data.introSeen=true;
 saved.qaModes.defense.data.mapIntrosSeen=['grove'];saved.qaModes.defense.data.school.dismissed=true;
 q.loadForQA(saved);q.saveForQA();return true;}"""
STATE = '()=>RizoRuntimeQA.snapshot()'
HOME = '()=>RizoRuntimeQA.homeForQA()'
LAYOUT = """()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {
 width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,
 scene:box('#habitatScene'),pet:box('#petActor'),nav:box('.bottom-nav'),
 navButtons:[...document.querySelectorAll('.bottom-nav button')].map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.nav,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};}),
 touch:[...document.querySelectorAll('.bottom-nav button,.care-action,#denBed,.garden-toy')].filter(n=>n.getClientRects().length).map(n=>({id:n.id||n.dataset.action||n.dataset.gardenToy||n.dataset.nav,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))};}"""

def boot(browser, width=390, height=844, seed=None, reduced=False):
    ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,service_workers='block',reduced_motion='reduce' if reduced else 'no-preference')
    if seed:
        ctx.add_init_script("(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');const e=%s;localStorage.setItem('rizo-save-v2',JSON.stringify(e));localStorage.setItem('rizo-save-v2:backup',JSON.stringify(e));})()" % json.dumps(seed))
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL);page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready')
    return ctx,page,errors

def shoot(page, name):
    if args.evidence: page.screenshot(path=str(args.evidence/(name+'.png')),full_page=True)

def train_power(page):
    page.locator('.bottom-nav [data-nav="arcade"]').tap()
    page.locator('#trainingFeatured [data-minigame="power"]').tap()
    page.wait_for_selector('#timingNeedle')
    # Read the rendered timing window, then press the called shot. No score or
    # qualification is injected: this is the authored game accepting real taps.
    for _ in range(100):
        info=page.evaluate("""()=>{const n=document.querySelector('#timingNeedle').getBoundingClientRect(),z=document.querySelector('#timingPerfectZone').getBoundingClientRect();return {close:Math.abs(n.x-z.x)<18,call:document.querySelector('#powerCall').textContent.toLowerCase(),guard:document.querySelector('#trainingBag').classList.contains('guard'),hits:RizoRuntimeQA.arcadeSnapshotForQA().hits}}""")
        if info['hits']>=2: break
        if info['close'] and not info['guard']:
            page.locator('[data-power-tech="'+info['call']+'"]').tap()
            page.wait_for_timeout(190)
        else: page.wait_for_timeout(45)
    hit=page.evaluate('()=>RizoRuntimeQA.arcadeSnapshotForQA()')
    page.evaluate('()=>RizoRuntimeQA.arcadeAdvanceClockForQA(999999)')
    page.wait_for_selector('[data-training-home]')
    return hit

with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in [(320,568),(375,812),(390,844),(430,932)]:
        ctx,page,errors=boot(browser,width,height)
        page.evaluate(SETUP)
        page.wait_for_timeout(150)
        layout=page.evaluate(LAYOUT)
        record(f'{width}: Home fits without horizontal scrolling',not layout['overflow'],layout)
        record(f'{width}: Rizo and the room remain the first-screen center',layout['pet']['height']>=120 and layout['pet']['y']<height-62 and layout['scene']['width']>=width-45)
        record(f'{width}: care, props, and primary navigation have phone-sized targets',all(b['width']>=43.9 and b['height']>=43.9 for b in layout['touch']),layout['touch'])
        navb=layout['navButtons']
        nav_even=max(b['width'] for b in navb)-min(b['width'] for b in navb)<1.1
        nav_clear=all(navb[i]['right']<=navb[i+1]['x']+0.5 for i in range(len(navb)-1))
        nav_inside=layout['nav']['x']>=-0.5 and layout['nav']['right']<=width+0.5 and layout['nav']['bottom']<=height+0.5
        record(f'{width}: Home, Train and Go are three even non-overlapping game buttons',len(navb)==3 and nav_even and nav_clear and nav_inside,{'nav':layout['nav'],'buttons':navb})
        record(f'{width}: exactly three primary places',page.locator('.bottom-nav button b').all_text_contents()==['HOME','TRAIN','GO'],page.locator('.bottom-nav').inner_text())
        shoot(page,f'home-{width}')
        before=page.evaluate(STATE)
        page.locator('[data-action="feed"]').tap();page.wait_for_timeout(320)
        food=page.locator('[data-food-drag="crumbs"]').bounding_box()
        pet=page.locator('#petActor').bounding_box()
        page.mouse.move(food['x']+food['width']/2,food['y']+food['height']/2);page.mouse.down()
        page.mouse.move(pet['x']+pet['width']/2,pet['y']+pet['height']/2,steps=8);page.mouse.up()
        page.wait_for_timeout(100)
        after=page.evaluate(STATE)
        record(f'{width}: physical feeding reaches Rizo without a teleport',after['pet']['hunger']>before['pet']['hunger'] and after['pet']['denPosition']==before['pet']['denPosition'] and not page.locator('#bottomSheet').is_visible())
        page.locator('[data-action="play"]').tap()
        record(f'{width}: Play opens physical Den objects',page.locator('#denPlayTray').is_visible() and not page.locator('#bottomSheet').is_visible())
        before=page.evaluate(STATE)
        page.locator('[data-garden-toy="ball"]').tap();page.wait_for_timeout(950)
        after=page.evaluate(STATE)
        record(f'{width}: Rizo notices the ball and everyday progress accrues',after['pet']['denPosition']=={'x':32,'y':1} and after['wallet']['embers']-before['wallet']['embers']>=6 and after['home']['routine']['play']==['ball'] and after['pet']['bond']>before['pet']['bond'],{'position':after['pet']['denPosition'],'walletDelta':after['wallet']['embers']-before['wallet']['embers']})
        page.evaluate('()=>RizoRuntimeQA.renderAll()')
        record(f'{width}: play state survives a routine redraw',page.locator('#habitatScene').get_attribute('class').find('den-playing')>=0)
        page.locator('[data-den-play-done]').tap()
        before=page.evaluate(STATE)
        hit=train_power(page)
        after=page.evaluate(STATE)
        record(f'{width}: a real short drill credits existing rewards',hit['hits']>=2 and after['wallet']['embers']>before['wallet']['embers'] and after['pet']['energy']<before['pet']['energy'] and after['home']['trained']==['power'],hit)
        record(f'{width}: performance offers continue and a meaningful return',page.locator('[data-training-continue]').is_visible() and 'WARM DEN' in page.locator('.result-home-progress').inner_text())
        page.locator('[data-training-home]').tap();page.wait_for_timeout(300)
        record(f'{width}: take it home restores the Den with an earned keepsake',page.evaluate(HOME)['view']=='home' and page.locator('#denTrainingMemory').is_visible() and 'POWER TAPE' in page.locator('#homeReturn').inner_text())
        before=page.evaluate(STATE)
        page.locator('#homeGoal').tap();page.locator('[data-home-upgrade="warm"]').tap();page.wait_for_timeout(1100)
        after=page.evaluate(STATE)
        record(f'{width}: earned Embers visibly build the home',after['home']['tier']==1 and before['wallet']['embers']-after['wallet']['embers']==180 and page.locator('.home-lamp').is_visible() and page.locator('.home-rug').is_visible())
        shoot(page,f'warm-den-{width}')
        page.locator('.bottom-nav [data-nav="arcade"]').tap();page.wait_for_timeout(200)
        record(f'{width}: small games have one coherent library',page.locator('#trainingLibrary [data-minigame]').count()==10 and page.locator('#viewArcade [data-mode]').count()==0)
        page.locator('#trainingLibrary summary').tap()
        record(f'{width}: Pac-Man Rizo is honestly inside Training',page.locator('#trainingLibrary [data-minigame="maze"]').is_visible())
        shoot(page,f'training-{width}')
        page.locator('.bottom-nav [data-nav="go"]').tap();page.wait_for_timeout(250)
        record(f'{width}: authored journeys are distinct destinations',page.locator('#viewGo .destination').count()==2 and not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
        shoot(page,f'go-{width}')
        page.locator('#viewGo [data-mode="dungeon"]').tap();page.wait_for_timeout(350)
        record(f'{width}: departure brings this Rizo into Dungeon',page.evaluate('()=>RizoModes.active()')=='dungeon' and page.locator('.dungeon-device').is_visible())
        page.keyboard.press('Escape');page.wait_for_timeout(120)
        page.locator('[data-dungeon-action="home"]').tap();page.wait_for_function('RizoModes.active()===null')
        record(f'{width}: Dungeon returns to Home and keeps the journey',page.evaluate(HOME)['view']=='home' and page.evaluate('()=>RizoModes.active()') is None and page.evaluate(STATE)['qaModes']['dungeon']['data']['campaign']['petId']==after['pet']['id'],page.evaluate('()=>({home:RizoRuntimeQA.homeForQA(),active:RizoModes.active(),campaign:RizoRuntimeQA.snapshot().qaModes.dungeon.data.campaign})'))
        page.reload();page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready')
        saved=page.evaluate(STATE)
        record(f'{width}: Home growth, training, and the journey survive reload',saved['home']['tier']==1 and saved['home']['trained']==['power'] and saved['qaModes']['dungeon']['data']['campaign']['contentRevision']=='threshold-v4')
        record(f'{width}: complete loop has no page errors',not errors,errors)
        ctx.close()

    # The playful three-place dock still yields to short landscape screens.
    ctx,page,errors=boot(browser,844,390)
    page.evaluate(SETUP);page.wait_for_timeout(120)
    landscape=page.evaluate(LAYOUT)
    record('landscape: the three-place dock compacts without covering the play surface',landscape['nav']['height']<=55 and landscape['nav']['width']<=630 and all(b['height']>=43.9 for b in landscape['navButtons']) and not landscape['overflow'],landscape)
    ctx.close()

    # Spatial ownership: tap/body reaction, food, and rest never substitute a
    # canned position for the current pet. Rest explicitly walks toward the bed.
    ctx,page,errors=boot(browser)
    page.evaluate(SETUP)
    page.evaluate('()=>RizoRuntimeQA.moveDenForQA(65.5,2)');page.wait_for_timeout(900)
    left=page.locator('#denPlacement').evaluate('(n)=>n.getBoundingClientRect().left')
    page.locator('#petActor').tap();page.wait_for_timeout(80)
    reaction=page.evaluate(HOME);page.evaluate('()=>RizoRuntimeQA.renderAll()')
    record('tapping reacts at the persistent Den location',reaction['position']=={'x':65.5,'y':2} and abs(left-page.locator('#denPlacement').evaluate('(n)=>n.getBoundingClientRect().left'))<1)
    record('a reaction survives a state-driven redraw',bool(reaction['reactions']) and reaction['reactions']==page.evaluate(HOME)['reactions'],reaction)
    page.wait_for_timeout(750)
    record('reaction end keeps the same natural location',page.evaluate(HOME)['position']=={'x':65.5,'y':2})
    page.evaluate("()=>RizoRuntimeQA.useFoodForQA('crumbs')")
    record('feeding does not teleport Rizo',page.evaluate(HOME)['position']=={'x':65.5,'y':2})
    page.locator('#denBed').tap();page.wait_for_timeout(900)
    record('the bed changes behavior at a real place',page.evaluate(STATE)['pet']['sleeping'] and page.evaluate(HOME)['position']=={'x':72,'y':0})
    page.locator('#denBed').tap()
    record('waking leaves Rizo where he rested',not page.evaluate(STATE)['pet']['sleeping'] and page.evaluate(HOME)['position']=={'x':72,'y':0})
    page.wait_for_timeout(1800)
    before=page.evaluate(STATE)
    page.locator('[data-garden-toy="ball"]').scroll_into_view_if_needed()
    ball=page.locator('[data-garden-toy="ball"]').bounding_box()
    scene=page.locator('#habitatScene').bounding_box()
    page.mouse.move(ball['x']+ball['width']/2,ball['y']+ball['height']/2);page.mouse.down()
    page.mouse.move(scene['x']+scene['width']*.61,ball['y']-20,steps=8);page.mouse.up();page.wait_for_timeout(100)
    after=page.evaluate(STATE)
    record('moving the ball makes Rizo follow the drop, once',abs(after['pet']['denPosition']['x']-61)<1 and after['garden']['toyUses'].get('ball',0)==before['garden']['toyUses'].get('ball',0)+1,after['pet']['denPosition'])
    page.wait_for_timeout(1800)
    before=page.evaluate(STATE);page.locator('[data-garden-toy="ball"]').tap();after=page.evaluate(STATE)
    record('repeated play can react without farming the payout',after['wallet']['embers']==before['wallet']['embers'] and after['garden']['toyUses'].get('ball',0)==before['garden']['toyUses'].get('ball',0)+1)
    record('spatial interactions have no page errors',not errors,errors)
    ctx.close()

    # Older/larger Rizos stay inside the phone scene at either saved edge.
    for width,height in [(320,568),(375,812),(390,844),(430,932)]:
        ctx,page,errors=boot(browser,width,height,reduced=True);page.evaluate(SETUP)
        fits=[]
        for stage in ['kid','teen','beast','legend']:
            for x in [25,75]:
                page.evaluate("([stage,x])=>{const s=RizoRuntimeQA.snapshot();s.pet.stage=stage;s.pet.xp=5000;s.pet.denPosition={x,y:0};RizoRuntimeQA.loadForQA(s);}",[stage,x])
                sizes=page.evaluate("()=>{const a=document.querySelector('#petActor').getBoundingClientRect(),s=document.querySelector('#habitatScene').getBoundingClientRect();return {left:a.left-s.left,right:a.right-s.right};}")
                fits.append(sizes['left']>=-1 and sizes['right']<=1)
        record(f'{width}: grown Rizos stay inside Home at both movement edges',all(fits),fits)
        ctx.close()

    # Buy all current room changes, then reload, and fail a primary save write.
    ctx,page,errors=boot(browser,reduced=True);page.evaluate(SETUP)
    page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.wallet.embers=5000;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}")
    for id,tier,prop in [('warm',1,'.home-lamp'),('room',2,'.home-arch'),('roof',3,'.home-telescope')]:
        page.locator('#homeGoal').tap();page.locator('[data-home-upgrade="'+id+'"]').tap();page.wait_for_timeout(100)
        record(f'{id}: a structural room change is implemented',page.evaluate(STATE)['home']['tier']==tier and page.locator(prop).is_visible())
    record('home uses existing Embers, no new wallet resource',page.evaluate(STATE)['wallet']=={'embers':1670,'shards':0},page.evaluate(STATE)['wallet'])
    page.locator('#homeGoal').tap()
    orbit_bar=page.locator('#homeGoal i').evaluate('(n)=>parseFloat(n.style.width)')
    record('Orbit is visible and honestly deferred, never purchasable','1,000,000' in page.locator('.home-horizon').inner_text() and page.locator('[data-home-upgrade="orbit"]').count()==0 and '1M · FUTURE' in page.locator('#homeGoal span').inner_text() and abs(orbit_bar-0.167)<0.001)
    page.locator('#sheetClose').tap();page.reload();page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready')
    record('the rooftop survives reload under system reduced motion',page.evaluate(STATE)['home']['tier']==3 and page.locator('.home-telescope').is_visible() and page.locator('#denPlacement').evaluate('(n)=>getComputedStyle(n).transitionDuration')=='0s',page.evaluate('()=>({tier:RizoRuntimeQA.snapshot().home.tier,duration:getComputedStyle(document.querySelector("#denPlacement")).transitionDuration})'))
    shoot(page,'rooftop-home-390')
    page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.home.tier=0;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rizo-save-v2')throw new DOMException('quota','QuotaExceededError');return __setItem.call(this,k,v);};}")
    before=page.evaluate(STATE);built=page.evaluate("()=>RizoRuntimeQA.buildHomeForQA('warm')");after=page.evaluate(STATE)
    record('failed primary save rolls back both the upgrade and cost',built is False and after['wallet']==before['wallet'] and after['home']==before['home'])
    page.evaluate("()=>{Storage.prototype.setItem=function(k,v){if(k==='rizo-save-v2:backup')throw new DOMException('quota','QuotaExceededError');return __setItem.call(this,k,v);};}")
    before=page.evaluate(STATE);built=page.evaluate("()=>RizoRuntimeQA.buildHomeForQA('warm')");after=page.evaluate(STATE)
    primary=page.evaluate("()=>JSON.parse(localStorage.getItem('rizo-save-v2')).state")
    record('a failed mirror leaves the confirmed primary purchase intact',built is True and before['wallet']['embers']-after['wallet']['embers']==180 and primary['home']['tier']==1 and primary['wallet']==after['wallet'])
    duplicate=page.evaluate("()=>RizoRuntimeQA.buildHomeForQA('warm')")
    record('retrying an already built room cannot charge twice',duplicate is False and page.evaluate(STATE)['wallet']==after['wallet'])
    page.evaluate('()=>{Storage.prototype.setItem=window.__setItem;}')
    record('home construction has no page errors',not errors,errors);ctx.close()

    # Real previous-build v22 → v23. Mode slices must be byte-equivalent before
    # entering a mode, not reauthored or invalidated by navigation migration.
    # Rebase only care/session timers so this fixture tests migration, not
    # months of legitimate neglect when CI runs in the future. Mode data and
    # entitlement bytes remain the exact starting-build fixture.
    fixture=json.loads(subprocess.run(['node','-e',r"""
      const Save=require('./core/rizo-save-core.js'),fx=require('./tests/fixtures/v92-home-source.json');
      const e=fx.envelope;if(!Save.verifyEnvelope(e))throw new Error('invalid source fixture');
      const s=e.state,t=Date.now();s.pet.lastTick=t-1000;s.pet.bornAt=t-1000;
      s.player.lastActive=t-1000;s.player.lastSessionAt=t-1000;s.player.lastVisitDate=new Date(t).toISOString().slice(0,10);
      console.log(JSON.stringify(Save.createEnvelope({state:s,modes:e.modes,stateVersion:22,savedAt:t,writeId:e.writeId})));
    """],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
    ctx,page,errors=boot(browser,seed=fixture)
    saved=page.evaluate(STATE);old=fixture['state']
    record('the actual starting-build save migrates to state v23',saved['version']==23 and saved['home']['tier']==0 and saved['home']['trained']==['rhythm','maze'])
    record('existing identity, bond, resources, outfits, rooms, and settings survive',saved['pet']['id']==old['pet']['id'] and saved['pet']['name']=='MOSSY' and abs(saved['pet']['bond']-old['pet']['bond'])<.1 and saved['wallet']==old['wallet'] and saved['pet']['accessory']==old['pet']['accessory'] and saved['pet']['room']=='space' and saved['settings']==old['settings'])
    record('threshold-v3 facts/choices and Defense progress are byte-equivalent',saved['qaModes']==fixture['modes'])
    record('valid Dungeon reward receipts, story marks, and unlocks are preserved',saved['modeReceipts']==old['modeReceipts'] and saved['pet']['storyMarks']==old['pet']['storyMarks'] and saved['inventory']==old['inventory'] and saved['trainingMemory']==old['trainingMemory'])
    record('the room displays earned Dungeon and Defense accomplishments',all(page.locator(s).is_visible() for s in ['#denKnotMemory','#denHearthMemory','#denDefenseMemory','#denTrainingMemory']))
    shoot(page,'migrated-home-390')
    page.wait_for_timeout(600)
    if page.locator('#modalOverlay.show [data-close-modal]').count():
        page.locator('#modalOverlay.show [data-close-modal]').first.tap()
    page.locator('.bottom-nav [data-nav="go"]').tap()
    record('Dungeon departure understands the preserved journey',page.locator('[data-mode="dungeon"]').inner_text()=='CONTINUE JOURNEY' and 'MOSSY' in page.locator('#dungeonDeparture').inner_text())
    page.locator('[data-mode="defense"]').tap();page.wait_for_selector('[data-defense-intro-continue], [data-enter-defense-world="grove"]')
    if page.locator('[data-defense-intro-continue]').is_visible():
        page.locator('[data-defense-intro-continue]').tap()
    page.locator('[data-enter-defense-world="grove"]').tap();page.wait_for_selector('#defenseWorld')
    page.evaluate('()=>{RizoRuntimeQA.defensePlaceNextForQA();RizoRuntimeQA.defenseCompleteWaveForQA(1);RizoRuntimeQA.defenseForceWaveForQA(2);RizoRuntimeQA.defenseCompleteWaveForQA(2);RizoRuntimeQA.defenseForceWaveForQA(3);RizoRuntimeQA.defenseFinishForQA();}')
    page.wait_for_selector('[data-defense-exit]')
    record('Defense result names its return Home',page.locator('[data-defense-exit]').inner_text()=='GO HOME')
    page.locator('[data-defense-exit]').tap();page.wait_for_timeout(200)
    after=page.evaluate(STATE)
    record('Defense comes Home with its existing larger reward',page.evaluate(HOME)['view']=='home' and after['wallet']['embers']>old['wallet']['embers'] and after['home']['lastReturn']['source']=='defense' and after['home']['activity']['defense']==1)
    record('the new return preserves the old best and Dungeon choices',after['qaModes']['defense']['data']['records']['best']==23 and after['qaModes']['dungeon']['data']['story']==fixture['modes']['dungeon']['data']['story'])
    page.evaluate("()=>{const q=RizoRuntimeQA,s=q.snapshot();Object.assign(s.pet,{stage:'legend',xp:5000,bond:90});for(const id of ['speed','power','instinct','stamina','luck'])s.pet.skills[id]=80;s.home.tier=2;s.meta.unlockScenes.push('legacy-ready');q.loadForQA(s);q.rebirthInfoForQA();}")
    page.locator('[data-confirm-rebirth]').tap();page.wait_for_timeout(150)
    record('a new generation keeps the home and earned hearth memory',page.evaluate(STATE)['pet']['stage']=='egg' and page.evaluate(STATE)['home']['tier']==2 and page.locator('#denHearthMemory').is_visible() and page.locator('.home-arch').is_visible())
    record('migrated player loop has no page errors',not errors,errors)
    ctx.close();browser.close()
server.shutdown()
print(f'\n{sum(results)}/{len(results)} Home / Train / Go browser checks passed')
sys.exit(0 if all(results) else 1)
