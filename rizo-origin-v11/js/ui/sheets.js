/* RIZO ORIGIN — the drawers: what you found, what you earned, what you can break. */
(function(){
const R = window.Rizo, A = window.RizoAudio, U = window.RizoUI, Art = window.RizoArt;
const $ = U.$, el = U.el;

let openSheet = null, bookState = { q:'', mode:'all', open:null };

function shell(title, bodyHTML, tabs){
  const s = $('#sheet');
  s.innerHTML =
    '<div class="sh" role="dialog" aria-modal="true">'+
      '<div class="shhead"><h2>'+title+'</h2><button class="iconbtn" id="shX">'+U.ICON.x+'</button></div>'+
      (tabs || '')+
      '<div class="shbody" id="shBody">'+bodyHTML+'</div>'+
    '</div>';
  s.classList.add('on');
  $('#shX').onclick = close;
  s.onclick = e => { if (e.target === s) close(); };
  A.play('open');
}
function close(){ const s=$('#sheet'); if(!s.classList.contains('on'))return; s.classList.remove('on'); s.innerHTML=''; openSheet=null; A.play('close'); }


function resetTransient(){
  openSheet=null; bookState={q:'',mode:'all',open:null};
  const s=$('#sheet'); if(s){s.classList.remove('on');s.innerHTML='';}
}

/* ── encyclopedia ──────────────────────────────────────────────────────── */
function book(){
  openSheet = 'book';
  const tabs = '<div class="shtabs" id="bkTabs">'+
    '<input id="bkQ" style="flex:1;min-width:110px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:7px 10px;font:400 12px/1.2 var(--mono);letter-spacing:.06em;color:var(--ink);outline:none" placeholder="SEARCH">'+
    '<button class="chip" data-m="all">ALL</button>'+
    '<button class="chip" data-m="new">NEW</button>'+
    '<button class="chip" data-m="fav">FAVOURITES</button>'+
    '<button class="chip" data-m="recent">RECENT</button>'+
    '</div>';
  shell('DISCOVERIES', '<div id="bkList"></div>', tabs);
  $('#bkQ').value = bookState.q;
  $('#bkQ').oninput = e => { bookState.q = e.target.value; paintBook(); };
  $('#bkTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    bookState.mode = b.dataset.m; paintBook(); A.play('tap');
  });
  paintBook();
}
function paintBook(){
  document.querySelectorAll('#bkTabs .chip').forEach(c => c.classList.toggle('on', c.dataset.m===bookState.mode));
  let list = bookState.mode==='recent' ? R.elementsIn({recent:true}).slice(0,30) : R.EL_ORDER.filter(R.has);
  if (bookState.mode==='new')  list = list.filter(id => R.S.fresh[id]);
  if (bookState.mode==='fav')  list = list.filter(id => R.S.favs[id]);
  if (bookState.q){
    const q = bookState.q.toLowerCase();
    list = list.filter(id => R.EL[id].name.toLowerCase().includes(q) || R.EL[id].flavor.toLowerCase().includes(q));
  }
  const host = $('#bkList'); if (!host) return;
  if (!list.length){ host.innerHTML = '<div class="empty">NOTHING HERE</div>'; return; }

  const frag = document.createDocumentFragment();
  let lastG = null;
  list.forEach(id => {
    const e = R.EL[id], g = R.GROUPS[e.group];
    if (bookState.mode==='all' && !bookState.q && e.group !== lastG){
      lastG = e.group;
      const h = el('div','railhead');
      h.style.cssText = 'color:'+g.ink+';padding:16px 0 4px';
      h.textContent = g.name + '  ·  ' + ((R.S.revealed && R.groupSize(g.id)) ? R.groupFoundCount(g.id)+' / '+R.groupSize(g.id) : R.groupFoundAll(g.id));
      frag.appendChild(h);
    }
    const row = el('div','row');
    const origins=R.routesTo(id);
    row.innerHTML =
      '<span style="color:'+g.ink+';display:block">'+Art.glyphSVG(id)+'</span>'+
      '<div class="rt"><div class="rn" style="color:'+g.ink+'">'+e.name+(R.S.fresh[id]?' <span style="color:var(--accent)">•</span>':'')+(origins.length>1?' <span class="route-badge">'+origins.length+' ROUTES</span>':'')+'</div>'+
      '<div class="rf">'+e.flavor+'</div>'+
      '<div class="rg">'+g.name+(e.secret?'  ·  ANOMALY':'')+'</div></div>'+
      '<button class="fav'+(R.S.favs[id]?' on':'')+'" data-fav="'+id+'">'+(R.S.favs[id]?U.ICON.star:U.ICON.starO)+'</button>';
    row.onclick = ev => {
      if (ev.target.closest('[data-fav]')) return;
      const opening=bookState.open!==id;
      bookState.open = opening ? id : null;
      A.play(opening?'open':'close',{gain:.65}); paintBook();
    };
    frag.appendChild(row);
    if (bookState.open === id){
      const madeBy = R.routesTo(id), makes = R.recipesUsing(id);
      const box = el('div','recipes recipe-ledger');
      if (!madeBy.length && !makes.length) box.innerHTML = '<span class="rc" style="color:var(--ink3)">NO ROUTES RECORDED YET</span>';
      if(madeBy.length){
        const lab=el('div','recipe-label'+(madeBy.length>1?' relation':'') , madeBy.length>1 ? 'WAYS THIS IS TRUE // '+madeBy.length+' ROUTES HOLD' : 'MADE BY');
        box.appendChild(lab);
        madeBy.slice(0,12).forEach(r => box.appendChild(el('span','rc'+(madeBy.length>1?' relation-route':''), R.EL[r.a].name+'<em>+</em>'+R.EL[r.b].name+'<em>=</em>'+R.EL[r.out].name)));
      }
      if(makes.length){
        box.appendChild(el('div','recipe-label','WHAT IT HAS MADE'));
        makes.slice(0,16).forEach(r => box.appendChild(el('span','rc', R.EL[r.a].name+'<em>+</em>'+R.EL[r.b].name+'<em>=</em>'+R.EL[r.out].name)));
      }
      frag.appendChild(box);
    }
  });
  host.replaceChildren(frag);
  host.querySelectorAll('[data-fav]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.fav;
    if (R.S.favs[id]) delete R.S.favs[id]; else R.S.favs[id] = 1;
    R.autosave(); A.play('tap'); paintBook(); U.paintGrid();
  });
  R.autosave(); U.paintGrid(); U.paintHeader();
}

