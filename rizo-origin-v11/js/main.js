/* RIZO ORIGIN — boot and wiring. */
(function(){
const R = window.Rizo, A = window.RizoAudio, U = window.RizoUI, Sh = window.RizoSheets, Art = window.RizoArt, W = window.RizoWorld;
const $ = U.$;

function repaintAll(opts){
  A.muted = R.S.settings.muted;
  A.setMusicProgress(R.countCounted(),R.groupsFound().length,true);
  if(U.resetTransient) U.resetTransient();
  if(Sh.resetTransient) Sh.resetTransient();
  if(!(opts&&opts.quiet) && !R.S.settings.muted && A.state==='running') A.startAmbient();
  document.documentElement.classList.toggle('reduced', !R.S.settings.motion);
  U.setSlots(null, null);
  U.clearResult(); U.say('');
  U.paintHeader(); U.paintRails(); U.paintGrid(); U.paintBench();
  if(W) W.reset();
}

function restartFresh(){
  A.stopAmbient();
  repaintAll({quiet:true});
  setTimeout(firstRun,220);
}

function firstRun(){
  const starters=R.STARTERS.map(id=>{
    const e=R.EL[id],g=R.GROUPS[e.group];
    return '<span class="origin-piece" style="color:'+g.ink+'">'+Art.glyphSVG(id)+'</span>';
  }).join('');
  const closeIntro=U.stage(
    '<div class="origin-seal" style="color:var(--rizo)">'+U.markSVG('mark', true)+'</div>'+ 
    '<div class="kick">RIZO ORIGIN // 000</div>'+ 
    '<h1 class="sm">FOUR THINGS. NO MAP.</h1>'+ 
    '<div class="origin-four">'+starters+'</div>'+ 
    '<p>Touch two things. If the world agrees, something new exists.</p>'+ 
    '<p class="origin-law">MAKE BEFORE YOU KNOW.</p>',
    () => {
      R.S.seenIntro=1; R.save();
      A.play('origin',{gain:1}); A.startAmbient();
      U.face('rizo'); U.flash();
      setTimeout(()=>U.heatPulse('THE BOARD IS LIVE','MAKE SOMETHING THAT DID NOT EXIST.','var(--rizo)'),260);
      setTimeout(()=>{ if(R.S.stats.attempts===0) U.say('The board is waiting. <b>Touch anything.</b>'); },5200);
      setTimeout(()=>{ if(R.S.stats.attempts===0) U.say('No recipe book. No penalty. <b>Make a guess.</b>'); },12000);
    }
  );
  const go=$('#stage .go');
  if(go){
    go.textContent='BREAK THE SEAL';
    go.onclick=e=>{
      e.stopPropagation(); if(go.disabled)return; go.disabled=true;
      /* This cue is launched directly from the physical click so iOS has no
         opportunity to defer the permission handshake. */
      if(!A.armed) A.armFromGesture('wake'); A.play('charge',{gain:1.05});
      const st=$('#stage'); st.classList.add('origin-breaking');
      go.textContent='BREAKING…';
      setTimeout(()=>A.play('impact',{gain:1.08}),230);
      setTimeout(closeIntro,470);
    };
  }
}

function bindSound(){
  const b=$('#bSound'); if(!b)return;
  const sync=()=>{
    b.classList.toggle('muted',R.S.settings.muted);
    b.classList.toggle('alive',!R.S.settings.muted&&A.state==='running');
    b.classList.toggle('locked',!R.S.settings.muted&&A.state!=='running');
    b.title = R.S.settings.muted ? 'Sound off — tap to turn on' : (A.state==='running' ? 'Sound on — tap to mute' : 'Sound on — tap to test / arm');
  };
  b.onclick=()=>{
    /* On the first speaker tap, TEST instead of accidentally muting an audio
       system the player is trying to wake up. Later taps behave as a normal
       mute toggle. */
    if(R.S.settings.muted){
      R.S.settings.muted=false; A.muted=false;
      A.armFromGesture('origin').then(()=>{ A.startAmbient(); sync(); });
      U.heatPulse('SOUND ON','IF YOU HEARD THAT, THE BOARD IS ARMED.','var(--ok)');
    } else if(!A.armed || A.state!=='running'){
      A.armFromGesture('origin').then(ok=>{
        if(ok){ A.startAmbient(); U.heatPulse('SOUND LIVE','AUDIO PATH CONFIRMED.','var(--ok)'); }
        else U.heatPulse('SOUND BLOCKED','CHECK DEVICE VOLUME / SILENT MODE.','var(--bad)');
        sync();
      });
    } else {
      A.play('close',{gain:.85});
      setTimeout(()=>{ R.S.settings.muted=true; A.muted=true; R.save(); sync(); },70);
      return;
    }
    R.save(); sync();
  };
  window.addEventListener('rizo-audio-state',sync);
  sync();
}

function bindBrand(){
  const brand=document.querySelector('.brand'); if(!brand)return;
  brand.setAttribute('role','button'); brand.setAttribute('tabindex','0');
  const open=()=>{
    if(U.busy) return;
    A.unlock();
    if(R.countCounted()>=25 || R.has('rizo')){ A.play('whisper',{gain:.65}); Sh.signal(); return; }
    A.play('whisper',{gain:.42}); U.face('rizo');
    U.say('The mark is quiet. <b>Keep making.</b>');
  };
  brand.onclick=open;
  brand.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();open();} };
}

