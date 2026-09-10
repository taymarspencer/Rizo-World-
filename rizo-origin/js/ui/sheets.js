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
  let list = R.EL_ORDER.filter(R.has);
  if (bookState.mode==='new')  list = list.filter(id => R.S.fresh[id]);
  if (bookState.mode==='fav')  list = list.filter(id => R.S.favs[id]);
  if (bookState.mode==='recent') list = list.slice(-30).reverse();
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
    row.innerHTML =
      '<span style="color:'+g.ink+';display:block">'+Art.glyphSVG(id)+'</span>'+
      '<div class="rt"><div class="rn" style="color:'+g.ink+'">'+e.name+(R.S.fresh[id]?' <span style="color:var(--accent)">•</span>':'')+'</div>'+
      '<div class="rf">'+e.flavor+'</div>'+
      '<div class="rg">'+g.name+(e.secret?'  ·  ANOMALY':'')+'</div></div>'+
      '<button class="fav'+(R.S.favs[id]?' on':'')+'" data-fav="'+id+'">'+(R.S.favs[id]?U.ICON.star:U.ICON.starO)+'</button>';
    row.onclick = ev => {
      if (ev.target.closest('[data-fav]')) return;
      bookState.open = bookState.open===id ? null : id;
      paintBook();
    };
    frag.appendChild(row);
    if (bookState.open === id){
      const rec = R.knownRecipesFor(id);
      const box = el('div','recipes');
      if (!rec.length) box.innerHTML = '<span class="rc" style="color:var(--ink3)">NO ROUTES RECORDED YET</span>';
      else rec.slice(0,24).forEach(r => {
        box.appendChild(el('span','rc', R.EL[r.a].name+'<em>+</em>'+R.EL[r.b].name+'<em>=</em>'+R.EL[r.out].name));
      });
      frag.appendChild(box);
    }
    if (R.S.fresh[id] && bookState.mode!=='new'){ delete R.S.fresh[id]; }
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

/* ── stats + settings ──────────────────────────────────────────────────── */
function menu(){
  openSheet = 'menu';
  const s = R.S.stats, mins = Math.round((s.played||0)/60000);
  const rev = R.S.revealed;
  const line = (k,v) => '<div class="stat"><span>'+k+'</span><b>'+v+'</b></div>';
  let html = '<div class="railhead" style="padding:0 0 6px">RECORD</div>';
  html += line('DISCOVERED', R.countCounted() + (rev ? ' / '+R.TOTAL_COUNTED : ''));
  if (rev) html += '<div class="bar"><i style="width:'+Math.round(R.progress()*100)+'%"></i></div>';
  html += line('ANOMALIES', R.countSecret() + (R.S.ended ? ' / '+R.TOTAL_SECRET : ''));
  html += line('DOMAINS OPEN', R.groupsFound().length + (rev ? ' / '+R.GROUP_ORDER.length : ''));
  html += line('RECIPES FOUND', Object.keys(R.S.recipes).length);
  html += line('ACHIEVEMENTS', Object.keys(R.S.ach).length+' / '+R.ACH.length);
  html += line('ATTEMPTS', s.attempts);
  html += line('THAT DID NOTHING', s.fails);
  html += line('HINTS TAKEN', s.hints);
  html += line('TIME IN HERE', mins>=60 ? Math.floor(mins/60)+'h '+(mins%60)+'m' : mins+'m');
  html += line('LAST DISCOVERY', s.last ? R.EL[s.last].name : '—');
  if (!rev) html += '<div class="note">The rest of the numbers stay off until you have gone far enough to deserve them.</div>';

  html += '<div class="railhead" style="padding:18px 0 6px">SETTINGS</div>';
  html += '<div class="setrow"><span>SOUND</span><button class="tg'+(!R.S.settings.muted?' on':'')+'" id="tgSound"><i></i></button></div>';
  html += '<div class="setrow"><span>ANIMATION</span><button class="tg'+(R.S.settings.motion?' on':'')+'" id="tgMotion"><i></i></button></div>';

  html += '<div class="railhead" style="padding:18px 0 6px">SAVE</div>';
  html += '<div class="note">Everything lives in this browser, on this machine. Nothing is sent anywhere.</div>';
  html += '<div class="btnrow"><button class="btn" id="bExp">EXPORT</button><button class="btn" id="bImp">IMPORT</button>'+
          '<button class="btn danger" id="bWipe">NEW GAME</button></div>';
  html += '<div id="ioBox" style="margin-top:12px"></div>';
  html += '<div class="railhead" style="padding:22px 0 6px">ABOUT</div>';
  html += '<div class="note">RIZO ORIGIN. Four things, and whatever you do with them.<br>'+
          'Built as one page. No account, no server, no adverts, no purchases, no hint you have to pay for.</div>';
  shell('THE BOARD', html);

  $('#tgSound').onclick = () => {
    R.S.settings.muted = !R.S.settings.muted; A.muted = R.S.settings.muted;
    if (!R.S.settings.muted){ A.unlock(); A.play('tap'); }
    R.save(); menu();
  };
  $('#tgMotion').onclick = () => {
    R.S.settings.motion = !R.S.settings.motion;
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
      R.blank(); R.resetHint(); R.save(); close(); window.RizoMain.repaintAll(); A.play('fail');
    };
  };
}

window.RizoSheets = { book, trophies, menu, close, get open(){ return openSheet; } };
})();
