/*
  RIZO TRAINING CONTRACT
  ======================
  The rules every training minigame plays by, and the one place a score turns
  into pet growth. Pure and dependency-free: loaded in the browser before the
  games, and by Node tests via require().

  A training game is a short run (~25–60 s) that only produces a result. It
  never writes the save, the wallet or the pet. The hub runs the clock, starts
  the game with a read-only pet snapshot, and when the game reports its result
  the hub calls convert() and applies the gains through its own pet rules.

    game.start(pet, run)   pet: frozen snapshot   run: host services (arena, clock, sfx, end)
    run.end(result)        result: { score, reason, qualified, stats }
    convert(def, result)   → gains: skills, xp, bond, mood, hunger, embers, energy

  Rewards are normalised. A run is measured against the game's `par` score (a
  solid, competent run), capped at MAX_PERFORMANCE × par, and the reward budget
  scales with the Energy the run costs. So a game's raw score scale can be
  anything: 30 points or 600 points both pay the same for the same effort.
*/
(function initRizoTraining(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoTraining", { value: Object.freeze(api), configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoTraining() {
  "use strict";

  const CONTRACT_VERSION = 1;
  const SKILLS = Object.freeze(["speed", "power", "instinct", "stamina", "luck"]);
  const END_REASONS = Object.freeze(["timeup", "death", "cleared", "quit"]);

  // Per Energy point a par run costs. Tune here, never per game.
  const RATES = Object.freeze({
    skillPerEnergy: 0.5,  // skill points, split by the game's `trains` weights
    xpPerEnergy: 3.5,
    embersPerEnergy: 5,
    minEmbers: 4,         // a qualified run always pays something
    bondAtPar: 4,         // × the game's care.bond weight
    moodAtPar: 10         // × the game's care.mood weight
  });
  const MAX_PERFORMANCE = 1.5;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
  const round2 = value => Math.round(value * 100) / 100;

  // Validates a game definition and returns a frozen, normalised copy. Throws
  // with a precise message so a broken game fails at load, not mid-run.
  function defineGame(def) {
    if (!def || typeof def !== "object") throw new TypeError("training game definition must be an object");
    const id = String(def.id || "");
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(id)) throw new TypeError(`training game id "${id}" must be a lowercase word`);
    const fail = message => { throw new TypeError(`training game "${id}": ${message}`); };
    const duration = Number(def.duration);
    if (!(duration >= 10 && duration <= 120)) fail("duration must be 10–120 seconds");
    const energy = Number(def.energy);
    if (!(energy >= 1 && energy <= 40)) fail("energy must be 1–40");
    const par = Number(def.par);
    if (!(par > 0)) fail("par (the score of a solid run) must be positive");
    const trains = {};
    let weightTotal = 0;
    for (const [skill, weight] of Object.entries(def.trains || {})) {
      if (!SKILLS.includes(skill)) fail(`unknown skill "${skill}"`);
      const w = Number(weight);
      if (!(w > 0)) fail(`weight for ${skill} must be positive`);
      trains[skill] = w; weightTotal += w;
    }
    if (!weightTotal) fail("must train at least one skill");
    for (const skill of Object.keys(trains)) trains[skill] = trains[skill] / weightTotal;
    const care = def.care && typeof def.care === "object" ? def.care : {};
    for (const key of ["start", "stop"]) if (def[key] !== undefined && typeof def[key] !== "function") fail(`${key} must be a function`);
    return Object.freeze({
      ...def,
      id,
      contract: CONTRACT_VERSION,
      name: String(def.name || id.toUpperCase()),
      duration,
      energy,
      par,
      lives: Math.max(0, Math.floor(Number(def.lives) || 0)),
      trains: Object.freeze(trains),
      care: Object.freeze({
        bond: clamp(care.bond, 0, 1),
        mood: clamp(care.mood, 0, 1),
        // Hunger change for a par run: negative for exertion, positive for food games.
        hunger: clamp(care.hunger, -20, 30)
      }),
      alignment: clamp(def.alignment, -3, 3)
    });
  }

  // A run earns permanent credit only after real play. Games may tighten this
  // with result.qualified = false; they cannot loosen it.
  function isQualified(result) {
    if (!result || typeof result !== "object") return false;
    if (result.qualified === false) return false;
    return Number(result.score) > 0 && Number(result.inputs ?? 1) > 0;
  }

  function performance(def, result) {
    return isQualified(result) ? clamp(Number(result.score) / def.par, 0, MAX_PERFORMANCE) : 0;
  }

  // Score → growth. Deterministic and side-effect free: the hub applies the
  // returned gains (skills go through the pet's gene caps there).
  function convert(def, result) {
    const qualified = isQualified(result);
    const reason = END_REASONS.includes(result?.reason) ? result.reason : "timeup";
    if (!qualified) {
      return Object.freeze({ game: def.id, qualified: false, reason, performance: 0, skills: Object.freeze({}), xp: 0, bond: 0, mood: 0, hunger: 0, embers: 0, energy: 0, alignment: 0 });
    }
    const perf = performance(def, result);
    const skillPoints = perf * def.energy * RATES.skillPerEnergy;
    const skills = {};
    for (const [skill, weight] of Object.entries(def.trains)) skills[skill] = round2(skillPoints * weight);
    return Object.freeze({
      game: def.id,
      qualified: true,
      reason,
      performance: round2(perf),
      skills: Object.freeze(skills),
      xp: round2(perf * def.energy * RATES.xpPerEnergy),
      bond: round2(perf * def.care.bond * RATES.bondAtPar),
      mood: round2(perf * def.care.mood * RATES.moodAtPar),
      // Exertion is paid in full; food games feed in proportion to the run.
      hunger: round2(def.care.hunger < 0 ? def.care.hunger : perf * def.care.hunger),
      embers: Math.max(RATES.minEmbers, Math.round(perf * def.energy * RATES.embersPerEnergy)),
      energy: -def.energy,
      alignment: def.alignment
    });
  }

  // Largest gain a single run of this game can ever produce. Used by tests and
  // by the economy notes in ARCHITECTURE.md.
  function ceiling(def) {
    return convert(def, { score: def.par * MAX_PERFORMANCE * 10, reason: "timeup", inputs: 1 });
  }

  const registry = new Map();
  function register(def) {
    const game = defineGame(def);
    if (registry.has(game.id)) throw new Error(`training game "${game.id}" is already registered`);
    registry.set(game.id, game);
    return game;
  }

  return {
    CONTRACT_VERSION,
    SKILLS,
    END_REASONS,
    RATES,
    MAX_PERFORMANCE,
    defineGame,
    isQualified,
    performance,
    convert,
    ceiling,
    register,
    get: id => registry.get(id) || null,
    list: () => [...registry.values()]
  };
});
