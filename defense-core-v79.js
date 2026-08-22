(function initRizoDefenseCore(root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) Object.defineProperty(root, "RizoDefenseCore", { value: Object.freeze(core), configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDefenseCore() {
  "use strict";

  const VERSION = 7;
  const STATE_SAVE_VERSION = 1;
  const CHECKPOINT_SALTS = Object.freeze({
    2: "RIZO-DEFENSE-V64-EMBER-GATE",
    3: "RIZO-DEFENSE-V66-HARDENED-GATE",
    4: "RIZO-DEFENSE-V67-PACKET-CLOCK",
    5: "RIZO-DEFENSE-V68-ECONOMY-FLOW",
    6: "RIZO-DEFENSE-V79-GATE-FLAME",
    7: "RIZO-DEFENSE-V80-STRATEGY-FEEL"
  });
  const STATE_SAVE_SALT = "RIZO-LIFE-V66-VERIFIED-TIMELINE";

  const LIMITS = Object.freeze({
    MAX_SUPPORTED_WAVE: 250,
    MAX_RUN_CASH: 2_000_000,
    MAX_TOWER_LEVEL: 4,
    MAX_DEFENSE_TOWERS: 10,
    MAX_REASONABLE_KILLS: 100_000,
    MAX_REASONABLE_DAMAGE: 1_000_000_000,
    MAX_REASONABLE_BOSSES: 2_000,
    MAX_REASONABLE_PERFECT_WAVES: 250,
    MAX_PLANNED_ENEMIES: 46,
    MAX_CHILD_BUFFER: 48,
    MAX_CHECKPOINT_ENEMIES: 24,
    MAX_CHECKPOINT_PROJECTILES: 32,
    MAX_QUEUE_ENTRIES: 64,
    MAX_WALLET_EMBERS: 50_000_000,
    MAX_WALLET_SHARDS: 5_000_000,
    MAX_INVENTORY_STACK: 100_000,
    MAX_COLLECTION_COUNT: 100_000,
    MAX_PLAYER_XP: 1_000_000_000,
    MAX_META_COUNTER: 100_000_000,
    MAX_MASTERY_WAVES: 50_000,
    MAX_MASTERY_RUNS: 10_000,
    MAX_SEASON_XP: 100_000_000,
    MAX_SEASON_LEVEL: 100_000
  });

  const PHASES = Object.freeze({
    PLANNING: "planning",
    COUNTDOWN: "countdown",
    COMBAT: "combat",
    PACKET_BREAK: "packet-break",
    WAVE_COMPLETE: "wave-complete",
    PAUSED: "paused",
    RUN_COMPLETE: "run-complete"
  });

  const PHASE_TRANSITIONS = Object.freeze({
    [PHASES.PLANNING]: Object.freeze([PHASES.COUNTDOWN]),
    [PHASES.COUNTDOWN]: Object.freeze([PHASES.COMBAT, PHASES.PAUSED]),
    [PHASES.COMBAT]: Object.freeze([PHASES.PACKET_BREAK, PHASES.WAVE_COMPLETE, PHASES.PAUSED]),
    [PHASES.PACKET_BREAK]: Object.freeze([PHASES.COMBAT, PHASES.WAVE_COMPLETE, PHASES.PAUSED]),
    [PHASES.WAVE_COMPLETE]: Object.freeze([PHASES.COUNTDOWN, PHASES.PLANNING]),
    [PHASES.PAUSED]: Object.freeze([PHASES.COUNTDOWN, PHASES.COMBAT, PHASES.PACKET_BREAK]),
    [PHASES.RUN_COMPLETE]: Object.freeze([])
  });

  const BUDGETS = Object.freeze({
    normal: Object.freeze({
      maxActiveEnemies: 14,
      maxVisibleProjectiles: 26,
      maxImpactEffects: 8,
      maxTowers: 8,
      maxTowersHard: 10,
      targetRefreshMs: 120,
      uiRefreshMs: 120,
      incomeFlushMs: 150,
      childReleaseMs: 72
    }),
    low: Object.freeze({
      // Gameplay density is device-invariant in v76. Low-power mode reduces
      // presentation work, not the authored formation or prewarmed enemy capacity.
      maxActiveEnemies: 14,
      maxVisibleProjectiles: 16,
      maxImpactEffects: 5,
      maxTowers: 8,
      maxTowersHard: 10,
      targetRefreshMs: 160,
      uiRefreshMs: 180,
      incomeFlushMs: 180,
      childReleaseMs: 96
    })
  });

  // v76 keeps combat math deterministic at 30 Hz and lets presentation float
  // independently. This is deliberately conservative for iOS/PWA thermal and
  // Low Power Mode behavior: presentation may fall to 30 fps without changing
  // movement, cooldowns, rewards, or wave timing.
  const SIMULATION = Object.freeze({
    stepHz: 30,
    stepSeconds: 1 / 30,
    maxCatchUpSteps: 4,
    presentationHz: 60,
    lowPresentationHz: 30,
    visualProjectileHz: 10,
    fastVisualProjectileHz: 8,
    lowVisualProjectileHz: 6
  });

  const UPGRADE_COSTS = Object.freeze([110, 180, 320, 640]);
  const ECONOMY = Object.freeze({
    baseStartingCash: 220,
    planningRefundRate: 0.70,
    placementUndoSeconds: 5,
    worldOpeningDiscount: 0.80,
    deployBaseCost: 145,
    deployGrowth: 1.36,
    deployLateGrowth: 1.62,
    deployGrowthPivot: 2,
    duplicateSurcharge: 45,
    goldenIncomeCap: 0.22,
    goldenActiveDuplicateDecay: 0.12,
    lateRunSoftCapThreshold: 1600,
    lateRunSoftCapSlope: 0.35
  });

  function clampNumber(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function clampInteger(value, min, max, fallback = min) {
    return Math.floor(clampNumber(value, min, max, fallback));
  }

  function isKnownId(value, registry) {
    if (typeof value !== "string" || !value) return false;
    if (registry instanceof Set || registry instanceof Map) return registry.has(value);
    if (Array.isArray(registry)) return registry.includes(value);
    return Boolean(registry && Object.prototype.hasOwnProperty.call(registry, value));
  }

  function normalizePhase(value, fallback = PHASES.PLANNING) {
    const aliases = {
      setup: PHASES.PLANNING,
      between: PHASES.PLANNING,
      wave: PHASES.COMBAT,
      paused: PHASES.PAUSED
    };
    const normalized = aliases[value] || value;
    return Object.values(PHASES).includes(normalized) ? normalized : fallback;
  }

  function isCombatPhase(phase) {
    return [PHASES.COUNTDOWN, PHASES.COMBAT, PHASES.PACKET_BREAK, PHASES.PAUSED].includes(normalizePhase(phase));
  }

  function canTransitionPhase(from, to) {
    const current = normalizePhase(from);
    const next = normalizePhase(to);
    return current === next || Boolean(PHASE_TRANSITIONS[current]?.includes(next));
  }

  function phaseAllows(phase, action) {
    const normalized = normalizePhase(phase);
    const table = {
      [PHASES.PLANNING]: new Set(["place", "move", "sell", "upgrade", "target", "start", "bank", "open-overlay"]),
      [PHASES.COUNTDOWN]: new Set(["pause", "target", "upgrade", "bank", "open-overlay"]),
      [PHASES.COMBAT]: new Set(["pause", "ability", "target", "upgrade", "bank", "open-overlay"]),
      [PHASES.PACKET_BREAK]: new Set(["pause", "ability", "target", "upgrade", "bank", "open-overlay"]),
      [PHASES.WAVE_COMPLETE]: new Set(["place", "move", "sell", "upgrade", "target", "start", "bank", "open-overlay"]),
      [PHASES.PAUSED]: new Set(["resume", "target", "upgrade", "bank", "open-overlay"]),
      [PHASES.RUN_COMPLETE]: new Set([])
    };
    return table[normalized]?.has(action) || false;
  }

  function performanceTier(isLow) {
    return isLow ? BUDGETS.low : BUDGETS.normal;
  }

  function visualBudget({ low = false, speed = 1 } = {}) {
    const budget = performanceTier(low);
    const fast = Number(speed) === 2;
    return {
      maxVisibleProjectiles: fast ? Math.max(10, Math.floor(budget.maxVisibleProjectiles * 0.62)) : budget.maxVisibleProjectiles,
      maxImpactEffects: fast ? Math.max(3, Math.floor(budget.maxImpactEffects * 0.62)) : budget.maxImpactEffects,
      weatherParticleScale: fast ? (low ? 0.24 : 0.46) : (low ? 0.42 : 1),
      projectileEmissionHz: low ? SIMULATION.lowVisualProjectileHz : fast ? SIMULATION.fastVisualProjectileHz : SIMULATION.visualProjectileHz,
      presentationFps: low ? SIMULATION.lowPresentationHz : SIMULATION.presentationHz
    };
  }

  function childReservationCount(queue, clock, windowSeconds = 0.18, maximum = 3) {
    if (!Array.isArray(queue) || !queue.length) return 0;
    const now = clampNumber(clock, 0, 1e9, 0);
    const horizon = now + clampNumber(windowSeconds, 0, 2, 0.18);
    let count = 0;
    for (const item of queue) {
      if (clampNumber(item?.releaseAt, 0, 1e9, 1e9) <= horizon) count += 1;
      if (count >= maximum) return maximum;
    }
    return count;
  }

  function densityCap({ low = false, speed = 1, bossActive = false } = {}) {
    // v76 treats entity scheduling as gameplay, not a quality setting. Low-power
    // mode and 2× may reduce *presentation* work, but they must not secretly
    // thin a wave or change its pressure. Keep one authored gameplay ceiling
    // across devices/speeds; the low budget is reserved for target/UI/visual work.
    void low; void speed;
    return bossActive ? Math.min(10, BUDGETS.normal.maxActiveEnemies) : BUDGETS.normal.maxActiveEnemies;
  }

  function upgradeCost(currentUpgradeLevel, modifier = 1) {
    const index = clampInteger(currentUpgradeLevel, 0, UPGRADE_COSTS.length - 1, 0);
    return Math.max(0, Math.round(UPGRADE_COSTS[index] * clampNumber(modifier, 0.5, 2, 1) / 5) * 5);
  }

  function calculateTowerInvestment(baseCost, upgradeLevel, modifier = 1) {
    const level = clampInteger(upgradeLevel, 0, LIMITS.MAX_TOWER_LEVEL, 0);
    const modifiers = Array.isArray(modifier) ? modifier : null;
    let spent = clampInteger(baseCost, 0, LIMITS.MAX_RUN_CASH, 0);
    for (let index = 0; index < level; index += 1) spent += upgradeCost(index, modifiers ? (modifiers[index] ?? 1) : modifier);
    return spent;
  }

  function deploymentCost({ paidTowerCount = 0, copyCount = 0, activeFirst = false } = {}) {
    const paid = clampInteger(paidTowerCount, 0, LIMITS.MAX_DEFENSE_TOWERS, 0);
    const copies = clampInteger(copyCount, 0, LIMITS.MAX_DEFENSE_TOWERS, 0);
    if (activeFirst && copies === 0) return 0;
    const earlyPaid = Math.min(paid, ECONOMY.deployGrowthPivot);
    const latePaid = Math.max(0, paid - ECONOMY.deployGrowthPivot);
    const raw = ECONOMY.deployBaseCost * Math.pow(ECONOMY.deployGrowth, earlyPaid) * Math.pow(ECONOMY.deployLateGrowth, latePaid) + copies * ECONOMY.duplicateSurcharge;
    return Math.min(LIMITS.MAX_RUN_CASH, Math.max(0, Math.round(raw / 10) * 10));
  }

  function goldenBonus(count) {
    const total = clampInteger(count, 0, LIMITS.MAX_DEFENSE_TOWERS, 0);
    if (total <= 0) return 1;
    return 1 + Math.min(ECONOMY.goldenIncomeCap, 0.10 + Math.max(0, total - 1) * 0.03);
  }

  function goldenActivePayout({ clearedWave = 0, upgradeLevel = 0, goldenTowerCount = 1 } = {}) {
    const wave = clampInteger(clearedWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0);
    const upgrade = clampInteger(upgradeLevel, 0, LIMITS.MAX_TOWER_LEVEL, 0);
    const count = Math.max(1, clampInteger(goldenTowerCount, 1, LIMITS.MAX_DEFENSE_TOWERS, 1));
    const base = 40 + Math.min(wave, 40) * 4 + upgrade * 16;
    const duplicateScale = Math.max(0.52, 1 - Math.max(0, count - 1) * ECONOMY.goldenActiveDuplicateDecay);
    return Math.max(0, Math.round(base * duplicateScale));
  }

  function recommendedTowerCount(wave) {
    return clampInteger(2 + Math.floor(clampInteger(wave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0) / 8), 2, 8, 2);
  }

  function calculateWaveBonus({ clearedWave, heartsLostThisWave = 0, towersPlaced = 0 } = {}) {
    const wave = clampInteger(clearedWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0);
    // Wave-clear income ramps strongly through the learning curve, then tapers.
    // Late waves already contain richer enemy mixes, so a forever-linear clear
    // bonus only turns planning money into an irrelevant scoreboard number.
    const baseWaveBonus = 24 + Math.min(wave, 20) * 4 + Math.max(0, Math.min(wave, 50) - 20);
    const heartBonus = clampInteger(heartsLostThisWave, 0, 999, 0) === 0 ? 10 : 0;
    const efficiencyBonus = clampInteger(towersPlaced, 0, LIMITS.MAX_DEFENSE_TOWERS, 0) <= recommendedTowerCount(wave) ? 8 : 0;
    return Math.max(0, Math.round(baseWaveBonus + heartBonus + efficiencyBonus));
  }

  function softCap(value, threshold = 1600, slope = 0.35) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount <= threshold) return amount;
    return threshold + (amount - threshold) * slope;
  }

  function calculateRunEmbers({ clearedWave = 0, kills = 0, bossesDefeated = 0, perfectWaveCount = 0 } = {}) {
    const wave = clampInteger(clearedWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0);
    const safeKills = clampInteger(kills, 0, LIMITS.MAX_REASONABLE_KILLS, 0);
    const bosses = clampInteger(bossesDefeated, 0, LIMITS.MAX_REASONABLE_BOSSES, 0);
    const perfect = clampInteger(perfectWaveCount, 0, Math.min(wave, LIMITS.MAX_REASONABLE_PERFECT_WAVES), 0);
    const raw = wave * 8 + safeKills * 1.1 + bosses * 25 + perfect * 3;
    return Math.max(0, Math.floor(softCap(raw, ECONOMY.lateRunSoftCapThreshold, ECONOMY.lateRunSoftCapSlope)));
  }

  function calculateEnemyReward(baseReward, wave, { rewardScale = 1 } = {}) {
    const base = clampNumber(baseReward, 0, LIMITS.MAX_RUN_CASH, 0);
    const safeWave = clampInteger(wave, 1, LIMITS.MAX_SUPPORTED_WAVE, 1);
    const scale = clampNumber(rewardScale, 0.05, 2, 1);
    // Preserve the original early-game growth exactly through Wave 10. After
    // that, normalize the per-pop bounty against the size of a normal wave.
    // Difficulty can keep rising through HP, enemy mix and mechanics without
    // the larger packet count also creating runaway cash inflation.
    const earlyGrowth = 1 + Math.min(safeWave, 10) * 0.045;
    const referenceCount = plannedEnemyCount(10);
    const expectedCount = plannedEnemyCount(safeWave);
    const packNormalization = safeWave <= 10 ? 1 : Math.sqrt(referenceCount / Math.max(referenceCount, expectedCount));
    return Math.max(0, Math.round(base * earlyGrowth * packNormalization * scale));
  }

  function plannedEnemyCount(wave, modifier = "normal") {
    const safeWave = clampInteger(wave, 1, LIMITS.MAX_SUPPORTED_WAVE, 1);
    // v76 stops using top-level count as the primary difficulty dial. The curve
    // rises quickly enough to teach density, then intentionally flattens while
    // HP, traits, compositions, bosses and child pressure carry later difficulty.
    let count;
    if (safeWave <= 5) count = 8 + Math.floor((safeWave - 1) * 1.0);
    else if (safeWave <= 15) count = 12 + Math.floor((safeWave - 5) * 0.62);
    else if (safeWave <= 30) count = 18 + Math.floor((safeWave - 15) * 0.34);
    else count = 23 + Math.floor(Math.min(70, safeWave - 30) * 0.08);
    count = Math.min(30, count, LIMITS.MAX_PLANNED_ENEMIES);
    if (modifier === "boss") count = Math.min(14, Math.max(8, Math.floor(count * 0.48))) + 1;
    if (modifier === "rush") count = Math.min(34, count + 4);
    if (modifier === "swarm") count = Math.min(33, count + 3);
    if (modifier === "wall") count = Math.max(7, Math.floor(count * 0.72));
    if (modifier === "recovery") count = Math.max(7, Math.floor(count * 0.72));
    return count;
  }

  function packetPacingForWave(wave, { boss = false, rush = false, wall = false } = {}) {
    const safeWave = clampInteger(wave, 1, LIMITS.MAX_SUPPORTED_WAVE, 1);
    // v78 finishes the rhythm pass instead of merely shaving speed. Ordinary
    // formations now read as phrases: arrival -> pressure -> breath -> answer.
    // Rushes are still fast, but they are short authored spikes surrounded by air.
    if (boss) return { minSize: 4, maxSize: 7, gapMin: 0.58, gapMax: 0.78, breakMin: 1.90, breakMax: 2.60 };
    if (rush) return { minSize: 7, maxSize: safeWave < 25 ? 11 : 13, gapMin: 0.14, gapMax: 0.19, breakMin: 1.60, breakMax: 2.10 };
    if (wall) return { minSize: 4, maxSize: 7, gapMin: 0.42, gapMax: 0.60, breakMin: 1.80, breakMax: 2.40 };
    if (safeWave <= 5) return { minSize: 4, maxSize: 8, gapMin: 0.58, gapMax: 0.78, breakMin: 1.85, breakMax: 2.55 };
    if (safeWave <= 15) return { minSize: 6, maxSize: 10, gapMin: 0.38, gapMax: 0.54, breakMin: 1.55, breakMax: 2.25 };
    return { minSize: 7, maxSize: 12, gapMin: 0.27, gapMax: 0.40, breakMin: 1.35, breakMax: 2.05 };
  }

  function splitIntoPackets(enemies, wave, { boss = false, rush = false, wall = false } = {}) {
    const list = Array.isArray(enemies) ? enemies.slice(0, LIMITS.MAX_PLANNED_ENEMIES + 1) : [];
    const packets = [];
    let cursor = 0;
    const pacing = packetPacingForWave(wave, { boss, rush, wall });
    while (cursor < list.length) {
      const remaining = list.length - cursor;
      const span = Math.max(1, pacing.maxSize - pacing.minSize + 1);
      const authoredSize = pacing.minSize + ((packets.length * 2 + wave) % span);
      const size = Math.min(remaining, authoredSize);
      const packetEnemies = list.slice(cursor, cursor + size);
      const hasBoss = packetEnemies.some(entry => typeof entry === "object" && entry?.type === "boss");
      const t = ((packets.length + wave) % 5) / 4;
      const spawnGap = hasBoss ? 0.82 : clampNumber(pacing.gapMin + (pacing.gapMax - pacing.gapMin) * t, pacing.gapMin, pacing.gapMax, pacing.gapMin);
      const breakAfter = cursor + size >= list.length ? 0 : hasBoss ? 1.80 : clampNumber(pacing.breakMin + (pacing.breakMax - pacing.breakMin) * (1 - t), pacing.breakMin, pacing.breakMax, pacing.breakMin);
      packets.push({ enemies: packetEnemies, spawnGap, breakAfter });
      cursor += size;
    }
    if (boss && packets.length) {
      // Bosses own the last beat. Escorts resolve, the field breathes, then the
      // apex silhouette enters by itself so difficulty is legible rather than noisy.
      const finalPacket = packets[packets.length - 1];
      const bossIndex = finalPacket.enemies.findIndex(entry => typeof entry === "object" && entry?.type === "boss");
      if (bossIndex >= 0 && finalPacket.enemies.length > 1) {
        const [bossEntry] = finalPacket.enemies.splice(bossIndex, 1);
        finalPacket.breakAfter = Math.max(2.05, finalPacket.breakAfter || 0);
        packets.push({ enemies: [bossEntry], spawnGap: 1.10, breakAfter: 0 });
      } else if (bossIndex === 0 && packets.length > 1) {
        packets[packets.length - 2].breakAfter = Math.max(2.05, packets[packets.length - 2].breakAfter || 0);
      }
    }
    return packets;
  }

  function createWavePlan({ wave, specialBias = 0, weather = "clear", bossIds = ["crown", "vortex", "mirror", "apex"] } = {}) {
    const safeWave = clampInteger(wave, 1, LIMITS.MAX_SUPPORTED_WAVE, 1);
    const effective = safeWave + clampInteger(specialBias, 0, 20, 0);
    let modifier = "normal";
    let announcement = null;
    let enemies = [];

    if (safeWave % 10 === 0) {
      modifier = "boss";
      const count = plannedEnemyCount(safeWave, modifier) - 1;
      for (let index = 0; index < count; index += 1) enemies.push(index % 4 === 2 && effective >= 4 ? "shell" : index % 3 === 1 ? "fleet" : "puff");
      const ordinal = Math.max(0, Math.floor(safeWave / 10) - 1);
      enemies.push({ type: "boss", bossId: bossIds[ordinal % bossIds.length] || bossIds[0], intensity: Math.floor(ordinal / bossIds.length) });
      announcement = { title: "BOSS WAVE", copy: "Escorts first. Then the apex threat gets the trail to itself." };
    } else if (safeWave > 10 && safeWave % 10 === 1) {
      modifier = "recovery";
      const count = plannedEnemyCount(safeWave, modifier);
      for (let index = 0; index < count; index += 1) enemies.push(index % 5 === 4 ? "fleet" : "puff");
      announcement = { title: "RECOVERY WAVE", copy: "A lighter formation. Read the field, rebuild the plan, then prepare for the next test." };
    } else if (safeWave % 11 === 0 && effective >= 15) {
      modifier = "veil";
      const count = plannedEnemyCount(safeWave);
      for (let index = 0; index < count; index += 1) enemies.push(index % 4 === 0 && effective >= 22 ? "ghost" : index % 2 === 0 ? "shade" : "puff");
      announcement = { title: "VEIL WAVE", copy: "Camouflage and phase threats. Reveal and control matter more than raw fire rate." };
    } else if (safeWave % 7 === 0 && effective >= 8) {
      modifier = "hazard";
      const hazard = weather === "blizzard" ? "frost" : weather === "storm" ? "storm" : weather === "ash" ? "fire" : effective >= 17 ? "storm" : effective >= 12 ? "frost" : "fire";
      const count = plannedEnemyCount(safeWave);
      for (let index = 0; index < count; index += 1) enemies.push(index % 3 === 0 ? hazard : index % 4 === 1 ? "fleet" : "puff");
      announcement = { title: "HAZARD WAVE", copy: `${hazard.toUpperCase()} threats are mixed into the formation. Solve the property, not the head count.` };
    } else if (safeWave % 5 === 0) {
      const themeIndex = Math.floor(safeWave / 5) % 3;
      if (themeIndex === 1 && effective >= 2) {
        modifier = "rush";
        enemies = Array.from({ length: plannedEnemyCount(safeWave, modifier) }, (_, index) => index % 8 === 7 && effective >= 12 ? "storm" : "fleet");
        announcement = { title: "RUSH WAVE", copy: "A brief dense burst, followed by room to recover. FIRST targeting earns its keep." };
      } else if (themeIndex === 2 && effective >= 4) {
        modifier = "wall";
        enemies = Array.from({ length: plannedEnemyCount(safeWave, modifier) }, (_, index) => index % 5 === 4 && effective >= 12 ? "frost" : "shell");
        announcement = { title: "WALL WAVE", copy: "Fewer bodies, more durability. Crack armor and focus damage." };
      } else if (effective >= 6) {
        modifier = "swarm";
        enemies = Array.from({ length: plannedEnemyCount(safeWave, modifier) }, (_, index) => index % 3 === 0 ? "split" : index % 5 === 4 ? "fleet" : "puff");
        announcement = { title: "SWARM WAVE", copy: "Split threats arrive in authored bursts. Save headroom for what comes out of them." };
      }
    }

    if (!enemies.length) {
      const count = plannedEnemyCount(safeWave);
      for (let index = 0; index < count; index += 1) {
        let type = "puff";
        if (effective >= 2 && index % 5 === 3) type = "fleet";
        if (effective >= 4 && index % 7 === 5) type = "shell";
        if (effective >= 6 && index % 8 === 2) type = "split";
        if (effective >= 8 && index % 11 === 4) type = "fire";
        if (effective >= 12 && index % 13 === 7) type = "frost";
        if (effective >= 15 && index % 17 === 8) type = "shade";
        if (effective >= 17 && index % 19 === 6) type = "storm";
        if (effective >= 22 && index % 23 === 9) type = "ghost";
        enemies.push(type);
      }
    }

    // v80 makes late waves harder through durability rather than object count.
    // Replace existing slots with heavy identities; never append density.
    if (safeWave >= 18 && modifier !== "recovery") {
      enemies = enemies.map((entry,index) => {
        if (typeof entry === "object") return entry;
        if (safeWave >= 28 && index % Math.max(4, 9 - Math.floor(Math.min(40,safeWave-28)/10)) === 2) return "lead";
        if (index % Math.max(5, 10 - Math.floor(Math.min(50,safeWave-18)/12)) === 4) return "brick";
        return entry;
      });
    }
    const packets = splitIntoPackets(enemies, safeWave, { boss: modifier === "boss", rush: modifier === "rush", wall: modifier === "wall" });
    return {
      wave: safeWave,
      modifier,
      plannedEnemyCount: enemies.length,
      packets,
      estimatedDuration: packets.reduce((sum, packet) => sum + Math.max(0, packet.enemies.length - 1) * packet.spawnGap + packet.breakAfter, 0),
      announcement
    };
  }

  function flattenPackets(packets) {
    return (Array.isArray(packets) ? packets : []).flatMap(packet => Array.isArray(packet?.enemies) ? packet.enemies : []);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      const output = {};
      for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
      return output;
    }
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }

  function fnv1a(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function queueSignatureEntry(entry) {
    if (typeof entry === "string") return entry.slice(0, 40);
    if (!entry || typeof entry !== "object") return null;
    return stableValue({
      type: typeof entry.type === "string" ? entry.type.slice(0, 40) : "",
      bossId: typeof entry.bossId === "string" ? entry.bossId.slice(0, 40) : "",
      intensity: clampInteger(entry.intensity, 0, 99, 0)
    });
  }

  function checkpointSignaturePayload(checkpoint, signatureVersion = VERSION) {
    const source = checkpoint && typeof checkpoint === "object" ? checkpoint : {};
    const base = {
      version: signatureVersion,
      keeperId: source.keeperId || "",
      mapId: source.mapId || "",
      currentWave: clampInteger(source.currentWave ?? source.wave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
      clearedWave: clampInteger(source.clearedWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
      lives: clampInteger(source.lives, 0, 999, 0),
      cash: clampInteger(source.cash, 0, LIMITS.MAX_RUN_CASH, 0),
      kills: clampInteger(source.kills, 0, LIMITS.MAX_REASONABLE_KILLS, 0),
      totalDamage: Math.round(clampNumber(source.totalDamage, 0, LIMITS.MAX_REASONABLE_DAMAGE, 0)),
      towerCount: Array.isArray(source.towers) ? source.towers.length : 0,
      bossCount: Array.isArray(source.bossesBeaten) ? source.bossesBeaten.length : 0,
      perfectWaveCount: clampInteger(source.perfectWaveCount, 0, LIMITS.MAX_REASONABLE_PERFECT_WAVES, 0),
      savedAt: clampInteger(source.savedAt, 0, Number.MAX_SAFE_INTEGER, 0)
    };
    if (signatureVersion < 3) return stableValue(base);
    const modern = {
      ...base,
      phase: typeof source.phase === "string" ? source.phase.slice(0, 30) : "",
      resumePhase: typeof source.resumePhase === "string" ? source.resumePhase.slice(0, 30) : "",
      speed: clampNumber(source.speed, 0.5, 2, 1),
      clock: Math.round(clampNumber(source.clock, 0, 1e9, 0) * 1000) / 1000,
      bossesDefeated: clampInteger(source.bossesDefeated, 0, LIMITS.MAX_REASONABLE_BOSSES, 0),
      waveTotal: clampInteger(source.waveTotal, 0, LIMITS.MAX_QUEUE_ENTRIES + LIMITS.MAX_CHILD_BUFFER, 0),
      waveResolved: clampInteger(source.waveResolved, 0, LIMITS.MAX_REASONABLE_KILLS, 0),
      towers: (Array.isArray(source.towers) ? source.towers : []).slice(0, LIMITS.MAX_DEFENSE_TOWERS).map(tower => {
        const signedTower = {
          id: typeof tower?.id === "string" ? tower.id.slice(0, 80) : "",
          petId: typeof tower?.petId === "string" ? tower.petId.slice(0, 80) : "",
          source: tower?.source === "house" ? "house" : "active",
          x: Math.round(clampNumber(tower?.x, 0, 1, 0.5) * 10000) / 10000,
          y: Math.round(clampNumber(tower?.y, 0, 1, 0.5) * 10000) / 10000,
          upgrade: clampInteger(tower?.upgrade, 0, LIMITS.MAX_TOWER_LEVEL, 0),
          kills: clampInteger(tower?.kills, 0, LIMITS.MAX_REASONABLE_KILLS, 0),
          damage: Math.round(clampNumber(tower?.damage, 0, LIMITS.MAX_REASONABLE_DAMAGE, 0)),
          doctrine: typeof tower?.doctrine === "string" ? tower.doctrine.slice(0, 20) : ""
        };
        if (signatureVersion >= 5) signedTower.openingPerkApplied = Boolean(tower?.openingPerkApplied);
        if (signatureVersion >= 7) signedTower.superForm = ["power", "control"].includes(tower?.superForm) ? tower.superForm : "";
        return stableValue(signedTower);
      }),
      enemies: (Array.isArray(source.enemies) ? source.enemies : []).slice(0, LIMITS.MAX_CHECKPOINT_ENEMIES).map(enemy => stableValue({
        id: typeof enemy?.id === "string" ? enemy.id.slice(0, 80) : "",
        type: typeof enemy?.type === "string" ? enemy.type.slice(0, 40) : "",
        bossId: typeof enemy?.bossId === "string" ? enemy.bossId.slice(0, 40) : "",
        progress: Math.round(clampNumber(enemy?.progress, 0, 1, 0) * 10000) / 10000,
        hpRatio: Math.round(clampNumber(enemy?.hpRatio, 0, 1, 1) * 10000) / 10000,
        armorBroken: Boolean(enemy?.armorBroken),
        armorShredded: Boolean(enemy?.armorShredded)
      })),
      spawnQueue: (Array.isArray(source.spawnQueue) ? source.spawnQueue : []).slice(0, LIMITS.MAX_QUEUE_ENTRIES).map(queueSignatureEntry),
      childSpawnQueue: (Array.isArray(source.childSpawnQueue) ? source.childSpawnQueue : []).slice(0, LIMITS.MAX_CHILD_BUFFER).map(item => stableValue({
        entry: queueSignatureEntry(item?.entry || item?.type),
        progress: Math.round(clampNumber(item?.progress, 0, 1, 0) * 10000) / 10000,
        releaseAt: Math.round(clampNumber(item?.releaseAt, 0, 1e9, 0) * 1000) / 1000
      }))
    };
    if (signatureVersion >= 5) modern.worldPerkUsed = Boolean(source.worldPerkUsed);
    if (signatureVersion >= 6) {
      modern.gateFlameReadyAt = Math.round(clampNumber(source.gateFlameReadyAt, 0, 1e9, 0) * 1000) / 1000;
      modern.gateFlameUntil = Math.round(clampNumber(source.gateFlameUntil, 0, 1e9, 0) * 1000) / 1000;
      modern.gateFlameProgress = Math.round(clampNumber(source.gateFlameProgress, 0, 1, .86) * 10000) / 10000;
      modern.gateFlameNextTick = Math.round(clampNumber(source.gateFlameNextTick, 0, 1e9, 0) * 1000) / 1000;
      modern.gateFlameTicks = clampInteger(source.gateFlameTicks, 0, 1000, 0);
    }
    return stableValue(modern);
  }

  function createSaveSignature(checkpoint, signatureVersion = VERSION) {
    const version = clampInteger(signatureVersion, 2, VERSION, VERSION);
    const salt = CHECKPOINT_SALTS[version];
    if (!salt) return "";
    return `v${version}.${fnv1a(`${salt}|${JSON.stringify(checkpointSignaturePayload(checkpoint, version))}`)}`;
  }

  function verifySaveSignature(checkpoint) {
    if (!checkpoint || typeof checkpoint !== "object" || typeof checkpoint.signature !== "string") return false;
    const match = /^v(\d+)\./.exec(checkpoint.signature);
    const version = match ? Number(match[1]) : 0;
    return Boolean(CHECKPOINT_SALTS[version]) && checkpoint.signature === createSaveSignature(checkpoint, version);
  }

  function stateSignaturePayload(state, savedAt, schemaVersion = STATE_SAVE_VERSION) {
    const source = state && typeof state === "object" ? state : {};
    const scores = source.scores && typeof source.scores === "object" ? source.scores : {};
    const pet = source.pet && typeof source.pet === "object" ? source.pet : {};
    const farm = source.farm && typeof source.farm === "object" ? source.farm : {};
    const inventory = source.inventory && typeof source.inventory === "object" ? source.inventory : {};
    const collection = source.collection && typeof source.collection === "object" && !Array.isArray(source.collection) ? source.collection : {};
    const defenseMaps = scores.defenseMaps && typeof scores.defenseMaps === "object" && !Array.isArray(scores.defenseMaps) ? scores.defenseMaps : {};
    const defenseMastery = scores.defenseMastery && typeof scores.defenseMastery === "object" && !Array.isArray(scores.defenseMastery) ? scores.defenseMastery : {};
    return stableValue({
      schemaVersion,
      stateVersion: clampInteger(source.version, 0, 10_000, 0),
      savedAt: clampInteger(savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      player: {
        keeperId: typeof source.player?.keeperId === "string" ? source.player.keeperId.slice(0, 80) : "",
        streak: clampInteger(source.player?.streak, 0, LIMITS.MAX_META_COUNTER, 0),
        totalSessions: clampInteger(source.player?.totalSessions, 0, LIMITS.MAX_META_COUNTER, 0)
      },
      wallet: {
        embers: clampInteger(source.wallet?.embers, 0, LIMITS.MAX_WALLET_EMBERS, 0),
        shards: clampInteger(source.wallet?.shards, 0, LIMITS.MAX_WALLET_SHARDS, 0)
      },
      pet: {
        id: typeof pet.id === "string" ? pet.id.slice(0, 80) : "",
        number: clampInteger(pet.number, 0, LIMITS.MAX_META_COUNTER, 0),
        name: typeof pet.name === "string" ? pet.name.slice(0, 20) : "",
        stage: typeof pet.stage === "string" ? pet.stage.slice(0, 30) : "",
        variant: typeof (pet.variant || pet.hiddenVariant) === "string" ? (pet.variant || pet.hiddenVariant).slice(0, 30) : "",
        form: typeof pet.form === "string" ? pet.form.slice(0, 30) : "",
        xp: Math.round(clampNumber(pet.xp, 0, LIMITS.MAX_PLAYER_XP, 0)),
        bond: Math.round(clampNumber(pet.bond, 0, 100, 0) * 100) / 100,
        skills: stableValue(pet.skills || {}),
        genes: stableValue(pet.genes || {})
      },
      inventory: {
        accessories: (Array.isArray(inventory.accessories) ? inventory.accessories : []).slice(0, 200),
        rooms: (Array.isArray(inventory.rooms) ? inventory.rooms : []).slice(0, 200),
        phoenix: clampInteger(inventory.phoenix, 0, LIMITS.MAX_INVENTORY_STACK, 0),
        growth: clampInteger(inventory.growth, 0, LIMITS.MAX_INVENTORY_STACK, 0),
        care: clampInteger(inventory.care, 0, LIMITS.MAX_INVENTORY_STACK, 0)
      },
      achievements: (Array.isArray(source.achievements) ? source.achievements : []).slice(0, 500),
      daily: {
        date: typeof source.daily?.date === "string" ? source.daily.date.slice(0, 20) : "",
        type: typeof source.daily?.type === "string" ? source.daily.type.slice(0, 30) : "",
        progress: clampNumber(source.daily?.progress, 0, LIMITS.MAX_META_COUNTER, 0),
        claimed: Boolean(source.daily?.claimed),
        giftClaimed: Boolean(source.daily?.giftClaimed)
      },
      season: {
        xp: clampNumber(source.season?.xp, 0, LIMITS.MAX_SEASON_XP, 0),
        level: clampInteger(source.season?.level, 1, LIMITS.MAX_SEASON_LEVEL, 1)
      },
      expedition: stableValue(source.expedition || {}),
      treasures: stableValue(source.treasures || {}),
      collection: Object.fromEntries(Object.entries(collection).slice(0, 200).map(([id, count]) => [id.slice(0, 40), clampInteger(count, 0, LIMITS.MAX_COLLECTION_COUNT, 0)])),
      arcade: Object.fromEntries(["power", "spark", "forage", "rush", "walk", "rhythm", "memory", "glide", "breaker", "maze"].map(id => [id, clampNumber(scores[id], 0, LIMITS.MAX_REASONABLE_DAMAGE, 0)])),
      defense: {
        best: clampInteger(scores.defense, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
        maps: Object.fromEntries(Object.entries(defenseMaps).slice(0, 20).map(([id, wave]) => [id.slice(0, 40), clampInteger(wave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0)])),
        milestones: (Array.isArray(scores.defenseMilestones) ? scores.defenseMilestones : []).slice(0, 20),
        perfectMaps: (Array.isArray(scores.defensePerfectMaps) ? scores.defensePerfectMaps : []).slice(0, 20),
        contracts: (Array.isArray(scores.defenseContracts) ? scores.defenseContracts : []).slice(0, 60).map(contract => ({
          id: typeof contract?.id === "string" ? contract.id.slice(0, 80) : "",
          date: typeof contract?.date === "string" ? contract.date.slice(0, 20) : "",
          mapId: typeof contract?.mapId === "string" ? contract.mapId.slice(0, 40) : "",
          targetWave: clampInteger(contract?.targetWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
          bestWave: clampInteger(contract?.bestWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
          completed: Boolean(contract?.completed),
          perfect: Boolean(contract?.perfect)
        })),
        history: (Array.isArray(scores.defenseHistory) ? scores.defenseHistory : []).slice(0, 12).map(run => ({
          id: typeof run?.id === "string" ? run.id.slice(0, 80) : "",
          mapId: typeof run?.mapId === "string" ? run.mapId.slice(0, 40) : "",
          clearedWave: clampInteger(run?.clearedWave ?? run?.wave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
          reachedWave: clampInteger(run?.reachedWave ?? run?.currentWave ?? run?.wave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
          kills: clampInteger(run?.kills, 0, LIMITS.MAX_REASONABLE_KILLS, 0),
          bosses: clampInteger(run?.bosses, 0, LIMITS.MAX_REASONABLE_BOSSES, 0),
          perfectWaveCount: clampInteger(run?.perfectWaveCount, 0, LIMITS.MAX_REASONABLE_PERFECT_WAVES, 0)
        })),
        mastery: Object.fromEntries(Object.entries(defenseMastery).slice(0, 100).map(([id, row]) => [id.slice(0, 80), {
          runs: clampInteger(row?.runs, 0, LIMITS.MAX_MASTERY_RUNS, 0),
          waves: clampInteger(row?.waves, 0, LIMITS.MAX_MASTERY_WAVES, 0),
          bestWave: clampInteger(row?.bestWave, 0, LIMITS.MAX_SUPPORTED_WAVE, 0),
          pops: clampInteger(row?.pops, 0, LIMITS.MAX_REASONABLE_KILLS, 0),
          damage: Math.round(clampNumber(row?.damage, 0, LIMITS.MAX_REASONABLE_DAMAGE, 0))
        }]))
      },
      farm: {
        activeRoom: clampInteger(farm.activeRoom, 0, 100, 0),
        unlockedRooms: (Array.isArray(farm.unlockedRooms) ? farm.unlockedRooms : []).slice(0, 100),
        totalAdoptions: clampInteger(farm.totalAdoptions, 0, LIMITS.MAX_META_COUNTER, 0),
        totalReleased: clampInteger(farm.totalReleased, 0, LIMITS.MAX_META_COUNTER, 0),
        materials: clampInteger(farm.materials, 0, LIMITS.MAX_INVENTORY_STACK, 0),
        roster: (Array.isArray(farm.roster) ? farm.roster : []).slice(0, 100).map(row => ({
          id: typeof row?.id === "string" ? row.id.slice(0, 80) : "",
          number: clampInteger(row?.number, 0, LIMITS.MAX_META_COUNTER, 0),
          stage: typeof row?.stage === "string" ? row.stage.slice(0, 30) : "",
          variant: typeof (row?.variant || row?.hiddenVariant) === "string" ? (row.variant || row.hiddenVariant).slice(0, 30) : "",
          xp: Math.round(clampNumber(row?.xp, 0, LIMITS.MAX_PLAYER_XP, 0)),
          skills: stableValue(row?.skills || {})
        }))
      },
      meta: {
        totalGames: clampInteger(source.meta?.totalGames, 0, LIMITS.MAX_META_COUNTER, 0),
        totalHatched: clampInteger(source.meta?.totalHatched, 0, LIMITS.MAX_META_COUNTER, 0),
        totalTaps: clampInteger(source.meta?.totalTaps, 0, LIMITS.MAX_META_COUNTER, 0),
        totalCareActions: clampInteger(source.meta?.totalCareActions, 0, LIMITS.MAX_META_COUNTER, 0),
        totalWalks: clampInteger(source.meta?.totalWalks, 0, LIMITS.MAX_META_COUNTER, 0),
        deaths: clampInteger(source.meta?.deaths, 0, LIMITS.MAX_META_COUNTER, 0),
        recoveries: clampInteger(source.meta?.recoveries, 0, LIMITS.MAX_META_COUNTER, 0),
        capsules: clampInteger(source.meta?.capsules, 0, LIMITS.MAX_META_COUNTER, 0),
        rebirths: clampInteger(source.meta?.rebirths, 0, LIMITS.MAX_META_COUNTER, 0),
        bondEggs: clampInteger(source.meta?.bondEggs, 0, LIMITS.MAX_META_COUNTER, 0),
        pity: clampInteger(source.meta?.pity, 0, LIMITS.MAX_META_COUNTER, 0),
        shadowFinds: clampInteger(source.meta?.shadowFinds, 0, LIMITS.MAX_META_COUNTER, 0)
      },
      loreUnlocked: (Array.isArray(source.loreUnlocked) ? source.loreUnlocked : []).slice(0, 200)
    });
  }

  function createStateSignature(state, savedAt, schemaVersion = STATE_SAVE_VERSION) {
    const version = clampInteger(schemaVersion, 1, STATE_SAVE_VERSION, STATE_SAVE_VERSION);
    return `s${version}.${fnv1a(`${STATE_SAVE_SALT}|${JSON.stringify(stateSignaturePayload(state, savedAt, version))}`)}`;
  }

  function verifyStateSignature(envelope) {
    if (!envelope || typeof envelope !== "object" || typeof envelope.signature !== "string") return false;
    const version = clampInteger(envelope.saveVersion, 1, STATE_SAVE_VERSION, 0);
    if (!version || !envelope.state || typeof envelope.state !== "object") return false;
    return envelope.signature === createStateSignature(envelope.state, envelope.savedAt, version);
  }

  return {
    VERSION,
    STATE_SAVE_VERSION,
    LIMITS,
    PHASES,
    PHASE_TRANSITIONS,
    BUDGETS,
    SIMULATION,
    UPGRADE_COSTS,
    ECONOMY,
    clampNumber,
    clampInteger,
    isKnownId,
    normalizePhase,
    isCombatPhase,
    canTransitionPhase,
    phaseAllows,
    performanceTier,
    visualBudget,
    childReservationCount,
    densityCap,
    upgradeCost,
    calculateTowerInvestment,
    deploymentCost,
    goldenBonus,
    goldenActivePayout,
    recommendedTowerCount,
    calculateWaveBonus,
    calculateRunEmbers,
    calculateEnemyReward,
    plannedEnemyCount,
    packetPacingForWave,
    splitIntoPackets,
    createWavePlan,
    flattenPackets,
    createSaveSignature,
    verifySaveSignature,
    createStateSignature,
    verifyStateSignature
  };
});
