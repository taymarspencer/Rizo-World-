"""Par calibration for the training games (not a pass/fail test).

Plays full-length runs with bots that act through the arena (pointer events,
keys) with a 330-650 ms reaction delay and never misjudge, reading state from
QA probes, and prints each run's score. ARCHITECTURE.md §4 sets each game's par
at about 45% of these scores. Skybound has no reliable bot yet (its par is
estimated from its scoring). Usage: python3 tests/calibrate-training-pars.py [ids…]
"""
import sys, json, time
sys.path.insert(0, '/home/user/rizo-world-/tests')
from browser_harness import build_inline_app, SETUP_STATE
from playwright.sync_api import sync_playwright

BOTS = {
# every bot: window.__bot = setInterval(...) ; uses helpers tap(x,y,target), key(k)
"power": """
  let last=0; return ()=>{const t=performance.now(); const p=RizoRuntimeQA.arcadeSnapshotForQA().power; if(p.guard||t-last<650)return;
    const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA()); if(Math.abs(fp.needle-fp.powerZone)>.06)return; last=t;
    const btn=document.querySelector(`[data-power-tech="${p.call}"]`); if(btn) tapEl(btn); };""",
"spark": """
  let seenAt=0,lastX=null; return ()=>{const orb=document.querySelector('#miniTarget'); if(!orb)return; const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA());
    if(orb.style.left!==lastX){lastX=orb.style.left;seenAt=performance.now();}
    const left=RizoRuntimeQA.arcadeClockForQA().remaining;
    if((fp.sparkStash>=10||(left<2500&&fp.sparkStash>0))){const bank=document.querySelector('[data-spark-bank]'); if(bank&&!bank.disabled){tapEl(bank);return;}}
    if(fp.sparkType!=="shadow"&&performance.now()-seenAt>330){tapEl(orb);seenAt=Infinity;} };""",
"forage": """
  return ()=>{const s=RizoRuntimeQA.arcadeSnapshotForQA().forage, a=RizoRuntimeQA.arcadeAuthoredForQA().forage; const want=s.order[s.orderIndex];
    const drops=a.drops.filter(d=>d.good!==false&&(d.food===want||d.rare)).sort((x,y)=>y.y-x.y); const target=drops[0]; if(!target)return;
    if(target.lane!==s.lane){const arena=document.querySelector('#miniArena').getBoundingClientRect(); tapAt(arena.left+arena.width*(target.lane+.5)/3, arena.top+arena.height*.8);} };""",
"rush": """
  let lastJump=0; return ()=>{const r=RizoRuntimeQA.rushSnapshotForQA(); if(!r)return; const arena=document.querySelector('#miniArena').getBoundingClientRect(); const petX=arena.width*.22;
    const near=r.entities.filter(e=>!e.handled&&e.x>petX+20&&e.x<petX+95); if(near.length&&performance.now()-lastJump>420&&r.jumpY<4){lastJump=performance.now();tapAt(arena.left+arena.width/2,arena.top+arena.height/2);} };""",
"walk": """
  return ()=>{const w=RizoRuntimeQA.arcadeAuthoredForQA().walk;
    if(w.paused){const notes=w.notes.length; const btns=[...document.querySelectorAll('.walk-fork-btn')]; if(!btns.length)return;
      const pick=btns.find(b=>b.dataset.walkEnding==="bold"&&notes>=3)||btns.find(b=>b.dataset.walkEnding==="quiet")||btns[btns.length-1]; tapEl(pick); return;}
    const finds=[...document.querySelectorAll('.walk-find:not(.collected)')]; const arena=document.querySelector('#miniArena').getBoundingClientRect();
    for(const f of finds){const r=f.getBoundingClientRect(); if(r.left>arena.left+20&&r.left<arena.left+arena.width*.75){tapEl(f);break;}} };""",
"rhythm": """
  return ()=>{const t=RizoRuntimeQA.rhythmTimingForQA(); if(!t.ready)return; for(const n of t.open){ if(Math.abs(n.delta)<.04){RizoRuntimeQA.rhythmTapForQA(n.lane);} } };""",
"memory": """
  let nextAt=0; return ()=>{const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA()); if(fp.memoryShowing||performance.now()<nextAt)return;
    const exp=RizoRuntimeQA.arcadeSnapshotForQA().memory.expected; const want=exp[fp.memoryInput]; if(want===undefined)return;
    const rune=document.querySelector(`[data-memory-rune="${want}"]`); if(rune){tapEl(rune);nextAt=performance.now()+330;} };""",
"glide": """
  return ()=>{const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA()); const arena=document.querySelector('#miniArena').getBoundingClientRect(); const petX=arena.width*.24;
    const gate=(fp.entities||[]).filter(e=>e.kind==="glide"&&e.x+e.width>petX-24).sort((a,b)=>a.x-b.x)[0]; const target=gate?gate.gapY+8:arena.height*.5;
    if(fp.glideY+fp.glideV*.16>target)document.querySelector('#miniArena').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:arena.left+10,clientY:arena.bottom-10,pointerType:'touch',buttons:1})); };""",
"breaker": """
  return ()=>{const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA()); const b=fp.breakerBall; if(!b)return; const arena=document.querySelector('#miniArena').getBoundingClientRect();
    const ev=new PointerEvent('pointermove',{bubbles:true,clientX:arena.left+b.x,clientY:arena.top+arena.height*.85,pointerType:'touch',buttons:1}); document.querySelector('#miniArena').dispatchEvent(ev); };""",
"maze": """
  const dirs={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]};
  return ()=>{const fp=JSON.parse(RizoRuntimeQA.arcadeFingerprintForQA()); const g=fp.mazeGrid, p=fp.mazePlayer; if(!g||!p)return;
    const open=(r,c)=>g[r]&&g[r][c]&&g[r][c]!=="#"; const hunters=(fp.mazeHunters||[]); const hunting=(fp.mazeHuntUntil||0)>0&&RizoRuntimeQA.arcadeSnapshotForQA().maze.hunting;
    const seen=new Set([p.r+','+p.c]); let q=[[p.r,p.c,null]], pick=null;
    while(q.length&&!pick){const [r,c,first]=q.shift(); for(const [d,[dr,dc]] of Object.entries(dirs)){const nr=r+dr,nc=c+dc,k=nr+','+nc; if(seen.has(k)||!open(nr,nc))continue;
      if(!hunting&&hunters.some(h=>Math.abs(h.r-nr)+Math.abs(h.c-nc)<=1))continue; seen.add(k); const f=first||d; if(fp.mazeEaten&&fp.mazeEaten[k]){q.push([nr,nc,f]);continue;}
      const cell=g[nr][nc]; if(cell==="."||cell==="o"||cell==="*"){pick=f;break;} q.push([nr,nc,f]);}}
    if(pick)RizoRuntimeQA.arcadeMazeDirectionForQA(pick); };"""
}

