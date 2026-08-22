export class MemoryPersistenceAdapter {
  constructor(initialValue = null) {
    this.value = initialValue;
  }

  async load() {
    return this.value;
  }

  async save(serializedState) {
    this.value = serializedState;
  }

  async clear() {
    this.value = null;
  }
}

export class LocalStoragePersistenceAdapter {
  constructor(key = "rizo.world.state") {
    this.key = key;
  }

  async load() {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(this.key);
  }

  async save(serializedState) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.key, serializedState);
  }

  async clear() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(this.key);
  }
}

function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError("Persistence adapter must be an object.");
  }

  for (const method of ["load", "save", "clear"]) {
    if (typeof adapter[method] !== "function") {
      throw new TypeError(`Persistence adapter is missing ${method}().`);
    }
  }
}

export function createPersistenceController(
  stateStore,
  adapter,
  { debounceMs = 250, onError = null } = {}
) {
  assertAdapter(adapter);

  let timer = null;
  let writeChain = Promise.resolve();
  let destroyed = false;
  let lastError = null;

  function reportError(error) {
    lastError = error;
    if (typeof onError === "function") onError(error);
  }

  function queueSave(snapshot) {
    // A rejected save must not poison the queue forever. The next save still waits for
    // the previous attempt to settle, then gets a fresh chance to persist newer state.
    const attempt = writeChain.then(
      () => adapter.save(snapshot),
      () => adapter.save(snapshot)
    );
    writeChain = attempt;
    return attempt;
  }

  async function persistNow() {
    if (destroyed) return writeChain;
    const snapshot = stateStore.serialize();

    try {
      const result = await queueSave(snapshot);
      lastError = null;
      return result;
    } catch (error) {
      reportError(error);
      throw error;
    }
  }

  const unsubscribe = stateStore.subscribe((_current, _previous, meta = {}) => {
    // Hydration should not immediately rewrite the same payload it just loaded.
    if (meta.source === "persistence") return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      persistNow().catch(() => {
        // Error is retained in lastError/reported through onError. Swallow here only to
        // prevent an unhandled rejection from a background debounced write.
      });
    }, Math.max(0, Number(debounceMs) || 0));
  });

  return Object.freeze({
    async hydrate() {
      const serialized = await adapter.load();
      if (serialized) stateStore.hydrate(serialized, { source: "persistence" });
      return stateStore.get();
    },

    flush() {
      clearTimeout(timer);
      timer = null;
      return persistNow();
    },

    async clear() {
      clearTimeout(timer);
      timer = null;
      try {
        await writeChain;
      } catch {
        // A previous failed save should not block an explicit clear operation.
      }
      await adapter.clear();
      lastError = null;
    },

    getLastError() {
      return lastError;
    },

    async destroy() {
      if (destroyed) return;
      clearTimeout(timer);
      timer = null;

      try {
        await persistNow();
      } finally {
        destroyed = true;
        unsubscribe();
      }
    }
  });
}