function bindHint(){
  $('#bHint').onclick = () => {
    if(U.busy) return;
    A.unlock();
    const h = R.hint();
    if (h.kind === 'wait'){ U.say('<span class="q">···</span> give it a second.'); return; }
    if (h.kind === 'none'){ U.say('There is nothing left within reach. Which is its own kind of answer.'); return; }
    A.play('hint'); U.face('good');
    U.setHint(h.text);
    $('#bHint').classList.remove('asking');
    $('#bHint').classList.add('on');
    setTimeout(()=>$('#bHint').classList.remove('on'), 900);
    U.paintHeader();
  };
}

function bindGrid(){
  const grid = $('#grid');
  let lpTimer = null, lpConsumed = false, lpFrom = null;

  const toggleFav = id => {
    if (R.S.favs[id]) delete R.S.favs[id]; else R.S.favs[id] = 1;
    R.autosave(); A.play('tap'); U.paintGrid();
  };

  grid.addEventListener('pointerdown', e => {
    const b = e.target.closest('.el'); if (!b) return;
    const id = b.dataset.id;
    lpConsumed = false; lpFrom = { x:e.clientX, y:e.clientY };
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { lpConsumed = true; toggleFav(id); }, 470);
  });
  grid.addEventListener('pointermove', e => {
    if (lpFrom && Math.hypot(e.clientX-lpFrom.x, e.clientY-lpFrom.y) > 8) clearTimeout(lpTimer);
  });
  grid.addEventListener('pointerup', () => clearTimeout(lpTimer));
  grid.addEventListener('pointercancel', () => { clearTimeout(lpTimer); lpConsumed = false; });
  grid.addEventListener('contextmenu', e => { if (e.target.closest('.el')) e.preventDefault(); });

  /* the click is the source of truth: keyboard, mouse and touch all land here */
  grid.addEventListener('click', e => {
    const b = e.target.closest('.el'); if (!b) return;
    clearTimeout(lpTimer);
    if (lpConsumed) { lpConsumed = false; return; }
    U.pick(b.dataset.id, b);
  });
}

function bindTools(){
  const q = $('#search');
  q.addEventListener('input', () => {
    const f = Object.assign({},U.filter); f.q = q.value.trim(); U.setFilter(f);
  });
  $('#tools').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const m = c.dataset.f;
    if(m==='smart') U.setFilter({group:null,fresh:false,fav:false,recent:false,smart:true,manualAll:false,q:U.filter.q});
    else if(m==='all') U.setFilter({group:null,fresh:false,fav:false,recent:false,smart:false,manualAll:true,q:U.filter.q});
    else U.setFilter({group:null,fresh:m==='new',fav:m==='fav',recent:m==='recent',smart:false,manualAll:false,q:U.filter.q});
    U.scrollGridTop(); A.play('tap');
  });
}

