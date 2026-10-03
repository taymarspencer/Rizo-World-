/*
  POWER TAPE — training game "power"
  Coach calls JAB, BODY or HOOK; hit the called strike in the moving window and hold through feints.
  Runs under the training contract (core/rizo-training.js): it reads a frozen
  pet snapshot, plays on run.state with the run clock and run jobs, and reports
  a result. The hub turns that result into growth; this file never touches the
  save, the wallet or a pet.
*/
(function registerTrainingPowerTape() {
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

  function updatePowerZoneVisual() {
    const zone = $("#timingPerfectZone");
    if (zone) zone.style.left = `${mini.powerZone * 100}%`;
  }

  const POWER_CALLS=["jab","body","hook"];
  function nextPowerCall(force=false){
    const previous=mini.powerCall;let next=previous;
    while(next===previous&&POWER_CALLS.length>1)next=POWER_CALLS[Math.floor(Math.random()*POWER_CALLS.length)];
    mini.powerCall=next;mini.powerCallAt=now()+1900+Math.random()*900;
    const call=$("#powerCall");if(call)call.textContent=next.toUpperCase();
    $$("[data-power-tech]").forEach(btn=>btn.classList.toggle("called",btn.dataset.powerTech===next));
    if(force){const label=$("#timingCallout");if(label)label.textContent=`COACH: ${next.toUpperCase()}`;}
  }

  function updatePowerGame(dt) {
    const t=now(), bag=$("#trainingBag"), callout=$("#timingCallout");
    if(!mini.powerCallAt)nextPowerCall(true);
    if(t>=mini.powerCallAt&&!mini.powerGuardUntil)nextPowerCall();
    if(!mini.powerGuardAt)mini.powerGuardAt=t+3400+Math.random()*1800;
    if(!mini.powerGuardUntil && t>=mini.powerGuardAt){mini.powerGuardUntil=t+620;mini.powerGuardAt=t+3500+Math.random()*2200;bag?.classList.add("guard");if(callout){callout.textContent="BAG FEINT • HOLD";callout.dataset.grade="guard";}sfx("no");}
    if(mini.powerGuardUntil && t>=mini.powerGuardUntil){mini.powerGuardUntil=0;bag?.classList.remove("guard");if(mini.powerEngaged){mini.powerGuardReads+=1;mini.powerHeat=clamp(mini.powerHeat+8,0,100);mini.score+=2;if(callout){callout.textContent="GOOD READ +2";callout.dataset.grade="read";}const heat=$("#powerHeat");if(heat)heat.textContent=`${Math.round(mini.powerHeat)}%`;}else if(callout){callout.textContent="MAKE A READ • THEN FEINTS COUNT";callout.dataset.grade="idle";}}
    mini.powerZone += (mini.powerZoneTarget - mini.powerZone) * Math.min(1, dt * 5.5);
    mini.needle += mini.needleDir * mini.needleSpeed * dt;
    if (mini.needle >= 1) { mini.needle = 1; mini.needleDir = -1; }
    if (mini.needle <= 0) { mini.needle = 0; mini.needleDir = 1; }
    const needle = $("#timingNeedle");
    if (needle) needle.style.left = `${mini.needle * 100}%`;
    updatePowerZoneVisual();
  }

  function powerTap(technique=mini.powerCall) {
    const t=now();
    if(t<(mini.powerTapLockUntil||0))return;
    mini.powerTapLockUntil=t+175;
    mini.powerEngaged=true;
    if(mini.powerGuardUntil>t){
      mini.powerGuardUntil=0;mini.powerStreak=0;mini.powerHeat=clamp(mini.powerHeat-22,0,100);mini.score=Math.max(0,mini.score-3);$("#trainingBag")?.classList.remove("guard");const callout=$("#timingCallout");if(callout){callout.textContent="COUNTERED -3";callout.dataset.grade="0";}const streak=$("#powerStreak"),heat=$("#powerHeat");if(streak)streak.textContent="0";if(heat)heat.textContent=`${Math.round(mini.powerHeat)}%`;$("#miniPet")?.classList.add("forage-hit");queueMiniTimeout(()=>$("#miniPet")?.classList.remove("forage-hit"),280);sfx("hit");haptic([18,24,18]);return;
    }
    if(technique!==mini.powerCall){
      mini.powerWrongCalls+=1;mini.powerStreak=0;mini.powerHeat=clamp(mini.powerHeat-12,0,100);mini.score=Math.max(0,mini.score-2);
      const callout=$("#timingCallout");if(callout){callout.textContent=`WRONG SHOT • COACH SAID ${mini.powerCall.toUpperCase()}`;callout.dataset.grade="wrong";}
      const streak=$("#powerStreak"),heat=$("#powerHeat");if(streak)streak.textContent="0";if(heat)heat.textContent=`${Math.round(mini.powerHeat)}%`;
      arcadeSfx("fail");haptic([12,18,12]);nextPowerCall();return;
    }
    mini.powerCallsRead+=1;
    const distance = Math.abs(mini.needle - mini.powerZone);
    const base = distance <= .05 ? 5 : distance <= .12 ? 3 : distance <= .22 ? 1 : 0;
    if (base >= 3) mini.powerStreak += 1; else if (!base) mini.powerStreak = 0; else mini.powerStreak = Math.max(0, mini.powerStreak - 1);
    mini.powerBestStreak = Math.max(mini.powerBestStreak, mini.powerStreak);
    const mult = Math.min(3, 1 + Math.floor(mini.powerStreak / 4));
    const points = base * mult;
    mini.score += points; if(base) mini.hits += 1;
    mini.powerHeat = clamp(mini.powerHeat + (base === 5 ? 18 : base === 3 ? 9 : base ? 3 : -14), 0, 100);
    mini.needleSpeed = Math.min(1.52, mini.needleSpeed + (base >= 3 ? .025 : .012));
    if (base === 5 || (base && mini.hits % 4 === 0)) {
      const edge = .18 + Math.random() * .64;
      mini.powerZoneTarget = edge;
    }
    if(base>=3)nextPowerCall();
    if (mini.powerHeat >= 100) {
      mini.powerHeat = 35;
      mini.score += 10;
      mini.powerZoneTarget = .5;
      sensoryBurst("OVERDRIVE +10", "#ffd54a", 18); sfx("reward"); haptic([14,18,26]);
    }
    const label = base === 5 ? `PERFECT x${mult} +${points}` : base === 3 ? `GREAT x${mult} +${points}` : base === 1 ? `GLANCE +${points}` : "WHIFF • STREAK LOST";
    const pet = $("#miniPet"), bag = $("#trainingBag"), callout = $("#timingCallout");
    pet?.classList.remove("mini-punch"); bag?.classList.remove("bag-hit"); void pet?.offsetWidth; pet?.classList.add("mini-punch");
    if (base) bag?.classList.add("bag-hit");
    if (callout) { callout.textContent = label; callout.dataset.grade = String(base); }
    const streak = $("#powerStreak"), heat = $("#powerHeat"), cracks = $("#bagCracks");
    if (streak) streak.textContent = String(mini.powerStreak);
    if (heat) heat.textContent = `${Math.round(mini.powerHeat)}%`;
    if (cracks) cracks.dataset.crack = String(Math.min(4, Math.floor(mini.hits / 6)));
    if (base === 5) { sfx("perfect"); sensoryBurst(mini.powerStreak >= 4 ? `x${mult}` : "PERFECT", "#16c8ff", 10); haptic([12,20,22]); }
    else if (base) sfx("hit", base * 3); else { arcadeSfx("fail"); haptic(18); }
  }


  function renderScene() {
      el.miniArena.innerHTML = `<div class="mini-world power-world power-dx">
        <div class="training-floor"></div>${miniPetMarkup("power-rizo")}
        <div id="trainingBag" class="training-bag"><i></i><b class="face-mark-stage"><img src="./assets/rizo-full-mark.png" alt=""></b><span id="bagCracks" class="bag-cracks"></span></div>
        <div class="power-hud" data-mini-readout><span>STREAK <b id="powerStreak">0</b></span><span>OVERDRIVE <b id="powerHeat">0%</b></span></div>
        <div class="power-coach"><small>COACH CALL</small><b id="powerCall">JAB</b></div>
        <div class="power-techniques" aria-label="Strike type"><button type="button" data-power-tech="jab">JAB</button><button type="button" data-power-tech="body">BODY</button><button type="button" data-power-tech="hook">HOOK</button></div>
        <div class="timing-console"><div class="timing-track"><i id="timingPerfectZone" class="timing-perfect"></i><b id="timingNeedle"></b></div><strong id="timingCallout">READ THE CALL</strong></div>
      </div>`;
      updatePowerZoneVisual();
  }

  globalThis.RizoTraining.register({
    id: "power",
    name: "POWER TAPE",
    kicker: "COACH TAPE 03",
    art: "\ud83e\udd4a",
    button: "PUNCH",
    hint: "The coach calls JAB, BODY, or HOOK. Hit the right strike on the moving window\u2014and do nothing when the bag feints.",
    duration: DURATION,
    energy: 15,
    lives: 0,
    // The score of a solid, competent run: every reward scales against it.
    par: 100,
    trains: { power: 1 },
    care: { mood: .2, hunger: -6 },
    alignment: -0.5,
    sounds: { win: "perfect", fail: "fail-power" },
    quest: "train",
    music: {tempo:205,lead:[52,55,59,64,59,55,62,59],bass:[28,null,35,null,31,null,38,null],wave:"square"},
    start(snapshot, services) {
      run = services; mini = services.state; el = { miniArena: services.arena }; pet = snapshot;
      Object.assign(mini, { needle: .06, needleDir: 1, needleSpeed: .72, powerBestStreak: 0, powerCall: "jab", powerCallAt: 0, powerCallsRead: 0, powerEngaged: false, powerGuardAt: 0, powerGuardReads: 0, powerGuardUntil: 0, powerHeat: 0, powerStreak: 0, powerTapLockUntil: 0, powerWrongCalls: 0, powerZone: .5, powerZoneTarget: .5 });
      renderScene();
    },
    stop() {
      run = null; mini = null; el = null; pet = null;
    },
    frame(dt) { updatePowerGame(dt); },
    input(event) { const tech = event.target.closest("[data-power-tech]")?.dataset.powerTech; if (tech) powerTap(tech); },
    key(event) {
      const tech = { "1": "jab", "2": "body", "3": "hook", j: "jab", k: "body", l: "hook" }[String(event.key).toLowerCase()];
      if (!tech) return false;
      event.preventDefault(); mini.playerInputs = (mini.playerInputs || 0) + 1; powerTap(tech); return true;
    },
    qualified: b => Boolean(b.powerEngaged && b.hits >= 2 && b.score >= 2),
    result: b => ({ stats: [{ label: "BEST STREAK", value: b.powerBestStreak }, { label: "COACH CALLS", value: b.powerCallsRead }, { label: "FEINTS READ", value: b.powerGuardReads }, { label: "WRONG SHOTS", value: b.powerWrongCalls }] }),
    qaSnapshot: (b, t) => ({ streak: b?.powerStreak || 0, best: b?.powerBestStreak || 0, heat: b?.powerHeat || 0, guard: Boolean((b?.powerGuardUntil || 0) > t), reads: b?.powerGuardReads || 0, call: b?.powerCall || null, callsRead: b?.powerCallsRead || 0, wrongCalls: b?.powerWrongCalls || 0 }),
    qaQualify(b) { b.powerEngaged = true; b.hits = Math.max(2, b.hits || 0); b.score = Math.max(2, b.score || 0); },
    qa: () => ({
      arcadePowerStrikeForQA: (tech = mini?.powerCall || "jab", needle = null) => {
        if (!mini?.active || mini.mode !== "power") return null;
        mini.needle = needle === null ? mini.powerZone : (Number.isFinite(Number(needle)) ? clamp(Number(needle), 0, 1) : mini.needle);
        powerTap(String(tech || "jab"));
        return globalThis.RizoRuntimeQA.arcadeSnapshotForQA().power;
      }
    })
  });
})();
