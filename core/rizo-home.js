/* Home rules. Embers are the existing wallet; home records are memories, not
   another currency. Spatial placement belongs to the pet, never its reaction. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RizoHome = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DRILLS = Object.freeze(["power", "spark", "forage", "rush", "walk", "rhythm", "memory", "glide", "breaker", "maze"]);
  const CARE = Object.freeze(["feed", "clean", "pat", "talk"]);
  const TOYS = Object.freeze(["ball", "stump", "puddle", "bush"]);
  const TIERS = Object.freeze([
    Object.freeze({ id: "shelter", name: "RAIN SHELTER", cost: 0, detail: "A dry corner. A place to start." }),
    Object.freeze({ id: "warm", name: "WARM DEN", cost: 180, detail: "A real bed, a woven rug, and a light left on." }),
    Object.freeze({ id: "room", name: "OPEN ROOM", cost: 750, detail: "Open the archway. Make room for everything you bring back." }),
    Object.freeze({ id: "roof", name: "ROOFTOP HOME", cost: 2400, detail: "Your own patch of sky. Plants, lights, and a telescope." })
  ]);
  // A horizon, not a sale of unimplemented content. Never deducted from a wallet.
  const HORIZON = Object.freeze({ id: "orbit", name: "ORBIT / A WORLD OF OUR OWN", cost: 1000000, available: false });
  const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== null && value !== ""
    ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const counter = value => Math.floor(number(value, 0, 0, 100000000));
  const list = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(id => allowed.includes(id)))] : [];
  function position(raw) {
    const p = object(raw);
    return { x: number(p.x, 50, 25, 75), y: number(p.y, 0, -4, 9) };
  }
  function normalize(raw, legacy = {}) {
    const h = object(raw), activity = object(h.activity), routine = object(h.routine), last = object(h.lastReturn);
    return {
      tier: Math.floor(number(h.tier, 0, 0, TIERS.length - 1)),
      builtAt: number(h.builtAt, 0, 0, Number.MAX_SAFE_INTEGER),
      activity: Object.fromEntries(["care", "play", "training", "defense"].map(id => [id, counter(activity[id])])),
      trained: list(h.trained ?? DRILLS.filter(id => Number(legacy.scores?.[id]) > 0), DRILLS),
      routine: { date: /^\d{4}-\d{2}-\d{2}$/.test(routine.date || "") ? routine.date : "", care: list(routine.care, CARE), play: list(routine.play, TOYS) },
      lastReturn: ["training", "defense", "dungeon", "expedition"].includes(last.source)
        ? { source: last.source, name: String(last.name || "").replace(/[<>\u0000-\u001f]/g, "").slice(0, 60), embers: counter(last.embers), at: number(last.at, 0, 0, Number.MAX_SAFE_INTEGER) } : null
    };
  }
  function next(home) { return TIERS[(home?.tier || 0) + 1] || null; }
  function purchase(home, embers, id, at) {
    const target = next(home);
    if (!target || target.id !== id) return { ok: false, reason: "order" };
    if (!Number.isFinite(embers) || embers < target.cost) return { ok: false, reason: "embers" };
    return { ok: true, home: { ...home, tier: home.tier + 1, builtAt: at }, embers: embers - target.cost };
  }
  // First use of each familiar object/care action in a calendar day gets a tiny
  // Ember thank-you. No streak requirement, rollover debt, or diminishing care.
  function everyday(home, kind, id, date) {
    const allowed = kind === "care" ? CARE : kind === "play" ? TOYS : [];
    if (!allowed.includes(id)) return 0;
    if (home.routine.date !== date) home.routine = { date, care: [], play: [] };
    home.activity[kind] = Math.min(100000000, home.activity[kind] + 1);
    if (home.routine[kind].includes(id)) return 0;
    home.routine[kind].push(id);
    return kind === "care" ? 3 : 6;
  }
  function recordTraining(home, id) {
    home.activity.training = Math.min(100000000, home.activity.training + 1);
    if (DRILLS.includes(id) && !home.trained.includes(id)) home.trained.push(id);
  }
  return Object.freeze({ DRILLS, TIERS, HORIZON, position, normalize, next, purchase, everyday, recordTraining });
});
