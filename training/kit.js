/*
  RIZO TRAINING KIT
  =================
  Small DOM helpers shared by the training games in training/<id>.js. Pure
  utilities with no hub access: everything a game does to the world goes
  through the `run` services the hub hands it at start (core/rizo-training.js).
*/
(function initRizoTrainingKit(root) {
  "use strict";
  root.RizoTrainingKit = Object.freeze({
    $: (selector, scope = document) => scope.querySelector(selector),
    $$: (selector, scope = document) => [...scope.querySelectorAll(selector)],
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, value)),
    escapeHTML: value => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])),
    formatNumber: value => Math.floor(value || 0).toLocaleString()
  });
})(globalThis);
