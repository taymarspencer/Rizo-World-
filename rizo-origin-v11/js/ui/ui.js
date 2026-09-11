/* RIZO ORIGIN — interface.
   One screen, two slots, one grid. Everything else gets out of the way. */
(function(){
const R = window.Rizo, A = window.RizoAudio, Art = window.RizoArt;
const $  = s => document.querySelector(s);
const el = (t,c,h) => { const n=document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n; };

let slotA = null, slotB = null, busy = false, lastResult = null;
let filter = { group:null, fresh:false, fav:false, recent:false, smart:false, manualAll:false, q:'' };
let smartNoticeTimer = null;
let cardTimer = null, cardDismissTimer = null, cardDocHandler = null, resultCueTimer = null, failStreak = 0;
let discoveryChain = 0, lastDiscoveryAt = 0, chainTimer = null, pulseTimer = null, lastHeaderFound = null, pendingDiscoveryBeat = null;
const hiddenReveals = new Set();
const lineMemory = Object.create(null);
function freshLine(key, lines){
  if(!lines||!lines.length)return ''; let ix=Math.floor(Math.random()*lines.length);
  if(lines.length>1 && ix===lineMemory[key]) ix=(ix+1+Math.floor(Math.random()*(lines.length-1)))%lines.length;
  lineMemory[key]=ix; return lines[ix];
}

const ICON = {
  sound:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9v6h4l5 4V5L9 9H5z"/><path class="waves" d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  hint:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9V16h-7v-2.1A6 6 0 0 1 12 3z"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 4.5c2.5-1.2 5-1.2 8 0v15c-3-1.2-5.5-1.2-8 0zM20 4.5c-2.5-1.2-5-1.2-8 0v15c3-1.2 5.5-1.2 8 0z"/></svg>',
  cup:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8l-1-3H9z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 6.2 6.4.5-4.9 4.2 1.5 6.3L12 16.9 6.4 20.2l1.5-6.3L3 9.7l6.4-.5z"/></svg>',
  starO:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.5 5.9 6.1.5-4.7 4 1.5 6-5.4-3.2L6.6 20l1.5-6-4.7-4 6.1-.5z"/></svg>'
};

/* ── the RIZO mark in the corner, which is watching ────────────────────── */
function markSVG(cls, withFace){
  const M = window.RIZO_MARK;
  return '<svg class="'+cls+'" viewBox="0 0 32 32" fill="currentColor">'+
    '<path d="'+M.body+'" fill-rule="evenodd"/>'+
    (withFace===false?'':'<g class="face"><g class="eye eL"><path d="'+M.eyeL+'"/></g>'+
    '<g class="eye eR"><path d="'+M.eyeR+'"/></g><path class="mo" d="'+M.mouth+'"/></g>')+
    '</svg>';
}
let faceTimer = null;
function face(mood){
  const g = $('.brand .mk'); if (!g) return;
  const eyes = g.querySelectorAll('.eye'), mo = g.querySelector('.mo');
  const set = (t,o) => eyes.forEach(e => { e.style.transformBox='fill-box'; e.style.transformOrigin='center'; e.style.transform=t; });
  clearTimeout(faceTimer);
  if (mood==='good'){ set('scaleY(.35)'); }
  else if (mood==='bad'){ set('translateY(1.2px) scaleX(.7)'); }
  else if (mood==='wow'){ set('scale(1.45)'); if(mo) mo.style.opacity='.35'; }
  else if (mood==='dark'){ set('scaleY(.55) scaleX(1.3)'); }
  else if (mood==='rizo'){ set('scale(1.4)'); g.style.color='var(--rizo)'; g.style.transition='color .2s';
    setTimeout(()=>{ g.style.color=''; }, 1500); }
  else { set(''); if(mo) mo.style.opacity=''; return; }
  faceTimer = setTimeout(()=>{ set(''); if(mo) mo.style.opacity=''; }, (mood==='wow'||mood==='rizo')?1400:750);
}
function blinkLoop(){
  setTimeout(function tick(){
    if (!document.hidden && !busy){
      const g = $('.brand .mk');
      if (g){ const eyes=g.querySelectorAll('.eye');
        eyes.forEach(e=>{e.style.transformBox='fill-box';e.style.transformOrigin='center';e.style.transition='transform .09s';e.style.transform='scaleY(.1)';});
        setTimeout(()=>eyes.forEach(e=>e.style.transform=''),110); }
    }
    setTimeout(tick, 2600 + Math.random()*5200);
  }, 1800 + Math.random()*2500);
}

/* ── ink ───────────────────────────────────────────────────────────────── */
function splat(x, y, colour, n, power){
  if (!R.S.settings.motion) return;
  const box = $('#ink');
  for (let i=0;i<(n||14);i++){
    const d = el('div','spl');
    const s = 2 + Math.random()*5;
    d.style.cssText = 'left:'+x+'px;top:'+y+'px;width:'+s+'px;height:'+s+'px;background:'+colour+';opacity:.9';
    box.appendChild(d);
    const ang = Math.random()*Math.PI*2, dist = (power||60) * (0.35 + Math.random());
    d.animate(
      [{transform:'translate(-50%,-50%) scale(1)',opacity:.95},
       {transform:'translate(calc(-50% + '+Math.cos(ang)*dist+'px), calc(-50% + '+Math.sin(ang)*dist+'px)) scale(0)',opacity:0}],
      {duration: 380 + Math.random()*420, easing:'cubic-bezier(.15,.8,.3,1)'}
    ).onfinish = () => d.remove();
  }
}
function centreOf(node){ const r = node.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; }

function screenKick(level){
  if (!R.S.settings.motion) return;
  const app = $('#app'); if (!app) return;
  const cls = level==='major' ? 'kick-major' : level==='fail' ? 'kick-fail' : 'kick-hit';
  app.classList.remove('kick-hit','kick-fail','kick-major'); void app.offsetWidth; app.classList.add(cls);
  setTimeout(()=>app.classList.remove(cls), level==='major'?420:260);
}
function ringAt(x,y,colour,major){
  if (!R.S.settings.motion) return;
  const host=$('#reactionFX'); if(!host)return;
  const n=el('div','rxring'+(major?' major':''));
  n.style.cssText='left:'+x+'px;top:'+y+'px;border-color:'+colour+';color:'+colour;
  host.appendChild(n); setTimeout(()=>n.remove(), major?760:520);
}
function burstAt(node, colour, level){
  const c=centreOf(node); const major=level==='major';
  ringAt(c.x,c.y,colour,major); splat(c.x,c.y,colour,major?34:level==='fail'?9:18,major?125:level==='fail'?38:72);
  screenKick(level); A.pulse(level);
}
function reactorCharge(colourA, colourB){
  if(!R.S.settings.motion) return;
  const host=$('#reactionFX'), target=$('#res'); if(!host||!target)return;
  const c=centreOf(target), n=el('div','rxcore');
  n.style.cssText='left:'+c.x+'px;top:'+c.y+'px;--a:'+colourA+';--b:'+colourB;
  n.innerHTML='<i></i><i></i><i></i>';
  host.appendChild(n); setTimeout(()=>n.remove(),720);
}
function worldStamp(text, colour, major){
  if(!R.S.settings.motion) return;
  const host=$('#reactionFX'); if(!host)return;
  /* Ordinary births should share a visual language without feeling like the
     exact same canned animation. The word itself deterministically chooses a
     print registration, so revisiting an element still feels like *its* mark. */
  let hash=0; for(let i=0;i<text.length;i++) hash=((hash<<5)-hash+text.charCodeAt(i))|0;
  const variant=Math.abs(hash)%4;
  const n=el('div','worldstamp stamp-v'+variant+(major?' major':''));
  n.style.setProperty('--stamp',colour||'var(--rizo)'); n.textContent=text;
  host.appendChild(n); setTimeout(()=>n.remove(),major?1420:1120);
}
function flyPick(id, fromPoint, target){
  if (!fromPoint || !target || !R.S.settings.motion) return;
  const e=R.EL[id], g=R.GROUPS[e.group], to=centreOf(target), host=$('#reactionFX');
  if(!e||!g||!host)return;
  const n=el('div','pickghost'); n.style.cssText='left:'+fromPoint.x+'px;top:'+fromPoint.y+'px;color:'+g.ink+';--domain:'+g.ink+';--art-paper-local:transparent';
  n.innerHTML=Art.glyphSVG(id); host.appendChild(n);
  n.animate([
    {transform:'translate(-50%,-50%) scale(.72) rotate(-5deg)',opacity:.2},
    {transform:'translate(calc(-50% + '+((to.x-fromPoint.x)*.58)+'px), calc(-50% + '+((to.y-fromPoint.y)*.42-16)+'px)) scale(1.08) rotate(4deg)',opacity:.95,offset:.55},
    {transform:'translate(calc(-50% + '+(to.x-fromPoint.x)+'px), calc(-50% + '+(to.y-fromPoint.y)+'px)) scale(.45)',opacity:.1}
  ],{duration:260,easing:'cubic-bezier(.16,.84,.34,1)'}).onfinish=()=>n.remove();
}
function heatPulse(text, sub, colour){
  const host=$('#chain'); if(!host)return;
  clearTimeout(pulseTimer); host.style.setProperty('--heat',colour||'var(--accent)');
  host.innerHTML='<div class="chain-k">'+text+'</div>'+(sub?'<div class="chain-s">'+sub+'</div>':'');
  host.classList.remove('on'); void host.offsetWidth; host.classList.add('on');
  pulseTimer=setTimeout(()=>host.classList.remove('on'),1650);
}
function discoveryHeat(e, beforeMade, specialTurn){
  const now=Date.now();
  discoveryChain = (now-lastDiscoveryAt < 18000) ? discoveryChain+1 : 1;
  lastDiscoveryAt=now;
  const g=R.GROUPS[e.group];
  if(discoveryChain>=2){
    const rate=1+Math.min(.38,(discoveryChain-2)*.075);
    /* Momentum still exists on a landmark turn, but its little chain chirp does
       not talk over the sound that says THIS ONE MATTERS. */
    if(!specialTurn) A.play('chain',{rate,gain:Math.min(1.22,1+(discoveryChain-2)*.045)});
    const body=document.body;
    body.classList.remove('heat-mode','heat-high'); void body.offsetWidth;
    body.classList.add('heat-mode'); if(discoveryChain>=5) body.classList.add('heat-high');
    clearTimeout(chainTimer); chainTimer=setTimeout(()=>body.classList.remove('heat-mode','heat-high'),5200);
    const sub = discoveryChain>=7 ? freshLine('heat7',['THE BOARD CANNOT KEEP UP.','THE ROOM IS RUNNING WITH YOU.','DO NOT LET IT COOL DOWN.'])
              : discoveryChain>=5 ? freshLine('heat5',['YOU ARE MOVING TOO FAST. GOOD.','IT IS STARTING TO CASCADE.','THE BOARD IS WIDE OPEN.'])
              : discoveryChain>=3 ? freshLine('heat3',['DON’T THINK. FOLLOW IT.','FOLLOW THE THREAD.','YOU ARE ON IT. KEEP GOING.','NEXT. BEFORE YOU OVERTHINK IT.'])
              : freshLine('heat2',['KEEP MAKING.','AGAIN.','GOOD. NEXT.','THE THREAD IS STILL WARM.']);
    if(!specialTurn) pendingDiscoveryBeat={text:'RIZO HEAT ×'+discoveryChain,sub,colour:g.ink,cue:null};
  }
  /* The first minutes escalate like authored beats, not a tutorial. No recipes
     are spoiled and nothing becomes a currency. The board simply starts
     acknowledging that the player is learning its language. */
  const made=Math.max(0,R.countCounted()-4);
  beforeMade=Number.isFinite(beforeMade)?Math.max(0,beforeMade):Math.max(0,made-1);
  const beats={
    1:['FIRST SPARK','THE WORLD ANSWERED.'],
    2:['DO IT AGAIN','ONE ANSWER BECOMES ANOTHER QUESTION.'],
    4:['NO MAP','GOOD. YOU DO NOT NEED ONE.'],
    7:['RIZO RULE 01','USE WHAT YOU JUST MADE.'],
    11:['THE ROOM IS OPENING','YOU ARE NOT COLLECTING. YOU ARE BUILDING.'],
    16:['RIZO RULE 02','THE OBVIOUS IS ONLY THE FRONT DOOR.'],
    46:['NO FAMOUS','MAKE SOMETHING WORTH FINDING.']
  };
  const crossedBeat=Object.keys(beats).map(Number).filter(n=>beforeMade<n && made>=n).sort((a,b)=>a-b).pop();
  if(beforeMade<21 && made>=21 && !R.S.flags.signalIntro){
    /* Do not mark this as delivered until it is actually shown. If the player
       backgrounds the page during a landmark, the next launch should still
       know the signal introduction is owed to them. */
    pendingDiscoveryBeat={text:'SIGNAL DETECTED',sub:'THE MARK IN THE CORNER IS NO LONGER DECORATION.',colour:'var(--rizo)',cue:'whisper',rate:1.08,flag:'signalIntro'};
  } else if(crossedBeat) {
    pendingDiscoveryBeat={text:beats[crossedBeat][0],sub:beats[crossedBeat][1],colour:g.ink,cue:'whisper',rate:1+Math.min(.12,crossedBeat*.004)};
  }
  return discoveryChain;
}
function flushDiscoveryBeat(){
  const b=pendingDiscoveryBeat; pendingDiscoveryBeat=null; if(!b)return;
  if(b.flag){ R.S.flags[b.flag]=1; R.autosave(); }
  if(b.cue) A.play(b.cue,{rate:b.rate||1});
  heatPulse(b.text,b.sub,b.colour);
}
function setWorldInk(colour){
  const root=document.documentElement; root.style.setProperty('--world-ink',colour||'var(--rizo)');
  document.body.classList.remove('world-hit'); void document.body.offsetWidth; document.body.classList.add('world-hit');
  setTimeout(()=>document.body.classList.remove('world-hit'),850);
}


/* ── header ────────────────────────────────────────────────────────────── */
function paintHeader(){
  /* Presentation count follows what the player has actually been shown. The
     engine may already know a queued second result; the header does not spoil it. */
  const found = Math.max(0,R.countCounted()-hiddenCount(null,false));
  const sec = Math.max(0,R.countSecret()-hiddenCount(null,true));
  const p = $('#pFound');
  if(lastHeaderFound!==null && found!==lastHeaderFound && R.S.settings.motion){ p.classList.remove('count-pop'); void p.offsetWidth; p.classList.add('count-pop'); }
  lastHeaderFound=found;
  const tight = window.matchMedia('(max-width:560px)').matches;
  if (R.S.revealed){
    p.innerHTML = tight ? '<b>'+found+'</b>/'+R.TOTAL_COUNTED : 'FOUND <b>'+found+'</b> / '+R.TOTAL_COUNTED;
    p.classList.add('hot');
  } else {
    p.innerHTML = tight ? 'FOUND <b>'+found+'</b>' : 'FOUND <b>'+found+'</b>';
    p.classList.remove('hot');
  }
  const s = $('#pSecret');
  if (sec > 0){ s.style.display=''; s.innerHTML = 'ANOMALIES <b>'+sec+'</b>' + (R.S.ended ? ' / '+R.TOTAL_SECRET : ''); }
  else s.style.display='none';
  const brand=$('.brand');
  if(brand){
    const signalReady=found>=25 || R.has('rizo');
    brand.classList.toggle('signal-ready',signalReady);
    brand.setAttribute('aria-label',signalReady?'Open RIZO signal':'RIZO ORIGIN');
    brand.title=signalReady?'RIZO SIGNAL — tap the mark':'RIZO ORIGIN';
  }
  const snd=$('#bSound');
  if(snd){
    const live=!R.S.settings.muted && A.state==='running';
    snd.classList.toggle('muted',R.S.settings.muted); snd.classList.toggle('alive',live); snd.classList.toggle('locked',!R.S.settings.muted&&!live);
    snd.setAttribute('aria-label',R.S.settings.muted?'Sound off':live?'Sound on':'Sound waiting for a tap');
    snd.dataset.audio=A.backend;
  }
}

/* ── adaptive collection / domain navigation ─────────────────────────── */
function smartAvailable(){ return R.groupsFound().length >= 6; }
function smartActive(){
  return smartAvailable() && !filter.group && !filter.fresh && !filter.fav && !filter.recent && !filter.q && (filter.smart || !filter.manualAll);
}
function filterBase(extra){ return Object.assign({group:null,fresh:false,fav:false,recent:false,smart:false,manualAll:false,q:filter.q||''},extra||{}); }
function paintToolState(){
  const smart=$('#chipSmart');
  if(smart) smart.style.display=smartAvailable()?'':'none';
  document.body.classList.toggle('smart-nav',smartAvailable());
  document.querySelectorAll('#tools .chip[data-f]').forEach(c=>{
    const m=c.dataset.f;
    const on=m==='smart'?smartActive()
      :m==='all'?(!smartActive()&&!filter.group&&!filter.fresh&&!filter.fav&&!filter.recent&&!filter.q)
      :m==='new'?filter.fresh:m==='fav'?filter.fav:m==='recent'?filter.recent:false;
    c.classList.toggle('on',!!on);
  });
}
function announceSmartSort(){
  if(!smartAvailable() || !R.S.seenIntro || R.S.flags.smartIntro) return false;
  if($('#stage').classList.contains('on') || $('#sheet').classList.contains('on') || busy) return false;
  R.S.flags.smartIntro=1; R.autosave(); clearTimeout(smartNoticeTimer);
  A.play('reveal',{gain:.46,rate:1.08});
  heatPulse('SMART SORT ONLINE','TOO MUCH WORLD FOR ONE PILE. LIVE PIECES MOVE FORWARD.','var(--rizo)');
  return true;
}

function openDomainPicker(){
  if(window.RizoSheets && window.RizoSheets.domains) window.RizoSheets.domains();
}
function paintRails(){
  const found = R.groupsFound();
  const tease = R.countFound() >= 10 && R.nearNewDomain();
  paintToolState();

  const buildDomainButton=(gid)=>{
    const g=R.GROUPS[gid], size=R.groupSize(gid), done=R.groupComplete(gid);
    const counted=R.groupFoundCount(gid), anomalyN=Math.max(0,R.groupFoundAll(gid)-counted);
    const n=(R.S.revealed&&size)?counted+'/'+size+(anomalyN?' +'+anomalyN:''):counted+(anomalyN?' +'+anomalyN:'');
    const b=el('button','gbtn'+(filter.group===gid?' sel':''));
    b.innerHTML='<span class="gdot" style="background:'+g.ink+'"></span>'+ 
      '<span class="gname" style="'+(filter.group===gid?'color:'+g.ink:'')+'">'+g.name+'</span>'+ 
      '<span class="gnum">'+n+(done?' ✓':'')+'</span>';
    b.onclick=()=>{A.play('tap');const q=$('#search');if(q)q.value='';filter=filterBase({group:gid,q:''});paintRails();paintGrid();scrollGridTop();};
    return b;
  };

  const build=(host,compact)=>{
    host.innerHTML='';
    if(compact && smartAvailable()){
      /* Once the world has enough domains, a sideways list becomes a punishment.
         Mobile keeps the newest doors in reach and moves the full index into a
         proper picker instead of making the player scrub a 22-chip conveyor. */
      const ix=el('button','gbtn domain-index');
      ix.innerHTML='<span class="domain-stack" aria-hidden="true">▦</span><span class="gname">DOMAINS</span><span class="gnum">'+found.length+'</span>';
      ix.onclick=openDomainPicker; host.appendChild(ix);
      let recent=found.slice(-3).reverse();
      if(filter.group && !recent.includes(filter.group)) recent=[filter.group].concat(recent).slice(0,3);
      recent.forEach(gid=>host.appendChild(buildDomainButton(gid)));
      return;
    }

    if(!compact)host.appendChild(el('div','railhead','DOMAINS'));
    const everythingN=R.countCounted()+(R.countSecret()?' +'+R.countSecret():'');
    const all=el('button','gbtn'+(!smartActive()&&filter.group===null&&!filter.fresh&&!filter.fav&&!filter.recent&&!filter.q?' sel':''));
    all.innerHTML='<span class="gdot" style="background:var(--ink3)"></span><span class="gname">EVERYTHING</span><span class="gnum">'+everythingN+'</span>';
    all.onclick=()=>{A.play('tap');const q=$('#search');if(q)q.value='';filter=filterBase({manualAll:true,q:''});paintRails();paintGrid();scrollGridTop();};host.appendChild(all);

    if(!compact && smartAvailable()){
      const smart=el('button','gbtn smart-btn'+(smartActive()?' sel':''));
      smart.innerHTML='<span class="smart-bolt">⌁</span><span class="gname">WORKING SET</span><span class="gnum">'+R.smartLimit()+'</span>';
      smart.title='The board pulls recent and still-useful pieces forward without revealing recipes.';
      smart.onclick=()=>{A.play('tap');const q=$('#search');if(q)q.value='';filter=filterBase({smart:true,q:''});paintRails();paintGrid();scrollGridTop();};host.appendChild(smart);
    }
    found.forEach(gid=>host.appendChild(buildDomainButton(gid)));
    if(tease){
      const t=el('button','gbtn unknown');t.innerHTML='<span class="gdot"></span><span class="gname">?????</span>';t.title='Something is close.';
      t.onclick=()=>{A.play('tap');say('Something you can already reach opens a door you have not seen.');};host.appendChild(t);
    }
  };
  build($('#rail'),false); build($('#mrail'),true);
  $('#rail').appendChild(el('div','railfoot','RIZO ORIGIN<br>NO FAMOUS'));
}
function scrollGridTop(){ const g=$('#grid'); if(g)g.scrollTo({top:0,behavior:R.S.settings.motion?'smooth':'auto'}); }

/* ── grid ──────────────────────────────────────────────────────────────── */
/* Nodes are built once and reused. With 400+ marks on screen, rebuilding the
   markup on every discovery is the difference between smooth and not. */
const nodeCache = new Map();
function nodeFor(id){
  let n = nodeCache.get(id);
  if (!n){
    const e = R.EL[id], g = R.GROUPS[e.group];
    n = el('button','el');
    n.dataset.id = id;
    n.setAttribute('aria-label', e.name);
    n.style.setProperty('--domain', g.ink);
    n.style.setProperty('--art-paper-local', 'var(--tile)');
    n.innerHTML = '<span class="el-art" style="color:'+g.ink+'">'+Art.glyphSVG(id)+'</span><span class="en">'+e.name+'</span>';
    if (R.S.fresh[id]) n.dataset.birth='1';
    nodeCache.set(id, n);
  }
  const born=n.dataset.birth==='1';
  /* A mistake becomes useful the moment the board remembers it. When one
     ingredient is in hand, previously rejected partners carry a quiet scar.
     Nothing is disabled and no unseen recipe is exposed; this is only the
     player's own history made visible. */
  const scar=!!(slotA && R.triedDead(slotA,id));
  const material=scar && R.has('mistake');
  const cls = 'el'+(R.S.fresh[id]?' new':'')+(R.S.favs[id]?' fav':'')+((slotA===id||slotB===id)?' sel':'')+(scar?' scar':'')+(material?' material':'')+(born?' birth':'');
  if (n.className !== cls) n.className = cls;
  n.setAttribute('aria-label',R.EL[id].name+(scar?' — previously tried with '+R.EL[slotA].name+(material?'; kept as material':''):''));
  n.dataset.scar=scar?(material?'material':'1'):'';
  if(born){ n.dataset.birth='0'; setTimeout(()=>n.classList.remove('birth'),620); }
  return n;
}
let gridPaint = null;
function hiddenCount(group, secret){
  let n=0;
  hiddenReveals.forEach(id=>{
    const e=R.EL[id]; if(!e) return;
    if(group && e.group!==group) return;
    if(secret===true && !e.secret) return;
    if(secret===false && e.secret) return;
    n++;
  });
  return n;
}
function hideGridItem(id){ if(id) hiddenReveals.add(id); }
function revealGridItem(id){ if(hiddenReveals.delete(id)){ paintGrid(); paintHeader(); } }
function revealAllGridItems(){ if(hiddenReveals.size){ hiddenReveals.clear(); paintGrid(); paintHeader(); } }
function paintCollectionMeta(list){
  const title = $('#collectionTitle'), count = $('#collectionCount');
  if (!title || !count) return;
  title.style.color = '';
  if (smartActive()){
    title.textContent = 'THE WORKING SET';
    title.style.color = 'var(--rizo)';
    const known=Math.max(0,R.countCounted()-hiddenCount(null,false));
    const scarN=slotA?R.deadPairsFor(slotA).length:0;
    const scarWord=R.has('mistake')?' MATERIAL':' SCAR';
    count.textContent = list.length+' PULLED FORWARD · '+known+' KNOWN'+(slotA?' · '+R.EL[slotA].name+' IN HAND'+(scarN?' · '+scarN+scarWord+(scarN===1?'':'S'):''):'');
  } else if (filter.group){
    const g = R.GROUPS[filter.group];
    title.textContent = g.name;
    title.style.color = g.ink;
    const total = R.groupSize(filter.group);
    const counted = Math.max(0,R.groupFoundCount(filter.group)-hiddenCount(filter.group,false));
    const all = Math.max(0,R.groupFoundAll(filter.group)-hiddenCount(filter.group));
    const anomalies = Math.max(0, all - counted);
    count.textContent = R.S.revealed && total
      ? counted+' / '+total+' FOUND'+(anomalies ? ' · '+anomalies+' ANOMAL'+(anomalies===1?'Y':'IES') : '')
      : all+' FOUND';
  } else if (filter.fresh){
    title.textContent = 'FRESH INK'; count.textContent = list.length ? list.length+' UNUSED' : 'NOTHING WAITING.';
  } else if (filter.fav){
    title.textContent = 'KEPT CLOSE'; count.textContent = list.length ? list.length+' FAVOURITE'+(list.length===1?'':'S') : 'LONG-PRESS ONE TO KEEP IT.';
  } else if (filter.recent){
    title.textContent = 'RECENTLY FOUND'; count.textContent = Math.min(list.length,30)+' MOST RECENT';
  } else if (filter.q){
    title.textContent = 'SEARCH'; count.textContent = list.length+' MATCH'+(list.length===1?'':'ES');
  } else {
    title.textContent = 'THE ELEMENTS';
    const counted=Math.max(0,R.countCounted()-hiddenCount(null,false));
    const secrets=Math.max(0,R.countSecret()-hiddenCount(null,true));
    count.textContent = R.S.revealed
      ? counted+' / '+R.TOTAL_COUNTED+' KNOWN'+(secrets?' · '+secrets+' ANOMAL'+(secrets===1?'Y':'IES'):'')
      : (counted===4 && !secrets ? 'FOUR TO BEGIN.' : counted+' FOUND'+(secrets?' · '+secrets+' ANOMAL'+(secrets===1?'Y':'IES'):'')+'.');
  }
}
function paintGrid(){
  cancelAnimationFrame(gridPaint);
  gridPaint = requestAnimationFrame(() => {
    const host = $('#grid');
    const activeSmart=smartActive();
    const list = R.elementsIn(activeSmart?Object.assign({},filter,{smart:true,limit:R.smartLimit(),focus:slotA||null}):filter).filter(id=>!hiddenReveals.has(id));
    host.classList.toggle('smart-grid',activeSmart); paintToolState();
    paintCollectionMeta(list);
    if (!list.length){
      host.replaceChildren(el('div','empty', filter.q ? 'NOTHING BY THAT NAME' : 'NOTHING HERE YET'));
      return;
    }
    host.replaceChildren.apply(host, list.map(nodeFor));
  });
}

/* ── bench ─────────────────────────────────────────────────────────────── */
function slotHTML(id){
  if (!id) return '<span class="ph">PICK ONE</span>';
  const e = R.EL[id], g = R.GROUPS[e.group];
  return '<span class="slot-art" style="color:'+g.ink+';--art-paper-local:var(--slot-bg)">'+Art.glyphSVG(id)+'</span><span class="sn">'+e.name+'</span>'+
         '<span class="x">'+ICON.x+'</span>';
}
function paintBench(){
  const a = $('#slotA'), b = $('#slotB');
  a.className = 'slot'+(slotA?' full':''); a.innerHTML = slotHTML(slotA);
  b.className = 'slot'+(slotB?' full':''); b.innerHTML = slotHTML(slotB);
  const cue = $('#benchCue');
  if (cue){
    if(slotA && slotB) cue.textContent = R.EL[slotA].name+' + '+R.EL[slotB].name+'. HOLD.';
    else if(slotA) cue.textContent = R.EL[slotA].name+' IS WAITING.';
    else if(lastResult && R.EL[lastResult]) cue.textContent = R.EL[lastResult].name+' CAN GO BACK IN.';
    else cue.textContent = R.countCounted()<=4 ? 'ONE THING. THEN ANOTHER.' : 'MAKE BEFORE YOU KNOW.';
  }
}
function showResult(html, cls){
  const r = $('#res');
  clearTimeout(resultCueTimer);
  r.className = 'result '+(cls||'');
  r.innerHTML = html;
  if (R.S.settings.motion){ r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); }
  /* A finished result intentionally stays reusable. V5 hid that affordance on
     mobile, so an empty bench + old result looked like stale UI. Let the
     outcome label land first, then turn it into an explicit next action. */
  if(r.classList.contains('got')) resultCueTimer=setTimeout(()=>{
    if(!r.classList.contains('got') || !lastResult) return;
    const tag=r.querySelector('.tag'); if(tag) tag.textContent='TAP TO USE';
    r.classList.add('reuse-ready');
    paintBench();
  },1450);
}
function clearResult(){ clearTimeout(resultCueTimer); resultCueTimer=null; lastResult = null; $('#res').className='result empty'; $('#res').innerHTML='<span class="ph">?</span>'; }
function useResult(){ if (lastResult && !busy) pick(lastResult); }
let activeHint = '';
function say(html){ $('#hintline').innerHTML = html || ''; }
function setHint(html){ activeHint = html; say(html); }
function keepHint(){ if (activeHint && !R.hintState().armed) activeHint = ''; return activeHint; }

function announceAchievements(list, delay=0){
  (list||[]).forEach((a,i)=>setTimeout(()=>{
    A.play('ach'); toast(a.name,a.desc);
  },delay+i*180));
}

function pairKey(a,b){ return a<b?a+'+'+b:b+'+'+a; }
function routeBeat(out){
  if(!out || !out.input || !out.routes || out.routes.length<2)return '';
  const current=pairKey(out.input[0],out.input[1]);
  const other=out.routes.find(r=>r.key!==current) || out.routes[0];
  if(!other)return '';
  const now=R.EL[out.input[0]].name+' + '+R.EL[out.input[1]].name;
  const before=R.EL[other.a].name+' + '+R.EL[other.b].name;
  const head=R.has('confluence')?'CONFLUENCE.':'BOTH HELD.';
  return '<span class="relation-beat"><b>'+head+'</b><span>'+before+'</span><i>→ '+out.el.name+' ←</i><span>'+now+'</span></span>';
}
function relationPulse(out,g){
  if(!out || out.kind!=='route' || (out.routeCount||0)<2)return;
  const firstConfluence=R.confluenceCount()===1 && !R.S.flags.relationIntro;
  if(firstConfluence){
    R.S.flags.relationIntro=1; R.autosave();
    setTimeout(()=>heatPulse('TWO ROADS. ONE THING.','THE BOARD DID NOT NEED YOU TO PICK A SIDE.',g.ink),520);
  } else if((out.routeCount||0)>=3){
    setTimeout(()=>heatPulse('ROUTE '+out.routeCount+' STILL HOLDS','THE RESULT IS BIGGER THAN ONE EXPLANATION.',g.ink),480);
  }
}

/* ── selection ─────────────────────────────────────────────────────────── */
function pick(id, node){
  if (busy) return;
  A.unlock();
  const from = node ? centreOf(node) : null;
  let targetId;
  /* tapping the same thing twice is a self-combination, not a mistake */
  const pitch=.88+((R.EL[id].gix%8)*.045);
  if (!slotA){ clearResult(); say(keepHint()); slotA = id; targetId='slotA'; A.play('tap',{rate:pitch}); }
  else if (!slotB){ slotB = id; targetId='slotB'; A.play('tap2',{rate:pitch}); }
  else { slotB = id; targetId='slotB'; A.play('tap2',{rate:pitch}); }
  if (R.S.fresh[id]){ delete R.S.fresh[id]; R.autosave(); }
  paintBench(); paintGrid();
  if(from) flyPick(id,from,$('#'+targetId));
  const target=$('#'+targetId); if(target && R.S.settings.motion){ target.classList.remove('slot-hit'); void target.offsetWidth; target.classList.add('slot-hit'); }
  if (slotA && slotB) setTimeout(()=>fire(node), (from && R.S.settings.motion) ? 245 : 90);
}
function clearSlot(which){
  if (busy) return;
  if (which==='a'){ slotA = slotB; slotB = null; } else slotB = null;
  A.play('untap'); paintBench(); paintGrid(); clearResult(); say(keepHint());
}

/* ── the moment ────────────────────────────────────────────────────────── */
function fire(fromNode){
  const a=slotA,b=slotB; if(!a||!b||busy)return;
  busy=true;
  const bench=$('#bench');
  bench.classList.remove('reacting'); void bench.offsetWidth; bench.classList.add('reacting');
  A.play('charge'); A.pulse('tap');
  const ga=R.GROUPS[R.EL[a].group], gb=R.GROUPS[R.EL[b].group];
  bench.style.setProperty('--mix-a',ga.ink); bench.style.setProperty('--mix-b',gb.ink);
  reactorCharge(ga.ink,gb.ink);
  setTimeout(()=>bench.classList.add('reacting-hot'),145);
  setTimeout(()=>resolveFire(a,b), R.S.settings.motion ? 300 : 175);
}
function resolveFire(a,b){
  const bench=$('#bench'); bench.classList.remove('reacting','reacting-hot');
  const groupsBefore=R.groupsFound().length;
  const out=R.combine(a,b);
  const smartJustUnlocked=groupsBefore<6 && R.groupsFound().length>=6 && !R.S.flags.smartIntro;
  if(out.kind==='new') A.setMusicProgress(R.countCounted(),R.groupsFound().length);
  const res=$('#res');

  if(out.kind==='none'){
    failStreak++;
    const repeat=Math.max(1,R.S.flags.deadN||1);
    A.play('fail',{rate:Math.max(.78,1-(repeat-1)*.045),gain:repeat>=4?.82:1});
    face(repeat>=3?'dark':'bad');
    if(!activeHint && (failStreak===7 || failStreak===14 || (failStreak>14 && failStreak%9===0))){
      setTimeout(()=>say(failStreak===7?'Dead ends count too. <b>The lamp nudges without spoiling.</b>':'The board is not asking for genius. <b>Try something embarrassingly literal.</b>'),300);
    }
    if(R.S.settings.motion){ bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake'); }
    lastResult=null; say(keepHint());
    const dead = repeat>=5 ? [['STILL NOTHING','IT DID NOT CHANGE ITS MIND'],['CASE CLOSED','THIS PAIR IS DEAD'],['YOU ARE ARGUING WITH PHYSICS','PHYSICS IS WINNING']]
      : repeat>=3 ? [['SAME ANSWER','THE BOARD REMEMBERS THIS PAIR'],['STILL DEAD','TRY A DIFFERENT OBSESSION'],['NO NEW CHEMISTRY','MOVE ONE PIECE']]
      : repeat===2 ? [['AGAIN?','IT WAS NOTHING THE FIRST TIME TOO'],['DOUBLE CHECKED','STILL ABSOLUTELY NOTHING'],['CONFIRMED DEAD','YOU MAY RELEASE IT NOW']]
      : [['NOTHING','THE WORLD SHRUGS'],['NO REACTION','DEAD AIR'],['NOT TODAY','TRY A STRANGER PAIR'],['WRONG DOOR','KEEP MOVING'],['NOPE','THE BOARD STARES BACK'],['COLD MIX','NOT ENOUGH TROUBLE'],['FLATLINE','THE LAB HEARD NOTHING'],['BAD CHEMISTRY','USE IT AS INFORMATION'],['ZERO','SOMETHING ELSE WANTS THESE PIECES'],['UNIMPRESSED','THE BOARD EXPECTED WORSE']];
    const d=freshLine('fail-'+Math.min(repeat,5),dead);
    const failTag=(out.deadNew && R.countCounted()>=20) ? (R.has('mistake')
      ? freshLine('scar-note',['MATERIAL KEPT','THE MISS STAYS USEFUL','DEAD END → MATERIAL'])
      : freshLine('scar-note',['SCAR RECORDED','THE BOARD REMEMBERS','DEAD END KEPT'])) : d[1];
    showResult('<span class="sn">'+d[0]+'</span><span class="tag">'+failTag+'</span>','nope');
    burstAt(res,'#4a4a52','fail');
    if(failStreak>=6 && !activeHint){ const lamp=$('#bHint'); if(lamp) lamp.classList.add('asking'); }
    announceAchievements(out.ach,180);
    /* A failed reaction is a finished event. V4 left ingredient A sitting in
       the bench, which read like a sticky-selection bug on touch screens. */
    setTimeout(()=>{slotA=null;slotB=null;clearResult();busy=false;paintBench();paintGrid();},720);
    paintHeader(); return;
  }

  const e=out.el,g=R.GROUPS[e.group]; failStreak=0; const lamp=$('#bHint'); if(lamp) lamp.classList.remove('asking'); keepHint(); lastResult=e.id;
  if(out.kind==='route' && (out.routeCount||0)>=2) A.play('confluence',{gain:.88,rate:.94+Math.min(.14,(out.routeCount-2)*.025)});
  else if(!(out.kind==='new' && A.hasDiscoveryCue && A.hasDiscoveryCue(e.id))) A.play('impact');
  /* Sensory world discoveries get to own their sound field. Their dedicated cue
     begins in the reveal director below instead of fighting this generic hit. */
  setWorldInk(g.ink);
  if(out.kind==='new') worldStamp(e.name,g.ink,!!(out.major||out.secret));
  const resultTag=out.kind==='new'?'BORN':out.kind==='route'&&out.routeCount>1?'ROUTE '+out.routeCount:out.kind==='route'?'NEW ROUTE':'KNOWN';
  showResult('<span class="result-art" style="color:'+g.ink+';--art-paper-local:var(--slot-bg)">'+Art.glyphSVG(e.id)+'</span>'+ 
             '<span class="sn" style="color:'+g.ink+'">'+e.name+'</span>'+ 
             '<span class="tag">'+resultTag+'</span>',
             'got '+(out.kind==='new'?'fresh-result':out.kind==='route'&&out.routeCount>1?'confluence-result':''));

  if(out.kind==='known'||out.kind==='route'){
    if(out.kind==='known' || (out.routeCount||0)<2) setTimeout(()=>A.play(out.kind==='route'?'route':'known'),35);
    face('good');
    burstAt(res,g.ink,'hit');
    if(out.kind==='route'){
      if((out.routeCount||0)>=2){
        const rb=routeBeat(out);
        if(rb) say(rb);
        else say('ANOTHER ROAD. <b>'+e.name+'</b> STILL HOLDS.');
        relationPulse(out,g);
      } else {
        const lead=freshLine('route-copy',['ANOTHER ROAD.','SAME DESTINATION. DIFFERENT SCAR.','THE WORLD ACCEPTS MORE THAN ONE EXPLANATION.','SECOND ROUTE RECORDED.','YOU FOUND THE SIDE DOOR.']);
        say(lead+' <b>'+e.name+'</b>');
      }
    } else {
      const knownLead=freshLine('known-copy',['KNOWN.','YES. STILL TRUE.','THE BOARD REMEMBERS.','SAME CHEMISTRY.','RECORDED.']);
      say('<span style="color:var(--ink3)">'+knownLead+' '+e.flavor+'</span>');
    }
    announceAchievements(out.ach,150);
    setTimeout(()=>{slotA=null;slotB=null;busy=false;paintBench();paintGrid();},430);
    paintHeader();paintRails(); return;
  }

  const countedBorn=(e.secret?0:1)+(out.also||[]).reduce((n,x)=>n+(x.el.secret?0:1),0);
  const beforeMade=Math.max(0,R.countCounted()-countedBorn-4);
  const specialTurn=!!(out.major||out.secret||(out.also||[]).some(x=>x.el.major||x.el.secret));
  const chain=discoveryHeat(e,beforeMade,specialTurn);
  burstAt(res,g.ink,(specialTurn||chain>=4)?'major':'hit');
  say('<span style="color:var(--ink3)">'+e.flavor+'</span>');
  /* Extra outputs stay backstage until their own queued reveal. Otherwise the
     grid can spoil AND ALSO before the ceremony gets to say it. */
  (out.also||[]).forEach(x=>hideGridItem(x.el.id));
  slotA=null;slotB=null; paintBench();paintGrid();paintHeader();
  window.RizoMoments.run(out,()=>{
    busy=false; paintBench();paintGrid();paintRails();paintHeader();
    if(chain>=3 && !specialTurn) face('rizo');
    flushDiscoveryBeat();
    if(smartJustUnlocked) setTimeout(()=>{ if(!announceSmartSort()) setTimeout(announceSmartSort,1800); },1900);
  });
}

/* ── discovery card ────────────────────────────────────────────────────── */
function clearCardDismiss(){
  clearTimeout(cardDismissTimer); cardDismissTimer=null;
  if(cardDocHandler){ document.removeEventListener('pointerdown',cardDocHandler); cardDocHandler=null; }
}
function card(e, kindLabel, accent, flavour, meta){
  const host = $('#card');
  clearTimeout(cardTimer); clearCardDismiss();
  const g = R.GROUPS[e.group];
  const cardVariant=Math.abs((e.gix||0)+(meta&&Number.isFinite(meta.foundNumber)?meta.foundNumber:0))%3;
  const n = el('div','dcard dcard-v'+cardVariant);
  n.style.setProperty('--accent', accent || g.ink);
  const ordinal=meta && Number.isFinite(meta.foundNumber) ? meta.foundNumber : R.countCounted();
  const countLabel=e.secret?'OUTSIDE THE COUNT':'FOUND '+String(ordinal).padStart(3,'0');
  n.innerHTML = '<span class="dcard-art" style="--domain:'+(accent||g.ink)+';--art-paper-local:var(--card-bg);color:'+(accent||g.ink)+'">'+Art.glyphSVG(e.id,'big')+'</span>'+
    '<div class="dc-copy"><div class="dc-top"><div class="dc-t" style="color:'+(accent||g.ink)+'">'+kindLabel+'</div><div class="dc-ix">'+countLabel+'</div></div>'+
    '<div class="dc-n">'+e.name+'</div>'+
    '<div class="dc-f">'+(flavour||e.flavor)+'</div>'+
    '<div class="dc-g">'+g.name+'</div></div>';
  n.onclick = () => dropCard(n);
  host.replaceChildren(n);
  cardTimer = setTimeout(()=>dropCard(n), 3800);
  /* The card gets a minimum read beat, then the next deliberate action may
     dismiss that exact card. Old listeners must never kill a newer discovery. */
  cardDismissTimer=setTimeout(()=>{
    cardDismissTimer=null;
    cardDocHandler=()=>{ cardDocHandler=null; if(host.firstChild===n) dropCard(n); };
    document.addEventListener('pointerdown',cardDocHandler,{once:true});
  },1500);
}
function dropCard(target){
  const n = target || $('#card .dcard'); if (!n || !n.isConnected) return;
  clearTimeout(cardTimer); cardTimer=null; clearCardDismiss();
  n.classList.add('out'); setTimeout(()=>{ const h=$('#card'); if(h.firstChild===n) h.replaceChildren(); else if(n.isConnected)n.remove(); }, 180);
}
function toast(title, body, accent){
  const host = $('#card');
  /* Achievements may stack beside a discovery, but they never evict the thing
     the player just made. Cap only achievement toasts, not the reveal card. */
  const live = host.querySelectorAll('.dcard.achievement');
  if (live.length >= 2) live[0].remove();
  const n = el('div','dcard achievement');
  n.style.setProperty('--accent', accent||'var(--accent)');
  n.innerHTML = '<span style="color:'+(accent||'var(--accent)')+'">'+ICON.cup+'</span>'+
    '<div><div class="dc-t" style="color:'+(accent||'var(--accent)')+'">ACHIEVEMENT</div>'+
    '<div class="dc-n" style="font-size:15px">'+title+'</div><div class="dc-f">'+body+'</div></div>';
  n.querySelector('svg').style.cssText='width:34px;height:34px';
  n.onclick = () => n.remove();
  host.appendChild(n);
  setTimeout(()=>{ n.classList.add('out'); setTimeout(()=>n.remove(),180); }, 3400);
}

/* ── stage (the big ones) ──────────────────────────────────────────────── */
let stageGen = 0;
function stage(html, onGo, noButton, opts){
  const s = $('#stage');
  const gen = ++stageGen;            /* every stage gets its own ticket */
  const born=performance.now();
  const minHold=Math.max(0,(opts&&opts.minHold)||0);
  let pendingDone=null;
  s.onclick = null;
  s.innerHTML = '<div class="stg">'+html+(noButton?'':'<div><button class="go">CONTINUE</button></div>')+'</div>';
  s.classList.add('on');
  const done = () => {
    if (gen !== stageGen) return;    /* a newer stage already took over */
    stageGen++; clearTimeout(pendingDone); pendingDone=null;
    s.onclick = null; s.classList.remove('on'); s.innerHTML='';
    if (onGo) onGo();
  };
  const requestDone=()=>{
    if(gen!==stageGen)return;
    const wait=minHold-(performance.now()-born);
    if(wait>0){ clearTimeout(pendingDone); pendingDone=setTimeout(done,wait); }
    else done();
  };
  const btn = s.querySelector('.go');
  if (btn) btn.onclick = e => { e.stopPropagation(); requestDone(); };
  else s.onclick = requestDone;
  return done;
}
function flash(){ if(!R.S.settings.motion) return; const f=$('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

function resetTransient(){
  slotA=null; slotB=null; busy=false; lastResult=null; activeHint=''; failStreak=0;
  discoveryChain=0; lastDiscoveryAt=0; lastHeaderFound=null; pendingDiscoveryBeat=null; hiddenReveals.clear();
  Object.keys(lineMemory).forEach(k=>delete lineMemory[k]);
  /* Cached element nodes carry one-shot birth state. A new/imported board must
     get genuinely new tiles rather than recycled DOM that already 'was born'. */
  nodeCache.clear();
  clearTimeout(cardTimer); clearCardDismiss(); clearTimeout(resultCueTimer); clearTimeout(chainTimer); clearTimeout(pulseTimer);
  cardTimer=resultCueTimer=chainTimer=pulseTimer=null;
  filter={group:null,fresh:false,fav:false,recent:false,smart:false,manualAll:false,q:''};
  document.body.classList.remove('heat-mode','heat-high','world-hit');
  const search=$('#search'); if(search) search.value='';
  paintToolState();
  const cardHost=$('#card'); if(cardHost) cardHost.replaceChildren();
  const chainHost=$('#chain'); if(chainHost){chainHost.classList.remove('on');chainHost.replaceChildren();}
}

window.RizoUI = {
  $, el, ICON, markSVG, face, splat, centreOf, burstAt, screenKick, heatPulse, discoveryHeat, setWorldInk,
  paintHeader, paintRails, paintGrid, paintBench, showResult, clearResult, say, setHint,
  card, toast, stage, flash, dropCard, useResult,
  get filter(){ return filter; },
  setFilter(f){ filter = Object.assign({group:null,fresh:false,fav:false,recent:false,smart:false,manualAll:false,q:''},f||{}); paintRails(); paintGrid(); },
  smartAvailable, smartActive, paintToolState, scrollGridTop, announceSmartSort,
  pick, clearSlot, blinkLoop, resetTransient, flushDiscoveryBeat, hideGridItem, revealGridItem, revealAllGridItems,
  setSlots(a,b){ slotA=a; slotB=b; paintBench(); paintGrid(); },
  get slots(){ return [slotA, slotB]; },
  set busy(v){ busy = v; }, get busy(){ return busy; }
};
})();