/* ── achievements ──────────────────────────────────────────────────────── */
function trophies(){
  openSheet = 'ach';
  const got = Object.keys(R.S.ach).length;
  let html = '<div class="stat"><span>EARNED</span><b>'+got+' / '+R.ACH.length+'</b></div>'+
             '<div class="bar"><i style="width:'+Math.round(got/R.ACH.length*100)+'%"></i></div>';
  R.ACH.forEach(a => {
    const has = !!R.S.ach[a.id];
    const hide = a.hidden && !has;
    html += '<div class="ach'+(has?' got':'')+'">'+
      '<div class="bx">'+(has?'✓':(hide?'?':'·'))+'</div>'+
      '<div><div class="an">'+(hide?'—— HIDDEN ——':a.name)+'</div>'+
      '<div class="ad">'+(hide?'Something is still out there.':a.desc)+'</div></div></div>';
  });
  shell('ACHIEVEMENTS', html);
}

/* ── RIZO signal / bridge ─────────────────────────────────────────────── */
async function shareBoard(){
  const c=R.countCounted();
  const text=c>4 ? 'I found '+c+' things in RIZO ORIGIN. It starts with four. Beat me.' : 'Four things. No map. See how far you get.';
  const payload={ title:'RIZO ORIGIN', text, url:location.href };
  try{
    if(navigator.share){ await navigator.share(payload); A.play('found',{gain:.7}); U.heatPulse('BOARD SENT','NOW LET THEM GET STUCK.','var(--rizo)'); return; }
  }catch(e){ if(e && e.name==='AbortError') return; }
  try{
    await navigator.clipboard.writeText(text+'\n'+location.href);
    U.toast('BOARD LINK COPIED','Send it to somebody who thinks they can do better.','var(--rizo)'); A.play('found',{gain:.7});
  }catch(e){
    U.toast('COPY THE ADDRESS','Your browser blocked automatic copying.','var(--bad)'); A.play('fail',{gain:.55});
  }
}

