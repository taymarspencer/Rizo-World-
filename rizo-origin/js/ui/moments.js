/* RIZO ORIGIN — the moments.
   A discovery is a card. A domain is an event. The reveal, the ending and the
   completion get the whole screen. They queue so they never collide. */
(function(){
const R = window.Rizo, A = window.RizoAudio, U = window.RizoUI, Art = window.RizoArt;

function domainOpening(g, then){
  A.play('domain'); U.face('wow'); U.flash();
  const done = U.stage(
    '<div class="kick">A DOMAIN OPENS</div>'+
    '<div style="color:'+g.ink+';width:96px;height:96px;margin:0 auto 16px">'+domainMark(g)+'</div>'+
    '<h1 style="color:'+g.ink+'">'+g.name+'</h1>'+
    '<p>'+g.hint+'</p>', then, true);
  setTimeout(done, 1750);
}
function domainMark(g){
  /* the first thing the player ever found in this domain becomes its sigil */
  const first = R.EL_ORDER.find(id => R.EL[id].group===g.id && R.S.found[id]);
  return Art.glyphSVG(first || 'spark','big').replace('class="big"','style="width:96px;height:96px"');
}

function bigDiscovery(e, then){
  const g = R.GROUPS[e.group];
  A.play(e.secret ? 'secret' : 'major');
  U.face(e.group === 'rizo' ? 'rizo' : 'wow');
  U.flash();
  const done = U.stage(
    '<div class="kick">'+(e.secret?'THAT SHOULD NOT HAVE WORKED':'A LANDMARK')+'</div>'+
    '<div style="color:'+g.ink+';width:104px;height:104px;margin:0 auto 14px">'+Art.glyphSVG(e.id).replace('class="gl"','style="width:104px;height:104px"')+'</div>'+
    '<h1 class="sm" style="color:'+g.ink+'">'+e.name+'</h1><p>'+e.flavor+'</p>', then, true);
  setTimeout(done, 2100);
}

function theReveal(then){
  A.play('reveal'); U.face('wow');
  const c = R.countCounted();
  U.stage(
    '<div class="kick">A COUNT, SINCE YOU HAVE COME THIS FAR</div>'+
    '<div class="bignum">'+c+' <s>/</s> '+R.TOTAL_COUNTED+'</div>'+
    '<p style="margin-top:16px">You have been building this for a while and you did not know how big the room was. '+
    'Now you do. Mostly.</p>'+
    '<p style="margin-top:10px;color:var(--ink3);font-size:13px">Some of it is still not on that number.</p>', then);
}

function theEnding(then){
  A.play('ending'); U.flash();
  const M = window.RIZO_MARK;
  const mark = '<svg class="mark" viewBox="0 0 32 32" fill="currentColor" style="color:var(--rizo)">'+
    '<path d="'+M.body+'" fill-rule="evenodd"/><path d="'+M.eyeL+'"/><path d="'+M.eyeR+'"/><path d="'+M.mouth+'"/></svg>';
  const beats = [
    { h:'YOU STARTED WITH FOUR THINGS',
      p:'Fire. Water. Earth. Air. Nobody told you what they were for.' },
    { h:'YOU BUILT THE REST',
      p:'Weather, then bodies. Bodies, then opinions. Opinions, then money, gods, machines, and every bad idea that came after.' },
    { h:'SOMEWHERE IN THERE, RIZO SHOWED UP',
      p:'Not as a thing you bought. As the thing that happens when somebody makes something before they know how.' },
    { h:'AND THEN RIZO MADE RIZO',
      p:'Which is either a joke, or the only honest way anything ever gets started. It has not decided. Neither have you.' },
    { h:'STRIKE',
      p:'The last thing you made was the first thing you had. That is the whole trick. Go on then — the rest of it is still out there.' }
  ];
  let i = 0;
  const step = () => {
    if (i >= beats.length){ then && then(); return; }
    const b = beats[i++];
    U.stage((i===beats.length ? mark : '')+
      '<div class="kick">'+String(i).padStart(2,'0')+' / '+String(beats.length).padStart(2,'0')+'</div>'+
      '<h1 class="sm">'+b.h+'</h1><p>'+b.p+'</p>', step);
  };
  step();
}

function completion(then){
  A.play('ending');
  const s = R.S.stats;
  const mins = Math.round((s.played||0)/60000);
  const rows = [
    ['ELEMENTS', R.countCounted()+' / '+R.TOTAL_COUNTED],
    ['ANOMALIES', R.countSecret()+' / '+R.TOTAL_SECRET],
    ['DOMAINS', R.groupsFound().length+' / '+R.GROUP_ORDER.length],
    ['RECIPES', Object.keys(R.S.recipes).length],
    ['ACHIEVEMENTS', Object.keys(R.S.ach).length+' / '+R.ACH.length],
    ['ATTEMPTS', s.attempts],
    ['THINGS THAT DID NOTHING', s.fails],
    ['HINTS TAKEN', s.hints],
    ['TIME IN HERE', (mins>=60? Math.floor(mins/60)+'h '+(mins%60)+'m' : mins+'m')]
  ];
  U.stage(
    '<div class="kick">COMPLETE</div><h1 class="sm">THERE IS NOTHING LEFT TO FIND</h1>'+
    '<p style="margin-bottom:18px">Every single one. You went and did it.</p>'+
    '<div style="text-align:left;max-width:340px;margin:0 auto">'+
    rows.map(r=>'<div class="stat"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('')+
    '</div><p style="margin-top:18px;color:var(--ink3);font-size:13px">The board stays open. Go and put strange things together for no reason.</p>', then);
}

/* the queue: one moment at a time, in order of importance */
function run(out, done){
  const jobs = [];
  if (out.newGroup) jobs.push(cb => domainOpening(out.group, cb));
  if (out.major || out.secret) jobs.push(cb => bigDiscovery(out.el, cb));
  jobs.push(cb => {
    if (!out.major && !out.secret){
      A.play(out.el.secret ? 'secret' : 'found');
      U.face(out.el.group === 'rizo' ? 'rizo'
           : ['abyss','vice','chaos','meta'].includes(out.el.group) ? 'dark' : 'good');
    }
    U.card(out.el, out.secret ? 'ANOMALY' : 'NEW', null);
    cb();
  });
  (out.also||[]).forEach(x => jobs.push(cb => {
    if (x.newGroup) { domainOpening(x.group, () => { A.play('found'); U.card(x.el,'AND ALSO',null); cb(); }); return; }
    A.play('found'); U.card(x.el, 'AND ALSO', null); cb();
  }));
  if (out.reveal)   jobs.push(cb => theReveal(cb));
  if (out.ending)   jobs.push(cb => theEnding(cb));
  if (out.complete) jobs.push(cb => completion(cb));
  (out.ach||[]).forEach(a => jobs.push(cb => { A.play('ach'); U.toast(a.name, a.desc); cb(); }));

  let i = 0;
  const next = () => { if (i >= jobs.length){ done && done(); return; } jobs[i++](next); };
  next();
}

window.RizoMoments = { run, theReveal, theEnding, completion, domainOpening };
})();
