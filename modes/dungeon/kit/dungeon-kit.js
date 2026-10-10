/*
  RIZO DUNGEON — LATE-GAME KIT (dev only)
  =======================================
  Reusable rules for the chapters after Mending Rows (story spine v0.4,
  "arc ahead"): the chase, the cage, the vents with grate views into the
  Boss's rooms, and the stealth descent into the factory. Pure logic, no DOM,
  driven by the same fixed step and geometry helpers as dungeon-core.js.

  NOT part of the live game: index.html, the service worker and the save
  never load or know it. It is proven in a greybox slice at
  tools/dungeon-kit/ (opened with ?dev=1) and by tests/dungeon-kit.test.js.

    Kit.Stealth   vision cones (range, half-angle, line of sight), shadow and
                  hiding spots, Flare carrying further — the same rule the
                  live collectors use, parameterised
    Kit.Watcher   a patrol that looks: patrol → spot → (caught | search → patrol)
    Kit.Chase     a pursuer on his trail: it follows where he has been, gains
                  when he stops, and loses him at a goal
    Kit.Cage      the cage: rattle the door only while the guard looks away
    Kit.Vents     a grid of ducts; still on a grate, the room below shows
    Kit.FACTORY   the greybox slice: cage → vents (three grate views) →
                  factory floor (watchers, lockers) → the chase out
*/
(function initRizoDungeonKit(root, factory) {
  const core = root?.RizoDungeonCore || (typeof require === "function" ? require("../dungeon-core.js") : null);
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonKit", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonKit(Core) {
  "use strict";
  if (!Core) throw new Error("the Dungeon kit needs dungeon-core.js first");
  const STEP_MS = Core.STEP_MS;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const norm = (x, y) => { const l = Math.hypot(x, y); return l > 1e-9 ? [x / l, y / l] : [0, 0]; };
  const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const geoOf = room => ({ w: room.w, h: room.h, solids: room.solids || [] });

  // ===== STEALTH =====
  // Seen = inside the cone, in line of sight, and not hidden. Hidden = in a
  // shadow or hiding spot and not Flaring (a locker hides even when moving
  // inside it; shadow only while still, if the spot says so).
  const Stealth = Object.freeze({
    hidden(target, room) {
      if (target.flaring) return false;
      return (room.hides || []).some(rect => inRect(target.x, target.y, rect) && (!rect.still || !target.moving));
    },
    sees(eye, target, room, def) {
      const range = def.range * (target.flaring ? (def.flareRange || 2) : 1);
      const dx = target.x - eye.x, dy = target.y - eye.y, distance = Math.hypot(dx, dy);
      if (distance > range) return false;
      if (Stealth.hidden(target, room)) return false;
      if (distance > 1e-6 && (dx * eye.aimX + dy * eye.aimY) / distance < Math.cos(def.halfAngle)) return false;
      return Core.lineOfSight(geoOf(room), eye.x, eye.y, target.x, target.y);
    },
    // The lit fan, stopped by walls: for drawing, and for "is that spot lit".
    cone(eye, room, def, rays = 16) {
      const base = Math.atan2(eye.aimY, eye.aimX), pts = [];
      for (let index = 0; index <= rays; index += 1) {
        const a = base - def.halfAngle + (2 * def.halfAngle * index) / rays;
        const length = Core.rayLength(geoOf(room), eye.x, eye.y, Math.cos(a), Math.sin(a), def.range);
        pts.push({ x: eye.x + Math.cos(a) * length, y: eye.y + Math.sin(a) * length });
      }
      return pts;
    }
  });

  // ===== WATCHER: a patrol that looks =====
  const WATCHER = Object.freeze({ speed: 26, range: 96, halfAngle: 0.45, spotMs: 1000, loseMs: 350, searchMs: 1600, pauseMs: 700, chase: 28, flareRange: 2 });
  function createWatcher({ id, patrol, def = {} }) {
    const d = { ...WATCHER, ...def };
    const pts = patrol.map(([x, y]) => ({ x, y }));
    const [ax, ay] = norm(pts[1 % pts.length].x - pts[0].x, pts[1 % pts.length].y - pts[0].y);
    return { id, def: d, patrol: pts, wp: pts.length > 1 ? 1 : 0, x: pts[0].x, y: pts[0].y, aimX: ax || 1, aimY: ay, state: "patrol", stateAt: 0, pauseUntil: 0, lastSeenAt: -1, seen: null };
  }
  function stepWatcher(w, target, room, t) {
    const d = w.def, events = [];
    const sees = Stealth.sees(w, target, room, d);
    const turn = (tx, ty, rate) => { const [nx, ny] = norm(tx - w.x, ty - w.y); if (!nx && !ny) return; const [ax, ay] = norm(w.aimX + (nx - w.aimX) * rate, w.aimY + (ny - w.aimY) * rate); w.aimX = ax || nx; w.aimY = ay || ny; };
    const walk = (tx, ty, speed) => { const dx = tx - w.x, dy = ty - w.y, l = Math.hypot(dx, dy), s = Math.min(l, speed * STEP_MS / 1000); if (l > 1e-6) { w.x += dx / l * s; w.y += dy / l * s; } return l - s; };
    const enter = state => { w.state = state; w.stateAt = t; };
    if (w.state === "patrol") {
      if (sees) { w.lastSeenAt = t; w.seen = { x: target.x, y: target.y }; enter("spot"); events.push("spotted"); return events; }
      if (t < w.pauseUntil) return events;
      const goal = w.patrol[w.wp];
      turn(goal.x, goal.y, 0.15);
      if (walk(goal.x, goal.y, d.speed) < 0.5 && w.patrol.length > 1) { w.wp = (w.wp + 1) % w.patrol.length; w.pauseUntil = t + d.pauseMs; }
    } else if (w.state === "spot") {
      if (sees) { w.lastSeenAt = t; w.seen = { x: target.x, y: target.y }; }
      turn(w.seen.x, w.seen.y, 0.3); walk(w.seen.x, w.seen.y, d.chase);
      if (t - w.lastSeenAt > d.loseMs) { enter("search"); events.push("lost"); }
      else if (t - w.stateAt >= d.spotMs) { enter("caught"); events.push("caught"); }
    } else if (w.state === "search") {
      if (sees) { w.lastSeenAt = t; w.seen = { x: target.x, y: target.y }; enter("spot"); events.push("spotted"); }
      else if (t - w.stateAt >= d.searchMs) { enter("patrol"); events.push("resume"); }
    }
    return events;
  }

  // ===== CHASE: something on his trail =====
  // The pursuer runs along the breadcrumbs he left (so walls are respected
  // without pathfinding). It is a little slower than him while he runs, and
  // closes in whenever he stops or doubles back. Caught inside catchRadius;
  // safe once he reaches the goal.
  const CHASE = Object.freeze({ speed: 72, startGap: 900, crumbEvery: 6, catchRadius: 12 });
  function createChase({ from, goal, def = {} }) {
    return { def: { ...CHASE, ...def }, x: from.x, y: from.y, crumbs: [], startAt: null, state: "waiting", goal };
  }
  function stepChase(c, target, t) {
    const d = c.def;
    const last = c.crumbs[c.crumbs.length - 1];
    if (!last || Math.hypot(target.x - last.x, target.y - last.y) >= d.crumbEvery) c.crumbs.push({ x: target.x, y: target.y });
    if (c.state === "waiting") { c.startAt = c.startAt ?? t; if (t - c.startAt >= d.startGap) c.state = "running"; return []; }
    if (c.state !== "running") return [];
    if (inRect(target.x, target.y, c.goal)) { c.state = "escaped"; return ["escaped"]; }
    let budget = d.speed * STEP_MS / 1000;
    while (budget > 0 && c.crumbs.length) {
      const next = c.crumbs[0], dx = next.x - c.x, dy = next.y - c.y, l = Math.hypot(dx, dy);
      if (l <= budget) { c.x = next.x; c.y = next.y; budget -= l; c.crumbs.shift(); }
      else { c.x += dx / l * budget; c.y += dy / l * budget; budget = 0; }
    }
    if (Math.hypot(target.x - c.x, target.y - c.y) <= d.catchRadius) { c.state = "caught"; return ["caught"]; }
    return [];
  }

  // ===== CAGE: rattle the door only while nobody is looking =====
  // A guard looks at the cage for `watchMs`, then away for `awayMs`. Each
  // rattle while he looks away loosens the door one notch; a rattle while he
  // looks undoes two and makes him look longer. `notches` frees it. A quiet
  // turn of the head (`tellMs` before he looks back) is the readable warning.
  const CAGE = Object.freeze({ watchMs: 2600, awayMs: 2400, tellMs: 600, notches: 4, rattleGapMs: 260 });
  function createCage(def = {}) { return { def: { ...CAGE, ...def }, loose: 0, phase: "watch", phaseAt: 0, extra: 0, lastRattle: -1e9, open: false }; }
  function stepCage(cage, input, t) {
    const d = cage.def, events = [];
    if (cage.open) return events;
    const elapsed = t - cage.phaseAt;
    if (cage.phase === "watch" && elapsed >= d.watchMs + cage.extra) { cage.phase = "away"; cage.phaseAt = t; cage.extra = 0; events.push("looks-away"); }
    else if (cage.phase === "away" && elapsed >= d.awayMs) { cage.phase = "watch"; cage.phaseAt = t; events.push("looks-back"); }
    if (input.rattle && t - cage.lastRattle >= d.rattleGapMs) {
      cage.lastRattle = t;
      if (cage.phase === "away") { cage.loose += 1; events.push("loosened"); if (cage.loose >= d.notches) { cage.open = true; events.push("open"); } }
      else { cage.loose = Math.max(0, cage.loose - 2); cage.extra += 1200; events.push("noticed"); }
    }
    return events;
  }
  const cageTell = (cage, t) => cage.phase === "away" && t - cage.phaseAt >= cage.def.awayMs - cage.def.tellMs;

  // ===== VENTS: a grid of ducts, and what each grate looks down on =====
  // map rows: "#" duct wall, "." duct, "G" grate (with a view), "S" start, "E" exit.
  function createVents({ map, views = {} }) {
    const rows = map.map(row => [...row]);
    let start = null, exit = null; const grates = {};
    let viewIndex = 0;
    const order = Object.keys(views);
    rows.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === "S") start = { x, y };
      if (cell === "E") exit = { x, y };
      if (cell === "G") grates[`${x},${y}`] = order[viewIndex++] || null;
    }));
    return { rows, views, grates, x: start.x, y: start.y, exit, moveAt: -1e9, stillFor: 0, view: null, out: false };
  }
  const VENT_MOVE_MS = 180, VENT_LOOK_MS = 400;
  function stepVents(v, input, t) {
    const events = [];
    if (v.out) return events;
    const dx = Math.sign(input.moveX || 0), dy = dx ? 0 : Math.sign(input.moveY || 0);
    if ((dx || dy) && t - v.moveAt >= VENT_MOVE_MS) {
      const nx = v.x + dx, ny = v.y + dy, cell = v.rows[ny]?.[nx];
      if (cell && cell !== "#") { v.x = nx; v.y = ny; v.moveAt = t; v.stillFor = 0; if (v.view) { v.view = null; events.push("view-off"); } }
    } else if (!dx && !dy) v.stillFor += STEP_MS;
    const grate = v.grates[`${v.x},${v.y}`];
    if (grate && !v.view && v.stillFor >= VENT_LOOK_MS) { v.view = grate; events.push(`view:${grate}`); }
    if (v.exit && v.x === v.exit.x && v.y === v.exit.y) { v.out = true; events.push("out"); }
    return events;
  }

  // ===== THE GREYBOX FACTORY SLICE =====
  // Proves the kit end to end. Not canon geometry; every number is a stand-in.
  const wall = (x, y, w, h) => ({ x, y, w, h, kind: "wall" });
  const FACTORY = Object.freeze({
    cage: { id: "kit-cage", name: "THE CAGE", w: 320, h: 220, solids: [wall(0, 0, 320, 12), wall(0, 208, 320, 12), wall(0, 0, 12, 220), wall(308, 0, 12, 220)], cage: { x: 40, y: 80, w: 60, h: 60 }, guard: { x: 230, y: 110 } },
    vents: {
      map: [
        "##########",
        "#S..G...##",
        "###.###..#",
        "#...#G#G.#",
        "#.###.#.##",
        "#.....#..E",
        "##########"
      ],
      // What each grate shows, darker each time (spine v0.4: the Boss, his
      // scientists, the true scale of the collection). The office and the
      // collection are on the way out; the lab is a side duct. Greybox captions.
      views: {
        office: "Below: a long desk, a phone face down, a tie on the back of the chair. Nobody in it. The mark on the wall.",
        lab: "Below: people in white coats around a glass jar. Inside it, a small light, very still. They are writing things down.",
        collection: "Below: shelves going back further than the light. Jars on every shelf. Every jar has a light in it."
      }
    },
    floor: {
      id: "kit-floor", name: "THE FACTORY FLOOR", w: 480, h: 360,
      solids: [wall(0, 0, 480, 12), wall(0, 348, 480, 12), wall(0, 0, 12, 360), wall(468, 0, 12, 360),
        { id: "line-a", x: 100, y: 80, w: 24, h: 200, kind: "machine" }, { id: "line-b", x: 230, y: 40, w: 24, h: 200, kind: "machine" }, { id: "line-c", x: 360, y: 120, w: 24, h: 200, kind: "machine" }],
      hides: [{ id: "locker-a", x: 140, y: 300, w: 22, h: 30 }, { id: "locker-b", x: 270, y: 260, w: 22, h: 30 }, { id: "shadow-c", x: 400, y: 40, w: 50, h: 40, still: true }],
      start: { x: 40, y: 320 }, exit: { x: 430, y: 300, w: 38, h: 48 },
      watchers: [{ id: "w1", patrol: [[170, 60], [170, 300]] }, { id: "w2", patrol: [[300, 320], [300, 80], [420, 80]] }]
    },
    run: { id: "kit-run", name: "THE WAY OUT", w: 600, h: 160, solids: [wall(0, 0, 600, 12), wall(0, 148, 600, 12), { x: 180, y: 12, w: 20, h: 90, kind: "crate" }, { x: 360, y: 60, w: 20, h: 88, kind: "crate" }], start: { x: 40, y: 80 }, goal: { x: 560, y: 12, w: 40, h: 136 } }
  });

  return Object.freeze({ STEP_MS, Stealth, WATCHER, createWatcher, stepWatcher, CHASE, createChase, stepChase, CAGE, createCage, stepCage, cageTell, createVents, stepVents, VENT_MOVE_MS, VENT_LOOK_MS, FACTORY });
});
