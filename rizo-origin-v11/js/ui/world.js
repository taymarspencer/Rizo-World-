/* RIZO ORIGIN V11 — PHASE 2: THE LIVING WORLD
   ─────────────────────────────────────────────────────────────────────────
   V9 proved the board should keep evidence of what the player made. It did it
   with independent on/off toggles, which is why the scene never *developed* —
   SEA looked the same whether or not the moon existed.

   Phase 2 replaces the toggles with a derived model. Nothing here is stored in
   the save: the entire environment is a pure function of the discovered set, so
   a reload rebuilds exactly the same place, and NEW GAME returns it to dirt.

   Three layers of consequence:
     1. BIRTH        — choreography the first time a thing is made
     2. PERSISTENT   — it stays in the world afterwards
     3. RELATIONAL   — later discoveries reinterpret what is already there

   The third one is the whole point. SEA does not get five upgrade popups. The
   world simply understands that a sea with a moon behaves differently from a
   sea without one. */
(function(){
'use strict';
const R=window.Rizo;

/* ── measuring what exists ─────────────────────────────────────────────── */
const has=id=>!!(R.S.found[id]);
const any=(...ids)=>ids.some(has);
const tally=(...ids)=>ids.reduce((n,id)=>n+(has(id)?1:0),0);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* Continuous 0..1 signals. Levels let one system answer "how much of me is
   there" without the renderer needing to know which elements caused it. */
function derive(){
  const n=R.countCounted();

  /* weather + air */
  const wind=clamp(tally('wind','storm','hurricane')*0.34+(has('air')?0.12:0)+(has('cloud')?0.08:0),0,1);
  const rain=has('storm')?1:has('rain')?0.62:0;
  const storm=has('storm')||has('thunder')?1:0;
  const cold=clamp(tally('ice','snow','glacier')*0.42,0,1);
  const heat=clamp(tally('fire','lava','volcano','desert','nuclear')*0.26,0,1);
  const night=any('night','moon');

  /* water: one system, many readings */
  const seaOn=any('sea','wave','tide','beach','island','ocean');
  const sea=seaOn?clamp(0.42+tally('wave','tide','beach','island')*0.16,0,1):0;
  const swell=seaOn?clamp(0.18+(has('tide')||has('moon')?0.3:0)+storm*0.45+wind*0.18,0,1):0;

  /* land */
  const ground=any('earth','stone','sand','mud','soil','mountain','desert');
  const ridge=any('mountain','volcano','island','cave','canyon');
  const mountain=has('mountain')||has('volcano');
  const volcano=has('volcano');
  const river=any('river','waterfall','lake');

  /* life */
  const life=has('life');
  const flora=clamp(tally('plant','grass','flower','tree','forest','jungle','moss','fungus')*0.2,0,1);
  const forest=any('forest','tree','jungle');
  const fauna=clamp(tally('animal','fish','bird','insect','mammal','beast')*0.22,0,1);
  const organic=life?clamp(0.3+flora*0.4+fauna*0.4+(rain?0.12:0)+(seaOn?0.08:0),0,1):0;

  /* people */
  const human=has('human');
  const settle=any('house','home','village','farm','tribe');
  const city=any('city','empire','crowd');
  const civil=clamp((human?0.22:0)+(settle?0.3:0)+(city?0.34:0)+tally('bridge','farm','road','temple','market')*0.06,0,1);

  /* built things */
  const machine=any('engine','machine','factory','train','car','wheel','gun');
  const power=any('electricity','lightbulb','battery');
  const signal=any('signal','radio','internet','computer','satellite','phone','television');
  const ai=has('ai');
  const industry=clamp((machine?0.36:0)+(power?0.28:0)+(signal?0.24:0)+(ai?0.16:0)+(has('factory')?0.14:0),0,1);

  /* the far edge of the room */
  const stars=any('star','space','galaxy','universe')||night;
  const space=any('space','planet','galaxy','universe','rocket','satellite');
  const deep=clamp(tally('space','planet','galaxy','universe','star','blackhole','bigbang','singularity','void')*0.16,0,1);
  const distort=clamp(tally('blackhole','singularity','void','entropy')*0.3,0,1);
  const strange=clamp(tally('chaos','glitch','madness','origin','loop','player','fourthwall','you')*0.2,0,1);
  const rizo=has('rizo');
  const misfires=clamp(((R.S.stats&&R.S.stats.fails)||0)/520,0,1);

  /* rhythm: TIME gives the ambient world a shared clock, CHAOS knocks it loose */
  const timed=has('time');
  const chaos=has('chaos');

  return {
    n,wind,rain,storm,cold,heat,night,
    sea,seaOn,swell,ground,ridge,mountain,volcano,river,
    life,flora,forest,fauna,organic,
    human,settle,city,civil,
    machine,power,signal,ai,industry,
    stars,space,deep,distort,strange,rizo,timed,chaos,misfires,
    /* RELATIONAL READINGS — the part V9 did not have.
       Each one is a question about coexistence, not about a single element. */
    tide:       seaOn&&any('moon','tide'),
    rough:      seaOn&&!!storm,
    frozen:     seaOn&&cold>0.35,
    shoreLife:  seaOn&&life,
    harbour:    seaOn&&city,
    reflect:    seaOn&&night,
    steamVent:  volcano&&seaOn,
    snowcap:    mountain&&cold>0,
    riverIce:   river&&cold>0.35,
    camp:       human||settle,
    icecap:     cold>0&&!seaOn,
    glow:       volcano&&night,
    sway:       forest&&wind>0.3,
    drip:       forest&&rain>0,
    scar:       forest&&any('fire','wildfire','ash'),
    clearing:   forest&&city,
    lit:        city&&power,
    lamps:      city&&night,
    traffic:    city&&signal,
    stacks:     city&&machine,
    autonomous: ai&&signal,
    open:       space||deep>0.35,
    band:       stars&&night,
    signed:     rizo
  };
}

/* ── the scene ─────────────────────────────────────────────────────────── */
/* One SVG, one canvas, no per-object nodes. Everything that repeats (rain,
   ash, spores, packets) shares the canvas; everything structural is a path. */
function scene(){
  /* Composition rule: the workbench owns the middle of this box. Mass lives in
     the left and right margins or along the horizon at the bottom; the centre
     stays sky. That is why the city is a distant skyline instead of a set of
     towers — a low silhouette can light up without ever fighting the slots. */
  return ''+
  '<svg class="ws-art" viewBox="0 0 1200 270" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="wsDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e4a54"/><stop offset="1" stop-color="#16262c"/></linearGradient><linearGradient id="wsMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#243c45"/><stop offset="1" stop-color="#121f24"/></linearGradient></defs>'+
    '<g class="l-celestial">'+
      '<circle class="c-sun" cx="1018" cy="62" r="15"/>'+
      '<path class="c-moon" d="M1034 50c-11 3-18 15-13 25 4 10 16 15 26 10-7 1-13-4-16-9-4-11-2-21 3-26z"/>'+
    '</g>'+
    '<g class="l-cloud">'+
      '<path class="cl-a" d="M90 46c8-16 32-15 37 2 12-7 30 1 30 14H64c0-11 13-20 26-16z"/>'+
      '<path class="cl-b" d="M700 26c7-13 27-13 32 1 10-6 26 1 26 12h-79c0-9 10-16 21-13z"/>'+
      '<path class="cl-c" d="M392 18c5-10 21-10 25 2 8-5 20 1 20 9h-62c0-7 8-13 17-11z"/>'+
    '</g>'+
    '<g class="l-far">'+
      '<path d="M0 202 72 182l54 10 62-18 58 14 70-10 64 16 56-20 72 18 60-12 66 16 58-18 70 14 62-8 76 16 100-6v24H0z"/>'+
    '</g>'+
    '<g class="l-mountain">'+
      '<path class="mt-body" d="M0 202 88 96l70 60 46-36 94 82z"/>'+
      '<path class="mt-body" d="M140 202 236 124l52 38 40-22 72 62z"/>'+
      '<path class="mt-cap" d="M60 130 88 96l28 24-22 11-18-12z"/>'+
    '</g>'+
    '<g class="l-glacier"><path d="M0 196l66-18 54 12 46-10 40 20v12H0z"/></g>'+
    '<g class="l-volcano">'+
      '<path class="vo-body" d="M914 202 1058 96l142 106z"/>'+
      '<path class="vo-mouth" d="M1036 110l22-17 23 17-12 15-10-10-9 11z"/>'+
      '<path class="vo-flow" d="M1058 110l-10 22 13 16-7 22 11 14-8 18"/>'+
      '<path class="vo-vent" d="M962 202c-9-10 5-14-3-24 13 6 9-10 22-5-6 8 6 14-2 22-5 5-11 4-17 7z"/>'+
      '<path class="vo-plume" d="M1054 86c-19-15 8-25-8-42 26 9 18-18 43-9-11 13 12 24-3 39-10 9-22 6-32 12z"/>'+
    '</g>'+
    '<g class="l-forest">'+
      '<path class="fr-canopy" d="M330 202c5-16 17-22 25-13 4-15 20-18 27-4 7-12 22-11 25 3 9-9 22-3 22 9 10-6 20 2 19 9z"/>'+
      '<path class="fr-trunks" d="M346 202v-9m26 9v-13m28 13v-11m26 11v-8"/>'+
      '<path class="fr-edge" d="M456 202c3-10 12-14 17-8 3-10 13-12 17-3 5-6 13-4 14 4z"/>'+
    '</g>'+
    '<g class="l-settle"><path d="M254 202v-11l10-8 10 8v11m15 0v-8l8-6 8 6v8"/></g>'+
    '<g class="l-city">'+
      '<path class="ct-block" d="M604 202v-18h18v18m7 0v-27h22v27m9 0v-21h17v21m8 0v-34h25v34m9 0v-24h20v24m8 0v-15h16v15m9 0v-22h19v22m8 0v-13h15v13m8 0v-19h17v19"/>'+
      '<path class="ct-mast" d="M690 168v-16m0 0-4 6m4-6 4 6"/>'+
      '<path class="ct-win" d="M608 196h4m9 0h4m14-12h4m8 0h4m-16 8h4m8 0h4m32-18h4m9 0h4m-17 9h4m9 0h4m-17 9h4m9 0h4m26-8h4m8 0h4m20-6h4m8 0h4m-12 8h4"/>'+
      '<path class="ct-stack" d="M754 202v-30h9v30m-4.5-30v-8m18 38v-24h9v24m-4.5-24v-6"/>'+
    '</g>'+
    '<g class="l-pylon"><path d="M872 202v-30m-9 30 9-30 9 30m-13-20h8m-6-7h4m9 7 34-8m-52 8-42 9"/></g>'+
    '<g class="l-grid"><path class="gr-line" d="M0 224h360l18-9h130l22 9h158l20-8h492"/><path class="gr-drop" d="M378 215v-11m152 8v-12m192 2v-10"/></g>'+
    '<g class="l-sea">'+
      '<path class="sea-deep" d="M0 206c60-12 112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0v72H0z"/>'+
      '<path class="sea-mid" d="M0 218c70-11 128 11 198 0s128 11 198 0s128 11 198 0s128 11 198 0s128 11 198 0s128 11 198 0s128 11 198 0v62H0z"/>'+
      '<path class="sea-line" d="M0 208c60-12 112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0"/>'+
      '<path class="sea-line sea-line2" d="M0 236c76-10 140 10 216 0s140 10 216 0s140 10 216 0s140 10 216 0s140 10 216 0s140 10 216 0"/>'+
      '<path class="sea-glint" d="M1040 216h34m-104 12h26m-170-6h38m-134 14h30m-150-8h24"/>'+
      '<path class="sea-floe" d="M74 212h48l-9 8H82zm188 6h42l-8 8h-26zm296-4h36l-7 8h-23z"/>'+
    '</g>'+
    '<g class="l-ris112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s112 12 172 0s140 10 216 0s140 10 216 0s140 10 216 0s140 10 216 0s140 10 216 0ver"><path d="M176 270c12-30-16-36-8-58 8-20 34-22 30-42"/></g>'+
    '<g class="l-shore"><path d="M0 204h1200"/><path class="sh-mark" d="M236 202v-7m86 7v-5m112 5v-8m118 8v-5m124 5v-6"/></g>'+
    '<g class="l-camp"><path class="cp-fire" d="M286 202c-5-5-1-8-3-12 5 2 4-5 9-3-3 4 3 7-1 11-2 3-4 2-5 4z"/><path class="cp-ring" d="M278 203h16"/></g>'+
    '<g class="l-figure"><path d="M300 202v-9m0-3a2 2 0 1 0 .1 0m-4 6h8m-4 6-3 6m3-6 3 6"/></g>'+
    '<g class="l-sign"><path d="M1138 202v-22m-9 22 9-22 9 22m-14-8h10"/></g>'+
  '</svg>'+
  '<canvas class="ws-fx" aria-hidden="true"></canvas>'+
  '<div class="ws-print" aria-hidden="true"></div>'+
  '<div class="ws-flash" aria-hidden="true"></div>';
}

/* ── mounting ──────────────────────────────────────────────────────────── */
let root=null, field=null, cv=null, ctx=null, cssW=0, cssH=0, dpr=1;
let raf=0, ambientT=0, eventT=0, last=0, emit=null, model=null, beat=0;

function mount(){
  if(root&&root.isConnected&&cv&&cv.isConnected) return root;
  root=document.getElementById('worldscape');
  if(!root){
    const bench=document.getElementById('bench'); if(!bench) return null;
    root=document.createElement('div'); root.id='worldscape'; root.setAttribute('aria-hidden','true'); bench.prepend(root);
  }
  if(!root.querySelector('.ws-art')) root.innerHTML=scene();
  cv=root.querySelector('.ws-fx'); ctx=cv?cv.getContext('2d'):null;
  if(!field){
    field=document.getElementById('worldfield');
    if(!field){
      field=document.createElement('div'); field.id='worldfield'; field.setAttribute('aria-hidden','true');
      field.innerHTML='<div class="wf-depth"></div><div class="wf-stars"></div><div class="wf-lens"></div>';
      document.body.insertBefore(field,document.body.firstChild);
    }
  }
  resize();
  return root;
}
function resize(){
  if(!cv||!root) return;
  const r=root.getBoundingClientRect();
  if(!r.width||!r.height) return;
  dpr=Math.min(window.devicePixelRatio||1,1.6);
  cssW=r.width; cssH=r.height;
  cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  if(ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
}

/* ── particles: one pool, one loop ─────────────────────────────────────── */
const P=[];
const CAP=()=>(window.innerWidth<560?40:88);
function spawn(kind,x,y,vx,vy,life,size,tint){
  if(P.length>=CAP()) return;
  P.push({k:kind,x,y,vx,vy,t:0,l:life,s:size,c:tint});
}
function emitters(m){
  if(!m) return null;
  const e=[];
  if(m.rain) e.push({k:'rain',rate:m.storm?0.9:0.42});
  if(m.cold>0.4&&(m.rain||m.storm||m.night)) e.push({k:'snow',rate:0.22});
  if(m.volcano) e.push({k:'ash',rate:0.2+(m.storm?0.1:0)});
  if(m.volcano&&m.night) e.push({k:'ember',rate:0.12});
  if(m.organic>0.35) e.push({k:'spore',rate:0.1+m.organic*0.12});
  if(m.traffic) e.push({k:'packet',rate:0.16+(m.ai?0.1:0)});
  if(m.industry>0.5&&m.power) e.push({k:'spark',rate:0.05});
  if(m.heat>0.5&&!m.rain) e.push({k:'heat',rate:0.08});
  if(!e.length) return null;
  /* A late world can legitimately have rain, ash, spores and traffic at the
     same time. Sharing one budget keeps a phone at 60 instead of letting every
     system bill separately. */
  const small=window.innerWidth<560;
  const load=(small?0.62:1)*(e.length>3?3/e.length:1);
  if(load<1) e.forEach(x=>{ x.rate*=load; });
  return e;
}
function seed(kind,n){ for(let i=0;i<n;i++) make(kind,true); }
function make(kind,scatter){
  const w=cssW||300,h=cssH||140, base=h*0.86;
  const drift=(model?model.wind:0)*1.6;
  switch(kind){
    case 'rain':  spawn('rain',Math.random()*w*1.1-w*0.05,scatter?Math.random()*h:-6,drift*1.4+0.2,h*0.016+Math.random()*1.6,1,0,null); break;
    case 'snow':  spawn('snow',Math.random()*w,scatter?Math.random()*h:-4,drift*0.7+(Math.random()-0.5)*0.3,0.28+Math.random()*0.3,1,1.2,null); break;
    case 'ash':   spawn('ash',w*0.68+Math.random()*w*0.3,scatter?Math.random()*h*0.7:h*0.14,-0.18-drift*0.2,0.2+Math.random()*0.24,1,1.1,null); break;
    case 'ember': spawn('ember',w*0.74+Math.random()*w*0.14,h*0.34,(Math.random()-0.5)*0.3,-0.24-Math.random()*0.3,1.4,1.2,'#c8703f'); break;
    case 'spore': spawn('spore',Math.random()*w,base-Math.random()*h*0.3,drift*0.5+(Math.random()-0.5)*0.2,-0.08-Math.random()*0.12,2.6,1,null); break;
    case 'packet':spawn('packet',w*0.42+Math.random()*w*0.1,h*(0.78+Math.random()*0.06),1.1+Math.random()*0.8,0,1.6,1.6,null); break;
    case 'spark': spawn('spark',w*(0.58+Math.random()*0.2),h*(0.6+Math.random()*0.2),(Math.random()-0.5)*0.6,-0.3,0.5,1,'#8fd0e8'); break;
    case 'heat':  spawn('heat',w*(0.66+Math.random()*0.26),h*0.8,(Math.random()-0.5)*0.2,-0.5-Math.random()*0.3,1.1,2.4,null); break;
  }
}
function step(dt){
  const w=cssW||300,h=cssH||140;
  for(let i=P.length-1;i>=0;i--){
    const p=P[i];
    p.t+=dt; p.x+=p.vx*dt*60; p.y+=p.vy*dt*60;
    if(p.k==='spore'){ p.x+=Math.sin(p.t*1.6+p.y)*0.22; }
    if(p.k==='ember'){ p.vy*=0.995; p.x+=Math.sin(p.t*3)*0.2; }
    if(p.t>p.l*2.6||p.y>h+8||p.y<-14||p.x<-24||p.x>w+24) P.splice(i,1);
  }
}
function draw(){
  if(!ctx) return;
  const h=cssH||140;
  ctx.clearRect(0,0,cssW,cssH);
  for(let i=0;i<P.length;i++){
    const p=P[i], fade=1-clamp(p.t/(p.l*2.6),0,1);
    switch(p.k){
      case 'rain':
        ctx.strokeStyle='rgba(126,158,170,'+(0.3*fade).toFixed(3)+')'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx*3,p.y-h*0.055); ctx.stroke(); break;
      case 'snow':
        ctx.fillStyle='rgba(196,210,216,'+(0.42*fade).toFixed(3)+')';
        ctx.fillRect(p.x,p.y,1.5,1.5); break;
      case 'ash':
        ctx.fillStyle='rgba(140,126,114,'+(0.4*fade).toFixed(3)+')';
        ctx.fillRect(p.x,p.y,1.4,1.4); break;
      case 'ember':
        ctx.fillStyle='rgba(206,118,66,'+(0.62*fade).toFixed(3)+')';
        ctx.fillRect(p.x,p.y,1.5,1.5); break;
      case 'spore':
        ctx.fillStyle='rgba(140,168,124,'+(0.34*fade).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x,p.y,1,0,6.283); ctx.fill(); break;
      case 'packet':
        ctx.fillStyle='rgba(120,180,205,'+(0.6*fade).toFixed(3)+')';
        ctx.fillRect(p.x,p.y,4,1.2); break;
      case 'spark':
        ctx.fillStyle='rgba(150,214,236,'+(0.75*fade).toFixed(3)+')';
        ctx.fillRect(p.x,p.y,1.4,1.4); break;
      case 'heat':
        ctx.strokeStyle='rgba(190,140,104,'+(0.12*fade).toFixed(3)+')'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.quadraticCurveTo(p.x+3,p.y-6,p.x,p.y-12); ctx.stroke(); break;
    }
  }
}
function loop(ts){
  raf=0;
  if(!ctx) return;
  const dt=Math.min(0.05,(ts-last)/1000||0.016); last=ts;
  if(emit){
    /* CHAOS makes emission stutter instead of tick. */
    const gate=model&&model.chaos?(0.55+Math.random()*0.9):1;
    for(let i=0;i<emit.length;i++){
      const e=emit[i];
      if(Math.random()<e.rate*gate*dt*30) make(e.k);
    }
  }
  step(dt); draw();
  if(P.length||emit) raf=requestAnimationFrame(loop);
}
function kick(){
  if(!ctx||document.hidden) return;
  if(!R.S.settings.motion){ P.length=0; if(ctx) ctx.clearRect(0,0,cssW,cssH); return; }
  if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); }
}
function stopLoop(){ if(raf) cancelAnimationFrame(raf); raf=0; }

