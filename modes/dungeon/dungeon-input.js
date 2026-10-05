/*
  RIZO DUNGEON — INPUT
  ====================
  One semantic action state fed by every device: moveX/moveY, primary
  held/pressed/released, secondary pressed/released, system pressed. The
  handheld's physical keys are drawn from this same state, so a keyboard or
  mouse press depresses them exactly like a thumb.

    const input = RizoDungeonInput.create({ device, screen, dpad, keys })
    input.key(event)      keydown from the host's key hook → claimed?
    input.bind()/unbind() lifecycle-bound keyup/pointer/blur listeners
    input.consume()       this step's edges + held state (edges cleared)
    input.clear(reason)   drop everything; held sources need a fresh press
    input.view()          { dir, primary, secondary, system } for the keys

  Touch: a sliding D-pad and separate pointer ids per key, so moving and
  acting work together. Mouse: left/right over the game screen. Keyboard:
  WASD/arrows, Z/Space (J), X (K), Escape/P.

  Phone-native rules (the controls pass):
  - One thumb owns the D-pad. A second finger on it is ignored, so two
    fingers can never cancel each other into standing still or sum into a
    diagonal nobody chose. If the owner is lost, the next touch takes over.
  - The D-pad keeps its direction until the thumb clearly leaves it
    (hysteresis), so a thumb resting near a diagonal does not flicker.
  - A release is honoured wherever it lands (window-level pointerup and
    pointercancel), and when the browser says no finger is left on the
    screen, or a new first finger lands, every older touch is forgotten.
    A lost pointerup can therefore never leave movement stuck.
  - clear(reason) never lets a held direction leak in as a fresh press:
    after a dialogue, scene, choice or respawn a finger still on the D-pad
    goes quiet and wakes only when it slides to a different direction (the
    same as pressing it fresh). Reasons that mean "the page or the layout
    changed under the finger" (blur, hidden, rotation, resize, resume) forget
    every finger and key. Story code reads held movement, so a held thumb is
    never counted again on its own.
  - A tap on the dialogue box with a finger or pen is the NEXT key.
*/
(function initRizoDungeonInput(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonInput", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonInput() {
  "use strict";

  const KEY_ACTIONS = Object.freeze({
    arrowup: "up", w: "up", keyw: "up",
    arrowdown: "down", s: "down", keys: "down",
    arrowleft: "left", a: "left", keya: "left",
    arrowright: "right", d: "right", keyd: "right",
    z: "primary", keyz: "primary", " ": "primary", space: "primary", j: "primary", keyj: "primary",
    x: "secondary", keyx: "secondary", k: "secondary", keyk: "secondary",
    escape: "system", p: "system", keyp: "system"
  });
  const BUTTONS = ["primary", "secondary", "system"];
  // Why input was cleared decides what a finger that is still down does next.
  // These mean the page or the layout moved under the finger: forget it all.
  const DROP_CLEARS = new Set(["blur", "hidden", "pagehide", "pageshow", "orientation", "resize", "resume", "stop", "exit"]);
  const PAD_DEAD_IN = 0.22, PAD_DEAD_OUT = 0.15, PAD_STICKY_DEG = 9;
  const TEXT_FIELDS = "input, textarea, select, [contenteditable='true']";

  function actionForKey(event) {
    const byCode = KEY_ACTIONS[String(event.code || "").toLowerCase()];
    if (byCode) return byCode;
    return KEY_ACTIONS[String(event.key || "").toLowerCase()] || null;
  }
  // Text fields and browser/OS shortcuts are never game input.
  function ignoredKeyEvent(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    const target = event.target;
    return Boolean(target?.closest?.(TEXT_FIELDS));
  }
  // 8-way D-pad from a pointer position relative to the pad's centre.
  // `prev` is the direction this thumb already holds: it is kept until the
  // thumb is clearly (9°) past the edge of its sector, and a thumb that is
  // already steering needs to come closer to the centre to let go.
  function dpadVector(dx, dy, radius, prev) {
    const length = Math.hypot(dx, dy);
    const held = Boolean(prev && (prev[0] || prev[1]));
    if (length < radius * (held ? PAD_DEAD_OUT : PAD_DEAD_IN)) return [0, 0];
    const step = Math.PI / 4, angle = Math.atan2(dy, dx);
    let sector = Math.round(angle / step);
    if (held) {
      const kept = Math.round(Math.atan2(prev[1], prev[0]) / step);
      let away = Math.abs(angle - kept * step);
      if (away > Math.PI) away = 2 * Math.PI - away;
      if (away < step / 2 + (PAD_STICKY_DEG * Math.PI) / 180) sector = kept;
    }
    const snapped = sector * step;
    return [Math.round(Math.cos(snapped)) + 0, Math.round(Math.sin(snapped)) + 0];
  }
  function dirName(x, y) {
    const v = y < 0 ? "up" : y > 0 ? "down" : "";
    const h = x < 0 ? "left" : x > 0 ? "right" : "";
    return v && h ? `${v}-${h}` : v || h || "none";
  }

  function create({ device = null, screen = null, dpad = null, keys = {}, onChange = null } = {}) {
    // Every source that can hold an action, by name: "key:<code>", "pointer:<id>", "mouse:<button>".
    const sources = new Map(); // source → { action, pointerType? } | { action:"move", x, y, pad, pointerType }
    const quiet = new Map(); // D-pad fingers still down but not counted: source → { x, y, pointerType }
    const staleKeys = new Set(); // keys still down from before a clear
    const edges = { primaryPressed: false, primaryReleased: false, secondaryPressed: false, secondaryReleased: false, systemPressed: false, dirX: 0, dirY: 0 };
    let held = { primary: false, secondary: false, system: false };
    let padOwner = null; // the one pointer source steering the D-pad (counted or quiet)
    let bound = false;
    const listeners = [];

    function derive() {
      const next = { primary: false, secondary: false, system: false };
      let mx = 0, my = 0, keyX = 0, keyY = 0;
      for (const value of sources.values()) {
        if (value.action === "move") { mx += value.x; my += value.y; }
        else if (value.action === "up") keyY -= 1;
        else if (value.action === "down") keyY += 1;
        else if (value.action === "left") keyX -= 1;
        else if (value.action === "right") keyX += 1;
        else if (next[value.action] === false) next[value.action] = true;
      }
      return { next, moveX: Math.max(-1, Math.min(1, mx + keyX)), moveY: Math.max(-1, Math.min(1, my + keyY)) };
    }
    function sync() {
      const { next } = derive();
      for (const name of BUTTONS) {
        if (next[name] && !held[name]) edges[`${name}Pressed`] = true;
        if (!next[name] && held[name] && name !== "system") edges[`${name}Released`] = true;
      }
      held = next;
      onChange?.();
    }
    // A direction tap is kept as an edge too, so a quick tap between frames still counts (menus, choices).
    function press(source, value) {
      const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const dir = value.action === "move" ? [value.x, value.y] : DIRS[value.action];
      if (dir && (dir[0] || dir[1]) && !(sources.get(source)?.x === dir[0] && sources.get(source)?.y === dir[1])) { edges.dirX = dir[0]; edges.dirY = dir[1]; }
      sources.set(source, value); sync();
    }
    function release(source) {
      const had = sources.delete(source);
      quiet.delete(source);
      if (padOwner === source) padOwner = null;
      if (had) sync();
    }
    // Forget every finger of one kind (touch, pen): the browser told us none can still be down.
    function dropFingers(pointerType) {
      let changed = false;
      for (const [source, value] of sources) {
        if (source.startsWith("key:") || source.startsWith("mouse:") || value.pointerType !== pointerType) continue;
        sources.delete(source); changed = true;
      }
      for (const [source, value] of quiet) if (value.pointerType === pointerType) quiet.delete(source);
      if (padOwner && !sources.has(padOwner) && !quiet.has(padOwner)) padOwner = null;
      if (changed) sync();
    }

    // ---- keyboard: keydown arrives through the host key hook
    function key(event) {
      if (!event || ignoredKeyEvent(event)) return false;
      const action = actionForKey(event);
      if (!action) return false;
      event.preventDefault?.();
      const code = String(event.code || event.key || "").toLowerCase();
      // A repeat is the browser's typematic echo, never a new press.
      if (event.repeat || staleKeys.has(code)) return true;
      press(`key:${code}`, { action });
      return true;
    }
    function keyup(event) {
      const code = String(event.code || event.key || "").toLowerCase();
      staleKeys.delete(code);
      if (sources.has(`key:${code}`)) { release(`key:${code}`); if (actionForKey(event)) event.preventDefault?.(); }
    }

    // ---- pointers
    function dpadMove(event, source) {
      const rect = dpad.getBoundingClientRect();
      const current = sources.get(source), asleep = quiet.get(source);
      const prev = current ? [current.x, current.y] : asleep ? [asleep.x, asleep.y] : null;
      const [x, y] = dpadVector(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2), rect.width / 2, prev);
      if (asleep) {
        // Quiet until the thumb goes somewhere new; that is a fresh press.
        if (x === asleep.x && y === asleep.y) return;
        quiet.delete(source);
      } else if (current && current.x === x && current.y === y) return;
      press(source, { action: "move", x, y, pad: true, pointerType: event.pointerType });
    }
    function onDpadDown(event) {
      if (event.button > 0) return;
      event.preventDefault();
      const source = `pointer:${event.pointerId}`;
      // One thumb on the pad. (A finger that was lost without a release is
      // forgotten by the window-level releases, so this cannot stay claimed.)
      if (padOwner && padOwner !== source && (sources.has(padOwner) || quiet.has(padOwner))) return;
      padOwner = source;
      quiet.delete(source);
      try { dpad.setPointerCapture(event.pointerId); } catch (error) {}
      dpadMove(event, source);
    }
    function onDpadMove(event) {
      const source = `pointer:${event.pointerId}`;
      if (sources.has(source) || quiet.has(source)) dpadMove(event, source);
    }
    function onKeyDown(event) {
      const button = event.currentTarget, action = button?.dataset?.dungeonKey;
      if (!BUTTONS.includes(action) || event.button > 0) return;
      // A rendered key acts only as itself, never also as a screen press.
      event.preventDefault(); event.stopPropagation();
      try { button.setPointerCapture(event.pointerId); } catch (error) {}
      press(`pointer:${event.pointerId}`, { action, pointerType: event.pointerType });
    }
    function onPointerEnd(event) { release(`pointer:${event.pointerId}`); }
    // The dialogue box is a big NEXT key for a finger or a pen (not while a choice is up).
    function dialogueTap(event) {
      const box = event.target?.closest?.(".dungeon-dialogue");
      if (!box || box.hidden) return false;
      const choice = device?.querySelector?.(".dungeon-choice");
      return !(choice && !choice.hidden);
    }
    function onScreenDown(event) {
      if (event.pointerType !== "mouse") {
        if (!dialogueTap(event)) return;
        event.preventDefault();
        press(`pointer:${event.pointerId}`, { action: "primary", pointerType: event.pointerType });
        return;
      }
      if (event.target?.closest?.("button, a, [data-dungeon-ui]")) return;
      const action = event.button === 0 ? "primary" : event.button === 2 ? "secondary" : null;
      if (!action) return;
      event.preventDefault();
      try { screen.setPointerCapture(event.pointerId); } catch (error) {}
      press(`mouse:${event.button}`, { action, pointerType: "mouse" });
    }
    function onScreenUp(event) {
      if (event.pointerType !== "mouse") { release(`pointer:${event.pointerId}`); return; }
      release(`mouse:${event.button}`);
    }
    function onContextMenu(event) { event.preventDefault(); }

    // ---- window-level safety nets: a release is honoured wherever it lands
    function onWindowPointerEnd(event) {
      release(`pointer:${event.pointerId}`);
      if (event.pointerType === "mouse") release(`mouse:${event.button}`);
    }
    // The first finger down means no older touch can still be down.
    function onWindowPointerDown(event) { if (event.pointerType === "touch" && event.isPrimary) dropFingers("touch"); }
    // No touches left on the screen means no touch pointer is still held.
    function onTouchEnd(event) { if (event.touches && event.touches.length === 0) dropFingers("touch"); }
    function onHidden() { if (document.hidden) clear("hidden"); }
    function onBlur() { clear("blur"); }

    function listen(target, type, handler, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }
    function bind() {
      if (bound) return;
      bound = true;
      // A focused text field would swallow every key.
      try { const active = document.activeElement; if (active?.matches?.(TEXT_FIELDS)) active.blur?.(); } catch (error) {}
      listen(window, "keyup", keyup, true);
      listen(window, "blur", onBlur);
      listen(window, "pointerdown", onWindowPointerDown, true);
      for (const type of ["pointerup", "pointercancel"]) listen(window, type, onWindowPointerEnd, true);
      for (const type of ["touchend", "touchcancel"]) listen(window, type, onTouchEnd, { capture: true, passive: true });
      listen(document, "visibilitychange", onHidden);
      listen(window, "pagehide", () => clear("pagehide"));
      listen(window, "pageshow", () => clear("pageshow"));
      listen(window, "orientationchange", () => clear("orientation"));
      const portrait = window.matchMedia?.("(orientation: portrait)");
      if (portrait?.addEventListener) listen(portrait, "change", () => clear("orientation"));
      else if (portrait?.addListener) { const flip = () => clear("orientation"); portrait.addListener(flip); listeners.push(() => portrait.removeListener(flip)); }
      listen(dpad, "pointerdown", onDpadDown);
      listen(dpad, "pointermove", onDpadMove);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(dpad, type, onPointerEnd);
      for (const button of Object.values(keys)) {
        if (!button) continue;
        listen(button, "pointerdown", onKeyDown);
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(button, type, onPointerEnd);
        // Keyboard activation of a focused key is handled by the key hook.
        listen(button, "click", event => event.preventDefault());
      }
      listen(screen, "pointerdown", onScreenDown);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(screen, type, onScreenUp);
      listen(device, "contextmenu", onContextMenu);
    }
    function unbind() {
      while (listeners.length) listeners.pop()();
      bound = false;
      clear("stop");
    }

    // Drops all held input and pending edges. Keys still physically down are
    // ignored until released, so a held key cannot leak through a dialogue or
    // Resume as a fresh press; a finger on the D-pad goes quiet until it moves
    // somewhere new. When the page itself changed (see DROP_CLEARS) nothing
    // is remembered, because nothing can be trusted to still be down.
    function clear(reason) {
      const forget = DROP_CLEARS.has(reason);
      for (const [source, value] of sources) {
        if (source.startsWith("key:")) { if (!forget) staleKeys.add(source.slice(4)); }
        else if (value.pad && !forget) quiet.set(source, { x: value.x, y: value.y, pointerType: value.pointerType });
      }
      sources.clear();
      if (forget) { quiet.clear(); staleKeys.clear(); padOwner = null; }
      held = { primary: false, secondary: false, system: false };
      for (const name of Object.keys(edges)) edges[name] = typeof edges[name] === "number" ? 0 : false;
      onChange?.();
    }
    function consume() {
      const { moveX, moveY } = derive();
      const out = { moveX, moveY, primaryHeld: held.primary, secondaryHeld: held.secondary, ...edges };
      for (const name of Object.keys(edges)) edges[name] = typeof edges[name] === "number" ? 0 : false;
      return out;
    }
    function view() {
      const { moveX, moveY } = derive();
      return { dir: dirName(Math.sign(moveX), Math.sign(moveY)), primary: held.primary, secondary: held.secondary, system: held.system };
    }
    // For tests: what is held, what is quiet, who owns the pad.
    function describe() { return { sources: [...sources.keys()], quiet: [...quiet.keys()], padOwner, staleKeys: [...staleKeys] }; }
    return { key, keyup, bind, unbind, clear, consume, view, describe, get bound() { return bound; } };
  }

  return Object.freeze({ create, actionForKey, dpadVector, dirName, KEY_ACTIONS, DROP_CLEARS });
});
