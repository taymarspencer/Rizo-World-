const REQUIRED_METHODS = ["initialize", "start", "pause", "resume", "destroy", "getState"];

export function assertGameModule(gameModule, label = "game") {
  if (!gameModule || typeof gameModule !== "object") {
    throw new TypeError(`${label} must be an object.`);
  }

  const missing = REQUIRED_METHODS.filter(method => typeof gameModule[method] !== "function");
  if (missing.length) {
    throw new Error(`${label} is missing required game methods: ${missing.join(", ")}`);
  }

  return true;
}

export function createGameContext({ core, gameId, services = {} }) {
  if (!core) throw new Error("Game context requires Rizo Core.");
  if (!gameId) throw new Error("Game context requires a gameId.");

  return Object.freeze({
    gameId,
    registry: core.registry,
    select: core.select,
    state: core.state,
    services: Object.freeze({ ...services }),

    getContent(category, id) {
      return core.registry.get(category, id);
    },

    query(category) {
      return core.select.query(category);
    },

    updatePlayer(updater, meta = {}) {
      if (typeof updater !== "function") throw new TypeError("Player updater must be a function.");
      return core.state.update(state => {
        state.player = state.player || {};
        updater(state.player, state);
        state.meta = state.meta || {};
        state.meta.updatedAt = Date.now();
      }, { gameId, ...meta });
    },

    updateGameState(updater, meta = {}) {
      if (typeof updater !== "function") throw new TypeError("Game state updater must be a function.");
      return core.state.update(state => {
        state.games = state.games || {};
        state.games[gameId] = state.games[gameId] || {};
        updater(state.games[gameId], state);
        state.meta = state.meta || {};
        state.meta.updatedAt = Date.now();
      }, { gameId, ...meta });
    }
  });
}

export class GameHost {
  constructor(core, services = {}) {
    this.core = core;
    this.services = services;
    this.active = null;
  }

  async mount(gameId, gameModule, mountPoint = null) {
    assertGameModule(gameModule, gameId);

    if (this.active) await this.unmount();

    const context = createGameContext({
      core: this.core,
      gameId,
      services: this.services
    });

    try {
      await gameModule.initialize(context, mountPoint);
    } catch (initializeError) {
      // initialize() may have already attached listeners/canvas/resources before failing.
      // The contract therefore requires destroy() to be safe after partial setup.
      try {
        await gameModule.destroy();
      } catch (cleanupError) {
        throw new AggregateError(
          [initializeError, cleanupError],
          `${gameId} failed to initialize and cleanup also failed.`
        );
      }
      throw initializeError;
    }

    this.active = { gameId, gameModule, context, mountPoint };
    return this.active;
  }

  async start() {
    if (!this.active) throw new Error("No game is mounted.");
    return this.active.gameModule.start();
  }

  async pause() {
    return this.active?.gameModule.pause();
  }

  async resume() {
    return this.active?.gameModule.resume();
  }

  getState() {
    return this.active?.gameModule.getState() ?? null;
  }

  async unmount() {
    if (!this.active) return;
    const mounted = this.active;
    this.active = null;
    await mounted.gameModule.destroy();
  }
}

export const GAME_CONTRACT_METHODS = Object.freeze([...REQUIRED_METHODS]);