/* ── ambient: the world doing something while nobody asked ─────────────── */
/* Irregular on purpose. TIME tightens it into a rhythm, CHAOS loosens it. */
const AMBIENT=[
  {k:'bolt',   when:m=>m.storm,                  weight:m=>2+ (m.night?1:0)},
  {k:'gust',   when:m=>m.wind>0.35,              weight:()=>2},
  {k:'window', when:m=>m.lamps||m.lit,           weight:()=>2},
  {k:'pulse',  when:m=>m.traffic,                weight:m=>m.autonomous?3:2},
  {k:'breath', when:m=>m.organic>0.3,            weight:()=>2},
  {k:'stir',   when:m=>m.fauna>0.3,              weight:()=>1},
  {k:'vent',   when:m=>m.volcano,                weight:()=>1},
  {k:'drift',  when:m=>m.deep>0.3,               weight:()=>1},
  {k:'slip',   when:m=>m.strange>0.25||m.chaos,  weight:m=>m.chaos?3:1}
];
function ambientTick(){
  ambientT=0;
  if(!root||!R.S.settings.motion||document.hidden||!model){ scheduleAmbient(); return; }
  const pool=[];
  AMBIENT.forEach(a=>{ if(a.when(model)){ const w=a.weight(model); for(let i=0;i<w;i++) pool.push(a.k); } });
  if(pool.length){
    const k=pool[(Math.random()*pool.length)|0];
    root.classList.remove('amb-'+k); void root.offsetWidth; root.classList.add('amb-'+k);
    setTimeout(()=>root&&root.classList.remove('amb-'+k),k==='bolt'?900:2600);
    if(k==='pulse') for(let i=0;i<3;i++) setTimeout(()=>make('packet'),i*120);
    if(k==='vent') for(let i=0;i<5;i++) setTimeout(()=>make('ash'),i*90);
    if(k==='gust') for(let i=0;i<4;i++) setTimeout(()=>make(model.organic>0.3?'spore':'ash'),i*70);
    kick();
  }
  scheduleAmbient();
}
function scheduleAmbient(){
  clearTimeout(ambientT);
  if(!model) return;
  /* TIME: the board learned to wait — beats land on a grid.
     CHAOS: something keeps knocking the grid over. */
  const base=model.timed?5200:6400;
  const jitter=model.timed?(model.chaos?2600:900):3800;
  ambientT=setTimeout(ambientTick,base+Math.random()*jitter);
}

