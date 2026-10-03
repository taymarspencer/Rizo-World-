/*
  RIZO COURIER — training game "rush"
  Rooftop delivery: grab the parcel, clear the rooftops and land at the numbered door.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingRizoCourier() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 30;
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

  function spawnRushEntity(first=false) {
    const host=$("#rushEntities");if(!host)return;
    if(!first&&mini.entities.some(item=>item.kind==="rush"&&item.type==="depot"))return;
    mini.rushRoute+=1;
    const width=el.miniArena.clientWidth,route=mini.rushRoute;
    const speed=210+Math.min(48,(route-1)*12),start=first?width*.80:width+45;
    const pattern=route%3===1?["stump","stump"]:route%3===2?["stump","tall"]:["tall","stump"];
    const add=(type,x,requiredJump=0)=>{
      const node=document.createElement("div");node.className=`rush-entity ${type}`;
      node.innerHTML=type==="prism"?"◆":type==="flame"?"✦":type==="depot"?`<small>DELIVER</small><b>${String(route).padStart(2,"0")}</b>`:type==="tall"?"<small>↑↑</small>":"<small>↑</small>";
      node.style.transform=`translateX(${x}px)`;
      if(type==="flame"||type==="prism")node.style.bottom=`${48+requiredJump+10}px`;
      host.appendChild(node);
      mini.entities.push({kind:"rush",node,type,x,speed,handled:false,requiredJump,nearMissScored:false,minClearance:Infinity});
    };
    add("prism",start,0);
    add(pattern[0],start+240);
    add("flame",start+240,pattern[0]==="tall"?164:126);
    add(pattern[1],start+570);
    add("flame",start+570,pattern[1]==="tall"?164:126);
    add("depot",start+900);
    const hud=$("#rushRoute");if(hud)hud.textContent=`ROUTE ${String(route).padStart(2,"0")} • ${["BACKSTREET","HIGH RISE","LAST BLOCK"][(route-1)%3]}`;
    $(".rush-world")?.setAttribute("data-route",String((route-1)%3));
    rushDeliveryHUD();
  }

  function rushDeliveryHUD(){
    $(".rush-world")?.classList.toggle("has-parcel",mini.rushParcel);
    const delivery=$("#rushDelivery");
    if(delivery)delivery.textContent=mini.rushParcel?`◆ ON BOARD  •  ${"✓".repeat(mini.rushParcelClears)}${"○".repeat(Math.max(0,2-mini.rushParcelClears))}  →  DOOR` : "FIND ◆ • KEEP THE PACKAGE SAFE";
  }
  function rushCallout(copy){const node=$("#rushCallout");if(node)node.textContent=copy;}
  function rushJump() {
    if(mini.lives<=0)return;
    if(mini.jumpY<=3){mini.jumpV=515;mini.rushAirJumps=0;sfx("jump");haptic(9);return;}
    if(mini.rushAirJumps<1){mini.jumpV=Math.max(395,mini.jumpV+245);mini.rushAirJumps+=1;$("#miniPet")?.classList.add("rush-double");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("rush-double"),220);sfx("spark");haptic([6,8]);}
  }

  function updateRushGame(dt) {
    if(mini.lives<=0)return;
    const width=el.miniArena.clientWidth,wasAir=mini.jumpY>0;
    mini.jumpV-=1125*dt;mini.jumpY=Math.max(0,mini.jumpY+mini.jumpV*dt);
    const pet=$("#miniPet"),world=$(".rush-world");
    if(mini.jumpY<=0){
      mini.jumpY=0;mini.jumpV=0;mini.rushAirJumps=0;
      if(wasAir){mini.rushLandingUntil=now()+130;pet?.classList.add("rush-land");queueMiniTimeout(()=>pet?.classList.remove("rush-land"),130);}
    }
    if(pet)pet.style.setProperty("--jump-y",`${mini.jumpY}px`);
    const tag=$(".rush-parcel-tag");if(tag)tag.style.bottom=`${74+mini.jumpY}px`;
    mini.rushRoad+=dt*(210+Math.min(48,(mini.rushRoute-1)*12));
    world?.style.setProperty("--road",`${-mini.rushRoad}px`);
    mini.distanceCarry+=dt*2;if(mini.distanceCarry>=1){const earned=Math.floor(mini.distanceCarry);mini.score+=earned;mini.distanceCarry-=earned;}
    const petX=width*.22;
    for(const entity of [...mini.entities]){
      if(entity.kind!=="rush")continue;
      const previous=entity.x;entity.x-=entity.speed*dt;entity.node.style.transform=`translateX(${entity.x}px)`;
      const crosses=entity.x<petX+36&&previous>petX-36;
      if(!entity.handled&&crosses){
        if(entity.type==="prism"||entity.type==="flame"){
          if(Math.abs(mini.jumpY-entity.requiredJump)<(entity.type==="prism"?44:36)){
            entity.handled=true;entity.node.classList.add("collected");mini.hits+=1;
            if(entity.type==="prism"){
              mini.rushParcel=true;mini.rushParcelClears=0;mini.rushTips=0;rushDeliveryHUD();
              rushCallout("PACKAGE ON BOARD • TWO CLEARS, THEN LAND AT THE DOOR");sfx("reward");haptic([6,10,6]);
            }else{mini.rushTips+=3;mini.score+=3;rushCallout("AIR MAIL +3 • ONE MORE JUMP IF YOU NEED IT");sfx("spark");}
          }
        }else if(entity.type==="depot"){
          if(mini.rushParcel&&mini.rushParcelClears>=2&&mini.jumpY<44){
            entity.handled=true;mini.rushDeliveries+=1;mini.rushParcel=false;
            const gain=14+mini.rushDeliveries*3+mini.rushTips;mini.score+=gain;
            const receipt=$("#rushReceipt");if(receipt){receipt.textContent=`SIGNED. SEALED. +${gain}`;receipt.classList.add("show");queueMiniTimeout(()=>receipt.classList.remove("show"),1250);}
            entity.node.classList.add("delivered");rushDeliveryHUD();rushCallout(`DELIVERY ${mini.rushDeliveries} • RIZO DOES NOT RING TWICE.`);arcadeSfx("win");haptic([8,14,22]);
          }
        }else{
          const needed=entity.type==="tall"?94:56;
          entity.minClearance=Math.min(entity.minClearance,mini.jumpY-needed);
          if(mini.jumpY<needed){
            // Contact is never a clean clear, even during the shared i-frames.
            entity.handled=true;
            if(now()>mini.invulnerableUntil){
              loseArcadeLife();mini.rushStreak=0;
              if(mini.rushParcel){mini.rushParcel=false;mini.rushParcelClears=0;mini.rushPackagesLost+=1;}
              mini.invulnerableUntil=now()+950;renderLives("rushHearts");rushDeliveryHUD();
              const streak=$("#rushStreak");if(streak)streak.textContent="0";
              rushCallout(mini.lives?"PACKAGE DOWN • NEXT PICKUP IS YOUR COMEBACK":"RIZO HAS CLOCKED OUT.");
              pet?.classList.add("rush-hurt");queueMiniTimeout(()=>pet?.classList.remove("rush-hurt"),500);arcadeSfx("fail");haptic([18,25,18]);
              if(mini.lives<=0)mini.endAt=Math.min(mini.endAt,now()+350);
            }
          }
        }
      }
      if(!entity.handled&&["stump","tall"].includes(entity.type)&&entity.x<petX-36){
        entity.handled=true;mini.rushClears+=1;mini.rushStreak+=1;mini.rushBestStreak=Math.max(mini.rushBestStreak,mini.rushStreak);
        const close=entity.minClearance>=0&&entity.minClearance<22;mini.score+=close?5:3;
        if(mini.rushParcel)mini.rushParcelClears=Math.min(2,mini.rushParcelClears+1);
        const streak=$("#rushStreak");if(streak)streak.textContent=String(mini.rushStreak);rushDeliveryHUD();
        rushCallout(close?"SHOE SCUFF +5 • BARELY MADE IT":mini.rushParcelClears>=2?"DOOR AHEAD • LAND TO DELIVER":"CLEAN • KEEP IT IN ONE PIECE");sfx("perfect");
      }
      if(entity.type==="depot"&&!entity.handled&&entity.x<petX-45){
        entity.handled=true;if(mini.rushParcel){mini.rushPackagesLost+=1;mini.rushParcel=false;mini.rushParcelClears=0;rushDeliveryHUD();rushCallout("MISSED THE DOOR • LAND BEFORE THE NEXT ONE");sfx("no");}
      }
      if(entity.x<-90){entity.node.remove();mini.entities=mini.entities.filter(item=>item!==entity);}
    }
  }


  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world rush-world rush-dx"><div class="rush-clouds"></div><div class="rush-hills"></div><div class="rush-ground"></div><div id="rushEntities"></div>${miniPetMarkup("rush-rizo")}<div id="rushHearts" class="rush-hearts" data-mini-readout>♥ ♥ ♥</div><div class="rush-streak" data-mini-readout>CLEAN <b id="rushStreak">0</b></div><div class="rush-delivery" id="rushDelivery" data-mini-readout>FIND ◆ • KEEP THE PACKAGE SAFE</div><div class="rush-callout" id="rushCallout">PICK UP ◆ • JUMP THE ROOFTOPS</div><div class="rush-route" id="rushRoute" data-mini-readout></div><span class="rush-parcel-tag" aria-hidden="true">◆</span><div class="rush-receipt" id="rushReceipt" data-mini-readout></div></div>`;
      renderLives("rushHearts");
      queueMiniInterval(() => { if (mini.active) spawnRushEntity(); }, 180);
      spawnRushEntity(true);
  }

  globalThis.RizoTraining.register({
    id: "rush",
    name: "RIZO COURIER",
    kicker: "ROOFTOP DELIVERY",
    art: "\ud83d\udd25",
    button: "RUN",
    hint: "Grab \u25c6, clear two rooftops, then LAND at the numbered door. Tap / Space to jump; tap again in the air for height and bonus stamps.",
    duration: DURATION,
    energy: 15,
    lives: 3,
    // The score of a solid, competent run: every reward scales against it.
    par: 60,
    trains: { speed: 1 },
    care: { mood: 1, hype: 1 },
    alignment: 0,
    sounds: { win: "win-drop", fail: "fail-drop" },
    signal: true,
    music: {tempo:155,lead:[64,67,71,76,74,71,79,76],bass:[40,40,47,47,45,45,52,52],wave:"square"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { distanceCarry: 0, intervals: [], invulnerableUntil: 0, jumpV: 0, jumpY: 0, rushAirJumps: 0, rushBestStreak: 0, rushClears: 0, rushDeliveries: 0, rushLandingUntil: 0, rushPackagesLost: 0, rushParcel: false, rushParcelClears: 0, rushRoad: 0, rushRoute: 0, rushStreak: 0, rushTips: 0 });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { updateRushGame(dt); },
    input() { rushJump(); },
    key(event) {
      const key = String(event.key);
      if (!(key === " " || key === "Spacebar" || key === "ArrowUp" || key === "w" || key === "W")) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; rushJump(); return true;
    },
    qualified: b => Boolean((b.playerInputs || 0) >= 1 && ((b.rushClears || 0) >= 2 || (b.rushDeliveries || 0) >= 1)),
    result: b => ({
      stats: [{ label: "DELIVERIES", value: b.rushDeliveries }, { label: "CLEAN STREAK", value: b.rushBestStreak }, { label: "OBSTACLES", value: b.rushClears }, { label: "PACKAGES LOST", value: b.rushPackagesLost }],
      voice: b.rushDeliveries > 0 ? { headline: "SHIFT COMPLETE", line: `${b.rushDeliveries} PACKAGES SIGNED FOR. ${b.rushPackagesLost ? "WE DO NOT TALK ABOUT THE OTHERS." : "NOT A SINGLE COMPLAINT. YET."}`, art: "◆" } : null
    }),
    qaSnapshot: b => ({ jumpY: b?.jumpY || 0, airJumps: b?.rushAirJumps || 0, streak: b?.rushStreak || 0, clears: b?.rushClears || 0, parcel: Boolean(b?.rushParcel), parcelClears: b?.rushParcelClears || 0, deliveries: b?.rushDeliveries || 0 }),
    qaAuthored: b => ({ route: b?.rushRoute || 0, parcel: Boolean(b?.rushParcel), tips: b?.rushTips || 0, deliveries: b?.rushDeliveries || 0, lost: b?.rushPackagesLost || 0, clears: b?.rushParcelClears || 0, lives: b?.lives || 0, objects: (b?.entities || []).filter(e => e.kind === "rush").map(e => ({ type: e.type, x: e.x, handled: e.handled })) }),
    qaQualify(b) { b.playerInputs = Math.max(1, b.playerInputs || 0); b.rushClears = Math.max(2, b.rushClears || 0); b.score = Math.max(2, b.score || 0); },
    qa: () => ({
      rushSnapshotForQA: () => (mini ? { hits: mini.hits, jumpY: mini.jumpY, entities: mini.entities.filter(e => e.kind === "rush").map(e => ({ type: e.type, x: e.x, speed: e.speed, handled: e.handled })) } : null)
    })
  });
})();
