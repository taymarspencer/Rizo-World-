/*
  RIZO DUNGEON — VIEW
  ===================
  The handheld (Rizo Field Unit / BELOW) and what its screen shows.

  Canvas paints rooms, props, NPC cutouts, enemies, weather and light. The
  player's Rizo is never painted here: a DOM actor plane above the canvas
  holds the hub's canonical pet markup (host.petMarkup), moved by an outer
  pose wrapper. Text (prompts, speech, dialogue with portraits, choices,
  panels) is DOM so it stays crisp and unscaled.

  Visual grammar (for later authored art to replace piece by piece):
  background (beyond the room) → floor → props/walls with contact shadows →
  actors → weather → light (the Rizo's flame warms what is near it).
  Every telegraph has a shape cue (dashes become solid, chevrons, a band, a
  body that squashes or opens), never colour or sound alone.

  The shell has three states: "open" (the opening, outside: no bezel, the
  world fills the frame, controls float), "locking" (the rails click in,
  ~560 ms) and "locked" (the Rizo Field Unit).
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
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  function deviceMarkup() {
    return `<div class="dungeon-device" data-phase="enter" data-shell="locked">
  <div class="dungeon-shell">
    <i class="dungeon-rail dungeon-rail-l" aria-hidden="true"></i><i class="dungeon-rail dungeon-rail-r" aria-hidden="true"></i>
    <div class="dungeon-bezel">
      <div class="dungeon-slot">
      <div class="dungeon-screen" aria-label="Rizo Dungeon screen">
        <canvas class="dungeon-canvas" aria-hidden="true"></canvas>
        <div class="dungeon-actors" aria-hidden="true"><div class="dungeon-actor"><div class="dungeon-pose"></div></div></div>
        <div class="dungeon-barks" aria-live="polite"></div>
        <div class="dungeon-hud" aria-hidden="true"><span class="dungeon-flame"></span><b class="dungeon-room-name"></b></div>
        <div class="dungeon-prompt" hidden aria-hidden="true"></div>
        <div class="dungeon-cue" hidden aria-hidden="true"></div>
        <div class="dungeon-banner" hidden aria-live="polite"></div>
        <div class="dungeon-dialogue" data-dungeon-ui hidden role="dialog" aria-live="polite"><div class="dungeon-portrait" aria-hidden="true"></div><div class="dungeon-speech"><b class="dungeon-speaker"></b><p class="dungeon-line"></p></div><span class="dungeon-more" aria-hidden="true"></span></div>
        <div class="dungeon-choice" data-dungeon-ui hidden role="group" aria-label="Choose"></div>
        <div class="dungeon-fade" aria-hidden="true"></div>
        <div class="dungeon-panel" data-dungeon-ui hidden role="dialog" aria-modal="false"></div>
      </div>
      </div>
      <div class="dungeon-brand" aria-hidden="true"><i class="dungeon-led"></i><span>RIZO FIELD UNIT</span><em>/ BELOW</em><u class="dungeon-tape"></u></div>
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
      portrait: $(".dungeon-portrait"), speaker: $(".dungeon-speaker"), choice: $(".dungeon-choice"), barks: $(".dungeon-barks"),
      fade: $(".dungeon-fade"), panel: $(".dungeon-panel"), dpad: $(".dungeon-dpad"),
      keys: { primary: $('[data-dungeon-key="primary"]'), secondary: $('[data-dungeon-key="secondary"]'), system: $('[data-dungeon-key="system"]') }
    };
    const ctx = el.canvas.getContext("2d");
    const metrics = { cssW: 0, cssH: 0, dpr: 1, scale: 1, viewW: CAMERA_WIDTH, viewH: 200 };
    const camera = { x: 0, y: 0, ready: false };
    const effects = [];
    const barkNodes = new Map();
    let actorUnits = ACTOR_UNITS, lastFlame = -1, lastDir = "", lastKeys = "", lastPortrait = "";

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
    function follow(px, py, roomGeo, dt, peek) {
      const maxX = roomGeo.w - metrics.viewW, maxY = roomGeo.h - metrics.viewH;
      const fx = peek ? peek.x : px, fy = peek ? peek.y + metrics.viewH * 0.3 : py;
      const targetX = maxX <= 0 ? maxX / 2 : Math.min(maxX, Math.max(0, fx - metrics.viewW / 2));
      const targetY = maxY <= 0 ? maxY / 2 : Math.min(maxY, Math.max(0, fy - metrics.viewH * 0.55));
      if (!camera.ready) { camera.x = targetX; camera.y = targetY; camera.ready = true; return; }
      const k = reducedMotion ? 1 : Math.min(1, dt * (peek ? 3 : 7));
      camera.x += (targetX - camera.x) * k;
      camera.y += (targetY - camera.y) * k;
    }
    const toScreen = (x, y) => [(x - camera.x) * metrics.scale, (y - camera.y) * metrics.scale];

    // ---- small drawing helpers (world units)
    const fill = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const shadow = (x, y, rx, ry = rx * 0.34, alpha = 0.38) => { ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    function glow(x, y, r, color, alpha) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, color.replace("ALPHA", String(alpha)));
      gradient.addColorStop(1, color.replace("ALPHA", "0"));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function poly(points, color, stroke = null, width = 1.4) {
      ctx.beginPath(); ctx.moveTo(points[0], points[1]);
      for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    const inShelter = (geo, x, y) => (geo.shelters || []).some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
    function rain(geo, time, intensity, wind = 0.25) {
      if (intensity <= 0 || reducedMotion) return;
      const count = Math.round(70 * intensity);
      ctx.strokeStyle = "rgba(190,205,225,.42)"; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let index = 0; index < count; index += 1) {
        const speed = 0.42 + hash(index) * 0.2;
        const x = camera.x + ((hash(index + 9) * metrics.viewW * 1.2 + time * speed * wind) % (metrics.viewW * 1.2)) - metrics.viewW * 0.1;
        const y = camera.y + ((hash(index + 3) * (metrics.viewH + 40) + time * speed) % (metrics.viewH + 40)) - 20;
        if (inShelter(geo, x, y)) continue;
        ctx.moveTo(x, y); ctx.lineTo(x - 2.5 * wind * 4, y - 9);
      }
      ctx.stroke();
      // Rings where drops land on wet ground.
      ctx.strokeStyle = "rgba(190,205,225,.22)";
      for (let index = 0; index < Math.round(10 * intensity); index += 1) {
        const k = ((time / 600) + hash(index + 40)) % 1;
        const x = camera.x + hash(index + 51) * metrics.viewW, y = camera.y + hash(index + 77) * metrics.viewH;
        if (inShelter(geo, x, y)) continue;
        ctx.beginPath(); ctx.ellipse(x, y, 1 + k * 4, (1 + k * 4) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ===== ROOM PAINTERS =====
    function paintCurb(geo, sim, time, extras) {
      const room = extras.room || {};
      fill("#0b0d12", camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      // Beyond the room the street goes on: the far curb, a parked car's glow.
      fill("#15171b", camera.x - 40, 238, metrics.viewW + 80, 400);
      fill("#55585e", camera.x - 40, 330, metrics.viewW + 80, 5);
      fill("#26282e", camera.x - 40, 335, metrics.viewW + 80, 300);
      glow(70, 360, 60, "rgba(255,210,150,ALPHA)", 0.08);
      // Storefront: warm fluorescent windows against the dark.
      fill("#1b1d23", 0, 0, geo.w, 96);
      for (const [x, w] of [[30, 112], [214, 116]]) {
        const gradient = ctx.createLinearGradient(0, 22, 0, 90);
        gradient.addColorStop(0, "#fbf3cf"); gradient.addColorStop(1, "#d8cf9f");
        ctx.fillStyle = gradient; ctx.fillRect(x, 22, w, 66);
        ctx.fillStyle = "rgba(60,70,60,.55)";
        for (let shelf = 0; shelf < 3; shelf += 1) ctx.fillRect(x + 6, 36 + shelf * 17, w - 12, 4);
        for (let item = 0; item < w / 9; item += 1) { ctx.fillStyle = ["#c65b4b", "#3e7aa8", "#d8a63c", "#5d8a52"][item % 4]; ctx.fillRect(x + 8 + item * 9, 30 + (item % 3) * 17, 5, 6); }
        ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 3; ctx.strokeRect(x, 22, w, 66);
      }
      // Glass door.
      fill(room.doorOpen ? "#fff6d5" : "#c9c2a0", 156, 30, 40, 66);
      ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 3; ctx.strokeRect(156, 30, 40, 66);
      fill("#0b0d12", 174, 58, 4, 10);
      // OPEN sign, flickering (shape stays; only brightness moves).
      const flicker = reducedMotion ? 1 : (Math.sin(time / 170) > -0.92 ? 1 : 0.35);
      ctx.fillStyle = `rgba(255,92,108,${0.85 * flicker})`; ctx.font = "bold 10px Inter, sans-serif"; ctx.fillText("OPEN", 230, 18);
      // Awning.
      for (let x = 112; x < 244; x += 12) fill(x % 24 ? "#7b2f2f" : "#e7dcc4", x, 92, 12, 10);
      // Sidewalk: wet concrete with the windows reflected in it.
      fill("#30333a", 0, 96, geo.w, 140);
      ctx.globalAlpha = 0.18; fill("#f5ecc6", 34, 104, 104, 60); fill("#f5ecc6", 218, 104, 108, 60); fill("#f5ecc6", 160, 104, 32, 70); ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
      for (let x = 0; x < geo.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x, 236); ctx.stroke(); }
      // Curb, street, passing headlights.
      fill("#55585e", 0, 232, geo.w, 6);
      fill("#15171b", 0, 238, geo.w, 80);
      for (let x = 10; x < geo.w; x += 46) fill("#c9b45a", x, 278, 22, 3);
      if (!reducedMotion) {
        const pass = (time / 5200) % 1;
        const carX = geo.w + 60 - pass * (geo.w + 160);
        glow(carX, 262, 70, "rgba(255,240,200,ALPHA)", 0.22);
      }
      // Puddle, ice machine, bin.
      ctx.fillStyle = "#1d222a"; ctx.beginPath(); ctx.ellipse(112, 184, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,92,108,${0.4 * flicker})`; ctx.fillRect(104, 181, 16, 2);
      shadow(313, 132, 20, 5); fill("#d6dde2", 296, 104, 34, 26); fill("#3e7aa8", 299, 108, 28, 7); ctx.fillStyle = "#fff"; ctx.font = "bold 6px Inter, sans-serif"; ctx.fillText("ICE", 306, 114);
      shadow(38, 132, 12, 4); fill("#3a4a3e", 28, 110, 20, 22); fill("#2a352d", 28, 110, 20, 4);
      if (room.carLights) { const van = (extras.npcs || []).find(actor => actor.id === "van"); if (van) glow(van.x - 46, van.y + 4, 90, "rgba(255,245,210,ALPHA)", 0.3); }
    }
    function paintVan(geo, sim, time, extras) {
      const room = extras.room || {};
      // Outside the van: the wet road rushing by beneath it.
      fill("#121418", camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      if (!reducedMotion) {
        const scroll = (time / 3) % 60;
        for (let x = camera.x - 60 - scroll; x < camera.x + metrics.viewW + 60; x += 60) { fill("#c9b45a", x, geo.h + 26, 26, 3); fill("#c9b45a", x, -30, 26, 3); }
        for (let index = 0; index < 4; index += 1) glow(camera.x + metrics.viewW - ((time / 6 + index * 140) % (metrics.viewW + 200)) + 100, geo.h + 60, 50, "rgba(255,230,190,ALPHA)", 0.14);
      }
      rain({ shelters: [{ x: 0, y: 0, w: geo.w, h: geo.h }] }, time, 0.8, 0.9);
      shadow(geo.w / 2, geo.h + 8, geo.w / 2 + 10, 12, 0.5);
      fill("#24211e", 0, 0, geo.w, geo.h);
      for (let x = 20; x < 226; x += 10) fill("#2d2925", x, 46, 3, 92);
      // Windows: passing light and rain on the glass.
      fill("#14181f", 20, 4, 200, 34);
      if (!reducedMotion) for (let index = 0; index < 3; index += 1) {
        const x = 220 - (((time / 9) + index * 70) % 240);
        glow(x, 20, 26, index === 1 ? "rgba(255,180,90,ALPHA)" : "rgba(220,230,255,ALPHA)", 0.45);
      }
      ctx.strokeStyle = "rgba(200,215,235,.35)"; ctx.lineWidth = 0.8;
      for (let index = 0; index < 14; index += 1) { const x = 24 + hash(index) * 190, y = 6 + ((time / 40 + hash(index + 5) * 30) % 30); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 4); ctx.stroke(); }
      // Front seats from behind.
      fill("#2c3038", 0, 28, geo.w, 16);
      for (const x of [50, 140]) { fill("#353a44", x, 18, 48, 26); fill("#3e4450", x + 14, 8, 20, 12); }
      fill("#1c1f25", 0, 0, 14, geo.h); fill("#1c1f25", 0, 138, geo.w, 12);
      // The sliding door.
      fill(room.doorOpen ? "#9fb0c4" : "#2a2e35", 226, 46, 14, 92);
      if (room.doorLoose && !room.doorOpen) { fill("#7d8ea3", 226, 70, 3, 52); rainStreak(228, 70, 52, time); }
      fill("#8a8f96", 228, 92, 4, 10);
      // Chips bag.
      poly([30, 118, 44, 116, 46, 128, 28, 130], "#d8a63c", "#0b0d10", 1.2);
    }
    function rainStreak(x, y, h, time) {
      ctx.strokeStyle = "rgba(200,215,235,.5)"; ctx.lineWidth = 0.8;
      for (let index = 0; index < 5; index += 1) { const yy = y + ((time / 8 + index * 11) % h); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - 5, yy + 3); ctx.stroke(); }
    }
    function paintRoad(geo, sim, time) {
      fill("#0a0c10", camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      fill("#1c2820", 0, 0, 200, geo.h);
      for (let y = 0; y < geo.h; y += 18) { ctx.fillStyle = hash(y) > 0.5 ? "#223127" : "#192219"; ctx.fillRect(22 + hash(y + 1) * 150, y, 10, 4); }
      fill("#2c2b29", 150, 0, 48, geo.h);
      fill("#15171b", 206, 0, 94, geo.h);
      for (let y = 10; y < geo.h; y += 60) fill("#c9b45a", 250, y, 3, 26);
      fill("#8a8f96", 198, 70, 6, geo.h - 70);
      for (let y = 80; y < geo.h; y += 44) fill("#5e636a", 196, y, 10, 6);
      fill("#131a14", 0, 0, 22, geo.h);
      // The embankment and the drain mouth at the top.
      fill("#1a2219", 0, 0, geo.w, 26);
      ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.ellipse(100, 26, 30, 22, 0, Math.PI, 0); ctx.fill();
      glow(100, 16, 30, "rgba(255,170,90,ALPHA)", 0.12);
      // Streetlights: warm pools on the wet ground.
      for (const light of geo.lights || []) { shadow(light.x, light.y + 4, 6, 2); fill("#4a4e55", light.x - 2, light.y - 40, 4, 44); glow(light.x - 20, light.y + 10, 70, "rgba(255,205,140,ALPHA)", 0.28); }
      // Bus shelter roof, bench, sign.
      ctx.fillStyle = "rgba(90,120,140,.35)"; ctx.fillRect(56, 590, 104, 64); ctx.strokeStyle = "#7d97a8"; ctx.lineWidth = 1.5; ctx.strokeRect(56, 590, 104, 64);
      fill("#5b4a3a", 70, 612, 70, 8); fill("#e7dcc4", 62, 586, 8, 10);
      // Trash bag and the discarded bowl.
      shadow(165, 980, 12, 4); poly([156, 980, 160, 966, 172, 964, 176, 980], "#20242a", "#0b0d10", 1.2);
      shadow(142, 988, 8, 2.6); ctx.fillStyle = "#a9b0b8"; ctx.beginPath(); ctx.ellipse(142, 984, 7, 3.2, 0, 0, Math.PI); ctx.fill(); ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 1; ctx.stroke();
    }
    function paintDrain(geo, sim, time, extras) {
      const room = extras.room || {};
      fill("#07080a", camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      fill("#2a2a28", 42, 0, 156, geo.h);
      for (let y = 30; y < geo.h; y += 26) { ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.moveTo(42, y); ctx.lineTo(198, y); ctx.stroke(); }
      fill("#3d3c39", 0, 0, 42, geo.h); fill("#3d3c39", 198, 0, 42, geo.h); fill("#33322f", 0, 0, geo.w, 22);
      for (let y = 40; y < geo.h; y += 90) { fill("rgba(20,40,30,.4)", 30, y, 12, 40); fill("rgba(20,40,30,.4)", 198, y + 30, 10, 30); }
      // A thin trickle down the middle, the mouth with rain beyond.
      ctx.strokeStyle = "rgba(160,185,200,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, 30); ctx.lineTo(118, geo.h); ctx.stroke();
      fill("#0d1116", 42, 360, 156, 20);
      rain(geo, time, 0.5, 0.15);
      // The glove; the warm crack at the back that invites a closer look.
      poly([74, 302, 82, 298, 86, 304, 78, 308], "#8a6a4a", "#0b0d10", 1);
      glow(120, 66, 40, "rgba(255,160,80,ALPHA)", 0.22 + (reducedMotion ? 0 : Math.sin(time / 500) * 0.05));
      ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(100, 60); ctx.lineTo(116, 72); ctx.lineTo(126, 64); ctx.lineTo(140, 76); ctx.stroke();
      if (room.crack) {
        const k = Math.min(1, (extras.sceneTime - room.crack) / 500);
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        for (let index = 0; index < 7; index += 1) { const a = (index / 7) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(sim.player.x, sim.player.y); ctx.lineTo(sim.player.x + Math.cos(a) * 30 * k, sim.player.y + Math.sin(a) * 18 * k); ctx.stroke(); }
      }
    }
    // Below: the Threshold's rooms share one restricted palette.
    const BELOW = { floor: "#2b251e", line: "#362e25", wall: "#100e0c", wallEdge: "#5d4c39" };
    function paintBelow(geo, sim, time) {
      const warm = geo.theme === "hearth";
      const floor = warm ? "#352a20" : geo.theme === "porter" ? "#231f1c" : BELOW.floor;
      fill("#050404", camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80);
      fill(floor, 0, 0, geo.w, geo.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, geo.w, geo.h); ctx.clip();
      ctx.strokeStyle = warm ? "#41321f" : BELOW.line; ctx.lineWidth = 1;
      for (let y = 30; y < geo.h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(geo.w, y); ctx.stroke(); }
      for (let row = 0, y = 30; y < geo.h; y += 22, row += 1) for (let x = 20 + (row % 2) * 34; x < geo.w; x += 68) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
      ctx.restore();
      if (geo.arena) { ctx.strokeStyle = "rgba(233,223,199,.08)"; ctx.setLineDash([3, 5]); ctx.strokeRect(geo.arena.x, geo.arena.y, geo.arena.w, geo.arena.h); ctx.setLineDash([]); }
      if (geo.seat) { shadow(geo.seat.x + geo.seat.w / 2, geo.seat.y + 10, 30, 4); fill("#5b4630", geo.seat.x, geo.seat.y, geo.seat.w, geo.seat.h); fill("#6e563a", geo.seat.x, geo.seat.y, geo.seat.w, 3); }
      for (const rect of geo.solids) paintSolid(rect, sim, time, geo);
      for (const prop of geo.props) if (Core.present(prop, sim.flags)) paintProp(prop, sim, time);
      if (geo.homeSign) {
        ctx.fillStyle = "rgba(233,223,199,.85)"; ctx.font = "bold 11px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("HOME", geo.homeSign.x, geo.homeSign.y - 4); ctx.fillText("↑", geo.homeSign.x, geo.homeSign.y + 8); ctx.textAlign = "left";
        glow(geo.homeSign.x, geo.homeSign.y - 10, 34, "rgba(200,220,255,ALPHA)", 0.14);
      }
      if (geo.hearth) paintHearth(geo, sim, time);
    }
    function paintSolid(rect, sim, time, geo) {
      const present = Core.present(rect, sim.flags);
      if (!present) {
        if (rect.kind === "hatch") { fill("#0c0b0a", rect.x, rect.y, rect.w, rect.h); glow(rect.x + rect.w / 2, rect.y + rect.h / 2, 30, "rgba(255,190,120,ALPHA)", 0.18); }
        else if (rect.kind === "homedoor") { fill("#d9d2bd", rect.x, rect.y, rect.w, rect.h); glow(rect.x + rect.w / 2, rect.y + 8, 70, "rgba(255,235,190,ALPHA)", 0.45); }
        else if (rect.kind === "door") { fill("#0c0b0a", rect.x, rect.y, rect.w, rect.h); }
        else if (rect.kind === "gate" || rect.kind === "gatelatch") { fill("rgba(70,60,48,.5)", rect.x, rect.y + rect.h - 3, rect.w, 3); }
        return;
      }
      switch (rect.kind) {
        case "wall": fill(BELOW.wall, rect.x, rect.y, rect.w, rect.h); if (rect.h < 40 && rect.y + rect.h < geo.h) fill(BELOW.wallEdge, rect.x, rect.y + rect.h - 3, rect.w, 3); break;
        case "door": case "homedoor": fill("#3a3229", rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "#8a7458"; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 3); ctx.beginPath(); ctx.moveTo(rect.x + rect.w / 2, rect.y + 3); ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h - 2); ctx.stroke(); break;
        case "hatch": fill("#4a3e30", rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "#8a7458"; ctx.lineWidth = 1.5; for (let y = rect.y + 6; y < rect.y + rect.h; y += 8) { ctx.beginPath(); ctx.moveTo(rect.x + 3, y); ctx.lineTo(rect.x + rect.w - 3, y); ctx.stroke(); } fill("#c9773c", rect.x + rect.w - 7, rect.y + rect.h / 2 - 3, 4, 6); break;
        case "crate": shadow(rect.x + rect.w / 2, rect.y + rect.h + 2, rect.w / 2 + 2, 4); fill("#6e5238", rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "#2a1f16"; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2); ctx.beginPath(); ctx.moveTo(rect.x + 3, rect.y + 3); ctx.lineTo(rect.x + rect.w - 3, rect.y + rect.h - 3); ctx.moveTo(rect.x + rect.w - 3, rect.y + 3); ctx.lineTo(rect.x + 3, rect.y + rect.h - 3); ctx.stroke(); break;
        case "pipe": fill("#4a5a64", rect.x, rect.y, rect.w, rect.h); fill("#1c2328", rect.x + rect.w - 4, rect.y, 4, rect.h); for (let y = rect.y + 8; y < rect.y + rect.h; y += 18) fill("#1c2328", rect.x - 2, y, rect.w + 4, 3); break;
        case "shelf": shadow(rect.x + rect.w / 2, rect.y + rect.h + 3, rect.w / 2, 4); fill("#55442f", rect.x, rect.y, rect.w, rect.h); fill("#7a6a52", rect.x + 4, rect.y - 5, 8, 5); fill("#7a6a52", rect.x + 22, rect.y - 4, 10, 4); fill("#9a8a6a", rect.x + 44, rect.y - 6, 6, 6); break;
        case "rubble": for (let index = 0; index < 9; index += 1) { const x = rect.x + hash(index) * rect.w, y = rect.y + hash(index + 3) * rect.h; poly([x, y + 8, x + 6, y, x + 14, y + 4, x + 12, y + 12], index % 2 ? "#4a4038" : "#3a322b", "#15110e", 1); } break;
        case "post": shadow(rect.x + rect.w / 2, rect.y + rect.h, rect.w / 2 + 2, 4); fill("#5e636a", rect.x + 6, rect.y, rect.w - 12, rect.h); fill("#8a8f96", rect.x + 2, rect.y, rect.w - 4, 5); break;
        case "gate": fill("#3d342a", rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "#6b5c48"; ctx.lineWidth = 2; for (let x = rect.x + 4; x < rect.x + rect.w; x += 9) { ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke(); } break;
        case "gatelatch": {
          fill("#3d342a", rect.x, rect.y, rect.w, rect.h);
          fill("#8a8f96", rect.x + 12, rect.y + 3, 16, 10);
          // Frost on the latch: little white ticks (shape, not just colour).
          ctx.strokeStyle = "#e8f2ff"; ctx.lineWidth = 1;
          for (let index = 0; index < 5; index += 1) { const x = rect.x + 12 + index * 4; ctx.beginPath(); ctx.moveTo(x, rect.y + 2); ctx.lineTo(x + 2, rect.y + 5); ctx.stroke(); }
          ctx.fillStyle = "#e9dfc7"; ctx.font = "bold 6px Inter, sans-serif"; ctx.fillText("NO OPEN FLAMES", rect.x - 22, rect.y - 4);
          break;
        }
        default: fill(BELOW.wall, rect.x, rect.y, rect.w, rect.h);
      }
    }
    function paintProp(prop, sim) {
      if (prop.id === "ticket-stub") { ctx.save(); ctx.translate(prop.x, prop.y); ctx.rotate(-0.25); fill("#e6dcc2", -5, -3, 10, 6); ctx.restore(); }
      else if (prop.kind === "bowl") {
        shadow(prop.x, prop.y + 3, 9, 3);
        ctx.fillStyle = "#8f9aa5"; ctx.beginPath(); ctx.ellipse(prop.x, prop.y, 8, 3.6, 0, 0, Math.PI); ctx.fill(); ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#57575a"; ctx.beginPath(); ctx.ellipse(prop.x, prop.y, 6.5, 2, 0, 0, Math.PI * 2); ctx.fill();
      } else if (prop.kind === "lever") {
        fill("#4a4e55", prop.x - 4, prop.y - 6, 8, 12); ctx.strokeStyle = "#c9773c"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(prop.x, prop.y); ctx.lineTo(prop.x + 6, prop.y - 10); ctx.stroke();
      } else if (prop.id === "queue-lever-done") {
        fill("#4a4e55", prop.x - 4, prop.y - 6, 8, 12); ctx.strokeStyle = "#c9773c"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(prop.x, prop.y); ctx.lineTo(prop.x + 7, prop.y + 8); ctx.stroke();
      }
    }
    function paintHearth(geo, sim, time) {
      const h = geo.hearth, lit = Boolean(sim?.hearthLit);
      glow(h.x, h.y, lit ? 120 : 50, "rgba(255,150,70,ALPHA)", lit ? 0.24 : 0.08);
      ctx.fillStyle = "#2f2a25"; ctx.beginPath(); ctx.ellipse(h.x, h.y + 3, h.r + 4, h.r * 0.7 + 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b6156";
      for (let index = 0; index < 8; index += 1) { const a = (index / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * (h.r + 2), h.y + 3 + Math.sin(a) * (h.r * 0.7 + 1), 2.4, 0, Math.PI * 2); ctx.fill(); }
      const flicker = reducedMotion ? 0 : Math.sin(time / 90) * 0.8 + Math.sin(time / 37) * 0.5;
      const size = lit ? 8 + flicker : 3 + flicker * 0.4;
      ctx.fillStyle = lit ? "#ff9a3c" : "#7a3a1c";
      ctx.beginPath(); ctx.moveTo(h.x - size * 0.7, h.y + 3); ctx.quadraticCurveTo(h.x - size * 0.5, h.y - size * 0.6, h.x, h.y - size * 1.4); ctx.quadraticCurveTo(h.x + size * 0.5, h.y - size * 0.6, h.x + size * 0.7, h.y + 3); ctx.closePath(); ctx.fill();
      if (lit) { ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(h.x, h.y, size * 0.25, size * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    }

    // ===== ACTORS (cutouts; feet at x,y) =====
    function walkBob(actor, time) { return actor.walking && !reducedMotion ? Math.abs(Math.sin(time / 110)) * 2 : 0; }
    function paintNpc(actor, time) {
      const bob = walkBob(actor, time);
      const x = actor.x, y = actor.y;
      ctx.save();
      switch (actor.kind) {
        case "keeper": {
          shadow(x, y, 14, 4);
          fill("#1f2633", x - 6, y - 30 - bob, 5, 30); fill("#1f2633", x + 1, y - 30 + bob, 5, 30);
          poly([x - 11, y - 30, x + 11, y - 30, x + 9, y - 70, x - 9, y - 70], "#2b3a4f", "#0b0d10", 1.4);
          ctx.fillStyle = "#c9a98a"; ctx.beginPath(); ctx.arc(x, y - 77, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#2e6fa3"; ctx.beginPath(); ctx.ellipse(x + 2, y - 90, 22, 9, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 2, y - 90); ctx.lineTo(x + 2, y - 66); ctx.stroke();
          break;
        }
        case "van": {
          shadow(x, y + 6, 54, 8);
          fill("#20242b", x - 48, y - 34, 96, 38); fill("#2b3038", x - 48, y - 34, 96, 6);
          fill("#3a4250", x - 40, y - 28, 22, 12); fill("#3a4250", x - 12, y - 28, 44, 12);
          fill("#0b0d10", x - 36, y + 2, 14, 8); fill("#0b0d10", x + 22, y + 2, 14, 8);
          fill("#fff3c4", x - 50, y - 12, 4, 6);
          fill("#c33", x + 46, y - 12, 3, 6);
          break;
        }
        case "hood-tall": case "hood-small": case "hood-cap": {
          const tall = actor.kind === "hood-tall", small = actor.kind === "hood-small";
          const h = tall ? 54 : small ? 40 : 46, w = tall ? 13 : 12;
          const body = tall ? "#3b3f4a" : small ? "#6b2f36" : "#2f5a3e";
          const flinch = actor.flinchUntil && extrasTime < actor.flinchUntil;
          ctx.translate(x, y);
          if (flinch) ctx.rotate(-0.12 * (actor.face || 1));
          shadow(0, 0, 12, 4);
          fill("#15161a", -6, -16 - bob, 5, 16); fill("#15161a", 1, -16 + bob, 5, 16);
          poly([-w, -16, w, -16, w - 2, -h + 10, -w + 2, -h + 10], body, "#0b0b0d", 1.4);
          ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -h + 6, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#0b0b0d"; ctx.lineWidth = 1.4; ctx.stroke();
          fill("#141418", -6, -h + 2, 12, 9);
          fill("#e9e1cc", -4, -h + 5, 3, 1.6); fill("#e9e1cc", 2, -h + 5, 3, 1.6);
          if (small) fill("#d9c27a", -11, -h - 2, 22, 5);
          if (actor.kind === "hood-cap") fill("#b8b8b8", -8, -h - 2, 14, 4);
          if (actor.state === "grab") { ctx.strokeStyle = body; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-w + 2, -30); ctx.lineTo(-w - 10, -12); ctx.stroke(); }
          break;
        }
        case "driver-seat": case "passenger-seat": {
          // Silhouettes in the front seats, seen from behind.
          ctx.fillStyle = "#14161b"; ctx.beginPath(); ctx.arc(x + 14, y - 4, 9, 0, Math.PI * 2); ctx.fill();
          fill("#14161b", x + 4, y + 3, 20, 10);
          if (actor.kind === "passenger-seat") fill("#3b3f4a", x + 6, y - 12, 16, 6);
          break;
        }
        case "taillights": {
          const k = actor.moveMs ? 1 : 0.4;
          ctx.globalAlpha = Math.max(0, Math.min(1, (actor.y - 760) / 420)) * k;
          glow(x - 8, y, 16, "rgba(255,40,40,ALPHA)", 0.8); glow(x + 8, y, 16, "rgba(255,40,40,ALPHA)", 0.8);
          break;
        }
        case "latch": paintLatch(actor, time, bob); break;
        default: break;
      }
      ctx.restore();
    }
    let extrasTime = 0;
    // Latch: a small courier in a paper-like coat. Expression is data.
    function paintLatch(actor, time, bob) {
      const x = actor.x, y = actor.y;
      const face = actor.face || 1;
      shadow(x, y, 9, 3);
      ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
      if (actor.seated) ctx.translate(0, 4);
      fill("#3a2f24", -4, -7 - bob, 3, 7); fill("#3a2f24", 1, -7 + bob, 3, 7);
      poly([-8, -6, 8, -6, 6, -22, -6, -22], "#e9e1cc", "#14110d", 1.3);
      ctx.strokeStyle = "#b9ab8c"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3, -20); ctx.lineTo(0, -6); ctx.moveTo(4, -20); ctx.lineTo(2, -6); ctx.stroke();
      fill("#c9773c", -1, -16, 3, 3);
      ctx.fillStyle = "#d8c9a6"; ctx.beginPath(); ctx.arc(0, -27, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#14110d"; ctx.lineWidth = 1.2; ctx.stroke();
      fill("#5b4a36", -6, -33, 12, 3); fill("#5b4a36", 4, -32, 4, 2);
      const expr = actor.expr || "procedural";
      ctx.fillStyle = "#14110d";
      if (expr === "startled") { ctx.beginPath(); ctx.arc(-2, -27, 1.3, 0, Math.PI * 2); ctx.arc(2.5, -27, 1.3, 0, Math.PI * 2); ctx.fill(); }
      else if (expr === "soft") { ctx.strokeStyle = "#14110d"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-2, -27, 1.2, Math.PI, 0); ctx.arc(2.5, -27, 1.2, Math.PI, 0); ctx.stroke(); }
      else { fill("#14110d", -3, -27.5, 2, 1); fill("#14110d", 1.5, -27.5, 2, 1); }
      if (actor.pinned) { ctx.strokeStyle = "#e9e1cc"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-30, -14); ctx.stroke(); ctx.strokeStyle = "#14110d"; ctx.lineWidth = 0.8; ctx.stroke(); }
      if (actor.pulling) { ctx.strokeStyle = "#8a8f96"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -16); ctx.lineTo(14, -24 + Math.sin(time / 60) * 2); ctx.stroke(); }
      ctx.restore();
    }

    // ===== ENEMIES =====
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
      shadow(enemy.x, enemy.y + enemy.r + 2, enemy.r, 3);
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
      if (enemy.aware) notches(enemy, droop);
    }
    function notches(enemy, droop = 0) {
      const hits = Math.ceil(enemy.hp / 2), max = Math.ceil(enemy.maxHp / 2);
      for (let index = 0; index < max; index += 1) { ctx.fillStyle = index < hits ? "#e9dfc7" : "rgba(233,223,199,.25)"; ctx.fillRect(enemy.x - (max * 6) / 2 + index * 6, enemy.y - enemy.r - 12 + droop, 4, 2); }
    }
    // Needle: a thin standing spine; its lane is dashed, then pulses solid.
    function paintNeedle(enemy, sim, time) {
      if (enemy.state === "gone") { const age = sim.t - enemy.goneAt; if (age < 500) { ctx.globalAlpha = 1 - age / 500; fill("#cfd6dc", enemy.x - 1, enemy.y - 14, 2, 14); ctx.globalAlpha = 1; } return; }
      const def = Content.ENEMIES.needle;
      if (enemy.state === "indicate" || enemy.state === "pulse") {
        const sx = enemy.x + enemy.aimX * (enemy.r + 2), sy = enemy.y + enemy.aimY * (enemy.r + 2);
        const ex = sx + enemy.aimX * enemy.laneLength, ey = sy + enemy.aimY * enemy.laneLength;
        ctx.save();
        if (enemy.state === "pulse") { ctx.strokeStyle = "rgba(255,245,220,.95)"; ctx.lineWidth = def.laneWidth; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); }
        else {
          const k = Math.min(1, (sim.t - enemy.stateAt) / def.indicateMs);
          ctx.strokeStyle = `rgba(220,214,200,${0.35 + 0.4 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          const px = -enemy.aimY * def.laneWidth / 2, py = enemy.aimX * def.laneWidth / 2;
          ctx.beginPath(); ctx.moveTo(sx + px, sy + py); ctx.lineTo(ex + px, ey + py); ctx.moveTo(sx - px, sy - py); ctx.lineTo(ex - px, ey - py); ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex + px * 1.4, ey + py * 1.4); ctx.lineTo(ex - px * 1.4, ey - py * 1.4); ctx.stroke();
        }
        ctx.restore();
      }
      shadow(enemy.x, enemy.y + 3, 8, 3);
      const flash = sim.t < enemy.flashUntil;
      const lean = enemy.state === "indicate" ? 2 : 0;
      poly([enemy.x - 4, enemy.y + 2, enemy.x + 4, enemy.y + 2, enemy.x + 1 + lean, enemy.y - 20, enemy.x - 1 + lean, enemy.y - 20], flash ? "#fff" : "#cfd6dc", "#0b0d10", 1.2);
      ctx.fillStyle = "#0b0d10"; ctx.fillRect(enemy.x - 2 + lean * 0.5, enemy.y - 12, 4, enemy.state === "recover" ? 1 : 2);
      if (enemy.aware) notches(enemy);
    }
    function paintCargo(enemy, sim) {
      if (enemy.state === "gone") return;
      if (enemy.state === "windup") {
        ctx.save(); ctx.strokeStyle = "rgba(255,236,200,.8)"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(enemy.x + 10, enemy.y); ctx.lineTo(enemy.x + Content.ENEMIES.cargo.slideDistance + 10, enemy.y); ctx.stroke(); ctx.setLineDash([]);
        for (let d = 30; d < 150; d += 24) { ctx.beginPath(); ctx.moveTo(enemy.x + d - 4, enemy.y - 4); ctx.lineTo(enemy.x + d, enemy.y); ctx.lineTo(enemy.x + d - 4, enemy.y + 4); ctx.stroke(); }
        ctx.restore();
      }
      shadow(enemy.x, enemy.y + 8, 11, 3);
      const wobble = enemy.state === "windup" && !reducedMotion ? Math.sin(sim.t / 40) * 1.2 : 0;
      fill("#cf3f3f", enemy.x - 10 + wobble, enemy.y - 8, 20, 14); fill("#e9e1cc", enemy.x - 10 + wobble, enemy.y - 8, 20, 4);
      ctx.strokeStyle = "#0b0d10"; ctx.lineWidth = 1.2; ctx.strokeRect(enemy.x - 10 + wobble, enemy.y - 8, 20, 14);
    }
    // The Night Porter: a tall worn coat with a lamp for a head.
    function paintPorter(enemy, sim, time, geo) {
      const def = Content.ENEMIES.porter;
      const arena = geo.arena;
      if (enemy.state === "sweep-tell" || enemy.state === "sweep") {
        const top = enemy.bandY - def.bandHeight / 2;
        ctx.save();
        if (enemy.state === "sweep-tell") {
          const k = Math.min(1, (sim.t - enemy.stateAt) / (def.sweepTellMs * (sim.assist ? Core.T.ASSIST_ANTICIPATION : 1)));
          ctx.fillStyle = `rgba(255,220,150,${0.05 + 0.12 * k})`; ctx.fillRect(arena.x, top, arena.w, def.bandHeight);
          ctx.strokeStyle = "rgba(255,236,200,.8)"; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(arena.x, top, arena.w, def.bandHeight); ctx.setLineDash([]);
          // The arrow says which way the light will travel.
          const ax = enemy.sweepDir === 1 ? arena.x + 16 : arena.x + arena.w - 16;
          ctx.beginPath(); ctx.moveTo(ax, enemy.bandY - 6); ctx.lineTo(ax + 10 * enemy.sweepDir, enemy.bandY); ctx.lineTo(ax, enemy.bandY + 6); ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(255,240,200,.85)"; ctx.fillRect(enemy.beamX - def.beamWidth / 2, top, def.beamWidth, def.bandHeight);
          glow(enemy.beamX, enemy.bandY, 50, "rgba(255,230,170,ALPHA)", 0.35);
        }
        ctx.restore();
      }
      if (enemy.state === "charge-tell") {
        ctx.save(); ctx.strokeStyle = "rgba(255,236,200,.85)"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + enemy.aimX * (def.chargeDistance + enemy.r), enemy.y + enemy.aimY * (def.chargeDistance + enemy.r)); ctx.stroke(); ctx.setLineDash([]);
        const px = -enemy.aimY, py = enemy.aimX;
        for (let d = 24; d < def.chargeDistance; d += 18) { const cx = enemy.x + enemy.aimX * d, cy = enemy.y + enemy.aimY * d; ctx.beginPath(); ctx.moveTo(cx - enemy.aimX * 5 + px * 5, cy - enemy.aimY * 5 + py * 5); ctx.lineTo(cx, cy); ctx.lineTo(cx - enemy.aimX * 5 - px * 5, cy - enemy.aimY * 5 - py * 5); ctx.stroke(); }
        ctx.restore();
      }
      const settled = enemy.state === "settled";
      const open = enemy.state === "open";
      const flash = sim.t < enemy.flashUntil;
      const x = enemy.x, y = enemy.y;
      shadow(x, y + 20, 26, 7, 0.45);
      ctx.save(); ctx.translate(x, y);
      if (settled) { ctx.rotate(0.05); ctx.translate(0, 10); ctx.scale(1.1, 0.7); }
      // Coat.
      poly([-20, 20, 20, 20, 15, -26, -15, -26], flash ? "#7d756b" : "#4a4239", "#0b0b0d", 2);
      poly([-15, -26, 15, -26, 10, -34, -10, -34], "#3a332c", "#0b0b0d", 1.6);
      if (open) {
        // The hem opens: a bright V seam (shape changes, not just colour).
        poly([-10, 20, 10, 20, 0, -6], flash ? "#fff6e0" : "#ffcf8a", "#0b0b0d", 1.4);
      } else { ctx.strokeStyle = "#0b0b0d"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 20); ctx.stroke(); for (let b = -16; b < 16; b += 9) fill("#8a7458", -3, b, 2.5, 2.5); }
      // Lamp head.
      fill("#2a2620", -6, -46, 12, 12);
      const lampOn = !settled;
      ctx.fillStyle = lampOn ? "#ffe6a8" : "#5a5040"; ctx.fillRect(-4, -44, 8, 8);
      ctx.restore();
      if (!settled) glow(x, y - 40, 40, "rgba(255,225,160,ALPHA)", 0.18);
      if (enemy.aware && !settled) {
        const frac = enemy.hp / enemy.maxHp;
        fill("rgba(0,0,0,.5)", x - 22, y - 58, 44, 4); fill("#e9dfc7", x - 22, y - 58, 44 * frac, 4);
        fill("rgba(233,223,199,.6)", x - 22 + 44 * (Content.ENEMIES.porter.helpAt / enemy.maxHp), y - 59, 1, 6);
      }
    }

    function paintFlare(sim, small) {
      const p = sim.player, act = p.act;
      const phase = Core.flarePhase(act, sim.t);
      if (!phase || phase === "done") return;
      const angle = Math.atan2(act.fy, act.fx), half = (Core.T.FLARE_ARC_DEG / 2) * Math.PI / 180;
      const range = small ? Core.T.FLARE_RANGE * 0.55 : Core.T.FLARE_RANGE;
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
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, angle - half, angle + half); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,200,.9)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, range, angle - half, angle + half); ctx.stroke();
      }
      ctx.restore();
    }
    // Kindle progress: a ring closing around what is being warmed.
    function paintKindle(sim, geo) {
      const act = sim.player.act;
      if (act?.kind !== "kindle") return;
      const target = act.targetKind === "hearth" ? geo.hearth : geo.props.find(prop => prop.id === act.targetId);
      if (!target) return;
      const k = Math.min(1, (sim.t - act.start) / Core.T.KINDLE_MS);
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,160,.9)"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(target.x, target.y, (target.r || 8) + 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function paintEffects(time) {
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const fx = effects[index], age = (time - fx.at) / fx.life;
        if (age >= 1) { effects.splice(index, 1); continue; }
        ctx.save(); ctx.globalAlpha = 1 - age;
        if (fx.kind === "spark") { ctx.fillStyle = "#ffcf7a"; ctx.fillRect(fx.x + fx.vx * age * 14 - 1, fx.y + fx.vy * age * 14 - 1, 2, 2); }
        else if (fx.kind === "puff") { ctx.strokeStyle = "rgba(220,214,200,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(fx.x, fx.y, 3 + age * 8, 0, Math.PI * 2); ctx.stroke(); }
        else if (fx.kind === "deflect") { ctx.strokeStyle = "rgba(230,230,230,.85)"; ctx.lineWidth = 1.4; for (let d = 0; d < 3; d += 1) { ctx.beginPath(); ctx.arc(fx.x + (d - 1) * 6, fx.y - age * 10, 3 + age * 5, 0, Math.PI * 2); ctx.stroke(); } }
        ctx.restore();
      }
    }
    function addEffect(kind, x, y, count = 1, time = performance.now()) {
      for (let index = 0; index < count; index += 1) {
        if (effects.length >= MAX_EFFECTS) effects.shift();
        const angle = Math.random() * Math.PI * 2;
        effects.push({ kind, x, y, vx: Math.cos(angle), vy: Math.sin(angle), at: time, life: kind === "spark" ? 360 : 460 });
      }
    }
    // Light: the dark is readable; the Rizo's own flame warms what is near it.
    function paintLight(geo, pos, flame) {
      const outside = geo.world;
      const dark = outside ? 0.28 : geo.theme === "hearth" ? 0.2 : 0.42;
      const reach = 70 + flame * 16;
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 8, pos.x, pos.y, reach + 80);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${dark})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(camera.x - 20, camera.y - 20, metrics.viewW + 40, metrics.viewH + 40);
      glow(pos.x, pos.y - 6, 26 + flame * 3, "rgba(255,170,90,ALPHA)", outside ? 0.1 : 0.16);
    }

    // Draws one frame. `pos` is the interpolated player position.
    function render(sim, pos, time, dt, extras = {}) {
      const geo = Core.room(sim.roomId);
      if (!geo || !metrics.cssW) return;
      extrasTime = extras.sceneTime || 0;
      follow(pos.x, pos.y, geo, dt, extras.peek);
      const shake = extras.shake && !reducedMotion ? extras.shake * 2.2 : 0;
      const ox = shake ? (Math.sin(time / 23) * shake) : 0, oy = shake ? (Math.cos(time / 29) * shake) : 0;
      const s = metrics.scale * metrics.dpr;
      ctx.setTransform(s, 0, 0, s, (-camera.x + ox) * s, (-camera.y + oy) * s);
      if (geo.theme === "curb") paintCurb(geo, sim, time, extras);
      else if (geo.theme === "van") paintVan(geo, sim, time, extras);
      else if (geo.theme === "road") paintRoad(geo, sim, time, extras);
      else if (geo.theme === "drain") paintDrain(geo, sim, time, extras);
      else paintBelow(geo, sim, time);
      paintKindle(sim, geo);
      // Actors in depth order: whoever stands lower on the screen is in front.
      const actors = (extras.npcs || []).slice().sort((a, b) => a.y - b.y);
      shadow(pos.x, pos.y + 6, 9, 3, 0.42);
      for (const actor of actors) paintNpc(actor, time);
      for (const enemy of sim.enemies) {
        if (enemy.kind === "draftling") paintDraftling(enemy, sim, time);
        else if (enemy.kind === "needle") paintNeedle(enemy, sim, time);
        else if (enemy.kind === "cargo") paintCargo(enemy, sim);
        else if (enemy.kind === "porter") paintPorter(enemy, sim, time, geo);
      }
      paintFlare(sim, Boolean(geo.world));
      paintEffects(time);
      if (geo.world && geo.theme !== "drain" && geo.theme !== "van") {
        const worse = geo.theme === "road" ? Math.max(0, 1 - pos.y / 700) * 0.6 : 0;
        rain(geo, time, (geo.rain || 0) + worse, 0.25 + worse * 0.4);
      }
      paintLight(geo, pos, sim.player.flame);
      // The DOM actor follows the same camera.
      const [ax, ay] = toScreen(pos.x + ox, pos.y + oy + Core.T.PLAYER_RADIUS * 0.6);
      const size = actorUnits * metrics.scale;
      el.actor.style.transform = `translate3d(${(ax - size / 2).toFixed(1)}px, ${(ay - size * 0.84).toFixed(1)}px, 0)`;
      renderBarks(extras.barks || [], extras.npcs || []);
    }
    // Speech bubbles over NPCs: DOM, 14px, never covering the controls.
    function renderBarks(list, actors) {
      const seen = new Set();
      for (const item of list) {
        const actor = actors.find(entry => entry.id === item.id);
        if (!actor) continue;
        seen.add(item.id);
        let node = barkNodes.get(item.id);
        if (!node) { node = document.createElement("div"); node.className = "dungeon-bark"; el.barks.appendChild(node); barkNodes.set(item.id, node); }
        if (node.textContent !== item.text) node.textContent = item.text;
        const lift = actor.kind === "hood-tall" ? 62 : actor.kind === "latch" ? 40 : 54;
        const [x, y] = toScreen(actor.x, actor.y - lift);
        node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
      }
      for (const [id, node] of barkNodes) if (!seen.has(id)) { node.remove(); barkNodes.delete(id); }
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
    // A control wakes once: the only kind of tutorial the handheld gives.
    function pulseKey(name) {
      const node = name === "dpad" ? el.dpad : el.keys[name];
      if (!node || reducedMotion) return;
      node.classList.remove("is-pulsing");
      void node.offsetWidth;
      node.classList.add("is-pulsing");
      setTimeout(() => node.classList.remove("is-pulsing"), 1600);
    }
    function showPrompt(target, label) {
      if (!target) { if (!el.prompt.hidden) el.prompt.hidden = true; return; }
      const [x, y] = toScreen(target.x, target.y - target.r - 6);
      el.prompt.hidden = false;
      el.prompt.textContent = label;
      el.prompt.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    }
    function showCue(markup) { if (!markup) { if (!el.cue.hidden) { el.cue.hidden = true; el.cue.innerHTML = ""; } return; } if (el.cue.innerHTML !== markup) el.cue.innerHTML = markup; el.cue.hidden = false; }
    function banner(text) { el.banner.textContent = text || ""; el.banner.hidden = !text; }
    // Dialogue: a speaker's portrait (data-driven expression) beside the line.
    function dialogue(text, { done = false, speaker = null, expr = null } = {}) {
      if (text === null) { el.dialogue.hidden = true; el.line.textContent = ""; lastPortrait = ""; return; }
      el.dialogue.hidden = false;
      const who = speaker ? Content.SPEAKERS[speaker] : null;
      el.dialogue.classList.toggle("is-narration", !who);
      el.dialogue.dataset.speaker = speaker || "";
      const portraitKey = who ? `${who.portrait}:${expr}` : "";
      if (portraitKey !== lastPortrait) {
        lastPortrait = portraitKey;
        const set = who ? Content.PORTRAITS[who.portrait] : null;
        const art = set ? (set[expr] || Object.values(set)[0]) : "";
        el.portrait.innerHTML = typeof art === "string" ? art : art?.src ? `<img src="${esc(art.src)}" alt="">` : "";
        el.portrait.dataset.expr = expr || "";
        el.portrait.hidden = !who;
        el.speaker.textContent = who ? who.name : "";
      }
      el.line.textContent = text;
      el.more.textContent = done ? "▼" : "";
    }
    function choice(options, selected = 0) {
      if (!options) { el.choice.hidden = true; el.choice.innerHTML = ""; return; }
      el.choice.hidden = false;
      el.choice.innerHTML = options.map((option, index) => `<button type="button" class="${index === selected ? "is-selected" : ""}" data-choice-index="${index}" aria-pressed="${index === selected}">${esc(option.label)}</button>`).join("");
    }
    function panel(markup) {
      if (!markup) { el.panel.hidden = true; el.panel.innerHTML = ""; el.device.classList.remove("panel-open"); return; }
      el.panel.innerHTML = markup;
      el.panel.hidden = false;
      el.device.classList.add("panel-open");
      el.panel.querySelector("button")?.focus({ preventScroll: true });
    }
    function setFade(value) { const next = String(Math.round(value * 100) / 100); if (el.fade.style.opacity !== next) el.fade.style.opacity = next; }
    function setPhase(phase) { el.device.dataset.phase = phase; }
    function setShell(state) { if (el.device.dataset.shell !== state) { el.device.dataset.shell = state; requestAnimationFrame(() => layout()); } }
    function destroy() { effects.length = 0; barkNodes.clear(); arena.innerHTML = ""; }

    layout();
    return { el, layout, setPet, render, setPose, setFlame, setRoomName, setKeys, setActionLabel, pulseKey, showPrompt, showCue, banner, dialogue, choice, panel, setFade, setPhase, setShell, addEffect, toScreen, metrics, camera, destroy, esc };
  }

  return Object.freeze({ create, CAMERA_WIDTH, DPR_CAP, esc });
});
