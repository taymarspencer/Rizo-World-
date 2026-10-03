/*
  RIZO DUNGEON — MODE
  ===================
  Registers "dungeon" with RizoModes and runs it: binds the campaign to the
  actual pet, owns the one frame loop, maps lifecycle notifications to pause
  holds, and saves through host.commit() (a confirmed, synchronous write).

  It never touches hub state, storage, Defense or the training runner. The
  player's Rizo is drawn only through host.petMarkup().

  Persistence policy: choices, hearths, deaths and rewards commit at once;
  otherwise only a dirty safe continuation commits, at most every few seconds.
  A reload resumes at the last room-entry anchor with that entry's Flame.
*/
(function initRizoDungeonMode(root) {
  "use strict";
  const Modes = root?.RizoModes, Core = root?.RizoDungeonCore, Content = root?.RizoDungeonContent, Input = root?.RizoDungeonInput, View = root?.RizoDungeonView;
  // The hub must boot without the Dungeon: a missing piece leaves it unregistered.
  if (!Modes || !Core || !Content || !Input || !View) {
    try { console.warn("Rizo Dungeon is not available on this build (a Dungeon script is missing)."); } catch (error) {}
    return;
  }

  const MODE_ID = "dungeon";
  const DIRTY_COMMIT_MS = 5000;
  const TEXT_CPS = 35;
  const EXIT_MS = 520, EXIT_MS_REDUCED = 160;
  const DUNGEON_TRACK = Object.freeze({ id: "dungeon-below", tempo: 880, lead: [57, null, null, null, null, null, 60, null, 55, null, null, null, null, null, null, null], bass: [33, null, null, null, 36, null, null, null], wave: "sine" });
  const FAILED = Object.freeze({ status: "failed", rewardApplied: false, duplicateReward: false, backupSynced: false, reason: "error" });
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const plain = value => JSON.parse(JSON.stringify(value));
  let live = null; // the running instance, for QA hooks only

  function campaignId() {
    let id = "";
    const bytes = new Uint8Array(10);
    try { root.crypto.getRandomValues(bytes); } catch (error) { for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256); }
    for (const byte of bytes) id += "abcdefghijklmnopqrstuvwxyz0123456789"[byte % 36];
    return `threshold-${id}`;
  }

  function createInstance(host) {
    let stage = null, view = null, input = null;
    let data = null, sim = null, settings = { assist: false, textSpeed: "normal" };
    let pet = null;
    let holds = [];
    let ui = "play"; // play | dialogue | panel | blocked | exiting
    let panelKind = "";
    let rafId = 0, lastFrame = 0, acc = 0, stopped = false, started = false;
    let prev = { x: 0, y: 0 };
    let pending = { primary: false, secondary: false };
    let dirty = false, lastCommitAt = 0, unsaved = false, lastOutcome = null;
    let dialogueState = null;
    let exitState = null;
    let facingLeft = false;
    let cue = { moved: false, flare: false, tuck: false, noticed: false };
    let bannerUntil = 0;
    let deaths = 0;

    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const reducedMotion = () => Boolean(host.settings().reducedMotion);
    const geo = () => Core.room(sim?.roomId || Content.START_ROOM);
    const sound = (kind) => {
      const a = host.audio || {};
      try {
        if (kind === "flare") { a.noise?.(0.07, 0.02); a.tone?.(330, 0.06, "triangle", 0.028, 0, 160); }
        else if (kind === "hit") { a.tone?.(520, 0.05, "square", 0.03, 0, -120); a.haptic?.(12); }
        else if (kind === "calmed") { a.tone?.(392, 0.08, "triangle", 0.03); a.tone?.(523, 0.12, "triangle", 0.026, 0.08); }
        else if (kind === "tuck") a.noise?.(0.09, 0.018);
        else if (kind === "hurt") { a.tone?.(150, 0.12, "square", 0.035, 0, -40); a.haptic?.([18, 30, 18]); }
        else if (kind === "notice") a.tone?.(880, 0.05, "sine", 0.02, 0, -200);
        else if (kind === "lock") a.tone?.(1200, 0.02, "square", 0.015);
        else if (kind === "lunge") a.noise?.(0.12, 0.022);
        else if (kind === "kindle") { a.tone?.(262, 0.2, "sine", 0.025, 0, 60); a.tone?.(330, 0.3, "sine", 0.02, 0.18, 40); }
        else if (kind === "rest") { a.tone?.(392, 0.18, "sine", 0.026); a.tone?.(494, 0.24, "sine", 0.022, 0.14); a.tone?.(587, 0.32, "sine", 0.02, 0.28); }
        else if (kind === "down") a.tone?.(220, 0.4, "sine", 0.03, 0, -110);
        else if (kind === "ui") a.tone?.(660, 0.03, "square", 0.018);
      } catch (error) {}
    };

    // ===== PERSISTENCE =====
    // Every save goes through host.commit(); the in-memory journey advances
    // either way, and an unconfirmed save is shown, never hidden.
    function commit(next, reward = null) {
      let outcome;
      try { outcome = host.commit(reward ? { data: next, reward } : { data: next }); }
      catch (error) { try { host.report("commit-error", { message: String(error?.message || error).slice(0, 160) }); } catch (reportError) {} outcome = FAILED; }
      data = next;
      lastOutcome = outcome;
      lastCommitAt = now();
      if (outcome.status === "committed") { dirty = false; unsaved = false; }
      else unsaved = true;
      return outcome;
    }
    const sliceWithSettings = next => ({ ...next, settings: { ...settings } });
    function commitData(mutator) {
      const next = plain(data);
      mutator?.(next);
      return commit(sliceWithSettings(next));
    }
    function setContinuation(next, roomId, anchorId, flame, resumeKind) {
      next.continuation = { roomId, safeAnchorId: anchorId, roomEntryFlame: Math.max(1, Math.min(Core.T.FLAME_MAX, flame)), resumeKind };
    }
    // An unconfirmed reward stays pending in the journey and is retried here.
    function retryPendingRewards() {
      if (!data?.pendingRewards?.length) return null;
      let outcome = null;
      for (const item of [...data.pendingRewards]) {
        const next = plain(data);
        next.pendingRewards = next.pendingRewards.filter(entry => entry.receiptId !== item.receiptId);
        outcome = commit(sliceWithSettings(next), { receiptId: item.receiptId, petId: data.campaign.petId, entitlements: item.entitlements });
        if (outcome.status === "committed" && data.proofComplete) {
          try { host.event("chapterComplete", { boundaryId: "threshold-complete", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
        }
        if (outcome.status !== "committed") {
          // Keep it pending in memory; the next safe entry retries again.
          data = plain(data);
          if (!data.pendingRewards.some(entry => entry.receiptId === item.receiptId)) data.pendingRewards.push(item);
          break;
        }
      }
      return outcome;
    }

    // ===== HOLDS =====
    const running = () => !stopped && started && holds.length === 0 && ui === "play" && sim?.phase !== "await-respawn";
    function addHold(reason) {
      holds = Core.holdsSuspend(holds, reason);
      input?.clear("hold");
      pending = { primary: false, secondary: false };
      acc = 0;
    }
    function playerResume() {
      if (Core.externalHolds(holds).length) { renderPausePanel(); return false; }
      holds = Core.holdsPlayerResume(holds);
      input?.clear("resume");
      pending = { primary: false, secondary: false };
      acc = 0; lastFrame = now();
      if (ui === "panel") closePanel();
      return true;
    }

    // ===== PANELS (inside the device) =====
    const esc = View.esc;
    function openPanel(kind, markup) {
      panelKind = kind;
      if (ui === "play" || ui === "dialogue") ui = "panel";
      input?.clear("panel");
      view.panel(markup);
    }
    function closePanel() {
      panelKind = "";
      view.panel(null);
      if (ui === "panel") ui = dialogueState ? "dialogue" : "play";
      input?.clear("panel");
      pending = { primary: false, secondary: false };
    }
    function card({ kicker = "THE THRESHOLD", title, body = "", actions = "", fine = "" }) {
      return `<div class="dungeon-card"><small>${esc(kicker)}</small><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ""}<div class="dungeon-card-actions">${actions}</div>${fine ? `<p class="dungeon-fine">${fine}</p>` : ""}</div>`;
    }
    function renderPausePanel() {
      const external = Core.externalHolds(holds);
      const waiting = external.includes("ad") ? "Waiting for the break to finish." : external.includes("save-blocked") ? "This tab stopped saving. Load the newest save to continue." : "";
      const updateNote = holds.includes("update") && lastOutcome && lastOutcome.status !== "committed" ? "The update waited because this moment couldn't be saved yet. Resume to keep playing; try the update again later." : "";
      const perf = holds.includes("performance") ? "Paused because the device fell behind. Nothing advanced while it caught up." : "";
      openPanel("pause", card({
        title: "PAUSED",
        body: esc(`${waiting || updateNote || perf || `${pet?.name || "Your Rizo"} waits. Nothing moves until you resume.`}${unsaved && !updateNote ? " The last moment isn't saved yet; GO HOME tries again." : ""}`),
        actions: `<button type="button" class="primary" data-dungeon-action="resume" ${external.length ? "disabled" : ""}>RESUME</button><button type="button" data-dungeon-action="home">GO HOME</button>`,
        fine: esc(Content.LINES.reviewNote)
      }));
    }
    function renderSaveFailedPanel(context) {
      const blocked = lastOutcome?.status === "blocked";
      openPanel("save-failed", card({
        kicker: blocked ? "SAVE PROTECTED" : "NOT SAVED",
        title: "COULDN'T SAVE THIS MOMENT",
        body: esc(blocked ? "Another tab or the app has newer progress, so this tab stopped saving." : "Your browser storage refused the save. Nothing was lost in play."),
        actions: `${blocked ? "" : `<button type="button" class="primary" data-dungeon-action="retry-save">RETRY SAVE</button>`}<button type="button" data-dungeon-action="home-anyway">GO HOME</button>`,
        fine: esc(context === "leaving" ? "If you go home now, you'll resume from your last confirmed save." : "Going home now returns you to your last confirmed save.")
      }));
    }

    // ===== DIALOGUE =====
    function openDialogue(lines) {
      dialogueState = { lines: [...lines], index: 0, startAt: now(), shown: 0 };
      ui = "dialogue";
      input.clear("dialogue");
      pending = { primary: false, secondary: false };
      view.showPrompt(null);
      tickDialogue(now());
    }
    function tickDialogue(time) {
      if (!dialogueState) return;
      const line = dialogueState.lines[dialogueState.index] || "";
      const instant = settings.textSpeed === "instant";
      dialogueState.shown = instant ? line.length : Math.min(line.length, Math.floor(((time - dialogueState.startAt) / 1000) * TEXT_CPS));
      view.dialogue(line.slice(0, dialogueState.shown), { done: dialogueState.shown >= line.length });
    }
    // A fresh Primary press reveals the line, another advances it.
    function advanceDialogue() {
      const line = dialogueState.lines[dialogueState.index] || "";
      if (dialogueState.shown < line.length) { dialogueState.startAt = -1e9; tickDialogue(now()); return; }
      dialogueState.index += 1;
      if (dialogueState.index >= dialogueState.lines.length) {
        dialogueState = null;
        view.dialogue(null);
        ui = "play";
        input.clear("dialogue");
        pending = { primary: false, secondary: false };
        return;
      }
      dialogueState.startAt = now();
      tickDialogue(now());
      sound("ui");
    }

    // ===== SIMULATION EVENTS =====
    function handleEvents(events) {
      for (const event of events) {
        switch (event.type) {
          case "flare": sound("flare"); cue.flare = true; break;
          case "tuck": sound("tuck"); cue.tuck = true; view.addEffect("puff", sim.player.x, sim.player.y + 4, 1); break;
          case "hit": { sound("hit"); const enemy = sim.enemies.find(item => item.id === event.id); if (enemy) view.addEffect("spark", enemy.x, enemy.y, 4); break; }
          case "calmed":
            sound("calmed");
            try { host.event("encounterResolved", { boundaryId: event.id, campaignId: data.campaign.id, tone: "quiet", interruption: "none" }); } catch (error) {}
            break;
          case "hurt": sound("hurt"); view.setFlame(sim.player.flame, Core.T.FLAME_MAX); break;
          case "notice": sound("notice"); cue.noticed = true; break;
          case "lock": sound("lock"); break;
          case "lunge": sound("lunge"); break;
          case "kindle-start": sound("kindle"); break;
          case "kindle-cancel": break;
          case "kindled": restAtHearth(event.hearthId); break;
          case "hearth-near": registerHearth(event.hearthId); break;
          case "interact": inspect(event.id); break;
          case "down": sound("down"); input.clear("down"); pending = { primary: false, secondary: false }; break;
          case "respawn-ready": respawnAfterDown(); break;
          default: break;
        }
      }
    }
    function registerHearth(hearthId) {
      if (data.checkpoint.hearthId === hearthId) return;
      const hearth = geo().hearth;
      sim.player.flame = Core.T.FLAME_MAX;
      sim.hearthLit = true;
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
      const outcome = commitData(next => {
        next.checkpoint = { hearthId, roomId: sim.roomId, spawnAnchorId: hearth.spawnAnchorId };
        setContinuation(next, sim.roomId, hearth.spawnAnchorId, Core.T.FLAME_MAX, "hearth");
      });
      if (outcome.status === "committed") showBanner("THE HEARTH KNOWS YOU NOW");
      else if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function restAtHearth(hearthId) {
      Core.rest(sim);
      sim.hearthLit = true;
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
      // A shelter is a safe point: refresh the Rizo's look and edges here.
      refreshPet();
      const hearth = geo().hearth;
      const outcome = commitData(next => {
        next.checkpoint = { hearthId, roomId: sim.roomId, spawnAnchorId: hearth.spawnAnchorId };
        next.legProfile = Core.legProfile(pet);
        setContinuation(next, sim.roomId, hearth.spawnAnchorId, Core.T.FLAME_MAX, "hearth");
      });
      sim.edges = Core.normalizeEdges(data.legProfile.edges);
      if (outcome.status === "committed") {
        sound("rest");
        showBanner(Content.LINES.rested.toUpperCase());
        try { host.event("checkpointRest", { boundaryId: hearthId, campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
      } else if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function respawnAfterDown() {
      const target = Core.safeReturn(data);
      sim = Core.respawn(sim, { roomId: target.roomId, anchorId: target.anchorId });
      sim.hearthLit = Boolean(data.checkpoint.hearthId);
      prev = { x: sim.player.x, y: sim.player.y };
      deaths += 1;
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
      view.camera.ready = false;
      input.clear("respawn");
      pending = { primary: false, secondary: false };
      const outcome = commitData(next => setContinuation(next, target.roomId, target.anchorId, Core.T.FLAME_MAX, "respawn"));
      showBanner(deaths === 1 ? Content.LINES.firstDown.toUpperCase() : "BACK AT THE HEARTH");
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function inspect(id) {
      const prop = geo().props.find(item => item.id === id);
      if (!prop) return;
      if (!data.journal.discoveredEntryIds.includes(id)) { data = plain(data); data.journal.discoveredEntryIds.push(id); dirty = true; }
      openDialogue(prop.lines);
    }
    function showBanner(text) { view.banner(text); bannerUntil = now() + 2400; }

    // ===== THE LOOP =====
    function frame(time) {
      if (stopped) return;
      rafId = root.requestAnimationFrame(frame);
      const dt = Math.max(0, time - lastFrame);
      lastFrame = time;
      const edges = input.consume();
      view.setKeys(input.view());
      if (exitState) { if (time >= exitState.at) finishExit(); return; }

      // A press belongs to whatever had the input when it happened: the menu,
      // a dialogue line, or play. The press that closes a line never Flares.
      const playHadInput = ui === "play" && holds.length === 0;
      if (edges.systemPressed) {
        if (ui === "panel" && panelKind === "pause") playerResume();
        else if (ui === "play" || ui === "dialogue") { addHold("manual"); renderPausePanel(); }
      }
      if (ui === "dialogue" && holds.length === 0) {
        if (edges.primaryPressed) advanceDialogue();
        else tickDialogue(time);
      }
      if (playHadInput && ui === "play" && !edges.systemPressed) {
        pending.primary = pending.primary || edges.primaryPressed;
        pending.secondary = pending.secondary || edges.secondaryPressed;
      }

      if (running()) {
        acc += dt;
        let steps = 0;
        while (acc >= Core.STEP_MS && steps < Core.T.MAX_CATCHUP_STEPS && running()) {
          prev = { x: sim.player.x, y: sim.player.y };
          const events = Core.step(sim, { moveX: edges.moveX, moveY: edges.moveY, primaryHeld: edges.primaryHeld, primaryPressed: pending.primary, secondaryPressed: pending.secondary });
          pending = { primary: false, secondary: false };
          if (edges.moveX || edges.moveY) cue.moved = true;
          acc -= Core.STEP_MS;
          steps += 1;
          handleEvents(events);
        }
        // Rules never run slow and danger never runs hidden: debt in danger pauses.
        if (acc >= Core.STEP_MS) {
          if (Core.encounterActive(sim) && steps >= Core.T.MAX_CATCHUP_STEPS) { addHold("performance"); renderPausePanel(); }
          acc = 0;
        }
        if (dirty && time - lastCommitAt >= DIRTY_COMMIT_MS && sim.phase === "play") commitData();
      } else {
        acc = 0;
        prev = { x: sim?.player.x || 0, y: sim?.player.y || 0 };
      }
      draw(time, dt);
    }
    function draw(time, dt) {
      if (!sim) return;
      const alpha = Math.max(0, Math.min(1, acc / Core.STEP_MS));
      const pos = { x: prev.x + (sim.player.x - prev.x) * alpha, y: prev.y + (sim.player.y - prev.y) * alpha };
      view.render(sim, pos, time, dt / 1000);
      const p = sim.player;
      if (p.fx < -0.1) facingLeft = true; else if (p.fx > 0.1) facingLeft = false;
      const act = p.act?.kind || "";
      const hurt = sim.t < p.hurtUntil;
      view.setPose([
        facingLeft ? "facing-left" : "facing-right",
        p.moving ? "is-moving" : "is-still",
        act === "flare" ? "is-flare" : "", act === "tuck" ? "is-tuck" : "", act === "kindle" ? "is-kindle" : "",
        hurt ? "is-hurt" : "", sim.phase !== "play" ? "is-down" : "", holds.length ? "is-held" : ""
      ].filter(Boolean).join(" "));
      view.setFade(sim.phase === "down" ? Math.min(0.85, (sim.t - (sim.downUntil - Core.T.DOWN_MS)) / Core.T.DOWN_MS) : 0);
      // The highlighted thing Primary would use, and the key label that says so.
      const target = ui === "play" ? Core.focusTarget(sim) : null;
      view.showPrompt(target, target ? `◆ ${target.prompt}` : null);
      view.setActionLabel(target ? target.prompt : ui === "dialogue" ? "NEXT" : "FLARE");
      if (bannerUntil && time > bannerUntil) { view.banner(""); bannerUntil = 0; }
      if (!cue.moved) view.showCue(`<span><i class="cue-dpad"></i>MOVE <kbd>WASD</kbd></span>`);
      else if (cue.noticed && Core.encounterActive(sim) && (!cue.flare || !cue.tuck)) view.showCue(`<span class="${cue.flare ? "done" : ""}"><i class="cue-primary"></i>FLARE <kbd>Z</kbd></span><span class="${cue.tuck ? "done" : ""}"><i class="cue-secondary"></i>TUCK <kbd>X</kbd></span>`);
      else view.showCue(null);
    }

    // ===== ENTRY =====
    function refreshPet() {
      pet = host.pet();
      view.setPet(pet);
    }
    function bindingProblem() {
      if (data.campaign.petId === pet.id) return "";
      const housed = host.roster().find(row => row.id === data.campaign.petId);
      const name = esc(data.campaign.petName || "your Rizo");
      if (housed) return card({ kicker: "JOURNEY SAVED", title: `${data.campaign.petName} IS IN THE HOUSE`, body: `This journey belongs to ${name}. Make ${name} your active Rizo from the House to continue it.`, actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` });
      return card({ kicker: "JOURNEY SAVED", title: `${data.campaign.petName}'S JOURNEY`, body: `This journey belongs to ${name}, who isn't with you any more. It stays saved here and can't move to another Rizo.`, actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` });
    }
    function beginPlay(repaired) {
      const cont = data.continuation;
      sim = Core.createSim({ roomId: cont.roomId, anchorId: cont.safeAnchorId, flame: cont.roomEntryFlame, edges: data.legProfile.edges, assist: settings.assist });
      sim.hearthLit = Boolean(data.checkpoint.hearthId);
      prev = { x: sim.player.x, y: sim.player.y };
      view.setRoomName(geo().name);
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
      ui = "play";
      retryPendingRewards();
      // Room entry records the safe anchor and its Flame baseline.
      if (repaired || dirty) commitData();
    }
    function start(options = {}) {
      stage = host.mount({ kicker: "RIZO DUNGEON", title: "THE THRESHOLD", timer: "", score: "", hint: "", quit: "GO HOME" });
      stage.root.classList.add("dungeon-active");
      if (reducedMotion()) stage.root.classList.add("dungeon-reduced-motion");
      view = View.create({ arena: stage.arena, host, reducedMotion: reducedMotion() });
      input = Input.create({ device: view.el.device, screen: view.el.screen, dpad: view.el.dpad, keys: view.el.keys });
      input.bind();
      view.el.panel.addEventListener("click", onPanelClick);
      started = true;
      live = api;
      settings = { ...Core.SETTINGS_DEFAULTS, ...host.modeSettings() };
      pet = host.pet();
      view.setPet(pet);
      try { host.audio.music?.(DUNGEON_TRACK); } catch (error) {}

      const result = Core.normalizeSlice(host.slice.read());
      if (result.status === "unsupported") {
        data = result.data;
        sim = Core.createSim({});
        ui = "blocked";
        view.panel(card({ kicker: "JOURNEY SAVED", title: "SAVED BY ANOTHER BUILD", body: "This journey was saved by a different version of Rizo Dungeon. It is kept exactly as it is.", actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` }));
      } else if (result.status === "empty") {
        settings = { ...settings, ...result.data.settings };
        data = { ...Core.newCampaign({ pet, id: campaignId() }), settings: { ...settings } };
        const outcome = commit(sliceWithSettings(data));
        sim = Core.createSim({ edges: data.legProfile.edges, assist: settings.assist });
        prev = { x: sim.player.x, y: sim.player.y };
        view.setRoomName(geo().name);
        view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
        if (outcome.status !== "committed") renderSaveFailedPanel("moment");
      } else {
        data = result.data;
        settings = { ...settings, ...data.settings };
        const problem = bindingProblem();
        if (problem) { sim = Core.createSim({}); ui = "blocked"; view.panel(problem); }
        else if (data.proofComplete) {
          // Reached only through the QA completion fixture in this review build.
          retryPendingRewards();
          sim = Core.createSim({});
          ui = "blocked";
          view.panel(card({ kicker: "THE THRESHOLD", title: "THIS JOURNEY REACHED HOME", body: `${esc(data.campaign.petName)} already came home from this journey. Replays come later.`, actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` }));
        } else {
          // A safe entry refreshes the profile from the actual pet.
          data.legProfile = Core.legProfile(pet);
          dirty = true;
          beginPlay(result.status === "repaired");
        }
      }
      if (sim && !prev.x) prev = { x: sim.player.x, y: sim.player.y };
      view.setPhase(reducedMotion() ? "fade-in" : "enter");
      lastFrame = now();
      rafId = root.requestAnimationFrame(frame);
    }

    // ===== EXIT =====
    function beginExit(reason, toast) {
      if (exitState) return;
      input.clear("exit");
      ui = "exiting";
      view.panel(null);
      view.setPhase(reducedMotion() ? "fade-out" : "exit");
      exitState = { at: now() + (reducedMotion() ? EXIT_MS_REDUCED : EXIT_MS), reason, toast };
    }
    function finishExit() {
      const { reason, toast } = exitState;
      exitState = null;
      try { host.event("sessionEnded", { boundaryId: "manual-return", campaignId: data?.campaign?.id || "", tone: "protected", interruption: "none" }); } catch (error) {}
      host.exit({ reason, destination: "home" });
      if (toast) try { host.ui.toast(toast); } catch (error) {}
    }
    // GO HOME: save the journey where it stands, then retract the device.
    function goHome() {
      if (ui === "blocked") { beginExit("leave", ""); return; }
      const outcome = commitData();
      if (outcome.status === "committed") beginExit("quit", "JOURNEY SAVED");
      else renderSaveFailedPanel("leaving");
    }
    function onPanelClick(event) {
      const action = event.target.closest("[data-dungeon-action]")?.dataset.dungeonAction;
      if (!action) return;
      sound("ui");
      if (action === "resume") playerResume();
      else if (action === "home") goHome();
      else if (action === "leave") beginExit("leave", "");
      else if (action === "home-anyway") beginExit("quit-unsaved", "LAST CONFIRMED SAVE KEPT");
      else if (action === "retry-save") {
        const outcome = commit(sliceWithSettings(plain(data)));
        if (outcome.status === "committed") { closePanel(); showBanner("SAVED"); if (holds.length) renderPausePanel(); }
        else renderSaveFailedPanel("moment");
      }
    }

    function stop() {
      if (stopped) return;
      stopped = true;
      if (rafId) root.cancelAnimationFrame(rafId);
      rafId = 0;
      input?.unbind();
      view?.el.panel.removeEventListener("click", onPanelClick);
      view?.destroy();
      if (live === api) live = null;
    }

    const api = {
      start,
      stop,
      // Background, ads, a blocked save or an update: hold, clear input, and
      // save the journey's safe continuation. "force-update" reports the commit.
      suspend(reason) {
        addHold(reason);
        if (!started || stopped) return undefined;
        let outcome;
        if (reason !== "save-blocked" && ui !== "blocked" && ui !== "exiting" && data?.campaign) outcome = commit(sliceWithSettings(plain(data)));
        // Drawn after the commit so the panel can say whether it was saved.
        if (ui !== "blocked" && ui !== "exiting") renderPausePanel();
        return outcome;
      },
      resume(reason) {
        holds = Core.holdsResume(holds, reason);
        acc = 0; lastFrame = now();
        input?.clear("resume");
        if (ui === "panel" && panelKind === "pause") renderPausePanel();
      },
      key(event) { return Boolean(input?.bound && input.key(event)); },
      resize() {
        if (!view) return;
        if (view.layout()) { input?.clear("resize"); pending = { primary: false, secondary: false }; }
      },
      quit(reason) {
        if (stopped || exitState) return;
        if (data?.campaign && ui !== "blocked") commit(sliceWithSettings(plain(data)));
        const toast = reason === "recovery" ? `${pet?.name || "RIZO"} NEEDS CARE • JOURNEY SAVED` : "";
        exitState = { at: 0, reason, toast };
        finishExit();
      },
      // QA builds only (see the mode's qa hooks).
      qaState: () => ({
        ui, panelKind, holds: [...holds], unsaved, lastOutcome: lastOutcome ? { ...lastOutcome } : null,
        settings: { ...settings },
        sim: sim ? { t: sim.t, roomId: sim.roomId, phase: sim.phase, assist: sim.assist, edges: { ...sim.edges }, player: { x: sim.player.x, y: sim.player.y, flame: sim.player.flame, act: sim.player.act?.kind || null, fx: sim.player.fx, fy: sim.player.fy, attacks: sim.player.attackSeq, tuckReadyAt: sim.player.tuckReadyAt }, enemies: sim.enemies.map(item => ({ id: item.id, state: item.state, hp: item.hp, aware: item.aware, x: item.x, y: item.y })) } : null,
        data: data ? plain(data) : null,
        petId: pet?.id || null,
        actorMarkup: view?.el.pose.innerHTML.length || 0,
        dialogue: dialogueState ? { index: dialogueState.index, shown: dialogueState.shown, lines: dialogueState.lines.length } : null
      }),
      qaTeleport(x, y) { if (!sim) return false; sim.player.x = x; sim.player.y = y; prev = { x, y }; return true; },
      qaAdvance(ms, stepInput = {}) {
        if (!sim) return [];
        const all = [];
        for (let elapsed = 0, first = true; elapsed < ms; elapsed += Core.STEP_MS, first = false) {
          if (!running()) break;
          const events = Core.step(sim, { ...stepInput, primaryPressed: first && stepInput.primaryPressed, secondaryPressed: first && stepInput.secondaryPressed });
          handleEvents(events);
          all.push(...events.map(item => item.type));
        }
        prev = { x: sim.player.x, y: sim.player.y };
        return all;
      },
      qaCommit(request) { try { return host.commit(request); } catch (error) { return { status: "threw", message: String(error?.message || error) }; } },
      // QA-only completion fixture: proves the First Knot / story-mark
      // transaction on a throwaway save. Never reachable from play.
      qaCompleteFixture({ sharedRest = false } = {}) {
        if (!host.debug || !data?.campaign) return null;
        const next = plain(data);
        next.proofComplete = true;
        next.storyComplete = false;
        next.campaign.status = "homecoming-ready";
        if (sharedRest) { next.story.facts.sharedRest = true; next.story.choices["hearth-seat"] = "sit"; }
        next.story.committedSceneBeats = [...new Set([...next.story.committedSceneBeats, "knot-gift:granted"])];
        const reward = { receiptId: `${next.campaign.id}:threshold-complete`, petId: next.campaign.petId, entitlements: sharedRest ? ["first-knot", "shared-hearth"] : ["first-knot"] };
        const withPending = { ...next, pendingRewards: [{ receiptId: reward.receiptId, entitlements: reward.entitlements }] };
        const outcome = commit(sliceWithSettings({ ...next, pendingRewards: [] }), reward);
        if (outcome.status !== "committed") data = withPending;
        else try { host.event("chapterComplete", { boundaryId: "threshold-complete", campaignId: next.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
        return outcome;
      },
      qaRetryPending: () => retryPendingRewards()
    };
    return api;
  }

  function createDungeonQA(hubQA = {}) {
    const need = () => { if (!live) throw new Error("Rizo Dungeon is not running"); return live; };
    return {
      dungeonLaunchForQA: () => Modes.launch(MODE_ID, {}),
      dungeonStateForQA: () => (live ? live.qaState() : null),
      dungeonTeleportForQA: (x, y) => need().qaTeleport(x, y),
      dungeonAdvanceForQA: (ms, input) => need().qaAdvance(ms, input),
      dungeonCommitForQA: request => need().qaCommit(request),
      dungeonCompleteFixtureForQA: options => need().qaCompleteFixture(options),
      dungeonRetryPendingForQA: () => need().qaRetryPending(),
      dungeonSummaryForQA: () => Modes.summary(MODE_ID)
    };
  }

  try {
    Modes.register({
      id: MODE_ID,
      name: "RIZO DUNGEON",
      schema: 1,
      entry: { energy: 0 },
      carePolicy: "foreground-hold",
      settings: [
        { key: "assist", kind: "toggle", title: "Gentler timing", copy: "Enemies wind up longer and a hit protects your Rizo for longer. Story and rewards are unchanged.", default: false },
        { key: "textSpeed", kind: "choice", title: "Dungeon text speed", copy: "How lines appear. A press always shows the whole line.", choices: [["normal", "NORMAL"], ["instant", "INSTANT"]], default: "normal" }
      ],
      // Schema 1 is the first Dungeon slice; there is no pre-contract data.
      migrate: data => (isObject(data) ? data : {}),
      summary: data => Core.summary(data),
      create: host => createInstance(host),
      qa: hubQA => createDungeonQA(hubQA)
    });
  } catch (error) {
    try { console.warn("Rizo Dungeon could not register", error); } catch (warnError) {}
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
