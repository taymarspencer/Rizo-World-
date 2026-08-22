import { createRizoWorld } from "./world.js";

const root = globalThis;

if (!root.RizoWorld) {
  const world = createRizoWorld({ globalObject: root });
  Object.defineProperty(root, "RizoWorld", {
    value: world,
    configurable: true,
    enumerable: true
  });

  if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
    root.dispatchEvent(new root.CustomEvent("rizo:world-ready", {
      detail: { version: world.version }
    }));
  }
}

export default root.RizoWorld;
