"""The Den as a place: tiers, light, physical play, ceremonies and returns.

Covers the presentation contracts of the "alive" pass on phone viewports:
each home tier has its own architecture and light, lighting never sits on
Rizo, toys sit where Rizo actually goes, he sleeps in the bed (and the bed
can still wake him), taps answer where you touch him, a build ceremony
survives redraws, coming home plays an arrival, Training carries the home
patch, Go leaves through a doorway, and none of it is saved state.
"""
import argparse, functools, http.server, json, sys, threading
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
    print(('PASS' if passed else 'FAIL'), name, str(detail)[:600] if not passed else '', flush=True)

SETUP = """()=>{const q=RizoRuntimeQA,s=q.defaultState();s.introSeen=true;
 s.player.tutorialDismissed=true;s.player.tutorialStep=5;s.player.keeperGuideSeen=true;
 s.settings.sound=false;s.settings.music=false;s.meta.totalHatched=1;
 s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];s.wallet.embers=176;
 s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
 Object.assign(s.pet,{name:'RIZO',stage:'kid',variant:'classic',hiddenVariant:'classic',xp:50,bond:10,hunger:95,energy:95,hygiene:80,mood:80});
 s.collection.classic=1;q.loadForQA(s);q.saveForQA();return true;}"""
STATE = '()=>RizoRuntimeQA.snapshot()'
TIER = "(t)=>{const s=RizoRuntimeQA.snapshot();s.home.tier=t;RizoRuntimeQA.loadForQA(s);}"
VISIBLE = """(sel)=>{const n=document.querySelector(sel);if(!n)return false;const r=n.getBoundingClientRect(),c=getComputedStyle(n);
 return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';}"""
BOX = "(sel)=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};}"

def boot(browser, width=390, height=844, reduced=False):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True, service_workers='block', reduced_motion='reduce' if reduced else 'no-preference')
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready')
    page.evaluate(SETUP); page.wait_for_timeout(250)
    return ctx, page, errors

def shoot(page, name):
    if args.evidence: page.locator('#habitatCard').screenshot(path=str(args.evidence / (name + '.png')))

