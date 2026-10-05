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
    car      a parked car in the rain, nose to a bright late store; YOU inside it
    sack     black, and his own glow through a pillowcase
    van      somebody's dirty van: cans, a cup, a swapped door, the road below
    roadside a tiny flame beside an endless road; far-off lit windows
    drain    shelter that slowly stops being a city pipe: concrete, brick, rock
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
  // ---- the car: the Keeper's car, parked nose-in at the late store
  const CAR = Object.freeze({ body: "#3f5d72", side: "#2d4456", top: "#5a7b91", trim: "#1d2b36" });
  function storefront(c, geo, m) {
    const L = -m.mx, R = geo.w + m.mx, T = -m.my, B = geo.h + m.my;
    // Far: the flat above the shop. No ink out there.
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
    rect(c, P.metal[1], 8, T, 5, 96 - T); rect(c, P.metal[2], 8, T, 1.4, 96 - T); tape(c, 10.5, 34, 9, 1.45, 3); tape(c, 10.5, 38, 8, 1.6, 4);
    // Fascia sign: FOOD · ICE · LOTTO, one letter dead.
    box(c, 20, 1, 320, 19, P.night[2], { ink: 1.2, amp: 0.3 });
    label(c, "FOOD · ICE · LOTTO", 180, 15, { size: 10, color: P.fluoro[2], shadow: P.ink, spacing: 1.2 });
    alpha(c, 0.75, () => rect(c, P.night[2], 236, 5, 7, 12));
    for (const [x, w] of [[0, 30], [142, 12], [198, 16], [330, 30]]) { rect(c, P.concrete[1], x, 20, w, 76); rect(c, P.concrete[2], x, 20, w, 2); rect(c, P.concrete[0], x + w - 1.5, 20, 1.5, 76); }
    storeWindow(c, 30, 22, 112, 66, 1, { poster: [82, 18] });
    storeWindow(c, 214, 22, 116, 66, 2, { counter: true });
    box(c, 154, 26, 44, 70, P.metal[2], { ink: 1.4, amp: 0.3 });
    rect(c, P.metal[1], 30, 88, 112, 8); rect(c, P.metal[1], 214, 88, 116, 8);
    rect(c, P.ink, 30, 88, 112, 1); rect(c, P.ink, 214, 88, 116, 1);
  }
  function carBody(c) {
    // Top-down, roof cut away, nose to the store.
    drop(c, 180, 258, 66, 122, 0.5);
    // Wheels peeking past the body at the four corners.
    for (const [x, y] of [[119, 152], [233, 152], [119, 326], [233, 326]]) { box(c, x, y, 8, 30, P.ink, { ink: false, amp: 0.2 }); rect(c, P.metal[1], x + 2, y + 4, 4, 22); }
    // The body: a sedan's outline, slightly pinched at the windshield.
    shape(c, [132, 136, 228, 136, 236, 146, 237, 196, 236, 340, 233, 372, 226, 378, 134, 378, 127, 372, 124, 340, 123, 196, 124, 146], CAR.body, { ink: 2, seed: 701, amp: 0.25 });
    shape(c, [124, 146, 132, 136, 140, 136, 134, 150, 133, 370, 127, 372, 124, 340, 123, 196], CAR.side, { ink: false, seed: 702, amp: 0.2 });
    // Hood: a crease down the middle, wipers resting on the glass.
    rect(c, CAR.top, 140, 140, 80, 2);
    line(c, 180, 140, 180, 174, CAR.side, 1, 11, 0.2);
    // Headlights at the nose (they face the store), a grille, a plate.
    for (const x of [130, 214]) { box(c, x, 137, 16, 5, P.fluoro[1], { ink: 1, amp: 0.2 }); rect(c, P.fluoro[2], x + 2, 138, 12, 1.4); }
    box(c, 166, 136, 28, 4, P.ink, { ink: false, amp: 0.1 });
    // Side mirrors.
    box(c, 112, 192, 12, 7, CAR.side, { ink: 1.2, amp: 0.2 }); box(c, 236, 192, 12, 7, CAR.side, { ink: 1.2, amp: 0.2 });
    // Windshield (its wet surface is live).
    shape(c, [140, 177, 220, 177, 227, 198, 133, 198], P.wet[1], { ink: 1.4, seed: 703, amp: 0.2 });
    for (const x of [150, 186]) line(c, x, 196, x + 24, 192, P.ink, 1.3, x, 0.1);
    // The cabin floor and the dark under the dash (his footwell).
    rect(c, P.cloth[1], 138, 198, 84, 130);
    rect(c, P.cloth[0], 188, 208, 32, 18);
    // Doors: inside panels, armrests, the thin side glass.
    for (const [x, glass] of [[124, 136], [220, 220]]) {
      rect(c, CAR.trim, x, 198, 16, 130);
      rect(c, P.cloth[2], x + (x < 180 ? 2 : 4), 206, 10, 116);
      box(c, x + (x < 180 ? 4 : 6), 236, 6, 22, P.cloth[3], { ink: 0.8, amp: 0.2 });
      rect(c, P.wet[1], glass, 204, 4, 120);
      line(c, x, 266, x + 16, 266, P.ink, 0.9);
    }
    // Dash: instruments glow on YOU's side, vents, a phone mount left empty.
    box(c, 138, 198, 84, 10, P.ink, { ink: 1, amp: 0.1 });
    oval(c, 157, 203, 6, 2.6, P.service[2], true, 0.6); oval(c, 157, 203, 3, 1.3, P.service[3]);
    for (const x of [176, 186, 200]) rect(c, P.cloth[2], x, 201, 6, 3);
    // The wheel, seen from above at an angle.
    oval(c, 157, 214, 11, 4.2, null, true, 2.2);
    line(c, 147, 214, 167, 214, P.ink, 1.4);
    // Front seats: cushion, then seatback and headrest toward the rear.
    for (const x of [144, 188]) {
      box(c, x, 226, 30, 28, P.cloth[2], { ink: 1.3, amp: 0.3, seed: x });
      rect(c, P.cloth[3], x + 3, 228, 24, 2);
      box(c, x + 1, 254, 28, 14, P.cloth[3], { ink: 1.3, amp: 0.3, seed: x + 1 });
      box(c, x + 8, 266, 14, 6, P.cloth[2], { ink: 1, amp: 0.2, seed: x + 2 });
    }
    // Console: two cupholders, the gearstick, a crumpled receipt.
    box(c, 175, 214, 11, 58, P.cloth[0], { ink: 1, amp: 0.2 });
    oval(c, 180.5, 224, 3, 3, P.ink); oval(c, 180.5, 233, 3, 3, P.ink);
    oval(c, 180.5, 248, 2.2, 2.2, P.metal[2], true, 0.8);
    shape(c, [177, 260, 184, 258, 185, 264, 178, 266], P.paper[2], { ink: 0.6, amp: 0.5 });
    // Back bench, its seams, a folded blanket.
    box(c, 140, 286, 80, 40, P.cloth[2], { ink: 1.3, amp: 0.3, seed: 704 });
    for (const x of [166, 194]) line(c, x, 288, x, 324, P.cloth[1], 0.9, x, 0.1);
    box(c, 196, 296, 18, 14, P.a.maroon, { ink: 1, amp: 0.4 }); rect(c, P.a.maroonLight, 197, 297, 16, 2);
    // Rear window, trunk lid, and the rear face with its taillights.
    shape(c, [138, 328, 222, 328, 218, 346, 142, 346], P.wet[1], { ink: 1.3, seed: 705, amp: 0.2 });
    rect(c, CAR.top, 140, 348, 80, 2);
    box(c, 127, 368, 106, 10, CAR.side, { ink: 1.4, amp: 0.2 });
    for (const x of [130, 218]) box(c, x, 369, 12, 5, P.a.red, { ink: 0.8, amp: 0.1 });
    box(c, 168, 369, 24, 6, P.paper[2], { ink: 0.8, amp: 0.1 });
  }
  function carStatic(c, geo, m) {
    const W = geo.w, L = -m.mx, R = W + m.mx, B = geo.h + m.my;
    storefront(c, geo, m);
    // Sidewalk: a narrow wet strip and a dry one under the awning.
    A.concrete(c, 0, 96, W, 38, "curb", { wet: true, joint: 40 });
    alpha(c, 0.45, () => rect(c, P.concrete[2], 116, 96, 124, 26));
    alpha(c, 0.12, () => { for (const [x, w] of [[30, 112], [214, 116]]) shape(c, [x, 96, x + w, 96, x + w + 10, 134, x - 10, 134], P.fluoro[1], { ink: false }); });
    for (let x = 112, index = 0; x < 244; x += 11, index += 1) shape(c, [x, 90, x + 11, 90, x + 11, 101 + (index % 2), x + 5.5, 103, x, 101], index % 2 ? P.a.red : P.paper[2], { ink: false, seed: x, amp: 0.3 });
    rect(c, P.ink, 112, 89, 132, 1.4);
    tape(c, 186, 95, 8, 0.4, 5);
    // Bin and the ice chest (it hums).
    drop(c, 38, 126, 12, 3.5);
    box(c, 28, 104, 20, 22, P.metal[1], { ink: 1.2, amp: 0.4 });
    for (let x = 31; x < 47; x += 3) rect(c, P.metal[0], x, 106, 1, 19);
    box(c, 296, 100, 34, 26, P.paper[2], { ink: 1.4, amp: 0.4 });
    box(c, 299, 105, 28, 8, P.a.umbrella, { ink: 0.8, amp: 0.2 });
    label(c, "ICE", 313, 112, { size: 7, color: P.paper[3] });
    // Curb, chipped yellow.
    rect(c, P.concrete[3], 0, 132, W, 4); rect(c, P.concrete[1], 0, 136, W, 2);
    for (let x = 4; x < W; x += 22) if ((x / 22) % 3 !== 1) rect(c, P.a.mustard, x, 132.5, 15, 2);
    // The lot: wet asphalt, faded stall lines, OPEN in a puddle.
    A.asphalt(c, L, 138, R - L, B - 138, "street");
    for (const x of [100, 260]) for (let y = 142; y < 384; y += 10) rect(c, P.paper[1], x, y, 2, 6);
    alpha(c, 0.16, () => { const smear = rng("smear"); for (const [x0, x1] of [[34, 140], [218, 328]]) for (let x = x0 + 6; x < x1; x += 14 + smear() * 12) box(c, x, 140 + smear() * 6, 2 + smear() * 3, 18 + smear() * 30, P.fluoro[2], { ink: false, amp: 0.8 }); });
    oval(c, 58, 214, 22, 8, P.wet[0]); oval(c, 54, 212.5, 14, 4.2, P.wet[1]);
    carBody(c);
  }
  // YOU, small, inside the lit store: no umbrella in here, still never a face.
  function youInside(ctx, x, footY, o = {}) {
    ctx.save();
    ctx.translate(x, footY); ctx.scale(0.5, 0.5);
    rect(ctx, P.a.denim, -5, -34, 4, 32); rect(ctx, P.a.denim, 1, -34, 4, 32);
    shape(ctx, [-11, -76, 10, -76, 13, -32, -13, -31], P.wood[2], { ink: 1.6, seed: 11, amp: 0.3 });
    shape(ctx, [-6, -80, 6, -80, 7, -74, -7, -74], P.a.maroon, { ink: 1.1, seed: 13, amp: 0.3 });
    // Back turned (at the counter), the head is only hair. Never a face: facing out, it stays in shadow.
    oval(ctx, 0, -86, 6.5, 7, o.back ? P.inkSoft : P.skin[0], true, 1.4);
    oval(ctx, 0, -90, 6.4, 3.6, P.inkSoft);
    if (!o.back) { ctx.globalAlpha = 0.6; oval(ctx, 0, -85, 6, 4, P.ink); ctx.globalAlpha = 1; }
    if (o.back) { shape(ctx, [10, -74, 18, -62, 15, -60, 8, -70], P.wood[2], { ink: 1.1, amp: 0.2 }); }
    // Checking on the car: one hand up, a small wave.
    if (o.wave) {
      const w = Math.sin((o.t || 0) / 140) * 4;
      shape(ctx, [8, -72, 13, -74, 16 + w * 0.3, -96, 11 + w * 0.3, -97], P.wood[2], { ink: 1.2, amp: 0.2 });
      oval(ctx, 14 + w, -101, 3.4, 3.6, P.skin[1], true, 1.1);
    }
    ctx.restore();
  }
  function carDynamic(ctx, geo, s) {
    const room = s.extras.room || {}, t = s.time, now = s.extras.sceneTime || 0, p = s.pos;
    const flicker = s.reduced ? 1 : (Math.sin(t / 170) > -0.9 ? 1 : 0.3) * (Math.sin(t / 2300) > -0.97 ? 1 : 0.4);
    // The store door, its bell, OPEN in neon (and in the puddle).
    if (room.storeDoorOpen) { rect(ctx, P.fluoro[2], 156, 28, 40, 66); rect(ctx, P.fluoro[1], 156, 80, 40, 14); box(ctx, 156, 28, 8, 66, P.metal[2], { ink: 1, amp: 0.2 }); }
    else { rect(ctx, P.fluoro[1], 156, 28, 40, 66); rect(ctx, P.fluoro[0], 156, 76, 40, 18); rect(ctx, P.metal[3], 160, 60, 32, 2.6); rect(ctx, P.ink, 160, 62.6, 32, 0.8); label(ctx, "PULL", 176, 54, { size: 5, color: P.a.red }); }
    oval(ctx, 176, 24, 2.2, 2, P.a.brass, true, 0.8);
    // YOU in the store: between the aisles, or at the counter with YOU's back to the window.
    const you = room.youCounter ? { x: 296, visible: true, back: true } : room.you;
    if (you?.visible) {
      const window = you.x < 150 ? [30, 22, 112, 66] : [214, 22, 116, 66];
      A.clip(ctx, window[0] + 1, window[1] + 1, window[2] - 2, window[3] - 2, () => youInside(ctx, you.x, 92, { back: you.back, wave: you.wave, t: s.reduced ? 0 : t }));
    }
    ctx.save();
    ctx.globalAlpha = 0.35 * flicker; ctx.font = "900 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.strokeStyle = P.a.neon; ctx.lineWidth = 3; ctx.strokeText("OPEN", 72, 48);
    ctx.globalAlpha = flicker; ctx.fillStyle = "#ffd0d6"; ctx.fillText("OPEN", 72, 48);
    ctx.globalAlpha = 0.45 * flicker; ctx.fillStyle = P.a.neon;
    for (let index = 0; index < 5; index += 1) { const wob = s.reduced ? 0 : Math.sin(t / 260 + index) * 1.4; ctx.fillRect(44 + index * 6 + wob, 211 + (index % 2), 4, 1.2); }
    ctx.restore();
    if (!s.reduced) for (let x = 118, index = 0; x < 242; x += 13, index += 1) { const k = ((t / 520) + index * 0.29) % 1; rect(ctx, P.wet[3], x, 103 + k * 26, 0.9, 2.4); }
    // Rain on the glass: drops landing, a few trails running; his breath fogs it where he presses close.
    const glass = [[140, 177, 87, 21], [138, 328, 84, 18], [136, 204, 4, 120], [220, 204, 4, 120]];
    for (const [gx, gy, gw, gh] of glass) {
      const count = Math.round((gw * gh) / 70);
      for (let index = 0; index < count; index += 1) {
        const seed = index * 7.13 + gx;
        const k = s.reduced ? 0.5 : ((t / 1400) + (Math.sin(seed) + 1) * 0.5) % 1;
        const x = gx + ((Math.sin(seed * 3.1) + 1) / 2) * gw, y = gy + ((Math.sin(seed * 1.7) + 1) / 2) * gh;
        alpha(ctx, (1 - k) * 0.8, () => rect(ctx, P.wet[3], x, y + (index % 4 === 0 ? k * 6 : 0), 0.9, index % 4 === 0 ? 2.2 + k * 3 : 0.9));
      }
    }
    if ((room.fog || 0) > 0.02) alpha(ctx, room.fog * 0.45, () => { oval(ctx, room.fogX || p.x, 190, 16, 7, P.paper[3]); oval(ctx, (room.fogX || p.x) - 4, 191, 9, 4, P.paper[3]); });
    // YOU's blue umbrella, leaning by the driver's door until YOU takes it.
    if (!room.youOut) {
      ctx.save(); ctx.translate(141, 288); ctx.rotate(-0.12);
      box(ctx, -2.6, -34, 5.2, 34, P.a.umbrella, { ink: 1.2, amp: 0.2 });
      rect(ctx, P.a.umbrellaLight, -1.6, -32, 1.4, 28);
      line(ctx, 0, -34, 0, -40, P.ink, 1.2);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(2.6, 2, 2.6, Math.PI, 0, true); ctx.stroke();
      ctx.restore();
    }
    // The driver's door open (YOU going), the passenger door forced (them).
    if (room.driverDoor) { rect(ctx, P.ink, 124, 206, 14, 60); ctx.save(); ctx.translate(124, 206); ctx.rotate(-0.85); box(ctx, -16, 0, 16, 60, CAR.side, { ink: 1.4, amp: 0.2 }); ctx.restore(); }
    if (room.passengerDoor) {
      const k = Math.min(1, (now - room.passengerDoor) / 260);
      rect(ctx, P.ink, 222, 206, 14, 60);
      ctx.save(); ctx.translate(236, 206); ctx.rotate(0.95 * k); box(ctx, 0, 0, 16, 60, CAR.side, { ink: 1.4, amp: 0.2 }); rect(ctx, P.wet[2], 2, 2, 3, 56); ctx.restore();
      if (!s.reduced) alpha(ctx, 0.6, () => { for (let index = 0; index < 8; index += 1) { const y = 210 + ((t / 5 + index * 17) % 56); line(ctx, 238, y, 226, y + 4, P.wet[3], 0.8, index, 0); } });
    }
    // The dome light, when it is on.
    if ((room.dome || 0) > 0.02) alpha(ctx, room.dome, () => { box(ctx, 174, 276, 12, 6, P.paper[3], { ink: 0.8, amp: 0.1 }); });
    // Hands, reaching in through the forced door.
    if (room.hands) {
      const h = room.hands;
      line(ctx, 250, 244, h.x + 4, h.y - 2, P.ink, 9, 3, 0.2); line(ctx, 250, 244, h.x + 4, h.y - 2, P.cloth[1], 6.4, 3, 0.2);
      oval(ctx, h.x, h.y, 5.5, 4.5, P.cloth[0], true, 1.2);
      for (let f = -2; f <= 2; f += 2) line(ctx, h.x - 2, h.y + f, h.x - 7, h.y + f * 1.4, P.ink, 1.6, f, 0);
    }
    // The pillowcase coming down over him.
    if (room.bagAt != null) {
      const k = Math.min(1, (now - room.bagAt) / 400);
      const top = p.y - 40 + k * 26;
      shape(ctx, [p.x - 15, top, p.x + 15, top - 2, p.x + 17, p.y + 8, p.x - 16, p.y + 9], P.a.white, { ink: 1.6, amp: 0.8 });
      rect(ctx, P.a.denim, p.x - 14, top + 6, 28, 2);
    }
  }
  function carLights(geo, s) {
    const room = s.extras.room || {}, now = s.extras.sceneTime || 0, list = [
      { x: 86, y: 100, r: 120, strength: 0.95, flat: 0.55 },
      { x: 272, y: 100, r: 124, strength: 0.95, flat: 0.55 },
      { x: 72, y: 60, r: 40, strength: 0.6, warm: 0.4 }
    ];
    if (room.storeDoorOpen) list.push({ x: 176, y: 100, r: 70, strength: 1 });
    if (room.youCounter) list.push({ x: 296, y: 70, r: 50, strength: 0.6 });
    if ((room.dome || 0) > 0.02) list.push({ x: 180, y: 268, r: 92, strength: 0.85 * room.dome, warm: 0.7 * room.dome });
    // The little flame lights the ceiling.
    if (room.flashAt != null && now - room.flashAt < 450) list.push({ x: 180, y: 262, r: 100, strength: 0.8 * (1 - (now - room.flashAt) / 450), warm: 0.8 });
    // Headlights sweep the cabin left to right (with reduced motion: they brighten and fade).
    if (room.sweepAt != null && now - room.sweepAt < 3200) {
      const k = (now - room.sweepAt) / 3200;
      if (s.reduced) list.push({ x: 180, y: 300, r: 150, strength: Math.sin(k * Math.PI) * 0.9 });
      else list.push({ x: 90 + k * 200, y: 300 - Math.sin(k * Math.PI) * 30, r: 130, strength: 0.95 });
    }
    const vanActor = (s.extras.npcs || []).find(actor => actor.id === "van");
    if (room.vanLights && vanActor) list.push({ x: vanActor.x + 110, y: vanActor.y - 26, r: 90, strength: 0.8 });
    if (room.passengerDoor) list.push({ x: 238, y: 236, r: 46, strength: 0.4 });
    const small = (s.extras.npcs || []).find(actor => actor.kind === "hood-small");
    if (small) list.push({ x: small.x + 17 * (small.face || 1), y: small.y - 50, r: 28, strength: 0.7 });
    return { ambient: { color: [8, 11, 20], alpha: 0.6 }, list };
  }

  // ---- the sack: black, and his glow through the weave
  function sackStatic(c, geo, m) { rect(c, P.void, -m.mx, -m.my, geo.w + m.mx * 2, geo.h + m.my * 2); }
  function sackOver(ctx, geo, s) {
    const room = s.extras.room || {}, now = s.extras.sceneTime || 0, p = s.pos, t = s.reduced ? 0 : s.time;
    if (room.freedAt != null && now - room.freedAt > 300) return;
    const burst = room.burstAt != null ? Math.max(0, 1 - (now - room.burstAt) / 300) : 0;
    const dir = room.burstDir || { x: 0, y: -1 };
    const tremble = s.reduced ? 0 : Math.sin(t / 37) * 0.8;
    const bx = p.x + tremble + dir.x * burst * 5, by = p.y + dir.y * burst * 5;
    ctx.save();
    // Drawn large: on a phone the sack is the whole picture.
    ctx.translate(bx, by); ctx.scale(1.9, 1.9); ctx.translate(-bx, -by);
    const glow = ctx.createRadialGradient(bx, by - 4, 2, bx, by - 4, 30);
    glow.addColorStop(0, "rgba(255,186,96,.95)"); glow.addColorStop(0.45, "rgba(196,104,44,.55)"); glow.addColorStop(1, "rgba(40,20,10,0)");
    // The cloth: a pillowcase drawn tight around him, the open end twisted shut above.
    const pts = [bx - 22, by + 14, bx - 24 - burst * 3 * Math.abs(dir.x), by - 10, bx - 14, by - 28, bx - 4, by - 34, bx + 4, by - 34, bx + 14, by - 28, bx + 24 + burst * 3 * Math.abs(dir.x), by - 10, bx + 22, by + 14];
    shape(ctx, pts, "#3b2717", { ink: 1.6, amp: 0.6, seed: 801 });
    ctx.save(); ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(bx, by - 6, 24, 24, 0, 0, TAU); ctx.fill();
    // His shape pressing the cloth from inside: a flame's outline, brighter.
    ctx.fillStyle = "rgba(255,214,140,.55)";
    ctx.beginPath(); ctx.moveTo(bx - 9, by + 8); ctx.quadraticCurveTo(bx - 11, by - 8, bx - 1, by - 22 - burst * 4); ctx.quadraticCurveTo(bx + 11, by - 8, bx + 9, by + 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Folds catching the light at the edges.
    ctx.globalAlpha = 0.5; line(ctx, bx - 18, by - 14, bx - 13, by + 10, P.paper[1], 1, 5, 0.6); line(ctx, bx + 17, by - 12, bx + 12, by + 10, P.paper[1], 1, 6, 0.6); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.3; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.6;
    for (let d = -24; d <= 24; d += 3) { ctx.beginPath(); ctx.moveTo(bx + d, by - 34); ctx.lineTo(bx + d, by + 14); ctx.stroke(); }
    ctx.globalAlpha = 0.6; stitches(ctx, bx - 20, by + 12, bx + 20, by + 12, P.paper[1], 4, 1.6, 0.7);
    ctx.globalAlpha = 1;
    line(ctx, bx - 4, by - 34, bx + 4, by - 40, P.paper[1], 2.2, 3, 0.4);
    ctx.restore();
  }
  function sackLights() { return { ambient: { color: [0, 0, 0], alpha: 0.96 }, list: [] }; }

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
    // The embankment edge, and the ditch along it: the darkest ground by the road.
    rect(c, P.grass[0], 0, 0, 22, geo.h); rect(c, P.grass[2], 21, 0, 1.4, geo.h);
    alpha(c, 0.75, () => { rect(c, P.ink, 22, 26, 30, geo.h - 40); rect(c, P.grass[0], 50, 26, 3, geo.h - 40); });
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
    const room = s.extras.room || {};
    const bowlProp = geo.props.find(prop => prop.id === "bowl-road");
    if (bowlProp) A.bowl(ctx, bowlProp.x, bowlProp.y, { water: true, t: s.reduced ? null : s.time });
    // The dropped phone, face up in the grass.
    const phone = room.phone;
    if (phone) {
      ctx.save(); ctx.translate(phone.x, phone.y); ctx.rotate(-0.3);
      drop(ctx, 0, 4, 6, 2);
      box(ctx, -3.5, -6, 7, 12, P.ink, { ink: 1, amp: 0.1 });
      const lit = phone.state === "connected" || (phone.state === "ringing" && (phone.ringing || s.reduced));
      rect(ctx, lit ? P.fluoro[2] : P.cloth[1], -2.5, -5, 5, 10);
      ctx.restore();
      if (phone.state === "ringing" && phone.ringing && !s.reduced) alpha(ctx, 0.5, () => { const k = (s.time / 500) % 1; ctx.strokeStyle = P.fluoro[2]; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(phone.x, phone.y, 6 + k * 10, (6 + k * 10) * 0.5, 0, 0, TAU); ctx.stroke(); });
    }
    // A car on the road that is not YOU: a dark shape behind its own lights.
    if (room.pass) {
      const y = room.pass.y;
      box(ctx, 236, y - 6, 30, 52, P.night[2], { ink: 1.4, amp: 0.2 });
      rect(ctx, P.wet[1], 240, y + 4, 22, 10);
      for (const x of [238, 258]) rect(ctx, P.fluoro[2], x, y - 6, 6, 3);
      for (const x of [238, 258]) rect(ctx, P.a.red, x, y + 44, 6, 2);
    }
  }
  // The search beam and a passing car's light read on top of the dark.
  function roadOver(ctx, geo, s) {
    const room = s.extras.room || {};
    const beam = room.beam;
    if (beam) {
      const stopped = room.beamStop && (s.extras.sceneTime || 0) < room.beamStop.until;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const grad = ctx.createRadialGradient(beam.x, beam.y, 4, beam.x, beam.y, beam.length);
      grad.addColorStop(0, `rgba(255,250,228,${stopped ? 0.5 : 0.32})`); grad.addColorStop(1, "rgba(255,250,228,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.arc(beam.x, beam.y, beam.length, beam.angle - beam.half, beam.angle + beam.half); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Shadow keeps its edge even in the beam: the ditch and the lee of the posts stay dark.
      alpha(ctx, 0.35, () => { for (const r of geo.hides || []) if (Math.hypot(r.x + r.w / 2 - beam.x, r.y + r.h / 2 - beam.y) < beam.length + 30) rect(ctx, P.ink, r.x, r.y, r.w, r.h); });
      // The phone in his hand.
      rect(ctx, P.fluoro[2], beam.x - 1.5, beam.y - 2, 3, 3);
    }
    if (room.pass && !s.reduced) {
      const y = room.pass.y;
      alpha(ctx, 0.18, () => shape(ctx, [236, y - 6, 268, y - 6, 300, y - 150, 190, y - 150], P.fluoro[2], { ink: false }));
    }
  }
  function roadLights(geo, s) {
    const room = s.extras.room || {};
    const list = (geo.lights || []).map(light => ({ x: light.x + 26, y: light.y + 2, r: 110, strength: 0.85, warm: 0.5, flat: 0.55 }));
    list.push({ x: 112, y: 590, r: 46, strength: 0.6 });
    list.push({ x: 100, y: 16, r: 44, strength: 0.4, warm: 0.6 });
    for (const actor of s.extras.npcs || []) if (actor.kind === "taillights") list.push({ x: actor.x, y: actor.y, r: room.brake ? 70 : 50, strength: room.brake ? 0.8 : 0.6, warm: 0.3 });
    if (room.beam) list.push({ x: room.beam.x, y: room.beam.y, r: room.beam.length, strength: 1, cone: { angle: room.beam.angle, half: room.beam.half } });
    const phone = room.phone;
    if (phone && (phone.state === "connected" || (phone.state === "ringing" && (phone.ringing || s.reduced)))) list.push({ x: phone.x, y: phone.y, r: 38, strength: 0.75 });
    if (room.pass) list.push({ x: 251, y: room.pass.y - 40, r: 150, strength: 0.95, flat: 0.9 });
    return { ambient: { color: [5, 7, 12], alpha: 0.6, shades: (geo.hides || []).map(r => ({ ...r, alpha: 0.18 })) }, list };
  }

  // ---- the drain: shelter that stops being a city pipe, then stops being a pipe
  function drainStatic(c, geo, m) {
    const L = -m.mx, R = geo.w + m.mx, T = -m.my, B = geo.h + m.my;
    rect(c, P.void, L, T, R - L, B - T);
    const random = rng("drain");
    // Concrete at the mouth.
    A.concrete(c, 42, 500, 156, 260, "drain-floor", { joint: 38 });
    // Then old brick, laid by hand, the courses not quite level.
    rect(c, P.plaster[1], 42, 240, 156, 260);
    for (let y = 242, row = 0; y < 500; y += 7, row += 1) for (let x = 42 + (row % 2) * 6; x < 198; x += 12) rect(c, random() < 0.2 ? P.plaster[0] : P.plaster[2], x + 0.6, y + 0.6 + Math.sin(x / 30 + row) * 0.6, 10.8, 5.8);
    alpha(c, 0.8, () => { for (let y = 480; y < 520; y += 3) rect(c, P.concrete[1], 42, y, 156, (y - 480) / 14); });
    // Then rock, older than any of it: the floor uneven, the light gone ochre.
    rect(c, P.below[2], 62, 30, 116, 210);
    for (let index = 0; index < 60; index += 1) { const x = 62 + random() * 116, y = 30 + random() * 210, r = 2 + random() * 5; oval(c, x, y, r, r * 0.6, random() < 0.5 ? P.below[3] : P.below[1]); }
    alpha(c, 0.7, () => { for (let y = 226; y < 262; y += 3) rect(c, P.plaster[1], 62, y, 116, (y - 226) / 12); });
    // The trickle runs the wrong way: from the mouth inward, all the way to the back.
    const trickle = [120, 752, 118, 640, 122, 520, 117, 400, 121, 280, 116, 170, 122, 90];
    A.trace(c, trickle, 7, 1, false); A.inkStroke(c, 3.4, P.wet[1]);
    A.trace(c, trickle, 7, 1, false); A.inkStroke(c, 1, P.wet[2]);
    // Wet leaves and grit at the mouth.
    for (let index = 0; index < 26; index += 1) { const x = 48 + random() * 144, y = 700 + random() * 48; shape(c, [x, y, x + 3, y - 1.6, x + 5, y + 0.6, x + 2, y + 1.6], random() < 0.5 ? P.wood[2] : P.grass[3], { ink: false, seed: index, amp: 0.3 }); }
    // Walls: concrete with a tag and moss; brick with roots; then raw rock.
    for (const [x, edge] of [[0, 40.8], [198, 198]]) {
      rect(c, P.concrete[1], x, 500, 42, 260); rect(c, P.concrete[2], edge, 500, 1.2, 260);
      rect(c, P.plaster[0], x, 240, 42, 260); rect(c, P.plaster[2], edge, 240, 1.2, 260);
      for (let y = 244, row = 0; y < 500; y += 8, row += 1) rect(c, P.plaster[1], x + 2 + (row % 2) * 5, y, 36, 1);
      alpha(c, 0.6, () => { for (let y = 520; y < 760; y += 70) rect(c, P.grass[2], x + (x ? 2 : 32), y, 8, 26); });
    }
    alpha(c, 0.7, () => { A.trace(c, [8, 660, 18, 652, 26, 662, 34, 650], 1, 0.6, false); A.inkStroke(c, 1.6, P.a.umbrellaLight); });
    for (let index = 0; index < 6; index += 1) { const y = 260 + index * 36; A.trace(c, [40, y, 52, y + 6, 58, y + 18], index, 1, false); A.inkStroke(c, 1, P.wood[1]); A.trace(c, [200, y + 12, 188, y + 20, 184, y + 30], index + 9, 1, false); A.inkStroke(c, 1, P.wood[1]); }
    // Where the brick ends the seams are stitched, not mortared.
    for (let index = 0; index < 3; index += 1) { const y = 250 + index * 26; stitches(c, 50, y, 190, y + 4, P.paper[1], 6, 1.6, 0.8); }
    for (const solid of geo.solids) {
      if (solid.kind !== "rock") continue;
      rect(c, P.below[1], solid.x, solid.y, solid.w, solid.h);
      const rocks = rng(`rock${solid.id}`);
      for (let index = 0; index < Math.max(3, (solid.w * solid.h) / 260); index += 1) {
        const x = solid.x + rocks() * solid.w, y = solid.y + rocks() * solid.h, r = 4 + rocks() * 8;
        shape(c, [x - r, y, x - r * 0.4, y - r * 0.8, x + r * 0.6, y - r * 0.6, x + r, y + r * 0.2, x + r * 0.2, y + r * 0.7], rocks() < 0.5 ? P.below[2] : P.below[3], { ink: 1, seed: index + solid.x, amp: 0.5 });
      }
    }
    // The back: a slope of loose grit to a lip, and below the lip, nothing.
    rect(c, P.void, 82, 30, 76, 18);
    for (let index = 0; index < 30; index += 1) oval(c, 84 + random() * 72, 48 + random() * 26, 1.2, 0.8, P.below[3]);
    line(c, 82, 48, 158, 47, P.ink, 1.6, 31, 0.8);
    // The warm crack.
    shape(c, [98, 34, 112, 40, 120, 34, 130, 42, 144, 36, 138, 41, 128, 46, 118, 40, 106, 42], P.ember[1], { ink: 1.6, amp: 0.4 });
    // A shopping-trolley wheel, the dry glove.
    oval(c, 176, 724, 4, 4, P.metal[1], true, 1); oval(c, 176, 724, 1.4, 1.4, P.ink);
    shape(c, [72, 682, 80, 677, 86, 680, 88, 686, 80, 689, 74, 687], P.wood[2], { ink: 1.1, amp: 0.3 }); for (const fx of [80, 83, 86]) line(c, fx, 678, fx + 2, 674, P.wood[2], 1.4, fx, 0.1);
  }
  function drainDynamic(ctx, geo, s) {
    const room = s.extras.room || {}, now = s.extras.sceneTime || 0;
    rect(ctx, P.night[1], 42, 742, 156, 18);
    if (room.crack) {
      const k = Math.min(1, (now - room.crack) / 500), p = s.sim.player;
      for (let index = 0; index < 7; index += 1) { const a = (index / 7) * TAU + 0.3; line(ctx, p.x, p.y + 4, p.x + Math.cos(a) * 30 * k, p.y + 4 + Math.sin(a) * 16 * k, P.ink, 2, index, 1.5); }
    }
    // Grit trickling over the lip once he is on the slope.
    if (room.trickleAt != null && !s.reduced) for (let index = 0; index < 5; index += 1) { const k = ((s.time / 700) + index / 5) % 1; rect(ctx, P.below[3], 96 + index * 12, 70 - k * 30, 1.2, 1.2); }
    // Warm air from the dark: a shimmer at the edge of his light.
    if (!s.reduced) for (let index = 0; index < 4; index += 1) { const k = ((s.time / 1800) + index / 4) % 1; alpha(ctx, 0.5 * (1 - k), () => rect(ctx, P.ember[3], 108 + index * 8, 46 - k * 14, 1.2, 1.2)); }
  }
  function drainLights(geo, s) {
    const room = s.extras.room || {}, now = s.extras.sceneTime || 0;
    const list = [{ x: 120, y: 760, r: 110, strength: 0.75 }, { x: 121, y: 42, r: 60, strength: 0.55, warm: 0.9 }];
    // Once: headlights on the road sweep in through the mouth.
    if (room.sweepAt != null && now - room.sweepAt < 2600) {
      const k = (now - room.sweepAt) / 2600;
      list.push(s.reduced ? { x: 120, y: 690, r: 140, strength: Math.sin(k * Math.PI) * 0.8 } : { x: 60 + k * 120, y: 760 - Math.sin(k * Math.PI) * 160, r: 120, strength: 0.85 });
    }
    return { ambient: { color: [4, 5, 8], alpha: 0.62 }, list };
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
      default: if (SOLIDS[s.kind]) SOLIDS[s.kind](c, s, geo); else if (!s.openWhen && !s.when) rect(c, P.below[0], s.x, s.y, s.w, s.h);
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

  const SOLIDS = {};
  // ===================== THE MENDING ROWS =====================
  // Work rooms: cloth, boards, drying frames, a kept stove. Everything here is
  // being mended or about to be, and someone has written down how.
  const ROWS_FACE = { upper: P.plaster, lower: P.service, dado: 0.5, edge: P.plaster[3] };
  Object.assign(FACE, {
    receiving: { upper: P.plaster, lower: P.wood, dado: 0.5, edge: P.plaster[3] },
    drytable: { upper: [P.plaster[1], P.plaster[2], P.plaster[3], P.paper[1]], lower: P.service, dado: 0.48, edge: P.paper[1] },
    hangrow: ROWS_FACE, lowrun: { upper: P.below, lower: P.wood, dado: 0.7, edge: P.wood[3] }, eyelet: ROWS_FACE, traypass: ROWS_FACE,
    press: { upper: P.plaster, lower: P.metal, dado: 0.45, edge: P.plaster[3] }, upper: ROWS_FACE, stair: ROWS_FACE,
    windowgate: { upper: [P.below[1], P.a.maroon, P.a.maroonLight, P.paper[1]], lower: P.wood, dado: 0.55, edge: P.wood[3] }
  });
  // A hanging sheet: a rail, a cloth falling toward us, a damp darker hem.
  function sheet(c, x, y, w, h, seed, color = P.paper[2]) {
    shape(c, [x, y, x + w, y, x + w - 1, y + h - 2, x + w * 0.66, y + h, x + w * 0.33, y + h - 1.5, x + 1, y + h], color, { ink: 1, seed, amp: 0.6 });
    alpha(c, 0.5, () => rect(c, P.paper[0], x + 1.5, y + h - 4, w - 3, 3));
    for (let k = 1; k < 3; k += 1) line(c, x + (w * k) / 3, y + 2, x + (w * k) / 3 + 0.6, y + h - 3, P.paper[1], 0.6, seed + k, 0.3);
  }
  function workBench(c, s, cloth = true) {
    drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2 + 2, 4);
    box(c, s.x, s.y, s.w, s.h, P.wood[2], { ink: 1.4, amp: 0.3, seed: s.x });
    rect(c, P.wood[3], s.x + 1, s.y + 1, s.w - 2, 3);
    rect(c, P.wood[1], s.x + 1, s.y + s.h - 6, s.w - 2, 5);
    for (const x of [s.x + 3, s.x + s.w - 6]) rect(c, P.wood[1], x, s.y + s.h, 3, 4);
    if (!cloth) return;
    // Mending on the table: a folded length, a pincushion, spools, shears.
    box(c, s.x + 8, s.y + 6, s.w * 0.4, s.h * 0.45, P.paper[2], { ink: 1, amp: 0.5, seed: s.y });
    stitches(c, s.x + 10, s.y + 6 + s.h * 0.22, s.x + 6 + s.w * 0.4, s.y + 6 + s.h * 0.22, P.a.maroon, 2.6, 1, 0.6);
    oval(c, s.x + s.w * 0.62, s.y + 12, 4, 3, P.a.red, true, 0.9);
    for (const [dx, color] of [[0.74, P.a.mustard], [0.8, P.service[3]], [0.86, P.a.umbrella]]) { box(c, s.x + s.w * dx, s.y + 7, 4, 6, color, { ink: 0.8, amp: 0.1 }); rect(c, P.wood[3], s.x + s.w * dx, s.y + 6, 4, 1.2); }
    line(c, s.x + s.w * 0.6, s.y + s.h * 0.62, s.x + s.w * 0.72, s.y + s.h * 0.5, P.metal[3], 1.4, 2, 0.1);
    line(c, s.x + s.w * 0.6, s.y + s.h * 0.5, s.x + s.w * 0.72, s.y + s.h * 0.62, P.metal[3], 1.4, 3, 0.1);
  }
  Object.assign(SOLIDS, {
    ledge(c, s) {
      // The receiving ledge: a sorting shelf at chest height, wet where the packet sat.
      workBench(c, s, false);
      alpha(c, 0.4, () => worn(c, s.x + 76, s.y + 16, 10, 4, P.wet[2], 0.8));
      label(c, "RECEIVING", s.x + s.w / 2, s.y + s.h - 1.5, { size: 5, color: P.paper[2] });
    },
    bench(c, s) { workBench(c, s, s.w > 70); },
    frame(c, s) {
      // A drying frame: two posts and a rail, sheets hanging off it toward us.
      for (const x of [s.x, s.x + s.w - 4]) { drop(c, x + 2, s.y + s.h + 1, 4, 2); box(c, x, s.y - 30, 4, 30 + s.h, P.wood[2], { ink: 1.1, amp: 0.1 }); }
      box(c, s.x - 2, s.y - 32, s.w + 4, 4, P.wood[3], { ink: 1.1, amp: 0.1 });
      const random = rng(`frame${s.id}`);
      for (let x = s.x + 4; x < s.x + s.w - 10; x += 16) sheet(c, x, s.y - 28, 14, 18 + random() * 8, x + s.y, random() < 0.2 ? P.service[3] : random() < 0.4 ? P.paper[1] : P.paper[2]);
    },
    block(c, s) {
      // Stacked boards in the low run: cut, numbered, waiting.
      drop(c, s.x + s.w / 2, s.y + s.h + 1, s.w / 2 + 2, 3);
      for (let y = s.y, index = 0; y < s.y + s.h; y += 10, index += 1) { box(c, s.x + (index % 2) * 2, y, s.w - 2, 10, index % 3 ? P.wood[2] : P.wood[1], { ink: 1, amp: 0.2, seed: y }); rect(c, P.wood[3], s.x + (index % 2) * 2 + 1, y + 1, s.w - 4, 1.2); }
      label(c, String(s.id.slice(-1)).toUpperCase(), s.x + s.w / 2, s.y + 12, { size: 5, color: P.paper[2] });
    },
    channel(c, s) {
      // The run-off channel: dark water moving slowly under the landing.
      rect(c, P.ink, s.x, s.y, s.w, s.h);
      rect(c, P.wet[0], s.x, s.y + 3, s.w, s.h - 3);
      for (let x = s.x + 4; x < s.x + s.w - 6; x += 18) rect(c, P.wet[1], x, s.y + 8 + (x % 3) * 3, 8, 1);
      rect(c, P.metal[1], s.x, s.y - 2, s.w, 2); rect(c, P.metal[1], s.x, s.y + s.h, s.w, 2);
    },
    balcony(c, s) {
      // Her look-out over the row: boards, a rail, a stool.
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.wood[2], { ink: 1.3, amp: 0.2 });
      for (let x = s.x + 3; x < s.x + s.w - 2; x += 6) rect(c, P.wood[1], x, s.y + s.h - 8, 1.6, 8);
      rect(c, P.wood[3], s.x, s.y + s.h - 10, s.w, 2);
      box(c, s.x + 30, s.y + 6, 10, 8, P.service[1], { ink: 0.9, amp: 0.2 });
    },
    counter(c, s) {
      // The service counter, and its window: CLOSED, and under it in older writing, BACK SOON.
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.wood[2], { ink: 1.4, amp: 0.2 });
      rect(c, P.wood[3], s.x + 1, s.y + s.h - 12, s.w - 2, 3);
      box(c, s.x + s.w / 2 - 26, s.y + 2, 52, 18, P.ink, { ink: 1.2, amp: 0.1 });
      rect(c, P.metal[1], s.x + s.w / 2 - 24, s.y + 4, 48, 14);
      for (let y = s.y + 5; y < s.y + 18; y += 2.6) rect(c, P.metal[0], s.x + s.w / 2 - 24, y, 48, 0.8);
      box(c, s.x + s.w / 2 - 15, s.y + 7, 30, 8, P.paper[3], { ink: 0.8, amp: 0.1 });
      label(c, "CLOSED", s.x + s.w / 2, s.y + 13.4, { size: 5.4, color: P.a.red, weight: 900 });
      alpha(c, 0.75, () => label(c, "back soon", s.x + s.w / 2, s.y + s.h - 3, { size: 4.2, color: P.paper[1], jitter: 0.8 }));
      // A bell on the counter.
      oval(c, s.x + s.w - 14, s.y + s.h - 5, 4, 2.4, P.a.brass, true, 1); oval(c, s.x + s.w - 14, s.y + s.h - 8, 1, 1, P.a.brassLight);
    },
    rail(c, s) {
      // A stair landing: steps behind, a rail along the edge.
      box(c, s.x, s.y, s.w, s.h, P.wood[1], { ink: 1.2, amp: 0.1 });
      rect(c, P.wood[3], s.x, s.y, s.w, 2);
      for (let x = s.x + 4; x < s.x + s.w - 2; x += 8) rect(c, P.wood[2], x, s.y - 12, 1.8, 12);
      box(c, s.x, s.y - 14, s.w, 3, P.wood[3], { ink: 1, amp: 0.1 });
    }
  });
  // Warm catches: an iron catch, rimed, that a little heat will turn.
  function warmCatch(c, prop, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t / 260);
    alpha(c, 0.35 + 0.35 * pulse, () => oval(c, prop.x, prop.y, 9, 6, P.ember[2]));
    box(c, prop.x - 5, prop.y - 4, 10, 8, P.metal[2], { ink: 1.2, amp: 0.1 });
    rect(c, P.metal[3], prop.x - 4, prop.y - 3, 8, 1.4);
    for (let index = 0; index < 3; index += 1) shape(c, [prop.x - 4 + index * 3.4, prop.y - 4, prop.x - 3 + index * 3.4, prop.y - 7, prop.x - 2 + index * 3.4, prop.y - 4], "#e8f2ff", { ink: 0.4, amp: 0.05 });
    rivet(c, prop.x, prop.y + 1, 1);
  }
  const ROWS_DECOR = {
    receiving: {
      floor(c, geo) {
        A.concrete(c, 0, 0, geo.w, geo.h, "receiving", { tone: [P.below[1], P.below[2], P.below[3], P.plaster[2]], joint: 40 });
        // Wet prints from the Porter's door to the ledge: Latch, arriving first.
        alpha(c, 0.4, () => { for (let k = 0; k < 9; k += 1) worn(c, 174 + (k % 2) * 6, 236 - k * 18, 3, 2, P.wet[2], 0.9); });
        // A trolley with a bad wheel, a sack of offcuts.
        box(c, 40, 190, 34, 18, P.metal[1], { ink: 1.1, amp: 0.2 }); for (const x of [44, 68]) oval(c, x, 210, 3, 3, P.ink); 
        shape(c, [270, 200, 290, 196, 296, 222, 268, 226], P.paper[1], { ink: 1.1, amp: 0.6 }); tape(c, 282, 204, 10, 0.2, 3);
      },
      walls(c) {
        // The delivery chute in the north wall, a bell-pull beside it.
        box(c, 272, 2, 26, 16, P.service[1], { ink: 1.2, amp: 0.3 }); rect(c, P.ink, 276, 7, 18, 9);
        line(c, 266, 4, 266, 20, P.wood[3], 1); oval(c, 266, 21, 1.8, 2.4, P.a.brass, true, 0.8);
        label(c, "ROWS", 50, 14, { size: 7, color: P.paper[2], weight: 900 });
        label(c, "← DRY TABLE", 290, 94, { size: 4.6, color: P.paper[1] });
      }
    },
    drytable: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "drytable", { board: 12 });
        // A dry patch, swept and chalk-ringed, around the table.
        alpha(c, 0.55, () => oval(c, 170, 160, 94, 50, P.wood[3]));
        alpha(c, 0.8, () => { c.save(); c.setLineDash([3, 3]); c.strokeStyle = P.paper[3]; c.lineWidth = 0.9; c.beginPath(); c.ellipse(170, 160, 96, 52, 0, 0, TAU); c.stroke(); c.restore(); });
        // Chalk notes on the boards: measurements, an arrow north, "DRY".
        alpha(c, 0.7, () => { label(c, "DRY", 70, 236, { size: 6, color: P.paper[3], jitter: 1 }); label(c, "41 / 38 / 52", 210, 226, { size: 4.2, color: P.paper[2], jitter: 0.8 }); line(c, 80, 80, 80, 54, P.paper[3], 0.9, 2, 0.3); line(c, 80, 54, 76, 60, P.paper[3], 0.9); line(c, 80, 54, 84, 60, P.paper[3], 0.9); });
        // A rag rug by the stove.
        box(c, 228, 196, 56, 30, P.a.maroon, { ink: 1.1, amp: 0.6 }); for (let y = 200; y < 224; y += 5) line(c, 230, y, 282, y, P.a.maroonLight, 0.8, y, 0.3);
      },
      walls(c) {
        // The route card, pinned crooked; a row of pegs on the west wall (one low).
        c.save(); c.translate(150, 6); c.rotate(-0.06); box(c, -14, 0, 28, 14, P.paper[3], { ink: 0.9, amp: 0.2 }); line(c, -10, 10, 0, 4, P.a.red, 0.9); line(c, 0, 4, 10, 8, P.a.red, 0.9); oval(c, 0, 1, 1.2, 1.2, P.a.brass); c.restore();
        for (const [y, low] of [[236, 0], [262, 0], [290, 1]]) { rect(c, P.wood[3], 18, y, 6, 2.4); if (low) label(c, "low", 30, y + 6, { size: 3.6, color: P.paper[2] }); }
        label(c, "STAIR", 300, 56, { size: 4.2, color: P.paper[1], angle: -Math.PI / 2 });
      }
    },
    hangrow: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "hangrow", { board: 14, tone: [P.below[1], P.wood[1], P.wood[1], P.wood[2]] });
        // Drip lines under the frames.
        alpha(c, 0.35, () => { for (const [x, y, w] of [[130, 342, 70], [200, 242, 80], [40, 212, 70], [150, 142, 60]]) rect(c, P.wet[1], x, y, w, 4); });
        // The tally post.
        box(c, 270, 360, 6, 40, P.wood[2], { ink: 1, amp: 0.1 }); alpha(c, 0.9, () => { for (let k = 0; k < 4; k += 1) line(c, 271 + k * 1.2, 366, 271 + k * 1.2, 372, P.paper[3], 0.6); line(c, 270, 371, 276, 367, P.paper[3], 0.6); });
      },
      walls(c) {
        label(c, "HANGING ROW", 200, 12, { size: 5, color: P.paper[2] });
        label(c, "LOW →", 284, 32, { size: 4.2, color: P.paper[1] });
      }
    },
    lowrun: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "lowrun", { board: 10, tone: [P.below[0], P.below[2], P.wood[1], P.wood[2]] });
        // The warm pipe under the boards: a line of heat showing through the gaps.
        rect(c, P.ember[0], 20, 212, 280, 5); alpha(c, 0.5, () => rect(c, P.ember[1], 20, 213, 280, 2));
        for (let x = 30; x < 300; x += 26) rect(c, P.metal[1], x, 210, 3, 9);
      },
      walls() {}
    },
    eyelet: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "eyelet", { size: 20, colors: ["#1f2724", "#243029"], grout: "#121815" });
        // The short board across the channel, chalk-marked at each end.
        drop(c, 76, 198, 22, 3);
        box(c, 56, 166, 40, 34, P.wood[2], { ink: 1.2, amp: 0.3 }); for (let y = 172; y < 198; y += 7) rect(c, P.wood[1], 57, y, 38, 1);
        alpha(c, 0.8, () => { rect(c, P.paper[3], 60, 168, 6, 1); rect(c, P.paper[3], 86, 196, 6, 1); });
        // The eyelet plate, set into the floor.
        box(c, 104, 144, 16, 16, P.metal[2], { ink: 1.1, amp: 0.1 }); oval(c, 112, 152, 4.6, 4.6, P.ink); oval(c, 112, 152, 4.6, 4.6, null, true, 1); alpha(c, 0.8, () => oval(c, 110, 150, 3, 1.4, P.metal[3]));
      },
      walls(c) {
        label(c, "EYELET", 230, 12, { size: 5, color: P.paper[2] });
        label(c, "PRESS ↑", 120, 12, { size: 4.2, color: P.paper[1] });
      }
    },
    traypass: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "traypass", { size: 16, colors: [P.below[2], P.below[3]] });
        // Wheel ruts, and where one wheel dragged.
        alpha(c, 0.4, () => { rect(c, P.below[0], 20, 92, 280, 2); rect(c, P.below[0], 20, 108, 280, 2); for (let x = 150; x < 230; x += 6) rect(c, P.below[0], x, 112 + (x % 4), 3, 1); });
        // The bent wheel.
        oval(c, 220, 150, 6, 6, null, true, 1.2); line(c, 214, 150, 226, 148, P.metal[2], 1.2); line(c, 220, 144, 219, 156, P.metal[2], 1.2);
      },
      walls(c) { label(c, "TRAYS", 160, 12, { size: 5, color: P.paper[2] }); }
    },
    press: {
      floor(c, geo) {
        A.concrete(c, 0, 0, geo.w, geo.h, "press", { tone: [P.below[1], P.below[2], P.below[3], P.plaster[2]], joint: 48 });
        // The worn track: two rails across the room and the stripes painted beside them.
        const track = geo.track;
        alpha(c, 0.5, () => { for (let x = track.x0 - 20; x < track.x1 + 20; x += 14) shape(c, [x, track.y - track.half - 6, x + 7, track.y - track.half - 6, x + 3, track.y - track.half - 2, x - 4, track.y - track.half - 2], P.a.mustard, { ink: false, amp: 0.2 }); });
        rect(c, P.below[0], track.x0 - 26, track.y - track.half, track.x1 - track.x0 + 52, track.half * 2);
        for (const dy of [-8, 8]) { rect(c, P.metal[1], track.x0 - 26, track.y + dy - 1, track.x1 - track.x0 + 52, 2.4); rect(c, P.metal[3], track.x0 - 26, track.y + dy - 1, track.x1 - track.x0 + 52, 0.8); }
        for (let x = track.x0 - 20; x < track.x1 + 24; x += 12) rect(c, P.wood[1], x, track.y - 11, 4, 22);
        // The drying recess: a warm cloth-lined nook in the west wall, open at the front.
        rect(c, P.wood[1], 20, 300, 44, 42); box(c, 22, 304, 30, 34, P.paper[1], { ink: 0.9, amp: 0.5 });
        stitches(c, 24, 320, 50, 320, P.a.maroon, 3, 1, 0.6);
        // Folded work on the press bed.
        box(c, 126, 404, 48, 16, P.paper[0], { ink: 1.1, amp: 0.4 }); rect(c, P.paper[1], 127, 405, 46, 2); stitches(c, 130, 412, 170, 412, P.inkSoft, 3, 1, 0.5);
      },
      walls(c) {
        // The procedure card.
        box(c, 88, 4, 24, 14, P.paper[3], { ink: 0.9, amp: 0.2 }); for (let y = 8; y < 16; y += 2.4) line(c, 91, y, 108, y, P.ink, 0.5, y, 0.2); line(c, 96, 15, 106, 13, P.a.red, 0.8);
        label(c, "PRESS HOUSE", 250, 12, { size: 5, color: P.paper[2] });
      }
    },
    upper: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "upper", { board: 12 });
        alpha(c, 0.4, () => { for (let k = 0; k < 6; k += 1) worn(c, 160 + k * 18, 200 - k * 14, 6, 3, P.wood[3], 0.8); });
      },
      walls(c, geo) {
        // The high window in the east wall: a long hall of service windows, far off, most of them lit.
        box(c, 296, 80, 24, 60, P.ink, { ink: 1.2, amp: 0.1 });
        rect(c, P.night[1], 298, 82, 20, 56);
        for (let k = 0; k < 7; k += 1) { const y = 86 + k * 7.4, lit = k !== 2 && k !== 5; rect(c, lit ? P.sodium[2] : P.metal[1], 300 + k * 0.6, y, 14 - k * 1.4, 3.4); }
        rect(c, P.wood[3], 294, 140, 26, 4);
        // Another arrow scratched into the sill with a key. Up.
        line(c, 288, 164, 288, 152, P.paper[2], 0.8, 1, 0.4); line(c, 288, 152, 285, 156, P.paper[2], 0.8); line(c, 288, 152, 291, 156, P.paper[2], 0.8);
        box(c, 80, 4, 22, 14, P.paper[3], { ink: 0.9, amp: 0.2 }); line(c, 84, 8, 98, 14, P.a.red, 0.8);
      }
    },
    stair: {
      floor(c, geo) {
        // Steps down from the top landing to the table: bands, each a little darker.
        for (let y = 20, index = 0; y < geo.h - 20; y += 12, index += 1) { rect(c, index % 2 ? P.wood[1] : P.wood[2], 20, y, geo.w - 40, 12); rect(c, P.wood[3], 20, y, geo.w - 40, 1); rect(c, P.wood[0], 20, y + 10.6, geo.w - 40, 1.4); }
        // The meal mark: a bowl and an arrow, chalked on a step.
        alpha(c, 0.85, () => { c.strokeStyle = P.paper[3]; c.lineWidth = 0.9; c.beginPath(); c.arc(116, 156, 5, 0, Math.PI); c.stroke(); line(c, 110, 156, 122, 156, P.paper[3], 0.9); line(c, 126, 160, 136, 166, P.paper[3], 0.9); line(c, 136, 166, 131, 166, P.paper[3], 0.9); });
      },
      walls() {}
    },
    windowgate: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "windowgate", { size: 24, check: true, colors: ["#2a2620", "#332e26"], grout: "#1a1713" });
        // A waiting line painted on the floor, and a mat in front of the counter.
        alpha(c, 0.5, () => { rect(c, P.a.mustard, 110, 128, 100, 2); label(c, "PLEASE WAIT", 160, 140, { size: 6, color: P.a.mustard, weight: 900 }); });
        box(c, 128, 60, 64, 22, P.service[1], { ink: 1, amp: 0.4 });
      },
      walls(c) {
        // The hall goes on east: more counters, more lamps, all the way along.
        for (let k = 0; k < 4; k += 1) { const y = 30 + k * 60; box(c, 300, y, 20, 26, P.ink, { ink: 1, amp: 0.1 }); rect(c, k === 1 ? P.metal[1] : P.sodium[1], 302, y + 3, 16, 18); }
        label(c, "WINDOW HALL", 60, 12, { size: 5, color: P.paper[2] });
        // A clock that is right.
        oval(c, 260, 9, 5, 5, P.paper[3], true, 1); line(c, 260, 9, 260, 5.6, P.ink, 0.8); line(c, 260, 9, 262.4, 10.4, P.ink, 0.8);
      }
    }
  };
  Object.assign(ROOMS, ROWS_DECOR);

  // Live pieces of the Rows: what she moves, what runs, what is left out.
  function rowsDynamicSolid(ctx, s, sim, t) {
    const open = !present(s, sim.flags);
    if (s.kind === "load") {
      // Wet sheets on a rail right across the doorway; moved aside, they hang bunched at one end.
      box(ctx, s.x - 4, s.y + 2, s.w + 8, 3, P.wood[3], { ink: 1, amp: 0.1 });
      if (open) { sheet(ctx, s.x + s.w - 6, s.y + 4, 8, 22, 7, P.paper[1]); return true; }
      for (let x = s.x; x < s.x + s.w; x += 10) sheet(ctx, x, s.y + 4, 11, 24 + ((x * 7) % 5), x, x % 20 ? P.paper[2] : P.paper[1]);
      return true;
    }
    if (s.kind === "shutter") {
      if (open) { box(ctx, s.x, s.y, s.w, 6, P.metal[1], { ink: 1.1, amp: 0.1 }); for (let x = s.x + 2; x < s.x + s.w; x += 4) rect(ctx, P.metal[0], x, s.y + 1, 1, 4); return true; }
      box(ctx, s.x, s.y, s.w, s.h, P.metal[2], { ink: 1.4, amp: 0.1 });
      for (let y = s.y + 3; y < s.y + s.h - 1; y += 3) rect(ctx, P.metal[1], s.x + 1, y, s.w - 2, 1);
      rect(ctx, P.a.mustard, s.x + 2, s.y + s.h - 4, s.w - 4, 2);
      return true;
    }
    if (s.kind === "grille") {
      if (open) {
        // Swung back against the wall, its low catch warm.
        for (let k = 0; k < 4; k += 1) rect(ctx, P.metal[1], s.x + 2 + k * 2, s.y - 4, 1.2, 10);
        return true;
      }
      rect(ctx, P.ink, s.x, s.y, s.w, s.h);
      for (let y = s.y + 3; y < s.y + s.h; y += 6) box(ctx, s.x, y, s.w, 2.2, P.metal[2], { ink: 0.8, amp: 0.1 });
      for (let x = s.x + 3; x < s.x + s.w; x += 6) rect(ctx, P.metal[1], x, s.y, 1.6, s.h);
      return true;
    }
    return false;
  }
  function rowsDynamic(ctx, geo, s) {
    const sim = s.sim, t = s.reduced ? 0 : s.time, room = s.extras.room || {};
    for (const prop of geo.props) {
      if (!present(prop, sim.flags)) continue;
      if (prop.kind === "warm" && prop.id !== "latch-jam") warmCatch(ctx, prop, t);
      else if (prop.id === "packet") { ctx.save(); ctx.translate(prop.x, prop.y - 6); ctx.rotate(0.08); box(ctx, -7, -4, 14, 8, P.paper[1], { ink: 1, amp: 0.3 }); line(ctx, -7, 0, 7, 0, P.a.red, 0.7); rect(ctx, P.a.stamp, 3, -3, 3, 3); ctx.restore(); }
      else if (prop.id === "chalk") { drop(ctx, prop.x, prop.y + 1, 4, 1.2); box(ctx, prop.x - 4, prop.y - 1.5, 8, 3, P.paper[3], { ink: 0.8, amp: 0.1 }); }
      else if (prop.id === "second-portion") {
        box(ctx, prop.x - 18, prop.y - 6, 36, 6, P.metal[2], { ink: 1.1, amp: 0.1 });
        for (const dx of [-8, 8]) { oval(ctx, prop.x + dx, prop.y - 7, 6, 2.6, P.paper[3], true, 0.9); oval(ctx, prop.x + dx, prop.y - 8, 3.6, 1.4, P.ember[1]); }
        if (!s.reduced) for (let index = 0; index < 2; index += 1) { const k = ((s.time / 1500) + index * 0.5) % 1; alpha(ctx, 0.45 * (1 - k), () => oval(ctx, prop.x + (index ? 8 : -8), prop.y - 12 - k * 12, 2 + k * 2, 1.4 + k, P.paper[2])); }
      } else if (prop.id === "wrap-peg") {
        // The wrap on the low peg, dry.
        shape(ctx, [prop.x - 6, prop.y - 14, prop.x + 6, prop.y - 14, prop.x + 8, prop.y + 2, prop.x - 8, prop.y + 2], P.service[2], { ink: 1.1, amp: 0.3 });
        stitches(ctx, prop.x - 6, prop.y - 6, prop.x + 6, prop.y - 6, P.paper[2], 2.4, 1, 0.6); oval(ctx, prop.x + 4, prop.y - 11, 1.6, 1.6, P.a.brass, true, 0.6);
      }
    }
    if (geo.id === "drytable" && room.board) {
      // The low board she set at his height, and the lamp angled down to it.
      drop(ctx, 150, 192, 18, 3);
      box(ctx, 132, 176, 36, 10, P.wood[3], { ink: 1.1, amp: 0.2 }); rect(ctx, P.paper[3], 134, 178, 8, 1);
      line(ctx, 172, 120, 160, 102, P.metal[2], 1.4, 1, 0); shape(ctx, [154, 100, 166, 98, 168, 106, 156, 108], P.service[2], { ink: 1, amp: 0.1 });
    }
    if (geo.id === "press" && room.carriage) {
      // The carriage: a heavy press frame on four wheels, riding the track.
      const x = room.carriage.x, y = geo.track.y;
      drop(ctx, x, y + 12, 26, 5, 0.5);
      for (const dx of [-16, 16]) for (const dy of [-8, 8]) oval(ctx, x + dx, y + dy + 3, 3.4, 3.4, P.ink);
      box(ctx, x - 22, y - 14, 44, 24, P.metal[1], { ink: 1.5, amp: 0.1 });
      rect(ctx, P.metal[3], x - 21, y - 13, 42, 2.4);
      box(ctx, x - 18, y - 30, 36, 18, P.metal[2], { ink: 1.3, amp: 0.1 });
      for (let k = 0; k < 4; k += 1) rect(ctx, P.metal[1], x - 15 + k * 9, y - 28, 2, 14);
      rect(ctx, P.a.mustard, x - 22, y + 6, 44, 2.6);
      if (room.carriage.moving && !s.reduced) alpha(ctx, 0.5, () => { for (const dx of [-26, 26]) rect(ctx, P.paper[2], x + dx, y - 2 + Math.sin(s.time / 60) * 2, 1.4, 1.4); });
    }
    if (geo.id === "press" && room.screen) {
      // The canvas screen she braces between him and the pass.
      box(ctx, 66, 268, 60, 26, P.paper[2], { ink: 1.3, amp: 0.4 });
      for (const x of [66, 124]) box(ctx, x - 1, 262, 4, 34, P.wood[2], { ink: 1, amp: 0.1 });
      stitches(ctx, 70, 280, 120, 280, P.paper[0], 3, 1, 0.6);
    }
  }
  function rowsLights(geo, s, list) {
    const room = s.extras.room || {};
    const lamps = {
      receiving: [[185, 40, 120, 0.75, 0.6], [285, 20, 80, 0.5, 0.5], [160, 220, 90, 0.35, 0.3]],
      hangrow: [[60, 40, 110, 0.6, 0.5], [230, 250, 120, 0.4, 0.3], [140, 410, 90, 0.35, 0.3]],
      lowrun: [[160, 214, 130, 0.45, 0.9]],
      eyelet: [[160, 40, 110, 0.6, 0.5], [112, 152, 50, 0.3, 0.2]],
      traypass: [[160, 30, 120, 0.5, 0.4]],
      press: [[160, 30, 120, 0.55, 0.4], [42, 320, 50, 0.45, 0.8], [160, 400, 100, 0.35, 0.3]],
      upper: [[296, 110, 120, 0.75, 0.6], [160, 200, 80, 0.3, 0.3]],
      stair: [[120, 60, 110, 0.5, 0.4], [60, 270, 80, 0.4, 0.5]],
      windowgate: [[160, 40, 140, 0.85, 0.7], [310, 100, 80, 0.5, 0.6], [310, 220, 80, 0.5, 0.6], [57, 136, 60, 0.35, 0.6]]
    }[geo.id] || [];
    for (const [x, y, r, strength, warm] of lamps) list.push({ x, y, r, strength, warm });
    if (geo.id === "drytable" && room.board) list.push({ x: 156, y: 150, r: 60, strength: 0.5, warm: 0.8 });
    if (geo.id === "press" && room.carriage) list.push({ x: room.carriage.x, y: geo.track.y - 20, r: 40, strength: 0.25, warm: 0.2 });
  }

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
    if (rowsDynamicSolid(ctx, s, sim, t)) return;
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
    rowsDynamic(ctx, geo, s);
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
    if (geo.id === "slip") {
      // The Slip is dark: he finds it by his own light. Faint grey far above,
      // where the rain light was; total black while he comes to.
      const room = s.extras.room || {};
      list.push({ x: 160, y: -40, r: 80, strength: 0.3 });
      const waking = room.wakeAt != null && (s.extras.sceneTime || 0) - room.wakeAt < 4000;
      ambient = { color: [4, 3, 3], alpha: waking ? 0.985 : 0.9 };
    }
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
    rowsLights(geo, s, list);
    if (geo.id === "lowrun") ambient = { color: [8, 5, 4], alpha: 0.66 };
    return { ambient, list };
  }

  const THEMES = {
    car: { paintStatic: carStatic, paintDynamic: carDynamic, lights: carLights },
    sack: { paintStatic: sackStatic, paintOver: sackOver, lights: sackLights },
    van: { paintStatic: vanStatic, paintUnder: vanUnder, paintDynamic: vanDynamic, lights: vanLights, transparent: true },
    road: { paintStatic: roadStatic, paintDynamic: roadDynamic, paintOver: roadOver, lights: roadLights },
    drain: { paintStatic: drainStatic, paintDynamic: drainDynamic, lights: drainLights }
  };
  const BELOW_THEME = { paintStatic: belowStatic, paintDynamic: belowDynamic, lights: belowLights };
  const themeOf = geo => THEMES[geo.theme] || BELOW_THEME;

  return Object.freeze({
    themeOf,
    paintStatic: (c, geo, margin) => themeOf(geo).paintStatic(c, geo, margin),
    paintUnder: (ctx, geo, s) => themeOf(geo).paintUnder?.(ctx, geo, s),
    paintDynamic: (ctx, geo, s) => themeOf(geo).paintDynamic?.(ctx, geo, s),
    paintOver: (ctx, geo, s) => themeOf(geo).paintOver?.(ctx, geo, s),
    lights: (geo, s) => themeOf(geo).lights(geo, s),
    transparent: geo => Boolean(themeOf(geo).transparent)
  });
});
