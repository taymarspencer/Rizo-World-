/*
  RIZO DUNGEON — ART
  ==================
  The visual constitution of Rizo Dungeon, in code. Rooms, characters,
  enemies, props, light and portraits are all drawn from these rules, so a
  new piece belongs to the world before anyone tunes it. Read this before
  adding anything visible; extend the families here instead of inventing a
  look in a painter.

  THE SIGNATURE
    Simple far away, obsessive up close. Cute shapes in uncomfortable places.
    One small warm flame against a cold dark that still reads on a phone.
    Things people made and mended: tape, stitches, rivets, worn spots, a seat
    kept dry. Cutout characters with one ink line, hand-drawn but never
    random: the same object always wobbles the same way.

  1. PALETTE   Families of 3–5 flat values, dark → light (P below). A painter
               picks from them and never invents a colour. Outside is cold
               blue-grey; below is brown-black; warmth is the ember family
               only. Accents are spent once per object, not everywhere.
  2. INK       One outline colour, P.ink (a warm black, never #000).
               Characters RULES.ink.character, props RULES.ink.prop,
               architecture only where a face turns. Far background: no ink.
  3. VALUES    Shade with 2–3 flat bands. No smooth gradients on objects.
               Key light is from above (home is up): top faces take the
               light band, the far side takes the dark band.
  4. SHADOW    Anything standing drops a flat contact shadow (drop()), offset
               down-right. Walls cast one darker band onto the floor below.
  5. LIGHT     Each room has an ambient darkness. Lights (the Rizo's flame, a
               hearth, a lamp, a window, a phone) cut stepped pools in it:
               three bands (RULES.light), never a glowing orange disc. Warm
               light also tints what it reaches; cold light only reveals.
               Hazard telegraphs are drawn after the dark, so they always read.
  6. WOBBLE    Imperfection is seeded by an id or position (trace()); lines
               never boil from frame to frame. Only fire moves on its own.
  7. SCALE     1 unit = 1 world px (RULES.scale). Rizo ~28u. Latch 38u. People
               66–98u. Doors 40u. Nothing that matters is under 1.5u.
  8. EVIDENCE  One to three signs of people per room (a repair, a worn spot,
               something left for someone). Never decoration for its own sake.
  9. DANGER    Telegraphs are pale bone lines (P.danger): dashed = coming,
               solid = now, plus a change in the body's shape. Never red alone.
  10. TEXT     Signs are short, mundane, hand-lettered (label()).

  Portraits follow the same rules at 64×64 (see PORTRAITS): a stepped light
  disc behind the head, one ink weight, two value bands, one detail that is
  only theirs. A portrait may later be replaced by { src } without touching
  story code.
*/
(function initRizoDungeonArt(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonArt", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonArt() {
  "use strict";
  const TAU = Math.PI * 2;

  // ===== 1. PALETTE =====
  const P = Object.freeze({
    ink: "#15110e", inkSoft: "#2b221c", void: "#060508",
    night: ["#0b0e14", "#141922", "#1e2530", "#2b3440"],
    below: ["#0a0807", "#15110e", "#211a15", "#2e251d"],
    concrete: ["#26282c", "#36393e", "#4b4f55", "#6b6f74"],
    asphalt: ["#0f1217", "#171b22", "#232831"],
    metal: ["#283036", "#3f4b53", "#647480", "#9fadb5"],
    wet: ["#0e141b", "#1a2532", "#2f4255", "#7f98ad"],
    paper: ["#8f8167", "#bfb190", "#e3d8bf", "#f5eedb"],
    cloth: ["#1c1f27", "#2c313d", "#434a5a", "#636c80"],
    wood: ["#2a1a11", "#47301f", "#6a4630", "#8f6544"],
    plaster: ["#29221c", "#3a3028", "#504336", "#6c5d4b"],
    service: ["#1d322e", "#2a463f", "#3d6157", "#5a8578"],
    grass: ["#0f1611", "#162019", "#1f2c22", "#2c3e30"],
    ember: ["#4a1a0c", "#9a3b17", "#e0702a", "#ffaf4a", "#ffe2a0"],
    fluoro: ["#8e9c86", "#c9d6b5", "#eef3dc"],
    sodium: ["#6e4219", "#d38a3a", "#f4c27c"],
    skin: ["#6f4a38", "#a3735a", "#cf9f7d"],
    danger: ["rgba(242,232,206,.5)", "#f2e8ce", "#fff8e6"],
    rain: "rgba(176,196,222,.42)",
    // The Boss (story spine v0.4): cold light and black. His world is never warm.
    cold: ["#1d2a33", "#5f7685", "#b8c9d4", "#eef5f9"],
    suit: ["#0b0c0f", "#17191e", "#262a31", "#3a3f48"],
    a: Object.freeze({
      brass: "#c48f3e", brassLight: "#ecc77d", tape: "rgba(226,204,124,.82)", stamp: "#b0443a", umbrella: "#2f6fa5", umbrellaLight: "#4f8fc4",
      maroon: "#6a2e35", maroonLight: "#8c3f47", mustard: "#c79f3f", track: "#2f5b40", trackLight: "#447a58", rust: "#7d4127",
      neon: "#ff5a6c", denim: "#2f4863", postal: "#3b4656", postalLight: "#55637a", sock: "#e9e4d6", red: "#b8352f", white: "#e9e4d8"
    })
  });

  // ===== RULES (the numbers the prose above refers to) =====
  const RULES = Object.freeze({
    ink: Object.freeze({ character: 1.6, prop: 1.1, fine: 0.7 }),
    shadow: Object.freeze({ dx: 1.5, dy: 1, alpha: 0.42 }),
    wobble: Object.freeze({ character: 0.45, prop: 0.8, architecture: 0.5 }),
    // Light pools: [radius fraction, darkness removed], outer → inner. `flat`
    // squashes pools into the floor plane.
    light: Object.freeze({ bands: [[1, 0.34], [0.68, 0.42], [0.4, 0.55]], flat: 0.78 }),
    scale: Object.freeze({ rizo: 28, latch: 38, keeper: 94, "hood-tall": 98, "hood-small": 66, "hood-cap": 84, porter: 84, draftling: 20, needle: 30, door: 40, collector: 76 }),
    minDetail: 1.5
  });
  // Gameplay is a little diorama, not a character-sheet showcase. Latch
  // established the right read: compact, clear, and lovable. Keep full-size
  // authored drawings for comic/portrait close-ups, but draw the world cast
  // at the following authored scale. Sizes never affect collision or AI.
  const WORLD_SCALE = Object.freeze({
    keeper: .77, "hood-tall": .76, "hood-small": .82, "hood-cap": .78,
    latch: 1, nell: .52, orr: .52, collector: .83
  });
  const BASE_HEIGHT = Object.freeze({
    keeper: 100, "hood-tall": 100, "hood-small": 76, "hood-cap": 88,
    latch: 42, van: 84, porter: 90, nell: 86, orr: 82, collector: 80
  });
  // Visible world height—not unscaled concept-art size—for camera, bubbles
  // and Rizo's bounced lighting. Anchor is always the feet.
  const HEIGHT = Object.freeze(Object.fromEntries(
    Object.entries(BASE_HEIGHT).map(([kind, height]) =>
      [kind, Math.round(height * (WORLD_SCALE[kind] ?? 1))])
  ));

  // ===== 6. WOBBLE: seeded, never per frame =====
  function seedOf(value) {
    let hash = 2166136261 >>> 0;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function rng(seed) {
    let state = seedOf(seed) || 1;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A hand-drawn outline through flat [x0,y0,x1,y1,…] points: every vertex is
  // nudged and every long edge bends once, all from the seed.
  function trace(ctx, pts, seed = 0, amp = RULES.wobble.prop, closed = true) {
    const random = rng(seed);
    const jitter = () => (random() - 0.5) * 2 * amp;
    const count = pts.length / 2;
    const xs = [], ys = [];
    for (let index = 0; index < count; index += 1) { xs.push(pts[index * 2] + jitter()); ys.push(pts[index * 2 + 1] + jitter()); }
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    const edges = closed ? count : count - 1;
    for (let index = 0; index < edges; index += 1) {
      const a = index, b = (index + 1) % count;
      const dx = xs[b] - xs[a], dy = ys[b] - ys[a], length = Math.hypot(dx, dy) || 1;
      const bend = length > 6 ? jitter() * Math.min(1.4, length / 24) : 0;
      ctx.quadraticCurveTo((xs[a] + xs[b]) / 2 - (dy / length) * bend, (ys[a] + ys[b]) / 2 + (dx / length) * bend, xs[b], ys[b]);
    }
    if (closed) ctx.closePath();
  }
  function inkStroke(ctx, width = RULES.ink.prop, color = P.ink) {
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  // A filled cutout. o: { ink: width|false, seed, amp, inkColor }
  function shape(ctx, pts, fill, o = {}) {
    trace(ctx, pts, o.seed ?? pts[0] * 31 + pts[1], o.amp ?? RULES.wobble.prop, true);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (o.ink !== false) inkStroke(ctx, o.ink ?? RULES.ink.prop, o.inkColor);
  }
  const box = (ctx, x, y, w, h, fill, o = {}) => shape(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], fill, { seed: x * 7 + y * 13 + w, ...o });
  function oval(ctx, x, y, rx, ry, fill, ink = false, width = RULES.ink.prop) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (ink) inkStroke(ctx, width);
  }
  function line(ctx, x1, y1, x2, y2, color = P.ink, width = RULES.ink.prop, seed = x1 + y2 * 3, amp = 0.35) {
    trace(ctx, [x1, y1, x2, y2], seed, amp, false);
    inkStroke(ctx, width, color);
  }
  function rect(ctx, color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  // 4. A flat contact shadow, offset down-right from the feet.
  function drop(ctx, x, y, rx, ry = rx * 0.32, alpha = RULES.shadow.alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    oval(ctx, x + RULES.shadow.dx, y + RULES.shadow.dy, rx, ry, P.ink);
    ctx.restore();
  }

  // ===== DETAILS (human evidence) =====
  // A strip of tape with torn ends: the Rizo world's favourite repair.
  function tape(ctx, x, y, length, angle = 0, seed = x + y) {
    const random = rng(`tape${seed}`);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const h = 3.2, half = length / 2;
    ctx.beginPath(); ctx.moveTo(-half, -h / 2);
    ctx.lineTo(half, -h / 2);
    for (let step = 0; step <= 3; step += 1) ctx.lineTo(half + (step % 2 ? 1.2 : 0) + random() * 0.6, -h / 2 + (h * step) / 3);
    ctx.lineTo(-half, h / 2);
    for (let step = 3; step >= 0; step -= 1) ctx.lineTo(-half - (step % 2 ? 1.2 : 0) - random() * 0.6, -h / 2 + (h * step) / 3);
    ctx.closePath();
    ctx.fillStyle = P.a.tape; ctx.fill();
    ctx.globalAlpha = 0.35; rect(ctx, "#fff6d0", -half, -h / 2, length, 0.8);
    ctx.restore();
  }
  // Cross-stitches along a seam.
  function stitches(ctx, x1, y1, x2, y2, color = P.ink, gap = 3.2, size = 1.6, width = 0.8) {
    const length = Math.hypot(x2 - x1, y2 - y1); if (!length) return;
    const ux = (x2 - x1) / length, uy = (y2 - y1) / length, px = -uy * size, py = ux * size;
    ctx.beginPath();
    for (let d = gap / 2; d < length; d += gap) { const cx = x1 + ux * d, cy = y1 + uy * d; ctx.moveTo(cx - px, cy - py); ctx.lineTo(cx + px, cy + py); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
  }
  function rivet(ctx, x, y, r = 1.1) { oval(ctx, x, y, r, r, P.metal[3]); oval(ctx, x + 0.35, y + 0.35, r * 0.45, r * 0.45, P.ink); }
  // Where somebody stood, or walked, for years: a polished patch of the floor's light band.
  function worn(ctx, x, y, rx, ry, color, alpha = 0.5) { ctx.save(); ctx.globalAlpha = alpha; oval(ctx, x, y, rx, ry, color); ctx.globalAlpha = alpha * 0.6; oval(ctx, x - rx * 0.15, y - ry * 0.1, rx * 0.6, ry * 0.55, color); ctx.restore(); }
  // Hand-lettered sign text: each letter seated a little differently.
  function label(ctx, text, x, y, o = {}) {
    const size = o.size || 7, random = rng(`label${text}${x}`);
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle || 0);
    ctx.font = `${o.weight || 800} ${size}px ${o.font || "Inter, system-ui, sans-serif"}`;
    ctx.textBaseline = "alphabetic";
    const chars = [...String(text)];
    const widths = chars.map(char => ctx.measureText(char).width + (o.spacing ?? size * 0.08));
    const total = widths.reduce((sum, w) => sum + w, 0);
    let cx = o.align === "left" ? 0 : -total / 2;
    for (let index = 0; index < chars.length; index += 1) {
      const dy = (random() - 0.5) * (o.jitter ?? size * 0.12);
      if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(chars[index], cx + 0.6, dy + 0.6); }
      ctx.fillStyle = o.color || P.paper[3]; ctx.fillText(chars[index], cx, dy);
      cx += widths[index];
    }
    ctx.restore();
  }

  // ===== MATERIALS (for cached static layers; they may afford detail) =====
  function clip(ctx, x, y, w, h, fn) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); }
  // Concrete slabs: joints, one stained slab, one newer replaced slab, sparse aggregate.
  function concrete(ctx, x, y, w, h, seed, o = {}) {
    const tone = o.tone || P.concrete, joint = o.joint || 40, random = rng(`concrete${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, tone[1], x, y, w, h);
      for (let sy = y; sy < y + h; sy += joint) for (let sx = x; sx < x + w; sx += joint) {
        const roll = random();
        if (roll < 0.14) rect(ctx, tone[0], sx + 1, sy + 1, joint - 1, joint - 1);
        else if (roll > 0.95) { ctx.globalAlpha = 0.45; rect(ctx, tone[2], sx + 1, sy + 1, joint - 1, joint - 1); ctx.globalAlpha = 1; }
        if (random() < 0.35) { ctx.save(); ctx.globalAlpha = 0.5; line(ctx, sx + random() * joint, sy + random() * joint, sx + random() * joint, sy + random() * joint, tone[0], 0.6, sx + sy, 1.2); ctx.restore(); }
      }
      ctx.globalAlpha = 0.55;
      for (let sy = y; sy <= y + h; sy += joint) line(ctx, x, sy, x + w, sy, P.inkSoft, 0.9, sy, 0.5);
      for (let sx = x; sx <= x + w; sx += joint) line(ctx, sx, y, sx, y + h, P.inkSoft, 0.9, sx * 3, 0.5);
      ctx.globalAlpha = 1;
      const flecks = Math.round((w * h) / 260);
      for (let index = 0; index < flecks; index += 1) rect(ctx, random() < 0.5 ? tone[2] : tone[0], x + random() * w, y + random() * h, 1, 1);
      if (o.wet) {
        for (let index = 0; index < Math.round((w * h) / 2600); index += 1) {
          const px = x + random() * w, py = y + random() * h, rx = 8 + random() * 16;
          ctx.globalAlpha = 0.55; oval(ctx, px, py, rx, rx * 0.3, P.wet[1]);
          ctx.globalAlpha = 0.35; oval(ctx, px - rx * 0.2, py - 0.6, rx * 0.5, 0.8, P.wet[2]);
          ctx.globalAlpha = 1;
        }
      }
    });
  }
  // Asphalt: old tar-snake crack seals and patches, a few flecks, wet sheen.
  function asphalt(ctx, x, y, w, h, seed, o = {}) {
    const random = rng(`asphalt${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, P.asphalt[1], x, y, w, h);
      for (let index = 0; index < Math.max(1, Math.round((w * h) / 9000)); index += 1) {
        const px = x + random() * w, py = y + random() * h, pw = 18 + random() * 40, ph = 10 + random() * 26;
        box(ctx, px, py, pw, ph, P.asphalt[0], { ink: false, amp: 2 });
      }
      ctx.globalAlpha = 0.9;
      for (let index = 0; index < Math.round((w * h) / 5000); index += 1) {
        let px = x + random() * w, py = y + random() * h; const pts = [px, py];
        for (let step = 0; step < 4; step += 1) { px += (random() - 0.5) * 22; py += (random() - 0.2) * 18; pts.push(px, py); }
        trace(ctx, pts, px, 1.2, false); inkStroke(ctx, 1.4, "#0a0c10");
      }
      ctx.globalAlpha = 1;
      for (let index = 0; index < Math.round((w * h) / 140); index += 1) rect(ctx, P.asphalt[2], x + random() * w, y + random() * h, 1, 1);
      if (o.wet !== false) for (let index = 0; index < Math.round((w * h) / 3000); index += 1) {
        const px = x + random() * w, py = y + random() * h, rx = 10 + random() * 24;
        ctx.globalAlpha = 0.5; oval(ctx, px, py, rx, rx * 0.25, P.wet[1]); ctx.globalAlpha = 1;
      }
    });
  }
  // Worn tiles: two close values (simple far away), thin grout, a rare crack
  // or missing tile (obsessive up close). Never a loud checkerboard.
  function tiles(ctx, x, y, w, h, seed, o = {}) {
    const size = o.size || 16, colors = o.colors || [P.below[2], P.below[3]], random = rng(`tiles${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, o.grout || P.below[1], x, y, w, h);
      for (let ty = y, row = 0; ty < y + h; ty += size, row += 1) for (let tx = x, col = 0; tx < x + w; tx += size, col += 1) {
        const roll = random();
        if (roll < 0.015) continue; // missing
        rect(ctx, o.check ? colors[(row + col) % 2] : colors[roll < 0.82 ? 0 : 1], tx + 0.6, ty + 0.6, size - 1.2, size - 1.2);
        if (roll > 0.975) line(ctx, tx + 2, ty + 2 + random() * 6, tx + size - 2, ty + size - 3, o.grout || P.below[1], 0.7, tx + ty, 1.2);
      }
    });
  }
  // Floor planks, staggered, with nail heads and one darker replaced board.
  function planks(ctx, x, y, w, h, seed, o = {}) {
    const tone = o.tone || P.wood, height = o.board || 12, random = rng(`planks${seed}`);
    clip(ctx, x, y, w, h, () => {
      rect(ctx, tone[0], x, y, w, h);
      for (let py = y, row = 0; py < y + h; py += height, row += 1) {
        let px = x - random() * 40;
        while (px < x + w) {
          const length = 40 + random() * 50, roll = random();
          rect(ctx, roll < 0.6 ? tone[1] : roll > 0.96 ? tone[3] : tone[2], px + 0.6, py + 0.6, length - 1.2, height - 1.2);
          rect(ctx, tone[0], px + 0.6, py + height - 2, length - 1.2, 1.4);
          ctx.globalAlpha = 0.3; rect(ctx, tone[3], px + 0.6, py + 0.6, length - 1.2, 0.8); ctx.globalAlpha = 1;
          rect(ctx, P.ink, px + 2.5, py + height / 2 - 0.6, 1.2, 1.2); rect(ctx, P.ink, px + length - 3.7, py + height / 2 - 0.6, 1.2, 1.2);
          px += length;
        }
      }
    });
  }
  // A wall seen from the front: plaster above an old painted dado, a
  // baseboard, and chipped paint where hands and carts have rubbed it.
  function wallFace(ctx, x, y, w, h, seed, o = {}) {
    const upper = o.upper || P.plaster, lower = o.lower || P.service, random = rng(`wall${seed}`);
    clip(ctx, x, y, w, h, () => {
      const dado = y + h * (o.dado ?? 0.45);
      rect(ctx, upper[1], x, y, w, dado - y);
      rect(ctx, upper[2], x, y, w, 1.6);
      rect(ctx, lower[1], x, dado, w, y + h - dado);
      rect(ctx, lower[2], x, dado, w, 1.4);
      rect(ctx, P.ink, x, dado + 1.4, w, 0.8);
      rect(ctx, lower[0], x, y + h - 2.6, w, 2.6);
      for (let index = 0; index < Math.max(1, Math.round(w / 34)); index += 1) {
        const cx = x + random() * w, cy = dado + 2 + random() * Math.max(1, y + h - dado - 6);
        box(ctx, cx, cy, 2 + random() * 5, 1.5 + random() * 2.5, upper[3], { ink: false, amp: 0.6 });
      }
      if (o.brick) for (let by = y + 2, row = 0; by < dado - 2; by += 5, row += 1) for (let bx = x + (row % 2) * 5; bx < x + w; bx += 10) if (random() < 0.12) box(ctx, bx, by, 9, 4, upper[0], { ink: false, amp: 0.3 });
    });
  }
  // An architectural block in 3/4: a dark cap, a lit front face if its south
  // side meets the floor, and the shadow band it casts below.
  function block(ctx, x, y, w, h, o = {}) {
    const face = o.face ?? Math.min(h, 13);
    rect(ctx, o.cap || P.below[0], x, y, w, h);
    if (o.showFace) {
      const fy = y + h - face;
      if (o.paint) o.paint(x, fy, w, face); else wallFace(ctx, x, fy, w, face, x * 3 + y, o);
      ctx.globalAlpha = 0.7; rect(ctx, P.ink, x, fy - 0.8, w, 1); ctx.globalAlpha = 1;
      if (o.castShadow !== false) { ctx.globalAlpha = 0.32; rect(ctx, P.ink, x, y + h, w, 4); ctx.globalAlpha = 0.18; rect(ctx, P.ink, x, y + h + 4, w, 4); ctx.globalAlpha = 1; }
    }
    if (o.edge) { ctx.globalAlpha = 0.5; rect(ctx, o.edge, x, y, w, 1); ctx.globalAlpha = 1; }
  }
  function metalPanel(ctx, x, y, w, h, seed, tone = P.metal) {
    const random = rng(`metal${seed}`);
    box(ctx, x, y, w, h, tone[1], { seed, amp: 0.3 });
    rect(ctx, tone[2], x + 1.2, y + 1.2, w - 2.4, 1.2);
    rect(ctx, tone[0], x + 1.2, y + h - 2.4, w - 2.4, 1.2);
    rivet(ctx, x + 2.6, y + 2.6); rivet(ctx, x + w - 2.6, y + 2.6); rivet(ctx, x + 2.6, y + h - 2.6); rivet(ctx, x + w - 2.6, y + h - 2.6);
    if (random() < 0.6) { ctx.globalAlpha = 0.6; rect(ctx, P.a.rust, x + 3 + random() * (w - 8), y + h * 0.4, 1.4, h * 0.5); ctx.globalAlpha = 1; }
  }

  // ===== 5. LIGHT =====
  // A low-resolution darkness buffer with stepped holes, scaled over the frame.
  function createLighting(doc) {
    const RES = 0.5, PAD = 24;
    let canvas = null, lc = null;
    function apply(ctx, view, ambient, lights) {
      if (!doc?.createElement) return;
      const w = Math.max(2, Math.ceil((view.w + PAD * 2) * RES)), h = Math.max(2, Math.ceil((view.h + PAD * 2) * RES));
      if (!canvas) { canvas = doc.createElement("canvas"); lc = canvas.getContext("2d"); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, w, h);
      lc.fillStyle = `rgba(${ambient.color.join(",")},${ambient.alpha})`;
      lc.fillRect(0, 0, w, h);
      lc.globalCompositeOperation = "destination-out";
      for (const light of lights) {
        const cx = (light.x - view.x + PAD) * RES, cy = (light.y - view.y + PAD) * RES, flat = light.flat ?? RULES.light.flat;
        for (const [k, a] of RULES.light.bands) {
          lc.fillStyle = `rgba(0,0,0,${Math.min(1, a * (light.strength ?? 1))})`;
          lc.beginPath();
          // A cone (a flashlight): a wedge from its source instead of a pool.
          if (light.cone) { lc.moveTo(cx, cy); lc.arc(cx, cy, light.r * Math.min(1, k + 0.25) * RES, light.cone.angle - light.cone.half * (0.4 + 0.6 * k), light.cone.angle + light.cone.half * (0.4 + 0.6 * k)); lc.closePath(); }
          else lc.ellipse(cx, cy, light.r * k * RES, light.r * k * RES * flat, 0, 0, TAU);
          lc.fill();
        }
      }
      lc.globalCompositeOperation = "source-over";
      // Shadow that light does not fully reach (the ditch, behind a post).
      for (const shade of ambient.shades || []) {
        lc.fillStyle = `rgba(${ambient.color.join(",")},${shade.alpha ?? 0.3})`;
        lc.fillRect((shade.x - view.x + PAD) * RES, (shade.y - view.y + PAD) * RES, shade.w * RES, shade.h * RES);
      }
      ctx.drawImage(canvas, view.x - PAD, view.y - PAD, view.w + PAD * 2, view.h + PAD * 2);
      // Warm light tints what it reaches, in the same three bands.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      for (const light of lights) {
        if (!light.warm) continue;
        const flat = light.flat ?? RULES.light.flat;
        for (const [k, a] of RULES.light.bands) {
          ctx.fillStyle = `rgba(255,140,56,${a * 0.42 * light.warm})`;
          ctx.beginPath(); ctx.ellipse(light.x, light.y, light.r * k * 0.86, light.r * k * 0.86 * flat, 0, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
    return { apply };
  }

  // ===== FIRE (the only thing that moves on its own) =====
  // One authored flame: three nested tongues (ember bands), flicker by time.
  function flame(ctx, x, y, size, t, o = {}) {
    const flick = o.still ? 0 : Math.sin(t / 90) * 0.7 + Math.sin(t / 37 + 1.3) * 0.45;
    const sway = o.still ? 0 : Math.sin(t / 140) * 0.18;
    const tongue = (s, color, lean) => {
      const h = s * (1.55 + flick * 0.06), w = s * 0.62;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * 1.05, y - h * 0.45, x - w * 0.2 + lean * s, y - h * 0.7);
      ctx.quadraticCurveTo(x + lean * s * 1.6, y - h * 0.85, x + lean * s * 2.2, y - h);
      ctx.quadraticCurveTo(x + w * 0.5 + lean * s, y - h * 0.55, x + w * 0.95, y - h * 0.3);
      ctx.quadraticCurveTo(x + w * 1.08, y - h * 0.08, x + w * 0.8, y);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    tongue(size, P.ember[2], sway);
    tongue(size * 0.72, P.ember[3], sway * 1.3);
    tongue(size * 0.4, P.ember[4], sway * 1.6);
    if (o.ink) { ctx.globalAlpha = 0.85; inkStroke(ctx, 0.8); ctx.globalAlpha = 1; }
  }
  // The hearth: a stone ring on a slab, split logs, a kettle kept beside it.
  function hearth(ctx, x, y, r, t, lit, o = {}) {
    drop(ctx, x, y + r * 0.7 + 2, r + 8, (r + 8) * 0.38, 0.5);
    oval(ctx, x, y + 3, r + 7, (r + 7) * 0.62, P.concrete[0], true, 1);
    const random = rng("hearth-stones");
    for (let index = 0; index < 11; index += 1) {
      const a = (index / 11) * TAU + random() * 0.2, sx = x + Math.cos(a) * (r + 3.5), sy = y + 3 + Math.sin(a) * (r + 3.5) * 0.62;
      shape(ctx, [sx - 3, sy, sx - 1, sy - 2.6, sx + 2.4, sy - 2.2, sx + 3, sy + 1.2, sx - 1, sy + 2.2], random() < 0.5 ? P.concrete[2] : P.concrete[3], { ink: 0.9, seed: index + 3, amp: 0.4 });
    }
    oval(ctx, x, y + 3, r, r * 0.55, lit ? P.ember[0] : P.below[1]);
    // Two split logs, crossed.
    ctx.save(); ctx.translate(x, y + 3);
    for (const [angle, len] of [[-0.35, r * 1.5], [0.4, r * 1.3]]) {
      ctx.save(); ctx.rotate(angle);
      box(ctx, -len / 2, -2.2, len, 4.4, P.wood[2], { ink: 1, seed: angle * 10, amp: 0.3 });
      rect(ctx, P.wood[3], -len / 2 + 1, -2, len - 2, 1); oval(ctx, len / 2 - 0.4, 0, 1.4, 2.2, lit ? P.ember[3] : P.wood[3]);
      ctx.restore();
    }
    ctx.restore();
    if (lit) {
      const size = r * (o.size || 0.95);
      flame(ctx, x - r * 0.25, y + 2, size * 0.72, t + 400);
      flame(ctx, x + r * 0.2, y + 3, size, t);
      // Embers: two stepped dots rising (deterministic per time).
      for (let index = 0; index < 3; index += 1) {
        const k = ((t / 1400) + index / 3) % 1;
        ctx.globalAlpha = 1 - k; rect(ctx, P.ember[3], x + Math.sin(index * 2.1 + k * 4) * 6, y - r - k * 26, 1.2, 1.2); ctx.globalAlpha = 1;
      }
    } else {
      // Cold: grey ash and one stubborn coal.
      ctx.globalAlpha = 0.8; oval(ctx, x, y + 3, r * 0.7, r * 0.3, P.concrete[2]); ctx.globalAlpha = 1;
      oval(ctx, x + 1, y + 3, 1.4, 1, P.ember[1 + (Math.sin(t / 700) > 0.6 ? 1 : 0)]);
    }
  }

  // ===== CHARACTERS (feet at x,y; face 1 = facing right) =====
  // Every character: a drop shadow, ink at RULES.ink.character, 2–3 value
  // bands, one asymmetry, one detail that is only theirs.
  const CH = RULES.ink.character, CA = RULES.wobble.character;
  const legs = (ctx, x, y, top, spread, width, color, bob, shoe, sock) => {
    for (const side of [-1, 1]) {
      const lift = side === -1 ? bob : -bob;
      box(ctx, x + side * spread - width / 2, top - lift * 0.4, width, y - top - 2, color, { ink: 1.1, amp: 0.2, seed: side + top });
      if (sock) rect(ctx, sock, x + side * spread - width / 2 + 0.4, y - 5 - lift * 0.4, width - 0.8, 2.2);
      oval(ctx, x + side * spread + 1.2, y - 1.4 - Math.max(0, lift) * 0.6, width * 0.75 + 0.6, 2, shoe, true, 1);
    }
  };

  // Character cutouts use a few confident curves, without changing the room
  // materials or the time/pose contracts. Heads have ONE geometry source for
  // world actors, seated actors, dialogue portraits and comic close-ups.
  const characterPaths = new Map();
  function cut(ctx, d, fill, width = CH, stroke = P.ink) {
    let path = characterPaths.get(d);
    if (!path) {
      path = new Path2D(d);
      // Some garment hems follow an existing stride. Keep their path cache
      // bounded during long sessions rather than retaining every walk frame.
      if (characterPaths.size >= 384) characterPaths.delete(characterPaths.keys().next().value);
      characterPaths.set(d, path);
    }
    if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
    if (width) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(path); }
  }
  const vp = (d, fill, width = 1.25, stroke = P.ink, gaze = false) => ({ d, fill, width, stroke, gaze });
  const ve = (x, y, rx, ry, fill, width = 0, gaze = false) => vp(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`, fill, width, P.ink, gaze);
  // Cast rebirth: a face is a few deliberate planes, not a facial mesh.
  // These paths are used without redrawing in world, seated, portrait and comic art.
  function headDesign(who, expr = "neutral") {
    const parts = [], add = (...p) => parts.push(...p);
    const scared = expr === "scared" || expr === "stare";
    if (who === "nell") {
      const amused = expr === "amused", tired = expr === "tired";
      const measuring = expr === "measuring", listening = expr === "listening", irritated = expr === "irritated";
      add(vp("M-8-3Q-7-11 2-9Q10-8 10 0L8 4Q2 9-5 4L-10 1Z",P.skin[2],1.1));
      add(vp("M-8-1L-5 1L-5 4Q-9 3-10 1Z",P.skin[1],0));
      // Swept wool fringe, one large asymmetric knot. No ears, crown or extra limbs.
      add(vp("M-10-1Q-14-5-10-9Q-9-13-5-11Q0-16 4-11Q10-13 11-5L7-4L5-8Q0-5-5-6L-6 0Z",P.paper[2],1.1));
      add(vp("M-9-8Q-6-11-3-9Q1-13 4-10",null,.8,P.paper[0]));
      add(vp("M5-10Q12-17 14-12Q15-8 7-7Q5-4 3-7Z",P.a.maroon,1.1));
      add(vp("M7-8Q14-8 15-2L10-2L6-7Z",P.a.maroonLight,1));
      add(ve(6,-8,1.6,1.5,P.a.maroon,.8));
      if (amused) add(vp("M-4 0Q-2-3 0 0M3.5-.5Q5-3 7-.5",null,1.15));
      else if (tired) add(vp("M-4 0Q-2 1 0 0M3.5-.5Q5 .5 7-.5",null,1.2));
      else {
        add(ve(-2.5,0,1.3,listening ? 2.25 : measuring ? 1.15 : 1.8,P.ink,0,true));
        add(ve(5,-.5,1.25,listening ? 2.25 : 1.8,P.ink,0,true));
        add(ve(-2.15,-.55,.35,.45,P.paper[3],0,true),ve(5.3,-1,.35,.45,P.paper[3],0,true));
      }
      add(vp(irritated ? "M-4-3L0-2M3.5-2L7-4" : listening ? "M-4-4Q-2-6 0-4M3.5-4L7-4" : tired ? "M-4-3L0-3M3.5-3L7-3.5" : "M-4-3L-1-4M3.5-4L6.5-3.5",null,1,P.wood[1]));
      add(vp("M1 1L2 3L3 1Z",P.skin[1],0));
      add(ve(-5.5,3,1.6,.6,P.a.maroonLight),ve(7,2.5,1.5,.6,P.a.maroonLight));
      add(vp(amused ? "M0 3Q3 8 6 3Q4 9 1 7Z" : listening ? "M2 4Q4 2 5 5Q4 7 2 6Z" : irritated ? "M0 6L5 4" : tired ? "M1 6Q3 4 5 5" : measuring ? "M0 5L4 5L5 4" : "M0 4Q3 7 6 3",amused || listening ? P.wood[0] : null,1));
      if(amused) add(vp("M1 4Q3 6 5 4L4 6L2 6Z",P.paper[3],0));
    } else if (who === "orr") {
      const dry = expr === "dry", irritated = expr === "irritated";
      // Broad hearth-dweller muzzle; the jaw and body meet without a human neck.
      add(vp("M-17 1Q-17-8-8-9L10-9Q18-7 18 1L14 7Q0 13-14 7Z",P.skin[1],1.2));
      add(vp("M-15-2Q-12-7-8-6L-6 2L-12 5L-16 2Z",P.skin[0],0));
      add(vp("M-16 2Q-13 8-6 7Q-1 9 0 4Q4 9 11 7L16 2L15 6Q0 13-14 7Z",P.paper[1],.8));
      add(vp("M-11-7Q-10-13 3-12L12-9L14-6Z",P.a.postal,1.1));
      add(vp("M-8-10Q0-13 7-10",null,.9,P.a.postalLight));
      add(vp("M7-10Q13-14 16-10L15 0L11 1L10-7Z",P.paper[2],1));
      add(vp("M11-6L15-5M11-2L15-1",null,1.35,P.a.red));
      if(dry) add(vp("M-10.5 0L-5.5 0M5.5 0L10.5 0",null,1.2));
      else {
        add(ve(-8,0,2.4,irritated ? 1.45 : 2.5,P.paper[3],.6),ve(8,0,2.4,irritated ? 1.45 : 2.5,P.paper[3],.6));
        add(ve(-7.7,.5,1.05,1.4,P.ink,0,true),ve(8.3,.5,1.05,1.4,P.ink,0,true));
      }
      add(vp(irritated ? "M-11-3L-5-1M5-1L11-3" : dry ? "M-11-3L-6-4M6-4L11-3" : "M-11-4Q-8-5-5-4M5-4Q8-5 11-4",null,1.5,P.wood[0]));
      add(ve(0,2,4,2,P.skin[2],.7),ve(-1.5,2,.7,.6,P.wood[0]),ve(1.5,2,.7,.6,P.wood[0]));
      add(vp(irritated ? "M-5 8L6 6" : dry ? "M-5 7Q1 9 7 6" : "M-5 6Q0 12 7 5Q5 12 0 11Z",irritated || dry ? null : P.wood[0],1.2));
      if(!dry && !irritated) add(vp("M-3 7Q1 9 5 7L3 9H0Z",P.paper[3],0));
    } else if (who === "you") {
      // One reusable face at every scale: a strong curl silhouette, patient
      // half-lidded eyes and a soft uneven beard. No hand-illustrated copies.
      add(vp("M-5 8L-5 16H6L6 8Z",P.skin[0],1));
      add(vp("M-12-4Q-12-15 0-15Q13-15 13-3L11 5Q9 12 3 13L-6 10L-12 3Z",P.skin[1],1.5));
      add(vp("M-11-3L-7-7L-6 5L-2 10L-7 9L-12 3Z",P.skin[0],0));
      add(ve(-12,0,3,3.8,P.skin[1],1));
      // Cropped coils break the hairline in three recognizable staggered
      // peaks. The left lock falls farther than the right.
      add(vp("M-12 0Q-18-7-13-12Q-15-17-9-18Q-7-23-1-19Q4-23 8-17Q15-18 15-10L13-4L9-5L8-10Q3-7-2-10L-5-6L-8-8L-9 0Z",P.inkSoft,1.3));
      add(vp("M-11-12Q-8-17-5-13M-4-17Q0-21 3-16M5-16Q9-18 11-13",null,1.4,P.wood[1]));
      add(vp("M-13-8Q-10-10-8-6L-8-2",null,.9,P.wood[2]));
      // Beard and cheek are the same in the portrait and on the sidewalk.
      add(vp("M-9 3L-5 5Q-1 8 3 8L10 4L11 9Q7 16 2 16Q-5 14-9 9Z",P.inkSoft,1));
      add(vp("M-6 10Q-2 13 2 13L6 11",null,.8,P.wood[1]));
      // One raised brow and a quieter, heavier other eye say "keeper"
      // before the dialogue does. Gaze only moves when stage-directed.
      add(vp("M-8-5Q-5-7-1-5M4-5Q7-7 11-5",null,1.7));
      add(vp("M-7-1L-1-1M5-1L10-1",null,.8,P.skin[0]));
      add(ve(-4,0,2.3,1.8,P.paper[2],.8),ve(7,0,2.2,1.75,P.paper[2],.8));
      add(ve(-3.3,.45,1.1,1.35,P.ink,0,true),ve(7.7,.45,1.05,1.3,P.ink,0,true));
      add(vp("M3 0L2 4L5 4",null,1,P.skin[0]));
      add(vp("M-1 8Q3 10 8 7",null,1.15,P.paper[1]));
    } else if (who === "hood-tall") {
      add(vp("M-10 15Q-17 3-15-9L-7-21Q-3-24 4-17L13-9L14 6L9 15Z",P.cloth[2],1.5));
      add(vp("M-14-8L-7-17L-7 5L-10 12L-14 3Z",P.cloth[1],0));
      add(vp("M-5-7L6-8L8-1L15 4L8 6L5 12L-2 8Z",P.skin[0],1));
      add(vp("M2-6L6-6L8 0L13 3L7 3Z",P.skin[1],0));
      add(vp("M-7-8L4-12L11-7L6-5L2-7L-4-4Z",P.cloth[3],1));
      add(ve(0,-.5,scared ? 2.4 : 2,scared ? 2.8 : 1.3,P.paper[2],.6),ve(7,-1.5,scared ? 1.9 : 1.6,scared ? 2.5 : 1.1,P.paper[2],.6));
      add(ve(.5,0,.85,1.1,P.ink,0,true),ve(7.4,-1,.75,1,P.ink,0,true));
      add(vp("M-2-4L2-4M6-5L9-5.5",null,1.3));
      add(vp("M-4 6Q3 10 9 5L8 12L3 15L-3 10Z",P.cloth[0],1));
      add(vp("M-2 8L5 10",null,1,P.cloth[2]));
      add(vp("M-10 11L-9 19",null,1.4,P.paper[1]));
    } else if (who === "hood-small") {
      add(vp("M-11-4Q-10-13 1-12Q13-11 13-2L12 7Q7 14-3 12Q-12 11-13 3Z",P.skin[1],1.4));
      add(ve(-13,0,4,4,P.skin[1],.9),ve(13,0,3,3.5,P.skin[1],.9));
      add(vp("M-11 2L-6 5L-4 11Q-10 11-12 6Z",P.skin[0],0));
      add(vp("M-13-5Q-18-19-5-20Q5-23 12-13L13-5Z",P.a.mustard,1.3));
      add(vp("M-12-9L12-12L14-5L-11-1Z",P.paper[1],1.1));
      add(vp("M-10-16Q-5-21 3-18",null,1.2,P.wood[2]));
      add(ve(-10,-20,4,3.8,P.a.mustard,1));
      add(ve(-5,1,2.5,scared ? 3.1 : 2.2,P.paper[3],.7),ve(6,0,2.4,scared ? 3 : 2,P.paper[3],.7));
      add(ve(-4.4,1.6,1.1,1.35,P.ink,0,true),ve(6.6,.6,1.1,1.3,P.ink,0,true));
      add(vp(scared ? "M-8-4Q-5-7-2-4M3-5Q6-8 9-5" : "M-8-3L-2-4M3-4L9-5",null,1.5));
      add(vp("M0 2L-1 5L3 5",null,1,P.skin[0]));
      add(vp(scared ? "M0 8Q4 4 6 9L4 12H1Z" : expr === "quiet" ? "M-3 9L5 8" : "M-6 6Q1 10 9 5Q7 14 0 13Z",expr === "quiet" ? null : P.wood[0],1));
      if(!scared && expr !== "quiet") add(vp("M-3 8L1 9V12L-2 10Z M3 9L6 8V10H3Z",P.paper[3],0));
    } else if (who === "hood-cap") {
      add(vp("M-14-8L8-10L14-4L14 6L8 12L-10 10L-15 4Z",P.skin[0],1.4));
      add(vp("M1-7L9-7L12-2L8 2L2 1Z",P.skin[1],0));
      add(vp("M-14-9L-13-17Q-2-22 10-16L14-9Z",P.cloth[0],1.3));
      add(vp("M-12-15L2-18L9-14",null,1.4,P.cloth[2]));
      add(vp("M-13-15L-25-11L-24-6L-13-9Z",P.cloth[0],1.1));
      add(vp("M-10-4L-3-2M4-2L11-5",null,2));
      add(vp("M-10-1H-3L-4 2H-8Z M4-1L11-3L10 1L6 2Z",P.paper[2],.7));
      add(ve(-5.5,.5,.8,1,P.ink,0,true),ve(8,0,.8,1,P.ink,0,true));
      add(vp("M0 1L2 4L5 3",null,1,P.skin[1]));
      add(vp("M-13 4L0 6L13 2L12 10L1 16L-11 11Z",P.a.red,1));
      add(vp("M-10 6L1 9L10 5L2 12Z",P.a.stamp,0));
      add(vp("M-13 8L-20 10L-17 15L-12 11Z",P.a.red,1));
    } else if (who === "driver") {
      add(vp("M-8-8L6-10L11-4L11 0L18 7L10 8L9 14L1 17L-6 13L-9 4Z",P.skin[0],1.4));
      add(vp("M2-5L7-5L9 2L15 6L7 7L5 3Z",P.skin[1],0));
      add(ve(-9,1,3.5,4,P.skin[0],.9));
      add(vp("M-12-7Q-13-17-2-19L7-16L11-8Z",P.a.rust,1.3));
      add(vp("M-10-13L3-16L7-13",null,1.2,P.wood[3]));
      add(vp("M-10-9L15-7L16-4L-10-4Z",P.wood[0],1));
      add(vp("M-9-3H0L1 3L-7 4Z M5-3H13L13 3L6 4Z",P.cloth[0],1.1));
      add(vp("M-7-1H-1M7-1H11M1 0H5",null,1.2,scared ? P.cold[3] : P.paper[2]));
      add(vp("M-5 9Q0 7 6 9L7 12L1 11L-4 12Z",P.inkSoft,.9));
      add(vp(scared ? "M0 13Q3 10 6 13L4 15H1Z" : "M0 13L6 12",scared ? P.wood[0] : null,1));
      add(vp("M-4 13L-2 15M7 13L6 15",null,.8,P.inkSoft));
    } else if(who.startsWith("collector-")) {
      const profile = who.slice(10);
      if(profile === "marshal") {
        add(vp("M-11 10L-13-5L-5-20L7-17L13-5L9 13Z",P.metal[1],1.6));
        add(vp("M-11-5L-4-16L-1-15L-3 9L-9 10Z",P.metal[0],0));
        add(vp("M-3-9Q4-12 7-7L7 3L-1 5Z",P.suit[0],1.1));
        add(vp("M0-7L4-8V1L1 2Z",P.cold[2],.7));
        add(vp("M-7 7L8 7L7 11H-6Z",P.metal[2],.8));
      } else if(profile === "gatherer") {
        add(vp("M-18 5Q-22-11-8-15Q9-18 17-7L18 9Q0 15-15 11Z",P.metal[1],1.6));
        add(vp("M-15-6Q-8-13 0-12L0 8L-14 9Z",P.metal[0],0));
        add(ve(5,-1,7.5,7,P.suit[0],1.3),ve(5,-1,5.4,5.2,P.cold[1],.8));
        add(vp("M2-4L8-5L7-1",null,1.7,P.cold[3]));
        add(vp("M-13 2H-6V7H-13Z",P.metal[2],.8));
        add(vp("M-13 4H-6",null,1,P.suit[1]));
      } else if(profile === "runner") {
        add(vp("M-14 6L-16-7L-7-17L5-15L17-7L21 4L7 13L-7 10Z",P.metal[1],1.5));
        add(vp("M-13-6L-6-13L4-11L-2-5Z",P.metal[2],0));
        add(vp("M-7-4L15-6L17-1L-3 3Z",P.suit[0],1));
        add(vp("M-4-2L12-4L13-2L-1 0Z",P.cold[2],.5));
        add(vp("M-2 5L18 1L12 7L5 11Z",P.metal[0],1));
        add(vp("M-13 6L-20 9L-29 5L-24 12L-13 11Z",P.suit[1],1));
      } else {
        add(vp("M-16 10V-12L-11-17H12L17-12V12Z",P.metal[1],1.6));
        add(vp("M-14-12H11V-8H-14Z",P.metal[2],0));
        add(vp("M-11-4H12V8H-11Z",P.suit[0],1));
        add(vp("M-8-1H9V3H-8Z",P.cold[1],.7));
        add(vp("M-4 1H7",null,1.5,P.cold[2]));
        add(vp("M-9 10H10V13H-9Z",P.metal[0],.8));
      }
    }
    return parts;
  }

  // Garments are complete cutouts with a neck origin (0,0). Reuse their
  // actual geometry in portrait crops and comic busts instead of an imitation.
  function garmentDesign(who) {
    const p = [], add = (...a) => p.push(...a);
    if(who === "nell") {
      add(vp("M-6-2Q-11-1-12 6L-16 18Q-7 22 0 18Q7 21 14 16L10 2Q7-3 3-2Z",P.a.maroon,1.1));
      add(vp("M-12 7L-6 2L-5 18L-14 18Z",P.a.maroonLight,0));
      add(vp("M-6 1Q0 5 8 0L5 7L-1 10Z",P.paper[2],1));
      add(vp("M-5 11L4 10L6 17L-4 18Z",P.service[2],.8));
      add(vp("M-1 12L1 16M-2 15L2 13",null,1.1,P.paper[2]));
      add(vp("M-10 14L-7 13L-5 19L-8 20Z",P.wood[1],.8));
      add(ve(-9,12,1.7,1.7,P.a.brass,.6),ve(-6,11,1.7,1.7,P.a.brass,.6));
      add(vp("M-8 13L-7 17",null,1,P.metal[3]));
    } else if(who === "orr") {
      add(vp("M-12-1Q-18 7-15 17Q0 24 15 17Q20 4 12-1Z",P.a.rust,1.2));
      add(vp("M-13 3Q-9-3-2 0L2 15L-8 18L-15 16Z",P.wood[3],0));
      add(vp("M-14 7Q0 11 15 6L14 16Q0 20-14 16Z",P.a.postal,1));
      add(vp("M-5 12H5L4 17H-5Z",P.paper[2],.8));
      add(vp("M-3 14H3",null,1,P.a.red));
      add(vp("M-13 4Q-10 7-9 10",null,1,P.wood[1]));
    } else if(who === "you") {
      // Character-first tailoring: one broad raincoat and one unmistakable
      // maroon scarf, shared verbatim by world and dialogue portrait.
      // Feet stay anchored; gameplay scale, collision and movement do not move.
      add(vp("M-8-3Q-19-4-22 8L-19 24L-23 47Q-16 53-6 48L0 46Q9 54 22 48L18 24L21 8Q17-3 8-3Z",P.wood[2],1.65));
      add(vp("M-19 7L-12 3L-7 24L-9 48L-21 48L-18 24Z",P.wood[1],0));
      // Dark inside hem and staggered lengths give the coat a readable
      // outline even when its buttons disappear at 320px.
      add(vp("M-8 47L-2 42L3 48L8 50L0 47L-6 51Z",P.wood[0],.7));
      add(vp("M-8-2L-16 7L-5 19L0 6Z",P.wood[3],1.1));
      add(vp("M7-2L16 8L5 18L1 6Z",P.wood[3],1.1));
      add(vp("M-12 0Q0-8 11-1L12 6Q1 11-10 6Z",P.a.maroon,1.3));
      add(vp("M-8 5Q-14 12-12 22L-17 33L-9 35L-5 24L-3 9Z",P.a.maroonLight,1.05));
      add(vp("M-15 27L-9 29M-16 31L-10 33",null,.85,P.a.maroon));
      add(vp("M5 12L6 45",null,.8,P.wood[1]));
      add(ve(5,27,1.5,1.5,P.paper[1],.75));
      add(ve(5.5,36,1.4,1.4,P.paper[1],.7));
      // Existing coat repaired at one pocket, not generic ornamental badges.
      add(vp("M10 30L17 28L16 34L10 36Z",P.wood[1],.9));
      add(vp("M12 29L13 35",null,.75,P.paper[0]));
    } else if(who === "hood-tall") {
      add(vp("M-6-4Q-15-1-15 9L-10 23L-14 43L-2 46L1 40L10 43L12 22L14 8L7-4Z",P.cloth[2],1.6));
      add(vp("M-13 3L-7 1L-5 23L-8 43L-14 43L-10 23Z",P.cloth[1],0));
      add(vp("M-10 1L6-2L12 9L4 17L-7 20L-9 15L2 9Z",P.cloth[3],1.1));
      add(vp("M-5 27L7 23L7 32L-3 34Z",P.cloth[1],.9));
      add(vp("M-4 0L-4 10M7 0L7 8",null,1.4,P.paper[1]));
      add(ve(3,10,1.5,1.5,P.paper[0],.6));
    } else if(who === "hood-small") {
      add(vp("M-8-7Q-21-8-23 6Q-23 20-11 22L12 21Q24 18 22 3Q20-9 8-7Z",P.a.maroon,1.6));
      add(vp("M-19 0Q-15-5-11-2L-8 19L-14 21Q-22 17-20 5Z",P.a.maroonLight,0));
      add(vp("M-12-7L-10-12L0-7L10-12L14-6L5 0H-5Z",P.cloth[0],1.1));
      add(vp("M0-3L2 20M-20 10Q-9 14-1 11M5 11Q13 14 21 9",null,1.2,P.inkSoft));
      add(vp("M-17 13L-7 14L-8 19L-15 18Z",P.cloth[0],.8));
      add(ve(2,2,1,1,P.paper[0],.5));
    } else if(who === "hood-cap") {
      add(vp("M-9-5L-24-4L-26 6L-20 28H20L25 7L22-4L9-5Z",P.a.track,1.6));
      add(vp("M-23 2L-15 2L-13 27H-20Z",P.service[0],0));
      add(vp("M-23-3L-7 2L0 8L7 3L21-4L24 2L11 13H-9L-23 5Z",P.a.trackLight,1));
      add(vp("M-8-5L0 4L8-5L10 1L1 10L-8 2Z",P.cloth[0],1));
      add(vp("M1 12V27",null,1.3,P.inkSoft));
      add(vp("M-21 1L-20 15M21 1L20 15",null,2.6,P.a.white));
      add(vp("M7 18L17 17V24L8 25Z",P.service[0],.8));
    } else if(who === "driver") {
      add(vp("M-8-3Q-18-2-20 9L-15 30H16L21 9Q18-3 8-3Z",P.a.rust,1.5));
      add(vp("M-18 7L-11 4L-7 29H-15Z",P.wood[0],0));
      add(vp("M-9-4L0 4L9-4L15 1L8 12L0 7L-8 12L-15 1Z",P.paper[2],1.1));
      add(vp("M0 9V29",null,1.2,P.wood[0]));
      add(vp("M6 18H15V26H6Z",P.wood[1],.8));
      add(ve(0,17,1.4,1.4,P.paper[0],.6));
    } else if(who.startsWith("collector-")) {
      const role=who.slice(10);
      const outlines={marshal:"M-7-3L-17 4L-12 19L-15 40L-5 43L1 35L9 43L18 39L11 17L16 3L8-3Z",gatherer:"M-10-2Q-23-2-27 12L-22 30Q0 37 23 30L27 12Q23-2 10-2Z",runner:"M-7-3L-20 6L-13 19L-10 30L4 35L17 29L18 8L8-3Z",sentry:"M-10-2H10L23 4L21 30H-21L-23 4Z"};
      add(vp(outlines[role]||outlines.sentry,P.metal[1],1.6));
      add(vp(role==="gatherer" ? "M-23 9L-13 3L-11 29L-21 28Z" : "M-16 5L-9 0L-7 28L-14 31L-18 17Z",P.metal[0],0));
      add(vp(role==="marshal" ? "M-10-2L0 9L10-2L14 3L6 17L0 11L-7 17L-14 3Z" : role==="runner" ? "M-13 4L-2 14L11 1L17 7L6 22L-7 19Z" : "M-17 3H17V10H-17Z",P.metal[2],1));
      add(vp(role==="gatherer" ? "M-15 17H15L18 29Q0 33-16 28Z" : "M-10 14H11L14 29H-12Z",P.metal[0],1));
      add(vp("M-9 0L7 27",null,3.1,P.suit[0]));
      add(vp("M-9 0L7 27",null,1.2,P.metal[2]));
      // The actual organization mark; no invented face or insignia.
      add(vp("M1 18V14Q1 11 4 11Q7 11 7 14V18M0 19H8",null,1,P.cold[2]));
      add(ve(4,9.5,.8,.8,P.cold[2]),ve(4,15,1.2,1.2,P.cold[2]));
    }
    return p;
  }
  const garments = new Map();
  function garmentParts(who) {
    if(!garments.has(who)) garments.set(who,garmentDesign(who));
    return garments.get(who);
  }
  function paintParts(ctx, parts) { for(const p of parts) cut(ctx,p.d,p.fill,p.width,p.stroke); }
  function partsSvg(parts) { return parts.map(p=>`<path d="${p.d}" fill="${p.fill||"none"}" stroke="${p.width?p.stroke:"none"}" stroke-width="${p.width}"/>`).join(""); }
  function characterBody(ctx, who, x, y) { ctx.save();ctx.translate(x,y);paintParts(ctx,garmentParts(who));ctx.restore(); }
  function characterBodySvg(who) { return partsSvg(garmentParts(who)); }
  const headSets = new Map();
  function headParts(who, expr) {
    const key = `${who}:${expr}`;
    if (!headSets.has(key)) headSets.set(key, headDesign(who, expr));
    return headSets.get(key);
  }
  function characterHead(ctx, who, x, y, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0);
    for (const p of headParts(who, o.expr || "neutral")) {
      ctx.save();
      if (p.gaze) {
          // A quiet quarter-pixel glance only when the story asks for it; no
          // exaggerated pupil sliding over an otherwise still character.
          ctx.translate((o.look?.x || 0) * .55, (o.look?.y || 0) * .32);
        }
      cut(ctx, p.d, p.fill, p.width, p.stroke); ctx.restore();
    }
    ctx.restore();
  }
  function characterHeadSvg(who, expr = "neutral") {
    return headParts(who, expr).map(p => `<path d="${p.d}" fill="${p.fill || "none"}" stroke="${p.width ? p.stroke : "none"}" stroke-width="${p.width}"/>`).join("");
  }
  // The original pose gives shoulder, elbow and wrist. Tailor a sleeve
  // around it: a shaped shoulder and tapered cuff, not a constant-width rod.
  function sleeve(ctx, pts, color, width, hand) {
    const [sx, sy, ex, ey, wx, wy] = pts;
    const lenA = Math.hypot(ex-sx, ey-sy) || 1, lenB = Math.hypot(wx-ex, wy-ey) || 1;
    const ax = -(ey-sy)/lenA, ay = (ex-sx)/lenA, bx = -(wy-ey)/lenB, by = (wx-ex)/lenB;
    const nx = (ax+bx)*.5, ny = (ay+by)*.5, sh = width*.8, elbow = width*.65, cuff = width*.45;
    shape(ctx, [sx+ax*sh,sy+ay*sh, ex+nx*elbow,ey+ny*elbow,wx+bx*cuff,wy+by*cuff,
      wx-bx*cuff,wy-by*cuff,ex-nx*elbow,ey-ny*elbow,sx-ax*sh,sy-ay*sh], color, {ink:1.25,amp:.12,seed:width+sx});
    line(ctx, wx-bx*cuff, wy-by*cuff, wx+bx*cuff, wy+by*cuff, P.inkSoft, .9, width, .05);
    if (hand) {
      oval(ctx, wx, wy, Math.max(2.6,width*.6), Math.max(2.3,width*.5), hand, true, .9);
      oval(ctx, wx-bx*1.8, wy-by*1.8, 1.2, 1.6, hand);
    }
  }
  // Reuse the approved head/garment cutouts, but tailor *world* garments to
  // leg length. Previously the coat covered 50 of YOU's 100 body units,
  // leaving two 30px matchsticks where thighs and knees should be.
  // Portraits keep the same underlying garment paths at a closer camera crop.
  function actorGarment(ctx, who, x, y, vertical = 1) {
    ctx.save(); ctx.translate(x,y); ctx.scale(1,vertical);
    paintParts(ctx,garmentParts(who)); ctx.restore();
  }
  function youCoat(ctx) { actorGarment(ctx,"you",0,-73,.72); }
  // Exactly the same planted hip, knee, heel and boot construction indoors
  // and outdoors. The stride value comes from movement (zero means still).
  function keeperLegs(ctx, step = 0) {
    for(const side of [-1,1]) {
      const gait=side*step, hip=side*7.2;
      const knee=hip+gait*2.8, heel=hip+gait*5.1;
      const lift=Math.max(0,gait)*2.3;
      shape(ctx,[hip-4.3,-45,hip+4.3,-45,knee+3.8,-23,
        heel+3.8,-4-lift,heel-3.8,-4-lift,knee-3.8,-23],
        P.a.denim,{ink:1.1,amp:.12});
      // A small knee fold, not a second limb.
      line(ctx,knee-2,-22,knee+3,-20,P.cloth[2],.65,hip,.07);
      oval(ctx,heel+side*1.5,-2-lift,5.8,2.65,P.ink,true,.8);
    }
  }
  // The umbrella is ONE asset in the game's own cutout language. The world
  // actor and SVG portrait render these identical shapes; no new renderer,
  // external model, animation engine, download or duplicated illustration.
  const keeperCanopyParts = Object.freeze([
    vp("M-28 8Q-23-2-10-8Q4-14 20-5Q27-2 30 8L22 6L14 10L6 6L-3 10L-13 6L-21 10Z",P.a.umbrella,1.6),
    vp("M-21 1Q-12-7-1-9L6-10Q-5-4-13 6L-21 8Z",P.a.umbrellaLight,0),
    vp("M0-12L0 8M0-12L-14 6M0-12L14 6M0-12L23 7",null,.85,P.inkSoft),
    vp("M20-3L25-1L23 2L19 0Z",P.a.tape,.6)
  ]);
  function keeperCanopy(ctx, x, y) {
    ctx.save(); ctx.translate(x,y); paintParts(ctx, keeperCanopyParts); ctx.restore();
  }
  // YOU / Keeper — authored 8-frame art sheet (walk x4, idle, look back,
  // reach, front). The old procedural figure remains a safe loading/offline
  // fallback, NOT the normal production character. We intentionally reuse
  // a single sprite atlas instead of re-sculpting body polygons per scene.
  // The image is 480 × 360, organized in a 4-column × 2-row grid.
  const KEEPER_ATLAS = Object.freeze({
    src: typeof document === "object" && document.currentScript?.src
      ? new URL("assets/keeper-sprite-atlas.png", document.currentScript.src).href
      : "modes/dungeon/assets/keeper-sprite-atlas.png",
    columns: 4, rows: 2, cellW: 120, cellH: 180,
    // At the existing world draw scale: 78 × 117 native world units.
    width: 78, height: 117
  });
  let keeperImage = null, keeperImageState = "unavailable";
  const keeperImageListeners = new Set();
  function onKeeperImageChange(callback) {
    if (typeof callback !== "function") return () => {};
    keeperImageListeners.add(callback);
    return () => keeperImageListeners.delete(callback);
  }
  function keeperImageUpdate(state) {
    keeperImageState = state;
    for (const callback of Array.from(keeperImageListeners)) {
      try { callback(state); } catch (_) { /* listeners are optional */ }
    }
  }
  function loadKeeperImage() {
    if (keeperImage || keeperImageState === "error" || typeof Image !== "function") return;
    keeperImageState = "loading";
    const img = new Image();
    // A bundled same-origin asset keeps screenshots, offline play and
    // save thumbnails functional without contacting another provider.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (img.naturalWidth === 480 && img.naturalHeight === 360) {
        keeperImage = img;
        keeperImageUpdate("ready");
      } else keeperImageUpdate("error");
    };
    img.onerror = () => keeperImageUpdate("error");
    img.src = KEEPER_ATLAS.src;
  }
  function keeperSpriteFrame(o = {}) {
    // Travel-distance driven animation: stopping cannot advance the cycle.
    if (o.walking) {
      const cycle = (((((o.stride || 0) * 1.9) / TAU) % 1) + 1) % 1;
      return Math.min(3, Math.floor(cycle * 4));
    }
    const state = String(o.state || "").toLowerCase();
    if (state === "look-back" || state === "turn" || o.back) return 5;
    if (state === "reach" || state === "door" || state === "grab" || o.reach) return 6;
    if (o.addressed || o.front) return 7;
    return 4;
  }
  // The painted frames were authored with slightly different horizontal
  // centers. Fix that ONCE here, instead of allowing a left/right body wobble
  // or editing every animation frame and its masks independently.
  // Top row feet touch the frame edge; bottom row has 14px transparent sole
  // padding. These offsets keep feet planted on the game's drop shadow.
  const KEEPER_FRAME_OFFSET_X = Object.freeze([-1, 4, 10, 10, 0, -1, 0, 2]);
  const KEEPER_FRAME_OFFSET_Y = Object.freeze([0, 0, 0, 0, 9, 9, 9, 9]);
  function keeperSprite(ctx, x, y, o = {}) {
    if (!keeperImage || keeperImageState !== "ready" || typeof ctx.drawImage !== "function") return false;
    const frame = keeperSpriteFrame(o);
    const { cellW, cellH, width, height, columns } = KEEPER_ATLAS;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.face === -1 ? -1 : 1, 1);
    // All frames retain the original bottom-center foot anchor. Draw
    // bitmaps in one single pass: no extra arms, knees or overlay limbs.
    // The authored atlas has a few stray ink strokes in the first 8 px
    // of its second row. These used to float above YOU's umbrella in real
    // gameplay (especially over the bright store doorway). Trim only that
    // source sliver; keep the source/destination scale and FOOT position
    // identical, so switching from walk to idle never makes him pop.
    const trimTop = frame >= columns ? 8 : 0;
    const scaleY = height / cellH;
    ctx.drawImage(keeperImage, (frame % columns) * cellW,
      Math.floor(frame / columns) * cellH + trimTop, cellW, cellH - trimTop,
      -width / 2 + KEEPER_FRAME_OFFSET_X[frame],
      -height + KEEPER_FRAME_OFFSET_Y[frame] + trimTop * scaleY,
      width, height - trimTop * scaleY);
    ctx.restore();
    return true;
  }
  // The image request starts once. Browser animation remains 100% driven by
  // the game's existing traveled stride; reduced-motion holds the idle frame.
  loadKeeperImage();
  // Keep the established walk/interaction state contract; reuse the existing
  // sleeve rig and shared head/garment rather than another procedural anatomy.
  function keeper(ctx, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, state = o.state || "idle";
    drop(ctx, x, y, 15, 3.6);
    // The new sprites replace the in-game character; generated art is not
    // just a separate concept sheet or unused repository attachment.
    if (keeperSprite(ctx, x, y, o)) return;
    ctx.save(); ctx.translate(x,y); ctx.scale(o.face || 1,1);
    if(state === "look-back") ctx.rotate(-.055);
    const step = o.walking ? Math.sin((o.stride || 0)*1.9) : 0;
    keeperLegs(ctx,step);
    ctx.translate(0,o.walking ? -Math.abs(step)*.9 : 0);
    // Same source that supplies the close-up portrait: no bespoke copy here.
    youCoat(ctx);
    characterHead(ctx,"you",0,-84,{
      tilt:state === "look-back" ? -.12 : o.addressed ? -.06 : -.015,
      look:o.look
    });
    // All arms use the existing joint/sleeve primitive. The hand is part of
    // the sleeve, not a second floating ellipse or an extra overlay limb.
    if(state === "door") {
      sleeve(ctx,[-16,-68,-25,-75,-24,-84],P.wood[2],6.4,P.skin[1]);
    } else if(state === "look-back") {
      sleeve(ctx,[-16,-68,-24,-60,-22,-52],P.wood[1],6.4,P.skin[1]);
    } else {
      sleeve(ctx,[-16,-68,-22,-56+step*1.2,-14-step*3,-43],
        P.wood[1],6.4,P.skin[1]);
    }
    // Umbrella arm and grip remain physically connected during every pose.
    sleeve(ctx,[16,-68,23,-60,19,-59],P.wood[2],6.7,P.skin[1]);
    // Shaft stays to the right of his face rather than crossing his eyes.
    line(ctx,19,-59,13,-101,P.ink,1.5,15,.1);
    keeperCanopy(ctx,13,-109);
    for(let i=0;i<3;i++) {
      const k=((t/700)+i*.37)%1, dx=[-22,28,9][i];
      ctx.globalAlpha=.8*(1-k);
      rect(ctx,P.wet[3],dx+13,-101+k*14,.9,2.2);
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

  // The van: a dented people-carrier with a primer-grey door somebody swapped in.
  function van(ctx, x, y, o = {}) {
    drop(ctx, x, y + 2, 78, 7, 0.55);
    ctx.save(); ctx.translate(x, y);
    // Drawn nose-left; face 1 turns it to drive right.
    if (o.face === 1) ctx.scale(-1, 1);
    const body = [-76, -8, -76, -40, -64, -46, -42, -70, 62, -72, 72, -66, 74, -8];
    shape(ctx, body, P.paper[1], { ink: CH, seed: 21, amp: 0.4 });
    shape(ctx, [-72, -22, 72, -22, 73, -8, -75, -8], P.paper[0], { ink: false, seed: 22, amp: 0.3 });
    rect(ctx, P.paper[2], -40, -69, 100, 2);
    // The swapped door, in primer, with tape on its handle.
    box(ctx, -4, -62, 34, 52, P.concrete[2], { ink: 1.2, seed: 23, amp: 0.3 });
    tape(ctx, 22, -38, 7, 0.1, 5);
    // Windows: tinted, wet, a streak of the store's light.
    shape(ctx, [-60, -44, -44, -64, -10, -64, -10, -44], P.wet[1], { ink: 1.2, seed: 24, amp: 0.3 });
    shape(ctx, [-4, -60, 28, -60, 28, -46, -4, -46], P.wet[1], { ink: 1.1, seed: 25, amp: 0.3 });
    shape(ctx, [34, -64, 64, -64, 66, -46, 34, -46], P.wet[1], { ink: 1.1, seed: 26, amp: 0.3 });
    ctx.globalAlpha = 0.5; line(ctx, -40, -62, -50, -46, P.fluoro[1], 1.2); line(ctx, 40, -62, 36, -48, P.fluoro[1], 1); ctx.globalAlpha = 1;
    // Rust, a sticker, lights.
    ctx.globalAlpha = 0.85; box(ctx, -70, -20, 8, 5, P.a.rust, { ink: false, amp: 1 }); box(ctx, 58, -16, 6, 6, P.a.rust, { ink: false, amp: 1 }); ctx.globalAlpha = 1;
    box(ctx, 44, -34, 10, 6, P.a.mustard, { ink: 0.8, amp: 0.3 });
    box(ctx, -77, -34, 4, 8, o.lights ? P.fluoro[2] : P.paper[2], { ink: 1, amp: 0.2 });
    box(ctx, 71, -36, 3.5, 9, P.a.red, { ink: 1, amp: 0.2 });
    // Wheels (one hubcap missing).
    for (const [wx, cap] of [[-50, true], [48, false]]) {
      oval(ctx, wx, -7, 10, 10, P.ink);
      oval(ctx, wx, -7, 5.5, 5.5, cap ? P.metal[2] : P.metal[0], true, 1);
      if (!cap) for (let index = 0; index < 4; index += 1) rivet(ctx, wx + Math.cos(index * 1.57) * 3, -7 + Math.sin(index * 1.57) * 3, 0.8);
    }
    ctx.restore();
  }

  // Same three kidnappers, same possessions: a blade-shaped tall hood,
  // a short padded silhouette, and a broad capped bagman. Their clothing
  // belongs to one crew, but their bodies and faces cannot be swapped.
  function hood(ctx, kind, x, y, o = {}) {
    const bob=o.bob||0, grab=o.state==="grab";
    const expr=o.flinch||o.state==="phone-tell"?"scared":o.state==="phone-away"?"quiet":"neutral";
    drop(ctx,x,y,kind==="hood-cap"?18:13,3.5);
    ctx.save();ctx.translate(x,y);ctx.scale(o.face||1,1);
    if(o.flinch) ctx.rotate(-.065);
    if(kind==="hood-tall") {
      compactLegs(ctx,-38,6.2,7.2,bob,P.cloth[1],P.ink,P.a.sock);
      // Arms descend to opposite sides, not crossed into the same sternum.
      sleeve(ctx,[-12,-62,-21,-49,-17,-37],P.cloth[1],5.6,P.skin[1]);
      actorGarment(ctx,kind,0,-67,.78);
      sleeve(ctx,grab?[11,-63,19,-50,29,-42]:[11,-63,21,-49,17,-37],P.cloth[2],5.7,P.skin[1]);
      characterHead(ctx,kind,0,-78,{expr,look:o.look,tilt:.035});
    } else if(kind==="hood-small") {
      compactLegs(ctx,-22,6.2,7.2,bob,P.cloth[1],P.a.white);
      sleeve(ctx,[-15,-36,-21,-27,-14,-21],P.a.maroon,6,P.skin[1]);
      actorGarment(ctx,kind,0,-37,.92);
      const off=o.state==="phone-dropped", away=o.state==="phone-away";
      const arm=off?[14,-37,18,-28,8,-23]:[14,-37,away?17:21,away?-27:-31,20,-38];
      sleeve(ctx,arm,P.a.maroon,6.2,P.skin[1]);
      if(!off) {
        cut(ctx,"M18-44H24V-34H18Z",P.ink,1);
        cut(ctx,"M19.3-42.5H22.7V-36H19.3Z",o.phoneOff?P.cloth[2]:P.fluoro[2],0);
        // The existing sleeve hand grips the phone; no extra third hand.
      }
      characterHead(ctx,kind,0,-53,{expr,look:o.look});
    } else {
      compactLegs(ctx,-32,8,8.5,bob,P.cloth[0],P.ink);
      // One left arm, one right arm. The old paper-coloured shapes created
      // apparent third limbs (especially during the passenger-door grab).
      sleeve(ctx,[-20,-49,-26,-41,-21,-31],P.a.track,6.6,P.skin[0]);
      actorGarment(ctx,"hood-cap",0,-52,.91);
      const rightArm=grab?[19,-49,28,-36,32,-25]
        :o.reaching?[19,-49,28,-42,35,-40]
        :[19,-49,25,-38,17,-31];
      sleeve(ctx,rightArm,P.a.track,7,P.skin[0]);
      characterHead(ctx,"hood-cap",0,-68,{expr,look:o.look});
    }
    ctx.restore();
  }
  // YOU in the driver's seat, seen from above with the roof cut away: the
  // back of a head, the camel coat's shoulders, hands at the wheel. Never a face.
  // States: reach (a hand toward him), keys / pocket, turn / look (head toward
  // him or the rain), look-back (over the shoulder), reach-up (the dome light).
  function youSeated(ctx, x, y, o = {}) {
    const state = o.state || "idle", t = o.t || 0;
    const breathe = Math.sin(t / 900) * 0.35;
    drop(ctx, x, y + 12, 16, 5, 0.3);
    // "turn" (to him: "Off the dash, please." / "Okay, show-off."): the whole
    // body turns toward the passenger seat, one hand up off the wheel.
    // "look" ("It's just rain."): the body stays put; the head lifts to the
    // glass and one hand opens toward the rain on it.
    const twist = state === "turn" ? 0.34 : 0;
    const cos = Math.cos(twist), sin = Math.sin(twist);
    const at = (dx, dy) => [x + dx * cos - dy * sin, y + 2 + dx * sin + dy * cos];
    // Arms forward to the wheel, or reaching: drawn first, under the shoulders.
    const handR = state === "reach" ? [x + 27, y - 2] : state === "keys" ? [x + 15, y - 16] : state === "pocket" ? [x + 12, y + 5] : state === "reach-up" ? [x + 19, y + 13] : state === "turn" ? [x + 23, y - 19] : state === "look" ? [x + 6, y - 37] : [x + 8, y - 27];
    const handL = state === "look-back" ? [x - 13, y - 6] : [x - 8, y - 27];
    const [lsx, lsy] = at(-11, -3), [rsx, rsy] = at(11, -3);
    for (const [hx, hy, sx, sy] of [[handL[0], handL[1], lsx, lsy], [handR[0], handR[1], rsx, rsy]]) {
      line(ctx, sx, sy, hx, hy, P.ink, 6.4, hx, 0.1); line(ctx, sx, sy, hx, hy, P.wood[2], 4.4, hx, 0.1);
      oval(ctx, hx, hy, 2.6, 2.4, P.skin[1], true, 1);
    }
    if (state === "keys") { rect(ctx, P.metal[3], handR[0] + 1, handR[1] - 4, 2, 4); rect(ctx, P.a.brass, handR[0] - 2, handR[1] - 5, 2.4, 2.4); }
    if (state === "pocket") { rect(ctx, P.metal[3], x + 13, y + 1, 1.4, 3); oval(ctx, x + 12.4, y + 0.5, 1.5, 1.5, P.a.brass, true, 0.6); }
    // An open palm (the rain) or one raised finger (the dash): fingers out of the hand.
    if (state === "look") for (let f = -2; f <= 2; f += 2) line(ctx, handR[0] + f, handR[1] - 1, handR[0] + f * 1.4, handR[1] - 5, P.skin[1], 1.3, f, 0);
    if (state === "turn") { line(ctx, handR[0], handR[1] - 1, handR[0] + 1, handR[1] - 7, P.ink, 2.6, 3, 0); line(ctx, handR[0], handR[1] - 1, handR[0] + 1, handR[1] - 7, P.skin[1], 1.3, 3, 0); }
    // The camel coat's shoulders from above, the scarf ring, the back of the head.
    ctx.save(); ctx.translate(x, y + 2); ctx.rotate(twist); ctx.translate(-x, -y - 2);
    shape(ctx, [x - 17, y + 2, x - 14, y - 6, x - 5, y - 9, x + 5, y - 9, x + 14, y - 6, x + 17, y + 2, x + 14, y + 12, x - 14, y + 12], P.wood[2], { ink: CH, seed: 61, amp: CA });
    shape(ctx, [x - 15, y + 2, x - 12, y - 6, x - 5, y - 9, x - 3, y + 12, x - 12, y + 12], P.wood[1], { ink: false, seed: 62, amp: CA });
    rect(ctx, P.wood[3], x - 9, y - 8, 18, 1.4);
    oval(ctx, x, y - 6 + breathe * 0.2, 7.4, 4.6, P.a.maroon, true, 1.2);
    oval(ctx, x - 2, y - 7, 3, 1.6, P.a.maroonLight);
    line(ctx, x - 10, y + 1, x - 8, y + 9, P.a.maroonLight, 3.2, 92, 0.1);
    // The same cropped coils from above; a cheek and ear on the turn.
    const turn = state === "reach" || state === "turn" ? 3.2 : state === "look" ? 1.4 : state === "look-back" ? -3.2 : 0;
    const hy = y - 10 - (state === "look" ? 3 : 0);
    ctx.save();ctx.translate(x+turn,hy);
    cut(ctx,"M-10 3Q-13-3-10-7Q-11-13-5-12Q-2-17 3-13Q9-15 11-8Q14-3 10 4L3 10L-6 8Z",P.inkSoft,1.4);
    cut(ctx,"M-8-7Q-5-11-1-9M2-11Q6-12 9-7",null,1.4,P.wood[1]);
    if(turn>0) {
      cut(ctx,"M6-4L10-2L12 3L9 6L6 4Z",P.skin[1],.8);
      line(ctx,8,0,10,1,P.ink,1);
    }
    ctx.restore();
    if (turn) oval(ctx, x + turn * 2.3, hy + 1, 1.7, 2.6, P.skin[1], true, 0.8);
    ctx.restore();
  }
  // A shopping cart rattling past on its own; one wheel wants to go somewhere else.
  function cart(ctx, x, y, o = {}) {
    const jig = o.rolling && o.t ? Math.sin(o.t / 60) * 0.6 : 0;
    drop(ctx, x, y, 12, 3);
    ctx.save(); ctx.translate(x, y + jig);
    shape(ctx, [-12, -22, 12, -22, 9, -8, -9, -8], null, { ink: 1.2, amp: 0.2 });
    for (let gx = -10; gx <= 10; gx += 4) line(ctx, gx, -22, gx * 0.78, -8, P.metal[2], 0.6, gx, 0);
    line(ctx, -11, -15, 11, -15, P.metal[2], 0.6, 1, 0);
    line(ctx, 12, -22, 16, -26, P.metal[2], 1.2, 2, 0); rect(ctx, P.a.red, 14, -28, 4, 2);
    line(ctx, -8, -8, -8, -2, P.metal[1], 1); line(ctx, 8, -8, 8, -2, P.metal[1], 1);
    for (const wx of [-8, 8]) oval(ctx, wx, -1.5, 1.8, 1.8, P.ink);
    ctx.restore();
  }
  // ===== THE RIDE: the van moving under everyone =====
  // One road for the scenery, the crew and Rizo, so everything in the van
  // moves together. surge: + speeding up (bodies sway back, toward the rear
  // doors), − braking. bend: the road curving (lane lines drift, the tree on
  // the mirror swings). shiver: the engine in every seat. Still when reduced.
  function vanRide(t, reduced) {
    if (reduced || !t) return { surge: 0, bend: 0, drift: 0, shiver: 0 };
    const surge = Math.sin(t / 3700) * 0.6 + Math.sin(t / 8300 + 2.1) * 0.4;
    const bend = Math.sin(t / 5100 + 0.7) * 0.7 + Math.sin(t / 12900) * 0.3;
    return { surge, bend, drift: bend * 8, shiver: Math.sin(t / 29) * 0.22 + Math.sin(t / 47) * 0.16 };
  }

  // THE CREW IN THE VAN. The four people from outside, sitting where people
  // sit in a work van with the roof cut away: the DRIVER at the wheel on the
  // near side, facing the road; the TALL one twisted round in the passenger
  // seat with his slides on the dash, an arm over the seatback, watching; the
  // SMALL one on a milk crate and the CAPPED one on the wheel arch, both with
  // their backs to the far wall, facing the floor where Rizo is. Seat or feet
  // at x,y. Each keeps the shape that named them outside: hood peak, beanie
  // and pom, flat backwards cap, and the driver's sunglasses at night.
  //   o.look     world point the head turns to (speaker, Rizo, the phone)
  //   o.talking  head and one hand move;  o.quiet  head down, hunched
  //   o.state    "freeze": nothing moves but the road; "stare": every face on o.look, eyes lit
  //   o.point    the capped one's arm out at o.look;  o.phone  "film" | "call" (the small one)
  //   o.ride     vanRide();  o.bump  0..1 just after a pothole
  const CREW_HEIGHT = Object.freeze({ driver: 78, "hood-tall": 82, "hood-small": 72, "hood-cap": 68 });
  const CREW_HEAD = Object.freeze({ driver: [-1, -57], "hood-tall": [3, -59], "hood-small": [0, -47], "hood-cap": [0, -47] });
  function seated(ctx, kind, x, y, o = {}) {
    const who = CREW_HEAD[o.who] ? o.who : kind === "driver-seat" ? "driver" : "hood-tall";
    const t = o.t || 0, state = o.state || "idle";
    const still = state === "freeze" || state === "stare";
    const ride = o.ride || { surge: 0, shiver: 0 };
    const k = {
      t, state, still, quiet: Boolean(o.quiet) && !still, phone: o.phone || null, point: Boolean(o.point),
      // Bodies sway with the van; frozen, they hold themselves rigid against it.
      lean: ride.surge * (still ? 0.6 : 1.8) + (still ? 0 : ride.shiver * 0.3),
      hop: -(o.bump || 0) * 3.4,
      // One articulated emphasis per turn, rather than a hand flapping with
      // multiple fast oscillators all the time somebody is speaking.
      talk: o.talking && !still && t && Number.isFinite(o.talkAge)
        ? Math.sin(Math.PI * Math.min(1, o.talkAge / 1200)) * 1.1 : 0,
      talking: Boolean(o.talking) && !still,
      idle: still || !t ? 0 : Math.sin(t / 1100 + x * 0.1) * 0.4
    };
    const [hx, hy] = CREW_HEAD[who];
    const dx = o.look ? o.look.x - (x + hx) : 0, dy = o.look ? o.look.y - (y + hy) : 1, d = Math.hypot(dx, dy) || 1;
    k.look = { x: dx / d, y: dy / d };
    ctx.save(); ctx.translate(x, y);
    if (who === "driver") crewDriver(ctx, k);
    else if (who === "hood-tall") crewTall(ctx, k);
    else if (who === "hood-small") crewSmall(ctx, k);
    else crewCap(ctx, k);
    ctx.restore();
  }
  // Seated anatomy is two bent legs, one garment and two connected arms.
  // Body colours/collars and face geometry are the same as outside and portraits.
  function crewFigure(ctx, who, k) {
    const small=who==="hood-small", tall=who==="hood-tall", cap=who==="hood-cap", driver=who==="driver";
    const [hx,hy]=CREW_HEAD[who];
    if(small) {
      box(ctx,-11,-21,22,17,P.a.denim,{ink:1.1,amp:.2,seed:141});
      rect(ctx,P.a.umbrellaLight,-10,-20,20,1.5);
      for(const x of [-6,-1,4]) rect(ctx,P.ink,x,-15,2,8);
    }
    ctx.save();ctx.translate(0,k.hop);ctx.rotate(k.lean*.012+(k.quiet?.04:0));
    const leg=P.cloth[driver?0:1], shirt=small?P.a.maroon:cap?P.a.track:driver?P.a.rust:P.cloth[2];
    const shoulderY=hy+17, top=small?-20:cap?-23:driver?-27:-25;
    // The tall passenger stretches a shin; Cap sits planted; Small's shoes dangle.
    for(const side of [-1,1]) {
      const sx=side*(cap?10:small?7:7), knee=sx+side*(tall?4:cap?4:3);
      const heel=knee+side*(tall?3:small?1:2);
      cut(ctx,`M${sx-3.5} ${top}Q${knee-4} ${top+6} ${knee-3.5} ${top+12}L${heel-3.5} -4L${heel+4} -4L${knee+4} ${top+10}L${sx+3.5} ${top}Z`,leg,1.1);
      if(tall) cut(ctx,`M${heel-3} -8h7v5h-7Z`,P.a.sock,.6);
      oval(ctx,heel+2,-2.5,tall?5:small?4.6:5.5,2.4,small?P.a.white:P.ink,true,.8);
    }
    const left=driver?[-12,shoulderY+3,-24,-32,-33,-31]
      :tall?[-11,shoulderY+3,-20,-30,-18,-23]
      :[-15,shoulderY+3,-22,-23,-14,-19];
    sleeve(ctx,left,shirt,5.8,P.skin[driver||cap?0:1]);
    // Tailor the same garment to its seated shoulder/hip distance. Tall's
    // previous coat reached BEHIND the floor and swallowed both knees.
    actorGarment(ctx,who,0,shoulderY,tall?.55:small?.9:cap?.86:.84);
    const age=k.talking?k.talk:0;
    let right;
    if(driver) right=[12,shoulderY+3,0,-32,-18,-31];
    else if(small) right=[14,shoulderY+3,21,-24,18,k.phone? -39:-23-age*4];
    else if(cap&&k.point) right=[19,shoulderY+3,28,-29,34,-34];
    else right=[cap?19:10,shoulderY+3,cap?25:17,-25,cap?16:10,-20-age*5];
    sleeve(ctx,right,shirt,driver?6:6.3,P.skin[driver||cap?0:1]);
    if(small&&k.phone) {
      cut(ctx,"M16-46H23V-36H16Z",P.ink,1);
      cut(ctx,"M17.3-44.5H21.7V-38H17.3Z",k.phone==="call"?P.cold[3]:P.fluoro[2],0);
      // No duplicate skin oval: the phone-holding sleeve already has a hand.
    }
    if(driver) {
      // A steering wheel sits below the chin and BETWEEN the two hands.
      // At neck height the old loop read as a disembodied third arm.
      oval(ctx,-26,-32,12,7,null,true,2.2);
      line(ctx,-36,-32,-16,-32,P.metal[1],1.8,0,0);
      line(ctx,-26,-32,-26,-26,P.metal[1],1.8,0,0);
    }
    characterHead(ctx,who,hx,hy,{expr:k.still?"scared":k.quiet?"quiet":"neutral",look:k.look,tilt:k.quiet?.1:k.talking?-age*.08:0});
    ctx.restore();
  }
  function crewSmall(ctx,k) { crewFigure(ctx,"hood-small",k); }
  function crewCap(ctx,k) { crewFigure(ctx,"hood-cap",k); }
  function crewTall(ctx,k) { crewFigure(ctx,"hood-tall",k); }
  function crewDriver(ctx,k) { crewFigure(ctx,"driver",k); }

  function latch(ctx, x, y, o = {}) {
    const bob = o.bob || 0, expr = o.expr || "procedural", t = o.t || 0;
    drop(ctx, x, y, 10, 3);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (o.seated) {
      // Sitting: knees up, coat pooled on the bench.
      box(ctx, -2, -10, 10, 4, P.cloth[1], { ink: 1, amp: 0.2 });
      oval(ctx, 9, -4, 2.6, 1.8, P.ink);
      ctx.translate(0, 3);
    } else {
      legs(ctx, 0, 0, -9, 2.2, 3, P.cloth[1], bob, P.wood[1]);
      rect(ctx, P.a.mustard, -3.4, -4.6, 2.8, 1.6); // one odd sock
    }
    const lift = expr === "startled" ? -2 : 0, low = expr === "soft" ? 2 : 0;
    // The pinned coat tail, caught in the gate's frozen latch.
    if (o.pinned) {
      shape(ctx, [-8, -12, -30, -14, -31, -10, -9, -7], P.paper[2], { ink: 1.1, seed: 61, amp: 0.4 });
      stitches(ctx, -28, -12, -12, -10, P.paper[0], 3, 1, 0.7);
    }
    // Coat: an A-line of folded paper. Folds show; a taped tear at the hem.
    const lean = o.pinned ? 0.12 : o.pulling ? -0.1 : 0;
    ctx.rotate(lean);
    shape(ctx, [-6, -27, 7, -27, 10, -6, 4, -5, 1, -7, -10, -5], P.paper[2], { ink: CH, seed: 62, amp: CA });
    shape(ctx, [-6, -27, -1, -27, -3, -7, -10, -5], P.paper[1], { ink: false, seed: 63, amp: CA });
    line(ctx, 1.5, -26, 2.5, -7, P.paper[0], 0.7, 64, 0.2);
    line(ctx, -4, -18, 6, -13, P.paper[0], 0.6, 65, 0.2);
    tape(ctx, 6.2, -8, 4.5, -0.5, 66);
    // The satchel strap drags the far shoulder down; brass clasp on the flap.
    // Unloaded (the packet is out), the strap sits higher and the bag hangs flat.
    const light = o.state === "unloaded" ? 3 : 0;
    line(ctx, 6, -26, -6, -12 - light, P.wood[1], 1.8, 67, 0.2);
    box(ctx, -11, -15 - light, 8, 6.5 - light * 0.8, P.wood[2], { ink: 1.1, seed: 68, amp: 0.3 });
    rect(ctx, P.wood[1], -11, -15 - light, 8, 2.4);
    rect(ctx, P.a.brass, -7.8, -13.6 - light, 1.8, 1.8);
    // A postage stamp sewn on the shoulder.
    rect(ctx, P.paper[3], 3.2, -24.6, 3.6, 4); rect(ctx, P.a.stamp, 3.8, -24, 2.4, 2.8);
    // Hands: sleeve cuffs; pulling holds a chain.
    if (o.pulling) {
      shape(ctx, [6, -22, 13, -27, 14, -24, 8, -19], P.paper[2], { ink: 1.1, seed: 69, amp: 0.2 });
      line(ctx, 14, -26, 15 + Math.sin(t / 60), -38, P.metal[2], 1.3, 70, 0.2);
    }
    // Face strip: skin between collar and brim; the eyes carry the expression.
    oval(ctx, 1, -31 + lift, 5.4, 4.4, P.skin[2], true, 1.1);
    const ey = -31.6 + lift;
    // His narrow eye strip is intentional. Do not puppet the eyes around
    // every frame; the existing startled/soft/dry expressions do the acting.
    ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink; ctx.lineWidth = 1; ctx.lineCap = "round";
    if (expr === "startled") { oval(ctx, -0.8, ey, 1.4, 1.5, P.paper[3], true, 0.7); oval(ctx, 3.4, ey, 1.4, 1.5, P.paper[3], true, 0.7); oval(ctx, -0.6, ey, 0.6, 0.6, P.ink); oval(ctx, 3.6, ey, 0.6, 0.6, P.ink); }
    else if (expr === "soft") { ctx.beginPath(); ctx.arc(-0.8, ey - 0.4, 1.1, 0.2, Math.PI - 0.2); ctx.moveTo(4.5, ey - 0.4); ctx.arc(3.4, ey - 0.4, 1.1, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (expr === "dry") { line(ctx, -2, ey, 0.4, ey, P.ink, 1); ctx.beginPath(); ctx.arc(3.4, ey + 0.6, 1.2, Math.PI + 0.3, -0.3); ctx.stroke(); }
    else if (expr === "urgent") { line(ctx, -2.2, ey - 1.4, 0.4, ey - 0.4, P.ink, 1); line(ctx, 5, ey - 1.4, 2.4, ey - 0.4, P.ink, 1); oval(ctx, -0.8, ey + 0.6, 0.7, 0.7, P.ink); oval(ctx, 3.6, ey + 0.6, 0.7, 0.7, P.ink); }
    else { line(ctx, -2, ey, 0.4, ey, P.ink, 1.1); line(ctx, 2.4, ey, 4.8, ey, P.ink, 1.1); }
    // The collar: two stiff paper flaps up past the chin, a brass clasp at the throat.
    shape(ctx, [-6, -26 + low, -7, -35 + low, -1, -29.5 + low, 0.5, -25 + low], P.paper[3], { ink: 1.2, seed: 71, amp: 0.25 });
    shape(ctx, [8, -26 + low, 8.6, -35.5 + low, 2.6, -29.5 + low, 1, -25 + low], P.paper[2], { ink: 1.2, seed: 72, amp: 0.25 });
    oval(ctx, 0.8, -27 + low, 1.5, 1.3, P.a.brass, true, 0.7);
    // The cap: postal slate, short brim forward, a brass badge.
    ctx.save(); ctx.translate(1, -35 + lift); ctx.rotate(expr === "dry" ? 0.08 : expr === "startled" ? -0.12 : 0);
    shape(ctx, [-6, 0, -5.4, -5, 0, -6.4, 5.4, -5, 6, 0], P.a.postal, { ink: 1.3, seed: 73, amp: 0.2 });
    rect(ctx, P.a.postalLight, -4.5, -5.4, 8, 1.2);
    shape(ctx, [1, -0.6, 10, -0.2, 9.4, 1.6, 1, 1.4], P.cloth[0], { ink: 1, seed: 74, amp: 0.15 });
    oval(ctx, 1.4, -2.8, 0.9, 0.9, P.a.brass);
    ctx.restore();
    ctx.restore();
  }

  // Native-sized bodies are authored at Latch's scale, then converted once
  // to the existing actor coordinate contract. World scaling remains feet anchored.
  const NELL_ARMS = {
    work: [[8,-23,15,-20,12,-23],[-8,-23,1,-18,10,-19]],
    support: [[8,-23,15,-22,20,-24],[-8,-23,3,-22,12,-24]],
    lift: [[8,-23,21,-31,19,-47],[-8,-23,-20,-31,-18,-47]],
    clear: [[8,-23,15,-16,21,-12],[-8,-23,0,-17,7,-13]],
    point: [[8,-23,17,-26,23,-31],[-8,-23,-12,-18,-10,-12]],
    listen: [[8,-23,14,-18,9,-12],[-8,-23,-13,-18,-9,-12]],
    fix: [[8,-23,16,-21,21,-23],[-8,-23,6,-20,16,-23]],
    walk: [[8,-23,13,-18,12,-12],[-8,-23,-13,-18,-12,-12]],
    eat: [[8,-23,14,-19,7,-27],[-8,-23,1,-17,9,-19]],
    brace: [[8,-23,17,-22,23,-23],[-8,-23,7,-21,20,-18]],
    tired: [[8,-23,13,-28,6,-30],[-8,-23,-13,-18,-11,-13]],
    fit: [[8,-23,14,-15,18,-8],[-8,-23,3,-16,11,-8]],
    sit: [[8,-23,14,-18,17,-15],[-8,-23,2,-17,10,-16]]
  };
  function compactLegs(ctx, top, spread, width, bob, tone, shoe, sock) {
    for(const side of [-1,1]) {
      const step=(bob||0)*side, x=side*spread, end=x+step*.8, lift=Math.max(0,step)*.65;
      cut(ctx,`M${x-width/2} ${top}Q${x-width*.65} ${top*.5} ${end-width*.4} ${-3-lift}L${end+width*.4} ${-3-lift}Q${x+width*.6} ${top*.5} ${x+width/2} ${top}Z`,tone,1);
      if(sock) cut(ctx,`M${end-width*.42} ${-6-lift}h${width*.84}v3h${-width*.84}Z`,sock,.5);
      oval(ctx,end+1,-1.5-lift,width*.78,2.1,shoe,true,.8);
    }
  }
  function nell(ctx, x, y, o = {}) {
    const state=NELL_ARMS[o.state]?o.state:"work", bob=o.bob||0, t=o.t||0;
    const expr=state==="tired"?"tired":o.expr||(state==="listen"?"listening":"work");
    drop(ctx,x,y,11,3);
    ctx.save();ctx.translate(x,y);ctx.scale((o.face||1)*86/44,86/44);
    if(state==="sit") {
      cut(ctx,"M-11-8H11V0H-11Z",P.wood[1],.8);
      cut(ctx,"M-11-8H11V-5H-11Z",P.wood[2],0);
      compactLegs(ctx,-10,5,3,0,P.service[0],P.wood[0]);ctx.translate(-1,4);
    } else compactLegs(ctx,-9,state==="brace"?8:5,3,bob*.55,P.service[0],P.wood[0]);
    const lean={brace:.1,clear:.08,fit:.1,fix:.07,support:.035,tired:-.06,listen:-.055}[state]||0;
    ctx.rotate(lean);
    const hands=NELL_ARMS[state].map(arm=>arm.map((v,i)=>state==="walk" && i>=2 && i%2===0?v+(arm===NELL_ARMS[state][0]?-1:1)*bob*.4:v));
    sleeve(ctx,hands[1],P.service[1],3.1,P.skin[1]);
    characterBody(ctx,"nell",0,-25);
    // The material and tool use the same wrist endpoints as the two sleeves.
    if(state==="work" || state==="fix") {
      cut(ctx,"M7-20L18-21L19-12L8-11Z",P.paper[1],.7);
      cut(ctx,"M13-21L18-21L19-17L14-16Z",P.service[2],.6);
      stitches(ctx,9,-15,17,-16,P.a.maroonLight,2,1,.7);
    } else if(state==="support" || state==="lift") {
      const wrist=hands[0], yy=wrist[5]-2;
      const start=state==="lift"?-22:8, width=state==="lift"?45:27;
      cut(ctx,`M${start} ${yy}h${width}v3h${-width}Z`,P.wood[2],.8);
      line(ctx,start+1,yy+.6,start+width-1,yy+.6,P.wood[3],.9,0,0);
    } else if(state==="eat") {
      oval(ctx,9,-18,5,2.5,P.paper[2],true,.8);
      oval(ctx,9,-19,4,1.3,P.ember[1]);
    } else if(state==="fit") {
      cut(ctx,"M8-9L17-10L18-5L9-4Z",P.a.maroon,.8);
      line(ctx,10,-7,16,-8,P.a.brassLight,.9,0,0);
    }
    sleeve(ctx,hands[0],P.service[2],3.4,P.skin[2]);
    const [,,, ,hx,hy]=hands[0];
    if(state==="work") {
      const phase=(t%3300)/3300, stitch=phase<.29?Math.sin(Math.PI*phase/.29):0;
      line(ctx,hx,hy,17,-19-stitch,P.metal[3],.8,0,0);
      cut(ctx,`M${hx} ${hy}Q14-13 11-15`,null,.6,P.a.maroon);
    } else if(state==="fix") line(ctx,hx,hy,hx+6,hy+4,P.metal[3],1.6,0,0);
    else if(state==="eat") {line(ctx,hx,hy,hx+1,hy-2,P.metal[2],.9,0,0);oval(ctx,hx+1,hy-3,1.4,.8,P.metal[2]);}
    const tilt=expr==="listening"?-.1:expr==="tired"?.12:expr==="measuring"?.075:expr==="amused"?-.07:0;
    characterHead(ctx,"nell",0,-30,{expr,tilt:tilt+(o.addressed?-.035:0),look:o.look});
    ctx.restore();
  }
  function orr(ctx, x, y, o = {}) {
    const state=o.state||"tray", carry=state==="carry", free=state!=="tray"&&!carry;
    const expr=o.expr||"serving", bob=o.bob||0;
    drop(ctx,x,y,16,3.5);
    ctx.save();ctx.translate(x,y);ctx.scale((o.face||1)*82/42,82/42);
    // Two short planted paws and a single round torso: no human knee/neck stack.
    compactLegs(ctx,-7,10,5,bob*.4,P.a.rust,P.wood[0]);
    const far=carry?[-12,-23,-16,-18,-14,-13]:free?[-12,-23,-18,-18,-14,-14]:[-12,-23,-7,-17,5,-20];
    sleeve(ctx,far,P.a.rust,4,P.paper[1]);
    characterBody(ctx,"orr",0,-25);
    characterHead(ctx,"orr",0,-30,{expr,tilt:expr==="dry"?-.06:expr==="irritated"?.07:carry?.035:0,look:o.look});
    const near=carry?[12,-23,18,-19,17,-13]:free?[12,-23,19,-17,15,-12]:[12,-23,21,-17,25,-21];
    sleeve(ctx,near,P.a.rust,4.2,P.paper[2]);
    if(state==="tray") {
      cut(ctx,"M1-23L35-23L36-20L1-20Z",P.metal[2],.9);
      line(ctx,2,-22,34,-22,P.metal[3],.8,0,0);
      for(const bx of [10,26]) {
        cut(ctx,`M${bx-5}-26Q${bx}-23 ${bx+5}-26L${bx+3}-23H${bx-3}Z`,P.paper[3],.7);
        oval(ctx,bx,-26,4.3,1.2,P.ember[1]);
      }
    } else if(carry) {
      cut(ctx,"M15-19L19-20L22-6L18-5Z",P.metal[1],.9);
      line(ctx,17,-18,20,-7,P.metal[3],1,0,0);
    } else {oval(ctx,14,-12,1.5,.8,P.a.brass,true,.6);line(ctx,13,-13,16,-12,P.wood[1],.8,0,0);}
    ctx.restore();
  }
  // Empty greatcoat, split lantern, key and blank tag: four deliberate reads.
  // The attack openings still expose the exact hollow the player can reach.
  function porter(ctx, x, y, o = {}) {
    const t=o.t||0, open=Math.min(1,o.open||0), flash=o.flash;
    if(o.settled) {
      drop(ctx,x,y+14,27,6,.5);ctx.save();ctx.translate(x,y+14);
      cut(ctx,"M-27 0Q-22-15-7-15L15-13L26-5L28 2Z",P.cloth[1],1.7);
      cut(ctx,"M-18-9L1-12L17-8L5-3L-16-3Z",P.cloth[2],1);
      cut(ctx,"M-8-7L7-9L10-4L-5-3Z",P.a.maroon,1);
      for(const bx of [-8,0,8])oval(ctx,bx,-8,1.5,1.5,P.a.brass,true,.6);
      ctx.restore();porterLamp(ctx,x+32,y+3,.1,0);return;
    }
    drop(ctx,x,y+18,25,6,.5);
    ctx.save();ctx.translate(x,y+18);ctx.rotate((o.lean||0)*.12+Math.sin(t/900)*.01);
    const coat=flash?P.cloth[3]:P.cloth[1], lit=flash?P.paper[2]:P.cloth[2];
    cut(ctx,"M-11-60Q-20-56-19-41L-25 0L-8-2L0 3L10-1L25 0L18-41Q20-56 11-60Z",coat,1.8);
    cut(ctx,"M-18-48L-10-55L-8-24L-14-1L-25 0Z",P.cloth[0],0);
    cut(ctx,"M-13-60L-23-52L-11-37L-5-49L0-40L6-50L12-37L23-53L12-60Z",lit,1.5);
    cut(ctx,"M-18-52L-13-57L-7-45L-11-40Z M13-57L19-52L12-40L8-47Z",P.cloth[3],0);
    // Oversized repaired cuff, no epaulettes, decorative joints or frayed fingers.
    cut(ctx,"M-19-32L-11-33L-12-23L-21-22Z",P.paper[1],.9);
    stitches(ctx,-18,-30,-13,-30,P.ink,2.7,1,.7);
    if(open) {
      const half=3+12*open, top=-6-38*open;
      cut(ctx,`M${-half} 0L0 ${top}L${half} 0Z`,P.ink,1.5);
      cut(ctx,`M${-half+2} 0L0 ${top+5}L${half-2} 0Z`,P.a.maroon,0);
      cut(ctx,`M${-half*.55} 0L0 ${top+12}L${half*.55} 0Z`,flash?P.ember[4]:P.ember[1],0);
      line(ctx,-half,0,0,top,P.a.maroonLight,1.6,0,0);
      line(ctx,half,0,0,top,P.a.maroonLight,1.6,0,0);
    } else {
      cut(ctx,"M2-47L-2 1",null,1.3,P.ink);
      stitches(ctx,2,-43,-2,-3,P.paper[0],6,1.8,.9);
      for(const yy of [-39,-23])oval(ctx,-5,yy,2,2,P.a.brass,true,.8);
    }
    // One large working key, attached at the hip; one blank baggage tag.
    line(ctx,14,-31,19,-25,P.wood[1],1.2,0,0);
    oval(ctx,19,-23,3.4,3.4,null,true,1.5);
    line(ctx,19,-20,19,-11,P.a.brass,2,0,0);line(ctx,19,-12,23,-12,P.a.brass,2,0,0);
    line(ctx,-5,-39,-9,-31,P.paper[1],.9,0,0);
    cut(ctx,"M-13-30L-5-31L-4-21L-12-20Z",P.paper[2],.9);oval(ctx,-9,-28,1,1,P.ink);
    // A continuous collar carries the lantern during its sweep, not a joint chain.
    const aim=o.lampAim||0, hx=(o.lean||0)*4+aim*7, hy=-65-(aim?10:0)+(open?3:0);
    cut(ctx,`M-7-54L7-54L${hx+6} ${hy+7}L${hx-6} ${hy+7}Z`,P.cloth[1],1.3);
    porterLamp(ctx,hx,hy,open?.2:.05+aim*.25,open);
    ctx.restore();
  }
  // The detached lamp is the same head, including its split pane and repair.
  function porterLamp(ctx,x,y,tilt,open) {
    ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
    cut(ctx,"M-7-10Q-7-20 0-20Q7-20 7-10",null,1.8,P.a.brass);
    cut(ctx,"M-10-9L-7-12H7L11-9L9 9L5 13H-6L-10 9Z",P.wood[1],1.6);
    cut(ctx,"M-7-7H7L6 7H-7Z",open?P.ember[1]:P.ember[3],1);
    cut(ctx,"M-5-5H0V6H-5Z",open?P.ember[2]:P.ember[4],0);
    cut(ctx,"M1-7V8",null,1.6,P.wood[1]);
    cut(ctx,"M4-6L2-2L5 1L3 5",null,.9,P.wood[0]);
    cut(ctx,"M5-6L9-5L8-1L4-2Z",P.paper[1],.7);
    cut(ctx,"M-10 9H10L7 13H-7Z",P.a.brass,1);
    ctx.restore();
  }
  function lantern(ctx, x, y, t, glow = 1, tilt = 0.12, aim = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt + aim * 0.2);
    line(ctx, 0, -17, 0, -20, P.ink, 1.2); oval(ctx, 0, -21, 2, 2, null, true, 1);
    shape(ctx, [-8, -12, 0, -17, 8, -12], P.a.brass, { ink: 1.4, seed: 92, amp: 0.2 });
    box(ctx, -7, -12, 14, 15, P.ink, { ink: 1.4, amp: 0.2 });
    const lit = glow > 0.6 ? P.ember[4] : glow > 0.3 ? P.ember[3] : P.ember[1];
    rect(ctx, lit, -5.4, -10.4, 4.6, 11.8);
    rect(ctx, lit, 0.8, -10.4, 4.6, 11.8);
    rect(ctx, P.a.brass, -0.8, -12, 1.6, 15);
    // The cracked pane, taped.
    line(ctx, 1.2, -9, 4.6, -3, P.ink, 0.6); tape(ctx, 3, -6, 5, 0.9, 93);
    if (glow > 0.2) flame(ctx, -2.8, 0.2, 2.2 * glow, t + 200);
    shape(ctx, [-8, 3, 8, 3, 6, 6, -6, 6], P.a.brass, { ink: 1.3, seed: 94, amp: 0.2 });
    ctx.restore();
  }

  // ===== ENEMIES =====
  // DRAFTLING: a torn paper dart with a ragged tail. Its nose always points
  // where it will go: the silhouette is the attack before the tell begins.
  function draftling(ctx, x, y, o = {}) {
    const r = o.r || 8, t = o.t || 0, state = o.state || "idle", k = o.k || 0;
    ctx.save(); ctx.translate(x, y);
    drop(ctx, 0, r + 3, r * 0.9, 2.4, 0.35);
    if (state === "recover") {
      // Crumpled flat on the floor: open, and it looks it.
      ctx.translate(0, 4);
      shape(ctx, [-r * 1.2, 1, -r * 0.6, -3.5, 0, -1.5, r * 0.7, -4, r * 1.2, 1, r * 0.3, 3.6, -r * 0.5, 3], o.flash ? "#fff" : P.paper[2], { ink: CH, seed: 101, amp: 0.6 });
      line(ctx, -r * 0.6, -3, r * 0.3, 3, P.paper[0], 0.7);
      line(ctx, -4.5, -0.4, -1.5, 0.2, P.ink, 1.1); line(ctx, 1.5, 0.2, 4.5, -0.4, P.ink, 1.1);
      ctx.restore(); return;
    }
    ctx.rotate(o.angle || 0);
    const stretch = state === "lunge" ? 1.5 : state === "windup" ? 1 - 0.25 * k : 1;
    const pull = state === "windup" ? -3 * k : 0;
    const wing = state === "lunge" ? 0.55 : state === "windup" ? 1 - 0.35 * k : 1;
    const flutter = state === "idle" ? Math.sin(t / 110 + x) * 1.3 : 0;
    ctx.translate(pull, 0);
    // Tail streamers, trailing opposite the nose.
    ctx.strokeStyle = P.paper[1]; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-r * 0.7, side * 2);
      ctx.quadraticCurveTo(-r * 1.4, side * (4 + flutter), -r * (2 + (state === "lunge" ? 0.8 : 0)), side * (2 + flutter * 0.6));
      ctx.stroke();
    }
    const body = [r * 1.25 * stretch, 0, -r * 0.4, -r * 0.95 * wing + flutter * 0.3, -r * 0.85, -r * 0.35 * wing, -r * 0.55, 0, -r * 0.85, r * 0.35 * wing, -r * 0.4, r * 0.95 * wing - flutter * 0.3];
    shape(ctx, body, o.flash ? "#fff" : P.paper[2], { ink: CH, seed: 102, amp: 0.35 });
    shape(ctx, [r * 1.25 * stretch, 0, -r * 0.4, r * 0.95 * wing - flutter * 0.3, -r * 0.55, 0], o.flash ? "#fff" : P.paper[1], { ink: false, seed: 103, amp: 0.3 });
    line(ctx, r * 1.1 * stretch, 0, -r * 0.5, 0, P.paper[0], 0.8, 104, 0.1);
    // Two slit eyes near the nose; narrower as it commits.
    const eh = state === "windup" ? 0.7 : 1.3;
    ctx.save(); ctx.translate(r * 0.3, 0); ctx.rotate(-(o.angle || 0));
    rect(ctx, P.ink, -3.6, -2.4 - eh / 2, 2.6, eh); rect(ctx, P.ink, 1, -2.4 - eh / 2, 2.6, eh);
    ctx.restore();
    ctx.restore();
  }
  // NEEDLE: a sewing needle driven into a sagging pincushion with one button
  // eye. Its thread is its telegraph: drawn out along the lane, then pulled tight.
  function needle(ctx, x, y, o = {}) {
    const t = o.t || 0, state = o.state || "idle", aimX = o.aimX || 0, aimY = o.aimY ?? 1;
    drop(ctx, x, y + 4, 9, 2.8, 0.4);
    // The cushion.
    shape(ctx, [x - 9, y + 3, x - 8, y - 4, x - 2, y - 7, x + 5, y - 6, x + 9, y - 1, x + 8, y + 4], o.flash ? "#fff" : P.a.maroon, { ink: CH, seed: 111, amp: 0.4 });
    for (const sx of [-4, 2]) line(ctx, x + sx, y - 6, x + sx + 1, y + 3, P.a.maroonLight, 0.8, sx, 0.2);
    oval(ctx, x - 3.5, y - 1, 1.8, 1.8, P.paper[3], true, 0.8); oval(ctx, x - 3.5, y - 1, 0.6, 0.6, P.ink);
    // The needle leans toward its lane; it bends when spent.
    const lean = state === "recover" ? 0.5 * Math.sin(t / 90) : state === "indicate" ? 0.25 : 0.12;
    const tilt = Math.atan2(aimX, 1) * 0.5 + lean * (aimX >= 0 ? 1 : -1);
    ctx.save(); ctx.translate(x + 1, y - 5); ctx.rotate(tilt);
    shape(ctx, [-1.6, 0, 1.6, 0, 0.9, -22, 0, -25, -0.9, -22], o.flash ? "#fff" : P.metal[3], { ink: 1.2, seed: 112, amp: 0.1 });
    rect(ctx, P.metal[2], 0.2, -21, 0.8, 20);
    // The eye of the needle, and the thread through it.
    oval(ctx, 0, -19.5, 0.6, 2, P.ink);
    if (state !== "indicate" && state !== "pulse") {
      ctx.strokeStyle = P.danger[1]; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -19.5);
      ctx.quadraticCurveTo(5, -12, 4, -2); ctx.quadraticCurveTo(3, 6, -3, 7); ctx.stroke();
    }
    ctx.restore();
  }
  // The van's loose cooler: white lid, red tub, a dent, a sticker.
  function cooler(ctx, x, y, o = {}) {
    drop(ctx, x, y + 7, 12, 3);
    const w = o.wobble || 0;
    box(ctx, x - 11 + w, y - 8, 22, 15, P.a.red, { ink: CH, seed: 121, amp: 0.3 });
    box(ctx, x - 11 + w, y - 10, 22, 5, P.a.white, { ink: 1.2, seed: 122, amp: 0.3 });
    rect(ctx, P.paper[3], x - 9 + w, y - 9.6, 18, 1);
    box(ctx, x - 3 + w, y - 13, 6, 3, P.metal[2], { ink: 1, amp: 0.2 });
    box(ctx, x + 2 + w, y - 3, 6, 5, P.a.mustard, { ink: 0.7, amp: 0.2 });
    ctx.globalAlpha = 0.5; oval(ctx, x - 5 + w, y, 3, 2, "#7e2420"); ctx.globalAlpha = 1;
  }

  // ===== THE BOSS'S MARK (story spine v0.4) =====
  // A bell jar with a light shut inside. No letters, no face, no Rizo "R",
  // never Rizo-Signal blue. It is on his calling cards, his collectors and his
  // caller ID, and it turns up wherever a Rizo goes missing.
  function mark(ctx, x, y, size = 20, color = P.cold[3], o = {}) {
    const k = size / 20;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(0.6, 1.7 * k); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 6 * k, y + 7 * k); ctx.lineTo(x - 6 * k, y - 1 * k);
    ctx.quadraticCurveTo(x - 6 * k, y - 8 * k, x, y - 8 * k);
    ctx.quadraticCurveTo(x + 6 * k, y - 8 * k, x + 6 * k, y - 1 * k);
    ctx.lineTo(x + 6 * k, y + 7 * k);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8.5 * k, y + 8 * k); ctx.lineTo(x + 8.5 * k, y + 8 * k); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 9.6 * k, 1.3 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = o.lightAlpha ?? 1;
    ctx.beginPath(); ctx.arc(x, y + 1.5 * k, 2.3 * k, 0, Math.PI * 2); ctx.fillStyle = o.light || color; ctx.fill();
    ctx.restore();
  }
  // The same mark as SVG markup inside a 0..40 box (portraits, the phone, comics).
  const markSvg = (color = P.cold[3], light = color, width = 1.7) => `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 27 V19 Q14 12 20 12 Q26 12 26 19 V27"/><path d="M11.5 28 H28.5"/></g><circle cx="20" cy="10.4" r="1.3" fill="${color}"/><circle cx="20" cy="21.5" r="2.3" fill="${light}"/>`;
  // His calling card: black, the mark, nothing else.
  function callingCard(ctx, x, y, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle ?? -0.18);
    drop(ctx, 0, 3.4, 6.5, 1.6, 0.32);
    box(ctx, -6.5, -4.2, 13, 8.4, P.suit[0], { ink: 0.9, amp: 0.08, seed: 211 });
    rect(ctx, P.suit[2], -5.6, -3.4, 11.2, 0.6);
    mark(ctx, 0, 0.2, 6.4, P.cold[3]);
    ctx.restore();
  }
  // A collector: a cold, careful worker in a grey coverall with a hood and
  // goggles, a glass jar on his back and a lamp on a pole held out in front.
  // No face: cold glass goggles above a respirator. ~86u. States:
  // patrol (walking), spot (lamp up, leaning in), search (lamp swinging).
  // Stable encounter identity: no random wardrobe, no changes to patrols,
  // spotting or collision. The queue marshal, Rows gatherer, chase runner
  // and factory sentries remain one uniformed faction with different masses.
  function collectorProfile(id = "", state = "") {
    if (/runner|held|queue/.test(id) || state === "slam") return /runner/.test(id) || state === "slam" ? "runner" : "marshal";
    if (/row|clatter/.test(id)) return "gatherer";
    return "sentry";
  }
  function collector(ctx, x, y, o = {}) {
    const state=o.state||"patrol", t=o.t||0, role=o.profile||collectorProfile(o.id||"",state);
    const gatherer=role==="gatherer", runner=role==="runner", marshal=role==="marshal";
    const neck=runner?-58:marshal?-47:gatherer?-48:-47;
    const headY=runner?-63:marshal?-60:gatherer?-65:-62;
    const travel=state==="run" && o.moving?Math.sin((o.stride||0)*1.9)*4.8:o.bob||0;
    drop(ctx,x,y,gatherer?21:14,3.8);
    ctx.save();ctx.translate(x,y);ctx.scale(o.face||1,1);
    compactLegs(ctx,runner?-30:gatherer?-17:marshal?-12:-24,gatherer?10:marshal?5.5:7,gatherer?8:6,travel,P.metal[0],P.suit[1]);
    const lean=state==="grab"?.19:state==="watch-down"?.075:state==="slam"?-.1:state==="run"?(o.moving?.15:.055):0;
    ctx.translate(0,-30);ctx.rotate(lean);ctx.translate(0,30);
    // Each vessel is a working silhouette: retort, queue tube, chase flask, reservoir.
    if(gatherer) {
      cut(ctx,"M-36-26Q-45-42-40-58Q-36-69-27-63L-23-31Z",P.cold[0],1.1,P.cold[1]);
      cut(ctx,"M-36-56Q-40-43-33-32",null,1.8,P.cold[2]);
      cut(ctx,"M-41-30H-22V-25H-38Z",P.metal[1],1);
      oval(ctx,-31,-66,3,1.7,P.metal[2],true,.8);
    } else if(marshal) {
      cut(ctx,"M-23-25V-55Q-23-63-18-63Q-14-63-14-55V-25Z",P.cold[0],1.1,P.cold[1]);
      line(ctx,-20,-55,-20,-33,P.cold[2],1.4,0,0);
      cut(ctx,"M-25-29H-12V-24H-25Z",P.metal[1],1);
    } else if(runner) {
      cut(ctx,"M-25-57L-16-62L-10-34L-21-30L-29-53Z",P.cold[0],1.1,P.cold[1]);
      line(ctx,-23,-54,-18,-37,P.cold[2],1.5,0,0);
      cut(ctx,"M-24-34L-11-39L-10-32L-20-28Z",P.metal[1],1);
    } else {
      cut(ctx,"M-29-52L-25-59H-13L-10-52V-26H-29Z",P.cold[0],1.2,P.cold[1]);
      cut(ctx,"M-25-49H-14V-35H-25Z",P.cold[1],.8);
      line(ctx,-23,-46,-23,-38,P.cold[2],1.5,0,0);
      cut(ctx,"M-30-31H-10V-25H-30Z",P.metal[1],1);
    }
    const raise=state==="spot"?-9:state==="watch-down"?24:state==="run"?4+(o.moving?Math.sin((o.stride||0)*1.9)*1.2:0):state==="search"?Math.sin(t/350)*2.4:Math.sin(t/900)*.8;
    const lampY=-60+raise;
    // There are exactly two sleeves in every pose. Reaching replaces a sleeve;
    // it cannot add a third arm on top of the lamp-holding pair.
    const far=state==="slam"?[-9,neck+8,13,-62,34,-60]:state==="grab"?[-9,neck+8,3,-45,18,-45]:[-9,neck+8,-17,neck+21,-12,neck+26];
    sleeve(ctx,far,P.metal[0],5.5,P.suit[1]);
    characterBody(ctx,`collector-${role}`,0,neck);
    const headTilt=state==="search"?Math.sin(t/950)*.065:state==="watch-down"?.13:state==="spot"?-.15:state==="grab"?-.1:state==="run"?-.13:0;
    characterHead(ctx,`collector-${role}`,0,headY,{tilt:headTilt});
    const near=state==="grab"?[9,neck+8,24,-48,37,-42]:state==="slam"?[9,neck+8,23,-47,35,-42]:state==="watch-down"?[9,neck+8,17,-38,20,-36]:[9,neck+8,15,-46,20,-47+raise*.3];
    sleeve(ctx,near,P.metal[1],6,P.suit[1]);
    if(state==="slam") {
      // The lamp is clipped to the work belt while both hands close the gate.
      cut(ctx,"M-15-26H-8V-16H-15Z",P.suit[1],1);oval(ctx,-8,-21,2.2,3,P.cold[3]);
    } else {
      const wrist=state==="grab"?far:near;
      line(ctx,wrist[4],wrist[5],30,lampY,P.metal[3],1.7,0,0);
      cut(ctx,`M27 ${lampY-5}h8v6h-8Z`,P.suit[1],1);
      oval(ctx,34.5,lampY-2,2.4,2.8,P.cold[3]);
    }
    ctx.restore();
  }
  // ===== THE COLLECTION (v0.5) =====
  // A bell jar on a black base: glass, a stopper, a tag on string, and a small
  // light inside, holding very still (cold) or awake (warm, looking out at him).
  // The six he can reach are someone: each one's light keeps the shape of
  // where it was taken (the tag says where). Only the light differs; the jars
  // are all the same jar. bob(t) → [dx, dy]; blink(t) → eyes shut.
  const JAR_SOULS = Object.freeze({
    // A porch light: pale, fluttering, pressed toward any other light.
    moth: { glow: "#ffe6a6", core: "#fff4d2", hot: "#fffaf0", r: 1, lean: 2.2, bob: t => [Math.sin(t / 95) * 0.7, Math.sin(t / 61) * 0.6] },
    // Small (the poster said so), quick little hops, rain still on its edge.
    pip: { glow: P.ember[3], core: P.ember[3], hot: P.ember[4], r: 0.8, lean: 1.3, rim: P.wet[3], bob: t => [0, -Math.abs(Math.sin(t / 210)) * 1.5] },
    // The back seat of a school bus: can't sit still, rocks with the road.
    bean: { glow: "#f2924a", core: "#ff9f52", hot: P.ember[4], r: 1.05, lean: 1.2, bob: t => [Math.sin(t / 330) * 1.2, -Math.abs(Math.sin(t / 165)) * 1.1] },
    // The third candle: a flame's flicker, bright at the tip.
    spark: { glow: "#ffcf6a", core: "#ffd27a", hot: "#fffbe6", r: 0.95, lean: 1, flicker: true, bob: t => [Math.sin(t / 47) * 0.35, Math.sin(t / 31) * 0.3] },
    // A night-light left on: steady, soft, sleepy.
    wick: { glow: "#e9b26a", core: "#f3c07a", hot: "#ffe9c4", r: 0.95, lean: 0.8, bob: t => [0, Math.sin(t / 900) * 0.4], blink: t => (t % 5200) < 900 },
    // No name, a number, a long time ago: barely warm, slow to look.
    old: { glow: "#b07a4a", core: "#c58a52", hot: "#e8c28e", r: 0.85, lean: 0.6, dim: 0.6, bob: t => [0, Math.sin(t / 1600) * 0.3], blink: t => (t % 7000) < 1600 }
  });
  // The light inside a jar (its glow, its core, its eyes), in the jar's own
  // space. The room draws it again above the dark so a woken one really glows.
  function jarLight(ctx, o = {}, seed = 0) {
    const t = o.t || 0, awake = Boolean(o.awake), soul = JAR_SOULS[o.soul] || null;
    const breathe = awake ? 1 + Math.sin(t / 260) * 0.08 : 1 + Math.sin(t / 1400 + seed) * 0.04;
    // Where it looks: toward him (o.look, -1..1). Asleep, it only stirs when he is near.
    const look = Math.max(-1, Math.min(1, o.look || 0)), stir = awake ? 1 : Math.max(0, Math.min(1, o.stir || 0));
    const fade = o.alpha ?? 1;
    if (soul && awake) {
      // Pressed to the glass (o.press) when he is leaving: it leans as far as it can.
      const [bx, by] = soul.bob(t), press = o.press || 0, bloom = o.bloom || 0;
      const lx = look * soul.lean * (1 + press * 1.3) + bx, ly = -press * 1.6 + by;
      const flick = soul.flicker ? 0.85 + Math.abs(Math.sin(t / 53) * Math.sin(t / 37)) * 0.3 : 1;
      const rr = soul.r * breathe * flick * (1 + bloom * 0.7), dim = (soul.dim || 1) * (1 + press * 0.35 + bloom);
      ctx.globalAlpha = fade * Math.min(1, 0.5 * dim); oval(ctx, lx * 0.6, -8 + ly * 0.6, 6.2 * rr, 6.2 * rr, soul.glow);
      ctx.globalAlpha = fade * Math.min(1, dim);
      if (soul.rim) { ctx.globalAlpha = fade * 0.55; oval(ctx, lx, -7.6 + ly, 3.3 * rr, 3.7 * rr, soul.rim); ctx.globalAlpha = fade * Math.min(1, dim); }
      oval(ctx, lx, -7.6 + ly, 2.8 * rr, 3.2 * rr, soul.core);
      oval(ctx, lx, -7.2 + ly - (soul.flicker ? 0.6 : 0), 1.4 * soul.r, 1.7 * soul.r * flick, soul.hot);
      // Six souls, six silhouettes *inside the identical glass*. Readable
      // differences without labels or a different jar model.
      if (o.soul === "moth") {
        oval(ctx, lx - 2.3, -8.1 + ly, 1.6, 1.1, soul.hot);
        oval(ctx, lx + 2.3, -8.1 + ly, 1.6, 1.1, soul.hot);
      } else if (o.soul === "pip") {
        oval(ctx, lx, -5.9 + ly, 1.7, 1.3, soul.hot);
        oval(ctx, lx - 1.1, -5.4 + ly, 0.7, 0.7, soul.core);
      } else if (o.soul === "bean") {
        oval(ctx, lx, -5.8 + ly, 3.2, 1.2, soul.core);
      } else if (o.soul === "spark") {
        shape(ctx, [lx - 1.6, -8 + ly, lx, -12 + ly, lx + 1.9, -9 + ly, lx + 0.5, -5.5 + ly], soul.hot, { ink: false, amp: 0.05 });
      } else if (o.soul === "wick") {
        oval(ctx, lx, -5.4 + ly, 2.2, 0.9, soul.core);
      } else if (o.soul === "old") {
        shape(ctx, [lx - 2.2, -6.4 + ly, lx - 0.6, -10 + ly, lx + 1, -8.6 + ly, lx + 2.3, -6.4 + ly], soul.hot, { ink: false, amp: 0.03 });
      }
      ctx.globalAlpha = fade;
      const ex = lx + look * 0.7;
      if (soul.blink?.(t + seed * 13)) { rect(ctx, P.ink, ex - 1.8, -8.0 + ly, 1.3, 0.5); rect(ctx, P.ink, ex + 0.6, -8.0 + ly, 1.3, 0.5); }
      else { rect(ctx, P.ink, ex - 1.6, -8.6 + ly, 0.9, 1.2 * soul.r + 0.2); rect(ctx, P.ink, ex + 0.8, -8.6 + ly, 0.9, 1.2 * soul.r + 0.2); }
    } else {
      // Asleep and cold; a sleeper he stands near lifts toward him a little.
      const sx = look * 1.4 * stir, sy = -stir * 1.2;
      ctx.globalAlpha = fade * (awake ? 0.5 : 0.35 + stir * 0.15); oval(ctx, sx * 0.5, -8 + sy * 0.5, 6.2 * breathe, 6.2 * breathe, awake ? P.ember[3] : P.cold[1]); ctx.globalAlpha = fade;
      oval(ctx, sx, -7.6 + sy, 2.8 * breathe, 3.2 * breathe, awake ? P.ember[3] : P.cold[2]);
      oval(ctx, sx, -7.2 + sy, 1.4, 1.7, awake ? P.ember[4] : P.cold[3]);
      if (awake) { rect(ctx, P.ink, -1.6, -8.6, 0.9, 1.2); rect(ctx, P.ink, 0.8, -8.6, 0.9, 1.2); }
    }
    ctx.globalAlpha = 1;
  }
  function jar(ctx, x, y, o = {}) {
    const awake = Boolean(o.awake), size = o.size || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    drop(ctx, 0, 1.5, 7, 1.8, 0.4);
    box(ctx, -6.5, -2, 13, 3.4, P.suit[1], { ink: 0.9, amp: 0.05, seed: 301 });
    jarLight(ctx, o, x);
    // The glass dome, with a highlight and a little frost at its foot. On a
    // shelf (o.dim) the glass is only a glint; the light inside is what you see.
    const glass = o.dim ? 0.38 : 1;
    ctx.globalAlpha = 0.28 * glass; shape(ctx, [-5.5, -2, -5.5, -11, -3.5, -15, 3.5, -15, 5.5, -11, 5.5, -2], P.cold[3], { ink: false, seed: 302, amp: 0.05 }); ctx.globalAlpha = glass;
    ctx.strokeStyle = P.cold[2]; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-5.5, -2); ctx.lineTo(-5.5, -11); ctx.quadraticCurveTo(-5.5, -15.5, 0, -15.5); ctx.quadraticCurveTo(5.5, -15.5, 5.5, -11); ctx.lineTo(5.5, -2); ctx.stroke();
    rect(ctx, P.cold[3], -4, -12, 0.8, 6);
    ctx.globalAlpha = 1;
    oval(ctx, 0, -16.6, 1.6, 1.2, P.suit[2], true, 0.6);
    // Frost at the foot of the glass. The oldest one keeps a little even awake.
    if ((!awake || o.soul === "old") && o.frost !== false) { ctx.globalAlpha = awake ? 0.35 : 0.7; for (let index = 0; index < 4; index += 1) rect(ctx, P.cold[3], -5 + index * 3, -3.2 - (index % 2), 1.4, 0.7); ctx.globalAlpha = 1; }
    if (o.tag) { line(ctx, 4.6, -6, 7.4, -3.4, P.paper[1], 0.5); box(ctx, 6.4, -3.6, 3.4, 2.4, P.paper[2], { ink: 0.5, amp: 0.05 }); }
    ctx.restore();
  }
  // The wire crate in Intake. Its door shows how loose it is (notches) and the
  // frost his warmth has melted off the latch.
  function cage(ctx, r, o = {}) {
    const loose = o.loose || 0, notches = o.notches || 5, open = Boolean(o.open), t = o.t || 0;
    drop(ctx, r.x + r.w / 2, r.y + r.h + 4, r.w / 2 + 6, 4);
    // Pallet under it.
    box(ctx, r.x - 6, r.y + r.h - 2, r.w + 12, 8, P.wood[1], { ink: 1.1, amp: 0.2, seed: 311 });
    rect(ctx, P.wood[2], r.x - 5, r.y + r.h - 1, r.w + 10, 2);
    ctx.strokeStyle = P.metal[3]; ctx.lineWidth = 1;
    for (let x = r.x; x <= r.x + r.w; x += 7) { ctx.beginPath(); ctx.moveTo(x, r.y - 4); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
    for (let y = r.y - 4; y <= r.y + r.h; y += 8) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w - (open ? 0 : 0), y); ctx.stroke(); }
    box(ctx, r.x - 1, r.y - 6, r.w + 2, 3, P.metal[2], { ink: 0.9, amp: 0.05 });
    // His tag, wired to the top: the number from the roll.
    line(ctx, r.x + 10, r.y - 4, r.x + 12, r.y + 4, P.paper[1], 0.6);
    box(ctx, r.x + 9, r.y + 3, 9, 6, P.paper[2], { ink: 0.6, amp: 0.05 }); mark(ctx, r.x + 13.5, r.y + 6, 3.4, P.suit[1]);
    // The door on the right side: shut (latched) or swung out.
    const dx = r.x + r.w;
    if (open) {
      ctx.save(); ctx.translate(dx, r.y - 4); ctx.rotate(-1.1);
      for (let y = 0; y <= r.h + 4; y += 8) line(ctx, 0, y, 14, y, P.metal[3], 1);
      line(ctx, 0, 0, 0, r.h + 4, P.metal[3], 1.4); line(ctx, 14, 0, 14, r.h + 4, P.metal[3], 1.2);
      ctx.restore();
      return;
    }
    line(ctx, dx, r.y - 4, dx, r.y + r.h, P.metal[3], 2);
    const ly = r.y + r.h / 2;
    const shake = o.rattleAt != null && t - o.rattleAt < 220 ? Math.sin((t - o.rattleAt) / 18) * 1.4 : 0;
    // The latch bar slides out a little with every notch it gives.
    const slide = (loose / notches) * 3;
    box(ctx, dx - 3 + shake + slide, ly - 8, 9, 16, P.metal[2], { ink: 1.1, amp: 0.05, seed: 312 });
    // Notches on the latch bar: how far it has slid. A fresh one flares; lost ones blink red.
    const gained = o.notchAt != null && t - o.notchAt < 420 ? 1 - (t - o.notchAt) / 420 : 0;
    const lost = o.notchLostAt != null && t - o.notchLostAt < 700 && Math.floor((t - o.notchLostAt) / 110) % 2 === 0;
    for (let index = 0; index < notches; index += 1) {
      const on = index < loose, fresh = on && index === loose - 1 && gained > 0, gone = lost && !on && index < loose + 2;
      const py = ly + 5.6 - index * 2.9;
      if (fresh) { ctx.globalAlpha = 0.6 * gained; oval(ctx, dx + 1.5 + shake + slide, py + 0.8, 5 + gained * 3, 2.6 + gained * 1.4, P.ember[4]); ctx.globalAlpha = 1; }
      rect(ctx, gone ? P.a.red : on ? (fresh ? P.ember[4] : P.ember[3]) : P.metal[0], dx - 1.5 + shake + slide, py, 6, 1.8);
    }
    // Frost on the latch until he has warmed it loose.
    const frost = 1 - loose / notches;
    if (frost > 0) { ctx.globalAlpha = 0.8 * frost; for (let index = 0; index < 4; index += 1) shape(ctx, [dx - 3 + slide + index * 2.4, ly - 8, dx - 2 + slide + index * 2.4, ly - 11 - (index % 2) * 2, dx - 1 + slide + index * 2.4, ly - 8], "#e8f2ff", { ink: 0.3, amp: 0.05 }); ctx.globalAlpha = 1; }
  }
  // Factory belt goods: a steel-banded crate with his stencil; a tray of empty jars.
  function beltCrate(ctx, x, y, w, h, o = {}) {
    drop(ctx, x, y + h / 2 + 2, w / 2 + 1, 3);
    box(ctx, x - w / 2, y - h / 2 - 6, w, h, P.wood[2], { ink: 1.3, amp: 0.25, seed: Math.round(o.seed || 321) });
    // Opaque face, heavy lid and a dark side: this is COVER, never a jar tray.
    rect(ctx, P.wood[1], x + w / 2 - 6, y - h / 2 - 5, 5, h - 2);
    rect(ctx, P.wood[3], x - w / 2 + 1, y - h / 2 - 5, w - 2, 5);
    line(ctx, x - w / 2 + 2, y - h / 2 + 2, x + w / 2 - 2, y - h / 2 + 2, P.wood[1], 1);
    for (const dx of [-w / 2 + 5, w / 2 - 7]) {
      rect(ctx, P.metal[1], x + dx, y - h / 2 - 6, 2, h);
      rect(ctx, P.metal[3], x + dx, y - h / 2 - 6, 2, 2);
    }
    for (const dy of [-h / 2 + 2, h / 2 - 9]) {
      rivet(ctx, x - w / 2 + 6, y + dy, 0.7); rivet(ctx, x + w / 2 - 6, y + dy, 0.7);
    }
    mark(ctx, x, y - 4, 9, P.suit[1]);
  }
  function jarTray(ctx, x, y, w, h) {
    drop(ctx, x, y + h / 2 + 1, w / 2, 2);
    // Open wire rack: the floor and the spaces between bottles remain visible.
    // Low frame and exposed glass should never read as a hiding crate.
    rect(ctx, P.metal[2], x - w / 2, y + h / 2 - 4, w, 2.8);
    line(ctx, x - w / 2, y - h / 2 + 3, x + w / 2, y - h / 2 + 3, P.metal[3], 1);
    for (const dx of [-w / 2 + 1, w / 2 - 1]) line(ctx, x + dx, y - h / 2 + 3, x + dx, y + h / 2 - 1, P.metal[2], 1.2);
    for (let index = 0; index < 4; index += 1) {
      const jx = x - w / 2 + 4 + index * ((w - 8) / 3), jy = y - 2;
      ctx.globalAlpha = 0.45; shape(ctx, [jx - 2.6, jy, jx - 2.6, jy - 6, jx, jy - 8, jx + 2.6, jy - 6, jx + 2.6, jy], P.cold[3], { ink: 0.5, amp: 0.02 }); ctx.globalAlpha = 1;
      rect(ctx, P.cold[3], jx - 1.6, jy - 6, 0.6, 3);
    }
    line(ctx, x - w / 2 + 1, y + h / 2 - 1, x + w / 2 - 1, y + h / 2 - 1, P.metal[3], 1.1);
  }
  // A wall speaker: a grille and his mark. His voice comes out of these.
  function speaker(ctx, x, y, o = {}) {
    box(ctx, x - 9, y - 7, 18, 14, P.suit[1], { ink: 1.1, amp: 0.05, seed: 341 });
    for (let index = 0; index < 4; index += 1) rect(ctx, P.suit[3], x - 6, y - 4 + index * 2.6, 12, 1);
    mark(ctx, x, y + 11, 6, P.cold[3]);
    if (o.on) { ctx.globalAlpha = 0.35; oval(ctx, x, y, 14, 10, P.cold[3]); ctx.globalAlpha = 1; }
  }
  // A dog bowl. Steel, dented, with water in it or frost.
  function bowl(ctx, x, y, o = {}) {
    drop(ctx, x, y + 3, 9, 2.6);
    oval(ctx, x, y, 8.4, 3.8, P.metal[2], true, 1.1);
    ctx.beginPath(); ctx.ellipse(x, y, 8.4, 4.6, 0, 0, Math.PI); ctx.fillStyle = P.metal[1]; ctx.fill(); inkStroke(ctx, 1.1);
    oval(ctx, x, y - 0.4, 6.4, 2.4, o.water ? P.wet[2] : o.frost ? "#c9d6e0" : P.metal[0]);
    rect(ctx, P.metal[3], x - 6.5, y - 2.6, 4, 0.8);
    if (o.water && o.t != null) { const k = (o.t / 900) % 1; ctx.globalAlpha = 1 - k; ctx.strokeStyle = P.wet[3]; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x + 1, y - 0.4, 1 + k * 4, (1 + k * 4) * 0.36, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (o.frost) { ctx.globalAlpha = 0.8; for (let index = 0; index < 5; index += 1) rect(ctx, "#eef4f8", x - 5 + index * 2.4, y - 1.2 + (index % 2) * 0.8, 1, 0.6); ctx.globalAlpha = 1; }
    line(ctx, x + 3, y + 2.2, x + 5.4, y + 1.2, P.metal[0], 0.8);
  }

  // ===== PORTRAITS (64×64, the same rules in SVG) =====
  // A stepped light disc behind the head (the light they stand in), one ink
  // weight, two value bands, one detail that is only theirs.
  const INK_W = 2.4;
  const svg = body => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  const disc = (ground, mid, near, cx = 28, cy = 28) => `<rect width="64" height="64" fill="${ground}"/><circle cx="${cx}" cy="${cy}" r="30" fill="${mid}"/><circle cx="${cx}" cy="${cy}" r="20" fill="${near}"/>`;
  const rainLines = '<path d="M50 4 l-3 8 M58 14 l-3 8 M8 6 l-3 8 M44 22 l-3 8" stroke="#8fa6b8" stroke-width="1.2" opacity=".55"/>';
  const ink = `stroke="${P.ink}" stroke-width="${INK_W}"`;
  // Latch's bust: collar, face strip, cap. Expressions move the eyes, the
  // brim and how high the collar stands.
  function latchPortrait(expr) {
    const lift = expr === "startled" ? -3 : 0;
    const low = expr === "soft" ? 4 : expr === "startled" ? 2 : 0;
    const tilt = expr === "dry" ? 6 : expr === "urgent" ? 4 : expr === "startled" ? -7 : expr === "soft" ? -3 : 0;
    const ground = expr === "urgent" ? ["#1a100c", "#2c1810", "#3c2214"] : expr === "soft" ? ["#1a120d", "#2c1f15", "#3d2a1b"] : ["#14110f", "#1f1a15", "#29221b"];
    const eyes = {
      procedural: `<path d="M24 32 h6 M35 32 h6" stroke="${P.ink}" stroke-width="2.6"/>`,
      startled: `<circle cx="27" cy="32" r="3.4" fill="${P.paper[3]}" ${ink} stroke-width="1.8"/><circle cx="38" cy="32" r="3.4" fill="${P.paper[3]}" ${ink} stroke-width="1.8"/><circle cx="27.6" cy="32.4" r="1.3" fill="${P.ink}"/><circle cx="38.6" cy="32.4" r="1.3" fill="${P.ink}"/>`,
      dry: `<path d="M23.5 32.5 h6.5" stroke="${P.ink}" stroke-width="2.6"/><path d="M35 33 q3 -2.6 6.4 0" stroke="${P.ink}" stroke-width="2.4" fill="none"/>`,
      soft: `<path d="M24 31 q3 3 6 0 M35 31 q3 3 6 0" stroke="${P.ink}" stroke-width="2.3" fill="none"/>`,
      urgent: `<path d="M23 28.5 l7 2.6 M42 28.5 l-7 2.6" stroke="${P.ink}" stroke-width="2.4"/><circle cx="27" cy="33" r="1.7" fill="${P.ink}"/><circle cx="38.5" cy="33" r="1.7" fill="${P.ink}"/>`
    }[expr] || "";
    const mouth = expr === "soft" ? `<path d="M30 40.5 q3 2.2 6 0" stroke="${P.ink}" stroke-width="2" fill="none"/>` : expr === "startled" ? `<ellipse cx="33" cy="41.5" rx="2" ry="2.3" fill="${P.ink}"/>` : "";
    const urgentMarks = expr === "urgent" ? `<path d="M54 30 l6 -3 M55 37 l7 0 M53 44 l6 3" stroke="${P.ember[3]}" stroke-width="2.2"/>` : "";
    return svg(`${disc(...ground)}
<path d="M2 64 L5 52 Q8 47 18 45 L46 45 Q57 47 60 53 L62 64 Z" fill="${P.paper[2]}" ${ink}/>
<path d="M33 46 L31 64 L62 64 L60 53 Q57 47 46 45 Z" fill="${P.paper[1]}"/>
<path d="M33 46 L31 64" stroke="${P.paper[0]}" stroke-width="1.4"/><path d="M14 50 L22 58" stroke="${P.paper[0]}" stroke-width="1.2"/>
<path d="M50 46 L24 64" stroke="${P.wood[1]}" stroke-width="5"/><path d="M50 46 L24 64" stroke="${P.ink}" stroke-width="1" opacity=".5"/>
<rect x="8" y="52" width="7" height="8" fill="${P.paper[3]}" ${ink} stroke-width="1.4"/><rect x="9.6" y="53.6" width="3.8" height="4.8" fill="${P.a.stamp}"/>
<path d="M21 ${27 + lift} Q20 ${40 + lift} 33 ${44} Q45 ${40 + lift} 44 ${27 + lift} Z" fill="${P.skin[2]}" ${ink}/>
<path d="M21 ${30 + lift} Q24 ${36 + lift} 21 ${40 + lift}" stroke="${P.skin[1]}" stroke-width="3" fill="none"/>
<g transform="translate(0 ${lift})">${eyes}</g>${mouth}
<path d="M18 ${46 + low} L17 ${29 + low} L30 ${40 + low} L32 ${47 + low} Z" fill="${P.paper[3]}" ${ink}/>
<path d="M47 ${46 + low} L49 ${28 + low} L36 ${40 + low} L34 ${47 + low} Z" fill="${P.paper[2]}" ${ink}/>
<path d="M19 ${44 + low} L19 ${33 + low} L27 ${40 + low}" stroke="${P.paper[0]}" stroke-width="1.2" fill="none"/>
<rect x="40" y="${36 + low}" width="9" height="3.6" fill="${P.a.tape}" transform="rotate(-32 44 ${38 + low})"/>
<circle cx="33" cy="${43 + low}" r="2.8" fill="${P.a.brass}" ${ink} stroke-width="1.6"/><path d="M33 ${43 + low} q2 3 0 5" stroke="${P.ink}" stroke-width="1.4" fill="none"/>
<g transform="rotate(${tilt} 33 ${22 + lift}) translate(0 ${lift})">
<path d="M18 26 Q18 11 33 10 Q47 11 48 24 Z" fill="${P.a.postal}" ${ink}/>
<path d="M22 15 Q33 9 44 15" stroke="${P.a.postalLight}" stroke-width="2.4" fill="none"/>
<path d="M30 23.5 L57 22 Q60 25 55 28 L30 28 Z" fill="${P.cloth[0]}" ${ink}/>
<circle cx="38" cy="17" r="2.6" fill="${P.a.brass}" ${ink} stroke-width="1.4"/>
<path d="M18 26 L16 31" stroke="${P.ink}" stroke-width="3"/>
</g>${urgentMarks}`);
  }
  // These are crops of the same garment and head paths drawn in the world.
  // Enlarging the bust changes framing, never a character's species or costume.
  function nellPortrait(expr) {
    const tilt=expr==="listening"?-6:expr==="tired"?7:expr==="measuring"?4:expr==="amused"?-4:0;
    return svg(`${disc(P.below[1],P.service[0],P.service[1])}
<g transform="translate(32 83) scale(1.8)"><g transform="translate(0 -25)">${characterBodySvg("nell")}</g>
<g transform="translate(0 -30) rotate(${tilt})">${characterHeadSvg("nell",expr)}</g></g>`);
  }
  function orrPortrait(expr) {
    const tilt=expr==="dry"?-4:expr==="irritated"?4:0;
    return svg(`${disc(P.below[1],P.wood[1],P.wood[2])}
<g transform="translate(32 80) scale(1.72)"><g transform="translate(0 -25)">${characterBodySvg("orr")}</g>
<g transform="translate(0 -30) rotate(${tilt})">${characterHeadSvg("orr",expr)}</g></g>`);
  }
  function youPortrait() {
    // Portrait and street share exact coat, face and umbrella vector geometry.
    // The framing is the only change; no separately redrawn "YOU".
    return svg(`${disc(P.night[0],P.night[1],P.night[2],34,20)}${rainLines}
<g transform="translate(32 14) scale(1.05)">${partsSvg(keeperCanopyParts)}</g>
<g transform="translate(32 49) scale(1.3)">${characterBodySvg("you")}</g>
<g transform="translate(32 29) scale(1.3)">${characterHeadSvg("you")}</g>`);
  }
  function hoodPortrait(who, expr = "neutral") {
    const small=who==="hood-small", cap=who==="hood-cap", driver=who==="driver";
    const scale=small?1.3:cap?1.23:driver?1.3:1.24;
    const headY=small?33:cap?29:driver?27:30, tilt=expr==="scared"?-5:0;
    return svg(`${disc(P.night[0],P.night[1],P.sodium[0],46,14)}${rainLines}
<g transform="translate(32 51) scale(1.3)">${characterBodySvg(who)}</g>
<g transform="translate(32 ${headY}) rotate(${tilt}) scale(${scale})">${characterHeadSvg(who,expr)}</g>`);
  }

  // THE BOSS: a voice before he is anything else. His "face" is his caller
  // ID: the mark on a dark phone screen. calm = the glow held steady; cold =
  // the screen flares white-blue and the signal shakes.
  const bossPortrait = cold => svg(`<rect width="64" height="64" fill="${P.suit[0]}"/>
<rect x="13" y="3" width="38" height="60" rx="7" fill="${P.suit[1]}" ${ink}/>
<rect x="16.5" y="9" width="31" height="46" rx="2.5" fill="${cold ? P.cold[0] : "#0f161c"}"/>
<circle cx="32" cy="31" r="${cold ? 15 : 11}" fill="${P.cold[1]}" opacity="${cold ? 0.42 : 0.26}"/>
<g transform="translate(12 11)">${markSvg(P.cold[3], cold ? "#ffffff" : P.cold[2], cold ? 2 : 1.7)}</g>
<path d="M28 6 h8" stroke="${P.suit[3]}" stroke-width="1.3"/>
<circle cx="32" cy="59" r="1.8" fill="${P.suit[3]}"/>
${cold ? `<path d="M6 22 q-3 9 0 18 M58 22 q3 9 0 18 M2 18 q-4 13 0 26 M62 18 q4 13 0 26" stroke="${P.cold[2]}" stroke-width="1.3" fill="none" opacity=".8"/>` : `<path d="M22 49 h20" stroke="${P.cold[1]}" stroke-width="1" opacity=".6"/>`}`);
  // CAPPED HOOD: the quiet one. Backwards black cap over the hood, red
  // bandana over his mouth, a nicked eyebrow, eyes that do not blink.
  const capPortrait = hoodPortrait("hood-cap");
  const PORTRAITS = Object.freeze({
    you: Object.freeze({neutral:youPortrait()}),
    nell: Object.freeze(Object.fromEntries(["work","measuring","listening","amused","irritated","tired"].map(expr => [expr,nellPortrait(expr)]))),
    orr: Object.freeze(Object.fromEntries(["serving","irritated","dry"].map(expr => [expr,orrPortrait(expr)]))),
    latch: Object.freeze({ procedural: latchPortrait("procedural"), startled: latchPortrait("startled"), dry: latchPortrait("dry"), soft: latchPortrait("soft"), urgent: latchPortrait("urgent") }),
    "hood-tall": Object.freeze({neutral:hoodPortrait("hood-tall")}),
    "hood-small": Object.freeze({neutral:hoodPortrait("hood-small")}),
    driver: Object.freeze({neutral:hoodPortrait("driver")})
  });

  const coatPortrait = svg(`${disc("#0e1418", "#1d2a33", "#2c3d48", 32, 44)}
<path d="M4 64 L10 22 Q20 14 32 16 Q44 14 54 22 L60 64 Z" fill="${P.cold[3]}" ${ink}/>
<path d="M32 16 L24 40 L32 64 L40 40 Z" fill="${P.cold[1]}" ${ink} stroke-width="1.8"/>
<path d="M32 16 L27 30 M32 16 L37 30" stroke="${P.cold[2]}" stroke-width="1.6"/>
<path d="M44 26 h7 v14 h-7 Z" fill="${P.cold[2]}" ${ink} stroke-width="1.4"/><path d="M47 22 v12" stroke="${P.ink}" stroke-width="2.4"/>
<path d="M8 50 L30 46 L32 64 L10 64 Z" fill="${P.paper[2]}" ${ink} stroke-width="1.8"/><path d="M14 52 h12 M14 56 h10 M14 60 h12" stroke="${P.metal[1]}" stroke-width="1.2"/>
<g transform="translate(16 46) scale(.22)">${markSvg(P.suit[1], P.cold[3], 3).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
<path d="M0 0 H64 V6 H0 Z" fill="#0e1418"/>`);
  // v0.4: the hoods can be scared (of him); the capped hood has a face; the
  // Boss has only his caller ID.
  const CAST_PORTRAITS = Object.freeze({
    ...PORTRAITS,
    "hood-tall": Object.freeze({ ...PORTRAITS["hood-tall"], scared: hoodPortrait("hood-tall","scared") }),
    "hood-small": Object.freeze({ ...PORTRAITS["hood-small"], scared: hoodPortrait("hood-small","scared") }),
    driver: Object.freeze({ ...PORTRAITS.driver, scared: hoodPortrait("driver","scared") }),
    "hood-cap": Object.freeze({ neutral: capPortrait }),
    boss: Object.freeze({ calm: bossPortrait(false), cold: bossPortrait(true) }),
    // v0.5: a white coat seen through a grate: lapels, a pen, a clipboard with
    // his mark. The head is out of frame. The Boss's people never get a face.
    coat: Object.freeze({ neutral: coatPortrait })
  });

  return Object.freeze({
    characterHead, characterHeadSvg, characterBodySvg, cut,
    P, RULES, HEIGHT, WORLD_SCALE, rng, seedOf, trace, inkStroke, shape, box, oval, line, rect, drop,
    tape, stitches, rivet, worn, label,
    concrete, asphalt, tiles, planks, wallFace, block, metalPanel, clip,
    createLighting, flame, hearth,
    keeper, keeperSprite, keeperSpriteFrame, keeperSpriteStatus: () => keeperImageState, onKeeperImageChange, KEEPER_ATLAS, keeperLegs, sleeve, youCoat, van, hood, seated, vanRide, CREW_HEIGHT, CREW_HEAD, youSeated, cart, latch, nell, orr, porter, lantern, draftling, needle, cooler, bowl,
    mark, markSvg, callingCard, collector, collectorProfile, jar, jarLight, cage, beltCrate, jarTray, speaker,
    PORTRAITS: CAST_PORTRAITS
  });
});
