/*
  RIZO SAVE CORE
  ==============
  Pure, dependency-free rules for the whole-game save: numeric limits, the
  signed envelope (v1 frozen, v2 current) and the per-mode save slices.

  Loaded by the browser before every other game script, and by Node tests via
  require(). It must never depend on a game mode: modes depend on the core,
  never the other way round.

  FROZEN CODE RULE: everything in the "SAVE VERSION 1" block reproduces the
  signature every pre-v88 save was written with. Changing one character of it
  makes every existing v1 save fail verification. New data goes into a new
  save version instead.
*/
(function initRizoSaveCore(root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) Object.defineProperty(root, "RizoSaveCore", { value: Object.freeze(core), configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoSaveCore() {
  "use strict";

  const APP = "RIZO LIFE";
  const LATEST_SAVE_VERSION = 2;

  // Hub-owned limits. Game modes keep their own limits; a mode limit must
  // never change how the hub clamps currency, XP or arcade records.
  const LIMITS = Object.freeze({
    MAX_WALLET_EMBERS: 50_000_000,
    MAX_WALLET_SHARDS: 5_000_000,
    MAX_INVENTORY_STACK: 100_000,
    MAX_COLLECTION_COUNT: 100_000,
    MAX_PLAYER_XP: 1_000_000_000,
    MAX_META_COUNTER: 100_000_000,
    MAX_SEASON_XP: 100_000_000,
    MAX_SEASON_LEVEL: 100_000,
    MAX_ARCADE_SCORE: 1_000_000_000,
    MAX_MODE_SLICE_BYTES: 400_000
  });

  function clampNumber(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }
  function clampInteger(value, min, max, fallback = min) {
    return Math.floor(clampNumber(value, min, max, fallback));
  }
  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      const output = {};
      for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
      return output;
    }
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }
  function fnv1a(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  // A JSON round trip makes the signed value identical to what a later load
  // parses back (Sets, Dates, undefined and non-finite numbers all collapse the
  // same way on both sides).
  function plainJSON(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  // ===== SAVE VERSION 1 (FROZEN) =====
  // Signed a projection of the state. Values copied from RizoDefenseCore.LIMITS
  // as they stood at v87; they are part of the v1 signature, not live limits.
  const V1_SALT = "RIZO-LIFE-V66-VERIFIED-TIMELINE";
  const V1_LIMITS = Object.freeze({
    MAX_SUPPORTED_WAVE: 9999,
    MAX_REASONABLE_KILLS: 1_000_000,
    MAX_REASONABLE_DAMAGE: 1_000_000_000_000,
    MAX_REASONABLE_BOSSES: 2_000,
    MAX_REASONABLE_PERFECT_WAVES: 9999,
    MAX_WALLET_EMBERS: 50_000_000,
    MAX_WALLET_SHARDS: 5_000_000,
    MAX_INVENTORY_STACK: 100_000,
    MAX_COLLECTION_COUNT: 100_000,
    MAX_PLAYER_XP: 1_000_000_000,
    MAX_META_COUNTER: 100_000_000,
    MAX_MASTERY_WAVES: 50_000,
    MAX_MASTERY_RUNS: 10_000,
    MAX_SEASON_XP: 100_000_000,
    MAX_SEASON_LEVEL: 100_000
  });

  function stateSignaturePayloadV1(state, savedAt, schemaVersion = 1) {
    const source = state && typeof state === "object" ? state : {};
    const scores = source.scores && typeof source.scores === "object" ? source.scores : {};
    const pet = source.pet && typeof source.pet === "object" ? source.pet : {};
    const farm = source.farm && typeof source.farm === "object" ? source.farm : {};
    const inventory = source.inventory && typeof source.inventory === "object" ? source.inventory : {};
    const collection = source.collection && typeof source.collection === "object" && !Array.isArray(source.collection) ? source.collection : {};
    const defenseMaps = scores.defenseMaps && typeof scores.defenseMaps === "object" && !Array.isArray(scores.defenseMaps) ? scores.defenseMaps : {};
    const defenseMastery = scores.defenseMastery && typeof scores.defenseMastery === "object" && !Array.isArray(scores.defenseMastery) ? scores.defenseMastery : {};
    return stableValue({
      schemaVersion,
      stateVersion: clampInteger(source.version, 0, 10_000, 0),
      savedAt: clampInteger(savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      player: {
        keeperId: typeof source.player?.keeperId === "string" ? source.player.keeperId.slice(0, 80) : "",
        streak: clampInteger(source.player?.streak, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalSessions: clampInteger(source.player?.totalSessions, 0, V1_LIMITS.MAX_META_COUNTER, 0)
      },
      wallet: {
        embers: clampInteger(source.wallet?.embers, 0, V1_LIMITS.MAX_WALLET_EMBERS, 0),
        shards: clampInteger(source.wallet?.shards, 0, V1_LIMITS.MAX_WALLET_SHARDS, 0)
      },
      pet: {
        id: typeof pet.id === "string" ? pet.id.slice(0, 80) : "",
        number: clampInteger(pet.number, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        name: typeof pet.name === "string" ? pet.name.slice(0, 20) : "",
        stage: typeof pet.stage === "string" ? pet.stage.slice(0, 30) : "",
        variant: typeof (pet.variant || pet.hiddenVariant) === "string" ? (pet.variant || pet.hiddenVariant).slice(0, 30) : "",
        form: typeof pet.form === "string" ? pet.form.slice(0, 30) : "",
        xp: Math.round(clampNumber(pet.xp, 0, V1_LIMITS.MAX_PLAYER_XP, 0)),
        bond: Math.round(clampNumber(pet.bond, 0, 100, 0) * 100) / 100,
        skills: stableValue(pet.skills || {}),
        genes: stableValue(pet.genes || {})
      },
      inventory: {
        accessories: (Array.isArray(inventory.accessories) ? inventory.accessories : []).slice(0, 200),
        rooms: (Array.isArray(inventory.rooms) ? inventory.rooms : []).slice(0, 200),
        phoenix: clampInteger(inventory.phoenix, 0, V1_LIMITS.MAX_INVENTORY_STACK, 0),
        growth: clampInteger(inventory.growth, 0, V1_LIMITS.MAX_INVENTORY_STACK, 0),
        care: clampInteger(inventory.care, 0, V1_LIMITS.MAX_INVENTORY_STACK, 0)
      },
      achievements: (Array.isArray(source.achievements) ? source.achievements : []).slice(0, 500),
      daily: {
        date: typeof source.daily?.date === "string" ? source.daily.date.slice(0, 20) : "",
        type: typeof source.daily?.type === "string" ? source.daily.type.slice(0, 30) : "",
        progress: clampNumber(source.daily?.progress, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        claimed: Boolean(source.daily?.claimed),
        giftClaimed: Boolean(source.daily?.giftClaimed)
      },
      season: {
        xp: clampNumber(source.season?.xp, 0, V1_LIMITS.MAX_SEASON_XP, 0),
        level: clampInteger(source.season?.level, 1, V1_LIMITS.MAX_SEASON_LEVEL, 1)
      },
      expedition: stableValue(source.expedition || {}),
      treasures: stableValue(source.treasures || {}),
      collection: Object.fromEntries(Object.entries(collection).slice(0, 200).map(([id, count]) => [id.slice(0, 40), clampInteger(count, 0, V1_LIMITS.MAX_COLLECTION_COUNT, 0)])),
      arcade: Object.fromEntries(["power", "spark", "forage", "rush", "walk", "rhythm", "memory", "glide", "breaker", "maze"].map(id => [id, clampNumber(scores[id], 0, V1_LIMITS.MAX_REASONABLE_DAMAGE, 0)])),
      defense: {
        best: clampInteger(scores.defense, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
        maps: Object.fromEntries(Object.entries(defenseMaps).slice(0, 20).map(([id, wave]) => [id.slice(0, 40), clampInteger(wave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0)])),
        milestones: (Array.isArray(scores.defenseMilestones) ? scores.defenseMilestones : []).slice(0, 20),
        perfectMaps: (Array.isArray(scores.defensePerfectMaps) ? scores.defensePerfectMaps : []).slice(0, 20),
        contracts: (Array.isArray(scores.defenseContracts) ? scores.defenseContracts : []).slice(0, 60).map(contract => ({
          id: typeof contract?.id === "string" ? contract.id.slice(0, 80) : "",
          date: typeof contract?.date === "string" ? contract.date.slice(0, 20) : "",
          mapId: typeof contract?.mapId === "string" ? contract.mapId.slice(0, 40) : "",
          targetWave: clampInteger(contract?.targetWave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
          bestWave: clampInteger(contract?.bestWave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
          completed: Boolean(contract?.completed),
          perfect: Boolean(contract?.perfect)
        })),
        history: (Array.isArray(scores.defenseHistory) ? scores.defenseHistory : []).slice(0, 12).map(run => ({
          id: typeof run?.id === "string" ? run.id.slice(0, 80) : "",
          mapId: typeof run?.mapId === "string" ? run.mapId.slice(0, 40) : "",
          clearedWave: clampInteger(run?.clearedWave ?? run?.wave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
          reachedWave: clampInteger(run?.reachedWave ?? run?.currentWave ?? run?.wave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
          kills: clampInteger(run?.kills, 0, V1_LIMITS.MAX_REASONABLE_KILLS, 0),
          bosses: clampInteger(run?.bosses, 0, V1_LIMITS.MAX_REASONABLE_BOSSES, 0),
          perfectWaveCount: clampInteger(run?.perfectWaveCount, 0, V1_LIMITS.MAX_REASONABLE_PERFECT_WAVES, 0)
        })),
        mastery: Object.fromEntries(Object.entries(defenseMastery).slice(0, 100).map(([id, row]) => [id.slice(0, 80), {
          runs: clampInteger(row?.runs, 0, V1_LIMITS.MAX_MASTERY_RUNS, 0),
          waves: clampInteger(row?.waves, 0, V1_LIMITS.MAX_MASTERY_WAVES, 0),
          bestWave: clampInteger(row?.bestWave, 0, V1_LIMITS.MAX_SUPPORTED_WAVE, 0),
          pops: clampInteger(row?.pops, 0, V1_LIMITS.MAX_REASONABLE_KILLS, 0),
          damage: Math.round(clampNumber(row?.damage, 0, V1_LIMITS.MAX_REASONABLE_DAMAGE, 0))
        }]))
      },
      farm: {
        activeRoom: clampInteger(farm.activeRoom, 0, 100, 0),
        unlockedRooms: (Array.isArray(farm.unlockedRooms) ? farm.unlockedRooms : []).slice(0, 100),
        totalAdoptions: clampInteger(farm.totalAdoptions, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalReleased: clampInteger(farm.totalReleased, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        materials: clampInteger(farm.materials, 0, V1_LIMITS.MAX_INVENTORY_STACK, 0),
        roster: (Array.isArray(farm.roster) ? farm.roster : []).slice(0, 100).map(row => ({
          id: typeof row?.id === "string" ? row.id.slice(0, 80) : "",
          number: clampInteger(row?.number, 0, V1_LIMITS.MAX_META_COUNTER, 0),
          stage: typeof row?.stage === "string" ? row.stage.slice(0, 30) : "",
          variant: typeof (row?.variant || row?.hiddenVariant) === "string" ? (row.variant || row.hiddenVariant).slice(0, 30) : "",
          xp: Math.round(clampNumber(row?.xp, 0, V1_LIMITS.MAX_PLAYER_XP, 0)),
          skills: stableValue(row?.skills || {})
        }))
      },
      meta: {
        totalGames: clampInteger(source.meta?.totalGames, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalHatched: clampInteger(source.meta?.totalHatched, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalTaps: clampInteger(source.meta?.totalTaps, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalCareActions: clampInteger(source.meta?.totalCareActions, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        totalWalks: clampInteger(source.meta?.totalWalks, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        deaths: clampInteger(source.meta?.deaths, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        recoveries: clampInteger(source.meta?.recoveries, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        capsules: clampInteger(source.meta?.capsules, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        rebirths: clampInteger(source.meta?.rebirths, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        bondEggs: clampInteger(source.meta?.bondEggs, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        pity: clampInteger(source.meta?.pity, 0, V1_LIMITS.MAX_META_COUNTER, 0),
        shadowFinds: clampInteger(source.meta?.shadowFinds, 0, V1_LIMITS.MAX_META_COUNTER, 0)
      },
      loreUnlocked: (Array.isArray(source.loreUnlocked) ? source.loreUnlocked : []).slice(0, 200)
    });
  }

  function createStateSignatureV1(state, savedAt) {
    return `s1.${fnv1a(`${V1_SALT}|${JSON.stringify(stateSignaturePayloadV1(state, savedAt, 1))}`)}`;
  }

  function verifyEnvelopeV1(envelope) {
    if (!envelope || typeof envelope !== "object" || typeof envelope.signature !== "string") return false;
    if (!envelope.state || typeof envelope.state !== "object") return false;
    return envelope.signature === createStateSignatureV1(envelope.state, envelope.savedAt);
  }

  // ===== SAVE VERSION 2 =====
  // Signs the whole state plus every mode slice. Adding a field to the state
  // or to a slice never needs a new signature version; only a change to the
  // envelope layout does.
  const V2_SALT = "RIZO-WORLD-V88-HUB-AND-MODES";
  function signatureV2(state, modes, savedAt) {
    const payload = stableValue({ schemaVersion: 2, savedAt: clampInteger(savedAt, 0, Number.MAX_SAFE_INTEGER, 0), state, modes });
    return `s2.${fnv1a(`${V2_SALT}|${JSON.stringify(payload)}`)}`;
  }

  // Mode slices: { [modeId]: { schema: integer, data: plain object } }.
  // Ids are lowercase words so a slice can never collide with envelope keys.
  const MODE_ID = /^[a-z][a-z0-9-]{1,31}$/;
  function normalizeModes(raw) {
    const output = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return output;
    for (const [id, slice] of Object.entries(raw)) {
      if (!MODE_ID.test(id) || !slice || typeof slice !== "object" || Array.isArray(slice)) continue;
      const data = slice.data && typeof slice.data === "object" && !Array.isArray(slice.data) ? slice.data : {};
      output[id] = { schema: clampInteger(slice.schema, 0, 1_000_000, 0), data };
    }
    return output;
  }

  function createEnvelope({ state, modes = {}, savedAt = Date.now(), writeId = "", stateVersion = 0 } = {}) {
    const plainState = plainJSON(state || {});
    const plainModes = plainJSON(normalizeModes(modes));
    return {
      app: APP,
      saveVersion: 2,
      stateVersion: clampInteger(stateVersion || plainState.version, 0, 1_000_000, 0),
      savedAt,
      writeId: String(writeId || ""),
      state: plainState,
      modes: plainModes,
      signature: signatureV2(plainState, plainModes, savedAt)
    };
  }

  function envelopeVersion(envelope) {
    if (!envelope || typeof envelope !== "object" || !envelope.state || typeof envelope.state !== "object") return 0;
    const version = Number(envelope.saveVersion);
    return Number.isInteger(version) && version >= 1 ? version : 0;
  }

  // True only for an envelope whose signature matches its own save version.
  function verifyEnvelope(envelope) {
    const version = envelopeVersion(envelope);
    if (version === 1) return verifyEnvelopeV1(envelope);
    if (version === 2) return typeof envelope.signature === "string" && envelope.signature === signatureV2(envelope.state, envelope.modes && typeof envelope.modes === "object" ? envelope.modes : {}, envelope.savedAt);
    return false;
  }

  return {
    APP,
    LATEST_SAVE_VERSION,
    LIMITS,
    clampNumber,
    clampInteger,
    stableValue,
    fnv1a,
    plainJSON,
    normalizeModes,
    createEnvelope,
    envelopeVersion,
    verifyEnvelope,
    // Frozen v1 surface, kept for verification, recovery and tests.
    V1_LIMITS,
    stateSignaturePayloadV1,
    createStateSignatureV1,
    verifyEnvelopeV1
  };
});