HELPERS = """()=>{
window.tapAt=(x,y)=>{const el=document.elementFromPoint(x,y)||document.querySelector('#miniArena');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerType:'touch',buttons:1}));};
window.tapEl=el=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerType:'touch',buttons:1}));};
return true;}"""

games = sys.argv[1:] or [game for game in BOTS if game != 'glide']
runs = 2
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    page.set_content(build_inline_app(True, embed_assets=True), wait_until='load', timeout=120000)
    page.wait_for_timeout(300)
    page.evaluate(HELPERS)
    for g in games:
        scores = []
        for i in range(runs):
            page.evaluate(SETUP_STATE)
            page.evaluate(f'RizoRuntimeQA.startMiniGame("{g}")')
            page.evaluate('(src)=>{window.__botStep=(new Function(src))(); window.__bot=setInterval(()=>{try{window.__botStep()}catch(e){window.__botErr=String(e)}},40);}', BOTS[g])
            t0 = time.time()
            while page.evaluate('RizoRuntimeQA.arcadeStateForQA().active') and time.time() - t0 < 120:
                page.wait_for_timeout(500)
            page.evaluate('clearInterval(window.__bot)')
            st = page.evaluate('RizoRuntimeQA.arcadeStateForQA()')
            extra = None
            gains = page.evaluate('document.querySelector("[data-training-gains]")?.textContent||""')
            err = page.evaluate('window.__botErr||""')
            scores.append(st['score'])
            print(f'{g:8} run{i+1} score={st["score"]} reason={st["endReason"] or "timeup"} lives={st["lives"]} extra={extra} gains={gains!r} {("ERR "+err) if err else ""}', flush=True)
            page.evaluate('window.__botErr="";document.querySelector("#modalOverlay.show [data-close-modal]")?.click()')
            page.wait_for_timeout(300)
        print(f'== {g} scores {scores}', flush=True)
    b.close()
print('page errors', errors[:5])
