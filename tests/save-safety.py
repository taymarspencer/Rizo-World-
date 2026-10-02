"""Save safety and old-save migration, against the real build.

Boots index.html over a local HTTP server with real localStorage, seeded with
saves written by older builds (and by this one), then checks what survived.
Covers audit findings C1-C4, H2, M2, M3 and the reset bug. Every scenario
must keep the player's data somewhere: loaded, untouched in its old key, or
set aside in a quarantine record.
"""
import functools, http.server, json, socketserver, subprocess, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
V1 = "rizo-life-overhaul-v2"
V1_BACKUP = f"{V1}:verified-backup-v1"
V2 = "rizo-save-v2"
V2_BACKUP = "rizo-save-v2:backup"
CHECKPOINT = f"{V1}:defense-checkpoint-v68"

# Fixtures are signed with the real cores, exactly as older builds wrote them.
FIXTURES = subprocess.run(["node", "-e", r"""
const path=require('path'),root=process.argv[1];
const Save=require(path.join(root,'core/rizo-save-core.js'));
const Defense=require(path.join(root,'defense-core-v79.js'));
const fx=require(path.join(root,'tests/fixtures/v86-live-checkpoint.json'));
const t=Date.now()-2*3600e3;
function livedIn(){
  const s=JSON.parse(JSON.stringify(fx.state));
  Object.assign(s.player,{lastActive:t,lastSessionAt:t,streak:9,totalSessions:41});
  s.wallet={embers:4321,shards:17};
  Object.assign(s.pet,{name:'MOSSY',xp:1500,bond:61,stage:'beast',lastTick:t,accessory:'crown'});
  s.pet.skills={speed:40,power:55,instinct:33,stamina:47,luck:12};
  s.inventory.accessories=['none','crown','beanie'];
  Object.assign(s.scores,{power:88,glide:61,rhythm:72,defense:23,defenseMaps:{grove:23,ember:11},defenseMilestones:[10]});
  s.collection={classic:1,ember:2};s.meta.totalGames=140;
  return s;
}
const v1=(state,savedAt=Date.now()-3600e3)=>({app:'RIZO LIFE',saveVersion:1,stateVersion:19,savedAt,state,signature:Save.createStateSignatureV1(state,savedAt)});
const legacy=livedIn();legacy.version=12;delete legacy.player.defenseSchool;delete legacy.musicHistory;delete legacy.farm;
const tampered=v1(livedIn());tampered.state.wallet.embers=999999;
const v2=Save.createEnvelope({state:livedIn(),modes:{},savedAt:Date.now()-3600e3,writeId:'W-FIXTURE',stateVersion:19});
const future={...v2,saveVersion:3,signature:'s3.future'};
function checkpoint(age){const c=JSON.parse(JSON.stringify(fx.checkpoint));c.savedAt=Date.now()-age;c.keeperId=fx.state.player.keeperId;c.signature=Defense.createSaveSignature(c,c.checkpointVersion);return JSON.stringify(c);}
console.log(JSON.stringify({signedV1:JSON.stringify(v1(livedIn())),legacy:JSON.stringify(legacy),tampered:JSON.stringify(tampered),raw19:JSON.stringify(livedIn()),v2:JSON.stringify(v2),future:JSON.stringify(future),checkpoint1h:checkpoint(3600e3),checkpoint8d:checkpoint(8*86400e3)}));
""", str(ROOT)], capture_output=True, text=True, check=True).stdout
F = json.loads(FIXTURES)
cut = lambda text: text[:900]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/index.html"

results = []
def record(name, passed, detail=""):
    results.append(bool(passed)); print(("PASS" if passed else "FAIL"), name, detail)

SEED = "(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.clear();const seed=%s;for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);})()"
READ = """()=>{
  const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
  const v2=read('rizo-save-v2'),s=v2&&v2.state;
  const quarantine=Object.keys(localStorage).filter(k=>k.startsWith('rizo-save-quarantine:')).map(k=>read(k));
  let warning=null;try{warning=JSON.parse(localStorage.getItem('rizo-life-overhaul-v2:save-validation-warning'))?.kind||null}catch(e){}
  return {saveVersion:v2?.saveVersion||0,embers:s?.wallet?.embers,name:s?.pet?.name,stage:s?.pet?.stage,defense:s?.scores?.defense,games:s?.meta?.totalGames,
    v1:localStorage.getItem('rizo-life-overhaul-v2'),quarantine,warning,blocked:Boolean(document.querySelector('#rizoSaveBlocked:not([hidden])')),
    blockedText:document.querySelector('#rizoSaveBlocked h2')?.textContent||'',v2Raw:localStorage.getItem('rizo-save-v2')};
}"""

