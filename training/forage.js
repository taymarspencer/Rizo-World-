/*
  FOREST LUNCH — training game "forage"
  Pack the picky lunch ticket: steer to the requested food before its row reaches the packing line.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingForestLunch() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 28;
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

  const FORAGE_FOODS = [
    {id:"berry",icon:"🍓",name:"BERRY"},{id:"meat",icon:"🍗",name:"SNACK"},{id:"fruit",icon:"🍎",name:"FRUIT"}
  ];
  function buildForageOrder(){
    const length=clamp(3+Math.floor((mini?.forageOrdersDone||0)/2),3,5),order=[];
    while(order.length<length){const choices=FORAGE_FOODS.filter(food=>food.id!==order.at(-1));order.push((choices[Math.floor(Math.random()*choices.length)]||FORAGE_FOODS[0]).id);}
    return order;
  }
  function updateForageOrderHUD(){
    const host=$("#forageOrder"); if(!host)return;
    host.innerHTML=`<small>RIZO WANTS</small>${mini.forageOrder.map((id,index)=>{const food=FORAGE_FOODS.find(item=>item.id===id);return `<span class="${index===mini.forageOrderIndex?"active":index<mini.forageOrderIndex?"done":""}">${food?.icon||"?"}</span>`;}).join("")}`;
  }
  function advanceForageOrder(){
    mini.forageOrderIndex+=1;
    if(mini.forageOrderIndex>=mini.forageOrder.length){
      mini.forageOrdersDone+=1;mini.score+=10+Math.min(8,mini.forageOrdersDone*2);mini.treasureRolls+=1;
      if(mini.forageOrdersDone%2===0){mini.forageRushUntil=now()+3600;sensoryBurst("PICNIC PANIC • PICK FAST","#ffd76a",16);arcadeSfx("win");}
      else sensoryBurst(`LUNCH ${mini.forageOrdersDone} PACKED`,`#9eff75`,12);
      mini.forageOrder=buildForageOrder();mini.forageOrderIndex=0;
    }
    updateForageOrderHUD();
  }

  function setForageLane(lane) {
    mini.lane = clamp(Math.round(lane), 0, 2);
    const pet = $("#miniPet");
    if (pet) pet.style.left = `${[16.7,50,83.3][mini.lane]}%`;
  }

  // One readable decision row at a time. Food is chosen for the current ticket,
  // never for a ticket that will be stale by the time the row reaches Rizo.
  function createForageDrop(lane,{kind="wanted",wanted=null}={}) {
    const host=$("#forageDrops"); if(!host)return;
    const wantedId=wanted||mini.forageOrder[mini.forageOrderIndex];
    const bad=kind==="bad",rare=kind==="rare";
    const foods=FORAGE_FOODS.filter(food=>kind==="wrong"?food.id!==wantedId:food.id===wantedId);
    const food=foods[Math.floor(Math.random()*foods.length)]||FORAGE_FOODS[0];
    const node=document.createElement("div");
    node.className=`forage-drop ${bad?"bad":"good"} ${rare?"rare":""}`;
    node.textContent=bad?"🍄":rare?"💎":food.icon;
    node.style.left=`${[16.7,50,83.3][lane]}%`;
    node.setAttribute("aria-label",bad?"Mushroom: spoils the chain":rare?"Prism: bonus, no ticket progress":food.name);
    host.appendChild(node);
    const panic=now()<mini.forageRushUntil;
    const travel=panic?1.05:Math.max(1.28,1.85-mini.forageOrdersDone*.09);
    const y=112,catchY=Math.max(166,el.miniArena.clientHeight-115);
    mini.entities.push({kind:"forage",node,lane,good:!bad,rare,foodId:bad||rare?null:food.id,y,speed:(catchY-y)/travel,caught:false});
    node.style.transform=`translate(-50%,${y}px)`;
  }

  function spawnForageItem() {
    if(now()<mini.forageNextAt||mini.entities.some(item=>item.kind==="forage"&&!item.caught))return;
    const wanted=mini.forageOrder[mini.forageOrderIndex];
    const lane=mini.forageRows===0?2:Math.floor(Math.random()*3);
    mini.forageRows+=1;
    createForageDrop(lane,{kind:"wanted",wanted});
    createForageDrop((lane+1)%3,{kind:"wrong",wanted});
    // A prism is a visible detour: points now, but the lunch still needs its food.
    createForageDrop((lane+2)%3,{kind:mini.forageRows%4===0?"rare":"bad",wanted});
  }

  function forageFeedback(copy,good=true){
    const ticket=$("#forageTicketState");
    if(ticket){ticket.textContent=copy;ticket.dataset.result=good?"good":"bad";}
    mini.forageFeedbackUntil=now()+700;
  }

  function updateForageGame(dt) {
    const height=el.miniArena.clientHeight,panic=now()<mini.forageRushUntil,world=$(".forage-world");
    world?.classList.toggle("picnic-panic",panic);
    const ticket=$("#forageTicketState");
    if(ticket&&now()>=mini.forageFeedbackUntil){
      ticket.textContent=panic?"PICNIC PANIC • KEEP PACKING":`LUNCH ${mini.forageOrdersDone+1} • ${mini.forageOrderIndex}/${mini.forageOrder.length} PACKED`;
      ticket.dataset.result="";
    }
    const row=mini.entities.filter(item=>item.kind==="forage"&&!item.caught);
    const catchY=Math.max(166,height-115);
    for(const item of row){item.y+=item.speed*dt;item.node.style.transform=`translate(-50%,${item.y}px)`;}
    if(!row.length||row[0].y<catchY)return;
    const picked=row.find(item=>item.lane===mini.lane);
    if(picked){
      const wanted=mini.forageOrder[mini.forageOrderIndex];
      if(picked.rare){
        mini.score+=7;mini.hits+=1;mini.treasureRolls+=1;
        forageFeedback("PRISM +7 • STILL NEED THE FOOD");sfx("reward");
      }else if(picked.good&&picked.foodId===wanted){
        mini.hits+=1;mini.forageStreak+=1;mini.forageBestStreak=Math.max(mini.forageBestStreak,mini.forageStreak);
        const gain=3*Math.min(3,1+Math.floor(mini.forageStreak/4));mini.score+=gain;
        const completes=mini.forageOrderIndex===mini.forageOrder.length-1;
        advanceForageOrder();
        forageFeedback(completes?`LUNCH ${mini.forageOrdersDone} PACKED!`:`THAT'S THE ONE! +${gain}`);
        sfx(completes?"reward":"eat");haptic(completes?[8,10,16]:8);
      }else{
        mini.score=Math.max(0,mini.score-(picked.good?1:4));mini.forageStreak=0;mini.forageMistakes+=1;
        forageFeedback(picked.good?"WRONG FOOD • SAME REQUEST":"MUSHROOM?! RIZO SENT IT BACK",false);
        arcadeSfx("fail");haptic([12,16,12]);
      }
      const pet=$("#miniPet"),good=picked.rare||picked.good&&picked.foodId===wanted;
      pet?.classList.add(good?"forage-catch":"forage-hit");
      queueMiniTimeout(()=>pet?.classList.remove("forage-catch","forage-hit"),280);
      const streak=$("#forageStreak");if(streak)streak.textContent=String(mini.forageStreak);
    }
    for(const item of row){
      item.caught=true;item.node.classList.add(item===picked?"caught":"passed");
      queueMiniTimeout(()=>item.node.remove(),180);
    }
    mini.entities=mini.entities.filter(item=>!row.includes(item));
    mini.forageNextAt=now()+(panic?170:320);
  }

  // A route is a guaranteed pickup, two authored clears, then a physical door.
  // All objects share a speed so their jump spacing cannot collapse mid-route.

  function renderScene() {
      mini.forageOrder = buildForageOrder();
      el.miniArena.innerHTML = `<div class="mini-world forage-world forage-dx"><div class="forage-lanes"><i></i><i></i></div><div id="forageDrops" class="forage-drops"></div>${miniPetMarkup("forage-rizo")}<div id="forageOrder" class="forage-order"></div><div id="forageTicketState" class="forage-ticket-state">PACK THE TICKET</div><div class="forage-chain">LUNCH CHAIN <b id="forageStreak">0</b></div><div class="forage-catch-line"><span>PACK HERE</span></div><div class="lane-labels"><span>← LEFT</span><span>MIDDLE</span><span>RIGHT →</span></div></div>`;
      setForageLane(1); updateForageOrderHUD();
      queueMiniInterval(() => { if (mini.active) spawnForageItem(); }, 120);
      spawnForageItem();
  }

  globalThis.RizoTraining.register({
    id: "forage",
    name: "FOREST LUNCH",
    kicker: "PICKY LITTLE MENACE",
    art: "\ud83c\udf53",
    button: "FORAGE",
    hint: "Pick the requested food before its row reaches PACK HERE. Tap a lane or use \u2190 \u2192. Prisms pay +7 but do not pack the ticket.",
    duration: DURATION,
    energy: 11,
    lives: 0,
    // The score of a solid, competent run: every reward scales against it.
    par: 70,
    trains: { instinct: .64, luck: .36 },
    care: { mood: .9, hunger: 20 },
    alignment: 0,
    sounds: { win: "win-lunch", fail: "fail-lunch" },
    music: {tempo:285,lead:[64,66,67,71,67,66,62,64],bass:[40,null,43,null,38,null,45,null],wave:"square"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { forageBestStreak: 0, forageFeedbackUntil: 0, forageMistakes: 0, forageNextAt: 0, forageOrder: [], forageOrderIndex: 0, forageOrdersDone: 0, forageRows: 0, forageRushUntil: 0, forageStreak: 0, intervals: [], lane: 1, treasureRolls: 0 });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { updateForageGame(dt); },
    input(event) { const rect = el.miniArena.getBoundingClientRect(); const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1); setForageLane(Math.min(2, Math.floor(ratio * 3))); },
    move(event) { if (event.buttons === 0 && event.pointerType === "mouse") return; const rect = el.miniArena.getBoundingClientRect(); const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1); setForageLane(Math.min(2, Math.floor(ratio * 3))); },
    key(event) {
      const key = String(event.key);
      if (!(key === "ArrowLeft" || key === "ArrowRight" || key.toLowerCase() === "a" || key.toLowerCase() === "d")) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1;
      setForageLane((mini.lane || 0) + ((key === "ArrowLeft" || key.toLowerCase() === "a") ? -1 : 1)); return true;
    },
    qualified: b => Boolean((b.playerInputs || 0) >= 1 && b.hits >= 2),
    result: b => ({
      stats: [{ label: "LUNCH CHAIN", value: b.forageBestStreak }, { label: "TICKETS PACKED", value: b.forageOrdersDone }, { label: "PLATES TAKEN", value: b.hits }, { label: "PRISM ROLLS", value: b.treasureRolls }],
      voice: b.forageOrdersDone > 0 ? { headline: "LUNCH IS SERVED", line: `${b.forageOrdersDone} LUNCHES PACKED. RIZO IS INSPECTING YOUR WORK.`, art: "🍓" } : null
    }),
    qaSnapshot: (b, t) => ({ lane: b?.lane || 0, streak: b?.forageStreak || 0, best: b?.forageBestStreak || 0, order: [...(b?.forageOrder || [])], orderIndex: b?.forageOrderIndex || 0, ordersDone: b?.forageOrdersDone || 0, panic: Boolean((b?.forageRushUntil || 0) > t) }),
    qaAuthored: (b, t) => ({ rows: b?.forageRows || 0, mistakes: b?.forageMistakes || 0, nextIn: Math.max(0, (b?.forageNextAt || 0) - t), drops: (b?.entities || []).filter(e => e.kind === "forage").map(e => ({ lane: e.lane, food: e.foodId, y: e.y, rare: e.rare, good: e.good })) }),
    qaQualify(b) { b.playerInputs = Math.max(1, b.playerInputs || 0); b.hits = Math.max(2, b.hits || 0); b.score = Math.max(2, b.score || 0); },
    qa: () => ({
      arcadeForageCompleteOrderForQA: () => {
        if (!mini?.active || mini.mode !== "forage") return null;
        mini.forageOrderIndex = Math.max(0, (mini.forageOrder || []).length - 1); advanceForageOrder();
        return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().forage;
      }
    })
  });
})();
