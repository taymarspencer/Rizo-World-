/*
  RIZO DUNGEON CHARACTER LAB (development only; never shipped)
  ============================================================
  Edit a character → reload → compare. Every figure here is painted by the
  real modes/dungeon/dungeon-art.js functions with the same options the game
  passes (dungeon-view.js paintNpc / paintEnemy), at the same world→screen
  scale the game uses on each phone (screen width / 320 CSS px per world
  unit, canvas capped at 2× device pixels). Rizo is the hub's own pet markup
  staged by dungeon.css poses, booted in memory by hub-bridge.js.

  Views (hash: #v=…):
    inspect   one character, one state, world and/or portrait, any scale
    sheet     every state (and world expression) of one character
    lineup    the cast side by side: colour, values and silhouettes
    phones    the cast inside each phone's real screen, with a dialogue box
    portraits every portrait expression at 46 / 56 / 128 px, faces side by side

  Nothing here reads or writes storage, touches a save, or changes the game.
*/
(function initRizoDungeonLab() {
  "use strict";
  const Art = window.RizoDungeonArt, Content = window.RizoDungeonContent;
  const app = document.getElementById("lab");
  if (!Art || !Content) { app.innerHTML = '<p class="lab-error">The Dungeon art scripts did not load. Serve the repository root (python3 tools/dungeon-lab/serve.py) and open /tools/dungeon-lab/.</p>'; return; }
  const P = Art.P;
  const CAMERA_WIDTH = 320, DPR_CAP = 2;
  const TAU = Math.PI * 2;

  // ===== PHONES: the Dungeon screen measured in the live game (tests/browser-dungeon-character-lab.py keeps these honest)
  // locked = BELOW (the Rizo Field Unit); open = the opening outside (full-bleed).
  const PHONES = Object.freeze({
    "320": Object.freeze({ label: "320×568", locked: { w: 284, h: 350 }, open: { w: 292, h: 344 }, portrait: 46 }),
    "375": Object.freeze({ label: "375×812", locked: { w: 315, h: 472 }, open: { w: 340, h: 510 }, portrait: 56 }),
    "390": Object.freeze({ label: "390×844", locked: { w: 330, h: 495 }, open: { w: 355, h: 532 }, portrait: 56 }),
    "430": Object.freeze({ label: "430×932", locked: { w: 370, h: 555 }, open: { w: 393, h: 589 }, portrait: 56 })
  });
  const scaleOf = (phone, shell) => PHONES[phone][shell].w / CAMERA_WIDTH;

  // ===== THE CAST =====
  // Each state passes exactly the options the game passes for it.
  const walkBob = t => Math.sin(t / 110) * 2;
  const RIZO_STAGE_SCALE = { spark: 0.82, kid: 0.9, teen: 0.96, beast: 1, legend: 1.04 }; // dungeon-view.js STAGE_SCALE
  const RIZO_ACTOR_UNITS = 34; // dungeon-view.js ACTOR_UNITS
  const NELL_STATES = ["work", "support", "lift", "clear", "point", "listen", "fix", "walk", "eat", "brace", "tired", "fit", "sit"]; // dungeon-art.js NELL_ARMS
  const RIZO_POSES = [
    ["still", "is-still"], ["walking", "is-moving"], ["flare (below)", "is-flare"], ["spark (outside)", "is-spark"], ["tuck", "is-tuck"], ["kindle", "is-kindle"], ["hurt", "is-hurt"], ["down", "is-down"],
    ...["look-up", "look-back", "hesitate", "shiver", "shake", "recoil", "settle", "approach-stop", "hop", "lying", "getup", "fall", "land", "press-glass", "pull-in", "curl", "lean-back", "edge", "tremble", "slip", "scramble", "held", "loosen", "watch", "notice", "stare"].map(name => [name, `pose-${name}`]),
    ["wet (outside)", "is-wet"], ["warm (hearth)", "is-warm"], ["wearing the wrap", "wear-wrap"]
  ];
  const CAST = [
    {
      id: "rizo", name: "Rizo", role: "the player's own pet: the light he carries is the only warm thing below", shell: "locked", rizo: true, units: 34,
      states: RIZO_POSES.map(([label, cls]) => ({ id: label, cls }))
    },
    {
      id: "latch", name: "Latch", role: "a stranded courier: folded-paper coat, collar up, postal cap, satchel", shell: "locked", units: Art.RULES.scale.latch, portraits: "latch", world: Art.latch,
      exprs: ["procedural", "startled", "dry", "soft", "urgent"],
      states: [
        { id: "standing", o: {} }, { id: "walking", o: {}, walk: true }, { id: "pinned (trapped in the Hem)", o: { pinned: true } },
        { id: "pulling (the Porter's alcove)", o: { pulling: true }, expr: "urgent" }, { id: "seated (the Hearth bench)", o: { seated: true } }, { id: "unloaded (Receiving)", o: { state: "unloaded" } }
      ]
    },
    {
      id: "nell", name: "Nell", role: "the Mending Rows mender: work coat, apron, strap, head wrap", shell: "locked", units: Art.HEIGHT.nell, portraits: "nell", world: Art.nell, exprs: ["work", "measuring", "listening", "amused", "irritated", "tired"],
      states: NELL_STATES.map(state => ({ id: state, o: { state }, walk: state === "walk" }))
    },
    {
      id: "orr", name: "Orr", role: "the kitchen runner: low cap, towel shoulder, apron, an oversized tray", shell: "locked", units: Art.HEIGHT.orr, portraits: "orr", world: Art.orr, exprs: ["serving", "irritated", "dry"],
      states: [{ id: "tray", o: { state: "tray" } }, { id: "carry (leaving with the tray)", o: { state: "carry" } }, { id: "walking (carry)", o: { state: "carry" }, walk: true }, { id: "hands free", o: { state: "serving" } }]
    },
    {
      id: "porter", name: "Night Porter", role: "the boss: an empty greatcoat with a hall lantern for a head", shell: "locked", facing: false, units: Art.RULES.scale.porter, world: Art.porter, enemy: true,
      states: [
        { id: "closed (waiting)", o: {} }, { id: "opening", o: { open: 0.5 } }, { id: "open (reachable)", o: { open: 1 } }, { id: "hit (flash)", o: { open: 1, flash: true } },
        { id: "charge tell", o: { lean: 0.6 } }, { id: "charge", o: { lean: 1 } }, { id: "lamp sweep", o: { lampAim: 1 } }, { id: "settled (defeated)", o: { settled: true } }
      ]
    },
    {
      id: "hood-tall", name: "Tall hood", role: "kidnapping crew: slides and socks, hood drooping over a ski mask", shell: "open", units: Art.RULES.scale["hood-tall"], portraits: "hood-tall",
      world: (ctx, x, y, o) => Art.hood(ctx, "hood-tall", x, y, o),
      states: [{ id: "standing", o: {} }, { id: "walking", o: {}, walk: true }, { id: "grab", o: { state: "grab" } }, { id: "flinch", o: { flinch: true } }]
    },
    {
      id: "hood-small", name: "Small hood", role: "kidnapping crew: puffer jacket, mustard beanie, filming on his phone", shell: "open", units: Art.RULES.scale["hood-small"], portraits: "hood-small",
      world: (ctx, x, y, o) => Art.hood(ctx, "hood-small", x, y, o),
      states: [{ id: "standing (filming)", o: {} }, { id: "walking", o: {}, walk: true }, { id: "phone off", o: { phoneOff: true } }, { id: "flinch", o: { flinch: true } }]
    },
    {
      id: "hood-cap", name: "Cap hood", role: "kidnapping crew: track jacket, backwards cap, the pillowcase; the quiet one who leaves the Boss's card", shell: "open", units: Art.RULES.scale["hood-cap"], portraits: "hood-cap",
      world: (ctx, x, y, o) => Art.hood(ctx, "hood-cap", x, y, o),
      states: [{ id: "standing (pillowcase on shoulder)", o: {} }, { id: "walking", o: {}, walk: true }, { id: "grab (pillowcase out)", o: { state: "grab" } }, { id: "flinch", o: { flinch: true } }]
    },
    {
      id: "keeper", name: "YOU (Keeper)", role: "the person who said “Be good.”: never a face, the camel coat and the blue umbrella", shell: "open", units: Art.RULES.scale.keeper, portraits: "you", world: Art.keeper,
      states: [{ id: "standing", o: {} }, { id: "walking", o: {}, walk: true }]
    },
    {
      id: "you-seated", name: "YOU in the car", role: "the opening: YOU seen from above in the driver's seat", shell: "open", units: 40, world: Art.youSeated, topDown: true, facing: false,
      states: [["idle"], ["reach", "“Hi. Yes. Hi.”"], ["keys"], ["turn", "to him: “Off the dash, please.”"], ["look", "at the glass: “It's just rain.”"], ["look-back", "“Be good.”"], ["reach-up", "the dome light"]].map(([state, note]) => ({ id: note ? `${state} (${note})` : state, o: { state } }))
    },
    {
      id: "van-crew", name: "Van crew (seated)", role: "the four in the van, where they sit: the driver at the wheel, the tall one twisted round in the passenger seat, the small one on a milk crate, the capped one on the wheel arch", shell: "open", units: 64, portraits: "driver", group: true,
      facing: false, // each seat fixes a facing; the game never mirrors them
      // Painted as dungeon-view.js crewOptions() does: Rizo is on the floor in
      // front of them; whoever talks looks at the one before; the driver
      // watches the road; frozen, they look at the phone; staring, at him.
      world(ctx, x, y, o) {
        const rizo = { x, y: y + 34 }, phone = { x: x + 18, y: y - 32 };
        const crew = [["driver", x - 60], ["hood-tall", x - 22], ["hood-small", x + 18], ["hood-cap", x + 58]];
        for (const [who, cx] of crew) {
          const talking = o.talker === who;
          const look = o.state === "stare" ? rizo : o.phone === "call" ? phone : talking ? { x: x - 22, y: y - 50 } : who === "driver" ? { x: cx - 200, y: y - 60 } : o.talker ? { x: x + 18, y: y - 46 } : rizo;
          Art.seated(ctx, "van-seat", cx, y, { who, t: o.t, state: o.state, look, talking, quiet: talking && o.quiet, point: who === "hood-cap" && (o.state === "stare" || o.point), phone: who === "hood-small" ? o.phone || null : null });
        }
      },
      states: [
        { id: "idle (watching him)", o: {} }, { id: "talking (the small one)", o: { talker: "hood-small" } }, { id: "talking (the driver)", o: { talker: "driver" } },
        { id: "quiet (“What's he even want it for?”)", o: { talker: "hood-small", quiet: true } }, { id: "filming (“Say hi.”)", o: { phone: "film" } },
        { id: "freeze (the phone rings)", o: { state: "freeze", phone: "call" } }, { id: "stare (“It's listening.”)", o: { state: "stare" } }
      ]
    },
    {
      // v0.4: The Boss's collectors. Grey coverall, hood and goggles, a glass jar
      // on his back, a cold lamp on a pole. No face. They are never fought.
      id: "collector", name: "Collector", role: "the Boss's hunter below: walks a patrol with a cold lamp; seen for a second, Rizo is caught", shell: "locked", units: Art.RULES.scale.collector, enemy: true,
      world: (ctx, x, y, o) => Art.collector(ctx, x, y, o),
      states: [{ id: "patrol", o: {} }, { id: "walking", o: { bob: 2 }, walk: true }, { id: "spot (lamp up)", o: { state: "spot" } }, { id: "search (lamp swinging)", o: { state: "search", t: 600 } }]
    },
    {
      // The Boss is never drawn in the world before the finale. Here: his
      // calling card and his mark, at world scale; his portrait is his caller ID.
      id: "boss", name: "The Boss (mark and card)", role: "never seen: a voice on the phone, hands and a tie in a comic, a silhouette behind glass. His mark turns up wherever a Rizo goes missing", shell: "open", units: 30, portraits: "boss", facing: false,
      world: (ctx, x, y, o) => (o.state === "mark" ? Art.mark(ctx, x, y - 14, 26) : Art.callingCard(ctx, x, y - 8, { angle: 0 })),
      states: [{ id: "calling card", o: {} }, { id: "the mark", o: { state: "mark" } }]
    },
    {
      id: "draftling", name: "Draftling", role: "enemy: a torn paper dart; its nose is the attack", shell: "locked", units: Art.RULES.scale.draftling, enemy: true,
      world: (ctx, x, y, o) => Art.draftling(ctx, x, y - 12, { ...o, r: 8, angle: (o.face || 1) < 0 ? Math.PI : 0 }),
      states: [{ id: "idle", o: {} }, { id: "windup", o: { state: "windup", k: 1 } }, { id: "lunge", o: { state: "lunge" } }, { id: "recover (open)", o: { state: "recover" } }, { id: "hit (flash)", o: { flash: true } }]
    },
    {
      id: "needle", name: "Needle", role: "enemy: a needle in a sagging pincushion; its thread is the telegraph", shell: "locked", units: Art.RULES.scale.needle, enemy: true,
      world: (ctx, x, y, o) => Art.needle(ctx, x, y - 5, { ...o, aimX: (o.face || 1) * 0.3, aimY: 1 }),
      states: [{ id: "idle", o: {} }, { id: "indicate", o: { state: "indicate" } }, { id: "pulse", o: { state: "pulse" } }, { id: "recover", o: { state: "recover" } }, { id: "hit (flash)", o: { flash: true } }]
    }
  ];
  const BY_ID = Object.fromEntries(CAST.map(entry => [entry.id, entry]));
  const LINEUP = ["rizo", "latch", "nell", "orr", "porter", "hood-tall", "hood-small", "hood-cap", "keeper"];
  const SPEAKER_NAME = key => Content.SPEAKERS?.[key]?.name || key.toUpperCase();

  // ===== BACKDROPS: the game's own materials and light pass =====
  // Light values are the game's: BELOW ambient (dungeon-scenery belowLights),
  // the lit Hearth, the street at night; his flame at 5 lights a pool of
  // 46 + 5×8 = 86 units below and 70 outside (dungeon-view.js).
  const RIZO_POOL = { below: { r: 86, strength: 1, warm: 0.6 }, outside: { r: 70, strength: 0.75, warm: 0.3 } };
  const BACKDROPS = {
    neutral: { label: "Neutral", paint(ctx, W, H) { Art.rect(ctx, "#6f6a62", 0, 0, W, H); Art.rect(ctx, "#5f5a53", 0, H * 0.62, W, H * 0.38); Art.rect(ctx, "#4f4a44", 0, H * 0.62, W, 0.8); } },
    below: {
      label: "Dark BELOW", ambient: { color: [10, 7, 5], alpha: 0.43 }, pool: RIZO_POOL.below,
      paint(ctx, W, H) { Art.wallFace(ctx, 0, 0, W, H * 0.44, 7, { brick: true }); Art.tiles(ctx, 0, H * 0.44, W, H * 0.56, 3); Art.rect(ctx, P.ink, 0, H * 0.44, W, 1.2); }
    },
    hearth: {
      label: "Warm Hearth / Rows", ambient: { color: [14, 7, 4], alpha: 0.4 }, pool: RIZO_POOL.below, warmRoom: true,
      paint(ctx, W, H) { Art.wallFace(ctx, 0, 0, W, H * 0.44, 11, { upper: P.plaster, lower: P.wood }); Art.planks(ctx, 0, H * 0.44, W, H * 0.56, 5); Art.rect(ctx, P.ink, 0, H * 0.44, W, 1.2); }
    },
    outside: {
      label: "Night street (opening)", ambient: { color: [8, 11, 20], alpha: 0.6 }, pool: RIZO_POOL.outside,
      paint(ctx, W, H) { Art.concrete(ctx, 0, 0, W, H * 0.44, 9, { wet: true }); Art.asphalt(ctx, 0, H * 0.44, W, H * 0.56, 4); Art.rect(ctx, P.ink, 0, H * 0.44, W, 1.2); }
    }
  };

  // ===== STATE (in the URL hash, so every view is a link and a screenshot) =====
  const DEFAULTS = { v: "inspect", c: "latch", s: "", e: "", f: "1", p: "390", z: "1", b: "below", m: "color", w: "both", a: "1", t: "1200", rs: "kid", lit: "rizo" };
  const params = new URLSearchParams(location.hash.slice(1));
  const S = Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, params.get(key) ?? value]));
  const save = () => { const next = new URLSearchParams(S).toString(); if (location.hash.slice(1) !== next) history.replaceState(null, "", `#${next}`); };
  const animating = () => S.a === "1";

  // ===== RIZO (through the hub bridge) =====
  let hub = null, hubError = "";
  const hubReady = (window.RizoLabHub ? window.RizoLabHub.boot() : Promise.reject(new Error("hub-bridge.js missing")))
    .then(value => { hub = value; return value; })
    .catch(error => { hubError = String(error?.message || error); return null; });
  function rizoFrame() {
    const frame = document.createElement("iframe");
    frame.className = "lab-rizo";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "Rizo";
    return frame;
  }
  function rizoDoc(markup, classes, size, origin, still) {
    const links = hub.styles.map(href => `<link rel="stylesheet" href="${href}">`).join("");
    const wear = classes.includes("wear-wrap") ? '<i class="dungeon-wear dungeon-wear-wrap" data-wear="wrap" aria-hidden="true"><b class="dungeon-wear-strap"></b><b class="dungeon-wear-clasp"></b></i>' : "";
    const poseClasses = classes.filter(name => name !== "wear-wrap").join(" ");
    const freeze = still ? "*,*::before,*::after{animation-play-state:paused!important;animation-delay:-.18s!important;transition:none!important}" : "";
    return `<!doctype html><html><head><base href="${window.RizoLabHub.REPO.href}">${links}<meta name="color-scheme" content="dark"><style>:root{color-scheme:dark!important}html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important;width:100%!important;height:100%!important;min-height:0!important;position:static!important}${freeze}</style></head><body><div class="dungeon-actor" style="position:absolute;left:${origin.x.toFixed(1)}px;top:${origin.y.toFixed(1)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;transform:none"><div class="dungeon-pose ${poseClasses}">${markup}${wear}</div></div><script>document.querySelector('.mini-pet')?.classList.add('dungeon-rizo')<\/script></body></html>`;
  }

  // ===== THE STAGE: one canvas at a phone's real scale, plus Rizo overlays =====
  const stages = new Set();
  function stage(host, { cssW, cssH, k, bg, mode, items, label = "", lit = S.lit }) {
    const wrap = document.createElement("div");
    wrap.className = `lab-stage lab-mode-${mode}`;
    wrap.style.width = `${cssW}px`; wrap.style.height = `${cssH}px`;
    const canvas = document.createElement("canvas");
    const dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    wrap.appendChild(canvas);
    if (label) { const tag = document.createElement("span"); tag.className = "lab-stage-label"; tag.textContent = label; wrap.appendChild(tag); }
    host.appendChild(wrap);
    const ctx = canvas.getContext("2d");
    const lighting = Art.createLighting(document);
    const W = cssW / k, H = cssH / k;
    const back = BACKDROPS[bg] || BACKDROPS.below;
    const layer = document.createElement("canvas"); layer.width = canvas.width; layer.height = canvas.height;
    const lctx = layer.getContext("2d");
    const rizos = [];
    for (const item of items) {
      if (!BY_ID[item.c]?.rizo) continue;
      const frame = rizoFrame();
      wrap.appendChild(frame);
      rizos.push({ item, frame, key: "" });
    }
    function paintCast(target, t, silhouette) {
      const sorted = [...items].sort((a, b) => a.y - b.y);
      for (const item of sorted) {
        const entry = BY_ID[item.c];
        if (!entry) continue;
        if (entry.rizo) {
          // His contact shadow is painted by the view, under the DOM actor.
          Art.drop(target, item.x - 1.5, item.y, 9, 3, 0.45);
          target.save(); target.globalAlpha = 0.35; Art.oval(target, item.x, item.y + 1.2, 5, 1.6, P.ink); target.restore();
          continue;
        }
        const state = entry.states.find(s => s.id === item.s) || entry.states[0];
        const o = { ...state.o, face: item.f, t, bob: state.walk ? walkBob(t) : 0 };
        if (entry.exprs) o.expr = item.e || state.expr || entry.exprs[0];
        try { entry.world(target, item.x, item.y, o); } catch (error) { target.fillStyle = "#f0f"; target.fillRect(item.x - 4, item.y - 20, 8, 20); }
      }
      if (silhouette) { target.globalCompositeOperation = "source-in"; target.fillStyle = "#111"; target.fillRect(0, 0, W, H); target.globalCompositeOperation = "source-over"; }
    }
    function draw(time) {
      const t = animating() ? time : Number(S.t) || 0;
      const s = k * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      if (mode === "silhouette") {
        Art.rect(ctx, "#d9d2c4", 0, 0, W, H);
        lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, layer.width, layer.height); lctx.setTransform(s, 0, 0, s, 0, 0);
        paintCast(lctx, t, true);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0);
      } else {
        back.paint(ctx, W, H);
        paintCast(ctx, t, false);
        if (back.ambient) {
          // As in play: his flame is beside whoever he meets. In a warm room the room's own pool too.
          const lights = [];
          if (lit === "rizo") for (const item of items) lights.push({ x: item.x, y: item.y - 6, ...back.pool });
          if (back.warmRoom) lights.push({ x: W / 2, y: H * 0.7, r: 150, strength: 1.2, warm: 1, flat: 0.62 });
          lighting.apply(ctx, { x: 0, y: 0, w: W, h: H }, back.ambient, lights);
        }
      }
      for (const slot of rizos) placeRizo(slot);
    }
    function placeRizo(slot) {
      const { item, frame } = slot;
      if (!hub) {
        frame.style.display = "none";
        if (!slot.fallback) { slot.fallback = document.createElement("span"); slot.fallback.className = "lab-rizo-missing"; slot.fallback.textContent = hubError ? "Rizo: bridge failed" : "Rizo: loading…"; wrap.appendChild(slot.fallback); }
        slot.fallback.style.left = `${item.x * k - 30}px`; slot.fallback.style.top = `${item.y * k - 30}px`;
        return;
      }
      if (slot.fallback) { slot.fallback.remove(); slot.fallback = null; }
      const stageName = item.rs || S.rs;
      const size = RIZO_ACTOR_UNITS * (RIZO_STAGE_SCALE[stageName] || 1) * k;
      // dungeon-view.js: the actor's box is centred on him and 84% of it sits above his feet.
      const fx = item.x * k, fy = (item.y - 0.8) * k;
      const pad = { w: size * 2.6, h: size * 2.4 };
      frame.style.display = "block";
      frame.style.left = `${(fx - pad.w / 2).toFixed(1)}px`; frame.style.top = `${(fy - size * 0.84 - size * 0.9).toFixed(1)}px`;
      frame.style.width = `${pad.w.toFixed(1)}px`; frame.style.height = `${pad.h.toFixed(1)}px`;
      const entry = BY_ID.rizo, state = entry.states.find(s => s.id === item.s) || entry.states[0];
      const classes = [item.f < 0 ? "facing-left" : "facing-right", state.cls.startsWith("pose-") ? "is-still" : "", state.cls].filter(Boolean);
      const key = `${stageName}:${classes.join(" ")}:${size.toFixed(2)}:${S.a}`;
      if (slot.key === key) return;
      slot.key = key;
      frame.srcdoc = rizoDoc(hub.markup({ stage: stageName }), classes, size, { x: pad.w / 2 - size / 2, y: size * 0.9 }, !animating());
    }
    const handle = { draw, wrap, k, W, H };
    stages.add(handle);
    draw(performance.now());
    return handle;
  }

  // ===== MEASUREMENT: the painted bounds and the palette each figure spends =====
  const PALETTE = [];
  for (const [family, values] of Object.entries(P)) {
    if (Array.isArray(values)) {
      values.forEach((value, index) => { if (value.startsWith("#")) PALETTE.push([`${family}[${index}]`, value]); });
    } else if (values && typeof values === "object") {
      for (const [name, value] of Object.entries(values)) if (typeof value === "string" && value.startsWith("#")) PALETTE.push([name, value]);
    } else if (typeof values === "string" && values.startsWith("#")) {
      PALETTE.push([family, values]);
    }
  }
  const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const PALETTE_RGB = PALETTE.map(([name, hex]) => [name, hex, rgb(hex)]);
  const measures = new Map();
  const FIXED_T = 1200; // the default still frame (#t=1200): talking, sway and nods sit mid-motion
  function measure(id, stateId, face = 1, expr = "") {
    const key = `${id}|${stateId}|${face}|${expr}`;
    if (measures.has(key)) return measures.get(key);
    const entry = BY_ID[id];
    if (!entry || entry.rizo) return null;
    const K = 4, size = 200, canvas = document.createElement("canvas");
    canvas.width = size * K; canvas.height = size * K;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(K, 0, 0, K, 0, 0);
    const state = entry.states.find(s => s.id === stateId) || entry.states[0];
    const o = { ...state.o, face, t: FIXED_T, bob: 0 };
    if (entry.exprs) o.expr = expr || state.expr || entry.exprs[0];
    entry.world(ctx, 100, 150, o);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    const counts = new Map();
    let total = 0, sig = 2166136261;
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4, a = data[i + 3];
      if (a) sig = Math.imul(sig ^ (i + data[i] * 7 + data[i + 1] * 13 + data[i + 2] * 17 + a), 16777619) >>> 0;
      if (a < 200) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if ((x + y) % 2) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let best = null, bestD = Infinity;
      for (const [name, hex, [pr, pg, pb]] of PALETTE_RGB) { const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (d < bestD) { bestD = d; best = [name, hex]; } }
      if (best[0] === "ink" || best[0] === "inkSoft") continue;
      total += 1;
      counts.set(best[0], { hex: best[1], n: (counts.get(best[0])?.n || 0) + 1 });
    }
    const swatches = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([name, { hex, n }]) => ({ name, hex, pct: Math.round((n / Math.max(1, total)) * 100) }));
    // sig: a hash of every painted pixel, so a test can tell two states apart.
    const result = maxX < 0 ? null : { w: (maxX - minX + 1) / K, h: (maxY - minY + 1) / K, top: 150 - minY / K, swatches, sig };
    measures.set(key, result);
    return result;
  }

  // ===== PORTRAITS =====
  function portrait(key, expr, px) {
    const set = Art.PORTRAITS[key];
    const art = set?.[expr] || (set ? Object.values(set)[0] : "");
    const node = document.createElement("div");
    node.className = "dungeon-portrait lab-portrait";
    node.style.width = `${px}px`; node.style.height = `${px}px`;
    if (key === "latch") node.style.background = "#2a241c"; // dungeon.css: the Latch speaker's frame
    node.innerHTML = typeof art === "string" ? art : art?.src ? `<img src="${art.src}" alt="">` : "";
    return node;
  }

  // ===== UI =====
  const h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) if (child != null) node.append(child.nodeType ? child : String(child));
    return node;
  };
  const select = (name, value, options, onChange) => h("label", { class: "lab-field" }, h("span", {}, name),
    h("select", { "data-control": name, onchange: event => onChange(event.target.value) }, options.map(([v, label]) => h("option", { value: v, selected: v === value }, label))));
  const VIEWS = [["inspect", "Inspect"], ["sheet", "Sheet"], ["lineup", "Cast lineup"], ["phones", "Phones"], ["portraits", "Portraits"]];
  function controls() {
    const entry = BY_ID[S.c] || CAST[0];
    const set = patch => { Object.assign(S, patch); save(); render(); };
    const bar = h("div", { class: "lab-controls" });
    bar.append(h("nav", { class: "lab-views" }, VIEWS.map(([id, label]) => h("button", { type: "button", class: S.v === id ? "is-on" : "", "data-view": id, onclick: () => set({ v: id }) }, label))));
    const row = h("div", { class: "lab-row" });
    if (["inspect", "sheet"].includes(S.v)) {
      row.append(select("Character", S.c, CAST.map(c => [c.id, c.name]), value => set({ c: value, s: "", e: "" })));
      if (S.v === "inspect") row.append(select("Pose / state", S.s || entry.states[0].id, entry.states.map(s => [s.id, s.id]), value => set({ s: value })));
      const exprs = [...new Set([...(entry.exprs || []), ...Object.keys(Art.PORTRAITS[entry.portraits] || {})])];
      if (exprs.length) row.append(select("Expression", S.e || exprs[0], exprs.map(x => [x, x]), value => set({ e: value })));
      if (entry.facing !== false) row.append(select("Facing", S.f, [["1", "right"], ["-1", "left"]], value => set({ f: value })));
      if (S.v === "inspect") row.append(select("View", S.w, [["world", "world sprite"], ["portrait", "portrait"], ["both", "both, side by side"]], value => set({ w: value })));
    }
    if (S.v !== "portraits") {
      row.append(select("Phone", S.p, Object.entries(PHONES).map(([id, phone]) => [id, phone.label]), value => set({ p: value })));
      row.append(select("Scale", S.z, [["1", "gameplay (actual size)"], ["2", "inspect ×2"], ["4", "inspect ×4"]], value => set({ z: value })));
      if (S.v !== "lineup") row.append(select("Background", S.b, Object.entries(BACKDROPS).map(([id, b]) => [id, b.label]), value => set({ b: value })));
      row.append(select("Render", S.m, [["color", "colour"], ["values", "values (greyscale)"], ["silhouette", "silhouette"]], value => set({ m: value })));
      row.append(select("Light", S.lit, [["rizo", "his flame beside them (in play)"], ["ambient", "room dark only"]], value => set({ lit: value })));
      row.append(select("Rizo stage", S.rs, Object.keys(RIZO_STAGE_SCALE).map(id => [id, id]), value => set({ rs: value })));
    }
    if (S.v === "portraits") row.append(select("Render", S.m === "values" ? "values" : "color", [["color", "colour"], ["values", "values (greyscale)"]], value => set({ m: value })));
    row.append(select("Motion", S.a, [["1", "animated"], ["0", "still (t fixed)"]], value => set({ a: value })));
    bar.append(row);
    return bar;
  }
  const shellOf = entry => (entry.shell === "open" ? "open" : "locked");
  function heightNote(entry, k) {
    const m = measure(entry.id, entry.states[0].id);
    if (entry.rizo) return `${(RIZO_ACTOR_UNITS * RIZO_STAGE_SCALE[S.rs]).toFixed(1)}u actor box · ${(RIZO_ACTOR_UNITS * RIZO_STAGE_SCALE[S.rs] * k).toFixed(0)}px in play`;
    return m ? `${m.h.toFixed(0)}u tall · ${(m.h * k).toFixed(0)}px in play` : "";
  }

  function viewInspect(main) {
    const entry = BY_ID[S.c] || CAST[0];
    const state = entry.states.find(s => s.id === S.s) || entry.states[0];
    const shell = shellOf(entry);
    const k = scaleOf(S.p, shell) * Number(S.z);
    const m = measure(entry.id, state.id, Number(S.f));
    const worldW = Math.max(120, (m?.w || 40) + 80), worldH = Math.max(150, (m?.h || 40) * 1.35 + 40);
    const cssW = Math.round(Math.min(900, worldW * k)), cssH = Math.round(worldH * k);
    const top = h("div", { class: "lab-inspect" });
    if (S.w !== "portrait") {
      const cell = h("figure", { class: "lab-figure" });
      stage(cell, { cssW, cssH, k, bg: S.b, mode: S.m, items: [{ c: entry.id, s: state.id, e: S.e, f: Number(S.f), x: cssW / k / 2, y: (cssH / k) * 0.82 }] });
      cell.append(h("figcaption", {}, `${entry.name} · ${state.id} · ${S.z === "1" ? `actual size on ${PHONES[S.p].label} (${shell === "open" ? "outside" : "below"})` : `×${S.z} inspect`} · ${heightNote(entry, scaleOf(S.p, shell))}`));
      top.append(cell);
    }
    if (S.w !== "world") {
      const key = entry.portraits;
      const box = h("figure", { class: "lab-figure lab-portrait-set" });
      if (key) {
        const exprs = Object.keys(Art.PORTRAITS[key]);
        const expr = exprs.includes(S.e) ? S.e : exprs[0];
        box.append(h("div", { class: "lab-portrait-sizes" }, [PHONES["320"].portrait, 56, 128].map(px => h("div", {}, portrait(key, expr, px), h("small", {}, `${px}px${px === 46 ? " (smallest in play)" : px === 56 ? " (in play)" : " (inspect)"}`)))));
        box.append(h("figcaption", {}, `${SPEAKER_NAME(key === "you" ? "you" : key)} portrait · ${expr}`));
      } else box.append(h("p", { class: "lab-note" }, `${entry.name} has no dialogue portrait in the game.`));
      top.append(box);
    }
    main.append(top);
    main.append(infoPanel(entry, state));
  }
  function infoPanel(entry, state) {
    const m = measure(entry.id, state.id, Number(S.f));
    const panel = h("section", { class: "lab-info" });
    panel.append(h("h3", {}, entry.name), h("p", {}, entry.role));
    if (entry.facing === false) panel.append(h("p", { class: "lab-metrics" }, "The game never mirrors this figure; it has one facing."));
    for (const [a, b] of entry.alike || []) panel.append(h("p", { class: "lab-metrics" }, `“${a}” and “${b}” are separate states in the game but the art draws them the same.`));
    if (m) {
      panel.append(h("p", { class: "lab-metrics" }, `Painted bounds ${m.w.toFixed(1)} × ${m.h.toFixed(1)} world units (Rizo is ${RIZO_ACTOR_UNITS * RIZO_STAGE_SCALE.kid}u as a kid). On ${PHONES["320"].label}: ${(m.h * scaleOf("320", shellOf(entry))).toFixed(0)} px tall.`));
      panel.append(h("div", { class: "lab-swatches" }, m.swatches.map(sw => h("span", { class: "lab-swatch", title: sw.name }, h("i", { style: `background:${sw.hex}` }), `${sw.name} ${sw.pct}%`))));
    }
    panel.append(h("ul", { class: "lab-checklist" },
      h("li", {}, h("b", {}, "Silhouette: "), "switch Render to silhouette. Is it still them, with no detail?"),
      h("li", {}, h("b", {}, "Role: "), "do the clothes, props and posture say what they do?"),
      h("li", {}, h("b", {}, "Face: "), "open Portraits. Is it a different face, or the same face with other accessories?"),
      h("li", {}, h("b", {}, "Pose: "), "does the resting posture say who they are, at actual size on 320?")));
    return panel;
  }
  function viewSheet(main) {
    const entry = BY_ID[S.c] || CAST[0];
    const shell = shellOf(entry);
    const k = scaleOf(S.p, shell) * Number(S.z);
    const grid = h("div", { class: "lab-sheet" });
    const cells = [];
    const twin = id => (entry.alike || []).find(pair => pair[1] === id)?.[0];
    for (const state of entry.states) cells.push({ label: twin(state.id) ? `${state.id} (the art draws it the same as ${twin(state.id)})` : state.id, item: { c: entry.id, s: state.id, f: Number(S.f) } });
    for (const expr of entry.exprs || []) cells.push({ label: `expression: ${expr}`, item: { c: entry.id, s: entry.states[0].id, e: expr, f: Number(S.f) } });
    const sizes = cells.map(cell => measure(entry.id, cell.item.s, cell.item.f)).filter(Boolean);
    const maxW = Math.max(46, ...sizes.map(m => m.w)), maxH = Math.max(46, ...sizes.map(m => m.h));
    const cssW = Math.round((maxW + 30) * k), cssH = Math.round((maxH * 1.25 + 24) * k);
    for (const cell of cells) {
      const fig = h("figure", { class: "lab-figure" });
      stage(fig, { cssW, cssH, k, bg: S.b, mode: S.m, items: [{ ...cell.item, x: cssW / k / 2, y: (cssH / k) * 0.86 }] });
      fig.append(h("figcaption", {}, cell.label));
      grid.append(fig);
    }
    main.append(h("h2", {}, `${entry.name}: every state the game uses${S.z === "1" ? ` (actual size on ${PHONES[S.p].label})` : ` (×${S.z})`}`), grid);
    if (entry.portraits) {
      const row = h("div", { class: "lab-portrait-row" });
      for (const expr of Object.keys(Art.PORTRAITS[entry.portraits])) row.append(h("figure", { class: "lab-figure" }, portrait(entry.portraits, expr, 56), h("figcaption", {}, expr)));
      main.append(h("h2", {}, "Portraits (56 px, as in play)"), row);
    }
  }
  function lineupItems(k, cssH, ids = LINEUP) {
    const items = [];
    let x = 14;
    for (const id of ids) {
      const entry = BY_ID[id];
      const w = entry.rizo ? RIZO_ACTOR_UNITS * RIZO_STAGE_SCALE[S.rs] * 0.8 : (measure(id, entry.states[0].id)?.w || 30);
      items.push({ c: id, s: entry.states[0].id, f: 1, x: x + w / 2, y: (cssH / k) * 0.84, w });
      x += w + 12;
    }
    return { items, worldW: x + 2 };
  }
  function viewLineup(main) {
    const k = scaleOf(S.p, "locked") * Number(S.z);
    const probeH = Math.max(...LINEUP.map(id => (BY_ID[id].rizo ? 34 : measure(id, BY_ID[id].states[0].id)?.h || 40)));
    const cssH = Math.round((probeH * 1.3 + 16) * k);
    const { items, worldW } = lineupItems(k, cssH);
    const cssW = Math.round(worldW * k);
    main.append(h("h2", {}, `The cast at ${S.z === "1" ? `actual size on ${PHONES[S.p].label} (below: ${scaleOf(S.p, "locked").toFixed(3)} px per unit)` : `×${S.z}`}`));
    for (const [mode, bg, caption] of [["color", "below", "In play: BELOW, each lit by his flame"], ["color", "hearth", "In a warm room (Hearth / Rows)"], ["values", "neutral", "Values only: do they separate without colour?"], ["silhouette", "neutral", "Silhouettes: details removed"]]) {
      const fig = h("figure", { class: "lab-figure lab-wide" });
      stage(fig, { cssW, cssH, k, bg, mode, items });
      fig.append(h("figcaption", {}, caption));
      main.append(fig);
    }
    const names = h("div", { class: "lab-names", style: `width:${cssW}px` });
    for (const item of items) names.append(h("span", { style: `left:${(item.x * k).toFixed(0)}px` }, BY_ID[item.c].name));
    main.append(names);
    const table = h("table", { class: "lab-table" }, h("tr", {}, ["Character", "Height (u)", "Width (u)", `px on 320`, `px on ${PHONES[S.p].label}`, "Palette it spends"].map(t => h("th", {}, t))));
    for (const id of LINEUP) {
      const entry = BY_ID[id], m = entry.rizo ? null : measure(id, entry.states[0].id);
      const hU = entry.rizo ? RIZO_ACTOR_UNITS * RIZO_STAGE_SCALE[S.rs] : m?.h || 0;
      table.append(h("tr", {}, h("td", {}, entry.name), h("td", {}, hU.toFixed(0)), h("td", {}, entry.rizo ? "—" : m.w.toFixed(0)),
        h("td", {}, (hU * scaleOf("320", shellOf(entry))).toFixed(0)), h("td", {}, (hU * scaleOf(S.p, shellOf(entry))).toFixed(0)),
        h("td", {}, entry.rizo ? "the hub's sprite (player-chosen variant)" : h("span", { class: "lab-swatches" }, m.swatches.slice(0, 4).map(sw => h("span", { class: "lab-swatch", title: sw.name }, h("i", { style: `background:${sw.hex}` }), `${sw.name} ${sw.pct}%`))))));
    }
    main.append(h("h2", {}, "Proportions and palette"), table);
  }
  function viewPhones(main) {
    const L = Content.LINES;
    const wrap = h("div", { class: "lab-phones" });
    const scenes = [
      { shell: "locked", title: "BELOW", bg: S.b === "outside" ? "below" : S.b, room: "THE SHARED HEARTH", cast: ["rizo", "latch", "nell", "orr", "porter"], line: { speaker: "latch", expr: "procedural", text: L.seatOffer?.[0]?.text || "Seat's dry." } },
      { shell: "open", title: "OUTSIDE (the opening)", bg: "outside", room: "LATE STORE", cast: ["hood-tall", "hood-small", "rizo", "hood-cap", "keeper"], line: { speaker: "you", expr: "neutral", text: "Be good." } }
    ];
    for (const scene of scenes) {
      const row = h("div", { class: "lab-phone-row" });
      for (const id of Object.keys(PHONES)) {
        const phone = PHONES[id], size = phone[scene.shell], k = scaleOf(id, scene.shell);
        const screen = h("div", { class: "lab-phone-screen dungeon-screen", style: `width:${size.w}px;height:${size.h}px` });
        const worldW = size.w / k, worldH = size.h / k;
        const step = worldW / (scene.cast.length + 0.4);
        const items = scene.cast.map((c, index) => ({ c, s: BY_ID[c].states[0].id, f: index < scene.cast.length / 2 ? 1 : -1, x: step * (index + 0.7), y: worldH * 0.62 }));
        stage(screen, { cssW: size.w, cssH: size.h, k, bg: scene.bg, mode: S.m, items });
        screen.append(h("div", { class: "dungeon-hud", "aria-hidden": "true" }, h("span", { class: "dungeon-flame" }, Array.from({ length: 5 }, () => h("i", { class: "lit" }))), h("b", { class: "dungeon-room-name", style: id === "320" ? "font-size:9px;letter-spacing:.06em" : "" }, scene.room)));
        const dialog = h("div", { class: "dungeon-dialogue", "data-speaker": scene.line.speaker },
          portrait(scene.line.speaker, scene.line.expr, phone.portrait),
          h("div", { class: "dungeon-speech" }, h("b", { class: "dungeon-speaker" }, SPEAKER_NAME(scene.line.speaker)), h("p", { class: "dungeon-line", style: id === "320" ? "font-size:15px" : "" }, h("span", { class: "dungeon-line-text" }, scene.line.text))));
        screen.append(dialog);
        row.append(h("figure", { class: "lab-figure" }, screen, h("figcaption", {}, `${phone.label} · ${scene.title} · ${k.toFixed(3)} px/unit · portrait ${phone.portrait}px`)));
      }
      wrap.append(h("h2", {}, `${scene.title}: the cast at the size the phone shows them`), row);
    }
    main.append(wrap);
  }
  function viewPortraits(main) {
    const keys = Object.keys(Art.PORTRAITS);
    main.append(h("h2", {}, "Faces side by side (56 px, as in play): are they different faces, or one face with different hats?"));
    main.classList.add(`lab-mode-${S.m}`);
    const faces = h("div", { class: "lab-portrait-row" });
    for (const key of keys) faces.append(h("figure", { class: "lab-figure" }, portrait(key, Object.keys(Art.PORTRAITS[key])[0], 56), h("figcaption", {}, SPEAKER_NAME(key))));
    main.append(faces);
    for (const key of keys) {
      const block = h("section", { class: "lab-portrait-block" }, h("h3", {}, `${SPEAKER_NAME(key)} (${key})`));
      const grid = h("div", { class: "lab-portrait-grid" });
      for (const expr of Object.keys(Art.PORTRAITS[key])) {
        grid.append(h("figure", { class: "lab-figure" }, h("div", { class: "lab-portrait-sizes" }, [46, 56, 128].map(px => portrait(key, expr, px))), h("figcaption", {}, expr)));
      }
      block.append(grid);
      main.append(block);
    }
    main.append(h("p", { class: "lab-note" }, "46 px is the smallest a portrait appears in play (phones 340 px wide or less); 56 px everywhere else. The Keeper (YOU) is never given a face."));
  }

  function render() {
    for (const handle of stages) handle.wrap.remove();
    stages.clear();
    app.innerHTML = "";
    app.append(h("header", { class: "lab-header" }, h("h1", {}, "Rizo Dungeon · Character Lab"), h("p", {}, "Development only. Real art functions, real gameplay scale, real hub Rizo. Nothing here is saved.")));
    app.append(controls());
    const main = h("main", { class: "lab-main", "data-view": S.v });
    app.append(main);
    ({ inspect: viewInspect, sheet: viewSheet, lineup: viewLineup, phones: viewPhones, portraits: viewPortraits }[S.v] || viewInspect)(main);
    document.documentElement.dataset.labReady = hub || hubError ? "1" : "0";
  }

  let last = 0;
  function loop(time) {
    requestAnimationFrame(loop);
    if (!animating() || time - last < 33) return;
    last = time;
    for (const handle of stages) handle.draw(time);
  }
  window.addEventListener("hashchange", () => {
    const next = new URLSearchParams(location.hash.slice(1));
    for (const key of Object.keys(DEFAULTS)) S[key] = next.get(key) ?? DEFAULTS[key];
    render();
  });
  render();
  hubReady.then(() => { for (const handle of stages) handle.draw(performance.now()); document.documentElement.dataset.labReady = "1"; document.documentElement.dataset.labRizo = hub ? "ok" : `failed: ${hubError}`; });
  requestAnimationFrame(loop);
  // For the lab's own test and capture script: the manifest, as data.
  window.RizoDungeonLab = Object.freeze({ CAST: CAST.map(c => ({ id: c.id, name: c.name, states: c.states.map(s => s.id), exprs: c.exprs || [], portraits: c.portraits || null, shell: c.shell, facing: c.facing !== false, alike: c.alike || [] })), PHONES, LINEUP, measure, BACKDROPS: Object.keys(BACKDROPS) });
})();
