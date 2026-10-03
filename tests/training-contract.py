"""Training contract, end to end in the real hub.

Registers a throwaway "probe" training game in the page and drives it through
the runner: the frozen pet snapshot, the run board, the run clock and jobs
under a pause, an early end, a warm-up run that costs nothing, a credited run
whose growth is exactly RizoTraining.convert(), declared vs. undeclared finds,
the per-game memory, and a game that throws on start.
"""
import functools, http.server, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_address[1]}/index.html"

results = []
def record(name, passed, detail=""):
    results.append(bool(passed)); print(("PASS" if passed else "FAIL"), name, detail)

SETUP = """()=>{const s=RizoRuntimeQA.defaultState();s.introSeen=true;s.player.tutorialDismissed=true;
  Object.assign(s.pet,{name:'PROBE',stage:'teen',variant:'ember',hiddenVariant:'ember',energy:90,hunger:60,mood:50,xp:500,bond:10,resting:false,sleeping:false});
  s.pet.skills={speed:10,power:10,instinct:10,stamina:10,luck:10};s.wallet.embers=100;
  s.farm.featureUnlocked=true;s.farm.unlockSeen=true;
  RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return true}"""

# The probe game records what the runner lets it see and do. Its score is set
# by the test through window.__probeScore so the conversion is exact.
PROBE = """()=>{
  window.__probe={log:[],jobs:0};
  RizoTraining.register({id:'probe',name:'PROBE RUN',kicker:'TEST',art:'?',button:'PROBE',hint:'probe',
    duration:20,energy:10,lives:3,par:40,trains:{speed:3,power:1},care:{bond:.5,mood:1,hunger:-6,hype:.5},alignment:1,
    sounds:{win:'reward',fail:'no'},quest:'train',finds:{treasure:true,variants:['moss']},music:false,
    start(pet,run){
      window.__probeRun=run;
      window.__probe.pet=pet;
      try{pet.skills.power=999}catch(e){}
      window.__probe.frozen=Object.isFrozen(pet)&&Object.isFrozen(pet.skills);
      window.__probe.board=Object.keys(run.state).sort();
      window.__probe.lives=[run.state.lives,run.state.maxLives];
      run.arena.innerHTML='<div id="probeWorld">'+run.petMarkup('probe-rizo')+'</div>';
      window.__probe.markup=run.arena.innerHTML;
      window.__probe.memoryBefore=run.memory();
      window.__probe.remembered=run.remember({bag:['a','b']});
      window.__probe.tooBig=run.remember({blob:'x'.repeat(5000)});
      run.every(100,()=>{window.__probe.jobs+=1;});
    },
    stop(){window.__probe.stopped=(window.__probe.stopped||0)+1;},
    input(){window.__probe.inputs=(window.__probe.inputs||0)+1;},
    qualified:b=>b.score>=5,
    result:b=>({stats:[{label:'PROBE SCORE',value:b.score}],voice:{headline:'PROBED',line:'THE PROBE CAME HOME.'},
      finds:{treasure:true,treasureForce:true,variants:[{id:'shadow',chance:1},{id:'moss',chance:0}]}})
  });
  return true}"""

