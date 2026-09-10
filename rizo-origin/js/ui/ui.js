/* RIZO ORIGIN — interface.
   One screen, two slots, one grid. Everything else gets out of the way. */
(function(){
const R = window.Rizo, A = window.RizoAudio, Art = window.RizoArt;
const $  = s => document.querySelector(s);
const el = (t,c,h) => { const n=document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n; };

let slotA = null, slotB = null, busy = false, lastResult = null;
let filter = { group:null, fresh:false, fav:false, q:'' };
let cardTimer = null, failStreak = 0;

const ICON = {
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

/* ── header ────────────────────────────────────────────────────────────── */
function paintHeader(){
  const found = R.countCounted(), sec = R.countSecret();
  const p = $('#pFound');
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
}

/* ── domain rails ──────────────────────────────────────────────────────── */
function paintRails(){
  const found = R.groupsFound();
  const tease = R.countFound() >= 10 && R.nearNewDomain();
  const build = (host, compact) => {
    host.innerHTML = '';
    if (!compact) host.appendChild(el('div','railhead','DOMAINS'));
    const all = el('button','gbtn'+(filter.group===null&&!filter.fresh&&!filter.fav?' sel':''));
    all.innerHTML = '<span class="gdot" style="background:var(--ink3)"></span><span class="gname">EVERYTHING</span><span class="gnum">'+R.countFound()+'</span>';
    all.onclick = () => { filter={group:null,fresh:false,fav:false,q:filter.q}; paintRails(); paintGrid(); };
    host.appendChild(all);
    found.forEach(gid => {
      const g = R.GROUPS[gid], size = R.groupSize(gid);
      const b = el('button','gbtn'+(filter.group===gid?' sel':''));
      const done = R.groupComplete(gid);
      const n = (R.S.revealed && size) ? R.groupFoundCount(gid)+'/'+size : R.groupFoundAll(gid);
      b.innerHTML = '<span class="gdot" style="background:'+g.ink+'"></span>'+
        '<span class="gname" style="'+(filter.group===gid?'color:'+g.ink:'')+'">'+g.name+'</span>'+
        '<span class="gnum">'+n+(done?' ✓':'')+'</span>';
      b.onclick = () => { filter={group:gid,fresh:false,fav:false,q:filter.q}; paintRails(); paintGrid(); };
      host.appendChild(b);
    });
    if (!compact && found.length){
      // sign-off added after the teaser, below
    }
    if (tease){
      const t = el('button','gbtn unknown');
      t.innerHTML = '<span class="gdot"></span><span class="gname">?????</span>';
      t.title = 'Something is close.';
      t.onclick = () => { A.play('tap'); say('Something you can already reach opens a door you have not seen.'); };
      host.appendChild(t);
    }
  };
  build($('#rail'), false);
  build($('#mrail'), true);
  $('#rail').appendChild(el('div','railfoot','RIZO ORIGIN<br>NO FAMOUS'));
}

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
    n.setAttribute('role','listitem');
    n.setAttribute('aria-label', e.name);
    n.innerHTML = '<span style="color:'+g.ink+';display:block">'+Art.glyphSVG(id)+'</span><span class="en">'+e.name+'</span>';
    nodeCache.set(id, n);
  }
  const cls = 'el'+(R.S.fresh[id]?' new':'')+(R.S.favs[id]?' fav':'')+((slotA===id||slotB===id)?' sel':'');
  if (n.className !== cls) n.className = cls;
  return n;
}
let gridPaint = null;
function paintGrid(){
  cancelAnimationFrame(gridPaint);
  gridPaint = requestAnimationFrame(() => {
    const host = $('#grid');
    const list = R.elementsIn(filter);
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
  return '<span style="color:'+g.ink+';display:block">'+Art.glyphSVG(id)+'</span><span class="sn">'+e.name+'</span>'+
         '<span class="x">'+ICON.x+'</span>';
}
function paintBench(){
  const a = $('#slotA'), b = $('#slotB');
  a.className = 'slot'+(slotA?' full':''); a.innerHTML = slotHTML(slotA);
  b.className = 'slot'+(slotB?' full':''); b.innerHTML = slotHTML(slotB);
}
function showResult(html, cls){
  const r = $('#res');
  r.className = 'result '+(cls||'');
  r.innerHTML = html;
  if (R.S.settings.motion){ r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); }
}
function clearResult(){ lastResult = null; $('#res').className='result empty'; $('#res').innerHTML='<span class="ph">?</span>'; }
function useResult(){ if (lastResult && !busy) pick(lastResult); }
let activeHint = '';
function say(html){ $('#hintline').innerHTML = html || ''; }
function setHint(html){ activeHint = html; say(html); }
function keepHint(){ if (activeHint && !R.hintState().armed) activeHint = ''; return activeHint; }

/* ── selection ─────────────────────────────────────────────────────────── */
function pick(id, node){
  if (busy) return;
  A.unlock();
  /* tapping the same thing twice is a self-combination, not a mistake */
  if (!slotA){ slotA = id; A.play('tap'); }
  else if (!slotB){ slotB = id; A.play('tap'); }
  else { slotB = id; A.play('tap'); }
  if (R.S.fresh[id]){ delete R.S.fresh[id]; R.autosave(); }
  paintBench(); paintGrid();
  if (slotA && slotB) setTimeout(()=>fire(node), 90);
}
function clearSlot(which){
  if (busy) return;
  if (which==='a'){ slotA = slotB; slotB = null; } else slotB = null;
  A.play('untap'); paintBench(); paintGrid(); clearResult();
}

/* ── the moment ────────────────────────────────────────────────────────── */
function fire(fromNode){
  const a = slotA, b = slotB;
  if (!a || !b) return;
  busy = true;
  const out = R.combine(a, b);
  const bench = $('#bench');

  if (out.kind === 'none'){
    A.play('fail'); face('bad');
    failStreak++;
    if (!activeHint && (failStreak === 11 || (failStreak > 11 && failStreak % 9 === 0))){
      setTimeout(() => say('Nothing for a while. <b>The lamp gives hints</b>, and they are free.'), 300);
    }
    if (R.S.settings.motion){ bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake'); }
    lastResult = null; say(keepHint());
    showResult('<span class="sn">NOTHING</span><span class="tag">TRY ANOTHER</span>', 'nope');
    const c = centreOf($('#res')); splat(c.x, c.y, '#4a4a52', 8, 34);
    setTimeout(()=>{ slotB=null; busy=false; paintBench(); paintGrid(); }, 260);
    paintHeader();
    return;
  }

  const e = out.el, g = R.GROUPS[e.group];
  failStreak = 0; keepHint();
  lastResult = e.id;
  showResult('<span style="color:'+g.ink+';display:block">'+Art.glyphSVG(e.id)+'</span>'+
             '<span class="sn" style="color:'+g.ink+'">'+e.name+'</span>'+
             '<span class="tag">'+(out.kind==='new'?'NEW':out.kind==='route'?'ANOTHER WAY':'KNOWN')+'</span>',
             'got');

  if (out.kind === 'known' || out.kind === 'route'){
    A.play('known'); face('good');
    splat(centreOf($('#res')).x, centreOf($('#res')).y, g.ink, out.kind==='route'?10:6, 40);
    say(out.kind==='route' ? 'Another road to the same place. <b>'+e.name+'</b>' : '<span style="color:var(--ink3)">'+e.flavor+'</span>');
    setTimeout(()=>{ slotA = null; slotB = null; busy = false; paintBench(); paintGrid(); }, 200);
    paintHeader(); paintRails();
    return;
  }

  /* discovery */
  const c = centreOf($('#res'));
  splat(c.x, c.y, g.ink, out.major?30:18, out.major?110:70);
  say('<span style="color:var(--ink3)">'+e.flavor+'</span>');
  slotA = null; slotB = null; paintBench(); paintGrid();
  window.RizoMoments.run(out, () => {
    busy = false;
    paintBench(); paintGrid(); paintRails(); paintHeader();
  });
}

/* ── discovery card ────────────────────────────────────────────────────── */
function card(e, kindLabel, accent, flavour){
  const host = $('#card');
  clearTimeout(cardTimer);
  const g = R.GROUPS[e.group];
  const n = el('div','dcard');
  n.style.setProperty('--accent', accent || g.ink);
  n.innerHTML = '<span style="color:'+(accent||g.ink)+'">'+Art.glyphSVG(e.id,'big')+'</span>'+
    '<div><div class="dc-t" style="color:'+(accent||g.ink)+'">'+kindLabel+'</div>'+
    '<div class="dc-n">'+e.name+'</div>'+
    '<div class="dc-f">'+(flavour||e.flavor)+'</div>'+
    '<div class="dc-g">'+g.name+'</div></div>';
  n.onclick = () => dropCard();
  host.replaceChildren(n);
  cardTimer = setTimeout(dropCard, 2400);
  /* any tap anywhere gets rid of it */
  setTimeout(() => document.addEventListener('pointerdown', dropCard, { once:true }), 240);
}
function dropCard(){
  const n = $('#card .dcard'); if (!n) return;
  n.classList.add('out'); setTimeout(()=>{ const h=$('#card'); if(h.firstChild===n) h.replaceChildren(); }, 180);
}
function toast(title, body, accent){
  const host = $('#card');
  const live = host.querySelectorAll('.dcard');
  if (live.length >= 3) live[0].remove();
  const n = el('div','dcard');
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
function stage(html, onGo, noButton){
  const s = $('#stage');
  const gen = ++stageGen;            /* every stage gets its own ticket */
  s.onclick = null;
  s.innerHTML = '<div class="stg">'+html+(noButton?'':'<div><button class="go">CONTINUE</button></div>')+'</div>';
  s.classList.add('on');
  const done = () => {
    if (gen !== stageGen) return;    /* a newer stage already took over */
    stageGen++;
    s.onclick = null; s.classList.remove('on'); s.innerHTML='';
    if (onGo) onGo();
  };
  const btn = s.querySelector('.go');
  if (btn) btn.onclick = e => { e.stopPropagation(); done(); };
  else s.onclick = done;
  return done;
}
function flash(){ if(!R.S.settings.motion) return; const f=$('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

window.RizoUI = {
  $, el, ICON, markSVG, face, splat, centreOf,
  paintHeader, paintRails, paintGrid, paintBench, showResult, clearResult, say, setHint,
  card, toast, stage, flash, dropCard, useResult,
  get filter(){ return filter; },
  setFilter(f){ filter = f; paintRails(); paintGrid(); },
  pick, clearSlot, blinkLoop,
  setSlots(a,b){ slotA=a; slotB=b; paintBench(); paintGrid(); },
  get slots(){ return [slotA, slotB]; },
  set busy(v){ busy = v; }, get busy(){ return busy; }
};
})();
