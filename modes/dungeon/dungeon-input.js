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

  function actionForKey(event) {
    const byCode = KEY_ACTIONS[String(event.code || "").toLowerCase()];
    if (byCode) return byCode;
    return KEY_ACTIONS[String(event.key || "").toLowerCase()] || null;
  }
  // Text fields and browser/OS shortcuts are never game input.
  function ignoredKeyEvent(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    const target = event.target;
    return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
  }
  // 8-way D-pad from a pointer position relative to the pad's centre.
  function dpadVector(dx, dy, radius) {
    const length = Math.hypot(dx, dy);
    if (length < radius * 0.22) return [0, 0];
    const angle = Math.atan2(dy, dx);
    const sector = Math.round(angle / (Math.PI / 4));
    const snapped = sector * (Math.PI / 4);
    const x = Math.round(Math.cos(snapped)), y = Math.round(Math.sin(snapped));
    return [x, y];
  }
  function dirName(x, y) {
    const v = y < 0 ? "up" : y > 0 ? "down" : "";
    const h = x < 0 ? "left" : x > 0 ? "right" : "";
    return v && h ? `${v}-${h}` : v || h || "none";
  }

  function create({ device = null, screen = null, dpad = null, keys = {}, onChange = null } = {}) {
    // Every source that can hold an action, by name: "key:<code>", "pointer:<id>", "mouse:<button>".
    const sources = new Map(); // source → { action } | { action:"move", x, y }
    const staleKeys = new Set(); // keys still down from before a clear
    const edges = { primaryPressed: false, primaryReleased: false, secondaryPressed: false, secondaryReleased: false, systemPressed: false };
    let held = { primary: false, secondary: false, system: false };
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
    function press(source, value) { sources.set(source, value); sync(); }
    function release(source) { if (sources.delete(source)) sync(); }

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
      const [x, y] = dpadVector(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2), rect.width / 2);
      const current = sources.get(source);
      if (!current || current.x !== x || current.y !== y) press(source, { action: "move", x, y });
    }
    function onDpadDown(event) {
      if (event.button > 0) return;
      event.preventDefault();
      try { dpad.setPointerCapture(event.pointerId); } catch (error) {}
      dpadMove(event, `pointer:${event.pointerId}`);
    }
    function onDpadMove(event) {
      const source = `pointer:${event.pointerId}`;
      if (sources.has(source)) dpadMove(event, source);
    }
    function onKeyDown(event) {
      const button = event.currentTarget, action = button?.dataset?.dungeonKey;
      if (!BUTTONS.includes(action) || event.button > 0) return;
      // A rendered key acts only as itself, never also as a screen press.
      event.preventDefault(); event.stopPropagation();
      try { button.setPointerCapture(event.pointerId); } catch (error) {}
      press(`pointer:${event.pointerId}`, { action });
    }
    function onPointerEnd(event) { release(`pointer:${event.pointerId}`); }
    function onScreenDown(event) {
      if (event.pointerType !== "mouse" || event.target?.closest?.("button, a, [data-dungeon-ui]")) return;
      const action = event.button === 0 ? "primary" : event.button === 2 ? "secondary" : null;
      if (!action) return;
      event.preventDefault();
      try { screen.setPointerCapture(event.pointerId); } catch (error) {}
      press(`mouse:${event.button}`, { action });
    }
    function onScreenUp(event) {
      if (event.pointerType !== "mouse") return;
      release(`mouse:${event.button}`);
    }
    function onContextMenu(event) { event.preventDefault(); }
    function onBlur() { clear("blur"); }

    function listen(target, type, handler, options) {
      if (!target) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }
    function bind() {
      if (bound) return;
      bound = true;
      listen(window, "keyup", keyup, true);
      listen(window, "blur", onBlur);
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
    // Resume as a fresh press.
    function clear() {
      for (const source of sources.keys()) if (source.startsWith("key:")) staleKeys.add(source.slice(4));
      sources.clear();
      held = { primary: false, secondary: false, system: false };
      for (const name of Object.keys(edges)) edges[name] = false;
      onChange?.();
    }
    function consume() {
      const { moveX, moveY } = derive();
      const out = { moveX, moveY, primaryHeld: held.primary, secondaryHeld: held.secondary, ...edges };
      for (const name of Object.keys(edges)) edges[name] = false;
      return out;
    }
    function view() {
      const { moveX, moveY } = derive();
      return { dir: dirName(Math.sign(moveX), Math.sign(moveY)), primary: held.primary, secondary: held.secondary, system: held.system };
    }
    return { key, keyup, bind, unbind, clear, consume, view, get bound() { return bound; } };
  }

  return Object.freeze({ create, actionForKey, dpadVector, dirName, KEY_ACTIONS });
});