/* ── writing the state onto the room ───────────────────────────────────── */
const FLAGS=['ground','ridge','mountain','volcano','river','sea','life','forest','human','settle','city',
  'machine','power','signal','ai','stars','space','night','rizo','chaos','timed',
  'tide','rough','frozen','icecap','shoreLife','harbour','reflect','steamVent','snowcap','riverIce','camp','glow','sway','drip','scar',
  'clearing','lit','lamps','traffic','stacks','autonomous','open','band'];

/* Two different questions, and V9 conflated them.
   WEIGHT  — how much world is actually on screen. Drives visibility, because a
             player who found SEA, MOUNTAIN and VOLCANO by discovery 15 should
             be able to SEE them; hiding their work behind a raw counter was
             the bug that playing this for ten minutes exposed.
   ERA     — what kind of place this has become. Drives mood, and it is earned
             by crossing thresholds, not by counting. */
function weigh(m){
  return (m.ground?1:0)+(m.ridge?1:0)+(m.mountain?1:0)+(m.volcano?1:0)+(m.seaOn?1.5:0)+(m.river?1:0)+
         (m.rain?1:0)+(m.storm?1:0)+(m.cold>0.4?1:0)+(m.night?.5:0)+
         (m.life?1.5:0)+(m.forest?1:0)+(m.organic>0.5?.5:0)+
         (m.human?1:0)+(m.settle?1:0)+(m.city?1.5:0)+
         (m.machine?1:0)+(m.power?1:0)+(m.signal?1:0)+(m.ai?.5:0)+
         (m.stars?.5:0)+(m.space?1:0)+(m.distort>0?1:0)+(m.rizo?1.5:0);
}
function age(m){
  /* accepts the model, or a bare count for the older call shape */
  if(typeof m==='number') m={n:m,ground:m>4,ridge:m>40,life:m>90,settle:m>150,machine:m>200,space:m>280,rizo:m>330,seaOn:false,city:false,power:false,deep:0};
  if(m.rizo) return 'signed';
  /* A world with stars but no life is not "deep" — it is a terrain world that
     happens to have looked up. The room only goes cosmic once there is enough
     of a world for the scale to mean anything. */
  if((m.space||m.deep>0.3) && (m.machine||m.power||m.city)) return 'deep';
  if(m.machine||m.power) return 'built';
  if(m.city||m.settle||m.human) return 'settled';
  if(m.life) return 'living';
  if(m.ridge||m.seaOn||m.rain||m.storm||m.mountain) return 'terrain';
  return 'dirt';
}

