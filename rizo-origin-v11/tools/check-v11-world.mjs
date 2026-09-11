/* V11 PHASE 2 — living world invariants.
   The environment is a pure function of the discovered set, so it can be tested
   without a browser. These assertions are about relationships, not pixels. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = f => readFileSync(new URL('../'+f, import.meta.url),'utf8');

/* minimal host: enough surface for the module to install itself */
function boot(found){
  const noop=()=>{};
  const el=()=>({classList:{toggle:noop,add:noop,remove:noop,contains:()=>false},style:{setProperty:noop},dataset:{},
    appendChild:noop,prepend:noop,insertBefore:noop,querySelector:()=>null,getBoundingClientRect:()=>({width:0,height:0}),
    isConnected:true,setAttribute:noop,getContext:()=>null,addEventListener:noop});
  const ctx={ console, performance:{now:()=>0}, setTimeout:()=>0, clearTimeout:noop,
    requestAnimationFrame:()=>0, cancelAnimationFrame:noop, Math, Date, Object, Array, Number, String, Boolean, JSON };
  ctx.window=ctx;
  ctx.document={ hidden:false, body:{classList:{toggle:noop,add:noop,remove:noop},dataset:{},firstChild:null,insertBefore:noop},
    getElementById:()=>null, createElement:el, addEventListener:noop };
  ctx.window.addEventListener=noop;
  ctx.window.innerWidth=1280;
  ctx.window.ResizeObserver=null;
  ctx.window.devicePixelRatio=1;
  vm.createContext(ctx);
  vm.runInContext(read('js/data/groups.js'),ctx);
  vm.runInContext(read('js/data/elements.js'),ctx);
  vm.runInContext(read('js/data/recipes.js'),ctx);
  vm.runInContext(read('js/data/achievements.js'),ctx);
  const F={}; found.forEach(id=>F[id]=1);
  ctx.window.Rizo={ S:{ found:F, settings:{motion:true}, stats:{fails:0} }, countCounted:()=>found.length,
    EL_ORDER:[], EL:{}, GROUPS:{}, GROUP_ORDER:[] };
  vm.runInContext(read('js/ui/world.js'),ctx);
  const api=ctx.window.RizoWorld;
  api.__setFails=n=>{ ctx.window.Rizo.S.stats.fails=n; };
  return api;
}

const fails=[]; let n=0;
function ok(name,cond){ n++; if(!cond) fails.push(name); }
const base=['fire','water','earth','air'];
const W=(...extra)=>boot(base.concat(extra)).derive();

/* ── a new save is dirt ────────────────────────────────────────────────── */
const dirt=boot(base);
const d=dirt.derive();
ok('fresh save has no sea',        !d.seaOn);
ok('fresh save has no life',       !d.life);
ok('fresh save has no city',       !d.city);
ok('fresh save has no deep field', d.deep===0 && !d.space);
ok('fresh save reads as dirt',     dirt.age(d)==='dirt');
ok('fresh save weighs almost nothing', dirt.weigh(d)<=1);
const W2=(...e)=>boot(base.concat(e));
ok('era is crossed, not counted',
   W2('sea').age(W('sea'))==='terrain' &&
   W2('life').age(W('life'))==='living' &&
   W2('human').age(W('human'))==='settled' &&
   W2('engine').age(W('engine'))==='built' &&
   W2('engine','space').age(W('engine','space'))==='deep' &&
   W2('rizo').age(W('rizo'))==='signed');
ok('stars over an empty world are not "deep"',
   W2('sea','star','space').age(W('sea','star','space'))==='terrain');
ok('stars over a built world are',
   W2('sea','city','electricity','space').age(W('sea','city','electricity','space'))==='deep');
ok('an early build with real geology is visible, not hidden',
   W2('sea','mountain','volcano').weigh(W('sea','mountain','volcano'))>=5);
ok('weight keeps climbing with systems',
   W2('sea','life','city','engine','space','rizo').weigh(W('sea','life','city','engine','space','rizo')) >
   W2('sea','life').weigh(W('sea','life')));

/* ── determinism: the same set rebuilds the same world ─────────────────── */
const setA=['sea','moon','life','city','electricity'];
ok('derivation is deterministic',
   JSON.stringify(W(...setA))===JSON.stringify(W(...[...setA].reverse())));

/* ── SEA: one system, many readings ────────────────────────────────────── */
const sea=W('sea');
ok('sea exists',                   sea.seaOn && sea.sea>0);
ok('a lone sea has no tide',       !sea.tide);
ok('a lone sea is not rough',      !sea.rough);
ok('a lone sea has no life on it', !sea.shoreLife);
const seaMoon=W('sea','moon');
ok('SEA + MOON makes tides',       seaMoon.tide);
ok('SEA + MOON raises the swell',  seaMoon.swell>sea.swell);
ok('SEA + MOON reflects at night', seaMoon.reflect);
const seaStorm=W('sea','storm');
ok('SEA + STORM turns rough',      seaStorm.rough);
ok('SEA + STORM raises the swell', seaStorm.swell>sea.swell);
ok('SEA + LIFE grows a shoreline', W('sea','life').shoreLife);
ok('SEA + CITY builds a harbour',  W('sea','city').harbour);
ok('SEA + ICE freezes',            W('sea','ice','snow').frozen);
ok('SEA + VOLCANO vents steam',    W('sea','volcano').steamVent);
ok('a sea with no moon does not pretend to have one', !W('sea','storm').tide);

