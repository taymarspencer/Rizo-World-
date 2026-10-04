
/**
 * RIZO WORLD LAUNCH CONFIG
 * =======================
 * This is intentionally the only file you should need to edit for ordinary launches.
 *
 * SAFE DEFAULT: advertising is OFF. See docs/current/MONETIZATION-ARCHITECTURE.md
 * for account approval, privacy, placement and testing gates before enabling it.
 * Never test production ads by clicking them yourself.
 */
window.RIZO_CONFIG = Object.freeze({
  brand: {
    siteName: "Rizo World",
    siteUrl: "https://rizo.world",
    worldUrl: "./world.html",
    storeUrl: "https://rizo.store",
    supportUrl: "./support.html",
    contactUrl: "https://rizo.store/pages/contact-us"
  },

  audience: {
    // Recommendation only; this does not establish COPPA status or ad treatment.
    minimumAge: 13,
    label: "Recommended for ages 13+"
  },

  installPrompt: {
    // Phase 6: never interrupt first launch with an install/download-looking gate.
    // Installation remains available through window.RizoInstall.show() from settings.
    enabled: false,
    // People who choose browser mode will see the reminder again after this many days.
    remindAfterDays: 14
  },

  ads: {
    // OFF until site/account approval, H5 access, reviewed placements and a real
    // privacy adapter exist. Connecting an SDK cannot turn these gates on.
    enabled: false,
    provider: "none",
    publisherVerified: false,
    // No placements are approved. Examples belong in documentation/tests.
    placements: {},
    requestCooldownMs: 30000,
    interstitialCooldownMs: 180000,
    maxRequestsPerSession: 3,

    // Keep true in approved integration testing. Live mode also requires every
    // launch gate in MONETIZATION-ARCHITECTURE.md; this flag is not permission.
    testMode: true,

    adsense: {
      // Inherited from play.rizo.store. Account/domain ownership has NOT been
      // verified here. Not emitted or used while publisherVerified is false.
      // Confirm with the owner before reusing it for rizo.world.
      client: "ca-pub-3212890596786480",
      displaySlots: {
        "home-feed": "REPLACE_HOME_SLOT_ID",
        "arcade-between-games": "REPLACE_ARCADE_SLOT_ID",
        "shop-footer": "REPLACE_SHOP_SLOT_ID"
      }
    },

    h5Games: {
      // H5 rewarded/interstitial ads require separate Google approval.
      enabled: false,
      // A hint, not a promise. Google still decides whether an ad may be shown.
      frequencyHintSeconds: 180,
      rewardTimeoutMs: 45000
    }
  },

  analytics: {
    // Reserved for a future privacy-aware analytics provider. No tracking runs by default.
    enabled: false,
    provider: "none"
  }
});
