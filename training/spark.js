/*
  SPARK STASH — training game "spark"
  Catch clean signals into an unbanked stash and bank it before a miss, a Shadow signal or the buzzer takes it.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingSparkStash() {
  "use strict";
  const { $, $$, clamp, escapeHTML } = globalThis.RizoTrainingKit;
  const DURATION = 24;
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

  function moveSparkTarget(forceType = null) {
    const target = $("#miniTarget");
    if (!target) return;
    const rect = el.miniArena.getBoundingClientRect(), size = 64, t=now(), frenzy=t<mini.sparkFeverUntil;
    const x = 14 + Math.random() * Math.max(1, rect.width - size - 28);
    const y = 36 + Math.random() * Math.max(1, rect.height - size - 170);
    const roll = Math.random();
    mini.sparkType = forceType || (frenzy ? (roll>.68?"gold":"normal") : (mini.hits > 3 && roll < .16 ? "shadow" : roll > .88 ? "gold" : "normal"));
    target.className = `spark-orb ${mini.sparkType}`;
    target.textContent = mini.sparkType === "shadow" ? "✕" : mini.sparkType === "gold" ? "◆" : "★";
    target.setAttribute("aria-label", mini.sparkType === "shadow" ? "Decoy spark - do not tap" : mini.sparkType === "gold" ? "Golden spark" : "Catch spark");
    target.style.left = `${x}px`; target.style.top = `${y}px`;
    mini.sparkX = x; mini.sparkY = y;
    mini.sparkExpiresAt = t + (frenzy ? (mini.sparkType === "gold" ? 560 : 470) : mini.sparkType === "shadow" ? 720 : mini.sparkType === "gold" ? 900 : Math.max(620, 1040 - mini.hits * 9));
    const rule=$("#sparkRule"); if(rule) rule.textContent=frenzy ? "SPARK RUSH • DON'T MISS" : mini.sparkType === "shadow" ? "DECOY • DON'T TAP" : mini.sparkType === "gold" ? "GOLD SIGNAL • GO" : "CATCH THE LIGHT";
  }

  function sparkRiskMultiplier(){ return Math.min(4, 1 + Math.floor(Math.max(0,mini.sparkStreak||0) / 5)); }
  function sparkBankMultiplier(){ return Math.min(3, 1 + Math.floor(Math.max(0,mini.sparkStreak||0) / 4)); }
  function updateSparkBankHUD(){
    const stash=$("#sparkStash"),banked=$("#sparkBanked"),bank=$("#sparkBank"),streak=$("#sparkStreak"),risk=$("#sparkRisk"),payout=$("#sparkPayout");
    const held=Math.max(0,Math.floor(mini.sparkStash||0)),chain=Math.max(0,mini.sparkStreak||0),bankMult=sparkBankMultiplier();
    if(stash)stash.textContent=String(held);
    if(banked)banked.textContent=String(Math.max(0,Math.floor(mini.sparkBanked||0)));
    if(streak)streak.textContent=String(chain);
    if(risk){
      risk.textContent=`x${sparkRiskMultiplier()}`;
      risk.classList.toggle("hot",chain>=10);
      risk.classList.toggle("warm",chain>=5&&chain<10);
    }
    if(payout)payout.textContent=held?`BANK +${held*bankMult}`:"NOTHING TO BANK";
    const hud=$(".spark-hud");
    if(hud)hud.classList.toggle("at-risk",held>=6);
    if(bank){
      bank.disabled=held<=0;
      bank.dataset.mult=String(bankMult);
      const label=bank.querySelector("b");
      if(label)label.textContent=bankMult>1?`BANK x${bankMult}`:"BANK STASH";
    }
    // Six clean reads in a row arms Spark Rush. Show the fuse, not just the fire.
    const rule=$("#sparkRule");
    if(rule&&held>0&&mini.endAt-now()<=5000){rule.textContent="BANK BEFORE THE BUZZER";}
    else if(rule&&now()>=(mini.sparkFeverUntil||0)){
      const toRush=chain?6-(chain%6):6;
      rule.textContent=chain>=1?`RUSH IN ${toRush===6?6:toRush} • RISK x${sparkRiskMultiplier()}`:"CATCH • THEN DECIDE WHEN TO BANK";
    }
  }

  function bankSparkStash(auto=false){const held=Math.max(0,Math.floor(mini.sparkStash||0));if(!held)return false;const mult=auto?1:sparkBankMultiplier();const gain=held*mult;mini.score+=gain;mini.sparkBanked+=gain;mini.sparkStash=0;mini.sparkBanks+=1;if(auto)mini.sparkAutoBanked=true;const trail=$("#sparkTrail");if(trail){trail.textContent=`${auto?"AUTO ":""}BANK x${mult} • +${gain}`;trail.classList.remove("pop");void trail.offsetWidth;trail.classList.add("pop");}updateSparkBankHUD();sfx("reward");haptic([8,12,8]);return true;}
  function spillSparkStash(reason="SIGNAL LOST"){const lost=Math.max(0,Math.floor(mini.sparkStash||0));if(lost){mini.sparkLost+=lost;mini.sparkStash=0;}mini.sparkStreak=0;updateSparkBankHUD();const trail=$("#sparkTrail");if(trail){trail.textContent=`${reason}${lost?` • -${lost} STASH`:""}`;trail.classList.remove("pop");void trail.offsetWidth;trail.classList.add("pop");}}

  function startSparkFrenzy(){
    mini.sparkFeverUntil=now()+2700;mini.sparkFrenzies+=1;$(".spark-world")?.classList.add("frenzy");
    const trail=$("#sparkTrail");if(trail){trail.textContent="SPARK RUSH • x2";trail.classList.remove("pop");void trail.offsetWidth;trail.classList.add("pop");}
    sensoryBurst("SPARK RUSH","#ffd54a",12);sfx("reward");haptic([8,8,12]);
  }

  function updateSparkGame() {
    const t=now();
    if(mini.sparkFeverUntil && t>=mini.sparkFeverUntil){mini.sparkFeverUntil=0;$(".spark-world")?.classList.remove("frenzy");const rule=$("#sparkRule");if(rule)rule.textContent="CATCH THE LIGHT";}
    if (!mini.sparkExpiresAt || t < mini.sparkExpiresAt) return;
    if (mini.sparkType === "shadow") {
      mini.sparkAvoided += 1; mini.sparkStreak += 1; mini.sparkBestStreak = Math.max(mini.sparkBestStreak, mini.sparkStreak); mini.sparkStash += 1;updateSparkBankHUD();
      const trail=$("#sparkTrail"); if(trail){trail.textContent="GOOD READ +1";trail.classList.remove("pop");void trail.offsetWidth;trail.classList.add("pop");}
      sfx("perfect");
    } else {
      spillSparkStash("TOO SLOW");arcadeSfx("fail");if(mini.sparkFeverUntil){mini.sparkFeverUntil=0;$(".spark-world")?.classList.remove("frenzy");}
    }
    updateSparkBankHUD();
    moveSparkTarget();
  }

  function catchSpark() {
    const pet = $("#miniPet"), target = $("#miniTarget"), trail = $("#sparkTrail");
    if (!target || !pet) return;
    if (mini.sparkType === "shadow") {
      mini.score = Math.max(0, mini.score - 2); spillSparkStash("SHADOW STOLE IT");
      if (trail) { trail.textContent = mini.sparkLost ? "SHADOW STOLE THE STASH" : "DECOY -2"; trail.classList.remove("pop"); void trail.offsetWidth; trail.classList.add("pop"); }
      pet.classList.add("forage-hit"); queueMiniTimeout(()=>pet.classList.remove("forage-hit"),300); arcadeSfx("fail"); haptic([16,20,16]);
      updateSparkBankHUD(); moveSparkTarget(); return;
    }
    const wasFrenzy=now()<mini.sparkFeverUntil;mini.hits += 1; mini.sparkStreak += 1; mini.sparkBestStreak = Math.max(mini.sparkBestStreak, mini.sparkStreak);
    const mult = sparkRiskMultiplier();
    const gain = (mini.sparkType === "gold" ? 5 : 1) * (wasFrenzy?2:1); mini.sparkStash += gain;updateSparkBankHUD();
    pet.style.left = `${mini.sparkX + 6}px`; pet.style.top = `${mini.sparkY + 28}px`; pet.classList.add("spark-dash"); queueMiniTimeout(()=>pet.classList.remove("spark-dash"),180);
    if (trail) { trail.textContent = mini.sparkType === "gold" ? `GOLD${wasFrenzy?" RUSH":""} • STASH +${gain}` : wasFrenzy?`RUSH ${mini.sparkStreak} • STASH +${gain}`:mini.sparkStreak > 1 ? `CHAIN ${mini.sparkStreak} • RISK x${mult}` : "STASH +1"; trail.classList.remove("pop"); void trail.offsetWidth; trail.classList.add("pop"); }
    updateSparkBankHUD();
    if(!wasFrenzy && mini.sparkStreak>0 && mini.sparkStreak%6===0)startSparkFrenzy();
    sfx(mini.sparkType === "gold" ? "reward" : "spark", mini.hits); haptic(mini.sparkType === "gold" ? [8,10,14] : 8); moveSparkTarget();
  }


  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world spark-world spark-dx"><div class="spark-sky"></div>${miniPetMarkup("spark-rizo")}<button id="miniTarget" class="spark-orb" type="button" aria-label="Catch spark">★</button><div class="spark-trail" id="sparkTrail"></div><div class="spark-hud" data-mini-readout><span>STASH <b id="sparkStash">0</b></span><span class="spark-chain">CHAIN <b id="sparkStreak">0</b><em id="sparkRisk">x1</em></span><span>BANKED <b id="sparkBanked">0</b></span></div><button class="spark-bank" id="sparkBank" type="button" data-spark-bank><b>BANK STASH</b><small id="sparkPayout">NOTHING TO BANK</small></button><div id="sparkRule" class="spark-rule">CATCH • THEN DECIDE WHEN TO BANK</div></div>`;
      el.miniTarget = $("#miniTarget");
      moveSparkTarget();
  }

  globalThis.RizoTraining.register({
    id: "spark",
    name: "SPARK STASH",
    kicker: "DON'T GET GREEDY",
    art: "\u2605",
    button: "CHASE",
    hint: "Catch clean signals to build an unbanked stash. BANK it before a miss, a Shadow signal, or the buzzer wipes the risky part.",
    duration: DURATION,
    energy: 10,
    lives: 0,
    // The score of a solid, competent run: every reward scales against it.
    par: 220,
    trains: { instinct: 1 },
    care: { bond: 1, mood: .8 },
    alignment: 1,
    sounds: { win: "reward", fail: "fail-spark" },
    music: {tempo:230,lead:[76,79,83,86,83,79,81,84],bass:[48,null,55,null,50,null,57,null],wave:"triangle"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { sparkAutoBanked: false, sparkAvoided: 0, sparkBanked: 0, sparkBanks: 0, sparkBestStreak: 0, sparkExpiresAt: 0, sparkFeverUntil: 0, sparkFrenzies: 0, sparkLost: 0, sparkStash: 0, sparkStreak: 0, sparkType: "normal" });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame() {
      updateSparkGame();
      // Five seconds out, the HUD warns that an unbanked stash will not survive the buzzer.
      if (!mini.sparkBuzzerShown && mini.endAt - now() <= 5000) { mini.sparkBuzzerShown = true; updateSparkBankHUD(); }
    },
    input(event) {
      if (event.target.closest("[data-spark-bank]")) { bankSparkStash(false); return; }
      if (event.target.closest(".spark-orb")) catchSpark();
    },
    key(event) {
      if (String(event.key).toLowerCase() !== "b") return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; bankSparkStash(false); return true;
    },
    // Ending the run yourself banks what you hold, at x1. The buzzer does not:
    // a stash still unbanked at time-up is lost, which is the whole bet.
    settle(reason) {
      if (!(mini.sparkStash > 0)) return;
      if (reason === "quit") bankSparkStash(true);
      else spillSparkStash("BUZZER");
    },
    qualified: b => Boolean(b.hits >= 2 && ((b.sparkBanked || 0) > 0 || (b.sparkStash || 0) >= 2)),
    result: b => ({ stats: [{ label: "BANKS", value: b.sparkBanks }, { label: "BEST CHAIN", value: b.sparkBestStreak }, { label: "STASH LOST", value: b.sparkLost }, { label: "SPARK RUSHES", value: b.sparkFrenzies }] }),
    qaSnapshot: (b, t) => ({ type: b?.sparkType || null, streak: b?.sparkStreak || 0, best: b?.sparkBestStreak || 0, avoided: b?.sparkAvoided || 0, frenzy: Boolean((b?.sparkFeverUntil || 0) > t), frenzies: b?.sparkFrenzies || 0, stash: b?.sparkStash || 0, banked: b?.sparkBanked || 0, banks: b?.sparkBanks || 0, lost: b?.sparkLost || 0 }),
    qaBuffs(b, t) { b.sparkFeverUntil = t + 2700; },
    qaQualify(b) { b.hits = Math.max(2, b.hits || 0); b.sparkBanked = Math.max(2, b.sparkBanked || 0); b.score = Math.max(2, b.score || 0); },
    qa: () => ({
      arcadeSparkCatchForQA: (type = "normal", streak = null) => {
        if (!mini?.active || mini.mode !== "spark") return null;
        if (streak !== null) mini.sparkStreak = Math.max(0, Math.floor(Number(streak) || 0));
        moveSparkTarget(String(type || "normal")); catchSpark();
        return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().spark;
      },
      arcadeSparkBankForQA: () => { if (!mini?.active || mini.mode !== "spark") return null; bankSparkStash(false); return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().spark; }
    })
  });
})();
