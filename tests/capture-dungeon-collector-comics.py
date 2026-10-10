"""Full phone screenshots of both collector comics in a production build."""
import argparse, functools, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', type=Path, required=True)
parser.add_argument('--evidence', type=Path, required=True)
args = parser.parse_args()
args.evidence.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools'))
from static_site import StaticSiteHandler
server = socketserver.ThreadingTCPServer(('127.0.0.1', 0),
    functools.partial(StaticSiteHandler, directory=str(args.directory)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_address[1]}/play?qa=1'
ST = 'RizoRuntimeQA.dungeonStateForQA()'
flags = {k: True for k in ['latchFreed','porterDown','rowsCatch','rowsGrille','rowsOnward']}
beats = ['rows:arrived','rows:met','rows:meal','rows:screen','rows:boundary']
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width, height in [(320,568),(390,844)]:
        for name in ['window-comic','chute-comic']:
            ctx = browser.new_context(viewport={'width':width,'height':height},has_touch=True,
                is_mobile=True,device_scale_factor=2,service_workers='block',reduced_motion='reduce')
            page=ctx.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url);page.wait_for_function('!!window.RizoRuntimeQA')
            page.evaluate('''()=>{const s=RizoRuntimeQA.defaultState();
              Object.assign(s.pet,{name:'MOSSY',stage:'kid',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false});
              s.settings.reducedMotion=true;s.player.tutorialDismissed=true;s.player.tutorialStep=5;
              s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];RizoRuntimeQA.loadForQA(s);
              RizoRuntimeQA.saveForQA();RizoRuntimeQA.setViewForQA('go');}''')
            page.wait_for_timeout(200);page.locator('[data-mode="dungeon"]').click()
            page.wait_for_function('RizoRuntimeQA.dungeonStateForQA()?.sim');page.wait_for_timeout(1000)
            room='windowgate' if name=='window-comic' else 'longhall'
            page.evaluate('([r,f,b])=>RizoRuntimeQA.dungeonGotoForQA(r,null,f,b)',[room,flags,beats])
            page.wait_for_timeout(300)
            page.set_viewport_size({'width':width+1,'height':height});page.set_viewport_size({'width':width,'height':height})
            if name=='window-comic':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(206,86)');page.wait_for_timeout(100)
                page.keyboard.press('z');expected='window-opens';clock=2600
            else:
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(160,40)');expected='chute';clock=3650
            for _ in range(30):
                if page.evaluate(ST)['comic']==expected:break
                page.evaluate('RizoRuntimeQA.dungeonSceneTimeForQA(100)');page.wait_for_timeout(20)
            assert page.evaluate(ST)['comic']==expected,(name,page.evaluate(ST)['scene'])
            page.evaluate('ms=>RizoRuntimeQA.dungeonSceneTimeForQA(ms)',clock);page.wait_for_timeout(60)
            page.screenshot(path=str(args.evidence/f'{name}-{width}.png'),scale='css')
            state=page.evaluate(ST)
            okay=not errors and state['comic']==expected and page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            results.append({'scene':name,'viewport':[width,height],'passed':okay,'errors':errors,
                'comic':state['comic'],'screen':page.locator('.dungeon-screen').bounding_box()})
            print(('PASS' if okay else 'FAIL'),width,name,flush=True);ctx.close()
    browser.close()
server.shutdown()
(args.evidence/'comics.json').write_text(json.dumps(results,indent=2))
raise SystemExit(not all(r['passed'] for r in results))
