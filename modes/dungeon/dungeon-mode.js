/*
  RIZO DUNGEON — MODE
  ===================
  Registers "dungeon" with RizoModes and runs The Threshold: binds the
  campaign to the actual pet, owns the one frame loop, maps lifecycle
  notifications to pause holds, runs the authored scenes, and saves through
  host.commit() (a confirmed, synchronous write).

  It never touches hub state, storage, Defense or the training runner. The
  player's Rizo is drawn only through host.petMarkup().

  Story rule: an irreversible effect (rescue, seat choice, shortcut, help,
  reward) is committed BEFORE its scene is presented. A scene interrupted
  after its commit is acknowledged on the next entry from content.ACKS; its
  effect is never applied twice.

  Persistence policy: choices, hearths, deaths and rewards commit at once;
  every room entry commits the safe continuation; otherwise a dirty journey
  commits at most every five seconds. Nothing saves per frame.
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
  const EXIT_MS = 560, EXIT_MS_REDUCED = 160;
  const SHELL_LOCK_MS = 560;
  const DUNGEON_TRACK = Object.freeze({ id: "dungeon-below", tempo: 880, lead: [57, null, null, null, null, null, 60, null, 55, null, null, null, null, null, null, null], bass: [33, null, null, null, 36, null, null, null], wave: "sine" });
  // Outside there is almost no music: rain, a hum, one low note now and then.
  const STREET_TRACK = Object.freeze({ id: "dungeon-street", tempo: 1400, lead: [null, null, null, null, null, null, null, null], bass: [31, null, null, null, null, null, null, null, 33, null, null, null, null, null, null, null], wave: "sine" });
  const FAILED = Object.freeze({ status: "failed", rewardApplied: false, duplicateReward: false, backupSynced: false, reason: "error" });
  const L = Content.LINES;
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const plain = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let live = null; // the running instance, for QA hooks only

  function campaignId() {
    let id = "";
    const bytes = new Uint8Array(10);
    try { root.crypto.getRandomValues(bytes); } catch (error) { for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256); }
    for (const byte of bytes) id += "abcdefghijklmnopqrstuvwxyz0123456789"[byte % 36];
    return `threshold-${id}`;
  }

  // Scene steps. A scene is a short list; branching lives in the room logic.
  const S = {
    say: lines => ({ type: "say", lines }),
    wait: ms => ({ type: "wait", ms }),
    call: fn => ({ type: "call", fn }),
    until: pred => ({ type: "until", pred }),
    move: (id, x, y, ms, wait = true) => ({ type: "move", id, x, y, ms, wait }),
    pose: (name, ms) => ({ type: "pose", name, ms }),
    fade: (to, ms) => ({ type: "fade", to, ms }),
    control: on => ({ type: "control", on }),
    choice: (key, options) => ({ type: "choice", key, options }),
    bark: (id, line, ms = 1900) => ({ type: "bark", id, line, ms })
  };

  // The page around the handheld must not scroll, rubber-band, zoom or
  // select text while the Dungeon is open. Everything here is undone on stop.
  function createPageLock(stageRoot) {
    const doc = root.document;
    const html = doc.documentElement, body = doc.body;
    const listeners = [];
    const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); };
    const insideStage = event => Boolean(event.target?.closest?.(".minigame-overlay"));
    const scroll = { x: root.scrollX || 0, y: root.scrollY || 0 };
    html.classList.add("dungeon-locked");
    body.classList.add("dungeon-locked");
    try { root.getSelection?.()?.removeAllRanges?.(); } catch (error) {}
    // iOS rubber-bands the page on any unhandled touchmove; nothing in the
    // stage scrolls, so every touchmove while the Dungeon is open is ours.
    listen(doc, "touchmove", event => { if (event.cancelable) event.preventDefault(); }, { passive: false });
    listen(doc, "gesturestart", event => event.preventDefault(), { passive: false });
    listen(doc, "selectstart", event => { if (insideStage(event) || event.target === body || event.target === doc) event.preventDefault(); });
    listen(stageRoot, "dblclick", event => event.preventDefault());
    listen(stageRoot, "wheel", event => { if (event.cancelable) event.preventDefault(); }, { passive: false });
    return function release() {
      while (listeners.length) listeners.pop()();
      html.classList.remove("dungeon-locked");
      body.classList.remove("dungeon-locked");
      try { root.getSelection?.()?.removeAllRanges?.(); } catch (error) {}
      try { root.scrollTo(scroll.x, scroll.y); } catch (error) {}
    };
  }

  function createInstance(host) {
    let stage = null, view = null, input = null, releasePage = null;
    let data = null, sim = null, settings = { assist: false, textSpeed: "normal" };
    let pet = null;
    let holds = [];
    let ui = "play"; // play | scene | dialogue | choice | panel | blocked | exiting
    let panelKind = "";
    let rafId = 0, lastFrame = 0, acc = 0, stopped = false, started = false;
    let prev = { x: 0, y: 0 };
    let pending = { primary: false, secondary: false };
    let dirty = false, lastCommitAt = 0, unsaved = false, lastOutcome = null;
    let dialogueState = null, choiceState = null, scene = null;
    let sceneTime = 0;
    let exitState = null;
    let facingLeft = false;
    let cue = { moved: false, flare: false, tuck: false, noticed: false };
    let bannerUntil = 0;
    let deaths = 0;
    let shell = "locked";
    let sceneFade = { value: 0, from: 0, to: 0, start: 0, ms: 0 };
    let poseOverride = null;          // { name, until } presentation only
    let npcs = new Map();             // id → presentation actor in this room
    let barks = [];                   // floating speech over NPCs
    let room = {};                    // per-room transient presentation state
    let lastMove = { x: 0, y: 0 };
    let rainTickAt = 0;
    let stillFor = 0;
    let pendingGift = null;
    let qaLog = [];

    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const reducedMotion = () => Boolean(host.settings().reducedMotion);
    const geo = () => Core.room(sim?.roomId || Content.START_ROOM);
    const flags = () => Core.flagsOf(data);
    const fact = name => Boolean(flags()[name]);
    const beats = () => data?.story?.committedSceneBeats || [];
    const log = entry => { if (host.debug) { qaLog.push(entry); if (qaLog.length > 60) qaLog.shift(); } };
    const sound = (kind) => {
      const a = host.audio || {};
      try {
        if (kind === "flare") { a.noise?.(0.07, 0.02); a.tone?.(330, 0.06, "triangle", 0.028, 0, 160); }
        else if (kind === "spark") { a.noise?.(0.05, 0.014); a.tone?.(420, 0.05, "triangle", 0.018, 0, 120); }
        else if (kind === "hit") { a.tone?.(520, 0.05, "square", 0.03, 0, -120); a.haptic?.(12); }
        else if (kind === "deflect") { a.noise?.(0.06, 0.012); a.tone?.(200, 0.05, "triangle", 0.014, 0, -30); }
        else if (kind === "calmed") { a.tone?.(392, 0.08, "triangle", 0.03); a.tone?.(523, 0.12, "triangle", 0.026, 0.08); }
        else if (kind === "tuck") a.noise?.(0.09, 0.018);
        else if (kind === "hurt") { a.tone?.(150, 0.12, "square", 0.035, 0, -40); a.haptic?.([18, 30, 18]); }
        else if (kind === "bump") { a.noise?.(0.14, 0.03); a.haptic?.(20); }
        else if (kind === "notice") a.tone?.(880, 0.05, "sine", 0.02, 0, -200);
        else if (kind === "lock") a.tone?.(1200, 0.02, "square", 0.015);
        else if (kind === "lunge") a.noise?.(0.12, 0.022);
        else if (kind === "lane") a.tone?.(1500, 0.04, "sine", 0.012, 0, -300);
        else if (kind === "pulse") { a.tone?.(1900, 0.05, "square", 0.02, 0, -900); a.noise?.(0.05, 0.016); }
        else if (kind === "kindle") { a.tone?.(262, 0.2, "sine", 0.025, 0, 60); a.tone?.(330, 0.3, "sine", 0.02, 0.18, 40); }
        else if (kind === "rest") { a.tone?.(392, 0.18, "sine", 0.026); a.tone?.(494, 0.24, "sine", 0.022, 0.14); a.tone?.(587, 0.32, "sine", 0.02, 0.28); }
        else if (kind === "down") a.tone?.(220, 0.4, "sine", 0.03, 0, -110);
        else if (kind === "ui") a.tone?.(660, 0.03, "square", 0.018);
        else if (kind === "rain") a.noise?.(0.22, 0.004 + 0.006 * (geo().rain || 0));
        else if (kind === "car") { a.noise?.(0.6, 0.018); a.tone?.(70, 0.6, "sawtooth", 0.012, 0, -10); }
        else if (kind === "door") { a.tone?.(180, 0.08, "square", 0.02, 0, -40); a.noise?.(0.08, 0.02); }
        else if (kind === "chime") { a.tone?.(988, 0.14, "sine", 0.018); a.tone?.(784, 0.2, "sine", 0.016, 0.12); }
        else if (kind === "clunk") { a.tone?.(110, 0.1, "square", 0.03, 0, -30); a.noise?.(0.1, 0.03); a.haptic?.(25); }
        else if (kind === "crack") { a.noise?.(0.35, 0.03); a.tone?.(90, 0.4, "sawtooth", 0.02, 0, -50); }
        else if (kind === "click") { a.tone?.(1600, 0.025, "square", 0.022); a.tone?.(800, 0.03, "square", 0.018, 0.05); a.haptic?.(15); }
        else if (kind === "sweep") a.noise?.(0.3, 0.02);
        else if (kind === "porter") { a.tone?.(98, 0.3, "triangle", 0.03, 0, -20); }
      } catch (error) {}
    };
    const duck = (ms, level) => { try { host.audio.duck?.(ms, level); } catch (error) {} };

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
      if (sim) sim.flags = Core.flagsOf(data);
      log({ commit: outcome.status, reward: Boolean(reward) });
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
    const addBeat = (next, beat) => { if (!next.story.committedSceneBeats.includes(beat)) next.story.committedSceneBeats.push(beat); };
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
    const afterOverlay = () => (dialogueState ? "dialogue" : choiceState ? "choice" : scene && !scene.control ? "scene" : "play");

    // ===== PANELS (inside the device) =====
    const esc = View.esc;
    function openPanel(kind, markup) {
      panelKind = kind;
      if (ui !== "blocked" && ui !== "exiting") ui = "panel";
      input?.clear("panel");
      view.panel(markup);
    }
    function closePanel() {
      panelKind = "";
      view.panel(null);
      if (ui === "panel") ui = afterOverlay();
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
        fine: esc(Core.belowReached(data) ? "GO HOME saves the journey here. You'll come back to this spot." : "GO HOME saves. The night picks up from here next time.")
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

    // ===== DIALOGUE (DOM, unscaled, with a speaker portrait) =====
    const lineOf = item => (typeof item === "string" ? { speaker: null, expr: null, text: item } : item);
    function openDialogue(lines, onDone = null) {
      dialogueState = { lines: lines.map(lineOf), index: 0, startAt: now(), shown: 0, onDone };
      ui = "dialogue";
      input.clear("dialogue");
      pending = { primary: false, secondary: false };
      view.showPrompt(null);
      tickDialogue(now());
    }
    function tickDialogue(time) {
      if (!dialogueState) return;
      const line = dialogueState.lines[dialogueState.index];
      const instant = settings.textSpeed === "instant";
      dialogueState.shown = instant ? line.text.length : Math.min(line.text.length, Math.floor(((time - dialogueState.startAt) / 1000) * TEXT_CPS));
      view.dialogue(line.text.slice(0, dialogueState.shown), { done: dialogueState.shown >= line.text.length, speaker: line.speaker, expr: line.expr });
      if (line.speaker && npcs.has(line.speaker)) npcs.get(line.speaker).expr = line.expr;
    }
    // A fresh Primary press reveals the line, another advances it.
    function advanceDialogue() {
      const line = dialogueState.lines[dialogueState.index];
      if (dialogueState.shown < line.text.length) { dialogueState.startAt = -1e9; tickDialogue(now()); return; }
      dialogueState.index += 1;
      if (dialogueState.index >= dialogueState.lines.length) {
        const done = dialogueState.onDone;
        dialogueState = null;
        view.dialogue(null);
        ui = afterOverlay();
        input.clear("dialogue");
        pending = { primary: false, secondary: false };
        done?.();
        return;
      }
      dialogueState.startAt = now();
      tickDialogue(now());
      sound("ui");
    }

    // ===== CHOICE (D-pad + Primary, or tap) =====
    function openChoice(options, onPick) {
      choiceState = { options, index: 0, onPick, lastDir: 0 };
      ui = "choice";
      input.clear("choice");
      pending = { primary: false, secondary: false };
      view.choice(options, 0);
    }
    function moveChoice(dir) {
      if (!choiceState) return;
      choiceState.index = (choiceState.index + dir + choiceState.options.length) % choiceState.options.length;
      view.choice(choiceState.options, choiceState.index);
      sound("ui");
    }
    function pickChoice(index = choiceState?.index) {
      if (!choiceState) return;
      const { options, onPick } = choiceState;
      choiceState = null;
      view.choice(null);
      ui = afterOverlay();
      input.clear("choice");
      pending = { primary: false, secondary: false };
      sound("ui");
      onPick(options[index].value);
    }

    // ===== SCENES =====
    // Scenes run on their own clock, which stands still under any hold.
    // Without `control` the simulation is paused; with it the Rizo moves
    // while the scene continues (the hoods closing in, the van).
    function runScene(id, steps, { control = false, onDone = null } = {}) {
      scene = { id, steps, index: 0, waiting: null, until: 0, pred: null, control, onDone };
      log({ scene: id });
      if (!control) { ui = "scene"; input.clear("scene"); pending = { primary: false, secondary: false }; }
      advanceScene();
    }
    function endScene() {
      const done = scene?.onDone;
      scene = null;
      if (ui === "scene") { ui = "play"; input.clear("scene"); pending = { primary: false, secondary: false }; }
      done?.();
    }
    function advanceScene() {
      while (scene && !scene.waiting) {
        const current = scene;
        const step = current.steps[current.index];
        current.index += 1;
        if (!step) { endScene(); return; }
        switch (step.type) {
          case "say": current.waiting = "dialogue"; openDialogue(step.lines, () => { if (scene === current) { current.waiting = null; advanceScene(); } }); break;
          case "wait": current.waiting = "time"; current.until = sceneTime + step.ms; break;
          case "until": current.waiting = "pred"; current.pred = step.pred; break;
          case "call": step.fn(); break;
          case "move": {
            const actor = npcs.get(step.id);
            if (actor) { actor.fromX = actor.x; actor.fromY = actor.y; actor.toX = step.x; actor.toY = step.y; actor.moveStart = sceneTime; actor.moveMs = Math.max(1, step.ms); actor.face = step.x < actor.x ? -1 : 1; }
            if (step.wait) { current.waiting = "time"; current.until = sceneTime + step.ms; }
            break;
          }
          case "pose": setPose(step.name, step.ms); break;
          case "fade": sceneFade = { value: sceneFade.value, from: sceneFade.value, to: step.to, start: sceneTime, ms: Math.max(1, step.ms) }; current.waiting = "time"; current.until = sceneTime + step.ms; break;
          case "control":
            current.control = step.on;
            // Handing control back keeps a held direction (he gets up and walks);
            // taking it away clears input so nothing leaks into the scene.
            if (step.on && ui === "scene") { ui = "play"; pending = { primary: false, secondary: false }; }
            else if (!step.on && ui === "play") { ui = "scene"; input.clear("scene"); pending = { primary: false, secondary: false }; }
            break;
          case "choice": current.waiting = "choice"; openChoice(step.options, value => { if (scene === current) { current.choice = value; step.onPick?.(value); current.waiting = null; advanceScene(); } }); break;
          case "bark": bark(step.id, step.line, step.ms); break;
          default: break;
        }
        if (scene !== current) return;
      }
    }
    function tickScene() {
      if (!scene) return;
      if (scene.waiting === "time" && sceneTime >= scene.until) { scene.waiting = null; advanceScene(); }
      else if (scene.waiting === "pred" && scene.pred()) { scene.waiting = null; scene.pred = null; advanceScene(); }
    }
    function bark(id, line, ms) {
      const item = lineOf(line);
      barks = barks.filter(entry => entry.id !== id);
      barks.push({ id, text: item.text, speaker: item.speaker, until: sceneTime + ms });
    }
    function setPose(name, ms) { poseOverride = name ? { name, until: sceneTime + (ms || 900) } : null; }

    // ===== NPC ACTORS (presentation only; the simulation never reads them) =====
    function npc(id, kind, x, y, extra = {}) {
      const actor = { id, kind, x, y, fromX: x, fromY: y, toX: x, toY: y, moveStart: 0, moveMs: 0, face: -1, expr: null, visible: true, state: "idle", ...extra };
      npcs.set(id, actor);
      return actor;
    }
    function tickNpcs(dt) {
      for (const actor of npcs.values()) {
        if (actor.moveMs > 0) {
          const k = clamp((sceneTime - actor.moveStart) / actor.moveMs, 0, 1);
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          actor.x = actor.fromX + (actor.toX - actor.fromX) * ease;
          actor.y = actor.fromY + (actor.toY - actor.fromY) * ease;
          actor.walking = k < 1;
          if (k >= 1) actor.moveMs = 0;
        } else actor.walking = false;
        if (actor.state === "chase" && sim && sceneTime >= (actor.flinchUntil || 0)) {
          const dx = sim.player.x - actor.x, dy = sim.player.y - actor.y, distance = Math.hypot(dx, dy);
          const speed = actor.speed || 30;
          if (distance > 10) { actor.x += (dx / distance) * speed * dt; actor.y += (dy / distance) * speed * dt; actor.walking = true; actor.face = dx < 0 ? -1 : 1; }
        }
      }
      barks = barks.filter(entry => entry.until > sceneTime);
    }

    // ===== ROOMS =====
    function enterSim(roomId, anchorId, flame) {
      sim = sim ? Core.enterRoom(sim, { roomId, anchorId, flame }) : Core.createSim({ roomId, anchorId, flame, edges: data.legProfile.edges, assist: settings.assist, flags: flags(), defeated: data.world.defeatedEncounters });
      sim.flags = flags();
      sim.hearthLit = data.checkpoint.hearthId === Core.room(roomId).hearth?.id;
      prev = { x: sim.player.x, y: sim.player.y };
      view.camera.ready = false;
      npcs = new Map(); barks = []; room = {};
      view.setRoomName(Content.ROOMS[roomId].name);
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
    }
    // Moves to another room and commits the new safe continuation there.
    function goToRoom(roomId, anchorId, { resumeKind = Content.isOpening(roomId) ? "opening" : "room-entry", context = "walk" } = {}) {
      enterSim(roomId, anchorId);
      const outcome = commitData(next => {
        if (!next.world.visitedRooms.includes(roomId)) next.world.visitedRooms.push(roomId);
        setContinuation(next, roomId, anchorId, sim.player.flame, roomId === "porter" && !fact("porterDown") ? "boss" : resumeKind);
      });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
      onEnterRoom(roomId, context);
    }
    function onEnterRoom(roomId, context) {
      shell = Content.isOpening(roomId) ? "open" : "locked";
      view.setShell(shell);
      try { host.audio.music?.(Content.isOpening(roomId) ? STREET_TRACK : DUNGEON_TRACK); } catch (error) {}
      const enter = ROOM_LOGIC[roomId]?.enter;
      if (enter) enter(context);
      showResumeAck();
    }
    // A committed beat whose scene was interrupted is acknowledged, never re-applied.
    function showResumeAck() {
      const pendingAck = data.story.resumeScene;
      if (!pendingAck || scene || dialogueState) return;
      const lines = Content.ACKS[pendingAck.id];
      commitData(next => { next.story.resumeScene = null; });
      if (lines && npcs.has("latch")) openDialogue(lines);
    }
    const setResume = (next, id, beatId) => { next.story.resumeScene = { id, beatId }; };
    const clearResume = () => { if (data.story.resumeScene) { data = plain(data); data.story.resumeScene = null; dirty = true; } };

    // The opening and every Threshold room, by stable id.
    const ROOM_LOGIC = {
      // ---- Beat 1–2: outside the late store
      curb: {
        enter() {
          npc("keeper", "keeper", 204, 140, { face: -1 });
          npc("van", "van", 470, 268, { visible: false });
          room.doorOpen = false;
          room.openedAt = sceneTime;
          runScene("opening:be-good", [
            S.pose("look-up", 1600),
            S.wait(500),
            S.say(L.beGood),
            S.pose("hop", 700),
            S.call(() => { npcs.get("keeper").face = -1; }),
            S.move("keeper", 176, 104, 1100),
            S.call(() => { room.doorOpen = true; sound("chime"); }),
            S.wait(250),
            S.call(() => { npcs.get("keeper").visible = false; }),
            S.wait(350),
            S.call(() => { room.doorOpen = false; room.alone = sceneTime; }),
            S.control(true),
            S.call(() => view.pulseKey("dpad")),
            // Movement teaches movement. Something comes for him after a while.
            S.until(() => sceneTime - room.alone > 16000 || (room.looked >= 1 && sceneTime - room.alone > 9000) || (room.looked >= 2 && sceneTime - room.alone > 5000)),
            S.call(() => { const van = npcs.get("van"); van.visible = true; sound("car"); room.carLights = true; }),
            S.move("van", 252, 268, 1600),
            S.wait(400),
            S.call(() => {
              npc("hood-tall", "hood-tall", 232, 252, { state: "chase", speed: 26, face: -1 });
              npc("hood-small", "hood-small", 262, 256, { state: "chase", speed: 30, face: -1 });
              npc("hood-cap", "hood-cap", 290, 250, { state: "chase", speed: 22, face: -1 });
              room.hoodsAt = sceneTime;
            }),
            S.bark("hood-small", L.thatHim[0]),
            S.wait(1400),
            S.bark("hood-tall", L.thatHim[1]),
            S.until(() => nearestHood() < 16 || sceneTime - room.hoodsAt > 9500),
            S.control(false),
            S.call(() => { const hood = nearestHoodActor(); if (hood) { hood.state = "grab"; hood.x = sim.player.x + 10; hood.y = sim.player.y - 4; } }),
            S.pose("recoil", 900),
            S.wait(450),
            S.fade(1, 320),
            S.call(() => commitBeat("opening:taken")),
            S.call(() => goToRoom("van", "start", { context: "taken" }))
          ]);
        }
      },
      // ---- Beat 3: inside the van
      van: {
        enter() {
          room.rumble = true;
          npc("driver", "driver-seat", 70, 20, { face: 1 });
          npc("hood-tall", "passenger-seat", 160, 20, { face: -1 });
          room.cargoCount = 0;
          runScene("opening:van", [
            S.fade(0, 400),
            S.pose("recoil", 1200),
            S.wait(700),
            S.say(L.vanArgue),
            S.control(true),
            S.until(() => sceneTime - (room.controlAt ||= sceneTime) > 4500 || room.looked >= 1),
            S.wait(1200),
            S.call(() => vanBump()),
            S.until(() => room.cargoResolved),
            S.wait(900),
            S.call(() => { if (!room.dodged) { room.cargoResolved = false; vanBump(); } }),
            S.until(() => room.cargoResolved),
            S.wait(900),
            S.call(() => { sim.flags = { ...sim.flags, vanDoorLoose: true }; room.doorLoose = true; sound("door"); room.shake = sceneTime; room.looseAt = sceneTime; }),
            S.until(() => sim.zones.includes("van-door-zone") || sceneTime - room.looseAt > 9000),
            S.control(false),
            S.call(() => { sim.player.x = 204; sim.player.y = 96; prev = { x: 204, y: 96 }; }),
            S.pose("hesitate", 900),
            S.wait(900),
            S.call(() => { room.shake = sceneTime; room.doorOpen = true; sound("crack"); }),
            S.pose("fall", 700),
            S.wait(380),
            S.fade(1, 260),
            S.call(() => commitBeat("opening:fell")),
            S.call(() => goToRoom("roadside", "fallen", { context: "fell" }))
          ]);
        }
      },
      // ---- Beat 4–5: alone by the road, the lonely walk
      roadside: {
        enter(context) {
          room.rain = 1;
          if (context === "back") { runScene("roadside:back", [S.fade(0, 300)]); return; }
          npc("taillights", "taillights", 250, 1180, {});
          runScene("opening:separation", [
            S.fade(1, 1),
            S.call(() => { room.blackRain = true; }),
            S.wait(1300),
            S.call(() => { npcs.get("taillights").moveStart = sceneTime; npcs.get("taillights").fromX = 250; npcs.get("taillights").fromY = 1180; npcs.get("taillights").toX = 250; npcs.get("taillights").toY = 760; npcs.get("taillights").moveMs = 3400; }),
            S.pose("lying", 99999),
            S.fade(0, 1400),
            S.wait(900),
            // He gets up when the player asks him to.
            S.until(() => lastMove.x || lastMove.y),
            S.pose("getup", 700),
            S.wait(650),
            S.call(() => { poseOverride = null; npcs.delete("taillights"); room.walkStart = sceneTime; }),
            S.control(true)
          ]);
        }
      },
      // ---- Beat 6: shelter
      drain: {
        enter() {
          room.rain = 0.2;
          runScene("opening:shelter", [
            S.fade(0, 300),
            S.pose("shake", 900),
            S.wait(900),
            S.pose("settle", 700),
            S.call(() => { room.warm = sceneTime; })
          ]);
        }
      },
      // ---- The Threshold
      slip: {
        enter(context) {
          if (context !== "landed") return;
          runScene("opening:landed", [
            S.call(() => { sceneFade = { value: 1, from: 1, to: 0, start: sceneTime, ms: 300 }; try { host.audio.duck?.(1600, 0.02); } catch (error) {} }),
            S.pose("land", 500),
            S.wait(500),
            S.pose("look-up", 1500),
            S.call(() => { room.peekUntil = sceneTime + 1600; showBanner(L.homeUp); }),
            S.wait(700)
          ]);
        }
      },
      clatter: { enter() {} },
      hem: {
        enter() {
          if (!fact("latchFreed")) npc("latch", "latch", 190, 232, { face: -1, pinned: true });
        }
      },
      hearth: {
        enter() {
          if (fact("latchFreed") && !fact("porterHelp")) npc("latch", "latch", 130, 196, { face: 1, seated: true });
        }
      },
      queue: { enter() {} },
      porter: {
        enter() {
          if (fact("porterHelp")) npc("latch", "latch", fact("porterDown") ? 150 : 22, fact("porterDown") ? 60 : 142, { face: 1 });
          if (fact("porterDown") && !data.story.resumeScene) bark("latch", L.departure[0], 2600);
        }
      }
    };
    function nearestHoodActor() {
      let best = null, bestDistance = Infinity;
      for (const actor of npcs.values()) {
        if (!actor.kind.startsWith("hood")) continue;
        const distance = Math.hypot(actor.x - sim.player.x, actor.y - sim.player.y);
        if (distance < bestDistance) { best = actor; bestDistance = distance; }
      }
      return best;
    }
    const nearestHood = () => { const hood = nearestHoodActor(); return hood ? Math.hypot(hood.x - sim.player.x, hood.y - sim.player.y) : Infinity; };
    // The bump that teaches Tuck: a readable line, a pulsing key, no harm.
    function vanBump() {
      room.cargoCount += 1;
      room.shake = sceneTime;
      sound("bump");
      bark("driver", L.bump[0], 1600);
      const y = clamp(sim.player.y, 56, 126);
      Core.spawnCargo(sim, { id: `cooler-${room.cargoCount}`, x: 26, y, aimX: 1, aimY: 0 });
      view.pulseKey("secondary");
    }
    function commitBeat(beat) {
      const outcome = commitData(next => addBeat(next, beat));
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    // ---- Beat 7: the ground gives way; the handheld locks around the world.
    function fallBelow() {
      if (room.falling) return;
      room.falling = true;
      runScene("opening:fall", [
        S.call(() => { room.crack = sceneTime; sound("crack"); room.shake = sceneTime; }),
        S.pose("fall", 1200),
        S.wait(320),
        S.fade(1, 380),
        S.call(() => {
          // Commit first: the journey is below from here on.
          const outcome = commitData(next => {
            addBeat(next, "opening:below");
            if (!next.world.visitedRooms.includes("slip")) next.world.visitedRooms.push("slip");
            setContinuation(next, "slip", "landing", Core.T.FLAME_MAX, "room-entry");
          });
          if (outcome.status === "failed") renderSaveFailedPanel("moment");
          shell = "locking";
          view.setShell("locking");
          setTimeout(() => sound("click"), reducedMotion() ? 60 : 380);
          try { host.event("sceneCommitted", { boundaryId: "opening-below", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
        }),
        S.wait(reducedMotion() ? 160 : SHELL_LOCK_MS),
        S.call(() => { enterSim("slip", "landing", Core.T.FLAME_MAX); onEnterRoom("slip", "landed"); }),
        S.fade(0, 300)
      ]);
    }

    // ===== STORY BEATS (commit first, then present) =====
    function inspect(id, kind) {
      const prop = geo().props.find(item => item.id === id);
      if (!prop) return;
      room.looked = (room.looked || 0) + 1;
      if (!data.journal.discoveredEntryIds.includes(id)) { data = plain(data); data.journal.discoveredEntryIds.push(id); dirty = true; }
      if (kind === "npc") return talkToLatch();
      if (kind === "bowl") return coldBowl();
      if (kind === "lever") return pullLever();
      if (id === "bowl-road") setPose("approach-stop", 1100);
      openDialogue(prop.lines);
    }
    function talkToLatch() {
      if (sim.roomId === "hem") {
        if (!fact("jamInspected")) commitData(next => { next.story.facts.jamInspected = true; next.npcs.latch.state = "trapped"; });
        openDialogue(L.latchJam);
      } else openDialogue(L.latchHearthIdle);
    }
    function rescueLatch() {
      if (fact("latchFreed")) return;
      const stranger = !fact("jamInspected");
      const outcome = commitData(next => {
        next.world.durableRoomFlags.latchFreed = true;
        next.npcs.latch = { state: "waiting-hearth", locationAnchor: "hearth-latch", evidence: [...new Set([...(next.npcs.latch.evidence || []), "rescue"])] };
        addBeat(next, "latch-rescue:freed");
        setResume(next, "latch-rescue", "lines");
      });
      if (outcome.status === "failed") { renderSaveFailedPanel("moment"); }
      try { host.event("sceneCommitted", { boundaryId: "latch-rescue", campaignId: data.campaign.id, tone: "quiet", interruption: "none" }); } catch (error) {}
      sound("clunk");
      const latch = npcs.get("latch");
      if (latch) { latch.pinned = false; latch.expr = "startled"; }
      runScene("latch-rescue", [
        S.wait(350),
        S.say(stranger ? L.latchRescueStranger : L.latchRescue),
        S.call(() => clearResume()),
        S.move("latch", 300, 116, 1400, false),
        S.wait(600)
      ], { onDone: () => { npcs.delete("latch"); } });
    }
    function hearthArrival() {
      if (data.checkpoint.hearthId !== geo().hearth.id) registerHearth(geo().hearth.id);
      if (!fact("latchFreed") || fact("seatChosen") || scene) return;
      runScene("hearth-seat", [
        S.say(L.seatOffer),
        S.choice("hearth-seat", [{ label: "SIT", value: "sit" }, { label: "GO", value: "go" }]),
        S.call(() => {})
      ]);
      // The choice is committed before either reaction is shown.
      const current = scene;
      const pickStep = current.steps.find(step => step.type === "choice");
      pickStep.onPick = value => {
        const outcome = commitData(next => {
          next.story.choices["hearth-seat"] = value;
          next.story.facts.seatChosen = true;
          if (value === "sit") next.story.facts.sharedRest = true;
          addBeat(next, `hearth-seat:${value}`);
          setResume(next, "hearth-seat", value);
        });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        try { host.event("sceneCommitted", { boundaryId: `hearth-seat-${value}`, campaignId: data.campaign.id, tone: "quiet", interruption: "none" }); } catch (error) {}
        const rest = value === "sit"
          ? [S.call(() => { room.seatFrom = { x: sim.player.x, y: sim.player.y }; room.seatAt = sceneTime; }), S.until(() => seatWalk()), S.pose("settle", 1800), S.say(L.sit), S.wait(900)]
          : [S.say(L.go)];
        current.steps.push(...rest, S.say(L.beforePorter), S.call(() => { commitData(next => { next.story.facts.beforePorterSaid = true; next.story.resumeScene = null; }); }));
      };
    }
    // SIT: the Rizo crosses to the bench beside Latch (presentation, then settles).
    function seatWalk() {
      const target = geo().anchors["hearth-seat"];
      const k = clamp((sceneTime - room.seatAt) / 700, 0, 1);
      sim.player.x = room.seatFrom.x + (target.x - room.seatFrom.x) * k;
      sim.player.y = room.seatFrom.y + (target.y - room.seatFrom.y) * k;
      sim.player.fx = -1; sim.player.fy = 0;
      prev = { x: sim.player.x, y: sim.player.y };
      return k >= 1;
    }
    function coldBowl() {
      if (!fact("bowlSeen")) {
        const outcome = commitData(next => { next.story.facts.bowlSeen = true; addBeat(next, "cold-bowl:seen"); });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
      }
      duck(3200, 0.04);
      runScene("cold-bowl", [
        S.pose("approach-stop", 1300),
        S.wait(1300),
        S.say(L.bowl),
        S.pose("look-back", 1400),
        S.wait(1100)
      ]);
    }
    function pullLever() {
      if (fact("shortcutOpen")) return;
      const outcome = commitData(next => {
        next.world.durableRoomFlags.shortcutOpen = true;
        if (!next.world.openedShortcuts.includes("hearth-queue")) next.world.openedShortcuts.push("hearth-queue");
        addBeat(next, "queue-lever:pulled");
      });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
      sound("clunk");
      room.shake = sceneTime;
      showBanner(L.shortcutOpen);
    }
    // Half health: hazards stop, the help is committed, then shown.
    function porterHelp() {
      if (fact("porterHelp")) return;
      input.clear("help");
      pending = { primary: false, secondary: false };
      const outcome = commitData(next => {
        next.story.facts.porterHelp = true;
        next.world.durableRoomFlags.alcoveOpen = true;
        next.npcs.latch = { state: "helping", locationAnchor: "porter-hatch", evidence: [...new Set([...(next.npcs.latch.evidence || []), "porter-help"])] };
        addBeat(next, "porter-help:granted");
        setResume(next, "porter-help", "lines");
      });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
      try { host.event("sceneCommitted", { boundaryId: "porter-help", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
      npc("latch", "latch", 22, 142, { face: 1, expr: "urgent", pulling: true });
      sim.flags = { ...sim.flags, alcoveOpen: false };
      runScene("porter-help", [
        S.pose("look-back", 1400),
        S.wait(600),
        S.call(() => { sound("clunk"); room.shake = sceneTime; sim.flags = flags(); npcs.get("latch").pulling = false; }),
        S.wait(500),
        S.say(L.help),
        S.call(() => clearResume())
      ]);
    }
    // The Porter settles. Reward and completion are committed before the gift scene.
    function porterDown() {
      const sharedRest = fact("sharedRest");
      const next = plain(data);
      next.world.durableRoomFlags.porterDown = true;
      if (!next.world.defeatedEncounters.includes("night-porter")) next.world.defeatedEncounters.push("night-porter");
      next.proofComplete = true;
      next.storyComplete = false;
      next.campaign.status = "homecoming-ready";
      next.npcs.latch = { state: "gifted", locationAnchor: "porter-door", evidence: [...new Set([...(next.npcs.latch.evidence || []), "knot"])] };
      addBeat(next, "knot-gift:granted");
      setResume(next, "knot-gift", "lines");
      setContinuation(next, "porter", "porter-entry", Core.T.FLAME_MAX, "boss");
      const reward = { receiptId: `${next.campaign.id}:threshold-complete`, petId: next.campaign.petId, entitlements: sharedRest ? ["first-knot", "shared-hearth"] : ["first-knot"] };
      const withPending = { ...next, pendingRewards: [{ receiptId: reward.receiptId, entitlements: reward.entitlements }] };
      const outcome = commit(sliceWithSettings({ ...next, pendingRewards: [] }), reward);
      if (outcome.status !== "committed") {
        data = withPending;
        pendingGift = true;
        renderSaveFailedPanel("moment");
        return;
      }
      giftScene();
    }
    function giftScene() {
      pendingGift = null;
      try { host.event("chapterComplete", { boundaryId: "threshold-complete", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
      if (!npcs.has("latch")) npc("latch", "latch", 22, 142, { face: 1 });
      runScene("knot-gift", [
        S.wait(700),
        S.move("latch", clamp(sim.player.x - 22, 50, 300), clamp(sim.player.y, 50, 220), 1100),
        S.say(L.gift),
        S.call(() => { showBanner("FIRST KNOT"); room.knotShown = sceneTime; sound("rest"); }),
        S.pose("settle", 1200),
        S.wait(1000),
        S.say(L.departure),
        S.call(() => { clearResume(); sim.flags = flags(); room.shake = sceneTime; sound("door"); })
      ]);
    }

    // ===== SIMULATION EVENTS =====
    function handleEvents(events) {
      for (const event of events) {
        switch (event.type) {
          case "flare": sound(Content.isOpening(sim.roomId) ? "spark" : "flare"); cue.flare = true; flinchHoods(); break;
          case "tuck": sound("tuck"); cue.tuck = true; view.addEffect("puff", sim.player.x, sim.player.y + 4, 1); break;
          case "hit": { sound("hit"); const enemy = sim.enemies.find(item => item.id === event.id); if (enemy) view.addEffect("spark", enemy.x, enemy.y, 4); break; }
          case "deflect": { sound("deflect"); const enemy = sim.enemies.find(item => item.id === event.id); if (enemy) view.addEffect("deflect", enemy.x, enemy.y + 8, 1); break; }
          case "calmed":
            sound("calmed");
            try { host.event("encounterResolved", { boundaryId: event.id, campaignId: data.campaign.id, tone: "quiet", interruption: "none" }); } catch (error) {}
            break;
          case "hurt": sound("hurt"); view.setFlame(sim.player.flame, Core.T.FLAME_MAX); break;
          case "bump": sound("bump"); room.bumped = true; break;
          case "cargo-done": room.cargoResolved = true; room.dodged = room.dodged || event.dodged; break;
          case "notice": sound("notice"); if (!cue.noticed) view.pulseKey("primary"); cue.noticed = true; break;
          case "lock": sound("lock"); break;
          case "lunge": case "slide": sound("lunge"); break;
          case "lane": sound("lane"); break;
          case "pulse": sound("pulse"); break;
          case "porter-wake": sound("porter"); break;
          case "sweep": sound("sweep"); break;
          case "charge": sound("lunge"); break;
          case "porter-half": porterHelp(); break;
          case "porter-down": sound("calmed"); porterDown(); break;
          case "kindle-start": sound("kindle"); break;
          case "kindle-cancel": break;
          case "kindled": if (event.targetKind === "warm") rescueLatch(); else restAtHearth(event.hearthId); break;
          case "hearth-near": if (data.checkpoint.hearthId !== event.hearthId) registerHearth(event.hearthId); break;
          case "zone": onZone(event.id); break;
          case "exit": onExit(event); break;
          case "leash": setPose("look-back", 900); break;
          case "interact": inspect(event.id, event.kind); break;
          case "down": sound("down"); input.clear("down"); pending = { primary: false, secondary: false }; break;
          case "respawn-ready": respawnAfterDown(); break;
          default: break;
        }
        if (ui !== "play") break;
      }
    }
    function flinchHoods() {
      for (const actor of npcs.values()) {
        if (!actor.kind.startsWith("hood") || actor.state !== "chase") continue;
        const dx = actor.x - sim.player.x, dy = actor.y - sim.player.y, distance = Math.hypot(dx, dy);
        if (distance > 46 || (dx * sim.player.fx + dy * sim.player.fy) / Math.max(1, distance) < 0.2) continue;
        actor.flinchUntil = sceneTime + 700;
        actor.x += (dx / Math.max(1, distance)) * 10; actor.y += (dy / Math.max(1, distance)) * 6;
        if (!room.flinched) { room.flinched = true; bark(actor.id, L.flinch[0], 1200); }
      }
    }
    function onZone(id) {
      if (id === "deep" && sim.roomId === "drain") fallBelow();
      else if (id === "latch-approach" && !fact("latchFreed") && !room.approached) {
        room.approached = true;
        runScene("latch-approach", [S.say(L.latchApproach)]);
      } else if (id === "hearth-arrival") hearthArrival();
      else if (id === "bowl-near" && !room.bowlLooked) { room.bowlLooked = true; setPose("approach-stop", 1100); }
    }
    function onExit(event) {
      if (event.to === "home") { homecoming(); return; }
      const context = sim.roomId === "drain" && event.to === "roadside" ? "back" : "walk";
      runScene(`walk:${event.to}`, [S.fade(1, 140), S.call(() => goToRoom(event.to, event.anchor, { context })), S.fade(0, 180)]);
    }
    function registerHearth(hearthId) {
      if (data.checkpoint.hearthId === hearthId) return;
      const hearth = geo().hearth;
      sim.player.flame = Core.T.FLAME_MAX;
      sim.hearthLit = true;
      view.setFlame(sim.player.flame, Core.T.FLAME_MAX);
      const outcome = commitData(next => {
        next.checkpoint = { hearthId, roomId: sim.roomId, spawnAnchorId: hearth.spawnAnchorId };
        next.story.facts.hearthArrived = true;
        addBeat(next, "hearth-arrival:registered");
        setContinuation(next, sim.roomId, hearth.spawnAnchorId, Core.T.FLAME_MAX, "hearth");
      });
      if (outcome.status === "committed") { showBanner(L.hearthKnows); try { host.event("checkpointRest", { boundaryId: hearthId, campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {} }
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
      setPose("settle", 1400);
      if (outcome.status === "committed") {
        sound("rest");
        showBanner(L.rested);
        try { host.event("checkpointRest", { boundaryId: hearthId, campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
      } else if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function respawnAfterDown() {
      const target = Core.safeReturn(data);
      sim = Core.respawn(sim, { roomId: target.roomId, anchorId: target.anchorId });
      sim.flags = flags();
      deaths += 1;
      enterSim(target.roomId, target.anchorId, Core.T.FLAME_MAX);
      input.clear("respawn");
      pending = { primary: false, secondary: false };
      const outcome = commitData(next => setContinuation(next, target.roomId, target.anchorId, Core.T.FLAME_MAX, "respawn"));
      onEnterRoom(target.roomId, "respawn");
      showBanner(target.resumeKind === "hearth" ? (deaths === 1 ? L.firstDown : L.rested) : L.downNoHearth);
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function showBanner(text) { view.banner(text); bannerUntil = now() + 2400; }

    // ===== THE LOOP =====
    function frame(time) {
      if (stopped) return;
      rafId = root.requestAnimationFrame(frame);
      const dt = Math.max(0, time - lastFrame);
      lastFrame = time;
      const edges = input.consume();
      lastMove = { x: edges.moveX || edges.dirX, y: edges.moveY || edges.dirY };
      view.setKeys(input.view());
      if (exitState) { view.layout(); if (time >= exitState.at) finishExit(); return; }
      if (shell === "locking") view.layout();

      // A press belongs to whatever had the input when it happened: the menu,
      // a dialogue line, a choice, or play. The press that closes a line never Flares.
      const playHadInput = ui === "play" && holds.length === 0;
      if (edges.systemPressed) {
        if (ui === "panel" && panelKind === "pause") playerResume();
        else if (ui === "play" || ui === "dialogue" || ui === "scene" || ui === "choice") { addHold("manual"); renderPausePanel(); }
      }
      if (holds.length === 0 && !exitState) {
        sceneTime += Math.min(dt, 100);
        tickNpcs(Math.min(dt, 100) / 1000);
        tickScene();
        if (sceneFade.ms) { const k = clamp((sceneTime - sceneFade.start) / sceneFade.ms, 0, 1); sceneFade.value = sceneFade.from + (sceneFade.to - sceneFade.from) * k; if (k >= 1) sceneFade.ms = 0; }
        if (poseOverride && sceneTime > poseOverride.until) poseOverride = null;
        if (pendingGift === "ready") giftScene();
      }
      if (ui === "dialogue" && holds.length === 0) {
        if (edges.primaryPressed) advanceDialogue();
        else tickDialogue(time);
      } else if (ui === "choice" && holds.length === 0 && choiceState) {
        const tap = Math.sign(edges.dirX || edges.dirY);
        const dir = Math.sign(edges.moveX || edges.moveY);
        if (tap) moveChoice(tap);
        else if (dir && dir !== choiceState.lastDir) moveChoice(dir);
        if (choiceState) choiceState.lastDir = tap || dir;
        if (edges.primaryPressed) pickChoice();
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
      ambient(time, dt);
      draw(time, dt);
    }
    // Small presentation-only life: rain sound, shivering, shaking off water.
    function ambient(time, dt) {
      if (!sim || holds.length) return;
      const g = geo();
      const p = sim.player;
      const sheltered = (g.shelters || []).some(rect => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h);
      const rain = g.world ? (sheltered ? 0.1 : (g.rain || 0)) : 0;
      room.inRain = rain > 0.3;
      if (g.world && time - rainTickAt > 260 && !reducedMotion()) { rainTickAt = time; if (rain > 0.05 || room.blackRain) sound("rain"); }
      stillFor = p.moving ? 0 : stillFor + dt;
      if (sheltered && !room.wasSheltered && g.world && sim.roomId !== "drain") setPose("shake", 800);
      room.wasSheltered = sheltered;
    }
    function draw(time, dt) {
      if (!sim) return;
      const alpha = Math.max(0, Math.min(1, acc / Core.STEP_MS));
      const pos = { x: prev.x + (sim.player.x - prev.x) * alpha, y: prev.y + (sim.player.y - prev.y) * alpha };
      const g = geo();
      view.render(sim, pos, time, dt / 1000, {
        npcs: [...npcs.values()].filter(actor => actor.visible),
        barks,
        sceneTime,
        room,
        peek: room.peekUntil && sceneTime < room.peekUntil ? g.homeSign : null,
        shake: room.shake && sceneTime - room.shake < 260 ? 1 - (sceneTime - room.shake) / 260 : 0
      });
      const p = sim.player;
      if (p.fx < -0.1) facingLeft = true; else if (p.fx > 0.1) facingLeft = false;
      const act = p.act?.kind || "";
      const hurt = sim.t < p.hurtUntil;
      const automatic = !poseOverride && g.world && room.inRain && stillFor > 1300 ? "shiver" : !poseOverride && p.leashed ? "look-back" : "";
      view.setPose([
        facingLeft ? "facing-left" : "facing-right",
        p.moving ? "is-moving" : "is-still",
        act === "flare" ? (g.world ? "is-spark" : "is-flare") : "", act === "tuck" ? "is-tuck" : "", act === "kindle" ? "is-kindle" : "",
        hurt ? "is-hurt" : "", sim.phase !== "play" ? "is-down" : "", holds.length ? "is-held" : "",
        poseOverride ? `pose-${poseOverride.name}` : automatic ? `pose-${automatic}` : "",
        g.world ? "is-wet" : "", room.warm ? "is-warm" : ""
      ].filter(Boolean).join(" "));
      const downFade = sim.phase === "down" ? Math.min(0.85, (sim.t - (sim.downUntil - Core.T.DOWN_MS)) / Core.T.DOWN_MS) : 0;
      view.setFade(Math.max(downFade, sceneFade.value));
      // The highlighted thing Primary would use, and the key label that says so.
      const target = ui === "play" ? Core.focusTarget(sim) : null;
      view.showPrompt(target, target ? `◆ ${target.prompt}` : null);
      view.setActionLabel(target ? target.prompt : ui === "dialogue" ? "NEXT" : ui === "choice" ? "PICK" : g.world ? "FLAME" : "FLARE");
      if (bannerUntil && time > bannerUntil) { view.banner(""); bannerUntil = 0; }
      // Control hints are physical and brief: keys wake, nothing explains.
      if (!g.world && cue.noticed && Core.encounterActive(sim) && (!cue.flare || !cue.tuck)) view.showCue(`<span class="${cue.flare ? "done" : ""}"><i class="cue-primary"></i>FLARE <kbd>Z</kbd></span><span class="${cue.tuck ? "done" : ""}"><i class="cue-secondary"></i>TUCK <kbd>X</kbd></span>`);
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
    // Where a saved journey resumes. Opening rooms restart their own scene.
    function resumeJourney(fromMigration) {
      let cont = data.continuation;
      if (data.proofComplete && data.campaign.status === "homecoming-ready") cont = { roomId: "porter", safeAnchorId: "porter-entry", roomEntryFlame: Core.T.FLAME_MAX };
      const opening = Content.isOpening(cont.roomId);
      const roomId = opening ? (beats().includes("opening:fell") ? (cont.roomId === "drain" ? "drain" : "roadside") : beats().includes("opening:taken") ? "van" : "curb") : cont.roomId;
      const anchorId = opening ? Content.ROOMS[roomId].entryAnchor : cont.safeAnchorId;
      enterSim(roomId, anchorId, cont.roomEntryFlame);
      retryPendingRewards();
      const outcome = commitData(next => {
        next.legProfile = Core.legProfile(pet);
        setContinuation(next, roomId, anchorId, cont.roomEntryFlame, opening ? "opening" : cont.resumeKind || "room-entry");
      });
      if (outcome.status === "failed" || (fromMigration && outcome.status !== "committed")) renderSaveFailedPanel("moment");
      onEnterRoom(roomId, opening && roomId === "roadside" ? "fell" : "resume");
    }
    // A start that throws must not leave the page locked: the host only
    // unmounts on a failed launch, so the mode releases itself here.
    function start(options = {}) {
      try { startMode(options); } catch (error) { try { stop(); } catch (stopError) {} throw error; }
    }
    function startMode(options = {}) {
      stage = host.mount({ kicker: "RIZO DUNGEON", title: "THE THRESHOLD", timer: "", score: "", hint: "", quit: "GO HOME" });
      stage.root.classList.add("dungeon-active");
      if (reducedMotion()) stage.root.classList.add("dungeon-reduced-motion");
      releasePage = createPageLock(stage.root);
      view = View.create({ arena: stage.arena, host, reducedMotion: reducedMotion() });
      input = Input.create({ device: view.el.device, screen: view.el.screen, dpad: view.el.dpad, keys: view.el.keys });
      input.bind();
      view.el.panel.addEventListener("click", onPanelClick);
      view.el.choice.addEventListener("click", onChoiceClick);
      started = true;
      live = api;
      settings = { ...Core.SETTINGS_DEFAULTS, ...host.modeSettings() };
      pet = host.pet();
      view.setPet(pet);

      const result = Core.normalizeSlice(host.slice.read());
      if (result.status === "unsupported") {
        data = result.data;
        sim = Core.createSim({ roomId: "slip" });
        ui = "blocked";
        view.setShell("locked");
        view.panel(card({ kicker: "JOURNEY SAVED", title: "SAVED BY ANOTHER BUILD", body: "This journey was saved by a different version of Rizo Dungeon. It is kept exactly as it is.", actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` }));
      } else if (result.status === "empty") {
        settings = { ...settings, ...result.data.settings };
        data = { ...Core.newCampaign({ pet, id: campaignId() }), settings: { ...settings } };
        enterSim(Content.START_ROOM, Content.ROOMS[Content.START_ROOM].entryAnchor, Core.T.FLAME_MAX);
        const outcome = commit(sliceWithSettings(data));
        onEnterRoom(Content.START_ROOM, "new");
        if (outcome.status !== "committed") renderSaveFailedPanel("moment");
      } else {
        data = result.data;
        settings = { ...settings, ...data.settings };
        const problem = bindingProblem();
        if (problem) { sim = Core.createSim({ roomId: "slip" }); ui = "blocked"; view.setShell("locked"); view.panel(problem); }
        else if (data.proofComplete && data.campaign.status === "complete") {
          retryPendingRewards();
          sim = Core.createSim({ roomId: "slip" });
          ui = "blocked";
          view.setShell("locked");
          view.panel(card({ kicker: "THE THRESHOLD", title: "THIS JOURNEY REACHED HOME", body: `${esc(data.campaign.petName)} already came home from this journey. Replays come later.`, actions: `<button type="button" class="primary" data-dungeon-action="leave">GO HOME</button>` }));
        } else resumeJourney(result.status === "migrated");
      }
      if (sim && !prev.x) prev = { x: sim.player.x, y: sim.player.y };
      view.setPhase(reducedMotion() ? "fade-in" : "enter");
      lastFrame = now();
      rafId = root.requestAnimationFrame(frame);
    }

    // ===== EXIT =====
    function beginExit(reason, toast, extra = {}) {
      if (exitState) return;
      input.clear("exit");
      ui = "exiting";
      view.panel(null);
      view.dialogue(null);
      view.choice(null);
      view.setPhase(reducedMotion() ? "fade-out" : "exit");
      exitState = { at: now() + (reducedMotion() ? EXIT_MS_REDUCED : EXIT_MS), reason, toast, extra };
    }
    function finishExit() {
      const { reason, toast, extra = {} } = exitState;
      exitState = null;
      try { host.event("sessionEnded", { boundaryId: reason === "homecoming" ? "homecoming" : "manual-return", campaignId: data?.campaign?.id || "", tone: "protected", interruption: "none" }); } catch (error) {}
      host.exit({ reason, destination: "home", ...extra });
      if (toast) try { host.ui.toast(toast); } catch (error) {}
    }
    // GO HOME: save the journey where it stands, then retract the device.
    function goHome() {
      if (ui === "blocked") { beginExit("leave", ""); return; }
      const outcome = commitData();
      if (outcome.status === "committed") beginExit("quit", "JOURNEY SAVED");
      else renderSaveFailedPanel("leaving");
    }
    // The proof homecoming: completion is committed immediately before exit.
    function homecoming() {
      const outcome = commitData(next => { next.campaign.status = "complete"; addBeat(next, "homecoming:complete"); next.story.resumeScene = null; });
      if (outcome.status !== "committed") log({ homecomingAck: outcome.status });
      try { host.event("chapterComplete", { boundaryId: "homecoming", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
      beginExit("homecoming", "", { homecoming: true });
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
        if (pendingGift) {
          const outcome = retryPendingRewards();
          if (outcome?.status === "committed") { closePanel(); pendingGift = "ready"; return; }
          renderSaveFailedPanel("moment");
          return;
        }
        const outcome = commit(sliceWithSettings(plain(data)));
        if (outcome.status === "committed") { closePanel(); showBanner("SAVED"); if (holds.length) renderPausePanel(); }
        else renderSaveFailedPanel("moment");
      }
    }
    function onChoiceClick(event) {
      const index = Number(event.target.closest("[data-choice-index]")?.dataset.choiceIndex);
      if (Number.isInteger(index) && choiceState) pickChoice(index);
    }

    function stop() {
      if (stopped) return;
      stopped = true;
      if (rafId) root.cancelAnimationFrame(rafId);
      rafId = 0;
      input?.unbind();
      view?.el.panel.removeEventListener("click", onPanelClick);
      view?.el.choice.removeEventListener("click", onChoiceClick);
      view?.destroy();
      releasePage?.();
      releasePage = null;
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
        ui, panelKind, holds: [...holds], unsaved, shell, lastOutcome: lastOutcome ? { ...lastOutcome } : null,
        scene: scene ? { id: scene.id, waiting: scene.waiting, control: scene.control } : null,
        choice: choiceState ? { index: choiceState.index, options: choiceState.options.map(option => option.value) } : null,
        settings: { ...settings },
        npcs: [...npcs.values()].map(actor => ({ id: actor.id, x: Math.round(actor.x), y: Math.round(actor.y), visible: actor.visible, state: actor.state })),
        pose: poseOverride?.name || null,
        sim: sim ? { t: sim.t, roomId: sim.roomId, phase: sim.phase, assist: sim.assist, flags: { ...sim.flags }, edges: { ...sim.edges }, zones: [...sim.zones], player: { x: sim.player.x, y: sim.player.y, flame: sim.player.flame, act: sim.player.act?.kind || null, fx: sim.player.fx, fy: sim.player.fy, attacks: sim.player.attackSeq, tuckReadyAt: sim.player.tuckReadyAt, leashed: sim.player.leashed }, enemies: sim.enemies.map(item => ({ id: item.id, kind: item.kind, state: item.state, hp: item.hp, aware: item.aware, x: item.x, y: item.y })) } : null,
        data: data ? plain(data) : null,
        petId: pet?.id || null,
        actorMarkup: view?.el.pose.innerHTML.length || 0,
        dialogue: dialogueState ? { index: dialogueState.index, shown: dialogueState.shown, lines: dialogueState.lines.length, speaker: dialogueState.lines[dialogueState.index].speaker, expr: dialogueState.lines[dialogueState.index].expr } : null,
        log: [...qaLog]
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
      // Skips to a room as if walked there (QA only). Flags may be set first.
      qaGoto(roomId, anchorId, setFlags = {}) {
        if (!host.debug || !Content.ROOMS[roomId]) return false;
        scene = null; dialogueState = null; choiceState = null; view.dialogue(null); view.choice(null);
        if (ui !== "blocked") ui = "play";
        sceneFade = { value: 0, from: 0, to: 0, start: 0, ms: 0 };
        poseOverride = null;
        commitData(next => {
          for (const [key, value] of Object.entries(setFlags)) {
            if (["latchFreed", "shortcutOpen", "alcoveOpen", "porterDown"].includes(key)) next.world.durableRoomFlags[key] = value; else next.story.facts[key] = value;
          }
          if (!Content.isOpening(roomId)) addBeat(next, "opening:below");
        });
        goToRoom(roomId, anchorId || Content.ROOMS[roomId].entryAnchor, { context: "walk" });
        return true;
      },
      qaSkipScene() {
        if (!host.debug) return false;
        let guard = 200;
        while ((scene || dialogueState || choiceState) && guard-- > 0) {
          if (dialogueState) { dialogueState.shown = 1e9; advanceDialogue(); continue; }
          if (choiceState) { pickChoice(0); continue; }
          if (scene?.waiting === "time") { sceneTime = scene.until; tickScene(); continue; }
          if (scene?.waiting === "pred") { if (scene.pred()) tickScene(); else break; continue; }
          break;
        }
        return scene ? scene.id : null;
      },
      qaSceneTime(ms) { sceneTime += ms; tickNpcs(ms / 1000); tickScene(); return sceneTime; },
      // Sets an enemy's hp/state (QA only), to reach boss beats deterministically.
      qaEnemy(id, patch = {}) {
        if (!host.debug || !sim) return null;
        const enemy = sim.enemies.find(item => item.id === id);
        if (!enemy) return null;
        for (const key of ["hp", "state", "x", "y"]) if (patch[key] !== undefined) enemy[key] = patch[key];
        if (patch.state) { enemy.stateAt = sim.t; enemy.openFor = 5000; enemy.aware = true; }
        return { id: enemy.id, hp: enemy.hp, state: enemy.state };
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
        next.world.durableRoomFlags.porterDown = true;
        if (!next.world.defeatedEncounters.includes("night-porter")) next.world.defeatedEncounters.push("night-porter");
        if (sharedRest) { next.story.facts.sharedRest = true; next.story.choices["hearth-seat"] = "sit"; }
        addBeat(next, "knot-gift:granted");
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
      dungeonGotoForQA: (roomId, anchorId, flags) => need().qaGoto(roomId, anchorId, flags),
      dungeonSkipSceneForQA: () => need().qaSkipScene(),
      dungeonSceneTimeForQA: ms => need().qaSceneTime(ms),
      dungeonCommitForQA: request => need().qaCommit(request),
      dungeonEnemyForQA: (id, patch) => need().qaEnemy(id, patch),
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
      // Schema 1 is the first Dungeon slice; content revisions migrate in normalizeSlice.
      migrate: data => (isObject(data) ? data : {}),
      summary: data => Core.summary(data),
      create: host => createInstance(host),
      qa: hubQA => createDungeonQA(hubQA)
    });
  } catch (error) {
    try { console.warn("Rizo Dungeon could not register", error); } catch (warnError) {}
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
