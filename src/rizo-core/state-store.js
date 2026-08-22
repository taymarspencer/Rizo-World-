function clone(value) {
  return value == null ? value : structuredClone(value);
}

function assertVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid state version: ${version}`);
  }
}

export class StateStore {
  constructor({ version = 1, initialState = {}, migrations = {} } = {}) {
    assertVersion(version);
    this.version = version;
    this.migrations = new Map(
      Object.entries(migrations).map(([fromVersion, migrate]) => [Number(fromVersion), migrate])
    );
    this.listeners = new Set();
    this._state = this._normalize(initialState);
  }

  _normalize(input) {
    const source = clone(input) || {};
    const sourceVersion = Number.isInteger(source.version) ? source.version : 1;
    let state = { ...source, version: sourceVersion };

    if (state.version > this.version) {
      throw new Error(`State v${state.version} is newer than supported v${this.version}.`);
    }

    while (state.version < this.version) {
      const migrate = this.migrations.get(state.version);
      if (typeof migrate !== "function") {
        throw new Error(`Missing migration from state v${state.version} to v${state.version + 1}.`);
      }

      const next = migrate(clone(state));
      if (!next || typeof next !== "object") {
        throw new Error(`Migration from v${state.version} did not return an object.`);
      }

      state = { ...next, version: state.version + 1 };
    }

    return state;
  }

  get() {
    return clone(this._state);
  }

  replace(nextState, meta = {}) {
    const previous = this.get();
    this._state = this._normalize(nextState);
    this._emit(previous, meta);
    return this.get();
  }

  update(updater, meta = {}) {
    if (typeof updater !== "function") throw new TypeError("State updater must be a function.");
    const previous = this.get();
    const draft = this.get();
    const result = updater(draft);
    this._state = this._normalize(result === undefined ? draft : result);
    this._emit(previous, meta);
    return this.get();
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("State listener must be a function.");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(previous, meta) {
    const current = this.get();
    for (const listener of this.listeners) {
      listener(current, previous, meta);
    }
  }

  serialize() {
    return JSON.stringify(this._state);
  }

  hydrate(serialized, meta = { source: "hydrate" }) {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    return this.replace(parsed, meta);
  }
}

export function createInitialPlayerState() {
  return {
    version: 1,
    player: {
      currency: {},
      ownedRizos: [],
      ownedItems: [],
      unlocks: [],
      progress: {}
    },
    games: {},
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  };
}
