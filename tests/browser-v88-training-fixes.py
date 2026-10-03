"""Phase 3 game fixes, proven in the real runner (audit H3, H4/L1, M5, M6, L4 and
the Ember Beat short-run payout)."""
import sys, re
from playwright.sync_api import sync_playwright
from browser_harness import build_inline_app, SETUP_STATE

results = []
def check(name, passed, detail=''):
    results.append(bool(passed)); print(('PASS' if passed else 'FAIL'), name, detail)

def modal_class(page):
    return page.evaluate('document.querySelector("#modalOverlay.show .modal-card")?.className||""')
def close_modal(page):
    page.evaluate('document.querySelector("#modalOverlay.show [data-close-modal]")?.click()'); page.wait_for_timeout(250)
def time_up(page):
    page.evaluate('RizoRuntimeQA.arcadeAdvanceClockForQA(999999)'); page.wait_for_timeout(350)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(build_inline_app(True), wait_until='load', timeout=120000)
    page.wait_for_timeout(250)

    # ---- M6: an unbanked Spark stash does not survive the buzzer
    page.evaluate(SETUP_STATE); page.evaluate('RizoRuntimeQA.startMiniGame("spark")'); page.wait_for_timeout(200)
    for _ in range(4): page.evaluate('RizoRuntimeQA.arcadeSparkCatchForQA("normal")')
    held = page.evaluate('RizoRuntimeQA.arcadeSnapshotForQA().spark')
    time_up(page)
    after = page.evaluate('RizoRuntimeQA.arcadeSnapshotForQA().spark')
    check('Spark: an unbanked stash is lost at the buzzer', held['stash'] >= 4 and after['banked'] == 0 and after['lost'] >= held['stash'], str((held, after)))
    check('Spark: a run that never banked is a warm-up', 'arcade-no-credit' in modal_class(page), modal_class(page))
    close_modal(page)
    page.evaluate(SETUP_STATE); page.evaluate('RizoRuntimeQA.startMiniGame("spark")'); page.wait_for_timeout(200)
    for _ in range(4): page.evaluate('RizoRuntimeQA.arcadeSparkCatchForQA("normal")')
    page.evaluate('RizoRuntimeQA.finishMiniGame(true)'); page.wait_for_timeout(300)
    quit_snap = page.evaluate('RizoRuntimeQA.arcadeSnapshotForQA().spark')
    check('Spark: ending the run yourself banks the stash', quit_snap['banked'] >= 4 and quit_snap['stash'] == 0, str(quit_snap))
    close_modal(page)

    # ---- M5: a full-hearts time-up is TIME UP, never CLEARED
    for mode in ('rush', 'breaker', 'memory'):
        page.evaluate(SETUP_STATE); page.evaluate(f'RizoRuntimeQA.startMiniGame("{mode}")'); page.wait_for_timeout(200)
        page.evaluate(f'RizoRuntimeQA.arcadeQualifyForQA("{mode}")')
        lives = page.evaluate('RizoRuntimeQA.arcadeStateForQA().lives')
        time_up(page)
        cls = modal_class(page)
        check(f'{mode}: a time-up with {lives} hearts says TIME UP', 'arcade-end-timeup' in cls and 'arcade-end-cleared' not in cls, cls)
        close_modal(page)

    # ---- H4 / L1: Lost Signal pays 1 per rune and the clear bonus it announces
    page.evaluate(SETUP_STATE); page.evaluate('RizoRuntimeQA.startMiniGame("memory")'); page.wait_for_timeout(200)
    page.evaluate('RizoRuntimeQA.arcadeMemoryRoundForQA(4)')
    page.wait_for_timeout(4 * 520 + 400)
    expected = page.evaluate('RizoRuntimeQA.arcadeSnapshotForQA().memory.expected')
    before = page.evaluate('RizoRuntimeQA.arcadeStateForQA().score')
    for rune in expected:
        page.evaluate(f'document.querySelector(\'[data-memory-rune="{rune}"]\').dispatchEvent(new PointerEvent("pointerdown",{{bubbles:true,pointerType:"touch",buttons:1}}))')
        page.wait_for_timeout(60)
    gained = page.evaluate('RizoRuntimeQA.arcadeStateForQA().score') - before
    callout = page.evaluate('document.querySelector("#memoryCallout")?.textContent||""')
    bonus = int((re.search(r'\+(\d+)', callout) or [0, 0])[1])
    check('Lost Signal: a round pays 1 per rune plus the bonus its callout shows', bonus in (3, 5, 8) and gained == len(expected) + bonus, str({'runes': len(expected), 'gained': gained, 'callout': callout}))
    page.evaluate('RizoRuntimeQA.finishMiniGame(true,null,{discard:true})'); page.wait_for_timeout(100)

    # ---- Ember Beat: three perfect notes and a quit no longer pay like a song
    page.evaluate(SETUP_STATE); page.evaluate('RizoRuntimeQA.startMiniGame("rhythm")')
    hits = 0
    for _ in range(400):
        timing = page.evaluate('RizoRuntimeQA.rhythmTimingForQA()')
        for note in timing['open']:
            if timing['ready'] and abs(note['delta']) < .03:
                page.evaluate(f'RizoRuntimeQA.rhythmTapForQA({note["lane"]})'); hits += 1
        if hits >= 3: break
        page.wait_for_timeout(15)
    q = page.evaluate('RizoRuntimeQA.rhythmQualityForQA()')
    check('Ember Beat: reward score scales with the share of the song played', hits >= 3 and q['quality'] >= 40 and q['reward'] <= 10, str((hits, q)))
    page.evaluate('RizoRuntimeQA.finishMiniGame(true,null,{discard:true})'); page.wait_for_timeout(100)

    # ---- L4: Skybound rescales Rizo and its gates when the arena changes size
    page.evaluate(SETUP_STATE); page.evaluate('RizoRuntimeQA.startMiniGame("glide")'); page.wait_for_timeout(200)
    page.evaluate('RizoRuntimeQA.arcadePauseForQA()')
    ratio = lambda: page.evaluate('(()=>{const f=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA());return f.glideY/document.querySelector("#miniArena").clientHeight})()')
    before = ratio()
    page.set_viewport_size({'width': 844, 'height': 390})
    page.wait_for_timeout(200)
    page.evaluate('RizoRuntimeQA.arcadeResumeForQA()'); page.wait_for_timeout(40)
    page.evaluate('RizoRuntimeQA.arcadePauseForQA()')
    after = ratio()
    check('Skybound: Rizo keeps its place in the sky across a rotation', abs(after - before) < .06, f'{before:.3f} -> {after:.3f}')
    page.evaluate('RizoRuntimeQA.finishMiniGame(true,null,{discard:true})'); page.wait_for_timeout(100)
    page.set_viewport_size({'width': 390, 'height': 844})

    # ---- H3: a par run pays the par budget, and no run pays past 1.5x
    for mode in ('spark', 'memory', 'power'):
        par_gains = page.evaluate(f'(()=>{{const g=RizoRuntimeQA.arcadeGamesForQA()["{mode}"];return RizoRuntimeQA.trainingConvertForQA("{mode}",g.par)}})()')
        huge = page.evaluate(f'RizoRuntimeQA.trainingConvertForQA("{mode}",1e9)')
        energy = page.evaluate(f'RizoRuntimeQA.arcadeGamesForQA()["{mode}"].energy')
        check(f'{mode}: a par run pays the par budget; any run caps at 1.5x', par_gains['embers'] == energy * 5 and huge['embers'] == int(energy * 7.5 + .5) and huge['bond'] <= 6, str((par_gains['embers'], huge['embers'], huge['bond'])))

    check('no page errors', not errors, '; '.join(errors[:3]))
    browser.close()

print(f"\n{sum(results)}/{len(results)} training fix checks passed")
sys.exit(0 if all(results) else 1)
