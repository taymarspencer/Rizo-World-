/* V8 care-pass invariants: remembered mistakes, relational routes, breathing structure. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url).pathname;
const html=readFileSync(join(root,'index.html'),'utf8');
const game=readFileSync(join(root,'js/engine/game.js'),'utf8');
const ui=readFileSync(join(root,'js/ui/ui.js'),'utf8');
const moments=readFileSync(join(root,'js/ui/moments.js'),'utf8');
const sheets=readFileSync(join(root,'js/ui/sheets.js'),'utf8');
const audio=readFileSync(join(root,'js/engine/audio.js'),'utf8');
const css=readFileSync(join(root,'css/rizo.css'),'utf8');

let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function boot(storage=new Map()){
  const context=vm.createContext({window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    setTimeout:()=>1,clearTimeout:()=>{},btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),console});
  for(const f of ['data/groups','data/elements','data/recipes','data/achievements','engine/game'])
    vm.runInContext(readFileSync(join(root,'js/'+f+'.js'),'utf8'),context,{filename:f});
  const g=context.window.Rizo;g.load();return g;
}
function grant(g,ids){for(const id of ids){g.S.found[id]=1;g.S.groups[g.EL[id].group]=1;}}

check('V8 relational presentation survives the newer cache-bust',()=>{
  assert(/css\/rizo\.css\?v=(?:[89]|1\d)/.test(html));
  for(const file of ['audio','game']) assert(new RegExp('js/engine/'+file+'\\.js\\?v=(?:[89]|1\\d)').test(html));
  for(const file of ['ui','moments','sheets']) assert(new RegExp('js/ui/'+file+'\\.js\\?v=(?:[89]|1\\d)').test(html));
  assert(/js\/main\.js\?v=(?:[89]|1\d)/.test(html));
  assert(ui.includes('TWO ROADS. ONE THING.'));
  assert(ui.includes("R.has('confluence')?'CONFLUENCE.':'BOTH HELD.'"));
  assert(moments.includes('THE MISSING PIECE WAS THE RELATIONSHIP.'));
  assert(sheets.includes('TWO THINGS CAN BE TRUE.'));
  assert(sheets.includes('THE SHAPE SHOULD BREATHE.'));
  assert(sheets.includes('THE MAP CAN COME AFTER THE TERRITORY.'));
  assert(sheets.includes('NO THRONE. STILL IN CHARGE.'));
  assert(css.includes('.el.scar.material'));
});

check('confluence cue exists and is a real WAV with media and synth fallback',()=>{
  const f=join(root,'assets/audio/confluence-v8.wav');assert(existsSync(f));
  const b=readFileSync(f);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert(b.length>1000);
  assert(audio.includes("confluence:'confluence-v8.wav'"));
  assert(audio.includes('confluence:'));
});

check('a dead end becomes persistent player memory, not disabled content',()=>{
  const storage=new Map(),g=boot(storage);
  const ids=g.EL_ORDER.slice(0,80);
  let pair=null;
  outer:for(let i=0;i<ids.length;i++)for(let j=i;j<ids.length;j++){
    const a=ids[i],b=ids[j],key=[a,b].sort().join('+');
    if(!g.PAIR[key]){pair=[a,b];break outer;}
  }
  assert(pair,'expected at least one undefined pair');grant(g,pair);
  const first=g.combine(...pair);assert.equal(first.kind,'none');assert.equal(first.deadNew,true);assert(g.triedDead(...pair));
  const second=g.combine(...pair);assert.equal(second.kind,'none');assert.equal(second.deadNew,false);
  const save=g.exportSave();
  const loaded=boot();assert(loaded.importSave(save));assert(loaded.triedDead(...pair));
  assert(loaded.deadPairsFor(pair[0]).length>=1);
});

check('an imported scar can never override a real recipe',()=>{
  const g=boot();
  const payload={v:1,f:'fire,water,earth,air',g:'element',r:'',n:'',x:'',a:'',d:'fire+water',s:{attempts:0,fails:0,hits:0,hints:0,started:1,played:0,last:''},fl:{},rv:0,en:0,si:0,st:{muted:false,motion:true,motionUserSet:true}};
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64');
  assert(g.importSave(encoded));assert.equal(g.triedDead('fire','water'),false);
  assert.equal(g.combine('fire','water').kind,'new');
});

check('multiple valid origins can coexist and become a confluence',()=>{
  const g=boot();g.blank();
  const routes=g.MADE_BY.empire;assert(routes&&routes.length>=2);
  grant(g,['empire',...routes[0],...routes[1]]);
  const a=g.combine(...routes[0]);assert.equal(a.kind,'route');assert.equal(a.routeCount,1);
  const b=g.combine(...routes[1]);assert.equal(b.kind,'route');assert.equal(b.routeCount,2);
  assert.equal(g.routesTo('empire').length,2);assert(g.confluenceCount()>=1);
  assert.deepEqual(Array.from(new Set(g.routesTo('empire').map(r=>r.key))).length,2);
});

check('working-set structure breathes instead of freezing at one size',()=>{
  const g=boot();
  const groups=g.GROUP_ORDER;
  const setN=n=>{g.S.groups={};for(const id of groups.slice(0,n))g.S.groups[id]=1;};
  setN(6);assert.equal(g.smartLimit(),18);
  setN(8);assert.equal(g.smartLimit(),21);
  setN(12);assert.equal(g.smartLimit(),24);
  setN(16);assert.equal(g.smartLimit(),26);
  setN(20);assert.equal(g.smartLimit(),28);
});

check('selected-piece smart sort remembers only the player own dead-end history',()=>{
  const g=boot();
  // Grow a broad owned set without altering recipe discovery history.
  grant(g,g.EL_ORDER.slice(0,90));
  const focus=g.EL_ORDER[0];
  const base=g.smartElements(90,focus);
  let moved=false;
  for(const candidate of base){
    if(candidate===focus || g.PAIR[[focus,candidate].sort().join('+')]) continue;
    const key=[focus,candidate].sort().join('+'), beforeIx=base.indexOf(candidate);
    g.S.dead[key]=1;
    const after=g.smartElements(90,focus);
    delete g.S.dead[key];
    if(after.indexOf(candidate)>beforeIx){moved=true;break;}
  }
  assert(moved,'remembered dead pair should be capable of drifting backward without exposing a recipe');
});

check('relational state survives export/import',()=>{
  const g=boot();g.blank();const routes=g.MADE_BY.empire;grant(g,['empire',...routes[0],...routes[1]]);
  g.combine(...routes[0]);g.combine(...routes[1]);g.S.flags.relationIntro=1;
  const loaded=boot();assert(loaded.importSave(g.exportSave()));
  assert.equal(loaded.routesTo('empire').length,2);assert.equal(loaded.S.flags.relationIntro,1);assert(loaded.confluenceCount()>=1);
});

console.log(checks+' V8 care-pass scenarios passed.');
