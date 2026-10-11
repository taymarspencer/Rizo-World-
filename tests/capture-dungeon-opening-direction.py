"""Capture and verify the real opening at 320/390/430 phone viewports.

Uses the production build and existing QA scene clock; never substitutes
standalone art for the game. Chromium evidence, not physical-device QA.
"""
import argparse, functools, http.server, json, re, socketserver, subprocess, sys, threading, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
V2, V2_BACKUP = "rizo-save-v2", "rizo-save-v2:backup"

parser = argparse.ArgumentParser()
parser.add_argument('--directory')
parser.add_argument('--evidence', default='/tmp/rizo-opening-direction')
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
    ctx = browser.new_context(service_workers="block", viewport={"width": viewport[0], "height": viewport[1]}, has_touch=True, is_mobile=True)
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
    viewport = page.viewport_size
    page.set_viewport_size({"width": viewport["width"] + 1, "height": viewport["height"]})
    page.set_viewport_size(viewport)
    page.wait_for_timeout(100)
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

    def jump(page, ms):
        page.evaluate(f"RizoRuntimeQA.dungeonSceneTimeForQA({ms})")
    out=Path(args.evidence);out.mkdir(parents=True,exist_ok=True)
    for width in [320,390,430]:
        ctx,page,errors=boot(browser,seed={},viewport=(width,{320:568,390:844,430:932}[width]))
        page.evaluate(SETUP);launch(page)
        # Instrument the REAL game canvas, not Character Lab or a mock
        # renderer: require the production opening to blit the authored PNG.
        page.evaluate("""() => {
          window.__keeperGameplay = { frames: [], count: 0 };
          const proto = CanvasRenderingContext2D.prototype;
          const old = proto.drawImage;
          proto.drawImage = function(src,...args) {
            if (String(src?.src || '').includes('keeper-sprite-atlas.png') &&
                this.canvas?.classList?.contains('dungeon-canvas')) {
              window.__keeperGameplay.count++;
              const frame = Math.round((args[0] || 0) / 120) +
                  4 * Math.floor((args[1] || 0) / 180);
              window.__keeperGameplay.frames.push(frame);
            }
            return old.call(this,src,...args);
          };
        }""")
        captured=set(); checkout=[]; trace=[]
        for i in range(1000):
            st=page.evaluate(ST);room=st.get('opening',{});npcs=st.get('npcs',[])
            you=room.get('you',{})
            if you.get('counter'):checkout.append((you['x'],you.get('walking',False),you.get('wave',False)))
            name=None
            keeper=next((n for n in npcs if n['id']=='keeper' and n['visible']),None)
            if keeper and 135<keeper['y']<190 and 'walk' not in captured:name='walk'
            elif keeper and keeper['y']<110 and 'door' not in captured:name='door'
            elif room.get('you',{}).get('visible') and st.get('scene',{}).get('id')=='opening:waiting' and 'window' not in captured:name='window'
            elif room.get('hands') and not room.get('grabbed') and 'reach' not in captured:name='reach'
            elif st.get('comic') and 'comic' not in captured:name='comic'
            elif room.get('grabbed') and st.get('comic') is None and not page.locator('.dungeon-comic').count() and 'grip' not in captured:name='grip'
            if name:
                # Let the comic's entrance animation settle before inspection.
                page.wait_for_timeout(350 if name=='comic' else 30);page.screenshot(path=str(out/f'{name}-{width}.png'));captured.add(name);trace.append({'scene':name,'state':st});print(width,name,flush=True)
            if len(captured)==6:break
            if st.get('dialogue'):page.keyboard.press('z')
            if st.get('scene',{}).get('waiting')=='comic':page.keyboard.press('z')
            jump(page,200);page.wait_for_timeout(20)
        trace_blits = page.evaluate("window.__keeperGameplay")
        check(f'{width}: production opening actually draws the new YOU sprite, not old Canvas polygons',
              trace_blits['count'] > 10 and any(0 <= f < 4 for f in trace_blits['frames'])
              and 6 in trace_blits['frames'],
              str(trace_blits['frames'][:45]))
        check(f'{width}: all six opening scenes captured', captured=={'walk','door','window','reach','comic','grip'},str(captured))
        check(f'{width}: shopping ends at a steady checkout, without walking or repeated waves',len(checkout)>2 and len({x for x,_,_ in checkout})==1 and all(not walking and not wave for _,walking,wave in checkout),str(checkout[:3]))
        check(f'{width}: opening has no page errors',not errors,str(errors))
        check(f'{width}: phone has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        (out/f'trace-{width}.json').write_text(json.dumps(trace,indent=2))
        ctx.close()
    browser.close()
server.shutdown()

print(f"{sum(results)}/{len(results)} opening direction checks passed")
sys.exit(0 if all(results) else 1)
