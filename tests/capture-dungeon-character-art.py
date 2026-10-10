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
FLAGS = {'latchFreed': True, 'porterDown': True, 'rowsLedge': True, 'rowsCatch': True, 'rowsLowRoute': True}
SCENES = [
    ('you-car', None, {}, [], 600),
    ('van-crew', 'van', {}, [], 2600),
    ('van-quiet', 'van', {}, [], 100),
    ('van-talk-driver', 'van', {}, [], 100),
    ('van-talk-tall', 'van', {}, [], 100),
    ('van-talk-small', 'van', {}, [], 100),
    ('van-talk-cap', 'van', {}, [], 100),
    ('latch', 'hem', {}, [], 100),
    ('nell', 'drytable', FLAGS, [], 2600),
    ('nell-dialogue', 'drytable', FLAGS, [], 200),
    ('orr-hatch', 'eyelet', FLAGS, ['rows:split', 'rows:eyelet'], 200),
    ('meal', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 2600),
    ('meal-dialogue', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 4600),
    ('orr-dialogue', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 200),
    ('intake-crew', 'intake', {}, [], 1800),
    ('queue-collector', 'queue', {}, [], 100),
    ('row-collector', 'hangrow', FLAGS, ['rows:split'], 100),
    ('hall-runner', 'longhall', {}, [], 100),
    ('factory-sentry', 'factory', {}, [], 100),
    ('porter', 'porter', {}, [], 100),
    ('nell-latch', 'receiving', FLAGS, [], 200),
    ('nell-walk', 'drytable', FLAGS, [], 200),
    ('nell-fix', 'drytable', FLAGS, [], 200),
    ('nell-brace', 'press', FLAGS, ['rows:meal'], 200),
    ('nell-lift', 'press', {**FLAGS, 'rowsPressStop': True, 'rowsBrake': True}, ['rows:meal', 'rows:screen'], 200),
    ('nell-fit', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met', 'rows:meal', 'rows:upper'], 200),
    ('nell-sit', 'windowgate', FLAGS, ['rows:boundary'], 200),
    ('orr-carry', 'drytable', {**FLAGS, 'rowsGrille': True}, ['rows:met'], 200),
    ('porter-open', 'porter', {}, [], 100),
    ('porter-sweep', 'porter', {}, [], 100),
    ('porter-settled', 'porter', {}, [], 100),
]

def drive_to_actor(page, who, wanted, pick=None):
    """Reach a real scripted pose through story input, never replace an NPC."""
    for _ in range(700):
        state = page.evaluate(ST)
        actor = next((n for n in state['npcs'] if n['id'] == who), None)
        if actor and actor['state'] == wanted:
            return
        if state.get('choice'):
            assert pick in state['choice']['options'], state['choice']
            if who == 'nell' and wanted == 'fit':
                # Approach her before choosing the wrap, rather than photograph
                # the player left at his earlier job on the far side of the table.
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,112)')
            while page.evaluate(ST)['choice']['options'][page.evaluate(ST)['choice']['index']] != pick:
                page.keyboard.press('d'); page.wait_for_timeout(40)
            page.keyboard.press('z'); page.wait_for_timeout(40)
        elif state.get('dialogue'):
            page.keyboard.press('z'); page.wait_for_timeout(40)
        page.evaluate('RizoRuntimeQA.dungeonSceneTimeForQA(100)')
        page.wait_for_timeout(8)
    raise AssertionError(f'{who} never reached {wanted}: {page.evaluate(ST)}')
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width, height in [(320, 568), (390, 844), (430, 932)]:
        for name, room, flags, beats, ms in SCENES:
            if args.only and name not in args.only.split(','):
                continue
            ctx = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True,
                                      service_workers='block', reduced_motion='reduce', device_scale_factor=2)
            page = ctx.new_page(); errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            # Hold the real frame at capture time, then redraw with dt=0.
            # This is capture-only; production art and animation are unchanged.
            page.add_init_script('''(()=>{
                const raf=requestAnimationFrame.bind(window), cancel=cancelAnimationFrame.bind(window);
                const pending=new Map(), times=new Map();let frozen=false;
                window.requestAnimationFrame=fn=>{if(frozen)return 0;
                    const id=raf(t=>{pending.delete(id);times.set(fn,t);fn(t)});pending.set(id,fn);return id;};
                window.__freezeCharacterEvidence=fixtures=>{
                    frozen=true;const draws=[...pending.values()];for(const id of pending.keys())cancel(id);
                    for(const f of fixtures)RizoRuntimeQA.dungeonEnemyForQA(f.id,f);
                    for(const draw of draws)if(times.has(draw))draw(times.get(draw));
                };
            })()''')
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
            enemy_fixtures = []
            if name == 'nell-latch':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(130,140)')
            elif name == 'nell-fix':
                drive_to_actor(page, 'nell', 'fix')
            elif name == 'nell-brace':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(140,370)')
            elif name == 'nell-lift':
                page.evaluate("RizoRuntimeQA.dungeonEnemyForQA('press-needle',{state:'gone'})")
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(196,56)')
                page.wait_for_timeout(120)
                page.keyboard.press('z'); page.wait_for_timeout(100)
                page.evaluate('RizoRuntimeQA.dungeonAdvanceForQA(1800,{})')
                assert next(n for n in page.evaluate(ST)['npcs'] if n['id']=='nell')['state']=='lift', page.evaluate(ST)
            elif name == 'nell-fit':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,196)')
                drive_to_actor(page, 'nell', 'fit', 'worn')
            elif name == 'orr-carry':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,210)')
                drive_to_actor(page, 'orr', 'carry', 'go')
            elif name.startswith('porter-'):
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(130,200)')
                if name == 'porter-settled':
                    porter = next(e for e in page.evaluate(ST)['sim']['enemies'] if e['kind']=='porter')
                    page.evaluate("id=>RizoRuntimeQA.dungeonEnemyForQA(id,{state:'settled',hp:0})", porter['id'])
                else:
                    wanted = 'open' if name == 'porter-open' else 'sweep'
                    for _ in range(250):
                        page.evaluate('RizoRuntimeQA.dungeonAdvanceForQA(17,{})')
                        porter = next(e for e in page.evaluate(ST)['sim']['enemies'] if e['kind']=='porter')
                        if porter['state'] == wanted:
                            break
                    assert porter['state'] == wanted, porter
                    page.evaluate('RizoRuntimeQA.dungeonAdvanceForQA(200,{})')
                porter = next(e for e in page.evaluate(ST)['sim']['enemies'] if e['kind']=='porter')
                enemy_fixtures = [{'id':porter['id'],'x':porter['x'],'y':porter['y']}]
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
            elif name.startswith('van-talk-'):
                who = {'driver':'driver','tall':'hood-tall','small':'hood-small','cap':'hood-cap'}[name.removeprefix('van-talk-')]
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(80,98)')
                reached = page.evaluate('''id=>{for(let i=0;i<1600;i++){
                    const s=RizoRuntimeQA.dungeonStateForQA();
                    if(s.barks.some(b=>b.id===id))return true;
                    RizoRuntimeQA.dungeonAdvanceForQA(100,{});
                    RizoRuntimeQA.dungeonSceneTimeForQA(100);
                }return false;}''', who)
                assert reached, f'{who} did not speak'
            elif name in {'nell-dialogue', 'orr-dialogue'}:
                speaker = 'nell' if name == 'nell-dialogue' else 'orr'
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,210)')
                for _ in range(300):
                    state = page.evaluate(ST)
                    if (state.get('dialogue') or {}).get('speaker') == speaker:
                        break
                    if state.get('dialogue'):
                        page.keyboard.press('z'); page.wait_for_timeout(40)
                    page.evaluate('RizoRuntimeQA.dungeonSceneTimeForQA(100)')
                    page.wait_for_timeout(8)
                assert page.evaluate(ST)['dialogue']['speaker'] == speaker
            if name == 'latch':
                page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(180,260)')
                page.keyboard.press('z')
            elif name.endswith('collector') or name in {'hall-runner', 'factory-sentry'}:
                s = page.evaluate(ST)
                enemy = next(e for e in s['sim']['enemies'] if e['kind'] in {'collector', 'runner'})
                # Select authored patrol anchors, not a variable real-time
                # point on the route. All sentries stay visible in the scene.
                if name != 'hall-runner':
                    enemy_fixtures = page.evaluate('''r=>RizoDungeonContent.ROOMS[r].encounters
                      .filter(e=>e.kind==='collector').map(e=>({id:e.id,x:e.x,y:e.y,
                        state:'patrol'}))''', room)
                    for fixture in enemy_fixtures:
                        page.evaluate('f=>RizoRuntimeQA.dungeonEnemyForQA(f.id,{x:f.x,y:f.y})', fixture)
                    enemy = next(f for f in enemy_fixtures if f['id'] == enemy['id'])
                page.evaluate('([x,y])=>RizoRuntimeQA.dungeonTeleportForQA(x,y)', [enemy['x'] - 35, enemy['y'] + 40])
                if name == 'hall-runner':
                    assert page.evaluate("id=>RizoRuntimeQA.dungeonEnemyForQA(id,{state:'run',x:100,y:420})", enemy['id'])
                    page.evaluate('RizoRuntimeQA.dungeonTeleportForQA(150,510)')
                    enemy_fixtures = [{'id': enemy['id'], 'x': 100, 'y': 420, 'state': 'run'}]
            page.wait_for_timeout(50 if name == 'porter-sweep' else 200)
            if name.endswith('dialogue'):
                dialogue = page.evaluate(ST).get('dialogue')
                if dialogue and dialogue['shown'] < len(dialogue['text']):
                    page.keyboard.press('z')  # the normal tap-to-reveal action
                    page.wait_for_timeout(50)
            page.evaluate('fixtures=>window.__freezeCharacterEvidence(fixtures)', enemy_fixtures)
            page.screenshot(path=str(out / f'{name}-{width}.png'), scale='css')
            state = page.evaluate(ST)
            assert state['ui'] != 'panel', f'{name} captured a pause/overlay: {state["panelKind"]}'
            if name == 'orr-hatch':
                assert any(actor['id'] == 'orr' for actor in state['npcs']), 'Orr is absent from his hatch evidence'
            screen = page.locator('.dungeon-screen').bounding_box()
            okay = not errors and page.evaluate('document.documentElement.scrollWidth<=innerWidth && innerWidth===%d' % width)
            results.append({'scene': name, 'viewport': [width, height], 'passed': okay, 'errors': errors,
                            'room': state['sim']['roomId'], 'ui': state['ui'], 'panelKind': state['panelKind'],
                            'actors': state['npcs'], 'dialogue': state.get('dialogue'),
                            'enemies': state['sim']['enemies'], 'player': state['sim']['player'],
                            'sceneTime': state['sceneTime'], 'depth': state['depth'], 'barks': state['barks'],
                            'screen': screen})
            print(('PASS' if okay else 'FAIL'), width, name, flush=True)
            ctx.close()
    browser.close()
server.shutdown()
metadata = out / 'capture.json'
if args.only and metadata.exists():
    updated = {(r['scene'], r['viewport'][0]) for r in results}
    previous = [r for r in json.loads(metadata.read_text())
                if (r['scene'], r['viewport'][0]) not in updated]
    metadata.write_text(json.dumps(previous + results, indent=2) + '\n')
else:
    metadata.write_text(json.dumps(results, indent=2) + '\n')
print(f'{sum(r["passed"] for r in results)}/{len(results)} captures without errors or horizontal overflow')
sys.exit(0 if all(r['passed'] for r in results) else 1)