function signal(){
  openSheet='signal';
  const c=R.countCounted(), foundRizo=R.has('rizo'), converged=R.confluenceCount(), groups=R.groupsFound().length;
  let html='<div class="signal-head">'+U.markSVG('signal-mark',true)+
    '<div><div class="railhead" style="padding:0 0 7px;color:var(--rizo)">RIZO SIGNAL // RECEIVED</div>'+ 
    '<div class="signal-title">THE BOARD HAS BEEN LEAKING.</div></div></div>';

  html+='<div class="signal-tx"><span>TRANSMISSION 01</span><b>MAKE BEFORE YOU KNOW.</b>'+ 
    '<p>You have been practicing the rule the entire time: make something, miss, learn what survived, make again.</p></div>';

  if(c>=50 || foundRizo){
    html+='<div class="signal-tx"><span>TRANSMISSION 02</span><b>THE MISTAKE IS MATERIAL.</b>'+ 
      '<p>RIZO is not perfection first. It is authorship first. The rough attempt is allowed to become the language.</p></div>';
  }
  if(c>=100 || foundRizo){
    html+='<div class="signal-tx"><span>TRANSMISSION 03</span><b>NO FAMOUS.</b>'+ 
      '<p>Do not chase being known. Make something specific enough that the right people recognize it.</p></div>';
  }
  /* These arrive because of things the player has actually experienced, not
     because a lore menu decided it was time to lecture them. */
  if(converged>=1 || R.has('confluence')){
    html+='<div class="signal-tx relation"><span>TRANSMISSION // RELATION</span><b>TWO THINGS CAN BE TRUE.</b>'+ 
      '<p>The board already proved it: different roads can survive the same test. When both hold, the missing information may be the relationship between them.</p></div>';
  }
  if(groups>=6){
    html+='<div class="signal-tx breath"><span>TRANSMISSION // SHAPE</span><b>THE SHAPE SHOULD BREATHE.</b>'+ 
      '<p>When one pile stopped serving the world, the board changed shape. Structure is a tool. It should move when the thing inside it moves.</p></div>';
  }
  if(R.has('sovereign')){
    html+='<div class="signal-tx"><span>TRANSMISSION // SOVEREIGN</span><b>NO THRONE. STILL IN CHARGE.</b>'+ 
      '<p>The board can suggest a route. It does not own your route. Use the lamp or do not. Authorship stays with you.</p></div>';
  }
  if(R.has('blueprint')){
    html+='<div class="signal-tx breath"><span>TRANSMISSION // BLUEPRINT</span><b>THE MAP CAN COME AFTER THE TERRITORY.</b>'+
      '<p>You are allowed to make the thing before you can explain the thing. Sometimes the blueprint is what you draw after you finally understand what you built.</p></div>';
  }
  if(foundRizo){
    html+='<div class="signal-tx hot"><span>TRANSMISSION // SOURCE FOUND</span><b>YOU FOUND RIZO INSIDE RIZO.</b>'+ 
      '<p>That is the joke and the thesis. The brand is one artifact. The impulse to create before certainty is the larger world.</p></div>';
  }

  let portal='This game is one door. RIZO exists outside it.';
  if(R.has('rizoworld')) portal='You made RIZO WORLD. This board is one artifact from it. The clothing is another.';
  else if(R.has('rizotee')) portal='You made a RIZO TEE in here. Outside the board, RIZO began as clothing.';
  else if(R.has('rizologo')) portal='You found the mark in here. Outside the board, people can actually wear it.';
  html+='<div class="signal-portal"><div class="railhead" style="padding:0 0 7px">OUTSIDE THE BOARD</div>'+ 
    '<p>'+portal+'</p>'+ 
    '<div class="btnrow"><a class="btn signal-link" href="https://rizo.store" target="_blank" rel="noopener">ENTER RIZO.STORE ↗</a>'+ 
    '<button class="btn" id="bShareSignal">SHARE THE BOARD</button></div></div>';

  shell('RIZO SIGNAL',html);
  const share=$('#bShareSignal'); if(share) share.onclick=shareBoard;
  R.S.flags.signalIntro=1; R.autosave();
}

