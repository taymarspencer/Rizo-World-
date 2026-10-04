/*
  RIZO DUNGEON — SCENERY
  ======================
  Each place's authored art, built only from RizoDungeonArt's palette,
  materials and rules. Collision geometry (dungeon-content.js) is the bones;
  this file is everything around them. Nothing here changes a hitbox, and
  nothing walkable is drawn as if it were solid.

    paintStatic(c, geo, margin)   once per room/layout, into a cached layer
    paintUnder(ctx, geo, s)       per frame, beneath that layer (moving road)
    paintDynamic(ctx, geo, s)     per frame, above it (signs, doors, fire, props)
    lights(geo, s)                { ambient, list } for the light pass
  s = { sim, time, extras, view: {x,y,w,h}, pos, reduced }

  One idea per place, the thing that should survive memory:
    curb     a bright late store, a dry strip under the awning, OPEN in a puddle
    van      somebody's dirty van: cans, a cup, a swapped door, the road below
    roadside a tiny flame beside an endless road; far-off lit windows
    drain    shelter that slowly stops being a city pipe
    slip     the bottom of a shaft; home is a lit door very far up
    clatter  a lost-luggage line that half wakes when he passes
    hem      somebody sweeps here, and has been counting days
    hearth   a warm room kept for two: rug, bench, kettle, a drawing of home
    queue    a waiting room whose people left; the sign still counts
    porter   the last door, the Porter's worn runner, keys, left luggage
*/
(function initRizoDungeonScenery(root, factory) {
  const api = factory(root?.RizoDungeonArt || null, root?.RizoDungeonCore || null);
  if (root) Object.defineProperty(root, "RizoDungeonScenery", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonScenery(A, Core) {
  "use strict";
  if (!A || !Core) return null;
  const { P, rect, box, oval, line, shape, drop, tape, stitches, rivet, worn, label, rng } = A;
  const TAU = Math.PI * 2;
  const present = (item, flags) => Core.present(item, flags);
  const alpha = (c, a, fn) => { const prev = c.globalAlpha; c.globalAlpha = prev * a; fn(); c.globalAlpha = prev; };

  // ===================== OUTSIDE =====================
  function storeWindow(c, x, y, w, h, seed, o = {}) {
    const random = rng(`window${seed}`);
    rect(c, P.fluoro[1], x, y, w, h);
    rect(c, P.fluoro[2], x, y, w, 7);
    rect(c, P.fluoro[0], x, y + h - 9, w, 9);
    for (let tx = x + 8; tx < x + w - 10; tx += 26) rect(c, "#ffffff", tx, y + 2, 16, 2);
    const colors = [P.a.maroon, P.a.mustard, P.a.umbrella, P.a.track, P.paper[2], P.a.red, P.paper[1]];
    for (const shelfY of [y + 22, y + 38, y + 54]) {
      rect(c, P.metal[1], x + 3, shelfY, w - 6, 1.6);
      let px = x + 4;
      while (px < x + w - 8) {
        const pw = 3 + random() * 4, ph = 4 + random() * 6;
        if (random() > 0.12) rect(c, colors[Math.floor(random() * colors.length)], px, shelfY - ph, pw, ph);
        px += pw + 0.8 + random() * 1.4;
      }
    }
    if (o.counter) {
      box(c, x + w - 46, y + h - 22, 40, 22, P.metal[1], { ink: 1, amp: 0.3 });
      box(c, x + w - 30, y + h - 30, 12, 8, P.ink, { ink: 0.8, amp: 0.2 });
      rect(c, P.service[3], x + w - 28, y + h - 28, 8, 3);
      box(c, x + w - 16, y + h - 34, 9, 12, P.a.red, { ink: 0.8, amp: 0.2 });
    }
    if (o.poster) {
      c.save(); c.translate(x + o.poster[0], y + o.poster[1]); c.rotate(-0.06);
      box(c, 0, 0, 24, 28, P.paper[3], { ink: 0.8, amp: 0.4 });
      label(c, "HELP", 12, 9, { size: 6.5, color: P.ink }); label(c, "WANTED", 12, 16, { size: 5, color: P.ink });
      line(c, 4, 21, 20, 21, P.paper[0], 0.6); line(c, 4, 24, 16, 24, P.paper[0], 0.6);
      tape(c, 1, 1, 6, -0.7, 1); tape(c, 23, 1, 6, 0.7, 2);
      c.restore();
    }
    rect(c, P.metal[2], x + w / 2 - 1, y, 2, h);
    alpha(c, 0.16, () => { shape(c, [x + 10, y, x + 26, y, x + 6, y + h, x - 10 + 10, y + h], P.paper[3], { ink: false }); shape(c, [x + w - 40, y, x + w - 32, y, x + w - 50, y + h, x + w - 56, y + h], P.paper[3], { ink: false }); });
    box(c, x, y, w, h, null, { ink: 2.2, amp: 0.3 });
  }
  function curbStatic(c, geo, m) {
    const W = geo.w, L = -m.mx, R = W + m.mx, T = -m.my, B = geo.h + m.my;
    // Far: the flat above the shop, the far side of the street. No ink out there.
    rect(c, P.night[0], L, T, R - L, B - T);
    rect(c, P.night[1], L, T, R - L, -T);
    alpha(c, 0.4, () => { for (let y = -6; y > T; y -= 6) rect(c, P.night[0], L, y, R - L, 1); });
    // Upstairs: one window lit, curtain half drawn, a plant on the sill; one dark.
    rect(c, P.night[0], 58, -66, 44, 32);
    rect(c, P.sodium[1], 246, -66, 44, 32); rect(c, P.sodium[2], 246, -66, 44, 10);
    rect(c, P.a.maroon, 246, -66, 16, 32); rect(c, P.a.maroonLight, 246, -66, 3, 32);
    oval(c, 276, -38, 6, 4, P.grass[2]); rect(c, P.wood[2], 272, -38, 8, 5);
    rect(c, P.night[2], 244, -34, 48, 3);
    box(c, 254, -26, 24, 12, P.metal[1], { ink: 0.8, amp: 0.3 });
    for (let gx = 257; gx < 276; gx += 3) rect(c, P.metal[0], gx, -24, 1, 8);
    // A drainpipe split and taped.
    rect(c, P.metal[1], 8, T, 5, 96 - T); rect(c, P.metal[2], 8, T, 1.4, 96 - T); tape(c, 10.5, 34, 9, 1.45, 3); tape(c, 10.5, 38, 8, 1.6, 4);
    // Fascia sign: FOOD · ICE · LOTTO, one letter dead.
    box(c, 20, 1, 320, 19, P.night[2], { ink: 1.2, amp: 0.3 });
    label(c, "FOOD · ICE · LOTTO", 180, 15, { size: 10, color: P.fluoro[2], shadow: P.ink, spacing: 1.2 });
    alpha(c, 0.75, () => rect(c, P.night[2], 236, 5, 7, 12));
    // Piers, windows, the door frame, kick plates.
    for (const [x, w] of [[0, 30], [142, 12], [198, 16], [330, 30]]) { rect(c, P.concrete[1], x, 20, w, 76); rect(c, P.concrete[2], x, 20, w, 2); rect(c, P.concrete[0], x + w - 1.5, 20, 1.5, 76); }
    storeWindow(c, 30, 22, 112, 66, 1, { poster: [82, 18] });
    storeWindow(c, 214, 22, 116, 66, 2, { counter: true });
    box(c, 154, 26, 44, 70, P.metal[2], { ink: 1.4, amp: 0.3 });
    rect(c, P.metal[1], 30, 88, 112, 8); rect(c, P.metal[1], 214, 88, 116, 8);
    rect(c, P.ink, 30, 88, 112, 1); rect(c, P.ink, 214, 88, 116, 1);
    // Sidewalk: wet slabs, a dry strip under the awning where he was told to wait.
    A.concrete(c, 0, 96, W, 140, "curb", { wet: true, joint: 40 });
    alpha(c, 0.45, () => rect(c, P.concrete[2], 116, 96, 124, 30));
    alpha(c, 0.12, () => { for (const [x, w] of [[30, 112], [214, 116]]) { shape(c, [x, 96, x + w, 96, x + w + 14, 170, x - 14, 170], P.fluoro[1], { ink: false }); shape(c, [x + 8, 96, x + w - 8, 96, x + w, 132, x, 132], P.fluoro[2], { ink: false }); } });
    worn(c, 176, 110, 18, 6, P.concrete[3], 0.45);
    const random = rng("gum");
    for (let index = 0; index < 22; index += 1) oval(c, 10 + random() * 340, 130 + random() * 100, 1.2, 0.8, P.concrete[0]);
    // The awning: striped canvas, sagging, a taped tear.
    for (let x = 112, index = 0; x < 244; x += 11, index += 1) shape(c, [x, 90, x + 11, 90, x + 11, 101 + (index % 2), x + 5.5, 103, x, 101], index % 2 ? P.a.red : P.paper[2], { ink: false, seed: x, amp: 0.3 });
    rect(c, P.ink, 112, 89, 132, 1.4);
    line(c, 112, 101, 244, 101, P.ink, 1, 77, 0.6);
    tape(c, 186, 95, 8, 0.4, 5);
    // The puddle (its reflection is drawn live).
    oval(c, 112, 183, 23, 8.5, P.wet[0]); oval(c, 108, 181.5, 15, 4.5, P.wet[1]); line(c, 92, 186, 130, 187, P.wet[2], 0.8, 8, 0.6);
    // Bin and the ice chest.
    drop(c, 38, 132, 12, 3.5);
    box(c, 28, 112, 20, 20, P.metal[1], { ink: 1.2, amp: 0.4 });
    for (let x = 31; x < 47; x += 3) rect(c, P.metal[0], x, 114, 1, 17);
    shape(c, [26, 112, 50, 112, 49, 108, 38, 104, 28, 108], P.cloth[0], { ink: 1, amp: 0.6 });
    box(c, 41, 102, 5, 6, P.paper[3], { ink: 0.7, amp: 0.2 });
    drop(c, 313, 131, 19, 4);
    box(c, 296, 106, 34, 25, P.paper[2], { ink: 1.4, amp: 0.4 });
    rect(c, P.paper[3], 297, 107, 32, 3);
    box(c, 299, 112, 28, 8, P.a.umbrella, { ink: 0.8, amp: 0.2 });
    label(c, "ICE", 313, 119, { size: 7, color: P.paper[3] });
    alpha(c, 0.8, () => { for (let x = 298; x < 328; x += 4) rect(c, "#eef4f8", x, 105.5, 2.4, 1.2); });
    box(c, 318, 122, 7, 5, P.a.mustard, { ink: 0.6, amp: 0.2 });
    // Curb: chipped yellow paint; the storm drain he'll come to know.
    rect(c, P.concrete[3], 0, 231, W, 5); rect(c, P.concrete[1], 0, 236, W, 2);
    for (let x = 4; x < W; x += 22) if ((x / 22) % 3 !== 1) rect(c, P.a.mustard, x, 231.5, 15, 2.2);
    rect(c, P.ink, 62, 232, 34, 6); for (let x = 64; x < 95; x += 4) rect(c, P.metal[1], x, 233, 1.4, 5);
    // Street.
    A.asphalt(c, L, 238, R - L, B - 238, "street");
    for (let x = L + 4; x < R; x += 44) box(c, x, 277, 24, 2.6, P.a.mustard, { ink: false, amp: 0.3 });
    alpha(c, 0.16, () => { const smear = rng("smear"); for (const [x0, x1] of [[34, 140], [218, 328]]) for (let x = x0 + 6; x < x1; x += 14 + smear() * 12) box(c, x, 242 + smear() * 6, 2 + smear() * 3, 20 + smear() * 34, P.fluoro[2], { ink: false, amp: 0.8 }); });
    oval(c, 312, 262, 11, 4.5, P.asphalt[0], true, 1); for (let gx = 304; gx < 320; gx += 4) rect(c, P.asphalt[2], gx, 260, 1.2, 4);
    // The far side: a shuttered laundromat, unlit.
    rect(c, P.concrete[1], L, 330, R - L, 4);
    rect(c, P.night[1], L, 334, R - L, B - 334);
    rect(c, P.night[2], 150, 344, 150, 40);
    alpha(c, 0.5, () => { for (let y = 346; y < 384; y += 3) rect(c, P.night[0], 150, y, 150, 1); });
    label(c, "WASH & FOLD", 225, 342, { size: 7, color: P.night[3] });
  }
  function curbDynamic(ctx, geo, s) {
    const room = s.extras.room || {}, t = s.time;
    const flicker = s.reduced ? 1 : (Math.sin(t / 170) > -0.9 ? 1 : 0.3) * (Math.sin(t / 2300) > -0.97 ? 1 : 0.4);
    // The door: glass with a push bar; open, the inside spills out.
    if (room.doorOpen) { rect(ctx, P.fluoro[2], 156, 28, 40, 66); rect(ctx, P.fluoro[1], 156, 80, 40, 14); box(ctx, 156, 28, 8, 66, P.metal[2], { ink: 1, amp: 0.2 }); }
    else { rect(ctx, P.fluoro[1], 156, 28, 40, 66); rect(ctx, P.fluoro[0], 156, 76, 40, 18); rect(ctx, P.metal[3], 160, 60, 32, 2.6); rect(ctx, P.ink, 160, 62.6, 32, 0.8); label(ctx, "PULL", 176, 54, { size: 5, color: P.a.red }); }
    // Bell over the door.
    oval(ctx, 176, 24, 2.2, 2, P.a.brass, true, 0.8);
    // OPEN, in red neon tubes in the left window, and in the puddle.
    ctx.save();
    ctx.globalAlpha = 0.35 * flicker; ctx.lineJoin = "round";
    ctx.font = "900 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.strokeStyle = P.a.neon; ctx.lineWidth = 3; ctx.strokeText("OPEN", 72, 48);
    ctx.globalAlpha = flicker; ctx.fillStyle = "#ffd0d6"; ctx.fillText("OPEN", 72, 48);
    ctx.globalAlpha = 0.85; rect(ctx, P.ink, 52, 51, 40, 1.2);
    // Reflection, upside down and broken by ripples.
    ctx.globalAlpha = 0.5 * flicker; ctx.fillStyle = P.a.neon;
    for (let index = 0; index < 5; index += 1) { const wob = s.reduced ? 0 : Math.sin(t / 260 + index) * 1.4; ctx.fillRect(98 + index * 6 + wob, 179 + (index % 2), 4, 1.2); }
    ctx.restore();
    // Awning drips.
    if (!s.reduced) for (let x = 118, index = 0; x < 242; x += 13, index += 1) {
      const k = ((t / 520) + index * 0.29) % 1;
      rect(ctx, P.wet[3], x, 103 + k * 26, 0.9, 2.4);
      if (k > 0.92) { ctx.strokeStyle = P.wet[3]; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x, 129, 3, 1.1, 0, 0, TAU); ctx.stroke(); }
    }
    // A car going by: its headlights slide over the wet road.
    if (!s.reduced) {
      const k = (t / 5200) % 1, carX = geo.w + 80 - k * (geo.w + 200);
      alpha(ctx, 0.22, () => { shape(ctx, [carX - 10, 250, carX + 60, 244, carX + 60, 290, carX - 10, 282], P.fluoro[2], { ink: false }); });
    }
    // The van's headlights, once it is here.
    const vanActor = (s.extras.npcs || []).find(actor => actor.id === "van");
    if (room.carLights && vanActor) alpha(ctx, 0.09, () => { shape(ctx, [vanActor.x - 76, vanActor.y - 32, vanActor.x - 190, vanActor.y - 70, vanActor.x - 190, vanActor.y + 20, vanActor.x - 76, vanActor.y - 22], P.fluoro[2], { ink: false }); });
  }
  function curbLights(geo, s) {
    const room = s.extras.room || {}, list = [
      { x: 86, y: 100, r: 120, strength: 0.95, flat: 0.55 },
      { x: 272, y: 100, r: 124, strength: 0.95, flat: 0.55 },
      { x: 72, y: 60, r: 40, strength: 0.6, warm: 0.4 }
    ];
    if (room.doorOpen) list.push({ x: 176, y: 100, r: 70, strength: 1 });
    if (!s.reduced) { const k = (s.time / 5200) % 1; list.push({ x: geo.w + 100 - k * (geo.w + 200), y: 266, r: 70, strength: 0.7 }); }
    const vanActor = (s.extras.npcs || []).find(actor => actor.id === "van");
    if (room.carLights && vanActor) list.push({ x: vanActor.x - 130, y: vanActor.y - 20, r: 95, strength: 0.9 });
    const small = (s.extras.npcs || []).find(actor => actor.kind === "hood-small");
    if (small) list.push({ x: small.x + 17 * (small.face || 1), y: small.y - 50, r: 30, strength: 0.8 });
    return { ambient: { color: [8, 11, 20], alpha: 0.5 }, list };
  }

  // ---- the van
  function vanStatic(c, geo) {
    // Body from above, cut away: the roof edge all round.
    box(c, -10, -16, 260, 180, P.paper[1], { ink: 2.4, amp: 0.6 });
    rect(c, P.paper[2], -6, -12, 252, 2);
    // Floor: ribbed rubber mat, wheel arches, scuffs.
    rect(c, P.cloth[1], 14, 42, 212, 96);
    for (let y = 46; y < 138; y += 5) rect(c, P.cloth[0], 14, y, 212, 1.1);
    for (const x of [40, 168]) { box(c, x, 128, 36, 10, P.cloth[2], { ink: 1, amp: 0.3 }); rect(c, P.cloth[3], x + 2, 129, 32, 1); }
    worn(c, 120, 100, 40, 14, P.cloth[2], 0.45);
    // Side wall trim, rear doors with two little windows.
    rect(c, P.cloth[2], 0, 0, 14, 150); rect(c, P.cloth[3], 12, 42, 2, 96);
    rect(c, P.cloth[2], 0, 138, 240, 12);
    for (const x of [60, 150]) { box(c, x, 140, 34, 8, P.wet[0], { ink: 1, amp: 0.2 }); rect(c, P.wet[2], x + 3, 141, 10, 1); }
    line(c, 120, 138, 120, 150, P.ink, 1.2);
    // Dashboard and the seats from behind.
    rect(c, P.ink, 10, -2, 220, 12);
    for (const [x, color] of [[60, P.service[3]], [66, P.a.red], [176, P.service[3]]]) rect(c, color, x, 3, 3, 1.6);
    for (const x of [34, 136]) {
      box(c, x, 14, 62, 28, P.cloth[2], { ink: 1.6, amp: 0.4 });
      rect(c, P.cloth[3], x + 3, 15, 56, 2);
      stitches(c, x + 6, 28, x + 56, 28, P.cloth[1], 3, 1, 0.6);
      box(c, x + 20, 4, 22, 11, P.cloth[2], { ink: 1.3, amp: 0.3 });
    }
    // Centre console: a cup with a straw, a charger cable down to the floor.
    box(c, 100, 18, 32, 24, P.cloth[0], { ink: 1.2, amp: 0.3 });
    box(c, 106, 20, 9, 10, P.a.red, { ink: 0.9, amp: 0.2 }); rect(c, P.paper[3], 106, 20, 9, 2); line(c, 111, 20, 113, 14, P.paper[3], 1);
    A.trace(c, [124, 30, 128, 46, 118, 58, 132, 70, 126, 84], 9, 0.8, false); A.inkStroke(c, 1, P.ink);
    // Junk along the walls: the pile the cooler comes off, a food bag, cans, tickets.
    oval(c, 26, 112, 10, 10, P.ink, true, 1); oval(c, 26, 112, 5, 5, P.metal[1], true, 0.8);
    box(c, 16, 60, 18, 14, P.wood[2], { ink: 1.1, amp: 0.4 }); label(c, "XL", 25, 70, { size: 6, color: P.paper[3] });
    shape(c, [16, 84, 30, 82, 32, 94, 18, 96], P.paper[1], { ink: 1, amp: 0.8 }); rect(c, P.a.mustard, 20, 87, 6, 3);
    for (const [x, y, color] of [[214, 128, P.a.track], [206, 52, P.a.mustard], [196, 132, P.metal[2]]]) { box(c, x, y, 5, 8, color, { ink: 0.8, amp: 0.2 }); rect(c, P.metal[3], x, y, 5, 1); }
    c.save(); c.translate(44, 44); c.rotate(0.2); box(c, 0, 0, 10, 7, P.paper[3], { ink: 0.7, amp: 0.2 }); box(c, 3, -2, 10, 7, P.paper[2], { ink: 0.7, amp: 0.2 }); c.restore();
    // The chips bag somebody sat on.
    shape(c, [28, 118, 44, 115, 46, 129, 27, 131], P.a.mustard, { ink: 1.1, amp: 0.8 }); rect(c, P.a.red, 31, 121, 10, 3);
  }
  function vanUnder(ctx, geo, s) {
    const v = s.view, t = s.reduced ? 0 : s.time;
    rect(ctx, P.asphalt[1], v.x - 30, v.y - 30, v.w + 60, v.h + 60);
    const scroll = (t / 2.4) % 64;
    for (let x = v.x - 64 + scroll; x < v.x + v.w + 64; x += 64) { box(ctx, x, geo.h + 34, 28, 3, P.a.mustard, { ink: false, amp: 0.2 }); box(ctx, x + 20, -40, 28, 3, P.paper[2], { ink: false, amp: 0.2 }); }
    for (let x = v.x - 90 + ((t / 2.4) % 90); x < v.x + v.w + 90; x += 90) { rect(ctx, P.fluoro[2], x, geo.h + 52, 2, 2); rect(ctx, P.fluoro[2], x + 40, -56, 2, 2); }
    if (!s.reduced) for (let index = 0; index < 3; index += 1) {
      const x = v.x + ((t / 5 + index * 160) % (v.w + 240)) - 120;
      alpha(ctx, 0.12, () => { oval(ctx, x, geo.h + 60, 50, 16, P.sodium[2]); oval(ctx, x, -60, 50, 16, P.sodium[2]); });
    }
  }
  function vanDynamic(ctx, geo, s) {
    const room = s.extras.room || {}, t = s.reduced ? 0 : s.time;
    // Windscreen: rain, and the wipers.
    rect(ctx, P.wet[1], 14, -14, 212, 12);
    alpha(ctx, 0.6, () => { for (let index = 0; index < 12; index += 1) { const x = 18 + ((index * 37) % 200), y = -13 + ((t / 30 + index * 7) % 10); rect(ctx, P.wet[3], x, y, 0.8, 2); } });
    const sweep = s.reduced ? 0 : Math.sin(t / 420) * 0.9;
    for (const px of [70, 170]) { ctx.save(); ctx.translate(px, -2); ctx.rotate(-Math.PI / 2 + sweep); line(ctx, 0, 0, 0, -10 + 22, P.ink, 1.4, px, 0); ctx.restore(); }
    // The tree air freshener swinging off the mirror.
    ctx.save(); ctx.translate(120, -2); ctx.rotate(s.reduced ? 0 : Math.sin(t / 300) * 0.35 + (room.shake ? 0.4 : 0));
    line(ctx, 0, 0, 0, 8, P.ink, 0.6); shape(ctx, [0, 8, 4, 15, 1.4, 15, 3.4, 19, -3.4, 19, -1.4, 15, -4, 15], P.a.track, { ink: 0.7, amp: 0.1 });
    ctx.restore();
    // The sliding door: shut; then loose, with rain through the gap; then gone.
    if (room.doorOpen) { rect(ctx, P.asphalt[1], 226, 44, 14, 94); alpha(ctx, 0.7, () => { for (let y = 50 + ((t / 2) % 20); y < 136; y += 20) rect(ctx, P.paper[2], 232, y, 3, 8); }); }
    else {
      box(ctx, 226, 44, 14, 94, P.paper[1], { ink: 1.4, amp: 0.3 });
      rect(ctx, P.metal[2], 229, 88, 5, 12); rect(ctx, P.ink, 229, 100, 5, 1);
      if (room.doorLoose) { rect(ctx, P.ink, 226, 60, 2.6, 66); alpha(ctx, 0.7, () => { for (let index = 0; index < 5; index += 1) { const y = 62 + ((t / 8 + index * 13) % 62); line(ctx, 225, y, 220, y + 3, P.wet[3], 0.8, index, 0); } }); }
    }
  }
  function vanLights(geo, s) {
    const room = s.extras.room || {}, t = s.reduced ? 0 : s.time;
    const list = [{ x: 120, y: 8, r: 50, strength: 0.5 }];
    if (!s.reduced) { const x = 300 - ((t / 6) % 420); list.push({ x, y: 80, r: 120, strength: 0.75, warm: 0.45 }); }
    if (room.doorLoose || room.doorOpen) list.push({ x: 226, y: 92, r: room.doorOpen ? 80 : 40, strength: 0.8 });
    // A phone in the back: a small cold light while he films; the whole van
    // when it rings. Its screen faces the cabin, so only the light is ours.
    if (room.phoneLight) list.push({ x: 56, y: 108, r: room.phoneLight === "call" ? 130 : 34, strength: room.phoneLight === "call" ? 0.95 : 0.7, warm: 0 });
    return { ambient: { color: [6, 8, 12], alpha: 0.56 }, list };
  }

  // ---- the roadside
  function roadStatic(c, geo, m) {
    const L = -m.mx, R = geo.w + m.mx, T = -m.my, B = geo.h + m.my;
    // Beyond the road: a dark field, a fence, a few far windows (somebody's home).
    rect(c, P.grass[0], L, T, R - L, B - T);
    rect(c, P.grass[1], 300, T, R - 300, B - T);
    for (let y = T; y < B; y += 24) { rect(c, P.night[2], 318, y, 1.4, 12); }
    for (const [x, y] of [[332, 300], [310, 760], [340, 1180], [326, 40]]) { rect(c, P.sodium[2], x, y, 4, 3); rect(c, P.sodium[1], x + 6, y, 3, 3); }
    // Verge: wet grass in clumps, a gravel shoulder by the rail.
    rect(c, P.grass[1], 0, 0, 150, geo.h);
    const random = rng("verge");
    for (let index = 0; index < 160; index += 1) {
      const x = 20 + random() * 130, y = random() * geo.h, w = 6 + random() * 12;
      shape(c, [x, y, x + w * 0.3, y - 4 - random() * 4, x + w * 0.5, y - 1, x + w * 0.75, y - 5 - random() * 3, x + w, y], random() < 0.5 ? P.grass[2] : P.grass[3], { ink: false, seed: index, amp: 0.4 });
    }
    rect(c, P.concrete[0], 150, 0, 48, geo.h);
    for (let index = 0; index < 900; index += 1) rect(c, random() < 0.5 ? P.concrete[1] : P.asphalt[1], 150 + random() * 48, random() * geo.h, 1.2, 1.2);
    alpha(c, 0.5, () => { rect(c, P.asphalt[0], 162, 0, 6, geo.h); rect(c, P.asphalt[0], 182, 0, 5, geo.h); });
    // The embankment edge.
    rect(c, P.grass[0], 0, 0, 22, geo.h); rect(c, P.grass[2], 21, 0, 1.4, geo.h);
    // The road itself, wet, the lamps smeared across it.
    A.asphalt(c, 206, T, R - 206, B - T, "road");
    rect(c, P.paper[2], 212, T, 2.2, B - T);
    for (let y = T; y < B; y += 60) box(c, 296, y, 2.6, 28, P.a.mustard, { ink: false, amp: 0.2 });
    for (let y = 30; y < geo.h; y += 46) rect(c, P.a.red, 213.6, y, 2, 1.6);
    alpha(c, 0.2, () => { for (const light of geo.lights || []) for (const [dx, y0, len] of [[0, 0, 60], [5, 66, 34], [-3, 106, 22], [2, 134, 12]]) box(c, 222 + dx, light.y - 6 + y0, 3, len, P.sodium[2], { ink: false, amp: 0.6 }); });
    // Guardrail on posts, one dent, rust.
    for (let y = 70; y < geo.h; y += 44) { rect(c, P.metal[0], 198, y, 8, 6); }
    rect(c, P.metal[2], 199, 70, 6, geo.h - 70); rect(c, P.metal[3], 199, 70, 1.4, geo.h - 70); rect(c, P.ink, 205, 70, 1, geo.h - 70);
    shape(c, [199, 500, 203, 506, 203, 524, 199, 530], P.metal[1], { ink: 0.8, amp: 0.3 });
    alpha(c, 0.8, () => { for (const y of [260, 880, 1210]) rect(c, P.a.rust, 200, y, 3, 10); });
    // Lamp posts with sodium heads leaning over the road; the wires between them.
    for (const light of geo.lights || []) {
      alpha(c, 0.14, () => { oval(c, light.x + 28, light.y + 2, 74, 32, P.sodium[2]); oval(c, light.x + 28, light.y + 2, 42, 18, P.sodium[2]); });
      drop(c, light.x, light.y + 3, 5, 2);
      rect(c, P.metal[1], light.x - 2, light.y - 44, 4, 46); rect(c, P.metal[2], light.x - 2, light.y - 44, 1.2, 46);
      line(c, light.x, light.y - 44, light.x + 30, light.y - 50, P.metal[1], 2.4, light.y, 0.2);
      box(c, light.x + 24, light.y - 54, 14, 6, P.metal[1], { ink: 1, amp: 0.2 }); rect(c, P.sodium[2], light.x + 26, light.y - 49, 10, 2);
    }
    const lamps = geo.lights || [];
    for (let index = 0; index + 1 < lamps.length; index += 1) { A.trace(c, [lamps[index].x + 1, lamps[index].y - 44, lamps[index].x + 10, (lamps[index].y + lamps[index + 1].y) / 2 - 44, lamps[index + 1].x + 1, lamps[index + 1].y - 44], index, 0.3, false); A.inkStroke(c, 0.8, P.night[3]); }
    // The bus shelter: a dry pad, a lit ad at the back, a timetable, a bench.
    alpha(c, 0.8, () => rect(c, P.concrete[1], 56, 590, 104, 64));
    rect(c, P.metal[1], 56, 588, 104, 4);
    box(c, 92, 579, 40, 11, P.fluoro[1], { ink: 1, amp: 0.2 }); rect(c, P.a.umbrella, 92, 579, 40, 4); oval(c, 122, 585, 4, 3, P.a.mustard);
    box(c, 70, 610, 70, 10, P.wood[2], { ink: 1.2, amp: 0.3 }); rect(c, P.wood[3], 70, 610, 70, 2); for (const x of [74, 134]) rect(c, P.metal[1], x, 620, 2.4, 5);
    box(c, 60, 584, 10, 14, P.paper[3], { ink: 1, amp: 0.2 }); label(c, "BUS", 65, 594, { size: 4.5, color: P.ink });
    alpha(c, 0.35, () => { box(c, 56, 590, 104, 64, P.wet[2], { ink: false }); });
    box(c, 56, 590, 104, 64, null, { ink: 1.2, amp: 0.3 });
    line(c, 60, 596, 72, 640, P.paper[3], 0.6, 3, 0.4); label(c, "ok", 150, 640, { size: 6, color: P.paper[1], angle: -0.2 });
    // A bin bag, torn; a deflated balloon tangled on the rail; a mile marker.
    drop(c, 165, 980, 12, 3.4);
    shape(c, [156, 980, 158, 968, 166, 963, 174, 967, 176, 980], P.cloth[0], { ink: 1.3, amp: 0.6 });
    shape(c, [164, 963, 166, 958, 169, 963], P.cloth[0], { ink: 1, amp: 0.3 }); rect(c, P.cloth[2], 160, 970, 6, 1.2);
    line(c, 200, 1084, 186, 1096, P.paper[2], 0.6, 4, 0.8); shape(c, [180, 1094, 186, 1092, 188, 1099, 181, 1101], P.a.maroonLight, { ink: 0.8, amp: 0.6 });
    box(c, 176, 1250, 6, 12, P.paper[3], { ink: 1, amp: 0.2 }); label(c, "14", 179, 1259, { size: 4.5, color: P.ink });
    // A crushed can.
    box(c, 70, 1220, 6, 3, P.metal[2], { ink: 0.7, amp: 0.4 });
    // The culvert at the top: a concrete headwall, the dark mouth, a grate hanging off one hinge.
    rect(c, P.grass[0], 0, 0, geo.w, 26);
    box(c, 54, -6, 92, 32, P.concrete[1], { ink: 1.4, amp: 0.5 }); rect(c, P.concrete[2], 54, -6, 92, 3);
    shape(c, [70, 26, 70, 12, 82, 2, 118, 2, 130, 12, 130, 26], P.ink, { ink: 1.2, amp: 0.4 });
    c.save(); c.translate(130, 24); c.rotate(0.5); for (let gx = 0; gx < 24; gx += 4) rect(c, P.metal[1], gx, -22, 1.6, 22); rect(c, P.metal[1], 0, -22, 24, 1.6); rect(c, P.metal[1], 0, -2, 24, 1.6); c.restore();
    alpha(c, 0.6, () => { for (let index = 0; index < 8; index += 1) rect(c, P.grass[3], 74 + index * 7, 26 + (index % 3) * 4, 5, 1.4); });
  }
  function roadDynamic(ctx, geo, s) {
    const bowlProp = geo.props.find(prop => prop.id === "bowl-road");
    if (bowlProp) A.bowl(ctx, bowlProp.x, bowlProp.y, { water: true, t: s.reduced ? null : s.time });
  }
  function roadLights(geo, s) {
    const list = (geo.lights || []).map(light => ({ x: light.x + 26, y: light.y + 2, r: 110, strength: 0.85, warm: 0.5, flat: 0.55 }));
    list.push({ x: 112, y: 590, r: 46, strength: 0.6 });
    list.push({ x: 100, y: 16, r: 44, strength: 0.4, warm: 0.6 });
    for (const actor of s.extras.npcs || []) if (actor.kind === "taillights") list.push({ x: actor.x, y: actor.y, r: 50, strength: 0.6, warm: 0.3 });
    return { ambient: { color: [5, 7, 12], alpha: 0.58 }, list };
  }

  // ---- the drain: shelter that stops being a city pipe
  function drainStatic(c, geo, m) {
    const L = -m.mx, R = geo.w + m.mx, T = -m.my, B = geo.h + m.my;
    rect(c, P.void, L, T, R - L, B - T);
    // The channel floor: concrete near the mouth, brick further in, then something sewn.
    const random = rng("drain");
    A.concrete(c, 42, 190, 156, 190, "drain-floor", { joint: 38 });
    rect(c, P.plaster[1], 42, 0, 156, 190);
    for (let y = 2, row = 0; y < 190; y += 7, row += 1) for (let x = 42 + (row % 2) * 6; x < 198; x += 12) rect(c, random() < 0.2 ? P.plaster[0] : P.plaster[2], x + 0.6, y + 0.6, 10.8, 5.8);
    alpha(c, 0.8, () => { for (let y = 150; y < 200; y += 3) rect(c, P.concrete[1], 42, y, 156, (y - 150) / 20); });
    // The trickle runs the wrong way: from the mouth inward.
    A.trace(c, [120, 372, 118, 300, 122, 220, 117, 140, 121, 80], 7, 1, false); A.inkStroke(c, 3.4, P.wet[1]);
    A.trace(c, [120, 372, 118, 300, 122, 220, 117, 140, 121, 80], 7, 1, false); A.inkStroke(c, 1, P.wet[2]);
    // Wet leaves and grit at the mouth.
    for (let index = 0; index < 26; index += 1) { const x = 48 + random() * 144, y = 326 + random() * 48; shape(c, [x, y, x + 3, y - 1.6, x + 5, y + 0.6, x + 2, y + 1.6], random() < 0.5 ? P.wood[2] : P.grass[3], { ink: false, seed: index, amp: 0.3 }); }
    // Walls: tall concrete, seen from above; a tag low down, moss, then roots.
    for (const [x, edge] of [[0, 40.8], [198, 198]]) {
      rect(c, P.concrete[1], x, 0, 42, geo.h); rect(c, P.concrete[2], edge, 0, 1.2, geo.h);
      alpha(c, 0.6, () => { for (let y = 30; y < geo.h; y += 70) rect(c, P.grass[2], x + (x ? 2 : 32), y, 8, 26); });
    }
    alpha(c, 0.7, () => { A.trace(c, [8, 300, 18, 292, 26, 302, 34, 290], 1, 0.6, false); A.inkStroke(c, 1.6, P.a.umbrellaLight); });
    for (let index = 0; index < 6; index += 1) { const y = 30 + index * 26; A.trace(c, [40, y, 52, y + 6, 58, y + 18], index, 1, false); A.inkStroke(c, 1, P.wood[1]); A.trace(c, [200, y + 12, 188, y + 20, 184, y + 30], index + 9, 1, false); A.inkStroke(c, 1, P.wood[1]); }
    rect(c, P.concrete[0], 0, 0, geo.w, 22);
    // The seams of the deep end are stitched, not mortared.
    for (let index = 0; index < 5; index += 1) { const y = 20 + index * 30; stitches(c, 50, y, 190, y + 4, P.paper[1], 6, 1.6, 0.8); }
    // The warm crack in the back wall.
    shape(c, [98, 58, 112, 70, 120, 62, 130, 76, 144, 66, 138, 74, 128, 82, 118, 70, 106, 74], P.ember[1], { ink: 1.6, amp: 0.4 });
    // A shopping-trolley wheel, the dry glove.
    oval(c, 176, 344, 4, 4, P.metal[1], true, 1); oval(c, 176, 344, 1.4, 1.4, P.ink);
    shape(c, [72, 302, 80, 297, 86, 300, 88, 306, 80, 309, 74, 307], P.wood[2], { ink: 1.1, amp: 0.3 }); for (const fx of [80, 83, 86]) line(c, fx, 298, fx + 2, 294, P.wood[2], 1.4, fx, 0.1);
  }
  function drainDynamic(ctx, geo, s) {
    const room = s.extras.room || {};
    // Outside the mouth: rain, and the road's light.
    rect(ctx, P.night[1], 42, 370, 156, 16);
    if (room.crack) {
      const k = Math.min(1, (s.extras.sceneTime - room.crack) / 500), p = s.sim.player;
      for (let index = 0; index < 7; index += 1) { const a = (index / 7) * TAU + 0.3; line(ctx, p.x, p.y + 4, p.x + Math.cos(a) * 30 * k, p.y + 4 + Math.sin(a) * 16 * k, P.ink, 2, index, 1.5); }
    }
    if (!s.reduced) { const k = (s.time / 1800) % 1; alpha(ctx, 0.5 * (1 - k), () => rect(ctx, P.ember[3], 121, 66 - k * 10, 1.2, 1.2)); }
  }
  function drainLights(geo, s) {
    return { ambient: { color: [4, 5, 8], alpha: 0.56 }, list: [{ x: 120, y: 380, r: 110, strength: 0.75 }, { x: 121, y: 70, r: 70, strength: 0.75, warm: 0.8 }] };
  }

  // ===================== BELOW =====================
  // Every Threshold wall is the same construction: a dark cap, a front face
  // where it meets the floor (painted plaster over an old dado), and the
  // shadow it casts. Rooms differ only in their face style and their things.
  const FACE = {
    slip: { upper: P.plaster, lower: P.plaster, dado: 0.82, brick: true, edge: P.plaster[2] },
    clatter: { upper: P.plaster, lower: P.service, dado: 0.45, edge: P.plaster[3] },
    hem: { upper: P.plaster, lower: P.service, dado: 0.45, edge: P.plaster[3] },
    hearth: { upper: [P.plaster[1], P.plaster[2], P.plaster[3], P.paper[1]], lower: P.wood, dado: 0.5, edge: P.wood[3] },
    queue: { upper: P.plaster, lower: P.service, dado: 0.4, edge: P.plaster[3] },
    porter: { upper: [P.below[1], P.a.maroon, P.a.maroonLight, P.paper[1]], lower: P.wood, dado: 0.55, edge: P.wood[3] }
  };
  function wallBlock(c, s, geo, style) {
    rect(c, P.below[0], s.x, s.y, s.w, s.h);
    const bottom = s.y + s.h, faceVisible = bottom < geo.h - 1 && s.h <= 24 || (bottom < geo.h - 1 && s.h > 24 && s.w >= 16);
    if (faceVisible) {
      const face = Math.min(13, s.h - 4);
      A.wallFace(c, s.x, bottom - face, s.w, face, s.x * 3 + s.y, style);
      rect(c, P.ink, s.x, bottom - face - 0.8, s.w, 1);
      alpha(c, 0.34, () => rect(c, P.ink, s.x, bottom, s.w, 4)); alpha(c, 0.16, () => rect(c, P.ink, s.x, bottom + 4, s.w, 5));
    } else if (s.w > s.h) rect(c, style.edge, s.x, s.y, s.w, 1.2);
    if (s.h > s.w * 1.6) {
      const inner = s.x + s.w / 2 < geo.w / 2 ? s.x + s.w - 1.2 : s.x;
      rect(c, style.edge, inner, s.y, 1.2, s.h);
      alpha(c, 0.25, () => rect(c, P.ink, inner < geo.w / 2 ? inner + 1.2 : inner - 3, s.y, 3, s.h));
    }
  }
  function crate(c, s, seed) {
    drop(c, s.x + s.w / 2, s.y + s.h, s.w / 2 + 2, 4);
    box(c, s.x, s.y, s.w, s.h, P.wood[2], { ink: 1.4, seed, amp: 0.4 });
    rect(c, P.wood[3], s.x + 1, s.y + 1, s.w - 2, s.h * 0.3);
    rect(c, P.wood[1], s.x + 1, s.y + s.h * 0.3, s.w - 2, 1);
    for (let y = s.y + s.h * 0.3 + 6; y < s.y + s.h - 2; y += 6) rect(c, P.wood[1], s.x + 1, y, s.w - 2, 0.8);
    tape(c, s.x + s.w * 0.5, s.y + s.h * 0.15, s.w * 0.7, 0, seed);
  }
  function solidStatic(c, s, geo, style) {
    switch (s.kind) {
      case "wall": wallBlock(c, s, geo, style); break;
      case "crate": {
        // Parcels nobody collected: two crates, a tag on string.
        crate(c, s, s.x);
        box(c, s.x + 4, s.y - 8, s.w * 0.55, 10, P.paper[1], { ink: 1.1, amp: 0.4 }); rect(c, P.paper[2], s.x + 5, s.y - 7, s.w * 0.55 - 2, 3); line(c, s.x + 4 + s.w * 0.27, s.y - 8, s.x + 4 + s.w * 0.27, s.y + 2, P.wood[1], 0.8);
        line(c, s.x + s.w - 4, s.y + 6, s.x + s.w + 3, s.y + 14, P.paper[2], 0.6); box(c, s.x + s.w + 1, s.y + 13, 5, 7, P.paper[3], { ink: 0.7, amp: 0.2 });
        break;
      }
      case "pipe": {
        drop(c, s.x + s.w / 2, s.y + s.h, s.w / 2 + 3, 3);
        box(c, s.x + 2, s.y, s.w - 4, s.h, P.metal[1], { ink: 1.3, amp: 0.2 });
        rect(c, P.metal[2], s.x + 4, s.y, 2, s.h); rect(c, P.metal[0], s.x + s.w - 6, s.y, 2, s.h);
        for (let y = s.y + 6; y < s.y + s.h - 4; y += 20) { box(c, s.x, y, s.w, 4, P.metal[2], { ink: 1, amp: 0.1 }); rivet(c, s.x + 2, y + 2, 0.8); rivet(c, s.x + s.w - 2, y + 2, 0.8); }
        tape(c, s.x + s.w / 2, s.y + s.h * 0.55, s.w + 4, 0.15, s.y); tape(c, s.x + s.w / 2, s.y + s.h * 0.55 + 3, s.w + 2, -0.1, s.y + 1);
        oval(c, s.x + s.w + 3, s.y + s.h * 0.3, 4, 4, P.a.red, true, 1); line(c, s.x + s.w + 1, s.y + s.h * 0.3, s.x + s.w + 5, s.y + s.h * 0.3, P.ink, 0.8);
        break;
      }
      case "shelf": {
        drop(c, s.x + s.w / 2, s.y + s.h, s.w / 2, 3.5);
        box(c, s.x, s.y, s.w, s.h, P.wood[1], { ink: 1.3, amp: 0.3 });
        rect(c, P.wood[3], s.x + 1, s.y + 1, s.w - 2, 3);
        const random = rng(`shelf${s.x}`);
        let x = s.x + 4;
        while (x < s.x + s.w - 6) {
          const kind = random();
          if (kind < 0.3) { box(c, x, s.y - 6, 6, 8, P.fluoro[0], { ink: 0.8, amp: 0.2 }); rect(c, P.metal[2], x, s.y - 7, 6, 1.6); x += 8; }
          else if (kind < 0.55) { box(c, x, s.y - 4, 10, 6, P.paper[2], { ink: 0.8, amp: 0.3 }); line(c, x + 5, s.y - 4, x + 5, s.y + 2, P.a.red, 0.7); x += 12; }
          else if (kind < 0.75) { box(c, x, s.y - 5, 5, 7, P.metal[2], { ink: 0.8, amp: 0.2 }); x += 7; }
          else x += 6;
        }
        break;
      }
      case "rubble": {
        // What came down with him: concrete, a bent grate, leaves from up there.
        const random = rng(`rubble${s.x}`);
        for (let index = 0; index < 11; index += 1) {
          const x = s.x + random() * s.w, y = s.y + random() * s.h, w = 6 + random() * 10;
          shape(c, [x, y + w * 0.6, x + w * 0.3, y, x + w, y + w * 0.2, x + w * 0.9, y + w * 0.7], random() < 0.5 ? P.concrete[2] : P.concrete[1], { ink: 1, seed: index + s.x, amp: 0.5 });
          rect(c, P.concrete[3], x + w * 0.3, y + 1, w * 0.4, 1);
        }
        c.save(); c.translate(s.x + s.w * 0.6, s.y + 4); c.rotate(-0.3); for (let gx = 0; gx < 18; gx += 4) rect(c, P.metal[1], gx, 0, 1.6, 12); rect(c, P.metal[1], 0, 0, 18, 1.6); c.restore();
        for (let index = 0; index < 10; index += 1) { const x = s.x - 10 + random() * (s.w + 20), y = s.y - 14 + random() * 20; shape(c, [x, y, x + 3, y - 1.6, x + 5, y + 0.6, x + 2, y + 1.6], P.wood[2], { ink: false, seed: index, amp: 0.3 }); }
        break;
      }
      case "post": {
        // Brass queue stanchions, their belts long gone.
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        drop(c, cx, cy + 8, 11, 4);
        oval(c, cx, cy + 7, 10, 4, P.a.brass, true, 1.2); oval(c, cx - 2, cy + 6, 5, 1.6, P.a.brassLight);
        box(c, cx - 2.2, cy - 16, 4.4, 23, P.a.brass, { ink: 1.2, amp: 0.1 }); rect(c, P.a.brassLight, cx - 1.6, cy - 16, 1.2, 23);
        oval(c, cx, cy - 17, 3.6, 2.4, P.a.brass, true, 1.1);
        box(c, cx + 2, cy - 14, 5, 4, P.metal[1], { ink: 0.8, amp: 0.1 });
        break;
      }
      default: if (!s.openWhen && !s.when) rect(c, P.below[0], s.x, s.y, s.w, s.h);
    }
  }

  // Floors and the things that make each place somewhere.
  const ROOMS = {
    slip: {
      floor(c, geo, m) {
        A.tiles(c, 0, 0, geo.w, geo.h, "slip", { size: 20, colors: [P.below[2], "#2a221b"] });
        // Where he landed: tiles cracked outward.
        for (let index = 0; index < 9; index += 1) { const a = (index / 9) * TAU + 0.2; line(c, 160, 296, 160 + Math.cos(a) * (18 + (index % 3) * 8), 296 + Math.sin(a) * (10 + (index % 2) * 6), P.below[0], 1.1, index, 1.2); }
        // HOME, scratched into the floor tiles with a key, and an arrow.
        alpha(c, 0.85, () => { label(c, "HOME", 160, 50, { size: 12, color: P.paper[1], weight: 500, jitter: 1.4, spacing: 2 }); });
        line(c, 160, 44 - 22, 160, 44 - 4, P.paper[1], 1, 5, 0.6); line(c, 160, 22, 155, 28, P.paper[1], 1, 6, 0.3); line(c, 160, 22, 165, 28, P.paper[1], 1, 7, 0.3);
        // A drip stain under the pipe.
        worn(c, 262, 196, 14, 5, P.below[0], 0.6);
      },
      beyond(c, geo, m) {
        // The shaft: stairs climbing north out of the gap, shrinking, to one lit door very far up.
        const T = -m.my;
        rect(c, P.void, -m.mx, T, geo.w + m.mx * 2, -T + 2);
        let y = 0, w = 40, step = 9, index = 0;
        while (y > T + 6 && w > 4) {
          const x = 160 - w / 2;
          rect(c, index % 2 ? P.below[2] : P.below[3], x, y - step, w, step);
          rect(c, P.plaster[3], x, y - step, w, 0.8);
          y -= step; w *= 0.9; step *= 0.9; index += 1;
        }
        rect(c, P.sodium[2], 160 - w / 2 - 1, y - 7, w + 2, 7);
        rect(c, P.ember[4], 160 - w / 4, y - 6, w / 2, 5);
        // Pipes running up out of sight on either side of the shaft.
        for (const x of [112, 204]) { rect(c, P.metal[0], x, T, 4, -T); rect(c, P.metal[1], x, T, 1.2, -T); }
      }
    },
    clatter: {
      floor(c, geo) {
        A.concrete(c, 0, 0, geo.w, geo.h, "clatter", { tone: [P.below[1], P.below[2], P.below[3], P.plaster[2]], joint: 48 });
        // Faded safety lines along the old sorting path.
        alpha(c, 0.45, () => { for (const [x, y, w, h] of [[34, 360, 220, 3], [252, 60, 3, 303], [34, 300, 3, 63]]) box(c, x, y, w, h, P.a.mustard, { ink: false, amp: 0.3 }); });
        // The flush belt from the north chute, with rollers.
        rect(c, P.cloth[0], 280, 20, 22, 150); for (let y = 24; y < 170; y += 8) rect(c, P.metal[1], 281, y, 20, 2);
        rect(c, P.metal[2], 278, 20, 2, 150); rect(c, P.metal[2], 302, 20, 2, 150);
        worn(c, 52, 380, 16, 7, P.plaster[2], 0.35);
      },
      walls(c, geo) {
        // The sorting chute in the north wall, with tags still hanging.
        box(c, 278, 4, 26, 16, P.service[1], { ink: 1.2, amp: 0.3 }); rect(c, P.ink, 282, 9, 18, 9);
        for (const x of [284, 290, 296]) { line(c, x, 9, x, 15, P.paper[2], 0.6); box(c, x - 1.5, 15, 3, 4, P.paper[3], { ink: 0.6, amp: 0.1 }); }
        label(c, "UNCLAIMED", 120, 16, { size: 6, color: P.paper[1] });
      }
    },
    hem: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "hem", { size: 20, check: true, colors: ["#1b2522", "#202c28"], grout: "#121815" });
        // A swept path: somebody keeps the way clear between the doors.
        alpha(c, 0.35, () => { for (let y = 220; y < 410; y += 12) worn(c, 160, y, 18, 6, "#2c3a35", 0.6); for (let x = 180; x < 300; x += 12) worn(c, x, 118, 7, 9, "#2c3a35", 0.35); });
        // Chalk tally by the gate: days counted.
        alpha(c, 0.85, () => { let x = 208; for (let group = 0; group < 3; group += 1) { for (let tick = 0; tick < 4; tick += 1) line(c, x + tick * 2.2, 238, x + tick * 2.2 + 0.4, 246, P.paper[3], 0.8, group * 9 + tick, 0.3); line(c, x - 1, 245, x + 8, 239, P.paper[3], 0.8, group, 0.2); x += 13; } line(c, x, 238, x, 246, P.paper[3], 0.8); line(c, x + 2.2, 238, x + 2.4, 246, P.paper[3], 0.8); });
        // His tin cup, a folded route map.
        box(c, 230, 252, 6, 6, P.metal[2], { ink: 0.9, amp: 0.2 }); rect(c, P.metal[3], 230, 252, 6, 1.2);
        c.save(); c.translate(250, 258); c.rotate(0.3); box(c, 0, 0, 12, 8, P.paper[2], { ink: 0.8, amp: 0.3 }); line(c, 4, 0, 4, 8, P.paper[0], 0.5); line(c, 8, 0, 8, 8, P.paper[0], 0.5); line(c, 1, 5, 10, 2, P.a.red, 0.6); c.restore();
        // Mop and bucket against the wall; a broom.
        box(c, 26, 372, 12, 12, P.metal[1], { ink: 1.1, amp: 0.3 }); rect(c, P.metal[2], 27, 373, 10, 2); line(c, 34, 372, 40, 344, P.wood[2], 1.6, 3, 0.2);
        line(c, 300, 384, 286, 340, P.wood[2], 1.6, 4, 0.2); shape(c, [284, 336, 290, 334, 292, 342, 284, 344], P.a.mustard, { ink: 0.8, amp: 0.3 });
      },
      walls(c) {
        // A caged work lamp over the gate, kept working.
        box(c, 96, 6, 10, 9, P.metal[1], { ink: 1, amp: 0.2 }); rect(c, P.sodium[2], 98, 9, 6, 5); for (const x of [98, 101, 104]) rect(c, P.ink, x, 8, 0.6, 7);
        tape(c, 101, 5, 10, 0, 6);
      }
    },
    hearth: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "hearth", { board: 12 });
        // Past the warmth, the floor turns cold: the bowl's corner.
        alpha(c, 0.75, () => shape(c, [226, 320, 240, 270, 300, 256, 300, 320], "#1d2024", { ink: false, amp: 2 }));
        alpha(c, 0.45, () => { const random = rng("frost"); for (let index = 0; index < 12; index += 1) rect(c, "#c9d6e0", 246 + random() * 52, 272 + random() * 44, 1.4, 0.8); });
        // A braided rug around the fire, ring by ring.
        const rings = [[78, 38, P.a.maroon], [70, 33, P.a.mustard], [62, 29, P.paper[1]], [54, 25, P.a.maroonLight], [46, 21, P.wood[2]]];
        for (const [rx, ry, color] of rings) { oval(c, 172, 184, rx, ry, color); }
        for (const [rx, ry] of rings) { c.globalAlpha = 0.35; c.strokeStyle = P.ink; c.lineWidth = 0.7; c.setLineDash([2, 2]); c.beginPath(); c.ellipse(172, 184, rx - 1, ry - 1, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
        oval(c, 172, 184, 78, 38, null, true, 1.2);
        // The bench: a blanket folded on it, two cushions: a seat for two.
        const seat = geo.seat;
        drop(c, seat.x + seat.w / 2, seat.y + seat.h + 2, seat.w / 2 + 2, 4);
        box(c, seat.x, seat.y, seat.w, seat.h, P.wood[2], { ink: 1.4, amp: 0.3 }); rect(c, P.wood[3], seat.x + 1, seat.y + 1, seat.w - 2, 2);
        for (const x of [seat.x + 3, seat.x + seat.w - 6]) rect(c, P.wood[1], x, seat.y + seat.h, 3, 4);
        box(c, seat.x + 4, seat.y - 4, 20, 7, P.a.maroon, { ink: 1.1, amp: 0.5 }); stitches(c, seat.x + 6, seat.y - 1, seat.x + 22, seat.y - 1, P.a.maroonLight, 3, 1, 0.6);
        box(c, seat.x + 28, seat.y - 4, 18, 7, P.a.mustard, { ink: 1.1, amp: 0.5 });
        box(c, seat.x + seat.w - 10, seat.y - 1, 12, 4, P.paper[1], { ink: 0.8, amp: 0.3 });
        // The kettle, kept beside the fire.
        const h = geo.hearth;
        drop(c, h.x + 26, h.y + 9, 7, 2.4);
        shape(c, [h.x + 20, h.y + 8, h.x + 20, h.y + 1, h.x + 24, h.y - 2, h.x + 30, h.y - 2, h.x + 33, h.y + 2, h.x + 33, h.y + 8], P.metal[1], { ink: 1.2, amp: 0.3 });
        line(c, h.x + 33, h.y + 3, h.x + 38, h.y - 1, P.metal[1], 2, 1, 0.1); rect(c, P.metal[3], h.x + 22, h.y - 1, 6, 1);
        A.trace(c, [h.x + 22, h.y - 3, h.x + 27, h.y - 8, h.x + 32, h.y - 3], 3, 0.1, false); A.inkStroke(c, 1, P.ink);
        // Two tin cups.
        for (const [x, y] of [[h.x - 30, h.y + 18], [h.x - 24, h.y + 20]]) { box(c, x, y, 5, 5, P.metal[2], { ink: 0.8, amp: 0.2 }); rect(c, P.metal[3], x, y, 5, 1); }
      },
      walls(c) {
        // A child's drawing of a house, taped up; a line with a sock and a scarf drying.
        c.save(); c.translate(150, 5); c.rotate(-0.05);
        box(c, 0, 0, 16, 12, P.paper[3], { ink: 0.8, amp: 0.2 });
        line(c, 4, 6, 8, 3, P.a.red, 0.8); line(c, 8, 3, 12, 6, P.a.red, 0.8); box(c, 4.5, 6, 7, 4.5, null, { ink: 0.7, amp: 0.3 }); rect(c, P.a.umbrella, 7, 7.6, 2, 2);
        A.flame(c, 13.4, 10.6, 1.4, 0, { still: true });
        tape(c, 1, 1, 5, -0.6, 7); tape(c, 15, 1, 5, 0.6, 8);
        c.restore();
        A.trace(c, [200, 6, 225, 10, 250, 6], 2, 0.3, false); A.inkStroke(c, 0.6, P.paper[1]);
        shape(c, [210, 8, 215, 9, 214, 16, 211, 17, 210, 14], P.a.mustard, { ink: 0.8, amp: 0.2 });
        shape(c, [226, 10, 236, 9, 235, 18, 231, 15, 227, 18], P.a.maroon, { ink: 0.8, amp: 0.2 });
      }
    },
    queue: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "queue", { size: 24, check: true, colors: ["#2a2620", "#332e26"], grout: "#1a1713" });
        // Footprints worn into a zigzag: years of people waiting in line.
        const path = [[160, 400], [160, 350], [70, 340], [70, 270], [240, 270], [240, 210], [70, 210], [70, 150], [160, 140], [160, 100]];
        alpha(c, 0.55, () => { for (let index = 0; index + 1 < path.length; index += 1) { const [x1, y1] = path[index], [x2, y2] = path[index + 1], n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 9)); for (let k = 0; k < n; k += 1) worn(c, x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, 8, 4.5, "#3b3429", 0.7); } });
        // WAIT HERE, stencilled and nearly gone.
        alpha(c, 0.45, () => { rect(c, P.a.mustard, 136, 108, 48, 2); label(c, "WAIT HERE", 160, 122, { size: 7, color: P.a.mustard, weight: 900 }); });
        // Ticket stubs near the dispenser.
        const random = rng("stubs");
        for (let index = 0; index < 9; index += 1) { c.save(); c.translate(178 + random() * 34, 380 + random() * 26); c.rotate(random() * 2); rect(c, P.paper[2], -2.5, -1.5, 5, 3); c.restore(); }
        // A row of bolted chairs on the east wall; one coat left on one.
        for (let index = 0; index < 4; index += 1) { const y = 120 + index * 22; box(c, 300, y, 14, 16, P.service[1], { ink: 1.1, amp: 0.3 }); rect(c, P.service[2], 300, y, 14, 2); rect(c, P.service[0], 312, y, 3, 16); }
        shape(c, [298, 146, 306, 142, 314, 148, 312, 160, 300, 162], P.a.maroon, { ink: 1, amp: 0.5 }); rect(c, P.a.brass, 305, 150, 1.2, 1.2);
      },
      walls(c) {
        // Service windows, shuttered; the middle one still has a lamp and a card.
        for (const x of [40, 220]) { box(c, x, 6, 56, 13, P.metal[1], { ink: 1.1, amp: 0.2 }); for (let y = 8; y < 18; y += 2.4) rect(c, P.metal[0], x + 1, y, 54, 0.8); }
        box(c, 110, 4, 26, 15, P.ink, { ink: 1, amp: 0.2 }); rect(c, P.sodium[0], 112, 6, 22, 11); box(c, 116, 10, 12, 6, P.paper[3], { ink: 0.6, amp: 0.1 }); label(c, "SHUT", 122, 15.2, { size: 3.6, color: P.ink });
        // The ticket machine by the door.
        box(c, 188, 396, 10, 14, P.a.red, { ink: 1.2, amp: 0.2 }); rect(c, P.paper[3], 191, 398, 4, 4); line(c, 193, 410, 193, 426, P.metal[1], 1.6, 1, 0);
      }
    },
    porter: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "porter", { size: 24, check: true, colors: ["#1f1915", "#251e19"], grout: "#130f0c" });
        // The Porter's runner: worn pale down the middle by one walk, repeated.
        box(c, 158, 16, 44, 228, P.a.maroon, { ink: 1.2, amp: 0.6 });
        rect(c, P.a.mustard, 161, 16, 2, 228); rect(c, P.a.mustard, 197, 16, 2, 228);
        alpha(c, 0.5, () => { for (let y = 26; y < 240; y += 12) worn(c, 180, y, 9, 5, P.a.maroonLight, 0.8); });
        for (let x = 160; x < 200; x += 4) line(c, x, 244, x + 1, 249, P.a.maroon, 0.8, x, 0.4);
        // The alcove's painted frame, so the hatch reads from anywhere.
        rect(c, P.a.mustard, 38, 116, 3, 52);
      },
      walls(c) {
        // Left luggage: pigeonholes, a few parcels never collected.
        for (let col = 0; col < 8; col += 1) {
          const x = 214 + col * 13;
          box(c, x, 3, 12, 9, P.wood[1], { ink: 0.8, amp: 0.1 });
          if (col % 3 === 1) box(c, x + 2, 5, 8, 6, P.paper[1], { ink: 0.6, amp: 0.2 });
        }
        // A key board: one hook empty.
        box(c, 60, 3, 46, 10, P.wood[2], { ink: 0.9, amp: 0.2 });
        for (let index = 0; index < 8; index += 1) { const x = 64 + index * 5.4; rect(c, P.a.brass, x, 5, 0.8, 2); if (index !== 5) line(c, x + 0.4, 7, x + 0.4, 11, P.a.brassLight, 1.1); }
        // A clock over the door, stopped.
        oval(c, 138, 8, 5, 5, P.paper[3], true, 1); line(c, 138, 8, 138, 4.6, P.ink, 0.8); line(c, 138, 8, 140.6, 9, P.ink, 0.8);
      }
    }
  };

  function belowStatic(c, geo, m) {
    rect(c, P.void, -m.mx, -m.my, geo.w + m.mx * 2, geo.h + m.my * 2);
    const decor = ROOMS[geo.id] || {}, style = FACE[geo.id] || FACE.clatter;
    decor.beyond?.(c, geo, m);
    decor.floor?.(c, geo, m);
    for (const s of geo.solids) if (!s.openWhen && !s.when && s.kind === "wall") solidStatic(c, s, geo, style);
    decor.walls?.(c, geo, m);
    for (const s of geo.solids) if (!s.openWhen && !s.when && s.kind !== "wall") solidStatic(c, s, geo, style);
  }

  // Doors, gates and hatches change with the story, so they are live.
  function dynamicSolid(ctx, s, sim, t, geo) {
    const open = !present(s, sim.flags);
    if (s.kind === "door") {
      if (open) { rect(ctx, P.ink, s.x, s.y, s.w, s.h); alpha(ctx, 0.5, () => rect(ctx, P.below[2], s.x + 2, s.y + 2, s.w - 4, s.h - 4)); return; }
      box(ctx, s.x, s.y, s.w, s.h, P.service[1], { ink: 1.4, amp: 0.2 });
      rect(ctx, P.service[2], s.x + 1, s.y + 1, s.w - 2, 2);
      for (let y = s.y + 5; y < s.y + s.h - 2; y += 6) rect(ctx, P.service[0], s.x + 2, y, s.w - 4, 1);
      if (s.w > s.h) { oval(ctx, s.x + s.w / 2, s.y + s.h / 2, 4, 4, null, true, 1.4); line(ctx, s.x + s.w / 2 - 4, s.y + s.h / 2, s.x + s.w / 2 + 4, s.y + s.h / 2, P.ink, 1); }
      else { rect(ctx, P.metal[2], s.x + s.w / 2 - 1, s.y + s.h / 2 - 5, 2, 10); }
      return;
    }
    if (s.kind === "homedoor") {
      if (open) {
        rect(ctx, P.ember[4], s.x, s.y, s.w, s.h); rect(ctx, P.paper[3], s.x + 4, s.y, s.w - 8, s.h);
        alpha(ctx, 0.35, () => shape(ctx, [s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w + 26, s.y + s.h + 70, s.x - 26, s.y + s.h + 70], P.ember[4], { ink: false }));
        return;
      }
      box(ctx, s.x, s.y, s.w, s.h, P.wood[2], { ink: 1.6, amp: 0.2 });
      rect(ctx, P.wood[3], s.x + 1, s.y + 1, s.w - 2, 2);
      line(ctx, s.x + s.w / 2, s.y + 2, s.x + s.w / 2, s.y + s.h - 1, P.ink, 1.2);
      for (const dx of [-4, 3]) oval(ctx, s.x + s.w / 2 + dx, s.y + s.h * 0.6, 1.2, 1.2, P.a.brass);
      rect(ctx, P.sodium[1], s.x + 6, s.y + 2, s.w - 12, 3);
      return;
    }
    if (s.kind === "hatch") {
      if (open) { rect(ctx, P.ink, s.x, s.y, s.w, s.h); alpha(ctx, 0.6, () => rect(ctx, P.ember[1], s.x + 3, s.y + 4, s.w - 6, s.h - 8)); return; }
      box(ctx, s.x, s.y, s.w, s.h, P.service[1], { ink: 1.4, amp: 0.2 });
      for (let y = s.y + 6; y < s.y + s.h - 2; y += 7) rect(ctx, P.service[0], s.x + 2, y, s.w - 4, 1.2);
      label(ctx, "SERVICE", s.x + s.w / 2 + 1, s.y + s.h / 2 + 2, { size: 4.2, color: P.paper[2], angle: -Math.PI / 2 });
      rect(ctx, P.a.brass, s.x + s.w - 6, s.y + s.h / 2 - 3, 3, 6);
      return;
    }
    if (s.kind === "gate" || s.kind === "gatelatch") {
      if (open) { alpha(ctx, 0.7, () => { rect(ctx, P.metal[0], s.x, s.y + s.h - 3, s.w, 2); }); return; }
      drop(ctx, s.x + s.w / 2, s.y + s.h, s.w / 2, 3, 0.3);
      rect(ctx, P.metal[0], s.x, s.y + s.h - 4, s.w, 4);
      for (let x = s.x + 3; x < s.x + s.w - 1; x += 7) { box(ctx, x, s.y - 14, 2.4, s.h + 12, P.metal[1], { ink: 0.9, amp: 0.1 }); rect(ctx, P.metal[2], x, s.y - 14, 0.8, s.h + 12); }
      rect(ctx, P.metal[1], s.x, s.y - 12, s.w, 2.4); rect(ctx, P.metal[1], s.x, s.y + 2, s.w, 2.4);
      if (s.kind === "gatelatch") {
        // The latch, rimed over: frost spikes on it (shape, not just colour) and the sign.
        box(ctx, s.x + 10, s.y - 4, 20, 12, P.metal[2], { ink: 1.4, amp: 0.2 });
        rect(ctx, P.metal[3], s.x + 11, s.y - 3, 18, 2);
        for (let index = 0; index < 6; index += 1) { const x = s.x + 11 + index * 3.4; shape(ctx, [x, s.y - 4, x + 1.4, s.y - 8 - (index % 2) * 2, x + 2.6, s.y - 4], "#e8f2ff", { ink: 0.5, amp: 0.1 }); }
        box(ctx, s.x - 14, s.y - 30, 68, 13, P.paper[3], { ink: 1.2, amp: 0.3 });
        label(ctx, "NO OPEN FLAMES", s.x + 20, s.y - 20.6, { size: 7, color: P.a.red, weight: 900 });
        tape(ctx, s.x - 12, s.y - 29, 6, -0.6, 9); tape(ctx, s.x + 52, s.y - 29, 6, 0.6, 10);
      }
    }
  }
  function belowDynamic(ctx, geo, s) {
    const sim = s.sim, t = s.reduced ? 0 : s.time, p = s.pos;
    for (const solid of geo.solids) if (solid.openWhen || solid.when) dynamicSolid(ctx, solid, sim, t, geo);
    if (geo.id === "clatter") {
      // Dormant, not dead: pilot lamps on the chute and the pipe wake as he passes.
      for (const [x, y] of [[286, 6], [292, 6], [298, 6], [232, 232], [150, 56], [210, 56]]) {
        const near = Math.max(0, 1 - Math.hypot(p.x - x, p.y - y) / 90);
        oval(ctx, x, y, 1.8, 1.8, near > 0.15 ? P.ember[2 + (near > 0.5 ? 1 : 0)] : P.ember[0], true, 0.6);
      }
      const belt = Math.max(0, 1 - Math.hypot(p.x - 291, p.y - 90) / 110);
      if (belt > 0) { const shift = (t / 140) % 8; alpha(ctx, belt, () => { for (let y = 24 + shift; y < 168; y += 8) rect(ctx, P.metal[2], 281, y, 20, 1); }); }
    }
    if (geo.id === "queue") {
      // NOW SERVING: the sign never stopped counting.
      box(ctx, 140, -10, 40, 13, P.ink, { ink: 1, amp: 0.2 });
      const n = 40 + Math.floor((s.time || 0) / 9000) % 50;
      ctx.save(); ctx.font = "900 9px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.fillStyle = P.ember[2]; ctx.fillText(String(n).padStart(3, "0"), 160, 0.6); ctx.restore();
    }
    if (geo.id === "slip" && !s.reduced) {
      const k = (s.time / 1100) % 1; rect(ctx, P.wet[3], 262, 190 + k * 8, 0.9, 2);
    }
    for (const prop of geo.props) {
      if (!present(prop, sim.flags)) continue;
      if (prop.kind === "bowl") A.bowl(ctx, prop.x, prop.y, { frost: true });
      else if (prop.kind === "lever" || prop.id === "queue-lever-done") {
        const down = prop.id === "queue-lever-done";
        box(ctx, prop.x - 5, prop.y - 9, 10, 15, P.service[1], { ink: 1.2, amp: 0.2 }); rect(ctx, P.service[2], prop.x - 4, prop.y - 8, 8, 2);
        line(ctx, prop.x, prop.y - 2, prop.x + (down ? 7 : 6), prop.y + (down ? 9 : -12), P.metal[2], 2.4, 1, 0);
        oval(ctx, prop.x + (down ? 7 : 6), prop.y + (down ? 9 : -12), 2.6, 2.6, P.a.red, true, 1);
      } else if (prop.id === "ticket-stub") { ctx.save(); ctx.translate(prop.x, prop.y); ctx.rotate(-0.25); box(ctx, -5, -3, 10, 6, P.paper[2], { ink: 0.8, amp: 0.2 }); for (const dx of [-2, 1]) oval(ctx, dx, 0, 0.9, 0.9, P.ink); ctx.restore(); }
    }
    if (geo.hearth) {
      A.hearth(ctx, geo.hearth.x, geo.hearth.y, geo.hearth.r, s.reduced ? 0 : s.time, Boolean(sim.hearthLit));
      if (sim.hearthLit && !s.reduced) {
        // The kettle is on: a thread of steam.
        ctx.save(); ctx.strokeStyle = P.paper[2]; ctx.lineWidth = 1; ctx.lineCap = "round";
        for (let index = 0; index < 2; index += 1) {
          const k = ((s.time / 1600) + index * 0.5) % 1, x = geo.hearth.x + 38 + Math.sin(k * 6 + index) * 2, y = geo.hearth.y - 2 - k * 18;
          ctx.globalAlpha = 0.5 * (1 - k); ctx.beginPath(); ctx.arc(x, y, 2 + k * 2, Math.PI * 0.2, Math.PI * 1.3); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  function belowLights(geo, s) {
    const sim = s.sim, list = [];
    let ambient = { color: [10, 7, 5], alpha: 0.5 };
    if (geo.id === "slip") list.push({ x: 160, y: -40, r: 90, strength: 0.6, warm: 0.4 });
    if (geo.id === "hem") list.push({ x: 101, y: 30, r: 120, strength: 0.75, warm: 0.5 });
    if (geo.id === "clatter") { list.push({ x: 290, y: 40, r: 60, strength: 0.5, warm: 0.4 }); list.push({ x: 176, y: 90, r: 70, strength: 0.35 }); }
    if (geo.id === "queue") { list.push({ x: 123, y: 26, r: 90, strength: 0.65, warm: 0.4 }); list.push({ x: 160, y: 0, r: 40, strength: 0.4, warm: 0.6 }); }
    if (geo.hearth) {
      const lit = Boolean(sim.hearthLit), t = s.reduced ? 0 : s.time;
      const breathe = lit ? 1 + Math.sin(t / 180) * 0.025 + Math.sin(t / 67) * 0.015 : 1;
      // The sanctuary: one warm pool around the fire and the bench; the corners stay dark.
      list.push({ x: geo.hearth.x - 10, y: geo.hearth.y + 12, r: (lit ? 150 : 50) * breathe, strength: lit ? 1.2 : 0.4, warm: lit ? 1 : 0.4, flat: 0.62 });
      ambient = { color: lit ? [14, 7, 4] : [8, 7, 8], alpha: lit ? 0.55 : 0.55 };
    }
    if (geo.id === "porter") {
      ambient = { color: [8, 6, 6], alpha: 0.54 };
      const porterEnemy = sim.enemies.find(enemy => enemy.kind === "porter");
      if (porterEnemy) list.push({ x: porterEnemy.x, y: porterEnemy.y - 10, r: porterEnemy.state === "settled" ? 50 : 96, strength: 0.85, warm: 0.6 });
      if (sim.flags?.porterDown) list.push({ x: 180, y: 20, r: 170, strength: 1.1, warm: 0.9 });
      if (sim.flags?.alcoveOpen) list.push({ x: 24, y: 142, r: 50, strength: 0.8, warm: 0.7 });
    }
    return { ambient, list };
  }

  const THEMES = {
    curb: { paintStatic: curbStatic, paintDynamic: curbDynamic, lights: curbLights },
    van: { paintStatic: vanStatic, paintUnder: vanUnder, paintDynamic: vanDynamic, lights: vanLights, transparent: true },
    road: { paintStatic: roadStatic, paintDynamic: roadDynamic, lights: roadLights },
    drain: { paintStatic: drainStatic, paintDynamic: drainDynamic, lights: drainLights }
  };
  const BELOW_THEME = { paintStatic: belowStatic, paintDynamic: belowDynamic, lights: belowLights };
  const themeOf = geo => THEMES[geo.theme] || BELOW_THEME;

  return Object.freeze({
    themeOf,
    paintStatic: (c, geo, margin) => themeOf(geo).paintStatic(c, geo, margin),
    paintUnder: (ctx, geo, s) => themeOf(geo).paintUnder?.(ctx, geo, s),
    paintDynamic: (ctx, geo, s) => themeOf(geo).paintDynamic?.(ctx, geo, s),
    lights: (geo, s) => themeOf(geo).lights(geo, s),
    transparent: geo => Boolean(themeOf(geo).transparent)
  });
});
