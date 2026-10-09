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
  // How far above its feet an actor's head is (speech bubbles, prompts).
  const HEIGHT = Object.freeze({ keeper: 100, "hood-tall": 100, "hood-small": 76, "hood-cap": 88, latch: 42, van: 84, porter: 90, nell: 86, orr: 82, collector: 80 });

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
  function headDesign(who, expr = "neutral") {
    const parts = [], add = (...p) => parts.push(...p);
    const eyes = (x, y, gap, wide = false, lazy = false) => {
      for (const side of [-1, 1]) {
        const ex = x + side * gap;
        if (expr === "quiet" || expr === "tired") add(vp(`M${ex-2} ${y}q2 1.8 4 0`, null, 1.2, P.paper[2]));
        else {
          add(ve(ex, y, wide || expr === "scared" ? 2.4 : 2.1, lazy && expr !== "scared" ? 1 : 1.8, P.paper[3]));
          add(ve(ex + .4, y + .3, .85, .95, P.ink, 0, true));
        }
      }
    };
    if (who === "you") {
      add(vp("M-5 6L-5 12Q0 15 6 11L6 5Z", P.skin[0]));
      add(vp("M-10-4Q-10-14 1-14Q12-14 11-3L13 1L10 3Q9 10 3 11Q-3 11-7 6Z", P.skin[1]));
      add(vp("M-9-5L-5-7L-4 6L1 10Q-5 10-8 5Z", P.skin[0], 0));
      add(ve(-8, 0, 2.8, 3.4, P.skin[1], 1), vp("M-9 0q2-2 3 1", null, .8, P.skin[0]));
      // A shaped, cropped coil mass; the hairline and beard survive without
      // individual hair strands or a face swallowed by umbrella shadow.
      add(vp("M-10-3Q-13-7-10-10Q-12-14-7-15Q-6-19-2-16Q1-19 5-16Q10-16 11-12L11-6Q7-9 3-8L-5-8L-6-2Z", P.inkSoft));
      add(vp("M-8-12Q-3-16 5-13", null, 1.5, P.wood[1]));
      add(vp("M-4 4L-1 7Q4 9 10 4L9 8Q5 13 0 11L-5 8Z", P.inkSoft, .8));
      add(vp("M-3-4q2-1 4 0M5-4q2-1 4 0", null, 1.4));
      add(ve(-1, -1.8, 1, 1.2, P.ink), ve(7, -1.8, 1, 1.2, P.ink));
      add(vp("M3-1L4 2L2 3", null, .9, P.skin[0]));
      add(vp("M1 6q3 1.8 6-1", null, 1.2, P.paper[1]));
    } else if (who === "nell") {
      const amused = expr === "amused", tired = expr === "tired", measuring = expr === "measuring", irritated = expr === "irritated";
      const listening = expr === "listening";
      // A narrow chin and strong cheek plane, framed by a heavy swept twist.
      // The wrap holds hair out of the job; the chalk is her only small prop.
      add(vp("M-11-10Q-20-9-19-1Q-22 4-15 8L-9 7L-7-9Z", P.wood[0]));
      add(vp("M-16-6Q-20-2-16 3M-12-6Q-16 0-12 5", null, 1.5, P.wood[1]));
      add(vp("M-5 7L-6 14L3 17L8 11L6 4Z", P.skin[0]));
      add(vp(amused ? "M-10-5Q-7-14 2-13L10-9L11-2L15 1L11 4Q10 9 3 12L-3 10L-9 4Z" : "M-10-5Q-7-14 2-13L10-9L11-2L15 1L11 4L9 9L2 12L-4 9L-9 3Z", P.skin[1]));
      add(vp("M-8-3L-4-7L-4 3L-1 8L2 12L-4 9L-9 3Z", P.skin[0], 0));
      add(vp("M1-8L7-7L9-2L12 1L8 2L7 6L1 5Z", P.skin[2], 0));
      add(vp("M-9-3Q-15-5-14 1Q-12 6-8 3Z", P.skin[1], 1));
      add(vp("M-12 0Q-9-2-9 2", null, .9, P.skin[0]));
      add(vp("M-11-5Q-16-13-7-18Q3-21 11-13L13-5L7-9Q3-5-3-8L-7-3L-7 2L-10 1Z", P.wood[0]));
      add(vp("M-5-13Q1-17 8-12L6-10Q0-11-3-10Z", P.wood[1], 0));
      add(vp("M-10-8L-8-10L-7-3L-9 0Z", P.paper[0], 0));
      // The wrap is a folded crescent, with one knot behind the temple.
      add(vp("M-15-8Q-18-18-8-21L1-20L11-15L7-12Q-1-17-9-13L-11-5Z", P.a.maroon));
      add(vp("M-13-16Q-6-21 1-17L6-14Q-4-18-11-11Z", P.a.maroonLight, 0));
      add(vp("M-14-12L-20-14L-21-8L-16-5L-12-8Z", P.a.maroon, 1.1));
      add(vp("M-17-7L-20 4L-14 1L-12-8Z", P.a.maroon, 1));
      add(vp("M-12-2L-6-5", null, 2.1, P.paper[3]));
      // Six different eye planes, cheeks and mouths; none is a brow swap.
      if (amused) {
        add(vp("M-4 0Q-1-3 2 0M5-1Q8-4 11-1", null, 1.4));
        add(vp("M-5 3L-2 4M8 3L11 2", null, 1.1, P.skin[0]));
        add(vp("M-1 5Q5 7 10 3Q8 12 2 10Z", P.wood[0], 1));
        add(vp("M0 5.5Q5 7 9 4.5L7 7L2 7Z", P.paper[3], 0));
      } else if (tired) {
        add(vp("M-4 0Q-1 2 2 0M5 0Q8 2 10 0", null, 1.3));
        add(vp("M-4 3L1 4M6 4L10 2", null, .9, P.skin[0]));
        add(vp("M1 8Q5 6 8 8", null, 1.2));
      } else {
        add(vp(measuring ? "M-4 0L2 0L0 1Z" : irritated ? "M-4-1L2 0Q0 3-3 2Z" : listening ? "M-4 0Q-1-4 2-1Q3 3-2 3Z" : "M-4 0Q-1-2 2-1Q2 3-2 2Z", P.paper[3], .8));
        add(vp(irritated ? "M5 0L10-2L11 1Q8 3 6 2Z" : listening ? "M5-1Q8-5 11-2Q12 2 8 2Z" : "M5-1Q8-3 11-2L10 1Q7 2 5 1Z", P.paper[3], .8));
        if (!measuring) add(ve(listening ? -1.7 : -.1, .5, 1.05, 1.25, P.ink, 0, true));
        add(ve(listening ? 7 : 8.4, -.4, 1, 1.2, P.ink, 0, true));
        add(vp(irritated ? "M1 8L8 6L9 7" : listening ? "M2 7Q5 5 7 7L6 9L3 9Z" : measuring ? "M0 7L5 7L7 5" : "M0 6Q4 9 8 5", listening ? P.wood[0] : null, 1.15));
      }
      add(vp(irritated ? "M-4-4L2-2M5-2L10-5" : tired ? "M-4-4L1-3M5-3L10-4" : listening ? "M-4-5Q-1-7 2-4M5-5L10-6" : "M-4-4Q-1-6 2-4M5-5L10-5", null, 1.4));
      add(vp("M4 0L4 3L7 3", null, 1, P.skin[0]));
    } else if (who === "orr") {
      const dry = expr === "dry", irritated = expr === "irritated";
      // Low horizontal face, broad bridge and a hanging horseshoe moustache.
      // Hospitality lives in the cheek; stubbornness lives in the lower jaw.
      add(vp("M-7 6L-8 14Q0 19 9 13L9 4Z", P.skin[0]));
      add(vp("M-12-7Q-7-14 5-11L12-6L12 2L15 5L12 11L6 14L-3 14L-11 10Z", P.skin[0]));
      add(vp("M0-7Q9-7 11 0L13 5L9 10L1 11L-2 5Z", P.skin[1], 0));
      add(vp("M-11-4Q-18-6-17 1Q-16 7-11 6L-9 2Z", P.skin[0], 1));
      add(vp("M-15-1L-12 0L-14 3", null, 1, P.wood[0]));
      add(vp("M-12-6L-8-5L-8 5L-11 7Z", P.inkSoft, 0));
      add(vp(irritated ? "M-6-2L0-1L-1 2L-5 2Z" : dry ? "M-6-2Q-2-5 0-2L-1 2L-5 1Z" : "M-6-2Q-3-4 0-2L-1 1L-5 1Z", P.paper[2], .75));
      add(vp(irritated ? "M6-1L12-3L12 0L7 1Z" : "M6-2L11-3L12 0L7 1Z", P.paper[2], .75));
      add(ve(-2.5, -.7, .85, 1.05, P.ink, 0, true), ve(9, -1, .85, 1, P.ink, 0, true));
      add(vp(irritated ? "M-7-5L0-3M6-4L12-6" : dry ? "M-7-6Q-3-9 0-6M6-4H12" : "M-7-5Q-4-6 0-5M6-5L12-5", null, 1.6));
      add(vp("M1-3Q4-5 6-1Q10-1 10 3Q9 6 4 6Q-1 5-1 2Z", P.skin[1], 1));
      add(vp("M2 1Q4-1 6 1", null, 1.2, P.skin[2]));
      add(vp("M1 5Q-5 3-7 8L-8 12L-4 10L-2 7L1 8L5 8L9 7L11 11L13 12L13 7Q10 3 6 5Z", P.inkSoft, 1));
      add(vp("M-5 7L-6 10M10 7L11 10", null, 1.25, P.paper[0]));
      add(vp(irritated ? "M0 11H7" : dry ? "M-1 11Q4 14 9 9L7 13L2 14Z" : "M0 10Q4 13 8 10", dry ? P.wood[0] : null, 1));
      add(vp("M-2 15Q2 16 5 15", null, 1.4, P.inkSoft));
      // Soft sloping cap, not another rounded helmet. A single old repair.
      add(vp("M-15-6L-14-13Q-10-20 0-18L9-15L14-8L9-5Z", P.cloth[2]));
      add(vp("M-12-13Q-5-18 4-15L9-10L-3-11Z", P.cloth[3], 0));
      add(vp("M-14-8L15-8L18-5L12-3L-9-4Z", P.cloth[1], 1.1));
      add(vp("M-9-15L-4-16L-3-12L-8-11Z", P.paper[0], .8));
    } else if (who === "hood-tall") {
      add(vp("M-12 11L-15-5Q-14-13-6-17L6-15L15-5L14 7L9 13Z", P.cloth[2]));
      add(vp("M-12 8L-12-5L-6-14L-5-6L-6 10Z", P.cloth[1], 0));
      add(vp("M-6-6Q0-11 8-5L11 0L10 9L3 12L-5 7Z", P.cloth[0], .8));
      add(vp("M-7-5L4-9L15-2L10 1L6-4L-2-3Z", P.cloth[3], .9));
      add(vp("M-3 2L10 0", null, 4.8));
      eyes(3, 1.7, 3.6, expr === "scared", true);
      add(vp("M3 5L6 7L3 10", null, .9, P.cloth[2]));
      add(vp("M-5 10L-6 19M8 11L9 16", null, 1.1, P.paper[1]));
    } else if (who === "hood-small") {
      add(vp("M-11-3Q-10-12 0-12Q10-12 12-3L11 6L5 12L-5 11L-10 5Z", P.cloth[0]));
      add(vp("M-9 0L9-2L10 2L-9 4Z", P.ink, 0));
      eyes(0, 1, 4, expr === "scared" || expr === "stare");
      add(vp("M1 5L4 7L1 9", null, 1, P.cloth[2]));
      add(vp("M-12-3Q-14-17-3-18Q8-20 11-8L12-3Z", P.a.mustard));
      add(vp("M-12-7L12-8L12-2L-12-1Z", P.a.mustard, 1));
      add(vp("M-8-13q5-5 11-1", null, 1.2, P.paper[1]));
      add(ve(-3, -20, 3.2, 3.2, P.a.mustard, 1));
      add(vp("M5-7L9-7L9-3L5-3Z", P.paper[1], .6));
    } else if (who === "hood-cap") {
      add(vp("M-13-3Q-13-13 0-14Q12-13 13-3L12 8L-10 9Z", P.cloth[1]));
      add(vp("M-11-8L-12-15Q-2-19 9-16L13-7Z", P.cloth[0]));
      add(vp("M-11-14L-22-11L-20-7L-10-9Z", P.cloth[0], 1));
      add(vp("M-6-15L5-15", null, 1.2, P.cloth[2]));
      add(vp("M-9-4L-2-2M4-2L10-5", null, 2));
      eyes(1, -.4, 4.3, expr === "stare", true);
      add(vp("M8-5L9-1", null, 1, P.paper[1]));
      add(vp("M-12 3L0 1L12 3L9 11L1 15L-9 11Z", P.a.red));
      add(vp("M-9 4L1 5L8 4L3 9Z", P.a.stamp, 0));
      add(vp("M10 8L17 10L13 16L9 12Z", P.a.red, 1));
    } else if (who === "driver") {
      add(vp("M-11-3Q-13-16-2-16Q11-17 12-4L12 8Q7 14-2 13L-10 7Z", P.cloth[0]));
      add(vp("M-11-10Q1-16 11-10L11-6Q0-9-11-6Z", P.cloth[1], .9));
      add(vp("M-12-2L13-3L12 3Q7 5 2 2L-2 2Q-7 5-12 2Z", P.metal[2], 1.2));
      add(vp("M-9-.4L-3-1M5-1L10-1.6", null, 1.4, P.paper[3]));
      add(vp("M-3 8q3-2 6 0", null, 2, P.cloth[2]));
      add(vp("M-7-12v3M-3-13v3M2-13v3M7-12v3", null, .6, P.cloth[2]));
    } else if (who.startsWith("collector")) {
      const marshal = who.endsWith("marshal"), runner = who.endsWith("runner"), gatherer = who.endsWith("gatherer");
      add(vp(marshal ? "M-12 12L-15-5L-8-19L3-21L13-9L14 10L7 14Z" : runner ? "M-12 10L-14-7L-6-18L9-14L15-3L10 12Z" : "M-13 11L-14-7Q-11-19 0-19Q13-18 14-5L12 12Z", P.metal[0]));
      add(vp("M-10 7L-10-6Q0-14 10-6L12 6L5 13L-4 12Z", P.suit[1], 1));
      add(vp("M-12-8Q-3-16 6-11L12-5", null, 2.2, P.metal[2]));
      // Real cold glass in a dark gasket, rather than a pair of glow dots.
      add(vp("M-8-4L-1-5L0 1L-7 2Z", P.cold[1], 1.2));
      add(vp(gatherer ? "M3-5Q11-7 11-1Q11 4 4 3Z" : "M3-5L10-4L10 2L3 1Z", P.cold[2], 1.2));
      add(vp("M-6-2h3M5-2h3", null, 1, P.cold[3]));
      add(vp("M0 2L5 1L9 6L4 11L-3 8Z", P.metal[2], 1));
      add(vp("M0 5L5 6M0 8L4 9", null, .9, P.suit[0]));
      add(vp("M-11 8L-6 5L-2 13L-8 15Z", P.metal[1], .9));
    }
    return parts;
  }
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
      if (p.gaze) ctx.translate((o.look?.x || 0) * .7, (o.look?.y || 0) * .45);
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
  function workLegs(ctx, top, spread, width, color, bob, shoe, sock) {
    for (const side of [-1,1]) {
      const lift = side === -1 ? bob : -bob, hx = side*spread;
      const knee = hx + side*1.5, ankle = hx + side*2;
      shape(ctx, [hx-width*.6,top, hx+width*.6,top, knee+width*.55,top*.46,
        ankle+width*.4,-5-Math.max(0,lift)*.6, ankle-width*.4,-5-Math.max(0,lift)*.6,
        knee-width*.55,top*.46], color, {ink:1.2,amp:.15,seed:side+top});
      if (sock) box(ctx,ankle-width*.43,-8-lift*.4,width*.86,5,sock,{ink:.65,amp:.1});
      const y = -2-Math.max(0,lift)*.6;
      cut(ctx, `M${ankle-width*.6} ${y-3}L${ankle+width*.5} ${y-3}Q${ankle+width*1.2} ${y-2} ${ankle+width*1.3} ${y+1}L${ankle-width*.65} ${y+1}Z`, shoe, 1);
      line(ctx,ankle-width*.5,y+1,ankle+width*1.1,y+1,P.paper[0],.7);
    }
  }

  // YOU: broad raincoat, cropped coils, a warm face and a worn scarf. The
  // camera still sees his back in the car; the turn finally reveals a person.
  function keeper(ctx, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, state = o.state || "idle";
    drop(ctx, x, y, 14, 3.6);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (state === "look-back") ctx.rotate(-0.055);
    const step = o.walking ? Math.sin(o.stride || 0) : 0;
    // Bent knees and alternating planted heels; no sliding trouser columns.
    for (const side of [-1, 1]) {
      const swing = step * side, hip = side * 4.5;
      const heel = hip + swing * 5.5, knee = hip + swing * 3;
      const lift = Math.max(0, swing) * 3;
      shape(ctx, [hip - 3, -30, hip + 3, -30, knee + 3, -15,
        heel + 2.8, -3 - lift, heel - 2.8, -3 - lift, knee - 3, -15],
        P.a.denim, { ink: 1.1, amp: 0.12 });
      oval(ctx, heel + 1.5, -2 - lift, 4.6, 2.3, P.ink, true, 0.8);
    }
    ctx.translate(0, o.walking ? -Math.abs(step) * 0.9 : 0);
    // Rounded shoulder, waist, then a heavy split hem. This is a fitted
    // human coat rather than a triangle perched on parallel trouser rods.
    cut(ctx, `M-7-75Q-19-74-20-64L-15-48L-19-27Q-7-24 0-28L4-26L18-28L13-49L18-64Q15-73 7-75Z`, P.wood[2]);
    cut(ctx, "M-7-73Q-15-71-17-64L-12-46L-14-28L-5-27L-3-55Z", P.wood[1], 0);
    cut(ctx, "M-6-72L-12-66L-6-57L0-65L6-57L13-66L6-73Z", P.wood[3], 1.1);
    cut(ctx, "M-1-64L1-27M-7-40L-13-38M6-40L12-42", null, 1, P.wood[1]);
    cut(ctx, "M6-47L14-49L13-43L6-42Z", P.wood[1], .8);
    for (const by of [-56, -47, -37]) oval(ctx, 1, by, 1.1, 1.1, P.paper[0]);
    cut(ctx, "M-9-76Q0-79 10-74L7-67Q0-65-9-70Z", P.a.maroon, 1.2);
    cut(ctx, "M-5-69L0-69L-2-55L-7-58Z", P.a.maroon, 1);
    characterHead(ctx, "you", 0, -84, { tilt: state === "look-back" ? -.12 : -.015 });
    // Arm up to the shaft. The free arm carries the tiny acting beats: a
    // glance back toward the car, then a hand toward the store door.
    cut(ctx, "M12-69Q19-67 18-60L12-54L5-56L4-62L11-61Z", P.wood[2], 1.3);
    cut(ctx, "M6-61Q10-63 10-59L9-56L5-56L3-59Z", P.skin[1], .9);
    line(ctx, 7, -58, 4, -96, P.ink, 1.3, 15, 0.1);
    if (state === "look-back") {
      cut(ctx, "M-14-68Q-18-68-20-62L-17-57L-12-59L-10-64Z", P.wood[1], 1.2);
      oval(ctx, -19, -60, 3, 2.4, P.skin[1], true, .9);
    } else if (state === "door") {
      cut(ctx, "M-11-70Q-17-72-17-79L-12-82L-8-76Z", P.wood[2], 1.2);
      oval(ctx, -14, -80, 2.7, 2.3, P.skin[1], true, .9);
    } else {
      const swing = step * 3;
      cut(ctx, `M-13-69Q-20-68-20-61L${-19-swing}-51L${-14-swing}-42L${-8-swing}-45L${-12-swing}-53L-10-63Z`, P.wood[1], 1.2);
      oval(ctx, -11 - swing, -44, 3, 2.8, P.skin[1], true, .9);
    }
    // The umbrella: eight panels, a lit top band, a bent rib (it has been through weather before).
    const canopy = [-24, -103, -18, -110, -9, -115, 4, -117, 16, -114, 26, -108, 30, -102];
    const rim = [30, -102, 25, -104, 20, -101, 14, -104, 8, -101, 2, -104, -4, -101, -10, -104, -16, -101, -21, -104, -24, -103];
    shape(ctx, [...canopy, ...rim.slice(2)], P.a.umbrella, { ink: CH, seed: 16, amp: 0.3 });
    shape(ctx, [-18, -110, -9, -115, 4, -117, 16, -114, 12, -111, 2, -113, -8, -111], P.a.umbrellaLight, { ink: false, seed: 17, amp: 0.3 });
    for (const rx of [-10, 2, 14]) line(ctx, 4, -117, rx, -102, P.ink, 0.7, rx, 0.3);
    line(ctx, 4, -117, 24, -106, P.ink, 0.7, 99, 0.9);
    line(ctx, 4, -117, 4, -121, P.ink, 1.4);
    line(ctx, 4, -102, 5, -96, P.ink, 1.3, 15, .1);
    // Drops rolling off the rim (time-based, not random).
    for (let index = 0; index < 3; index += 1) {
      const k = ((t / 700) + index * 0.37) % 1, dx = [-22, 28, 9][index];
      ctx.globalAlpha = 0.8 * (1 - k); rect(ctx, P.wet[3], dx, -101 + k * 14, 0.9, 2.2); ctx.globalAlpha = 1;
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
    const bob = o.bob || 0, grab = o.state === "grab";
    ctx.save(); ctx.translate(x,y);
    if (o.flinch) ctx.rotate(-.14*(o.face || 1));
    ctx.scale(o.face || 1,1);
    const scared = Boolean(o.flinch), expr = scared ? "scared" : o.state === "phone-away" ? "quiet" : "neutral";
    if (kind === "hood-tall") {
      drop(ctx,0,0,14,3.6);
      workLegs(ctx,-44,4.5,7,P.cloth[1],bob,P.ink,P.a.sock);
      ctx.save(); ctx.rotate(.07);
      sleeve(ctx,[-12,-79,-18,-66,-6,-55],P.cloth[1],6,P.skin[1]);
      // A forward shoulder, fitted rib hem and long angular sleeves. The
      // front of the hood is an overhang rather than a head-sized pentagon.
      cut(ctx,"M-6-90Q-16-90-18-80L-13-60L-15-44L4-40L14-45L13-65L16-79Q13-86 7-89Z",P.cloth[2]);
      cut(ctx,"M-12-85L-7-85L-7-60L-11-45L-14-44Z",P.cloth[1],0);
      cut(ctx,"M-11-52L10-51L10-44L-12-45Z",P.cloth[0],1);
      cut(ctx,"M-7-63Q2-67 9-62L7-52L-6-53Z",P.cloth[1],.9);
      line(ctx,-6,-64,7,-62,P.cloth[3],1);
      if (grab) sleeve(ctx,[9,-80,19,-69,25,-61],P.cloth[2],6.6,P.skin[1]);
      else sleeve(ctx,[11,-80,16,-65,7,-55],P.cloth[2],6.6,P.skin[1]);
      characterHead(ctx,kind,1,-95,{expr});
      ctx.restore();
    } else if (kind === "hood-small") {
      drop(ctx,0,0,14,3.6);
      workLegs(ctx,-26,5.5,8,P.cloth[1],bob,P.a.white);
      sleeve(ctx,[-14,-49,-20,-37,-13,-29],P.a.maroon,6.2,P.skin[1]);
      // Inflated shoulders over a cropped waist, with an asymmetric raised
      // collar. Two large padded chambers matter more than ten tiny seams.
      cut(ctx,"M-11-59Q-20-58-20-48L-18-36L-12-25Q0-22 14-26L19-39L18-52Q15-60 7-60Z",P.a.maroon);
      cut(ctx,"M-17-52Q-17-57-10-56L-7-35L-10-25L-15-28Z",P.a.maroonLight,0);
      cut(ctx,"M-12-59L-9-66L-1-62L6-65L12-58L3-50L-4-53Z",P.a.maroon,1.2);
      line(ctx,1,-54,2,-26,P.inkSoft,1.3);
      cut(ctx,"M-17-43Q-3-38 17-42M-13-31Q0-28 13-31",null,1,P.inkSoft);
      cut(ctx,"M-14-39L-7-37L-8-33L-14-34Z",P.cloth[0],.8);
      if (o.state === "phone-dropped") sleeve(ctx,[11,-50,12,-39,4,-32],P.a.maroon,6,P.skin[1]);
      else {
        const away = o.state === "phone-away", tell = o.state === "phone-tell";
        sleeve(ctx,[11,-50,away ? 13 : 17,away ? -38 : tell ? -44 : -42,17,-49],P.a.maroon,6,P.skin[1]);
        box(ctx,15,-54,5,8,P.ink,{ink:1,amp:.1});
        rect(ctx,o.phoneOff ? P.cloth[2] : P.fluoro[2],16,-53,3,6);
        oval(ctx,16.5,-46.5,2.6,1.9,P.skin[1],true,.8);
      }
      characterHead(ctx,kind,0,-62,{expr: o.state === "phone-tell" ? "scared" : expr});
    } else {
      drop(ctx,0,0,18,4);
      workLegs(ctx,-35,7,9,P.cloth[0],bob,P.ink);
      if (!o.reaching) sleeve(ctx,[-16,-66,-25,-73,-17,-77],P.a.track,7,P.skin[0]);
      // Heavy shoulder yoke and short, boxy track jacket; broad hips and
      // proper trouser knees. The white stripe is one continuous garment cue.
      cut(ctx,"M-10-78Q-22-77-24-68L-22-51L-17-35Q1-32 19-36L22-55L21-70Q17-78 9-78Z",P.a.track);
      cut(ctx,"M-21-69L-13-72L-10-45L-14-35L-19-38Z",P.service[0],0);
      cut(ctx,"M-18-76L-5-70L6-71L17-77L17-69L6-63L-5-63L-20-70Z",P.a.trackLight,1);
      line(ctx,1,-64,1,-37,P.inkSoft,1.2);
      cut(ctx,"M-16-73L-18-55M17-73L18-54",null,2,P.a.white);
      cut(ctx,"M-16-43L-8-41M10-42L17-45",null,1.3,P.service[0]);
      if (!grab) {
        cut(ctx,"M-18-77Q-25-77-28-67L-30-50L-24-43L-15-49L-15-66Z",P.paper[2],1.3);
        line(ctx,-28,-59,-16,-59,P.a.denim,2);
        line(ctx,-26,-53,-23,-46,P.paper[0],1);
      } else cut(ctx,"M12-66Q26-62 29-54L31-40L20-37L14-44Z",P.paper[2],1.3);
      if (!o.reaching) sleeve(ctx,[17,-67,23,-53,12,-45],P.a.track,8,P.skin[0]);
      characterHead(ctx,"hood-cap",0,-82,{expr});
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
    shape(ctx, [x - 15, y + 2, x - 12, y - 6, x - 5, y - 9, x + 5, y - 9, x + 12, y - 6, x + 15, y + 2, x + 12, y + 12, x - 12, y + 12], P.wood[2], { ink: CH, seed: 61, amp: CA });
    shape(ctx, [x - 15, y + 2, x - 12, y - 6, x - 5, y - 9, x - 3, y + 12, x - 12, y + 12], P.wood[1], { ink: false, seed: 62, amp: CA });
    rect(ctx, P.wood[3], x - 9, y - 8, 18, 1.4);
    oval(ctx, x, y - 6 + breathe * 0.2, 7.4, 4.6, P.a.maroon, true, 1.2);
    oval(ctx, x - 2, y - 7, 3, 1.6, P.a.maroonLight);
    // The same cropped coils from above; a cheek and ear on the turn.
    const turn = state === "reach" || state === "turn" ? 3.2 : state === "look" ? 1.4 : state === "look-back" ? -3.2 : 0;
    const hy = y - 10 - (state === "look" ? 3 : 0);
    ctx.save();ctx.translate(x+turn,hy);
    cut(ctx,"M-9 3Q-12-3-9-7Q-10-12-5-12Q-2-15 2-12Q8-13 10-7Q12-1 8 6L1 10L-6 8Z",P.inkSoft,1.4);
    cut(ctx,"M-7-6Q-2-11 5-7",null,1.6,P.wood[1]);
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
  const CREW_HEIGHT = Object.freeze({ driver: 62, "hood-tall": 68, "hood-small": 62, "hood-cap": 64 });
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
      talk: o.talking && !still && t ? Math.sin(t / 95) * 0.8 + Math.sin(t / 37) * 0.3 : 0,
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
  // The small one: puffer jacket, mustard beanie and pom, on a milk crate,
  // the phone in his hand. Facing the floor (and us).
  function crewSmall(ctx, k) {
    // The crate he sits on: faded blue, slotted.
    box(ctx, -11, -21, 22, 17, P.a.denim, { ink: 1.2, amp: 0.2, seed: 141 });
    rect(ctx, P.a.umbrellaLight, -10.4, -20.6, 20.8, 1.6);
    for (const gx of [-6, -1, 4]) rect(ctx, P.ink, gx, -15, 2, 8);
    // Knees forward, shins down, white trainers.
    box(ctx, -9.5, -24, 19, 7, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 142 });
    for (const side of [-1, 1]) {
      box(ctx, side * 4.6 - 2.7, -16, 5.4, 15, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 143 + side });
      oval(ctx, side * 4.6, -17, 3.4, 2.6, P.cloth[2], true, 1);
      oval(ctx, side * 5.2, -1.4, 3.6, 2, P.a.white, true, 1);
    }
    const sx = k.lean * 0.5, sy = k.hop * 0.5 + (k.quiet ? 1.6 : 0);
    ctx.save(); ctx.translate(sx, sy);
    // Off arm: on his knee, or up and open while he talks.
    if (k.talking && k.phone !== "call") sleeve(ctx, [-11, -37, -16, -31, -17, -38 + k.talk * 2], P.a.maroon, 6.2, P.skin[1]);
    else if (k.phone !== "call") sleeve(ctx, [-11, -37, -12, -28, -6, -22], P.a.maroon, 6.2, P.skin[1]);
    cut(ctx,"M-9-44Q-20-46-21-35L-17-26Q-2-18 14-24L20-33Q20-43 9-44Z",P.a.maroon);
    cut(ctx,"M-18-37Q-18-43-11-41L-8-25L-15-25Z",P.a.maroonLight,0);
    cut(ctx,"M-13-43L-10-49L0-44L8-49L14-42L5-36L-5-36Z",P.a.maroon,1);
    cut(ctx,"M-17-33Q0-28 18-32",null,1.1);
    line(ctx,1,-38,1,-24,P.inkSoft,1.1);
    // The phone: held out at what he films, held close when it rings, or in his lap.
    if (k.phone === "film") {
      const ax = 12 + Math.max(-2, k.look.x * 13), ay = -35 + k.look.y * 6;
      sleeve(ctx, [10, -38, ax - 2, ay + 2, ax, ay - 1], P.a.maroon, 6.2, null);
      box(ctx, ax - 2, ay - 8, 6, 9, P.ink, { ink: 1, amp: 0.1 });
      rect(ctx, P.metal[3], ax + 1.6, ay - 6.6, 1.4, 1.4);
      rect(ctx, P.fluoro[2], ax - 2.8, ay - 7.4, 1, 8);
      oval(ctx, ax, ay - 0.5, 2.3, 2.1, P.skin[1], true, 0.9);
    } else if (k.phone === "call") {
      if (k.state === "phone-stopped") {
        // He starts to answer; Tall's hand forces the phone back toward his lap.
        sleeve(ctx, [-11, -37, -10, -29, -5, -25], P.a.maroon, 6.2, P.skin[1]);
        sleeve(ctx, [11, -37, 8, -29, 1, -25], P.a.maroon, 6.2, P.skin[1]);
        box(ctx, -5, -30, 8, 11, P.ink, { ink: 1, amp: 0.1 });
        rect(ctx, P.fluoro[2], -4.5, -30.6, 7, 1);
      } else {
        sleeve(ctx, [-11, -37, -9, -28, -3, -29], P.a.maroon, 6.2, P.skin[1]);
        sleeve(ctx, [11, -37, 9, -28, 4, -29], P.a.maroon, 6.2, P.skin[1]);
        box(ctx, -3.5, -38, 8, 11, P.ink, { ink: 1, amp: 0.1 });
        rect(ctx, P.fluoro[2], -3, -38.6, 7, 1);
      }
    } else {
      sleeve(ctx, [11, -37, 12, -28, 7, -22], P.a.maroon, 6.2, P.skin[1]);
      box(ctx, 3, -25, 7, 4, P.ink, { ink: 0.8, amp: 0.1 });
    }
    const hx = k.lean + k.look.x * 1.3 + k.talk * .2, hy = -47 + k.hop + k.idle + (k.quiet ? 2.6 : 0) - sy;
    characterHead(ctx,"hood-small",hx,hy,{expr:k.quiet ? "quiet" : k.state === "stare" || k.phone === "call" ? "scared" : "neutral",look:k.look,tilt:-.06});
    if(k.talking) oval(ctx,hx+1,hy+8,1.4,.8+Math.abs(k.talk)*.6,P.cloth[2]);
    ctx.restore();
  }
  // The capped one: wide, track jacket with the white stripe, cap on
  // backwards (a flat top nobody else has), red bandana; elbows on his knees
  // on the wheel arch, the empty pillowcase in his hands. He points once.
  function crewCap(ctx, k) {
    for (const side of [-1, 1]) {
      box(ctx, side * 8.4 - 3.2, -18, 6.4, 17, P.cloth[0], { ink: 1.1, amp: 0.2, seed: 151 + side });
      oval(ctx, side * 8.4, -19, 4.2, 3, P.cloth[1], true, 1);
      oval(ctx, side * 9, -1.6, 4.4, 2.3, P.ink, true, 1);
      line(ctx, side * 9 - 2, -1.4, side * 9 + 1.6, -2.2, P.a.white, 0.8);
    }
    box(ctx, -13, -26, 26, 8, P.cloth[0], { ink: 1.1, amp: 0.2, seed: 153 });
    const sx = k.lean * 0.5, sy = k.hop * 0.5;
    ctx.save(); ctx.translate(sx, sy);
    cut(ctx,"M-11-46Q-23-46-24-35L-18-24Q0-19 19-24L24-34Q22-46 10-46Z",P.a.track);
    cut(ctx,"M-21-39L-14-42L-10-24L-18-24Z",P.service[0],0);
    cut(ctx,"M-18-43L-5-38L6-39L18-44L17-37L5-32L-5-32Z",P.a.trackLight,1);
    line(ctx,0,-36,0,-23,P.inkSoft,1.1);
    // Pointing: the arm on Rizo's side goes straight out at him, one finger;
    // the pillowcase drops at his feet. Otherwise elbows on knees, the cloth in his hands.
    const side = k.look.x < 0 ? -1 : 1;
    const ax = side * 14 + k.look.x * 13 + side * 8, ay = -38 + k.look.y * 13;
    if (!k.point) {
      sleeve(ctx, [-14, -39, -9, -26, -2, -27], P.a.track, 7, P.skin[0]);
      shape(ctx, [-6, -31, 5, -32, 7, -24, 1, -21, -6, -23], P.a.white, { ink: 1.1, seed: 156, amp: 0.7 });
      sleeve(ctx, [14, -39, 9, -26, 3, -27], P.a.track, 7, P.skin[0]);
    } else {
      shape(ctx, [-4, -6, 8, -7, 10, -1, -3, 0], P.a.white, { ink: 1.1, seed: 157, amp: 0.7 });
      sleeve(ctx, [-side * 14, -39, -side * 9, -26, -side * 2, -27], P.a.track, 7, P.skin[0]);
      sleeve(ctx, [side * 14, -39, (side * 14 + ax) / 2, (-39 + ay) / 2 - 1, ax, ay], P.a.track, 7, P.skin[0]);
      line(ctx, ax, ay, ax + k.look.x * 5.5, ay + k.look.y * 5.5, P.ink, 2.8);
      line(ctx, ax, ay, ax + k.look.x * 5.5, ay + k.look.y * 5.5, P.skin[0], 1.3);
    }
    rect(ctx, P.a.white, -15, -38, 1.6, 9); rect(ctx, P.a.white, 13, -38, 1.6, 9);
    const hx = k.lean + k.look.x * 1.3, hy = -47 + k.hop + k.idle - sy;
    characterHead(ctx,"hood-cap",hx,hy,{expr:k.quiet ? "quiet" : k.state === "stare" ? "stare" : "neutral",look:k.look});
    ctx.restore();
  }
  // The tall one, in the passenger seat: long legs out to the dash in socks
  // and slides, twisted round with an arm over the seatback (the seatback is
  // the van's, at x+6..x+15), hood peak drooping toward whatever he watches.
  function crewTall(ctx, k) {
    const sx = k.lean * 0.6, sy = k.hop * 0.5;
    // Legs to the dash; socks and slides.
    sleeve(ctx, [-1, -21, -12, -33, -21, -30], P.cloth[2], 5, null);
    box(ctx, -25.5, -33, 5.4, 5.6, P.a.sock, { ink: 0.9, amp: 0.1 });
    shape(ctx, [-30, -31, -24, -32.4, -23.4, -27.4, -30.4, -26.8], P.ink, { ink: false, seed: 161, amp: 0.1 });
    ctx.save(); ctx.translate(sx, sy);
    // Far arm on his knee.
    sleeve(ctx, [-4, -47, -8, -38, -11, -33], P.cloth[1], 5.8, P.skin[1]);
    cut(ctx,"M-6-53Q-14-51-13-43L-11-22L4-18L12-24L10-46Q8-53 3-55Z",P.cloth[2]);
    cut(ctx,"M-9-49L-4-50L-3-23L-10-24Z",P.cloth[1],0);
    cut(ctx,"M-7-34L8-33L7-25L-6-26Z",P.cloth[1],.9);
    line(ctx,-9,-23,8,-23,P.cloth[0],1.8);
    // Near arm over the seatback; lifted off it while he talks. When Small
    // starts to answer the Boss call, Tall reaches across and pushes the phone
    // back down instead of merely saying not to pick up.
    if (k.state === "stop-phone") sleeve(ctx, [4, -48, 22, -50, 43, -40], P.cloth[2], 6.2, P.skin[1]);
    else if (k.talking) sleeve(ctx, [4, -48, 12, -53, 17, -58 + k.talk * 2], P.cloth[2], 6.2, P.skin[1]);
    else sleeve(ctx, [4, -48, 12, -53, 18, -49], P.cloth[2], 6.2, P.skin[1]);
    const f = k.look.x < -.3 ? -1 : 1;
    const hx = 3 + k.lean + k.talk * .3, hy = -59 + k.hop + k.idle - sy + (k.quiet ? 1.5 : 0);
    ctx.save();ctx.translate(hx,hy);ctx.scale(f,1);
    characterHead(ctx,"hood-tall",0,0,{expr:k.quiet ? "quiet" : k.state === "stare" ? "scared" : "neutral",look:{x:k.look.x*f,y:k.look.y}});
    ctx.restore();ctx.restore();
  }
  // The driver: heavy shoulders over the wheel in a rust chore coat with a
  // cream fleece collar, gloves, a black ski mask and wraparound sunglasses at
  // night. Faces the road; turns half round to talk, further to look at Rizo.
  function crewDriver(ctx, k) {
    const turn = k.state === "stare" ? 0.85 : k.talking ? 0.5 : k.quiet ? 0.2 : 0;
    const sx = k.lean * 0.5, sy = k.hop * 0.4;
    // Legs down to the pedals; work boots.
    sleeve(ctx, [2, -21, -9, -25, -14, -6], P.cloth[0], 5.4, null);
    oval(ctx, -16, -4, 4, 2.2, P.ink, true, 1);
    ctx.save(); ctx.translate(sx, sy);
    // The wheel, edge-on: a tilted ring and its column to the dash.
    line(ctx, -21, -31, -31, -27, P.ink, 2.2);
    ctx.save(); ctx.translate(-21, -38); ctx.rotate(-0.28);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(0, 0, 2.8, 10.5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = P.cloth[2]; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
    // Far arm to the top of the wheel.
    sleeve(ctx, [2, -46, -8, -40, -19, -47], P.a.rust, 7, null);
    oval(ctx, -19.5, -47.5, 2.6, 2.4, P.ink, true, 0.9);
    line(ctx,-20,-49,-18,-46,P.cloth[3],1.1);
    // Heavy fleece collar, full shoulder and work-coat waist. The driver
    // carries a different shape from the bagman's wide track jacket.
    cut(ctx,"M-5-54Q-17-54-18-43L-14-22Q-2-16 13-22L18-43Q16-52 7-55Z",P.a.rust);
    cut(ctx,"M7-52L15-45L11-22L4-20Z",P.wood[1],0);
    cut(ctx,"M-10-53L-4-58L1-53L6-57L14-51L8-42L1-48L-5-42Z",P.paper[2],1.2);
    cut(ctx,"M-12-39L-4-40L-3-32L-10-31Z",P.wood[1],.8);
    // Worn canvas seams and the seat belt reinforce a road-facing driver.
    line(ctx,7,-47,-6,-22,P.inkSoft,3.2);
    line(ctx,7,-47,-6,-22,P.cloth[2],1.4);
    box(ctx,-8,-24,4,3,P.metal[2],{ink:.6,amp:.1});
    line(ctx,-8,-39,-8,-27,P.paper[0],.65);
    // Near arm: on the wheel, or off it to make a point.
    if (k.talking) { sleeve(ctx, [-3, -46, -9, -37, -11, -48 + k.talk * 2.4], P.a.rust, 7, null); oval(ctx, -11, -48.4 + k.talk * 2.4, 2.6, 2.4, P.ink, true, 0.9); }
    else { sleeve(ctx, [-3, -46, -11, -35, -21, -31], P.a.rust, 7, null); oval(ctx, -21, -31, 2.6, 2.4, P.ink, true, 0.9); }
    const hx = -1 + k.lean * .8, hy = -57 + k.hop + k.idle - sy + (k.quiet ? 1.2 : 0);
    ctx.save();ctx.translate(hx,hy);ctx.scale(-1,1);
    // The head still turns with the existing talk/stare poses.
    ctx.rotate(turn*.13);
    characterHead(ctx,"driver",0,0,{expr:k.quiet ? "quiet" : "neutral"});
    if(k.talking) oval(ctx,0,8,1.5,.8+Math.abs(k.talk)*.5,P.cloth[2]);
    ctx.restore();ctx.restore();
  }

  // LATCH. A stranded courier: a folded-paper coat with the collar turned
  // all the way up, a postal cap, his face only a strip of eyes between
  // them, a brass clasp at the throat and a satchel that drags one shoulder
  // down. Recognisable from across a room by that collar.
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

  // An arm as one inked stroke from shoulder to hand (elbow optional).
  function limb(ctx, pts, color, width, hand) {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [stroke, w] of [[P.ink, width + 2.2], [color, width]]) {
      ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (let index = 2; index < pts.length; index += 2) ctx.lineTo(pts[index], pts[index + 1]);
      ctx.stroke();
    }
    ctx.restore();
    if (hand) oval(ctx, pts[pts.length - 2], pts[pts.length - 1], 2.3, 2.1, hand, true, 0.9);
  }
  // NELL: the Mending Rows mender. Her silhouette is deliberately wider than
  // the other service workers: layered work coat, long apron panel, one pale
  // shoulder strap, tool pocket and a large tied head wrap. Those five shapes
  // survive phone scale before any small detail does. Feet at x,y; ~88u.
  const NELL_ARMS = {
    // [near arm points], [far arm points] relative to the shoulder line.
    work: [[7, -61, 14, -49, 19, -44], [-6, -60, 2, -49, 10, -45]],
    support: [[7, -61, 15, -51, 24, -45], [-6, -60, 6, -51, 17, -46]],
    lift: [[7, -61, 10, -75, 7, -91], [-6, -60, -4, -76, -1, -91]],
    clear: [[7, -61, 15, -47, 23, -37], [-6, -60, 2, -49, 7, -41]],
    point: [[7, -61, 17, -64, 27, -70], [-6, -60, -7, -49, -5, -38]],
    listen: [[7, -61, 18, -52, 11, -41], [-6, -60, -13, -52, -8, -41]],
    fix: [[7, -61, 16, -52, 24, -47], [-6, -60, 6, -52, 17, -48]],
    walk: [[7, -61, 10, -50, 10, -39], [-6, -60, -9, -50, -9, -39]],
    eat: [[7, -61, 13, -52, 7, -70], [-6, -60, 2, -50, 9, -46]],
    brace: [[7, -61, 17, -60, 25, -62], [-6, -60, 8, -58, 22, -56]],
    tired: [[7, -61, 13, -72, 3, -76], [-6, -60, -9, -50, -9, -41]],
    fit: [[7, -61, 15, -46, 19, -34], [-6, -60, 6, -46, 12, -34]],
    sit: [[7, -61, 13, -50, 17, -44], [-6, -60, 3, -50, 10, -45]]
  };
  function nell(ctx, x, y, o = {}) {
    const bob = o.bob || 0, t = o.t || 0, state = NELL_ARMS[o.state] ? o.state : "work";
    const seated = state === "sit", walking = Boolean(o.bob);
    const low = ["fit", "clear", "fix"].includes(state);
    const planted = ["brace", "support", "lift"].includes(state);
    const expr = state === "tired" ? "tired" : o.expr || (state === "listen" ? "listening" : "work");
    const quiet = !walking && !["support", "lift", "brace"].includes(state);
    const breath = quiet ? Math.sin(t / 920) * 0.45 : 0;
    drop(ctx, x, y, 15, 3.8);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (seated) {
      // She sits like somebody who has been on her feet all shift: one knee
      // forward, boots planted, apron folded out of the way.
      box(ctx, -13, -18, 24, 18, P.wood[1], { ink: 1.1, amp: 0.3, seed: 81 });
      rect(ctx, P.wood[2], -13, -18, 24, 3);
      box(ctx, -3, -27, 19, 7, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 82 });
      box(ctx, 12, -27, 5, 25, P.cloth[1], { ink: 1.1, amp: 0.2, seed: 83 });
      oval(ctx, 16, -2, 4.6, 2.3, P.wood[0], true, 1);
      ctx.translate(-2, 18);
    } else {
      if (low || planted) {
        // A worker takes the load through her knees. The hands still reach
        // their existing work surfaces; feet spread before the coat leans.
        const spread = state === "brace" ? 14 : planted ? 10 : 8;
        limb(ctx, [-6, -30, -spread - 2, -16, -spread, -3], P.cloth[1], 6, null);
        limb(ctx, [5, -29, spread + (low ? 4 : 0), -17, spread, -3], P.cloth[1], 6, null);
        for (const side of [-1, 1]) oval(ctx, side * spread + 1.5, -2, 5.8, 2.6, P.wood[0], true, 1.2);
        line(ctx, spread - 2, -4, spread + 3, -4, P.paper[0], .8);
      } else workLegs(ctx, -31, 5.5, 7.5, P.cloth[1], bob, P.wood[0]);
      // One repaired knee is readable even when the upper-body detail is lost.
      box(ctx, -7.4, -18, 5.5, 5.2, P.service[1], { ink: 0.7, amp: 0.2, seed: 78 });
      stitches(ctx, -6.8, -15.4, -2.5, -15.4, P.paper[1], 2.2, 0.7, 0.55);
    }
    ctx.translate(0, breath + (low ? 4 : state === "lift" ? -2 : 0));
    const lean = state === "brace" ? 0.18 : state === "clear" || state === "fit" || state === "fix" ? 0.2 : state === "support" ? 0.1 : state === "tired" ? -0.09 : state === "listen" ? -0.1 : state === "work" ? 0.055 : 0;
    ctx.rotate(lean);
    const slump = state === "tired" ? 3 : 0;
    ctx.translate(0, slump);
    const arms = NELL_ARMS[state];
    const swing = walking ? Math.sin(t / 110) * 3 : 0;
    const far = arms[1].map((value, index) => (index >= 2 && index % 2 === 0 && state === "walk" ? value + swing : value));
    sleeve(ctx, far, P.service[0], 6.3, P.skin[0]);

    // Work always has weight or material. Nell never pantomimes a job.
    if (state === "lift") {
      const by = -93;
      box(ctx, -11, by - 2, 32, 4, P.wood[2], { ink: 1.1, amp: 0.1, seed: 80 });
      rect(ctx, P.wood[3], -10, by - 1.6, 30, 1);
      stitches(ctx, -8, by, 17, by, P.paper[0], 4, 0.8, 0.55);
    }
    if (state === "work" || state === "fix") {
      const cy = state === "fix" ? -50 : -49;
      const lift = state === "work" ? Math.sin(t / 410) * 1.15 : 0;
      // A folded repair in her hands: patched corner, seam, needle and loose
      // thread. At small scale this becomes one pale rectangle plus red seam.
      shape(ctx, [7, cy - 2, 24, cy - 1, 23, cy + 11, 8, cy + 10], P.paper[1], { ink: 0.9, amp: 0.3, seed: 79 });
      shape(ctx, [16, cy - 1, 24, cy - 1, 23, cy + 5, 17, cy + 4], P.service[2], { ink: 0.6, amp: 0.2, seed: 179 });
      stitches(ctx, 9, cy + 5, 22, cy + 6, P.a.maroonLight, 2.5, 1.05, 0.75);
      line(ctx, 17, cy + 3 + lift, 22, cy - 3 + lift, P.metal[3], 0.9);
      ctx.save(); ctx.strokeStyle = P.a.maroon; ctx.lineWidth = 0.65; ctx.beginPath();
      ctx.moveTo(18, cy + 4 + lift); ctx.quadraticCurveTo(13, cy + 10, 9, cy + 7); ctx.stroke(); ctx.restore();
    }

    // Cropped fitted jacket over a bias-cut work apron. Shoulder → narrow
    // waist → weighted hip makes a complete silhouette without tool noise.
    cut(ctx,"M-7-65Q-17-64-18-57L-16-46L-20-34L-13-30L-8-35L11-33L19-37L14-48L15-58Q13-64 7-65Z",P.service[2]);
    cut(ctx,"M-16-57L-9-60L-8-43L-14-34L-19-35Z",P.service[1],0);
    cut(ctx,"M-10-62L-5-65L0-58L8-64L13-60L7-48L0-53L-6-49Z",P.service[0],1.1);
    cut(ctx,"M-8-60L-4-63L0-57L-3-53Z M8-62L11-59L6-51L3-54Z",P.service[3],0);
    cut(ctx,"M-10-42L12-43L22-24L12-18L5-20L-4-16L-18-22L-19-29Z",P.service[0],1.2);
    cut(ctx,"M-9-41L10-42L14-27L5-22L-4-17L-16-22L-15-32Z",P.paper[1],1.1);
    cut(ctx,"M-14-33L-7-38L-7-24L-4-18L-16-22Z",P.paper[0],0);
    cut(ctx,"M10-38L20-24L12-20L7-22Z",P.service[1],0);
    cut(ctx,"M-14-45L13-45L14-40L-13-39Z",P.a.maroon,1);
    cut(ctx,"M-14-43L-20-38L-17-33L-12-40Z M-15-39L-20-26L-13-28L-11-39Z",P.a.maroon,1);
    // A single patched pocket and the scissor holster are used in her work.
    cut(ctx,"M-10-32L1-34L3-25L-7-23Z",P.service[2],1);
    line(ctx,-9,-30,1,-32,P.paper[2],1.1);
    cut(ctx,"M11-38L19-35L16-26L10-28Z",P.wood[1],1);
    oval(ctx,14,-36,2.4,2.6,null,true,1.1);
    oval(ctx,18,-35,2.2,2.4,null,true,1.1);
    line(ctx,16,-33,15,-27,P.metal[3],1.3);
    // The broad tape gives the jacket one readable diagonal, then hangs free.
    cut(ctx,"M-13-59Q-11-66-7-61L0-43L5-34L3-30",null,4.7,P.ink);
    cut(ctx,"M-13-59Q-11-66-7-61L0-43L5-34L3-30",null,3.1,P.paper[2]);
    line(ctx,-7,-55,-4,-56,P.inkSoft,.8);
    line(ctx,-4,-48,-1,-49,P.inkSoft,.8);
    line(ctx,0,-40,3,-41,P.inkSoft,.8);

    // Holding a board steady for him: out in front at her hands, where it
    // meets whatever she is holding (the table's support, the grille, the press).
    if (state === "support") {
      ctx.save(); ctx.translate(14, -46); ctx.rotate(0.08);
      box(ctx, -4, -2.6, 34, 5.2, P.wood[2], { ink: 1.2, amp: 0.1, seed: 80 });
      rect(ctx, P.wood[3], -3, -2.2, 32, 1.2);
      stitches(ctx, 0, 0.6, 27, 0.6, P.paper[0], 4, 0.8, 0.55);
      ctx.restore();
    }
    // Fixing: bent to the job with a scraper.
    if (state === "fix") { line(ctx, 22, -48, 31, -41, P.ink, 2.6, 196, 0); line(ctx, 22, -48, 31, -41, P.metal[3], 1.3, 196, 0); }
    // Near arm: one sleeve always rolled higher; the wood tool cuff and skin
    // break the coat silhouette into a useful-worker read rather than a blob.
    const near = arms[0].map((value, index) => (index >= 2 && index % 2 === 0 && state === "walk" ? value - swing : value));
    sleeve(ctx, near, P.service[2], 6.5, P.skin[1]);
    limb(ctx, near.slice(2), P.skin[1], 4.2, P.skin[1]);
    const cx = (near[2] + near[4]) / 2, cy = (near[3] + near[5]) / 2;
    oval(ctx, cx, cy, 2.5, 1.7, P.wood[2], true, 0.8);
    oval(ctx, near[2], near[3], 2.9, 2.3, P.service[3], true, 0.8);
    // Palm and thumb wrap around the job, rather than ending in a joint bead.
    oval(ctx, near[4] + 1, near[5], 2.9, 2.1, P.skin[1], true, .8);
    line(ctx, near[4] - 1, near[5] - 1, near[4] + 1.4, near[5] - 2.4, P.skin[0], 1.1);

    // Broad cheek, open eye plane and a swept tied wrap: the warm face is
    // legible at the same camera distance as her work. Every expression is
    // also the exact geometry in the dialogue portrait.
    const tilt = expr === "listening" ? -.14 : expr === "tired" ? .12 : expr === "measuring" ? .09 : expr === "amused" ? -.06 : 0;
    characterHead(ctx,"nell",1,-67,{expr,tilt});
    ctx.restore();
  }

  // ORR: the kitchen runner. Compact and work-worn: low patched cap,
  // dropped towel shoulder, reinforced apron, and a clipped serving spoon.
  // He leans into the job instead of posing; the oversized tray stays the read. ~82u.
  function orr(ctx, x, y, o = {}) {
    const bob = o.bob || 0, state = o.state || "tray", t = o.t || 0;
    const expr = o.expr || "serving", carrying = state === "carry";
    const free = state !== "tray" && !carrying;
    drop(ctx, x, y, 14, 3.6);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);

    // Short, planted service legs. One wrapped shin breaks the symmetry.
    if (!bob) {
      limb(ctx, [-6,-28,-8,-14,-8,-3], P.cloth[0], 6.6, null);
      limb(ctx, [5,-28,free ? 11 : 7,-16,free ? 13 : 10,-3], P.cloth[0], 6.3, null);
      oval(ctx,-7,-2,5.5,2.6,P.wood[0],true,1);
      oval(ctx,free ? 15 : 11,-2,6,2.6,P.wood[0],true,1);
    } else workLegs(ctx,-27,6.5,8.5,P.cloth[0],bob,P.wood[0]);
    rect(ctx, P.paper[0], -8.2, -14.5, 5.2, 3.2);
    line(ctx, -7.7, -13.1, -3.5, -13.1, P.wood[1], 0.7, 201, 0.1);

    // Weight forward, towel shoulder low: useful rather than heroic.
    ctx.save();
    ctx.translate(0, -27);
    ctx.rotate(carrying ? -0.08 : free ? -0.095 : 0.07);
    ctx.translate(0, 27);

    sleeve(ctx, state === "carry" ? [-7, -57, -11, -45, -9, -34] : [-7, -57, 0, -48, 10, -46], P.a.mustard, 6.4, P.skin[0]);

    // Low sloping shoulders and a pear-shaped kitchen smock. The apron is
    // one broad, squared plane; Nell's wrap has a completely different cut.
    cut(ctx,"M-9-59Q-19-59-21-50L-22-38Q-24-23-11-21L10-20Q23-23 24-36L21-49Q18-59 8-60Z",P.a.mustard);
    cut(ctx,"M-18-52L-11-55L-9-36L-14-22Q-23-24-21-37Z",P.wood[2],0);
    cut(ctx,"M-9-59L-4-60L0-54L8-59L11-55L5-49L-2-50Z",P.paper[1],1);
    cut(ctx,"M-11-52L8-52L16-38L18-18L-17-18L-18-35Z",P.paper[2],1.3);
    cut(ctx,"M-12-48L-7-49L-7-33L-10-19L-17-19L-18-34Z",P.paper[0],0);
    cut(ctx,"M-7-50L6-50L9-35L-9-35Z",P.paper[1],.9);
    cut(ctx,"M-18-34Q-3-37 17-33L17-30L-18-30Z",P.wood[1],1);
    cut(ctx,"M-5-27L11-27L10-21L-4-21Z",P.paper[0],.9);
    line(ctx,-3,-25,9,-25,P.paper[3],1);
    line(ctx,4,-20,4,-18,P.wood[2],1.2);
    // The long striped kitchen towel has its own mass on his low shoulder.
    cut(ctx,"M7-62Q15-66 19-59L17-42L13-33L6-35L8-47Z",P.paper[3],1.2);
    for(const sy of [-55,-48,-41]) line(ctx,9,sy,16,sy+1,P.a.red,1.2);
    oval(ctx,-18,-29,2.7,2.7,null,true,1);
    line(ctx,-18,-26,-20,-19,P.metal[2],1.6);
    oval(ctx,-20,-17,2.8,3.4,P.metal[2],true,.9);

    // Near arm and the object he is responsible for.
    if (state === "tray") {
      sleeve(ctx, [6, -56, 13, -44, 24, -47], P.a.mustard, 7.2, P.skin[0]);
      oval(ctx,24,-48,3.4,1.8,P.skin[0],true,.8);
      box(ctx, 0, -51, 37, 3.4, P.metal[2], { ink: 1.1, amp: 0.2, seed: 100 });
      rect(ctx, P.metal[3], 1, -50.6, 35, 0.8);
      oval(ctx, 11, -53.3, 5, 2.2, P.paper[3], true, 0.9);
      oval(ctx, 26, -53.3, 5, 2.2, P.paper[3], true, 0.9);
      oval(ctx, 11, -54.2, 3, 1.2, P.ember[1]);
      oval(ctx, 26, -54.2, 3, 1.2, P.ember[1]);
      shape(ctx, [18, -56, 25, -56, 28, -52, 20, -51], P.paper[1], { ink: 0.7, seed: 101, amp: 0.25 });
      ctx.save();ctx.globalAlpha=.45;
      for(const px of [10,26]) { const sway=Math.sin(t/700+px)*.8; line(ctx,px,-57,px-1+sway,-61,P.paper[3],.85);line(ctx,px-1+sway,-61,px+sway,-64,P.paper[3],.7); }
      ctx.restore();
    } else if (state === "carry") {
      sleeve(ctx, [6, -56, 10, -45, 8, -35], P.a.mustard, 7, P.skin[0]);
      box(ctx, 4, -43, 5, 27, P.metal[1], { ink: 1.1, amp: 0.2, seed: 102 });
      rect(ctx, P.metal[3], 5, -41, 1, 23);
      oval(ctx, 6.5, -38, 0.8, 0.8, P.a.brass);
    } else {
      // Hands free: thumb hooked into his belt, elbow out, weight on one leg.
      sleeve(ctx, [6,-56,18,-43,10,-32], P.a.mustard, 7.2, P.skin[0]);
      line(ctx,10,-33,7,-35,P.skin[0],1.5);
    }

    // Wide jaw, a proper nose and a blunt beard under the soft patched cap.
    // The cap stays low, but it no longer consumes his entire face.
    const headTilt = expr === "dry" ? -.16 : expr === "irritated" ? .13 : carrying ? .12 : free ? -.09 : -.045;
    characterHead(ctx,"orr",1,-63,{expr,tilt:headTilt});
    ctx.restore();
    ctx.restore();
  }
  // THE NIGHT PORTER. A tall greatcoat with nobody visible inside, a brass
  // hall lantern for a head (one pane cracked and taped), keys at the hip, a
  // blank luggage tag on a button. Closed, it wraps itself shut and the seam
  // is sewn tight. Open, the seam splits from the hem: the coat is hollow, and
  // the hollow is where it can be reached.
  function porter(ctx, x, y, o = {}) {
    const t = o.t || 0, open = o.open || 0, settled = o.settled, flash = o.flash;
    if (settled) {
      // Defeated: the coat folded on the floor, the lantern set down beside it, still lit, low.
      drop(ctx, x, y + 14, 30, 7, 0.5);
      ctx.save(); ctx.translate(x, y + 14);
      shape(ctx, [-28, 0, -22, -12, -6, -16, 14, -14, 26, -6, 28, 2], P.cloth[1], { ink: CH, seed: 81, amp: 0.6 });
      shape(ctx, [-20, -8, 0, -13, 18, -10, 8, -4, -12, -3], P.cloth[2], { ink: 1, seed: 82, amp: 0.5 });
      for (const bx of [-8, 0, 8]) oval(ctx, bx, -8, 1.3, 1.3, P.a.brass, true, 0.6);
      ctx.restore();
      lantern(ctx, x + 32, y + 12, t, 0.35, 0.1);
      return;
    }
    const sway = Math.sin(t / 900) * 1.2, lean = o.lean || 0;
    drop(ctx, x, y + 20, 26, 7, 0.5);
    ctx.save(); ctx.translate(x, y + 20);
    ctx.rotate(lean * 0.12 + sway * 0.01);
    const coat = flash ? P.cloth[3] : P.cloth[1], coatLight = flash ? P.paper[2] : P.cloth[2];
    // The hem: a heavy bell, frayed; it never shows feet.
    shape(ctx, [-24, 0, -19, -4, -14, 0, -8, -3, -2, 0, 4, -3, 10, 0, 16, -4, 23, 0, 17, -44, 13, -58, -13, -58, -17, -44], coat, { ink: 2, seed: 83, amp: 0.6 });
    shape(ctx, [-24, 0, -19, -4, -14, 0, -10, -2, -9, -44, -13, -58, -17, -44], P.cloth[0], { ink: false, seed: 84, amp: 0.5 });
    // Shoulders hunched up around the lantern; frayed epaulettes.
    shape(ctx, [-17, -50, -20, -60, -12, -66, 12, -66, 20, -60, 17, -50], coatLight, { ink: 1.8, seed: 85, amp: 0.5 });
    for (const side of [-1, 1]) { rect(ctx, P.a.brass, side * 15 - 3, -63, 6, 2); for (let f = 0; f < 3; f += 1) rect(ctx, P.a.brass, side * 15 - 2.5 + f * 2, -61, 0.8, 2.2); }
    // A darned elbow patch.
    box(ctx, -18, -36, 6, 8, P.paper[1], { ink: 0.9, amp: 0.3 });
    stitches(ctx, -18, -36, -12, -36, P.ink, 2, 0.9, 0.6);
    if (open > 0) {
      // The seam splits: flaps pulled back, a hollow, the worn lining.
      const k = Math.min(1, open);
      const top = -6 - 40 * k, half = 4 + 11 * k;
      shape(ctx, [-half, 0, 0, top, half, 0], P.ink, { ink: 1.6, seed: 86, amp: 0.4 });
      shape(ctx, [-half + 2, 0, 0, top + 7, half - 2, 0], flash ? P.ember[4] : P.ember[1], { ink: false, seed: 87, amp: 0.4 });
      shape(ctx, [-half * 0.5, 0, 0, top + 16, half * 0.5, 0], flash ? "#fff" : P.ember[2], { ink: false, seed: 88, amp: 0.3 });
      // Quilted lining along the flaps.
      line(ctx, -half, 0, 0, top, P.a.maroonLight, 2.2, 89, 0.3);
      line(ctx, half, 0, 0, top, P.a.maroonLight, 2.2, 90, 0.3);
    } else {
      // Closed: wrapped over itself, buttoned, the seam sewn shut.
      line(ctx, 2, -64, -2, 0, P.ink, 1.6, 91, 0.4);
      stitches(ctx, 2, -60, -2, -2, P.paper[0], 4, 1.3, 0.8);
      for (const by of [-54, -44, -34, -24]) { oval(ctx, -5, by, 1.6, 1.6, P.a.brass, true, 0.7); oval(ctx, 7, by + 1, 1.6, 1.6, P.a.brass, true, 0.7); }
    }
    // Keys at the hip; a blank tag on a string.
    ctx.save(); ctx.translate(13, -30); ctx.rotate(Math.sin(t / 500) * 0.12);
    oval(ctx, 0, 0, 3, 3, null, true, 1); line(ctx, 0, 3, -1, 8, P.a.brass, 1.2); line(ctx, 1.5, 3, 3, 7, P.a.brass, 1.2);
    ctx.restore();
    line(ctx, -5, -44, -9, -38, P.paper[1], 0.6);
    ctx.save(); ctx.translate(-10, -36); ctx.rotate(0.3 + Math.sin(t / 650) * 0.08); box(ctx, -2.5, 0, 5, 7, P.paper[2], { ink: 0.8, amp: 0.2 }); oval(ctx, 0, 1.4, 0.7, 0.7, P.ink); ctx.restore();
    ctx.restore();
    // The lantern head, tilted (it hangs its head a little), dimmed when open.
    // Sweeping, it hoists the lamp high on a stretched collar and swings it
    // toward the side the light will travel: the outline changes, not just a tilt.
    const aim = o.lampAim || 0, hoist = aim ? 14 : 0;
    const hx = x + Math.sin(t / 900) * 1.2 + lean * 6 + aim * 9, hy = y - 52 + (open ? 4 : 0) - hoist;
    if (hoist) {
      shape(ctx, [x - 7, y - 44, x + 7, y - 44, hx + 5, hy + 4, hx - 5, hy + 4], P.cloth[1], { ink: 1.6, seed: 95, amp: 0.3 });
      for (const k of [0.35, 0.7]) line(ctx, x - 6 + (hx - x) * k, y - 44 + (hy + 4 - y + 44) * k, x + 6 + (hx - x) * k, y - 44 + (hy + 4 - y + 44) * k, P.cloth[0], 1, k * 10, 0.2);
    }
    lantern(ctx, hx, hy, t, open ? 0.45 : 1, open ? 0.3 : 0.12 + aim * 0.42, 0);
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
    const bob = o.bob || 0, t = o.t || 0, state = o.state || "patrol";
    const profile = o.profile || collectorProfile(o.id || "",state);
    drop(ctx, x, y, profile === "gatherer" ? 17 : 14, 3.8);
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    if (state === "run") {
      // Two separate, planted boots: a real stride rather than a sliding body.
      // No animation when t=0 (reduced motion), but the silhouette still runs.
      const stride = Math.sin(t / 96 + 0.75) * 8;
      limb(ctx, [-6, -30, -10 + stride * 0.35, -16, -11 + stride, -2], P.metal[1], 5.5);
      limb(ctx, [6, -30, 8 - stride * 0.35, -17, 9 - stride, -2 - Math.max(0, stride) * 0.45], P.metal[0], 5.5);
      oval(ctx, -9 + stride, -1, 5.7, 2.4, P.suit[0], true, 0.8);
      oval(ctx, 11 - stride, -1 - Math.max(0, stride) * 0.45, 5.7, 2.4, P.suit[0], true, 0.8);
    } else {
      workLegs(ctx,-30,5.5,8,P.metal[0],bob,P.suit[1]);
    }
    if (state === "spot" || state === "grab" || state === "watch-down") {
      ctx.translate(0, -30);
      ctx.rotate(state === "grab" ? 0.28 : state === "watch-down" ? 0.1 : 0.12);
      ctx.translate(0, 30);
    }
    if (state === "slam") { ctx.translate(0, -30); ctx.rotate(-0.1); ctx.translate(0, 30); }
    // Running (the Long Hall): a forward lean and a visibly swinging jar.
    if (state === "run") { ctx.translate(0, -30); ctx.rotate(0.24 + Math.sin(t / 70) * 0.04); ctx.translate(0, 30); }
    // A rigid glass capture vessel on a proper harness, with a padded
    // shoulder between the weight and the person carrying it.
    const gatherer = profile === "gatherer", marshal = profile === "marshal", runner = profile === "runner";
    const jx = gatherer ? -24 : -20, jarTop = gatherer ? -71 : -65;
    cut(ctx,`M${jx-6}-38L${jx-6} ${jarTop+9}Q${jx-6} ${jarTop} ${jx} ${jarTop}Q${jx+6} ${jarTop} ${jx+6} ${jarTop+9}L${jx+6}-38Z`,P.cold[0],1.1,P.cold[1]);
    line(ctx,jx-3,jarTop+10,jx-3,-45,P.cold[2],1.1);
    cut(ctx,`M${jx-8}-41H${jx+8}V-36H${jx-8}Z`,P.metal[1],1);
    oval(ctx,jx,jarTop-2,2,1.5,P.metal[2],true,.8);
    // Shoulder yoke, tapered belted waist and a split service-coat skirt.
    // The marshal's long wedge is different from the runner's short jacket;
    // the gatherer carries a rounder back and the factory wears a rigid vest.
    const half = gatherer ? 20 : runner ? 17 : 16;
    cut(ctx,`M-7-64Q${-half}-66 ${-half-2}-56L${-half}-44L-12-28L12-28L${half}-45L${half+1}-57Q${half}-64 8-65Z`,P.metal[1]);
    cut(ctx,`M${-half}-56L-8-60L-7-31L-12-29L${-half}-43Z`,P.metal[0],0);
    cut(ctx,"M-10-61L-4-65L1-58L7-65L13-60L8-49L1-52L-6-48Z",P.metal[2],1);
    if(marshal) {
      cut(ctx,"M-12-38L13-38L18-15L6-10L1-23L-5-12L-17-16Z",P.metal[1],1.3);
      cut(ctx,"M-12-35L-6-36L-8-16L-16-18Z",P.metal[0],0);
    } else if(gatherer) cut(ctx,"M-15-37Q0-41 16-37L18-24Q4-19-17-25Z",P.metal[0],1);
    else if(runner) cut(ctx,"M-14-38L13-38L14-28L5-25L-14-29Z",P.suit[2],1);
    else cut(ctx,"M-11-53L9-54L11-39L-11-39Z",P.metal[0],1);
    cut(ctx,"M-15-39Q0-42 15-39L14-35L-14-35Z",P.suit[1],1);
    // One diagonal harness and the Boss's mark. No emissive trim.
    line(ctx,-11,-60,7,-38,P.suit[0],3.2);
    line(ctx,-11,-60,7,-38,P.metal[2],1.3);
    mark(ctx,6,-47,8,P.cold[2]);
    characterHead(ctx,`collector-${profile}`,1,-67,{tilt:runner ? -.1 : 0});
    // The lamp on its pole, out in front. Up when he has seen something.
    const raise = state === "spot" ? -9 : state === "watch-down" ? 24 : state === "run" ? 4 + Math.sin(t / 70) * 2 : state === "search" ? Math.sin(t / 240) * 5 : Math.sin(t / 700) * 1.2;
    if (state === "watch-down") {
      // Factory catwalk sentries peer over the railing at the moving floor.
      // Light geometry stays owned by the core; this is a drawing-only pose.
      sleeve(ctx, [6, -57, 17, -47, 20, -38], P.metal[1], 6.5, P.suit[1]);
      line(ctx, 20, -39, 30, -60 + raise, P.metal[3], 1.7);
    } else {
      sleeve(ctx, [6, -57, 14, -49, 19, -50 + raise * 0.3], P.metal[1], 6.5, P.suit[1]);
      line(ctx, 17, -46, 30, -60 + raise, P.metal[3], 1.7);
    }
    box(ctx, 28, -65 + raise, 7, 6, P.suit[1], { ink: 1, amp: 0.1, seed: 227 });
    oval(ctx, 34.5, -62 + raise, 2.4, 2.8, P.cold[3]);
    if (state === "grab") {
      // Reaches across the actual catch ring; never changes that ring's size.
      sleeve(ctx, [9, -51, 24, -48, 37, -42], P.metal[1], 7, P.suit[2]);
      line(ctx, 35, -44, 42, -45, P.metal[3], 1);
    } else if (state === "slam") {
      // Both hands collide with the shutter; the face stays concealed.
      sleeve(ctx, [7, -56, 22, -61, 36, -60], P.metal[1], 7.5, P.suit[2]);
      sleeve(ctx, [8, -47, 24, -44, 36, -42], P.metal[1], 7, P.suit[2]);
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
  // Nell is warmer and more human up close than her world sprite can afford:
  // asymmetrical wrap, tired eyes, chalk behind the ear, repaired workwear and
  // a measuring strap. Expressions stay restrained; capability is the default.
  function nellPortrait(expr) {
    const tilt = expr === "listening" ? -9 : expr === "tired" ? 6 : expr === "measuring" ? 4 : expr === "amused" ? -4 : 0;
    const ruler = expr === "measuring" ? `<g transform="rotate(-20 18 48)"><path d="M2 45H34V51H2Z" fill="${P.paper[2]}" ${ink} stroke-width="1.4"/><path d="M7 45v3M13 45v2M19 45v3M25 45v2M31 45v3" stroke="${P.ink}" stroke-width="1.2"/></g>` : "";
    return svg(`${disc(P.below[1],P.service[0],P.service[1])}
<path d="M2 64L5 54Q10 46 20 46L43 47Q57 46 61 64Z" fill="${P.service[2]}" ${ink}/>
<path d="M6 64L10 52L20 47L17 64Z" fill="${P.service[1]}"/>
<path d="M21 48L30 55L43 47L48 53L39 64L30 59L23 64L16 54Z" fill="${P.service[0]}" ${ink} stroke-width="1.5"/>
<path d="M22 49L29 55L25 60L20 54Z M44 49L46 53L39 61L35 57Z" fill="${P.service[3]}"/>
<path d="M9 53Q13 45 18 50L25 64" stroke="${P.ink}" stroke-width="5.4" fill="none"/>
<path d="M9 53Q13 45 18 50L25 64" stroke="${P.paper[2]}" stroke-width="3.2" fill="none"/>
<path d="M17 55L21 54M20 61L24 60" stroke="${P.inkSoft}" stroke-width="1"/>
<g transform="translate(35 33) rotate(${tilt}) scale(1.38)">${characterHeadSvg("nell",expr)}</g>${ruler}`);
  }
  function orrPortrait(expr) {
    const tilt = expr === "dry" ? -8 : expr === "irritated" ? 5 : 0;
    return svg(`${disc(P.below[1],P.wood[1],P.wood[2])}
<path d="M0 64L4 54Q7 49 17 48L43 48Q56 49 61 57L64 64Z" fill="${P.a.mustard}" ${ink}/>
<path d="M17 48L27 55L40 48L45 52L34 60L23 59Z" fill="${P.paper[1]}" ${ink} stroke-width="1.3"/>
<path d="M17 52L19 59L16 64H47L44 58L42 52L37 56L24 56Z" fill="${P.paper[2]}" ${ink} stroke-width="1.5"/>
<path d="M46 44Q57 43 58 52L55 64H45Z" fill="${P.paper[3]}" ${ink} stroke-width="1.6"/>
<path d="M48 52L56 53M48 58L55 59" stroke="${P.a.red}" stroke-width="1.8"/>
<g transform="translate(31 29) rotate(${tilt}) scale(1.42)">${characterHeadSvg("orr",expr)}</g>`);
  }
  function youPortrait() {
    return svg(`${disc(P.night[0],P.night[1],P.night[2],34,20)}${rainLines}
<path d="M0 18Q10 0 35 0Q56 0 64 18L56 16L47 19L36 16L25 19L14 16L4 20Z" fill="${P.a.umbrella}" ${ink} stroke-width="1.8"/>
<path d="M7 64Q5 48 21 45H42Q59 46 58 64Z" fill="${P.wood[2]}" ${ink}/>
<path d="M14 51L24 45L30 53L22 63Z M43 46L52 52L43 63L36 53Z" fill="${P.wood[3]}" ${ink} stroke-width="1.3"/>
<path d="M24 47L39 47L42 56L25 57L22 64H17L21 55Z" fill="${P.a.maroon}" ${ink} stroke-width="1.5"/>
<g transform="translate(32 31) scale(1.55)">${characterHeadSvg("you")}</g>`);
  }
  function hoodPortrait(who, expr = "neutral") {
    const tilt = expr === "scared" ? -7 : 0;
    const small = who === "hood-small", cap = who === "hood-cap", driver = who === "driver";
    const cloth = small ? P.a.maroon : cap ? P.a.track : driver ? P.a.rust : P.cloth[2];
    const garment = driver
      ? `<path d="M10 49L21 43L32 51L42 43L54 49L46 61L33 55L20 61Z" fill="${P.paper[2]}" ${ink} stroke-width="1.5"/><path d="M12 63L43 48" stroke="${P.cloth[0]}" stroke-width="3.5"/>`
      : cap
        ? `<path d="M9 48L21 54L43 54L55 48" stroke="${P.a.trackLight}" stroke-width="5" fill="none"/><path d="M12 50L9 64M51 50L55 64" stroke="${P.paper[3]}" stroke-width="2.5"/>`
        : small
          ? `<path d="M7 56Q32 61 57 56" stroke="${P.ink}" stroke-width="1.6" fill="none"/><path d="M47 64L49 49L59 50L57 64Z" fill="${P.ink}" ${ink} stroke-width="1.3"/><path d="M51 52L57 52L56 62H50Z" fill="${P.fluoro[2]}"/>`
          : `<path d="M12 60L28 62L39 60" stroke="${P.cloth[0]}" stroke-width="3" fill="none"/>`;
    return svg(`${disc(P.night[0],P.night[1],P.sodium[0],46,14)}${rainLines}
<path d="M2 64Q1 48 19 45H45Q60 48 62 64Z" fill="${cloth}" ${ink}/>
<path d="M32 48V64" stroke="${P.ink}" stroke-width="1.3"/>${garment}
<g transform="translate(${cap ? 34 : 32} ${small ? 35 : 30}) rotate(${tilt}) scale(${small ? 1.4 : cap ? 1.35 : 1.45})">${characterHeadSvg(who,expr)}</g>`);
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
    characterHead, characterHeadSvg, cut,
    P, RULES, HEIGHT, rng, seedOf, trace, inkStroke, shape, box, oval, line, rect, drop,
    tape, stitches, rivet, worn, label,
    concrete, asphalt, tiles, planks, wallFace, block, metalPanel, clip,
    createLighting, flame, hearth,
    keeper, van, hood, seated, vanRide, CREW_HEIGHT, youSeated, cart, latch, nell, orr, porter, lantern, draftling, needle, cooler, bowl,
    mark, markSvg, callingCard, collector, collectorProfile, jar, jarLight, cage, beltCrate, jarTray, speaker,
    PORTRAITS: CAST_PORTRAITS
  });
});
