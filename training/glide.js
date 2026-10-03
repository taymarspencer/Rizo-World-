/*
  SKYBOUND — training game "glide"
  Flap through shifting wind and thread gate centers to charge a Thermal Burst.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingSkybound() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 36;
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

  function updateGlidePet(){const pet=$("#miniPet");if(!pet)return;pet.style.top=`${mini.glideY}px`;pet.style.setProperty("--glide-tilt",`${clamp(mini.glideV/18,-18,22)}deg`);}
  function glideFlap(){if(!mini.active||mini.mode!=="glide")return;mini.glideV=now()<mini.glideThermalUntil?-270:-315;sfx("jump");haptic(6);$("#miniPet")?.classList.add("glide-flap");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("glide-flap"),140);}
  function spawnGlideGate(){const host=$("#glideGates");if(!host)return;const width=el.miniArena.clientWidth,height=el.miniArena.clientHeight,progress=1-Math.max(0,mini.endAt-now())/miniDuration("glide"),rare=Math.random()<.12,gapH=Math.max(104,148-progress*36-(rare?12:0)),margin=84,gapY=margin+gapH/2+Math.random()*Math.max(1,height-margin*2-gapH);const node=document.createElement("div");node.className=`glide-gate ${rare?"prism":""}`;node.innerHTML=`<i class="top"></i><i class="bottom"></i><b>${rare?"◆":""}</b>`;host.appendChild(node);const entity={kind:"glide",node,x:width+38,width:58,gapY,gapH,speed:128+progress*46+(rare?9:0),scored:false,rare};mini.entities.push(entity);mini.glideGateCount+=1;}
  function updateGlideGateNode(entity){const h=el.miniArena.clientHeight,topH=Math.max(0,entity.gapY-entity.gapH/2),bottomY=Math.min(h,entity.gapY+entity.gapH/2);entity.node.style.transform=`translateX(${entity.x}px)`;entity.node.style.setProperty("--gate-top",`${topH}px`);entity.node.style.setProperty("--gate-bottom",`${Math.max(0,h-bottomY)}px`);}
  function glideCrash(){if(now()<mini.glideInvulnerableUntil)return;loseArcadeLife();mini.glideStreak=0;mini.glideDraft=0;const draft=$("#glideDraft");if(draft)draft.textContent="0/3";mini.glideInvulnerableUntil=now()+1250;renderLives("glideHearts");const streak=$("#glideStreak");if(streak)streak.textContent="0";$("#miniPet")?.classList.add("glide-hurt");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("glide-hurt"),520);arcadeSfx("fail");haptic([18,26,18]);mini.glideY=el.miniArena.clientHeight*.46;mini.glideV=-80;for(const entity of mini.entities.filter(e=>e.kind==="glide")){entity.node.remove();}mini.entities=mini.entities.filter(e=>e.kind!=="glide");mini.glideSpawnAt=now()+1050;if(mini.lives<=0)mini.endAt=Math.min(mini.endAt,now()+450);}
  function updateGlideGame(dt){const t=now(),height=el.miniArena.clientHeight,width=el.miniArena.clientWidth,thermal=t<mini.glideThermalUntil;if(mini.glideThermalUntil&&t>=mini.glideThermalUntil){mini.glideThermalUntil=0;$(".glide-world")?.classList.remove("thermal");const banner=$("#glideThermal");if(banner)banner.textContent="CENTER 3 GATES → THERMAL";}if(t>=mini.glideWindAt){mini.glideWind=[-72,-38,0,42,76][Math.floor(Math.random()*5)];mini.glideWindAt=t+5200+Math.random()*2200;const wind=$("#glideWind");if(wind)wind.textContent=mini.glideWind<-20?"UPDRAFT ↑":mini.glideWind>20?"DOWNDRAFT ↓":"CALM AIR";}mini.glideV+=((thermal?525:760)+(thermal?mini.glideWind*.35:mini.glideWind))*dt;mini.glideY+=mini.glideV*dt;updateGlidePet();if(t>=mini.glideSpawnAt){spawnGlideGate();mini.glideSpawnAt=t+1450;}const petX=width*.24,petR=22;for(const entity of [...mini.entities]){if(entity.kind!=="glide")continue;entity.x-=entity.speed*dt;updateGlideGateNode(entity);const overlapX=entity.x<petX+petR&&entity.x+entity.width>petX-petR,top=entity.gapY-entity.gapH/2,bottom=entity.gapY+entity.gapH/2;if(overlapX&&(mini.glideY-petR<top||mini.glideY+petR>bottom))glideCrash();if(!entity.scored&&entity.x+entity.width<petX){entity.scored=true;mini.glideClears+=1;mini.glideStreak+=1;mini.glideBestStreak=Math.max(mini.glideBestStreak,mini.glideStreak);const centered=Math.abs(mini.glideY-entity.gapY)<20,gain=((entity.rare?6:3)+(centered?2:0))*(thermal?2:1);mini.score+=gain;const streak=$("#glideStreak");if(streak)streak.textContent=String(mini.glideStreak);if(centered){mini.glideDraft+=entity.rare?2:1;if(mini.glideDraft>=3){mini.glideDraft=0;mini.glideThermalUntil=t+4200;mini.glideThermals+=1;$(".glide-world")?.classList.add("thermal");const banner=$("#glideThermal");if(banner)banner.textContent="THERMAL BURST • PHYSICS SOFTENED • x2";sensoryBurst("THERMAL BURST","#ffd45a",12);arcadeSfx("win");}else{sensoryBurst("CENTER THREAD","#9eff75",8);sfx("perfect");}const draft=$("#glideDraft");if(draft)draft.textContent=`${mini.glideDraft}/3`;}else sfx(entity.rare?"reward":"spark");}if(entity.x<-90){entity.node.remove();mini.entities=mini.entities.filter(item=>item!==entity);}}if((mini.glideY<28||mini.glideY>height-48)&&t>=mini.glideInvulnerableUntil)glideCrash();}


  // Audit L4: flight physics lives in arena pixels. When the arena changes size
  // (rotation, split view) Rizo and every gate are rescaled to it, so the
  // collision geometry stays where the player sees it.
  function rescaleGlide() {
    const w = el.miniArena.clientWidth, h = el.miniArena.clientHeight;
    const oldW = mini.glideArenaW || w, oldH = mini.glideArenaH || h;
    mini.glideArenaW = w; mini.glideArenaH = h;
    if (!(w > 0 && h > 0) || (w === oldW && h === oldH)) return;
    const sx = w / oldW, sy = h / oldH;
    mini.glideY *= sy; mini.glideV *= sy;
    for (const entity of mini.entities) if (entity.kind === "glide") { entity.x *= sx; entity.gapY *= sy; entity.gapH *= sy; updateGlideGateNode(entity); }
    updateGlidePet();
  }

  function renderScene() {
      mini.glideY = Math.max(90, el.miniArena.clientHeight * .48);
      mini.glideSpawnAt = now() + 900;
      mini.glideWindAt = now() + 5200;
      el.miniArena.innerHTML = `<div class="mini-world glide-world"><div class="glide-clouds"></div><div id="glideGates"></div>${miniPetMarkup("glide-rizo")}<div class="glide-hud" data-mini-readout><span id="glideHearts">♥ ♥ ♥</span><span>THREAD <b id="glideStreak">0</b></span><span>DRAFT <b id="glideDraft">0/3</b></span></div><div id="glideWind" class="glide-wind" data-mini-readout>CALM AIR</div><div id="glideThermal" class="glide-thermal" data-mini-readout>CENTER 3 GATES → THERMAL</div><div class="glide-floor"></div></div>`;
      renderLives("glideHearts"); updateGlidePet();
  }

  globalThis.RizoTraining.register({
    id: "glide",
    name: "SKYBOUND",
    kicker: "CENTER-LINE FLIGHT",
    art: "\u2601",
    button: "FLY",
    hint: "Tap or press Space to flap through shifting wind. Thread gate centers to charge a Thermal Burst that bends the physics in your favor.",
    duration: DURATION,
    energy: 10,
    lives: 3,
    // The score of a solid, competent run: every reward scales against it.
    par: 40,
    trains: { stamina: .6, speed: .4 },
    care: { mood: .8, hype: .8 },
    alignment: 1,
    sounds: { win: "win-air", fail: "fail-air" },
    signal: true,
    music: {tempo:335,lead:[72,null,76,79,83,null,79,76,74,null,78,81,86,null,81,78],bass:[48,null,null,55,52,null,null,59,50,null,null,57,54,null,null,61],wave:"sine"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { glideBestStreak: 0, glideClears: 0, glideDraft: 0, glideGateCount: 0, glideInvulnerableUntil: 0, glideSpawnAt: 0, glideStreak: 0, glideThermalUntil: 0, glideThermals: 0, glideV: 0, glideWind: 0, glideWindAt: 0, glideY: .5, glideArenaW: 0, glideArenaH: 0 });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { rescaleGlide(); updateGlideGame(dt); },
    input() { glideFlap(); },
    key(event) {
      const key = String(event.key);
      if (!(key === " " || key === "Spacebar" || key === "ArrowUp" || key === "w" || key === "W")) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; glideFlap(); return true;
    },
    qualified: b => Boolean((b.playerInputs || 0) >= 1 && (b.glideClears || 0) >= 1),
    result: b => ({ stats: [{ label: "GATES CLEARED", value: b.glideClears }, { label: "THREAD STREAK", value: b.glideBestStreak }, { label: "THERMALS", value: b.glideThermals }, { label: "HEARTS LEFT", value: `${Math.max(0, b.lives || 0)}/${Math.max(1, b.maxLives || 3)}` }] }),
    qaSnapshot: (b, t) => ({ y: b?.glideY || 0, v: b?.glideV || 0, wind: b?.glideWind || 0, hearts: b?.mode === "glide" ? (b?.lives || 0) : 0, streak: b?.glideStreak || 0, gates: b?.glideGateCount || 0, clears: b?.glideClears || 0, draft: b?.glideDraft || 0, thermals: b?.glideThermals || 0, thermal: Boolean((b?.glideThermalUntil || 0) > t) }),
    qaBuffs(b, t) { b.glideThermalUntil = t + 4200; b.glideInvulnerableUntil = t + 1250; },
    qaQualify(b) { b.playerInputs = Math.max(1, b.playerInputs || 0); b.glideClears = Math.max(1, b.glideClears || 0); b.score = Math.max(3, b.score || 0); }
  });
})();
