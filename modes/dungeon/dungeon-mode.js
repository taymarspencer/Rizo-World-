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
  // The v0.3 opening's timing contract
  // (docs/dungeon/story/Rizo-Dungeon-Opening-Beat-Sheet-v0.3.md). Scene numbers
  // in the comments below are that sheet's.
  const BEAT = Object.freeze({
    // 1 Parked
    PARKED_IN_MS: 4000, PARKED_MIN_MS: 20000, PARKED_IDLE_MS: 45000, PARKED_CAP_MS: 75000,
    // 2 Be good: YOU's lines to Rizo close themselves after 5 s.
    YOU_AUTO_MS: 5000, YOU_CINEMATIC_SAFETY_MS: 9000, BE_GOOD_HOLD_MS: 1500, DEPARTURE_SILENCE_MS: 900,
    // 3 Waiting: looking never shortens it.
    DOME_TIMEOUT_MS: 35000, DOME_FADE_MS: 3000, WAIT_MIN_MS: 55000, WAIT_MAX_MS: 90000, SEEN_YOU_MS: 1500, CART_AT_MS: 48000,
    // 5–6 Taken, the sack
    GRAB_MAX_MS: 6000, SACK_STILL_MS: 4000, SACK_MAX_MS: 12000, SACK_BURSTS: 3,
    // 8 The gap: a held push, or the jolt
    GAP_AUTO_MS: 9000, GAP_PUSH_MS: 1500, GAP_JOLT_MS: 10000,
    // 9–10 Taillights, the ringing
    SEARCH_MS: 12000, LEAVE_MS: 9000, AFTER_MS: 6000, SEEN_HOLD_MS: 1200,
    PHONE_DELAY_MS: 2000, PHONE_RING_MS: 40000, PHONE_CYCLE_MS: 4000, PHONE_CALL_MS: 8600, PHONE_REACH: 22,
    // 11–12 The walk, the drain
    PASS_MS: 6000, MOUTH_MS: 30000,
    // 13 The fall
    SLIP_MS: 600, SCRAMBLE_MS: 1200, SLIP_AGAIN_MS: 3000, CRACK_MS: 300, FALL_MS: 2500, IMPACT_SILENCE_MS: 500, LANDING_BLACK_MS: 2000,
    // 14 Awakening
    WAKE_DARK_MS: 1000, WAKE_GROW_MS: 10000, WAKE_INPUT_MS: 4000, WAKE_PULSE_MS: 6000,
    THOUGHT_LOOK_MS: 3000, THOUGHT_IN_MS: 1000, THOUGHT_HOLD_MS: 2500, THOUGHT_OUT_MS: 1000
  });
  // Overheard talk: 0.8 s + 0.3 s a word, at least 1.6 s, with a breath between speakers.
  const TALK_GAP_MS = 250;
  const barkMs = text => Math.max(1600, 800 + 300 * String(text || "").split(/\s+/).filter(Boolean).length);
  const DUNGEON_LEAD = [57, null, null, null, null, null, 60, null, 55, null, null, null, null, null, null, null], DUNGEON_BASS = [33, null, null, null, 36, null, null, null];
  // The emotional state the adaptive tracks read. One Dungeon runs at a time;
  // the live instance writes it each frame (presentation only, never saved).
  //   danger 0..1: something below is aware of him, or committing to him.
  //   home: HOME ↑ has been read, so its motif may come back (faintly) below.
  const MOOD = { danger: 0, home: false };
  // States in which something is about to happen to him.
  const DANGER_STATES = new Set(["windup", "lunge", "indicate", "pulse", "charge-tell", "charge", "sweep-tell", "sweep", "spot"]);
  // Danger is restrained: a low pulse under whatever is playing, then a tick
  // when something commits. It never becomes a different song.
  function dangerLayer(step, play) {
    if (MOOD.danger > 0.05 && step % 2 === 1) play(28, 0.34, 0.013 * MOOD.danger, 0, "triangle");
    if (MOOD.danger > 0.6 && step % 4 === 3) play(52, 0.08, 0.006, 0, "square");
  }
  function belowBeat(step, play) {
    const lead = DUNGEON_LEAD[step % DUNGEON_LEAD.length], bass = DUNGEON_BASS[step % DUNGEON_BASS.length];
    if (lead != null) play(lead, 0.63, 0.026, 0, "sine");
    if (bass != null) play(bass, 1.28, 0.018, 0, "triangle");
    // Once HOME ↑ is known, now and then the first of its notes, far off, when nothing is near.
    const echo = step % 128 - 112;
    if (MOOD.home && MOOD.danger < 0.2 && echo >= 0 && echo < 4 && HOME_MOTIF[echo] != null) play(HOME_MOTIF[echo], 1.1, 0.008, 0, "triangle");
    dangerLayer(step, play);
  }
  const DUNGEON_TRACK = Object.freeze({ id: "dungeon-below", tempo: 880, lead: DUNGEON_LEAD, bass: DUNGEON_BASS, wave: "sine", beat: belowBeat });
  // The van: no melody. An engine you feel more than hear, closing in.
  const VAN_TRACK = Object.freeze({ id: "dungeon-van", tempo: 470, lead: [null], bass: [null], wave: "sine",
    beat(step, play) { if (step % 2 === 0) play(26, 0.5, step % 8 === 0 ? 0.02 : 0.013, 0, "triangle"); if (step % 8 === 5) play(31, 0.22, 0.008, 0, "sine"); } });
  // The drain: the first relief. The road's low note, and one warm note answering it.
  const DRAIN_TRACK = Object.freeze({ id: "dungeon-drain", tempo: 1400, lead: [null], bass: [null], wave: "sine",
    beat(step, play) { if (step % 16 === 0) play(31, 2.6, 0.016, 0, "sine"); if (step % 16 === 8) play(33, 2.2, 0.012, 0, "sine"); if (step % 16 === 4) play(52, 2.8, 0.009, 0, "triangle"); if (step % 32 === 20) play(56, 2.4, 0.007, 0, "triangle"); } });
  // The Shared Hearth: the only lullaby below. Slow, close, warm.
  const HEARTH_LEAD = [60, null, null, 64, null, null, 67, null, 65, null, null, 64, null, null, null, null], HEARTH_BASS = [36, null, null, null, 41, null, null, null];
  const HEARTH_TRACK = Object.freeze({ id: "dungeon-hearth", tempo: 980, lead: HEARTH_LEAD, bass: HEARTH_BASS, wave: "triangle",
    beat(step, play) {
      // Every fourth phrase, once he knows it, the lullaby turns into HOME ↑'s motif, an octave down.
      const quote = MOOD.home && step % 64 >= 48, motif = HOME_MOTIF[step % 16];
      const lead = quote ? (motif != null ? motif - 12 : null) : HEARTH_LEAD[step % 16], bass = HEARTH_BASS[step % 8];
      if (lead != null) play(lead, quote ? 1.4 : 0.95, quote ? 0.016 : 0.019, 0, "triangle");
      if (bass != null) play(bass, 1.7, 0.015, 0, "sine");
    } });
  // The Night Porter's hall: a tolling key-bell and a held breath.
  const PORTER_TRACK = Object.freeze({ id: "dungeon-porter", tempo: 640, lead: [null], bass: [null], wave: "sine",
    beat(step, play) { if (step % 8 === 0) play(31, 2.4, 0.022, 0, "triangle"); if (step % 8 === 4) play(30, 1.3, 0.011, 0, "triangle"); if (step % 16 === 10) play(55, 0.5, 0.009, 0, "sine"); dangerLayer(step, play); } });
  // Outside there is almost no music: rain, a hum, one low note now and then.
  const STREET_TRACK = Object.freeze({ id: "dungeon-street", tempo: 1400, lead: [null, null, null, null, null, null, null, null], bass: [31, null, null, null, null, null, null, null, 33, null, null, null, null, null, null, null], wave: "sine" });
  // Designed silence: the mode keeps the music, and plays nothing.
  const SILENT_TRACK = Object.freeze({ id: "dungeon-silence", tempo: 2000, lead: [null], bass: [null], wave: "sine" });
  // The headlights: one held low tone, no melody.
  const DREAD_TRACK = Object.freeze({ id: "dungeon-dread", tempo: 1500, lead: [null], bass: [38], wave: "sine" });
  // Only after HOME is found: a short new motif, then the music below returns.
  const HOME_MOTIF = [64, null, 67, 69, null, null, 72, null, null, null, 67, null, null, null, null, null];
  const HOME_TRACK = Object.freeze({
    id: "dungeon-home", tempo: 880, lead: DUNGEON_LEAD, bass: DUNGEON_BASS, wave: "sine",
    beat(step, play) {
      if (step < HOME_MOTIF.length) { if (HOME_MOTIF[step] != null) play(HOME_MOTIF[step], 1.3, 0.03, 0, "triangle"); if (step === 0) play(40, 3.2, 0.016, 0, "sine"); return; }
      belowBeat(step - HOME_MOTIF.length, play);
    }
  });
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
    // `auto`: a line spoken TO Rizo closes itself this long after it is fully shown.
    say: (lines, auto = 0) => ({ type: "say", lines, auto }),
    wait: ms => ({ type: "wait", ms }),
    call: fn => ({ type: "call", fn }),
    until: pred => ({ type: "until", pred }),
    move: (id, x, y, ms, wait = true) => ({ type: "move", id, x, y, ms, wait }),
    pose: (name, ms) => ({ type: "pose", name, ms }),
    fade: (to, ms) => ({ type: "fade", to, ms }),
    control: on => ({ type: "control", on }),
    // `line`: the line that asks it, kept on screen while the choice waits.
    choice: (key, options, line = null) => ({ type: "choice", key, options, line }),
    bark: (id, line, ms = 1900) => ({ type: "bark", id, line, ms }),
    // An action cut to a comic page (dungeon-comic.js). Once per journey.
    comic: id => ({ type: "comic", id })
  };

  // The page around the handheld must not scroll, rubber-band, zoom or
  // select text while the Dungeon is open. Everything here is undone on stop.
  // A text field (none is in the Dungeon today) always keeps its own selection.
  const TEXT_FIELDS = "input, textarea, select, [contenteditable]";
  // selectstart is fired at the Text node, which has no closest(): look from its element.
  const elementOf = node => (node && node.nodeType !== 1 ? node.parentElement || null : node);
  const inTextField = node => Boolean(elementOf(node)?.closest?.(TEXT_FIELDS));
  function createPageLock(stageRoot) {
    const doc = root.document;
    const html = doc.documentElement, body = doc.body;
    const listeners = [];
    const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); };
    const scroll = { x: root.scrollX || 0, y: root.scrollY || 0 };
    const clearSelection = () => { try { root.getSelection?.()?.removeAllRanges?.(); } catch (error) {} };
    html.classList.add("dungeon-locked");
    body.classList.add("dungeon-locked");
    clearSelection();
    // iOS rubber-bands the page on any unhandled touchmove. Oversized cards
    // use the view's bounded pointer drag; native page scrolling stays locked.
    listen(doc, "touchmove", event => { if (event.cancelable) event.preventDefault(); }, { passive: false });
    listen(doc, "gesturestart", event => event.preventDefault(), { passive: false });
    listen(doc, "selectstart", event => { if (!inTextField(event.target)) event.preventDefault(); });
    // If the OS still makes a selection, it goes at once, and its edit menu
    // (Copy, Look Up, the link item) with it. The selection is drawn
    // transparent in the stage, so otherwise the menu floats over the HUD.
    listen(doc, "selectionchange", () => {
      const selection = root.getSelection?.();
      if (selection?.rangeCount && !selection.isCollapsed && !inTextField(selection.anchorNode)) clearSelection();
    });
    listen(doc, "contextmenu", event => { if (!inTextField(event.target)) event.preventDefault(); });
    listen(stageRoot, "dblclick", event => event.preventDefault());
    listen(stageRoot, "wheel", event => { if (event.cancelable) event.preventDefault(); }, { passive: false });
    return function release() {
      while (listeners.length) listeners.pop()();
      html.classList.remove("dungeon-locked");
      body.classList.remove("dungeon-locked");
      clearSelection();
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
    let rainTickAt = 0, dripAt = 0, stepAt = 0, crackleAt = 0, thudAt = 0;
    let stillFor = 0;
    let pendingGift = null;
    let silentUntil = 0;              // scene time before which the mode makes no sound
    let transient = {};               // presentation-only room flags (never saved)
    let musicId = "";                 // the mode track now playing
    let roomTickAt = 0;
    let qaLog = [];
    let comic = null;                 // the comic page (dungeon-comic.js), if this build has it

    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    // The hub's own setting, or the device's (the hub does not pass the OS preference to modes).
    const reducedMotion = () => { if (host.settings().reducedMotion) return true; try { return Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch (error) { return false; } };
    const geo = () => Core.room(sim?.roomId || Content.START_ROOM);
    const flags = () => Core.flagsOf(data);
    const simFlags = () => ({ ...flags(), ...transient });
    const fact = name => Boolean(flags()[name]);
    const beats = () => data?.story?.committedSceneBeats || [];
    const log = entry => { if (host.debug) { qaLog.push(entry); if (qaLog.length > 60) qaLog.shift(); } };
    const sound = (kind) => {
      if (sceneTime < silentUntil) return;
      const a = host.audio || {};
      try {
        // His phone: the buzz, and under it a thin cold half-step that belongs to nobody else.
        if (kind === "buzz") { a.tone?.(118, 0.22, "square", 0.012); a.tone?.(118, 0.22, "square", 0.012, 0.3); a.tone?.(1568, 0.5, "sine", 0.0045); a.tone?.(1661, 0.5, "sine", 0.0045, 0.05); a.haptic?.(10); return; }
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
        // Under a roof the rain goes dull and a drip finds the gap.
        else if (kind === "rain-muffled") a.noise?.(0.3, 0.0025);
        else if (kind === "drip") a.tone?.(1250, 0.05, "sine", 0.008, 0, -500);
        else if (kind === "step-wet") a.noise?.(0.035, 0.007);
        else if (kind === "step") a.tone?.(95, 0.03, "triangle", 0.006, 0, -20);
        else if (kind === "crackle") { a.noise?.(0.025, 0.012); if (Math.random() < 0.3) a.tone?.(1800, 0.012, "square", 0.004); }
        else if (kind === "thud") { a.tone?.(52, 0.12, "sine", 0.03, 0, -12); a.haptic?.(8); }
        else if (kind === "car") { a.noise?.(0.6, 0.018); a.tone?.(70, 0.6, "sawtooth", 0.012, 0, -10); }
        else if (kind === "door") { a.tone?.(180, 0.08, "square", 0.02, 0, -40); a.noise?.(0.08, 0.02); }
        else if (kind === "chime") { a.tone?.(988, 0.14, "sine", 0.018); a.tone?.(784, 0.2, "sine", 0.016, 0.12); }
        else if (kind === "clunk") { a.tone?.(110, 0.1, "square", 0.03, 0, -30); a.noise?.(0.1, 0.03); a.haptic?.(25); }
        else if (kind === "crack") { a.noise?.(0.35, 0.03); a.tone?.(90, 0.4, "sawtooth", 0.02, 0, -50); }
        else if (kind === "click") { a.tone?.(1600, 0.025, "square", 0.022); a.tone?.(800, 0.03, "square", 0.018, 0.05); a.haptic?.(15); }
        else if (kind === "sweep") a.noise?.(0.3, 0.02);
        else if (kind === "porter") { a.tone?.(98, 0.3, "triangle", 0.03, 0, -20); }
        // The opening (v0.3): an ordinary car in the rain, then not ordinary.
        else if (kind === "tick") a.tone?.(2300, 0.012, "square", 0.004);
        else if (kind === "hum") a.tone?.(62, 1.2, "sine", 0.006);
        else if (kind === "keys") { a.tone?.(2400, 0.04, "triangle", 0.008); a.tone?.(3100, 0.05, "triangle", 0.007, 0.06); a.tone?.(2700, 0.04, "triangle", 0.006, 0.13); }
        else if (kind === "dome") a.tone?.(1500, 0.02, "square", 0.012);
        else if (kind === "thunk") { a.tone?.(64, 0.18, "square", 0.03, 0, -14); a.noise?.(0.12, 0.03); a.haptic?.(22); }
        else if (kind === "cart") { for (let i = 0; i < 6; i += 1) a.noise?.(0.05, 0.006, i * 0.16); }
        else if (kind === "engine") { a.tone?.(46, 1.6, "sawtooth", 0.01, 0, 8); a.noise?.(0.9, 0.006); }
        else if (kind === "bass") { a.tone?.(55, 0.16, "sine", 0.02); a.tone?.(55, 0.16, "sine", 0.018, 0.48); a.tone?.(49, 0.16, "sine", 0.018, 0.96); }
        else if (kind === "engine-off") a.tone?.(52, 0.5, "sawtooth", 0.008, 0, -20);
        else if (kind === "tap") { a.tone?.(1900, 0.02, "square", 0.012); a.tone?.(1900, 0.02, "square", 0.012, 0.16); a.haptic?.(8); }
        else if (kind === "grab") { a.noise?.(0.2, 0.03); a.haptic?.([12, 20, 12]); }
        else if (kind === "cloth") a.noise?.(0.16, 0.014);
        else if (kind === "slide") { a.noise?.(0.5, 0.012); a.tone?.(80, 0.5, "sawtooth", 0.006, 0, -10); }
        else if (kind === "brake") a.tone?.(900, 0.25, "sine", 0.004, 0, -200);
        else if (kind === "horn") { a.tone?.(392, 0.32, "square", 0.012); a.tone?.(466, 0.32, "square", 0.01); }
        else if (kind === "connect") a.tone?.(1320, 0.03, "sine", 0.006);
        else if (kind === "phone-drop") { a.tone?.(1240, 0.025, "square", 0.008); a.noise?.(0.05, 0.009); a.haptic?.(6); }
        else if (kind === "hangup") { a.tone?.(980, 0.025, "square", 0.007); a.tone?.(620, 0.035, "square", 0.006, 0.05); }
        else if (kind === "breath") a.noise?.(0.5, 0.004);
        else if (kind === "slip") { a.noise?.(0.25, 0.014); a.tone?.(140, 0.2, "triangle", 0.01, 0, -60); }
        // The Rows: work sounds.
        else if (kind === "scrape") { a.noise?.(0.18, 0.016); a.tone?.(140, 0.16, "sawtooth", 0.006, 0, -30); }
        else if (kind === "plate") { a.tone?.(1180, 0.06, "triangle", 0.012); a.tone?.(880, 0.08, "triangle", 0.01, 0.07); }
        else if (kind === "carriage") { a.noise?.(0.5, 0.014); a.tone?.(74, 0.5, "square", 0.01, 0, 10); a.haptic?.(10); }
        else if (kind === "wind") { a.noise?.(1.6, 0.012); a.tone?.(70, 1.6, "sine", 0.008, 0, -30); }
        // The van, and feelings that are not music.
        else if (kind === "wiper") { a.tone?.(1700, 0.09, "sine", 0.0032, 0, -520); a.noise?.(0.05, 0.0028, 0.05); }
        else if (kind === "road") { a.noise?.(0.2, 0.0055); a.tone?.(41, 0.24, "sine", 0.006); }
        else if (kind === "heart") { a.tone?.(46, 0.11, "sine", 0.02); a.tone?.(44, 0.1, "sine", 0.014, 0.19); }
        else if (kind === "curious") a.tone?.(740, 0.07, "sine", 0.008, 0, 160);
        else if (kind === "draft") { a.noise?.(0.9, 0.0035); a.tone?.(330, 0.9, "sine", 0.0028, 0.1, 40); }
        else if (kind === "relief") { a.noise?.(0.45, 0.005); a.tone?.(392, 0.5, "sine", 0.009, 0.05, -60); }
        // Nell: three warm notes, the first time she makes room for him and when she gives.
        else if (kind === "nell") { a.tone?.(523, 0.5, "triangle", 0.011); a.tone?.(659, 0.55, "triangle", 0.01, 0.24); a.tone?.(587, 0.8, "triangle", 0.009, 0.5); }
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
      if (sim) sim.flags = simFlags();
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
    // `menu`: a card the player opens mid-play (pause, restart); it tightens on short screens.
    function card({ kicker = "THE THRESHOLD", title, body = "", actions = "", fine = "", tools = "", menu = false }) {
      return `<div class="dungeon-card${menu ? " is-menu" : ""}"><small>${esc(kicker)}</small><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ""}<div class="dungeon-card-actions">${actions}</div>${fine ? `<p class="dungeon-fine">${fine}</p>` : ""}${tools ? `<div class="dungeon-card-tools">${tools}</div>` : ""}</div>`;
    }
    // Under the card, away from RESUME: a fresh start of the story, always asked first.
    const restartTool = disabled => `<button type="button" class="quiet" data-dungeon-action="restart-ask" ${disabled ? "disabled" : ""}>RESTART DUNGEON</button>`;
    function renderPausePanel() {
      const external = Core.externalHolds(holds);
      const waiting = external.includes("ad") ? "Waiting for the break to finish." : external.includes("save-blocked") ? "This tab stopped saving. Load the newest save to continue." : "";
      const updateNote = holds.includes("update") && lastOutcome && lastOutcome.status !== "committed" ? "The update waited because this moment couldn't be saved yet. Resume to keep playing; try the update again later." : "";
      const perf = holds.includes("performance") ? "Paused because the device fell behind. Nothing advanced while it caught up." : "";
      openPanel("pause", card({
        title: "PAUSED",
        body: esc(`${waiting || updateNote || perf || `${pet?.name || "Your Rizo"} waits. Nothing moves until you resume.`}${unsaved && !updateNote ? " The last moment isn't saved yet; GO HOME tries again." : ""}`) + (objectiveNow() ? `<span class="dungeon-pause-goal">NOW: ${esc(objectiveNow())}</span>` : ""),
        actions: `<button type="button" class="primary" data-dungeon-action="resume" ${external.length ? "disabled" : ""}>RESUME</button><button type="button" data-dungeon-action="home">GO HOME</button>`,
        fine: esc(Core.belowReached(data) ? "GO HOME saves the journey here. You'll come back to this spot." : "GO HOME saves. The night picks up from here next time."),
        tools: restartTool(external.length > 0),
        menu: true
      }));
    }
    // A finished proof journey (the homecoming) can go on through the door, or start over.
    function reachedHomeCard() {
      return card({ kicker: "THE THRESHOLD", title: "THIS JOURNEY REACHED HOME", body: `${esc(data.campaign.petName)} already came home from The Threshold. Past the Porter, a door that was shut is open now.`, actions: `<button type="button" class="primary" data-dungeon-action="onward">GO THROUGH THE DOOR</button><button type="button" data-dungeon-action="leave">GO HOME</button>`, tools: restartTool(false) });
    }
    // ---- RESTART DUNGEON: asked, then committed, then begun. Keeping the
    // journey is the first (focused) answer, so a stray Enter never restarts.
    let restartBack = null;
    function askRestart(back) {
      restartBack = back;
      const name = esc(pet?.name || data?.campaign?.petName || "Your Rizo");
      openPanel("restart", card({
        kicker: "RESTART DUNGEON",
        title: "START OVER FROM THE CAR?",
        body: `${name}'s journey goes back to the very beginning. Every room, choice and meeting starts fresh.`,
        actions: `<button type="button" class="primary" data-dungeon-action="restart-cancel">KEEP MY JOURNEY</button><button type="button" class="danger" data-dungeon-action="restart">RESTART DUNGEON</button>`,
        fine: esc(`${pet?.name || "Your Rizo"}, Home, training, Defense, Embers, the wardrobe and your settings stay exactly as they are.`),
        menu: true
      }));
    }
    function cancelRestart() {
      const back = restartBack;
      restartBack = null;
      if (back) back(); else closePanel();
    }
    function restartJourney() {
      if (exitState || !data?.campaign || !pet || data.campaign.petId !== pet.id) return;
      const fresh = Core.restartSlice(data, { pet, id: campaignId() });
      if (!fresh) return;
      const before = { data, dirty, unsaved };
      const outcome = commit(fresh);
      if (outcome.status !== "committed") {
        // Refused: the journey stays exactly where it was.
        data = before.data; dirty = before.dirty; unsaved = before.unsaved;
        if (sim) sim.flags = simFlags();
        const blocked = outcome.status === "blocked";
        openPanel("restart-failed", card({
          kicker: blocked ? "SAVE PROTECTED" : "NOT SAVED",
          title: "COULDN'T RESTART",
          body: esc(blocked ? "Another tab or the app has newer progress, so this tab stopped saving. Your journey is unchanged." : "Your browser storage refused the save. Your journey is unchanged."),
          actions: `<button type="button" class="primary" data-dungeon-action="restart-cancel">BACK</button>`,
          menu: true
        }));
        return;
      }
      // Nothing of the old night follows him into the new one.
      restartBack = null;
      scene = null; dialogueState = null; choiceState = null;
      view.dialogue(null); view.choice(null); view.banner(""); bannerUntil = 0; pendingBanner = "";
      panelKind = ""; view.panel(null);
      holds = Core.holdsPlayerResume(holds);
      ui = "play";
      sim = null;
      noticed.clear();
      cue = { moved: false, flare: false, tuck: false, noticed: false };
      deaths = 0; pendingGift = null; poseOverride = null; silentUntil = 0; stillFor = 0; facingLeft = false; lastMove = { x: 0, y: 0 };
      sceneFade = { value: 1, from: 1, to: 1, start: sceneTime, ms: 0 };
      input.clear("restart");
      pending = { primary: false, secondary: false };
      acc = 0; lastFrame = now();
      refreshPet();
      enterSim(Content.START_ROOM, Content.ROOMS[Content.START_ROOM].entryAnchor, Core.T.FLAME_MAX);
      onEnterRoom(Content.START_ROOM, "new");
      log({ restart: data.campaign.id });
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
    function openDialogue(lines, onDone = null, auto = 0) {
      dialogueState = { lines: lines.map(lineOf), index: 0, startAt: now(), shown: 0, onDone, auto, fullFor: 0 };
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
      view.dialogue(line.text.slice(0, dialogueState.shown), { done: dialogueState.shown >= line.text.length, speaker: line.speaker, expr: line.expr, fullText: line.text });
      if (line.speaker && npcs.has(line.speaker)) npcs.get(line.speaker).expr = line.expr;
    }
    // A fresh Primary press reveals the line, another advances it.
    function advanceDialogue() {
      const line = dialogueState.lines[dialogueState.index];
      if (dialogueState.shown < line.text.length) { dialogueState.startAt = -1e9; tickDialogue(now()); return; }
      dialogueState.index += 1;
      dialogueState.fullFor = 0;
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
    // The question stays with its answers: the line that asked it (if any)
    // is shown above the buttons, so a choice never floats without context.
    function openChoice(options, onPick, line = null) {
      choiceState = { options, index: 0, onPick, lastDir: 0, line: line ? lineOf(line) : null };
      ui = "choice";
      input.clear("choice");
      pending = { primary: false, secondary: false };
      view.choice(options, 0, choiceState.line);
    }
    function moveChoice(dir) {
      if (!choiceState) return;
      choiceState.index = (choiceState.index + dir + choiceState.options.length) % choiceState.options.length;
      view.choice(choiceState.options, choiceState.index, choiceState.line);
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
          case "say": current.waiting = "dialogue"; openDialogue(step.lines, () => { if (scene === current) { current.waiting = null; advanceScene(); } }, step.auto); break;
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
          case "choice": current.waiting = "choice"; openChoice(step.options, value => { if (scene === current) { current.choice = value; step.onPick?.(value); current.waiting = null; advanceScene(); } }, step.line); break;
          case "bark": bark(step.id, step.line, step.ms); break;
          case "comic": {
            // Committed before it is shown: a comic never plays twice. While it
            // is up the simulation and the scene clock stand still.
            const beat = `comic:${step.id}`;
            if (!comic || beats().includes(beat)) break;
            commitBeat(beat);
            const token = {};
            current.waiting = "comic"; current.comicToken = token;
            if (ui === "play") { ui = "scene"; input.clear("comic"); pending = { primary: false, secondary: false }; }
            view.showPrompt(null);
            comic.play(step.id, { onDone: () => {
              if (scene !== current || current.waiting !== "comic" || current.comicToken !== token) return;
              current.waiting = null;
              if (current.control && ui === "scene") { ui = "play"; input.clear("comic"); pending = { primary: false, secondary: false }; }
              advanceScene();
            } });
            break;
          }
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
    // Overheard talk (v0.3): lines float over whoever says them while the Rizo
    // keeps moving; nobody has to press through it. Its clock only runs while
    // the player is in play, so a LOOK never hides a line: the talk waits, and
    // the line on screen stays up. Items: a line, { hold }, { pose, ms }, { call }.
    function talk(items) {
      let state = null;
      return S.until(() => {
        if (!state) state = { index: 0, clock: 0, next: 0, last: sceneTime };
        const delta = sceneTime - state.last;
        state.last = sceneTime;
        if (ui === "play") state.clock += delta;
        else for (const entry of barks) if (entry.talk) entry.until += delta;
        while (state.index < items.length && state.clock >= state.next) {
          const item = items[state.index];
          state.index += 1;
          const late = state.clock - state.next;
          if (item.hold) { state.next += item.hold; continue; }
          if (item.call) { item.call(); continue; }
          if (item.pose) { setPose(item.pose, item.ms); state.next += item.ms || 0; continue; }
          // A weighted line stays up longer; a quiet one is set smaller. Neither changes the words.
          const ms = Math.round(barkMs(item.text) * (item.weight || 1));
          barks = barks.filter(entry => entry.id !== item.speaker);
          barks.push({ id: item.speaker, text: item.text, speaker: item.speaker, until: sceneTime + Math.max(0, ms - late), talk: true, quiet: Boolean(item.quiet) });
          state.next += ms + TALK_GAP_MS;
        }
        return state.index >= items.length && state.clock >= state.next;
      });
    }

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
        // Work and conversation have a physical subject. Travel follows the
        // route; listening turns toward Rizo only while he is nearby. Neither
        // changes the simulation or steals his heading.
        if (!actor.walking && actor.kind === "nell" && sim && ["listen", "clear", "fit"].includes(actor.state)) {
          const dx = sim.player.x - actor.x;
          if (Math.abs(dx) > 8 && Math.hypot(dx, sim.player.y - actor.y) < 110) actor.face = dx < 0 ? -1 : 1;
        }
        // Someone who walks out of the room is gone once they reach the door.
        if (actor.leaveAt && sceneTime >= actor.leaveAt) actor.visible = false;
        if (actor.state === "chase" && sim && sceneTime >= (actor.flinchUntil || 0)) {
          const dx = sim.player.x - actor.x, dy = sim.player.y - actor.y, distance = Math.hypot(dx, dy);
          const speed = actor.speed || 30;
          if (distance > 10) { actor.x += (dx / distance) * speed * dt; actor.y += (dy / distance) * speed * dt; actor.walking = true; actor.face = dx < 0 ? -1 : 1; }
        }
      }
      // Overheard talk waits with its line on screen while play is paused (a LOOK).
      barks = barks.filter(entry => entry.until > sceneTime || (entry.talk && ui !== "play"));
    }

    // ===== ROOMS =====
    function enterSim(roomId, anchorId, flame) {
      // A room change closes whatever was being read: no line follows him into another room.
      if (dialogueState) { dialogueState = null; view.dialogue(null); }
      if (choiceState) { choiceState = null; view.choice(null); }
      if (ui === "dialogue" || ui === "choice") ui = "play";
      transient = {};
      sim = sim ? Core.enterRoom(sim, { roomId, anchorId, flame }) : Core.createSim({ roomId, anchorId, flame, edges: data.legProfile.edges, assist: settings.assist, flags: flags(), defeated: data.world.defeatedEncounters });
      sim.flags = simFlags();
      roomTickAt = sceneTime;
      sim.hearthLit = data.checkpoint.hearthId === Core.room(roomId).hearth?.id;
      prev = { x: sim.player.x, y: sim.player.y };
      view.camera.ready = false;
      npcs = new Map(); barks = []; room = {}; MOOD.danger = 0;
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
      // Each room says what plays (silence is a track too); null keeps what is playing.
      const logic = ROOM_LOGIC[roomId];
      const track = logic?.music ? logic.music(context) : Content.isOpening(roomId) ? STREET_TRACK : DUNGEON_TRACK;
      if (track) setMusic(track);
      syncWear();
      MOOD.home = Boolean(data?.journal?.discoveredEntryIds?.includes("home-sign"));
      const enter = logic?.enter;
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

    // ===== THE v0.3 OPENING: helpers =====
    // YOU says the pet's own name; a save without one hears "Rizo".
    function petCallName() {
      const raw = String(data?.campaign?.petName || "").trim();
      if (!raw) return "Rizo";
      return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (match, lead, first) => lead + first.toUpperCase()) : raw;
    }
    const personal = lines => lines.map(item => (typeof item === "string" ? item : { ...item, text: item.text.replace("{name}", petCallName()) }));
    function setTransient(name, value) { transient = { ...transient, [name]: value }; if (sim) sim.flags = simFlags(); }
    function setMusic(track) { if (!track || track.id === musicId) return; musicId = track.id; try { host.audio.music?.(track); } catch (error) {} }
    const inZone = id => Boolean(sim?.zones?.includes(id));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 2);
    // Walks an actor without holding the scene.
    function walk(id, x, y, ms) {
      const actor = npcs.get(id);
      if (!actor) return;
      actor.fromX = actor.x; actor.fromY = actor.y; actor.toX = x; actor.toY = y; actor.moveStart = sceneTime; actor.moveMs = Math.max(1, ms);
      if (Math.abs(x - actor.x) > 2) actor.face = x < actor.x ? -1 : 1;
    }
    // A small presentation shove that still respects walls.
    function nudge(dx, dy) {
      const [x, y] = Core.moveCircle(Core.geoOf(sim), sim.player.x, sim.player.y, sim.player.r, dx, dy);
      sim.player.x = x; sim.player.y = y; prev = { x, y };
    }
    function dome(to, ms) { room.domeFrom = room.dome || 0; room.domeTo = to; room.domeAt = sceneTime; room.domeMs = Math.max(1, ms); }
    function youState(state, ms) { const you = npcs.get("you-seat"); if (you) { you.state = state; you.stateUntil = sceneTime + ms; } }
    function keeperState(state, ms = 0) { const keeper = npcs.get("keeper"); if (keeper) { keeper.state = state; keeper.stateUntil = ms ? sceneTime + ms : 0; } }
    // Cinematic framing is deliberately brief. Reduced-motion players keep the
    // stable gameplay composition instead of being snapped to a new subject.
    function cameraBeat(x, y, ms) { if (!reducedMotion()) room.peek = { x, y, until: sceneTime + ms }; }
    function tickRoom() {
      if (!sim) return;
      const dt = Math.max(0, sceneTime - roomTickAt);
      roomTickAt = sceneTime;
      ROOM_LOGIC[sim.roomId]?.tick?.(dt);
    }

    // ---- 1 Parked: the car, the rain, YOU. YOU answers each thing once.
    const YOU_REACTIONS = { approach: "youHi", dash: "youDash", flare: "youShowOff", window: "youRain" };
    function youReact(kind) {
      if (sim?.roomId !== "car" || room.phase !== "parked" || !room.parkedAt || room.reactions.includes(kind) || dialogueState || ui !== "play") return false;
      room.reactions.push(kind);
      if (kind === "approach") setTransient("youGreeted", true);
      youState(kind === "approach" ? "reach" : kind === "window" ? "look" : "turn", 2600);
      openDialogue(L[YOU_REACTIONS[kind]], null, BEAT.YOU_AUTO_MS);
      return true;
    }
    function carParked() {
      room.phase = "parked";
      runScene("opening:parked", [
        S.call(() => { sceneFade = { value: 1, from: 1, to: 0, start: sceneTime, ms: reducedMotion() ? 600 : 2600 }; room.tickAt = sceneTime; room.ticks = 0; }),
        S.pose("settle", BEAT.PARKED_IN_MS),
        S.wait(BEAT.PARKED_IN_MS),
        S.control(true),
        S.call(() => { room.parkedAt = sceneTime; room.lastInputAt = sceneTime; view.pulseKey("dpad"); }),
        S.until(() => {
          if (ui !== "play") return false;
          const t = sceneTime - room.parkedAt;
          if (t >= BEAT.PARKED_CAP_MS) return true;
          if (t >= BEAT.PARKED_MIN_MS && room.moved && room.reactions.length) return true;
          if (sceneTime - room.lastInputAt >= BEAT.PARKED_IDLE_MS) youReact("window");
          return false;
        }),
        ...beGoodSteps()
      ]);
    }
    // ---- 2 Be good. The keys, the light left on, the line on its own, THUNK.
    function beGoodSteps() {
      return [
        S.control(false),
        S.call(() => { room.phase = "leaving"; room.parkedEnd = sceneTime; youState("keys", 900); sound("keys"); }),
        S.wait(700),
        // Important departure lines are player-paced. The long safety fallback
        // keeps a completely idle player from ever being soft-locked here.
        S.say(personal(L.goingIn), BEAT.YOU_CINEMATIC_SAFETY_MS),
        // The box goes away before the next action. Keys disappear into a
        // pocket; only rain, the cooling engine and the store hum fill the gap.
        S.call(() => youState("pocket", BEAT.DEPARTURE_SILENCE_MS)),
        S.wait(BEAT.DEPARTURE_SILENCE_MS),
        S.call(() => { dome(1, 700); sound("dome"); youState("reach-up", 900); }),
        S.wait(700),
        S.say(L.lightsOn, BEAT.YOU_AUTO_MS),
        S.wait(650),
        // YOU actually gets out before saying the line that matters. The open
        // door changes the sound first; the camera only leans toward the beat.
        S.call(() => {
          room.driverDoor = true; room.rainLoud = true; room.youOut = true; room.youOutside = true; sound("door");
          const seat = npcs.get("you-seat");
          if (seat) seat.visible = false;
          npc("keeper", "keeper", 116, 246, { face: 1, state: "step-out" });
          cameraBeat(154, 240, 1800);
        }),
        S.wait(850),
        S.call(() => keeperState("look-back", BEAT.YOU_CINEMATIC_SAFETY_MS + 1800)),
        S.say(L.beGood, BEAT.YOU_CINEMATIC_SAFETY_MS),
        S.wait(BEAT.BE_GOOD_HOLD_MS),
        S.call(() => {
          // THUNK. The line is already gone. Rain goes muffled; Rizo watches
          // the person who said it become smaller across the wet lot.
          setTransient("youGone", true);
          room.youOutside = false;
          room.driverDoor = false; room.rainLoud = false; room.shake = sceneTime; room.thunkAt = sceneTime;
          sound("thunk");
          keeperState("walk", 5200);
          cameraBeat(154, 154, 2300);
          sim.player.fx = -1; sim.player.fy = -0.4;
        }),
        S.pose("press-glass", 6100),
        S.move("keeper", 104, 128, 1900),
        // One half-beat of body language in the rain before the store takes YOU.
        S.call(() => { const keeper = npcs.get("keeper"); if (keeper) { keeper.face = 1; keeperState("look-back", 500); } sim.player.fx = 0; sim.player.fy = -1; }),
        S.wait(450),
        S.move("keeper", 176, 104, 2000),
        S.call(() => { keeperState("door", 700); room.storeDoorOpen = true; sound("chime"); }),
        S.wait(450),
        S.call(() => { const keeper = npcs.get("keeper"); if (keeper) keeper.visible = false; room.storeDoorOpen = false; }),
        S.wait(550),
        S.call(() => commitBeat("opening:left")),
        S.call(() => carWaiting(false))
      ];
    }
    // ---- 3 Waiting. Nothing happens. Curiosity keeps it normal longer, never shorter.
    // YOU drifts between the aisles: in sight about 70% of the time.
    // Twice, if he has not come to the glass, YOU looks out at the car and waves (YOU checks on him; YOU knows nothing else).
    const youWaves = t => (t >= 20000 && t < 22600) || (t >= 45000 && t < 47600);
    function storeYou(t) {
      const k = (t / 1000) % 20;
      if (youWaves(t)) return { x: 52 + ((k % 20) < 7 ? (k / 7) * 76 : 40), visible: true, wave: true };
      if (k < 7) return { x: 50 + (k / 7) * 78, visible: true };
      if (k < 9) return { x: 150, visible: false };
      if (k < 16) return { x: 234 + ((k - 9) / 7) * 62, visible: true };
      return { x: 300, visible: false };
    }
    function carWaiting(resumed) {
      room.phase = "waiting";
      room.waitStart = sceneTime; room.seenYou = false; room.seenFor = 0; room.domeOut = false; room.cartDone = false; room.youWasVisible = null;
      setTransient("youGone", true);
      room.youOut = true;
      if (resumed) { dome(1, 1); room.dome = 1; sceneFade = { value: 1, from: 1, to: 0, start: sceneTime, ms: 600 }; }
      runScene("opening:waiting", [
        S.control(true),
        S.until(() => {
          if (ui !== "play") return false;
          const t = sceneTime - room.waitStart;
          return t >= BEAT.WAIT_MAX_MS || (t >= BEAT.WAIT_MIN_MS && room.seenYou);
        }),
        ...headlightSteps()
      ], { control: true });
    }
    // ---- 4 Headlights, 5 Taken. Nothing Rizo does changes what happens here.
    function headlightSteps() {
      return [
        S.call(() => { room.phase = "headlights"; room.engineAt = sceneTime; sound("engine"); setTransient("threat", true); cameraBeat(180, 336, 1800); }),
        S.wait(1500),
        // He knows first: the flame pulls in, he turns to the rear window.
        S.call(() => { setPose("pull-in", 2500); room.sensedAt = sceneTime; sim.player.fx = 0; sim.player.fy = 1; sound("bass"); }),
        S.wait(2500),
        // The sweep, and one held low tone.
        S.call(() => {
          setMusic(DREAD_TRACK);
          room.sweepAt = sceneTime; room.vanLights = true;
          sound("car");
          npc("van", "van", -130, 452, { face: 1 });
        }),
        S.move("van", 238, 452, 3000),
        // It parks behind. Lights off. Nothing happens.
        S.call(() => {
          room.vanLights = false; room.vanParked = sceneTime; sound("engine-off");
          // The low note belongs to the approach, not the whole kidnapping.
          // Once the van is in position, taking it away makes the five seconds
          // before the doors open feel watched instead of scored.
          setMusic(SILENT_TRACK);
        }),
        S.wait(5000),
        talk([
          { call: () => sound("door") }, { hold: 420 }, { call: () => { sound("door"); spawnHoods(); } }, { hold: 500 },
          ...L.twoMinutes, { hold: 550 },
          // One person checks the store while the others hold near the car.
          // Only after that check do they confirm what they came for.
          { call: () => lookoutReturns() }, { hold: 900 },
          L.thatHim[0], { hold: 1400 }, L.thatHim[1], { hold: 300 },
          // A face at his window.
          { call: () => cupWindow() }, { hold: 400 },
          ...L.glowing,
          { call: () => { sound("tap"); setPose("recoil", 900); room.shake = sceneTime; room.tapAt = sceneTime; } }, { hold: 650 },
          // The tap is stupid; the entry is not. Two bodies take positions at
          // the passenger door before anybody forces it.
          { call: () => stageDoorTeam() }, { hold: 900 }
        ]),
        // The door is forced: cold air, the rain loud.
        S.call(() => { room.phase = "taken"; room.passengerDoor = sceneTime; room.rainLoud = true; sound("crack"); room.shake = sceneTime; }),
        S.wait(1500),
        // The hands come in at the door and pause, then come for him: long enough to flinch from a Flare.
        S.call(() => { room.hands = { x: 236, y: 248, start: sceneTime, flinchUntil: sceneTime + 900 }; room.flares = 0; }),
        S.until(() => room.grabbed || sceneTime - room.hands.start >= BEAT.GRAB_MAX_MS),
        S.control(false),
        S.call(() => grab()),
        S.comic("grab"),
        // Do not cut away on contact: physically drag him across the passenger
        // seat toward the forced door so the player sees the abduction happen.
        S.wait(850),
        // Through the windshield: YOU at the counter, back turned. YOU does not know.
        S.call(() => { room.youCounter = true; room.peek = { x: 290, y: 60, until: sceneTime + 2500 }; }),
        S.wait(2500),
        S.call(() => { bark("hood-tall", L.bag[0], 1500); room.bagAt = sceneTime; sound("cloth"); }),
        S.wait(700),
        // The bag does not teleport him into the next scene. Stay with the
        // abduction for a few blind seconds: cloth, weight, the door, then the
        // rain going dull outside. Story carried by sound while the screen is black.
        S.fade(1, 280),
        S.call(() => {
          room.phase = "carried";
          room.rainLoud = false;
          setMusic(SILENT_TRACK);
          sound("cloth");
          sound("heart");
        }),
        S.wait(420),
        S.call(() => { room.shake = sceneTime; sound("thud"); }),
        S.wait(420),
        S.call(() => sound("slide")),
        S.wait(320),
        S.call(() => sound("door")),
        S.wait(260),
        S.call(() => sound("engine")),
        S.wait(360),
        S.call(() => sound("heart")),
        S.wait(680),
        S.call(() => commitBeat("opening:taken")),
        S.call(() => goToRoom("sack", "start", { context: "taken" }))
      ];
    }
    function spawnHoods() {
      // The driver stays in the van: heard, not seen. The other three do not
      // fan out randomly: one watches the store, one takes the window, one
      // hangs back to become the second body at the door.
      npc("driver", "none", 292, 452, { barkLift: 62 });
      npc("hood-tall", "hood-tall", 256, 470, { face: 1 });
      npc("hood-small", "hood-small", 280, 474, { face: 1 });
      npc("hood-cap", "hood-cap", 304, 470, { face: 1, state: "lookout" });
      walk("hood-tall", 286, 306, 3400);
      walk("hood-small", 268, 318, 3200);
      walk("hood-cap", 316, 176, 3600);
    }
    function lookoutReturns() {
      room.storeCheckAt = sceneTime;
      const cap = npcs.get("hood-cap");
      if (cap) { cap.face = -1; cap.state = "return"; walk("hood-cap", 300, 340, 1500); }
    }
    function stageDoorTeam() {
      room.doorTeamAt = sceneTime;
      const tall = npcs.get("hood-tall"), cap = npcs.get("hood-cap"), small = npcs.get("hood-small");
      if (tall) { tall.state = "brace"; walk("hood-tall", 250, 260, 800); }
      if (cap) { cap.state = "brace"; walk("hood-cap", 252, 286, 800); }
      if (small) walk("hood-small", 272, 302, 650);
    }
    function cupWindow() {
      walk("hood-small", 250, 268, 700);
      const small = npcs.get("hood-small");
      if (small) { small.face = -1; small.state = "cup"; }
      const tall = npcs.get("hood-tall");
      if (tall) tall.face = -1;
    }
    function grab() {
      room.grabbed = true;
      room.carryAt = sceneTime;
      room.carryFrom = { x: sim.player.x, y: sim.player.y };
      const hands = room.hands;
      if (hands) { hands.x = sim.player.x + 6; hands.y = sim.player.y - 10; hands.grabbed = true; }
      setPose("held", 6000);
      sound("grab");
      const cap = npcs.get("hood-cap");
      if (cap) cap.state = "grab";
    }
    function carFlare() {
      room.flashAt = sceneTime;
      if (room.phase === "parked") { youReact("flare"); return; }
      if (room.phase !== "taken" || !room.hands || room.grabbed) return;
      room.flares += 1;
      const hands = room.hands, p = sim.player;
      if (distance(hands, p) < 46) {
        hands.flinchUntil = sceneTime + 750;
        const dx = hands.x - p.x, dy = hands.y - p.y, d = Math.max(1, Math.hypot(dx, dy));
        hands.x = clamp(hands.x + (dx / d) * 18, 146, 232); hands.y = clamp(hands.y + (dy / d) * 18, 204, 324);
      }
      bark("hood-small", room.flares === 1 ? L.flinch[0] : L.hot[0], room.flares === 1 ? 1300 : 1700);
      for (const id of ["hood-small", "hood-cap"]) { const actor = npcs.get(id); if (actor) actor.flinchUntil = sceneTime + 700; }
    }
    function carTick(dt) {
      const p = sim.player;
      if (room.domeMs) { const k = clamp((sceneTime - room.domeAt) / room.domeMs, 0, 1); room.dome = room.domeFrom + (room.domeTo - room.domeFrom) * k; }
      if (ui === "play" && (lastMove.x || lastMove.y)) { room.moved = true; room.lastInputAt = sceneTime; }
      // His breath on the glass where he presses close.
      room.fog = clamp((room.fog || 0) + (inZone("dash") ? dt / 1500 : -dt / 5000), 0, 1);
      if (inZone("dash")) room.fogX = p.x;
      // The engine ticks as it cools; the ice machine hums.
      if (room.phase === "parked" && room.ticks < 9 && sceneTime - room.tickAt > 1300 + (room.ticks % 3) * 300) { room.tickAt = sceneTime; room.ticks += 1; sound("tick"); }
      if (sceneTime - (room.humAt || 0) > 5200) { room.humAt = sceneTime; sound("hum"); }
      for (const actor of npcs.values()) if (actor.stateUntil && sceneTime > actor.stateUntil) { actor.state = "idle"; actor.stateUntil = 0; }
      if (room.waitStart != null) {
        const t = sceneTime - room.waitStart, store = storeYou(t), atGlass = inZone("dash");
        room.you = { x: store.x, visible: store.visible, wave: Boolean(store.wave) && !room.seenYou };
        if (room.phase === "waiting" && room.you.wave && !room.waveSeen && ui === "play") { room.waveSeen = sceneTime; setPose(atGlass ? "hop" : "look-up", 1400); }
        if (!room.you.wave) room.waveSeen = 0;
        if (room.phase === "waiting") {
          // At the glass when YOU goes out of sight: pressed close; back in sight: he eases.
          if (room.youWasVisible !== null && store.visible !== room.youWasVisible && atGlass && ui === "play") setPose(store.visible ? "settle" : "press-glass", store.visible ? 800 : 2400);
          if (atGlass && store.visible && ui === "play") { room.seenFor += dt; if (room.seenFor >= BEAT.SEEN_YOU_MS) room.seenYou = true; }
          else room.seenFor = 0;
          if (!room.domeOut && t >= BEAT.DOME_TIMEOUT_MS) {
            // The dome light times out. No line, no cue: he is the only light now.
            room.domeOut = true; room.domeOutAt = sceneTime;
            dome(0, BEAT.DOME_FADE_MS);
            if (!atGlass) setPose("pull-in", 1500);
          }
          if (!room.cartDone && t >= BEAT.CART_AT_MS) { room.cartDone = true; npc("cart", "cart", 392, 122, { face: -1 }); walk("cart", -50, 126, 6500); sound("cart"); }
        }
        room.youWasVisible = store.visible;
      }
      // Hands reaching in: slow, then on him. A Flare makes them flinch back, nothing more.
      const hands = room.hands;
      if (hands && !room.grabbed && sceneTime >= hands.flinchUntil && ui === "play") {
        const dx = p.x - hands.x, dy = p.y - hands.y, d = Math.hypot(dx, dy), step = Math.min(d, (Math.min(dt, 100) / 1000) * 20);
        if (d > 0.5) { hands.x += (dx / d) * step; hands.y += (dy / d) * step; }
        if (d < 12) room.grabbed = true;
      }
      if (room.grabbed && hands) { hands.x = p.x + 6; hands.y = p.y - 10; }
      // The footwell is the darkest place in the car. Nothing is recorded.
      room.hiding = inZone("footwell") && !p.moving;
    }

    // ---- 6 The sack: black except his own glow through the cloth.
    function sackBurst(dir) {
      if (!room.limitedAt || room.freedAt || sceneTime - room.burstAt < 280) return;
      room.bursts += 1; room.burstAt = sceneTime; room.burstDir = { x: dir?.x || 0, y: dir?.y || -1 };
      sound("cloth");
    }

    // ---- 8 The gap: a held push toward the dark, or the jolt.
    function gapHold() {
      const dt = Math.max(0, sceneTime - room.gapLast);
      room.gapLast = sceneTime;
      if (sceneTime - room.gapAt >= BEAT.GAP_JOLT_MS) { room.through = "jolt"; room.shake = sceneTime; sound("bump"); return true; }
      if (ui !== "play") return false;
      const near = inZone("van-door-zone"), pushing = near && lastMove.x > 0.3;
      if (pushing) { room.push += dt; room.pushing = true; setPose("edge", 260); }
      else {
        if (room.pushing) {
          // He lets go: one step back from the dark.
          room.pushing = false; room.push = 0; room.retreats += 1;
          nudge(-10, 0);
          setPose("hesitate", 500);
        } else if (near) setPose("lean-back", 260);
      }
      if (room.push >= BEAT.GAP_PUSH_MS) { room.through = "push"; return true; }
      return false;
    }

    // ---- 9 Taillights: they come back with a light. Being seen costs nothing but fear.
    const FALLEN = { x: 172, y: 1330 };
    function startSearch() {
      room.searchAt = sceneTime; room.seenCount = 0; room.beamStop = null;
      setMusic(DREAD_TRACK);
      npc("driver", "none", 250, 772, { barkLift: 40 });
      npc("hood-tall", "hood-tall", 186, 806, { face: 1 });
      npc("hood-small", "hood-small", 166, 798, { face: 1, state: "search-phone" });
      const targetY = clamp(sim.player.y - 130, 860, 1190);
      walk("hood-tall", 178, targetY, 8200);
      walk("hood-small", 158, targetY - 24, 8600);
      room.beam = { on: true, x: 183, y: 748, angle: Math.PI / 2, length: 150, half: 0.26 };
    }
    function beamHits(beam, point) {
      const d = Math.hypot(point.x - beam.x, point.y - beam.y);
      if (d > beam.length || d < 4) return false;
      let delta = Math.atan2(point.y - beam.y, point.x - beam.x) - beam.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return Math.abs(delta) <= beam.half;
    }
    function hidingSpot(p) { return (geo().hides || []).find(rect => p.x >= rect.x - 2 && p.x <= rect.x + rect.w + 2 && p.y >= rect.y - 2 && p.y <= rect.y + rect.h + 2) || null; }
    function searchTick() {
      const holder = npcs.get("hood-small"), beam = room.beam, p = sim.player;
      if (!holder || !beam) return;
      const t = sceneTime - room.searchAt;
      beam.x = holder.x + (holder.face || 1) * 17; beam.y = holder.y - 50;
      const base = Math.atan2(FALLEN.y - beam.y, FALLEN.x - beam.x);
      let angle = reducedMotion() ? base + [-0.45, 0, 0.45][Math.floor(t / 1600) % 3] : base + Math.sin((t / 3200) * Math.PI * 2) * 0.62;
      const stopped = room.beamStop && sceneTime < room.beamStop.until;
      if (stopped) angle = Math.atan2(room.beamStop.y - beam.y, room.beamStop.x - beam.x);
      beam.angle = angle;
      // A Flare is seen from much further than he is: light carries.
      const flaring = p.act?.kind === "flare" && distance(beam, p) < 460;
      room.inBeam = beamHits(beam, p) && !room.hidden;
      if ((room.inBeam || flaring) && !(room.beamStop && sceneTime < room.beamStop.until + 1600)) {
        // Seen: the light stops on him. They are not sure. Nothing else happens.
        room.beamStop = { x: p.x, y: p.y, until: sceneTime + BEAT.SEEN_HOLD_MS };
        room.seenCount += 1;
        if (room.seenCount === 1) bark("hood-small", L.seen[0], 1700);
        setPose("tremble", BEAT.SEEN_HOLD_MS);
        sound("notice");
      }
    }
    function dropSearchPhone() {
      if (room.phone || beats().includes("opening:phone")) return;
      const small = npcs.get("hood-small");
      if (!small) return;
      const face = small.face || 1;
      room.phoneDroppedAt = sceneTime;
      room.phone = {
        x: clamp(small.x + face * 17, 34, 190),
        y: clamp(small.y - 4, 60, 1372),
        dropFromY: small.y - 50,
        dropAt: sceneTime,
        state: "dropped",
        source: "hood-small",
        at: 0, connectAt: 0, darkAt: 0, ringing: false, cycle: -1, near: false
      };
      small.state = "phone-dropped";
      room.beam = null;
      sound("phone-drop");
    }
    function hoodsLeave() {
      dropSearchPhone();
      walk("hood-tall", 200, 790, 2600);
      walk("hood-small", 214, 784, 2300);
    }
    function vanLeaves() {
      sound("door");
      for (const id of ["hood-tall", "hood-small"]) { const actor = npcs.get(id); if (actor) actor.visible = false; }
      room.beam = null;
      room.brake = false;
      walk("taillights", 250, -260, 4200);
    }
    function endSearch() {
      room.searchOver = true; room.beam = null; room.inBeam = false;
      for (const id of ["hood-tall", "hood-small", "driver", "taillights"]) npcs.delete(id);
      setMusic(SILENT_TRACK);
      commitBeat("opening:searched");
    }
    // ---- 10 The ringing: a dropped phone in the grass. Optional. Nothing explains it.
    function startPhone() {
      if (beats().includes("opening:phone") || room.phone?.state === "ringing" || room.phone?.state === "connected") return;
      if (!room.phone) {
        const p = sim.player;
        const x = clamp(p.x > 92 ? p.x - 40 : p.x + 40, 34, 142), y = clamp(p.y - 10, 60, 1372);
        room.phone = { x, y, state: "dropped", source: "resume", at: 0, connectAt: 0, darkAt: 0, ringing: false, cycle: -1, near: false };
      }
      Object.assign(room.phone, { state: "ringing", at: sceneTime, connectAt: 0, darkAt: 0, ringing: true, cycle: -1, near: false, breathed: false, listened: false, hungUp: false });
    }
    function phoneNear() {
      const phone = room.phone;
      return Boolean(phone && phone.state === "ringing" && sim?.phase === "play" && Math.hypot(phone.x - sim.player.x, phone.y - sim.player.y) - sim.player.r <= BEAT.PHONE_REACH);
    }
    function phoneTick() {
      const phone = room.phone;
      phone.near = Math.hypot(phone.x - sim.player.x, phone.y - sim.player.y) <= 70;
      if (phone.state === "ringing") {
        const t = sceneTime - phone.at, cycle = Math.floor(t / BEAT.PHONE_CYCLE_MS);
        phone.ringing = t % BEAT.PHONE_CYCLE_MS < 1800;
        if (cycle !== phone.cycle) { phone.cycle = cycle; sound("buzz"); }
        if (t >= BEAT.PHONE_RING_MS) {
          // It rings out and goes dark.
          phone.state = "dark"; phone.darkAt = sceneTime; phone.ringing = false;
          commitBeat("opening:phone");
          room.streetAt = sceneTime + 3000;
        }
      } else if (phone.state === "connected") {
        const t = sceneTime - phone.connectAt;
        if (!phone.breathed && t > 1400) {
          phone.breathed = true;
          sound("breath");
          setPose("pull-in", 900);
        }
        // The Boss, in his own words, for the first time. Calm. Then not.
        const said = phone.said || 0;
        const at = [1900, 3900, 5800];
        if (said < at.length && t > at[said]) { phone.said = said + 1; bark("boss", L.bossPhone[said], said === 2 ? 3800 : 2000); }
        if (!phone.listened && t > 3400) {
          phone.listened = true;
          sound("heart");
          flameMood("fear", 1200);
        }
        if (t >= BEAT.PHONE_CALL_MS) {
          phone.state = "dark"; phone.darkAt = sceneTime; phone.hungUp = true; phone.ringing = false;
          sound("hangup");
          room.streetAt = sceneTime + 3500;
        }
      }
    }
    // Touching it connects the call: committed first, then shown. No narration.
    function answerPhone() {
      const phone = room.phone;
      if (!phone || phone.state !== "ringing") return false;
      const outcome = commitData(next => { next.story.facts.callerConnected = true; addBeat(next, "opening:phone"); });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
      phone.state = "connected"; phone.connectAt = sceneTime; phone.ringing = false;
      room.phoneAnsweredAt = sceneTime;
      npc("boss", "none", phone.x, phone.y, { barkLift: 20 });
      setMusic(SILENT_TRACK);
      flameMood("fear", BEAT.PHONE_CALL_MS + 500);
      sound("connect");
      duck(BEAT.PHONE_CALL_MS + 700, 0.045);
      return true;
    }
    // ---- 11 A car that is not YOU.
    function startPassingCar(kind) {
      const p = sim.player;
      room.pass = { at: sceneTime, from: p.y + 330, to: p.y - 620, y: p.y + 330, kind, flinchAt: 0 };
      sound("car");
    }
    function passTick() {
      const pass = room.pass, k = (sceneTime - pass.at) / BEAT.PASS_MS;
      if (k >= 1) { room.pass = null; return; }
      pass.y = pass.from + (pass.to - pass.from) * k;
      if (pass.kind !== "walk") return;
      // Its light washes over him: he flinches, then turns and watches it go.
      if (!pass.flinchAt && pass.y < sim.player.y + 50) { pass.flinchAt = sceneTime; setPose("recoil", 700); }
      if (pass.flinchAt && !pass.watched && sceneTime - pass.flinchAt > 700) { pass.watched = true; setPose("watch", 2400); }
    }
    function roadTick() {
      const p = sim.player;
      room.hidden = Boolean(hidingSpot(p)) && p.act?.kind !== "flare";
      if (room.beam) searchTick();
      if (room.phone) phoneTick();
      if (room.pass) passTick();
      if (room.streetAt && sceneTime >= room.streetAt) { room.streetAt = 0; room.walkMode = true; setMusic(STREET_TRACK); }
      if (room.searchOver && !room.culvertAt && p.y < 260 && ui === "play") {
        room.culvertAt = sceneTime;
        faceToward(100, 0);
        setPose("notice", 700);
        view.addDraft?.(100, 18, p.x, p.y);
        sound("draft");
      }
    }

    // ---- 12 The drain, 13 the fall
    function startSlope() {
      const slope = room.slope;
      if (slope?.stage === "armed") { slipAgain(); return; }
      if (slope || room.falling) return;
      room.slope = { stage: "slip", at: sceneTime };
      room.trickleAt = sceneTime;
      sound("slip");
      setPose("slip", BEAT.SLIP_MS);
      nudge(0, -6);
    }
    function slopeTick() {
      const slope = room.slope, t = sceneTime - slope.at;
      if (slope.stage === "slip" && t >= BEAT.SLIP_MS) { slope.stage = "window"; slope.at = sceneTime; return; }
      if (slope.stage === "window") {
        // A recovery window: any move scrambles him back up. This time.
        if ((lastMove.x || lastMove.y) && ui === "play") { slope.stage = "recovered"; slope.at = sceneTime; setPose("scramble", 520); nudge(0, 14); sound("step"); return; }
        if (t >= BEAT.SCRAMBLE_MS) slipAgain();
        return;
      }
      if (slope.stage === "recovered" && t >= BEAT.SLIP_AGAIN_MS) {
        if (sim.player.y < 150) slipAgain(); else slope.stage = "armed";
      }
    }
    function slipAgain() {
      if (!room.slope || room.slope.stage === "gone") return;
      room.slope.stage = "gone";
      fallBelow();
    }
    // ---- 14 Awakening: the thought, then the dark that he lights himself.
    function thoughtNow() {
      if (room.thoughtAt == null) return null;
      const t = sceneTime - room.thoughtAt - BEAT.THOUGHT_IN_MS, fadeIn = 320;
      if (t < 0 || t > BEAT.THOUGHT_HOLD_MS + BEAT.THOUGHT_OUT_MS) return null;
      const alpha = t < fadeIn ? t / fadeIn : t < BEAT.THOUGHT_HOLD_MS ? 1 : 1 - (t - BEAT.THOUGHT_HOLD_MS) / BEAT.THOUGHT_OUT_MS;
      return { text: "home?", alpha: clamp(alpha, 0, 1) };
    }
    function slipTick() {
      const p = sim.player, landing = Content.ROOMS.slip.anchors.landing;
      if (room.thoughtArmed && ui === "play" && !scene && !p.moving && stillFor >= 800 && Math.hypot(p.x - landing.x, p.y - landing.y) <= 72) {
        // Once ever: committed before it is shown.
        room.thoughtArmed = false;
        commitBeat("thought:home");
        setPose("look-up", BEAT.THOUGHT_LOOK_MS);
        room.thoughtAt = sceneTime;
      }
    }
    // Presentation only: his light, scaled by fear and by waking (the Flame stat never changes here).
    function lightScaleNow() {
      let k = 1;
      if (room.wakeAt != null) { const t = sceneTime - room.wakeAt; k = t < BEAT.WAKE_DARK_MS ? 0 : 0.06 + 0.94 * easeOut((t - BEAT.WAKE_DARK_MS) / BEAT.WAKE_GROW_MS); }
      if (room.hiding || (room.hidden && !sim.player.moving)) k *= 0.55;
      if (room.gapAt && !room.doorOpen) k *= 0.75;
      if (room.sensedAt && sceneTime - room.sensedAt < 2500) k *= 0.7;
      if (sim.roomId === "sack") k *= 0.8;
      if (room.hurtAt != null && sceneTime - room.hurtAt < 600) k *= 0.62 + 0.38 * ((sceneTime - room.hurtAt) / 600);
      if (room.smallestAt != null && !room.smallestDone) k *= 0.5;
      if (room.loosenAt != null && sceneTime - room.loosenAt < 2600) k *= 1 + 0.18 * Math.sin(Math.PI * clamp((sceneTime - room.loosenAt) / 2600, 0, 1));
      k *= moodScale();
      if (room.firstLookAt != null && sceneTime - room.firstLookAt < 1500) k *= 0.78 + 0.22 * easeOut((sceneTime - room.firstLookAt) / 1500);
      // Below, a threat close by pulls it in a little; so does running low.
      if (!geo().world) {
        k *= 1 - 0.1 * MOOD.danger;
        if (sim.player.flame <= 1 && sim.phase === "play") k *= 0.86 + (reducedMotion() ? 0 : 0.04 * Math.sin(sceneTime / 90));
      }
      return k;
    }
    // He has no words for it; his flame says it. Fear pulls it small and
    // unsteady, relief lets it swell once, warmth (someone kind, a hearth) lifts it.
    // He turns to look at a point (presentation; only while nothing is being aimed).
    function faceToward(x, y) {
      if (!sim || sim.player.act) return;
      const dx = x - sim.player.x, dy = y - sim.player.y, d = Math.max(1, Math.hypot(dx, dy));
      sim.player.fx = dx / d; sim.player.fy = dy / d;
    }
    // ---- Direction without a map. He notices things (a turn, a catch of light,
    // a small sound). Stand still long enough and the room points for him:
    // air moving from the way on, or a glint on the thing that needs him.
    // Presentation only; nothing here is saved or changes what is open.
    const noticed = new Set();
    const BECKON_STILL_MS = 8000, BECKON_EVERY_MS = 15000;
    function quietMoment() {
      return !geo().world && ui === "play" && !scene && sim.phase === "play" && !Core.encounterActive(sim) && !thoughtNow() && MOOD.danger < 0.1;
    }
    function noticeTick(time) {
      if (!quietMoment()) return;
      const g = geo(), p = sim.player;
      if (room.arrivedAt == null) room.arrivedAt = time;
      if (time - room.arrivedAt < 900 || time - (room.noticeAt || 0) < 1600) return;
      const reach = (46 + p.flame * 8) * lightScaleNow() * 0.9, walls = Core.geoOf(sim);
      let best = null;
      for (const item of Core.interactables(sim)) {
        const key = `${g.id}:${item.id}`, d = Math.hypot(item.x - p.x, item.y - p.y);
        if (noticed.has(key) || d > reach || !Core.lineOfSight(walls, p.x, p.y, item.x, item.y)) continue;
        if (!best || d < best.d) best = { key, x: item.x, y: item.y, d };
      }
      if (!best) return;
      noticed.add(best.key); room.noticeAt = time;
      view.addEffect("glint", best.x, best.y - 6, 1);
      sound("curious");
      if (!p.moving) { faceToward(best.x, best.y); if (!poseOverride) setPose("notice", 700); }
    }
    // Where the way on is, read from what is already done.
    function wayOn() {
      const g = geo();
      const exit = id => { const e = (g.exits || []).find(item => item.id === id); return e ? { x: e.x + e.w / 2, y: e.y + e.h / 2, kind: "air" } : null; };
      const rested = data.checkpoint?.hearthId === "threshold-hearth";
      switch (g.id) {
        case "slip": return room.thoughtArmed ? null : exit("slip-to-clatter");
        case "clatter": return exit("clatter-to-hem");
        case "hem": return !fact("latchFreed") ? { x: 150, y: 218, kind: "thing" } : !rested ? exit("hem-to-hearth") : exit("hem-to-queue");
        case "hearth": return !rested ? { x: g.hearth.x, y: g.hearth.y, kind: "thing" } : fact("shortcutOpen") ? exit("hearth-to-queue") : exit("hearth-to-hem");
        case "queue": return exit("queue-to-porter");
        case "porter": return fact("porterDown") ? exit("porter-to-rows") : null;
        default: {
          if (!Content.isRows(g.id)) return null;
          const way = ROWS_WAY[g.id]?.[rowsNext()];
          if (!way) return null;
          if (way.startsWith("thing:")) { const prop = g.props.find(item => item.id === way.slice(6)); return prop ? { x: prop.x, y: prop.y, kind: "thing" } : null; }
          return exit(way);
        }
      }
    }
    // ===== WAYFINDING (v0.4): what he is trying to do, and which way it is =====
    // One answer for the whole journey, read from what is already done. The
    // HUD shows it; standing still, the room points the same way.
    function rowsNext() {
      const at = sim?.roomId;
      if (!fact("rowsLedge")) return at === "receiving" && !transient.ledgeReady ? "rowsStart" : "ledge";
      if (!done("rows:met")) return "toTable";
      if (!fact("rowsCatch")) return "tableCatch";
      if (!fact("rowsLowRoute")) return at === "hangrow" ? (fact("hangrowCrossed") || inZone("row-north") ? "lowCatch" : "rowLamp") : "toRows";
      if (!done("rows:eyelet")) return "toEyelet";
      if (!fact("rowsGrille")) return "grille";
      if (!done("rows:meal")) return at === "drytable" ? "meal" : "toMeal";
      if (!fact("rowsShutter")) return at === "press" ? (!fact("rowsPressStop") ? "stopPress" : !fact("rowsBrake") ? "brake" : "shutter") : "toPress";
      if (!done("rows:wrap")) return at === "drytable" && done("rows:upper") ? "toNell" : "toStair";
      if (!done("rows:boundary")) return at === "windowgate" ? "window" : "toWindow";
      return "window";
    }
    // Per room: which exit (or thing) the next step is through.
    const ROWS_WAY = {
      receiving: { ledge: "thing:ledge-catch", toTable: "receiving-to-table", tableCatch: "receiving-to-table", toRows: "receiving-to-table", toEyelet: "receiving-to-table", toMeal: "receiving-to-table", toPress: "receiving-to-table", toStair: "receiving-to-table", toWindow: "receiving-to-table" },
      drytable: { tableCatch: "thing:work-catch", toRows: "table-to-rows", toEyelet: "table-to-rows", grille: "table-to-rows", toPress: "table-to-tray", toStair: "table-to-tray", toWindow: "table-to-window" },
      hangrow: { lowCatch: "thing:low-catch", toEyelet: "rows-to-lowrun", grille: "rows-to-lowrun", toMeal: "rows-to-table", toPress: "rows-to-lowrun", toStair: "rows-to-lowrun", toWindow: "rows-to-table" },
      lowrun: { toEyelet: "lowrun-to-eyelet", grille: "lowrun-to-eyelet", toMeal: "lowrun-to-eyelet", toPress: "lowrun-to-eyelet", toStair: "lowrun-to-eyelet", toWindow: "lowrun-to-rows" },
      eyelet: { grille: "thing:grille-catch", toMeal: "eyelet-to-tray", toPress: "eyelet-to-press", toStair: "eyelet-to-press", toWindow: "eyelet-to-tray" },
      traypass: { toMeal: "tray-to-table", toPress: "tray-to-eyelet", toStair: "tray-to-eyelet", toWindow: "tray-to-table" },
      press: { stopPress: null, brake: "thing:brake-release", shutter: "thing:shutter-release", toStair: "press-to-upper", toMeal: "press-to-eyelet", toWindow: "press-to-eyelet" },
      upper: { toStair: "upper-to-stair", toNell: "upper-to-stair", toWindow: "upper-to-stair" },
      stair: { toStair: "stair-to-table", toNell: "stair-to-table", toWindow: "stair-to-table" },
      windowgate: {}
    };
    function objectiveKey() {
      if (!sim || !data) return null;
      const id = sim.roomId, beatsDone = beat => beats().includes(beat);
      switch (id) {
        case "car": return room.phase === "waiting" ? "wait" : null;
        case "sack": return room.limitedAt && !room.freedAt ? "sack" : null;
        case "van": return room.doorLoose ? "gap" : room.roadAt || room.cargoCount ? "van" : null;
        case "roadside": return room.searchAt && !room.searchOver ? "hide" : room.walkStart || room.walkMode ? "shelter" : null;
        case "drain": return room.deepWarmAt ? "deeper" : null;
        case "slip": return scene?.id === "opening:landed" || (room.wakeAt != null && room.awakeAt == null) ? null : data.journal.discoveredEntryIds.includes("home-sign") ? "climb" : "findWay";
        case "clatter": return sim.enemies.some(enemy => enemy.kind === "collector") || (room.passAt != null && !room.lampAt) ? "lamp" : "climb";
        case "hem": return !fact("latchFreed") ? (room.approached || fact("jamInspected") ? "freeLatch" : "climb") : "toHearth";
        case "hearth": return data.checkpoint.hearthId !== "threshold-hearth" ? "hearth" : "toQueue";
        case "queue": return fact("porterDown") ? "porterDoor" : "queue";
        case "porter": return fact("porterDown") ? "porterDoor" : "porter";
        default: return Content.isRows(id) ? rowsNext() : beatsDone("opening:below") ? "climb" : null;
      }
    }
    function objectiveNow() {
      const key = objectiveKey();
      return key ? Content.OBJECTIVES[key] || "" : "";
    }
    const objectiveShown = () => (ui === "play" || ui === "scene") && !comic?.playing() && !thoughtNow();
    function beckonTick() {
      // The Rows are a maze of work rooms: they point sooner, and more often.
      const rows = Content.isRows(sim.roomId);
      if (!quietMoment() || stillFor < (rows ? 4500 : BECKON_STILL_MS) || sceneTime - (room.beckonAt ?? -Infinity) < (rows ? 9000 : BECKON_EVERY_MS)) return;
      const way = wayOn();
      if (!way) return;
      room.beckonAt = sceneTime;
      const p = sim.player;
      faceToward(way.x, way.y);
      if (!poseOverride) setPose("notice", 700);
      if (way.kind === "air") { view.addDraft?.(way.x, way.y, p.x, p.y); sound("draft"); }
      else { view.addEffect("glint", way.x, way.y - 6, 1); sound("curious"); }
    }
    function flameMood(kind, ms) { room.mood = { kind, at: sceneTime, ms: ms || 1600 }; }
    function relief() {
      flameMood("relief", 1900);
      if (!scene) setPose("loosen", 1300);
      sound("relief");
    }
    function moodScale() {
      const m = room.mood;
      if (!m) return 1;
      const t = sceneTime - m.at;
      if (t < 0 || t > m.ms) return 1;
      const env = Math.min(1, t / 260, (m.ms - t) / 520);
      if (m.kind === "fear") return 1 - env * (0.2 + (reducedMotion() ? 0 : 0.05 * Math.sin(sceneTime / 47) * Math.sin(sceneTime / 113)));
      if (m.kind === "relief") return 1 + 0.14 * Math.sin(Math.PI * t / m.ms);
      if (m.kind === "warm") return 1 + 0.08 * env;
      return 1;
    }
    function actorLightNow() {
      if (room.wakeAt == null) return 1;
      const t = sceneTime - room.wakeAt;
      return t < BEAT.WAKE_DARK_MS ? 0 : 0.12 + 0.88 * easeOut((t - BEAT.WAKE_DARK_MS) / BEAT.WAKE_GROW_MS);
    }

    // ===== CHAPTER 1 — MENDING ROWS (v0.2 §4–§12, condensed) =====
    // Nell is a person with her own work: she walks ahead to safe places,
    // supports loads while Rizo warms what she can't reach, keeps the
    // appointments she names, and leaves every exit open. Routes open
    // because work is done, never because of how much she is liked.
    const done = beat => beats().includes(beat);
    const choice = key => data?.story?.choices?.[key] || null;
    function setRoomFlag(name) {
      const outcome = commitData(next => { next.world.durableRoomFlags[name] = true; });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function setFactNow(name) {
      const outcome = commitData(next => { next.story.facts[name] = true; });
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    function nell(x, y, extra = {}) { return npc("nell", "nell", x, y, { face: -1, state: "work", barkLift: 86, ...extra }); }
    function nellState(state) { const actor = npcs.get("nell"); if (actor) actor.state = state; }
    function leave(id, x, y, ms) { walk(id, x, y, ms); const actor = npcs.get(id); if (actor) actor.leaveAt = sceneTime + ms; }
    // Two soft taps on a checked join: a small sound, nothing more.
    function taps() { sound("tap"); }
    const ROWS_TRACK = Object.freeze({ id: "dungeon-rows", tempo: 820, lead: [64, null, null, 67, null, null, null, null, 62, null, null, null, 64, null, null, null], bass: [40, null, null, null, 43, null, null, null], wave: "triangle" });
    // The same tune from the other side of a door: lower, softer, further.
    const ROWS_FAR_TRACK = Object.freeze({ id: "dungeon-rows-far", tempo: 820, lead: ROWS_TRACK.lead, bass: ROWS_TRACK.bass, wave: "triangle",
      beat(step, play) { const lead = ROWS_TRACK.lead[step % 16], bass = ROWS_TRACK.bass[step % 8]; if (lead != null) play(lead - 12, 0.6, 0.009, 0, "sine"); if (bass != null) play(bass, 1.2, 0.008, 0, "sine"); } });
    // The wrap, worn, shows on him in every room afterwards.
    function syncWear() { view.setWear?.(choice("rows-wrap") === "worn" ? "wrap" : null); }

    // A Kindle on a warm prop: the jammed latch, or Rows work.
    function warmTarget(id) {
      if (id === "latch-jam") { rescueLatch(); return; }
      const handler = ROWS_WARM[id];
      if (handler) handler();
    }
    const ROWS_WARM = {
      // Receiving: optional. The work lowers sooner, and Latch notices.
      "ledge-catch"() {
        const outcome = commitData(next => { next.story.facts.rowsLatchHelped = true; next.world.durableRoomFlags.rowsLedge = true; });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        setTransient("ledgeReady", false);
        sound("clunk"); taps();
        nellState("work");
        room.ledgeDone = sceneTime;
        bark("nell", L.rowsLedgeHelp[0], 1800);
        room.latchLine = sceneTime + 1900;
      },
      // The Dry Table's work support: the first small job that holds.
      "work-catch"() {
        setTransient("catchReady", false);
        sound("clunk");
        runScene("rows:catch", [
          S.call(() => { nellState("work"); taps(); }),
          S.wait(600),
          S.call(() => { setRoomFlag("rowsCatch"); bark("nell", L.rowsHolds[0], 1600); room.shake = sceneTime; }),
          S.wait(1400),
          // Round the table's right end before taking the north doorway.
          S.call(() => { nellState("walk"); walk("nell", 242, 96, 800); }),
          S.wait(850),
          S.call(() => leave("nell", 80, 30, 1200))
        ], { control: true });
      },
      // Hanging Row: the low catch at the split; then she takes the high path.
      "low-catch"() {
        setTransient("lowReady", false);
        sound("clunk");
        const outcome = commitData(next => { next.world.durableRoomFlags.rowsLowRoute = true; addBeat(next, "rows:split"); });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        runScene("rows:split", [
          S.call(() => { taps(); nellState("point"); }),
          talk([...L.rowsEyeletPromise]),
          S.call(() => { nellState("walk"); walk("nell", 120, 40, 1500); }),
          S.wait(1500),
          S.call(() => leave("nell", 44, 26, 900))
        ], { control: true });
      },
      // Eyelet: the grille's low catch, so Orr's too-big tray can go through.
      "grille-catch"() {
        setTransient("grilleReady", false);
        sound("clunk");
        const outcome = commitData(next => { next.world.durableRoomFlags.rowsGrille = true; addBeat(next, "rows:orr"); });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        room.shake = sceneTime;
        runScene("rows:grille", [
          S.wait(500),
          talk([...L.rowsTable]),
          S.call(() => { leave("orr", 10, 80, 2200); walk("nell", 60, 100, 1200); nellState("walk"); }),
          S.wait(1300),
          S.call(() => leave("nell", 10, 80, 900))
        ], { control: true });
      },
      // Press House stage 2: the brake, low on his side.
      "brake-release"() {
        setTransient("brakeReady", false);
        sound("clunk");
        setRoomFlag("rowsBrake");
        pressTest();
      },
      // The shutter: warm it, go under; she lifts.
      "shutter-release"() {
        setTransient("shutterReady", false);
        sound("clunk");
        setRoomFlag("rowsShutter");
        room.shake = sceneTime; room.shutterAt = sceneTime;
        nellState("lift");
        bark("nell", L.rowsUnder[0], 2000);
      },
      // The table remembers his height: the same end of the same job.
      "low-board"() {
        setTransient("boardReady", false);
        commitBeat("rows:job");
        taps();
        room.jobDone = sceneTime;
      }
    };

    // ---- Receiving: Latch got here first; the delivery that would not fit.
    function receivingEnter() {
      if (done("rows:arrived")) { room.dryPatch = sceneTime; if (!fact("rowsLedge")) setRoomFlag("rowsLedge"); return; }
      npc("latch", "latch", 250, 86, { face: -1 });
      nell(150, 78, { face: 1, state: "support" });
      runScene("rows:arrival", [
        S.fade(0, 400),
        S.control(true),
        // Committed at once: coming back here never replays the arrival.
        S.call(() => commitBeat("rows:arrived")),
        talk([{ pose: "look-up", ms: 1400 }, { call: () => flameMood("warm", 3200) }, { hold: 1300 }, ...(fact("sharedRest") ? L.rowsLatchHelloSat : L.rowsLatchHello), { hold: 500 }, ...L.rowsDispute,
          // He takes the packet out; the strap lifts. Give that change room.
          { call: () => { const latch = npcs.get("latch"); if (latch) latch.state = "unloaded"; room.unloaded = sceneTime; } }, { hold: 1400 },
          ...L.rowsMend, { call: () => { nellState("work"); setTransient("ledgeReady", true); } }]),
        S.until(() => room.near),
        // He comes close: she clears the dry patch for him before anything else.
        S.call(() => { nellState("clear"); room.dryPatch = sceneTime; sound("nell"); flameMood("warm", 2600); }),
        talk([...L.rowsDry, { hold: 400 }, ...L.rowsGoingUp]),
        S.until(() => room.ledgeDone || sceneTime - room.dryPatch > 14000),
        // Without his help she gets it down herself, slowly. Either way the way is open.
        S.call(() => { if (!room.ledgeDone) { setTransient("ledgeReady", false); nellState("work"); sound("clunk"); setRoomFlag("rowsLedge"); bark("nell", L.rowsLedgeSelf[0], 1800); } }),
        S.wait(room.ledgeDone ? 400 : 200),
        S.until(() => !room.latchLine || sceneTime >= room.latchLine),
        S.call(() => { if (fact("rowsLatchHelped")) bark("latch", L.rowsLedgeHelp[1], 2200); }),
        S.wait(fact("rowsLatchHelped") ? 2300 : 300),
        talk([...L.rowsLatchGoes]),
        S.call(() => { leave("latch", 160, 250, 2400); nellState("walk"); leave("nell", 316, 120, 2600); })
      ], { control: true });
    }

    // ---- The Dry Table: where she works, and where she keeps her appointments.
    function drytableEnter() {
      syncTableExtras();
      if (!done("rows:met")) { tableMeeting(); return; }
      if (!fact("rowsCatch")) { nell(238, 174, { state: "support", face: -1 }); setTransient("catchReady", true); return; }
      if (fact("rowsGrille") && !done("rows:meal")) { tableMeal(); return; }
      if (done("rows:upper") && !done("rows:wrap")) { tableReturn(); return; }
      // Interrupted after the wrap: the sheets are already moved for him.
      if (done("rows:wrap") && !fact("rowsOnward")) setRoomFlag("rowsOnward");
    }
    function syncTableExtras() {
      // Her corner repair precedes the warmed catch. Keep that care visible
      // even if he resumes between the meeting and his first job.
      if (done("rows:met")) room.cornerAt = 0;
      // The prepared low board and the angled lamp stay once she has set them.
      room.board = done("rows:upper");
      setTransient("wrapOnPeg", choice("rows-wrap") === "peg");
    }
    function tableMeeting() {
      nell(36, 170, { face: 1, state: "walk" });
      room.meetAt = sceneTime;
      runScene("rows:table", [
        S.control(true),
        S.call(() => walk("nell", 168, 104, 1800)),
        S.wait(1900),
        S.call(() => { nellState("point"); }),
        // She thinks he wants the warm room. He looks further up.
        talk([...L.rowsWarmRoom]),
        S.until(() => {
          if (!room.lookedUp && sceneTime - room.meetAt > 12000 && ui === "play") { room.lookedUp = true; setPose("look-up", 1600); }
          return room.routeLooked || (room.lookedUp && sceneTime - room.meetAt > 13600);
        }),
        S.call(() => { nellState("listen"); }),
        S.say(L.rowsFurtherUp),
        S.call(() => { nellState("fix"); sound("scrape"); room.cornerAt = sceneTime; }),
        S.wait(700),
        talk([...L.rowsCorner]),
        S.call(() => { commitBeat("rows:met"); walk("nell", 242, 104, 600); }),
        S.wait(650),
        S.call(() => walk("nell", 238, 174, 600)),
        S.wait(650),
        S.call(() => { nellState("support"); setTransient("catchReady", true); }),
        talk([...L.rowsCatchAsk])
      ], { control: true });
    }
    function tableMeal() {
      nell(168, 104, { face: -1, state: "work" });
      npc("orr", "orr", 104, 150, { face: 1, state: "tray", barkLift: 86 });
      setTransient("mealOut", true);
      runScene("rows:meal", [
        S.fade(0, 300),
        S.control(true),
        S.until(() => Math.hypot(sim.player.x - 150, sim.player.y - 200) < 110 || sceneTime - room.enteredAt > 4000),
        S.say(L.rowsMeal),
        S.call(() => { nellState("eat"); sound("plate"); }),
        S.wait(500),
        S.choice("rows-meal", [{ label: "SIT", value: "sit" }, { label: "GO", value: "go" }])
      ]);
      room.enteredAt = sceneTime;
      const current = scene;
      current.steps.find(step => step.type === "choice").onPick = value => {
        // Committed before either is shown. Neither changes what is open to him.
        const outcome = commitData(next => { next.story.choices["rows-meal"] = value; next.world.durableRoomFlags.rowsPressOpen = true; addBeat(next, "rows:meal"); });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        const after = value === "sit"
          ? [S.call(() => { room.seatFrom = { x: sim.player.x, y: sim.player.y }; room.seatAt = sceneTime; room.seatTarget = { x: 150, y: 196 }; }), S.until(() => seatWalk()), S.pose("settle", 3200), S.call(() => { duck(3200, 0.3); sound("nell"); flameMood("warm", 3200); }), S.wait(3200), S.say(L.rowsCrunchy), S.wait(800), S.control(true), talk([...L.rowsPressNext]), S.call(() => departMeal())]
          : [S.control(true), talk([...L.rowsPressNext, ...L.rowsTakeEdge]), S.call(() => departMeal())];
        current.steps.push(...after);
      };
    }
    function departMeal() {
      setTransient("mealOut", false);
      nellState("walk");
      leave("nell", 316, 250, 2600);
      const orr = npcs.get("orr"); if (orr) orr.state = "carry";
      leave("orr", 4, 170, 3200);
    }
    function tableReturn() {
      room.board = true;
      nell(176, 104, { face: -1, state: "work" });
      // She kept the appointment: committed the moment he finds her here.
      if (!done("rows:return")) commitBeat("rows:return");
      runScene("rows:return", [
        S.fade(0, 300),
        S.control(true),
        talk([L.rowsSameEnd[0]]),
        S.until(() => Math.hypot(sim.player.x - 150, sim.player.y - 186) < 44 || sceneTime - room.enteredAt > 12000),
        S.call(() => { if (Math.hypot(sim.player.x - 150, sim.player.y - 186) < 44) { setTransient("boardReady", true); bark("nell", L.rowsSameEnd[1], 2200); } room.boardAt = sceneTime; }),
        // He can take the little job, or not; she finishes it either way.
        S.until(() => room.jobDone || sceneTime - room.boardAt > 10000),
        S.call(() => { setTransient("boardReady", false); if (!room.jobDone) taps(); }),
        S.wait(900),
        S.call(() => { nellState("tired"); bark("nell", L.rowsChalk[0], 1800); setTransient("chalkOut", true); room.chalkAt = sceneTime; }),
        S.until(() => room.chalkFound || sceneTime - room.chalkAt > 8000),
        S.call(() => { setTransient("chalkOut", false); nellState("work"); if (!room.chalkFound) sound("breath"); }),
        S.wait(1200),
        S.say(L.rowsWrapOffer),
        S.choice("rows-wrap", [{ label: "WEAR IT", value: "worn" }, { label: "FOLDED", value: "folded" }, { label: "LEAVE IT", value: "peg" }], L.rowsWrapOffer[L.rowsWrapOffer.length - 1])
      ]);
      room.enteredAt = sceneTime;
      const current = scene;
      current.steps.find(step => step.type === "choice").onPick = value => {
        const outcome = commitData(next => { next.story.choices["rows-wrap"] = value; addBeat(next, "rows:wrap"); });
        if (outcome.status === "failed") renderSaveFailedPanel("moment");
        const lines = value === "worn" ? L.rowsWrapWorn : value === "folded" ? L.rowsWrapFolded : L.rowsWrapPeg;
        current.steps.push(
          S.call(() => { nellState(value === "worn" ? "fit" : "work"); if (value === "worn") { taps(); syncWear(); } setTransient("wrapOnPeg", value === "peg"); }),
          S.say(lines),
          S.call(() => { nellState("walk"); }),
          S.control(true),
          talk([...L.rowsOnward]),
          // She moves the wet sheets off the doorway on her way: the way on opens because she's going too.
          S.call(() => { walk("nell", 260, 40, 1600); }),
          S.wait(1650),
          S.call(() => { nellState("lift"); sound("cloth"); setRoomFlag("rowsOnward"); }),
          S.wait(700),
          S.call(() => { nellState("walk"); leave("nell", 260, 4, 900); })
        );
      };
    }

    // ---- Hanging Row: walking beside her; a draft in the sheets; different-sized routes.
    function hangrowEnter() {
      if (done("rows:split")) return;
      nell(60, 404, { face: -1, state: "walk" });
      room.nellStage = "entry";
      runScene("rows:hangrow", [
        S.control(true),
        S.until(() => sim.player.y < 400 || sceneTime - room.enteredAt > 2500),
        S.call(() => { walk("nell", 40, 262, 2600); room.nellStage = "refuge"; }),
        talk([{ hold: 1200 }, ...L.rowsLamp]),
        S.until(() => inZone("row-north")),
        S.call(() => { if (!fact("hangrowCrossed")) setFactNow("hangrowCrossed"); relief(); bark("nell", L.rowsLampPast[0], 2200); }),
        S.call(() => { nellState("walk"); walk("nell", 50, 120, 1500); }),
        S.wait(1500),
        S.call(() => walk("nell", 252, 104, 2000)),
        S.wait(2050),
        S.call(() => { nellState("support"); setTransient("lowReady", true); room.nellStage = "split"; }),
        talk([...L.rowsLowAsk])
      ], { control: true });
      room.enteredAt = sceneTime;
    }

    // ---- Eyelet: somebody at the other end; a tray bigger than its hatch.
    function eyeletEnter() {
      if (!done("rows:split")) return;
      if (!done("rows:eyelet")) {
        nell(132, 122, { face: -1, state: "work" });
        runScene("rows:eyelet", [
          S.control(true),
          S.until(() => inZone("eyelet-landing")),
          S.call(() => { nellState("clear"); commitBeat("rows:eyelet"); }),
          S.say(L.rowsThereYouAre),
          S.call(() => nellState("work")),
          S.wait(1600),
          S.call(() => orrArrives())
        ], { control: true });
        return;
      }
      if (!fact("rowsGrille")) { nell(70, 104, { face: -1, state: "support" }); npc("orr", "orr", 120, 96, { face: -1, state: "tray", barkLift: 86 }); setTransient("grilleReady", true); }
    }
    function orrArrives() {
      npc("orr", "orr", 304, 96, { face: -1, state: "tray", barkLift: 86 });
      walk("orr", 120, 96, 2600);
      runScene("rows:hatch", [
        S.control(true),
        S.wait(2700),
        talk([L.rowsHatch[0], { call: () => { walk("nell", 70, 104, 1400); nellState("walk"); } }, { hold: 600 }, L.rowsHatch[1], { call: () => { nellState("support"); setTransient("grilleReady", true); } }])
      ], { control: true });
    }

    // ---- Press House: an opening stays an opening; an empty job stopped together.
    function pressEnter() {
      if (!done("rows:meal")) return;
      const track = Content.ROOMS.press.track;
      room.carriage = { x: fact("rowsBrake") ? track.x1 : track.x0, dir: 1, moving: false, pauseUntil: 0, speed: 88 };
      if (fact("rowsShutter")) return;
      if (!done("rows:screen")) {
        nell(96, 306, { face: 1, state: "brace" });
        room.screen = true;
        runScene("rows:screen", [
          S.control(true),
          S.until(() => inZone("press-screen") && sim.player.y < 430),
          talk([...L.rowsWaitItOut]),
          S.wait(800),
          // One authored pass, with the screen braced and the recess open (never latched).
          S.call(() => { room.carriage.moving = true; room.carriage.once = true; sound("carriage"); }),
          S.until(() => !room.carriage.moving),
          S.call(() => { room.screen = false; nellState("work"); commitBeat("rows:screen"); }),
          talk([...L.rowsClear]),
          S.call(() => { walk("nell", 34, 300, 1200); startEmptyJob(); }),
          talk([{ hold: 600 }, ...L.rowsEmptyJob])
        ], { control: true });
        return;
      }
      if (!fact("rowsPressStop")) { nell(34, 300, { face: 1, state: "work" }); startEmptyJob(); return; }
      // Stopped: she holds the carriage at its west stop (on the near side,
      // her board across its frame) while he releases the brake at the drive end.
      if (!fact("rowsBrake")) { nell(90, 282, { face: -1, state: "support" }); setTransient("brakeReady", true); return; }
      nell(150, 70, { face: 1, state: "support" }); setTransient("shutterReady", true);
    }
    function startEmptyJob() {
      room.jobRunning = true;
      room.carriage.moving = true; room.carriage.once = false;
    }
    function pressStop() {
      if (fact("rowsPressStop")) return;
      room.jobRunning = false;
      room.stopping = true;
      setRoomFlag("rowsPressStop");
      runScene("rows:stop", [
        S.call(() => { walk("nell", 90, 282, 1200); nellState("walk"); }),
        S.until(() => !room.carriage.moving),
        S.call(() => { nellState("support"); const actor = npcs.get("nell"); if (actor) actor.face = -1; sound("clunk"); room.shake = sceneTime; }),
        talk([...L.rowsGotStop, { hold: 300 }, ...L.rowsBrakeAsk]),
        S.call(() => setTransient("brakeReady", true))
      ], { control: true });
    }
    function pressTest() {
      runScene("rows:test", [
        S.control(true),
        talk([...L.rowsTest]),
        // One test: the empty frame rides to its parked place. It waits for him to be off the track.
        S.until(() => !onTrack()),
        S.call(() => { room.carriage.target = Content.ROOMS.press.track.x1; room.carriage.moving = true; room.carriage.once = true; room.carriage.speed = 46; sound("carriage"); nellState("work"); }),
        S.until(() => !room.carriage.moving),
        S.call(() => { room.parked = sceneTime; sound("clunk"); }),
        S.wait(900),
        talk([...L.rowsParked]),
        S.call(() => { walk("nell", 150, 70, 1800); nellState("walk"); }),
        S.wait(1850),
        S.call(() => { nellState("support"); setTransient("shutterReady", true); }),
        talk([...L.rowsShutterAsk])
      ], { control: true });
    }
    function onTrack() {
      const track = Content.ROOMS.press.track;
      return Math.abs(sim.player.y - track.y) < track.half + sim.player.r;
    }
    function pressTick(dt) {
      const c = room.carriage;
      if (!c) return;
      const track = Content.ROOMS.press.track;
      if (c.moving && ui === "play" && sceneTime >= c.pauseUntil) {
        const goal = c.target ?? (c.dir > 0 ? track.x1 : track.x0);
        const step = (Math.min(dt, 100) / 1000) * c.speed * Math.sign(goal - c.x);
        c.x = Math.abs(goal - c.x) <= Math.abs(step) ? goal : c.x + step;
        if (c.x === goal) {
          // Stopping, it comes to rest at the west stop where she holds it
          // (the same place a resumed journey finds it), never at the drive end.
          if (c.once || (room.stopping && goal === track.x0)) { c.moving = false; c.target = null; room.stopping = false; }
          else { c.dir = -c.dir; c.pauseUntil = sceneTime + 700; sound("carriage"); }
        }
        // Caught on the track: knocked clear, never hurt.
        const p = sim.player;
        if (Math.abs(p.x - c.x) < 22 && onTrack() && sceneTime - (room.bumpAt || 0) > 600) {
          room.bumpAt = sceneTime;
          nudge(0, p.y < track.y ? -(p.y - (track.y - track.half - p.r - 6)) : (track.y + track.half + p.r + 6) - p.y);
          setPose("recoil", 600); sound("bump"); room.shake = sceneTime;
        }
      }
      // Stage 1 ends when the pull is gone.
      if (room.jobRunning && !sim.enemies.some(enemy => enemy.id === "press-needle" && enemy.state !== "gone")) pressStop();
    }

    // ---- Upper Landing: the high window, and the table appointment.
    function upperEnter() {
      if (done("rows:upper")) return;
      nell(160, 232, { face: -1, state: "walk" });
      runScene("rows:upper", [
        S.control(true),
        S.wait(900),
        // She holds the stair door at its middle (her board on it), clear of the doorway.
        S.call(() => walk("nell", 52, 160, 2200)),
        S.wait(2300),
        S.call(() => { nellState("support"); const actor = npcs.get("nell"); if (actor) actor.face = -1; sound("clunk"); setRoomFlag("rowsStair"); }),
        talk([...L.rowsStairHere, { hold: 500 }, ...L.rowsAtTheTable]),
        S.call(() => { commitBeat("rows:upper"); nellState("walk"); leave("nell", 8, 120, 1000); })
      ], { control: true });
    }

    // ---- Window Hall: the staffed side of CLOSED. As far as the road goes, for now.
    function windowgateEnter() {
      if (!done("rows:boundary")) {
        nell(140, 76, { face: 1, state: "work" });
        runScene("rows:closed", [
          S.control(true),
          S.wait(800),
          S.call(() => sound("chime")),
          S.wait(1600),
          talk([...L.rowsClosed]),
          S.call(() => { walk("nell", 62, 124, 2000); nellState("walk"); }),
          S.wait(2100),
          S.call(() => { nellState("sit"); npc("latch", "latch", 304, 210, { face: -1 }); walk("latch", 236, 150, 2600); }),
          S.wait(2700),
          talk([...(fact("rowsLatchHelped") ? L.rowsLatchAgainHelped : L.rowsLatchAgain)]),
          S.call(() => { leave("latch", 304, 120, 2400); room.latchGone = sceneTime; }),
          S.until(() => inZone("gate-window") || sceneTime - room.enteredAt > 26000),
          S.comic("boss-glass"),
          S.call(() => boundary())
        ], { control: true });
        room.enteredAt = sceneTime;
        return;
      }
      nell(62, 124, { face: 1, state: "sit" });
    }
    function boundary() {
      if (!done("rows:boundary")) commitBeat("rows:boundary");
      openPanel("boundary", card({
        kicker: "MENDING ROWS",
        title: "WINDOW HALL IS NEXT",
        body: esc("The window says BACK SOON. Nell sits down to wait, and leaves him the dry end of the bench. Somebody behind that counter is going to open it."),
        actions: `<button type="button" class="primary" data-dungeon-action="stay">STAY A WHILE</button><button type="button" data-dungeon-action="home">GO HOME</button>`,
        fine: esc("End of what's built so far. The journey is saved here, and picks up at this window when the next part opens.")
      }));
    }

    const ROWS_LOGIC = {
      receiving: { music: () => ROWS_TRACK, enter: receivingEnter, tick() { if (!room.near && inZone("receiving-near")) room.near = true; } },
      drytable: {
        music: () => ROWS_TRACK,
        enter: drytableEnter,
        tick() { if (!room.routeLooked && inZone("route-pull")) room.routeLooked = true; }
      },
      hangrow: {
        music: () => ROWS_TRACK,
        enter: hangrowEnter,
        tick() {
          const lamp = sim.enemies.find(enemy => enemy.id === "row-collector");
          if (lamp?.state === "spot" && !room.drySaid && npcs.has("nell")) { room.drySaid = true; bark("nell", L.rowsLamp[0], 1600); }
        }
      },
      lowrun: { music: () => ROWS_TRACK, enter() { if (!done("rows:eyelet")) setPose("look-back", 900); } },
      eyelet: { music: () => ROWS_TRACK, enter: eyeletEnter },
      traypass: { music: () => ROWS_TRACK, enter() {} },
      press: { music: () => ROWS_TRACK, enter: pressEnter, tick: pressTick },
      upper: { music: () => ROWS_TRACK, enter: upperEnter },
      stair: { music: () => ROWS_TRACK, enter() {} },
      windowgate: {
        music: () => ROWS_TRACK,
        enter: windowgateEnter,
        // The first time he drifts toward the rest of the hall, she keeps him close. Kindly.
        tick() { if (!room.farSaid && npcs.has("nell") && sim.player.x > 248 && (room.latchGone || done("rows:boundary"))) { room.farSaid = true; bark("nell", L.rowsStayNear[0], 2600); } }
      }
    };


    // The opening and every Threshold room, by stable id.
    const ROOM_LOGIC = {
      // ---- Scenes 1–5: the parked car, "Be good.", waiting, headlights, taken
      car: {
        music: () => SILENT_TRACK,
        enter(context) {
          room.dome = 0; room.domeTo = 0; room.domeMs = 0; room.reactions = []; room.fog = 0;
          if (context === "waiting") { carWaiting(true); return; }
          npc("you-seat", "you-seated", 157, 244, { face: 1 });
          carParked();
        },
        tick: carTick,
        flare: carFlare
      },
      // ---- Scene 6: the sack
      sack: {
        // The bag kills the score. Cloth, breath, body movement and the van
        // outside the fabric carry this beat instead.
        music: () => SILENT_TRACK,
        enter() {
          room.inSack = true; room.bursts = 0; room.burstAt = -1e9; room.pushing = false;
          runScene("opening:sack", [
            // Arrive in total black. Let the player hear where Rizo is before
            // the cloth and his own flame slowly become visible.
            S.call(() => {
              sceneFade = { value: 1, from: 1, to: 1, start: sceneTime, ms: 1 };
              sound("heart");
            }),
            S.wait(650),
            S.call(() => {
              sceneFade = { value: 1, from: 1, to: 0, start: sceneTime, ms: 900 };
              sound("cloth");
            }),
            S.wait(Math.max(0, BEAT.SACK_STILL_MS - 650)),
            S.control(true),
            S.call(() => { room.limitedAt = sceneTime; view.pulseKey("dpad"); }),
            S.until(() => room.bursts >= BEAT.SACK_BURSTS || sceneTime - room.limitedAt >= BEAT.SACK_MAX_MS),
            S.control(false),
            S.call(() => { room.freedAt = sceneTime; room.shake = sceneTime; sound("cloth"); }),
            S.wait(300),
            S.comic("sack"),
            S.fade(1, 120),
            S.call(() => goToRoom("van", "start", { context: "sack" }))
          ]);
        },
        tick() {
          if (!room.limitedAt || room.freedAt) return;
          const pushing = Boolean(lastMove.x || lastMove.y);
          if (pushing && !room.pushing && ui === "play") sackBurst(lastMove);
          room.pushing = pushing;
        },
        flare() { sackBurst({ x: sim.player.fx, y: sim.player.fy }); }
      },
      // ---- Scene 7: inside the van (Track A), then 8: the gap
      van: {
        // From the sack, silence follows Rizo through the cut. The moving-van
        // bed enters only after his body has visibly landed on the floor.
        music: context => context === "sack" ? SILENT_TRACK : VAN_TRACK,
        // He looks at whoever is talking, when he's still: the talk happens TO him.
        tick() { vanGaze(); },
        enter(context) {
          room.rumble = true;
          // Where people sit in a work van (nose left; see dungeon-scenery's
          // VAN): the driver at the wheel on the near side, the tall one
          // twisted round in the far seat; the small one on a milk crate and
          // the capped one on the wheel arch, backs to the far wall, facing
          // the floor where he is. Bubbles sit over their heads.
          npc("driver", "van-seat", -4, 134, { face: -1, barkDx: 0, barkLift: 66, barkBelow: true });
          npc("hood-tall", "van-seat", -4, 60, { face: 1, barkDx: 4, barkLift: 72 });
          npc("hood-small", "van-seat", 44, 46, { face: 1, barkDx: 0, barkLift: 64 });
          npc("hood-cap", "van-seat", 183, 46, { face: -1, barkDx: 0, barkLift: 62 });
          room.cargoCount = 0;
          runScene("opening:van", [
            S.fade(0, 400),
            // Out of the sack: he tumbles onto the floor. Let the silence from
            // inside the bag survive the cut before the moving road arrives.
            S.pose(context === "sack" ? "land" : "recoil", context === "sack" ? 600 : 1200),
            S.wait(320),
            S.call(() => {
              if (context === "sack") {
                sound("road");
                room.roadAt = sceneTime;
                setMusic(VAN_TRACK);
              }
            }),
            S.wait(380),
            S.control(true),
            // A breath before anyone talks: he shakes the sack off and looks around.
            S.call(() => setPose("shake", 900)),
            S.wait(1000),
            // Movement one: idiots doing a job. "Boss" is said once, lightly, and lands.
            talk([
              ...L.vanArgue, { hold: 1000 },
              weighted(L.vanTouch[0], 1.5), { hold: 300 }, ...L.vanTouch.slice(1), { pose: "look-up", ms: 1500 },
              { call: () => { room.phoneLight = "film"; } }, ...L.vanFilm, { call: () => { room.phoneLight = null; } },
              { hold: 1000 }
            ]),
            // The pothole: the cooler slides, and Tuck is learned here, as before.
            S.call(() => vanBump()),
            S.until(() => room.cargoResolved),
            S.wait(900),
            S.call(() => { if (!room.dodged) { room.cargoResolved = false; vanBump(); } }),
            S.until(() => room.cargoResolved),
            // Movement two: the number nobody says. Then a phone nobody answers.
            // Movement three: the humor dies. The screen faces the cabin, not us.
            talk([
              { hold: 900 },
              ...L.vanCooler, { hold: 1000 },
              ...L.vanNumber.slice(0, 3), weighted(L.vanNumber[3], 1.4), ...L.vanNumber.slice(4),
              // What he wants, said once, as a fear joke. Why he wants it stays unsaid.
              { hold: 500 }, ...L.vanEvery.slice(0, 1), weighted(L.vanEvery[1], 1.3), ...L.vanEvery.slice(2),
              // The job has a clock. Missing the check-in turns "Boss" from
              // vague talk into pressure that can reach the van.
              { hold: 650 }, ...L.vanCheckin,
              // Nobody laughs. Wipers only. He feels the joke end before anyone says so.
              { call: () => { vanHush("wipers"); flameMood("fear", 2800); } }, { hold: 2600 },
              quietly(L.vanAsk[0]),
              // Nobody answers. Rain.
              { call: () => vanHush("rain") }, { hold: 2200 },
              // His phone: cold light fills the van, and everyone freezes. The ring is his presence.
              { call: () => { room.phoneLight = "call"; room.phoneRinging = true; room.phoneBuzzAt = -Infinity; setPose("recoil", 900); vanHush("phone"); vanFreeze(true); flameMood("fear", 9000); } }, { hold: 1200 },
              weighted(L.vanPhone[0], 1.4), L.vanPhone[1], L.vanPhone[2],
              // Small starts to lift the phone. Tall physically stops the answer.
              { call: () => {
                  const small = npcs.get("hood-small"), tall = npcs.get("hood-tall");
                  if (small) small.state = "phone-stopped";
                  if (tall) tall.state = "stop-phone";
                  sound("cloth");
                } },
              L.vanPhone[3], { hold: 1100 },
              { call: () => { vanFreeze(true); setPose("tremble", 4000); } }, { hold: 2900 },
              // It goes dark. In the silence he looks at the one who's scared: they are afraid too.
              { call: () => { room.phoneLight = null; room.phoneRinging = false; vanHush("rain"); } }, { hold: 1200 },
              { call: () => { vanFreeze(false); vanFaceToward("hood-small"); setPose("stare", 1800); } }, { hold: 1800 },
              weighted(L.vanLost[0], 1.3), ...L.vanLost.slice(1),
              // The capped one's only words. Everyone turns to him. He looks back. Rain only.
              { call: () => vanHush("rain") }, { hold: 400 },
              weighted(L.vanListening[0], 1.4), { call: () => { vanStare(true); setPose("stare", 3000); flameMood("fear", 3000); } }, { hold: 3000 },
              { call: () => vanStare(false) }
            ]),
            S.call(() => { vanHush(null); setTransient("vanDoorLoose", true); room.doorLoose = true; sound("door"); room.shake = sceneTime; room.looseAt = sceneTime; }),
            S.until(() => inZone("van-door-zone") || sceneTime - room.looseAt > BEAT.GAP_AUTO_MS),
            // At the gap: black and rushing rain. He leans back; a held push carries him through.
            S.call(() => {
              if (!inZone("van-door-zone")) { sim.player.x = 204; sim.player.y = 96; prev = { x: 204, y: 96 }; }
              room.gapAt = sceneTime; room.gapLast = sceneTime; room.push = 0; room.pushing = false; room.retreats = 0;
            }),
            S.until(() => gapHold()),
            S.control(false),
            S.call(() => {
              room.shake = sceneTime; room.doorOpen = true; room.openAt = sceneTime;
              sound("crack");
              // The cabin does not hard-cut into a new soundtrack. The road
              // drops away first; rushing outside air carries us into rain.
              room.hush = "rain";
              setMusic(SILENT_TRACK);
              sound("wind");
            }),
            S.pose("fall", 1000),
            S.wait(450),
            S.comic("van-leap"),
            S.wait(250),
            S.fade(1, 300),
            S.call(() => commitBeat("opening:fell")),
            S.call(() => goToRoom("roadside", "fallen", { context: "fell" }))
          ]);
        }
      },
      // ---- Scenes 9–11: taillights, the ringing, the lonely walk
      roadside: {
        music: context => (context === "walk" || context === "back" || context === "resume" ? STREET_TRACK : SILENT_TRACK),
        enter(context) {
          room.rain = 1;
          if (context === "back" || context === "walk" || context === "resume") {
            room.walkMode = true; room.searchOver = true;
            runScene(`roadside:${context}`, [S.fade(0, 400)]);
            return;
          }
          if (context === "phone") {
            // Resumed after the search: the phone is still ringing in the grass.
            room.searchOver = true;
            runScene("roadside:phone", [S.fade(0, 600), S.wait(BEAT.PHONE_DELAY_MS), S.call(() => startPhone())], { control: true });
            return;
          }
          npc("taillights", "taillights", 250, 1180, {});
          runScene("opening:separation", [
            S.fade(1, 1),
            S.call(() => { room.blackRain = true; sound("rain"); }),
            S.wait(1300),
            S.call(() => walk("taillights", 250, 760, 3400)),
            S.pose("lying", 99999),
            S.fade(0, 1400),
            S.wait(900),
            // He gets up when the player asks him to.
            S.until(() => lastMove.x || lastMove.y),
            S.pose("getup", 700),
            S.wait(650),
            S.call(() => { poseOverride = null; room.walkStart = sceneTime; room.blackRain = false; }),
            S.control(true),
            // Far up the road, the taillights stop. Brake red. Two doors.
            S.wait(2000),
            S.call(() => { room.brake = true; sound("brake"); }),
            S.comic("taillights"),
            S.wait(700),
            S.call(() => sound("door")), S.wait(420), S.call(() => sound("door")),
            S.wait(900),
            // A phone flashlight comes back along the shoulder.
            S.call(() => startSearch()),
            talk([{ hold: 1500 }, ...L.search]),
            S.until(() => sceneTime - room.searchAt >= BEAT.SEARCH_MS),
            // Somebody else's headlights. They go.
            S.call(() => { room.leaveAt = sceneTime; startPassingCar("search"); }),
            talk([{ call: () => sound("horn") }, { hold: 300 }, L.leave[0], L.leave[1], L.leave[2], { call: () => hoodsLeave() }, L.leave[3], { call: () => vanLeaves() }]),
            S.until(() => sceneTime - room.leaveAt >= BEAT.LEAVE_MS),
            // Music off. Rain only. Nothing scripted.
            S.call(() => endSearch()),
            S.wait(BEAT.AFTER_MS + BEAT.PHONE_DELAY_MS),
            S.call(() => startPhone())
          ]);
        },
        tick: roadTick
      },
      // ---- Scene 12: shelter, and the drain going back too far
      drain: {
        music: () => SILENT_TRACK,
        enter() {
          room.rain = 0.2; room.mouthFor = 0;
          runScene("opening:shelter", [
            S.fade(0, 300),
            S.pose("shake", 900),
            S.wait(900),
            S.pose("settle", 700),
            S.call(() => {
              room.warm = sceneTime;
              flameMood("relief", 1900);
              setMusic(DRAIN_TRACK);
              sound("relief");
            })
          ]);
        },
        tick(dt) {
          const p = sim.player;
          // Once, if he stays near the mouth: headlights on the road sweep in. He flinches deeper.
          if (!room.headlightsDone && p.y > 560 && ui === "play") {
            room.mouthFor += dt;
            if (room.mouthFor >= BEAT.MOUTH_MS) { room.headlightsDone = true; room.sweepAt = sceneTime; sound("car"); setPose("recoil", 900); nudge(0, -10); flameMood("fear", 1400); }
          }
          if (!room.deepWarmAt && p.y < 250 && ui === "play") {
            room.deepWarmAt = sceneTime;
            flameMood("warm", 2200);
            sound("draft");
            if (!p.moving) setPose("notice", 700);
          }
          if (room.slope) slopeTick();
        }
      },
      // ---- The Threshold
      slip: {
        // Below starts silent. The music returns only after HOME ↑ is found.
        music: context => (context === "landed" ? null : data.journal.discoveredEntryIds.includes("home-sign") ? DUNGEON_TRACK : SILENT_TRACK),
        enter(context) {
          // The thought belongs to the awakening: only once, and only while he is still near where he landed.
          room.thoughtArmed = !beats().includes("thought:home") && (context === "landed" || !data.world.visitedRooms.includes("clatter"));
          if (context !== "landed") return;
          // A held black after impact; then a pinprick of his flame that grows back.
          runScene("opening:landed", [
            S.call(() => { sceneFade = { value: 1, from: 1, to: 1, start: sceneTime, ms: 0 }; }),
            S.wait(BEAT.LANDING_BLACK_MS),
            S.call(() => { sceneFade = { value: 0, from: 0, to: 0, start: sceneTime, ms: 0 }; room.wakeAt = sceneTime; }),
            S.pose("lying", 99999),
            S.wait(BEAT.WAKE_INPUT_MS),
            S.until(() => {
              if (!room.wakePulsed && sceneTime - room.wakeAt >= BEAT.WAKE_PULSE_MS) { room.wakePulsed = true; view.pulseKey("dpad"); }
              return Boolean(lastMove.x || lastMove.y);
            }),
            S.pose("getup", 700),
            S.wait(650),
            S.call(() => { poseOverride = null; room.awakeAt = sceneTime; }),
            S.control(true)
          ]);
        },
        tick: slipTick
      },
      clatter: {
        enter() { room.sighted = false; if (!done("clatter:pass")) clatterPass(); },
        // The first Draftling is seen at the edge of his light before it notices him.
        tick() {
          clatterPassTick();
          if (room.sighted || ui !== "play") return;
          const enemy = sim.enemies.find(item => item.kind === "draftling" && item.state !== "gone");
          if (!enemy || enemy.aware) { room.sighted = Boolean(enemy?.aware); return; }
          if (Math.hypot(enemy.x - sim.player.x, enemy.y - sim.player.y) <= 128) { room.sighted = true; room.sightedAt = sceneTime; setPose("pull-in", 1300); }
        }
      },
      hem: {
        enter() {
          if (!fact("latchFreed")) npc("latch", "latch", 190, 232, { face: -1, pinned: true });
        }
      },
      hearth: {
        music: () => HEARTH_TRACK,
        enter() {
          if (fact("latchFreed") && !fact("porterHelp")) npc("latch", "latch", 130, 196, { face: 1, seated: true });
        }
      },
      queue: {
        enter() { room.crossed = false; },
        tick() {
          if (room.crossed || ui !== "play" || !inZone("queue-north")) return;
          if (sim.enemies.some(enemy => enemy.kind === "collector" && enemy.state === "spot")) return;
          room.crossed = true;
          if (!fact("queueCrossed")) { setFactNow("queueCrossed"); relief(); }
        }
      },
      porter: {
        // Before: the hall tolls. After: the Rows, heard faintly through the open door.
        music: () => (fact("porterDown") ? ROWS_FAR_TRACK : PORTER_TRACK),
        enter() {
          if (fact("porterHelp")) npc("latch", "latch", fact("porterDown") ? 150 : 22, fact("porterDown") ? 60 : 142, { face: 1 });
          if (fact("porterDown") && !data.story.resumeScene) bark("latch", L.departure[0], 2600);
        }
      }
    };
    Object.assign(ROOM_LOGIC, ROWS_LOGIC);
    // ---- The van's staging. Accepted lines stay word-for-word; the missed
    // check-in is now an authored connective beat that makes Boss pressure causal.
    // A line can be given more time on screen or said quietly.
    const weighted = (line, weight) => ({ ...line, weight });
    const quietly = line => ({ ...line, quiet: true, weight: 1.35 });
    // What's left when the talking stops: null (engine and road), "wipers", "rain", or "phone".
    function vanHush(level) {
      room.hush = level;
      // Once the joke dies, the van leaves the lit streets (presentation only).
      if (level === "wipers") room.unlit = true;
      setMusic(level ? SILENT_TRACK : VAN_TRACK);
      if (level) duck(level === "wipers" ? 4200 : 3200, 0.02);
    }
    function vanFreeze(on) { for (const id of ["driver", "hood-tall", "hood-small", "hood-cap"]) { const actor = npcs.get(id); if (actor) actor.state = on ? "freeze" : "idle"; } }
    function vanStare(on) {
      for (const id of ["driver", "hood-tall", "hood-small", "hood-cap"]) { const actor = npcs.get(id); if (actor) actor.state = on ? "stare" : "idle"; }
      if (on) vanFaceToward(null);
    }
    // Rizo turns to someone (or, with null, back toward the whole cabin).
    function vanFaceToward(id) {
      const actor = id ? npcs.get(id) : { x: 70, y: 30 };
      if (actor) faceToward(actor.x, actor.y);
    }
    // Still, he watches whoever is talking. Moving, he looks where he goes.
    function vanGaze() {
      if (!sim || ui !== "play" || sim.player.moving || room.doorLoose || stillFor < 500) return;
      const speaking = barks[barks.length - 1];
      if (speaking && npcs.has(speaking.id)) vanFaceToward(speaking.id);
    }

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
    // ---- 13 The fall: a crack, falling in the dark, every sound gone just
    // before he lands, the handheld locking on impact, a held black.
    function fallBelow() {
      if (room.falling) return;
      room.falling = true;
      runScene("opening:fall", [
        S.call(() => { room.crack = sceneTime; sound("crack"); room.shake = sceneTime; }),
        S.pose("fall", 1200),
        S.wait(BEAT.CRACK_MS),
        S.comic("fall"),
        // His flame streaking down in the black; three glimpses of the deep (none with reduced motion: a slow dim instead).
        S.call(() => { room.fallAt = sceneTime; sceneFade = { value: sceneFade.value, from: sceneFade.value, to: 1, start: sceneTime, ms: reducedMotion() ? 1500 : 200 }; sound("wind"); }),
        S.wait(BEAT.FALL_MS - BEAT.IMPACT_SILENCE_MS),
        S.call(() => { silentUntil = sceneTime + BEAT.IMPACT_SILENCE_MS; setMusic(SILENT_TRACK); duck(BEAT.IMPACT_SILENCE_MS + SHELL_LOCK_MS + BEAT.LANDING_BLACK_MS + 1600, 0.001); }),
        S.wait(BEAT.IMPACT_SILENCE_MS),
        S.call(() => {
          // Impact. Commit first: the journey is below from here on.
          const outcome = commitData(next => {
            addBeat(next, "opening:below");
            if (!next.world.visitedRooms.includes("slip")) next.world.visitedRooms.push("slip");
            setContinuation(next, "slip", "landing", Core.T.FLAME_MAX, "room-entry");
          });
          if (outcome.status === "failed") renderSaveFailedPanel("moment");
          silentUntil = 0;
          room.fallAt = null;
          sound("thud");
          // The handheld locks on impact, not before.
          room.impactAt = sceneTime;
          shell = "locking";
          view.setShell("locking");
          setTimeout(() => sound("click"), reducedMotion() ? 60 : 380);
          try { host.event("sceneCommitted", { boundaryId: "opening-below", campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {}
        }),
        S.wait(reducedMotion() ? 160 : SHELL_LOCK_MS),
        // Still black: the landing scene holds the dark before he is seen.
        S.call(() => { enterSim("slip", "landing", Core.T.FLAME_MAX); onEnterRoom("slip", "landed"); })
      ]);
    }

    // ---- Clatter Passage (v0.4): the first collector. Meanwhile, up there, the
    // Boss sends them down; here, a cold lamp comes in at the door he needs and
    // looks for him. This one never catches (it teaches the lamp); the Boss's
    // voice on its radio sends it on to the Cold Queue.
    const CLATTER_DOOR = { x: 256, y: 4 };
    function clatterPass() {
      // The comic is the only part that holds the room. The lamp itself is a
      // room event: nothing else (his own noticing, the air pointing north)
      // waits for it.
      runScene("clatter:boss", [S.comic("boss-hands")], { control: true });
      room.passAt = sceneTime + 1400;
    }
    function clatterPassTick() {
      if (room.passAt != null && !room.lampAt && !scene && sceneTime >= room.passAt) {
        Core.spawnCollector(sim, { id: "clatter-collector", x: CLATTER_DOOR.x, y: CLATTER_DOOR.y, soft: true, patrol: [[256, 4], [256, 104], [176, 132], [104, 136], [176, 132], [256, 104], [256, 4]] });
        npc("radio", "none", CLATTER_DOOR.x, CLATTER_DOOR.y, { barkLift: 86 });
        room.lampAt = sceneTime; sound("notice"); flameMood("fear", 1800); if (!poseOverride) setPose("pull-in", 1300);
      }
      const lamp = sim.enemies.find(item => item.id === "clatter-collector");
      if (!lamp) return;
      const radio = npcs.get("radio");
      if (radio) { radio.x = lamp.x; radio.y = lamp.y; }
      // At the far end of his walk the Boss comes on the radio, and sends him on.
      if (!room.radioAt && (lamp.wp >= 4 || sceneTime - room.lampAt > 14000)) { room.radioAt = sceneTime; bark("radio", L.bossRadio[0], 2200); }
      if (room.radioAt && !room.radioSent && sceneTime - room.radioAt > 2600) { room.radioSent = true; bark("radio", L.bossRadio[1], 3000); }
      // Back out of the door it came in by: gone.
      if ((lamp.wp === 0 && sceneTime - room.lampAt > 4000 && Math.hypot(lamp.x - CLATTER_DOOR.x, lamp.y - CLATTER_DOOR.y) < 2) || sceneTime - room.lampAt > 30000) {
        sim.enemies = sim.enemies.filter(item => item !== lamp);
        npcs.delete("radio");
        commitBeat("clatter:pass");
        relief();
      }
    }

    // ===== STORY BEATS (commit first, then present) =====
    function inspect(id, kind) {
      const prop = geo().props.find(item => item.id === id);
      if (!prop) return;
      room.looked = (room.looked || 0) + 1;
      const first = !data.journal.discoveredEntryIds.includes(id);
      if (first) { data = plain(data); data.journal.discoveredEntryIds.push(id); dirty = true; }
      if (id === "you") { youReact("approach"); return; }
      if (id === "store-window") room.seenYou = true;
      // HOME ↑, found by his own light: only now does a new motif enter, and the music below returns.
      if (id === "home-sign" && first) { room.motifAt = sceneTime; MOOD.home = true; setMusic(HOME_TRACK); }
      if (kind === "npc") return talkToLatch();
      if (kind === "bowl") return coldBowl();
      if (kind === "lever") return pullLever();
      if (id === "bowl-road") setPose("approach-stop", 1100);
      // Her chalk, under the board where it rolled: he finds it, she gets it back.
      if (id === "chalk") { room.chalkFound = true; setTransient("chalkOut", false); setFactNow("rowsChalk"); sound("tap"); nellState("work"); bark("nell", L.rowsChalkFound[0], 2400); return; }
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
        S.move("latch", 276, 120, 1100),
        // At the edge of the dark he stops and looks back once. Then the hearth.
        S.call(() => { const latch = npcs.get("latch"); if (latch) latch.face = -1; faceToward(276, 112); }),
        S.wait(800),
        S.call(() => { const latch = npcs.get("latch"); if (latch) latch.face = 1; }),
        S.move("latch", 304, 116, 500, false),
        S.wait(600)
      ], { onDone: () => { npcs.delete("latch"); } });
    }
    function hearthArrival() {
      if (data.checkpoint.hearthId !== geo().hearth.id) registerHearth(geo().hearth.id);
      if (geo().id !== "hearth" || !fact("latchFreed") || fact("seatChosen") || scene) return;
      runScene("hearth-seat", [
        S.say([...L.hearthLit, ...L.seatOffer]),
        S.choice("hearth-seat", [{ label: "SIT", value: "sit" }, { label: "GO", value: "go" }], L.seatOffer[0]),
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
          // SIT earns a quiet beat after Latch's line: the fire, the two of them, nothing happening.
          ? [S.call(() => { room.seatFrom = { x: sim.player.x, y: sim.player.y }; room.seatAt = sceneTime; }), S.until(() => seatWalk()), S.pose("settle", 1800), S.say(L.sit), S.call(() => { duck(4600, 0.3); room.quietAt = sceneTime; }), S.pose("settle", 4200), S.wait(4200)]
          : [S.say(L.go)];
        current.steps.push(...rest, S.say(L.beforePorter), S.call(() => { commitData(next => { next.story.facts.beforePorterSaid = true; next.story.resumeScene = null; }); }));
      };
    }
    // SIT: the Rizo crosses to the bench beside Latch (presentation, then settles).
    // He walks there at about his own pace, so a seat across the room is a
    // few steps, not a glide; he faces where he is going, then the seat.
    function seatWalk() {
      const target = room.seatTarget || geo().anchors["hearth-seat"];
      const dx = target.x - room.seatFrom.x, dy = target.y - room.seatFrom.y;
      const ms = Math.max(700, (Math.hypot(dx, dy) / 90) * 1000);
      const k = clamp((sceneTime - room.seatAt) / ms, 0, 1);
      sim.player.x = room.seatFrom.x + dx * k;
      sim.player.y = room.seatFrom.y + dy * k;
      sim.player.moving = k < 1 && Math.hypot(dx, dy) > 4;
      if (sim.player.moving && Math.abs(dx) > 2) { sim.player.fx = Math.sign(dx); sim.player.fy = 0; }
      else { sim.player.fx = -1; sim.player.fy = 0; }
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
      // The climax (Act I locked staging): his light at its smallest, a look
      // back, nobody, silence; then Latch's alcove clunks open.
      npc("latch", "latch", 22, 142, { face: 1, expr: "urgent", pulling: true, visible: false });
      sim.flags = { ...sim.flags, alcoveOpen: false };
      room.smallestAt = sceneTime; room.smallestDone = false;
      duck(3400, 0.01);
      runScene("porter-help", [
        S.pose("look-back", 1600),
        S.wait(1600),
        S.wait(1100),
        S.call(() => { sound("clunk"); room.shake = sceneTime; room.smallestDone = true; sim.flags = simFlags(); const latch = npcs.get("latch"); latch.visible = true; latch.pulling = false; }),
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
        // The held quiet after the Porter, before anything is given.
        S.call(() => { duck(2400, 0.08); setMusic(SILENT_TRACK); flameMood("relief", 2600); }),
        S.wait(1800),
        S.move("latch", clamp(sim.player.x - 22, 50, 300), clamp(sim.player.y, 50, 220), 1100),
        S.say([...L.porterSettled, ...L.gift]),
        S.call(() => { showBanner("FIRST KNOT"); room.knotShown = sceneTime; sound("rest"); }),
        S.pose("settle", 1200),
        S.wait(1000),
        S.say(L.departure),
        S.call(() => { clearResume(); sim.flags = simFlags(); room.shake = sceneTime; sound("door"); setMusic(ROWS_FAR_TRACK); })
      ]);
    }

    // ===== SIMULATION EVENTS =====
    function handleEvents(events) {
      for (const event of events) {
        switch (event.type) {
          case "flare": sound(Content.isOpening(sim.roomId) ? "spark" : "flare"); cue.flare = true; ROOM_LOGIC[sim.roomId]?.flare?.(); break;
          case "tuck": sound("tuck"); cue.tuck = true; view.addEffect("puff", sim.player.x, sim.player.y + 4, 1); break;
          case "hit": { sound("hit"); const enemy = sim.enemies.find(item => item.id === event.id); if (enemy) view.addEffect("spark", enemy.x, enemy.y, 4); break; }
          case "deflect": { sound("deflect"); const enemy = sim.enemies.find(item => item.id === event.id); if (enemy) view.addEffect("deflect", enemy.x, enemy.y + 8, 1); break; }
          case "calmed":
            sound("calmed");
            // The last one near him settles: he lets the breath go.
            if (!sim.enemies.some(enemy => enemy.state !== "gone" && enemy.state !== "settled" && DANGER_STATES.has(enemy.state))) relief();
            // In the Rows a settled pull stays settled across reloads.
            if (Content.isRows(sim.roomId) && Content.knownEncounter(event.id) && !data.world.defeatedEncounters.includes(event.id)) commitData(next => { if (!next.world.defeatedEncounters.includes(event.id)) next.world.defeatedEncounters.push(event.id); });
            try { host.event("encounterResolved", { boundaryId: event.id, campaignId: data.campaign.id, tone: "quiet", interruption: "none" }); } catch (error) {}
            break;
          case "hurt": sound("hurt"); view.setFlame(sim.player.flame, Core.T.FLAME_MAX); room.hurtAt = sceneTime; break;
          case "bump": sound("bump"); room.bumped = true; break;
          case "cargo-done": room.cargoResolved = true; room.dodged = room.dodged || event.dodged; break;
          case "notice": sound("notice"); if (!cue.noticed) view.pulseKey("primary"); cue.noticed = true; if (!poseOverride && !scene) setPose("pull-in", 600); flameMood("fear", 1400); break;
          case "lock": sound("lock"); break;
          case "lunge": case "slide": sound("lunge"); break;
          case "lane": sound("lane"); break;
          case "pulse": sound("pulse"); break;
          case "porter-wake": sound("porter"); break;
          case "sweep": sound("sweep"); break;
          case "charge": sound("lunge"); break;
          case "spotted": sound("notice"); flameMood("fear", 1400); if (!poseOverride && !scene?.waiting) setPose("tremble", 900); break;
          case "lost": sound("curious"); break;
          case "caught": sound("hurt"); room.shake = sceneTime; room.caughtAt = sceneTime; break;
          case "porter-half": porterHelp(); break;
          case "porter-down": sound("calmed"); porterDown(); break;
          case "kindle-start": sound("kindle"); break;
          case "kindle-cancel": break;
          case "kindled": if (event.targetKind === "warm") warmTarget(event.targetId); else restAtHearth(event.hearthId); break;
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
    function onZone(id) {
      if (sim.roomId === "car") {
        if (id === "you-near") youReact("approach");
        else if (id === "dash") youReact("dash");
        else if (id === "window-side") youReact("window");
        return;
      }
      if (id === "slope" && sim.roomId === "drain") startSlope();
      else if (id === "midpoint" && sim.roomId === "roadside" && room.searchOver && !room.passedOnce && !room.pass) { room.passedOnce = true; startPassingCar("walk"); }
      else if (id === "latch-approach" && !fact("latchFreed") && !room.approached) {
        room.approached = true;
        runScene("latch-approach", [S.say(L.latchApproach)]);
      } else if (id === "hearth-arrival") {
        // Out of the dark into the warm: his flame visibly loosens (Act I locked staging).
        if (!room.loosened) { room.loosened = true; room.loosenAt = sceneTime; setPose("loosen", 2400); }
        hearthArrival();
      }
      else if (id === "bowl-near" && !room.bowlLooked) { room.bowlLooked = true; setPose("approach-stop", 1100); }
    }
    function onExit(event) {
      if (event.to === "home") { homecoming(); return; }
      const context = sim.roomId === "drain" && event.to === "roadside" ? "back" : "walk";
      const first = !Content.isOpening(event.to) && !data.world.visitedRooms.includes(event.to);
      runScene(`walk:${event.to}`, [S.fade(1, 140), S.call(() => {
        goToRoom(event.to, event.anchor, { context });
        if (first) room.firstLookAt = sceneTime;
        // onEnterRoom may replace this scene with the destination's own scene.
        // The reveal belongs to the handoff, not an old scene's cancelled next
        // step. It therefore continues even when Nell starts talking at once.
        sceneFade = { value: 1, from: 1, to: 0, start: sceneTime, ms: reducedMotion() ? 100 : first ? 480 : 240 };
      }), S.wait(reducedMotion() ? 100 : 240)]);
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
        if (hearthId === "threshold-hearth") next.story.facts.hearthKindled = true;
        addBeat(next, "hearth-arrival:registered");
        setContinuation(next, sim.roomId, hearth.spawnAnchorId, Core.T.FLAME_MAX, "hearth");
      });
      if (outcome.status === "committed") { showBanner(hearth.banner || L.hearthKnows); try { host.event("checkpointRest", { boundaryId: hearthId, campaignId: data.campaign.id, tone: "protected", interruption: "none" }); } catch (error) {} }
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
      const caught = sim.downReason === "caught";
      const target = Core.safeReturn(data);
      sim = Core.respawn(sim, { roomId: target.roomId, anchorId: target.anchorId });
      sim.flags = simFlags();
      deaths += 1;
      enterSim(target.roomId, target.anchorId, Core.T.FLAME_MAX);
      input.clear("respawn");
      pending = { primary: false, secondary: false };
      const outcome = commitData(next => setContinuation(next, target.roomId, target.anchorId, Core.T.FLAME_MAX, "respawn"));
      onEnterRoom(target.roomId, "respawn");
      showBanner(caught ? (target.resumeKind === "hearth" ? L.caught : L.caughtNoHearth) : target.resumeKind === "hearth" ? (deaths === 1 ? L.firstDown : L.rested) : L.downNoHearth);
      if (caught && npcs.has("latch")) bark("latch", L.latchCaught[0], 3600);
      if (outcome.status === "failed") renderSaveFailedPanel("moment");
    }
    // A banner is never spent under something being read: one raised as a
    // line or a choice opens (the hearth knowing him as Latch speaks) waits
    // for it to close, then has its full time. Scene beats show it at once.
    let pendingBanner = "";
    function showBanner(text) { pendingBanner = text || ""; }
    function bannerTick(time) {
      if (pendingBanner && ui !== "dialogue" && ui !== "choice" && ui !== "panel" && !holds.length) { view.banner(pendingBanner); bannerUntil = time + 2400; pendingBanner = ""; }
      if (bannerUntil && time > bannerUntil) { view.banner(""); bannerUntil = 0; }
    }

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
        // MENU from the restart question is "keep my journey".
        else if (panelKind === "restart" || panelKind === "restart-failed") cancelRestart();
        else if (ui === "play" || ui === "dialogue" || ui === "scene" || ui === "choice") { addHold("manual"); renderPausePanel(); }
      }
      if (holds.length === 0 && !exitState && comic?.playing()) {
        if (edges.primaryPressed) comic.skip(); else comic.tick(Math.min(dt, 100));
      } else if (holds.length === 0 && !exitState) {
        sceneTime += Math.min(dt, 100);
        tickNpcs(Math.min(dt, 100) / 1000);
        tickScene();
        tickRoom();
        if (sceneFade.ms) { const k = clamp((sceneTime - sceneFade.start) / sceneFade.ms, 0, 1); sceneFade.value = sceneFade.from + (sceneFade.to - sceneFade.from) * k; if (k >= 1) sceneFade.ms = 0; }
        if (poseOverride && sceneTime > poseOverride.until) poseOverride = null;
        if (pendingGift === "ready") giftScene();
      }
      if (ui === "dialogue" && holds.length === 0) {
        if (edges.primaryPressed) advanceDialogue();
        else {
          tickDialogue(time);
          // A line spoken to him closes itself a while after it is fully shown.
          if (dialogueState?.auto && dialogueState.shown >= dialogueState.lines[dialogueState.index].text.length) {
            dialogueState.fullFor += Math.min(dt, 100);
            if (dialogueState.fullFor >= dialogueState.auto) advanceDialogue();
          }
        }
      } else if (ui === "choice" && holds.length === 0 && choiceState) {
        const tap = Math.sign(edges.dirX || edges.dirY);
        const dir = Math.sign(edges.moveX || edges.moveY);
        if (tap) moveChoice(tap);
        else if (dir && dir !== choiceState.lastDir) moveChoice(dir);
        if (choiceState) choiceState.lastDir = tap || dir;
        if (edges.primaryPressed) pickChoice();
      }
      // The phone in the grass is touched, never flared at.
      if (playHadInput && ui === "play" && edges.primaryPressed && phoneNear()) { answerPhone(); edges.primaryPressed = false; }
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
      if (g.world && time - rainTickAt > 260 && !reducedMotion()) {
        rainTickAt = time;
        if (sheltered && g.rain > 0.05 && !room.rainLoud) { sound("rain-muffled"); if (g.theme !== "car" && time - dripAt > 900 + (time % 700)) { dripAt = time; sound("drip"); } }
        else if (rain > 0.05 || room.blackRain) sound("rain");
      }
      // Footfalls, quiet: wet slaps outside, a dry tick below.
      if (p.moving && sim.phase === "play" && time - stepAt > 270) { stepAt = time; sound(g.world && !sheltered && g.theme !== "van" ? "step-wet" : "step"); }
      // The hearth talks to itself; the Porter's weight lands when it moves.
      if (g.hearth && sim.hearthLit && time - crackleAt > 260 + (Math.sin(time) + 1) * 400) { crackleAt = time; sound("crackle"); }
      // The van phone keeps buzzing until it rings out.
      if (room.phoneRinging && time - room.phoneBuzzAt > 1100) { room.phoneBuzzAt = time; sound("buzz"); }
      // Inside the van: the road under the floor and the wipers, until somebody
      // says something that makes the cabin go quiet (then wipers only, then rain only).
      if (g.theme === "van" && sim.roomId === "van" && sim.phase === "play") {
        if (!room.hush && time - (room.roadAt || 0) > 420) { room.roadAt = time; sound("road"); }
        if ((!room.hush || room.hush === "wipers") && time - (room.wiperAt || 0) > 1300) { room.wiperAt = time; sound("wiper"); }
      }
      // Below: how close and how ready the nearest threat is. Music and light both listen.
      let danger = 0;
      if (!g.world && sim.phase === "play") for (const enemy of sim.enemies) {
        if (enemy.state === "gone" || enemy.state === "settled") continue;
        const near = clamp(1 - (Math.hypot(enemy.x - p.x, enemy.y - p.y) - 40) / 150, 0, 1);
        if (enemy.soft && !DANGER_STATES.has(enemy.state)) continue;
        danger = Math.max(danger, near * (DANGER_STATES.has(enemy.state) ? 1 : enemy.aware ? 0.55 : 0.2));
      }
      MOOD.danger += (danger - MOOD.danger) * clamp(dt / (danger > MOOD.danger ? 260 : 900), 0, 1);
      if (MOOD.danger < 0.01) MOOD.danger = 0;
      noticeTick(time);
      beckonTick();
      const porterEnemy = g.id === "porter" ? sim.enemies.find(enemy => enemy.kind === "porter") : null;
      if (porterEnemy && (porterEnemy.state === "reposition" || porterEnemy.state === "charge") && time - thudAt > (porterEnemy.state === "charge" ? 140 : 380)) { thudAt = time; sound("thud"); }
      stillFor = p.moving ? 0 : stillFor + dt;
      if (sheltered && !room.wasSheltered && g.world && sim.roomId !== "drain" && g.theme !== "car") setPose("shake", 800);
      room.wasSheltered = sheltered;
    }
    function draw(time, dt) {
      if (!sim) return;
      const alpha = Math.max(0, Math.min(1, acc / Core.STEP_MS));
      const pos = { x: prev.x + (sim.player.x - prev.x) * alpha, y: prev.y + (sim.player.y - prev.y) * alpha };
      const g = geo();
      // While a thought is up, or the van has gone quiet, no prompt competes with it.
      let target = ui === "play" && !thoughtNow() && !room.hush ? Core.focusTarget(sim) : null;
      if (!target && ui === "play" && phoneNear()) target = { x: room.phone.x, y: room.phone.y, r: 3, prompt: "LOOK" };
      view.render(sim, pos, time, dt / 1000, {
        npcs: [...npcs.values()].filter(actor => actor.visible),
        barks,
        sceneTime,
        room,
        peek: room.peek && sceneTime < room.peek.until ? room.peek : null,
        shake: room.shake && sceneTime - room.shake < 260 ? 1 - (sceneTime - room.shake) / 260 : 0,
        lightScale: lightScaleNow(),
        actorLight: actorLightNow(),
        thought: thoughtNow(),
        focus: target
      });
      // The phone's screen up close: only the caller's symbol, and a call timer once connected.
      const phone = sim.roomId === "roadside" ? room.phone : null;
      view.phone(phone && (phone.state === "connected" || (phone.state === "ringing" && phone.near)) ? { connected: phone.state === "connected", ringing: Boolean(phone.ringing), seconds: phone.state === "connected" ? Math.floor((sceneTime - phone.connectAt) / 1000) : 0 } : null);
      view.fallFx(room.fallAt != null ? { t: sceneTime - room.fallAt, ms: BEAT.FALL_MS } : null);
      const p = sim.player;
      if (p.fx < -0.1) facingLeft = true; else if (p.fx > 0.1) facingLeft = false;
      const act = p.act?.kind || "";
      const hurt = sim.t < p.hurtUntil;
      const curled = (room.hiding || room.hidden) && !p.moving;
      const automatic = poseOverride ? "" : curled ? "curl" : g.world && room.inRain && stillFor > 1300 ? "shiver" : p.leashed ? "look-back" : "";
      view.setPose([
        facingLeft ? "facing-left" : "facing-right",
        p.moving ? "is-moving" : "is-still",
        act === "flare" ? (g.world ? "is-spark" : "is-flare") : "", act === "tuck" ? "is-tuck" : "", act === "kindle" ? "is-kindle" : "",
        hurt ? "is-hurt" : "", sim.phase !== "play" ? "is-down" : "", holds.length ? "is-held" : "",
        poseOverride ? `pose-${poseOverride.name}` : automatic ? `pose-${automatic}` : "",
        g.world && sim.roomId !== "car" && sim.roomId !== "sack" ? "is-wet" : "", room.warm ? "is-warm" : "", room.inSack && !room.freedAt ? "in-sack" : "", room.fallAt != null ? "is-gone" : ""
      ].filter(Boolean).join(" "));
      const downFade = sim.phase === "down" ? Math.min(0.85, (sim.t - (sim.downUntil - Core.T.DOWN_MS)) / Core.T.DOWN_MS) : 0;
      view.setFade(Math.max(downFade, sceneFade.value));
      // The highlighted thing Primary would use, and the key label that says so.
      // While a thought is up nothing else speaks over it, not even a prompt.
      view.showPrompt(target, target ? `◆ ${target.prompt}` : null);
      view.setActionLabel(target ? target.prompt : ui === "dialogue" ? "NEXT" : ui === "choice" ? "PICK" : g.world ? "FLAME" : "FLARE");
      bannerTick(time);
      view.setObjective(objectiveNow(), objectiveShown());
      // Control hints are physical and brief: keys wake, nothing explains.
      if (!g.world && cue.noticed && Core.encounterActive(sim) && (!cue.flare || !cue.tuck)) view.showCue(`<span class="${cue.flare ? "done" : ""}"><i class="cue-primary"></i>FLARE <kbd>Z</kbd></span><span class="${cue.tuck ? "done" : ""}"><i class="cue-secondary"></i>TUCK <kbd>X</kbd></span>`);
      else view.showCue(null);
    }

    // QA only: the opening's presentation state, as plain data.
    function openingQA() {
      const pick = {};
      for (const key of ["phase", "reactions", "dome", "seenYou", "waitStart", "parkedAt", "sweepAt", "vanParked", "storeCheckAt", "doorTeamAt", "youOutside", "tapAt", "passengerDoor", "grabbed", "carryAt", "youCounter", "bagAt", "flares", "bursts", "limitedAt", "freedAt", "gapAt", "push", "retreats", "through", "searchAt", "inBeam", "hidden", "hiding", "seenCount", "searchOver", "leaveAt", "phoneDroppedAt", "phoneAnsweredAt", "culvertAt", "deepWarmAt", "walkMode", "passedOnce", "headlightsDone", "mouthFor", "fallAt", "wakeAt", "awakeAt", "thoughtAt", "thoughtArmed", "motifAt", "falling", "domeOut", "cartDone", "moved", "sighted", "sightedAt", "loosenAt", "quietAt", "smallestAt", "smallestDone", "hurtAt", "brake"]) if (room[key] !== undefined) pick[key] = room[key];
      if (room.you) pick.you = { ...room.you };
      if (room.hands) pick.hands = { x: room.hands.x, y: room.hands.y };
      if (room.beam) pick.beam = { x: room.beam.x, y: room.beam.y, angle: room.beam.angle };
      if (room.phone) pick.phone = { x: room.phone.x, y: room.phone.y, state: room.phone.state, source: room.phone.source, near: room.phone.near, ringing: room.phone.ringing, breathed: Boolean(room.phone.breathed), listened: Boolean(room.phone.listened), hungUp: Boolean(room.phone.hungUp) };
      if (room.pass) pick.pass = { y: room.pass.y, kind: room.pass.kind };
      if (room.slope) pick.slope = room.slope.stage;
      return plain(pick);
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
      // A proof save parked at the Porter's homecoming (or one that came home and
      // chose to go on) picks up in the Porter's room, where the door is open.
      if (data.proofComplete && (data.campaign.status === "homecoming-ready" || data.campaign.status === "complete") && !Content.isRows(cont.roomId)) cont = { roomId: "porter", safeAnchorId: "porter-entry", roomEntryFlame: Core.T.FLAME_MAX };
      const opening = Content.isOpening(cont.roomId);
      // Opening rooms resume at the last committed beat's own start: nothing
      // committed replays, and nobody resumes in a room that no longer exists.
      const [roomId, context] = opening ? openingResume(cont) : [cont.roomId, "resume"];
      const anchorId = opening ? Content.ROOMS[roomId].entryAnchor : cont.safeAnchorId;
      enterSim(roomId, anchorId, cont.roomEntryFlame);
      retryPendingRewards();
      const outcome = commitData(next => {
        next.legProfile = Core.legProfile(pet);
        setContinuation(next, roomId, anchorId, cont.roomEntryFlame, opening ? "opening" : cont.resumeKind || "room-entry");
      });
      if (outcome.status === "failed" || (fromMigration && outcome.status !== "committed")) renderSaveFailedPanel("moment");
      onEnterRoom(roomId, context);
    }
    function openingResume(cont) {
      const done = beat => beats().includes(beat);
      if (done("opening:below")) return ["slip", "resume"];
      if (done("opening:fell")) {
        if (cont.roomId === "drain") return ["drain", "resume"];
        return ["roadside", done("opening:phone") ? "walk" : done("opening:searched") ? "phone" : "fell"];
      }
      if (done("opening:taken")) return ["van", "resume"];
      return ["car", done("opening:left") ? "waiting" : "new"];
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
      // Action moments cut to a comic page drawn over the screen (story spine v0.4).
      const ComicKit = root?.RizoDungeonComic;
      if (ComicKit) comic = ComicKit.create({ mount: view.el.screen, reducedMotion: reducedMotion(), petMarkup: () => (pet ? host.petMarkup(pet, { context: "dungeon", extraClass: "comic-rizo-art", label: pet.name || "Rizo" }) : ""), lines: Content.LINES, speakers: Content.SPEAKERS });
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
        else if (data.proofComplete && data.campaign.status === "complete" && !Content.isRows(data.continuation.roomId)) {
          // The homecoming stays true. The campaign edition opens the Porter's door, so it can go on from there.
          retryPendingRewards();
          sim = Core.createSim({ roomId: "slip" });
          ui = "blocked";
          view.setShell("locked");
          view.panel(reachedHomeCard());
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
      else if (action === "stay") closePanel();
      else if (action === "onward" && ui === "blocked" && data?.proofComplete) { view.panel(null); sim = null; ui = "play"; resumeJourney(false); }
      else if (action === "home") goHome();
      else if (action === "restart-ask") {
        if (panelKind === "pause" && !Core.externalHolds(holds).length) askRestart(renderPausePanel);
        else if (ui === "blocked" && data?.proofComplete && panelKind === "") askRestart(() => { panelKind = ""; view.panel(reachedHomeCard()); });
      }
      else if (action === "restart-cancel") cancelRestart();
      else if (action === "restart" && panelKind === "restart") restartJourney();
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
      comic?.destroy();
      comic = null;
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
      resize(reason) {
        if (!view) return;
        // The hub refreshes every five seconds. Reflow its chrome without
        // cancelling a held control; actual viewport changes still clear it.
        if (view.layout() && reason !== "render") { input?.clear("resize"); pending = { primary: false, secondary: false }; }
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
        choice: choiceState ? { index: choiceState.index, options: choiceState.options.map(option => option.value), line: choiceState.line?.text || null } : null,
        settings: { ...settings },
        npcs: [...npcs.values()].map(actor => ({ id: actor.id, x: Math.round(actor.x), y: Math.round(actor.y), visible: actor.visible, state: actor.state })),
        pose: poseOverride?.name || null,
        sim: sim ? { t: sim.t, roomId: sim.roomId, phase: sim.phase, assist: sim.assist, flags: { ...sim.flags }, edges: { ...sim.edges }, zones: [...sim.zones], player: { x: sim.player.x, y: sim.player.y, flame: sim.player.flame, act: sim.player.act?.kind || null, fx: sim.player.fx, fy: sim.player.fy, attacks: sim.player.attackSeq, tuckReadyAt: sim.player.tuckReadyAt, leashed: sim.player.leashed }, enemies: sim.enemies.map(item => ({ id: item.id, kind: item.kind, state: item.state, hp: item.hp, aware: item.aware, x: item.x, y: item.y })) } : null,
        data: data ? plain(data) : null,
        petId: pet?.id || null,
        actorMarkup: view?.el.pose.innerHTML.length || 0,
        dialogue: dialogueState ? { index: dialogueState.index, shown: dialogueState.shown, lines: dialogueState.lines.length, speaker: dialogueState.lines[dialogueState.index].speaker, expr: dialogueState.lines[dialogueState.index].expr, text: dialogueState.lines[dialogueState.index].text } : null,
        barks: barks.map(entry => ({ id: entry.id, text: entry.text, quiet: Boolean(entry.quiet) })),
        depth: { mood: room.mood && sceneTime - room.mood.at <= room.mood.ms ? room.mood.kind : null, danger: Math.round(MOOD.danger * 100) / 100, home: MOOD.home, hush: room.hush ?? null, noticed: [...noticed], beckonAt: room.beckonAt ?? null, firstLookAt: room.firstLookAt ?? null, still: stillFor, facing: sim ? { x: sim.player.fx, y: sim.player.fy } : null, actors: [...npcs.values()].filter(actor => actor.visible).map(actor => ({ id: actor.id, state: actor.state, face: actor.face })) },
        sceneTime, silent: sceneTime < silentUntil, fade: sceneFade.value, impactAt: room.impactAt ?? null,
        music: musicId, transient: { ...transient }, comic: comic?.playing() || null, objective: view?.el.objective && !view.el.objective.hidden ? view.el.objective.textContent.replace("▲", "").trim() : null, lightScale: lightScaleNow(), actorLight: actorLightNow(), thought: thoughtNow(),
        opening: openingQA(),
        log: [...qaLog]
      }),
      qaTeleport(x, y) { if (!sim) return false; sim.player.x = x; sim.player.y = y; prev = { x, y }; return true; },
      // QA only: as if he had been standing still this long already.
      qaStill(ms) { stillFor = Math.max(stillFor, ms); return stillFor; },
      qaAdvance(ms, stepInput = {}) {
        if (!sim) return [];
        const all = [];
        let answered = false;
        for (let elapsed = 0, first = true; elapsed < ms; elapsed += Core.STEP_MS, first = false) {
          if (!running()) break;
          if (first && stepInput.primaryPressed && phoneNear()) answered = answerPhone();
          const events = Core.step(sim, { ...stepInput, primaryPressed: first && stepInput.primaryPressed && !answered, secondaryPressed: first && stepInput.secondaryPressed });
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
            if (Content.ROOM_FLAGS.includes(key)) next.world.durableRoomFlags[key] = value; else next.story.facts[key] = value;
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
          if (scene?.waiting === "comic") { const current = scene; current.waiting = null; comic?.skip(); if (current.control && ui === "scene") ui = "play"; advanceScene(); continue; }
          if (scene?.waiting === "time") { sceneTime = scene.until; tickScene(); continue; }
          if (scene?.waiting === "pred") { if (scene.pred()) tickScene(); else break; continue; }
          break;
        }
        return scene ? scene.id : null;
      },
      // Advances the scene clock in frame-sized slices, so every step and timer sees it pass.
      qaSceneTime(ms) {
        for (let left = Math.max(0, ms); left > 0; left -= 100) {
          const slice = Math.min(100, left);
          if (comic?.playing()) { comic.tick(slice); continue; }
          sceneTime += slice; tickNpcs(slice / 1000); tickScene(); tickRoom();
          if (poseOverride && sceneTime > poseOverride.until) poseOverride = null;
        }
        return sceneTime;
      },
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
      qaRetryPending: () => retryPendingRewards(),
      // A proof journey that walked home under the proof edition (QA only): status complete, parked at the Porter.
      qaProofHome() {
        if (!host.debug || !data?.proofComplete) return null;
        return commitData(next => { next.campaign.status = "complete"; addBeat(next, "homecoming:complete"); setContinuation(next, "porter", "porter-entry", Core.T.FLAME_MAX, "room-entry"); });
      }
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
      dungeonStillForQA: ms => need().qaStill(ms),
      dungeonCommitForQA: request => need().qaCommit(request),
      dungeonEnemyForQA: (id, patch) => need().qaEnemy(id, patch),
      dungeonCompleteFixtureForQA: options => need().qaCompleteFixture(options),
      dungeonRetryPendingForQA: () => need().qaRetryPending(),
      dungeonProofHomeForQA: () => need().qaProofHome(),
      dungeonSummaryForQA: () => Modes.summary(MODE_ID),
      // The notes an adaptive track would play over some steps, as data (no sound).
      dungeonTrackForQA: (id, from = 0, count = 16) => {
        const track = [DUNGEON_TRACK, VAN_TRACK, DRAIN_TRACK, HEARTH_TRACK, PORTER_TRACK, HOME_TRACK].find(item => item.id === id);
        if (!track) return null;
        const notes = [];
        for (let step = from; step < from + count; step += 1) track.beat(step, (note, duration, volume, delay, type) => notes.push({ step, note, volume, type }));
        return notes;
      }
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
