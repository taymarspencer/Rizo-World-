/*
  RIZO DUNGEON — VIEW
  ===================
  The handheld (Rizo Field Unit / BELOW) and what its screen shows.

  Canvas paints rooms, props, NPC cutouts, enemies, weather and light. The
  player's Rizo is never painted here: a DOM actor plane above the canvas
  holds the hub's canonical pet markup (host.petMarkup), moved by an outer
  pose wrapper. Text (prompts, speech, dialogue with portraits, choices,
  panels) is DOM so it stays crisp and unscaled.

  What things look like is not decided here: dungeon-art.js is the visual
  constitution (palette, ink, light, characters, portraits) and
  dungeon-scenery.js paints each place from it. This file composes a frame:
  the room's cached static layer → live scenery → actors by depth → rain →
  the dark and its light pools → telegraphs, fire and sparks above the dark.
  Every telegraph has a shape cue (dashes become solid, chevrons, a band, a
  body that squashes or opens), never colour or sound alone.

  The shell has three states: "open" (the opening, outside: no bezel, the
  world fills the frame, controls float), "locking" (the rails click in,
  ~560 ms) and "locked" (the Rizo Field Unit).
*/
(function initRizoDungeonView(root, factory) {
  const api = factory(root?.RizoDungeonCore || null, root?.RizoDungeonContent || null, root?.RizoDungeonArt || null, root?.RizoDungeonScenery || null);
  if (root) Object.defineProperty(root, "RizoDungeonView", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonView(Core, Content, Art, Scenery) {
  "use strict";
  if (!Core || !Content || !Art || !Scenery) return null;
  const P = Art.P;

  const CAMERA_WIDTH = 320;
  const DPR_CAP = 2;
  const MAX_EFFECTS = 12;
  // The actor box; the sprite inside it reads as roughly 28–31 units tall.
  const ACTOR_UNITS = 34;
  const STAGE_SCALE = { spark: 0.82, kid: 0.9, teen: 0.96, beast: 1, legend: 1.04 };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  // CALLER_SYMBOL is The Boss's mark (story spine v0.4): a bell jar with a
  // light shut inside, the same mark on his cards and his collectors. No text.
  // On a phone lying in the rain it is seen through water on the glass.
  const callerSymbol = () => `<span class="dungeon-caller-glass"><svg class="dungeon-caller-symbol" data-caller-symbol="CALLER_SYMBOL" data-mark="boss" viewBox="0 0 40 40" aria-hidden="true">${Art.markSvg("#eef5f9", "#ffffff", 2)}</svg><i class="dungeon-drop d1"></i><i class="dungeon-drop d2"></i><i class="dungeon-drop d3"></i><i class="dungeon-glare"></i></span>`;
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  // Presentation-only stage directions. Actors follow the actual dialogue,
  // nearby speakers and their assigned jobs; no scripted telepathy, hidden
  // player tracking, or changes to collisions/enemy logic. Pure so QA can
  // verify the priority of every response without booting the whole scene.
  const bounded = n => Math.max(-1, Math.min(1, n));
  function performanceForActor(actor, frame = {}) {
    const { player, actors = [], barks = [], speaker = "", t = 0,
      reduced = false, flare = false } = frame;
    const still = { look: { x: 0, y: 0 }, addressed: false,
      listening: false, startled: false, cue: "job" };
    if (!actor || actor.visible === false || !player) return still;
    const near = (target, radius) => target && Math.hypot(target.x - actor.x, target.y - actor.y) <= radius;
    const liveSpeech = barks.find(line => line.id === actor.id);
    const reading = speaker === actor.id ||
      (actor.kind === "keeper" && speaker === "you");
    const speakingNow = Boolean(liveSpeech || reading);
    const warm = ["keeper", "nell", "orr", "latch"].includes(actor.kind);
    const hood = ["hood-tall", "hood-small", "hood-cap"].includes(actor.kind);
    // The observer looks at the actual current speaker, not always at Rizo.
    // This is only relevant when close and available, never during travel.
    const conversation = [...barks].reverse().find(line => line.id !== actor.id &&
      actors.some(other => other.id === line.id && other.visible !== false &&
        near(other, 150)));
    // Portrait dialogue is even more important than ambient chatter. Everyone
    // else in the room can acknowledge its *real* speaker while Rizo reads.
    // Otherwise actors become mannequins the moment a dialogue box opens.
    const portraitSpeaker = speaker && actors.find(other =>
      other.visible !== false && other.id !== actor.id &&
      (other.id === speaker || (speaker === "you" && other.kind === "keeper")) &&
      near(other, 150));
    const other = portraitSpeaker ||
      (conversation && actors.find(entry => entry.id === conversation.id));
    let target = null, cue = "job", addressed = false, listening = false;
    const threatened = hood && flare && near(player, 125);
    if (threatened) { target = player; cue = "flinch"; }
    else if (actor.state === "chase" && near(player, 160)) {
      target = player; cue = "pursue";
    } else if (speakingNow && near(player, 195)) {
      target = player; cue = "address"; addressed = true;
    } else if (!actor.walking && other) {
      target = other; cue = "listen"; listening = true;
    } else if (actor.walking) {
      const dest = Number.isFinite(actor.toX) && Number.isFinite(actor.toY)
        ? { x: actor.toX, y: actor.toY } : null;
      if (dest && !near(dest, 6)) { target = dest; cue = "travel"; }
    } else {
      // The underground residents notice a rare flame, but they are also
      // occupied people. Gaze comes and goes in long held, deterministic
      // beats rather than locking onto the player on every idle frame.
      const phase = [...String(actor.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 1900;
      const window = warm ? 1900 : hood ? 700 : 0;
      const notice = window > 0 && (t + phase) % 6500 < window;
      if (notice && near(player, warm ? 108 : 72)) {
        target = player; cue = "notice";
      }
    }
    // Reduced motion removes incidental glances, but preserves meaningful
    // speech, chase and danger directions.
    if (reduced && (cue === "notice" || cue === "travel")) {
      target = null; cue = "job";
    }
    // Actual heads are not at characters' feet. When two NPCs speak, they
    // meet each other's eyes; when they address small Rizo, they naturally
    // glance down to his flame. Movement still follows the destination.
    const eyeHeight = (kind) => Art.HEIGHT?.[kind] ?? 70;
    const targetIsCast = target && target !== player && cue === "listen";
    const lookY = cue === "travel" ? target?.y :
      targetIsCast ? target.y - eyeHeight(target.kind) * .72 :
      target ? target.y - 11 : 0;
    const originY = cue === "travel" ? actor.y : actor.y - eyeHeight(actor.kind) * .72;
    return {
      look: target ? {
        x: bounded((target.x - actor.x) / 42) * (actor.face || 1),
        y: bounded((lookY - originY) / 65)
      } : still.look,
      addressed, listening, startled: Boolean(threatened), cue
    };
  }

  // Distance-driven leg cycle, shared by authored travel and chase poses.
  // Replaying the same path at a different frame rate produces the same feet.
  const footfall = (actor, reduced = false) =>
    actor?.walking && !reduced ? Math.sin((actor.stride || 0) * 1.9) * 2 : 0;

  function deviceMarkup() {
    return `<div class="dungeon-device" data-phase="enter" data-shell="locked">
  <div class="dungeon-shell">
    <i class="dungeon-rail dungeon-rail-l" aria-hidden="true"></i><i class="dungeon-rail dungeon-rail-r" aria-hidden="true"></i>
    <div class="dungeon-bezel">
      <div class="dungeon-slot">
      <div class="dungeon-screen" aria-label="Rizo Dungeon screen">
        <div class="dungeon-worldstage" aria-hidden="true">
          <canvas class="dungeon-canvas"></canvas>
          <div class="dungeon-actors"><div class="dungeon-actor"><div class="dungeon-pose"></div></div></div>
          <canvas class="dungeon-front"></canvas>
        </div>
        <div class="dungeon-barks" aria-live="polite"></div>
        <div class="dungeon-thought" hidden aria-live="polite"></div>
        <div class="dungeon-hud" aria-hidden="true"><span class="dungeon-flame"></span><b class="dungeon-room-name"></b></div>
        <div class="dungeon-objective" hidden aria-live="polite"><i aria-hidden="true">▲</i><span></span></div>
        <div class="dungeon-prompt" hidden aria-hidden="true"></div>
        <div class="dungeon-cue" hidden aria-hidden="true"></div>
        <div class="dungeon-banner" hidden aria-live="polite"></div>
        <div class="dungeon-dialogue" data-dungeon-ui hidden role="dialog" aria-live="polite"><div class="dungeon-portrait" aria-hidden="true"></div><div class="dungeon-speech"><b class="dungeon-speaker"></b><p class="dungeon-line"><span class="dungeon-line-text"></span></p></div><span class="dungeon-more" aria-hidden="true"></span></div>
        <div class="dungeon-choice" data-dungeon-ui hidden role="group" aria-label="Choose"></div>
        <div class="dungeon-fade" aria-hidden="true"></div>
        <canvas class="dungeon-fallfx" aria-hidden="true"></canvas>
        <div class="dungeon-phone" hidden aria-hidden="true"></div>
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
      device: $(".dungeon-device"), slot: $(".dungeon-slot"), screen: $(".dungeon-screen"), worldstage: $(".dungeon-worldstage"), canvas: $(".dungeon-canvas"), actors: $(".dungeon-actors"),
      actor: $(".dungeon-actor"), pose: $(".dungeon-pose"), hud: $(".dungeon-hud"), objective: $(".dungeon-objective"), flame: $(".dungeon-flame"), roomName: $(".dungeon-room-name"),
      prompt: $(".dungeon-prompt"), cue: $(".dungeon-cue"), banner: $(".dungeon-banner"), dialogue: $(".dungeon-dialogue"), line: $(".dungeon-line"), lineText: $(".dungeon-line-text"), more: $(".dungeon-more"),
      portrait: $(".dungeon-portrait"), speaker: $(".dungeon-speaker"), choice: $(".dungeon-choice"), barks: $(".dungeon-barks"),
      fade: $(".dungeon-fade"), panel: $(".dungeon-panel"), dpad: $(".dungeon-dpad"),
      thought: $(".dungeon-thought"), phone: $(".dungeon-phone"), fallfx: $(".dungeon-fallfx"), front: $(".dungeon-front"),
      keys: { primary: $('[data-dungeon-key="primary"]'), secondary: $('[data-dungeon-key="secondary"]'), system: $('[data-dungeon-key="system"]') }
    };
    const ctx = el.canvas.getContext("2d");
    // What stands in front of him (cage bars, the crate he is pressed behind):
    // a second canvas above the DOM Rizo, drawn only in rooms that need it.
    const frontCtx = el.front.getContext("2d");
    let frontLive = false;
    const metrics = { cssW: 0, cssH: 0, dpr: 1, scale: 1, viewW: CAMERA_WIDTH, viewH: 200 };
    const camera = { x: 0, y: 0, ready: false };
    // A presentation-only camera move for a named character speaking.
    // World, canonical Rizo and foreground props share one plane. HUD, barks
    // and reading cards remain full-sized and tappable outside that plane.
    let storyShot = "";
    const effects = [];
    const barkNodes = new Map();
    // Only an oversized modal card scrolls. The page and game retain their
    // touch-action/gesture lock, including on older WebKit phones.
    let cardDrag = null;
    el.panel.addEventListener("pointerdown", event => {
      if (el.panel.scrollHeight <= el.panel.clientHeight + 1 || event.button > 0) return;
      cardDrag = { id: event.pointerId, y: event.clientY, scroll: el.panel.scrollTop, moved: false };
    });
    el.panel.addEventListener("pointermove", event => {
      if (!cardDrag || cardDrag.id !== event.pointerId) return;
      const dy = event.clientY - cardDrag.y;
      if (!cardDrag.moved && Math.abs(dy) < 8) return;
      if (!cardDrag.moved) { cardDrag.moved = true; try { el.panel.setPointerCapture(event.pointerId); } catch (error) {} }
      event.preventDefault();
      el.panel.scrollTop = cardDrag.scroll - dy;
    });
    for (const type of ["pointerup", "pointercancel"]) el.panel.addEventListener(type, event => { if (cardDrag?.id === event.pointerId) cardDrag = null; });
    // Taking capture from the paragraph/button sends a *bubbling* loss from
    // that child. Only losing the panel's own capture ends its drag.
    el.panel.addEventListener("lostpointercapture", event => { if (event.target === el.panel && cardDrag?.id === event.pointerId) cardDrag = null; });
    el.panel.addEventListener("wheel", event => { el.panel.scrollTop += event.deltaY; }, { passive: true });
    let actorUnits = ACTOR_UNITS, lastFlame = -1, lastDir = "", lastKeys = "", lastPortrait = "", lastLine = "";

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
      el.front.width = Math.round(cssW * dpr);
      el.front.height = Math.round(cssH * dpr);
      el.front.style.width = `${cssW}px`;
      el.front.style.height = `${cssH}px`;
      frontLive = true;
      camera.ready = false;
      storyShot = "";
      el.worldstage.style.transform = "";
      el.worldstage.style.transformOrigin = "";
      el.dialogue.dataset.placed = "";
      sizeActor();
      return true;
    }

    // ---- the canonical Rizo
    function setPet(snapshot) {
      actorUnits = ACTOR_UNITS * (STAGE_SCALE[snapshot?.stage] || 1);
      el.pose.innerHTML = snapshot ? host.petMarkup(snapshot, { context: "dungeon", extraClass: "dungeon-rizo", label: `${snapshot.name}` }) : "";
      if (wearNode) el.pose.appendChild(wearNode);
      sizeActor();
    }
    // Something he chose to wear (the Rows wrap) rides on the Rizo in every room.
    let wearNode = null;
    function setWear(name) {
      if ((wearNode?.dataset.wear || null) === (name || null)) return;
      wearNode?.remove();
      wearNode = null;
      if (!name) return;
      wearNode = document.createElement("i");
      wearNode.className = `dungeon-wear dungeon-wear-${name}`;
      wearNode.dataset.wear = name;
      wearNode.setAttribute("aria-hidden", "true");
      wearNode.innerHTML = '<b class="dungeon-wear-strap"></b><b class="dungeon-wear-clasp"></b>';
      el.pose.appendChild(wearNode);
    }
    function sizeActor() {
      const size = Math.round(actorUnits * metrics.scale);
      el.actor.style.width = `${size}px`;
      el.actor.style.height = `${size}px`;
    }

    // ---- camera
    // A little lead in the direction of travel (presentation only), eased.
    const lead = { x: 0, y: 0 };
    function follow(px, py, roomGeo, dt, peek, heading) {
      const maxX = roomGeo.w - metrics.viewW, maxY = roomGeo.h - metrics.viewH;
      const ease = reducedMotion ? 1 : Math.min(1, dt * 2.2);
      lead.x += ((heading ? heading.x * 14 : 0) - lead.x) * ease;
      lead.y += ((heading ? heading.y * 18 : 0) - lead.y) * ease;
      const fx = peek ? peek.x : px + lead.x, fy = peek ? peek.y + metrics.viewH * 0.3 : py + lead.y;
      // A room narrower than the screen is centred, or framed on the middle it
      // asks for (the van keeps its cab and its back doors in view).
      const targetX = maxX <= 0 ? (roomGeo.cameraCenterX ?? roomGeo.w / 2) - metrics.viewW / 2 : Math.min(maxX, Math.max(0, fx - metrics.viewW / 2));
      let targetY = maxY <= 0 ? maxY / 2 : Math.min(maxY, Math.max(0, fy - metrics.viewH * 0.55));
      // A room may ask to keep one line in view when the screen is short (the
      // car keeps the store window), as long as the Rizo still fits below it.
      if (roomGeo.cameraKeep && maxY > 0 && !peek) targetY = Math.max(0, Math.min(maxY, Math.max(py - metrics.viewH + 16, Math.min(targetY, roomGeo.cameraKeep.y))));
      // Intake's crew stands against the north wall. Their redesigned heads
      // extend above it; frame that opening tableau below the HUD at the
      // same scale. Once Rizo moves south, ordinary following takes over.
      if (roomGeo.id === "intake" && py < 260 && !peek) targetY = Math.min(targetY, -90);
      if (!camera.ready) { camera.x = targetX; camera.y = targetY; camera.ready = true; return; }
      const k = reducedMotion ? 1 : Math.min(1, dt * (peek ? 3 : 7));
      camera.x += (targetX - camera.x) * k;
      camera.y += (targetY - camera.y) * k;
    }
    const toScreen = (x, y) => [(x - camera.x) * metrics.scale, (y - camera.y) * metrics.scale];

    // Let character conversations briefly carry the composition, instead of
    // showing every story beat from the same distant room camera. This is a
    // restrained optical push on the rendered world; simulation, hitboxes,
    // buttons and text never scale. No cut if either actor would be cropped.
    function directConversation(geo, pos, extras) {
      const id = !el.dialogue.hidden ? el.dialogue.dataset.speaker : "";
      const actor = id && !extras.peek && !reducedMotion && !extras.comic &&
        !(extras.barks || []).length && el.choice.hidden && el.phone.hidden
        ? (extras.npcs || []).find(entry => entry.visible !== false &&
            (entry.id === id || (id === "you" && ["keeper", "you-seat"].includes(entry.kind))))
        : null;
      const height = actor ? (Art.HEIGHT[actor.kind] || 0) : 0;
      // Special scenes, the Boss's radio and unnamed narration keep the wide
      // composition. Meaningful nearby, visible exchanges get a closer shot.
      const dist = actor ? Math.hypot(actor.x - pos.x, actor.y - pos.y) : Infinity;
      const [sx, sy] = actor ? toScreen(actor.x, actor.y - height * .55) : [0, 0];
      const [px, py] = toScreen(pos.x, pos.y);
      const inside = height > 0 && dist < 205 &&
        sx > 42 && sx < metrics.cssW - 42 &&
        sy > 65 && sy < metrics.cssH - 98 &&
        px > 25 && px < metrics.cssW - 25 &&
        py > 35 && py < metrics.cssH - 35;
      // Project both subjects through the proposed optical move. If either
      // would be pushed under a bezel/HUD edge, keep the wider shot.
      // In a narrow room Rizo may be close to the left bezel while Nell is
      // across the table. Frame BOTH, not the actor alone; a small downward
      // truck preserves the head beneath the HUD without moving gameplay.
      const x = Math.max(38, Math.min(metrics.cssW - 38, sx * .45 + px * .55));
      const y = Math.max(52, Math.min(metrics.cssH - 62, sy * .82 + py * .18));
      const zoom = 1.19, pushY = 12;
      const project = (v, origin) => origin + (v - origin) * zoom;
      const bodyTop = toScreen(actor?.x || 0, (actor?.y || 0) - height)[1];
      const safe = inside &&
        project(px, x) > 23 && project(px, x) < metrics.cssW - 23 &&
        project(sx, x) > 30 && project(sx, x) < metrics.cssW - 30 &&
        project(bodyTop, y) + pushY > 37 &&
        project(sy, y) + pushY < metrics.cssH - 95 &&
        project(py, y) + pushY > 35 && project(py, y) + pushY < metrics.cssH - 30;
      // Never re-anchor an active conversation every frame as camera easing
      // settles; that turns a quiet shot into an unwanted tracking loop.
      const key = safe ? `${geo.id}:${id}` : "";
      if (key === storyShot) return;
      storyShot = key;
      if (!safe) {
        el.worldstage.style.transform = "";
        el.worldstage.style.transformOrigin = "";
        return;
      }
      el.worldstage.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
      el.worldstage.style.transform = `translate3d(0, ${pushY}px, 0) scale(${zoom})`;
    }

    // ---- the cached room layer: static scenery painted once per room and layout
    const layer = { key: "", canvas: null, mx: 0, my: 0, w: 0, h: 0 };
    function roomLayer(geo) {
      const mx = Math.max(60, (metrics.viewW - geo.w) / 2 + 60), my = Math.max(60, (metrics.viewH - geo.h) / 2 + 60);
      const w = geo.w + mx * 2, h = geo.h + my * 2;
      // Full device resolution where it fits; a pixel budget caps the long rooms.
      const k = Math.max(0.5, Math.min(metrics.scale * metrics.dpr, Math.sqrt(7e6 / (w * h))));
      const key = `${geo.id}:${k.toFixed(3)}:${Math.round(mx)}:${Math.round(my)}`;
      if (layer.key === key && layer.canvas) return layer;
      const canvas = layer.canvas || document.createElement("canvas");
      canvas.width = Math.ceil(w * k); canvas.height = Math.ceil(h * k);
      const c = canvas.getContext("2d");
      c.setTransform(k, 0, 0, k, mx * k, my * k);
      c.clearRect(-mx, -my, w, h);
      try { Scenery.paintStatic(c, geo, { mx, my }); } catch (error) { try { console.warn("Rizo Dungeon: scenery failed", error); } catch (warnError) {} }
      Object.assign(layer, { key, canvas, mx, my, w, h });
      return layer;
    }
    const lighting = Art.createLighting(document);

    const inShelter = (geo, x, y) => (geo.shelters || []).some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
    // Rain: two streak lengths on a slant, rings where it lands; never under a roof.
    function rain(geo, time, intensity, wind = 0.25, layer = "back") {
      if (intensity <= 0 || reducedMotion) return;
      // Storms have depth. Most rain falls between the street and the cast;
      // only one quarter crosses faces. The total number of streaks is unchanged.
      // Floor ripples belong behind the actors, never pasted onto clothing.
      const count = Math.round(80 * intensity), split = Math.ceil(count * 0.75);
      const first = layer === "front" ? split : 0, last = layer === "front" ? count : split;
      ctx.strokeStyle = P.rain; ctx.lineWidth = layer === "front" ? 0.65 : 0.9;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let index = first; index < last; index += 1) {
        const speed = 0.42 + hash(index) * 0.2, long = index % 3 === 0 ? 12 : 7;
        const x = camera.x + ((hash(index + 9) * metrics.viewW * 1.2 + time * speed * wind) % (metrics.viewW * 1.2)) - metrics.viewW * 0.1;
        const y = camera.y + ((hash(index + 3) * (metrics.viewH + 40) + time * speed) % (metrics.viewH + 40)) - 20;
        if (inShelter(geo, x, y)) continue;
        ctx.moveTo(x, y); ctx.lineTo(x - long * wind, y - long);
      }
      ctx.stroke();
      if (layer === "front") return;
      ctx.strokeStyle = "rgba(176,196,222,.26)"; ctx.lineWidth = 0.7;
      for (let index = 0; index < Math.round(14 * intensity); index += 1) {
        const k = ((time / 600) + hash(index + 40)) % 1;
        const x = camera.x + hash(index + 51) * metrics.viewW, y = camera.y + hash(index + 77) * metrics.viewH;
        if (inShelter(geo, x, y)) continue;
        ctx.beginPath(); ctx.ellipse(x, y, 1 + k * 4, (1 + k * 4) * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Both passes use identical weather and world positions so a storm
    // still reads as one continuous event, not two overlapping animations.
    function paintWeather(geo, pos, time, layer) {
      if (geo.world && geo.theme !== "drain" && geo.theme !== "van") {
        const worse = geo.theme === "road" ? Math.max(0, 1 - pos.y / 700) * 0.6 : 0;
        rain(geo, time, (geo.rain || 0) + worse, 0.25 + worse * 0.4, layer);
      } else if (geo.theme === "van") rain({ shelters: Scenery.shelterOf(geo) }, time, 0.8, 1.5, layer);
      else if (geo.theme === "drain") rain({ shelters: [{ x: 0, y: 0, w: geo.w, h: geo.h - 12 }] }, time, 0.7, 0.6, layer);
    }

    // ===== ACTORS (Art cutouts; feet at x,y) =====
    let extrasTime = 0, lastRoom = {}, speaking = new Set(), lastBarks = [], lastNpcs = [], lastFlare = false, crewRizo = { x: 0, y: 0 };
    // Feet move with measured distance, not a free-running global clock.
    // Stopping mid-step now plants the feet instead of sliding in place.
    const walkBob = actor => footfall(actor, reducedMotion);
    function paintNpc(actor, time) {
      const t = reducedMotion ? 0 : time;
      const acting = performanceForActor(actor, {
        player: crewRizo, actors: lastNpcs, barks: lastBarks,
        speaker: !el.dialogue.hidden ? el.dialogue.dataset.speaker : "",
        t: extrasTime, reduced: reducedMotion,
        flare: lastFlare
      });
      const o = {
        face: actor.face || 1, bob: walkBob(actor), t, state: actor.state,
        expr: actor.expr, pinned: actor.pinned, pulling: actor.pulling, seated: actor.seated,
        addressed: acting.addressed, listening: acting.listening,
        look: acting.look
      };
      switch (actor.kind) {
        case "keeper": Art.keeper(ctx, actor.x, actor.y, { ...o, walking: actor.walking && !reducedMotion, stride: actor.stride || 0 }); break;
        case "van": Art.van(ctx, actor.x, actor.y, { lights: Boolean(lastRoom.carLights || lastRoom.vanLights), face: actor.face }); break;
        case "you-seated": Art.youSeated(ctx, actor.x, actor.y, { state: actor.state, t }); break;
        case "cart": Art.cart(ctx, actor.x, actor.y, { t, rolling: actor.walking }); break;
        case "hood-tall": case "hood-small": case "hood-cap": Art.hood(ctx, actor.kind, actor.x, actor.y, { ...o, reaching: actor.kind === "hood-cap" && Boolean(lastRoom.hands), flinch: Boolean((actor.flinchUntil && extrasTime < actor.flinchUntil) || acting.startled) }); break;
        case "van-seat": case "driver-seat": case "passenger-seat": Art.seated(ctx, actor.kind, actor.x, actor.y, crewOptions(actor, t)); break;
        case "taillights": {
          // Far off they are two red points; braking, they flare.
          const a = Math.max(0, Math.min(1, (actor.y + 160) / 300));
          if (a <= 0) break;
          const brake = lastRoom.brake ? 1.6 : 1;
          ctx.save(); ctx.globalAlpha = a;
          for (const dx of [-8, 8]) { Art.oval(ctx, actor.x + dx, actor.y, 6 * brake, 3.4 * brake, "rgba(184,53,47,.35)"); Art.oval(ctx, actor.x + dx, actor.y, 3, 1.8, lastRoom.brake ? "#ff5040" : P.a.red, true, 0.9); }
          ctx.restore();
          break;
        }
        case "latch": Art.latch(ctx, actor.x, actor.y, o); break;
        case "nell": Art.nell(ctx, actor.x, actor.y, o); break;
        case "orr": Art.orr(ctx, actor.x, actor.y, o); break;
        // v0.5: a collector as a figure in a scene (held at the counter by Nell).
        case "collector": Art.collector(ctx, actor.x, actor.y, { id: actor.id, face: actor.face || 1, state: actor.state || "patrol", bob: walkBob(actor), t }); break;
        default: break;
      }
    }

    // The van crew: who each of them is looking at, as a world point. Whoever
    // talks looks at whoever spoke before them; the others look at the
    // talker; nobody talking, they watch Rizo (they can't help it). The
    // driver watches the road. When the phone rings, everyone looks at it;
    // "stare", everyone looks at him.
    const crewTalk = { current: null, previous: null, signature: "", startedAt: 0 };
    let lastCrewRoom = "";
    const headOf = actor => ({ x: actor.x, y: actor.y - (Art.CREW_HEIGHT[actor.id] || 56) + 8 });
    function crewOptions(actor, t) {
      const npcs = lastNpcs, rizo = { x: crewRizo.x, y: crewRizo.y - 8 };
      const byId = id => npcs.find(entry => entry.id === id);
      const bark = lastBarks.find(entry => entry.id === actor.id);
      const talker = lastBarks.length ? lastBarks[lastBarks.length - 1].id : null;
      const emphasis = Boolean(bark && !bark.quiet &&
        extrasTime - crewTalk.startedAt < 1050);
      const small = byId("hood-small");
      let look = rizo;
      if (actor.state === "stare") look = rizo;
      else if (lastRoom.phoneLight === "call" && small) look = { x: small.x, y: small.y - 32 };
      else if (talker === actor.id) { const other = crewTalk.previous && crewTalk.previous !== actor.id ? byId(crewTalk.previous) : null; look = other ? headOf(other) : rizo; }
      else if (talker && byId(talker) && actor.id !== "driver") look = headOf(byId(talker));
      else if (actor.id === "driver") look = { x: actor.x - 200, y: actor.y - 60 };
      const shook = lastRoom.shake != null ? Math.max(0, 1 - (extrasTime - lastRoom.shake) / 450) : 0;
      return {
        who: actor.id, t, state: actor.state, look, talking: Boolean(bark), quiet: Boolean(bark?.quiet),
        // Cap's pointing is a single forceful gesture at the START of his
        // line; he does not mechanically point for every frame of dialogue.
        point: actor.id === "hood-cap" && (emphasis || actor.state === "stare"),
        talkAge: bark ? Math.max(0, extrasTime - crewTalk.startedAt) : 0,
        phone: actor.id === "hood-small" ? lastRoom.phoneLight || null : null,
        ride: Art.vanRide(t, reducedMotion), bump: reducedMotion ? 0 : shook
      };
    }

    // ===== ENEMIES: bodies (lit with the room), then telegraphs (above the dark) =====
    function paintEnemy(enemy, sim, time) {
      const flash = sim.t < enemy.flashUntil, t = reducedMotion ? 0 : time, p = sim.player;
      // A hit knocks the body back a little (presentation only; the sim never moves).
      const away = Math.atan2(enemy.y - p.y, enemy.x - p.x), kick = flash ? 2.2 : 0;
      const x = enemy.x + Math.cos(away) * kick, y = enemy.y + Math.sin(away) * kick;
      if (enemy.kind === "draftling") {
        if (enemy.state === "gone") {
          const age = sim.t - enemy.goneAt;
          if (age > 700) return;
          ctx.save(); ctx.globalAlpha = 1 - age / 700; Art.draftling(ctx, enemy.x, enemy.y + age * 0.012, { r: enemy.r, state: "recover", t }); ctx.restore();
          return;
        }
        const def = Content.ENEMIES.draftling;
        const k = enemy.state === "windup" ? Math.min(1, (sim.t - enemy.stateAt) / (def.windupMs * (sim.assist ? Core.T.ASSIST_ANTICIPATION : 1))) : 0;
        const committed = enemy.state === "windup" || enemy.state === "lunge";
        const angle = committed ? Math.atan2(enemy.aimY, enemy.aimX) : enemy.aware ? Math.atan2(p.y - enemy.y, p.x - enemy.x) : Math.sin(t / 900 + enemy.homeX) * 0.6;
        Art.draftling(ctx, x, y, { r: enemy.r, state: ["windup", "lunge", "recover"].includes(enemy.state) ? enemy.state : "idle", k, angle, t, flash });
      } else if (enemy.kind === "needle") {
        if (enemy.state === "gone") {
          const age = sim.t - enemy.goneAt;
          if (age > 600) return;
          ctx.save(); ctx.globalAlpha = 1 - age / 600; Art.needle(ctx, enemy.x, enemy.y, { state: "recover", aimX: enemy.aimX, aimY: enemy.aimY, t }); ctx.restore();
          return;
        }
        Art.needle(ctx, x, y, { state: enemy.state, aimX: enemy.aimX, aimY: enemy.aimY, t, flash });
      } else if (enemy.kind === "cargo") {
        // One cooler: it comes to rest where a slide ends, and the next jolt
        // drags it from there back to the front before it goes again.
        if (enemy !== latestCargo(sim)) return;
        if (enemy.state === "gone") { cooler.rest = { x: enemy.x, y: enemy.y }; Art.cooler(ctx, enemy.x, enemy.y, {}); return; }
        let cx = enemy.x, cy = enemy.y;
        if (enemy.state === "windup" && cooler.rest) {
          const k = Math.min(1, (sim.t - enemy.stateAt) / 520), ease = 1 - (1 - k) * (1 - k);
          cx = cooler.rest.x + (enemy.x - cooler.rest.x) * ease; cy = cooler.rest.y + (enemy.y - cooler.rest.y) * ease;
        }
        Art.cooler(ctx, cx, cy, { wobble: enemy.state === "windup" && !reducedMotion ? Math.sin(sim.t / 40) * 1.2 : 0 });
      } else if (enemy.kind === "collector") {
        const walking = enemy.state === "patrol" && sim.t >= (enemy.pauseUntil || 0);
        Art.collector(ctx, x, y, { id: enemy.id, face: enemy.aimX < -0.05 ? -1 : 1, state: sim.roomId === "factory" && walking ? "watch-down" : enemy.state, bob: walking && !reducedMotion ? Math.sin(sim.t / 150) * 2 : 0, t });
      } else if (enemy.kind === "runner") {
        // On his trail: not drawn until it is through the door, or while it goes round.
        if (enemy.state === "waiting" || enemy.state === "detour") return;
        Art.collector(ctx, x, y, { id: enemy.id, face: enemy.aimX < -0.05 ? -1 : 1, state: enemy.state === "caught" ? "grab" : "run", bob: !reducedMotion ? Math.sin(sim.t / 70) * 2.6 : 0, t });
      } else if (enemy.kind === "porter") {
        const open = enemy.state === "open" ? Math.min(1, (sim.t - enemy.stateAt) / 160) : 0;
        const lean = enemy.state === "charge-tell" ? Math.min(1, (sim.t - enemy.stateAt) / 400) * Math.sign(enemy.aimX || 1) : enemy.state === "charge" ? Math.sign(enemy.aimX || 1) : 0;
        Art.porter(ctx, x, y, { t, open, settled: enemy.state === "settled", flash, lean, lampAim: enemy.state === "sweep-tell" || enemy.state === "sweep" ? enemy.sweepDir || 0 : 0 });
      }
    }
    // A collector's lamp: a cold fan on the floor, stopped by walls and posts.
    // Seen, it locks bright on him; searching, it dims and wanders.
    function paintLamp(enemy, sim, time) {
      const def = Content.ENEMIES.collector, geo = Core.geoOf(sim);
      const ox = enemy.x + enemy.aimX * 6, oy = enemy.y + enemy.aimY * 4 - 2;
      const base = Math.atan2(enemy.aimY, enemy.aimX), rays = 16, pts = [];
      for (let index = 0; index <= rays; index += 1) {
        const a = base - def.halfAngle + (2 * def.halfAngle * index) / rays, dx = Math.cos(a), dy = Math.sin(a);
        const length = Core.rayLength(geo, ox, oy, dx, dy, def.range);
        pts.push([ox + dx * length, oy + dy * length]);
      }
      const spot = enemy.state === "spot", search = enemy.state === "search";
      const flicker = reducedMotion ? 0 : Math.sin(time / 70) * 0.04;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gradient = ctx.createRadialGradient(ox, oy, 2, ox, oy, def.range);
      const a = (spot ? 0.34 : search ? 0.14 : 0.2) + flicker;
      gradient.addColorStop(0, `rgba(214,232,244,${a})`); gradient.addColorStop(0.75, `rgba(170,198,218,${a * 0.45})`); gradient.addColorStop(1, "rgba(150,180,205,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(ox, oy); for (const [px, py] of pts) ctx.lineTo(px, py); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = spot ? "rgba(238,245,249,.75)" : "rgba(184,201,212,.32)"; ctx.lineWidth = spot ? 1.2 : 0.8;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(pts[0][0], pts[0][1]); ctx.moveTo(ox, oy); ctx.lineTo(pts[rays][0], pts[rays][1]); ctx.stroke();
      if (spot) {
        // The lamp has him: a hard ring and a closing bracket of time.
        const k = Math.min(1, (sim.t - enemy.stateAt) / (def.spotMs * (sim.assist ? Core.T.ASSIST_ANTICIPATION : 1)));
        const p = sim.player;
        ctx.strokeStyle = "rgba(238,245,249,.9)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 16 - k * 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        Art.label(ctx, "!", enemy.x, enemy.y - 88, { size: 14, weight: 900, color: P.cold[3], align: "center" });
      }
      ctx.restore();
    }
    // Before the first jolt the cooler sits by the seats, at the front of the bay.
    const COOLER_HOME = Object.freeze({ x: 28, y: 104 });
    const cooler = { sim: null, rest: null };
    const latestCargo = sim => { let last = null; for (const enemy of sim.enemies) if (enemy.kind === "cargo") last = enemy; return last; };
    function paintLane(enemy, def) {
      const length = def.lungeDistance + enemy.r + 6;
      const ex = enemy.x + enemy.aimX * length, ey = enemy.y + enemy.aimY * length;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = enemy.locked ? P.danger[2] : P.danger[0];
      ctx.lineWidth = enemy.locked ? 2.6 : 1.8;
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
    // The Needle's lane is its thread: drawn out slack, then pulled tight and bright.
    function paintThread(enemy, sim) {
      const def = Content.ENEMIES.needle;
      const sx = enemy.x + enemy.aimX * (enemy.r + 2), sy = enemy.y + enemy.aimY * (enemy.r + 2);
      const ex = sx + enemy.aimX * enemy.laneLength, ey = sy + enemy.aimY * enemy.laneLength;
      const px = -enemy.aimY, py = enemy.aimX, half = def.laneWidth / 2;
      ctx.save(); ctx.lineCap = "round";
      if (enemy.state === "pulse") {
        ctx.strokeStyle = P.danger[2]; ctx.lineWidth = def.laneWidth; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.lineCap = "round";
        for (let d = 6; d < enemy.laneLength; d += 8) { const cx = sx + enemy.aimX * d, cy = sy + enemy.aimY * d; ctx.beginPath(); ctx.moveTo(cx - px * 2.5 - enemy.aimX * 1.5, cy - py * 2.5 - enemy.aimY * 1.5); ctx.lineTo(cx + px * 2.5 + enemy.aimX * 1.5, cy + py * 2.5 + enemy.aimY * 1.5); ctx.stroke(); }
      } else {
        const k = Math.min(1, (sim.t - enemy.stateAt) / def.indicateMs);
        // The lane's edges, dashed; the thread itself waving less as it tightens.
        ctx.strokeStyle = P.danger[0]; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sx + px * half, sy + py * half); ctx.lineTo(ex + px * half, ey + py * half); ctx.moveTo(sx - px * half, sy - py * half); ctx.lineTo(ex - px * half, ey - py * half); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5 + 0.5 * k;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        const n = Math.max(2, Math.round(enemy.laneLength / 10));
        for (let index = 1; index <= n; index += 1) { const d = (enemy.laneLength * index) / n, wave = Math.sin(index * 1.7) * 3 * (1 - k); ctx.lineTo(sx + enemy.aimX * d + px * wave, sy + enemy.aimY * d + py * wave); }
        ctx.stroke(); ctx.globalAlpha = 1;
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex + px * half * 1.4, ey + py * half * 1.4); ctx.lineTo(ex - px * half * 1.4, ey - py * half * 1.4); ctx.stroke();
      }
      ctx.restore();
    }
    function paintSlide(enemy) {
      ctx.save(); ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(enemy.x + 12, enemy.y); ctx.lineTo(enemy.x + Content.ENEMIES.cargo.slideDistance + 10, enemy.y); ctx.stroke(); ctx.setLineDash([]);
      for (let d = 30; d < 150; d += 24) { ctx.beginPath(); ctx.moveTo(enemy.x + d - 4, enemy.y - 4); ctx.lineTo(enemy.x + d, enemy.y); ctx.lineTo(enemy.x + d - 4, enemy.y + 4); ctx.stroke(); }
      ctx.restore();
    }
    function paintPorterTell(enemy, sim, geo) {
      const def = Content.ENEMIES.porter, arena = geo.arena;
      ctx.save(); ctx.lineCap = "round";
      if (enemy.state === "sweep-tell" || enemy.state === "sweep") {
        const top = enemy.bandY - def.bandHeight / 2;
        if (enemy.state === "sweep-tell") {
          const k = Math.min(1, (sim.t - enemy.stateAt) / (def.sweepTellMs * (sim.assist ? Core.T.ASSIST_ANTICIPATION : 1)));
          ctx.fillStyle = `rgba(242,232,206,${0.04 + 0.1 * k})`; ctx.fillRect(arena.x, top, arena.w, def.bandHeight);
          ctx.strokeStyle = P.danger[1]; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(arena.x, top, arena.w, def.bandHeight); ctx.setLineDash([]);
          // The arrow says which way the light will travel.
          const ax = enemy.sweepDir === 1 ? arena.x + 16 : arena.x + arena.w - 16;
          ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, enemy.bandY - 6); ctx.lineTo(ax + 10 * enemy.sweepDir, enemy.bandY); ctx.lineTo(ax, enemy.bandY + 6); ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(255,226,160,.86)"; ctx.fillRect(enemy.beamX - def.beamWidth / 2, top, def.beamWidth, def.bandHeight);
          ctx.fillStyle = "rgba(255,248,230,.9)"; ctx.fillRect(enemy.beamX - def.beamWidth / 4, top, def.beamWidth / 2, def.bandHeight);
        }
      }
      if (enemy.state === "charge-tell") {
        ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + enemy.aimX * (def.chargeDistance + enemy.r), enemy.y + enemy.aimY * (def.chargeDistance + enemy.r)); ctx.stroke(); ctx.setLineDash([]);
        const px = -enemy.aimY, py = enemy.aimX;
        for (let d = 24; d < def.chargeDistance; d += 18) { const cx = enemy.x + enemy.aimX * d, cy = enemy.y + enemy.aimY * d; ctx.beginPath(); ctx.moveTo(cx - enemy.aimX * 5 + px * 5, cy - enemy.aimY * 5 + py * 5); ctx.lineTo(cx, cy); ctx.lineTo(cx - enemy.aimX * 5 - px * 5, cy - enemy.aimY * 5 - py * 5); ctx.stroke(); }
      }
      ctx.restore();
      if (enemy.aware && enemy.state !== "settled") {
        const frac = enemy.hp / enemy.maxHp, x = enemy.x - 24, y = enemy.y - 66;
        Art.box(ctx, x - 1, y - 1, 50, 6, P.ink, { ink: false, amp: 0.2 });
        Art.rect(ctx, P.paper[2], x + 1, y + 1, 46 * frac, 3);
        Art.rect(ctx, P.danger[2], x + 1 + 46 * (def.helpAt / enemy.maxHp), y - 1, 1, 7);
      }
    }
    function notches(enemy) {
      const hits = Math.ceil(enemy.hp / 2), max = Math.ceil(enemy.maxHp / 2);
      for (let index = 0; index < max; index += 1) Art.rect(ctx, index < hits ? P.paper[3] : "rgba(233,223,199,.25)", enemy.x - (max * 6) / 2 + index * 6, enemy.y - enemy.r - (enemy.kind === "needle" ? 30 : 12), 4, 2);
    }
    // The runner's reach, on the floor where it is real: the ring a catch
    // happens inside. Faint while he keeps ahead; hard and bright as it closes.
    function paintReach(enemy, sim) {
      const def = Content.ENEMIES.runner, p = sim.player, reach = def.catchRadius + p.r;
      const gap = Math.hypot(p.x - enemy.x, p.y - enemy.y) - reach;
      const k = Math.max(0, Math.min(1, 1 - gap / 70));
      ctx.save();
      ctx.globalAlpha = 0.14 + k * 0.6;
      ctx.strokeStyle = k > 0.6 ? P.cold[3] : P.cold[2]; ctx.lineWidth = 0.8 + k * 1.2;
      if (k < 0.6) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(enemy.x, enemy.y, reach, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function paintTelegraphs(sim, geo) {
      for (const enemy of sim.enemies) {
        if (enemy.kind === "draftling" && enemy.state === "windup") paintLane(enemy, Content.ENEMIES.draftling);
        else if (enemy.kind === "needle" && (enemy.state === "indicate" || enemy.state === "pulse")) paintThread(enemy, sim);
        else if (enemy.kind === "cargo" && enemy.state === "windup") paintSlide(enemy);
        else if (enemy.kind === "porter") paintPorterTell(enemy, sim, geo);
        else if (enemy.kind === "runner" && enemy.state === "run") paintReach(enemy, sim);
        if ((enemy.kind === "draftling" || enemy.kind === "needle") && enemy.aware && enemy.state !== "gone") notches(enemy);
        // Not yet aware, at the edge of his light: two pale points looking back.
        if (enemy.kind === "draftling" && !enemy.aware && enemy.state !== "gone") {
          const d = Math.hypot(enemy.x - sim.player.x, enemy.y - sim.player.y);
          if (d < 150) { ctx.save(); ctx.globalAlpha = Math.min(1, (150 - d) / 40) * 0.9; Art.rect(ctx, P.paper[3], enemy.x - 3.2, enemy.y - 3, 1.6, 1.6); Art.rect(ctx, P.paper[3], enemy.x + 1.6, enemy.y - 3, 1.6, 1.6); ctx.restore(); }
        }
        if (enemy.kind === "draftling" && enemy.state === "recover") {
          // Open: two loose curls above it say "now".
          ctx.save(); ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 1.2;
          for (let index = -1; index <= 1; index += 2) { ctx.beginPath(); ctx.arc(enemy.x + index * 5, enemy.y - enemy.r - 4, 2.5, 0, Math.PI * 1.5); ctx.stroke(); }
          ctx.restore();
        }
      }
    }

    // ===== THE RIZO'S FIRE =====
    function paintFlare(sim, small, time) {
      const p = sim.player, act = p.act;
      const phase = Core.flarePhase(act, sim.t);
      if (!phase || phase === "done") return;
      const angle = Math.atan2(act.fy, act.fx), half = (Core.T.FLARE_ARC_DEG / 2) * Math.PI / 180;
      const range = small ? Core.T.FLARE_RANGE * 0.55 : Core.T.FLARE_RANGE;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (phase === "anticipation") {
        // Anticipation: embers drawn in toward the mouth, a small bead growing.
        const k = (sim.t - act.start) / Core.T.FLARE_ANTICIPATION_MS;
        for (let index = 0; index < 3; index += 1) { const a = angle + (index - 1) * 0.9, d = 12 * (1 - k); Art.rect(ctx, P.ember[3], act.fx * 6 + Math.cos(a) * d - 1, act.fy * 6 + Math.sin(a) * d - 1, 2, 2); }
        Art.oval(ctx, act.fx * 7, act.fy * 7, 1.5 + k * 2.5, 1.5 + k * 2.5, P.ember[3]);
      } else {
        const k = phase === "active" ? 1 : 1 - (sim.t - act.start - Core.T.FLARE_ANTICIPATION_MS - Core.T.FLARE_ACTIVE_MS) / Core.T.FLARE_RECOVERY_MS;
        ctx.globalAlpha = Math.max(0, k);
        // The reach as one flat band (the shape is the rule), tongues of fire across it.
        ctx.fillStyle = phase === "active" ? "rgba(255,175,74,.34)" : "rgba(224,112,42,.16)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, angle - half, angle + half); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = P.danger[2]; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0, 0, range, angle - half, angle + half); ctx.stroke();
        if (phase === "active") {
          for (const [f, d, size] of [[-0.6, 0.55, 4.5], [0, 0.7, 6.5], [0.6, 0.55, 4.5]]) {
            const a = angle + f * half;
            ctx.save(); ctx.translate(Math.cos(a) * range * d, Math.sin(a) * range * d); ctx.rotate(a + Math.PI / 2);
            Art.flame(ctx, 0, size * 0.7, size * (small ? 0.6 : 1), reducedMotion ? 0 : time + f * 300);
            ctx.restore();
          }
        } else {
          ctx.strokeStyle = P.paper[0]; ctx.lineWidth = 1;
          for (let index = -1; index <= 1; index += 2) { ctx.beginPath(); ctx.arc(Math.cos(angle) * range * 0.5 + index * 4, Math.sin(angle) * range * 0.5 - (1 - k) * 8, 2.4, 0, Math.PI * 1.4); ctx.stroke(); }
        }
      }
      ctx.restore();
    }
    // Kindle progress: a ring of embers catching, one by one, around what is being warmed.
    function paintKindle(sim, geo) {
      const act = sim.player.act;
      if (act?.kind !== "kindle") return;
      const target = act.targetKind === "hearth" ? geo.hearth : geo.props.find(prop => prop.id === act.targetId);
      if (!target) return;
      const k = Math.min(1, (sim.t - act.start) / Core.T.KINDLE_MS), r = (target.r || 8) + 8, ticks = 12, lit = Math.floor(k * ticks);
      for (let index = 0; index < ticks; index += 1) {
        const a = -Math.PI / 2 + (index / ticks) * Math.PI * 2;
        Art.rect(ctx, index < lit ? P.ember[3] : P.danger[0], target.x + Math.cos(a) * r - 1.3, target.y + Math.sin(a) * r * 0.8 - 1.3, 2.6, 2.6);
      }
    }

    // ===== EFFECTS (presentation only) =====
    const steps = [];
    let stepAcc = 0, lastPos = null, stepSide = 1;
    function paintEffects(time) {
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const fx = effects[index], age = (time - fx.at) / fx.life;
        if (age >= 1) { effects.splice(index, 1); continue; }
        if (age < 0) continue;
        ctx.save(); ctx.globalAlpha = 1 - age;
        if (fx.kind === "spark") Art.rect(ctx, age < 0.5 ? P.ember[4] : P.ember[3], fx.x + fx.vx * age * 16 - 1, fx.y + fx.vy * age * 16 - 1 - age * 4, 2, 2);
        else if (fx.kind === "impact") {
          // A hard four-point star at the hit, gone in a blink.
          const r = 3 + age * 7;
          Art.shape(ctx, [fx.x, fx.y - r, fx.x + r * 0.25, fx.y - r * 0.25, fx.x + r, fx.y, fx.x + r * 0.25, fx.y + r * 0.25, fx.x, fx.y + r, fx.x - r * 0.25, fx.y + r * 0.25, fx.x - r, fx.y, fx.x - r * 0.25, fx.y - r * 0.25], P.danger[2], { ink: 1, amp: 0.1 });
        } else if (fx.kind === "puff") { Art.oval(ctx, fx.x, fx.y, 3 + age * 9, (3 + age * 9) * 0.45, null, false); ctx.strokeStyle = P.paper[2]; ctx.lineWidth = 1.4 * (1 - age) + 0.3; ctx.stroke(); }
        else if (fx.kind === "glint") {
          // A catch of light on something he has just seen: small, warm, once.
          const r = 2 + Math.sin(Math.min(1, age * 1.4) * Math.PI) * 3.4;
          ctx.globalAlpha = Math.sin(age * Math.PI) * 0.9;
          Art.shape(ctx, [fx.x, fx.y - r, fx.x + r * 0.2, fx.y - r * 0.2, fx.x + r, fx.y, fx.x + r * 0.2, fx.y + r * 0.2, fx.x, fx.y + r, fx.x - r * 0.2, fx.y + r * 0.2, fx.x - r, fx.y, fx.x - r * 0.2, fx.y - r * 0.2], P.paper[3], { ink: false, amp: 0 });
        } else if (fx.kind === "mote") {
          // Air moving: a speck carried from the way on toward him.
          ctx.globalAlpha = Math.sin(age * Math.PI) * 0.9;
          const wob = Math.sin(age * 9 + fx.seed) * 2.4;
          Art.rect(ctx, P.paper[3], fx.x + fx.vx * age + wob * -fx.vy / 40 - 1.1, fx.y + fx.vy * age + wob * fx.vx / 40 - 1.1, 2.2, 2.2);
        }
        else if (fx.kind === "frost") {
          // Frost letting go of glass: a few cold chips that drop and melt.
          ctx.globalAlpha = (1 - age) * 0.9;
          Art.rect(ctx, age < 0.4 ? "#eef5f9" : "#b8c9d4", fx.x + fx.vx * 7 * age, fx.y + Math.abs(fx.vy) * 3 + age * age * 14, 1.6 * (1 - age * 0.5), 1.1);
        }
        else if (fx.kind === "deflect") { ctx.strokeStyle = P.paper[3]; ctx.lineWidth = 1.4; for (let d = 0; d < 3; d += 1) { ctx.beginPath(); ctx.moveTo(fx.x + (d - 1) * 6 - 3, fx.y - age * 10 + 2); ctx.lineTo(fx.x + (d - 1) * 6, fx.y - age * 10 - 2); ctx.lineTo(fx.x + (d - 1) * 6 + 3, fx.y - age * 10 + 2); ctx.stroke(); } }
        ctx.restore();
      }
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        const fx = steps[index], age = (time - fx.at) / fx.life;
        if (age >= 1) { steps.splice(index, 1); continue; }
        ctx.save(); ctx.globalAlpha = (1 - age) * 0.8;
        if (fx.kind === "ripple") { ctx.strokeStyle = P.wet[3]; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 1.5 + age * 6, (1.5 + age * 6) * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); }
        else { Art.rect(ctx, P.paper[1], fx.x - 2 - age * 3, fx.y - age * 3, 1.4, 1.4); Art.rect(ctx, P.paper[1], fx.x + 1 + age * 3, fx.y - age * 2, 1.2, 1.2); }
        ctx.restore();
      }
    }
    function addEffect(kind, x, y, count = 1, time = performance.now()) {
      if (reducedMotion && kind === "frost") return;
      for (let index = 0; index < count; index += 1) {
        if (effects.length >= MAX_EFFECTS) effects.shift();
        const angle = Math.random() * Math.PI * 2;
        effects.push({ kind, x, y, vx: Math.cos(angle), vy: Math.sin(angle), at: time, life: kind === "spark" ? 360 : kind === "glint" ? 1100 : kind === "frost" ? 700 : 460 });
      }
      if (kind === "spark") { if (effects.length >= MAX_EFFECTS) effects.shift(); effects.push({ kind: "impact", x, y, vx: 0, vy: 0, at: time, life: 140 }); }
    }
    // A draft from somewhere he hasn't been yet: a few specks drifting from
    // (x, y) toward (toX, toY), never all the way. The room's own way of pointing.
    function addDraft(x, y, toX, toY, count = 6, time = performance.now()) {
      addEffect("glint", x, y, 1, time);
      if (reducedMotion) return;
      const dx = toX - x, dy = toY - y, d = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(d * 0.7, 120);
      for (let index = 0; index < count; index += 1) {
        if (effects.length >= MAX_EFFECTS) effects.shift();
        const spread = (index - (count - 1) / 2) * 7;
        effects.push({ kind: "mote", x: x + (-dy / d) * spread, y: y + (dx / d) * spread, vx: (dx / d) * reach, vy: (dy / d) * reach, seed: index * 1.7, at: time + index * 160, life: 2300 });
      }
    }
    // Footfalls: ripples in the wet outside, a little grit below.
    function trackSteps(geo, pos, time, moving) {
      if (reducedMotion) return;
      if (lastPos && moving) stepAcc += Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y);
      lastPos = { x: pos.x, y: pos.y };
      if (stepAcc < 11) return;
      stepAcc = 0; stepSide = -stepSide;
      const wet = geo.world && !inShelter(geo, pos.x, pos.y) && geo.theme !== "van";
      if (steps.length > 6) steps.shift();
      steps.push({ kind: wet ? "ripple" : "dust", x: pos.x + stepSide * 2.5, y: pos.y + 7, at: time, life: wet ? 700 : 380 });
    }
    // Draws one frame. `pos` is the interpolated player position.
    // Order is the art rule: room (cached) → live scenery → actors by depth →
    // rain → the dark with its light pools → telegraphs, fire and sparks on top.
    function render(sim, pos, time, dt, extras = {}) {
      const geo = Core.room(sim.roomId);
      if (!geo || !metrics.cssW) return;
      extrasTime = extras.sceneTime || 0;
      lastRoom = extras.room || {};
      // During the kidnapping, contact is not the cut. Once the hands close,
      // Rizo visibly leaves the passenger seat and is dragged to the forced
      // door. This is presentation-only; the story scene owns control.
      if (geo.theme === "car" && lastRoom.carryAt != null) {
        const k = Math.max(0, Math.min(1, (extrasTime - lastRoom.carryAt) / 850));
        const eased = 1 - Math.pow(1 - k, 3);
        const from = lastRoom.carryFrom || pos;
        pos = { x: from.x + (228 - from.x) * eased, y: from.y + (248 - from.y) * eased };
      }
      speaking = new Set((extras.barks || []).map(item => item.id));
      lastBarks = extras.barks || []; lastNpcs = extras.npcs || [];
      if (lastCrewRoom !== geo.id) {
        crewTalk.current = null; crewTalk.previous = null;
        crewTalk.signature = ""; crewTalk.startedAt = extrasTime;
        lastCrewRoom = geo.id;
      }
      const activeBark = lastBarks.at(-1);
      const talker = activeBark?.id || null;
      const signature = activeBark ? `${activeBark.id}:${activeBark.text}` : "";
      if (signature && signature !== crewTalk.signature) {
        if (talker !== crewTalk.current) crewTalk.previous = crewTalk.current;
        crewTalk.current = talker; crewTalk.signature = signature;
        crewTalk.startedAt = extrasTime;
      } else if (!signature && crewTalk.signature) {
        // A silent interval ends the turn; another line even from the SAME
        // crew member will get a fresh gesture, not a stale pointing loop.
        crewTalk.previous = crewTalk.current;
        crewTalk.current = null; crewTalk.signature = "";
      }
      const p = sim.player;
      crewRizo = { x: pos.x, y: pos.y };
      lastFlare = p.act?.kind === "flare" && Core.flarePhase(p.act, sim.t) === "active";
      follow(pos.x, pos.y, geo, dt, extras.peek, p.moving ? { x: p.fx || 0, y: p.fy || 0 } : null);
      directConversation(geo, pos, extras);
      const shake = extras.shake && !reducedMotion ? extras.shake * 2 : 0;
      const ox = shake ? (Math.sin(time / 23) * shake) : 0, oy = shake ? (Math.cos(time / 29) * shake) : 0;
      const s = metrics.scale * metrics.dpr;
      ctx.setTransform(s, 0, 0, s, (-camera.x + ox) * s, (-camera.y + oy) * s);
      ctx.imageSmoothingEnabled = true;
      const view = { x: camera.x, y: camera.y, w: metrics.viewW, h: metrics.viewH };
      const scene = { sim, time, extras, view, pos, reduced: reducedMotion };
      if (Scenery.transparent(geo)) Scenery.paintUnder(ctx, geo, scene);
      else { ctx.fillStyle = P.void; ctx.fillRect(camera.x - 40, camera.y - 40, metrics.viewW + 80, metrics.viewH + 80); }
      const room = roomLayer(geo);
      ctx.drawImage(room.canvas, -room.mx, -room.my, room.w, room.h);
      Scenery.paintDynamic(ctx, geo, scene);
      // Behind-camera rain builds the weather without washing out the actors'
      // new facial art. A lighter foreground pass finishes the depth cue.
      paintWeather(geo, pos, time, "back");
      // The Rizo's contact with the ground: a hard shadow, and outside, his light on the wet.
      const sheltered = inShelter(geo, pos.x, pos.y);
      if (geo.world && !sheltered && geo.theme !== "van") { ctx.save(); ctx.globalAlpha = 0.22; Art.rect(ctx, P.wet[3], pos.x - 2, pos.y + 9, 4, 3); Art.rect(ctx, P.wet[3], pos.x - 1.5, pos.y + 13.5, 3, 2); ctx.restore(); }
      Art.drop(ctx, pos.x - 1.5, pos.y + 5, 9, 3, 0.45);
      ctx.save(); ctx.globalAlpha = 0.35; Art.oval(ctx, pos.x, pos.y + 6.2, 5, 1.6, P.ink); ctx.restore();
      trackSteps(geo, pos, time, p.moving);
      // Actors and enemy bodies in depth order: whoever stands lower is in front.
      const bodies = [];
      // The van's sort point is its near side, so people climbing out stand in front of it.
      for (const actor of extras.npcs || []) bodies.push({ y: actor.kind === "van" ? actor.y - 30 : actor.y, draw: () => paintNpc(actor, time) });
      for (const enemy of sim.enemies) bodies.push({ y: enemy.y + (enemy.kind === "porter" ? 20 : enemy.r), draw: () => paintEnemy(enemy, sim, time) });
      for (const body of Scenery.bodies(geo, scene)) bodies.push({ y: body.y, draw: () => body.draw(ctx) });
      if (geo.theme === "van") {
        if (cooler.sim !== sim) { cooler.sim = sim; cooler.rest = null; }
        if (!latestCargo(sim)) { cooler.rest = { ...COOLER_HOME }; bodies.push({ y: COOLER_HOME.y + 9, draw: () => Art.cooler(ctx, COOLER_HOME.x, COOLER_HOME.y, {}) }); }
      }
      bodies.sort((a, b) => a.y - b.y);
      for (const body of bodies) body.draw();
      paintWeather(geo, pos, time, "front");
      // The dark, and what cuts it.
      const lit = Scenery.lights(geo, scene);
      const flame = Math.max(0, p.flame);
      const lightScale = extras.lightScale ?? 1;
      if (lightScale > 0) lit.list.push({ x: pos.x, y: pos.y - 2, r: ((geo.world ? 30 : 46) + flame * 8) * lightScale, strength: geo.world ? 0.75 : 1, warm: geo.world ? 0.3 : 0.6 });
      // In close, player-paced conversations a little of Rizo's warmth
      // reaches the speaker's face. This is bounced firelight, not an
      // unmotivated spotlight: it vanishes with his flame and never follows
      // distant radio calls, collectors, or active stealth gameplay.
      const speakerId = !el.dialogue.hidden ? el.dialogue.dataset.speaker : "";
      const closeSpeaker = speakerId && (extras.npcs || []).find(actor =>
        actor.visible !== false && actor.id === speakerId &&
        ["nell", "orr", "latch"].includes(actor.kind));
      if (closeSpeaker && lightScale > 0 && flame > 0) {
        const distance = Math.hypot(closeSpeaker.x - pos.x, closeSpeaker.y - pos.y);
        if (distance < 115) {
          const bounce = (1 - distance / 115) * Math.min(1, flame / 2);
          lit.list.push({ x: closeSpeaker.x, y: closeSpeaker.y - (Art.HEIGHT[closeSpeaker.kind] || 70) * .62,
            r: 40 + 12 * bounce, strength: .23 * bounce, warm: .55 * bounce });
        }
      }
      // Fire briefly lights what it reaches, using the existing bounded light
      // pass. A dying flame still shortens the ordinary pool after the action.
      if (lightScale > 0 && p.act?.kind === "flare" && Core.flarePhase(p.act, sim.t) === "active") lit.list.push({ x: pos.x + p.act.fx * 18, y: pos.y + p.act.fy * 18, r: geo.world ? 38 : 64, strength: 0.65, warm: 1 });
      for (const enemy of sim.enemies) if (enemy.kind === "collector" || (enemy.kind === "runner" && enemy.state === "run")) lit.list.push({ x: enemy.x + enemy.aimX * 30, y: enemy.y + enemy.aimY * 30 - 4, r: 44, strength: 0.5, warm: 0 });
      lighting.apply(ctx, view, lit.ambient, lit.list);
      Scenery.paintOver?.(ctx, geo, scene);
      for (const enemy of sim.enemies) if (enemy.kind === "collector") paintLamp(enemy, sim, time);
      // Waking in the dark: a pinprick of his flame before anything else.
      const actorLight = extras.actorLight ?? 1;
      if (actorLight > 0 && actorLight < 0.6) { ctx.save(); ctx.globalAlpha = 1 - actorLight; Art.flame(ctx, pos.x, pos.y - 4, 1.4 + actorLight * 4, reducedMotion ? 0 : time); ctx.restore(); }
      setActorLight(actorLight);
      // A window lamp in his eyes: a cold white glare where he stands.
      if (sim.t < (p.dazzledUntil ?? -1)) {
        const k = (p.dazzledUntil - sim.t) / Content.ENEMIES.runner.dazzleMs;
        ctx.save(); ctx.globalAlpha = 0.55 * k; Art.oval(ctx, pos.x, pos.y - 6, 22, 16, P.cold[3]); ctx.globalAlpha = 0.8 * k; Art.oval(ctx, pos.x, pos.y - 6, 9, 7, "#ffffff"); ctx.restore();
      }
      // Caught: a lamp full in his face for a beat, before the dark comes down.
      const caughtAge = lastRoom.caughtAt != null ? extrasTime - lastRoom.caughtAt : Infinity;
      if (caughtAge >= 0 && caughtAge < 360) {
        const k = 1 - caughtAge / 360, grow = reducedMotion ? 0 : 1 - k;
        ctx.save(); ctx.globalAlpha = 0.6 * k; Art.oval(ctx, pos.x, pos.y - 6, 20 + grow * 16, 15 + grow * 12, P.cold[3]); ctx.globalAlpha = 0.9 * k; Art.oval(ctx, pos.x, pos.y - 6, 8, 6, "#ffffff"); ctx.restore();
      }
      paintTelegraphs(sim, geo);
      paintFocus(extras.focus);
      paintKindle(sim, geo);
      paintFlare(sim, Boolean(geo.world), time);
      paintEffects(time);
      // The DOM actor follows the same camera.
      const [ax, ay] = toScreen(pos.x + ox, pos.y + oy + Core.T.PLAYER_RADIUS * 0.6);
      const size = actorUnits * metrics.scale;
      // In the van he sways with everyone else.
      const sway = geo.theme === "van" && !reducedMotion ? ` rotate(${(Art.vanRide(time, false).surge * 3).toFixed(2)}deg)` : "";
      el.actor.style.transform = `translate3d(${(ax - size / 2).toFixed(1)}px, ${(ay - size * 0.84).toFixed(1)}px, 0)${sway}`;
      if (Scenery.hasFront(geo)) {
        frontCtx.setTransform(1, 0, 0, 1, 0, 0);
        frontCtx.clearRect(0, 0, el.front.width, el.front.height);
        frontCtx.setTransform(s, 0, 0, s, (-camera.x + ox) * s, (-camera.y + oy) * s);
        Scenery.paintFront(frontCtx, geo, scene);
        frontLive = true;
      } else if (frontLive) { frontCtx.setTransform(1, 0, 0, 1, 0, 0); frontCtx.clearRect(0, 0, el.front.width, el.front.height); frontLive = false; }
      // Full-line space is reserved before the typewriter starts. Choose the
      // end of the screen that leaves Rizo and the speaking body most visible.
      if (!el.dialogue.hidden && !el.dialogue.dataset.placed) {
        const height = el.dialogue.offsetHeight || 72;
        const protectedBodies = [{ x: ax - size / 2, y: ay - size * 0.84, w: size, h: size, weight: 3 }];
        const speaker = (extras.npcs || []).find(actor => actor.id === el.dialogue.dataset.speaker);
        if (speaker) {
          const [sx, sy] = toScreen(speaker.x, speaker.y);
          const h = (Art.HEIGHT[speaker.kind] || 54) * metrics.scale;
          protectedBodies.push({ x: sx - h * 0.22, y: sy - h, w: h * 0.44, h, weight: 1 });
        }
        const cost = y => protectedBodies.reduce((sum, body) => sum + overlap({ x: 8, y, w: metrics.cssW - 16, h: height }, body) * body.weight, 0);
        el.dialogue.classList.toggle("at-top", cost(30) < cost(metrics.cssH - height - 8));
        el.dialogue.dataset.placed = "1";
      }
      renderBarks(extras.barks || [], extras.npcs || [], { x: ax - size / 2 - 4, y: ay - size * 0.84 - 4, w: size + 8, h: size + 8 });
      renderThought(extras.thought, pos);
    }
    // Reachable things share a quiet pair of brackets. Fire still has its own
    // arc and threat telegraphs keep their sharper bands and chevrons.
    function paintFocus(target) {
      if (!target) return;
      const r = Math.max(8, Math.min(14, target.r + 4));
      ctx.save(); ctx.strokeStyle = P.paper[3]; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(target.x + side * (r - 3), target.y - r * 0.6);
        ctx.lineTo(target.x + side * r, target.y - r * 0.6);
        ctx.lineTo(target.x + side * r, target.y + r * 0.6);
        ctx.lineTo(target.x + side * (r - 3), target.y + r * 0.6);
      }
      ctx.stroke(); ctx.restore();
    }
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    // Actor brightness: only waking in the dark changes it.
    let lastActorLight = -1;
    function setActorLight(k) {
      const value = Math.round(k * 50) / 50;
      if (value === lastActorLight) return;
      lastActorLight = value;
      el.actor.style.filter = value >= 1 ? "" : `brightness(${(0.12 + value * 0.88).toFixed(2)})`;
      el.actor.style.opacity = value <= 0 ? "0" : "";
    }
    // A thought (v0.3): his, not speech. Lowercase, small, beside him, no box or name; it fades itself.
    function renderThought(thought, pos) {
      if (!thought || thought.alpha <= 0) { if (!el.thought.hidden) { el.thought.hidden = true; el.thought.textContent = ""; } return; }
      if (el.thought.textContent !== thought.text) el.thought.textContent = thought.text;
      el.thought.hidden = false;
      const [x, y] = toScreen(pos.x + 12, pos.y - 34);
      const drift = reducedMotion ? 0 : (1 - thought.alpha) * -4;
      el.thought.style.opacity = thought.alpha.toFixed(2);
      el.thought.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y + drift)}px, 0)`;
    }
    // The phone in the grass, up close. Only CALLER_SYMBOL (a neutral
    // placeholder until the owner picks the glyph) and, connected, a timer.
    let lastPhone = "";
    function phone(state) {
      const key = state ? `${state.connected}:${state.ringing}:${state.seconds}` : "";
      if (key === lastPhone) return;
      lastPhone = key;
      if (!state) { el.phone.hidden = true; el.phone.innerHTML = ""; return; }
      const time = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(state.seconds % 60).padStart(2, "0")}`;
      el.phone.hidden = false;
      el.phone.classList.toggle("is-ringing", state.ringing && !reducedMotion);
      el.phone.classList.toggle("is-connected", state.connected);
      el.phone.innerHTML = `<div class="dungeon-phone-screen">${callerSymbol()}${state.connected ? `<span class="dungeon-phone-timer">${time}</span>` : ""}</div>`;
    }
    // A fall in the black: his flame streaking, three glimpses of the deep.
    let fallCtx = null;
    function fallFx(state) {
      const c = el.fallfx;
      if (!state) { if (c.dataset.on) { c.dataset.on = ""; fallCtx?.clearRect(0, 0, c.width, c.height); } return; }
      const w = Math.round(metrics.cssW * metrics.dpr), h = Math.round(metrics.cssH * metrics.dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.style.width = `${metrics.cssW}px`; c.style.height = `${metrics.cssH}px`; }
      fallCtx = fallCtx || c.getContext("2d");
      c.dataset.on = "1";
      const g = fallCtx, k = Math.min(1, state.t / state.ms), s = metrics.scale * metrics.dpr, vw = metrics.viewW, vh = metrics.viewH;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, vw, vh);
      const cx = vw / 2, cy = vh * 0.46;
      if (reducedMotion) {
        // No streak, no flashes: one ember, dimming slowly.
        g.globalAlpha = Math.max(0, 1 - k);
        Art.flame(g, cx, cy, 3.4, 0, { still: true });
        g.globalAlpha = 1;
        return;
      }
      // Three glimpses: a pipe, stitched cloth, a lit window very far off.
      const flashes = [[0.18, "pipe"], [0.42, "cloth"], [0.66, "window"]];
      for (const [at, kind] of flashes) {
        const age = (k - at) / 0.07;
        if (age < 0 || age > 1) continue;
        g.globalAlpha = Math.sin(age * Math.PI) * 0.85;
        const y = cy - 60 + (1 - age) * 140;
        if (kind === "pipe") { Art.box(g, cx - 64, y - 70, 14, 150, P.metal[1], { ink: 1.4, amp: 0.2 }); for (let d = -60; d < 80; d += 22) Art.rivet(g, cx - 57, y + d, 1.2); }
        else if (kind === "cloth") { Art.box(g, cx + 22, y - 40, 54, 80, P.paper[1], { ink: 1.2, amp: 0.6 }); Art.stitches(g, cx + 30, y - 30, cx + 30, y + 34, P.ink, 4, 2, 0.8); }
        else { Art.rect(g, P.sodium[2], cx - 30, y - 20, 6, 8); Art.rect(g, P.ember[4], cx - 29, y - 19, 4, 3); }
      }
      g.globalAlpha = 1;
      // His flame streaks: a smear of light trailing above him.
      const trail = g.createLinearGradient(cx, cy - 80, cx, cy);
      trail.addColorStop(0, "rgba(255,175,74,0)"); trail.addColorStop(1, "rgba(255,175,74,.55)");
      g.fillStyle = trail; g.fillRect(cx - 2.2, cy - 80, 4.4, 80);
      Art.flame(g, cx, cy + 4, 4.5, time0 + state.t);
    }
    const time0 = 0;
    // Speech bubbles over NPCs: DOM, 14px, never covering the controls.
    function renderBarks(list, actors, rizo) {
      if (!list.length && !barkNodes.size) return;
      const seen = new Set();
      const occupied = [rizo];
      // Dialogue may cover a hem or the floor; it should not erase the new
      // faces. Use the existing head-height contracts for standing/seated
      // actors, including Latch, when choosing a bubble attachment.
      for (const actor of actors) {
        if (!actor.visible) continue;
        const seated = ["van-seat", "driver-seat", "passenger-seat"].includes(actor.kind);
        const h = seated ? Art.CREW_HEIGHT[actor.id] : Art.HEIGHT[actor.kind];
        if (!h || actor.kind === "van" || actor.kind === "porter") continue;
        const [hx, hy] = toScreen(actor.x, actor.y - h);
        const w = Math.min(34, h * .7) * metrics.scale, height = Math.min(30, h * .6) * metrics.scale;
        occupied.push({ x: hx - w / 2, y: hy, w, h: height });
      }
      if (!el.dialogue.hidden) { const h = el.dialogue.offsetHeight; occupied.push({ x: 8, y: el.dialogue.classList.contains("at-top") ? 30 : metrics.cssH - h - 8, w: metrics.cssW - 16, h }); }
      // The goal line under the HUD is read at a glance; a bubble never sits on it.
      if (!el.objective.hidden) occupied.push({ x: el.objective.offsetLeft, y: el.objective.offsetTop, w: el.objective.offsetWidth, h: el.objective.offsetHeight + 4 });
      for (const item of list) {
        const actor = actors.find(entry => entry.id === item.id);
        if (!actor) continue;
        seen.add(item.id);
        let node = barkNodes.get(item.id);
        if (!node) { node = document.createElement("div"); node.className = "dungeon-bark"; el.barks.appendChild(node); barkNodes.set(item.id, node); }
        if (node.textContent !== item.text) node.textContent = item.text;
        node.classList.toggle("is-quiet", Boolean(item.quiet));
        if (node.dataset.speaker !== (item.speaker || "")) node.dataset.speaker = item.speaker || "";
        // Seated figures (the van) are short; they say where their heads are.
        const lift = actor.barkLift ?? (Art.HEIGHT[actor.kind] || 54) + 4;
        // Off screen (someone calling from up the road), the bubble waits at the edge nearest them.
        let [x, y] = toScreen(actor.x + (actor.barkDx || 0), actor.y - lift);
        const width = node.offsetWidth || 120, height = node.offsetHeight || 30, edge = 8;
        const off = x < 0 || x > metrics.cssW || y < height + 30 || y > metrics.cssH - 10;
        // Try the natural head position first, then beside it. Clamp each
        // candidate; never trade a readable line for hiding the small flame.
        // Someone sitting under somebody else (the driver, under the tall one)
        // speaks from below, so the tail can only mean them.
        const below = y + height + lift * metrics.scale + 12;
        const candidates = actor.barkBelow ? [[x, below], [x + width * 0.55, below], [x - width * 0.55, below], [x, y], [x, below + height + 16]] : [[x, y], [x + width * 0.55, y], [x - width * 0.55, y], [x, y - height - 12], [x, below], [x, below + height + 16]];
        let best = null;
        for (const [cx, cy] of candidates) {
          const bx = Math.min(metrics.cssW - width / 2 - edge, Math.max(width / 2 + edge, cx));
          const by = Math.min(metrics.cssH - edge - 8, Math.max(height + 34, cy));
          const bounds = { x: bx - width / 2 - 3, y: by - height - 3, w: width + 6, h: height + 12 };
          const score = occupied.reduce((sum, rect) => sum + overlap(bounds, rect), 0) * 100 + Math.hypot(bx - x, by - y);
          if (!best || score < best.score) best = { x: bx, y: by, bounds, score };
        }
        // The tail stays over the speaker's head, wherever the bubble had to go.
        const tail = Math.round(Math.min(width - 12, Math.max(12, x - (best.x - width / 2))));
        if (node.dataset.tail !== String(tail)) { node.dataset.tail = String(tail); node.style.setProperty("--tail", `${tail}px`); }
        x = best.x; y = best.y; occupied.push(best.bounds);
        node.classList.toggle("is-edge", off);
        node.classList.toggle("is-below", y > toScreen(actor.x, actor.y)[1]);
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
    // What he is trying to do now. A new one flashes once; the same one stays quiet.
    // Hidden (a line being read, a comic) keeps the text: it does not flash again on return.
    let objectiveText = "";
    function setObjective(text, visible = true) {
      const next = String(text || "");
      const hide = !next || !visible;
      if (el.objective.hidden !== hide) el.objective.hidden = hide;
      if (next === objectiveText) return;
      objectiveText = next;
      el.objective.querySelector("span").textContent = next;
      el.objective.classList.remove("is-new");
      if (next && !hide && !reducedMotion) { void el.objective.offsetWidth; el.objective.classList.add("is-new"); }
    }
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
      if (!node) return;
      if (reducedMotion) { node.classList.add("is-hinted"); setTimeout(() => node.classList.remove("is-hinted"), 1600); return; }
      node.classList.remove("is-pulsing");
      void node.offsetWidth;
      node.classList.add("is-pulsing");
      setTimeout(() => node.classList.remove("is-pulsing"), 1600);
    }
    function showPrompt(target, label) {
      if (!target) { if (!el.prompt.hidden) el.prompt.hidden = true; return; }
      let [x, y] = toScreen(target.x, target.y - target.r - 6);
      el.prompt.hidden = false;
      if (el.prompt.textContent !== label) el.prompt.textContent = label;
      const half = el.prompt.offsetWidth / 2;
      x = Math.max(half + 8, Math.min(metrics.cssW - half - 8, x));
      y = Math.max(el.prompt.offsetHeight + 30, Math.min(metrics.cssH - 8, y));
      el.prompt.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    }
    function showCue(markup) { if (!markup) { if (!el.cue.hidden) { el.cue.hidden = true; el.cue.innerHTML = ""; } return; } if (el.cue.innerHTML !== markup) el.cue.innerHTML = markup; el.cue.hidden = false; }
    function banner(text) { el.banner.textContent = text || ""; el.banner.hidden = !text; }
    // Dialogue: a speaker's portrait (data-driven expression) beside the line.
    function dialogue(text, { done = false, speaker = null, expr = null, fullText = text, auto = false, last = false } = {}) {
      // null, not "": the next line always redraws its portrait (narration hides it).
      if (text === null) { el.dialogue.hidden = true; el.lineText.textContent = ""; el.line.dataset.fullText = ""; lastPortrait = null; lastLine = ""; el.dialogue.dataset.placed = ""; el.dialogue.classList.remove("at-top"); return; }
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
      const lineKey = `${speaker}:${fullText}`;
      if (lastLine !== lineKey) { lastLine = lineKey; el.line.dataset.fullText = fullText; el.dialogue.dataset.placed = ""; }
      if (el.lineText.textContent !== text) el.lineText.textContent = text;
      // Keep a stable footer while the line reveals; the whole card is the target.
      el.dialogue.dataset.reading = done ? "ready" : "revealing";
      el.more.textContent = !done ? "TAP TO REVEAL" : auto ? "TAP TO CONTINUE · AUTO" : last ? "TAP TO CLOSE ▾" : "TAP TO CONTINUE ▾";
    }
    // `line` ({ speaker, text }): the question, kept above its answers.
    function choice(options, selected = 0, line = null) {
      if (!options) { el.choice.hidden = true; el.choice.innerHTML = ""; el.choice.classList.remove("has-line"); el.choice.setAttribute("aria-label", "Choose"); return; }
      el.choice.hidden = false;
      el.choice.style.setProperty("--choices", options.length);
      const who = line?.speaker ? Content.SPEAKERS[line.speaker] : null;
      const asked = line ? `<p class="dungeon-choice-line">${who ? `<b>${esc(who.name)}</b>` : ""}${esc(line.text)}</p>` : "";
      el.choice.classList.toggle("has-line", Boolean(line));
      el.choice.setAttribute("aria-label", line ? `${who ? `${who.name}: ` : ""}${line.text}` : "Choose");
      el.choice.innerHTML = asked + options.map((option, index) => `<button type="button" class="${index === selected ? "is-selected" : ""}" data-choice-index="${index}" aria-pressed="${index === selected}">${esc(option.label)}</button>`).join("");
    }
    function panel(markup) {
      cardDrag = null;
      if (!markup) { el.panel.hidden = true; el.panel.innerHTML = ""; el.device.classList.remove("panel-open"); return; }
      el.panel.innerHTML = markup;
      el.panel.hidden = false;
      el.device.classList.add("panel-open");
      el.panel.querySelector("button")?.focus({ preventScroll: true });
    }
    function setFade(value) { const next = String(Math.round(value * 100) / 100); if (el.fade.style.opacity !== next) el.fade.style.opacity = next; }
    function setPhase(phase) { el.device.dataset.phase = phase; }
    function setShell(state) { if (el.device.dataset.shell !== state) { el.device.dataset.shell = state; requestAnimationFrame(() => layout()); } }
    function destroy() { slotObserver?.disconnect(); el.worldstage.style.transform = ""; lastPhone = ""; lastActorLight = -1; effects.length = 0; steps.length = 0; barkNodes.clear(); layer.canvas = null; layer.key = ""; arena.innerHTML = ""; }

    layout();
    // The mode stylesheet and shell transition can change the slot after
    // launch's first frame. Keep cutouts at the real phone size instead of
    // retaining a short launch canvas that clips the seated crew's heads.
    const slotObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => layout()) : null;
    slotObserver?.observe(el.slot);
    return { el, layout, setPet, setWear, render, phone, fallFx, setPose, setFlame, setRoomName, setObjective, setKeys, setActionLabel, pulseKey, showPrompt, showCue, banner, dialogue, choice, panel, setFade, setPhase, setShell, addEffect, addDraft, toScreen, metrics, camera, destroy, esc };
  }

  return Object.freeze({ create, CAMERA_WIDTH, DPR_CAP, esc, performanceForActor, footfall });
});
