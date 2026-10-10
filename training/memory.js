/*
  LOST SIGNAL — training game "memory"
  Memorize the corrupted broadcast, then play it back under the current rule: reverse, opposite, rotate.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingLostSignal() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 44;
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

  function lightMemoryRune(index,on=true) { const rune=$(`[data-memory-rune="${index}"]`); if(rune)rune.classList.toggle("lit",on); }
  function memoryExpectedSequence(){let base=[...mini.memorySequence];if(mini.memoryMode.includes("reverse"))base.reverse();if(mini.memoryMode.includes("opposite"))base=base.map(value=>3-value);if(mini.memoryMode.includes("rotate")){const shift=mini.memoryShift||1;base=base.map(value=>(value+shift)%4);}return base;}
  function memoryRuleLabel(){return {forward:"CLEAN SIGNAL",reverse:"PLAY BACKWARD",opposite:"PLAY OPPOSITES","reverse-opposite":"BACKWARD + OPPOSITE",rotate:`ROTATE +${mini.memoryShift||1}`,"reverse-rotate":`BACKWARD + ROTATE`}[mini.memoryMode]||String(mini.memoryMode||"SIGNAL").toUpperCase();}
  function updateMemoryHUD(){const rule=$("#memoryRule");if(rule)rule.textContent=memoryRuleLabel();renderLives("memoryHearts");}

  function startMemoryRound() {
    if(!mini.active||mini.mode!=="memory")return;
    mini.memoryRound+=1;mini.memoryBestRound=Math.max(mini.memoryBestRound,mini.memoryRound);mini.memoryInput=0;mini.memoryShowing=true;mini.memoryShift=1+(mini.memoryRound%3);mini.memoryRuleDepth=mini.memoryRound>=7?2:1;
    if(mini.memoryRound>=9&&mini.memoryRound%3===0)mini.memoryMode="reverse-rotate";else if(mini.memoryRound>=7&&mini.memoryRound%2===1)mini.memoryMode="reverse-opposite";else if(mini.memoryRound>=5&&mini.memoryRound%5===0)mini.memoryMode="rotate";else if(mini.memoryRound>=4&&mini.memoryRound%4===0)mini.memoryMode="opposite";else if(mini.memoryRound>=3&&mini.memoryRound%3===0)mini.memoryMode="reverse";else mini.memoryMode="forward";
    mini.memorySequence.push(Math.floor(Math.random()*4));updateMemoryHUD();
    const callout=$("#memoryCallout"),speed=Math.max(250,520-mini.memoryRound*24);if(callout)callout.textContent=`ROUND ${mini.memoryRound} • LISTEN • ${memoryRuleLabel()}`;
    mini.memorySequence.forEach((value,index)=>{queueMiniTimeout(()=>{lightMemoryRune(value,true);sfx("spark",index);},index*speed);queueMiniTimeout(()=>lightMemoryRune(value,false),index*speed+Math.min(270,speed*.58));});
    queueMiniTimeout(()=>{mini.memoryShowing=false;if(callout)callout.textContent=`YOUR TURN • ${memoryRuleLabel()}`;},mini.memorySequence.length*speed+140);
  }

  function memoryTap(index) {
    if(!mini.active||mini.mode!=="memory"||mini.memoryShowing)return;
    lightMemoryRune(index,true);queueMiniTimeout(()=>lightMemoryRune(index,false),180);const expectedSequence=memoryExpectedSequence(),expected=expectedSequence[mini.memoryInput];
    if(index===expected){mini.memoryInput+=1;mini.score+=1;sfx("spark",mini.memoryInput);haptic(6);$("#miniPet")?.classList.add("memory-nod");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("memory-nod"),180);if(mini.memoryInput>=expectedSequence.length){mini.hits+=1;const clearBonus=memoryClearBonus();mini.score+=clearBonus;mini.memoryShowing=true;const callout=$("#memoryCallout");if(callout)callout.textContent=`${memoryRuleLabel()} CLEAN • +${clearBonus}`;arcadeSfx("win");queueMiniTimeout(startMemoryRound,720);}}
    else {mini.score=Math.max(0,mini.score-3);loseArcadeLife();mini.memoryShowing=true;updateMemoryHUD();const callout=$("#memoryCallout");if(callout)callout.textContent=mini.lives>0?"WRONG RUNE • STUDY IT AGAIN":"MEMORY OVERLOADED";$("#miniPet")?.classList.add("memory-confused");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("memory-confused"),420);arcadeSfx("fail");haptic([15,20,15]);if(mini.lives<=0){mini.endAt=Math.min(mini.endAt,now()+450);return;}queueMiniTimeout(()=>{mini.memoryInput=0;mini.memoryShowing=true;const speed=Math.max(250,430-mini.memoryRound*16);mini.memorySequence.forEach((value,i)=>{queueMiniTimeout(()=>lightMemoryRune(value,true),i*speed);queueMiniTimeout(()=>lightMemoryRune(value,false),i*speed+220);});queueMiniTimeout(()=>{mini.memoryShowing=false;if(callout)callout.textContent=`TRY • ${memoryRuleLabel()}`;},mini.memorySequence.length*speed+100);},520);}
  }


  // Round clear bonus: 3 for a clean signal, 5 for one twist, 8 when two stack.
  function memoryClearBonus() { return mini.memoryRuleDepth > 1 ? 8 : mini.memoryMode === "forward" ? 3 : 5; }

  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world memory-world memory-dx lost-signal"><div class="memory-stars"></div>${miniPetMarkup("memory-rizo")}<div class="memory-top" data-mini-readout><span id="memoryRule">CLEAN SIGNAL</span><span id="memoryHearts">♥ ♥ ♥</span></div><div class="memory-frequency">96.3 <i>RIZO PIRATE RADIO</i></div><div class="memory-board" id="memoryBoard">${[0,1,2,3].map(index=>`<button type="button" class="memory-rune rune-${index}" data-memory-rune="${index}" aria-label="Signal rune ${index+1}">${["☾","✦","◆","∞"][index]}</button>`).join("")}</div><div id="memoryCallout" class="memory-callout">LISTEN FOR THE CORRUPTION</div></div>`;
      renderLives("memoryHearts"); queueMiniTimeout(startMemoryRound, 500);
  }

  globalThis.RizoTraining.register({
    id: "memory",
    name: "LOST SIGNAL",
    kicker: "CORRUPTED BROADCAST",
    art: "\u25a6",
    button: "REMEMBER",
    hint: "Memorize the transmission, then obey the corruption rule. Later rounds stack reverse, opposite, and rotation logic.",
    duration: DURATION,
    energy: 7,
    lives: 3,
    // The score of a solid, competent run: every reward scales against it.
    par: 50,
    trains: { instinct: .72, luck: .28 },
    care: { bond: .8, mood: .6 },
    alignment: 2,
    sounds: { win: "win-signal", fail: "fail-signal" },
    music: {tempo:520,lead:[60,null,64,null,67,71,null,67],bass:[36,null,null,43,null,null,40,null],wave:"sine"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { memoryBestRound: 0, memoryInput: 0, memoryMode: "forward", memoryRound: 0, memoryRuleDepth: 1, memorySequence: [], memoryShift: 0, memoryShowing: false });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    input(event) { const rune = event.target.closest("[data-memory-rune]"); if (rune) memoryTap(Number(rune.dataset.memoryRune)); },
    key(event) {
      const rune = { "1": 0, "2": 1, "3": 2, "4": 3, d: 0, f: 1, j: 2, k: 3 }[String(event.key).toLowerCase()];
      if (rune === undefined) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; memoryTap(rune); return true;
    },
    qualified: b => Boolean(b.hits >= 1),
    result: b => ({ stats: [{ label: "ROUND REACHED", value: b.memoryRound }, { label: "SIGNALS CLEAN", value: b.hits }, { label: "HEARTS LEFT", value: `${Math.max(0, b.lives || 0)}/${Math.max(1, b.maxLives || 3)}` }, { label: "FINAL RULE", value: memoryRuleLabel() || "CLEAN SIGNAL" }] }),
    qaSnapshot: b => ({ round: b?.memoryRound || 0, mode: b?.memoryMode || null, lives: b?.mode === "memory" ? (b?.lives || 0) : 0, sequence: [...(b?.memorySequence || [])], expected: b?.mode === "memory" && mini === b ? memoryExpectedSequence() : [] }),
    qaQualify(b) { b.hits = Math.max(1, b.hits || 0); b.score = Math.max(1, b.score || 0); },
    qa: () => ({
      arcadeMemoryRoundForQA: round => {
        if (!mini?.active || mini.mode !== "memory") return null;
        run.clearJobs(); mini.memoryRound = Math.max(0, Math.floor(Number(round) || 1) - 1); mini.memorySequence = []; startMemoryRound();
        return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().memory;
      }
    })
  });
})();
