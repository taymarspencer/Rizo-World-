/*
  RIZO DEFENSE — game mode
  ========================
  The first game mode on the hub's game-mode contract (core/rizo-modes.js), and
  the blueprint for the ones that follow (see ARCHITECTURE.md §5).

  This file owns everything about Defense that is not pure rules: the lobby and
  crew, the run (simulation driver, DOM and canvas presentation, input), records,
  Trail School, daily contracts, checkpoints and the recap. Pure rules live in
  defense-core.js; the canvas presenter in defense-canvas.js.

  It never touches the hub's save, wallet or pets:
    - pets arrive as frozen snapshots (host.pet(), host.roster()) taken at launch
    - records, settings, school and crew live in this mode's save slice
    - an in-progress run lives in host.run (the checkpoint)
    - the player is paid through host.award() when a run ends
*/
(() => {
  "use strict";
  const DefenseCore = globalThis.RizoDefenseCore;
  const Modes = globalThis.RizoModes;
  const Catalog = globalThis.RizoCatalog;
  if (!DefenseCore || !Modes || !Catalog) { console.warn("Rizo Defense did not load: a core module is missing."); return; }
  const { PHASES: DEFENSE_PHASES, BUDGETS: DEFENSE_BUDGETS, LIMITS: DEFENSE_LIMITS } = DefenseCore;
  const DEFENSE_CHECKPOINT_VERSION = DefenseCore.VERSION;
  const BASE_DEFENSE_STARTING_CASH = DefenseCore.ECONOMY.baseStartingCash;
  const DEFENSE_SLICE_SCHEMA = 1;
  // Energy the active Rizo needs to start a run, and spends on a credited run.
  const DEFENSE_ENERGY = 8;
  const VARIANTS = Catalog.VARIANTS;

  // ===== SMALL HELPERS =====
  // Local copies: a mode never imports hub code.
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const now = () => Date.now();
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function uid(prefix = "RZ") {
    const random = crypto?.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(6))].map(v => v.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2, 14);
    return `${prefix}-${random.toUpperCase()}`;
  }

  // ===== HOST BRIDGE =====
  let host = null;      // the host API while the mode is launched, else null
  let stage = null;     // { root, arena, header, close } while a run is on screen
  let store = null;     // this mode's slice data, normalised
  let captain = null;   // frozen snapshot of the active Rizo, taken at launch
  let houseCrew = [];   // frozen snapshots of House residents, taken at launch
  const qaVariantOverrides = new Map();
  const FALLBACK_SETTINGS = Object.freeze({ sound: true, music: true, haptics: true, reducedMotion: false });
  const hostSettings = () => host?.settings() || FALLBACK_SETTINGS;
  const hostKeeperId = () => host?.keeperId() || "";
  const captainPet = () => captain || Object.freeze({ id: "", name: "RIZO", variant: "classic", stage: "kid", skills: {}, genes: {}, source: "active" });
  function withQaVariant(pet) {
    const variant = pet && qaVariantOverrides.get(pet.id);
    return variant ? Object.freeze({ ...pet, variant }) : pet;
  }
  function refreshCrewSnapshots() {
    if (!host) return;
    captain = withQaVariant(host.pet());
    houseCrew = host.roster().filter(pet => pet.source === "house").map(withQaVariant);
  }
  function persistStore() { if (host && store) host.slice.write(store); }
  // Legacy call sites inside the moved code still say saveState(); for Defense
  // that means "persist this mode's slice".
  function saveState() { persistStore(); }
  function petMarkup({ pet, ...options } = {}) { return host ? host.petMarkup(pet || captainPet(), options) : ""; }
  function toast(message) { host?.ui?.toast?.(message); }
  let modalCloseHandler = null;
  function showModal(markup, { onClose = defenseModalClosed } = {}) { host?.ui?.modal?.(markup, { onClose }); }
  function closeModal() { host?.ui?.closeModal?.({ silent: true }); }
  function celebrate() { host?.ui?.celebrate?.(); }
  function haptic(pattern = 15) { if (hostSettings().haptics) host?.audio?.haptic?.(pattern); }
  function tone(...args) { if (hostSettings().sound) host?.audio?.tone?.(...args); }
  function noise(...args) { if (hostSettings().sound) host?.audio?.noise?.(...args); }
  function duckMusic(ms, level) { host?.audio?.duck?.(ms, level); }
  function defenseRecordValidationWarning(kind, details = {}) { host?.report?.(kind, details); }

  // ===== SAVE SLICE =====
  // Everything Defense remembers between runs. The hub stores it inside the
  // signed save and never looks inside.
  const DEFENSE_MAP_IDS = ["grove", "ember", "moon", "storm", "blizzard", "eclipse"];
  const DEFENSE_CONTRACT_RULE_IDS = new Set(["unique", "lean", "no-sell", "silent", "power-only", "control-only"]);
  const DEFENSE_SETTINGS = Object.freeze([
    { key: "signatures", kind: "toggle", default: true, title: "FIELD SIGNATURES", copy: "Shows mastery-earned tower marks, trails, impact sigils, and restrained attack tones. Cosmetic only." },
    { key: "autoStart", kind: "toggle", default: false, title: "AUTO WAVES", copy: "Off by default. When enabled, a cleared field waits about 2.8 seconds before the next wave; opening a planning interaction resets the countdown." },
    { key: "fx", kind: "choice", default: "auto", title: "DEFENSE EFFECTS", copy: "AUTO protects frame pacing. FULL preserves decoration until emergency load. LOW always minimizes particles.", choices: [["auto", "AUTO"], ["full", "FULL"], ["low", "LOW"]] },
    { key: "uiScale", kind: "choice", default: "standard", title: "BATTLEFIELD UI", copy: "Changes Defense HUD and control size without changing the playfield or hit logic.", choices: [["compact", "COMPACT"], ["standard", "STANDARD"], ["large", "LARGE"]] },
    { key: "waveIntel", kind: "choice", default: "simple", title: "WAVE INTEL", copy: "SIMPLE gives only a useful warning. FULL shows counts. OFF keeps the battlefield clean.", choices: [["off", "OFF"], ["simple", "SIMPLE"], ["full", "FULL"]] }
  ]);
  const cleanName = value => String(value || "").replace(/[<>\u0000-\u001F\u007F]/g, "").slice(0, 14).toUpperCase();
  const knownVariant = id => (VARIANTS.some(variant => variant.id === id) ? id : "classic");

  // Validates every field of the slice. This is the code the hub's normalizeState
  // used to run on Defense's behalf (pre-v88), unchanged in its rules.
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const records = source.records && typeof source.records === "object" ? source.records : {};
    const clampWave = value => DefenseCore.clampInteger(value, 0, DEFENSE_LIMITS.MAX_SUPPORTED_WAVE, 0);
    const best = clampWave(records.best);
    const maps = records.maps && typeof records.maps === "object" && !Array.isArray(records.maps)
      ? Object.fromEntries(Object.entries(records.maps).filter(([id]) => DEFENSE_MAP_IDS.includes(id)).map(([id, value]) => [id, clampWave(value)]))
      : {};
    const milestones = Array.isArray(records.milestones) ? [...new Set(records.milestones.map(Number).filter(value => [10, 25, 50, 100].includes(value)))].sort((a, b) => a - b) : [];
    const perfectMaps = Array.isArray(records.perfectMaps) ? [...new Set(records.perfectMaps.filter(id => DEFENSE_MAP_IDS.includes(id)))] : [];
    const history = Array.isArray(records.history)
      ? records.history.filter(item => item && typeof item === "object" && DEFENSE_MAP_IDS.includes(item.mapId)).slice(0, 12).map((item, index) => {
          const clearedWave = clampWave(item.clearedWave ?? item.wave);
          const reachedWave = Math.max(clearedWave, DefenseCore.clampInteger(item.reachedWave ?? item.currentWave ?? item.wave, 0, DEFENSE_LIMITS.MAX_SUPPORTED_WAVE, clearedWave));
          const perfectWaveCount = Math.min(clearedWave, DefenseCore.clampInteger(item.perfectWaveCount ?? (item.perfect ? clearedWave : 0), 0, DEFENSE_LIMITS.MAX_REASONABLE_PERFECT_WAVES, 0));
          return {
            id: typeof item.id === "string" && item.id ? item.id.slice(0, 80) : `legacy-run-${index}`,
            at: Math.max(0, Number(item.at) || 0),
            mapId: item.mapId, wave: clearedWave, clearedWave, reachedWave,
            kills: DefenseCore.clampInteger(item.kills, 0, DEFENSE_LIMITS.MAX_REASONABLE_KILLS, 0),
            heartLoss: DefenseCore.clampInteger(item.heartLoss, 0, 9999, 0),
            leaks: DefenseCore.clampInteger(item.leaks, 0, DEFENSE_LIMITS.MAX_REASONABLE_KILLS, 0),
            bosses: DefenseCore.clampInteger(item.bosses, 0, DEFENSE_LIMITS.MAX_REASONABLE_BOSSES, 0),
            perfect: clearedWave > 0 && perfectWaveCount === clearedWave,
            perfectWaveCount,
            ended: item.ended === "gate" ? "gate" : "banked",
            mvpPetId: typeof item.mvpPetId === "string" ? item.mvpPetId.slice(0, 80) : "",
            mvpName: typeof item.mvpName === "string" ? cleanName(item.mvpName) : "RIZO",
            mvpVariant: knownVariant(item.mvpVariant),
            mvpDamage: DefenseCore.clampNumber(item.mvpDamage, 0, DEFENSE_LIMITS.MAX_REASONABLE_DAMAGE, 0),
            powerPaths: DefenseCore.clampInteger(item.powerPaths, 0, DEFENSE_LIMITS.MAX_DEFENSE_TOWERS, 0),
            controlPaths: DefenseCore.clampInteger(item.controlPaths, 0, DEFENSE_LIMITS.MAX_DEFENSE_TOWERS, 0),
            contractId: typeof item.contractId === "string" ? item.contractId.slice(0, 120) : "",
            contractDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.contractDate || "")) ? String(item.contractDate).slice(0, 10) : "",
            contractComplete: clearedWave >= DEFENSE_CONTRACT_TARGET && Boolean(item.contractComplete)
          };
        })
      : [];
    const mastery = records.mastery && typeof records.mastery === "object" && !Array.isArray(records.mastery)
      ? Object.fromEntries(Object.entries(records.mastery).filter(([id, value]) => typeof id === "string" && id && value && typeof value === "object").slice(0, 80).map(([id, value]) => {
          const runs = DefenseCore.clampInteger(value.runs, 0, DEFENSE_LIMITS.MAX_MASTERY_RUNS, 0);
          const waves = Math.min(DEFENSE_LIMITS.MAX_MASTERY_WAVES, DefenseCore.clampInteger(value.waves, 0, DEFENSE_LIMITS.MAX_MASTERY_WAVES, 0), runs * DEFENSE_LIMITS.MAX_SUPPORTED_WAVE);
          return [id.slice(0, 80), {
            petId: id.slice(0, 80),
            name: typeof value.name === "string" ? cleanName(value.name) : "RIZO",
            variant: knownVariant(value.variant),
            runs, waves,
            bestWave: Math.min(waves, clampWave(value.bestWave)),
            pops: Math.min(DefenseCore.clampInteger(value.pops, 0, DEFENSE_LIMITS.MAX_REASONABLE_KILLS, 0), waves * 256),
            damage: DefenseCore.clampNumber(value.damage, 0, DEFENSE_LIMITS.MAX_REASONABLE_DAMAGE, 0),
            bosses: DefenseCore.clampInteger(value.bosses, 0, DEFENSE_LIMITS.MAX_REASONABLE_BOSSES, 0),
            powerPaths: DefenseCore.clampInteger(value.powerPaths, 0, DEFENSE_LIMITS.MAX_REASONABLE_KILLS, 0),
            controlPaths: DefenseCore.clampInteger(value.controlPaths, 0, DEFENSE_LIMITS.MAX_REASONABLE_KILLS, 0),
            lastAt: Math.max(0, Number(value.lastAt) || 0)
          }];
        }).filter(([, value]) => value.waves > 0))
      : {};
    const contracts = Array.isArray(records.contracts)
      ? records.contracts.filter(item => item && typeof item === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")) && DEFENSE_MAP_IDS.includes(item.mapId)).slice(0, 35).map((item, index) => {
          const bestWave = clampWave(item.bestWave);
          return {
            id: typeof item.id === "string" && item.id ? item.id.slice(0, 120) : `legacy-contract-${index}`,
            date: String(item.date).slice(0, 10),
            mapId: item.mapId,
            title: typeof item.title === "string" && item.title ? item.title.slice(0, 80) : "DAILY TRAIL CONTRACT",
            rules: Array.isArray(item.rules) ? [...new Set(item.rules.filter(rule => DEFENSE_CONTRACT_RULE_IDS.has(rule)))].slice(0, 3) : [],
            targetWave: 10,
            bestWave,
            completed: bestWave >= DEFENSE_CONTRACT_TARGET,
            perfect: bestWave >= DEFENSE_CONTRACT_TARGET && Boolean(item.perfect),
            firstAt: Math.max(0, Number(item.firstAt) || 0),
            lastAt: Math.max(0, Number(item.lastAt) || 0)
          };
        }).filter(item => item.rules.length === 3)
      : [];
    const rawSettings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const settings = {};
    for (const setting of DEFENSE_SETTINGS) {
      const value = rawSettings[setting.key];
      settings[setting.key] = setting.kind === "toggle" ? (typeof value === "boolean" ? value : setting.default)
        : setting.choices.some(([choice]) => choice === value) ? value : setting.default;
    }
    const crew = source.crew && typeof source.crew === "object" ? source.crew : {};
    const experienced = best > 0 || history.length > 0 || milestones.length > 0;
    return {
      records: { best, maps, milestones, perfectMaps, history, mastery, contracts },
      settings,
      crew: {
        ids: Array.isArray(crew.ids) ? [...new Set(crew.ids.filter(id => typeof id === "string" && id.length <= 80))].slice(0, 3) : [],
        configured: Boolean(crew.configured)
      },
      school: normalizeDefenseSchool(source.school, { experienced: experienced && !source.schoolKnown && !source.school }),
      introSeen: Boolean(source.introSeen),
      mapIntrosSeen: Array.isArray(source.mapIntrosSeen) ? [...new Set(source.mapIntrosSeen.filter(id => DEFENSE_MAP_IDS.includes(id)))] : []
    };
  }

  // First contact with a save: adopt the fields the hub kept for Defense before
  // v88 (handed over read-only as `legacy`), then normalise them as above.
  function adoptLegacyFields(legacy) {
    const scores = legacy?.scores || {}, settings = legacy?.settings || {}, player = legacy?.player || {};
    const hadSchool = Object.prototype.hasOwnProperty.call(player, "defenseSchool");
    return {
      records: { best: scores.defense, maps: scores.defenseMaps, milestones: scores.defenseMilestones, perfectMaps: scores.defensePerfectMaps, history: scores.defenseHistory, mastery: scores.defenseMastery, contracts: scores.defenseContracts },
      settings: { signatures: settings.defenseSignatures, autoStart: settings.defenseAutoStart, fx: settings.defenseFx, uiScale: settings.defenseUiScale, waveIntel: settings.defenseWaveIntel },
      crew: { ids: settings.defenseRosterIds, configured: settings.defenseRosterConfigured },
      school: hadSchool ? player.defenseSchool : undefined,
      schoolKnown: hadSchool,
      introSeen: Boolean(legacy?.introSeen),
      mapIntrosSeen: legacy?.mapIntrosSeen
    };
  }
  function migrate(data, fromSchema, legacy) {
    if (fromSchema === 0) return normalizeStore(data && Object.keys(data).length ? data : adoptLegacyFields(legacy));
    return normalizeStore(data);
  }
  function loadStore() { store = normalizeStore(host ? host.slice.read() : null); return store; }
  // Defense presentation settings are applied to <body> only while the mode is open.
  function applyDefenseBodySettings(on) {
    const body = document.body;
    body.classList.toggle("defense-signatures-off", Boolean(on && !store?.settings.signatures));
    body.classList.toggle("defense-ui-compact", Boolean(on && store?.settings.uiScale === "compact"));
    body.classList.toggle("defense-ui-large", Boolean(on && store?.settings.uiScale === "large"));
    if (on) body.dataset.defenseFx = store?.settings.fx || "auto"; else delete body.dataset.defenseFx;
  }

  // ===== DEFENSE RUNTIME (moved from the hub, pre-v88) =====
  let pendingDefenseMapChoice = "auto";

  function defenseResolvedMapId(choice = "auto") {
    const unlocked = defenseUnlockedMaps();
    const fallback = (unlocked[unlocked.length - 1] || DEFENSE_MAPS.grove).id;
    return choice !== "auto" && unlocked.some(map => map.id === choice) ? choice : fallback;
  }

  const DEFENSE_LOBBY_ICONS=Object.freeze({grove:"🌲",ember:"🔥",moon:"🌙",storm:"⚡",blizzard:"❄️",eclipse:"🌑"});
  const DEFENSE_ROSTER_WING_SLOTS=3;
  const DEFENSE_GUEST_CREW=Object.freeze([
    Object.freeze({variant:"violet",name:"SHORT CIRCUIT",role:"CHAIN"}),
    Object.freeze({variant:"frost",name:"COLD SHOULDER",role:"CONTROL"}),
    Object.freeze({variant:"obsidian",name:"DEAD WEIGHT",role:"ARMOR"})
  ]);
  const DEFENSE_ROSTER_IDENTITY=Object.freeze({
    classic:{tags:["BALANCED","RALLY"]},ember:{tags:["BURN","PRESSURE"]},toxic:{tags:["POISON","ATTRITION"]},violet:{tags:["CHAIN","PACKS"]},
    moss:{tags:["ROOT","HOLD"]},bubblegum:{tags:["PUSH","RESET"]},frost:{tags:["SLOW","FIRE COUNTER"]},glitch:{tags:["BURST","REVEAL"]},
    obsidian:{tags:["ARMOR","SPLASH"]},aurora:{tags:["AURA","REVEAL"]},golden:{tags:["PROFIT","STALL"]},diamond:{tags:["PIERCE","ARMOR"]},
    shadow:{tags:["CRIT","EXECUTE"]},retro:{tags:["RAPID","REWIND"]}
  });
  function defenseRosterIdentity(pet){const variant=pet?.variant||pet?.hiddenVariant||"classic";return DEFENSE_ROSTER_IDENTITY[variant]||DEFENSE_ROSTER_IDENTITY.classic;}
  function defenseRosterTrainingEdge(pet){
    const skills=pet?.skills||{},entries=[["POWER-TRAINED",Number(skills.power)||0],["QUICK-TRAINED",Number(skills.speed)||0],["SHARP-EYE",Number(skills.instinct)||0],["STURDY CORE",Number(skills.stamina)||0]].sort((a,b)=>b[1]-a[1]);
    return entries[0][1]>=5?entries[0][0]:"FRESH HAND";
  }
  function defenseMasteryLean(record){
    const power=Math.max(0,Number(record?.powerPaths)||0),control=Math.max(0,Number(record?.controlPaths)||0),total=power+control;
    if(total<2)return"NO PATH HABIT";if(power>=control*1.5)return"POWER-LEANING";if(control>=power*1.5)return"CONTROL-LEANING";return"SPLIT-PATH";
  }
  function defenseRosterTrailFit(pet,mapId){
    const perk=typeof DEFENSE_WORLD_OPENING_PERKS!=="undefined"?DEFENSE_WORLD_OPENING_PERKS[mapId]:null,variant=pet?.variant||pet?.hiddenVariant||"classic";
    return Boolean(perk?.variants?.includes(variant));
  }
  function defenseRosterRead(rows,mapId){
    const selected=(rows||[]).filter(row=>row?.pet),captain=selected.find(row=>row.source==="active")||selected[0]||null,crew=selected.filter(row=>row.source!=="active"),toolTags=[];
    for(const row of crew)for(const tag of defenseRosterIdentity(row.pet).tags)if(!toolTags.includes(tag))toolTags.push(tag);
    const fits=selected.filter(row=>defenseRosterTrailFit(row.pet,mapId)),captainVariant=captain?.pet?.variant||captain?.pet?.hiddenVariant||"classic",powerActive=(typeof DEFENSE_ABILITIES!=="undefined"?(DEFENSE_ABILITIES[captainVariant]||DEFENSE_ABILITIES.classic)?.active:null)||"FIELD POWER",controlActive=(typeof DEFENSE_CONTROL_ABILITIES!=="undefined"?(DEFENSE_CONTROL_ABILITIES[captainVariant]||DEFENSE_CONTROL_ABILITIES.classic)?.active:null),captainPower=controlActive&&controlActive!==powerActive?`${powerActive} / ${controlActive}`:powerActive,opening=typeof DEFENSE_WORLD_OPENING_PERKS!=="undefined"?DEFENSE_WORLD_OPENING_PERKS[mapId]:null;
    return{captainPower,tools:toolTags.slice(0,5),fits,openingLabel:opening?.label||"BALANCED OPENING",hasOpeningDeal:Boolean(opening?.variants?.length)};
  }
  function defenseRosterReadMarkup(rows,mapId){
    const read=defenseRosterRead(rows,mapId),fitNames=read.fits.map(row=>row.pet.name),tools=read.tools.length?read.tools.join(" • "):"CAPTAIN-ONLY",fitRoster=fitNames.length?`${fitNames.slice(0,2).join(" + ")}${fitNames.length>2?` +${fitNames.length-2}`:""}`:"NO MATCH",fitCopy=read.hasOpeningDeal?`${read.openingLabel} • ${fitRoster}`:`${read.openingLabel} • ANY CREW`;
    return`<div class="defense-roster-read" data-defense-roster-read><span><small>CAPTAIN FIELD POWER</small><b>${escapeHTML(read.captainPower)}</b></span><span><small>CREW TOOLS</small><b>${escapeHTML(tools)}</b></span><span class="${read.hasOpeningDeal&&fitNames.length?"ready":"quiet"}"><small>TRAIL OPENING</small><b>${escapeHTML(fitCopy)}</b></span></div>`;
  }
  function defenseOwnedRosterEntries(){
    const rows=[{pet:captainPet(),source:"active",rosterIndex:-1}];
    for(const pet of houseCrew)rows.push({pet,source:"house",rosterIndex:pet.rosterIndex});
    return rows.filter(row=>row.pet?.alive!==false&&row.pet?.stage!=="egg");
  }
  function defenseGuestRosterEntry(variant){
    const guest=DEFENSE_GUEST_CREW.find(item=>item.variant===variant);if(!guest)return null;
    const pet={...captainPet(),id:`defense-crew-${guest.variant}`,name:guest.name,variant:guest.variant,hiddenVariant:guest.variant,stage:"kid",alive:true,defenseGuest:true,accessory:null,skills:{power:0,speed:0,instinct:0,stamina:0,luck:0}};
    return{pet,source:"guest",rosterIndex:-1};
  }
  function defenseFullRosterRegistry(){
    const rows=defenseOwnedRosterEntries();
    for(const guest of DEFENSE_GUEST_CREW){const row=defenseGuestRosterEntry(guest.variant);if(row)rows.push(row);}
    return new Map(rows.map(row=>[row.pet.id,row]));
  }
  // Restoration registry: every id that can legally stand on the field, including
  // universal tools/structures that are deliberately absent from the crew roster.
  function defenseRestorableRegistry(){
    const registry=defenseFullRosterRegistry();
    for(const row of defenseUniversalRows())registry.set(row.pet.id,row);
    return registry;
  }
  function defenseGuestAccessAllowed(){return defenseOwnedRosterEntries().filter(row=>row.source==="house").length<2;}
  function defenseDefaultWingIds(){
    const house=defenseOwnedRosterEntries().filter(row=>row.source==="house").slice(0,DEFENSE_ROSTER_WING_SLOTS).map(row=>row.pet.id);
    if(defenseGuestAccessAllowed()&&house.length<DEFENSE_ROSTER_WING_SLOTS)house.push("defense-crew-violet");
    return house.slice(0,DEFENSE_ROSTER_WING_SLOTS);
  }
  function defenseConfiguredWingIds(){
    const registry=defenseFullRosterRegistry(),houseIds=new Set(defenseOwnedRosterEntries().filter(row=>row.source==="house").map(row=>row.pet.id)),guestAllowed=defenseGuestAccessAllowed();
    const raw=Array.isArray(store.crew.ids)?store.crew.ids:[];let guestCount=0;
    const ids=[];
    for(const id of raw){const row=registry.get(id);if(!row||ids.includes(id)||id===captainPet()?.id)continue;if(row.source!=="house"&&row.source!=="guest")continue;if(row.source==="house"&&!houseIds.has(id))continue;if(row.source==="guest"){if(!guestAllowed||guestCount>=1)continue;guestCount+=1;}ids.push(id);if(ids.length>=DEFENSE_ROSTER_WING_SLOTS)break;}
    return ids.length||store.crew.configured?ids:defenseDefaultWingIds();
  }
  function defenseConfiguredRoster(){
    const registry=defenseFullRosterRegistry(),captain=defenseOwnedRosterEntries().find(row=>row.source==="active")||null,rows=[];
    if(captain)rows.push(captain);
    for(const id of defenseConfiguredWingIds()){const row=registry.get(id);if(row)rows.push(row);}
    return rows;
  }
  function defenseSetConfiguredWingIds(ids,{persist=true}={}){
    store.crew.ids=[...new Set((ids||[]).filter(id=>typeof id==="string"))].slice(0,DEFENSE_ROSTER_WING_SLOTS);
    store.crew.configured=true;
    if(persist)saveState(true);
    return defenseConfiguredWingIds();
  }
  function toggleDefenseRosterPick(id){
    const registry=defenseFullRosterRegistry(),row=registry.get(id);if(!row||row.source==="active")return false;if(row.source!=="house"&&row.source!=="guest")return false;
    if(readDefenseCheckpoint())return false;
    let ids=[...defenseConfiguredWingIds()],index=ids.indexOf(id);
    if(index>=0)ids.splice(index,1);else{
      if(row.source==="guest"){if(!defenseGuestAccessAllowed())return false;ids=ids.filter(existing=>registry.get(existing)?.source!=="guest");}
      if(ids.length>=DEFENSE_ROSTER_WING_SLOTS)return false;
      ids.push(id);
    }
    defenseSetConfiguredWingIds(ids);return true;
  }
  function defenseRosterLobbyMarkup(checkpoint=null,mapId=defenseResolvedMapId(pendingDefenseMapChoice)){
    const configured=defenseConfiguredRoster(),selected=new Set(configured.map(row=>row.pet.id)),captain=configured.find(row=>row.source==="active"),house=defenseOwnedRosterEntries().filter(row=>row.source==="house"),locked=Boolean(checkpoint),guestAllowed=defenseGuestAccessAllowed(),wingCount=Math.max(0,configured.length-(captain?1:0));
    const card=(row,{captainCard=false,selectable=true}={})=>{
      const variant=VARIANTS.find(item=>item.id===(row.pet.variant||row.pet.hiddenVariant))||VARIANTS[0],stats=defenseTowerStats(row.pet),mastery=store.records.mastery?.[row.pet.id],title=mastery?defenseMasteryTitle(mastery):row.source==="guest"?"TRIAL ONLY":"UNTESTED",lean=row.source==="guest"?"NO PERMANENT RECORD":defenseMasteryLean(mastery),training=row.source==="guest"?"":defenseRosterTrainingEdge(row.pet),detail=training&&training!=="FRESH HAND"?`${title} • ${training}`:title,isSelected=selected.has(row.pet.id),trailFit=defenseRosterTrailFit(row.pet,mapId),tag=captainCard?"CAPTAIN":row.source==="guest"?"LOANER":"OWNED",action=isSelected&&!captainCard?"REMOVE":isSelected?"LOCKED":"ADD",identity=defenseRosterIdentity(row.pet);
      return`<button type="button" class="defense-roster-build-card ${captainCard?"captain":""} ${row.source==="guest"?"guest":"owned"} ${isSelected?"selected":""} ${trailFit?"trail-fit":""}" ${selectable&&!captainCard&&!locked?`data-defense-roster-pick="${escapeHTML(row.pet.id)}"`:"disabled"} style="--roster-color:${variant.color}" aria-pressed="${isSelected}" title="${escapeHTML(row.pet.name)} • ${identity.tags.join(" • ")}${trailFit?" • OPENING DEAL MATCH":""}">${petMarkup({pet:row.pet,extraClass:"defense-roster-build-pet",context:"thumbnail",label:row.pet.name})}<span><small>${tag} • ${escapeHTML(stats.profile.label)}</small><b>${escapeHTML(row.pet.name)}</b><em>${escapeHTML(detail)}</em><u>${identity.tags.map(item=>`<i>${escapeHTML(item)}</i>`).join("")}${trailFit?`<i class="trail">TRAIL FIT</i>`:""}</u>${mastery&&row.source!=="guest"&&lean!=="NO PATH HABIT"?`<strong>${escapeHTML(lean)}</strong>`:""}</span><i>${action}</i></button>`;
    };
    const selectedCards=configured.map(row=>card(row,{captainCard:row.source==="active",selectable:row.source!=="active"})).join("");
    const empty=Array.from({length:Math.max(0,DEFENSE_ROSTER_WING_SLOTS-wingCount)},()=>`<span class="defense-roster-empty"><b>+</b><small>OPEN CREW SLOT</small></span>`).join("");
    const ownedPool=house.length?house.map(row=>card(row)).join(""):`<p class="defense-roster-empty-copy">Raise or discover another Rizo and it can join this crew.</p>`;
    const guests=guestAllowed?DEFENSE_GUEST_CREW.map(item=>card(defenseGuestRosterEntry(item.variant))).join(""):"";
    const guestCopy=guestAllowed?`<div class="defense-roster-pool-head"><span><small>TRIAL LOANER</small><b>ONE TEMPORARY TRIAL SLOT</b></span><em>NO MVP • NO MASTERY</em></div><div class="defense-roster-pool guest-pool">${guests}</div>`:`<p class="defense-roster-graduated">TRAIL LOANERS RETIRED • YOUR HOUSE NOW SUPPLIES THE CREW.</p>`;
    return`<section class="defense-roster-builder ${locked?"locked":""}"><div class="defense-roster-builder-head"><span><small>DEFENSE CREW</small><b>${escapeHTML(captainPet()?.name||"RIZO")} LEADS EVERY RUN</b></span><em>${wingCount}/${DEFENSE_ROSTER_WING_SLOTS} CREW SLOTS</em></div>${locked?`<p class="defense-roster-lock-note">A run is checkpointed. Resume or discard it before changing this crew.</p>`:""}${defenseRosterReadMarkup(configured,mapId)}<div class="defense-roster-selected">${selectedCards}${empty}</div><div class="defense-roster-pool-head"><span><small>YOUR HOUSE • BUILD FOR THIS TRAIL</small><b>DIFFERENT RIZOS, DIFFERENT ANSWERS</b></span><em>${house.length} AVAILABLE</em></div><div class="defense-roster-pool">${ownedPool}</div>${guestCopy}</section>`;
  }
  function defenseWorldLobbyMarkup(choice = pendingDefenseMapChoice) {
    const best=Math.max(0,Math.floor(Number(store.records.best)||0),0),unlocked=defenseUnlockedMaps(),resolvedId=defenseResolvedMapId(choice),resolved=DEFENSE_MAPS[resolvedId]||DEFENSE_MAPS.grove,perMap=store.records.maps||{},checkpoint=readDefenseCheckpoint(),resolvedBest=Math.max(0,Math.floor(Number(perMap[resolvedId])||0));
    const worlds=DEFENSE_MAP_ORDER.map(id=>{const map=DEFENSE_MAPS[id],locked=best<map.unlockWave,selected=resolvedId===id,mapBest=Math.max(0,Math.floor(Number(perMap[id])||0)),status=locked?`${map.unlockWave}`:mapBest?`${mapBest}`:"NEW";return`<button type="button" class="defense-world-pick ${selected?"selected":""} ${locked?"locked":""}" ${locked?"disabled":`data-defense-lobby-map="${id}"`} style="--map-accent:${defenseMapAccent(id)}" aria-label="${locked?`World ${map.level} locked until Wave ${map.unlockWave}`:`Choose World ${map.level}, ${escapeHTML(map.name)}`}" aria-pressed="${selected&&!locked?"true":"false"}"><small>${map.level}</small><b>${DEFENSE_LOBBY_ICONS[id]||map.icon}</b><span>${locked?"🔒 ":""}${status}</span></button>`;}).join("");
    const resume=checkpoint?`<button class="defense-lobby-resume-simple" type="button" data-resume-defense-run><span>▶</span><div><small>CONTINUE RUN</small><b>${escapeHTML((DEFENSE_MAPS[checkpoint.mapId]||DEFENSE_MAPS.grove).name)} • WAVE ${checkpoint.currentWave||checkpoint.clearedWave+1}</b></div><i>›</i></button>`:"";
    return`<div class="modal-card defense-world-lobby defense-world-lobby-simple rizo-defense-lobby v79-simple"><div class="defense-lobby-brand v79"><img src="./assets/rizo-full-mark.png" alt=""/><div><small>RIZO DEFENSE</small><b>CHOOSE A TRAIL</b></div><em>${unlocked.length}/${DEFENSE_MAP_ORDER.length} OPEN</em></div>${resume}<section class="defense-world-hero" style="--map-accent:${defenseMapAccent(resolvedId)}"><div class="defense-world-hero-map"><strong>${DEFENSE_LOBBY_ICONS[resolvedId]||resolved.icon}</strong>${defenseMiniRouteMarkup(resolved)}<i>WORLD ${resolved.level}</i></div><div class="defense-world-hero-copy"><small>${escapeHTML(resolved.routeType)} TRAIL</small><h2>${escapeHTML(resolved.name)}</h2><p>${escapeHTML(resolved.strategy)}</p><div><span>♥ ${resolved.lives}</span><span>🪙 ${BASE_DEFENSE_STARTING_CASH}</span><span>${resolvedBest?`BEST ${resolvedBest}`:"NEW TRAIL"}</span></div></div></section><div class="defense-world-picks" aria-label="Choose Defense world">${worlds}</div>${defenseRosterLobbyMarkup(checkpoint,resolvedId)}<p class="defense-lobby-one-line">Captain deploys free. Bring the crew that answers this trail.</p><div class="modal-buttons defense-lobby-actions v79"><button type="button" data-close-modal>BACK</button><button type="button" data-defense-lobby-more>MORE</button><button class="primary" type="button" data-enter-defense-world="${escapeHTML(resolvedId)}">PLAY ${escapeHTML(resolved.name).toUpperCase()}</button></div></div>`;
  }

  function showDefenseWorldExtras(){
    const contract=ensureDailyDefenseContract(),school=defenseSchoolState(),done=school.completed.length;
    showModal(`<div class="modal-card defense-world-extras"><small>RIZO DEFENSE</small><h2>MORE</h2><p>The stuff you do not need in your face to start playing.</p><div class="defense-extra-grid"><button type="button" data-defense-records><b>🏆 RECORDS</b><small>Best waves and medals.</small></button><button type="button" data-defense-field-guide="rizos"><b>❓ GUIDE</b><small>Rizos and balloon types.</small></button><button type="button" data-defense-school-open><b>🎓 TRAIL SCHOOL</b><small>${done}/6 lessons.</small></button><button type="button" data-enter-defense-contract="${escapeHTML(contract.id)}"><b>✦ DAILY CHALLENGE</b><small>${escapeHTML(contract.title)}</small></button></div><div class="modal-buttons"><button class="primary" type="button" data-defense-records-back>BACK TO WORLDS</button></div></div>`);
  }
  function showDefenseWorldLobby(choice = pendingDefenseMapChoice) {
    pendingDefenseMapChoice = choice;
    showModal(defenseWorldLobbyMarkup(choice));
    playDefenseMusic();
  }

  function showDefenseOriginIntro(force = false) {
    if (!force && store.introSeen) {
      showDefenseWorldLobby("auto");
      return;
    }
    host?.audio?.music?.("shadow");
    host?.ui?.cutscene?.({scene:"shadow",kicker:"THE FOREST SENT A WARNING",title:"THE EMBER GATE IS UNDER ATTACK.",symbol:"◉",duration:1750,className:"feature-unlock-cutscene defense-origin-cutscene defense-origin-v37",after:()=>{
      showModal(`<div class="modal-card defense-origin-reveal unlock-reveal defense-origin-v37-reveal"><small>RIZO DEFENSE • ORIGIN MOVIE</small><div class="defense-origin-stage"><div class="defense-origin-siren"></div><div class="defense-origin-path"></div><div class="defense-origin-gate"><i></i><b>EMBER<br>GATE</b></div><div class="defense-origin-balloon balloon-one"><i></i></div><div class="defense-origin-balloon balloon-two"><i></i></div><div class="defense-origin-balloon balloon-three"><i></i></div>${petMarkup({extraClass:"defense-origin-rizo",context:"cutscene"})}<div class="defense-origin-caption"><b>THE GATE CALLED YOUR HOUSE.</b><span>Every Rizo you raise can stand beside the trail.</span></div></div><h2>THE BALLOONS FOUND RIZO.</h2><p class="big-line">YOUR PETS ARE THE DEFENSE.</p><p>Choose a world, tap a Rizo, tap open grass, and survive long enough to unlock stranger maps, weather, bosses, and abilities.</p><div class="modal-buttons"><button data-close-modal>BACK OUT</button><button class="primary" data-defense-intro-continue>OPEN WORLD ROUTE</button></div></div>`);
      sfx("legendary");
      haptic([18,26,18,42]);
    }});
  }


  // ===== RIZO DEFENSE: automatic worlds, bosses and drag/tap placement =====
  // Defense remains one Arcade mode and one pet renderer. Every deployed unit,
  // roster card and drag ghost is still generated by petMarkup().
  function defenseCurvePoint(p0,p1,p2,p3,t){
    const t2=t*t,t3=t2*t;
    return{
      x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
      y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
    };
  }
  function defenseBuildCurvedPath(anchors,detail=10){
    const source=(anchors||[]).map(point=>({x:Number(point.x)||0,y:Number(point.y)||0}));
    if(source.length<2)return source;
    const path=[];
    for(let i=0;i<source.length-1;i+=1){
      const p1=source[i],p2=source[i+1],p0=i>0?source[i-1]:{x:p1.x-(p2.x-p1.x),y:p1.y-(p2.y-p1.y)},p3=i+2<source.length?source[i+2]:{x:p2.x+(p2.x-p1.x),y:p2.y+(p2.y-p1.y)};
      for(let step=0;step<detail;step+=1){
        const point=defenseCurvePoint(p0,p1,p2,p3,step/detail);
        path.push({x:clamp(point.x,-.08,1.08),y:clamp(point.y,.055,.945)});
      }
    }
    path.push({...source[source.length-1]});
    return path;
  }
  function defensePrepareMap(map){
    map.route=(map.route||map.path||[]).map(point=>({...point}));
    map.path=defenseBuildCurvedPath(map.route,Math.max(16,map.curveDetail||16));
    map.pathMetrics=defensePathMetrics(map.path);
    return map;
  }
  const DEFENSE_MAPS = Object.fromEntries(Object.entries({
    grove:{id:"grove",level:1,name:"PINE BEND",icon:"♣",entrance:"WESTERN PINE LINE",lore:"The first trail the Ember Gate ever learned to defend winds around the old keeper grove.",lesson:"Own the long center bend, then cover the late return toward the gate.",strategy:"LONG BEND • DOUBLE COVERAGE",routeType:"BEND",unlockWave:0,className:"map-grove",lives:20,hp:1,speed:1,specialBias:0,weather:"clear",weatherCopy:"Calm air. Learn the trail.",curveDetail:11,blockedZones:[{x:.48,y:.49,r:.056,kind:"pine"}],landmarks:[{x:.48,y:.49,kind:"pine-grove",label:"OLD GROVE"},{x:.76,y:.43,kind:"keeper-stone",label:"KEEPER STONE"}],buildPockets:[{x:.41,y:.65},{x:.76,y:.44}],mechanic:{kind:"keeper",icon:"✦",label:"KEEPER STONE",copy:"Build in the stone ring for +12% reach."},mechanicZones:[{x:.76,y:.43,r:.145,kind:"keeper"}],route:[{x:-.06,y:.21},{x:.12,y:.19},{x:.27,y:.31},{x:.29,y:.50},{x:.18,y:.67},{x:.36,y:.79},{x:.58,y:.74},{x:.68,y:.57},{x:.61,y:.39},{x:.70,y:.22},{x:.87,y:.28},{x:.90,y:.51},{x:.80,y:.70},{x:1.06,y:.74}]},
    ember:{id:"ember",level:2,name:"EMBER SWITCHBACK",icon:"◆",entrance:"LOW ASH CUT",lore:"Old fire roads fold through crater country in three deliberate hairpins.",lesson:"Build beside the hairpins where one Rizo can touch the trail more than once.",strategy:"HAIRPINS • REPEATED HITS",routeType:"SWITCHBACK",unlockWave:25,className:"map-ember",lives:20,hp:1.06,speed:1.05,specialBias:3,weather:"ash",weatherCopy:"Ash hides the edges of the road.",curveDetail:12,blockedZones:[{x:.42,y:.46,r:.07,kind:"crater"},{x:.74,y:.30,r:.043,kind:"vent"}],landmarks:[{x:.42,y:.46,kind:"lava-crater",label:"ASH HEART"},{x:.74,y:.30,kind:"ember-vent",label:"FIRE VENT"}],buildPockets:[{x:.29,y:.27},{x:.64,y:.64}],mechanic:{kind:"vent",icon:"♨",label:"FIRE DRAFT",copy:"Outer draft: +16% speed, -4% reach. Hot core: +28% speed, -12% reach."},mechanicZones:[{x:.74,y:.30,r:.19,core:.74,kind:"vent"}],route:[{x:-.06,y:.72},{x:.15,y:.72},{x:.29,y:.61},{x:.24,y:.44},{x:.12,y:.29},{x:.25,y:.15},{x:.49,y:.17},{x:.62,y:.30},{x:.60,y:.51},{x:.47,y:.67},{x:.66,y:.78},{x:.86,y:.65},{x:.87,y:.42},{x:1.06,y:.26}]},
    moon:{id:"moon",level:3,name:"MOON LOOP",icon:"☾",entrance:"NORTH MOON ARC",lore:"A silver route curls almost completely around a moonstone basin before escaping east.",lesson:"Use the crescent loop for repeated coverage and Moonlight reveals.",strategy:"NEAR LOOP • LONG EXPOSURE",routeType:"LOOP",unlockWave:50,className:"map-moon",lives:18,hp:1.13,speed:1.01,specialBias:6,weather:"moon",weatherCopy:"Long shadows make camo balloons harder to read.",curveDetail:12,blockedZones:[{x:.59,y:.47,r:.068,kind:"moonstone"}],landmarks:[{x:.59,y:.47,kind:"moon-basin",label:"SILVER BASIN"},{x:.25,y:.47,kind:"moon-arch",label:"MOON ARCH"}],buildPockets:[{x:.39,y:.35},{x:.73,y:.48}],mechanic:{kind:"basin",icon:"☾",label:"SILVER BASIN",copy:"Basin grants veil sight and +8% reach. Moonlight also feeds +18% attack speed."},mechanicZones:[{x:.59,y:.47,r:.185,kind:"basin"}],route:[{x:-.06,y:.25},{x:.15,y:.13},{x:.38,y:.18},{x:.50,y:.34},{x:.43,y:.51},{x:.30,y:.64},{x:.43,y:.79},{x:.67,y:.75},{x:.82,y:.61},{x:.87,y:.43},{x:.77,y:.28},{x:.82,y:.13},{x:1.06,y:.20}]},
    storm:{id:"storm",level:4,name:"STORM CIRCUIT",icon:"ϟ",entrance:"CHARGED WEST RUN",lore:"A broken weather circuit creates long straights between charged turns and control pockets.",lesson:"Spread CONTROL coverage across both straights so surge balloons cannot escape one cluster.",strategy:"LONG STRAIGHTS • SPLIT COVERAGE",routeType:"CIRCUIT",unlockWave:75,className:"map-storm",lives:17,hp:1.21,speed:1.08,specialBias:10,weather:"storm",weatherCopy:"Lightning surges briefly accelerate every balloon.",curveDetail:11,blockedZones:[{x:.49,y:.32,r:.052,kind:"pylon"},{x:.87,y:.31,r:.05,kind:"pylon"}],landmarks:[{x:.49,y:.32,kind:"storm-pylon",label:"WEST PYLON"},{x:.87,y:.31,kind:"storm-pylon",label:"EAST PYLON"},{x:.60,y:.68,kind:"storm-coil",label:"SURGE COIL"}],buildPockets:[{x:.25,y:.48},{x:.81,y:.55}],mechanic:{kind:"pylon",icon:"ϟ",label:"LIVE PYLONS",copy:"One pylon: +8% speed. Occupy both to close the circuit: +16%, or +34% in a surge.",link:true},mechanicZones:[{x:.49,y:.32,r:.17,kind:"pylon"},{x:.87,y:.31,r:.17,kind:"pylon"}],route:[{x:-.06,y:.56},{x:.12,y:.72},{x:.33,y:.69},{x:.42,y:.52},{x:.37,y:.34},{x:.26,y:.22},{x:.42,y:.12},{x:.67,y:.17},{x:.76,y:.36},{x:.69,y:.54},{x:.59,y:.67},{x:.77,y:.78},{x:.95,y:.63},{x:1.06,y:.44}]},
    blizzard:{id:"blizzard",level:5,name:"WHITEOUT PASS",icon:"❄",entrance:"SOUTH ICE SHELF",lore:"A wide mountain pass sweeps around frozen shelves before climbing toward the gate.",lesson:"Stagger wide-range Rizos across the upper and lower shelves instead of stacking one bend.",strategy:"WIDE PASS • STAGGERED RANGE",routeType:"PASS",unlockWave:100,className:"map-blizzard",lives:16,hp:1.30,speed:1.04,specialBias:14,weather:"blizzard",weatherCopy:"Whiteouts shrink most Rizo attack ranges for a few seconds.",curveDetail:11,blockedZones:[{x:.11,y:.48,r:.06,kind:"ice"},{x:.68,y:.54,r:.064,kind:"ice"}],landmarks:[{x:.11,y:.48,kind:"ice-shelf",label:"LOW SHELF"},{x:.68,y:.54,kind:"ice-shelf",label:"HIGH SHELF"},{x:.48,y:.12,kind:"snow-peak",label:"NORTH PEAK"}],buildPockets:[{x:.35,y:.61},{x:.73,y:.33}],mechanic:{kind:"shelter",icon:"❄",label:"ICE SHELTER",copy:"Shelter ignores Whiteout and adds +4% reach. During Whiteout it opens to +14% reach."},mechanicZones:[{x:.35,y:.61,r:.15,kind:"shelter"},{x:.68,y:.54,r:.18,kind:"shelter"}],route:[{x:-.06,y:.75},{x:.14,y:.67},{x:.23,y:.49},{x:.16,y:.29},{x:.28,y:.13},{x:.49,y:.20},{x:.56,y:.38},{x:.47,y:.55},{x:.56,y:.72},{x:.78,y:.76},{x:.91,y:.61},{x:.84,y:.42},{x:.89,y:.21},{x:1.06,y:.18}]},
    eclipse:{id:"eclipse",level:6,name:"ECLIPSE RIDGE",icon:"◉",entrance:"DARK RIDGE MOUTH",lore:"The oldest route coils through three shadow monuments before breaking toward the final gate.",lesson:"Cover the inner coil and the late ridge separately while preserving veil sight and armor break.",strategy:"INNER COIL • LATE RIDGE",routeType:"RIDGE",unlockWave:150,className:"map-eclipse",lives:15,hp:1.42,speed:1.10,specialBias:19,weather:"eclipse",weatherCopy:"The eclipse periodically turns every balloon camouflaged.",curveDetail:12,blockedZones:[{x:.42,y:.29,r:.06,kind:"obelisk"},{x:.72,y:.72,r:.06,kind:"obelisk"},{x:.82,y:.42,r:.05,kind:"obelisk"}],landmarks:[{x:.42,y:.29,kind:"eclipse-obelisk",label:"FIRST SHADOW"},{x:.72,y:.72,kind:"eclipse-obelisk",label:"SECOND SHADOW"},{x:.82,y:.42,kind:"eclipse-rift",label:"RIFT MOUTH"}],buildPockets:[{x:.45,y:.48},{x:.84,y:.82}],mechanic:{kind:"seal",icon:"◉",label:"SHADOW SEALS",copy:"One seal grants veil sight +6% reach. Occupy both to resonate them at +14% reach.",link:true},mechanicZones:[{x:.45,y:.48,r:.145,kind:"seal"},{x:.82,y:.79,r:.15,kind:"seal"}],route:[{x:-.06,y:.20},{x:.16,y:.20},{x:.31,y:.33},{x:.29,y:.55},{x:.18,y:.71},{x:.39,y:.81},{x:.59,y:.71},{x:.65,y:.51},{x:.58,y:.33},{x:.68,y:.16},{x:.88,y:.22},{x:.94,y:.44},{x:.85,y:.65},{x:1.06,y:.72}]}
  }).map(([id,map])=>[id,defensePrepareMap(map)]));
  const DEFENSE_MAP_ORDER=["grove","ember","moon","storm","blizzard","eclipse"];
  const DEFENSE_SCHOOL_LESSONS=[
    {id:"route",step:1,title:"READ THE TRAIL",copy:"Trace the real entrance-to-gate route before building."},
    {id:"placement",step:2,title:"PLACE A RIZO",copy:"Drag a roster card—or tap it, then tap open grass."},
    {id:"targeting",step:3,title:"CHANGE TARGETING",copy:"After Wave 1, inspect a Rizo and change FIRST to another priority."},
    {id:"intel",step:4,title:"READ THREAT INTEL",copy:"Open THREATS when a special enemy enters the plan."},
    {id:"doctrine",step:5,title:"CHOOSE A PATH",copy:"At Level 3, commit one Rizo to POWER or CONTROL."},
    {id:"abilities",step:6,title:"CAST AN EFFECT",copy:"During a live wave, cast one ready activated effect."}
  ];
  let defenseFieldGuideTab="rizos";
  function normalizeDefenseSchool(raw,{experienced=false}={}){const ids=DEFENSE_SCHOOL_LESSONS.map(item=>item.id),input=raw&&typeof raw==="object"?raw:{},completed=[...new Set((Array.isArray(input.completed)?input.completed:[]).filter(id=>ids.includes(id)))];if(experienced&&!completed.length)return{dismissed:true,completed:[...ids],replay:false};return{dismissed:Boolean(input.dismissed),completed,replay:Boolean(input.replay)};}
  function defenseSchoolState(){store.school=normalizeDefenseSchool(store.school);return store.school;}
  function defenseSchoolComplete(){return DEFENSE_SCHOOL_LESSONS.every(item=>defenseSchoolState().completed.includes(item.id));}
  function defenseSchoolNext(){const school=defenseSchoolState();return DEFENSE_SCHOOL_LESSONS.find(item=>!school.completed.includes(item.id))||null;}
  function completeDefenseSchoolLesson(id,{silent=false}={}){const school=defenseSchoolState(),lesson=DEFENSE_SCHOOL_LESSONS.find(item=>item.id===id);if(!lesson||school.completed.includes(id))return false;const required=DEFENSE_SCHOOL_LESSONS.slice(0,lesson.step-1);if(required.some(item=>!school.completed.includes(item.id)))return false;school.completed.push(id);school.dismissed=false;saveState(true);if(!silent){setDefenseMessage?.(`TRAIL SCHOOL • ${lesson.title}`,lesson.step===6?"COURSE COMPLETE. THE FIELD IS YOURS.":`LESSON ${lesson.step}/6 RECORDED.`);sfx?.("reward");haptic?.([8,14,8]);}updateDefenseSchoolCoach();return true;}
  function restartDefenseSchool(){store.school={dismissed:false,completed:[],replay:true};if(mini.defense)mini.defense.schoolHiddenRun=false;saveState(true);updateDefenseSchoolCoach();}
  function defenseSchoolRelevant(lesson){const d=mini.defense;if(!d||!lesson)return false;if(lesson.id==="route")return d.towers.length===0;if(lesson.id==="placement")return true;if(lesson.id==="targeting")return d.towers.length>0&&d.wave>=1;if(lesson.id==="intel"){const counts=defenseIntelCounts();return [...counts.keys()].some(key=>!["puff","fleet"].includes(key));}if(lesson.id==="doctrine")return d.towers.some(tower=>tower.upgrade>=2&&!tower.doctrine);if(lesson.id==="abilities")return defenseIsActiveWave(d)&&d.towers.some(tower=>tower.upgrade>=2&&tower.doctrine&&defenseAbilityRemaining(tower)<=0);return false;}
  function defenseSchoolCoachMarkup(){const school=defenseSchoolState(),lesson=defenseSchoolNext();if(school.dismissed||defenseSchoolComplete()||mini.defense?.schoolHiddenRun||!defenseSchoolRelevant(lesson))return"";const action=lesson.id==="route"?'<button type="button" data-defense-trace-route>TRACE ROUTE</button>':lesson.id==="intel"?'<button type="button" data-defense-toggle-intel>OPEN THREATS</button>':"";return`<section class="defense-school-coach-card lesson-${lesson.id}"><span>${lesson.step}</span><div><small>TRAIL SCHOOL • ${lesson.step}/6</small><b>${escapeHTML(lesson.title)}</b><em>${escapeHTML(lesson.copy)}</em></div>${action}<button type="button" class="school-hide" data-defense-school-hide-run aria-label="Hide coaching for this run">×</button></section>`;}
  function updateDefenseSchoolCoach(){const host=$("#defenseSchoolCoach"),d=mini.defense;if(!host||!d)return;const markup=defenseSchoolCoachMarkup(),signature=markup;if(signature!==d.schoolCoachSignature){host.innerHTML=markup;d.schoolCoachSignature=signature;}host.hidden=!markup;}
  function defenseSchoolLobbyMarkup(){const school=defenseSchoolState(),done=school.completed.length,complete=defenseSchoolComplete();return`<section class="defense-school-lobby ${complete?"complete":""}"><span>${complete?"✓":"▤"}</span><div><small>OPTIONAL • REAL CONTROLS</small><b>TRAIL SCHOOL • ${done}/6</b><em>${complete?"Course complete. Replay it whenever you want.":school.dismissed?"Coaching is hidden. Your progress is preserved.":"Six short lessons appear only when their mechanic matters."}</em></div><button type="button" data-defense-school-open>${complete?"REPLAY":"OPEN"}</button></section>`;}
  function showDefenseTrailSchool(){const school=defenseSchoolState(),rows=DEFENSE_SCHOOL_LESSONS.map(item=>`<article class="trail-school-row ${school.completed.includes(item.id)?"done":""}"><i>${school.completed.includes(item.id)?"✓":item.step}</i><div><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.copy)}</small></div></article>`).join("");showModal(`<div class="modal-card trail-school-modal"><small>RIZO DEFENSE • OPTIONAL COURSE</small><h2>TRAIL SCHOOL</h2><p>Learn on the real battlefield. Nothing here changes prices, enemies, rewards, or your Rizo.</p><div class="trail-school-list">${rows}</div><div class="modal-buttons"><button type="button" data-defense-school-dismiss>${school.dismissed?"ENABLE COACHING":"HIDE COACHING"}</button><button type="button" data-defense-school-restart>RESTART COURSE</button><button class="primary" type="button" data-defense-records-back>BACK TO WORLD ROUTE</button></div></div>`);}
  function defenseTargetingGuide(variant){return["obsidian","diamond","shadow"].includes(variant)?"STRONG for durable threats; FIRST when the Gate is under pressure.":["frost","moss","bubblegum","retro"].includes(variant)?"FIRST to control runners before they escape.":variant==="golden"?"FIRST for steady pop income; CLOSE if protecting a dense bend.":"FIRST is reliable. Change to STRONG, LAST, or CLOSE when the map asks for it.";}
  function defenseFieldGuideMarkup(tab=defenseFieldGuideTab){defenseFieldGuideTab=["rizos","threats","worlds"].includes(tab)?tab:"rizos";const tabs=`<nav class="field-guide-tabs"><button type="button" data-field-guide-tab="rizos" class="${defenseFieldGuideTab==="rizos"?"active":""}">YOUR RIZOS</button><button type="button" data-field-guide-tab="threats" class="${defenseFieldGuideTab==="threats"?"active":""}">THREATS</button><button type="button" data-field-guide-tab="worlds" class="${defenseFieldGuideTab==="worlds"?"active":""}">WORLDS</button></nav>`;let body="";if(defenseFieldGuideTab==="rizos")body=defenseRoster().filter(row=>!defenseStructureType(row)).map(row=>{const pet=row.pet,variantId=pet.variant||pet.hiddenVariant||"classic",variant=VARIANTS.find(item=>item.id===variantId)||VARIANTS[0],ability=DEFENSE_ABILITIES[variantId]||DEFENSE_ABILITIES.classic,mastery=defenseMasteryForPet(pet.id)||{},unlock=defenseMasteryUnlockCopy(mastery);return`<article class="field-guide-rizo" style="--guide-color:${variant.color}"><span>${petMarkup({pet,extraClass:"field-guide-pet",context:"thumbnail",label:pet.name})}</span><div><small>${escapeHTML(variant.name)} • ${escapeHTML(defenseMasteryTitle(mastery))}</small><b>${escapeHTML(pet.name)}</b><p><strong>PASSIVE</strong>${escapeHTML(ability.passive)}</p><p><strong>ACTIVE</strong>${escapeHTML(ability.active)} — ${escapeHTML(ability.copy)}</p><p><strong>TARGETING</strong>${escapeHTML(defenseTargetingGuide(variantId))}</p><p><strong>POWER</strong>${escapeHTML(DEFENSE_DOCTRINES.power.copy)}</p><p><strong>CONTROL</strong>${escapeHTML(DEFENSE_DOCTRINES.control.copy)}</p><em>${escapeHTML(unlock.current)} • ${escapeHTML(unlock.next)}</em></div></article>`;}).join("")||"<p>Raise a Rizo beyond the egg stage to add it to the field guide.</p>";else if(defenseFieldGuideTab==="threats"){const normals=Object.entries(DEFENSE_ENEMIES).map(([key,data])=>`<article class="field-guide-threat" style="--guide-color:${data.color}"><span class="defense-guide-balloon balloon-${escapeHTML(key)}" aria-hidden="true"><i></i></span><div><small>${escapeHTML(data.trait||"THREAT")}</small><b>${escapeHTML(data.name)}</b><p>${escapeHTML(data.intel||"")}</p><em>COUNTER • ${escapeHTML(data.counter||"ANY RIZO")}</em></div></article>`).join("");const bosses=DEFENSE_BOSSES.map(data=>`<article class="field-guide-threat boss" style="--guide-color:${data.color}"><span class="defense-guide-balloon boss ${escapeHTML(data.className||"")}" aria-hidden="true"><i></i></span><div><small>BOSS • ${escapeHTML(data.trait||"")}</small><b>${escapeHTML(data.name)}</b><p>${escapeHTML(data.hint||"")}</p><em>COUNTER • ${escapeHTML(data.counter||"FOCUS FIRE")}</em></div></article>`).join("");body=normals+bosses;}else body=DEFENSE_MAP_ORDER.map(id=>{const map=DEFENSE_MAPS[id],open=defenseUnlockedMaps().some(item=>item.id===id),best=Math.max(0,Number(store.records.maps?.[id])||0);return`<article class="field-guide-world ${open?"":"locked"}" style="--guide-color:${defenseMapAccent(id)}"><span>${map.icon}</span><div><small>WORLD ${map.level} • ${open?`BEST CLEARED ${best}`:`UNLOCK • CLEAR ${map.unlockWave}`}</small><b>${escapeHTML(map.name)}</b><p><strong>${escapeHTML(map.routeType)}</strong>${escapeHTML(map.strategy)}</p><p>${escapeHTML(map.lore)}</p><em>TRAIL LESSON • ${escapeHTML(map.lesson)}</em><small class="field-guide-map-mechanic">${escapeHTML(map.mechanic?.icon||"✦")} MAP MECHANIC • ${escapeHTML(map.mechanic?.copy||"")}</small></div></article>`;}).join("");return`<div class="modal-card defense-field-guide"><small>KEEPER FIELD GUIDE • LIVE DEFINITIONS</small><div class="field-guide-head"><div><h2>KNOW YOUR FIELD.</h2><p>Roster, counters, and worlds are read directly from the same definitions used by Defense.</p></div><b>NO HIDDEN STATS</b></div>${tabs}<div class="field-guide-scroll">${body}</div><div class="modal-buttons"><button type="button" data-defense-records-back>WORLD ROUTE</button><button class="primary" type="button" data-close-modal>CLOSE GUIDE</button></div></div>`;}
  function showDefenseFieldGuide(tab=defenseFieldGuideTab){defenseFieldGuideTab=tab;if(mini.active&&mini.mode==="defense"&&defenseIsActiveWave(mini.defense)&&!mini.defense.paused){mini.defense.paused=true;mini.defense.autoPaused=false;setDefenseMessage("FIELD GUIDE • TRAIL PAUSED","Closing the guide will not silently resume the wave.");markDefenseUi();flushDefenseUi(true);}showModal(defenseFieldGuideMarkup(defenseFieldGuideTab));}
  function defenseControlLegendMarkup(){
    const rows=[
      {icon:"▶/Ⅱ",label:"MAIN BUTTON",copy:"Start the next wave, pause, or resume."},
      {icon:"1×",label:"SPEED",copy:"Cycles ½× • 1× • 2×. Base pace stays deliberate."},
      {icon:"?",label:"THREATS",copy:"Shows what is coming and which Rizos counter it."},
      {icon:"⚡",label:"POWERS",copy:"One button per power. The badge counts ready power groups."},
      {icon:"⛶",label:"FULLSCREEN",copy:"Uses a full-height landscape field when your device allows it."},
      {icon:"◌",label:"CYAN RING",copy:"A selected Rizo’s attack reach."},
      {icon:"LV3",label:"LEVEL TAG",copy:"The placed Rizo’s upgrade level. No tag means Level 1."},
      {icon:"#2",label:"COPY TAG",copy:"Which deployed copy of the same Rizo this is."},
      {icon:"× ◉ !",label:"THREAT STATE",copy:"Armor broken, revealed, or a boss action charging. Blank state badges are hidden."},
      {icon:"◎",label:"PLACEMENT FOOT",copy:"Green clears the trail and nearby Rizos. Cyan means the preview gently snapped to the closest legal edge."},
      {icon:"190",label:"ROSTER BADGE",copy:"Deployment cost, FREE, selected, or blocked."}
    ];
    const body=rows.map(row=>`<article class="defense-legend-row"><span>${escapeHTML(row.icon)}</span><div><b>${escapeHTML(row.label)}</b><em>${escapeHTML(row.copy)}</em></div></article>`).join("");
    return `<div class="modal-card defense-control-legend"><small>RIZO DEFENSE • FIELD LEGEND</small><h2>WHAT IS THAT?</h2><div class="defense-legend-list">${body}</div><div class="modal-buttons"><button class="primary" type="button" data-close-modal>GOT IT</button></div></div>`;
  }

  function showDefenseControlLegend(){showModal(defenseControlLegendMarkup());}
  function defenseMapPointAt(map,progress){return defensePointFromMetrics(map.pathMetrics||(map.pathMetrics=defensePathMetrics(map.path)),progress);}
  

  function defenseRouteMarkersMarkup(map){
    return[.12,.27,.42,.57,.72,.87].map((progress,index)=>{const point=defenseMapPointAt(map,progress),next=defenseMapPointAt(map,Math.min(.995,progress+.012)),angle=Math.atan2(next.y-point.y,next.x-point.x)*180/Math.PI;return`<i class="defense-route-marker" style="--route-x:${clamp(point.x,.03,.97)*100}%;--route-y:${clamp(point.y,.07,.93)*100}%;--route-angle:${angle}deg" data-route-marker="${index}" aria-hidden="true"><span></span></i>`;}).join("");
  }

  function traceDefenseRoute(){
    const d=mini.defense,scout=$("#defenseRouteScout"),world=$("#defenseWorld");if(!d||!scout)return false;completeDefenseSchoolLesson("route");scout.getAnimations?.().forEach(animation=>animation.cancel());
    world?.classList.add("route-tracing");
    const frames=Array.from({length:32},(_,index)=>{const point=defenseMapPointAt(d.map,index/31);return{left:`${clamp(point.x,.025,.975)*100}%`,top:`${clamp(point.y,.06,.94)*100}%`};});
    if(hostSettings().reducedMotion){const end=frames.at(-1);Object.assign(scout.style,end);scout.classList.add("active");queueMiniTimeout(()=>scout.classList.remove("active"),900);}else scout.animate(frames,{duration:3600,easing:"linear",fill:"none"});
    queueMiniTimeout(()=>world?.classList.remove("route-tracing"),3900);
    setDefenseMessage(`${d.map.entrance} → EMBER GATE`,`${d.map.strategy} • ${d.map.lesson}`);return true;
  }

  // v78: the authored 1x experience is intentionally readable. Fast enemies still
  // feel fast because their relative identity is preserved; ordinary traffic gets air.
  const DEFENSE_GLOBAL_MOVEMENT_PACE = 0.94;
  const DEFENSE_ENEMIES = {
    puff:{name:"GLOOM BALLOON",className:"balloon-puff",hp:15,speed:.0472,reward:6,damage:1,color:"#ff5b68",icon:"○",trait:"BASIC DRIFTER",counter:"ANY RIZO",intel:"The baseline threat. Use it to judge whether your field has enough coverage."},
    fleet:{name:"ZIP BALLOON",className:"balloon-fleet",hp:11,speed:.0764,reward:8,damage:1,color:"#55dfff",icon:"»",trait:"FAST",counter:"FIRST • SLOW",intel:"Low health, high speed. FIRST targeting and trail control keep it away from the gate."},
    shell:{name:"IRON BALLOON",className:"balloon-shell",hp:42,speed:.035,reward:15,damage:2,color:"#9b7bd7",armor:.22,icon:"▰",trait:"ARMORED • CRACKS",counter:"POWER • DIAMOND",intel:"Its plate absorbs damage until half health, then visibly cracks and loses most armor."},
    split:{name:"BUBBLE BALLOON",className:"balloon-split",hp:27,speed:.044,reward:10,damage:1,color:"#ff83ce",icon:"◎",trait:"SPLITS ON POP",counter:"CHAIN • SPLASH",intel:"Popping it creates two real children that count toward the wave."},
    fire:{name:"FIRE BALLOON",className:"balloon-fire",hp:54,speed:.046,reward:18,damage:2,color:"#ff713f",fireproof:true,icon:"▲",trait:"FIREPROOF",counter:"FROST • TOXIC",intel:"Resists Ember attacks. Frost strikes hit it harder and control ignores its heat."},
    frost:{name:"FROST BALLOON",className:"balloon-frost",hp:62,speed:.039,reward:36,damage:2,color:"#a8f3ff",armor:.08,slowResist:.78,icon:"✦",trait:"SLOW RESIST",counter:"POWER • PUSH",intel:"Most slows barely move it. Heavy damage and Bubblegum knockback remain reliable."},
    storm:{name:"STORM BALLOON",className:"balloon-storm",hp:39,speed:.058,reward:18,damage:2,color:"#ffe66b",stormPulse:true,icon:"ϟ",trait:"SURGE BURSTS",counter:"CONTROL • FIRST",intel:"Its body telegraphs speed surges. Slow it before the charge reaches the gate."},
    ghost:{name:"PHASE BALLOON",className:"balloon-ghost",hp:47,speed:.051,reward:44,damage:2,color:"#c59cff",phasing:true,icon:"◇",trait:"PHASES",counter:"CONTROL • GLITCH",intel:"Takes reduced damage while translucent. CONTROL doctrine locks it into the physical trail."},
    shade:{name:"SHADE BALLOON",className:"balloon-shade",hp:34,speed:.05,reward:30,damage:2,color:"#3d3450",camo:true,icon:"",trait:"CAMOUFLAGED",counter:"AWAKEN • SHADOW",intel:"Base Rizos struggle to see it. Level 3 Rizos and Shadow, Aurora, or Glitch detect it."},
    brick:{name:"CERAMIC BALLOON",className:"balloon-brick",hp:165,speed:.030,reward:56,damage:4,color:"#c87845",armor:.10,icon:"",trait:"DENSE SHELL",counter:"POWER • ARMOR BREAK",intel:"One Ceramic carries the durability of a crowd. Crack its shell instead of adding more towers blindly."},
    lead:{name:"LEAD BALLOON",className:"balloon-lead",hp:132,speed:.027,reward:62,damage:4,color:"#77818d",armor:.46,slowResist:.28,icon:"",trait:"HEAVY ARMOR",counter:"POWER • SHRED",intel:"Lead plating shrugs off weak repeated hits. POWER doctrine and armor shred open it for the field."},
    relay:{name:"RELAY BALLOON",className:"balloon-relay",hp:78,speed:.043,reward:40,damage:2,color:"#5fe0b7",supportAura:true,icon:"⌁",trait:"BOOSTS THE PACK",counter:"FIRST • BURST",intel:"While a Relay is close, nearby threats move faster and gain temporary protection. Pop the Relay and its nearby convoy briefly loses the signal and stutters."},
    mender:{name:"MENDER BALLOON",className:"balloon-mender",hp:94,speed:.037,reward:48,damage:2,color:"#ff9fcf",healer:true,icon:"+",trait:"REPAIRS ALLIES",counter:"FOCUS • CONTROL",intel:"Periodically repairs a wounded nearby non-boss threat and can restore shredded plating before it fully breaks. A nearby Relay speeds its triage cycle."}
  };
  const DEFENSE_BOSSES=[
    {id:"crown",name:"THE WARDEN",className:"boss-crown",hp:430,speed:.025,reward:180,damage:7,color:"#171421",armor:.26,icon:"",trait:"CALLS HEAVY GUARDS",counter:"CONTROL • SPLASH",hint:"THE WARDEN CALLS HEAVY ESCORTS. BREAK THE SIGNAL OR CRACK THE FORMATION."},
    {id:"vortex",name:"THE MAW",className:"boss-vortex",hp:410,speed:.027,reward:180,damage:7,color:"#6f4ad7",armor:.12,icon:"",trait:"COLLAPSES RIZO RANGE",counter:"SPREAD • CONTROL",hint:"THE MAW COMPRESSES THE FIELD. INTERRUPT ITS PULSE OR FIGHT FROM MULTIPLE ANGLES."},
    {id:"mirror",name:"THE MIRROR",className:"boss-mirror",hp:400,speed:.028,reward:180,damage:7,color:"#bdefff",armor:.10,icon:"",trait:"MULTIPLIES AT HALF",counter:"BALANCED COVERAGE",hint:"THE MIRROR MULTIPLIES ITS REMAINING MASS. KEEP BOTH HALVES COVERED."},
    {id:"apex",name:"THE REDLINE",className:"boss-apex",hp:455,speed:.024,reward:190,damage:8,color:"#ff4c63",armor:.20,icon:"",trait:"BREAKS INTO SPEED SURGES",counter:"CONTROL • FIRST",hint:"THE REDLINE WINDS UP BEFORE A VIOLENT SURGE. CONTROL CAN CANCEL THE BURST."}
  ];
  const DEFENSE_MILESTONES=[10,25,50,100];
  const DEFENSE_TARGET_MODES=["first","strong","last","close"];
  const DEFENSE_TARGET_LABELS={first:"FRONT",strong:"TOUGHEST",last:"BACK",close:"NEAREST"};
  const DEFENSE_DOCTRINES={power:{id:"power",name:"POWER PATH",copy:"Harder hits, stronger abilities, and charged doctrine strikes."},control:{id:"control",name:"CONTROL PATH",copy:"More range, faster attacks, and pulse strikes that restrain the trail."}};
  const DEFENSE_BASIC_TOWER=Object.freeze({id:"defense-tool-basic",name:"BASIC DEFENSE RIZO",variant:"defense-basic",color:"#eee6d6",powerColor:"#ff9a56",controlColor:"#7fe2c4",deployBase:85,duplicateStep:20,upgradeCosts:Object.freeze([70,125,230,430]),doubleStitchEvery:4,powerStrikeEvery:4,powerApexEvery:3,controlStrikeEvery:5,controlApexEvery:4});
  const DEFENSE_BASIC_PET=Object.freeze({id:DEFENSE_BASIC_TOWER.id,name:DEFENSE_BASIC_TOWER.name,variant:DEFENSE_BASIC_TOWER.variant,hiddenVariant:DEFENSE_BASIC_TOWER.variant,stage:"kid",alive:true,defenseUniversal:true,defenseGuest:true,accessory:null,skills:Object.freeze({power:0,speed:0,instinct:0,stamina:0,luck:0})});
  function defenseUniversalDeployRows(){return[{pet:DEFENSE_BASIC_PET,source:"universal",rosterIndex:-1}];}
  function defenseIsUniversalPet(pet){return Boolean(pet?.defenseUniversal||pet?.id===DEFENSE_BASIC_TOWER.id);}
  function defenseIsUniversalTower(tower){return Boolean(tower&&defenseIsUniversalPet(tower.pet));}
  function defenseUniversalDeployCost(copyCount=0){return DEFENSE_BASIC_TOWER.deployBase+Math.max(0,Math.floor(Number(copyCount)||0))*DEFENSE_BASIC_TOWER.duplicateStep;}
  function defenseTowerDisplayColor(tower){if(defenseIsUniversalTower(tower)){if(tower.doctrine==="power")return DEFENSE_BASIC_TOWER.powerColor;if(tower.doctrine==="control")return DEFENSE_BASIC_TOWER.controlColor;return DEFENSE_BASIC_TOWER.color;}const variant=tower?.pet?.variant||tower?.pet?.hiddenVariant||"classic";return(VARIANTS.find(item=>item.id===variant)||VARIANTS[0]).color;}
  function defenseBasicVisualMarkup({upgrade=0,doctrine=null,extraClass="",label="Basic Defense Rizo"}={}){const level=clamp(Number(upgrade)||0,0,4),path=doctrine==="power"?"power":doctrine==="control"?"control":"neutral";return`<span class="defense-basic-rizo basic-evo-${level} basic-path-${path} ${escapeHTML(extraClass)}" role="img" aria-label="${escapeHTML(label)}"><i class="basic-body"></i><i class="basic-eye eye-a"></i><i class="basic-eye eye-b"></i><i class="basic-mouth"></i><i class="basic-stitch stitch-a"></i><i class="basic-stitch stitch-b"></i><i class="basic-rig rig-a"></i><i class="basic-rig rig-b"></i><i class="basic-core"></i><i class="basic-crown"></i></span>`;}
  function defenseDeployPortraitMarkup(row,extraClass="defense-roster-rizo",context="thumbnail"){return defenseIsUniversalPet(row?.pet)?defenseBasicVisualMarkup({upgrade:0,extraClass,label:row.pet.name}):petMarkup({pet:row.pet,extraClass,context,label:row.pet.name});}
  function defenseTowerPortraitMarkup(tower,extraClass="defense-rizo",context="arcade"){return defenseIsUniversalTower(tower)?defenseBasicVisualMarkup({upgrade:tower.upgrade,doctrine:tower.doctrine,extraClass,label:`${tower.pet.name}, ${defenseCombatStats(tower).label} defender`}):petMarkup({pet:tower.pet,extraClass,context,label:tower.pet.name});}
  const DEFENSE_THREAT_PRIORITY={"boss:crown":100,"boss:vortex":100,"boss:mirror":100,"boss:apex":100,lead:96,relay:95,mender:93,brick:92,ghost:90,shade:85,storm:80,frost:75,fire:70,shell:60,split:50,fleet:40,puff:30};
  const DEFENSE_STAGE_MULTIPLIER={spark:.78,kid:.9,teen:1,beast:1.12,legend:1.24};
  const DEFENSE_ABILITIES={
    classic:{passive:"Reliable front-line shots. Level 2 adds a heavy third shot.",active:"RALLY",copy:"All defenders attack faster for 6 seconds.",cooldown:24},
    ember:{passive:"Shots ignite balloons over time.",active:"FIRE RING",copy:"Burn every balloon near this Rizo.",cooldown:25},
    toxic:{passive:"Poison keeps hurting after impact.",active:"SPORE CLOUD",copy:"Poison every balloon currently on the trail.",cooldown:28},
    violet:{passive:"Every shot jumps through three nearby balloons, even on a killing hit.",active:"CHAIN SURGE",copy:"Lightning jumps through the front six balloons.",cooldown:23},
    moss:{passive:"Shots briefly root balloons in place.",active:"ROOT GARDEN",copy:"Hold nearby balloons still for several seconds.",cooldown:27},
    bubblegum:{passive:"Hits push balloons backward.",active:"BIG BOUNCE",copy:"Knock every nearby balloon far down the path.",cooldown:24},
    frost:{passive:"Chills threats and sets up heavy hits. Level 2 chills a small crowd.",active:"DEEP FREEZE",copy:"Freeze and heavily slow every balloon.",cooldown:29},
    glitch:{passive:"Random shots sometimes hit much harder.",active:"REWRITE",copy:"Fire eight unstable strikes at random targets.",cooldown:21},
    obsidian:{passive:"Heavy shells splash tightly packed targets. Level 2 strips armor.",active:"QUAKE",copy:"Crush every balloon around this Rizo.",cooldown:31},
    aurora:{passive:"Nearby defenders deal more damage.",active:"PRISM FIELD",copy:"Boost every defender for 8 seconds.",cooldown:30},
    golden:{passive:"Every pop creates extra match coins.",active:"PAYDAY",copy:"Create a large burst of match coins.",cooldown:34},
    diamond:{passive:"Shots pierce multiple balloons.",active:"SHARD LINE",copy:"Cut through the eight closest balloons.",cooldown:26},
    shadow:{passive:"Critical hits can deal huge damage.",active:"NIGHT CUT",copy:"Execute a wounded front balloon or heavily strike it.",cooldown:25},
    retro:{passive:"Attacks extremely quickly.",active:"OVERCLOCK",copy:"This Rizo attacks at double speed for 9 seconds.",cooldown:22}
  };


  const DEFENSE_CONTROL_ABILITIES=Object.freeze({
    classic:{active:"GUARD LINE",copy:"Lock the front of the trail and buy the whole field breathing room."},
    ember:{active:"CINDER WALL",copy:"Lay down a hot control zone that burns and slows the front pack."},
    toxic:{active:"SPORE SNARE",copy:"Poison and heavily slow the front formation."},
    violet:{active:"ARC NET",copy:"Chain a restraint through the leading threats."},
    moss:{active:"ROOT MAZE",copy:"Root a wide section of the trail for an extended hold."},
    bubblegum:{active:"REBOUND FIELD",copy:"Throw the front formation backward with almost no burst damage."},
    frost:{active:"ICE LOCK",copy:"Pin the front threats in place, including heavy balloons."},
    glitch:{active:"SIGNAL JAM",copy:"Reveal, phase-lock, and stall the leading formation."},
    obsidian:{active:"FAULT LOCK",copy:"Stun and shred armor instead of simply crushing everything."},
    aurora:{active:"PRISM LENS",copy:"Reveal the trail and extend control coverage across the field."},
    golden:{active:"TOLL GATE",copy:"Slow the front pack and skim gold while they remain trapped."},
    diamond:{active:"PRISM CAGE",copy:"Pin the toughest armored threats so POWER towers can finish them."},
    shadow:{active:"BLACKOUT",copy:"Blind the rush, reveal hidden threats, and drag the front backward."},
    retro:{active:"FRAME SKIP",copy:"Rewind the front formation a few frames down the trail."}
  });
  function defenseAbilityPresentation(tower){const base=defenseAbilityData(tower);if(tower?.doctrine!=="control")return base;const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",control=DEFENSE_CONTROL_ABILITIES[variant]||DEFENSE_CONTROL_ABILITIES.classic;return{...base,...control};}
  function defenseFieldLeader(d=mini.defense){return d?.towers?.find(t=>!t.superConsumed&&defenseIsCharacterTower(t)&&t.source==="active")||d?.towers?.find(t=>!t.superConsumed&&defenseIsCharacterTower(t))||null;}
  function activateDefenseFieldLeader(){const d=mini.defense,leader=defenseFieldLeader(d);if(!leader){setDefenseMessage("NO FIELD LEADER","The first Rizo you place owns the field power.");sfx("no");return false;}if(leader.upgrade<2||!leader.doctrine){showDefenseTowerPanel(leader);setDefenseMessage("FIELD POWER LOCKED",`${leader.pet.name} is the leader. Reach Level 3 and choose POWER or CONTROL.`);sfx("no");return false;}return activateDefenseAbility(leader.id);}

  const DEFENSE_CONTRACT_TARGET=10;
  const DEFENSE_CONTRACT_RULES={
    unique:{id:"unique",icon:"1",name:"NO COPIES",copy:"Each Rizo identity may enter the field once."},
    lean:{id:"lean",icon:"4",name:"LEAN FIELD",copy:"The contract closes the field after four defenders."},
    "no-sell":{id:"no-sell",icon:"×",name:"NO REFUNDS",copy:"Every placement is permanent for this run."},
    silent:{id:"silent",icon:"◇",name:"SEALED ACTIVES",copy:"Activated effects are disabled. Passive identity still matters."},
    "power-only":{id:"power-only",icon:"▲",name:"POWER OATH",copy:"Every Level 3 Rizo must choose POWER."},
    "control-only":{id:"control-only",icon:"⌁",name:"CONTROL OATH",copy:"Every Level 3 Rizo must choose CONTROL."}
  };
  const DEFENSE_CONTRACT_SETS=[
    {title:"THE FOUR-FLAME OATH",rules:["unique","lean","power-only"]},
    {title:"THE PATIENT GATE",rules:["unique","no-sell","control-only"]},
    {title:"THE SILENT HAMMER",rules:["lean","silent","power-only"]},
    {title:"THE QUIET NET",rules:["no-sell","silent","control-only"]},
    {title:"THE LAST PLACEMENT",rules:["unique","lean","no-sell"]},
    {title:"THE COLD COMMITMENT",rules:["lean","no-sell","control-only"]},
    {title:"THE SINGLE SIGNAL",rules:["unique","silent","power-only"]},
    {title:"THE CONTROL ROOM",rules:["lean","silent","control-only"]}
  ];
  const DEFENSE_BOSS_TELEGRAPHS={
    guards:{kind:"guards",title:"CROWN CALLING GUARDS",copy:"CONTROL HITS CAN BREAK THE CALL BEFORE TWO IRON GUARDS ARRIVE.",duration:1.55,interruptible:true},
    vortex:{kind:"vortex",title:"VORTEX CHARGING",copy:"SPREAD OUT OR LAND CONTROL HITS TO BREAK THE RANGE PULSE.",duration:1.25,interruptible:true},
    mirror:{kind:"mirror",title:"MIRROR FRACTURE",copy:"THE SPLIT CANNOT BE STOPPED. PREPARE COVERAGE ON BOTH SIDES.",duration:1.35,interruptible:false},
    apex:{kind:"apex",title:"APEX WINDING UP",copy:"CONTROL HITS CAN CANCEL THE COMING SPEED SURGE.",duration:1.1,interruptible:true}
  };

  const DEFENSE_PHASE_UI=Object.freeze({
    [DEFENSE_PHASES.PLANNING]:{label:"PLAN",detail:"BUILD WINDOW",tone:"info"},
    [DEFENSE_PHASES.COUNTDOWN]:{label:"INCOMING",detail:"PACKET APPROACH",tone:"money"},
    [DEFENSE_PHASES.COMBAT]:{label:"DEFEND",detail:"TRAIL LIVE",tone:"danger"},
    [DEFENSE_PHASES.PACKET_BREAK]:{label:"BREATHER",detail:"UPGRADE WINDOW",tone:"valid"},
    [DEFENSE_PHASES.WAVE_COMPLETE]:{label:"CLEARED",detail:"PLAN NEXT WAVE",tone:"valid"},
    [DEFENSE_PHASES.PAUSED]:{label:"PAUSED",detail:"SIMULATION FROZEN",tone:"paused"},
    [DEFENSE_PHASES.RUN_COMPLETE]:{label:"COMPLETE",detail:"RUN CLOSED",tone:"neutral"}
  });
  const DEFENSE_CINEMATIC_MOMENTS=Object.freeze({
    "wave-start":{icon:"≈",tone:"info",priority:2,duration:700},
    packet:{icon:"››",tone:"valid",priority:1,duration:460},
    boss:{icon:"!",tone:"boss",priority:7,duration:1500},
    danger:{icon:"♥",tone:"danger",priority:6,duration:900},
    upgrade:{icon:"↑",tone:"money",priority:3,duration:880},
    ability:{icon:"✦",tone:"info",priority:4,duration:1050},
    perfect:{icon:"★",tone:"perfect",priority:6,duration:1250},
    clear:{icon:"✓",tone:"valid",priority:4,duration:960},
    defeat:{icon:"×",tone:"danger",priority:10,duration:1650},
    bank:{icon:"◇",tone:"money",priority:10,duration:1300}
  });
  function defenseIsActiveWave(d=mini.defense){return Boolean(d&&DefenseCore.isCombatPhase(d.phase));}
  function defenseIsSimulating(d=mini.defense){return Boolean(d&&[DEFENSE_PHASES.COUNTDOWN,DEFENSE_PHASES.COMBAT,DEFENSE_PHASES.PACKET_BREAK].includes(d.phase));}
  function defensePhaseUi(d=mini.defense){
    const phase=DefenseCore.normalizePhase(d?.phase),base=DEFENSE_PHASE_UI[phase]||DEFENSE_PHASE_UI[DEFENSE_PHASES.PLANNING];
    if(!d)return base;
    if(phase===DEFENSE_PHASES.COUNTDOWN){const left=Math.max(0,(d.nextSpawnAt||d.clock)-(d.clock||0));return{...base,detail:`FIRST THREAT ${left.toFixed(1)}S`};}
    if(phase===DEFENSE_PHASES.PACKET_BREAK){const left=Math.max(0,(d.packetBreakUntil||d.clock)-(d.clock||0)),remaining=Math.max(0,(d.wavePackets?.length||0)-(d.packetIndex||0));return{...base,detail:`${left.toFixed(1)}S • ${remaining} ${remaining===1?"PACKET":"PACKETS"} LEFT`};}
    if(phase===DEFENSE_PHASES.COMBAT){const current=Math.min((d.packetIndex||0)+1,d.wavePackets?.length||1),total=Math.max(1,d.wavePackets?.length||1);return{...base,detail:`PACKET ${current}/${total}`};}
    if(phase===DEFENSE_PHASES.WAVE_COMPLETE){return{...base,detail:store.settings.autoStart?"UPGRADE • OR START NOW":"UPGRADE • START WHEN READY"};}
    return base;
  }
  function defensePlaybackSpeed(d=mini.defense){
    if(!d)return 1;
    return d.speed===2&&defenseRealNow(d)<(d.flowEaseUntilReal||0)?1:d.speed;
  }
  function defenseFlowOnPhaseChange(d,from,to){
    if(!d||from===to)return;
    d.flowDecisionBeat=(d.flowDecisionBeat||0)+1;
    d.flowPulseUntilReal=defenseRealNow(d)+(to===DEFENSE_PHASES.PACKET_BREAK?1.65:.9);
    d.flowChoiceKey="";
    d.flowLastAction="";
    d.flowActionQuietUntilReal=0;
    if(to===DEFENSE_PHASES.PACKET_BREAK&&d.speed===2)d.flowEaseUntilReal=defenseRealNow(d)+1.15;
    markDefenseUi();
  }
  function defenseSetPhase(d,phase,{resumePhase=null,force=false}={}){
    if(!d)return DEFENSE_PHASES.RUN_COMPLETE;
    const normalized=DefenseCore.normalizePhase(phase,DEFENSE_PHASES.PLANNING),current=DefenseCore.normalizePhase(d.phase,DEFENSE_PHASES.PLANNING);
    if(!force&&d.phase&&current!==normalized&&!DefenseCore.canTransitionPhase(current,normalized)){
      d.phaseTransitionRejects=(d.phaseTransitionRejects||0)+1;
      defenseRecordValidationWarning("phase-transition-rejected",{from:current,to:normalized});
      return false;
    }
    if(normalized===DEFENSE_PHASES.PAUSED){d.resumePhase=resumePhase&&resumePhase!==DEFENSE_PHASES.PAUSED?DefenseCore.normalizePhase(resumePhase,DEFENSE_PHASES.COMBAT):(current!==DEFENSE_PHASES.PAUSED?current:d.resumePhase||DEFENSE_PHASES.COMBAT);}
    d.phase=normalized;
    defenseFlowOnPhaseChange(d,current,normalized);
    return normalized;
  }
  function installDefenseStateContracts(d){
    if(!d)return d;
    Object.defineProperty(d,"wave",{configurable:true,enumerable:false,get(){return this.currentWave||0;},set(value){this.currentWave=DefenseCore.clampInteger(value,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0);}});
    Object.defineProperty(d,"paused",{configurable:true,enumerable:false,get(){return this.phase===DEFENSE_PHASES.PAUSED;},set(value){if(value){if(this.phase!==DEFENSE_PHASES.PAUSED)this.resumePhase=this.phase;this.phase=DEFENSE_PHASES.PAUSED;}else if(this.phase===DEFENSE_PHASES.PAUSED){this.phase=DefenseCore.normalizePhase(this.resumePhase,DEFENSE_PHASES.COMBAT);}}});
    return d;
  }
  function defensePerformanceBudget(d=mini.defense){return d?.performanceLow||d?.renderTier>=2?DEFENSE_BUDGETS.low:DEFENSE_BUDGETS.normal;}
  function defenseVisualBudget(d=mini.defense){
    const speed=d?.speed||1,hardLow=Boolean(d?.performanceLow||(d?.governorTier||0)>=2),tier=clamp(Math.floor(d?.renderTier||0),0,2);
    if(hardLow)return DefenseCore.visualBudget({low:true,speed});
    const full=DefenseCore.visualBudget({low:false,speed});
    // Dense fields can shed decorative/projectile pressure preemptively while
    // preserving 60 Hz motion whenever measured frame time says the device can
    // afford it. Only the measured governor is allowed to drop presentation to 30.
    if(tier>=2){const lean=DefenseCore.visualBudget({low:true,speed});return{...lean,presentationFps:DefenseCore.SIMULATION.presentationHz};}
    if(tier===1)return{...full,maxVisibleProjectiles:Math.max(10,Math.floor(full.maxVisibleProjectiles*.78)),maxImpactEffects:Math.max(3,Math.floor(full.maxImpactEffects*.75)),weatherParticleScale:Math.min(full.weatherParticleScale,.68),projectileEmissionHz:Math.max(6,full.projectileEmissionHz-2),presentationFps:DefenseCore.SIMULATION.presentationHz};
    return full;
  }
  function defenseRealNow(d=mini.defense){return Number(d?.realClock)||0;}
  function defenseUpgradeAllowed(d=mini.defense){return Boolean(d&&DefenseCore.phaseAllows(d.phase,"upgrade"));}
  function defensePlacementAllowed(d=mini.defense){return Boolean(d&&DefenseCore.phaseAllows(d.phase,"place"));}
  function defenseSellAllowed(d=mini.defense){return Boolean(d&&DefenseCore.phaseAllows(d.phase,"sell"));}

  function defenseHashString(value){let hash=2166136261;for(const char of String(value||"")){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}
  function defenseMapAccent(id){return id==="grove"?"#9eff75":id==="ember"?"#ff735f":id==="moon"?"#c59cff":id==="storm"?"#55dfff":id==="blizzard"?"#d9fbff":"#ff68bd";}
  function normalizeDefenseRunContract(raw){if(!raw||typeof raw!=="object")return null;const date=String(raw.date||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;const mapId=DEFENSE_MAPS[raw.mapId]?raw.mapId:null;if(!mapId)return null;const rules=Array.isArray(raw.rules)?[...new Set(raw.rules.filter(rule=>DEFENSE_CONTRACT_RULES[rule]))].slice(0,3):[];if(rules.length!==3||rules.includes("power-only")&&rules.includes("control-only"))return null;const bestWave=DefenseCore.clampInteger(raw.bestWave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0),completed=bestWave>=DEFENSE_CONTRACT_TARGET,perfect=completed&&Boolean(raw.perfect);return{id:typeof raw.id==="string"&&raw.id?raw.id.slice(0,120):`contract-${date}-${mapId}`,date,mapId,title:typeof raw.title==="string"&&raw.title?raw.title.slice(0,80):"DAILY TRAIL CONTRACT",rules,targetWave:DEFENSE_CONTRACT_TARGET,bestWave,completed,perfect,firstAt:Math.max(0,Number(raw.firstAt)||0),lastAt:Math.max(0,Number(raw.lastAt)||0)};}
  function buildDailyDefenseContract(date=dateKey()){
    const seed=defenseHashString(`RIZO-TRAIL-${date}`),unlocked=defenseUnlockedMaps(),map=(unlocked[seed%Math.max(1,unlocked.length)]||DEFENSE_MAPS.grove),rosterCount=defenseRoster().filter(row=>!defenseStructureType(row)).length,eligible=rosterCount>=4?DEFENSE_CONTRACT_SETS:DEFENSE_CONTRACT_SETS.filter(set=>!set.rules.includes("unique")),set=eligible[Math.floor(seed/Math.max(1,unlocked.length))%eligible.length]||DEFENSE_CONTRACT_SETS[2];
    return normalizeDefenseRunContract({id:`daily-${date}-${map.id}-${set.rules.join("-")}`,date,mapId:map.id,title:set.title,rules:set.rules,targetWave:DEFENSE_CONTRACT_TARGET,bestWave:0,completed:false,perfect:false,firstAt:now(),lastAt:now()});
  }
  function ensureDailyDefenseContract(date=dateKey()){
    store.records.contracts||=[];let contract=normalizeDefenseRunContract(store.records.contracts.find(item=>item?.date===date));
    if(!contract){contract=buildDailyDefenseContract(date);store.records.contracts=[contract,...store.records.contracts.filter(item=>item?.date!==date)].slice(0,35);saveState(true);}return contract;
  }
  function defenseContractRule(id,d=mini.defense){return Boolean(d?.contract?.rules?.includes(id));}
  function defenseContractForcedDoctrine(d=mini.defense){return defenseContractRule("power-only",d)?"power":defenseContractRule("control-only",d)?"control":null;}
  function defenseContractStreak(records=store.records.contracts||[]){const completed=new Set(records.filter(item=>item?.completed).map(item=>item.date)),today=new Date(),cursor=new Date(today.getFullYear(),today.getMonth(),today.getDate());if(!completed.has(dateKey(cursor)))cursor.setDate(cursor.getDate()-1);let streak=0;while(completed.has(dateKey(cursor))){streak+=1;cursor.setDate(cursor.getDate()-1);}return streak;}
  function defenseContractRuleMarkup(contract){return contract.rules.map(id=>{const rule=DEFENSE_CONTRACT_RULES[id];return`<span title="${escapeHTML(rule.copy)}"><i>${escapeHTML(rule.icon)}</i><b>${escapeHTML(rule.name)}</b></span>`;}).join("");}
  function defenseDailyContractLobbyMarkup(contract){const map=DEFENSE_MAPS[contract.mapId]||DEFENSE_MAPS.grove,streak=defenseContractStreak(),status=contract.completed?`SEALED • BEST CLEARED ${contract.bestWave}`:`CLEAR WAVE ${contract.targetWave}`,accent=defenseMapAccent(map.id);return`<section class="defense-contract-card ${contract.completed?"completed":""}" style="--contract-accent:${accent}"><div class="defense-contract-head"><span>${contract.completed?"✓":map.icon}</span><div><small>LOCAL DAILY CONTRACT • ${escapeHTML(contract.date)}</small><h3>${escapeHTML(contract.title)}</h3><p>${escapeHTML(map.name)} • ${escapeHTML(status)} • ${streak} DAY STREAK</p></div></div><div class="defense-contract-rules">${defenseContractRuleMarkup(contract)}</div><button type="button" data-enter-defense-contract="${escapeHTML(contract.id)}">${contract.completed?"RUN AGAIN":"ACCEPT CONTRACT"}</button></section>`;}
  function recordDefenseContractProgress(d,final=false){
    const contract=normalizeDefenseRunContract(d?.contract);if(!contract)return{record:null,justCompleted:false};
    store.records.contracts||=[];
    const priorIndex=store.records.contracts.findIndex(item=>item?.id===contract.id||item?.date===contract.date),prior=normalizeDefenseRunContract(priorIndex>=0?store.records.contracts[priorIndex]:contract)||contract;
    const clearedWave=DefenseCore.clampInteger(d?.clearedWave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0),bestWave=Math.max(prior.bestWave||0,clearedWave),completed=bestWave>=contract.targetWave;
    const perfect=Boolean(prior.perfect||(completed&&DefenseCore.clampInteger(d?.perfectWaveCount,0,clearedWave,0)>=contract.targetWave));
    const record={...prior,...contract,bestWave,completed,perfect,lastAt:now(),firstAt:prior.firstAt||now()},justCompleted=!prior.completed&&completed;
    const rest=store.records.contracts.filter((item,index)=>index!==priorIndex&&item?.date!==record.date);store.records.contracts=[record,...rest].slice(0,35);d.contract={...record};if(final||justCompleted||bestWave!==prior.bestWave)saveState(true);return{record,justCompleted};
  }


  function defenseMasteryTitle(record={}){
    const waves=Math.max(0,Number(record.waves)||0);
    if(waves>=400)return"TRAIL LEGEND";
    if(waves>=150)return"WORLD GUARD";
    if(waves>=50)return"GATEKEEPER";
    if(waves>=10)return"FIELD TESTED";
    return"UNTESTED";
  }
  function defenseMasteryTier(record={}){const waves=Math.max(0,Number(record.waves)||0);return waves>=400?4:waves>=150?3:waves>=50?2:waves>=10?1:0;}
  function defenseMasteryForPet(petId){return petId&&store.records.mastery?.[petId]||null;}
  function defenseMasteryTierForPet(petId){return defenseMasteryTier(defenseMasteryForPet(petId)||{});}
  function defenseMasterySignatureName(record={}){const variant=VARIANTS.find(item=>item.id===record.variant)||VARIANTS[0],tier=defenseMasteryTier(record);if(tier>=4)return`${variant.name} LEGEND SIGNAL`;if(tier>=3)return`${variant.name} IMPACT SIGIL`;if(tier>=2)return`${variant.name} TRAIL`;if(tier>=1)return`${variant.name} FIELD MARK`;return"NO FIELD SIGNATURE";}
  function defenseMasteryUnlockCopy(record={}){const tier=defenseMasteryTier(record),next=["FIELD MARK AT 10 WAVES","TRAIL AT 50 WAVES","IMPACT SIGIL AT 150 WAVES","LEGEND AURA AT 400 WAVES","ALL FIELD SIGNATURES EARNED"][tier];return{tier,next,current:defenseMasterySignatureName(record)};}
  const DEFENSE_FEEL_PITCH=Object.freeze({classic:0,ember:-5,toxic:-3,violet:7,moss:-7,bubblegum:5,frost:9,glitch:1,obsidian:-12,aurora:12,golden:4,diamond:11,shadow:-10,retro:2});
  function defenseSignatureTone(tower,tier=defenseMasteryTierForPet(tower?.petId),doctrineStrike=null){
    const d=mini.defense;
    if(!tower||!hostSettings().sound||!d)return;
    const time=defenseNow(),important=Boolean(doctrineStrike),globalWait=important?.05:(d.lowFx?.14:.06),towerWait=important?.075:(d.lowFx?.24:.10);
    if(time-(d.lastSignatureToneAt||0)<globalWait||time-(tower.lastSignatureToneAt||0)<towerWait)return;
    d.lastSignatureToneAt=time;tower.lastSignatureToneAt=time;
    const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",accent=(tower.shots||0)%3===0;
    const profiles={
      classic:[[205,.026,"triangle",0,18],[307,.018,"sine",.012,-8]],
      ember:[[142,.04,"sawtooth",0,-48],[92,.022,"square",.014,34]],
      toxic:[[178,.026,"square",0,-26],[121,.034,"sine",.012,-38]],
      violet:[[228,.042,"sine",0,58],[342,.025,"triangle",.016,22]],
      moss:[[126,.038,"triangle",0,-20],[168,.025,"sine",.018,-8]],
      bubblegum:[[252,.046,"sine",0,72],[378,.022,"sine",.014,-44]],
      frost:[[238,.034,"triangle",0,94],[476,.018,"sine",.012,-96]],
      glitch:[[166,.016,"square",0,118],[247,.014,"square",.018,-132]],
      obsidian:[[104,.052,"sawtooth",0,-62],[78,.028,"triangle",.016,-22]],
      aurora:[[264,.052,"sine",0,102],[396,.038,"sine",.018,48]],
      golden:[[210,.034,"triangle",0,68],[420,.022,"sine",.014,-18]],
      diamond:[[282,.025,"triangle",0,136],[564,.018,"sine",.012,-160]],
      shadow:[[96,.052,"sine",0,-78],[144,.03,"triangle",.018,-42]],
      retro:[[188,.014,"square",0,142],[94,.014,"square",.018,0]]
    };
    const notes=profiles[variant]||profiles.classic,gain=tier>=4?.0092:tier>=2?.0066:.0044,first=notes[0];tone(first[0],first[1],first[2],gain,first[3],first[4]);
    if((accent||tier>=3&&tower.shots%4===0)&&!d.lowFx){const second=notes[1];tone(second[0],second[1],second[2],gain*(tier>=3?.72:.62),second[3],second[4]);}
    if(tier>=4&&!d.lowFx&&tower.shots%8===0)tone(first[0]*2,.035,"sine",gain*.34,.018,variant==="glitch"?-90:90);
    if(important){const power=doctrineStrike==="power",root=Math.max(70,first[0]*(power?.62:1.28));tone(root,power?.075:.06,power?"sawtooth":"sine",gain*1.32,.008,power?-32:110);if(tower.superForm&&!d.lowFx)tone(root*(power?1.5:1.75),.09,"triangle",gain*.72,.055,power?80:150);}
  }

  function defenseAbilitySignature(tower){
    if(!tower||!hostSettings().sound)return false;const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",doctrine=tower.doctrine||"power",superForm=Boolean(tower.superForm),shift=DEFENSE_FEEL_PITCH[variant]||0;
    const roots={classic:196,ember:130,toxic:154,violet:247,moss:116,bubblegum:262,frost:294,glitch:185,obsidian:98,aurora:330,golden:220,diamond:311,shadow:92,retro:208},waves={classic:"triangle",ember:"sawtooth",toxic:"square",violet:"sine",moss:"triangle",bubblegum:"sine",frost:"triangle",glitch:"square",obsidian:"sawtooth",aurora:"sine",golden:"triangle",diamond:"triangle",shadow:"sine",retro:"square"},root=roots[variant]||196,wave=waves[variant]||"triangle",power=doctrine==="power",gain=superForm?.032:.025;
    tone(root,.08,wave,gain,0,power?-18:54);tone(root*(power?1.5:1.75),.14,power?"triangle":"sine",gain*.9,.065,power?120:190);
    if(["ember","obsidian","retro","glitch"].includes(variant))noise(superForm?.11:.075,superForm?.012:.008,.025);
    if(["frost","aurora","diamond","violet"].includes(variant))tone(root*2,.08,"sine",gain*.42,.13,shift*6);
    if(superForm)tone(root*(power?2:2.25),.22,"sine",gain*.72,.18,power?210:290);
    return true;
  }

  function defenseBossCue(moment="arrival",bossId="crown"){
    if(!hostSettings().sound)return false;const profiles={crown:{root:82,wave:"sawtooth",interval:1.5},vortex:{root:110,wave:"sine",interval:1.33},mirror:{root:147,wave:"triangle",interval:2},apex:{root:98,wave:"square",interval:2}},profile=profiles[bossId]||profiles.crown,root=profile.root,wave=profile.wave;
    if(moment==="arrival"){tone(root,.2,wave,.028,0,bossId==="apex"?120:-18);tone(root*profile.interval,.24,"triangle",.023,.13,bossId==="vortex"?-80:80);if(bossId==="mirror")tone(root*.75,.18,"sine",.017,.075,160);noise(.12,.011,.05);}
    else if(moment==="phase"){tone(root*1.25,.11,wave,.022,0,bossId==="vortex"?-95:95);tone(root*profile.interval*1.15,.13,"triangle",.018,.075,bossId==="mirror"?-160:125);}
    else if(moment==="resolve"){tone(root*.82,.08,"square",.02,0,bossId==="apex"?240:-55);noise(.07,.009,.02);}
    else if(moment==="break"){tone(root*1.5,.055,"square",.022,0,190);tone(root*2.25,.08,"triangle",.022,.045,260);noise(.05,.009,.018);}
    else if(moment==="down"){tone(root,.14,wave,.027,0,-52);noise(.14,.014,.025);[1.5,2,2.5].forEach((m,i)=>tone(root*m,.16,"sine",.024,.12+i*.065,180));}
    return true;
  }

  function defenseRecordFramePerformance(rawFrame){
    const d=mini.defense;if(!d||!Number.isFinite(rawFrame)||rawFrame<=0||rawFrame>250)return;const sample=clamp(rawFrame,8,90),seconds=sample/1000;
    d.frameMs=d.frameMs*.94+sample*.06;d.frameSamples ||= [];d.frameSamples.push(sample);if(d.frameSamples.length>120)d.frameSamples.shift();d.frameSampleClock=(d.frameSampleClock||0)+seconds;
    d.frameStress=clamp((d.frameStress||0)+(sample>38?2.4:sample>28?.9:sample>21?.18:-.28),0,120);d.slowFrameStreak=sample>34?Math.min(16,(d.slowFrameStreak||0)+2):sample>24?Math.min(16,(d.slowFrameStreak||0)+1):Math.max(0,(d.slowFrameStreak||0)-1);
    if(d.frameSampleClock<.5)return;const windowSeconds=d.frameSampleClock;d.frameSampleClock=0;const sorted=[...d.frameSamples].sort((a,b)=>a-b),pick=q=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];d.frameP95=pick(.95);d.frameP99=pick(.99);
    const severe=d.frameP95>31||d.slowFrameStreak>=8||d.simBacklogEvents>(d.lastGovernorBacklogEvents||0),pressure=d.frameP95>19||d.slowFrameStreak>=4||d.frameStress>10;d.lastGovernorBacklogEvents=d.simBacklogEvents||0;
    if(severe){d.governorPressureSeconds=(d.governorPressureSeconds||0)+windowSeconds*2;d.governorStableSeconds=0;}else if(pressure){d.governorPressureSeconds=(d.governorPressureSeconds||0)+windowSeconds;d.governorStableSeconds=0;}else{d.governorPressureSeconds=Math.max(0,(d.governorPressureSeconds||0)-windowSeconds*.5);const stableThreshold=(d.governorTier||0)>=2?26:15.5;if(d.frameP95<stableThreshold)d.governorStableSeconds=(d.governorStableSeconds||0)+windowSeconds;else d.governorStableSeconds=0;}
    if((d.governorTier||0)===0&&d.governorPressureSeconds>=2){d.governorTier=1;d.governorPressureSeconds=0;d.governorStableSeconds=0;}
    if((d.governorTier||0)===1&&(severe||d.governorPressureSeconds>=3.5)){d.governorTier=2;d.governorPressureSeconds=0;d.governorStableSeconds=0;}
    if((d.governorTier||0)===2&&d.governorStableSeconds>=15){d.governorTier=1;d.governorStableSeconds=0;d.frameStress=Math.min(d.frameStress,4);}
    else if((d.governorTier||0)===1&&d.governorStableSeconds>=12){d.governorTier=0;d.governorStableSeconds=0;d.frameStress=Math.min(d.frameStress,2);}
    d.performanceLow=(d.governorTier||0)>=2;
  }
  function defenseRenderTier(d=mini.defense){
    if(!d)return 0;const count=d.enemies?.length||0,speed=d.speed||1,mode=store.settings.fx||"auto",governor=clamp(Math.floor(d.governorTier||0),0,2);
    if(hostSettings().reducedMotion||mode==="low")return 2;
    if(mode==="full")return Math.max(governor,count>13||(speed===2&&count>11)?1:0);
    const densityTier=count>=13||(speed===2&&count>=11)?2:count>=9||(speed===2&&count>=8)?1:0;
    return Math.max(governor,densityTier);
  }

  function defenseApplyRenderTier(d,tier=defenseRenderTier(d)){
    if(!d)return 0;
    tier=clamp(Math.floor(tier),0,2);
    const changed=d.renderTier!==tier;if(changed){d.renderTier=tier;d.renderTierChanges=(d.renderTierChanges||0)+1;markDefenseUi();}
    d.lowFx=tier>0;d.potatoFx=tier>1;
    if(changed||d.appliedRenderTier!==tier||d.appliedVisualSpeed!==d.speed){const world=$("#defenseWorld"),visual=defenseVisualBudget(d);if(world){world.classList.toggle("low-fx",tier>0);world.classList.toggle("fx-full",tier===0);world.classList.toggle("fx-lean",tier===1);world.classList.toggle("fx-potato",tier===2);world.classList.toggle("speed-visual-budget",d.speed===2);world.dataset.renderTier=String(tier);world.style.setProperty("--defense-weather-density",String(visual.weatherParticleScale));}d.appliedRenderTier=tier;d.appliedVisualSpeed=d.speed;}
    return tier;
  }
  function defenseFxLowMode(d=mini.defense){return defenseRenderTier(d)>0;}

  function defenseMasteryPips(record={}){const tier=defenseMasteryTier(record);return`<span class="defense-mastery-pips" aria-label="Mastery tier ${tier} of 4">${[1,2,3,4].map(level=>`<i class="${tier>=level?"earned":""}">${level}</i>`).join("")}</span>`;}
  function defenseMedalTier(wave){wave=Math.max(0,Math.floor(Number(wave)||0));return wave>=50?3:wave>=25?2:wave>=10?1:0;}
  function defenseMedalName(tier){return["NO MEDAL","BRONZE GATE","SILVER GATE","GOLD GATE"][clamp(Math.floor(Number(tier)||0),0,3)];}
  function defenseMedalMarkup(mapId,wave=0){const tier=defenseMedalTier(wave),perfect=(store.records.perfectMaps||[]).includes(mapId);return`<span class="defense-map-medals" aria-label="${escapeHTML(defenseMedalName(tier))}${perfect?" and Gate Perfect":""}"><i class="${tier>=1?"earned":""}">●</i><i class="${tier>=2?"earned":""}">●</i><i class="${tier>=3?"earned":""}">●</i><b class="${perfect?"earned":""}">✦</b></span>`;}
  function defenseCheckpointAgeCopy(savedAt){const age=Math.max(0,now()-(Number(savedAt)||0)),minutes=Math.floor(age/60000);if(minutes<1)return"JUST NOW";if(minutes<60)return`${minutes}M AGO`;const hours=Math.floor(minutes/60);if(hours<24)return`${hours}H AGO`;return`${Math.floor(hours/24)}D AGO`;}
  function defenseQueueEntry(entry){
    if(typeof entry==="string"&&DEFENSE_ENEMIES[entry])return entry;
    if(!entry||typeof entry!=="object")return null;
    if(entry.type==="boss"&&DEFENSE_BOSSES.some(boss=>boss.id===entry.bossId))return{type:"boss",bossId:entry.bossId,intensity:DefenseCore.clampInteger(entry.intensity,0,99,0)};
    if(DEFENSE_ENEMIES[entry.type])return entry.type;
    return null;
  }
  function normalizeDefensePacket(raw){
    if(!raw||typeof raw!=="object")return null;
    const enemies=(Array.isArray(raw.enemies)?raw.enemies:[]).map(defenseQueueEntry).filter(Boolean).slice(0,12);
    if(!enemies.length)return null;
    return{enemies,spawnGap:DefenseCore.clampNumber(raw.spawnGap,.07,1.2,.34),breakAfter:DefenseCore.clampNumber(raw.breakAfter,0,2.4,1.2)};
  }
  function normalizeDefenseChildSpawn(raw){
    if(!raw||typeof raw!=="object")return null;
    const entry=defenseQueueEntry(raw.entry||raw.type);if(!entry)return null;
    return{entry,progress:DefenseCore.clampNumber(raw.progress,0,.995,0),releaseAt:DefenseCore.clampNumber(raw.releaseAt,0,1e9,0),options:{bossChild:Boolean(raw.options?.bossChild),hpRatio:DefenseCore.clampNumber(raw.options?.hpRatio,.01,1,1),rewardScale:DefenseCore.clampNumber(raw.options?.rewardScale,.05,1,1)}};
  }
  function normalizeDefenseEnemyStats(raw){
    const cleanCounts=value=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key])=>DEFENSE_ENEMIES[key]||key.startsWith("boss:")).map(([key,count])=>[key,DefenseCore.clampInteger(count,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0)])):{};
    const counters=raw?.counters&&typeof raw.counters==="object"?raw.counters:{};
    return{spawned:cleanCounts(raw?.spawned),popped:cleanCounts(raw?.popped),leaked:cleanCounts(raw?.leaked),heartLoss:DefenseCore.clampInteger(raw?.heartLoss,0,9999,0),counters:{armorBreaks:DefenseCore.clampInteger(counters.armorBreaks,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0),armorShreds:DefenseCore.clampInteger(counters.armorShreds,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0),reveals:DefenseCore.clampInteger(counters.reveals,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0),phaseLocks:DefenseCore.clampInteger(counters.phaseLocks,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0),bossInterrupts:DefenseCore.clampInteger(counters.bossInterrupts,0,DEFENSE_LIMITS.MAX_REASONABLE_BOSSES,0)}};
  }
  // Canonicalization must recognise every legally placeable id, characters and
  // universal Defense-only tools/structures alike, or a signed checkpoint would
  // silently drop a paid deployment on restore.
  function defenseCheckpointRosterRegistry(){return new Map([...defenseRestorableRegistry()].map(([id,row])=>[id,{source:row.source,rosterIndex:row.rosterIndex,pet:row.pet}]));}
  function defenseCanonicalTowerSnapshots(rows,mapId,{trusted=true,legacyOpeningPerkInference=false}={}){
    const source=Array.isArray(rows)?rows:[],ids=new Set(),copies=new Map(),roster=defenseCheckpointRosterRegistry();let paid=0,openingPerkClaimed=false;
    return source.slice(0,DEFENSE_LIMITS.MAX_DEFENSE_TOWERS).map((tower,index)=>{
      if(!tower||typeof tower!=="object"||typeof tower.petId!=="string"||!tower.petId)return null;
      const petId=tower.petId.slice(0,80),owner=roster.get(petId);if(!owner)return null;
      let id=typeof tower.id==="string"&&tower.id?tower.id.slice(0,80):`tower-${index+1}`;if(ids.has(id))id=`tower-${index+1}`;ids.add(id);
      const sourceType=owner.source,copyIndex=copies.get(petId)||0,structureType=defenseStructureType(owner.pet);
      const cost=structureType?DefenseCore.structureDeploymentCost(structureType,copyIndex):defenseIsUniversalPet(owner.pet)?defenseUniversalDeployCost(copyIndex):DefenseCore.deploymentCost({paidTowerCount:paid,copyCount:copyIndex,activeFirst:sourceType==="active"});
      if(cost>0)paid+=1;copies.set(petId,copyIndex+1);
      const upgrade=trusted?DefenseCore.clampInteger(tower.upgrade,0,DEFENSE_LIMITS.MAX_TOWER_LEVEL,0):0,explicitPerk=Boolean(tower.openingPerkApplied),inferredLegacyPerk=legacyOpeningPerkInference&&!openingPerkClaimed&&upgrade>0,perkEligible=!structureType&&trusted&&!defenseIsUniversalPet(owner.pet)&&!openingPerkClaimed&&upgrade>0&&(explicitPerk||inferredLegacyPerk)&&defenseWorldPerkMatchesTower(mapId,{pet:owner.pet}),openingPerkApplied=Boolean(perkEligible);
      const spent=structureType?DefenseCore.calculateStructureInvestment(structureType,cost,upgrade):defenseIsUniversalPet(owner.pet)?cost+DEFENSE_BASIC_TOWER.upgradeCosts.slice(0,upgrade).reduce((sum,value)=>sum+value,0):DefenseCore.calculateTowerInvestment(cost,upgrade,openingPerkApplied?[DefenseCore.ECONOMY.worldOpeningDiscount,1,1,1]:1);if(openingPerkApplied)openingPerkClaimed=true;
      return{id,petId,source:sourceType,rosterIndex:owner.rosterIndex,copyNumber:copyIndex+1,x:DefenseCore.clampNumber(tower.x,0,1,.5),y:DefenseCore.clampNumber(tower.y,0,1,.5),upgrade,cost,spent,openingPerkApplied,placedAtReal:Number.NEGATIVE_INFINITY,cooldown:trusted?DefenseCore.clampNumber(tower.cooldown,0,60,0):0,kills:trusted?DefenseCore.clampInteger(tower.kills,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0):0,damage:trusted?DefenseCore.clampNumber(tower.damage,0,DEFENSE_LIMITS.MAX_REASONABLE_DAMAGE,0):0,abilityReadyAt:trusted?DefenseCore.clampNumber(tower.abilityReadyAt,0,1e9,0):0,overclockUntil:trusted?DefenseCore.clampNumber(tower.overclockUntil,0,1e9,0):0,rangeDebuffUntil:trusted?DefenseCore.clampNumber(tower.rangeDebuffUntil,0,1e9,0):0,targetMode:DEFENSE_TARGET_MODES.includes(tower.targetMode)?tower.targetMode:"first",doctrine:structureType?null:(trusted&&DEFENSE_DOCTRINES[tower.doctrine]?tower.doctrine:null),shots:trusted?DefenseCore.clampInteger(tower.shots,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS*20,0):0,placedAt:trusted?DefenseCore.clampNumber(tower.placedAt,0,1e9,0):0,superForm:structureType?null:(trusted&&["power","control"].includes(tower.superForm)?tower.superForm:null),structureType,targetId:null,retargetAt:0,retargetAtReal:0};
    }).filter(Boolean);
  }

  function defenseHealthScale(wave){const w=Math.max(1,Number(wave)||1);return 1+Math.min(29,w-1)*.115+Math.max(0,w-30)*.038+Math.max(0,w-80)*.012;}
  function defenseDurabilityScale(wave,{boss=false}={}){const w=Math.max(1,Number(wave)||1),late=1+Math.max(0,w-40)*.004;if(!boss)return late;const remix=Math.min(.22,Math.floor(Math.max(0,w-10)/40)*.07);return late*(w<=10?.88:1.28+remix);}
  function defenseCanonicalEnemySnapshot(raw,currentWave,map,index=0,preciseArmor=false,currentClock=0){
    if(!raw||typeof raw!=="object")return null;
    const boss=DEFENSE_BOSSES.find(item=>item.id===raw.bossId)||null,type=boss?"boss":DEFENSE_ENEMIES[raw.type]?raw.type:null;if(!type)return null;
    const base=boss||DEFENSE_ENEMIES[type],intensity=DefenseCore.clampInteger(raw.bossIntensity,0,99,0),bossChild=Boolean(raw.bossChild),scale=defenseHealthScale(currentWave)*(map.hp||1)*(boss?1+Math.min(12,intensity)*.10:1)*defenseDurabilityScale(currentWave,{boss:Boolean(boss)}),canonicalMax=Math.max(.01,base.hp*scale*(bossChild?.5:1)),legacyRatio=Number(raw.maxHp)>0?Number(raw.hp)/Number(raw.maxHp):1,hpRatio=DefenseCore.clampNumber(raw.hpRatio,0.001,1,DefenseCore.clampNumber(legacyRatio,.001,1,1)),maxHp=canonicalMax,hp=Math.max(.01,maxHp*hpRatio),baseArmor=DefenseCore.clampNumber(base.armor||0,0,.95,0),armorBroken=Boolean(raw.armorBroken),armorShredded=Boolean(raw.armorShredded),armor=preciseArmor?DefenseCore.clampNumber(raw.armor,0,baseArmor,baseArmor):armorBroken?Math.min(baseArmor,.06):armorShredded?Math.max(0,baseArmor-.08):baseArmor;
    return{id:typeof raw.id==="string"&&raw.id?raw.id.slice(0,80):`enemy-${index+1}`,type,bossId:boss?.id||null,bossIntensity:intensity,bossChild,progress:DefenseCore.clampNumber(raw.progress,0,.999,0),hp,maxHp,speed:base.speed*(1+Math.min(.22,currentWave*.006))*(map.speed||1),reward:DefenseCore.calculateEnemyReward(base.reward,currentWave,{rewardScale:bossChild?.5:1}),damage:base.damage,baseArmor,armor,armorBroken,armorShredded,fireproof:Boolean(base.fireproof),slowResist:base.slowResist||0,stormPulse:Boolean(base.stormPulse),supportAura:Boolean(base.supportAura),healer:Boolean(base.healer),supportCycle:Number.isFinite(Number(raw.supportCycle))?DefenseCore.clampInteger(raw.supportCycle,0,1_000_000_000,0):Math.floor((DefenseCore.clampNumber(currentClock,0,1e9,0)+DefenseCore.clampNumber(raw.phaseOffset,-100,100,0))/3.6),phasing:Boolean(base.phasing),camo:Boolean(base.camo),phaseOffset:DefenseCore.clampNumber(raw.phaseOffset,-100,100,0),phaseActive:false,revealUntil:DefenseCore.clampNumber(raw.revealUntil,0,1e9,0),phaseSuppressedUntil:DefenseCore.clampNumber(raw.phaseSuppressedUntil,0,1e9,0),revealCredited:Boolean(raw.revealCredited),phaseLockCredited:Boolean(raw.phaseLockCredited),slow:DefenseCore.clampNumber(raw.slow,0,.95,0),slowUntil:DefenseCore.clampNumber(raw.slowUntil,0,1e9,0),burn:DefenseCore.clampNumber(raw.burn,0,1e6,0),burnUntil:DefenseCore.clampNumber(raw.burnUntil,0,1e9,0),burnSourceId:typeof raw.burnSourceId==="string"?raw.burnSourceId.slice(0,80):null,poison:DefenseCore.clampNumber(raw.poison,0,1e6,0),poisonUntil:DefenseCore.clampNumber(raw.poisonUntil,0,1e9,0),poisonSourceId:typeof raw.poisonSourceId==="string"?raw.poisonSourceId.slice(0,80):null,rootUntil:DefenseCore.clampNumber(raw.rootUntil,0,1e9,0),phaseTriggered:Boolean(raw.phaseTriggered),bossPhase:DefenseCore.clampInteger(raw.bossPhase,0,12,0),signalStaggerUntil:DefenseCore.clampNumber(raw.signalStaggerUntil,0,1e9,0),nextBossPulse:DefenseCore.clampNumber(raw.nextBossPulse,0,1e9,0),telegraphKind:DEFENSE_BOSS_TELEGRAPHS[raw.telegraphKind]?raw.telegraphKind:null,telegraphStartedAt:DefenseCore.clampNumber(raw.telegraphStartedAt,0,1e9,0),telegraphUntil:DefenseCore.clampNumber(raw.telegraphUntil,0,1e9,0),telegraphDisruption:DefenseCore.clampNumber(raw.telegraphDisruption,0,1,0),apexSurgeUntil:DefenseCore.clampNumber(raw.apexSurgeUntil,0,1e9,0),bossMechanicLocked:Boolean(raw.bossMechanicLocked)};
  }
  function normalizeDefenseCheckpoint(raw){
    if(!raw||typeof raw!=="object")return null;
    const version=Number(raw.checkpointVersion)||1;if(![1,2,3,4,5,6,7,8,9,DEFENSE_CHECKPOINT_VERSION].includes(version))return null;
    const savedAt=DefenseCore.clampNumber(raw.savedAt,0,Number.MAX_SAFE_INTEGER,0);if(!savedAt)return null; // No expiry: an unfinished run keeps its earned waves until the player resumes or ends it.
    if(typeof raw.keeperId!=="string"||raw.keeperId!==hostKeeperId())return null;
    const mapId=typeof raw.mapId==="string"&&DEFENSE_MAPS[raw.mapId]?raw.mapId:null;if(!mapId)return null;const map=DEFENSE_MAPS[mapId];
    const signatureValid=version>=2&&DefenseCore.verifySaveSignature(raw),legacyUnsigned=version===1,trusted=signatureValid||legacyUnsigned;
    const oldWave=DefenseCore.clampInteger(raw.wave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0),rawPhase=DefenseCore.normalizePhase(raw.phase,DEFENSE_PHASES.PLANNING),legacyActive=legacyUnsigned&&raw.phase==="wave";
    let currentWave=DefenseCore.clampInteger(raw.currentWave??oldWave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0),clearedWave=Math.min(currentWave,DefenseCore.clampInteger(raw.clearedWave??(legacyActive?Math.max(0,oldWave-1):oldWave),0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0));
    if(!trusted){const verifiedMapBest=DefenseCore.clampInteger(store.records.maps?.[mapId],0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0);clearedWave=Math.min(clearedWave,verifiedMapBest);currentWave=clearedWave;defenseRecordValidationWarning("checkpoint-signature",{mapId,requestedCurrentWave:raw.currentWave??raw.wave,requestedClearedWave:raw.clearedWave,restoredClearedWave:clearedWave});}
    if(trusted&&currentWave>clearedWave+1){defenseRecordValidationWarning("checkpoint-wave-gap",{mapId,requestedCurrentWave:currentWave,clearedWave});currentWave=Math.min(DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,clearedWave+1);}
    const towers=defenseCanonicalTowerSnapshots(raw.towers,mapId,{trusted,legacyOpeningPerkInference:trusted&&version===4});if(!towers.length)return null;
    const enemyIds=new Set(),enemies=trusted?(Array.isArray(raw.enemies)?raw.enemies:[]).slice(0,DEFENSE_LIMITS.MAX_CHECKPOINT_ENEMIES).map((enemy,index)=>{const snapshot=defenseCanonicalEnemySnapshot(enemy,currentWave,map,index,version>=8,raw.clock);if(!snapshot)return null;let id=snapshot.id;if(enemyIds.has(id)){let suffix=0;do{id=`enemy-${index+1}${suffix?`-${suffix}`:""}`;suffix+=1;}while(enemyIds.has(id));snapshot.id=id;}enemyIds.add(id);return snapshot;}).filter(Boolean):[];
    let spawnQueue=trusted?(Array.isArray(raw.spawnQueue)?raw.spawnQueue:[]).map(defenseQueueEntry).filter(Boolean).slice(0,DEFENSE_LIMITS.MAX_QUEUE_ENTRIES):[],wavePackets=trusted?(Array.isArray(raw.wavePackets)?raw.wavePackets:[]).map(normalizeDefensePacket).filter(Boolean).slice(0,12):[];
    let packetIndex=trusted?DefenseCore.clampInteger(raw.packetIndex,0,wavePackets.length,0):0,packetEnemyIndex=trusted&&packetIndex<wavePackets.length?DefenseCore.clampInteger(raw.packetEnemyIndex,0,wavePackets[packetIndex].enemies.length,0):0;
    if(trusted&&wavePackets.length){const packetRemaining=[];for(let i=packetIndex;i<wavePackets.length;i++){const start=i===packetIndex?packetEnemyIndex:0;for(let j=start;j<wavePackets[i].enemies.length;j++)packetRemaining.push(wavePackets[i].enemies[j]);}const sameQueue=packetRemaining.length===spawnQueue.length&&packetRemaining.every((entry,index)=>JSON.stringify(entry)===JSON.stringify(spawnQueue[index]));if(!sameQueue){const conservative=spawnQueue.length>=packetRemaining.length?spawnQueue:packetRemaining;spawnQueue=conservative.slice(0,DEFENSE_LIMITS.MAX_QUEUE_ENTRIES).map(entry=>typeof entry==="string"?entry:{...entry});wavePackets=spawnQueue.length?[{enemies:[...spawnQueue],spawnGap:.34,breakAfter:0}]:[];packetIndex=0;packetEnemyIndex=0;defenseRecordValidationWarning("checkpoint-scheduler",{mapId,spawnQueue:spawnQueue.length,packetRemaining:packetRemaining.length});}}else if(trusted&&spawnQueue.length&&!wavePackets.length){wavePackets=[{enemies:[...spawnQueue],spawnGap:.34,breakAfter:0}];packetIndex=0;packetEnemyIndex=0;}
    const currentWavePlan=trusted?(Array.isArray(raw.currentWavePlan)?raw.currentWavePlan:spawnQueue).map(defenseQueueEntry).filter(Boolean).slice(0,DEFENSE_LIMITS.MAX_QUEUE_ENTRIES):[],childSpawnQueue=trusted?(Array.isArray(raw.childSpawnQueue)?raw.childSpawnQueue:[]).map(normalizeDefenseChildSpawn).filter(Boolean).slice(0,DEFENSE_LIMITS.MAX_CHILD_BUFFER):[],announcement=trusted&&raw.waveAnnouncement&&typeof raw.waveAnnouncement==="object"?{title:String(raw.waveAnnouncement.title||"").slice(0,100),copy:String(raw.waveAnnouncement.copy||"").slice(0,240)}:null;
    const maxWaveEntities=DEFENSE_LIMITS.MAX_QUEUE_ENTRIES+DEFENSE_LIMITS.MAX_CHILD_BUFFER,outstandingWaveEntities=Math.min(maxWaveEntities,spawnQueue.length+childSpawnQueue.length+enemies.length),rawWaveTotal=trusted?DefenseCore.clampInteger(raw.waveTotal,0,maxWaveEntities,0):0,rawWaveResolved=trusted?DefenseCore.clampInteger(raw.waveResolved,0,maxWaveEntities,0):0;let waveResolved=Math.min(rawWaveResolved,rawWaveTotal,Math.max(0,maxWaveEntities-outstandingWaveEntities)),waveTotal=Math.max(rawWaveTotal,waveResolved+outstandingWaveEntities);
    let phase=trusted?(DefenseCore.isCombatPhase(rawPhase)?DEFENSE_PHASES.PAUSED:rawPhase===DEFENSE_PHASES.WAVE_COMPLETE?DEFENSE_PHASES.WAVE_COMPLETE:DEFENSE_PHASES.PLANNING):(clearedWave>0?DEFENSE_PHASES.WAVE_COMPLETE:DEFENSE_PHASES.PLANNING),resumePhase=trusted&&DefenseCore.isCombatPhase(rawPhase)?(rawPhase===DEFENSE_PHASES.PAUSED?[DEFENSE_PHASES.COUNTDOWN,DEFENSE_PHASES.COMBAT,DEFENSE_PHASES.PACKET_BREAK].includes(raw.resumePhase)?raw.resumePhase:DEFENSE_PHASES.COMBAT:rawPhase):DEFENSE_PHASES.COMBAT;
    const unfinishedAccounting=outstandingWaveEntities>0||waveResolved<waveTotal;
    if(trusted&&currentWave>clearedWave&&!unfinishedAccounting){defenseRecordValidationWarning("checkpoint-empty-unfinished",{mapId,currentWave,clearedWave});currentWave=clearedWave;phase=clearedWave>0?DEFENSE_PHASES.WAVE_COMPLETE:DEFENSE_PHASES.PLANNING;}
    else if(trusted&&currentWave>clearedWave&&!DefenseCore.isCombatPhase(rawPhase)){phase=DEFENSE_PHASES.PAUSED;resumePhase=enemies.length||packetIndex||packetEnemyIndex?DEFENSE_PHASES.COMBAT:DEFENSE_PHASES.COUNTDOWN;defenseRecordValidationWarning("checkpoint-phase",{mapId,requestedPhase:rawPhase,currentWave,clearedWave,repairedPhase:phase});}
    else if(trusted&&currentWave<=clearedWave&&DefenseCore.isCombatPhase(rawPhase)){spawnQueue=[];wavePackets=[];packetIndex=0;packetEnemyIndex=0;childSpawnQueue.length=0;currentWavePlan.length=0;enemies.length=0;waveTotal=0;waveResolved=0;phase=clearedWave>0?DEFENSE_PHASES.WAVE_COMPLETE:DEFENSE_PHASES.PLANNING;resumePhase=DEFENSE_PHASES.COMBAT;defenseRecordValidationWarning("checkpoint-stale-combat",{mapId,currentWave,clearedWave,requestedPhase:rawPhase});}
    const status=signatureValid?(version===DEFENSE_CHECKPOINT_VERSION?"verified":"migrated"):legacyUnsigned?"migrated":"sanitized";
    return{checkpointVersion:DEFENSE_CHECKPOINT_VERSION,savedAt,keeperId:raw.keeperId,mapId,contract:trusted?normalizeDefenseRunContract(raw.contract):null,currentWave,clearedWave,lives:DefenseCore.clampInteger(raw.lives,1,map.lives,map.lives),cash:trusted?DefenseCore.clampNumber(raw.cash,0,DEFENSE_LIMITS.MAX_RUN_CASH,BASE_DEFENSE_STARTING_CASH):Math.min(BASE_DEFENSE_STARTING_CASH,DefenseCore.clampNumber(raw.cash,0,BASE_DEFENSE_STARTING_CASH,BASE_DEFENSE_STARTING_CASH)),phase,resumePhase,speed:trusted&&[.5,1,2].includes(Number(raw.speed))?Number(raw.speed):1,clock:trusted?DefenseCore.clampNumber(raw.clock,0,1e9,0):0,towers,enemies,projectiles:trusted&&version>=8?(Array.isArray(raw.projectiles)?raw.projectiles:[]).slice(0,DEFENSE_LIMITS.MAX_CHECKPOINT_PROJECTILES).filter(shot=>towers.some(t=>t.id===shot.towerId)&&enemies.some(e=>e.id===shot.targetId)).map(shot=>({towerId:shot.towerId,targetId:shot.targetId,x:DefenseCore.clampNumber(shot.x,0,1,.5),y:DefenseCore.clampNumber(shot.y,0,1,.5),life:DefenseCore.clampNumber(shot.life,0,.7,0),damage:DefenseCore.clampNumber(shot.damage,0,1e7,0),speed:DefenseCore.clampNumber(shot.speed,.1,4,1.8),doctrineStrike:["power","control"].includes(shot.doctrineStrike)?shot.doctrineStrike:null,doubleStitch:Boolean(shot.doubleStitch)})):[],spawnQueue,wavePackets,packetIndex,packetEnemyIndex,nextSpawnAt:trusted?DefenseCore.clampNumber(raw.nextSpawnAt,0,1e9,0):0,packetBreakUntil:trusted?DefenseCore.clampNumber(raw.packetBreakUntil,0,1e9,0):0,childSpawnQueue,nextId:trusted?DefenseCore.clampInteger(raw.nextId,1,Number.MAX_SAFE_INTEGER,1):towers.length+1,kills:trusted?DefenseCore.clampInteger(raw.kills,0,DEFENSE_LIMITS.MAX_REASONABLE_KILLS,0):0,totalDamage:trusted?DefenseCore.clampNumber(raw.totalDamage,0,DEFENSE_LIMITS.MAX_REASONABLE_DAMAGE,0):0,usedPetIds:[...new Set(towers.map(tower=>tower.petId))],lastWaveBonus:trusted?DefenseCore.clampInteger(raw.lastWaveBonus,0,DEFENSE_LIMITS.MAX_RUN_CASH,0):0,rallyUntil:trusted?DefenseCore.clampNumber(raw.rallyUntil,0,1e9,0):0,prismUntil:trusted?DefenseCore.clampNumber(raw.prismUntil,0,1e9,0):0,whiteoutUntil:trusted?DefenseCore.clampNumber(raw.whiteoutUntil,0,1e9,0):0,stormWeatherUntil:trusted?DefenseCore.clampNumber(raw.stormWeatherUntil,0,1e9,0):0,eclipseUntil:trusted?DefenseCore.clampNumber(raw.eclipseUntil,0,1e9,0):0,ashUntil:trusted?DefenseCore.clampNumber(raw.ashUntil,0,1e9,0):0,moonRevealUntil:trusted?DefenseCore.clampNumber(raw.moonRevealUntil,0,1e9,0):0,nextWeatherAt:trusted?DefenseCore.clampNumber(raw.nextWeatherAt,0,1e9,7):7,camoHintSeen:trusted&&Boolean(raw.camoHintSeen),waveAnnouncement:announcement,currentWavePlan,bossesBeaten:trusted&&Array.isArray(raw.bossesBeaten)?raw.bossesBeaten.filter(id=>DEFENSE_BOSSES.some(boss=>boss.id===id)).slice(0,DEFENSE_LIMITS.MAX_REASONABLE_BOSSES):[],bossesDefeated:trusted?DefenseCore.clampInteger(raw.bossesDefeated??raw.bossesBeaten?.length,0,DEFENSE_LIMITS.MAX_REASONABLE_BOSSES,0):0,perfectWaveCount:trusted?Math.min(clearedWave,DefenseCore.clampInteger(raw.perfectWaveCount,0,DEFENSE_LIMITS.MAX_REASONABLE_PERFECT_WAVES,0)):0,waveHeartLossStart:trusted?DefenseCore.clampInteger(raw.waveHeartLossStart,0,9999,0):0,waveTotal,waveResolved,enemyStats:trusted?normalizeDefenseEnemyStats(raw.enemyStats):normalizeDefenseEnemyStats(null),worldPerkUsed:towers.some(tower=>tower.openingPerkApplied),gateFlameArmed:false,gateFlameReadyAt:trusted?DefenseCore.clampNumber(raw.gateFlameReadyAt,0,1e9,0):0,gateFlameUntil:trusted?DefenseCore.clampNumber(raw.gateFlameUntil,0,1e9,0):0,gateFlameProgress:trusted?DefenseCore.clampNumber(raw.gateFlameProgress,0,1,.86):.86,gateFlameNextTick:trusted?DefenseCore.clampNumber(raw.gateFlameNextTick,0,1e9,0):0,gateFlameTicks:trusted?DefenseCore.clampInteger(raw.gateFlameTicks,0,1000,0):0,reason:typeof raw.reason==="string"?raw.reason.slice(0,40):"auto",validationStatus:status};
  }
  function readDefenseCheckpoint(){
    try{
      const raw=host?.run.read();
      if(!raw)return null;
      const checkpoint=normalizeDefenseCheckpoint(raw);
      if(!checkpoint){host.run.clear();return null;}
      return checkpoint;
    }catch(error){defenseRecordValidationWarning("checkpoint-parse",{message:String(error?.message||error)});return null;}
  }
  function buildDefenseCheckpoint(d,reason="auto"){
    flushDefenseIncome(d,"checkpoint");
    const savedAt=now(),checkpoint={checkpointVersion:DEFENSE_CHECKPOINT_VERSION,savedAt,keeperId:hostKeeperId(),mapId:d.mapId,contract:d.contract?{...d.contract}:null,currentWave:d.currentWave,clearedWave:d.clearedWave,lives:d.lives,cash:d.cash,phase:d.phase,resumePhase:d.resumePhase||DEFENSE_PHASES.COMBAT,speed:d.speed,clock:d.clock,towers:d.towers.map(tower=>({id:tower.id,petId:tower.petId,source:tower.source,rosterIndex:tower.rosterIndex,copyNumber:tower.copyNumber,x:tower.x,y:tower.y,upgrade:tower.upgrade,cooldown:tower.cooldown,kills:tower.kills,damage:tower.damage,abilityReadyAt:tower.abilityReadyAt,overclockUntil:tower.overclockUntil,rangeDebuffUntil:tower.rangeDebuffUntil,targetMode:tower.targetMode,doctrine:tower.doctrine,shots:tower.shots,placedAt:tower.placedAt||0,openingPerkApplied:Boolean(tower.openingPerkApplied),superForm:tower.superForm||null})),enemies:d.enemies.filter(enemy=>!enemy.dead).slice(0,DEFENSE_LIMITS.MAX_CHECKPOINT_ENEMIES).map(enemy=>({id:enemy.id,type:enemy.type,bossId:enemy.bossId,bossIntensity:enemy.bossIntensity,bossChild:enemy.bossChild,progress:enemy.progress,hpRatio:enemy.hp/Math.max(.01,enemy.maxHp),armor:enemy.armor,armorBroken:enemy.armorBroken,armorShredded:enemy.armorShredded,phaseOffset:enemy.phaseOffset,supportCycle:enemy.supportCycle,revealUntil:enemy.revealUntil,phaseSuppressedUntil:enemy.phaseSuppressedUntil,revealCredited:enemy.revealCredited,phaseLockCredited:enemy.phaseLockCredited,slow:enemy.slow,slowUntil:enemy.slowUntil,burn:enemy.burn,burnUntil:enemy.burnUntil,burnSourceId:enemy.burnSource?.id||null,poison:enemy.poison,poisonUntil:enemy.poisonUntil,poisonSourceId:enemy.poisonSource?.id||null,rootUntil:enemy.rootUntil,phaseTriggered:enemy.phaseTriggered,bossPhase:enemy.bossPhase||0,signalStaggerUntil:enemy.signalStaggerUntil||0,nextBossPulse:enemy.nextBossPulse,telegraphKind:enemy.telegraphKind||null,telegraphStartedAt:enemy.telegraphStartedAt||0,telegraphUntil:enemy.telegraphUntil||0,telegraphDisruption:enemy.telegraphDisruption||0,apexSurgeUntil:enemy.apexSurgeUntil||0,bossMechanicLocked:Boolean(enemy.bossMechanicLocked)})),projectiles:d.projectiles.filter(shot=>shot.target&&!shot.target.dead&&shot.target.hp>0).slice(0,DEFENSE_LIMITS.MAX_CHECKPOINT_PROJECTILES).map(shot=>({towerId:shot.tower.id,targetId:shot.target.id,x:shot.x,y:shot.y,life:shot.life,speed:shot.speed,damage:shot.damage,doctrineStrike:shot.doctrineStrike||null,doubleStitch:Boolean(shot.doubleStitch)})),spawnQueue:d.spawnQueue.map(entry=>typeof entry==="string"?entry:{...entry}),wavePackets:(d.wavePackets||[]).map(packet=>({enemies:packet.enemies.map(entry=>typeof entry==="string"?entry:{...entry}),spawnGap:packet.spawnGap,breakAfter:packet.breakAfter})),packetIndex:d.packetIndex||0,packetEnemyIndex:d.packetEnemyIndex||0,nextSpawnAt:d.nextSpawnAt||0,packetBreakUntil:d.packetBreakUntil||0,childSpawnQueue:(d.childSpawnQueue||[]).map(item=>({entry:typeof item.entry==="string"?item.entry:{...item.entry},progress:item.progress,releaseAt:item.releaseAt,options:{bossChild:Boolean(item.options?.bossChild),hpRatio:item.options?.hpRatio??1,rewardScale:item.options?.rewardScale??1}})),nextId:d.nextId,kills:d.kills,totalDamage:d.totalDamage,usedPetIds:[...(d.usedPetIds||[])],lastWaveBonus:d.lastWaveBonus,rallyUntil:d.rallyUntil,prismUntil:d.prismUntil,whiteoutUntil:d.whiteoutUntil,stormWeatherUntil:d.stormWeatherUntil,eclipseUntil:d.eclipseUntil,ashUntil:d.ashUntil,moonRevealUntil:d.moonRevealUntil,nextWeatherAt:d.nextWeatherAt,camoHintSeen:d.camoHintSeen,waveAnnouncement:d.waveAnnouncement?{...d.waveAnnouncement}:null,currentWavePlan:d.currentWavePlan.map(entry=>typeof entry==="string"?entry:{...entry}),bossesBeaten:[...(d.bossesBeaten||[])],bossesDefeated:d.bossesDefeated||0,perfectWaveCount:d.perfectWaveCount||0,waveHeartLossStart:d.waveHeartLossStart||0,waveTotal:d.waveTotal,waveResolved:d.waveResolved,enemyStats:JSON.parse(JSON.stringify(d.enemyStats||{})),worldPerkUsed:Boolean(d.worldPerkUsed),gateFlameReadyAt:d.gateFlameReadyAt||0,gateFlameUntil:d.gateFlameUntil||0,gateFlameProgress:d.gateFlameProgress||.86,gateFlameNextTick:d.gateFlameNextTick||0,gateFlameTicks:d.gateFlameTicks||0,reason};
    checkpoint.signature=DefenseCore.createSaveSignature(checkpoint);return checkpoint;
  }
  function clearDefenseCheckpoint(){host?.run.clear();}
  function writeDefenseCheckpoint(force=false,reason="auto"){
    const d=mini.active?mini.defense:null;if(!d||!d.towers.length){clearDefenseCheckpoint();return false;}
    if(!force&&now()-(d.lastCheckpointAt||0)<1000){d.checkpointDirty=true;return false;}
    try{const checkpoint=buildDefenseCheckpoint(d,reason);if(!host?.run.write(checkpoint))return false;d.lastCheckpointAt=checkpoint.savedAt;d.checkpointDirty=false;d.checkpointWrites=(d.checkpointWrites||0)+1;return true;}catch(error){defenseRecordValidationWarning("checkpoint-write",{message:String(error?.message||error)});return false;}
  }
  function maybeWriteDefenseCheckpoint(dt){const d=mini.defense;if(!d)return;d.checkpointClock=(d.checkpointClock||0)+Math.max(0,dt);if(d.checkpointClock>=1){d.checkpointClock=0;if(d.checkpointDirty)writeDefenseCheckpoint(false,"combat");}}
  function renderRestoredDefenseProjectile(){return false;}
  function restoreDefenseCheckpoint(raw){
    const checkpoint=normalizeDefenseCheckpoint(raw);if(!checkpoint)return false;initializeDefenseRun(checkpoint.mapId,checkpoint.contract,{allowLockedMap:checkpoint.validationStatus!=="sanitized"});const d=mini.defense,placedIds=[...new Set([captainPet()?.id,...checkpoint.towers.map(tower=>tower.petId)].filter(Boolean))].filter(id=>!DEFENSE_UNIVERSAL_PET_IDS.has(id)),fillIds=defenseConfiguredWingIds().filter(id=>!placedIds.includes(id)).slice(0,Math.max(0,1+DEFENSE_ROSTER_WING_SLOTS-placedIds.length)),runRosterIds=[...placedIds,...fillIds];d.runRosterIds=runRosterIds;const roster=defenseRestorableRegistry();
    Object.assign(d,{runRosterIds,currentWave:checkpoint.currentWave,clearedWave:checkpoint.clearedWave,lives:checkpoint.lives,cash:checkpoint.cash,phase:checkpoint.phase,resumePhase:checkpoint.resumePhase,speed:checkpoint.speed,clock:checkpoint.clock,spawnQueue:checkpoint.spawnQueue.map(entry=>typeof entry==="string"?entry:{...entry}),wavePackets:checkpoint.wavePackets.map(packet=>({enemies:packet.enemies.map(entry=>typeof entry==="string"?entry:{...entry}),spawnGap:packet.spawnGap,breakAfter:packet.breakAfter})),packetIndex:checkpoint.packetIndex,packetEnemyIndex:checkpoint.packetEnemyIndex,nextSpawnAt:checkpoint.nextSpawnAt,packetBreakUntil:checkpoint.packetBreakUntil,childSpawnQueue:checkpoint.childSpawnQueue.map(item=>({...item,options:{...item.options}})),nextId:checkpoint.nextId,kills:checkpoint.kills,totalDamage:checkpoint.totalDamage,usedPetIds:new Set(checkpoint.usedPetIds),lastWaveBonus:checkpoint.lastWaveBonus,rallyUntil:checkpoint.rallyUntil,prismUntil:checkpoint.prismUntil,whiteoutUntil:checkpoint.whiteoutUntil,stormWeatherUntil:checkpoint.stormWeatherUntil,eclipseUntil:checkpoint.eclipseUntil,ashUntil:checkpoint.ashUntil,moonRevealUntil:checkpoint.moonRevealUntil,nextWeatherAt:checkpoint.nextWeatherAt,camoHintSeen:checkpoint.camoHintSeen,waveAnnouncement:checkpoint.waveAnnouncement,currentWavePlan:checkpoint.currentWavePlan.map(entry=>typeof entry==="string"?entry:{...entry}),bossesBeaten:[...checkpoint.bossesBeaten],bossesDefeated:checkpoint.bossesDefeated,perfectWaveCount:checkpoint.perfectWaveCount,waveHeartLossStart:checkpoint.waveHeartLossStart,waveTotal:checkpoint.waveTotal,waveResolved:checkpoint.waveResolved,enemyStats:normalizeDefenseEnemyStats(checkpoint.enemyStats),worldPerkUsed:checkpoint.worldPerkUsed,gateFlameArmed:false,gateFlameReadyAt:checkpoint.gateFlameReadyAt,gateFlameUntil:checkpoint.gateFlameUntil,gateFlameProgress:checkpoint.gateFlameProgress,gateFlameNextTick:checkpoint.gateFlameNextTick,gateFlameTicks:checkpoint.gateFlameTicks,checkpointDirty:false,checkpointClock:0,pendingIncome:0,pendingIncomeEvents:0,pendingIncomeSources:{},realClock:0,nextIncomeFlushAtReal:0,nextChildReleaseAtReal:0,childSpawnSequence:0,targetSnapshot:[],targetSnapshotAtReal:0,targetSnapshotBuilds:0,childSpawnsReleased:0,lastIncomeBatch:null,flowDecisionBeat:0,flowPulseUntilReal:0,flowEaseUntilReal:0,flowChoiceKey:"",flowLastAction:"",flowActionQuietUntilReal:0,flowAutoHeldWave:-1});
    d.towers=checkpoint.towers.map(snapshot=>{const row=roster.get(snapshot.petId);if(!row)return null;const structureType=defenseStructureType(row);return{...snapshot,pet:row.pet,source:row.source,rosterIndex:row.rosterIndex,structureType,node:null,targetId:null,retargetAt:0,retargetAtReal:0,nextProductionAt:0,totalProduced:0,factoryCleanCycles:0,factoryLivesSnapshot:d.lives,factoryLastInterval:0};}).filter(Boolean);if(!d.towers.length){clearDefenseCheckpoint();return false;}for(const tower of d.towers)if(defenseStructureType(tower)==="factory"){const econ=defenseFactoryEconomy(tower,d);tower.nextProductionAt=d.clock+econ.interval;tower.factoryLastInterval=econ.interval;}d.usedPetIds=new Set([...d.usedPetIds,...d.towers.map(tower=>tower.petId)]);d.enemies=[];d.projectiles=[];mini.entities=[];renderDefenseWorld();const towerMap=new Map();for(const tower of d.towers){renderDefenseTower(tower);towerMap.set(tower.id,tower);}const enemyMap=new Map();for(const snapshot of checkpoint.enemies){const descriptor=snapshot.bossId?{type:"boss",bossId:snapshot.bossId,intensity:snapshot.bossIntensity}:snapshot.type,enemy=spawnDefenseEnemy(descriptor,{progress:snapshot.progress,hpOverride:snapshot.hp,maxHpOverride:snapshot.maxHp,bossChild:snapshot.bossChild,skipAnalytics:true,rewardScale:snapshot.bossChild?.5:1});const node=enemy.node;Object.assign(enemy,snapshot,{node,burnSource:null,poisonSource:null});if(node){node.dataset.enemyId=enemy.id;const data=snapshot.bossId?DEFENSE_BOSSES.find(item=>item.id===snapshot.bossId):DEFENSE_ENEMIES[snapshot.type];node.className=`defense-enemy ${snapshot.bossId?`balloon-boss ${data?.className||"boss-crown"}`:data?.className||"balloon-puff"}`;node.style.setProperty("--balloon-color",data?.color||"#ff5b68");const trait=node.querySelector(".balloon-trait");if(trait)trait.textContent=data?.icon||"○";}enemyMap.set(enemy.id,enemy);}for(const snapshot of checkpoint.enemies){const enemy=enemyMap.get(snapshot.id);if(!enemy)continue;enemy.burnSource=towerMap.get(snapshot.burnSourceId)||null;enemy.poisonSource=towerMap.get(snapshot.poisonSourceId)||null;updateDefenseEnemyNode(enemy,true);}for(const saved of checkpoint.projectiles){const tower=towerMap.get(saved.towerId),target=enemyMap.get(saved.targetId);if(!tower||!target)continue;const stats=defenseCombatStats(tower);d.projectiles.push({...saved,id:`shot-${d.nextId++}`,tower,target,prevX:saved.x,prevY:saved.y,kind:stats.projectile,masteryTier:defenseMasteryTierForPet(tower.petId),node:null,renderVisible:defenseUsesCanvas(d),renderColor:(VARIANTS.find(v=>v.id===stats.variant)||VARIANTS[0]).color});}
    const newestEnemy=d.enemies.filter(enemy=>!enemy.dead).sort((a,b)=>a.progress-b.progress)[0]||null;d.lastSpawnedEnemyId=newestEnemy?.id||null;d.spawnWaitReason=newestEnemy?"restored-distance":"restored-timer";d.peakAlive=Math.max(d.peakAlive||0,d.enemies.length);d.waveTotal=Math.max(d.waveTotal,d.waveResolved+d.spawnQueue.length+d.childSpawnQueue.length+d.enemies.length);d.nextId=Math.max(d.nextId,checkpoint.nextId);mini.score=d.clearedWave;mini.hits=d.kills;updateDefenseRoster();markDefenseUi();flushDefenseUi(true);const unfinished=d.currentWave>d.clearedWave;setDefenseMessage(unfinished?`RUN RESTORED • WAVE ${d.currentWave} PAUSED`:`RUN RESTORED • ${d.clearedWave} CLEARED`,unfinished?`Permanent progress remains at Wave ${d.clearedWave}. Tap ▶ when ready.`:"Your field and match coins are waiting. Start the next wave when ready.");writeDefenseCheckpoint(true,checkpoint.validationStatus==="migrated"?"migrated":"restored");return true;
  }
  function defenseCheckpointLobbyMarkup(checkpoint){if(!checkpoint)return"";const map=DEFENSE_MAPS[checkpoint.mapId]||DEFENSE_MAPS.grove,threats=checkpoint.spawnQueue.length+checkpoint.childSpawnQueue.length+checkpoint.enemies.length,unfinished=checkpoint.currentWave>checkpoint.clearedWave,phase=unfinished?`${threats} THREATS PAUSED • CLEARED ${checkpoint.clearedWave}`:checkpoint.clearedWave?`PLANNING WAVE ${checkpoint.clearedWave+1}`:"SETUP",contract=normalizeDefenseRunContract(checkpoint.contract);return`<section class="defense-resume-card ${contract?"contract-run":""}"><div><small>${contract?"TRAIL CONTRACT CHECKPOINT":"RUN CHECKPOINT"} • ${escapeHTML(defenseCheckpointAgeCopy(checkpoint.savedAt))}</small><h3>${map.icon} ${escapeHTML(map.name)} • ${unfinished?`REACHED ${checkpoint.currentWave}`:`CLEARED ${checkpoint.clearedWave}`}</h3><p>${escapeHTML(phase)} • ♥ ${checkpoint.lives} • ${checkpoint.towers.length} RIZOS • ${Math.floor(checkpoint.cash)} COINS${contract?` • ${escapeHTML(contract.title)}`:""}</p></div><span><button type="button" data-discard-defense-run>DISCARD</button><button class="primary" type="button" data-resume-defense-run>RESUME RUN</button></span></section>`;}

  function defenseRecordsMarkup(){
    const history=store.records.history||[],mastery=Object.values(store.records.mastery||{}).sort((a,b)=>(b.waves||0)-(a.waves||0)||(b.damage||0)-(a.damage||0)).slice(0,8),contracts=(store.records.contracts||[]).map(normalizeDefenseRunContract).filter(Boolean),today=ensureDailyDefenseContract(),streak=defenseContractStreak(contracts),perMap=store.records.maps||{},perfectMaps=store.records.perfectMaps||[],totalBosses=history.reduce((sum,run)=>sum+(run.bosses||0),0);
    const maps=DEFENSE_MAP_ORDER.map(id=>{const map=DEFENSE_MAPS[id],best=Math.max(0,Math.floor(Number(perMap[id])||0)),tier=defenseMedalTier(best),perfect=perfectMaps.includes(id);return`<article class="defense-record-map" style="--map-accent:${defenseMapAccent(id)}"><span>${map.icon}</span><div><small>WORLD ${map.level} • BEST CLEARED ${best}</small><b>${escapeHTML(map.name)}</b><em>${escapeHTML(defenseMedalName(tier))}${perfect?" • GATE PERFECT":""}</em></div>${defenseMedalMarkup(id,best)}</article>`;}).join("");
    const contractRows=contracts.filter(item=>item.completed).slice(0,8).map(item=>{const map=DEFENSE_MAPS[item.mapId]||DEFENSE_MAPS.grove;return`<article class="defense-contract-record"><span>${item.perfect?"✦":"✓"}</span><div><small>${escapeHTML(item.date)} • ${escapeHTML(map.name)}</small><b>${escapeHTML(item.title)}</b><em>${item.rules.map(id=>escapeHTML(DEFENSE_CONTRACT_RULES[id].name)).join(" • ")}</em></div><button type="button" data-replay-defense-contract="${escapeHTML(item.id)}">REPLAY</button></article>`;}).join("")||`<p class="defense-record-empty">SEAL TODAY’S CONTRACT AT WAVE ${DEFENSE_CONTRACT_TARGET} TO BEGIN THE ARCHIVE.</p>`;
    const masteryRows=mastery.length?mastery.map((record,index)=>{const variant=VARIANTS.find(item=>item.id===record.variant)||VARIANTS[0],unlock=defenseMasteryUnlockCopy(record);return`<article class="defense-mastery-row mastery-tier-${unlock.tier}" style="--mastery-color:${variant.color}"><i>${index+1}</i><span><small>${escapeHTML(defenseMasteryTitle(record))} • ${record.runs} RUNS</small><b>${escapeHTML(record.name||"RIZO")}</b><em>${record.waves} WAVES • ${record.pops} POPS • ${Math.round(record.damage)} DMG</em><strong>${escapeHTML(unlock.current)}</strong><u>${escapeHTML(unlock.next)}</u>${defenseMasteryPips(record)}</span></article>`;}).join(""):`<p class="defense-record-empty">DEPLOY A RIZO AND BANK A REAL RUN TO START FIELD MASTERY.</p>`;
    const runRows=history.length?history.slice(0,8).map(run=>{const map=DEFENSE_MAPS[run.mapId]||DEFENSE_MAPS.grove;return`<article class="defense-history-row"><span>${run.contractComplete?"◇":run.perfect?"✦":run.ended==="gate"?"♥":"◉"}</span><div><small>${escapeHTML(map.name)} • ${new Date(run.at||0).toLocaleDateString()}${run.contractComplete?" • CONTRACT":""}</small><b>CLEARED ${run.clearedWave??run.wave}${(run.reachedWave??run.wave)>(run.clearedWave??run.wave)?` • REACHED ${run.reachedWave}`:""} • ${run.kills} POPS</b><em>${run.heartLoss} HEARTS LOST • MVP ${escapeHTML(run.mvpName||"RIZO")}</em></div></article>`;}).join(""):`<p class="defense-record-empty">NO BANKED DEFENSE RUNS YET.</p>`;
    return`<div class="modal-card defense-records-modal"><small>RIZO DEFENSE • PERMANENT RECORDS</small><div class="defense-records-head"><div><h2>THE GATE REMEMBERS.</h2><p>Medals, contracts, run history, and field mastery record what happened. Mastery unlocks presentation only—never hidden permanent damage.</p></div><b>${history.length} RUNS<br>${totalBosses} BOSSES</b></div><section class="defense-records-section defense-signature-guide"><h3>FIELD SIGNATURES</h3><p>10 WAVES • FIELD MARK<br>50 WAVES • VARIANT TRAIL<br>150 WAVES • IMPACT SIGIL<br>400 WAVES • LEGEND AURA</p><em>${store.settings.signatures?"SIGNATURES ACTIVE":"SIGNATURES HIDDEN IN SETTINGS"} • COSMETIC ONLY</em></section><section class="defense-records-section defense-contract-archive"><h3>TRAIL CONTRACTS • ${streak} DAY STREAK</h3><p class="defense-contract-today">TODAY • ${escapeHTML(today.title)} • ${today.completed?"SEALED":`BEST ${today.bestWave}/${today.targetWave}`}</p><div class="defense-contract-records">${contractRows}</div></section><section class="defense-records-section"><h3>WORLD MEDALS</h3><div class="defense-record-map-list">${maps}</div></section><section class="defense-records-section"><h3>RIZO FIELD MASTERY</h3><div class="defense-mastery-list">${masteryRows}</div></section><section class="defense-records-section"><h3>RECENT RUNS</h3><div class="defense-history-list">${runRows}</div></section><div class="modal-buttons"><button type="button" data-defense-field-guide="rizos">FIELD GUIDE</button><button type="button" data-defense-records-back>BACK TO WORLD ROUTE</button><button class="primary" type="button" data-close-modal>BACK TO ARCADE</button></div></div>`;
  }
  function showDefenseRecords(){showModal(defenseRecordsMarkup());playDefenseMusic();}
  function recordDefenseRun(snapshot){
    const clearedWave=DefenseCore.clampInteger(snapshot?.clearedWave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0),reachedWave=Math.max(clearedWave,DefenseCore.clampInteger(snapshot?.currentWave??snapshot?.wave,0,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,0));if(!clearedWave&&!reachedWave)return null;
    const contractProgress=recordDefenseContractProgress(snapshot,true),contract=contractProgress.record,stats=snapshot.enemyStats||{},heartLoss=Math.max(0,Math.floor(Number(stats.heartLoss)||0)),leaks=Object.values(stats.leaked||{}).reduce((sum,value)=>sum+(Number(value)||0),0),bosses=[...new Set(snapshot.bossesBeaten||[])],perfectWaveCount=DefenseCore.clampInteger(snapshot?.perfectWaveCount,0,clearedWave,0),perfect=clearedWave>0&&perfectWaveCount===clearedWave,petTotals=new Map();
    for(const tower of snapshot.towers||[]){const current=petTotals.get(tower.petId)||{petId:tower.petId,name:tower.pet?.name||"RIZO",variant:tower.pet?.variant||tower.pet?.hiddenVariant||"classic",kills:0,damage:0,powerPaths:0,controlPaths:0};current.kills+=Math.max(0,Number(tower.kills)||0);current.damage+=Math.max(0,Number(tower.damage)||0);if(tower.doctrine==="power")current.powerPaths+=1;if(tower.doctrine==="control")current.controlPaths+=1;petTotals.set(tower.petId,current);}
    const leaders=[...petTotals.values()].sort((a,b)=>b.damage-a.damage||b.kills-a.kills),persistentLeaders=leaders.filter(row=>!row.petId.startsWith("defense-crew-")&&!row.petId.startsWith("defense-structure-")&&row.petId!==DEFENSE_BASIC_TOWER.id),top=persistentLeaders[0]||{petId:captainPet().id||"",name:captainPet().name,variant:captainPet().variant||"classic",damage:0};store.records.mastery||={};
    // Defense crew are tactical loaners: combat contribution is real, permanent MVP/mastery is not.
    if(clearedWave>0)for(const row of persistentLeaders){const prior=store.records.mastery[row.petId]||{petId:row.petId,name:row.name,variant:row.variant,runs:0,waves:0,bestWave:0,pops:0,damage:0,bosses:0,powerPaths:0,controlPaths:0,lastAt:0};store.records.mastery[row.petId]={...prior,name:row.name,variant:row.variant,runs:(prior.runs||0)+1,waves:(prior.waves||0)+clearedWave,bestWave:Math.max(prior.bestWave||0,clearedWave),pops:(prior.pops||0)+Math.floor(row.kills),damage:(prior.damage||0)+Math.round(row.damage),bosses:(prior.bosses||0)+(row.petId===top.petId?bosses.length:0),powerPaths:(prior.powerPaths||0)+row.powerPaths,controlPaths:(prior.controlPaths||0)+row.controlPaths,lastAt:now()};}
    const record={id:uid("DEFENSE-RUN"),at:now(),mapId:snapshot.mapId,wave:clearedWave,clearedWave,reachedWave,kills:Math.max(0,Math.floor(Number(snapshot.kills)||0)),heartLoss,leaks:Math.max(0,Math.floor(leaks)),bosses:bosses.length,perfect,perfectWaveCount,ended:snapshot.ended==="gate"?"gate":"banked",mvpPetId:top.petId,mvpName:top.name,mvpVariant:top.variant,mvpDamage:Math.round(top.damage),powerPaths:leaders.reduce((sum,row)=>sum+row.powerPaths,0),controlPaths:leaders.reduce((sum,row)=>sum+row.controlPaths,0),contractId:contract?.id||"",contractDate:contract?.date||"",contractComplete:Boolean(contract?.completed)};
    store.records.history=[record,...(store.records.history||[])].slice(0,12);if(perfect&&clearedWave>=10){store.records.perfectMaps||=[];if(!store.records.perfectMaps.includes(snapshot.mapId))store.records.perfectMaps.push(snapshot.mapId);}return record;
  }

  function defenseNow(){return Number(mini.defense?.clock)||0;}
  const DEFENSE_STRUCTURE_META=Object.freeze({
    factory:Object.freeze({id:"defense-structure-factory",name:"CLOTHING FACTORY",role:"ECONOMY",accent:"#ff7a45"}),
    beacon:Object.freeze({id:"defense-structure-beacon",name:"BEACON",role:"SUPPORT",accent:"#ffe16a"})
  });
  // Universal (Defense-only) deployables. Kept as one ordered list so the bench,
  // pricing, checkpoint restore and reward-exclusion paths all agree on what is a
  // tool rather than a collected Rizo.
  const DEFENSE_UNIVERSAL_STRUCTURE_TYPES=Object.freeze(["factory","beacon"]);
  const DEFENSE_UNIVERSAL_PET_IDS=new Set([DEFENSE_BASIC_TOWER.id,...DEFENSE_UNIVERSAL_STRUCTURE_TYPES.map(type=>DEFENSE_STRUCTURE_META[type].id)]);
  function defenseStructureType(subject){return subject?.structureType||subject?.pet?.defenseStructure||subject?.defenseStructure||null;}
  function defenseStructurePet(type){const meta=DEFENSE_STRUCTURE_META[type]||DEFENSE_STRUCTURE_META.factory;return{id:meta.id,name:meta.name,variant:"classic",hiddenVariant:"classic",stage:"kid",alive:true,defenseGuest:true,defenseStructure:type,accessory:null,skills:{power:0,speed:0,instinct:0,stamina:0,luck:0}};}
  function defenseAwakenedGoldenCount(d=mini.defense){return d?.towers?.filter(tower=>!defenseStructureType(tower)&&(tower.pet.variant||tower.pet.hiddenVariant)==="golden"&&tower.upgrade>=2).length||0;}
  function defenseBeaconNetwork(beacon,d=mini.defense){
    if(!beacon||!d||defenseStructureType(beacon)!=="beacon")return null;const support=DefenseCore.beaconSupport(beacon.upgrade);let combat=0,factories=0,golden=0;
    for(const other of d.towers){if(other===beacon||defenseStructureType(other)==="beacon")continue;if(Math.hypot(beacon.x-other.x,beacon.y-other.y)>support.radius)continue;const type=defenseStructureType(other);if(type==="factory")factories+=1;else{combat+=1;if((other.pet.variant||other.pet.hiddenVariant)==="golden"&&other.upgrade>=2)golden+=1;}}
    const brandLoop=beacon.upgrade>=2&&combat>0&&factories>0,privateSun=brandLoop&&beacon.upgrade>=4;return{combat,factories,golden,brandLoop,privateSun};
  }
  function defenseBeaconInfluence(tower,d=mini.defense){
    if(!tower||!d||defenseStructureType(tower)==="beacon")return null;let best=null;
    for(const beacon of d.towers){if(defenseStructureType(beacon)!=="beacon")continue;const support=DefenseCore.beaconSupport(beacon.upgrade),distance=Math.hypot(beacon.x-tower.x,beacon.y-tower.y);if(distance>support.radius)continue;const network=defenseBeaconNetwork(beacon,d),score=support.rateMultiplier+support.damageMultiplier+support.radius+(network?.brandLoop?.01:0)+(network?.privateSun?.02:0);if(!best||score>best.score)best={...support,score,beacon,network};}
    return best;
  }
  function defenseFactoryEconomy(tower,d=mini.defense){const influence=defenseBeaconInfluence(tower,d),goldens=defenseAwakenedGoldenCount(d),network=influence?.network;return DefenseCore.factoryEconomy({upgradeLevel:tower?.upgrade||0,wave:d?.currentWave||d?.clearedWave||0,goldenTowerCount:goldens,beaconUpgradeLevel:influence?.beacon?.upgrade??-1,cleanCycles:tower?.factoryCleanCycles||0,brandLoop:Boolean(network?.brandLoop),privateSun:Boolean(network?.privateSun),goldenLicensed:Boolean(network?.golden)});}
  function defenseStructureUpgradeName(tower){const type=defenseStructureType(tower),level=clamp(tower?.upgrade||0,0,4),names={factory:["FOLD TABLE","TWO-PERSON SHOP","PRINT LINE","NIGHT SHIFT","RIZO INDUSTRIAL"],beacon:["WORK LIGHT","SIGNAL LAMP","HALO ARRAY","DAYBREAK CORE","PRIVATE SUN"]};return(names[type]||names.factory)[level];}
  function defenseStructureRoleCopy(type){return type==="factory"?"Prints shirts into Defense coins during live waves. Upgraded lines build momentum while the Gate stays clean; leaks break the streak.":"Nearby Rizos attack faster. From HALO ARRAY onward, covering both a Rizo and Factory lights a BRAND LOOP that accelerates Factory drops.";}
  function defenseRoster(){
    const configured=defenseConfiguredRoster(),runIds=mini?.active&&mini.mode==="defense"&&Array.isArray(mini.defense?.runRosterIds)?mini.defense.runRosterIds:null;
    if(!runIds)return configured;
    const registry=defenseFullRosterRegistry(),rows=[],captain=registry.get(captainPet()?.id);
    if(captain)rows.push(captain);
    for(const id of runIds){if(id===captainPet()?.id)continue;const row=registry.get(id);if(row&&!rows.some(item=>item.pet.id===id))rows.push(row);}
    return rows.length?rows:configured;
  }
  // --- INTEGRATION GLUE: bench composition -------------------------------------
  // Worker C owns `defenseRoster()` as the Rizo *character* crew (Captain + wings).
  // Workers B and D contribute universal Defense-only tools/structures that must
  // share the bench, placement, pricing and checkpoint paths without pretending to
  // be collected Rizos. `defenseDeployRows()` is the single composed bench source;
  // character semantics (mastery, MVP, Field Leader, Field Guide) keep reading
  // `defenseRoster()` so universal tools can never steal collection rewards.
  function defenseUniversalStructureRows(){
    return DEFENSE_UNIVERSAL_STRUCTURE_TYPES.map(type=>({pet:defenseStructurePet(type),source:"structure",rosterIndex:-1,structureType:type}));
  }
  // One ordered universal layer: Worker D's Basic Defense Rizo (the cheap legible
  // combat starter) then Worker B's economy/support structures.
  function defenseUniversalRows(){return [...defenseUniversalDeployRows(),...defenseUniversalStructureRows()];}
  // Bench order is "protagonist, universal kit, discovered crew". The Captain
  // always leads, and the complete universal kit always sits in the first bench
  // frame so a player who owns only their starter Rizo still has a whole tower
  // defense game without hunting through a scrolled bench. Discovered wings
  // follow: they are a deliberate pre-run choice, not an onboarding dependency.
  function defenseDeployRows(){
    const crew=defenseRoster(),captain=crew.filter(row=>row.source==="active"),wings=crew.filter(row=>row.source!=="active");
    return [...captain,...defenseUniversalRows(),...wings];
  }
  function defenseDeployRegistry(){return new Map(defenseDeployRows().map(row=>[row.pet.id,row]));}
  function defenseIsUniversalRow(row){return Boolean(row)&&(row.source==="structure"||row.source==="universal");}
  // Character = a collected/loaned Rizo. Never a universal Defense-only tool
  // (Worker D) and never a universal structure (Worker B). Field Leader, field
  // powers, Super Rizo ascension and permanent identity are character-only.
  function defenseIsCharacterTower(tower){return Boolean(tower)&&!defenseStructureType(tower)&&!defenseIsUniversalTower(tower);}
  function defenseUnlockedMaps(){const best=Number(store.records.best)||0;return DEFENSE_MAP_ORDER.map(id=>DEFENSE_MAPS[id]).filter(map=>best>=map.unlockWave);}
  function chooseDefenseMapId(){const unlocked=defenseUnlockedMaps();return (unlocked[unlocked.length-1]||DEFENSE_MAPS.grove).id;}
  function defensePathMetrics(path){const segments=[];let total=0;for(let i=1;i<path.length;i+=1){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y);segments.push({a,b,length,start:total});total+=length;}return{segments,total};}
  function defensePointFromMetrics(metrics,progress){const distance=clamp(progress,0,1)*metrics.total,segments=metrics.segments;let low=0,high=segments.length-1,index=high;while(low<=high){const middle=(low+high)>>1,segment=segments[middle];if(distance>segment.start+segment.length)low=middle+1;else{index=middle;high=middle-1;}}const segment=segments[index],t=clamp((distance-segment.start)/Math.max(.0001,segment.length),0,1);return{x:segment.a.x+(segment.b.x-segment.a.x)*t,y:segment.a.y+(segment.b.y-segment.a.y)*t};}
  function defensePointAt(progress){return defensePointFromMetrics(mini.defense.pathMetrics,progress);}
  function defenseMapPolyline(map){return map.path.map(point=>`${Math.round(point.x*1000)},${Math.round(point.y*1000)}`).join(" ");}
  function defenseMapSvgPath(map){return map.path.map((point,index)=>`${index?"L":"M"}${Math.round(point.x*1000)} ${Math.round(point.y*1000)}`).join(" ");}
  function defenseMiniRouteMarkup(map){const d=defenseMapSvgPath(map);return`<svg class="defense-mini-route" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;}
  function defenseLandmarkMarkup(map){return(map.landmarks||[]).map((item,index)=>`<i class="defense-landmark landmark-${escapeHTML(item.kind||"stone")}" style="--landmark-x:${item.x*100}%;--landmark-y:${item.y*100}%" data-landmark="${index}" aria-hidden="true"><span>${escapeHTML(item.label||"")}</span></i>`).join("");}
  function defenseBuildPocketMarkup(map){return(map.buildPockets||[]).map((item,index)=>`<i class="defense-build-pocket build-pocket-${escapeHTML(map.id)}" style="--pocket-x:${item.x*100}%;--pocket-y:${item.y*100}%" data-build-pocket="${index}" aria-hidden="true"></i>`).join("");}
  function defenseMapMechanicMarkup(map){
    const mechanic=map.mechanic||{},zones=map.mechanicZones||[];
    const link=mechanic.link&&zones.length>1?(()=>{const a=zones[0],b=zones[1],dx=(b.x-a.x)*100,dy=(b.y-a.y)*100,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;return `<i class="defense-map-bond-link link-${escapeHTML(mechanic.kind||"field")}" style="--link-x:${a.x*100}%;--link-y:${a.y*100}%;--link-length:${length}%;--link-angle:${angle}deg" aria-hidden="true"><u></u></i>`;})():"";
    return link+zones.map((zone,index)=>{
      const radius=Math.max(.02,Number(zone.r)||.12),edgeClass=[zone.x<.2?"mechanic-edge-left":"",zone.x>.8?"mechanic-edge-right":"",zone.y+radius>=.69?"mechanic-edge-bottom":""].filter(Boolean).join(" "),core=Number(zone.core)||0;
      return `<i class="defense-map-mechanic mechanic-${escapeHTML(zone.kind||mechanic.kind||"field")} ${core?"mechanic-has-core":""} ${edgeClass}" style="--mechanic-x:${zone.x*100}%;--mechanic-y:${zone.y*100}%;--mechanic-size:${Math.max(18,radius*200)}%;--mechanic-core:${Math.round(core*100)}%" data-map-mechanic="${index}" aria-hidden="true"><b>${escapeHTML(mechanic.icon||"✦")}</b><span><strong>${escapeHTML(mechanic.label||"FIELD BOND")}</strong><em>${escapeHTML(mechanic.copy||"")}</em></span></i>`;
    }).join("");
  }
  function defenseMapZoneMatch(map,x,y){
    if(!map||!Number.isFinite(x)||!Number.isFinite(y))return null;let chosen=null,score=Infinity,index=-1;
    (map.mechanicZones||[]).forEach((zone,zoneIndex)=>{const r=Math.max(.02,Number(zone.r)||.12),distance=Math.hypot(x-zone.x,y-zone.y),ratio=distance/r;if(ratio<=1&&ratio<score){chosen=zone;score=ratio;index=zoneIndex;}});
    return chosen?{zone:chosen,index,ratio:score}:null;
  }
  function defenseMapOccupiedZones(d=mini.defense,extraMatch=null){
    const occupied=new Set(),map=d?.map;if(!map)return occupied;
    for(const tower of d.towers||[]){const match=defenseMapZoneMatch(map,tower.x,tower.y);if(match)occupied.add(match.index);}
    if(extraMatch)occupied.add(extraMatch.index);
    return occupied;
  }
  function syncDefenseMapBondStateClasses(d=mini.defense){const world=$("#defenseWorld");if(!world||!d?.map)return false;const occupied=defenseMapOccupiedZones(d),linked=(d.map.mechanicZones||[]).length>1&&occupied.has(0)&&occupied.has(1);world.classList.toggle("map-circuit-linked",d.mapId==="storm"&&linked);world.classList.toggle("map-seal-resonance",d.mapId==="eclipse"&&linked);return linked;}
  function defenseMapBondForTower(tower,d=mini.defense,{preview=false}={}){
    const map=d?.map;if(!tower||!map)return null;const match=defenseMapZoneMatch(map,tower.x,tower.y);if(!match)return null;
    const {zone:chosen,index:zoneIndex,ratio}=match,occupied=defenseMapOccupiedZones(d,preview?match:null),now=defenseNow();
    const base={kind:chosen.kind||map.mechanic?.kind||"field",label:map.mechanic?.label||"FIELD BOND",copy:map.mechanic?.copy||"",preview:map.mechanic?.label||"FIELD BOND",damage:1,rate:1,range:1,camoSight:false,whiteoutProof:false,zoneIndex,ratio,tier:"bonded",state:""};
    if(map.id==="grove"){base.range=1.12;base.preview="KEEPER STONE • +12% REACH";}
    else if(map.id==="ember"){
      const hotCore=ratio<=Math.max(.2,Number(chosen.core)||.72);base.tier=hotCore?"core":"draft";base.label=hotCore?"FIRE DRAFT • HOT CORE":"FIRE DRAFT • OUTER";base.rate=hotCore?1.28:1.16;base.range=hotCore?.88:.96;base.copy=hotCore?"Hot core: +28% attack speed, -12% reach. Fastest position, tightest coverage.":"Outer draft: +16% attack speed, -4% reach. Safer coverage, less heat.";base.preview=hotCore?"HOT CORE • +28% SPEED / -12% REACH":"FIRE DRAFT • +16% SPEED / -4% REACH";
    }else if(map.id==="moon"){
      const moonlit=d.moonRevealUntil>now;base.range=1.08;base.rate=moonlit?1.18:1;base.camoSight=true;base.state=moonlit?"moonlit":"";base.label=moonlit?"SILVER BASIN • MOONLIT":"SILVER BASIN";base.copy=moonlit?"Moonlight is feeding the basin: veil sight, +8% reach, +18% attack speed.":"The basin keeps veil sight and +8% reach. Moonlight will wake its attack-speed window.";base.preview=moonlit?"MOONLIT BASIN • +18% SPEED / +8% REACH":"SILVER BASIN • VEIL SIGHT +8% REACH";
    }else if(map.id==="storm"){
      const circuit=(map.mechanicZones||[]).length>1&&occupied.has(0)&&occupied.has(1),surge=d.stormWeatherUntil>now;base.rate=surge?(circuit?1.34:1.28):(circuit?1.16:1.08);base.state=circuit?"circuit":"";base.label=circuit?"LIVE PYLONS • CIRCUIT":"LIVE PYLONS";base.copy=circuit?(surge?"Circuit closed during the surge: both pylon positions run at +34% attack speed.":"Circuit closed: split coverage across both pylons raises bonded towers to +16% attack speed."):(surge?"This pylon is surging at +28% attack speed. Occupy the other pylon to close the circuit.":"This pylon grants +8% attack speed. Occupy the other pylon to close the circuit.");base.preview=surge?(circuit?"CIRCUIT SURGE • +34% SPEED":"SURGE PYLON • +28% SPEED"):(circuit?"CIRCUIT CLOSED • +16% SPEED":"LIVE PYLON • +8% SPEED");
    }else if(map.id==="blizzard"){
      const whiteout=d.whiteoutUntil>now;base.range=whiteout?1.14:1.04;base.whiteoutProof=true;base.state=whiteout?"whiteout":"";base.label=whiteout?"ICE SHELTER • WHITEOUT OPEN":"ICE SHELTER";base.copy=whiteout?"The shelter turns Whiteout into an opening: no range loss and +14% reach.":"Sheltered towers ignore Whiteout range loss and hold +4% reach between storms.";base.preview=whiteout?"SHELTER OPEN • +14% REACH":"ICE SHELTER • WHITEOUT-PROOF";
    }else if(map.id==="eclipse"){
      const resonance=(map.mechanicZones||[]).length>1&&occupied.has(0)&&occupied.has(1);base.range=resonance?1.14:1.06;base.camoSight=true;base.state=resonance?"resonance":"";base.label=resonance?"SHADOW SEALS • RESONANCE":"SHADOW SEALS";base.copy=resonance?"Both seals are occupied: veil sight holds and bonded towers resonate at +14% reach.":"One seal holds veil sight and +6% reach. Occupy the other seal to resonate both positions.";base.preview=resonance?"SEALS RESONATE • +14% REACH":"SHADOW SEAL • VEIL SIGHT +6% REACH";
    }
    return base;
  }
  function defenseWorldFeatureMarkup(map){
    const features={
      grove:[["root","terrain-root terrain-root-a"],["root","terrain-root terrain-root-b"],["vine","terrain-vine"]],
      ember:[["vent","terrain-vent terrain-vent-a"],["vent","terrain-vent terrain-vent-b"],["crack","terrain-lava-crack"]],
      moon:[["orbit","terrain-orbit"],["crater","terrain-crater terrain-crater-a"],["crater","terrain-crater terrain-crater-b"]],
      storm:[["puddle","terrain-charge-puddle terrain-charge-puddle-a"],["puddle","terrain-charge-puddle terrain-charge-puddle-b"],["wind","terrain-wind-lane"]],
      blizzard:[["bank","terrain-snowbank terrain-snowbank-a"],["bank","terrain-snowbank terrain-snowbank-b"],["crack","terrain-ice-crack"]],
      eclipse:[["lane","terrain-shadow-lane"],["reveal","terrain-reveal-zone terrain-reveal-zone-a"],["reveal","terrain-reveal-zone terrain-reveal-zone-b"]]
    }[map.id]||[];
    return features.map(([kind,className],index)=>`<i class="defense-world-feature ${className}" data-world-feature="${escapeHTML(kind)}" data-feature-index="${index}" aria-hidden="true"></i>`).join("");
  }

  function defenseGatePoint(map){
    const end=map?.path?.[map.path.length-1]||{x:.88,y:.62};
    return{x:clamp(end.x,.055,.955),y:clamp(end.y,.1,.88)};
  }
  function defenseObstacleMarkup(map){return(map.blockedZones||[]).map((zone,index)=>`<i class="defense-obstacle obstacle-${escapeHTML(zone.kind||"rock")}" style="--obstacle-x:${zone.x*100}%;--obstacle-y:${zone.y*100}%;--obstacle-size:${Math.max(26,zone.r*520)}px" data-obstacle="${index}"></i>`).join("");}

  function queueDefenseIncome(amount,source="pop"){
    const d=mini.defense;if(!d)return 0;const safe=DefenseCore.clampNumber(amount,0,DEFENSE_LIMITS.MAX_RUN_CASH,0),wasEmpty=!(d.pendingIncome>0);d.pendingIncome=DefenseCore.clampNumber((d.pendingIncome||0)+safe,0,DEFENSE_LIMITS.MAX_RUN_CASH,0);d.pendingIncomeEvents=(d.pendingIncomeEvents||0)+1;d.pendingIncomeSources||(d.pendingIncomeSources={});d.pendingIncomeSources[source]=(d.pendingIncomeSources[source]||0)+safe;if(wasEmpty)d.nextIncomeFlushAtReal=defenseRealNow(d)+defensePerformanceBudget(d).incomeFlushMs/1000;d.lastIncomeSource=source;return safe;
  }
  function flushDefenseIncome(d=mini.defense,reason="timer"){
    if(!d)return 0;const pending=Math.max(0,Math.floor(Number(d.pendingIncome)||0));if(!pending)return 0;const events=Math.max(1,Math.floor(Number(d.pendingIncomeEvents)||1)),sources={...(d.pendingIncomeSources||{})};d.pendingIncome=0;d.pendingIncomeEvents=0;d.pendingIncomeSources={};d.cash=DefenseCore.clampNumber((d.cash||0)+pending,0,DEFENSE_LIMITS.MAX_RUN_CASH,0);d.nextIncomeFlushAtReal=defenseRealNow(d)+defensePerformanceBudget(d).incomeFlushMs/1000;d.cashWriteCount=(d.cashWriteCount||0)+1;d.lastIncomeFlushReason=reason;d.lastIncomeBatch={amount:pending,events,sources,atReal:defenseRealNow(d)};markDefenseUi({roster:true});return pending;
  }
  function defenseGoldenBonus(){const d=mini.defense;if(!d)return 1;return DefenseCore.goldenBonus(d.towers.filter(tower=>(tower.pet.variant||tower.pet.hiddenVariant)==="golden"&&tower.upgrade>=2).length);}
  const DEFENSE_WORLD_OPENING_PERKS=Object.freeze({
    grove:{label:"BALANCED OPENING",variants:[]},
    ember:{label:"FIRST DAMAGE UPGRADE • 20% OFF",variants:["ember","obsidian","shadow","diamond"]},
    moon:{label:"FIRST DETECTOR UPGRADE • 20% OFF",variants:["shadow","aurora","glitch"]},
    storm:{label:"FIRST CONTROL UPGRADE • 20% OFF",variants:["moss","frost","bubblegum","violet"]},
    blizzard:{label:"FIRST WIDE-RANGE UPGRADE • 20% OFF",variants:["aurora","diamond","violet","frost"]},
    eclipse:{label:"FIRST SUPPORT / REVEAL UPGRADE • 20% OFF",variants:["aurora","golden","glitch","shadow"]}
  });
  function defenseWorldPerkMatchesTower(mapId,tower){const perk=DEFENSE_WORLD_OPENING_PERKS[mapId],variant=tower?.pet?.variant||tower?.pet?.hiddenVariant||"classic";return Boolean(perk?.variants?.includes(variant));}
  function defenseWorldPerkLabel(d=mini.defense){return DEFENSE_WORLD_OPENING_PERKS[d?.mapId]?.label||"BALANCED OPENING";}
  function defenseUpgradeModifier(tower,d=mini.defense){if(defenseStructureType(tower)||defenseIsUniversalTower(tower)||!d||d.worldPerkUsed||tower?.upgrade!==0||!defenseWorldPerkMatchesTower(d.mapId,tower))return 1;return DefenseCore.ECONOMY.worldOpeningDiscount;}
  function defenseUpgradeCost(tower,d=mini.defense){const structureType=defenseStructureType(tower);if(defenseIsUniversalTower(tower))return DEFENSE_BASIC_TOWER.upgradeCosts[clamp(tower?.upgrade||0,0,DEFENSE_BASIC_TOWER.upgradeCosts.length-1)];return structureType?DefenseCore.structureUpgradeCost(structureType,tower?.upgrade||0):DefenseCore.upgradeCost(tower?.upgrade||0,defenseUpgradeModifier(tower,d));}
  function defenseCanUndoPlacement(tower,d=mini.defense){return Boolean(d&&tower&&defenseSellAllowed(d)&&Number.isFinite(tower.placedAtReal)&&defenseRealNow(d)-tower.placedAtReal<=DefenseCore.ECONOMY.placementUndoSeconds);}
  function defenseSellRefund(tower,d=mini.defense){if(!tower)return 0;return Math.floor((tower.spent||0)*(defenseCanUndoPlacement(tower,d)?1:DefenseCore.ECONOMY.planningRefundRate));}

  function defenseDeployCost(row){const d=mini.defense,copies=d.towers.filter(tower=>tower.petId===row.pet.id).length,structureType=defenseStructureType(row),paid=d.towers.filter(tower=>tower.cost>0).length;if(defenseIsUniversalPet(row.pet))return defenseUniversalDeployCost(copies);return structureType?DefenseCore.structureDeploymentCost(structureType,copies):DefenseCore.deploymentCost({paidTowerCount:paid,copyCount:copies,activeFirst:row.source==="active"});}
  function defenseTowerStats(pet,upgrade=0){
    if(pet?.defenseStructure==="factory")return{variant:"classic",profile:{label:"ECONOMY"},damage:0,rate:0,range:.11,crit:0,projectile:"none",label:"ECONOMY"};
    if(pet?.defenseStructure==="beacon"){const support=DefenseCore.beaconSupport(upgrade);return{variant:"classic",profile:{label:"SUPPORT"},damage:0,rate:support.rateMultiplier,range:support.radius,crit:0,projectile:"none",label:"SUPPORT"};}    if(defenseIsUniversalPet(pet)){const level=clamp(Math.floor(Number(upgrade)||0),0,4),levels=[{damage:5.4,rate:1.24,range:.198},{damage:6.3,rate:1.29,range:.205},{damage:7.25,rate:1.34,range:.215},{damage:8.15,rate:1.39,range:.222},{damage:9.25,rate:1.44,range:.23}],base=levels[level];return{variant:DEFENSE_BASIC_TOWER.variant,profile:{damage:1,rate:1,range:1,projectile:"needle",label:"STRAIGHT SHOT"},damage:base.damage,rate:base.rate,range:base.range,crit:0,projectile:"needle",label:"STRAIGHT SHOT"};}
    const stage=DEFENSE_STAGE_MULTIPLIER[pet.stage]||1,power=Number(pet.skills?.power)||0,speed=Number(pet.skills?.speed)||0,instinct=Number(pet.skills?.instinct)||0,stamina=Number(pet.skills?.stamina)||0,variant=pet.variant||pet.hiddenVariant||"classic";
    const profile={classic:{damage:1,rate:1,range:1,projectile:"spark",label:"BALANCED"},ember:{damage:1.03,rate:.96,range:1,projectile:"ember",label:"BURN"},toxic:{damage:.88,rate:1,range:1.04,projectile:"toxic",label:"POISON"},violet:{damage:.82,rate:.88,range:1.04,projectile:"void",label:"CHAIN 3"},moss:{damage:.78,rate:.91,range:1.08,projectile:"moss",label:"ROOT"},bubblegum:{damage:.85,rate:.9,range:.98,projectile:"bubble",label:"KNOCKBACK"},frost:{damage:.62,rate:.90,range:1.15,projectile:"frost",label:"SLOW / SETUP"},glitch:{damage:1.02,rate:1.13,range:1,projectile:"glitch",label:"RANDOM"},obsidian:{damage:2.65,rate:.54,range:.92,projectile:"stone",label:"ARMOR CRACKER"},aurora:{damage:.78,rate:.9,range:1.18,projectile:"aurora",label:"AURA"},golden:{damage:.9,rate:.92,range:1,projectile:"gold",label:"PROFIT"},diamond:{damage:1.2,rate:.76,range:1.15,projectile:"diamond",label:"PIERCE"},shadow:{damage:1.08,rate:.92,range:1.04,projectile:"shadow",label:"CRITICAL"},retro:{damage:.72,rate:1.48,range:.95,projectile:"retro",label:"RAPID"}}[variant]||{damage:1,rate:1,range:1,projectile:"spark",label:"BALANCED"};
    const up=1+upgrade*.34;return{variant,profile,damage:(6.8+power*.052+stamina*.012)*stage*profile.damage*up,rate:(1.08+speed*.009)*profile.rate*(1+upgrade*.12),range:(.215+instinct*.00078)*profile.range*(1+upgrade*.085),crit:.06+instinct*.0014,projectile:profile.projectile,label:profile.label};
  }
  function defenseCombatStats(tower){
    const stats=defenseTowerStats(tower.pet,tower.upgrade),time=defenseNow(),d=mini.defense;if(defenseStructureType(tower))return stats;
    if(defenseIsUniversalTower(tower)){if(tower.doctrine==="power"){stats.damage*=1.32;stats.rate*=.96;stats.range*=.98;stats.projectile="rivet";stats.label=tower.upgrade>=4?"RIVET CANNON":"BOLT BREAKER";if(tower.upgrade>=3)stats.damage*=1.18;if(tower.upgrade>=4){stats.damage*=1.22;stats.range*=1.05;}}else if(tower.doctrine==="control"){stats.damage*=.90;stats.rate*=1.24;stats.range*=1.19;stats.projectile="pin";stats.label=tower.upgrade>=4?"THREADSTORM":"PIN CONTROL";if(tower.upgrade>=3){stats.rate*=1.10;stats.range*=1.06;}if(tower.upgrade>=4){stats.rate*=1.12;stats.range*=1.08;}}}else{if(tower.doctrine==="power"){stats.damage*=1.24;stats.rate*=1.06;stats.range*=.97;}else if(tower.doctrine==="control"){stats.damage*=.86;stats.rate*=1.18;stats.range*=1.24;}if(tower.superForm==="power"){stats.damage*=2.75;stats.rate*=1.18;stats.range*=1.06;}else if(tower.superForm==="control"){stats.damage*=1.18;stats.rate*=1.72;stats.range*=1.48;}}if(d.rallyUntil>time)stats.rate*=1.34;if(d.prismUntil>time){stats.damage*=1.28;stats.rate*=1.15;stats.range*=1.08;}if(tower.overclockUntil>time)stats.rate*=2;if(tower.rangeDebuffUntil>time)stats.range*=.75;const mapBond=defenseMapBondForTower(tower,d);if(mapBond){stats.damage*=mapBond.damage;stats.rate*=mapBond.rate;stats.range*=mapBond.range;}if(d.whiteoutUntil>time&&!['frost','aurora'].includes(stats.variant)&&!mapBond?.whiteoutProof)stats.range*=.82;const beacon=defenseBeaconInfluence(tower,d);if(beacon){stats.damage*=beacon.damageMultiplier;stats.rate*=beacon.rateMultiplier;}return stats;
  }
  function defenseAbilityData(tower){if(defenseIsUniversalTower(tower))return{passive:"Cheap straight shots. POWER becomes an armor-breaking rivet driver; CONTROL becomes a fast pinning rig.",active:"NO FIELD POWER",copy:"Universal Defense tools do not consume the Field Leader slot.",cooldown:999};return DEFENSE_ABILITIES[tower.pet.variant||tower.pet.hiddenVariant||"classic"]||DEFENSE_ABILITIES.classic;}
  function defenseAbilityCooldown(tower){const data=defenseAbilityData(tower),stamina=Number(tower.pet.skills?.stamina)||0;return Math.max(data.cooldown*.48,data.cooldown*(1-tower.upgrade*.085-stamina*.0015));}
  function defenseAbilityRemaining(tower){return Math.max(0,(tower.abilityReadyAt||0)-defenseNow());}
  function defenseTowerTier(tower){return tower.upgrade>=4?"apex":tower.upgrade>=2?"awakened":tower.upgrade>=1?"charged":"base";}
  function defenseUpgradeMove(tower){if(defenseIsUniversalTower(tower)){if(tower.upgrade===0)return"Every fourth shot double-stitches into a second nearby threat";if(tower.upgrade===1)return"Unlock POWER rivets or CONTROL pins";if(!tower.doctrine)return"Choose POWER armor breaks or CONTROL lane pins";if(tower.doctrine==="power")return tower.upgrade>=3?"Rivet Crown charges faster, hunts armor, and tears into restrained threats":"Every rivet starts shaving armor; charged shots burst through clusters";return tower.upgrade>=3?"Threadstorm weaves three threats; opened armor locks and rewinds deeper":"Charged pins thread into one fresh nearby threat";}const v=tower.pet.variant||tower.pet.hiddenVariant||"classic";if(tower.upgrade===0)return{classic:"Every third shot hits 65% harder",violet:"Chain reaches a fourth target",frost:"Chill splashes into nearby threats",obsidian:"Every impact strips armor"}[v]||"Stronger hits and wider reach";if(tower.upgrade===1)return"Choose POWER impacts or CONTROL pulses + field power";return tower.doctrine==="control"?"Stronger control and wider coverage":"Harder charged strikes";}
  function defenseUpgradeName(tower){
    if(defenseStructureType(tower))return defenseStructureUpgradeName(tower);
    const names={classic:["STEADY SPARK","BRIGHT GUARD","RALLY HEART","GATEKEEPER","FIRST FLAME"],ember:["CINDER","HOT BLOOD","FIRE RING","INFERNO","PHOENIX CORE"],toxic:["SPORE","VENOM","PLAGUE BLOOM","CORROSION","TOXIC CROWN"],violet:["PULSE","ARC LINK","CHAIN SURGE","VOID CURRENT","PURPLE STORM"],moss:["ROOT","THICKET","ROOT GARDEN","OLD GROWTH","FOREST HEART"],bubblegum:["BOUNCE","PRESSURE","BIG BOUNCE","WAVE BREAK","PINK IMPACT"],frost:["CHILL","ICE VEIN","DEEP FREEZE","WHITE CROWN","ABSOLUTE ZERO"],glitch:["STATIC","SIGNAL SPLIT","REWRITE","SYSTEM BREAK","GLITCH GOD"],obsidian:["STONE","FAULT LINE","QUAKE","BLACK MOUNTAIN","WORLD WEIGHT"],aurora:["HALO","PRISM","PRISM FIELD","SKY CHOIR","AURORA THRONE"],golden:["LUCK","DIVIDEND","PAYDAY","GOLD RUSH","KING'S RANSOM"],diamond:["SHARD","CUT LINE","SHARD LINE","REFRACTION","DIAMOND RAIN"],shadow:["DUSK","BLACK EDGE","NIGHT CUT","ECLIPSE BLADE","LAST SHADOW"],retro:["TICK","TURBO","OVERCLOCK","HYPER SIGNAL","ARCADE GOD"]};
    if(defenseIsUniversalTower(tower)){const level=clamp(tower.upgrade,0,4);if(level===0)return"BLANK FRAME";if(level===1)return"STITCHER";if(level===2)return"FIELD KIT";if(tower.doctrine==="power")return level===3?"BOLT DRIVER":"RIVET CROWN";if(tower.doctrine==="control")return level===3?"PIN WHEEL":"THREADSTORM";return"FIELD KIT";}const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic";return(names[variant]||names.classic)[clamp(tower.upgrade,0,4)];
  }

  function initializeDefenseRun(mapChoice = "auto", contract = null, {allowLockedMap=false} = {}){
    const normalizedContract=normalizeDefenseRunContract(contract),requestedMap=typeof mapChoice==="string"&&DEFENSE_MAPS[mapChoice]?mapChoice:null,mapId=normalizedContract?.mapId||(allowLockedMap&&requestedMap?requestedMap:defenseResolvedMapId(mapChoice)),map=DEFENSE_MAPS[mapId]||DEFENSE_MAPS.grove,budget=defensePerformanceBudget({performanceLow:false,renderTier:0}),runRosterIds=defenseConfiguredRoster().map(row=>row.pet.id);
    mini.defense=installDefenseStateContracts({mapId,map,contract:normalizedContract,runRosterIds,pathMetrics:map.pathMetrics||defensePathMetrics(map.path),currentWave:0,clearedWave:0,lives:map.lives,cash:BASE_DEFENSE_STARTING_CASH,phase:DEFENSE_PHASES.PLANNING,resumePhase:DEFENSE_PHASES.COMBAT,speed:1,clock:0,realClock:0,towers:[],enemies:[],projectiles:[],effects:[],spawnQueue:[],wavePackets:[],packetIndex:0,packetEnemyIndex:0,nextSpawnAt:0,packetBreakUntil:0,childSpawnQueue:[],nextChildReleaseAtReal:0,childSpawnSequence:0,nextId:1,kills:0,totalDamage:0,usedPetIds:new Set(),selectedTowerId:null,lastWaveBonus:0,nextWaveReadyAtReal:0,autoStartAtReal:0,maxTowers:normalizedContract?.rules.includes("lean")?4:DEFENSE_LIMITS.MAX_DEFENSE_TOWERS,rallyUntil:0,prismUntil:0,whiteoutUntil:0,stormWeatherUntil:0,eclipseUntil:0,ashUntil:0,moonRevealUntil:0,nextWeatherAt:7,goldenCoinCarry:0,camoHintSeen:false,pendingPlacement:null,waveAnnouncement:null,currentWavePlan:[],bossesBeaten:[],bossesDefeated:0,perfectWaveCount:0,waveHeartLossStart:0,topTowerId:null,abilityTrayOpen:false,abilityGroupOpen:null,intelOpen:false,intelPausedByOpen:false,benchOpen:true,fieldMenuOpen:false,contextSurface:null,contextReturnFocus:null,enemyNodePool:[],projectileNodePool:[],impactNodePool:[],rendererMode:"dom",canvasRenderer:null,canvasFrames:0,canvasFallbacks:0,enemyVisualClock:0,enemyStateVisualClock:0,projectileVisualClock:0,renderWidth:0,renderHeight:0,mapIntroPlayed:false,lowFx:false,potatoFx:false,renderTier:0,renderTierChanges:0,performanceLow:false,performanceRecovery:0,frameMs:16.7,frameP95:16.7,frameP99:16.7,frameStress:0,slowFrameStreak:0,frameSamples:[],frameSampleClock:0,governorTier:0,governorPressureSeconds:0,governorStableSeconds:0,fixedSimulation:true,simAccumulator:0,presentationAccumulator:0,simStepSamples:[],simStepP95:0,simStepWorst:0,simBacklogEvents:0,maxCatchUpObserved:0,lastSimSteps:0,presentationFrames:0,coalescedVisualShots:0,coalescedLogicalShots:0,maxLogicalProjectilesObserved:0,droppedCosmetics:0,enemyNodesCreated:0,enemyNodesAcquired:0,projectileNodesCreated:0,projectileNodesAcquired:0,impactNodesCreated:0,impactNodesAcquired:0,enemyPositionWrites:0,enemyClassWrites:0,enemyHealthWrites:0,enemyStateWrites:0,projectilePositionWrites:0,autoPaused:false,wavePreview:[],uiClock:0,uiDirty:true,rosterDirty:false,lastPopSfxAt:-99,lastFeelHapticAtReal:-99,lastSelectionSfxAtReal:-99,lastSpawnedEnemyId:null,spawnWaitReason:"idle",peakAlive:0,schoolCoachSignature:"",wavePreviewSignature:"",abilityTraySignature:"",intelTraySignature:"",waveTotal:0,waveResolved:0,hudRenderCount:0,rosterRenderCount:0,trayRenderCount:0,intelRenderCount:0,checkpointDirty:false,checkpointClock:0,lastCheckpointAt:0,checkpointWrites:0,hintFlags:{},pendingIncome:0,pendingIncomeEvents:0,pendingIncomeSources:{},nextIncomeFlushAtReal:0,cashWriteCount:0,targetScans:0,targetSnapshotBuilds:0,targetSnapshot:[],targetSnapshotAtReal:0,childSpawnsReleased:0,lastIncomeBatch:null,maxActiveEnemiesObserved:0,maxProjectileNodesObserved:0,maxEffectNodesObserved:0,worldPerkUsed:false,cinematicMomentId:0,cinematicMomentCount:0,cinematicMomentKind:null,cinematicMomentPriority:0,cinematicMomentUntilReal:0,lastGateMomentAtReal:-99,gateFlameArmed:false,gateFlameReadyAt:0,gateFlameUntil:0,gateFlameProgress:.86,gateFlameNextTick:0,gateFlameTicks:0,lastHudLives:null,lastHudCash:null,flowDecisionBeat:0,flowPulseUntilReal:0,flowEaseUntilReal:0,flowChoiceKey:"",flowLastAction:"",flowActionQuietUntilReal:0,flowAutoHeldWave:-1,ending:false,endingReason:null,enemyStats:{spawned:{},popped:{},leaked:{},heartLoss:0,counters:{armorBreaks:0,armorShreds:0,reveals:0,phaseLocks:0,bossInterrupts:0}}});
    mini.score=0;mini.hits=0;mini.entities=[];
  }
  function defenseRosterMarkup(){
    const d=mini.defense;
    return defenseDeployRows().map(row=>{
      const copies=d.towers.filter(tower=>tower.petId===row.pet.id).length,cost=defenseDeployCost(row),structureType=defenseStructureType(row);
      const universal=defenseIsUniversalPet(row.pet),uniqueBlocked=defenseContractRule("unique",d)&&copies>0,placementLocked=!defensePlacementAllowed(d),disabled=placementLocked||d.towers.length>=d.maxTowers||d.cash<cost||uniqueBlocked,selected=d.pendingPlacement?.row?.pet?.id===row.pet.id;
      if(structureType){
        const meta=DEFENSE_STRUCTURE_META[structureType],instruction=placementLocked?"RESUME TO BUILD":selected?"TAP MAP OR DRAG":uniqueBlocked?"ONE PER CONTRACT":d.towers.length>=d.maxTowers?`FIELD FULL • ${d.maxTowers}`:`${cost} COINS`,benchInstruction=placementLocked?"PAUSED":selected?"TAP / DRAG":uniqueBlocked?"ONE PER RUN":d.towers.length>=d.maxTowers?"FIELD FULL":d.cash<cost?"NEED CASH":meta.role,badge=placementLocked?"Ⅱ":selected?"✓":uniqueBlocked?"✕":String(cost);
        return `<button type="button" class="defense-roster-pet defense-roster-pet-simple defense-roster-structure structure-${structureType} ${copies?"placed":""} ${selected?"placement-selected":""}" data-defense-roster-id="${meta.id}" ${disabled?"disabled":""} aria-pressed="${selected}" title="${escapeHTML(meta.name)} • ${escapeHTML(instruction)}" aria-label="${escapeHTML(meta.name)}, ${escapeHTML(instruction)}" style="--roster-color:${meta.accent}"><span class="defense-roster-frame" aria-hidden="true"></span><span class="defense-structure-thumb structure-art-${structureType}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="defense-roster-info"><b>${escapeHTML(meta.name)}</b><small>${escapeHTML(benchInstruction)}</small></span>${copies?`<u class="defense-roster-copies">×${copies}</u>`:""}<i class="defense-roster-badge">${escapeHTML(badge)}</i></button>`;
      }
      const variant=universal?{color:DEFENSE_BASIC_TOWER.color}:(VARIANTS.find(item=>item.id===(row.pet.variant||row.pet.hiddenVariant))||VARIANTS[0]),mastery=universal?null:store.records.mastery?.[row.pet.id],masteryTitle=mastery?defenseMasteryTitle(mastery):"UNTESTED",instruction=placementLocked?"RESUME TO BUILD":selected?"TAP MAP OR DRAG":uniqueBlocked?"ONE PER CONTRACT":row.source==="active"&&!copies?"CAPTAIN • FREE DEPLOY":d.towers.length>=d.maxTowers?`FIELD FULL • ${d.maxTowers}`:`${cost} COINS`,role=universal?"COMBAT":defenseTowerStats(row.pet).profile.label,rosterTag=universal?"BASIC":row.source==="active"?"CAPTAIN":row.source==="guest"?"LOANER":"OWNED",benchInstruction=placementLocked?"PAUSED":selected?"TAP / DRAG":uniqueBlocked?"ONE PER RUN":d.towers.length>=d.maxTowers?"FIELD FULL":d.cash<cost?"NEED CASH":role,badge=placementLocked?"Ⅱ":selected?"✓":uniqueBlocked?"✕":row.source==="active"&&!copies?"FREE":String(cost);
      return `<button type="button" class="defense-roster-pet defense-roster-pet-simple roster-${row.source} ${universal?"defense-roster-universal":""} ${copies?"placed":""} ${selected?"placement-selected":""}" data-defense-roster-id="${escapeHTML(row.pet.id)}" ${disabled?"disabled":""} aria-pressed="${selected}" title="${escapeHTML(row.pet.name)} • ${escapeHTML(instruction)}" aria-label="${escapeHTML(row.pet.name)}, ${escapeHTML(instruction)}" style="--roster-color:${variant.color}"><span class="defense-roster-frame" aria-hidden="true"></span>${defenseDeployPortraitMarkup(row)}<span class="defense-roster-info"><em class="defense-roster-tag">${rosterTag}</em><b>${escapeHTML(row.pet.name)}</b><small>${escapeHTML(benchInstruction)}</small></span>${universal?`<em class="defense-roster-kind">UNIVERSAL TOOL</em>`:masteryTitle!=="UNTESTED"?`<em class="defense-roster-mastery">${escapeHTML(masteryTitle)}</em>`:""}${copies?`<u class="defense-roster-copies">×${copies}</u>`:""}<i class="defense-roster-badge">${escapeHTML(badge)}</i></button>`;
    }).join("");
  }


  function closeDefenseMapIntro(){
    const d=mini.defense,intro=$("#defenseMapIntro");
    if(d){
      if(!store.mapIntrosSeen.includes(d.mapId)){store.mapIntrosSeen.push(d.mapId);persistStore();}
      if(!d.towers.length&&!d.pendingPlacement&&defensePlacementAllowed(d)){
        const active=defenseRoster().find(row=>row.source==="active")||defenseRoster()[0];
        if(active){const cost=defenseDeployCost(active);if(d.cash>=cost){setDefensePlacementMode(active,cost);setDefenseMessage(`YOUR RIZO • ${active.pet.name}`,cost?`Tap open grass to deploy for ${cost} coins.`:"Tap open grass. Your main Rizo deploys free.");}}
      }
    }
    if(!intro)return;
    intro.classList.add("leaving");
    queueMiniTimeout(()=>intro.remove(),360);
  }
  function playDefenseMapIntro(){
    const d=mini.defense,intro=$("#defenseMapIntro");
    if(!d||!intro||d.mapIntroPlayed||d.wave>0||d.towers.length){
      if(d)d.mapIntroPlayed=true;intro?.remove();return false;
    }
    d.mapIntroPlayed=true;
    let seen=store.mapIntrosSeen.includes(d.mapId);
    if(seen){intro.classList.add("returning");requestAnimationFrame(()=>intro.classList.add("playing"));queueMiniTimeout(closeDefenseMapIntro,hostSettings().reducedMotion?120:520);return true;}
    requestAnimationFrame(()=>intro.classList.add("playing"));
    queueMiniTimeout(closeDefenseMapIntro,hostSettings().reducedMotion?200:900);
    return true;
  }

  function defenseShouldUseCanvas(){
    const requested=defenseRendererOverride||new URLSearchParams(location.search).get("renderer");
    if(requested==="dom")return false;
    if(requested==="canvas")return Boolean(globalThis.RizoDefenseCanvas?.create);
    const qa=Boolean(host?.debug)||location.hostname==="localhost"||location.hostname==="127.0.0.1"||new URLSearchParams(location.search).get("qa")==="1";
    return !qa&&Boolean(globalThis.RizoDefenseCanvas?.create);
  }
  function defenseUsesCanvas(d=mini.defense){return Boolean(d?.rendererMode==="canvas"&&d.canvasRenderer?.enabled);}
  function setupDefenseCombatRenderer(){
    const d=mini.defense,canvas=$("#defenseCombatCanvas"),shell=$(".defense-shell");if(!d||!canvas)return false;
    d.canvasRenderer?.destroy?.();d.canvasRenderer=null;d.rendererMode="dom";shell?.classList.remove("canvas-combat");
    if(!defenseShouldUseCanvas())return false;
    try{const renderer=globalThis.RizoDefenseCanvas.create(canvas,{build:host?.build||""});if(!renderer?.enabled)throw new Error("2D canvas unavailable");d.canvasRenderer=renderer;d.rendererMode="canvas";shell?.classList.add("canvas-combat");renderer.resize(d.renderWidth||canvas.clientWidth||390,d.renderHeight||canvas.clientHeight||390,d.governorTier||0);return true;}catch(error){d.canvasFallbacks=(d.canvasFallbacks||0)+1;return false;}
  }

  function fallbackDefenseCanvasToDom(reason="renderer-fallback"){
    const d=mini.defense;if(!d)return false;
    d.canvasFallbacks=(d.canvasFallbacks||0)+1;d.rendererMode="dom";d.canvasRenderer?.destroy?.();d.canvasRenderer=null;$(".defense-shell")?.classList.remove("canvas-combat");
    for(const enemy of d.enemies||[]){
      if(enemy.dead||enemy.node)continue;
      const node=acquireDefenseEnemyNode();if(!node)continue;
      node.dataset.enemyId=enemy.id;node.style.setProperty("--balloon-color",enemy.renderColor||"#ff7d32");if(node._rizoTrait)node._rizoTrait.textContent=enemy.renderIcon||"○";enemy.node=node;enemy.visualSignature="";enemy.stateSignature="";enemy.lastRenderedHealth=-1;updateDefenseEnemyNode(enemy,true);
    }
    for(const shot of d.projectiles||[]){
      if(shot.node||!shot.renderVisible)continue;
      const node=acquireDefenseProjectileNode();if(!node)continue;
      const variant=shot.tower?.pet?.variant||shot.tower?.pet?.hiddenVariant||"classic",masteryTier=defenseMasteryTierForPet(shot.tower?.petId);
      node.className=`defense-shot shot-${shot.kind||"pulse"} signature-${variant} mastery-shot-${masteryTier} ${shot.doctrineStrike?`shot-doctrine-${shot.doctrineStrike}`:""}`;node.style.setProperty("--signature-color",shot.renderColor||defenseTowerDisplayColor(shot.tower));positionDefenseMovingNode(node,shot.x,shot.y);shot.node=node;shot.renderVisible=false;
    }
    d.poolsWarmed=false;warmDefensePools(d);console.warn?.("Rizo Defense canvas fell back to DOM",reason);return true;
  }

  function warmDefensePools(owner=mini.defense){
    if(!owner||owner!==mini.defense)return false;
    if(defenseUsesCanvas(owner)){owner.poolsWarmed=true;return true;}
    const budget=defensePerformanceBudget(owner),enemyTarget=budget.maxActiveEnemies,projectileTarget=budget.maxVisibleProjectiles,impactTarget=budget.maxImpactEffects;
    while(owner.enemyNodePool.length<enemyTarget){const node=createDefenseEnemyNode();node.hidden=true;owner.enemyNodePool.push(node);owner.enemyNodesCreated=(owner.enemyNodesCreated||0)+1;}
    while(owner.projectileNodePool.length<projectileTarget){const node=document.createElement("i");node.hidden=true;node.className="defense-shot";owner.projectileNodePool.push(node);owner.projectileNodesCreated=(owner.projectileNodesCreated||0)+1;}
    while(owner.impactNodePool.length<impactTarget){const node=document.createElement("i");node.hidden=true;node.className="defense-impact";owner.impactNodePool.push(node);owner.impactNodesCreated=(owner.impactNodesCreated||0)+1;}
    owner.poolsWarmed=true;return true;
  }
  function defenseUiIcon(name,extraClass=""){
    const paths={
      speed:'<path d="M4 7.5 8.5 12 4 16.5M11 7.5l4.5 4.5-4.5 4.5M18 7.5v9"/>',
      intel:'<path d="M2.8 12s3.4-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.4 5.2-9.2 5.2S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.8"/>',
      power:'<path d="m13.2 2.8-7 10h5.1l-.5 8.4 7-10h-5.1l.5-8.4Z"/>',
      bench:'<circle cx="7" cy="9" r="2.4"/><circle cx="17" cy="9" r="2.4"/><path d="M3.7 19c.3-3.1 1.5-5 3.3-5s3 1.9 3.3 5M13.7 19c.3-3.1 1.5-5 3.3-5s3 1.9 3.3 5"/>',
      menu:'<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="8" cy="6" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="10" cy="18" r="1"/>',
      play:'<path class="fill" d="m8 5 10 7-10 7V5Z"/>',
      pause:'<path class="fill" d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
      route:'<path d="M4 18c0-7 5-3 5-9 0-3 2-5 5-5 3.4 0 6 2.4 6 6 0 5-5 3-5 8"/><path d="m12 15 3 3 3-3"/>',
      fullscreen:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
      guide:'<path d="M4 5.5c2.6-.8 5.3-.3 8 1.5v12c-2.7-1.8-5.4-2.3-8-1.5v-12ZM20 5.5c-2.6-.8-5.3-.3-8 1.5v12c2.7-1.8 5.4-2.3 8-1.5v-12Z"/>',
      bank:'<path d="M4 4h11l4 4v12H4V4Z"/><path d="M8 4v6h7V4M8 20v-6h8v6"/><path d="m3 12 3-3M3 12l3 3"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>',
      heart:'<path class="fill" d="M12 20.2 4.6 13C.8 9.3 3.4 3.5 8.2 4.1c1.7.2 3 1.2 3.8 2.5.8-1.3 2.1-2.3 3.8-2.5 4.8-.6 7.4 5.2 3.6 8.9L12 20.2Z"/>',
      coin:'<circle cx="12" cy="12" r="8.2"/><path d="M14.9 8.7c-.8-.8-1.8-1.2-3-1.2-1.6 0-2.8.8-2.8 2 0 3 6.1 1.3 6.1 4.7 0 1.4-1.3 2.4-3.2 2.4-1.4 0-2.7-.5-3.5-1.4M12 5.5v13"/>',
      wave:'<path d="M3 15c2.2-4 4.4-4 6.6 0s4.4 4 6.6 0S20.6 11 22 13.5"/><path d="M3 9c2.2-4 4.4-4 6.6 0s4.4 4 6.6 0S20.6 5 22 7.5"/>',
      target:'<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.8v4M12 18.2v4M1.8 12h4M18.2 12h4"/>',
      upgrade:'<path d="m12 3 6 6h-4v7H10V9H6l6-6Z"/><path d="M5 20h14"/>',
      sell:'<path d="M4 7h16M8 7V4h8v3M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
      check:'<path d="m5 12.5 4.2 4.2L19 7"/>',
      snap:'<path d="M6 8a6 6 0 1 1 0 8M6 8V4M6 8H2"/><circle cx="12" cy="12" r="2.2"/>',
      warning:'<path d="m12 3 9 17H3L12 3Z"/><path d="M12 8v5M12 17h.01"/>'
    };
    const body=paths[name]||paths.menu;
    return `<svg class="rizo-ui-icon ${escapeHTML(extraClass)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  function setDefenseWaveIcon(node,kind){if(node)node.innerHTML=defenseUiIcon(kind);}

  function renderDefenseWorld(){
    const d=mini.defense,map=d.map,roadPath=defenseMapSvgPath(map),entry=map.path[0]||{x:.03,y:.2},entryX=clamp(entry.x,.035,.965),entryY=clamp(entry.y,.08,.9),gatePoint=defenseGatePoint(map);
    const contract=d.contract,contractBadge=contract?`<div class="defense-contract-badge"><small>TRAIL CONTRACT</small><b>${escapeHTML(contract.title)}</b><span>${contract.rules.map(id=>escapeHTML(DEFENSE_CONTRACT_RULES[id].name)).join(" • ")}</span></div>`:"";
    stage.arena.innerHTML=`<div class="defense-shell rizo-defense-ui" data-defense-map="${map.id}" style="--field-accent:${defenseMapAccent(map.id)}">
      <section class="defense-command-deck" aria-label="Defense command deck">
        <div class="defense-command-world"><span class="defense-command-mark"><img src="./assets/rizo-full-mark.png" alt=""/></span><div><small>${map.icon} WORLD ${map.level} • ${contract?"CONTRACT":"OPEN TRAIL"}</small><b>${escapeHTML(map.name)}</b><em>${escapeHTML(map.entrance)}</em></div></div>
        <div class="defense-hud" aria-label="Field status"><span class="defense-stat defense-stat-lives" id="defenseLivesArt"><i>${defenseUiIcon("heart")}</i><b id="defenseLives">${d.lives}</b><small>GATE</small></span><span class="defense-stat defense-stat-cash" id="defenseCashArt"><i>${defenseUiIcon("coin")}</i><span class="defense-stat-value"><b id="defenseCash">${d.cash}</b><em class="defense-cash-delta" id="defenseCashDelta" aria-hidden="true"></em></span><small>GOLD</small></span></div>
        <div class="defense-command-actions">
          <button type="button" class="defense-speed defense-action-circle" data-defense-speed aria-label="Change Defense speed"><i>${defenseUiIcon("speed")}</i><span class="defense-action-label"><strong id="defenseSpeedValue">1×</strong><em>SPEED</em></span></button>
          <button type="button" class="defense-intel-button defense-action-circle" id="defenseIntelButton" data-defense-toggle-intel aria-label="Open threat intel" aria-expanded="false"><i>${defenseUiIcon("intel")}</i><span class="defense-action-label">THREATS</span><b id="defenseIntelCount">0</b></button>
          <button type="button" class="defense-abilities-button defense-action-circle" id="defenseAbilitiesButton" data-defense-toggle-abilities aria-label="Open Rizo powers" aria-expanded="false"><i>${defenseUiIcon("power")}</i><span class="defense-action-label" id="defenseLeaderPowerLabel">POWERS</span><b id="defenseAbilityCount">—</b></button>
          <button type="button" class="defense-gate-flame-button defense-action-circle" id="defenseGateFlameButton" data-defense-gate-flame aria-label="Place Ember Pod"><i class="defense-flame-icon" aria-hidden="true">✹</i><span class="defense-action-label">POD</span><b id="defenseGateFlameState">WAVE ONLY</b></button>
          <button type="button" class="defense-bench-button defense-action-circle active" id="defenseBenchButton" data-defense-toggle-bench aria-label="Show or hide Rizo bench" aria-expanded="true"><i>${defenseUiIcon("bench")}</i><span class="defense-action-label">RIZOS</span><b id="defenseBenchCount">${defenseDeployRows().length}</b></button>
          <button type="button" class="defense-menu-button defense-action-circle" id="defenseMenuButton" data-defense-toggle-field-menu aria-label="Open field menu" aria-expanded="false"><i>${defenseUiIcon("menu")}</i><span class="defense-action-label">MENU</span></button>
        </div>
        ${contractBadge}
      </section>
      <div class="defense-school-coach" id="defenseSchoolCoach" hidden></div>
      <div class="defense-stage-frame">
        <button type="button" class="defense-wave-button" id="defenseWaveButton" data-defense-run-control disabled><i id="defenseWaveIcon">${defenseUiIcon("play")}</i><span id="defenseWaveLabel">PLACE FIRST</span></button>
        <div class="defense-moment" id="defenseMoment" role="status" aria-live="assertive" aria-atomic="true" hidden></div>
        <div class="defense-wave-banner" aria-label="Wave and defense phase"><i>${defenseUiIcon("wave")}</i><div class="defense-wave-count"><small>WAVE</small><b id="defenseWave">0</b><em>CLEARED <strong id="defenseClearedWave">0</strong></em></div><span class="defense-phase-indicator" id="defensePhaseIndicator" data-tone="info"><i aria-hidden="true"></i><span><small>PHASE</small><b id="defensePhaseLabel">PLAN</b><em id="defensePhaseDetail">BUILD WINDOW</em></span></span></div>
        <div class="defense-boss-bar defense-boss-overlay" id="defenseBossBar" hidden><span><small>BOSS</small><b id="defenseBossName">UNKNOWN</b></span><i><u id="defenseBossHealth"></u></i><em id="defenseBossPercent">100%</em></div>
        <div class="mini-world defense-world ${map.className} ${contract?"contract-active":""}" id="defenseWorld" data-defense-map="${map.id}" style="--gate-x:${gatePoint.x*100}%;--gate-y:${gatePoint.y*100}%">
          <div class="defense-sky"><i></i><i></i><i></i></div><div class="defense-hills"></div><div class="defense-trees"></div><div class="defense-map-props"><i></i><i></i><i></i></div><div class="defense-world-features">${defenseWorldFeatureMarkup(map)}</div><div class="defense-map-mechanics">${defenseMapMechanicMarkup(map)}</div><div class="defense-map-landmarks">${defenseLandmarkMarkup(map)}</div><div class="defense-build-pockets">${defenseBuildPocketMarkup(map)}</div><div class="defense-weather weather-${map.weather}"><i></i><i></i><i></i></div><div class="defense-obstacles">${defenseObstacleMarkup(map)}</div>
          <svg class="defense-road" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Curved balloon trail"><path class="defense-road-shadow" d="${roadPath}"/><path class="defense-road-border" d="${roadPath}"/><path class="defense-road-fill" d="${roadPath}"/><path class="defense-road-edge-light" d="${roadPath}"/><path class="defense-road-stitch" d="${roadPath}"/></svg><div class="defense-route-markers">${defenseRouteMarkersMarkup(map)}</div><div class="defense-route-scout" id="defenseRouteScout" style="left:${entryX*100}%;top:${entryY*100}%"><i></i></div><div class="defense-entrance" style="--entrance-x:${entryX*100}%;--entrance-y:${entryY*100}%" aria-label="Enemy entrance"><i aria-hidden="true"></i><span><b>ENTRY</b></span></div>
          <div class="defense-gate" aria-label="Ember Gate"><i aria-hidden="true"></i><b>GATE</b><span aria-hidden="true">♥</span></div>
          <div class="defense-gate-flame-live defense-ember-pod-live" id="defenseGateFlameLive" hidden aria-hidden="true"><i></i><i></i><i></i><span></span></div>
          <div class="defense-layer" id="defenseTowers"></div><canvas class="defense-combat-canvas" id="defenseCombatCanvas" aria-hidden="true"></canvas><div class="defense-layer" id="defenseEnemies"></div><div class="defense-layer defense-projectiles" id="defenseProjectiles"></div><div class="defense-layer defense-effects" id="defenseEffects"></div>
          <div class="defense-placement-preview" id="defensePlacementPreview" hidden aria-hidden="true"></div><div class="defense-placement-grid" aria-hidden="true"></div>
          <div class="defense-map-intro" id="defenseMapIntro" aria-label="Entering ${escapeHTML(map.name)}"><i class="defense-intro-vignette"></i><div class="defense-intro-copy"><small>WORLD ${map.level} • OPEN TRAIL</small><b>${escapeHTML(map.name)}</b><span>${escapeHTML(map.routeType)} • ${escapeHTML(map.entrance)} → EMBER GATE</span></div><div class="defense-intro-rizo"><i class="defense-intro-scout-line"></i>${petMarkup({pet:captainPet(),extraClass:"defense-intro-pet",context:"arcade",label:captainPet().name})}<strong class="defense-intro-captain">CAPTAIN • ${escapeHTML(captainPet().name)}</strong><i class="defense-intro-look">!</i></div><div class="defense-intro-cta"><b>${escapeHTML(map.mechanic?.icon||"✦")} ${escapeHTML(map.mechanic?.label||"YOUR RIZO LEADS")}</b><span>${escapeHTML(map.mechanic?.copy||"CAPTAIN DEPLOYS FREE • CREW BACKS THEM UP")}</span></div><button type="button" data-defense-skip-map-intro>ENTER FIELD</button></div>
        </div>
      </div>
      <section class="defense-field-feed" aria-live="polite">
        <div class="defense-decision-rail" id="defenseDecisionRail" data-tone="plan"><span><small>YOUR CALL</small><b id="defenseDecisionTitle">PLACE YOUR RIZO</b><em id="defenseDecisionCopy">Tap open grass. Your main Rizo is armed.</em></span><div><button type="button" id="defenseDecisionPrimary" data-defense-flow-primary data-defense-flow-action="place-main">PLACE RIZO</button><button type="button" id="defenseDecisionSecondary" data-defense-flow-secondary data-defense-flow-action="bench">RIZOS</button></div></div>
        <div class="defense-message" id="defenseMessage"><b>DEFEND THE EMBER GATE</b><span>Tap a Rizo, then tap grass. Or drag one directly onto the field. The circle is its reach.</span></div>
        <div class="defense-live-status" id="defenseLiveStatus" hidden><small>WAVE STATUS</small><b id="defenseThreatsLeft">0 THREATS LEFT</b><i><u id="defenseWaveProgress"></u></i></div>

      </section>
      <button type="button" class="defense-context-scrim" data-defense-dismiss-context aria-label="Close open Defense panel" hidden></button><section class="defense-context-dock" aria-live="polite">
        <div class="defense-wave-preview" id="defenseWavePreview"></div>
        <div class="defense-tower-panel" id="defenseTowerPanel" hidden></div>
        <div class="defense-ability-tray" id="defenseAbilityTray" hidden></div>
        <div class="defense-intel-tray" id="defenseIntelTray" hidden></div>
        <div class="defense-field-menu rizo-field-sheet" id="defenseFieldMenu" hidden>
          <div class="defense-field-menu-head"><div class="defense-sheet-title"><span><img src="./assets/rizo-full-mark.png" alt=""/></span><div><small>FIELD MENU</small><b>${escapeHTML(map.name)}</b></div></div><button type="button" data-defense-toggle-field-menu aria-label="Close field menu">${defenseUiIcon("close")}</button></div>
          <div class="defense-field-menu-grid">
            <button type="button" data-defense-trace-route><i>${defenseUiIcon("route")}</i><span><b>TRACE TRAIL</b><small>Show the enemy route.</small></span></button>
            <button type="button" data-defense-toggle-legend><i>${defenseUiIcon("intel")}</i><span><b>FIELD LEGEND</b><small>Explain every symbol.</small></span></button>
            <button type="button" data-defense-toggle-fullscreen><i>${defenseUiIcon("fullscreen")}</i><span><b>FULLSCREEN</b><small>Use the largest field.</small></span></button>
            <button type="button" data-defense-field-guide="rizos"><i>${defenseUiIcon("guide")}</i><span><b>FIELD GUIDE</b><small>Rizos, threats, and worlds.</small></span></button>
            <button type="button" data-defense-auto-start><i>${defenseUiIcon("snap")}</i><span><b id="defenseAutoStartLabel">AUTO WAVES • ${store.settings.autoStart?"ON":"OFF"}</b><small id="defenseAutoStartCopy">${store.settings.autoStart?"2.8s planning countdown after clears.":"You decide when each wave begins."}</small></span></button>
            <button type="button" data-arcade-pause><i>${defenseUiIcon("speed")}</i><span><b>PAUSE RUN</b><small>Freeze the trail. Nothing advances until you resume.</small></span></button>
            <button type="button" class="danger" data-defense-bank-leave><i>${defenseUiIcon("bank")}</i><span><b>BANK & LEAVE</b><small>Cleared waves bank. The active wave is excluded.</small></span></button>
          </div>
        </div>
      </section>
      <section class="defense-deploy-dock" aria-label="Rizo deployment bench">
        <div class="defense-placement-coach" id="defensePlacementCoach" aria-live="polite">
          <span class="defense-placement-guide" id="defensePlacementGuide"><span>1</span><b>CHOOSE A RIZO</b></span>
          <span class="defense-deploy-hint" id="defenseDeployHint">Your active Rizo deploys free. Tap a card, then grass.</span>
        </div>
        <div class="defense-roster" id="defenseRoster">${defenseRosterMarkup()}</div>
        <button type="button" class="defense-cancel-placement" data-defense-cancel-placement hidden>CANCEL</button>
      </section>
    </div>`;
    stage.header({quit:"BANK & LEAVE"});
    stage.header({hint:contract?`${contract.title} • Clear Wave ${contract.targetWave}. ${contract.rules.map(id=>DEFENSE_CONTRACT_RULES[id].name).join(" • ")}.`:`${map.name} • ${map.strategy}. Build from the bench and defend the Ember Gate.`});
    const renderedWorld=$("#defenseWorld");
    sizeDefenseSquareField();
    d.renderWidth=renderedWorld?.clientWidth||360;
    d.renderHeight=renderedWorld?.clientHeight||520;
    setupDefenseCombatRenderer();
    updateDefenseHud();
    updateDefenseSchoolCoach();
    playDefenseMapIntro();
    /* Pools grow through real use; eager allocation is intentionally avoided on low-memory phones. */
  }

  function defenseRosterSignature(){const d=mini.defense;if(!d)return"";return `${d.towers.length}/${d.maxTowers}|${defenseDeployRows().map(row=>{const copies=d.towers.filter(tower=>tower.petId===row.pet.id).length,cost=defenseDeployCost(row);return `${row.pet.id}:${copies}:${d.cash>=cost?1:0}:${cost}`;}).join("|")}`;}
  function defenseHudCounter(value){
    const amount=Math.max(0,Math.floor(Number(value)||0));
    if(amount>=1_000_000)return `${(amount/1_000_000).toFixed(amount>=10_000_000?0:1).replace(/\.0$/,"")}M`;
    if(amount>=10_000)return `${(amount/1_000).toFixed(amount>=100_000?0:1).replace(/\.0$/,"")}K`;
    return String(amount);
  }
  function updateDefenseRoster(force=true){const host=$("#defenseRoster"),d=mini.defense;if(!host||!d)return;const signature=defenseRosterSignature();if(!force&&signature===d.rosterSignature)return;host.innerHTML=defenseRosterMarkup();d.rosterSignature=signature;d.rosterRenderCount=(d.rosterRenderCount||0)+1;}
  function defenseFlowFieldRead(d=mini.defense,leader=defenseFieldLeader(d)){
    const live=(d?.enemies||[]).filter(enemy=>!enemy.dead&&enemy.hp>0),lead=live.reduce((best,enemy)=>Math.max(best,Number(enemy.progress)||0),0),boss=live.find(enemy=>enemy.bossId)||null,cap=Math.max(1,defenseDensityCap(d,d?.spawnQueue?.[0])),crowded=live.length>=Math.max(5,Math.ceil(cap*.62)),critical=lead>=.88,gatePressure=lead>=.7;
    let targetMode=null;if(boss)targetMode="strong";else if(gatePressure)targetMode="first";
    return{live,lead,boss,crowded,critical,gatePressure,targetMode,pressure:critical?"critical":boss?"boss":gatePressure?"gate":crowded?"crowd":"steady"};
  }
  function defenseFlowTargetCall(leader,read,{fallbackCycle=true}={}){
    const current=leader?.targetMode||"first",recommended=read?.targetMode;
    if(recommended&&recommended!==current)return{label:`AIM ${DEFENSE_TARGET_LABELS[recommended]}`,action:`target:${recommended}`,specific:true};
    const index=Math.max(0,DEFENSE_TARGET_MODES.indexOf(current)),next=DEFENSE_TARGET_MODES[(index+1)%DEFENSE_TARGET_MODES.length];
    return fallbackCycle?{label:`AIM → ${DEFENSE_TARGET_LABELS[next]}`,action:"target",specific:false}:{label:`AIM ${DEFENSE_TARGET_LABELS[current]}`,action:"target",specific:false};
  }
  function defenseFlowChoice(d=mini.defense){
    if(!d)return null;
    const leader=defenseFieldLeader(d),running=defenseIsActiveWave(d),paused=d.phase===DEFENSE_PHASES.PAUSED,nextWave=d.currentWave+1;
    if(!leader)return{tone:"plan",title:"PLACE YOUR RIZO",copy:d.pendingPlacement?"Tap open grass. The ring shows reach.":"Captain deploys free. Pick a bend.",primary:"PLACE RIZO",primaryAction:"place-main",secondary:"RIZOS",secondaryAction:"bench",beatKey:"opening-place"};
    const read=defenseFlowFieldRead(d,leader),target=defenseFlowTargetCall(leader,read),needsDoctrine=leader.upgrade>=2&&!leader.doctrine,cost=leader.upgrade<DEFENSE_LIMITS.MAX_TOWER_LEVEL?defenseUpgradeCost(leader,d):0,canUpgrade=!needsDoctrine&&leader.upgrade<DEFENSE_LIMITS.MAX_TOWER_LEVEL&&defenseUpgradeAllowed(d)&&d.cash>=cost,power=defenseAbilityPresentation(leader),powerReady=Boolean(leader.upgrade>=2&&leader.doctrine&&!defenseContractRule("silent",d)&&DefenseCore.phaseAllows(d.phase,"ability")&&defenseAbilityRemaining(leader)<=0),podReady=Boolean(running&&!paused&&(d.gateFlameUntil||0)<=defenseNow()&&(d.gateFlameReadyAt||0)<=defenseNow()),settling=!running&&d.towers.length&&defenseRealNow(d)<(d.nextWaveReadyAtReal||0),quiet=defenseRealNow(d)<(d.flowActionQuietUntilReal||0),last=d.flowLastAction||"";
    const targetAvailable=!quiet||last!=="target",upgradeAvailable=canUpgrade&&(!quiet||last!=="upgrade"),powerAvailable=powerReady&&(!quiet||last!=="power"),podAvailable=podReady&&(!quiet||last!=="pod"),pressure=read.critical||read.boss||read.gatePressure;
    if(paused)return{tone:"paused",title:"FIELD FROZEN",copy:"Aim and upgrades still work. Resume when your plan is set.",primary:"RESUME",primaryAction:"resume",secondary:target.label,secondaryAction:target.action,beatKey:`paused-${target.action}`};
    if(d.phase===DEFENSE_PHASES.PACKET_BREAK){
      const primary=needsDoctrine?{label:"CHOOSE PATH",action:"inspect"}:upgradeAvailable?{label:`LEVEL UP • ${cost}`,action:"upgrade"}:targetAvailable?target:{label:"RIZOS",action:"bench"};
      const secondary=primary.action!==target.action&&targetAvailable?target:{label:"RIZOS",action:"bench"};
      return{tone:"breather",title:"BREATHER • MAKE ONE CHANGE",copy:defensePlaybackSpeed(d)!==d.speed?"2× eased to 1×. Read the next packet, make one adjustment, then let it run.":"One clean adjustment is enough: level, retarget, or reinforce before pressure returns.",primary:primary.label,primaryAction:primary.action,secondary:secondary.label,secondaryAction:secondary.action,beatKey:`break-${primary.action}-${secondary.action}`};
    }
    if(settling){
      const primary=needsDoctrine?{label:"CHOOSE PATH",action:"inspect"}:upgradeAvailable?{label:`LEVEL UP • ${cost}`,action:"upgrade"}:targetAvailable?target:{label:"RIZOS",action:"bench"};
      return{tone:"breather",title:"FIELD SETTLING • PLAN NOW",copy:"The last pop is landing. Use the half-second for one real adjustment; START returns when the field is clear.",primary:primary.label,primaryAction:primary.action,secondary:"RIZOS",secondaryAction:"bench",beatKey:`settle-${primary.action}`};
    }
    const autoWaiting=!running&&d.phase===DEFENSE_PHASES.WAVE_COMPLETE&&store.settings.autoStart&&d.flowAutoHeldWave!==d.clearedWave&&d.autoStartAtReal>defenseRealNow(d);
    if(autoWaiting){const seconds=Math.max(0,d.autoStartAtReal-defenseRealNow(d));return{tone:"plan",title:`AUTO COMMIT • ${seconds.toFixed(1)}S`,copy:"Keep the run moving, send early, or hold this one boundary without disabling Auto Waves.",primary:"SEND NOW",primaryAction:"start",secondary:"HOLD FIELD",secondaryAction:"hold-auto",beatKey:"auto-boundary"};}
    if(!running){
      const held=store.settings.autoStart&&d.phase===DEFENSE_PHASES.WAVE_COMPLETE&&d.flowAutoHeldWave===d.clearedWave,title=held?`FIELD HELD • WAVE ${nextWave}`:`SPEND OR SEND? • WAVE ${nextWave}`;
      const copy=held?"Auto Waves stays on. This boundary is yours until you call the next wave.":needsDoctrine?`${leader.pet.name} has a fighting path ready. Choose it now or send the next wave.`:canUpgrade?`${leader.pet.name} can level now, or keep ${Math.floor(d.cash)} gold for another answer.`:"Build, aim, or call the next wave when the field looks right.";
      return{tone:"plan",title,copy,primary:`START WAVE ${nextWave}`,primaryAction:"start",secondary:needsDoctrine?"CHOOSE PATH":canUpgrade?`LEVEL • ${cost}`:"RIZOS",secondaryAction:needsDoctrine?"inspect":canUpgrade?"upgrade":"bench",beatKey:`plan-${held?"held":"manual"}-${needsDoctrine?"path":canUpgrade?"upgrade":"bench"}`};
    }
    if(needsDoctrine)return{tone:"combat",title:"FIGHTING PATH READY",copy:`${leader.pet.name} can commit to POWER or CONTROL. Pick when the field gives you room.`,primary:"CHOOSE PATH",primaryAction:"inspect",secondary:target.label,secondaryAction:target.action,beatKey:`doctrine-${target.action}`};
    if(pressure&&powerAvailable)return{tone:"power",title:read.boss?`${power.active} • BOSS WINDOW`:read.critical?"GATE LINE BREAKING":`${power.active} • PRESSURE WINDOW`,copy:read.boss?`${leader.pet.name}'s Field Power is ready while the boss owns the road.`:`Pressure reached the late trail. Commit ${power.active} now or change what ${leader.pet.name} is hunting.`,primary:`USE ${power.active}`,primaryAction:"power",secondary:target.label,secondaryAction:target.action,beatKey:`pressure-power-${read.pressure}-${target.action}`};
    if(pressure&&podAvailable)return{tone:"power",title:read.critical?"GATE LINE BREAKING":"EMBER POD WINDOW",copy:"The road is carrying real pressure. Commit the Pod here or retarget the Field Leader.",primary:"PLACE POD",primaryAction:"pod",secondary:target.label,secondaryAction:target.action,beatKey:`pressure-pod-${read.pressure}-${target.action}`};
    if(read.targetMode&&leader.targetMode!==read.targetMode&&targetAvailable)return{tone:"combat",title:read.boss?"BOSS READ • CHANGE THE HUNT":"GATE READ • CHANGE THE HUNT",copy:read.boss?"A boss is on the field. The rail can set the Field Leader directly to the toughest target.":"A threat crossed the late trail. Put the Field Leader back on the front instead of cycling blindly.",primary:target.label,primaryAction:target.action,secondary:powerReady?`${power.active} READY`:podReady?"POD READY":"RIZOS",secondaryAction:powerReady?"power":podReady?"pod":"bench",beatKey:`read-${read.pressure}-${target.action}`};
    if(upgradeAvailable)return{tone:"combat",title:"CASH WINDOW • INVEST OR HOLD",copy:`${cost} gold can become a level right now. Spend it mid-fight, or keep the reserve for the next answer.`,primary:`LEVEL UP • ${cost}`,primaryAction:"upgrade",secondary:powerReady?`${power.active} READY`:podReady?"POD READY":target.label,secondaryAction:powerReady?"power":podReady?"pod":target.action,beatKey:`cash-${powerReady?"power":podReady?"pod":target.action}`};
    if(powerReady)return{tone:"combat",title:`${power.active} BANKED`,copy:"The Field Power is ready, but the Gate is not under real pressure. Keep it banked or cash it in on your terms.",primary:targetAvailable?target.label:"RIZOS",primaryAction:targetAvailable?target.action:"bench",secondary:`USE ${power.active}`,secondaryAction:"power",beatKey:`banked-power-${target.action}`};
    if(podReady)return{tone:"combat",title:"EMBER POD BANKED",copy:"The Pod is ready. Keep watching the road, or place it before the next pressure spike.",primary:targetAvailable?target.label:"RIZOS",primaryAction:targetAvailable?target.action:"bench",secondary:"PLACE POD",secondaryAction:"pod",beatKey:`banked-pod-${target.action}`};
    if(quiet)return{tone:"combat",title:"CALL MADE • LET IT WORK",copy:"You changed the field. Give the formation a moment before making another adjustment.",primary:"RIZOS",primaryAction:"bench",secondary:"THREATS",secondaryAction:"intel",beatKey:`quiet-${last}`};
    return{tone:"combat",title:read.crowded?"ROAD IS FULL • WATCH THE BREAK":"FIELD IS WORKING",copy:read.crowded?"The road is busy, but not yet at the Gate. Read the next break instead of chasing every balloon.":"No forced tap. Retarget when the formation changes, reinforce when cash opens a window, and bank power for pressure.",primary:target.label,primaryAction:target.action,secondary:"RIZOS",secondaryAction:"bench",beatKey:`steady-${read.crowded?"crowd":"calm"}-${target.action}`};
  }
  function updateDefenseDecisionRail(){
    const d=mini.defense,host=$("#defenseDecisionRail"),title=$("#defenseDecisionTitle"),copy=$("#defenseDecisionCopy"),primary=$("#defenseDecisionPrimary"),secondary=$("#defenseDecisionSecondary");if(!d||!host||!primary||!secondary)return;
    const choice=defenseFlowChoice(d);if(!choice)return;const nowReal=defenseRealNow(d),choiceKey=choice.beatKey||`${choice.tone}|${choice.primaryAction}|${choice.secondaryAction}`,renderKey=`${choice.tone}|${choice.title}|${choice.copy}|${choice.primary}|${choice.primaryAction}|${choice.secondary}|${choice.secondaryAction}`;if(d.flowChoiceKey&&choiceKey!==d.flowChoiceKey&&nowReal>=(d.flowActionQuietUntilReal||0))d.flowPulseUntilReal=Math.max(d.flowPulseUntilReal||0,nowReal+.72);d.flowChoiceKey=choiceKey;host.dataset.tone=choice.tone||"plan";host.classList.toggle("pulse",nowReal<(d.flowPulseUntilReal||0));if(host.dataset.flowRenderKey!==renderKey){host.dataset.flowRenderKey=renderKey;if(title)title.textContent=choice.title;if(copy)copy.textContent=choice.copy;primary.textContent=choice.primary;primary.dataset.defenseFlowAction=choice.primaryAction;primary.disabled=false;secondary.textContent=choice.secondary;secondary.dataset.defenseFlowAction=choice.secondaryAction;secondary.disabled=false;}
  }
  function defenseRecordFlowAction(action,acted=true){
    const d=mini.defense;if(!d||!acted)return acted;const family=String(action||"").split(":")[0];if(!["start","resume","hold-auto","inspect","bench","intel"].includes(family)){d.flowLastAction=family;d.flowActionQuietUntilReal=defenseRealNow(d)+1.35;}d.flowDecisionBeat=(d.flowDecisionBeat||0)+1;d.flowChoiceKey="";d.uiDirty=true;flushDefenseUi(true);return acted;
  }
  function runDefenseFlowAction(action){
    const d=mini.defense;if(!d)return false;const leader=defenseFieldLeader(d);
    if(action==="place-main"){const row=defenseRoster().find(item=>item.source==="active")||defenseRoster()[0];if(!row)return false;if(d.pendingPlacement?.row?.pet?.id===row.pet.id){setDefenseMessage(`PLACE ${row.pet.name}`,"Tap open grass. Green means the full footprint is safe.");return true;}return selectDefenseRosterPet(row);}
    if(action==="bench"){toggleDefenseBench(true);return true;}
    if(action==="intel"){toggleDefenseIntel(true);return true;}
    if(action==="start")return startDefenseWave();
    if(action==="resume"){toggleDefensePause(false);return true;}
    if(action==="hold-auto"){d.flowAutoHeldWave=d.clearedWave;d.autoStartAtReal=0;d.flowChoiceKey="";d.uiDirty=true;flushDefenseUi(true);setDefenseMessage("FIELD HELD","Auto Waves stays on. This boundary waits for your call; the next clear returns to auto tempo.");sfx("ui");return true;}
    if(action.startsWith("target:")&&leader){const mode=action.split(":")[1];if(DEFENSE_TARGET_MODES.includes(mode)){leader.targetMode=mode;leader.targetId=null;leader.retargetAtReal=0;completeDefenseSchoolLesson("targeting");markDefenseUi();writeDefenseCheckpoint(true,"targeting");setDefenseMessage(`${leader.pet.name.toUpperCase()} • ${DEFENSE_TARGET_LABELS[mode]}`,mode==="strong"?"Field Leader is hunting the toughest threat.":mode==="first"?"Field Leader is back on the front balloon.":"Target priority changed.");sfx("ui");return defenseRecordFlowAction("target",true);}}
    if(action==="target"&&leader)return defenseRecordFlowAction("target",(cycleDefenseTarget(leader.id,{showPanel:false}),true));
    if(action==="upgrade"&&leader)return defenseRecordFlowAction("upgrade",upgradeDefenseTower(leader.id,{showPanel:false}));
    if(action==="inspect"&&leader){showDefenseTowerPanel(leader);return true;}
    if(action==="power"&&leader)return defenseRecordFlowAction("power",activateDefenseAbility(leader.id,{showPanel:false}));
    if(action==="pod")return defenseRecordFlowAction("pod",(toggleDefenseGateFlame(),true));
    return false;
  }
  function updateDefenseHud(){
    if(!mini.active||mini.mode!=="defense"||!mini.defense)return;
    const d=mini.defense;d.hudRenderCount=(d.hudRenderCount||0)+1;
    const phaseShell=$(".defense-shell");if(phaseShell){phaseShell.dataset.defensePhase=d.phase;phaseShell.dataset.currentWave=String(d.currentWave);phaseShell.dataset.clearedWave=String(d.clearedWave);phaseShell.dataset.fieldDensity=d.towers.length>=7?"crowded":d.towers.length>=4?"busy":"open";phaseShell.dataset.performanceTier=String(d.governorTier||0);}
    const wave=$("#defenseWave"),clearedWave=$("#defenseClearedWave"),phaseIndicator=$("#defensePhaseIndicator"),phaseLabel=$("#defensePhaseLabel"),phaseDetail=$("#defensePhaseDetail"),lives=$("#defenseLives"),cash=$("#defenseCash"),cashDelta=$("#defenseCashDelta"),speed=$("[data-defense-speed]"),speedValue=$("#defenseSpeedValue"),guide=$("#defensePlacementGuide"),deployHint=$("#defenseDeployHint"),cancel=$("[data-defense-cancel-placement]"),world=$("#defenseWorld"),shell=$(".defense-shell"),flameButton=$("#defenseGateFlameButton"),flameState=$("#defenseGateFlameState"),flameLive=$("#defenseGateFlameLive");
    if(wave)wave.textContent=d.currentWave;
    if(clearedWave)clearedWave.textContent=d.clearedWave;
    const phaseUi=defensePhaseUi(d),performanceNote=(d.governorTier||0)>=2?" • LOW FX":(d.governorTier||0)>=1?" • FX LEAN":"";if(phaseIndicator){phaseIndicator.hidden=false;phaseIndicator.dataset.tone=d.paused?"paused":phaseUi.tone;}if(phaseLabel)phaseLabel.textContent=d.paused?"PAUSED":phaseUi.label;if(phaseDetail)phaseDetail.textContent=d.paused?"TAP RESUME":`${phaseUi.detail}${performanceNote}`;
    if(lives){const prior=d.lastHudLives;lives.textContent=d.lives;if(prior!==null&&prior!==d.lives){const art=$("#defenseLivesArt");art?.classList.remove("hud-hit","hud-heal");void art?.offsetWidth;art?.classList.add(d.lives<prior?"hud-hit":"hud-heal");}d.lastHudLives=d.lives;}
    if(cash){const exact=Math.floor(d.cash),prior=d.lastHudCash;cash.textContent=defenseHudCounter(exact);cash.title=exact.toLocaleString();cash.closest(".defense-stat-cash")?.setAttribute("aria-label",`${exact.toLocaleString()} gold`);if(prior!==null&&prior!==exact){const art=$("#defenseCashArt"),delta=exact-prior;art?.classList.remove("hud-gain","hud-spend");void art?.offsetWidth;art?.classList.add(delta>0?"hud-gain":"hud-spend");if(cashDelta&&(delta<0||delta>=5)){cashDelta.textContent=`${delta>0?"+":"−"}${defenseHudCounter(Math.abs(delta))}`;cashDelta.classList.remove("show","gain","spend");void cashDelta.offsetWidth;cashDelta.classList.add("show",delta>0?"gain":"spend");}}d.lastHudCash=exact;}
    if(speedValue){const playback=defensePlaybackSpeed(d);speedValue.textContent=playback===.5?"½×":`${playback}×`;speedValue.title=playback!==d.speed?"2× resumes after this breather":"";}
    if(speed)speed.disabled=false;
    if(flameButton){const nowGame=defenseNow(),remaining=Math.max(0,(d.gateFlameReadyAt||0)-nowGame),active=(d.gateFlameUntil||0)>nowGame,ready=remaining<=0&&!active,canPlace=defenseIsActiveWave(d)&&!d.paused;flameButton.classList.toggle("armed",Boolean(d.gateFlameArmed));flameButton.classList.toggle("active",active);flameButton.classList.toggle("cooling",!active&&remaining>0);flameButton.disabled=!canPlace&&!active;flameButton.setAttribute("aria-pressed",String(Boolean(d.gateFlameArmed)));flameButton.setAttribute("aria-label",active?"Ember Pod active":!canPlace?"Ember Pod is available during a live wave":ready?"Place Ember Pod on the trail":`Ember Pod ready in ${Math.ceil(remaining)} seconds`);if(flameState)flameState.textContent=active?`${Math.max(1,Math.ceil(d.gateFlameUntil-nowGame))}S`:d.gateFlameArmed?"TAP ROAD":!canPlace?"WAVE ONLY":ready?"READY":`${Math.ceil(remaining)}S`;}
    if(flameLive){const active=(d.gateFlameUntil||0)>defenseNow();flameLive.hidden=!active;flameLive.style.left=`${defensePointAt(d.gateFlameProgress||0).x*100}%`;flameLive.style.top=`${defensePointAt(d.gateFlameProgress||0).y*100}%`;flameLive.classList.toggle("low-fx",(d.governorTier||0)>0);}
    const leaderButton=$("#defenseAbilitiesButton"),leaderCount=$("#defenseAbilityCount"),leaderLabel=$("#defenseLeaderPowerLabel");
    if(leaderButton){
      const sealed=defenseContractRule("silent",d),groups=defenseAbilityGroups(),casting=DefenseCore.phaseAllows(d.phase,"ability"),readyGroups=sealed?0:groups.filter(group=>casting&&group.ready.length>0).length,nextRemaining=Math.min(...groups.map(group=>group.nextRemaining).filter(Number.isFinite),Infinity),priorReady=Number.isFinite(d.lastReadyAbilityGroups)?d.lastReadyAbilityGroups:readyGroups,readyArrival=readyGroups>priorReady&&defenseIsActiveWave(d)&&!d.paused;
      leaderButton.disabled=false;leaderButton.classList.toggle("ready",readyGroups>0);leaderButton.classList.toggle("empty",groups.length===0);leaderButton.classList.toggle("sealed",sealed);leaderButton.setAttribute("aria-expanded",String(Boolean(d.abilityTrayOpen)));leaderButton.setAttribute("aria-label",sealed?"Open Rizo powers; activated effects are sealed by this contract":readyGroups?`Open Rizo powers, ${readyGroups} ready`:groups.length?`Open Rizo powers, next ready ${Number.isFinite(nextRemaining)?Math.ceil(nextRemaining):0} seconds`:"Open Rizo powers; level a Rizo to Level 3 and choose a path to unlock them");
      if(leaderLabel)leaderLabel.textContent="POWERS";if(leaderCount)leaderCount.textContent=sealed?"×":readyGroups?String(readyGroups):groups.length&&Number.isFinite(nextRemaining)?`${Math.ceil(nextRemaining)}s`:groups.length?"WAIT":"LV3";
      if(readyArrival){leaderButton.classList.remove("ready-arrival");void leaderButton.offsetWidth;leaderButton.classList.add("ready-arrival");queueMiniTimeout(()=>leaderButton?.classList.remove("ready-arrival"),760);}
      d.lastReadyAbilityGroups=readyGroups;
    }
    const autoLabel=$("#defenseAutoStartLabel"),autoCopy=$("#defenseAutoStartCopy");if(autoLabel)autoLabel.textContent=`AUTO WAVES • ${store.settings.autoStart?"ON":"OFF"}`;if(autoCopy)autoCopy.textContent=store.settings.autoStart?"2.8s planning countdown after clears.":"You decide when each wave begins.";
    world?.classList.toggle("defense-paused",d.paused);
    world?.style.setProperty("--wave-darkness",String(Math.min(.18,d.wave*.0075)));
    shell?.style.setProperty("--wave-darkness",String(Math.min(.18,d.wave*.0075)));
    world?.classList.toggle("hud-danger",d.lives<=Math.max(5,Math.ceil(d.map.lives*.35)));
    shell?.classList.toggle("has-placement",Boolean(d.pendingPlacement));
    shell?.classList.toggle("has-towers",d.towers.length>0);
    shell?.classList.toggle("wave-running",defenseIsActiveWave(d));
    syncDefenseOverlayState();
    stage?.header({timer:`WORLD ${d.map.level}`,score:`${d.kills} POPS`});
    
    const button=$("#defenseWaveButton");
    if(button){
      const hasTower=d.towers.length>0,running=defenseIsActiveWave(d),waveLabel=$("#defenseWaveLabel"),waveIcon=$("#defenseWaveIcon");
      button.classList.toggle("paused",running&&d.paused);
      button.classList.toggle("running",running&&!d.paused);
      if(!running){
        const settling=hasTower&&defenseRealNow(d)<(d.nextWaveReadyAtReal||0);button.disabled=!hasTower||settling;
        if(waveIcon)setDefenseWaveIcon(waveIcon,"play");
        const autoWaiting=hasTower&&!settling&&d.phase===DEFENSE_PHASES.WAVE_COMPLETE&&store.settings.autoStart&&d.autoStartAtReal>defenseRealNow(d),autoSeconds=autoWaiting?Math.max(0,d.autoStartAtReal-defenseRealNow(d)):0;
        if(waveLabel)waveLabel.textContent=!hasTower?"PLACE FIRST":settling?"FIELD CLEAR…":autoWaiting?`AUTO ${autoSeconds.toFixed(1)}S`:d.wave?`START WAVE ${d.wave+1}`:"START WAVE 1";
        button.setAttribute("aria-label",!hasTower?"Place a Rizo first":settling?"Field settling after wave clear":autoWaiting?`Next wave auto-starts in ${autoSeconds.toFixed(1)} seconds; tap to start now`:d.wave?`Start Wave ${d.wave+1}`:"Start Wave 1");
      }else{
        button.disabled=false;
        if(waveIcon)setDefenseWaveIcon(waveIcon,d.paused?"play":"pause");
        if(waveLabel)waveLabel.textContent=d.paused?"RESUME":"PAUSE";
        button.setAttribute("aria-label",d.paused?"Resume Defense":"Pause Defense");
      }
      if(d.ending||d.phase===DEFENSE_PHASES.RUN_COMPLETE){button.disabled=true;if(waveLabel)waveLabel.textContent=d.lives<=0?"GATE DOWN":"RUN BANKED";}
      button.hidden=false;
    }
    const coach=$("#defensePlacementCoach");
    if(coach)coach.hidden=Boolean(d.towers.length&&!d.pendingPlacement);
    if(guide){
      guide.hidden=Boolean(d.towers.length&&!d.pendingPlacement);
      const step=guide.querySelector("span"),title=guide.querySelector("b");
      if(step)step.textContent=d.pendingPlacement?"2":d.towers.length?"✓":"1";
      if(title)title.textContent=d.pendingPlacement?`PLACE ${d.pendingPlacement.row.pet.name}`:defenseIsActiveWave(d)?"FIELD IS LIVE":d.towers.length?"BUILD OR BEGIN":"CHOOSE A DEFENDER";
    }
    if(deployHint){
      const remaining=d.spawnQueue.length+d.enemies.filter(enemy=>!enemy.dead).length;
      deployHint.textContent=d.pendingPlacement?"Any open grass works. Cover two bends or guard the late exit.":defenseIsActiveWave(d)?`${remaining} ${remaining===1?"threat":"threats"} remain. Reinforcements, upgrades and targeting are live.`:d.towers.length?`Upgrade, target, or start Wave ${d.wave+1}.`:"Your active Rizo deploys free. Basic Defense Rizo is the cheap universal tool.";
    }
    if(cancel)cancel.hidden=!d.pendingPlacement;
    const benchCount=$("#defenseBenchCount");if(benchCount)benchCount.textContent=String(defenseDeployRows().length);
    updateDefenseAbilityPanel();
    updateDefenseAbilityTray();
    updateDefenseIntelTray();
    updateDefenseWavePreview();
    updateDefenseLiveStatus();
    updateDefenseDecisionRail();
    updateDefenseSchoolCoach();
    d.uiDirty=false;
  }

  function markDefenseUi({roster=false}={}){const d=mini.defense;if(!d)return;d.uiDirty=true;d.checkpointDirty=true;if(roster)d.rosterDirty=true;}
  function flushDefenseUi(force=false){const d=mini.defense;if(!d)return;if(d.rosterDirty){updateDefenseRoster(false);d.rosterDirty=false;}if(force||d.uiDirty||d.abilityTrayOpen||d.selectedTowerId)updateDefenseHud();else{updateDefenseLiveStatus();updateDefenseDecisionRail();}}

  function defenseAbilityId(tower){return tower?.pet?.variant||tower?.pet?.hiddenVariant||"classic";}
  function defenseReadyAbilities(){
    const d=mini.defense;if(!d)return[];
    return d.towers.filter(tower=>defenseIsCharacterTower(tower)&&tower.upgrade>=2&&tower.doctrine).map(tower=>({tower,abilityId:defenseAbilityId(tower),ability:defenseAbilityData(tower),remaining:Math.ceil(defenseAbilityRemaining(tower))}));
  }
  function defenseAbilityGroups(){
    const groups=new Map();
    for(const row of defenseReadyAbilities()){
      if(!groups.has(row.abilityId))groups.set(row.abilityId,{id:row.abilityId,ability:row.ability,instances:[]});
      groups.get(row.abilityId).instances.push(row);
    }
    return [...groups.values()].map(group=>{
      group.instances.sort((a,b)=>a.remaining-b.remaining||b.tower.upgrade-a.tower.upgrade||(a.tower.copyNumber||1)-(b.tower.copyNumber||1));
      group.ready=group.instances.filter(row=>row.remaining<=0);
      group.nextRemaining=Math.min(...group.instances.filter(row=>row.remaining>0).map(row=>row.remaining),Infinity);
      return group;
    });
  }
  function defenseTowerFieldLabel(tower){
    const vertical=tower.y<.34?"TOP":tower.y>.66?"BOTTOM":"MID",horizontal=tower.x<.34?"LEFT":tower.x>.66?"RIGHT":"CENTER";
    return `${vertical} ${horizontal}`;
  }
  function defenseAbilityGroupStatus(group,d){
    if(d.paused)return"RESUME TO CAST";
    if(!defenseIsActiveWave(d))return"START A WAVE";
    if(group.ready.length===1)return group.instances.length===1?"READY":"1 READY";
    if(group.ready.length>1)return`${group.ready.length} READY • PICK ONE`;
    return Number.isFinite(group.nextRemaining)?`${group.nextRemaining}s COOLDOWN`:"COOLDOWN";
  }
  function defenseAbilityStackMarkup(group){
    const shown=group.instances.slice(0,3).map(({tower})=>`<i>${petMarkup({pet:tower.pet,extraClass:"defense-ability-rizo",context:"thumbnail",label:tower.pet.name})}</i>`).join("");
    return `<span class="defense-ability-stack">${shown}${group.instances.length>3?`<u>+${group.instances.length-3}</u>`:""}</span>`;
  }
  function defenseAbilityChargeMarkup(group){
    const next=group.instances.find(row=>row.remaining>0),cooldown=next?Math.max(1,defenseAbilityCooldown(next.tower)):1,charge=next?clamp(1-next.remaining/cooldown,0,1):1,shown=group.instances.slice(0,6),pips=shown.map(row=>`<i class="${row.remaining<=0?"charged":"charging"}"></i>`).join("");
    return `<span class="defense-ability-charge" style="--ability-charge:${Math.round(charge*100)}%" aria-hidden="true"><span class="defense-ability-charge-pips">${pips}${group.instances.length>shown.length?`<u>+${group.instances.length-shown.length}</u>`:""}</span><span class="defense-ability-charge-rail"><i></i></span></span>`;
  }
  function defenseAbilityPickerMarkup(group,d){
    return `<div class="defense-ability-picker" role="group" aria-label="Choose which ${escapeHTML(group.ability.active)} to cast">${group.instances.map(({tower,remaining})=>{const ready=remaining<=0&&DefenseCore.phaseAllows(d.phase,"ability");return`<button type="button" class="${ready?"ready":"cooling"}" data-defense-cast="${tower.id}" ${ready?"":"disabled"}><span>${defenseTowerFieldLabel(tower)}</span><b>LV ${tower.upgrade+1}${tower.copyNumber>1?` • COPY ${tower.copyNumber}`:""}</b><em>${ready?"CAST":remaining?`${remaining}s`:d.paused?"PAUSED":"WAIT"}</em></button>`;}).join("")}</div>`;
  }
  function activateDefenseAbilityGroup(abilityId){
    const d=mini.defense;if(!d)return false;const group=defenseAbilityGroups().find(item=>item.id===abilityId),ready=group?.ready.filter(row=>DefenseCore.phaseAllows(d.phase,"ability"))||[];
    if(!group||!ready.length)return false;
    if(ready.length===1){d.abilityGroupOpen=null;return activateDefenseAbility(ready[0].tower.id,{keepAbilityTray:true});}
    d.abilityGroupOpen=d.abilityGroupOpen===abilityId?null:abilityId;markDefenseUi();flushDefenseUi(true);return true;
  }
  function updateDefenseAbilityTray(){
    const d=mini.defense,button=$("#defenseAbilitiesButton"),count=$("#defenseAbilityCount"),tray=$("#defenseAbilityTray");if(!d||!button||!tray)return;
    const sealed=defenseContractRule("silent",d),groups=defenseAbilityGroups(),casting=DefenseCore.phaseAllows(d.phase,"ability"),readyGroups=sealed?0:groups.filter(group=>casting&&group.ready.length>0).length,nextRemaining=Math.min(...groups.map(group=>group.nextRemaining).filter(Number.isFinite),Infinity),scroll=tray.scrollTop;
    if(d.abilityGroupOpen&&!groups.some(group=>group.id===d.abilityGroupOpen&&casting&&group.ready.length>1))d.abilityGroupOpen=null;
    if(count)count.textContent=sealed?"×":readyGroups?String(readyGroups):groups.length&&Number.isFinite(nextRemaining)?`${Math.ceil(nextRemaining)}s`:groups.length?"WAIT":"LV3";
    button.classList.toggle("ready",readyGroups>0);button.classList.toggle("empty",groups.length===0);button.classList.toggle("paused",d.paused);button.classList.toggle("sealed",sealed);button.setAttribute("aria-expanded",String(Boolean(d.abilityTrayOpen)));
    tray.hidden=!d.abilityTrayOpen;
    if(!d.abilityTrayOpen){d.abilityTraySignature="";d.abilityGroupOpen=null;return;}
    const cards=groups.map(group=>{const expanded=d.abilityGroupOpen===group.id,canCast=casting&&group.ready.length>0,subline=group.instances.length===1?`${group.instances[0].tower.pet.name} • LV ${group.instances[0].tower.upgrade+1}`:`${group.instances.length} RIZOS • ${group.ready.length} CHARGED`,action=group.ready.length>1?(expanded?"−":"+"):"›";return`<article class="defense-ability-group ${canCast?"ready":""} ${expanded?"expanded":""}" data-ability-group="${escapeHTML(group.id)}"><button type="button" class="defense-ability-card" data-defense-cast-group="${escapeHTML(group.id)}" aria-expanded="${expanded}" ${canCast?"":"disabled"}>${defenseAbilityStackMarkup(group)}<span class="defense-ability-copy"><small>${escapeHTML(subline)}</small><b>${escapeHTML(group.ability.active)}</b><em>${escapeHTML(defenseAbilityGroupStatus(group,d))}</em></span>${defenseAbilityChargeMarkup(group)}<i class="defense-ability-action" aria-hidden="true">${action}</i></button>${expanded?defenseAbilityPickerMarkup(group,d):""}</article>`;}).join("");
    const markup=sealed?`<div class="defense-ability-tray-head"><div class="defense-sheet-title"><span>${defenseUiIcon("power")}</span><div><small>TRAIL CONTRACT</small><b>ACTIVATED EFFECTS SEALED</b></div></div><button type="button" data-defense-toggle-abilities>${defenseUiIcon("close")}</button></div><div class="defense-ability-list"><p>Every Rizo keeps its passive identity. Manual abilities are unavailable for this run.</p></div>`:`<div class="defense-ability-tray-head"><div class="defense-sheet-title"><span>${defenseUiIcon("power")}</span><div><small>GROUPED POWERS</small><b>${d.paused?"PAUSED • RESUME TO CAST":`${readyGroups} READY • ${groups.length} ${groups.length===1?"POWER":"POWERS"}`}</b></div></div><button type="button" data-defense-toggle-abilities>${defenseUiIcon("close")}</button></div><div class="defense-ability-list">${groups.length?cards:`<p>Reach Level 3 and choose a path to unlock activated effects.</p>`}</div>`,signature=`${sealed}|${d.paused}|${d.phase}|${d.abilityGroupOpen||""}|${groups.map(group=>`${group.id}[${group.instances.map(row=>`${row.tower.id}:${row.tower.upgrade}:${row.tower.doctrine}:${row.tower.targetMode}:${row.remaining}`).join(",")}]`).join("|")}`;
    if(signature!==d.abilityTraySignature){d.trayRenderCount=(d.trayRenderCount||0)+1;tray.innerHTML=markup;d.abilityTraySignature=signature;tray.scrollTop=scroll;}
  }
  const DEFENSE_CONTEXT_SELECTORS=Object.freeze({menu:"#defenseFieldMenu",abilities:"#defenseAbilityTray",intel:"#defenseIntelTray",tower:"#defenseTowerPanel"});
  function defenseContextSurface(d=mini.defense){if(!d)return null;if(d.fieldMenuOpen)return"menu";if(d.abilityTrayOpen)return"abilities";if(d.intelOpen)return"intel";if(d.selectedTowerId)return"tower";return null;}
  function defenseContextElement(name){return name?$(DEFENSE_CONTEXT_SELECTORS[name]||""):null;}
  function defenseSetBackgroundInert(active){
    const shell=$(".defense-shell");if(!shell)return;for(const selector of[".defense-command-deck",".defense-stage-frame",".defense-field-feed",".defense-deploy-dock",".defense-school-coach"]){const node=shell.querySelector(selector);if(!node)continue;node.inert=Boolean(active);if(active)node.setAttribute("aria-hidden","true");else node.removeAttribute("aria-hidden");}
  }
  function defenseFocusContext(name){const host=defenseContextElement(name);if(!host||host.hidden)return;const target=host.querySelector('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');(target||host).focus?.({preventScroll:true});}
  function defenseClearTowerSelection(){const panel=$("#defenseTowerPanel");if(panel)panel.hidden=true;if(mini.defense)mini.defense.selectedTowerId=null;mini.defense?.towers.forEach(t=>{t.node?.classList.remove("selected");t.node?.setAttribute("aria-pressed","false");});}
  function defenseCloseContextSurfaces(except="",{sync=false}={}){
    const d=mini.defense;if(!d)return;for(const name of["menu","abilities","intel","tower"]){if(name===except)continue;if(name==="menu")d.fieldMenuOpen=false;else if(name==="abilities"){d.abilityTrayOpen=false;d.abilityGroupOpen=null;}else if(name==="intel"){d.intelOpen=false;d.intelPausedByOpen=false;}else defenseClearTowerSelection();}if(sync)syncDefenseOverlayState();
  }
  function defenseDismissContextSurface({restoreFocus=true}={}){
    const d=mini.defense;if(!d)return false;const active=defenseContextSurface(d);if(!active)return false;defenseCloseContextSurfaces("",{sync:false});syncDefenseOverlayState({restoreFocus});markDefenseUi();flushDefenseUi(true);return true;
  }
  function syncDefenseOverlayState({restoreFocus=true}={}){
    const d=mini.defense,shell=$(".defense-shell"),bench=$("#defenseBenchButton"),menuButton=$("#defenseMenuButton"),menu=$("#defenseFieldMenu"),scrim=$(".defense-context-scrim");if(!d)return;
    // Last-open wins. If legacy booleans somehow disagree, normalize immediately.
    let active=defenseContextSurface(d),openCount=[d.fieldMenuOpen,d.abilityTrayOpen,d.intelOpen,Boolean(d.selectedTowerId)].filter(Boolean).length;
    if(openCount>1&&active){defenseCloseContextSurfaces(active,{sync:false});active=defenseContextSurface(d);}
    const prior=d.contextSurface||null;
    if(active&&prior!==active&&!d.contextReturnFocus?.isConnected)d.contextReturnFocus=document.activeElement;
    d.contextSurface=active;
    shell?.classList.toggle("bench-open",Boolean(d.benchOpen));shell?.classList.toggle("bench-collapsed",!d.benchOpen);shell?.classList.toggle("field-menu-open",Boolean(d.fieldMenuOpen));shell?.classList.toggle("context-open",Boolean(active));if(shell)shell.dataset.contextSurface=active||"none";
    if(bench){bench.classList.toggle("active",Boolean(d.benchOpen));bench.setAttribute("aria-expanded",String(Boolean(d.benchOpen)));}
    if(menuButton){menuButton.classList.toggle("active",Boolean(d.fieldMenuOpen));menuButton.setAttribute("aria-expanded",String(Boolean(d.fieldMenuOpen)));}
    if(menu)menu.hidden=!d.fieldMenuOpen;if(scrim)scrim.hidden=!active;defenseSetBackgroundInert(Boolean(active));
    if(active&&prior!==active)requestAnimationFrame(()=>defenseFocusContext(active));
    if(!active&&prior&&restoreFocus){const target=d.contextReturnFocus;d.contextReturnFocus=null;if(target?.isConnected)requestAnimationFrame(()=>target.focus?.({preventScroll:true}));}
  }
  function defenseHandleContextKeydown(event){
    const d=mini.defense,active=defenseContextSurface(d);if(!d||!active)return false;
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();defenseDismissContextSurface();return true;}
    if(event.key!=="Tab")return false;const host=defenseContextElement(active);if(!host)return false;const focusable=[...host.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden&&getComputedStyle(node).display!=="none");if(!focusable.length){event.preventDefault();host.focus?.();return true;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();return true;}if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();return true;}return false;
  }
  function toggleDefenseBench(force){
    const d=mini.defense;if(!d)return;d.benchOpen=typeof force==="boolean"?force:!d.benchOpen;if(d.pendingPlacement)d.benchOpen=true;syncDefenseOverlayState();markDefenseUi();flushDefenseUi(true);scheduleDefenseTowerGeometrySync();
  }
  function toggleDefenseFieldMenu(force){const d=mini.defense;if(!d)return;const opening=typeof force==="boolean"?force:!d.fieldMenuOpen;if(opening){clearDefensePlacementMode();defenseCloseContextSurfaces("menu",{sync:false});}d.fieldMenuOpen=opening;syncDefenseOverlayState();markDefenseUi();flushDefenseUi(true);}
  function toggleDefenseAbilityTray(force){const d=mini.defense;if(!d)return;const opening=typeof force==="boolean"?force:!d.abilityTrayOpen;if(opening){clearDefensePlacementMode();defenseCloseContextSurfaces("abilities",{sync:false});}d.abilityTrayOpen=opening;if(!opening)d.abilityGroupOpen=null;syncDefenseOverlayState();markDefenseUi();flushDefenseUi(true);}
  function toggleDefenseIntel(force){
    const d=mini.defense;if(!d)return;const opening=typeof force==="boolean"?force:!d.intelOpen;
    if(opening){
      clearDefensePlacementMode();defenseCloseContextSurfaces("intel",{sync:false});d.intelOpen=true;completeDefenseSchoolLesson("intel");
      // Threat intel is a deliberate thinking surface. If combat is moving, pause it rather than
      // making the player read while balloons keep leaking. Closing it never surprise-resumes.
      if(defenseIsSimulating(d)){defenseSetPhase(d,DEFENSE_PHASES.PAUSED,{resumePhase:d.phase});d.intelPausedByOpen=true;d.autoPaused=false;setDefenseMessage("THREATS PAUSED","Read the cards. Close them when you're ready.");}
    }else{
      d.intelOpen=false;if(d.intelPausedByOpen){d.intelPausedByOpen=false;setDefenseMessage("THREATS CLOSED","The trail stays paused until you press play.");}
    }
    syncDefenseOverlayState();markDefenseUi();flushDefenseUi(true);
  }

  function defenseEnemyKey(entry){if(!entry)return"puff";if(typeof entry==="string")return entry;return entry.bossId?`boss:${entry.bossId}`:(entry.type||"puff");}
  function defenseEnemyData(key){if(String(key).startsWith("boss:")){const boss=DEFENSE_BOSSES.find(item=>item.id===String(key).slice(5))||DEFENSE_BOSSES[0];return{...boss,key,name:boss.name,icon:boss.icon||"!",trait:boss.trait||"BOSS",counter:boss.counter||"FOCUS FIRE",intel:boss.hint};}const enemy=DEFENSE_ENEMIES[key]||DEFENSE_ENEMIES.puff;return{...enemy,key,name:enemy.name,icon:enemy.icon||"○",trait:enemy.trait||"THREAT",counter:enemy.counter||"ANY RIZO",intel:enemy.intel||"Read the trail and adjust your field."};}
  function defenseRecordEnemyStat(bucket,key,amount=1){const stats=mini.defense?.enemyStats;if(!stats||!stats[bucket])return;const id=String(key||"puff");stats[bucket][id]=(Number(stats[bucket][id])||0)+amount;}
  function defenseCountsFromEntries(entries){const counts=new Map();for(const entry of entries||[]){const key=defenseEnemyKey(entry);counts.set(key,(counts.get(key)||0)+1);}return counts;}
  function defenseIntelCounts(){const d=mini.defense;if(!d)return new Map();if(defenseIsActiveWave(d)){const counts=defenseCountsFromEntries(d.spawnQueue);for(const enemy of d.enemies){if(enemy.dead)continue;const key=enemy.bossId?`boss:${enemy.bossId}`:enemy.type;counts.set(key,(counts.get(key)||0)+1);}return counts;}return defenseWavePreviewData(d.wave+1).counts;}
  function defenseCounterReadiness(counts){const towers=mini.defense?.towers||[],keys=[...counts.keys()],needs={speed:keys.some(key=>["fleet","storm","boss:apex"].includes(key)),armor:keys.some(key=>["shell","frost","brick","lead","boss:crown"].includes(key)),veil:keys.some(key=>["shade","ghost"].includes(key)),swarm:keys.some(key=>key==="split"),support:keys.some(key=>["relay","mender"].includes(key))};const ready={speed:towers.some(t=>t.doctrine==="control"||["frost","moss","bubblegum","retro"].includes(t.pet.variant||t.pet.hiddenVariant)),armor:towers.some(t=>t.doctrine==="power"||["diamond","obsidian","glitch"].includes(t.pet.variant||t.pet.hiddenVariant)),veil:towers.some(t=>t.upgrade>=2||["shadow","aurora","glitch"].includes(t.pet.variant||t.pet.hiddenVariant)),swarm:towers.some(t=>["violet","diamond","obsidian","moss"].includes(t.pet.variant||t.pet.hiddenVariant)||t.doctrine==="power"),support:towers.some(t=>t.targetMode==="strong"||t.doctrine==="control"||["shadow","diamond","obsidian","violet"].includes(t.pet.variant||t.pet.hiddenVariant))};return{needs,ready,missing:Object.keys(needs).filter(key=>needs[key]&&!ready[key])};}
  function defenseMapIntel(){const d=mini.defense;if(!d)return{title:"NO WORLD",copy:""};const weather=d.map.weather;return weather==="ash"?{title:"ASH VEIL",copy:"Ash periodically camouflages the trail. Awakened and detector Rizos keep sight."}:weather==="moon"?{title:"MOONLIGHT WINDOW",copy:"Moonlight periodically exposes camo and phase threats for every Rizo."}:weather==="storm"?{title:"LIGHTNING SURGE",copy:"Every threat accelerates during the storm pulse. Keep FIRST and CONTROL coverage."}:weather==="blizzard"?{title:"WHITEOUT",copy:"Most Rizo ranges shrink. Frost and Aurora hold steady."}:weather==="eclipse"?{title:"ECLIPSE VEIL",copy:"The eclipse periodically camouflages every threat."}:{title:"CLEAR TRAIL",copy:"No world hazard. Learn the enemy identities and build clean coverage."};}
  function updateDefenseIntelTray(){
    const d=mini.defense,button=$("#defenseIntelButton"),count=$("#defenseIntelCount"),tray=$("#defenseIntelTray");if(!d||!button||!tray)return;const counts=defenseIntelCounts(),ordered=[...counts.entries()].sort((a,b)=>(DEFENSE_THREAT_PRIORITY[b[0]]||0)-(DEFENSE_THREAT_PRIORITY[a[0]]||0));if(count)count.textContent=String(ordered.length);button.classList.toggle("warning",ordered.some(([key])=>!["puff","fleet"].includes(key)));button.setAttribute("aria-expanded",String(Boolean(d.intelOpen)));tray.hidden=!d.intelOpen;if(!d.intelOpen){d.intelTraySignature="";return;}
    const cards=ordered.map(([key,total])=>{const data=defenseEnemyData(key);return`<article class="defense-intel-card v79" data-intel-type="${escapeHTML(key)}"><span style="--intel-color:${escapeHTML(data.color||"#ff5b68")}">${escapeHTML(data.icon)}</span><div><small>${total}× • ${escapeHTML(data.trait||"THREAT")}</small><b>${escapeHTML(data.name.replace(" BALLOON",""))}</b><em>USE ${escapeHTML(String(data.counter||"ANY RIZO").split(" • ").slice(0,2).join(" / "))}</em></div></article>`;}).join("");
    const markup=`<div class="defense-intel-head"><div class="defense-sheet-title"><span>${defenseUiIcon("intel")}</span><div><small>WHAT'S COMING</small><b>${defenseIsActiveWave(d)?"ON THE TRAIL":`WAVE ${d.wave+1}`}</b></div></div><button type="button" class="defense-sheet-close-inline" data-defense-toggle-intel aria-label="Close threats">${defenseUiIcon("close")}</button></div><div class="defense-intel-list">${cards||`<p>Nothing strange yet.</p>`}</div><button type="button" class="defense-intel-more" data-defense-field-guide="threats">FULL GUIDE</button>`;
    const signature=`${d.mapId}|${d.phase}|${[...counts.entries()].map(([key,total])=>`${key}:${total}`).join("|")}`;if(signature!==d.intelTraySignature){d.intelRenderCount=(d.intelRenderCount||0)+1;tray.innerHTML=markup;d.intelTraySignature=signature;}
  }


  function defenseWavePreviewData(wave){
    const previous=mini.defense.waveAnnouncement,plan=defenseWavePlan(wave),announcement=mini.defense.waveAnnouncement;mini.defense.waveAnnouncement=previous;const counts=new Map();
    for(const entry of DefenseCore.flattenPackets(plan.packets)){const key=typeof entry==="string"?entry:(entry.bossId?`boss:${entry.bossId}`:entry.type);counts.set(key,(counts.get(key)||0)+1);}return{plan,counts,announcement};
  }
  function updateDefenseWavePreview(){
    const d=mini.defense,host=$("#defenseWavePreview");if(!d||!host)return;const mode=store.settings.waveIntel||"simple";if(defenseIsActiveWave(d)||mode==="off"){host.hidden=true;host.style.pointerEvents="none";return;}
    const next=d.wave+1,{plan,counts}=defenseWavePreviewData(next),ordered=[...counts.entries()].sort((a,b)=>(DEFENSE_THREAT_PRIORITY[b[0]]||0)-(DEFENSE_THREAT_PRIORITY[a[0]]||0));
    host.style.pointerEvents="none";host.hidden=false;let markup;
    if(mode==="full"){const shown=ordered.slice(0,3),chips=shown.map(([type,count])=>{const data=defenseEnemyData(type),label=type.startsWith("boss:")?"BOSS":String(data.trait||data.name).replace("BALLOON","").split(" ").slice(0,2).join(" ");return`<i data-preview-type="${escapeHTML(type)}"><span class="defense-threat-mini ${escapeHTML(data.className||"")}"></span><b>${count}×</b>${escapeHTML(label)}</i>`;}).join(""),total=DefenseCore.flattenPackets(plan.packets).length;markup=`<small>NEXT • WAVE ${next}</small><b>${total} THREATS</b><span>${chips}</span>`;}
    else{const top=ordered[0]?.[0],data=top?defenseEnemyData(top):null,boss=ordered.some(([key])=>key.startsWith("boss:")),heavy=ordered.some(([key])=>["brick","lead","shell"].includes(key)),fast=ordered.some(([key])=>["fleet","storm"].includes(key)),hidden=ordered.some(([key])=>["shade","ghost"].includes(key)),support=ordered.some(([key])=>["relay","mender"].includes(key)),hint=boss?"BOSS INCOMING":support?"SUPPORT PACK":heavy?"HEAVY ARMOR":hidden?"HIDDEN THREATS":fast?"FAST PRESSURE":plan.modifier&&plan.modifier!=="normal"?String(plan.modifier).toUpperCase()+" WAVE":"READ THE ROAD";markup=`<small>NEXT • WAVE ${next}</small><b>${escapeHTML(plan.announcement?.title||hint)}</b><em>${escapeHTML(plan.announcement?.copy||(data?.counter||"BUILD CLEAN"))}</em>`;}
    const signature=`${mode}|${next}|${markup}`;if(signature!==d.wavePreviewSignature){host.innerHTML=markup;d.wavePreviewSignature=signature;}
  }
  function updateDefenseLiveStatus(){
    const d=mini.defense,host=$("#defenseLiveStatus"),left=$("#defenseThreatsLeft"),bar=$("#defenseWaveProgress"),bossHost=$("#defenseBossBar"),bossName=$("#defenseBossName"),bossHealth=$("#defenseBossHealth"),bossPercent=$("#defenseBossPercent"),world=$("#defenseWorld");if(!d||!host||!world)return;
    const live=defenseIsActiveWave(d),active=d.enemies.filter(enemy=>!enemy.dead),remaining=d.spawnQueue.length+d.childSpawnQueue.length+active.length,total=Math.max(1,d.waveTotal||remaining+d.waveResolved),progress=clamp((d.waveResolved/total)*100),lead=active.reduce((best,enemy)=>Math.max(best,enemy.progress||0),0),boss=active.filter(enemy=>enemy.bossId).sort((a,b)=>b.progress-a.progress)[0]||null;
    host.hidden=!live;if(left)left.textContent=`${remaining} ${remaining===1?"THREAT":"THREATS"} LEFT`;if(bar)bar.style.width=`${progress}%`;
    world.classList.toggle("gate-alert",live&&lead>=.7);world.classList.toggle("gate-critical",live&&lead>=.88);defenseApplyRenderTier(d,d.renderTier);world.classList.toggle("boss-active",Boolean(boss));
    if(bossHost){bossHost.hidden=!boss;if(boss){const data=DEFENSE_BOSSES.find(item=>item.id===boss.bossId);if(bossName)bossName.textContent=data?.name||"BOSS";const pct=clamp(boss.hp/Math.max(1,boss.maxHp)*100);if(bossHealth)bossHealth.style.width=`${pct}%`;if(bossPercent){if(boss.telegraphKind){const tele=DEFENSE_BOSS_TELEGRAPHS[boss.telegraphKind],breakPct=Math.round((boss.telegraphDisruption||0)*100);bossPercent.textContent=tele?.interruptible?`BREAK ${breakPct}%`:"UNSTOPPABLE";}else bossPercent.textContent=`${Math.ceil(pct)}%`;}}}
  }
  async function toggleDefenseFullscreen(){
    const el=$(".defense-shell")||document.documentElement;
    try{
      if(!document.fullscreenElement&&!document.webkitFullscreenElement){
        const request=el.requestFullscreen||el.webkitRequestFullscreen;
        if(!request){setDefenseMessage("FULLSCREEN UNAVAILABLE","Your browser doesn't support fullscreen here — try rotating manually for a wider map.");return;}
        await request.call(el);
        try{await screen.orientation?.lock?.("landscape");}catch(orientationError){/* not all browsers allow locking outside a PWA */}
        scheduleDefenseTowerGeometrySync();
        queueMiniTimeout(scheduleDefenseTowerGeometrySync,180);
      }else{
        (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);
        try{screen.orientation?.unlock?.();}catch(orientationError){}
        scheduleDefenseTowerGeometrySync();
        queueMiniTimeout(scheduleDefenseTowerGeometrySync,180);
      }
    }catch(error){setDefenseMessage("FULLSCREEN UNAVAILABLE","Your browser blocked fullscreen here — try rotating manually for a wider map.");}
  }
  function toggleDefensePause(force){const d=mini.defense;if(!d||!defenseIsActiveWave(d))return;const shouldPause=typeof force==="boolean"?force:d.phase!==DEFENSE_PHASES.PAUSED;if(shouldPause){cancelDefenseTransientInput("pause");defenseSetPhase(d,DEFENSE_PHASES.PAUSED,{resumePhase:d.phase});}else defenseSetPhase(d,d.resumePhase||DEFENSE_PHASES.COMBAT);d.autoPaused=false;markDefenseUi();flushDefenseUi(true);writeDefenseCheckpoint(true,"pause");setDefenseMessage(shouldPause?"PAUSED":"PLAYING",shouldPause?"The simulation is frozen. Combat actions remain locked.":"The packet scheduler is moving again.");sfx("ui");}
  function pauseDefenseForInterruption(){const d=mini.defense;if(!mini.active||mini.mode!=="defense"||!d||!defenseIsSimulating(d))return false;cancelDefenseTransientInput("interruption");defenseSetPhase(d,DEFENSE_PHASES.PAUSED,{resumePhase:d.phase});d.autoPaused=true;markDefenseUi();return true;}
  function surfaceDefenseInterruptionPause(){const d=mini.defense;if(!mini.active||mini.mode!=="defense"||!d?.autoPaused)return false;d.autoPaused=false;flushDefenseUi(true);setDefenseMessage("AUTO-PAUSED • WELCOME BACK","The trail stayed frozen while RIZO.GAME was away. Tap ▶ when you are ready.");return true;}

  function cycleDefenseSpeed(){const d=mini.defense;if(!d)return;d.flowEaseUntilReal=0;const values=[.5,1,2],index=values.indexOf(d.speed);d.speed=values[(index+1)%values.length];defenseApplyRenderTier(d);markDefenseUi();updateDefenseHud();writeDefenseCheckpoint(true,"speed");setDefenseMessage(`${d.speed===.5?"SLOW MOTION":d.speed===2?"FAST FORWARD":"NORMAL SPEED"}`,d.speed===2?"Fast-forward stays readable: packet boundaries briefly ease to 1× unless you change speed yourself.":"Simulation speed changes. Music stays readable.");sfx("ui");}
  const DEFENSE_TRAIL_HALF_WIDTH=.033;
  const DEFENSE_PLACEMENT_SNAP_PX=9;
  function defensePlacementGeometry(){
    const world=$("#defenseWorld"),rect=world?.getBoundingClientRect(),width=Math.max(280,rect?.width||390),height=Math.max(280,rect?.height||390),short=Math.min(width,height);
    const footprintPx=clamp(short*.079,24,31),safetyPx=clamp(short*.0065,2,3),visualHalfPx=clamp(short*.096,30,39),visualTopPx=clamp(short*.13,40,52),visualBottomPx=clamp(short*.071,22,29);
    return{rect,width,height,short,footprintPx,safetyPx,footprint:footprintPx/short,pathHalf:DEFENSE_TRAIL_HALF_WIDTH,pathClearance:DEFENSE_TRAIL_HALF_WIDTH+(footprintPx+safetyPx)/short,towerGap:(footprintPx*2+safetyPx*2)/short,obstaclePad:(footprintPx+safetyPx)/short,bounds:{left:(visualHalfPx+2)/width,right:1-(visualHalfPx+2)/width,top:(visualTopPx+2)/height,bottom:1-(visualBottomPx+2)/height},snap:DEFENSE_PLACEMENT_SNAP_PX/short};
  }
  function defensePlacementBounds(){return defensePlacementGeometry().bounds;}
  function defenseArenaPoint(event,{lift=false,strict=true}={}){
    const world=$("#defenseWorld");if(!world)return null;const rect=world.getBoundingClientRect(),landscape=matchMedia("(max-height:650px) and (orientation:landscape)").matches,touch=event.pointerType==="touch"||event.pointerType==="pen",liftPx=lift&&touch?clamp(Math.min(rect.width,rect.height)*.135,42,56):0,clientX=event.clientX-(landscape?liftPx:0),clientY=event.clientY-(landscape?0:liftPx),rawX=(clientX-rect.left)/Math.max(1,rect.width),rawY=(clientY-rect.top)/Math.max(1,rect.height),margin=DEFENSE_PLACEMENT_SNAP_PX/Math.max(1,Math.min(rect.width,rect.height));
    if(strict&&(rawX< -margin||rawX>1+margin||rawY< -margin||rawY>1+margin))return null;
    return{x:clamp(rawX,0,1),y:clamp(rawY,0,1),rawX,rawY,rect,clientX,clientY,liftPx};
  }
  function nearestDefensePathPoint(x,y){let best={distance:Infinity,x:0,y:0,segment:null,t:0,progress:0};const metrics=mini.defense.pathMetrics;for(const segment of metrics.segments){const{a,b}=segment,dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy,t=len2?clamp(((x-a.x)*dx+(y-a.y)*dy)/len2,0,1):0,px=a.x+dx*t,py=a.y+dy*t,distance=Math.hypot(x-px,y-py),progress=metrics.total?clamp((segment.start+t*segment.length)/metrics.total,0,1):0;if(distance<best.distance)best={distance,x:px,y:py,segment,t,progress};}return best;}
  function distanceToDefensePath(x,y){return nearestDefensePathPoint(x,y).distance;}
  function defenseObstacleAt(x,y,geometry=defensePlacementGeometry()){let best=null;for(const zone of mini.defense.map.blockedZones||[]){const distance=Math.hypot(x-zone.x,y-zone.y),required=zone.r+geometry.obstaclePad;if(distance<required&&(!best||distance-required<best.distance-best.required))best={zone,distance,required};}return best;}
  function pointInDefenseObstacle(x,y){return Boolean(defenseObstacleAt(x,y));}
  function defensePlacementIntersectsOverlay(){return false;}
  function defensePlacementEvaluation(x,y,ignoreTower=null){
    const geometry=defensePlacementGeometry(),bounds=geometry.bounds;
    if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return{valid:false,code:"edge",reason:"KEEP THE WHOLE RIZO ON THE FIELD",geometry};
    const path=nearestDefensePathPoint(x,y);if(path.distance<geometry.pathClearance)return{valid:false,code:"trail",reason:"FOOTPRINT TOUCHES THE TRAIL",geometry,path,distance:path.distance,required:geometry.pathClearance};
    const obstacle=defenseObstacleAt(x,y,geometry);if(obstacle)return{valid:false,code:"obstacle",reason:"A MAP PROP BLOCKS THIS FOOTPRINT",geometry,obstacle,distance:obstacle.distance,required:obstacle.required};
    let nearestTower=null;for(const tower of mini.defense.towers){if(tower.id===ignoreTower)continue;const distance=Math.hypot(tower.x-x,tower.y-y);if(distance<geometry.towerGap&&(!nearestTower||distance<nearestTower.distance))nearestTower={tower,distance};}
    if(nearestTower)return{valid:false,code:"tower",reason:"TOO CLOSE TO ANOTHER RIZO",geometry,nearestTower,distance:nearestTower.distance,required:geometry.towerGap};
    return{valid:true,code:"open",reason:"OPEN GRASS",geometry,path,distance:path.distance,required:geometry.pathClearance,clearance:path.distance-geometry.pathClearance};
  }
  function defensePlacementPushCandidate(x,y,evaluation){
    const g=evaluation.geometry||defensePlacementGeometry(),candidates=[];
    if(evaluation.code==="edge")candidates.push({x:clamp(x,g.bounds.left,g.bounds.right),y:clamp(y,g.bounds.top,g.bounds.bottom)});
    if(evaluation.code==="trail"&&evaluation.path){const p=evaluation.path,dx=x-p.x,dy=y-p.y,length=Math.hypot(dx,dy),segment=p.segment||{a:{x:0,y:0},b:{x:1,y:0}},sx=segment.b.x-segment.a.x,sy=segment.b.y-segment.a.y,required=g.pathClearance+.002;if(length>.0001)candidates.push({x:p.x+dx/length*required,y:p.y+dy/length*required});else{const sl=Math.max(.0001,Math.hypot(sx,sy)),nx=-sy/sl,ny=sx/sl;candidates.push({x:p.x+nx*required,y:p.y+ny*required},{x:p.x-nx*required,y:p.y-ny*required});}}
    if(evaluation.code==="obstacle"&&evaluation.obstacle){const{zone,required}=evaluation.obstacle,dx=x-zone.x,dy=y-zone.y,length=Math.hypot(dx,dy)||1;candidates.push({x:zone.x+dx/length*(required+.002),y:zone.y+dy/length*(required+.002)});}
    if(evaluation.code==="tower"&&evaluation.nearestTower){const{tower}=evaluation.nearestTower,dx=x-tower.x,dy=y-tower.y,length=Math.hypot(dx,dy)||1;candidates.push({x:tower.x+dx/length*(g.towerGap+.002),y:tower.y+dy/length*(g.towerGap+.002)});}
    return candidates;
  }
  function resolveDefensePlacement(x,y,ignoreTower=null,{snapPx=DEFENSE_PLACEMENT_SNAP_PX}={}){
    const direct=defensePlacementEvaluation(x,y,ignoreTower);if(direct.valid)return{point:{x,y},evaluation:direct,snapped:false,raw:{x,y},snapDistance:0};
    const geometry=direct.geometry,maxDistance=Math.max(0,Number(snapPx)||0)/geometry.short,candidates=defensePlacementPushCandidate(x,y,direct),steps=4,angles=24;
    for(let ring=1;ring<=steps;ring+=1){const radius=maxDistance*ring/steps;for(let i=0;i<angles;i+=1){const angle=Math.PI*2*i/angles;candidates.push({x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius});}}
    let best=null;for(const candidate of candidates){const point={x:clamp(candidate.x,0,1),y:clamp(candidate.y,0,1)},distance=Math.hypot(point.x-x,point.y-y);if(distance>maxDistance+.0001)continue;const evaluation=defensePlacementEvaluation(point.x,point.y,ignoreTower);if(!evaluation.valid)continue;const score=distance+Math.max(0,.003-(evaluation.clearance||0))*.2;if(!best||score<best.score)best={point,evaluation,snapped:distance>.0005,raw:{x,y},snapDistance:distance,score};}
    return best||{point:{x,y},evaluation:direct,snapped:false,raw:{x,y},snapDistance:0};
  }
  function isValidDefensePlacement(x,y,ignoreTower=null){return defensePlacementEvaluation(x,y,ignoreTower).valid;}
  function defensePlacementReasonCopy(evaluation){return evaluation?.reason||"THAT SPOT IS BLOCKED";}
  function defensePlacementRangeForRow(row){const type=defenseStructureType(row);return type==="beacon"?DefenseCore.beaconSupport(0).radius:type==="factory"?.11:defenseTowerStats(row.pet,0).range;}
  function ensureDefensePlacementPreview(row){const preview=$("#defensePlacementPreview");if(!preview||!row)return preview;const signature=row.pet.id;if(preview.dataset.petId!==signature){preview.dataset.petId=signature;preview.innerHTML=`<span class="defense-placement-range"></span><span class="defense-placement-foot"></span><b class="defense-placement-label">OPEN GRASS</b>`;}const g=defensePlacementGeometry();preview.style.setProperty("--placement-range",`${Math.max(64,defensePlacementRangeForRow(row)*2*g.width)}px`);preview.style.setProperty("--placement-footprint",`${g.footprintPx*2}px`);return preview;}
  function defenseCoverage(x,y,range){let count=0;for(let i=0;i<80;i++){const p=defensePointAt((i+.5)/80);if(Math.hypot(p.x-x,p.y-y)<=range)count++;}return count/80;}
  function updateDefensePlacementPreview(result,row,{show=true}={}){const preview=ensureDefensePlacementPreview(row);if(!preview)return;preview.hidden=!show;if(!show)return;const point=result?.point||result?.raw;if(!point)return;const valid=Boolean(result?.evaluation?.valid),mapBond=valid?defenseMapBondForTower({x:point.x,y:point.y},mini.defense,{preview:true}):null,baseRange=defensePlacementRangeForRow(row),previewRange=baseRange*(mapBond?.range||1),geometry=result?.evaluation?.geometry||defensePlacementGeometry();preview.style.left=`${point.x*100}%`;preview.style.top=`${point.y*100}%`;preview.style.setProperty("--placement-range",`${Math.max(64,previewRange*2*geometry.width)}px`);preview.classList.toggle("valid",valid);preview.classList.toggle("invalid",!valid);preview.classList.toggle("snapped",Boolean(result?.snapped));preview.classList.toggle("map-bond-preview",Boolean(mapBond));preview.dataset.reason=result?.evaluation?.code||"blocked";preview.dataset.mapBond=mapBond?.kind||"";preview.dataset.mapBondTier=mapBond?.tier||"";const label=preview.querySelector(".defense-placement-label"),type=defenseStructureType(row);if(label){if(!valid)label.textContent=defensePlacementReasonCopy(result?.evaluation);else if(type==="factory"){const econ=DefenseCore.factoryEconomy({upgradeLevel:0,wave:mini.defense?.currentWave||0,goldenTowerCount:defenseAwakenedGoldenCount()});label.textContent=`PRINTS +${econ.payout} / ${econ.interval.toFixed(1)}S LIVE`; }else if(type==="beacon"){const support=DefenseCore.beaconSupport(0);label.textContent=`FIELD • +${Math.round((support.rateMultiplier-1)*100)}% SPEED`; }else label.textContent=mapBond?.preview||`${Math.round(defenseCoverage(point.x,point.y,previewRange)*100)}% OF TRAIL IN REACH`;}}
  function hideDefensePlacementPreview(){const preview=$("#defensePlacementPreview");if(preview){preview.hidden=true;preview.classList.remove("valid","invalid","snapped");}}
  function cancelDefenseTransientInput(reason="system-cancel") {
    const d=mini.defense;let cancelled=false;if(d?.gateFlameArmed){d.gateFlameArmed=false;$(".defense-shell")?.classList.remove("gate-flame-aiming");markDefenseUi();cancelled=true;}
    const drag = mini?.defenseDrag;
    if (!drag){if(d&&cancelled)d.lastInputCancelReason=reason;return cancelled;}
    try { drag.source?.releasePointerCapture?.(drag.pointerId); } catch (error) {}
    drag.ghost?.remove();
    drag.source?.classList.remove("drag-source");
    $("#defenseWorld")?.classList.remove("placement-valid", "placement-invalid");
    hideDefensePlacementPreview();
    mini.defenseDrag = null;
    if (d) d.lastInputCancelReason = reason;
    return true;
  }
  function defenseBenchAxis(){return matchMedia("(max-height:650px) and (orientation:landscape)").matches?"vertical":"horizontal";}
  function defenseDragIntent(dx,dy){const axis=defenseBenchAxis(),ax=Math.abs(dx),ay=Math.abs(dy);if(axis==="horizontal"){if(ax>9&&ax>ay*1.12)return"scroll";if(ay>8&&ay>=ax*.72)return dy<0?"deploy":"wait";}else{if(ay>9&&ay>ax*1.12)return"scroll";if(ax>8&&ax>=ay*.72)return dx<0?"deploy":"wait";}return"wait";}

  function setDefensePlacementMode(row,cost){
    const d=mini.defense;d.pendingPlacement={row,cost};d.benchOpen=true;d.fieldMenuOpen=false;
    $("#defenseWorld")?.classList.add("placement-mode");syncDefenseMapMechanicEdges();hideDefensePlacementPreview();updateDefenseRoster();updateDefenseHud();
    setDefenseMessage(`PLACE ${row.pet.name}`,defenseStructureType(row)==="factory"?"Factory takes a field slot and cannot attack. Survive long enough and the shirts pay you back.":defenseStructureType(row)==="beacon"?"Its visible field accelerates nearby Rizos and later powers their hits. Position the circle, not the trail.":"Drag toward the field or tap exact grass. Green means the full footprint clears the trail.");haptic(8);
  }

  function clearDefensePlacementMode(){
    if(!mini.defense)return;mini.defense.pendingPlacement=null;hideDefensePlacementPreview();$("#defenseWorld")?.classList.remove("placement-mode","placement-valid","placement-invalid");updateDefenseRoster();updateDefenseHud();
  }

  function selectDefenseRosterPet(row){
    if(!row||!mini.defense)return false;
    const d=mini.defense;if(!defensePlacementAllowed(d)){setDefenseMessage("FIELD PAUSED","Resume before placing reinforcements.");sfx("no");return false;}
    if(d.pendingPlacement?.row?.pet?.id===row.pet.id){clearDefensePlacementMode();setDefenseMessage("PLACEMENT CANCELLED","Tap another Rizo when you are ready.");return false;}
    if(d.towers.length>=d.maxTowers){toast("THE FIELD IS FULL");sfx("no");return false;}
    if(defenseContractRule("unique",d)&&d.towers.some(tower=>tower.petId===row.pet.id)){setDefenseMessage("CONTRACT • NO COPIES",`${row.pet.name} already stands on this field.`);sfx("no");return false;}
    const cost=defenseDeployCost(row);
    if(d.cash<cost){toast(`NEED ${cost} DEFENSE COINS`);sfx("no");return false;}
    closeDefenseTowerPanel();
    setDefensePlacementMode(row,cost);
    return true;
  }
  function beginDefenseDrag(event,row){
    const d=mini.defense;if(!d||!row)return;if(!defensePlacementAllowed(d)){setDefenseMessage("FIELD PAUSED","Resume before placing reinforcements. Upgrades and powers stay available.");return;}if(d.towers.length>=d.maxTowers){toast("THE FIELD IS FULL");return;}if(defenseContractRule("unique",d)&&d.towers.some(tower=>tower.petId===row.pet.id)){setDefenseMessage("CONTRACT • NO COPIES",`${row.pet.name} already stands on this field.`);return;}const cost=defenseDeployCost(row);if(d.cash<cost){toast(`NEED ${cost} DEFENSE COINS`);return;}
    const source=event.target.closest("[data-defense-roster-id]"),roster=source?.closest(".defense-roster");
    if(event.cancelable)event.preventDefault();
    try{source?.setPointerCapture?.(event.pointerId);}catch(error){}
    mini.defenseDrag={pointerId:event.pointerId,pointerType:event.pointerType||"touch",row,cost,ghost:null,source,roster,scrollStartX:roster?.scrollLeft||0,scrollStartY:roster?.scrollTop||0,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,active:false,scrolling:false,moved:false,result:null};if(event.pointerType==="mouse"){activateDefenseDrag(mini.defenseDrag,event);moveDefenseDrag(event);}haptic(6);
  }

  function activateDefenseDrag(drag,event){
    if(!drag||drag.active)return;drag.active=true;drag.moved=true;const ghost=document.createElement("div");ghost.className="defense-drag-ghost";ghost.innerHTML=`${petMarkup({pet:drag.row.pet,extraClass:"defense-drag-rizo",context:"thumbnail",label:drag.row.pet.name})}<i class="defense-drag-foot"></i><b class="defense-drag-reason">MOVE TO OPEN GRASS</b>`;document.body.appendChild(ghost);drag.ghost=ghost;drag.source?.classList.add("drag-source");try{drag.source?.setPointerCapture?.(event.pointerId);}catch(error){}$("#defenseWorld")?.classList.add("placement-mode");ensureDefensePlacementPreview(drag.row);
  }
  function moveDefenseDrag(event){
    const drag=mini.defenseDrag;if(!drag||event.pointerId!==drag.pointerId)return;drag.lastX=event.clientX;drag.lastY=event.clientY;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY,distance=Math.hypot(dx,dy);
    if(event.cancelable)event.preventDefault();
    if(drag.scrolling){const axis=defenseBenchAxis();if(drag.roster){if(axis==="horizontal")drag.roster.scrollLeft=drag.scrollStartX-dx;else drag.roster.scrollTop=drag.scrollStartY-dy;}return;}
    if(!drag.active){if(distance<=6)return;const intent=defenseDragIntent(dx,dy);if(intent==="scroll"){drag.scrolling=true;if(drag.roster){const axis=defenseBenchAxis();if(axis==="horizontal")drag.roster.scrollLeft=drag.scrollStartX-dx;else drag.roster.scrollTop=drag.scrollStartY-dy;}return;}if(intent!=="deploy"){if(distance<18)return;activateDefenseDrag(drag,event);}else activateDefenseDrag(drag,event);}
    const raw=defenseArenaPoint(event,{lift:true,strict:true}),world=$("#defenseWorld");if(!raw){drag.result=null;drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;drag.ghost.classList.remove("valid","snapped");drag.ghost.classList.add("invalid");const reason=drag.ghost.querySelector(".defense-drag-reason");if(reason)reason.textContent="MOVE INTO THE FIELD";hideDefensePlacementPreview();world?.classList.remove("placement-valid");world?.classList.add("placement-invalid");return;}
    const result=resolveDefensePlacement(raw.x,raw.y,null,{snapPx:DEFENSE_PLACEMENT_SNAP_PX});drag.result=result;const point=result.point,screenX=raw.rect.left+point.x*raw.rect.width,screenY=raw.rect.top+point.y*raw.rect.height,g=result.evaluation.geometry;drag.ghost.style.left=`${screenX}px`;drag.ghost.style.top=`${screenY}px`;drag.ghost.style.setProperty("--placement-range",`${Math.max(64,defensePlacementRangeForRow(drag.row)*2*g.width)}px`);drag.ghost.style.setProperty("--placement-footprint",`${g.footprintPx*2}px`);drag.ghost.classList.toggle("valid",Boolean(result.evaluation.valid));drag.ghost.classList.toggle("invalid",!result.evaluation.valid);drag.ghost.classList.toggle("snapped",Boolean(result.snapped));const reason=drag.ghost.querySelector(".defense-drag-reason");if(reason)reason.textContent=result.evaluation.valid?(result.snapped?"EDGE SNAP":"DROP TO PLACE"):defensePlacementReasonCopy(result.evaluation);updateDefensePlacementPreview(result,drag.row);world?.classList.toggle("placement-valid",Boolean(result.evaluation.valid));world?.classList.toggle("placement-invalid",!result.evaluation.valid);
  }

  function endDefenseDrag(event,cancelled=false){
    const drag=mini.defenseDrag;if(!drag||event.pointerId!==drag.pointerId)return;const tap=!cancelled&&!drag.active&&!drag.scrolling&&Math.hypot((event.clientX??drag.lastX)-drag.startX,(event.clientY??drag.lastY)-drag.startY)<=8,result=drag.result,valid=!cancelled&&drag.active&&result?.evaluation?.valid;drag.ghost?.remove();drag.source?.classList.remove("drag-source");try{if(drag.source?.hasPointerCapture?.(drag.pointerId))drag.source.releasePointerCapture(drag.pointerId);}catch(error){}$("#defenseWorld")?.classList.remove("placement-valid","placement-invalid");hideDefensePlacementPreview();mini.defenseDrag=null;if(drag.scrolling)return;if(valid)placeDefenseTower(drag.row,result.point.x,result.point.y,drag.cost);else if(tap)setDefensePlacementMode(drag.row,drag.cost);else if(!cancelled&&drag.active){setDefensePlacementMode(drag.row,drag.cost);setDefenseMessage("KEEP PLACEMENT ACTIVE",defensePlacementReasonCopy(result?.evaluation));sfx("no");haptic([10,14,10]);}
  }

  function placeDefenseTower(row,x,y,cost){
    const d=mini.defense;if(!defensePlacementAllowed(d)){setDefenseMessage("FIELD PAUSED","Resume before placing reinforcements.");sfx("no");return false;}if(d.towers.length>=d.maxTowers||!isValidDefensePlacement(x,y)||d.cash<cost||defenseContractRule("unique",d)&&d.towers.some(tower=>tower.petId===row.pet.id))return false;
    const structureType=defenseStructureType(row);d.cash-=cost;d.cashWriteCount=(d.cashWriteCount||0)+1;const copies=d.towers.filter(t=>t.petId===row.pet.id).length+1,tower={id:`tower-${d.nextId++}`,petId:row.pet.id,pet:row.pet,source:row.source,rosterIndex:row.rosterIndex,structureType,copyNumber:copies,x,y,upgrade:0,cost,spent:cost,cooldown:0,kills:0,damage:0,abilityReadyAt:0,overclockUntil:0,rangeDebuffUntil:0,targetMode:["obsidian","diamond"].includes(row.pet.variant)?"strong":"first",doctrine:null,shots:0,placedAt:d.clock,placedAtReal:defenseRealNow(d),openingPerkApplied:false,targetId:null,retargetAt:0,retargetAtReal:0,totalProduced:0,nextProductionAt:0,factoryCleanCycles:0,factoryLivesSnapshot:d.lives,factoryLastInterval:0};if(structureType==="factory"){const econ=defenseFactoryEconomy(tower,d);tower.nextProductionAt=d.clock+econ.interval;tower.factoryLastInterval=econ.interval;}d.towers.push(tower);d.usedPetIds.add(row.pet.id);completeDefenseSchoolLesson("route",{silent:true});completeDefenseSchoolLesson("placement");clearDefensePlacementMode();refreshDefenseMapBondVisuals();refreshDefenseSupportVisuals(d);defenseFeelPulseTower(tower,"deployed",420);updateDefenseRoster();updateDefenseHud();
    if(structureType==="factory")setDefenseMessage(`FACTORY ${copies} OPEN`,"No bullets. Shirts become coins only while a wave is live. Greed has to survive first.");else if(structureType==="beacon")setDefenseMessage(`BEACON ${copies} LIT`,`Rizos inside the light attack ${Math.round((DefenseCore.beaconSupport(0).rateMultiplier-1)*100)}% faster. The circle shows exactly who benefits.`);else setDefenseMessage(defenseIsUniversalPet(row.pet)?`${row.pet.name} IS READY.`:`${row.pet.name} COPY ${copies} IS READY.`,defenseIsUniversalPet(row.pet)?"A universal field tool. Tap it to level up, aim, or choose an upgrade path.":`Tap it any time to level up, aim, or use its power.`);
    markDefenseUi({roster:true});writeDefenseCheckpoint(true,"placement");sfx(structureType?"coin":"defense-deploy");defenseHaptic("deploy");return true;
  }

  function applyDefenseTowerGeometry(tower,node=tower?.node){
    const world=$("#defenseWorld");
    if(!tower||!node||!world)return false;
    const stats=defenseCombatStats(tower),structureType=defenseStructureType(tower),fieldRange=structureType==="beacon"?DefenseCore.beaconSupport(tower.upgrade).radius:stats.range,worldWidth=world.clientWidth||360,worldHeight=world.clientHeight||520;
    node.style.left=`${tower.x*100}%`;
    node.style.top=`${tower.y*100}%`;
    node.style.setProperty("--tower-range",`${fieldRange*200}%`);
    node.style.setProperty("--tower-range-width",`${Math.max(64,fieldRange*2*worldWidth)}px`);
    node.style.setProperty("--tower-range-height",`${Math.max(64,fieldRange*2*worldHeight)}px`);
    return true;
  }
  function sizeDefenseSquareField(){const shell=$(".defense-shell"),world=$("#defenseWorld");if(!shell||!world)return false;world.style.removeProperty("width");world.style.removeProperty("height");const width=shell.clientWidth,height=shell.clientHeight,mode=width>height?"landscape":height<650?"short-portrait":width>=768?"tablet":"portrait";shell.dataset.viewportMode=mode;return true;}

  function syncDefenseTowerGeometry(){
    const d=mini?.active&&mini.mode==="defense"?mini.defense:null;
    if(!d)return false;
    sizeDefenseSquareField();
    const world=$("#defenseWorld");
    d.renderWidth=world?.clientWidth||d.renderWidth||360;
    d.renderHeight=world?.clientHeight||d.renderHeight||520;
    const unitScale=clamp(d.renderWidth/390,.86,1.16);
    world?.style.setProperty("--def-unit-scale",unitScale.toFixed(3));
    d.canvasRenderer?.resize?.(d.renderWidth,d.renderHeight,d.governorTier||0);
    d.towers.forEach(tower=>applyDefenseTowerGeometry(tower));
    return true;
  }
  function scheduleDefenseTowerGeometrySync(){
    if(!mini?.active||mini.mode!=="defense"||!mini.defense)return;
    if(defenseResizeFrame)cancelAnimationFrame(defenseResizeFrame);
    defenseResizeFrame=requestAnimationFrame(()=>{defenseResizeFrame=null;syncDefenseTowerGeometry();});
  }
  function renderDefenseStructureTower(tower){
    const host=$("#defenseTowers"),type=defenseStructureType(tower),meta=DEFENSE_STRUCTURE_META[type];if(!host||!meta)return false;const node=document.createElement("button"),tier=defenseTowerTier(tower),support=type==="beacon"?DefenseCore.beaconSupport(tower.upgrade):null,econ=type==="factory"?defenseFactoryEconomy(tower):null;node.type="button";node.className=`defense-tower defense-structure defense-structure-${type} defense-tier-${tier} defense-upgrade-${tower.upgrade} ${tower.upgrade>=4?"structure-maxed":""}`;node.dataset.defenseTower=tower.id;node.dataset.structureType=type;node.setAttribute("aria-pressed","false");node.setAttribute("aria-label",type==="factory"?`Clothing Factory level ${tower.upgrade+1}. Produces ${econ.payout} coins every ${econ.interval.toFixed(1)} live-combat seconds. Tap for economy upgrades.`:`Beacon level ${tower.upgrade+1}. Buffs Rizos inside its field by ${Math.round((support.rateMultiplier-1)*100)} percent attack speed and ${Math.round((support.damageMultiplier-1)*100)} percent damage. Tap for support upgrades.`);node.style.setProperty("--tower-color",meta.accent);node.innerHTML=`<span class="defense-structure-field" aria-hidden="true"></span><span class="defense-range" aria-hidden="true"></span><span class="defense-structure-art structure-art-${type}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="defense-structure-name">${type==="factory"?"RIZO":"BEACON"}</span><i class="defense-level" title="Level ${tower.upgrade+1}">LV${tower.upgrade+1}</i>${tower.copyNumber>1?`<i class="defense-copy" title="Deployed copy ${tower.copyNumber}">#${tower.copyNumber}</i>`:""}`;host.appendChild(node);tower.node=node;applyDefenseTowerGeometry(tower,node);return true;
  }
  function defenseFeelIdleClass(variant="classic"){
    if(["ember","obsidian","diamond"].includes(variant))return "feel-idle-braced";
    if(["violet","aurora","frost","shadow"].includes(variant))return "feel-idle-hover";
    if(["glitch","retro","bubblegum"].includes(variant))return "feel-idle-twitch";
    return "feel-idle-breathe";
  }
  function defenseFeelPulseTower(tower,kind="selected",duration=260){
    if(!tower?.node)return false;const cls=`feel-${kind}`;tower.node.classList.remove(cls);void tower.node.offsetWidth;tower.node.classList.add(cls);queueMiniTimeout(()=>tower.node?.classList.remove(cls),duration);return true;
  }
  const DEFENSE_BOSS_FEEL_CLASSES=Object.freeze({crown:"feel-boss-crown",vortex:"feel-boss-vortex",mirror:"feel-boss-mirror",apex:"feel-boss-apex"});
  function defenseBossStagePulse(moment,bossId,duration=820){
    const stage=$(".defense-stage-frame"),momentClass=`feel-boss-${moment}`,identityClass=DEFENSE_BOSS_FEEL_CLASSES[bossId]||"";if(!stage)return false;
    const token=(Number(stage._rizoBossFeelToken)||0)+1;stage._rizoBossFeelToken=token;stage.classList.remove("feel-boss-arrival","feel-boss-phase","feel-boss-defeat",...Object.values(DEFENSE_BOSS_FEEL_CLASSES));void stage.offsetWidth;stage.classList.add(momentClass);if(identityClass)stage.classList.add(identityClass);
    queueMiniTimeout(()=>{if(stage._rizoBossFeelToken!==token)return;stage.classList.remove(momentClass);if(identityClass)stage.classList.remove(identityClass);},duration);return true;
  }
  function renderDefenseTower(tower){
    if(defenseStructureType(tower))return renderDefenseStructureTower(tower);
    const host=$("#defenseTowers");
    if(!host)return;
    const node=document.createElement("button"),stats=defenseCombatStats(tower),tier=defenseTowerTier(tower),universal=defenseIsUniversalTower(tower),variant=universal?{color:defenseTowerDisplayColor(tower),sprite:null}:(VARIANTS.find(item=>item.id===stats.variant)||VARIANTS[0]),mastery=universal?null:defenseMasteryForPet(tower.petId),masteryTier=universal?0:defenseMasteryTier(mastery||{}),mapBond=defenseMapBondForTower(tower);
    node.type="button";
    node.className=`defense-tower defense-variant-${stats.variant} ${universal?"defense-universal-tower":""} defense-tier-${tier} defense-upgrade-${tower.upgrade} defense-mastery-${masteryTier} ${tower.source==="active"?"defense-captain-tower":""} ${defenseFeelIdleClass(stats.variant)} ${tower.superForm?`defense-super-${tower.superForm}`:""} ${tower.doctrine?`defense-doctrine-${tower.doctrine}`:""} ${mapBond?`defense-map-bond map-bond-${mapBond.kind} map-bond-zone-${mapBond.zoneIndex} map-bond-tier-${mapBond.tier}${mapBond.state?` map-bond-state-${mapBond.state}`:""}`:""} ${tower.y<.35?"defense-range-label-low":tower.y>.65?"defense-range-label-high":""}`;
    node.dataset.defenseTower=tower.id;
    node.dataset.masteryTier=String(masteryTier);
    node.setAttribute("aria-pressed","false");
    node.setAttribute("aria-label",`${tower.pet.name}, Level ${tower.upgrade+1}${tower.superForm?` SUPER ${tower.superForm.toUpperCase()}`:""} ${stats.label} defender. Power ${Math.round(stats.damage)}, Speed ${stats.rate.toFixed(1)}, Reach ${Math.round(stats.range*100)}.${mapBond?` Map bond: ${mapBond.label}.`:""} Tap for tower actions.`);
    node.style.setProperty("--tower-color",variant.color);
    if(variant.sprite)node.style.setProperty("--tower-silhouette",`url("${variant.sprite}")`);
    node.innerHTML=`<span class="defense-aura" aria-hidden="true"><i></i></span><span class="defense-range" aria-hidden="true"></span><span class="defense-power-mark" aria-hidden="true"><i></i><i></i><i></i></span>${defenseTowerPortraitMarkup(tower)}${tower.source==="active"?`<i class="defense-captain-mark" title="Captain • owns the field power while deployed">CAPTAIN</i>`:""}${tower.upgrade?`<i class="defense-level" title="Level ${tower.upgrade+1}">LV${tower.upgrade+1}</i>`:""}${tower.copyNumber>1?`<i class="defense-copy" title="Deployed copy ${tower.copyNumber}">#${tower.copyNumber}</i>`:""}${mapBond?`<span class="defense-map-bond-badge" aria-hidden="true">${escapeHTML(mini.defense.map.mechanic?.icon||"✦")}</span>`:""}<i class="defense-ability-pip" aria-hidden="true">${tower.doctrine==="control"?"⌁":"✦"}</i>`;
    host.appendChild(node);
    tower.node=node;
    const abilityUnlocked=Boolean(tower.upgrade>=2&&tower.doctrine&&!defenseContractRule("silent",mini.defense)),abilityRemaining=abilityUnlocked?defenseAbilityRemaining(tower):Infinity,abilityCharged=Boolean(abilityUnlocked&&abilityRemaining<=0),abilityCooldown=Math.max(.001,defenseAbilityCooldown(tower)*(tower.superForm?.7:1)),abilityCharge=abilityUnlocked?clamp(1-abilityRemaining/abilityCooldown,0,1):0,abilityChargeStep=Math.round(abilityCharge*12)/12;
    node.classList.toggle("ability-ready",abilityCharged);node.classList.toggle("ability-charging",abilityUnlocked&&!abilityCharged);node.style.setProperty("--ability-charge",`${Math.round(abilityChargeStep*100)}%`);
    tower.abilityChargedVisual=abilityCharged;tower.abilityChargingVisual=abilityUnlocked&&!abilityCharged;tower.abilityChargeVisual=abilityChargeStep;
    applyDefenseTowerGeometry(tower,node);syncDefenseMapBondStateClasses();
  }

  function refreshDefenseTower(tower){const selected=mini.defense.selectedTowerId===tower.id;tower.node?.remove();renderDefenseTower(tower);if(selected){tower.node?.classList.add("selected");tower.node?.setAttribute("aria-pressed","true");}}
  function refreshDefenseMapBondVisuals(){const d=mini.defense;if(!d)return false;for(const tower of d.towers)refreshDefenseTower(tower);return true;}
  // Map-bond hint labels are placed by a normalized-y heuristic at render time. On
  // short phone viewports the longest bond copy wraps far enough to leave the
  // battlefield, so once the labels are actually visible we measure them and flip
  // the ones that would overflow. Runs only on placement/route-trace transitions
  // and resize, never inside the simulation loop.
  function syncDefenseMapMechanicEdges(){
    const world=$("#defenseWorld");if(!world)return false;
    const nodes=world.querySelectorAll(".defense-map-mechanic");if(!nodes.length)return false;
    const bounds=world.getBoundingClientRect();if(!bounds.height)return false;
    for(const node of nodes){
      const label=node.querySelector("span");if(!label)continue;
      node.classList.remove("mechanic-edge-bottom","mechanic-edge-left","mechanic-edge-right");
      label.style.removeProperty("--mechanic-hint-shift");
      let rect=label.getBoundingClientRect();
      if(!rect.height)continue;
      // Vertical: keep the hint below its ring unless above genuinely has more room.
      if(rect.bottom>bounds.bottom-1){
        const ring=node.getBoundingClientRect();
        if(ring.top-bounds.top>bounds.bottom-ring.bottom)node.classList.add("mechanic-edge-bottom");
      }
      // Horizontal: clamp to the battlefield rather than to the ring. Anchoring a
      // wide hint to one side of a small ring only trades a left overhang for a
      // right one, so shift the hint by the measured overflow instead.
      rect=label.getBoundingClientRect();
      let shift=0;
      if(rect.left<bounds.left+2)shift=(bounds.left+2)-rect.left;
      else if(rect.right>bounds.right-2)shift=(bounds.right-2)-rect.right;
      if(shift)label.style.setProperty("--mechanic-hint-shift",`${Math.round(shift)}px`);
    }
    return true;
  }
  function defensePanelStatsMarkup(stats){
    return `<span class="defense-stat-chip"><small>POWER</small><b>${Math.round(stats.damage)}</b></span><span class="defense-stat-chip"><small>SPEED</small><b>${stats.rate.toFixed(1)}</b></span><span class="defense-stat-chip"><small>REACH</small><b>${Math.round(stats.range*100)}</b></span>`;
  }
  function defenseEvolutionRailMarkup(tower){
    const level=clamp((tower?.upgrade||0)+1,1,5),doctrine=tower?.doctrine||"",pathName=doctrine?`${doctrine.toUpperCase()} PATH`:level>=3?"PATH OPEN":"PATH AT LV 3",stageName=defenseUpgradeName(tower);
    const nodes=[1,2,3,4,5].map(step=>{const done=step<=level,current=step===level,glyph=step===3?(doctrine==="power"?"◆":doctrine==="control"?"⌁":"◇"):step===5?"★":String(step);return `<i class="${done?"done":""} ${current?"current":""} ${step===3?"path-node":""} ${step===5?"max-node":""}">${glyph}</i>`;}).join("");
    return `<div class="defense-evolution-rail ${doctrine?`doctrine-${doctrine}`:"doctrine-open"}" aria-label="${escapeHTML(tower.pet.name)} evolution, level ${level} of 5, ${escapeHTML(pathName)}"><span class="defense-evolution-copy"><small>EVOLUTION • ${escapeHTML(pathName)}</small><b>${escapeHTML(stageName)}</b></span><span class="defense-evolution-track" aria-hidden="true">${nodes}</span></div>`;
  }

  function defenseSuperCandidates(tower,d=mini.defense){return d?.towers?.filter(other=>other.petId===tower?.petId&&!other.superForm)||[];}
  function defenseCanAscend(tower,d=mini.defense){const copies=defenseSuperCandidates(tower,d);return Boolean(tower&&defenseIsCharacterTower(tower)&&tower.upgrade>=4&&tower.doctrine&&copies.length>=10);}
  function ascendDefenseTower(id){const d=mini.defense,tower=d?.towers.find(t=>t.id===id);if(!defenseCanAscend(tower,d)){setDefenseMessage("SUPER RIZO NOT READY","Deploy 10 copies of the same Rizo and max the one you want to keep.");sfx("no");return false;}const copies=defenseSuperCandidates(tower,d),sacrifices=copies.filter(t=>t!==tower).slice(0,9);for(const other of sacrifices){other.node?.remove();d.towers=d.towers.filter(t=>t!==other);}tower.superForm=tower.doctrine;tower.abilityReadyAt=Math.min(tower.abilityReadyAt||0,defenseNow()+4);refreshDefenseMapBondVisuals();refreshDefenseSupportVisuals(d);markDefenseUi({roster:true});updateDefenseRoster();showDefenseTowerPanel(tower);showDefenseCinematicMoment("perfect",{kicker:"TEN BECOME ONE",title:`SUPER ${tower.doctrine.toUpperCase()} ${tower.pet.name}`,copy:"THE FIELD JUST CHANGED.",duration:2200,priority:9,icon:"✦"});setDefenseMessage("SUPER RIZO AWAKENED",tower.doctrine==="power"?"Massive damage. Same field, much bigger consequences.":"Massive reach, speed, and trail control.");writeDefenseCheckpoint(true,"super-rizo");defenseFeelPulseTower(tower,"upgraded",1100);duckMusic(1200,.055);sfx("defense-apex");defenseHaptic("apex");return true;}
  function showDefenseStructurePanel(tower){
    const panel=$("#defenseTowerPanel"),d=mini.defense,type=defenseStructureType(tower),meta=DEFENSE_STRUCTURE_META[type];if(!panel||!d||!type)return false;
    clearDefensePlacementMode();defenseCloseContextSurfaces("tower",{sync:false});d.selectedTowerId=tower.id;d.towers.forEach(item=>{const selected=item.id===tower.id;item.node?.classList.toggle("selected",selected);item.node?.setAttribute("aria-pressed",String(selected));});
    const upgradeCost=defenseUpgradeCost(tower,d),need=Math.max(0,upgradeCost-Math.floor(d.cash)),noSell=defenseContractRule("no-sell",d),sellLocked=!defenseSellAllowed(d),sell=defenseSellRefund(tower,d),nextName=tower.upgrade>=4?"MAXED OUT":defenseStructureUpgradeName({...tower,upgrade:tower.upgrade+1});let current,next,detail,synergy="";
    if(type==="factory"){
      current=defenseFactoryEconomy(tower,d);next=tower.upgrade<4?DefenseCore.factoryEconomy({upgradeLevel:tower.upgrade+1,wave:d.currentWave||d.clearedWave,goldenTowerCount:defenseAwakenedGoldenCount(d),beaconUpgradeLevel:defenseBeaconInfluence(tower,d)?.beacon?.upgrade??-1,cleanCycles:tower.factoryCleanCycles||0,brandLoop:Boolean(defenseBeaconInfluence(tower,d)?.network?.brandLoop),privateSun:Boolean(defenseBeaconInfluence(tower,d)?.network?.privateSun),goldenLicensed:Boolean(defenseBeaconInfluence(tower,d)?.network?.golden)}):current;
      const goldenPct=Math.round((current.goldenMultiplier-1)*100),beaconPct=Math.round((1-current.cadenceMultiplier)*100),momentumPct=Math.round((current.momentumMultiplier-1)*100),dropLabel=current.isDrop?(current.goldenLicensed?"GOLDEN DROP NEXT":current.privateSun?"SUN DROP NEXT":"RIZO DROP NEXT"):"NEXT PRINT";
      detail=`${dropLabel} • +${current.payout} GOLD • ${current.interval.toFixed(1)}S`;
      const parts=[`CLEAN STREAK ${current.cleanCycles}`,momentumPct?`MOMENTUM +${momentumPct}%`:"MOMENTUM BUILDING"];
      if(current.dropEvery)parts.push(`DROP EVERY ${current.dropEvery}`);if(current.brandLoop)parts.push("BRAND LOOP");if(current.goldenLicensed)parts.push("GOLDEN LICENSE");if(goldenPct)parts.push(`GOLDEN +${goldenPct}%`);if(beaconPct)parts.push(`LINE +${beaconPct}% SPEED`);parts.push(`${Math.round(tower.totalProduced||0)} PRINTED`);synergy=parts.join(" • ");
    }else{
      current=DefenseCore.beaconSupport(tower.upgrade);next=tower.upgrade<4?DefenseCore.beaconSupport(tower.upgrade+1):current;const network=defenseBeaconNetwork(tower,d)||{combat:0,factories:0,golden:0,brandLoop:false,privateSun:false};
      detail=`+${Math.round((current.rateMultiplier-1)*100)}% SPEED • +${Math.round((current.damageMultiplier-1)*100)}% IMPACT • ${Math.round(current.radius*100)}% FIELD`;
      if(tower.upgrade>=2)synergy=network.brandLoop?`${network.privateSun?"PRIVATE SUN LOOP":"BRAND LOOP LIVE"} • ${network.combat} RIZO • ${network.factories} FACTORY${network.factories===1?"":"IES"}${network.golden?` • ${network.golden} GOLDEN LICENSE`:""}`:`LINK A RIZO + FACTORY IN THIS FIELD • ${network.combat} RIZO • ${network.factories} FACTORY`;
      else synergy=`FACTORIES IN FIELD CYCLE ${Math.round((1-current.factoryCadenceMultiplier)*100)}% FASTER • STRONGEST BEACON ONLY`;
    }
    const nextCopy=tower.upgrade>=4?"THE END STATE":type==="factory"?`NEXT • +${next.payout} / ${next.interval.toFixed(1)}S${next.dropEvery?` • DROP ${next.dropEvery}`:""}`:`NEXT • +${Math.round((next.rateMultiplier-1)*100)}% SPEED • +${Math.round((next.damageMultiplier-1)*100)}% IMPACT`,upgradeText=tower.upgrade>=4?"MAXED OUT":need?`NEED ${need} MORE`:`UPGRADE • ${upgradeCost}`;
    panel.style.setProperty("--panel-accent",meta.accent);panel.hidden=false;panel.classList.add("rizo-field-sheet","v79-tower-shop","v80-tower-shop","defense-structure-panel");panel.innerHTML=`<button type="button" class="defense-sheet-close" data-defense-close-panel aria-label="Close structure controls">${defenseUiIcon("close")}</button><div class="defense-panel-hero v80 defense-structure-panel-hero"><span class="defense-panel-portrait"><span class="defense-structure-thumb structure-art-${type}" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span><div class="defense-panel-copy"><small>${meta.role} • UNIVERSAL STRUCTURE</small><b>${meta.name} <u>LV ${tower.upgrade+1}</u></b><em>${escapeHTML(defenseStructureUpgradeName(tower))}</em></div><div class="defense-panel-wallet"><small>GOLD</small><b>${defenseHudCounter(d.cash)} 🪙</b></div></div><div class="defense-structure-readout"><b>${escapeHTML(detail)}</b><span>${escapeHTML(synergy)}</span></div><button type="button" class="defense-upgrade-big ${need?"cant-afford":""}" data-defense-upgrade="${tower.id}" ${tower.upgrade>=4?"disabled":""}><span>${defenseUiIcon("upgrade")}</span><div><small>${escapeHTML(nextCopy)}</small><b>${escapeHTML(upgradeText)}</b></div></button><div class="defense-panel-simple-actions v80"><button type="button" class="target structure-info" disabled><i>${type==="factory"?"$":"☀"}</i><span><small>${meta.role}</small><b>${type==="factory"?"NO ATTACK":"AREA SUPPORT"}</b></span></button><button type="button" class="sell" data-defense-sell="${tower.id}" ${noSell||sellLocked?"disabled":""}><i>${defenseUiIcon("sell")}</i><span><small>${noSell?"LOCKED":sellLocked?"AFTER WAVE":"SELL"}</small><b>${noSell?"NO REFUNDS":sellLocked?"70% BACK":`${sell} 🪙`}</b></span></button></div><p class="defense-ability-one-line"><b>HOW IT WORKS</b> ${escapeHTML(defenseStructureRoleCopy(type))}</p>`;syncDefenseOverlayState();return true;
  }
  function upgradeDefenseStructure(tower){
    const d=mini.defense,type=defenseStructureType(tower);if(!d||!type||tower.upgrade>=DEFENSE_LIMITS.MAX_TOWER_LEVEL)return false;if(!defenseUpgradeAllowed(d)){setDefenseMessage("UPGRADE UNAVAILABLE","This structure cannot level up right now.");sfx("no");return false;}const cost=DefenseCore.structureUpgradeCost(type,tower.upgrade);if(d.cash<cost){const need=Math.max(1,cost-Math.floor(d.cash));setDefenseMessage(`NEED ${need} MORE COINS`,`${tower.pet.name} needs ${cost} to evolve.`);sfx("no");haptic([8,18,8]);return false;}
    d.cash-=cost;d.cashWriteCount=(d.cashWriteCount||0)+1;tower.spent+=cost;tower.upgrade+=1;if(type==="factory"){const econ=defenseFactoryEconomy(tower,d);tower.nextProductionAt=Math.min(tower.nextProductionAt||Infinity,defenseNow()+econ.interval);tower.factoryLastInterval=econ.interval;}syncDefenseTowerGeometry();const title=defenseStructureUpgradeName(tower),econ=type==="factory"?defenseFactoryEconomy(tower,d):null,support=type==="beacon"?DefenseCore.beaconSupport(tower.upgrade):null;
    let message=type==="factory"?`Production is now +${econ.payout} every ${econ.interval.toFixed(1)} live seconds.`:`Field now gives +${Math.round((support.rateMultiplier-1)*100)}% speed and +${Math.round((support.damageMultiplier-1)*100)}% impact.`,movie=tower.upgrade>=4?(type==="factory"?"THE LITTLE SHOP BECAME A DROP MACHINE.":"YOU BUILT A PRIVATE SUN."):"THE FIELD CHANGED.";
    if(type==="factory"&&tower.upgrade===1){message="Clean prints now build production momentum. A leak breaks the streak.";movie="THE SHOP LEARNS TO KEEP A RUN HOT.";}else if(type==="factory"&&tower.upgrade===2){message="RIZO DROPS ONLINE. Keep the Gate clean and every fourth print becomes a larger drop.";movie="PRINTS CAN BECOME DROPS NOW.";}else if(type==="beacon"&&tower.upgrade===2){message="BRAND LOOP ONLINE. Cover a Rizo and Factory in this field to accelerate Factory drops.";movie="MIX THE CREW WITH PRODUCTION.";}else if(type==="beacon"&&tower.upgrade===4){message="PRIVATE SUN ONLINE. A live Brand Loop now supercharges Factory drops; awakened Golden Rizos can license them.";movie="THE SUPPORT LIGHT BECAME INFRASTRUCTURE.";}
    setDefenseMessage(`${tower.pet.name} • ${title}`,message);showDefenseCinematicMoment(tower.upgrade>=4?"perfect":"upgrade",{kicker:type==="factory"?"PRODUCTION EVOLVED":"SUPPORT EVOLVED",title,copy:movie,duration:tower.upgrade>=4?1900:1150,priority:tower.upgrade>=4?8:3,icon:type==="factory"?"R":"☀"});showDefenseStructurePanel(tower);defenseCommitUpgrade(tower,{reason:"structure-upgrade"});return true;
  }

  function showDefenseTowerPanel(tower){
    if(defenseStructureType(tower))return showDefenseStructurePanel(tower);
    const panel=$("#defenseTowerPanel");if(!panel)return;panel.classList.remove("defense-structure-panel");if(mini.defense){clearDefensePlacementMode();defenseCloseContextSurfaces("tower",{sync:false});}
    const d=mini.defense,wasSelected=d.selectedTowerId===tower.id;d.selectedTowerId=tower.id;d.towers.forEach(item=>{const selected=item.id===tower.id;item.node?.classList.toggle("selected",selected);item.node?.setAttribute("aria-pressed",String(selected));});if(!wasSelected){defenseFeelPulseTower(tower,"selected",280);const real=defenseRealNow(d);if(real-(d.lastSelectionSfxAtReal||-99)>.08){d.lastSelectionSfxAtReal=real;sfx("defense-select");defenseHaptic("select");}}
    const universal=defenseIsUniversalTower(tower),variantId=tower.pet.variant||tower.pet.hiddenVariant||"classic",variantData=universal?{name:"UNIVERSAL DEFENSE TOOL",color:defenseTowerDisplayColor(tower)}:(VARIANTS.find(item=>item.id===variantId)||VARIANTS[0]),mapBond=defenseMapBondForTower(tower,d),stats=defenseCombatStats(tower),nextStats=tower.upgrade<4?defenseCombatStats({...tower,upgrade:tower.upgrade+1}):stats,upgradeCost=defenseUpgradeCost(tower,d),target=DEFENSE_TARGET_LABELS[tower.targetMode||"first"],needsDoctrine=tower.upgrade>=2&&!tower.doctrine,forced=defenseContractForcedDoctrine(d),noSell=defenseContractRule("no-sell",d),sell=defenseSellRefund(tower,d),sellLocked=!defenseSellAllowed(d),leader=defenseFieldLeader(d),isLeader=!universal&&leader?.id===tower.id,power=defenseAbilityPresentation(tower),remaining=Math.ceil(defenseAbilityRemaining(tower));
    const damageGain=Math.max(0,Math.round((nextStats.damage/Math.max(.01,stats.damage)-1)*100)),rangeGain=Math.max(0,Math.round((nextStats.range/Math.max(.01,stats.range)-1)*100)),rateGain=Math.max(0,Math.round((nextStats.rate/Math.max(.01,stats.rate)-1)*100)),needCoins=Math.max(0,upgradeCost-Math.floor(d.cash));
    panel.style.setProperty("--panel-accent",variantData.color||"#ff784f");panel.hidden=false;panel.classList.add("rizo-field-sheet","v79-tower-shop","v80-tower-shop");panel.classList.toggle("universal-tool-panel",universal);
    const openingDeal=!universal&&defenseUpgradeModifier(tower,d)<1,nextCopy=tower.upgrade>=4?"MAX LEVEL":`${openingDeal?"OPENING DEAL • ":""}${defenseUpgradeMove(tower)}`,pathCopy=universal?{power:["◆","POWER","Rivets hit harder, crack armor, and burst through clustered threats."],control:["⌁","CONTROL","Pins attack faster, reach farther, slow, root, and rewind runners."]}: {power:["◆","POWER","Damage, armor breaks, boss pressure."],control:["⌁","CONTROL","Reach, slows, roots, rewinds, interrupts."]},pathPicker=needsDoctrine?`<div class="defense-path-choice"><small>CHOOSE HOW ${escapeHTML(tower.pet.name).toUpperCase()} FIGHTS</small><div><button type="button" data-defense-doctrine="${tower.id}:power" ${forced&&forced!=="power"?"disabled":""}><i>${pathCopy.power[0]}</i><b>${pathCopy.power[1]}</b><span>${pathCopy.power[2]}</span></button><button type="button" data-defense-doctrine="${tower.id}:control" ${forced&&forced!=="control"?"disabled":""}><i>${pathCopy.control[0]}</i><b>${pathCopy.control[1]}</b><span>${pathCopy.control[2]}</span></button></div></div>`:"",upgradeText=tower.upgrade>=4?"MAXED OUT":needsDoctrine?"CHOOSE A PATH FIRST":needCoins?`NEED ${needCoins} MORE`:`LEVEL UP • ${upgradeCost}`;
    const leaderCopy=universal?`UNIVERSAL TOOL • ${tower.doctrine?tower.doctrine.toUpperCase()+" PATH":"NO FIELD POWER"}`:isLeader?(tower.upgrade<2?"FIELD LEADER • POWER UNLOCKS AT LV 3":!tower.doctrine?"FIELD LEADER • CHOOSE A PATH":remaining?`FIELD LEADER • ${power.active} ${remaining}s`:`FIELD LEADER • ${power.active}`):`FIELD SUPPORT • ${tower.doctrine?`${tower.doctrine.toUpperCase()} PATH`:"NO PATH YET"}`,superReady=defenseCanAscend(tower,d),superMarkup=universal?"":tower.superForm?`<div class="defense-super-status"><small>SUPER RIZO</small><b>${escapeHTML(tower.superForm.toUpperCase())} FORM</b><span>${tower.superForm==="power"?"2.75× impact core":"Massive reach + control tempo"}</span></div>`:superReady?`<button type="button" class="defense-super-button" data-defense-super="${tower.id}"><small>SACRIFICE 9 MATCHING COPIES</small><b>ASCEND TO SUPER ${escapeHTML(tower.doctrine.toUpperCase())}</b></button>`:"";
    const portrait=defenseTowerPortraitMarkup(tower,"defense-panel-rizo","thumbnail"),roleLine=universal?`<b>ROLE</b> ${escapeHTML(defenseAbilityData(tower).passive)}`:`<b>${isLeader?"FIELD POWER":"ROLE"}</b> ${escapeHTML(defenseAbilityData(tower).passive+" "+(isLeader?power.copy:""))}`;
    panel.innerHTML=`<button type="button" class="defense-sheet-close" data-defense-close-panel aria-label="Close defender controls">${defenseUiIcon("close")}</button><div class="defense-panel-hero v80"><span class="defense-panel-portrait">${portrait}</span><div class="defense-panel-copy"><small>${escapeHTML(variantData.name)} • ${escapeHTML(stats.label)}</small><b>${escapeHTML(tower.pet.name)} <u>LV ${tower.upgrade+1}</u></b><em>${escapeHTML(leaderCopy)}</em></div><div class="defense-panel-wallet"><small>GOLD</small><b>${defenseHudCounter(d.cash)} 🪙</b></div></div>${defenseEvolutionRailMarkup(tower)}${pathPicker}<button type="button" class="defense-upgrade-big ${needCoins?"cant-afford":""}" data-defense-upgrade="${tower.id}" ${tower.upgrade>=4||needsDoctrine?"disabled":""}><span>${defenseUiIcon("upgrade")}</span><div><small>${escapeHTML(nextCopy)}</small><b>${escapeHTML(upgradeText)}</b>${tower.upgrade<4&&!needsDoctrine?`<em class="defense-upgrade-deltas"><u>+${damageGain}% DMG</u><u>+${rateGain}% SPD</u><u>+${rangeGain}% RNG</u></em>`:""}</div></button>${superMarkup}<div class="defense-panel-simple-actions v80"><button type="button" class="target" data-defense-target="${tower.id}"><i>${defenseUiIcon("target")}</i><span><small>TARGET</small><b>${target}</b></span></button><button type="button" class="sell" data-defense-sell="${tower.id}" ${noSell||sellLocked?"disabled":""} aria-label="Sell ${escapeHTML(tower.pet.name)}"><i>${defenseUiIcon("sell")}</i><span><small>${noSell?"LOCKED":sellLocked?"AFTER WAVE":"SELL"}</small><b>${noSell?"NO REFUNDS":sellLocked?"70% BACK":`${sell} 🪙`}</b></span></button></div><p class="defense-ability-one-line">${roleLine}</p>${mapBond?`<p class="defense-map-bond-copy"><b>${escapeHTML(mini.defense.map.mechanic?.icon||"✦")} MAP BOND • ${escapeHTML(mapBond.label)}</b><span>${escapeHTML(mapBond.copy)}</span></p>`:""}`;syncDefenseOverlayState();
  }

  function updateDefenseAbilityPanel(){const d=mini.defense;if(!d?.selectedTowerId)return;const tower=d.towers.find(item=>item.id===d.selectedTowerId),upgrade=$("[data-defense-upgrade]");if(!tower)return;if(defenseStructureType(tower)){if(upgrade&&tower.upgrade<4){const cost=defenseUpgradeCost(tower,d),need=Math.max(0,cost-Math.floor(d.cash));upgrade.classList.toggle("cant-afford",need>0);const b=upgrade.querySelector("b");if(b)b.textContent=need?`NEED ${need} MORE`:`UPGRADE • ${cost}`;}return;}if(upgrade&&tower.upgrade<4&&!(tower.upgrade>=2&&!tower.doctrine)){const cost=defenseUpgradeCost(tower,d),need=Math.max(0,cost-Math.floor(d.cash));upgrade.classList.toggle("cant-afford",need>0);const b=upgrade.querySelector("b");if(b)b.textContent=need?`NEED ${need} MORE`:`LEVEL UP • ${cost}`;}tower.node?.classList.toggle("range-weakened",tower.rangeDebuffUntil>defenseNow());}
  function closeDefenseTowerPanel(){defenseClearTowerSelection();syncDefenseOverlayState();}
  function upgradeDefenseTower(id,{showPanel=true}={}){
    const d=mini.defense,tower=d?.towers.find(t=>t.id===id);if(!tower||tower.upgrade>=DEFENSE_LIMITS.MAX_TOWER_LEVEL)return;if(defenseStructureType(tower))return upgradeDefenseStructure(tower);if(!defenseUpgradeAllowed(d)){setDefenseMessage("UPGRADE UNAVAILABLE","This Rizo cannot level up right now.");sfx("no");return false;}if(tower.upgrade>=2&&!tower.doctrine){showDefenseTowerPanel(tower);setDefenseMessage("CHOOSE A PATH FIRST","POWER and CONTROL change the rest of this Rizo's run.");sfx("no");return false;}
    const before=defenseCombatStats(tower),modifier=defenseUpgradeModifier(tower,d),cost=defenseUpgradeCost(tower,d);if(d.cash<cost){const need=Math.max(1,cost-Math.floor(d.cash));$(".defense-stat-cash")?.classList.remove("money-nope");void $(".defense-stat-cash")?.offsetWidth;$(".defense-stat-cash")?.classList.add("money-nope");setDefenseMessage(`NEED ${need} MORE COINS`,`${tower.pet.name} needs ${cost} to level up.`);sfx("no");haptic([8,18,8]);return false;}d.cash-=cost;d.cashWriteCount=(d.cashWriteCount||0)+1;tower.spent+=cost;tower.upgrade+=1;if(modifier<1){d.worldPerkUsed=true;tower.openingPerkApplied=true;}tower.targetId=null;tower.retargetAt=0;tower.retargetAtReal=0;refreshDefenseTower(tower);const after=defenseCombatStats(tower),universal=defenseIsUniversalTower(tower),variant=universal?null:(VARIANTS.find(item=>item.id===(tower.pet.variant||tower.pet.hiddenVariant||"classic"))||VARIANTS[0]),upgradeColor=defenseTowerDisplayColor(tower),damageGain=Math.round((after.damage/Math.max(.01,before.damage)-1)*100),rateGain=Math.round((after.rate/Math.max(.01,before.rate)-1)*100),rangeGain=Math.round((after.range/Math.max(.01,before.range)-1)*100);    const world=$("#defenseWorld"),fx=document.createElement("div");world?.classList.remove("defense-upgrade-hit");void world?.offsetWidth;world?.classList.add("defense-upgrade-hit");fx.className=`defense-upgrade-burst tier-${defenseTowerTier(tower)} ${universal?"universal-basic-upgrade":""} ${tower.y<.34?"labels-below":tower.y>.66?"labels-above":"labels-center"}`;fx.style.left=`${tower.x*100}%`;fx.style.top=`${tower.y*100}%`;fx.style.setProperty("--upgrade-color",upgradeColor);if(variant?.sprite)fx.style.setProperty("--upgrade-silhouette",`url("${variant.sprite}")`);fx.innerHTML=`<i class="defense-upgrade-silhouette"></i><i></i><i></i><i></i><i></i><b>${escapeHTML(defenseUpgradeName(tower))}</b><span>+${damageGain}% DMG • +${rateGain}% SPEED • +${rangeGain}% RANGE</span>`;$("#defenseEffects")?.appendChild(fx);queueMiniTimeout(()=>{fx.remove();world?.classList.remove("defense-upgrade-hit");},1450);
    setDefenseMessage(`${tower.pet.name} GOT STRONGER`,tower.upgrade===2?"A NEW FIGHTING PATH IS READY.":`LEVEL ${tower.upgrade+1} • ${defenseUpgradeName(tower)}`);showDefenseCinematicMoment("upgrade",{title:defenseUpgradeName(tower),copy:tower.upgrade===2?"DOCTRINE UNLOCKED • CHOOSE POWER OR CONTROL":`LEVEL ${tower.upgrade+1} • ${damageGain}% DAMAGE`});if(showPanel||tower.upgrade===2&&!tower.doctrine)showDefenseTowerPanel(tower);defenseCommitUpgrade(tower,{reason:"upgrade"});return true;
  }
  function cycleDefenseTarget(id,{showPanel=true}={}){const tower=mini.defense?.towers.find(item=>item.id===id);if(!tower)return;const current=DEFENSE_TARGET_MODES.indexOf(tower.targetMode||"first");tower.targetMode=DEFENSE_TARGET_MODES[(current+1)%DEFENSE_TARGET_MODES.length];tower.targetId=null;tower.retargetAt=0;tower.retargetAtReal=0;completeDefenseSchoolLesson("targeting");markDefenseUi();if(showPanel)showDefenseTowerPanel(tower);else flushDefenseUi(true);writeDefenseCheckpoint(true,"target");setDefenseMessage(`${tower.pet.name} TARGETS ${DEFENSE_TARGET_LABELS[tower.targetMode]}`,tower.targetMode==="strong"?"Prioritizes the toughest balloon in range.":tower.targetMode==="last"?"Cleans up balloons furthest from the gate.":tower.targetMode==="close"?"Protects the space nearest this Rizo.":"Guards the balloon closest to the Ember Gate.");sfx("ui");}
  function chooseDefenseDoctrine(id,doctrine){const d=mini.defense,tower=d?.towers.find(item=>item.id===id),forced=defenseContractForcedDoctrine(d);if(!tower||tower.upgrade<2||tower.doctrine||!DEFENSE_DOCTRINES[doctrine])return false;if(forced&&doctrine!==forced){setDefenseMessage(`${forced.toUpperCase()} OATH`,`This Trail Contract rejects the ${doctrine.toUpperCase()} path.`);sfx("no");return false;}tower.doctrine=doctrine;if(defenseIsUniversalTower(tower))tower.targetMode=doctrine==="power"?"strong":"first";completeDefenseSchoolLesson("doctrine");refreshDefenseTower(tower);showDefenseTowerPanel(tower);markDefenseUi({roster:true});flushDefenseUi(true);const data=DEFENSE_DOCTRINES[doctrine],universal=defenseIsUniversalTower(tower);writeDefenseCheckpoint(true,"doctrine");if(universal){setDefenseMessage(`${tower.pet.name} BUILT ${doctrine.toUpperCase()}`,doctrine==="power"?"Rivets now crack armor and burst through packed threats.":"Pins now slow, reveal, and hold fast runners in the lane.");showDefenseCinematicMoment("upgrade",{title:doctrine==="power"?"RIVET DRIVER":"PIN RIG",copy:`UNIVERSAL TOOL • ${data.name}`});spawnDefenseImpact(tower.x,tower.y,doctrine==="power"?"power":"control",0,tower);}else{setDefenseMessage(`${tower.pet.name} CHOSE ${data.name}`,doctrine==="power"?"Every fifth shot cracks the formation.":"Every fifth shot restrains and reveals the trail.");showDefenseCinematicMoment("ability",{title:`${defenseAbilityData(tower).active} ONLINE`,copy:`${tower.pet.name} • ${data.name}`});spawnDefenseAbilityFx(tower,doctrine==="power"?"ember":"aurora");}defenseFeelPulseTower(tower,"upgraded",760);duckMusic(680,.11);sfx("defense-upgrade");defenseHaptic("upgrade");return true;}

  function requestSellDefenseTower(id){const d=mini.defense,tower=d?.towers.find(t=>t.id===id),panel=$("#defenseTowerPanel");if(!tower||!panel)return false;if(!defenseSellAllowed(d)||defenseContractRule("no-sell",d))return sellDefenseTower(id);const refund=defenseSellRefund(tower,d);panel.insertAdjacentHTML("beforeend",`<div class="defense-sell-confirm" role="alertdialog" aria-label="Confirm sale"><b>SELL ${escapeHTML(tower.pet.name).toUpperCase()}?</b><span>You get ${refund} 🪙 back. This Rizo leaves the field.</span><div><button type="button" data-defense-cancel-sell>KEEP RIZO</button><button type="button" class="danger" data-defense-confirm-sell="${tower.id}">YES, SELL</button></div></div>`);panel.querySelector("[data-defense-confirm-sell]")?.focus?.();return true;}
  function sellDefenseTower(id){const d=mini.defense,tower=d?.towers.find(t=>t.id===id);if(!tower)return false;if(defenseContractRule("no-sell",d)){setDefenseMessage("CONTRACT • NO REFUNDS","This placement is permanent until the run ends.");sfx("no");return false;}if(!defenseSellAllowed(d)){setDefenseMessage("SELLING LOCKED IN COMBAT","Bank the run or wait for planning. Combat selling cannot erase mistakes.");sfx("no");return false;}const undo=defenseCanUndoPlacement(tower,d),refund=defenseSellRefund(tower,d);d.cash=DefenseCore.clampNumber(d.cash+refund,0,DEFENSE_LIMITS.MAX_RUN_CASH,d.cash);d.cashWriteCount=(d.cashWriteCount||0)+1;tower.node?.remove();d.towers=d.towers.filter(t=>t!==tower);refreshDefenseMapBondVisuals();refreshDefenseSupportVisuals(d);closeDefenseTowerPanel();markDefenseUi({roster:true});updateDefenseRoster();updateDefenseHud();if(d.towers.length)writeDefenseCheckpoint(true,"sell");else clearDefenseCheckpoint();setDefenseMessage(undo?`PLACEMENT UNDONE • +${refund}`:`${defenseStructureType(tower)?"STRUCTURE":"RIZO"} SOLD • +${refund}`,undo?"Full refund within the five-second planning undo window.":"Planning refunds return 70% of total investment.");sfx(undo?"defense-deploy":"defense-sell");defenseHaptic(undo?"deploy":"sell");return true;}
  const DEFENSE_WAVE_FLAVOR=Object.freeze({
    grove:["Easy now. Watch where the first ones drift.","Good. Now cover the bend.","A few faster ones are testing the trail.","Do not chase every balloon. Build the field.","The forest is starting to push back.","They found another way through. Stay calm.","Your Rizos know the trail now.","This one asks for coverage, not panic.","Save a few coins. Something big is coming.","The trees went quiet. Boss incoming."],
    ember:["Heat makes everything look faster. Read the road.","Keep one eye on the Gate.","The hot trail rewards hard hits.","Do not let the fire rush your decisions.","They are testing the inside bend.","Your flame is holding. Make it stronger.","A tougher shell is entering the heat.","Leave room for one more answer.","The volcano is rumbling. Save something.","Big shadow in the smoke. Boss incoming."],
    moon:["Moonlight hides more than it shows.","Watch the silhouettes, not the sparkle.","Fast shapes are slipping through the dark.","Sight matters now. Build with intention.","Something is learning to disappear.","The moon gives you a second to read it.","Keep coverage on both halves of the trail.","If it fades, your awakened Rizos still know.","The whole trail feels watched.","Do not blink. Boss incoming."],
    storm:["The wind is quiet for now.","Fast balloons love a straight mistake.","Control the trail before the storm does.","A good slow is worth more than another panic buy.","Lightning is changing the rhythm.","Hold the bend. Let them come to you.","The next surge will punish weak coverage.","Your field should feel like a net now.","Save a power. The clouds are charging.","Thunder stopped. Boss incoming."],
    blizzard:["Cold makes distance hard to judge. Trust the ring.","Keep your Rizos close enough to help each other.","Frozen balloons do not care about weak slows.","Power and coverage beat pretty placement.","The trail is disappearing under snow.","Do not spend just because you can.","A heavy wave is moving through the whiteout.","Your strongest Rizo should have a job.","One more calm breath before the storm.","The snow split open. Boss incoming."],
    eclipse:["The light is leaving. Build for what you cannot see.","A clean field beats a crowded one.","Hidden threats are testing your weakest angle.","Do not let the darkness make you rush.","Your upgraded Rizos can read deeper into the trail.","Now the world starts mixing its tricks.","Keep one answer ready instead of spending everything.","The Gate is still bright. Protect that advantage.","Everything went still. Save your powers.","Something enormous moved in the dark. Boss incoming."]
  });
  function defenseWaveFlavor(mapId,wave,{cleared=false,perfect=false}={}){const lines=DEFENSE_WAVE_FLAVOR[mapId]||DEFENSE_WAVE_FLAVOR.grove,index=Math.max(0,Math.floor(wave)-1);if(index<lines.length)return lines[index];if(wave%10===0)return"That is not a normal balloon. Hold the Gate.";if(cleared&&perfect)return["Not one got through.","Clean field. Keep that flame alive.","That was surgical.","The Gate did not even flinch."][wave%4];if(cleared)return["Good hold. The next wave changes the question.","You bought yourself a breath. Use it.","Still alive. Spend with a plan.","The trail is learning your defense."][wave%4];return["Read the road.","Watch the front balloon.","Let the field do its job.","Save something for the surprise."][wave%4];}

  function defenseBossForWave(wave){const ordinal=Math.max(0,Math.floor(wave/10)-1),base=DEFENSE_BOSSES[ordinal%DEFENSE_BOSSES.length],intensity=Math.floor(ordinal/DEFENSE_BOSSES.length);return{...base,intensity};}
  function defenseWavePlan(wave){
    const d=mini.defense,plan=DefenseCore.createWavePlan({wave,specialBias:d.map.specialBias||0,weather:d.map.weather,bossIds:DEFENSE_BOSSES.map(item=>item.id)});d.waveAnnouncement=plan.announcement;
    const bossEntry=DefenseCore.flattenPackets(plan.packets).find(entry=>typeof entry==="object"&&entry?.type==="boss");if(bossEntry){const boss=DEFENSE_BOSSES.find(item=>item.id===bossEntry.bossId)||defenseBossForWave(wave),tier=Math.max(0,Number(bossEntry.intensity)||0);d.waveAnnouncement={title:plan.modifier==="boss-remix"?`${boss.name} • BOSS REMIX ${tier+1}`:`${boss.name} • BOSS WAVE`,copy:plan.announcement?.copy||boss.hint};}
    return plan;
  }
  function startDefenseWave(){
    const d=mini.defense;if(defenseIsActiveWave(d)||!d.towers.length||!DefenseCore.phaseAllows(d.phase,"start")||d.clearedWave>=DEFENSE_LIMITS.MAX_SUPPORTED_WAVE)return false;if(defenseRealNow(d)<(d.nextWaveReadyAtReal||0)){setDefenseMessage("FIELD SETTLING","Give the last pop half a second to land. Then the next formation is yours to call.");return false;}
    d.autoStartAtReal=0;flushDefenseIncome(d,"wave-start");completeDefenseSchoolLesson("route",{silent:true});d.intelOpen=false;d.intelPausedByOpen=false;clearDefensePlacementMode();closeDefenseTowerPanel();d.currentWave=DefenseCore.clampInteger(d.currentWave+1,1,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,1);defenseSetPhase(d,DEFENSE_PHASES.COUNTDOWN);const plan=defenseWavePlan(d.currentWave);d.wavePackets=plan.packets.map(packet=>({enemies:packet.enemies.map(entry=>typeof entry==="string"?entry:{...entry}),spawnGap:packet.spawnGap,breakAfter:packet.breakAfter}));d.packetIndex=0;d.packetEnemyIndex=0;d.spawnQueue=DefenseCore.flattenPackets(d.wavePackets).map(entry=>typeof entry==="string"?entry:{...entry});d.currentWavePlan=d.spawnQueue.map(entry=>typeof entry==="string"?entry:{...entry});d.childSpawnQueue=[];d.nextChildReleaseAtReal=defenseRealNow(d);d.childSpawnSequence=0;d.targetSnapshot=[];d.targetSnapshotAtReal=0;d.waveTotal=d.spawnQueue.length;d.waveResolved=0;d.nextSpawnAt=d.clock+(d.currentWave===1?.55:.8);d.packetBreakUntil=0;d.lastSpawnedEnemyId=null;d.spawnWaitReason="countdown";d.peakAlive=0;d.waveHeartLossStart=d.enemyStats.heartLoss;d.nextWeatherAt=Math.min(d.nextWeatherAt,d.clock+5.5);
    const announcement=d.waveAnnouncement,world=$("#defenseWorld"),bossWave=Boolean(announcement?.title?.includes("BOSS"));world?.classList.remove("wave-cue");void world?.offsetWidth;world?.classList.add("wave-cue");queueMiniTimeout(()=>world?.classList.remove("wave-cue"),1050);hideDefenseMessage();showDefenseCinematicMoment(bossWave?"boss":"wave-start",{title:bossWave?(announcement?.title||"BOSS INCOMING"):`WAVE ${d.currentWave} • ${announcement?.title||"HOLD THE GATE"}`,copy:bossWave?(announcement?.copy||"HOLD THE GATE"):(announcement?.copy||defenseWaveFlavor(d.mapId,d.currentWave)),duration:bossWave?1750:820});markDefenseUi();flushDefenseUi(true);writeDefenseCheckpoint(true,"wave-start");sfx("event");return true;
  }

  function defenseEnemyCamoActive(enemy,time=defenseNow()){const d=mini.defense;if(!d||!enemy)return false;return Boolean((enemy.camo||d.eclipseUntil>time||d.ashUntil>time)&&d.moonRevealUntil<=time&&enemy.revealUntil<=time);}
  function revealDefenseEnemy(enemy,duration=2.5,tower=null){if(!enemy||enemy.dead)return false;const d=mini.defense,time=defenseNow(),wasCamo=defenseEnemyCamoActive(enemy,time),wasPhase=Boolean(enemy.phasing&&enemy.phaseSuppressedUntil<=time&&d.moonRevealUntil<=time);enemy.revealUntil=Math.max(enemy.revealUntil||0,time+duration);if(enemy.phasing)enemy.phaseSuppressedUntil=Math.max(enemy.phaseSuppressedUntil||0,time+duration);if(wasCamo&&!enemy.revealCredited){enemy.revealCredited=true;d.enemyStats.counters.reveals+=1;}if(wasPhase&&!enemy.phaseLockCredited){enemy.phaseLockCredited=true;d.enemyStats.counters.phaseLocks+=1;}if(wasCamo||wasPhase){spawnDefenseImpact(enemy.x||0,enemy.y||0,"reveal");updateDefenseEnemyNode(enemy);}return wasCamo||wasPhase;}
  function shredDefenseArmor(enemy,amount=.04,tower=null){if(!enemy||enemy.dead||enemy.armor<=0)return false;const before=enemy.armor;enemy.armor=Math.max(0,enemy.armor-Math.max(0,amount));if(before-enemy.armor>.005){mini.defense.enemyStats.counters.armorShreds+=1;enemy.armorShredded=true;spawnDefenseImpact(enemy.x||0,enemy.y||0,"armor");updateDefenseEnemyNode(enemy);return true;}return false;}
  function applyDefenseEnemyThresholds(enemy,tower=null){if(!enemy||enemy.dead||enemy.hp<=0)return;const ratio=enemy.hp/enemy.maxHp,breakable=enemy.type==="shell"||enemy.type==="brick";if(breakable&&!enemy.armorBroken&&ratio<=.5){enemy.armorBroken=true;enemy.armor=Math.min(enemy.armor,enemy.type==="brick"?.02:.06);mini.defense.enemyStats.counters.armorBreaks+=1;spawnDefenseImpact(enemy.x||0,enemy.y||0,"armor");updateDefenseEnemyNode(enemy);if(!mini.defense.hintFlags.armorBreak){mini.defense.hintFlags.armorBreak=true;setDefenseMessage(enemy.type==="brick"?"CERAMIC SHELL CRACKED":"IRON PLATE BROKEN",enemy.type==="brick"?"The heavy shell finally gave. Finish the exposed balloon.":"Below half health, Iron Balloons lose most of their armor. Finish the exposed core.");}}}

  function createDefenseEnemyNode(){
    const node=document.createElement("div");
    node.className="defense-enemy";
    node.innerHTML=`<span class="balloon-body"><i class="balloon-shine"></i><b class="balloon-face"><u></u><u></u><em>×××</em></b></span><span class="balloon-knot"></span><span class="balloon-string"></span><span class="balloon-trait" aria-hidden="true"></span><span class="balloon-state" aria-hidden="true"></span><span class="balloon-health"><i></i></span>`;
    node._rizoTrait=node.querySelector(".balloon-trait");
    node._rizoState=node.querySelector(".balloon-state");
    return node;
  }
  function acquireDefenseProjectileNode(){
    const d=mini.defense,host=$("#defenseProjectiles");if(!d||!host)return null;let node=d.projectileNodePool.pop();if(!node){node=document.createElement("i");d.projectileNodesCreated=(d.projectileNodesCreated||0)+1;}node.hidden=false;node.removeAttribute("style");node._rizoMoveX=NaN;node._rizoMoveY=NaN;node.className="defense-shot";host.appendChild(node);d.projectileNodesAcquired=(d.projectileNodesAcquired||0)+1;return node;
  }
  function releaseDefenseProjectileNode(shot){
    const d=mini.defense,node=shot?.node;if(!d||!node)return;node.remove();node.hidden=true;node.className="defense-shot";node.removeAttribute("style");node._rizoMoveX=NaN;node._rizoMoveY=NaN;shot.node=null;if(d.projectileNodePool.length<96)d.projectileNodePool.push(node);
  }

  function acquireDefenseEnemyNode(){
    const d=mini.defense;let node=d.enemyNodePool.pop();if(!node){node=createDefenseEnemyNode();d.enemyNodesCreated=(d.enemyNodesCreated||0)+1;}
    node.hidden=false;node.removeAttribute("style");node.className="defense-enemy";node.dataset.enemyId="";
    if(!node._rizoTrait)node._rizoTrait=node.querySelector(".balloon-trait");
    if(!node._rizoState)node._rizoState=node.querySelector(".balloon-state");
    if(node._rizoState){node._rizoState.textContent="";node._rizoState.hidden=true;}
    $("#defenseEnemies")?.appendChild(node);d.enemyNodesAcquired=(d.enemyNodesAcquired||0)+1;return node;
  }

  function releaseDefenseEnemyNode(enemy){
    const d=mini.defense,node=enemy?.node;if(!node)return;
    node.remove();node.hidden=true;node.className="defense-enemy";node.dataset.enemyId="";node.removeAttribute("style");
    if(node._rizoState){node._rizoState.textContent="";node._rizoState.hidden=true;}
    enemy.node=null;enemy.visualSignature="";enemy.stateSignature="";enemy.lastRenderedHealth=-1;enemy.lastRenderX=NaN;enemy.lastRenderY=NaN;
    if(d&&d.enemyNodePool.length<64)d.enemyNodePool.push(node);
  }

  function queueDefenseChildSpawn(entry,{progress=0,delay=0,options={}}={}){
    const d=mini.defense,clean=defenseQueueEntry(entry);if(!d||!clean)return false;if(d.childSpawnQueue.length>=DEFENSE_LIMITS.MAX_CHILD_BUFFER){defenseRecordValidationWarning("child-buffer-cap",{wave:d.currentWave});return false;}const item={entry:clean,progress:clamp(progress,0,.995),releaseAt:d.clock+Math.max(.04,delay),sequence:(d.childSpawnSequence=(d.childSpawnSequence||0)+1),options:{...options}},index=d.childSpawnQueue.findIndex(queued=>queued.releaseAt>item.releaseAt||(queued.releaseAt===item.releaseAt&&(queued.sequence||0)>item.sequence));if(index<0)d.childSpawnQueue.push(item);else d.childSpawnQueue.splice(index,0,item);return true;
  }
  function releaseDefenseChildSpawn(d){if(!d?.childSpawnQueue?.length)return false;const child=d.childSpawnQueue[0];if(child.releaseAt>d.clock||!defenseDensityAllowsSpawn(d,child.entry,true))return false;d.childSpawnQueue.shift();spawnDefenseEnemy(child.entry,{progress:child.progress,...child.options});d.nextChildReleaseAtReal=defenseRealNow(d);d.childSpawnsReleased=(d.childSpawnsReleased||0)+1;return true;}

  function spawnDefenseEnemy(entry,options={}){
    const descriptor=typeof entry==="string"?{type:entry}:entry||{type:"puff"},type=descriptor.type||"puff",d=mini.defense,boss=type==="boss"?DEFENSE_BOSSES.find(item=>item.id===(descriptor.bossId||"crown"))||DEFENSE_BOSSES[0]:null,base=boss||DEFENSE_ENEMIES[type]||DEFENSE_ENEMIES.puff,scale=defenseHealthScale(d.currentWave||d.wave)*(d.map.hp||1)*(boss?1+Math.min(12,descriptor.intensity||0)*.10:1)*defenseDurabilityScale(d.currentWave||d.wave,{boss:Boolean(boss)}),hp=Number(options.hpOverride)||base.hp*scale;
    const point=defensePointAt(Number.isFinite(options.progress)?options.progress:0),baseVisualClass=boss?`balloon-boss ${boss.className}`:base.className;
    const enemy={id:`enemy-${d.nextId++}`,type,bossId:boss?.id||null,bossIntensity:descriptor.intensity||0,bossChild:Boolean(options.bossChild),progress:Number.isFinite(options.progress)?options.progress:0,x:point.x,y:point.y,prevX:point.x,prevY:point.y,hp,maxHp:Number(options.maxHpOverride)||hp,speed:base.speed*(1+Math.min(.22,d.wave*.006))*(d.map.speed||1),reward:DefenseCore.calculateEnemyReward(base.reward,d.currentWave,{rewardScale:options.rewardScale??1}),damage:base.damage,baseArmor:base.armor||0,armor:base.armor||0,armorBroken:false,armorShredded:false,fireproof:Boolean(base.fireproof),slowResist:base.slowResist||0,stormPulse:Boolean(base.stormPulse),stormCharging:false,supportAura:Boolean(base.supportAura),healer:Boolean(base.healer),supportCycle:Math.floor((d.clock+((d.nextId%11)*.37))/3.6),relayBoosted:false,supportFlashUntil:0,phasing:Boolean(base.phasing),camo:Boolean(base.camo),phaseOffset:(d.nextId%11)*.37,phaseActive:false,revealUntil:0,phaseSuppressedUntil:0,revealCredited:false,phaseLockCredited:false,slow:0,slowUntil:0,burn:0,burnUntil:0,burnSource:null,poison:0,poisonUntil:0,poisonSource:null,rootUntil:0,hitFlash:0,phaseTriggered:false,bossPhase:0,signalStaggerUntil:0,nextBossPulse:d.clock+4,telegraphKind:null,telegraphStartedAt:0,telegraphUntil:0,telegraphDisruption:0,apexSurgeUntil:0,bossMechanicLocked:false,baseVisualClass,renderColor:base.color,renderIcon:base.icon||"○",renderName:base.name||type,renderSkin:"clean",renderCamo:false,renderRevealed:false,renderStateSymbol:"",visualSignature:"",stateSignature:"",lastRenderedHealth:-1,lastRenderX:NaN,lastRenderY:NaN,node:null};enemy.feelEnterUntil=boss&&!options.bossChild?defenseNow()+.9:0;
    const node=defenseUsesCanvas(d)?null:acquireDefenseEnemyNode();if(node){node.className=`defense-enemy ${baseVisualClass}`;node.dataset.enemyId=enemy.id;node.style.setProperty("--balloon-color",base.color);if(node._rizoTrait)node._rizoTrait.textContent=base.icon||"○";enemy.node=node;}d.enemies.push(enemy);d.peakAlive=Math.max(d.peakAlive||0,d.enemies.length);mini.entities.push(enemy);if(!options.skipAnalytics)defenseRecordEnemyStat("spawned",boss?`boss:${boss.id}`:type);updateDefenseEnemyNode(enemy,true);if(boss&&!options.bossChild){enemy.node?.classList.add("boss-entering");queueMiniTimeout(()=>enemy.node?.classList.remove("boss-entering"),900);defenseBossStagePulse("arrival",boss.id,920);showDefenseCinematicMoment("boss",{title:boss.name,copy:boss.trait,kicker:`WAVE ${d.currentWave} • BOSS ENTRANCE`});duckMusic(1150,.07);defenseBossCue("arrival",boss.id);defenseHaptic("bossWarn");}if(enemy.camo&&!d.camoHintSeen){d.camoHintSeen=true;setDefenseMessage("SHADE BALLOON", "BASE RIZOS ONLY DEAL 25% DAMAGE. AWAKEN OR USE SHADOW, AURORA, OR GLITCH.");}return enemy;
  }

  function defenseEnemySkin(enemy,time){
    if(enemy.burnUntil>time)return"burn";
    if(enemy.poisonUntil>time)return"poison";
    if(enemy.rootUntil>time)return"root";
    if(enemy.slowUntil>time)return"frost";
    if(enemy.armorBroken)return"cracked";
    if(enemy.armorShredded)return"shredded";
    return"clean";
  }
  function positionDefenseEnemyNode(enemy,force=false,renderX=enemy?.x,renderY=enemy?.y){
    const d=mini.defense,node=enemy?.node;if(!d||!node)return false;
    const width=Math.max(1,d.renderWidth||$("#defenseWorld")?.clientWidth||360),height=Math.max(1,d.renderHeight||$("#defenseWorld")?.clientHeight||360),px=Math.round((Number(renderX)||0)*width*10)/10,py=Math.round((Number(renderY)||0)*height*10)/10;
    if(!force&&px===enemy.lastRenderX&&py===enemy.lastRenderY)return false;
    node.style.transform=`translate3d(${px}px,${py}px,0)`;enemy.lastRenderX=px;enemy.lastRenderY=py;d.enemyPositionWrites=(d.enemyPositionWrites||0)+1;return true;
  }
  function positionDefenseMovingNode(node,x,y){
    const d=mini.defense;if(!node||!d)return false;
    const width=Math.max(1,d.renderWidth||$("#defenseWorld")?.clientWidth||360),height=Math.max(1,d.renderHeight||$("#defenseWorld")?.clientHeight||360),px=Math.round((Number(x)||0)*width*10)/10,py=Math.round((Number(y)||0)*height*10)/10;
    if(px===node._rizoMoveX&&py===node._rizoMoveY)return false;
    node.style.transform=`translate3d(${px}px,${py}px,0)`;node._rizoMoveX=px;node._rizoMoveY=py;return true;
  }
  function updateDefenseEnemyNode(enemy,force=false){
    const time=defenseNow(),d=mini.defense;if(!enemy||!d)return false;
    if(!Number.isFinite(enemy.x)||!Number.isFinite(enemy.y)){const point=defensePointAt(enemy.progress);enemy.x=point.x;enemy.y=point.y;}
    const phaseSuppressed=enemy.phaseSuppressedUntil>time||d.moonRevealUntil>time,camo=defenseEnemyCamoActive(enemy,time),stormCharging=Boolean(enemy.stormPulse&&((time+enemy.phaseOffset)%4.8)<1.15),ashCloaked=Boolean(d.ashUntil>time&&enemy.revealUntil<=time&&d.moonRevealUntil<=time),revealed=!camo&&(enemy.camo||enemy.revealUntil>time||d.moonRevealUntil>time),skin=defenseEnemySkin(enemy,time),health=Math.round(clamp(enemy.hp/Math.max(.001,enemy.maxHp)*100)),damaged=health<99,relayBoosted=Boolean(enemy.relayBoosted),signalStaggered=(enemy.signalStaggerUntil||0)>time,menderFlashing=(enemy.supportFlashUntil||0)>time;
    const symbol=enemy.armorBroken?"×":phaseSuppressed&&enemy.phasing?"⌁":revealed?"◉":enemy.telegraphKind||stormCharging?"!":signalStaggered?"∿":relayBoosted?"⌁":menderFlashing?"+":"",stateSignature=`${symbol}|${symbol?0:1}`;
    enemy.stormCharging=stormCharging;enemy.renderSkin=skin;enemy.renderCamo=camo;enemy.renderRevealed=revealed;enemy.renderStateSymbol=symbol;/* Phase damage state belongs to the fixed simulation, never the renderer. */
    if(!enemy.node){enemy.visualSignature="canvas";enemy.stateSignature=stateSignature;enemy.lastRenderedHealth=health;return true;}
    const burnActive=enemy.burnUntil>time,poisonActive=enemy.poisonUntil>time,frostActive=enemy.slowUntil>time,rootActive=enemy.rootUntil>time;
    const classes=["defense-enemy",enemy.baseVisualClass,`skin-${skin}`,burnActive?"is-burn":"",poisonActive?"is-poison":"",frostActive?"is-frost":"",rootActive?"is-root":"",damaged?"damaged":"",enemy.hitFlash>0?"hit":"",enemy.phaseActive?"phased":"",phaseSuppressed&&enemy.phasing?"phase-suppressed":"",camo?"camouflaged":"",revealed?"revealed":"",ashCloaked?"ash-cloaked":"",stormCharging?"storm-charging":"",enemy.telegraphKind?"boss-telegraph":"",enemy.telegraphKind?`telegraph-${enemy.telegraphKind}`:"",enemy.telegraphKind?"feel-boss-windup":"",enemy.feelEnterUntil>time?"boss-entering":"",enemy.armorBroken?"armor-broken":"",enemy.armorShredded&&!enemy.armorBroken?"armor-shredded":"",relayBoosted?"relay-supported":"",signalStaggered?"signal-staggered":"",menderFlashing?"mender-flashing":""].filter(Boolean).join(" ");
    if(force||classes!==enemy.visualSignature){enemy.node.className=classes;enemy.visualSignature=classes;d.enemyClassWrites=(d.enemyClassWrites||0)+1;}
    if(force||health!==enemy.lastRenderedHealth){enemy.node.style.setProperty("--enemy-health",`${health}%`);enemy.lastRenderedHealth=health;d.enemyHealthWrites=(d.enemyHealthWrites||0)+1;}
    if(force||enemy.lastTelegraphBreak!==enemy.telegraphDisruption){enemy.node.style.setProperty("--telegraph-break",`${Math.round(clamp((enemy.telegraphDisruption||0)*100))}%`);enemy.lastTelegraphBreak=enemy.telegraphDisruption;}
    if(enemy.hitFlash>0&&Number.isFinite(enemy.hitFromX)&&Number.isFinite(enemy.hitFromY)){const hitDx=enemy.x-enemy.hitFromX,hitDy=enemy.y-enemy.hitFromY,hitLen=Math.hypot(hitDx,hitDy)||1,nx=Math.round(hitDx/hitLen*100)/100,ny=Math.round(hitDy/hitLen*100)/100,hitSignature=`${nx}|${ny}`;if(force||hitSignature!==enemy.feelHitSignature){enemy.node.style.setProperty("--feel-hit-x",`${(nx*2.1).toFixed(2)}px`);enemy.node.style.setProperty("--feel-hit-y",`${(ny*2.1).toFixed(2)}px`);enemy.feelHitSignature=hitSignature;}}
    if(force||stateSignature!==enemy.stateSignature){const stateNode=enemy.node._rizoState;if(stateNode){stateNode.textContent=symbol;stateNode.hidden=!symbol;}enemy.stateSignature=stateSignature;d.enemyStateWrites=(d.enemyStateWrites||0)+1;}
    if(!d.fixedSimulation||force)positionDefenseEnemyNode(enemy,force);return true;
  }

  function defenseAuroraBuff(tower){return 1+mini.defense.towers.filter(other=>other!==tower&&(other.pet.variant||other.pet.hiddenVariant)==="aurora"&&Math.hypot(other.x-tower.x,other.y-tower.y)<.25).length*.16;}
  function defenseEnemyThreat(enemy){const key=enemy.bossId?`boss:${enemy.bossId}`:enemy.type,identity=(DEFENSE_THREAT_PRIORITY[key]||30)/100,support=(enemy.type==="relay"||enemy.type==="mender")?1.35:1;return (enemy.maxHp||enemy.hp||1)*(1+(enemy.armor||0))*(1+Math.max(0,(enemy.damage||1)-1)*.22)*(1+identity*.16)*(enemy.bossId?2:1)*support;}
  // Camouflage and phasing reduce damage through dealDefenseDamage; they do not make an
  // already acquired target disappear. This predicate exists only for cached-target validity.
  function canDefenseTowerSee(tower,enemy){return Boolean(tower&&enemy&&!enemy.dead&&enemy.hp>0);}
  function defenseTargetSnapshot(d=mini.defense,force=false){// Cache deadlines use game time despite their legacy property names.
    const realTime=defenseNow(),budget=DEFENSE_BUDGETS.normal;if(force||!Array.isArray(d.targetSnapshot)||realTime>=(d.targetSnapshotAtReal||0)){d.targetSnapshot=d.enemies.filter(enemy=>!enemy.dead&&enemy.hp>0);d.targetSnapshotAtReal=realTime+budget.targetRefreshMs/1000;d.targetSnapshotBuilds=(d.targetSnapshotBuilds||0)+1;}return d.targetSnapshot;}
  function pickDefenseTarget(tower,stats,candidates=defenseTargetSnapshot()){
    const mode=tower.targetMode||"first",rangeSq=stats.range*stats.range;let best=null,bestDistance=Infinity,bestThreat=-Infinity;
    for(const enemy of candidates){
      if(enemy.hp<=0)continue;const dx=enemy.x-tower.x,dy=enemy.y-tower.y,distanceSq=dx*dx+dy*dy;if(distanceSq>rangeSq)continue;
      if(!best){best=enemy;bestDistance=distanceSq;if(mode==="strong")bestThreat=defenseEnemyThreat(enemy);continue;}
      if(mode==="strong"){
        const threat=defenseEnemyThreat(enemy);if(threat>bestThreat||(threat===bestThreat&&(enemy.hp>best.hp||(enemy.hp===best.hp&&enemy.progress>best.progress)))){best=enemy;bestThreat=threat;bestDistance=distanceSq;}
      }else if(mode==="last"){
        if(enemy.progress<best.progress){best=enemy;bestDistance=distanceSq;}
      }else if(mode==="close"){
        if(distanceSq<bestDistance){best=enemy;bestDistance=distanceSq;}
      }else if(enemy.progress>best.progress){best=enemy;bestDistance=distanceSq;}
    }
    return best;
  }
  function defenseProgressTargetsNear(target,radius,limit){
    const radiusSq=radius*radius,picks=[];
    for(const enemy of mini.defense.enemies){
      if(enemy===target||enemy.hp<=0)continue;const dx=enemy.x-target.x,dy=enemy.y-target.y;if(dx*dx+dy*dy>=radiusSq)continue;
      let slot=picks.length;for(let index=0;index<picks.length;index+=1){if(enemy.progress>picks[index].progress){slot=index;break;}}
      picks.splice(slot,0,enemy);if(picks.length>limit)picks.pop();
    }
    return picks;
  }
  function defenseBasicRestrained(enemy,time=defenseNow()){return Boolean(enemy&&((enemy.rootUntil||0)>time||((enemy.slowUntil||0)>time&&(enemy.slow||0)>=.25)));}
  function defenseBasicOpened(enemy){return Boolean(enemy&&(enemy.armorBroken||enemy.armorShredded||(enemy.baseArmor||0)>0&&(enemy.armor||0)<Math.max(0,(enemy.baseArmor||0)-.02)));}
  function defenseBasicRivetTargets(target,radius=.14,limit=2){return defenseProgressTargetsNear(target,radius,12).sort((a,b)=>((b.armor||0)*120+defenseEnemyThreat(b))-((a.armor||0)*120+defenseEnemyThreat(a))).slice(0,limit);}
  function defenseBasicThreadTargets(target,radius=.13,limit=2){const time=defenseNow();return defenseProgressTargetsNear(target,radius,12).sort((a,b)=>{const aFresh=defenseBasicRestrained(a,time)?0:1,bFresh=defenseBasicRestrained(b,time)?0:1;return bFresh-aFresh||b.progress-a.progress;}).slice(0,limit);}
  function defenseBasicLinkFlash(from,to,kind="stitch"){
    const d=mini.defense;if(!d||!from||!to||d.effects.length>=defenseVisualBudget(d).maxImpactEffects)return;const color=kind==="power"?DEFENSE_BASIC_TOWER.powerColor:kind==="control"?DEFENSE_BASIC_TOWER.controlColor:DEFENSE_BASIC_TOWER.color;d.maxEffectNodesObserved=Math.max(d.maxEffectNodesObserved||0,d.effects.length+1);
    if(defenseUsesCanvas(d)){d.effects.push({kind:"chain",x:from.x,y:from.y,toX:to.x,toY:to.y,color,startedAt:d.clock,expiresAt:d.clock+.18});return;}
    const node=acquireDefenseImpactNode();if(!node)return;const dx=(to.x-from.x)*(d.renderWidth||390),dy=(to.y-from.y)*(d.renderHeight||390);node.className=`defense-chain-link worker-d-link worker-d-link-${kind}`;node.style.left=`${from.x*100}%`;node.style.top=`${from.y*100}%`;node.style.width=`${Math.hypot(dx,dy)}px`;node.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;node.style.setProperty("--worker-d-link",color);const effect={node,expiresAt:d.clock+.18};d.effects.push(effect);
  }
  function animateDefenseTower(tower,kind="attack"){
    if(!tower.node)return;
    const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",apex=tower.upgrade>=4,classes=[kind==="ability"?"ability-cast":kind==="doctrine"?"doctrine-strike":"firing",`${kind}-${variant}`];if(apex&&kind==="ability")classes.push("apex-cast");tower.node.classList.add(...classes);
    const attackDurations={classic:210,"defense-basic":tower.doctrine==="power"?245:tower.doctrine==="control"?165:195,ember:230,toxic:220,violet:240,moss:235,bubblegum:240,frost:220,glitch:180,obsidian:255,aurora:250,golden:235,diamond:220,shadow:230,retro:180};
    const duration=kind==="ability"?(apex?900:680):kind==="doctrine"?320:(attackDurations[variant]||220);
    tower.node.style.setProperty("--attack-life",`${duration}ms`);
    queueMiniTimeout(()=>tower.node?.classList.remove(...classes),duration);
  }

  const DEFENSE_ABILITY_REACTIONS=Object.freeze({ember:"heat",toxic:"spore",violet:"storm",moss:"roots",bubblegum:"bounce",frost:"freeze",glitch:"glitch",obsidian:"quake",aurora:"prism",golden:"payday",diamond:"shards",shadow:"blackout",retro:"rewind",classic:"rally"});
  function spawnDefenseAbilityFx(tower,kind){
    const d=mini.defense,host=$("#defenseEffects"),world=$("#defenseWorld");if(!d||!tower||!host)return false;
    const apex=tower.upgrade>=4,doctrine=tower.doctrine||"power",reaction=DEFENSE_ABILITY_REACTIONS[kind]||"rally",node=document.createElement("span");
    node.className=`defense-ability-fx ability-fx-${kind} ability-${doctrine} ${apex?"apex-fx":""}`;node.style.left=`${tower.x*100}%`;node.style.top=`${tower.y*100}%`;node.innerHTML='<i class="ability-core"></i><i class="ability-detail detail-a"></i><i class="ability-detail detail-b"></i><i class="ability-detail detail-c"></i><i class="ability-apex-mark"></i>';
    host.appendChild(node);world?.classList.add(`ability-react-${reaction}`,`ability-react-${doctrine}`);if(apex)world?.classList.add("ability-react-apex");
    const cleanup=()=>{if(!node.isConnected)return;node.remove();if(!host.querySelector(`.ability-fx-${kind}`))world?.classList.remove(`ability-react-${reaction}`);if(!host.querySelector(`.ability-${doctrine}`))world?.classList.remove(`ability-react-${doctrine}`);if(!host.querySelector(".apex-fx"))world?.classList.remove("ability-react-apex");};
    node.addEventListener("animationend",event=>{if(event.target===node&&event.animationName==="workerE-ability-event")cleanup();});
    if(defenseReducedMotion()){const reducedCleanup=()=>{if(!node.isConnected)return;if(mini.defense===d&&d.paused){queueMiniTimeout(reducedCleanup,120);return;}cleanup();};queueMiniTimeout(reducedCleanup,apex?620:480);}return true;
  }
  function defenseVisibleProjectileCount(d=mini.defense){let count=0;for(const shot of d?.projectiles||[])if(shot.node||shot.renderVisible)count+=1;return count;}
  function fireDefenseTower(tower,target,stats){
    // Presentation vectors only; do not alter projectile origin or target selection.
    if(tower.node){const field=mini.defense,dx=(target.x-tower.x)*(field.renderWidth||390),dy=(target.y-tower.y)*(field.renderHeight||500),length=Math.hypot(dx,dy)||1,nx=dx/length,ny=dy/length,investment=tower.superForm?1.46:tower.upgrade>=4?1.30:tower.upgrade>=3?1.20:tower.upgrade>=2?1.12:tower.upgrade>=1?1.06:1;tower.node.style.setProperty("--kick-x",`${-nx*5*investment}px`);tower.node.style.setProperty("--kick-y",`${-ny*5*investment}px`);tower.node.style.setProperty("--soft-kick-x",`${-nx*2.5*investment}px`);tower.node.style.setProperty("--soft-kick-y",`${-ny*2.5*investment}px`);tower.node.style.setProperty("--heavy-kick-x",`${-nx*6.25*investment}px`);tower.node.style.setProperty("--heavy-kick-y",`${-ny*6.25*investment}px`);tower.node.style.setProperty("--lunge-x",`${nx*4*investment}px`);tower.node.style.setProperty("--lunge-y",`${ny*4*investment}px`);tower.node.style.setProperty("--heavy-lunge-x",`${nx*4.8*investment}px`);tower.node.style.setProperty("--heavy-lunge-y",`${ny*4.8*investment}px`);tower.node.style.setProperty("--aim-angle",`${Math.atan2(dy,dx)*180/Math.PI}deg`);}
    const d=mini.defense,variant=stats.variant,shotNumber=(tower.shots||0)+1,universal=defenseIsUniversalTower(tower),masteryTier=universal?0:defenseMasteryTierForPet(tower.petId);let damage=stats.damage*defenseAuroraBuff(tower),doctrineStrike=null,doubleStitch=false;
    if(universal){doubleStitch=tower.upgrade>=1&&shotNumber%DEFENSE_BASIC_TOWER.doubleStitchEvery===0;if(doubleStitch)damage*=1.42;if(tower.doctrine==="power"&&tower.upgrade>=2&&shotNumber%(tower.upgrade>=4?DEFENSE_BASIC_TOWER.powerApexEvery:DEFENSE_BASIC_TOWER.powerStrikeEvery)===0){damage*=tower.upgrade>=4?2.2:1.75;doctrineStrike="power";}else if(tower.doctrine==="control"&&tower.upgrade>=2&&shotNumber%(tower.upgrade>=4?DEFENSE_BASIC_TOWER.controlApexEvery:DEFENSE_BASIC_TOWER.controlStrikeEvery)===0)doctrineStrike="control";}else{if(variant==="classic"&&tower.upgrade>=1&&shotNumber%3===0)damage*=1.65;if(variant==="shadow"&&Math.random()<stats.crit+.18)damage*=2.25;if(variant==="glitch"&&Math.random()<.28)damage*=1.75;if(tower.doctrine==="power"&&tower.upgrade>=2&&shotNumber%(tower.upgrade>=4?4:5)===0){damage*=tower.upgrade>=4?2.1:1.7;doctrineStrike="power";}else if(tower.doctrine==="control"&&tower.upgrade>=2&&shotNumber%(tower.upgrade>=4?4:5)===0)doctrineStrike="control";}
    const projectile={id:`shot-${d.nextId++}`,tower,target,x:tower.x,y:tower.y,prevX:tower.x,prevY:tower.y,life:0,speed:universal?(doctrineStrike?2.25:1.95):(doctrineStrike?2.05:1.8),damage,kind:stats.projectile,doctrineStrike,doubleStitch,masteryTier,node:null,renderVisible:false,renderColor:defenseTowerDisplayColor(tower)},budget=defenseVisualBudget(d),real=defenseRealNow(d),visibleCount=defenseVisibleProjectileCount(d),visualInterval=1/Math.max(1,budget.projectileEmissionHz||10),visualReady=real>=(tower.nextVisualProjectileAtReal||0),visualAllowed=visualReady&&visibleCount<budget.maxVisibleProjectiles;
    tower.shots=shotNumber;
    // Logical projectiles are independent from presentation. A rapid-fire Rizo can
    // remain mathematically exact while only a representative subset gets a DOM
    // tracer. This is the largest v76 projectile-pressure reduction.
    if(d.projectiles.length>=160){d.coalescedLogicalShots=(d.coalescedLogicalShots||0)+1;applyDefenseHit(projectile);if(real>=(tower.nextAttackAnimAtReal||0)){animateDefenseTower(tower,doctrineStrike?"doctrine":"attack");tower.nextAttackAnimAtReal=real+visualInterval;}return;}
    if(visualAllowed){if(defenseUsesCanvas(d)){projectile.renderVisible=true;tower.nextVisualProjectileAtReal=real+visualInterval;}else{const node=acquireDefenseProjectileNode();if(node){node.className=`defense-shot shot-${stats.projectile} signature-${variant} mastery-shot-${masteryTier} ${doubleStitch?"shot-double-stitch":""} ${doctrineStrike?`shot-doctrine-${doctrineStrike}`:""}`;node.style.setProperty("--signature-color",projectile.renderColor);node.style.setProperty("--shot-angle",`${Math.atan2(target.y-tower.y,target.x-tower.x)}rad`);positionDefenseMovingNode(node,tower.x,tower.y);projectile.node=node;tower.nextVisualProjectileAtReal=real+visualInterval;}}}else d.coalescedVisualShots=(d.coalescedVisualShots||0)+1;
    d.projectiles.push(projectile);d.maxLogicalProjectilesObserved=Math.max(d.maxLogicalProjectilesObserved||0,d.projectiles.length);d.maxProjectileNodesObserved=Math.max(d.maxProjectileNodesObserved||0,defenseVisibleProjectileCount(d));
    if(projectile.node||projectile.renderVisible||doctrineStrike||real>=(tower.nextAttackAnimAtReal||0)){animateDefenseTower(tower,doctrineStrike?"doctrine":"attack");spawnDefenseMuzzleFx(tower,target);tower.nextAttackAnimAtReal=real+visualInterval;}
    if(projectile.node||projectile.renderVisible||doctrineStrike)defenseSignatureTone(tower,masteryTier,doctrineStrike);
  }
  function defenseRelaySupport(enemy,d=mini.defense){if(!enemy||enemy.dead||enemy.type==="relay")return 0;for(const support of d?.enemies||[]){if(support.dead||support.type!=="relay"||support.hp<=0)continue;if(Math.abs((support.progress||0)-(enemy.progress||0))<=.105)return 1;}return 0;}
  function collapseDefenseRelay(enemy,time=defenseNow()){const d=mini.defense;if(!d||!enemy)return 0;let affected=0;for(const other of d.enemies){if(other===enemy||other.dead||other.bossId||other.type==="relay"||Math.abs((other.progress||0)-(enemy.progress||0))>.12)continue;other.signalStaggerUntil=Math.max(other.signalStaggerUntil||0,time+1.05);other.relayBoosted=Boolean(defenseRelaySupport(other,d));affected+=1;updateDefenseEnemyNode(other);}if(affected&&!d.lowFx)spawnDefenseImpact(enemy.x,enemy.y,"control",0,null,{color:"#5fe0b7",enemyType:"relay",popWeight:1.1});return affected;}
  function pulseDefenseMender(enemy,time){if(!enemy?.healer||enemy.dead)return false;const relayLinked=Boolean(defenseRelaySupport(enemy)),interval=relayLinked?3.0:3.6,cycle=Math.floor((time+(enemy.phaseOffset||0))/interval);if(cycle===enemy.supportCycle)return false;enemy.supportCycle=cycle;const candidates=(mini.defense?.enemies||[]).filter(other=>other!==enemy&&!other.dead&&!other.bossId&&other.hp>0&&Math.abs((other.progress||0)-(enemy.progress||0))<=.13).map(other=>({other,armorNeed:Boolean(other.baseArmor>0&&!other.armorBroken&&other.armorShredded&&other.armor<other.baseArmor-.01),healthRatio:other.hp/other.maxHp})).filter(row=>row.armorNeed||row.healthRatio<.985).sort((a,b)=>Number(b.armorNeed)-Number(a.armorNeed)||a.healthRatio-b.healthRatio||b.other.progress-a.other.progress),row=candidates[0];if(!row)return false;const target=row.other,heal=Math.min(target.maxHp-target.hp,target.maxHp*(relayLinked?.085:.075)+Math.max(0,(mini.defense.currentWave||1)-30)*.03);let repaired=false;if(row.armorNeed){target.armor=Math.min(target.baseArmor,target.armor+Math.max(.025,target.baseArmor*.24));if(target.armor>=target.baseArmor-.012){target.armor=target.baseArmor;target.armorShredded=false;}repaired=true;}if(heal>0)target.hp+=heal;if(!repaired&&heal<=0)return false;target.hitFlash=.06;enemy.supportFlashUntil=time+.42;spawnDefenseImpact(target.x,target.y,"aurora",0,null,{color:repaired?"#ffd0e8":"#ff9fcf",enemyType:"mender",popWeight:.8});updateDefenseEnemyNode(enemy);updateDefenseEnemyNode(target);markDefenseUi();return true;}
  function dealDefenseDamage(enemy,raw,tower,kind="classic",ignoreArmor=false){if(!enemy||enemy.dead||enemy.hp<=0)return 0;const d=mini.defense,phase=enemy.phaseActive?.34:1,variant=tower?(tower.pet.variant||tower.pet.hiddenVariant||"classic"):null,camoActive=defenseEnemyCamoActive(enemy),mapSight=Boolean(tower&&defenseMapBondForTower(tower,d)?.camoSight),camoMultiplier=camoActive&&tower&&!mapSight&&!['shadow','aurora','glitch'].includes(variant)&&tower.upgrade<2?.25:1,penetration=tower?(variant==="diamond"?.65:variant==="obsidian"?.35:tower.doctrine==="power"?.28:0):0,relayGuard=defenseRelaySupport(enemy,d),effectiveArmor=ignoreArmor?0:Math.min(.72,Math.max(0,(enemy.armor||0)*(1-penetration))+(relayGuard?.10:0)),calculated=Math.max(0,raw*(1-effectiveArmor)*phase*camoMultiplier),dealt=Math.min(enemy.hp,calculated);enemy.hp-=dealt;enemy.hitFlash=.12;if(tower){enemy.hitFromX=tower.x;enemy.hitFromY=tower.y;tower.damage+=dealt;d.totalDamage+=dealt;}markDefenseUi();if(enemy.hp<=0)popDefenseEnemy(enemy,tower);else{applyDefenseEnemyThresholds(enemy,tower);spawnDefenseImpact(enemy.x,enemy.y,kind,0,tower);}return dealt;}
  function dealDefenseDot(enemy,raw,tower,kind){if(!enemy||enemy.dead||enemy.hp<=0||raw<=0)return 0;const dealt=Math.min(enemy.hp,raw);enemy.hp-=dealt;enemy.hitFlash=.08;if(tower&&mini.defense.towers.includes(tower)){tower.damage+=dealt;mini.defense.totalDamage+=dealt;}markDefenseUi();if(enemy.hp<=0)popDefenseEnemy(enemy,tower&&mini.defense.towers.includes(tower)?tower:null);return dealt;}
  function applyDefenseHit(projectile){
    const {target,tower}=projectile;if(!target||target.dead||target.hp<=0)return;
    const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",time=defenseNow();
    let raw=projectile.damage;
    if(defenseIsUniversalTower(tower)){
      const level=tower.upgrade,restrainedBefore=defenseBasicRestrained(target,time),openedBefore=defenseBasicOpened(target);if(projectile.doctrineStrike==="power"&&restrainedBefore)raw*=level>=4?1.32:1.18;
      const dealt=dealDefenseDamage(target,raw,tower,projectile.doctrineStrike||"defense-basic");
      if(projectile.doubleStitch){const mate=defenseProgressTargetsNear(target,.09,1)[0];if(mate){defenseBasicLinkFlash(target,mate,"stitch");dealDefenseDamage(mate,raw*.48,tower,"defense-basic");spawnDefenseImpact(mate.x,mate.y,"defense-basic",1,tower);}}
      if(projectile.doctrineStrike==="power"){
        shredDefenseArmor(target,level>=4?.13:.07,tower);const splash=level>=4?defenseBasicRivetTargets(target,.15,2):defenseProgressTargetsNear(target,.09,2);splash.forEach(enemy=>{defenseBasicLinkFlash(target,enemy,"power");shredDefenseArmor(enemy,level>=4?.06:.03,tower);dealDefenseDamage(enemy,raw*(level>=4?.58:.32),tower,"power");spawnDefenseImpact(enemy.x,enemy.y,"power",0,tower);});
      }else if(projectile.doctrineStrike==="control"){
        const combo=openedBefore,strength=level>=4?.54:.40,rootBonus=combo?.42:0,rewindBonus=combo?.012:0;target.slow=Math.max(target.slow,strength*(1-(target.slowResist||0)));target.slowUntil=Math.max(target.slowUntil,time+(level>=4?2.5:1.8));revealDefenseEnemy(target,level>=4?4.2:2.8,tower);if(level>=3)target.rootUntil=Math.max(target.rootUntil,time+(level>=4?.95:.62)+rootBonus);if(level>=4&&!target.bossId)target.progress=Math.max(0,target.progress-(.024+rewindBonus));
        if(level>=3){const threaded=defenseBasicThreadTargets(target,level>=4?.15:.11,level>=4?3:1);threaded.forEach((enemy,index)=>{defenseBasicLinkFlash(index?threaded[index-1]:target,enemy,"control");enemy.slow=Math.max(enemy.slow,(level>=4?.30:.22)*(1-(enemy.slowResist||0)));enemy.slowUntil=Math.max(enemy.slowUntil,time+(level>=4?1.7:1.15));enemy.rootUntil=Math.max(enemy.rootUntil,time+(level>=4?.42:.24)+(defenseBasicOpened(enemy)?.18:0));if(level>=4&&!enemy.bossId)enemy.progress=Math.max(0,enemy.progress-.010);spawnDefenseImpact(enemy.x,enemy.y,"control",index,tower);});}
        spawnDefenseImpact(target.x,target.y,"control",0,tower);
      }else if(level>=3&&tower.doctrine==="power")shredDefenseArmor(target,.032,tower);
      if(dealt>0&&target.bossId&&tower.doctrine==="control")disruptDefenseBossTelegraph(target,tower,level>=4?.34:.22);return;
    }
    if(variant==="ember"&&target.fireproof)raw*=.68;
    if(variant==="frost"&&target.fireproof)raw*=1.22;
    // Chill sets up the heavy hitter. It is consumed, so two Cold Shoulders
    // cannot turn a Warden into a permanently frozen damage multiplier.
    if(variant==="obsidian"&&target.slowUntil>time&&target.slow>=.3){raw*=1.35;target.slowUntil=time;spawnDefenseImpact(target.x,target.y,"frost",0,tower);}
    if(variant==="obsidian"&&tower.upgrade>=1)shredDefenseArmor(target,.08,tower);
    const dealt=dealDefenseDamage(target,raw,tower,projectile.doctrineStrike||variant);
    if(dealt>0&&target.bossId&&tower.doctrine==="control")disruptDefenseBossTelegraph(target,tower,.3+tower.upgrade*.06);
    // Area attacks carry their own energy. Killing a 1-HP front target must
    // not erase the chain/splash, or scale the rest of the hit down to 1 HP.
    if(variant==="violet"){
      const hit=new Set([target]);let origin=target,energy=raw*.72;
      for(let hop=0;hop<(tower.upgrade>=1?3:2);hop++){
        const next=mini.defense.enemies.filter(e=>!e.dead&&!hit.has(e)&&Math.hypot(e.x-origin.x,e.y-origin.y)<.17).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0];
        if(!next)break;hit.add(next);defenseChainFlash(origin,next,tower);dealDefenseDamage(next,energy,tower,"violet");origin=next;energy*=.8;
      }
    }else if(variant==="diamond"||variant==="obsidian"){
      const radius=variant==="diamond"?.13:.075,scale=variant==="diamond"?.58:.42;
      defenseProgressTargetsNear(target,radius,2).forEach(e=>dealDefenseDamage(e,raw*scale,tower,variant));
    }
    if(variant==="frost"&&tower.upgrade>=1){
      defenseProgressTargetsNear(target,.10,3).forEach(e=>{e.slow=Math.max(e.slow,.32*(1-(e.slowResist||0)));e.slowUntil=Math.max(e.slowUntil,time+1.8);spawnDefenseImpact(e.x,e.y,"frost",0,tower);});
    }
    if(projectile.doctrineStrike==="power"){
      defenseProgressTargetsNear(target,.105,tower.upgrade>=4?3:2).forEach(e=>{shredDefenseArmor(e,.035,tower);dealDefenseDamage(e,raw*.28,tower,"power");});
    }
    if(target.dead)return;
    if(variant==="ember"&&!target.fireproof){const burn=raw*.16;if(burn>=target.burn){target.burn=burn;target.burnSource=tower;}target.burnUntil=time+3.2*(tower.doctrine==="control"?1.28:1);}
    if(variant==="toxic"){const poison=raw*.12;if(poison>=target.poison){target.poison=poison;target.poisonSource=tower;}target.poisonUntil=time+5*(tower.doctrine==="control"?1.28:1);}
    if(variant==="frost"){target.slow=Math.max(target.slow,.42*(1-(target.slowResist||0)));target.slowUntil=time+2.6*(tower.doctrine==="control"?1.28:1);}
    if(variant==="moss")target.rootUntil=Math.max(target.rootUntil,time+(.55+tower.upgrade*.12)*(tower.doctrine==="control"?1.28:1));
    if(variant==="bubblegum")target.progress=Math.max(0,target.progress-(.026+tower.upgrade*.006)*(tower.doctrine==="control"?1.28:1));
    if(variant==="glitch"&&(target.phasing||defenseEnemyCamoActive(target,time))&&Math.random()<.38)revealDefenseEnemy(target,1.4,tower);
    if(projectile.doctrineStrike==="power")shredDefenseArmor(target,tower.upgrade>=4?.07:.045,tower);
    if(projectile.doctrineStrike==="control"){
      target.slow=Math.max(target.slow,(tower.upgrade>=4?.45:.34)*(1-(target.slowResist||0)));
      target.slowUntil=Math.max(target.slowUntil,time+(tower.upgrade>=4?1.8:1.35));
      revealDefenseEnemy(target,tower.upgrade>=4?3.6:2.6,tower);
      if(tower.upgrade>=4&&!target.bossId)target.progress=Math.max(0,target.progress-.018);
      spawnDefenseImpact(target.x,target.y,"control",0,tower);
    }
  }
  function defenseChainFlash(from,to,tower){
    const d=mini.defense;if(d.effects.length>=defenseVisualBudget(d).maxImpactEffects)return;
    d.maxEffectNodesObserved=Math.max(d.maxEffectNodesObserved||0,d.effects.length+1);
    if(defenseUsesCanvas(d)){d.effects.push({kind:"chain",x:from.x,y:from.y,toX:to.x,toY:to.y,color:"#ca9aff",startedAt:d.clock,expiresAt:d.clock+.16});return;}
    const node=acquireDefenseImpactNode();if(!node)return;
    const dx=(to.x-from.x)*(d.renderWidth||390),dy=(to.y-from.y)*(d.renderHeight||390);
    node.className="defense-chain-link";node.style.left=`${from.x*100}%`;node.style.top=`${from.y*100}%`;node.style.width=`${Math.hypot(dx,dy)}px`;node.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
    const effect={node,expiresAt:d.clock+.16};d.effects.push(effect);
  }
  function acquireDefenseImpactNode(){
    const d=mini.defense,host=$("#defenseEffects");if(!d||!host)return null;let node=d.impactNodePool.pop();if(!node){node=document.createElement("i");d.impactNodesCreated=(d.impactNodesCreated||0)+1;}node.hidden=false;node.removeAttribute("style");node.className="defense-impact";host.appendChild(node);d.impactNodesAcquired=(d.impactNodesAcquired||0)+1;return node;
  }
  function releaseDefenseImpactNode(node,owner=mini.defense){if(!node)return;node.remove();node.hidden=true;node.className="defense-impact";node.removeAttribute("style");if(owner&&owner===mini.defense&&owner.impactNodePool.length<36)owner.impactNodePool.push(node);}
  function spawnDefenseImpact(x,y,kind="classic",index=0,tower=null,options={}){const d=mini.defense;if(!d)return;const budget=defenseVisualBudget(d),host=$("#defenseEffects");if(!host||d.effects.length>=budget.maxImpactEffects){d.droppedCosmetics=(d.droppedCosmetics||0)+1;return;}const major=["boss","crown","vortex","mirror","apex","gate"].includes(kind),muzzle=kind==="muzzle",resonance=["flashover","bloom","crystal","shatter"].includes(kind),duration=major?.46:(kind==="pop"||kind==="bubble")?.36:resonance?.34:muzzle?.14:.20,safeX=clamp(Number(x)||0,.022,.978),safeY=clamp(Number(y)||0,.022,.978),variant=tower?(tower.pet.variant||tower.pet.hiddenVariant||"classic"):String(options.variant||"classic"),color=String(options.color|| (tower?defenseTowerDisplayColor(tower):"#fff2cf")),angle=Number(options.angle)||0,enemyType=String(options.enemyType||""),impulseX=clamp(Number(options.impulseX)||0,-1,1),impulseY=clamp(Number(options.impulseY)||0,-1,1),routeX=clamp(Number(options.routeX)||0,-1,1),routeY=clamp(Number(options.routeY)||0,-1,1),popWeight=clamp(Number(options.popWeight)||1,.75,1.45);if(defenseUsesCanvas(d)){const effect={node:null,x:safeX,y:safeY,kind,index,color,variant,angle,enemyType,major,impulseX,impulseY,routeX,routeY,popWeight,startedAt:defenseNow(),expiresAt:defenseNow()+duration};d.effects.push(effect);d.maxEffectNodesObserved=Math.max(d.maxEffectNodesObserved||0,d.effects.length);queueMiniTimeout(()=>removeDefenseRuntimeItem(d.effects,effect),Math.ceil(duration*1000)+30);return;}const node=acquireDefenseImpactNode();if(!node)return;node.className=`defense-impact impact-${kind} impact-variant-${variant}${enemyType?` impact-enemy-${enemyType}`:""}`;node.style.left=`${safeX*100}%`;node.style.top=`${safeY*100}%`;node.style.setProperty("--impact-index",index);node.style.setProperty("--impact-life",`${duration}s`);node.style.setProperty("--impact-color",color);node.style.setProperty("--impact-angle",`${angle}rad`);node.style.setProperty("--impact-bias-x",`${impulseX}`);node.style.setProperty("--impact-bias-y",`${impulseY}`);host.appendChild(node);const effect={node,x:safeX,y:safeY,kind,index,color,variant,angle,enemyType,major,impulseX,impulseY,routeX,routeY,popWeight,startedAt:defenseNow(),expiresAt:defenseNow()+duration};d.effects.push(effect);d.maxEffectNodesObserved=Math.max(d.maxEffectNodesObserved||0,d.effects.length);queueMiniTimeout(()=>{if(d.effects.includes(effect)){removeDefenseRuntimeItem(d.effects,effect);releaseDefenseImpactNode(effect.node);}},Math.ceil(duration*1000)+20);}
  function spawnDefenseMuzzleFx(tower,target){if(!tower||!target)return;const d=mini.defense;if(!d||d.lowFx)return;const budget=defenseVisualBudget(d);if(d.effects.length>=Math.max(1,budget.maxImpactEffects-1))return;const dx=(target.x-tower.x)*(d.renderWidth||390),dy=(target.y-tower.y)*(d.renderHeight||500);spawnDefenseImpact(tower.x,tower.y,"muzzle",0,tower,{angle:Math.atan2(dy,dx)});}


  function removeDefenseRuntimeItem(list,item){const index=list.indexOf(item);if(index>=0)list.splice(index,1);}
  function removeDefenseEnemy(enemy){enemy.dead=true;releaseDefenseEnemyNode(enemy);removeDefenseRuntimeItem(mini.defense.enemies,enemy);removeDefenseRuntimeItem(mini.entities,enemy);}
  function popDefenseEnemy(enemy,tower=null){if(enemy.dead)return;enemy.dead=true;const d=mini.defense,key=enemy.bossId?`boss:${enemy.bossId}`:enemy.type;queueDefenseIncome(Math.round(enemy.reward*defenseGoldenBonus()),enemy.bossId?"boss":"pop");d.kills+=1;d.waveResolved+=1;defenseRecordEnemyStat("popped",key);mini.hits+=1;markDefenseUi({roster:true});mini.score=Math.max(mini.score,d.clearedWave);if(tower)tower.kills+=1;const routeDx=(enemy.x-(Number.isFinite(enemy.prevX)?enemy.prevX:enemy.x)),routeDy=(enemy.y-(Number.isFinite(enemy.prevY)?enemy.prevY:enemy.y)),routeLen=Math.hypot(routeDx,routeDy)||1,routeX=routeDx/routeLen,routeY=routeDy/routeLen;const hitDx=tower?(enemy.x-tower.x):routeX,hitDy=tower?(enemy.y-tower.y):routeY,hitLen=Math.hypot(hitDx,hitDy)||1,impulseX=hitDx/hitLen,impulseY=hitDy/hitLen,weight=enemy.bossId?1.45:(enemy.type==="lead"||enemy.type==="brick")?1.28:(enemy.type==="shell"||enemy.type==="fire")?1.14:enemy.type==="fleet"?.9:1,popAngle=Math.atan2(impulseY,impulseX),popKind=enemy.bossId?"heavy":(enemy.type==="fleet"?"fleet":enemy.type==="split"?"split":enemy.type==="fire"?"fire":enemy.type==="shell"?"shell":enemy.type==="ghost"?"ghost":(enemy.type==="lead"||enemy.type==="brick")?"heavy":"base");if(enemy.node){enemy.node.classList.add("popped",`pop-${popKind}`);enemy.node.style.setProperty("--pop-angle",`${popAngle}rad`);enemy.node.style.setProperty("--pop-bias-x",`${impulseX.toFixed(3)}`);enemy.node.style.setProperty("--pop-bias-y",`${impulseY.toFixed(3)}`);enemy.node.style.setProperty("--pop-weight",`${weight.toFixed(3)}`);}if(!d.lowFx||enemy.bossId){spawnDefenseImpact(enemy.x,enemy.y,enemy.bossId?enemy.bossId:enemy.type==="split"?"bubble":"pop",0,tower,{color:enemy.renderColor||"#ff657c",enemyType:enemy.type,angle:popAngle,impulseX,impulseY,routeX,routeY,popWeight:weight});}
  if(enemy.type==="relay")collapseDefenseRelay(enemy,defenseNow());queueMiniTimeout(()=>releaseDefenseEnemyNode(enemy),enemy.bossId?280:185);removeDefenseRuntimeItem(d.enemies,enemy);removeDefenseRuntimeItem(mini.entities,enemy);if(enemy.type==="split"){d.waveTotal+=2;queueDefenseChildSpawn("puff",{progress:enemy.progress,delay:.08});queueDefenseChildSpawn("fleet",{progress:Math.max(0,enemy.progress-.018),delay:.16});}if(enemy.bossId){d.bossesBeaten.push(enemy.bossId);d.bossesDefeated=(d.bossesDefeated||0)+1;defenseBossStagePulse("defeat",enemy.bossId,760);showDefenseCinematicMoment("clear",{title:d.currentWave>30?`REMIX ${Math.max(1,(enemy.bossIntensity||0)+1)} BROKEN`:"BOSS POPPED",copy:(DEFENSE_BOSSES.find(item=>item.id===enemy.bossId)?.name||"BOSS")+" IS OFF THE TRAIL",priority:7,duration:1100});duckMusic(980,.07);defenseBossCue("down",enemy.bossId);defenseHaptic("bossDown");}else if(defenseRealNow(d)-d.lastPopSfxAt>.075){d.lastPopSfxAt=defenseRealNow(d);if(popKind==="heavy")sfx("defense-pop-heavy",weight);else if(popKind==="split")sfx("defense-pop-split");else sfx("defense-pop",weight);}}
  function triggerCrownGuards(enemy){const tier=Math.max(0,enemy.bossIntensity||0),lastStand=(enemy.bossPhase||0)>=1;enemy.phaseTriggered=true;enemy.bossPhase=lastStand?2:1;const guards=lastStand?["brick","relay","mender"]:tier>=2?["lead","relay","shell","mender"]:tier>=1?["lead","relay","shell"]:["shell","shell"];mini.defense.waveTotal+=guards.length;guards.forEach((type,index)=>queueDefenseChildSpawn(type,{progress:clamp(enemy.progress+(index-(guards.length-1)/2)*.018,0,.98),delay:.08+index*.10}));markDefenseUi();setDefenseMessage(lastStand?"THE WARDEN'S LAST GUARD":tier?"THE WARDEN CHANGED THE GUARD":"THE WARDEN CALLED GUARDS",lastStand?"Its final formation is smaller but self-supporting. Break the Relay before the Mender rebuilds the wall.":tier?"The returning Warden brought support into the escort. Break the signal, then crack the wall.":"Two armored escorts are joining the trail.");spawnDefenseImpact(enemy.x,enemy.y,"boss");}
  function triggerVortexPulse(enemy){const d=mini.defense,time=defenseNow(),tier=Math.max(0,enemy.bossIntensity||0),radius=.32+Math.min(.10,tier*.025),duration=2.5+Math.min(1.4,tier*.28);enemy.bossPhase=(enemy.bossPhase||0)+1;enemy.nextBossPulse=time+Math.max(2.8,4-tier*.12);for(const tower of d.towers){if(Math.hypot(tower.x-enemy.x,tower.y-enemy.y)<radius){tower.rangeDebuffUntil=Math.max(tower.rangeDebuffUntil,time+duration);tower.node?.classList.add("range-weakened");}}if(tier>=4&&enemy.bossPhase<=6&&enemy.bossPhase%2===0){const type=enemy.bossPhase%4===0?"mender":"relay";d.waveTotal+=1;queueDefenseChildSpawn(type,{progress:clamp(enemy.progress-.025,0,.98),delay:.14});}const ring=document.createElement("i");ring.className="defense-vortex-pulse";ring.style.left=`${enemy.x*100}%`;ring.style.top=`${enemy.y*100}%`;$("#defenseEffects")?.appendChild(ring);queueMiniTimeout(()=>ring.remove(),850);setDefenseMessage(tier>=4&&enemy.bossPhase%2===0?"THE MAW PULLED SOMETHING THROUGH":tier?"THE MAW LEARNED YOUR RANGE":"THE MAW DISTORTS THE FIELD",tier>=4&&enemy.bossPhase%2===0?"The collapse now drags support into its wake. The pulse and the escort are one problem.":tier?`RANGE COLLAPSE ${duration.toFixed(1)}S • THE REMIX PULSE REACHES FARTHER.`:"NEARBY RIZO RANGE IS WEAKENED FOR 2.5 SECONDS.");}
  function splitMirrorBoss(enemy){enemy.phaseTriggered=true;const remaining=Math.max(1,enemy.hp),progress=enemy.progress,intensity=enemy.bossIntensity,tier=Math.max(0,intensity||0),parts=tier>=3?3:2,share=1/parts,echoes=tier>=5?["ghost","shade"]:[];removeDefenseEnemy(enemy);mini.defense.waveTotal+=parts-1+echoes.length;for(let index=0;index<parts;index+=1){const offset=(index-(parts-1)/2)*.024;queueDefenseChildSpawn({type:"boss",bossId:"mirror",intensity},{progress:clamp(progress+offset,0,.98),delay:.08+index*.12,options:{bossChild:true,hpOverride:remaining*share,maxHpOverride:remaining*share,rewardScale:share}});}echoes.forEach((type,index)=>queueDefenseChildSpawn(type,{progress:clamp(progress-.018-index*.012,0,.98),delay:.20+index*.14}));setDefenseMessage(echoes.length?"MIRROR FRACTURED WITH ECHOES":parts===3?"MIRROR FRACTURED THREE WAYS":"MIRROR SPLIT",echoes.length?"Late remixes hide real phase threats inside the reflections. Clean up the echoes before they steal the road.":parts===3?"The Endless remix divides its remaining mass across three sequential reflections.":"The two children are released sequentially so the visual node budget remains stable.");}
  function beginDefenseBossTelegraph(enemy,kind){const data=DEFENSE_BOSS_TELEGRAPHS[kind];if(!enemy?.bossId||enemy.dead||!data||enemy.telegraphKind)return false;const time=defenseNow();enemy.telegraphKind=kind;enemy.telegraphStartedAt=time;enemy.telegraphUntil=time+data.duration;enemy.telegraphDisruption=0;updateDefenseEnemyNode(enemy);setDefenseMessage(data.title,data.copy);enemy.node?.classList.add("feel-boss-windup");defenseBossStagePulse("phase",enemy.bossId,Math.min(900,Math.max(420,data.duration*420)));defenseBossCue("phase",enemy.bossId);defenseHaptic("bossWarn");return true;}
  function clearDefenseBossTelegraph(enemy,interrupted=false){if(!enemy?.telegraphKind)return false;const kind=enemy.telegraphKind,time=defenseNow();enemy.telegraphKind=null;enemy.telegraphStartedAt=0;enemy.telegraphUntil=0;enemy.telegraphDisruption=0;if(interrupted){if(kind==="guards"||kind==="mirror")enemy.phaseTriggered=true;if(kind==="vortex")enemy.nextBossPulse=time+4;if(kind==="apex")enemy.nextBossPulse=time+4.5;enemy.bossMechanicLocked=true;mini.defense.enemyStats.counters.bossInterrupts=(mini.defense.enemyStats.counters.bossInterrupts||0)+1;setDefenseMessage("BOSS SIGNAL BROKEN","CONTROL doctrine cancelled the mechanic before it resolved.");spawnDefenseImpact(enemy.x,enemy.y,"control");enemy.node?.classList.remove("feel-boss-windup");duckMusic(460,.1);defenseBossCue("break",enemy.bossId);defenseHaptic("bossBreak");}updateDefenseEnemyNode(enemy);markDefenseUi();return true;}
  function disruptDefenseBossTelegraph(enemy,tower,amount=.35){const data=DEFENSE_BOSS_TELEGRAPHS[enemy?.telegraphKind];if(!data?.interruptible||tower?.doctrine!=="control"||enemy.dead)return false;enemy.telegraphDisruption=clamp((enemy.telegraphDisruption||0)+Math.max(.05,Number(amount)||0),0,1);if(enemy.telegraphDisruption>=1)return clearDefenseBossTelegraph(enemy,true);updateDefenseEnemyNode(enemy);markDefenseUi();return true;}
  function resolveDefenseBossTelegraph(enemy){const kind=enemy?.telegraphKind;if(!kind)return false;enemy.telegraphKind=null;enemy.telegraphStartedAt=0;enemy.telegraphUntil=0;enemy.telegraphDisruption=0;enemy.node?.classList.remove("feel-boss-windup");if(kind==="guards")triggerCrownGuards(enemy);else if(kind==="mirror")splitMirrorBoss(enemy);else if(kind==="vortex")triggerVortexPulse(enemy);else if(kind==="apex"){const time=defenseNow(),tier=Math.max(0,enemy.bossIntensity||0),duration=1.4+Math.min(.9,tier*.18);enemy.bossPhase=(enemy.bossPhase||0)+1;enemy.apexSurgeUntil=time+duration;enemy.nextBossPulse=time+Math.max(3.2,4.5-tier*.12);if(tier>=1&&enemy.bossPhase<=4){const escorts=tier>=4&&enemy.bossPhase%2===0?["fleet","lead","mender"]:tier>=3?["storm","fleet","relay"]:["fleet","storm"];mini.defense.waveTotal+=escorts.length;escorts.forEach((type,index)=>queueDefenseChildSpawn(type,{progress:clamp(enemy.progress-.02-index*.012,0,.98),delay:.10+index*.10}));}setDefenseMessage(tier>=4&&enemy.bossPhase%2===0?"REDLINE SWITCHED LANES":tier?"REDLINE REMIX SURGE":"REDLINE SURGE",tier>=4&&enemy.bossPhase%2===0?"The next burst trades pure speed for a protected repair escort. Re-target instead of repeating the last answer.":tier?"The burst drags a fast escort into the same decision window. Hold CONTROL for the whole event.":"THE WIND-UP COMPLETED. HOLD THE FRONT UNTIL THE BURST ENDS.");spawnDefenseImpact(enemy.x,enemy.y,"boss");}defenseBossCue("resolve",enemy.bossId);markDefenseUi();return true;}
  function handleDefenseBossMechanics(enemy){if(!enemy.bossId||enemy.dead)return;const time=defenseNow(),ratio=enemy.hp/enemy.maxHp;if(enemy.telegraphKind){if(time>=enemy.telegraphUntil)resolveDefenseBossTelegraph(enemy);return;}if(enemy.bossId==="crown"&&!enemy.phaseTriggered&&ratio<=(enemy.bossIntensity? .62:.5))beginDefenseBossTelegraph(enemy,"guards");else if(enemy.bossId==="crown"&&enemy.bossIntensity>=4&&(enemy.bossPhase||0)===1&&!enemy.bossMechanicLocked&&ratio<=.28)beginDefenseBossTelegraph(enemy,"guards");else if(enemy.bossId==="mirror"&&!enemy.bossChild&&!enemy.phaseTriggered&&ratio<=(enemy.bossIntensity? .60:.5))beginDefenseBossTelegraph(enemy,"mirror");else if(enemy.bossId==="vortex"&&time>=enemy.nextBossPulse)beginDefenseBossTelegraph(enemy,"vortex");else if(enemy.bossId==="apex"&&time>=enemy.nextBossPulse)beginDefenseBossTelegraph(enemy,"apex");}
  function applyDefenseControlActive(tower,variant,stats,time,near,front){const d=mini.defense,targets=(near.length?near:front.slice(0,10)).filter(e=>e.hp>0),root=(enemy,seconds)=>enemy.rootUntil=Math.max(enemy.rootUntil||0,time+seconds),slow=(enemy,amount,seconds)=>{enemy.slow=Math.max(enemy.slow||0,amount*(1-(enemy.slowResist||0)));enemy.slowUntil=Math.max(enemy.slowUntil||0,time+seconds);};if(variant==="classic")front.slice(0,7).forEach(e=>{root(e,1.6);slow(e,.42,4);});else if(variant==="ember")front.slice(0,8).forEach(e=>{slow(e,.48,5);if(!e.fireproof){e.burn=Math.max(e.burn||0,stats.damage*.16);e.burnSource=tower;e.burnUntil=Math.max(e.burnUntil||0,time+5);}});else if(variant==="toxic")front.slice(0,10).forEach(e=>{slow(e,.55,6);e.poison=Math.max(e.poison||0,stats.damage*.18);e.poisonSource=tower;e.poisonUntil=Math.max(e.poisonUntil||0,time+7);});else if(variant==="violet")front.slice(0,8).forEach((e,i)=>{root(e,1.2+i*.08);revealDefenseEnemy(e,4,tower);});else if(variant==="moss")targets.slice(0,12).forEach(e=>root(e,4.4));else if(variant==="bubblegum")front.slice(0,10).forEach(e=>{e.progress=Math.max(0,e.progress-.20);slow(e,.25,3);});else if(variant==="frost")front.slice(0,10).forEach(e=>{root(e,2.4);slow(e,.75,6);});else if(variant==="glitch")front.slice(0,12).forEach(e=>{revealDefenseEnemy(e,6,tower);root(e,1.4);});else if(variant==="obsidian")front.slice(0,8).forEach(e=>{root(e,1.8);shredDefenseArmor(e,.12,tower);});else if(variant==="aurora"){d.prismUntil=Math.max(d.prismUntil,time+7);front.slice(0,12).forEach(e=>revealDefenseEnemy(e,7,tower));}else if(variant==="golden"){front.slice(0,9).forEach(e=>slow(e,.52,5));queueDefenseIncome(Math.max(12,Math.round((d.clearedWave+1)*2.2)),"golden-control");}else if(variant==="diamond")front.sort((a,b)=>defenseEnemyThreat(b)-defenseEnemyThreat(a)).slice(0,6).forEach(e=>{root(e,3);shredDefenseArmor(e,.10,tower);});else if(variant==="shadow")front.slice(0,8).forEach(e=>{e.progress=Math.max(0,e.progress-.08);revealDefenseEnemy(e,5,tower);slow(e,.42,5);});else if(variant==="retro")front.slice(0,10).forEach(e=>{e.progress=Math.max(0,e.progress-.15);});targets.slice(0,10).forEach(e=>spawnDefenseImpact(e.x,e.y,variant,0,tower));}
  function activateDefenseAbility(id,{keepAbilityTray=false,showPanel=true}={}){
    const d=mini.defense,tower=d.towers.find(item=>item.id===id);if(defenseContractRule("silent",d)){setDefenseMessage("CONTRACT • SEALED ACTIVES","Passive identity still works, but activated effects are disabled.");sfx("no");return false;}if(!tower||tower.upgrade<2||!tower.doctrine||!defenseIsActiveWave(d)||d.paused||defenseAbilityRemaining(tower)>0)return false;const variant=tower.pet.variant||tower.pet.hiddenVariant||"classic",stats=defenseCombatStats(tower),time=defenseNow(),power=tower.doctrine==="power"?1.28:1,control=tower.doctrine==="control"?1.28:1,near=d.enemies.filter(enemy=>enemy.hp>0&&Math.hypot(enemy.x-tower.x,enemy.y-tower.y)<Math.max(.28,stats.range*1.75)),front=[...d.enemies].filter(enemy=>enemy.hp>0).sort((a,b)=>b.progress-a.progress),apex=tower.upgrade>=4,preStatus=apex?{burn:new Set(front.filter(enemy=>enemy.burnUntil>time).map(enemy=>enemy.id)),poison:new Set(front.filter(enemy=>enemy.poisonUntil>time).map(enemy=>enemy.id)),controlled:new Set(front.filter(enemy=>enemy.slowUntil>time||enemy.rootUntil>time).map(enemy=>enemy.id))}:null;tower.abilityReadyAt=time+defenseAbilityCooldown(tower)*(tower.superForm?.7:1);animateDefenseTower(tower,"ability");spawnDefenseAbilityFx(tower,variant);
    if(tower.doctrine==="control")applyDefenseControlActive(tower,variant,stats,time,near,front);else if(variant==="classic")d.rallyUntil=time+6;else if(variant==="ember")near.forEach(enemy=>{const flashover=apex&&preStatus.burn.has(enemy.id),dealt=dealDefenseDamage(enemy,stats.damage*(flashover?2.72:2.1)*power,tower,"ember");if(flashover)spawnDefenseImpact(enemy.x,enemy.y,"flashover",0,tower);if(!enemy.fireproof&&!enemy.dead){const burn=dealt*.28;if(burn>=enemy.burn){enemy.burn=burn;enemy.burnSource=tower;}enemy.burnUntil=time+5;}});else if(variant==="toxic")front.forEach(enemy=>{const bloom=apex&&preStatus.poison.has(enemy.id),poison=stats.damage*.34*power;if(poison>=enemy.poison){enemy.poison=poison;enemy.poisonSource=tower;}enemy.poisonUntil=time+7*control;if(bloom&&!enemy.dead){dealDefenseDot(enemy,Math.max(poison*.75,enemy.poison*.9),tower,"toxic");spawnDefenseImpact(enemy.x,enemy.y,"bloom",0,tower);}else spawnDefenseImpact(enemy.x,enemy.y,"toxic",0,tower);});else if(variant==="violet"){let origin={x:tower.x,y:tower.y};front.slice(0,6).forEach((enemy,index)=>{defenseChainFlash(origin,enemy,tower);dealDefenseDamage(enemy,stats.damage*(2.15-index*.12)*power,tower,"violet");origin=enemy;});}else if(variant==="moss")near.forEach(enemy=>{enemy.rootUntil=Math.max(enemy.rootUntil,time+(3.2+tower.upgrade*.25)*control);spawnDefenseImpact(enemy.x,enemy.y,"moss",0,tower);});else if(variant==="bubblegum")near.forEach(enemy=>{enemy.progress=Math.max(0,enemy.progress-(.12+tower.upgrade*.018)*control);dealDefenseDamage(enemy,stats.damage*.9*power,tower,"bubblegum");spawnDefenseImpact(enemy.x,enemy.y,"bubblegum",0,tower);});else if(variant==="frost")front.forEach(enemy=>{const crystal=apex&&preStatus.controlled.has(enemy.id);enemy.rootUntil=Math.max(enemy.rootUntil,time+(crystal?2.35:1.2)*control);enemy.slow=Math.max(enemy.slow,.72*(1-(enemy.slowResist||0)));enemy.slowUntil=time+5*control;spawnDefenseImpact(enemy.x,enemy.y,crystal?"crystal":"frost",0,tower);});else if(variant==="glitch"){for(let i=0;i<8;i+=1){const enemy=front[Math.floor(Math.random()*front.length)];if(enemy)dealDefenseDamage(enemy,stats.damage*(1.25+Math.random()*1.4)*power,tower,"glitch");}}else if(variant==="obsidian")near.forEach(enemy=>{const shatter=apex&&preStatus.controlled.has(enemy.id);dealDefenseDamage(enemy,stats.damage*4.2*(shatter?1.35:1)*power,tower,"obsidian");if(shatter){enemy.slowUntil=time;enemy.rootUntil=time;spawnDefenseImpact(enemy.x,enemy.y,"shatter",0,tower);}});else if(variant==="aurora")d.prismUntil=time+8*control;else if(variant==="golden"){const goldenCount=d.towers.filter(item=>!defenseStructureType(item)&&(item.pet.variant||item.pet.hiddenVariant)==="golden").length,factoryCount=d.towers.filter(item=>defenseStructureType(item)==="factory").length,baseGain=DefenseCore.goldenActivePayout({clearedWave:d.clearedWave,upgradeLevel:tower.upgrade,goldenTowerCount:goldenCount}),gain=Math.round(baseGain*(1+Math.min(.6,factoryCount*.12)));queueDefenseIncome(gain,"golden-active");setDefenseMessage(`PAYDAY • +${gain}`,factoryCount?`${factoryCount} Factory${factoryCount===1?"":"s"} turned Payday into a brand-wide drop.`:goldenCount>1?"Golden duplicates split the market. More gold still helps, but with diminishing returns.":"Golden Rizo made the balloons fund their own defeat.");}else if(variant==="diamond")front.slice(0,8).forEach(enemy=>dealDefenseDamage(enemy,stats.damage*2.8*power,tower,"diamond"));else if(variant==="shadow"){const enemy=front[0];if(enemy)dealDefenseDamage(enemy,enemy.hp/enemy.maxHp<.4?enemy.hp+1:stats.damage*4.8*power,tower,"shadow",true);}else if(variant==="retro")tower.overclockUntil=time+9*control;
    const doctrineTargets=(near.length?near:front.slice(0,6)).filter(enemy=>enemy.hp>0);
    if(tower.doctrine==="power")doctrineTargets.slice(0,tower.upgrade>=4?8:5).forEach(enemy=>shredDefenseArmor(enemy,tower.upgrade>=4?.08:.05,tower));
    else if(tower.doctrine==="control")doctrineTargets.slice(0,tower.upgrade>=4?10:6).forEach(enemy=>revealDefenseEnemy(enemy,tower.upgrade>=4?5:3.5,tower));
    tower.node?.classList.remove("ability-ready");tower.node?.classList.add("ability-charging");tower.node?.style.setProperty("--ability-charge","0%");tower.abilityChargedVisual=false;tower.abilityChargingVisual=true;tower.abilityChargeVisual=0;
    const abilityWorld=$("#defenseWorld");if((d.rallyUntil||0)>time){abilityWorld?.classList.add("rally-active");d.rallyVisualActive=true;}if((d.prismUntil||0)>time){abilityWorld?.classList.add("prism-active");d.prismVisualActive=true;}if((tower.overclockUntil||0)>time){tower.node?.classList.add("overclock-active");tower.overclockVisualActive=true;}
    const presentation=defenseAbilityPresentation(tower);showDefenseCinematicMoment("ability",{kicker:`${tower.doctrine.toUpperCase()} • ${tower.pet.name}`,title:presentation.active,copy:tower.upgrade>=4?"APEX CAST":"FIELD POWER",duration:d.lowFx?520:760,priority:4,icon:tower.doctrine==="control"?"⌁":"✦"});
    markDefenseUi();
    if(keepAbilityTray){d.abilityTrayOpen=true;closeDefenseTowerPanel();updateDefenseHud();}
    else{updateDefenseHud();if(showPanel)showDefenseTowerPanel(tower);}
    completeDefenseSchoolLesson("abilities");writeDefenseCheckpoint(true,"ability");duckMusic(tower.superForm?720:560,tower.superForm?.075:.105);defenseAbilitySignature(tower);defenseHaptic("ability");return true;
  }
  function updateDefenseProjectiles(dt){
    const d=mini.defense;
    for(let index=d.projectiles.length-1;index>=0;index-=1){
      const shot=d.projectiles[index];
      if(!shot.target||shot.target.dead||shot.target.hp<=0){releaseDefenseProjectileNode(shot);d.projectiles.splice(index,1);continue;}
      shot.prevX=Number.isFinite(shot.x)?shot.x:shot.tower?.x||0;shot.prevY=Number.isFinite(shot.y)?shot.y:shot.tower?.y||0;
      shot.life+=dt;const tx=shot.target.x,ty=shot.target.y,dx=tx-shot.x,dy=ty-shot.y,dist=Math.hypot(dx,dy),step=Math.min(dist,shot.speed*dt);
      if(dist>.0001){shot.x+=dx/dist*step;shot.y+=dy/dist*step;}
      if(!d.fixedSimulation&&shot.node&&positionDefenseMovingNode(shot.node,shot.x,shot.y))d.projectilePositionWrites=(d.projectilePositionWrites||0)+1;
      if(dist<=shot.speed*dt+.018||shot.life>.7){applyDefenseHit(shot);releaseDefenseProjectileNode(shot);d.projectiles.splice(index,1);}
    }
  }


  function showDefenseBeaconPulse(beacon,{golden=false}={}){const node=beacon?.node;if(!node)return;node.classList.remove("brand-pulse","golden-brand-pulse");void node.offsetWidth;node.classList.add(golden?"golden-brand-pulse":"brand-pulse");queueMiniTimeout(()=>node.classList.remove("brand-pulse","golden-brand-pulse"),850);}
  function showDefenseFactoryPayout(tower,gain,econ){const d=mini.defense,node=tower.node;if(!d||!node)return;node.classList.remove("factory-produced","factory-drop","factory-golden-drop");void node.offsetWidth;node.classList.add("factory-produced");if(econ?.isDrop)node.classList.add("factory-drop");if(econ?.isDrop&&econ?.goldenLicensed)node.classList.add("factory-golden-drop");const fx=document.createElement("span");fx.className=`defense-factory-payout ${econ?.isDrop?"drop":""} ${econ?.goldenLicensed?"golden":""}`;const label=econ?.isDrop?(econ.goldenLicensed?"GOLDEN DROP":econ.privateSun?"SUN DROP":"RIZO DROP"):"";fx.innerHTML=`<i aria-hidden="true"></i>${label?`<em>${label}</em>`:""}<b>+${gain}</b>`;node.appendChild(fx);queueMiniTimeout(()=>{fx.remove();node.classList.remove("factory-produced","factory-drop","factory-golden-drop");},900);if(econ?.isDrop&&defenseBeaconInfluence(tower,d)?.network?.privateSun)showDefenseBeaconPulse(defenseBeaconInfluence(tower,d)?.beacon,{golden:Boolean(econ.goldenLicensed)});if(defenseRealNow(d)-(d.lastFactorySfxAt||-99)>.9){d.lastFactorySfxAt=defenseRealNow(d);sfx(econ?.isDrop?"reward":"coin");}}
  function updateDefenseFactory(tower,d,time){
    if(!Number.isFinite(tower.factoryLivesSnapshot))tower.factoryLivesSnapshot=d.lives;if(d.lives<tower.factoryLivesSnapshot){tower.factoryCleanCycles=0;tower.node?.classList.add("factory-streak-broken");queueMiniTimeout(()=>tower.node?.classList.remove("factory-streak-broken"),700);}tower.factoryLivesSnapshot=d.lives;
    let econ=defenseFactoryEconomy(tower,d);if(!(tower.nextProductionAt>0))tower.nextProductionAt=time+econ.interval;if(!(tower.factoryLastInterval>0))tower.factoryLastInterval=econ.interval;else if(Math.abs(tower.factoryLastInterval-econ.interval)>.001&&tower.nextProductionAt>time){const progress=clamp(1-(tower.nextProductionAt-time)/Math.max(.1,tower.factoryLastInterval),0,1);tower.nextProductionAt=time+(1-progress)*econ.interval;tower.factoryLastInterval=econ.interval;}else tower.factoryLastInterval=econ.interval;let bursts=0;
    while(time+1e-9>=tower.nextProductionAt&&bursts<3){econ=defenseFactoryEconomy(tower,d);const gain=econ.payout;queueDefenseIncome(gain,"factory");tower.totalProduced=(tower.totalProduced||0)+gain;tower.factoryCleanCycles=(tower.factoryCleanCycles||0)+1;tower.nextProductionAt+=econ.interval;bursts+=1;showDefenseFactoryPayout(tower,gain,econ);}
    econ=defenseFactoryEconomy(tower,d);const beacon=defenseBeaconInfluence(tower,d);tower.beaconSourceId=beacon?.beacon?.id||"";tower.node?.classList.toggle("beacon-buffed",Boolean(beacon));tower.node?.classList.toggle("brand-loop",Boolean(beacon?.network?.brandLoop));tower.node?.classList.toggle("golden-license",Boolean(beacon?.network?.golden));tower.node?.classList.toggle("drop-ready",Boolean(econ.isDrop));if(tower.node){tower.node.style.setProperty("--factory-progress",String(clamp(1-Math.max(0,tower.nextProductionAt-time)/Math.max(.1,econ.interval),0,1)));tower.node.style.setProperty("--factory-momentum",String(clamp((econ.momentumMultiplier-1)/.30,0,1)));tower.node.dataset.production=String(Math.round(tower.totalProduced||0));tower.node.dataset.cleanStreak=String(tower.factoryCleanCycles||0);}
  }
  // --- INTEGRATION GLUE: one upgrade completion pipeline -------------------------
  // Five specialists react to an upgrade: Worker D changes the tower's visual state,
  // Worker G's map bonds may re-derive, Worker B's Beacon/Factory network changes,
  // Worker I owns motion/audio/haptic punctuation, Worker H owns the UI reads, and
  // Worker J requires the checkpoint to be rewritten. Worker B's structure upgrade
  // path grew its own shorter sequence, so evolving a Factory to RIZO INDUSTRIAL or a
  // Beacon to PRIVATE SUN silently skipped the authored upgrade motion, the authored
  // SFX family, the music duck and the support refresh. Both paths now finish here.
  function defenseCommitUpgrade(tower,{reason="upgrade",apex=null}={}){
    const d=mini.defense;if(!d||!tower)return false;
    const isApex=apex===null?tower.upgrade>=4:Boolean(apex);
    refreshDefenseTower(tower);
    refreshDefenseMapBondVisuals();
    refreshDefenseSupportVisuals(d);
    tower.node?.classList.add("just-upgraded");
    defenseFeelPulseTower(tower,"upgraded",isApex?950:700);
    markDefenseUi({roster:true});updateDefenseRoster();updateDefenseHud();
    writeDefenseCheckpoint(true,reason);
    duckMusic(isApex?1000:720,isApex?.08:.14);
    sfx(isApex?"defense-apex":"defense-upgrade");
    defenseHaptic(isApex?"apex":"upgrade");
    return true;
  }

  // --- INTEGRATION GLUE: support presentation outside the simulation loop --------
  // Beacon support classes used to be applied only from updateDefenseTowers(), i.e.
  // only while the simulation was running. Placing or upgrading a Beacon during the
  // planning phase therefore changed the mechanic with no visible response until the
  // next wave started, which breaks the "place a Beacon, watch nearby Rizos speed up"
  // cause/effect the design depends on. This is the one place that derives the
  // presentation, so the loop and every out-of-loop refresh cannot drift apart.
  function defenseSyncDefenderSupportVisual(tower,d=mini.defense){
    const beacon=defenseBeaconInfluence(tower,d),beaconId=beacon?.beacon?.id||"";
    const goldenLicensed=(tower.pet.variant||tower.pet.hiddenVariant)==="golden"&&tower.upgrade>=2&&Boolean(beacon?.network?.brandLoop)&&Boolean(beacon?.network?.factories);
    tower.beaconSourceId=beaconId;
    // Apply unconditionally rather than only on change: renderDefenseTower() rebuilds
    // className from scratch (on upgrade, doctrine, ascension, restore), so a
    // change-gated toggle silently dropped the support halo until the covering Beacon
    // happened to change again.
    tower.node?.classList.toggle("beacon-buffed",Boolean(beacon));
    tower.node?.classList.toggle("golden-license",goldenLicensed);
    return beacon;
  }
  // Re-derive every support/network read from current placement. Presentation only:
  // it never advances a production timer, grants cash, or touches simulation clocks,
  // so it is safe to call while paused or in planning.
  function refreshDefenseSupportVisuals(d=mini.defense){
    if(!d?.towers)return false;
    for(const tower of d.towers){
      const type=defenseStructureType(tower);
      if(type==="beacon")updateDefenseBeacon(tower,d);
      else if(type==="factory"){const beacon=defenseBeaconInfluence(tower,d);tower.beaconSourceId=beacon?.beacon?.id||"";tower.node?.classList.toggle("beacon-buffed",Boolean(beacon));tower.node?.classList.toggle("brand-loop",Boolean(beacon?.network?.brandLoop));tower.node?.classList.toggle("private-sun-network",Boolean(beacon?.network?.privateSun));}
      else defenseSyncDefenderSupportVisual(tower,d);
    }
    return true;
  }
  function updateDefenseBeacon(tower,d){const network=defenseBeaconNetwork(tower,d);tower._brandNetwork=network;tower.node?.classList.toggle("brand-loop",Boolean(network?.brandLoop));tower.node?.classList.toggle("private-sun-network",Boolean(network?.privateSun));tower.node?.classList.toggle("golden-license",Boolean(network?.golden));if(tower.node){tower.node.dataset.combatLinks=String(network?.combat||0);tower.node.dataset.factoryLinks=String(network?.factories||0);}}
  function updateDefenseTowers(dt){
    const d=mini.defense,time=defenseNow(),realTime=time,budget=DEFENSE_BUDGETS.normal,world=$("#defenseWorld"),abilitiesSealed=defenseContractRule("silent",d);let goldenAwakened=0;
    const rallyActive=(d.rallyUntil||0)>time,prismActive=(d.prismUntil||0)>time;
    if(rallyActive!==d.rallyVisualActive){world?.classList.toggle("rally-active",rallyActive);d.rallyVisualActive=rallyActive;}
    if(prismActive!==d.prismVisualActive){world?.classList.toggle("prism-active",prismActive);d.prismVisualActive=prismActive;}
    for(const tower of d.towers){const structureType=defenseStructureType(tower);if(structureType){if(structureType==="factory")updateDefenseFactory(tower,d,time);else if(structureType==="beacon")updateDefenseBeacon(tower,d);continue;}const weakened=tower.rangeDebuffUntil>time;if(weakened!==tower.rangeWeakenedActive){tower.node?.classList.toggle("range-weakened",weakened);tower.rangeWeakenedActive=weakened;}const overclockActive=(tower.overclockUntil||0)>time;if(overclockActive!==tower.overclockVisualActive){tower.node?.classList.toggle("overclock-active",overclockActive);tower.overclockVisualActive=overclockActive;}const abilityUnlocked=Boolean(tower.upgrade>=2&&tower.doctrine&&!abilitiesSealed),abilityRemaining=abilityUnlocked?defenseAbilityRemaining(tower):Infinity,abilityCharged=Boolean(abilityUnlocked&&abilityRemaining<=0),abilityCharging=Boolean(abilityUnlocked&&!abilityCharged),abilityCooldown=Math.max(.001,defenseAbilityCooldown(tower)*(tower.superForm?.7:1)),abilityCharge=abilityUnlocked?clamp(1-abilityRemaining/abilityCooldown,0,1):0,abilityChargeStep=Math.round(abilityCharge*12)/12;if(abilityCharged!==tower.abilityChargedVisual){tower.node?.classList.toggle("ability-ready",abilityCharged);tower.abilityChargedVisual=abilityCharged;}if(abilityCharging!==tower.abilityChargingVisual){tower.node?.classList.toggle("ability-charging",abilityCharging);tower.abilityChargingVisual=abilityCharging;}if(abilityChargeStep!==tower.abilityChargeVisual){tower.node?.style.setProperty("--ability-charge",`${Math.round(abilityChargeStep*100)}%`);tower.abilityChargeVisual=abilityChargeStep;}if((tower.pet.variant||tower.pet.hiddenVariant)==="golden"&&tower.upgrade>=2)goldenAwakened+=1;const beacon=defenseSyncDefenderSupportVisual(tower,d);tower.cooldown=Math.max(0,tower.cooldown-dt);const hadCachedTarget=Boolean(tower.targetId);let target=tower.targetRef;if(!target||target.id!==tower.targetId||target.dead||target.hp<=0)target=null;const lostCachedTarget=hadCachedTarget&&!target,retargetExpired=realTime>=(tower.retargetAtReal||0);let stats=null;if(lostCachedTarget||retargetExpired){stats=defenseCombatStats(tower);const targetValid=Boolean(target&&Math.hypot(target.x-tower.x,target.y-tower.y)<=stats.range&&canDefenseTowerSee(tower,target)),lostTarget=hadCachedTarget&&!targetValid;if(!targetValid)target=null;d.targetScans=(d.targetScans||0)+1;target=pickDefenseTarget(tower,stats,defenseTargetSnapshot(d,lostTarget));tower.targetRef=target||null;tower.targetId=target?.id||null;tower.retargetAtReal=realTime+budget.targetRefreshMs/1000;}if(tower.cooldown>0||!target)continue;stats||=(defenseCombatStats(tower));if(!canDefenseTowerSee(tower,target)||Math.hypot(target.x-tower.x,target.y-tower.y)>stats.range){tower.targetId=null;tower.targetRef=null;tower.retargetAtReal=0;continue;}tower.cooldown=1/Math.max(.2,stats.rate);fireDefenseTower(tower,target,stats);}
    if(goldenAwakened){const factoryCount=d.towers.filter(item=>defenseStructureType(item)==="factory").length;d.goldenCoinCarry+=dt*Math.min(2,goldenAwakened)*.75*(1+Math.min(.8,factoryCount*.2));const payout=Math.floor(d.goldenCoinCarry);if(payout>0){d.goldenCoinCarry-=payout;queueDefenseIncome(payout,"golden-passive");}}
  }

  const DEFENSE_GATE_FLAME_DURATION=12;
  const DEFENSE_GATE_FLAME_COOLDOWN=38;
  function toggleDefenseGateFlame(){
    const d=mini.defense;if(!d)return false;const time=defenseNow(),active=(d.gateFlameUntil||0)>time,remaining=Math.max(0,(d.gateFlameReadyAt||0)-time);
    if(active){setDefenseMessage("EMBER POD ACTIVE","The pod is already bursting across that stretch of trail.");sfx("no");return false;}
    if(!defenseIsActiveWave(d)||d.paused){setDefenseMessage("START THE WAVE FIRST","Ember Pod is a live-field defense. Start a wave, then plant it on the road.");sfx("no");return false;}
    if(remaining>0){setDefenseMessage(`EMBER POD RECHARGING • ${Math.ceil(remaining)}S`,"Hold the trail until the pod rebuilds pressure.");sfx("no");return false;}
    d.gateFlameArmed=!d.gateFlameArmed;clearDefensePlacementMode();closeDefenseTowerPanel();$(".defense-shell")?.classList.toggle("gate-flame-aiming",d.gateFlameArmed);setDefenseMessage(d.gateFlameArmed?"PLANT EMBER POD":"POD CANCELLED",d.gateFlameArmed?"Tap the road. The pod bursts outward every half-second for 12 seconds.":"Your strategy stays untouched.");markDefenseUi();flushDefenseUi(true);sfx("ui");haptic([6]);return true;
  }
  function placeDefenseGateFlame(event){
    const d=mini.defense;if(!d?.gateFlameArmed)return false;if(!defenseIsActiveWave(d)||d.paused){d.gateFlameArmed=false;$(".defense-shell")?.classList.remove("gate-flame-aiming");setDefenseMessage("POD CANCELLED","Resume the wave before placing a live-field defense.");markDefenseUi();return false;}const point=defenseArenaPoint(event,{strict:true});if(!point)return false;const nearest=nearestDefensePathPoint(point.x,point.y),world=$("#defenseWorld"),short=Math.max(1,Math.min(world?.clientWidth||390,world?.clientHeight||390)),maxDistance=Math.max(.045,26/short);
    if(nearest.distance>maxDistance){setDefenseMessage("PUT IT ON THE ROAD","Ember Pod locks onto the trail, not open grass.");haptic([10,16,10]);return true;}
    const time=defenseNow();d.gateFlameArmed=false;d.gateFlameProgress=nearest.progress;d.gateFlameUntil=time+DEFENSE_GATE_FLAME_DURATION;d.gateFlameReadyAt=time+DEFENSE_GATE_FLAME_COOLDOWN;d.gateFlameNextTick=time;d.gateFlameTicks=0;$(".defense-shell")?.classList.remove("gate-flame-aiming");setDefenseMessage("EMBER POD ONLINE","Radial bursts punish anything crossing this section of trail.");showDefenseCinematicMoment("power",{kicker:"FIELD DEFENSE",title:"EMBER POD",copy:"RADIAL BURST • 12 SECONDS",duration:1200,priority:2,icon:"✹"});markDefenseUi();flushDefenseUi(true);writeDefenseCheckpoint(true,"ember-pod");sfx("legendary");haptic([10,20,10]);return true;
  }
  function updateDefenseGateFlame(){
    const d=mini.defense;if(!d)return;const time=defenseNow();if((d.gateFlameUntil||0)<=time)return;if(time+1e-9<(d.gateFlameNextTick||0))return;d.gateFlameNextTick=time+.5;d.gateFlameTicks=(d.gateFlameTicks||0)+1;const center=d.gateFlameProgress||0,raw=2.0+Math.min(5.2,(d.currentWave||1)*.075),radius=.065;for(const enemy of d.enemies){if(enemy.dead||enemy.hp<=0)continue;if(Math.abs((enemy.progress||0)-center)>radius)continue;const damage=raw*(enemy.fireproof?.35:1);dealDefenseDamage(enemy,damage,null,"ember");if(!enemy.dead){enemy.slow=Math.max(enemy.slow||0,.18*(1-(enemy.slowResist||0)));enemy.slowUntil=Math.max(enemy.slowUntil||0,time+.7);if(!enemy.fireproof){enemy.burn=Math.max(enemy.burn||0,.55);enemy.burnUntil=Math.max(enemy.burnUntil||0,time+1.4);}}spawnDefenseImpact(enemy.x,enemy.y,"ember");}markDefenseUi();
  }

  function updateDefenseWeather(){const d=mini.defense,time=defenseNow();if(!defenseIsActiveWave(d)||time<d.nextWeatherAt)return;const weather=d.map.weather;d.nextWeatherAt=time+(weather==="ash"?12:weather==="moon"?12:weather==="storm"?11:weather==="blizzard"?10:weather==="eclipse"?9:999);if(weather==="ash"){d.ashUntil=time+3.2;setDefenseMessage("ASH VEIL", "THE TRAIL IS CAMOUFLAGED FOR 3 SECONDS. AWAKENED AND DETECTOR RIZOS KEEP SIGHT.");$("#defenseWorld")?.classList.add("weather-active");}else if(weather==="moon"){d.moonRevealUntil=time+3.5;for(const enemy of d.enemies)if(enemy.hp>0)revealDefenseEnemy(enemy,3.5);setDefenseMessage("MOONLIGHT WINDOW", "CAMOUFLAGE AND PHASING ARE EXPOSED FOR 3 SECONDS. PRESS THE ADVANTAGE.");$("#defenseWorld")?.classList.add("weather-active");}else if(weather==="storm"){d.stormWeatherUntil=time+3.4;setDefenseMessage("LIGHTNING SURGE", "EVERY BALLOON MOVES 32% FASTER FOR 3 SECONDS.");$("#defenseWorld")?.classList.add("weather-active");}else if(weather==="blizzard"){d.whiteoutUntil=time+4;setDefenseMessage("❄ WHITEOUT • RANGE -18%", "Most range rings shrink now. Frost and Aurora resist the whiteout.");$("#defenseWorld")?.classList.add("weather-active","whiteout-live");syncDefenseTowerGeometry();queueMiniTimeout(()=>{$("#defenseWorld")?.classList.remove("whiteout-live");syncDefenseTowerGeometry();},4100);}else if(weather==="eclipse"){d.eclipseUntil=time+4;setDefenseMessage("ECLIPSE VEIL", "EVERY BALLOON IS CAMOUFLAGED FOR 4 SECONDS.");$("#defenseWorld")?.classList.add("weather-active");}queueMiniTimeout(()=>$("#defenseWorld")?.classList.remove("weather-active"),4200);}
  function updateDefenseEnemies(dt){
    const d=mini.defense,time=defenseNow(),tier=d.renderTier||defenseApplyRenderTier(d);
    d.enemyStateVisualClock=(d.enemyStateVisualClock||0)+dt/Math.max(.5,d.speed||1);
    const stateInterval=tier===2?.20:tier===1?.14:.10,stateStep=d.enemyStateVisualClock>=stateInterval;if(stateStep)d.enemyStateVisualClock%=stateInterval;
    for(let index=d.enemies.length-1;index>=0;index-=1){
      const enemy=d.enemies[index];if(enemy.dead)continue;
      enemy.prevX=Number.isFinite(enemy.x)?enemy.x:0;enemy.prevY=Number.isFinite(enemy.y)?enemy.y:0;
      enemy.hitFlash=Math.max(0,enemy.hitFlash-dt);
      const phaseSuppressed=enemy.phaseSuppressedUntil>time||d.moonRevealUntil>time;if(enemy.phasing)enemy.phaseActive=!phaseSuppressed&&Math.sin(time*2.35+enemy.phaseOffset)>.32;
      if(enemy.burnUntil>time)dealDefenseDot(enemy,enemy.burn*dt,enemy.burnSource,"ember");if(enemy.dead)continue;
      if(enemy.poisonUntil>time)dealDefenseDot(enemy,enemy.poison*dt,enemy.poisonSource,"toxic");if(enemy.dead)continue;
      if(enemy.healer)pulseDefenseMender(enemy,time);
      handleDefenseBossMechanics(enemy);if(enemy.dead)continue;
      enemy.stormCharging=Boolean(enemy.stormPulse&&((time+enemy.phaseOffset)%4.8)<1.15);
      const rooted=enemy.rootUntil>time,slow=enemy.slowUntil>time?1-enemy.slow:1,signalPulse=(enemy.signalStaggerUntil||0)>time?.72:1,previousRelayBoosted=Boolean(enemy.relayBoosted);enemy.relayBoosted=Boolean(defenseRelaySupport(enemy,d));const relayChanged=previousRelayBoosted!==enemy.relayBoosted,relayPulse=enemy.relayBoosted?1.22:1,stormPulse=enemy.stormPulse?(((time+enemy.phaseOffset)%4.8)<1.15?.65:((time+enemy.phaseOffset)%4.8)<2.2?1.85:1):1,apexPulse=enemy.bossId==="apex"?(enemy.apexSurgeUntil>time?1.9:.82):1,mapPulse=d.stormWeatherUntil>time?1.32:1;
      if(!rooted)enemy.progress+=enemy.speed*DEFENSE_GLOBAL_MOVEMENT_PACE*slow*signalPulse*relayPulse*stormPulse*apexPulse*mapPulse*dt;
      const point=defensePointAt(Math.min(enemy.progress,.999));enemy.x=point.x;enemy.y=point.y;
      if(enemy.progress>=1){enemy.dead=true;const key=enemy.bossId?`boss:${enemy.bossId}`:enemy.type,loss=Math.min(d.lives,enemy.damage);releaseDefenseEnemyNode(enemy);d.enemies.splice(index,1);removeDefenseRuntimeItem(mini.entities,enemy);d.waveResolved+=1;d.lives=Math.max(0,d.lives-enemy.damage);defenseRecordEnemyStat("leaked",key);d.enemyStats.heartLoss+=loss;markDefenseUi();const end=defenseGatePoint(d.map);spawnDefenseImpact(end.x,end.y,"gate");showDefenseGateDamageMoment(loss);sfx("defense-gate-hit");defenseHaptic("gate");if(d.lives<=0){finishDefenseRunWithMoment("gate");return;}}
      else{if(!d.fixedSimulation)positionDefenseEnemyNode(enemy);if(stateStep||enemy.telegraphKind||relayChanged)updateDefenseEnemyNode(enemy);}
    }
  }


  function reducedMotionActive(){
    try{return Boolean(hostSettings().reducedMotion||matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);}catch(error){return Boolean(hostSettings().reducedMotion);}
  }
  function defenseReducedMotion(){ return reducedMotionActive(); }
  function showDefenseCinematicMoment(kind,options={}){
    const d=mini.defense,host=$("#defenseMoment"),shell=$(".defense-shell"),stage=$(".defense-stage-frame");if(!d||!host)return false;
    const base=DEFENSE_CINEMATIC_MOMENTS[kind]||DEFENSE_CINEMATIC_MOMENTS.clear,real=defenseRealNow(d),priority=Number.isFinite(Number(options.priority))?Number(options.priority):base.priority;
    if(d.cinematicMomentUntilReal>real&&priority<(d.cinematicMomentPriority||0))return false;
    const reduced=defenseReducedMotion(),duration=Math.max(120,Number(options.duration)||base.duration),effectiveDuration=reduced?Math.min(260,duration):duration,id=(d.cinematicMomentId||0)+1;
    d.cinematicMomentId=id;d.cinematicMomentCount=(d.cinematicMomentCount||0)+1;d.cinematicMomentKind=kind;d.cinematicMomentPriority=priority;d.cinematicMomentUntilReal=real+effectiveDuration/1000;
    const title=String(options.title||kind.replace(/-/g," ")).toUpperCase(),copy=String(options.copy||"");
    host.hidden=false;host.className=`defense-moment moment-${kind} tone-${options.tone||base.tone}${reduced?" reduced":""}`;host.style.setProperty("--moment-duration",`${effectiveDuration}ms`);host.innerHTML=`<div class="defense-moment-card"><i aria-hidden="true">${escapeHTML(options.icon||base.icon)}</i><span><small>${escapeHTML(options.kicker||"RIZO DEFENSE")}</small><b>${escapeHTML(title)}</b>${copy?`<em>${escapeHTML(copy)}</em>`:""}</span>${options.dismissible?`<button type="button" class="defense-moment-dismiss" data-defense-dismiss-moment aria-label="Dismiss reward">×</button>`:""}</div>`;host.classList.toggle("dismissible",Boolean(options.dismissible));
    if(shell){shell.dataset.cinematicMoment=kind;shell.classList.toggle("cinematic-danger",kind==="danger"||kind==="defeat");shell.classList.toggle("cinematic-boss",kind==="boss");}
    if(stage){stage.classList.remove("moment-pulse","moment-heavy");void stage.offsetWidth;stage.classList.add("moment-pulse");if(priority>=7)stage.classList.add("moment-heavy");}
    queueMiniTimeout(()=>{if(!mini.defense||mini.defense.cinematicMomentId!==id)return;host.hidden=true;host.className="defense-moment";host.textContent="";host.removeAttribute("style");if(shell){delete shell.dataset.cinematicMoment;shell.classList.remove("cinematic-danger","cinematic-boss");}stage?.classList.remove("moment-pulse","moment-heavy");d.cinematicMomentKind=null;d.cinematicMomentPriority=0;d.cinematicMomentUntilReal=defenseRealNow(d);},effectiveDuration+40);
    return true;
  }
  function showDefenseGateDamageMoment(loss=1){
    const d=mini.defense;if(!d)return false;const real=defenseRealNow(d),critical=d.lives<=Math.max(5,Math.ceil(d.map.lives*.35));if(real-(d.lastGateMomentAtReal||-99)<.28&&!critical)return false;d.lastGateMomentAtReal=real;return showDefenseCinematicMoment("danger",{title:critical?`GATE CRITICAL • ${d.lives} HEART${d.lives===1?"":"S"}`:`GATE HIT • -${Math.max(1,loss)}`,copy:critical?"THE EMBER GATE IS ONE BAD LEAK FROM TROUBLE.":"A threat reached the end of the trail."});
  }
  function finishDefenseRunWithMoment(reason="banked"){
    const d=mini.defense;if(!mini.active||mini.mode!=="defense"||!d||d.ending)return false;flushDefenseIncome(d,reason==="gate"?"defeat":"bank");d.ending=true;d.endingReason=reason;cancelDefenseTransientInput(`run-${reason}`);clearDefensePlacementMode();defenseSetPhase(d,DEFENSE_PHASES.RUN_COMPLETE,{force:true});
    if(reason==="gate"){setDefenseMessage("EMBER GATE DOWN",`Cleared Wave ${d.clearedWave}. Reached Wave ${d.currentWave}.`);showDefenseCinematicMoment("defeat",{title:"GATE DOWN",copy:`CLEARED ${d.clearedWave} • REACHED ${d.currentWave}`});sfx("no");haptic([26,42,26,70]);}
    else{setDefenseMessage("RUN BANKED",d.currentWave>d.clearedWave?`Cleared ${d.clearedWave}. Wave ${d.currentWave} was active and is not credited.`:`Cleared ${d.clearedWave}. Progress is secured.`);showDefenseCinematicMoment("bank",{title:"RUN BANKED",copy:d.currentWave>d.clearedWave?`CLEARED ${d.clearedWave} • WAVE ${d.currentWave} EXCLUDED`:`CLEARED ${d.clearedWave} • PROGRESS SECURED`});sfx("reward");haptic([10,18,10,28]);}
    markDefenseUi();flushDefenseUi(true);const delay=defenseReducedMotion()?90:(reason==="gate"?920:680);queueMiniTimeout(()=>{if(mini.active&&mini.mode==="defense"&&mini.defense?.ending)finishDefenseRun(reason);},delay);return true;
  }
  function hideDefenseMessage(){const host=$("#defenseMessage");if(host)host.hidden=true;}
  function setDefenseMessage(title,text=""){const host=$("#defenseMessage");if(!host)return;host.hidden=false;host.innerHTML=`<b>${escapeHTML(title)}</b>${text?`<span>${escapeHTML(text)}</span>`:""}`;host.classList.remove("flash","milestone");void host.offsetWidth;host.classList.add("flash");}
  function isWaveFullyResolved(d=mini.defense){return Boolean(d&&d.waveResolved>=d.waveTotal&&d.packetIndex>=d.wavePackets.length&&d.spawnQueue.length===0&&d.childSpawnQueue.length===0&&!d.enemies.some(enemy=>!enemy.dead));}
  function retireDefenseWaveResidue(d=mini.defense){if(!d)return;for(const shot of d.projectiles||[])releaseDefenseProjectileNode(shot);d.projectiles=[];d.effects=(d.effects||[]).filter(effect=>effect?.major&&Number(effect.expiresAt)>defenseNow());}
  function completeDefenseWave(){const d=mini.defense;if(!d||d.ending||d.lives<=0||d.currentWave<=d.clearedWave||!defenseIsSimulating(d)||!isWaveFullyResolved(d))return false;retireDefenseWaveResidue(d);d.gateFlameArmed=false;d.gateFlameUntil=Math.min(d.gateFlameUntil||0,d.clock);$(".defense-shell")?.classList.remove("gate-flame-aiming");flushDefenseIncome(d,"wave-complete");d.clearedWave=Math.max(d.clearedWave,d.currentWave);const heartsLost=Math.max(0,d.enemyStats.heartLoss-(d.waveHeartLossStart||0));if(heartsLost===0)d.perfectWaveCount=Math.min(d.clearedWave,(d.perfectWaveCount||0)+1);const bonus=DefenseCore.calculateWaveBonus({clearedWave:d.clearedWave,heartsLostThisWave:heartsLost,towersPlaced:d.towers.length});d.cash=DefenseCore.clampNumber(d.cash+bonus,0,DEFENSE_LIMITS.MAX_RUN_CASH,d.cash);d.cashWriteCount=(d.cashWriteCount||0)+1;d.lastWaveBonus=bonus;defenseSetPhase(d,DEFENSE_PHASES.WAVE_COMPLETE);d.nextWaveReadyAtReal=defenseRealNow(d)+.72;d.autoStartAtReal=store.settings.autoStart?defenseRealNow(d)+2.8:0;const contractProgress=recordDefenseContractProgress(d),unlocked=DEFENSE_MILESTONES.find(value=>value===d.clearedWave&&!store.records.milestones.includes(value));if(unlocked){store.records.milestones.push(unlocked);store.records.milestones.sort((a,b)=>a-b);saveState();}if(contractProgress.justCompleted){setDefenseMessage("CONTRACT SEALED • WAVE 10","The Gate recorded ten completed waves. Started waves never count.");$("#defenseMessage")?.classList.add("milestone");haptic([18,28,18,40]);sfx("legendary");}else if(unlocked){setDefenseMessage(`MILESTONE • WAVE ${unlocked}`,unlocked===100?"THE GATE NOW KNOWS YOUR NAME.":"A completed-wave badge was recorded.");$("#defenseMessage")?.classList.add("milestone");haptic([18,30,18,45]);sfx("legendary");}else{setDefenseMessage(`+${bonus} COINS • WAVE ${d.clearedWave} CLEAR`,defenseWaveFlavor(d.mapId,d.clearedWave,{cleared:true,perfect:heartsLost===0}));duckMusic(520,.14);sfx("defense-wave-clear");defenseHaptic(heartsLost===0?"perfect":"clear");}renderDefensePresentation(1,true);const milestoneMoment=Boolean(contractProgress.justCompleted||unlocked||d.clearedWave===10),perfectMoment=heartsLost===0,momentTone=milestoneMoment?"milestone":perfectMoment?"perfect":"money",momentTitle=d.clearedWave===10?"THE GATE HELD.":unlocked?`WAVE ${unlocked} MARKED`:perfectMoment?"PERFECT CLEAR":`+${bonus} GOLD`,momentCopy=d.clearedWave===10?`+${bonus} GOLD • CHAPTER ONE CLEAR. SOMETHING ELSE HEARD THAT.`:contractProgress.justCompleted?`+${bonus} GOLD • CONTRACT SEALED`:unlocked?`+${bonus} GOLD • THE TRAIL REMEMBERS THIS ONE`:perfectMoment?`+${bonus} GOLD • NOTHING TOUCHED THE GATE`:defenseWaveFlavor(d.mapId,d.clearedWave,{cleared:true});showDefenseCinematicMoment("money",{kicker:`WAVE ${d.clearedWave} CLEAR`,title:momentTitle,copy:momentCopy,duration:milestoneMoment?2300:perfectMoment?2100:1900,priority:milestoneMoment?7:perfectMoment?6:5,tone:momentTone,icon:milestoneMoment?"✦":perfectMoment?"★":"🪙",dismissible:true});updateDefenseRoster();markDefenseUi();flushDefenseUi(true);writeDefenseCheckpoint(true,"wave-clear");return true;}
  function defenseDensityCap(d=mini.defense,nextEntry=null){if(!d)return 0;return DefenseCore.densityCap({low:false,speed:d.speed,bossActive:d.enemies.some(enemy=>enemy.bossId)||(typeof nextEntry==="object"&&nextEntry?.type==="boss")});}
  function defenseDensityAllowsSpawn(d,nextEntry,child=false){if(!d)return false;const cap=defenseDensityCap(d,nextEntry),reserved=child?0:DefenseCore.childReservationCount(d.childSpawnQueue,d.clock,.2,3),active=d.enemies.length;return active+reserved<cap;}
  function updateDefenseRealTime(realDt){
    const d=mini.defense;if(!d)return;const safeRealDt=Math.max(0,Number(realDt)||0);
    d.realClock=(d.realClock||0)+safeRealDt;d.uiClock=(d.uiClock||0)+safeRealDt;maybeWriteDefenseCheckpoint(safeRealDt);defenseApplyRenderTier(d);
    if(d.pendingIncome&&defenseRealNow(d)>=(d.nextIncomeFlushAtReal||0))flushDefenseIncome(d,"timer");
    if((d.flowEaseUntilReal||0)>0&&defenseRealNow(d)>=(d.flowEaseUntilReal||0)){d.flowEaseUntilReal=0;markDefenseUi();}
    if(d.phase===DEFENSE_PHASES.WAVE_COMPLETE&&store.settings.autoStart&&d.towers.length){
      const planningBusy=Boolean(d.pendingPlacement||defenseContextSurface(d)),held=d.flowAutoHeldWave===d.clearedWave;
      if(held)d.autoStartAtReal=0;
      else if(planningBusy)d.autoStartAtReal=defenseRealNow(d)+2.8;
      else if(!(d.autoStartAtReal>0))d.autoStartAtReal=defenseRealNow(d)+2.8;
      else if(defenseRealNow(d)>=d.autoStartAtReal)startDefenseWave();
    }else if(!store.settings.autoStart)d.autoStartAtReal=0;
    if(d.uiClock>=defensePerformanceBudget(d).uiRefreshMs/1000){d.uiClock=0;flushDefenseUi();}
  }

  function stepDefenseSimulation(dt){
    const d=mini.defense;if(!d||d.phase===DEFENSE_PHASES.PAUSED||!defenseIsSimulating(d))return false;
    d.clock+=dt;
    for(let i=d.effects.length-1;i>=0;i--){const effect=d.effects[i];if(effect.expiresAt<=d.clock){if(effect.node)releaseDefenseImpactNode(effect.node);d.effects.splice(i,1);}}
    if(d.phase===DEFENSE_PHASES.COUNTDOWN&&d.clock>=d.nextSpawnAt)defenseSetPhase(d,DEFENSE_PHASES.COMBAT);
    if(d.phase===DEFENSE_PHASES.PACKET_BREAK&&d.clock>=d.packetBreakUntil){defenseSetPhase(d,DEFENSE_PHASES.COMBAT);}
    updateDefenseWeather();releaseDefenseChildSpawn(d);
    if(d.phase===DEFENSE_PHASES.COMBAT&&d.packetIndex<d.wavePackets.length){
      const packet=d.wavePackets[d.packetIndex],entry=packet?.enemies?.[d.packetEnemyIndex];
      if(entry!==undefined&&d.clock>=d.nextSpawnAt&&defenseDensityAllowsSpawn(d,entry)){const enemy=spawnDefenseEnemy(entry);enemy.spawnDescriptor=typeof entry==="string"?entry:{...entry};d.lastSpawnedEnemyId=enemy.id;d.packetEnemyIndex+=1;d.spawnQueue.shift();d.nextSpawnAt=d.clock+DefenseCore.clampNumber(packet.spawnGap,.07,1.0,.34);d.spawnWaitReason="timer";markDefenseUi();}
      else if(entry!==undefined)d.spawnWaitReason=defenseDensityAllowsSpawn(d,entry)?"timer":"density";
      if(d.packetEnemyIndex>=packet.enemies.length){d.packetIndex+=1;d.packetEnemyIndex=0;if(d.packetIndex<d.wavePackets.length){d.packetBreakUntil=d.clock+DefenseCore.clampNumber(packet.breakAfter,.8,2.4,1.2);defenseSetPhase(d,DEFENSE_PHASES.PACKET_BREAK);}}
    }
    updateDefenseEnemies(dt);if(!mini.active||d.ending||d.lives<=0)return false;updateDefenseGateFlame();d.peakAlive=Math.max(d.peakAlive||0,d.enemies.length);d.maxActiveEnemiesObserved=Math.max(d.maxActiveEnemiesObserved||0,d.enemies.length);updateDefenseTowers(dt);updateDefenseProjectiles(dt);if(isWaveFullyResolved(d))completeDefenseWave();return true;
  }

  function renderDefensePresentation(alpha=1,force=false){
    const d=mini.defense;if(!d)return false;const blend=clamp(Number(alpha)||0,0,1);
    if(d.rendererMode==="canvas"){
      if(!d.canvasRenderer?.enabled)fallbackDefenseCanvasToDom("renderer-disabled");
      else{const rendered=d.canvasRenderer.render({enemies:d.enemies,projectiles:d.projectiles,effects:d.effects,alpha:blend,gameTime:defenseNow(),tier:d.governorTier||0,width:d.renderWidth,height:d.renderHeight});if(rendered){d.canvasFrames=(d.canvasFrames||0)+1;d.presentationFrames=(d.presentationFrames||0)+1;return true;}fallbackDefenseCanvasToDom("render-returned-false");}
    }
    for(const enemy of d.enemies){if(enemy.dead||!enemy.node)continue;const x=Number.isFinite(enemy.prevX)?enemy.prevX+(enemy.x-enemy.prevX)*blend:enemy.x,y=Number.isFinite(enemy.prevY)?enemy.prevY+(enemy.y-enemy.prevY)*blend:enemy.y;positionDefenseEnemyNode(enemy,force,x,y);}
    for(const shot of d.projectiles){if(!shot.node)continue;const x=Number.isFinite(shot.prevX)?shot.prevX+(shot.x-shot.prevX)*blend:shot.x,y=Number.isFinite(shot.prevY)?shot.prevY+(shot.y-shot.prevY)*blend:shot.y;if(positionDefenseMovingNode(shot.node,x,y))d.projectilePositionWrites=(d.projectilePositionWrites||0)+1;}
    d.presentationFrames=(d.presentationFrames||0)+1;return true;
  }

  function advanceDefenseFixedFrame(realDt,{forceRender=false}={}){
    const d=mini.defense;if(!d)return false;const safeRealDt=Math.max(0,Number(realDt)||0),step=DefenseCore.SIMULATION?.stepSeconds||1/30,maxSteps=DefenseCore.SIMULATION?.maxCatchUpSteps||4;
    updateDefenseRealTime(safeRealDt);d.fixedSimulation=true;
    if(d.phase===DEFENSE_PHASES.PAUSED||!defenseIsSimulating(d)){d.simAccumulator=0;d.presentationAccumulator=(d.presentationAccumulator||0)+safeRealDt;if(forceRender)renderDefensePresentation(1,true);return true;}
    d.simAccumulator=(d.simAccumulator||0)+safeRealDt*Math.max(.5,defensePlaybackSpeed(d)||1);let steps=0;
    while(d.simAccumulator+1e-9>=step&&steps<maxSteps&&mini.active){const began=performance.now();stepDefenseSimulation(step);const elapsed=Math.max(0,performance.now()-began);d.simStepSamples ||= [];d.simStepSamples.push(elapsed);if(d.simStepSamples.length>120)d.simStepSamples.shift();d.simStepWorst=Math.max(d.simStepWorst||0,elapsed);d.simAccumulator-=step;steps+=1;}
    d.lastSimSteps=steps;d.maxCatchUpObserved=Math.max(d.maxCatchUpObserved||0,steps);
    if(d.simAccumulator>=step){d.simBacklogEvents=(d.simBacklogEvents||0)+1;d.performanceLow=true;d.governorTier=2;d.simAccumulator=Math.min(d.simAccumulator,step*.99);}
    if(d.simStepSamples?.length){const sorted=[...d.simStepSamples].sort((a,b)=>a-b),pick=q=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];d.simStepP95=pick(.95);}
    d.presentationAccumulator=(d.presentationAccumulator||0)+safeRealDt;const presentationFps=defenseVisualBudget(d).presentationFps||60,interval=1/presentationFps,shouldRender=forceRender||d.presentationAccumulator+1e-6>=interval;
    if(shouldRender){d.presentationAccumulator%=interval;renderDefensePresentation(step>0?d.simAccumulator/step:1,forceRender);}
    return true;
  }

  // Compatibility entry point used by the QA harness and older call sites. The
  // supplied game-time dt is intentionally ignored: v76 derives game time from
  // real time + the selected speed and advances only fixed 1/30 s simulation steps.
  function updateDefenseGame(dt,realDt=dt/Math.max(.5,mini.defense?.speed||1)){return advanceDefenseFixedFrame(realDt);}


  function handleDefensePointerDown(event){
    if(event.target.closest("[data-defense-dismiss-moment]")){const host=$("#defenseMoment");if(host){host.hidden=true;host.textContent="";}return;}
    if(event.target.closest("[data-defense-dismiss-context]")){defenseDismissContextSurface();return;}
    if(event.target.closest("#defenseMapIntro")){closeDefenseMapIntro();return;}
    if(event.target.closest("[data-defense-trace-route]")){toggleDefenseFieldMenu(false);traceDefenseRoute();return;}
    if(event.target.closest("[data-defense-school-hide-run]")){if(mini.defense){mini.defense.schoolHiddenRun=true;updateDefenseSchoolCoach();}return;}
    if(event.target.closest("[data-defense-field-guide]")){toggleDefenseFieldMenu(false);showDefenseFieldGuide(event.target.closest("[data-defense-field-guide]").dataset.defenseFieldGuide||"rizos");return;}
    const speed=event.target.closest("[data-defense-speed]");
    if(speed){cycleDefenseSpeed();return;}
    if(event.target.closest("[data-defense-toggle-abilities]")){toggleDefenseAbilityTray();return;}
    if(event.target.closest("[data-defense-gate-flame]")){toggleDefenseGateFlame();return;}
    if(event.target.closest("[data-defense-toggle-intel]")){toggleDefenseIntel();return;}
    if(event.target.closest("[data-defense-toggle-bench]")){toggleDefenseBench();return;}
    if(event.target.closest("[data-defense-toggle-field-menu]")){toggleDefenseFieldMenu();return;}
    if(event.target.closest("[data-defense-auto-start]")){store.settings.autoStart=!store.settings.autoStart;saveState(true);if(mini.defense){mini.defense.flowAutoHeldWave=-1;mini.defense.autoStartAtReal=store.settings.autoStart&&mini.defense.phase===DEFENSE_PHASES.WAVE_COMPLETE?defenseRealNow(mini.defense)+2.8:0;markDefenseUi();flushDefenseUi(true);}setDefenseMessage(store.settings.autoStart?"AUTO WAVES ON":"AUTO WAVES OFF",store.settings.autoStart?"The next cleared field gets a 2.8-second planning countdown. You can HOLD FIELD for one boundary without disabling the setting.":"Wave boundaries are yours again. Start each formation when you are ready.");sfx("ui");return;}
    if(event.target.closest("[data-arcade-pause]")){toggleDefenseFieldMenu(false);openDefensePause();return;}
    if(event.target.closest("[data-defense-bank-leave]")){writeDefenseCheckpoint(true,"field-menu-leave");finishDefenseRunWithMoment("banked");return;}
    if(event.target.closest("[data-defense-toggle-legend]")){toggleDefenseFieldMenu(false);showDefenseControlLegend();return;}
    if(event.target.closest("[data-defense-toggle-fullscreen]")){toggleDefenseFieldMenu(false);toggleDefenseFullscreen();return;}
    const cast=event.target.closest("[data-defense-cast]")?.dataset.defenseCast;
    if(cast){activateDefenseAbility(cast,{keepAbilityTray:true});updateDefenseAbilityTray();return;}
    const castGroup=event.target.closest("[data-defense-cast-group]")?.dataset.defenseCastGroup;
    if(castGroup){activateDefenseAbilityGroup(castGroup);return;}
    const flowAction=event.target.closest("[data-defense-flow-action]")?.dataset.defenseFlowAction;
    if(flowAction){runDefenseFlowAction(flowAction);return;}
    const cancel=event.target.closest("[data-defense-cancel-placement]");
    if(cancel){clearDefensePlacementMode();setDefenseMessage("PLACEMENT CANCELLED","Tap a Rizo below whenever you are ready.");return;}
    const runControl=event.target.closest("[data-defense-run-control]");
    if(runControl){if(defenseIsActiveWave(mini.defense))toggleDefensePause();else startDefenseWave();return;}
    const close=event.target.closest("[data-defense-close-panel]");
    if(close){closeDefenseTowerPanel();return;}
    const doctrineRaw=event.target.closest("[data-defense-doctrine]")?.dataset.defenseDoctrine;
    if(doctrineRaw){const [id,doctrine]=doctrineRaw.split(":");chooseDefenseDoctrine(id,doctrine);return;}
    const targetId=event.target.closest("[data-defense-target]")?.dataset.defenseTarget;
    if(targetId){cycleDefenseTarget(targetId);return;}
    const upgrade=event.target.closest("[data-defense-upgrade]")?.dataset.defenseUpgrade;
    if(upgrade){upgradeDefenseTower(upgrade);return;}
    const ability=event.target.closest("[data-defense-ability]")?.dataset.defenseAbility;
    if(ability){activateDefenseAbility(ability);return;}
    const superId=event.target.closest("[data-defense-super]")?.dataset.defenseSuper;if(superId){ascendDefenseTower(superId);return;}
    const confirmSell=event.target.closest("[data-defense-confirm-sell]")?.dataset.defenseConfirmSell;if(confirmSell){sellDefenseTower(confirmSell);return;}
    if(event.target.closest("[data-defense-cancel-sell]")){const tower=mini.defense?.towers.find(item=>item.id===mini.defense?.selectedTowerId);if(tower)showDefenseTowerPanel(tower);return;}
    const sell=event.target.closest("[data-defense-sell]")?.dataset.defenseSell;
    if(sell){requestSellDefenseTower(sell);return;}
    const towerId=event.target.closest("[data-defense-tower]")?.dataset.defenseTower;
    if(towerId){event.preventDefault?.();event.stopPropagation?.();const tower=mini.defense.towers.find(item=>item.id===towerId);if(tower){tower.node?.classList.remove("tap-pop");void tower.node?.offsetWidth;tower.node?.classList.add("tap-pop");showDefenseTowerPanel(tower);haptic([5]);}return;}
    const rosterButton=event.target.closest("[data-defense-roster-id]");
    const petId=rosterButton?.dataset.defenseRosterId;
    if(petId){
      const row=defenseDeployRegistry().get(petId),d=mini.defense;
      if(!row)return;
      if(d.towers.length>=d.maxTowers){toast("THE FIELD IS FULL");return;}
      if(defenseContractRule("unique",d)&&d.towers.some(tower=>tower.petId===row.pet.id)){setDefenseMessage("CONTRACT • NO COPIES",`${row.pet.name} already stands on this field.`);return;}
      const cost=defenseDeployCost(row);
      if(d.cash<cost){toast(`NEED ${cost} DEFENSE COINS`);return;}
      beginDefenseDrag(event,row);return;
    }
    if(event.target.closest("#defenseWorld")){
      const d=mini.defense;
      if(d.gateFlameArmed){placeDefenseGateFlame(event);return;}
      if(d.pendingPlacement){
        const raw=defenseArenaPoint(event,{strict:true}),result=raw?resolveDefensePlacement(raw.x,raw.y,null,{snapPx:DEFENSE_PLACEMENT_SNAP_PX}):null;
        if(result?.evaluation?.valid)placeDefenseTower(d.pendingPlacement.row,result.point.x,result.point.y,d.pendingPlacement.cost);
        else{if(result)updateDefensePlacementPreview(result,d.pendingPlacement.row);setDefenseMessage("THAT SPOT IS BLOCKED",defensePlacementReasonCopy(result?.evaluation));sfx("no");haptic([12,18,12]);queueMiniTimeout(hideDefensePlacementPreview,700);}
        return;
      }
      closeDefenseTowerPanel();
      if(d.towers.length)setDefenseMessage("FIELD READY","Tap a deployed Rizo to inspect it, or choose another from the bench.");
      else setDefenseMessage("SELECT A RIZO FIRST","Tap a roster card below. No dragging is required.");
    }
  }




  const DEFENSE_HAPTICS=Object.freeze({
    select:{pattern:6,wait:.09}, deploy:{pattern:[7,12,7],wait:.16}, upgrade:{pattern:[12,16,12],wait:.2}, apex:{pattern:[18,24,18,42,24],wait:.35},
    ability:{pattern:[9,16,9,22],wait:.18}, bossWarn:{pattern:[14,22,14,34],wait:.3}, bossBreak:{pattern:[10,14,10,20],wait:.2},
    bossDown:{pattern:[18,22,18,36,24],wait:.4}, gate:{pattern:[12,22,12],wait:.18}, clear:{pattern:[8,14,8],wait:.2}, perfect:{pattern:[10,16,10,24],wait:.22}, sell:{pattern:[7,10],wait:.12}
  });
  function defenseHaptic(kind="select"){
    const d=mini?.defense,profile=DEFENSE_HAPTICS[kind]||DEFENSE_HAPTICS.select;if(!d||!hostSettings().haptics)return false;
    const real=defenseRealNow(d),last=Number(d.lastFeelHapticAtReal)||-99;if(real-last<profile.wait)return false;
    d.lastFeelHapticAtReal=real;haptic(profile.pattern);return true;
  }

  // ===== SOUND AND MUSIC =====
  // Defense's own sound families; anything else is a hub sound by name.
  const DEFENSE_SFX = Object.freeze({
    "defense-deploy"(intensity) { tone(196,.055,"triangle",.026,0,80);tone(294,.07,"sine",.018,.045,120);noise(.035,.009,.018); },
    "defense-select"(intensity) { tone(470,.026,"triangle",.012,0,42); },
    "defense-upgrade"(intensity) { tone(246,.09,"triangle",.026,0,160);tone(369,.12,"sine",.025,.07,210);tone(554,.16,"triangle",.022,.145,170); },
    "defense-apex"(intensity) { tone(164,.18,"sawtooth",.026,0,90);tone(328,.22,"triangle",.026,.1,260);tone(656,.28,"sine",.024,.21,360);noise(.18,.014,.11); },
    "defense-pop"(intensity) { tone(330+Math.min(130,intensity*24),.025,"triangle",.012,0,70);noise(.022,.006,0); },
    "defense-pop-heavy"(intensity) { tone(138,.052,"square",.02,0,-34);noise(.048,.014,.008);tone(92,.07,"triangle",.012,.025,-18); },
    "defense-pop-split"(intensity) { tone(292,.035,"sine",.014,0,90);tone(438,.045,"sine",.011,.024,120); },
    "defense-wave-clear"(intensity) { tone(392,.08,"triangle",.022);tone(523,.1,"triangle",.022,.055,70);tone(659,.13,"sine",.021,.12,90); },
    "defense-gate-hit"(intensity) { tone(116,.085,"square",.024,0,-48);noise(.075,.014,.015); },
    "defense-sell"(intensity) { tone(440,.055,"triangle",.018,0,-120);tone(294,.08,"sine",.016,.045,-80); }
  });
  function sfx(name, intensity = 0) {
    if (!hostSettings().sound) return;
    const family = DEFENSE_SFX[name];
    if (family) family(intensity);
    else host?.audio?.sfx?.(name, intensity);
  }
  // Adaptive score: the hub runs the clock and the synth; Defense decides the
  // notes from the live field (planning breathes, combat adds the lead, packet
  // breaks pull it back, bosses replace the groove).
  const DEFENSE_MUSIC = Object.freeze({
    id: "defense",
    tempo:330,lead:[40,null,43,47,50,null,47,43,38,null,43,47,52,null,48,45,36,null,40,43,47,null,50,47,43,null,45,48,52,50,47,null],bass:[24,null,31,null,27,null,34,null,22,null,29,null,25,null,32,null,20,null,27,null,23,null,30,null,19,null,26,null,31,null,34,null],wave:"triangle",
    beat(step, play) {
      const track = DEFENSE_MUSIC, i = step % track.lead.length;
      const lead = track.lead[i], bass = track.bass[i % track.bass.length];
      const d=mini.active?mini.defense:null,wave=Math.max(0,Number(d?.currentWave)||0),active=defenseIsSimulating(d),phase=d?.phase||DEFENSE_PHASES.PLANNING,leader=active?defenseFieldLeader(d):null,leaderVariant=leader?(leader.pet.variant||leader.pet.hiddenVariant||"classic"):"classic",leaderShift=DEFENSE_FEEL_PITCH[leaderVariant]||0;
      const boss=Boolean(active&&d?.enemies?.some(enemy=>enemy?.bossId&&!enemy.dead)),critical=Boolean(active&&d&&d.lives<=Math.max(5,Math.ceil((d.map?.lives||20)*.35)));
      const breakBeat=phase===DEFENSE_PHASES.PACKET_BREAK,late=wave>=20;
      // Planning breathes. Combat adds the lead. Packet breaks pull the lead back.
      // Bosses replace the groove instead of stacking on it, keeping the mix legible.
      if(boss){
        const bossPulse=[28,null,28,null,31,null,27,null][i%8];
        if(bossPulse!=null)play(bossPulse,track.tempo/1000*2.35,.044,0,"sawtooth");
        if(i%4===2)play(34,.16,.014,.02,"square");
        if(i%8===7)play(40,.48,.018,.02,"triangle");
        if(critical&&i%4===3)play(52,.055,.009,.01,"square");
        return;
      }
      if(bass!=null)play(bass,track.tempo/1000*(active?1.75:2.25),active?.028:.018,0,active?"sawtooth":"triangle");
      if(lead!=null&&active&&!breakBeat)play(lead,track.tempo/1000*.9,critical?.024:.02,.015,"triangle");
      if(i%4===0)play(active?40:36,.18,active?.018:.011,0,"sine");
      if(active&&!breakBeat&&i%4===1)play(late?47:43,.06,late?.009:.0065,0,"triangle");
      if(late&&active&&!breakBeat&&i%8===5)play(55,.05,.0055,.015,"square");
      if(active&&!breakBeat&&leader?.doctrine&&i%8===3){const doctrineNote=(leader.doctrine==="power"?34:57)+leaderShift;play(doctrineNote,leader.doctrine==="power"?.13:.09,leader.superForm?.012:.0085,.012,leader.doctrine==="power"?"sawtooth":"sine");}
      if(active&&!breakBeat&&leader?.superForm&&i%8===6)play(leader.superForm==="power"?46+leaderShift:69+leaderShift,.14,.0095,.016,"triangle");
      if(critical&&i%4===3)play(48,.045,.0075,.01,"square");
      if(i%8===7)play(active?43:40,.32,active?.012:.008,.02,"triangle");
      return;
    }
  });
  function playDefenseMusic() { host?.audio?.music?.(DEFENSE_MUSIC); }

  // ===== THE RUN =====
  // `mini` keeps its historical name: it is this mode's run state, not the hub's.
  function idleRuntime() { return { active: false, mode: "defense", score: 0, hits: 0, entities: [], defense: null, defenseDrag: null, paused: false, defensePauseHeld: false, pausedByAd: false, frame: null, lastFrame: 0 }; }
  let mini = idleRuntime();
  let runStarting = false;
  let defenseRendererOverride = null;
  let defenseResizeFrame = null;

  // Deadline jobs, polled every frame (timestamp-based; nothing rides setTimeout).
  // Holding them (pause menu, app in background) banks the remaining delay.
  const jobs = new Set();
  let jobsHeldAt = 0, jobPump = 0;
  function queueMiniTimeout(fn, ms = 0) {
    const job = { fn, due: performance.now() + Math.max(0, Number(ms) || 0) };
    jobs.add(job); ensureJobPump();
    return job;
  }
  function holdJobs() { if (!jobsHeldAt) jobsHeldAt = performance.now(); }
  function releaseJobs() {
    if (!jobsHeldAt) return;
    const held = performance.now() - jobsHeldAt; jobsHeldAt = 0;
    for (const job of jobs) job.due += held;
    ensureJobPump();
  }
  function runDueJobs() {
    if (jobsHeldAt) return;
    const t = performance.now();
    for (const job of [...jobs]) {
      if (job.due > t) continue;
      jobs.delete(job);
      try { job.fn(); } catch (error) { console.warn("Rizo Defense job failed", error); }
    }
  }
  function ensureJobPump() {
    if (jobPump || mini.active || !jobs.size) return;
    jobPump = requestAnimationFrame(function pump() { jobPump = 0; runDueJobs(); ensureJobPump(); });
  }
  function clearJobs() { jobs.clear(); jobsHeldAt = 0; if (jobPump) { cancelAnimationFrame(jobPump); jobPump = 0; } }

  function careBlocker(pet) {
    if (!pet || pet.stage === "egg") return "HATCH YOUR EGG FIRST";
    if (pet.resting) return "YOUR RIZO IS RECOVERING";
    if (pet.sleeping) return "WAKE YOUR RIZO FIRST";
    if ((Number(pet.energy) || 0) < DEFENSE_ENERGY) return `NEED ${DEFENSE_ENERGY} ENERGY • RIZO HAS ${Math.floor(Number(pet.energy) || 0)}`;
    return "";
  }
  function startRunSoon(options) {
    runStarting = true;
    closeModal();
    setTimeout(() => { runStarting = false; if (host) beginRun(options); }, 180);
  }
  function beginRun(options = {}) {
    if (!host || mini.active) return false;
    refreshCrewSnapshots();
    const blocked = careBlocker(captain);
    if (blocked) { toast(blocked); sfx("no"); showDefenseWorldLobby(pendingDefenseMapChoice); return false; }
    closeModal();
    stage = host.mount({ kicker: "ENDLESS ROSTER STRATEGY", title: "RIZO DEFENSE", timer: "ENDLESS", score: "0 POPS", hint: "Drag a Rizo—or tap one, then tap grass—to defend the illustrated trail." });
    mini = { ...idleRuntime(), active: true, lastFrame: performance.now(), defenseMapChoice: options.mapId || "auto", defenseResume: options.resumeCheckpoint || null, defenseContract: options.defenseContract || null };
    stage.root.classList.add("defense-active");
    stage.arena.classList.add("defense-host");
    document.documentElement.classList.add("defense-performance-session");
    applyDefenseBodySettings(true);
    if (!mini.defenseResume || !restoreDefenseCheckpoint(mini.defenseResume)) {
      initializeDefenseRun(mini.defenseMapChoice, mini.defenseContract);
      renderDefenseWorld();
    }
    mini.lastFrame = performance.now();
    mini.frame = requestAnimationFrame(defenseFrame);
    playDefenseMusic();
    haptic(25);
    requestAnimationFrame(() => stage?.arena.focus({ preventScroll: true }));
    if (options.bankOnArrival) queueMiniTimeout(() => finishDefenseRun("banked"), 60);
    return true;
  }
  function defenseFrame(timestamp) {
    if (!mini.active) return;
    const rawFrame = Math.max(0, timestamp - mini.lastFrame), frameDiscontinuity = !Number.isFinite(rawFrame) || rawFrame > 250, defenseFrameDt = frameDiscontinuity ? 0 : Math.min(.12, rawFrame / 1000);
    const d = mini.defense;
    if (frameDiscontinuity && d) { d.frameDiscontinuities = (d.frameDiscontinuities || 0) + 1; d.lastDiscontinuityMs = Number.isFinite(rawFrame) ? rawFrame : 0; d.simAccumulator = 0; d.presentationAccumulator = 0; }
    if (d && !frameDiscontinuity) defenseRecordFramePerformance(rawFrame);
    mini.lastFrame = timestamp;
    if (!mini.pausedByAd) updateDefenseGame(defenseFrameDt * (mini.defense?.speed || 1), defenseFrameDt);
    runDueJobs();
    if (mini.active) mini.frame = requestAnimationFrame(defenseFrame);
  }
  function teardownRun() {
    if (mini.frame) cancelAnimationFrame(mini.frame);
    mini.frame = null;
    if (defenseResizeFrame) { cancelAnimationFrame(defenseResizeFrame); defenseResizeFrame = null; }
    mini.defense?.canvasRenderer?.destroy?.();
    if (mini.defense) { mini.defense.canvasRenderer = null; mini.defense.rendererMode = "dom"; }
    if (mini.defenseDrag?.ghost) mini.defenseDrag.ghost.remove();
    hideDefensePlacementPreview();
    mini.defenseDrag = null;
    clearJobs();
    for (const entity of mini.entities || []) entity.node?.remove?.();
    mini.entities = [];
    stage?.arena.classList.remove("defense-host");
    stage?.root.classList.remove("defense-active", "arcade-paused");
    document.documentElement.classList.remove("defense-performance-session");
  }

  // ===== PAUSE =====
  function openDefensePause() {
    if (!mini.active || mini.paused) return false;
    mini.paused = true;
    const d = mini.defense;
    if (d && !d.paused) { d.paused = true; d.autoPaused = false; mini.defensePauseHeld = true; setDefenseMessage("RUN PAUSED", "Nothing advances while this panel is open."); markDefenseUi(); flushDefenseUi(true); }
    holdJobs();
    renderDefensePausePanel();
    if (stage?.panel) stage.panel.hidden = false;
    stage?.root.classList.add("arcade-paused");
    duckMusic(600, .05);
    sfx("ui");
    stage?.panel?.querySelector("[data-defense-pause-resume]")?.focus({ preventScroll: true });
    return true;
  }
  function closeDefensePause(silent = false) {
    const wasPaused = Boolean(mini.paused);
    mini.paused = false;
    if (stage?.panel) stage.panel.hidden = true;
    stage?.root.classList.remove("arcade-paused");
    if (!wasPaused) return false;
    if (mini.active) {
      if (mini.defensePauseHeld && mini.defense) { mini.defense.paused = false; mini.defensePauseHeld = false; setDefenseMessage("BACK ON THE TRAIL", "The wave continues where it stopped."); markDefenseUi(); flushDefenseUi(true); }
      releaseJobs();
    }
    if (!silent) sfx("ui");
    return true;
  }
  function renderDefensePausePanel() {
    if (!stage?.panel || !mini.active) return;
    const wave = Math.max(0, Number(mini.defense?.clearedWave) || 0);
    stage.panel.innerHTML = `<div class="arcade-pause-card">
      <small>RIZO DEFENSE</small>
      <h3>HOLD THE LINE</h3>
      <div class="arcade-pause-stats"><span><small>CLEARED</small><b>WAVE ${wave}</b></span><span><small>GATE</small><b>${Math.max(0, Number(mini.defense?.lives) || 0)} ♥</b></span></div>
      <p>Leaving banks every cleared wave. Nothing on the trail moves until you resume.</p>
      <div class="arcade-pause-actions">
        <button type="button" class="primary" data-defense-pause-resume>RESUME</button>
        <button type="button" class="danger" data-defense-pause-leave>BANK &amp; LEAVE</button>
      </div>
    </div>`;
  }

  // ===== FINISH, REWARDS AND RECAP =====
  function rewardDefenseRun() {
    const d = mini.defense, clearedWave = DefenseCore.clampInteger(d?.clearedWave, 0, DEFENSE_LIMITS.MAX_SUPPORTED_WAVE, 0);
    if (!d || clearedWave <= 0 || !host) return { embers: 0, trained: 0 };
    const embers = DefenseCore.calculateRunEmbers({ clearedWave, kills: d.kills, bossesDefeated: d.bossesDefeated ?? new Set(d.bossesBeaten || []).size, perfectWaveCount: d.perfectWaveCount }), killsByPet = new Map();
    for (const tower of d.towers) killsByPet.set(tower.petId, (killsByPet.get(tower.petId) || 0) + (tower.kills || 0));
    // Only Rizos the player owns train. Loaners, structures and the universal kit do not.
    const owned = new Set(host.roster().map(pet => pet.id)), usedIds = new Set(d.usedPetIds?.length ? d.usedPetIds : d.towers.map(tower => tower.petId)), pets = {};
    for (const petId of usedIds) {
      if (!owned.has(petId)) continue;
      const towerKills = killsByPet.get(petId) || 0, amount = Math.min(8, .25 + clearedWave * .12 + towerKills * .035);
      pets[petId] = { skills: { power: amount, instinct: amount * .55, stamina: amount * .55 }, xp: Math.min(90, clearedWave * 2.2 + towerKills * .5), bond: Math.min(8, clearedWave * .18), played: true };
    }
    const applied = host.award({ reason: "defense-run", embers, heat: Math.min(80, 10 + clearedWave * 3), run: true, pets, active: { energy: -DEFENSE_ENERGY, hunger: -3, mood: Math.min(18, clearedWave * .6) } });
    return { embers: applied?.embers ?? embers, trained: Object.keys(applied?.pets || pets).length };
  }
  function finishDefenseRun(defenseEndReason = null) {
    if (!mini.active) return;
    const live = mini.defense;
    if (live) flushDefenseIncome(live, "finish");
    const defenseSnapshot = live ? {currentWave:live.currentWave,clearedWave:live.clearedWave,wave:live.currentWave,ended:defenseEndReason==="gate"?"gate":"banked",lives:live.lives,kills:live.kills,cash:live.cash,totalDamage:live.totalDamage,towers:live.towers,usedPetIds:[...(live.usedPetIds||[])],bossesBeaten:[...(live.bossesBeaten||[])],bossesDefeated:live.bossesDefeated||0,perfectWaveCount:live.perfectWaveCount||0,enemyStats:JSON.parse(JSON.stringify(live.enemyStats||{})),contract:live.contract?{...live.contract}:null,mapId:live.mapId,map:live.map} : null;
    closeDefensePause(true);
    mini.active = false;
    teardownRun();
    stage?.close(); stage = null;
    applyDefenseBodySettings(false);
    clearDefenseCheckpoint();
    mini.defense = { ...defenseSnapshot, towers: defenseSnapshot?.towers || [] };
    const rewards = rewardDefenseRun();
    const records = store.records;
    records.best = Math.max(records.best || 0, defenseSnapshot?.clearedWave || 0);
    const priorMapBest = defenseSnapshot?.mapId ? Math.max(0, Math.floor(Number(records.maps?.[defenseSnapshot.mapId]) || 0)) : 0;
    if (defenseSnapshot?.mapId) records.maps[defenseSnapshot.mapId] = Math.max(priorMapBest, defenseSnapshot?.clearedWave || 0);
    const runRecord = recordDefenseRun(defenseSnapshot);
    persistStore();
      const wave=defenseSnapshot?.clearedWave||0,reachedWave=defenseSnapshot?.currentWave||wave,kills=defenseSnapshot?.kills||0,lives=defenseSnapshot?.lives||0,bosses=[...new Set(defenseSnapshot?.bossesBeaten||[])],stats=defenseSnapshot?.enemyStats||{},heartLoss=Number(stats.heartLoss)||0,leaks=Object.values(stats.leaked||{}).reduce((sum,value)=>sum+(Number(value)||0),0),counters=stats.counters||{},leaders=[...(defenseSnapshot?.towers||[])].sort((a,b)=>(b.damage||0)-(a.damage||0)).slice(0,3),topTower=[...(defenseSnapshot?.towers||[])].filter(tower=>!String(tower.petId||"").startsWith("defense-crew-")&&!String(tower.petId||"").startsWith("defense-structure-")&&tower.petId!==DEFENSE_BASIC_TOWER.id).sort((a,b)=>(b.damage||0)-(a.damage||0))[0]||null,perfect=wave>0&&heartLoss===0,mapBest=Math.max(0,Math.floor(Number(store.records.maps?.[defenseSnapshot?.mapId])||0)),medal=defenseMedalName(defenseMedalTier(mapBest)),mastery=runRecord?.mvpPetId?store.records.mastery?.[runRecord.mvpPetId]:null;
      const century=wave>=100,newBest=wave>priorMapBest;showModal(`<div class="modal-card arcade-result defense-result defense-run-recap ${century?"century-clear":""}"><div class="defense-result-hero"><div class="modal-art defense-result-balloon"><i></i></div><small>${escapeHTML(defenseSnapshot?.map?.name||"PINE BEND")} • RUN COMPLETE</small><h2>${century?"WAVE 100+":"WAVE "+wave}</h2>${newBest?`<div class="arcade-best-banner"><i aria-hidden="true">\u2605</i><div><small>NEW PERSONAL BEST</small><b>WAVE ${wave}</b><em>PREVIOUS WAVE ${priorMapBest}</em></div></div>`:""}<p class="big-line">${century?"THE GATE SURVIVED A CENTURY.":lives<=0?"THE GATE FINALLY FELL.":perfect?"PERFECT GATE. NOTHING GOT THROUGH.":"RUN BANKED."}</p></div><div class="defense-result-primary"><span>${defenseMedalMarkup(defenseSnapshot?.mapId,mapBest)}<b>${escapeHTML(medal)}</b></span><span><small>R EARNED</small><b>+${rewards.embers}</b></span><span><small>MVP</small><b>${escapeHTML(topTower?.pet?.name||runRecord?.mvpName||captainPet().name)}</b></span></div><div class="defense-result-grid v80"><span>POPS<b>${kills}</b></span><span>HEARTS LOST<b>${heartLoss}</b></span><span>BOSSES<b>${bosses.length}</b></span></div>${runRecord?.contractComplete?`<div class="defense-contract-seal"><span>◇</span><div><small>TRAIL CONTRACT SEALED</small><b>${escapeHTML(defenseSnapshot.contract?.title||"DAILY TRAIL CONTRACT")}</b></div></div>`:""}<details class="defense-result-details"><summary>RUN DETAILS</summary><div class="defense-counter-recap"><span>LEAKS <b>${leaks}</b></span><span>RIZOS TRAINED <b>${rewards.trained}</b></span><span>ARMOR BROKEN <b>${Number(counters.armorBreaks)||0}</b></span><span>ARMOR SHRED <b>${Number(counters.armorShreds)||0}</b></span><span>REVEALS <b>${Number(counters.reveals)||0}</b></span><span>PHASE LOCKS <b>${Number(counters.phaseLocks)||0}</b></span><span>BOSS BREAKS <b>${Number(counters.bossInterrupts)||0}</b></span><span>DAMAGE <b>${Math.round(topTower?.damage||runRecord?.mvpDamage||0)}</b></span></div></details><div class="modal-buttons"><button class="primary" data-defense-exit>BACK TO ARCADE</button><button data-defense-replay>RUN IT BACK</button></div></div>`);
      if(wave>=10)celebrate();
  }

  // ===== INPUT =====
  function bindRunInput() {
    // Bound once; every handler checks that a run is on screen.
    document.addEventListener("pointerdown", event => {
      if (!mini.active || !stage?.arena.contains(event.target)) return;
      if (event.target.closest("#defenseWorld")) event.preventDefault();
      handleDefensePointerDown(event);
    });
    document.addEventListener("pointermove", event => { if (mini.active && mini.defenseDrag) moveDefenseDrag(event); }, { passive: false });
    document.addEventListener("pointerup", event => { if (mini.active) endDefenseDrag(event); });
    document.addEventListener("pointercancel", event => { if (mini.active) endDefenseDrag(event, true); });
    document.addEventListener("lostpointercapture", event => { if (mini.active && mini.defenseDrag?.pointerId === event.pointerId) cancelDefenseTransientInput("lost-capture"); });
    window.addEventListener("blur", () => { if (mini.active) cancelDefenseTransientInput("window-blur"); }, { passive: true });
    window.addEventListener("orientationchange", () => { if (mini.active) cancelDefenseTransientInput("orientationchange"); }, { passive: true });
    document.addEventListener("click", handleDefenseClick);
  }
  // Keys arrive from the hub only while Defense is the active mode.
  function handleDefenseKey(event) {
    if (!mini.active) return false;
    if (defenseHandleContextKeydown(event)) return true;
    const typing = Boolean(event.target?.closest?.("input, textarea, select, [contenteditable='true']"));
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return false;
    const key = String(event.key);
    if (key.toLowerCase() === "p" && !host?.ui?.modalOpen?.()) { event.preventDefault(); if (mini.paused) closeDefensePause(); else openDefensePause(); return true; }
    if (key === "Escape") { if (mini.paused) closeDefensePause(); else openDefensePause(); return true; }
    return false;
  }

  // ===== LOBBY AND META CLICKS =====
  function handleDefenseClick(event) {
    if (!host) return;
    const target = event.target;
    if (target.closest("[data-defense-pause-resume]")) { closeDefensePause(); return; }
    if (target.closest("[data-defense-pause-leave]")) { closeDefensePause(true); finishDefenseRunWithMoment("banked"); return; }
    if (target.closest("[data-defense-exit]")) { closeModal(); host.exit({ reason: "recap" }); return; }
    if (target.closest("[data-defense-replay]")) { closeModal(); showDefenseWorldLobby("auto"); return; }
    if (target.closest("[data-defense-intro-continue]")) { store.introSeen = true; persistStore(); showDefenseWorldLobby("auto"); return; }
    if (target.closest("[data-replay-defense-intro]")) { showDefenseOriginIntro(true); return; }
    if (target.closest("[data-defense-lobby-more]")) { showDefenseWorldExtras(); return; }
    if (target.closest("[data-defense-records]")) { showDefenseRecords(); return; }
    const guideButton = target.closest("[data-defense-field-guide]");
    if (guideButton) { showDefenseFieldGuide(guideButton.dataset.defenseFieldGuide || "rizos"); return; }
    const guideTab = target.closest("[data-field-guide-tab]")?.dataset.fieldGuideTab;
    if (guideTab) { showDefenseFieldGuide(guideTab); return; }
    if (target.closest("[data-defense-school-open]")) { showDefenseTrailSchool(); return; }
    if (target.closest("[data-defense-school-restart]")) { restartDefenseSchool(); showDefenseTrailSchool(); return; }
    if (target.closest("[data-defense-school-dismiss]")) { const school = defenseSchoolState(); school.dismissed = !school.dismissed; persistStore(); showDefenseTrailSchool(); return; }
    if (target.closest("[data-defense-records-back]")) { showDefenseWorldLobby(pendingDefenseMapChoice); return; }
    const replayContractId = target.closest("[data-replay-defense-contract]")?.dataset.replayDefenseContract;
    if (replayContractId) { const contract = normalizeDefenseRunContract((store.records.contracts || []).find(item => item?.id === replayContractId)); if (!contract) { toast("CONTRACT RECORD NOT FOUND"); return; } startRunSoon({ mapId: contract.mapId, defenseContract: contract }); return; }
    // A run nobody resumes is banked, never thrown away.
    if (target.closest("[data-discard-defense-run]")) { const checkpoint = readDefenseCheckpoint(); if (!checkpoint) { showDefenseWorldLobby(pendingDefenseMapChoice); return; } startRunSoon({ mapId: checkpoint.mapId, resumeCheckpoint: checkpoint, bankOnArrival: true }); return; }
    if (target.closest("[data-resume-defense-run]")) {
      const checkpoint = readDefenseCheckpoint();
      if (!checkpoint) { showDefenseWorldLobby(pendingDefenseMapChoice); toast("NO VALID DEFENSE CHECKPOINT"); return; }
      startRunSoon({ mapId: checkpoint.mapId, resumeCheckpoint: checkpoint });
      return;
    }
    const rosterPick = target.closest("[data-defense-roster-pick]")?.dataset.defenseRosterPick;
    if (rosterPick) { if (toggleDefenseRosterPick(rosterPick)) { showDefenseWorldLobby(pendingDefenseMapChoice); sfx("ui"); } else if (readDefenseCheckpoint()) toast("RESUME OR BANK THE CHECKPOINT FIRST"); else toast("CREW SLOTS ARE FULL"); return; }
    const lobbyMap = target.closest("[data-defense-lobby-map]")?.dataset.defenseLobbyMap;
    if (lobbyMap) { showDefenseWorldLobby(lobbyMap); return; }
    const enterContract = target.closest("[data-enter-defense-contract]")?.dataset.enterDefenseContract;
    if (enterContract) {
      const contract = ensureDailyDefenseContract();
      if (contract.id !== enterContract) { showDefenseWorldLobby(pendingDefenseMapChoice); toast("TODAY’S CONTRACT CHANGED"); return; }
      startRunSoon({ mapId: contract.mapId, defenseContract: contract });
      return;
    }
    const enterDefense = target.closest("[data-enter-defense-world]")?.dataset.enterDefenseWorld;
    if (enterDefense !== undefined) { startRunSoon({ mapId: defenseResolvedMapId(enterDefense || "auto") }); return; }
  }
  // A Defense modal closed by the player (backdrop, Escape, close button) with
  // no run on screen means they left Defense.
  function defenseModalClosed() {
    if (!host || mini.active || runStarting) return;
    host.exit({ reason: "closed" });
  }

  // ===== REGISTRATION =====
  const defense = Modes.register({
    id: "defense",
    name: "RIZO DEFENSE",
    schema: DEFENSE_SLICE_SCHEMA,
    entry: { energy: DEFENSE_ENERGY },
    settings: DEFENSE_SETTINGS,
    migrate,
    // Public facts for hub surfaces (shelf card, keeper path, trophies).
    summary(data) {
      const records = normalizeStore(data).records;
      const milestone = records.milestones[records.milestones.length - 1] || 0;
      return { best: records.best, bestLabel: records.best ? `W${records.best}` : "—", unit: "wave", milestones: [...records.milestones], badge: milestone ? { text: `W${milestone}`, title: `Defense milestone: wave ${milestone}` } : null };
    },
    create(hostApi) {
      host = hostApi;
      loadStore();
      refreshCrewSnapshots();
      return {
        start(options = {}) {
          if (options.qaIdle) return; // QA builds only: attach without opening anything (see qaAttach).
          if (options.mapId || options.resumeCheckpoint || options.defenseContract) beginRun(options);
          else showDefenseOriginIntro(false);
        },
        stop() {
          if (mini.active) {
            // Leaving mid-run (an update, a blocked save): keep the run resumable.
            pauseDefenseForInterruption();
            writeDefenseCheckpoint(true, "exit");
            mini.active = false;
            teardownRun();
          }
          closeDefensePause(true);
          clearJobs();
          applyDefenseBodySettings(false);
          host?.audio?.music?.(null);
          stage = null; host = null; store = null; captain = null; houseCrew = [];
          mini = idleRuntime();
          runStarting = false;
        },
        suspend(reason) {
          if (!mini.active) return;
          cancelDefenseTransientInput(reason);
          pauseDefenseForInterruption();
          writeDefenseCheckpoint(true, reason);
          holdJobs();
        },
        resume() {
          if (!mini.active) return;
          mini.lastFrame = performance.now();
          releaseJobs();
          surfaceDefenseInterruptionPause();
        },
        key: handleDefenseKey,
        resize() { if (mini.active) scheduleDefenseTowerGeometrySync(); },
        quit() { if (mini.active) { pauseDefenseForInterruption(); writeDefenseCheckpoint(true, "quit"); } host?.exit({ reason: "quit" }); }
      };
    },
    qa: hubQA => createDefenseQA(hubQA)
  });
  bindRunInput();

  // ===== QA HOOKS =====
  // Merged into window.RizoRuntimeQA by the hub on QA builds only. Names are kept
  // from the pre-contract build so the Defense browser suites keep running.
  function qaStartDefense(options = {}) {
    const run = { mapId: options.mapId || "auto", resumeCheckpoint: options.resumeCheckpoint || null, defenseContract: options.defenseContract || null };
    if (!host) return Modes.launch("defense", run);
    // As before v88, starting a run over a live one throws the old run away (QA only).
    if (mini.active) { closeDefensePause(true); mini.active = false; teardownRun(); clearDefenseCheckpoint(); mini = idleRuntime(); }
    runStarting = false;
    return beginRun(run);
  }
  // Before v88 Defense data sat in the hub state, so these hooks worked at any
  // time. Now they first attach the mode the way the shelf does (no UI opens).
  function qaAttach() {
    if (!host) Modes.launch("defense", { qaIdle: true });
    return Boolean(host);
  }
  function qaDetachIdle() {
    if (host && !mini.active && !runStarting) host.exit({ reason: "qa-switch" });
  }
  function createDefenseQA(hubQA = {}) {
    const qa = {
      startMiniGame: (mode, options = {}) => { if (mode === "defense") return qaStartDefense(options); qaDetachIdle(); return hubQA.startMiniGame?.(mode, options); },
      finishMiniGame: (...args) => { if (mini.active) { finishDefenseRun(args[1] || null); return; } return hubQA.finishMiniGame?.(...args); },
      miniSnapshot: () => (mini.active
        ? { active: true, mode: "defense", track: null, voices: 0, intervals: 0, timeouts: jobs.size, entities: (mini.entities || []).length, defense: mini.defense ? { mapId: mini.defense.mapId, contract: mini.defense.contract ? { ...mini.defense.contract } : null, maxTowers: mini.defense.maxTowers, speed: mini.defense.speed, currentWave: mini.defense.currentWave, clearedWave: mini.defense.clearedWave, wave: mini.defense.currentWave, lives: mini.defense.lives, cash: mini.defense.cash, towers: (mini.defense.towers || []).length, enemies: (mini.defense.enemies || []).length, phase: mini.defense.phase } : null }
        : hubQA.miniSnapshot?.()),
      // The shared freeze probes answer for Defense's own pause and job queue while a run is live.
      arcadePauseForQA: () => (mini.active ? openDefensePause() : hubQA.arcadePauseForQA?.()),
      arcadeResumeForQA: () => (mini.active ? closeDefensePause(true) : hubQA.arcadeResumeForQA?.()),
      arcadeJobsForQA: () => (mini.active
        ? { count: jobs.size, held: Boolean(jobsHeldAt), holds: jobsHeldAt ? ["pause"] : [], armed: jobsHeldAt ? 0 : jobs.size, pending: [...jobs].map(job => ({ id: "defense", remaining: Math.round(job.due - performance.now()), repeat: false })) }
        : hubQA.arcadeJobsForQA?.()),
      arcadeClockForQA: () => (mini.active
        ? { active: true, mode: "defense", endless: true, remaining: Infinity, frozen: false, paused: Boolean(mini.paused), sources: mini.paused ? ["manual"] : [], jobsHeld: Boolean(jobsHeldAt), jobHolds: jobsHeldAt ? ["pause"] : [] }
        : hubQA.arcadeClockForQA?.()),
      defenseStoreForQA: () => JSON.parse(JSON.stringify(store || normalizeStore(null))),
      defenseMigrateForQA: legacy => JSON.parse(JSON.stringify(migrate(null, 0, legacy))),
    showDefenseLobbyForQA: (choice="auto") => { if (!host) Modes.launch("defense", {}); showDefenseWorldLobby(choice); return {choice:pendingDefenseMapChoice,checkpoint:Boolean(readDefenseCheckpoint())}; },
    defenseWriteCheckpointForQA: (reason="qa") => writeDefenseCheckpoint(true,String(reason||"qa")),
    defenseReadCheckpointForQA: () => { const checkpoint=readDefenseCheckpoint(); return checkpoint?{checkpointVersion:checkpoint.checkpointVersion,savedAt:checkpoint.savedAt,keeperId:checkpoint.keeperId,mapId:checkpoint.mapId,contract:checkpoint.contract?{...checkpoint.contract}:null,currentWave:checkpoint.currentWave,clearedWave:checkpoint.clearedWave,reachedWave:checkpoint.currentWave,lives:checkpoint.lives,cash:checkpoint.cash,phase:checkpoint.phase,resumePhase:checkpoint.resumePhase,speed:checkpoint.speed,clock:checkpoint.clock,towers:checkpoint.towers.map(tower=>({...tower})),enemies:checkpoint.enemies.map(enemy=>({...enemy})),projectiles:checkpoint.projectiles.map(shot=>({...shot})),spawnQueue:checkpoint.spawnQueue.map(entry=>typeof entry==="string"?entry:{...entry}),wavePackets:checkpoint.wavePackets.map(packet=>({...packet,enemies:packet.enemies.map(entry=>typeof entry==="string"?entry:{...entry})})),childSpawnQueue:checkpoint.childSpawnQueue.map(item=>({...item,options:{...item.options}})),waveTotal:checkpoint.waveTotal,waveResolved:checkpoint.waveResolved,validationWarning:checkpoint.validationWarning||null,reason:checkpoint.reason}:null; },
    defenseClearCheckpointForQA: () => { clearDefenseCheckpoint(); return !readDefenseCheckpoint(); },
    defenseCheckpointKeyForQA: () => host?.run.key || "rizo-mode-run:defense",
    defenseRestoreCheckpointForQA: raw => restoreDefenseCheckpoint(raw),
    defenseNormalizeCheckpointForQA: raw => {const normalized=normalizeDefenseCheckpoint(raw);return normalized?JSON.parse(JSON.stringify(normalized)):null;},
    defenseSignCheckpointForQA: (raw,version=DEFENSE_CHECKPOINT_VERSION) => {const checkpoint=JSON.parse(JSON.stringify(raw||{})),safeVersion=DefenseCore.clampInteger(version,2,DEFENSE_CHECKPOINT_VERSION,DEFENSE_CHECKPOINT_VERSION);checkpoint.checkpointVersion=safeVersion;checkpoint.signature=DefenseCore.createSaveSignature(checkpoint,safeVersion);return checkpoint;},
    defenseBuildCheckpointForQA: (reason="qa") => mini.defense?JSON.parse(JSON.stringify(buildDefenseCheckpoint(mini.defense,String(reason||"qa")))):null,
    defenseCoreForQA: () => ({version:DefenseCore.VERSION,limits:{...DEFENSE_LIMITS},phases:{...DEFENSE_PHASES},budgets:JSON.parse(JSON.stringify(DEFENSE_BUDGETS)),simulation:{...DefenseCore.SIMULATION},economy:{...DefenseCore.ECONOMY},upgradeCosts:[...DefenseCore.UPGRADE_COSTS],goldenAtTwenty:DefenseCore.goldenBonus(20),goldenActiveOne:DefenseCore.goldenActivePayout({clearedWave:20,upgradeLevel:2,goldenTowerCount:1}),goldenActiveFive:DefenseCore.goldenActivePayout({clearedWave:20,upgradeLevel:2,goldenTowerCount:5}),deploySamples:[0,1,2,3].map(paidTowerCount=>DefenseCore.deploymentCost({paidTowerCount,copyCount:0,activeFirst:false})),densityNormal1x:DefenseCore.densityCap({low:false,speed:1}),densityNormal2x:DefenseCore.densityCap({low:false,speed:2}),densityLow1x:DefenseCore.densityCap({low:true,speed:1}),visualNormal1x:DefenseCore.visualBudget({low:false,speed:1}),visualNormal2x:DefenseCore.visualBudget({low:false,speed:2}),visualLow2x:DefenseCore.visualBudget({low:true,speed:2})}),
    defenseSetRunForQA: (values={}) => { const d=mini.defense;if(!d)return null;if(Number.isFinite(Number(values.wave)))d.wave=Math.max(0,Math.floor(Number(values.wave)));if(Number.isFinite(Number(values.lives)))d.lives=clamp(Math.floor(Number(values.lives)),0,d.map.lives);if(Number.isFinite(Number(values.cash)))d.cash=Math.max(0,Number(values.cash));if(values.phase)d.phase=DefenseCore.normalizePhase(values.phase,d.phase);if(Number.isFinite(Number(values.clock)))d.clock=Math.max(0,Number(values.clock));if(typeof values.paused==="boolean")d.paused=values.paused;markDefenseUi({roster:true});flushDefenseUi(true);return{currentWave:d.currentWave,clearedWave:d.clearedWave,wave:d.currentWave,lives:d.lives,cash:d.cash,phase:d.phase,clock:d.clock,paused:d.paused}; },
    defensePhaseForQA: () => {const d=mini.defense;if(!d)return null;const ui=defensePhaseUi(d);return{phase:d.phase,resumePhase:d.resumePhase||null,currentWave:d.currentWave,clearedWave:d.clearedWave,label:ui.label,detail:ui.detail,tone:ui.tone,domLabel:$("#defensePhaseLabel")?.textContent||"",domDetail:$("#defensePhaseDetail")?.textContent||"",domWave:$("#defenseWave")?.textContent||"",domCleared:$("#defenseClearedWave")?.textContent||"",transitionRejects:d.phaseTransitionRejects||0};},
    defenseAttemptPhaseForQA: requested => {const d=mini.defense;if(!d)return null;const before=d.phase,normalized=DefenseCore.normalizePhase(requested,before),accepted=defenseSetPhase(d,normalized),after=d.phase;flushDefenseUi(true);return{before,requested:normalized,accepted,after,rejects:d.phaseTransitionRejects||0};},
    defenseOverlayForQA: () => {const d=mini.defense;if(!d)return null;const surface=defenseContextSurface(d),host=surface?defenseContextElement(surface):null,active=document.activeElement;return{surface,fieldMenuOpen:Boolean(d.fieldMenuOpen),abilityTrayOpen:Boolean(d.abilityTrayOpen),intelOpen:Boolean(d.intelOpen),towerOpen:Boolean(d.selectedTowerId),scrimHidden:$(".defense-context-scrim")?.hidden??true,stageInert:Boolean($(".defense-stage-frame")?.inert),commandsInert:Boolean($(".defense-command-deck")?.inert),rosterInert:Boolean($(".defense-deploy-dock")?.inert),focusInside:Boolean(host&&active&&host.contains(active)),activeTag:active?.tagName||"",activeText:(active?.textContent||"").trim().slice(0,80)};},
    defenseSchoolForQA: () => JSON.parse(JSON.stringify(defenseSchoolState())),
    defenseSchoolRestartForQA: () => {restartDefenseSchool();return JSON.parse(JSON.stringify(defenseSchoolState()));},
    defenseSchoolCompleteForQA: id => {const ok=completeDefenseSchoolLesson(String(id||""),{silent:true});return{ok,school:JSON.parse(JSON.stringify(defenseSchoolState()))};},
    defenseSchoolCoachForQA: () => ({next:defenseSchoolNext()?.id||null,hidden:$("#defenseSchoolCoach")?.hidden??true,text:$("#defenseSchoolCoach")?.textContent||""}),
    defenseTraceRouteForQA: () => traceDefenseRoute(),
    defenseFieldGuideMarkupForQA: tab => defenseFieldGuideMarkup(tab||"rizos"),
    defenseShowFieldGuideForQA: tab => {showDefenseFieldGuide(tab||"rizos");const card=document.querySelector("#modalOverlay .defense-field-guide");return{shown:Boolean(card),text:card?.textContent||""};},
    defenseShowRecordsForQA: () => {showDefenseRecords();const card=document.querySelector("#modalOverlay .defense-records-modal");return{shown:Boolean(card),text:card?.textContent||""};},
    defenseShowLobbyForQA: mapId => {showDefenseWorldLobby(mapId||"grove");const card=document.querySelector("#modalOverlay .defense-world-lobby");return{shown:Boolean(card),text:card?.textContent||""};},
    defenseRosterConfigForQA: () => {const configured=defenseConfiguredRoster(),mapId=defenseResolvedMapId(pendingDefenseMapChoice),read=defenseRosterRead(configured,mapId);return{slots:DEFENSE_ROSTER_WING_SLOTS,guestAllowed:defenseGuestAccessAllowed(),configured:configured.map(row=>({id:row.pet.id,name:row.pet.name,source:row.source,variant:row.pet.variant||row.pet.hiddenVariant,tags:defenseRosterIdentity(row.pet).tags,training:defenseRosterTrainingEdge(row.pet),masteryLean:defenseMasteryLean(store.records.mastery?.[row.pet.id]),trailFit:defenseRosterTrailFit(row.pet,mapId)})),owned:defenseOwnedRosterEntries().map(row=>({id:row.pet.id,source:row.source,variant:row.pet.variant||row.pet.hiddenVariant})),read:{mapId,captainPower:read.captainPower,tools:read.tools,fitIds:read.fits.map(row=>row.pet.id),openingLabel:read.openingLabel,hasOpeningDeal:read.hasOpeningDeal}};},
    defenseSetRosterForQA: ids => {if(readDefenseCheckpoint())clearDefenseCheckpoint();defenseSetConfiguredWingIds(Array.isArray(ids)?ids:[]);return defenseConfiguredRoster().map(row=>({id:row.pet.id,source:row.source}));},
    defenseShowTowerPanelForQA: () => {const tower=mini.defense?.towers[0];if(!tower)return false;showDefenseTowerPanel(tower);return{shown:!$("#defenseTowerPanel")?.hidden,text:$("#defenseTowerPanel")?.textContent||""};},
    showDefenseFieldGuideForQA: tab => {showDefenseFieldGuide(tab||"rizos");return true;},
    defenseMapMetaForQA: () => Object.fromEntries(DEFENSE_MAP_ORDER.map(id=>[id,{entrance:DEFENSE_MAPS[id].entrance,lore:DEFENSE_MAPS[id].lore,lesson:DEFENSE_MAPS[id].lesson}])),
    defenseRecordsForQA: () => JSON.parse(JSON.stringify({history:store.records.history||[],mastery:store.records.mastery||{},contracts:store.records.contracts||[],perfectMaps:store.records.perfectMaps||[],maps:store.records.maps||{}})),
    defenseSetMasteryForQA: (petId,waves=0) => {const row=defenseRoster().find(item=>item.pet.id===petId)||defenseRoster()[0];if(!row)return null;const prior=store.records.mastery?.[row.pet.id]||{};store.records.mastery||={};store.records.mastery[row.pet.id]={petId:row.pet.id,name:row.pet.name,variant:row.pet.variant||row.pet.hiddenVariant||"classic",runs:Math.max(1,Number(prior.runs)||1),waves:Math.max(0,Number(waves)||0),bestWave:Math.max(0,Number(prior.bestWave)||0),pops:Math.max(0,Number(prior.pops)||0),damage:Math.max(0,Number(prior.damage)||0),bosses:Math.max(0,Number(prior.bosses)||0),powerPaths:Math.max(0,Number(prior.powerPaths)||0),controlPaths:Math.max(0,Number(prior.controlPaths)||0),lastAt:now()};return{tier:defenseMasteryTier(store.records.mastery[row.pet.id]),title:defenseMasteryTitle(store.records.mastery[row.pet.id]),signature:defenseMasterySignatureName(store.records.mastery[row.pet.id])};},
    defenseSetPresentationForQA: (fx="auto",ui="standard",signatures=true) => {store.settings.fx=["auto","full","low"].includes(fx)?fx:"auto";store.settings.uiScale=["compact","standard","large"].includes(ui)?ui:"standard";store.settings.signatures=signatures!==false;applyDefenseBodySettings(true);return{fx:store.settings.fx,ui:store.settings.uiScale,signatures:store.settings.signatures,body:document.body.className};},
    defenseSetRendererForQA: mode => {defenseRendererOverride=["canvas","dom"].includes(String(mode))?String(mode):null;return defenseRendererOverride||"auto";},
    defenseDisableCanvasForQA: () => {const d=mini.defense;if(!d?.canvasRenderer)return false;d.canvasRenderer.enabled=false;renderDefensePresentation(1,true);return{rendererMode:d.rendererMode,enemyNodes:document.querySelectorAll(".defense-enemy").length,projectileNodes:document.querySelectorAll(".defense-shot").length,canvasFallbacks:d.canvasFallbacks||0};},
    defenseRecordsMarkupForQA: () => defenseRecordsMarkup(),
    showDefenseRecordsForQA: () => {showDefenseRecords();return true;},
    defenseDailyContractForQA: date => JSON.parse(JSON.stringify(ensureDailyDefenseContract(date||dateKey()))),
    defenseStartContractForQA: raw => {const contract=normalizeDefenseRunContract(raw)||ensureDailyDefenseContract();qaStartDefense({mapId:contract.mapId,defenseContract:contract});return mini.defense?{id:mini.defense.contract?.id||null,mapId:mini.defense.mapId,rules:[...(mini.defense.contract?.rules||[])],maxTowers:mini.defense.maxTowers}:null;},
    defenseContractForQA: () => mini.defense?.contract?JSON.parse(JSON.stringify(mini.defense.contract)):null,
    defenseSellForQA: () => {const tower=mini.defense?.towers[0];return tower?sellDefenseTower(tower.id):false;},
    defenseSellLastForQA: () => {const tower=mini.defense?.towers.at(-1);return tower?sellDefenseTower(tower.id):false;},
    defenseBuyUpgradeForQA: id => {const tower=id?mini.defense?.towers.find(item=>item.id===id):mini.defense?.towers.at(-1);return tower?upgradeDefenseTower(tower.id):false;},
    defenseEconomyForQA: () => {const d=mini.defense,tower=d?.towers.at(-1);return d?{baseStartingCash:BASE_DEFENSE_STARTING_CASH,cash:d.cash,mapId:d.mapId,worldPerk:defenseWorldPerkLabel(d),worldPerkUsed:Boolean(d.worldPerkUsed),phase:d.phase,placementAllowed:defensePlacementAllowed(d),sellAllowed:defenseSellAllowed(d),upgradeAllowed:defenseUpgradeAllowed(d),goldenBonus:defenseGoldenBonus(),goldenFactoryMultiplier:DefenseCore.goldenFactoryMultiplier(defenseAwakenedGoldenCount(d)),tower:tower?{id:tower.id,structureType:defenseStructureType(tower),cost:tower.cost,spent:tower.spent,upgrade:tower.upgrade,openingPerkApplied:Boolean(tower.openingPerkApplied),canUndo:defenseCanUndoPlacement(tower,d),sellRefund:defenseSellRefund(tower,d),nextUpgradeCost:defenseUpgradeCost(tower,d)}:null}:null;},
    defenseStructuresForQA: () => {const d=mini.defense;return d?d.towers.filter(t=>defenseStructureType(t)).map(t=>({id:t.id,type:defenseStructureType(t),upgrade:t.upgrade,cost:t.cost,spent:t.spent,totalProduced:t.totalProduced||0,nextProductionAt:t.nextProductionAt||0,cleanCycles:t.factoryCleanCycles||0,factory:defenseStructureType(t)==="factory"?defenseFactoryEconomy(t,d):null,beacon:defenseStructureType(t)==="beacon"?{...DefenseCore.beaconSupport(t.upgrade),network:defenseBeaconNetwork(t,d)}:null})):[];},
    defenseCastForQA: () => {const tower=mini.defense?.towers[0],d=mini.defense;if(!tower||!d)return false;tower.upgrade=Math.max(2,tower.upgrade);tower.doctrine=tower.doctrine||defenseContractForcedDoctrine()||"power";tower.abilityReadyAt=0;defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});d.paused=false;return activateDefenseAbility(tower.id);},
    defenseAbilityGroupsForQA: () => defenseAbilityGroups().map(group=>({id:group.id,active:group.ability.active,total:group.instances.length,ready:group.ready.length,nextRemaining:Number.isFinite(group.nextRemaining)?group.nextRemaining:null,instances:group.instances.map(row=>({id:row.tower.id,remaining:row.remaining,level:row.tower.upgrade+1,copy:row.tower.copyNumber||1,field:defenseTowerFieldLabel(row.tower)}))})),
    defenseSetAbilityStateForQA: (id,values={}) => {const d=mini.defense,tower=d?.towers.find(item=>item.id===id);if(!tower)return false;tower.upgrade=Math.max(2,Math.floor(Number(values.upgrade??tower.upgrade)||2));tower.doctrine=DEFENSE_DOCTRINES[values.doctrine]?values.doctrine:(tower.doctrine||"power");const remaining=Math.max(0,Number(values.remaining)||0);tower.abilityReadyAt=defenseNow()+remaining;defenseSetPhase(d,DefenseCore.normalizePhase(values.phase,DEFENSE_PHASES.COMBAT),{force:true});d.paused=Boolean(values.paused);refreshDefenseTower(tower);markDefenseUi();flushDefenseUi(true);return{id:tower.id,abilityId:defenseAbilityId(tower),remaining:Math.ceil(defenseAbilityRemaining(tower)),doctrine:tower.doctrine,upgrade:tower.upgrade};},
    defenseFieldLeaderForQA: () => {const tower=defenseFieldLeader();return tower?{id:tower.id,petId:tower.petId,name:tower.pet?.name||"",doctrine:tower.doctrine||null,upgrade:tower.upgrade,superForm:tower.superForm||null}:null;},
    defenseAscendForQA: id => {const tower=mini.defense?.towers.find(item=>item.id===id)||mini.defense?.towers[0];if(!tower)return false;return ascendDefenseTower(tower.id);},
    defenseOpenAbilitiesForQA: force => {toggleDefenseAbilityTray(force!==false);return{open:Boolean(mini.defense?.abilityTrayOpen),groups:defenseAbilityGroups().length,badge:$("#defenseAbilityCount")?.textContent||"",text:$("#defenseAbilityTray")?.textContent||""};},
    defenseToggleBenchForQA: force => {toggleDefenseBench(force);return{open:Boolean(mini.defense?.benchOpen),shell:$(".defense-shell")?.className||""};},
    defenseToggleFieldMenuForQA: force => {toggleDefenseFieldMenu(force);return{open:Boolean(mini.defense?.fieldMenuOpen),hidden:$("#defenseFieldMenu")?.hidden??true,shell:$(".defense-shell")?.className||""};},
    defenseActivateAbilityGroupForQA: id => activateDefenseAbilityGroup(String(id||"")),
    defenseBossTelegraphForQA: (bossId="crown") => {const d=mini.defense;if(!d)return false;defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});const enemy=spawnDefenseEnemy({type:"boss",bossId,intensity:0},{progress:.42});if(bossId==="crown"||bossId==="mirror")enemy.hp=enemy.maxHp*.49;else enemy.nextBossPulse=d.clock;handleDefenseBossMechanics(enemy);return{enemyId:enemy.id,bossId:enemy.bossId,kind:enemy.telegraphKind,until:enemy.telegraphUntil,interruptible:Boolean(DEFENSE_BOSS_TELEGRAPHS[enemy.telegraphKind]?.interruptible)};},
    defenseInterruptBossForQA: (enemyId,doctrine="control",hits=4) => {const d=mini.defense,enemy=d?.enemies.find(item=>item.id===enemyId),tower=d?.towers[0];if(!enemy||!tower)return false;tower.doctrine=doctrine;for(let i=0;i<Math.max(1,Number(hits)||1)&&enemy.telegraphKind;i+=1)disruptDefenseBossTelegraph(enemy,tower,.34);return{kind:enemy.telegraphKind,disruption:enemy.telegraphDisruption||0,interrupts:d.enemyStats.counters.bossInterrupts||0,phaseTriggered:Boolean(enemy.phaseTriggered),nextBossPulse:enemy.nextBossPulse};},
    miniSnapshot: () => ({active:Boolean(mini?.active),mode:mini?.mode||null,track:mini?.rhythmTrack?.id||null,voices:(mini?.rhythmVoices||[]).length,intervals:(mini?.intervals||[]).length,timeouts:(mini?.timeouts||[]).length,entities:(mini?.entities||[]).length,defense:mini?.defense?{mapId:mini.defense.mapId,contract:mini.defense.contract?{...mini.defense.contract}:null,maxTowers:mini.defense.maxTowers,speed:mini.defense.speed,currentWave:mini.defense.currentWave,clearedWave:mini.defense.clearedWave,wave:mini.defense.currentWave,lives:mini.defense.lives,cash:mini.defense.cash,towers:(mini.defense.towers||[]).length,enemies:(mini.defense.enemies||[]).length,phase:mini.defense.phase}:null}),
    defenseMapsForQA: () => ({best:Number(store.records.best)||0,unlocked:defenseUnlockedMaps().map(map=>map.id),all:Object.values(DEFENSE_MAPS).map(map=>({id:map.id,unlockWave:map.unlockWave,level:map.level}))}),
    defenseRandomMapsForQA: (count=30) => Array.from({length:Math.max(1,Number(count)||1)},()=>chooseDefenseMapId()),
    defenseSetMapForQA: selection => { const map=DEFENSE_MAPS[selection]; if(!mini.defense||!map||mini.defense.towers.length||mini.defense.currentWave>0)return mini.defense?.mapId||null; mini.defense.mapId=map.id;mini.defense.map=map;mini.defense.pathMetrics=defensePathMetrics(map.path);mini.defense.lives=map.lives;mini.defense.cash=BASE_DEFENSE_STARTING_CASH;renderDefenseWorld();return map.id; },
    defenseSetPetVariantForQA: (variant,petId=null) => {const row=petId?defenseRoster().find(item=>item.pet.id===petId):defenseRoster()[0];if(!row||!VARIANTS.some(item=>item.id===variant))return false;qaVariantOverrides.set(row.pet.id,String(variant));refreshCrewSnapshots();const fresh=defenseRestorableRegistry().get(row.pet.id);for(const tower of mini.defense?.towers||[])if(tower.petId===row.pet.id&&fresh)tower.pet=fresh.pet;markDefenseUi({roster:true});flushDefenseUi(true);return{petId:row.pet.id,variant:String(variant)};},
    defenseMapRoutesForQA: () => Object.fromEntries(DEFENSE_MAP_ORDER.map(id=>{const map=DEFENSE_MAPS[id],metrics=map.pathMetrics||defensePathMetrics(map.path);return[id,{name:map.name,routeType:map.routeType,strategy:map.strategy,anchors:map.route.map(point=>({...point})),points:map.path.map(point=>({...point})),length:metrics.total,segments:metrics.segments.length,blockedZones:(map.blockedZones||[]).map(zone=>({...zone})),landmarks:(map.landmarks||[]).map(item=>({...item})),buildPockets:(map.buildPockets||[]).map(item=>({...item})),mechanic:map.mechanic?{...map.mechanic}:null,mechanicZones:(map.mechanicZones||[]).map(item=>({...item}))}];})),
    defenseTowerCombatStatsForQA: (id=null) => {const d=mini.defense;if(!d)return[];return d.towers.filter(tower=>!id||tower.id===id).map(tower=>{const stats=defenseCombatStats(tower),bond=defenseMapBondForTower(tower,d);return{id:tower.id,mapId:d.mapId,mapBond:bond?{...bond}:null,damage:stats.damage,rate:stats.rate,range:stats.range,variant:stats.variant};});},
    defenseMapPointForQA: (mapId,progress) => {const map=DEFENSE_MAPS[mapId]||DEFENSE_MAPS.grove;return defenseMapPointAt(map,progress);},
    defenseMapSvgPathForQA: mapId => defenseMapSvgPath(DEFENSE_MAPS[mapId]||DEFENSE_MAPS.grove),
    defensePlacementGeometryForQA: () => {const g=defensePlacementGeometry();return{footprintPx:g.footprintPx,safetyPx:g.safetyPx,pathHalf:g.pathHalf,pathClearance:g.pathClearance,towerGap:g.towerGap,bounds:{...g.bounds},snap:g.snap,width:g.width,height:g.height};},
    defensePlacementEvaluationForQA: (x,y) => {const e=defensePlacementEvaluation(Number(x),Number(y));return{valid:e.valid,code:e.code,reason:e.reason,distance:e.distance??null,required:e.required??null,clearance:e.clearance??null};},
    defenseResolvePlacementForQA: (x,y,snapPx=DEFENSE_PLACEMENT_SNAP_PX) => {const r=resolveDefensePlacement(Number(x),Number(y),null,{snapPx:Number(snapPx)});return{point:{...r.point},raw:{...r.raw},valid:r.evaluation.valid,code:r.evaluation.code,reason:r.evaluation.reason,snapped:r.snapped,snapDistance:r.snapDistance,distance:r.evaluation.distance??null,required:r.evaluation.required??null};},
    defenseNearestPathForQA: (x,y) => {const p=nearestDefensePathPoint(Number(x),Number(y));return{x:p.x,y:p.y,distance:p.distance};},
    defenseDragStateForQA: () => mini.defenseDrag?{active:Boolean(mini.defenseDrag.active),scrolling:Boolean(mini.defenseDrag.scrolling),moved:Boolean(mini.defenseDrag.moved),result:mini.defenseDrag.result?{point:{...mini.defenseDrag.result.point},valid:mini.defenseDrag.result.evaluation.valid,snapped:mini.defenseDrag.result.snapped,code:mini.defenseDrag.result.evaluation.code}:null}:null,
    cancelDefenseInputForQA: reason => cancelDefenseTransientInput(reason||"qa-cancel"),
    defensePlaceForQA: (petId,x=.2,y=.42) => { const row=defenseDeployRegistry().get(petId)||defenseRoster()[0]; if(!row)return false; placeDefenseTower(row,Number(x),Number(y),defenseDeployCost(row)); return mini.defense.towers.length; },
    defenseStartWaveForQA: () => { startDefenseWave(); return mini.defense?.wave||0; },
    defensePlanForQA: wave => { if(!mini.defense)return null; const prior=mini.defense.waveAnnouncement; const plan=defenseWavePlan(Math.max(1,Number(wave)||1)); const announcement=mini.defense.waveAnnouncement; mini.defense.waveAnnouncement=prior; return {wave:plan.wave,modifier:plan.modifier,total:plan.plannedEnemyCount,estimatedDuration:plan.estimatedDuration,formationTier:plan.formationTier||0,pressureTags:[...(plan.pressureTags||[])],packets:plan.packets.map(packet=>({spawnGap:packet.spawnGap,breakAfter:packet.breakAfter,enemies:packet.enemies.map(item=>typeof item==="string"?item:{...item})})),announcement}; },
    defenseSetWaveForQA: wave => { if(mini.defense)mini.defense.wave=Math.max(0,Number(wave)||0); return mini.defense?.wave||0; },
    defenseSpawnBossForQA: id => { if(!mini.defense)return false; const boss=DEFENSE_BOSSES.find(item=>item.id===id)||DEFENSE_BOSSES[0]; spawnDefenseEnemy({type:"boss",bossId:boss.id,intensity:0}); return mini.defense.enemies.at(-1)?.bossId||null; },
    defenseSetEnemyHealthForQA: ratio => { const enemy=mini.defense?.enemies.at(-1); if(!enemy)return false; enemy.hp=Math.max(1,enemy.maxHp*clamp(Number(ratio)||0,0,1)); return enemy.hp; },
    defenseSetEnemyHealthByIdForQA: (enemyId,ratio) => {const enemy=mini.defense?.enemies.find(item=>item.id===enemyId);if(!enemy)return false;enemy.hp=Math.max(1,enemy.maxHp*clamp(Number(ratio)||0,0,1));return enemy.hp;},
    defenseTickForQA: seconds => { if(!mini.defense)return false; const real=Math.max(0,Number(seconds)||0);updateDefenseGame(real*(mini.defense.speed||1),real); return defenseNow(); },
    defenseRecordFrameForQA: ms => {const d=mini.defense;if(!d)return null;defenseRecordFramePerformance(Number(ms)||16.7);defenseApplyRenderTier(d);return{frameP95:d.frameP95,frameP99:d.frameP99,governorTier:d.governorTier,renderTier:d.renderTier,performanceLow:Boolean(d.performanceLow),densityCap:defenseDensityCap(d,d.spawnQueue[0]),visualBudget:defenseVisualBudget(d)};},
    defenseRapidFireForQA: count => {const d=mini.defense,tower=d?.towers[0];if(!d||!tower)return null;let target=d.enemies.find(enemy=>!enemy.dead&&enemy.hp>0);if(!target){let nearest={progress:.2,distance:Infinity};for(let i=0;i<=200;i+=1){const progress=i/200,point=defensePointAt(progress),distance=Math.hypot(point.x-tower.x,point.y-tower.y);if(distance<nearest.distance)nearest={progress,distance};}target=spawnDefenseEnemy("shell",{progress:nearest.progress,hpOverride:1e9,maxHpOverride:1e9});}const stats=defenseCombatStats(tower),shots=clamp(Math.floor(Number(count)||24),1,120);for(let i=0;i<shots;i+=1)fireDefenseTower(tower,target,stats);return{requested:shots,logical:d.projectiles.length,visible:defenseVisibleProjectileCount(d),coalescedVisual:d.coalescedVisualShots||0,coalescedLogical:d.coalescedLogicalShots||0,budget:defenseVisualBudget(d)};},
    defenseTryCompleteWaveForQA: () => {const d=mini.defense;if(!d)return null;const completed=completeDefenseWave();return{completed,currentWave:d.currentWave,clearedWave:d.clearedWave,spawnQueue:d.spawnQueue.length,childSpawnQueue:d.childSpawnQueue.length,enemies:d.enemies.length,projectiles:d.projectiles.length};},
    defenseResidueResolutionForQA: () => {const d=mini.defense;if(!d)return null;d.currentWave=Math.max(1,d.currentWave||1);d.clearedWave=Math.min(d.clearedWave,d.currentWave-1);defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});d.spawnQueue=[];d.wavePackets=[];d.packetIndex=0;d.packetEnemyIndex=0;d.childSpawnQueue=[];for(const enemy of d.enemies)releaseDefenseEnemyNode(enemy);d.enemies=[];d.waveResolved=Math.max(d.waveResolved||0,d.waveTotal||0);d.projectiles.push({id:"qa-stale-shot",node:null,life:99});const before=d.projectiles.length,resolved=isWaveFullyResolved(d),completed=completeDefenseWave();return{before,resolved,completed,after:d.projectiles.length,phase:d.phase,clearedWave:d.clearedWave};},
    defenseGateFlameForQA: progress => {const d=mini.defense;if(!d)return null;defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});d.gateFlameArmed=false;d.gateFlameProgress=clamp(Number(progress)||.5,0,1);d.gateFlameUntil=d.clock+DEFENSE_GATE_FLAME_DURATION;d.gateFlameReadyAt=d.clock+DEFENSE_GATE_FLAME_COOLDOWN;d.gateFlameNextTick=d.clock;updateDefenseGateFlame();markDefenseUi();flushDefenseUi(true);return qa.defenseSnapshotForQA().gateFlame;},
    defenseQueueChildForQA: (type="fleet",delay=.08) => {const d=mini.defense;if(!d)return null;const queued=queueDefenseChildSpawn(String(type||"fleet"),{progress:.45,delay:Number(delay)||0});return{queued,childSpawnQueue:d.childSpawnQueue.length};},
    defensePendingIncomeForQA: amount => {const d=mini.defense;if(!d)return null;queueDefenseIncome(Number(amount)||0,"qa");return{cash:d.cash,pendingIncome:d.pendingIncome};},
    defenseSetLowPerformanceForQA: low => {const d=mini.defense;if(!d)return null;d.performanceLow=Boolean(low);defenseApplyRenderTier(d,d.performanceLow?2:0);return{performanceLow:d.performanceLow,renderTier:d.renderTier,densityCap:defenseDensityCap(d,d.spawnQueue[0]),budget:defensePerformanceBudget(d)};},
    defenseCompleteWaveForQA: wave => { const d=mini.defense;if(!d)return false;d.currentWave=DefenseCore.clampInteger(wave,1,DEFENSE_LIMITS.MAX_SUPPORTED_WAVE,1);d.clearedWave=Math.min(d.clearedWave,d.currentWave-1);defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});d.spawnQueue=[];d.wavePackets=[];d.packetIndex=0;d.packetEnemyIndex=0;d.childSpawnQueue=[];d.enemies.forEach(enemy=>releaseDefenseEnemyNode(enemy));d.enemies=[];d.projectiles.forEach(shot=>releaseDefenseProjectileNode(shot));d.projectiles=[];d.waveResolved=Math.max(d.waveResolved||0,d.waveTotal||0);const completed=completeDefenseWave();return{completed,currentWave:d.currentWave,clearedWave:d.clearedWave,milestones:[...(store.records.milestones||[])]}; },
    defenseSetSpeedForQA: speed => { if(!mini.defense)return false; mini.defense.speed=[.5,1,2].includes(Number(speed))?Number(speed):1; defenseApplyRenderTier(mini.defense);updateDefenseHud(); return mini.defense.speed; },
    defenseSetEnemiesForQA: (progress=.35) => { if(!mini.defense)return 0; for(const enemy of mini.defense.enemies){enemy.progress=clamp(Number(progress)||0,0,.98);const point=defensePointAt(enemy.progress);enemy.x=point.x;enemy.y=point.y;enemy.prevX=point.x;enemy.prevY=point.y;updateDefenseEnemyNode(enemy,true);} return mini.defense.enemies.length; },
    defenseArrangeEnemiesForQA: () => { if(!mini.defense)return 0; mini.defense.enemies.forEach((enemy,index)=>{enemy.progress=clamp(.11+index*.095,0,.9);const point=defensePointAt(enemy.progress);enemy.x=point.x;enemy.y=point.y;enemy.prevX=point.x;enemy.prevY=point.y;updateDefenseEnemyNode(enemy,true);}); return mini.defense.enemies.length; },
    defensePlaceNextForQA: petId => { const row=defenseDeployRegistry().get(petId)||defenseRoster()[0]; if(!row)return false; for(let y=.14;y<=.74;y+=.08)for(let x=.11;x<=.89;x+=.08){if(isValidDefensePlacement(x,y)){placeDefenseTower(row,x,y,defenseDeployCost(row));return mini.defense.towers.length;}} return mini.defense.towers.length; },
    defenseAbilityForQA: id => { const tower=mini.defense?.towers.find(item=>item.id===id)||mini.defense?.towers[0]; if(!tower)return false; tower.upgrade=Math.max(tower.upgrade,2); tower.abilityReadyAt=0; refreshDefenseTower(tower); activateDefenseAbility(tower.id); return {id:tower.id,variant:tower.pet.variant||tower.pet.hiddenVariant,readyAt:tower.abilityReadyAt}; },
    defenseUpgradeForQA: level => { const tower=mini.defense?.towers[0]; if(!tower)return false; tower.upgrade=clamp(Math.floor(Number(level)||0)-1,0,4); refreshDefenseTower(tower); const aura=tower.node?.querySelector(".defense-aura"); return {upgrade:tower.upgrade,tier:defenseTowerTier(tower),className:tower.node?.className||"",silhouette:tower.node?.style.getPropertyValue("--tower-silhouette")||"",auraDisplay:aura?getComputedStyle(aura).display:null,auraMask:aura?getComputedStyle(aura).webkitMaskImage||getComputedStyle(aura).maskImage:null}; },
    defenseTargetForQA: mode => { const tower=mini.defense?.towers[0]; if(!tower||!DEFENSE_TARGET_MODES.includes(mode))return false;tower.targetMode=mode;tower.targetId=null;tower.retargetAtReal=0;return tower.targetMode; },
    defenseDoctrineForQA: doctrine => { const tower=mini.defense?.towers[0];if(!tower)return false;tower.upgrade=Math.max(2,tower.upgrade);tower.doctrine=null;const accepted=chooseDefenseDoctrine(tower.id,doctrine);return {accepted,doctrine:tower.doctrine,stats:defenseCombatStats(tower),className:tower.node?.className||""}; },
    defensePauseForQA: paused => { toggleDefensePause(Boolean(paused));return mini.defense?.paused||false; },
    defenseInterruptionForQA: () => { const paused=pauseDefenseForInterruption();return {paused,autoPaused:Boolean(mini.defense?.autoPaused),clock:defenseNow()}; },
    defenseResumeSurfaceForQA: () => { const surfaced=surfaceDefenseInterruptionPause();return {surfaced,paused:Boolean(mini.defense?.paused),autoPaused:Boolean(mini.defense?.autoPaused)}; },
    defenseSpawnForQA: (type="puff",progress=.25,hp=null,maxHp=null) => { if(!mini.defense)return false;const options={progress:clamp(Number(progress)||0,0,.98)};if(Number.isFinite(Number(hp)))options.hpOverride=Number(hp);if(Number.isFinite(Number(maxHp)))options.maxHpOverride=Number(maxHp);const enemy=spawnDefenseEnemy(type,options);return {id:enemy.id,type:enemy.type,hp:enemy.hp,maxHp:enemy.maxHp}; },
    defensePopEnemyForQA: enemyId => {const enemy=mini.defense?.enemies.find(item=>item.id===enemyId);if(!enemy)return false;popDefenseEnemy(enemy,null);return true;},
    defenseShredEnemyForQA: (enemyId,amount=.05) => {const enemy=mini.defense?.enemies.find(item=>item.id===enemyId);if(!enemy)return false;return shredDefenseArmor(enemy,Number(amount)||.05,null);},
    defensePulseMenderForQA: enemyId => {const enemy=mini.defense?.enemies.find(item=>item.id===enemyId);if(!enemy)return false;enemy.supportCycle=-999;return pulseDefenseMender(enemy,defenseNow());},
    defenseNearestProgressForQA: () => { const tower=mini.defense?.towers[0];if(!tower)return null;let best={progress:0,distance:Infinity};for(let i=0;i<=200;i+=1){const progress=i/200,point=defensePointAt(progress),distance=Math.hypot(point.x-tower.x,point.y-tower.y);if(distance<best.distance)best={progress,distance};}return best; },
    defenseStrongTargetForQA: () => { const tower=mini.defense?.towers[0];if(!tower)return null;const stats=defenseCombatStats(tower),enemy=pickDefenseTarget(tower,stats);return enemy?{id:enemy.id,type:enemy.type,hp:enemy.hp,maxHp:enemy.maxHp,threat:defenseEnemyThreat(enemy)}:null; },
    defenseDamageCreditForQA: (raw=50,hp=3) => { const d=mini.defense,tower=d?.towers[0];if(!d||!tower)return false;const enemy=spawnDefenseEnemy("puff",{progress:.2,hpOverride:Number(hp)||3,maxHpOverride:Number(hp)||3}),before={damage:tower.damage,kills:tower.kills};const dealt=dealDefenseDamage(enemy,Number(raw)||50,tower,"classic");return {dealt,before,after:{damage:tower.damage,kills:tower.kills},enemyDead:enemy.dead}; },
    defenseDoctrineShotForQA: (doctrine,options={}) => { const d=mini.defense,tower=d?.towers[0];if(!d||!tower||!DEFENSE_DOCTRINES[doctrine])return false;tower.upgrade=options.apex?4:3;tower.doctrine=doctrine;tower.shots=defenseIsUniversalTower(tower)?(doctrine==="control"?(tower.upgrade>=4?3:4):(tower.upgrade>=4?2:3)):4;refreshDefenseTower(tower);const nearest=(()=>{let best={progress:0,distance:Infinity};for(let i=0;i<=200;i+=1){const progress=i/200,point=defensePointAt(progress),distance=Math.hypot(point.x-tower.x,point.y-tower.y);if(distance<best.distance)best={progress,distance};}return best;})(),enemy=spawnDefenseEnemy(options.type||"shell",{progress:nearest.progress,hpOverride:options.hp||100,maxHpOverride:options.maxHp||options.hp||100});if(options.restrained){enemy.slow=.45;enemy.slowUntil=defenseNow()+10;}if(options.opened){enemy.armorShredded=true;enemy.armor=Math.max(0,(enemy.baseArmor||0)-.08);}const neighbors=[];for(let i=0;i<Math.max(0,Math.min(4,Number(options.neighbors)||0));i+=1){const neighborType=Array.isArray(options.neighborTypes)&&options.neighborTypes[i]?options.neighborTypes[i]:(options.neighborType||"shell"),near=spawnDefenseEnemy(neighborType,{progress:clamp(nearest.progress-(i+1)*.012,0,.98),hpOverride:100,maxHpOverride:100});neighbors.push(near.id);}fireDefenseTower(tower,enemy,defenseCombatStats(tower));const shot=d.projectiles.at(-1);return {doctrine:tower.doctrine,targetId:enemy.id,neighborIds:neighbors,shotClass:shot?.node?.className||"",strike:shot?.doctrineStrike||null,doubleStitch:Boolean(shot?.doubleStitch),shots:tower.shots,masteryTier:shot?.masteryTier||0,towerClass:tower.node?.className||""}; },
    defenseCrownGuardsForQA: () => { const d=mini.defense;if(!d)return false;defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});const enemy=spawnDefenseEnemy({type:"boss",bossId:"crown",intensity:0},{progress:.4});const before=d.waveTotal;enemy.hp=enemy.maxHp*.49;handleDefenseBossMechanics(enemy);d.clock=Math.max(d.clock,enemy.telegraphUntil+.01);handleDefenseBossMechanics(enemy);return {before,after:d.waveTotal,guards:d.enemies.filter(item=>item.type==="shell").length}; },
    defenseDotCreditForQA: kind => { const d=mini.defense,tower=d?.towers[0];if(!d||!tower)return false;const enemy=spawnDefenseEnemy("puff",{progress:.2,hpOverride:2,maxHpOverride:2});updateDefenseEnemyNode(enemy);if(kind==="burn"){enemy.burn=4;enemy.burnUntil=defenseNow()+2;enemy.burnSource=tower;}else{enemy.poison=4;enemy.poisonUntil=defenseNow()+2;enemy.poisonSource=tower;}const before={damage:tower.damage,kills:tower.kills};updateDefenseEnemies(1);return {before,after:{damage:tower.damage,kills:tower.kills},enemyDead:enemy.dead}; },
    defenseForceWaveForQA: wave => { const d=mini.defense;if(!d)return false;d.currentWave=Math.max(0,(Number(wave)||1)-1);d.clearedWave=Math.min(d.clearedWave,d.currentWave);d.nextWaveReadyAtReal=0;d.autoStartAtReal=0;defenseSetPhase(d,DEFENSE_PHASES.PLANNING,{force:true});startDefenseWave();return{currentWave:d.currentWave,clearedWave:d.clearedWave,total:d.waveTotal,announcement:d.waveAnnouncement}; },
    defenseSetCashForQA: cash => { if(mini.defense)mini.defense.cash=Math.max(0,Number(cash)||0); updateDefenseHud(); return mini.defense?.cash||0; },
    defenseToggleIntelForQA: force => {toggleDefenseIntel(typeof force==="boolean"?force:undefined);return{open:Boolean(mini.defense?.intelOpen),paused:Boolean(mini.defense?.paused),trayHidden:$("#defenseIntelTray")?.hidden??true};},
    defenseIntelForQA: () => {const counts=defenseIntelCounts(),readiness=defenseCounterReadiness(counts);return{open:Boolean(mini.defense?.intelOpen),types:Object.fromEntries(counts),missing:[...readiness.missing],text:$("#defenseIntelTray")?.textContent||"",renderCount:mini.defense?.intelRenderCount||0};},
    defenseEnemyStateForQA: id => {const enemy=id?mini.defense?.enemies.find(item=>item.id===id):mini.defense?.enemies.at(-1);return enemy?{id:enemy.id,type:enemy.type,bossId:enemy.bossId||null,hp:enemy.hp,maxHp:enemy.maxHp,reward:enemy.reward,armor:enemy.armor,baseArmor:enemy.baseArmor,armorBroken:Boolean(enemy.armorBroken),armorShredded:Boolean(enemy.armorShredded),camoActive:defenseEnemyCamoActive(enemy),phaseActive:Boolean(enemy.phaseActive),phaseSuppressedUntil:enemy.phaseSuppressedUntil,revealUntil:enemy.revealUntil,visualSignature:enemy.visualSignature||"",className:enemy.node?.className||"",transform:enemy.node?getComputedStyle(enemy.node).transform:"",size:enemy.node?{width:enemy.node.getBoundingClientRect().width,height:enemy.node.getBoundingClientRect().height}:null}:null;},
    defenseSetEnemyStatusForQA: (id,status={}) => {const enemy=mini.defense?.enemies.find(item=>item.id===id);if(!enemy)return false;const time=defenseNow();if(status.reset){enemy.burnUntil=0;enemy.poisonUntil=0;enemy.slowUntil=0;enemy.rootUntil=0;enemy.armorBroken=false;enemy.armorShredded=false;enemy.armor=enemy.baseArmor;enemy.revealUntil=0;enemy.phaseSuppressedUntil=0;}if(status.burn)enemy.burnUntil=time+Number(status.burn);if(status.poison)enemy.poisonUntil=time+Number(status.poison);if(status.slow)enemy.slowUntil=time+Number(status.slow);if(status.root)enemy.rootUntil=time+Number(status.root);if(status.armorBroken){enemy.armorBroken=true;enemy.armor=0;}if(status.armorShredded)enemy.armorShredded=true;if(status.reveal)enemy.revealUntil=time+Number(status.reveal);updateDefenseEnemyNode(enemy,true);return qa.defenseEnemyStateForQA(id);},
    defenseWarmPoolsForQA: () => {warmDefensePools();return qa.defenseSnapshotForQA().poolStats;},
    defenseRenderTierForQA: () => ({tier:defenseRenderTier(),applied:defenseApplyRenderTier(mini.defense),densityCap:defenseDensityCap(mini.defense,mini.defense?.spawnQueue?.[0])}),
    defenseLoadQueueForQA: (count=60,type="shell",wave=30,speed=2) => {const d=mini.defense;if(!d)return false;d.currentWave=Math.max(1,Math.floor(Number(wave)||30));d.clearedWave=Math.min(d.clearedWave,d.currentWave-1);d.speed=[.5,1,2].includes(Number(speed))?Number(speed):2;defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});const total=Math.min(DEFENSE_LIMITS.MAX_QUEUE_ENTRIES,Math.max(1,Math.floor(Number(count)||60)));d.wavePackets=[{enemies:Array.from({length:total},()=>String(type||"shell")),spawnGap:.5,breakAfter:0}];d.packetIndex=0;d.packetEnemyIndex=0;d.spawnQueue=DefenseCore.flattenPackets(d.wavePackets);d.currentWavePlan=[...d.spawnQueue];d.childSpawnQueue=[];d.nextChildReleaseAtReal=defenseRealNow(d);d.childSpawnSequence=0;d.targetSnapshot=[];d.targetSnapshotAtReal=0;d.waveTotal=d.spawnQueue.length;d.waveResolved=0;d.nextSpawnAt=d.clock;d.lastSpawnedEnemyId=null;d.peakAlive=d.enemies.length;return{count:d.spawnQueue.length,currentWave:d.currentWave,clearedWave:d.clearedWave,speed:d.speed,cap:defenseDensityCap(d,d.spawnQueue[0])};},
    defenseClearQueueForQA: () => {const d=mini.defense;if(!d)return false;d.spawnQueue=[];d.wavePackets=[];d.packetIndex=0;d.packetEnemyIndex=0;d.childSpawnQueue=[];d.currentWavePlan=[];d.lastSpawnedEnemyId=null;d.nextSpawnAt=Number.POSITIVE_INFINITY;return true;},
    defenseDamageEnemyForQA: (id,raw=10,variant=null,doctrine=null) => {const d=mini.defense,enemy=id?d?.enemies.find(item=>item.id===id):d?.enemies.at(-1),tower=d?.towers[0];if(!enemy||!tower)return false;const priorVariant=tower.pet.variant,priorHidden=tower.pet.hiddenVariant,priorDoctrine=tower.doctrine;if(variant)tower.pet.variant=variant;if(doctrine)tower.doctrine=doctrine;const dealt=dealDefenseDamage(enemy,Number(raw)||10,tower,variant||"classic");tower.pet.variant=priorVariant;tower.pet.hiddenVariant=priorHidden;tower.doctrine=priorDoctrine;return{dealt,state:{hp:enemy.hp,armor:enemy.armor,armorBroken:Boolean(enemy.armorBroken),className:enemy.node?.className||""}};},
    defenseApplyCounterForQA: (id,kind) => {const d=mini.defense,enemy=id?d?.enemies.find(item=>item.id===id):d?.enemies.at(-1),tower=d?.towers[0];if(!enemy||!tower)return false;if(kind==="power")shredDefenseArmor(enemy,.08,tower);else revealDefenseEnemy(enemy,4,tower);return{armor:enemy.armor,camoActive:defenseEnemyCamoActive(enemy),phaseSuppressedUntil:enemy.phaseSuppressedUntil,className:enemy.node?.className||""};},
    defenseForceWeatherForQA: weather => {const d=mini.defense;if(!d)return false;d.map={...d.map,weather:String(weather||d.map.weather)};defenseSetPhase(d,DEFENSE_PHASES.COMBAT,{force:true});d.nextWeatherAt=d.clock;updateDefenseWeather();d.enemies.forEach(updateDefenseEnemyNode);return{weather:d.map.weather,ashUntil:d.ashUntil,moonRevealUntil:d.moonRevealUntil,eclipseUntil:d.eclipseUntil,clock:d.clock};},
    defenseLeakForQA: (type="puff",damage=1) => {const d=mini.defense;if(!d)return false;const enemy=spawnDefenseEnemy(type,{progress:.999});enemy.damage=Math.max(1,Number(damage)||1);const before=d.lives;updateDefenseEnemies(1);return{before,after:d.lives,stats:JSON.parse(JSON.stringify(d.enemyStats))};},
    defenseAnalyticsForQA: () => mini.defense?JSON.parse(JSON.stringify(mini.defense.enemyStats)):null,
    defenseFinishForQA: () => {if(!mini.active)return false;finishDefenseRun();return Boolean(document.querySelector(".defense-run-recap"));},
    defenseSyncGeometryForQA: () => {const before=mini.defense?.towers.map(t=>({id:t.id,width:t.node?.style.getPropertyValue("--tower-range-width")||"",height:t.node?.style.getPropertyValue("--tower-range-height")||""}))||[];syncDefenseTowerGeometry();const after=mini.defense?.towers.map(t=>({id:t.id,width:t.node?.style.getPropertyValue("--tower-range-width")||"",height:t.node?.style.getPropertyValue("--tower-range-height")||""}))||[];return{before,after};},
    defenseCinematicForQA: () => {const d=mini.defense,host=$("#defenseMoment"),shell=$(".defense-shell"),stage=$(".defense-stage-frame");return d?{kind:d.cinematicMomentKind||null,count:d.cinematicMomentCount||0,priority:d.cinematicMomentPriority||0,untilReal:d.cinematicMomentUntilReal||0,hidden:host?.hidden??true,className:host?.className||"",text:(host?.textContent||"").replace(/\s+/g," ").trim(),shellMoment:shell?.dataset.cinematicMoment||null,stagePulse:Boolean(stage?.classList.contains("moment-pulse")),ending:Boolean(d.ending),endingReason:d.endingReason||null,reducedMotion:defenseReducedMotion()}:null;},
    defenseMomentForQA: (kind="clear",options={}) => showDefenseCinematicMoment(String(kind||"clear"),options||{}),
    defenseEndRunForQA: (reason="banked") => finishDefenseRunWithMoment(reason==="gate"?"gate":"banked"),
    defenseArtCohesionForQA: () => {const world=$("#defenseWorld"),style=world?getComputedStyle(world):null;return world?{mapId:mini.defense?.mapId||null,featureCount:world.querySelectorAll(".defense-world-feature").length,featureKinds:[...world.querySelectorAll(".defense-world-feature")].map(node=>node.dataset.worldFeature),buildPocketCount:world.querySelectorAll(".defense-build-pocket").length,unitScale:world.style.getPropertyValue("--def-unit-scale"),playOutline:style?.getPropertyValue("--play-outline").trim()||"",playHalo:style?.getPropertyValue("--play-halo").trim()||"",roadFill:style?.getPropertyValue("--road-fill").trim()||"",visibleLandmarkLabels:[...world.querySelectorAll(".defense-landmark span,.defense-entrance span,.defense-gate b")].filter(node=>getComputedStyle(node).display!=="none").length}:null;},
    defenseSnapshotForQA: () => mini.defense?{map:mini.defense.mapId,currentWave:mini.defense.currentWave,clearedWave:mini.defense.clearedWave,reachedWave:mini.defense.currentWave,contract:mini.defense.contract?{...mini.defense.contract}:null,maxTowers:mini.defense.maxTowers,wave:mini.defense.wave,lives:mini.defense.lives,cash:mini.defense.cash,worldPerkUsed:Boolean(mini.defense.worldPerkUsed),phase:mini.defense.phase,paused:Boolean(mini.defense.paused),autoPaused:Boolean(mini.defense.autoPaused),waveTotal:mini.defense.waveTotal,waveResolved:mini.defense.waveResolved,lowFx:Boolean(mini.defense.lowFx),performanceLow:Boolean(mini.defense.performanceLow),frameMs:Number(mini.defense.frameMs||0),frameP95:Number(mini.defense.frameP95||0),frameP99:Number(mini.defense.frameP99||0),frameStress:Number(mini.defense.frameStress||0),governorTier:mini.defense.governorTier||0,simStepP95:Number(mini.defense.simStepP95||0),simStepWorst:Number(mini.defense.simStepWorst||0),simBacklogEvents:mini.defense.simBacklogEvents||0,maxCatchUpObserved:mini.defense.maxCatchUpObserved||0,lastSimSteps:mini.defense.lastSimSteps||0,simAccumulator:Number(mini.defense.simAccumulator||0),presentationFrames:mini.defense.presentationFrames||0,rendererMode:mini.defense.rendererMode||"dom",canvasFrames:mini.defense.canvasFrames||0,canvasFallbacks:mini.defense.canvasFallbacks||0,canvasRenderer:mini.defense.canvasRenderer?.snapshot?.()||null,renderTier:mini.defense.renderTier||0,potatoFx:Boolean(mini.defense.potatoFx),renderTierChanges:mini.defense.renderTierChanges||0,densityCap:defenseDensityCap(mini.defense,mini.defense.spawnQueue[0]),poolStats:{enemy:mini.defense.enemyNodePool.length,projectile:mini.defense.projectileNodePool.length,impact:mini.defense.impactNodePool.length,enemyCreated:mini.defense.enemyNodesCreated||0,enemyAcquired:mini.defense.enemyNodesAcquired||0,projectileCreated:mini.defense.projectileNodesCreated||0,projectileAcquired:mini.defense.projectileNodesAcquired||0,impactCreated:mini.defense.impactNodesCreated||0,impactAcquired:mini.defense.impactNodesAcquired||0},visualWrites:{enemyPosition:mini.defense.enemyPositionWrites||0,enemyClass:mini.defense.enemyClassWrites||0,enemyHealth:mini.defense.enemyHealthWrites||0,enemyState:mini.defense.enemyStateWrites||0,projectilePosition:mini.defense.projectilePositionWrites||0},peakAlive:mini.defense.peakAlive||0,spawnWaitReason:mini.defense.spawnWaitReason||"",lastSpawnedEnemyId:mini.defense.lastSpawnedEnemyId||null,ashUntil:mini.defense.ashUntil,moonRevealUntil:mini.defense.moonRevealUntil,intelOpen:Boolean(mini.defense.intelOpen),enemyStats:JSON.parse(JSON.stringify(mini.defense.enemyStats||{})),hudRenderCount:mini.defense.hudRenderCount||0,rosterRenderCount:mini.defense.rosterRenderCount||0,trayRenderCount:mini.defense.trayRenderCount||0,intelRenderCount:mini.defense.intelRenderCount||0,checkpointWrites:mini.defense.checkpointWrites||0,pendingIncome:mini.defense.pendingIncome||0,pendingIncomeEvents:mini.defense.pendingIncomeEvents||0,lastIncomeBatch:mini.defense.lastIncomeBatch?JSON.parse(JSON.stringify(mini.defense.lastIncomeBatch)):null,cashWriteCount:mini.defense.cashWriteCount||0,targetScans:mini.defense.targetScans||0,targetSnapshotBuilds:mini.defense.targetSnapshotBuilds||0,realClock:defenseRealNow(mini.defense),simulationClock:mini.defense.clock||0,visualBudget:defenseVisualBudget(mini.defense),childSpawnsReleased:mini.defense.childSpawnsReleased||0,nextChildReleaseAtReal:mini.defense.nextChildReleaseAtReal||0,maxActiveEnemiesObserved:mini.defense.maxActiveEnemiesObserved||0,maxProjectileNodesObserved:mini.defense.maxProjectileNodesObserved||0,maxLogicalProjectilesObserved:mini.defense.maxLogicalProjectilesObserved||0,visibleProjectileCount:defenseVisibleProjectileCount(mini.defense),coalescedVisualShots:mini.defense.coalescedVisualShots||0,coalescedLogicalShots:mini.defense.coalescedLogicalShots||0,droppedCosmetics:mini.defense.droppedCosmetics||0,maxEffectNodesObserved:mini.defense.maxEffectNodesObserved||0,childSpawnQueue:mini.defense.childSpawnQueue.length,packetIndex:mini.defense.packetIndex,packetCount:mini.defense.wavePackets.length,lastInputCancelReason:mini.defense.lastInputCancelReason||null,frameDiscontinuities:mini.defense.frameDiscontinuities||0,cinematicMomentKind:mini.defense.cinematicMomentKind||null,cinematicMomentCount:mini.defense.cinematicMomentCount||0,gateFlame:{armed:Boolean(mini.defense.gateFlameArmed),readyAt:mini.defense.gateFlameReadyAt||0,until:mini.defense.gateFlameUntil||0,progress:mini.defense.gateFlameProgress||0,ticks:mini.defense.gateFlameTicks||0},ending:Boolean(mini.defense.ending),endingReason:mini.defense.endingReason||null,projectiles:mini.defense.projectiles.map(shot=>({id:shot.id,towerId:shot.tower?.id||null,targetId:shot.target?.id||null,x:shot.x,y:shot.y,life:shot.life,speed:shot.speed,damage:shot.damage,kind:shot.kind,doctrineStrike:shot.doctrineStrike||null,doubleStitch:Boolean(shot.doubleStitch)})),towers:mini.defense.towers.map(t=>({id:t.id,petId:t.petId,variant:t.pet.variant||t.pet.hiddenVariant,copy:t.copyNumber,x:t.x,y:t.y,upgrade:t.upgrade,cost:t.cost,spent:t.spent,openingPerkApplied:Boolean(t.openingPerkApplied),placedAtReal:t.placedAtReal,kills:t.kills,damage:t.damage,shots:t.shots,targetMode:t.targetMode,doctrine:t.doctrine,superForm:t.superForm||null,structureType:defenseStructureType(t),totalProduced:t.totalProduced||0,beaconBuffed:Boolean(t.beaconSourceId),readyAt:t.abilityReadyAt,nextUpgradeCost:defenseUpgradeCost(t,mini.defense),sellRefund:defenseSellRefund(t,mini.defense),canUndo:defenseCanUndoPlacement(t,mini.defense),mapBond:defenseMapBondForTower(t,mini.defense)?.label||null})),enemies:mini.defense.enemies.map(e=>({id:e.id,type:e.type,bossId:e.bossId||null,camo:Boolean(e.camo),camoActive:defenseEnemyCamoActive(e),hp:e.hp,maxHp:e.maxHp,armor:e.armor,baseArmor:e.baseArmor,armorBroken:Boolean(e.armorBroken),armorShredded:Boolean(e.armorShredded),progress:e.progress,phaseActive:Boolean(e.phaseActive),phaseSuppressedUntil:e.phaseSuppressedUntil,revealUntil:e.revealUntil,slow:e.slow,burn:e.burn,poison:e.poison,rootUntil:e.rootUntil,signalStaggerUntil:e.signalStaggerUntil||0,bossPhase:e.bossPhase||0,telegraphKind:e.telegraphKind||null,telegraphDisruption:e.telegraphDisruption||0,apexSurgeUntil:e.apexSurgeUntil||0,className:e.node?.className||""}))}:null
    };
    for (const [name, hook] of Object.entries(qa)) {
      if (!/defense/i.test(name) || name === "defenseMigrateForQA") continue;
      qa[name] = (...args) => { qaAttach(); return hook(...args); };
    }
    return qa;
  }
})();
