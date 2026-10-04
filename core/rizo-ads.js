/* Provider-independent ad boundary: no network, storage, rewards or IDs.
   Public defaults deny every placement. Providers receive no pet/keeper data. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RizoAdCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  function createBridge(options = {}) {
    const now = options.now || Date.now, schedule = options.schedule || setTimeout, cancelTimer = options.cancelTimer || clearTimeout;
    const catalog = options.placements || {}, seen = new Set();
    let provider = null, active = null, requests = 0, lastRequest = -Infinity, lastShown = -Infinity, lastOutcome = "disabled";
    const gate = fn => { try { return fn?.() === true; } catch (_) { return false; } };
    const enabled = () => gate(options.enabled), consent = () => gate(options.canRequestAds), safe = () => gate(options.contextSafe);
    const emit = (hook, detail) => { try { options[hook]?.(detail); } catch (_) { /* UI hooks cannot break settlement */ } };
    const approved = (def, format) => def?.enabled === true && def.format === format &&
      (format === "rewarded" || (format === "interstitial" && ["next", "pause", "browse"].includes(def.type || "next")));
    function available(id) {
      const def = catalog[id];
      return Boolean(enabled() && consent() && provider?.request && approved(def, def?.format));
    }
    function request(format, id, input = {}) {
      const def = catalog[id];
      function refuse(reason) { lastOutcome = reason; return Promise.resolve(false); }
      if (!enabled()) return refuse("disabled");
      if (!consent()) return refuse("privacy-blocked");
      if (!provider?.request) return refuse("unavailable");
      if (!approved(def, format)) return refuse("unapproved-placement");
      if (active) return refuse("busy");
      if (!safe() || input.naturalBreak !== true) return refuse("unsafe-context");
      if (format === "rewarded" && (input.userInitiated !== true || typeof input.confirm !== "function")) return refuse("opt-in-required");
      if (typeof input.opportunityId !== "string" || !/^[a-zA-Z0-9:_-]{1,96}$/.test(input.opportunityId)) return refuse("invalid-opportunity");
      const key = id + ":" + input.opportunityId;
      if (seen.has(key)) return refuse("duplicate");
      if (requests >= Math.max(1, Number(options.maxRequestsPerSession) || 3)) return refuse("session-cap");
      if (now() - lastRequest < Math.max(0, Number(options.requestCooldownMs) || 30000)) return refuse("request-cooldown");
      if (format === "interstitial" && now() - lastShown < Math.max(0, Number(options.interstitialCooldownMs) || 180000)) return refuse("frequency-cap");
      seen.add(key); requests += 1; lastRequest = now();
      const selected = provider;
      return new Promise(resolve => {
        const token = { settled: false, started: false, ended: false, timedOut: false, timer: null };
        active = token;
        const detail = { placement: id, format };
        const hooks = {
          canShow: () => !token.settled && consent() && safe(),
          start() {
            if (token.started) return;
            token.started = true; lastShown = now();
            // A faulty SDK can start late after a timeout. Still hold input and
            // sound. Its late completion can never grant a reward.
            emit("onStart", detail);
          },
          end(reason = "complete") {
            if (!token.started || token.ended) return;
            token.ended = true;
            emit("onEnd", { ...detail, reason, requiresResume: reason === "timeout" || reason === "error" || token.timedOut });
          }
        };
        function finish(outcome, reason) {
          if (token.settled) return;
          token.settled = true; cancelTimer(token.timer); hooks.end(reason);
          if (active === token) active = null;
          lastOutcome = reason;
          // A shown ad, timer, click, dismissal or status string earns nothing.
          resolve(format === "rewarded" ? outcome?.rewardEarned === true : outcome?.shown === true);
        }
        token.timer = schedule(() => {
          // Quarantine a stalled provider. Never queue automatic retries behind
          // an SDK whose lifecycle is unknown. Core gameplay continues.
          if (provider === selected) provider = null;
          token.timedOut = true;
          finish(null, "timeout"); emit("onChange", {});
        }, Math.max(1000, Number(options.timeoutMs) || 45000));
        try {
          Promise.resolve(selected.request({ format, id, type: def.type || "next", confirm: input.confirm }, hooks))
            .then(result => finish(result, result?.status || "complete"), () => finish(null, "error"));
        } catch (_) { finish(null, "error"); }
      });
    }
    return Object.freeze({
      setProvider(next) { if (active) return false; provider = next && typeof next.request === "function" ? next : null; emit("onChange", {}); return true; },
      available,
      showRewarded: (id, input) => request("rewarded", id, input),
      showInterstitial: (id, input) => request("interstitial", id, input),
      // Display units are not approved in the touch-driven hub.
      mountBanner: () => false,
      status: () => Object.freeze({ enabled: enabled(), ready: Boolean(provider), busy: Boolean(active), requests, lastOutcome })
    });
  }
  return Object.freeze({ createBridge });
});
