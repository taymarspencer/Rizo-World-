/*
  EMBER BEAT — training game "rhythm"
  Four-lane rhythm: tap the matching lane as each note reaches the hit line. The song plays on the run clock.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingEmberBeat() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 27;
  // The live run's services, its board (run.state) and the pet snapshot. Set
  // by start(), cleared by stop(). Hub-era helper names below are bound to them.
  let run = null, mini = null, el = null, pet = null;
  const now = () => run.now();
  const sfx = (...args) => run.sfx(...args);
  const haptic = pattern => run.haptic(pattern);
  const arcadeSfx = (kind, _mode, intensity = 0) => run.cue(kind, intensity);
  const sensoryBurst = (...args) => run.burst(...args);
  const queueMiniTimeout = (fn, ms) => run.after(ms, fn);
  const queueMiniInterval = (fn, ms) => run.every(ms, fn);
  const loseArcadeLife = amount => run.loseLife(amount);
  const renderLives = id => run.renderLives(id);
  const miniPetMarkup = extraClass => run.petMarkup(extraClass);
  const miniDuration = () => DURATION * 1000;

  const EMBER_BEAT_TRACKS = [
    {id:"moss-after-dark",title:"MOSS AFTER DARK",bpm:96,difficulty:"CHILL",stars:1,travel:1.85,steps:16,wave:"sine",swing:.04,lead:[62,null,null,65,69,null,67,null,60,null,64,null,67,null,65,null],bass:[38,null,38,null,43,null,null,43,36,null,36,null,41,null,null,41],drums:[1,0,0,.35,1,0,.2,0,1,0,0,.4,1,0,.2,.55],laneShift:1,chart:[[0,0],[3,1],[4,2],[6,1],[8,3],[11,2],[12,1],[15,0]]},
    {id:"puddle-bounce",title:"PUDDLE BOUNCE",bpm:118,difficulty:"EASY",stars:2,travel:1.72,steps:16,wave:"triangle",swing:.08,lead:[69,null,73,null,76,73,null,71,69,null,66,null,71,73,null,76],bass:[45,null,null,45,50,null,null,50,43,null,null,43,47,null,null,47],drums:[1,0,.25,.6,1,0,.25,.6,1,0,.25,.6,1,0,.4,.75],laneShift:2,chart:[[0,0],[3,1],[4,2],[7,3],[8,2],[11,1],[12,0],[14,2],[15,3]]},
    {id:"frostline",title:"FROSTLINE",bpm:122,difficulty:"NORMAL",stars:2,travel:1.62,steps:16,wave:"sine",swing:.02,lead:[72,null,76,null,79,76,74,null,71,null,74,null,78,76,72,null],bass:[36,null,43,null,40,null,47,null,36,null,43,null,41,null,48,null],drums:[1,0,.35,0,1,.2,.55,0,1,0,.35,.2,1,0,.65,.2],laneShift:1,chart:[[0,0],[2,1],[4,2],[6,3],[7,2],[8,1],[10,0],[12,1],[14,2],[15,3]]},
    {id:"spark-circuit",title:"SPARK CIRCUIT",bpm:152,difficulty:"NORMAL",stars:3,travel:1.5,steps:16,wave:"square",swing:0,lead:[76,null,79,83,81,null,79,86,83,null,81,79,76,79,83,null],bass:[40,null,40,null,45,null,47,null,40,null,43,null,47,null,45,null],drums:[1,0,.45,0,1,0,.65,0,1,0,.45,0,1,0,.7,0],laneShift:1,chart:[[0,0],[2,1],[4,2],[6,3],[7,2],[8,1],[10,0],[12,1],[14,2],[15,3]]},
    {id:"iron-heart",title:"IRON HEART",bpm:126,difficulty:"NORMAL",stars:3,travel:1.54,steps:16,wave:"sawtooth",swing:0,lead:[64,null,64,67,71,null,69,67,62,null,62,66,69,null,67,66],bass:[28,null,35,null,28,null,38,null,31,null,38,null,31,null,40,null],drums:[1,0,.5,0,1,0,.8,0,1,0,.5,0,1,.25,.85,0],laneShift:3,chart:[[0,0],[2,0],[4,1],[6,2],[8,3],[10,3],[12,2],[13,1],[14,0]]},
    {id:"bubblegum-alarm",title:"BUBBLEGUM ALARM",bpm:134,difficulty:"HARD",stars:4,travel:1.42,steps:16,wave:"triangle",swing:.02,lead:[81,83,86,null,83,81,79,null,88,86,83,null,81,83,79,null],bass:[45,null,52,null,47,null,54,null,45,null,52,null,50,null,57,null],drums:[1,.2,.35,.2,1,.2,.6,.2,1,.2,.35,.2,1,.2,.7,.35],laneShift:1,chart:[[0,0],[1,1],[3,2],[4,3],[5,2],[6,1],[8,0],[9,2],[10,3],[12,1],[13,0],[14,2],[15,3]]},
    {id:"aurora-afterparty",title:"AURORA AFTERPARTY",bpm:138,difficulty:"HARD",stars:4,travel:1.38,steps:16,wave:"sine",swing:.06,lead:[79,83,null,86,88,null,86,83,81,84,null,88,91,null,88,84],bass:[43,null,50,null,47,null,54,null,45,null,52,null,48,null,55,null],drums:[1,.15,.45,.15,1,0,.65,.25,1,.15,.45,.2,1,.2,.75,.3],laneShift:2,chart:[[0,0],[1,1],[2,2],[4,3],[6,1],[7,0],[8,2],[9,3],[11,1],[12,0],[13,2],[14,3],[15,1]]},
    {id:"golden-hour",title:"GOLDEN HOUR",bpm:144,difficulty:"HARD",stars:4,travel:1.36,steps:16,wave:"triangle",swing:0,lead:[76,79,83,null,86,83,79,null,88,86,83,79,81,null,84,88],bass:[40,null,47,null,45,null,52,null,43,null,50,null,47,null,54,null],drums:[1,.2,.5,.15,1,.15,.65,.2,1,.2,.55,.15,1,.25,.8,.3],laneShift:3,chart:[[0,0],[1,2],[2,1],[4,3],[5,2],[6,0],[8,1],[9,3],[10,2],[11,0],[12,3],[14,1],[15,2]]},
    {id:"glitch-garden",title:"GLITCH GARDEN",bpm:142,difficulty:"EXPERT",stars:5,travel:1.26,steps:16,wave:"square",swing:.11,lead:[72,null,79,75,null,82,77,null,84,80,null,75,79,null,86,74],bass:[36,null,43,36,null,47,40,null,38,null,45,38,null,48,41,null],drums:[1,.15,0,.65,1,0,.35,.2,1,.15,0,.75,1,.2,.5,.25],laneShift:1,chart:[[0,0],[1,2],[2,1],[3,3],[4,0],[5,1],[7,2],[8,3],[9,1],[10,0],[11,2],[12,3],[13,0],[14,2],[15,1]]},
    {id:"shadow-signal",title:"SHADOW SIGNAL",bpm:158,difficulty:"EXPERT",stars:5,travel:1.2,steps:16,wave:"sawtooth",swing:.04,lead:[67,70,74,77,74,70,79,75,68,72,75,80,77,73,82,79],bass:[31,null,38,null,34,null,41,null,29,null,36,null,33,null,40,null],drums:[1,.2,.55,.2,1,.25,.75,.2,1,.2,.55,.25,1,.3,.85,.35],laneShift:3,chart:[[0,0],[1,1],[2,3],[3,2],[4,0],[5,2],[6,1],[7,3],[8,2],[9,0],[10,3],[11,1],[12,0],[13,3],[14,2],[15,1]]}
  ];
  const EMBER_TRACK_BY_ID = Object.fromEntries(EMBER_BEAT_TRACKS.map(track=>[track.id,track]));

  function shuffleIds(ids) {
    const copy=[...ids];
    for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy;
  }

  function chooseEmberBeatTrack() {
    const history=run.memory();
    const best=run.best;
    // Difficulty opens naturally instead of randomly throwing a brand-new
    // keeper into an Expert chart. A clean early run unlocks Hard; sustained
    // mastery unlocks the two Expert songs.
    const maxStars=best>=90?5:best>=35?4:3;
    const eligible=EMBER_BEAT_TRACKS.filter(track=>(track.stars||1)<=maxStars);
    let bag=Array.isArray(history.emberBag)?[...new Set(history.emberBag)].filter(id=>eligible.some(track=>track.id===id)).slice(0,EMBER_BEAT_TRACKS.length):[];
    if(!bag.length){
      bag=shuffleIds(eligible.map(track=>track.id));
      if(bag.length>1 && bag[0]===history.emberLast){[bag[0],bag[1]]=[bag[1],bag[0]];}
    }
    let id=bag.shift();
    if(id===history.emberLast && bag.length){bag.push(id);id=bag.shift();}
    run.remember({emberBag:bag,emberLast:id});
    return EMBER_TRACK_BY_ID[id] || eligible[0] || EMBER_BEAT_TRACKS[0];
  }

  function rhythmStepSeconds(track){return 60/track.bpm/2;}
  function rhythmStepTime(track,step){
    const base=rhythmStepSeconds(track);
    return step*base + ((step%2===1)?base*(track.swing||0):0);
  }
  function buildRhythmChart(track,durationSeconds=27){
    const events=[]; const phrase=track.steps||16; let phraseIndex=0;
    const notes=Array.isArray(track.chart)?track.chart:[];
    while(true){
      let added=false;
      for(const raw of notes){
        const step=Array.isArray(raw)?Number(raw[0]):Number(raw?.step ?? raw);
        const baseLane=Array.isArray(raw)?Number(raw[1]??step%4):Number(raw?.lane ?? step%4);
        if(!Number.isFinite(step))continue;
        const absoluteStep=phraseIndex*phrase+step;
        const time=rhythmStepTime(track,absoluteStep);
        if(time>durationSeconds-1.05)return events;
        const lane=((baseLane+phraseIndex*(track.laneShift||0))%4+4)%4;
        events.push({id:`${track.id}-${absoluteStep}-${lane}`,step:absoluteStep,hitTime:time,lane,icon:["▲","■","●","◆"][lane]});added=true;
      }
      if(!added)return events; phraseIndex+=1;
    }
  }


  function rhythmClockNow() {
    // Gameplay must never depend on AudioContext.currentTime. Mobile Safari can
    // leave an AudioContext suspended or resume it late. The chart runs on the
    // run clock (seconds), which also stands still while the run is paused, so
    // a pause never costs a note. Web Audio is sound-only.
    return run.now()/1000;
  }

  function stopRhythmVoices() {
    for(const voice of mini.rhythmVoices||[]){try{voice.stop?.();}catch(error){} try{voice.disconnect?.();}catch(error){}}
    mini.rhythmVoices=[];
    try{mini.rhythmGain?.disconnect?.();}catch(error){}
    mini.rhythmGain=null;
  }

  function scheduleRhythmTone(ctx,gainNode,note,when,duration,type,volume=.035){
    if(!run.settings().music||note==null||when<ctx.currentTime-.03)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(run.audio.midi(note),Math.max(ctx.currentTime,when));
    gain.gain.setValueAtTime(.001,Math.max(ctx.currentTime,when));
    gain.gain.linearRampToValueAtTime(volume,Math.max(ctx.currentTime,when)+.008);
    gain.gain.exponentialRampToValueAtTime(.001,Math.max(ctx.currentTime,when)+duration);
    osc.connect(gain).connect(gainNode);osc.start(Math.max(ctx.currentTime,when));osc.stop(Math.max(ctx.currentTime,when)+duration+.03);
    mini.rhythmVoices.push(osc);
  }

  function scheduleRhythmNoise(ctx,gainNode,when,volume=.012){
    if(!run.settings().music||when<ctx.currentTime-.03)return;
    const size=Math.max(1,Math.floor(ctx.sampleRate*.045)),buffer=ctx.createBuffer(1,size,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<size;i+=1)data[i]=(Math.random()*2-1)*(1-i/size);
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
    gain.gain.setValueAtTime(volume,Math.max(ctx.currentTime,when));gain.gain.exponentialRampToValueAtTime(.001,Math.max(ctx.currentTime,when)+.05);
    source.connect(gain).connect(gainNode);source.start(Math.max(ctx.currentTime,when));mini.rhythmVoices.push(source);
  }

  function scheduleRhythmAudio(fromElapsed=0){
    stopRhythmVoices();
    if(!run.settings().music||!mini.active||mini.mode!=="rhythm")return;
    const ctx=run.audio.context();if(!ctx)return;
    const track=mini.rhythmTrack; const gain=ctx.createGain();gain.gain.value=run.audio.musicGain();gain.connect(ctx.destination);mini.rhythmGain=gain;
    const stepSeconds=rhythmStepSeconds(track), total=miniDuration()/1000;
    // Re-anchor sound to the audio clock whenever audio starts/resumes. The
    // visual chart runs on the run clock, so a suspended audio context can
    // never freeze gameplay.
    const startAt=ctx.currentTime-fromElapsed+.045;
    mini.rhythmAudioStartAt=startAt;
    const maxStep=Math.ceil(total/stepSeconds)+2;
    for(let step=0;step<maxStep;step+=1){
      const t=rhythmStepTime(track,step); if(t<fromElapsed-.08)continue;if(t>total)break;
      const when=startAt+t, index=step%(track.steps||16);
      scheduleRhythmTone(ctx,gain,track.lead[index%track.lead.length],when,Math.min(.2,stepSeconds*.72),track.wave,.028);
      scheduleRhythmTone(ctx,gain,track.bass[index%track.bass.length],when,Math.min(.32,stepSeconds*1.2),"triangle",.022);
      const drum=track.drums[index%track.drums.length]||0;
      if(drum)scheduleRhythmNoise(ctx,gain,when,.008+.012*drum);
    }
  }

  function startRhythmPerformance() {
    run.audio.context();
    mini.rhythmReady=false;
    mini.rhythmStartClock=rhythmClockNow()+mini.rhythmLeadIn;
    mini.rhythmAudioStartAt=(run.audio.context()?.currentTime ?? 0)+mini.rhythmLeadIn;
    mini.rhythmChartIndex=0;mini.entities=[];
    scheduleRhythmAudio(-mini.rhythmLeadIn);
    const countdown=$("#rhythmCountdown"),number=countdown?.querySelector("b"),caption=countdown?.querySelector("span");
    [[0,"3","FIND YOUR LANES"],[1000,"2","LEFT • MIDDLE • MIDDLE • RIGHT"],[2000,"1","WAIT FOR THE HIT LINE"],[3000,"GO","FIRST NOTE INCOMING"]].forEach(([delay,value,copy])=>queueMiniTimeout(()=>{if(number){number.textContent=value;number.classList.remove("pulse");void number.offsetWidth;number.classList.add("pulse");}if(caption)caption.textContent=copy;sfx(value==="GO"?"reward":"spark");},delay));
    queueMiniTimeout(()=>{mini.rhythmReady=true;countdown?.classList.add("leave");const callout=$("#rhythmCallout");if(callout)callout.textContent="FIRST NOTE INCOMING";},3000);
    queueMiniTimeout(()=>countdown?.remove(),3300);
    queueMiniTimeout(()=>{$(".rhythm-track-intro")?.classList.add("leave");},2300);
  }

  function rhythmAccuracyPercent(){
    const j=mini.rhythmJudgements||{perfect:0,great:0,good:0,miss:0};
    const total=j.perfect+j.great+j.good+j.miss;
    if(!total)return 100;
    return Math.round(((j.perfect+j.great*.85+j.good*.65)/total)*100);
  }

  function updateRhythmHUD(){
    const combo=$("#rhythmCombo b");if(combo)combo.textContent=String(mini.rhythmStreak||0);
    const accuracy=$("#rhythmAccuracy b");if(accuracy)accuracy.textContent=`${rhythmAccuracyPercent()}%`;
  }

  function pulseRhythmPad(lane,className="pressed"){
    const pad=$(`[data-rhythm-lane="${lane}"]`);if(!pad)return;
    pad.classList.remove("pressed","perfect","wrong");void pad.offsetWidth;pad.classList.add(className);
    queueMiniTimeout(()=>pad?.classList.remove(className),140);
  }

  function spawnRhythmEvent(event) {
    const host=$("#rhythmNotes");if(!host||event.spawned)return;
    const node=document.createElement("i");node.className=`rhythm-note lane-${event.lane}`;node.textContent=event.icon;node.setAttribute("aria-hidden","true");host.appendChild(node);
    event.spawned=true;event.kind="rhythm";event.node=node;event.handled=false;mini.entities.push(event);
  }

  function updateRhythmGame() {
    const elapsed=rhythmClockNow()-mini.rhythmStartClock;
    // Notes may enter behind the countdown during the final travel window so
    // the first beat reaches the line naturally after GO instead of spawning
    // directly on the target with no reaction time.
    while(mini.rhythmChartIndex<mini.rhythmChart.length && mini.rhythmChart[mini.rhythmChartIndex].hitTime-elapsed<=mini.rhythmTravel){
      spawnRhythmEvent(mini.rhythmChart[mini.rhythmChartIndex]);mini.rhythmChartIndex+=1;
    }
    const board=$("#rhythmBoard");
    const boardHeight=Math.max(160,board?.clientHeight||260),spawnY=-48,gateY=boardHeight-54;
    for(const entity of [...mini.entities]){
      if(entity.kind!=="rhythm"||entity.handled)continue;
      const remaining=entity.hitTime-elapsed;
      const progress=1-remaining/mini.rhythmTravel;
      entity.y=spawnY+(gateY-spawnY)*progress;
      entity.node.style.top=`${entity.y}px`;
      if(elapsed-entity.hitTime>.205){
        entity.handled=true;mini.rhythmStreak=0;mini.rhythmMisses+=1;mini.rhythmJudgements.miss+=1;
        const callout=$("#rhythmCallout");if(callout)callout.textContent=`MISS • LANE ${entity.lane+1}`;
        pulseRhythmPad(entity.lane,"wrong");updateRhythmHUD();sfx("no");entity.node.classList.add("missed");queueMiniTimeout(()=>entity.node?.remove(),180);
      }
    }
    mini.entities=mini.entities.filter(entity=>!entity.handled||entity.node?.isConnected);
  }

  function rhythmTap(lane) {
    lane=clamp(Number(lane)||0,0,3);
    if(!mini.rhythmReady){const callout=$("#rhythmCallout");if(callout)callout.textContent="WAIT FOR GO";pulseRhythmPad(lane,"wrong");return;}
    pulseRhythmPad(lane,"pressed");
    const elapsed=rhythmClockNow()-mini.rhythmStartClock;
    const open=mini.entities.filter(item=>item.kind==="rhythm"&&!item.handled);
    const notes=open.filter(item=>item.lane===lane);
    const target=notes.sort((a,b)=>Math.abs(a.hitTime-elapsed)-Math.abs(b.hitTime-elapsed))[0];
    const nearestAny=[...open].sort((a,b)=>Math.abs(a.hitTime-elapsed)-Math.abs(b.hitTime-elapsed))[0];
    if(!target||Math.abs(target.hitTime-elapsed)>.205){
      mini.rhythmBlankTaps+=1;
      if(mini.rhythmStreak>0)mini.rhythmStreak=0;
      const callout=$("#rhythmCallout");
      if(nearestAny&&Math.abs(nearestAny.hitTime-elapsed)<=.23){
        if(callout)callout.textContent=`WRONG LANE • TRY ${nearestAny.lane+1}`;
      }else if(callout){
        const relation=nearestAny?(nearestAny.hitTime>elapsed?"TOO EARLY":"TOO LATE"):"NO NOTE THERE";
        callout.textContent=relation;
      }
      pulseRhythmPad(lane,"wrong");updateRhythmHUD();sfx("no");return;
    }
    const signed=target.hitTime-elapsed,delta=Math.abs(signed);
    const result=delta<=.055?{grade:"PERFECT",points:5,key:"perfect"}:delta<=.105?{grade:"GREAT",points:3,key:"great"}:{grade:"GOOD",points:1,key:"good"};
    target.handled=true;target.node?.classList.add("hit",result.key);queueMiniTimeout(()=>target.node?.remove(),150);
    mini.rhythmStreak+=1;mini.rhythmMaxStreak=Math.max(mini.rhythmMaxStreak,mini.rhythmStreak);mini.hits+=1;mini.rhythmJudgements[result.key]+=1;
    mini.score+=result.points+Math.floor(mini.rhythmStreak/8);
    const timing=delta<=.055?"":signed>0?" • EARLY":" • LATE";
    const callout=$("#rhythmCallout");if(callout)callout.textContent=`${result.grade}${timing} • ${mini.rhythmStreak} COMBO`;
    pulseRhythmPad(lane,result.key==="perfect"?"perfect":"pressed");updateRhythmHUD();
    $("#miniPet")?.classList.add("rhythm-hit");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("rhythm-hit"),220);
    sfx(result.key==="perfect"?"perfect":"dance",mini.rhythmStreak);haptic(result.key==="perfect"?[8,12,8]:6);
  }


  // Bounded play quality (accuracy and combo). Song charts differ in note
  // count, so rewards measure this rather than raw points.
  function rhythmQuality() {
    return Math.max(5, Math.min(80, Math.round(rhythmAccuracyPercent() * .45 + Math.min(35, (mini.rhythmMaxStreak || 0) * .7))));
  }
  // What a run is worth: quality × how much of the song was actually played,
  // so three perfect notes and a quit can't pay like a whole clean song.
  function rhythmRewardScore() {
    const j = mini.rhythmJudgements || {}, judged = (j.perfect || 0) + (j.great || 0) + (j.good || 0) + (j.miss || 0);
    return Math.round(rhythmQuality() * clamp(judged / Math.max(1, mini.rhythmChart.length), 0, 1));
  }

  function renderScene() {
      const track=mini.rhythmTrack || EMBER_BEAT_TRACKS[0];
      const stars="★".repeat(track.stars||1)+"☆".repeat(Math.max(0,5-(track.stars||1)));
      el.miniArena.innerHTML = `<div class="mini-world rhythm-world" data-track="${escapeHTML(track.id)}"><div class="rhythm-lights"></div><div class="rhythm-stage"><img class="rhythm-face-mark" src="./assets/rizo-full-mark.png" alt=""></div>${miniPetMarkup("rhythm-rizo")}<div class="rhythm-board" id="rhythmBoard"><div class="rhythm-lane-columns" aria-hidden="true">${[0,1,2,3].map(lane=>`<i class="rhythm-column lane-${lane}"></i>`).join("")}</div><div class="rhythm-hit-line" aria-hidden="true"></div><div id="rhythmNotes"></div></div><div class="rhythm-status"><span id="rhythmCombo">COMBO <b>0</b></span><span id="rhythmAccuracy">ACCURACY <b>100%</b></span></div><div class="rhythm-pads" aria-label="Ember Beat lanes">${[0,1,2,3].map(lane=>`<button type="button" class="rhythm-pad lane-${lane}" data-rhythm-lane="${lane}" aria-label="Lane ${lane+1}">${["▲","■","●","◆"][lane]}</button>`).join("")}</div><div class="rhythm-track-intro"><small>NOW PLAYING • ${escapeHTML(track.difficulty||"NORMAL")}</small><b>${escapeHTML(track.title)}</b><span>${track.bpm} BPM • ${stars}</span></div><div id="rhythmCallout" class="rhythm-callout">GET READY</div><div id="rhythmCountdown" class="rhythm-countdown"><b>3</b><span>FIND YOUR LANES</span></div></div>`;
      startRhythmPerformance();
  }

  globalThis.RizoTraining.register({
    id: "rhythm",
    name: "EMBER BEAT",
    kicker: "FOUR-LANE RHYTHM",
    art: "\u266b",
    button: "PLAY",
    hint: "Tap the matching lane when its note reaches the bright hit line. Timing and lane both matter.",
    duration: DURATION,
    energy: 12,
    lives: 0,
    // The score of a solid, competent run: every reward scales against it.
    par: 45,
    trains: { speed: 1 },
    care: { bond: .8, mood: 1 },
    alignment: 1,
    sounds: { win: "perfect", fail: "no" },
    signal: true,
    music: false,
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { rhythmBlankTaps: 0, rhythmChart: [], rhythmChartIndex: 0, rhythmGain: null, rhythmJudgements: { perfect:0, great:0, good:0, miss:0 }, rhythmLeadIn: 3.7, rhythmMaxStreak: 0, rhythmMisses: 0, rhythmReady: false, rhythmStartClock: 0, rhythmStreak: 0, rhythmTrack: null, rhythmTravel: 1.6, rhythmVoices: [], rhythmAudioStartAt: 0 });
      mini.rhythmTrack = chooseEmberBeatTrack();
      mini.rhythmTravel = mini.rhythmTrack.travel || 1.6;
      mini.rhythmChart = buildRhythmChart(mini.rhythmTrack, DURATION);
      // The preparation countdown is free time, not part of the scored song.
      mini.endAt += mini.rhythmLeadIn * 1000;
      renderScene();
    },
    stop() {
      stopRhythmVoices();
      run = null; mini = null; el = null; pet = null;
    },
    frame() { updateRhythmGame(); },
    header: () => (mini.rhythmReady ? null : { timer: "READY", score: "0 PTS" }),
    pause() { stopRhythmVoices(); },
    resume() { scheduleRhythmAudio(rhythmClockNow() - mini.rhythmStartClock); },
    settingsChanged(kind) {
      if (kind === "music") { if (run.settings().music) scheduleRhythmAudio(rhythmClockNow() - mini.rhythmStartClock); else stopRhythmVoices(); }
      if (kind === "volume" && mini.rhythmGain) { const ctx = run.audio.context(); if (ctx) { mini.rhythmGain.gain.cancelScheduledValues(ctx.currentTime); mini.rhythmGain.gain.setTargetAtTime(run.audio.musicGain(), ctx.currentTime, .025); } }
    },
    input(event) {
      const laneButton = event.target.closest("[data-rhythm-lane]");
      if (laneButton) { rhythmTap(Number(laneButton.dataset.rhythmLane)); return; }
      const board = $("#rhythmBoard"); const rect = (board || el.miniArena).getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, .9999);
      rhythmTap(Math.floor(ratio * 4));
    },
    key(event) {
      const lane = { "1": 0, "2": 1, "3": 2, "4": 3, d: 0, f: 1, j: 2, k: 3 }[String(event.key).toLowerCase()];
      if (lane === undefined) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; rhythmTap(lane); return true;
    },
    qualified: b => Boolean(b.hits >= 3),
    result: b => ({
      rewardScore: rhythmRewardScore(),
      subtitle: `${b.rhythmTrack?.title || "EMBER BEAT"} • ${b.rhythmTrack?.difficulty || "NORMAL"}`,
      stats: [{ label: "ACCURACY", value: `${rhythmAccuracyPercent()}%` }, { label: "MAX COMBO", value: b.rhythmMaxStreak || 0 }, { label: "PERFECT", value: b.rhythmJudgements?.perfect || 0 }, { label: "MISSES", value: b.rhythmJudgements?.miss || 0 }]
    }),
    qaMini: b => ({ track: b?.rhythmTrack?.id || null, voices: (b?.rhythmVoices || []).length }),
    qaQualify(b) { b.hits = Math.max(3, b.hits || 0); b.score = Math.max(3, b.score || 0); },
    qa: () => ({
      chooseEmberBeatTrack: () => (run ? chooseEmberBeatTrack() : null),
      beatTracksForQA: () => ({ tracks: EMBER_BEAT_TRACKS, chart: EMBER_BEAT_TRACKS.map(track => ({ id: track.id, events: buildRhythmChart(track) })), stepSeconds: EMBER_BEAT_TRACKS.map(track => ({ id: track.id, value: rhythmStepSeconds(track) })) }),
      rhythmTapForQA: lane => (mini?.active && mini.mode === "rhythm" ? rhythmTap(Number(lane)) : null),
      rhythmTimingForQA: () => {
        const live = Boolean(mini?.active && mini.mode === "rhythm");
        const elapsed = live ? rhythmClockNow() - mini.rhythmStartClock : null;
        const open = live ? mini.rhythmChart.filter(note => !note.handled).map(note => ({ lane: note.lane, hitTime: note.hitTime, delta: note.hitTime - elapsed })).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta)).slice(0, 4) : [];
        return { ready: Boolean(mini?.rhythmReady), elapsed, open };
      },
      rhythmSnapshot: () => (mini ? { track: mini.rhythmTrack?.id || null, difficulty: mini.rhythmTrack?.difficulty || null, chart: mini.rhythmChart.map(note => ({ hitTime: note.hitTime, lane: note.lane, handled: note.handled || false })), streak: mini.rhythmStreak, maxStreak: mini.rhythmMaxStreak, judgements: { ...(mini.rhythmJudgements || {}) }, accuracy: rhythmAccuracyPercent() } : null),
      rhythmQualityForQA: () => (mini ? { quality: rhythmQuality(), reward: rhythmRewardScore() } : null)
    })
  });
})();