SNAP = """()=>{const s=RizoRuntimeQA.snapshot();return {embers:s.wallet.embers,xp:s.pet.xp,speed:s.pet.skills.speed,power:s.pet.skills.power,
  energy:s.pet.energy,hunger:s.pet.hunger,mood:s.pet.mood,bond:s.pet.bond,hype:s.pet.hype,games:s.meta.totalGames,best:s.scores.probe||0,
  shadow:Boolean(s.collection.shadow),treasures:Object.values(s.treasures||{}).reduce((a,b)=>a+b,0),memory:s.trainingMemory?.probe||null,
  played:s.pet.careProfile.games.probe||0}}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(service_workers="block")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_timeout(1200)
    page.evaluate(SETUP); page.evaluate(PROBE)

    # ---- a warm-up run: the game says it doesn't qualify; nothing is spent
    before = page.evaluate(SNAP)
    page.evaluate("()=>RizoRuntimeQA.startMiniGame('probe')")
    page.wait_for_timeout(200)
    probe = page.evaluate("()=>window.__probe")
    record("the game sees a frozen snapshot of its pet", probe["pet"]["name"] == "PROBE" and probe["frozen"] and page.evaluate(SNAP)["power"] < 999)
    record("the run board carries the runner's fields", all(k in probe["board"] for k in ("score", "hits", "playerInputs", "lives", "maxLives", "endReason", "endAt", "entities")), str(probe["board"]))
    record("hearts come from the definition", probe["lives"] == [3, 3], str(probe["lives"]))
    record("the game draws its Rizo through petMarkup()", 'data-rizo-variant="ember"' in probe["markup"] and "probe-rizo" in probe["markup"])
    record("per-game memory is written, and capped at 4 KB", probe["remembered"] is True and probe["tooBig"] is False)
    jobs_before = page.evaluate("()=>window.__probe.jobs")
    record("run.every jobs fire on the run clock", jobs_before > 0, str(jobs_before))

    # ---- pause: the clock, the jobs and the deadline stand still
    page.evaluate("RizoRuntimeQA.arcadePauseForQA()")
    held = page.evaluate("()=>({jobs:window.__probe.jobs, now:window.__probeRun.now(), left:RizoRuntimeQA.arcadeClockForQA().remaining})")
    page.wait_for_timeout(700)
    later = page.evaluate("()=>({jobs:window.__probe.jobs, now:window.__probeRun.now(), left:RizoRuntimeQA.arcadeClockForQA().remaining})")
    record("a paused run's clock stands still", later["now"] == held["now"] and abs(later["left"] - held["left"]) < 1, str((held, later)))
    record("a paused run fires no jobs", later["jobs"] == held["jobs"], str((held["jobs"], later["jobs"])))
    page.evaluate("RizoRuntimeQA.arcadeResumeForQA()")
    page.wait_for_timeout(300)
    record("resuming re-arms the jobs", page.evaluate("()=>window.__probe.jobs") > later["jobs"])

    page.evaluate("()=>{window.__probeRun.state.score=3;}")
    page.evaluate("()=>window.__probeRun.end('death')")
    page.wait_for_timeout(250)
    after = page.evaluate(SNAP)
    modal = page.evaluate("()=>document.querySelector('#modalOverlay.show .modal-card')?.className||''")
    record("run.end() ends the run at once, and stop() runs exactly once", "arcade-no-credit" in modal and page.evaluate("()=>window.__probe.stopped") == 1, modal)
    rewards = lambda snap: {k: v for k, v in snap.items() if k != "memory"}  # the probe wrote its own memory on start
    record("a warm-up run spends and earns nothing", rewards(after) == rewards(before), str((before, after)))
    record("a finished run leaves no jobs behind", page.evaluate("()=>RizoRuntimeQA.arcadeJobsForQA().count") == 0)
    page.evaluate("()=>document.querySelector('#modalOverlay.show [data-close-modal]')?.click()")
    page.wait_for_timeout(300)

    # ---- a credited run: growth is exactly convert(), plus the declared extras
    before = page.evaluate(SNAP)
    page.evaluate("()=>RizoRuntimeQA.startMiniGame('probe')")
    page.wait_for_timeout(150)
    page.evaluate("()=>{window.__probeRun.state.score=40;window.__probeRun.state.playerInputs=4;RizoRuntimeQA.arcadeAdvanceClockForQA(999999);}")
    page.wait_for_timeout(300)
    after = page.evaluate(SNAP)
    gains = page.evaluate("()=>RizoRuntimeQA.trainingConvertForQA('probe',40)")
    near = lambda a, b: abs(a - b) < .05
    record("Energy, XP and Embers move by exactly the conversion",
           near(after["energy"] - before["energy"], -10) and near(after["xp"] - before["xp"], gains["xp"]) and after["embers"] - before["embers"] >= gains["embers"], str((gains, before, after)))
    record("skills grow by the conversion's split", near(after["speed"] - before["speed"], gains["skills"]["speed"]) and near(after["power"] - before["power"], gains["skills"]["power"]), str(gains["skills"]))
    record("bond, mood, hunger and hype follow the game's care weights",
           near(after["bond"] - before["bond"], gains["bond"]) and near(after["hunger"] - before["hunger"], -6) and near(after["hype"] - before["hype"], gains["hype"]), str(gains))
    record("the best score, games played and care history are recorded", after["best"] == 40 and after["games"] == before["games"] + 1 and after["played"] == before["played"] + 1)
    record("a declared treasure find is honoured", after["treasures"] == before["treasures"] + 1)
    record("an undeclared rare find is refused even at 100% odds", not after["shadow"])
    record("the per-game memory is saved with the pet's save", after["memory"] == {"bag": ["a", "b"]}, str(after["memory"]))
    shown = page.evaluate("()=>({stats:document.querySelector('.arcade-result-grid')?.innerText||'',line:document.querySelector('.arcade-result .big-line')?.textContent||'',gains:document.querySelector('[data-training-gains]')?.textContent||''})")
    record("the results screen shows the game's stats, voice and the growth", "PROBE SCORE" in shown["stats"] and "THE PROBE CAME HOME." in shown["line"] and "SPEED" in shown["gains"], str(shown))
    page.evaluate("()=>document.querySelector('#modalOverlay.show [data-close-modal]')?.click()")
    page.wait_for_timeout(300)

    # ---- a game that throws on start costs nothing
    page.evaluate("""()=>{RizoTraining.register({id:'broken',name:'BROKEN',duration:20,energy:10,par:10,trains:{luck:1},
      start(){throw new Error('boom')},stop(){},qualified:()=>true,result:()=>({})});return true}""")
    before = page.evaluate(SNAP)
    started = page.evaluate("()=>{try{return RizoRuntimeQA.startMiniGame('broken')}catch(e){return 'threw'}}")
    page.wait_for_timeout(200)
    after = page.evaluate(SNAP)
    record("a game that fails to start spends nothing and leaves no run", started is False and after == before and not page.evaluate("()=>RizoRuntimeQA.arcadeStateForQA().active"), str(started))
    record("no page errors", not errors, "; ".join(errors[:2]))
    browser.close()
server.shutdown()
print(f"\n{sum(results)}/{len(results)} training-contract checks passed")
sys.exit(0 if all(results) else 1)