def boot(browser, seed, wait=1300):
    ctx = browser.new_context(service_workers="block")
    ctx.add_init_script(SEED % json.dumps(seed))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(URL); page.wait_for_timeout(wait)
    return ctx, page, errors

def kept(r):
    return r["embers"] == 4321 and r["name"] == "MOSSY" and r["defense"] == 23 and r["games"] == 140

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- Migration from every older save format ----
    ctx, page, errors = boot(browser, {V1: F["signedV1"], V1_BACKUP: F["signedV1"]}); r = page.evaluate(READ)
    record("signed v1 save migrates to v2 with every record kept", kept(r) and r["saveVersion"] == 2, str({k: r[k] for k in ("embers", "name", "defense", "saveVersion")}))
    record("v1 save is left byte-identical as the rollback copy", r["v1"] == F["signedV1"])
    record("normal boot has no page errors", not errors, "; ".join(errors[:2])); ctx.close()

    ctx, page, _ = boot(browser, {V1: F["legacy"]}); r = page.evaluate(READ)
    record("raw pre-v66 save (state v12) migrates with every record kept", kept(r)); ctx.close()

    ctx, page, _ = boot(browser, {"rizo-life-save-v1": F["legacy"]}); r = page.evaluate(READ)
    record("orphaned rizo-life-save-v1 key is migrated instead of ignored (M2)", kept(r)); ctx.close()

    # ---- C1/C2: broken or missing primary ----
    ctx, page, _ = boot(browser, {V1: cut(F["signedV1"]), V1_BACKUP: F["signedV1"]}); r = page.evaluate(READ)
    record("truncated v1 primary recovers from its backup", kept(r), str(r["warning"])); ctx.close()

    ctx, page, _ = boot(browser, {V1_BACKUP: F["signedV1"]}); r = page.evaluate(READ)
    record("missing v1 primary falls back to the backup (C2)", kept(r)); ctx.close()

    ctx, page, _ = boot(browser, {V1: cut(F["signedV1"])}); r = page.evaluate(READ)
    record("unreadable v1 save with no backup is never overwritten (C1)", r["v1"] == cut(F["signedV1"]) and r["name"] != "MOSSY", str(r["warning"])); ctx.close()

    ctx, page, _ = boot(browser, {V2: cut(F["v2"]), V2_BACKUP: F["v2"]}); r = page.evaluate(READ)
    q = r["quarantine"]
    record("truncated v2 primary recovers from the v2 backup", kept(r), str(r["warning"]))
    record("the truncated v2 primary is set aside before the overwrite", len(q) == 1 and q[0]["entries"][0]["text"] == cut(F["v2"]), str(len(q))); ctx.close()

    ctx, page, _ = boot(browser, {V2: cut(F["v2"])}); r = page.evaluate(READ)
    q = r["quarantine"]
    record("unreadable v2 save with nothing else is set aside, not destroyed (C1)", len(q) == 1 and q[0]["entries"][0]["text"] == cut(F["v2"]) and r["name"] != "MOSSY"); ctx.close()

    ctx, page, _ = boot(browser, {V2_BACKUP: F["v2"]}); r = page.evaluate(READ)
    record("missing v2 primary uses the v2 backup (C2)", kept(r) and r["warning"] == "primary-missing-recovered", str(r["warning"])); ctx.close()

    ctx, page, _ = boot(browser, {V2: cut(F["v2"]), V1: F["signedV1"]}); r = page.evaluate(READ)
    record("broken v2 with no v2 backup falls back to the frozen v1 copy", kept(r) and len(r["quarantine"]) == 1, str(r["warning"])); ctx.close()

    # ---- H1: unverifiable saves still reset rewards, but the bytes survive ----
    ctx, page, _ = boot(browser, {V1: F["tampered"], V1_BACKUP: F["tampered"]}); r = page.evaluate(READ)
    record("tampered v1 save resets rewards but its original bytes stay untouched", r["embers"] == 100 and r["name"] == "MOSSY" and r["v1"] == F["tampered"]); ctx.close()

    # ---- Newer-build saves are never touched ----
    ctx, page, _ = boot(browser, {V2: F["future"]}); r = page.evaluate(READ)
    record("a save from a newer build blocks this build instead of being rewritten", r["blocked"] and r["v2Raw"] == F["future"], r["blockedText"]); ctx.close()

    # ---- C4: Defense runs no longer expire ----
    for label, key in (("1 hour", "checkpoint1h"), ("8 days", "checkpoint8d")):
        ctx, page, _ = boot(browser, {V1: F["signedV1"], V1_BACKUP: F["signedV1"], CHECKPOINT: F[key]})
        seen = page.evaluate("()=>window.RizoRuntimeQA.showDefenseLobbyForQA('auto').checkpoint")
        stored = page.evaluate("()=>Boolean(localStorage.getItem('rizo-life-overhaul-v2:defense-checkpoint-v68'))")
        record(f"a Defense run left for {label} is still resumable (C4)", seen and stored); ctx.close()

    # ---- C3: two tabs ----
    ctx = browser.new_context(service_workers="block")
    ctx.add_init_script("(()=>{if(localStorage.getItem('rizo-life-overhaul-v2'))return;const seed=%s;for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);})()" % json.dumps({V1: F["signedV1"], V1_BACKUP: F["signedV1"]}))
    tab_a = ctx.new_page(); tab_a.goto(URL); tab_a.wait_for_timeout(1200)
    tab_b = ctx.new_page(); tab_b.goto(URL); tab_b.wait_for_timeout(1200)
    # Opening tab B makes it the newest copy, so tab A (still holding its old
    # state, and still running its 5-second autosave) is now the stale one.
    tab_b.evaluate("()=>{const s=RizoRuntimeQA.snapshot();s.wallet.embers+=5000;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.saveForQA();}")
    tab_a.bring_to_front(); tab_a.wait_for_timeout(6500)
    tab_a.evaluate("()=>{try{window.dispatchEvent(new Event('beforeunload'))}catch(e){}}")
    r = tab_b.evaluate(READ); ra = tab_a.evaluate(READ)
    record("a stale tab never overwrites newer progress from another tab (C3)", r["embers"] == 9321, str(r["embers"]))
    record("the stale tab says why it stopped saving", ra["blocked"] and "SOMEWHERE ELSE" in ra["blockedText"], ra["blockedText"])
    record("the tab holding the newest progress keeps saving", not r["blocked"] and tab_b.evaluate("()=>RizoRuntimeQA.saveForQA()") is not None)
    ctx.close()

    # ---- Reset really resets ----
    ctx, page, _ = boot(browser, {V1: F["signedV1"], V1_BACKUP: F["signedV1"]})
    page.evaluate("()=>{const b=document.createElement('button');b.setAttribute('data-reset-save','');document.body.appendChild(b);b.click();}")
    page.wait_for_timeout(2200); r = page.evaluate(READ)
    record("Reset deletes the save instead of writing it back on unload", r["name"] != "MOSSY" and r["v1"] is None, str(r["name"])); ctx.close()

    # ---- Import keeps the replaced timeline restorable (M3) ----
    ctx, page, _ = boot(browser, {V1: F["signedV1"], V1_BACKUP: F["signedV1"]})
    page.set_input_files("#importSaveInput", files=[{"name": "other.json", "mimeType": "application/json", "buffer": F["raw19"].replace("MOSSY", "IMPORTED").encode()}])
    page.wait_for_timeout(600)
    backup = page.evaluate("()=>RizoRuntimeQA.preRecoveryForQA()")
    record("import keeps the replaced timeline as a restorable device backup (M3)", backup and backup["name"] == "MOSSY", str(backup)); ctx.close()

    # ---- H2: the House is passive ----
    ctx, page, _ = boot(browser, {V1: F["signedV1"], V1_BACKUP: F["signedV1"]})
    page.evaluate("""()=>{const s=RizoRuntimeQA.snapshot();const h=JSON.parse(JSON.stringify(s.pet));
      Object.assign(h,{id:'PET-HOUSE-1',number:2,name:'LODGER',variant:'ember',hiddenVariant:'ember',stage:'teen',hunger:90,mood:90,energy:90,hygiene:90,health:100,lastTick:Date.now()-5*86400e3,homeRoom:0});
      s.farm.roster=[h];s.farm.featureUnlocked=true;s.farm.unlockSeen=true;RizoRuntimeQA.loadForQA(s);RizoRuntimeQA.setViewForQA&&RizoRuntimeQA.setViewForQA('farm');}""")
    page.wait_for_timeout(300)
    page.evaluate("()=>document.querySelector('[data-house-pet-detail=\"0\"]')?.click()"); page.wait_for_timeout(300)
    page.evaluate("()=>document.querySelector('[data-farm-swap=\"0\"]')?.click()"); page.wait_for_timeout(400)
    pet = page.evaluate("()=>{const p=RizoRuntimeQA.snapshot().pet;return {name:p.name,hunger:Math.round(p.hunger),health:Math.round(p.health),resting:p.resting}}")
    record("a House resident comes back as it left, not neglected (H2)", pet["name"] == "LODGER" and pet["hunger"] >= 88 and pet["health"] >= 99 and not pet["resting"], str(pet)); ctx.close()

    browser.close()
server.shutdown()
print(f"\n{sum(results)}/{len(results)} save-safety checks passed")
sys.exit(0 if all(results) else 1)
