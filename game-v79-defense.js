

(() => {
  "use strict";
  const RIZO_RUNTIME_BUILD = "v92-release-candidate-1";
  window.__RIZO_RUNTIME_BUILD__ = RIZO_RUNTIME_BUILD;

  /*
    RIZO LIFE CORE GAME
    ===================
    This file is the hub: game state, save migration, pet simulation, rendering,
    collection/capsule logic, expeditions, sound, event binding, and the runner
    and host adapter the training games (training/) and game modes (modes/)
    play through. See ARCHITECTURE.md.

    Launch/install/ads are intentionally outside this file:
      - rizo-config.js       owner-editable IDs and switches
      - install-manager.js   PWA onboarding
      - monetization.js      AdSense/H5 adapter

    SAVE COMPATIBILITY RULE: never rename SAVE_KEY or delete migration logic
    without providing a migration. Players' pets live in localStorage.
  */

  const SaveCore = globalThis.RizoSaveCore;
  if (!SaveCore) throw new Error("RizoSaveCore failed to load before the game core.");
  const CORE_LIMITS = SaveCore.LIMITS;
  // Save keys. The v2 envelope lives under SAVE_V2_KEY. The v1 keys (SAVE_KEY,
  // SAVE_BACKUP_KEY, LEGACY_KEY) are read as migration sources and are never
  // written again, so every pre-v88 save survives untouched as a fallback and
  // as the rollback point for an older build. SAVE_KEY is still the namespace
  // for older side keys (checkpoints, warnings, pre-recovery).
  const SAVE_KEY = "rizo-life-overhaul-v2";
  const LEGACY_KEY = "rizo-life-save-v1";
  const SAVE_BACKUP_KEY = `${SAVE_KEY}:verified-backup-v1`;
  const SAVE_V2_KEY = "rizo-save-v2";
  const SAVE_V2_BACKUP_KEY = "rizo-save-v2:backup";
  const SAVE_QUARANTINE_PREFIX = "rizo-save-quarantine:";
  const SAVE_QUARANTINE_LIMIT = 5;
  const SAVE_VALIDATION_WARNING_KEY = `${SAVE_KEY}:save-validation-warning`;
  const SAVE_ENVELOPE_VERSION = SaveCore.LATEST_SAVE_VERSION;
  // Pre-v88 Defense checkpoint keys, newest first. Read once and handed to the
  // Defense mode's run store (see MODE_LEGACY_RUN_KEYS); never written.
  const LEGACY_DEFENSE_CHECKPOINT_KEYS = [`${SAVE_KEY}:defense-checkpoint-v68`, `${SAVE_KEY}:defense-checkpoint-v67`, `${SAVE_KEY}:defense-checkpoint-v66`, `${SAVE_KEY}:defense-checkpoint-v64`, `${SAVE_KEY}:defense-checkpoint-v42`];
  // State version 20: Rizo Defense's records, settings and school moved out of
  // the hub state into the Defense save slice (see modeInbox in normalizeState).
  // State version 21: Ember Beat's song bag moved to state.trainingMemory.
  const VERSION = 22;
  // Raw (unsigned) saves are trusted only if they predate save signing (v66,
  // state version 18). Bumping VERSION must never widen that trust.
  const RAW_SAVE_TRUST_BELOW = 19;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const now = () => Date.now();
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatNumber = value => Math.floor(value || 0).toLocaleString();
  const storeUrl = () => window.RIZO_CONFIG?.brand?.storeUrl || "https://rizo.store";
  let lastOverlayFocus = null;

  function syncUILock() {
    const sheetOpen = el?.bottomSheet?.classList.contains("show"), modalOpen = el?.modalOverlay?.classList.contains("show");
    const locked = adAudioHolds > 0 || sheetOpen || modalOpen || (el?.miniGameOverlay && !el.miniGameOverlay.hidden);
    document.documentElement.classList.toggle("ui-locked", Boolean(locked));
    document.body.classList.toggle("ui-locked", Boolean(locked));
    if (el?.gameShell) el.gameShell.inert = Boolean(locked);
    if (el?.originScreen) el.originScreen.inert = Boolean(locked);
    if (el?.bottomSheet) el.bottomSheet.inert = adAudioHolds > 0 || !sheetOpen || Boolean(modalOpen);
    if (el?.modalOverlay) el.modalOverlay.inert = adAudioHolds > 0 || !modalOpen;
    if (el?.miniGameOverlay) el.miniGameOverlay.inert = adAudioHolds > 0 || Boolean(sheetOpen || modalOpen);
  }

  function isUILocked() {
    return document.documentElement.classList.contains("ui-locked") ||
      Boolean(el?.bottomSheet?.classList.contains("show")) ||
      Boolean(el?.modalOverlay?.classList.contains("show")) ||
      Boolean(el?.miniGameOverlay && !el.miniGameOverlay.hidden);
  }

  function runtimeViewportSnapshot() {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const top = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const left = Math.max(0, Math.round(viewport?.offsetLeft || 0));
    const scale = Math.max(.1, Number(viewport?.scale) || 1);
    return { width, height, top, left, scale };
  }

  function syncRuntimeViewport() {
    const view = runtimeViewportSnapshot(), root = document.documentElement;
    root.style.setProperty("--rizo-vw", `${view.width}px`);
    root.style.setProperty("--rizo-vh", `${view.height}px`);
    root.style.setProperty("--rizo-vv-top", `${view.top}px`);
    root.style.setProperty("--rizo-vv-left", `${view.left}px`);
    root.style.setProperty("--rizo-vv-scale", String(view.scale));
    root.dataset.rizoOrientation = view.width > view.height ? "landscape" : "portrait";
    if (trainingRun) trainingRun.lastFrame = performance.now();
    return view;
  }

  function scheduleRuntimeViewportSync(reason = "viewport") {
    if (runtimeViewportFrame) cancelAnimationFrame(runtimeViewportFrame);
    runtimeViewportFrame = requestAnimationFrame(() => {
      runtimeViewportFrame = null;
      syncRuntimeViewport();
      globalThis.RizoModes?.resizeActive?.(reason);
    });
    clearTimeout(runtimeViewportTimer);
    runtimeViewportTimer = setTimeout(() => {
      runtimeViewportTimer = null;
      syncRuntimeViewport();
      globalThis.RizoModes?.resizeActive?.(reason);
    }, reason === "orientation" ? 280 : 120);
  }

  // A game mode's stage owns the whole viewport while it is open. (The CSS class
  // keeps its historical name; Defense was the first mode to need it.)
  function lockStageViewport() {
    if (!stageViewportScroll) stageViewportScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };
    const root = document.documentElement;
    root.style.setProperty("--rizo-lock-scroll-x", `${-(stageViewportScroll.x || 0)}px`);
    root.style.setProperty("--rizo-lock-scroll-y", `${-(stageViewportScroll.y || 0)}px`);
    root.classList.add("defense-viewport-lock");
    document.body.classList.add("defense-viewport-lock");
    syncRuntimeViewport();
  }

  function unlockStageViewport() {
    const saved = stageViewportScroll;
    stageViewportScroll = null;
    document.documentElement.classList.remove("defense-viewport-lock");
    document.body.classList.remove("defense-viewport-lock");
    document.documentElement.style.removeProperty("--rizo-lock-scroll-x");
    document.documentElement.style.removeProperty("--rizo-lock-scroll-y");
    if (saved) requestAnimationFrame(() => window.scrollTo(saved.x || 0, saved.y || 0));
  }

  function releaseStatus() {
    return {
      build: window.__RIZO_BUILD__ || "unknown",
      updateReady: releaseUpdateReady,
      hasController: Boolean(navigator.serviceWorker?.controller),
      viewportScroll: stageViewportScroll ? { ...stageViewportScroll } : null,
      suspendedAt: runtimeSuspendedAt || 0,
      suspendReason: runtimeSuspendReason || ""
    };
  }

  const CONFIG = {
    cloud: {
      enabled: false,
      provider: "none"
    }
  };

  let adAudioHolds = 0, adAudioWasRunning = false;
  const AdBridge = globalThis.RizoAdCore?.createBridge({
    enabled: () => window.RIZO_CONFIG?.ads?.enabled === true,
    canRequestAds: () => window.RizoPrivacy?.canRequestAds() === true,
    // The campaign and live runs are protected. Future mode-specific placements
    // require an explicitly reviewed host opportunity; no event auto-requests ads.
    contextSafe: () => !document.hidden && !globalThis.RizoModes?.active?.() && !mini?.active,
    placements: window.RIZO_CONFIG?.ads?.placements || {},
    timeoutMs: window.RIZO_CONFIG?.ads?.h5Games?.rewardTimeoutMs,
    requestCooldownMs: window.RIZO_CONFIG?.ads?.requestCooldownMs,
    interstitialCooldownMs: window.RIZO_CONFIG?.ads?.interstitialCooldownMs,
    maxRequestsPerSession: window.RIZO_CONFIG?.ads?.maxRequestsPerSession,
    onStart: detail => document.dispatchEvent(new CustomEvent("rizo:ad-start", { detail })),
    onEnd: detail => document.dispatchEvent(new CustomEvent("rizo:ad-end", { detail })),
    onChange: () => refreshAdSlots()
  }) || Object.freeze({
    setProvider: () => false, available: () => false, mountBanner: () => false,
    showRewarded: async () => false, showInterstitial: async () => false
  });
  window.RizoAds = AdBridge;
  window.dispatchEvent(new CustomEvent("rizo:adbridge-ready"));

  const CloudBridge = {
    provider: null,
    setProvider(provider) {
      this.provider = provider;
      CONFIG.cloud.enabled = Boolean(provider);
    },
    async signIn() {
      if (!this.provider?.signIn) return false;
      return this.provider.signIn();
    },
    async sync(payload) {
      if (!this.provider?.sync) return false;
      return this.provider.sync(payload);
    }
  };
  window.RizoCloud = CloudBridge;

  // ===== CONTENT DATABASE: collectible Rizos, food, cosmetics, lore =====
  // Variants are shared content (core/rizo-catalog.js) so game modes can read them too.
  const VARIANTS = globalThis.RizoCatalog.VARIANTS;

  const STAGES = [
    // Internal IDs remain untouched for save compatibility. Visible names are
    // ages: the same Rizo grows from a tiny baby into the canonical mature body.
    { id: "spark", name: "BABY", minXP: 0, minStats: 0, minBond: 0, nextXP: 120, scale: .38 },
    { id: "kid", name: "LITTLE", minXP: 120, minStats: 20, minBond: 10, nextXP: 400, scale: .54 },
    { id: "teen", name: "GROWING", minXP: 400, minStats: 70, minBond: 25, nextXP: 1000, scale: .71 },
    { id: "beast", name: "YOUNG", minXP: 1000, minStats: 160, minBond: 50, nextXP: 2400, scale: .86 },
    { id: "legend", name: "MATURE", minXP: 2400, minStats: 300, minBond: 80, nextXP: Infinity, scale: 1 }
  ];

  // ===== AGE + VARIANT VISUAL CALIBRATION =====
  // Stage IDs stay stable, but no stage swaps Rizo for a replacement creature.
  // Every age uses the canonical variant sprite and changes presence through
  // measured non-uniform proportions, offsets, face/accessory scale, and anchors.
  const AGE_VISUALS = {
    // Every life stage now preserves the canonical Rizo silhouette exactly.
    // Age is communicated by uniform actor scale, not by stretching the PNG.
    spark: {
      bodyX:1, bodyY:1, offsetY:0, faceScale:1, wearableScale:1, wearableRotate:0,
      shadow:{scale:.58,x:0,y:8,opacity:.72},
      anchors:{head:{x:0,y:0,scale:1},face:{x:0,y:0,scale:1},upper:{x:0,y:0,scale:1},center:{x:0,y:0,scale:1},lower:{x:0,y:0,scale:1},left:{x:0,y:0,scale:1},right:{x:0,y:0,scale:1},back:{x:0,y:0,scale:1},ground:{x:0,y:0,scale:1},effects:{x:0,y:0,scale:1}}
    },
    kid: {
      bodyX:1, bodyY:1, offsetY:0, faceScale:1, wearableScale:1, wearableRotate:0,
      shadow:{scale:.70,x:0,y:6,opacity:.78},
      anchors:{head:{x:0,y:0,scale:1},face:{x:0,y:0,scale:1},upper:{x:0,y:0,scale:1},center:{x:0,y:0,scale:1},lower:{x:0,y:0,scale:1},left:{x:0,y:0,scale:1},right:{x:0,y:0,scale:1},back:{x:0,y:0,scale:1},ground:{x:0,y:0,scale:1},effects:{x:0,y:0,scale:1}}
    },
    teen: {
      bodyX:1, bodyY:1, offsetY:0, faceScale:1, wearableScale:1, wearableRotate:0,
      shadow:{scale:.82,x:0,y:4,opacity:.84},
      anchors:{head:{x:0,y:0,scale:1},face:{x:0,y:0,scale:1},upper:{x:0,y:0,scale:1},center:{x:0,y:0,scale:1},lower:{x:0,y:0,scale:1},left:{x:0,y:0,scale:1},right:{x:0,y:0,scale:1},back:{x:0,y:0,scale:1},ground:{x:0,y:0,scale:1},effects:{x:0,y:0,scale:1}}
    },
    beast: {
      bodyX:1, bodyY:1, offsetY:0, faceScale:1, wearableScale:1, wearableRotate:0,
      shadow:{scale:.92,x:0,y:2,opacity:.91},
      anchors:{head:{x:0,y:0,scale:1},face:{x:0,y:0,scale:1},upper:{x:0,y:0,scale:1},center:{x:0,y:0,scale:1},lower:{x:0,y:0,scale:1},left:{x:0,y:0,scale:1},right:{x:0,y:0,scale:1},back:{x:0,y:0,scale:1},ground:{x:0,y:0,scale:1},effects:{x:0,y:0,scale:1}}
    },
    legend: {
      bodyX:1, bodyY:1, offsetY:0, faceScale:1, wearableScale:1, wearableRotate:0,
      shadow:{scale:1,x:0,y:0,opacity:1},
      anchors:{head:{x:0,y:0,scale:1},face:{x:0,y:0,scale:1},upper:{x:0,y:0,scale:1},center:{x:0,y:0,scale:1},lower:{x:0,y:0,scale:1},left:{x:0,y:0,scale:1},right:{x:0,y:0,scale:1},back:{x:0,y:0,scale:1},ground:{x:0,y:0,scale:1},effects:{x:0,y:0,scale:1}}
    }
  };

  // All fourteen variants are explicitly calibrated rather than assumed equal.
  // The current normalized art is already close, so corrections remain small and
  // data-driven. These values are the only variant-specific geometry layer.
  const VARIANT_VISUAL_CALIBRATION = {
    classic:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:0,anchors:{}},
    ember:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:.2,anchors:{head:{x:0,y:.2}}},
    toxic:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:-.2,anchors:{right:{x:-.3}}},
    violet:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:.15,anchors:{face:{y:.2}}},
    moss:{spriteX:0,spriteY:0,spriteScale:.995,wearableScale:1.01,wearableRotate:-.25,anchors:{head:{y:.5},back:{x:-.4}}},
    bubblegum:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:.2,anchors:{left:{x:.3}}},
    frost:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:-.1,anchors:{face:{y:.2}}},
    glitch:{spriteX:0,spriteY:0,spriteScale:.99,wearableScale:.99,wearableRotate:.35,animation:"glitch",anchors:{face:{y:.4,scale:.99},head:{y:.3}}},
    obsidian:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:-.15,glow:"obsidian",anchors:{back:{x:-.3}}},
    aurora:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:.1,glow:"aurora",anchors:{head:{x:.2}}},
    golden:{spriteX:0,spriteY:0,spriteScale:1.005,wearableScale:1.01,wearableRotate:.1,glow:"golden",anchors:{head:{y:-.2},center:{y:.2}}},
    diamond:{spriteX:0,spriteY:0,spriteScale:1,wearableScale:1,wearableRotate:0,glow:"diamond",anchors:{face:{y:.2}}},
    retro:{spriteX:0,spriteY:.35,spriteScale:.985,wearableScale:.98,wearableRotate:0,animation:"pixel",anchors:{head:{y:.8,scale:.98},face:{y:.6,scale:.98},center:{y:.7,scale:.98},back:{y:.5,scale:.98}}},
    shadow:{spriteX:0,spriteY:.45,spriteScale:.99,wearableScale:.99,wearableRotate:-.15,glow:"shadow",anchors:{head:{y:.7,scale:.99},face:{y:.7,scale:.98},center:{y:.8,scale:.99},back:{y:.6,scale:.99}}}
  };

  const ACCESSORY_ANCHOR_GROUPS = {
    none:"effects",
    beanie:"head", flower:"right", horns:"head", halo:"head", crown:"head",
    cap:"head", bow:"head", antenna:"head", leafcrown:"head", starclip:"right", bucket:"head",
    shades:"face", eyepatch:"face", goggles:"face", visor:"face", mask:"face", earmuffs:"upper",
    headphones:"upper", bandana:"lower", chain:"lower", scarf:"lower", "first-knot":"lower",
    wings:"back", cape:"back", backpack:"back"
  };

  const WEARABLE_DEFS = Object.freeze(Object.fromEntries(Object.entries(ACCESSORY_ANCHOR_GROUPS).map(([id,anchor]) => [id,{anchor}])));

  // Compatibility alias for diagnostics and older QA pages. Every stage now
  // intentionally resolves to the canonical variant sprite.
  const RIZO_FORMS = Object.fromEntries(VARIANTS.map(variant => [variant.id,
    Object.fromEntries(STAGES.map(stage => [stage.id,{variantId:variant.id,evolutionStage:stage.id,asset:variant.sprite,fallbackAsset:VARIANTS[0].sprite,...AGE_VISUALS[stage.id]}]))
  ]));
  window.RIZO_FORMS = RIZO_FORMS;

  const SKILLS = [
    { id: "speed", name: "SPEED", icon: "➤", color: "#16c8ff", games: "Rizo Rush + Skybound" },
    { id: "power", name: "POWER", icon: "◆", color: "#ff5c6c", games: "Power Tap + Ember Breaker" },
    { id: "instinct", name: "INSTINCT", icon: "☾", color: "#a46cff", games: "Spark Catch + Forage + Breaker" },
    { id: "stamina", name: "STAMINA", icon: "∞", color: "#9eff75", games: "Rain Walk + Skybound" },
    { id: "luck", name: "LUCK", icon: "✦", color: "#ffd45a", games: "Treasures + rare care" }
  ];

  const EVOLUTION_FORMS = {
    balanced: { name: "TRUE PATH", copy: "Balanced care keeps every instinct in conversation.", className: "form-balanced" },
    speed: { name: "DASH PATH", copy: "Movement, races and restless play awakened a speed affinity.", className: "form-speed" },
    power: { name: "IRON PATH", copy: "Training, bold food and stubborn confidence awakened a power affinity.", className: "form-power" },
    instinct: { name: "MOON PATH", copy: "Curiosity, sparks and strange discoveries awakened an instinct affinity.", className: "form-instinct" },
    stamina: { name: "ROOT PATH", copy: "Walks, sleep and steady care awakened a stamina affinity.", className: "form-stamina" },
    luck: { name: "FORTUNE PATH", copy: "Treasure and impossible timing awakened a luck affinity.", className: "form-luck" },
    pixel: { name: "PIXEL PATH", copy: "Old forest hardware awakened a hidden arcade affinity.", className: "form-pixel" },
    eclipse: { name: "ECLIPSE PATH", copy: "Difficult choices awakened a hidden shadow affinity.", className: "form-eclipse" },
    royal: { name: "ROYAL PATH", copy: "Golden lineage, luck and loyalty awakened a royal affinity.", className: "form-royal" },
    prism: { name: "PRISM PATH", copy: "Exceptional bond awakened a prismatic affinity.", className: "form-prism" }
  };

  const FOODS = [
    { id: "crumbs", icon: "🍞", name: "POCKET CRUMBS", description: "Free-ish. Linty. Better than nothing.", cost: 0, cooldown: 300000, hunger: 9, mood: -1, hygiene: -2, xp: 1 },
    { id: "bites", icon: "🍗", name: "RIZO BITES", description: "+22 full • dependable mystery protein.", cost: 6, hunger: 22, mood: 2, hygiene: -2, xp: 4 },
    { id: "cereal", icon: "🥣", name: "EMBER CEREAL", description: "+16 full • +5 happy • stays crunchy in fire.", cost: 10, hunger: 16, mood: 5, xp: 5 },
    { id: "moonfruit", icon: "🍓", name: "MOON FRUIT", description: "+18 full • +10 happy • glows for no reason.", cost: 15, hunger: 18, mood: 10, hygiene: -1, xp: 7 },
    { id: "pixelpizza", icon: "🍕", name: "PIXEL PIZZA", description: "+28 full • +7 happy • somehow only four pixels.", cost: 19, hunger: 28, mood: 7, hygiene: -4, xp: 8 },
    { id: "wings", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-wings.png" alt="">', name: "FOREST WINGS", description: "+34 full • +8 happy • -7 clean.", cost: 22, hunger: 34, mood: 8, hygiene: -7, xp: 10 },
    { id: "ghostmallow", icon: "☁️", name: "GHOST MALLOW", description: "+13 full • +18 happy • may whisper.", cost: 26, hunger: 13, mood: 18, xp: 11 },
    { id: "soup", icon: "🥣", name: "EMERGENCY SOUP", description: "+25 health • +16 full • tastes responsible.", cost: 30, hunger: 16, health: 25, mood: 3, xp: 5 },
    { id: "diamond", icon: "💎", name: "DIAMOND DONUT", description: "+30 full • +20 happy • offensively shiny.", cost: 55, hunger: 30, mood: 20, health: 8, xp: 18 },
    { id: "feast", icon: "🍱", name: "LEGEND FEAST", description: "+55 full • +20 happy • +15 health.", cost: 90, hunger: 55, mood: 20, health: 15, hygiene: -8, xp: 28 },
    { id: "meds", icon: "💊", name: "SUSPICIOUS MEDICINE", description: "Cures sickness and restores 18 health.", cost: 28, health: 18, cure: true, xp: 3 },
    { id: "calm", icon: "🫧", name: "CALMING FIZZ", description: "Cures tap sickness and restores +15 happy.", cost: 24, mood: 15, cure: true, calm: true, xp: 3 }
  ];

  const FOOD_TRAITS = {
    crumbs: { alignment: 0, skill: "stamina", amount: .15 },
    bites: { alignment: 0, skill: "power", amount: .35 },
    cereal: { alignment: 1, skill: "stamina", amount: .4 },
    moonfruit: { alignment: 3, skill: "instinct", amount: .7 },
    pixelpizza: { alignment: -1, skill: "speed", amount: .65 },
    wings: { alignment: -4, skill: "power", amount: .9 },
    ghostmallow: { alignment: 2, skill: "instinct", amount: .8 },
    soup: { alignment: 2, skill: "stamina", amount: .55 },
    diamond: { alignment: 1, skill: "luck", amount: 1.2 },
    feast: { alignment: 0, skill: "power", amount: 1.0 },
    meds: { alignment: 2, skill: "stamina", amount: .25 },
    calm: { alignment: 3, skill: "instinct", amount: .3 }
  };

  const ACCESSORIES = [
    { id: "none", icon: "○", name: "NO WEARABLE", description: "Rizo exactly as raised.", cost: 0, rarity: "common" },
    { id: "bandana", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-bandana.png" alt="">', name: "RED BANDANA", description: "Tiny outlaw energy.", cost: 80, rarity: "common" },
    { id: "beanie", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-beanie.png" alt="">', name: "RIZO BEANIE", description: "Official head insulation.", cost: 105, rarity: "common" },
    { id: "shades", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-shades.png" alt="">', name: "BLOCK SHADES", description: "Every bad choice now looks intentional.", cost: 120, rarity: "common" },
    { id: "flower", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-flower.png" alt="">', name: "MOON FLOWER", description: "Cute enough to lower defenses.", cost: 145, rarity: "common" },
    { id: "eyepatch", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-eyepatch.png" alt="">', name: "FOREST EYEPATCH", description: "No injury. Just lore.", cost: 165, rarity: "rare" },
    { id: "headphones", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-headphones.png" alt="">', name: "BASS HEADPHONES", description: "Only plays unreleased Rizo music.", cost: 195, rarity: "rare" },
    { id: "chain", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-chain.png" alt="">', name: "RIZO CHAIN", description: "Financial literacy left the chat.", cost: 220, rarity: "rare" },
    { id: "scarf", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-scarf.png" alt="">', name: "RAIN SCARF", description: "For dramatic forest departures.", cost: 245, rarity: "rare" },
    { id: "horns", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-horns.png" alt="">', name: "LITTLE HORNS", description: "Not evil. Merely difficult.", cost: 275, rarity: "epic" },
    { id: "halo", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-halo.png" alt="">', name: "FAKE HALO", description: "The word fake is important.", cost: 320, rarity: "epic" },
    { id: "wings", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-wings.png" alt="">', name: "NIGHT WINGS", description: "Maximum silhouette. Zero aerodynamics.", cost: 390, rarity: "epic" },
    { id: "crown", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-crown.png" alt="">', name: "TINY CROWN", description: "No kingdom. Maximum authority.", cost: 480, rarity: "legendary" },
    { id: "cap", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-cap.png" alt="">', name: "RIZO SNAPBACK", description: "The brim points toward poor decisions.", cost: 135, rarity: "common" },
    { id: "bow", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-bow.png" alt="">', name: "BIG BOW", description: "Cute enough to weaponize.", cost: 155, rarity: "rare" },
    { id: "goggles", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-goggles.png" alt="">', name: "FOREST GOGGLES", description: "For research conducted at unsafe speeds.", cost: 205, rarity: "rare" },
    { id: "antenna", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-antenna.png" alt="">', name: "SIGNAL ANTENNA", description: "Receives stations that have not launched yet.", cost: 235, rarity: "rare" },
    { id: "leafcrown", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-leafcrown.png" alt="">', name: "LEAF CROWN", description: "The forest elected him. Nobody voted.", cost: 265, rarity: "epic" },
    { id: "visor", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-visor.png" alt="">', name: "CYAN VISOR", description: "Retro future. Present-day attitude.", cost: 295, rarity: "epic" },
    { id: "cape", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-cape.png" alt="">', name: "TINY CAPE", description: "Heroism sold separately.", cost: 340, rarity: "epic" },
    { id: "backpack", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-backpack.png" alt="">', name: "WALK PACK", description: "Carries snacks, lore, and one suspicious rock.", cost: 360, rarity: "epic" },
    { id: "starclip", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-starclip.png" alt="">', name: "STAR CLIP", description: "A small reward for being objectively adorable.", cost: 410, rarity: "legendary" },
    { id: "mask", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-mask.png" alt="">', name: "NIGHT MASK", description: "Secret identity: still Rizo.", cost: 445, rarity: "legendary" },
    { id: "earmuffs", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-earmuffs.png" alt="">', name: "FROST MUFFS", description: "Warm ears. Cold stare.", cost: 520, rarity: "legendary" },
    { id: "bucket", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-bucket.png" alt="">', name: "RAIN BUCKET HAT", description: "Built for weather and accidental fame.", cost: 575, rarity: "legendary" },
    // Earned, never sold: absent from the shop until owned, and from every
    // capsule/ad pool. Granted only through a mode receipt (MODE_ENTITLEMENTS).
    { id: "first-knot", icon: '<img class="wearable-item-icon" src="./assets/wearables/thumb-first-knot.svg" alt="">', name: "FIRST KNOT", description: "Latch tied it once. You kept it.", cost: 0, rarity: "epic", earned: true }
  ];

  const ROOMS = [
    { id: "rain", icon: "☂", name: "RAIN DEN", description: "The room that remembers where you met.", cost: 0, className: "theme-rain" },
    { id: "forest", icon: "🌲", name: "ROOT HOUSE", description: "Soft moss, old secrets, no security deposit.", cost: 140, className: "theme-forest" },
    { id: "midnight", icon: "☾", name: "MIDNIGHT DEN", description: "Moonlight, quiet, suspiciously good sleep.", cost: 190, className: "theme-midnight" },
    { id: "arcade", icon: "▦", name: "PIXEL ARCADE", description: "Every surface hums in sixteen bits.", cost: 280, className: "theme-arcade" },
    { id: "neon", icon: "✦", name: "NEON CAVE", description: "Cute creature. Very serious nightclub.", cost: 360, className: "theme-neon" },
    { id: "cloud", icon: "☁", name: "CLOUD LOFT", description: "Impossible rent. Excellent natural light.", cost: 460, className: "theme-cloud" },
    { id: "golden", icon: "◆", name: "GOLD ROOM", description: "For owners who lost the plot profitably.", cost: 700, className: "theme-golden" },
    { id: "void", icon: "●", name: "VOID CHAMBER", description: "The furniture may be looking back.", cost: 950, className: "theme-void" },
    { id: "sunset", icon: "◐", name: "SUNSET ROOF", description: "Golden hour that never clocks out.", cost: 540, className: "theme-sunset" },
    { id: "snow", icon: "❄", name: "FROST CABIN", description: "Cold outside. Maximum blanket energy inside.", cost: 620, className: "theme-snow" },
    { id: "space", icon: "✧", name: "ORBIT DEN", description: "Rent is cheap when gravity is optional.", cost: 820, className: "theme-space" },
    { id: "studio", icon: "♫", name: "RIZO STUDIO", description: "Tiny speakers. Unreasonably serious sessions.", cost: 880, className: "theme-studio" }
  ];

  const BOOSTS = [
    { id: "phoenix", icon: "🧵", name: "PHOENIX THREAD", description: "Automatically offers one emergency revival.", cost: 800, stackable: true },
    { id: "growth", icon: "⚗", name: "GROWTH JUICE", description: "+80 XP. Probably not approved by anyone.", cost: 70, stackable: true },
    { id: "care", icon: "♥", name: "CARE PACKAGE", description: "+30 to every need and +15 health.", cost: 240, stackable: true },
    { id: "ad-snack", icon: "▶", name: "SPONSOR SNACK", description: "Reserved rewarded-ad care boost for a future build.", cost: null, futureAd: true }
  ];

  const ACHIEVEMENTS = [
    { id: "origin", icon: "☂", name: "TOOK IT HOME", description: "Rescue the egg from the forest.", reward: 25, test: s => s.introSeen },
    { id: "hatched", icon: "🥚", name: "IT LIVES", description: "Hatch your first Rizo.", reward: 30, test: s => s.meta.totalHatched >= 1 },
    { id: "tap100", icon: "☝", name: "CERTIFIED CLICKER", description: "Tap a Rizo 100 times.", reward: 40, test: s => s.meta.totalTaps >= 100 },
    { id: "tap1000", icon: "⚡", name: "TOUCH GRASS LATER", description: "Tap Rizo 1,000 times.", reward: 160, test: s => s.meta.totalTaps >= 1000 },
    { id: "bond50", icon: "♥", name: "ACTUALLY FRIENDS", description: "Reach 50 bond.", reward: 55, test: s => s.pet?.bond >= 50 },
    { id: "strong", icon: "💪", name: "BUILT DIFFERENT", description: "Reach 50 strength.", reward: 60, test: s => Math.max(s.pet?.strength || 0, s.pet?.skills?.power || 0) >= 50 },
    { id: "collector5", icon: "◇", name: "RIZO RESEARCHER", description: "Discover five Rizo colors.", reward: 100, test: s => Object.keys(s.collection || {}).filter(k => s.collection[k] > 0).length >= 5 },
    { id: "capsule10", icon: "◉", name: "CAPSULE PROBLEM", description: "Open ten Forest Capsules.", reward: 120, test: s => s.meta.capsules >= 10 },
    { id: "golden", icon: "✦", name: "ONE PERCENT PROBLEM", description: "Discover a Golden Rizo.", reward: 250, test: s => Boolean(s.collection.golden) },
    { id: "diamond", icon: "💎", name: "IMPOSSIBLE LITTLE GUY", description: "Discover a Diamond Rizo.", reward: 500, test: s => Boolean(s.collection.diamond) },
    { id: "legend", icon: "♛", name: "RAISED DIFFERENT", description: "Raise a Rizo to Mature.", reward: 150, test: s => s.pet?.stage === "legend" },
    { id: "week", icon: "7", name: "SHOWED UP", description: "Reach a 7-day care streak.", reward: 100, test: s => s.player.streak >= 7 },
    { id: "heat10", icon: "🔥", name: "SEASONED KEEPER", description: "Reach Heat Level 10.", reward: 180, test: s => s.season?.level >= 10 },
    { id: "walk10", icon: "☂", name: "REGULAR ROUTE", description: "Take Rizo on ten Rain Walks.", reward: 110, test: s => (s.meta?.totalWalks || 0) >= 10 },
    { id: "treasure5", icon: "🧺", name: "POCKET MUSEUM", description: "Discover five different walk treasures.", reward: 150, test: s => Object.values(s.treasures || {}).filter(Boolean).length >= 5 },
    { id: "retro", icon: "▦", name: "OLD HARDWARE", description: "Discover Retro Rizo through the Arcade Signal.", reward: 350, test: s => Boolean(s.collection.retro) },
    { id: "shadow", icon: "●", name: "SOMETHING FOLLOWED", description: "Find Shadow Rizo in the Deep Forest.", reward: 500, test: s => Boolean(s.collection.shadow) },
    { id: "rebirth", icon: "↻", name: "THE FLAME REMEMBERS", description: "Raise one Rizo into a Legacy Egg.", reward: 250, test: s => (s.meta?.rebirths || 0) >= 1 },
    { id: "bondegg", icon: "♡", name: "TWO GARDENS, ONE SPARK", description: "Create a Bond Egg from two Keeper lineages.", reward: 325, test: s => (s.meta?.bondEggs || 0) >= 1 },
    { id: "gen3", icon: "III", name: "REAL LINEAGE", description: "Reach Generation 3.", reward: 500, test: s => (s.pet?.generation || 1) >= 3 },
    { id: "hiddenform", icon: "?", name: "HIDDEN PATH", description: "Awaken a hidden Rizo path.", reward: 300, test: s => ["pixel","eclipse","royal","prism"].includes(s.pet?.form) }
  ];

  const ORIGIN_STEPS = [
    { speaker: "YOU", text: "It was raining hard enough to erase the trail behind you." },
    { speaker: "...", text: "Then something tiny cried from underneath the roots." },
    { speaker: "YOU", text: "That is either an egg or the saddest rock I have ever seen." },
    { speaker: "...", text: "The shell was warm. The little sound inside was not." },
    { speaker: "THE FOREST", text: "You could leave it here. Technically." }
  ];

  const TALK_LINES = [
    "I HAVE NO IDEA WHAT I’M DOING.",
    "YOUR SCREEN TIME IS CRAZY.",
    "I WAS BORN FOR THE DROP.",
    "TAP WITH INTENTION.",
    "WE COULD BE MAKING MONEY RIGHT NOW.",
    "I AM LITERALLY FIRE.",
    "DO NOT PUT ME IN A GROUP CHAT.",
    "THIS ROOM NEEDS BETTER MERCH.",
    "I SAW WHAT YOU BOUGHT. INTERESTING.",
    "I’M NOT A PHASE. YOU’RE A PHASE.",
    "CAN WE GO OUTSIDE OR ARE WE DECOR NOW?",
    "I WOULD LIKE A SNACK AND POSSIBLY EQUITY."
  ];

  const DEATH_INSULTS = [
    "BRO. THE GAME GAVE YOU FOUR GIANT CARE BUTTONS.",
    "YOU KILLED A FLAME. THAT TAKES TALENT.",
    "THE EGG DESERVED A BETTER ZIP CODE.",
    "YOUR NEXT RIZO HAS ALREADY REQUESTED ANOTHER OWNER.",
    "NEGLECTED BY SOMEONE WHO TAPS THEIR PHONE ALL DAY. WILD.",
    "YOU HAD ONE JOB AND SOMEHOW CLOCKED OUT.",
    "THIS IS WHY DIGITAL PETS HAVE TRUST ISSUES."
  ];

  const PERSONALITIES = ["CHAOTIC GOOD","TINY CEO","SOFT MENACE","FOREST GREMLIN","DRAMA FLAME","QUIET GENIUS","SNACK SCHOLAR","CERTIFIED HATER","LOYAL WEIRDO","MAIN CHARACTER"];
  const PERSONALITY_TRAITS = {
    "CHAOTIC GOOD":{skill:"speed",mood:.12}, "TINY CEO":{skill:"power",mood:.04},
    "SOFT MENACE":{skill:"luck",mood:.10}, "FOREST GREMLIN":{skill:"instinct",mood:.08},
    "DRAMA FLAME":{skill:"instinct",mood:.14}, "QUIET GENIUS":{skill:"instinct",mood:.03},
    "SNACK SCHOLAR":{skill:"stamina",mood:.10}, "CERTIFIED HATER":{skill:"power",mood:.02},
    "LOYAL WEIRDO":{skill:"stamina",mood:.07}, "MAIN CHARACTER":{skill:"luck",mood:.13}
  };
  const MUTATIONS = [
    { id: "normal", weight: 92, name: "NORMAL SPARK" },
    { id: "starborn", weight: 4.5, name: "STARBORN" },
    { id: "stormmarked", weight: 3, name: "STORM-MARKED" },
    { id: "hollow", weight: .5, name: "HOLLOW FLAME" }
  ];
  const LORE_FRAGMENTS = [
    { id:"signal", title:"THE RIZO SIGNAL", text:"Every Rizo hears a low blue signal beneath heavy rain. Nobody knows who keeps transmitting it." },
    { id:"first", title:"THE FIRST FLAME", text:"The first Rizo was not born. It appeared in the smoke above an unfinished shirt and refused to leave." },
    { id:"eggs", title:"WHY EGGS CRY", text:"An unclaimed egg remembers every footstep that passed without stopping." },
    { id:"gold", title:"GOLDEN FEVER", text:"Golden Rizos collect shiny objects, compliments, and deeply irresponsible financial habits." },
    { id:"diamond", title:"THE DIAMOND MYTH", text:"A Diamond Rizo forms only when a storm reflects through a perfectly cared-for flame. Or so the forest claims." },
    { id:"void", title:"THE VOID DEN", text:"The Void Chamber was found already furnished. Nobody ordered the furniture." },
    { id:"glitch", title:"ERROR: RIZO", text:"Glitch Rizos occasionally remember choices the player has not made yet." },
    { id:"keeper", title:"THE KEEPERS", text:"A Keeper is anyone strange enough to carry a crying egg home instead of minding their business." },
    { id:"threads", title:"PHOENIX THREAD", text:"A black spool marked R can stitch one flame back into the world. It never works twice the same way." },
    { id:"apparel", title:"THE OUTSIDE BRAND", text:"Somewhere beyond the glass, humans wear the same marks the Rizos dream about." },
    { id:"obsidian", title:"OBSIDIAN SILENCE", text:"Obsidian Rizos do not cast shadows. Their shadows cast them." },
    { id:"forest", title:"THE DEEP WOODS", text:"Past the thirtieth tree, rain falls upward and every abandoned egg has a name." },
    { id:"retro", title:"THE OLD CARTRIDGE", text:"Retro Rizo was first seen inside a game cartridge with no label, no console, and a save file dated tomorrow." },
    { id:"shadow", title:"THE SHADOW FOLLOWER", text:"A Shadow Rizo cannot be bought or rolled. It chooses a Keeper after watching them in the Deep Forest." },
    { id:"rebirth", title:"LEGACY EGGS", text:"A loved flame does not end. It folds its strongest habits into a new shell and asks to be raised differently." },
    { id:"bond-eggs", title:"THE FRIENDSHIP SPARK", text:"When two mature Rizos trust their Keepers, their gardens can preserve a shared spark. The next Legacy Egg inherits bounded potential from both lineages without replacing either pet." }
  ];


  // Walk-only treasures create a second collection loop beyond color variants.
  const WALK_TREASURES = [
    { id:"blue-button", icon:"●", name:"BLUE BUTTON", rarity:"COMMON", weight:28 },
    { id:"smooth-rock", icon:"◆", name:"SUSPICIOUSLY SMOOTH ROCK", rarity:"COMMON", weight:24 },
    { id:"lost-tag", icon:"⌑", name:"LOST RIZO TAG", rarity:"UNCOMMON", weight:16 },
    { id:"moon-leaf", icon:"☾", name:"MOON LEAF", rarity:"UNCOMMON", weight:12 },
    { id:"tiny-key", icon:"⚿", name:"TINY KEY", rarity:"RARE", weight:8 },
    { id:"storm-bottle", icon:"ϟ", name:"BOTTLED STORM", rarity:"RARE", weight:5 },
    { id:"gold-thread", icon:"⌁", name:"GOLD THREAD", rarity:"EPIC", weight:3 },
    { id:"diamond-seed", icon:"◇", name:"DIAMOND SEED", rarity:"SECRET", weight:1 }
  ];

  // Short optional scenes keep long sessions surprising without blocking care.
  // Misfortune entries share the same trigger/resolution path, but carry a
  // deliberately tiny selection weight and never award the normal event Heat.
  const WORLD_EVENTS = [
    { id:"window-letter", icon:"✉", kicker:"A RANDOM KNOCK", title:"A LETTER HIT THE WINDOW", text:"It is addressed to Rizo in handwriting that looks exactly like rain.", choices:[
      { id:"open", label:"OPEN IT", result:"Inside: a tiny coupon, a wet leaf, and R 35.", effect:{embers:35,bond:4,mood:4,alignment:-1,skill:"luck",gain:.45}, memory:"Rizo received mail from a sender listed only as THE FOREST." },
      { id:"save", label:"SAVE IT FOR LORE", result:"The ink rearranged itself into a Forest Archive signal.", effect:{lore:1,bond:3,alignment:2,skill:"instinct",gain:.8}, memory:"You archived a letter that refused to keep the same words." }
    ]},
    { id:"sock-case", icon:"▰", kicker:"DEN MYSTERY", title:"THE SOCK IS MISSING", text:"Rizo is standing near an empty drawer and acting aggressively innocent.", choices:[
      { id:"investigate", label:"INVESTIGATE", result:"The sock was behind the toy box. Rizo found R 22 inside it.", effect:{embers:22,bond:5,alignment:1,skill:"instinct",gain:.55}, memory:"Solved the Case of the Extremely Obvious Sock." },
      { id:"approve", label:"ACCEPT THE LORE", result:"Rizo has claimed the sock as a cape. Happiness wins over evidence.", effect:{mood:12,hype:8,alignment:-2,skill:"luck",gain:.4}, memory:"Allowed Rizo to turn stolen laundry into fashion history." }
    ]},
    { id:"tiny-concert", icon:"♫", kicker:"UNANNOUNCED EVENT", title:"RIZO STARTED A CONCERT", text:"There is no audience, no permit, and somehow a full light show.", choices:[
      { id:"dance", label:"DANCE TOO", result:"The den shook. The bond grew. The neighbors probably noticed.", effect:{mood:15,bond:7,hype:12,alignment:1,skill:"speed",gain:.75}, memory:"Headlined a two-creature concert in the den." },
      { id:"tip", label:"TIP THE ARTIST", result:"Rizo immediately reinvested R 15 into snacks. Business-minded.", effect:{embers:-15,mood:20,bond:9,alignment:3,skill:"luck",gain:.6}, memory:"Paid Rizo for an unreleased six-second song." }
    ]},
    { id:"glowing-puddle", icon:"✦", kicker:"FOREST SIGNAL", title:"A PUDDLE IS GLOWING", text:"It is indoors. This raises several questions and answers none of them.", choices:[
      { id:"touch", label:"TOUCH IT", result:"The puddle popped into Prism Shards. Normal puddle behavior.", effect:{shards:18,mood:5,alignment:-3,skill:"luck",gain:1.1}, memory:"Touched the glowing puddle despite every available warning sign." },
      { id:"guard", label:"LET RIZO GUARD IT", result:"Rizo watched it until it became a snack-shaped reflection.", effect:{bond:10,energy:-4,alignment:2,skill:"stamina",gain:.8}, memory:"Trusted Rizo with a supernatural puddle. Nothing exploded." }
    ]},
    { id:"hide-event", icon:"?", kicker:"WHERE IS RIZO", title:"THE DEN IS TOO QUIET", text:"A tiny flame tail is visibly sticking out from behind the toy box.", choices:[
      { id:"find", label:"FOUND YOU", result:"Rizo celebrated like the hiding place was flawless.", effect:{mood:14,bond:8,embers:12,alignment:-1,skill:"speed",gain:.5}, memory:"Won hide-and-seek by noticing the glowing tail." },
      { id:"pretend", label:"KEEP LOOKING", result:"Rizo lasted twelve more seconds before laughing.", effect:{mood:18,bond:10,alignment:3,skill:"instinct",gain:.5}, memory:"Protected Rizo's confidence during a historically bad hiding attempt." }
    ]},
    { id:"shadow-watch", icon:"◐", scene:"shadow", kicker:"THE FOREST LOOKED BACK", title:"SOMETHING IS OUTSIDE", text:"A black flame shape is standing beyond the rainy glass. It copies Rizo one second late.", choices:[
      { id:"wave", label:"LET RIZO WAVE", result:"The shape returned the wave, then became part of the rain.", effect:{bond:10,mood:8,alignment:4,skill:"instinct",gain:1.2,lore:1}, memory:"Rizo greeted a Shadow signal without fear." },
      { id:"follow", label:"GO TO THE WINDOW", result:"Violet tracks appeared on the sill. They point toward the Deep Forest.", effect:{shards:12,alignment:-3,skill:"luck",gain:1.4,lore:1}, memory:"You followed the Shadow signal to a window that was still locked." }
    ]},
    { id:"roof-leak", icon:"☂", kind:"misfortune", weight:.16, scene:"forest", kicker:"BAD WEATHER FOUND A WAY IN", title:"THE ROOF STARTED LEAKING", text:"Cold water is landing directly on Rizo's bed. The landlord is apparently a cloud.", choices:[
      { id:"patch", label:"PATCH IT NOW", result:"The leak stopped, but the emergency patch ate R 48 and the whole night.", effect:{embers:-48,energy:-12,mood:-6,alignment:2}, memory:"Spent the night patching a roof leak before the den became a pond." },
      { id:"move", label:"MOVE THE BED", result:"The bed survived. Rizo slept in the draft and woke up sick.", effect:{energy:-18,mood:-10,hygiene:-7,health:-8,sick:true,alignment:-1}, memory:"Moved Rizo away from a leak, but the cold draft followed." }
    ]},
    { id:"spoiled-stash", icon:"☠", kind:"misfortune", weight:.16, kicker:"PANTRY DISASTER", title:"THE SNACK STASH TURNED", text:"Everything smells wrong. Rizo is staring at it like bad judgment is a food group.", choices:[
      { id:"trash", label:"THROW IT ALL OUT", result:"The bad food is gone. So are R 32 and most of tonight's dinner.", effect:{embers:-32,hunger:-16,mood:-7,alignment:2}, memory:"Threw away the spoiled snack stash before Rizo could make it worse." },
      { id:"taste", label:"LET RIZO CHECK ONE", result:"One bite answered every question. Rizo is now violently unimpressed and sick.", effect:{health:-16,hunger:-8,mood:-13,hygiene:-10,sick:true,alignment:-4}, memory:"Let Rizo test suspicious food and immediately regretted the experiment." }
    ]},
    { id:"broken-window", icon:"ϟ", kind:"misfortune", weight:.14, scene:"shadow", kicker:"THE NIGHT HIT BACK", title:"A BRANCH BROKE THE WINDOW", text:"Rain is coming through the glass and the room temperature is making threats.", choices:[
      { id:"repair", label:"EMERGENCY REPAIR", result:"The window is sealed with boards, tape, and R 65 worth of humility.", effect:{embers:-65,energy:-14,mood:-8,hygiene:-5,alignment:1}, memory:"Repaired a broken window in the middle of a storm." },
      { id:"blanket", label:"BUILD A BLANKET FORT", result:"The fort held until morning. Rizo did not. The cold forced a recovery rest.", effect:{energy:-24,mood:-16,health:-18,recovery:"storm shock",alignment:3}, memory:"Waited out a broken window inside a blanket fort while Rizo recovered." }
    ]},
    { id:"lost-pouch", icon:"◇", kind:"misfortune", weight:.18, kicker:"FOREST PICKPOCKET", title:"THE EMBER POUCH IS GONE", text:"There is a clean little bite mark on the strap and zero witnesses willing to talk.", choices:[
      { id:"search", label:"SEARCH THE TRAIL", result:"You found the strap, three muddy footprints, and none of the R 54 inside.", effect:{embers:-54,energy:-16,mood:-8,hygiene:-8,alignment:-2}, memory:"Followed the trail of a stolen Ember pouch and recovered only the strap." },
      { id:"accept", label:"CUT THE LOSS", result:"The pouch stayed gone. Rizo took it personally for the rest of the day.", effect:{embers:-38,mood:-18,bond:-5,hype:-10,alignment:1}, memory:"Accepted that a forest thief escaped with the Ember pouch." }
    ]},
  ];

  const EXPEDITIONS = {
    puddle:{ name:"PUDDLE RUN", minutes:2, energy:4, min:18, max:42, heat:12, loreChance:.12, capsuleChance:.05 },
    trail:{ name:"RAIN TRAIL", minutes:10, energy:9, min:55, max:110, heat:35, loreChance:.28, capsuleChance:.14 },
    deep:{ name:"DEEP WOODS", minutes:30, energy:16, min:130, max:260, heat:85, loreChance:.58, capsuleChance:.32 }
  };

  // ===== RIZO HOUSE: passive storage rooms for extra Rizos =====
  // Internal save data still lives under state.farm for compatibility with v9 and older saves.
  const HOUSE_ROOM_CAPACITY = 3;
  const HOUSE_ADOPTION_COST = 2500;
  const HOUSE_UNLOCK_LEVEL = 4;
  const HOUSE_UNLOCK_XP = 16 * Math.pow(HOUSE_UNLOCK_LEVEL - 1, 2);
  const HOUSE_ROOMS = [
    { id:0, name:"THE SPARE ROOM", short:"ROOM 1", cost:0, className:"house-room-spare", icon:"⌂", copy:"The first three extra Rizos live close enough to hear the Den." },
    { id:1, name:"THE LOFT", short:"ROOM 2", cost:6000, className:"house-room-loft", icon:"△", copy:"Higher ceilings, neon rain, and enough space for three more personalities." },
    { id:2, name:"THE ROOFTOP", short:"ROOM 3", cost:15000, className:"house-room-rooftop", icon:"☾", copy:"A private skyline where the older Rizos stay up too late." },
    { id:3, name:"THE PENTHOUSE", short:"ROOM 4", cost:35000, className:"house-room-penthouse", icon:"✦", copy:"Endgame housing. The furniture is expensive and nobody respects it." }
  ];
  const HOUSE_MAX_TOTAL = HOUSE_ROOMS.length * HOUSE_ROOM_CAPACITY;
  const FARM_ROSTER_MAX = HOUSE_MAX_TOTAL; // legacy internal name retained for imported saves and old helper calls.
  const HOUSE_SLOT_POSITIONS = [
    { x:20, y:66, pose:"resident-left" },
    { x:50, y:57, pose:"resident-center" },
    { x:80, y:67, pose:"resident-right" }
  ];


  const el = {
    originScreen: $("#originScreen"), rainLayer: $("#rainLayer"), foundEgg: $("#foundEgg"), storySpeaker: $("#storySpeaker"), storyText: $("#storyText"), storyChoices: $("#storyChoices"), storyNext: $("#storyNext"), skipOrigin: $("#skipOrigin"),
    gameShell: $("#gameShell"), keeperShort: $("#keeperShort"), streakCount: $("#streakCount"), coinCount: $("#coinCount"), dailyGiftButton: $("#dailyGiftButton"), brandButton: $("#brandButton"),
    tutorialBanner: $("#tutorialBanner"), tutorialStepBadge: $("#tutorialStepBadge"), tutorialText: $("#tutorialText"), tutorialClose: $("#tutorialClose"),
    habitatScene: $("#habitatScene"), gardenVisitor: $("#gardenVisitor"), visitorSprite: $("#visitorSprite"), visitorAccessory: $("#visitorAccessory"), visitorName: $("#visitorName"), weatherFx: $("#weatherFx"), denCareTrace: $("#denCareTrace"), moodChip: $("#moodChip"), sceneMenuButton: $("#sceneMenuButton"), thoughtBubble: $("#thoughtBubble"), petTapTarget: $("#petTapTarget"), eggActor: $("#eggActor"), petActor: $("#petActor"), petSprite: $("#petSprite"), faceFx: $("#faceFx"), statusFx: $("#statusFx"), accessoryLayer: $("#accessoryLayer"), tapCombo: $("#tapCombo"), petName: $("#petName"), petDescriptor: $("#petDescriptor"), petLevel: $("#petLevel"), growthTitle: $("#growthTitle"), growthText: $("#growthText"), growthBar: $("#growthBar"), needGrid: $("#needGrid"), careName: $("#careName"), sleepActionText: $("#sleepActionText"),
    hungerText: $("#hungerText"), moodText: $("#moodText"), energyText: $("#energyText"), hygieneText: $("#hygieneText"), hungerBar: $("#hungerBar"), moodBar: $("#moodBar"), energyBar: $("#energyBar"), hygieneBar: $("#hygieneBar"),
    questTitle: $("#questTitle"), questBar: $("#questBar"), questText: $("#questText"), questClaim: $("#questClaim"), memoryTitle: $("#memoryTitle"), memoryText: $("#memoryText"), journalJump: $("#journalJump"), moreCareButton: $("#moreCareButton"),
    miniPause: $("#miniPause"), miniPausePanel: $("#miniPausePanel"), bestPower: $("#bestPower"), bestSpark: $("#bestSpark"), bestForage: $("#bestForage"), bestRush: $("#bestRush"), bestWalk: $("#bestWalk"), bestRhythm: $("#bestRhythm"), bestMemory: $("#bestMemory"), bestGlide: $("#bestGlide"), bestBreaker: $("#bestBreaker"), bestMaze: $("#bestMaze"), expeditionStatus: $("#expeditionStatus"), expeditionOptions: $("#expeditionOptions"), expeditionClaim: $("#expeditionClaim"),
    closetActor: $("#closetActor"), closetSprite: $("#closetSprite"), closetAccessory: $("#closetAccessory"), closetName: $("#closetName"), closetVariant: $("#closetVariant"), shopList: $("#shopList"),
    profileActor: $("#profileActor"), profileSprite: $("#profileSprite"), profileAccessory: $("#profileAccessory"), profileRarity: $("#profileRarity"), profileName: $("#profileName"), profileBio: $("#profileBio"), renameButton: $("#renameButton"), journalContent: $("#journalContent"),
    farmContent: $("#farmContent"),
    sheetBackdrop: $("#sheetBackdrop"), bottomSheet: $("#bottomSheet"), sheetKicker: $("#sheetKicker"), sheetTitle: $("#sheetTitle"), sheetBody: $("#sheetBody"), sheetClose: $("#sheetClose"),
    modalOverlay: $("#modalOverlay"), miniGameOverlay: $("#miniGameOverlay"), miniKicker: $("#miniKicker"), miniTitle: $("#miniTitle"), miniTimer: $("#miniTimer"), miniScore: $("#miniScore"), miniArena: $("#miniArena"), miniTarget: $("#miniTarget"), miniHint: $("#miniHint"), miniQuit: $("#miniQuit"),
    toastStack: $("#toastStack"), importSaveInput: $("#importSaveInput"), sensoryFlash: $("#sensoryFlash"), seasonLevel: $("#seasonLevel"), seasonBar: $("#seasonBar"), seasonText: $("#seasonText"), seasonReward: $("#seasonReward"), keeperRank: $("#keeperRank")
  };

  let state;
  let currentView = "home";
  let shopTab = "wear";
  let journalTab = "stats";
  let activeHouseRoom = 0;
  let originIndex = 0;
  let storyTimer = null;
  let speechTimer = null;
  let comboTimer = null;
  let lastTapAt = 0;
  let combo = 0;
  let tapHistory = [];
  let refuseUntil = 0;
  let overloadCooldownUntil = 0;
  let saveTimer = null;
  let modeSlices = {};
  let saveWriteId = "";
  let saveBlocked = null;
  let saveFailureNotified = false;
  let pendingRecoveryModes = {};
  let mini = idleRunBoard();
  let runtimeViewportFrame = null;
  let runtimeViewportTimer = null;
  let runtimeSuspendedAt = 0;
  let runtimeSuspendReason = "";
  // { modeId, away, deferred:Set } while a foreground-hold mode is open.
  let modeCareHold = null;
  // Dormant semantic events from modes (diagnostic ring; no consumer yet).
  const modeEventLog = [];
  let stageViewportScroll = null;
  let releaseUpdateReady = false;
  let releaseRegistration = null;
  let lastOfflineSummary = null;
  let activePetBehavior = null;
  let petBehaviorTimer = null;
  let worldEventOpen = false;
  let activeMusicOverride = null;
  let pendingEvolution = null;
  let musicUnlocked = false;
  let musicTimer = null;
  let musicStep = 0;
  let musicScene = "";
  let musicGainNode = null;
  let musicStopTimer = null;
  let musicTransitionToken = 0;
  let cutsceneToken = 0;
  let feedDrag = null;
  let feedClickBlockedUntil = 0;
  const MUSIC_MASTER_GAIN = .78;
  const SFX_MASTER_GAIN = 1.75;

  function uid(prefix = "RZ") {
    const random = crypto?.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(6))].map(v => v.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2, 14);
    return `${prefix}-${random.toUpperCase()}`;
  }

  function weightedPick(items) {
    let roll = Math.random() * items.reduce((sum, item) => sum + item.weight, 0);
    for (const item of items) { roll -= item.weight; if (roll <= 0) return item; }
    return items[0];
  }

  function rollVariant(lucky = false, commonOnly = false, pity = 0) {
    const capsulePool = VARIANTS.filter(v => v.capsule !== false && (!v.prismOnly || lucky));
    if (commonOnly) return VARIANTS[0];
    if (pity >= 49) return weightedPick(capsulePool.filter(v => ["obsidian","aurora","golden","diamond","retro"].includes(v.id)).map(v => ({...v, weight: v.id === "diamond" ? 1 : v.id === "retro" ? .8 : v.id === "golden" ? 4 : 6})));
    const luckyWeights = {classic:16,ember:16,toxic:14,violet:11,moss:9,bubblegum:9,frost:8,glitch:6,obsidian:4,aurora:3.2,golden:2.8,diamond:1.2,retro:1};
    const pool = capsulePool.map(v => ({...v, weight: lucky || pity >= 24 ? (luckyWeights[v.id] || v.weight) : v.weight}));
    return weightedPick(pool);
  }

  function rollMutation() { return weightedPick(MUTATIONS); }

  function createGenes(parent = null, partner = null) {
    const genes = {};
    for (const skill of SKILLS) {
      const aGene = Number(parent?.genes?.[skill.id]) || 100;
      const bGene = Number(partner?.genes?.[skill.id]) || aGene;
      const aPerformance = Number(parent?.skills?.[skill.id]) || 0;
      const bPerformance = Number(partner?.skills?.[skill.id]) || 0;
      const blended = partner ? aGene * .56 + bGene * .44 : aGene;
      const trainingBoost = parent ? Math.min(24, Math.floor((aPerformance + bPerformance * .45) * .10) + 4) : 0;
      genes[skill.id] = clamp(Math.round(blended + trainingBoost + (Math.random() * 14 - 7)), 82, 170);
    }
    const aGrowth = Number(parent?.genes?.growth) || 100;
    const bGrowth = Number(partner?.genes?.growth) || aGrowth;
    genes.growth = clamp(Math.round((partner ? aGrowth * .58 + bGrowth * .42 : aGrowth) + (parent ? 3 : 0) + (Math.random() * 10 - 5)), 85, 140);
    return genes;
  }

  function createPet({ lucky = false, shame = false, pity = state?.meta?.pity || 0, number = state?.meta?.nextPetNumber || 1 } = {}) {
    const rolled = rollVariant(lucky, shame, pity);
    const mutation = rollMutation();
    number = Math.max(1, Math.floor(Number(number) || 1));
    return {
      id: uid("PET"),
      number,
      name: `RIZO ${String(number).padStart(2, "0")}`,
      stage: "egg",
      hiddenVariant: rolled.id,
      variant: null,
      createdAt: now(),
      bornAt: null,
      lastTick: now(),
      lifespanDays: 42 + Math.floor(Math.random() * 25),
      hatch: 0,
      xp: 0,
      level: 0,
      bond: 0,
      strength: 0,
      skills: { speed: 0, power: 0, instinct: 0, stamina: 0, luck: 0 },
      genes: createGenes(),
      alignment: 0,
      careProfile: { kind: 0, wild: 0, balanced: 0, foods: {}, games: {} },
      storyMarks: [],
      form: "balanced",
      formHistory: [],
      generation: 1,
      lineageTrait: null,
      lastTrainedSkill: "stamina",
      resting: false,
      elder: false,
      hype: 0,
      taps: 0,
      personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
      mutation: mutation.id,
      overstimulation: 0,
      health: 100,
      hunger: 92,
      mood: 88,
      energy: 92,
      hygiene: 90,
      sleeping: false,
      sick: false,
      lifeMemory: { lastGreetingDate:"", lastSeenAt:now(), recentWins:0, recentCare:0, moodMomentum:0, secretStage:0, filthSeen:false, bathIncidentRemembered:false, favoriteFoodRemembered:false, washUntil:0, washFromHygiene:100, lastBathAt:0, lastFoodAt:0, lastFoodId:"", arcadeAfterglowUntil:0, lastArcadeMode:"", lifeBehaviorUntil:0 },
      alive: true,
      deathReason: null,
      accessory: "none",
      room: "rain",
      shame,
      graceUntil: null,
      lastFreeSnack: 0
    };
  }

  function createDaily() {
    const key = dateKey();
    const choices = [
      { type: "tap", title: "TAP YOUR RIZO 25 TIMES", target: 25, reward: 30 },
      { type: "feed", title: "SERVE 2 QUESTIONABLE MEALS", target: 2, reward: 35 },
      { type: "play", title: "FINISH 1 ARCADE RUN", target: 1, reward: 40 },
      { type: "clean", title: "CLEAN YOUR RIZO ONCE", target: 1, reward: 30 },
      { type: "train", title: "FINISH 1 POWER TAPE OR EMBER FORGE RUN", target: 1, reward: 45 },
      { type: "walk", title: "TAKE RIZO ON 1 RAIN WALK", target: 1, reward: 45 }
    ];
    const seed = [...key].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const chosen = choices[seed % choices.length];
    return { date: key, ...chosen, progress: 0, claimed: false, giftClaimed: false };
  }

  function normalizeDailyState(rawDaily) {
    const canonical = createDaily();
    if (!rawDaily || typeof rawDaily !== "object" || rawDaily.date !== canonical.date) return canonical;
    const parsedProgress = Number(rawDaily.progress);
    return {
      ...canonical,
      progress: clamp(Number.isFinite(parsedProgress) ? parsedProgress : 0, 0, canonical.target),
      claimed: Boolean(rawDaily.claimed),
      giftClaimed: Boolean(rawDaily.giftClaimed)
    };
  }

  function normalizeExpeditionState(rawExpedition) {
    const empty = { active: false, ready: false, type: null, endAt: 0, result: null };
    if (!rawExpedition || typeof rawExpedition !== "object" || !rawExpedition.active) return empty;
    const type = typeof rawExpedition.type === "string" && EXPEDITIONS[rawExpedition.type] ? rawExpedition.type : null;
    if (!type) return empty;
    const data = EXPEDITIONS[type], current = now(), parsedEndAt = Number(rawExpedition.endAt);
    const endAt = Number.isFinite(parsedEndAt) && parsedEndAt > 0
      ? Math.min(parsedEndAt, current + data.minutes * 60000)
      : current;
    const rawResult = rawExpedition.result && typeof rawExpedition.result === "object" ? rawExpedition.result : {};
    const parsedEmbers = Number(rawResult.embers);
    return {
      active: true,
      ready: Boolean(rawExpedition.ready) || current >= endAt,
      type,
      endAt,
      result: {
        embers: clamp(Number.isFinite(parsedEmbers) ? Math.floor(parsedEmbers) : data.min, data.min, data.max),
        heat: data.heat,
        capsule: Boolean(rawResult.capsule),
        lore: Boolean(rawResult.lore)
      }
    };
  }

  // ===== SAVE MODEL AND MIGRATION =====
  function defaultState() {
    const base = {
      version: VERSION,
      introSeen: false,
      player: {
        keeperId: uid("KEEPER"),
        createdAt: now(),
        lastActive: now(),
        lastSessionAt: now(),
        totalSessions: 1,
        streak: 1,
        lastVisitDate: dateKey(),
        tutorialStep: 0,
        tutorialDismissed: false,
        keeperGuideSeen: false
      },
      wallet: { embers: 100, shards: 0 },
      pet: null,
      inventory: {
        accessories: ["none"],
        rooms: ["rain"],
        phoenix: 0,
        growth: 0,
        care: 0
      },
      collection: {},
      memories: [],
      graveyard: [],
      legacy: [],
      achievements: [],
      daily: createDaily(),
      scores: { power: 0, spark: 0, forage: 0, rush: 0, walk: 0, rhythm: 0, memory: 0, glide: 0, breaker: 0, maze: 0 },
      // Fields from before a game mode had its own save slice, waiting to be
      // handed to that mode once (see prepareModeSlices).
      modeInbox: {},
      // Rewards a game mode has been granted, by mode and receipt id. A receipt
      // is never pruned, so the same milestone can never pay twice.
      modeReceipts: {},
      treasures: {},
      worldEvents: { lastAt: now(), count: 0, seen: [], lastBadLuckAt: 0, badLuckCount: 0 },
      garden: { toyUses: {}, favoriteToy: null, lastToyAt: 0, nextEggVariant: null, bondSeed: null, lastPairKeeper: null },
      farm: defaultFarmState(),
      social: { visitors: [], currentVisitor: null, lastVisitRewardDate: null, pairings: [] },
      season: { xp: 0, level: 1 },
      expedition: { active: false, ready: false, type: null, endAt: 0, result: null },
      loreUnlocked: ["keeper"],
      settings: { sound: true, soundVolume: .85, music: true, musicVolume: .85, haptics: true, reducedMotion: false, adPreview: false },
      trainingMemory: {},
      meta: { totalHatched: 0, totalTaps: 0, totalCareActions: 0, totalGames: 0, totalWalks: 0, deaths: 0, recoveries: 0, rebirths: 0, bondEggs: 0, nextPetNumber: 1, capsules: 0, pity: 0, refusals: 0, overloads: 0, retroSignal: 0, shadowFinds: 0, unlockScenes: [], backupPrompts: [], lastBackupAt: 0 }
    };
    base.pet = createPet({ pity: 0, number: 1 });
    base.meta.nextPetNumber = base.pet.number + 1;
    return base;
  }

  function normalizeState(raw) {
    // Imported/legacy saves are untrusted input. Normalize every collection and
    // clamp simulation numbers so one malformed field cannot break the whole UI.
    raw = raw && typeof raw === "object" ? raw : {};
    const fresh = defaultState();
    const sourceInventory = raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {};
    const merged = {
      ...fresh,
      ...raw,
      player: { ...fresh.player, ...(raw.player && typeof raw.player === "object" ? raw.player : {}) },
      wallet: { ...fresh.wallet, ...(raw.wallet && typeof raw.wallet === "object" ? raw.wallet : {}) },
      inventory: { ...fresh.inventory, ...sourceInventory },
      scores: { ...fresh.scores, ...(raw.scores && typeof raw.scores === "object" ? raw.scores : {}) },
      treasures: raw.treasures && typeof raw.treasures === "object" && !Array.isArray(raw.treasures) ? raw.treasures : {},
      worldEvents: { ...fresh.worldEvents, ...(raw.worldEvents && typeof raw.worldEvents === "object" ? raw.worldEvents : {}) },
      season: { ...fresh.season, ...(raw.season && typeof raw.season === "object" ? raw.season : {}) },
      expedition: normalizeExpeditionState(raw.expedition),
      settings: { ...fresh.settings, ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {}) },
      trainingMemory: normalizeTrainingMemory(raw),
      meta: { ...fresh.meta, ...(raw.meta && typeof raw.meta === "object" ? raw.meta : {}) },
      collection: raw.collection && typeof raw.collection === "object" && !Array.isArray(raw.collection) ? raw.collection : {},
      memories: Array.isArray(raw.memories) ? raw.memories.slice(0, 60) : [],
      graveyard: Array.isArray(raw.graveyard) ? raw.graveyard.slice(0, 60) : [],
      legacy: Array.isArray(raw.legacy) ? raw.legacy.slice(0, 40) : [],
      garden: { ...fresh.garden, ...(raw.garden && typeof raw.garden === "object" ? raw.garden : {}) },
      social: { ...fresh.social, ...(raw.social && typeof raw.social === "object" ? raw.social : {}) },
      farm: (() => {
        const freshHouse = defaultFarmState();
        const rawFarm = raw.farm && typeof raw.farm === "object" ? raw.farm : {};
        const rawRoster = Array.isArray(rawFarm.roster) ? rawFarm.roster : [];
        const roster = rawRoster
          .filter(item => item && typeof item === "object" && typeof item.id === "string" && VARIANTS.some(variant => variant.id === item.variant))
          .slice(0, HOUSE_MAX_TOTAL)
          .map((item, index) => {
            const housePet = {
              ...fresh.pet,
              ...item,
              skills: { ...(fresh.pet.skills || {}), ...(item.skills && typeof item.skills === "object" ? item.skills : {}) },
              genes: { ...(fresh.pet.genes || {}), ...(item.genes && typeof item.genes === "object" ? item.genes : {}) },
              careProfile: {
                ...(fresh.pet.careProfile || {}),
                ...(item.careProfile && typeof item.careProfile === "object" ? item.careProfile : {}),
                foods: { ...(fresh.pet.careProfile?.foods || {}), ...(item.careProfile?.foods && typeof item.careProfile.foods === "object" ? item.careProfile.foods : {}) },
                games: { ...(fresh.pet.careProfile?.games || {}), ...(item.careProfile?.games && typeof item.careProfile.games === "object" ? item.careProfile.games : {}) }
              }
            };
            housePet.number = Math.max(1, Math.floor(Number(housePet.number) || index + 2));
            housePet.name = typeof housePet.name === "string" && housePet.name.trim()
              ? housePet.name.trim().replace(/[<>\u0000-\u001F\u007F]/g, "").slice(0, 14).toUpperCase()
              : `RIZO ${String(housePet.number).padStart(2, "0")}`;
            housePet.id = String(housePet.id).slice(0, 80);
            housePet.stage = STAGES.some(stage => stage.id === housePet.stage) ? housePet.stage : "kid";
            housePet.hiddenVariant = VARIANTS.some(variant => variant.id === housePet.hiddenVariant) ? housePet.hiddenVariant : housePet.variant;
            housePet.accessory = ACCESSORIES.some(entry => entry.id === housePet.accessory) ? housePet.accessory : "none";
            housePet.room = ROOMS.some(entry => entry.id === housePet.room) ? housePet.room : "rain";
            housePet.form = EVOLUTION_FORMS[housePet.form] ? housePet.form : "balanced";
            housePet.personality = PERSONALITIES.includes(housePet.personality) ? housePet.personality : "LOYAL WEIRDO";
            housePet.mutation = MUTATIONS.some(entry => entry.id === housePet.mutation) ? housePet.mutation : "normal";
            for (const key of ["hatch", "xp", "level", "bond", "strength", "hype", "taps", "overstimulation", "health", "hunger", "mood", "energy", "hygiene", "lastFreeSnack", "lastTick", "createdAt"]) {
              const value = housePet[key];
              const parsed = value === null || value === "" ? NaN : Number(value);
              housePet[key] = Number.isFinite(parsed) ? parsed : (Number(fresh.pet[key]) || 0);
            }
            for (const key of ["hatch", "bond", "strength", "overstimulation", "health", "hunger", "mood", "energy", "hygiene"]) housePet[key] = clamp(housePet[key]);
            housePet.xp = SaveCore.clampNumber(housePet.xp, 0, CORE_LIMITS.MAX_PLAYER_XP, 0);
            housePet.hype = SaveCore.clampNumber(housePet.hype, 0, CORE_LIMITS.MAX_META_COUNTER, 0);
            housePet.taps = SaveCore.clampInteger(housePet.taps, 0, CORE_LIMITS.MAX_META_COUNTER, 0);
            const houseStageSeed = { egg: 0, spark: 2, kid: 7, teen: 15, beast: 28, legend: 45 }[housePet.stage] || 0;
            for (const skill of SKILLS) {
              housePet.genes[skill.id] = clamp(Number(housePet.genes[skill.id]) || 100, 82, 170);
              const rawHouseSkill = housePet.skills[skill.id], parsedHouseSkill = rawHouseSkill === null || rawHouseSkill === "" ? NaN : Number(rawHouseSkill);
              housePet.skills[skill.id] = clamp(Number.isFinite(parsedHouseSkill) ? parsedHouseSkill : (skill.id === "power" ? Math.max(houseStageSeed, housePet.strength || 0) : houseStageSeed), 0, housePet.genes[skill.id]);
            }
            housePet.storyMarks = normalizeStoryMarks(housePet.storyMarks);
            housePet.alive = housePet.alive !== false;
            housePet.sleeping = Boolean(housePet.sleeping);
            housePet.sick = Boolean(housePet.sick);
            housePet.resting = Boolean(housePet.resting);
            housePet.lastTick = housePet.lastTick > 0 ? housePet.lastTick : now();
            housePet.createdAt = housePet.createdAt > 0 ? housePet.createdAt : now();
            housePet.homeRoom = Number.isInteger(Number(item.homeRoom)) ? clamp(Math.floor(Number(item.homeRoom)), 0, HOUSE_ROOMS.length - 1) : Math.floor(index / HOUSE_ROOM_CAPACITY);
            return housePet;
          });
        const requiredRooms = Math.max(1, Math.ceil(roster.length / HOUSE_ROOM_CAPACITY));
        const rawUnlocked = Array.isArray(rawFarm.unlockedRooms) ? rawFarm.unlockedRooms.map(Number).filter(Number.isInteger) : [0];
        const unlockedRooms = [...new Set([0, ...rawUnlocked, ...Array.from({length:requiredRooms},(_,i)=>i)])]
          .filter(id => HOUSE_ROOMS.some(room => room.id === id))
          .sort((a,b)=>a-b);
        roster.forEach((pet,index) => {
          if (!unlockedRooms.includes(pet.homeRoom)) pet.homeRoom = Math.floor(index / HOUSE_ROOM_CAPACITY);
          const residentsBefore = roster.slice(0,index).filter(other => other.homeRoom === pet.homeRoom).length;
          if (residentsBefore >= HOUSE_ROOM_CAPACITY) {
            const openRoom = unlockedRooms.find(roomId => roster.slice(0,index).filter(other => other.homeRoom === roomId).length < HOUSE_ROOM_CAPACITY);
            pet.homeRoom = openRoom ?? 0;
          }
        });
        const requestedRoom = Math.floor(Number(rawFarm.activeRoom));
        const activeRoom = unlockedRooms.includes(requestedRoom) ? requestedRoom : unlockedRooms[0];
        return {
          roster,
          unlockedRooms,
          activeRoom,
          totalAdoptions: SaveCore.clampInteger(rawFarm.totalAdoptions, 0, CORE_LIMITS.MAX_META_COUNTER, 0),
          totalReleased: SaveCore.clampInteger(rawFarm.totalReleased, 0, CORE_LIMITS.MAX_META_COUNTER, 0),
          lastAdoptionAt: SaveCore.clampNumber(rawFarm.lastAdoptionAt, 0, Number.MAX_SAFE_INTEGER, 0),
          featureUnlocked: Boolean(rawFarm.featureUnlocked) || roster.length > 0 || unlockedRooms.length > 1,
          unlockSeen: Boolean(rawFarm.unlockSeen) || roster.length > 0 || unlockedRooms.length > 1,
          // Retained only so imported Farm saves never lose historical counters.
          plots: Array.isArray(rawFarm.plots) ? rawFarm.plots : [],
          materials: SaveCore.clampInteger(rawFarm.materials, 0, CORE_LIMITS.MAX_INVENTORY_STACK, 0),
          totalHarvests: SaveCore.clampInteger(rawFarm.totalHarvests, 0, CORE_LIMITS.MAX_META_COUNTER, 0),
          totalCatches: SaveCore.clampInteger(rawFarm.totalCatches, 0, CORE_LIMITS.MAX_META_COUNTER, 0),
          lastEncounterAt: Math.max(0, Number(rawFarm.lastEncounterAt) || 0)
        };
      })(),
      achievements: Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter(value => typeof value === "string" && ACHIEVEMENTS.some(item => item.id === value)))] : [],
      loreUnlocked: Array.isArray(raw.loreUnlocked) ? [...new Set(raw.loreUnlocked.filter(value => typeof value === "string"))] : ["keeper"],
      daily: normalizeDailyState(raw.daily),
      pet: { ...fresh.pet, ...(raw.pet && typeof raw.pet === "object" ? raw.pet : {}) }
    };

    merged.modeInbox = collectLegacyModeFields(raw, merged);
    merged.modeReceipts = normalizeModeReceipts(raw.modeReceipts);
    merged.version = VERSION;
    delete merged.musicHistory;
    merged.settings.sound = merged.settings.sound !== false;
    merged.settings.music = merged.settings.music !== false;
    merged.settings.haptics = merged.settings.haptics !== false;
    merged.settings.reducedMotion = Boolean(merged.settings.reducedMotion);
    merged.settings.adPreview = Boolean(merged.settings.adPreview);
    merged.settings.soundVolume = clamp(Number(merged.settings.soundVolume ?? .85), 0, 1);
    merged.settings.musicVolume = clamp(Number(merged.settings.musicVolume ?? .85), 0, 1);
    merged.player.keeperId = typeof merged.player.keeperId === "string" && merged.player.keeperId ? merged.player.keeperId.slice(0, 80) : uid("KEEPER");
    merged.player.tutorialStep = clamp(Number(merged.player.tutorialStep) || 0, 0, 5);
    merged.player.tutorialDismissed = Boolean(merged.player.tutorialDismissed);
    merged.player.keeperGuideSeen = Boolean(merged.player.keeperGuideSeen);
    merged.wallet.embers = SaveCore.clampInteger(merged.wallet.embers, 0, CORE_LIMITS.MAX_WALLET_EMBERS, 0);
    merged.wallet.shards = SaveCore.clampInteger(merged.wallet.shards, 0, CORE_LIMITS.MAX_WALLET_SHARDS, 0);
    merged.collection = Object.fromEntries(Object.entries(merged.collection)
      .filter(([id]) => VARIANTS.some(item => item.id === id))
      .map(([id,count]) => [id, SaveCore.clampInteger(count, 0, CORE_LIMITS.MAX_COLLECTION_COUNT, 0)]));
    merged.inventory.accessories = Array.isArray(sourceInventory.accessories) ? [...new Set(["none", ...sourceInventory.accessories.filter(id => ACCESSORIES.some(item => item.id === id))])] : ["none"];
    merged.inventory.rooms = Array.isArray(sourceInventory.rooms) ? [...new Set(["rain", ...sourceInventory.rooms.filter(id => ROOMS.some(item => item.id === id))])] : ["rain"];
    for (const key of ["phoenix", "growth", "care"]) merged.inventory[key] = SaveCore.clampInteger(merged.inventory[key], 0, CORE_LIMITS.MAX_INVENTORY_STACK, 0);
    for (const key of ["power", "spark", "forage", "rush", "walk", "rhythm", "memory", "glide", "breaker", "maze"]) merged.scores[key] = SaveCore.clampNumber(merged.scores[key], 0, CORE_LIMITS.MAX_ARCADE_SCORE, 0);
    merged.meta.unlockScenes = Array.isArray(merged.meta.unlockScenes) ? [...new Set(merged.meta.unlockScenes.filter(value => typeof value === "string"))] : [];
    merged.meta.backupPrompts = Array.isArray(merged.meta.backupPrompts) ? [...new Set(merged.meta.backupPrompts.filter(value => typeof value === "string"))] : [];
    merged.meta.lastBackupAt = Math.max(0, Number(merged.meta.lastBackupAt) || 0);
    merged.season.xp = SaveCore.clampNumber(merged.season.xp, 0, CORE_LIMITS.MAX_SEASON_XP, 0);
    merged.season.level = SaveCore.clampInteger(merged.season.level, 1, CORE_LIMITS.MAX_SEASON_LEVEL, 1);
    merged.worldEvents.lastAt = Math.max(0, Number(merged.worldEvents.lastAt) || now());
    merged.worldEvents.count = Math.max(0, Math.floor(Number(merged.worldEvents.count) || 0));
    merged.worldEvents.lastBadLuckAt = Math.max(0, Number(merged.worldEvents.lastBadLuckAt) || 0);
    merged.worldEvents.badLuckCount = Math.max(0, Math.floor(Number(merged.worldEvents.badLuckCount) || 0));
    merged.worldEvents.seen = Array.isArray(merged.worldEvents.seen) ? [...new Set(merged.worldEvents.seen.filter(id => WORLD_EVENTS.some(event => event.id === id)))] : [];
    merged.treasures = Object.fromEntries(Object.entries(merged.treasures).filter(([id]) => WALK_TREASURES.some(item => item.id === id)).map(([id,count]) => [id,Math.max(0,Math.floor(Number(count)||0))]));
    merged.meta.nextPetNumber = Math.max(1, Math.floor(Number(merged.meta.nextPetNumber) || 1));
    merged.garden.toyUses = merged.garden.toyUses && typeof merged.garden.toyUses === "object" ? merged.garden.toyUses : {};
    merged.garden.nextEggVariant = VARIANTS.some(item => item.id === merged.garden.nextEggVariant) && merged.collection[merged.garden.nextEggVariant] ? merged.garden.nextEggVariant : null;
    const normalizeVisitor = visitor => {
      if (!visitor || typeof visitor !== "object") return null;
      const variant = VARIANTS.find(item => item.id === visitor.variant) || VARIANTS[0];
      const genes = {}, skills = {};
      for (const skill of SKILLS) {
        genes[skill.id] = clamp(Number(visitor.genes?.[skill.id]) || 100, 82, 170);
        skills[skill.id] = clamp(Number(visitor.skills?.[skill.id]) || 0, 0, genes[skill.id]);
      }
      genes.growth = clamp(Number(visitor.genes?.growth) || 100, 85, 140);
      return {
        keeper:String(visitor.keeper || "UNKNOWN").slice(0,80),
        name:String(visitor.name || "GUEST RIZO").replace(/[<>\u0000-\u001F\u007F]/g,"").slice(0,14).toUpperCase() || "GUEST RIZO",
        variant:variant.id, variantName:variant.name,
        stage:STAGES.some(item=>item.id===visitor.stage)?visitor.stage:"kid",
        form:EVOLUTION_FORMS[visitor.form]?visitor.form:"balanced", accessory:ACCESSORIES.some(item=>item.id===visitor.accessory)?visitor.accessory:"none",
        generation:clamp(Number(visitor.generation)||1,1,999),
        personality:PERSONALITIES.includes(visitor.personality)?visitor.personality:"LOYAL WEIRDO",
        mutation:MUTATIONS.some(item=>item.id===visitor.mutation)?visitor.mutation:"normal",
        alignment:clamp(Number(visitor.alignment)||0,-100,100), bond:clamp(Number(visitor.bond)||0),
        genes, skills,
        at:Math.max(0,Number(visitor.at)||now()), expiresAt:Math.max(0,Number(visitor.expiresAt)||0)
      };
    };
    merged.social.visitors = Array.isArray(merged.social.visitors) ? merged.social.visitors.map(normalizeVisitor).filter(Boolean).slice(0,20) : [];
    merged.social.currentVisitor = normalizeVisitor(merged.social.currentVisitor);
    merged.social.pairings = Array.isArray(merged.social.pairings) ? merged.social.pairings.filter(item=>item&&typeof item==="object").slice(0,30) : [];
    if (!merged.social.currentVisitor || merged.social.currentVisitor.expiresAt <= now()) merged.social.currentVisitor = null;
    const seed = merged.garden.bondSeed;
    if (seed && typeof seed === "object" && seed.keeper) {
      const seedVariant = VARIANTS.find(item=>item.id===seed.variant) || VARIANTS[0];
      const seedGenes = {}, seedSkills = {};
      for (const skill of SKILLS) {
        seedGenes[skill.id] = clamp(Number(seed.genes?.[skill.id]) || 100, 82, 170);
        seedSkills[skill.id] = clamp(Number(seed.skills?.[skill.id]) || 0, 0, seedGenes[skill.id]);
      }
      seedGenes.growth = clamp(Number(seed.genes?.growth) || 100, 85, 140);
      merged.garden.bondSeed = {keeper:String(seed.keeper).slice(0,80),name:String(seed.name||"GUEST RIZO").replace(/[<>\u0000-\u001F\u007F]/g,"").slice(0,14).toUpperCase()||"GUEST RIZO",variant:seedVariant.id,variantName:seedVariant.name,personality:PERSONALITIES.includes(seed.personality)?seed.personality:"LOYAL WEIRDO",mutation:MUTATIONS.some(item=>item.id===seed.mutation)?seed.mutation:"normal",alignment:clamp(Number(seed.alignment)||0,-100,100),genes:seedGenes,skills:seedSkills,generation:clamp(Number(seed.generation)||1,1,999),at:Math.max(0,Number(seed.at)||now())};
    } else merged.garden.bondSeed = null;

    const pet = merged.pet;
    const numberFields = ["hatch", "xp", "level", "bond", "strength", "hype", "taps", "overstimulation", "health", "hunger", "mood", "energy", "hygiene", "lastFreeSnack", "lastTick", "createdAt"];
    for (const key of numberFields) {
      const value = pet[key];
      const parsed = value === null || value === "" ? NaN : Number(value);
      pet[key] = Number.isFinite(parsed) ? parsed : (Number(fresh.pet[key]) || 0);
    }
    for (const key of ["hatch", "bond", "strength", "overstimulation", "health", "hunger", "mood", "energy", "hygiene"]) pet[key] = clamp(pet[key]);
    pet.xp = SaveCore.clampNumber(pet.xp, 0, CORE_LIMITS.MAX_PLAYER_XP, 0);
    pet.hype = SaveCore.clampNumber(pet.hype, 0, CORE_LIMITS.MAX_META_COUNTER, 0);
    pet.taps = SaveCore.clampInteger(pet.taps, 0, CORE_LIMITS.MAX_META_COUNTER, 0);
    pet.number = Math.max(1, Math.floor(Number(pet.number) || Math.max(1, merged.meta.nextPetNumber - 1)));
    const highestHouseNumber = merged.farm.roster.reduce((highest, resident) => Math.max(highest, Math.floor(Number(resident.number) || 0)), 0);
    merged.meta.nextPetNumber = Math.max(merged.meta.nextPetNumber, pet.number + 1, highestHouseNumber + 1);
    pet.lastTick = pet.lastTick > 0 ? pet.lastTick : now();
    pet.createdAt = pet.createdAt > 0 ? pet.createdAt : now();
    if (!(pet.bornAt > 0) && pet.stage !== "egg") pet.bornAt = pet.createdAt;
    pet.name = typeof pet.name === "string" && pet.name.trim() ? pet.name.trim().replace(/[<>\u0000-\u001F\u007F]/g, "").slice(0, 14).toUpperCase() : `RIZO ${String(pet.number || 1).padStart(2, "0")}`;
    if (!pet.name) pet.name = `RIZO ${String(pet.number || 1).padStart(2, "0")}`;
    pet.hiddenVariant = VARIANTS.some(item => item.id === pet.hiddenVariant) ? pet.hiddenVariant : "classic";
    pet.variant = pet.variant && VARIANTS.some(item => item.id === pet.variant) ? pet.variant : null;
    pet.stage = ["egg", ...STAGES.map(item => item.id)].includes(pet.stage) ? pet.stage : "egg";
    pet.room = ROOMS.some(item => item.id === pet.room) && merged.inventory.rooms.includes(pet.room) ? pet.room : "rain";
    pet.accessory = ACCESSORIES.some(item => item.id === pet.accessory) && merged.inventory.accessories.includes(pet.accessory) ? pet.accessory : "none";
    if (!PERSONALITIES.includes(pet.personality)) pet.personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
    if (!MUTATIONS.some(item => item.id === pet.mutation)) pet.mutation = "normal";
    const stageSeed = { egg: 0, spark: 2, kid: 7, teen: 15, beast: 28, legend: 45 }[pet.stage] || 0;
    pet.skills = pet.skills && typeof pet.skills === "object" ? pet.skills : {};
    pet.genes = pet.genes && typeof pet.genes === "object" ? pet.genes : createGenes();
    for (const skill of SKILLS) {
      pet.genes[skill.id] = clamp(Number(pet.genes[skill.id]) || 100, 82, 170);
      const rawSkill = pet.skills[skill.id], parsedSkill = rawSkill === null || rawSkill === "" ? NaN : Number(rawSkill);
      pet.skills[skill.id] = clamp(Number.isFinite(parsedSkill) ? parsedSkill : (skill.id === "power" ? Math.max(stageSeed, pet.strength || 0) : stageSeed), 0, pet.genes[skill.id]);
    }
    pet.strength = clamp(Math.max(pet.strength || 0, pet.skills.power || 0));
    pet.genes.growth = clamp(Number(pet.genes.growth) || 100, 85, 140);
    pet.alignment = clamp(Number(pet.alignment) || 0, -100, 100);
    pet.careProfile = pet.careProfile && typeof pet.careProfile === "object" ? pet.careProfile : { kind: 0, wild: 0, balanced: 0, foods: {}, games: {} };
    pet.careProfile.foods = pet.careProfile.foods && typeof pet.careProfile.foods === "object" ? pet.careProfile.foods : {};
    pet.careProfile.games = pet.careProfile.games && typeof pet.careProfile.games === "object" ? pet.careProfile.games : {};
    pet.lifeMemory = pet.lifeMemory && typeof pet.lifeMemory === "object" && !Array.isArray(pet.lifeMemory) ? { ...fresh.pet.lifeMemory, ...pet.lifeMemory } : { ...fresh.pet.lifeMemory };
    for (const key of ["lastSeenAt", "washUntil", "lastBathAt", "lastFoodAt", "arcadeAfterglowUntil", "lifeBehaviorUntil"]) pet.lifeMemory[key] = Math.max(0, Number(pet.lifeMemory[key]) || 0);
    for (const key of ["recentWins", "recentCare", "moodMomentum", "secretStage"]) pet.lifeMemory[key] = Math.max(0, Math.floor(Number(pet.lifeMemory[key]) || 0));
    for (const key of ["filthSeen", "bathIncidentRemembered", "favoriteFoodRemembered"]) pet.lifeMemory[key] = Boolean(pet.lifeMemory[key]);
    pet.lifeMemory.washFromHygiene = clamp(Number(pet.lifeMemory.washFromHygiene) || 100);
    pet.lifeMemory.lastFoodId = FOODS.some(item => item.id === pet.lifeMemory.lastFoodId) ? pet.lifeMemory.lastFoodId : "";
    pet.lifeMemory.lastArcadeMode = /^[a-z][a-z0-9-]{1,31}$/.test(String(pet.lifeMemory.lastArcadeMode || "")) ? pet.lifeMemory.lastArcadeMode : "";
    pet.lifeMemory.lastGreetingDate = /^\d{4}-\d{2}-\d{2}$/.test(String(pet.lifeMemory.lastGreetingDate || "")) ? String(pet.lifeMemory.lastGreetingDate) : "";
    pet.storyMarks = normalizeStoryMarks(pet.storyMarks);
    pet.form = EVOLUTION_FORMS[pet.form] ? pet.form : determineEvolutionForm(pet, merged);
    pet.formHistory = Array.isArray(pet.formHistory) ? pet.formHistory.slice(-10) : [];
    pet.generation = Math.max(1, Math.floor(Number(pet.generation) || 1));
    pet.lastTrainedSkill = SKILLS.some(skill => skill.id === pet.lastTrainedSkill) ? pet.lastTrainedSkill : "stamina";
    pet.resting = Boolean(pet.resting);
    pet.elder = Boolean(pet.elder);
    if (pet.alive === false) {
      pet.alive = true;
      pet.resting = true;
      pet.health = Math.max(1, pet.health);
      merged.meta.recoveries = (merged.meta.recoveries || 0) + 1;
    } else pet.alive = true;
    pet.sleeping = Boolean(pet.sleeping); pet.sick = Boolean(pet.sick);
    if (!merged.loreUnlocked.includes("keeper")) merged.loreUnlocked.unshift("keeper");
    return merged;
  }

  // ===== MODE RECEIPTS AND STORY MARKS (state version 22) =====
  // A receipt records what a mode milestone granted, so a repeat is recognized
  // and a conflicting repeat is refused. Story marks are small, positive facts
  // a mode may leave on one pet (e.g. the Dungeon's shared hearth).
  const MODE_RECEIPT_LIMIT = 200;
  const STORY_MARK_LIMIT = 16;
  const MODE_TOKEN = /^[a-z][a-z0-9-]{1,31}$/;
  const RECEIPT_TOKEN = /^[a-z0-9][a-z0-9:._-]{0,119}$/;
  function normalizeModeReceipts(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [modeId, receipts] of Object.entries(raw)) {
      if (!MODE_TOKEN.test(modeId) || !receipts || typeof receipts !== "object" || Array.isArray(receipts)) continue;
      const kept = {};
      for (const [receiptId, receipt] of Object.entries(receipts).slice(0, MODE_RECEIPT_LIMIT)) {
        if (!RECEIPT_TOKEN.test(receiptId) || !receipt || typeof receipt !== "object") continue;
        const entitlements = Array.isArray(receipt.entitlements) ? [...new Set(receipt.entitlements.filter(id => typeof id === "string" && MODE_TOKEN.test(id)))].sort().slice(0, 4) : [];
        kept[receiptId] = { petId: String(receipt.petId || "").slice(0, 80), entitlements, at: Math.max(0, Number(receipt.at) || 0) };
      }
      if (Object.keys(kept).length) out[modeId] = kept;
    }
    return out;
  }
  function normalizeStoryMarks(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set(), out = [];
    for (const mark of raw) {
      if (!mark || typeof mark !== "object" || !MODE_TOKEN.test(String(mark.id || "")) || !MODE_TOKEN.test(String(mark.mode || ""))) continue;
      const key = `${mark.mode}:${mark.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: mark.id, mode: mark.mode, at: Math.max(0, Number(mark.at) || 0) });
      if (out.length >= STORY_MARK_LIMIT) break;
    }
    return out;
  }

  // ===== TRAINING MEMORY =====
  // Each training game may keep a small memory (run.memory / run.remember),
  // e.g. Ember Beat's song bag. State version 21 moved that bag here from
  // state.musicHistory; the game validates its own entries when it reads them.
  function normalizeTrainingMemory(raw) {
    const source = raw?.trainingMemory && typeof raw.trainingMemory === "object" && !Array.isArray(raw.trainingMemory) ? raw.trainingMemory : {};
    const out = {};
    for (const [id, value] of Object.entries(source)) {
      if (!/^[a-z][a-z0-9-]{1,31}$/.test(id) || !value || typeof value !== "object" || Array.isArray(value)) continue;
      const plain = SaveCore.plainJSON(value);
      if (JSON.stringify(plain).length <= 4096) out[id] = plain;
    }
    const legacy = raw?.musicHistory;
    if (!out.rhythm && legacy && typeof legacy === "object") {
      const bag = Array.isArray(legacy.emberBag) ? [...new Set(legacy.emberBag.filter(id => typeof id === "string").map(id => id.slice(0, 40)))].slice(0, 12) : [];
      out.rhythm = { emberBag: bag, emberLast: typeof legacy.emberLast === "string" ? legacy.emberLast.slice(0, 40) : null };
    }
    return out;
  }

  // ===== LEGACY MODE FIELDS =====
  // Before v88 the hub kept Rizo Defense's data in its own state. Those fields
  // are lifted out, untouched, into state.modeInbox and handed to the mode's
  // first slice migration (the mode validates them). Migration-only knowledge:
  // this list never grows; new modes start with a slice.
  const LEGACY_MODE_FIELDS = Object.freeze({
    defense: Object.freeze({
      scores: ["defense", "defenseMilestones", "defenseMaps", "defensePerfectMaps", "defenseHistory", "defenseMastery", "defenseContracts"],
      settings: ["defenseFx", "defenseUiScale", "defenseSignatures", "defenseAutoStart", "defenseWaveIntel", "defenseRosterIds", "defenseRosterConfigured"],
      player: ["defenseSchool"],
      unlockScene: "defense-origin-v37"
    })
  });
  function collectLegacyModeFields(raw, merged) {
    const inbox = raw.modeInbox && typeof raw.modeInbox === "object" && !Array.isArray(raw.modeInbox) ? SaveCore.plainJSON(raw.modeInbox) : {};
    for (const [modeId, fields] of Object.entries(LEGACY_MODE_FIELDS)) {
      const found = { scores: {}, settings: {}, player: {} };
      let any = false;
      for (const section of ["scores", "settings", "player"]) {
        const source = raw[section] && typeof raw[section] === "object" ? raw[section] : {};
        for (const key of fields[section]) {
          if (Object.prototype.hasOwnProperty.call(source, key)) { found[section][key] = SaveCore.plainJSON(source[key]); any = true; }
          delete merged[section]?.[key];
        }
      }
      if (any && !inbox[modeId]) inbox[modeId] = { ...found, introSeen: Array.isArray(raw.meta?.unlockScenes) && raw.meta.unlockScenes.includes(fields.unlockScene) };
    }
    return inbox;
  }

  // Validation and preview paths never commit normalized data implicitly. Keeping
  // this detached wrapper makes that contract explicit even if migrations grow.
  function normalizeStateDetached(raw){const current=state;try{return normalizeState(raw);}finally{state=current;}}
  function recordSaveValidationWarning(kind,details={}){try{localStorage.setItem(SAVE_VALIDATION_WARNING_KEY,JSON.stringify({at:now(),kind:String(kind||"sanitized").slice(0,60),details}));}catch(error){}}
  function buildStateEnvelope(source=state,savedAt=now(),writeId=""){
    return SaveCore.createEnvelope({state:source,modes:source===state?modeSlices:{},savedAt,writeId,stateVersion:VERSION});
  }
  function hardenUnverifiedState(source){
    const normalized=normalizeStateDetached(source),fresh=defaultState();
    // A current signed save that fails verification is not allowed to use its own
    // records, counters, or history to justify currency or competitive progress.
    // Preserve the sanitized pet timeline and known cosmetics for recovery, but
    // reset reward-bearing state to canonical defaults. A verified mirror backup
    // is attempted before this fallback is ever used.
    normalized.wallet={...fresh.wallet};
    normalized.scores={...fresh.scores};
    normalized.modeReceipts={};
    normalized.modeInbox=Object.fromEntries(Object.entries(normalized.modeInbox||{}).map(([modeId,fields])=>[modeId,{scores:{},settings:fields?.settings||{},player:fields?.player||{},introSeen:Boolean(fields?.introSeen)}]));
    normalized.achievements=[];
    normalized.daily=createDaily();
    normalized.season={...fresh.season};
    normalized.expedition=normalizeExpeditionState(null);
    normalized.treasures={};
    normalized.inventory.phoenix=0;normalized.inventory.growth=0;normalized.inventory.care=0;
    normalized.farm.materials=0;normalized.farm.totalAdoptions=0;normalized.farm.totalReleased=0;
    for(const key of["totalGames","totalHatched","totalTaps","totalCareActions","totalWalks","deaths","recoveries","rebirths","bondEggs","capsules","pity","refusals","overloads","retroSignal","shadowFinds"])normalized.meta[key]=0;
    const actualPets=[normalized.pet,...(normalized.farm?.roster||[])].filter(Boolean),collection={};
    for(const pet of actualPets){const id=VARIANTS.some(variant=>variant.id===(pet.variant||pet.hiddenVariant))?(pet.variant||pet.hiddenVariant):"classic";collection[id]=(collection[id]||0)+1;}
    normalized.collection=collection;
    normalized.meta.totalHatched=Math.max(0,actualPets.length-1);
    normalized.meta.nextPetNumber=Math.max(2,...actualPets.map(pet=>SaveCore.clampInteger(pet.number,1,CORE_LIMITS.MAX_META_COUNTER,1)+1));
    return normalized;
  }
  function decodeStatePayload(parsed,{allowLegacy=true}={}){
    const payload=parsed&&typeof parsed==="object"?parsed:null;if(!payload)return{state:defaultState(),modes:{},status:"invalid"};
    if(payload.saveVersion&&payload.state&&typeof payload.state==="object"){
      const envelopeVersion=SaveCore.envelopeVersion(payload);
      // A save written by a newer build is never loaded or rewritten by this one.
      if(envelopeVersion>SaveCore.LATEST_SAVE_VERSION)return{state:null,modes:{},status:"future",saveVersion:envelopeVersion};
      const valid=SaveCore.verifyEnvelope(payload);
      // A verified save from a newer hub (same envelope, higher state version)
      // is protected the same way: normalizing it here would drop what this
      // build does not know (a newer wearable, a newer field) on the next write.
      if(valid&&Math.max(Number(payload.stateVersion)||0,Number(payload.state.version)||0)>VERSION)return{state:null,modes:{},status:"future",saveVersion:envelopeVersion};
      return{state:valid?normalizeStateDetached(payload.state):hardenUnverifiedState(payload.state),modes:valid&&envelopeVersion>=2?SaveCore.normalizeModes(payload.modes):{},status:valid?"verified":"sanitized",signatureValid:valid,saveVersion:envelopeVersion,writeId:typeof payload.writeId==="string"?payload.writeId:""};
    }
    const source=payload.state&&typeof payload.state==="object"?payload.state:payload,sourceVersion=Number(source.version)||0;
    if(allowLegacy&&sourceVersion<RAW_SAVE_TRUST_BELOW)return{state:normalizeStateDetached(source),modes:{},status:"migrated",signatureValid:false};
    return{state:hardenUnverifiedState(source),modes:{},status:"sanitized",signatureValid:false};
  }
  function decodeStateText(rawText,options={}){try{return decodeStatePayload(JSON.parse(rawText),options);}catch(error){return{state:defaultState(),modes:{},status:"invalid",error};}}

  // ===== SAVE SAFETY =====
  // Three promises: a save this build cannot load is set aside before anything
  // overwrites it; a missing or broken primary falls back to every other copy
  // before a fresh egg is ever created; and a tab holding stale progress stops
  // saving instead of overwriting newer progress from another tab.
  function readSaveText(key){try{return localStorage.getItem(key);}catch(error){return null;}}
  // Every v2 envelope starts with app/saveVersion/stateVersion/savedAt/writeId,
  // so the write id is read from the head instead of parsing a large save.
  function saveTextWriteId(text){if(typeof text!=="string")return null;const match=/"writeId":"([^"\\]{0,80})"/.exec(text.slice(0,400));return match?match[1]:null;}
  function saveQuarantineKeys(){const keys=[];try{for(let index=0;index<localStorage.length;index+=1){const key=localStorage.key(index);if(key&&key.startsWith(SAVE_QUARANTINE_PREFIX))keys.push(key);}}catch(error){}return keys.sort();}
  function quarantineSaveTexts(reason,entries){
    try{
      const at=now();
      localStorage.setItem(`${SAVE_QUARANTINE_PREFIX}${at}`,JSON.stringify({at,reason,build:RIZO_RUNTIME_BUILD,entries:entries.map(entry=>({key:entry.key,status:entry.status||"unknown",text:String(entry.text)}))}));
      const keys=saveQuarantineKeys();
      while(keys.length>SAVE_QUARANTINE_LIMIT)localStorage.removeItem(keys.shift());
      return true;
    }catch(error){console.warn("Rizo could not set aside an unreadable save",error);recordSaveValidationWarning("quarantine-failed",{message:String(error?.message||error).slice(0,200)});return false;}
  }
  function readSaveQuarantine(){return saveQuarantineKeys().map(key=>{try{const record=JSON.parse(localStorage.getItem(key));return{key,at:Number(record?.at)||0,reason:String(record?.reason||""),entries:Array.isArray(record?.entries)?record.entries.length:0};}catch(error){return{key,at:0,reason:"unreadable",entries:0};}}).reverse();}
  function downloadSaveQuarantine(key){
    const text=readSaveText(key);if(!text){toast("NOTHING SET ASIDE");return;}
    const blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`rizo-set-aside-save-${key.slice(SAVE_QUARANTINE_PREFIX.length)}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    toast("SET-ASIDE SAVE DOWNLOADED");
  }

  function showSaveBlockedNotice(reason){
    if(reason==="reset")return;
    let node=document.getElementById("rizoSaveBlocked");
    if(!node){
      node=document.createElement("div");node.id="rizoSaveBlocked";node.className="rizo-save-blocked";
      node.setAttribute("role","alertdialog");node.setAttribute("aria-modal","true");node.setAttribute("aria-labelledby","rizoSaveBlockedTitle");
      node.addEventListener("click",event=>{if(!event.target.closest("[data-save-blocked-reload]"))return;if(saveBlocked?.reason==="future")forceReleaseRefresh().then(done=>{if(!done)location.reload();});else location.reload();});
      document.body.appendChild(node);
    }
    const copy=reason==="future"
      ?{kicker:"NEWER SAVE FOUND",title:"THIS SAVE BELONGS TO A NEWER RIZO.GAME",body:"Your progress was saved by a newer version of the game. This copy is older, so it will not touch that save.",action:"UPDATE AND RELOAD"}
      :{kicker:"SAVE PROTECTED",title:"RIZO IS OPEN SOMEWHERE ELSE",body:"Another tab or the installed app saved newer progress. This tab stopped saving so it can't overwrite it.",action:"LOAD NEWEST SAVE"};
    node.innerHTML=`<div class="rizo-save-blocked-card"><small>${copy.kicker}</small><h2 id="rizoSaveBlockedTitle">${copy.title}</h2><p>${copy.body}</p><button type="button" data-save-blocked-reload>${copy.action}</button></div>`;
    node.hidden=false;
    node.querySelector("[data-save-blocked-reload]")?.focus({preventScroll:true});
  }
  function blockSaving(reason){
    if(saveBlocked)return false;
    saveBlocked={reason,at:now()};
    clearTimeout(saveTimer);saveTimer=null;
    if(reason!=="reset"){
      try{if(mini?.active)arcadeFreeze("save-blocked");globalThis.RizoModes?.suspendActive?.("save-blocked");}catch(error){}
      try{stopMusic();}catch(error){}
      recordSaveValidationWarning(`save-blocked-${reason}`,{});
    }
    showSaveBlockedNotice(reason);
    return true;
  }
  function notifySaveFailure(error){
    if(saveFailureNotified)return;saveFailureNotified=true;
    recordSaveValidationWarning("save-write-failed",{message:String(error?.message||error).slice(0,200)});
    try{toast("SAVE FAILED • THIS BROWSER'S STORAGE IS FULL OR BLOCKED");}catch(toastError){}
  }

  function loadState() {
    saveBlocked=null;
    // Newest first. "current" keys are the ones saveState() overwrites.
    const sources=[
      {key:SAVE_V2_KEY,allowLegacy:false,current:true},
      {key:SAVE_V2_BACKUP_KEY,allowLegacy:false,current:true},
      {key:SAVE_KEY,allowLegacy:true},
      {key:SAVE_BACKUP_KEY,allowLegacy:false},
      {key:LEGACY_KEY,allowLegacy:true}
    ].map(source=>({...source,text:readSaveText(source.key)})).filter(source=>typeof source.text==="string"&&source.text.length>0);
    let chosen=null;const failed=[];
    for(const source of sources){
      let decoded;
      try{decoded=decodeStateText(source.text,{allowLegacy:source.allowLegacy});}
      catch(error){decoded={state:null,modes:{},status:"invalid",error};}
      source.status=decoded.status;
      if(decoded.status==="future"){
        state=defaultState();modeSlices={};
        blockSaving("future");
        activeHouseRoom=0;
        return;
      }
      if(decoded.status==="verified"||decoded.status==="migrated"){chosen={source,decoded};break;}
      failed.push({source,decoded});
    }
    if(chosen){
      state=chosen.decoded.state;modeSlices=chosen.decoded.modes||{};
      const primaryMissing=!sources.some(source=>source.key===SAVE_V2_KEY);
      if(chosen.source.key===SAVE_V2_BACKUP_KEY)recordSaveValidationWarning(primaryMissing?"primary-missing-recovered":"primary-signature-recovered",{primaryStatus:failed[0]?.source.status||"missing"});
      else if(failed.length)recordSaveValidationWarning("save-recovered-from-older-copy",{source:chosen.source.key,failed:failed.map(item=>`${item.source.key}:${item.source.status}`)});
    }else if(failed.length){
      const best=failed.find(item=>item.decoded.status==="sanitized"&&item.decoded.state);
      state=best?best.decoded.state:defaultState();modeSlices={};
      recordSaveValidationWarning("primary-save-sanitized",{sources:failed.map(item=>`${item.source.key}:${item.source.status}`)});
    }else{state=defaultState();modeSlices={};}
    // A copy this build could not load, sitting in a key it is about to
    // overwrite, is set aside first. The v1 keys are never written, so they
    // keep their original bytes on their own.
    const atRisk=failed.filter(item=>item.source.current);
    if(atRisk.length)quarantineSaveTexts(chosen?"recovered-from-other-copy":"unreadable",atRisk.map(item=>({key:item.source.key,status:item.source.status,text:item.source.text})));
    saveWriteId=saveTextWriteId(readSaveText(SAVE_V2_KEY))||"";
    activeHouseRoom = state.farm?.activeRoom || 0;
    updateSessionAndStreak();
    resetDailyIfNeeded();
    lastOfflineSummary = processElapsedTime(true);
    processExpedition();
    saveState(true);
  }

  function saveState(immediate = false) {
    if (saveBlocked) return false;
    state.player.lastActive = now();
    const write = () => {
      saveTimer = null;
      const result = persistStateNow();
      return result.status === "committed" && result.backupSynced;
    };
    if (immediate) {
      clearTimeout(saveTimer);
      return write();
    } else if (!saveTimer) {
      saveTimer = setTimeout(write, 250);
    }
    return true;
  }

  // The one place the whole envelope is written. "committed" means the primary
  // copy holds this exact state; a failed mirror only clears backupSynced.
  function stateConflictsWithStorage() {
    const storedWriteId = saveTextWriteId(readSaveText(SAVE_V2_KEY));
    return storedWriteId !== null && storedWriteId !== saveWriteId;
  }
  function persistStateNow() {
    if (saveBlocked) return { status: "blocked", backupSynced: false };
    // Another tab wrote since this one last loaded or saved: stop, never overwrite.
    if (stateConflictsWithStorage()) { blockSaving("conflict"); return { status: "blocked", backupSynced: false }; }
    let serialized, writeId;
    try {
      writeId = uid("W");
      serialized = JSON.stringify(buildStateEnvelope(state, now(), writeId));
      localStorage.setItem(SAVE_V2_KEY, serialized);
    } catch (error) { console.warn("Rizo save could not write", error); notifySaveFailure(error); return { status: "failed", backupSynced: false }; }
    saveWriteId = writeId;
    try { localStorage.setItem(SAVE_V2_BACKUP_KEY, serialized); }
    catch (error) { console.warn("Rizo backup save could not write", error); notifySaveFailure(error); return { status: "committed", backupSynced: false }; }
    saveFailureNotified = false;
    return { status: "committed", backupSynced: true };
  }

  function updateSessionAndStreak() {
    const current = now();
    const inactiveFor = current - (state.player.lastActive || current);
    if (inactiveFor > 30 * 60 * 1000) {
      state.player.totalSessions = (state.player.totalSessions || 0) + 1;
      state.player.lastSessionAt = current;
    }
    const today = dateKey();
    if (state.player.lastVisitDate !== today) {
      const previous = new Date(`${state.player.lastVisitDate}T12:00:00`);
      const currentDay = new Date(`${today}T12:00:00`);
      const days = Math.round((currentDay - previous) / 86400000);
      state.player.streak = days === 1 ? (state.player.streak || 0) + 1 : 1;
      state.player.lastVisitDate = today;
    }
  }

  function resetDailyIfNeeded() {
    if (!state.daily || state.daily.date !== dateKey()) state.daily = createDaily();
  }

  // ===== REAL-TIME PET SIMULATION / OFFLINE PROGRESS =====
  function processElapsedTime(boot = false) {
    const pet = state.pet;
    const current = now();
    // A visible foreground-hold mode (the Dungeon) is time spent with the pet:
    // it neither decays needs nor grows skills. Hidden time is settled as
    // ordinary time away (see suspendRuntime/resumeRuntime).
    if (modeCareHold && !modeCareHold.away) { pet.lastTick = current; return null; }
    const elapsedMs = Math.max(0, current - (pet.lastTick || current));
    const minutes = Math.min(elapsedMs / 60000, 72 * 60);
    pet.lastTick = current;
    if (!pet.alive || pet.stage === "egg" || minutes <= 0) return null;

    const before = { hunger: pet.hunger, mood: pet.mood, energy: pet.energy, hygiene: pet.hygiene, health: pet.health };
    const inGrace = pet.graceUntil && current < pet.graceUntil;
    const multiplier = inGrace ? .35 : 1;

    if (pet.sleeping) {
      pet.energy = clamp(pet.energy + minutes * .08);
      pet.hunger = clamp(pet.hunger - minutes * .013 * multiplier);
      pet.hygiene = clamp(pet.hygiene - minutes * .006 * multiplier);
      pet.mood = clamp(pet.mood - minutes * .002 * multiplier);
    } else {
      pet.hunger = clamp(pet.hunger - minutes * .020 * multiplier);
      pet.energy = clamp(pet.energy - minutes * .015 * multiplier);
      pet.hygiene = clamp(pet.hygiene - minutes * .012 * multiplier);
      pet.mood = clamp(pet.mood - minutes * .010 * multiplier);
    }

    const critical = [pet.hunger, pet.energy, pet.hygiene, pet.mood].filter(value => value < 12).length;
    if (critical > 0) pet.health = clamp(pet.health - minutes * .024 * critical * multiplier);
    else if (pet.hunger > 55 && pet.energy > 45 && pet.hygiene > 45 && !pet.sick) pet.health = clamp(pet.health + minutes * .004);
    if (pet.sick) pet.health = clamp(pet.health - minutes * .015 * multiplier);
    if (!pet.sick && pet.hygiene < 22 && Math.random() < Math.min(.5, minutes / 2000)) pet.sick = true;
    if (before.hygiene >= 18 && pet.hygiene < 18) {
      const memory = lifeMemory();
      if (!memory.filthSeen) {
        memory.filthSeen = true;
        addMemory("SMELL INCIDENT", "Rizo got gross enough to become a room problem.", "✦");
      }
    }

    let idleGrowth = 0;
    if (!pet.resting && pet.health > 20 && pet.hunger > 25 && pet.mood > 25) {
      const hours = minutes / 60;
      const nature = PERSONALITY_TRAITS[pet.personality] || {skill:"stamina",mood:0};
      idleGrowth = Math.min(10, hours * .22 * ((pet.genes?.growth || 100) / 100));
      if (idleGrowth > 0) {
        gainSkill(pet.sleeping ? "stamina" : (pet.lastTrainedSkill || nature.skill || "stamina"), idleGrowth, { silent: true });
        pet.xp += idleGrowth * 1.5;
        pet.bond = clamp(pet.bond + Math.min(3, hours * .08));
        pet.mood = clamp(pet.mood + Math.min(2, hours * (nature.mood || 0)));
      }
    }

    const ageDays = pet.bornAt > 0 ? (current - pet.bornAt) / 86400000 : 0;
    if (ageDays >= pet.lifespanDays && !pet.elder) enterElderState(true);
    else if (pet.health <= 0) enterRecoveryState("neglect", true);
    updateStage();

    if (boot && minutes >= 10) {
      return {
        minutes,
        hunger: Math.max(0, before.hunger - pet.hunger),
        mood: Math.max(0, before.mood - pet.mood),
        energy: before.energy - pet.energy,
        hygiene: Math.max(0, before.hygiene - pet.hygiene),
        health: Math.max(0, before.health - pet.health),
        idleGrowth
      };
    }
    return null;
  }

  function mutate(callback, { render = true, save = true } = {}) {
    processElapsedTime();
    callback(state.pet, state);
    updateStage();
    if (state.pet.alive && state.pet.health <= 0) enterRecoveryState("neglect", true);
    checkAchievements();
    if (save) saveState();
    if (render) renderAll();
  }

  function skillTotal(pet = state.pet) {
    return SKILLS.reduce((sum, skill) => sum + (Number(pet.skills?.[skill.id]) || 0), 0);
  }

  function dominantSkill(pet = state.pet) {
    const ordered = [...SKILLS].sort((a, b) => (pet.skills?.[b.id] || 0) - (pet.skills?.[a.id] || 0));
    if (!ordered.length || (pet.skills?.[ordered[0].id] || 0) - (pet.skills?.[ordered[1]?.id] || 0) < 4) return "balanced";
    return ordered[0].id;
  }

  function dominantGene(pet = state.pet) {
    return [...SKILLS].sort((a, b) => (pet.genes?.[b.id] || 0) - (pet.genes?.[a.id] || 0))[0]?.id || "balanced";
  }

  function alignmentInfo(pet = state.pet) {
    const value = Number(pet.alignment) || 0;
    if (value >= 28) return { id: "light", name: "KIND", icon: "☀", color: "#fff39a" };
    if (value <= -28) return { id: "shadow", name: "WILD", icon: "☾", color: "#9a75ff" };
    return { id: "neutral", name: "BALANCED", icon: "◐", color: "#16c8ff" };
  }

  function displayFormInfo(pet = state.pet) {
    const base = EVOLUTION_FORMS[pet.form] || EVOLUTION_FORMS.balanced;
    if (["pixel","eclipse","royal","prism"].includes(pet.form)) return base;
    const alignment = alignmentInfo(pet).id;
    const names = {
      light: { balanced:"DAYBREAK FLAME", speed:"SKY FLAME", power:"GUARDIAN FLAME", instinct:"STAR FLAME", stamina:"GROVE FLAME", luck:"HALO FLAME" },
      shadow: { balanced:"DUSK FLAME", speed:"PHANTOM FLAME", power:"RAGE FLAME", instinct:"WITCH FLAME", stamina:"THORN FLAME", luck:"HEX FLAME" }
    };
    const name = names[alignment]?.[pet.form] || base.name;
    const alignmentCopy = alignment === "light"
      ? " Kind care brightened this path."
      : alignment === "shadow" ? " Wild choices deepened this path." : " Balanced choices kept this path centered.";
    return { ...base, name, copy: `${base.copy}${alignmentCopy}` };
  }

  function determineEvolutionForm(pet = state.pet, context = state) {
    const dominant = dominantSkill(pet);
    const align = alignmentInfo(pet);
    const variantId = pet.variant || pet.hiddenVariant;
    if ((variantId === "retro" || (context?.meta?.retroSignal || 0) >= 100) && (context?.meta?.totalGames || 0) >= 20 && Math.abs(pet.alignment || 0) < 35) return "pixel";
    if ((variantId === "shadow" || ((pet.alignment || 0) <= -70 && (pet.careProfile?.wild || 0) >= 18)) && pet.stage !== "spark") return "eclipse";
    if (variantId === "golden" && dominant === "luck" && pet.bond >= 55) return "royal";
    if (variantId === "diamond" && pet.bond >= 80) return "prism";
    return dominant === "balanced" ? "balanced" : dominant;
  }

  function evolutionRequirements(stage) {
    if (!stage) return { progress: 0, missing: "HATCH FIRST" };
    const index = STAGES.indexOf(stage);
    const next = STAGES[index + 1];
    if (!next) return { progress: 100, missing: state.pet.elder ? "LEGACY EGG READY" : "FULLY GROWN" };
    const xpProgress = clamp(state.pet.xp / next.minXP * 100);
    const statsProgress = clamp(skillTotal() / next.minStats * 100);
    const bondProgress = clamp(state.pet.bond / next.minBond * 100);
    const progress = Math.min(xpProgress, statsProgress, bondProgress);
    const missing = [];
    if (state.pet.xp < next.minXP) missing.push(`${Math.ceil(next.minXP - state.pet.xp)} XP`);
    if (skillTotal() < next.minStats) missing.push(`${Math.ceil(next.minStats - skillTotal())} TRAINING`);
    if (state.pet.bond < next.minBond) missing.push(`${Math.ceil(next.minBond - state.pet.bond)} BOND`);
    return { progress, missing: missing.slice(0, 2).join(" + ") || "READY", next };
  }

  function shiftAlignment(amount, reason = "care") {
    const pet = state.pet;
    pet.alignment = clamp((pet.alignment || 0) + amount, -100, 100);
    pet.careProfile ||= { kind: 0, wild: 0, balanced: 0, foods: {}, games: {} };
    if (amount > 0) pet.careProfile.kind = (pet.careProfile.kind || 0) + Math.abs(amount);
    else if (amount < 0) pet.careProfile.wild = (pet.careProfile.wild || 0) + Math.abs(amount);
    else pet.careProfile.balanced = (pet.careProfile.balanced || 0) + 1;
    pet.lastCareReason = reason;
  }

  // Skill growth for any owned pet, capped by its genes. Returns what it actually gained.
  function petGainSkill(pet, skillId, amount) {
    if (!pet?.skills || !pet.genes || !SKILLS.some(skill => skill.id === skillId)) return 0;
    const before = pet.skills[skillId] || 0;
    const cap = pet.genes[skillId] || 100;
    pet.skills[skillId] = clamp(before + amount, 0, cap);
    if (skillId === "power") pet.strength = clamp(Math.max(pet.strength || 0, pet.skills.power));
    pet.lastTrainedSkill = skillId;
    return pet.skills[skillId] - before;
  }

  function gainSkill(skillId, amount, { silent = false } = {}) {
    const gained = petGainSkill(state.pet, skillId, amount);
    if (!silent && gained > .2) toast(`+${gained.toFixed(gained >= 1 ? 1 : 2)} ${skillId.toUpperCase()}`);
    return gained;
  }

  function evaluateForm(announce = false) {
    const pet = state.pet;
    if (pet.stage === "egg") return;
    const nextForm = determineEvolutionForm(pet);
    if (nextForm !== pet.form) {
      const old = pet.form;
      pet.form = nextForm;
      pet.formHistory ||= [];
      pet.formHistory.push({ from: old, to: nextForm, at: now(), stage: pet.stage });
      if (announce) {
        const info = EVOLUTION_FORMS[nextForm];
        addMemory("FORM SHIFT", `${pet.name} became a ${info.name} because of how you raised it.`, "✦");
        toast(`FORM SHIFT: ${info.name}`);
        say(`I FEEL DIFFERENT. LIKE... ${info.name}.`, 3400);
        celebrate();
      }
    }
  }

  function currentVariant() {
    const id = state.pet.variant || state.pet.hiddenVariant || "classic";
    return VARIANTS.find(item => item.id === id) || VARIANTS[0];
  }

  function currentStage() {
    if (state.pet.stage === "egg") return null;
    const currentRank = Math.max(0, STAGES.findIndex(stage => stage.id === state.pet.stage));
    let best = STAGES[currentRank] || STAGES[0];
    for (const stage of STAGES) {
      if (state.pet.xp >= stage.minXP && skillTotal() >= stage.minStats && state.pet.bond >= stage.minBond) best = stage;
    }
    return best;
  }

  // ===== CENTRAL PET RENDERER =====
  // Single source of truth for "what does this Rizo look like right now".
  // Every scene that shows the player's actual pet (garden, closet, minigames,
  // walk, evolution, previews) must read from getPetVisualState() instead of
  // re-deriving variant/stage/accessory/mutation classes locally. This is
  // what keeps a hat/variant/stage consistent everywhere instead of a scene
  // quietly falling back to a default sprite. See DEVELOPER-NOTES.md.
  const RARE_VARIANT_CLASS_IDS = ["ember", "toxic", "violet", "moss", "bubblegum", "frost", "glitch", "obsidian", "aurora", "golden", "diamond", "shadow", "retro"];
  const FAILED_RIZO_ASSETS = new Set();

  function mergeAnchorCorrections(...sources) {
    const names = ["head","face","upper","center","lower","left","right","back","ground","effects"];
    const output = {};
    names.forEach(name => {
      output[name] = { x:0, y:0, scale:1 };
      sources.forEach(source => {
        const next = source?.[name];
        if (!next) return;
        output[name] = {
          x: (output[name].x || 0) + (Number(next.x) || 0),
          y: (output[name].y || 0) + (Number(next.y) || 0),
          scale: (output[name].scale || 1) * (Number(next.scale) || 1)
        };
      });
    });
    return output;
  }

  function resolveRizoVisual({ variant, evolutionStage, formId = "balanced", context = "default" } = {}) {
    const variantRecord = typeof variant === "string"
      ? (VARIANTS.find(item => item.id === variant) || VARIANTS[0])
      : (variant || VARIANTS[0]);
    const stageId = AGE_VISUALS[evolutionStage] ? evolutionStage : "kid";
    const age = AGE_VISUALS[stageId];
    const variantCalibration = VARIANT_VISUAL_CALIBRATION[variantRecord.id] || VARIANT_VISUAL_CALIBRATION.classic;
    const contextCorrection = {
      card:{imageScale:.985,offsetX:0,offsetY:0,wearableScale:.98},
      thumbnail:{imageScale:.96,offsetX:0,offsetY:0,wearableScale:.96},
      walk:{imageScale:1,offsetX:0,offsetY:0,wearableScale:1},
      arcade:{imageScale:1,offsetX:0,offsetY:0,wearableScale:1},
      cutscene:{imageScale:1.02,offsetX:0,offsetY:-.3,wearableScale:1.01},
      den:{imageScale:1,offsetX:0,offsetY:0,wearableScale:1},
      closet:{imageScale:1,offsetX:0,offsetY:0,wearableScale:1}
    }[context] || {imageScale:1,offsetX:0,offsetY:0,wearableScale:1};

    const candidates = [...new Set([variantRecord.sprite, VARIANTS[0].sprite].filter(Boolean))];
    const usableCandidates = candidates.filter(path => !FAILED_RIZO_ASSETS.has(path));
    const asset = usableCandidates[0] || VARIANTS[0].sprite;
    const fallbackChain = usableCandidates.filter(path => path !== asset);
    const anchors = mergeAnchorCorrections(age.anchors, variantCalibration.anchors);

    return {
      asset,
      sprite: asset,
      fallbackAsset: fallbackChain[0] || VARIANTS[0].sprite,
      fallbackChain,
      variantId: variantRecord.id,
      evolutionStage: stageId,
      ageStage: stageId,
      formId,
      context,
      alphaBounds: [46,52,463,622],
      baseline: 622,
      imageScale: (Number(variantCalibration.spriteScale) || 1) * (Number(contextCorrection.imageScale) || 1),
      bodyX: Number(age.bodyX) || 1,
      bodyY: Number(age.bodyY) || 1,
      faceScale: Number(age.faceScale) || 1,
      offsetX: (Number(variantCalibration.spriteX) || 0) + (Number(contextCorrection.offsetX) || 0),
      offsetY: (Number(age.offsetY) || 0) + (Number(variantCalibration.spriteY) || 0) + (Number(contextCorrection.offsetY) || 0),
      wearableScale: (Number(age.wearableScale) || 1) * (Number(variantCalibration.wearableScale) || 1) * (Number(contextCorrection.wearableScale) || 1),
      wearableRotate: (Number(age.wearableRotate) || 0) + (Number(variantCalibration.wearableRotate) || 0),
      shadow: {
        scale: Number(age.shadow?.scale) || 1,
        x: Number(age.shadow?.x) || 0,
        y: Number(age.shadow?.y) || 0,
        opacity: Number.isFinite(Number(age.shadow?.opacity)) ? Number(age.shadow.opacity) : 1
      },
      anchors,
      glow: variantCalibration.glow || null,
      animation: variantCalibration.animation || null
    };
  }

  function resolvePetSprite(variant, stageId, formId, context = "default") {
    return resolveRizoVisual({ variant, evolutionStage: stageId, formId, context }).asset;
  }

  function grimeLevelForHygiene(hygiene) {
    const value = clamp(Number(hygiene) || 0);
    if (value < 18) return "filthy";
    if (value < 35) return "dirty";
    if (value < 60) return "light";
    return "clean";
  }

  function careVisualState(source) {
    const memory = source?.lifeMemory;
    const washing = source === state.pet && Number(memory?.washUntil) > now();
    const justRinsed = source === state.pet && !washing && now() - (Number(memory?.lastBathAt) || 0) < 7000;
    return {
      washing,
      grime: washing ? grimeLevelForHygiene(memory?.washFromHygiene) : justRinsed ? "clean" : grimeLevelForHygiene(source?.hygiene)
    };
  }

  function getPetVisualState(pet = state.pet, overrides = {}) {
    const source = pet || state.pet;
    const stageId = overrides.stageId || source.stage;
    const isEgg = stageId === "egg";
    const variantId = overrides.variantId || source.variant || source.hiddenVariant || "classic";
    const variant = VARIANTS.find(item => item.id === variantId) || VARIANTS[0];
    const stageData = isEgg ? null : (STAGES.find(item => item.id === stageId) || STAGES[0]);
    const formId = overrides.form || source.form || "balanced";
    const form = EVOLUTION_FORMS[formId] || EVOLUTION_FORMS.balanced;
    const align = alignmentInfo(source);
    const context = overrides.context || "default";
    const careVisual = careVisualState(source);
    const arcadeAfterglow = source === state.pet && context === "den" && Number(source.lifeMemory?.arcadeAfterglowUntil) > now();
    const resolved = resolveRizoVisual({ variant, evolutionStage: isEgg ? "kid" : stageId, formId, context });
    return {
      isEgg,
      variant,
      sprite: resolved.asset,
      resolved,
      stageId,
      stageData,
      scale: Number(overrides.scale) || stageData?.scale || 1,
      formId,
      form,
      align,
      context,
      accessory: overrides.accessory ?? source.accessory ?? "none",
      mutation: overrides.mutation || source.mutation || "normal",
      sleeping: overrides.sleeping ?? Boolean(source.sleeping),
      sick: overrides.sick ?? Boolean(source.sick),
      resting: overrides.resting ?? Boolean(source.resting),
      low: overrides.low ?? (!isEgg && Math.min(source.hunger, source.mood, source.energy, source.hygiene) < 18),
      grime: overrides.grime ?? careVisual.grime,
      washing: overrides.washing ?? careVisual.washing,
      behavior: overrides.behavior ?? (source === state.pet ? activePetBehavior || (arcadeAfterglow ? "afterglow" : "") : ""),
      name: overrides.name || source.name
    };
  }

  // Builds the class list for whatever element is acting as "the pet" —
  // used identically by the garden actor, minigame arenas, and previews.
  function petActorClassNames(visual, baseClass) {
    const classes = [baseClass, `stage-${visual.stageId}`, visual.form.className, `align-${visual.align.id}`, `mutation-${visual.mutation}`];
    if (visual.sleeping) classes.push("sleeping");
    if (visual.sick) classes.push("sick");
    if (visual.low) classes.push("sad");
    if (visual.resting) classes.push("resting");
    if (visual.grime !== "clean") classes.push(`grime-${visual.grime}`);
    if (visual.washing) classes.push("care-washing");
    if (visual.behavior) classes.push(`behavior-${visual.behavior}`);
    RARE_VARIANT_CLASS_IDS.forEach(id => { if (visual.variant.id === id) classes.push(id); });
    return classes.filter(Boolean).join(" ");
  }

  const ACCESSORY_RARITY_COLORS = { common: "#9eff75", rare: "#16c8ff", epic: "#ff68bd", legendary: "#ffd45a" };

  function accessoryRarity(id) {
    return (ACCESSORIES.find(item => item.id === id) || {}).rarity || "common";
  }

  function accessoryAnchorGroup(id) {
    return WEARABLE_DEFS[id]?.anchor || "center";
  }

  function accessoryClassName(visual) {
    const rarity = accessoryRarity(visual.accessory);
    const anchor = accessoryAnchorGroup(visual.accessory);
    const clothIds = new Set(["bandana","scarf","bow","cape","beanie","cap","first-knot"]);
    const metalIds = new Set(["chain","crown","halo","horns","belt"]);
    const glassIds = new Set(["shades","goggles","visor"]);
    const leatherIds = new Set(["backpack","belt","eyepatch"]);
    const material = clothIds.has(visual.accessory) ? "cloth" : metalIds.has(visual.accessory) ? "metal" : glassIds.has(visual.accessory) ? "glass" : leatherIds.has(visual.accessory) ? "leather" : "soft";
    return `accessory-layer wearable wearable-${visual.accessory} ${visual.accessory} anchor-${anchor} material-${material} ${visual.accessory !== "none" ? `rarity-${rarity}` : ""}`.trim();
  }

  function wearableLayerMarkup() {
    return '<span aria-hidden="true" class="wearable-back"></span><span aria-hidden="true" class="wearable-body"></span><span aria-hidden="true" class="wearable-front"></span>';
  }

  function wearableMarkup(visual, id = null) {
    const idAttribute = id ? ` id="${escapeHTML(id)}"` : "";
    return `<span${idAttribute} class="${accessoryClassName(visual)}">${wearableLayerMarkup()}</span>`;
  }

  function renderWearableToNode(node, visual) {
    if (!node) return;
    node.className = accessoryClassName(visual);
    if (!node.querySelector(".wearable-body")) node.innerHTML = wearableLayerMarkup();
  }

  function visualVariableEntries(visual) {
    const resolved = visual.resolved || resolveRizoVisual({ variant:visual.variant, evolutionStage:visual.stageId, formId:visual.formId, context:visual.context });
    const entries = {
      "--rizo-image-scale": resolved.imageScale,
      "--rizo-scale-x": resolved.imageScale * resolved.bodyX,
      "--rizo-scale-y": resolved.imageScale * resolved.bodyY,
      "--age-body-x": resolved.bodyX,
      "--age-body-y": resolved.bodyY,
      "--age-face-scale": resolved.faceScale,
      "--wearable-scale": resolved.wearableScale,
      "--wearable-rotate": `${resolved.wearableRotate}deg`,
      "--rizo-offset-x": `${resolved.offsetX}%`,
      "--rizo-offset-y": `${resolved.offsetY}%`,
      "--rizo-shadow-scale": resolved.shadow.scale,
      "--rizo-shadow-x": `${resolved.shadow.x}%`,
      "--rizo-shadow-y": `${resolved.shadow.y}%`,
      "--rizo-shadow-opacity": resolved.shadow.opacity,
      "--rizo-baseline": resolved.baseline
    };
    Object.entries(resolved.anchors || {}).forEach(([name, anchor]) => {
      entries[`--anchor-${name}-x`] = `${anchor.x || 0}%`;
      entries[`--anchor-${name}-y`] = `${anchor.y || 0}%`;
      entries[`--anchor-${name}-scale`] = anchor.scale || 1;
    });
    return entries;
  }

  function applyVisualVariables(actor, visual) {
    if (!actor) return;
    actor.style.setProperty("--pet-color", visual.variant.color);
    actor.style.setProperty("--pet-sprite", `url("${visual.sprite}")`);
    actor.style.setProperty("--life-scale", String(visual.scale));
    Object.entries(visualVariableEntries(visual)).forEach(([name, value]) => actor.style.setProperty(name, String(value)));
    actor.dataset.rizoVariant = visual.variant.id;
    actor.dataset.rizoStage = visual.stageId;
    actor.dataset.rizoContext = visual.context || "default";
  }

  function visualStyleAttribute(visual) {
    const variables = {
      "--mini-life-scale": visual.scale,
      "--pet-color": visual.variant.color,
      "--mini-pet-color": visual.variant.color,
      "--pet-sprite": `url('${visual.sprite}')`,
      ...visualVariableEntries(visual)
    };
    return Object.entries(variables).map(([name, value]) => `${name}:${value}`).join(";");
  }

  function setRizoImageFallbacks(image, visual) {
    if (!image) return;
    const chain = (visual.resolved?.fallbackChain || []).filter(path => path && path !== visual.sprite);
    image.dataset.rizoFallbacks = chain.join("|");
    image.dataset.rizoFallbackUsed = "";
  }

  document.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.rizoFallbacks) return;
    const failed = image.getAttribute("src");
    if (failed) FAILED_RIZO_ASSETS.add(failed);
    const queue = image.dataset.rizoFallbacks.split("|").filter(path => path && !FAILED_RIZO_ASSETS.has(path));
    const next = queue.shift();
    image.dataset.rizoFallbacks = queue.join("|");
    if (!next || image.dataset.rizoFallbackUsed === next) return;
    image.dataset.rizoFallbackUsed = next;
    image.src = next;
  }, true);

  async function preloadResolvedRizoVisual(visual) {
    const candidates = [...new Set([visual.sprite, ...(visual.resolved?.fallbackChain || [])].filter(Boolean))];
    for (const source of candidates) {
      const loaded = await new Promise(resolve => {
        const image = new Image();
        const timer = setTimeout(() => resolve(false), 1800);
        image.onload = () => { clearTimeout(timer); resolve(true); };
        image.onerror = () => { clearTimeout(timer); FAILED_RIZO_ASSETS.add(source); resolve(false); };
        image.src = source;
      });
      if (loaded) return source;
    }
    return VARIANTS[0].sprite;
  }

  function inferPetVisualContext(extraClass = "") {
    if (/walk-rizo/.test(extraClass)) return "walk";
    if (/shop-preview|profile-pet|rename-pet/.test(extraClass)) return "card";
    if (/cutscene|evolution-pet|event-pet|arrival-|rare-reaction|capsule-reaction/.test(extraClass)) return "cutscene";
    if (/power-rizo|spark-rizo|forage-rizo|rush-rizo|rhythm-rizo|memory-rizo|glide-rizo|breaker-rizo|maze-rizo|defense-rizo/.test(extraClass)) return "arcade";
    return "default";
  }

  // Applies the visual state onto persistent DOM nodes (garden, closet).
  // Persistent nodes are reused rather than recreated so CSS transitions
  // (sleep, hurt, celebrate) keep animating smoothly between renders.
  function ensurePetGrimeLayer(actor) {
    const shell = actor?.querySelector(":scope > .rizo-motion-shell");
    if (!shell || shell.querySelector(":scope > .rizo-grime")) return;
    const grime = document.createElement("span");
    grime.className = "rizo-grime";
    grime.setAttribute("aria-hidden", "true");
    shell.insertBefore(grime, shell.querySelector(":scope > .accessory-layer") || null);
  }

  function applyPetVisualToNodes(visual, { sprite, accessory, actor } = {}) {
    if (sprite) {
      sprite.src = visual.sprite;
      sprite.alt = `${visual.name} the ${visual.variant.name} Rizo`;
      setRizoImageFallbacks(sprite, visual);
    }
    if (accessory) renderWearableToNode(accessory, visual);
    if (actor) {
      ensurePetGrimeLayer(actor);
      actor.className = petActorClassNames(visual, actor.dataset.baseClass || "pet-actor");
      applyVisualVariables(actor, visual);
    }
  }

  // Builds a standalone HTML fragment for scenes that rebuild DOM each render.
  function petMarkup({ extraClass = "", pet = state.pet, overrides = {}, id = null, label = null, context = null } = {}) {
    const resolvedContext = context || overrides.context || inferPetVisualContext(extraClass);
    const visual = getPetVisualState(pet, { ...overrides, context:resolvedContext });
    const classes = `${petActorClassNames(visual, "mini-pet")} ${extraClass}`.trim();
    const idAttribute = id ? ` id="${escapeHTML(id)}"` : "";
    const alt = label || `${visual.name} the ${visual.variant.name} Rizo`;
    const fallbacks = (visual.resolved?.fallbackChain || []).filter(path => path && path !== visual.sprite).join("|");
    return `<div${idAttribute} class="${classes}" data-rizo-variant="${visual.variant.id}" data-rizo-stage="${visual.stageId}" data-rizo-context="${resolvedContext}" style="${visualStyleAttribute(visual)}"><span class="mini-pet-shadow"></span><span aria-hidden="true" class="evolution-echo"></span><span aria-hidden="true" class="evolution-rune"></span><span class="rizo-motion-shell" aria-hidden="true"><img src="${visual.sprite}" data-rizo-fallbacks="${escapeHTML(fallbacks)}" alt="${escapeHTML(alt)}"><span aria-hidden="true" class="rizo-grime"></span>${wearableMarkup(visual)}</span></div>`;
  }

  function flushPendingEvolution() {
    if (!pendingEvolution || mini.active || isUILocked()) return false;
    const evolution = pendingEvolution;
    pendingEvolution = null;
    showEvolutionCutscene(evolution.stage, evolution.form);
    return true;
  }

  function queueEvolutionCutscene(stage, form) {
    pendingEvolution = { stage, form };
    setTimeout(() => flushPendingEvolution(), 80);
  }

  async function showEvolutionCutscene(stage, form) {
    const visual = getPetVisualState(state.pet, { stageId:stage.id, form:state.pet.form, context:"cutscene" });
    // The same canonical Rizo sprite is preloaded before the age reveal so
    // the cutscene never flashes a missing asset on mobile.
    await preloadResolvedRizoVisual(visual);
    playPetCutscene({scene:"evolution",kicker:"YOU RAISED THIS RIZO",title:`${state.pet.name} GREW INTO ${stage.name}`,symbol:"✦",duration:1250,className:"evolution-cutscene",after:()=>{
      showModal(`<div class="modal-card evolution-result"><small>GROWTH MILESTONE</small><div class="evolution-stage">${petMarkup({extraClass:"evolution-pet",id:"evolutionPet",context:"cutscene"})}<i></i></div><h2>${escapeHTML(stage.name)} • ${escapeHTML(form.name)}</h2><p>The same Rizo grew older. Your care also strengthened the ${escapeHTML(form.name)}. +R 35</p><div class="modal-buttons"><button class="primary" data-close-modal>SAME RIZO. NEW AGE.</button></div></div>`);
      sfx("legendary"); celebrate();
    }});
  }

  function updateStage() {
    const pet = state.pet;
    if (!pet.alive || pet.stage === "egg") return;
    const next = currentStage();
    const currentIndex = STAGES.findIndex(stage => stage.id === pet.stage);
    const nextIndex = STAGES.findIndex(stage => stage.id === next?.id);
    if (next && nextIndex > currentIndex) {
      pet.stage = next.id;
      evaluateForm(false);
      pet.health = clamp(pet.health + 20);
      pet.mood = clamp(pet.mood + 18);
      pet.energy = clamp(pet.energy + 12);
      state.wallet.embers += 35;
      const form = displayFormInfo(pet);
      addMemory("GREW UP", `${pet.name} reached the ${next.name} age. Your care strengthened the ${form.name}.`, "✦");
      toast(`GROWTH: ${next.name} • ${form.name} • +R 35`);
      say(`I'M ${next.name} NOW. STILL ME.`, 3600);
      queueEvolutionCutscene(next, form);
      sfx("level");
      earnHeat(45,false);
      unlockRandomLore(.65);
    } else {
      evaluateForm(false);
    }
  }

  function petAgeText() {
    const pet = state.pet;
    if (!pet.bornAt) return "UNHATCHED";
    const minutes = Math.floor((now() - pet.bornAt) / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return days ? `${days}D ${hours}H` : `${hours}H ${mins}M`;
  }

  function levelForXP(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 16)) + 1);
  }

  function houseIsUnlocked() {
    return Boolean(state?.farm?.featureUnlocked || state?.farm?.roster?.length || (state?.farm?.unlockedRooms?.length || 0) > 1);
  }

  function houseUnlockRequirementsMet() {
    if (!state?.pet || state.pet.stage === "egg" || !state.pet.alive) return false;
    const learnedBasics = state.player.tutorialStep >= 5 || state.player.tutorialDismissed;
    return learnedBasics && levelForXP(state.pet.xp) >= HOUSE_UNLOCK_LEVEL;
  }

  function checkHouseUnlock() {
    if (houseIsUnlocked() || !houseUnlockRequirementsMet()) return false;
    state.farm.featureUnlocked = true;
    state.farm.unlockSeen = false;
    addMemory("RIZO HOUSE UNLOCKED", `${state.pet.name} reached Level ${HOUSE_UNLOCK_LEVEL}. The spare room is finally open.`, "⌂");
    saveState(true);
    return true;
  }

  function hasSeenUnlockScene(id) {
    return Array.isArray(state?.meta?.unlockScenes) && state.meta.unlockScenes.includes(id);
  }

  function rememberUnlockScene(id) {
    if (!id) return;
    if (!Array.isArray(state.meta.unlockScenes)) state.meta.unlockScenes = [];
    if (!state.meta.unlockScenes.includes(id)) state.meta.unlockScenes.push(id);
  }

  function keeperPathSteps() {
    const discovered = Object.values(state.collection || {}).filter(value => Number(value) > 0).length;
    const basicsDone = state.player.tutorialStep >= 5 || state.player.tutorialDismissed;
    const defenseSummary = globalThis.RizoModes?.summary?.("defense");
    const clearedArcade = (state.meta.totalGames || 0) > 0 || ["power","spark","forage","rush","walk","rhythm","memory","glide","breaker","maze"].some(key => Number(state.scores?.[key]) > 0) || Number(defenseSummary?.best) > 0;
    const defenseBest = Math.max(Number(defenseSummary?.best) || 0, ...(defenseSummary?.milestones || [0]));
    const currentLevel = levelForXP(state.pet?.xp || 0);
    return [
      { id:"hatch", title:"HATCH YOUR FIRST RIZO", done:(state.meta.totalHatched || 0) > 0 || state.pet.stage !== "egg", status:(state.meta.totalHatched || 0) > 0 || state.pet.stage !== "egg" ? "DONE" : `${Math.floor(state.pet.hatch || 0)}%`, hint:"Tap the egg until the little weirdo comes out." },
      { id:"basics", title:"FINISH KEEPER BASICS", done:basicsDone, status:basicsDone ? "DONE" : `${Math.min(5, (state.player.tutorialStep || 0) + 1)}/5`, hint:"Feed, play, clean, sleep, and open the Journal once." },
      { id:"arcade", title:"CLEAR AN ARCADE RUN", done:clearedArcade, status:clearedArcade ? "DONE" : `${state.meta.totalGames || 0}/1`, hint:"Any finished game counts toward your Keeper path." },
      { id:"house", title:`UNLOCK RIZO HOUSE`, done:houseIsUnlocked(), status:houseIsUnlocked() ? "DONE" : `LV ${currentLevel}/${HOUSE_UNLOCK_LEVEL}`, hint:"Raise your main Rizo and finish the basics to open the spare room." },
      { id:"adopt", title:"ADOPT A SECOND RIZO", done:(state.farm?.roster?.length || 0) > 0, status:(state.farm?.roster?.length || 0) > 0 ? "DONE" : `${state.farm?.roster?.length || 0}/1`, hint:"Once the House opens, buy or discover another resident." },
      { id:"defense", title:"SURVIVE TO DEFENSE WAVE 10", done:defenseBest >= 10, status:defenseBest >= 10 ? "DONE" : `WAVE ${defenseBest}/10`, hint:"Your first milestone proves the roster system is really alive." },
      { id:"mature", title:"RAISE A MATURE RIZO", done:state.pet.stage === "legend", status:state.pet.stage === "legend" ? "DONE" : (currentStage()?.name || "BABY"), hint:"A full life stage makes the whole loop click into place." },
      { id:"legacy", title:"CREATE A LEGACY EGG", done:(state.meta.rebirths || 0) > 0, status:(state.meta.rebirths || 0) > 0 ? `GEN ${state.pet.generation || 2}` : `${Math.floor(skillTotal(state.pet))}/300`, hint:"Rebirth is the long-game payoff for care, bond, and training." },
      { id:"discover", title:"DISCOVER 5 VARIANTS", done:discovered >= 5, status:discovered >= 5 ? "DONE" : `${discovered}/5`, hint:"Collection progress makes the world feel larger than one room." }
    ];
  }

  function keeperPathProgress() {
    const steps = keeperPathSteps();
    const doneCount = steps.filter(step => step.done).length;
    const next = steps.find(step => !step.done) || steps[steps.length - 1];
    return { steps, doneCount, total: steps.length, next, percent: clamp(doneCount / steps.length * 100) };
  }

  function keeperTrophies() {
    const trophies = [];
    if ((state.meta.totalHatched || 0) > 0) trophies.push({ id:"spark", icon:"✦", color:"#16c8ff", name:"FIRST SPARK", copy:"Your first hatch is part of the room now." });
    if (houseIsUnlocked()) trophies.push({ id:"house", icon:"⌂", color:"#9eff75", name:"HOUSE KEY", copy:"The spare room finally opened." });
    if ((globalThis.RizoModes?.summary?.("defense")?.milestones || []).includes(10)) trophies.push({ id:"gate", icon:"◉", color:"#ff5c6c", name:"GATE BADGE", copy:"Wave 10 survived in Rizo Defense." });
    if (state.pet.stage === "legend" || hasSeenUnlockScene("legacy-ready") || (state.meta.rebirths || 0) > 0) trophies.push({ id:"mature", icon:"♛", color:"#ffd45a", name:"MATURE MARK", copy:"You raised a Rizo all the way to Mature." });
    if ((state.meta.rebirths || 0) > 0) trophies.push({ id:"legacy", icon:"↻", color:"#ff68bd", name:"LEGACY RELIC", copy:"This timeline already created a Legacy Egg." });
    return trophies;
  }

  function keeperPathCompactMarkup() {
    const path = keeperPathProgress();
    const next = path.next;
    const headline = path.doneCount >= path.total ? "KEEPER PATH COMPLETE" : next.title;
    const subline = path.doneCount >= path.total ? "Open Journal → Stats to review the full path and trophy room." : next.hint;
    const progressText = `${path.doneCount}/${path.total} MILESTONES`;
    return `<button class="keeper-path-preview" data-open-keeper-path type="button"><span>KEEPER PATH • ${progressText}</span><b>${escapeHTML(headline)}</b><small>${escapeHTML(subline)}</small><i><u style="width:${path.percent}%"></u></i></button>`;
  }

  function keeperPathJournalMarkup() {
    const path = keeperPathProgress();
    return `<section class="stat-board keeper-path-board" id="keeperPathBoard"><div class="keeper-path-head"><div><small>LONG-TERM STRUCTURE</small><h3>KEEPER PATH</h3><p>The game keeps opening up as you prove you understand one Rizo, then a house, then lineage.</p></div><span>${path.doneCount}/${path.total}</span></div><div class="keeper-path-track"><i style="width:${path.percent}%"></i></div><div class="keeper-path-steps">${path.steps.map((step, index) => `<article class="path-step ${step.done ? "done" : ""}"><strong>${String(index + 1).padStart(2, "0")}</strong><div><b>${escapeHTML(step.title)}</b><small>${escapeHTML(step.hint)}</small></div><em>${escapeHTML(step.status)}</em></article>`).join("")}</div></section>`;
  }

  function keeperTrophyJournalMarkup() {
    const trophies = keeperTrophies();
    return `<section class="stat-board trophy-room-board"><div class="trophy-room-head"><div><small>VISIBLE SAVE HISTORY</small><h3>TROPHY ROOM</h3><p>Every trophy also appears on the Den shelf so progress changes the world around Rizo.</p></div><span>${trophies.length}/5</span></div><div class="trophy-chip-row">${trophies.length ? trophies.map((trophy,index) => `<span class="trophy-chip trophy-${trophy.id}" style="--trophy-color:${trophy.color};--trophy-delay:${index * .11}s" title="${escapeHTML(trophy.copy)}"><i>${trophy.icon}</i><b>${escapeHTML(trophy.name)}</b><small>${escapeHTML(trophy.copy)}</small></span>`).join("") : `<small>NO TROPHIES YET. RAISE RIZO A LITTLE LONGER.</small>`}</div></section>`;
  }

  function maybeAnnounceHouseUnlock() {
    if (!houseIsUnlocked() || state.farm.unlockSeen || isUILocked() || mini.active) return;
    state.farm.unlockSeen = true;
    rememberUnlockScene("house-unlock");
    saveState(true);
    playPetCutscene({scene:"event",kicker:"NEW FEATURE UNLOCKED",title:"THE SPARE ROOM WOKE UP.",symbol:"⌂",duration:1480,className:"feature-unlock-cutscene unlock-house",after:()=>{
      showModal(`<div class="modal-card house-unlock-modal unlock-reveal"><small>NEW FEATURE UNLOCKED</small><div class="house-unlock-door"><i></i><b>⌂</b></div><h2>THE SPARE ROOM IS OPEN.</h2><p class="big-line">YOU LEARNED HOW TO RAISE ONE RIZO. NOW THE HOUSE CAN GROW.</p><p>Adopt expensive new Rizos, keep three in each room, watch them live together, and swap any resident into the main Den.</p><div class="modal-buttons"><button data-close-modal>NOT YET</button><button class="primary" data-open-house>ENTER RIZO HOUSE</button></div></div>`);
      sfx("level");
      celebrate();
    }});
  }

  function maybeAnnounceLegacyReady() {
    if (!canRebirth() || hasSeenUnlockScene("legacy-ready") || isUILocked() || mini.active) return;
    rememberUnlockScene("legacy-ready");
    saveState(true);
    playPetCutscene({scene:"evolution",kicker:"LONG GAME PAYOFF",title:`${state.pet.name} CAN BECOME A LEGACY EGG.`,symbol:"↻",duration:1560,className:"feature-unlock-cutscene unlock-legacy",after:()=>{
      showModal(`<div class="modal-card unlock-reveal legacy-ready-modal"><small>NEW SYSTEM READY</small><div class="modal-art">↻</div><h2>LEGACY IS AVAILABLE.</h2><p class="big-line">THIS RIZO CAN BECOME AN ANCESTOR NOW.</p><p>You hit Mature, 80 Bond, and 300 total training. Rebirth keeps your collection, rooms, and currency while the next egg inherits stronger genetic caps.</p><div class="modal-buttons"><button data-close-modal>LATER</button><button class="primary" data-rebirth-info>VIEW LEGACY PATH</button></div></div>`);
      sfx("legendary");
      celebrate();
    }});
  }

  function nextBackupPromptId() {
    if ((state.player.streak || 0) >= 7 && !(state.meta.backupPrompts || []).includes("week-1")) return "week-1";
    if (houseIsUnlocked() && !(state.meta.backupPrompts || []).includes("house-1")) return "house-1";
    if (state.pet.stage === "legend" && !(state.meta.backupPrompts || []).includes("mature-1")) return "mature-1";
    if ((state.meta.rebirths || 0) > 0 && !(state.meta.backupPrompts || []).includes("rebirth-1")) return "rebirth-1";
    return null;
  }

  function maybePromptBackup() {
    const id = nextBackupPromptId();
    if (!id || isUILocked() || mini.active) return;
    if (!Array.isArray(state.meta.backupPrompts)) state.meta.backupPrompts = [];
    state.meta.backupPrompts.push(id);
    saveState(true);
    const lines = {
      "week-1": "You kept this save alive for a week. That is long enough for it to matter.",
      "house-1": "The House is open now. Your timeline officially has more than one moving part.",
      "mature-1": "A Mature Rizo is a real milestone. This is the point where a backup stops being optional.",
      "rebirth-1": "You created lineage. Export a copy so this family tree never disappears."
    };
    showModal(`<div class="modal-card backup-reminder-modal"><small>BACKUP REMINDER</small><div class="modal-art">⤓</div><h2>EXPORT THIS TIMELINE.</h2><p class="big-line">${escapeHTML(lines[id] || "This save is becoming important.")}</p><p>Progress is stored on this device. Export a JSON backup before switching phones or clearing browser data.</p><div class="modal-buttons"><button data-close-modal>LATER</button><button class="primary" data-export-save>BACKUP NOW</button></div></div>`);
  }

  function moodInfo() {
    const pet = state.pet;
    if (pet.stage === "egg") return { label: pet.hatch > 70 ? "RESTLESS" : "CURIOUS", color: "#16c8ff" };
    if (!pet.alive) return { label: "GONE", color: "#8b93a0" };
    if (pet.sleeping) return { label: "DREAMING", color: "#6c8cff" };
    if (pet.sick) return { label: "SICK", color: "#9eff75" };
    if (pet.hunger < 18) return { label: "STARVING", color: "#ff5c6c" };
    if (pet.energy < 18) return { label: "EXHAUSTED", color: "#6c8cff" };
    if (pet.hygiene < 18) return { label: "STINKY", color: "#ffd45a" };
    if (pet.mood < 18) return { label: "DRAMATIC", color: "#ff68bd" };
    if (Math.max(pet.strength || 0, pet.skills?.power || 0) > 65) return { label: "JACKED", color: "#ff5c6c" };
    if (pet.bond > 70) return { label: "OBSESSED", color: "#ff68bd" };
    if (pet.mood > 78) return { label: "THRIVING", color: "#9eff75" };
    return { label: "CHILLING", color: "#16c8ff" };
  }

  function descriptorText() {
    const pet = state.pet;
    if (pet.stage === "egg") return pet.shame ? "FREE EGG • IT KNOWS" : "WARM • DEFINITELY WEIRD";
    const variant = currentVariant();
    const form = displayFormInfo(pet);
    return `GEN ${pet.generation || 1} • ${form.name} • ${Math.floor(pet.bond)} BOND`;
  }

  function needColor(value) {
    if (value < 20) return "#ff5c6c";
    if (value < 45) return "#ffd45a";
    return "#9eff75";
  }

  // ===== UI RENDER PIPELINE =====
  function reducedMotionActive(){
    try{return Boolean(state?.settings?.reducedMotion||matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);}catch(error){return Boolean(state?.settings?.reducedMotion);}
  }
  function renderSharedUI() {
    document.body.classList.toggle("reduce-motion", reducedMotionActive());
    el.keeperShort.textContent = state.player.keeperId.slice(-4);
    el.streakCount.textContent = state.player.streak;
    el.coinCount.textContent = formatNumber(state.wallet.embers);
    const houseNav = document.querySelector('[data-nav="farm"]');
    if (houseNav) {
      const locked = !houseIsUnlocked();
      houseNav.classList.toggle("feature-locked", locked);
      houseNav.dataset.lockLabel = locked ? `LV ${HOUSE_UNLOCK_LEVEL}` : "";
      houseNav.setAttribute("aria-label", locked ? `Rizo House. Unlocks at Rizo level ${HOUSE_UNLOCK_LEVEL}.` : "Rizo House");
    }
  }

  function renderCurrentView() {
    if (currentView === "home") {
      renderHome();
      renderSeason();
    } else if (currentView === "arcade") {
      renderArcade();
      renderExpedition();
    } else if (currentView === "closet") {
      renderCloset();
    } else if (currentView === "journal") {
      renderJournal();
    } else if (currentView === "farm") {
      renderFarm();
    }
  }

  function renderAll() {
    resetDailyIfNeeded();
    checkHouseUnlock();
    renderSharedUI();
    renderCurrentView();
    renderTutorial();
    refreshAdSlots();
    globalThis.RizoModes?.resizeActive?.("render");
    setTimeout(maybeAnnounceHouseUnlock, 0);
    setTimeout(maybeAnnounceLegacyReady, 80);
    setTimeout(maybePromptBackup, 160);
  }

  function renderHome() {
    const pet = state.pet;
    const variant = currentVariant();
    const isEgg = pet.stage === "egg";
    const mood = moodInfo();

    el.habitatScene.className = `habitat-scene ${ROOMS.find(room => room.id === pet.room)?.className || "theme-rain"}`;
    el.moodChip.querySelector("i").style.background = mood.color;
    el.moodChip.querySelector("span").textContent = mood.label;
    applyLivingMood();
    el.petName.textContent = isEgg ? "MYSTERY EGG" : pet.name;
    el.petDescriptor.textContent = descriptorText();
    el.petLevel.textContent = isEgg ? "0" : levelForXP(pet.xp);
    el.careName.textContent = isEgg ? "THE EGG" : pet.name;
    el.sleepActionText.textContent = pet.sleeping ? "WAKE" : "SLEEP";

    el.eggActor.hidden = !isEgg;
    el.petActor.hidden = isEgg;
    el.eggActor.classList.toggle("cracking", pet.hatch >= 70);
    if (isEgg) {
      el.eggActor.style.setProperty("--egg-color", variant.color);
      el.growthTitle.textContent = "HATCHING";
      el.growthText.textContent = `${Math.floor(pet.hatch)}%`;
      el.growthBar.style.width = `${pet.hatch}%`;
    } else {
      const stage = currentStage();
      const visual = getPetVisualState(pet, { context:"den" });
      applyPetVisualToNodes(visual, { sprite: el.petSprite, accessory: el.accessoryLayer, actor: el.petActor });
      el.faceFx.className = `face-fx ${pet.mood < 15 ? "tears" : ""}`;
      el.statusFx.className = `status-fx ${pet.sleeping ? "zzz" : ""}`;
      const evolution = evolutionRequirements(stage);
      el.growthTitle.textContent = stage.nextXP === Infinity ? (pet.elder ? "LEGACY READY" : "FULLY GROWN") : `GROWING TO ${evolution.next?.name || "MATURE"}`;
      el.growthText.textContent = stage.nextXP === Infinity ? (pet.elder ? "REBIRTH AVAILABLE" : displayFormInfo(pet).name) : evolution.missing;
      el.growthBar.style.width = `${evolution.progress}%`;
    }
    renderDenCareTrace(isEgg);

    const needs = ["hunger", "mood", "energy", "hygiene"];
    for (const need of needs) {
      el[`${need}Text`].textContent = Math.floor(pet[need]);
      el[`${need}Bar`].style.width = `${clamp(pet[need])}%`;
      el[`${need}Bar`].style.background = needColor(pet[need]);
    }
    const hygieneLabel = el.hygieneText?.parentElement?.querySelector("small");
    if (hygieneLabel) hygieneLabel.textContent = pet.hygiene < 18 ? "FILTHY" : pet.hygiene < 35 ? "DIRTY" : pet.hygiene < 60 ? "MESSY" : "CLEAN";
    el.needGrid.style.opacity = isEgg ? ".34" : "1";
    $$("[data-need]").forEach(button => {
      const need = button.dataset.need;
      button.disabled = isEgg || !pet.alive || (pet.sleeping && need !== "energy");
      const labels = { hunger: "Open food menu", mood: "Open play menu", energy: pet.sleeping ? "Wake Rizo" : "Rest and recharge", hygiene: "Clean Rizo" };
      button.setAttribute("aria-label", `${labels[need]}. Current ${need}: ${Math.floor(pet[need])}`);
      button.title = labels[need];
    });
    const lowestNeed = pet.sleeping ? "energy" : needs.reduce((lowest, need) => pet[need] < pet[lowest] ? need : lowest, needs[0]);
    const suggestedAction = { hunger: "feed", mood: "play", energy: "sleep", hygiene: "clean" }[lowestNeed];
    $$("[data-action]").forEach(button => {
      const action = button.dataset.action;
      button.disabled = isEgg || !pet.alive || (pet.sleeping && !["sleep"].includes(action));
      const recommended = !button.disabled && action === suggestedAction;
      button.classList.toggle("recommended", recommended);
      if (recommended) button.setAttribute("aria-label", `${action}. Recommended because ${lowestNeed} is currently lowest.`);
      else button.removeAttribute("aria-label");
    });

    el.dailyGiftButton.setAttribute("aria-label", state.daily.giftClaimed ? "Daily gift already claimed" : `Claim day ${state.player.streak} daily gift`);
    el.dailyGiftButton.title = state.daily.giftClaimed ? "Daily gift claimed" : "Claim daily gift";
    el.questTitle.textContent = state.daily.title;
    el.questText.textContent = `${Math.min(state.daily.progress, state.daily.target)} / ${state.daily.target}`;
    el.questBar.style.width = `${clamp(state.daily.progress / state.daily.target * 100)}%`;
    const questReady = !state.daily.claimed && state.daily.progress >= state.daily.target;
    const questRemaining = Math.max(0, state.daily.target - state.daily.progress);
    el.questClaim.disabled = false;
    el.questClaim.classList.toggle("locked", !questReady && !state.daily.claimed);
    el.questClaim.classList.toggle("claimed", state.daily.claimed);
    el.questClaim.textContent = state.daily.claimed ? "DONE" : questReady ? `CLAIM R ${state.daily.reward}` : `R ${state.daily.reward}`;
    el.questClaim.title = state.daily.claimed ? "Daily mission already claimed" : questReady ? "Claim your daily reward" : `${questRemaining} more to unlock`;
    el.questClaim.setAttribute("aria-label", el.questClaim.title);
    el.dailyGiftButton.style.opacity = state.daily.giftClaimed ? ".52" : "1";

    renderGardenVisitor();
    renderGardenGrowth();
    renderHabitatShelf();
    const latest = state.memories[0];
    el.memoryTitle.textContent = latest?.title || "THE EGG IN THE RAIN";
    el.memoryText.textContent = latest?.text || "You found something impossible under a tree and decided that was somehow your problem now.";
  }

  function renderDenCareTrace(isEgg = false) {
    const trace = el.denCareTrace;
    if (!trace) return;
    const memory = lifeMemory();
    const current = now();
    let copy = "";
    if (!isEgg && current - (Number(memory.lastBathAt) || 0) < 15 * 60 * 1000) copy = "BATH WATER / DO NOT DRINK";
    else if (!isEgg && current - (Number(memory.lastFoodAt) || 0) < 3 * 60 * 1000) copy = "CRUMBS / EVIDENCE";
    else if (!isEgg && Number(memory.arcadeAfterglowUntil) > current) copy = "ARCADE RECEIPT / NO REFUNDS";
    trace.hidden = !copy;
    trace.textContent = copy;
  }

  function renderGardenVisitor() {
    if (!el.gardenVisitor) return;
    const visitor = state.social?.currentVisitor;
    const active = visitor && Number(visitor.expiresAt) > now();
    el.gardenVisitor.hidden = !active;
    if (!active) return;
    const visual = getPetVisualState(visitor, { sleeping: false, sick: false, resting: false, low: false, behavior: "", context:"den" });
    el.gardenVisitor.dataset.baseClass = "garden-visitor";
    applyPetVisualToNodes(visual, { sprite: el.visitorSprite, accessory: el.visitorAccessory, actor: el.gardenVisitor });
    el.visitorSprite.alt = `${visitor.name || "Guest Rizo"}, visiting Rizo`;
    el.visitorName.textContent = `${visitor.name || "GUEST RIZO"} • VISITING`;
    el.gardenVisitor.style.setProperty("--visitor-color", visual.variant.color);
  }

  function renderHabitatShelf() {
    const shelf = el.habitatScene?.querySelector(".habitat-shelf");
    if (!shelf) return;
    let row = shelf.querySelector(".shelf-trophies");
    if (!row) {
      row = document.createElement("div");
      row.className = "shelf-trophies";
      shelf.appendChild(row);
    }
    const trophies = keeperTrophies();
    const signature = trophies.map(trophy => trophy.id).join("|");
    const previousCount = Number(row.dataset.count || 0);
    shelf.classList.toggle("has-trophies", trophies.length > 0);
    if (row.dataset.signature === signature) return;
    row.dataset.signature = signature;
    row.dataset.count = String(trophies.length);
    row.innerHTML = trophies.map((trophy,index) => `<span class="shelf-trophy trophy-${trophy.id} ${index === trophies.length - 1 ? "newest" : ""}" style="--trophy-color:${trophy.color};--trophy-delay:${index * .13}s" title="${escapeHTML(trophy.name)}"><i>${trophy.icon}</i><u></u></span>`).join("");
    if (trophies.length > previousCount) {
      row.classList.remove("trophy-award");
      void row.offsetWidth;
      row.classList.add("trophy-award");
      setTimeout(() => row.classList.remove("trophy-award"), 1500);
    }
  }

  function renderGardenGrowth() {
    const host = $("#gardenGrowth");
    if (!host) return;
    const pet = state.pet;
    if (pet.stage === "egg") {
      host.innerHTML = `<button class="growth-overview egg" data-open-growth type="button"><span>GENETICS SEALED</span><b>HATCH TO REVEAL POTENTIAL</b><small>The shell already contains bounded traits.</small></button>${keeperPathCompactMarkup()}`;
      return;
    }
    const align = alignmentInfo(pet);
    const form = displayFormInfo(pet);
    const top = [...SKILLS].sort((a,b)=>(pet.skills[b.id]||0)-(pet.skills[a.id]||0))[0];
    host.innerHTML = `<button class="growth-overview" data-open-growth type="button" style="--align:${align.color}"><span>${align.icon} ${align.name} • GEN ${pet.generation || 1}</span><b>${form.name}</b><small>${top.icon} ${top.name} ${Math.floor(pet.skills[top.id]||0)} / ${Math.floor(pet.genes[top.id]||100)} • TAP FOR GENETICS</small></button>
      <div class="skill-mini-row">${SKILLS.map(skill=>`<i title="${skill.name}"><u style="height:${clamp((pet.skills[skill.id]||0)/(pet.genes[skill.id]||100)*100)}%;background:${skill.color}"></u><b>${skill.icon}</b></i>`).join("")}</div>${keeperPathCompactMarkup()}`;
  }

  function renderArcade() {
    // Personal bests and their labels both come from the training definitions,
    // so the board can never show an engineering id where a product name
    // belongs. Game modes fill their own cells from their summary.
    for(const mode of ARCADE_MODES){
      const cell=$(`[data-arcade-best="${mode}"]`);
      if(!cell)continue;
      const value=cell.querySelector("b"),label=cell.querySelector("span");
      if(value)value.textContent=arcadeBestValue(mode);
      if(label)label.textContent=arcadeName(mode);
    }
    // The decision is made on the shelf, so put the decision information there:
    // what you have already done, what it costs, and how long it takes.
    for(const mode of ARCADE_MODES){
      const meta=$(`[data-arcade-meta="${mode}"]`);
      if(!meta)continue;
      const game=trainingGame(mode),affordable=(state.pet?.energy??0)>=game.energy;
      meta.innerHTML=`<span class="meta-best"><small>${arcadeBestLabel(mode)}</small><b>${arcadeBestValue(mode)}</b></span>`
        +`<span class="meta-energy${affordable?"":" short"}"><small>ENERGY</small><b>${game.energy}</b></span>`
        +`<span class="meta-length"><small>RUN</small><b>${arcadeRunLength(mode)}</b></span>`;
    }
    renderModeShelf();
    $$('[data-minigame]').forEach(button => {
      const mode = button.dataset.minigame, game = trainingGame(mode);
      if (!game) { button.classList.add("game-blocked"); button.textContent = "UNAVAILABLE"; return; }
      const need = game.energy;
      const blocked = state.pet.stage === "egg" || state.pet.resting || state.pet.sleeping || state.pet.energy < need;
      const base = game.button || "PLAY";
      button.classList.toggle("game-blocked", blocked);
      button.textContent = state.pet.stage === "egg" ? "HATCH FIRST" : state.pet.resting ? "RECOVERING" : state.pet.sleeping ? "WAKE RIZO" : state.pet.energy < need ? `NEED ${need} ENERGY` : base;
      button.title = blocked ? "Tap for the exact reason this run cannot start yet." : `Start ${game.name}.`;
    });
  }

  function renderCloset() {
    const pet = state.pet;
    const variant = currentVariant();
    const isEgg = pet.stage === "egg";
    if (isEgg) {
      el.closetActor.className = "pet-actor preview-actor stage-spark";
      el.closetActor.style.setProperty("--pet-color", VARIANTS[0].color);
      el.closetActor.style.setProperty("--pet-sprite", `url("${VARIANTS[0].sprite}")`);
      el.closetSprite.src = "./assets/rizo-classic.png";
      el.closetSprite.style.filter = "brightness(0) opacity(.24)";
      renderWearableToNode(el.closetAccessory, getPetVisualState(pet, { accessory:"none", context:"closet" }));
    } else {
      const visual = getPetVisualState(pet, { context:"closet" });
      el.closetSprite.style.filter = "";
      applyPetVisualToNodes(visual, { sprite: el.closetSprite, accessory: el.closetAccessory, actor: el.closetActor });
    }
    el.closetName.textContent = isEgg ? "MYSTERY EGG" : pet.name;
    el.closetVariant.textContent = isEgg ? "HATCH TO REVEAL" : variant.name;
    renderShopList();
  }

  function renderShopList() {
    if (!el.shopList) return;
    if (shopTab === "wear") {
      el.shopList.innerHTML = ACCESSORIES.filter(item => !item.earned || state.inventory.accessories.includes(item.id)).map(item => {
        const owned = state.inventory.accessories.includes(item.id);
        const equipped = state.pet.accessory === item.id;
        const shortOnEmbers = !owned && state.wallet.embers < item.cost;
        const rarityTag = item.id !== "none" ? `<span class="rarity-tag rarity-tag-${item.rarity}">${item.rarity.toUpperCase()}</span>` : "";
        const preview = state.pet.stage === "egg" ? `<div class="shop-item-icon">${item.icon}</div>` : `<div class="shop-pet-preview">${petMarkup({extraClass:"shop-preview-pet",overrides:{accessory:item.id},id:null,label:`${state.pet.name} wearing ${item.name}`})}</div>`;
        return `<article class="shop-item rarity-card-${item.rarity}">${preview}<div><h3>${item.name} ${rarityTag}</h3><p>${item.description}</p></div><button class="${owned ? "owned" : ""} ${shortOnEmbers ? "short-on-embers" : ""}" data-buy-accessory="${item.id}" ${equipped ? "disabled" : ""} title="${shortOnEmbers ? "Not enough Embers yet" : equipped ? "Currently equipped" : owned ? "Equip " + item.name : "Buy " + item.name}">${equipped ? "EQUIPPED" : owned ? "EQUIP" : `R ${item.cost}`}</button></article>`;
      }).join("");
    } else if (shopTab === "rooms") {
      el.shopList.innerHTML = ROOMS.map(item => {
        const owned = state.inventory.rooms.includes(item.id);
        const equipped = state.pet.room === item.id;
        const shortOnEmbers = !owned && state.wallet.embers < item.cost;
        return `<article class="shop-item room-shop-card"><div class="room-swatch ${item.className}"><span>${item.icon}</span><i></i></div><div><h3>${item.name}</h3><p>${item.description}</p></div><button class="${owned ? "owned" : ""} ${shortOnEmbers ? "short-on-embers" : ""}" data-buy-room="${item.id}" ${equipped ? "disabled" : ""} title="${shortOnEmbers ? "Not enough Embers yet" : equipped ? "Current room" : owned ? "Use " + item.name : "Buy " + item.name}">${equipped ? "ACTIVE" : owned ? "USE" : `R ${item.cost}`}</button></article>`;
      }).join("");
    } else {
      el.shopList.innerHTML = BOOSTS.filter(item => !item.futureAd).map(item => {
        const quantity = state.inventory[item.id] || 0;
        const shortOnEmbers = state.wallet.embers < item.cost;
        return `<article class="shop-item"><div class="shop-item-icon">${item.icon}</div><div><h3>${item.name}</h3><p>${item.description} • OWNED ${quantity}</p></div><button class="${shortOnEmbers ? "short-on-embers" : ""}" data-buy-boost="${item.id}" title="${shortOnEmbers ? "Not enough Embers yet" : "Buy " + item.name}">R ${item.cost}</button></article>`;
      }).join("");
    }
  }

  function renderJournal() {
    const pet = state.pet;
    const variant = currentVariant();
    if (pet.stage === "egg") {
      el.profileActor.className = "mini-pet profile-pet stage-spark";
      el.profileSprite.src = VARIANTS[0].sprite;
      el.profileSprite.style.filter = "brightness(0) opacity(.3)";
      renderWearableToNode(el.profileAccessory, getPetVisualState(pet, { accessory:"none", context:"card" }));
    } else {
      el.profileSprite.style.filter = "";
      applyPetVisualToNodes(getPetVisualState(pet, { context:"card" }), { sprite: el.profileSprite, accessory: el.profileAccessory, actor: el.profileActor });
    }
    el.profileRarity.textContent = pet.stage === "egg" ? "MYSTERY" : `${variant.rarity} • ${pet.stage.toUpperCase()}`;
    el.profileName.textContent = pet.stage === "egg" ? "MYSTERY EGG" : pet.name;
    const formInfo = displayFormInfo(pet);
    el.profileBio.textContent = pet.stage === "egg" ? "Found in the rain. Future unclear." : `Gen ${pet.generation || 1} • ${petAgeText()} • ${formInfo.name} • ${pet.personality || "MYSTERY"} • ${Math.floor(pet.bond)} bond`;

    if (journalTab === "stats") renderJournalStats();
    if (journalTab === "collection") renderJournalCollection();
    if (journalTab === "memories") renderJournalMemories();
    if (journalTab === "settings") renderJournalSettings();
  }

  function renderJournalStats() {
    const pet = state.pet;
    const unlocked = ACHIEVEMENTS.filter(item => state.achievements.includes(item.id)).length;
    const align = alignmentInfo(pet);
    const form = displayFormInfo(pet);
    const stage = currentStage();
    const evolution = evolutionRequirements(stage);
    el.journalContent.innerHTML = `<div class="journal-panel">
      <section class="stat-board evolution-board"><div class="evolution-head"><div><small>RAISED, NOT RANDOM</small><h3>${form.name}</h3><p>${form.copy}</p></div><span style="--align:${align.color}">${align.icon} ${align.name}</span></div><div class="alignment-track"><i style="left:${clamp((pet.alignment+100)/2)}%"></i></div><div class="evolution-copy">${stage?.nextXP === Infinity ? (pet.elder ? "LEGACY EGG IS READY." : "MAX STAGE. KEEP BUILDING BOND FOR REBIRTH.") : `NEXT: ${evolution.next?.name} • ${evolution.missing}`}</div></section>
      <section class="stat-board"><h3>APTITUDES + GENETIC CAPS</h3><p class="board-note">Games train specific stats. The right number is this Rizo's inherited cap.</p><div class="aptitude-list">${SKILLS.map(skill=>aptitudeHTML(skill, pet)).join("")}</div></section>
      <section class="stat-board"><h3>CURRENT RIZO</h3><div class="stat-list">
        <div class="stat-tile"><b>${pet.stage === "egg" ? 0 : levelForXP(pet.xp)}</b><span>LEVEL</span></div>
        <div class="stat-tile"><b>${pet.generation || 1}</b><span>GENERATION</span></div>
        <div class="stat-tile"><b>${Math.floor(pet.bond)}</b><span>BOND</span></div>
        <div class="stat-tile"><b>${Math.floor(skillTotal(pet))}</b><span>TRAINING</span></div>
      </div><div class="pet-vitals">
        ${vitalHTML("HEALTH", pet.health)}${vitalHTML("FULL", pet.hunger)}${vitalHTML("HAPPY", pet.mood)}${vitalHTML("ENERGY", pet.energy)}${vitalHTML("CLEAN", pet.hygiene)}
      </div></section>
      ${keeperPathJournalMarkup()}
      ${keeperTrophyJournalMarkup()}
      <section class="stat-board"><h3>KEEPER RECORD</h3><div class="stat-list">
        <div class="stat-tile"><b>${formatNumber(state.meta.totalTaps)}</b><span>TAPS</span></div>
        <div class="stat-tile"><b>${state.meta.totalHatched}</b><span>HATCHED</span></div>
        <div class="stat-tile"><b>${state.meta.rebirths || 0}</b><span>REBIRTHS</span></div>
        <div class="stat-tile"><b>${state.meta.bondEggs || 0}</b><span>BOND EGGS</span></div>
        <div class="stat-tile"><b>${state.meta.recoveries || 0}</b><span>RECOVERIES</span></div>
        <div class="stat-tile"><b>${state.player.streak}</b><span>DAY STREAK</span></div><div class="stat-tile"><b>${state.season.level}</b><span>HEAT LEVEL</span></div><div class="stat-tile"><b>${formatNumber(state.wallet.shards)}</b><span>SHARDS</span></div><div class="stat-tile"><b>${state.meta.capsules}</b><span>CAPSULES</span></div>
        <div class="stat-tile"><b>${state.meta.totalWalks || 0}</b><span>WALKS</span></div><div class="stat-tile"><b>${Object.values(state.treasures || {}).filter(Boolean).length}/${WALK_TREASURES.length}</b><span>TREASURES</span></div>
        <div class="stat-tile"><b>${unlocked}/${ACHIEVEMENTS.length}</b><span>BADGES</span></div>
      </div></section>
      <section class="stat-board"><h3>BADGES</h3><div class="badge-list">${ACHIEVEMENTS.map(item => `<article class="badge-card ${state.achievements.includes(item.id) ? "unlocked" : ""}"><div class="badge-icon">${item.icon}</div><div><h3>${item.name}</h3><p>${item.description} • R ${item.reward}</p></div></article>`).join("")}</div></section>
    </div>`;
  }

  function aptitudeHTML(skill, pet = state.pet) {
    const value = pet.skills?.[skill.id] || 0;
    const cap = pet.genes?.[skill.id] || 100;
    return `<div class="aptitude-row"><span style="color:${skill.color}">${skill.icon}</span><div><b>${skill.name}</b><small>${skill.games}</small><i><u style="width:${clamp(value/cap*100)}%;background:${skill.color}"></u></i></div><strong>${Math.floor(value)}<em>/${Math.floor(cap)}</em></strong></div>`;
  }

  function vitalHTML(label, value) {
    return `<div class="vital-row"><span>${label}</span><i><u style="width:${clamp(value)}%;background:${needColor(value)}"></u></i><b>${Math.floor(value)}</b></div>`;
  }

  function renderJournalCollection() {
    const pity = Math.min(50, state.meta.pity || 0);
    const discovered = Object.keys(state.collection || {}).filter(key => state.collection[key] > 0).length;
    const capsulePanel = houseIsUnlocked()
      ? `<section class="capsule-machine"><small>RIZO ADOPTION NETWORK</small><h2>A NEW RIZO IS A REAL COMMITMENT.</h2><p>Every paid capsule creates a living Rizo and places it into the first open House room. Rooms only hold three. No space means no purchase.</p><div class="capsule-wallet"><span>EMBERS <b>R ${formatNumber(state.wallet.embers)}</b></span><span>PRISM SHARDS <b>◇ ${formatNumber(state.wallet.shards)}</b></span><span>HOUSE <b>${state.farm.roster.length}/${state.farm.unlockedRooms.length * HOUSE_ROOM_CAPACITY}</b></span></div><div class="capsule-actions"><button data-capsule="standard">MYSTERY RIZO<br>R ${HOUSE_ADOPTION_COST}</button><button data-capsule="prism">PRISM RIZO<br>R 6000</button></div><div class="pity-track"><i style="width:${pity / 50 * 100}%"></i></div><div class="sheet-note">EVERY PURCHASE ADDS A REAL HOUSE RESIDENT • SECRET PITY ${pity}/50 • PRISM HAS STRONGER ODDS</div></section>`
      : `<section class="capsule-machine house-network-locked"><small>RIZO ADOPTION NETWORK</small><h2>THE NETWORK IS STILL LOCKED.</h2><p>Raise your first Rizo to Level ${HOUSE_UNLOCK_LEVEL} and finish the Keeper Basics. The House and paid adoption system open together.</p><div class="house-lock-progress"><i style="width:${clamp(state.pet.xp / HOUSE_UNLOCK_XP * 100)}%"></i></div><div class="sheet-note">CURRENT LEVEL ${levelForXP(state.pet.xp)} / ${HOUSE_UNLOCK_LEVEL} • ${state.player.tutorialStep >= 5 || state.player.tutorialDismissed ? "KEEPER BASICS COMPLETE" : "FINISH KEEPER BASICS"}</div></section>`;
    el.journalContent.innerHTML = `<div class="journal-panel">
      ${capsulePanel}
      <div class="collection-grid">${VARIANTS.map(item => {
        const count = state.collection[item.id] || 0;
        const tier = rarityTier(item.rarity);
        const cls = tier === "SECRET" ? "secret" : tier === "LEGENDARY" ? "legendary" : "";
        const selected = state.garden.nextEggVariant === item.id;
        return `<article class="collection-card variant-${item.id} ${count ? "" : "locked"} ${cls} ${selected ? "resonating" : ""}"><span class="rarity-pill ${tier.toLowerCase()}">${item.rarity}</span><img src="${item.sprite}" alt=""><strong>${count ? item.name : "???"}</strong><span>${count ? `DISCOVERED ${count}×` : item.source || "NOT DISCOVERED"}</span>${count ? `<button class="resonance-button" data-resonance="${item.id}" type="button">${selected ? "NEXT EGG SELECTED" : "RESONATE NEXT EGG"}</button>` : ""}</article>`;
      }).join("")}</div><div class="sheet-note">CAPSULE ODDS ARE WEIGHTED • RETRO IS ARCADE-LINKED • SHADOW CAN ONLY CHOOSE YOU IN THE DEEP FOREST<br><br>DISCOVERED RIZOS CAN RESONATE WITH YOUR NEXT LEGACY EGG, MAKING COLLECTIONS PART OF YOUR LINEAGE.</div>
      <div class="sheet-section-title">WALK TREASURES • ${Object.values(state.treasures).filter(Boolean).length}/${WALK_TREASURES.length}</div>
      <div class="treasure-grid">${WALK_TREASURES.map(item => { const count=state.treasures[item.id]||0; return `<article class="treasure-card ${count?"":"locked"}"><b>${count?item.icon:"?"}</b><strong>${count?item.name:"UNKNOWN FIND"}</strong><span>${count?`${item.rarity} • ${count}×`:"FIND IT ON A WALK"}</span></article>`; }).join("")}</div>
      </div>`;
  }

  function renderJournalMemories() {
    const memories = state.memories.length ? state.memories : [{ icon: "☂", title: "THE EGG IN THE RAIN", text: "You found something impossible and took it home.", at: state.player.createdAt }];
    el.journalContent.innerHTML = `<div class="journal-panel"><div class="memory-list">${memories.map(item => `<article class="memory-card"><div class="memory-icon">${item.icon || "✦"}</div><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p><time>${new Date(item.at).toLocaleString()}</time></div></article>`).join("")}</div><div class="sheet-section-title">FOREST ARCHIVE • ${state.loreUnlocked.length}/${LORE_FRAGMENTS.length}</div><div class="lore-archive">${LORE_FRAGMENTS.map((item,index)=>{const open=state.loreUnlocked.includes(item.id);return `<article class="lore-fragment ${open?"":"locked"}"><small>FRAGMENT ${String(index+1).padStart(2,"0")}</small><h3>${open?item.title:"LOCKED SIGNAL"}</h3><p>${open?item.text:"Find this fragment through capsules, growth, and expeditions."}</p></article>`}).join("")}</div></div>`;
  }

  // Only appears when a save could not be loaded and was kept aside (see SAVE SAFETY).
  function setAsideSavesMarkup(){
    const parked=readSaveQuarantine();if(!parked.length)return "";
    return `<section class="settings-board"><h3>SET-ASIDE SAVES</h3><div class="sheet-note">This device found a save it could not load and kept it untouched instead of overwriting it. If progress is missing, download it and send it to support.</div><div class="settings-actions">${parked.map(item=>`<button data-download-set-aside="${escapeHTML(item.key)}">${escapeHTML(item.at?new Date(item.at).toLocaleDateString():"UNKNOWN DATE")}</button>`).join("")}</div></section>`;
  }
  function renderJournalSettings() {
    el.journalContent.innerHTML = `<div class="journal-panel">
      <section class="settings-board"><h3>GAME SETTINGS</h3>
        ${toggleRow("SOUND EFFECTS", "Tiny bleeps, reactions, and arcade feedback.", "sound", state.settings.sound)}
        ${volumeRow("SFX VOLUME", "Adjust reaction and Arcade feedback volume.", "soundVolume", state.settings.soundVolume)}
        ${toggleRow("MUSIC", "Procedural chiptune themes that change by room and game.", "music", state.settings.music)}
        ${volumeRow("MUSIC VOLUME", "Adjust Den, House, Arcade, and Ember Beat music.", "musicVolume", state.settings.musicVolume)}
        ${toggleRow("HAPTICS", "Phone vibrations where supported.", "haptics", state.settings.haptics)}
        ${toggleRow("REDUCED MOTION", "Cuts most animation.", "reducedMotion", state.settings.reducedMotion)}
      </section>
      ${modeSettingsMarkup()}
      <section class="settings-board"><h3>HOW TO KEEP RIZO ALIVE</h3><div class="sheet-note">Replay the care guide whenever the need meters or growth systems stop making sense.</div><button class="wide-button" data-open-care-guide>OPEN KEEPER GUIDE</button></section>
      <section class="settings-board"><h3>THIS DEVICE IS YOUR LOGIN</h3><p class="keeper-code">${state.player.keeperId}</p><div class="sheet-note">Progress lives in this browser. Copy a complete Keeper Code before switching phones or clearing website data.</div><div class="settings-actions"><button data-copy-keeper>COPY ID</button><button data-copy-recovery>COPY KEEPER CODE</button><button data-open-recovery>PASTE KEEPER CODE</button>${CONFIG.cloud.enabled ? '<button data-cloud-sync>SYNC NOW</button>' : '<button data-export-save>DOWNLOAD JSON</button>'}</div></section>
      <section class="settings-board"><h3>RIZO APPAREL</h3><div class="sheet-note">Rizo Life is made by Rizo Apparel. The game is free; the clothes are extremely real.</div><a class="wide-button" style="display:block;text-align:center;text-decoration:none" href="${escapeHTML(storeUrl())}" target="_blank" rel="noopener">SHOP RIZO.STORE ↗</a></section>
      <section class="settings-board"><h3>INSTALL + UPDATES</h3><div class="sheet-note">${window.RizoInstall?.isStandalone?.() ? "Installed app mode is active." : "Install Rizo.game for fullscreen play and faster return visits."}<br><br><b>BUILD ${escapeHTML(RIZO_RUNTIME_BUILD)}</b> • ${releaseUpdateReady?"A newer build is waiting.":"Refresh Latest checks the network and replaces stale app caches."}${mini?.active&&mini.mode==="defense"?" Your active Defense run will checkpoint first.":""}</div><div class="settings-actions"><button data-show-install>INSTALL HELP</button><button class="update-refresh-button" data-refresh-latest>${releaseUpdateReady?"UPDATE NOW":"REFRESH LATEST"}</button></div><div class="rizo-legal-links"><a href="./world.html">WORLD</a><a href="./journal.html">JOURNAL</a><a href="./about.html">ABOUT</a><a href="./privacy.html">PRIVACY</a><a href="./terms.html">TERMS</a><a href="./support.html">SUPPORT</a></div></section>
      <section class="settings-board"><h3>SAVE TOOLS</h3><div class="settings-actions"><button data-export-save>EXPORT SAVE</button><button data-import-save>IMPORT SAVE</button><button data-replay-origin>REPLAY ORIGIN</button><button data-copy-summary>COPY STATS</button></div><button class="wide-button danger" data-reset-save>DELETE THE ENTIRE TIMELINE</button></section>
      ${setAsideSavesMarkup()}
    </div>`;
  }

  function toggleRow(title, copy, key, checked) {
    return `<label class="setting-row"><span>${title}<small>${copy}</small></span><input class="toggle" type="checkbox" data-setting="${key}" ${checked ? "checked" : ""}></label>`;
  }

  function volumeRow(title, copy, key, value) {
    const percent = Math.round(clamp(Number(value ?? .85), 0, 1) * 100);
    return `<label class="setting-row volume-setting"><span>${title}<small>${copy}</small></span><span class="volume-control"><input aria-label="${title}" type="range" min="0" max="100" step="5" value="${percent}" data-volume-setting="${key}"><b data-volume-value="${key}">${percent}%</b></span></label>`;
  }

  function choiceRow(title, copy, key, value, choices) {
    return `<div class="setting-row setting-choice-row"><span>${title}<small>${copy}</small></span><span class="setting-choice-control" role="group" aria-label="${escapeHTML(title)}">${choices.map(([id,label])=>`<button type="button" data-setting-choice="${escapeHTML(key)}:${escapeHTML(id)}" class="${value===id?"active":""}" aria-pressed="${value===id}">${escapeHTML(label)}</button>`).join("")}</span></div>`;
  }

  function renderTutorial() {
    const step = state.player.tutorialStep;
    document.querySelectorAll(".tutorial-focus").forEach(node => node.classList.remove("tutorial-focus"));
    if (state.player.tutorialDismissed || step >= 5 || !state.introSeen) {
      el.tutorialBanner.hidden = true;
      return;
    }
    const instructions = [
      "Tap the egg until it hatches. The four need meters stay protected during its first twelve hours.",
      "Name your Rizo. After that, the Keeper Guide explains what happens when needs are ignored.",
      "Tap FEED, then drag a snack onto Rizo. Full, energy, clean, and happy keep falling while you are away.",
      "Finish one Arcade game. Games build XP and bond, but exhausted or sick Rizos cannot play.",
      "Open the Journal to see health, growth, memories, and save tools. Rizo House unlocks at Level 4."
    ];
    const targets = [el.petTapTarget, null, document.querySelector('[data-action="feed"]'), document.querySelector('[data-nav="arcade"]'), document.querySelector('[data-nav="journal"]')];
    targets[step]?.classList.add("tutorial-focus");
    el.tutorialBanner.hidden = false;
    el.tutorialStepBadge.textContent = String(step + 1).padStart(2, "0");
    el.tutorialText.textContent = instructions[step];
  }

  function refreshAdSlots() {
    // Inherited markup is retained for compatibility, never exposed or mounted.
    // Touch-driven care, cabinet navigation and the Closet are not display inventory.
    $$("[data-ad-slot]").forEach(slot => { slot.hidden = true; });
  }

  function clearToasts() {
    el.toastStack.replaceChildren();
  }

  function changeView(view) {
    clearToasts();
    currentView = view;
    $$(".view").forEach(section => section.classList.toggle("active", section.dataset.view === view));
    $$("[data-nav]").forEach(button => { const active = button.dataset.nav === view; button.classList.toggle("active", active); button.setAttribute("aria-current", active ? "page" : "false"); });
    window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? "auto" : "smooth" });
    renderSharedUI();
    renderCurrentView();
    refreshAdSlots();
    syncMusic();
    if (view === "home") schedulePetBehavior(3500);
    if (view === "journal" && state.player.tutorialStep === 4) {
      state.player.tutorialStep = 5;
      addMemory("TUTORIAL COMPLETE", "You learned the basics. Rizo is now legally your problem.", "✓");
      toast("TUTORIAL COMPLETE • +R 25");
      state.wallet.embers += 25;
      saveState();
      renderAll();
    }
  }

  function openSheet(kicker, title, html) {
    cancelFoodDrag();
    document.body.classList.remove("feed-mode");
    el.bottomSheet.classList.remove("feed-sheet");
    el.petTapTarget?.classList.remove("feed-target-ready", "feed-drop-over");
    clearToasts();
    lastOverlayFocus = document.activeElement;
    el.sheetKicker.textContent = kicker;
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = html;
    el.sheetBackdrop.classList.add("show");
    el.bottomSheet.classList.add("show");
    el.bottomSheet.inert = false;
    el.bottomSheet.setAttribute("aria-hidden", "false");
    syncUILock();
    requestAnimationFrame(() => el.sheetClose.focus({ preventScroll: true }));
  }

  function closeSheet() {
    cancelFoodDrag();
    document.body.classList.remove("feed-mode");
    el.bottomSheet.classList.remove("feed-sheet");
    el.petTapTarget?.classList.remove("feed-target-ready", "feed-drop-over");
    el.sheetBackdrop.classList.remove("show");
    el.bottomSheet.classList.remove("show");
    el.bottomSheet.inert = true;
    el.bottomSheet.setAttribute("aria-hidden", "true");
    syncUILock();
    if (lastOverlayFocus?.isConnected) lastOverlayFocus.focus({ preventScroll: true });
  }

  function openNeedAction(need) {
    const pet = state.pet;
    if (pet.stage === "egg") { toast("HATCH THE EGG FIRST"); return; }
    if (!pet.alive) return;
    if (need === "hunger") { openFoodSheet(); return; }
    if (need === "mood") { openPlaySheet(); return; }
    if (need === "hygiene") { cleanPet(); return; }
    if (need === "energy") {
      if (pet.sleeping) { toggleSleep(); return; }
      openSheet("CARE DECK", "REST & RECHARGE", `
        <article class="sheet-card"><div class="sheet-card-icon">☾</div><div><h3>GO TO SLEEP</h3><p>Energy recovers while Rizo sleeps, even after you close the game.</p></div><button data-more-action="sleep">SLEEP</button></article>
        <article class="sheet-card"><div class="sheet-card-icon">♥</div><div><h3>USE CARE PACKAGE</h3><p>Owned: ${state.inventory.care || 0}. Instantly restores energy and every other need.</p></div><button data-use-boost="care" ${(state.inventory.care || 0) < 1 ? "disabled" : ""}>USE</button></article>`);
    }
  }

  function openFoodSheet() {
    if (!canCare()) return;
    if (currentView !== "home") changeView("home");
    // Physical feeding needs both the tray and Rizo on screen at once. The care
    // deck sits below the Den, so return to the scene before opening the tray.
    window.scrollTo({ top: 0, behavior: "auto" });
    const pet = state.pet;
    const cards = FOODS.map(food => {
      const cooldownLeft = food.cooldown ? Math.max(0, food.cooldown - (now() - (pet.lastFreeSnack || 0))) : 0;
      const coolingDown = cooldownLeft > 0;
      const shortOnEmbers = state.wallet.embers < food.cost;
      const label = cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 60000)}M` : food.cost ? `R ${food.cost}` : "FREE";
      return `<button type="button" class="feed-drag-card ${shortOnEmbers ? "short-on-embers" : ""}" data-food-drag="${food.id}" ${coolingDown ? "disabled" : ""} aria-label="Drag ${escapeHTML(food.name)} onto Rizo or tap to feed"><span class="feed-drag-icon">${food.icon}</span><span><b>${escapeHTML(food.name)}</b><small>${escapeHTML(food.description)}</small></span><em>${label}</em></button>`;
    }).join("");
    openSheet("PHYSICAL CARE", "DRAG FOOD TO RIZO", `<div class="feed-instruction"><b>HOLD + DRAG</b><span>Drop a snack directly on ${escapeHTML(pet.name)}. Tapping a snack still works.</span></div><div class="feed-drag-tray">${cards}</div>`);
    document.body.classList.add("feed-mode");
    el.bottomSheet.classList.add("feed-sheet");
    el.petTapTarget.classList.add("feed-target-ready");
  }

  function pointInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function cancelFoodDrag() {
    if (!feedDrag) return;
    feedDrag.ghost?.remove();
    feedDrag.source?.classList.remove("drag-source");
    el.petTapTarget?.classList.remove("feed-drop-over");
    document.body.classList.remove("feed-dragging");
    feedDrag = null;
  }

  function beginFoodDrag(event) {
    const source = event.target.closest("[data-food-drag]");
    if (!source || source.disabled || !document.body.classList.contains("feed-mode")) return;
    event.preventDefault();
    const icon = source.querySelector(".feed-drag-icon");
    const ghost = document.createElement("div");
    ghost.className = "feed-drag-ghost";
    ghost.innerHTML = icon?.innerHTML || "🍗";
    document.body.appendChild(ghost);
    source.classList.add("drag-source");
    source.setPointerCapture?.(event.pointerId);
    feedDrag = { pointerId:event.pointerId, foodId:source.dataset.foodDrag, source, ghost, startX:event.clientX, startY:event.clientY, moved:false };
    document.body.classList.add("feed-dragging");
    moveFoodDrag(event);
    haptic(8);
  }

  function moveFoodDrag(event) {
    if (!feedDrag || event.pointerId !== feedDrag.pointerId) return;
    const dx = event.clientX - feedDrag.startX;
    const dy = event.clientY - feedDrag.startY;
    if (Math.hypot(dx, dy) > 7) feedDrag.moved = true;
    feedDrag.ghost.style.left = `${event.clientX}px`;
    feedDrag.ghost.style.top = `${event.clientY}px`;
    const over = pointInsideRect(event.clientX, event.clientY, el.petTapTarget.getBoundingClientRect());
    el.petTapTarget.classList.toggle("feed-drop-over", over);
  }

  function endFoodDrag(event, cancelled = false) {
    if (!feedDrag || event.pointerId !== feedDrag.pointerId) return;
    const drag = feedDrag;
    const over = !cancelled && pointInsideRect(event.clientX, event.clientY, el.petTapTarget.getBoundingClientRect());
    const tap = !cancelled && !drag.moved;
    feedClickBlockedUntil = now() + 450;
    cancelFoodDrag();
    if (over || tap) {
      const used = useFood(drag.foodId);
      if (used && over) animatePet("happy-jump", 520);
    } else {
      toast("DROP THE FOOD ON RIZO");
      sfx("no");
      haptic(12);
    }
  }

  function openPlaySheet() {
    openSheet("QUICK QUEUE", "PICK A CABINET", `
      <article class="sheet-card"><div class="sheet-card-icon">♥</div><div><h3>HEAD PAT</h3><p>Quick affection. +7 happy and +2 bond.</p></div><button data-head-pat>PAT</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">×</div><div><h3>POWER TAPE</h3><p>Coach calls the strike. Match JAB, BODY, or HOOK to the timing window, hold through feints, and earn Overdrive.</p></div><button data-sheet-game="power">TRAIN</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">★</div><div><h3>SPARK STASH</h3><p>Build an unbanked spark stash, choose when to cash it, and lose the risky pile if a Shadow catches your greed.</p></div><button data-sheet-game="spark">CHASE</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">⌁</div><div><h3>FOREST LUNCH</h3><p>Pack Rizo's exact lunch ticket lane by lane. Every second plate triggers a frantic Picnic Panic decision burst.</p></div><button data-sheet-game="forage">FORAGE</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">↗</div><div><h3>RIZO COURIER</h3><p>Run the rooftops, grab a parcel, then survive two clean clears to actually deliver it before you crash.</p></div><button data-sheet-game="rush">RUN</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">☂</div><div><h3>RIZO WALK</h3><p>Explore branching forest routes, weather, strange finds, and permanent treasures.</p></div><button data-sheet-game="walk">WALK</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">♫</div><div><h3>EMBER BEAT</h3><p>Match four lanes, chase Perfect timing, and unlock harder songs while Rizo builds Speed.</p></div><button data-sheet-game="rhythm">PLAY</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">▦</div><div><h3>LOST SIGNAL</h3><p>Memorize a pirate transmission while the signal mutates: reverse, opposite, rotate, then stacked corruption rules.</p></div><button data-sheet-game="memory">REMEMBER</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">⌁</div><div><h3>SKYBOUND</h3><p>Ride shifting wind and deliberately thread gate centers to charge Thermal Bursts that change the flight physics.</p></div><button data-sheet-game="glide">FLY</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">✦</div><div><h3>EMBER FORGE</h3><p>Break authored Rizo-mark walls, protect your angle, and hunt CORE blocks that collapse nearby forge pieces.</p></div><button data-sheet-game="breaker">BREAK</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">⌗</div><div><h3>RIZO RUNAWAY</h3><p>Route through the maze, bait three Shadow behaviors, then reverse the hunt with Prism Seeds.</p></div><button data-sheet-game="maze">RUN</button></article>`);
  }

  function openMoreCareSheet() {
    const pet = state.pet;
    openSheet("CARE DECK", "MORE THINGS TO DO", `
      <article class="sheet-card"><div class="sheet-card-icon">?</div><div><h3>KEEPER GUIDE</h3><p>Needs, consequences, growth, and the Level 4 House unlock.</p></div><button data-open-care-guide>OPEN</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">☁</div><div><h3>TALK</h3><p>Ask a flame creature for life advice.</p></div><button data-more-action="talk">TALK</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">💊</div><div><h3>MEDICINE</h3><p>${pet.sick ? "Rizo is sick. Medicine costs R 28." : "Rizo is not currently sick."}</p></div><button data-food="meds" ${!pet.sick || state.wallet.embers < 28 ? "disabled" : ""}>R 28</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">♥</div><div><h3>USE CARE PACKAGE</h3><p>Owned: ${state.inventory.care || 0}. Restores every need.</p></div><button data-use-boost="care" ${(state.inventory.care || 0) < 1 ? "disabled" : ""}>USE</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">⚗</div><div><h3>USE GROWTH JUICE</h3><p>Owned: ${state.inventory.growth || 0}. Adds 80 XP.</p></div><button data-use-boost="growth" ${(state.inventory.growth || 0) < 1 ? "disabled" : ""}>USE</button></article>`);
  }

  function openQuickSheet() {
    const pet = state.pet;
    openSheet("QUICK MENU", pet.stage === "egg" ? "MYSTERY EGG" : pet.name, `
      <article class="sheet-card"><div class="sheet-card-icon">✎</div><div><h3>RENAME</h3><p>Names are permanent until you change them again.</p></div><button data-open-rename ${pet.stage === "egg" ? "disabled" : ""}>EDIT</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">▤</div><div><h3>OPEN JOURNAL</h3><p>Stats, memories, collection, and save tools.</p></div><button data-open-journal>OPEN</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">↗</div><div><h3>SHARE RIZO</h3><p>Copy or share your current Rizo stats.</p></div><button data-share-rizo>SHARE</button></article>`);
  }

  function openKeeperSheet() {
    openSheet("KEEPER PROFILE", `KEEPER ${state.player.keeperId.slice(-4)}`, `
      <div class="sheet-note">This permanent ID is stored on this device. It is the hook a future account system can connect to without changing your pet save format.</div>
      <article class="sheet-card"><div class="sheet-card-icon">☂</div><div><h3>${state.player.streak} DAY STREAK</h3><p>${state.player.totalSessions} sessions since ${new Date(state.player.createdAt).toLocaleDateString()}.</p></div><button data-copy-keeper>COPY ID</button></article>
      <article class="sheet-card"><div class="sheet-card-icon">▤</div><div><h3>KEEPER JOURNAL</h3><p>Open your full record and save tools.</p></div><button data-open-journal>OPEN</button></article><article class="sheet-card"><div class="sheet-card-icon brand-sheet-icon"><img src="./assets/rizo-full-mark.png" alt=""></div><div><h3>RIZO APPAREL</h3><p>Shop real clothes from the brand behind the game.</p></div><a class="sheet-action-link" href="${escapeHTML(storeUrl())}" target="_blank" rel="noopener">SHOP ↗</a></article>`);
  }

  // A game mode may pass onClose: it runs only when the player closes the modal
  // (close button, Escape), never when another modal replaces it or the mode
  // closes it itself with { silent: true }.
  let modalCloseHandler = null;
  function showModal(html, { onClose = null } = {}) {
    modalCloseHandler = typeof onClose === "function" ? onClose : null;
    clearToasts();
    lastOverlayFocus = document.activeElement;
    el.modalOverlay.innerHTML = html;
    el.modalOverlay.classList.add("show");
    el.modalOverlay.setAttribute("aria-hidden", "false");
    syncUILock();
    requestAnimationFrame(() => el.modalOverlay.querySelector("button,input")?.focus({ preventScroll: true }));
  }

  function closeModal({ silent = false } = {}) {
    const onClose = modalCloseHandler;
    modalCloseHandler = null;
    if (worldEventOpen) {
      worldEventOpen = false;
      state.worldEvents.lastAt = now();
      saveState();
    }
    if (activeMusicOverride && !mini.active && !globalThis.RizoModes?.active?.()) {
      activeMusicOverride = null;
      syncMusic(true);
    }
    el.modalOverlay.classList.remove("show");
    el.modalOverlay.setAttribute("aria-hidden", "true");
    syncUILock();
    if (lastOverlayFocus?.isConnected) lastOverlayFocus.focus({ preventScroll: true });
    setTimeout(() => {
      if (!el.modalOverlay.classList.contains("show")) {
        el.modalOverlay.innerHTML = "";
        flushPendingEvolution();
      }
    }, 220);
    if (!silent && onClose) { try { onClose(); } catch (error) { console.warn("Rizo modal close handler failed", error); } }
  }

  function showNameModal(force = false) {
    if (state.pet.stage === "egg") return;
    showModal(`<div class="modal-card rename-card"><div class="rename-pet-stage">${petMarkup({extraClass:"rename-pet",id:"renamePet"})}</div><h2>NAME YOUR RIZO</h2><p>The forest did not include paperwork.</p><div class="input-row"><input id="modalNameInput" maxlength="14" value="${escapeHTML(state.pet.name)}" autocomplete="off"><button data-save-name>SAVE</button></div>${force ? "" : '<button class="wide-button" data-close-modal>NOT NOW</button>'}</div>`);
    setTimeout(() => $("#modalNameInput")?.focus(), 80);
  }

  function showKeeperBasics(markSeen = true) {
    if (markSeen) {
      state.player.keeperGuideSeen = true;
      saveState(true);
    }
    showModal(`<div class="modal-card keeper-guide-modal"><small>KEEPER BASICS</small><h2>RIZO KEEPS LIVING WHEN YOU LEAVE.</h2><p>Needs fall in real time, even with the app closed. The first twelve hours are forgiving. After that, neglect has consequences.</p><div class="keeper-guide-grid"><article><span>🍗</span><b>FULL</b><p>Feed Rizo. Below 12, health starts falling.</p></article><article><span>⚡</span><b>ENERGY</b><p>Sleep restores energy. Exhausted Rizos cannot play.</p></article><article><span>✦</span><b>CLEAN</b><p>Below 22 clean can cause sickness. Sickness drains health.</p></article><article><span>♥</span><b>HAPPY</b><p>Play and interact. Low needs stop passive growth.</p></article></div><div class="keeper-warning"><b>HEALTH AT ZERO</b><span>Rizo enters recovery. You do not lose the pet, but recovery takes time and care.</span></div><div class="modal-buttons"><button data-close-modal>LET ME LOOK AROUND</button><button class="primary" data-start-feeding>FEED RIZO NOW</button></div></div>`);
  }

  function showOfflineSummary(summary) {
    if (!summary || !state.pet.alive || state.pet.stage === "egg") return;
    const time = summary.minutes >= 60 ? `${(summary.minutes / 60).toFixed(summary.minutes >= 600 ? 0 : 1)} HOURS` : `${Math.floor(summary.minutes)} MINUTES`;
    showModal(`<div class="modal-card"><div class="modal-art">☾</div><h2>WELCOME BACK</h2><p class="big-line">${escapeHTML(state.pet.name)} survived ${time} without supervision.</p><p>Full -${Math.floor(summary.hunger)} • Happy -${Math.floor(summary.mood)} • Clean -${Math.floor(summary.hygiene)}${summary.health > 0 ? ` • Health -${Math.floor(summary.health)}` : ""}${summary.idleGrowth > .1 ? ` • +${summary.idleGrowth.toFixed(1)} ${escapeHTML(state.pet.lastTrainedSkill || "stamina")} growth` : ""}</p><div class="modal-buttons"><button class="primary" data-close-modal>CHECK ON RIZO</button></div></div>`);
  }

  function showDailyGift() {
    if (state.daily.giftClaimed) {
      toast(`DAY ${state.player.streak} GIFT ALREADY CLAIMED`);
      return;
    }
    const reward = 35 + Math.min(65, state.player.streak * 5);
    mutate((pet, whole) => {
      whole.daily.giftClaimed = true;
      whole.wallet.embers += reward;
      pet.mood = clamp(pet.mood + 8);
    });
    addMemory("DAILY GIFT", `Day ${state.player.streak}: the app rewarded basic consistency with R ${reward}.`, "✦");
    showModal(`<div class="modal-card"><div class="modal-art">✦</div><h2>DAY ${state.player.streak}</h2><p class="big-line">YOU SHOWED UP. RIZO NOTICED.</p><p>Daily gift: R ${reward} and +8 happy.</p><div class="modal-buttons"><button class="primary" data-close-modal>TAKE IT</button></div></div>`);
    celebrate();
  }

  function claimQuest() {
    if (state.daily.claimed) { toast("DAILY MISCHIEF ALREADY CLAIMED"); return; }
    if (state.daily.progress < state.daily.target) {
      const remaining = state.daily.target - state.daily.progress;
      toast(`${remaining} MORE TO UNLOCK TODAY'S REWARD`);
      return;
    }
    mutate((pet, whole) => {
      whole.daily.claimed = true;
      whole.wallet.embers += whole.daily.reward;
      pet.xp += 12;
      pet.mood = clamp(pet.mood + 7);
    });
    toast(`DAILY COMPLETE • +R ${state.daily.reward}`);
    addMemory("DAILY MISCHIEF", `Completed: ${state.daily.title}.`, "!");
    celebrate();
  }

  function progressQuest(type, amount = 1) {
    if (state.daily.type !== type || state.daily.claimed) return;
    state.daily.progress = Math.min(state.daily.target, state.daily.progress + amount);
    if (state.daily.progress >= state.daily.target) toast("DAILY MISCHIEF READY TO CLAIM");
  }

  function useFood(id) {
    const food = FOODS.find(item => item.id === id);
    if (!food || state.pet.stage === "egg" || !state.pet.alive) return false;
    if (!canCare()) return false;
    const cooldownLeft = food.cooldown ? Math.max(0, food.cooldown - (now() - (state.pet.lastFreeSnack || 0))) : 0;
    if (cooldownLeft > 0) { toast("THE CRUMBS ARE STILL REGENERATING"); return false; }
    if (state.wallet.embers < food.cost) { toast("YOUR WALLET SAID NO"); return false; }
    const wasSick = Boolean(state.pet.sick);
    const previousServings = Number(state.pet.careProfile?.foods?.[food.id]) || 0;
    mutate((pet, whole) => {
      whole.wallet.embers -= food.cost;
      pet.hunger = clamp(pet.hunger + (food.hunger || 0));
      pet.mood = clamp(pet.mood + (food.mood || 0));
      pet.hygiene = clamp(pet.hygiene + (food.hygiene || 0));
      pet.health = clamp(pet.health + (food.health || 0));
      pet.xp += food.xp || 0;
      pet.bond = clamp(pet.bond + 1.2);
      const trait = FOOD_TRAITS[food.id] || { alignment: 0 };
      shiftAlignment(trait.alignment || 0, `food:${food.id}`);
      if (trait.skill) gainSkill(trait.skill, trait.amount || .2, { silent: true });
      pet.careProfile.foods[food.id] = (pet.careProfile.foods[food.id] || 0) + 1;
      const memory = lifeMemory();
      memory.lastFoodAt = now();
      memory.lastFoodId = food.id;
      const favoriteFood = Object.entries(pet.careProfile.foods).sort((a,b) => b[1] - a[1])[0]?.[0];
      if (pet.careProfile.foods[food.id] === 3 && favoriteFood === food.id && !memory.favoriteFoodRemembered) {
        memory.favoriteFoodRemembered = true;
        addMemory("THAT FOOD AGAIN", `${pet.name} smelled ${food.name} before you opened it.`, "●");
      }
      if (food.cure) pet.sick = false;
      if (food.calm) pet.overstimulation = 0;
      if (food.cooldown) pet.lastFreeSnack = now();
      whole.meta.totalCareActions += 1;
      earnHeat(5,false);
      progressQuest("feed");
    });
    closeSheet();
    const favoriteRepeat = previousServings >= 2 && state.pet.careProfile.foods[food.id] >= previousServings + 1;
    if (wasSick && food.cure) setLifeBehavior("recover", 1500);
    else if (favoriteRepeat) setLifeBehavior("snack-happy", 950);
    say(wasSick && food.cure ? "I AM BACK. DO NOT MAKE THIS A THING." : food.id === "crumbs" ? "I CAN TASTE THE POCKET." : food.id === "wings" ? "HOT. WORTH IT." : food.id === "meds" ? "I CAN HEAR COLORS NOW." : "FINALLY.");
    effect("hearts");
    sfx("eat");
    sensoryBurst("♥", currentVariant().color, 9);
    haptic(20);
    advanceTutorial("feed");
    return true;
  }

  const CLEAN_REWARD_COOLDOWN = 5 * 60 * 1000;
  const CLEAN_REWARD_MIN_RESTORE = 5;
  const CLEAN_ACTION_MIN_RESTORE = 2;

  function cleanPet() {
    if (!canCare()) return;
    if (100 - state.pet.hygiene < CLEAN_ACTION_MIN_RESTORE) { toast("RIZO IS ALREADY CLEAN"); return; }
    const hygieneBefore = state.pet.hygiene;
    const wasFilthy = hygieneBefore < 18;
    const washUntil = now() + 900;
    const cooldownReady = now() - (Number(state.pet.lastCleanRewardAt) || 0) >= CLEAN_REWARD_COOLDOWN;
    mutate((pet, whole) => {
      const restored = Math.min(40, 100 - pet.hygiene);
      pet.hygiene = clamp(pet.hygiene + 40);
      pet.energy = clamp(pet.energy - 3);
      if (cooldownReady && restored >= CLEAN_REWARD_MIN_RESTORE) {
        pet.mood = clamp(pet.mood + 4);
        pet.xp += 6;
        pet.bond = clamp(pet.bond + 1.5);
        shiftAlignment(2, "clean");
        gainSkill("stamina", .35, { silent: true });
        whole.meta.totalCareActions += 1;
        earnHeat(5, false);
        pet.lastCleanRewardAt = now();
      } else {
        pet.mood = clamp(pet.mood + 1);
      }
      if (pet.hygiene > 70 && Math.random() < .55) pet.sick = false;
      const memory = lifeMemory();
      memory.washFromHygiene = hygieneBefore;
      memory.washUntil = washUntil;
      memory.lastBathAt = now();
      if (wasFilthy && !memory.bathIncidentRemembered) {
        memory.filthSeen = true;
        memory.bathIncidentRemembered = true;
        addMemory("BATH INCIDENT", "The towel is not white anymore.", "✦");
      }
      progressQuest("clean");
    });
    effect("sparkles");
    setLifeBehavior("scrub", 900, "YOU MISSED A SPOT. GOOD.");
    setTimeout(() => {
      const memory = lifeMemory();
      if (memory.washUntil !== washUntil || now() < washUntil) return;
      memory.washUntil = 0;
      memory.washFromHygiene = state.pet.hygiene;
      saveState();
      setLifeBehavior("shake", 720, wasFilthy ? "THE ROOM CAN BREATHE AGAIN." : "");
      if (currentView === "home") renderHome();
      setTimeout(() => {
        const latest = lifeMemory();
        if (currentView === "home" && now() - (Number(latest.lastBathAt) || 0) >= 7000) renderHome();
      }, 6200);
    }, 920);
    sfx("clean");
    sensoryBurst("✦", "#ffffff", 12);
    haptic([18, 35, 18]);
  }

  function headPat() {
    if (!canCare()) return;
    mutate((pet, whole) => {
      pet.mood = clamp(pet.mood + 7);
      pet.bond = clamp(pet.bond + 2);
      pet.xp += 2;
      shiftAlignment(3, "head-pat");
      gainSkill("luck", .2, { silent: true });
      whole.meta.totalCareActions += 1;
      earnHeat(3,false);
    });
    closeSheet();
    effect("hearts");
    say("OKAY. ONE MORE.");
  }

  function toggleSleep() {
    const pet = state.pet;
    if (pet.stage === "egg" || !pet.alive) return;
    mutate(p => {
      p.sleeping = !p.sleeping;
      if (p.sleeping) { p.mood = clamp(p.mood + 2); shiftAlignment(1, "rest"); gainSkill("stamina", .25, { silent: true }); }
    });
    if (state.pet.sleeping) say("DO NOT LET THE APP DIE WHILE I'M OUT.");
    else setLifeBehavior("wake-grump", 1200, "I WAS DREAMING ABOUT INVENTORY.");
    sfx(state.pet.sleeping ? "sleep" : "wake");
  }

  function talkToPet() {
    if (!canCare()) return;
    const pet = state.pet;
    let line;
    if (pet.sick) line = "I FEEL LIKE A LOW-BUDGET SEQUEL.";
    else if (pet.hunger < 20) line = "I AM STARVING IN 4K.";
    else if (pet.energy < 20) line = "MY LAST TWO BRAIN CELLS CLOCKED OUT.";
    else if (pet.hygiene < 20) line = "THE SMELL IS PART OF THE BRAND NOW.";
    else if (pet.mood < 20) line = "I'M NOT MAD. I'M DEVELOPING LORE.";
    else line = TALK_LINES[Math.floor(Math.random() * TALK_LINES.length)];
    mutate(p => { p.mood = clamp(p.mood + 3); p.bond = clamp(p.bond + .8); p.xp += 1; shiftAlignment(1, "talk"); gainSkill("instinct", .15, { silent: true }); });
    closeSheet();
    say(line, 3400);
    sfx("talk");
  }

  function canCare() {
    const pet = state.pet;
    if (pet.stage === "egg") { toast("HATCH THE EGG FIRST"); return false; }
    if (!pet.alive) return false;
    if (pet.resting) { showRecoveryModal(); return false; }
    if (pet.sleeping) { toast("RIZO IS ASLEEP • WAKE THEM IN THE DEN"); sfx("no"); return false; }
    return true;
  }

  function tapPet(event) {
    const pet = state.pet;
    if (!pet.alive) return;
    if (pet.stage === "egg") {
      mutate(p => {
        p.hatch = clamp(p.hatch + 11);
        p.energy = 100;
        earnHeat(2, false);
        if (p.hatch >= 100) hatchPet();
      });
      floatText(event, "+WARM");
      sfx("egg");
      sensoryBurst("•", currentVariant().color, 5, event);
      haptic(12);
      return;
    }
    if (pet.sleeping) { say("I AM LITERALLY ASLEEP."); sfx("no"); return; }

    const time = now();
    tapHistory = tapHistory.filter(t => time - t < 2400);
    tapHistory.push(time);
    const ultraFast = tapHistory.filter(t => time - t < 700).length;
    const sustained = tapHistory.length;

    if (time < refuseUntil) {
      animatePet("head-no", 620);
      sfx("no");
      return;
    }

    if (ultraFast >= 9 && Math.random() < .34) {
      refuseUntil = time + 1050;
      state.meta.refusals += 1;
      pet.mood = clamp(pet.mood - 1.5);
      shiftAlignment(-1, "ignored-boundary");
      animatePet("head-no", 650);
      const lines = ["NOPE.","TOO MUCH FINGER.","PERSONAL SPACE, KEEPER.","I SAID TAP. NOT JACKHAMMER.","ABSOLUTELY NOT."];
      say(lines[Math.floor(Math.random()*lines.length)], 1700);
      sfx("no"); haptic([20,30,20]); saveState(); renderAll();
      return;
    }

    if (sustained >= 19 && time > overloadCooldownUntil && Math.random() < .24) {
      overloadCooldownUntil = time + 20000;
      state.meta.overloads += 1;
      mutate(p => {
        p.sick = true;
        p.overstimulation = (p.overstimulation || 0) + 1;
        p.health = clamp(p.health - 5);
        p.mood = clamp(p.mood - 9);
        p.energy = clamp(p.energy - 8);
        shiftAlignment(-4, "overstimulated");
      });
      animatePet("tap-sick-queasy", 1650);
      effect("queasy");
      document.querySelector(".habitat-card")?.classList.add("screen-shake");
      setTimeout(()=>document.querySelector(".habitat-card")?.classList.remove("screen-shake"),420);
      say("BLURGH—YOU TAPPED THE FLAME OUT OF ME.", 3000);
      toast("RIZO GOT TAP-SICK • USE MEDICINE OR CALMING FIZZ");
      sfx("sick"); haptic([45,35,45]);
      sensoryBurst("⌁", "#d8ff78", 10, event);
      setTimeout(() => sensoryBurst("×", "#9eff75", 8, event), 160);
      return;
    }

    combo = time - lastTapAt < 620 ? Math.min(99, combo + 1) : 1;
    lastTapAt = time;
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { combo = 0; el.tapCombo.classList.remove("show"); }, 900);
    const multiplier = 1 + Math.floor(combo / 12);
    const jackpot = Math.random() < Math.min(.035, .006 + combo / 4000);
    const gain = jackpot ? multiplier * 12 : multiplier;
    mutate((p, whole) => {
      p.taps += 1;
      p.hype += gain;
      p.xp += .35 * multiplier;
      p.bond = clamp(p.bond + .08 * multiplier);
      p.mood = clamp(p.mood + .13 * multiplier);
      p.energy = clamp(p.energy - .025);
      whole.wallet.embers += gain;
      whole.meta.totalTaps += 1;
      progressQuest("tap");
      earnHeat(jackpot ? 5 : 1, false);
    });
    animatePet(jackpot ? "happy-jump" : "boing", jackpot ? 520 : 240);
    el.tapCombo.textContent = jackpot ? `JACKPOT x${combo}` : `x${combo} HYPE`;
    el.tapCombo.classList.toggle("show", combo > 1 || jackpot);
    floatText(event, jackpot ? `JACKPOT +R ${gain}` : `+R ${gain}`);
    sfx(jackpot ? "jackpot" : "tap", combo);
    sensoryBurst(jackpot ? "✦" : "+", jackpot ? "#ffd54a" : currentVariant().color, jackpot ? 18 : 3, event);
    haptic(jackpot ? [20,25,45] : 7);
    if (combo === 20) say("OKAY OKAY I GET IT.");
    else if (combo === 40) say("THIS IS BECOMING A LABOR ISSUE.");
    else if (state.meta.totalTaps % 75 === 0) say(TALK_LINES[Math.floor(Math.random() * TALK_LINES.length)]);
  }

  function hatchPet() {
    const pet = state.pet;
    if (pet.stage !== "egg") return;
    pet.stage = "spark";
    pet.variant = pet.hiddenVariant;
    pet.bornAt = now();
    pet.lastTick = now();
    pet.graceUntil = now() + 12 * 60 * 60 * 1000;
    pet.xp = 5;
    pet.bond = 5;
    pet.form = determineEvolutionForm(pet);
    state.meta.totalHatched += 1;
    state.collection[pet.variant] = (state.collection[pet.variant] || 0) + 1;
    state.meta.pity = ["golden","diamond","obsidian"].includes(pet.variant) ? 0 : (state.meta.pity || 0) + 1;
    unlockRandomLore(currentVariant().rarity === "SECRET" ? 1 : .35);
    earnHeat(currentVariant().rarity === "SECRET" ? 120 : currentVariant().rarity === "LEGENDARY" ? 70 : 30, false);
    const variant = currentVariant();
    if (variant.id === "golden") state.wallet.embers += 250;
    addMemory("HATCHED", `${pet.name} hatched as Generation ${pet.generation || 1} ${variant.name}. Its genes already favor ${dominantGene(pet).toUpperCase()}.`, "🥚");
    toast(`${variant.rarity}: ${variant.name}`);
    say(pet.shame ? "I KNOW THIS WAS THE FREE EGG." : `I'M ${variant.name}. TRY NOT TO RUIN THIS.`, 4200);
    state.player.tutorialStep = Math.max(state.player.tutorialStep, 1);
    celebrate();
    sfx(variant.rarity === "SECRET" ? "secret" : variant.rarity === "LEGENDARY" ? "legendary" : "hatch");
    sensoryBurst("✦", variant.color, variant.rarity === "SECRET" ? 35 : 20);
    haptic([45, 50, 85]);
    saveState(true);
    setTimeout(() => showNameModal(true), 1500);
  }

  function renamePet(name) {
    const clean = name.trim().replace(/[<>]/g, "").slice(0, 14).toUpperCase();
    if (!clean) { toast("RIZO NEEDS AT LEAST ONE LETTER"); return false; }
    const old = state.pet.name;
    state.pet.name = clean;
    if (old !== clean) addMemory("NEW NAME", `${old} became ${clean}. The paperwork was devastating.`, "✎");
    const shouldShowGuide = state.player.tutorialStep === 1 && !state.player.keeperGuideSeen;
    if (state.player.tutorialStep === 1) state.player.tutorialStep = 2;
    if (shouldShowGuide) state.player.keeperGuideSeen = true;
    saveState();
    renderAll();
    toast("NAME SAVED");
    if (shouldShowGuide) setTimeout(() => showKeeperBasics(false), 360);
    return true;
  }

  function buyAccessory(id) {
    const item = ACCESSORIES.find(entry => entry.id === id);
    if (!item) return;
    const owned = state.inventory.accessories.includes(id);
    const isNewUnlock = !owned;
    if (!owned && item.earned) { toast("THAT ONE IS EARNED, NOT SOLD"); return; }
    if (!owned) {
      if (state.wallet.embers < item.cost) { toast("YOUR WALLET SAID NO"); return; }
      state.wallet.embers -= item.cost;
      state.inventory.accessories.push(id);
      toast(`${item.name} UNLOCKED`);
    }
    state.pet.accessory = id;
    saveState();
    renderAll();
    playAccessoryReveal(item, isNewUnlock);
    accessoryMaterialSound(id);
    el.habitatScene?.classList.add("camera-reward"); setTimeout(()=>el.habitatScene?.classList.remove("camera-reward"),800);
  }

  // Rarer gear gets a bigger, longer, more colorful reveal so unlocking a
  // legendary item actually feels different from equipping a common one.
  function playAccessoryReveal(item, isNewUnlock) {
    if (item.id === "none") { effect("sparkles"); return; }
    const rarityBurst = { common: 8, rare: 14, epic: 20, legendary: 32 };
    const rarityHaptic = { common: 10, rare: [10, 15], epic: [10, 15, 20], legendary: [12, 18, 12, 24] };
    const color = ACCESSORY_RARITY_COLORS[item.rarity] || "#16c8ff";
    const count = (rarityBurst[item.rarity] || 8) * (isNewUnlock ? 1.4 : 1);
    sensoryBurst(item.rarity === "legendary" ? "★" : "✦", color, Math.round(count));
    haptic(rarityHaptic[item.rarity] || 10);
    sfx(item.rarity === "legendary" ? "reward" : "hit", isNewUnlock ? 12 : 4);
    if (el.accessoryLayer) {
      el.accessoryLayer.classList.remove("accessory-reveal");
      void el.accessoryLayer.offsetWidth;
      el.accessoryLayer.classList.add("accessory-reveal");
      setTimeout(() => el.accessoryLayer?.classList.remove("accessory-reveal"), 900);
    }
    effect("sparkles");
  }

  function buyRoom(id) {
    const item = ROOMS.find(entry => entry.id === id);
    if (!item) return;
    const owned = state.inventory.rooms.includes(id);
    if (!owned) {
      if (state.wallet.embers < item.cost) { toast("YOUR WALLET SAID NO"); return; }
      state.wallet.embers -= item.cost;
      state.inventory.rooms.push(id);
      toast(`${item.name} UNLOCKED`);
    }
    state.pet.room = id;
    saveState();
    renderAll();
  }

  function buyBoost(id) {
    const item = BOOSTS.find(entry => entry.id === id && !entry.futureAd);
    if (!item || state.wallet.embers < item.cost) { toast("NOT ENOUGH EMBERS"); return; }
    state.wallet.embers -= item.cost;
    state.inventory[id] = (state.inventory[id] || 0) + 1;
    saveState();
    renderAll();
    toast(`${item.name} ADDED`);
  }

  function useBoost(id) {
    if ((state.inventory[id] || 0) < 1 || state.pet.stage === "egg") return;
    mutate((pet, whole) => {
      whole.inventory[id] -= 1;
      if (id === "care") {
        pet.health = clamp(pet.health + 15);
        pet.hunger = clamp(pet.hunger + 30);
        pet.mood = clamp(pet.mood + 30);
        pet.energy = clamp(pet.energy + 30);
        pet.hygiene = clamp(pet.hygiene + 30);
        pet.sick = false;
      }
      if (id === "growth") pet.xp += 80;
    });
    closeSheet();
    effect("sparkles");
    say(id === "care" ? "I FEEL EXPENSIVELY CARED FOR." : "I CAN FEEL MY LORE EXPANDING.");
  }



  function gardenCodePayload() {
    const pet = state.pet;
    return {
      v: 2,
      keeper: state.player.keeperId,
      pet: {
        name: pet.stage === "egg" ? "MYSTERY EGG" : pet.name,
        variant: pet.variant || pet.hiddenVariant || "classic",
        stage: pet.stage === "egg" ? "spark" : pet.stage,
        form: pet.form || "balanced",
        generation: pet.generation || 1,
        personality: pet.personality || "LOYAL WEIRDO",
        mutation: pet.mutation || "normal",
        alignment: pet.alignment || 0,
        bond: pet.bond || 0,
        genes: Object.fromEntries(SKILLS.map(skill => [skill.id, Math.round(pet.genes?.[skill.id] || 100)]).concat([["growth", Math.round(pet.genes?.growth || 100)]])),
        skills: Object.fromEntries(SKILLS.map(skill => [skill.id, Math.round(pet.skills?.[skill.id] || 0)]))
      }
    };
  }

  function encodeGardenCode(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }

  function decodeGardenCode(code) {
    const cleaned = String(code || "").trim().replace(/-/g,"+").replace(/_/g,"/");
    const padded = cleaned + "=".repeat((4 - cleaned.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function copyGardenCode() {
    if (state.pet.stage === "egg") { toast("HATCH YOUR RIZO BEFORE SHARING A GARDEN"); return; }
    const code = encodeGardenCode(gardenCodePayload());
    try { await navigator.clipboard.writeText(code); toast("GARDEN CODE COPIED"); }
    catch (error) { showModal(`<div class="modal-card"><div class="modal-art">⌁</div><h2>YOUR GARDEN CODE</h2><p>Copy this and send it to another Keeper.</p><textarea class="visit-code-output" readonly>${escapeHTML(code)}</textarea><div class="modal-buttons"><button data-close-modal class="primary">DONE</button></div></div>`); }
  }

  function openVisitSheet() {
    openSheet("KEEPER NETWORK", "VISIT A GARDEN", `<section class="visit-sheet"><div class="visit-art">⌁</div><p>Paste a Garden Code from another player. Their Rizo appears in your Den for ten minutes and leaves a small friendship reward once per day.</p><textarea id="visitCodeInput" maxlength="1600" placeholder="PASTE GARDEN CODE"></textarea><button class="wide-button" data-confirm-visit type="button">OPEN THE GARDEN GATE</button><div class="sheet-note">Codes contain only a pet snapshot and anonymous Keeper ID. They cannot overwrite your save.</div></section>`);
  }

  function showVisitorArrival(visitor) {
    const variant=VARIANTS.find(item=>item.id===visitor.variant)||VARIANTS[0];
    activeMusicOverride="visitor";
    startMusicForScene("visitor",true);
    showModal(`<div class="modal-card visitor-arrival"><small>GARDEN SIGNAL CONNECTED</small><div class="visitor-arrival-stage">${petMarkup({extraClass:"arrival-host",id:"arrivalHost"})}${petMarkup({pet:visitor,overrides:{sleeping:false,sick:false,resting:false,low:false,behavior:""},extraClass:"arrival-visitor",id:"arrivalVisitor",label:`${visitor.name} the visiting Rizo`})}<i>♡</i></div><h2>${escapeHTML(visitor.name)} ARRIVED</h2><p>${escapeHTML(visitor.variantName)} • GEN ${visitor.generation}. Visitors stay for ten minutes and never overwrite your pet.</p><div class="modal-buttons"><button class="primary" data-close-modal>WELCOME THEM</button></div></div>`);
    duckMusic(1000,.15); sfx("spark");
  }

  function acceptGardenVisit(rawCode) {
    try {
      const data = decodeGardenCode(rawCode);
      if (![1,2].includes(data?.v) || !data.keeper || !data.pet || !VARIANTS.some(item => item.id === data.pet.variant)) throw new Error("bad code");
      if (data.keeper === state.player.keeperId) { toast("THAT IS YOUR OWN GARDEN CODE"); return; }
      const safeName = String(data.pet.name || "GUEST RIZO").replace(/[<>\u0000-\u001F\u007F]/g,"").slice(0,14).toUpperCase() || "GUEST RIZO";
      const safeStage = STAGES.some(item => item.id === data.pet.stage) ? data.pet.stage : "kid";
      const variant = VARIANTS.find(item => item.id === data.pet.variant) || VARIANTS[0];
      const visitorGenes = {}, visitorSkills = {};
      for (const skill of SKILLS) {
        visitorGenes[skill.id] = clamp(Number(data.pet.genes?.[skill.id]) || 100, 82, 170);
        visitorSkills[skill.id] = clamp(Number(data.pet.skills?.[skill.id]) || 0, 0, visitorGenes[skill.id]);
      }
      visitorGenes.growth = clamp(Number(data.pet.genes?.growth) || 100, 85, 140);
      const visitor = { keeper:String(data.keeper).slice(0,80), name:safeName, variant:variant.id, variantName:variant.name, stage:safeStage, form:EVOLUTION_FORMS[data.pet.form]?data.pet.form:"balanced", accessory:ACCESSORIES.some(item=>item.id===data.pet.accessory)?data.pet.accessory:"none", generation:clamp(Number(data.pet.generation)||1,1,999), personality:PERSONALITIES.includes(data.pet.personality)?data.pet.personality:"LOYAL WEIRDO", mutation:MUTATIONS.some(item=>item.id===data.pet.mutation)?data.pet.mutation:"normal", alignment:clamp(Number(data.pet.alignment)||0,-100,100), bond:clamp(Number(data.pet.bond)||0), genes:visitorGenes, skills:visitorSkills, at:now(), expiresAt:now()+10*60000 };
      state.social.currentVisitor = visitor;
      state.social.visitors = [visitor, ...state.social.visitors.filter(item => item.keeper !== visitor.keeper)].slice(0,20);
      const today = dateKey();
      if (state.social.lastVisitRewardDate !== today) {
        state.social.lastVisitRewardDate = today;
        state.wallet.embers += 35;
        state.pet.bond = clamp(state.pet.bond + 3);
        gainSkill("luck", .8, {silent:true});
        addMemory("GARDEN VISITOR", `${visitor.name} visited from another Keeper's garden.`, "⌁");
        toast("FIRST VISIT TODAY • +R 35 • +BOND");
      } else toast(`${visitor.name} IS VISITING`);
      saveState(true); closeSheet(); changeView("home"); renderAll(); say("WAIT. WHO INVITED THEM?",3000); showVisitorArrival(visitor);
    } catch (error) { toast("THAT GARDEN CODE COULD NOT OPEN"); }
  }

  function activeGardenVisitor() {
    const visitor = state.social?.currentVisitor;
    return visitor && Number(visitor.expiresAt) > now() ? visitor : null;
  }

  function canSaveBondSeed() {
    const visitor = activeGardenVisitor();
    const stageIndex = STAGES.findIndex(item => item.id === state.pet.stage);
    if (!visitor) return {ok:false,reason:"INVITE A VISITOR FIRST"};
    if (state.pet.stage === "egg" || stageIndex < 2) return {ok:false,reason:"YOUR RIZO MUST REACH TEEN"};
    if (state.pet.bond < 30) return {ok:false,reason:`${Math.ceil(30-state.pet.bond)} MORE BOND NEEDED`};
    if (state.garden.lastPairKeeper === visitor.keeper) return {ok:false,reason:"THIS VISITOR ALREADY LEFT A SPARK"};
    return {ok:true,visitor};
  }

  function saveBondSeed() {
    const result = canSaveBondSeed();
    if (!result.ok) { toast(result.reason); return; }
    const visitor = result.visitor;
    state.garden.bondSeed = {keeper:visitor.keeper,name:visitor.name,variant:visitor.variant,variantName:visitor.variantName,personality:visitor.personality,mutation:visitor.mutation,alignment:visitor.alignment,genes:{...visitor.genes},skills:{...visitor.skills},generation:visitor.generation,at:now()};
    state.garden.lastPairKeeper = visitor.keeper;
    state.social.pairings = [{keeper:visitor.keeper,name:visitor.name,variant:visitor.variant,at:now()},...(state.social.pairings||[]).filter(item=>item.keeper!==visitor.keeper)].slice(0,30);
    state.pet.bond = clamp(state.pet.bond + 4);
    state.pet.mood = clamp(state.pet.mood + 8);
    addMemory("FRIENDSHIP SPARK", `${state.pet.name} and ${visitor.name} left a genetic spark for the next Legacy Egg.`, "♡");
    saveState(true); renderAll(); toast("BOND EGG DNA SAVED"); say("THAT FELT WEIRDLY IMPORTANT.",3200); sfx("secret"); effect("hearts");
  }

  function clearBondSeed() {
    if (!state.garden.bondSeed) { toast("NO BOND EGG DNA IS STORED"); return; }
    state.garden.bondSeed = null;
    saveState(true); renderAll(); toast("BOND EGG DNA CLEARED");
  }

  function setNextEggResonance(id) {
    if (!VARIANTS.some(item => item.id === id) || !state.collection[id]) { toast("DISCOVER THAT RIZO FIRST"); return; }
    state.garden.nextEggVariant = state.garden.nextEggVariant === id ? null : id;
    saveState(true); renderJournalCollection();
    toast(state.garden.nextEggVariant ? `${VARIANTS.find(item=>item.id===id).name} WILL SHAPE THE NEXT LEGACY EGG` : "EGG RESONANCE CLEARED");
  }

  function careInfluenceSummary(pet = state.pet) {
    const topFood = Object.entries(pet.careProfile?.foods || {}).sort((a,b)=>b[1]-a[1])[0];
    const topGame = Object.entries(pet.careProfile?.games || {}).sort((a,b)=>b[1]-a[1])[0];
    return {
      foodName:FOODS.find(item=>item.id===topFood?.[0])?.name || "NO FAVORITE FOOD YET",
      gameName:({power:"POWER TAPE",spark:"SPARK STASH",forage:"FOREST LUNCH",rush:"RIZO COURIER",walk:"RAIN WALK",rhythm:"EMBER BEAT",memory:"LOST SIGNAL",glide:"SKYBOUND",breaker:"EMBER FORGE",maze:"RIZO RUNAWAY"})[topGame?.[0]] || globalThis.RizoModes?.get?.(topGame?.[0])?.name || "NO FAVORITE GAME YET",
      favoriteToy:(state.garden.favoriteToy || "NONE").toUpperCase()
    };
  }

  function openGrowthSheet() {
    const pet = state.pet;
    if (pet.stage === "egg") { toast("HATCH TO REVEAL GENETICS"); return; }
    const align = alignmentInfo(pet);
    const form = displayFormInfo(pet);
    const influence = careInfluenceSummary(pet);
    const seed = state.garden.bondSeed;
    openSheet("RAISING PATH", "AGE + AFFINITY", `<section class="growth-sheet"><div class="growth-sheet-hero"><span style="--align:${align.color}">${align.icon}</span><div><small>${align.name} ALIGNMENT • GENERATION ${pet.generation || 1}</small><h3>${form.name}</h3><p>${form.copy}</p></div></div><div class="aptitude-list">${SKILLS.map(skill=>aptitudeHTML(skill,pet)).join("")}</div><div class="raising-influences"><span><b>FAVORITE FOOD</b>${escapeHTML(influence.foodName)}</span><span><b>FAVORITE GAME</b>${escapeHTML(influence.gameName)}</span><span><b>FAVORITE TOY</b>${escapeHTML(influence.favoriteToy)}</span><span><b>PERSONALITY</b>${escapeHTML(pet.personality)}</span></div><div class="sheet-note">CARE SHAPES THE RESULT. Power Tap raises Power. Rizo Rush raises Speed. Spark Catch and Forage raise Instinct. Walks and rest raise Stamina. Treasure raises Luck.</div>${seed?`<div class="bond-seed-mini"><b>♡ BOND EGG STORED</b><span>${escapeHTML(seed.name)} • ${escapeHTML(seed.variantName || seed.variant)}</span><small>The next Legacy Egg blends both families' bounded genetic caps.</small></div>`:""}<button class="wide-button" data-rebirth-info>${canRebirth()?"CREATE LEGACY EGG":"VIEW REBIRTH PATH"}</button></section>`);
  }

  function useGardenToy(id) {
    if (!canCare()) return;
    const cooldown = 12000;
    if (now() - (state.garden.lastToyAt || 0) < cooldown) { toast("RIZO IS STILL PLAYING"); return; }
    const toys = {
      ball: { skill:"speed", gain:1.1, mood:7, energy:-4, align:0, behavior:"ball", line:"I CALL NEXT GOAL." },
      stump: { skill:"power", gain:1.0, mood:3, energy:-6, align:-1, behavior:"stretch", line:"THIS STUMP KNOWS WHAT IT DID." },
      puddle: { skill:"stamina", gain:.8, mood:6, energy:-3, hygiene:-8, align:1, behavior:"zoomies", line:"I REGRET NOTHING." },
      bush: { skill:"instinct", gain:.9, mood:5, hunger:5, align:2, behavior:"window", line:"THE BUSH HAD LORE." }
    };
    const toy = toys[id]; if (!toy) return;
    mutate((pet, whole)=>{
      gainSkill(toy.skill,toy.gain,{silent:true});
      pet.mood=clamp(pet.mood+(toy.mood||0)); pet.energy=clamp(pet.energy+(toy.energy||0)); pet.hygiene=clamp(pet.hygiene+(toy.hygiene||0)); pet.hunger=clamp(pet.hunger+(toy.hunger||0)); pet.xp+=4; pet.bond=clamp(pet.bond+1.2); shiftAlignment(toy.align||0,`toy:${id}`);
      whole.garden.lastToyAt=now(); whole.garden.toyUses[id]=(whole.garden.toyUses[id]||0)+1; whole.garden.favoriteToy=Object.entries(whole.garden.toyUses).sort((a,b)=>b[1]-a[1])[0]?.[0]||id;
    });
    activePetBehavior=toy.behavior; renderHome(); setTimeout(()=>{activePetBehavior=null;if(currentView==="home")renderHome();},1800);
    say(toy.line,2200); sfx(id==="puddle"?"sick":"spark"); sensoryBurst(id==="puddle"?"💧":"✦",currentVariant().color,8);
  }

  // ===== AUTONOMOUS PET LIFE + RANDOM STORY EVENTS =====
  function schedulePetBehavior(delay = 8000 + Math.random() * 15000) {
    clearTimeout(petBehaviorTimer);
    petBehaviorTimer = setTimeout(triggerPetBehavior, delay);
  }

  function triggerPetBehavior() {
    const blocked = document.hidden || currentView !== "home" || isUILocked() || !state?.introSeen || !state.pet?.alive || state.pet.stage === "egg" || state.pet.sleeping;
    if (blocked) { schedulePetBehavior(6000); return; }
    const personalityPools = {
      "CHAOTIC GOOD":["zoomies","ball","dance","wander-right"], "TINY CEO":["window","stretch","wander-left"], "SOFT MENACE":["hide","ball","window"], "FOREST GREMLIN":["hide","zoomies","wander-left"], "DRAMA FLAME":["dance","window","hide"], "QUIET GENIUS":["window","stretch","wander-right"], "SNACK SCHOLAR":["ball","wander-left","stretch"], "CERTIFIED HATER":["hide","window","stretch"], "LOYAL WEIRDO":["wander-left","wander-right","ball"], "MAIN CHARACTER":["dance","zoomies","window"]
    };
    const behaviors = personalityPools[state.pet.personality] || ["wander-left","wander-right","hide","window","ball","dance","zoomies","stretch"];
    const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
    activePetBehavior = behavior;
    renderHome();
    const lines = {
      hide: ["YOU CANNOT SEE ME.","I HAVE LEFT THE ESTABLISHMENT."],
      window: ["THE RAIN IS SAYING SOMETHING.","OUTSIDE LOOKS EXPENSIVE."],
      ball: ["THIS BALL STARTED IT.","I AM TRAINING VERY SERIOUSLY."],
      dance: ["THIS SONG IS UNRELEASED.","DO NOT RECORD THIS."],
      zoomies: ["I HAVE TOO MUCH FIRE.","EMERGENCY SPEED."],
      stretch: ["PREPARING TO DO ALMOST NOTHING."]
    };
    if (lines[behavior] && Math.random() < .72) {
      const pool = lines[behavior]; say(pool[Math.floor(Math.random() * pool.length)], 2200);
    }
    if (behavior === "dance") sfx("dance");
    if (behavior === "zoomies") sfx("rush", 6);
    const duration = behavior === "hide" ? 4300 : behavior === "zoomies" ? 2600 : 3400;
    setTimeout(() => {
      if (activePetBehavior === behavior) {
        activePetBehavior = null;
        if (currentView === "home") renderHome();
      }
      schedulePetBehavior();
    }, duration);
  }


  // ===== v22 LIVING WORLD / MOOD MEMORY =====
  let lifeIdleTimer = null;
  let lifeWowTimer = null;
  let lastLifeInputAt = now();
  let gazeFrame = 0;

  function lifeMemory() {
    const pet = state.pet;
    pet.lifeMemory ||= { lastGreetingDate:"", lastSeenAt:now(), recentWins:0, recentCare:0, moodMomentum:0, secretStage:0, filthSeen:false, bathIncidentRemembered:false, favoriteFoodRemembered:false, washUntil:0, washFromHygiene:100, lastBathAt:0, lastFoodAt:0, lastFoodId:"", arcadeAfterglowUntil:0, lastArcadeMode:"", lifeBehaviorUntil:0 };
    return pet.lifeMemory;
  }

  function livingMood() {
    const pet = state.pet, memory = lifeMemory();
    const hour = new Date().getHours();
    const awayHours = Math.max(0, (now() - (state.player.lastSessionAt || memory.lastSeenAt || now())) / 36e5);
    if (pet.sleeping || hour < 6) return {label:"SLEEPY",color:"#7f8cff",behavior:"doze"};
    if (pet.sick) return {label:"UNDER WEATHER",color:"#9eff75",behavior:"sneeze"};
    if (awayHours > 48) return {label:"MISSED YOU",color:"#ff68bd",behavior:"wave"};
    if ((memory.recentWins || 0) >= 3 || pet.hype > 70) return {label:"PROUD",color:"#ffd45a",behavior:"proud"};
    if (pet.mood < 25) return {label:"MOODY",color:"#ff5c6c",behavior:"annoyed"};
    if (pet.energy < 28) return {label:"TIRED",color:"#6c8cff",behavior:"yawn"};
    if (hour >= 18) return {label:"COZY",color:"#a46cff",behavior:"look-left"};
    if (pet.bond > 70) return {label:"ATTACHED",color:"#ff68bd",behavior:"wave"};
    return {label:"CURIOUS",color:"#16c8ff",behavior:Math.random()>.5?"look-left":"look-right"};
  }

  function applyLivingMood() {
    if (!state?.pet || state.pet.stage === "egg") return;
    const mood = livingMood();
    if (el.moodChip) {
      el.moodChip.querySelector("i").style.background = mood.color;
      el.moodChip.querySelector("span").textContent = mood.label;
      el.moodChip.classList.add("life-active");
    }
    const hour = new Date().getHours();
    document.body.classList.toggle("life-night", hour >= 20 || hour < 6);
    document.body.classList.toggle("life-dawn", hour >= 6 && hour < 9);
  }

  function setLifeBehavior(behavior, duration = 1800, line = "") {
    if (!state?.pet?.alive || state.pet.stage === "egg" || state.pet.sleeping || currentView !== "home" || isUILocked()) return;
    const memory = lifeMemory();
    memory.lifeBehaviorUntil = now() + duration;
    activePetBehavior = behavior;
    renderHome();
    if (line) say(line, Math.min(duration + 500, 3200));
    setTimeout(() => {
      if (activePetBehavior === behavior && memory.lifeBehaviorUntil <= now()) { activePetBehavior = null; if (currentView === "home") renderHome(); }
    }, duration);
  }

  function spawnLifeMoment(forceBrand = false) {
    if (document.hidden || currentView !== "home" || isUILocked() || state.settings.reducedMotion) return;
    const scene = el.habitatScene;
    if (!scene) return;
    const moment = document.createElement("i");
    const icons = ["✦","·","☾","❋","⌁"];
    moment.className = `life-particle${forceBrand || Math.random() < .18 ? " brand" : ""}`;
    if (!moment.classList.contains("brand")) moment.textContent = icons[Math.floor(Math.random()*icons.length)];
    moment.style.left = `${10 + Math.random()*80}%`;
    moment.style.top = `${30 + Math.random()*48}%`;
    moment.style.setProperty("--life-dx",`${-35+Math.random()*70}px`);
    moment.style.setProperty("--life-dy",`${-35-Math.random()*55}px`);
    moment.style.setProperty("--life-rot",`${-30+Math.random()*60}deg`);
    moment.style.setProperty("--life-duration",`${3.4+Math.random()*2.8}s`);
    scene.appendChild(moment);
    setTimeout(()=>moment.remove(),7000);
  }

  function scheduleLifeWow(delay = 18000 + Math.random()*18000) {
    clearTimeout(lifeWowTimer);
    lifeWowTimer = setTimeout(() => { spawnLifeMoment(); scheduleLifeWow(); }, delay);
  }

  function scheduleIdleLife() {
    clearTimeout(lifeIdleTimer);
    const delay = 28000 + Math.random()*22000;
    lifeIdleTimer = setTimeout(() => {
      if (now()-lastLifeInputAt > 26000 && currentView === "home" && !document.hidden) {
        const mood = livingMood();
        const choices = state.pet.hunger < 30 ? ["food-stare", mood.behavior, "look-left", "yawn"] : [mood.behavior,"yawn","look-left","look-right","sneeze"];
        // A pet that shared a hearth below sometimes just settles, remembering it (rare, never sad).
        if ((state.pet.storyMarks || []).some(mark => mark.id === "shared-hearth") && Math.random() < .12) { setLifeBehavior("recover", 1800); scheduleIdleLife(); return; }
        const behavior = choices[Math.floor(Math.random()*choices.length)];
        const lines = {yawn:"I WASN'T FALLING ASLEEP. I WAS THINKING SLOWLY.",sneeze:"THE AIR ATTACKED ME.",wave:"OH. YOU'RE STILL HERE.",annoyed:"PERSONAL SPACE IS A REAL INVENTION.","food-stare":"I CAN SEE THE FOOD AREA FROM HERE."};
        setLifeBehavior(behavior, behavior === "yawn" ? 2100 : 1500, Math.random()<.38 ? lines[behavior]||"" : "");
      }
      scheduleIdleLife();
    }, delay);
  }

  function greetForSession() {
    if (!state?.introSeen || state.pet.stage === "egg" || !state.pet.alive) return;
    const memory = lifeMemory(), today = dateKey();
    if (memory.lastGreetingDate === today) return;
    memory.lastGreetingDate = today;
    const away = Math.max(0,(now()-(state.player.lastSessionAt||now()))/36e5);
    const hour = new Date().getHours();
    const line = away > 48 ? "YOU TOOK FOREVER. I SAVED YOUR SPOT." : hour < 10 ? "YOU'RE UP. I PRETENDED NOT TO WAIT." : hour >= 20 ? "NIGHT SHIFT. LET'S MAKE BAD DECISIONS QUIETLY." : "THERE YOU ARE.";
    setTimeout(()=>setLifeBehavior(away>48?"wave":"proud",1800,line),900);
    saveState();
  }

  function trackRizoAttention(event) {
    lastLifeInputAt = now();
    if (!el.petActor || currentView !== "home" || state.settings.reducedMotion) return;
    cancelAnimationFrame(gazeFrame);
    gazeFrame = requestAnimationFrame(() => {
      const rect = el.petActor.getBoundingClientRect();
      const x = Math.max(-3,Math.min(3,((event.clientX-(rect.left+rect.width/2))/rect.width)*7));
      const y = Math.max(-2,Math.min(2,((event.clientY-(rect.top+rect.height/2))/rect.height)*5));
      el.petActor.style.setProperty("--gaze-x",`${x.toFixed(2)}px`);
      el.petActor.style.setProperty("--gaze-y",`${y.toFixed(2)}px`);
    });
  }

  function livingSecretReaction() {
    const taps = state.meta.totalTaps || 0, memory = lifeMemory();
    const stage = taps >= 100 ? 3 : taps >= 60 ? 2 : taps >= 20 ? 1 : 0;
    if (stage <= (memory.secretStage||0)) return;
    memory.secretStage = stage;
    if (stage === 1) setLifeBehavior("annoyed",1800,"OKAY. YOU HAVE CONFIRMED I AM REAL.");
    if (stage === 2) { setLifeBehavior("dizzy",2200,"THE ROOM HAS TOO MANY DIRECTIONS."); spawnLifeMoment(true); }
    if (stage === 3) { setLifeBehavior("hide",2800,"I HAVE FILED A FORMAL COMPLAINT."); sensoryBurst("✦",currentVariant().color,14); }
    saveState();
  }

  function accessoryMaterialSound(id) {
    const cloth=["bandana","scarf","bow","cape","beanie","cap"], metal=["chain","crown","halo","horns","belt"], glass=["shades","goggles","visor"];
    if (metal.includes(id)) { tone(780,.05,"sine",.02); tone(1180,.08,"sine",.012,.035); }
    else if (glass.includes(id)) { tone(1050,.045,"triangle",.018); }
    else if (cloth.includes(id)) { noise(.07,.014); }
    else { tone(280,.05,"triangle",.015); }
  }

  function maybeTriggerWorldEvent(force = false) {
    if (!state?.introSeen || worldEventOpen || document.hidden || currentView !== "home" || isUILocked() || mini.active || !state.pet.alive || state.pet.stage === "egg") return;
    const eventState = state.worldEvents ||= { lastAt: now(), count: 0, seen: [], lastBadLuckAt: 0, badLuckCount: 0 };
    const minimumGap = eventState.count === 0 ? 90000 : 300000;
    if (!force && now() - eventState.lastAt < minimumGap) return;
    if (!force && Math.random() > .36) return;
    const badLuckCoolingDown = !force && now() - (eventState.lastBadLuckAt || 0) < 45 * 60 * 1000;
    const weightedPool = WORLD_EVENTS
      .filter(event => !(badLuckCoolingDown && event.kind === "misfortune"))
      .map(event => ({
        event,
        weight: (event.weight || 1) * (eventState.seen.includes(event.id) ? .72 : 1.18)
      }));
    showWorldEvent(weightedPick(weightedPool)?.event);
  }

  function eventModalMarkup(event) {
    const eventKind = event.kind === "misfortune" ? "misfortune-event" : "";
    return `<div class="modal-card world-event-card ${eventKind} scene-${escapeHTML(event.scene || "event")}"><small>${escapeHTML(event.kicker)}</small><div class="event-stage premium-event-stage">${petMarkup({extraClass:"event-pet",id:"eventPet"})}<div class="event-icon">${event.icon}</div><div class="event-scenery"></div></div><h2>${escapeHTML(event.title)}</h2><p class="big-line">${escapeHTML(event.text)}</p><div class="event-choices">${event.choices.map(choice => `<button data-world-event="${event.id}" data-event-choice="${choice.id}">${escapeHTML(choice.label)}</button>`).join("")}</div></div>`;
  }

  function playPetCutscene({scene="event",kicker="FOREST MOMENT",title="RIZO NOTICED SOMETHING",symbol="✦",duration=900,after=null,className=""}={}) {
    const token=++cutsceneToken;
    activeMusicOverride=scene;
    startMusicForScene(scene,true);
    showModal(`<div class="modal-card pet-cutscene ${className} scene-${scene}"><div class="cutscene-cinema-bars" aria-hidden="true"></div><small>${escapeHTML(kicker)}</small><div class="cutscene-stage"><div class="cutscene-feature-fx" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="cutscene-symbol">${symbol}</div>${petMarkup({extraClass:"cutscene-pet",id:"cutscenePet"})}<div class="cutscene-floor"></div></div><h2>${escapeHTML(title)}</h2></div>`);
    duckMusic(duration+240,.12);
    sfx(scene==="shadow"?"secret":scene==="evolution"?"level":"event");
    setTimeout(()=>{ if(token===cutsceneToken && el.modalOverlay.classList.contains("show") && typeof after==="function") after(); }, state.settings.reducedMotion?80:duration);
  }

  function showWorldEvent(event) {
    if (!event) return;
    worldEventOpen = true;
    const scene=event.scene || (event.id==="glowing-puddle"?"forest":"event");
    playPetCutscene({scene,kicker:event.kicker,title:event.title,symbol:event.icon,duration:820,className:`event-${event.id} ${event.kind === "misfortune" ? "misfortune-cutscene" : ""}`,after:()=>showModal(eventModalMarkup(event))});
  }

  function resolveWorldEvent(eventId, choiceId) {
    const event = WORLD_EVENTS.find(item => item.id === eventId);
    const choice = event?.choices.find(item => item.id === choiceId);
    if (!event || !choice) return;
    const isMisfortune = event.kind === "misfortune";
    let loreTitle = null;
    let recoveryReason = null;
    mutate((pet, whole) => {
      const effect = choice.effect || {};
      whole.wallet.embers = Math.max(0, whole.wallet.embers + (effect.embers || 0));
      whole.wallet.shards = Math.max(0, whole.wallet.shards + (effect.shards || 0));
      pet.bond = clamp(pet.bond + (effect.bond || 0));
      pet.mood = clamp(pet.mood + (effect.mood || 0));
      pet.energy = clamp(pet.energy + (effect.energy || 0));
      pet.health = clamp(pet.health + (effect.health || 0));
      pet.hunger = clamp(pet.hunger + (effect.hunger || 0));
      pet.hygiene = clamp(pet.hygiene + (effect.hygiene || 0));
      pet.hype = Math.max(0, pet.hype + (effect.hype || 0));
      if (effect.sick === true) pet.sick = true;
      if (effect.sick === false) pet.sick = false;
      if (effect.recovery) recoveryReason = effect.recovery;
      if (effect.alignment) shiftAlignment(effect.alignment, `event:${event.id}`);
      if (effect.skill) gainSkill(effect.skill, effect.gain || .5, { silent: true });
      if (effect.lore) loreTitle = unlockRandomLore(1)?.title || null;
      whole.worldEvents.lastAt = now();
      whole.worldEvents.count += 1;
      if (isMisfortune) {
        whole.worldEvents.lastBadLuckAt = now();
        whole.worldEvents.badLuckCount = (whole.worldEvents.badLuckCount || 0) + 1;
      }
      if (!whole.worldEvents.seen.includes(event.id)) whole.worldEvents.seen.push(event.id);
      addMemory(event.title, choice.memory, event.icon);
      if (!isMisfortune) earnHeat(12, false);
    });
    if (recoveryReason) enterRecoveryState(recoveryReason, true);
    worldEventOpen = false;
    activeMusicOverride = null;
    closeModal();
    syncMusic(true);
    sfx(isMisfortune ? "sick" : "reward");
    if (isMisfortune) {
      haptic([35,45,35]);
      sensoryBurst("×", "#ff6b78", 12);
    } else sensoryBurst(event.icon, currentVariant().color, 14);
    const shaped = choice.effect?.skill ? `<div class="event-reward">${choice.effect.skill.toUpperCase()} +${choice.effect.gain || .5} • ${choice.effect.alignment > 0 ? "KIND" : choice.effect.alignment < 0 ? "WILD" : "BALANCED"} CHOICE</div>` : "";
    const consequence = isMisfortune
      ? `<div class="event-loss">BAD LUCK • ${recoveryReason ? "RECOVERY REST STARTED" : choice.effect?.sick ? "RIZO IS SICK" : "LOSSES SAVED"}</div>`
      : "";
    const followup = isMisfortune
      ? "This did not turn into a reward. The cost remains in the save until you care for Rizo and rebuild."
      : "Your choices quietly shape Rizo's stats, alignment, memories, and future form.";
    showModal(`<div class="modal-card ${isMisfortune ? "misfortune-result" : ""}"><div class="modal-art">${event.icon}</div><h2>${escapeHTML(choice.result)}</h2>${consequence}${loreTitle ? `<div class="event-reward">LORE FOUND: ${escapeHTML(loreTitle)}</div>` : ""}${shaped}<p>${followup}</p><div class="modal-buttons"><button class="primary" data-close-modal>BACK TO ${escapeHTML(state.pet.name)}</button></div></div>`);
  }

  // ===== REPEATABLE GAMEPLAY LOOPS =====
  // Each game uses a different control language and places the player's actual
  // Rizo inside the scene. This avoids the old "same moving circle" feeling.
  // Thin wrapper kept so every existing minigame callsite (power/spark/
  // forage/rush/walk) needs zero changes. Now reads from the same visual
  // state as the garden and closet, so accessory/stage/variant/mutation
  // never drift between scenes.
  function miniPetMarkup(extraClass = "") {
    return petMarkup({ extraClass, id: "miniPet", context: extraClass === "walk-rizo" ? "walk" : "arcade" });
  }

  // ===== TRAINING RUNNER =====
  // Every training game (training/<id>.js) plays through this one runner, under
  // the contract in core/rizo-training.js:
  //   hub:  energy check → frozen pet snapshot → stage → game.start(pet, run)
  //   game: plays on run.state with run.now() and run.after() until the clock
  //         runs out or it calls run.end()
  //   hub:  game.stop() → RizoTraining.convert(def, result) → growth → results
  // A game never touches the save, the wallet or the pet. The run clock stops
  // while the run is paused or the app is in the background, so every deadline
  // a game stores against run.now() is frozen with it, with nothing to credit.
  const Training = globalThis.RizoTraining;
  const ARCADE_MODES = Object.freeze((Training?.list?.() || []).map(def => def.id));
  function trainingGame(mode){ return Training?.get?.(mode) || null; }
  function arcadeName(mode){ return trainingGame(mode)?.name || String(mode||"ARCADE").toUpperCase(); }
  function arcadeArt(mode){ return trainingGame(mode)?.art || "★"; }
  function arcadeRunLength(mode){
    const seconds=trainingGame(mode)?.duration||0;
    return seconds>0?`${seconds}s`:"ENDLESS";
  }
  function arcadeBestLabel(){ return "BEST"; }
  function arcadeBestValue(mode){ return formatNumber(Math.max(0,Math.floor(Number(state?.scores?.[mode])||0))); }
  function miniDuration(mode) { return (trainingGame(mode)?.duration ?? 15) * 1000; }
  function miniEnergyNeeded(mode) { return trainingGame(mode)?.energy ?? 12; }

  // `mini` is the live run's board. The runner keeps the score, hits, inputs,
  // hearts, end reason, deadline and spawned entities on it; the game adds its
  // own fields. The header, pause panel, results and QA read it. Never saved.
  function idleRunBoard(){
    return { active:false, mode:null, score:0, hits:0, playerInputs:0, lives:0, maxLives:0, endReason:"", endAt:0, entities:[] };
  }
  // Runner-private bookkeeping for the live run (clock, jobs, pause state).
  let trainingRun = null;

  // ===== RUN CLOCK =====
  // Epoch-like milliseconds that stand still while any pause source holds the
  // run (the pause menu, an ad, the app in the background, a blocked save).
  // Sources stack: a notification during an ad must not thaw the run early.
  function runClockNow(){
    const run=trainingRun;
    if(!run) return now();
    const t=performance.now(), held=run.freezeAt?t-run.freezeAt:0;
    return run.epoch+(t-run.startedAt)-run.frozenTotal-held;
  }
  function arcadeFrozen(){ return Boolean(trainingRun && Object.keys(trainingRun.pauseSources).length); }
  function callGame(hook, ...args){
    const fn=trainingRun?.def?.[hook];
    if(typeof fn!=="function") return undefined;
    try{ return fn(...args); }
    catch(error){ console.warn(`Rizo training ${trainingRun?.def?.id}.${hook} failed`, error); return undefined; }
  }
  function arcadeFreeze(source="menu"){
    const run=trainingRun;
    if(!run || !mini.active || run.pauseSources[source]) return false;
    const first=!arcadeFrozen();
    run.pauseSources[source]=true;
    if(first){ run.freezeAt=performance.now(); callGame("pause", source); }
    return true;
  }
  function arcadeThaw(source="menu"){
    const run=trainingRun;
    if(!run || !mini.active || !run.pauseSources[source]) return false;
    delete run.pauseSources[source];
    if(arcadeFrozen()) return false;
    run.frozenTotal+=Math.max(0, performance.now()-run.freezeAt);
    run.freezeAt=0;
    run.lastFrame=performance.now();
    callGame("resume", source);
    return true;
  }

  // ===== RUN JOBS =====
  // run.after(ms, fn) / run.every(ms, fn): deadlines on the run clock, polled
  // once per frame. A frozen run cannot fire them, and nothing rides setTimeout.
  function trainingSchedule(ms, fn, period=0){
    const run=trainingRun;
    if(!run || !mini.active || typeof fn!=="function") return 0;
    const id=++run.jobSeq;
    run.jobs.set(id, { id, fn, period, due: runClockNow()+Math.max(0, Number(ms)||0) });
    return id;
  }
  function pollTrainingJobs(){
    const run=trainingRun;
    if(!run || arcadeFrozen()) return;
    const t=runClockNow();
    for(const job of [...run.jobs.values()]){
      if(trainingRun!==run || !mini.active) return;
      if(!run.jobs.has(job.id) || job.due>t) continue;
      if(job.period){ job.due+=job.period; if(job.due<=t) job.due=t+job.period; }
      else run.jobs.delete(job.id);
      try{ job.fn(); }catch(error){ console.warn(`Rizo training ${run.def.id} job failed`, error); }
    }
  }

  // ===== HEARTS =====
  function renderLives(id="miniLives"){
    const host=typeof id==="string"?$(`#${id}`):id;
    if(!host)return "";
    const max=Math.max(1,Math.floor(mini.maxLives||3)),lives=clamp(Math.floor(mini.lives||0),0,max);
    const markup=Array(max).fill(0).map((_,i)=>i<lives?"♥":"♡").join(" ");
    host.textContent=markup;
    host.classList.toggle("lives-critical",lives===1);
    host.classList.toggle("lives-empty",lives<=0);
    return markup;
  }
  function loseArcadeLife(amount=1){
    mini.lives=Math.max(0,(mini.lives||0)-Math.max(1,amount));
    if(mini.lives<=0)mini.endReason="death";
    return mini.lives;
  }

  // ===== RUN SERVICES =====
  // Everything a game may use. Anything not here is out of a game's reach.
  const TRAINING_MEMORY_BYTES = 4096;
  function deepFreezeCopy(value){
    const copy=SaveCore.plainJSON(value);
    (function freeze(node){ if(node&&typeof node==="object"&&!Object.isFrozen(node)){ Object.freeze(node); for(const key of Object.keys(node)) freeze(node[key]); } })(copy);
    return copy;
  }
  function createRunServices(def, pet){
    const runRef=trainingRun;
    const live=()=>trainingRun===runRef && mini.active;
    return Object.freeze({
      id: def.id,
      arena: el.miniArena,
      state: mini,
      pet,
      best: Math.max(0, Number(state.scores?.[def.id])||0),
      petMarkup: (extraClass="") => miniPetMarkup(extraClass),
      now: () => runClockNow(),
      after: (ms, fn) => (live() ? trainingSchedule(ms, fn, 0) : 0),
      every: (ms, fn) => { const period=Math.max(16, Number(ms)||16); return live() ? trainingSchedule(period, fn, period) : 0; },
      cancel: id => { runRef.jobs.delete(id); },
      clearJobs: () => { runRef.jobs.clear(); },
      // Ends the run now ("death" or "cleared"), or just pulls the deadline in.
      end: reason => { if(!live()) return false; if(["death","cleared"].includes(reason)) mini.endReason=reason; mini.endAt=Math.min(mini.endAt, runClockNow()); return true; },
      loseLife: amount => loseArcadeLife(amount),
      renderLives: id => renderLives(id),
      sfx: (name, ...args) => sfx(name, ...args),
      // The game's own win/fail sound family (def.sounds).
      cue: (kind="fail", intensity=0) => sfx(def.sounds?.[kind] || (kind==="win"?"reward":"no"), intensity),
      haptic: pattern => haptic(pattern),
      burst: (...args) => sensoryBurst(...args),
      toast: message => toast(message),
      settings: () => Object.freeze({ music: Boolean(state.settings.music), sound: Boolean(state.settings.sound), haptics: Boolean(state.settings.haptics), reducedMotion: reducedMotionActive() }),
      audio: Object.freeze({ context: () => ensureAudio(), midi: note => midiFrequency(note), musicGain: () => currentRhythmGain() }),
      // A small persistent memory per game (≤ 4 KB), e.g. Ember Beat's song bag.
      memory: () => SaveCore.plainJSON(state.trainingMemory?.[def.id] || {}),
      remember: data => {
        const plain=SaveCore.plainJSON(data && typeof data==="object" && !Array.isArray(data) ? data : {});
        if(JSON.stringify(plain).length>TRAINING_MEMORY_BYTES) return false;
        state.trainingMemory ||= {};
        state.trainingMemory[def.id]=plain;
        saveState();
        return true;
      }
    });
  }

  // ===== START =====
  function startMiniGame(mode, options = {}) {
    const def=trainingGame(mode);
    if (!def || !canCare()) return false;
    if (globalThis.RizoModes?.active?.()) return false;
    if (trainingRun) finishMiniGame(true, null, { discard: true });
    const energyNeeded = def.energy;
    if (state.pet.energy < energyNeeded) { toast(`NEED ${energyNeeded} ENERGY • RIZO HAS ${Math.floor(state.pet.energy)}`); sfx("no"); return false; }
    clearToasts();
    closeSheet();
    mini = { ...idleRunBoard(), active: true, mode, lives: def.lives, maxLives: def.lives };
    trainingRun = { def, epoch: now(), startedAt: performance.now(), frozenTotal: 0, freezeAt: 0, pauseSources: {}, jobs: new Map(), jobSeq: 0,
      frameId: 0, lastFrame: performance.now(), headerAt: 0, paused: false, quitConfirmed: false, restartConfirmed: false, options };
    mini.endAt = runClockNow() + def.duration * 1000;
    el.miniKicker.textContent = def.kicker || "";
    el.miniTitle.textContent = def.name;
    el.miniHint.textContent = def.hint || "";
    el.miniTimer.textContent = def.duration.toFixed(1);
    el.miniScore.textContent = "0 PTS";
    closeArcadePause(true);
    if (el.miniPause) el.miniPause.hidden = false;
    lastOverlayFocus = document.activeElement;
    el.miniArena.innerHTML = "";
    el.miniGameOverlay.dataset.training = mode;
    el.miniGameOverlay.hidden = false;
    syncUILock();
    const pet = deepFreezeCopy(modePetSnapshot(state.pet));
    try { def.start(pet, createRunServices(def, pet)); }
    catch (error) {
      console.warn(`Rizo training ${mode} failed to start`, error);
      finishMiniGame(true, null, { discard: true });
      toast("THAT GAME COULD NOT START • NOTHING WAS SPENT");
      return false;
    }
    trainingRun.frameId = requestAnimationFrame(trainingFrame);
    if (def.music) modeMusicTracks.set(`mini-${mode}`, def.music);
    startMusicForScene(`mini-${mode}`, true);
    haptic(25);
    requestAnimationFrame(() => el.miniArena.focus({ preventScroll: true }));
    return true;
  }

  // ===== FRAME =====
  // The game is stepped in slices of at most 40 ms, so a slow device plays at
  // the right speed instead of in slow motion; a stall over 250 ms (a tab
  // switch, a debugger) is skipped instead of being played back in one jump.
  const TRAINING_STEP_MS = 40, TRAINING_STALL_MS = 250, TRAINING_HEADER_MS = 50;
  function trainingFrame(timestamp){
    const run=trainingRun;
    if(!run || !mini.active) return;
    const raw=timestamp-run.lastFrame;
    run.lastFrame=timestamp;
    if(!arcadeFrozen()){
      let left=(!Number.isFinite(raw) || raw>TRAINING_STALL_MS) ? 0 : Math.max(0, raw);
      if(left===0) callGame("frame", 0);
      while(left>0 && trainingRun===run && mini.active){
        const step=Math.min(TRAINING_STEP_MS, left);
        left-=step;
        callGame("frame", step/1000);
      }
      if(trainingRun===run && mini.active) pollTrainingJobs();
      if(trainingRun===run && mini.active) updateTrainingClock(timestamp);
    }
    if(trainingRun===run && mini.active) run.frameId=requestAnimationFrame(trainingFrame);
  }
  function updateTrainingClock(timestamp=performance.now()){
    const run=trainingRun;
    if(!run || !mini.active || arcadeFrozen()) return;
    const remaining=Math.max(0, mini.endAt-runClockNow());
    if(remaining>0 && timestamp-run.headerAt<TRAINING_HEADER_MS) return;
    run.headerAt=timestamp;
    // A game may override what the header shows (Ember Beat: READY).
    const header=callGame("header") || {};
    el.miniTimer.textContent=header.timer ?? (remaining/1000).toFixed(1);
    el.miniScore.textContent=header.score ?? `${Math.max(0, Math.floor(mini.score))} PTS`;
    if(remaining<=0) finishMiniGame();
  }

  // ===== INPUT =====
  // The arena routes pointer and keyboard input to the live game. Hearts and
  // readouts are information, never the play surface.
  function handleMiniInput(event) {
    if (!mini.active || arcadeFrozen()) return;
    if (event.target.closest?.("[data-mini-readout]")) return;
    mini.playerInputs=(mini.playerInputs||0)+1;
    callGame("input", event);
  }
  function handleMiniMove(event) {
    if (!mini.active || arcadeFrozen()) return;
    callGame("move", event);
  }
  function handleMiniRelease(event, cancelled=false) {
    if (!mini.active) return;
    callGame("release", event, cancelled);
  }
  function handleMiniKey(event) {
    if (!mini.active || arcadeFrozen()) return false;
    return Boolean(callGame("key", event));
  }

  // ===== SHARED ARCADE PAUSE / QUIT =====
  function arcadeCanPause(){ return Boolean(mini?.active && trainingRun && callGame("canPause") !== false); }
  function openArcadePause(){
    if(!arcadeCanPause() || trainingRun.paused) return false;
    trainingRun.paused=true;
    arcadeFreeze("menu");
    renderArcadePausePanel();
    if(el.miniPausePanel) el.miniPausePanel.hidden=false;
    el.miniGameOverlay.classList.add("arcade-paused");
    if(el.miniPause){ el.miniPause.setAttribute("aria-expanded","true"); el.miniPause.textContent="RESUME"; }
    duckMusic(600,.05);
    sfx("ui");
    el.miniPausePanel?.querySelector("[data-arcade-resume]")?.focus({preventScroll:true});
    return true;
  }
  function closeArcadePause(silent=false){
    const wasPaused=Boolean(trainingRun?.paused);
    if(trainingRun){ trainingRun.paused=false; trainingRun.quitConfirmed=false; trainingRun.restartConfirmed=false; }
    if(el.miniPausePanel) el.miniPausePanel.hidden=true;
    el.miniGameOverlay?.classList.remove("arcade-paused");
    if(el.miniPause){ el.miniPause.setAttribute("aria-expanded","false"); el.miniPause.textContent="PAUSE"; }
    if(!wasPaused) return false;
    if(mini?.active) arcadeThaw("menu");
    if(!silent) sfx("ui");
    return true;
  }
  function toggleArcadePause(){ return trainingRun?.paused ? closeArcadePause() : openArcadePause(); }
  function renderArcadePausePanel(){
    const host=el.miniPausePanel;
    if(!host || !mini?.active) return;
    const score=Math.max(0,Math.floor(mini.score||0));
    const remaining=Math.max(0,(mini.endAt-runClockNow())/1000);
    host.innerHTML=`<div class="arcade-pause-card">
      <small>${escapeHTML(arcadeName(mini.mode))}</small>
      <h3>RUN PAUSED</h3>
      <div class="arcade-pause-stats"><span><small>THIS RUN</small><b>${formatNumber(score)}</b></span><span><small>TIME LEFT</small><b>${remaining.toFixed(1)}s</b></span></div>
      <p>The clock is frozen. Nothing spawns, nothing drains.</p>
      <div class="arcade-pause-actions">
        <button type="button" class="primary" data-arcade-resume>RESUME</button>
        <button type="button" data-arcade-restart>RESTART</button>
        <button type="button" class="danger" data-arcade-quit>END RUN</button>
      </div>
    </div>`;
  }
  function arcadeRunQualified() {
    if(!mini?.active && !trainingRun) return false;
    return Boolean(callGame("qualified", mini));
  }
  function restartArcadeRun(){
    if(!mini?.active || !trainingRun) return false;
    const mode=mini.mode;
    const score=Math.max(0,Math.floor(mini.score||0));
    // Restarting throws the run away, so a run worth keeping asks first.
    if(score>0 && arcadeRunQualified() && !trainingRun.restartConfirmed){
      trainingRun.restartConfirmed=true;
      renderArcadePausePanel();
      const actions=el.miniPausePanel?.querySelector(".arcade-pause-actions");
      if(actions) actions.innerHTML=`<button type="button" class="danger" data-arcade-restart>DISCARD ${formatNumber(score)} • RESTART</button><button type="button" class="primary" data-arcade-resume>KEEP PLAYING</button>`;
      return false;
    }
    closeArcadePause(true);
    finishMiniGame(true,null,{discard:true});
    startMiniGame(mode);
    return true;
  }
  // A run that would count confirms before it ends, and confirming banks it.
  function requestArcadeQuit(){
    if(!mini?.active || !trainingRun) return false;
    const score=Math.max(0,Math.floor(mini.score||0));
    const meaningful=score>0 && arcadeRunQualified();
    if(meaningful && !trainingRun.quitConfirmed){
      if(!trainingRun.paused) openArcadePause();
      trainingRun.quitConfirmed=true;
      renderArcadePausePanel();
      const card=el.miniPausePanel?.querySelector(".arcade-pause-card");
      if(card){
        const copy=card.querySelector("p");
        if(copy) copy.textContent=`End the run here? ${formatNumber(score)} points bank exactly as they stand — the rest of the clock is forfeit.`;
        const actions=card.querySelector(".arcade-pause-actions");
        if(actions) actions.innerHTML=`<button type="button" class="danger" data-arcade-quit>BANK ${formatNumber(score)} • END RUN</button><button type="button" class="primary" data-arcade-resume>KEEP PLAYING</button>`;
      }
      sfx("no");
      return false;
    }
    closeArcadePause(true);
    finishMiniGame(true);
    return true;
  }

  // ===== RESULTS =====
  // Why a run ended is first-class: death, the clock, a cleared board and
  // walking away read as four different screens. A game reports "cleared"
  // itself; the runner never infers it.
  const ARCADE_END_REASONS = Object.freeze({
    death:{label:"RUN ENDED", tone:"death"},
    timeup:{label:"TIME UP", tone:"timeup"},
    cleared:{label:"CLEARED", tone:"cleared"},
    quit:{label:"RUN BANKED", tone:"quit"}
  });
  function arcadeResultVoice(mode, reason, score, gameVoice){
    const name=arcadeName(mode);
    if(reason==="death") return { headline:"RUN ENDED", line:score>=30?`${name} TOOK IT ALL THE WAY DOWN SWINGING.`:score>=10?"THAT LAST ONE GOT YOU.":"GONE ALREADY. BRUTAL.", art:"✖" };
    if(reason==="quit") return { headline:"RUN BANKED", line:score>=30?"WALKED AWAY RICH. RESPECT.":"CASHED OUT EARLY. NOTHING LOST.", art:"⏻" };
    if(gameVoice?.line) return { headline:String(gameVoice.headline||"TIME UP"), line:String(gameVoice.line), art:gameVoice.art||null };
    if(reason==="cleared") return { headline:"CLEARED", line:"THE WHOLE BOARD. CLEAN.", art:"✓" };
    return { headline:"TIME UP", line:score<5?"WE ARE NEVER POSTING THAT RUN.":score>35?"THAT LOOKED LIKE A REAL GAME TRAILER.":"OKAY. THAT WAS ACTUALLY CLEAN.", art:null };
  }
  function arcadeResultGrid(stats){
    const rows=(Array.isArray(stats)?stats:[]).filter(row=>row&&row.label!==undefined).slice(0,4);
    if(!rows.length) return "";
    return `<div class="arcade-result-grid stat-${rows.length}">${rows.map(stat=>`<span>${escapeHTML(String(stat.label))}<b>${escapeHTML(String(stat.value))}</b></span>`).join("")}</div>`;
  }
  function trainingGainsLine(gains){
    const parts=Object.entries(gains.skills||{}).filter(([,amount])=>amount>=.05).map(([skill,amount])=>`+${amount.toFixed(1)} ${skill.toUpperCase()}`);
    if(gains.xp>=1) parts.push(`+${Math.round(gains.xp)} XP`);
    if(gains.embers>0) parts.push(`+${gains.embers} R`);
    if(gains.bond>=.5) parts.push(`+${gains.bond.toFixed(1)} BOND`);
    return parts.join(" • ");
  }

  // ===== FINISH =====
  function finishMiniGame(quit = false, endReasonHint = null, options = {}) {
    const run=trainingRun;
    if (!mini.active || !run) return;
    const def=run.def, mode=def.id, board=mini, discard=Boolean(options?.discard);
    const endReason=quit?"quit":(["death","cleared"].includes(board.endReason)?board.endReason:"timeup");
    // The game settles the run first (Spark Stash banks or spills its stash).
    if(!discard) callGame("settle", endReason);
    const score=Math.max(0,Math.floor(board.score||0));
    const qualified=!discard && Boolean(callGame("qualified", board));
    const report=(!discard && qualified) ? (callGame("result", board, endReason) || {}) : {};
    board.active=false;
    closeArcadePause(true);
    callGame("stop");
    cancelAnimationFrame(run.frameId);
    run.jobs.clear();
    for (const entity of board.entities || []) entity.node?.remove?.();
    trainingRun=null;
    el.miniQuit.textContent="QUIT RUN";
    el.miniGameOverlay.hidden=true;
    delete el.miniGameOverlay.dataset.training;
    el.miniArena.innerHTML="";
    syncUILock();
    activeMusicOverride=null;
    syncMusic(true);
    if(lastOverlayFocus?.isConnected) lastOverlayFocus.focus({preventScroll:true});
    if(discard) return;
    // Walking away from a run that never got going is a non-event.
    if(quit && !qualified) return;
    if(!qualified){
      showModal(`<div class="modal-card arcade-result minigame-result-${mode} arcade-no-credit"><div class="modal-art">${arcadeArt(mode)}</div><small class="arcade-result-mode">${escapeHTML(arcadeName(mode))}</small><h2>${score} POINTS</h2><p class="big-line">WARM-UP RUN. NO PERMANENT CREDIT.</p><p>Make at least one real play and complete part of the game's core challenge. No Energy, Embers, XP, Heat, or high-score credit was consumed or awarded.</p><div class="modal-buttons"><button class="primary" data-close-modal>BACK TO ARCADE</button><button data-replay-game="${mode}">TRY AGAIN</button></div></div>`);
      return;
    }
    applyTrainingResult(def, board, score, endReason, report);
  }

  // ===== GROWTH =====
  // The one place a training run changes the save. Every number comes from
  // RizoTraining.convert(); the only per-game inputs are the definition's own
  // declared fields (quest, counter, signal, finds).
  const TRAINING_COUNTERS = Object.freeze(["totalWalks"]);
  function applyTrainingResult(def, board, score, endReason, report) {
    const mode=def.id;
    const previousBest=Math.max(0,Number(state.scores?.[mode])||0);
    const rewardScore=Number.isFinite(Number(report.rewardScore)) ? Number(report.rewardScore) : score;
    const gains=Training.convert(def, { score: rewardScore, reason: endReason, inputs: Math.max(1, board.playerInputs||0) });
    mutate((pet,whole)=>{
      whole.meta.totalGames+=1;
      pet.careProfile.games[mode]=(pet.careProfile.games[mode]||0)+1;
      state.scores[mode]=Math.max(state.scores[mode]||0,score);
      for(const [skill,amount] of Object.entries(gains.skills)){
        const gained=gainSkill(skill,amount,{silent:true});
        if(skill==="power") pet.strength=clamp((pet.strength||0)+gained);
      }
      pet.xp+=gains.xp;
      pet.bond=clamp(pet.bond+gains.bond);
      pet.mood=clamp(pet.mood+gains.mood);
      pet.hunger=clamp(pet.hunger+gains.hunger);
      pet.energy=clamp(pet.energy+gains.energy);
      pet.hype=Math.max(0,(Number(pet.hype)||0)+gains.hype);
      whole.wallet.embers=SaveCore.clampInteger(whole.wallet.embers+gains.embers,0,CORE_LIMITS.MAX_WALLET_EMBERS,whole.wallet.embers);
      if(gains.alignment) shiftAlignment(gains.alignment,`${mode}-play`);
      earnHeat(10,false);
      progressQuest("play");
      if(def.quest) progressQuest(def.quest);
      if(TRAINING_COUNTERS.includes(def.counter)) whole.meta[def.counter]=(whole.meta[def.counter]||0)+1;
      if(def.signal) whole.meta.retroSignal=(whole.meta.retroSignal||0)+Math.max(1,Math.round(gains.performance*6));
    });
    if (gains.performance >= .2) {
      const memory = lifeMemory();
      memory.arcadeAfterglowUntil = now() + 16000;
      memory.lastArcadeMode = mode;
      saveState();
    }
    evaluateForm(true);
    const finds=applyTrainingFinds(def, report.finds, gains.performance);
    const voice=arcadeResultVoice(mode,endReason,score,report.voice);
    const art=voice.art||arcadeArt(mode);
    const subtitle=report.subtitle?`<div class="result-track-title">${escapeHTML(report.subtitle)}</div>`:"";
    const treasureCopy=finds.treasure?`<div class="event-reward">${finds.treasure.icon} FOUND: ${finds.treasure.name}</div>`:"";
    const rare=finds.variant;
    const rareCopy=rare?`<div class="rare-discovery-stage ${rare.id}">${petMarkup({extraClass:"rare-reaction-pet",id:"rareReactionPet"})}<div class="rare-found-pet"><img src="${rare.sprite}" alt="${rare.name}"></div><b>${rare.name} DISCOVERED</b></div>`:"";
    if(rare){activeMusicOverride=rare.id==="shadow"?"shadow":rare.id==="retro"?"retro":"forest";startMusicForScene(activeMusicOverride,true);duckMusic(1400,.08);}
    const newBest=score>previousBest?`<div class="arcade-best-banner"><i aria-hidden="true">★</i><div><small>NEW PERSONAL BEST</small><b>${formatNumber(score)}</b><em>PREVIOUS ${formatNumber(previousBest)}</em></div></div>`:"";
    if(score>previousBest){sfx("jackpot");sensoryBurst("NEW BEST","#ffd45a",16);}
    const gainsLine=trainingGainsLine(gains);
    showModal(`<div class="modal-card arcade-result arcade-end-${endReason} minigame-result-${mode} ${rare?"rare-result":""}"><div class="modal-art">${art}</div><small class="arcade-result-mode">${escapeHTML(arcadeName(mode))} • ${escapeHTML(ARCADE_END_REASONS[endReason].label)}</small>${subtitle}${newBest}<h2>${score} POINTS</h2><p class="big-line">${escapeHTML(voice.line)}</p>${arcadeResultGrid(report.stats)}${treasureCopy}${rareCopy}<p class="training-gains" data-training-gains>${escapeHTML(gainsLine)}</p><p>The arcade is training your actual Rizo, not just filling a leaderboard.</p><div class="modal-buttons"><button class="primary" data-close-modal>BACK TO RIZO</button><button data-replay-game="${mode}">RUN IT BACK</button></div></div>`);
    advanceTutorial("play");
    if(gains.performance>=1 && (endReason!=="death" || score>previousBest)) celebrate();
  }

  // Finds a game may report (def.finds whitelists them): a walk treasure, and a
  // rare Rizo the game rolled for. Arcade-signal games can reveal Retro.
  function applyTrainingFinds(def, finds, performance) {
    const out={treasure:null, variant:null};
    const allowed=def.finds||{};
    if(allowed.treasure && finds?.treasure) out.treasure=unlockWalkTreasure(Boolean(finds.treasureForce));
    if(def.signal && !state.collection.retro && (state.meta.retroSignal||0)>=100 && performance>=.5) out.variant=unlockVariantDiscovery("retro","AN ARCADE SIGNAL");
    if(!out.variant && Array.isArray(finds?.variants)){
      for(const find of finds.variants){
        const id=String(find?.id||"");
        if(!(allowed.variants||[]).includes(id) || state.collection[id]) continue;
        const chance=clamp(Number(find.chance)||0,0,.5);
        if(Math.random()>=chance) continue;
        if(id==="shadow") state.meta.shadowFinds=(state.meta.shadowFinds||0)+1;
        out.variant=unlockVariantDiscovery(id, String(find.source||"THE FOREST").slice(0,60));
        if(out.variant) break;
      }
    }
    if(out.treasure || out.variant) saveState();
    return out;
  }

  function unlockWalkTreasure(force = false) {
    const roll = force || Math.random() < .62;
    if (!roll) return null;
    const treasure=weightedPick(WALK_TREASURES);
    state.treasures[treasure.id]=(state.treasures[treasure.id]||0)+1;
    addMemory("WALK TREASURE", `${state.pet.name} found ${treasure.name}.`, treasure.icon);
    return treasure;
  }

  function unlockVariantDiscovery(id, source = "THE FOREST") {
    const variant = VARIANTS.find(item => item.id === id);
    if (!variant || state.collection[id]) return null;
    state.collection[id] = 1;
    state.wallet.shards += variant.rarity.includes("SECRET") ? 30 : 12;
    addMemory("RARE RIZO FOUND", `${variant.name} appeared through ${source}. It is now recorded in your collection.`, "? ");
    toast(`${variant.rarity}: ${variant.name}`);
    sfx(variant.rarity.includes("SECRET") ? "secret" : "legendary");
    celebrate();
    return variant;
  }

  function keeperRank() {
    const level = state.season?.level || 1;
    if (level >= 50) return "FOREST ICON";
    if (level >= 30) return "DIAMOND KEEPER";
    if (level >= 20) return "LEGEND KEEPER";
    if (level >= 10) return "FIRE KEEPER";
    if (level >= 5) return "REAL KEEPER";
    return "ROOKIE KEEPER";
  }

  function earnHeat(amount = 1, announce = true) {
    state.season ||= {xp:0,level:1};
    const old = state.season.level || 1;
    state.season.xp = Math.max(0,(state.season.xp||0)+amount);
    const level = Math.floor(state.season.xp / 100) + 1;
    if (level > old) {
      for (let lv = old + 1; lv <= level; lv++) {
        const reward = 20 + lv * 5;
        state.wallet.embers += reward;
        if (lv % 5 === 0) state.wallet.shards += 25;
        addMemory("HEAT LEVEL UP", `Reached Heat Level ${lv}. The forest paid R ${reward}${lv%5===0?" and 25 Prism Shards":""}.`, "🔥");
      }
      state.season.level = level;
      toast(`HEAT LEVEL ${level} • REWARDS DELIVERED`);
      sfx("level"); celebrate(); sensoryBurst("🔥","#ffd54a",24);
    } else state.season.level = level;
    if (announce && amount >= 10) toast(`+${amount} HEAT`);
  }

  function renderSeason() {
    if (!el.seasonLevel) return;
    const level = state.season?.level || 1;
    const within = (state.season?.xp || 0) % 100;
    el.seasonLevel.textContent = `HEAT LEVEL ${String(level).padStart(2,"0")}`;
    el.seasonBar.style.width = `${within}%`;
    el.seasonText.textContent = `${within} / 100 HEAT`;
    el.seasonReward.textContent = level % 5 === 4 ? `NEXT: R ${20+(level+1)*5} + 25◇` : `NEXT: R ${20+(level+1)*5}`;
    el.keeperRank.textContent = keeperRank();
  }

  function unlockRandomLore(chance = 1) {
    if (Math.random() > chance) return null;
    const locked = LORE_FRAGMENTS.filter(item => !state.loreUnlocked.includes(item.id));
    if (!locked.length) return null;
    const item = locked[Math.floor(Math.random()*locked.length)];
    state.loreUnlocked.push(item.id);
    addMemory("LORE SIGNAL", `Unlocked: ${item.title}.`, "▤");
    toast(`LORE FOUND: ${item.title}`);
    return item;
  }

  // ===== COLLECTION, PITY, AND EXPEDITIONS =====
  function rarityTier(rarity = "COMMON") {
    if (rarity.includes("SECRET")) return "SECRET";
    if (rarity.includes("LEGENDARY")) return "LEGENDARY";
    if (rarity.includes("MYTHIC")) return "MYTHIC";
    if (rarity.includes("EPIC")) return "EPIC";
    if (rarity.includes("RARE")) return "RARE";
    if (rarity.includes("UNCOMMON")) return "UNCOMMON";
    return "COMMON";
  }

  function openCapsule(type = "standard", free = false) {
    if (!houseIsUnlocked()) { toast(`RIZO HOUSE UNLOCKS AT LEVEL ${HOUSE_UNLOCK_LEVEL}`); sfx("no"); return; }
    const cost = type === "prism" ? 6000 : HOUSE_ADOPTION_COST;
    if (!free && !houseHasSpace()) { toast("EVERY UNLOCKED ROOM IS FULL • BUY ANOTHER ROOM"); sfx("no"); if (currentView === "farm") renderFarm(); return; }
    if (!free && state.wallet.embers < cost) { toast(`NEED R ${cost} FOR A NEW RIZO`); sfx("no"); return; }
    if (!free) state.wallet.embers -= cost;
    const rolled = rollVariant(type === "prism", false, state.meta.pity || 0);
    const previous = state.collection[rolled.id] || 0;
    state.collection[rolled.id] = previous + 1;
    state.meta.capsules = (state.meta.capsules || 0) + 1;
    const tier = rarityTier(rolled.rarity);
    const jackpot = ["MYTHIC","LEGENDARY","SECRET"].includes(tier);
    state.meta.pity = jackpot ? 0 : (state.meta.pity || 0) + 1;
    const shards = previous ? ({COMMON:4,UNCOMMON:7,RARE:12,EPIC:18,MYTHIC:30,LEGENDARY:55,SECRET:100}[tier] || 5) : 0;
    state.wallet.shards += shards;
    earnHeat(({COMMON:8,UNCOMMON:10,RARE:16,EPIC:24,MYTHIC:38,LEGENDARY:70,SECRET:140}[tier] || 8), false);
    const lore = unlockRandomLore(tier === "SECRET" ? 1 : tier === "LEGENDARY" ? .8 : .24);
    const houseOutcome = sendCapsulePetToFarm(rolled, tier, { allowOverflow: free });
    const houseLine = houseOutcome.overflow
      ? ` Every unlocked room was full, so the free signal left ${houseOutcome.shardValue} Prism Shards instead.`
      : ` ${houseOutcome.pet.name} moved into ${HOUSE_ROOMS[houseOutcome.pet.homeRoom].name}.`;
    checkAchievements(); saveState(true); renderAll();
    const duplicateLine = previous ? `KNOWN COLOR • +${shards} PRISM SHARDS` : "NEW COLOR DISCOVERED";
    activeMusicOverride = rolled.id === "retro" ? "retro" : rolled.id === "shadow" ? "shadow" : "capsule";
    startMusicForScene(activeMusicOverride,true);
    showModal(`<div class="modal-card capsule-premium ${tier === "SECRET" ? "secret-reveal" : ""}"><div class="capsule-stage" style="--reveal-color:${rolled.color}">${petMarkup({extraClass:"capsule-reaction-pet",id:"capsuleReactionPet"})}<div class="rarity-reveal"><img src="${rolled.sprite}" alt="${rolled.name}"></div><i>✦</i></div><small style="color:${rolled.color};letter-spacing:.16em">${rolled.rarity} HOUSE SIGNAL</small><h2>${rolled.name}</h2><p class="big-line">${duplicateLine}</p><p>${lore ? `A lore fragment came with it: ${lore.title}.` : "The capsule dissolved into blue sparks."}${houseLine}</p><div class="modal-buttons"><button class="primary" data-close-modal>WELCOME HOME</button>${houseHasSpace() ? `<button data-capsule="${type}">ADOPT ANOTHER • R ${cost}</button>` : ""}</div></div>`);
    duckMusic(tier === "SECRET" ? 1500 : 950,tier === "SECRET"?.07:.12);
    sfx(tier === "SECRET" ? "secret" : tier === "LEGENDARY" ? "legendary" : tier === "MYTHIC" ? "mythic" : "capsule");
    sensoryBurst("✦",rolled.color,tier === "SECRET"?42:tier === "LEGENDARY"?30:18);
    if (["MYTHIC","LEGENDARY","SECRET"].includes(tier)) celebrate();
  }

  function startExpedition(type) {
    const data = EXPEDITIONS[type];
    if (!data || state.expedition.active) return;
    if (!canCare()) return;
    if (state.pet.energy < data.energy) { say("I NEED MORE ENERGY BEFORE I GO OUT."); sfx("no"); return; }
    state.pet.energy = clamp(state.pet.energy - data.energy);
    const embers = Math.floor(data.min + Math.random()*(data.max-data.min+1));
    const capsule = Math.random() < data.capsuleChance;
    const lore = Math.random() < data.loreChance;
    state.expedition = {active:true,ready:false,type,endAt:now()+data.minutes*60000,result:{embers,heat:data.heat,capsule,lore}};
    addMemory("EXPEDITION STARTED", `${state.pet.name} left for the ${data.name}.`, "🌲");
    saveState(true); renderAll(); say("I'LL BE BACK. PROBABLY."); sfx("depart");
  }

  function processExpedition() {
    if (state.expedition?.active && !state.expedition.ready && now() >= state.expedition.endAt) state.expedition.ready = true;
  }

  function renderExpedition() {
    if (!el.expeditionStatus) return;
    processExpedition();
    const ex = state.expedition;
    $$('[data-expedition]').forEach(button => button.disabled = Boolean(ex.active));
    if (!ex.active) { el.expeditionStatus.textContent = "SEND RIZO OUT FOR LOOT AND LORE."; el.expeditionClaim.hidden = true; return; }
    const data = EXPEDITIONS[ex.type];
    if (ex.ready) { el.expeditionStatus.textContent = `${data.name} COMPLETE. SOMETHING IS GLOWING.`; el.expeditionClaim.hidden = false; }
    else { const sec=Math.max(0,Math.ceil((ex.endAt-now())/1000)); const m=Math.floor(sec/60),s=sec%60; el.expeditionStatus.textContent=`${data.name} • ${m}:${String(s).padStart(2,"0")} REMAINING`; el.expeditionClaim.hidden=true; }
  }

  function claimExpedition() {
    processExpedition();
    const ex=state.expedition;if(!ex?.active||!ex.ready)return;
    const result=ex.result||{}; const data=EXPEDITIONS[ex.type];
    state.wallet.embers += result.embers || 0;
    earnHeat(result.heat || 0,false);
    let extra="";
    if(result.lore){const l=unlockRandomLore(1);if(l)extra+=` Lore: ${l.title}.`;}
    state.expedition={active:false,ready:false,type:null,endAt:0,result:null};
    if(result.capsule){state.wallet.embers+=125;extra+=" A free capsule token converted to R 125.";}
    let forestVariant=null;
    if(ex.type==="deep" && !state.collection.shadow && Math.random()<.09) forestVariant=unlockVariantDiscovery("shadow","THE DEEP WOODS");
    else if(!state.collection.moss && Math.random()<.18) forestVariant=unlockVariantDiscovery("moss","A FOREST EXPEDITION");
    if(forestVariant) extra+=` ${forestVariant.name} was discovered.`;
    state.pet.bond=clamp(state.pet.bond+4);state.pet.mood=clamp(state.pet.mood+8);
    addMemory("EXPEDITION RETURN", `${state.pet.name} returned from ${data.name} with R ${result.embers}.${extra}`, "🌲");
    saveState(true);renderAll();
    showModal(`<div class="modal-card"><div class="modal-art">🌲</div><h2>RIZO CAME BACK.</h2><p class="big-line">${data.name} LOOT SECURED.</p><p>R ${result.embers} • +${result.heat} Heat${extra}</p><div class="modal-buttons"><button class="primary" data-close-modal>TAKE THE LOOT</button></div></div>`);
    sfx("reward");celebrate();sensoryBurst("✦","#9eff75",24);
  }

  function animatePet(className, duration=600) {
    el.petActor.classList.remove(className); void el.petActor.offsetWidth; el.petActor.classList.add(className); setTimeout(()=>el.petActor.classList.remove(className),duration);
  }

  function sensoryBurst(symbol="✦", color="#16c8ff", count=10, event=null) {
    const rect=el.petActor.getBoundingClientRect();
    const x=event?.clientX || rect.left+rect.width/2, y=event?.clientY || rect.top+rect.height/2;
    if(el.sensoryFlash){el.sensoryFlash.style.setProperty("--x",`${x}px`);el.sensoryFlash.style.setProperty("--y",`${y}px`);el.sensoryFlash.classList.remove("pop");void el.sensoryFlash.offsetWidth;el.sensoryFlash.classList.add("pop");}
    for(let i=0;i<count;i++){const p=document.createElement("i");p.className="particle-pop";p.textContent=symbol;p.style.left=`${x}px`;p.style.top=`${y}px`;p.style.color=color;p.style.setProperty("--dx",`${Math.random()*150-75}px`);p.style.setProperty("--dy",`${-25-Math.random()*115}px`);p.style.setProperty("--rot",`${Math.random()*360-180}deg`);document.body.appendChild(p);setTimeout(()=>p.remove(),800);}
  }

  function enterRecoveryState(reason = "overwhelmed", silent = false) {
    const pet = state.pet;
    if (pet.resting || pet.stage === "egg") return;
    pet.resting = true;
    pet.sleeping = false;
    pet.health = 1;
    pet.energy = Math.max(5, pet.energy);
    state.meta.recoveries = (state.meta.recoveries || 0) + 1;
    addMemory("TOO MUCH", `${pet.name} became overwhelmed and hid under the blanket. Nothing permanent was lost.`, "☁");
    saveState(true);
    if (modeCareHold) { modeCareHold.deferred.add("recovery"); return; }
    if (!silent || document.visibilityState === "visible") showRecoveryModal();
  }

  function showRecoveryModal() {
    const pet = state.pet;
    showModal(`<div class="modal-card recovery-card"><div class="modal-art">☁</div><h2>${escapeHTML(pet.name)} HID.</h2><p class="big-line">THE GARDEN IS A COMFORT GAME. YOU DID NOT LOSE YOUR PET.</p><p>Health reached zero, so Rizo went somewhere quiet. Comfort them to return with basic needs restored.</p><div class="modal-buttons"><button class="primary" data-comfort-pet>COMFORT RIZO</button></div></div>`);
  }

  function comfortPet() {
    const pet = state.pet;
    if (!pet.resting) return;
    pet.resting = false;
    pet.health = 45;
    pet.hunger = Math.max(40, pet.hunger);
    pet.mood = Math.max(45, pet.mood);
    pet.energy = Math.max(40, pet.energy);
    pet.hygiene = Math.max(40, pet.hygiene);
    pet.sick = false;
    pet.lastTick = now();
    shiftAlignment(5, "recovery");
    addMemory("CAME BACK", `${pet.name} returned after a quiet reset.`, "♥");
    saveState(true); closeModal(); renderAll(); say("OKAY. I NEEDED THAT.", 3200); effect("hearts");
  }

  function enterElderState(silent = false) {
    const pet = state.pet;
    if (pet.elder || pet.stage === "egg") return;
    pet.elder = true;
    pet.health = Math.max(35, pet.health);
    pet.lifespanDays += 9999;
    addMemory("ELDER FLAME", `${pet.name} reached the end of one life cycle and can now create a Legacy Egg.`, "↻");
    saveState(true);
    if (modeCareHold) { modeCareHold.deferred.add("elder"); return; }
    if (!silent || document.visibilityState === "visible") showRebirthInfo();
  }

  function canRebirth() {
    const pet = state.pet;
    return pet.stage === "legend" && pet.bond >= 80 && skillTotal(pet) >= 300 && pet.alive && !pet.resting;
  }

  function showRebirthInfo() {
    const pet = state.pet;
    const ready = canRebirth();
    const stageOk = pet.stage === "legend";
    const bondNeed = Math.max(0, 80 - pet.bond);
    const statNeed = Math.max(0, 300 - skillTotal(pet));
    const seed = state.garden.bondSeed;
    const inheritance = seed
      ? `<div class="bond-seed-mini"><b>♡ BOND EGG READY</b><span>${escapeHTML(pet.name)} + ${escapeHTML(seed.name)}</span><small>Both lineages will blend their genetic caps. One parent does not overwrite the other.</small></div>`
      : `<div class="sheet-note">Optional: invite another Keeper's mature Rizo and save a Friendship Spark in House. A normal Legacy Egg still works without one.</div>`;
    showModal(`<div class="modal-card legacy-modal"><div class="modal-art">↻</div><h2>${seed ? "BOND LEGACY EGG" : "LEGACY EGG"}</h2><p class="big-line">REBIRTH IS THE LONG GAME.</p><p>${ready ? `${escapeHTML(pet.name)} becomes an ancestor. The new egg inherits higher, randomized caps${seed ? ` blended with ${escapeHTML(seed.name)}` : " from this lineage"}. Collection, rooms, cosmetics and currency remain.` : `Requirements: ${stageOk ? "✓ Mature" : "Reach Mature"} • ${bondNeed <= 0 ? "✓ 80 Bond" : `${Math.ceil(bondNeed)} more Bond`} • ${statNeed <= 0 ? "✓ 300 Training" : `${Math.ceil(statNeed)} more Training`}.`}</p><div class="gene-preview">${SKILLS.map(skill=>`<span>${skill.icon} ${skill.name}<b>${Math.floor(pet.skills?.[skill.id]||0)}/${Math.floor(pet.genes?.[skill.id]||100)}</b></span>`).join("")}</div>${inheritance}${ready ? modeJourneyNote(pet.id) : ""}<div class="modal-buttons">${ready ? `<button class="primary" data-confirm-rebirth>${seed ? "CREATE BOND EGG" : "CREATE LEGACY EGG"}</button>` : ""}<button data-close-modal>NOT YET</button></div></div>`);
  }

  function combinedDominantSkill(parent, partner) {
    if (!partner) return dominantSkill(parent);
    return [...SKILLS].sort((a,b)=>{
      const bScore=(Number(parent.skills?.[b.id])||0)+(Number(partner.skills?.[b.id])||0)*.7;
      const aScore=(Number(parent.skills?.[a.id])||0)+(Number(partner.skills?.[a.id])||0)*.7;
      return bScore-aScore;
    })[0]?.id || "balanced";
  }

  function chooseInheritedMutation(parent, partner) {
    const rare = [parent?.mutation, partner?.mutation].filter(id=>id && id!=="normal" && MUTATIONS.some(item=>item.id===id));
    if (rare.length && Math.random() < .32) return rare[Math.floor(Math.random()*rare.length)];
    if (partner && Math.random() < .045) return rollMutation().id;
    return Math.random() < .1 ? rollMutation().id : "normal";
  }

  function completeRebirth() {
    if (!canRebirth()) { showRebirthInfo(); return; }
    const old = state.pet;
    const seed = state.garden.bondSeed;
    const form = displayFormInfo(old);
    state.legacy.unshift({ id: old.id, name: old.name, variant: old.variant, form: old.form, formName: form.name, generation: old.generation || 1, skills: {...old.skills}, genes: {...old.genes}, personality: old.personality, partner: seed ? {keeper:seed.keeper,name:seed.name,variant:seed.variant,generation:seed.generation} : null, at: now() });
    state.legacy = state.legacy.slice(0,40);

    const next = createPet({ lucky: Math.max(old.generation || 1, seed?.generation || 1) >= 2 });
    next.generation = Math.max(old.generation || 1, seed?.generation || 1) + 1;
    next.genes = createGenes(old, seed || null);
    next.lineageTrait = combinedDominantSkill(old, seed || null);
    next.personality = seed && Math.random() < .34
      ? seed.personality
      : Math.random() < .55 ? old.personality : PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
    next.mutation = chooseInheritedMutation(old, seed || null);

    const resonance = state.garden.nextEggVariant && state.collection[state.garden.nextEggVariant] ? state.garden.nextEggVariant : null;
    const partnerVariant = seed && state.collection[seed.variant] ? seed.variant : null;
    if (resonance) next.hiddenVariant = resonance;
    else if (partnerVariant && Math.random() < .36) next.hiddenVariant = partnerVariant;
    else next.hiddenVariant = Math.random() < .62 ? (old.variant || old.hiddenVariant) : rollVariant(true,false,state.meta.pity||0).id;

    next.room = old.room;
    next.accessory = old.accessory;
    next.alignment = clamp((old.alignment || 0) * .16 + (seed?.alignment || 0) * .08, -22, 22);
    next.careProfile.inheritedFrom = seed ? [old.name, seed.name] : [old.name];

    state.pet = next;
    state.meta.rebirths = (state.meta.rebirths || 0) + 1;
    if (seed) state.meta.bondEggs = (state.meta.bondEggs || 0) + 1;
    state.meta.nextPetNumber += 1;
    state.wallet.shards += seed ? 50 : 35;
    if (resonance) state.garden.nextEggVariant = null;
    state.garden.bondSeed = null;
    unlockRandomLore(1);
    if (seed && !state.loreUnlocked.includes("bond-eggs")) state.loreUnlocked.push("bond-eggs");
    const sourceCopy = seed ? `two gardens: ${old.name} and ${seed.name}` : old.name;
    addMemory(seed ? "BOND EGG" : "LEGACY EGG", `Generation ${next.generation} formed from ${sourceCopy}. It inherited ${next.lineageTrait.toUpperCase()} potential${resonance ? ` and resonated with ${VARIANTS.find(item=>item.id===resonance)?.name || resonance}` : ""}.`, seed ? "♡" : "↻");
    saveState(true); closeModal(); changeView("home"); renderAll(); celebrate(); sfx("secret"); say(seed ? "I REMEMBER TWO GARDENS." : "I REMEMBER SOMETHING I HAVEN'T DONE YET.", 4200);
  }

  function killPet(reason, silent = false) {
    // Compatibility wrapper for older calls/saves. New Rizos recover or become elders instead of being permanently lost.
    if (reason === "old age") enterElderState(silent);
    else enterRecoveryState(reason, silent);
  }

  function showDeathModal() { showRecoveryModal(); }

  function revivePet() { comfortPet(); }

  function buyNewEgg(type) {
    const costs = { standard: 75, lucky: 250, prism: 500, shame: 0 };
    const cost = costs[type];
    if (state.wallet.embers < cost) { toast("YOU CANNOT FINANCE AN EGG"); return; }
    state.wallet.embers -= cost;
    state.pet = createPet({ lucky: type === "lucky" || type === "prism", shame: type === "shame" });
    if (type === "prism") state.pet.hiddenVariant = rollVariant(true,false,Math.max(30,state.meta.pity||0)).id;
    state.meta.nextPetNumber += 1;
    addMemory("A NEW EGG", type === "shame" ? "You accepted the free Shame Egg. The game remembers." : `You brought home a ${type === "prism" ? "Prism" : type === "lucky" ? "Lucky" : "Mystery"} Egg.`, "🥚");
    saveState(true);
    closeModal();
    changeView("home");
    renderAll();
    say(type === "shame" ? "THE GAME WILL REMEMBER THIS." : "A NEW PROBLEM HAS ARRIVED.", 3200);
  }

  function addMemory(title, text, icon = "✦") {
    state.memories.unshift({ title, text, icon, at: now() });
    state.memories = state.memories.slice(0, 60);
  }

  function checkAchievements() {
    let changed = false;
    for (const achievement of ACHIEVEMENTS) {
      if (!state.achievements.includes(achievement.id) && achievement.test(state)) {
        state.achievements.push(achievement.id);
        state.wallet.embers += achievement.reward;
        addMemory("BADGE UNLOCKED", `${achievement.name}: ${achievement.description}`, achievement.icon);
        toast(`BADGE: ${achievement.name} • +R ${achievement.reward}`);
        sfx("level");
        celebrate();
        changed = true;
      }
    }
    if (changed) saveState();
  }

  function advanceTutorial(action) {
    if (state.player.tutorialDismissed) return;
    const step = state.player.tutorialStep;
    if (step === 2 && action === "feed") state.player.tutorialStep = 3;
    if (step === 3 && action === "play") state.player.tutorialStep = 4;
    saveState();
    renderTutorial();
  }

  function say(text, duration = 2600) {
    clearTimeout(speechTimer);
    el.thoughtBubble.textContent = text;
    el.thoughtBubble.classList.add("show");
    speechTimer = setTimeout(() => el.thoughtBubble.classList.remove("show"), duration);
  }

  function effect(type) {
    if (state.pet.stage === "egg") return;
    el.statusFx.className = `status-fx ${type}`;
    setTimeout(() => { if (!state.pet.sleeping) el.statusFx.className = "status-fx"; }, 1600);
  }

  function toast(text) {
    while (el.toastStack.children.length >= 1) el.toastStack.firstElementChild?.remove();
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = text;
    el.toastStack.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function floatText(event, text) {
    const node = document.createElement("span");
    node.className = "float-text";
    node.textContent = text;
    const rect = el.petTapTarget.getBoundingClientRect();
    node.style.left = `${event.clientX || rect.left + rect.width / 2}px`;
    node.style.top = `${event.clientY || rect.top + rect.height / 2}px`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 850);
  }

  function celebrate() {
    el.habitatScene?.classList.add("camera-reward"); setTimeout(()=>el.habitatScene?.classList.remove("camera-reward"),800);
    const colors = VARIANTS.map(item => item.color);
    for (let index = 0; index < 30; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.top = "-18px";
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--dx", `${Math.random() * 180 - 90}px`);
      piece.style.animationDelay = `${Math.random() * .35}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 2300);
    }
  }

  let audioContext;
  function ensureAudio() { try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if(audioContext.state === "suspended" && !adAudioHolds) audioContext.resume(); return audioContext; } catch(error){ return null; } }
  function soundVolume(){ return !adAudioHolds && state?.settings?.sound ? clamp(Number(state.settings.soundVolume ?? .85),0,1) : 0; }
  function musicVolume(){ return !adAudioHolds && state?.settings?.music ? clamp(Number(state.settings.musicVolume ?? .85),0,1) : 0; }
  function currentMusicGain(){ return Math.max(.001, MUSIC_MASTER_GAIN * musicVolume()); }
  function currentRhythmGain(){ return Math.max(.001, .76 * musicVolume()); }
  function tone(freq=420,duration=.05,type="square",volume=.035,delay=0,slide=0){
    const level=soundVolume(); if(level<=0)return; const ctx=ensureAudio();if(!ctx)return;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime+delay);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(35,freq+slide),ctx.currentTime+delay+duration);g.gain.setValueAtTime(Math.min(.16,volume*SFX_MASTER_GAIN*level),ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+duration);o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+duration+.01);
  }
  function noise(duration=.08,volume=.025,delay=0){const level=soundVolume();if(level<=0)return;const ctx=ensureAudio();if(!ctx)return;const len=Math.max(1,Math.floor(ctx.sampleRate*duration)),buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buf;g.gain.setValueAtTime(Math.min(.16,volume*SFX_MASTER_GAIN*level),ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+duration);src.connect(g).connect(ctx.destination);src.start(ctx.currentTime+delay);}
  function beep(frequency=420,duration=.05,type="square"){tone(frequency*(.97+Math.random()*.06),duration,type,.032);}
  function sfx(name,intensity=0){
    if(!state.settings.sound)return;
    if(["capsule","mythic","legendary","secret","hatch","level","reward"].includes(name)) duckMusic(name==="secret"?1500:950,name==="secret"?.07:.12);
    const v=.028;
    if(name==="tap"){const f=310+Math.min(360,intensity*7)+Math.random()*35;tone(f,.035,"square",v,0,45);}
    else if(name==="egg"){tone(220+Math.random()*50,.07,"sine",.035,0,90);tone(440,.04,"triangle",.018,.04);}
    else if(name==="no"){tone(240,.09,"square",.035,0,-70);tone(180,.12,"square",.03,.09,-45);}
    else if(name==="sick"){tone(250,.18,"sawtooth",.025,0,-150);noise(.14,.018,.03);tone(110,.22,"triangle",.025,.13,-40);}
    else if(name==="eat"){tone(520,.045,"square",.025);tone(640,.04,"triangle",.02,.055);noise(.035,.012,.02);}
    else if(name==="clean"){[0,1,2,3].forEach(i=>tone(620+i*110,.08,"sine",.02,i*.045,70));}
    else if(name==="sleep"){tone(360,.18,"sine",.025,0,-130);tone(220,.25,"sine",.018,.15,-80);}
    else if(name==="wake"){tone(310,.08,"triangle",.025);tone(510,.11,"triangle",.026,.07,120);}
    else if(name==="talk"){tone(330+Math.random()*70,.055,"square",.018);tone(410+Math.random()*100,.05,"square",.015,.06);}
    else if(name==="perfect"){[620,880,1180].forEach((f,i)=>tone(f,.09,"square",.03,i*.035,120));}
    else if(name==="spark"){tone(690+Math.random()*120,.045,"sine",.026,0,140);tone(980,.05,"triangle",.014,.035);}
    else if(name==="jump"){tone(280,.1,"square",.024,0,230);}
    else if(name==="dance"){[330,440,550,660].forEach((f,i)=>tone(f,.07,"square",.018,i*.065));}
    else if(name==="event"){tone(240,.2,"sine",.02,0,220);tone(620,.14,"triangle",.018,.16,-90);}
    else if(name==="hit"||name==="rush"){tone(410+Math.min(500,intensity*14),.035,"square",.028,0,80);}
    else if(name==="jackpot"){[520,660,820,1040].forEach((f,i)=>tone(f,.13,"square",.035,i*.055,100));noise(.12,.02,.08);}
    else if(name==="capsule"){tone(280,.13,"triangle",.025,0,350);tone(720,.16,"sine",.03,.11,180);}
    else if(name==="mythic"){[260,390,590,880].forEach((f,i)=>tone(f,.18,"triangle",.03,i*.08,120));}
    else if(name==="legendary"){[330,495,660,990].forEach((f,i)=>tone(f,.24,"sine",.035,i*.09,160));noise(.18,.018,.18);}
    else if(name==="secret"){[220,330,440,660,990,1320].forEach((f,i)=>tone(f,.32,"sine",.03,i*.07,220));noise(.28,.02,.2);}
    else if(name==="hatch"){[260,390,520,780].forEach((f,i)=>tone(f,.16,"triangle",.03,i*.06,100));}
    else if(name==="level"||name==="reward"){[440,554,659,880].forEach((f,i)=>tone(f,.12,"square",.026,i*.055,80));}
    else if(name==="depart"){tone(500,.12,"sine",.022,0,-180);tone(300,.2,"sine",.018,.1,-120);}
    else if(name==="ui"){tone(540,.026,"triangle",.016);tone(760,.02,"sine",.01,.022);}
    else if(name==="coin"){tone(880,.045,"square",.022,0,90);tone(1320,.07,"square",.018,.04);}
    // ===== ARCADE SIGNATURES =====
    // Eleven games used to share two failure sounds. Each mode family now has a
    // recognisable win and loss so a dropped package cannot sound like a
    // corrupted broadcast.
    else if(name==="fail-air"){tone(520,.16,"sine",.03,0,-330);noise(.13,.016,.05);tone(180,.2,"triangle",.026,.12,-60);}
    else if(name==="fail-drop"){noise(.09,.026);tone(190,.16,"square",.032,.02,-70);tone(120,.14,"triangle",.022,.12,-40);}
    else if(name==="fail-chase"){tone(300,.1,"sawtooth",.03,0,-90);tone(226,.12,"sawtooth",.028,.09,-70);tone(168,.18,"sawtooth",.024,.19,-50);}
    else if(name==="fail-signal"){noise(.16,.024);tone(410,.09,"square",.026,0,-190);tone(300,.13,"square",.022,.1,240);}
    else if(name==="fail-forge"){tone(260,.07,"square",.034,0,-40);noise(.11,.02,.04);tone(140,.2,"triangle",.028,.08,-45);}
    else if(name==="fail-lunch"){tone(360,.08,"triangle",.028,0,-130);tone(240,.11,"sine",.022,.07,-90);}
    else if(name==="fail-spark"){noise(.1,.018);tone(600,.14,"sine",.026,0,-400);}
    else if(name==="fail-power"){tone(200,.1,"square",.034,0,-60);noise(.08,.022,.02);}
    else if(name==="win-air"){[660,880,1100].forEach((f,i)=>tone(f,.11,"sine",.026,i*.045,80));}
    else if(name==="win-forge"){tone(330,.06,"square",.03);[520,780].forEach((f,i)=>tone(f,.09,"triangle",.026,.05+i*.05,60));}
    else if(name==="win-chase"){[590,740,990].forEach((f,i)=>tone(f,.07,"square",.028,i*.04,120));}
    else if(name==="win-signal"){[440,660,880].forEach((f,i)=>tone(f,.1,"sine",.026,i*.05,60));noise(.05,.008,.14);}
    else if(name==="win-lunch"){tone(620,.055,"triangle",.026);tone(830,.07,"triangle",.024,.05);noise(.04,.01,.02);}
    else if(name==="win-drop"){[500,700,940,1180].forEach((f,i)=>tone(f,.08,"square",.026,i*.038,90));}
    else tone(420,.05,"square",.03);
  }

  // Per-mode audio identity without eleven bespoke sound banks: the family a
  // mode belongs to picks the signature, and anything unmapped keeps the old
  // generic tone rather than going silent.
  function haptic(pattern = 15) {
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
  }

  const MUSIC_TRACKS = {
    origin:{tempo:560,lead:[64,null,67,null,71,null,67,null],bass:[40,null,null,null,43,null,null,null],wave:"sine"},
    home:{tempo:430,lead:[64,67,71,67,62,66,69,66],bass:[40,null,47,null,38,null,45,null],wave:"triangle"},
    sleep:{tempo:720,lead:[59,null,62,null,66,null,62,null],bass:[35,null,null,null,42,null,null,null],wave:"sine"},
    arcade:{tempo:250,lead:[64,67,71,76,71,67,69,73],bass:[40,null,40,null,45,null,47,null],wave:"square"},
    closet:{tempo:390,lead:[69,null,73,76,73,null,71,68],bass:[45,null,52,null,44,null,51,null],wave:"triangle"},
    journal:{tempo:610,lead:[60,null,64,null,67,null,71,null],bass:[36,null,null,null,43,null,null,null],wave:"sine"},
    event:{tempo:330,lead:[72,71,67,null,74,72,69,null],bass:[43,null,38,null,45,null,40,null],wave:"triangle"},
    forest:{tempo:480,lead:[67,null,69,72,null,69,65,null],bass:[43,null,null,50,null,null,45,null],wave:"triangle"},
    evolution:{tempo:190,lead:[52,59,64,71,76,79,83,88],bass:[28,null,35,null,40,null,47,null],wave:"sawtooth"},
    capsule:{tempo:245,lead:[60,64,67,72,76,79,84,88],bass:[36,null,43,null,40,null,47,null],wave:"triangle"},
    shadow:{tempo:520,lead:[55,null,58,54,null,61,57,null],bass:[31,null,null,38,null,null,30,null],wave:"sine"},
    retro:{tempo:145,lead:[64,67,71,76,79,76,71,67],bass:[40,40,47,47,45,45,52,52],wave:"square"},
    visitor:{tempo:300,lead:[67,71,74,79,76,74,71,69],bass:[43,null,50,null,45,null,52,null],wave:"triangle"},
  };

  function midiFrequency(note){ return 440 * Math.pow(2,(note-69)/12); }

  function musicTone(note,duration=.14,volume=.04,delay=0,type="triangle"){
    if(!state?.settings?.music || note == null)return;
    const ctx=ensureAudio(); if(!ctx)return;
    if(!musicGainNode){ musicGainNode=ctx.createGain(); musicGainNode.gain.value=currentMusicGain(); musicGainNode.connect(ctx.destination); }
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type; osc.frequency.value=midiFrequency(note);
    gain.gain.setValueAtTime(volume,ctx.currentTime+delay);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+duration);
    osc.connect(gain).connect(musicGainNode); osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+duration+.02);
  }

  function musicBeat(){
    if(!musicUnlocked || !state?.settings?.music || document.hidden)return;
    const track=MUSIC_TRACKS[musicScene]||modeMusicTracks.get(musicScene)||MUSIC_TRACKS.home;
    const i=musicStep%track.lead.length;
    const lead=track.lead[i], bass=track.bass[i%track.bass.length];
    // A game mode's adaptive track decides its own notes each step.
    if(typeof track.beat==="function"){ try{ track.beat(musicStep,(note,duration,volume,delay,type)=>musicTone(note,duration,volume,delay,type)); }catch(error){ console.warn("Rizo mode music failed",error); } musicStep+=1; return; }
    if(lead!=null) musicTone(lead,track.tempo/1000*.72,.026,0,track.wave);
    if(bass!=null) musicTone(bass,track.tempo/1000*1.45,.018,0,"triangle");
    if((musicScene==="arcade"||musicScene.startsWith("mini-"))&&i%2===0) musicTone(84, .025, .006, 0, "square");
    musicStep+=1;
  }

  function setMusicGain(value, seconds=.18) {
    const ctx=ensureAudio(); if(!ctx||!musicGainNode)return;
    const t=ctx.currentTime;
    musicGainNode.gain.cancelScheduledValues(t);
    musicGainNode.gain.setValueAtTime(Math.max(.001,musicGainNode.gain.value||.001),t);
    musicGainNode.gain.linearRampToValueAtTime(Math.max(.001,value),t+seconds);
  }

  function duckMusic(duration=800,level=.13) {
    if(!musicGainNode||!state?.settings?.music)return;
    setMusicGain(Math.min(currentMusicGain(),Math.max(.001,level*musicVolume())),.08);
    const token=musicTransitionToken;
    setTimeout(()=>{if(token===musicTransitionToken&&state?.settings?.music)setMusicGain(currentMusicGain(),.28);},duration);
  }

  function stopMusic(fadeMs=220){
    clearInterval(musicTimer); musicTimer=null;
    clearTimeout(musicStopTimer);
    if(musicGainNode)setMusicGain(.001,fadeMs/1000);
    musicStopTimer=setTimeout(()=>{musicScene="";},fadeMs+20);
  }

  function sceneMusicKey(){
    if(activeMusicOverride)return activeMusicOverride;
    if(mini?.active)return `mini-${mini.mode}`;
    if(el.originScreen && !el.originScreen.hidden)return "origin";
    if(currentView==="home"&&state?.pet?.sleeping)return "sleep";
    return currentView||"home";
  }

  // Adaptive tracks lent by game modes: { id, tempo, lead[], bass[], beat(step, play) }.
  const modeMusicTracks = new Map();
  function startMusicForScene(scene,force=false){
    // A training game that plays its own music (Ember Beat) silences the hub's.
    if(scene.startsWith("mini-")&&trainingGame(scene.slice(5))?.music===false){clearInterval(musicTimer);musicTimer=null;musicScene=scene;return;}
    if(adAudioHolds || !musicUnlocked || !state?.settings?.music || document.hidden){ if(!state?.settings?.music) stopMusic(); return; }
    const key=MUSIC_TRACKS[scene]||modeMusicTracks.has(scene)?scene:"home";
    if(!force&&musicScene===key&&musicTimer)return;
    const token=++musicTransitionToken;
    clearInterval(musicTimer); musicTimer=null; clearTimeout(musicStopTimer);
    if(musicGainNode)setMusicGain(.001,.12);
    const begin=()=>{
      if(token!==musicTransitionToken||!state?.settings?.music)return;
      musicScene=key; musicStep=0; musicBeat();
      musicTimer=setInterval(musicBeat,(MUSIC_TRACKS[key]||modeMusicTracks.get(key)).tempo);
      setMusicGain(currentMusicGain(),.28);
    };
    if(musicScene && !state.settings.reducedMotion)setTimeout(begin,130); else begin();
  }

  function syncMusic(force=false){ document.body.dataset.rizoSound = (state?.settings?.sound && Number(state.settings.soundVolume) > 0) || (state?.settings?.music && Number(state.settings.musicVolume) > 0) ? "on" : "off"; startMusicForScene(sceneMusicKey(),force); }

  function unlockMusic(){
    musicUnlocked=true;
    ensureAudio();
    syncMusic(true);
  }

  function buildRain() {
    el.rainLayer.innerHTML = "";
    for (let index = 0; index < 58; index += 1) {
      const drop = document.createElement("i");
      drop.className = "rain-drop";
      drop.style.left = `${Math.random() * 120 - 10}%`;
      drop.style.animationDuration = `${.55 + Math.random() * .55}s`;
      drop.style.animationDelay = `${-Math.random() * 2}s`;
      drop.style.opacity = String(.12 + Math.random() * .55);
      el.rainLayer.appendChild(drop);
    }
    for (let index = 0; index < 13; index += 1) {
      const dust = document.createElement("i");
      dust.className = "dust";
      dust.style.left = `${8 + Math.random() * 84}%`;
      dust.style.top = `${18 + Math.random() * 58}%`;
      dust.style.animationDelay = `${Math.random() * 4}s`;
      el.weatherFx.appendChild(dust);
    }
  }

  function typeStory(text) {
    clearInterval(storyTimer);
    el.storyText.textContent = "";
    let index = 0;
    storyTimer = setInterval(() => {
      el.storyText.textContent += text[index] || "";
      index += 1;
      if (index >= text.length) clearInterval(storyTimer);
    }, state.settings?.reducedMotion ? 1 : 24);
  }

  function renderOriginStep() {
    const step = ORIGIN_STEPS[originIndex];
    el.storySpeaker.textContent = step.speaker;
    typeStory(step.text);
    el.storyChoices.innerHTML = "";
    el.storyNext.hidden = originIndex === ORIGIN_STEPS.length - 1;
    if (originIndex === ORIGIN_STEPS.length - 1) {
      el.storyChoices.innerHTML = `<button class="story-choice" data-origin-choice="leave">WALK AWAY</button><button class="story-choice primary" data-origin-choice="take">PICK IT UP</button>`;
    }
  }

  function originChoice(choice) {
    if (choice === "leave") {
      el.storySpeaker.textContent = "YOU";
      typeStory("You made it six steps before the crying got quieter. Somehow that felt worse.");
      el.storyChoices.innerHTML = `<button class="story-choice primary" data-origin-choice="take" style="grid-column:1/-1">GO BACK AND TAKE IT</button>`;
      return;
    }
    completeOrigin();
  }

  function completeOrigin() {
    state.introSeen = true;
    if (!state.memories.some(item => item.title === "THE EGG IN THE RAIN")) addMemory("THE EGG IN THE RAIN", "You found a warm blue-spotted egg crying beneath the roots and took it home.", "☂");
    checkAchievements();
    saveState(true);
    el.originScreen.style.transition = "opacity .6s";
    el.originScreen.style.opacity = "0";
    setTimeout(() => {
      el.originScreen.hidden = true;
      el.rainLayer.hidden = true;
      el.gameShell.hidden = false;
      el.originScreen.style.opacity = "1";
      renderAll();
      say("...HELLO?", 2600);
      schedulePetBehavior(6000);
      requestPersistentStorage();
    }, 620);
  }

  function replayOrigin() {
    closeSheet();
    changeView("home");
    originIndex = 0;
    el.skipOrigin.hidden = false;
    el.originScreen.hidden = false;
    el.rainLayer.hidden = false;
    el.gameShell.hidden = true;
    renderOriginStep();
  }

  async function requestPersistentStorage() {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch (error) { /* Persistence request is optional. */ }
  }

  async function shareRizo() {
    const pet = state.pet;
    const variant = currentVariant();
    const text = pet.stage === "egg"
      ? `I found a mystery egg in RIZO LIFE. It is ${Math.floor(pet.hatch)}% hatched.`
      : `${pet.name} is a Gen ${pet.generation || 1} ${pet.stage.toUpperCase()} ${variant.name}, raised into ${displayFormInfo(pet).name}, with ${Math.floor(pet.bond)} bond.`;
    try {
      if (navigator.share) await navigator.share({ title: "RIZO LIFE by Rizo Apparel", text: `${text} Play it, then shop the real brand at rizo.store.` });
      else { await navigator.clipboard.writeText(`${text} • RIZO LIFE by Rizo Apparel • rizo.store`); toast("RIZO STATS COPIED"); }
    } catch (error) { /* Sharing can be cancelled. */ }
  }

  function keeperRecoveryCode(){const savedAt=now(),envelope=buildStateEnvelope(state,savedAt);return encodeGardenCode({...envelope,v:VERSION,exportedAt:savedAt});}
  function readPreRecoveryDecoded(){
    try{const raw=localStorage.getItem(`${SAVE_KEY}:pre-recovery`);if(!raw)return null;const decoded=decodeStateText(raw);return ["verified","migrated","sanitized"].includes(decoded.status)&&decoded.state?decoded:null;}catch(error){return null;}
  }
  function readPreRecoveryBackup(){return readPreRecoveryDecoded()?.state||null;}
  function showKeeperRecoveryPreview(recovered,source="KEEPER CODE",schema="?",modes={}){
    const pet=recovered.pet,variant=VARIANTS.find(item=>item.id===(pet.variant||pet.hiddenVariant))||VARIANTS[0];
    window.__pendingKeeperRecovery=recovered;pendingRecoveryModes=modes||{};
    showModal(`<div class="modal-card keeper-recovery-preview"><small>VALID ${escapeHTML(source)} • SCHEMA ${escapeHTML(String(schema||"?"))}</small><div class="keeper-recovery-pet">${petMarkup({pet,extraClass:"recovery-rizo",context:"thumbnail",label:pet.name})}</div><h2>${escapeHTML(pet.name||"MYSTERY EGG")}</h2><p>${escapeHTML(variant.name)} • ${escapeHTML(String(pet.stage||"egg").toUpperCase())} • GEN ${Math.max(1,Number(pet.generation)||1)}<br>R ${Math.floor(recovered.wallet?.embers||0)} • ${Math.floor(recovered.wallet?.sparks||0)} SPARKS</p><p class="big-line">REPLACE THIS DEVICE'S CURRENT TIMELINE?</p><div class="modal-buttons"><button data-close-modal>CANCEL</button><button class="primary" data-apply-recovery>RESTORE KEEPER</button></div></div>`);
  }
  function openKeeperRecovery(){
    window.__pendingKeeperRecovery=null;
    const backup=readPreRecoveryBackup();
    showModal(`<div class="modal-card keeper-recovery-modal"><small>KEEPER RECOVERY</small><h2>PASTE YOUR KEEPER CODE.</h2><p>The code is fully validated before replacement. When you restore, this device writes a one-step backup of the timeline it is replacing.</p><textarea id="keeperRecoveryInput" class="visit-code-output" maxlength="250000" placeholder="PASTE COMPLETE KEEPER CODE"></textarea><div class="modal-buttons"><button data-close-modal>CANCEL</button><button data-paste-recovery>PASTE CLIPBOARD</button><button data-copy-recovery>COPY CURRENT CODE</button>${backup?'<button data-preview-pre-recovery>RESTORE PREVIOUS TIMELINE</button>':''}<button class="primary" data-preview-recovery>CHECK CODE</button></div></div>`);
  }
  async function pasteKeeperRecoveryCode(){const input=$("#keeperRecoveryInput");if(!input)return;try{const text=await navigator.clipboard.readText();if(!text.trim())throw new Error("empty");input.value=text.trim();input.focus();toast("KEEPER CODE PASTED");}catch(error){input.focus();toast("PRESS AND HOLD THE BOX, THEN TAP PASTE");}}
  async function copyKeeperRecoveryCode(){const code=keeperRecoveryCode();try{await navigator.clipboard.writeText(code);state.meta.lastBackupAt=now();saveState(true);toast("KEEPER RECOVERY CODE COPIED");}catch(error){const input=$("#keeperRecoveryInput");if(input){input.value=code;input.select();}toast("CODE READY TO COPY");}}
  function previewKeeperRecoveryCode(raw){
    try{const data=decodeGardenCode(raw);if(data?.app!=="RIZO LIFE"||!data.state)throw new Error("bad recovery");const decoded=decodeStatePayload(data);if(decoded.status==="future"){toast("THAT KEEPER CODE IS FROM A NEWER RIZO.GAME • UPDATE FIRST");return;}if(decoded.status==="invalid")throw new Error("bad recovery");if(decoded.status==="sanitized")recordSaveValidationWarning("keeper-code-sanitized",{});showKeeperRecoveryPreview(decoded.state,decoded.status==="verified"?"VERIFIED KEEPER SAVE":"SANITIZED KEEPER SAVE",data.v||"?",decoded.modes);}catch(error){window.__pendingKeeperRecovery=null;toast("THAT KEEPER CODE IS INVALID OR INCOMPLETE");sfx("no");}
  }
  function previewPreRecoveryBackup(){const decoded=readPreRecoveryDecoded();if(!decoded){toast("NO PREVIOUS TIMELINE IS STORED");sfx("no");return;}showKeeperRecoveryPreview(decoded.state,"DEVICE BACKUP",decoded.state.version||VERSION,decoded.modes);}
  function applyKeeperRecovery(){const recovered=window.__pendingKeeperRecovery;if(!recovered)return;try{localStorage.setItem(`${SAVE_KEY}:pre-recovery`,JSON.stringify(buildStateEnvelope(state)));}catch(error){}clearModeRuns();state=recovered;modeSlices=pendingRecoveryModes||{};pendingRecoveryModes={};window.__pendingKeeperRecovery=null;prepareModeSlices();saveState(true);closeModal();changeView("home");renderAll();toast("KEEPER TIMELINE RESTORED");sfx("legendary");celebrate();}

  function exportSave() {
    const savedAt=now(),payload = JSON.stringify({...buildStateEnvelope(state,savedAt),version:VERSION,exportedAt:savedAt}, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rizo-life-${state.player.keeperId.slice(-4).toLowerCase()}-${dateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    state.meta.lastBackupAt = now();
    saveState(true);
    toast("SAVE EXPORTED");
  }

  async function importSave(file) {
    try {
      if (!file || file.size > 2_000_000) throw new Error("Save file is too large");
      const parsed = JSON.parse(await file.text());
      const incoming = parsed.state || parsed;
      if (!incoming.pet || !incoming.player) throw new Error("Not a Rizo save");
      const decoded=decodeStatePayload(parsed);
      if(decoded.status==="invalid")throw new Error("Invalid Rizo save");
      if(decoded.status==="future"){toast("THAT SAVE IS FROM A NEWER RIZO.GAME • UPDATE FIRST");return;}
      // The timeline being replaced stays restorable from Keeper Recovery.
      try{localStorage.setItem(`${SAVE_KEY}:pre-recovery`,JSON.stringify(buildStateEnvelope(state)));}catch(error){}
      clearModeRuns();
      state = decoded.state;
      modeSlices = decoded.modes || {};
      prepareModeSlices();
      if(decoded.status==="sanitized")recordSaveValidationWarning("import-sanitized",{});
      saveState(true);
      closeSheet();
      closeModal();
      renderAll();
      toast(decoded.status==="sanitized"?"SAVE IMPORTED • SANITIZED":"SAVE IMPORTED");
    } catch (error) {
      toast("THAT FILE IS NOT A VALID RIZO TIMELINE");
    } finally {
      el.importSaveInput.value = "";
    }
  }

  function copySummary() {
    const pet = state.pet;
    const variant = currentVariant();
    const summary = `RIZO LIFE
Keeper: ${state.player.keeperId}
Pet: ${pet.name}
Variant: ${pet.stage === "egg" ? "Mystery Egg" : variant.name}
Stage: ${pet.stage}
Generation: ${pet.generation || 1}
Form: ${displayFormInfo(pet).name}
Alignment: ${alignmentInfo(pet).name}
Level: ${pet.stage === "egg" ? 0 : levelForXP(pet.xp)}
Bond: ${Math.floor(pet.bond)}
Skills: ${SKILLS.map(skill=>`${skill.name} ${Math.floor(pet.skills?.[skill.id]||0)}/${Math.floor(pet.genes?.[skill.id]||100)}`).join(" • ")}
Taps: ${state.meta.totalTaps}
Walks: ${state.meta.totalWalks || 0}
Rebirths: ${state.meta.rebirths || 0}
Bond Eggs: ${state.meta.bondEggs || 0}
Lineage Trait: ${(pet.lineageTrait || "balanced").toUpperCase()}
Treasures: ${Object.values(state.treasures || {}).filter(Boolean).length}/${WALK_TREASURES.length}
Streak: ${state.player.streak}`;
    navigator.clipboard?.writeText(summary).then(() => toast("STATS COPIED")).catch(() => toast("COPY FAILED"));
  }

  function resetSave() {
    if (!confirm("Delete every Rizo, unlock, memory, and ember?")) return;
    if (!confirm("Really? This is the dramatic second confirmation.")) return;
    // Block first: the unload handler saves, and used to write the old save back.
    blockSaving("reset");
    for (const key of [SAVE_V2_KEY, SAVE_V2_BACKUP_KEY, SAVE_KEY, SAVE_BACKUP_KEY, LEGACY_KEY, ...LEGACY_DEFENSE_CHECKPOINT_KEYS, `${SAVE_KEY}:pre-recovery`, ...saveQuarantineKeys(), ...storageKeysWithPrefix(MODE_RUN_PREFIX), ...storageKeysWithPrefix(LEGACY_MAP_SEEN_PREFIX)]) {
      try { localStorage.removeItem(key); } catch (error) {}
    }
    location.reload();
  }

  // ===== RIZO HOUSE: passive rooms for extra Rizos =====
  // The state key and renderFarm() name stay intact so old saves and shared view routing remain compatible.
  function defaultFarmState() {
    return {
      roster: [],
      unlockedRooms: [0],
      activeRoom: 0,
      totalAdoptions: 0,
      totalReleased: 0,
      lastAdoptionAt: 0,
      featureUnlocked: false,
      unlockSeen: false,
      plots: [], materials: 0, totalHarvests: 0, totalCatches: 0, lastEncounterAt: 0
    };
  }

  function houseResidents(roomId = activeHouseRoom) {
    return state.farm.roster.filter(pet => Number(pet.homeRoom) === Number(roomId));
  }

  function houseCapacity() {
    return state.farm.unlockedRooms.length * HOUSE_ROOM_CAPACITY;
  }

  function firstOpenHouseRoom() {
    return state.farm.unlockedRooms.find(roomId => houseResidents(roomId).length < HOUSE_ROOM_CAPACITY) ?? null;
  }

  function houseHasSpace() {
    return firstOpenHouseRoom() !== null && state.farm.roster.length < HOUSE_MAX_TOTAL;
  }

  function createCapsulePet(rolled, tier) {
    const stageId = ["MYTHIC", "LEGENDARY", "SECRET"].includes(tier) ? "beast" : ["RARE", "EPIC"].includes(tier) ? "teen" : "kid";
    const stage = STAGES.find(item => item.id === stageId) || STAGES[1];
    const number = state.meta.nextPetNumber || 1;
    state.meta.nextPetNumber = number + 1;
    const skillFloor = Math.max(0, Math.round((stage.minStats / 5) * 0.7));
    const skills = {};
    for (const skill of SKILLS) skills[skill.id] = skillFloor + Math.floor(Math.random() * 4);
    return {
      id: uid("PET"), number,
      name: `${rolled.name.split(" ")[0]} ${String(number).padStart(2, "0")}`,
      stage: stage.id, hiddenVariant: rolled.id, variant: rolled.id,
      createdAt: now(), bornAt: now(), lastTick: now(),
      lifespanDays: 42 + Math.floor(Math.random() * 25),
      hatch: 100, xp: stage.minXP, level: 0, bond: stage.minBond,
      strength: 0, skills, genes: createGenes(), alignment: 0,
      careProfile: { kind: 0, wild: 0, balanced: 0, foods: {}, games: {} },
      form: "balanced", formHistory: [], generation: 1, lineageTrait: null, lastTrainedSkill: "stamina",
      resting: false, elder: false, hype: 0, taps: 0,
      personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
      mutation: rollMutation().id, overstimulation: 0,
      health: 100, hunger: 80, mood: 78, energy: 85, hygiene: 82,
      sleeping: false, sick: false, alive: true, deathReason: null,
      accessory: "none", room: "rain", shame: false, graceUntil: null, lastFreeSnack: 0,
      fromCapsule: true, capsuleTier: tier, caughtAt: now(), homeRoom: 0
    };
  }

  function sendCapsulePetToFarm(rolled, tier, { allowOverflow = false } = {}) {
    const roomId = firstOpenHouseRoom();
    const pet = createCapsulePet(rolled, tier);
    if (roomId === null || state.farm.roster.length >= HOUSE_MAX_TOTAL) {
      const shardValue = { COMMON: 6, UNCOMMON: 10, RARE: 18, EPIC: 28, MYTHIC: 45, LEGENDARY: 80, SECRET: 150 }[tier] || 10;
      if (allowOverflow) {
        state.wallet.shards += shardValue;
        addMemory("HOUSE FULL", `${pet.name} arrived through a free signal, but every room was full. It left ${shardValue} Prism Shards.`, "⌂");
        return { overflow: true, shardValue };
      }
      return { overflow: true, shardValue: 0 };
    }
    pet.homeRoom = roomId;
    state.farm.roster.push(pet);
    state.farm.totalAdoptions = (state.farm.totalAdoptions || 0) + 1;
    state.farm.lastAdoptionAt = now();
    activeHouseRoom = roomId;
    state.farm.activeRoom = roomId;
    addMemory("NEW HOUSE RIZO", `${pet.name}, a ${rolled.name} Rizo, moved into ${HOUSE_ROOMS[roomId].name}.`, "⌂");
    return { overflow: false, pet };
  }

  function buyHouseRoom(roomId) {
    if (!houseIsUnlocked()) { toast(`RIZO HOUSE UNLOCKS AT LEVEL ${HOUSE_UNLOCK_LEVEL}`); sfx("no"); return; }
    const room = HOUSE_ROOMS.find(item => item.id === roomId);
    if (!room || state.farm.unlockedRooms.includes(roomId)) { selectHouseRoom(roomId); return; }
    const nextLocked = HOUSE_ROOMS.find(item => !state.farm.unlockedRooms.includes(item.id));
    if (!nextLocked || nextLocked.id !== roomId) { toast("UNLOCK ROOMS IN ORDER"); sfx("no"); return; }
    if (state.wallet.embers < room.cost) { toast(`NEED R ${room.cost} FOR ${room.name}`); sfx("no"); return; }
    state.wallet.embers -= room.cost;
    state.farm.unlockedRooms.push(roomId);
    state.farm.unlockedRooms.sort((a,b)=>a-b);
    activeHouseRoom = roomId;
    state.farm.activeRoom = roomId;
    addMemory("HOUSE EXPANDED", `Unlocked ${room.name} for R ${room.cost}.`, "⌂");
    saveState(true); renderFarm(); renderSharedUI();
    toast(`${room.name} UNLOCKED`); sfx("level"); celebrate();
  }

  function selectHouseRoom(roomId) {
    if (!state.farm.unlockedRooms.includes(roomId)) return;
    activeHouseRoom = roomId;
    state.farm.activeRoom = roomId;
    saveState(); renderFarm();
  }

  function moveHouseRoom(direction) {
    const ids = state.farm.unlockedRooms;
    const index = Math.max(0, ids.indexOf(activeHouseRoom));
    const next = ids[index + direction];
    if (next !== undefined) selectHouseRoom(next);
  }

  function swapFarmPet(rosterIndex) {
    const target = state.farm.roster[rosterIndex];
    if (!target) return;
    if (mini.active || worldEventOpen || el.bottomSheet?.classList.contains("show")) return;
    if (state.pet.stage === "egg") { toast("HATCH YOUR EGG BEFORE SWAPPING"); return; }
    if (!state.pet.alive) { toast("REVIVE YOUR CURRENT RIZO FIRST"); return; }
    const outgoing = state.pet;
    outgoing.homeRoom = target.homeRoom;
    state.farm.roster.splice(rosterIndex, 1, outgoing);
    state.pet = target;
    delete state.pet.homeRoom;
    // House residents live passively, so the clock starts when they come back.
    state.pet.lastTick = now();
    processElapsedTime();
    if (state.pet.alive && state.pet.health <= 0) enterRecoveryState("neglect", true);
    updateStage(); checkAchievements();
    addMemory("HOUSE SWAP", `${outgoing.name} moved into ${HOUSE_ROOMS[outgoing.homeRoom].name}. ${target.name} is now the active Rizo.`, "⌂");
    closeModal(); saveState(true); renderAll();
    toast(`${target.name} IS NOW YOUR ACTIVE RIZO`); sfx("ui"); haptic(20);
  }

  function releaseFarmPet(rosterIndex) {
    const pet = state.farm.roster[rosterIndex];
    if (!pet) return;
    const variant = VARIANTS.find(item => item.id === pet.variant) || VARIANTS[0];
    showModal(`<div class="modal-card release-scene"><small>THE FRONT DOOR</small><h2>LET ${escapeHTML(pet.name)} GO?</h2><div class="capsule-stage" style="--reveal-color:${variant.color}"><div class="rarity-reveal"><img src="${variant.sprite}" alt="${escapeHTML(variant.name)}"></div></div><p class="release-line">${escapeHTML(pet.name)} stands by the door without making it dramatic.</p><p class="release-line">You make it dramatic enough for both of you.</p><p class="release-line">This isn't a delete. It's a life outside this house.</p>${modeJourneyNote(pet.id)}<div class="modal-buttons"><button data-close-modal>KEEP THEM HOME</button><button class="primary" data-confirm-release="${rosterIndex}">SET THEM FREE</button></div></div>`);
    sfx("talk");
  }

  function confirmReleaseFarmPet(rosterIndex) {
    const pet = state.farm.roster[rosterIndex];
    if (!pet) return;
    state.farm.roster.splice(rosterIndex, 1);
    state.farm.totalReleased = (state.farm.totalReleased || 0) + 1;
    addMemory("SET FREE", `${pet.name} left ${HOUSE_ROOMS[pet.homeRoom]?.name || "the Rizo House"} and returned to the forest.`, "⌂");
    closeModal(); saveState(true); renderFarm(); renderSharedUI();
    toast(`${pet.name} IS FREE`); sensoryBurst("⌂", "#9eff75", 16); sfx("ui");
  }

  function houseThought(pet, slot, roomId) {
    const lines = [
      `${pet.name}: THIS ROOM HAS RULES?`,
      `${pet.name}: I CLAIMED THIS CORNER.`,
      `${pet.name}: THE DEN RIZO THINKS THEY'RE FAMOUS.`,
      `${pet.name}: WE SHOULD MOVE THE COUCH.`,
      `${pet.name}: I HEARD A CAPSULE OUTSIDE.`,
      `${pet.name}: ROOM ${roomId + 1} HAS LORE.`
    ];
    return lines[(slot + roomId * 2 + pet.number) % lines.length];
  }

  function houseResidentMarkup(pet, rosterIndex, slot, roomId) {
    const variant = VARIANTS.find(item => item.id === pet.variant) || VARIANTS[0];
    const pos = HOUSE_SLOT_POSITIONS[slot] || HOUSE_SLOT_POSITIONS[0];
    return `<button type="button" aria-label="View ${escapeHTML(pet.name)}" class="house-resident ${pos.pose}" data-house-pet-detail="${rosterIndex}" style="--resident-x:${pos.x}%;--resident-y:${pos.y}%;--resident-color:${variant.color};--resident-delay:${-(slot * 2.4 + roomId)}s"><span class="house-resident-life">${petMarkup({ pet, extraClass: "house-resident-pet", context: "card", label: `${pet.name}, resident of ${HOUSE_ROOMS[roomId].name}` })}<i class="house-resident-name">${escapeHTML(pet.name)}</i><span class="house-thought">${escapeHTML(houseThought(pet,slot,roomId))}</span></span></button>`;
  }

  function farmPetDetailModal(idx) {
    const pet = state.farm.roster[idx];
    if (!pet) return;
    const variant = VARIANTS.find(item => item.id === pet.variant) || VARIANTS[0];
    const stage = STAGES.find(item => item.id === pet.stage) || STAGES[0];
    const room = HOUSE_ROOMS[pet.homeRoom] || HOUSE_ROOMS[0];
    showModal(`<div class="modal-card farm-pet-detail"><small>${escapeHTML(room.name)} RESIDENT</small><h2>${escapeHTML(pet.name)}</h2><div class="capsule-stage" style="--reveal-color:${variant.color}">${petMarkup({pet,extraClass:"house-detail-pet",context:"cutscene",label:pet.name})}</div><p><span style="color:${variant.color}">${escapeHTML(variant.name)}</span> • ${stage.name} • BOND ${Math.floor(pet.bond)}</p><p class="house-detail-note">House Rizos live passively. Swap one into the Den when you want to care for or train it.</p><div class="modal-buttons"><button data-close-modal>NOT NOW</button><button data-release-farm-pet="${idx}">SET FREE</button><button class="primary" data-farm-swap="${idx}">MAKE ACTIVE</button></div></div>`);
    sfx("ui");
  }

  function houseRoomMood(count) {
    return ["QUIET", "SETTLING IN", "TALKING", "FULL CHAOS"][clamp(count, 0, 3)];
  }

  function renderLockedHouse() {
    const level = state.pet.stage === "egg" ? 0 : levelForXP(state.pet.xp);
    const basicsDone = state.player.tutorialStep >= 5 || state.player.tutorialDismissed;
    const progress = clamp(state.pet.xp / HOUSE_UNLOCK_XP * 100);
    el.farmContent.innerHTML = `<section class="house-lock-screen"><div class="house-lock-kicker">FUTURE FEATURE // LEVEL ${HOUSE_UNLOCK_LEVEL}</div><div class="house-locked-scene"><div class="house-lock-rain"></div><div class="house-lock-door"><i></i><b>⌂</b><span>ROOM 1</span></div><div class="house-lock-shadow shadow-one"></div><div class="house-lock-shadow shadow-two"></div></div><h1>RAISE ONE RIZO.<br>THEN OPEN THE HOUSE.</h1><p>The game starts with one relationship, not a collection menu. Once your active Rizo reaches Level ${HOUSE_UNLOCK_LEVEL}, the spare room opens and expensive new Rizos become available.</p><div class="house-unlock-checklist"><article class="${basicsDone ? "done" : ""}"><span>${basicsDone ? "✓" : "01"}</span><div><b>LEARN THE BASICS</b><small>Feed, play, and open the Journal.</small></div></article><article class="${level >= HOUSE_UNLOCK_LEVEL ? "done" : ""}"><span>${level >= HOUSE_UNLOCK_LEVEL ? "✓" : "02"}</span><div><b>REACH LEVEL ${HOUSE_UNLOCK_LEVEL}</b><small>Current Level ${level} • ${Math.floor(state.pet.xp)} / ${HOUSE_UNLOCK_XP} XP</small></div></article></div><div class="house-lock-progress"><i style="width:${progress}%"></i></div><button type="button" data-open-care-guide>OPEN KEEPER GUIDE</button></section>`;
  }

  function renderFarm() {
    if (!el.farmContent) return;
    if (!houseIsUnlocked()) { renderLockedHouse(); return; }
    const unlocked = state.farm.unlockedRooms;
    if (!unlocked.includes(activeHouseRoom)) activeHouseRoom = unlocked.includes(state.farm.activeRoom) ? state.farm.activeRoom : unlocked[0];
    state.farm.activeRoom = activeHouseRoom;
    const room = HOUSE_ROOMS[activeHouseRoom] || HOUSE_ROOMS[0];
    const residents = state.farm.roster.map((pet,index)=>({pet,index})).filter(item=>Number(item.pet.homeRoom)===activeHouseRoom);
    const roomIndex = unlocked.indexOf(activeHouseRoom);
    const prevDisabled = roomIndex <= 0;
    const nextDisabled = roomIndex >= unlocked.length - 1;
    const mood = houseRoomMood(residents.length);
    const residentScene = residents.length
      ? residents.map((item,slot)=>houseResidentMarkup(item.pet,item.index,slot,activeHouseRoom)).join("")
      : `<div class="house-empty"><div class="empty-rug"></div><b>THE ROOM IS WAITING.</b><span>Adopt a Rizo when earning R ${HOUSE_ADOPTION_COST} feels worth spending.</span></div>`;
    const roomButtons = HOUSE_ROOMS.map(item => {
      const open = unlocked.includes(item.id);
      const active = item.id === activeHouseRoom;
      return `<button type="button" class="house-room-chip ${open ? "unlocked" : "locked"} ${active ? "active" : ""}" ${open ? `data-house-room="${item.id}"` : `data-buy-house-room="${item.id}"`}><span>${item.icon}</span><b>${item.short}</b><small>${open ? `${houseResidents(item.id).length}/${HOUSE_ROOM_CAPACITY}` : `LOCKED • R ${item.cost}`}</small></button>`;
    }).join("");
    const nextLocked = HOUSE_ROOMS.find(item => !unlocked.includes(item.id));
    const canAffordAdoption = houseHasSpace() && state.wallet.embers >= HOUSE_ADOPTION_COST;
    const adoptClass = canAffordAdoption ? "" : 'class="short-on-embers"';
    const expandCard = nextLocked ? `<section class="house-expand-card"><div><small>NEXT ROOM</small><h3>${nextLocked.name}</h3><p>${nextLocked.copy}</p></div><button type="button" data-buy-house-room="${nextLocked.id}">UNLOCK • R ${nextLocked.cost}</button></section>` : `<section class="house-expand-card complete"><div><small>FULL PROPERTY</small><h3>EVERY ROOM IS YOURS.</h3><p>Twelve resident slots. That is already a concerning amount of Rizo.</p></div></section>`;
    const activePet = state.pet;
    const rebirthReady = canRebirth();
    const legacyCard = `<section class="stat-board legacy-board"><h3>LEGACY GARDEN</h3><p>${rebirthReady ? `${activePet.name} can become a Legacy Egg now. Cosmetics, collection and currency stay.` : `Reach Mature, 80 bond and 300 total training. Rebirth raises genetic caps and records this Rizo as an ancestor.`}</p><button class="wide-button ${rebirthReady ? "legacy-ready" : ""}" data-rebirth-info>${rebirthReady ? "CREATE LEGACY EGG" : "CHECK REBIRTH REQUIREMENTS"}</button><div class="legacy-list">${state.legacy.length ? state.legacy.slice(0,4).map(item=>`<span><b>${escapeHTML(item.name)}</b>${escapeHTML(item.formName || item.form || "TRUE FLAME")} • GEN ${item.generation || 1}</span>`).join("") : "<small>NO ANCESTORS YET.</small>"}</div></section>`;
    const visitCard = `<section class="stat-board social-board"><h3>GARDEN VISITS + BOND EGGS</h3><p>Swap Garden Codes with another Keeper. Visitors stay ten minutes. Mature friends can leave a Friendship Spark so the next Legacy Egg blends two bounded genetic lines.</p><div class="social-actions"><button data-copy-visit-code type="button">COPY MY GARDEN CODE</button><button data-open-visit type="button">VISIT WITH A CODE</button></div>${activeGardenVisitor()?`<div class="pairing-card"><span>VISITING NOW</span><b>${escapeHTML(activeGardenVisitor().name)} • ${escapeHTML(activeGardenVisitor().variantName)}</b><small>${escapeHTML(canSaveBondSeed().ok?"Teen+ and 30 Bond unlock a Friendship Spark.":canSaveBondSeed().reason)}</small><button data-pairing-spark type="button">${state.garden.bondSeed?"REPLACE BOND EGG DNA":"SAVE BOND EGG DNA"}</button></div>`:""}${state.garden.bondSeed?`<div class="bond-seed-card"><span>STORED FOR NEXT REBIRTH</span><b>♡ ${escapeHTML(state.garden.bondSeed.name)} + ${escapeHTML(activePet.name)}</b><small>GEN ${state.garden.bondSeed.generation} ${escapeHTML(state.garden.bondSeed.variantName || state.garden.bondSeed.variant)} genetics will be blended.</small><button data-clear-bond-seed type="button">CLEAR</button></div>`:""}<div class="visitor-history">${state.social.visitors.length ? state.social.visitors.slice(0,3).map(item=>`<span><b>${escapeHTML(item.name || "GUEST RIZO")}</b>${escapeHTML(item.variantName || "UNKNOWN")} • ${new Date(item.at).toLocaleDateString()}</span>`).join("") : "<small>NO VISITORS YET.</small>"}</div></section>`;
    el.farmContent.innerHTML = `<section class="house-section"><div class="house-den-shell"><div class="house-scene ${room.className}"><div class="house-sky"></div><div class="house-window"><i></i></div><div class="house-city"></div><div class="house-wall-mark"></div><div class="house-prop house-prop-left"></div><div class="house-prop house-prop-right"></div><div class="house-floor"></div><div class="house-room-light"></div><div class="house-ambient"></div><div class="house-scene-top"><div><small>RIZO HOUSE // ${room.short}</small><b>${room.name}</b></div><span><i></i>${mood}</span></div><button type="button" class="house-scene-arrow previous" data-house-prev ${prevDisabled ? "disabled" : ""} aria-label="Previous room">‹</button><button type="button" class="house-scene-arrow next" data-house-next ${nextDisabled ? "disabled" : ""} aria-label="Next room">›</button>${residentScene}<div class="house-scene-bottom"><div><strong>${residents.length}/${HOUSE_ROOM_CAPACITY} RIZOS</strong><span>${room.copy}</span></div><b>ROOM ${activeHouseRoom + 1}</b></div></div></div><div class="house-room-rail">${roomButtons}</div><p class="house-hint">This is Den part two: residents live here passively. Tap one to inspect it, swap it into the main Den, or set it free.</p><section class="house-property-actions"><section class="house-adoption-card"><div><small>ADOPT A REAL RIZO</small><h3>MYSTERY SIGNAL • R ${HOUSE_ADOPTION_COST}</h3><p>Expensive on purpose. A purchase creates a permanent resident and needs an open room slot.</p></div><button type="button" data-capsule="standard" ${adoptClass}>${houseHasSpace() ? `ADOPT • R ${HOUSE_ADOPTION_COST}` : "ROOMS FULL"}</button></section>${expandCard}</section><div class="house-stat-row"><span>RESIDENTS<b>${state.farm.roster.length}/${houseCapacity()}</b></span><span>ROOMS<b>${unlocked.length}/${HOUSE_ROOMS.length}</b></span><span>ACTIVE ROOM<b>${activeHouseRoom + 1}</b></span></div>${legacyCard}${visitCard}</section>`;
  }

  function handleDocumentClick(event) {
    // Pointer-up feeding closes the sheet before the browser emits its follow-up
    // click. Suppress that one ghost click so it cannot activate whatever button
    // was underneath the food tray (room nav, growth info, etc.). Keyboard clicks
    // still use the normal data-food-drag path because no pointer block is set.
    if (now() < feedClickBlockedUntil) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      return;
    }

    if(event.target.closest("[data-update-later]")){document.getElementById("rizoUpdateBar")?.setAttribute("hidden","");return;}
    if(event.target.closest("[data-update-now], [data-refresh-latest]")){forceReleaseRefresh();return;}

    const nav = event.target.closest("[data-nav]")?.dataset.nav;
    if (nav) { changeView(nav); return; }

    const need = event.target.closest("[data-need]")?.dataset.need;
    if (need) { openNeedAction(need); return; }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action) {
      if (action === "feed") openFoodSheet();
      if (action === "play") openPlaySheet();
      if (action === "clean") cleanPet();
      if (action === "sleep") toggleSleep();
      return;
    }

    const game = event.target.closest("[data-minigame]")?.dataset.minigame;
    if (game) { startMiniGame(game); return; }
    const modeId = event.target.closest("button[data-mode]")?.dataset.mode;
    if (modeId) { launchModeFromHub(modeId); return; }

    const shop = event.target.closest("[data-shop-tab]")?.dataset.shopTab;
    if (shop) {
      shopTab = shop;
      $$("[data-shop-tab]").forEach(button => { const active = button.dataset.shopTab === shop; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
      renderShopList();
      return;
    }

    const journal = event.target.closest("[data-journal-tab]")?.dataset.journalTab;
    if (journal) {
      journalTab = journal;
      $$("[data-journal-tab]").forEach(button => { const active = button.dataset.journalTab === journal; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
      renderJournal();
      return;
    }

    const dragFood = event.target.closest("[data-food-drag]")?.dataset.foodDrag;
    if (dragFood) { if (now() >= feedClickBlockedUntil) useFood(dragFood); return; }
    const food = event.target.closest("[data-food]")?.dataset.food;
    if (food) { useFood(food); return; }
    const capsule = event.target.closest("[data-capsule]")?.dataset.capsule;
    if (capsule) { closeModal(); openCapsule(capsule); return; }
    const expedition = event.target.closest("[data-expedition]")?.dataset.expedition;
    if (expedition) { startExpedition(expedition); return; }
    if (event.target.closest("[data-expedition-claim]")) { claimExpedition(); return; }
    if (event.target.closest("[data-head-pat]")) { headPat(); return; }
    const sheetGame = event.target.closest("[data-sheet-game]")?.dataset.sheetGame;
    if (sheetGame) { startMiniGame(sheetGame); return; }
    const moreAction = event.target.closest("[data-more-action]")?.dataset.moreAction;
    if (moreAction === "talk") { talkToPet(); return; }
    if (moreAction === "sleep") { closeSheet(); toggleSleep(); return; }
    const boostUse = event.target.closest("[data-use-boost]")?.dataset.useBoost;
    if (boostUse) { useBoost(boostUse); return; }

    const accessory = event.target.closest("[data-buy-accessory]")?.dataset.buyAccessory;
    if (accessory) { buyAccessory(accessory); return; }
    const room = event.target.closest("[data-buy-room]")?.dataset.buyRoom;
    if (room) { buyRoom(room); return; }
    const boost = event.target.closest("[data-buy-boost]")?.dataset.buyBoost;
    if (boost) { buyBoost(boost); return; }
    if (event.target.closest("[data-show-install]")) {
      closeSheet();
      window.RizoInstall?.show?.();
      return;
    }

    if (event.target.closest("[data-open-rename]")) { closeSheet(); showNameModal(false); return; }
    if (event.target.closest("[data-open-journal]")) { closeSheet(); changeView("journal"); return; }
    if (event.target.closest("[data-share-rizo]")) { shareRizo(); return; }
    const eventButton = event.target.closest("[data-world-event][data-event-choice]");
    if (eventButton) { resolveWorldEvent(eventButton.dataset.worldEvent, eventButton.dataset.eventChoice); return; }
    const resonance = event.target.closest("[data-resonance]")?.dataset.resonance;
    if (resonance) { setNextEggResonance(resonance); return; }
    if (event.target.closest("[data-copy-visit-code]")) { copyGardenCode(); return; }
    if (event.target.closest("[data-open-visit]")) { openVisitSheet(); return; }
    if (event.target.closest("[data-confirm-visit]")) { acceptGardenVisit($("#visitCodeInput")?.value || ""); return; }
    if (event.target.closest("[data-pairing-spark]")) { saveBondSeed(); return; }
    if (event.target.closest("[data-clear-bond-seed]")) { clearBondSeed(); return; }
    if (event.target.closest("[data-visitor-interact]")) { say(`${state.social.currentVisitor?.name || "THE VISITOR"}: ${["YOUR GARDEN IS NICE.","DO YOU HAVE SNACKS?","I HEARD ABOUT THE RAIN.","OUR GENETICS ARE NONE OF YOUR BUSINESS."][Math.floor(Math.random()*4)]}`,2800); sfx("talk"); return; }
    const gardenToy = event.target.closest("[data-garden-toy]")?.dataset.gardenToy;
    if (gardenToy) { useGardenToy(gardenToy); return; }

    const houseRoom = event.target.closest("[data-house-room]")?.dataset.houseRoom;
    if (houseRoom !== undefined && houseRoom !== "") { selectHouseRoom(Number(houseRoom)); return; }
    const buyHouseRoomId = event.target.closest("[data-buy-house-room]")?.dataset.buyHouseRoom;
    if (buyHouseRoomId !== undefined && buyHouseRoomId !== "") { buyHouseRoom(Number(buyHouseRoomId)); return; }
    if (event.target.closest("[data-house-prev]")) { moveHouseRoom(-1); return; }
    if (event.target.closest("[data-house-next]")) { moveHouseRoom(1); return; }
    const swapIndex = event.target.closest("[data-farm-swap]")?.dataset.farmSwap;
    if (swapIndex !== undefined && swapIndex !== "") { swapFarmPet(Number(swapIndex)); return; }
    const detailIndex = event.target.closest("[data-house-pet-detail]")?.dataset.housePetDetail;
    if (detailIndex !== undefined && detailIndex !== "") { farmPetDetailModal(Number(detailIndex)); return; }
    const releaseIndex = event.target.closest("[data-release-farm-pet]")?.dataset.releaseFarmPet;
    if (releaseIndex !== undefined && releaseIndex !== "") { releaseFarmPet(Number(releaseIndex)); return; }
    const confirmReleaseIndex = event.target.closest("[data-confirm-release]")?.dataset.confirmRelease;
    if (confirmReleaseIndex !== undefined && confirmReleaseIndex !== "") { confirmReleaseFarmPet(Number(confirmReleaseIndex)); return; }
    if (event.target.closest("[data-open-growth]")) { openGrowthSheet(); return; }
    if (event.target.closest("[data-rebirth-info]")) { closeSheet(); showRebirthInfo(); return; }
    if (event.target.closest("[data-confirm-rebirth]")) { completeRebirth(); return; }
    if (event.target.closest("[data-comfort-pet]")) { comfortPet(); return; }
    if (event.target.closest("[data-open-keeper-path]")) { journalTab = "stats"; changeView("journal"); setTimeout(() => $("#keeperPathBoard")?.scrollIntoView({ behavior: state.settings.reducedMotion ? "auto" : "smooth", block: "start" }), 90); return; }
    if (event.target.closest("[data-open-care-guide]")) { closeSheet(); showKeeperBasics(); return; }
    if (event.target.closest("[data-start-feeding]")) { closeModal(); setTimeout(openFoodSheet, 240); return; }
    if (event.target.closest("[data-open-house]")) { closeModal(); setTimeout(() => changeView("farm"), 220); return; }
    if (event.target.closest("[data-close-modal]")) { closeModal(); return; }
    if (event.target.closest("[data-save-name]")) {
      const input = $("#modalNameInput");
      if (input && renamePet(input.value)) closeModal();
      return;
    }
    const replay = event.target.closest("[data-replay-game]")?.dataset.replayGame;
    if (replay) { closeModal(); startMiniGame(replay); return; }
    if (event.target.closest("[data-revive-thread]")) { revivePet("thread"); return; }
    const newEgg = event.target.closest("[data-new-egg]")?.dataset.newEgg;
    if (newEgg) { buyNewEgg(newEgg); return; }

    const originChoiceValue = event.target.closest("[data-origin-choice]")?.dataset.originChoice;
    if (originChoiceValue) { originChoice(originChoiceValue); return; }

    const settingChoice = event.target.closest("[data-setting-choice]")?.dataset.settingChoice;
    if (settingChoice) {
      // Mode settings: "mode:<id>:<key>:<value>" (see modeSettingsMarkup).
      const [scope,modeId,key,value]=settingChoice.split(":");
      if(scope==="mode")setModeSetting(modeId,key,value);
      return;
    }

    const modeToggle = event.target.closest("[data-mode-setting]");
    if (modeToggle) {
      const [modeId, key] = modeToggle.dataset.modeSetting.split(":");
      setModeSetting(modeId, key, modeToggle.checked);
      return;
    }
    const setting = event.target.closest("[data-setting]");
    if (setting) {
      state.settings[setting.dataset.setting] = setting.checked;
      saveState();
      if (setting.dataset.setting === "music") {
        if (mini?.active && trainingGame(mini.mode)?.music === false) callGame("settingsChanged", "music");
        else syncMusic(true);
      }
      renderAll();
      return;
    }
    if (event.target.closest("[data-open-recovery]")) { openKeeperRecovery(); return; }
    if (event.target.closest("[data-paste-recovery]")) { pasteKeeperRecoveryCode(); return; }
    if (event.target.closest("[data-copy-recovery]")) { copyKeeperRecoveryCode(); return; }
    if (event.target.closest("[data-preview-pre-recovery]")) { previewPreRecoveryBackup(); return; }
    if (event.target.closest("[data-preview-recovery]")) { previewKeeperRecoveryCode($("#keeperRecoveryInput")?.value||""); return; }
    if (event.target.closest("[data-apply-recovery]")) { applyKeeperRecovery(); return; }
    if (event.target.closest("[data-copy-keeper]")) {
      navigator.clipboard?.writeText(state.player.keeperId).then(() => toast("KEEPER ID COPIED")).catch(() => toast("COPY FAILED"));
      return;
    }
    if (event.target.closest("[data-cloud-sync]")) {
      toast(CONFIG.cloud.enabled ? "SYNC STARTED" : "CLOUD ADAPTER RESERVED FOR A FUTURE BUILD");
      return;
    }
    if (event.target.closest("[data-export-save]")) { exportSave(); return; }
    if (event.target.closest("[data-import-save]")) { el.importSaveInput.click(); return; }
    if (event.target.closest("[data-replay-origin]")) { replayOrigin(); return; }
    if (event.target.closest("[data-copy-summary]")) { copySummary(); return; }
    if (event.target.closest("[data-reset-save]")) { resetSave(); }
    const setAside = event.target.closest("[data-download-set-aside]");
    if (setAside) { downloadSaveQuarantine(setAside.dataset.downloadSetAside); return; }
  }

  // ===== INPUT ROUTING AND APPLICATION BOOT =====
  function suspendRuntime(reason="hidden") {
    if (runtimeSuspendedAt) return false;
    runtimeSuspendedAt = now();
    runtimeSuspendReason = reason;
    if (state?.pet) lifeMemory().lastSeenAt = now();
    globalThis.RizoModes?.suspendActive?.(reason);
    // Settle the visible held interval, then let hidden time count as time away.
    if (modeCareHold && !modeCareHold.away) { processElapsedTime(); modeCareHold.away = true; }
    saveState(true);
    if (trainingRun) trainingRun.lastFrame = performance.now();
    if (mini?.active) arcadeFreeze("background");
    stopMusic();
    try { if (audioContext?.state === "running") audioContext.suspend(); } catch (error) {}
    return true;
  }

  function resumeRuntime(reason="visible") {
    const wasSuspended = runtimeSuspendedAt;
    runtimeSuspendedAt = 0;
    runtimeSuspendReason = "";
    if (trainingRun) trainingRun.lastFrame = performance.now();
    scheduleRuntimeViewportSync("resume");
    if (!wasSuspended) return false;
    if(mini?.active) arcadeThaw("background");
    // Time away is accounted before a held mode becomes active again; if it
    // sent the pet into recovery, the mode saves and returns to the Den first.
    if (modeCareHold?.away) {
      processElapsedTime();
      if (modeCareHold) modeCareHold.away = false;
      if (state.pet.resting && globalThis.RizoModes?.active?.()) globalThis.RizoModes.quitActive("recovery");
    }
    globalThis.RizoModes?.resumeActive?.(reason);
    processElapsedTime(); renderAll(); syncMusic(true); window.RizoBoot?.heartbeat?.(`runtime-${reason}`);
    schedulePetBehavior(4000); scheduleIdleLife(); scheduleLifeWow(9000); greetForSession();
    if (state.pet.resting) showRecoveryModal();
    return true;
  }

  function syncReleaseUpdateBar(){
    const bar=document.getElementById("rizoUpdateBar");if(!bar)return;bar.hidden=!releaseUpdateReady;
    const copy=bar.querySelector("[data-update-copy]");if(copy)copy.textContent=globalThis.RizoModes?.active?.()?"New build ready • Update Now saves this run first.":"New Rizo.game build ready.";
  }
  function announceReleaseUpdate(registration) {
    releaseUpdateReady = true;
    releaseRegistration = registration || releaseRegistration;
    syncReleaseUpdateBar();
    window.dispatchEvent(new CustomEvent("rizo:update-ready", { detail: releaseStatus() }));
    toast("RIZO.GAME UPDATE READY • UPDATE NOW WHEN READY");
  }

  // A mode that reports a save outcome (the Dungeon) must confirm it before
  // this build is replaced; older modes return nothing and keep their behavior.
  function modeUpdateHandoff(){
    const outcome=globalThis.RizoModes?.suspendActive?.("force-update");
    if(outcome&&typeof outcome==="object"&&(outcome.status==="blocked"||outcome.status==="failed")){
      recordSaveValidationWarning("update-held-by-mode",{status:outcome.status});
      return{ok:false,status:outcome.status};
    }
    return{ok:true,status:outcome&&typeof outcome==="object"?String(outcome.status||""):""};
  }
  let releaseRefreshInFlight=false;
  async function forceReleaseRefresh(){
    if(releaseRefreshInFlight)return false;releaseRefreshInFlight=true;
    const bar=document.getElementById("rizoUpdateBar"),button=bar?.querySelector("[data-update-now]");bar?.classList.add("updating");if(button)button.textContent="CHECKING…";
    try{
      // Never destroy the only playable offline copy just because the user tapped refresh.
      // A cache-busting network probe must succeed before workers/caches are removed.
      const probe=new URL("./index.html",location.href);probe.searchParams.set("rizoNetworkProbe",String(Date.now()));
      const response=await fetch(probe.href,{cache:"no-store",headers:{"x-rizo-update-probe":"1"}});
      if(!response?.ok)throw new Error("latest build is not reachable");
      const handoff=modeUpdateHandoff();
      if(!handoff.ok){
        releaseRefreshInFlight=false;bar?.classList.remove("updating");if(button)button.textContent="UPDATE NOW";
        toast(handoff.status==="blocked"?"UPDATE PAUSED • THIS TAB IS NOT SAVING":"UPDATE PAUSED • COULDN'T SAVE YOUR JOURNEY YET");
        return false;
      }
      saveState(true);
      try{releaseRegistration?.waiting?.postMessage?.({type:"SKIP_WAITING"});}catch(error){}
      if("serviceWorker" in navigator){const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(reg=>reg.unregister().catch(()=>false)));}
      if("caches" in window){const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("rizo-game-")).map(name=>caches.delete(name)));}
      const url=new URL(location.href);url.searchParams.delete("rizoNetworkProbe");url.searchParams.set("rizoUpdate",String(Date.now()));
      location.replace(url.href);return true;
    }catch(error){
      releaseRefreshInFlight=false;bar?.classList.remove("updating");if(button)button.textContent="UPDATE NOW";
      toast("UPDATE NEEDS A CONNECTION • CURRENT GAME KEPT SAFE");return false;
    }
  }

  function registerRizoServiceWorker() {
    if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return Promise.resolve(null);
    return navigator.serviceWorker.register("./sw.js").then(registration => {
      releaseRegistration = registration;
      if (registration.waiting) announceReleaseUpdate(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) announceReleaseUpdate(registration);
        });
      });
      registration.update().catch(() => {});
      return registration;
    }).catch(() => null);
  }

  function activateReleaseUpdate() { return forceReleaseRefresh(); }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("pointerdown", unlockMusic, { once: true, passive: true });
    document.addEventListener("input", event => {
      const control=event.target.closest("[data-volume-setting]");
      if(!control)return;
      const key=control.dataset.volumeSetting;
      const value=clamp(Number(control.value)||0,0,100)/100;
      state.settings[key]=value;
      const label=document.querySelector(`[data-volume-value="${key}"]`);
      if(label)label.textContent=`${Math.round(value*100)}%`;
      if(key==="musicVolume"){
        if(mini?.active&&trainingGame(mini.mode)?.music===false) callGame("settingsChanged","volume");
        else if(musicGainNode)setMusicGain(currentMusicGain(),.06);
      } else if(key==="soundVolume"&&value>0){
        clearTimeout(control._rizoPreviewTimer);
        control._rizoPreviewTimer=setTimeout(()=>beep(540,.035,"square"),90);
      }
      clearTimeout(control._rizoSaveTimer);
      control._rizoSaveTimer=setTimeout(()=>saveState(),160);
    });
    document.addEventListener("change", event => {
      const control=event.target.closest("[data-volume-setting]");
      if(control)saveState();
    });
    document.addEventListener("pointerdown", event => { const button=event.target.closest("button,a"); if(button && !button.closest("#petTapTarget") && !button.closest("#miniArena")) sfx("ui"); }, {passive:true});
    el.storyNext.addEventListener("click", () => {
      if (originIndex < ORIGIN_STEPS.length - 1) { originIndex += 1; renderOriginStep(); }
    });
    el.foundEgg.addEventListener("click", () => {
      if (originIndex < 2) { originIndex = 2; renderOriginStep(); }
      else beep(330, .07);
    });
    el.skipOrigin.addEventListener("click", () => {
      el.originScreen.hidden = true;
      el.rainLayer.hidden = true;
      el.gameShell.hidden = false;
      renderAll();
    });
    el.petTapTarget.addEventListener("pointerdown", tapPet);
    document.addEventListener("pointermove", trackRizoAttention, { passive:true });
    document.addEventListener("pointerdown", () => { lastLifeInputAt = now(); scheduleIdleLife(); }, { passive:true });
    el.dailyGiftButton.addEventListener("click", showDailyGift);
    el.questClaim.addEventListener("click", claimQuest);
    el.moreCareButton.addEventListener("click", openMoreCareSheet);
    el.sceneMenuButton.addEventListener("click", openQuickSheet);
    el.brandButton.addEventListener("click", openKeeperSheet);
    el.journalJump.addEventListener("click", () => changeView("journal"));
    el.renameButton.addEventListener("click", () => showNameModal(false));
    el.sheetClose.addEventListener("click", closeSheet);
    el.sheetBackdrop.addEventListener("click", closeSheet);
    el.miniArena.addEventListener("pointerdown", event => {
      if(!mini?.active)return;
      event.preventDefault();
      handleMiniInput(event);
    });
    el.miniArena.addEventListener("pointermove", handleMiniMove, { passive: true });
    document.addEventListener("pointerdown", beginFoodDrag);
    document.addEventListener("pointermove", moveFoodDrag, { passive: true });
    document.addEventListener("pointerup", event => { endFoodDrag(event); handleMiniRelease(event); });
    document.addEventListener("pointercancel", event => handleMiniRelease(event, true));
    document.addEventListener("pointercancel", event => endFoodDrag(event, true));
    el.miniQuit.addEventListener("click", () => requestArcadeQuit("button"));
    el.miniPause?.addEventListener("click", () => toggleArcadePause());
    el.miniPausePanel?.addEventListener("click", event => {
      if(event.target.closest("[data-arcade-resume]")){ closeArcadePause(); return; }
      if(event.target.closest("[data-arcade-restart]")){ restartArcadeRun(); return; }
      if(event.target.closest("[data-arcade-quit]")){ requestArcadeQuit("panel"); return; }
    });
    el.tutorialClose.addEventListener("click", () => {
      state.player.tutorialDismissed = true;
      saveState();
      renderTutorial();
    });
    el.importSaveInput.addEventListener("change", () => {
      const file = el.importSaveInput.files?.[0];
      if (file) importSave(file);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Tab") {
        const top = el.modalOverlay?.classList.contains("show") ? el.modalOverlay
          : el.bottomSheet?.classList.contains("show") ? el.bottomSheet
          : !el.miniGameOverlay.hidden ? el.miniGameOverlay : null;
        if (top) {
          const nodes = [...top.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']")]
            .filter(node => !node.closest("[inert]") && node.getClientRects().length > 0);
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (first && (event.shiftKey ? document.activeElement === first || !top.contains(document.activeElement)
            : document.activeElement === last || !top.contains(document.activeElement))) {
            event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
          }
        }
      }
      if (event.key === "Enter" && event.target?.id === "modalNameInput") {
        event.preventDefault();
        if (renamePet(event.target.value)) closeModal();
        return;
      }
      // The active game mode sees keys first and may claim them.
      if(globalThis.RizoModes?.keyActive?.(event))return;
      const typingTarget=Boolean(event.target?.closest?.("input, textarea, select, [contenteditable='true']"));
      if(mini?.active && !typingTarget && !event.metaKey && !event.ctrlKey && !event.altKey){
        const key=String(event.key);
        // P pauses any arcade run.
        if(key.toLowerCase()==="p" && el.modalOverlay && !el.modalOverlay.classList.contains("show")){ event.preventDefault(); toggleArcadePause(); return; }
        // The live training game sees its keys next (lanes, strikes, flaps).
        if(handleMiniKey(event)) return;
      }
      if (event.key !== "Escape") return;
      // Escape used to silently destroy a personal best with zero friction.
      if (!el.miniGameOverlay.hidden) { if(trainingRun?.paused) closeArcadePause(); else if(!openArcadePause()) requestArcadeQuit("escape"); }
      else if (el.modalOverlay.classList.contains("show")) closeModal();
      else if (el.bottomSheet.classList.contains("show")) closeSheet();
    });
    // A live OS reduced-motion change re-applies without a reload.
    try{ matchMedia("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",()=>{ document.body.classList.toggle("reduce-motion", reducedMotionActive()); }); }catch(error){}
    document.addEventListener("visibilitychange", () => document.hidden ? suspendRuntime("background") : resumeRuntime("visible"));
    window.addEventListener("pagehide", () => suspendRuntime("pagehide"), { capture: true });
    window.addEventListener("storage", event => {
      if (saveBlocked || (event.key !== null && event.key !== SAVE_V2_KEY)) return;
      const writeId = saveTextWriteId(event.newValue);
      if (event.key === null || event.newValue === null || (writeId !== null && writeId !== saveWriteId)) blockSaving("conflict");
    });
    window.addEventListener("pageshow", () => resumeRuntime("pageshow"), { capture: true });
    document.addEventListener("freeze", () => suspendRuntime("freeze"));
    document.addEventListener("resume", () => resumeRuntime("resume"));
    window.addEventListener("focus", () => scheduleRuntimeViewportSync("focus"), { passive: true });
    window.addEventListener("resize", () => scheduleRuntimeViewportSync("resize"), { passive: true });
    window.addEventListener("orientationchange", () => scheduleRuntimeViewportSync("orientation"), { passive: true });
    window.visualViewport?.addEventListener("resize", () => scheduleRuntimeViewportSync("visual-resize"), { passive: true });
    window.visualViewport?.addEventListener("scroll", () => scheduleRuntimeViewportSync("visual-scroll"), { passive: true });
    document.addEventListener("fullscreenchange", () => scheduleRuntimeViewportSync("fullscreen"), { passive: true });
    document.addEventListener("webkitfullscreenchange", () => scheduleRuntimeViewportSync("fullscreen"), { passive: true });
    window.addEventListener("beforeunload", () => { suspendRuntime("unload"); saveState(true); });
  }

  // ===== GAME-MODE HOST ADAPTER =====
  // The only bridge between the hub's save and a game mode (core/rizo-modes.js).
  // Modes receive frozen pet snapshots and a narrow API; every write lands here
  // and is applied under hub rules (caps, gene limits, stage growth, quests).
  const MODE_RUN_PREFIX = "rizo-mode-run:";
  const LEGACY_MAP_SEEN_PREFIX = "rizo-defense-map-seen:";
  // Pre-contract data a mode used to keep in the hub, offered once to its first
  // slice migration (state.modeInbox, plus loose keys only Defense ever wrote).
  const MODE_LEGACY_VIEWS = {
    defense: () => {
      const inbox = state.modeInbox?.defense;
      const mapIntrosSeen = storageKeysWithPrefix(LEGACY_MAP_SEEN_PREFIX).filter(key => readSaveText(key) === "1").map(key => key.slice(LEGACY_MAP_SEEN_PREFIX.length));
      return inbox || mapIntrosSeen.length ? { ...(inbox || {}), mapIntrosSeen } : null;
    }
  };
  // Pre-contract in-progress runs, newest key first, handed to the mode's run store.
  const MODE_LEGACY_RUN_KEYS = { defense: LEGACY_DEFENSE_CHECKPOINT_KEYS };
  let modeExitFocus = null;
  function storageKeysWithPrefix(prefix) {
    const keys = [];
    try { for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && key.startsWith(prefix)) keys.push(key); } } catch (error) {}
    return keys;
  }
  function clearModeRuns() {
    if (saveBlocked) return;
    for (const key of storageKeysWithPrefix(MODE_RUN_PREFIX)) { try { localStorage.removeItem(key); } catch (error) {} }
  }

  function modePetSnapshot(pet, source = "active", rosterIndex = -1) {
    if (!pet) return null;
    return {
      id: pet.id, number: pet.number, name: pet.name, source, rosterIndex,
      stage: pet.stage, variant: pet.variant || pet.hiddenVariant || "classic", form: pet.form, alignment: Number(pet.alignment) || 0,
      accessory: pet.accessory || "none", mutation: pet.mutation || "normal", personality: pet.personality, generation: pet.generation || 1, room: pet.room || null,
      level: pet.stage === "egg" ? 0 : levelForXP(pet.xp), xp: Number(pet.xp) || 0, bond: Number(pet.bond) || 0,
      hunger: pet.hunger, mood: pet.mood, energy: pet.energy, hygiene: pet.hygiene, health: pet.health,
      sleeping: Boolean(pet.sleeping), sick: Boolean(pet.sick), resting: Boolean(pet.resting), alive: pet.alive !== false,
      skills: { ...(pet.skills || {}) }, genes: { ...(pet.genes || {}) },
      careSummary: modeCareSummary(pet)
    };
  }
  // Recognition cues only, derived from care history with stable tie-breaks.
  // Modes never receive careProfile, lifeMemory or the histories themselves.
  function modeCareSummary(pet) {
    const top = (counts, known) => Object.entries(counts && typeof counts === "object" ? counts : {})
      .filter(([id, count]) => known(id) && Number(count) > 0)
      .sort((a, b) => (Number(b[1]) - Number(a[1])) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]?.[0] || null;
    const foodId = top(pet.careProfile?.foods, id => FOODS.some(food => food.id === id));
    const food = foodId ? FOODS.find(item => item.id === foodId) : null;
    const bond = Number(pet.bond) || 0;
    return {
      favoriteFood: food ? { id: food.id, name: food.name } : null,
      favoriteGameId: top(pet.careProfile?.games, id => /^[a-z][a-z0-9-]{1,31}$/.test(id)),
      bondBand: bond >= 60 ? "attached" : bond >= 25 ? "familiar" : "new"
    };
  }
  function modeRosterSnapshots() {
    const rows = [modePetSnapshot(state.pet, "active", -1)];
    (state.farm?.roster || []).forEach((pet, index) => rows.push(modePetSnapshot(pet, "house", index)));
    return rows.filter(row => row && row.alive && row.stage !== "egg");
  }
  function applyModeAward(modeId, award) {
    const applied = { embers: 0, heat: 0, pets: {}, active: { ...award.active } };
    mutate((activePet, whole) => {
      const before = whole.wallet.embers;
      whole.wallet.embers = SaveCore.clampInteger(before + award.embers, 0, CORE_LIMITS.MAX_WALLET_EMBERS, before);
      applied.embers = whole.wallet.embers - before;
      if (award.heat) { earnHeat(award.heat, false); applied.heat = award.heat; }
      const owned = new Map([[whole.pet.id, whole.pet], ...(whole.farm?.roster || []).map(pet => [pet.id, pet])]);
      for (const [petId, gains] of Object.entries(award.pets)) {
        const pet = owned.get(petId);
        if (!pet || pet.stage === "egg") continue;
        const got = { xp: gains.xp, bond: 0, skills: {} };
        for (const [skill, amount] of Object.entries(gains.skills)) got.skills[skill] = Math.round(petGainSkill(pet, skill, amount) * 100) / 100;
        pet.xp = SaveCore.clampNumber((Number(pet.xp) || 0) + gains.xp, 0, CORE_LIMITS.MAX_PLAYER_XP, 0);
        const bondBefore = Number(pet.bond) || 0;
        pet.bond = clamp(bondBefore + gains.bond);
        got.bond = Math.round((pet.bond - bondBefore) * 100) / 100;
        if (gains.played) {
          pet.careProfile ||= { kind: 0, wild: 0, balanced: 0, foods: {}, games: {} };
          pet.careProfile.games ||= {};
          pet.careProfile.games[modeId] = (pet.careProfile.games[modeId] || 0) + 1;
        }
        applied.pets[petId] = got;
      }
      activePet.energy = clamp(activePet.energy + award.active.energy);
      activePet.hunger = clamp(activePet.hunger + award.active.hunger);
      activePet.mood = clamp(activePet.mood + award.active.mood);
      if (award.run) {
        whole.meta.totalGames += 1;
        progressQuest("play");
        if (award.embers > 0) { const memory = lifeMemory(); memory.arcadeAfterglowUntil = now() + 16000; memory.lastArcadeMode = modeId; }
      }
    });
    if (award.run) advanceTutorial("play");
    evaluateForm(true);
    return Object.freeze(applied);
  }
  // What a mode receipt may grant, per mode. Nothing else can be granted
  // through host.commit(): no currency, XP or arbitrary pet patches.
  const MODE_ENTITLEMENTS = Object.freeze({
    dungeon: Object.freeze({
      "first-knot": Object.freeze({ kind: "wearable", id: "first-knot" }),
      "shared-hearth": Object.freeze({ kind: "storyMark", id: "shared-hearth" })
    })
  });
  function ownedPetById(petId) {
    if (state.pet?.id === petId && state.pet.stage !== "egg") return state.pet;
    return (state.farm?.roster || []).find(pet => pet.id === petId && pet.stage !== "egg") || null;
  }
  function commitModeSlice(modeId, { schema, data, reward = null }) {
    const outcome = (status, extra = {}) => ({ status, rewardApplied: false, duplicateReward: false, backupSynced: false, ...extra });
    // The old scheduled save would otherwise write later on its own.
    clearTimeout(saveTimer); saveTimer = null;
    if (saveBlocked) return outcome("blocked", { reason: `save-${saveBlocked.reason}` });
    if (stateConflictsWithStorage()) { blockSaving("conflict"); return outcome("blocked", { reason: "save-conflict" }); }
    let grant = null, duplicate = false;
    if (reward) {
      const allowed = MODE_ENTITLEMENTS[modeId] || {};
      if (reward.entitlements.some(id => !allowed[id])) return outcome("failed", { reason: "unknown-entitlement" });
      const prior = state.modeReceipts?.[modeId]?.[reward.receiptId];
      if (prior) {
        if (prior.petId !== reward.petId || prior.entitlements.join("|") !== reward.entitlements.join("|")) return outcome("failed", { reason: "conflicting-receipt" });
        duplicate = true;
      } else {
        const pet = ownedPetById(reward.petId);
        if (!pet) return outcome("failed", { reason: "unowned-pet" });
        if (Object.keys(state.modeReceipts?.[modeId] || {}).length >= MODE_RECEIPT_LIMIT) return outcome("failed", { reason: "receipt-limit" });
        grant = { pet, entries: reward.entitlements.map(id => allowed[id]) };
      }
    }
    // Everything this commit can touch, for an exact rollback if the primary write fails.
    const previous = {
      slice: Object.prototype.hasOwnProperty.call(modeSlices, modeId) ? modeSlices[modeId] : undefined,
      accessories: [...state.inventory.accessories],
      marks: grant ? SaveCore.plainJSON(grant.pet.storyMarks || []) : null,
      receipts: state.modeReceipts?.[modeId] ? { ...state.modeReceipts[modeId] } : undefined,
      lastActive: state.player.lastActive
    };
    modeSlices[modeId] = SaveCore.plainJSON({ schema, data });
    if (grant) {
      for (const entry of grant.entries) {
        if (entry.kind === "wearable" && !state.inventory.accessories.includes(entry.id)) state.inventory.accessories.push(entry.id);
        if (entry.kind === "storyMark") {
          grant.pet.storyMarks = normalizeStoryMarks(grant.pet.storyMarks);
          if (!grant.pet.storyMarks.some(mark => mark.mode === modeId && mark.id === entry.id) && grant.pet.storyMarks.length < STORY_MARK_LIMIT) grant.pet.storyMarks.push({ id: entry.id, mode: modeId, at: now() });
        }
      }
      state.modeReceipts ||= {};
      state.modeReceipts[modeId] = { ...(state.modeReceipts[modeId] || {}), [reward.receiptId]: { petId: reward.petId, entitlements: [...reward.entitlements], at: now() } };
    }
    state.player.lastActive = now();
    const written = persistStateNow();
    if (written.status !== "committed") {
      if (previous.slice === undefined) delete modeSlices[modeId]; else modeSlices[modeId] = previous.slice;
      state.inventory.accessories = previous.accessories;
      if (grant) {
        grant.pet.storyMarks = previous.marks;
        if (previous.receipts === undefined) delete state.modeReceipts[modeId]; else state.modeReceipts[modeId] = previous.receipts;
      }
      state.player.lastActive = previous.lastActive;
      return outcome(written.status, { reason: written.status === "blocked" ? "save-blocked" : "write-failed" });
    }
    return outcome("committed", { rewardApplied: Boolean(grant), duplicateReward: duplicate, backupSynced: written.backupSynced });
  }
  // Foreground care policy: settle ordinary time before a held mode opens and
  // when it closes; presentations it would have shown wait for the Den.
  function beginModeSession(modeId, { carePolicy } = {}) {
    if (carePolicy !== "foreground-hold") return;
    processElapsedTime();
    modeCareHold = { modeId, away: Boolean(runtimeSuspendedAt), deferred: new Set() };
  }
  function endModeSession(modeId) {
    if (modeCareHold?.modeId !== modeId) return;
    processElapsedTime();
    const deferred = modeCareHold.deferred;
    modeCareHold = null;
    pendingCarePresentations = deferred;
  }
  let pendingCarePresentations = null;
  function flushCarePresentations() {
    const deferred = pendingCarePresentations;
    pendingCarePresentations = null;
    if (!deferred?.size || document.hidden) return;
    if (state.pet.resting) showRecoveryModal();
    else if (deferred.has("elder")) showRebirthInfo();
  }
  function recordModeEvent(modeId, event) {
    modeEventLog.push({ mode: modeId, ...event, at: now() });
    while (modeEventLog.length > 24) modeEventLog.shift();
  }
  // A journey a mode is holding for one pet, from its public summary only.
  function modeJourneyNote(petId) {
    const Modes = globalThis.RizoModes;
    const notes = [];
    for (const def of Modes?.list?.() || []) {
      const journey = Modes.summary(def.id)?.journey;
      if (journey && journey.petId === petId && !journey.complete) notes.push(`${def.name}: ${journey.petName || "this Rizo"}'s journey is saved and waits for this Rizo. It will not move to another pet.`);
    }
    return notes.length ? `<p class="mode-journey-note">${notes.map(escapeHTML).join("<br>")}</p>` : "";
  }

  function modeRunStore(modeId) {
    const key = `${MODE_RUN_PREFIX}${modeId}`;
    return Object.freeze({
      key,
      read() { try { const text = localStorage.getItem(key); return text ? JSON.parse(text) : null; } catch (error) { return null; } },
      write(value) { if (saveBlocked) return false; try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { notifySaveFailure(error); return false; } },
      clear() { if (saveBlocked) return false; try { localStorage.removeItem(key); return true; } catch (error) { return false; } }
    });
  }
  // The stage is the arcade overlay, lent to one mode at a time. The mode may
  // add classes to stage.root and fill stage.arena; both are reset on close.
  const STAGE_ROOT_CLASS = "minigame-overlay";
  function setStageHeader(fields = {}) {
    if (fields.kicker !== undefined) el.miniKicker.textContent = String(fields.kicker);
    if (fields.title !== undefined) el.miniTitle.textContent = String(fields.title);
    if (fields.timer !== undefined) el.miniTimer.textContent = String(fields.timer);
    if (fields.score !== undefined) el.miniScore.textContent = String(fields.score);
    if (fields.hint !== undefined) el.miniHint.textContent = String(fields.hint);
    if (fields.quit !== undefined) el.miniQuit.textContent = String(fields.quit);
  }
  function mountMode(modeId, options = {}) {
    if (mini?.active) finishMiniGame(true, null, { discard: true });
    closeSheet(); clearToasts();
    modeExitFocus = document.activeElement;
    el.miniArena.innerHTML = "";
    el.miniGameOverlay.className = STAGE_ROOT_CLASS;
    // Not data-mode: that attribute marks the shelf's launch buttons, and the
    // shelf refresh (every 5 s on the Arcade view) rewrites their text.
    el.miniGameOverlay.dataset.activeMode = modeId;
    if (el.miniPausePanel) { el.miniPausePanel.hidden = true; el.miniPausePanel.innerHTML = ""; }
    setStageHeader(options);
    el.miniGameOverlay.hidden = false;
    lockStageViewport();
    syncUILock();
    return Object.freeze({
      root: el.miniGameOverlay,
      arena: el.miniArena,
      panel: el.miniPausePanel || null,
      header: setStageHeader,
      // Hides the stage but keeps the mode open (e.g. for its results screen).
      close: () => closeModeStage(modeId)
    });
  }
  function closeModeStage(modeId) {
    if (el.miniGameOverlay.dataset.activeMode !== modeId) return false;
    delete el.miniGameOverlay.dataset.activeMode;
    el.miniGameOverlay.hidden = true;
    el.miniGameOverlay.className = STAGE_ROOT_CLASS;
    el.miniArena.className = "mini-arena";
    el.miniArena.innerHTML = "";
    if (el.miniPausePanel) { el.miniPausePanel.hidden = true; el.miniPausePanel.innerHTML = ""; }
    setStageHeader({ quit: "QUIT RUN" });
    unlockStageViewport();
    syncUILock();
    if (modeExitFocus?.isConnected) modeExitFocus.focus({ preventScroll: true });
    return true;
  }
  function unmountMode(modeId) { closeModeStage(modeId); }
  function attachModeHost() {
    const Modes = globalThis.RizoModes;
    if (!Modes) return false;
    Modes.attachHub({
      readSlice: id => (modeSlices[id] ? SaveCore.plainJSON(modeSlices[id]) : null),
      writeSlice: (id, slice) => { modeSlices[id] = SaveCore.plainJSON(slice); },
      legacyView: id => (typeof MODE_LEGACY_VIEWS[id] === "function" ? MODE_LEGACY_VIEWS[id]() : null),
      petSnapshot: () => modePetSnapshot(state.pet, "active", -1),
      rosterSnapshots: modeRosterSnapshots,
      petMarkup: (pet, options = {}) => petMarkup({ ...options, pet }),
      applyAward: applyModeAward,
      settings: () => ({ sound: state.settings.sound, soundVolume: state.settings.soundVolume, music: state.settings.music, musicVolume: state.settings.musicVolume, haptics: state.settings.haptics, reducedMotion: state.settings.reducedMotion }),
      audio: Object.freeze({
        sfx: (name, ...args) => sfx(name, ...args),
        tone: (...args) => tone(...args),
        noise: (...args) => noise(...args),
        haptic: pattern => haptic(pattern),
        duck: (ms, level) => duckMusic(ms, level),
        // A built-in scene name, an adaptive track { id, tempo, lead, bass, beat }, or null to hand music back to the hub.
        music: track => {
          if (track && typeof track === "object") { const key = `mode-track:${track.id || "mode"}`; modeMusicTracks.set(key, track); activeMusicOverride = key; startMusicForScene(key, true); }
          else if (typeof track === "string") { activeMusicOverride = track; startMusicForScene(track, true); }
          else { activeMusicOverride = null; syncMusic(true); }
        }
      }),
      ui: Object.freeze({
        toast: message => toast(message),
        modal: (markup, options = {}) => showModal(markup, { onClose: options.onClose }),
        closeModal: (options = {}) => closeModal({ silent: Boolean(options.silent) }),
        modalOpen: () => el.modalOverlay.classList.contains("show"),
        cutscene: options => playPetCutscene(options),
        celebrate: () => celebrate()
      }),
      keeperId: () => state.player.keeperId,
      report: (modeId, kind, details) => recordSaveValidationWarning(`mode-${modeId}-${kind}`, details),
      debug: IS_QA_BUILD,
      build: RIZO_RUNTIME_BUILD,
      runStore: modeRunStore,
      mount: mountMode,
      unmount: unmountMode,
      save: () => saveState(),
      commitSlice: commitModeSlice,
      modeEvent: recordModeEvent,
      sessionStart: beginModeSession,
      sessionEnd: endModeSession,
      onExit: (modeId, summary, { destination } = {}) => {
        activeMusicOverride = null; syncMusic(true);
        if (destination === "home") changeView("home"); else renderAll();
        recordModeEvent(modeId, { kind: "returnedToHub", boundaryId: "hub", campaignId: "", tone: "protected", interruption: "none" });
        flushCarePresentations();
        // A proof homecoming gets one small familiar gesture in the Den, nothing more.
        if (destination === "home" && summary?.homecoming === true) setTimeout(() => setLifeBehavior("shake", 1800), 650);
      }
    });
    prepareModeSlices();
    return true;
  }
  // Runs every registered mode's slice migration once, hands over legacy
  // in-progress runs, and clears the inbox for modes that now have a slice.
  function prepareModeSlices() {
    const Modes = globalThis.RizoModes;
    if (!Modes) return;
    let changed = false;
    for (const mode of Modes.list()) {
      try {
        const result = Modes.ensureSlice(mode.id);
        if (result && !result.newer && state.modeInbox?.[mode.id]) { delete state.modeInbox[mode.id]; changed = true; }
        if (result && !result.newer && mode.id === "defense") for (const key of storageKeysWithPrefix(LEGACY_MAP_SEEN_PREFIX)) { if (!saveBlocked) try { localStorage.removeItem(key); } catch (error) {} }
        adoptLegacyModeRun(mode.id);
      }
      catch (error) { console.warn(`Rizo could not prepare the ${mode.id} save`, error); recordSaveValidationWarning("mode-slice-migration-failed", { mode: mode.id, message: String(error?.message || error).slice(0, 200) }); }
    }
    if (changed) saveState();
  }
  function adoptLegacyModeRun(modeId) {
    const keys = MODE_LEGACY_RUN_KEYS[modeId];
    if (!keys?.length || saveBlocked) return false;
    const store = modeRunStore(modeId);
    const text = keys.map(readSaveText).find(Boolean);
    if (!text) return false;
    let value = null;
    try { value = JSON.parse(text); } catch (error) { value = null; }
    // Copy first; the old keys go only once the copy is safely written.
    if (value && !store.read() && !store.write(value)) return false;
    for (const key of keys) { try { localStorage.removeItem(key); } catch (error) {} }
    return true;
  }

  // ===== GAME MODES ON THE HUB =====
  function modeEntryBlocker(def) {
    const pet = state.pet;
    if (pet.stage === "egg") return "HATCH FIRST";
    if (pet.resting) return "RECOVERING";
    if (pet.sleeping) return "WAKE RIZO";
    if (pet.energy < (def.entry?.energy || 0)) return `NEED ${def.entry.energy} ENERGY`;
    return "";
  }
  function launchModeFromHub(modeId) {
    const Modes = globalThis.RizoModes, def = Modes?.get?.(modeId);
    if (!def) { toast("THAT GAME IS NOT AVAILABLE ON THIS BUILD"); return false; }
    if (!canCare()) return false;
    if (def.carePolicy === "foreground-hold") processElapsedTime();
    const blocked = modeEntryBlocker(def);
    if (blocked) { toast(`${blocked} • ${def.name}`); sfx("no"); return false; }
    try { return Modes.launch(modeId, {}); }
    catch (error) { console.warn(`Rizo could not open ${modeId}`, error); toast("THAT GAME COULD NOT OPEN • YOUR SAVE IS SAFE"); return false; }
  }
  // Shelf cards for modes: [data-mode="<id>"] buttons and [data-mode-best] cells.
  function renderModeShelf() {
    const Modes = globalThis.RizoModes;
    if (!Modes) return;
    for (const button of $$("button[data-mode]")) {
      const def = Modes.get(button.dataset.mode);
      if (!def) { button.classList.add("game-blocked"); button.textContent = "UNAVAILABLE"; continue; }
      const blocked = modeEntryBlocker(def);
      button.classList.toggle("game-blocked", Boolean(blocked));
      button.textContent = blocked || button.dataset.modeLabel || "PLAY";
    }
    for (const cell of $$("[data-mode-best]")) {
      const def = Modes.get(cell.dataset.modeBest), summary = Modes.summary(cell.dataset.modeBest);
      const value = cell.querySelector("b"), label = cell.querySelector("span");
      if (value) value.textContent = summary?.bestLabel || "—";
      if (label && def) label.textContent = summary?.unit === "wave" ? `${def.name} • WAVE` : summary?.unit === "journey" ? `${def.name} • JOURNEY` : def.name;
      cell.classList.toggle("score-cell-wave", summary?.unit === "wave");
    }
    // A mode's summary may carry a small badge ({ text, title }) for its card.
    for (const card of $$("[data-mode-card]")) {
      const badgeInfo = Modes.summary(card.dataset.modeCard)?.badge;
      let badge = card.querySelector(".mode-badge");
      if (badgeInfo?.text) {
        if (!badge) { badge = document.createElement("i"); badge.className = "mode-badge"; card.appendChild(badge); }
        badge.textContent = String(badgeInfo.text);
        badge.title = String(badgeInfo.title || "");
      } else badge?.remove();
    }
    for (const meta of $$("[data-mode-meta]")) {
      const def = Modes.get(meta.dataset.modeMeta), summary = Modes.summary(meta.dataset.modeMeta);
      if (!def) continue;
      const affordable = (state.pet?.energy ?? 0) >= (def.entry?.energy || 0);
      const bestTitle = summary?.unit === "wave" ? "BEST WAVE" : summary?.unit === "journey" ? "JOURNEY" : "BEST";
      const entryCell = summary?.entryLabel ? `<span class="meta-energy"><small>ENTRY</small><b>${escapeHTML(summary.entryLabel)}</b></span>` : `<span class="meta-energy${affordable ? "" : " short"}"><small>ENERGY</small><b>${def.entry?.energy || 0}</b></span>`;
      const lengthCell = `<span class="meta-length"><small>${summary?.lengthLabel ? "LENGTH" : "RUN"}</small><b>${escapeHTML(summary?.lengthLabel || "ENDLESS")}</b></span>`;
      meta.innerHTML = `<span class="meta-best"><small>${bestTitle}</small><b>${escapeHTML(summary?.bestLabel || "—")}</b></span>${entryCell}${lengthCell}`;
    }
  }
  // Journal → Settings rows declared by each mode (def.settings), stored in its slice.
  function modeSettingsMarkup() {
    const Modes = globalThis.RizoModes;
    return (Modes?.list?.() || []).filter(def => def.settings?.length).map(def => {
      const values = Modes.readSettings(def, modeSlices[def.id]?.data);
      const rows = def.settings.map(setting => setting.kind === "toggle"
        ? `<label class="setting-row"><span>${escapeHTML(setting.title)}<small>${escapeHTML(setting.copy)}</small></span><input class="toggle" type="checkbox" data-mode-setting="${escapeHTML(def.id)}:${escapeHTML(setting.key)}" ${values[setting.key] ? "checked" : ""}></label>`
        : `<div class="setting-row setting-choice-row"><span>${escapeHTML(setting.title)}<small>${escapeHTML(setting.copy)}</small></span><span class="setting-choice-control" role="group" aria-label="${escapeHTML(setting.title)}">${setting.choices.map(([value, label]) => `<button type="button" data-setting-choice="mode:${escapeHTML(def.id)}:${escapeHTML(setting.key)}:${escapeHTML(value)}" class="${values[setting.key] === value ? "active" : ""}" aria-pressed="${values[setting.key] === value}">${escapeHTML(label)}</button>`).join("")}</span></div>`).join("");
      return `<section class="settings-board"><h3>${escapeHTML(def.name)}</h3>${rows}</section>`;
    }).join("");
  }
  function setModeSetting(modeId, key, value) {
    const Modes = globalThis.RizoModes, def = Modes?.get?.(modeId);
    if (!def) return false;
    const next = Modes.writeSetting(def, modeSlices[modeId]?.data, key, value);
    if (!next) return false;
    modeSlices[modeId] = { schema: modeSlices[modeId]?.schema || def.schema, data: next };
    saveState(true); renderAll();
    const setting = def.settings.find(item => item.key === key);
    toast(`${setting?.title || key} • ${String(setting?.kind === "toggle" ? (next.settings[key] ? "ON" : "OFF") : next.settings[key]).toUpperCase()}`);
    return true;
  }

  function boot() {
    document.addEventListener("rizo:ad-start", () => {
      if (adAudioHolds++ === 0) adAudioWasRunning = audioContext?.state === "running";
      arcadeFreeze("ad"); globalThis.RizoModes?.suspendActive?.("ad"); stopMusic(0);
      if (audioContext?.state === "running") audioContext.suspend().catch(() => {});
      syncUILock();
    });
    document.addEventListener("rizo:ad-end", event => {
      adAudioHolds = Math.max(0, adAudioHolds - 1);
      if (event.detail?.requiresResume) { openArcadePause(); globalThis.RizoModes?.suspendActive?.("manual"); }
      arcadeThaw("ad"); globalThis.RizoModes?.resumeActive?.("ad"); syncUILock();
      if (!adAudioHolds && !document.hidden && adAudioWasRunning) audioContext?.resume().catch(() => {});
      if (!adAudioHolds) syncMusic(true);
    });
    loadState();
    attachModeHost();
    buildRain();
    bindEvents();
    scheduleIdleLife();
    scheduleLifeWow();
    if (state.introSeen) {
      el.originScreen.hidden = true;
      el.rainLayer.hidden = true;
      el.gameShell.hidden = false;
      renderAll();
      schedulePetBehavior(4500);
      greetForSession();
      if (state.pet.resting) setTimeout(showRecoveryModal, 250);
      else if (lastOfflineSummary) setTimeout(() => showOfflineSummary(lastOfflineSummary), 450);
      else if (state.pet.stage === "egg") setTimeout(() => say("TAP THE EGG. IT LIKES WARMTH.", 3200), 700);
    } else {
      el.originScreen.hidden = false;
      el.rainLayer.hidden = false;
      el.gameShell.hidden = true;
      el.skipOrigin.hidden = true;
      renderOriginStep();
    }
    setInterval(() => {
      if (!document.hidden) {
        processElapsedTime();
        processExpedition();
        saveState();
        // House residents are passive and their buttons must stay mounted while
        // the player watches or taps them. Rebuilding the room every five seconds
        // could detach a hitbox mid-tap, so only refresh shared chrome here.
        if (currentView === "farm") {
          renderSharedUI();
          renderTutorial();
          refreshAdSlots();
        } else renderAll();
      }
    }, 5000);
    setInterval(() => maybeTriggerWorldEvent(false), 30000);
    syncRuntimeViewport();
    registerRizoServiceWorker();
  }


  const IS_QA_BUILD=location.hostname==="localhost"||location.hostname==="127.0.0.1"||new URLSearchParams(location.search).get("qa")==="1";
  function createRizoRuntimeQA(){return Object.freeze({
    defaultState: () => JSON.parse(JSON.stringify(defaultState())),
    buildStateEnvelopeForQA: payload => buildStateEnvelope(payload||state,123456789),
    verifyStateEnvelopeForQA: envelope => SaveCore.verifyEnvelope(envelope),
    decodeStatePayloadForQA: payload => {const decoded=decodeStatePayload(payload);return{status:decoded.status,state:decoded.state};},
    saveValidationWarningForQA: () => {try{return JSON.parse(localStorage.getItem(SAVE_VALIDATION_WARNING_KEY)||"null");}catch(error){return null;}},
    visualMatrixForQA: () => ({matrix:RIZO_FORMS,variants:VARIANTS,stages:STAGES,ages:AGE_VISUALS,calibration:VARIANT_VISUAL_CALIBRATION,wearables:WEARABLE_DEFS}),
    resolveRizoVisualForQA: options => resolveRizoVisual(options||{}),
    normalizeState: payload => normalizeStateDetached(payload),
    loadForQA(payload = {}) {
      if (globalThis.RizoModes?.active?.()) globalThis.RizoModes.quitActive("qa-load");
      const { qaModes = null, ...hubPayload } = payload || {};
      state = normalizeState(hubPayload);
      modeSlices = qaModes && typeof qaModes === "object" ? SaveCore.normalizeModes(SaveCore.plainJSON(qaModes)) : {};
      for (const modeId of Object.keys(state.modeInbox || {})) delete modeSlices[modeId];
      prepareModeSlices();
      activeHouseRoom = state.farm?.activeRoom || 0;
      state.introSeen = true;
      el.originScreen.hidden = true;
      el.rainLayer.hidden = true;
      el.gameShell.hidden = false;
      renderAll();
      return {version:state.version,stage:state.pet.stage,variant:state.pet.variant,accessory:state.pet.accessory};
    },
    snapshot: () => ({ ...JSON.parse(JSON.stringify(state)), qaModes: SaveCore.plainJSON(modeSlices) }),
    saveForQA: () => { saveState(true); return true; },
    modeSliceForQA: id => (modeSlices[id] ? SaveCore.plainJSON(modeSlices[id]) : null),
    modeRunKeyForQA: id => `${MODE_RUN_PREFIX}${id}`,
    modeSettingsMarkupForQA: () => modeSettingsMarkup(),
    startMiniGame,
    finishMiniGame,
    renderAll,
    setBehaviorForQA(behavior = "") { activePetBehavior = behavior; if(currentView === "home") renderHome(); return el.petActor.className; },
    markupForQA(context = "cutscene", accessory = state.pet.accessory) { return petMarkup({context,overrides:{accessory}}); },
    miniSnapshot: () => { const jobs=[...(trainingRun?.jobs?.values()||[])]; return {active:Boolean(mini?.active),mode:mini?.mode||null,track:null,voices:0,intervals:jobs.filter(job=>job.period).length,timeouts:jobs.filter(job=>!job.period).length,entities:(mini?.entities||[]).length,...(trainingGame(mini?.mode)?.qaMini?.(mini)||{})}; },
    arcadeAuthoredForQA: () => Object.fromEntries((Training?.list?.()||[]).filter(def=>def.qaAuthored).map(def=>[def.id,def.qaAuthored(mini,runClockNow())])),
    arcadeSnapshotForQA: () => ({active:Boolean(mini?.active),mode:mini?.mode||null,score:Number(mini?.score)||0,hits:Number(mini?.hits)||0,playerInputs:Number(mini?.playerInputs)||0,
      ...Object.fromEntries((Training?.list?.()||[]).filter(def=>def.qaSnapshot).map(def=>[def.id,def.qaSnapshot(mini,runClockNow())]))}),
    // Shared arcade-layer QA surface: interruption safety, pause state, end
    // reason and the canonical name table are all player-visible contracts.
    musicSceneForQA: () => ({scene:musicScene||null, requested:sceneMusicKey(), known:Boolean(MUSIC_TRACKS[sceneMusicKey()]||modeMusicTracks.has(sceneMusicKey()))}),
    arcadePauseForQA: () => openArcadePause(),
    arcadeResumeForQA: () => closeArcadePause(true),
    // A neutral probe job: proves remaining-delay banking without depending on
    // any one game's timing.
    arcadeProbeJobForQA: (delay=500) => {
      if(!mini?.active) return null;
      mini.qaProbe = {fired:false, count:0, id:null};
      const probe = mini.qaProbe;
      probe.id = trainingSchedule(delay, () => { probe.fired = true; probe.count += 1; });
      return probe.id;
    },
    arcadeProbeStateForQA: () => {
      const probe = mini?.qaProbe;
      const job = probe ? trainingRun?.jobs?.get(probe.id) : null;
      return {fired:Boolean(probe?.fired), count:Number(probe?.count)||0,
              remaining: job ? Math.round(job.due - runClockNow()) : -1, armed: Boolean(job) && !arcadeFrozen()};
    },
    arcadeGrantBuffsForQA: () => { if(!mini?.active) return false; trainingGame(mini.mode)?.qaBuffs?.(mini, runClockNow()); return true; },
    // A deadline that had already lapsed when the hold began must stay lapsed.
    arcadeExpiredDeadlineSurvivesForQA: () => {
      if(!mini?.active) return false;
      mini.glideInvulnerableUntil = runClockNow() - 400;
      const before = mini.glideInvulnerableUntil;
      arcadeFreeze("qa-expiry");
      arcadeThaw("qa-expiry");
      return mini.glideInvulnerableUntil === before && mini.glideInvulnerableUntil < runClockNow();
    },
    // Everything on the run board, in one comparable value. A held run must not change it.
    arcadeFingerprintForQA: () => JSON.stringify(mini || {}, (key, value) => {
      if (key === "node" || key === "qaProbe") return undefined;
      if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : String(value);
      if (value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return undefined;
      return value;
    }),
    arcadeJobsForQA: () => {
      const jobs=[...(trainingRun?.jobs?.values()||[])], held=arcadeFrozen(), t=runClockNow();
      return { count: jobs.length, held, holds: held ? Object.keys(trainingRun.pauseSources).sort() : [], armed: held ? 0 : jobs.length,
        pending: jobs.map(job => ({id: job.id, remaining: Math.round(job.due - t), repeat: Boolean(job.period)})) };
    },
    // Deadlines on the run board (by the *Until / *At convention), measured on the run clock.
    arcadeDeadlinesForQA: () => {
      const out = {}, t = runClockNow();
      for (const key of Object.keys(mini || {})) {
        if (!/(?:Until|At)$/.test(key) || key === "endAt") continue;
        const value = mini[key];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) out[key] = Math.round(value - t);
      }
      return out;
    },
    arcadeAdvanceClockForQA: ms => {if(!mini?.active||!Number.isFinite(mini.endAt))return false;mini.endAt-=Math.max(0,Number(ms)||0);return true;},
    arcadeClockForQA: () => ({active:Boolean(mini?.active),mode:mini?.mode||null,endless:!Number.isFinite(mini?.endAt),
      remaining:Number.isFinite(mini?.endAt)?Math.max(0,mini.endAt-runClockNow()):Infinity,
      frozen:arcadeFrozen(),paused:Boolean(trainingRun?.paused),sources:Object.keys(trainingRun?.pauseSources||{}).sort(),
      jobsHeld:arcadeFrozen(),jobHolds:Object.keys(trainingRun?.pauseSources||{}).sort()}),
    arcadeStateForQA: () => ({active:Boolean(mini?.active),mode:mini?.mode||null,score:Math.max(0,Math.floor(mini?.score||0)),
      lives:mini?.lives??null,maxLives:mini?.maxLives??null,endReason:mini?.endReason||"",paused:Boolean(trainingRun?.paused),
      quitConfirmed:Boolean(trainingRun?.quitConfirmed),rhythmReady:Boolean(mini?.rhythmReady)}),
    arcadeSetScoreForQA: value => {if(!mini?.active)return false;mini.score=Math.max(0,Number(value)||0);return true;},
    arcadeKillForQA: () => {if(!mini?.active)return false;mini.lives=0;mini.endReason="death";return true;},
    arcadeFreezeForQA: (source="background") => arcadeFreeze(source),
    arcadeThawForQA: (source="background") => arcadeThaw(source),
    suspendRuntimeForQA: (reason="background") => suspendRuntime(reason),
    resumeRuntimeForQA: (reason="visible") => resumeRuntime(reason),
    arcadeGamesForQA: () => Object.fromEntries((Training?.list?.()||[]).map(def=>[def.id,{name:def.name,kicker:def.kicker,art:def.art,hint:def.hint,duration:def.duration,energy:def.energy,lives:def.lives,par:def.par,unit:"PTS",best:"points"}])),
    trainingConvertForQA: (mode, score) => { const def=trainingGame(mode); return def ? Training.convert(def, {score, reason:"timeup", inputs:1}) : null; },
    arcadeQualifyForQA: (mode=mini?.mode) => {if(!mini?.active||mini.mode!==mode)return false;trainingGame(mode)?.qaQualify?.(mini);return arcadeRunQualified();},
    runtimeViewportForQA: () => runtimeViewportSnapshot(),
    syncRuntimeViewportForQA: () => syncRuntimeViewport(),
    suspendRuntimeForQA: reason => ({changed:suspendRuntime(reason||"qa-suspend"),suspendedAt:runtimeSuspendedAt,reason:runtimeSuspendReason}),
    resumeRuntimeForQA: reason => ({changed:resumeRuntime(reason||"qa-resume"),suspendedAt:runtimeSuspendedAt,reason:runtimeSuspendReason}),
    releaseStatusForQA: () => releaseStatus(),
    modeUpdateHandoffForQA: () => modeUpdateHandoff(),
    modeEventsForQA: () => SaveCore.plainJSON(modeEventLog),
    modeReceiptsForQA: () => SaveCore.plainJSON(state.modeReceipts || {}),
    careHoldForQA: () => (modeCareHold ? { modeId: modeCareHold.modeId, away: modeCareHold.away, deferred: [...modeCareHold.deferred] } : null),
    agePetClockForQA: ms => { state.pet.lastTick = Math.max(1, (Number(state.pet.lastTick) || now()) - Math.max(0, Number(ms) || 0)); return state.pet.lastTick; },
    processElapsedForQA: () => { processElapsedTime(); return { hunger: state.pet.hunger, mood: state.pet.mood, energy: state.pet.energy, xp: state.pet.xp, bond: state.pet.bond, lastTick: state.pet.lastTick }; },
    persistNowForQA: () => persistStateNow(),
    currentViewForQA: () => currentView,
    releaseFarmPetForQA: index => { releaseFarmPet(Number(index) || 0); return el.modalOverlay.querySelector(".modal-card")?.textContent || ""; },
    rebirthInfoForQA: () => { showRebirthInfo(); return el.modalOverlay.querySelector(".modal-card")?.textContent || ""; },
    activateReleaseUpdateForQA: () => activateReleaseUpdate(),
    injectReleaseUpdateForQA: () => {const messages=[];const waiting={postMessage:message=>messages.push(JSON.parse(JSON.stringify(message)))};const registration={waiting};announceReleaseUpdate(registration);return{messages,activate:()=>activateReleaseUpdate(),status:()=>releaseStatus()};},
    keeperCodeForQA: () => keeperRecoveryCode(),
    preRecoveryForQA: () => {const recovered=readPreRecoveryBackup();return recovered?{name:recovered.pet?.name||null,embers:recovered.wallet?.embers||0,version:recovered.version}:null;},
    setViewForQA(view = "home") { changeView(view); return currentView; },
    setHouseRoomForQA(roomId = 0) { selectHouseRoom(Number(roomId)); return activeHouseRoom; },
    houseSnapshot: () => ({featureUnlocked:houseIsUnlocked(),activeRoom:activeHouseRoom,unlocked:[...state.farm.unlockedRooms],capacity:houseCapacity(),residents:state.farm.roster.map(p=>({id:p.id,name:p.name,room:p.homeRoom}))}),
    houseRequirementsForQA: () => ({level:levelForXP(state.pet.xp),required:HOUSE_UNLOCK_LEVEL,tutorialDone:state.player.tutorialStep>=5||state.player.tutorialDismissed,unlocked:houseIsUnlocked()}),
    useFoodForQA: id => useFood(id),
    livingMoodForQA: () => livingMood(),
    triggerLifeBehaviorForQA: behavior => { setLifeBehavior(behavior,50); return behavior; },
    spawnLifeMomentForQA: () => { spawnLifeMoment(true); return el.habitatScene.querySelectorAll(".life-particle").length; }
  });}

  // Each game mode may contribute QA hooks (QA builds only); they can wrap the
  // hub's own (startMiniGame, finishMiniGame, miniSnapshot) for their mode.
  function createMergedRuntimeQA(){const hubQA=createRizoRuntimeQA(),merged={...hubQA};for(const game of Training?.list?.()||[])if(typeof game.qa==="function")Object.assign(merged,game.qa());for(const mode of globalThis.RizoModes?.list?.()||[])if(typeof mode.qa==="function")Object.assign(merged,mode.qa({...merged}));return Object.freeze(merged);}
  if(IS_QA_BUILD)window.RizoRuntimeQA=createMergedRuntimeQA();else{for(const key of["RizoRuntimeQA","RizoVisualQA","RizoBeatQA"]){try{delete window[key];}catch(error){}}}

  boot();
  window.RizoBoot?.ready?.(RIZO_RUNTIME_BUILD);
})();