def train_power(page):
    page.locator('.bottom-nav [data-nav="arcade"]').tap()
    page.locator('#trainingFeatured [data-minigame="power"]').tap()
    page.wait_for_selector('#timingNeedle')
    for _ in range(100):
        info = page.evaluate("""()=>{const n=document.querySelector('#timingNeedle').getBoundingClientRect(),z=document.querySelector('#timingPerfectZone').getBoundingClientRect();return {close:Math.abs(n.x-z.x)<18,call:document.querySelector('#powerCall').textContent.toLowerCase(),guard:document.querySelector('#trainingBag').classList.contains('guard'),hits:RizoRuntimeQA.arcadeSnapshotForQA().hits}}""")
        if info['hits'] >= 2: break
        if info['close'] and not info['guard']:
            page.locator('[data-power-tech="' + info['call'] + '"]').tap(); page.wait_for_timeout(190)
        else: page.wait_for_timeout(45)
    page.evaluate('()=>RizoRuntimeQA.arcadeAdvanceClockForQA(999999)')
    page.wait_for_selector('[data-training-home]')

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ===== Every tier is its own place, and the light never sits on Rizo =====
    ctx, page, errors = boot(browser)
    signature = {
        0: ['.den-roofline', '.den-crate', '.den-drip', '.den-wall'],
        1: ['.den-frame', '.den-curtains', '.home-lamp', '.home-rug', '.den-wall'],
        2: ['.home-arch', '.den-pendant', '.den-curtains', '.home-books'],
        3: ['.den-sky', '.den-skyline', '.den-parapet', '.den-door', '.home-telescope', '.home-stringlights'],
    }
    shades = []
    for tier, parts in signature.items():
        page.evaluate(TIER, tier); page.wait_for_timeout(200)
        missing = [sel for sel in parts if not page.evaluate(VISIBLE, '#habitatScene ' + sel)]
        record(f'tier {tier}: its own architecture is in the room', not missing, missing)
        shades.append(page.evaluate("getComputedStyle(document.querySelector('.den-shade')).backgroundImage"))
        shoot(page, f'alive-tier{tier}')
    record('each tier has its own light', len(set(shades)) == 4)
    page.evaluate(TIER, 3); page.wait_for_timeout(150)
    record('the rooftop is outside: no indoor window', not page.evaluate(VISIBLE, '#habitatScene .habitat-window'))
    z = page.evaluate("""()=>({shade:+getComputedStyle(document.querySelector('.den-shade')).zIndex,glow:+getComputedStyle(document.querySelector('.den-glow')).zIndex,
      rizo:+getComputedStyle(document.querySelector('#denPlacement')).zIndex,wrap:getComputedStyle(document.querySelector('.den-light')).zIndex})""")
    record('room light is below Rizo and blends with the room (no isolating wrapper)', z['shade'] < z['rizo'] and z['glow'] < z['rizo'] and z['wrap'] == 'auto', z)
    record('the tier is named on the room', 'ROOFTOP HOME' in page.evaluate("getComputedStyle(document.querySelector('#habitatCard'),'::before').content"))
    page.evaluate(TIER, 0); page.wait_for_timeout(150)

    # ===== Touch: where you touch him matters; a quick run stays snappy =====
    page.wait_for_timeout(600)
    sprite = page.evaluate(BOX, '#petSprite')
    page.touchscreen.tap(sprite['x'] + sprite['w'] * .5, sprite['y'] + sprite['h'] * .72); page.wait_for_timeout(60)
    first = page.evaluate("document.querySelector('#petActor').className")
    page.wait_for_timeout(700)
    page.touchscreen.tap(sprite['x'] + sprite['w'] * .5, sprite['y'] + sprite['h'] * .18); page.wait_for_timeout(60)
    head = page.evaluate("document.querySelector('#petActor').className")
    page.wait_for_timeout(700)
    page.touchscreen.tap(sprite['x'] + sprite['w'] * .5, sprite['y'] + sprite['h'] * .72); page.wait_for_timeout(60)
    belly = page.evaluate("document.querySelector('#petActor').className")
    record('a first touch after a while is noticed', 'tap-notice' in first, first)
    record('a pat on the head and a poke in the belly are different', 'tap-head' in head and 'tap-belly' in belly, (head, belly))
    for _ in range(5):
        page.touchscreen.tap(sprite['x'] + sprite['w'] * .5, sprite['y'] + sprite['h'] * .72); page.wait_for_timeout(70)
    record('a quick run of taps stays snappy', 'boing' in page.evaluate("document.querySelector('#petActor').className"))
    page.wait_for_timeout(1500)

    # ===== Toys sit where Rizo goes; the play prompt never covers his speech =====
    page.locator('[data-action="play"]').tap(); page.wait_for_timeout(250)
    tray, scene = page.evaluate(BOX, '#denPlayTray'), page.evaluate(BOX, '#habitatScene')
    record('the play prompt sits under the room, not over it', tray['y'] >= scene['y'] + scene['h'] - 1, (tray, scene))
    reach = {}
    for toy in ['ball', 'puddle', 'bush', 'stump']:
        page.locator(f'[data-garden-toy="{toy}"]').tap(); page.wait_for_timeout(1150)
        pet, obj = page.evaluate(BOX, '#petSprite'), page.evaluate(BOX, f'[data-garden-toy="{toy}"]')
        gap = abs(pet['cx'] - obj['cx']) - (pet['w'] / 2 + obj['w'] / 2)
        reach[toy] = round(gap, 1)
        if toy == 'ball':
            bubble, prompt = page.evaluate(BOX, '#thoughtBubble'), page.evaluate(BOX, '#denPlayTray')
            apart = bubble['y'] + bubble['h'] <= prompt['y'] or prompt['y'] + prompt['h'] <= bubble['y']
            record('his line is readable while playing (the prompt never covers it)', page.locator('#thoughtBubble.show').count() == 1 and apart, (bubble, prompt))
        page.wait_for_timeout(1300)
    record('every toy is within reach of where Rizo stands for it', all(gap < 14 for gap in reach.values()), reach)
    page.locator('[data-den-play-done]').tap(); page.wait_for_timeout(200)

    # ===== Bed: he sleeps in it, and it still wakes him =====
    page.locator('#denBed').tap(); page.wait_for_timeout(1000)
    bed, pet = page.evaluate(BOX, '#denBed'), page.evaluate(BOX, '#petSprite')
    record('Rizo sleeps in the bed, tucked in', page.evaluate(STATE)['pet']['sleeping'] and bed['x'] < pet['cx'] < bed['x'] + bed['w'] and page.evaluate(VISIBLE, '.den-blanket'), (bed, pet))
    top = page.evaluate("([x,y])=>document.elementFromPoint(x,y)?.id||''", [bed['cx'], bed['cy']])
    record('the bed stays tappable with him in it', top == 'denBed', top)
    shoot(page, 'alive-asleep')
    page.locator('#denBed').tap(); page.wait_for_timeout(300)
    record('the bed wakes him', not page.evaluate(STATE)['pet']['sleeping'] and not page.evaluate(VISIBLE, '.den-blanket'))
    record('den interactions raise no page errors', not errors, errors)
    ctx.close()

    # ===== Building: plans show the room, the ceremony survives redraws =====
    ctx, page, errors = boot(browser)
    page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.wallet.embers=900;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"); page.wait_for_timeout(200)
    record('a reachable room says so on Home', 'READY TO BUILD' in page.locator('#homeGoal .home-goal-need').inner_text())
    page.locator('#homeGoal').tap(); page.wait_for_timeout(300)
    order = page.evaluate("""()=>{const s=document.querySelector('#bottomSheet');const b=s.querySelector('[data-home-upgrade]'),t=s.querySelector('.home-plan-tiers');
      return {now:s.querySelector('.plan-room[data-tier="0"]')!==null,next:s.querySelector('.plan-room[data-tier="1"]')!==null,changes:s.querySelectorAll('.plan-changes li').length,
      buttonFirst:Boolean(b&&t&&(b.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING))}}""")
    record('plans show the room now and next, what changes, and build beside them', order['now'] and order['next'] and order['changes'] >= 3 and order['buttonFirst'], order)
    page.locator('[data-home-upgrade="warm"]').tap(); page.wait_for_timeout(250)
    page.evaluate('()=>RizoRuntimeQA.renderAll()'); page.wait_for_timeout(50)
    built = page.evaluate("()=>({cls:document.querySelector('#habitatScene').classList.contains('home-built'),banner:document.querySelector('.den-build-banner')?.textContent||''})")
    record('the build ceremony survives a redraw and names the room', built['cls'] and 'WARM DEN' in built['banner'], built)
    page.wait_for_timeout(2900)
    record('the ceremony cleans up after itself', page.locator('.den-build-banner, .den-build-veil').count() == 0 and 'home-built' not in page.locator('#habitatScene').get_attribute('class'))
    page.reload(); page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready'); page.wait_for_timeout(200)
    record('the room persists; the ceremony is not saved', page.evaluate(STATE)['home']['tier'] == 1 and 'home-built' not in page.locator('#habitatScene').get_attribute('class'))
    record('building raises no page errors', not errors, errors)
    ctx.close()

    # ===== Training carries the home patch; coming home plays an arrival =====
    ctx, page, errors = boot(browser)
    page.locator('.bottom-nav [data-nav="arcade"]').tap(); page.wait_for_timeout(200)
    record('the featured drill lives in the yard with Rizo', page.locator('#trainingFeatured .training-yard').count() == 1 and page.locator('#trainingFeatured .training-rizo').count() == 1)
    record('every drill on the board wears its patch colour', page.evaluate("[...document.querySelectorAll('#trainingLibrary .game-card')].every(c=>c.style.getPropertyValue('--patch'))"))
    train_power(page); page.wait_for_timeout(300)
    record('a first drill result shows its new patch and the next room', 'NEW PATCH' in page.locator('.result-patch').inner_text() and page.locator('.result-home-meter').count() == 1 and page.locator('.result-rizo').count() == 1)
    page.locator('[data-training-home]').tap(); page.wait_for_timeout(260)
    arrive = page.evaluate("()=>({actor:document.querySelector('#petActor').className,patch:document.querySelector('#denTrainingMemory').className,cells:document.querySelectorAll('#denTrainingMemory b:not(.empty)').length})")
    page.wait_for_timeout(500)
    record('coming home plays a short arrival', 'den-arrive' in arrive['actor'] and page.locator('#thoughtBubble.show').count() == 1, arrive)
    record('the new patch is stitched onto the board at home', 'is-new' in arrive['patch'] and arrive['cells'] == 1, arrive)
    record('the drill board marks what we have tried', 'drill-done' in page.evaluate("document.querySelector('#trainingLibrary [data-minigame=\"power\"]').closest('.game-card').className"))
    page.reload(); page.wait_for_function('window.RizoRuntimeQA && RizoBoot.status().ready'); page.wait_for_timeout(300)
    record('a reload does not replay the arrival', 'den-arrive' not in page.evaluate("document.querySelector('#petActor').className") and page.evaluate(STATE)['home']['trained'] == ['power'])

    # ===== Go leaves through a doorway, and comes back through one =====
    page.locator('.bottom-nav [data-nav="go"]').tap(); page.wait_for_timeout(250)
    record('Rizo stands at each way out', page.locator('#viewGo .destination-companion .go-rizo').count() == 2)
    page.locator('#viewGo [data-mode="dungeon"]').tap(); page.wait_for_timeout(120)
    doorway = page.locator('.go-doorway.leave').count()
    page.wait_for_timeout(230)
    record('leaving home is a doorway, and the journey is already open under it', doorway == 1 and page.evaluate('()=>RizoModes.active()') == 'dungeon')
    page.wait_for_timeout(1000)
    record('the doorway clears itself', page.locator('.go-doorway').count() == 0)
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    page.locator('[data-dungeon-action="home"]').tap(); page.wait_for_function('RizoModes.active()===null'); page.wait_for_timeout(60)
    record('coming back is a doorway home', page.locator('.go-doorway.return').count() == 1)
    page.wait_for_timeout(700)
    record('and Rizo arrives in the Den', 'den-arrive' in page.evaluate("document.querySelector('#petActor').className") or page.locator('#thoughtBubble.show').count() == 1)
    record('training and journeys raise no page errors', not errors, errors)
    ctx.close()

    # ===== Reduced motion: still a home, just a still one =====
    ctx, page, errors = boot(browser, reduced=True)
    page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.wallet.embers=900;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"); page.wait_for_timeout(150)
    still = page.evaluate("()=>['.den-drip b','.den-crate b'].map(s=>getComputedStyle(document.querySelector(s),s.endsWith('b')&&s.includes('crate')?'::after':null).animationName)")
    record('reduced motion: the leak and the candle hold still', all(name == 'none' for name in still), still)
    page.locator('#homeGoal').tap(); page.locator('[data-home-upgrade="warm"]').tap(); page.wait_for_timeout(120)
    record('reduced motion: building changes the room without the light show', page.evaluate(STATE)['home']['tier'] == 1 and page.locator('.den-build-veil:visible').count() == 0)
    page.locator('.bottom-nav [data-nav="go"]').tap(); page.wait_for_timeout(200)
    page.locator('#viewGo [data-mode="dungeon"]').tap(); page.wait_for_timeout(200)
    record('reduced motion: no doorway veil', page.locator('.go-doorway').count() == 0 and page.evaluate('()=>RizoModes.active()') == 'dungeon')
    record('reduced motion raises no page errors', not errors, errors)
    ctx.close()

    # ===== Phones: nothing overflows, targets stay thumb-sized =====
    for width, height in [(320, 568), (375, 812), (390, 844), (430, 932)]:
        ctx, page, errors = boot(browser, width, height)
        overflow = []
        for view in ['home', 'arcade', 'go']:
            page.locator(f'.bottom-nav [data-nav="{view}"]').tap(); page.wait_for_timeout(200)
            if page.evaluate('document.documentElement.scrollWidth>innerWidth+1'): overflow.append(view)
        page.locator('.bottom-nav [data-nav="home"]').tap(); page.wait_for_timeout(150)
        small = page.evaluate("""()=>[...document.querySelectorAll('#denBed,.garden-toy,.care-action,.bottom-nav button,#homeGoal')].filter(n=>n.getClientRects().length)
          .map(n=>({id:n.id||n.dataset.gardenToy||n.dataset.action||n.dataset.nav,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})).filter(b=>b.w<43.9||b.h<43.9)""")
        inside = page.evaluate("""()=>{const s=document.querySelector('#habitatScene').getBoundingClientRect();
          return ['#denBed','.toy-ball','.toy-stump','.toy-bush','.toy-puddle','.den-keepsakes'].every(q=>{const r=document.querySelector(q).getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1&&r.bottom<=s.bottom+1;});}""")
        record(f'{width}: Home, Train and Go fit without sideways scrolling', not overflow, overflow)
        record(f'{width}: bed, toys, care and navigation stay thumb-sized', not small, small)
        record(f'{width}: the bed, toys and keepsakes stay inside the room', inside)
        record(f'{width}: no page errors', not errors, errors)
        ctx.close()

    browser.close()
server.shutdown()
print(f'\n{sum(results)}/{len(results)} Home alive checks passed')
sys.exit(0 if all(results) else 1)
