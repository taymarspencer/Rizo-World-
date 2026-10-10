/*
  RAIN WALK — training game "walk"
  A living-forest walk: tap finds, hop hazards, choose the path twice and pick how the story ends.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingRainWalk() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 48;
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

  const WALK_BIOMES = {
    rain:{ id:"rain", name:"RAIN TRAIL", className:"biome-rain", sky:"#526c78", rareBias:0, objects:["leaf","ember","flower","puddle","friend","strange"] },
    moss:{ id:"moss", name:"MOSS HOLLOW", className:"biome-moss", sky:"#426f59", rareBias:.08, objects:["leaf","flower","friend","mushroom","strange","seed"] },
    moon:{ id:"moon", name:"MOON GROVE", className:"biome-moon", sky:"#30375f", rareBias:.12, objects:["moonleaf","ember","friend","strange","puddle","star"] },
    storm:{ id:"storm", name:"STORM RIDGE", className:"biome-storm", sky:"#354258", rareBias:.18, objects:["ember","storm","puddle","strange","friend","thread"] }
  };

  const WALK_WEATHER = {
    drizzle:{ id:"drizzle", label:"DRIZZLE", className:"weather-drizzle", findBias:"puddle" },
    clear:{ id:"clear", label:"CLEAR AIR", className:"weather-clear", findBias:"flower" },
    mist:{ id:"mist", label:"LOW MIST", className:"weather-mist", findBias:"strange" },
    storm:{ id:"storm", label:"STORM", className:"weather-storm", findBias:"storm" }
  };

  function chooseWalkBiome() {
    const hour = new Date().getHours();
    const room = pet.room;
    if (room === "forest" || pet.variant === "moss") return WALK_BIOMES.moss;
    if (room === "void" || hour < 6 || hour > 20) return WALK_BIOMES.moon;
    if (pet.mutation === "stormmarked" || Math.random() < .16) return WALK_BIOMES.storm;
    return WALK_BIOMES.rain;
  }

  function chooseWalkWeather(biome) {
    if (biome.id === "storm") return WALK_WEATHER.storm;
    if (biome.id === "moon") return Math.random() < .55 ? WALK_WEATHER.mist : WALK_WEATHER.clear;
    const roll = Math.random();
    return roll < .48 ? WALK_WEATHER.drizzle : roll < .73 ? WALK_WEATHER.clear : WALK_WEATHER.mist;
  }


  // Flavors the walk's opening line by the pet's rolled personality so the
  // same activity reads differently across pets instead of one generic line.
  const WALK_INTRO_LINES = {
    "CHAOTIC GOOD": "IS ALREADY RUNNING AHEAD.",
    "TINY CEO": "IS SUPERVISING THE TRAIL.",
    "SOFT MENACE": "IS WALKING SUSPICIOUSLY CALMLY.",
    "FOREST GREMLIN": "IS SNIFFING EVERYTHING.",
    "DRAMA FLAME": "IS NARRATING THIS WALK OUT LOUD.",
    "QUIET GENIUS": "IS QUIETLY MAPPING THE TRAIL.",
    "SNACK SCHOLAR": "IS ALREADY LOOKING FOR SNACKS.",
    "CERTIFIED HATER": "IS WALKING. RELUCTANTLY.",
    "LOYAL WEIRDO": "KEEPS CHECKING YOU'RE STILL THERE.",
    "MAIN CHARACTER": "IS WALKING LIKE THIS IS A MONTAGE."
  };
  function walkIntroLine() {
    return `${pet.name} ${WALK_INTRO_LINES[pet.personality] || "IS SNIFFING EVERYTHING."}`;
  }

  // Mid-walk fork: stops spawning and lets the player choose a safer or riskier
  // back half of the walk. The clock keeps running; the card counts down and
  // Rizo chooses if the player doesn't.
  function setWalkCaption(title, text = "") {
    const caption = $("#walkCaption");
    if (!caption) return;
    caption.innerHTML = `<b>${escapeHTML(title)}</b>${text ? `<span>${escapeHTML(text)}</span>` : ""}`;
  }

  function walkDecisionConfig(index) {
    if (index === 0) return {
      title:"THE TRAIL SPLITS",
      choices:[
        {id:"safe", title:"STAY NEAR THE LANTERNS", copy:"Steady finds • calmer weather", risk:0, luck:1, biome:null},
        {id:"deep", title:"FOLLOW THE RUSTLING", copy:"Harder trail • rare encounters", risk:2, luck:0, biome:"moss"}
      ]
    };
    if (mini.walkPath === "deep" || mini.walkRisk >= 2) return {
      title:"SOMETHING MOVED AHEAD",
      choices:[
        {id:"stream", title:"CROSS THE BLACK STREAM", copy:"Stamina test • storm treasures", risk:2, luck:1, biome:"storm"},
        {id:"ruins", title:"ENTER THE ROOT RUINS", copy:"Instinct test • Shadow chance", risk:3, luck:2, biome:"moon"}
      ]
    };
    return {
      title:"RIZO STOPS TO LISTEN",
      choices:[
        {id:"meadow", title:"TAKE THE FLOWER FIELD", copy:"Bond and common treasures", risk:0, luck:2, biome:"moss"},
        {id:"lantern", title:"FOLLOW THE OLD LANTERN", copy:"Luck and strange signals", risk:1, luck:3, biome:"moon"}
      ]
    };
  }

  // Two forks occur per walk and can change the biome, weather and discovery
  // pool. Each gives the player WALK_DECISION_MS to choose.
  function maybeShowWalkFork() {
    if (mini.mode !== "walk" || !mini.active || mini.pausedByFork) return;
    if(mini.walkDecisionIndex>=2){maybeShowWalkEncounter();return;}
    const elapsed = 1 - Math.max(0, mini.endAt - now()) / miniDuration("walk");
    const threshold = mini.walkDecisionIndex === 0 ? .29 : .66;
    if (elapsed < threshold) return;
    const decision = walkDecisionConfig(mini.walkDecisionIndex);
    mini.pausedByFork = true;
    mini.walkDecisionDue = now() + WALK_DECISION_MS;
    setWalkCaption(decision.title, "Choose the kind of story this walk becomes — before Rizo does.");
    const host = $("#walkFinds");
    if (!host) return;
    const fork = document.createElement("div");
    fork.className = "walk-fork";
    fork.innerHTML = WALK_TIMER_MARKUP + decision.choices.map(choice => `<button type="button" class="walk-fork-btn" data-walk-fork="${choice.id}"><b>${escapeHTML(choice.title)}</b><span>${escapeHTML(choice.copy)}</span></button>`).join("");
    host.appendChild(fork);
    haptic(12);
  }

  function chooseWalkFork(path, auto = false) {
    if (!mini.active || mini.mode !== "walk" || !mini.pausedByFork) return;
    const decision = walkDecisionConfig(mini.walkDecisionIndex);
    const choice = decision.choices.find(item => item.id === path);
    if (!choice) return;
    mini.walkChoices.push(choice.id);
    if (auto) mini.walkAutoPicks += 1;
    mini.walkPath = mini.walkDecisionIndex === 0 ? choice.id : `${mini.walkPath || "trail"}-${choice.id}`;
    mini.walkRisk += choice.risk || 0;
    mini.walkLuck += choice.luck || 0;
    mini.pausedByFork = false;
    mini.walkDecisionDue = 0;
    mini.walkDecisionIndex += 1;
    $(".walk-fork")?.remove();
    mini.entities.filter(item=>item.kind==="walk").forEach(item=>item.node.remove());
    mini.entities=mini.entities.filter(item=>item.kind!=="walk");
    if (choice.biome && WALK_BIOMES[choice.biome]) {
      mini.walkBiome = WALK_BIOMES[choice.biome];
      if (choice.biome === "storm") mini.walkWeather = WALK_WEATHER.storm;
      else if (choice.biome === "moon") mini.walkWeather = WALK_WEATHER.mist;
      applyWalkWorldTheme();
    }
    const response = {
      safe:`${pet.name} KEEPS ONE EYE ON THE LANTERNS.`,
      deep:`${pet.name} PUSHES INTO THE DEEP BRUSH.`,
      stream:`${pet.name} SPLASHES ACROSS WITHOUT ASKING.`,
      ruins:`${pet.name} HEARS SOMETHING INSIDE THE ROOTS.`,
      meadow:`${pet.name} STOPS TO SMELL EVERY FLOWER.`,
      lantern:`THE LANTERN FLICKERS WHEN ${pet.name} GETS CLOSE.`
    }[choice.id] || `${pet.name} CHOOSES THE STRANGE WAY.`;
    setWalkCaption(mini.walkBiome.name, auto ? `${pet.name} DECIDED FOR YOU. ${response}` : response);
    mini.score += auto ? 0 : choice.risk ? 2 : 1;
    mini.treasureRolls += choice.luck || 0;
    sfx(choice.risk >= 2 ? "event" : "spark");
    haptic(choice.risk >= 2 ? [10,16,10] : 8);
    spawnWalkFind();
  }

  const WALK_ENCOUNTERS={
    meadow:{icon:"🌼",title:"THE FLOWERS ARE FOLLOWING YOU",copy:"Rizo stops. Every flower stops a second later.",safe:"LEAVE ONE A SNACK",bold:"INVITE THEM HOME",ending:"THE GARDEN WALKED YOU HOME",quiet:"ONE FLOWER WAVES GOODBYE"},
    lantern:{icon:"☾",title:"THE LANTERN KNOWS YOUR NAME",copy:"It flashes once for every thing you put in your pocket.",safe:"SIT BESIDE THE LIGHT",bold:"ANSWER THE SIGNAL",ending:"SOMETHING ANSWERS BACK",quiet:"YOU KEEP ITS LITTLE SECRET"},
    stream:{icon:"ϟ",title:"A STAR UNDER THE WATER",copy:"The storm goes quiet. Something bright is caught between the stones.",safe:"MARK THE SPOT",bold:"REACH INTO THE STREAM",ending:"YOU BROUGHT THE STORM HOME",quiet:"THE STAR CAN WAIT UNTIL TOMORROW"},
    ruins:{icon:"◇",title:"YOUR SHADOW TAKES ONE MORE STEP",copy:"Rizo has stopped walking. The other set of footsteps has not.",safe:"BACK AWAY TOGETHER",bold:"SHOW IT YOUR POCKET FINDS",ending:"YOUR SHADOW SAYS THANK YOU",quiet:"TWO SETS OF FOOTSTEPS GO HOME"}
  };
  function maybeShowWalkEncounter(){
    if(mini.walkEncounter||mini.walkEnding||mini.pausedByFork)return;
    if(1-Math.max(0,mini.endAt-now())/miniDuration("walk")<.80)return;
    const id=mini.walkChoices[1]||"meadow",story=WALK_ENCOUNTERS[id]||WALK_ENCOUNTERS.meadow;
    mini.walkEncounter=id;mini.pausedByFork=true;mini.walkDecisionDue=now()+WALK_DECISION_MS;
    const ready=mini.walkNotes.length>=3;
    const card=document.createElement("div");card.className="walk-fork walk-encounter";
    card.innerHTML=WALK_TIMER_MARKUP+`<div class="walk-encounter-intro"><i>${story.icon}</i><b>${story.title}</b><p>${story.copy}</p></div><button type="button" class="walk-fork-btn" data-walk-ending="quiet"><b>${story.safe}</b><span>A quiet ending • +6</span></button><button type="button" class="walk-fork-btn" data-walk-ending="bold"><b>${story.bold}</b><span>${ready?"Your 3 different finds fit the story • +18":"Needs 3 different finds. You have "+mini.walkNotes.length+" • risk losing 3 points"}</span></button>`;
    $("#walkFinds")?.appendChild(card);setWalkCaption("RIZO STOPS", "Choose how this ends — or Rizo takes the quiet way home.");sfx("event");haptic([8,16,8]);
  }
  function chooseWalkEnding(choice,auto=false){
    if(!mini.active||mini.mode!=="walk"||!mini.pausedByFork||!mini.walkEncounter||mini.walkEnding)return;
    if(!["quiet","bold"].includes(choice))return;
    const story=WALK_ENCOUNTERS[mini.walkEncounter]||WALK_ENCOUNTERS.meadow;
    const success=choice==="bold"&&mini.walkNotes.length>=3;
    const gain=auto?3:choice==="quiet"?6:success?18:-3;
    if(auto)mini.walkAutoPicks+=1;
    mini.walkEnding=success?story.ending:choice==="quiet"?story.quiet:"RIZO DECIDES YOU HAVE BEEN WEIRD ENOUGH";
    mini.score=Math.max(0,mini.score+gain);mini.hits+=1;
    if(success)mini.treasureRolls+=2;
    mini.pausedByFork=false;mini.walkDecisionDue=0;
    $(".walk-encounter")?.remove();
    mini.entities.filter(item=>item.kind==="walk").forEach(item=>item.node.remove());mini.entities=mini.entities.filter(item=>item.kind!=="walk");
    $(".walk-world")?.classList.add("walk-homecoming");
    const notes=$("#walkNotes");if(notes)notes.innerHTML=`<b>${success?"A STRANGE LITTLE SOUVENIR":"A STORY TO TAKE HOME"}</b><span>${story.icon}</span><small>${escapeHTML(mini.walkEnding)}</small>`;
    setWalkCaption(mini.walkEnding,gain>0?`+${gain} • ${pet.name} WALKS A LITTLE CLOSER ON THE WAY BACK.`:"YOU LET IT GO. IT LETS YOU GO.");
    walkReaction(success?"awe":"celebrate");sfx(success?"reward":gain<0?"no":"spark");haptic(success?[8,16,24]:8);
  }
  function rememberWalkFind(data){
    if(["hazard","obstacle"].includes(data.type)||mini.walkNotes.some(note=>note.label===data.label)||mini.walkNotes.length>=3)return;
    mini.walkNotes.push({label:data.label,icon:data.icon});
    const host=$("#walkNotes");
    if(host)host.innerHTML=`<b>POCKET FINDS ${mini.walkNotes.length}/3</b><span>${mini.walkNotes.map(note=>`<i title="${escapeHTML(note.label)}">${note.icon}</i>`).join("")}${"<i>◇</i>".repeat(3-mini.walkNotes.length)}</span><small>${mini.walkNotes.length===3?"SOMETHING ON THIS TRAIL WILL RECOGNIZE THESE":"KEEP AN EYE OUT FOR SOMETHING DIFFERENT"}</small>`;
    if(mini.walkNotes.length===3){$(".walk-world")?.classList.add("notes-ready");sfx("perfect");}
  }

  function applyWalkWorldTheme() {
    const world = $(".walk-world");
    if (!world) return;
    world.className = `mini-world walk-world ${mini.walkBiome.className} ${mini.walkWeather.className}`;
    world.dataset.walkBiome = mini.walkBiome.id;
  }


  const WALK_OBJECTS = {
    leaf:{icon:"🍂",label:"CRUNCHY LEAF",points:1,type:"good",reaction:"inspect"},
    ember:{icon:"✦",label:"LOST EMBER",points:3,type:"good",reaction:"celebrate"},
    flower:{icon:"🌼",label:"MOON FLOWER",points:2,type:"good",reaction:"inspect"},
    strange:{icon:"?",label:"STRANGE SIGNAL",points:6,type:"rare",reaction:"awe"},
    puddle:{icon:"💧",label:"DEEP PUDDLE",points:-2,type:"hazard",reaction:"splash"},
    friend:{icon:"🐛",label:"TINY FRIEND",points:3,type:"good",reaction:"inspect"},
    mushroom:{icon:"🍄",label:"MOSS MUSHROOM",points:2,type:"good",reaction:"sniff"},
    seed:{icon:"◇",label:"FOREST SEED",points:5,type:"rare",reaction:"awe"},
    moonleaf:{icon:"☾",label:"MOON LEAF",points:4,type:"good",reaction:"awe"},
    star:{icon:"★",label:"FALLEN STAR",points:7,type:"rare",reaction:"celebrate"},
    storm:{icon:"ϟ",label:"STORM SHARD",points:7,type:"rare",reaction:"shock"},
    thread:{icon:"⌁",label:"GOLD THREAD",points:8,type:"rare",reaction:"awe"},
    log:{icon:"▰",label:"FALLEN LOG",points:2,type:"obstacle",reaction:"jump"}
  };

  function walkObjectPool() {
    const biome = mini.walkBiome || WALK_BIOMES.rain;
    const ids = [...biome.objects, "log"];
    const rareChance = .08 + (biome.rareBias || 0) + mini.walkRisk * .035 + mini.walkLuck * .025;
    let pool = ids.map(id => WALK_OBJECTS[id]).filter(Boolean);
    if (Math.random() < rareChance) {
      const rare = pool.filter(item => item.type === "rare");
      if (rare.length) return rare;
    }
    pool = pool.filter(item => item.type !== "rare" || Math.random() < .12);
    if (mini.walkWeather?.findBias && Math.random() < .22 && WALK_OBJECTS[mini.walkWeather.findBias]) return [WALK_OBJECTS[mini.walkWeather.findBias]];
    return pool;
  }

  function spawnWalkFind() {
    const host=$("#walkFinds"); if(!host||mini.walkEnding||mini.pausedByFork)return;
    if(mini.entities.filter(item=>item.kind==="walk"&&!item.handled).length>=3)return;
    const pool=walkObjectPool();
    const opening=[WALK_OBJECTS.leaf,WALK_OBJECTS.friend,WALK_OBJECTS.ember];
    const data=mini.walkFindCount<3?opening[mini.walkFindCount]:pool[Math.floor(Math.random()*pool.length)]||WALK_OBJECTS.leaf;
    const first=mini.walkFindCount===0;mini.walkFindCount+=1;
    const node=document.createElement("button");
    node.type="button"; node.className=`walk-find ${data.type} reaction-${data.reaction}`; node.dataset.walkFind=data.label; node.textContent=data.icon; node.setAttribute("aria-label",`Interact with ${data.label}`);
    host.appendChild(node);
    const lane = Math.random() < .25 ? "high" : "ground";
    node.dataset.lane = lane;
    mini.entities.push({kind:"walk",node,data,x:first?el.miniArena.clientWidth*.62:el.miniArena.clientWidth+20,speed:70+Math.random()*12+mini.walkRisk*4,handled:false,lane});
  }

  function walkReaction(reaction, negative = false) {
    const pet=$("#miniPet");
    if (!pet) return;
    const classes=["walk-inspect","walk-splash","walk-jump","walk-awe","walk-shock","walk-sniff","walk-celebrate"];
    pet.classList.remove(...classes);
    const map={inspect:"walk-inspect",splash:"walk-splash",jump:"walk-jump",awe:"walk-awe",shock:"walk-shock",sniff:"walk-sniff",celebrate:"walk-celebrate"};
    void pet.offsetWidth;
    pet.classList.add(map[reaction] || (negative ? "walk-splash" : "walk-inspect"));
    queueMiniTimeout(()=>pet?.classList.remove(...classes),560);
  }

  function collectWalkObject(node) {
    const entity=mini.entities.find(item=>item.kind==="walk"&&item.node===node);
    if(!entity||entity.handled)return;
    entity.handled=true;
    const points = entity.data.type === "obstacle" ? 3 : entity.data.type === "hazard" ? 2 : entity.data.points;
    rememberWalkFind(entity.data);
    mini.score=Math.max(0,mini.score+points);
    mini.hits += points > 0 ? 1 : 0;
    if(entity.data.type==="rare") mini.treasureRolls+=2;
    if(entity.data.type==="obstacle") mini.treasureRolls += .25;
    const copy=entity.data.type==="hazard"?`${pet.name} HOPS THE PUDDLE. DRY SOCKS. +2`:entity.data.type==="obstacle"?`${pet.name} CLEARED THE LOG. +3`:`${entity.data.label} • ${points>0?"+":""}${points}`;
    setWalkCaption(mini.walkBiome.name,copy);
    walkReaction(entity.data.type==="hazard"?"jump":entity.data.reaction,points<0);
    sfx(points<0?"sick":entity.data.type==="rare"?"reward":entity.data.type==="obstacle"?"jump":"spark");
    haptic(points<0?[18,18,18]:entity.data.type==="rare"?[8,10,14]:8);
    entity.node.classList.add("collected");
    queueMiniTimeout(()=>entity.node.remove(),220);
  }

  function updateWalkGame(dt) {
    mini.walkDistance += dt * (56 + mini.walkRisk * 3);
    const world=$(".walk-world");
    if(world) world.style.setProperty("--walk-distance",String(mini.walkDistance));
    $$(".walk-layer",world || el.miniArena).forEach(layer=>{
      const speed=Number(layer.dataset.walkSpeed)||.3;
      layer.style.backgroundPositionX=`${-mini.walkDistance*speed}px`;
    });
    const progress=clamp(1-Math.max(0,mini.endAt-now())/miniDuration("walk"),0,1);
    const bar=$("#walkDistanceBar"); if(bar)bar.style.width=`${progress*100}%`;
    const petX=el.miniArena.clientWidth*.19;
    for(const entity of [...mini.entities]){
      if(entity.kind!=="walk")continue;
      entity.x-=entity.speed*dt;
      const y=entity.lane==="high"?"132px":"74px";
      entity.node.style.left=`${entity.x}px`;
      entity.node.style.bottom=y;
      if(!entity.handled && entity.x < petX+20 && entity.x > petX-34 && ["hazard","obstacle"].includes(entity.data.type)){
        entity.handled=true;
        if(entity.data.type==="hazard"){
          mini.score=Math.max(0,mini.score-2); walkReaction("splash",true); sfx("sick"); setWalkCaption(mini.walkBiome.name,`${pet.name} FOUND THE DEEPEST PART OF THE PUDDLE.`);
        } else {
          mini.score=Math.max(0,mini.score-1); walkReaction("shock",true); sfx("no"); setWalkCaption(mini.walkBiome.name,`${pet.name} BUMPED THE LOG. THE LOG WON.`);
        }
        entity.node.classList.add("collected"); queueMiniTimeout(()=>entity.node.remove(),220);
      }
      if(entity.x < -90 || entity.handled){
        if(entity.x < -90) entity.node.remove();
        mini.entities=mini.entities.filter(item=>item!==entity);
      }
    }
  }


  // ===== TIMED CHOICES =====
  const WALK_DECISION_MS = 6500;
  const WALK_TIMER_MARKUP = '<i class="walk-decision-timer" data-walk-timer aria-live="polite"></i>';
  // Bold personalities take the riskier path when left to choose.
  const WALK_BOLD_PERSONALITIES = ["CHAOTIC GOOD", "FOREST GREMLIN", "DRAMA FLAME", "MAIN CHARACTER", "SOFT MENACE"];
  function walkAutoChoice(decision) { return WALK_BOLD_PERSONALITIES.includes(pet.personality) ? decision.choices[1] : decision.choices[0]; }
  function updateWalkDecision() {
    const left = Math.max(0, (mini.walkDecisionDue || 0) - now());
    const timer = $("[data-walk-timer]");
    if (timer) timer.textContent = `${pet.name} DECIDES IN ${Math.ceil(left / 1000)}`;
    if (left > 0) return;
    if (mini.walkEncounter && !mini.walkEnding) chooseWalkEnding("quiet", true);
    else chooseWalkFork(walkAutoChoice(walkDecisionConfig(mini.walkDecisionIndex)).id, true);
  }
  // While Rizo stops to listen the world holds still, but the trail bar keeps time.
  function updateWalkProgress() {
    const progress = clamp(1 - Math.max(0, mini.endAt - now()) / miniDuration(), 0, 1);
    const bar = $("#walkDistanceBar"); if (bar) bar.style.width = `${progress * 100}%`;
  }
  function walkChoose(key) {
    if (!mini.pausedByFork) return false;
    if (mini.walkEncounter) chooseWalkEnding(key === "1" ? "quiet" : "bold");
    else chooseWalkFork(walkDecisionConfig(mini.walkDecisionIndex).choices[Number(key) - 1].id);
    return true;
  }

  function renderScene() {
      const biome = mini.walkBiome || WALK_BIOMES.rain;
      const weather = mini.walkWeather || WALK_WEATHER.drizzle;
      el.miniArena.innerHTML = `<div class="mini-world walk-world ${biome.className} ${weather.className}" data-walk-biome="${biome.id}">
        <div class="walk-sky"></div><div class="walk-weather"></div>
        <div class="walk-layer walk-far" data-walk-speed=".18"></div>
        <div class="walk-layer walk-mid" data-walk-speed=".43"></div>
        <div class="walk-layer walk-near" data-walk-speed=".82"></div>
        <div class="walk-path"></div><div id="walkFinds"></div>${miniPetMarkup("walk-rizo")}
        <div class="walk-distance"><i id="walkDistanceBar"></i></div><div id="walkNotes" class="walk-notes" data-mini-readout><b>POCKET FINDS</b><span>◇ ◇ ◇</span><small>3 DIFFERENT FINDS → A STRANGER ENDING</small></div>
        <div id="walkCaption" class="walk-caption"><b>${escapeHTML(biome.name)} • ${escapeHTML(weather.label)}</b><span>${escapeHTML(walkIntroLine())}</span></div>
      </div>`;
      // The walk fork is a deliberate design pause with its own clock credit, so
      // it still suppresses spawns separately from the shared hold.
      queueMiniInterval(() => { if (mini.active && !mini.pausedByFork) spawnWalkFind(); }, 1450);
      spawnWalkFind();
      setWalkCaption(mini.walkBiome.name, "TAP A FIND TO INSPECT IT. TAP LOGS AND PUDDLES TO HOP OVER.");
  }

  globalThis.RizoTraining.register({
    id: "walk",
    name: "RAIN WALK",
    kicker: "LIVING FOREST",
    art: "\u2602",
    button: "WALK",
    hint: "Tap finds to fill your pockets; tap hazards to hop them. Choose your path before Rizo does. Keyboard: Space inspects, 1 / 2 chooses.",
    duration: DURATION,
    energy: 8,
    lives: 0,
    // The score of a solid, competent run: every reward scales against it.
    par: 60,
    trains: { stamina: .76, luck: .24 },
    care: { bond: 1, mood: 1, hunger: -4 },
    alignment: 1,
    sounds: { win: "win-lunch", fail: "fail-lunch" },
    quest: "walk",
    counter: "totalWalks",
    finds: { treasure: true, variants: ["shadow", "moss"] },
    music: {tempo:360,lead:[67,null,71,74,72,null,69,67],bass:[43,null,50,null,45,null,52,null],wave:"triangle"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { intervals: [], pauseAt: 0, pausedByFork: false, treasureRolls: 0, walkChoices: [], walkDecisionIndex: 0, walkDistance: 0, walkEncounter: null, walkEnding: "", walkFindCount: 0, walkLuck: 0, walkNotes: [], walkPath: null, walkRisk: 0, walkDecisionDue: 0, walkAutoPicks: 0, walkBiome: null, walkWeather: null });
      mini.walkBiome = chooseWalkBiome();
      mini.walkWeather = chooseWalkWeather(mini.walkBiome);
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) {
      if (!mini.pausedByFork) maybeShowWalkFork();
      if (mini.pausedByFork) { updateWalkDecision(); updateWalkProgress(); return; }
      updateWalkGame(dt);
    },
    input(event) {
      const ending = event.target.closest("[data-walk-ending]");
      if (ending) { chooseWalkEnding(ending.dataset.walkEnding); return; }
      const forkBtn = event.target.closest(".walk-fork-btn");
      if (forkBtn) { chooseWalkFork(forkBtn.dataset.walkFork); return; }
      if (mini.pausedByFork) return;
      const find = event.target.closest(".walk-find");
      if (find) collectWalkObject(find);
    },
    key(event) {
      const key = String(event.key).toLowerCase();
      if (["1", "2"].includes(key) && mini.pausedByFork) { event.preventDefault(); mini.playerInputs += 1; return walkChoose(key); }
      if (mini.pausedByFork || !(key === " " || key === "enter")) return false;
      event.preventDefault(); mini.playerInputs += 1;
      const find = mini.entities.filter(item => item.kind === "walk" && !item.handled && item.x >= 0 && item.x < el.miniArena.clientWidth - 20).sort((a, b) => a.x - b.x)[0];
      if (find) collectWalkObject(find.node);
      return true;
    },
    // Rizo's own choices don't count as play: a run needs the player's input.
    qualified: b => Boolean((b.playerInputs || 0) >= 1 && ((b.walkChoices || []).length > (b.walkAutoPicks || 0) || b.hits >= 1)),
    result: b => {
      const path = String(b.walkPath || "");
      const deepBonus = b.walkRisk >= 4 || path.includes("ruins") ? 3 : b.walkRisk >= 2 || path.startsWith("deep") ? 2 : 1;
      const variants = [];
      if (b.score >= 15) variants.push({ id: "shadow", chance: .035 * deepBonus, source: path === "deep" ? "THE RUSTLING PATH" : "A PATH THAT WAS NOT THERE BEFORE" });
      if (b.score >= 10) variants.push({ id: "moss", chance: .12 * deepBonus, source: "THE RAIN TRAIL" });
      return {
        stats: [{ label: "DISTANCE", value: `${Math.round(b.walkDistance || 0)}m` }, { label: "DISCOVERIES", value: b.hits }, { label: "TRAIL RISK", value: b.walkRisk }, { label: "LUCK READ", value: b.walkLuck }],
        voice: b.walkEnding ? { headline: "HOME AGAIN", line: b.walkEnding, art: "☾" } : null,
        finds: { treasure: (b.treasureRolls || 0) > 0 || b.score >= 12, treasureForce: (b.treasureRolls || 0) > 1, variants }
      };
    },
    qaAuthored: b => ({ notes: [...(b?.walkNotes || [])], choices: [...(b?.walkChoices || [])], ending: b?.walkEnding || "", encounter: b?.walkEncounter || null, paused: Boolean(b?.pausedByFork), decisionIn: b?.pausedByFork && mini === b ? Math.max(0, (b.walkDecisionDue || 0) - now()) : 0, autoPicks: b?.walkAutoPicks || 0 }),
    qaQualify(b) { b.playerInputs = Math.max(1, b.playerInputs || 0); b.hits = Math.max(1, b.hits || 0); b.score = Math.max(1, b.score || 0); }
  });
})();
