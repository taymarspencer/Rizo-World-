/*
  RIZO RUNAWAY — training game "maze"
  Maze chase: eat the Ember trail, and use Prism Seeds to flip the hunt and tag the Shadows.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingRizoRunaway() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 54;
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

  const RUNAWAY_MAZE = [
    "###############","#o.....#.....o#","#.###.#.#.###.#","#.....#.#.....#","###.#.....#.###","#...#.###.#...#","#.#...#.#...#.#","#.#.###.###.#.#","#.............#","#.#.###.###.#.#","#.#...#.#...#.#","#...#.###.#...#","###.#.....#.###","#.....#.#.....#","#.###.#.#.###.#","#o.....#.....o#","###############"
  ];
  const MAZE_DIRS={up:{dr:-1,dc:0},down:{dr:1,dc:0},left:{dr:0,dc:-1},right:{dr:0,dc:1}};
  const MAZE_REVERSE={up:"down",down:"up",left:"right",right:"left"};
  function mazeOpen(r,c){return Boolean(mini.mazeGrid?.[r]?.[c]&&mini.mazeGrid[r][c]!=="#");}
  function mazeCellKey(r,c){return `${r}-${c}`;}
  function mazeSetDirection(dir){if(!MAZE_DIRS[dir]||!mini.mazePlayer)return;mini.mazePlayer.nextDir=dir;mini.mazeInputs=(mini.mazeInputs||0)+1;mini.mazeTurnHistory.push(dir);if(mini.mazeTurnHistory.length>12)mini.mazeTurnHistory.shift();const counts={};for(const item of mini.mazeTurnHistory)counts[item]=(counts[item]||0)+1;mini.mazeFavoriteDir=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||"";}
  function mazeStepPoint(actor,dir){const d=MAZE_DIRS[dir];return d?{r:actor.r+d.dr,c:actor.c+d.dc}:null;}
  function mazeCanMove(actor,dir){const p=mazeStepPoint(actor,dir);return Boolean(p&&mazeOpen(p.r,p.c));}
  function mazeActorStyle(node,r,c){if(!node)return;const rows=mini.mazeGrid.length,cols=mini.mazeGrid[0]?.length||15;node.style.left=`${((c+.5)/cols)*100}%`;node.style.top=`${((r+.5)/rows)*100}%`;}
  function buildMazeLevel(first=false){
    mini.mazeGrid=RUNAWAY_MAZE.map(row=>row.split(""));mini.mazeMoveCarry=0;mini.mazeHunterCarry=0;mini.mazeHuntUntil=0;mini.mazeCombo=0;
    const board=$("#mazeBoard");if(!board)return;board.innerHTML="";board.style.setProperty("--maze-cols",String(mini.mazeGrid[0].length));board.style.setProperty("--maze-rows",String(mini.mazeGrid.length));
    mini.mazePellets=0;
    mini.mazeGrid.forEach((row,r)=>row.forEach((cell,c)=>{const tile=document.createElement("i");tile.className=cell==="#"?"maze-wall":"maze-floor";tile.dataset.mazeCell=mazeCellKey(r,c);if(cell!=="#"){if(cell==="o"){tile.classList.add("power");tile.innerHTML="<b>◆</b>";}else{tile.classList.add("pellet");tile.innerHTML="<b>•</b>";}mini.mazePellets+=1;}board.appendChild(tile);}));
    const player=document.createElement("div");player.id="mazeRizo";player.className="maze-rizo";player.innerHTML=miniPetMarkup("maze-rizo-inner");board.appendChild(player);
    mini.mazePlayer={r:8,c:7,dir:"down",nextDir:"down",node:player};mazeActorStyle(player,8,7);mini.mazeHunterWakeAt=now()+(first?1150:700);
    const starts=[{r:8,c:1,kind:"chase"},{r:8,c:13,kind:"ambush"},{r:3,c:7,kind:"wander"}];
    mini.mazeHunters=starts.map((spot,index)=>{const node=document.createElement("div");node.className=`maze-hunter hunter-${index}`;node.innerHTML="<i></i><b>×</b>";board.appendChild(node);const hunter={...spot,spawnR:spot.r,spawnC:spot.c,dir:index===0?"right":index===1?"left":"down",node,index};mazeActorStyle(node,spot.r,spot.c);return hunter;});
    // Do not award the starting tile for free.
    const startTile=board.querySelector(`[data-maze-cell="${mazeCellKey(8,7)}"]`);if(startTile?.classList.contains("pellet")){startTile.classList.remove("pellet");startTile.innerHTML="";mini.mazeGrid[8][7]=" ";mini.mazePellets-=1;}
    const level=$("#mazeLevel"),combo=$("#mazeCombo"),lives=$("#mazeLives"),callout=$("#mazeCallout");if(level)level.textContent=String(mini.mazeLevel);if(combo)combo.textContent="0";renderLives(lives);if(callout)callout.textContent=first?"MOVE FIRST • SHADOWS ARE WAKING":"NEW MAZE • SHADOWS WAKE FASTER";
  }
  function mazeCollect(){
    const p=mini.mazePlayer,cell=mini.mazeGrid[p.r][p.c];if(cell!=="."&&cell!=="o")return;
    const tile=$("#mazeBoard")?.querySelector(`[data-maze-cell="${mazeCellKey(p.r,p.c)}"]`);mini.mazeGrid[p.r][p.c]=" ";mini.mazePellets=Math.max(0,mini.mazePellets-1);tile?.classList.remove("pellet","power");if(tile)tile.innerHTML="";
    if(cell==="o"){mini.score+=6;mini.mazeHunts+=1;mini.mazeCombo=0;mini.mazeHuntUntil=now()+5400;$(".maze-world")?.classList.add("hunt");const callout=$("#mazeCallout");if(callout)callout.textContent="PRISM HUNT • CHASE THEM";sensoryBurst("HUNT MODE","#bdf7ff",12);sfx("reward");haptic([7,10,7]);}
    else{mini.score+=1;sfx("spark",mini.mazePellets%8);}
    if(mini.mazePellets<=0){mini.score+=25*mini.mazeLevel;mini.lives=Math.min(mini.maxLives||3,(mini.lives||0)+1);renderLives("mazeLives");mini.mazeLevel+=1;sensoryBurst(`MAZE ${mini.mazeLevel}`,"#ffd45a",14);arcadeSfx("win");queueMiniTimeout(()=>{if(mini.active&&mini.mode==="maze")buildMazeLevel(false);},520);}
  }
  function mazeHunterTarget(hunter){
    const p=mini.mazePlayer;if(hunter.kind==="ambush"){const predicted=mini.mazeLevel>=2&&mini.mazeFavoriteDir?mini.mazeFavoriteDir:p.dir;const d=MAZE_DIRS[predicted]||MAZE_DIRS.left;return{r:p.r+d.dr*3,c:p.c+d.dc*3};}
    if(hunter.kind==="wander"&&Math.random()<.48)return{r:1+Math.floor(Math.random()*15),c:1+Math.floor(Math.random()*13)};
    return{r:p.r,c:p.c};
  }
  function mazeChooseHunterDir(hunter){
    let dirs=Object.keys(MAZE_DIRS).filter(dir=>mazeCanMove(hunter,dir));if(dirs.length>1)dirs=dirs.filter(dir=>dir!==MAZE_REVERSE[hunter.dir]);if(!dirs.length)dirs=Object.keys(MAZE_DIRS).filter(dir=>mazeCanMove(hunter,dir));if(!dirs.length)return hunter.dir;
    const target=mazeHunterTarget(hunter),hunting=now()<mini.mazeHuntUntil;
    dirs.sort((a,b)=>{const pa=mazeStepPoint(hunter,a),pb=mazeStepPoint(hunter,b),da=Math.abs(pa.r-target.r)+Math.abs(pa.c-target.c),db=Math.abs(pb.r-target.r)+Math.abs(pb.c-target.c);return hunting?db-da:da-db;});
    if(Math.random()<(.24-(mini.mazeLevel-1)*.02))return dirs[Math.floor(Math.random()*dirs.length)];return dirs[0];
  }
  function mazeResetAfterHit(){const p=mini.mazePlayer;p.r=8;p.c=7;p.dir="down";p.nextDir="down";mazeActorStyle(p.node,p.r,p.c);mini.mazeHunters.forEach(h=>{h.r=h.spawnR;h.c=h.spawnC;h.dir=h.index===0?"right":h.index===1?"left":"down";mazeActorStyle(h.node,h.r,h.c);});}
  function mazeCollision(){
    const p=mini.mazePlayer,t=now();for(const h of mini.mazeHunters){if(h.r!==p.r||h.c!==p.c)continue;if(t<mini.mazeHuntUntil){mini.mazeCombo+=1;mini.mazeBestCombo=Math.max(mini.mazeBestCombo,mini.mazeCombo);mini.mazeHunterTags+=1;const gain=10*Math.min(5,mini.mazeCombo);mini.score+=gain;h.r=h.spawnR;h.c=h.spawnC;mazeActorStyle(h.node,h.r,h.c);const combo=$("#mazeCombo"),callout=$("#mazeCallout");if(combo)combo.textContent=String(mini.mazeCombo);if(callout)callout.textContent=`SHADOW TAG x${mini.mazeCombo} • +${gain}`;sfx("perfect");haptic([8,10,12]);continue;}if(t<mini.mazeInvulnerableUntil)continue;loseArcadeLife();mini.mazeCombo=0;mini.mazeInvulnerableUntil=t+1500;const combo=$("#mazeCombo"),callout=$("#mazeCallout");renderLives("mazeLives");if(combo)combo.textContent="0";if(callout)callout.textContent=mini.lives>0?"CAUGHT • ROUTE RESET":"THE SHADOWS GOT RIZO";$("#mazeRizo")?.classList.add("hurt");queueMiniTimeout(()=>$("#mazeRizo")?.classList.remove("hurt"),520);arcadeSfx("fail");haptic([20,24,20]);if(mini.lives<=0){mini.endAt=Math.min(mini.endAt,t+450);return;}mazeResetAfterHit();}
  }
  function mazeMovePlayer(){const p=mini.mazePlayer;if(!p)return;if(mazeCanMove(p,p.nextDir))p.dir=p.nextDir;if(!mazeCanMove(p,p.dir))return;const next=mazeStepPoint(p,p.dir);p.r=next.r;p.c=next.c;mazeActorStyle(p.node,p.r,p.c);p.node.dataset.dir=p.dir;mazeCollect();mazeCollision();}
  function mazeMoveHunters(){for(const h of mini.mazeHunters){h.dir=mazeChooseHunterDir(h);if(mazeCanMove(h,h.dir)){const next=mazeStepPoint(h,h.dir);h.r=next.r;h.c=next.c;mazeActorStyle(h.node,h.r,h.c);}mazeCollision();}}
  function updateMazeGame(dt){if(!mini.mazePlayer)return;const t=now();if(mini.mazeHuntUntil&&t>=mini.mazeHuntUntil){mini.mazeHuntUntil=0;mini.mazeCombo=0;$(".maze-world")?.classList.remove("hunt");const combo=$("#mazeCombo"),callout=$("#mazeCallout");if(combo)combo.textContent="0";if(callout)callout.textContent="SHADOWS ARE HUNTING AGAIN";}
    mini.mazeMoveCarry+=dt;const playerStep=Math.max(.092,.132-(mini.mazeLevel-1)*.004),hunterStep=Math.max(.105,.168-(mini.mazeLevel-1)*.008);
    while(mini.mazeMoveCarry>=playerStep){mini.mazeMoveCarry-=playerStep;mazeMovePlayer();}
    if(t>=mini.mazeHunterWakeAt){mini.mazeHunterCarry+=dt;while(mini.mazeHunterCarry>=hunterStep){mini.mazeHunterCarry-=hunterStep;mazeMoveHunters();}}
  }


  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world maze-world"><div class="maze-hud" data-mini-readout><span id="mazeLives">♥ ♥ ♥</span><span>MAZE <b id="mazeLevel">1</b></span><span>CHAIN <b id="mazeCombo">0</b></span></div><div id="mazeBoard" class="maze-board"></div><div id="mazeCallout" class="maze-callout">EAT THE EMBER TRAIL</div><div class="maze-controls" aria-label="Runaway directions"><button type="button" data-maze-dir="up" aria-label="Move up">▲</button><button type="button" data-maze-dir="left" aria-label="Move left">◀</button><button type="button" data-maze-dir="down" aria-label="Move down">▼</button><button type="button" data-maze-dir="right" aria-label="Move right">▶</button></div></div>`;
      buildMazeLevel(true); renderLives("mazeLives");
  }

  globalThis.RizoTraining.register({
    id: "maze",
    name: "RIZO RUNAWAY",
    kicker: "MAZE-CHASE INSTINCT",
    art: "\u2317",
    button: "RUN",
    hint: "Swipe or use the arrows. Eat the Ember trail. Prism Seeds flip the hunt so Rizo can tag the Shadows.",
    duration: DURATION,
    energy: 10,
    lives: 3,
    // The score of a solid, competent run: every reward scales against it.
    par: 150,
    trains: { instinct: .58, speed: .42 },
    care: { bond: .6, mood: .7 },
    alignment: -0.5,
    sounds: { win: "win-chase", fail: "fail-chase" },
    signal: true,
    music: {tempo:132,lead:[62,65,69,65,62,68,65,62,60,63,67,63,60,66,63,60],bass:[38,38,45,45,43,43,50,50,36,36,43,43,41,41,48,48],wave:"square"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { mazeBestCombo: 0, mazeCombo: 0, mazeFavoriteDir: "", mazeGrid: [], mazeHuntUntil: 0, mazeHunterCarry: 0, mazeHunterTags: 0, mazeHunterWakeAt: 0, mazeHunters: [], mazeHunts: 0, mazeInputs: 0, mazeInvulnerableUntil: 0, mazeLevel: 1, mazeMoveCarry: 0, mazePellets: 0, mazePlayer: null, mazeTurnHistory: [], mazePointerStart: null });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { updateMazeGame(dt); },
    input(event) {
      const dir = event.target.closest("[data-maze-dir]")?.dataset.mazeDir;
      if (dir) { mazeSetDirection(dir); return; }
      mini.mazePointerStart = { x: event.clientX, y: event.clientY };
    },
    move(event) {
      if (!mini.mazePointerStart) return;
      const dx = event.clientX - mini.mazePointerStart.x, dy = event.clientY - mini.mazePointerStart.y;
      if (Math.hypot(dx, dy) < 22) return;
      mazeSetDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      mini.mazePointerStart = { x: event.clientX, y: event.clientY };
    },
    release() { mini.mazePointerStart = null; },
    key(event) {
      const dir = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" }[String(event.key).toLowerCase()];
      if (!dir) return false;
      event.preventDefault(); mazeSetDirection(dir); return true;
    },
    qualified: b => Boolean((b.mazeInputs || 0) >= 1 && b.score >= 5),
    result: b => ({ stats: [{ label: "MAZE REACHED", value: b.mazeLevel }, { label: "BEST HUNT CHAIN", value: b.mazeBestCombo }, { label: "SHADOW TAGS", value: b.mazeHunterTags }, { label: "PRISM HUNTS", value: b.mazeHunts }] }),
    qaSnapshot: (b, t) => ({ level: b?.mazeLevel || 0, lives: b?.mode === "maze" ? (b?.lives || 0) : 0, inputs: b?.mazeInputs || 0, pellets: b?.mazePellets || 0, combo: b?.mazeCombo || 0, bestCombo: b?.mazeBestCombo || 0, hunts: b?.mazeHunts || 0, tags: b?.mazeHunterTags || 0, hunting: Boolean((b?.mazeHuntUntil || 0) > t), player: b?.mazePlayer ? { r: b.mazePlayer.r, c: b.mazePlayer.c, dir: b.mazePlayer.dir, nextDir: b.mazePlayer.nextDir } : null, favoriteDir: b?.mazeFavoriteDir || null, hunters: (b?.mazeHunters || []).map(h => ({ r: h.r, c: h.c, kind: h.kind })) }),
    qaBuffs(b, t) { b.mazeHuntUntil = t + 5000; b.mazeInvulnerableUntil = t + 1500; },
    qaQualify(b) { b.mazeInputs = Math.max(1, b.mazeInputs || 0); b.score = Math.max(5, b.score || 0); },
    qa: () => ({
      arcadeMazeDirectionForQA: dir => { if (!mini?.active || mini.mode !== "maze") return null; mazeSetDirection(String(dir || "")); return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().maze; }
    })
  });
})();
