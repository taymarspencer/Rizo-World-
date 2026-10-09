"""Reading-card and comic handoff checks in Chromium; no full-playthrough claim.
Uses QA room placement, then real touch input. Comic clock is advanced directly.
"""
import functools
import socketserver
import sys
import threading
import tempfile
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from static_site import StaticSiteHandler
artifact = tempfile.TemporaryDirectory(prefix='rizo-reading-')
directory = Path(artifact.name) / 'site'
subprocess.run([sys.executable, str(ROOT / 'tools/build-site.py'), '--out', str(directory)], check=True, stdout=subprocess.DEVNULL)
server = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(StaticSiteHandler, directory=str(directory)))
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []
def check(label, result):
    results.append(bool(result))
    print(('PASS ' if result else 'FAIL ') + label, flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width in (320, 375, 390, 430):
        ctx = browser.new_context(viewport={'width':width, 'height':844 if width > 320 else 568}, has_touch=True, service_workers='block')
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/modes/dungeon/dungeon-view.js', lambda route: route.fulfill(content_type='application/javascript', body=(ROOT / 'modes/dungeon/dungeon-view.js').read_text() + "\n{const api=RizoDungeonView;Object.defineProperty(window,'RizoDungeonView',{configurable:true,value:{...api,create:options=>(window.readingView=api.create(options))}})}"))
        page.goto(f'http://127.0.0.1:{server.server_address[1]}/play?qa=1')
        page.wait_for_function('window.RizoRuntimeQA')
        page.evaluate("""()=>{const s=RizoRuntimeQA.defaultState();Object.assign(s.pet,{stage:'kid',energy:90,hunger:90,mood:90,hygiene:90,health:100,resting:false,sleeping:false});s.player.tutorialDismissed=true;s.player.tutorialStep=5;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.setViewForQA('go')}""")
        page.locator('[data-mode="dungeon"]').click()
        page.wait_for_timeout(800)
        page.evaluate("RizoRuntimeQA.dungeonSkipSceneForQA();RizoRuntimeQA.dungeonGotoForQA('clatter',null,{})")
        page.wait_for_timeout(300)
        page.evaluate('RizoRuntimeQA.dungeonSkipSceneForQA();RizoRuntimeQA.dungeonTeleportForQA(285,382)')
        page.wait_for_timeout(100)
        page.locator('.dungeon-key-primary').tap()
        page.wait_for_function("!document.querySelector('.dungeon-dialogue').hidden")
        box = page.locator('.dungeon-dialogue')
        before = box.bounding_box()
        check(f'{width}: reveal instruction', page.locator('.dungeon-more').inner_text() == 'TAP TO REVEAL')
        box.tap()
        page.wait_for_timeout(70)
        check(f'{width}: one tap reveals without closing', box.is_visible() and page.locator('.dungeon-dialogue').get_attribute('data-reading') == 'ready')
        after = box.bounding_box()
        check(f'{width}: reveal keeps card height', abs(before['height'] - after['height']) < 1)
        check(f'{width}: cue does not overlap text', page.evaluate("""()=>{let a=document.querySelector('.dungeon-line').getBoundingClientRect(),b=document.querySelector('.dungeon-more').getBoundingClientRect();return b.top>=a.bottom}"""))
        check(f'{width}: card stays within game', page.evaluate("""()=>{let a=document.querySelector('.dungeon-dialogue').getBoundingClientRect(),b=document.querySelector('.dungeon-screen').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right}"""))
        page.screenshot(path=f'/tmp/rizo-reading-{width}.png')
        for _ in range(6):
            if not box.is_visible(): break
            box.tap()
            page.wait_for_timeout(60)
        check(f'{width}: touch closes reading', not box.is_visible())
        # Render real character lines through the captured production view.
        for group in ('rowsFurtherUp', 'rowsCatchAsk', 'rowsMeal'):
            result = page.evaluate("""group=>{const line=RizoDungeonContent.LINES[group].at(-1);readingView.dialogue(line.text,{...line,fullText:line.text,done:true});return document.querySelector('.dungeon-portrait').dataset.expr===line.expr&&!document.querySelector('.dungeon-portrait').hidden}""", group)
            page.wait_for_timeout(80)
            check(f'{width}: {group} uses its authored portrait expression', result)
            check(f'{width}: {group} card fits', page.evaluate("""()=>{const a=document.querySelector('.dungeon-dialogue').getBoundingClientRect(),b=document.querySelector('.dungeon-screen').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right}"""))
            if group == 'rowsFurtherUp': page.screenshot(path=f'/tmp/rizo-nell-{width}.png')
        page.evaluate('readingView.dialogue(null)')
        # Isolate the real comic renderer from the mode to exercise all authored
        # clocks without triggering unrelated progression or writing save data.
        for reduced in (False, True):
            result = page.evaluate("""async reduced=>{
              const mount=document.querySelector('.dungeon-screen'), hits=[], finished=[];
              const comic=RizoDungeonComic.create({mount,reducedMotion:reduced,lines:RizoDungeonContent.LINES,speakers:RizoDungeonContent.SPEAKERS,onPanel:(id,i)=>hits.push(id+':'+i)});
              let ok=true;const failures=[];
              for(const [id,scene] of Object.entries(RizoDungeonComic.SCENES)){
                const promise=comic.play(id,{onDone:r=>finished.push(r)});
                comic.tick(scene.ms-1);
                const node=mount.querySelector('.dungeon-comic:not(.is-out)'), screen=mount.getBoundingClientRect();
                await new Promise(r=>setTimeout(r,450));
                const inside=[...node.querySelectorAll('.comic-balloon')].every(el=>{const r=el.getBoundingClientRect();return r.left>=screen.left-1&&r.right<=screen.right+1&&r.top>=screen.top-1&&r.bottom<=screen.bottom+1});
                if(!inside)failures.push(id+': balloon bounds');ok=ok&&inside;
                if(id.startsWith('boss-'))ok=ok&&getComputedStyle(node.querySelector('.comic-page')).animationName==='none';
                ok=ok&&comic.playing()===id&&mount.querySelectorAll('.dungeon-comic:not(.is-out) .is-in').length===scene.panels.length;
                comic.tick(1);const result=await promise;
                ok=ok&&!comic.playing()&&!result.skipped;
                await new Promise(r=>setTimeout(r,240));
                ok=ok&&!mount.querySelector('.dungeon-comic');
                const skip=comic.play(id);comic.skip();ok=ok&&(await skip).skipped;
                await new Promise(r=>setTimeout(r,240));
              }
              comic.destroy();return {ok:ok&&finished.length===Object.keys(RizoDungeonComic.SCENES).length,failures};
            }""", reduced)
            check(f'{width}: every comic exact completion and skip, reduced={reduced}', result['ok'])
            if not result['ok']: print(result, flush=True)
        check(f'{width}: no page errors', not errors)
        ctx.close()
    browser.close()
server.shutdown()
print(f'{sum(results)}/{len(results)} reading checks passed')
sys.exit(0 if all(results) else 1)