/* ── adaptive domain index ────────────────────────────────────────────── */
function domains(){
  openSheet='domains';
  const found=R.groupsFound(), recent=found.slice(-3).reverse();
  let html='<div class="domain-picker-intro"><div class="railhead" style="padding:0 0 6px">THE WORLD GOT TOO BIG FOR A SIDEWAYS LIST.</div>'+ 
    '<p>Pick a shelf. The newest doors stay near the top automatically.</p></div>';
  html+='<div class="domain-picker-actions">';
  if(U.smartAvailable()) html+='<button class="domain-card smart-domain" data-mode="smart"><span class="domain-symbol">⌁</span><b>WORKING SET</b><small>'+R.smartLimit()+' PIECES PULLED FORWARD</small></button>';
  html+='<button class="domain-card" data-mode="all"><span class="domain-symbol">◇</span><b>EVERYTHING</b><small>'+R.countCounted()+' KNOWN</small></button></div>';
  if(recent.length){
    html+='<div class="railhead domain-subhead">NEWEST DOORS</div><div class="domain-picker-grid newest">';
    recent.forEach(gid=>{const g=R.GROUPS[gid];html+=domainCard(gid,g,true);});
    html+='</div>';
  }
  html+='<div class="railhead domain-subhead">ALL OPEN DOMAINS</div><div class="domain-picker-grid">';
  found.forEach(gid=>{const g=R.GROUPS[gid];html+=domainCard(gid,g,false);});
  html+='</div>';
  shell('DOMAINS // '+found.length+' OPEN',html);
  const body=$('#shBody'); if(!body)return;
  body.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
    const m=b.dataset.mode;
    U.setFilter({group:null,fresh:false,fav:false,recent:false,smart:m==='smart',manualAll:m==='all',q:''});
    const q=$('#search');if(q)q.value='';close();U.scrollGridTop();A.play('tap');
  });
  body.querySelectorAll('[data-domain]').forEach(b=>b.onclick=()=>{
    U.setFilter({group:b.dataset.domain,fresh:false,fav:false,recent:false,smart:false,manualAll:false,q:''});
    const q=$('#search');if(q)q.value='';close();U.scrollGridTop();A.play('tap');
  });
}
function domainCard(gid,g,isRecent){
  const count=R.groupFoundCount(gid), total=R.groupSize(gid), done=R.groupComplete(gid), all=R.groupFoundAll(gid), anomaly=Math.max(0,all-count);
  const n=R.S.revealed&&total?count+' / '+total:all+' FOUND';
  return '<button class="domain-card'+(done?' complete':'')+'" data-domain="'+gid+'" style="--domain:'+g.ink+'">'+
    '<span class="domain-glyph"><i></i></span><b>'+g.name+'</b><small>'+n+(anomaly?' · +'+anomaly:'')+(done?' · COMPLETE':'')+'</small>'+(isRecent?'<em>NEW DOOR</em>':'')+'</button>';
}

