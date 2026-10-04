/* Deployment wiring only. Providers own neither gameplay nor privacy decisions.
   This release sends no ad/analytics requests and impersonates no CMP.
   Read docs/current/MONETIZATION-ARCHITECTURE.md before enabling placements. */
(() => {
  "use strict";
  const cfg = window.RIZO_CONFIG?.ads || {};
  let privacyAdapter = null, scriptPromise = null, connectPromise = null;
  const validClient = value => /^ca-pub-\d{16}$/.test(String(value || ""));
  function canRequestAds() {
    try { return privacyAdapter?.canRequestAds() === true; } catch (_) { return false; }
  }
  window.RizoPrivacy = Object.freeze({
    canRequestAds,
    // A reviewed CMP adapter must own regional rules, records, revocation and
    // provider signals. This gate neither stores nor manufactures consent.
    setAdapter(adapter) {
      privacyAdapter = adapter && typeof adapter.canRequestAds === "function" ? adapter : null;
      if (!canRequestAds()) window.RizoAds?.setProvider(null);
      else connect();
    }
  });
  function configured() {
    return cfg.enabled === true && cfg.provider === "google-h5" && cfg.publisherVerified === true
      && cfg.h5Games?.enabled === true && validClient(cfg.adsense?.client)
      && Object.values(cfg.placements || {}).some(def => def.enabled === true);
  }
  function loadScript() {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      if (!configured() || !canRequestAds()) return reject(new Error("Ad configuration or privacy gate is closed"));
      const script = document.createElement("script");
      script.async = true; script.crossOrigin = "anonymous";
      script.dataset.rizoGoogleAds = "true";
      if (cfg.testMode === true) script.dataset.adbreakTest = "on";
      script.dataset.adFrequencyHint = Math.max(180, Number(cfg.h5Games.frequencyHintSeconds) || 180) + "s";
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsense.client);
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = options => window.adsbygoogle.push(options);
      const timer = setTimeout(() => reject(new Error("H5 initialization timed out")), 12000);
      script.onerror = () => { clearTimeout(timer); reject(new Error("H5 script unavailable")); };
      script.onload = () => {
        if (!canRequestAds()) { clearTimeout(timer); reject(new Error("Privacy gate changed")); return; }
        window.adConfig({ preloadAdBreaks: "auto", sound: "off", onReady: () => { clearTimeout(timer); resolve(); } });
      };
      document.head.appendChild(script);
    });
    return scriptPromise;
  }
  async function connect() {
    if (!configured() || !canRequestAds() || !/^https?:$/.test(location.protocol) || !window.RizoAds) return false;
    if (connectPromise) return connectPromise;
    connectPromise = (async () => {
      try {
        await loadScript();
        if (!canRequestAds()) return false;
        return window.RizoAds.setProvider(window.RizoGoogleH5.createProvider({
          adBreak: options => window.adBreak(options), adConfig: options => window.adConfig(options),
          soundEnabled: () => document.body.dataset.rizoSound === "on"
        }));
      } catch (_) { return false; } // offline/blocked ads never block game boot
    })().finally(() => { connectPromise = null; });
    return connectPromise;
  }
  // Verification is a deliberate STATIC HTML/account step, separate from serving.
  // A plausible legacy ID does not prove ownership of this domain/account.
  window.addEventListener("rizo:adbridge-ready", connect, { once: true });
  window.RizoMonetization = Object.freeze({ connect });
})();
