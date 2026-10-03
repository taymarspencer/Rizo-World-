/*
  EMBER FORGE — training game "breaker"
  Drag Rizo under the ember orb, read authored wall patterns and crack CORE blocks to collapse the structure.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingEmberForge() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 46;
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

  function setBreakerPaddle(ratio){mini.breakerX=clamp(Number(ratio)||.5,.08,.92);mini.breakerMoves=(mini.breakerMoves||0)+1;const pet=$("#miniPet");if(pet)pet.style.left=`${mini.breakerX*100}%`;}
  const BREAKER_PATTERNS=[
    {name:"BROKEN X",rows:["1.1.1.1",".11111.","..1C1..",".11111."]},
    {name:"FIRE TEETH",rows:["E1.1.1E",".21112.","11C.C11",".11111."]},
    {name:"BRIDGE MARK",rows:["..111..",".1P1P1.","11.C.11","1111111"]},
    {name:"KEEPER EYE",rows:[".11111.","11...11","1..C..1","11...11",".11111."]}
  ];
  function buildBreakerBoard(){const host=$("#breakerBlocks");if(!host)return;host.innerHTML="";mini.entities=mini.entities.filter(e=>e.kind!=="breaker-block");const pattern=BREAKER_PATTERNS[(mini.breakerLevel-1)%BREAKER_PATTERNS.length],cols=7,rows=pattern.rows.length,pad=7,arenaW=Math.max(280,el.miniArena.clientWidth),blockW=(arenaW-28-pad*(cols-1))/cols,blockH=28;mini.breakerPatternName=pattern.name;mini.breakerCores=0;for(let row=0;row<rows;row+=1){for(let col=0;col<cols;col+=1){const token=pattern.rows[row]?.[col]||".";if(token===".")continue;const special=token==="P"?"prism":token==="E"?"ember":token==="C"?"core":null,hp=token==="2"?2:(mini.breakerLevel>=4&&token==="1"&&((row+col+mini.breakerLevel)%5===0)?2:1),node=document.createElement("i");node.className=`breaker-block ${hp>1?"armored":""} ${special||""}`;node.style.left=`${14+col*(blockW+pad)}px`;node.style.top=`${54+row*(blockH+7)}px`;node.style.width=`${blockW}px`;node.style.height=`${blockH}px`;node.textContent=special==="prism"?"◆":special==="ember"?"✦":special==="core"?"×":"";host.appendChild(node);if(special==="core")mini.breakerCores+=1;mini.entities.push({kind:"breaker-block",node,row,col,x:14+col*(blockW+pad),y:54+row*(blockH+7),w:blockW,h:blockH,hp,special});}}const level=$("#breakerLevel"),cores=$("#breakerCoreCount"),name=$("#breakerPattern");if(level)level.textContent=String(mini.breakerLevel);if(cores)cores.textContent=String(mini.breakerCores);if(name)name.textContent=pattern.name;}
  function breakerCollapseCore(core){const neighbors=mini.entities.filter(item=>item.kind==="breaker-block"&&item.node?.isConnected&&item!==core&&item.special!=="core"&&Math.abs((item.row??0)-(core.row??0))+Math.abs((item.col??0)-(core.col??0))<=2).slice(0,5);for(const item of neighbors){item.node.classList.add("break","core-collapse");mini.score+=2;queueMiniTimeout(()=>item.node.remove(),150);mini.entities=mini.entities.filter(entry=>entry!==item);}mini.breakerCoresBroken+=1;mini.breakerCores=Math.max(0,mini.breakerCores-1);const cores=$("#breakerCoreCount");if(cores)cores.textContent=String(mini.breakerCores);sensoryBurst("CORE COLLAPSE","#ff5c6c",14);sfx("reward");haptic([10,14,20]);}
  function resetBreakerBall(first=false){const width=el.miniArena.clientWidth,height=el.miniArena.clientHeight,angle=(Math.random()*.7-.35);mini.breakerBall={x:width*mini.breakerX,y:height-128,vx:190*Math.sin(angle),vy:-245*Math.cos(angle),r:9,live:false};mini.breakerResetAt=now()+(first?900:720);const ball=$("#breakerBall");if(ball){ball.style.left=`${mini.breakerBall.x}px`;ball.style.top=`${mini.breakerBall.y}px`;}}
  function breakerLoseBall(){if(now()<mini.breakerResetAt)return;loseArcadeLife();mini.breakerStreak=0;renderLives("breakerHearts");const streak=$("#breakerStreak");if(streak)streak.textContent="0";arcadeSfx("fail");haptic([14,18,14]);if(mini.lives<=0){mini.endAt=Math.min(mini.endAt,now()+450);return;}resetBreakerBall();}
  function updateBreakerGame(dt){const b=mini.breakerBall;if(!b)return;const width=el.miniArena.clientWidth,height=el.miniArena.clientHeight,t=now();if(!b.live){b.x=width*mini.breakerX;b.y=height-128;if(t>=mini.breakerResetAt)b.live=true;}else{const speedBoost=1+Math.min(.22,(mini.breakerLevel-1)*.035);b.x+=b.vx*dt*speedBoost;b.y+=b.vy*dt*speedBoost;if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx);}if(b.x+b.r>width){b.x=width-b.r;b.vx=-Math.abs(b.vx);}if(b.y-b.r<38){b.y=38+b.r;b.vy=Math.abs(b.vy);}const paddleX=width*mini.breakerX,paddleY=height-108,paddleHalf=t<mini.breakerBoostUntil?66:48;if(b.vy>0&&b.y+b.r>=paddleY&&b.y-b.r<=paddleY+28&&Math.abs(b.x-paddleX)<=paddleHalf){const offset=clamp((b.x-paddleX)/paddleHalf,-1,1);b.y=paddleY-b.r;b.vy=-Math.max(235,Math.abs(b.vy));b.vx=clamp(b.vx+offset*125,-300,300);mini.breakerStreak+=1;mini.breakerBestStreak=Math.max(mini.breakerBestStreak,mini.breakerStreak);const streak=$("#breakerStreak");if(streak)streak.textContent=String(mini.breakerStreak);sfx("hit");haptic(5);}for(const block of [...mini.entities]){if(block.kind!=="breaker-block"||!block.node.isConnected)continue;if(b.x+b.r<block.x||b.x-b.r>block.x+block.w||b.y+b.r<block.y||b.y-b.r>block.y+block.h)continue;if(t-(block.lastHitAt||0)<70)continue;block.lastHitAt=t;block.hp-=1;if(t>=mini.breakerPierceUntil)b.vy*=-1;mini.score+=block.hp<=0?(block.special?8:2):1;if(block.hp<=0){mini.breakerBricks=(mini.breakerBricks||0)+1;block.node.classList.add("break");queueMiniTimeout(()=>block.node.remove(),130);mini.entities=mini.entities.filter(item=>item!==block);if(block.special==="prism"){mini.breakerBoostUntil=t+5200;$(".breaker-world")?.classList.add("boost");queueMiniTimeout(()=>{if(now()>=mini.breakerBoostUntil)$(".breaker-world")?.classList.remove("boost");},5200);sensoryBurst("PRISM PADDLE","#bdf7ff",10);sfx("reward");}else if(block.special==="ember"){mini.breakerPierceUntil=t+4200;$(".breaker-world")?.classList.add("fireball");queueMiniTimeout(()=>{if(now()>=mini.breakerPierceUntil)$(".breaker-world")?.classList.remove("fireball");},4200);sensoryBurst("EMBER BALL • PIERCE","#ff9b4e",10);sfx("reward");}else if(block.special==="core"){breakerCollapseCore(block);}else sfx("spark");}else{block.node.classList.remove("armored");block.node.classList.add("cracked");sfx("hit");}break;}if(b.y-b.r>height+20)breakerLoseBall();}const ball=$("#breakerBall");if(ball){ball.style.left=`${b.x}px`;ball.style.top=`${b.y}px`;}const blocks=mini.entities.filter(e=>e.kind==="breaker-block"&&e.node.isConnected);if(!blocks.length&&!mini.breakerBoardPending){mini.breakerBoardPending=true;mini.breakerLevel+=1;mini.score+=12+mini.breakerLevel*2;sensoryBurst(`WALL ${mini.breakerLevel}`,"#ffd54a",12);arcadeSfx("win");queueMiniTimeout(()=>{if(!mini.active||mini.mode!=="breaker")return;mini.breakerBoardPending=false;buildBreakerBoard();resetBreakerBall();},650);}}



  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world breaker-world"><div id="breakerBlocks" class="breaker-blocks"></div><div id="breakerBall" class="breaker-ball">✦</div>${miniPetMarkup("breaker-rizo")}<div class="breaker-hud" data-mini-readout><span id="breakerHearts">♥ ♥ ♥</span><span>FORGE <b id="breakerLevel">1</b></span><span>RALLY <b id="breakerStreak">0</b></span><span>CORE <b id="breakerCoreCount">0</b></span></div><div id="breakerPattern" class="breaker-pattern">LOADING MARK…</div><div id="breakerCallout" class="breaker-callout">BREAK THE CORE • COLLAPSE THE WALL</div></div>`;
      renderLives("breakerHearts"); setBreakerPaddle(.5); buildBreakerBoard(); resetBreakerBall(true);
  }

  globalThis.RizoTraining.register({
    id: "breaker",
    name: "EMBER FORGE",
    kicker: "FORGE THE MARK",
    art: "\u2726",
    button: "BREAK",
    hint: "Drag Rizo under the ember orb \u2014 the paddle tracks your thumb. Read authored wall patterns and crack CORE blocks to collapse nearby bricks.",
    duration: DURATION,
    energy: 11,
    lives: 3,
    // The score of a solid, competent run: every reward scales against it.
    par: 35,
    trains: { power: .62, instinct: .38 },
    care: { mood: .6, hunger: -4 },
    alignment: -0.25,
    sounds: { win: "win-forge", fail: "fail-forge" },
    quest: "train",
    signal: true,
    music: {tempo:186,lead:[52,52,59,null,55,55,62,null,53,53,60,null,57,64,60,55],bass:[28,28,null,35,31,31,null,38,29,29,null,36,33,33,40,null],wave:"square"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { breakerBall: null, breakerBestStreak: 0, breakerBoardPending: false, breakerBoostUntil: 0, breakerBricks: 0, breakerCores: 0, breakerCoresBroken: 0, breakerLevel: 1, breakerMoves: 0, breakerPatternName: "", breakerPierceUntil: 0, breakerResetAt: 0, breakerStreak: 0, breakerX: .5 });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { updateBreakerGame(dt); },
    input(event) {
      const rect = el.miniArena.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      if (Math.abs(ratio - mini.breakerX) > .22) setBreakerPaddle(ratio);
      mini.breakerGrab = { x: event.clientX, base: mini.breakerX, width: Math.max(1, rect.width) };
    },
    move(event) {
      if (event.buttons === 0 && event.pointerType === "mouse") return;
      const rect = el.miniArena.getBoundingClientRect(), grab = mini.breakerGrab;
      if (grab) setBreakerPaddle(grab.base + (event.clientX - grab.x) / (grab.width || Math.max(1, rect.width)));
      else setBreakerPaddle(clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1));
    },
    release() { mini.breakerGrab = null; },
    key(event) {
      const key = String(event.key);
      if (!(key === "ArrowLeft" || key === "ArrowRight" || key.toLowerCase() === "a" || key.toLowerCase() === "d")) return false;
      event.preventDefault(); mini.breakerGrab = null;
      setBreakerPaddle(mini.breakerX + ((key === "ArrowLeft" || key.toLowerCase() === "a") ? -.075 : .075)); return true;
    },
    qualified: b => Boolean((b.breakerMoves || 0) >= 1 && b.score >= 3),
    result: b => ({ stats: [{ label: "FORGE REACHED", value: b.breakerLevel }, { label: "BRICKS BROKEN", value: b.breakerBricks }, { label: "CORES BROKEN", value: b.breakerCoresBroken }, { label: "BEST RALLY", value: b.breakerBestStreak }] }),
    qaSnapshot: (b, t) => ({ level: b?.breakerLevel || 0, hearts: b?.mode === "breaker" ? (b?.lives || 0) : 0, streak: b?.breakerStreak || 0, moves: b?.breakerMoves || 0, piercing: Boolean((b?.breakerPierceUntil || 0) > t), cores: b?.breakerCores || 0, coresBroken: b?.breakerCoresBroken || 0, pattern: b?.breakerPatternName || "" }),
    qaBuffs(b, t) { b.breakerBoostUntil = t + 5200; b.breakerPierceUntil = t + 4200; },
    qaQualify(b) { b.breakerMoves = Math.max(1, b.breakerMoves || 0); b.score = Math.max(3, b.score || 0); },
    qa: () => ({
      arcadeBreakerCollapseCoreForQA: () => {
        if (!mini?.active || mini.mode !== "breaker") return null;
        const core = mini.entities.find(item => item.kind === "breaker-block" && item.special === "core" && item.node?.isConnected);
        if (core) { core.node.remove(); mini.entities = mini.entities.filter(item => item !== core); breakerCollapseCore(core); }
        return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().breaker;
      },
      arcadeClearBreakerBoardForQA: () => {
        if (!mini?.active || mini.mode !== "breaker") return false;
        for (const item of mini.entities.filter(e => e.kind === "breaker-block")) item.node?.remove?.();
        mini.entities = mini.entities.filter(e => e.kind !== "breaker-block");
        return true;
      }
    })
  });
})();