function apply(){
  const w=mount(); if(!w) return;
  const m=model=derive();
  FLAGS.forEach(f=>w.classList.toggle('w-'+f,!!m[f]));
  w.classList.toggle('w-cloud',!!(m.rain||m.storm||has('cloud')||has('mist')));
  w.classList.toggle('w-rain',m.rain>0);
  w.classList.toggle('w-storm',m.storm>0);
  const S=w.style;
  S.setProperty('--w-wind',m.wind.toFixed(2));
  S.setProperty('--w-swell',m.swell.toFixed(2));
  S.setProperty('--w-heat',m.heat.toFixed(2));
  S.setProperty('--w-organic',m.organic.toFixed(2));
  S.setProperty('--w-civil',m.civil.toFixed(2));
  S.setProperty('--w-industry',m.industry.toFixed(2));
  S.setProperty('--w-deep',m.deep.toFixed(2));
  S.setProperty('--w-distort',m.distort.toFixed(2));
  S.setProperty('--w-strange',m.strange.toFixed(2));
  S.setProperty('--w-misfires',m.misfires.toFixed(3));
  S.setProperty('--w-cold',m.cold.toFixed(2));
  /* Sway and swell slow down when nothing is pushing them. */
  let sway=9.5-m.wind*4.5, swell=8.6-m.swell*4.2;
  if(m.timed && !m.chaos){
    /* snapped to a shared 1.6s grid: the world starts keeping time with itself */
    sway=Math.round(sway/1.6)*1.6; swell=Math.round(swell/1.6)*1.6;
  }
  S.setProperty('--w-sway-dur',sway.toFixed(2)+'s');
  S.setProperty('--w-swell-dur',swell.toFixed(2)+'s');
  /* Breadth is most of it — a player who built six systems should see six
     systems — but sheer depth still counts for something, so a wide-and-shallow
     rush cannot make the board look finished at fifty discoveries. */
  const weight=weigh(m);
  const density=clamp(clamp(weight/18,0,1)*0.76 + clamp(m.n/300,0,1)*0.24,0,1);
  w.style.setProperty('--w-density',density.toFixed(3));
  w.dataset.age=age(m);
  if(field){
    field.classList.toggle('f-on',m.deep>0||m.stars);
    field.classList.toggle('f-stars',!!m.stars);
    field.classList.toggle('f-space',!!m.space);
    field.classList.toggle('f-band',!!m.band);
    field.classList.toggle('f-lens',m.distort>0);
    field.classList.toggle('f-strange',m.strange>0.3);
    field.style.setProperty('--f-deep',m.deep.toFixed(2));
    field.style.setProperty('--f-distort',m.distort.toFixed(2));
  }
  document.body.classList.toggle('world-grown',m.n>12);
  document.body.dataset.worldAge=w.dataset.age;
  emit=emitters(m);
  if(emit) kick(); else if(!P.length) stopLoop();
  scheduleAmbient();
  return m;
}

