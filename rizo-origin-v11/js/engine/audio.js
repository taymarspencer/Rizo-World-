/* RIZO ORIGIN — hybrid reactive sound system.
   The sensory proof keeps the V7 rule: never trust one browser audio path.
   Every cue is a real local file and core cues retain a WebAudio fallback.
   A physical gesture explicitly arms both paths for iOS/Safari. */
(function(){
'use strict';

  const ROOT = 'assets/audio/';
  const MEDIA = {
    wake:'wake.wav', tap:'tap.wav', tap2:'tap2.wav', untap:'untap.wav',
    charge:'charge.wav', impact:'impact.wav', fail:'fail.wav', known:'known.wav',
    route:'route.wav', found:'found.wav', chain:'chain.wav', major:'major.wav',
    domain:'domain.wav', secret:'secret.wav', ach:'ach.wav', reveal:'reveal.wav',
    hint:'hint.wav', open:'open.wav', close:'close.wav', origin:'origin.wav', confluence:'confluence-v8.wav',
    whisper:'whisper.wav', ending:'ending.wav', ambient:'labloop-v5.wav', darkAmbient:'below-v7.wav',
    found2:'found2-v10.wav', found3:'found3-v10.wav', found4:'found4-v10.wav', found5:'found5-v10.wav',
    impact2:'impact2-v10.wav', fail2:'fail2-v10.wav', chain2:'chain2-v10.wav', tap3:'tap3-v10.wav',

    worldSea:'world-sea-v10.wav', worldRain:'world-rain-v10.wav', worldLightning:'world-lightning-v10.wav', worldStorm:'world-storm-v10.wav',
    worldVolcano:'world-volcano-v10.wav', worldQuake:'world-quake-v10.wav', worldLife:'world-life-v10.wav', worldForest:'world-forest-v10.wav',
    worldCity:'world-city-v10.wav', worldEngine:'world-engine-v10.wav', worldElectricity:'world-electricity-v10.wav', worldSpace:'world-space-v10.wav',
    worldFire:'world-fire-v10.wav', worldWind:'world-wind-v10.wav', worldIce:'world-ice-v10.wav',
    worldSteam:'world-steam-v10.wav', worldLava:'world-lava-v10.wav', worldSpark:'world-spark-v10.wav', worldCrystal:'world-crystal-v10.wav',
    worldRiver:'world-river-v10.wav', worldWaterfall:'world-waterfall-v10.wav', worldBroth:'world-broth-v10.wav', worldBird:'world-bird-v10.wav',
    worldCrowd:'world-crowd-v10.wav', worldGlass:'world-glass-v10.wav', worldMetal:'world-metal-v10.wav', worldDrum:'world-drum-v10.wav',
    worldTrain:'world-train-v10.wav', worldCar:'world-car-v10.wav', worldPlane:'world-plane-v10.wav', worldRocket:'world-rocket-v10.wav',
    worldClock:'world-clock-v10.wav', worldRadio:'world-radio-v10.wav', worldCamera:'world-camera-v10.wav', worldBigBang:'world-bigbang-v10.wav',
    worldBlackHole:'world-blackhole-v10.wav', worldHuman:'world-human-v10.wav', worldDeath:'world-death-v10.wav',
    worldComputer:'world-computer-v10.wav', worldChaos:'world-chaos-v10.wav'
  };
  const VOL = {
    wake:.72,tap:.58,tap2:.64,untap:.52,charge:.62,impact:.82,fail:.72,
    known:.64,route:.70,found:.88,chain:.68,major:.94,domain:.94,secret:.86,
    ach:.78,reveal:.96,hint:.62,open:.56,close:.52,origin:.98,whisper:.52,
    ending:.98,confluence:.82,ambient:.14,darkAmbient:.22,
    found2:.86,found3:.86,found4:.84,found5:.84,impact2:.80,fail2:.70,chain2:.66,tap3:.56,
    worldSea:.78,worldRain:.74,worldLightning:.92,worldStorm:.78,worldVolcano:.88,worldQuake:.82,worldLife:.86,worldForest:.70,
    worldCity:.70,worldEngine:.76,worldElectricity:.82,worldSpace:.76,worldFire:.78,worldWind:.72,worldIce:.78,
    worldSteam:.76,worldLava:.82,worldSpark:.82,worldCrystal:.78,worldRiver:.72,worldWaterfall:.75,worldBroth:.78,worldBird:.68,
    worldCrowd:.66,worldGlass:.78,worldMetal:.78,worldDrum:.78,worldTrain:.74,worldCar:.72,worldPlane:.70,worldRocket:.86,
    worldClock:.72,worldRadio:.70,worldCamera:.76,worldBigBang:.92,worldBlackHole:.80,
    worldHuman:.76,worldDeath:.80,worldComputer:.78,worldChaos:.82
  };
  const POOL_SIZE = { tap:4, tap2:4, impact:3, found:3, chain:3, fail:2, known:2, route:2 };
  const HOT_PRELOAD = new Set([
    'wake','tap','tap2','tap3','untap','charge','impact','impact2','fail','fail2','known','route','found','found2','found3','found4','found5','chain','chain2',
    'major','domain','secret','ach','reveal','hint','open','close','origin','confluence','whisper','ending',
    /* likely first-session physical discoveries: keep these instant */
    'worldSteam','worldLava','worldSpark','worldWind','worldIce','worldCrystal','worldRain','worldSea'
  ]);


  let on = true;
  let armed = false;
  let mediaOK = false;
  let armedAt = 0;
  let lastError = '';
  let pending = [];
  let mediaBooted = false;
  let sensoryWarmStarted = false;
  let ambientMedia = null, darkAmbientMedia = null, fallbackBus = null, ambientFadeTimer = null, ambientDuckTimer = null;
  let musicFound = 4, musicGroups = 1, musicMix = 0, musicLabel = 'CURIOUS', motifTimer = null, motifStep = 0;
  const variantLast = Object.create(null);
  const variantBags = Object.create(null);
  const VARIANTS = { tap:['tap','tap3'], impact:['impact','impact2'], fail:['fail','fail2'], found:['found','found2','found3','found4','found5'], chain:['chain','chain2'] };
  const VARIANT_BASE = {tap3:'tap',impact2:'impact',fail2:'fail',found2:'found',found3:'found',found4:'found',found5:'found',chain2:'chain'};

  /* Pass-one sensory director. A profile says how a physical discovery should
     sound AND how much space the rest of the mix owes it. Shared families are
     deliberately rate/level shaped so WAVE does not feel like SEA copied twice. */
  const DISCOVERY_PROFILES = {
    steam:{cue:'worldSteam',gain:.92,rate:1.02,duck:2050,accent:650,hold:1650},
    lava:{cue:'worldLava',gain:.96,rate:.96,duck:2850,accent:900,hold:2050},
    spark:{cue:'worldSpark',gain:.96,rate:1.08,duck:1300,accent:380,hold:1200},
    wind:{cue:'worldWind',gain:.94,rate:1.02,duck:2350,accent:760,hold:1750},
    ice:{cue:'worldIce',gain:.96,rate:1.02,duck:1850,accent:540,hold:1500},
    crystal:{cue:'worldCrystal',gain:.94,rate:1.03,duck:1850,accent:620,hold:1500},
    rain:{cue:'worldRain',gain:.94,rate:1.02,duck:2550,accent:760,hold:1850},
    storm:{cue:'worldStorm',gain:.94,rate:1.00,duck:3250,accent:980,hold:2200},
    lightning:{cue:'worldLightning',gain:1.02,rate:1.00,duck:1800,accent:500,hold:1450},
    thunder:{cue:'worldStorm',gain:.90,rate:.84,duck:3400,accent:1100,hold:2250},
    snow:{cue:'worldIce',gain:.72,rate:.86,duck:1850,accent:720,hold:1500},
    sea:{cue:'worldSea',gain:1.00,rate:.96,duck:3200,accent:980,hold:2150},
    wave:{cue:'worldSea',gain:.88,rate:1.12,duck:2700,accent:760,hold:1850},
    tide:{cue:'worldSea',gain:.78,rate:.82,duck:3000,accent:1100,hold:2050},
    river:{cue:'worldRiver',gain:.92,rate:1.04,duck:2650,accent:820,hold:1900},
    waterfall:{cue:'worldWaterfall',gain:.96,rate:1.00,duck:2900,accent:900,hold:2050},
    volcano:{cue:'worldVolcano',gain:1.00,rate:.96,duck:3550,accent:1120,hold:2350},
    earthquake:{cue:'worldQuake',gain:.96,rate:.94,duck:2850,accent:880,hold:2050},
    broth:{cue:'worldBroth',gain:.96,rate:.92,duck:3100,accent:1050,hold:2200},
    death:{cue:'worldDeath',gain:1.00,rate:.96,duck:3000,accent:1120,hold:2150,majorAccent:1180},
    life:{cue:'worldLife',gain:1.02,rate:1.00,duck:3550,accent:1180,hold:2500,majorAccent:1260},
    forest:{cue:'worldForest',gain:.94,rate:.98,duck:3050,accent:1080,hold:2100},
    bird:{cue:'worldBird',gain:.90,rate:1.04,duck:2100,accent:680,hold:1650},
    human:{cue:'worldHuman',gain:1.00,rate:1.00,duck:2950,accent:1080,hold:2100,majorAccent:1120,echo:1850},
    crowd:{cue:'worldCrowd',gain:.86,rate:1.00,duck:2450,accent:820,hold:1800},
    village:{cue:'worldCrowd',gain:.78,rate:.90,duck:2500,accent:850,hold:1850},
    city:{cue:'worldCity',gain:.94,rate:.98,duck:3050,accent:980,hold:2100},
    glass:{cue:'worldGlass',gain:.96,rate:1.04,duck:1750,accent:520,hold:1450},
    metal:{cue:'worldMetal',gain:.96,rate:.96,duck:1700,accent:480,hold:1450},
    iron:{cue:'worldMetal',gain:.90,rate:.88,duck:1800,accent:520,hold:1450},
    steel:{cue:'worldMetal',gain:.94,rate:1.08,duck:1800,accent:500,hold:1450},
    drum:{cue:'worldDrum',gain:.96,rate:1.00,duck:1800,accent:620,hold:1500},
    ritual:{cue:'worldDrum',gain:.88,rate:.76,duck:2600,accent:980,hold:1950,majorAccent:1020,echo:1720},
    engine:{cue:'worldEngine',gain:.98,rate:.96,duck:2550,accent:760,hold:1850},
    machine:{cue:'worldEngine',gain:.90,rate:1.08,duck:2450,accent:720,hold:1800},
    factory:{cue:'worldEngine',gain:.80,rate:.82,duck:2700,accent:880,hold:1950},
    computer:{cue:'worldComputer',gain:1.00,rate:1.00,duck:2350,accent:760,hold:1750,majorAccent:820},
    ai:{cue:'worldComputer',gain:.88,rate:.82,duck:2600,accent:920,hold:1900,majorAccent:980},
    train:{cue:'worldTrain',gain:.94,rate:1.00,duck:2750,accent:880,hold:1950},
    car:{cue:'worldCar',gain:.92,rate:1.02,duck:2150,accent:700,hold:1700},
    plane:{cue:'worldPlane',gain:.92,rate:1.00,duck:2600,accent:820,hold:1900},
    rocket:{cue:'worldRocket',gain:1.00,rate:.98,duck:3150,accent:1050,hold:2200},
    clock:{cue:'worldClock',gain:.94,rate:1.00,duck:2000,accent:720,hold:1600},
    electricity:{cue:'worldElectricity',gain:.98,rate:1.00,duck:2050,accent:560,hold:1600},
    lightbulb:{cue:'worldElectricity',gain:.76,rate:1.20,duck:1650,accent:500,hold:1450},
    radio:{cue:'worldRadio',gain:.92,rate:.98,duck:2150,accent:700,hold:1700},
    signal:{cue:'worldRadio',gain:.82,rate:1.12,duck:1950,accent:600,hold:1550},
    internet:{cue:'worldRadio',gain:.78,rate:1.20,duck:2050,accent:620,hold:1650},
    camera:{cue:'worldCamera',gain:.98,rate:1.00,duck:1350,accent:380,hold:1200},
    time:{cue:'worldClock',gain:.92,rate:.72,duck:2750,accent:980,hold:2050,majorAccent:1050,echo:1780},
    chaos:{cue:'worldChaos',gain:1.00,rate:.96,duck:2850,accent:1020,hold:2050,majorAccent:1080,echo:1820},
    space:{cue:'worldSpace',gain:.98,rate:.94,duck:3450,accent:1180,hold:2300},
    star:{cue:'worldSpace',gain:.80,rate:1.18,duck:2850,accent:900,hold:1950},
    universe:{cue:'worldSpace',gain:1.00,rate:.78,duck:3800,accent:1320,hold:2500,majorAccent:1380,echo:2200},
    bigbang:{cue:'worldBigBang',gain:1.04,rate:1.00,duck:3900,accent:1380,hold:2550,majorAccent:1450},
    blackhole:{cue:'worldBlackHole',gain:1.00,rate:.92,duck:3550,accent:1260,hold:2350},
  };

  const discoveryLastAt=Object.create(null);
  const pools = Object.create(null);
  const cursors = Object.create(null);

  let ctx = null, master = null, comp = null, unlocking = null, ambientSynth = null;

  function notify(){
    try{ window.dispatchEvent(new CustomEvent('rizo-audio-state')); }catch(e){}
  }

  /* ── Real audio files: primary path ─────────────────────────────────── */
  function makeAudio(name){
    const a = new Audio(ROOT + MEDIA[name]);
    a.preload = HOT_PRELOAD.has(name) || name==='ambient' || name==='darkAmbient' ? 'auto' : 'none';
    a.setAttribute('playsinline','');
    a.volume = VOL[name] == null ? .72 : VOL[name];
    return a;
  }
  function bootMedia(){
    if (mediaBooted || typeof Audio === 'undefined') return;
    mediaBooted = true;
    Object.keys(MEDIA).forEach(name => {
      if (name === 'ambient' || name === 'darkAmbient') return;
      const n = POOL_SIZE[name] || 1;
      pools[name] = Array.from({length:n}, () => makeAudio(name));
      cursors[name] = 0;
    });
    ambientMedia = makeAudio('ambient');
    ambientMedia.loop = true;
    darkAmbientMedia = makeAudio('darkAmbient');
    darkAmbientMedia.loop = true;
    /* One sacrificial media element is explicitly blessed by the first user
       gesture. If Safari later rejects a different Audio element, this bus can
       swap sources and keep the game audible. */
    fallbackBus = makeAudio('wake');
    /* iOS may ignore preload; calling load is still useful everywhere else. */
    try{
      Object.entries(pools).forEach(([name,arr]) => { if(HOT_PRELOAD.has(name)) arr.forEach(a => a.load()); });
      ambientMedia.load(); darkAmbientMedia.load(); fallbackBus.load();
    }catch(e){}
  }

  function mediaNode(name){
    bootMedia();
    const arr = pools[name];
    if (!arr || !arr.length) return null;
    let ix = cursors[name] || 0;
    let a = arr[ix % arr.length];
    cursors[name] = (ix + 1) % arr.length;
    return a;
  }

  function busPlay(name, opts){
    if(!on || !armed || !fallbackBus || !MEDIA[name] || name==='ambient') return Promise.resolve(false);
    try{
      const wanted=ROOT+MEDIA[name];
      if(!fallbackBus.src || !fallbackBus.src.endsWith(MEDIA[name])){ fallbackBus.src=wanted; fallbackBus.load(); }
      else fallbackBus.pause();
      fallbackBus.currentTime=0;
      fallbackBus.playbackRate=Math.max(.72,Math.min(1.45,opts&&opts.rate||1));
      fallbackBus.volume=Math.max(0,Math.min(1,(VOL[name]==null?.72:VOL[name])*(opts&&opts.gain||1)));
      const p=fallbackBus.play();
      if(!p||typeof p.then!=='function'){mediaOK=true;notify();return Promise.resolve(true);}
      return p.then(()=>{mediaOK=true;lastError='';notify();return true;}).catch(err=>{lastError='bus:'+String(err&&(err.name||err.message)||err);notify();return false;});
    }catch(err){lastError='bus:'+String(err&&(err.name||err.message)||err);notify();return Promise.resolve(false);}
  }

  function mediaPlay(name, opts){
    if (!on || !armed || !MEDIA[name] || name === 'ambient') return Promise.resolve(false);
    const a = mediaNode(name); if (!a) return Promise.resolve(false);
    const rate = Math.max(.72, Math.min(1.45, opts && opts.rate || 1));
    try{
      a.pause(); a.currentTime = 0; a.playbackRate = rate;
      a.volume = Math.max(0, Math.min(1, (VOL[name] == null ? .72 : VOL[name]) * (opts && opts.gain || 1)));
      const p = a.play();
      if (!p || typeof p.then !== 'function') { mediaOK = true; lastError=''; notify(); return Promise.resolve(true); }
      return p.then(() => { mediaOK = true; lastError=''; notify(); return true; })
        .catch(err => { lastError = 'media:'+String(err && (err.name||err.message) || err); notify(); return false; });
    }catch(err){ lastError='media:'+String(err && (err.name||err.message) || err); notify(); return Promise.resolve(false); }
  }

  function warmSensoryBank(){
    if(sensoryWarmStarted) return;
    sensoryWarmStarted=true;
    const names=[...new Set(Object.values(DISCOVERY_PROFILES).map(p=>p.cue))].filter(n=>!HOT_PRELOAD.has(n));
    let i=0;
    const step=()=>{
      if(typeof document!=='undefined' && document.hidden){ setTimeout(step,1200); return; }
      for(let n=0;n<4 && i<names.length;n++,i++){
        const arr=pools[names[i]]||[]; arr.forEach(a=>{try{a.load();}catch(e){}});
      }
      if(i<names.length) setTimeout(step,650);
    };
    setTimeout(step,900);
  }

  /* ── WebAudio: enhancement + fallback ───────────────────────────────── */
  function bootSynth(){
    if (ctx || (!window.AudioContext && !window.webkitAudioContext)) return;
    try{
      const AC=(window.AudioContext || window.webkitAudioContext);
      try{ ctx = new AC({ latencyHint:'interactive' }); }
      catch(_){ ctx = new AC(); }
      master = ctx.createGain(); master.gain.value = .78;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value=-16; comp.knee.value=14; comp.ratio.value=4.5; comp.attack.value=.002; comp.release.value=.16;
      master.connect(comp); comp.connect(ctx.destination);
    }catch(e){ lastError='webaudio:'+String(e && (e.name||e.message)||e); }
  }

  function resumeSynth(){
    bootSynth();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'running') return Promise.resolve(true);
    if (unlocking) return unlocking;
    try{
      /* IMPORTANT: ctx.resume() is invoked synchronously from the trusted event
         by armFromGesture(). Do not move this into a timer/promise callback. */
      const p = ctx.resume();
      unlocking = Promise.resolve(p).then(() => {
        unlocking = null;
        const ok = ctx && ctx.state === 'running';
        if (ok) synthPrime();
        notify(); return ok;
      }).catch(err => { unlocking=null; lastError='resume:'+String(err && (err.name||err.message)||err); notify(); return false; });
      return unlocking;
    }catch(err){ unlocking=null; lastError='resume:'+String(err && (err.name||err.message)||err); notify(); return Promise.resolve(false); }
  }

  function synthPrime(){
    if (!ctx || ctx.state!=='running') return;
    try{
      const o=ctx.createOscillator(), g=ctx.createGain();
      g.gain.setValueAtTime(.0001,ctx.currentTime);
      o.connect(g); g.connect(master); o.start(ctx.currentTime); o.stop(ctx.currentTime+.015);
    }catch(e){}
  }
  function env(node,t0,a,d,peak,end){
    const g=ctx.createGain(); g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak==null?.16:peak),t0+Math.max(.001,a));
    g.gain.exponentialRampToValueAtTime(Math.max(.0001,end||.0001),t0+Math.max(.002,a+d));
    node.connect(g); g.connect(master); return g;
  }
  function tone(freq,t0,dur,type,peak,glideTo,detune){
    const o=ctx.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
    if(detune)o.detune.setValueAtTime(detune,t0);
    if(glideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,glideTo),t0+dur);
    env(o,t0,Math.min(.012,dur*.22),dur,peak==null?.14:peak); o.start(t0); o.stop(t0+dur+.08);
  }
  function click(t0,peak){
    const o=ctx.createOscillator(); o.type='square'; o.frequency.setValueAtTime(1550,t0); o.frequency.exponentialRampToValueAtTime(480,t0+.025);
    env(o,t0,.001,.032,peak||.045); o.start(t0); o.stop(t0+.05);
  }
  let noiseBuf=null;
  function noise(t0,dur,peak,hz,q,type){
    if(!noiseBuf){ noiseBuf=ctx.createBuffer(1,ctx.sampleRate*.9,ctx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length*.4); }
    const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=hz||1200; f.Q.value=q||1;
    s.connect(f); env(f,t0,.002,dur,peak==null?.08:peak); s.start(t0); s.stop(t0+dur+.06);
  }
  function thump(t0,peak,f0,f1,dur){ tone(f0||92,t0,dur||.16,'sine',peak||.19,f1||42); noise(t0,.035,(peak||.19)*.18,170,.55,'lowpass'); }
  function chord(freqs,t0,dur,type,peak,spread){ freqs.forEach((f,i)=>tone(f,t0+(spread||.035)*i,dur,type||'triangle',(peak||.08)*(1-i*.06))); }
  const N={c3:130.81,d3:146.83,e3:164.81,g3:196,a3:220,c4:261.63,d4:293.66,e4:329.63,g4:392,a4:440,c5:523.25,d5:587.33,e5:659.25,g5:783.99,a5:880,c6:1046.5};
  const SFX={
    wake(t){ click(t,.035); tone(520,t,.10,'triangle',.06,760); },
    tap(t){ click(t,.05); tone(620,t,.05,'sine',.065,790); }, tap2(t){ click(t,.055); tone(760,t,.06,'triangle',.075,960); },
    untap(t){ tone(430,t,.07,'sine',.06,290); }, charge(t){ tone(94,t,.19,'sine',.11,160); noise(t,.10,.035,900,1.1); },
    impact(t){ thump(t,.25,108,42,.19); click(t+.004,.06); noise(t,.08,.065,1800,.8); },
    fail(t){ thump(t,.20,112,45,.20); tone(165,t+.02,.18,'sawtooth',.05,82); noise(t,.14,.06,330,.7); },
    known(t){ click(t,.04); chord([N.e4,N.a4],t,.14,'triangle',.08,.05); }, route(t){ click(t,.05); chord([N.d4,N.a4,N.d5],t,.18,'triangle',.09,.045); },
    found(t){ thump(t,.16,118,52,.17); noise(t,.06,.06,2600,1.4); chord([N.c5,N.e5,N.g5],t+.02,.32,'triangle',.12,.06); tone(N.c6,t+.19,.38,'sine',.08); },
    chain(t){ chord([N.g5,N.c6],t,.20,'square',.045,.05); click(t,.035); },
    major(t){ thump(t,.32,82,32,.45); noise(t,.18,.09,1500,.8); chord([N.c4,N.g4,N.c5,N.e5,N.g5],t+.03,.62,'triangle',.12,.075); tone(N.c6,t+.34,.72,'sine',.10); },
    domain(t){ thump(t,.34,70,29,.68); noise(t,.42,.085,650,.55); tone(N.a3,t+.03,.88,'sawtooth',.05,N.a4); chord([N.e5,N.a5,N.c6],t+.26,.76,'triangle',.10,.12); },
    secret(t){ thump(t,.22,62,28,.55); tone(N.a4*.997,t,.98,'sine',.08); tone(N.a4*1.004,t,.98,'sine',.08); tone(N.d5,t+.13,.74,'sine',.07); noise(t,.38,.04,4200,3.5); },
    ach(t){ click(t,.05); chord([N.g4,N.c5,N.e5,N.g5],t,.34,'square',.05,.075); },
    reveal(t){ thump(t,.34,55,24,.85); tone(N.c3,t,.98,'sawtooth',.045,N.c4); noise(t+.08,.7,.05,390,.45); chord([N.c5,N.g5,N.c6],t+.62,.95,'triangle',.085,.16); },
    hint(t){ chord([N.d5,N.g5],t,.16,'sine',.065,.06); }, open(t){ tone(510,t,.075,'sine',.055,660); }, close(t){ tone(390,t,.07,'sine',.05,275); },
    origin(t){ thump(t,.38,64,27,.65); noise(t+.02,.21,.065,1500,.8); chord([N.c4,N.g4,N.c5,N.e5],t+.10,.60,'triangle',.105,.09); tone(N.c6,t+.48,.78,'sine',.09); },
    whisper(t){ tone(220,t,.40,'sine',.04,330); tone(441,t+.04,.36,'sine',.03,550); },
    confluence(t){ tone(N.d4,t,.46,'triangle',.07,N.b3||246.94); tone(174.61,t,.46,'triangle',.07,N.a3); tone(N.a3,t+.35,.62,'sine',.10); tone(110,t+.46,.45,'sine',.075); click(t+.42,.024); },
    ending(t){ const seq=[N.c4,N.e4,N.g4,N.c5,N.e5,N.g5,N.c6]; thump(t,.34,52,24,1.1); seq.forEach((f,i)=>tone(f,t+.15*i,1.15,'triangle',.082)); tone(N.c5,t+1.45,2.1,'sine',.075); }
  };
  function synthPlay(name){
    if(!on || !ctx || ctx.state!=='running')return false;
    const f=SFX[name] || SFX[VARIANT_BASE[name]]; if(!f)return false;
    try{f(ctx.currentTime+.004);return true;}catch(e){lastError='synth:'+String(e&&e.message||e);return false;}
  }

  /* ── Public behavior ────────────────────────────────────────────────── */
  function queue(name,opts){ pending.push([name,opts||null]); if(pending.length>10)pending.shift(); }
  function flush(){
    if(!on || !armed || !pending.length)return;
    const q=pending.splice(0,pending.length).slice(-7);
    q.forEach(([name,opts],i)=>setTimeout(()=>play(name,opts),i*20));
  }

  function clamp01(v){ return Math.max(0,Math.min(1,v)); }
  function musicTargets(){
    /* Two measurements keep the score honest: raw discovery count says how far
       the player has travelled; domains say how wide the world has become. */
    const byFound=clamp01((musicFound-24)/250);
    const byGroups=clamp01((musicGroups-4)/14);
    const danger=clamp01(byFound*.62+byGroups*.38);
    /* The darker record waits, then slowly infects the original instead of
       arriving as a gamey level-up cut. */
    const dark=clamp01((danger-.20)/.68);
    const smooth=dark*dark*(3-2*dark);
    const awaken=.34+.66*clamp01(danger/.22);
    return { danger, dark:smooth, lab:VOL.ambient*awaken*(1-smooth*.82), below:VOL.darkAmbient*smooth };
  }
  function fadeMusic(labTarget, darkTarget, ms=1450){
    clearInterval(ambientFadeTimer);
    const a0=ambientMedia?ambientMedia.volume||0:0, d0=darkAmbientMedia?darkAmbientMedia.volume||0:0;
    const a1=clamp01(labTarget), d1=clamp01(darkTarget);
    const steps=Math.max(2,Math.round(Math.max(40,ms)/35));
    const tick=Math.max(16,Math.round(ms/steps)); let i=0;
    ambientFadeTimer=setInterval(()=>{
      i++; const t=i/steps, e=t*t*(3-2*t);
      if(ambientMedia) ambientMedia.volume=a0+(a1-a0)*e;
      if(darkAmbientMedia) darkAmbientMedia.volume=d0+(d1-d0)*e;
      if(i>=steps){clearInterval(ambientFadeTimer);ambientFadeTimer=null;if(ambientMedia)ambientMedia.volume=a1;if(darkAmbientMedia)darkAmbientMedia.volume=d1;}
    },tick);
  }
  function stopMotif(){ clearInterval(motifTimer); motifTimer=null; motifStep=0; }
  function motifTick(){
    if(!on || !armed || !ctx || ctx.state!=='running' || musicLabel!=='CURIOUS' || (typeof document!=='undefined'&&document.hidden)) return;
    const shapes=[[392,523.25,659.25],[440,587.33,698.46],[392,493.88,659.25],[349.23,523.25,659.25]];
    const notes=shapes[motifStep++%shapes.length], t=ctx.currentTime+.01;
    try{notes.forEach((f,i)=>{tone(f,t+i*.16,.34,'sine',.020-i*.0018);tone(f*2,t+.045+i*.16,.20,'triangle',.0065);});}catch(e){}
  }
  function syncMotif(){
    if(musicLabel==='CURIOUS' && on && armed){ if(!motifTimer){ motifTick(); motifTimer=setInterval(motifTick,3150); } }
    else stopMotif();
  }
  function setMusicProgress(found,groups,instant){
    if(Number.isFinite(found)) musicFound=Math.max(4,found);
    if(Number.isFinite(groups)) musicGroups=Math.max(1,groups);
    const t=musicTargets(); musicMix=t.dark;
    const next=t.danger<.12?'CURIOUS':t.danger<.34?'LAB':t.danger<.58?'UNSETTLED':t.danger<.80?'DESCENT':'BELOW';
    musicLabel=next;
    if(typeof document!=='undefined' && document.body) document.body.dataset.room=next.toLowerCase();
    if(on&&armed&&typeof document!=='undefined'&&!document.hidden) fadeMusic(t.lab,t.below,instant?180:1800);
    syncMotif(); notify(); return {stage:musicLabel,mix:musicMix,danger:t.danger};
  }
  function chooseVariant(name){
    const arr=VARIANTS[name]; if(!arr||arr.length<2)return name;
    let bag=variantBags[name];
    if(!bag || !bag.length){
      bag=arr.slice();
      for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
      if(bag.length>1 && bag[0]===variantLast[name]) [bag[0],bag[1]]=[bag[1],bag[0]];
      variantBags[name]=bag;
    }
    const pick=bag.shift(); variantLast[name]=pick; return pick;
  }

  function armFromGesture(cue){
    if(!on)return Promise.resolve(false);
    bootMedia(); bootSynth();
    const first=!armed; armed=true; armedAt=Date.now();
    /* Start actual media *inside* the trusted event. The music element is
       blessed here too; effects working does not imply Safari will allow a
       second media element to begin later from a promise callback. */
    const mp = busPlay(cue || (first?'wake':'tap'), {gain:first?1:.8});
    const blessMusic = media => {
      if(!media)return Promise.resolve(false);
      try{media.loop=true;media.volume=0;const raw=media.play();return raw&&typeof raw.then==='function'?raw.then(()=>true).catch(()=>false):Promise.resolve(true);}catch(e){return Promise.resolve(false);}
    };
    const ap=blessMusic(ambientMedia), dp=blessMusic(darkAmbientMedia);
    const wp = resumeSynth();
    const p = Promise.all([mp,wp,ap,dp]).then(([m,w,a,d])=>{
      /* Arming and ambience are separate decisions. The ambient element is
         silently blessed above inside the gesture, but only the scene that
         owns the moment decides when the room should actually fade in. */
      const ok=!!(m||w||a||d); if(ok){ flush(); warmSensoryBank(); }
      notify(); return ok;
    });
    notify(); return p;
  }

  function unlock(){
    if(!on)return Promise.resolve(false);
    bootMedia(); return resumeSynth();
  }

  function play(name,opts){
    if(!on)return Promise.resolve(false);
    bootMedia(); bootSynth();
    if(!armed){ queue(name,opts); return Promise.resolve(false); }
    name=chooseVariant(name);
    /* Prefer the packaged cue. Only synth if the media path rejects. This
       avoids double-triggering while retaining a real fallback. */
    return mediaPlay(name,opts).then(ok=>{
      if(ok)return true;
      return busPlay(name,opts).then(busOK=>{
        if(busOK)return true;
        if(ctx && ctx.state==='running')return synthPlay(name);
        queue(name,opts); return false;
      });
    });
  }

  function discoveryProfile(id){ return DISCOVERY_PROFILES[id] || null; }
  function discoveryCue(id){ const p=discoveryProfile(id); return p ? p.cue : null; }
  function hasDiscoveryCue(id){ return !!discoveryProfile(id); }
  function playDiscovery(id,opts){
    const p=discoveryProfile(id); if(!p)return Promise.resolve(false);
    const now=Date.now();
    /* Cool down the actual discovery, not the shared sound family. WAVE and SEA
       may use related material but are still separate reveals that deserve sound. */
    if(discoveryLastAt[id] && now-discoveryLastAt[id]<850)return Promise.resolve(false);
    discoveryLastAt[id]=now;
    opts=opts||{};
    return play(p.cue,{gain:(p.gain||1)*(opts.gain==null?1:opts.gain),rate:(p.rate||1)*(opts.rate||1)});
  }

  function test(){
    if(!on)return Promise.resolve(false);
    if(!armed)return armFromGesture('origin');
    return play('origin',{gain:1});
  }

  function startAmbient(){
    if(!on || !armed)return;
    if(typeof document!=='undefined' && document.hidden)return;
    bootMedia();
    const t=musicTargets();
    const startOne=(media,target)=>{
      if(!media)return Promise.resolve(false);
      try{
        media.loop=true;
        if(!media.paused)return Promise.resolve(true);
        media.volume=0; const p=media.play();
        return p&&p.then?p.then(()=>true).catch(()=>false):Promise.resolve(true);
      }catch(e){return Promise.resolve(false);}
    };
    Promise.all([startOne(ambientMedia,t.lab),startOne(darkAmbientMedia,t.below)]).then(ok=>{
      if(ok.some(Boolean)){mediaOK=true;fadeMusic(t.lab,t.below,1100);syncMotif();notify();}
      else startAmbientSynth();
    });
  }
  function startAmbientSynth(){
    bootSynth();
    resumeSynth().then(ok=>{
      if(!ok || ambientSynth || !ctx || ctx.state!=='running' || !on)return;
      try{
        const g=ctx.createGain(); g.gain.value=.0001; g.connect(master);
        const a=ctx.createOscillator(),b=ctx.createOscillator(); a.type='sine';b.type='triangle';
        const deep=musicMix>.45; a.frequency.value=deep?36.7:43;b.frequency.value=deep?55:64.5;b.detune.value=-8;
        a.connect(g);b.connect(g);a.start();b.start();g.gain.exponentialRampToValueAtTime(deep?.024:.018,ctx.currentTime+1.1); ambientSynth={g,a,b,base:deep?.024:.018};syncMotif();
      }catch(e){}
    });
  }
  function pauseAmbient(){
    clearInterval(ambientFadeTimer); ambientFadeTimer=null; stopMotif();
    if(ambientMedia){try{ambientMedia.pause();}catch(e){}}
    if(darkAmbientMedia){try{darkAmbientMedia.pause();}catch(e){}}
    if(ambientSynth&&ctx){try{ambientSynth.g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.12);ambientSynth.a.stop(ctx.currentTime+.15);ambientSynth.b.stop(ctx.currentTime+.15);}catch(e){} ambientSynth=null;}
  }
  function duck(ms=900,factor=.28){
    if(!on || !armed)return;
    clearTimeout(ambientDuckTimer); stopMotif();
    const t=musicTargets(), f=Math.max(.06,Math.min(.8,factor));
    fadeMusic(t.lab*f,t.below*f,90);
    if(ambientSynth&&ctx){
      try{
        const now=ctx.currentTime, base=ambientSynth.base||.02;
        ambientSynth.g.gain.cancelScheduledValues(now);
        ambientSynth.g.gain.setValueAtTime(Math.max(.0002,ambientSynth.g.gain.value),now);
        ambientSynth.g.gain.exponentialRampToValueAtTime(Math.max(.0002,base*f),now+.08);
      }catch(e){}
    }
    ambientDuckTimer=setTimeout(()=>{
      ambientDuckTimer=null;
      if(on&&armed && (typeof document==='undefined'||!document.hidden)){
        fadeMusic(t.lab,t.below,620);
        if(ambientSynth&&ctx){try{const now=ctx.currentTime,base=ambientSynth.base||.02;ambientSynth.g.gain.cancelScheduledValues(now);ambientSynth.g.gain.setValueAtTime(Math.max(.0002,ambientSynth.g.gain.value),now);ambientSynth.g.gain.exponentialRampToValueAtTime(base,now+.42);}catch(e){}}
        syncMotif();
      }
    },Math.max(180,ms));
  }
  function stopAmbient(){
    clearInterval(ambientFadeTimer); ambientFadeTimer=null; clearTimeout(ambientDuckTimer); ambientDuckTimer=null; stopMotif();
    [ambientMedia,darkAmbientMedia].forEach(media=>{if(media){try{media.pause();media.currentTime=0;media.volume=0;}catch(e){}}});
    if(ambientSynth&&ctx){try{ambientSynth.g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.15);ambientSynth.a.stop(ctx.currentTime+.18);ambientSynth.b.stop(ctx.currentTime+.18);}catch(e){} ambientSynth=null;}
  }
  function pulse(level){ try{if(navigator.vibrate)navigator.vibrate(level==='major'?[16,20,30]:level==='fail'?12:7);}catch(e){} }
  function stopEffects(){
    try{Object.values(pools).forEach(arr=>arr.forEach(a=>{a.pause();a.currentTime=0;}));}catch(e){}
    try{if(fallbackBus){fallbackBus.pause();fallbackBus.currentTime=0;}}catch(e){}
  }

  /* Warm URLs early. No playback occurs until a real gesture. */
  bootMedia();

  window.RizoAudio={
    play, playDiscovery, hasDiscoveryCue, discoveryCue, discoveryProfile, test, unlock, armFromGesture, startAmbient, pauseAmbient, stopAmbient, duck, pulse, setMusicProgress,
    set muted(v){ on=!v; if(!on){pending=[];stopAmbient();stopEffects();} notify(); },
    get muted(){return !on;},
    get armed(){return armed;},
    get armedAt(){return armedAt;},
    get mediaOK(){return mediaOK;},
    get lastError(){return lastError;},
    get musicStage(){return musicLabel;},
    get musicMix(){return musicMix;},
    get state(){ if(!on)return 'muted'; if(mediaOK || (ctx&&ctx.state==='running'))return 'running'; return armed?'armed':'locked'; },
    get backend(){ if(mediaOK)return 'media'; if(ctx&&ctx.state==='running')return 'webaudio'; return 'locked'; }
  };
})();