function bindKeys(){
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      if ($('#stage').classList.contains('on')) return;
      if (Sh.open) Sh.close();
      else if (U.slots[0] || U.slots[1]) { U.setSlots(null,null); U.clearResult(); }
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '/'){ e.preventDefault(); $('#search').focus(); }
    if (e.key === 'h' || e.key === 'H') $('#bHint').click();
    if ((e.key === 'e' || e.key === 'E') && !U.busy) Sh.book();
    if (e.key === 'Backspace'){ e.preventDefault(); U.clearSlot('b'); }
  });
}

function boot(){
  document.body.classList.remove('preboot');
  $('#brandMark').innerHTML = U.markSVG('mk', true);
  R.load();
  if(W) W.sync();
  A.muted = R.S.settings.muted;
  A.setMusicProgress(R.countCounted(),R.groupsFound().length,true);
  document.documentElement.classList.toggle('reduced', !R.S.settings.motion);

  U.clearResult();
  U.paintHeader(); U.paintRails(); U.paintGrid(); U.paintBench();
  U.blinkLoop();

  $('#slotA').onclick = e => { if (U.slots[0]) U.clearSlot('a'); };
  $('#slotB').onclick = e => { if (U.slots[1]) U.clearSlot('b'); };
  $('#res').onclick = () => U.useResult();
  const whenFree=fn=>()=>{ if(!U.busy) fn(); };
  $('#pFound').onclick = whenFree(Sh.menu);
  $('#pSecret').onclick = whenFree(Sh.book);
  $('#bBook').onclick = whenFree(Sh.book);
  $('#bAch').onclick  = whenFree(Sh.trophies);
  $('#bMenu').onclick = whenFree(Sh.menu);
  bindSound(); bindBrand(); bindHint(); bindGrid(); bindTools(); bindKeys();

  let woke=false;
  const wake=e=>{
    if(woke || A.armed || R.S.settings.muted) return;
    /* Leave the speaker itself to bindSound so the player's first attempt to
       fix audio cannot immediately toggle it off. */
    if(e && e.target && e.target.closest && e.target.closest('#bSound')) return;
    woke=true;
    const sealing=!!document.querySelector('#stage .origin-seal');
    A.armFromGesture('wake').then(ok=>{
      /* Arm during the seal gesture, but let BREAK THE SEAL start the room.
         The ambience should not leak in before the world is open. */
      if(ok && !sealing) A.startAmbient();
      U.paintHeader();
    });
  };
  document.addEventListener('pointerdown', wake, { capture:true });
  document.addEventListener('touchstart', wake, { capture:true, passive:true });
  document.addEventListener('keydown', wake, { capture:true });
  window.addEventListener('beforeunload', () => R.save());
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ R.save(); A.pauseAmbient(); }
    else if(!R.S.settings.muted && A.armed){ A.unlock().then(()=>A.startAmbient()); }
  });
  setInterval(() => R.save(), 30000);

  if (!R.S.seenIntro) setTimeout(firstRun, 260);
  else {
    /* Existing players who already crossed the threshold get the signal once
       after upgrading, so the new RIZO bridge is discoverable without nagging. */
    if((R.countCounted()>=25 || R.has('rizo')) && !R.S.flags.signalIntro){
      setTimeout(()=>{
        if(R.S.flags.signalIntro) return; /* player may already have opened it */
        R.S.flags.signalIntro=1; R.save();
        A.play('whisper',{gain:.55}); U.face('rizo'); U.heatPulse('SIGNAL WAITING','TAP THE RIZO MARK.','var(--rizo)');
      },1250);
    }
    /* A migrated late-game save gets the new navigation lesson only when no
       other full-screen moment owns the player's attention. */
    if(U.smartAvailable && U.smartAvailable() && !R.S.flags.smartIntro){
      setTimeout(()=>{ if(!U.announceSmartSort()) setTimeout(()=>U.announceSmartSort(),1800); },3400);
    }
    /* catch achievements that a content update may have made newly true */
    const got = R.checkAchievements();
    if (got.length) setTimeout(() => got.forEach((a,i) => setTimeout(()=>{ A.play('ach'); U.toast(a.name, a.desc); },i*180)), 600);
  }
}

window.RizoMain = { repaintAll, restartFresh, boot };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
