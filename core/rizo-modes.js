/*
  RIZO GAME-MODE CONTRACT
  =======================
  A game mode (Rizo Defense today; Dungeon and Scroll Fighter later) is a deep,
  persistent game the player enters from the hub with their Rizo. It owns its
  own folder, its own rules, and its own slice of the save. It never touches
  the hub's save, wallet or pets directly: everything goes through the host API
  this module builds.

    RizoModes.register(definition)     at load, from modes/<id>/<id>-mode.js
    RizoModes.launch(id, options)      the hub opens a mode
    definition.create(host)            → instance { start, stop, suspend?, resume?, key?, resize?, quit? }
    host.exit(summary)                 the mode returns the player to the hub
                                       (summary.destination "home" also opens the Den)
    host.commit({ data, reward? })     confirmed save of the slice, with an optional
                                       allowlisted reward under a receipt (see below)
    host.event(kind, detail)           a semantic boundary (checkpointRest, …); dormant

  A definition may declare carePolicy "foreground-hold": while the mode is
  visible the hub pauses ordinary needs decay and passive growth for the pet
  (time spent hidden still counts as normal time away).

  The pure parts (definition checks, slice migration, award validation) run in
  Node tests. The hub supplies an adapter (attachHub) that performs the actual
  reads and writes under its own rules.
*/
(function initRizoModes(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoModes", { value: Object.freeze(api), configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoModes(root) {
  "use strict";

  const CONTRACT_VERSION = 1;
  const MODE_ID = /^[a-z][a-z0-9-]{1,31}$/;
  const SKILLS = Object.freeze(["speed", "power", "instinct", "stamina", "luck"]);
  const MAX_SLICE_BYTES = 400_000;
  const CARE_POLICIES = Object.freeze(["normal", "foreground-hold"]);
  const DESTINATIONS = Object.freeze(["home"]);
  // Semantic boundaries a mode may report. The hub owns "returnedToHub".
  const EVENT_KINDS = Object.freeze(["checkpointRest", "chapterComplete", "sceneCommitted", "encounterResolved", "sessionEnded"]);
  const EVENT_TONES = Object.freeze(["quiet", "protected"]);
  const EVENT_INTERRUPTIONS = Object.freeze(["none", "candidate"]);
  const COMMIT_STATUSES = Object.freeze(["committed", "blocked", "failed"]);
  const RECEIPT_ID = /^[a-z0-9][a-z0-9:._-]{0,119}$/;
  const ENTITLEMENT_ID = /^[a-z][a-z0-9-]{1,31}$/;
  const BOUNDARY_ID = /^[a-z0-9][a-z0-9:._-]{0,79}$/;
  const MAX_REWARD_ENTITLEMENTS = 4;
  // The most a single award() call can grant. Modes award once per run, so
  // these are generous ceilings that only stop runaway or corrupted values.
  const AWARD_LIMITS = Object.freeze({
    embers: 50_000,
    heat: 200,
    petXp: 2_000,
    petSkill: 25,
    petBond: 10,
    activeEnergy: [-40, 40],
    activeHunger: [-25, 25],
    activeMood: [-25, 25],
    pets: 16
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : 0));
  const round2 = value => Math.round(value * 100) / 100;
  const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }
  const isPlainObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

  function defineMode(def) {
    if (!isPlainObject(def)) throw new TypeError("game mode definition must be an object");
    const id = String(def.id || "");
    if (!MODE_ID.test(id)) throw new TypeError(`game mode id "${id}" must be a lowercase word`);
    const fail = message => { throw new TypeError(`game mode "${id}": ${message}`); };
    const schema = Number(def.schema);
    if (!Number.isInteger(schema) || schema < 1) fail("schema must be a positive integer (the slice format version)");
    if (typeof def.create !== "function") fail("create(host) is required");
    if (typeof def.migrate !== "function") fail("migrate(data, fromSchema, legacy) is required");
    if (def.summary !== undefined && typeof def.summary !== "function") fail("summary(data) must be a function");
    const settings = (Array.isArray(def.settings) ? def.settings : []).map(setting => {
      const key = String(setting?.key || "");
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(key)) fail(`setting key "${key}" must be a short identifier`);
      const kind = setting.kind === "choice" ? "choice" : "toggle";
      const choices = kind === "choice" ? (setting.choices || []).map(([value, label]) => [String(value), String(label)]) : [];
      if (kind === "choice" && !choices.some(([value]) => value === String(setting.default))) fail(`setting "${key}" default must be one of its choices`);
      return Object.freeze({ key, kind, title: String(setting.title || key), copy: String(setting.copy || ""), choices: Object.freeze(choices), default: kind === "toggle" ? Boolean(setting.default) : String(setting.default) });
    });
    const entry = def.entry && typeof def.entry === "object" ? def.entry : {};
    const carePolicy = def.carePolicy === undefined ? "normal" : String(def.carePolicy);
    if (!CARE_POLICIES.includes(carePolicy)) fail(`carePolicy must be one of ${CARE_POLICIES.join(", ")}`);
    return Object.freeze({
      ...def, id, schema, contract: CONTRACT_VERSION, name: String(def.name || id.toUpperCase()),
      settings: Object.freeze(settings), carePolicy,
      // What the hub checks before opening the mode from the shelf.
      entry: Object.freeze({ energy: Math.max(0, Math.floor(Number(entry.energy) || 0)) })
    });
  }

  // Player settings declared by a mode live in its slice under data.settings.
  // The hub renders them in the Journal; these helpers keep both sides honest.
  function readSettings(def, data) {
    const stored = isPlainObject(data?.settings) ? data.settings : {};
    const output = {};
    for (const setting of def.settings || []) {
      const value = stored[setting.key];
      output[setting.key] = setting.kind === "toggle" ? (typeof value === "boolean" ? value : setting.default)
        : setting.choices.some(([choice]) => choice === value) ? value : setting.default;
    }
    return output;
  }
  function writeSetting(def, data, key, value) {
    const setting = (def.settings || []).find(item => item.key === key);
    if (!setting) return null;
    const next = setting.kind === "toggle" ? Boolean(value) : String(value);
    if (setting.kind === "choice" && !setting.choices.some(([choice]) => choice === next)) return null;
    const base = isPlainObject(data) ? plain(data) : {};
    base.settings = { ...(isPlainObject(base.settings) ? base.settings : {}), [key]: next };
    return base;
  }

  // Brings a stored slice up to the definition's schema. `legacy` is a
  // read-only view of any pre-contract hub fields the mode used to own; it is
  // only meaningful for the first migration (fromSchema 0).
  function migrateSlice(def, stored, legacy = null) {
    const fromSchema = isPlainObject(stored) ? Math.max(0, Math.floor(Number(stored.schema) || 0)) : 0;
    const fromData = isPlainObject(stored) && isPlainObject(stored.data) ? plain(stored.data) : null;
    if (fromSchema > def.schema) return { schema: fromSchema, data: fromData || {}, newer: true };
    if (fromSchema === def.schema && fromData) return { schema: def.schema, data: fromData, migrated: false };
    const data = def.migrate(fromData, fromSchema, legacy ? deepFreeze(plain(legacy)) : null);
    if (!isPlainObject(data)) throw new TypeError(`game mode "${def.id}": migrate() must return a plain object`);
    return { schema: def.schema, data: plain(data), migrated: true };
  }

  function checkSliceData(id, data) {
    if (!isPlainObject(data)) throw new TypeError(`game mode "${id}": slice data must be a plain object`);
    const bytes = JSON.stringify(data).length;
    if (bytes > MAX_SLICE_BYTES) throw new RangeError(`game mode "${id}": slice is ${bytes} bytes (limit ${MAX_SLICE_BYTES})`);
    return plain(data);
  }

  // Validates and clamps an award. Unknown fields are dropped; nothing here
  // can create negative currency or unbounded growth.
  function normalizeAward(raw) {
    const award = isPlainObject(raw) ? raw : {};
    const pets = {};
    let count = 0;
    for (const [petId, gains] of Object.entries(isPlainObject(award.pets) ? award.pets : {})) {
      if (count >= AWARD_LIMITS.pets || typeof petId !== "string" || !petId || petId.length > 80 || !isPlainObject(gains)) continue;
      const skills = {};
      for (const skill of SKILLS) {
        const amount = round2(clamp(gains.skills?.[skill], 0, AWARD_LIMITS.petSkill));
        if (amount > 0) skills[skill] = amount;
      }
      pets[petId] = { xp: round2(clamp(gains.xp, 0, AWARD_LIMITS.petXp)), bond: round2(clamp(gains.bond, 0, AWARD_LIMITS.petBond)), skills, played: Boolean(gains.played) };
      count += 1;
    }
    const active = isPlainObject(award.active) ? award.active : {};
    return deepFreeze({
      reason: String(award.reason || "run").slice(0, 40),
      embers: Math.floor(clamp(award.embers, 0, AWARD_LIMITS.embers)),
      heat: Math.floor(clamp(award.heat, 0, AWARD_LIMITS.heat)),
      // A completed run counts toward the daily "play" quest and lifetime games.
      run: Boolean(award.run),
      pets,
      active: {
        energy: round2(clamp(active.energy, ...AWARD_LIMITS.activeEnergy)),
        hunger: round2(clamp(active.hunger, ...AWARD_LIMITS.activeHunger)),
        mood: round2(clamp(active.mood, ...AWARD_LIMITS.activeMood))
      }
    });
  }

  // A reward asks the hub for allowlisted entitlements under a receipt that can
  // only ever pay once. Shape is checked here; the hub decides what is known
  // and owned. Entitlements are sorted so a repeat compares equal.
  function normalizeReward(raw) {
    if (raw === undefined || raw === null) return null;
    if (!isPlainObject(raw)) throw new TypeError("reward must be an object");
    const receiptId = typeof raw.receiptId === "string" ? raw.receiptId : "";
    if (!RECEIPT_ID.test(receiptId)) throw new TypeError("reward.receiptId must be a short lowercase id");
    const petId = typeof raw.petId === "string" ? raw.petId : "";
    if (!petId || petId.length > 80) throw new TypeError("reward.petId must name one pet");
    if (!Array.isArray(raw.entitlements) || !raw.entitlements.length || raw.entitlements.length > MAX_REWARD_ENTITLEMENTS) throw new TypeError(`reward.entitlements must list 1-${MAX_REWARD_ENTITLEMENTS} ids`);
    const entitlements = [...new Set(raw.entitlements.map(value => (typeof value === "string" ? value : "")))].sort();
    if (entitlements.some(value => !ENTITLEMENT_ID.test(value))) throw new TypeError("reward.entitlements must be short lowercase ids");
    return deepFreeze({ receiptId, petId, entitlements });
  }

  // What host.commit() reports. Anything the hub did not clearly confirm is a failure.
  function commitOutcome(raw) {
    const outcome = isPlainObject(raw) ? raw : {};
    const status = COMMIT_STATUSES.includes(outcome.status) ? outcome.status : "failed";
    const committed = status === "committed";
    return deepFreeze({
      status,
      rewardApplied: committed && outcome.rewardApplied === true,
      duplicateReward: committed && outcome.duplicateReward === true,
      backupSynced: committed && outcome.backupSynced === true,
      reason: String(outcome.reason || (committed ? "" : status)).slice(0, 40)
    });
  }

  function normalizeEvent(kind, raw) {
    const name = String(kind || "");
    if (!EVENT_KINDS.includes(name)) throw new TypeError(`unknown mode event "${name}"`);
    const detail = isPlainObject(raw) ? raw : {};
    const boundaryId = String(detail.boundaryId || "");
    const campaignId = String(detail.campaignId || "");
    if (!BOUNDARY_ID.test(boundaryId)) throw new TypeError("event boundaryId must be a short lowercase id");
    if (campaignId && !BOUNDARY_ID.test(campaignId)) throw new TypeError("event campaignId must be a short lowercase id");
    return deepFreeze({
      kind: name, boundaryId, campaignId,
      tone: EVENT_TONES.includes(detail.tone) ? detail.tone : "protected",
      interruption: EVENT_INTERRUPTIONS.includes(detail.interruption) ? detail.interruption : "none"
    });
  }

  // ===== REGISTRY AND HOST (browser) =====
  const registry = new Map();
  let hub = null;
  let active = null;

  function register(def) {
    const mode = defineMode(def);
    if (registry.has(mode.id)) throw new Error(`game mode "${mode.id}" is already registered`);
    registry.set(mode.id, mode);
    return mode;
  }

  // The hub calls this once at boot. Adapter methods (all required):
  //   readSlice(id) / writeSlice(id, {schema,data}) / legacyView(id)
  //   petSnapshot() / rosterSnapshots() / petMarkup(snapshot, opts)
  //   applyAward(id, award) → applied   settings() / audio / ui
  //   runStore(id) → {read, write, clear}   mount(id, options) → stage   unmount(id)
  //   keeperId()   report(id, kind, details)   save()   onExit(id, summary, { destination })
  // Optional (newer hubs; a mode that needs one fails clearly without it):
  //   commitSlice(id, { schema, data, reward }) → { status, rewardApplied, duplicateReward, backupSynced }
  //   modeEvent(id, event)   sessionStart(id, { carePolicy })   sessionEnd(id, { carePolicy })
  function attachHub(adapter) {
    const required = ["readSlice", "writeSlice", "legacyView", "petSnapshot", "rosterSnapshots", "petMarkup", "applyAward", "settings", "runStore", "mount", "unmount", "keeperId", "report", "save", "onExit"];
    for (const name of required) if (typeof adapter?.[name] !== "function") throw new TypeError(`hub adapter is missing ${name}()`);
    hub = adapter;
  }

  // Makes sure the mode's slice exists at its current schema. Safe to call at
  // boot for every registered mode, so migrations run once, not on first play.
  function ensureSlice(id) {
    const def = registry.get(id);
    if (!def || !hub) return null;
    const stored = hub.readSlice(id);
    const result = migrateSlice(def, stored, stored ? null : hub.legacyView(id));
    if (result.migrated) { hub.writeSlice(id, { schema: result.schema, data: result.data }); hub.save(); }
    return result;
  }

  function createHost(def, instanceRef) {
    const id = def.id;
    let exited = false;
    // Late callbacks (after exit, or from a superseded instance) are refused.
    const current = () => !exited && active?.host === host;
    const host = {
      id,
      contract: CONTRACT_VERSION,
      pet: () => deepFreeze(plain(hub.petSnapshot())),
      roster: () => deepFreeze(plain(hub.rosterSnapshots())),
      petMarkup: (snapshot, options = {}) => hub.petMarkup(snapshot, options),
      settings: () => deepFreeze(plain(hub.settings())),
      // The mode's own player settings (declared in def.settings), read from its slice.
      modeSettings: () => Object.freeze(readSettings(def, hub.readSlice(id)?.data)),
      keeperId: () => String(hub.keeperId() || ""),
      debug: Boolean(hub.debug),
      build: String(hub.build || ""),
      report: (kind, details = {}) => hub.report(id, String(kind || "note").slice(0, 60), plain(details)),
      audio: hub.audio || {},
      ui: hub.ui || {},
      slice: {
        read: () => {
          const stored = hub.readSlice(id);
          return stored && isPlainObject(stored.data) ? plain(stored.data) : {};
        },
        write: data => { hub.writeSlice(id, { schema: def.schema, data: checkSliceData(id, data) }); hub.save(); return true; }
      },
      run: hub.runStore(id),
      award: raw => hub.applyAward(id, normalizeAward(raw)),
      // A confirmed, synchronous save of the slice (and an optional reward) in
      // one hub envelope. Never infer durability from slice.write().
      commit: (request = {}) => {
        if (!isPlainObject(request)) throw new TypeError(`game mode "${id}": commit() takes { data, reward? }`);
        const data = checkSliceData(id, request.data);
        const reward = normalizeReward(request.reward);
        if (!current()) return commitOutcome({ status: "failed", reason: "inactive" });
        if (typeof hub.commitSlice !== "function") throw new Error(`game mode "${id}": this hub cannot confirm saves (commitSlice missing)`);
        return commitOutcome(hub.commitSlice(id, { schema: def.schema, data, reward }));
      },
      event: (kind, detail = {}) => {
        const event = normalizeEvent(kind, detail);
        if (!current()) return false;
        try { hub.modeEvent?.(id, event); } catch (error) { return false; }
        return true;
      },
      // The shared full-screen stage: { root, arena, panel, header(fields), close() }.
      // The mode may add classes to root and fill arena; the hub resets both on exit.
      mount: (options = {}) => hub.mount(id, options),
      exit: (summary = {}) => {
        if (exited) return false;
        exited = true;
        const safeSummary = summary && typeof summary === "object" ? summary : {};
        const destination = DESTINATIONS.includes(safeSummary.destination) ? safeSummary.destination : null;
        try { instanceRef.current?.stop?.(); } finally {
          if (active?.id === id) active = null;
          hub.unmount(id);
          try { hub.sessionEnd?.(id, { carePolicy: def.carePolicy }); } finally {
            hub.onExit(id, safeSummary, { destination });
          }
        }
        return true;
      }
    };
    return Object.freeze(host);
  }

  function launch(id, options = {}) {
    if (!hub) throw new Error("RizoModes.launch called before the hub attached");
    const def = registry.get(id);
    if (!def) throw new Error(`unknown game mode "${id}"`);
    if (active) return false;
    const slice = ensureSlice(id);
    if (slice?.newer) throw new Error(`game mode "${id}" save is from a newer build`);
    const ref = { current: null };
    const host = createHost(def, ref);
    active = { id, host };
    let sessionOpen = false;
    try {
      hub.sessionStart?.(id, { carePolicy: def.carePolicy });
      sessionOpen = true;
      ref.current = def.create(host);
      active.instance = ref.current;
      ref.current?.start?.(options);
    } catch (error) {
      active = null;
      if (sessionOpen) { try { hub.sessionEnd?.(id, { carePolicy: def.carePolicy }); } catch (endError) {} }
      hub.unmount(id);
      throw error;
    }
    return true;
  }

  return {
    CONTRACT_VERSION,
    AWARD_LIMITS,
    MAX_SLICE_BYTES,
    CARE_POLICIES,
    EVENT_KINDS,
    defineMode,
    migrateSlice,
    normalizeAward,
    normalizeReward,
    normalizeEvent,
    commitOutcome,
    register,
    attachHub,
    ensureSlice,
    launch,
    get: id => registry.get(id) || null,
    list: () => [...registry.values()],
    active: () => (active ? active.id : null),
    readSettings,
    writeSetting,
    // Hub → active mode notifications. Each is optional on the instance.
    // suspend("force-update") may return a host.commit() outcome; the hub
    // keeps the current build when it is "blocked" or "failed".
    suspendActive: reason => active?.instance?.suspend?.(reason),
    resumeActive: reason => active?.instance?.resume?.(reason),
    keyActive: event => Boolean(active?.instance?.key?.(event)),
    resizeActive: reason => active?.instance?.resize?.(reason),
    // Asks the active mode to wrap up and exit (an update is waiting, the save
    // was blocked). Modes bank what they must and call host.exit().
    quitActive: reason => active?.instance?.quit?.(reason),
    // Small public facts a mode publishes about its own slice (best run,
    // milestones) for hub surfaces such as the shelf card and keeper path.
    summary: id => {
      const def = registry.get(id);
      if (!def?.summary || !hub) return null;
      try { const stored = hub.readSlice(id); return deepFreeze(plain(def.summary(stored && isPlainObject(stored.data) ? plain(stored.data) : {}) || null)); }
      catch (error) { return null; }
    }
  };
});
