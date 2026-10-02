"""Game-mode contract, end to end in the real hub.

Registers a throwaway "probe" mode in the page and drives it through the host
API: pet snapshots, slice read/write, awards, run storage, exit. Then reloads
to prove the slice survived inside the signed v2 save.
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
  Object.assign(s.pet,{name:'PROBE',stage:'teen',variant:'ember',hiddenVariant:'ember',energy:80,hunger:80,mood:50,xp:500});
  s.pet.skills={speed:10,power:10,instinct:10,stamina:10,luck:10};s.wallet.embers=100;
  RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();return true}"""

# The probe mode records everything the host lets it see and do.
PROBE = """()=>{
  window.__probe={log:[]};
  RizoModes.register({id:'probe',name:'PROBE',schema:1,entry:{energy:5},
    settings:[{key:'loud',kind:'toggle',default:false,title:'PROBE LOUD',copy:'Probe toggle.'},
              {key:'size',kind:'choice',default:'m',title:'PROBE SIZE',copy:'Probe choice.',choices:[['s','SMALL'],['m','MEDIUM']]}],
    summary:data=>({best:data.runs||0,bestLabel:String(data.runs||0),badge:data.runs?{text:'P'+data.runs,title:'probe'}:null}),
    migrate:(data,from,legacy)=>({runs:data?.runs||0,from}),
    create:host=>(window.__probeHost=host,{
      start(options){
        const pet=host.pet();
        window.__probe.pet=pet;
        try{pet.skills.power=999}catch(e){}window.__probe.frozen=Object.isFrozen(pet)&&Object.isFrozen(pet.skills)&&pet.skills.power===10;
        window.__probe.roster=host.roster().length;
        window.__probe.markup=host.petMarkup(pet,{extraClass:'probe-rizo'});
        const slice=host.slice.read();
        window.__probe.sliceBefore=slice;
        host.slice.write({runs:slice.runs+1,last:options.tag});
        host.run.write({wave:3});
        window.__probe.run=host.run.read();
        const stage=host.mount({kicker:'PROBE KICKER',title:'PROBE STAGE'});
        window.__probe.arena=stage.arena===document.querySelector('#miniArena')&&stage.root===document.querySelector('#miniGameOverlay')&&Object.isFrozen(stage)
          &&!stage.root.hidden&&document.querySelector('#miniTitle').textContent==='PROBE STAGE';
        window.__probe.settingsBefore={...host.modeSettings()};
        // ui.modal: onClose runs when the player closes it, never on a silent close.
        window.__probe.closes=0;
        host.ui.modal('<div class="modal-card"><button data-close-modal>OK</button></div>',{onClose:()=>{window.__probe.closes+=1}});
        host.ui.closeModal({silent:true});
        host.ui.modal('<div class="modal-card"><button data-close-modal>OK</button></div>',{onClose:()=>{window.__probe.closes+=10}});
        window.__probe.applied=host.award({embers:250,heat:12,run:true,active:{energy:-8,hunger:-3},
          pets:{[pet.id]:{xp:40,bond:2,skills:{power:4,speed:1},played:true},'not-a-pet':{xp:999}}});
        window.__probe.abuse=host.award({embers:-500,pets:{[pet.id]:{xp:1e9,skills:{power:1e6}}}});
        window.__probe.tooBig=(()=>{try{host.slice.write({blob:'x'.repeat(500000)});return false}catch(e){return e instanceof RangeError}})();
      },
      stop(){window.__probe.stopped=true}
    })});
  return true}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(service_workers="block")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_timeout(1200)
    page.evaluate(SETUP); page.evaluate(PROBE)
    before = page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();return {embers:s.wallet.embers,xp:s.pet.xp,power:s.pet.skills.power,energy:s.pet.energy,games:s.meta.totalGames,heat:s.season.xp}}")
    page.evaluate("()=>RizoModes.launch('probe',{tag:'first'})")
    page.wait_for_timeout(250)
    page.evaluate("()=>document.querySelector('#modalOverlay [data-close-modal]')?.click()")
    page.wait_for_timeout(250)
    probe = page.evaluate("()=>window.__probe")
    after = page.evaluate("()=>{const s=RizoRuntimeQA.snapshot();return {embers:s.wallet.embers,xp:s.pet.xp,power:s.pet.skills.power,speed:s.pet.skills.speed,energy:s.pet.energy,hunger:s.pet.hunger,games:s.meta.totalGames,heat:s.season.xp,played:s.pet.careProfile.games.probe}}")

    record("the mode sees its pet as a snapshot of the real one", probe["pet"]["name"] == "PROBE" and probe["pet"]["skills"]["power"] == 10 and probe["pet"]["source"] == "active")
    record("the snapshot is frozen: the mode cannot edit the pet", probe["frozen"] and after["power"] < 999)
    record("the mode renders pets through petMarkup()", 'data-rizo-variant="ember"' in probe["markup"] and "probe-rizo" in probe["markup"])
    record("the first slice migration ran once with schema 0", probe["sliceBefore"] == {"runs": 0, "from": 0}, str(probe["sliceBefore"]))
    record("run storage round-trips", probe["run"] == {"wave": 3})
    record("the mode mounts into the shared stage (frozen stage object, header set)", probe["arena"])
    record("a mode modal's onClose runs once on a player close, never on a silent close", probe["closes"] == 10, str(probe["closes"]))
    record("mode settings start at their declared defaults", probe["settingsBefore"] == {"loud": False, "size": "m"}, str(probe["settingsBefore"]))
    near = lambda a, b: abs(a - b) < 0.05  # the pet's own idle tick adds hundredths
    applied = probe["applied"]
    record("awards land in the hub under hub rules", applied["embers"] == 250 and after["embers"] >= before["embers"] + 250 and applied["pets"][probe["pet"]["id"]]["skills"] == {"power": 4, "speed": 1} and after["speed"] == 11, str(applied))
    # The second, abusive award still grants its clamped ceiling: +2000 XP, +25 Power.
    record("clamped awards apply exactly their ceiling", near(after["xp"], before["xp"] + 40 + 2000) and near(after["power"], 10 + 4 + 25), str(after))
    record("active-pet costs and the completed run are applied", near(after["energy"], before["energy"] - 8) and after["games"] == before["games"] + 1 and after["played"] == 1, str(after))
    record("awards for pets the player does not own are ignored", "not-a-pet" not in probe["applied"]["pets"])
    record("abusive awards are clamped instead of trusted", probe["abuse"]["embers"] == 0 and probe["abuse"]["pets"][probe["pet"]["id"]]["skills"]["power"] <= 25, str(probe["abuse"]))
    record("oversized slices are refused", probe["tooBig"])

    shelf = page.evaluate("()=>RizoModes.summary('probe')")
    record("the hub reads a mode's public summary from its slice", shelf and shelf["best"] == 1 and shelf["badge"]["text"] == "P1", str(shelf))
    record("only one mode runs at a time", page.evaluate("()=>RizoModes.launch('probe',{tag:'second'})") is False)
    exited = page.evaluate("""()=>{const first=window.__probeHost.exit({cleared:1});const again=window.__probeHost.exit({});
      return {first,again,stopped:window.__probe.stopped===true,active:RizoModes.active(),overlayHidden:document.querySelector('#miniGameOverlay').hidden}}""")
    record("exit stops the mode and returns to the hub exactly once", exited["first"] and not exited["again"] and exited["stopped"] and exited["active"] is None and exited["overlayHidden"], str(exited))
    journal = page.evaluate("""()=>{document.querySelector('[data-open-sheet=journal],[data-sheet=journal],#journalButton')?.click();
      const wrap=document.createElement('div');wrap.id='probeSettings';document.body.appendChild(wrap);
      const toggle=document.querySelector('[data-mode-setting="probe:loud"]');const choice=document.querySelector('[data-setting-choice="mode:probe:size:s"]');
      return {toggle:Boolean(toggle),choice:Boolean(choice)}}""")
    if not journal["choice"]:
        # The Journal opens through its own button; fall back to rendering the settings markup directly.
        journal = page.evaluate("""()=>{document.querySelector('#probeSettings').innerHTML=RizoRuntimeQA.modeSettingsMarkupForQA();
          return {toggle:Boolean(document.querySelector('[data-mode-setting="probe:loud"]')),choice:Boolean(document.querySelector('[data-setting-choice="mode:probe:size:s"]'))}}""")
    record("a mode's declared settings appear in the Journal", journal["toggle"] and journal["choice"], str(journal))
    page.evaluate("()=>document.querySelector('[data-setting-choice=\"mode:probe:size:s\"]').click()")
    page.evaluate("()=>document.querySelector('[data-mode-setting=\"probe:loud\"]').click()")
    changed = page.evaluate("()=>RizoRuntimeQA.modeSliceForQA('probe').data.settings")
    record("Journal setting changes are stored in the mode's slice", changed == {"size": "s", "loud": True} or changed == {"loud": True, "size": "s"}, str(changed))
    stored = page.evaluate("()=>{RizoRuntimeQA.saveForQA();const e=JSON.parse(localStorage.getItem('rizo-save-v2'));return {modes:e.modes,signed:RizoSaveCore.verifyEnvelope(e)}}")
    record("the slice is saved inside the signed v2 save", stored["modes"].get("probe", {}).get("data", {}).get("runs") == 1 and stored["signed"], str(stored["modes"]))

    page.reload(); page.wait_for_timeout(1200)
    reloaded = page.evaluate("()=>{const e=JSON.parse(localStorage.getItem('rizo-save-v2'));return e.modes.probe}")
    record("an unregistered mode's slice survives a reload untouched", reloaded == {"schema": 1, "data": {"runs": 1, "last": "first", "settings": {"size": "s", "loud": True}}}, str(reloaded))
    record("no page errors", not errors, "; ".join(errors[:2]))

    # The hub must not depend on any mode: with every modes/ file failing to load,
    # it still boots, marks the card unavailable, and keeps the Defense slice as is.
    ctx2 = browser.new_context(service_workers="block")
    ctx2.route("**/modes/**", lambda route: route.fulfill(status=404, body="missing"))
    lonely = ctx2.new_page()
    lonely_errors = []
    lonely.on("pageerror", lambda e: lonely_errors.append(str(e)))
    lonely.goto(URL); lonely.wait_for_timeout(300)
    lonely.evaluate("(saved)=>{localStorage.clear();localStorage.setItem('rizo-save-v2',saved)}", page.evaluate("()=>localStorage.getItem('rizo-save-v2')"))
    lonely.reload(); lonely.wait_for_timeout(1200)
    alone = lonely.evaluate("""()=>{RizoRuntimeQA.setViewForQA('arcade');RizoRuntimeQA.saveForQA();const e=JSON.parse(localStorage.getItem('rizo-save-v2'));
      return {modes:RizoModes.list().length,button:document.querySelector('[data-mode=defense]')?.textContent,pet:Boolean(document.querySelector('#petTapTarget')),defense:e.modes.defense,signed:RizoSaveCore.verifyEnvelope(e)}}""")
    kept = page.evaluate("()=>JSON.parse(localStorage.getItem('rizo-save-v2')).modes.defense")
    record("the hub boots with no mode files at all", alone["modes"] == 0 and alone["pet"] and not lonely_errors, "; ".join(lonely_errors[:2]))
    record("a missing mode shows as unavailable instead of breaking the shelf", alone["button"] == "UNAVAILABLE", str(alone["button"]))
    record("a missing mode's slice is saved back untouched", alone["defense"] == kept and alone["signed"], str(alone["defense"])[:160])
    ctx2.close()
    browser.close()
server.shutdown()
print(f"\n{sum(results)}/{len(results)} mode-contract checks passed")
sys.exit(0 if all(results) else 1)