/* ── stats + settings ──────────────────────────────────────────────────── */
function menu(){
  openSheet = 'menu';
  const s = R.S.stats, mins = Math.round(R.playedMs()/60000);
  const rev = R.S.revealed;
  const line = (k,v) => '<div class="stat"><span>'+k+'</span><b>'+v+'</b></div>';
  let html = '<div class="railhead" style="padding:0 0 6px">RECORD</div>';
  html += line('DISCOVERED', R.countCounted() + (rev ? ' / '+R.TOTAL_COUNTED : ''));
  if (rev) html += '<div class="bar"><i style="width:'+Math.round(R.progress()*100)+'%"></i></div>';
  html += line('ANOMALIES', R.countSecret() + (R.S.ended ? ' / '+R.TOTAL_SECRET : ''));
  html += line('DOMAINS OPEN', R.groupsFound().length + (rev ? ' / '+R.GROUP_ORDER.length : ''));
  html += line('RECIPES FOUND', Object.keys(R.S.recipes).length);
  if(Object.keys(R.S.dead).length) html += line('DEAD ENDS REMEMBERED', Object.keys(R.S.dead).length);
  if(R.confluenceCount()) html += line('RESULTS WITH >1 ROUTE', R.confluenceCount());
  html += line('ACHIEVEMENTS', Object.keys(R.S.ach).length+' / '+R.ACH.length);
  html += line('ATTEMPTS', s.attempts);
  html += line('THAT DID NOTHING', s.fails);
  html += line('HINTS TAKEN', s.hints);
  html += line('TIME IN HERE', mins>=60 ? Math.floor(mins/60)+'h '+(mins%60)+'m' : mins+'m');
  html += line('LAST DISCOVERY', s.last ? R.EL[s.last].name : '—');
  if (!rev) html += '<div class="note">The rest of the numbers stay off until you have gone far enough to deserve them.</div>';

  html += '<div class="railhead" style="padding:18px 0 6px">SETTINGS</div>';
  html += '<div class="setrow"><span>SOUND</span><button class="tg'+(!R.S.settings.muted?' on':'')+'" id="tgSound"><i></i></button></div>';
  html += '<div class="setrow"><span>AUDIO CHECK <small id="audioState" style="color:var(--ink3)">'+A.state.toUpperCase()+'</small></span><button class="btn mini" id="bAudioTest">TEST SOUND</button></div>';
  html += '<div class="setrow"><span>ANIMATION</span><button class="tg'+(R.S.settings.motion?' on':'')+'" id="tgMotion"><i></i></button></div>';

  html += '<div class="railhead" style="padding:18px 0 6px">SAVE</div>';
  html += '<div class="note">Everything lives in this browser, on this machine. Nothing is sent anywhere.</div>';
  html += '<div class="btnrow"><button class="btn" id="bExp">EXPORT</button><button class="btn" id="bImp">IMPORT</button>'+
          '<button class="btn danger" id="bWipe">NEW GAME</button></div>';
  html += '<div id="ioBox" style="margin-top:12px"></div>';
  if(R.countCounted()>=25 || R.has('rizo')){
    html += '<div class="railhead" style="padding:22px 0 6px;color:var(--rizo)">RIZO SIGNAL</div>';
    html += '<div class="note">Something has been bleeding through the board.</div><div class="btnrow"><button class="btn" id="bSignal">OPEN TRANSMISSION</button></div>';
  }
  html += '<div class="railhead" style="padding:22px 0 6px">INVITE SOMEBODY</div>';
  html += '<div class="note">Four things. No map. See if they get farther than you.</div><div class="btnrow"><button class="btn" id="bShareBoard">SHARE THE BOARD</button></div>';
  html += '<div class="railhead" style="padding:22px 0 6px">ABOUT</div>';
  html += '<div class="note">RIZO ORIGIN. Four things, and whatever you do with them.<br>'+
          'Built as one page. No account, no server, no adverts, no purchases, no hint you have to pay for.</div>';
  shell('THE BOARD', html);

  const sigBtn=$('#bSignal'); if(sigBtn) sigBtn.onclick=signal;
  const shareBtn=$('#bShareBoard'); if(shareBtn) shareBtn.onclick=shareBoard;
  $('#tgSound').onclick = () => {
    R.S.settings.muted = !R.S.settings.muted; A.muted = R.S.settings.muted;
    if (!R.S.settings.muted){ A.armFromGesture('wake').then(()=>A.startAmbient()); }
    R.save(); U.paintHeader(); menu();
  };
  $('#bAudioTest').onclick = () => {
    if(R.S.settings.muted){ R.S.settings.muted=false; A.muted=false; R.save(); }
    A.armFromGesture('origin').then(ok=>{
      if(ok) A.startAmbient();
      const st=$('#audioState'); if(st) st.textContent=(ok?A.backend:'BLOCKED').toUpperCase();
      U.paintHeader();
    });
  };
  $('#tgMotion').onclick = () => {
    R.S.settings.motion = !R.S.settings.motion; R.S.settings.motionUserSet=true;
    document.documentElement.classList.toggle('reduced', !R.S.settings.motion);
    A.play('tap'); R.save(); menu();
  };
  $('#bExp').onclick = () => {
    $('#ioBox').innerHTML = '<div class="note" style="margin:0 0 6px">Copy this somewhere safe.</div><textarea readonly id="ioT"></textarea>';
    $('#ioT').value = R.exportSave(); $('#ioT').select();
  };
  $('#bImp').onclick = () => {
    $('#ioBox').innerHTML = '<div class="note" style="margin:0 0 6px">Paste a save and load it. This replaces what you have.</div>'+
      '<textarea id="ioT" placeholder="PASTE HERE"></textarea><div class="btnrow"><button class="btn" id="ioGo">LOAD IT</button></div>';
    $('#ioGo').onclick = () => {
      if (R.importSave($('#ioT').value)){ close(); window.RizoMain.repaintAll(); A.play('found'); }
      else { $('#ioBox').insertAdjacentHTML('beforeend','<div class="note" style="color:var(--bad)">That is not a RIZO save.</div>'); A.play('fail'); }
    };
  };
  $('#bWipe').onclick = () => {
    $('#ioBox').innerHTML = '<div class="note" style="color:var(--bad);margin:0 0 6px">This erases everything you have found. There is no undo.</div>'+
      '<div class="btnrow"><button class="btn danger" id="ioYes">YES, BURN IT</button><button class="btn" id="ioNo">KEEP IT</button></div>';
    $('#ioNo').onclick = () => { $('#ioBox').innerHTML=''; };
    $('#ioYes').onclick = () => {
      R.blank(); R.resetHint(); R.save(); close(); A.play('fail');
      if(window.RizoMain && window.RizoMain.restartFresh) window.RizoMain.restartFresh();
      else location.reload();
    };
  };
}

window.RizoSheets = { book, trophies, menu, signal, shareBoard, domains, close, resetTransient, get open(){ return openSheet; } };
})();
