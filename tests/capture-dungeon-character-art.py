"""Comparable character evidence in the built game, at real phone sizes.

QA room/scene clocks select existing story beats. No stand-in art, altered
camera, resized actors, or test-only scene is substituted for gameplay.
"""
import argparse, functools, json, socketserver, subprocess, sys, tempfile, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory')
parser.add_argument('--evidence', required=True)
parser.add_argument('--only', help='comma-separated scene names for additional evidence')
args = parser.parse_args()
artifact = tempfile.TemporaryDirectory(prefix='rizo-character-art-')
site = Path(args.directory).resolve() if args.directory else Path(artifact.name) / 'site'
if not args.directory:
    subprocess.run([sys.executable, str(ROOT / 'tools/build-site.py'), '--out', str(site)], check=True, stdout=subprocess.DEVNULL)
sys.path.insert(0, str(ROOT / 'tools'))
from static_site import StaticSiteHandler
server = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(StaticSiteHandler, directory=str(site)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_address[1]}/play?qa=1'
out = Path(args.evidence); out.mkdir(parents=True, exist_ok=True)
ST = 'RizoRuntimeQA.dungeonStateForQA()'
SETUP = """()=>{const s=RizoRuntimeQA.defaultState();
Object.assign(s.pet,{name:'MOSSY',stage:'kid',variant:'classic',hiddenVariant:'classic',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false});
s.settings.reducedMotion=true;s.player.tutorialDismissed=true;s.player.tutorialStep=5;
s.meta.backupPrompts=['week-1','house-1','mature-1','rebirth-1'];
RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}"""
FLAGS = {'latchFreed': True, 'porterDown': True, 'rowsCatch': True}
SCENES = [
    ('you-car', None, {}, [], 600),
    ('van-crew', 'van', {}, [], 2600),
    ('van-quiet', 'van', {}, [], 100),
    ('latch', 'hem', {}, [], 100),
    ('nell', 'drytable', FLAGS, [], 2600),
    ('nell-dialogue', 'drytable', FLAGS, [], 4600),
    ('orr-hatch', 'eyelet', FLAGS, ['rows:eyelet'], 200),
    ('meal', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 2600),
    ('meal-dialogue', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 4600),
    ('intake-crew', 'intake', {}, [], 1800),
    ('queue-collector', 'queue', {}, [], 100),
    ('row-collector', 'hangrow', FLAGS, ['rows:split'], 100),
    ('hall-runner', 'longhall', {}, [], 100),
    ('factory-sentry', 'factory', {}, [], 100),
    ('porter', 'porter', {}, [], 100),
]
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width, height in [(320, 568), (390, 844)]:
        for name, room, flags, beats, ms in SCENES:
            if args.only and name not in args.only.split(','):
                continue
            ctx = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True,
                                      service_workers='block', reduced_motion='reduce', device_scale_factor=2)
            page = ctx.new_page(); errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.goto(URL); page.wait_for_function('!!window.RizoRuntimeQA')
            page.evaluate(SETUP); page.evaluate("RizoRuntimeQA.setViewForQA('go')")
            page.wait_for_timeout(150); page.locator('[data-mode="dungeon"]').click()
            page.wait_for_function('RizoRuntimeQA.dungeonStateForQA()?.sim')
            # The dynamic mode stylesheet and initial shell layout must settle
            # before jumping rooms; otherwise evidence uses the launch size.
            page.wait_for_timeout(1200)
            # A native viewport resize settles the baseline build's initial
            # measurements too; both versions use the same final viewport.
            page.set_viewport_size({'width': width+1, 'height': height})
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_timeout(150)
            if room:
                page.evaluate('([r,f,b])=>RizoRuntimeQA.dungeonGotoForQA(r,null,f,b)', [room, flags, beats])
                page.wait_for_timeout(350)
                page.set_viewport_size({'width': width+1, 'height': height})
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(150)
            page.evaluate('ms=>RizoRuntimeQA.dungeonSceneTimeForQA(ms)', ms)
            if name == 'van-quiet':
                # The authored post-call silence exposes all four seated
                # silhouettes without removing dialogue or moving the camera.
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(80,98)')
                reached = page.evaluate('''()=>{for(let i=0;i<1600;i++){
                    RizoRuntimeQA.dungeonAdvanceForQA(100,{});
                    RizoRuntimeQA.dungeonSceneTimeForQA(100);
                    if(RizoRuntimeQA.dungeonStateForQA().depth.hush==='wipers')return true;
                }return false;}''')
                assert reached, 'van did not reach its authored quiet beat'
            if name == 'latch':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(180,260)')
                page.keyboard.press('z')
            elif name.endswith('collector') or name in {'hall-runner', 'factory-sentry'}:
                s = page.evaluate(ST)
                enemy = next(e for e in s['sim']['enemies'] if e['kind'] in {'collector', 'runner'})
                page.evaluate('([x,y])=>RizoRuntimeQA.dungeonTeleportForQA(x,y)', [enemy['x'] - 35, enemy['y'] + 40])
                if name == 'hall-runner':
                    assert page.evaluate("id=>RizoRuntimeQA.dungeonEnemyForQA(id,{state:'run',x:100,y:420})", enemy['id'])
                    page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,510)')
            page.wait_for_timeout(200)
            if name.endswith('dialogue'):
                dialogue = page.evaluate(ST).get('dialogue')
                if dialogue and dialogue['shown'] < len(dialogue['text']):
                    page.keyboard.press('z')  # the normal tap-to-reveal action
                    page.wait_for_timeout(50)
            page.screenshot(path=str(out / f'{name}-{width}.png'), scale='css')
            state = page.evaluate(ST)
            screen = page.locator('.dungeon-screen').bounding_box()
            okay = not errors and page.evaluate('document.documentElement.scrollWidth<=innerWidth && innerWidth===%d' % width)
            results.append({'scene': name, 'viewport': [width, height], 'passed': okay, 'errors': errors,
                            'room': state['sim']['roomId'], 'actors': state['npcs'], 'dialogue': state.get('dialogue'),
                            'sceneTime': state['sceneTime'], 'depth': state['depth'], 'barks': state['barks'],
                            'screen': screen})
            print(('PASS' if okay else 'FAIL'), width, name, flush=True)
            ctx.close()
    browser.close()
server.shutdown()
(out / 'capture.json').write_text(json.dumps(results, indent=2))
print(f'{sum(r["passed"] for r in results)}/{len(results)} captures without errors or horizontal overflow')
sys.exit(0 if all(r['passed'] for r in results) else 1)
