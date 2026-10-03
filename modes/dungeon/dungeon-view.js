/*
  RIZO DUNGEON — VIEW
  ===================
  The handheld (Rizo Field Unit / BELOW) and what its screen shows.

  Canvas paints the room, props, the Draftling and effects. The player's Rizo
  is never painted here: a DOM actor plane above the canvas holds the hub's
  canonical pet markup (host.petMarkup), moved by an outer pose wrapper. Text
  (prompts, dialogue, panels) is DOM so it stays crisp and unscaled.

  Every telegraph has a shape cue (dashes become a solid lane with chevrons,
  the body squashes and droops), never colour or sound alone.
*/
(function initRizoDungeonView(root, factory) {
  const api = factory(root?.RizoDungeonCore || null, root?.RizoDungeonContent || null);
  if (root) Object.defineProperty(root, "RizoDungeonView", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonView(Core, Content) {
  "use strict";

  const CAMERA_WIDTH = 320;
  const DPR_CAP = 2;
  const MAX_EFFECTS = 12;
  // The actor box; the sprite inside it reads as roughly 28–31 units tall.
  const ACTOR_UNITS = 34;
  const STAGE_SCALE = { spark: 0.82, kid: 0.9, teen: 0.96, beast: 1, legend: 1.04 };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function deviceMarkup() {
    return `<div class="dungeon-device" data-phase="enter">
  <div class="dungeon-shell">
    <div class="dungeon-bezel">
      <div class="dungeon-slot">
      <div class="dungeon-screen" aria-label="Rizo Dungeon screen">
        <canvas class="dungeon-canvas" aria-hidden="true"></canvas>
        <div class="dungeon-actors" aria-hidden="true"><div class="dungeon-actor"><div class="dungeon-pose"></div></div></div>
        <div class="dungeon-hud" aria-hidden="true"><span class="dungeon-flame"></span><b class="dungeon-room-name"></b></div>
        <div class="dungeon-prompt" hidden aria-hidden="true"></div>
        <div class="dungeon-cue" hidden aria-hidden="true"></div>
        <div class="dungeon-banner" hidden aria-live="polite"></div>
        <div class="dungeon-dialogue" data-dungeon-ui hidden role="dialog" aria-live="polite"><p class="dungeon-line"></p><span class="dungeon-more" aria-hidden="true"></span></div>
        <div class="dungeon-fade" aria-hidden="true"></div>
        <div class="dungeon-panel" data-dungeon-ui hidden role="dialog" aria-modal="false"></div>
      </div>
      </div>
      <div class="dungeon-brand" aria-hidden="true"><i class="dungeon-led"></i><span>RIZO FIELD UNIT</span><em>/ BELOW</em></div>
    </div>
    <div class="dungeon-deck">
      <div class="dungeon-dpad" role="group" aria-label="Move" data-dir="none"><i class="arm arm-up"></i><i class="arm arm-down"></i><i class="arm arm-left"></i><i class="arm arm-right"></i><i class="hub"></i></div>
      <div class="dungeon-actions">
        <button type="button" class="dungeon-key dungeon-key-secondary" data-dungeon-key="secondary" aria-label="Tuck (X)"><i aria-hidden="true"></i><b>TUCK</b><small>X</small></button>
        <button type="button" class="dungeon-key dungeon-key-primary" data-dungeon-key="primary" aria-label="Flare or use (Z)"><i aria-hidden="true"></i><b>FLARE</b><small>Z</small></button>
      </div>
      <button type="button" class="dungeon-key dungeon-key-system" data-dungeon-key="system" aria-label="Menu (Escape)"><i aria-hidden="true"></i><small>MENU</small></button>
    </div>
  </div>
</div>`;
  }

  function create({ arena, host, reducedMotion = false }) {
    arena.innerHTML = deviceMarkup();
    const $ = selector => arena.querySelector(selector);
    const el = {
      device: $(".dungeon-device"), slot: $(".dungeon-slot"), screen: $(".dungeon-screen"), canvas: $(".dungeon-canvas"), actors: $(".dungeon-actors"),
      actor: $(".dungeon-actor"), pose: $(".dungeon-pose"), hud: $(".dungeon-hud"), flame: $(".dungeon-flame"), roomName: $(".dungeon-room-name"),
      prompt: $(".dungeon-prompt"), cue: $(".dungeon-cue"), banner: $(".dungeon-banner"), dialogue: $(".dungeon-dialogue"), line: $(".dungeon-line"), more: $(".dungeon-more"),
      fade: $(".dungeon-fade"), panel: $(".dungeon-panel"), dpad: $(".dungeon-dpad"),
      keys: { primary: $('[data-dungeon-key="primary"]'), secondary: $('[data-dungeon-key="secondary"]'), system: $('[data-dungeon-key="system"]') }
    };
    const ctx = el.canvas.getContext("2d");
    const metrics = { cssW: 0, cssH: 0, dpr: 1, scale: 1, viewW: CAMERA_WIDTH, viewH: 200 };
    const camera = { x: 0, y: 0, ready: false };
    const effects = [];
    let actorUnits = ACTOR_UNITS, lastFlame = -1, lastDir = "", lastKeys = "";

    // The screen takes the space the device leaves it, within an aspect cap
    // (never taller than ~1.5x its width, never flatter than ~0.56x).
    function layout() {
      const slot = el.slot.getBoundingClientRect();
      let cssW = Math.max(1, Math.floor(Math.min(slot.width, 900))), cssH = Math.max(1, Math.floor(slot.height));
      if (cssH > cssW * 1.5) cssH = Math.floor(cssW * 1.5);
      if (cssH < cssW * 0.56) cssW = Math.floor(cssH / 0.56);
      el.screen.style.width = `${cssW}px`;
      el.screen.style.height = `${cssH}px`;
      const dpr = Math.min(DPR_CAP, Math.max(1, globalThis.devicePixelRatio || 1));
      const changed = cssW !== metrics.cssW || cssH !== metrics.cssH || dpr !== metrics.dpr;
      if (!changed) return false;
      Object.assign(metrics, { cssW, cssH, dpr, scale: cssW / CAMERA_WIDTH, viewW: CAMERA_WIDTH, viewH: cssH / (cssW / CAMERA_WIDTH) });
      el.canvas.width = Math.round(cssW * dpr);
      el.canvas.height = Math.round(cssH * dpr);
      el.canvas.style.width = `${cssW}px`;
      el.canvas.style.height = `${cssH}px`;
      camera.ready = false;
      sizeActor();
      return true;
    }

    // ---- the canonical Rizo
    function setPet(snapshot) {
      actorUnits = ACTOR_UNITS * (STAGE_SCALE[snapshot?.stage] || 1);
      el.pose.innerHTML = snapshot ? host.petMarkup(snapshot, { context: "dungeon", extraClass: "dungeon-rizo", label: `${snapshot.name}` }) : "";
      sizeActor();
    }
    function sizeActor() {
      const size = Math.round(actorUnits * metrics.scale);
      el.actor.style.width = `${size}px`;
      el.actor.style.height = `${size}px`;
    }

    // ---- camera
    function follow(px, py, roomGeo, dt) {
      const maxX = roomGeo.w - metrics.viewW, maxY = roomGeo.h - metrics.viewH;
      const targetX = maxX <= 0 ? maxX / 2 : Math.min(maxX, Math.max(0, px - metrics.viewW / 2));
      const targetY = maxY <= 0 ? maxY / 2 : Math.min(maxY, Math.max(0, py - metrics.viewH * 0.55));
      if (!camera.ready) { camera.x = targetX; camera.y = targetY; camera.ready = true; return; }
      const k = reducedMotion ? 1 : Math.min(1, dt * 7);
      camera.x += (targetX - camera.x) * k;
      camera.y += (targetY - camera.y) * k;
    }
    const toScreen = (x, y) => [(x - camera.x) * metrics.scale, (y - camera.y) * metrics.scale];

    // ---- canvas painting (world units)
    function paintRoom(geo, sim, time) {
      const pal = geo.palette;
      ctx.fillStyle = "#050404";
      ctx.fillRect(camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      ctx.fillStyle = pal.floor;
      ctx.fillRect(0, 0, geo.w, geo.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, geo.w, geo.h); ctx.clip();
      ctx.strokeStyle = pal.floorLine;
      ctx.lineWidth = 1;
      for (let y = 30; y < geo.h; y += 22) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(geo.w - 20, y); ctx.stroke(); }
      for (let row = 0, y = 30; y < geo.h; y += 22, row += 1) for (let x = 20 + (row % 2) * 34; x < geo.w; x += 68) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
      ctx.restore();
      for (const rect of geo.solids) {
        if (rect.kind === "wall") {
          ctx.fillStyle = pal.wall; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.fillStyle = pal.wallEdge;
          if (rect.y + rect.h < geo.h && rect.h < 40) ctx.fillRect(rect.x, rect.y + rect.h - 3, rect.w, 3);
        } else if (rect.kind === "door") {
          ctx.fillStyle = pal.door; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.strokeStyle = pal.doorEdge; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 3);
          ctx.beginPath(); ctx.moveTo(rect.x + rect.w / 2, rect.y + 3); ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h - 2); ctx.stroke();
        } else if (rect.kind === "crate") {
          ctx.fillStyle = pal.crate; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.strokeStyle = pal.crateEdge; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
          ctx.beginPath(); ctx.moveTo(rect.x + 3, rect.y + 3); ctx.lineTo(rect.x + rect.w - 3, rect.y + rect.h - 3); ctx.moveTo(rect.x + rect.w - 3, rect.y + 3); ctx.lineTo(rect.x + 3, rect.y + rect.h - 3); ctx.stroke();
          ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(rect.x, rect.y + rect.h, rect.w, 4);
        } else if (rect.kind === "pipe") {
          ctx.fillStyle = pal.pipe; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.fillStyle = pal.pipeEdge; ctx.fillRect(rect.x + rect.w - 4, rect.y, 4, rect.h);
          for (let y = rect.y + 8; y < rect.y + rect.h; y += 18) ctx.fillRect(rect.x - 2, y, rect.w + 4, 3);
        } else {
          ctx.fillStyle = pal.shelf; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(rect.x, rect.y + rect.h, rect.w, 5);
          ctx.fillStyle = "#7a6a52"; for (let x = rect.x + 6; x < rect.x + rect.w - 4; x += 14) ctx.fillRect(x, rect.y - 5, 8, 5);
        }
      }
      // The way back: a shutter set into the south wall.
      ctx.fillStyle = "#29231d"; ctx.fillRect(34, geo.h - 20, 36, 18);
      ctx.strokeStyle = "#4b4034"; ctx.lineWidth = 1;
      for (let y = geo.h - 17; y < geo.h - 3; y += 4) { ctx.beginPath(); ctx.moveTo(36, y); ctx.lineTo(68, y); ctx.stroke(); }
      for (const prop of geo.props) {
        if (prop.id === "ticket-stub") {
          ctx.save(); ctx.translate(prop.x, prop.y); ctx.rotate(-0.25);
          ctx.fillStyle = "#e6dcc2"; ctx.fillRect(-5, -3, 10, 6);
          ctx.fillStyle = "#1a1714"; ctx.beginPath(); ctx.arc(-2, 0, 1, 0, Math.PI * 2); ctx.arc(2, 0, 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      if (geo.hearth) paintHearth(geo, sim, time);
    }
    function paintHearth(geo, sim, time) {
      const h = geo.hearth, lit = Boolean(sim?.hearthLit);
      ctx.fillStyle = "#2f2a25"; ctx.beginPath(); ctx.ellipse(h.x, h.y + 3, h.r + 4, h.r * 0.7 + 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b6156";
      for (let index = 0; index < 8; index += 1) { const a = (index / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * (h.r + 2), h.y + 3 + Math.sin(a) * (h.r * 0.7 + 1), 2.4, 0, Math.PI * 2); ctx.fill(); }
      const flicker = reducedMotion ? 0 : Math.sin(time / 90) * 0.8 + Math.sin(time / 37) * 0.5;
      const size = lit ? 7 + flicker : 3 + flicker * 0.4;
      ctx.fillStyle = lit ? "#ff9a3c" : "#7a3a1c";
      ctx.beginPath(); ctx.moveTo(h.x - size * 0.7, h.y + 3); ctx.quadraticCurveTo(h.x - size * 0.5, h.y - size * 0.6, h.x, h.y - size * 1.4); ctx.quadraticCurveTo(h.x + size * 0.5, h.y - size * 0.6, h.x + size * 0.7, h.y + 3); ctx.closePath(); ctx.fill();
      if (lit) { ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(h.x, h.y, size * 0.25, size * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    function paintLane(enemy, def) {
      const length = def.lungeDistance + enemy.r + 6;
      const ex = enemy.x + enemy.aimX * length, ey = enemy.y + enemy.aimY * length;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = enemy.locked ? "rgba(255,236,200,.9)" : "rgba(220,214,200,.55)";
      ctx.lineWidth = enemy.locked ? 3 : 2;
      ctx.setLineDash(enemy.locked ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(enemy.x + enemy.aimX * enemy.r, enemy.y + enemy.aimY * enemy.r); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      if (enemy.locked) {
        // Chevrons along the committed line; a bar marks where it stops.
        const px = -enemy.aimY, py = enemy.aimX;
        for (let d = 16; d < length; d += 14) {
          const cx = enemy.x + enemy.aimX * d, cy = enemy.y + enemy.aimY * d;
          ctx.beginPath(); ctx.moveTo(cx - enemy.aimX * 4 + px * 4, cy - enemy.aimY * 4 + py * 4); ctx.lineTo(cx, cy); ctx.lineTo(cx - enemy.aimX * 4 - px * 4, cy - enemy.aimY * 4 - py * 4); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(ex + px * 6, ey + py * 6); ctx.lineTo(ex - px * 6, ey - py * 6); ctx.stroke();
      }
      ctx.restore();
    }
    function paintDraftling(enemy, sim, time) {
      const def = Content.ENEMIES.draftling;
      if (enemy.state === "gone") {
        const age = sim.t - enemy.goneAt;
        if (age > 500) return;
        ctx.save(); ctx.globalAlpha = 1 - age / 500;
        ctx.translate(enemy.x, enemy.y - age * 0.03);
        ctx.fillStyle = "#d9d3c4";
        ctx.beginPath(); ctx.ellipse(0, 0, enemy.r * (1 + age / 900), enemy.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
      if (enemy.state === "windup") paintLane(enemy, def);
      const elapsed = sim.t - enemy.stateAt;
      let sx = 1, sy = 1, sway = reducedMotion ? 0 : Math.sin(time / 260 + enemy.homeX) * 0.12, droop = 0;
      if (enemy.state === "windup") { const k = Math.min(1, elapsed / (def.windupMs * (sim.assist ? Core.T.ASSIST_ANTICIPATION : 1))); sx = 1 + 0.35 * k; sy = 1 - 0.3 * k; sway = 0; }
      else if (enemy.state === "lunge") { sx = 0.7; sy = 1.35; sway = 0; }
      else if (enemy.state === "recover") { sx = 1.25; sy = 0.62; droop = 3; sway = 0; }
      const angle = Math.atan2(enemy.aimY, enemy.aimX);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y + enemy.r + 2, enemy.r, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(enemy.x, enemy.y + droop);
      if (enemy.state === "lunge") ctx.rotate(angle - Math.PI / 2);
      ctx.rotate(sway);
      ctx.scale(sx, sy);
      const flash = sim.t < enemy.flashUntil;
      // A loose sheet of draft: ragged lower hem, two slit eyes.
      ctx.fillStyle = flash ? "#ffffff" : "#cfd6dc";
      ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-enemy.r, 2);
      ctx.quadraticCurveTo(-enemy.r, -enemy.r - 2, 0, -enemy.r - 2);
      ctx.quadraticCurveTo(enemy.r, -enemy.r - 2, enemy.r, 2);
      const wave = reducedMotion ? 0 : Math.sin(time / 120) * 1.5;
      ctx.lineTo(enemy.r * 0.6, enemy.r + wave); ctx.lineTo(enemy.r * 0.2, enemy.r * 0.55); ctx.lineTo(-enemy.r * 0.2, enemy.r - wave); ctx.lineTo(-enemy.r * 0.6, enemy.r * 0.55); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0b0d10";
      if (enemy.state === "recover") { ctx.fillRect(-4.5, -2, 3.5, 1.2); ctx.fillRect(1, -2, 3.5, 1.2); }
      else { ctx.fillRect(-4.5, -4, 3, enemy.state === "windup" ? 1.2 : 2.4); ctx.fillRect(1.5, -4, 3, enemy.state === "windup" ? 1.2 : 2.4); }
      ctx.restore();
      if (enemy.state === "recover") {
        // Open: small loose curls above it say "now".
        ctx.save(); ctx.strokeStyle = "rgba(230,224,210,.85)"; ctx.lineWidth = 1.2;
        for (let index = -1; index <= 1; index += 2) { ctx.beginPath(); ctx.arc(enemy.x + index * 5, enemy.y - enemy.r - 6 + droop, 2.5, 0, Math.PI * 1.5); ctx.stroke(); }
        ctx.restore();
      }
      // Two notches: the two clean Flares it takes.
      if (enemy.aware) {
        const hits = Math.ceil(enemy.hp / 2), max = Math.ceil(enemy.maxHp / 2);
        for (let index = 0; index < max; index += 1) { ctx.fillStyle = index < hits ? "#e9dfc7" : "rgba(233,223,199,.25)"; ctx.fillRect(enemy.x - 5 + index * 6, enemy.y - enemy.r - 12 + droop, 4, 2); }
      }
    }
    function paintFlare(sim) {
      const p = sim.player, act = p.act;
      const phase = Core.flarePhase(act, sim.t);
      if (!phase || phase === "done") return;
      const angle = Math.atan2(act.fy, act.fx), half = (Core.T.FLARE_ARC_DEG / 2) * Math.PI / 180;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (phase === "anticipation") {
        const k = (sim.t - act.start) / Core.T.FLARE_ANTICIPATION_MS;
        ctx.fillStyle = "rgba(255,170,80,.45)";
        ctx.beginPath(); ctx.arc(act.fx * 8, act.fy * 8, 2 + k * 3, 0, Math.PI * 2); ctx.fill();
      } else {
        const k = phase === "active" ? 1 : 1 - (sim.t - act.start - Core.T.FLARE_ANTICIPATION_MS - Core.T.FLARE_ACTIVE_MS) / Core.T.FLARE_RECOVERY_MS;
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = phase === "active" ? "rgba(255,190,90,.75)" : "rgba(255,150,70,.35)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Core.T.FLARE_RANGE, angle - half, angle + half); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,200,.9)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, Core.T.FLARE_RANGE, angle - half, angle + half); ctx.stroke();
      }
      ctx.restore();
    }
    // Kindle progress: a ring closing around the hearth (shape, not colour).
    function paintKindle(sim, geo) {
      const act = sim.player.act;
      if (act?.kind !== "kindle" || !geo.hearth) return;
      const k = Math.min(1, (sim.t - act.start) / Core.T.KINDLE_MS);
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,160,.9)"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(geo.hearth.x, geo.hearth.y, geo.hearth.r + 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function paintEffects(time) {
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const fx = effects[index], age = (time - fx.at) / fx.life;
        if (age >= 1) { effects.splice(index, 1); continue; }
        ctx.save(); ctx.globalAlpha = 1 - age;
        if (fx.kind === "spark") { ctx.fillStyle = "#ffcf7a"; ctx.fillRect(fx.x + fx.vx * age * 14 - 1, fx.y + fx.vy * age * 14 - 1, 2, 2); }
        else if (fx.kind === "puff") { ctx.strokeStyle = "rgba(220,214,200,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(fx.x, fx.y, 3 + age * 8, 0, Math.PI * 2); ctx.stroke(); }
        else if (fx.kind === "deflect") { ctx.strokeStyle = "rgba(230,230,230,.8)"; ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + age * 6, 0, Math.PI); ctx.stroke(); }
        ctx.restore();
      }
    }
    function addEffect(kind, x, y, count = 1, time = performance.now()) {
      for (let index = 0; index < count; index += 1) {
        if (effects.length >= MAX_EFFECTS) effects.shift();
        const angle = Math.random() * Math.PI * 2;
        effects.push({ kind, x, y, vx: Math.cos(angle), vy: Math.sin(angle), at: time, life: kind === "spark" ? 360 : 420 });
      }
    }
    function paintWarmth(px, py) {
      // The Rizo's flame lights the room around it.
      const [sx, sy] = [px, py];
      const gradient = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,.38)");
      ctx.fillStyle = gradient;
      ctx.fillRect(camera.x - 20, camera.y - 20, metrics.viewW + 40, metrics.viewH + 40);
    }

    // Draws one frame. `pos` is the interpolated player position.
    function render(sim, pos, time, dt) {
      const geo = Core.room(sim.roomId);
      if (!geo || !metrics.cssW) return;
      follow(pos.x, pos.y, geo, dt);
      const s = metrics.scale * metrics.dpr;
      ctx.setTransform(s, 0, 0, s, -camera.x * s, -camera.y * s);
      paintRoom(geo, sim, time);
      for (const enemy of sim.enemies) paintDraftling(enemy, sim, time);
      paintFlare(sim);
      paintKindle(sim, geo);
      paintEffects(time);
      paintWarmth(pos.x, pos.y);
      // The DOM actor follows the same camera.
      const [ax, ay] = toScreen(pos.x, pos.y + Core.T.PLAYER_RADIUS * 0.6);
      const size = actorUnits * metrics.scale;
      el.actor.style.transform = `translate3d(${(ax - size / 2).toFixed(1)}px, ${(ay - size * 0.84).toFixed(1)}px, 0)`;
    }
    function setPose(classes) {
      const next = `dungeon-pose ${classes}`.trim();
      if (el.pose.className !== next) el.pose.className = next;
    }
    function setFlame(flame, max) {
      if (flame === lastFlame) return;
      lastFlame = flame;
      el.flame.innerHTML = Array.from({ length: max }, (_, index) => `<i class="${index < flame ? "lit" : "spent"}"></i>`).join("");
      el.flame.setAttribute("aria-label", `Flame ${flame} of ${max}`);
    }
    function setRoomName(name) { el.roomName.textContent = name; }
    function setKeys(state) {
      if (state.dir !== lastDir) { el.dpad.dataset.dir = state.dir; lastDir = state.dir; }
      const signature = `${state.primary}${state.secondary}${state.system}`;
      if (signature === lastKeys) return;
      lastKeys = signature;
      el.keys.primary.classList.toggle("is-down", state.primary);
      el.keys.secondary.classList.toggle("is-down", state.secondary);
      el.keys.system.classList.toggle("is-down", state.system);
    }
    function setActionLabel(label) {
      const node = el.keys.primary.querySelector("b");
      if (node.textContent !== label) node.textContent = label;
    }
    function showPrompt(target, label) {
      if (!target) { if (!el.prompt.hidden) el.prompt.hidden = true; return; }
      const [x, y] = toScreen(target.x, target.y - target.r - 6);
      el.prompt.hidden = false;
      el.prompt.textContent = label;
      el.prompt.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    }
    function showCue(markup) { if (!markup) { el.cue.hidden = true; el.cue.innerHTML = ""; return; } el.cue.innerHTML = markup; el.cue.hidden = false; }
    function banner(text) { el.banner.textContent = text || ""; el.banner.hidden = !text; }
    function dialogue(text, { done = false } = {}) {
      if (text === null) { el.dialogue.hidden = true; el.line.textContent = ""; return; }
      el.dialogue.hidden = false;
      el.line.textContent = text;
      el.more.textContent = done ? "▼" : "";
    }
    function panel(markup) {
      if (!markup) { el.panel.hidden = true; el.panel.innerHTML = ""; el.device.classList.remove("panel-open"); return; }
      el.panel.innerHTML = markup;
      el.panel.hidden = false;
      el.device.classList.add("panel-open");
      el.panel.querySelector("button")?.focus({ preventScroll: true });
    }
    function setFade(value) { el.fade.style.opacity = String(value); }
    function setPhase(phase) { el.device.dataset.phase = phase; }
    function destroy() { effects.length = 0; arena.innerHTML = ""; }

    layout();
    return { el, layout, setPet, render, setPose, setFlame, setRoomName, setKeys, setActionLabel, showPrompt, showCue, banner, dialogue, panel, setFade, setPhase, addEffect, toScreen, metrics, camera, destroy, esc };
  }

  return Object.freeze({ create, CAMERA_WIDTH, DPR_CAP, esc });
});
