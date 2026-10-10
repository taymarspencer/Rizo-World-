/* Google callbacks behind RizoAdCore. Injected functions keep contract tests
   local. This module never loads a script or owns a gameplay reward. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RizoGoogleH5 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  function createProvider({ adBreak, adConfig, soundEnabled = () => false }) {
    if (typeof adBreak !== "function" || typeof adConfig !== "function") throw new Error("H5 API unavailable");
    return Object.freeze({
      request(opportunity, hooks) {
        return new Promise(resolve => {
          let viewed = false, shown = false, done = false, offered = false;
          const finish = status => { if (done) return; done = true; resolve({ status, shown, rewardEarned: viewed }); };
          adConfig({ sound: soundEnabled() ? "on" : "off" });
          const config = {
            type: opportunity.format === "rewarded" ? "reward" : opportunity.type,
            name: "rizo-" + opportunity.id,
            beforeAd: () => { shown = true; hooks.start(); },
            afterAd: () => hooks.end(),
            adBreakDone: info => finish(info?.breakStatus || "complete")
          };
          if (opportunity.format === "rewarded") Object.assign(config, {
            beforeReward(showAd) {
              if (offered || !hooks.canShow()) { finish("cancelled"); return; }
              offered = true;
              let chosen = false;
              // Caller must provide a truthful offer with Watch and No. Inventory
              // alone never invokes showAd; the actual choice invokes offer.show().
              const offer = Object.freeze({
                show() { if (chosen || done) return false; chosen = true; if (!hooks.canShow()) { finish("cancelled"); return false; } showAd(); return true; },
                cancel() { if (chosen || done) return false; chosen = true; finish("declined"); return true; }
              });
              try { opportunity.confirm(offer); } catch (_) { offer.cancel(); }
            },
            adViewed: () => { if (!done) viewed = true; },
            adDismissed: () => { viewed = false; }
          });
          adBreak(config);
        });
      }
    });
  }
  return Object.freeze({ createProvider });
});
