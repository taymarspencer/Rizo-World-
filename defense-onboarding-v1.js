(() => {
  "use strict";

  const MARKER_KEY = "rizo-defense-first-120-v1";
  const FORCE = new URLSearchParams(location.search).get("first120") === "1";
  const sessions = new WeakMap();
  let scheduled = false;

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch {}
  }

  function playerNeedsGuide() {
    if (!FORCE && safeStorageGet(MARKER_KEY)) return false;
    try {
      const school = window.RizoWorld?.player?.()?.player?.defenseSchool;
      const completed = Array.isArray(school?.completed) ? school.completed : [];
      if (!FORCE && completed.includes("route") && completed.includes("placement")) return false;
    } catch {}
    return true;
  }

  function visible(node) {
    if (!node || node.hidden) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
  }

  function injectStyles() {
    if (document.getElementById("rizo-first-120-style")) return;
    const style = document.createElement("style");
    style.id = "rizo-first-120-style";
    style.textContent = `
      .defense-shell.rizo-first-120{--first120-accent:#77e59a;--first120-warn:#ffcf66}
      .rizo-first-120-coach{position:absolute;left:10px;right:10px;top:10px;z-index:65;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;min-height:54px;padding:9px 10px;border:2px solid #0b0d11;border-radius:12px;background:#f4efe7;color:#11141a;box-shadow:0 4px 0 #0b0d11;font-family:inherit;pointer-events:auto}
      .rizo-first-120-coach[hidden]{display:none}
      .rizo-first-120-coach>em{font-style:normal;font-size:11px;font-weight:1000;letter-spacing:.08em;white-space:nowrap}
      .rizo-first-120-coach>div{min-width:0;display:grid;gap:1px}
      .rizo-first-120-coach small{font-size:9px;font-weight:1000;letter-spacing:.12em;opacity:.62}
      .rizo-first-120-coach b{font-size:13px;line-height:1.05;letter-spacing:.035em}
      .rizo-first-120-coach span{font-size:10px;line-height:1.25;font-weight:800;opacity:.76}
      .rizo-first-120-coach button{width:30px;height:30px;min-width:30px;border:2px solid #11141a;border-radius:8px;background:transparent;color:#11141a;font:1000 17px/1 system-ui;box-shadow:none;padding:0}
      .rizo-first-120 .defense-stage-frame{position:relative}
      .rizo-first-120[data-rizo-first-step="place"] .defense-deploy-dock{display:block!important}
      .rizo-first-120[data-rizo-first-step="place"] .defense-roster-pet:not(.rizo-first-choice){display:none!important}
      .rizo-first-120 .defense-roster-pet.rizo-first-choice{display:grid!important;outline:3px solid var(--first120-accent);outline-offset:2px}
      .rizo-first-120[data-rizo-first-step="start"] .defense-deploy-dock,.rizo-first-120[data-rizo-first-step="watch"] .defense-deploy-dock,.rizo-first-120[data-rizo-first-step="upgrade"] .defense-deploy-dock{display:none!important}
      .rizo-first-120[data-rizo-first-step="start"] #defenseWaveButton{animation:none!important;transform:none!important;outline:3px solid var(--first120-warn);outline-offset:3px;box-shadow:0 0 0 5px rgba(255,207,102,.18)}
      .rizo-first-120[data-rizo-first-step="upgrade"] [data-defense-upgrade]:not([disabled]){outline:3px solid var(--first120-accent);outline-offset:3px}
      .rizo-first-pocket-target{position:absolute;z-index:58;width:54px;height:54px;min-width:54px;transform:translate(-50%,-50%);border:2px solid #0b0d11;border-radius:50%;background:rgba(119,229,154,.20);box-shadow:0 0 0 8px rgba(119,229,154,.13);color:#fff;font:1000 9px/1 system-ui;letter-spacing:.08em;text-shadow:0 1px 2px #000;touch-action:manipulation}
      .rizo-first-120 .defense-build-pocket{opacity:1!important;filter:none!important}
      .rizo-first-120.rizo-first-pop #defenseWorld{outline:3px solid var(--first120-accent);outline-offset:-4px}
      @media(max-width:520px){.rizo-first-120-coach{top:7px;left:7px;right:7px;min-height:48px;padding:7px 8px;gap:7px}.rizo-first-120-coach span{font-size:9px}.rizo-first-120-coach b{font-size:12px}.rizo-first-120-coach>em{font-size:9px}.rizo-first-pocket-target{width:48px;height:48px;min-width:48px}}
      @media(prefers-reduced-motion:reduce){.rizo-first-120 *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureCoach(shell) {
    let coach = shell.querySelector(".rizo-first-120-coach");
    if (coach) return coach;
    coach = document.createElement("section");
    coach.className = "rizo-first-120-coach";
    coach.setAttribute("role", "status");
    coach.setAttribute("aria-live", "polite");
    coach.innerHTML = `<em data-rizo-first-step-label>1/3</em><div><small>RIZO DEFENSE • FIRST RUN</small><b data-rizo-first-title>PLACE A RIZO</b><span data-rizo-first-copy>Pick your Rizo, then put it beside the trail.</span></div><button type="button" data-rizo-first-skip aria-label="Hide first-run help">×</button>`;
    const stage = shell.querySelector(".defense-stage-frame") || shell;
    stage.appendChild(coach);
    coach.querySelector("[data-rizo-first-skip]")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      safeStorageSet(MARKER_KEY, "skipped");
      cleanup(shell, sessions.get(shell));
    });
    return coach;
  }

  function setCoach(shell, step, title, copy) {
    const coach = ensureCoach(shell);
    coach.hidden = false;
    const label = coach.querySelector("[data-rizo-first-step-label]");
    const titleNode = coach.querySelector("[data-rizo-first-title]");
    const copyNode = coach.querySelector("[data-rizo-first-copy]");
    if (label && label.textContent !== step) label.textContent = step;
    if (titleNode && titleNode.textContent !== title) titleNode.textContent = title;
    if (copyNode && copyNode.textContent !== copy) copyNode.textContent = copy;
  }

  function removePocketTargets(shell) {
    shell.querySelectorAll(".rizo-first-pocket-target").forEach(node => node.remove());
  }

  function markOnlyChoice(shell, choice) {
    shell.querySelectorAll(".rizo-first-choice").forEach(node => {
      if (node !== choice) node.classList.remove("rizo-first-choice");
    });
    if (choice && !choice.classList.contains("rizo-first-choice")) choice.classList.add("rizo-first-choice");
  }

  function clearChoiceClasses(shell) {
    shell.querySelectorAll(".rizo-first-choice").forEach(node => node.classList.remove("rizo-first-choice"));
  }

  function cleanup(shell, session) {
    removePocketTargets(shell);
    clearChoiceClasses(shell);
    shell.classList.remove("rizo-first-120", "rizo-first-pop");
    shell.removeAttribute("data-rizo-first-step");
    shell.removeAttribute("data-rizo-first-pop");
    shell.querySelector(".rizo-first-120-coach")?.remove();
    if (session) session.finished = true;
  }

  function complete(shell, session) {
    if (!session || session.finished) return;
    session.finished = true;
    safeStorageSet(MARKER_KEY, "done");
    shell.dataset.rizoFirstStep = "done";
    setCoach(shell, "3/3", "YOU KNOW THE LOOP", "Place → start → pop → upgrade. Now the field is yours.");
    removePocketTargets(shell);
    clearChoiceClasses(shell);
    setTimeout(() => cleanup(shell, session), 1500);
  }

  function firstChoice(shell) {
    const enabled = [...shell.querySelectorAll("[data-defense-roster-id]:not([disabled])")];
    if (!enabled.length) return null;
    return enabled.find(button => /FREE DEPLOY/i.test(button.getAttribute("aria-label") || button.title || "")) || enabled[0];
  }

  function sendNativeFieldPointer(world, xPercent, yPercent) {
    const rect = world.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: rect.left + rect.width * xPercent / 100,
      clientY: rect.top + rect.height * yPercent / 100,
      button: 0,
      buttons: 1
    };
    if (typeof PointerEvent === "function") world.dispatchEvent(new PointerEvent("pointerdown", init));
    else world.dispatchEvent(new MouseEvent("pointerdown", init));
  }

  function ensurePocketTargets(shell) {
    const world = shell.querySelector("#defenseWorld");
    if (!world || !shell.classList.contains("has-placement")) {
      removePocketTargets(shell);
      return;
    }
    const pockets = [...world.querySelectorAll(".defense-build-pocket")];
    const existing = new Map([...world.querySelectorAll(".rizo-first-pocket-target")].map(node => [node.dataset.pocket, node]));
    pockets.forEach((pocket, index) => {
      const key = String(index);
      let button = existing.get(key);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "rizo-first-pocket-target";
        button.dataset.pocket = key;
        button.textContent = "PLACE";
        button.setAttribute("aria-label", `Place Rizo at suggested spot ${index + 1}`);
        for (const type of ["pointerdown", "pointerup"]) button.addEventListener(type, event => event.stopPropagation());
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const xPercent = Number.parseFloat(pocket.style.getPropertyValue("--pocket-x"));
          const yPercent = Number.parseFloat(pocket.style.getPropertyValue("--pocket-y"));
          if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) return;
          sendNativeFieldPointer(world, xPercent, yPercent);
        });
        world.appendChild(button);
      }
      button.style.left = pocket.style.getPropertyValue("--pocket-x");
      button.style.top = pocket.style.getPropertyValue("--pocket-y");
      existing.delete(key);
    });
    existing.forEach(node => node.remove());
  }

  function parseCounter(selector) {
    const text = document.querySelector(selector)?.textContent || "0";
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function mapIntroIsBlocking(shell) {
    const intro = shell.querySelector("#defenseMapIntro");
    return visible(intro);
  }

  function upgradeSucceeded(shell) {
    const levelText = shell.querySelector("#defenseTowerPanel .defense-panel-copy b")?.textContent || "";
    return /LV\s+[2-5]/i.test(levelText);
  }

  function syncSession(shell, session) {
    if (!session || session.finished || !shell.isConnected) return;
    if (mapIntroIsBlocking(shell)) {
      setCoach(shell, "1/3", "READ THE ROAD", "Entry goes to the Ember Gate. Enter the field when you're ready.");
      return;
    }

    const towers = shell.querySelectorAll("[data-defense-tower]");
    const currentWave = parseCounter("#defenseWave");
    const clearedWave = parseCounter("#defenseClearedWave");
    const pops = parseCounter("#miniScore");

    if (!towers.length) {
      shell.dataset.rizoFirstStep = "place";
      const choice = firstChoice(shell);
      markOnlyChoice(shell, choice);
      if (shell.classList.contains("has-placement")) {
        setCoach(shell, "1/3", "PICK A SPOT", "Now tap any marked spot beside the trail. Green means Rizo can fight from there.");
        ensurePocketTargets(shell);
      } else {
        removePocketTargets(shell);
        setCoach(shell, "1/3", "TAP YOUR RIZO", "Your active Rizo deploys free. Tap the one card below to pick it.");
      }
      return;
    }

    removePocketTargets(shell);
    clearChoiceClasses(shell);

    if (currentWave === 0) {
      shell.dataset.rizoFirstStep = "start";
      setCoach(shell, "2/3", "START WAVE 1", "Your Rizo attacks automatically. Start the wave and watch the trail.");
      return;
    }

    if (clearedWave < 1) {
      shell.dataset.rizoFirstStep = "watch";
      if (pops > 0 && !session.firstPopSeen) {
        session.firstPopSeen = true;
        session.flashUntil = performance.now() + 1300;
        shell.dataset.rizoFirstPop = "1";
        shell.classList.add("rizo-first-pop");
        setTimeout(() => shell.classList.remove("rizo-first-pop"), 520);
      }
      if (session.flashUntil > performance.now()) {
        setCoach(shell, "2/3", "FIRST POP", "That Rizo did that. Pops pay for the upgrades you'll use next.");
      } else {
        setCoach(shell, "2/3", "WATCH THE TRAIL", "Enemies follow the road. Your Rizo fires when they enter its reach.");
      }
      return;
    }

    shell.dataset.rizoFirstStep = "upgrade";
    setCoach(shell, "3/3", "UPGRADE YOUR RIZO", "Tap LEVEL UP. This is the core loop: defend, earn, get stronger.");
    const panel = shell.querySelector("#defenseTowerPanel");
    if (!session.autoOpenedUpgrade && (!panel || !visible(panel))) {
      session.autoOpenedUpgrade = true;
      setTimeout(() => {
        if (session.finished || !shell.isConnected) return;
        const firstTower = shell.querySelector("[data-defense-tower]");
        if (firstTower) firstTower.click();
      }, 620);
    }
  }

  function activate(shell) {
    if (!shell || sessions.has(shell) || !playerNeedsGuide()) return;
    const session = {
      autoOpenedUpgrade: false,
      firstPopSeen: false,
      flashUntil: 0,
      finished: false
    };
    sessions.set(shell, session);
    shell.classList.add("rizo-first-120");
    shell.dataset.rizoFirstStep = "place";
    ensureCoach(shell);
    syncSession(shell, session);
  }

  function sync() {
    scheduled = false;
    const shell = document.querySelector(".defense-shell");
    if (!shell) return;
    activate(shell);
    syncSession(shell, sessions.get(shell));
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener("click", event => {
    const upgrade = event.target.closest?.("[data-defense-upgrade]");
    if (!upgrade) return;
    const shell = upgrade.closest(".defense-shell") || document.querySelector(".defense-shell");
    const session = shell ? sessions.get(shell) : null;
    if (!session || session.finished) return;
    setTimeout(() => {
      if (upgradeSucceeded(shell)) complete(shell, session);
      else scheduleSync();
    }, 180);
  });

  injectStyles();
  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "disabled", "aria-pressed", "class"]
  });
  window.addEventListener("rizo:world-ready", scheduleSync);
  scheduleSync();
})();
