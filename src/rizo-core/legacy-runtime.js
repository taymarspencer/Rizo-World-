function splitPath(path) {
  return String(path || "").split(".").map(part => part.trim()).filter(Boolean);
}

function safeProperty(object, key) {
  try { return object?.[key]; }
  catch { return null; }
}

function getPath(root, path) {
  let value = root;
  for (const key of splitPath(path)) {
    if (value == null) return undefined;
    value = safeProperty(value, key);
  }
  return value;
}

function getCallable(root, path) {
  const parts = splitPath(path);
  const method = parts.pop();
  let owner = root;
  for (const key of parts) {
    if (owner == null) return { owner: null, fn: null };
    owner = safeProperty(owner, key);
  }
  const fn = safeProperty(owner, method);
  return { owner, fn: typeof fn === "function" ? fn : null };
}

function getRecord(root, binding) {
  const collection = getPath(root, binding.path);
  const value = binding.value;
  if (Array.isArray(collection)) {
    const key = binding.key || "id";
    return collection.find(record => safeProperty(record, key) === value) || null;
  }
  if (collection && typeof collection === "object") return safeProperty(collection, value) ?? null;
  return null;
}

export function readonlySnapshot(value, seen = new WeakMap()) {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) return value;
  if (seen.has(value)) return seen.get(value);

  if (typeof value === "function") {
    const wrapped = function (...args) { return Reflect.apply(value, this, args); };
    seen.set(value, wrapped);
    return Object.freeze(wrapped);
  }

  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, child] of Object.entries(value)) copy[key] = readonlySnapshot(child, seen);
  return Object.freeze(copy);
}

export class LegacyRuntimeAdapter {
  constructor({ globalObject = globalThis, documentObject, storage } = {}) {
    this.globalObject = globalObject;
    this.documentObject = documentObject === undefined ? safeProperty(globalObject, "document") : documentObject;
    this.storage = storage === undefined ? safeProperty(globalObject, "localStorage") : storage;
  }

  resolve(definition) {
    const binding = definition?.binding;
    if (!binding) return null;

    switch (binding.kind) {
      case "global-value":
        return getPath(this.globalObject, binding.path);
      case "global-record":
        return readonlySnapshot(getRecord(this.globalObject, binding));
      case "global-call":
        return getCallable(this.globalObject, binding.path).fn;
      case "dom":
      case "dom-click":
        return this.documentObject?.querySelector?.(binding.selector) || null;
      case "local-storage": {
        let raw = null;
        try { raw = this.storage?.getItem?.(binding.key); }
        catch { return null; }
        if (raw == null || binding.parse !== "json") return raw ?? null;
        try { return JSON.parse(raw); }
        catch { return null; }
      }
      default:
        throw new Error(`Unknown legacy binding kind: ${binding.kind}`);
    }
  }

  available(definition) {
    return this.resolve(definition) != null;
  }

  invoke(definition, ...args) {
    const binding = definition?.binding;
    if (!binding) throw new Error(`Legacy definition ${definition?.id || "<unknown>"} has no binding.`);

    switch (binding.kind) {
      case "dom-click": {
        const element = this.documentObject?.querySelector?.(binding.selector);
        if (!element || typeof element.click !== "function") {
          throw new Error(`Legacy DOM target unavailable for ${definition.id}: ${binding.selector}`);
        }
        element.click();
        return true;
      }
      case "global-call": {
        const { owner, fn } = getCallable(this.globalObject, binding.path);
        if (!fn) throw new Error(`Legacy global function unavailable for ${definition.id}: ${binding.path}`);
        return fn.apply(owner, args);
      }
      case "global-record": {
        const record = getRecord(this.globalObject, binding);
        if (typeof record !== "function") {
          throw new Error(`Legacy record is not invokable for ${definition.id}: ${binding.path}.${binding.value}`);
        }
        return record(...args);
      }
      default:
        throw new Error(`Legacy binding ${binding.kind} is readable but not invokable.`);
    }
  }
}

export class NativeRuntimeAdapter {
  resolve() {
    return null;
  }

  available() {
    return false;
  }

  invoke(definition) {
    throw new Error(`Native runtime unavailable for ${definition?.id || "<unknown>"}; no implementation is registered.`);
  }
}

export function resolveGlobalPath(root, path) {
  return getPath(root, path);
}
