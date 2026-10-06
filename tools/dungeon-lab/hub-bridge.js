/*
  RIZO DUNGEON CHARACTER LAB — HUB BRIDGE (development only)
  ==========================================================
  The player's Rizo is not a Dungeon painter: on screen it is the hub's own
  pet markup (host.petMarkup(snapshot, { context: "dungeon" })), styled by the
  hub's stylesheets and staged by dungeon.css poses. To show the real Rizo the
  lab boots the real hub, isolated:

    - inside a hidden srcdoc iframe (about:srcdoc: the hub never registers a
      service worker there, and nothing in it is a page a player can reach);
    - every script is fetched from the repo and its localStorage and
      sessionStorage are rewritten to in-memory stores (the same rewrite the
      browser test harness uses), so the lab can never read or write a save;
    - the QA build flag is forced on, so RizoRuntimeQA can seed a pet in memory.

  It then hands back the hub's markup for a pet of a chosen stage/variant and
  the stylesheet list the page loads, so each Rizo slot can be rendered in a
  tiny transparent iframe with exactly the game's CSS.

  RizoLabHub.boot() → Promise<{ markup({ stage, variant, accessory }), styles, stages, variants }>
*/
(function initRizoLabHub(root) {
  "use strict";
  const REPO = new URL("../../", document.baseURI);
  const STAGES = ["spark", "kid", "teen", "beast", "legend"];
  let booting = null;

  const read = async path => {
    const response = await fetch(new URL(path, REPO), { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.text();
  };

  async function build() {
    let html = await read("index.html");
    const styles = [...html.matchAll(/<link href="\.\/([A-Za-z0-9_./-]+\.css)" rel="stylesheet"/g)].map(match => match[1]);
    const scripts = [...html.matchAll(/<script src="\.\/([A-Za-z0-9_./-]+\.js)"><\/script>/g)].map(match => match[1]);
    let qaForced = false;
    for (const src of scripts) {
      let js = (await read(src)).replace(/localStorage/g, "__labStorage").replace(/sessionStorage/g, "__labSession");
      if (/const IS_QA_BUILD=[^;]+;/.test(js)) { js = js.replace(/const IS_QA_BUILD=[^;]+;/, "const IS_QA_BUILD=true;"); qaForced = true; }
      html = html.replace(`<script src="./${src}"></script>`, () => `<script>${js.replace(/<\/script>/gi, "<\\/script>")}</script>`);
    }
    if (!qaForced) throw new Error("the hub's QA flag was not found; the bridge cannot seed a pet");
    // Inline scripts in the page itself get the same rewrite; then memory stores and the repo as base.
    html = html.replace(/localStorage/g, "__labStorage").replace(/sessionStorage/g, "__labSession");
    const shim = `<base href="${REPO.href}"><script>(()=>{const make=()=>{const m=new Map();return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>{m.set(String(k),String(v))},removeItem:k=>{m.delete(String(k))},clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size}}};window.__labStorage=make();window.__labSession=make();})();</script>`;
    html = html.replace(/<head>/i, `<head>${shim}`);
    return { html, styles };
  }

  function waitFor(win, test, ms = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        let value = null;
        try { value = test(win); } catch (error) { value = null; }
        if (value) { resolve(value); return; }
        if (Date.now() - start > ms) { reject(new Error("the hub did not boot in the bridge")); return; }
        setTimeout(poll, 60);
      })();
    });
  }

  async function bootOnce() {
    const { html, styles } = await build();
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "hub bridge (hidden)";
    Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "390px", height: "844px", border: "0", visibility: "hidden" });
    document.body.appendChild(frame);
    frame.srcdoc = html;
    const qa = await waitFor(frame.contentWindow, win => (win.RizoRuntimeQA?.markupForQA && win.RizoRuntimeQA?.defaultState ? win.RizoRuntimeQA : null));
    let variants = ["classic"];
    try { variants = (qa.visualMatrixForQA?.().variants || []).map(item => item.id || item).filter(Boolean); } catch (error) {}
    let last = "";
    function markup({ stage = "kid", variant = "classic", accessory = "none" } = {}) {
      const key = `${stage}:${variant}:${accessory}`;
      if (key !== last) {
        const state = qa.defaultState();
        Object.assign(state.pet, { name: "RIZO", stage, variant, hiddenVariant: variant, energy: 90, hunger: 90, mood: 90, hygiene: 90, health: 100, resting: false, sleeping: false, accessory });
        state.collection = { ...(state.collection || {}), [variant]: 1 };
        state.player.tutorialDismissed = true;
        qa.loadForQA(state); // in-memory only: the bridge's storage is a Map
        last = key;
      }
      return qa.markupForQA("dungeon", accessory);
    }
    return { markup, styles, stages: STAGES, variants: variants.length ? variants : ["classic"], frame };
  }

  root.RizoLabHub = Object.freeze({
    boot: () => (booting ||= bootOnce()),
    REPO
  });
})(window);