/* ── birth choreography ────────────────────────────────────────────────── */
/* A discovery that changes the world gets an arrival. Some of these transform
   something that already exists instead of adding a new object — that is the
   point of ELECTRICITY, NIGHT and MOON. */
const BIRTH={
  fire:{cls:'b-fire',ms:1500},
  wind:{cls:'b-wind',ms:1900,seed:['ash',4]},
  ice:{cls:'b-ice',ms:2100},
  snow:{cls:'b-ice',ms:1900,seed:['snow',12]},
  rain:{cls:'b-rain',ms:2400,seed:['rain',14]},
  storm:{cls:'b-storm',ms:3100,seed:['rain',22]},
  lightning:{cls:'b-bolt',ms:1600},
  thunder:{cls:'b-storm',ms:2400},
  cloud:{cls:'b-cloud',ms:2000},
  sea:{cls:'b-sea',ms:2900},
  wave:{cls:'b-sea',ms:2200},
  tide:{cls:'b-tide',ms:2600},
  river:{cls:'b-river',ms:2400},
  waterfall:{cls:'b-river',ms:2200},
  mountain:{cls:'b-mountain',ms:2800},
  volcano:{cls:'b-volcano',ms:3400,seed:['ash',10]},
  lava:{cls:'b-fire',ms:1700},
  earthquake:{cls:'b-quake',ms:2300},
  glacier:{cls:'b-ice',ms:2200},
  desert:{cls:'b-heat',ms:2000},
  life:{cls:'b-life',ms:3200,seed:['spore',18]},
  plant:{cls:'b-grow',ms:1800},
  tree:{cls:'b-grow',ms:2000},
  forest:{cls:'b-forest',ms:2600},
  animal:{cls:'b-stir',ms:2000},
  bird:{cls:'b-stir',ms:1800},
  fish:{cls:'b-shore',ms:1800},
  human:{cls:'b-human',ms:2600},
  house:{cls:'b-settle',ms:1900},
  home:{cls:'b-settle',ms:1900},
  village:{cls:'b-settle',ms:2300},
  city:{cls:'b-city',ms:3000},
  bridge:{cls:'b-bridge',ms:2100},
  farm:{cls:'b-settle',ms:1800},
  engine:{cls:'b-machine',ms:2400},
  machine:{cls:'b-machine',ms:2200},
  factory:{cls:'b-stacks',ms:2300},
  electricity:{cls:'b-power',ms:2600},
  lightbulb:{cls:'b-power',ms:1900},
  computer:{cls:'b-signal',ms:2200,seed:['packet',5]},
  signal:{cls:'b-signal',ms:2000,seed:['packet',4]},
  radio:{cls:'b-signal',ms:2000,seed:['packet',4]},
  internet:{cls:'b-signal',ms:2500,seed:['packet',8]},
  ai:{cls:'b-ai',ms:2800},
  night:{cls:'b-night',ms:2400},
  moon:{cls:'b-moon',ms:2400},
  sun:{cls:'b-sun',ms:2200},
  sky:{cls:'b-sky',ms:2200},
  star:{cls:'b-stars',ms:2600},
  space:{cls:'b-space',ms:3000},
  planet:{cls:'b-space',ms:2400},
  galaxy:{cls:'b-space',ms:2600},
  universe:{cls:'b-universe',ms:3400},
  blackhole:{cls:'b-hole',ms:3000},
  bigbang:{cls:'b-bang',ms:3600},
  time:{cls:'b-time',ms:2400},
  chaos:{cls:'b-chaos',ms:2600},
  rizo:{cls:'b-rizo',ms:3000}
};
/* V9 exposed this list to the audio layer via eventFor(); keep that contract. */
const EVENT_ALIAS={thunder:'storm',wave:'sea',machine:'engine',lightbulb:'electric',star:'space',
  electricity:'electric',village:'city',waterfall:'river',snow:'ice',glacier:'ice',earthquake:'quake'};

