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

export function createPersistenceController(stateStore, adapter, { debounceMs = 250 } = {}) {
  let timer = null;
  let writeChain = Promise.resolve();
  let destroyed = false;

  async function persistNow() {
    if (destroyed) return writeChain;
    const snapshot = stateStore.serialize();
    writeChain = writeChain.then(() => adapter.save(snapshot));
    return writeChain;
  }

  const unsubscribe = stateStore.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      persistNow();
    }, debounceMs);
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
      await writeChain;
      await adapter.clear();
    },

    async destroy() {
      if (destroyed) return;
      clearTimeout(timer);
      timer = null;
      await persistNow();
      destroyed = true;
      unsubscribe();
    }
  });
}
