/* Exercise the shipped engine, with only browser storage and timers substituted. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let checks = 0;
function boot(storage = new Map()) {
  const context = vm.createContext({window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    setTimeout:()=>1,clearTimeout:()=>{},btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),console});
  for (const f of ['data/groups','data/elements','data/recipes','data/achievements','engine/game']) {
    vm.runInContext(readFileSync(new URL('../js/'+f+'.js',import.meta.url),'utf8'),context,{filename:f});
  }
  const g = context.window.Rizo; g.load(); return g;
}
function check(name,fn) { fn(); checks++; console.log('PASS '+name); }
function grant(g,ids) { for(const id of ids){g.S.found[id]=1;g.S.groups[g.EL[id].group]=1;} }
const encode = d=>Buffer.from(JSON.stringify(d)).toString('base64');
check('fresh opening and order-independent reactions',()=>{
  const a=boot(),b=boot(); assert.equal(a.countFound(),4); assert.equal(a.groupsFound().join(','),'element');
  assert.equal(a.combine('fire','water').el.id,b.combine('water','fire').el.id);
  assert.equal(a.combine('water','fire').kind,'known');
});
check('all self combinations produce results',()=>{
  const g=boot(); let count=0;
  for(const key of Object.keys(g.PAIR)){const [a,b]=key.split('+');if(a!==b)continue;
    grant(g,[a]);assert.equal(g.combine(a,b).el.id,g.PAIR[key]);count++;}
  assert.equal(count,19);
});
check('known primary still awards missing secondary',()=>{
  const g=boot();
  for(const [key,extras] of Object.entries(g.EXTRA)){
    g.blank(); const [a,b]=key.split('+');grant(g,[a,b,g.PAIR[key]]);
    delete g.S.found[extras[0]];
    const out=g.combine(a,b);assert.equal(out.kind,'new');assert.equal(out.el.id,extras[0]);assert(g.has(extras[0]));
  }
});
check('multi-result reactions carry distinct ordinals and the true last discovery',()=>{
  const g=boot();g.blank();grant(g,['sea','volcano']);
  delete g.S.found.island;delete g.S.found.broth;
  const before=g.countCounted();const out=g.combine('sea','volcano');
  assert.equal(out.kind,'new');assert.equal(out.el.id,'island');assert.equal(out.also[0].el.id,'broth');
  assert.equal(out.foundNumber,before+1);assert.equal(out.also[0].foundNumber,before+2);
  assert.equal(g.S.stats.last,'broth');
});
check('full engine progression reaches all 406 through real reactions',()=>{
  const g=boot();let main=0,full=0,ending=0,domain=0;let previous;
  do {previous=g.countFound();for(const key of Object.keys(g.PAIR)){
    const [a,b]=key.split('+');if(!g.has(a)||!g.has(b))continue;
    const out=g.combine(a,b);main+=!!out.complete;full+=!!out.fullComplete;ending+=!!out.ending;domain+=!!out.newGroup;
  }}while(g.countFound()>previous);
  assert.equal(g.countFound(),406);assert.equal(g.countCounted(),g.TOTAL_COUNTED);assert.equal(main,1);assert.equal(full,1);assert.equal(ending,1);
  assert.equal(g.groupsFound().length,22);assert(domain>0);
  for(const key of Object.keys(g.PAIR)){const [a,b]=key.split('+');assert.notEqual(g.combine(a,b).kind,'new');}
});
check('main and hidden completion each fire exactly once independently',()=>{
  const g=boot();const counted=g.EL_ORDER.filter(id=>!g.EL[id].secret&&!g.STARTERS.includes(id));
  const final=counted.find(id=>g.MADE_BY[id].some(pair=>!pair.includes(id)));
  grant(g,g.EL_ORDER.filter(id=>!g.EL[id].secret&&id!==final));
  const pair=g.MADE_BY[final].find(p=>!p.includes(final));grant(g,pair);
  const out=g.combine(...pair);assert.equal(out.complete,true);assert.equal(out.fullComplete,false);
  const missing=g.EL_ORDER.filter(id=>!g.has(id));let completions=0,full=0;
  for(const id of missing){if(g.has(id))continue;const pair=g.MADE_BY[id].find(p=>!p.includes(id));if(!pair)continue;
    grant(g,pair);const result=g.combine(...pair);completions+=!!result.complete;full+=!!result.fullComplete;}
  assert.equal(completions,0);assert.equal(full,1);
});
check('hints escalate with valid ordinary targets, never reveal postgame secrets',()=>{
  const g=boot(); assert.equal(g.hint().tier,1);assert.equal(g.hint().tier,2);assert.equal(g.hint().tier,3);
  grant(g,g.EL_ORDER.filter(id=>!g.EL[id].secret));g.resetHint();assert.equal(g.hint().kind,'none');
  assert.equal(g.nearNewDomain(),false);
  g.blank();assert.equal(g.hintState().armed,false);assert.equal(g.hint().tier,1);
});
check('new game is actually fresh while preserving player settings',()=>{
  const g=boot();g.S.seenIntro=true;g.S.flags.signalIntro=1;g.S.settings.muted=true;
  g.S.settings.motion=false;g.S.settings.motionUserSet=true;g.combine('fire','water');
  g.blank();
  assert.equal(g.countFound(),4);assert.equal(g.S.seenIntro,false);assert.equal(g.S.flags.signalIntro,undefined);
  assert.equal(g.S.stats.attempts,0);assert.equal(g.S.stats.played,0);assert.equal(g.S.settings.muted,true);
  assert.equal(g.S.settings.motion,false);assert.equal(g.S.settings.motionUserSet,true);
});
check('local save reload and export import retain progress and settings',()=>{
  const storage=new Map(),g=boot(storage);g.combine('fire','water');g.S.favs.steam=1;g.S.settings.muted=true;g.save();
  const loaded=boot(storage);assert(loaded.has('steam'));assert.equal(loaded.S.favs.steam,1);assert.equal(loaded.S.settings.muted,true);
  const other=boot();assert(other.importSave(g.exportSave()));assert(other.has('steam'));assert.equal(other.S.favs.steam,1);
});
check('recent elements and domains preserve discovery chronology through export/import',()=>{
  const g=boot();
  // Unlock craft before world to distinguish chronology from content-table order.
  g.combine('earth','water');g.combine('mud','fire');g.combine('water','water');g.combine('fire','water');
  const original = g.elementsIn({recent:true}).join(',');
  assert.equal(g.elementsIn({recent:true})[0],'steam');
  assert.equal(g.groupsFound().join(','),'element,craft,world');
  g.S.favs.steam=1;assert.equal(g.elementsIn({recent:true,fav:true}).join(','),'steam');
  assert(g.elementsIn({recent:true,q:'steam'}).every(id=>g.EL[id].name.includes('STEAM')));
  const loaded=boot();assert(loaded.importSave(g.exportSave()));
  assert.equal(loaded.elementsIn({recent:true}).join(','),original);
  assert.equal(loaded.groupsFound().join(','),g.groupsFound().join(','));
} );
check('malformed imports are transactional and foreign IDs never leak into state',()=>{
  const g=boot();g.combine('fire','water');const before=JSON.stringify(g.S);
  for(const data of [null,{v:2},{v:1,f:[]},{v:1,f:'fire',r:5},{v:1,f:'fire',s:[]}]){
    assert.equal(g.importSave(encode(data)),false);assert.equal(JSON.stringify(g.S),before);
  }
  assert.equal(g.importSave('definitely not a save'),false);assert.equal(JSON.stringify(g.S),before);
  assert(g.importSave(encode({v:1,f:'fire,steam,ghostid,__proto__',g:'myth,ghost',x:'ghostid,steam',n:'ghostid',r:'ghost+fire',s:{attempts:'NaN'},st:{motion:'false'}})));
  assert.equal(g.countFound(),5);assert.equal(g.groupsFound().includes('myth'),false);assert.equal(g.S.favs.ghostid,undefined);
  assert.equal(Object.keys(g.S.recipes).length,0);assert.equal(g.S.stats.attempts,0);assert.equal(typeof g.S.settings.motion,'boolean');
});
check('failed streak and known attempts award achievements immediately',()=>{
  const g=boot();let out;
  // Use an actually undefined pair, independent of table revisions.
  const key=g.EL_ORDER.flatMap(a=>g.EL_ORDER.map(b=>[a,b])).find(([a,b])=>!g.PAIR[[a,b].sort().join('+')]);
  for(let i=0;i<6;i++)out=g.combine(...key);
  assert(g.S.ach.stubborn);assert(out.ach.some(a=>a.id==='stubborn'));
  g.combine('fire','water');g.S.stats.attempts=599;out=g.combine('water','fire');assert(g.S.ach.grinder);assert(out.ach.some(a=>a.id==='grinder'));
});
check('V7 working set stays compact, useful, and never invents inventory',()=>{
  const g=boot();
  let guard=0;
  while(g.groupsFound().length<6 && guard++<30){
    let changed=false;
    for(const key of Object.keys(g.PAIR)){
      const [a,b]=key.split('+');if(!g.has(a)||!g.has(b))continue;
      const before=g.countFound();g.combine(a,b);if(g.countFound()>before)changed=true;
      if(g.groupsFound().length>=6)break;
    }
    if(!changed)break;
  }
  assert(g.groupsFound().length>=6);
  const smart=g.smartElements(24);
  assert.equal(smart.length,Math.min(24,g.countFound()));
  assert.equal(new Set(smart).size,smart.length);
  assert(smart.every(id=>g.has(id)));
  assert(smart.some(id=>g.elementPotential(id).live>0));
  assert(g.elementsIn({recent:true}).length<=30);
});
check('V7 reports a domain completion on the reaction that actually closes it',()=>{
  const g=boot(); let tested=false;
  outer: for(const gid of g.GROUP_ORDER){
    const ids=g.EL_ORDER.filter(id=>g.EL[id].group===gid&&!g.EL[id].secret);
    if(ids.length<2)continue;
    for(const target of ids){
      const pair=(g.MADE_BY[target]||[]).find(([a,b])=>a!==target&&b!==target);
      if(!pair)continue;
      g.blank(); grant(g,ids.filter(id=>id!==target)); grant(g,pair);
      if(g.has(target))continue;
      const out=g.combine(...pair);
      if(out.kind==='new' && g.has(target) && g.groupComplete(gid)){
        assert(out.completedGroups.includes(gid));tested=true;break outer;
      }
    }
  }
  assert(tested);
});

console.log(`${checks} engine scenarios passed.`);