function reveal(id){
  const w=mount(); if(!w) return false;
  const before=model;
  apply();
  const b=BIRTH[id];
  if(!b) return false;
  if(!R.S.settings.motion) return true;
  clearTimeout(eventT);
  Array.from(w.classList).filter(c=>c.charCodeAt(0)===98&&c[1]==='-').forEach(c=>w.classList.remove(c));
  document.body.classList.remove('world-birth');
  void w.offsetWidth;
  w.classList.add(b.cls);
  document.body.classList.add('world-birth');
  if(b.seed) seed(b.seed[0],b.seed[1]);
  kick();
  eventT=setTimeout(()=>{
    if(!w) return;
    w.classList.remove(b.cls);
    document.body.classList.remove('world-birth');
    /* A birth settles into the persistent state rather than snapping off. */
    w.classList.add('w-settling');
    setTimeout(()=>w&&w.classList.remove('w-settling'),700);
  },b.ms);
  return true;
}

function reset(){
  clearTimeout(eventT); eventT=0;
  const w=mount(); if(!w) return;
  Array.from(w.classList).filter(c=>c[1]==='-'&&(c[0]==='b'||c[0]==='amb')).forEach(c=>w.classList.remove(c));
  w.className=''; document.body.classList.remove('world-birth');
  P.length=0; if(ctx) ctx.clearRect(0,0,cssW,cssH);
  apply();
}

/* ── lifecycle ─────────────────────────────────────────────────────────── */
let ro=null;
function observe(){
  if(ro||!root||!window.ResizeObserver) return;
  ro=new ResizeObserver(()=>resize()); ro.observe(root);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ stopLoop(); clearTimeout(ambientT); }
  else { kick(); scheduleAmbient(); }
});
window.addEventListener('resize',()=>{ clearTimeout(resize._t); resize._t=setTimeout(resize,160); });

window.RizoWorld={
  mount(){ const r=mount(); observe(); return r; },
  sync(){ const r=mount(); observe(); return apply(); },
  reveal, reset,
  eventFor:id=>BIRTH[id]?(EVENT_ALIAS[id]||id):null,
  /* exposed for deterministic tests */
  derive, state:()=>model, age, weigh,
  hasBirth:id=>!!BIRTH[id]
};
})();
