/*
  RIZO DUNGEON — CORE RULES
  =========================
  Pure rules, no DOM and no clock of its own: one fixed 60 Hz step advances a
  plain simulation object, and every deadline is a time on that simulation
  clock. Profile mapping, movement/collision, Flare/Tuck/Kindle, the Draftling,
  pause holds and slice validation live here so Node tests can drive them.

  The mode (dungeon-mode.js) owns the frame loop, input and persistence; the
  view only draws what this module decides.
*/
(function initRizoDungeonCore(root, factory) {
  const content = root?.RizoDungeonContent || (typeof require === "function" ? require("./dungeon-content.js") : null);
  const api = factory(content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonCore", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonCore(C) {
  "use strict";
  if (!C) throw new Error("Rizo Dungeon core needs dungeon-content.js first");

  // ===== TUNING (initial values from the brief; not validated balance) =====
  const STEP_MS = 1000 / 60;
  const T = Object.freeze({
    STEP_MS,
    MAX_CATCHUP_STEPS: 8,
    MOVE_SPEED: 80,
    PLAYER_RADIUS: 7,
    FLAME_MAX: 5,
    HURT_MS: 750,
    HURT_MS_ASSIST: 1000,
    ASSIST_ANTICIPATION: 1.35,
    KNOCKBACK: 10,
    FLARE_DAMAGE: 2,
    FLARE_RANGE: 30,
    FLARE_ARC_DEG: 110,
    FLARE_ANTICIPATION_MS: 100,
    FLARE_ACTIVE_MS: 100,
    FLARE_RECOVERY_MS: 130,
    FLARE_MOVE_FACTOR: 0.6,
    TUCK_DISTANCE: 40,
    TUCK_MS: 200,
    TUCK_PROTECT_MS: 160,
    TUCK_COOLDOWN_MS: 650,
    SECONDARY_BUFFER_MS: 120,
    INTERACT_REACH: 24,
    KINDLE_MS: 1200,
    DOWN_MS: 1100,
    HEARTH_ARRIVAL: 34
  });
  const FLARE_TOTAL_MS = T.FLARE_ANTICIPATION_MS + T.FLARE_ACTIVE_MS + T.FLARE_RECOVERY_MS;
  const FLARE_COS = Math.cos((T.FLARE_ARC_DEG / 2) * Math.PI / 180);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const round3 = value => Math.round(value * 1000) / 1000;
  const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value));

  // ===== PROFILE: pet skills become small edges, never requirements =====
  const edgeOf = skill => { const s = Math.max(0, finite(skill)); return clamp(s / (s + 50), 0, 1); };
  function edges(skills = {}) {
    return {
      speed: round3(1 + 0.08 * edgeOf(skills.speed)),
      power: round3(1 + 0.12 * edgeOf(skills.power)),
      instinct: round3(1 + 0.2 * edgeOf(skills.instinct)),
      stamina: round3(1 - 0.15 * edgeOf(skills.stamina))
    };
  }
  const EDGE_BOUNDS = { speed: [1, 1.08], power: [1, 1.12], instinct: [1, 1.2], stamina: [0.85, 1] };
  function normalizeEdges(raw) {
    const source = isObject(raw) ? raw : {};
    const out = {};
    for (const [key, [min, max]] of Object.entries(EDGE_BOUNDS)) out[key] = round3(clamp(finite(source[key], key === "stamina" ? 1 : 1), min, max));
    return out;
  }
  function legProfile(snapshot = {}) {
    const care = isObject(snapshot.careSummary) ? snapshot.careSummary : {};
    return {
      edges: edges(snapshot.skills || {}),
      bondBand: ["new", "familiar", "attached"].includes(care.bondBand) ? care.bondBand : "new",
      cues: {
        favoriteFoodId: typeof care.favoriteFood?.id === "string" ? care.favoriteFood.id.slice(0, 32) : null,
        favoriteGameId: typeof care.favoriteGameId === "string" ? care.favoriteGameId.slice(0, 32) : null
      }
    };
  }

  // ===== GEOMETRY =====
  // Rooms are fixed; a few pieces depend on the campaign's flags. A solid or
  // exit with `openWhen` exists until that flag is true; a prop with `when`
  // exists only while every listed flag has the listed value.
  function room(roomId) { return C.ROOMS[roomId] || null; }
  const flagOn = (flags, name) => Boolean(flags && flags[name]);
  const present = (item, flags) => (!item.openWhen || !flagOn(flags, item.openWhen)) && (!item.when || Object.entries(item.when).every(([key, value]) => flagOn(flags, key) === value));
  const isOpen = (item, flags) => !item.openWhen || flagOn(flags, item.openWhen);
  function geoOf(sim) {
    const geo = room(sim.roomId);
    return { w: geo.w, h: geo.h, solids: geo.solids.filter(rect => present(rect, sim.flags)) };
  }
  function closestOnRect(x, y, rect) { return [clamp(x, rect.x, rect.x + rect.w), clamp(y, rect.y, rect.y + rect.h)]; }
  function circleHitsRect(x, y, r, rect) {
    const [cx, cy] = closestOnRect(x, y, rect);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy < r * r;
  }
  const pointInRect = (x, y, rect) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  // Pushes a circle out of every solid it overlaps (sliding along walls).
  function resolveCircle(geo, x, y, r) {
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (const rect of geo.solids) {
        const [cx, cy] = closestOnRect(x, y, rect);
        let dx = x - cx, dy = y - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= r * r) continue;
        if (dist2 > 1e-9) {
          const dist = Math.sqrt(dist2), push = r - dist + 1e-6;
          x += (dx / dist) * push; y += (dy / dist) * push;
        } else {
          // Centre inside the rectangle: leave by the nearest side.
          const left = x - rect.x, right = rect.x + rect.w - x, top = y - rect.y, bottom = rect.y + rect.h - y;
          const least = Math.min(left, right, top, bottom);
          if (least === left) x = rect.x - r; else if (least === right) x = rect.x + rect.w + r;
          else if (least === top) y = rect.y - r; else y = rect.y + rect.h + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return [clamp(x, r, geo.w - r), clamp(y, r, geo.h - r)];
  }
  // Moves in sub-steps no longer than half the radius, so nothing tunnels.
  function moveCircle(geo, x, y, r, dx, dy) {
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / (r * 0.5)));
    for (let index = 0; index < steps; index += 1) [x, y] = resolveCircle(geo, x + dx / steps, y + dy / steps, r);
    return [x, y];
  }
  function segmentHitsRect(x1, y1, x2, y2, rect) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const checks = [[-dx, x1 - rect.x], [dx, rect.x + rect.w - x1], [-dy, y1 - rect.y], [dy, rect.y + rect.h - y1]];
    for (const [p, q] of checks) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t0 <= t1;
  }
  function lineOfSight(geo, x1, y1, x2, y2) { return !geo.solids.some(rect => segmentHitsRect(x1, y1, x2, y2, rect)); }
  // Distance along a ray until it meets a solid (or `max`).
  function rayLength(geo, x, y, dx, dy, max) {
    for (let d = 0; d <= max; d += 2) {
      const px = x + dx * d, py = y + dy * d;
      if (px < 0 || py < 0 || px > geo.w || py > geo.h || geo.solids.some(rect => pointInRect(px, py, rect))) return Math.max(0, d - 2);
    }
    return max;
  }
  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1) : 0;
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  function normalize(x, y) {
    const length = Math.hypot(x, y);
    return length > 1e-9 ? [x / length, y / length] : [0, 0];
  }

  // ===== SIMULATION =====
  function makeEnemy(item) {
    const def = C.ENEMIES[item.kind];
    return { id: item.id, kind: item.kind, x: item.x, y: item.y, homeX: item.x, homeY: item.y, r: def.radius, hp: def.hp, maxHp: def.hp, state: item.kind === "porter" ? "waiting" : "idle", stateAt: 0, aimX: item.aimX ?? 0, aimY: item.aimY ?? 1, locked: false, aware: false, flashUntil: -1, goneAt: -1, lungeFromX: item.x, lungeFromY: item.y, durable: Boolean(item.durable) };
  }
  // Ordinary enemies cleared this leg stay cleared; durable defeats never return.
  function spawnEnemies(geo, cleared = [], defeated = []) {
    return geo.encounters.filter(item => !cleared.includes(item.id) && !defeated.includes(item.id)).map(makeEnemy);
  }
  function createSim({ roomId = C.START_ROOM, anchorId = null, flame = T.FLAME_MAX, edges: edgeValues = null, assist = false, cleared = [], defeated = [], flags = {} } = {}) {
    const geo = room(roomId);
    if (!geo) throw new RangeError(`unknown dungeon room "${roomId}"`);
    const anchor = geo.anchors[anchorId] || geo.anchors[geo.entryAnchor];
    return {
      t: 0,
      roomId,
      assist: Boolean(assist),
      edges: normalizeEdges(edgeValues),
      flags: { ...flags },
      phase: "play",
      downUntil: -1,
      nearHearth: false,
      zones: [],
      exitArmed: false,
      cleared: [...cleared],
      defeated: [...defeated],
      player: { x: anchor.x, y: anchor.y, r: T.PLAYER_RADIUS, fx: 0, fy: -1, flame: clamp(Math.round(finite(flame, T.FLAME_MAX)), 1, T.FLAME_MAX), act: null, attackSeq: 0, tuckReadyAt: 0, protectUntil: -1, hurtUntil: -1, bufferUntil: -1, moving: false, leashed: false, vx: 0, vy: 0 },
      enemies: spawnEnemies(geo, cleared, defeated)
    };
  }
  const liveEnemies = sim => sim.enemies.filter(enemy => enemy.state !== "gone" && enemy.state !== "settled");
  // Primary means Flare while any noticed enemy remains in the room.
  const encounterActive = sim => sim.enemies.some(enemy => enemy.kind !== "cargo" && enemy.state !== "gone" && enemy.state !== "settled" && enemy.aware);
  const hurtWindow = sim => (sim.assist ? T.HURT_MS_ASSIST : T.HURT_MS);
  const anticipationScale = sim => (sim.assist ? T.ASSIST_ANTICIPATION : 1);
  const vulnerable = (sim, p) => sim.phase === "play" && sim.t >= p.hurtUntil && sim.t >= p.protectUntil;
  function inAlcove(sim) {
    const geo = room(sim.roomId);
    return Boolean(geo.alcove) && flagOn(sim.flags, "alcoveOpen") && pointInRect(sim.player.x, sim.player.y, geo.alcove);
  }

  // Step times are sums of 1000/60; a tiny epsilon keeps phase edges exact.
  const EPS = 1e-6;
  function flarePhase(act, t) {
    if (!act || act.kind !== "flare") return null;
    const elapsed = t - act.start + EPS;
    if (elapsed < T.FLARE_ANTICIPATION_MS) return "anticipation";
    if (elapsed < T.FLARE_ANTICIPATION_MS + T.FLARE_ACTIVE_MS) return "active";
    if (elapsed < FLARE_TOTAL_MS) return "recovery";
    return "done";
  }
  // Tuck may cancel a Flare only after its active window (never anticipation/impact).
  function tuckLegal(sim) {
    const p = sim.player;
    if (sim.phase !== "play" || sim.t < p.tuckReadyAt) return false;
    if (!p.act) return true;
    if (p.act.kind === "flare") return flarePhase(p.act, sim.t) === "recovery";
    return false;
  }
  const INSPECT_KINDS = ["inspect", "door", "bowl", "npc"];
  function interactables(sim) {
    const geo = room(sim.roomId);
    const list = [];
    if (geo.hearth) list.push({ id: geo.hearth.id, kind: "hearth", x: geo.hearth.x, y: geo.hearth.y, r: geo.hearth.r, prompt: "KINDLE", reach: T.INTERACT_REACH });
    for (const prop of geo.props) {
      if (!present(prop, sim.flags)) continue;
      list.push({ id: prop.id, kind: prop.kind, x: prop.x, y: prop.y, r: prop.r, prompt: prop.prompt, reach: T.INTERACT_REACH * (INSPECT_KINDS.includes(prop.kind) ? sim.edges.instinct : 1) });
    }
    return list;
  }
  // The highlighted thing Primary would use; none while an encounter is live.
  function focusTarget(sim) {
    if (sim.phase !== "play" || encounterActive(sim)) return null;
    const p = sim.player;
    let best = null, bestDistance = Infinity;
    for (const item of interactables(sim)) {
      const distance = Math.hypot(item.x - p.x, item.y - p.y) - item.r - p.r;
      if (distance <= item.reach && distance < bestDistance) { best = item; bestDistance = distance; }
    }
    return best;
  }

  function startFlare(sim, events) {
    const p = sim.player;
    p.attackSeq += 1;
    p.act = { kind: "flare", start: sim.t, id: p.attackSeq, fx: p.fx, fy: p.fy, hit: [] };
    events.push({ type: "flare", id: p.attackSeq });
  }
  function startTuck(sim, moveX, moveY, events) {
    const p = sim.player;
    let [dx, dy] = normalize(moveX, moveY);
    if (!dx && !dy) [dx, dy] = [p.fx, p.fy];
    p.act = { kind: "tuck", start: sim.t, dx, dy, progress: 0 };
    p.tuckReadyAt = sim.t + T.TUCK_COOLDOWN_MS * sim.edges.stamina;
    p.protectUntil = sim.t + T.TUCK_PROTECT_MS;
    p.bufferUntil = -1;
    events.push({ type: "tuck" });
  }

  function hurtPlayer(sim, source, events) {
    const p = sim.player;
    p.flame = Math.max(0, p.flame - 1);
    p.hurtUntil = sim.t + hurtWindow(sim);
    p.bufferUntil = -1;
    if (p.act && p.act.kind !== "tuck") p.act = null;
    const [nx, ny] = normalize(p.x - source.x, p.y - source.y);
    [p.x, p.y] = moveCircle(geoOf(sim), p.x, p.y, p.r, (nx || -source.aimX) * T.KNOCKBACK, (ny || -source.aimY) * T.KNOCKBACK);
    events.push({ type: "hurt", flame: p.flame, source: source.kind });
    if (p.flame <= 0) {
      sim.phase = "down";
      sim.downUntil = sim.t + T.DOWN_MS;
      p.act = null;
      events.push({ type: "down" });
    }
  }
  // The van's cooler: it bumps, never burns.
  function bumpPlayer(sim, source, events) {
    const p = sim.player;
    p.hurtUntil = sim.t + 500;
    if (p.act && p.act.kind !== "tuck") p.act = null;
    [p.x, p.y] = moveCircle(geoOf(sim), p.x, p.y, p.r, source.aimX * 14, source.aimY * 14);
    events.push({ type: "bump", id: source.id });
  }

  function updateDraftling(sim, enemy, events) {
    const def = C.ENEMIES.draftling;
    const geo = geoOf(sim);
    const p = sim.player;
    const elapsed = sim.t - enemy.stateAt;
    const toPlayer = Math.hypot(p.x - enemy.x, p.y - enemy.y);
    const sees = () => toPlayer <= def.detect && lineOfSight(geo, enemy.x, enemy.y, p.x, p.y);
    const windup = def.windupMs * anticipationScale(sim);
    const aimAtPlayer = () => { const [ax, ay] = normalize(p.x - enemy.x, p.y - enemy.y); if (ax || ay) { enemy.aimX = ax; enemy.aimY = ay; } };
    const enter = state => { enemy.state = state; enemy.stateAt = sim.t; };
    switch (enemy.state) {
      case "idle":
      case "return": {
        const tx = enemy.homeX + Math.sin(sim.t / 900) * def.homeDrift, ty = enemy.homeY + Math.cos(sim.t / 1300) * def.homeDrift * 0.6;
        const [dx, dy] = normalize(tx - enemy.x, ty - enemy.y);
        const speed = enemy.state === "return" ? 30 : 12;
        const gap = Math.hypot(tx - enemy.x, ty - enemy.y);
        const stepLength = Math.min(gap, speed * STEP_MS / 1000);
        [enemy.x, enemy.y] = moveCircle(geo, enemy.x, enemy.y, enemy.r, dx * stepLength, dy * stepLength);
        if (enemy.state === "return" && gap < 3) enter("idle");
        if (sim.phase === "play" && sees()) {
          if (!enemy.aware) events.push({ type: "notice", id: enemy.id });
          enemy.aware = true;
          aimAtPlayer();
          enemy.locked = false;
          enter("windup");
        }
        break;
      }
      case "windup": {
        // It tracks for most of the draw-back, then commits to the shown line.
        if (elapsed + EPS < def.lockAtMs * anticipationScale(sim)) aimAtPlayer();
        else if (!enemy.locked) { enemy.locked = true; events.push({ type: "lock", id: enemy.id }); }
        const back = (6 / windup) * STEP_MS;
        [enemy.x, enemy.y] = moveCircle(geo, enemy.x, enemy.y, enemy.r, -enemy.aimX * back, -enemy.aimY * back);
        if (elapsed + EPS >= windup) { enemy.locked = true; enemy.lungeFromX = enemy.x; enemy.lungeFromY = enemy.y; enemy.lungeProgress = 0; enter("lunge"); events.push({ type: "lunge", id: enemy.id }); }
        break;
      }
      case "lunge": {
        // Committed line, by elapsed progress: exactly lungeDistance unless a wall stops it.
        const progress = Math.min(1, (elapsed + EPS) / def.lungeMs);
        const step = (progress - (enemy.lungeProgress || 0)) * def.lungeDistance;
        enemy.lungeProgress = progress;
        [enemy.x, enemy.y] = moveCircle(geo, enemy.x, enemy.y, enemy.r, enemy.aimX * step, enemy.aimY * step);
        if (vulnerable(sim, p) && Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.r + p.r) hurtPlayer(sim, enemy, events);
        if (progress >= 1) enter("recover");
        break;
      }
      case "recover": {
        if (elapsed + EPS >= def.recoverMs) {
          if (sim.phase === "play" && sees()) { aimAtPlayer(); enemy.locked = false; enter("windup"); }
          else { enemy.aware = false; enter("return"); }
        }
        break;
      }
      default: break;
    }
  }

  // Needle: shows a straight 10-wide lane, pulses it, then rests. Cover stops it.
  function updateNeedle(sim, enemy, events) {
    const def = C.ENEMIES.needle;
    const geo = geoOf(sim);
    const p = sim.player;
    const elapsed = sim.t - enemy.stateAt;
    const enter = state => { enemy.state = state; enemy.stateAt = sim.t; };
    const sees = () => Math.hypot(p.x - enemy.x, p.y - enemy.y) <= def.detect && lineOfSight(geo, enemy.x, enemy.y, p.x, p.y);
    const indicate = () => {
      const [ax, ay] = normalize(p.x - enemy.x, p.y - enemy.y);
      enemy.aimX = ax || 0; enemy.aimY = ay || 1;
      enemy.laneLength = rayLength(geo, enemy.x + enemy.aimX * (enemy.r + 2), enemy.y + enemy.aimY * (enemy.r + 2), enemy.aimX, enemy.aimY, def.laneMax);
      enter("indicate");
      events.push({ type: "lane", id: enemy.id });
    };
    switch (enemy.state) {
      case "idle":
        if (sim.phase === "play" && sees()) { if (!enemy.aware) events.push({ type: "notice", id: enemy.id }); enemy.aware = true; indicate(); }
        break;
      case "indicate":
        if (elapsed + EPS >= def.indicateMs * anticipationScale(sim)) { enter("pulse"); events.push({ type: "pulse", id: enemy.id }); }
        break;
      case "pulse": {
        const sx = enemy.x + enemy.aimX * (enemy.r + 2), sy = enemy.y + enemy.aimY * (enemy.r + 2);
        const ex = sx + enemy.aimX * enemy.laneLength, ey = sy + enemy.aimY * enemy.laneLength;
        if (vulnerable(sim, p) && distanceToSegment(p.x, p.y, sx, sy, ex, ey) <= def.laneWidth / 2 + p.r * 0.6) hurtPlayer(sim, enemy, events);
        if (elapsed + EPS >= def.pulseMs) enter("recover");
        break;
      }
      case "recover":
        if (elapsed + EPS >= def.recoverMs) { if (sim.phase === "play" && sees()) indicate(); else { enemy.aware = false; enter("idle"); } }
        break;
      default: break;
    }
  }

  // The van's loose cooler: a readable line, then a slide.
  function updateCargo(sim, enemy, events) {
    const def = C.ENEMIES.cargo;
    const elapsed = sim.t - enemy.stateAt;
    const p = sim.player;
    if (enemy.state === "idle") { enemy.state = "windup"; enemy.stateAt = sim.t; enemy.locked = true; }
    else if (enemy.state === "windup" && elapsed + EPS >= def.windupMs) { enemy.state = "lunge"; enemy.stateAt = sim.t; enemy.lungeProgress = 0; events.push({ type: "slide", id: enemy.id }); }
    else if (enemy.state === "lunge") {
      const progress = Math.min(1, (elapsed + EPS) / def.slideMs);
      const step = (progress - enemy.lungeProgress) * def.slideDistance;
      enemy.lungeProgress = progress;
      [enemy.x, enemy.y] = moveCircle(geoOf(sim), enemy.x, enemy.y, enemy.r, enemy.aimX * step, enemy.aimY * step);
      if (!enemy.bumped && vulnerable(sim, p) && Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.r + p.r) { enemy.bumped = true; bumpPlayer(sim, enemy, events); }
      if (progress >= 1) { enemy.state = "gone"; enemy.goneAt = sim.t; events.push({ type: "cargo-done", id: enemy.id, dodged: !enemy.bumped }); }
    }
  }
  function spawnCargo(sim, { id = "cooler", x, y, aimX = 1, aimY = 0 }) {
    sim.enemies = sim.enemies.filter(enemy => enemy.id !== id);
    const enemy = makeEnemy({ id, kind: "cargo", x, y, aimX, aimY });
    sim.enemies.push(enemy);
    return enemy;
  }

  // The Night Porter: alternates a lamp sweep and a queue charge. The closed
  // coat deflects Flare; the open hem takes damage.
  function updatePorter(sim, enemy, events) {
    const def = C.ENEMIES.porter;
    const geo = room(sim.roomId);
    const arena = geo.arena;
    const p = sim.player;
    const elapsed = sim.t - enemy.stateAt;
    const scale = anticipationScale(sim);
    const enter = state => { enemy.state = state; enemy.stateAt = sim.t; };
    const shielded = () => inAlcove(sim);
    switch (enemy.state) {
      case "waiting":
        if (sim.phase === "play" && p.y < arena.y + arena.h - 24) { enemy.aware = true; enemy.nextMove = "sweep"; enemy.fromX = enemy.x; enemy.fromY = enemy.y; enter("reposition"); events.push({ type: "porter-wake", id: enemy.id }); }
        break;
      case "reposition": {
        const k = Math.min(1, (elapsed + EPS) / def.repositionMs);
        enemy.x = enemy.fromX + (enemy.homeX - enemy.fromX) * k;
        enemy.y = enemy.fromY + (enemy.homeY - enemy.fromY) * k;
        if (k >= 1) {
          if (enemy.nextMove === "sweep") {
            enemy.bandY = clamp(p.y, arena.y + def.bandHeight / 2, arena.y + arena.h - def.bandHeight / 2);
            enemy.sweepDir = enemy.sweepDir === 1 ? -1 : 1;
            enter("sweep-tell"); events.push({ type: "sweep-tell", id: enemy.id });
          } else {
            const [ax, ay] = normalize(p.x - enemy.x, p.y - enemy.y);
            enemy.aimX = ax || 0; enemy.aimY = ay || 1;
            enter("charge-tell"); events.push({ type: "charge-tell", id: enemy.id });
          }
        }
        break;
      }
      case "sweep-tell":
        if (elapsed + EPS >= def.sweepTellMs * scale) { enter("sweep"); events.push({ type: "sweep", id: enemy.id }); }
        break;
      case "sweep": {
        const k = Math.min(1, (elapsed + EPS) / def.sweepMs);
        enemy.beamX = enemy.sweepDir === 1 ? arena.x + arena.w * k : arena.x + arena.w * (1 - k);
        if (vulnerable(sim, p) && !shielded() && Math.abs(p.y - enemy.bandY) <= def.bandHeight / 2 && Math.abs(p.x - enemy.beamX) <= def.beamWidth / 2 + p.r) hurtPlayer(sim, enemy, events);
        if (k >= 1) { enemy.openFor = def.sweepOpenMs; enemy.nextMove = "charge"; enter("open"); events.push({ type: "seam-open", id: enemy.id }); }
        break;
      }
      case "charge-tell":
        if (elapsed + EPS >= def.chargeTellMs * scale) { enemy.lungeProgress = 0; enemy.lungeFromX = enemy.x; enemy.lungeFromY = enemy.y; enter("charge"); events.push({ type: "charge", id: enemy.id }); }
        break;
      case "charge": {
        const progress = Math.min(1, (elapsed + EPS) / def.chargeMs);
        const stepLength = (progress - enemy.lungeProgress) * def.chargeDistance;
        enemy.lungeProgress = progress;
        const bounds = { w: geo.w, h: geo.h, solids: [...geoOf(sim).solids, { x: 0, y: 0, w: geo.w, h: arena.y }, { x: 0, y: arena.y + arena.h, w: geo.w, h: geo.h }] };
        [enemy.x, enemy.y] = moveCircle(bounds, enemy.x, enemy.y, enemy.r, enemy.aimX * stepLength, enemy.aimY * stepLength);
        if (vulnerable(sim, p) && !shielded() && Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.r + p.r) hurtPlayer(sim, enemy, events);
        if (progress >= 1) { enemy.openFor = def.chargeOpenMs; enemy.nextMove = "sweep"; enter("open"); events.push({ type: "seam-open", id: enemy.id }); }
        break;
      }
      case "open":
        if (elapsed + EPS >= enemy.openFor) { enemy.fromX = enemy.x; enemy.fromY = enemy.y; enter("reposition"); }
        break;
      default: break;
    }
  }
  // The help beat: hazards end, both actors stop, input is cleared by the mode.
  function porterPause(sim, enemy) {
    enemy.fromX = enemy.x; enemy.fromY = enemy.y;
    enemy.state = "reposition"; enemy.stateAt = sim.t;
    enemy.nextMove = "sweep";
    sim.player.act = null; sim.player.bufferUntil = -1;
  }

  function resolveFlare(sim, events) {
    const p = sim.player, act = p.act;
    if (flarePhase(act, sim.t) !== "active") return;
    const geo = geoOf(sim);
    for (const enemy of sim.enemies) {
      if (enemy.state === "gone" || enemy.state === "settled" || enemy.kind === "cargo" || act.hit.includes(enemy.id)) continue;
      const dx = enemy.x - p.x, dy = enemy.y - p.y, distance = Math.hypot(dx, dy);
      if (distance > T.FLARE_RANGE + enemy.r) continue;
      if (distance > enemy.r && (dx * act.fx + dy * act.fy) / distance < FLARE_COS) continue;
      if (!lineOfSight(geo, p.x, p.y, enemy.x, enemy.y)) continue;
      act.hit.push(enemy.id);
      if (enemy.kind === "porter" && enemy.state !== "open") { events.push({ type: "deflect", id: enemy.id }); continue; }
      enemy.hp = Math.max(0, round3(enemy.hp - T.FLARE_DAMAGE * sim.edges.power));
      enemy.flashUntil = sim.t + 140;
      enemy.aware = true;
      events.push({ type: "hit", id: enemy.id, hp: enemy.hp });
      if (enemy.kind === "porter") {
        if (enemy.hp <= 0) { enemy.state = "settled"; enemy.stateAt = sim.t; if (!sim.defeated.includes(enemy.id)) sim.defeated.push(enemy.id); events.push({ type: "porter-down", id: enemy.id }); }
        else if (enemy.hp <= C.ENEMIES.porter.helpAt && !flagOn(sim.flags, "porterHelp") && !enemy.helpAsked) { enemy.helpAsked = true; porterPause(sim, enemy); events.push({ type: "porter-half", id: enemy.id }); }
      } else if (enemy.hp <= 0) {
        enemy.state = "gone";
        enemy.goneAt = sim.t;
        if (!sim.cleared.includes(enemy.id)) sim.cleared.push(enemy.id);
        events.push({ type: "calmed", id: enemy.id });
      }
    }
  }

  // Keeps the opening's Rizo near the store: outward motion fades out near
  // the edge and he looks back instead of meeting an invisible wall.
  function applyLeash(geo, p, vx, vy) {
    const leash = geo.leash;
    if (!leash) return [vx, vy, false];
    const dx = p.x + vx - leash.x, dy = p.y + vy - leash.y, distance = Math.hypot(dx, dy);
    const soft = 22;
    if (distance <= leash.r - soft) return [vx, vy, false];
    const [ox, oy] = normalize(dx, dy);
    const outward = vx * ox + vy * oy;
    if (outward <= 0) return [vx, vy, false];
    const keep = clamp((leash.r - distance) / soft, 0, 1);
    return [vx - ox * outward * (1 - keep), vy - oy * outward * (1 - keep), keep < 0.6];
  }

  // One fixed step. `input` is the mode's semantic action state for this step:
  // { moveX, moveY, primaryHeld, primaryPressed, secondaryPressed }.
  function step(sim, input = {}) {
    const events = [];
    const p = sim.player;
    sim.t += STEP_MS;
    if (sim.phase === "down") {
      if (sim.t >= sim.downUntil) { sim.phase = "await-respawn"; events.push({ type: "respawn-ready" }); }
      return events;
    }
    if (sim.phase !== "play") return events;

    const moveX = clamp(finite(input.moveX), -1, 1), moveY = clamp(finite(input.moveY), -1, 1);
    // Finished actions end before new input is read.
    if (p.act?.kind === "flare" && flarePhase(p.act, sim.t) === "done") p.act = null;
    if (p.act?.kind === "kindle" && sim.t - p.act.start + EPS >= T.KINDLE_MS) {
      const { targetId, targetKind } = p.act;
      p.act = null;
      events.push({ type: "kindled", hearthId: targetKind === "hearth" ? targetId : undefined, targetId, targetKind });
    }

    // Secondary first: it wins when both become legal together.
    let tucked = false;
    if (input.secondaryPressed) {
      if (p.act?.kind === "kindle") { p.act = null; events.push({ type: "kindle-cancel" }); }
      else if (tuckLegal(sim)) { startTuck(sim, moveX, moveY, events); tucked = true; }
      else p.bufferUntil = sim.t + T.SECONDARY_BUFFER_MS;
    } else if (p.bufferUntil >= 0 && sim.t <= p.bufferUntil && tuckLegal(sim)) { startTuck(sim, moveX, moveY, events); tucked = true; }
    if (p.bufferUntil >= 0 && sim.t > p.bufferUntil) p.bufferUntil = -1;

    if (!tucked && !p.act) {
      const danger = encounterActive(sim);
      if (input.primaryPressed) {
        const target = danger ? null : focusTarget(sim);
        if (target?.kind === "hearth" || target?.kind === "warm") { p.act = { kind: "kindle", start: sim.t, targetId: target.id, targetKind: target.kind, hearthId: target.kind === "hearth" ? target.id : undefined }; events.push({ type: "kindle-start", hearthId: target.kind === "hearth" ? target.id : undefined, targetId: target.id, targetKind: target.kind }); }
        else if (target) events.push({ type: "interact", id: target.id, kind: target.kind });
        else startFlare(sim, events);
      } else if (input.primaryHeld && danger) startFlare(sim, events);
    }

    // Movement.
    const geo = geoOf(sim);
    const raw = room(sim.roomId);
    let vx = 0, vy = 0;
    let tuckDone = false;
    if (p.act?.kind === "tuck") {
      // Travel by elapsed progress so it covers exactly TUCK_DISTANCE.
      const progress = Math.min(1, (sim.t - p.act.start + EPS) / T.TUCK_MS);
      const delta = (progress - p.act.progress) * T.TUCK_DISTANCE;
      p.act.progress = progress;
      vx = p.act.dx * delta; vy = p.act.dy * delta;
      tuckDone = progress >= 1;
    } else if (p.act?.kind !== "kindle") {
      const [nx, ny] = normalize(moveX, moveY);
      const phase = flarePhase(p.act, sim.t);
      const factor = phase === "anticipation" || phase === "active" ? T.FLARE_MOVE_FACTOR : 1;
      const perStep = (T.MOVE_SPEED * sim.edges.speed * factor * STEP_MS) / 1000;
      vx = nx * perStep; vy = ny * perStep;
      if ((nx || ny) && !p.act) { p.fx = nx; p.fy = ny; }
    }
    const [lx, ly, leashed] = applyLeash(raw, p, vx, vy);
    vx = lx; vy = ly;
    if (leashed && !p.leashed) events.push({ type: "leash" });
    p.leashed = leashed;
    const beforeX = p.x, beforeY = p.y;
    if (vx || vy) [p.x, p.y] = moveCircle(geo, p.x, p.y, p.r, vx, vy);
    if (tuckDone) p.act = null;
    p.vx = p.x - beforeX; p.vy = p.y - beforeY;
    p.moving = Math.hypot(p.vx, p.vy) > 0.05;

    // The player's attack lands before any enemy attack in the same step.
    resolveFlare(sim, events);
    for (const enemy of sim.enemies) {
      if (enemy.state === "gone" || enemy.state === "settled") continue;
      if (enemy.kind === "draftling") updateDraftling(sim, enemy, events);
      else if (enemy.kind === "needle") updateNeedle(sim, enemy, events);
      else if (enemy.kind === "cargo") updateCargo(sim, enemy, events);
      else if (enemy.kind === "porter") updatePorter(sim, enemy, events);
      if (sim.phase !== "play") break;
    }
    if (sim.phase !== "play") return events;

    // Safe arrival at a hearth is reported once per approach.
    const near = Boolean(raw.hearth) && !encounterActive(sim) && Math.hypot(p.x - raw.hearth.x, p.y - raw.hearth.y) <= T.HEARTH_ARRIVAL;
    if (near && !sim.nearHearth) events.push({ type: "hearth-near", hearthId: raw.hearth.id });
    sim.nearHearth = near;
    // Trigger zones report entry; exits fire once the Rizo has stepped clear of them.
    const inside = (raw.zones || []).filter(zone => circleHitsRect(p.x, p.y, p.r, zone)).map(zone => zone.id);
    for (const id of inside) if (!sim.zones.includes(id)) events.push({ type: "zone", id });
    sim.zones = inside;
    const exit = (raw.exits || []).find(item => isOpen(item, sim.flags) && circleHitsRect(p.x, p.y, p.r, item));
    if (!exit) sim.exitArmed = true;
    else if (sim.exitArmed) { sim.exitArmed = false; events.push({ type: "exit", id: exit.id, to: exit.to, anchor: exit.anchor }); }
    return events;
  }

  // Death and rest both bring the leg back to a safe hearth: full Flame,
  // ordinary enemies return. Nothing durable is lost.
  function respawn(sim, { roomId, anchorId }) {
    const fresh = createSim({ roomId, anchorId, flame: T.FLAME_MAX, edges: sim.edges, assist: sim.assist, cleared: [], defeated: sim.defeated, flags: sim.flags });
    fresh.t = sim.t;
    return fresh;
  }
  function rest(sim) {
    sim.player.flame = T.FLAME_MAX;
    sim.cleared = [];
    sim.enemies = spawnEnemies(room(sim.roomId), [], sim.defeated);
    sim.player.bufferUntil = -1;
    return sim;
  }
  // Moving between rooms keeps the leg (cleared enemies stay cleared).
  function enterRoom(sim, { roomId, anchorId, flame }) {
    const next = createSim({ roomId, anchorId, flame: flame ?? sim.player.flame, edges: sim.edges, assist: sim.assist, cleared: sim.cleared, defeated: sim.defeated, flags: sim.flags });
    next.t = sim.t;
    next.player.fx = sim.player.fx; next.player.fy = sim.player.fy;
    next.player.tuckReadyAt = Math.min(sim.player.tuckReadyAt, sim.t);
    return next;
  }

  // ===== PAUSE HOLDS =====
  // A set of reasons; releasing one never releases another. External holds
  // also add "manual" so a fresh Resume is required before danger advances.
  const BACKGROUND_SUSPEND = Object.freeze(["background", "hidden", "pagehide", "freeze", "unload"]);
  const BACKGROUND_RESUME = Object.freeze(["visible", "pageshow", "resume"]);
  const PLAYER_RELEASABLE = Object.freeze(["manual", "performance", "update"]);
  function holdForSuspend(reason) {
    const name = String(reason || "");
    if (name === "ad") return "ad";
    if (name === "save-blocked") return "save-blocked";
    if (name === "force-update" || name === "update") return "update";
    if (name === "performance") return "performance";
    if (name === "manual") return "manual";
    return "background";
  }
  function holdForResume(reason) {
    const name = String(reason || "");
    if (name === "ad") return "ad";
    if (name === "save-blocked" || name === "force-update" || name === "update" || name === "manual" || name === "performance") return null;
    return "background";
  }
  function holdsSuspend(holds, reason) {
    const next = new Set(holds);
    const hold = holdForSuspend(reason);
    next.add(hold);
    next.add("manual");
    return [...next].sort();
  }
  function holdsResume(holds, reason) {
    const hold = holdForResume(reason);
    return hold ? [...holds].filter(item => item !== hold).sort() : [...holds].sort();
  }
  // The player's Resume clears only what the player may clear.
  function holdsPlayerResume(holds) { return [...holds].filter(item => !PLAYER_RELEASABLE.includes(item)).sort(); }
  const externalHolds = holds => holds.filter(item => !PLAYER_RELEASABLE.includes(item));

  // ===== SLICE =====
  const CAMPAIGN_ID = /^threshold-[a-z0-9]{4,24}$/;
  const STATUSES = ["active", "homecoming-ready", "complete"];
  const RESUME_KINDS = ["room-entry", "hearth", "respawn", "opening", "boss"];
  const LATCH_STATES = ["unmet", "trapped", "waiting-hearth", "helping", "gifted"];
  const SETTINGS_DEFAULTS = Object.freeze({ assist: false, textSpeed: "normal" });
  const ID_TOKEN = /^[a-z][a-z0-9-]{1,31}$/;
  const BEAT_TOKEN = /^[a-z][a-z0-9:-]{1,47}$/;
  function uniqueKnown(values, known, limit = 32) {
    return Array.isArray(values) ? [...new Set(values.filter(value => typeof value === "string" && known(value)))].slice(0, limit) : [];
  }
  const knownFlag = key => C.FLAGS.includes(key);
  function boolMap(raw, keep) {
    return isObject(raw) ? Object.fromEntries(Object.entries(raw).filter(([key, value]) => keep(key) && typeof value === "boolean").slice(0, 32)) : {};
  }
  function freshParts(pet, id, settings) {
    const start = room(C.START_ROOM);
    return {
      settings: { ...SETTINGS_DEFAULTS, ...(settings || {}) },
      campaign: { id, kind: C.CAMPAIGN_KIND, contentRevision: C.CONTENT_REVISION, petId: String(pet.id).slice(0, 80), petName: String(pet.name || "RIZO").slice(0, 14), status: "active", chapterId: C.CHAPTER_ID },
      world: { visitedRooms: [C.START_ROOM], openedShortcuts: [], durableRoomFlags: {}, defeatedEncounters: [] },
      story: { facts: {}, choices: {}, committedSceneBeats: [], resumeScene: null },
      npcs: { latch: { state: "unmet", locationAnchor: null, evidence: [] } },
      inventory: { knownLocalItems: [] },
      checkpoint: { hearthId: null, roomId: null, spawnAnchorId: null },
      continuation: { roomId: C.START_ROOM, safeAnchorId: start.entryAnchor, roomEntryFlame: T.FLAME_MAX, resumeKind: "opening" },
      legProfile: legProfile(pet),
      journal: { discoveredEntryIds: [] },
      pendingRewards: [],
      proofComplete: false,
      storyComplete: false
    };
  }
  function newCampaign({ pet, id }) {
    if (!pet?.id) throw new TypeError("a campaign needs the active pet");
    if (!CAMPAIGN_ID.test(id)) throw new TypeError("campaign id must look like threshold-xxxx");
    return freshParts(pet, id);
  }
  // A Gate 1 review campaign (one room, a review hearth, no story) is carried
  // into The Threshold explicitly: same campaign, pet, settings and journal,
  // starting at the opening because that story did not exist yet.
  function migrateGate1(data) {
    const campaign = data.campaign;
    const out = freshParts({ id: campaign.petId, name: campaign.petName, skills: {} }, campaign.id, isObject(data.settings) ? data.settings : {});
    out.campaign.petId = typeof campaign.petId === "string" ? campaign.petId.slice(0, 80) : "";
    out.journal.discoveredEntryIds = uniqueKnown(data.journal?.discoveredEntryIds, value => ID_TOKEN.test(value), 32);
    if (isObject(data.legProfile)) out.legProfile = { edges: normalizeEdges(data.legProfile.edges), bondBand: ["new", "familiar", "attached"].includes(data.legProfile.bondBand) ? data.legProfile.bondBand : "new", cues: { favoriteFoodId: null, favoriteGameId: null } };
    out.story.facts = {};
    out.story.committedSceneBeats = ["review:carried"];
    return out;
  }
  // An RC2 journey (threshold-v1) keeps everything: the same campaign, beats,
  // facts, choices, hearth and journal. The curb it may still name no longer
  // exists, so it becomes the car that replaced it; every other room and
  // anchor is unchanged. Committed beats decide on entry where it resumes, so
  // nothing committed is ever replayed.
  function migrateV1(data) {
    const out = plain(data);
    out.campaign = { ...out.campaign, contentRevision: C.CONTENT_REVISION };
    if (isObject(out.world) && Array.isArray(out.world.visitedRooms)) out.world.visitedRooms = [...new Set(out.world.visitedRooms.map(id => (id === "curb" ? C.START_ROOM : id)))];
    if (isObject(out.continuation) && out.continuation.roomId === "curb") out.continuation = { ...out.continuation, roomId: C.START_ROOM, safeAnchorId: room(C.START_ROOM).entryAnchor, resumeKind: "opening" };
    if (isObject(out.checkpoint) && out.checkpoint.roomId === "curb") out.checkpoint = { hearthId: null, roomId: null, spawnAnchorId: null };
    return out;
  }
  // Validates a stored slice on entry. Unknown locations fall back to a known
  // safe anchor; a campaign is never reset because of them. A revision this
  // build does not know is preserved untouched ("unsupported").
  function normalizeSlice(raw) {
    let data = isObject(raw) ? plain(raw) : {};
    const settings = { ...SETTINGS_DEFAULTS, ...(isObject(data.settings) ? data.settings : {}) };
    settings.assist = typeof settings.assist === "boolean" ? settings.assist : false;
    settings.textSpeed = settings.textSpeed === "instant" ? "instant" : "normal";
    if (!isObject(data.campaign)) return { status: "empty", data: { settings }, notes: [] };
    const notes = [];
    if (data.campaign.kind === C.CAMPAIGN_KIND && C.LEGACY_REVISIONS.includes(data.campaign.contentRevision) && CAMPAIGN_ID.test(String(data.campaign.id || ""))) {
      data = migrateGate1(data);
      notes.push("migrated-from-gate1");
    } else if (data.campaign.kind === C.CAMPAIGN_KIND && (C.CARRIED_REVISIONS || []).includes(data.campaign.contentRevision) && CAMPAIGN_ID.test(String(data.campaign.id || ""))) {
      data = migrateV1(data);
      notes.push("migrated-from-v1");
    }
    const campaign = data.campaign;
    if (campaign.kind !== C.CAMPAIGN_KIND || campaign.contentRevision !== C.CONTENT_REVISION || !CAMPAIGN_ID.test(String(campaign.id || ""))) return { status: "unsupported", data: plain(raw), notes: ["revision"] };
    const latch = isObject(data.npcs?.latch) ? data.npcs.latch : {};
    const out = {
      settings,
      campaign: {
        id: campaign.id, kind: C.CAMPAIGN_KIND, contentRevision: C.CONTENT_REVISION,
        petId: typeof campaign.petId === "string" ? campaign.petId.slice(0, 80) : "",
        petName: typeof campaign.petName === "string" ? campaign.petName.slice(0, 14) : "RIZO",
        status: STATUSES.includes(campaign.status) ? campaign.status : "active",
        chapterId: C.CHAPTER_ID
      },
      world: {
        visitedRooms: uniqueKnown(data.world?.visitedRooms, C.knownRoom, 16),
        openedShortcuts: uniqueKnown(data.world?.openedShortcuts, value => ID_TOKEN.test(value), 12),
        durableRoomFlags: boolMap(data.world?.durableRoomFlags, knownFlag),
        defeatedEncounters: uniqueKnown(data.world?.defeatedEncounters, C.knownEncounter, 32)
      },
      story: {
        facts: boolMap(data.story?.facts, knownFlag),
        choices: isObject(data.story?.choices) ? Object.fromEntries(Object.entries(data.story.choices).filter(([key, value]) => (C.CHOICES?.[key] || []).includes(value))) : {},
        committedSceneBeats: uniqueKnown(data.story?.committedSceneBeats, value => BEAT_TOKEN.test(value), 64),
        resumeScene: isObject(data.story?.resumeScene) && typeof data.story.resumeScene.id === "string" && typeof data.story.resumeScene.beatId === "string" && BEAT_TOKEN.test(data.story.resumeScene.id) ? { id: data.story.resumeScene.id.slice(0, 32), beatId: data.story.resumeScene.beatId.slice(0, 32) } : null
      },
      npcs: { latch: { state: LATCH_STATES.includes(latch.state) ? latch.state : "unmet", locationAnchor: typeof latch.locationAnchor === "string" ? latch.locationAnchor.slice(0, 40) : null, evidence: uniqueKnown(latch.evidence, value => ID_TOKEN.test(value), 12) } },
      inventory: { knownLocalItems: uniqueKnown(data.inventory?.knownLocalItems, value => ID_TOKEN.test(value), 16) },
      checkpoint: { hearthId: null, roomId: null, spawnAnchorId: null },
      continuation: null,
      legProfile: { edges: normalizeEdges(data.legProfile?.edges), bondBand: ["new", "familiar", "attached"].includes(data.legProfile?.bondBand) ? data.legProfile.bondBand : "new", cues: { favoriteFoodId: typeof data.legProfile?.cues?.favoriteFoodId === "string" ? data.legProfile.cues.favoriteFoodId.slice(0, 32) : null, favoriteGameId: typeof data.legProfile?.cues?.favoriteGameId === "string" ? data.legProfile.cues.favoriteGameId.slice(0, 32) : null } },
      journal: { discoveredEntryIds: uniqueKnown(data.journal?.discoveredEntryIds, value => ID_TOKEN.test(value), 32) },
      pendingRewards: Array.isArray(data.pendingRewards) ? data.pendingRewards.filter(item => isObject(item) && typeof item.receiptId === "string" && Array.isArray(item.entitlements)).slice(0, 4).map(item => ({ receiptId: item.receiptId.slice(0, 120), entitlements: item.entitlements.filter(id => typeof id === "string").slice(0, 4) })) : [],
      proofComplete: data.proofComplete === true,
      storyComplete: data.storyComplete === true
    };
    if (!out.campaign.petId) notes.push("pet-missing");
    if (!out.world.visitedRooms.length) out.world.visitedRooms = [C.START_ROOM];
    const checkpoint = data.checkpoint;
    if (isObject(checkpoint) && C.knownHearth(checkpoint.hearthId)) {
      const hearthRoom = C.hearthRoom(checkpoint.hearthId);
      out.checkpoint = { hearthId: checkpoint.hearthId, roomId: hearthRoom.id, spawnAnchorId: hearthRoom.hearth.spawnAnchorId };
    } else if (isObject(checkpoint) && checkpoint.hearthId) notes.push("checkpoint-unknown");
    const continuation = data.continuation;
    if (isObject(continuation) && C.knownAnchor(continuation.roomId, continuation.safeAnchorId)) {
      out.continuation = { roomId: continuation.roomId, safeAnchorId: continuation.safeAnchorId, roomEntryFlame: clamp(Math.round(finite(continuation.roomEntryFlame, T.FLAME_MAX)), 1, T.FLAME_MAX), resumeKind: RESUME_KINDS.includes(continuation.resumeKind) ? continuation.resumeKind : "room-entry" };
    } else {
      notes.push("continuation-repaired");
      const back = safeReturn(out);
      out.continuation = { roomId: back.roomId, safeAnchorId: back.anchorId, roomEntryFlame: T.FLAME_MAX, resumeKind: back.resumeKind };
    }
    const migrated = notes.includes("migrated-from-gate1") || notes.includes("migrated-from-v1");
    return { status: migrated ? "migrated" : notes.length ? "repaired" : "ok", data: out, notes };
  }
  const flagsOf = data => ({ ...(data?.world?.durableRoomFlags || {}), ...(data?.story?.facts || {}) });
  const belowReached = data => (data?.story?.committedSceneBeats || []).includes("opening:below");
  // Where a death returns the Rizo: the registered hearth, else where he landed.
  function safeReturn(data) {
    const checkpoint = data?.checkpoint;
    if (checkpoint?.hearthId && C.knownAnchor(checkpoint.roomId, checkpoint.spawnAnchorId)) return { roomId: checkpoint.roomId, anchorId: checkpoint.spawnAnchorId, resumeKind: "hearth" };
    if (belowReached(data)) return { roomId: C.BELOW_START, anchorId: room(C.BELOW_START).entryAnchor, resumeKind: "room-entry" };
    return { roomId: C.START_ROOM, anchorId: room(C.START_ROOM).entryAnchor, resumeKind: "opening" };
  }
  // Public facts for the shelf card and the hub's release/rebirth warning.
  function summary(raw) {
    const result = normalizeSlice(raw);
    const data = result.data;
    const base = { unit: "journey", entryLabel: "FREE", lengthLabel: "~10 MIN" };
    if (result.status === "empty") return { ...base, bestLabel: "NEW", badge: null, journey: null };
    if (result.status === "unsupported") return { ...base, bestLabel: "SAVED", badge: null, journey: null };
    const below = data.world.visitedRooms.filter(id => C.ROOM_IDS.includes(id)).length;
    const rows = data.world.visitedRooms.filter(id => (C.ROWS_ROOMS || []).includes(id)).length;
    // A proof journey that walked home is complete. In the campaign edition the
    // Porter's door leads on, so the First Knot alone no longer means "home".
    const complete = data.campaign.status === "complete";
    return {
      ...base,
      bestLabel: rows ? `ROWS ${rows}/${C.ROWS_ROOMS.length}` : complete ? "HOME" : below ? `ROOM ${below}/${C.ROOM_IDS.length}` : "OUTSIDE",
      badge: complete || data.proofComplete === true ? { text: "KNOT", title: complete ? "Came home from The Threshold" : "Carries Latch's First Knot" } : data.checkpoint.hearthId ? { text: "HEARTH", title: "A hearth remembers this Rizo" } : null,
      journey: { petId: data.campaign.petId, petName: data.campaign.petName, status: data.campaign.status, complete }
    };
  }

  return Object.freeze({
    T,
    FLARE_TOTAL_MS,
    STEP_MS,
    edges,
    normalizeEdges,
    legProfile,
    room,
    moveCircle,
    lineOfSight,
    circleHitsRect,
    distanceToSegment,
    createSim,
    step,
    respawn,
    rest,
    enterRoom,
    spawnCargo,
    porterPause,
    inAlcove,
    present,
    isOpen,
    geoOf,
    rayLength,
    flagsOf,
    belowReached,
    flarePhase,
    tuckLegal,
    encounterActive,
    liveEnemies,
    focusTarget,
    interactables,
    BACKGROUND_SUSPEND,
    BACKGROUND_RESUME,
    holdForSuspend,
    holdForResume,
    holdsSuspend,
    holdsResume,
    holdsPlayerResume,
    externalHolds,
    SETTINGS_DEFAULTS,
    newCampaign,
    normalizeSlice,
    safeReturn,
    summary
  });
});
