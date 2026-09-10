/* RIZO ORIGIN — boot and wiring. */
(function(){
const R = window.Rizo, A = window.RizoAudio, U = window.RizoUI, Sh = window.RizoSheets;
const $ = U.$;

function repaintAll(){
  A.muted = R.S.settings.muted;
  document.documentElement.classList.toggle('reduced', !R.S.settings.motion);
  U.setSlots(null, null);
  U.clearResult(); U.say('');
  U.paintHeader(); U.paintRails(); U.paintGrid(); U.paintBench();
}

function firstRun(){
  R.S.seenIntro = 1; R.save();
  U.stage(
    '<div style="color:var(--rizo)">'+U.markSVG('mark', true)+'</div>'+
    '<div class="kick">RIZO ORIGIN</div>'+
    '<h1 class="sm">YOU HAVE FOUR THINGS</h1>'+
    '<p>Put two of them together and see what happens. Most pairs do nothing. '+
    'Some do something. Keep going and it stops being about rocks.</p>'+
    '<p style="margin-top:12px;color:var(--ink3);font-size:13px">Tap one. Tap another. That is the whole control scheme.</p>',
    () => { A.unlock(); A.play('open'); });
}

function bindHint(){
  $('#bHint').onclick = () => {
    A.unlock();
    const h = R.hint();
    if (h.kind === 'wait'){ U.say('<span class="q">···</span> give it a second.'); return; }
    if (h.kind === 'none'){ U.say('There is nothing left within reach. Which is its own kind of answer.'); return; }
    A.play('hint'); U.face('good');
    U.setHint(h.text);
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
    const f = U.filter; f.q = q.value.trim(); U.setFilter(f);
  });
  $('#tools').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const m = c.dataset.f;
    U.setFilter({ group:null, fresh:m==='new', fav:m==='fav', q:U.filter.q });
    document.querySelectorAll('#tools .chip').forEach(x => x.classList.toggle('on', x===c && m!=='all'));
    A.play('tap');
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
    if (e.key === 'e' || e.key === 'E') Sh.book();
    if (e.key === 'Backspace'){ e.preventDefault(); U.clearSlot('b'); }
  });
}

function boot(){
  document.body.classList.remove('preboot');
  $('#brandMark').innerHTML = U.markSVG('mk', true);
  const fresh = !R.load();
  A.muted = R.S.settings.muted;
  document.documentElement.classList.toggle('reduced', !R.S.settings.motion);

  U.clearResult();
  U.paintHeader(); U.paintRails(); U.paintGrid(); U.paintBench();
  U.blinkLoop();

  $('#slotA').onclick = e => { if (U.slots[0]) U.clearSlot('a'); };
  $('#slotB').onclick = e => { if (U.slots[1]) U.clearSlot('b'); };
  $('#res').onclick = () => U.useResult();
  $('#pFound').onclick = () => Sh.menu();
  $('#pSecret').onclick = () => Sh.book();
  $('#bBook').onclick = () => Sh.book();
  $('#bAch').onclick  = () => Sh.trophies();
  $('#bMenu').onclick = () => Sh.menu();
  bindHint(); bindGrid(); bindTools(); bindKeys();

  document.addEventListener('pointerdown', () => A.unlock(), { once:true });
  window.addEventListener('beforeunload', () => R.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) R.save(); });
  setInterval(() => R.save(), 30000);

  if (!R.S.seenIntro) setTimeout(firstRun, 260);
  else {
    /* catch achievements that a content update may have made newly true */
    const got = R.checkAchievements();
    if (got.length) setTimeout(() => got.forEach(a => U.toast(a.name, a.desc)), 600);
  }
}

window.RizoMain = { repaintAll, boot };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