/* ── LIFE is a threshold, not a prop ───────────────────────────────────── */
ok('nothing is organic before LIFE', W('plant','tree','forest').organic===0);
ok('LIFE makes the world organic',   W('life').organic>0);
ok('life near water differs from life in the dry',
   W('life','sea').organic>W('life').organic);
ok('FOREST + WIND sways',            W('life','forest','wind','storm').sway);
ok('FOREST without wind is still',   !W('life','forest').sway);
ok('FOREST + FIRE scars but keeps the forest',
   W('life','forest').forest && W('life','forest','fire').scar);
ok('FOREST + CITY clears, does not delete',
   W('life','forest','city').forest && W('life','forest','city').clearing);

/* ── civilisation is upgraded, not replaced ────────────────────────────── */
const city=W('city');
ok('an unpowered city has no lights', !city.lit && !city.lamps);
ok('CITY + ELECTRICITY powers it',    W('city','electricity').lit);
ok('CITY + NIGHT lights windows',     W('city','electricity','night').lamps);
ok('CITY + SIGNAL moves traffic',     W('city','internet').traffic);
ok('CITY + MACHINE raises stacks',    W('city','engine').stacks);
ok('ELECTRICITY alone lights nothing',!W('electricity').lit);
ok('AI + SIGNAL goes autonomous',     W('ai','internet').autonomous);
ok('AI without a network is quiet',   !W('ai').autonomous);

/* ── things that outlive the thing that made them ─────────────────────── */
ok('HUMAN lights a fire that stays',   W('human').camp);
ok('a settlement keeps the fire too',  W('village').camp);
ok('no people, no campfire',           !W('sea','forest').camp);
ok('the fire survives the city',       W('human','city').camp);
ok('RIVER + ICE stops running',        W('river','ice').riverIce);
ok('a warm river still runs',          !W('river').riverIce);

/* ── the far edge ──────────────────────────────────────────────────────── */
ok('NIGHT brings stars',              W('night').stars);
ok('SPACE opens the room',            W('space').open);
ok('MOON + NIGHT thickens the band',  W('moon','star').band);
ok('BLACK HOLE distorts',             W('blackhole').distort>0);
ok('VOID distorts too',               W('void').distort>0);
ok('TIME gives the world a clock',    W('time').timed);
ok('CHAOS knocks it loose',           W('chaos').chaos);
ok('RIZO signs the board',            W('rizo').rizo);
ok('an unsigned board is unsigned',   !W('sea','city').rizo);

/* ── density accumulates ───────────────────────────────────────────────── */
const early=W('sea','stone'), late=W('sea','stone','life','forest','human','city','engine','electricity','internet','ai','space','star','time','rizo');
ok('the world gets denser',  late.civil>early.civil && late.industry>early.industry && late.deep>early.deep);
ok('an early board is sparse', early.civil===0 && early.industry===0);

/* ── ICE has to leave evidence on its own ──────────────────────────────── */
ok('ICE alone freezes a sea',      W('sea','ice').frozen);
ok('ICE alone caps a dry world',   W('ice','mountain').icecap);
ok('no ice, no cap',               !W('mountain').icecap && !W('sea').frozen);

/* ── the mistake ledger: the player's own history, printed into the world ── */
{
  const w=boot(base.concat(['rizo']));
  ok('a clean board carries no misfire weight', w.derive().misfires===0);
  w.__setFails(260);  const mid=w.derive().misfires;
  w.__setFails(2000); const heavy=w.derive().misfires;
  ok('dead ends accumulate into the print', mid>0 && heavy>mid);
  ok('the ledger is bounded',               heavy<=1);
}

/* ── TIME makes the world agree with itself ────────────────────────────── */
ok('TIME is a rhythm, not a prop', W('time','sea','forest').timed && !W('sea','forest').timed);
ok('CHAOS breaks the agreement',   W('time','chaos').timed && W('time','chaos').chaos);

/* ── birth coverage ────────────────────────────────────────────────────── */
const w=boot(base);
['sea','volcano','mountain','life','forest','city','electricity','space','universe','night','moon','rizo','chaos','human','ai','internet','river','ice','storm','lightning','time','blackhole','bigbang']
  .forEach(id=>ok('BIRTH exists for '+id, w.hasBirth(id)));
ok('an ordinary noun gets no birth event', !w.hasBirth('opinion'));
ok('eventFor still answers the audio layer', w.eventFor('sea')==='sea' && w.eventFor('thunder')==='storm' && w.eventFor('opinion')===null);

/* ── report ────────────────────────────────────────────────────────────── */
console.log('── V11 living-world invariants ───────────────────────────────');
console.log(n+' checks');
if(fails.length){ console.log('\nFAILED ('+fails.length+')'); fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
console.log('\n✓ every relationship holds');
