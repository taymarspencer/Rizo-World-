/* RIZO ORIGIN — the moments.
   A discovery is a card. A domain is an event. The reveal, the ending and the
   completion get the whole screen. They queue so they never collide. */
(function(){
'use strict';
const R = window.Rizo, A = window.RizoAudio, U = window.RizoUI, Art = window.RizoArt, W = window.RizoWorld;

const SIGNATURE = {
  life:{ kick:'THE FIRST IMPOSSIBLE THING', echo:'THE BOARD HAS A PULSE.', hold:3500, echoCue:'impact' },
  human:{ kick:'SOMETHING LOOKED BACK', echo:'NOW THE MAKER IS INSIDE THE WORLD.', hold:3300, echoCue:'whisper' },
  time:{ kick:'THE BOARD LEARNED TO WAIT', echo:'EVERYTHING AFTER THIS CAN AGE.', hold:3200, echoCue:'whisper' },
  ritual:{ kick:'REPEAT IT UNTIL IT MEANS SOMETHING', echo:'THE BOARD NOTICES PATTERNS.', hold:3200, echoCue:'whisper' },
  chaos:{ kick:'THE RULES FOUND AN ENEMY', echo:'GOOD.', hold:3150, echoCue:'fail' },
  universe:{ kick:'ALL OF IT. SO FAR.', echo:'THE ROOM WAS BIGGER THAN THE BOARD.', hold:3500, echoCue:'reveal' },
  rizo:{ kick:'THE SIGNAL HAS A NAME', echo:'YOU HAVE BEEN PLAYING INSIDE IT THE WHOLE TIME.', hold:4200, echoCue:'origin' },
  confluence:{ kick:'BOTH ROADS HELD', echo:'THE MISSING PIECE WAS THE RELATIONSHIP.', hold:3600, echoCue:'confluence' }
};

function discoveryVoice(e,major,visual=true){
  if(W){ if(visual) W.reveal(e.id); else W.sync(); }
  if(!A.hasDiscoveryCue || !A.hasDiscoveryCue(e.id)) return null;
  const profile=(A.discoveryProfile && A.discoveryProfile(e.id)) || {};
  const duckMs=Math.max(major?3200:2100,profile.duck||0);
  A.duck(duckMs,major?.12:.24);
  A.playDiscovery(e.id,{gain:major?1.04:.92});
  /* Reward accents sit inside the tail instead of stomping the environmental
     transient. SEA gets to sound like surf before RIZO signs it; lightning can
     snap quickly. The cue profile owns this timing. */
  if(!major){
    const at=Number.isFinite(profile.accent)?profile.accent:620;
    setTimeout(()=>A.play('found',{gain:.34,rate:.94+((e.gix%7)*.025)}),at);
  }
  return profile;
}

function artPlate(id, cls='stage-art'){
  const e = R.EL[id], g = e && R.GROUPS[e.group];
  const ink = g ? g.ink : 'var(--accent)';
  return '<div class="'+cls+'" style="color:'+ink+';--domain:'+ink+';--art-paper-local:#0b0b09">'+Art.glyphSVG(id,'big')+'</div>';
}

function domainOpening(g, then){
  const pitch=.88+((R.GROUP_ORDER.indexOf(g.id)%7)*.035);
  A.duck(2200,.22); A.play('domain',{rate:pitch}); U.face('wow'); U.flash();
  const first = R.EL_ORDER.find(id => R.EL[id].group===g.id && R.S.found[id]);
  const done = U.stage(
    '<div class="kick">THE BOARD JUST GOT BIGGER</div>'+
    '<div class="stage-domain" style="color:'+g.ink+';--domain:'+g.ink+';--art-paper-local:#0b0b09">'+Art.glyphSVG(first || 'spark','big')+'</div>'+
    '<h1 style="color:'+g.ink+'">'+g.name+'</h1>'+
    '<p>'+g.hint+'</p>', then, true, {minHold:R.S.settings.motion?1250:350});
  setTimeout(done, 2500);
}

function domainComplete(g, then){
  if(!g){then&&then();return;}
  A.duck(1450,.34); A.play('ach',{rate:.88+((R.GROUP_ORDER.indexOf(g.id)%6)*.035),gain:.82});
  U.face('wow');
  U.heatPulse(g.name+' // COMPLETE','EVERYTHING IN THIS DOMAIN IS YOURS.',g.ink);
  setTimeout(()=>then&&then(),1500);
}

function bigDiscovery(e, then, openedDomain, foundNumber){
  const g = R.GROUPS[e.group], pitch=.90+((e.gix%7)*.03), sig=SIGNATURE[e.id];
  const environmental=discoveryVoice(e,true,false);
  A.duck(Math.max(sig?Math.min(3600,sig.hold):2500,environmental&&environmental.duck||0),.16);
  if(environmental){
    const accentAt=Number.isFinite(environmental.majorAccent)?environmental.majorAccent:(Number.isFinite(environmental.accent)?environmental.accent:760);
    setTimeout(()=>A.play(e.secret ? 'secret' : 'major',{rate:pitch,gain:.42}),accentAt);
  } else A.play(e.secret ? 'secret' : 'major',{rate:pitch});
  U.face(e.group === 'rizo' ? 'rizo' : 'wow');
  U.flash();
  if(sig && sig.echoCue && !(environmental && e.id==='life')){
    const echoAt=environmental&&Number.isFinite(environmental.echo)?environmental.echo:520;
    setTimeout(()=>A.play(sig.echoCue,{gain:environmental ? .48 : (sig.echoCue==='impact' ? .72 : .62),rate:e.id==='life'?.78:1}),echoAt);
    if(e.id==='life') setTimeout(()=>A.play('impact',{gain:.55,rate:.72}),760);
  }
  const artClass='stage-art'+(sig?' signature-art sig-'+e.id:'');
  const signatureMin={life:2500,human:1750,time:1850,ritual:1700,chaos:1500,universe:1950,rizo:1850,confluence:1900};
  /* Protected time exists so the authored motion can finish. With animation
     explicitly off, do not make the player wait for motion they chose not to see. */
  const minHold=R.S.settings.motion ? (sig ? (signatureMin[e.id]||1750) : 1500) : 450;
  const done = U.stage(
    '<div class="moment-wrap'+(sig?' signature signature-'+e.id:'')+'">'+
    '<div class="kick">'+(sig?sig.kick:(e.secret?'THE BOARD FLINCHED':'LANDMARK // THE WORLD REMEMBERS THIS'))+'</div>'+ 
    artPlate(e.id,artClass)+
    '<h1 class="sm" style="color:'+g.ink+'">'+e.name+'</h1><p>'+e.flavor+'</p>'+ 
    (sig?'<div class="moment-echo" style="color:'+g.ink+'">'+sig.echo+'</div>':'')+
    (openedDomain?'<div class="moment-domain-open" style="color:'+g.ink+'">NEW DOMAIN // '+g.name+'</div>':'')+
    '<div class="moment-stamp" style="color:'+g.ink+'">'+(e.secret?'ANOMALY // OUTSIDE THE COUNT':'FOUND // '+String(Number.isFinite(foundNumber)?foundNumber:R.countCounted()).padStart(3,'0'))+'</div></div>', ()=>{ if(W) W.reveal(e.id); if(then) then(); }, true, {minHold});
  setTimeout(done, sig ? sig.hold : (e.secret ? 3100 : 2750));
}


function theReveal(then){
  A.duck(2600,.14); A.play('reveal'); U.face('wow');
  const c = R.countCounted();
  U.stage(
    '<div class="kick">A COUNT, SINCE YOU HAVE COME THIS FAR</div>'+
    '<div class="bignum">'+c+' <s>/</s> '+R.TOTAL_COUNTED+'</div>'+
    '<p style="margin-top:16px">You have been building this for a while and did not know how big the room was. Now you do. Mostly.</p>'+
    '<p style="margin-top:10px;color:var(--ink3);font-size:13px">Some things still refuse to be counted.</p>', then);
}

function theEnding(then){
  A.duck(4200,.10); A.play('ending'); U.flash();
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
      p:'Which is a joke. It can also be the only honest way anything ever gets started. The board stopped asking you to choose.' },
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

function statRows(rows){
  return '<div style="text-align:left;max-width:360px;margin:0 auto">'+
    rows.map(r=>'<div class="stat"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('')+'</div>';
}

/* 374/374 is completion of the visible universe, not proof that anomalies do
   not exist. The old copy falsely told a player with hidden anomalies left that
   absolutely everything had been found. */
function completion(then){
  A.duck(3200,.12); A.play('ending'); U.face('wow');
  const s = R.S.stats;
  const mins = Math.round(R.playedMs()/60000);
  const rows = [
    ['ELEMENTS', R.countCounted()+' / '+R.TOTAL_COUNTED],
    ['DOMAINS', R.groupsFound().length+' OPEN'],
    ['RECIPES', Object.keys(R.S.recipes).length],
    ['ACHIEVEMENTS', Object.keys(R.S.ach).length+' / '+R.ACH.length],
    ['ATTEMPTS', s.attempts],
    ['THINGS THAT DID NOTHING', s.fails],
    ['HINTS TAKEN', s.hints],
    ['TIME IN HERE', (mins>=60? Math.floor(mins/60)+'h '+(mins%60)+'m' : mins+'m')]
  ];
  if (R.countSecret()) rows.splice(2,0,['ANOMALIES FOUND', R.countSecret()]);
  U.stage(
    '<div class="kick">THE COUNT CLOSES</div><h1 class="sm">THE KNOWN WORLD IS COMPLETE</h1>'+
    '<p style="margin-bottom:18px">Every element on the count is here. That does not mean the count knew about everything.</p>'+
    statRows(rows)+
    '<p style="margin-top:18px;color:var(--ink3);font-size:13px">The board stays open. If something still feels possible, try it.</p>', then);
}

function fullCompletion(then){
  A.duck(4200,.08); A.play('ending'); U.face('rizo'); U.flash();
  const s = R.S.stats;
  const mins = Math.round(R.playedMs()/60000);
  const last = R.EL[s.last];
  const rows = [
    ['ELEMENTS', R.TOTAL_COUNTED+' / '+R.TOTAL_COUNTED],
    ['ANOMALIES', R.TOTAL_SECRET+' / '+R.TOTAL_SECRET],
    ['RECIPES FOUND', Object.keys(R.S.recipes).length+' / '+Object.keys(R.PAIR).length],
    ['ACHIEVEMENTS', Object.keys(R.S.ach).length+' / '+R.ACH.length],
    ['ATTEMPTS', s.attempts],
    ['HINTS TAKEN', s.hints],
    ['LAST THING', last ? last.name : '—'],
    ['TIME IN HERE', (mins>=60? Math.floor(mins/60)+'h '+(mins%60)+'m' : mins+'m')]
  ];
  U.stage(
    '<div class="kick">406 / 406</div>'+artPlate('thematch')+
    '<h1 class="sm">NOW THERE IS NOTHING LEFT TO FIND</h1>'+
    '<p style="margin-bottom:18px">The things on the count. The things outside it. Every last bad idea.</p>'+
    statRows(rows)+
    '<p style="margin-top:18px;color:var(--ink3);font-size:13px">The board stays open anyway. Some ideas are worth doing twice.</p>', then);
}

/* the queue: one moment at a time, in order of importance */
function run(out, done){
  const jobs = [];
  /* A landmark that also opens a domain is one event, not two back-to-back
     announcements of the same discovery. LIFE was the clearest offender. */
  if (out.major || out.secret) {
    /* A landmark's ceremony IS its reveal. Repeating the same discovery as a
       normal card immediately afterward made the special moment feel cheaper. */
    jobs.push(cb => bigDiscovery(out.el, cb, !!out.newGroup, out.foundNumber));
  } else {
    if (out.newGroup) jobs.push(cb => domainOpening(out.group, cb));
    jobs.push(cb => {
      const sensory=discoveryVoice(out.el,false);
      if(!sensory) A.play('found',{rate:.92+((out.el.gix%7)*.035)});
      U.face(out.el.group === 'rizo' ? 'rizo'
           : ['abyss','vice','chaos','meta'].includes(out.el.group) ? 'dark' : 'good');
      U.card(out.el, 'NEW', null, null, {foundNumber:out.foundNumber});
      /* Physical sounds are longer than the generic sting. Give the important
         part of that sound room before the next queued reveal takes over. */
      setTimeout(cb, sensory&&sensory.hold ? Math.max(1450,sensory.hold) : 1450);
    });
  }
  (out.also||[]).forEach(x => jobs.push(cb => {
    U.revealGridItem(x.el.id);
    /* A second output is not a lesser citizen. PRIMORDIAL SOUP exposed this:
       it is a landmark born as the second result of SEA + VOLCANO, and used to
       miss its ceremony entirely. */
    if(x.el.major || x.el.secret){ bigDiscovery(x.el,cb,!!x.newGroup,x.foundNumber); return; }
    const reveal=()=>{
      const sensory=discoveryVoice(x.el,false);
      if(!sensory) A.play('found',{rate:.92+((x.el.gix%7)*.035)});
      U.card(x.el,'AND ALSO',null,null,{foundNumber:x.foundNumber});
      setTimeout(cb,sensory&&sensory.hold ? Math.max(1450,sensory.hold) : 1450);
    };
    if (x.newGroup) { domainOpening(x.group, reveal); return; }
    reveal();
  }));
  (out.completedGroups||[]).forEach(gid=>jobs.push(cb=>domainComplete(R.GROUPS[gid],cb)));
  if (out.reveal) jobs.push(cb => theReveal(cb));
  if (out.ending) jobs.push(cb => theEnding(cb));
  /* A full-complete turn is already the stronger completion event. */
  if (out.fullComplete) jobs.push(cb => fullCompletion(cb));
  else if (out.complete) jobs.push(cb => completion(cb));
  const achievements=out.ach||[];

  let i = 0;
  const next = () => {
    if (i >= jobs.length){
      U.revealAllGridItems();
      /* Achievements decorate the win; they do not hold the controls hostage.
         Stagger them after the reaction releases so a player never loses a tap
         merely because FIRST CONTACT happened on the same turn. */
      done && done();
      achievements.forEach((a,ix)=>setTimeout(()=>{ A.play('ach'); U.toast(a.name,a.desc); },120+ix*520));
      return;
    }
    jobs[i++](next);
  };
  next();
}

window.RizoMoments = { run, theReveal, theEnding, completion, fullCompletion, domainOpening, domainComplete };
})();
