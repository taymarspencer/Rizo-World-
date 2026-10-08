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
    van      somebody's dirty work van, nose left, the road streaming under it;
             a swapped door, a cup, and four people who keep looking at him
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
  const Content = () => globalThis.RizoDungeonContent || { ENEMIES: { guard: { notches: 5 } } };
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
    // Fascia sign: mounted to the storefront header above the glass, not loose
    // on the sidewalk plane. The backing, lower lip, and cast shadow make the
    // sign read as part of the building even in the top-down camera.
    rect(c, P.concrete[1], 16, -2, 328, 25);
    rect(c, P.concrete[2], 16, -2, 328, 2);
    rect(c, P.ink, 18, 20, 324, 4);
    box(c, 20, 0, 320, 19, P.night[2], { ink: 1.2, amp: 0.3 });
    label(c, "FOOD · ICE · LOTTO", 180, 14, { size: 10, color: P.fluoro[2], shadow: P.ink, spacing: 1.2 });
    alpha(c, 0.75, () => rect(c, P.night[2], 236, 4, 7, 12));
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
    // Ordinary store life keeps going after the car becomes Rizo's whole
    // world. One anonymous customer-shadow crosses the far window now and
    // then; reduced motion leaves the glass still.
    if (!s.reduced && room.phase !== "taken") {
      const customer = (t / 1000) % 23;
      if (customer < 4.4) {
        const cx = 34 + (customer / 4.4) * 104;
        A.clip(ctx, 31, 23, 110, 64, () => alpha(ctx, 0.24, () => {
          oval(ctx, cx, 47, 4.5, 5, P.inkSoft);
          rect(ctx, P.inkSoft, cx - 4, 52, 8, 22);
        }));
      }
    }
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
    // Hands, reaching in through the forced door. Once they have Rizo, the
    // grip moves up from the floor-point to his body and becomes a real
    // two-handed hold: one arm catches high, the other braces low.
    if (room.hands) {
      const h = room.hands;
      if (room.grabbed) {
        const upper = { x: p.x + 5.5, y: p.y - 14 };
        const lower = { x: p.x + 7, y: p.y - 6 };
        line(ctx, 250, 238, upper.x + 3, upper.y, P.ink, 9, 31, 0.16);
        line(ctx, 250, 238, upper.x + 3, upper.y, P.cloth[1], 6.2, 31, 0.16);
        line(ctx, 251, 253, lower.x + 3, lower.y, P.ink, 9, 32, 0.16);
        line(ctx, 251, 253, lower.x + 3, lower.y, P.cloth[1], 6.2, 32, 0.16);
        oval(ctx, upper.x, upper.y, 5.6, 4.4, P.cloth[0], true, 1.2);
        oval(ctx, lower.x, lower.y, 5.6, 4.4, P.cloth[0], true, 1.2);
        // Fingers curl inward around his silhouette instead of pointing past it.
        for (const [g, dir] of [[upper, -1], [lower, 1]]) {
          for (let f = -2; f <= 2; f += 2) line(ctx, g.x - 1, g.y + f, g.x - 6, g.y + f * 0.65 + dir, P.ink, 1.6, 40 + f + dir, 0);
        }
      } else {
        line(ctx, 250, 244, h.x + 4, h.y - 2, P.ink, 9, 3, 0.2); line(ctx, 250, 244, h.x + 4, h.y - 2, P.cloth[1], 6.4, 3, 0.2);
        oval(ctx, h.x, h.y, 5.5, 4.5, P.cloth[0], true, 1.2);
        for (let f = -2; f <= 2; f += 2) line(ctx, h.x - 2, h.y + f, h.x - 7, h.y + f * 1.4, P.ink, 1.6, f, 0);
      }
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
  // The crew's work van with the roof cut away, NOSE TO THE LEFT. It drives
  // left, so the road streams right underneath it, streetlights wash through
  // from the cab to the back, and the back doors (right) are the ones that
  // come loose (beat sheet 7.8). The far wall stands up behind everyone in
  // 3/4, like every room below: the swapped primer sliding door with its
  // window, plywood lining, the rear wheel arch. The near wall is cut down to
  // a stub so the floor shows; under it, the van's side and its wheels. The
  // cab is at the left: dash, wheel, two seats, the console between them.
  // Collision is the content's: Rizo has the cargo floor (x 14–226, y 42–138).
  const VAN = Object.freeze({ nose: -60, glass: -46, dash: -36, cab: 10, cargo: 14, rear: 226, back: 240, bumper: 248, roof: -34, wall: -24, floor: 30, near: 138, skirt: 152, split: 84 });
  const VAN_SPEED = 2.2; // ms per unit of road
  const VAN_POLES = 1100; // units between streetlights
  // Streetlights stand on the verge beyond the far side; they pass every
  // couple of seconds. When the joke dies (the van's hush, room.unlit) the
  // town runs out: from that stretch of road on, only one pole in three.
  const vanUnlitAt = new WeakMap();
  function vanPoles(t, room) {
    const run = t / VAN_SPEED, list = [];
    if (room?.unlit && !vanUnlitAt.has(room)) vanUnlitAt.set(room, run);
    const from = room?.unlit ? vanUnlitAt.get(room) : Infinity;
    for (let index = Math.floor((run - 1200) / VAN_POLES); index <= Math.floor(run / VAN_POLES); index += 1) {
      if (index * VAN_POLES > from && index % 3 !== 0) continue;
      list.push(-360 + run - index * VAN_POLES);
    }
    return list;
  }
  // Now and then somebody comes the other way in the near lane, fast.
  function vanOncoming(t) {
    const k = t % 14000;
    return k < 1100 ? { x: -420 + k * 1.05, y: 214 } : null;
  }
  function vanStatic(c) {
    const V = VAN;
    // Its shadow on the road, down and right.
    alpha(c, 0.5, () => { rect(c, P.ink, V.nose + 6, V.skirt + 6, V.bumper - V.nose, 14); rect(c, P.ink, V.bumper, V.roof + 10, 6, V.skirt - V.roof); });
    // Mirrors out from the cab doors.
    box(c, -52, V.roof - 12, 9, 12, P.paper[1], { ink: 1.3, amp: 0.2 }); rect(c, P.wet[2], -50.5, V.roof - 10, 6, 7);
    box(c, -52, V.skirt + 2, 9, 11, P.paper[1], { ink: 1.3, amp: 0.2 }); rect(c, P.wet[2], -50.5, V.skirt + 4, 6, 6);
    // The nose: hood, grille, headlights (on, at night).
    shape(c, [V.nose, -10, V.glass, -22, V.glass, V.skirt, V.nose, V.near + 4], P.paper[1], { ink: 2, seed: 901, amp: 0.3 });
    rect(c, P.paper[2], V.nose + 3, -8, 10, 2);
    line(c, V.nose + 7, 6, V.nose + 7, 128, P.paper[0], 1, 902, 0.2);
    for (const hy of [-6, 128]) { box(c, V.nose - 1, hy, 5, 12, P.fluoro[2], { ink: 1, amp: 0.1 }); }
    box(c, V.nose - 2, 30, 4, 82, P.ink, { ink: false, amp: 0.1 });
    // Windscreen: a long band of wet glass from the hood up to the roof.
    shape(c, [V.glass, V.roof + 6, V.dash, V.roof, V.dash, V.skirt - 6, V.glass, V.skirt - 2], P.wet[1], { ink: 1.6, seed: 903, amp: 0.2 });
    alpha(c, 0.35, () => { for (const gy of [6, 70]) line(c, V.glass + 2, gy, V.dash - 2, gy - 18, P.fluoro[1], 1.2, gy, 0.1); });
    // ---- the far wall, standing up behind everyone (inside face) ----
    rect(c, P.paper[1], V.dash, V.roof, V.back - V.dash, V.wall - V.roof);
    rect(c, P.paper[2], V.dash, V.roof, V.back - V.dash, 2);
    rect(c, P.paper[0], V.dash, V.wall - 2, V.back - V.dash, 2);
    // Cab: the passenger door from inside, its window, the armrest.
    rect(c, P.cloth[2], V.dash, V.wall, V.cab - 6 - V.dash, V.floor - V.wall);
    box(c, V.dash + 4, V.wall + 3, V.cab - V.dash - 14, 17, P.wet[1], { ink: 1.3, amp: 0.2 });
    box(c, V.dash + 8, V.wall + 30, 22, 4, P.cloth[3], { ink: 0.9, amp: 0.2 });
    box(c, V.dash + 4, V.wall + 37, 10, 10, P.cloth[1], { ink: 0.8, amp: 0.2 });
    // B-pillar, then the bay: ribbed metal above, ply lining below, screws.
    rect(c, P.paper[1], V.cab - 6, V.wall, 8, V.floor - V.wall); rect(c, P.paper[0], V.cab, V.wall, 2, V.floor - V.wall);
    rect(c, P.metal[1], V.cab + 2, V.wall, V.rear - V.cab - 2, 22);
    for (let rx = V.cab + 8; rx < V.rear; rx += 16) { rect(c, P.metal[2], rx, V.wall, 2, 22); rect(c, P.metal[0], rx + 2, V.wall, 1, 22); }
    rect(c, P.ink, V.cab + 2, V.wall + 22, V.rear - V.cab - 2, 1);
    A.planks(c, V.cab + 2, V.wall + 23, V.rear - V.cab - 2, V.floor - V.wall - 23, "van-ply", { tone: P.wood, board: 31 });
    alpha(c, 0.7, () => { for (let px = V.cab + 14; px < V.rear; px += 26) { rect(c, P.ink, px, V.wall + 26, 1.2, 1.2); rect(c, P.ink, px, V.floor - 4, 1.2, 1.2); } });
    worn(c, 60, V.floor - 6, 14, 4, P.wood[3], 0.35);
    // The sliding door somebody swapped in: primer grey, its own window, a taped handle.
    box(c, 92, V.wall, 64, V.floor - V.wall, P.concrete[2], { ink: 1.4, amp: 0.25, seed: 904 });
    rect(c, P.concrete[3], 93, V.wall + 1, 62, 1.6);
    box(c, 100, V.wall + 5, 48, 17, P.wet[1], { ink: 1.3, amp: 0.2, seed: 905 });
    rect(c, P.ink, 92, V.wall + 25, 64, 0.8);
    box(c, 96, V.wall + 32, 4, 12, P.metal[2], { ink: 1, amp: 0.1 });
    tape(c, 98, V.wall + 38, 7, 1.5, 906);
    alpha(c, 0.8, () => { box(c, 140, V.wall + 40, 6, 5, P.a.rust, { ink: false, amp: 0.8 }); });
    // The rear wheel arch, a hump against the wall (the capped one sits on it).
    shape(c, [160, V.floor + 12, 162, 22, 170, 17, 196, 17, 204, 22, 206, V.floor + 12], P.cloth[2], { ink: 1.4, seed: 907, amp: 0.3 });
    rect(c, P.cloth[3], 168, 18.4, 30, 2);
    rect(c, P.cloth[1], 162, 24, 44, V.floor + 12 - 24);
    // C-pillar at the back corner.
    rect(c, P.paper[1], V.rear - 6, V.wall, 6, V.floor - V.wall); rect(c, P.paper[2], V.rear - 6, V.wall, 1.4, V.floor - V.wall);
    rect(c, P.ink, V.dash, V.wall, V.rear - V.dash, 1);
    // ---- the floor ----
    rect(c, P.cloth[0], V.dash, V.floor, V.cab - V.dash, V.near - V.floor);
    rect(c, P.cloth[1], V.cab, V.floor, V.rear - V.cab, V.near - V.floor);
    for (let fy = V.floor + 16; fy < V.near; fy += 5) rect(c, P.cloth[0], V.cargo, fy, V.rear - V.cargo, 1.1);
    worn(c, 120, 96, 46, 16, P.cloth[2], 0.4);
    // The step between the cab and the bay, and the bay's tie-down rings.
    rect(c, P.metal[1], V.cargo - 2, V.floor + 4, 2, V.near - V.floor - 4);
    for (const [rx, ry] of [[30, 48], [30, 130], [118, 48], [118, 132], [212, 52], [212, 130]]) { oval(c, rx, ry, 2.6, 1.6, null, true, 1); rivet(c, rx, ry - 1.6, 1); }
    // Shadow the far wall throws on the floor.
    alpha(c, 0.35, () => rect(c, P.ink, V.cab, V.floor, V.rear - V.cab, 5));
    // The near wall's wheel arch, seen from above.
    box(c, 162, 124, 42, 14, P.cloth[2], { ink: 1.2, amp: 0.3, seed: 908 }); rect(c, P.cloth[3], 164, 125, 38, 1.6);
    // ---- the cab ----
    // Dash: dark, the driver's gauges, the radio, tickets nobody paid.
    rect(c, P.ink, V.dash, V.wall, 8, V.near - V.wall + 6);
    for (const gy of [100, 112]) { oval(c, V.dash + 4, gy, 2.6, 4, P.service[0], true, 0.8); line(c, V.dash + 4, gy, V.dash + 5.6, gy - 2.4, P.service[3], 0.8); }
    rect(c, P.service[1], V.dash + 2, 72, 4, 8); rect(c, P.service[3], V.dash + 3, 74, 2, 1.2);
    c.save(); c.translate(V.dash + 3, 44); c.rotate(0.2); box(c, -3, -5, 7, 10, P.paper[2], { ink: 0.7, amp: 0.2 }); box(c, 0, -2, 7, 10, P.paper[3], { ink: 0.7, amp: 0.2 }); c.restore();
    // Seats: cushion, then the seatback standing behind it, a headrest on top.
    // Dark vinyl, so the people in them read against them.
    for (const [sy, top] of [[60, 8], [134, 82]]) {
      box(c, -22, sy - 24, 26, 20, P.cloth[1], { ink: 1.3, amp: 0.3, seed: sy });
      rect(c, P.cloth[2], -20, sy - 23, 22, 2);
      rect(c, P.ink, -22, sy - 5, 26, 5);
      box(c, 2, top, 9, sy - top, P.cloth[1], { ink: 1.4, amp: 0.25, seed: sy + 1 });
      rect(c, P.cloth[2], 3, top + 1, 1.6, sy - top - 4);
      stitches(c, 6.5, top + 6, 6.5, sy - 6, P.cloth[0], 3, 1, 0.6);
      box(c, 3, top - 8, 7, 9, P.cloth[1], { ink: 1.2, amp: 0.2, seed: sy + 2 });
    }
    // A tear in the driver's seatback, taped.
    tape(c, 6, 110, 8, 1.2, 913);
    // The console between them: a cup with a straw, a receipt, a charger cable into the back.
    box(c, -20, 66, 20, 34, P.cloth[0], { ink: 1.2, amp: 0.3, seed: 909 });
    box(c, -15, 70, 8, 9, P.a.red, { ink: 0.9, amp: 0.2 }); rect(c, P.paper[3], -15, 70, 8, 2); line(c, -11, 70, -9, 63, P.paper[3], 1);
    shape(c, [-17, 86, -8, 84, -7, 91, -16, 93], P.paper[2], { ink: 0.6, amp: 0.5 });
    A.trace(c, [-4, 94, 10, 98, 18, 106, 30, 102, 38, 110], 9, 0.8, false); A.inkStroke(c, 1, P.ink);
    // ---- the near wall, cut down to a stub; under it the van's side and wheels ----
    rect(c, P.paper[1], V.glass, V.near, V.back - V.glass, V.skirt - V.near + 10);
    rect(c, P.paper[2], V.glass, V.near, V.back - V.glass, 2.2);
    rect(c, P.paper[0], V.glass, V.skirt + 4, V.back - V.glass, 6);
    rect(c, P.ink, V.glass, V.near + 3, V.back - V.glass, 1);
    // A dent, rust, the mustard sticker from outside, the fuel flap.
    alpha(c, 0.85, () => { box(c, 60, V.skirt + 2, 10, 5, P.a.rust, { ink: false, amp: 1 }); box(c, 208, V.skirt, 7, 7, P.a.rust, { ink: false, amp: 1 }); });
    box(c, 132, V.near + 6, 10, 6, P.a.mustard, { ink: 0.8, amp: 0.3 });
    box(c, 150, V.near + 6, 8, 6, P.paper[0], { ink: 0.8, amp: 0.2 });
    line(c, 6, V.near + 3, 6, V.skirt + 10, P.paper[0], 1);
    for (const [wx, cap] of [[-28, true], [180, false]]) {
      oval(c, wx, V.skirt + 9, 15, 8, P.ink);
      oval(c, wx, V.skirt + 8, 8, 4.5, cap ? P.metal[2] : P.metal[0], true, 1);
      if (!cap) for (let index = 0; index < 4; index += 1) rivet(c, wx + Math.cos(index * 1.57) * 4.5, V.skirt + 8 + Math.sin(index * 1.57) * 2.4, 0.8);
      rect(c, P.paper[0], wx - 18, V.skirt - 2, 36, 2);
    }
    // ---- the back: the doors' upper leaf (the lower one is live), bumper, lights ----
    rect(c, P.paper[1], V.rear, V.roof, V.back - V.rear, V.split - V.roof);
    rect(c, P.paper[2], V.rear, V.roof, 2, V.split - V.roof);
    rect(c, P.paper[0], V.back - 3, V.roof, 3, V.split - V.roof);
    box(c, V.rear + 3, V.wall + 6, 8, 18, P.wet[1], { ink: 1, amp: 0.2 });
    box(c, V.rear + 4, V.split - 8, 6, 6, P.metal[2], { ink: 0.9, amp: 0.1 });
    rect(c, P.cloth[0], V.back, V.roof + 4, V.bumper - V.back, V.skirt + 8 - V.roof - 4);
    for (const ly of [V.roof + 6, V.skirt - 8]) box(c, V.back + 1, ly, 6, 12, P.a.red, { ink: 0.9, amp: 0.1 });
    // The roof line: one firm edge round the whole cut-away body.
    c.save(); c.strokeStyle = P.ink; c.lineWidth = 2.2; c.lineJoin = "round";
    c.beginPath(); c.moveTo(V.glass, V.roof + 6); c.lineTo(V.dash, V.roof); c.lineTo(V.back, V.roof); c.lineTo(V.back, V.skirt + 10); c.lineTo(V.glass, V.skirt + 10); c.stroke(); c.restore();
  }
  function vanUnder(ctx, geo, s) {
    const v = s.view, t = s.reduced ? 0 : s.time, ride = A.vanRide(t, s.reduced);
    rect(ctx, P.asphalt[1], v.x - 40, v.y - 40, v.w + 80, v.h + 80);
    const run = t / VAN_SPEED;
    ctx.save(); ctx.translate(0, ride.drift);
    const L = v.x - 120, R = v.x + v.w + 120;
    // Beyond the far side: the verge, a ditch, the poles. Near side: the
    // dashed centre line, then the oncoming lane and its edge.
    const edge = -84, centre = 196, far = 300;
    rect(ctx, P.grass[1], L, v.y - 60, R - L, edge - 26 - v.y + 60);
    rect(ctx, P.concrete[0], L, edge - 26, R - L, 24);
    rect(ctx, P.paper[1], L, edge, R - L, 2.4);
    rect(ctx, P.paper[1], L, far, R - L, 2.4);
    rect(ctx, P.grass[1], L, far + 22, R - L, v.y + v.h + 60 - far);
    const dash = run % 90;
    for (let x = L - 90 + dash; x < R; x += 90) { box(ctx, x, centre, 40, 2.8, P.a.mustard, { ink: false, amp: 0.2 }); rect(ctx, P.paper[3], x + 44, centre + 0.6, 1.6, 1.6); }
    // Old seams and wet patches in the tar, going by.
    const seams = run % 260;
    alpha(ctx, 0.55, () => {
      for (let x = L - 260 + seams; x < R; x += 260) {
        line(ctx, x, edge + 10, x + 14, edge + 70, "#0a0c10", 1.3, x, 0.6);
        line(ctx, x + 120, centre + 14, x + 104, far - 12, "#0a0c10", 1.3, x + 1, 0.6);
        oval(ctx, x + 60, edge + 34, 26, 5, P.wet[1]); oval(ctx, x + 190, centre + 52, 30, 6, P.wet[1]);
      }
    });
    for (let x = L - 26 + (run % 26); x < R; x += 26) rect(ctx, P.grass[2], x, edge - 34, 2, 6);
    // Streetlights: a pole at the verge, an arm out over the road, a pool on the wet tar.
    for (const px of vanPoles(t, s.extras.room)) {
      if (px < L - 80 || px > R + 80) continue;
      alpha(ctx, 0.22, () => { oval(ctx, px, edge + 26, 64, 16, P.sodium[0]); oval(ctx, px, edge + 24, 34, 8, P.sodium[1]); });
      oval(ctx, px, edge - 18, 3, 3, P.metal[1], true, 1);
      line(ctx, px, edge - 18, px, edge + 12, P.metal[1], 2.2);
      box(ctx, px - 5, edge + 10, 10, 4, P.sodium[2], { ink: 1, amp: 0.1 });
    }
    // Our own taillights, red on the wet behind us; the headlights ahead.
    alpha(ctx, 0.3, () => { oval(ctx, VAN.bumper + 30, -20, 34, 12, P.a.red); oval(ctx, VAN.bumper + 30, 150, 34, 12, P.a.red); });
    alpha(ctx, 0.22, () => { shape(ctx, [VAN.nose, -6, VAN.nose - 160, -40, VAN.nose - 160, 20, VAN.nose, 6], P.fluoro[2], { ink: false }); shape(ctx, [VAN.nose, 128, VAN.nose - 160, 110, VAN.nose - 160, 170, VAN.nose, 140], P.fluoro[2], { ink: false }); });
    // Somebody coming the other way: headlights first, then a dark car, then red.
    const car = s.reduced ? null : vanOncoming(t);
    if (car) {
      alpha(ctx, 0.28, () => shape(ctx, [car.x + 30, car.y - 8, car.x + 190, car.y - 46, car.x + 190, car.y + 30, car.x + 30, car.y + 8], P.fluoro[2], { ink: false }));
      box(ctx, car.x - 30, car.y - 13, 60, 26, P.night[2], { ink: 1.4, amp: 0.3, seed: 911 });
      rect(ctx, P.wet[1], car.x - 8, car.y - 10, 16, 20);
      for (const dy of [-10, 7]) { rect(ctx, P.fluoro[2], car.x + 27, car.y + dy, 3, 4); rect(ctx, P.a.red, car.x - 30, car.y + dy, 2, 4); }
    }
    ctx.restore();
  }
  function vanDynamic(ctx, geo, s) {
    const room = s.extras.room || {}, t = s.reduced ? 0 : s.time, ride = A.vanRide(t, s.reduced), V = VAN;
    // Rain on the windscreen, blown back up the glass; the wipers going.
    alpha(ctx, 0.7, () => { for (let index = 0; index < 16; index += 1) { const y = V.roof + 8 + ((index * 53) % 176), k = s.reduced ? 0.5 : ((t / 380) + index * 0.37) % 1; rect(ctx, P.wet[3], V.glass + 1 + k * 8, y - k * 3, 1.6, 0.8); } });
    const wipe = s.reduced ? 0.3 : (Math.sin(t / 420) + 1) / 2;
    for (const py of [30, 104]) line(ctx, V.glass + 1, py, V.dash - 1, py - 8 - wipe * 34, P.ink, 1.6, py, 0);
    // The rear-view mirror over the console, and the tree swinging under it.
    box(ctx, V.glass + 3, 50, 6, 16, P.ink, { ink: 1, amp: 0.1 }); rect(ctx, P.metal[2], V.glass + 4.4, 52, 2.6, 12);
    ctx.save(); ctx.translate(V.glass + 6, 66); ctx.rotate(s.reduced ? 0 : ride.bend * 0.5 + Math.sin(t / 300) * 0.15 + (room.shake && s.extras.sceneTime - room.shake < 500 ? 0.5 : 0));
    line(ctx, 0, 0, 0, 7, P.ink, 0.6); shape(ctx, [0, 7, 4, 14, 1.4, 14, 3.4, 18, -3.4, 18, -1.4, 14, -4, 14], P.a.track, { ink: 0.7, amp: 0.1 });
    ctx.restore();
    // The driver's eyes in the mirror when he looks back.
    const driver = (s.extras.npcs || []).find(actor => actor.id === "driver");
    if (driver && (driver.state === "stare" || (s.extras.barks || []).some(bark => bark.id === "driver"))) { rect(ctx, "#ffffff", V.glass + 4.6, 55, 2, 1.6); rect(ctx, "#ffffff", V.glass + 4.6, 59.5, 2, 1.6); }
    // The sliding door's window: rain, and each streetlight's glare going by.
    for (const px of vanPoles(t, room)) if (px > 60 && px < 190) alpha(ctx, Math.max(0, 1 - Math.abs(px - 124) / 64) * 0.7, () => rect(ctx, P.sodium[2], Math.max(101, Math.min(140, px - 4)), V.wall + 6, 7, 15));
    alpha(ctx, 0.6, () => { for (let index = 0; index < 7; index += 1) { const k = s.reduced ? 0.5 : ((t / 700) + index * 0.29) % 1; rect(ctx, P.wet[3], 102 + ((index * 17) % 44) + k * 4, V.wall + 7 + ((index * 5) % 12), 1.6, 0.8); } });
    // A can rolling about the floor with the bends.
    ctx.save(); ctx.translate(196 + ride.surge * 6, 116 + ride.bend * 6); ctx.rotate(ride.bend * 1.4);
    box(ctx, -2.6, -4, 5.2, 8, P.metal[2], { ink: 0.8, amp: 0.1 }); rect(ctx, P.a.track, -2.6, -1.6, 5.2, 3);
    ctx.restore();
    // The back doors' lower leaf: shut; loose and rattling, rain spitting
    // through the crack; then flung open on the black road.
    const hingeY = V.skirt + 2, len = hingeY - V.split;
    const swing = room.doorOpen ? Math.min(1.35, (s.extras.sceneTime - (room.openAt ?? s.extras.sceneTime - 400)) / 260 * 1.35) : room.doorLoose ? 0.1 + (s.reduced ? 0 : Math.abs(Math.sin(t / 70)) * 0.08 + Math.max(0, Math.sin(t / 900)) * 0.06) : 0;
    if (swing > 0.01) {
      rect(ctx, P.ink, V.rear, V.split, V.back - V.rear, len);
      alpha(ctx, 0.75, () => { for (let index = 0; index < 6; index += 1) { const y = V.split + 4 + ((t / 6 + index * 11) % (len - 6)); line(ctx, V.back + 4, y, V.rear + 2, y + 2, P.wet[3], 0.8, index, 0); } });
    }
    ctx.save(); ctx.translate(V.back, hingeY); ctx.rotate(swing);
    box(ctx, -(V.back - V.rear), -len, V.back - V.rear, len, P.paper[1], { ink: 1.4, amp: 0.25, seed: 912 });
    rect(ctx, P.paper[0], -3, -len, 3, len);
    box(ctx, -(V.back - V.rear) + 3, -len + 6, 8, 16, P.wet[1], { ink: 1, amp: 0.2 });
    box(ctx, -(V.back - V.rear) + 4, -len + 1, 6, 5, P.metal[2], { ink: 0.9, amp: 0.1 });
    ctx.restore();
  }
  function vanLights(geo, s) {
    const room = s.extras.room || {}, t = s.reduced ? 0 : s.time;
    // The dash: gauges on the driver's side, the radio between the seats.
    const list = [{ x: -30, y: 108, r: 50, strength: 0.6 }, { x: -30, y: 70, r: 26, strength: 0.4 }, { x: -24, y: 34, r: 44, strength: 0.5 }];
    // Streetlights wash through from the far side, cab first, then the back.
    if (!s.reduced) for (const px of vanPoles(t, room)) if (px > -200 && px < 440) list.push({ x: px, y: 0, r: 140, strength: 0.7, warm: 0.5 });
    const car = s.reduced ? null : vanOncoming(t);
    if (car) list.push({ x: car.x + 90, y: 160, r: 120, strength: 0.75 });
    if (room.doorLoose || room.doorOpen) list.push({ x: VAN.back, y: 112, r: room.doorOpen ? 80 : 36, strength: 0.7 });
    // The small one's phone: a cold point while he films; the whole van
    // when it rings. Its screen faces him, so only the light is ours.
    const small = (s.extras.npcs || []).find(actor => actor.id === "hood-small");
    const phone = small ? { x: small.x + (room.phoneLight === "film" ? 16 : 1), y: small.y - 32 } : { x: 56, y: 40 };
    if (room.phoneLight) list.push({ x: phone.x, y: phone.y, r: room.phoneLight === "call" ? 150 : 42, strength: room.phoneLight === "call" ? 0.95 : 0.75, warm: 0 });
    // While it rings the whole cabin goes the colour of that screen.
    if (room.phoneLight === "call") return { ambient: { color: [18, 34, 62], alpha: 0.5 }, list };
    return { ambient: { color: [6, 8, 12], alpha: 0.54 }, list };
  }
  // Rain outside never falls into the van (it has a roof; we just can't see it).
  const VAN_SHELTER = Object.freeze({ x: VAN.nose - 4, y: VAN.roof - 14, w: VAN.bumper - VAN.nose + 8, h: VAN.skirt + 26 - VAN.roof });

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
    // Somebody else's LOST poster. Under its corner, a black card.
    c.save(); c.translate(128, 594); c.rotate(0.05);
    box(c, -9, -12, 18, 22, P.paper[3], { ink: 1, amp: 0.3 }); label(c, "LOST", 0, -5, { size: 4.6, weight: 900, color: P.a.red });
    oval(c, 0, 2, 3.4, 3, P.sodium[2], true, 0.6); rect(c, P.paper[0], -6, 7, 12, 0.8);
    c.restore();
    A.callingCard(c, 137, 607, { angle: -0.5 });
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
      const dropT = phone.dropAt != null ? Math.max(0, Math.min(1, ((s.extras.sceneTime || 0) - phone.dropAt) / 320)) : 1;
      const eased = 1 - Math.pow(1 - dropT, 3);
      const drawY = phone.dropFromY != null ? phone.dropFromY + (phone.y - phone.dropFromY) * eased : phone.y;
      ctx.save(); ctx.translate(phone.x, drawY); ctx.rotate(-0.3 - (1 - dropT) * 0.45);
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
        // The queue's ticket posts: squat stone pillars with a brass ticket
        // slot and an empty lamp hook (the collectors took the lamps). Wide
        // enough to hide behind: their shadow is the only cover in the Queue.
        const cx = s.x + s.w / 2;
        drop(c, cx, s.y + s.h + 2, 15, 4.4);
        box(c, s.x, s.y - 10, s.w, s.h + 10, P.concrete[1], { ink: 1.3, amp: 0.3 });
        rect(c, P.concrete[2], s.x + 1, s.y - 9, s.w - 2, 4);
        rect(c, P.concrete[0], s.x + s.w - 6, s.y - 5, 5, s.h + 4);
        box(c, cx - 5, s.y + 4, 10, 4, P.a.brass, { ink: 0.9, amp: 0.1 }); rect(c, P.ink, cx - 3.5, s.y + 5.5, 7, 1);
        // Frost on the top edge; the hook, empty.
        rect(c, P.cold[2], s.x + 2, s.y - 10, s.w - 4, 1.4);
        line(c, cx, s.y - 10, cx, s.y - 18, P.metal[2], 1.4); line(c, cx, s.y - 18, cx + 5, s.y - 18, P.metal[2], 1.4); line(c, cx + 5, s.y - 18, cx + 5, s.y - 15, P.metal[2], 1.2);
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
  // One service building, seen in cutaway. The masonry and supply pipes are
  // outside the collision floor; they give short rooms depth without promising
  // another walkable lane. A patched green main survives every district.
  function serviceSurround(c, geo, m) {
    if (geo.id === "slip") return; // preserve the shaft's lonely upward vista
    const face = FACE[geo.id] || FACE.clatter;
    const depth = Math.min(96, m.my - 4);
    A.wallFace(c, 0, -depth, geo.w, depth, `back:${geo.id}`, { ...face, brick: true });
    rect(c, P.below[0], 0, -depth, geo.w, 5);
    rect(c, P.ink, 0, -4, geo.w, 4);
    for (const x of [-14, geo.w + 7]) {
      box(c, x, -depth, 7, geo.h + depth + 22, P.metal[0], { ink: 1.1, amp: 0.1 });
      rect(c, P.service[1], x + 1, -depth, 3, geo.h + depth + 20);
      for (let y = -24; y < geo.h + 20; y += 64) {
        box(c, x - 2, y, 11, 5, P.metal[1], { ink: 0.8, amp: 0.1 });
        rivet(c, x + 3, y + 2.5, 0.9);
      }
      tape(c, x + 3.5, geo.h * 0.6, 12, 0.16, geo.id);
    }
    // Lower wall faces and foundations, darker than the playable floor.
    A.wallFace(c, 0, geo.h + 2, geo.w, 26, `foundation:${geo.id}`, face);
    rect(c, P.below[0], 0, geo.h + 28, geo.w, 8);
    alpha(c, 0.28, () => rect(c, P.plaster[1], 6, geo.h + 38, geo.w - 12, 8));
    // The cutaway has thickness: a supply chase below the kept floor. It is
    // subordinate to the room, but short passages no longer float in a void.
    const chase = Math.min(70, m.my - 4);
    if (chase > 46) {
      alpha(c, 0.65, () => {
        A.wallFace(c, 8, geo.h + 36, geo.w - 16, chase - 36, `chase:${geo.id}`, { upper: P.below, lower: P.metal, brick: true });
        rect(c, P.metal[0], 12, geo.h + 49, geo.w - 24, 8);
        rect(c, P.service[1], 12, geo.h + 50, geo.w - 24, 2);
        for (let x = 28; x < geo.w - 24; x += 62) { rect(c, P.metal[1], x, geo.h + 46, 5, 14); rivet(c, x + 2.5, geo.h + 51, 1); }
        tape(c, geo.w * 0.62, geo.h + 51, 13, -0.12, 53);
      });
    }
    // Shallow mortar repairs and a vent belong to the wall plane. No invented
    // sigils, no ornamental fantasy architecture, no extra playable doorway.
    if (depth > 66) {
      alpha(c, 0.65, () => {
        box(c, 24, -depth + 16, 30, 16, P.metal[0], { ink: 1, amp: 0.2 });
        for (let vx = 28; vx < 52; vx += 5) rect(c, P.metal[1], vx, -depth + 19, 1.2, 10);
        stitches(c, geo.w - 64, -depth + 29, geo.w - 34, -depth + 24, P.plaster[2], 5, 1.5, 0.8);
      });
    }
    for (const x of [0, geo.w - 8]) rect(c, P.inkSoft, x, -depth, 8, geo.h + depth + 36);
    // A mundane conduit, with the same cloth-bound repair as the drain pipe.
    rect(c, P.metal[0], 12, -18, geo.w - 24, 5);
    rect(c, P.metal[1], 12, -18, geo.w - 24, 1.6);
    tape(c, geo.w * 0.72, -16, 12, -0.12, 52);
  }

  // [source x/y, radius, strength, warmth]. Each entry has an actual painted
  // fixture; sources never live only in the light-pass data.
  const WORK_LIGHTS = Object.freeze({
    clatter: [[176, 90, 86, 0.5, 0.3]], hem: [[101, 30, 120, 0.75, 0.5]],
    queue: [[123, 26, 90, 0.65, 0.4]],
    receiving: [[185, 40, 135, 0.85, 0.7]],
    drytable: [[172, 106, 145, 0.75, 0.8]],
    hangrow: [[60, 40, 110, 0.65, 0.5], [230, 250, 125, 0.55, 0.4], [80, 410, 80, 0.4, 0.3]],
    lowrun: [[58, 52, 95, 0.6, 0.55], [224, 176, 100, 0.55, 0.6]],
    eyelet: [[136, 126, 120, 0.7, 0.7], [160, 26, 85, 0.45, 0.4], [306, 90, 24, 0.35, 0.8]],
    traypass: [[160, 30, 140, 0.7, 0.55]],
    press: [[160, 30, 120, 0.55, 0.4], [42, 320, 65, 0.55, 0.8], [160, 400, 105, 0.4, 0.4]],
    upper: [[70, 32, 95, 0.5, 0.45]],
    stair: [[190, 44, 100, 0.7, 0.5], [42, 280, 110, 0.75, 0.8]],
    windowgate: [[160, 12, 135, 0.7, 0.6], [57, 136, 90, 0.5, 0.7]]
  });
  function workLamp(c, x, y) {
    // Hung from a bracket, not a new obstruction on the floor.
    line(c, x, y - 22, x, y - 7, P.metal[1], 1.8);
    box(c, x - 8, y - 8, 16, 11, P.service[1], { ink: 1.3, amp: 0.2, seed: x + y });
    rect(c, P.service[3], x - 7, y - 7, 14, 2);
    rect(c, P.sodium[2], x - 5, y - 4, 10, 5);
    for (const dx of [-5, 0, 5]) rect(c, P.ink, x + dx - 0.5, y - 5, 1, 7);
    rivet(c, x, y - 18, 1.2);
  }
  function wearPath(c, points, width = 18, color = P.plaster[2]) {
    c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round"; c.lineCap = "round"; c.globalAlpha *= 0.3;
    c.beginPath(); points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore();
  }

  // Same frame and scuffed sill at both ends of a connection. Hardware covers
  // a closed opening; an open one has a continuous floor and a light beyond it.
  // No wayfinding mark is used for the caller or any unresolved story symbol.
  function thresholds(c, geo, s) {
    for (const exit of geo.exits) {
      const open = present(exit, s.sim.flags);
      const vertical = exit.h > exit.w;
      const x = exit.x + exit.w / 2, y = exit.y + exit.h / 2;
      const west = x < geo.w / 2, north = y < geo.h / 2;
      const w = vertical ? 24 : exit.w, h = vertical ? exit.h : 24;
      const tx = vertical ? (west ? 0 : geo.w - 24) : exit.x;
      const ty = vertical ? exit.y : (north ? 0 : geo.h - 24);
      alpha(c, open ? 0.7 : 0.3, () => rect(c, P.plaster[2], tx, ty, w, h));
      if (vertical) {
        for (const dy of [0, exit.h]) { box(c, tx - 2, exit.y + dy - 2, w + 4, 4, P.service[2], { ink: 1, amp: 0.1 }); rivet(c, tx + (west ? 20 : 4), exit.y + dy, 1); }
        rect(c, P.paper[1], west ? 19 : geo.w - 21, exit.y + 3, 1.5, exit.h - 6);
      } else {
        for (const dx of [0, exit.w]) { box(c, exit.x + dx - 2, ty - 2, 4, h + 4, P.service[2], { ink: 1, amp: 0.1 }); rivet(c, exit.x + dx, ty + (north ? 20 : 4), 1); }
        rect(c, P.paper[1], exit.x + 3, north ? 19 : geo.h - 21, exit.w - 6, 1.5);
      }
      if (open) {
        // A bounded spill, continuing beyond the sill. No new destination art.
        alpha(c, 0.18, () => rect(c, P.sodium[2], vertical ? (west ? -20 : geo.w) : exit.x + 4, vertical ? exit.y + 4 : (north ? -20 : geo.h), vertical ? 20 : exit.w - 8, vertical ? exit.h - 8 : 20));
      }
    }
  }
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
        label(c, "TABLE →", 268, 92, { size: 7.5, color: P.paper[2] });
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
        label(c, "LOW →", 278, 31, { size: 7.5, color: P.paper[2] });
      }
    },
    lowrun: {
      floor(c, geo) {
        A.planks(c, 0, 0, geo.w, geo.h, "lowrun", { board: 12, tone: [P.wood[0], P.wood[1], P.wood[1], P.wood[2]] });
        // The walked surface snakes around the *actual* three board stacks.
        // Pale end-grain belongs to stacks; broad worn boards belong to feet.
        wearPath(c, [[20, 60], [62, 60], [62, 160], [142, 160], [142, 68], [224, 68], [224, 178], [284, 178], [300, 190]], 26, P.wood[3]);
        // The warm pipe under the boards: a line of heat showing through the gaps.
        rect(c, P.metal[0], 20, 212, 280, 7); rect(c, P.ember[1], 20, 213, 280, 2);
        for (let x = 30; x < 300; x += 26) rect(c, P.metal[1], x, 210, 3, 9);
        // An ordinary insulation patch, pinned open where the warmth escapes.
        sheet(c, 126, 206, 24, 10, 31, P.service[2]); stitches(c, 128, 209, 148, 209, P.paper[1], 3, 1, 0.8);
      },
      walls(c) { label(c, "LOW RUN", 166, -30, { size: 9, color: P.paper[2] }); }
    },
    eyelet: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "eyelet", { size: 20, colors: ["#1f2724", "#243029"], grout: "#121815" });
        // The short board across the channel, chalk-marked at each end.
        drop(c, 76, 198, 22, 3);
        box(c, 56, 166, 40, 34, P.wood[2], { ink: 1.2, amp: 0.3 }); for (let y = 172; y < 198; y += 7) rect(c, P.wood[1], 57, y, 38, 1);
        alpha(c, 0.8, () => { rect(c, P.paper[3], 60, 168, 6, 1); rect(c, P.paper[3], 86, 196, 6, 1); });
        // The same low work light and cloth-bound support as her table. Nell
        // made room here before he arrived; the crossing reads from the exit.
        wearPath(c, [[36, 230], [76, 216], [76, 154], [136, 126]], 18, P.plaster[3]);
        box(c, 182, 116, 26, 10, P.service[1], { ink: 1.1, amp: 0.3 });
        stitches(c, 184, 121, 206, 121, P.paper[1], 3, 1, 0.7);
        // The eyelet plate, set into the floor.
        box(c, 104, 144, 16, 16, P.metal[2], { ink: 1.1, amp: 0.1 }); oval(c, 112, 152, 4.6, 4.6, P.ink); oval(c, 112, 152, 4.6, 4.6, null, true, 1); alpha(c, 0.8, () => oval(c, 110, 150, 3, 1.4, P.metal[3]));
      },
      walls(c) {
        label(c, "EYELET", 230, 12, { size: 5, color: P.paper[2] });
        label(c, "PRESS ↑", 119, 12, { size: 7, color: P.paper[2] });
      }
    },
    traypass: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "traypass", { size: 16, colors: [P.below[2], P.below[3]] });
        // Wheel ruts, and where one wheel dragged.
        alpha(c, 0.4, () => { rect(c, P.below[0], 20, 92, 280, 2); rect(c, P.below[0], 20, 108, 280, 2); for (let x = 150; x < 230; x += 6) rect(c, P.below[0], x, 112 + (x % 4), 3, 1); });
        wearPath(c, [[20, 100], [300, 100]], 24);
        // The bent wheel.
        oval(c, 220, 150, 6, 6, null, true, 1.2); line(c, 214, 150, 226, 148, P.metal[2], 1.2); line(c, 220, 144, 219, 156, P.metal[2], 1.2);
      },
      walls(c) { label(c, "TRAYS", 160, -30, { size: 9, color: P.paper[2] }); }
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
        wearPath(c, [[160, 220], [160, 158], [72, 120], [20, 120]], 22, P.wood[3]);
        box(c, 74, 78, 42, 12, P.paper[1], { ink: 1.1, amp: 0.4 }); stitches(c, 76, 83, 112, 83, P.a.maroon, 3, 1, 0.8);
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
        // Three flights around the two real rails: treads run toward the
        // *open ends*, rather than implying he can walk straight through them.
        A.planks(c, 20, 20, geo.w - 40, geo.h - 40, "stair", { board: 14 });
        for (const [x, y, w, h] of [[174, 64, 40, 126], [26, 126, 40, 126]]) {
          rect(c, P.wood[0], x - 3, y, w + 6, h);
          for (let sy = y; sy < y + h; sy += 10) { rect(c, P.wood[2], x, sy, w, 8); rect(c, P.wood[3], x, sy, w, 1.7); }
        }
        wearPath(c, [[228, 50], [194, 50], [194, 154], [46, 154], [46, 278], [20, 278]], 22, P.wood[3]);
        // Light from the table rises through the lower doorway; the same rug
        // thread is caught harmlessly around the worn bottom post.
        box(c, 24, 260, 50, 30, P.a.maroon, { ink: 1.1, amp: 0.4 });
        for (let sy = 264; sy < 288; sy += 6) line(c, 27, sy, 70, sy, P.a.maroonLight, 1);
        // The meal mark: a bowl and an arrow, chalked on a step.
        alpha(c, 0.85, () => { c.strokeStyle = P.paper[3]; c.lineWidth = 0.9; c.beginPath(); c.arc(116, 156, 5, 0, Math.PI); c.stroke(); line(c, 110, 156, 122, 156, P.paper[3], 0.9); line(c, 126, 160, 136, 166, P.paper[3], 0.9); line(c, 136, 166, 131, 166, P.paper[3], 0.9); });
      },
      walls(c) { label(c, "TABLE", 58, 246, { size: 8, color: P.paper[2] }); label(c, "RETURN STAIR", 116, -30, { size: 8, color: P.paper[2] }); }
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
    if (s.kind === "frozen-load") {
      // A crate of Nell's work hung on the ledge chain, frozen solid by the
      // collectors' cold, right across the way to the table. Lowered, it sits on the floor.
      if (open) { box(ctx, s.x - 22, s.y + s.h - 12, 22, 14, P.wood[2], { ink: 1.2, amp: 0.3 }); rect(ctx, P.wood[3], s.x - 21, s.y + s.h - 11, 20, 2); return true; }
      line(ctx, s.x + s.w / 2, s.y - 70, s.x + s.w / 2, s.y + 4, P.metal[2], 1.6);
      box(ctx, s.x - 2, s.y + 4, s.w + 4, s.h - 8, P.wood[2], { ink: 1.4, amp: 0.3 });
      rect(ctx, P.wood[3], s.x - 1, s.y + 6, s.w + 2, 2);
      // Frost: their cold, in his way.
      ctx.save(); ctx.globalAlpha = 0.75;
      box(ctx, s.x - 3, s.y + 2, s.w + 6, 6, P.cold[2], { ink: false, amp: 0.4 });
      for (let y = s.y + 10; y < s.y + s.h - 6; y += 7) rect(ctx, P.cold[3], s.x + ((y * 3) % 9), y, 3, 1);
      for (const ix of [1, 7, 12]) shape(ctx, [s.x + ix, s.y + s.h - 4, s.x + ix + 2, s.y + s.h - 4, s.x + ix + 1, s.y + s.h + 2], P.cold[3], { ink: false });
      ctx.restore();
      return true;
    }
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
    if (s.kind === "shutter-door") {
      // Window Hall's staff door: his kind of door, cold steel with the mark. Open, cold light spills out.
      if (open) {
        rect(ctx, P.ink, s.x, s.y, s.w, s.h);
        alpha(ctx, 0.8, () => rect(ctx, P.cold[1], s.x + 3, s.y + 3, s.w - 3, s.h - 6));
        alpha(ctx, 0.3, () => shape(ctx, [s.x, s.y, s.x, s.y + s.h, s.x - 46, s.y + s.h + 16, s.x - 46, s.y - 16], P.cold[3], { ink: false }));
        box(ctx, s.x + s.w - 6, s.y - 18, 6, 18, P.metal[2], { ink: 1, amp: 0.05 });
        return true;
      }
      box(ctx, s.x, s.y, s.w, s.h, P.metal[1], { ink: 1.4, amp: 0.05 });
      for (let y = s.y + 3; y < s.y + s.h - 1; y += 3) rect(ctx, P.metal[0], s.x + 1, y, s.w - 2, 1);
      A.mark(ctx, s.x + s.w / 2, s.y + s.h / 2, 8, P.cold[2]);
      label(ctx, "STAFF", s.x + s.w / 2 + 1, s.y + 6, { size: 3.6, color: P.cold[3], weight: 900 });
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
    if (geo.id === "windowgate" && sim.flags.windowOpen) {
      // The window is open: the shutter rolled up, cold white light, nobody kind behind it.
      const c = geo.solids.find(item => item.id === "counter");
      box(ctx, c.x + c.w / 2 - 26, c.y + 2, 52, 18, P.ink, { ink: 1.2, amp: 0.1 });
      rect(ctx, P.cold[2], c.x + c.w / 2 - 24, c.y + 4, 48, 14);
      alpha(ctx, 0.6, () => rect(ctx, "#ffffff", c.x + c.w / 2 - 22, c.y + 6, 44, 4));
      box(ctx, c.x + c.w / 2 - 26, c.y - 2, 52, 5, P.metal[1], { ink: 1, amp: 0.05 });
      A.mark(ctx, c.x + c.w / 2, c.y + 12, 8, P.suit[1]);
    }
    if (geo.id === "receiving" && room.dryPatch != null) {
      // Her clearing gesture has a visible result at Rizo's height.
      box(ctx, 184, 98, 44, 26, P.wood[2], { ink: 1, amp: 0.4 });
      rect(ctx, P.wood[3], 185, 99, 42, 3);
      sheet(ctx, 206, 100, 18, 14, 23, P.paper[2]);
    }
    if (geo.id === "drytable" && (room.cornerAt != null || s.sim.flags.rowsCatch)) {
      // The rough corner she fixed stays smooth when he walks past it again.
      tape(ctx, 126, 162, 15, -0.4, 60);
      stitches(ctx, 121, 160, 133, 164, P.paper[2], 3, 1, 0.7);
    }
    for (const prop of geo.props) {
      if (!present(prop, sim.flags)) continue;
      if (prop.kind === "warm" && prop.id !== "latch-jam") {
        // Each reachable catch visibly belongs to a load, door or brake.
        const end = { "ledge-catch": [292, 30], "work-catch": [200, 158], "low-catch": [306, 66], "grille-catch": [14, 92], "brake-release": [284, 248], "shutter-release": [172, 16], "low-board": [150, 186] }[prop.id];
        if (end) { line(ctx, prop.x, prop.y, end[0], end[1], P.ink, 4); line(ctx, prop.x, prop.y, end[0], end[1], P.metal[2], 1.6); rivet(ctx, end[0], end[1], 1.4); }
        warmCatch(ctx, prop, t);
      }
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
      // The source of its small pool is a lamp fixed to the moving frame.
      box(ctx, x - 4, y - 22, 8, 6, P.service[1], { ink: 0.9, amp: 0.1 });
      rect(ctx, P.sodium[2], x - 2, y - 20, 4, 3);
      box(ctx, x - 18, y - 30, 36, 18, P.metal[2], { ink: 1.3, amp: 0.1 });
      for (let k = 0; k < 4; k += 1) rect(ctx, P.metal[1], x - 15 + k * 9, y - 28, 2, 14);
      rect(ctx, P.a.mustard, x - 22, y + 6, 44, 2.6);
      if (room.carriage.moving && !s.reduced) alpha(ctx, 0.5, () => { for (const dx of [-26, 26]) rect(ctx, P.paper[2], x + dx, y - 2 + Math.sin(s.time / 60) * 2, 1.4, 1.4); });
      // A stopped carriage rests against a tangible stop; the brake being
      // released changes its handle, rather than only a hidden flag.
      if (sim.flags.rowsPressStop) {
        box(ctx, 278, y - 8, 12, 16, P.service[2], { ink: 1.2, amp: 0.1 });
        line(ctx, 284, 210, 284, 236, sim.flags.rowsBrake ? P.a.brass : P.metal[2], 2);
        oval(ctx, 284, 210, 3, 3, sim.flags.rowsBrake ? P.a.brassLight : P.metal[3], true, 1);
      }
    }
    if (geo.id === "press" && room.screen) {
      // The canvas screen she braces between him and the pass.
      box(ctx, 66, 268, 60, 26, P.paper[2], { ink: 1.3, amp: 0.4 });
      for (const x of [66, 124]) box(ctx, x - 1, 262, 4, 34, P.wood[2], { ink: 1, amp: 0.1 });
      stitches(ctx, 70, 280, 120, 280, P.paper[0], 3, 1, 0.6);
    }
  }
  function belowOver(ctx, geo, s) {
    const carriage = s.extras.room?.carriage;
    if (geo.id !== "press" || !carriage) return;
    const track = geo.track;
    // A work hazard, not an attack: a mustard direction tab, a stop bar when
    // parked. The safe space is outside the two actual rail edges.
    ctx.save(); ctx.strokeStyle = P.a.mustard; ctx.lineWidth = 1.7;
    if (carriage.moving) {
      const dir = Math.sign((carriage.target ?? (carriage.dir > 0 ? track.x1 : track.x0)) - carriage.x) || carriage.dir;
      const x = carriage.x + dir * 28;
      ctx.beginPath(); ctx.moveTo(x - dir * 5, track.y - 4); ctx.lineTo(x, track.y); ctx.lineTo(x - dir * 5, track.y + 4); ctx.stroke();
    } else if (s.sim.flags.rowsPressStop) {
      ctx.beginPath(); ctx.moveTo(carriage.x + 25, track.y - 9); ctx.lineTo(carriage.x + 25, track.y + 9); ctx.stroke();
    }
    ctx.restore();
  }
  function rowsLights(geo, s, list) {
    const room = s.extras.room || {};
    for (const [x, y, r, strength, warm] of WORK_LIGHTS[geo.id] || []) list.push({ x, y, r, strength, warm });
    if (geo.id === "lowrun") list.push({ x: 140, y: 214, r: 80, strength: 0.3, warm: 0.8 });
    if (geo.id === "upper") list.push({ x: 306, y: 110, r: 110, strength: 0.65, warm: 0.5 });
    if (geo.id === "windowgate") for (const y of [43, 163, 223]) list.push({ x: 310, y, r: 65, strength: 0.5, warm: 0.6 });
    if (geo.id === "windowgate" && s.sim.flags.windowOpen) list.push({ x: 160, y: 40, r: 110, strength: 0.85, warm: 0 }, { x: 296, y: 190, r: 70, strength: 0.6, warm: 0 });
    if (geo.id === "drytable" && room.board) list.push({ x: 156, y: 150, r: 60, strength: 0.5, warm: 0.8 });
    if (geo.id === "press" && room.carriage) list.push({ x: room.carriage.x, y: geo.track.y - 20, r: 40, strength: 0.25, warm: 0.2 });
  }

  function belowStatic(c, geo, m) {
    rect(c, P.void, -m.mx, -m.my, geo.w + m.mx * 2, geo.h + m.my * 2);
    const decor = ROOMS[geo.id] || {}, style = FACE[geo.id] || FACE.clatter;
    decor.beyond?.(c, geo, m);
    serviceSurround(c, geo, m);
    decor.floor?.(c, geo, m);
    for (const s of geo.solids) if (!s.openWhen && !s.when && s.kind === "wall") solidStatic(c, s, geo, style);
    decor.walls?.(c, geo, m);
    for (const s of geo.solids) if (!s.openWhen && !s.when && s.kind !== "wall") solidStatic(c, s, geo, style);
    for (const [x, y] of WORK_LIGHTS[geo.id] || []) workLamp(c, x, y);
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
    thresholds(ctx, geo, s);
    for (const solid of geo.solids) if (solid.openWhen || solid.when) dynamicSolid(ctx, solid, sim, t, geo);
    if (geo.id === "eyelet") {
      // The staff door Orr comes through with the food: one-way (no handle on
      // this side, a kick plate at tray height), the kitchen's warmth in its
      // wired window; it swings open while he passes. Not a way on for Rizo.
      const orr = (s.extras.npcs || []).find(actor => actor.id === "orr");
      const passing = orr && orr.x > 262;
      if (passing) {
        rect(ctx, P.ink, 300, 76, 20, 40); alpha(ctx, 0.8, () => rect(ctx, P.ember[1], 303, 79, 14, 34));
        alpha(ctx, 0.3, () => shape(ctx, [300, 76, 300, 116, 250, 128, 250, 70], P.ember[3], { ink: false }));
      } else {
        box(ctx, 300, 76, 20, 40, P.service[1], { ink: 1.4, amp: 0.2 });
        rect(ctx, P.service[2], 301, 77, 18, 2);
        box(ctx, 304, 82, 12, 9, P.sodium[1], { ink: 1, amp: 0.1 }); for (const gx of [308, 312]) rect(ctx, P.ink, gx, 82, 0.7, 9); rect(ctx, P.ink, 304, 86.2, 12, 0.7);
        rect(ctx, P.metal[2], 302, 104, 16, 7); rect(ctx, P.metal[3], 302, 104, 16, 1.2);
      }
    }
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
      // His calling card, wherever something was taken (story spine v0.4).
      if (prop.id.startsWith("card-")) { A.callingCard(ctx, prop.x, prop.y, { angle: prop.x % 2 ? -0.3 : 0.25 }); continue; }
      if (prop.kind === "bowl") { A.callingCard(ctx, prop.x + 7, prop.y + 4, { angle: 0.35 }); A.bowl(ctx, prop.x, prop.y, { frost: true }); }
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
    let ambient = { color: [10, 7, 5], alpha: 0.43 };
    if (geo.id === "slip") {
      // The Slip is dark: he finds it by his own light. Faint grey far above,
      // where the rain light was; total black while he comes to.
      const room = s.extras.room || {};
      list.push({ x: 160, y: -40, r: 80, strength: 0.3 });
      const waking = room.wakeAt != null && (s.extras.sceneTime || 0) - room.wakeAt < 4000;
      ambient = { color: [4, 3, 3], alpha: waking ? 0.985 : 0.9 };
    }
    if (geo.id === "clatter") list.push({ x: 290, y: 40, r: 60, strength: 0.5, warm: 0.4 });
    if (geo.id === "queue") list.push({ x: 160, y: 0, r: 40, strength: 0.4, warm: 0.6 });
    if (geo.hearth) {
      const lit = Boolean(sim.hearthLit), t = s.reduced ? 0 : s.time;
      const breathe = lit ? 1 + Math.sin(t / 180) * 0.025 + Math.sin(t / 67) * 0.015 : 1;
      // The sanctuary: one warm pool around the fire and the bench; the corners stay dark.
      list.push({ x: geo.hearth.x - 10, y: geo.hearth.y + 12, r: (lit ? 150 : 50) * breathe, strength: lit ? 1.2 : 0.4, warm: lit ? 1 : 0.4, flat: 0.62 });
      ambient = { color: lit ? [14, 7, 4] : [8, 7, 8], alpha: lit ? 0.4 : 0.5 };
    }
    if (geo.id === "porter") {
      ambient = { color: [8, 6, 6], alpha: 0.54 };
      const porterEnemy = sim.enemies.find(enemy => enemy.kind === "porter");
      if (porterEnemy) list.push({ x: porterEnemy.x, y: porterEnemy.y - 10, r: porterEnemy.state === "settled" ? 50 : 96, strength: 0.85, warm: 0.6 });
      if (sim.flags?.porterDown) list.push({ x: 180, y: 20, r: 170, strength: 1.1, warm: 0.9 });
      if (sim.flags?.alcoveOpen) list.push({ x: 24, y: 142, r: 50, strength: 0.8, warm: 0.7 });
    }
    rowsLights(geo, s, list);
    if (geo.id === "lowrun") ambient = { color: [8, 5, 4], alpha: 0.48 };
    return { ambient, list };
  }

  // ===================== THE COLLECTION: HIS BUILDING (v0.5) =====================
  // Cold white tile, steel, black trim, his mark on everything. Nothing here
  // has been mended and nothing is warm: Rizo is the only warm colour in it.
  //   longhall   a hall built for waiting in line, every window shut on you
  //   intake     a clean room for tagging things, two hoods on a bad shift
  //   collection shelves of bell jars, a small light holding still in each
  //   vents      the only dirty place in the building, and the only way out
  //   factory    belts of empty jars, lamps on the walkways, rain at the door
  const COLD = Object.freeze({ tile: ["#28313a", "#2e3841"], grout: "#1a2128", wall: ["#9aa9b3", "#b8c9d4", "#d6e1e8", "#eef5f9"], trim: P.suit[1], floorDark: ["#13161b", "#171b21"] });
  const COLD_FACE = { upper: [COLD.wall[0], COLD.wall[1], COLD.wall[2], COLD.wall[3]], lower: [P.suit[0], P.suit[1], P.suit[2], P.suit[3]], dado: 0.72, edge: COLD.wall[2] };
  function coldTileWall(c, x, y, w, h, seed) {
    // Glazed white tile, a black skirting: clean enough to see your breath on.
    A.tiles(c, x, y, w, h, `wall${seed}`, { size: 8, colors: [COLD.wall[1], COLD.wall[2]], grout: COLD.wall[0] });
    rect(c, P.suit[1], x, y + h - 3, w, 3);
    alpha(c, 0.2, () => rect(c, "#ffffff", x, y + 1, w, 1));
  }
  function coldWall(c, s, geo) {
    rect(c, P.suit[1], s.x, s.y, s.w, s.h);
    const bottom = s.y + s.h;
    if (bottom < geo.h - 1 && s.w >= 12) {
      const face = Math.min(12, s.h - 2);
      coldTileWall(c, s.x, bottom - face, s.w, face, s.x * 7 + s.y);
      alpha(c, 0.32, () => rect(c, P.ink, s.x, bottom, s.w, 4));
    } else rect(c, COLD.wall[0], s.x, s.y, s.w, 1.2);
    if (s.h > s.w * 1.6) { const inner = s.x + s.w / 2 < geo.w / 2 ? s.x + s.w - 1.4 : s.x; rect(c, COLD.wall[1], inner, s.y, 1.4, s.h); }
  }
  // The back wall in cutaway above every room, and the dark around it.
  function buildingSurround(c, geo, m) {
    const depth = Math.min(80, m.my - 4);
    coldTileWall(c, 0, -depth, geo.w, depth, `back${geo.id}`);
    rect(c, P.suit[0], 0, -depth, geo.w, 4);
    // His mark as a frieze, cold on the tile.
    for (let x = 40; x < geo.w; x += 120) A.mark(c, x, -depth / 2, 14, P.cold[1]);
    for (const x of [-12, geo.w + 4]) { box(c, x, -depth, 8, geo.h + depth + 20, P.metal[1], { ink: 1, amp: 0.05 }); rect(c, P.metal[2], x + 1.5, -depth, 1.2, geo.h + depth + 20); }
    rect(c, P.suit[0], 0, geo.h, geo.w, 30);
  }
  function stencil(c, text, x, y, o = {}) { alpha(c, o.alpha ?? 0.55, () => label(c, text, x, y, { size: o.size || 6, color: o.color || P.a.mustard, weight: 900, jitter: 0.3, angle: o.angle || 0 })); }
  function frostedPane(c, x, y, w, h, o = {}) {
    box(c, x, y, w, h, P.suit[1], { ink: 1, amp: 0.05 });
    alpha(c, 0.8, () => rect(c, P.cold[1], x + 1.5, y + 1.5, w - 3, h - 3));
    alpha(c, 0.35, () => { for (let k = 0; k < 3; k += 1) rect(c, P.cold[3], x + 2 + k * (w / 3), y + 2, 1, h - 4); });
    if (o.sign) { box(c, x + w / 2 - 7, y + h / 2 - 3, 14, 6, P.paper[3], { ink: 0.6, amp: 0.05 }); label(c, o.sign, x + w / 2, y + h / 2 + 1.6, { size: 3.2, color: P.a.red, weight: 900 }); }
  }
  function steelDoor(c, x, y, w, h, o = {}) {
    box(c, x, y, w, h, P.metal[1], { ink: 1.3, amp: 0.05 });
    rect(c, P.metal[2], x + 1, y + 1, w - 2, 1.4);
    if (w < h) { rect(c, P.metal[0], x + w / 2 - 0.5, y + 3, 1, h - 6); A.mark(c, x + w / 2, y + h / 2, 7, P.cold[2]); }
    else { rect(c, P.metal[0], x + 3, y + h / 2 - 0.5, w - 6, 1); A.mark(c, x + w / 2, y + h / 2, 7, P.cold[2]); }
    if (o.shut) for (let k = 0; k < 3; k += 1) rect(c, P.a.mustard, x + (w < h ? 1 : 3 + k * (w - 6) / 3), y + (w < h ? 3 + k * (h - 6) / 3 : 1), w < h ? w - 2 : 2, w < h ? 2 : h - 2);
  }
  // Where each shelf's jars stand (the same for the cached shelf and its lights).
  const SHELF_JARS = new Map();
  function shelfJars(s) {
    if (SHELF_JARS.has(s.id)) return SHELF_JARS.get(s.id);
    const random = rng(`jars${s.id}`), out = [];
    for (let x = s.x + 7; x < s.x + s.w - 5; x += 11) out.push({ x: x + random() * 2, y: s.y + 5, size: 0.55, tag: false, glow: -6.2 * 0.55 });
    for (let x = s.x + 6; x < s.x + s.w - 5; x += 12) out.push({ x: x + random() * 2, y: s.y + s.h - 2, size: 0.68, tag: random() < 0.5, glow: -7.4 * 0.68 });
    SHELF_JARS.set(s.id, out);
    return out;
  }
  const BUILDING_SOLIDS = {
    "cold-door"(c, s) { steelDoor(c, s.x, s.y, s.w, s.h, { shut: true }); },
    chute(c, s) {
      // RETURNS: a steel flap in the wall at the end of the hall, polished by use.
      box(c, s.x - 4, s.y - 2, s.w + 8, s.h + 6, P.metal[1], { ink: 1.3, amp: 0.05 });
      box(c, s.x + 2, s.y + 2, s.w - 4, s.h - 2, P.suit[0], { ink: 1, amp: 0.05 });
      rect(c, P.metal[3], s.x + 3, s.y + 3, s.w - 6, 2);
      label(c, "RETURNS", s.x + s.w / 2, s.y - 5, { size: 5, color: P.cold[3], weight: 900 });
      A.mark(c, s.x + s.w / 2, s.y + s.h / 2 + 2, 7, P.cold[1]);
    },
    "queue-rail"(c, s) {
      // Chrome stanchions and a black belt: a line for waiting in, nobody in it.
      alpha(c, 0.3, () => rect(c, P.ink, s.x, s.y + s.h, s.w, 4));
      line(c, s.x + 2, s.y + 1, s.x + s.w - 2, s.y + 1, P.suit[0], 3);
      for (let x = s.x + 3; x <= s.x + s.w - 3; x += 26) { oval(c, x, s.y + s.h, 3.4, 1.6, P.metal[1], true, 0.8); line(c, x, s.y + s.h, x, s.y - 8, P.metal[3], 1.8); oval(c, x, s.y - 8, 1.6, 1.4, P.metal[3], true, 0.6); }
      line(c, s.x + 3, s.y - 6, s.x + s.w - 3, s.y - 6, P.suit[1], 1.6);
    },
    "steel-bench"(c, s) {
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 3);
      box(c, s.x, s.y, s.w, s.h, P.metal[2], { ink: 1.2, amp: 0.05 });
      for (let x = s.x + 3; x < s.x + s.w - 2; x += 5) rect(c, P.metal[1], x, s.y + 2, 2, s.h - 4);
      for (const x of [s.x + 4, s.x + s.w - 7]) rect(c, P.suit[1], x, s.y + s.h, 3, 4);
    },
    "stamp-desk"(c, s) {
      // The capped one's desk: a stamp, an ink pad, tags stacked square.
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.metal[2], { ink: 1.3, amp: 0.05 });
      rect(c, P.metal[3], s.x + 1, s.y + 1, s.w - 2, 2);
      for (let k = 0; k < 3; k += 1) box(c, s.x + 6 + k * 9, s.y + 5 - k, 7, 5, P.paper[2], { ink: 0.6, amp: 0.05 });
      box(c, s.x + 40, s.y + 8, 10, 6, P.suit[1], { ink: 0.8, amp: 0.05 }); box(c, s.x + 54, s.y + 4, 6, 10, P.wood[2], { ink: 0.8, amp: 0.1 }); rect(c, P.suit[0], s.x + 53, s.y + 13, 8, 2);
      // LOOK: the tag roll feeds this desk; blank strips are being stamped.
      const tx = s.x + Math.min(s.w - 9, 66);
      oval(c, tx, s.y + 7, 5, 4.4, P.paper[2], true, 0.8);
      oval(c, tx, s.y + 7, 2, 1.7, P.suit[1]);
      rect(c, P.paper[2], tx - 2, s.y + 10, Math.min(14, s.w / 3), 2.2);
      for (let k = 0; k < 3; k += 1) line(c, tx + k * 3, s.y + 10, tx + k * 3, s.y + 12.2, P.metal[1], 0.6);
    },
    cage() {},
    "crate-cold"(c, s) {
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2 + 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.metal[1], { ink: 1.3, amp: 0.05, seed: s.x });
      rect(c, P.metal[2], s.x + 1, s.y + 1, s.w - 2, s.h * 0.3);
      A.mark(c, s.x + s.w / 2, s.y + s.h * 0.62, 8, P.cold[2]);
      stencil(c, "1,2", s.x + s.w / 2, s.y + s.h - 2, { size: 3.6, color: P.cold[3], alpha: 0.4 });
    },
    "jar-shelf"(c, s) {
      // Identical jars in an actual catalogued rack, not floating on a block.
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.suit[2], { ink: 1.3, amp: 0.05 });
      rect(c, P.metal[0], s.x + 3, s.y + 4, s.w - 6, s.h - 8);
      for (const sy of [s.y + 10, s.y + s.h - 3]) {
        rect(c, P.metal[2], s.x + 1, sy, s.w - 2, 2);
        rect(c, P.metal[3], s.x + 1, sy, s.w - 2, 0.75);
      }
      for (const jar of shelfJars(s)) A.jar(c, jar.x, jar.y, { size: jar.size, t: 0, tag: jar.tag, dim: true });
      for (const sx of [s.x + 1.5, s.x + s.w - 4]) {
        rect(c, P.metal[1], sx, s.y, 2.5, s.h);
        for (const sy of [s.y + 5, s.y + s.h / 2, s.y + s.h - 4]) rivet(c, sx + 1, sy, 0.65);
      }
      rect(c, P.metal[2], s.x, s.y, s.w, 2);
      box(c, s.x + 4, s.y + s.h - 8, Math.min(22, s.w - 8), 5, P.paper[2], { ink: 0.6, amp: 0.03 });
      stencil(c, "NO.", s.x + Math.min(15, s.w / 2), s.y + s.h - 4, { size: 3.2, color: P.suit[1], alpha: 0.9 });
    },
    "ledger-desk"(c, s) {
      drop(c, s.x + s.w / 2, s.y + s.h + 2, s.w / 2, 4);
      box(c, s.x, s.y, s.w, s.h, P.suit[2], { ink: 1.3, amp: 0.05 });
      // The ledger, open: columns and columns.
      box(c, s.x + 10, s.y + 3, 30, 16, P.paper[2], { ink: 0.9, amp: 0.05 }); line(c, s.x + 25, s.y + 3, s.x + 25, s.y + 19, P.paper[0], 0.8);
      for (let y = s.y + 6; y < s.y + 18; y += 2.4) { rect(c, P.ink, s.x + 12, y, 10, 0.5); rect(c, P.ink, s.x + 27, y, 10, 0.5); }
      // A cold desk lamp.
      line(c, s.x + 58, s.y + 18, s.x + 54, s.y + 4, P.metal[2], 1.4); shape(c, [s.x + 48, s.y + 2, s.x + 58, s.y, s.x + 60, s.y + 5, s.x + 50, s.y + 7], P.suit[1], { ink: 0.8, amp: 0.05 });
      // The jar with his name on it, clean, lid off, waiting.
      A.jar(c, s.x + 82, s.y + 18, { size: 1.05, t: 0, tag: true, frost: false });
    },
    "vent-grate"() {},
    "vent-hatch"(c, s) { box(c, s.x, s.y, s.w, s.h, P.metal[1], { ink: 1.2, amp: 0.05 }); for (let x = s.x + 3; x < s.x + s.w - 2; x += 4) rect(c, P.suit[0], x, s.y + 3, 2, s.h - 6); },
    "rail-cold"(c, s) {
      line(c, s.x, s.y + 2, s.x + s.w, s.y + 2, P.metal[3], 2);
      for (let x = s.x + 2; x < s.x + s.w; x += 18) line(c, x, s.y + 2, x, s.y + s.h + 6, P.metal[2], 1.4);
      alpha(c, 0.3, () => rect(c, P.ink, s.x, s.y + s.h + 4, s.w, 3));
      // LOOK: a worn clipboard left by the factory landing.
      const cx = s.x + s.w - 26, cy = s.y - 10;
      box(c, cx, cy, 13, 15, P.wood[1], { ink: 0.8, amp: 0.05 });
      box(c, cx + 2, cy + 2, 9, 11, P.paper[2], { ink: 0.4, amp: 0.02 });
      box(c, cx + 4.5, cy - 2, 4, 3, P.metal[2], { ink: 0.4, amp: 0.02 });
      for (let k = 0; k < 3; k += 1) line(c, cx + 4, cy + 5 + k * 2.5, cx + 10, cy + 5 + k * 2.5, P.inkSoft, 0.6);
    },
    machine(c, s) {
      // A machine nobody explains: a steel housing, a cold white window, pipes going up.
      drop(c, s.x + s.w / 2, s.y + s.h + 3, s.w / 2 + 3, 5);
      box(c, s.x, s.y, s.w, s.h, P.metal[1], { ink: 1.5, amp: 0.05, seed: s.x });
      rect(c, P.metal[2], s.x + 1, s.y + 1, s.w - 2, 4);
      box(c, s.x + s.w / 2 - 12, s.y + 9, 24, 14, P.cold[2], { ink: 1.1, amp: 0.05 });
      alpha(c, 0.5, () => rect(c, P.cold[3], s.x + s.w / 2 - 10, s.y + 11, 20, 3));
      for (const dx of [6, s.w - 10]) { line(c, s.x + dx, s.y, s.x + dx, s.y - 18, P.metal[2], 3); rivet(c, s.x + dx, s.y - 8, 1); }
      box(c, s.x + 5, s.y + s.h - 12, 8, 8, P.suit[1], { ink: 0.8, amp: 0.05 }); line(c, s.x + 9, s.y + s.h - 8, s.x + 11, s.y + s.h - 10, P.a.red, 0.8);
      A.mark(c, s.x + s.w - 12, s.y + s.h - 9, 8, P.cold[3]);
      for (let x = s.x + 3; x < s.x + s.w - 3; x += 8) rect(c, P.a.mustard, x, s.y + s.h - 2.4, 4, 2);
    },
    "crate-stack"(c, s) {
      drop(c, s.x + s.w / 2, s.y + s.h + 3, s.w / 2 + 3, 5);
      for (const [dx, dy, w, h] of [[0, 14, s.w * 0.55, s.h - 14], [s.w * 0.45, 18, s.w * 0.55, s.h - 18], [s.w * 0.2, 0, s.w * 0.55, 18]]) A.beltCrate(c, s.x + dx + w / 2, s.y + dy + h / 2 + 6, w, h, { seed: s.x + dx });
    },
    "loading-door"(c, s) {
      // An overhead roller shutter with a clear view of the rainy outdoors.
      box(c, s.x - 20, s.y - 11, s.w + 40, 11, P.metal[2], { ink: 1.2, amp: 0.05 });
      for (const side of [s.x - 8, s.x + s.w + 5]) {
        box(c, side, s.y - 9, 3, s.h + 9, P.metal[1], { ink: 0.8, amp: 0.03 });
        rivet(c, side + 1, s.y - 6, 0.7);
      }
      for (let sy = s.y - 7; sy < s.y; sy += 3) rect(c, P.metal[0], s.x - 7, sy, s.w + 14, 0.9);
      stencil(c, "LOADING", s.x + s.w / 2, s.y - 13, { size: 6, color: P.a.mustard });
    },
    duct(c, s) {
      rect(c, P.suit[1], s.x, s.y, s.w, s.h);
      alpha(c, 0.55, () => { for (let x = s.x + 10; x < s.x + s.w; x += 20) rect(c, P.suit[2], x, s.y + 9, 1, 2); });
    },
    "shutter-door"() {}
  };
  Object.assign(SOLIDS, BUILDING_SOLIDS);

  const BUILDING = {
    longhall: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "longhall", { size: 20, colors: COLD.tile, grout: COLD.grout });
        // Polished down the middle by a lot of waiting.
        alpha(c, 0.07, () => rect(c, "#ffffff", 120, 0, 80, geo.h));
        // The queue line painted on the floor, and the hall's instructions.
        alpha(c, 0.45, () => {
          c.save(); c.strokeStyle = P.a.mustard; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath();
          c.moveTo(44, 1060); c.lineTo(266, 1010); c.lineTo(266, 912); c.lineTo(52, 908); c.lineTo(52, 810); c.lineTo(266, 808); c.lineTo(266, 740); c.lineTo(160, 700); c.lineTo(160, 60); c.stroke(); c.restore();
        });
        for (const [y, text] of [[1004, "PLEASE WAIT"], [900, "PLEASE WAIT"], [800, "KEEP MOVING"], [520, "STAND CLEAR"], [140, "RETURNS"]]) stencil(c, text, 160, y, { size: 7 });
        // The night gate's track across the hall, with hazard paint.
        for (let x = 20; x < 300; x += 12) { rect(c, P.a.mustard, x, 452, 6, 4); rect(c, P.suit[0], x + 6, 452, 6, 4); }
        // The side door the gate leaves open for staff (west, away from his way on).
        steelDoor(c, 0, 384, 20, 30);
      },
      walls(c, geo) {
        // Service windows all the way along both walls, every one shut.
        for (let y = 80; y < 1040; y += 62) for (const side of ["w", "e"]) {
          if ((geo.lampWindows || []).some(win => win.side === side && Math.abs(win.y - y) < 40)) continue;
          if (side === "w" && y > 360 && y < 430) continue;
          frostedPane(c, side === "w" ? 6 : 302, y, 12, 22, { sign: (y / 62) % 3 < 1 ? "SHUT" : null });
        }
        for (const win of geo.lampWindows || []) frostedPane(c, win.side === "w" ? 4 : 300, win.y - 2, 16, win.h + 4);
        // A heavy roller-gate housing whose shutter drops from real tracks.
        box(c, 16, 430, 288, 12, P.metal[1], { ink: 1.2, amp: 0.05 });
        rect(c, P.metal[3], 20, 433, 280, 1.5);
        for (let gx = 30; gx < 292; gx += 22) rivet(c, gx, 438, 1);
        for (const gx of [16, 298]) {
          box(c, gx, 430, 6, 33, P.suit[1], { ink: 1.1, amp: 0.05 });
          rect(c, P.metal[3], gx + 2, 432, 1, 29);
        }
        label(c, "THE LONG HALL", 80, -30, { size: 8, color: P.suit[2] });
      }
    },
    intake: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "intake", { size: 16, colors: ["#2f3a42", "#35414a"], grout: COLD.grout });
        // A floor drain in the middle of the room. For hosing down.
        oval(c, 170, 220, 9, 6, P.suit[1], true, 1); for (let k = -6; k <= 6; k += 3) rect(c, P.metal[2], 170 + k - 0.5, 216, 1, 8);
        // Yellow at the door: KEEP CLEAR.
        for (let y = 236; y < 286; y += 10) { rect(c, P.a.mustard, 284, y, 16, 5); }
        stencil(c, "INTAKE", 160, 300, { size: 8, color: P.cold[2], alpha: 0.35 });
      },
      walls(c) {
        // The rules, and the employee of every month.
        box(c, 36, 2, 32, 15, P.paper[3], { ink: 0.8, amp: 0.1 }); label(c, "DO NOT FEED", 52, 8, { size: 3.2, color: P.a.red, weight: 900 }); label(c, "DO NOT NAME", 52, 12.4, { size: 3.2, color: P.a.red, weight: 900 }); label(c, "too late (bean)", 52, 16, { size: 2.6, color: P.wood[1], jitter: 0.6 });
        box(c, 136, 1, 28, 17, P.metal[2], { ink: 0.8, amp: 0.05 }); box(c, 143, 3, 14, 10, P.paper[1], { ink: 0.6, amp: 0.05 }); oval(c, 150, 7, 3, 3, P.cloth[1]); rect(c, P.cloth[0], 146, 4, 8, 2); label(c, "EMPLOYEE OF THE MONTH", 150, 16.6, { size: 2.2, color: P.paper[3], weight: 900 });
        A.speaker(c, 104, 10);
        label(c, "INTAKE", 260, -30, { size: 8, color: P.suit[2] });
      }
    },
    collection: {
      floor(c, geo) {
        A.tiles(c, 0, 0, geo.w, geo.h, "collection", { size: 40, colors: COLD.floorDark, grout: "#0d0f13" });
        alpha(c, 0.06, () => { for (let y = 60; y < geo.h; y += 100) rect(c, P.cold[3], 20, y, 280, 1); });
        stencil(c, "QUIET", 160, 540, { size: 7, color: P.cold[2], alpha: 0.3 });
      },
      walls(c) { label(c, "THE COLLECTION", 90, -30, { size: 8, color: P.suit[2] }); }
    },
    factory: {
      floor(c, geo) {
        A.concrete(c, 0, 0, geo.w, geo.h, "factory", { tone: ["#1c2024", "#24292e", "#2e343a", "#3d444b"], joint: 60 });
        // The stair down from the vent landing.
        for (let y = 96; y < 150; y += 8) { box(c, 22, y, 40, 7, P.metal[1], { ink: 0.9, amp: 0.05 }); rect(c, P.metal[2], 23, y + 1, 38, 1.2); }
        // Walkways for the staff, painted yellow, and their stencils.
        for (const y of [112, 272, 424]) { rect(c, P.a.mustard, 64, y - 1, 220, 1.6); rect(c, P.a.mustard, 64, y + 17, 220, 1.6); stencil(c, "WALKWAY", 250, y + 12, { size: 5 }); }
        // Connecting utility line: all three machines receive from one run.
        const pipe = [[64, 243], [250, 241], [160, 391]];
        for (let k = 1; k < pipe.length; k += 1) {
          const a = pipe[k - 1], b = pipe[k];
          line(c, a[0], a[1], b[0], b[1], P.metal[0], 6);
          line(c, a[0], a[1], b[0], b[1], P.metal[2], 2);
          rivet(c, a[0], a[1], 1.6);
        }
        // The loading bay: tyre marks and wet under the door.
        alpha(c, 0.35, () => { rect(c, P.wet[2], 130, 640, 60, 60); for (const x of [128, 182]) rect(c, P.ink, x, 560, 6, 140); });
        // His jars come in here empty.
        stencil(c, "OUTBOUND", 160, 630, { size: 7, color: P.cold[2], alpha: 0.4 });
      },
      walls(c, geo) {
        for (const y of [200, 420, 620]) { A.speaker(c, 12, y); A.speaker(c, 308, y + 60); }
        label(c, "THE FACTORY FLOOR", 90, -30, { size: 8, color: P.suit[2] });
      }
    }
  };
  // Belts: rails both sides, slats that move, and what rides on them.
  function belt(ctx, b, w, t) {
    rect(ctx, P.suit[1], 20, b.y, w - 40, b.h);
    const shift = ((b.dir * b.speed * t) / 1000) % 10;
    alpha(ctx, 0.8, () => { for (let x = 20 + ((shift % 10) + 10) % 10; x < w - 20; x += 10) rect(ctx, P.metal[0], x, b.y + 3, 2, b.h - 6); });
    for (const y of [b.y, b.y + b.h - 3]) { rect(ctx, P.metal[2], 20, y, w - 40, 3); for (let x = 26; x < w - 20; x += 24) rivet(ctx, x, y + 1.5, 0.8); }
    // Direction chevrons on the rail.
    for (let x = 40; x < w - 30; x += 60) { const cx = x + (b.dir > 0 ? 0 : 6); line(ctx, cx, b.y - 4, cx + 4 * b.dir, b.y - 2, P.a.mustard, 1.2); line(ctx, cx + 4 * b.dir, b.y - 2, cx, b.y, P.a.mustard, 1.2); }
  }
  function buildingStatic(c, geo, m) {
    rect(c, P.suit[0], -m.mx, -m.my, geo.w + m.mx * 2, geo.h + m.my * 2);
    const decor = BUILDING[geo.id] || {};
    buildingSurround(c, geo, m);
    decor.floor?.(c, geo, m);
    for (const solid of geo.solids) if (!solid.openWhen && !solid.when && solid.kind === "wall") coldWall(c, solid, geo);
    decor.walls?.(c, geo, m);
    for (const solid of geo.solids) if (!solid.openWhen && !solid.when && solid.kind !== "wall") solidStatic(c, solid, geo, COLD_FACE);
  }
  function buildingDynamic(ctx, geo, s) {
    const sim = s.sim, t = s.reduced ? 0 : s.time, room = s.extras.room || {};
    for (const solid of geo.solids) {
      if (!solid.openWhen && !solid.when) continue;
      const open = !present(solid, sim.flags);
      if (solid.kind === "vent-grate") {
        if (open) { rect(ctx, P.suit[0], solid.x, solid.y, solid.w, solid.h); alpha(ctx, 0.5, () => rect(ctx, P.metal[0], solid.x + 3, solid.y + 3, solid.w - 6, solid.h - 6)); }
        else { box(ctx, solid.x, solid.y, solid.w, solid.h, P.metal[2], { ink: 1.2, amp: 0.05 }); for (let x = solid.x + 3; x < solid.x + solid.w - 2; x += 4) rect(ctx, P.suit[0], x, solid.y + 3, 2, solid.h - 6); alpha(ctx, 0.85, () => { for (let x = solid.x + 2; x < solid.x + solid.w - 2; x += 5) shape(ctx, [x, solid.y + solid.h, x + 1.4, solid.y + solid.h + 4, x + 2.8, solid.y + solid.h], "#e8f2ff", { ink: 0.3, amp: 0.05 }); }); }
      }
    }
    if (geo.id === "longhall") {
      for (const win of geo.lampWindows || []) {
        const state = Core.lampWindowState(win, sim.t), x = win.side === "w" ? 4 : 300;
        const jitter = state === "tell" && !s.reduced ? Math.sin(s.time / 30) * 1.2 : 0;
        if (state === "on") {
          box(ctx, x, win.y - 2, 16, win.h + 4, P.metal[2], { ink: 1.2, amp: 0.05 });
          rect(ctx, P.cold[3], x + 1.5, win.y + 1, 13, win.h - 2);
          // Lens, rim, bolts: its light has a physical source.
          oval(ctx, x + 8, win.y + win.h / 2, 5.2, 5.2, P.metal[0], true, 0.7);
          oval(ctx, x + 8, win.y + win.h / 2, 3.5, 3.5, "#ffffff");
          rivet(ctx, x + 2, win.y, 0.7); rivet(ctx, x + 14, win.y, 0.7);
        } else {
          box(ctx, x, win.y - 2 + jitter, 16, (win.h + 4) * (state === "tell" ? 0.82 : 1), P.metal[1], { ink: 1.2, amp: 0.05 });
          for (let y = win.y; y < win.y + win.h; y += 3) rect(ctx, P.metal[0], x + 1, y + jitter, 14, 1);
          if (state === "tell") alpha(ctx, 0.9, () => rect(ctx, P.cold[3], x + 1, win.y + win.h * 0.82 + jitter, 14, 1.6));
        }
      }
      // The night gate: housing lights, then the shutter coming down.
      const gate = geo.dropGate, g = sim.gate;
      const k = g?.closed ? 1 : g?.startAt != null ? Math.min(1, (sim.t - g.startAt) / gate.closeMs) : 0;
      if (k > 0) {
        const blink = Math.floor((s.time || 0) / 200) % 2;
        if (k < 1) {
          // Coming down: the hazard paint flashes and the shutter's shadow grows on the floor under it.
          if (blink || s.reduced) alpha(ctx, 0.55, () => { for (let x = 20; x < 300; x += 12) rect(ctx, P.a.red, x, 452, 6, 4); });
          alpha(ctx, 0.4 * k, () => rect(ctx, P.ink, gate.x, gate.y + gate.h, gate.w, 4 + 14 * k));
        }
        for (const x of [24, 296]) oval(ctx, x, gate.y - 6, 3, 3, blink && k < 1 ? P.a.red : P.ember[1]);
        const face = 18 * k;
        box(ctx, gate.x, gate.y - face + gate.h * k, gate.w, face + 2, P.metal[1], { ink: 1.2, amp: 0.05 });
        for (let y = gate.y - face + gate.h * k + 3; y < gate.y + gate.h * k; y += 3) rect(ctx, P.metal[0], gate.x + 1, y, gate.w - 2, 1);
        if (k >= 1) { for (let x = gate.x; x < gate.x + gate.w; x += 14) rect(ctx, P.a.mustard, x, gate.y + gate.h - 3, 7, 3); A.mark(ctx, 160, gate.y + 2, 9, P.cold[2]); }
      }
      // Shut on the runner: it hits the gate, its lamp through the slats, then
      // turns and goes to find another way round.
      if (room.slamAt != null) {
        const age = (s.extras.sceneTime || 0) - room.slamAt;
        if (age < 1400) {
          const away = Math.max(0, (age - 600) / 800), shake = !s.reduced && age < 300 ? Math.sin(age / 20) * 2 : 0;
          const y = Math.max(gate.y + gate.h + 16, room.slamY - Math.min(age, 300) * 0.1);
          ctx.save(); ctx.globalAlpha = 1 - away;
          A.collector(ctx, room.slamX + shake - away * 40, y + away * 50, { face: away > 0 ? -1 : 1, state: away > 0 ? "run" : "slam", bob: 0, t });
          ctx.restore();
        }
      }
      // The side door swings when the runner comes round.
      if (room.sideDoorAt != null && (s.extras.sceneTime || 0) - room.sideDoorAt < 900) { rect(ctx, P.ink, 0, 384, 20, 30); alpha(ctx, 0.5, () => rect(ctx, P.cold[2], 16, 386, 4, 26)); }
      // The staff door behind him bursts open once, then swings shut.
      if (room.westDoorAt != null && (s.extras.sceneTime || 0) - room.westDoorAt < 700) { rect(ctx, P.ink, 0, 1040, 20, 40); alpha(ctx, 0.6, () => rect(ctx, P.cold[2], 14, 1042, 6, 36)); }
    }
    if (geo.id === "intake" && sim.cage) {
      A.cage(ctx, geo.cage, { loose: sim.cage.loose, notches: Content().ENEMIES.guard.notches, open: sim.cage.open, t: s.extras.sceneTime || 0, rattleAt: room.rattleAt, notchAt: room.notchAt, notchLostAt: room.notchLostAt });
    }
    if (geo.id === "collection") {
      for (const item of geo.jars) A.jar(ctx, item.x, item.y + 2, { size: 1.15, t, tag: true, ...jarMood(item, s) });
    }
    if (geo.id === "factory") {
      const time = s.reduced ? sim.t : sim.t;
      for (const b of geo.belts) belt(ctx, b, geo.w, s.reduced ? 0 : sim.t);
      // The machines are one line: each stamps in turn, top to bottom, a beat
      // apart, the press coming down on its window and a breath of cold out of its pipes.
      for (const [index, m] of geo.solids.filter(solid => solid.kind === "machine").entries()) {
        const k = machineStroke(geo.machineBeat, index, sim.t), cx = m.x + m.w / 2;
        const stroke = s.reduced ? 0 : k * 5;
        box(ctx, cx - 14, m.y - 7 + stroke, 28, 6, P.metal[2], { ink: 1.1, amp: 0.05 });
        rect(ctx, P.metal[3], cx - 13, m.y - 6 + stroke, 26, 1.2);
        line(ctx, cx, m.y - 18, cx, m.y - 7 + stroke, P.metal[3], 2.2);
        if (k > 0.5) alpha(ctx, (k - 0.5) * 1.4, () => rect(ctx, "#ffffff", cx - 10, m.y + 11, 20, 10));
        const breath = machineBreath(geo.machineBeat, index, sim.t);
        if (breath > 0 && !s.reduced) alpha(ctx, breath * 0.5, () => { for (const dx of [6, m.w - 10]) oval(ctx, m.x + dx + (1 - breath) * 3, m.y - 20 - (1 - breath) * 10, 3 + (1 - breath) * 4, 2 + (1 - breath) * 3, P.cold[3]); });
      }
      // His voice in every speaker: they light while he talks.
      if (room.speakerOn) for (const y of [200, 420, 620]) { alpha(ctx, 0.35, () => { oval(ctx, 12, y, 9, 7, P.cold[3]); oval(ctx, 308, y + 60, 9, 7, P.cold[3]); }); }
      // Half-open shutter framing real rain, not a black end-of-level wall.
      // The playable escape geometry is untouched.
      rect(ctx, P.ink, 142, 696, 36, 24);
      alpha(ctx, 0.92, () => rect(ctx, P.wet[1], 143, 701, 34, 19));
      box(ctx, 140, 688, 40, 12, P.metal[2], { ink: 1.2, amp: 0.05 });
      for (let sy = 690; sy < 698; sy += 3) rect(ctx, P.metal[0], 142, sy, 36, 1);
      rect(ctx, P.cold[2], 143, 700, 34, 1);
      alpha(ctx, 0.35, () => { for (let ix = 0; ix < 4; ix += 1) line(ctx, 145 + ix * 9, 707, 149 + ix * 7, 720, P.cold[3], 0.7); });
      if (!s.reduced) alpha(ctx, 0.6, () => { for (let index = 0; index < 8; index += 1) { const k = ((s.time / 600) + index * 0.13) % 1; rect(ctx, P.wet[3], 144 + ((index * 11) % 32), 700 - k * 26, 0.8, 3); } });
      void time;
    }
    for (const prop of geo.props) {
      if (!present(prop, sim.flags)) continue;
      if (prop.id.startsWith("card-")) A.callingCard(ctx, prop.x, prop.y, { angle: -0.4 });
      else if (prop.id === "grate-catch") warmCatch(ctx, prop, t);
    }
  }
  // The six he can reach: asleep, one he stands near stirs toward him; awake,
  // each watches him in its own way, and once he has promised, presses to the
  // glass, most of all when he is at the grate leaving.
  function jarMood(item, s) {
    const sim = s.sim, room = s.extras.room || {}, now = s.extras.sceneTime || 0, p = s.pos;
    const awake = Boolean(sim.flags[item.flag]);
    const look = Math.max(-1, Math.min(1, (p.x - item.x) / 40));
    const near = Math.hypot(p.x - item.x, p.y - item.y);
    const woke = room.wokeAt?.[item.id];
    const bloom = woke != null && now - woke < 900 ? 1 - (now - woke) / 900 : 0;
    // The promise: a wave along the woken ones, then they keep leaning his way.
    let press = 0;
    if (sim.flags.promised) press = p.y < 150 ? 1 : 0.45;
    if (room.promiseAt != null) { const k = (now - room.promiseAt - item.x * 3) / 700; if (k > 0 && k < 1) press = Math.max(press, Math.sin(k * Math.PI)); }
    return { awake, soul: item.id.replace("jar-", ""), look, stir: awake ? 0 : Math.max(0, 1 - near / 48), press: s.reduced ? Math.min(press, 0.45) : press, bloom: s.reduced ? 0 : bloom, t: s.reduced ? 0 : s.time };
  }
  // The factory line's beat (pure sim time, so pauses hold it): 0 at rest,
  // 1 with the press down. Each machine strikes one step (stepMs) after the one above.
  const machinePhase = (beat, index, t) => ((((t - index * beat.stepMs) % beat.cycleMs) + beat.cycleMs) % beat.cycleMs) / beat.cycleMs;
  function machineStroke(beat, index, t) {
    const k = machinePhase(beat, index, t), down = beat.strikeAt - 0.02, hit = beat.strikeAt + 0.02;
    if (k < down) return 0;
    if (k < hit) return (k - down) / 0.04;
    if (k < hit + 0.08) return 1;
    return Math.max(0, 1 - (k - hit - 0.08) / 0.1);
  }
  // Cold let out of its pipes just after the strike.
  function machineBreath(beat, index, t) { const k = machinePhase(beat, index, t), hit = beat.strikeAt + 0.02; return k >= hit ? Math.max(0, 1 - (k - hit) / 0.18) : 0; }
  // Belt goods are bodies: they sort with everyone else by depth.
  function buildingBodies(geo, s) {
    if (!geo.belts) return [];
    const out = [];
    for (const b of geo.belts) for (const item of Core.beltItems(b, s.sim.t, geo.w)) {
      if (item.x < -30 || item.x > geo.w + 30) continue;
      out.push({ y: item.y + item.h / 2, draw: ctx => (item.kind === "crate" ? A.beltCrate(ctx, item.x, item.y, item.w, item.h, { seed: item.id.length + b.y }) : A.jarTray(ctx, item.x, item.y, item.w, item.h)) });
    }
    return out;
  }
  // Drawn over Rizo (the front canvas): cage bars and crate fronts he is behind.
  function buildingFront(ctx, geo, s) {
    const p = s.pos;
    if (geo.id === "intake" && s.sim.cage && !s.sim.cage.open && Core.inCage(s.sim)) {
      const r = geo.cage;
      ctx.strokeStyle = P.metal[3]; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.9;
      for (let x = r.x + 3.5; x < r.x + r.w; x += 7) { ctx.beginPath(); ctx.moveTo(x, r.y - 4); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (geo.belts) for (const b of geo.belts) for (const item of Core.beltItems(b, s.sim.t, geo.w)) {
      if (item.kind !== "crate" || Math.abs(item.x - p.x) > item.w / 2 + 4 || p.y > item.y + item.h / 2 || p.y < item.y - item.h) continue;
      // He is pressed behind it: the crate's front hides his lower half.
      ctx.save(); ctx.beginPath(); ctx.rect(item.x - item.w / 2 - 2, item.y - item.h / 2 - 2, item.w + 4, item.h + 6); ctx.clip();
      A.beltCrate(ctx, item.x, item.y, item.w, item.h, { seed: item.id.length + b.y });
      ctx.restore();
    }
  }
  // Intake: where the small hood is looking, as light. Watching, his phone is
  // a torch on Rizo (or on the crate Rizo is behind, whose shadow keeps its
  // edge); looking away, it is a screen lighting his own mask. Just before he
  // looks back the torch stutters on. Moving in the beam is what gets him seen.
  function guardLook(geo, s) {
    const sim = s.sim, room = s.extras.room || {}, guard = sim.enemies.find(enemy => enemy.kind === "guard");
    const actor = (s.extras.npcs || []).find(item => item.id === "hood-small");
    if (!guard || !actor) return null;
    const def = Content().ENEMIES.guard, face = actor.face || 1;
    const phone = { x: actor.x + face * 17.5, y: actor.y - 50 };
    const since = (s.extras.sceneTime || 0) - (room.glareAt ?? -1e9);
    const elapsed = sim.t - guard.stateAt;
    let mode = guard.state === "watch" ? "watch" : elapsed >= def.awayMs - def.tellMs ? "tell" : "away";
    if (since < 600) mode = "glare";
    // The beam lands on Rizo; pressed behind a crate, it lands on the crate instead.
    let to = { x: s.pos.x, y: s.pos.y - 4 };
    const hide = room.hidden ? (geo.hides || []).find(r => s.pos.x >= r.x - 4 && s.pos.x <= r.x + r.w + 4 && s.pos.y >= r.y - 4 && s.pos.y <= r.y + r.h + 4) : null;
    if (hide) { const crate = geo.solids.find(r => r.kind === "crate-cold" && Math.abs(r.x + r.w / 2 - (hide.x + hide.w / 2)) < 20); if (crate) to = { x: crate.x + crate.w / 2, y: crate.y + crate.h / 2 }; }
    const flicker = mode === "tell" ? (s.reduced ? 0.5 : Math.floor(sim.t / 70) % 3 === 0 ? 0 : 0.6) : 1;
    return { mode, phone, to, flicker, since, hide, head: { x: actor.x, y: actor.y - 90 } };
  }
  function intakeOver(ctx, geo, s) {
    const look = guardLook(geo, s);
    if (!look) return;
    const { mode, phone, to, flicker, since, hide } = look;
    if (mode === "away") {
      // The screen on his mask: he is reading something, not looking at you.
      alpha(ctx, 0.75, () => rect(ctx, P.fluoro[2], phone.x - 1.5, phone.y - 3, 3, 5));
      return;
    }
    const angle = Math.atan2(to.y - phone.y, to.x - phone.x), length = Math.hypot(to.x - phone.x, to.y - phone.y) + 26;
    const glare = mode === "glare" ? Math.max(0, 1 - since / 600) : 0;
    const half = 0.14 + glare * 0.08, a = (mode === "tell" ? 0.18 : 0.3 + glare * 0.3) * flicker;
    if (a > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const grad = ctx.createRadialGradient(phone.x, phone.y, 3, phone.x, phone.y, length);
      grad.addColorStop(0, `rgba(255,250,228,${a})`); grad.addColorStop(0.85, `rgba(255,250,228,${a * 0.55})`); grad.addColorStop(1, "rgba(255,250,228,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(phone.x, phone.y); ctx.arc(phone.x, phone.y, length, angle - half, angle + half); ctx.closePath(); ctx.fill();
      ctx.restore();
      // The spot where it lands.
      if (mode !== "tell") alpha(ctx, 0.22 + glare * 0.3, () => oval(ctx, to.x, to.y + 6, 13 + glare * 4, 6 + glare * 2, "#fff8de"));
    }
    // Behind a crate the shadow keeps its edge, beam or no beam.
    if (hide) alpha(ctx, 0.4, () => rect(ctx, P.ink, hide.x, hide.y, hide.w, hide.h));
    // The torch's LED.
    rect(ctx, mode === "tell" && flicker === 0 ? P.cloth[2] : "#fffbe8", phone.x - 1.5, phone.y - 1.5, 3, 3);
    // Caught at it: his whole body says so.
    if (glare > 0) alpha(ctx, glare, () => label(ctx, "!", look.head.x, look.head.y, { size: 13, weight: 900, color: P.paper[3] }));
  }
  function buildingOver(ctx, geo, s) {
    if (geo.id === "intake") { intakeOver(ctx, geo, s); return; }
    if (geo.id === "collection") {
      // Every jar's small light, cold, breathing very slowly: what the dark is full of.
      const t = s.reduced ? 0 : s.time;
      for (const solid of geo.solids) if (solid.kind === "jar-shelf") for (const [index, jar] of shelfJars(solid).entries()) {
        const breathe = 0.55 + 0.25 * Math.sin(t / 1700 + index * 1.7 + solid.y);
        alpha(ctx, 0.35 * breathe, () => oval(ctx, jar.x, jar.y + jar.glow, 2.6 * jar.size * 2, 2.6 * jar.size * 2, P.cold[2]));
        alpha(ctx, 0.85 * breathe, () => oval(ctx, jar.x, jar.y + jar.glow, 1.1 * jar.size * 2, 1.2 * jar.size * 2, "#d6e6f0"));
      }
      // The six he can reach, again above the dark: a woken one really glows.
      for (const item of geo.jars) {
        const mood = jarMood(item, s);
        ctx.save(); ctx.translate(item.x, item.y + 2); ctx.scale(1.15, 1.15);
        A.jarLight(ctx, { ...mood, alpha: mood.awake ? 0.9 : 0.6 }, item.x);
        ctx.restore();
      }
      return;
    }
    if (geo.id !== "longhall") return;
    for (const win of geo.lampWindows || []) {
      const state = Core.lampWindowState(win, s.sim.t);
      if (state === "tell") {
        // The rattle lets light out under the shutter: it creeps across the
        // floor along exactly the band the lamp will fill, and the lamp opens
        // as it reaches the far wall. Where, and when.
        const k = Math.max(0, Math.min(1, lampTellProgress(win, s.sim.t)));
        const len = (geo.w - 40) * (s.reduced ? 1 : k), x0 = win.side === "w" ? 20 : geo.w - 20 - len;
        alpha(ctx, 0.07 + 0.12 * k, () => rect(ctx, P.cold[2], x0, win.y, len, win.h));
        alpha(ctx, 0.25 + 0.35 * k, () => { rect(ctx, P.cold[3], x0, win.y, len, 1.2); rect(ctx, P.cold[3], x0, win.y + win.h - 1.2, len, 1.2); });
        continue;
      }
      if (state !== "on") continue;
      // A window lamp straight across the hall: bright enough to make anyone stop.
      alpha(ctx, 0.2, () => rect(ctx, P.cold[3], 20, win.y - 4, geo.w - 40, win.h + 8));
      alpha(ctx, 0.42, () => rect(ctx, "#ffffff", 20, win.y + 3, geo.w - 40, win.h - 6));
    }
  }
  // How far through its rattle a window is (0 → 1 as its lamp is about to open).
  function lampTellProgress(win, t) {
    const k = (((t + win.offset) % win.period) + win.period) % win.period;
    return (k - (win.period - win.onMs - win.tellMs)) / win.tellMs;
  }
  function buildingLights(geo, s) {
    const sim = s.sim, list = [], room = s.extras.room || {};
    let ambient = { color: [5, 8, 11], alpha: 0.5 };
    if (geo.id === "longhall") {
      for (let y = 100; y < geo.h; y += 150) list.push({ x: 160, y, r: 96, strength: 0.55, warm: 0 });
      for (const win of geo.lampWindows || []) {
        const state = Core.lampWindowState(win, sim.t), x = win.side === "w" ? 12 : 308;
        if (state === "on") list.push({ x, y: win.y + win.h / 2, r: 300, strength: 1, warm: 0, cone: { angle: win.side === "w" ? 0 : Math.PI, half: 0.12 } });
        else if (state === "tell") list.push({ x, y: win.y + win.h / 2, r: 30, strength: 0.6, warm: 0 });
      }
      // The runner's lamp, pressed to the gate it was shut out by.
      if (room.slamAt != null && (s.extras.sceneTime || 0) - room.slamAt < 700) list.push({ x: room.slamX + 20, y: Math.max(geo.dropGate.y + geo.dropGate.h + 6, room.slamY - 50), r: 70, strength: 0.8, warm: 0 });
    }
    if (geo.id === "intake") {
      ambient = { color: [5, 8, 11], alpha: 0.4 }; list.push({ x: 90, y: 120, r: 120, strength: 0.7, warm: 0 }, { x: 230, y: 200, r: 120, strength: 0.6, warm: 0 }); if (room.speakerOn) list.push({ x: 104, y: 14, r: 40, strength: 0.6, warm: 0 });
      // His torch lights what it is on; his screen lights only him.
      const look = guardLook(geo, s);
      if (look && look.mode !== "away" && look.flicker > 0) list.push({ x: look.phone.x, y: look.phone.y, r: Math.hypot(look.to.x - look.phone.x, look.to.y - look.phone.y) + 30, strength: look.mode === "tell" ? 0.5 : 0.9, warm: 0.2, cone: { angle: Math.atan2(look.to.y - look.phone.y, look.to.x - look.phone.x), half: 0.16 } });
      else if (look) list.push({ x: look.phone.x, y: look.phone.y, r: 26, strength: 0.6, warm: 0 });
    }
    if (geo.id === "collection") {
      ambient = { color: [3, 5, 8], alpha: 0.66 };
      for (const solid of geo.solids) if (solid.kind === "jar-shelf") for (let x = solid.x + 30; x < solid.x + solid.w; x += 75) list.push({ x, y: solid.y + 6, r: 54, strength: 0.32, warm: 0 });
      // Each woken one lights its bit of shelf; the oldest only just.
      for (const item of geo.jars) if (sim.flags[item.flag]) list.push({ x: item.x, y: item.y - 8, r: item.id === "jar-old" ? 30 : item.id === "jar-pip" ? 38 : 46, strength: item.id === "jar-old" ? 0.45 : 0.75, warm: 1 });
      list.push({ x: 84, y: 40, r: 60, strength: 0.45, warm: 0 });
    }
    if (geo.id === "factory") {
      ambient = { color: [5, 8, 11], alpha: 0.48 };
      for (const y of [70, 240, 400, 560]) list.push({ x: 160, y, r: 120, strength: 0.42, warm: 0 });
      for (const [index, solid] of geo.solids.filter(item => item.kind === "machine").entries()) list.push({ x: solid.x + solid.w / 2, y: solid.y + 16, r: 46 + machineStroke(geo.machineBeat, index, sim.t) * 14, strength: 0.6 + machineStroke(geo.machineBeat, index, sim.t) * 0.3, warm: 0 });
      if (room.speakerOn) for (const y of [200, 420, 620]) list.push({ x: 12, y, r: 34, strength: 0.5, warm: 0 }, { x: 308, y: y + 60, r: 34, strength: 0.5, warm: 0 });
      list.push({ x: 160, y: 700, r: 70, strength: 0.6, warm: 0 });
    }
    return { ambient, list };
  }
  const BUILDING_THEME = { paintStatic: buildingStatic, paintDynamic: buildingDynamic, paintOver: buildingOver, paintFront: buildingFront, bodies: buildingBodies, lights: buildingLights };

  // ===== THE VENTS: ducts in cutaway, the only dirty place in the building =====
  function ventsStatic(c, geo, m) {
    rect(c, P.suit[0], -m.mx, -m.my, geo.w + m.mx * 2, geo.h + m.my * 2);
    // Duct floor: riveted sheet, dusty, with drag marks down the middle.
    for (let y = 0; y < geo.h; y += 20) for (let x = 0; x < geo.w; x += 40) { box(c, x, y, 40, 20, (x / 40 + y / 20) % 2 ? P.metal[0] : "#2c353c", { ink: 0.5, amp: 0.02 }); rivet(c, x + 3, y + 3, 0.7); rivet(c, x + 37, y + 3, 0.7); }
    alpha(c, 0.25, () => { const random = rng("dust"); for (let index = 0; index < 220; index += 1) rect(c, P.paper[0], random() * geo.w, random() * geo.h, 1.2, 0.8); });
    for (const solid of geo.solids) {
      // A bevel, separate sheet faces and riveted seams read as ductwork,
      // while the actual open passages remain untouched.
      rect(c, P.suit[1], solid.x, solid.y, solid.w, solid.h);
      rect(c, P.metal[0], solid.x + 1, solid.y + 1, Math.max(0, solid.w - 2), Math.max(0, solid.h - 2));
      alpha(c, 0.72, () => {
        rect(c, P.metal[2], solid.x, solid.y, solid.w, 1.4);
        rect(c, P.metal[1], solid.x, solid.y + solid.h - 2, solid.w, 2);
        if (solid.w >= 12 && solid.h >= 8) for (let sx = solid.x + 10; sx < solid.x + solid.w - 5; sx += 22) {
          line(c, sx, solid.y + 2, sx, solid.y + solid.h - 2, P.metal[2], 1);
          rivet(c, sx, solid.y + 3, 0.7);
        }
      });
    }
    // Duct walls catch his light: a lit lip along every open edge.
    for (const solid of geo.solids) {
      const below = solid.y + solid.h;
      if (below < geo.h && !geo.solids.some(other => other !== solid && other.y === below && other.x <= solid.x && other.x + other.w >= solid.x + solid.w)) alpha(c, 0.5, () => rect(c, P.metal[2], solid.x, below - 3, solid.w, 3));
    }
    for (const grate of [...(geo.grates || []), ...(geo.listens || [])]) {
      box(c, grate.x + 4, grate.y + 4, grate.w - 8, grate.h - 8, P.suit[0], { ink: 1.1, amp: 0.05 });
      for (let x = grate.x + 7; x < grate.x + grate.w - 6; x += 4) rect(c, P.metal[2], x, grate.y + 5, 1.6, grate.h - 10);
    }
    // HOME, scratched with a key, and an arrow: this way.
    alpha(c, 0.8, () => { label(c, "HOME", 98, 92, { size: 6, color: P.paper[2], weight: 600, jitter: 0.8 }); line(c, 112, 90, 124, 90, P.paper[2], 0.9); line(c, 112, 90, 116, 87, P.paper[2], 0.9); line(c, 112, 90, 116, 93, P.paper[2], 0.9); });
    // The hatch down, open, a ladder in it.
    oval(c, 60, 80, 13, 10, P.suit[0], true, 1.4);
    for (let y = 74; y < 90; y += 4) rect(c, P.metal[2], 53, y, 14, 1.2);
    label(c, "↓", 60, 70, { size: 7, color: P.cold[2], weight: 900 });
  }
  // Over the guard post the lamp below reaches each grate in turn. How long
  // until grate `index` lights (ms; negative while it is lit).
  function listenDue(geo, index, t) {
    const l = geo.listen, k = ((t % l.period) + l.period) % l.period;
    let due = index * l.stepMs - k;
    if (due < -l.litMs) due += l.period;
    return due;
  }
  const LISTEN_WARN_MS = 550;
  function ventsDynamic(ctx, geo, s) {
    const sim = s.sim;
    for (const [index, grate] of (geo.listens || []).entries()) {
      if (!Core.listenLit(geo, index, sim.t)) {
        // The next one along: light creeping up through the slats before it gets there.
        const due = listenDue(geo, index, sim.t);
        if (due > 0 && due <= LISTEN_WARN_MS) alpha(ctx, 0.85 * (1 - due / LISTEN_WARN_MS), () => { for (let x = grate.x + 7; x < grate.x + grate.w - 6; x += 4) rect(ctx, P.cold[3], x - 0.2, grate.y + 5, 2, grate.h - 10); });
        continue;
      }
      alpha(ctx, 0.75, () => { for (let x = grate.x + 7; x < grate.x + grate.w - 6; x += 4) rect(ctx, P.cold[3], x - 0.4, grate.y + 5, 2.4, grate.h - 10); });
      // It comes up through the slats in bars, past the grate's frame, onto the duct.
      const shimmer = s.reduced ? 0 : Math.sin(s.time / 120) * 0.06;
      alpha(ctx, 0.16 + shimmer, () => { for (let x = grate.x + 7; x < grate.x + grate.w - 6; x += 4) rect(ctx, "#ffffff", x - 0.2, grate.y - 6, 2, grate.h + 12); });
    }
    const view = s.extras.room?.ventView;
    for (const grate of geo.grates || []) if (view === grate.view) alpha(ctx, 0.6, () => { for (let x = grate.x + 7; x < grate.x + grate.w - 6; x += 4) rect(ctx, P.cold[2], x, grate.y + 5, 1.6, grate.h - 10); });
    for (const prop of geo.props) if (prop.id === "vent-tag") { ctx.save(); ctx.translate(prop.x, prop.y); ctx.rotate(0.5); box(ctx, -3, -2, 6, 4, P.paper[2], { ink: 0.6, amp: 0.05 }); line(ctx, 3, 0, 7, 3, P.paper[1], 0.5); ctx.restore(); }
  }
  function ventsLights(geo, s) {
    const sim = s.sim, list = [];
    for (const [index, grate] of (geo.listens || []).entries()) {
      if (Core.listenLit(geo, index, sim.t)) { list.push({ x: grate.x + grate.w / 2, y: grate.y + grate.h / 2, r: 46, strength: 1, warm: 0 }); continue; }
      const due = listenDue(geo, index, sim.t);
      if (due > 0 && due <= LISTEN_WARN_MS) list.push({ x: grate.x + grate.w / 2, y: grate.y + grate.h / 2, r: 36, strength: 0.75 * (1 - due / LISTEN_WARN_MS), warm: 0 });
    }
    for (const grate of geo.grates || []) list.push({ x: grate.x + grate.w / 2, y: grate.y + grate.h / 2, r: 26, strength: 0.45, warm: 0 });
    list.push({ x: 60, y: 80, r: 30, strength: 0.4, warm: 0 });
    return { ambient: { color: [3, 4, 6], alpha: 0.78 }, list };
  }
  // What a grate looks down on (quiet moments stay in-engine): drawn through
  // the slats in a frame beside the grate while he stays still on it.
  const VIEW_ART = {
    // The true size of the collection: shelves going back further than his light.
    scale(c, x, y, w, h) {
      rect(c, "#05070b", x, y, w, h);
      const vx = x + w / 2, vy = y + 8;
      for (let row = 0; row < 14; row += 1) {
        const k = Math.pow(row / 14, 0.62), ry = y + h - 6 - k * (h - 18), spread = (1 - k) * 0.95 + 0.05;
        line(c, vx - (w / 2) * spread, ry + 2, vx + (w / 2) * spread, ry + 2, "#1c2530", 1.2 * (1 - k) + 0.3);
        const count = Math.round(10 + k * 30);
        // Uprights converge and jars thin toward the darkness behind the slats.
        for (const edge of [-1, 1]) {
          const sx = vx + edge * (w / 2) * spread;
          line(c, sx, ry - 4, sx + edge * 4, ry + 9, P.metal[2], 0.9 * (1 - k) + 0.3);
        }
        for (let index = 0; index < count; index += 1) {
          const jx = vx - (w / 2) * spread + ((index + 0.5) / count) * w * spread, size = 2.2 * (1 - k) + 0.5;
          alpha(c, 0.35 + 0.5 * (1 - k), () => {
            oval(c, jx, ry - size, size, size, P.cold[2]);
            rect(c, P.cold[3], jx - size * 0.6, ry - size * 1.5, size * 0.3, size);
          });
        }
      }
      alpha(c, 0.5, () => rect(c, "#05070b", vx - 6, vy - 6, 12, 6));
    },
    // White coats around a jar on a steel table: measuring, writing it down.
    lab(c, x, y, w, h) {
      A.tiles(c, x, y, w, h, "labview", { size: 10, colors: ["#c9d6df", "#d6e1e8"], grout: "#9aa9b3" });
      box(c, x + w * 0.28, y + h * 0.3, w * 0.44, h * 0.44, P.metal[3], { ink: 1.2, amp: 0.05 });
      A.jar(c, x + w / 2, y + h * 0.58, { size: 1.5, t: 0, frost: true });
      // Sleeves and hands from the top edge: calipers, and a pen over a clipboard.
      shape(c, [x + w * 0.3, y, x + w * 0.42, y, x + w * 0.46, y + h * 0.36, x + w * 0.38, y + h * 0.38], "#eef5f9", { ink: 1.2, amp: 0.1 });
      oval(c, x + w * 0.43, y + h * 0.4, 4, 3.4, P.skin[2], true, 0.9);
      line(c, x + w * 0.44, y + h * 0.42, x + w * 0.49, y + h * 0.5, P.metal[3], 1.4); line(c, x + w * 0.44, y + h * 0.42, x + w * 0.52, y + h * 0.46, P.metal[3], 1.4);
      shape(c, [x + w * 0.74, y, x + w * 0.86, y, x + w * 0.84, y + h * 0.42, x + w * 0.74, y + h * 0.4], "#eef5f9", { ink: 1.2, amp: 0.1 });
      box(c, x + w * 0.7, y + h * 0.44, w * 0.18, h * 0.3, P.paper[2], { ink: 0.9, amp: 0.05 });
      for (let k = 0; k < 4; k += 1) rect(c, P.ink, x + w * 0.72, y + h * (0.5 + k * 0.05), w * 0.12, 0.6);
      oval(c, x + w * 0.79, y + h * 0.44, 3.6, 3, P.skin[2], true, 0.9); line(c, x + w * 0.79, y + h * 0.44, x + w * 0.76, y + h * 0.56, P.ink, 1);
    },
    // His desk from above: a list of numbers, a phone face down, and his hands.
    // The frame stops at his wrists. There is no face in it, and never will be here.
    office(c, x, y, w, h) {
      rect(c, "#0c0d10", x, y, w, h);
      box(c, x + 6, y + 10, w - 12, h - 14, "#17191e", { ink: 1.2, amp: 0.05 });
      alpha(c, 0.18, () => oval(c, x + w / 2, y + h * 0.6, w * 0.4, h * 0.35, P.cold[3]));
      box(c, x + w * 0.34, y + h * 0.4, w * 0.3, h * 0.48, P.paper[3], { ink: 0.9, amp: 0.05 });
      for (let k = 0; k < 8; k += 1) { rect(c, P.ink, x + w * 0.37, y + h * (0.45 + k * 0.05), w * 0.12, 0.7); rect(c, P.ink, x + w * 0.52, y + h * (0.45 + k * 0.05), w * 0.08, 0.7); }
      rect(c, P.a.red, x + w * 0.36, y + h * 0.82, w * 0.25, 1.2);
      box(c, x + w * 0.72, y + h * 0.5, w * 0.12, h * 0.3, P.suit[0], { ink: 1, amp: 0.05 });
      // Paperweight + unlit phone behind the numbered list. Only hands/wrists.
      oval(c, x + w * 0.63, y + h * 0.2, 6, 3, P.metal[2], true, 0.7);
      rect(c, P.metal[2], x + w * 0.73, y + h * 0.53, w * 0.09, 1);
      for (const [sx, dir] of [[0.26, 1], [0.66, -1]]) {
        const hx = x + w * sx;
        shape(c, [hx - 8, y, hx + 8, y, hx + 7 + dir * 2, y + h * 0.42, hx - 7 + dir * 2, y + h * 0.42], P.suit[1], { ink: 1.2, amp: 0.05 });
        rect(c, "#e9e4d8", hx - 7 + dir * 2, y + h * 0.4, 14, 4);
        oval(c, hx + dir * 3, y + h * 0.42 + 2, 2.4, 2.4, P.cold[2], true, 0.7);
        A.mark(c, hx + dir * 3, y + h * 0.42 + 2, 3, P.suit[0]);
        shape(c, [hx - 6 + dir * 2, y + h * 0.44, hx + 7 + dir * 2, y + h * 0.44, hx + 8 + dir * 6, y + h * 0.58, hx - 4 + dir * 6, y + h * 0.6], "#cf9f7d", { ink: 1.1, amp: 0.05 });
      }
    }
  };
  function ventsOver(ctx, geo, s) {
    const view = s.extras.room?.ventView;
    if (!view) return;
    const grate = (geo.grates || []).find(item => item.view === view.kind);
    if (!grate) return;
    const k = Math.min(1, ((s.extras.sceneTime || 0) - view.at) / 360);
    const w = 172, h = 104;
    const x = Math.max(6, Math.min(geo.w - w - 6, grate.x + grate.w / 2 - w / 2));
    const y = grate.y < 140 ? grate.y + grate.h + 8 : grate.y - h - 8;
    ctx.save(); ctx.globalAlpha = k;
    drop(ctx, x + w / 2, y + h + 4, w / 2 + 6, 6, 0.6);
    box(ctx, x - 4, y - 4, w + 8, h + 8, P.suit[1], { ink: 1.6, amp: 0.05 });
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    VIEW_ART[view.kind]?.(ctx, x, y, w, h);
    // Through the slats.
    ctx.globalAlpha = k * 0.6;
    for (let sx = x + 6; sx < x + w; sx += 14) rect(ctx, P.suit[0], sx, y, 4, h);
    ctx.restore();
    // A line from the grate to what it shows.
    ctx.save(); ctx.globalAlpha = k * 0.5; line(ctx, grate.x + grate.w / 2, grate.y + (grate.y < 140 ? grate.h : 0), x + w / 2, grate.y < 140 ? y : y + h, P.cold[2], 1); ctx.restore();
  }
  const VENTS_THEME = { paintStatic: ventsStatic, paintDynamic: ventsDynamic, paintOver: ventsOver, lights: ventsLights };

  const THEMES = {
    building: BUILDING_THEME,
    vents: VENTS_THEME,
    car: { paintStatic: carStatic, paintDynamic: carDynamic, lights: carLights },
    sack: { paintStatic: sackStatic, paintOver: sackOver, lights: sackLights },
    van: { paintStatic: vanStatic, paintUnder: vanUnder, paintDynamic: vanDynamic, lights: vanLights, transparent: true },
    road: { paintStatic: roadStatic, paintDynamic: roadDynamic, paintOver: roadOver, lights: roadLights },
    drain: { paintStatic: drainStatic, paintDynamic: drainDynamic, lights: drainLights }
  };
  const BELOW_THEME = { paintStatic: belowStatic, paintDynamic: belowDynamic, paintOver: belowOver, lights: belowLights };
  const themeOf = geo => THEMES[geo.theme] || BELOW_THEME;

  return Object.freeze({
    themeOf,
    paintStatic: (c, geo, margin) => themeOf(geo).paintStatic(c, geo, margin),
    paintUnder: (ctx, geo, s) => themeOf(geo).paintUnder?.(ctx, geo, s),
    paintDynamic: (ctx, geo, s) => themeOf(geo).paintDynamic?.(ctx, geo, s),
    paintOver: (ctx, geo, s) => themeOf(geo).paintOver?.(ctx, geo, s),
    lights: (geo, s) => themeOf(geo).lights(geo, s),
    // v0.5: art drawn over Rizo (the front layer), and scenery that sorts with bodies.
    paintFront: (ctx, geo, s) => themeOf(geo).paintFront?.(ctx, geo, s),
    hasFront: geo => Boolean(themeOf(geo).paintFront),
    bodies: (geo, s) => themeOf(geo).bodies?.(geo, s) || [],
    transparent: geo => Boolean(themeOf(geo).transparent),
    // Where rain outside stops (the van's body), for the view's rain pass.
    shelterOf: geo => (geo.theme === "van" ? [VAN_SHELTER] : null)
  });
});
